# Sound set v1

Status: approved and built into the app in M1 (2026-11-25, branch `claude/power-cards`): `src/sound.ts` and `src/sound-set.js`. This folder is the audition record.

Every sound is synthesised in code with the Web Audio API (`sound.js`): no audio files, nothing to license, nothing to download, and it works offline. The sound board (`index.html`) plays each one and can play a whole round in order.

**Listen:** start the `power-cards-mockups` preview (python http.server on `design/`, port 8800) and open `http://localhost:8800/sound-v1/`. Use headphones or a phone speaker; laptop speakers lose the low thuds and heartbeats.

## Rules

1. **No music.** No background music or loops. The session-complete flourish is the only musical moment.
2. **Short.** Personal sounds stay under a second. Shared sounds run up to about 1.5 s; the vote heartbeat runs only until the last ballot locks.
3. **No secrets.** No sound may reveal a tier you drew, a role, or a private read. Tier sounds play only when the tier is already public (the play announcement).
4. **Shared sounds are synced.** The host sets a start time, as with the results beats today, and every phone plays it at that time. They're mostly percussive hits, so small offsets between phones merge into one bigger hit. A phone more than about 300 ms late skips the sound instead of echoing it.
5. **Settings.** A Sound switch, on by default at moderate volume. iPhone browser guests unlock audio with their first tap ("I'm ready").

## The set (21 sounds)

| Sound | Who hears it | Length | Moment |
|---|---|---|---|
| Rule shuffle | Every phone | 1.2 s | The round's rule is drawn |
| Card played: Common / Rare / **Golden** | Every phone | 0.1 / 0.8 / 1.4 s | The play announcement; Golden is the signature impact and gong |
| Last votes (heartbeat) | Every phone | up to 3.9 s | Speeds up 70 → 110 bpm until the last vote locks |
| Result suspense | Every phone | 2.1 s | Three heartbeats while the envelope breathes |
| Verdict: caught / escaped | Every phone | 0.4 / 1.2 s | Gavel bang, or door creak and slam |
| Evidence stamp | Every phone | 0.2 s | Each card in the results replay |
| Bluff exposed | Every phone | 1.2 s | Comic womp when a Bluff Card turns up |
| Bounty paid | Every phone | 0.7 s | Coins when PAID lands |
| Drink or Dare | Every phone | 1.4 s | Snare roll at each turn |
| Session complete | Every phone | 1.3 s | Brass flourish and confetti pops |
| Button tap, bet chip, case file | Your phone | under 0.35 s | Taps, bet steps, adding a card |
| Draw, reveal | Your phone | 0.5 s each | Same for every tier |
| Lock your vote | Your phone | 0.2 s | Wax-seal press |
| Your result: win / loss | Your phone | 0.5 / 0.3 s | Your own result beat |

**Deliberately silent:** the "you can play a card now" nudge, private reads beyond the tap, your role and word cards, and any tier-specific sound on your own draw.

## Verified

Each sound renders offline (OfflineAudioContext) with no errors and no clipping (loudest peak 0.76, the Golden impact). The quiet clicks were raised after measuring. Whether they *sound* right still needs a listen on real phones.

## If a sound doesn't convince

Tune it in `sound.js` (pitch, length and volume are plain numbers), or swap that one for a free-licence (CC0) sample. Kenney's packs are a good source; the owner would download them. Everything else stays synthesised.

## Porting to the app

`sound.js` ports almost unchanged to `src/sound.ts`. Personal sounds play on the tap. Shared sounds take the host's scheduled time from the round state, the same way `result_reveal` beats are timed, and are skipped if the phone joins more than about 300 ms late. Reduced motion doesn't mute sound; the Sound switch does.
