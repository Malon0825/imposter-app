# Reference app — observed flow

Reviewed 2026-11-01. Evidence: all 18 supplied screenshots. Conclusions describe visible UI, not verified runtime behavior. Screenshot links are relative to this document.

## Entry and setup

- [121940](reference-images/Screenshot_20261101_121940.jpg): branded welcome, Get Started, How to Play.
- [121945](reference-images/Screenshot_20261101_121945.jpg): setup with 4 players, 1 imposter, 3:00 duration, settings/help, Start Game.
- [121950](reference-images/Screenshot_20261101_121950.jpg): player list containing YT, Myz, R, Mark; delete controls and Add Player. The name-entry interaction is not shown.

## Rules tutorial

- [122016](reference-images/Screenshot_20261101_122016.jpg): choose one or more topics.
- [122020](reference-images/Screenshot_20261101_122020.jpg): civilians see the secret word; the imposter does not.
- [122025](reference-images/Screenshot_20261101_122025.jpg): give hints; imposter tries to blend in.
- [122032](reference-images/Screenshot_20261101_122032.jpg): vote; guessing correctly gives civilians victory, incorrectly gives the imposter victory.

The progress indicators vary between captures; do not infer their exact implementation or navigation from static images.

## Topics

- [122039](reference-images/Screenshot_20261101_122039.jpg): topic list with Daily Life, Celebrities, Nature, Food; some show lock icons; Show Hint to Imposter toggle; Continue.

The lock icons suggest restricted content, but pricing, unlock method, and selection styling are not established by the screenshot.

## Shared-phone role distribution

- [122051](reference-images/Screenshot_20261101_122051.jpg): YT name, upward arrow, Next Player.
- [122054](reference-images/Screenshot_20261101_122054.jpg): downward arrow; Civilian role; secret word Wallet.
- [122104](reference-images/Screenshot_20261101_122104.jpg): Myz name; Slide Up to Reveal.
- [122109](reference-images/Screenshot_20261101_122109.jpg): Civilian role and Wallet revealed.

Likely interaction: each named player receives the phone, swipes up to inspect a concealed role, then hides it / advances before handing it over. Exact gesture thresholds and hide behavior cannot be verified. The imposter role screen is not captured.

## Active play and accusation

- [122121](reference-images/Screenshot_20261101_122121.jpg): Get Ready countdown showing 3.
- [122126](reference-images/Screenshot_20261101_122126.jpg): Myz Starts, countdown at 1:57, instruction to stop when the group thinks it found the imposter, Stop control.
- [122136](reference-images/Screenshot_20261101_122136.jpg): Time to Vote, list of players, Resume Game appears dimmed.
- [122141](reference-images/Screenshot_20261101_122141.jpg): Mark selected; Vote control; Resume Game still appears dimmed.

This supports a group accusation entered on one phone. It does not demonstrate separate ballots, tallying, or whether Resume Game is actually available in another state.

## Results

- [122146](reference-images/Screenshot_20261101_122146.jpg): You Caught the Imposter, civilians win, Play Again.
- [122148](reference-images/Screenshot_20261101_122148.jpg): another capture of the same result with confetti animation.

## Gaps to resolve in our own game

Not shown: settings contents; wrong-accusation result; timer expiry; role assignment algorithm; minimum/maximum players; multiple-imposter rules; exact hint content; last-chance guesses; persistence; exit confirmations; replay destination; monetization details.

## UX opportunities inferred from the images

- Large artwork occupies much of setup and timer screens; the actionable information could be easier to scan.
- Role reveal relies on gesture understanding; explicit instructions and an accessible alternative would help.
- Topic selection state and lock meaning deserve clearer labels.
- A group accusation is simple, but private per-phone voting could give each player an independent choice.
- Red is used for branding, actions, selection, and victory copy; our design should give each state a clear meaning beyond color.
- The reference's emotional appeal is worth preserving: fast setup, secret identity, suspense, and a satisfying collective reveal.
