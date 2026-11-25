# Imposter app revamp — mockups v1

Status: design for review, 2026-11-25, on branch `claude/power-cards`. Nothing is implemented. The approved base system in [DESIGN.md](../../DESIGN.md) still applies; this set proposes a theme on top of it.

## What this is

Every screen of the app (41) in the **noir case-file** theme, in play order. That's 29 reworked app screens plus the 12 power-card screens from [design/power-cards-v1](../power-cards-v1/README.md). It's meant to be reviewed before implementation starts.

- **PNGs:** `NN-<screen>.png` in this folder (390×844, 2×).
- **Gallery:** start the `power-cards-mockups` preview (python http.server on `design/`, port 8800) and open `http://localhost:8800/app-revamp-v1/mockup/`. Screens are grouped by act, and each has a note.
- **Re-render:** `bash design/app-revamp-v1/mockup/capture.sh` (headless Chrome, with the preview running).
- **Live motion:** the draw (two taps, sealed card, idle spin), the Golden announcement and the results replay are interactive demos in the power-cards gallery: `http://localhost:8800/power-cards-v1/mockup/`.

## The theme, in one paragraph

Keep the approved palette, type and layouts. Charcoal, ivory, lime actions, terracotta danger, DM Sans with Anton display, the engraved role art and 16px radii all stay. Add a 1940s–50s detective-case layer only where it carries meaning:

- typewriter labels (Special Elite)
- rubber stamps (CLASSIFIED, READY, GUILTY, CASE CLOSED)
- kraft paper for forms, files and notes
- mugshot frames and a height chart
- a Wanted poster for the leader, and a newspaper for the end of the night

Body text, buttons and anything you have to read quickly stay as they are.

## Screens

| Act | Screens |
|---|---|
| 1. Getting in | 01 Welcome · 02 Host: open a case · 03 Host: stay connected · 04 Host lobby · 05 Session settings · 06 Guest: find the party · 07 Guest: same Wi-Fi · 08 Guest: your name (booking photo) · 09 Guest lobby |
| 2. The round begins | 10 Rule draw · 11 Rule revealed · 12 Topic vote · 13 Topic chosen · 14 Draw window ◆ · 15 Sealed draw ◆ · 16 Your role · 17 Card face down · 18 Your word · 19 Imposter's hint · 20 Waiting for everyone |
| 3. Discussion | 21 Discussion ◆ · 22 Hand ◆ · 23 Card detail ◆ · 24 Confirm ◆ · 25 Golden announcement ◆ · 26 Private read ◆ · 27 Host: round settings |
| 4. The vote | 28 Ballot line-up ◆ · 29 Vote locked |
| 5. Results | 30 Your result (beat) · 31 Your result · 32 The room · 33 Cards this round ◆ · 34 Report a rule-break |
| 6. Drink or Dare | 35 Drink or Dare · 36 The dare giver |
| 7. End of the night | 37 Standings ◆ · 38 Session complete · 39 Story of the night ◆ |
| 8. Anywhere | 40 Reconnecting · 41 How to play |

◆ = power-card screen.

## Art

All 34 card illustrations and the card back are done (Astra). The rest of the app needs 43 more pieces, listed in [ART-BRIEF.md](ART-BRIEF.md) as A1–A12 (plus an optional app icon). Each one has a dashed **ART · A#** frame in the screens showing its size and context. Delivered files in `art/` replace the frames automatically.

Before shipping, the app needs compressed WebP versions of all art. The source PNGs are about 46 MB for the cards alone, and browser guests load everything from the host over Wi-Fi.

## Decisions (2026-11-25)

- The 41 screens and the spin feel are approved.
- The theme ships together with power cards.
- Sound (`design/sound-v1`) is approved and ships too.
- Card rules and role guidance come from Power Card Review v11 (see the power-cards README §10).
- Build plan: [power-cards-v1/IMPLEMENTATION-PLAN.md](../power-cards-v1/IMPLEMENTATION-PLAN.md).
