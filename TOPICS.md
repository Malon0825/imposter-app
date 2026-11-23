# Offline topic library

Reviewed 2026-11-17. The current source catalog contains **23 topics, 24–31 word/hint pairs per topic, 581 pairs total**. All 552 original words and Classic hints are preserved. The mode review added 29 words and classified every entry for Classic, Act It and Sound Only. This is an editorial review; difficulty still needs group playtesting.

## Source of truth

Edit `crates/party-core/content/topics.json`. Each entry has its secret word, Classic hint, explicit `modes` and nonverbal `mode_hints`. The app bundles this file for offline play and calculates topic counts from its contents. Update `crates/party-core/content/hint-review.json` for Classic associations and `crates/party-core/content/mode-review.json` for word-by-word nonverbal examples, exclusions and filtered hint alternatives. Both review records are used by development checks and are not loaded into player views.

`TOPICS.md` describes scope and authoring policy. It is not a second word database. `scripts/prepare-content.py` validates and formats the JSON; it no longer rebuilds content from an old prose proposal and a separate positional hint list.

Check without writing:

```powershell
python scripts/prepare-content.py --check
npm run test:core
```

Format after editing:

```powershell
python scripts/prepare-content.py
```

## Topic boundaries

Topics currently have 24–31 entries. Keep at least 20 reviewed Classic pairs per topic and at least 10 accepted words for each playable topic/mode combination; do not inflate counts with alternate spellings or duplicate concepts. A topic with fewer than 10 nonverbal candidates is unavailable in that mode.

- **Everyday:** Household and personal objects, such as Wallet, Toothbrush and Lamp.
- **Food:** Foods, meals, snacks and drinks, such as Sushi, Curry and Lemonade.
- **Animals:** Animals only, including mammals, birds, reptiles, amphibians, insects and marine animals. Dog, Bee and Octopus belong here.
- **Nature:** Plants, fungi, landscapes, weather and natural phenomena. Cactus, Mushroom, Waterfall, Volcano, Rain and Thunder belong here. Fungi are included as their own kind of nature vocabulary, not labelled as plants.
- **Places:** Buildings, venues and locations around town, such as Library, Hospital and Train station.
- **Jobs:** Occupations and professional roles, such as Chef, Electrician and Coach.
- **Travel:** Trip essentials, transport, preparation and vacation experiences, such as Passport, Layover, Road trip, Airplane, Train and Ferry.
- **Movies:** Film-making, genres, fictional archetypes and story worlds, such as Screenplay, Superhero and Cliffhanger. A dragon is a fictional story creature in this pack, not a real animal.
- **Music:** Instruments, song structure and performance, such as Guitar, Chorus and Rehearsal.
- **Sports:** Physical sports and athletic activities, such as Basketball, Archery and Swimming. Chess belongs in Hobbies.
- **Gaming:** Video-game mechanics, terminology and equipment, such as Respawn, Inventory and Controller.
- **Technology:** Digital devices, software and internet habits, such as Smartphone, Screenshot and Web browser.
- **Everyday chaos:** Recognizable mishaps and awkward situations, such as Lost luggage, Spilled coffee and Phone ringing in a meeting.
- **Hobbies:** Leisure activities, crafts, creative interests and tabletop pursuits, such as Gardening, Photography, Chess, Beatboxing, Tap dancing, Metal detecting, Billiards and Dominoes.
- **Celebrations:** Parties, festivals, ceremonies and associated objects, such as Wedding, Lantern and Diwali.
- **Space & science:** Astronomy, exploration and related science, such as Moon, Rover and Gravity.
- **Emotions:** Feelings and emotional experiences, such as Jealousy, Relief and Nostalgia.
- **Psychology:** Thinking, perception, attention, learning and memory, such as Daydreaming, Confirmation bias and Imagination. Cognitive biases belong here rather than being treated solely as social behavior.
- **Social behavior:** Group behavior and interpersonal dynamics, such as Cooperation, Peer pressure and Negotiation.
- **Relationships:** Dating and relationship experiences, such as First date, Anniversary and Reconciliation. Opt-in.
- **Body & puberty:** Educational anatomy and puberty vocabulary, such as Menstruation, Growth spurt and Uterus. Opt-in.
- **Sex education:** Sexual and reproductive health vocabulary, including contraception, screening, pregnancy and menstrual products. HPV vaccination replaces the overly general Vaccination entry. Opt-in.
- **Consent:** Consent, boundaries, privacy, communication and situations that affect personal choice, such as Bodily autonomy, Check-in and Coercion. Opt-in.

Choose a single primary topic for each entry. Related concepts may have different primary topics: a Backpack is an object, Backpacking is a travel activity, and Gardening is a hobby while Cactus is nature. Do not repeat the same word across packs to increase its selection odds.

## Imposter hint policy

Civilians receive the secret word. The imposter receives an explicit role label and one authored starting hint, never the secret word. Hints remain mandatory and private. Guessing the word does not itself end the round or award points.

Every catalog entry also has a short, plain-language definition for the sense used in its topic. Keep it to one printable line under 161 characters. Civilians can read it on their private card, and all players can read it on Results after voting resolves.

