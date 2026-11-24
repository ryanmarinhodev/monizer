#!/usr/bin/env python3
"""Failure-path tests with fake Docker/GitHub; never contacts a host or daemon."""
import fcntl
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
SHA = 'a' * 40
BACKEND = 'ghcr.io/ryanmarinhodev/monize-backend@sha256:' + 'b' * 64
FRONTEND = 'ghcr.io/ryanmarinhodev/monize-frontend@sha256:' + 'c' * 64
DOCKER = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
p = Path(os.environ['FIXTURE'])
a = sys.argv[1:]
s = ' '.join(a)
with (p / 'calls').open('a') as f: f.write(s + '\n')
mode = os.environ.get('MODE', '')
new = (p / 'new').exists()
if a[0] == 'inspect':
    if '-f' not in a:
        print(json.dumps([{'Config': {'Labels': {'com.docker.compose.service': x}}, 'Mounts': []} for x in ['backend', 'frontend']]))
    elif 'config_files' in s: print(p / 'old.yml')
    elif 'compose.project' in s: print('existing-project')
    elif '.Image' in s: print('sha256:' + 'd' * 64)
    elif '.State.Health' in s:
        bad = new and ((mode in ['backend-fail', 'migration-fail'] and a[-1].endswith('backend')) or (mode == 'frontend-fail' and a[-1].endswith('frontend')))
        print('true missing' if bad or mode == 'no-health' else 'true healthy')
    else: print('true')
elif a[0] == 'exec':
    if 'pg_dump' in s:
        if mode == 'backup-fail': sys.exit(1)
        print('-- database dump')
    else:
        print('001.sql')
        if new and mode == 'migration-fail': print('002.sql')
elif a[0] == 'compose':
    if 'config' in a and '--format' in a:
        volumes = [{'type': 'bind', 'source': '/wrong', 'target': '/data'}] if mode == 'mount-change' else []
        print(json.dumps({'services': {'backend': {'volumes': volumes}, 'frontend': {}}}))
    if 'pull' in a and mode == 'pull-fail': sys.exit(1)
    if 'up' in a:
        rollback = 'previous/images.yml' in s
        if rollback:
            (p / 'new').unlink(missing_ok=True)
        else:
            (p / 'new').touch()
            if mode == 'up-fail': sys.exit(1)
