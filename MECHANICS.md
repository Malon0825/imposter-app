# Game mechanics (as implemented)

**The one place to look up how the game works today.** Every rule here is what `crates/party-core/` does, with the function to check named next to it. Other docs are plans, history or player copy. When this file and the code disagree, the code wins: fix this file in the same commit. Every patch that changes a mechanic updates this file (see [CLAUDE.md](CLAUDE.md)).

Last checked against the code: 2026-11-25, branch `claude/browser-guest-cards`.

## 1. Party and session

- **3–12 players.** Starting needs at least 3; a 13th can't join (`game.rs` `join`). Names are 1–28 characters.
- **The host's phone owns the game.** State lives in host memory; guests poll. Ending the host process ends the party.
- **Browser guests play the full game, power cards included.** They may send only the player actions in `GUEST_ACTIONS` (`network/web.rs`): ready, topic vote, role ready, clue, performed, vote, report, Drink or Dare choice and done, skip, leave, and the card actions draw, skip draw, draw ready, play card, change bet and Last Word. Host controls (start, settings, Deal now, pause) are refused with "Only the installed host app can do that."
- **Session target:** 10, 15, 20, 25 or 30 points, set in the lobby. It locks when the first round starts.
- **Ending a session:** after a round is scored, if anyone reached the target, the highest score wins. Ties share the win, unless Cardboard Crown breaks them (§8). The phase goes to `session_complete`.
- **New session:** resets points, pending reports and the card session (hands, Golden odds, deck). It keeps players, settings and role history.
- **Points never go below 0** (`commit_round`).

## 2. Round flow

Phases, in order. "Auto" means the host loop moves on by itself; "host" means the host taps.

1. **`lobby`.** Everyone readies up. Host taps Start (`kickoff`).
2. **`rule_reveal`** (only with Random rules on, or for a replacement round). Auto: a 1.25 s shuffle, then 3 s on the rule.
3. **`topic_voting`.** Each player approves one or more topics. When all have voted, the top total wins; a tie is broken by one random draw. Auto.
4. **`topic_chosen`.** The chosen topic stays on screen for 3.5 s (`TOPIC_HOLD`, `topic_held`), then the host loop begins the round on its own (`begin_round`, from `network.rs`). If the deal fails, the host gets Retry deal.
5. **`draw`** (power cards only, §6). No timer. The deal happens as soon as everyone has drawn or skipped. A player still reading their card taps Continue later, and the table doesn't wait for them. Host Deal now skips anyone undecided.
6. **`roles`.** The deal (`deal`): word, cast, speaking order. Each player acknowledges; when all have, auto.
7. **`discussion`.** Clues are given face to face. The optional clue board allows one clue of up to 60 characters per player per clue turn. The host can add clue turns. Host taps Open vote.
8. **`voting`.** Secret ballots (§4). When the last ballot locks, the round resolves (`resolve`).
9. **`last_word`** (only if a caught Imposter holds Last Word, §8). It lasts 20 s; running out counts as wrong.
10. **`result_reveal`.** Auto: a 1 s beat, then 2 s of personal result.
11. **`results`.** Players can lock reports (§5). Host taps Continue (`punish`).
12. **`punishment`** (if anyone lost). Then **`rankings`**, or **`session_complete`** if the target was reached. Host taps Next round.

Other host controls:
- **Pause / resume.**
- **Skip round:** no points, and a replacement round starts on a rule reveal.
- **Abandon:** back to the lobby, with no points.
- **Remove player:** only before roles.

A player leaving mid-round pauses it until the host abandons the round.

There is **no runoff**. A tie at the top lets the Imposter escape unless the Judge breaks it (§4). Runoff code exists only in a test-only legacy path.

## 3. Roles and the deal

**Who is dealt** (`cast::specials`). Everyone else is a Gambler.

| Players | Roles |
|---|---|
| 3 | Imposter, Decoy |
| 4 | Imposter, Decoy, Judge |
| 5+ | Imposter, Accomplice, Detective, Judge, Decoy |

**Fair rotation** (`cast::assign`, `role_weight`). Every possible deal is weighted by the product of each player's weight for the role they'd get.
- Weight = `1 / (1 + gap)²`, where gap = how many more times they've held that role than the least.
- It's halved if they held that role last round.
- So repeats get rare but never impossible.
- The Imposter uses its own count. Someone new starts level with the least.

**What each role knows:**

