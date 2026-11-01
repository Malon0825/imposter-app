# Proposal-to-app review

The six approved boards in `proposal-v1/` are the visual reference. Screen interiors are compared without the presentation's phone frames, illustrative status bars, or gesture bars. The comparison viewport is 390 × 750; compact and taller phones are checked separately.

## Review artifacts

- [Side-by-side gallery, with a before/after toggle](../output/playwright/visual-review/index.html)
- [Original app captures](../output/playwright/visual-before/)
- [Refined app captures](../output/playwright/visual-after/)
- [Compact-phone captures](../output/playwright/visual-compact/)
- [Taller-phone captures](../output/playwright/visual-tall/)
- [Installed Android app captures](../output/playwright/visual-android/)

The gallery contains all 24 proposal states. The screenshots are rendered by the production React components with fixed Alex/Sam/Mia/Ben state and isolated native-command fixtures in the test browser. Fixtures are never included in the app build. A separate multiplayer scenario exercises the live Rust backend and real party actions.

Verification completed: all 24 states fit the 390 × 750 comparison viewport, 360 × 700 compact viewport, and 430 × 880 tall viewport, with primary actions visible and no horizontal overflow. The 22-topic grid scrolls independently. The live four-player, two-round browser scenario passed; a four-player round also completed using the installed Android host and three certificate-pinned test peers, with native screenshots from hosting through final rankings. All 12 Rust tests passed. The mechanical design scan reported no findings, and the UI review reported no errors or warnings.

## Changes made

- Matched the heading scale, button heights, initials avatars, list separators, role cards, and spacing to the boards. Enlarged ordinary touch targets and retained visible keyboard focus.
- Removed the extra field from the initial host form. The Wi-Fi row expands when its label or settings need editing.
- Matched the host lobby's two actions and the guest lobby's topic summary. Guest management remains available by tapping a guest row; the row is a named control for accessibility.
- Featured the six categories shown in the proposal, with colored illustrations. All 22 topic packs remain available through the scrolling grid and optional search.
- Moved the imposter badge above its heading, matched the secret panel's dimensions, enlarged the word, and restored the sage/terracotta paw illustrations and rays.
- Added separate landscape secret-card artwork for discussion and a textured envelope for locked votes. Restored the connected progress dots, neutral waiting button, and personal result composition.
- Matched the Drink/Dare choices, curved dare-giver arrow, ceramic cup, ranking rows, filled trophy/crown, and restrained final confetti.
- Kept primary actions visible on smaller phones. Topic scrolling is contained independently of its Save action.
- Added player-arrival motion, punishment crossfades, and the upward runoff transition. Existing role flips, result reveals, sheets, and score settling remain. Reduced-motion mode is respected.

## Functional differences from illustrative images

The app displays actual party names, readiness, voting progress, words, hints, scores, and real invitation QR codes. A real QR can be denser than the illustrative board and can be enlarged. Camera imagery comes from the player's camera after permission; the app never displays a staged QR photo as a live preview. Manual scan/cancel and invitation entry remain available. Help and ending/leaving controls remain accessible during a round.

The category labeled **Psychology** uses the authored mind/memory pack; **Sex education** uses the sexual-health pack. Body/puberty, consent, relationships, emotions, and social behavior remain separate packs. This changes display labels and order, not the word/hint pairs or game rules.

## Reproduce screenshots

Start the preview backend and frontend as described in `../README.md`. With Playwright CLI available:

```powershell
npx --package @playwright/cli playwright-cli -s=visual open 'http://127.0.0.1:1428/?capture=after'
npx --package @playwright/cli playwright-cli -s=visual run-code --filename=scripts/visual-capture.js
node scripts/visual-gallery.mjs
```

Use `?capture=compact&width=360&height=700` or `?capture=tall&width=430&height=880` for other viewport sizes. The fixture runner reports page height and horizontal overflow for every screen. The scrolling topic grid is intentional. Use `scripts/ui-smoke.js` for live multiplayer verification.

## New production artwork

Both assets were generated with the built-in image generation tool from the approved voting board, then saved into the app. No reference screenshots are embedded as app screens.

- `../public/art/vote-envelope.png`: one front-facing, closed charcoal paper envelope with a triangular flap, fine natural paper texture, rounded corners, transparent background, and small natural shadow. The reference is the third phone on board 4. No check, seal, text, rays, or UI was generated; the interactive check badge and rays are drawn separately by the app.
- `../public/art/discussion-cards.png`: a compact fan of three landscape paper cards, with a wide charcoal front card rotated slightly counterclockwise, ivory eyes looking right, and sage/terracotta cards behind it. The reference is the first phone on board 4. Transparent background, tactile paper, soft corners and shadow, no text or UI. Portrait cards remain the welcome and concealed-role artwork.