'''


class DeployTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.p = Path(self.temp.name)
        (self.p / 'bin').mkdir()
        (self.p / '.env').write_text('KEEP=unchanged\n')
        (self.p / 'old.yml').write_text('services: {}\n')
        self.script = self.p / 'deploy.sh'
        source = (ROOT / 'scripts/deploy.sh').read_text()
        self.assertIn('app=/opt/apps/monizer\n', source)
        self.script.write_text(source.replace('app=/opt/apps/monizer\n', f'app="{self.p}"\n'))
        self.executable('docker', DOCKER)
        self.executable('sleep', '#!/bin/sh\nexit 0\n')
        # Same kernel flock primitive on macOS, where util-linux CLI is absent.
        self.executable('flock', '#!/usr/bin/env python3\nimport fcntl,sys\nfcntl.flock(int(sys.argv[-1]), fcntl.LOCK_EX | fcntl.LOCK_NB)\n')
        self.env = {**os.environ, 'FIXTURE': str(self.p), 'PATH': str(self.p / 'bin') + ':' + os.environ['PATH']}

    def executable(self, name, text):
        path = self.p / 'bin' / name
        path.write_text(text)
        path.chmod(0o755)

    def run_deploy(self, mode='', order='100', sha=SHA):
        return subprocess.run(['bash', str(self.script), sha, order, BACKEND, FRONTEND], env={**self.env, 'MODE': mode}, capture_output=True, text=True)

    def calls(self):
        path = self.p / 'calls'
        return path.read_text() if path.exists() else ''

    def test_success_backup_precedes_update_and_preserves_env(self):
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.calls()
        self.assertLess(calls.index('pg_dump'), calls.index('up -d'))
        self.assertLess(calls.index('stop frontend backend'), calls.index('pg_dump'))
        self.assertEqual((self.p / '.env').read_text(), 'KEEP=unchanged\n')
        self.assertEqual((self.p / '.deploy-success').read_text().strip(), SHA)
        self.assertFalse((self.p / '.deploy-blocked').exists())
        self.assertEqual(len(list((self.p / 'backups/pre-deploy').glob('*.sql.gz'))), 1)
        self.assertNotIn('down', calls)
        self.assertNotIn('up -d postgres', calls)

    def test_old_run_cannot_overwrite_newer(self):
        (self.p / '.deploy-order').write_text('101 ' + SHA)
        self.assertNotEqual(self.run_deploy().returncode, 0)
        self.assertNotIn('stop ', self.calls())

    def test_duplicate_completion_is_noop(self):
        (self.p / '.deploy-success').write_text(SHA)
        self.assertEqual(self.run_deploy().returncode, 0)
        self.assertNotIn('pull ', self.calls())

    def test_pending_recovery_blocks_next_deploy(self):
        (self.p / '.deploy-blocked').touch()
        self.assertNotEqual(self.run_deploy().returncode, 0)
        self.assertNotIn('stop ', self.calls())

    def test_actual_lock_rejects_second_process(self):
        with (self.p / '.deploy.lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertNotEqual(self.run_deploy().returncode, 0)
        self.assertNotIn('stop ', self.calls())

    def test_pull_and_mount_failures_do_not_stop_apps(self):
        for mode in ['pull-fail', 'mount-change']:
            with self.subTest(mode=mode):
                self.assertNotEqual(self.run_deploy(mode).returncode, 0)
                self.assertNotIn('stop ', self.calls())

    def test_failed_backup_restarts_original_without_new_images(self):
        self.assertNotEqual(self.run_deploy('backup-fail').returncode, 0)
        self.assertNotIn('up -d', self.calls())
        self.assertIn('start backend frontend', self.calls())
        self.assertFalse((self.p / '.deploy-blocked').exists())

    def test_first_deploy_backend_failure_rolls_back_exact_images(self):
        self.assertNotEqual(self.run_deploy('backend-fail').returncode, 0)
        self.assertIn('previous/images.yml up -d --no-deps --pull never backend frontend', self.calls())
        self.assertIn('monizer-rollback-backend:100', (self.p / 'previous/images.yml').read_text())
        self.assertFalse((self.p / '.deploy-success').exists())
        self.assertFalse((self.p / '.deploy-blocked').exists())

    def test_frontend_failure_rolls_back_both_services(self):
        self.assertNotEqual(self.run_deploy('frontend-fail').returncode, 0)
        self.assertIn('previous/images.yml up -d --no-deps --pull never backend frontend', self.calls())

    def test_compose_up_failure_also_rolls_back(self):
        self.assertNotEqual(self.run_deploy('up-fail').returncode, 0)
        self.assertIn('previous/images.yml up -d --no-deps --pull never backend frontend', self.calls())

    def test_committed_migration_blocks_automatic_image_rollback(self):
        self.assertNotEqual(self.run_deploy('migration-fail').returncode, 0)
        self.assertNotIn('previous/images.yml up -d', self.calls())
        self.assertTrue((self.p / '.deploy-blocked').exists())
        self.assertNotIn('psql -f', self.calls())

    def test_missing_healthcheck_is_failure(self):
        self.assertNotEqual(self.run_deploy('no-health').returncode, 0)
        self.assertTrue((self.p / '.deploy-blocked').exists())

    def test_invalid_commit_cannot_reach_docker(self):
        self.assertNotEqual(self.run_deploy(sha='main; touch bad').returncode, 0)
        self.assertEqual(self.calls(), '')

    def test_gate_requires_both_workflows_and_current_commit(self):
        self.executable('git', '#!/bin/sh\nprintf "%s\\n" "$TEST_SHA"\n')
        self.executable('gh', '''#!/usr/bin/env python3
import os,sys
s = ' '.join(sys.argv)
if 'commits/main' in s: print(os.environ['MAIN_SHA'])
elif 'ci.yml' in s: print(os.environ['CI_RESULT'] + '\\t100')
else: print(os.environ['BUILD_RESULT'] + '\\t101')
''')
        for ci, build, main, ready in [('success', 'success', SHA, True), ('failure', 'success', SHA, False), ('success', 'pending', SHA, False), ('success', 'success', 'e'*40, False)]:
            with self.subTest(ci=ci, build=build, main=main):
                out = self.p / 'output'
                out.write_text('')
                env = {**self.env, 'TEST_SHA': SHA, 'MAIN_SHA': main, 'CI_RESULT': ci, 'BUILD_RESULT': build, 'REPOSITORY': 'ryanmarinhodev/monizer', 'GITHUB_OUTPUT': str(out)}
                result = subprocess.run(['bash', str(ROOT / 'scripts/deploy-gate.sh')], env=env, capture_output=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual('ready=true' in out.read_text(), ready)


if __name__ == '__main__':
    unittest.main()