| Role | Knows |
|---|---|
| Imposter | A hint, not the word |
| Accomplice (5+) | The word, and who the Imposter is |
| Detective (5+) | The word, and one cleared player: someone who is neither Imposter, Accomplice nor Detective |
| Judge (4+) | The word |
| Decoy (5+) | A related word from the same hint group, not the real one |
| Decoy (3–4) | The real word. They play as "bait" (`cast::bait_decoy`). |
| Gambler | The word |

**Speaking order:** a fresh shuffle each round. The previous round's opener never opens twice in a row.

## 4. Ballots and the verdict

Every ballot names a player (`player_id`, never yourself) plus a bet from 0 to 3. A ballot can't be changed once locked. What the ballot means depends on the role (`cast_picks`):

| Role | Ballot | Counted weight | Bet rides on |
|---|---|---|---|
| Imposter, 5+ players | **No suspect.** `player_id` is who they think the Accomplice is, plus a Decoy pick. Both are required and must be different. | **0, always** | Escaping |
| Imposter, 3–4 players | A plain cover vote | 0, always | Escaping |
| Accomplice | A suspect | 1 | The Imposter escaping |
| Detective | A suspect plus an accomplice pick (not the same player) | 1 | The accomplice pick |
| Judge | A suspect | **2 from 6 players**, 1 below | Their read |
| Decoy, Gambler | A suspect | 1 | Their read |

**Verdict** (`resolve`, and with cards `cards::tally`):
- The most counted weight is accused.
- A tie means nobody is accused and the Imposter escapes.
- One exception: if the Imposter is among the tied leaders and the Judge's counted ballot named the Imposter, the Imposter is caught. This works at any size; a vetoed Judge loses it.

**Perfect bluff:** the Imposter escaped and no ballot at all named them.

**Bet cap:** your current points, up to 3. An Underdog may always bet 3 (§7).

## 5. Scoring, reports and Drink or Dare

**Role awards** (`cast::award`). A bet pays ±stake on its goal. The Gambler's 3-point bet pays +5 when right.

| Role | Points |
|---|---|
| Imposter | +2 for escaping, +1 perfect bluff, and if they escaped, +1 pair bonus and +1 for naming the right Decoy. Caught: 0 (a lost bet still costs). Naming the right Decoy voids the Decoy even if the Imposter is caught. |
| Accomplice | +1 if the Imposter escapes (also when the Accomplice is accused), +1 pair bonus. Named by the Detective = voided. |
| Detective | +1 for the right suspect, +1 for the right accomplice pick |
| Judge | +2 for a right read |
| Decoy (5+) | +1 for a right read, +1 if the Imposter is caught. Named by the Imposter = voided. |
| Decoy (3–4, bait) | +1 for a right read, +1 if any counted ballot named them. Convicted = voided. |
| Gambler | +1 for a right read |

- **Pair bonus:** the Imposter escaped, named the right Accomplice, and the Detective missed the Accomplice. It pays both villains.
- **Voided:** no gains that round, but a lost bet still costs.

**Who lost** (joins the Drink or Dare queue):
- a wrong read (civilian roles)
- a caught Imposter
- an Accomplice who was spotted, or whose Imposter was caught
- a voided Decoy
- an Underdog whose lost bet was more than their points (cards only)

**Drink or Dare:**
- The queue is shuffled. Each player picks Drink or Dare.
- A Dare gets a random connected player as the dare giver. The host can swap the giver or skip a turn.
- The app holds no dare text. Skipping never changes points.

**Reports:**
- On Results, each player can lock a list of other players to report.
- A player reported by more than half the round's roster gets −1, applied after the **next completed** round's scoring. Abandoned rounds don't use it up.
- Reports never add a Drink or Dare turn.

## 6. Power cards: the system

Code: `cards.rs` (rules), `power.rs` (game wiring). Data: `crates/party-core/content/cards.json`, generated from [power-card-review-v11.xlsx](design/power-cards-v1/power-card-review-v11.xlsx) by `scripts/cards-from-sheet.py`. Never hand-edit the JSON.

**When cards are on:**
- Cards run only with the host switch on **and at least 6 players** (`cards::MIN_PLAYERS`).
- That means every card round has the full cast, the Judge counts 2, the Decoy holds a related word, and the Imposter's ballot has no suspect.
- Below 6 players nothing draws, plays or fires, and hands are kept.

