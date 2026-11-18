# Session scoring mockups v1

Status: approved for end-to-end implementation on 2026-11-16. The original review images and prompts are preserved. See [implementation and verification](IMPLEMENTATION.md) for the shipped behavior.

Generated with the built-in image-generation tool, using current app screenshots and the approved clue-board mockup as visual references. Original generated files were preserved. Exact prompts and reference paths are in [prompts.json](prompts.json).

## Review order

1. [Session target](01-session-target.png): host chooses 10, 15, 20, 25, or 30 points.
2. [Private vote and confidence bet](02-confidence-bet.png): betting stays on the ballot; example balance 2, stake 2, option 3 disabled.
3. [Correct vote and reading streak](03-correct-vote-streak.png): correct vote +1, bet +2, third correct read +1; total +4, balance 2 to 6.
4. [Lost bet](04-lost-bet.png): alternate outcome, wrong vote and stake 2; total -2, balance 2 to 0, streak reset.
5. [Perfect bluff](05-perfect-bluff.png): imposter escape +2 and zero original votes +1; total +3, balance 7 to 10.
6. [Session standings](06-session-standings.png): current scores and progress toward the target.
7. [Session complete](07-session-complete.png): final scores preserved; host starts a fresh session with the same connected players.

These are state examples, not consecutive results from a single round. Screens 3, 4, and 5 are alternative personal result states. The proposed result breakdown extends the current result screen; the mockup Continue label does not settle the existing Drink or Dare/report flow. Review that transition during implementation.

## Proposed rules behind the screens

- Correct original civilian accusation earns +1. Optional stake is 0 through min(3, available balance); no bet is the default.
- A correct bet adds its stake as profit on top of the base point; a wrong bet subtracts the stake. No negative balance.
- Every third consecutive correct civilian accusation earns +1. Wrong civilian accusation resets the streak. Imposter and abandoned rounds do not interrupt the streak.
- Imposters cannot bet. Escape earns +2; zero votes against them on the original ballot earns a further +1.
- Original locked accusations determine bets and streaks. Runoff does not replace them or create another bet.
- Abandoned rounds do not settle points or bets.
- Settle the entire round, including applicable report deductions, before checking the target. Deductions are floored at zero.
- If multiple players reach the target, highest final score wins. Exact highest ties share the win. Scores may exceed the target.
- Session-complete standings remain visible until host starts the next session. Restart resets scores, streaks, bets, and pending score deductions, preserving connected players and party join credentials.
- Preserve weighted imposter assignment history across score sessions in the same party.
- Bets and amounts stay private before results. Drink, Dare, and Skip do not affect points.

## Visual review notes

The set retains the charcoal, ivory, sage, lime, and terracotta palette, rounded typography, circular initials, large bottom actions, eye motif, and flat rankings. Phone frames are presentation only, never app UI. Generated mockups are visual references rather than pixel-exact implementation assets; use the app's existing flat tokens and shared components.

No source-code changes or build/tests were needed for this image-only review set.
