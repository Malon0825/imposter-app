# Topic voting mockup prompts

Built-in ImageGen; three independent screen images. Design reference: existing app screenshots and DESIGN.md. No source app code changed.

## 1. Topic ballot

Output: `01-topic-ballot.png`

```text
Use case: ui-mockup. Generate a polished, readable new Android-first mobile screen concept for the existing local party game IMPOSTER. This is one screen in a three-screen feature flow, not a redesign.
LOCKED DESIGN SYSTEM: charcoal app background #141916, slightly lighter flat surfaces #1C211E, thin borders #343D35, warm ivory text #F4F1E8, muted sage secondary text #B4C8AD, vivid soft lime #D6F56B only for selected states and the primary action. Terracotta #D98672 is a tiny illustration accent, not an error on this screen. Typography matches DM Sans: round modern grotesk, bold large headings 32–36 logical px, body 17–18 px, tile titles 20 px, buttons 20 px. Broad generous spacing, 16 px card and button radii, 60 px tall lime primary button, 48 px secondary targets. This theme is warm, quietly playful, mature, tactile and clear. Illustrations are simple custom filled paper-cut shapes: ivory mug, muted ochre pizza slice with terracotta pepperoni, clay-brown paw, sage leaves, sage/ivory film clapper, sage music notes. No emoji glyphs, no glossy 3D, no photoreal food.
FRAMING: portrait 1:2 canvas, one full front-facing slim black Android phone with subtle narrow bezels, consistent size, restrained rounded corners. App content uses a normal 390x844 logical-pixel viewport. Phone almost fills the canvas, with clean even outer margins against #0E120F. No hands or environmental props. No decorative poster text outside the phone. No simulated OS clock, no notifications, no iPhone Dynamic Island. The device frame supports the content. Readable exact UI text and believable touch spacing matter most.
No bottom tabs, no gradients, no glass effects, no large shadows, no charts, no timer, no secret word, no imposter hint, no role information. Use an extremely subtle matte texture only if it does not reduce text sharpness. This is a real functional app screen, not a website in a phone. All specified text must be rendered verbatim, once, cleanly.
SCREEN 1 OF 3 — PERSONAL MULTI-SELECT TOPIC BALLOT, BEFORE ROUND 3. Voting is still open. This player's two selected topics are Food and Animals. Four of six other participants' ballot slots are already submitted in total; the current player has not submitted yet. Do not show any live topic vote counts.
LAYOUT from top to bottom:
1. Quiet compact top app bar with centered text "Round 3 · Topic vote"; a small ivory back arrow on the left, an ivory search icon on the right.
2. Left-aligned bold ivory heading "Choose the mood" on one line if possible; below it sage sentence "Pick one or more. Each gets 1 vote." Keep it to two comfortable lines at most.
3. Familiar two-column topic tile grid with three visible rows, equal tile dimensions, 10–12px gutters. Row 1: "Everyday" with an ivory mug, "Food" with pizza illustration. Row 2: "Animals" with brown paw, "Nature" with sage leaves. Row 3: "Movies" with filled clapper, "Music" with music notes. Food and Animals have a crisp lime 2px outline and lime filled circular check at the upper-right. All other tiles have subtle neutral borders and no check. Each tile's illustration is above its title. These are six visible items from a scrollable topic grid, with a very subtle scroll affordance at the right. No topic tallies, no 24-word labels, no opt-in badges on these six normal topics.
4. Below the grid, a centered understated submission progress row: six small circles connected with a fine dashed sage line, first four filled lime and last two outlined. Under or beside it legible sage text "4 of 6 players voted".
5. Sticky bottom action area integrated into the background with comfortable safe-area spacing. Centered small-but-readable sage text "2 topics selected". A full-width lime button with dark bold text "Lock my vote". Beneath button a quiet sage line "Results appear when everyone votes."
Fit all primary elements comfortably in the phone with no cutoff or overlapping. The grid is the visual focus, and the bottom button remains fully visible.
```

## 2. Tied topic results

Output: `02-tied-topics.png`