**Drawing:**
- A draw costs 3 points, and Underdogs draw free.
- 4 paid draws per player per session; free draws don't count.
- One draw or skip per round.
- The draw window opens only if someone can draw (so round 1, with everyone on 0, skips it).

**Tier odds** (`roll_tier`):
- Golden starts at 10%. Rare is 25%. Common gets the rest.
- Golden chance goes +2% after each non-Golden draw and +1% for each round you start as a leader. It's capped at 20% and resets to 10% after a Golden draw.

**The deck** (`Deck`):
- Common and Rare are two lines, each shuffled once per session.
- A draw takes the first card in the rolled tier that you don't already hold.
- A played, traded or dropped card goes to the back of its line.
- Golden cards are unique per session and never return.
- An empty or unusable tier falls through: Golden → Rare → Common, or Rare ↔ Common.

**Playing:**
- One **active** card per player per round, only in its window:
  - role reveal (phase `roles`)
  - discussion
  - ballot (sent with your vote)
- A card drawn by Reshuffle is playable from next round.
- Playing an active card, even one that gets cancelled, stops your **passives** that round. Otherwise the oldest passive you hold that can work fires at results, and it leaves the hand.

**Who can't play what** (`cards::cant_play` and `playable`; the hand shows "Can't play as …"):
- A role listed in the card's `cant_play` (§8)
- the leader, for Crown Heist and Robin Hood
- no bet, for Double or Nothing
- the last voter, for Cold Feet

**Announcements:**
- Every phone sees "<player> played a <tier> card", never which card.
- Ballot cards are announced when that vote locks.
- A Bluff Card announces a fake tier rolled at base odds.

**The tier ladder** (`beats`): a higher tier wins, and between equal tiers the earlier play wins. The losing card is spent. Each verdict shows on every phone:
- **Lawyer Up** blocks a Common, or a Rare played after it, aimed at its owner (BLOCKED). It also cancels a Put on the Spot, or a not-yet-shown Anonymous Tip, already aimed at its owner. A Golden goes through (PIERCED).
- **Objection!** cancels a Common, Bluff Cards included (SUSTAINED). A Rare or Golden survives it (OVERRULED).
- **Pocket Veto** takes a vote out of the count (VETOED). A Golden Ballot survives it (OVERRULED).

**Settlement order** (`cards::settle`):
1. Last Word answer
2. Votes, with weights, vetoes, Golden Ballot and the Judge tiebreak
3. Role awards and bets, with card changes
4. Card awards, which survive a void
5. Passives
6. Bounty, Robin Hood, Crown Heist
7. Shadow, last

**Reads show the dealt truth:** Private Eye, Spotlight and X-Ray never reveal a Turncoat. "Sides": the Imposter's side is the Imposter and the Accomplice; everyone else is civilian.

## 7. Comeback (cards only)

