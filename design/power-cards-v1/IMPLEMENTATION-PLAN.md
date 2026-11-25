# Imposter 1.3: noir revamp + power cards + sound — implementation plan

Status: plan, 2026-11-25; M0–M6 built on branch `claude/power-cards` (M7 release not done). Kept as the build record, not the current rules.

Built since (M0–M6, 2026-11-25), with these changes: the draw has **no timer** (a player who is done goes on to their role and anyone still drawing follows; the host can deal past someone who wandered off), and the rules moved on from this brief. Current rules: [power-card-review-v11.xlsx](power-card-review-v11.xlsx) → `crates/party-core/content/cards.json`, and [MECHANICS.md](../../MECHANICS.md) for how every role, card and rule works in code. Where this file disagrees with them or the code, they win.

**One release, three parts:**
1. **The noir case-file theme** across all 41 screens (`design/app-revamp-v1`).
2. **Power cards**, 6+ players (`design/power-cards-v1` and `Power Card Review v11.xlsx`).
3. **Sound** (`design/sound-v1`).

All three are approved. The v11 sheet is the source of truth for rules. Where a mockup still shows the v10 deck, v11 wins (README §10).

## 1. What "done" looks like

- **Every party:** a 3–12 player party plays the current Full Cast round in the new theme, with sound. The flow, rules and scoring outside power cards are unchanged.
- **With power cards on (6+ players):**
  - every round gets a 10-second draw window before roles;
  - players hold a private hand and play one active card per round;
  - every phone sees the public plays and clash stamps;
  - results replay the round's cards;
  - the session ends with the Story of the night.
- **Under 6 players:** cards pause and everyone keeps their hand (v11 Session rules 14).
- **Privacy:** a phone never receives another player's hand, Golden chance or private read. The only exception is at results, when every play is revealed.
- **Tests:** `npm test` passes, and so do the new and updated smoke scripts (§7).
- **Release:** an Android APK 1.3.0 on gameplay version `power-cards-v1`, released through the GitHub flow (§9).

## 2. Before writing code (M0)

| # | Step | Why |
|---|---|---|
| 0.1 | Bring the branch up to date with `origin/main`: merge or rebase onto 1.2.1 and the website commits. Drop the stale uncommitted `docs/` copy, which main already replaced. | The branch is behind main |
| 0.2 | Commit `design/app-revamp-v1`, `design/power-cards-v1`, `design/sound-v1` and `Power Card Review v11.xlsx` (or a CSV export of its Card review sheet) to the branch | They're untracked today |
| 0.3 | WebP pipeline: `scripts/prepare-art.mjs` turns `design/*/art/*.png` into WebP at the sizes actually shown (cards 2× of 300px and 104px; app art 2× its slot). Output goes to `public/art/cards/` and `public/art/app/` | About 94 MB of PNG today; browser guests load everything from the host over Wi-Fi. Target: under 6 MB of art in `dist` |
| 0.4 | Add `@fontsource/special-elite` | Typewriter labels, stamps, the newspaper |
| 0.5 | **Filipino (decided):** only each card's ability text is translated. A per-phone **Card text: English / Filipino** switch in My Cards changes the effect line on card faces, card detail and the confirm sheet. Card names, game words and the rest of the app, How to play included, stay English | Everyone reads English; a drunk player reads their mother tongue faster |

Astra has delivered all five Rare illustrations. The Filipino review (`FILIPINO-REVIEW-V11.md`) is in progress and gets folded into `cards.json` in M6.

## 3. Card catalog: one source

`crates/party-core/content/cards.json` holds all 37 cards. Each card has:
- `id`, `tier`, `kind` (active or passive), `window` and `targets`;
- `cant_play`, the roles that can't play it, plus flags for "leader can't play" and "needs a bet";
- `en` and `fil` text;
- per-role `ratings`, plus `when` and per-role `notes` (the v11 Role guide).

Rust loads it with `include_str!`, and the UI imports the same file through Vite. A unit test checks the catalog's shape:
- 15/12/10 cards per tier;
- unique ids;
- every active card has six ratings;
- a "Can't" rating appears exactly for the roles listed in `cant_play`.

Generate the JSON once from the v11 workbook with a small script, `scripts/cards-from-sheet.py`. Rerun it after Astra's Filipino fixes are applied to the sheet.

## 4. Core: `party-core`

