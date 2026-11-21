# Streamlined round flow and shared reveals

**Status** · Final product plan for implementation. Timing values are starting points for playtesting.

## Goal and tap targets

Keep the host in the room’s conversation. The host starts a round, opens voting when the group is ready, and moves on from Results after the reaction and reporting window. The app advances when the players finish a step or a shared reveal ends.

Count one kickoff per round. In a repeat round, that tap is **Next round** on rankings. Starting from rankings replaces the current trip through the lobby and its second start tap.

| Step | Host | Each guest |
| --- | ---: | ---: |
| Start or repeat | 1 | 0 |
| Pick one topic and lock it | 2 | 2 |
| Reveal the private card, then hide and ready | 2 | 2 |
| Open voting | 1 | 0 |
| Pick a suspect and confirm | 2 | 2 |
| Continue from Results | 1 | 0 |
| **Repeat round total** | **9** | **6** |

With four players, the repeat round takes **27 taps across all phones**, down from **34** on the same baseline. The first round or a changed roster adds **I’m ready** for each guest who needs to ready up. The estimate excludes setup, settings changes, reconnects, additional topic selections, bets, clue logging, card recall, reports, and Drink or Dare. Each Drink or Dare turn takes one tap to skip or two to choose and finish. The timed reveal, topic ties, and suspect vote ties add zero taps.

## Player flow

1. **Choose settings and start.** Keep the existing lobby readiness check for the first round and for a changed roster. Show the host’s **Random rules** on/off toggle and its current setting beside the start action in the lobby and beside **Next round** on rankings. The host can change it before kickoff or keep the current setting and start with one tap. At rankings, **Next round** starts directly when the same players are connected and the session is still active. Fall back to the lobby if the roster changed, someone is offline, or the deck needs attention. If the score target has been reached, keep final standings and the existing **Start next session** action.
2. **Reveal the rule together.** With random rules enabled, kickoff opens a dedicated reveal screen on every phone. The timer starts only after the host starts the round. Shuffle the face-down card for about 1.25 seconds, flip to the selected rule, and hold the revealed face for about three seconds. Use the existing card art and a distinctive illustration for each eligible rule. Show one instruction the room can read at a glance. For Sound Only, use **Make a sound. No words or gestures.** Automatically open the filtered topic ballot, with the rule still visible at the top. With random rules off, a regular kickoff opens Classic topic voting directly. A replacement after **Skip round** always uses the reveal screen, including for fixed Classic. For fixed Classic, show the landed card immediately and hold it for about three seconds before topic voting.
3. **Vote for a topic.** Keep multi-select voting, hidden ballots until locking, and **Lock my vote**. Once every eligible player locks their ballot, pick the sole winner or draw uniformly from the tied leaders. Deal the cards automatically. Put the chosen topic above every face-down private card. When there was a tie, label it **Picked from a tie** and keep the vote summary available on demand.
4. **Reveal, hide, and talk.** Keep **Reveal my role** and **Hide & ready** as separate taps. Civilians can still swipe or tap for the word meaning. The imposter gets the starting hint. Discussion starts as soon as everyone hides and readies. Keep **Check my card**, the optional clue board and performance marks, and **Another clue turn**. There is no discussion timer. The host taps **Open voting** when the room is ready.
5. **Vote once and share the outcome.** Keep suspect selection and **Confirm vote** as separate taps for everyone. As votes lock, show aggregate progress such as **3 of 4 votes locked**, including the imposter’s submission. Only civilian votes count toward the verdict. When the final submission locks, go straight into the shared Results reveal. A tie for the highest civilian vote count gives the imposter an escape.
6. **React, report, and continue.** Keep Results open while the room talks. Any player can open **Report a rule violation** there, select one or more players, and submit privately. Leaving the report unopened counts as no report. The host has the same optional reporting action and taps **Continue** once to close reporting. Open Drink or Dare if the queue has turns. Otherwise, open rankings. The last Drink or Dare turn also opens rankings automatically.

## Three new spoken rules

These rules join Classic, Act It, and Sound Only in the random draw when compatible, fresh content is available. They use the same lobby, role cards, clue turns, and single suspect vote. The clue format applies during a player’s clue turn. Open discussion stays conversational, and a clue or follow-up must keep the secret word private. The app can explain the format on the rule reveal and discussion screen. Performances are judged by the room and use the existing optional reporting flow.