```text
Use case: ui-mockup. Generate a polished, readable new Android-first mobile screen concept for the existing local party game IMPOSTER. This is one screen in a three-screen feature flow, not a redesign.
LOCKED DESIGN SYSTEM: charcoal app background #141916, slightly lighter flat surfaces #1C211E, thin borders #343D35, warm ivory text #F4F1E8, muted sage secondary text #B4C8AD, vivid soft lime #D6F56B only for selected states and the primary action. Terracotta #D98672 is a tiny illustration accent, not an error on this screen. Typography matches DM Sans: round modern grotesk, bold large headings 32–36 logical px, body 17–18 px, tile titles 20 px, buttons 20 px. Broad generous spacing, 16 px card and button radii, 60 px tall lime primary button, 48 px secondary targets. This theme is warm, quietly playful, mature, tactile and clear. Illustrations are simple custom filled paper-cut shapes: ivory mug, muted ochre pizza slice with terracotta pepperoni, clay-brown paw, sage leaves, sage/ivory film clapper, sage music notes. No emoji glyphs, no glossy 3D, no photoreal food.
FRAMING: portrait 1:2 canvas, one full front-facing slim black Android phone with subtle narrow bezels, consistent size, restrained rounded corners. App content uses a normal 390x844 logical-pixel viewport. Phone almost fills the canvas, with clean even outer margins against #0E120F. No hands or environmental props. No decorative poster text outside the phone. No simulated OS clock, no notifications, no iPhone Dynamic Island. The device frame supports the content. Readable exact UI text and believable touch spacing matter most.
No bottom tabs, no gradients, no glass effects, no large shadows, no charts, no timer, no secret word, no imposter hint, no role information. Use an extremely subtle matte texture only if it does not reduce text sharpness. This is a real functional app screen, not a website in a phone. All specified text must be rendered verbatim, once, cleanly.
SCREEN 2 OF 3 — PUBLIC TOPIC RESULTS WITH TWO TIED LEADERS, HOST VIEW. All six people have voted. Food and Animals each received four approval votes. Everyday received two and Music received one. Because players could choose multiple topics, these counts total eleven approvals from six people. The two tied leaders each have exactly a 50% chance in the upcoming draw. The percentage describes draw probability, not vote share.
LAYOUT from top to bottom:
1. Compact centered app bar "Round 3 · Topic result". Small ivory back arrow at left.
2. Left-aligned bold ivory heading "It's a tie." Large but comfortable. Sage text underneath "Food and Animals lead with 4 votes each."
3. Two equally emphasized wide flat topic rows stacked with a 12px gap. Each has dark surface #1C211E, identical thin lime border, 16px radius and generous padding. First row: custom filled pizza illustration at left, ivory bold title "Food", sage sublabel "4 votes". At the far right large lime "50%" and smaller sage "chance". Second row exactly the same size, styling and emphasis: brown paw, title "Animals", sublabel "4 votes", large lime "50%", sage "chance". Equal spacing and equal font sizes; neither topic is styled as winner.
4. After breathing room, small sage section label "Also voted". Two plain flat rows with fine separators, no extra enclosing card: "Everyday" at left and "2 votes" at right; "Music" at left and "1 vote" at right. These lower-scoring topics are neutral with no lime highlight.
5. Quiet centered status "6 of 6 players voted". Below it short sage explanation "Only tied leaders enter the draw." with clear readable type.
6. Sticky footer full-width lime button with dark bold label "Draw topic". Small sage footer line "Equal chance. One draw."
No spinner or wheel, no fake roulette slices, no selector, no vote editing, no redraw button. The app chooses randomly among the tied leaders when the host reveals the draw. Preserve generous whitespace and the calm playful theme.
```

## 3. Selected topic

Output: `03-chosen-topic.png`

```text
Use case: ui-mockup. Generate a polished, readable new Android-first mobile screen concept for the existing local party game IMPOSTER. This is one screen in a three-screen feature flow, not a redesign.
LOCKED DESIGN SYSTEM: charcoal app background #141916, slightly lighter flat surfaces #1C211E, thin borders #343D35, warm ivory text #F4F1E8, muted sage secondary text #B4C8AD, vivid soft lime #D6F56B only for selected states and the primary action. Terracotta #D98672 is a tiny illustration accent, not an error on this screen. Typography matches DM Sans: round modern grotesk, bold large headings 32–36 logical px, body 17–18 px, tile titles 20 px, buttons 20 px. Broad generous spacing, 16 px card and button radii, 60 px tall lime primary button, 48 px secondary targets. This theme is warm, quietly playful, mature, tactile and clear. Illustrations are simple custom filled paper-cut shapes: ivory mug, muted ochre pizza slice with terracotta pepperoni, clay-brown paw, sage leaves, sage/ivory film clapper, sage music notes. No emoji glyphs, no glossy 3D, no photoreal food.
FRAMING: portrait 1:2 canvas, one full front-facing slim black Android phone with subtle narrow bezels, consistent size, restrained rounded corners. App content uses a normal 390x844 logical-pixel viewport. Phone almost fills the canvas, with clean even outer margins against #0E120F. No hands or environmental props. No decorative poster text outside the phone. No simulated OS clock, no notifications, no iPhone Dynamic Island. The device frame supports the content. Readable exact UI text and believable touch spacing matter most.
No bottom tabs, no gradients, no glass effects, no large shadows, no charts, no timer, no secret word, no imposter hint, no role information. Use an extremely subtle matte texture only if it does not reduce text sharpness. This is a real functional app screen, not a website in a phone. All specified text must be rendered verbatim, once, cleanly.
SCREEN 3 OF 3 — THE PUBLIC TOPIC HAS BEEN CHOSEN FOR ROUND 3, HOST VIEW. The fair 50/50 tie draw between Food and Animals selected Food. Show only the topic, never an actual secret word or role.
LAYOUT from top to bottom:
1. Compact top bar centered "Round 3 · Topic chosen". Small ivory back arrow at left.
2. Calm centered large bold ivory heading "Food it is." Below it muted sage sentence "The topic for this round."
3. The main focal point is one large warm ivory #F4F1E8 rounded card, nearly the full content width, about 270 logical px tall. It rests straight, with no heavy shadow, no nested card. On the card, a large charming paper-cut pizza slice in muted ochre and terracotta, with small dark olive details. Under the illustration large dark charcoal bold word "Food". Beneath it smaller dark muted text "4 votes · Won the 50/50 draw". An understated small lime check seal overlaps the card edge or sits just above it, with two tiny lime/sage celebratory rays. Avoid big confetti.
4. Beneath the card with substantial comfortable whitespace, a short centered ivory line "Everyone plays this topic." Then sage line "Your private card comes next." This text makes clear the topic is public and the next step is a private role card.
5. Near the bottom a quiet secondary text action "View votes".
6. Sticky footer with full-width lime primary button, bold dark text "Continue to roles". Respect bottom safe area and 60px minimum button height.
No repeated list of topics, no secret word such as Pizza, no hint, no role badge, no opt-in labels, no resampling or change-topic control. An illustration can depict a pizza because it represents the Food category, but the only topic name on the card is Food. The visual tempo is calmer and more celebratory than the ballot and tie result screens, while clearly the same app and device.
```
