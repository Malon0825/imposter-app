# Full Cast mode — implementation plan

Status: **Implemented 2026-11-22.** The user asked for the full feature end to end, so the UI was built directly on the approved visual system (DESIGN.md) instead of a separate mockup round. Section 9 records where the implementation differs from this plan.

## 1. Intended result

Full Cast is a host-enabled mode for parties of **6 or more**. Every player gets a role. There are five special roles plus Gamblers:

| Players | Imposter | Accomplice | Detective | Judge | Decoy | Gamblers |
|---|---|---|---|---|---|---|
| 6 | 1 | 1 | 1 | 1 | 1 | 1 |
| 7–12 | 1 | 1 | 1 | 1 | 1 | n − 5 |

The round flow is the same as the current streamlined flow: **rule reveal → topic vote → private cards → clue turns → discussion → voting → results → reports → Drink/Dare → standings**. Only these change:

- what each card shows,
- what each ballot asks,
- how `resolve` scores the round,
- that results reveal the whole cast.

## 2. Settled rules

### 2.1 Enabling the mode

- **Turning it on:** one host toggle, **Full Cast**. It can only be changed in the `lobby` phase, and only turned on while at least 6 players are active.
- **Readiness:** changing the toggle clears everyone's ready state, the same as other rule changes (PLAN.md §Lobby).
- **Dropping below 6:** the setting stays on, and `kickoff` refuses to start with "Full Cast needs at least 6 players." The host can wait for more players or switch it off.
- **Freezing:** each round records whether Full Cast was on when it started, so the round's state can't change partway through.
- **Persistence:** the setting stays across Next round and a new score session. A new party starts with it off. It is not saved to the word-deck database.
- **Random rules:** the setting works alongside random round rules. The two toggles are independent.

### 2.2 Which round rules can be played

All six rules can be played in Full Cast, so no rule filter is needed:

- **Clue restrictions only cover giving clues.** Discussion and accusations use normal speech in every rule (random-round-rules-v1 §3.1), so detective claims and accusations always work.
- **Winks are physical,** so they work under every rule.
- **A decoy word always exists.** `viable_hints` only accepts a hint when its candidate set still holds at least 3 distinct concepts in the remaining pool. The real word takes one concept, which leaves at least 2 for the decoy. Any round that can be dealt can therefore get a decoy word, under every rule.

So existing feasibility already acts as the filter. If playtests show a rule doesn't work with roles, excluding it is a one-line `filter` on `modes` in `selection::availability`. That exclusion is deliberately not built now.

### 2.3 Roles: what each card shows and what each role can do

| Role | Side | Card shows | Power |
|---|---|---|---|
| Imposter | Imposter | The indirect hint (same as today) | Ballot picks **who the accomplice is** and **who the decoy is**, plus the existing escape bet |
| Accomplice | Imposter | The real word, plus the imposter's name | Wink at the imposter at the table. Their accusation vote counts normally |
| Detective | Civilian | The real word, plus one player who is **neither the imposter nor the accomplice** | Only player who can name the accomplice. Bets on one pick only |
| Judge | Civilian | The real word | Vote counts **2**. Breaks a tie only when the judge voted for the imposter |
| Decoy | Civilian | "You are the Decoy" plus a **related word** (never the real word) | Must blend in without throwing civilians off |
| Gambler | Civilian | The real word | Bigger bet payout (§2.6) |

Other dealing rules:

- **Decoy word:** another word from the same hint candidate set as the round's hint, with a different concept, still in the remaining pool and playable under the round's rule.
  - Example: hint *Pocket* → civilians get *Wallet* → the decoy gets *Key*.
  - The decoy word is **not** removed from the word deck.
- **Detective's cleared name:** drawn uniformly from the judge, the decoy and the gamblers.
- **Who sees which names:**
  - The accomplice sees only the imposter's name.
  - The detective sees only their cleared name.
  - Nobody else sees any other role.
  - Every role is revealed at results.

### 2.4 Ballots