### 4.1 New pure module `cards.rs` (plus `cards_tests.rs`)

It follows `cast.rs`: no I/O, everything testable without driving a round.

- **The deck:**
  - a FIFO line each for Common and Rare, shuffled at session start;
  - `draw(tier, hand) -> card` skips cards the drawer already holds, and a skipped card stays at the front;
  - if no card fits, the roll moves to the other non-Golden tier;
  - returns go to the back of the line;
  - Goldens are a unique pool; once it's empty, a Golden roll becomes Rare.
- **Odds:**
  - the tier roll is 65/25/10, and any extra Golden chance comes out of the Common share;
  - Golden chance is 10% base, +2% per non-Golden draw and +1% per round started as leader, capped at 20%;
  - it resets to 10% after a Golden draw and at a new session;
  - the Bluff Card's fake tier is rolled at 65/25/10.
- **Comeback:**
  - `underdogs(scores, target, round)` from round 3: a player is an Underdog when they trail the leader by at least ceil(target ÷ 3);
  - `leaders()` returns everyone tied for the top score;
  - the Bounty runs from +1 to +3: it resets after it pays or when the lead changes, and a Golden Pardon counts as not losing.
- **Clashes:** `clash(a, b)` follows the v11 Clash rules sheet. The higher tier wins; at the same tier, the first one played wins.
  - It returns the verdict: `Blocked`, `Sustained`, `Overruled`, `Vetoed` or `Pierced`.
  - Every row of the Clash rules sheet gets a test.
- **Settlement:** `settle(facts, awards, plays, ...) -> Vec<CardLine>`, applied in the order of v11 Session rules 11:
  1. the Last Word answer;
  2. the vote count;
  3. role scoring and bets (`cast::award`, unchanged);
  4. card awards;
  5. passives (the oldest eligible one, and only if the player played no active card);
  6. the Bounty, Robin Hood, Crown Heist, then Shadow last;
  7. the Drink/Dare queue and the session target.

  Each line is shown in the results: card id, owner, points, and a short outcome key.

### 4.2 Game state (`game.rs`)

| Lives on | New fields |
|---|---|
| `Game` (the session) | `cards_on` (setting), `hands: BTreeMap<id, Vec<Held>>` (in draw order), `golden_chance`, `paid_draws`, `lines` (FIFO lines plus the Golden pool), `bounty`, `rain_check: HashSet<id>`, `lead_rounds` |
| `Round` | `draws` (who drew: public), `plays: Vec<Play>` (seq, owner, card, shown tier, target, choice, verdict, `announced_at`), `stamps: Vec<Stamp>` (public verdicts), `vetoed`, `lawyered`, `wiretaps`, `owed_clues`, `pending_tip`, `claims`, `on_record`, `predictions`, `backups`, `cold_feet_open`, `turncoats`, `last_word: Option<{options, answer, deadline}>`, `card_lines` |

`Held` stores a card id and the round it was drawn. Reshuffle's new card is blocked until that round ends. The cards ride on the existing revisioned state, so they reach phones by the existing 600ms poll, and `processed` dedupe already makes double taps safe.

### 4.3 Phases

```
topic_chosen → draw (new, 10 s) → roles → discussion → voting → [last_word (new)] → result_reveal → results → …
```

- **`draw`:**
  - Only when `cards_on` is set and the roster has at least 6 players; otherwise the host loop goes straight to `begin_round` as today.
  - The deadline is `reveal_at + 10 s`, advanced in `advance_reveals`. The host loop starts `begin_round` when every player has drawn or skipped, or when the deadline passes.
  - In round 1 (all scores 0), the screen shows Skip only.
- **`last_word`:**
  - Entered from `resolve` when the accused is the Imposter, the Imposter holds Last Word, and they played no active card this round.
  - The deadline is 20 s, and a timeout counts as a wrong answer.
  - The three options are the real word, the Decoy word and one more word from the same hint group. Store the candidate's spare `decoys` at deal time.
  - Every other phone stays on the breathing envelope.
- **Below 6 players:** the round skips `draw`. Play actions return "Cards are paused (needs 6 players)", and passives don't fire. All card state is kept.

### 4.4 Actions