A useful hint gives the imposter a direction for contributing a clue while leaving several believable answers. Merely being related to the target is insufficient. We review the cue from the imposter's side first, including the conservative case where only its own topic is selected.

### Research basis and editorial decisions

- The official [Codenames overview](https://www.czechgames.com/games/codenames) describes single-word clues linking multiple candidate words. We borrow the idea of checking a cue against several explicit candidates; our goal is to preserve uncertainty for bluffing rather than help a teammate identify every target.
- The [Small World of Words paper](https://pubmed.ncbi.nlm.nih.gov/30298265/) distinguishes the dominant responses people give from additional weaker associations collected through multiple responses. This informed our decision to reject a familiar but dominant giveaway and also to reject an association that only works through a remote chain of ideas. That is an editorial inference for this game, not a tested finding about our library.
- [De Deyne, Navarro and Storms (2013)](https://escholarship.org/uc/item/1596128p) distinguish forward and backward associative strength. We therefore review both directions: does seeing the hint suggest useful possibilities, and does the hint feel natural after seeing the secret word? An explanation that sounds plausible only after revealing the answer is insufficient.
- The official [Codenames App FAQ](https://faq.codenamesapp.com/en/gameplay/how-to-play/rules-and-clues/) describes checking word forms and blocking clues about letters. For this game we retain stricter authored rules: meaning-based associations, no spelling cues, no translations, no repeated answer fragments, and no synonyms or near-definitions that identify the answer.

These sources informed the review method. We did not measure human association strengths for these pairs. The candidate sets below are original editorial judgments, not responses from an association dataset or simulated player results.

### Selection and rejection rules

1. **Natural connection.** Prefer a familiar context, material, setting, consequence, action or experience. A reviewer should be able to explain the relationship in one short sentence without inventing an unusual situation. Different possible meanings of a word can be useful, but spelling tricks and chains of several indirect links are unsuitable.
2. **Useful uncertainty.** Record 3–6 plausible answers from the same topic, including the target. At least two others must fit naturally. Do not pad a set with weak connections simply to pass validation. This range is our practical authoring rule, not a scientific estimate of guessing probability. The list need not contain every possible answer.
3. **No dominant giveaway.** Even with alternatives, reject a cue if one answer feels overwhelmingly obvious. Counted alternatives do not prove equal plausibility. Avoid characteristic sounds, signature anatomy, unique tools, exact opposites and near-definitions when they immediately identify the target.
4. **Enough information to bluff.** Check that a player who sees only the topic and hint can offer a relevant follow-up clue. A cue that covers almost the whole pack gives little help. Reject empty labels such as Thing, Animal or Anatomy, and reassess broad labels such as Audience in Movies.
5. **Plain language.** Use one familiar alphabetic word, allowing a normal hyphenated word. A specialist secret word should still have an accessible hint; difficulty should not come from an obscure clue vocabulary.
6. **Clean word choices.** If an entry is a category label or too close to another concept to support distinct rounds, replace it rather than force a poor hint. Keep exactly one primary topic and avoid alternate spellings as separate entries.
7. **Topic context and repeat review.** Check with the narrowest relevant public context. Shared hints can be useful because they preserve alternatives. They are not automatically defects, but excessive reuse or a hint that covers nearly the entire topic needs revision.

Examples from this pass:

- **Piano → Classical:** also fits Violin, Orchestra, Flute and Harp. Replaces Keys, which strongly singled out Piano in this pack.
- **Comedy → Timing:** also fits Plot twist and Stunt double. Replaces Audience, which offered almost no distinction among movie entries.
- **Mouse → Desktop:** also fits Keyboard, Printer and Laptop. Replaces Cursor, which pointed too directly to Mouse.
- **Souvenir → Market:** also fits Tour guide and Sightseeing. Replaces Keepsake, a near-synonym for the answer.
- **Dog → Paws:** also fits Cat, Bear and Fox. Retained because the relationship is natural and useful.
- **Guitar → Strings:** also fits Violin and Harp. Retained for the same reason.

### Educational vocabulary accuracy

An association is not a definition, diagnosis or instruction. Check anatomical and health connections against reliable educational sources. [NIH's puberty overview](https://newsinhealth.nih.gov/2026/08/navigating-puberty) supports the connections among glands, hormonal signals and physical changes. [NIDDK's anatomy description](https://www.niddk.nih.gov/news/media-library/17880) supports the blood-flow association for Erection. [NHS's menopause overview](https://www.nhs.uk/conditions/menopause-and-perimenopause/what-are-menopause-and-perimenopause/) supports Menopause → Hormones.

Keep consent vocabulary accurate in tone and meaning. [RAINN's consent guidance](https://rainn.org/share-the-facts/consent-101-respect-boundaries-and-building-trust/) states that silence, pressure, and being too intoxicated to make informed decisions do not establish consent. Silence therefore uses Pause, never Agreement or Permission; Coercion and Manipulation use cues about pressure tactics. Related candidate words do not imply that the concepts are equivalent or that any behavior is acceptable.

### Review record and validation

`crates/party-core/content/hint-review.json` records 409 topic-specific associations covering all 581 Classic pairs. Each association names its hint and 3–6 plausible secret words from that pack. These are editorial alternatives, not instructions to the player or additional hints delivered during a round.

`python scripts/prepare-content.py --check` validates all three content files and the generated mode inventory. Checks cover pack sizes, unique words/topics, hint syntax and answer fragments, category labels, opt-in settings, complete review coverage, exact mode names, missing mode hints, explicit examples or exclusions, and alternatives inside the same filtered pool. Rust tests check safe selection, the 10-word boundary, repeat history, privacy and the Nature/Animals separation. `npm run test:content` also runs negative tests against malformed and stale review data.

These checks cannot establish semantic correctness, detect every synonym or word stem, prove that alternatives are equally plausible, or certify gameplay difficulty. Review those properties manually; passing the checks is only a maintenance safeguard.

## Game-mode review

[TOPIC-MODES.md](TOPIC-MODES.md) lists every word, its accepted/excluded modes and per-topic counts. Regenerate it after content changes with `python scripts/prepare-content.py --write-mode-report`.

- **Classic:** all 23 topics, 581 words.
- **Act It:** 21 playable topics, 486 words in those pools. Body & puberty has 6 tentative candidates and Sex education has 4, so neither topic enters the acting draw.
- **Sound Only:** 14 playable topics, 194 words in those pools. Food, Gaming, Space & science, Psychology, Social behavior, Relationships, Body & puberty, Sex education and Consent are unavailable. Food has 6 sound candidates, Space & science has 1 and Body & puberty has 1; these small subsets remain blocked.

Additions strengthen natural sound pools: Everyday +7, Nature +6, Travel +6, Technology +5 and Hobbies +5. Their sound pools now contain 16, 14, 13, 12 and 12 words respectively. Other topics are withheld when ten distinct useful clues would require weak associations or a change in subject.

For Act It, accept a short solo physical clue without speaking, spelling, mouthing, required props or contact. For Sound Only, accept a familiar player-made noise without words, lyrics, gestures as extra clues or recordings. Generic noises that could fit almost anything do not establish compatibility. Fictional creature and machine sounds are acceptable in Movies; they are not used to claim silent space phenomena have real sounds.

Each accepted word has a concrete example and each excluded word has a reason in the mode review. Existing hints were reconsidered after filtering: a playable nonverbal hint must retain 3–6 reviewed candidate answers inside that mode's actual word pool. Some words therefore have a different private hint for acting or sound. Small unavailable subsets retain Classic hints only as editorial references; those hints are not approved for dealing in the unavailable mode.

Each canonical entry carries a stable `word_id`. Keep it when updating display text or hints. The [diversity review](crates/party-core/content/diversity-review.json) records closely related words, mode-specific performances, and equivalent concepts with overlapping clues. It also names the approved fallback hints. Maintain explicit aliases when migrating a published ID.

The selector filters the host's enabled topics against those groups and the local word deck. It then checks each hint again against the remaining selectable concepts. Use the initial ten-word threshold to qualify a topic for a rule. A depleted pool can still play while it has a viable hint, and a fresh deck starts only through the host's explicit action.

## Review and playtesting

The first 2026-11-16 pass separated Nature from Animals and expanded all 23 packs to 24 pairs. The second pass used the research-informed method above to review all 552 pairs, revise 160 pairs, and record plausible alternatives for every hint. Five secret words changed:

- **Credits → Alien:** adds a clear third science-fiction candidate alongside Time machine and Spaceship for Future.
- **Recall → Tip-of-the-tongue:** replaces a concept close to Memory with a recognizable retrieval experience.
- **Concentration → Multitasking:** broadens the attention-related entries with a more distinct everyday activity.
- **Reward → Procrastination:** replaces a broad word and its unhelpful Games cue with an everyday psychological behavior and Deadline.
- **Reproductive health → Menopause:** replaces a topic-level label with a specific reproductive-health concept.

At the end of the 2026-11-16 passes all topics had 24 words. The 2026-11-17 mode pass added 29 entries while preserving the original words and Classic hints. The four relationship/educational packs remain opt-in. The library has received an editorial review, not a human playtest certification.

For the next playtest:

1. Show fresh participants only the topic and hint. Ask for a plausible spoken clue and a few possible answers, without showing the editorial candidate list.
2. Record unfamiliar wording, hints that repeatedly cause an immediate exact guess, and hints that leave players unable to contribute. Do not treat a single correct guess as proof that a hint is bad.
3. Reveal the target and ask whether the connection feels natural. Capture any explanation that depends on specialist knowledge, a regional reference or an invented scenario.
4. Run ordinary rounds with different speaker orders and topic selections. Judge whether the imposter can participate and whether the clue creates a consistent advantage or disadvantage.
5. Rework the word and hint together, update the review record, and repeat with fresh participants. Record actual observations before making claims about difficulty or balance.
6. For nonverbal modes, separately test the word-holder's example and the imposter's topic-plus-mode-hint. Record words that produce only the same generic sound or a long acted story, then exclude or revise them. Recheck the 10-word threshold and filtered alternatives after every removal.
