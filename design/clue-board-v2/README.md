# Optional clue history — multiple clue turns

Status: approved and implemented. Supersedes v1's one-clue-per-player-per-round model. Mockups were generated with built-in image generation; exact prompts are in prompts.json. Live implementation uses the existing roster, buttons, icons and motion sheet. It retains the host's Pause round action beneath the turn/vote controls. Verification: Rust game tests and scripts/clue-board-smoke.js; live screenshots are under output/playwright/clue-board-*.png.

## Round versus clue turn

One game round contains as many clue turns as the group wants before voting. Round 3 / Turn 2 still uses the same roles, secret word and imposter hint as Turn 1. Starting another clue turn does not deal new roles, change scores, or count another imposter assignment.

## Screens

1. [Discussion, turn 2](01-discussion-turns.png): optional clues appear under each player, labeled by turn. The host can choose Another clue turn or Open voting at any time. No required submissions, readiness poll, missing badges, or countdown. A smaller eye-card illustration preserves room for both actions.
2. [Turn-specific clue editor](02-edit-turn-clue.png): one input targets Turn 2, with the earlier Turn 1 clue visible for context. Save and Remove affect only the selected clue. Remove appears only for an existing entry. Previous clues are never overwritten by adding a later clue. Own saved entries can be selected for editing before voting; the prior-clue text shown within this Turn 2 sheet is contextual, not another input.
3. [Voting with full history](03-voting-history.png): all recorded clue turns stay visible beside the corresponding suspect, becoming read-only once voting starts. The board also remains available during runoff.

## Retention and optional entry

One optional clue per player per clue turn. Skipping any or all turns is normal; absent clues stay absent. The host relies on the face-to-face discussion when deciding whether another turn is useful. Clue history survives same-round reconnection, remains available for this round's voting, and clears when the next game round starts. Private cards and secret votes remain separate from the public clue history.

## Visual continuity

Same charcoal, warm ivory, sage and lime palette; rounded typography, initials avatars, eye-card artwork, flat roster dividers, ballot controls and large buttons. Phone framing is presentation only. The existing Pause round text action is omitted from the focused discussion mockup to emphasize the two turn/vote actions; its placement remains a detail for implementation review.
