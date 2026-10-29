#!/bin/sh
# Dedicated localhost clock kiosk; never reuse a signed-in browser profile.
umask 077
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
systemctl --user start screen-clock.service
printf '%s\n' "$$" > "$HOME/.local/share/screen-clock/browser.pid"
exec /usr/bin/chromium --disable-gpu --password-store=basic --ozone-platform=wayland --user-data-dir="$HOME/.local/share/screen-clock/kiosk-profile" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --autoplay-policy=no-user-gesture-required --kiosk http://127.0.0.1:8765/
