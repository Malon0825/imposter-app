# Power cards — UI/UX design brief v1

Status: approved for implementation, 2026-11-25 (screens, theme and sound). Rules come from `outputs/01a208a3-…/Power Card Review v11.xlsx` (37 cards: 15 Common, 12 Rare, 10 Golden; 6+ players only). The mockups still show the v10 deck; §10 lists what v11 changes on screen.

## 1. What we are designing for

- **A drinking party, not a tournament.** People are standing, holding a drink, half-watching their phone. Everything important must read in one glance from arm's length, and every tap target stays at the approved 48–60px.
- **The moment is the product.** The goal is that people retell a card play the next day. The UI spends its drama budget on four beats: **draw**, **announce**, **reveal at results**, and the **Story of the night**. Everything else stays calm and uses the screens that already work.
- **A card game inside the existing app, not a new app.** Keep the approved system in [DESIGN.md](../../DESIGN.md): charcoal and ivory, lime actions, terracotta danger, DM Sans with Anton display headings, and the engraved role art. Cards borrow the genre's proven language (rarity frames, a card back, a hand, a play log, an end-of-match recap) and none of its expensive or error-prone parts.

### Proven patterns we use

| Pattern | Where it's proven | How we use it |
|---|---|---|
| Rarity shown by frame colour and finish | Collectible card games and loot games | Common is ivory paper, Rare is sage-blue foil edge, Golden is a gold frame with a slow sheen. Players read the tier before the text. |
| Pack-opening reveal | Card packs in digital card games | The card back drops in, a tier-coloured glow leaks from its edge, then it flips (420ms, the app's existing card reveal). |
| A hand you open on demand | Mobile card games on small screens | The hand lives behind one header button and a bottom sheet, not a permanent tray competing with the round's main action. |
| Tap to select, confirm to play | Mobile card games, one-handed play | No drag-to-play: dragging fails with a drink in one hand. Tap a card, read it, tap Play, confirm. |
| A battle log | Card and strategy games | A Plays strip during the round: who played what tier, in order. |
| An end-of-match recap | Party and match-based games | Results replay this round's cards; the session ends with the Story of the night. |

### What we don't build

Drag-and-drop, 3D card physics, WebGL or canvas effects, particle storms, private haptics, card collection or crafting, and 34 bespoke illustrations up front. All motion uses `src/motion.ts` tokens and `src/motion-ui.tsx` components, and every effect has a reduced-motion version.

## 2. Privacy rules the UI must keep

1. **Hands are secret, plays are public.** Other players only ever see a card back, an owner's name and a tier. Card faces appear only on the owner's phone, and at results.
2. **No private signals anyone else can sense.** No vibration or sound on your own draw or private reveal: a buzz when someone draws a Golden would leak it across the table. Haptics, if added, fire only on public beats that every phone gets at the same moment.
3. **Conceal like the role card.** The hand sheet and every private effect panel (Private Eye, X-Ray, Master Key, Borrowed Hint, Word Count, Wiretap) hide on backgrounding and need an explicit reveal on return, the same guard as the private role card. Screenshots stay blocked while a face is showing.
4. **The collapsed hand shows backs.** A phone lying on the table shows "3 cards", never which three.
5. **The tier is yours to show, the card is not.** A draw lands **sealed**: the drawer's phone shows the tier (frame colour, rays, the slammed word), so a Golden drawer can hold the phone up to the table. Which card it is stays hidden until a second tap. Other phones only ever see "Maya drew". The sealed beat takes the same time for every tier, so the length of the animation never gives it away.

## 3. Card anatomy

One portrait card component in three sizes, ratio 5:7.

| Size | Use | Shows |
|---|---|---|
| Full (about 300×420) | Draw reveal, card detail, results replay | Everything below |
| Hand (about 96×134) | Hand sheet grid | Frame, glyph, name, window chip, playable state |
| Chip (about 28×40) | Plays strip, announcements, standings | Card back or face in tier colour |

**Front, top to bottom**
- **Tier frame.** Common: ivory paper, sage hairline. Rare: ivory with a sage-blue foil edge. Golden: charcoal face, gold frame, a 4-second sheen while visible (paused when hidden or with reduced motion).
- **Window chip**, top left: Role reveal, Discussion, Ballot or Passive, each with its own icon. It turns lime when the card can be played right now.
- **Glyph**, centre: a single line icon in the existing `icons.tsx` style for Common and Rare. The 10 Golden cards get engraved illustrations in the style of the role posters. That's 10 pieces of art, not 34, and only the stars get them.
- **Name** in Anton caps; **effect** in DM Sans, at most two lines, using the card text from v11.
- **Footer:** Active or Passive, and the card's limits ("Imposter can't play").

**Back:** charcoal with the app's eye motif and a thin tier-neutral border. It's identical for every tier, so a back never leaks rarity.

**States:** playable now (lime outline and a soft pulse), not now (60% opacity, window chip says when), blocked this round (you already played a card, so it greys out with "Next round"), and spent (leaves the hand with a 200ms fade).

## 4. Where it fits in the round

The round already moves rule reveal → topic vote → roles → discussion → voting → results → reports → Drink/Dare → standings. Power cards add **one new phase** and otherwise layer onto existing screens.

```
rule reveal → topic vote → topic chosen → DRAW (new, untimed) → roles → discussion → voting → results → …
                                            │                └────── hand + plays strip ──────┘
                                            └ Underdog badges, Golden chance, Free/3 pts
```

The draw phase is host-scheduled like the rule reveal: the host owns the deadline, and late or reconnecting phones join the current beat at rest rather than replaying it. Phones poll every 600ms, so announcements land within about a second on every phone.

## 5. Screens

Each screen below is a mockup to produce for approval (section 8).

### 5.1 Draw window (new phase)

Everyone sees it at the same time, right after the topic is chosen.

- **Header:** "Draw a power card?" with a 10-second ring timer (it ends on Skip by itself).
- **Your status:** current points, price (**3 points**, or a lime **Free · Underdog** badge), paid draws left (2 of 4), and **Golden chance 14%** in a gold pill. The Golden chance is private, so it shows only on your phone.
- **Actions:** a big lime **Draw** and a secondary **Skip**. Draw is disabled with the reason when you can't afford it or have no draws left. In round 1, everyone has 0 points, so the screen shows a one-line "Draws open after the first round" instead.
- **The table strip:** every player's avatar along the bottom, filling with a small card back as they draw. This is public, so everyone sees who's buying: the first social moment of the round.
- **Two taps: draw, then reveal (your phone only).**
  1. **Draw.** The button squashes and the deck shudders. A card spins out of the deck (a flat spin, so no face ever shows), overshoots and lands with an impact: a little shake, a shockwave ring and dust sparks.
  2. **Sealed.** The card's frame ignites in its tier colour with a light sweep, a flash, sparks and, for Rare and Golden, rays. The tier word slams in letter by letter ("GOLDEN"). The card then idles: it rests, does a slow showcase spin (both sides are sealed backs, so the face never shows), floats and breathes. "Tap the card to reveal it · Show it off, nobody can tell which Golden it is." **Keep it sealed** sends it to the case file to reveal later.
  3. **Reveal.** Tap the card: the spin eases home to the front, the card tenses and shivers, then flips with an overshoot. A white flash, shockwave and spark burst hit at the edge-on moment, and the art and name pop in. **Add to my case file** rises.

### 5.2 Hand button and hand sheet

- **Hand button** in the header next to the existing icons: a small fan of card backs with a count badge. It appears on the roles, discussion and voting screens.
- **Playable nudge:** when a held card's window opens, the button gets a lime ring and a one-line chip slides in under the header: "You can play a card now". It never covers the screen's main action.
- **Hand sheet** (the existing sheet motion): a 3-across grid of hand-size cards in the order drawn, which also shows passive priority. Above the grid sit one-line rules ("1 active per round", and "Passives wait if you play an active"). Tapping a card opens the detail view.

### 5.3 Card detail and play

1. **Detail:** the full-size card on a dimmed backdrop, the effect in large text, and either **Play** (lime, only in the card's window) or a disabled pill that says when it can be played.
2. **Target picker**, if needed: reuse the ballot's player rows (avatars, flat dividers, the cleared-player style for invalid targets).
3. **Confirm sheet**, every time: it shows the exact public line ("Everyone will see: **Alex played a Rare card**") and any visible side effect ("Everyone will see you give your clue last"). **Play card** is the primary action and **Keep it** the secondary. This is where a drunk misplay gets caught.
4. **Play motion:** the card lifts, shrinks into a chip and flies to the Plays strip as the announcement fires everywhere.

### 5.4 Announcements (every phone)

- **Common or Rare:** a banner drops under the header for 2.5 seconds: avatar, "**Maya** played a **Rare** card", and a tier-framed card back. It doesn't block input, so someone typing a clue isn't interrupted.
- **Golden:** a 1.2-second takeover. The screen dims, a gold-framed card back spins in with "**Maya** played a **GOLDEN** card" in Anton, the rays burst once, and then it collapses into the normal banner. This is the moment Astra called the strongest in the design, so it gets the biggest treatment and appears on every phone at once.
- **Plays strip:** under the discussion and ballot headings, a horizontal row of chips (avatar plus tier back) in play order. Tapping a chip shows "Maya · Rare · Discussion" and nothing more. It's the round's battle log.
- **Public effects** get their own card on the discussion screen: Anonymous Tip ("Someone suspects **Ben**"), Cover Story ("**Eve** claims: Detective — check at results"), On the Record, Spotlight ("**Kai** is on the civilian side"), and Put on the Spot ("**Sam**, one more clue"). They use the landscape discussion-card style from DESIGN.md.

### 5.5 Private effect panels

Private Eye, X-Ray, Master Key, Borrowed Hint, Word Count and Wiretap open the ivory secret panel used for the word card, with the same hold or tap to reveal and the same concealment. Each panel says what it shows in one line ("Ben: civilian side · Cleo: Imposter's side"). It stays available from the card's spot in the hand (marked spent) until the round ends, so the owner can check it again.

### 5.6 Ballot additions

- **Your ballot's weight:** after a Heavy Vote or Golden Ballot, a pill on your selected row reads "×2", "×3" or "×4".
- **Underdog bet:** the stake control unlocks 3 even with a low balance, tagged **Underdog**, with a terracotta note: "Lose a bet you can't cover → Drink/Dare."
- **Cold Feet:** after you lock, the envelope screen keeps a "Change bet" control (once) until the last ballot locks. Hidden for the last player still to vote.
- **Ballot cards ride with the vote:** a "Play a card" slot on the ballot; the card is sent in the same action as the vote. Second Opinion and Pocket Veto reuse the accomplice-pick chip row (backup suspect, vetoed player).

### 5.7 Results

- **Last Word** (a caught Imposter holding it): before the personal beat, that phone alone shows a private "Guess the word" sheet with a short timer. Everyone else sees the envelope breathing a little longer.
- **Your result:** card awards join the breakdown list as lines with a tier chip ("Jackpot +4", "Shadow (Ben) +5", "Bounty +2").
- **Cards this round** (new beat in the room results, before Everyone's results): the round's card chips turn face up one at a time in play order, 600ms each, each with its owner and outcome ("Maya — Golden — **Bluff Card**. Nothing happened."). This is the punchline of every announcement. The host can tap to skip.
- **Bounty:** when it pays, a banner on the room's verdict reads "**Bounty claimed** · +2 to every Underdog".

### 5.8 Standings

- **Leader:** a Bounty badge with its current value (+1 to +3).
- **Underdogs:** a small lime "Underdog" tag next to their score, which explains why their next draw is free.
- **Who holds cards:** a hand count per player (backs only). Golden chance and hand contents stay private.

### 5.9 Story of the night (session complete)

After the final standings, one scrollable recap that's safe to screenshot (no private content):

- **Highlights:** Golden moments (every Golden play and what it did), **Biggest swing** (the play that moved the most points), **Best bluff** (a Bluff Card that looked Golden, or a Cover Story nobody caught), and **Comeback** (the Underdog who climbed furthest).
- **Timeline:** every card played, by round, with owner and effect, in a long list of the chip-plus-line style.

This is the screen people will post in the group chat the next day.

### 5.10 Lobby and settings

The session settings get a **Power cards** toggle. It's disabled below 6 players with the reason "Needs 6 or more players". Changes apply from the next round, the same deferred behaviour as random rules.

## 6. Motion

All timings reuse the existing tokens. New beats only:

| Beat | Motion | Reduced motion |
|---|---|---|
| Draw (tap 1) | 260ms button squash, 720ms flat spin out of the deck with overshoot, impact shake 5px, ring, dust | Sealed card shown at rest |
| Sealed tier tease | Frame ignites (650ms), light sweep, tier flash, ring, sparks (Common 10, Rare 22, Golden 46), shake 3/5/9px, rays for Rare and Golden, tier word slams letter by letter | Static tier frame and word |
| Sealed idle | 3.6s loop: 1.6s rest, then one 360° showcase spin with the gloss sweeping; 2.4s float; glow breathes; rays turn slowly | Still card |
| Reveal (tap 2) | Spin eases home, 300ms wind-up shiver, 520ms flip with overshoot, white flash, ring, sparks, shake; art pops (480ms), name settles | Face shown immediately |
| Card to hand | 240ms shrink and move to the header button | Instant |
| Playable nudge | Lime ring, one 1.1s breath (the envelope breath), then rests | Static ring |
| Common or Rare banner | Drops in 200ms, holds 2.5s, leaves 180ms | Appears and disappears without movement |
| Golden takeover | About 2.6s: dim and blur, card drops spinning from above and slams (shake 11px, gold flash, ring, 50 sparks, rays), name slides in, "GOLDEN CARD" slams letter by letter, then the card flies into the Plays strip with a spark trail and the chip pops; banner follows | Static card and words, then the banner |
| Results replay | Cards dealt face down from the right (110ms stagger), then one by one: flip with overshoot, outcome slides in, stamp slams (scale 3→1) with a row shake and ink ring; Golden adds sparks and the points count up; PAID slams on the Bounty note last | All faces, stamps and numbers shown at once |
| Golden sheen | 4s loop while visible, paused in the background | None |

## 7. Build feasibility

- **Front end:** React and CSS only, with the existing sheet, check and envelope components. The card component is one new piece with three sizes and four states. The rarity frames are CSS: gradients for the foil edge, and an animated gradient mask for the gold sheen.
- **Art:** 10 Golden illustrations and 1 card back in the role-poster style. Common and Rare use line glyphs (17 + 7 icons).
- **State:** one new host phase, `draw`, with a deadline like `rule_reveal`. Plays and announcements go out in the existing revisioned state, which phones poll every 600ms.
- **Verification:** extend `scripts/visual-capture.js` to the new screens at 360×700 and 390×844, add a draw→play→results run to the live round smoke test, and check reduced motion and concealment the way `scripts/motion-check.js` does today.

## 8. Mockups for approval

The 12 screens are built in HTML/CSS with the app's own colours, fonts and spacing (`mockup/`), then rendered to PNG at 390×844 (2× density) in this folder. They carry the noir case-file theme and role guidance described in §9. Golden art and the card back are Astra's ([ART-BRIEF.md](ART-BRIEF.md)). Common and Rare cards show line glyphs until their illustrations land in `art/` (see the brief's addendum). Files dropped into `art/` replace the placeholders automatically.

- **Gallery and motion demos:** start the `power-cards-mockups` preview (python http.server on `design/`, port 8800) and open `http://localhost:8800/power-cards-v1/mockup/`. Three demos run the key beats at real speed. The draw demo is interactive: tap Draw, then tap the sealed card, or use the auto buttons. It has a Golden, Rare and Common variant. The other two are the Golden announcement and the results replay.
- **Re-render the PNGs:** `bash design/power-cards-v1/mockup/capture.sh` (headless Chrome, with the preview running).
- **One scenario throughout:** round 5 of a 6-player party, target 20. Alex is the viewer, an Underdog, and the Judge this round. Kai plays Midas Touch, Maya's Bluff Card is announced as Golden, and Cleo leads, gets caught, and pays the Bounty. Screen 2 shows Alex's sealed Golden draw (Master Key once revealed), and screen 8 shows a Private Eye read from another round.

| # | Screen | File |
|---|---|---|
| 1 | Draw window: timer, Free · Underdog price, private Golden chance, who's drawing | [01-draw-window.png](01-draw-window.png) |
| 2 | Draw, step 1: the sealed Golden, ready to show off, before the reveal tap | [02-draw-sealed-golden.png](02-draw-sealed-golden.png) |
| 3 | Discussion: hand button, playable nudge, Plays strip, the anonymous tip as a typed note | [03-discussion-hand-plays.png](03-discussion-hand-plays.png) |
| 4 | Hand as the round's case file, with Good / Weak for you badges | [04-hand-sheet.png](04-hand-sheet.png) |
| 5 | Card detail: your role's tip on an evidence tag, and the six-role strip | [05-card-detail.png](05-card-detail.png) |
| 6 | Confirm: the public line, the visible side effect and your role fit | [06-confirm-play.png](06-confirm-play.png) |
| 7 | Golden announcement on every phone: "Evidence #3 entered · contents sealed" | [07-golden-announcement.png](07-golden-announcement.png) |
| 8 | Private read as a CLASSIFIED file | [08-private-eye-result.png](08-private-eye-result.png) |
| 9 | Ballot as a line-up: Heavy Vote ×3 for the Judge, Underdog bet | [09-ballot-heavy-vote-underdog.png](09-ballot-heavy-vote-underdog.png) |
| 10 | Results: evidence review, with a stamp on each card, and the Bounty marked PAID | [10-results-cards-replay.png](10-results-cards-replay.png) |
| 11 | Standings: Wanted poster for the leader, Long shot stamps for Underdogs | [11-standings-bounty-underdog.png](11-standings-bounty-underdog.png) |
| 12 | Story of the night: *The Imposter Times* front page | [12-story-of-the-night.png](12-story-of-the-night.png) |

## 9. Theme and role guidance

- **Role guidance.** Each held card shows how it fits the role you hold this round: **Good for you**, **Fine**, or **Weak for you**. The card detail adds your role's one-line tip on an evidence tag, plus a strip of all six roles rated Best, Fine or Worst. The confirm sheet repeats the fit. It's private like the rest of the hand, and it guides without blocking: a Weak play can still be a bluff. The data is the Role guide sheet (every card × 6 roles, a rating and a tip). Rate cards against [ROLE-MECHANICS.md](ROLE-MECHANICS.md), which records what each role's ballot really does at a 6+ table.
- **Noir case file.** A theme over the approved palette and layouts, used only where it carries meaning:
  - the hand is the round's case file, and tips are evidence tags;
  - private reads are CLASSIFIED files, and the ballot is a line-up;
  - results are an evidence review with stamps, and the Bounty leader gets a Wanted poster;
  - Underdogs get a "Long shot" stamp, and the night ends with a newspaper front page and titles worked out from what happened.
- **Fonts.** Special Elite (Apache-2.0, `@fontsource/special-elite`) is the typewriter face, used only for labels, stamps and the newspaper. Body text stays DM Sans; headings stay DM Sans and Anton.

The build plan is [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). The art also needs WebP versions for the app (about 21 MB of PNG today; browser guests load everything from the host over Wi-Fi).

## 10. v11 rule changes that touch the screens

The v11 sheet adds a tier ladder: when two cards clash, Golden beats Rare, Rare beats Common, and between equals the first one played wins. Screens to add or adjust during implementation:

- **Clash stamps (every phone, public):** BLOCKED ("Ben's card bounced off Alex"), OBJECTION! → SUSTAINED / OVERRULED (a sustained Bluff adds "It was a Bluff Card!"), and "One vote was VETOED". They use the existing stamp motion and the Common/Rare banner slot, and they're replayed in Cards this round and the Story of the night.
- **Anonymous Tip** appears when voting opens, not when it's played.
- **Put on the Spot** pins "Sam owes a clue" at the top of the clue board; the host's Open vote asks "Sam still owes a clue. Open anyway?".
- **Last Word** is a three-word choice sheet, not a text field.
- **Can't play:** hand badges gain a fourth state, "Can't play as <role>", and Play is hidden.
- **Role guidance** is one badge plus one line per card (a role note where the role changes the card, otherwise "When to play"); see the Role guide sheet.
- **New card art:** Lawyer Up, Objection! and Wiretap (Rare), plus Rare versions of Sealed Alibi and Pocket Veto (now vetoing someone else's ballot). Brief: [ASTRA-V11.md](ASTRA-V11.md).
- **Deck order:** Common and Rare draw first in, first out (used cards go to the back), so every card shows up before any repeats. No screen change; the order is host-only.
