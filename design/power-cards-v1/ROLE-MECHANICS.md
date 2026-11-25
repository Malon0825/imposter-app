# Roles at a power-card table (as coded)

Read this before writing or rating a card. It describes what each role can actually do in `party-core`, not what a role "should" do. Where this file and the code disagree, the code wins: fix this file.

Sources: `crates/party-core/src/cast.rs` (deal, awards), `game.rs` (`cast_picks`, `resolve_votes`, the `vote` action), `cards.rs` (`Weights::of`, `tally`, `settle`), `power.rs` (plays), `src/full-cast.tsx` and `src/App.tsx` (ballot screens).

## Cards only run at 6+ players

`cards::MIN_PLAYERS = 6`. Below six the draw is skipped and no card can be played or fire. So at a card table these are always true:

- All five special roles are dealt (Imposter, Accomplice, Detective, Judge, Decoy), and every extra player is a Gambler.
- The Decoy holds a related word, not the real one. (The "bait Decoy" with the real word exists only at 3–4 players, never at a card table.)
- The Judge's vote always counts twice (`JUDGE_DOUBLE_FROM = 6`).
- The Imposter always casts the crew ballot described below.

Don't write small-party exceptions into card text or notes. They can't happen.

## Each role's ballot

Every ballot sends `player_id` plus a bet from 0 to 3. What `player_id` means depends on the role.

| Role | Knows | Ballot | Counted weight | Bet rides on |
|---|---|---|---|---|
| Imposter | A hint, not the word | **No suspect.** Names who they think the Accomplice is (sent as `player_id`) and the Decoy. | **0, always.** The Imposter's ballot never counts. | Escaping |
| Accomplice | The word and who the Imposter is | A real suspect | 1 | The Imposter escaping |
| Detective | The word, plus one player cleared as not a villain | A suspect plus an accomplice pick (must be different players) | 1 | Their accomplice pick |
| Judge | The word | A suspect | 2. In a tie the Judge decides, but only toward the Imposter. | Their read |
| Decoy | A related word | A suspect | 1 | Their read |
| Gambler | The word | A suspect | 1 | Their read; the top bet pays +5 against −3 |

The most counted weight is accused. A tie lets the Imposter escape unless the Judge's counted vote named the Imposter among the tied leaders.

### The trap: the Imposter has no vote to change

Any card that "changes your vote" does nothing sensible for the Imposter, because their `player_id` is their **Accomplice pick**:

- Boosting it (Heavy Vote, Golden Ballot) would put votes on their own teammate. Both are **Can't** for the Imposter.
- Locking it (On the Record) would lock their Accomplice pick to whoever they named in public. The vote lock skips the Imposter, so their shown vote is cover only.
- Hedging it (Second Opinion) has no read to save. It's **Can't** for the Imposter.
- A Wiretap on the Imposter shows their Accomplice pick as "their vote". It's harmless, and it looks like a normal vote.
- A Pocket Veto on the Imposter cancels a vote that never counted. The room sees the same VETOED line, so nothing leaks.

## Scoring (before cards)

Taken from `cast::award`; PLAN.md §281 has the full list.

- **Imposter:** +2 for escaping, +1 if no ballot named them, +1 pair bonus, +1 for naming the Decoy, and the escape bet ±3. A caught Imposter gains nothing, but a lost bet still costs.
- **Accomplice:** +1 if the Imposter escapes (also when the Accomplice is accused), +1 pair bonus, and the escape bet. Named by the Detective = voided: no gains, but a lost bet still costs.
- **Detective:** +1 for naming the Imposter, +1 for naming the Accomplice. The bet rides on the Accomplice pick.
- **Judge:** +2 for a correct read, and the bet.
- **Decoy:** +1 for a correct read, +1 if the Imposter is caught, and the bet. Named by the Imposter = voided.
- **Gambler:** +1 for a correct read. Bets pay ±1 or ±2, and the top bet is +5/−3.
- **Pair bonus:** pays both villains only when the Imposter escapes, named the right Accomplice, and the Detective missed them.
- **Who goes to Drink/Dare (the "lost this round" test used by Jackpot, Bounty and Golden Pardon):**
  - civilians with a wrong read
  - a caught Imposter
  - an Accomplice who was spotted, or whose Imposter was caught
  - a spotted Decoy
  - an Underdog who lost a bet they couldn't cover

## Sides

Private Eye and Spotlight show sides; X-Ray shows the role.

- Imposter side: the Imposter and the Accomplice.
- Civilian side: everyone else.

Reads show the side and role that were dealt, so a Turncoat still reads as their dealt role.

## Checklist for a new or changed card

1. Does it touch "your vote"? Then decide what happens for the Imposter, whose ballot is an Accomplice pick that never counts. Usually the answer is Can't.
2. Does it pay on "voted for the Imposter" or "a correct read"? The Imposter and the Accomplice never score a read.
3. Does it depend on party size? It runs only at 6+, so use the 6+ rules above.
4. Put the rating in the Role guide sheet. If a role can't use the card, mark it Can't there and in Card review's Can't play column. Then regenerate with `python -I scripts/cards-from-sheet.py`.