### Two Truths and a Lie

- **Rule card copy** · Say two true clues and one believable lie about the same thing. Mix up the order.
- One turn is three short statements about the same target. Civilians use the secret word. The imposter uses the hint to bluff about a plausible word. A truth should be generally true or clearly qualified with words such as **some** or **can**. The lie should be clearly false for the intended meaning and close enough to sound plausible. Players avoid wording that depends on a particular brand, local custom, or private experience unless those details are part of the word.
- The room can discuss whether a detail sounded right. Players keep the identity of their own lie to themselves until the recap, when they can share it aloud. There is no separate lie vote, score, timer, or required tap.
- **Example for Popcorn** · “You can make it in a pot. People often add salt after cooking it. It has to be served hot.” The last statement is the lie.

### If It Could Talk

- **Rule card copy** · Become the secret word. Give one clue starting with **I** or **my**.
- Speak in first person as the thing, place, animal, event, or idea. Describe what people do around it, when it shows up, or what it experiences. A voice or accent is optional. Keep the word, its title, and obvious catchphrases out of the line. The imposter uses the hint to pick a plausible point of view.
- **Example for Umbrella** · “I spend most of my time by the door, but everyone wants me when the weather turns.”

### Sell It

- **Rule card copy** · Start with **You should buy it because…** and finish with one indirect selling point.
- Every player says that exact opening, then gives one short benefit without naming the word. Treat **it** as the item, service, ticket, trip, or experience in the prompt. A funny pitch still has to make sense for the hidden word. The imposter makes a believable pitch from their hint. Leave out prices, brands, spelling clues, and direct definitions.
- **Example for Umbrella** · “You should buy it because it fits in your bag and can save your outfit.”

### Topic fit in the current catalog

This is a first pass over all 23 topic packs. **Start with** means the pack has enough promising entries to prioritize a word-by-word review. **Review selectively** means the pack needs a deliberately chosen subset or extra factual and tone checks. **Hold** means leave the pack out of that mode for the first playtest. Live eligibility follows the word-by-word review.

- **Two Truths and a Lie**
  - **Start with** Everyday, Food, Animals, Nature, Places, Jobs, Travel, Music, Sports, Gaming, Technology, and Hobbies. These have recognizable examples with more than one distinct fact to clue.
  - **Review selectively** Movies, Everyday chaos, Celebrations, Space & science, Emotions, Psychology, Social behavior, and Relationships. Movies needs a clear distinction between real and fictional facts. Abstract or context-dependent entries need statements the room can judge without generalizing about people. Relationships remains opt-in.
  - **Hold** Body & puberty, Sex education, and Consent. Keep deliberate false statements out of these packs in the first release.
- **If It Could Talk**
  - **Start with** Everyday, Food, Animals, Nature, Places, Travel, Movies, Music, Gaming, Technology, Everyday chaos, Hobbies, Celebrations, Space & science, and Emotions. These give players a clear thing or experience to speak as. For Space & science, favor recognizable objects and events.
  - **Review selectively** Jobs, Sports, Psychology, Social behavior, and Relationships. Pick entries with a distinctive perspective. Several abstract or social concepts can sound the same in first person, and an ordinary job description can give the answer away. Relationships remains opt-in.
  - **Hold** Body & puberty, Sex education, and Consent. Review any future opt-in set for both clue quality and tone.
- **Sell It**
  - **Start with** Everyday, Food, Places, Travel, Music, Gaming, Technology, Hobbies, and Celebrations. Focus on objects, destinations, tickets, classes, and recognizable benefits. Library can be pitched as a visit, Checkpoint as a game feature, and Bowling can be considered later as a night out.
  - **Review selectively** Nature, Jobs, Movies, Sports, Everyday chaos, and Space & science. Some entries work as a service, activity, attraction, or product. Others require players to invent a different subject just to use the opening line.
  - **Hold** Animals, Emotions, Psychology, Social behavior, Relationships, Body & puberty, Sex education, and Consent. The current packs mostly describe subjects that do not make for clear pitches, or would ask players to sell an awkward premise.

