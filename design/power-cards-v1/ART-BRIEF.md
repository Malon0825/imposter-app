# Power cards — art brief for the Golden illustrations

For: Astra (image generation). Owner: the power cards update on branch `claude/power-cards`.
Scope: **10 Golden card illustrations + 1 card back.** Common and Rare cards use line icons, so they need no art.

## Match the existing role art

Use the six role illustrations in [`design/full-cast-v1/art/`](../full-cast-v1/art/) as style references: attach `imposter.png`, `gambler.png` and `judge.png` to every generation. What makes that style:

- Engraved, pen-and-ink linework with fine cross-hatching, in the style of a 19th-century book illustration crossed with a modern graphic novel.
- Warm parchment fills (#E8D9BC to #F4F1E8) with black ink lines.
- **One** accent colour per piece. The role art uses sage green or terracotta. For Golden cards the accent is **gold** (#E9C46A, shading to #A87A22), used on the object that carries the card's power.
- Characters are knowing and theatrical: half-smiles, side glances, hands mid-gesture. It's a party game, and the art is in on the joke.
- No text, letters, numbers or logos anywhere in the image.

## Delivery spec

| | Golden illustrations | Card back |
|---|---|---|
| Size | 1254 × 1254 PNG | 1000 × 1400 PNG |
| Background | Transparent (RGBA), like the role art | Opaque |
| Framing | Subject centred. Everything important inside a centred circle of 80% width: the card shows the art inside a round emblem on a dark charcoal face, so corners are cropped | Symmetrical; works upside down |
| Reads on | Dark charcoal (#15130D). Keep the parchment fills so the art doesn't disappear on the dark face | — |
| File names | `golden-<card-name>.png`, for example `golden-master-key.png` | `card-back.png` |

Put the finished files in `design/power-cards-v1/art/`. The mockups pick them up from there, and the screens get re-rendered for approval.

## Shared prompt prefix

Start every prompt with:

> Engraved pen-and-ink illustration with fine cross-hatching, warm parchment fills, black ink linework, a single gold-leaf accent colour (#E9C46A) on the key object, in the style of the attached reference images. Transparent background. Subject centred and fully inside a circle of 80% of the image width. No text, letters, numbers or logos.

## The ten Golden cards

| # | Card | What it does | Picture |
|---|---|---|---|
| 1 | **Master Key** | Secretly read the real word | An ornate skeleton key held up between two fingers. The key's bow is shaped like an open eye. The gold is on the key; a faint glint suggests a keyhole beyond. |
| 2 | **X-Ray** | See one player's exact role | A sly figure peering through a large gold monocle. Through the lens, the face behind the mask they're looking at is visible. |
| 3 | **Golden Ballot** | Your vote counts as four | A hand pressing a sealed ballot envelope onto a pile of plain ones. The envelope's wax seal is gold and stamped with four small marks (no numerals). |
| 4 | **Crown Heist** | Win your round to match the leader | A gloved hand lifting a crown off a velvet cushion, with a grin half-visible in shadow at the edge. The crown is gold. |
| 5 | **Midas Touch** | Triple your points this round | A hand touching a playing card that turns to gold from the fingertip outward, gold flecks spreading across it. |
| 6 | **Golden Pardon** | Turn a loss into a win | A rolled royal pardon with a gold ribbon and seal, and a broken chain falling away beneath it. |
| 7 | **Turncoat** | Secretly join the Imposter's side | A figure shrugging on a cloak turned inside out: parchment outside, gold lining showing, and a masquerade mask tucked in the pocket. They're winking. |
| 8 | **Spotlight** | Show everyone one player's side | A theatre spotlight (gold) throwing a sharp cone of light onto a single empty chair. |
| 9 | **Shadow** | Copy every point another player earns | A figure walking away, and their shadow on the wall behind them is a different person holding a gold coin. |
| 10 | **Robin Hood** | Take 5 from the leader, share it with the Underdogs | A feathered cap and an arrow pinning a gold coin purse to a wooden post, with coins spilling out. |

Add the card's picture line to the shared prefix. Generate 2–3 variants per card, and pick the one whose subject still reads at 150px wide, the size of a card in the hand.

## Card back

> Symmetrical engraved card back, pen-and-ink with cross-hatching. A single open eye at the centre in sage green (#B4C8AD) linework, inside an ornamental frame of fine interlocking lines. Background deep charcoal (#171A18) with a subtle diagonal hatch pattern. Thin inner border. No text, no gold, no tier colour: the back must look identical for every card. Portrait 5:7.

The back must stay tier-neutral: the app shows the tier as a coloured border only where the tier is already public (announcements).

## Check before handing over

- [ ] The subject reads at 150px wide on a dark background.
- [ ] Nothing important outside the centred 80% circle.
- [ ] Gold is on the power object only; everything else is parchment and ink.
- [ ] No text or numerals anywhere, including on seals, cards and coins.
- [ ] Transparent background (illustrations); opaque charcoal (back).

---

# Addendum: Common and Rare illustrations

Added 2026-11-24: the owner wants every card illustrated, not only the Golden ones. That's **24 more pieces: 17 Common and 7 Rare.** The Golden set and the card back are done and approved; leave them as they are.

## Keep the three tiers apart at a glance

The tier should be readable from the art alone, before the frame:

| Tier | Subject | Colour | Framing on the card |
|---|---|---|---|
| Golden (done) | A character or scene, full engraving | Gold accent | Round emblem on a dark charcoal face |
| **Rare** | **One object or a hand with an object**, medium detail | Ink on parchment with **one foil-blue accent (#8FB3C9, shading to #46708A)** on the key object | Free-standing vignette on the **ivory** card face, no circle |
| **Common** | **One object**, simplest of the three, more open space | **Ink only**: black linework on parchment, with an optional faint sage wash (#B4C8AD). No gold, no blue | Free-standing vignette on the **ivory** card face, no circle |

All three share the same hand: engraved pen-and-ink with cross-hatching, matching `design/full-cast-v1/art/` and your Golden set. Attach two of your Golden pieces as style references alongside the role art.

**The noir theme.** The screens now use a crime case-file theme: evidence tags, Wanted posters, CLASSIFIED stamps, a newspaper recap. Draw the objects as if they were exhibits in a 1940s–50s detective case: hats, pocket watches, envelopes, tape recorders, dice, keys, desk lamps. Not modern objects.

## Delivery spec

| | Common and Rare |
|---|---|
| Size | 1024 × 1024 PNG |
| Background | Transparent (RGBA) |
| Framing | One centred subject, inside a centred square of 80%. No circle or border: the card provides it |
| Reads on | Ivory (#F4F1E8). Linework must stay dark enough to read on ivory at 104px wide, the hand-card size |
| File names | `common-<card-name>.png` and `rare-<card-name>.png`, all lowercase with hyphens, for example `common-late-arrival.png`, `rare-heavy-vote.png` |

Save to `design/power-cards-v1/art/`. The mockups pick the files up automatically.

## Shared prompt prefix

> Engraved pen-and-ink vignette with fine cross-hatching, black ink linework on warm parchment, in the style of the attached references. A single 1940s detective-case object, centred, with open space around it. Transparent background. No border, frame or circle. No text, letters, numbers or logos.

Then add **one** of these:
- Rare: *"One foil-blue accent (#8FB3C9) on the key object only."*
- Common: *"Ink only, with no accent colour (an optional faint sage wash is allowed)."*

## Common cards (17)

| Card | What it does | Picture |
|---|---|---|
| Late Arrival | Give your clue last | A pocket watch with a cracked glass, its hands just past midnight, and a fedora tossed beside it. |
| Opening Act | Give your clue first | An old ribbon microphone on a stand, tilted toward the viewer. |
| Put on the Spot | Force a player to give another clue | A single bare bulb hanging over an interrogation table, with one glass of water. |
| Anonymous Tip | Name a suspect anonymously | A folded note half slid under a door. |
| On the Record | Show and lock your vote | A reel-to-reel tape recorder with the reels mid-turn. |
| Word Count | See the word's letter count | A cloth measuring tape uncoiling across the frame. |
| Pocket Veto | Hold your vote back | A hand tucking a folded ballot slip into a coat pocket. |
| Cover Story | Claim any role | A disguise kit: a fake moustache and round spectacles resting on a fedora. |
| Sealed Alibi | Predict who gets accused | A wax-sealed envelope with a train ticket peeking out (the ticket blank). |
| Second Opinion | Name a second suspect | Two magnifying glasses crossed like swords. |
| Reshuffle | Trade for a new draw | Two hands mid-riffle, shuffling a deck of cards. |
| Cold Feet | Change your bet after locking | A pair of brogues with frost creeping up the toes. |
| Bluff Card | Fake a play | A comedy theatre mask held up in front of a frowning one. |
| Safety Net | Get 1 back on a lost bet | A circus safety net with a top hat caught in it. |
| Rain Check | A free bet next round | An umbrella sheltering a small stack of coins from the rain. |
| Clean Hands | +2 if right and unvoted | A pair of white gloves laid neatly on a table. |
| Cardboard Crown | Win an exact tie | A crown cut from cardboard, a little bent, patched with tape. |

## Rare cards (7)

| Card | What it does | Picture (blue accent on…) |
|---|---|---|
| Private Eye | See two players' sides | A detective's magnifying glass held over two paper silhouette cut-outs (accent on the lens). |
| Borrowed Hint | Peek at the Imposter's hint | A pickpocket's fingers lifting a folded note from someone's coat pocket (accent on the note). |
| Heavy Vote | Your vote counts double | An iron weight pressing down the lid of a ballot box (accent on the weight). |
| Decoy Contract | +3 if the room accuses you | A wooden duck decoy sitting on a contract with a squiggled signature, no letters (accent on the duck). |
| Double or Nothing | Bet pays and costs double | Two dice mid-roll above a felt table, pips only (accent on the dice). |
| Last Word | Caught Imposter guesses the word | A snuffed candle with one curl of smoke rising (accent on the flame's last ember). |
| Jackpot | +4 if you stay out of Drink/Dare | Coins spilling from the tray of an old slot machine, no symbols or text (accent on the coins). |

## Check before handing over

- [ ] Each piece reads at **104px wide on ivory**. Check it at that size, not full size.
- [ ] Commons look simpler than Rares, and Rares simpler than Golden.
- [ ] Rare blue sits on the key object only. Commons have no blue or gold.
- [ ] No text, letters or numerals anywhere, including tickets, contracts, dice faces (pips are fine) and the slot machine.
- [ ] Transparent background, 1024 × 1024.
- [ ] Re-render with `bash design/power-cards-v1/mockup/capture.sh` (start `python -m http.server 8800 --directory design` first if port 8800 is free), then look at `04-hand-sheet.png`, `05-card-detail.png` and `10-results-cards-replay.png`.

---

# Addendum 2 (v11): five more Rare pieces

Added 2026-11-25. Lawyer Up, Objection! and Wiretap are new; Sealed Alibi and Pocket Veto move to Rare. Brief and pictures: [ASTRA-V11.md](ASTRA-V11.md) Part 1. The same file carries the Filipino review (Part 2).