| Role | Accusation (required) | Extra picks | Bet |
|---|---|---|---|
| Imposter | Yes, but doesn't count toward the accusation (as today) | Accomplice pick and decoy pick: required, two different players | Escape bet 0–3 (existing) |
| Accomplice | Counts with weight 1 | — | 0–3, on "not caught by the detective" |
| Detective | Counts with weight 1 | Optional accomplice pick, must differ from their accusation | 0–3, on **either** the accusation **or** the accomplice pick |
| Judge | Counts with weight 2 | — | 0–3 on the accusation |
| Decoy | Counts with weight 1 | — | 0–3 on the accusation |
| Gambler | Counts with weight 1 | — | Gambler tiers (§2.6) on the accusation |

- **Stake cap:** min(3, current balance) for everyone, the same as today. A gambler needs a balance of at least 3 to pick the top tier.
- **Self-picks:** nobody can pick themselves.
- **Ballot payload:** the `vote` payload gains optional `accomplice_id`, `decoy_id` and `bet_on: "imposter" | "accomplice"`. These are rejected for roles that don't have them.

### 2.5 Accusation

- **Counting:** sum the counting ballots, with the judge weighted 2 and the imposter excluded.
- **Single leader:** the top player is accused.
- **Tie:** if the judge voted for the imposter and the imposter is among the tied leaders, the imposter is accused. Any other tie means the imposter escapes, as today.

### 2.6 Scoring per round

Definitions:

- **escaped**: the accused player is not the imposter.
- **accomplice caught**: the detective's accomplice pick names the accomplice.
- **decoy caught**: the imposter's decoy pick names the decoy.
- **Void**: the player gains no points this round, but a lost bet still costs its stake.

**Bet payouts:**

| Stake | Everyone except gamblers | Gambler |
|---|---|---|
| No bet | 0 | 0 |
| 1 | ±1 | ±1 |
| 2 | ±2 | ±2 |
| 3 | ±3 | **+5 / −3** |

The gambler sees exactly these options on the ballot: **No bet, ±1, ±2, +5 / −3**.

| Role | Earns | Bet | Void when | Best / worst |
|---|---|---|---|---|
| Imposter | +2 if escaped. +1 perfect bluff (escaped and nobody voted for them). +1 pair bonus (escaped, named the accomplice correctly, accomplice not caught). +1 for naming the decoy correctly (pays whether or not they escape) | ± on escaping | — | +8 / −3 |
| Accomplice | +1 if escaped (including when the accomplice is the one accused). +1 pair bonus (same condition as above) | + if not caught, − if caught | Accomplice caught | +5 / −3 |
| Detective | +1 correct accusation. +1 correct accomplice pick | ± on the chosen pick | — | +5 / −3 |
| Judge | +2 correct accusation | ± | — | +5 / −3 |
| Decoy | +1 correct accusation. +1 if the imposter is caught | ± | Decoy caught | +5 / −3 |
| Gambler | +1 correct accusation | Gambler tiers | — | +6 / −3 |

Rules that apply to every role:

- **No streaks:** reading streaks are not added to or reset in Full Cast rounds. They stay frozen until the next non-Full-Cast round.
- **Scores:** totals never drop below zero.
- **Reports:** report penalties from the previous round apply as they do today.
- **Session target:** checked after the round settles, as today.

**Drink/Dare queue.** Each player is added at most once:

- civilian-side players with a wrong accusation,
- a caught imposter,
- an accomplice who was caught, or whose imposter was caught,
- a caught decoy.

The existing rule queues anyone whose base score is 0. Full Cast needs an explicit "lost" decision per role instead.

## 3. What the code does today, and the gaps

- `Round` holds a single `imposter: String`, and `view` builds `private_role` as imposter or civilian (`game.rs`, `private_role` closure).
- The `"deal"` action (`game.rs` around line 540) picks the word, calls `choose_imposter`, records the imposter's turn and sets `phase = "roles"`.
- `imposter_weights` / `record_imposter` hold the fairness weighting. `rule_weights` repeats the same shape for rules. Neither covers other roles.
- `"vote"` accepts `{player_id, stake}` with a stake of 3 or less, capped by balance.
- `resolve` counts the ballots, ignores the imposter's vote in streamlined mode (always on in production), has no runoff, scores two roles, and queues anyone with base 0 for Drink/Dare.
- `selection::Candidate` holds `{word, hint}` but drops the hint's candidate list, which the decoy word needs.
- In the UI, `App.tsx` (4.4k lines) renders the lobby, role card, ballot and results; `role-meaning.tsx` explains roles; `types.ts` mirrors `view`.