| Action | Phase | Notes |
|---|---|---|
| `power_cards` (host) | lobby, between rounds | Toggle. Takes effect at the next round, like random rules |
| `draw` / `skip_draw` | draw | Charges 3 points, or Free for an Underdog; counts paid draws; one per round |
| `play_card {card, target?, choice?}` | roles, discussion | Window, role, target and one-per-round checks; applies the clash and announces |
| `vote` (extended) | voting | Optional `card {id, target?, backup?}` and the Underdog stake rule. The card is validated with the vote and announced when the vote locks |
| `change_bet` | voting | Cold Feet only, once, while `original.len() < roster.len()`. Hidden for the last voter |
| `clue_given {player}` (host) | discussion | Clears a Put on the Spot debt under spoken or acted rules |
| `open_vote` (changed) | discussion | Publishes the pending Anonymous Tip. With a clue still owed it needs `{confirm: true}`; the UI asks "Sam still owes a clue. Open anyway?" |
| `last_word {word}` | last_word | Imposter only |

The host computes `playable` and `reason` for each card in the owner's view, using the same function `play_card` validates with. That keeps the Can't-play rule, hidden targets and the "Cold Feet hidden for the last voter" rule consistent between screen and server.

### 4.5 What each phone sees

- **Everyone:**
  - who drew this round;
  - the plays strip (owner plus the shown tier);
  - the stamps;
  - public effects: the order change, the tip after Open vote, claims, an On the Record vote, the owed clue, the Spotlight side;
  - the Bounty value and the Underdog tags;
  - each player's hand count.
- **The owner only:**
  - their hand, with playable states, role badges and their Golden chance;
  - private read results (Private Eye, X-Ray, Master Key, Borrowed Hint, Word Count, Wiretap);
  - the Last Word sheet.
- **At results:**
  - the full play log, with card names, owners, verdicts and outcomes;
  - the card award lines in each breakdown.

Extend `secret_views_never_include_other_roles_or_word` to hands, private reads and the Golden chance.

### 4.6 Gameplay version

Bump the gameplay version from `full-cast-v2` to `power-cards-v1` in two places:
- `GAMEPLAY_VERSION` in `crates/party-core/src/network.rs`;
- the `X-Imposter-Gameplay` header in `src/api.ts`.

The existing check then asks a 1.2.x phone to update instead of joining. Browser guests load the UI from the host, so they're unaffected. Every Android phone has to install 1.3.0. The web `protocol: 2` field in `network/web.rs` can stay.

## 5. Front end

`App.tsx` is 4,607 lines. New work goes into new files, and `App.tsx` only routes to them.

| Path | Contents |
|---|---|
| `src/theme/` | Case-file pieces ported from the revamp mockups (`mockup/app.css`, `app.js`): typewriter label, stamp (with the slam motion), kraft panel, evidence tag, mugshot frame and height chart, Wanted poster, newspaper. Tokens go into `style.css` on top of DESIGN.md |
| `src/cards/Card.tsx` | One card in 3 sizes (full, hand, chip) and 4 states (playable, not now, blocked, spent), with tier frames in CSS and the Golden sheen |
| `src/cards/DrawWindow.tsx` | The ring timer, price or Free badge, Golden chance and table strip. The two-tap sealed draw, ported from `mockup.js` |
| `src/cards/Hand.tsx` | Header hand button, the playable nudge, the case-file sheet, card detail with the role line and six-role strip, the target picker (reusing the ballot rows), the confirm sheet |
| `src/cards/Announce.tsx` | Common/Rare banner, Golden takeover, plays strip, clash stamps (BLOCKED, OBJECTION! → SUSTAINED/OVERRULED, VETOED). Triggered by new `seq` values in the view |
| `src/cards/Private.tsx` | The CLASSIFIED read panels, using the existing concealment (`data-private-concealed`) and the scoped `FLAG_SECURE` used for a face-up role card |
| `src/cards/Ballot.tsx` | The "Play a card" slot on the ballot, Underdog stake, the backup and veto chip rows, the Cold Feet control on the locked envelope |
| `src/cards/Results.tsx` | Last Word choice sheet, card lines in Your result, the Cards this round replay, the Bounty PAID stamp |
| `src/cards/Story.tsx` | Standings additions and *The Imposter Times* Story of the night |
| `src/sound.ts` | Port of `design/sound-v1/sound.js` with its privacy rules (no sound on your own draw or private reads). Shared sounds are host-scheduled like the results beats, and a phone more than about 300 ms late skips the sound. Mute lives in the existing settings |

