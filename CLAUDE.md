# Imposter: project rules for agents

## Start with MECHANICS.md

**[MECHANICS.md](MECHANICS.md) is the single source of truth for how the game works.** It covers the round flow, roles, ballots, scoring, Drink or Dare, reports, sessions, power cards (every card), the comeback system, round rules and the word deck. It matches the code and names the function to check for each rule.

To learn a rule, read MECHANICS.md first. Don't search through other docs. Plans, mockup folders, PLAN.md and the design briefs are history: they show why things were decided, not what the game does now.

## The code is the truth. MECHANICS.md follows it.

The Rust engine in `crates/party-core/` decides every rule. If MECHANICS.md disagrees with the code, the code wins: fix MECHANICS.md. Never design a card, role change or rule from a doc alone. Check it against MECHANICS.md and the function it names.

**Every patch that changes a game mechanic updates MECHANICS.md in the same commit.**
- Mechanics include roles, voting, scoring, bets, punishment, reports, phases and timers, power cards, round rules, topics and session settings.
- A bug fix that changes what players can do counts.
- Update the "Last checked" line at the top of MECHANICS.md when you do.

Then update whichever of these the change touches:

| If you change | Also update |
|---|---|
| A card's rules or text | [power-card-review-v11.xlsx](design/power-cards-v1/power-card-review-v11.xlsx) (Card review, Role guide, and How to play / Session rules if affected), then regenerate `cards.json` with `python -I scripts/cards-from-sheet.py`. Never hand-edit the JSON. Card copy in `src/cards/Hand.tsx` (confirm lines) and `src/cards/Results.tsx`. |
| What a role knows, picks or scores | In-app role text in `src/full-cast.tsx`, the ballot screen in `src/App.tsx`, the README "Play" role list |
| The rules players read in the app | The in-app rules list in `src/App.tsx` (search for the "Power cards" rules section), the README "Play" steps |
| Topics or words | Validate with `python scripts/prepare-content.py --check`, regenerate [TOPIC-MODES.md](TOPIC-MODES.md) with `--write-mode-report`. [TOPICS.md](TOPICS.md) holds the content policy. |
| Anything on the public site | `docs/index.html` |

**Stale history docs:** don't rewrite them. Fix their **Status** line to point at MECHANICS.md if they mislead.

## Card text

- Ability text is for a young reader: "you", short sentences, one idea each, and a question then a result ("Lose a bet of 2 or 3? Get 1 point back.").
- Use only the words in MECHANICS.md "Words players see": one name per mechanic in every screen, card and doc players read. A new mechanic gets its word added there first.
- English is column E of Card review and Filipino is column F. Filipino covers only the card text and How to play.
- When you write or change Filipino, mark its status cell for Astra to check.
- After editing, check the fit at `http://localhost:1428/card-gallery.html?lang=en&w=210` (`window.overflowing` must be `[]`), and again with `lang=fil`.

## Checks before committing a mechanic change

- `python -I scripts/cards-from-sheet.py --check`
- `node scripts/rust.mjs test -p party-core --lib`: add a test for the new behaviour
- `npx tsc --noEmit -p .`
- The browser smoke for the area you touched (see README "Verification")

## Housekeeping

- Session logs go in `.claude/session-logs/YYYY-MM-DD.md`, which git ignores through `.git/info/exclude`.
- Deploys and releases follow the user's global rule: branch, PR, merge, GitHub release, then deploy. Release only when the user asks.