Illustrative batches for the initial review each contain ten actual catalog entries. **Two Truths and a Lie / Food** can start with Pizza, Sushi, Dumpling, Taco, Noodles, Ice cream, Popcorn, Bubble tea, Pancakes, and Waffle. **If It Could Talk / Everyday chaos** can start with Dead phone battery, Lost luggage, Spilled coffee, Burnt toast, Flat tire, Broken umbrella, Clogged sink, Leaking roof, Printer jam, and Stuck zipper. **Sell It / Technology** can start with Power bank, Smartphone, Laptop, Tablet, Keyboard, Mouse, Printer, Headphones, Scanner, and Walkie-talkie.

Before enabling a pack for any new rule, review each word for the actual clue format. Keep the existing minimum of **10 approved words per pack per rule**, with a short sample clue and a compatible hint that fits three to six plausible alternatives in that same pool. Add words to a worthwhile pack if it falls short, or keep it out of that rule. Preserve the opt-in controls, played-word deductions across rules, and fresh-deck eligibility checks. Keep editorial sample clues on the host side. The public reveal and help should teach the format using an example separate from the round’s hidden word and hint.

## Host skip for a spoiled round

- Put **Skip round** in the host’s round menu during rule reveal, topic selection, private roles, discussion, and voting. Keep it available while the round is paused. Use a confirmation with **Skip this round?**, **Everyone keeps their points**, the host’s **Random rules** on/off toggle, and **Skip and start**. The toggle starts with the current setting. The host can change it before confirming, and the replacement and its timer wait for that confirmation. Canceling the sheet discards any change made there. This covers a word said aloud by accident or an imposter revealing their role. Guests just follow the host’s decision.
- End the incomplete round and start a replacement round with a fresh round ID. Every replacement starts at the **Round Rule Reveal**. Draw from the feasible rules when random rules are on. Reveal **Classic** when they are off. Topic voting opens automatically after the reveal in either case. If someone is offline, the roster changed, or the deck needs attention, resolve that in the lobby first. The replacement still opens at the rule reveal once the party is ready.
- Preserve each player’s points, reading streak, session target, and any report deductions already pending from completed rounds. Clear the skipped round’s topic votes, roles, clues, suspect votes, and unsettled bets. Award zero points, charge zero stakes, and create zero Drink or Dare turns. A word already dealt remains used in the durable deck, and the existing role-selection history for dealt roles stays recorded. A skip before dealing consumes no word.
- Show **Round skipped. Scores are unchanged.** briefly to everyone as the replacement opens. Conceal any open private card immediately and switch all clients to the replacement or lobby without asking guests to tap.
- Make the action host-only and valid only before scoring commits. Serialize it with ballot resolution. If the skip wins the race, discard later actions for the old round. If the final ballot commits first, show Results and keep the completed score changes. Hide **Skip round** during Results and later stages. A repeat request must never skip the replacement round.

## One-ballot rule and scoring

- Every player in the round locks one suspect vote and can choose any other player in the round. Tally the civilian ballots only, giving **N − 1 counted votes** for **N** players at every supported party size from **3 to 12**. The imposter’s dummy ballot counts toward submission progress and satisfies their vote requirement. Its target has no effect on the accusation, tie, or score. Require the same submission flow for everyone so timing and progress give no clue about who the imposter is.
- On the imposter’s private ballot, show **Your vote is a dummy vote. It won’t count toward the tally.** Keep the same suspect rows, **Confirm vote** action, and locked confirmation as on the civilian ballot. Label the imposter’s optional wager **Bet on your escape** and explain **Escape to win your bet. Get caught and lose it.** Show both messages only to the imposter. Keep the public progress display based on everyone’s submissions and omit any split by role.
- If one player gets the most votes, that player is accused. The imposter is caught when that player is the real imposter and escapes when the group accuses a civilian. The highest count wins even when it falls short of a majority.
- If two or more players tie for the most votes, nobody is accused and the imposter escapes, including when the tied suspects are all civilians. After excluding the dummy vote, **1–1** with three players, **1–1–1** with four, and **2–2** with five all give the imposter an escape. **6–3–2** with twelve players produces one accusation.
- A civilian’s locked ballot determines their personal result, confidence bet, and reading streak. If they voted for the real imposter, they earn **+1 base point** and gain the amount wagered, even if the imposter escapes on a tie. A wrong guess loses the amount wagered.
- The imposter’s escape bet settles from the group verdict. On an escape, including a tie, award **+2 base points** plus the wager. On a catch, award **0 base points** and deduct the wager. Keep the separate **+1 perfect-bluff bonus** when no civilian voted for the imposter. The dummy ballot’s target has no effect on the wager.
- Both roles can choose **No bet**, **1**, **2**, or **3** before confirming. Default to **No bet**. Disable each amount above the player’s current balance. A player with 0 points can only choose **No bet**, and a player with 2 points can bet up to 2. The server validates the wager against the balance at submission, locks it with the ballot, and keeps the final score at 0 or above.