**The theme on existing screens.** Map each revamp screen (01–41) to its current phase branch in `App.tsx`. Restyle in place; don't restructure the flow. Art slots read from `public/art/app/`.

**Motion.** Everything uses `src/motion.ts` and `motion-ui.tsx` tokens, and every effect has a reduced-motion version (power-cards README §6).

## 6. Milestones

Build in this order, and finish each one's checks before starting the next. The release (M7) ships them together.

| M | Scope | Done when |
|---|---|---|
| M0 | §2 prep | The branch is up to date with main, designs are committed, WebP art is in `public/`, the font is installed |
| M1 | Theme on all existing screens (no cards) and sound | Visual capture of the current flow matches the revamp PNGs; the existing smokes still pass |
| M2 | `cards.rs` and the catalog | Unit tests for all 37 cards, each Clash rules row, FIFO, odds, Underdog/Bounty and the settlement order. The Full Cast scoring fuzz is extended with random card plays: no panics, scores never below 0, a card award never pays a voided gain twice |
| M3 | Game integration: phases, actions, views, gameplay version bump | Rust round tests for draw → play → vote → last_word → results, the privacy test, and reconnect mid-draw (same hand, same deadline) |
| M4 | Card UI: draw, hand, detail, confirm, private panels, ballot slot | New `scripts/power-cards-smoke.js` plays 6 phones through 3 rounds with each window type |
| M5 | Announcements, stamps, results replay, standings, Story | Captures of every v11 stamp; a smoke covering Objection vs a Golden-looking Bluff (SUSTAINED) and Pocket Veto vs Golden Ballot (OVERRULED) |
| M6 | Content polish: Astra's Filipino fixes into `cards.json`, the Card text switch | The catalog test passes, and Filipino card faces fit two lines at 360px |
| M7 | Release 1.3.0 | §9 |

## 7. Verification

- **Rust:** `npm run test:core` covers `cards_tests.rs`, the extended `cast_tests.rs` and `scoring_tests.rs`, and new round tests in `game.rs`.
- **Smokes:**
  - new `power-cards-smoke.js`;
  - update `full-cast-smoke.js`, `session-scoring-smoke.js` and `reconnect-smoke.js` for the draw phase and the new gameplay version;
  - `web-guest-smoke.js` checks that a browser guest gets WebP art and stays under the size budget.
- **Visual:**
  - extend `visual-capture.js` to the 41 revamp screens plus the v11 stamps, at 360×700 and 390×844;
  - `motion-check.js` covers the draw, the takeover, the stamps and the replay, plus reduced motion and concealment on backgrounding.
- **On a phone:** one real Android round with 6 phones (or the party-load script plus 1 real phone). It checks motion pace, sound timing and that FLAG_SECURE is scoped to faces. Headless browsers can't judge pace (see the 11-25 log).

## 8. Risks and how we handle them

| Risk | Handling |
|---|---|
| Announcements land up to about 1 s apart across phones (600ms polling) | Fine for banners. The Golden takeover and shared sounds use host-stamped times the way the results beats do, and late phones join at rest |
| Last Word adds a wait for the table | 20 s cap; the envelope keeps breathing on other phones; rare by design (Rare card and only when the Imposter is caught) |
| Hand state is lost if the host app dies | Same as scores today: session state lives in host memory. Not adding persistence in 1.3 |
| Art size slows browser guests | WebP plus a size budget check in the guest smoke |
| `App.tsx` gets bigger | New UI lives in `src/cards/` and `src/theme/`; App only routes |
| Rules feel flat at the party | Fun first (v11 System design §5): note which plays got a reaction and make the quiet cards louder in 1.3.x |

## 9. Release

Follow the global deploy rule:
1. Work on a branch, then open a PR into `main` and merge it.
2. Create a GitHub release `v1.3.0` on the merge commit, with notes. Every Android phone must update, because the gameplay version changed.
3. Build the APK from the main checkout, which has `.tools/`, `local.properties` and the generated Kotlin files. Keep the Kotlin incremental workaround (11-24 log).
4. Update the website's screens and copy for the theme and cards, then push to `main`. Pages redeploys automatically.

## 10. Open decisions

1. **Power cards default:** off until the host turns it on, then remembered on that phone like random rules (recommended), or on whenever 6+ players are in the lobby.
