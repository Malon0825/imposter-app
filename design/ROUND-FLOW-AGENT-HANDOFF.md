# Imposter round flow completion record

**Status** · Implementation complete and verified locally, except for the items under [Still open](#still-open): the native-protocol fixture run, Android emulator and packaged-app verification, a signed `-Release` build, the physical playtest questions, and GitHub publishing of the preview.

## What shipped

[Round Flow Implementation Plan](ROUND-FLOW-IMPLEMENTATION-PLAN.md) is the authority for rules, timing, privacy, recovery, and tap counts, and the [mockup gallery](round-flow-v1/README.md) holds the visual references. The working tree implements that plan: host-owned rule and Results reveal stages, automatic topic resolution and durable dealing with **Retry deal** on a persistence failure, one locked ballot per player with the imposter's dummy vote and escape bet, the staged suspense, verdict, and recap disclosure, reporting on Results closed by the host's **Continue**, direct repeat from rankings, **Skip round** with a fixed Classic replacement reveal, the three new spoken rules and their reviewed content, and the `round-flow-v2` gameplay header that refuses older native clients.

The runoff phase is no longer reachable in the shipped flow. Its code and the two tests that pin it are marked for deletion together.

## Verified

- `npm test` is green end to end: the content validator (23 topics, 581 word/hint pairs) and its nine unit tests, `tsc -b` plus the Vite build, and the party-core Rust suite at **67 passed, 0 failed, 1 ignored**. The ignored test is the opt-in topic-depletion report. See `output/round-flow-final-suite-2.log`. The Rust suite was run four times with no flakes.
- The whole Rust suite now runs the production round flow. Previously every fixture ran behind the test-only `legacy_test_flow`, so roughly 50 tests were exercising removed mechanics. The flag's default was flipped to the shipped flow and the 19 tests that then failed were migrated to staged Results beats, reports closed by the host's **Continue**, automatic topic draw and deal, direct repeat from rankings, and the imposter's escape bet. Only `runoff_changes_neither_original_accusation_nor_bet_and_scores_once` and `repeated_tie_escapes_original_ballots_score_once` still opt into `legacy_test_flow = true`; both carry a `ponytail:` comment saying they pin the inert runoff path and should be deleted with the runoff code.
- New core coverage closes the gaps the previous handoff listed. `late_reports_stale_votes_and_repeat_fallbacks_each_resolve_once` in [core game](../crates/party-core/src/game.rs) covers a report that wins the race to **Continue** and one that loses it, a duplicate **Continue**, the **Next round** fallback when the roster is not all connected, the fallback when no rule has a usable topic, and the skip-versus-final-vote race in the other order, where a ballot for the skipped round is rejected. The durable auto-deal retry was already covered by `durable_deal_failure_keeps_cards_concealed_and_retry_consumes_once`, extended so a native client missing the `round-flow-v2` header is refused on `join` and `action`, not only `inspect`.
- All 11 browser fixtures pass in Chromium: round-flow-v2-smoke, reconnect-smoke, reconnect-rescan-smoke, session-scoring-smoke, topic-voting-smoke, round-rules-smoke, card-recheck-smoke, clue-board-smoke, web-guest-smoke, web-capacity at 12 players, and ui-smoke. See `output/round-flow-sweep.log`. [round-flow-v2-smoke](../scripts/round-flow-v2-smoke.js) also passes in WebKit.
- round-flow-v2-smoke covers mixed native and browser guests, an automatic tie draw, the durable automatic deal, canceling and confirming a skip, the fixed Classic replacement reveal, the private dummy ballot, a civilian tie escape, personal scoring, the report sheet, a direct randomized repeat, and all six filtered rule ballots with all six rule reveal cards. One guest joins with a 28-character name, so long names ride through every captured screen.
- Seven fixtures that still drove the pre-v2 flow were migrated off manual topic dealing (**Vote for topic**, **Draw topic**, **Continue to roles**), the runoff second ballot, and the standalone reporting screen (**Continue to reports**, **Anyone break the rules?**, **Skip reporting**). [visual-capture](../scripts/visual-capture.js) and [visual-gallery](../scripts/visual-gallery.mjs) swapped their runoff board for the tie-escape verdict and now drive the report sheet from Results.

- The signed Android preview was rebuilt from this tree as `releases/imposter-1.2.0-android-preview.apk`. `apksigner verify` passes under the v2 and v3 schemes with the `CN=Imposter Preview` certificate, the recorded SHA-256 matches the file, and the manifest reports package `com.imposter.party.preview`, version `1.2.0` (code `1002000`), `minSdkVersion 26`, and native code for `arm64-v8a` and `x86_64` with no `debuggable` flag. The embedded frontend carries this flow: the stripped `libimposter_app_lib.so` contains **What should we play?**, **Bet on your escape**, **Two Truths and a Lie**, **Round skipped. Scores are unchanged.**, **No one was accused.**, and the `round-flow-v2` header. The APK installs on the emulator and the activity reaches `topResumedActivity` with no `AndroidRuntime` errors. The build that preceded the round-flow work is kept as `releases/imposter-1.2.0-android-preview-pre-round-flow.apk`, and [the preview 2 release note](../releases/v1.2.0-preview.2.md) documents the native update requirement.

- Each new spoken rule now opens a ballot of **seven** reviewed packs, up from two. Two Truths and a Lie plays Everyday, Food, Animals, Places, Travel, Technology and Sports; If It Could Talk plays Everyday, Everyday chaos, Animals, Food, Places, Travel and Emotions; Sell It plays Everyday, Food, Places, Travel, Technology, Hobbies and Gaming. Each added pack carries twelve word-by-word approvals with a rule-specific hint and a sample clue in [the spoken review](../crates/party-core/content/spoken-mode-review.json), grouped so every hint still fits three to six plausible words from that same filtered pool. The plan's **Hold** lists stand: no pack asks players to invent believable falsehoods about consent, sex education or puberty.

## Investigated and closed

These three were chased to a cause and are not product bugs. They do not need re-investigation.

- **Horizontal overflow on the concealed role card.** The decorative `.cards-art` image is deliberately oversized and bleeds about 9px past each side of the card, where the page clips it. `document.documentElement.scrollWidth` equals the viewport, so nothing scrolls. The old check in topic-voting-smoke measured `main.scrollWidth`, which counts clipped overhang; it now measures page-level scroll like every other fixture.
- **"Reveal my role" below the fold.** At 360x700 the action's bottom lands 1px below the fold, which is subpixel and now covered by the same +1 tolerance the sibling overflow check already used. At 320x640 it is genuinely 61px below the fold and needs a scroll; that viewport is not in the capture set.
- **Blank reveal screenshots.** round-flow-v2-smoke's `capture` helper was the only one in the repo with no settle delay, so it screenshotted before the entrance animation painted. A timing probe confirmed the verdict card renders at full opacity and stays readable for about two seconds, and the fixed Classic replacement card lands about 0.7s after the skip and holds until about 4.6s before topic voting opens, both matching the plan. A 550ms settle was added to the helper.

## Still open

- [native-web-smoke](../scripts/native-web-smoke.js) was migrated in source but never executed. It needs the installed-host test harness on port 39145 plus the emulator.
- Rendering verification of the packaged app. The installed preview launches and resumes, but this machine's emulator cannot draw it: the hardware-GPU session logs `bad color buffer handle` and `MESA: Failed to open rendernode` and screencaps an empty frame, and `-gpu swiftshader_indirect` puts the emulator's own System UI into "isn't responding". Both failures are in the emulator's graphics stack, not in app code, so this check needs a physical device or a healthy emulator image.
- A native-host-plus-browser-guest run on the packaged app.
- A true `-Release` signed build. Only the preview signing profile exists on this machine, at `%LOCALAPPDATA%\Imposter\signing\imposter-preview.jks`. There is no release keystore, so `npm run android:release` cannot run here.
- The physical playtest questions in the plan: whether people notice both reveals when they look up from their phones, whether the host stays in the conversation, and how often three-player rounds split **1–1**.
- GitHub publishing of the preview build.

## Running the checks

```powershell
# Browser fixtures, against the bridge and Vite server described below
npx -y --package @playwright/cli playwright-cli -s=round-flow-qa open http://127.0.0.1:1464
npx -y --package @playwright/cli playwright-cli -s=round-flow-qa run-code --filename=scripts/round-flow-v2-smoke.js

$env:CARGO_BUILD_JOBS = '2'
npm test
node scripts/word-deck-smoke.mjs
```

Start `npm run dev:server` with `IMPOSTER_DEV_PORT=3204` and `IMPOSTER_DEV_HISTORY` pointing at a fresh SQLite file under `output/`. Start Vite with `IMPOSTER_DEV_API=http://127.0.0.1:3204` and `& .\node_modules\.bin\vite.cmd --host=127.0.0.1 --port=1464`. Run `npm run build` before starting the bridge so browser guests receive the current bundled assets. The bridge hosts one party at a time, so run scenarios sequentially with a fresh deck. On Windows, a running `party-dev.exe` can prevent Cargo from replacing the binary; stop only the verified test bridge that owns the file before rebuilding it.
