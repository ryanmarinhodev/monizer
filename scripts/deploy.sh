#!/usr/bin/env bash
# Run only on the existing Ubuntu VPS; args: commit, CI push run id, two digests.
set -Eeuo pipefail
umask 077
fail() { echo "ERROR: $*" >&2; exit 1; }
[[ $# == 4 ]] || fail 'Expected commit, CI run id, backend digest, frontend digest'
commit=$1 order=$2
[[ "$commit" =~ ^[a-f0-9]{40}$ && "$order" =~ ^[1-9][0-9]{0,17}$ ]] || fail 'Invalid revision/order'
[[ "$3" =~ ^ghcr.io/ryanmarinhodev/monize-backend@sha256:[a-f0-9]{64}$ ]] || fail 'Invalid backend digest'
[[ "$4" =~ ^ghcr.io/ryanmarinhodev/monize-frontend@sha256:[a-f0-9]{64}$ ]] || fail 'Invalid frontend digest'
release=$(cd -- "$(dirname -- "$0")" && pwd)
app=/opt/apps/monizer
cd "$app"
for command in docker flock gzip python3; do command -v "$command" >/dev/null || fail "Missing $command"; done
[[ -f .env ]] || fail 'Provision the production .env first'
docker compose version >/dev/null
exec 9>.deploy.lock
flock -n 9 || fail 'Another deploy holds the VPS lock'
[[ ! -f .deploy-blocked ]] || fail 'Previous interrupted/unsafe deployment requires recovery; see .deploy-blocked'
if [[ -f .deploy-order ]]; then
  read -r previous_order previous_commit < .deploy-order
  [[ "$previous_order" =~ ^[1-9][0-9]{0,17}$ && "$previous_commit" =~ ^[a-f0-9]{40}$ ]] || fail 'Invalid deployment fence'
  (( order >= previous_order )) || fail 'Superseded deploy refused'
  [[ "$order" != "$previous_order" || "$commit" == "$previous_commit" ]] || fail 'Run identity mismatch'
fi
if [[ -f .deploy-success ]] && [[ "$(cat .deploy-success)" == "$commit" ]]; then
  echo "Already deployed $commit"
  exit 0
fi
# This is an updater, not database provisioning. Preserve the actual project name.
project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' monize-backend)
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || fail 'Missing Compose project'
for service in backend frontend postgres; do
  [[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "monize-$service")" == "$project" ]] || fail 'Containers belong to different projects'
  [[ "$(docker inspect -f '{{.State.Running}}' "monize-$service")" == true ]] || fail "$service must be running before deployment"
done
# Keep original Compose inputs and exact local image IDs for rollback, including
# the first automated deploy (which has no previous deploy state file).
mkdir -p "$release/previous" backups/pre-deploy
old_files=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.config_files"}}' monize-backend)
IFS=',' read -r -a files <<< "$old_files"
old=(docker compose --project-directory "$app" --env-file "$app/.env" -p "$project")
index=0
for file in "${files[@]}"; do
  [[ -f "$file" ]] || fail "Previous Compose input unavailable: $file"
  cp -- "$file" "$release/previous/$index.yml"
  old+=(-f "$release/previous/$index.yml")
  index=$((index + 1))
done
(( index > 0 )) || fail 'Previous Compose inputs missing'
for service in backend frontend; do
  image_id=$(docker inspect -f '{{.Image}}' "monize-$service")
  docker image tag "$image_id" "monizer-rollback-$service:$order"
done
cat > "$release/previous/images.yml" <<YAML
services:
  backend:
    image: monizer-rollback-backend:$order
  frontend:
    image: monizer-rollback-frontend:$order
YAML
old+=(-f "$release/previous/images.yml")
export DEPLOY_BACKEND_IMAGE="$3" DEPLOY_FRONTEND_IMAGE="$4"
new=(docker compose --project-directory "$app" --env-file "$app/.env" -p "$project" -f "$release/docker-compose.prod.yml" -f "$release/docker-compose.fork.yml")
"${old[@]}" config --quiet
"${new[@]}" config --quiet
# Refuse a configuration that would silently remount attachments/backups elsewhere.
"${new[@]}" config --format json > "$release/config.json"
docker inspect monize-backend monize-frontend > "$release/containers.json"
python3 - "$release" <<'PY'
import json, sys
from pathlib import Path
p = Path(sys.argv[1])
config = json.loads((p / 'config.json').read_text())
for container in json.loads((p / 'containers.json').read_text()):
    service = container['Config']['Labels']['com.docker.compose.service']
    actual = {(m['Destination'], m['Source']) for m in container['Mounts'] if m['Type'] == 'bind'}
    wanted = {(m['target'], m['source']) for m in config['services'][service].get('volumes', []) if m['type'] == 'bind'}
    if actual != wanted:
        raise SystemExit(f'Refusing changed persistent bind mounts for {service}; reconcile VPS paths first')
PY
rm "$release/config.json" "$release/containers.json"
"${new[@]}" pull backend frontend
wait_health() {
  local service=$1 state
  for ((attempt=0; attempt<60; attempt++)); do
    state=$(docker inspect -f '{{.State.Running}} {{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "monize-$service") || return 1
    case "$state" in
      'true healthy') return 0 ;;
      'true starting'|'true unhealthy') sleep 5 ;;
      *) return 1 ;;
    esac
  done
  return 1
}
migrations() {
  docker exec monize-postgres sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT filename FROM schema_migrations ORDER BY filename"'
}
# Fence and recovery marker precede every service mutation. SIGKILL/host loss keeps
# the marker; subsequent automated attempts fail closed instead of guessing.
printf '%s %s\n' "$order" "$commit" > .deploy-order.tmp
mv .deploy-order.tmp .deploy-order
backup="$app/backups/pre-deploy/${order}-${commit}-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
printf 'Release: %s\nBackup: %s\n' "$release" "$backup" > .deploy-blocked
phase=stopping
recover() {
  local rc=$?
  trap - EXIT HUP INT TERM
  if [[ "$phase" == complete ]]; then return; fi
  echo "Deployment failed during $phase. Recovery inputs: $release/previous" >&2
  # Stop the new backend before inspecting migration history: it must not still
  # be committing a migration while we decide whether old code can restart.
  if [[ "$phase" == updating ]]; then
    if ! "${new[@]}" stop frontend backend; then exit 1; fi
    if ! migrations > "$release/migrations.after" || ! cmp -s "$release/migrations.before" "$release/migrations.after"; then
      echo "Migrations changed or cannot be verified. Apps remain stopped; no automatic DB restore. See docs/operations/vps-deploy.md." >&2
      exit 1
    fi
    if ! "${old[@]}" up -d --no-deps --pull never backend frontend; then exit 1; fi
  else
    # No new image has started. Restart the original containers unchanged.
    if ! "${old[@]}" start backend frontend; then exit 1; fi
  fi
  if wait_health backend && wait_health frontend; then
    rm .deploy-blocked
    echo 'Previous images are healthy; deployment still failed.' >&2
  fi
  exit "${rc:-1}"
}
trap recover EXIT
trap 'exit 1' HUP INT TERM
# Brief maintenance window: quiesce application writers before the dump/migrations.
"${old[@]}" stop frontend backend
phase=backup
migrations > "$release/migrations.before"
docker exec monize-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' | gzip > "$backup.partial"
[[ -s "$backup.partial" ]]
gzip -t "$backup.partial"
mv "$backup.partial" "$backup"
phase=updating
"${new[@]}" up -d --no-deps --pull never backend
wait_health backend
"${new[@]}" up -d --no-deps --pull never frontend
wait_health frontend
printf '%s\n' "$commit" > .deploy-success.tmp
mv .deploy-success.tmp .deploy-success
phase=complete
rm .deploy-blocked
echo "Deployment healthy: $commit; backup: $backup"
