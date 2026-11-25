"""Turn the design PNGs into the WebP art the app ships.

Sources stay in design/*/art (full-size PNGs from the artist). The app gets
WebP at twice the size each piece is shown on a phone, so browser guests,
who load everything from the host over Wi-Fi, download a few MB, not ~90.

    python scripts/prepare-art.py           # write what's missing or stale
    python scripts/prepare-art.py --check   # fail if anything is missing, orphaned or over budget
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CARD_SRC = ROOT / "design/power-cards-v1/art"
APP_SRC = ROOT / "design/app-revamp-v1/art"
CARD_OUT = ROOT / "public/art/cards"
APP_OUT = ROOT / "public/art/app"
QUALITY = 82
# All shipped art together must stay under this.
BUDGET = 6 * 1024 * 1024

# Cards: full size is shown about 300px wide, the hand size about 104px.
CARD_SIZES = {"": 600, "-sm": 208}
# App art: target width per brief slot (A1-A12), twice its on-screen width.
APP_WIDTH = {
    "a1": 800, "a2": 720, "a3": 720, "a4": 720, "a12": 720,
    "a5": 640, "a7": 560, "a11": 480, "a8": 400, "a9": 400, "a10": 400,
    "a6": 256,
}
# The app icon (A13) goes through Tauri's icon generator, not public/.
SKIP = {"a13-app-icon.png"}


def card_jobs() -> list[tuple[Path, Path, int]]:
    """Cards are named by id; a card that moved tiers keeps only its newest art."""
    rank = {"common": 0, "rare": 1, "golden": 2}
    best: dict[str, Path] = {}
    for src in sorted(CARD_SRC.glob("*.png")):
        if src.name == "card-back.png":
            card_id, tier = "card-back", "back"
        else:
            tier, _, card_id = src.stem.partition("-")
        if card_id in best:
            old_tier = best[card_id].stem.partition("-")[0]
            # Sealed Alibi and Pocket Veto moved from Common to Rare in v11.
            if rank.get(tier, -1) < rank.get(old_tier, -1):
                continue
        best[card_id] = src
    return [
        (src, CARD_OUT / f"{card_id}{suffix}.webp", width)
        for card_id, src in sorted(best.items())
        for suffix, width in CARD_SIZES.items()
    ]


def app_jobs() -> list[tuple[Path, Path, int]]:
    jobs = []
    for src in sorted(APP_SRC.glob("*.png")):
        if src.name in SKIP:
            continue
        slot = src.stem.split("-")[0]
        if slot not in APP_WIDTH:
            sys.exit(f"No target width for {src.name}: add its slot to APP_WIDTH.")
        jobs.append((src, APP_OUT / f"{src.stem}.webp", APP_WIDTH[slot]))
    return jobs


def stale(src: Path, out: Path) -> bool:
    return not out.exists() or out.stat().st_mtime < src.stat().st_mtime


def convert(src: Path, out: Path, width: int) -> None:
    with Image.open(src) as im:
        im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
        if im.width > width:
            height = round(im.height * width / im.width)
            im = im.resize((width, height), Image.LANCZOS)
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out, "WEBP", quality=QUALITY, method=6)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    jobs = card_jobs() + app_jobs()
    wanted = {out for _, out, _ in jobs}
    todo = [job for job in jobs if stale(job[0], job[1])]
    extra = [p for d in (CARD_OUT, APP_OUT) if d.exists() for p in d.glob("*.webp") if p not in wanted]
    if args.check:
        # Only missing files count here: after a clone, file times say nothing
        # about which side is newer.
        problems = [f"missing: {out.relative_to(ROOT)}" for _, out, _ in jobs if not out.exists()]
        problems += [f"not from any source: {p.relative_to(ROOT)}" for p in extra]
    else:
        for src, out, width in todo:
            convert(src, out, width)
        for p in extra:
            p.unlink()
        problems = []
    total = sum(out.stat().st_size for out in wanted if out.exists())
    if total > BUDGET:
        problems.append(f"art is {total / 1e6:.1f} MB, over the {BUDGET / 1e6:.1f} MB budget")
    cards = sum(1 for _, out, _ in jobs if out.parent == CARD_OUT and not out.stem.endswith("-sm"))
    print(f"{len(jobs)} files ({cards} cards incl. the back, {len(jobs) - 2 * cards} app pieces), "
          f"{len(todo) if not args.check else 0} written, {total / 1e6:.2f} MB total")
    for problem in problems:
        print("  ", problem)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
