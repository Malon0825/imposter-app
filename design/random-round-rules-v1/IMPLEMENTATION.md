# Random round rules and word deck

The host can enable random rounds from Session settings. Each ready round draws one of the feasible rules with equal probability and reveals it before topic voting. The host can change the setting during play, including when paused. The current round keeps its rule and the new setting applies at the next draw.

Word selection uses the 581-entry catalog and the host's enabled packs. A topic needs ten reviewed compatible entries at the start of a deck. Each deal then applies persistent deductions, recent clue spacing, and a hint check against the remaining pool. An eligible hint must fit at least three distinct playable concepts. The word deck is saved on the device that hosts the party. An explicit fresh deck allows older words to return while keeping the recent clue history.

The Android host uses its private app data directory. Word deck transactions are committed before cards are published. The host can retry a failed save from the chosen-topic screen. The game saves the word and associated selection data without persisting player credentials, votes, or private role assignments.

## Design review

The live screens follow the reference interiors using the app's DM Sans typography, colors, cards, artwork, and controls. The mode illustrations were redrawn for responsive display. The topic vote retains access to Session settings for the host, and the lobby settings sheet includes a Word deck section.

The browser smoke captures the nine reference layouts plus compact guest and reduced-motion states in `output/playwright/round-rules-*.png`.

## Verification

- The content validator checks the stable IDs, mode reviews, family groups, approved fallback hints, and generated selection index.
- Seeded simulations confirm that selection stops once eligible content runs out. In four single-pack trials, Classic Animals supported six to seven deals and Sound Only Animals supported four to five before no reviewed hint was viable. The ten-word threshold measures the starting catalog. Enabling additional packs gives the selector more room as individual pools narrow.
- The new Rust tests cover both nonverbal rules, hint pruning, clue-family spacing, SQLite ownership and recovery, and a failed write followed by an idempotent retry. The test suite also exercises the existing scoring and reconnect behavior.
- The mixed-client browser test covers the three reveal variants, filtered topic voting, browser reload, private roles, optional performed markers, a paused settings change, and the accusation vote.
- The process restart test deals a word using the real host, ends and recreates the party, stops the host process abruptly, and verifies that both earlier words are still deducted. It uses an isolated database.
- The universal debug APK built for ARM64 and x86_64. On an x86_64 Android 16 emulator, the installed host dealt to two authenticated browser guests through the real LAN API. After a force-stop, it reopened the device's database, started another party, and dealt a different word. Physical phone and group playtesting remain pending.

Run the content, frontend, and Rust checks with `npm test`. Run the mixed-client test with the repository's Playwright CLI workflow and `scripts/round-rules-smoke.js`. Start with a development bridge that uses an isolated or in-memory deck.

Build the frontend and the development host binary before running `node scripts/word-deck-smoke.mjs`. To regenerate the per-topic depletion data, run `node scripts/rust.mjs test -p party-core topic_depletion_report -- --ignored --nocapture`.

Playtesting with a physical group can verify whether the six-round meaning window and four-round performance window reduce similar clues. The simulations measure eligibility and game behavior across different selections.