- **Leaders:** everyone tied for the top score at the start of the round. Nobody leads at 0.
- **Underdogs** (from the session's 3rd scored round): at least ⌈target ÷ 3⌉ behind the top score at the start of the round, so 15→5, 20→7, 25→9, 30→10.
  - They draw free, may bet 3 whatever their points, and a winning bet pays +1.
  - Losing a bet bigger than your points sends you to Drink or Dare.
- **Rising Bounty:** if any leader lost the round, every Underdog gets the Bounty. It starts at +1, grows +1 for each round the same leaders survive (cap +3), and resets to +1 after it pays or when the lead changes.

## 8. Every card, as coded

"Can't" = roles that can't play it. Card text is in `cards.json`; this is what the engine does.

| Card | Tier · window | Effect (code) | Can't |
|---|---|---|---|
| Late Arrival | C · role reveal | You speak last in clue turn 1 | — |
| Opening Act | C · role reveal | You speak first in clue turn 1 | — |
| Put on the Spot | C · discussion, player | They owe a clue, pinned on the board. A logged clue, a Performed mark or the host clears it. Open vote asks the host to confirm while one is owed. | — |
| Anonymous Tip | C · discussion, player | "Someone suspects X" appears when voting opens. The owner stays hidden. | — |
| On the Record | C · discussion, player | Your vote is shown now and locked; +2 if it names the Imposter. **For the Imposter it's cover only and locks nothing.** | — |
| Word Count | C · discussion | Private: the number of letters in the real word | Accomplice, Detective, Judge, Gambler |
| Cover Story | C · discussion | You claim a role publicly; results show if it was true | — |
| Second Opinion | C · ballot, player | Backup suspect: if your vote was wrong and the backup is the Imposter, your read counts as right (points, no Drink or Dare). The bet still settles on the real vote. | Imposter, Accomplice |
| Reshuffle | C · discussion | Free draw now at your odds, playable next round | — |
| Cold Feet | C · ballot | Change your bet once until voting closes | (last voter) |
| Bluff Card | C · discussion | Fake announcement at a rolled tier, nothing else. It counts as Common against Objection! | — |
| Safety Net | C · passive | Lost a bet with a stake of 2+: +1 | — |
| Rain Check | C · passive | Your round total ≤ 0: next round you play, a lost bet costs 0 | — |
| Clean Hands | C · passive | Right read and no counted weight against you: +2 | — |
| Cardboard Crown | C · passive (session end) | Tied for first at the target: Crown holders win alone (two holders share) | — |
| Private Eye | R · discussion, two players | Private: each one's side. Lawyer Up blocks per name. | — |
| Borrowed Hint | R · discussion | Private: the Imposter's hint | Imposter |
| Heavy Vote | R · ballot | Your weight +1 (a Judge counts 3) | Imposter |
| Decoy Contract | R · discussion | You are accused: +3 (survives a void) | Imposter |
| Double or Nothing | R · ballot | Your bet's result ×2. Needs a bet. | — |
| Last Word | R · passive | Caught Imposter who played no active card: pick the real word from 3 (real, Decoy word, one more from the hint group) within 20 s. Right: the Imposter, the Accomplice and a Turncoat score as if escaped. | — |
| Jackpot | R · passive | You didn't lose this round: +4 | — |
| Sealed Alibi | R · discussion, prediction | Secret prediction of the accused (yourself allowed). Right and your side won: +3. | — |
| Pocket Veto | R · ballot, player | Their vote counts 0 and the Judge loses the tiebreak; the room sees VETOED. Golden Ballot → OVERRULED. Vetoing the Imposter changes nothing. | — |
| Lawyer Up | R · role reveal or discussion | Shields you as in §6 | — |
| Objection! | R · discussion or ballot, a player who played | See §6 | — |
| Wiretap | R · discussion, player | Private: their vote as soon as it locks. For the Imposter that is their Accomplice pick. | — |
| Master Key | G · discussion | Private: the real word | Accomplice, Detective, Judge, Gambler |
| X-Ray | G · discussion, player | Private: their dealt role (pierces Lawyer Up) | — |
| Golden Ballot | G · ballot | Your weight = 4 in total (a Judge too); can't be vetoed | **Imposter** |
| Crown Heist | G · discussion | You didn't lose: raised to the top starting score | Leader |
| Midas Touch | G · ballot | Positive role and bet points ×3; losses unchanged | — |
| Golden Pardon | G · discussion | If you lost: not lost (no Drink or Dare) and +5 | — |
| Turncoat | G · discussion | You join the Imposter's side: escape +4, plus the bet rides on the escape. Caught: lost, and the bet costs. Reads still show your dealt role. | Imposter, Accomplice |
| Spotlight | G · discussion, player | Everyone sees their side | — |
| Shadow | G · discussion, player | You also get their final total, if positive | — |
| Robin Hood | G · discussion | Each leader −5 (floor 0). Each Underdog +2, or you +5 if there are none. | Leader |

## 9. Rules and words

**Random rules** (`kickoff`, `rule_weights`):
- Classic, Act It, Sound Only, Two Truths and a Lie, If It Could Talk, Sell It.
- Each must have enough words in the enabled topics. The rule is drawn with weights `1/(1+gap)²`, halved for last round's rule.
- Act It and Sound Only are in person: no typed clues, and an optional Performed mark.

**Word deck** (`selection.rs`, `history.rs`):
- Played words are saved on the host device across sessions and restarts.
- Related meanings stay apart for 6 dealt rounds, and similar performances in one mode for 4.
- Host **Start fresh word deck** resets it.
- Content rules: [TOPICS.md](TOPICS.md).

## 10. Before you add or change a card

1. Does it touch "your vote"? The Imposter's ballot is an Accomplice pick that never counts, so say what happens for them. Usually the answer is Can't.
2. Does it pay on "a right read"? The Imposter and the Accomplice never score a read.
3. It only runs at 6+, so use the 6+ rules above and leave out small-party exceptions.
4. Set Can't in both the Card review sheet (Can't play column) and the Role guide sheet. Regenerate with `python -I scripts/cards-from-sheet.py`, and update §8 here.
