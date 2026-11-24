# Automatic deployment to the Monizer VPS

After one-time provisioning, merging or pushing to main needs no SSH session,
git pull or manual build. The existing CI Pipeline tests the commit; Fork Images
builds backend/frontend once and adds sha-<full-commit> tags. Deploy to Production
runs on completion of either workflow. Its gate requires the latest push run of
**both** workflows for that exact main commit to succeed. The first completion
can skip; the second rechecks both. A failed or cancelled workflow never qualifies.
No CI or build gate is bypassed. A manual run on main retries this same gate.

The image manifest revision must equal the tested commit. Tags resolve to digests
before transfer, and Compose uses those digests. The workflow group serializes
jobs; a VPS flock prevents overlapping scripts; a durable CI-run-id fence refuses
older deployments, even after a failed newer attempt. Superseded main commits are
skipped. Duplicate successful deployments are no-ops.

## GitHub configuration

Enable Actions and GHCR publishing for this fork. Create the **production**
environment; restrict deployment branches to main. Omit required reviewers if
unattended deployment is desired. Configure these environment secrets:

| Secret              | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| VPS_HOST            | VPS IPv4 address or DNS name, without a protocol               |
| VPS_USER            | Dedicated Ubuntu SSH login, e.g. monizer                       |
| VPS_SSH_PRIVATE_KEY | Private key whose public key is in that user's authorized_keys |
| VPS_SSH_KNOWN_HOSTS | Verified OpenSSH known_hosts entry for the VPS; required       |
| VPS_SSH_PORT        | Optional SSH port; defaults to 22                              |

Verify the host key fingerprint through the VPS console/provider before saving
known_hosts. For a nonstandard port the entry uses [hostname]:port. The workflow
never accepts a newly scanned key automatically. The runner's GITHUB_TOKEN needs
contents/actions read and packages read; Fork Images already grants packages write.
No PAT is needed by the workflow. Protect main against force pushes and require CI.

## One-time Ubuntu VPS setup

This script updates an **existing** Compose installation. It deliberately refuses
to create a replacement database when it cannot find the current stack.

1. Install Docker Engine with the Compose v2 and Buildx plugins, Python 3,
   gzip and util-linux (flock). Allow the deploy user to use Docker and write to
   /opt/apps/monizer. Docker group access is effectively root access.
2. Keep the production .env in /opt/apps/monizer, mode 600. Keep its database
   credentials, JWT_SECRET and ENCRYPTION_KEY stable. It is never uploaded by CI.
3. Provision the stack once using the production Compose file and a known-good
   commit's images. The existing containers must be named monize-postgres,
   monize-backend and monize-frontend, in the same Compose project, all running.
   Keep the Compose source files referenced by the containers' labels available.
   The updater detects the current project name; it never recreates PostgreSQL.
4. Set BACKUP_HOST_DIR and ATTACHMENT_HOST_DIR in .env to the **existing absolute
   host paths**. Match the current mounts, not newly created empty directories.
   The script refuses changed application bind mounts. Keep the existing database
   volume and reverse proxy/firewall configuration.
5. If GHCR packages are private, authenticate Docker **as the deploy user** once:

   ```bash
   docker login ghcr.io -u ryanmarinhodev
   ```

   Supply a token with read:packages at the password prompt. Public packages need
   no login. The runner's registry login does not authenticate the VPS.

6. Ensure inbound SSH from GitHub-hosted runners is reachable. Reserve disk space
   for both images, retained rollback images and database dumps. Arrange encrypted
   off-host backups of PostgreSQL **and attachments** separately. Deployment dumps
   contain sensitive financial data and are retained with private permissions;
   this script does not prune backups or volumes.

For a fresh installation, complete the initial application/database provisioning
before enabling the deployment environment. The production Compose file's default
images point upstream: override both application images with the intended fork
commit, using docker-compose.fork.yml and the DEPLOY_BACKEND_IMAGE and
DEPLOY_FRONTEND_IMAGE environment variables set to full GHCR digest references.

## What happens on the VPS

Each release has its own directory under /opt/apps/monizer/releases. Root Compose
files, .env and existing data are not overwritten. Compose uses the existing
project name and /opt/apps/monizer as its project directory, preserving paths.

Before any app stops, the script validates mounts/configuration, captures previous
Compose inputs, tags the actual running image IDs locally and pulls both targets.
It then stops frontend/backend, dumps PostgreSQL through pg_dump, checks pipeline
success and gzip integrity, and renames the partial backup to its final name.
This is a brief maintenance window, not a zero-downtime rollout. No new backend
starts before the backup finishes. PostgreSQL stays running throughout.

Only backend and frontend are recreated, with --no-deps and --pull never. Each
must report a Docker healthcheck of healthy within five minutes; missing checks
are failures. These are the existing liveness checks, not a complete business
transaction test. The script never removes volumes or attachments, never restores
SQL automatically, and never runs Compose down.

## Failure and recovery

- Pull/configuration/mount failure: current containers remain running.
- Backup failure: restart the original containers; do not start new images.
- Startup/health failure with unchanged migration history: recreate both previous
  images with their saved Compose inputs and verify both healthchecks. The Actions
  run still fails. Local rollback tags work even on the first automated deployment.
- Changed or unreadable migration history: stop the apps and leave .deploy-blocked.
  Do not automatically run old code against an unverified schema. Migration history
  is checked after stopping the new backend; db-migrate records each migration in
  its own SQL transaction. This is a conservative gate, not proof that every image
  pair is backward compatible.
- Interrupted process/host or failed rollback: .deploy-blocked remains and future
  automated attempts refuse to proceed until an operator reconciles the state.

The marker names the release directory and pre-deploy dump. Inspect application
logs, migrations and saved previous Compose inputs. Prefer a forward repair.
Only restore a database after evaluating writes since the dump and attachment
consistency; restoring it can discard newer data. Test recovery on a separate
PostgreSQL instance first. No automatic database downgrade is attempted.

After recovery, verify both images and healthchecks, then remove .deploy-blocked
and reconcile .deploy-success (remove it if its commit is no longer installed).
Keep .deploy-order; it is the stale-run fence. Retry Deploy to Production on main.
Routine updates need no VPS access; these exceptional recovery cases do.

## Validation without deployment

Run from the repository root:

```bash
bash -n scripts/deploy.sh scripts/deploy-gate.sh
python3 scripts/deploy.test.py
node scripts/check-env-docs.mjs
node scripts/check-docs-manifests.mjs
```

The Python suite uses temporary files, fake Docker/GitHub commands and a real
kernel file lock. It tests ordering, backup failure, mount changes, missing health,
Compose failures, first-deploy rollback, migration refusal and duplicate events.
It contacts neither the VPS nor a Docker daemon. Real Ubuntu/Compose/registry
integration and a restore drill remain staging verification responsibilities.

Relevant release invariant: INV-RELEASE-001 (same tested and deployed revision).
This adds no post-test commit, branch-protection bypass, dependency or second build.
