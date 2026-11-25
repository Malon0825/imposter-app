# Imposter: project rules for agents

## The code is the truth. Keep the docs matching it.

The Rust engine in `crates/party-core/` decides every game rule. When a doc disagrees with the code, the code wins: fix the doc. Never design a card, role change or rule from a doc alone. Check the code it points to first.

**Every patch that changes a game mechanic updates its docs in the same commit.** Mechanics include roles, voting, scoring, bets, punishment, phases and timers, power cards, round rules, topics and session settings. Before you commit, go through the table below for each area you touched. Update every doc and in-app text it lists, or say in the commit message why it didn't change. A bug fix that changes what players can do counts as a mechanic change.

## Where each mechanic lives

| Area | Code (truth) | Docs and player-facing text to keep in step |
|---|---|---|
| Roles: deal, ballots, vote weight, scoring | `party-core/src/cast.rs` (`specials`, `award`), `game.rs` (`cast_picks`, the `vote` action, vote resolution) | [ROLE-MECHANICS.md](design/power-cards-v1/ROLE-MECHANICS.md) · README "Play" (step 6 and the role list) · [PLAN.md](PLAN.md) §13 · in-app role text `src/full-cast.tsx` · ballot screen in `src/App.tsx` |
| Power cards: rules and text | [power-card-review-v11.xlsx](design/power-cards-v1/power-card-review-v11.xlsx), sheets Card review and Role guide. `scripts/cards-from-sheet.py` generates `crates/party-core/content/cards.json` from it. Never hand-edit the JSON. | The same xlsx: How to play, Session rules, What changed in v11 · ROLE-MECHANICS.md · README "Power cards" · in-app rules ("Power cards" in `src/App.tsx`) · card copy in `src/cards/Hand.tsx` (confirm lines) and `src/cards/Results.tsx` |
| Power cards: engine | `party-core/src/cards.rs` (catalog, deck, odds, `Weights`, `tally`, `settle`), `power.rs` (plays, views), `game.rs` (`draw`, `last_word` phases) | xlsx Session rules and System design (6+) · ROLE-MECHANICS.md |
| Round flow and phases | `game.rs` | README "Play" · [design/ROUND-FLOW-IMPLEMENTATION-PLAN.md](design/ROUND-FLOW-IMPLEMENTATION-PLAN.md) |
| Score sessions, bets, Drink or Dare, reports | `game.rs`, `cast.rs` | README "Play" and "Score sessions and confidence bets" · PLAN.md §12–13 · [design/session-scoring-v1/IMPLEMENTATION.md](design/session-scoring-v1/IMPLEMENTATION.md) |
| Random round rules and the word deck | `game.rs` (`rule_weights`, `record_rule`), `selection.rs` and `history.rs` (word deck) | README "Random round rules" · [design/random-round-rules-v1/IMPLEMENTATION.md](design/random-round-rules-v1/IMPLEMENTATION.md) |
| Topics and words | `crates/party-core/content/*.json`. Validate with `python scripts/prepare-content.py --check`. | [TOPICS.md](TOPICS.md) · [TOPIC-MODES.md](TOPIC-MODES.md): regenerate it with `--write-mode-report`, never edit it by hand |
| Public website | none | `docs/index.html` (the player-facing tour), when a change shows up there |

Plans and mockup folders (`design/*/IMPLEMENTATION-PLAN.md`, `design/*-v1/README.md`, `PLAN.md` §1–11, `REFERENCE-FLOW.md`) are history. Don't rewrite them to match new code. When one goes stale, update its **Status** line to say what was built, what changed since, and which doc is now current.

## Rules agents got wrong before

Read [ROLE-MECHANICS.md](design/power-cards-v1/ROLE-MECHANICS.md) before touching cards. Three of the biggest traps:

- **Power cards only run at 6+ players** (`cards::MIN_PLAYERS`). At a card table every role is dealt, the Judge always counts twice, and the Decoy holds a related word. Small-party exceptions never apply to cards.
- **The Imposter's ballot has no suspect.** From five players it names their Accomplice pick (sent as `player_id`) and their Decoy pick, and it never counts. Any card that boosts, locks or hedges "your vote" must say what happens for the Imposter. Usually the answer is Can't.
- **The draw has no timer.** A player who is done goes on to their role, and anyone still drawing follows.

## Card text

- Ability text is for a young reader: "you", short sentences, one idea each, and a question then a result ("Lose a bet of 2 or 3? Get 1 point back.").
- English is column E of Card review and Filipino is column F. Filipino covers only the card text and the How to play sheet.
- When you write or change Filipino, mark its status cell for Astra to check.
- After editing the xlsx, run `python -I scripts/cards-from-sheet.py`. Then check the fit at `http://localhost:1428/card-gallery.html?lang=en&w=210` (`window.overflowing` must be `[]`), and again with `lang=fil`.

## Checks before committing a mechanic change

- `python -I scripts/cards-from-sheet.py --check`
- `node scripts/rust.mjs test -p party-core --lib`: add a test for the new behaviour
- `npx tsc --noEmit -p .`
- The browser smoke for the area you touched (see README "Verification")

## Housekeeping

- Session logs go in `.claude/session-logs/YYYY-MM-DD.md`, which git ignores through `.git/info/exclude`.
- Deploys and releases follow the user's global rule: branch, PR, merge, GitHub release, then deploy. Release only when the user asks.
