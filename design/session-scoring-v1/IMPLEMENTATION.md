# Session scoring implementation

The approved screen concepts extend the shared React UI and authoritative Rust game engine. Target selection saves into the existing lobby readiness flow; the host still starts the topic ballot once everyone is ready. This avoids starting a round from a settings screen while players are joining.

## Rules and state

- Host selects 10, 15, 20, 25, or 30 points; default 15. The target locks at the first round and stays locked through abandoned rounds.
- Civilian original ballots support an optional integer stake from 0 through min(3, available points), default 0. A correct original accusation earns +1 base plus the stake; an incorrect accusation loses the stake. Imposters cannot bet.
- Every third consecutive correct civilian original accusation adds +1. An incorrect accusation resets that streak. Imposter and abandoned rounds preserve it.
- Imposter escape earns +2. Zero original accusations against the imposter adds +1 perfect-bluff bonus. Runoff never replaces the original accusation or adds a bet.
- Scores and prior report deductions settle once for the entire round, with a zero floor, before target comparison. Overshooting is allowed; highest final score wins and exact highest ties share victory.
- Keep the existing Results → Reports → Drink/Dare sequence. Then show Session complete when the target was reached, otherwise ordinary standings. Drink/Dare eligibility depends on the original accusation or escape, independently of wagering or deductions.
- Final-round reports clear before the next session and do not change the settled winner. End party retains the existing final standings and hosting shutdown behavior.
- Start next session is host-only and valid only on Session complete. Reset scores, streaks, wagers, results, and pending report deductions; keep party ID, players, credentials, connection state, topics, used words, and weighted imposter history. Advance the request round generation so outstanding old commands cannot mutate the new session.
- Stakes and original accusations are private before results. Owner views preserve locked bets and reading streaks through resume/recovery. No wager details are added to public player rows.

## Implementation

- `crates/party-core/src/game.rs`: target/session lifecycle, stake validation, signed awards, streak/bluff calculation, zero floor, winner snapshot, and private score projection.
- `crates/party-core/src/scoring_tests.rs`: deterministic rule coverage across all targets and 3–12 players, including invalid stakes, retries, runoff, deductions, shared wins, and reset boundaries.
- `src/App.tsx`, `src/types.ts`, `src/style.css`: setup, optional in-ballot stake controls, locked-bet recovery, personal breakdowns, progress, standings, shared wins, and restart. Uses existing buttons, avatars, icons, selection springs, result transition, score counters, and confetti.
- `scripts/session-scoring-smoke.js`: real Rust/TLS/native-session and hosted-browser UI scenario, with injected lost vote response and closed-tab QR rescan.

## Verification

- Production TypeScript/Vite build passed.
- All 48 Rust tests passed. The new stake matrix covers balances 0–4 and stakes 0–3 for every supported party size; target checks cover all five choices.
- Chromium and WebKit mixed native/browser flows passed: real target changes, affordable stakes, imposter exclusion, private wagers, lost-response recovery, closed-tab QR resume, third-read bonus, zero floor, perfect bluff, session completion, final score retention after reload, and reset with identity preservation.
- Existing four-player/two-round UI regression passed after updating score-copy and report-breakdown expectations: role privacy, topic voting, reports, human-given Drink/Dare turns, repeated-runoff tie, replay, host ending, and final score retention.
- UI captures were reviewed for target setup, betting, streak results, lost bet, perfect bluff, and completion. Compact 320×640 and ordinary 390×844 layouts have no horizontal overflow; long lists and result details scroll vertically.
- 21st review reported only informational existing hardcoded-color findings; the new UI uses project tokens and existing primitives. No dependency or external component was added.
- Android debug packaging passed for ARM64 and x86-64; APK Signature Scheme v2 verification passed. No Android device was connected for a new installed-device run.

Generated runtime screenshots are under `output/playwright/session-scoring-*.png`. Phone frames in the original mockups are presentation only. Physical-phone group playtesting remains necessary for real Wi-Fi and device lifecycle behavior.