## Results reveal

### Shared verdict

- The last locked ballot starts a face-down envelope or card for everyone. Hold it for about one second to let the room notice the outcome is ready.
- Turn the card to reveal the imposter’s name and the group verdict. Use **Mia was caught** with a short burst, or **Mia escaped** with a quieter card-slip motion. For a tied vote, use the escaped layout and the verdict **It’s a tie. Mia escaped.** with **No one was accused.** as supporting copy. The verdict stays visible on the recap.
- Give the room about one second with the verdict before showing personal outcomes. A player who was away can read both on return from the same recap. The verdict wording and icon carry the outcome independently of color or motion.

### Personal outcome and recap

- Civilians see **You got it** or **You guessed wrong** based on their locked ballot. A civilian can see **You got it** and receive the correct-guess point alongside the shared **It’s a tie. Mia escaped.** verdict.
- The imposter sees **You escaped** or **You were caught**. After the personal message, show the secret word, expandable **Word meaning**, and the score breakdown for the player viewing it. Use **Escape bet** on the imposter’s own breakdown and show its gain or loss separately from the base score, perfect-bluff bonus, and penalties. Civilians keep their existing guess bet and streak breakdown.
- **Continue** and **Report a rule violation** appear when the recap is ready. Results has no timeout. Keep the headline, word, and score readable at rest. Opening a report or meaning leaves the recap available on return.

## Mockups to implement

Use the generated images in the [round flow gallery](round-flow-v1/README.md) as the visual references for the corresponding screens and reveal stages. Match their layout, hierarchy, and app styling using the existing components. Use this plan for exact behavior, timing, and copy where a mockup illustrates a sample state.

| Screen or reveal stage | Visual reference |
| --- | --- |
| Host lobby and kickoff | [Lobby with Random rules](round-flow-v1/21-lobby-random-rules.png). The host chooses the setting before starting. |
| Rule reveal · shuffle and landed rule | [Rule shuffle](round-flow-v1/01-rule-shuffle.png), [Classic](round-flow-v1/16-reveal-classic.png), [Act It](round-flow-v1/17-reveal-act-it.png), [Sound Only](round-flow-v1/02-rule-revealed.png), [Two Truths and a Lie](round-flow-v1/13-reveal-two-truths.png), [If It Could Talk](round-flow-v1/14-reveal-if-it-could-talk.png), and [Sell It](round-flow-v1/15-reveal-sell-it.png). The fixed Classic replacement opens on its landed face. |
| Topic voting and the concealed role card | [Filtered topic ballot](round-flow-v1/03-filtered-topic-ballot.png) and [Chosen topic on the concealed role card](round-flow-v1/04-chosen-topic-role-card.png). |
| Spoken clue turns and discussion | [Two Truths and a Lie](round-flow-v1/18-discussion-two-truths.png), [If It Could Talk](round-flow-v1/19-discussion-if-it-could-talk.png), and [Sell It](round-flow-v1/20-discussion-sell-it.png). The prompts guide face-to-face clues. Keep recording optional. |
| Suspect ballot, votes locking, and Results suspense | Reuse the [civilian ballot layout](../docs/screens/14-ballot.png). Follow the [private imposter ballot](round-flow-v1/24-imposter-ballot-escape-bet.png) for the dummy-vote note, escape bet, and disabled stake. Use [Votes locking](round-flow-v1/05-votes-locking.png) and [Results suspense](round-flow-v1/07-results-suspense.png) for shared progress. |
| Shared verdict | [Imposter caught](round-flow-v1/08-verdict-caught.png), [Imposter escaped](round-flow-v1/09-verdict-escaped.png), and [Tie escape](round-flow-v1/25-verdict-tie-escape.png). |
| Personal Results and optional reporting | [Civilian Results recap](round-flow-v1/10-results-recap.png), [Imposter escape bet win](round-flow-v1/26-imposter-recap-escape.png), [Imposter escape bet loss](round-flow-v1/27-imposter-recap-caught.png), and [Report sheet](round-flow-v1/11-report-sheet.png). **Continue** is a host action regardless of role. |
| Rankings and direct restart | [Rankings with Random rules and Next round](round-flow-v1/23-rankings-random-rules.png). |
| Host skip and confirmation | [Round settings with Skip round](round-flow-v1/28-host-round-menu.png) and [Skip confirmation with Random rules](round-flow-v1/22-skip-round-confirmation.png). |