## 4. Core changes (`crates/party-core`)

### 4.1 Model (`game.rs`)

- `Game.full_cast: bool` and `Game.role_turns: BTreeMap<Role, BTreeMap<String, u64>>` plus `last_role: BTreeMap<Role, String>`.
  - These hold fairness history for the four new special roles.
  - Imposter history stays in `imposter_turns`, unchanged.
- Add `enum Role { Imposter, Accomplice, Detective, Judge, Decoy, Gambler, Civilian }`. `Civilian` covers every role outside Full Cast.
- `Round.cast: Option<Cast>`, where `Cast { accomplice, detective, judge, decoy, cleared, decoy_word, decoy_definition }`. `None` means a normal round. `round.imposter` stays as it is, so most existing code is untouched.
- `Round.picks: BTreeMap<String, Picks>`, where `Picks { accomplice: Option<String>, decoy: Option<String>, bet_on_accomplice: bool }`.
- `ScoreBreakdown` gains:
  - `bonus: i32`: pair bonus, decoy catch, the decoy's caught-imposter point, the judge's extra +1, and the gambler's extra +2 on a winning top-tier bet. Shown as one line on the recap.
  - `voided: bool`.

### 4.2 Settings and start

- New action `"full_cast"`:
  - `require_host`, `require_phase(["lobby"])`.
  - `true` needs `active().len() >= 6`.
  - Clears every player's `ready`.
- `kickoff`: if `full_cast` is on and there are fewer than 6 active players, return the error. Freeze `round.full_cast`.

### 4.3 Dealing

- **Shared weighting.** Turn `imposter_weights` into `weights(history, last, exclude)` and have both the imposter and the new roles use it. Same formula: gap capped at 15, the last holder halved.
- **Deal order.**
  1. Imposter: unchanged path, and history is recorded as now.
  2. Accomplice, detective, judge and decoy: each drawn by weight from the players not yet dealt, and each recorded in `role_turns`.
  3. Gamblers: everyone left.
- **Decoy word.** `Candidate` keeps the hint's `candidates`. After the word is chosen, pick uniformly from the candidates that:
  - have a different concept from the real word,
  - are still in the remaining pool,
  - are playable under the round's rule.

  §2.2 shows such a word always exists. Add a `debug_assert` and a content test.
- **Detective's cleared name:** uniform among the judge, the decoy and the gamblers.
- **Recording.** History is recorded once, at deal time, including for abandoned rounds. This is the same deduplicated-action guarantee the imposter's history already has.

### 4.4 Voting

The `"vote"` handler validates by role from `round.cast`:

- **Imposter:**
  - The accomplice and decoy picks are required and must name two different players.
  - Neither pick can be the imposter.
- **Detective:**
  - The accomplice pick is optional, and must not be the detective or their own accusation.
  - `bet_on_accomplice` needs that pick.
- **Everyone else:** extra fields are rejected with "That pick isn't part of your role."

Picks are stored in `round.picks` at the same moment as the original ballot. There is no runoff, so nothing changes later.

### 4.5 Settlement

When `round.cast` is `Some`, `resolve` branches into `resolve_full_cast`:

1. Weighted tally, then accusation, following §2.5.
2. Work out `escaped`, `accomplice_caught`, `decoy_caught` and the pair-bonus condition.
3. Score each player with the §2.6 tables. Void means: drop the positive base, bonus and bet parts, but keep a negative bet.
4. Push each player onto the Drink/Dare queue at most once, using the explicit rule.
5. Then the existing report penalties, the target check, the queue shuffle and `result_reveal`, all unchanged.

Normal rounds keep the current code path exactly.

### 4.6 View

- **`private_role`** returns `{role, clue, definition?, imposter_id?, cleared_id?}`:
  - only the accomplice gets `imposter_id`,
  - only the detective gets `cleared_id`,
  - the decoy's `clue` is the decoy word.
- **`betting`** adds:
  - `bet_on_choice` for the detective,
  - `payouts` (the list of `{stake, win, lose}` the player may pick), so the gambler's ballot shows No bet / ±1 / ±2 / +5 −3 straight from the server,
  - `max_stake` for the imposter's escape bet, which follows today's streamlined rules.
