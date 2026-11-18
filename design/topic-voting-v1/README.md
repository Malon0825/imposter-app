# Topic voting — design proposal v1

Status: implemented, visual acceptance under review, 2026-11-16. The screens below are the approved mockups. These three mockups extend the approved visual system in DESIGN.md.

## Proposed flow

Lobby / next round → topic ballot → all ballots locked → results → tied leaders draw, if needed → chosen topic → private role cards → normal discussion and player voting.

Run a fresh topic ballot before every round. Do not reuse the last ballot automatically.

## Voting rules

- Every participating player, including the host, chooses one or more available topics.
- Each checked topic gets one approval vote from that player. Selecting extra topics does not divide a player's votes or give duplicate votes to a topic.
- Players can freely change their selection before pressing **Lock my vote**. At least one selection is required. The ballot locks after submission.
- Show submission progress while voting; keep topic tallies and individual choices hidden until all participating players submit.
- The topic with the most approvals wins. A plurality is sufficient; no majority threshold is required.
- If several topics share the highest count, include only those leaders in one uniform random draw. Two leaders: 50% each. Three: 1 in 3 each. Four: 25% each.
- For a tie, the public result screen explains the equal chances. The host presses **Draw topic** once; the app chooses and keeps the result. This is a proposed presentation step, not permission for the host to pick a topic or reroll.
- A unique leader skips the tie screen and goes directly to the chosen-topic state.
- The chosen topic is public. Word/hint and role information still appear only on each player's private card.
- Topic votes do not affect scores. Repeated topics remain eligible in later rounds. Keep normal word-repeat avoidance within the winning topic.
- All standard topics are available by default. The four existing opt-in packs follow the party's opt-in settings before voting opens; they are not silently added by a tie or random fallback.

## Important edge cases

- Start the ballot for the round's participating players. Guests who join after voting starts wait until the next round rather than changing the current electorate.
- A temporary disconnect preserves a locked ballot and pending selection state where possible. Show who is reconnecting; do not invent a vote or silently count the disconnect as an abstention.
- If someone permanently leaves or the host removes them before the result is finalized, remove their ballot and update the expected voter count. Preserve the remaining ballots; return to the lobby if fewer than three players remain.
- Once the tally/draw is finalized, preserve it through back navigation, reconnects, and repeated taps. A departing player does not cause a new draw.
- Changing the available topic pool requires reopening a fresh ballot for everyone. Do not reinterpret already locked selections.
- With no submitted choices, stay on the voting screen. There is no automatic all-topic fallback.
- If everyone selects every available topic, all of those topics tie and receive equal draw chances.
- The topic tie draw is separate from the existing runoff vote for identifying the imposter. The imposter-voting runoff rules remain unchanged.
- There is no voting countdown. Show progress and the pending participants instead.

## Three proposed screens

1. [Personal topic ballot](01-topic-ballot.png): familiar two-column tile grid, multiple checked topics, private choices, completion progress, and **Lock my vote**.
2. [Tied leaders](02-tied-topics.png): Food and Animals each have 4 votes and 50% draw chance. Lower scores stay visible in simple rows. **Draw topic** is the host action; guests see a waiting state.
3. [Chosen topic](03-chosen-topic.png): public Food category card, a short draw explanation, and **Continue to roles** for the host. Guests see the same result and wait for the host.

The submitted/waiting state uses the existing locked-vote visual language: lime check, progress dots, “Your topics are locked”, and “Waiting for everyone”. Its summary lists only that player's selected topics. It does not reveal live totals.

## Sample round continuity

Six players: Alex (host), Sam, Mia, Ben, Jo and Lee.

- Alex chooses Food and Animals.
- Sam chooses Food and Everyday.
- Mia chooses Animals and Music.
- Ben chooses Food and Animals.
- Jo chooses Food.
- Lee chooses Animals and Everyday.

Final counts: Food 4, Animals 4, Everyday 2, Music 1. The totals are approvals, so they can exceed six. Only Food and Animals enter the draw. The sample winner is Food.

The ballot mockup is Alex's view before submission, with four other players finished and two of six still pending. The next two mockups are the host's public result views after all six submit.

## Visual direction

Use the established charcoal #141916, surface #1C211E, warm ivory #F4F1E8, sage #B4C8AD and lime #D6F56B tokens. Keep DM Sans-style round grotesk headings, custom filled topic illustrations, 16px radii, 60px primary actions, existing selection checkmarks and generous spacing. Do not add persistent tabs or a new palette.

Tied topic rows must have identical emphasis; “50% chance” describes selection probability rather than approval share. The result uses the existing ivory card language but contains only the public topic, never the secret word.

For later motion review, retain the existing brief selection/check behavior and restrained result reveal. Motion must not change the draw or delay authoritative game state. Reduced motion should show the same committed result directly.

## Generation

Created with the built-in ImageGen tool using the imagegen and imagegen-frontend-mobile skills. The existing topics, locked-vote and runoff screenshots informed the design. Full prompts are preserved in [prompts.md](prompts.md). Device frames are for presentation only and do not belong inside the implemented app.

Implementation uses the existing React tiles, checks, progress indicators, private cards, and shared motion tokens. The Rust host owns ballots, counts, the frozen topic result and private word/role assignment. Native and browser guests share the same rules; browsers receive only their own ballot plus public completion progress, and aggregate totals after voting finishes.

Topic settings can configure the available pool in the lobby. All 19 standard packs are enabled by default; the four opt-in packs are disabled by default. The host can return to the lobby through the confirmed abandon action to reopen settings and start a fresh vote. Late new joins continue to wait for the lobby; reconnecting players retain their existing place.

Verification: production frontend build; 33 Rust tests including topic privacy/validation, approval totals, uniform tied-leader sampling, one-result commitment, participant removal, new-round reset and word-repeat avoidance; a six-player mixed native/browser two-round scenario; draft and locked-ballot reloads; 20 rapid topic toggles; 360/390/430px layouts and reduced motion. Screenshots are in output/playwright/topic-voting-*.png. Human review of phone-specific touch feel remains useful.


Android verification: the universal debug APK built successfully for arm64-v8a and x86_64 at releases/imposter-1.1.0-android-debug.apk. Native transport tests and real Rust/TLS clients were exercised; this feature was not installed on physical phones during this pass.

The updated four-player/two-round full-game UI smoke also passed, covering topic voting on both rounds, secret ballots, scoring, reports and reloads, Drink/Dare, runoff ties, replay, party ending and final score retention. The 21st review completed with informational existing token/color findings and no automatic fixes.

## Side-by-side visual review

User requested visual acceptance against the approved mockups before completion. The original mockups remain unchanged. [Open the comparison gallery](comparison.html), with the original on the left and the implemented React UI on the right. The right-hand screenshots use the same controlled Round 3, six-player sample state for an accurate content comparison; the production components are rendered by Playwright without image generation or image retouching. Device borders in the gallery are presentation framing only.

The review corrected clipped topic rows, missing linked progress dashes, mismatched topic illustrations, leader ordering/copy, hidden lower tallies at compact sizes, and result-card sizing and spacing. Voting-screen illustration variants are scoped so the original app illustrations remain available elsewhere.

New captures cover 390×844, 360×700 and 430×880. Primary actions remain visible and no horizontal overflow was observed. Frontend build and all 35 Rust tests pass; the Android debug APK was rebuilt with these visual changes. Visual acceptance remains open for the user's side-by-side review; passing automated tests alone is not design sign-off.