The [runoff mockup](round-flow-v1/06-runoff.png) and the [earlier rankings mockup](round-flow-v1/12-rankings-next-round.png) remain in the gallery’s design history. The tie escape and rankings with the toggle are the current references.

## Implementation

### Authoritative round state

- Extend the existing rule enum, topic review and selection index, compatibility checks, and client rule labels for Two Truths and a Lie, If It Could Talk, and Sell It. Pick each new rule only when the host has enabled a reviewed pack with a currently usable word and hint for that rule. Keep an editable catalog approval separate from live eligibility so depleted or opt-in packs follow the same checks as the existing rules.

- Add explicit rule and Results reveal stages with a host-owned schedule keyed by party, round, and reveal. Return a server time reference or remaining stage time with the view. Start the rule reveal from the host action and the Results reveal from ballot resolution. The host process advances due stages once, independent of any client’s animation callbacks. Clients calculate presentation from the latest stage and ignore stale snapshots.
- Apply the host’s chosen random-rules setting at kickoff and freeze the selected rule and eligible topic pool for that round. A setting change after kickoff applies to a later round. The rule is shown before topic inputs are enabled. Freeze the topic winner and chosen word once. Route automatic dealing through the existing durable word-deck commit path in `crates/party-core/src/network.rs`. Publish private cards only after the deal is committed. A storage error keeps cards concealed and offers the host a retry for the same prepared deal. Duplicate requests and retries must not redraw or consume a second word.
- In `crates/party-core/src/game.rs`, keep one locked submission for each player and derive the tally on the server by excluding the actor with the authoritative imposter role. Use the full roster for completion and shared progress. Keep role-specific ballot guidance in the imposter’s private view. Permit stakes of 0–3 for both roles, enforce the available balance on the server, and settle the imposter’s stake from the verdict once. Preserve the stake on an approved reconnect. Keep Drink or Dare eligibility based on the base outcome, independent of wagers and bonuses. Remove the runoff phase, candidate list, second ballot, and associated UI from the new flow. Track a tied vote as an explicit verdict reason so the escape card can show the right copy. During suspense, views contain no shared imposter identity, word, personal result, score delta, or punishment details. At the verdict stage, expose only the imposter identity and the verdict, including whether it was a tie. Make the word, personal result, and updated scores available in the recap stage. Treat player totals, earned points, and session winner fields as part of the staged disclosure, including on reconnect. Keep other players’ ballots and stakes private.
- Accept optional report submission only while the recap is open. Keep one private locked submission per player and the full round roster as the majority denominator. The host’s Continue action atomically closes reporting, schedules applicable deductions under the existing rules, and selects Drink or Dare or rankings. If a report and Continue race, the server decides which arrived first and gives a clear response for late submissions. Retries cannot apply reports, penalties, or phase transitions twice.
- Share first-round and direct-repeat start validation. Check roster, connection, minimum player count, settings, and deck availability again on the host when **Next round** is pressed. If validation fails, show the existing lobby controls with the reason. Preserve session scores, word history, and imposter selection history across repeats. Keep the existing score reset behavior when a new session starts.
- Reuse the existing abandon cleanup and round-start validation for **Skip round**. Protect acceptance of the confirmation’s chosen setting, cleanup, and replacement kickoff as one host-controlled transition. Route replacement rounds through the rule reveal for both random and fixed Classic rules. When a restart falls back to the lobby, invalidate the skipped round’s outstanding requests and retain the replacement’s reveal entry point until kickoff. The host can review the setting again in the lobby before starting.

### Screens, motion, and recovery