- **`ballot`** adds `needs_accomplice_pick`, `needs_decoy_pick` and `may_pick_accomplice`.
- **`result`** adds:
  - `cast` (every player and their role),
  - `decoy_word`,
  - `picks` outcomes: `accomplice_caught`, `decoy_caught`, `pair_bonus`, `judge_tiebreak`.

  These are only sent once results are committed. Each player's own `score.bonus` and `voided` come through the existing `score`.
- **Lobby:** `full_cast` is sent to everyone, and the host also gets `full_cast_available` (`active >= 6`).

### 4.7 Tests (`game.rs` tests / `scoring_tests.rs`)

- **Toggle:**
  - host only, lobby only,
  - refused below 6 players,
  - clears readiness,
  - a drop below 6 blocks `kickoff`.
- **Dealing:**
  - at sizes 6–12, exactly one of each special role, and the rest are Gamblers,
  - the cleared name is never the imposter or the accomplice,
  - the decoy word is never the real word and always shares the hint group,
  - this holds across every rule and every topic (content sweep).
- **Fairness:** the special roles spread across players with the same balance bounds as `weighted_selection_is_balanced_across_three_to_twelve_players`.
- **Secrecy:** extend `secret_views_never_include_other_roles_or_word`:
  - the accomplice sees only the imposter,
  - the detective sees only their cleared name,
  - the decoy never sees the real word,
  - no `cast` appears before results.
- **Ballot validation:** every rejected payload in §4.4, plus retry idempotency.
- **Accusation:**
  - judge weight 2,
  - a judge tie-break catches the imposter,
  - a tie where the judge voted for an innocent player means escape,
  - the imposter's ballot never counts.
- **Scoring:**
  - one test per row of §2.6, including:
    - an accomplice who is accused, so the imposter escapes and the accomplice gets +1,
    - pair bonus cancelled when the imposter is caught,
    - pair bonus cancelled when the accomplice is caught,
    - voided players keep a negative bet,
    - each gambler tier (±1, ±2, +5 / −3),
    - the imposter's decoy catch pays even when the imposter is caught,
  - the best and worst totals for each role,
  - no change to streaks.
- **Drink/Dare:** each role's losing condition queues that player exactly once.
- **Regression:** every existing test passes with Full Cast off.

## 5. Interface (`src/`)

- **`types.ts`:** mirror the new view fields.
- **Lobby (`App.tsx`):** a Full Cast toggle in the host's session settings.
  - It's disabled with a "Needs 6+ players" note when fewer than 6 are active.
  - Guests see a "Full Cast" badge.
- **Role card:** one variant per role, written in `role-meaning.tsx`:
  - the accomplice card names the imposter,
  - the detective card names the cleared player,
  - the decoy card says "You are the Decoy. This is *not* the real word."

  Hide-on-background and the reveal gesture stay as they are.
- **Ballot:**
  - The imposter's screen gets two extra name pickers: Accomplice and Decoy.
  - The detective gets an optional Accomplice picker and a bet-target switch.
  - Gamblers see the four tiers from `betting.payouts`.
  - The judge sees "Your vote counts twice".
- **Results:** a cast reveal (role per player), the decoy word next to the real word, and catch / pair-bonus / judge tie-break callouts. The recap shows `bonus`, plus a "Caught — no gains" line when the player's round was voided.

## 6. Documentation

- **PLAN.md:** add a Full Cast section with §2, and amend the "one imposter only" decision, since the accomplice is a second player on the imposter's side.
- **PRODUCT.md:** add one paragraph, and confirm the "no role rotation" line still holds. Full Cast deals roles by weight and doesn't rotate them, so the line stays true; add a note saying so.
- **round-rules / help text:** a short "Roles" explainer reachable from the lobby badge.

## 7. Delivery order

1. **Core rules and tests (§4).** These can ship without UI behind the toggle, since the host can't turn it on without the UI.
2. **Mockups** in `design/full-cast-v1/` for approval: the lobby toggle, six role cards, the imposter's and detective's ballots, the gambler's bet tiers, and the cast reveal on results.
3. **UI (§5)** to match the approved mockups.
4. **Documentation (§6).**
5. **Playtest checklist:**
   - 6- and 8-player sessions,
   - win rate for each side,
   - how often the accomplice is caught,
   - how often the decoy is caught,
   - how often the judge decides the vote,
   - how often gamblers take the top tier.

   Adjust only the numbers in §2.6 based on the results.

