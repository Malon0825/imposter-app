#!/usr/bin/env bash
# Renders every screen of the app revamp to PNG (390x844 CSS px, 2x) with headless Chrome.
# Needs the "power-cards-mockups" preview server (python http.server on design/, port 8800).
# Usage: bash design/app-revamp-v1/mockup/capture.sh [out_dir] [keys...]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="${1:-$here/..}"
shift || true
chrome="/c/Program Files/Google/Chrome/Application/chrome.exe"
# screen keys in play order, read from app.js (add(act, "key", …) and pc(act, "key", …))
mapfile -t keys < <(grep -oE '^(add|pc)\([0-9]+, "[^"]+"' "$here/app.js" | sed -E 's/.*"([^"]+)"/\1/')
want=("$@")
mkdir -p "$out"
abs="$(cd "$out" && pwd -W 2>/dev/null || pwd)"
n=0
for k in "${keys[@]}"; do
  n=$((n + 1))
  if [ ${#want[@]} -gt 0 ] && [[ ! " ${want[*]} " =~ " $k " ]]; then continue; fi
  f="$(printf '%02d' "$n")-$k.png"
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size=390,844 --virtual-time-budget=4000 \
    --screenshot="$abs/$f" "http://localhost:8800/app-revamp-v1/mockup/index.html?s=$k" >/dev/null 2>&1
  echo "$f"
done
