#!/usr/bin/env python3
"""Capture active services and verify their automatic startup after host reboot."""
import argparse
import datetime
import json
import pathlib
import subprocess
import time

STATE = pathlib.Path('/var/lib/wbglabs-maintenance')
BASELINE = STATE / 'containers-before-reboot.json'

def docker_state(name):
    result = subprocess.run(
        ['docker', 'inspect', '--format',
         '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.HostConfig.RestartPolicy.Name}}', name],
        capture_output=True, text=True, timeout=15, check=False,
    )
    if result.returncode:
        return {'name': name, 'state': 'missing', 'health': 'unknown', 'restart': 'unknown'}
    state, health, restart = result.stdout.strip().split('|')
    return {'name': name, 'state': state, 'health': health, 'restart': restart}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--snapshot', action='store_true')
    parser.add_argument('--timeout', type=int, default=300)
    args = parser.parse_args()
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    boot_id = pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    if args.snapshot:
        names = subprocess.check_output(['docker', 'ps', '--format', '{{.Names}}'], text=True).splitlines()
        names = sorted(name for name in names if name != 'wbglabs-maintenance-helper')
        services = [docker_state(name) for name in names]
        if not services or any(s['restart'] not in ('always', 'unless-stopped') for s in services):
            raise SystemExit('Every active service must have an automatic restart policy before maintenance.')
        BASELINE.write_text(json.dumps({'at': now(), 'bootId': boot_id, 'containers': services}, indent=2) + '\n')
        print(json.dumps({'captured': len(services), 'containers': names}))
        return
    if not BASELINE.exists():
        raise SystemExit('No pre-reboot container snapshot is available.')
    baseline = json.loads(BASELINE.read_text())
    deadline = time.monotonic() + args.timeout
    while True:
        services = [docker_state(s['name']) for s in baseline['containers']]
        healthy = all(s['state'] == 'running' and s['health'] in ('none', 'healthy') and
                      s['restart'] in ('always', 'unless-stopped') for s in services)
        if healthy or time.monotonic() >= deadline:
            break
        time.sleep(5)
    public = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '20',
                             'https://fight-club.wbglabs.io/api/health'], capture_output=True, timeout=25)
    report = {'at': now(), 'bootId': boot_id, 'rebootConfirmed': boot_id != baseline['bootId'],
              'allContainersHealthy': healthy, 'publicHealth': public.returncode == 0, 'containers': services}
    (STATE / 'last-boot-check.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
    if not healthy or public.returncode:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
