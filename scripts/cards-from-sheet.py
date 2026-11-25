"""Build crates/party-core/content/cards.json from the power card rules workbook.

    python scripts/cards-from-sheet.py            # write the catalog
    python scripts/cards-from-sheet.py --check    # fail if the catalog is out of date

The workbook (design/power-cards-v1/power-card-review-v11.xlsx) is the source
of truth for card text, play windows, targets, who can't play, ratings and
tips. The Rust engine and the UI both read the generated JSON.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "design/power-cards-v1/power-card-review-v11.xlsx"
OUT = ROOT / "crates/party-core/content/cards.json"
ROLES = ["Imposter", "Accomplice", "Detective", "Judge", "Decoy", "Gambler"]
RATING = {"Best": "best", "Fine": "fine", "Worst": "worst", "Can't": "cant"}


def card_id(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def windows(text: str, kind: str) -> list[str]:
    if kind == "passive":
        return ["session_end"] if text.startswith("Session end") else ["results"]
    found = []
    for label, key in (("Role reveal", "role_reveal"), ("Discussion", "discussion"), ("Ballot", "ballot")):
        if label in text:
            found.append(key)
    if not found:
        sys.exit(f"Unknown play window: {text!r}")
    return found


def target(text: str) -> str:
    if text in ("—", "", None):
        return "none"
    if text.startswith("2 players"):
        return "two_players"
    if "played a card" in text:
        return "played_card"
    if text == "You":
        return "none"
    if text.startswith("1 player"):
        return "player"
    sys.exit(f"Unknown target: {text!r}")


def role_notes(text: str) -> dict[str, str]:
    """'Judge: your vote counts 3. Accomplice: pile onto an innocent.' -> {judge: ..., accomplice: ...}"""
    if not text:
        return {}
    pattern = re.compile(r"(" + "|".join(ROLES) + r"): ")
    parts = pattern.split(text)
    notes = {}
    for i in range(1, len(parts), 2):
        notes[parts[i].lower()] = parts[i + 1].strip()
    return notes


def build() -> dict:
    wb = openpyxl.load_workbook(SHEET, data_only=True)
    review, guide = wb["Card review"], wb["Role guide"]
    guide_rows = {}
    for row in guide.iter_rows(min_row=5, values_only=True):
        name = row[0]
        if name and row[2] in RATING:
            guide_rows[name] = row
    cards = []
    for row in review.iter_rows(min_row=5, values_only=True):
        name, tier, typ, window, en, fil, tgt, _clash, cant, _how, _change, _status = row[:12]
        if not name:
            continue
        kind = "passive" if "Passive" in typ else "active"
        cant = cant or "—"
        entry = {
            "id": card_id(name),
            "name": name,
            "tier": tier.lower(),
            "kind": kind,
            "windows": windows(window, kind),
            "target": target(tgt),
            "cant_play": [r.lower() for r in ROLES if r in cant],
            "leader_cant_play": "lead" in cant,
            "needs_bet": "betting 0" in cant,
            "hidden_for_last_voter": "last player" in cant,
            "text": {"en": en, "fil": fil},
        }
        g = guide_rows.get(name)
        if kind == "active":
            if not g:
                sys.exit(f"{name} has no Role guide row")
            entry["ratings"] = {r.lower(): RATING[g[2 + i]] for i, r in enumerate(ROLES)}
            entry["when"] = g[8]
            entry["notes"] = role_notes(g[9])
        cards.append(entry)
    return {"source": SHEET.name, "cards": cards}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    text = json.dumps(build(), ensure_ascii=False, indent=2) + "\n"
    if args.check:
        # Compare text, not bytes: Git may check the file out with CRLF.
        current = OUT.read_text(encoding="utf-8").replace(chr(13) + chr(10), chr(10)) if OUT.exists() else ""
        if current != text:
            print(f"{OUT.relative_to(ROOT)} is out of date: run scripts/cards-from-sheet.py")
            return 1
        print("cards.json is up to date")
        return 0
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(json.loads(text)['cards'])} cards")
    return 0


if __name__ == "__main__":
    sys.exit(main())