## 8. Out of scope

- More than one of any special role, or roles above 12 players.
- Choosing roles by hand, turning individual roles on or off, or adding custom roles.
- Any app action for the wink. It stays a physical gesture.
- Full Cast below 6 players.

## 9. Implementation notes

- **Code:** `crates/party-core/src/cast.rs` holds the roles, the weighting curve, the joint deal and per-role scoring as pure functions with unit tests. `game.rs` wires in the setting, deal, ballot validation, settlement and view. `cast_tests.rs` drives real rounds: toggle rules, every party size, private views, ballot validation, judge tie-breaks, escape and caught scoring, the Drink/Dare queue, and role rotation over 120 rounds.
- **Weights:** the five special seats are drawn jointly, enumerating every assignment (at most 95,040 at 12 players), with probability proportional to the product of each player's weight for the role they get. Gamblers are weighted too, so nobody sits out the special roles for long. The sequential deal sketched in §4.3 was replaced because the first seat drawn would always get the best odds.
- **Imposter ballot:** the UI sends the accomplice pick as the imposter's dummy accusation. It is ignored in the tally, as it is today.
- **Betting view:** `betting.top_payout` (5 for Gamblers, otherwise 3) replaces the planned `payouts` list. `betting.my_picks` echoes the owner's locked picks.
- **Outcomes:** a new `spotted` outcome marks a caught Accomplice or Decoy. An Accomplice otherwise shares the imposter's `escaped` or `caught`. The personal verdict carries `my_role` so its headline reads correctly ("Your imposter was caught").
- **UI:** `src/full-cast.tsx` holds the role copy, the lobby switch and lineup, role badge, private role note, and pick chips. Role titles shrink to fit the fixed role heading.
- **Rule filter:** none was built. All six rules stay playable, as §2.2 explains.

## 10. Revision 2026-11-22: rule and flow changes after the first playthrough

- **Detective:** both picks are required. The bet always rides on the accomplice pick (the bet-target switch is gone). The cleared player is greyed out in both lists.
- **Accomplice:** the bet rides on the imposter escaping (a team bet). Voting for the Detective costs −1 and never voids gains. The ballot heading is "Who takes the fall?".
- **Imposter:** a caught imposter gains nothing, including the decoy catch, but a lost bet still costs. A correct decoy pick still voids the decoy's points.
- **Ballots:** each pick has an icon heading and a short question. The help lines are gone. Bets are named by what they ride on: Escape bet, Accomplice bet, Confidence bet, Gambler's bet.
- **Results:** each player sees their own result first (outcome, role badge, points, itemized breakdown) and taps **See the room** for the group recap. This is client-side only: the server phase is unchanged, and the host's Continue is on the room screen.
- **Code:** `cast::award` now takes `voted_detective` and drops `bet_on_side`. `Picks.bet_on_accomplice` is removed. `ScoreBreakdown.fine` carries the −1.

## 11. Role moment (2026-11-23)

After **Reveal my role**, Full Cast players first see a dedicated role screen: the role's portrait from `public/art/full-cast/` (800 px WebP; full-size originals in `design/full-cast-v1/art/`), the side (terracotta glow for the imposter side, lime for civilians), the role name in the Anton display face, a one-line goal and the role's power. **See my word** (or **See my hint** / **See my decoy word**) then flips in the existing word card. The role screen is per player and client-side, hides with the card on backgrounding, and is skipped when reopening the card mid-round. Each round also deals a fresh speaking order; whoever opened the previous round never opens the next.

## 12. Every size, no setting (2026-11-23)

Full Cast stopped being a 6+ option and became the only mode, from 3 players up. The lobby toggle, the Classic scoring path and reading streaks are gone. The lineup now grows with the room — Imposter and Decoy at 3, the Judge at 4, the Accomplice and Detective (always as a pair) at 5, Gamblers for the rest — and two roles scale instead of sitting out: the Judge's ballot doubles only from 6, and below 5 the Decoy holds the real word and plays as bait, scoring +1 when a counted ballot names them and nothing if the room convicts them. PLAN.md §13 carries the settled rules.
