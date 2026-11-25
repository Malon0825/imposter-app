#!/usr/bin/env bash
# Renders each mockup screen to PNG with headless Chrome at 390x844 CSS px, 2x density.
# Needs the "power-cards-mockups" preview server (python http.server on design/, port 8800).
# Usage: bash design/power-cards-v1/mockup/capture.sh [out_dir] [screens...]
set -euo pipefail
out="${1:-design/power-cards-v1}"
shift || true
screens=("$@")
[ ${#screens[@]} -eq 0 ] && screens=(1 2 3 4 5 6 7 8 9 10 11 12)
chrome="/c/Program Files/Google/Chrome/Application/chrome.exe"
names=(x 01-draw-window 02-draw-sealed-golden 03-discussion-hand-plays 04-hand-sheet 05-card-detail 06-confirm-play 07-golden-announcement 08-private-eye-result 09-ballot-heavy-vote-underdog 10-results-cards-replay 11-standings-bounty-underdog 12-story-of-the-night)
mkdir -p "$out"
abs="$(cd "$out" && pwd -W 2>/dev/null || pwd)"
for s in "${screens[@]}"; do
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size=390,844 --virtual-time-budget=4000 \
    --screenshot="$abs/${names[$s]}.png" "http://localhost:8800/power-cards-v1/mockup/index.html?s=$s" >/dev/null 2>&1
  echo "$abs/${names[$s]}.png"
done