- Update `src/App.tsx` and `src/types.ts` for the new stages. Reuse the existing rule screen, role card, ballot, results composition, report player rows, and motion primitives. Remove redundant action buttons from the new flow. Keep invitation and reconnect controls accessible at the places players already expect them.
- Render both reveals from the authoritative stage. Phones connected before the reveal should see the same beats together within normal LAN polling and rendering delay. A reconnect during a reveal joins at the current beat. Returning after it finishes lands on the ballot or recap. Refreshing, backgrounding, reconnecting, or opening a second tab does not restart the room’s sequence or replay a finished celebration.
- Honor reduced motion. Show the selected rule immediately on arrival at the reveal screen and keep the same reading opportunity. On Results, switch to each scheduled beat without flipping, sliding, or particle effects. Announce the verdict and personal outcome once, keep focus stable, and make the final recap readable with a screen reader. Preserve immediate private-card concealment when backgrounded.
- Before dealing, preserve topic participation and host removal options when an offline player holds up a ballot. Before or after automatic dealing, retain the existing pause and recovery rules for incomplete rounds. Use the fixed same-name browser recovery path with host approval. If a disconnected player reconnects during voting, restore the selected or locked ballot as supported today. Someone who was permanently removed cannot block a future repeat round.
- Review compatibility before release. Browser clients load the updated assets from the host. Installed native clients must either negotiate support for the new stages or receive a clear update requirement before joining. Verify that an older client cannot enter a phase it cannot render.

## Verification and rollout

Cover escape and catch with each stake from 0 to 3, a tied escape, and a perfect bluff with a wager. At balances of 0–3, check the disabled options in the UI and reject unaffordable stakes on the server. Verify that reconnect and action retries preserve the original stake and that the imposter can see their own escape bet while other players cannot. Include an example where a 3-point escape bet gives **+5** on an escape without a perfect bluff and **−3** on a catch.

Test **Skip round** before and after a deal, after a bet is locked, while paused, and when a guest is offline. Confirm that both random and fixed Classic replacements open on the rule reveal and advance to topic voting without a host tap. Check the same reveal entry point after a lobby fallback. Assert that balances, streaks, and pending deductions are preserved, that a dealt word stays used, and that an undealt word remains available. Test a duplicate skip, guest denial, stale actions from the old round, and both orders of the skip versus final-vote race.

Verify the host can choose Random rules on or off before starting from the lobby, rankings, and the skip confirmation. Verify canceling the skip confirmation leaves the existing setting and round in place. Confirm the timed reveal begins at kickoff and opens topic voting automatically.

1. **Core and transport tests.** Cover invalid, stale, and repeated phase actions, one automatic transition under concurrent final submissions, one uniform topic draw on ties, and durable deck commit and retry. Exercise the suspect tally at every size from three to twelve. Test a dummy ballot that would break a civilian tie and one that would create a tie if counted. Confirm both keep the civilian verdict and that the dummy ballot counts as exactly one submission. Verify a unique winner, ties with and without the imposter among the tied suspects, correct civilian guesses on ties, and one settlement of scores, bets, streaks, and bonuses. Cover staged field visibility, reports racing with Continue, both Drink or Dare queue paths, and repeat validation when the roster or deck changes.
2. **Multiplayer browser and native smoke tests.** Exercise the first round, a repeat round, all six rules, random rules off, a tied topic vote, a tied suspect vote, correct and incorrect guesses, reporting and no reporting, the score target, and reconnect at each reveal beat. Check each new rule’s instructions and filtered topic ballot. Playtest whether three short statements per turn fit the room’s pace. Verify the private dummy-vote message, the imposter’s locked submission after reconnect, and the same shared progress for every device. Confirm the roles, scores, and locked ballots survive approved recovery and that the old browser credential remains revoked. Run at three and twelve players and verify the four-player tap count, including a **1–1–1** civilian tie with no extra taps.
3. **Visual and accessibility check.** Compare the implemented screens with the linked mockups on compact phones, with long player names and reduced motion. Include the tie-specific escaped card and the private imposter ballot. Use Chromium and WebKit for browser guests and the Android emulator for the packaged app. In the next physical playtest, check whether people still notice both reveals when looking up from their phones, whether the host stays in the conversation, and how often the two civilian votes split **1–1** in three-player rounds.
4. **Release readiness.** Run the existing content, frontend, Rust, reconnect, scoring, and word-deck suites. Update the play guide and motion spec to match the implemented flow. Build the Android preview after verification and include the supported native guest versions in its release notes.
