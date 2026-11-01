# IMPOSTER — UI proposal v1

Six generated image boards covering 24 screen/state concepts. Created and approved 2026-11-01. These are the approved visual references for the implemented app. QR codes, camera imagery, connection states, and player data in these boards are illustrative; the app uses real party data, invitations, and native device actions.

## Read in this order

1. [Host a party](01-host-party.png): welcome, creation, background-usage explanation, host lobby.
2. [Join a party](02-join-party.png): scanning, same-router Wi-Fi instructions, player identity, guest lobby.
3. [Topics and private roles](03-topics-and-roles.png): topic selection, concealed role, civilian view, imposter view. The last two phones are alternative private device views, not consecutive steps for one player. Topic selection returns to the lobby before Start round.
4. [Voting and results](04-voting-and-results.png): untimed discussion, secret ballot, locked vote, personal result.
5. [Punishment and rankings](05-punishment-and-rankings.png): loser chooses, dare giver named, next loser's drink screen, cumulative standings.
6. [Branches and ending](06-branches-and-ending.png): optional runoff, interrupted connection, final rankings, help. These are independent states, not a chronological sequence.

## Visual proposal

Android-first, charcoal surfaces, ivory text, lime actions, muted sage secondary content, terracotta negative-state emphasis. A tactile eye-bearing secret-card motif ties welcome, private roles, and voting together. The app implements the approved screen interiors; presentation device frames and illustrative OS bars belong only to these boards. Implementation tokens live in ../../DESIGN.md.

## Motion intent illustrated by the boards

- Ordinary forward navigation: short slide/fade, around 240ms.
- Contextual sheets: rise from the bottom without losing the parent context.
- Private reveal: intentional card turn, around 420ms; separate civilian/imposter content.
- Vote confirmation: envelope closes; selection cannot be changed afterward.
- Results: shared phase change with a short reveal, around 500ms.
- Punishment: one active player at a time; crossfade to the next named participant.
- Rankings: totals settle/count up only as presentation; scoring must already be committed exactly once.
- Reconnecting: calm status transition; no game countdown.
- Reduced motion: replace movement with immediate state changes or simple fades.

## Sample round continuity

Alex is the host and a civilian. Sam is the imposter and receives Paws while civilians receive Dog. Alex votes for Mia. Sam escapes, earning +2; Mia guesses Sam correctly, earning +1; Alex and Ben earn zero. Alex and Ben take punishment turns. On Dare, Sam is named as Alex's dare giver; the dare itself is invented and communicated outside the app. Tied-vote screen is explicitly a separate round/branch.

## Review notes

- These images show composition and flow; motion annotations are proposals, not actual playback.
- The topic page uses representative packs rather than fitting all 22 packs into one viewport.
- The background screen explains the desired setup; platform permission/settings behavior still needs the planned device spike.
- Reconnecting language refers to retaining identity and committed score in the active party, not recovery after a destroyed host session.
- Illustration, copy, and small icon details can be refined after direction approval. Original generated files remain preserved outside the project; the six review deliverables are copied here.
