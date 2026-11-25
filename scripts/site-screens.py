"""Turn the capture scripts' PNGs into the website's screens (docs/screens/*.webp).

Run after the three captures (see docs/README.md, "Screenshots"):
    scripts/site-capture.js   -> output/playwright/site/<site name>.png
    scripts/cards-capture.js  -> output/playwright/cards-390/<nn>-<screen>.png
    scripts/visual-capture.js -> output/playwright/visual-site/<nn>-<screen>.png
                                 (open it at /?capture=site&width=390&height=844)

    python -I scripts/site-screens.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/screens"
PW = ROOT / "output/playwright"
SIZE = (390, 844)

# docs/screens name -> captured PNG
SOURCES = {
    **{name: PW / "site" / f"{name}.png" for name in [
        "01-welcome", "cast-lobby", "rule-shuffle", "rule-revealed", "round-topic-vote", "round-concealed",
        "cast-imposter", "cast-accomplice", "cast-decoy", "cast-detective", "cast-judge", "cast-gambler",
        "round-imposter-card", "round-detective-card", "round-clue-board", "round-settings", "round-ballot",
        "round-your-result", "round-the-room", "turn-loser", "turn-dare-giver", "turn-standings",
    ]},
    **{name: PW / "visual-site" / f"{name}.png" for name in [
        "02-create", "03-host-setup", "05-scan", "06-wifi", "07-identity", "08-guest-lobby", "17-choose", "22-reconnecting",
    ]},
    "cards-draw": PW / "cards-390/02-draw-offer.png",
    "cards-drawn": PW / "cards-390/05-revealed.png",
    "cards-hand": PW / "cards-390/07-hand-sheet.png",
    "cards-detail": PW / "cards-390/08-card-detail.png",
    "cards-xray": PW / "cards-390/12-private-read.png",
    "cards-story": PW / "cards-390/22-story.png",
}


def main() -> int:
    missing = [str(p.relative_to(ROOT)) for p in SOURCES.values() if not p.exists()]
    if missing:
        print("Missing captures:\n  " + "\n  ".join(missing))
        return 1
    for name, src in SOURCES.items():
        with Image.open(src) as im:
            im = im.convert("RGB").crop((0, 0, *SIZE))
            im.save(OUT / f"{name}.webp", "WEBP", quality=82, method=6)
    total = sum((OUT / f"{n}.webp").stat().st_size for n in SOURCES)
    print(f"wrote {len(SOURCES)} screens, {total / 1e6:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
