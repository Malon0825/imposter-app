# IMPOSTER motion

Purpose: confirm actions, preserve navigation direction, explain shared progress, and mark the end of a party. Feeling: snappy and playful, with calm resting screens. The approved layouts, palette, artwork, and 420 ms private-card reveal remain the visual reference.

## Motion specification

- **Taps and selections:** pressing a primary control compresses it to 97.5%, then an interruptible spring restores 100%. The press spring uses stiffness 620, damping 34, mass 0.55. A selected topic or ballot draws its check over 200 ms and settles with a small spring. Rapid input replaces the current target; it does not queue animations. Reduced motion retains color and selection changes without scale/path movement.
- **Navigation:** forward pages enter from the right; back navigation reverses the direction. Exit takes 100 ms and entry 240 ms, with ease-in/ease-out respectively. The resting screen is fully opaque at x/y zero. Incoming state replaces an unfinished transition. Reduced motion changes screens immediately.
- **Game phases:** public phase changes fade, punishment turns crossfade over 160 ms, and a runoff enters upward by 24 px. The existing 500 ms result reveal remains the larger emotional moment. Game state changes are never delayed to wait for animation.
- **Private cards:** the card turns through 180 degrees over 420 ms. Hiding removes its secret content immediately. Backgrounding adds a synchronous visual concealment guard, hides the role, and requires an explicit reveal after returning. Reduced motion changes the face immediately.
- **Expandable controls:** Wi-Fi editing and topic search animate their small section's height/opacity over 200 ms. Closing or reopening reverses from its current state. The section rests at intrinsic height with visible focus outlines. Reduced motion expands/collapses immediately.
- **Sheets:** the QR and confirmation sheets enter with stiffness 420/damping 38 and exit downward over 180 ms. Drag only the handle, so content scrolling and QR interactions stay independent. A downward drag over 85 px, or a deliberate fast downward flick, dismisses; shorter drags spring back. Pending operations disable dismissal. Keyboard, outside-tap, close, and native-back paths remain available. Reduced motion uses immediate states and keeps the handle's tap/keyboard close action.
- **Vote confirmation:** the paper envelope settles from a 6 px offset and 3-degree tilt. Its seal springs in after 120 ms and its check draws after 180 ms. Progress dots fill as votes arrive; no ballot choices are disclosed. The dots stay within the screen for 3–12 players. Reduced motion displays the finished envelope, check, and progress.
- **Scores:** rankings count monotonically from the previously committed total to the new committed total over 500 ms. Animation only changes the display; the authoritative Rust score is untouched. Leaving interrupts the display animation cleanly. Final totals and screen-reader labels use the actual score. Reduced motion shows the final number immediately.
- **Celebration:** final rankings keep the proposal's 16 static paper pieces. One additional burst of 12 small pieces arrives from the edges, lasts about a second, and is removed after 1.4 seconds. It cannot intercept input. Hidden pages stop the burst and do not replay it on return. Reduced motion uses only the static composition.
- **Ambient/loading:** welcome cards float over a seven-second loop only while the page is visible. Other continuous CSS animations pause in the background. Busy actions disable their controls immediately, but the secondary spinner appears only after 250 ms to avoid flashes on quick local actions.

## Tuning

Shared values live in `src/motion.ts`. Adjust `pageEnter`/`pageExit` for pace, spring damping for bounce, and `celebration` for the short burst's duration. Keep taps brief and the reveal at the approved 420 ms. `src/motion-ui.tsx` contains the reusable sheet, check, progress, score, and envelope components; `src/motion.css` holds their motion-only styles.

## Verification

Use `scripts/motion-check.js` for timeline sampling, rapid repetition, sheet drag/cancel, role concealment, progress capacity, celebration cleanup, and reduced-motion checks. Record the app at normal playback speed, inspect intermediate and resting frames, and run the live multiplayer scenario in `scripts/ui-smoke.js`. The fixed-state screenshot runner remains available for comparison with the approved boards.

Completed review: 20 rapid navigation cycles, 20 sheet open/close cycles, 20 selections, intermediate private-card frames, visibility/help concealment, slow-action duplicate protection, 12-player progress, monotonic 0/1/2 scores, burst cleanup, and reduced motion all passed. The four-player/two-round live game passed, along with all 12 Rust tests and the production build. All 24 fixed-state screens fit 360 × 700 without horizontal overflow. Timeline frames were inspected for entry, midpoint, completion, and return to rest.

The updated APK was signature-checked, installed, and tested on the API 36 Android emulator. `scripts/motion-android.js` verified sheet return/dismissal, native topic selection, confirmation, and cleanup. The recorded sample-party flow and its still frames are available in `output/playwright/motion-review/index.html`. Physical-phone performance and whether the spring/celebration pace feels right to the group still need a human review.
