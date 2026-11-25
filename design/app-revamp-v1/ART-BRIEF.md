# App revamp — art brief (everything outside the cards)

For: Astra (image generation). Branch: `claude/power-cards`.
Scope: the illustrations the revamped app needs **outside the power cards**. The 34 card illustrations and the card back are done and approved; don't change them.

Every piece below has a dashed **ART · A#** frame in the mockups (`design/app-revamp-v1/*.png`, gallery at `http://localhost:8800/app-revamp-v1/mockup/`). Look at the frame to see the exact size and context before you draw.

## Style

Same hand as everything you've made so far: engraved pen-and-ink, fine cross-hatching, warm parchment fills, black ink linework. The app is now a **noir case file** (1940s–50s detective-story props: case folders, stamps, mugshots, typewriters), so the objects come from that world.

- **Accent colours by job:** sage (#B4C8AD) for neutral app moments. Lime (#D6F56B), sparingly, for success. Terracotta (#D98672) for danger or loss. Gold (#E9C46A) only for winning.
- Attach as style references: two role pieces (`design/full-cast-v1/art/judge.png`, `gambler.png`), one Golden card and one Common card from `design/power-cards-v1/art/`.
- No text, letters, numbers or logos anywhere.
- Transparent PNG unless stated. The app's background is charcoal (#141916), so keep the parchment fills: art must read on dark.

## The list

| ID | Where | Picture | Size |
|---|---|---|---|
| **A1** | Welcome, behind the IMPOSTER wordmark | The six cast characters (Imposter, Accomplice, Detective, Judge, Decoy, Gambler, as in the role art) around a round card table under one hanging lamp, seen at a slight high angle. Leave the lower third calm: the wordmark overlaps it. | 1600 × 1200 |
| **A2** | Host setup: "Keep the party connected" | Three phones lying on a table, tied together with red string like a case board, a pushpin in each. | 1400 × 900 |
| **A3** | Guest: "Same room. Same Wi-Fi." | An old table radio with its dial glowing softly (sage glow). | 1400 × 800 |
| **A4** | Reconnecting: "Hold that thought." | A telephone handset dangling off the hook by its coiled cord. | 1200 × 900 |
| **A5** | Rule reveal, one per round rule (6) | **Classic:** a man whispering behind his hand. **Act It:** white-gloved mime hands mid-gesture. **Sound Only:** a gramophone horn blasting a few notes. **Two Truths and a Lie:** a lie-detector needle scratching paper. **If It Could Talk:** a ventriloquist's dummy mid-sentence. **Sell It:** a travelling salesman's open suitcase of samples. Sits on the **ivory** rule card, so the linework must read on light too. | 1200 × 760 each |
| **A6** | Topic vote tiles and chosen-topic card (23) | One small engraved emblem per pack: Everyday, Food, Animals, Nature, Places, Jobs, Travel, Movies, Music, Sports, Gaming, Technology, Everyday chaos, Hobbies, Celebrations, Space & science, Emotions, Psychology, Social behavior, Relationships, Body & puberty, Sex education, Consent. Single object, centred, bold enough to read at **54px**. The adult packs (last four) stay tasteful and non-explicit: symbolic objects only. | 512 × 512 each |
| **A7** | Vote locked | A sealed envelope with a terracotta wax seal, slightly tilted. Replaces the current textured envelope. | 1000 × 700 |
| **A8** | Your result beat, one per outcome (5) | **Correct:** a magnifying glass over a fingerprint (lime accent). **Wrong:** a red herring on a plate (terracotta). **Escaped:** an open window, curtains blowing out into the night (gold). **Caught:** a pair of handcuffs, snapped shut (terracotta). **Spotted:** a pair of binoculars, lenses glinting (terracotta). Shown in a round frame, so keep each inside a centred circle of 80%. | 800 × 800 each |
| **A9** | Drink or Dare: Drink | A whiskey glass with ice and a splash leaping out. | 800 × 940 |
| **A10** | Drink or Dare: Dare | A lit match held over a single playing card, the flame just catching the corner. | 800 × 940 |
| **A11** | Session complete | A gold trophy cup standing on a stack of case files, with a CASE CLOSED stamp mark (shape only, no letters) on the top file. | 1000 × 1000 |
| **A12** | How to play: field guide cover | A detective's open notebook with a fountain pen and a magnifier resting on it. | 1400 × 600 |

Optional, if there's time: **A13 · app icon.** The card back's sage eye on charcoal, centred for a rounded-square icon, readable at 48px. 1024 × 1024, opaque.

That's **43 pieces**: 1 + 1 + 1 + 1 + 6 + 23 + 1 + 5 + 1 + 1 + 1 + 1, plus the optional icon.

## Files

Save to `design/app-revamp-v1/art/` with these names (lowercase, hyphens):

- `a1-welcome.png`, `a2-connected.png`, `a3-wifi.png`, `a4-reconnecting.png`
- `a5-rule-classic.png`, `a5-rule-act-it.png`, `a5-rule-sound-only.png`, `a5-rule-two-truths.png`, `a5-rule-if-it-could-talk.png`, `a5-rule-sell-it.png`
- `a6-topic-<pack>.png`, for example `a6-topic-space-science.png` or `a6-topic-everyday-chaos.png`
- `a7-envelope.png`
- `a8-correct.png`, `a8-wrong.png`, `a8-escaped.png`, `a8-caught.png`, `a8-spotted.png`
- `a9-drink.png`, `a10-dare.png`, `a11-trophy.png`, `a12-field-guide.png`, `a13-app-icon.png`

## Check before handing over

- [ ] Each piece reads at the size its frame has in the mockup. Topic emblems read at 54px.
- [ ] Rule art (A5) reads on ivory; everything else reads on charcoal.
- [ ] No text or numerals anywhere, including stamps, files, dials and cards.
- [ ] Transparent background (except the optional app icon).
- [ ] The adult topic emblems are symbolic and non-explicit.
- [ ] Report which variant you picked for each piece and any that don't read at size. Don't commit or push; stay on `claude/power-cards`.
