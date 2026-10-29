#!/usr/bin/env python3
"""Update the local clock's desktop action after moving its kiosk profile."""
from pathlib import Path

path = Path.home() / '.local/share/screen-clock/server.py'
source = path.read_text()
old = "if '--kiosk' in args and any('screen-clock/browser-profile' in arg for arg in args):"
new = "if '--kiosk' in args and any(arg in {f'--user-data-dir={Path.home()}/.local/share/screen-clock/browser-profile', f'--user-data-dir={Path.home()}/.local/share/screen-clock/kiosk-profile'} for arg in args):"
if old not in source and new not in source:
    raise SystemExit('Unexpected clock process lookup; no changes made.')
source = source.replace(old, new)
source = source.replace('            pid = clock_pid()\n            self.send(200,', '            pid = clock_pid()\n            if pid is None:\n                raise ValueError("Clock browser not found")\n            self.send(200,')
compile(source, str(path), 'exec')
backup = path.with_name('server.py.before-desktop-fix-20261029')
if not backup.exists():
    backup.write_bytes(path.read_bytes())
    backup.chmod(0o600)
path.write_text(source)
print('Updated clock desktop action; restart screen-clock.service to apply.')
