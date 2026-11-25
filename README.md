# IMPOSTER

An Android-first, local multiplayer party game built with Tauri 2, Rust, React, and TypeScript. Each player uses their own phone. One phone hosts the party; everyone joins its reachable local Wi-Fi network using an invitation QR code. No account or internet service is required for native play.

Version 1.2.0 made every round Full Cast: each player gets a secret role, from 3 to 12 players. Version 1.2.1 makes the Accomplice easier to play. It also adds random round rules, a self-running round flow and the word deck. Version 1.1.0 added offline browser guests. Only the Android host needs the app: iPhone and Android guests can open the same invitation in their default browser, while installed Android guests can scan it inside Imposter. The host bundles and serves every guest page, font, and image. See [browser guest setup and verification](design/WEB-GUEST-IMPLEMENTATION.md). Physical iPhone and shared-router checks remain unverified; this build is a browser-guest preview.

The interface implements the [approved screen designs](design/proposal-v1/README.md): charcoal, ivory, lime, tactile secret-card artwork, animated role reveals, short page transitions, bottom sheets, sequential punishment turns, and animated standings. Fonts and artwork are bundled for offline use. Reduced-motion preferences are respected.

The [single-page website](docs/README.md) includes 26 actual app screenshots, game rules, installation help, and direct 1.1.0 APK downloads. Its static source is in `docs/`; the repository owner can publish it by selecting **main → /docs** in [GitHub Pages settings](https://github.com/Malon0825/imposter-app/settings/pages).

The [visual comparison review](design/VISUAL-REVIEW.md) links all 24 before/after screenshots, the side-by-side proposal gallery, and compact/tall phone captures. Open the live gallery at `http://127.0.0.1:1428/output/playwright/visual-review/index.html` while the preview is running.

## Play

1. Download **imposter-1.2.1-android.apk** from the [v1.2.1 release](https://github.com/Malon0825/imposter-app/releases/tag/v1.2.1) on the Android host, open it, and allow installation from your browser when Android asks. Android guests may also install it; browser guests need no installation. Connect everyone to the same reachable router's Wi-Fi. The signed APK includes ARM64 phones and x86_64 emulators; minimum Android 8 / API 26. Native Android guests need 1.2.1 as well. Older installs are turned away and can join in the browser instead.
2. Choose **Host party**, enter a name, and label the shared Wi-Fi. The host can enable background hosting with an ongoing notification, visit battery settings, or choose to keep the app open.
3. Guests scan the host's QR using their Camera/QR reader to join through their chosen browser, or use **Join party → Scan invitation** inside the updated Android app to play natively. Android browser joining also offers **Open in Imposter** where supported. Enter a unique name and mark ready. Tapping the host's QR enlarges it; copy/paste is supported. Browser traffic uses unencrypted local HTTP, so use Wi-Fi you trust.
4. From the lobby, choose whether to use **Random rules** and start with 3–12 ready players. A random rule reveal advances automatically to compatible topic voting. Everyone chooses and locks one or more topics. The highest approval count wins, with an automatic draw among tied leaders. Private cards appear automatically after the deal is saved. Each player first sees their secret role, then their card; hide it to ready up. Word holders can swipe left or tap **Swipe for meaning**. The imposter sees a hint.
5. Give clues face to face using the round’s rule. Clue logging and additional clue turns are optional. Tap **Check my card** to return to a concealed role card. The host opens the private ballot when the group is ready. A spoiled round can be skipped from **Round settings**. Scores stay in place, and the replacement always opens on a rule reveal.
6. Select a suspect and optionally bet up to three points from your balance. Some roles name more than a suspect. From five players the imposter names no suspect at all: only who they think their accomplice and the decoy are. The Detective names the accomplice as well as a suspect. The imposter's own ballot never counts toward the tally. A tie at the top gives the imposter an escape unless the Judge's ballot breaks it toward the imposter. Everyone’s last locked submission starts each player's own result, then the room's.
7. From Results, privately report rule-breaking if needed. The host taps **Continue** to close reporting and open Drink or Dare or rankings. **Next round** can start directly from rankings when the same roster is connected.

If a browser guest accidentally closes their tab, scan the same party QR again in the same browser to restore their player automatically. The host can open the QR during a round, including while a disconnected player has paused play. Roles, ready status, locked votes, punishment turns, and scores stay on the host.

Connected players stay on their current game screen when someone disconnects. A small status strip names each disconnected player, with the same label beside their name in the roster and ballot. The server waits before advancing the round or accepting votes, while selections and locked votes stay in place and private cards can still be hidden. The labels clear automatically when players reconnect. Only a player who loses their own host connection sees the reconnect page; an intentional host pause still uses the pause screen.

If the scan opens a different browser or saved site data is missing, choose **Reconnect my player** and enter your original player name. Entering an existing browser player's name on the lobby join form also starts recovery. The host compares the six-character code on both screens and can approve immediately. Approval restores the existing player and revokes their old browser credentials. Requests expire after two minutes. Players who left or were removed cannot recover that place, and restarting the host still ends the party.

Every round is **Full Cast**: everyone holds a secret role, at every size from 3 to 12 players.

| Players | Roles dealt |
|---|---|
| 3 | Imposter, Decoy, Gambler |
| 4 | Imposter, Decoy, Judge, Gambler |
| 5 | Imposter, Accomplice, Detective, Judge, Decoy |
| 6+ | Imposter, Accomplice, Detective, Judge, Decoy, and a Gambler for every extra player |

Roles are dealt with private fairness weights: players who have held a role less often are more likely to get it, and the previous holder is less likely, though repeats stay possible. The history stays private, survives reconnects, and resets when the party ends.

- **Imposter** sees a hint instead of the word. Escaping earns **+2**, plus **+1** if no ballot named them. From five players they also name their accomplice (+1 to both when they escape together and the Detective missed the accomplice) and the decoy (spotting the decoy voids the decoy's gains and adds +1 when the imposter escapes).
- **Accomplice** (5+) knows the word and the imposter, and wins **+1** with the escape. Their ballot counts like anyone's, so in a close vote it can tip the room onto someone else; the ballot screen explains this. If the Detective names them, their gains are void.
- **Detective** (5+) is told one player who is on neither villain's side, and names the accomplice alongside the suspect: **+1** for the imposter and **+1** for the accomplice. The Detective's bet rides on the accomplice.
- **Judge** (4+) earns **+2** for a correct read. In a tie their ballot decides, but only toward the imposter. From six players it also counts twice.
- **Decoy**: from five players they hold a related word and score **+1** for a correct read and **+1** when the imposter is caught; spotted by the imposter, they gain nothing. Below five they hold the real word and play as bait: **+1** for a correct read and **+1** if any counted ballot named them, but nothing if the room convicts them.
- **Gambler** earns **+1** for a correct read; their top bet pays **+5** against a 3-point loss.

Self-votes are disallowed. Bets settle individually: a winning wager gains the stake and a losing one deducts it.

Every player who lost their round, by their role's own measure, enters a randomly ordered punishment queue. Only the current player controls their choice. Dare names a randomly selected, connected player to invent the dare in person. The app contains no dare prompts, text submission, or dare verification. Skipping never changes points.

Reporting opens as an optional sheet on Results. Reports are locked on submission, private to their author, and reset each round. Each reported player can receive at most one deduction from a round's reports; report counts and pending outcomes are not shown. Round 3 reports affect Round 4 results, separately from earned points, and never add punishment turns. Scores stay at zero or above. Abandoned rounds do not consume pending deductions; ending the party discards any still pending. Reconnecting restores submitted reports.

## Power cards

With 6 or more players the host can turn on power cards: 37 cards in three tiers (15 Common, 12 Rare, 10 Golden), drawn before roles for 3 points (free for Underdogs), one active card per round. The rules are in [power-card-review-v11.xlsx](design/power-cards-v1/power-card-review-v11.xlsx), which generates `crates/party-core/content/cards.json`. [ROLE-MECHANICS.md](design/power-cards-v1/ROLE-MECHANICS.md) records how each role works at a card table.

## Topic voting before every round

The host taps **Start round** once everyone is ready. Each player selects one or more available topics and locks their ballot. Every selected topic receives one approval, with no vote splitting. Only submission progress is public until everyone votes.

The highest total wins. Tied leaders enter one equal-chance draw: two leaders have 50% each, three have 1 in 3 each. The host draws tied leaders and deals private cards automatically. The selected topic survives reloads and reconnects. Each new round starts with an empty ballot; usual word-repeat avoidance remains active. Opt-in packs are excluded by default and can be enabled in **Topic settings**.

See the [round flow plan and mockups](design/ROUND-FLOW-IMPLEMENTATION-PLAN.md). Run `scripts/round-flow-v2-smoke.js` with the Playwright CLI against the development bridge to exercise this flow with mixed native and browser guests. The fixture also covers all six rule reveals and their filtered topic ballots, and runs in both Chromium and WebKit.

## Random round rules and the word deck

The current source catalog has **581 words across 23 topics**, including 29 additions reviewed on 2026-11-17. Words are reviewed separately for each of the six rules; [the mode inventory](TOPIC-MODES.md) lists the results and [the topic guide](TOPICS.md) explains the review policy. There are 23 playable Classic topics, 21 Act It topics, 14 Sound Only topics, and two starter topics for each new spoken rule. Each playable topic/mode pool has at least 10 words, with mode-specific imposter hints reviewed against that same pool.

The host can turn **Random rules** on before kickoff. The draw includes Classic, Act It, Sound Only, Two Truths and a Lie, If It Could Talk, and Sell It when available. The reveal ends automatically before compatible topic voting. A setting change during play takes effect next round. Act It and Sound Only happen in person and offer an optional **Performed** marker on the clue board.

The word deck saves played words and equivalent concepts on the hosting device across modes, score sessions, parties, and app restarts. Related meanings stay apart for six dealt rounds and similar performances in the same mode stay apart for four. Each imposter hint is checked against the remaining eligible answers. If the enabled packs run out of fair choices, enable more packs or choose **Start fresh word deck** in lobby settings. Previously released builds have no deck history to import. [Implementation plan and mockups](design/random-round-rules-v1/README.md)

Run `node scripts/word-deck-smoke.mjs` after building the frontend and the `party-dev` binary to test persistence in an isolated database across real process restarts. Set `IMPOSTER_DEV_HISTORY` to a local SQLite path to opt a development bridge into persistent play. The Android host uses its private app data automatically.

Run `npm run test:content` for the catalog, mode-review and stale-report checks plus negative validation tests. `npm test` includes these checks before the frontend build and Rust suite. Python 3 is required for content checks. Regenerate the inventory after edits with `python scripts/prepare-content.py --write-mode-report`.

## Run the browser preview

Install Node.js, Rust, and the native build prerequisites for your operating system. On Windows, the standard setup is Visual Studio C++ Build Tools with a Windows SDK. The environment helpers also recognize the portable toolchain already prepared in this workspace; those ignored local tools are not project dependencies.

```powershell
npm ci
npm run build
npm run dev:server
```

In a second terminal:

```powershell
npm run dev
```

Open `http://127.0.0.1:1428`. The browser preview calls a loopback-only development bridge on port 3142, which runs the real Rust rules and encrypted party transport. Each browser tab has its own player session. Use **Enter invitation instead** for multi-tab play. Android settings and camera integration are exercised in the installed app.

## Build Android

Install Android Studio with its JDK, Android SDK platform 36, and an NDK. This workspace was built with JDK 21, NDK 29.0.13846066, compile/target SDK 36, and the committed Gradle wrapper. Set `JAVA_HOME`, `ANDROID_HOME`, and `NDK_HOME` if they differ from the standard Windows locations.

```powershell
rustup target add aarch64-linux-android x86_64-linux-android
npm ci
npm run android:build
```

The Windows build script compiles the bundled frontend and both Rust architectures, generates local Gradle dependency paths, copies native libraries without requiring Windows symbolic-link privileges, and produces the installable versioned debug APK in `releases/`. Native Android customizations are committed under `src-tauri/gen/android`; preserve them when regenerating Tauri projects.

For a signed, optimized APK, create a signing key once and reuse it for every update:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-android-signing-key.ps1
npm run android:release
```

The key is stored outside this repository in `%LOCALAPPDATA%/Imposter/signing/`; its password is encrypted for the current Windows user. Back up signing material securely. Existing signing setups can instead supply `IMPOSTER_KEYSTORE`, `IMPOSTER_KEY_ALIAS`, and `IMPOSTER_KEYSTORE_PASSWORD`. The release build aligns the APK for 16 KB pages, signs it, verifies alignment/signatures, and writes `releases/imposter-<version>-android.apk` plus a SHA-256 checksum. Signing keys, passwords, and build outputs are excluded from Git. A release APK uses a different key from a local debug build; uninstall the debug build before installing the release for the first time.

For a side-by-side preview, run `scripts/create-android-signing-key.ps1 -Preview` once and then `npm run android:preview`. This builds and signs `imposter-<version>-android-preview.apk` using a separate key and the `com.imposter.party.preview` application ID. Android lists it as **Imposter Preview** and keeps its app data separate.

For iterative native development, use `npm run android:dev` after configuring Android tooling. Tauri's normal development command may require Windows Developer Mode for symbolic links. iOS has not been generated, built, or tested and remains a later milestone.

## Structure and authority

- `src/`: responsive screens, motion, role concealment, QR flow, and native/browser API adapter.
- `crates/party-core/`: authoritative game state, authored offline content, private per-player views, authenticated LAN server/client, and tests.
- `src-tauri/`: app commands and native integration. Android's foreground hosting service, Wi-Fi routing, permission requests, settings, screen privacy, and back-button handling live in the Android project.
- `design/proposal-v1/`: the six approved design boards. `DESIGN.md` records the implementation tokens; `PLAN.md` preserves the brainstorm.
- `scripts/`: repeatable build helpers and the browser game-flow check.

The host creates a self-signed TLS certificate for each party. The QR invitation carries the pinned certificate, reachable private IPv4 endpoint, admission token, party identity, Wi-Fi label, and expiry. Native guests trust that certificate for this party only. Server authentication and private player credentials gate state/actions. Secrets are filtered by the host before reaching a guest: no other role, word, hint, or partial ballot is included in their response. The host remains trusted because it orchestrates the game.

Clients poll revisioned HTTPS state every 600 ms; actions carry unique IDs and round IDs to reject duplicates or stale input. This replaces the initial WebSocket proposal. Internal reachability checks pause interrupted rounds; they are not game timers. Guests reconnect with the same saved identity. Native storage saves only session credentials, not rendered secret cards. Revealed cards conceal when the screen backgrounds; Android uses secure-screen protection.

Party state and scores live in host memory. Force stopping or killing the host ends the party; host migration, cross-router discovery, IPv6-only networks, hotspot mode, and persistent party history are outside this version. The Wi-Fi check verifies Wi-Fi transport and host reachability; isolated/guest router networks may block local access. The displayed Wi-Fi label is supplied by the host rather than read as a verified SSID.

## Verification

```powershell
npm test
```

This builds the frontend and runs the Rust test suite covering scoring, ties, role privacy throughout active rounds, ready gates, duplicate/stale actions, disconnect/reconnect, punishment ownership, content integrity, real TLS clients, certificate trust, shared invitations, production browser authorization/recovery, mixed-client games, and server shutdown. Recovery regressions verify host approval, request expiry and rejection, credential rotation, private proof handling, preserved roles/scores/locked votes, and removed-player protection.

With both preview processes running and a Playwright CLI browser session open at the preview URL, the browser scenario can be replayed using:

```powershell
npx --package @playwright/cli playwright-cli -s=imposter open http://127.0.0.1:1428
npx --package @playwright/cli playwright-cli -s=imposter run-code --filename=scripts/ui-smoke.js
```

The scenario creates four players, plays two rounds, checks concealed/private cards, a single ballot and a 1-1-1 tie escape that the Judge cannot break, checks every phone's points against the host's settled round, plus a delayed majority-report deduction, completes human-given dare/drink turns, and verifies final rankings persist when the host returns home. Reporting checks cover multiple selected players, skips, and a submitted ballot surviving reload. It writes screenshots under `output/playwright/`.

Reporting verification: the production build and all 24 Rust tests pass, including strict full-roster majorities for 4/5 players, missing/skip ballots, report privacy and validation, retry/reconnect protection, negative totals, and pending penalties surviving abandonment or expiring on party end. The live four-player/two-round flow and mixed native/browser guest flow passed. The new report, submitted, skipped, and deduction screens fit 360 × 700; 12-player selection with long names remains scrollable without horizontal overflow at 320px. Keyboard Space selection, repeated toggles, press/rest motion, and reduced motion were checked in the browser. These changes have not yet been packaged or tested in a rebuilt Android APK.

Run `scripts/full-cast-smoke.js` the same way to play a round at 3, 4 and 5 players in separate browser contexts. It checks the lobby lineup, every role screen and its size-specific wording, the imposter's and Detective's extra picks, each player's own result and the room's results. Screenshots go to `output/playwright/full-cast-*.png`. The other round smokes step past the role screen and each player's own result. They read each player's role, so ties and point checks hold for every lineup. `native-web-smoke` needs its own native test server, and the motion and visual-capture scripts use staged sample states that still predate Full Cast.

Card rules live in `design/power-cards-v1/power-card-review-v11.xlsx` (regenerate `cards.json` with `scripts/cards-from-sheet.py`). Before changing a card, read [ROLE-MECHANICS.md](design/power-cards-v1/ROLE-MECHANICS.md): it records what each role's ballot actually does at a card table (6+ players), including that the Imposter's ballot never names a suspect.

Run `scripts/power-cards-smoke.js` the same way for power cards with six players: the host's switch, the draw window (draw, sealed reveal, skip), a role-reveal card, a discussion card, a ballot card with Cold Feet, and a caught Imposter's Last Word. It needs the debug dev bridge, because it deals cards with the debug-only `dev_cards` action. `scripts/revamp-capture.js` plays a 6-player round and captures every noir-themed screen. Screenshots go to `output/playwright/power-cards/` and `output/playwright/revamp/`.

To playtest a whole table by yourself, open `http://localhost:1428/playtest.html` with both previews running (`app-api` must be the debug dev bridge). It creates a 7-player party (Host plus six guests), readies everyone, turns power cards on, gives everyone 5 points and a starter hand, and shows all seven phones on one page: play the big one, click a small one to bring it up. Each phone is its own `seatN.localhost` origin, so every player keeps their own session, and only the host's phone plays sound. **New table** starts over. Dev only; not part of the build.

Run `scripts/cards-capture.js` the same way to capture every power-card screen at 360 and 390 wide (`output/playwright/cards-360/`, `cards-390/`). On each screen it checks that the page and every sheet never scroll sideways and that nothing sits past the screen edge outside a row meant to scroll; it returns the problems it finds.

To check card text, open `http://127.0.0.1:1428/card-gallery.html?lang=fil&w=210` with the preview running: every card at that width in Filipino (or `lang=en`), with any face whose text doesn't fit outlined in red. It is a dev page only and isn't part of the build. After editing card text in `design/power-cards-v1/power-card-review-v11.xlsx`, run `python scripts/cards-from-sheet.py`.

Run `scripts/reconnect-smoke.js` with the same Playwright CLI `run-code --filename` command to check tab-close QR rescanning, the interrupted-round QR, missing-storage recovery with matching host approval codes, recovery-request reloads, lost approval responses, and retrying a failed startup without erasing the saved identity. It also verifies that connected players keep their role/discussion/voting screens, disconnected players are labeled, cards remain concealable, selected and locked votes survive, and round actions wait for reconnection.

Use `scripts/party-load-smoke.js` to hold a party of eight at the client's real poll rate and report failures, latency percentiles and any player the host dropped, and `scripts/presence-blip-smoke.js` to confirm a short network blip does not throw a player onto the reconnect screen while a sustained outage still does.

Use `scripts/shared-link-smoke.js` to confirm a party link pasted into a group chat survives the chat app's redirect and joins cleanly from fresh in-app browsers on iPhone and Android.

Use `scripts/card-recheck-smoke.js` to verify that ready players, civilians, and the imposter can recheck their own card through discussion, voting, reloads, and manual pauses. It also checks concealed entry/backgrounding, selected and locked vote preservation, automatic closure at results, and credential-only browser storage.

Use `scripts/clue-board-smoke.js` to exercise the shared native/browser clue board: optional entry, multiple turns, editing/removing older clues, lost-save-response retries, reload and closed-tab rescan recovery, turn changes while editing, read-only voting, clue history through the verdict, and next-round reset. Screenshots are saved under `output/playwright/clue-board-*.png`. The implementation follows [the approved clue-board design](design/clue-board-v2/README.md).

Motion checks use `scripts/motion-check.js` in a separate Playwright session. They exercise rapid navigation and selection, sheet drag/cancel, immediate private-card concealment, score counting, celebration cleanup, and reduced motion. After that check, `scripts/motion-demo.js` records a representative flow using isolated sample-party state. See [design/MOTION.md](design/MOTION.md) for timings and tuning.

Completed native baseline verification: frontend production build, the four-player/two-round browser scenario, an installed API 36 Android emulator, native Wi-Fi/battery/notification paths, real encrypted native-host clients, a 20-second background-hosting check, foreground-service shutdown after ending the party, and an installed Android guest joining an encrypted Rust host and restoring the same identity after process restart. Android back-button confirmation, camera permission, and scanner cancellation were also checked. The 23 topic packs contain 24 authored word/hint pairs each (552 total), with Nature separate from Animals. The full catalog received an editorial review on 2026-11-16; see [the topic guide](TOPICS.md) for scope and validation. Current core verification includes 33 passing Rust tests. Browser-preview verification includes Chromium/WebKit/Firefox guest flows, 12-player capacity, and an installed Android host serving mixed native/browser players; see [the implementation record](design/WEB-GUEST-IMPLEMENTATION.md) for evidence and limits.

Remaining device validation: QR recognition through physical cameras, multiple physical phones on one router, screen-off hosting over longer sessions, manufacturer-specific battery restrictions, and playtesting hint quality. A foreground service improves hosting continuity but cannot guarantee survival after force stop or operating-system process termination.

### Score sessions and confidence bets

The host can set a session target of **10, 15, 20, 25, or 30** from the lobby (default 15). The target locks when the first round starts. Every player can optionally stake up to 3 available game points on their original ballot; each role's bet rides on that role's own goal (see the role list above). All deductions stop at zero.

After the whole round settles, reaching the target ends that score session. Highest final score wins; tied highest totals share the win. Reports and Drink/Dare keep their existing sequence before final standings. **Start next session** resets scores, bets, and pending report deductions while retaining the party, connections, credentials, settings, and imposter-selection history.

Run `scripts/session-scoring-smoke.js` with the Playwright CLI `run-code --filename` command for real mixed native/browser flow coverage: target selection, bet affordability/privacy, lost-response retry and closed-tab QR resume, lost bet and zero floor, perfect bluff, completion, and fresh-session identity preservation. Screenshots use `output/playwright/session-scoring-*.png`. Rule tests also cover every target and all supported sizes (3–12 players). See [implementation details](design/session-scoring-v1/IMPLEMENTATION.md).
