# IMPOSTER

An Android-first, local multiplayer party game built with Tauri 2, Rust, React, and TypeScript. Each player uses their own phone. One phone hosts the party; everyone joins its reachable local Wi-Fi network using an invitation QR code. No account or internet service is required for native play.

Version 1.1.0 adds offline browser guests. Only the Android host needs the app: iPhone and Android guests can open the same invitation in their default browser, while installed Android guests can scan it inside Imposter. The host bundles and serves every guest page, font, and image. See [browser guest setup and verification](design/WEB-GUEST-IMPLEMENTATION.md). Physical iPhone and shared-router checks remain unverified; this build is a browser-guest preview.

The interface implements the [approved screen designs](design/proposal-v1/README.md): charcoal, ivory, lime, tactile secret-card artwork, animated role reveals, short page transitions, bottom sheets, sequential punishment turns, and animated standings. Fonts and artwork are bundled for offline use. Reduced-motion preferences are respected.

The [single-page website](docs/README.md) includes 26 actual app screenshots, game rules, installation help, and direct 1.1.0 APK downloads. Its static source is in `docs/`; the repository owner can publish it by selecting **main → /docs** in [GitHub Pages settings](https://github.com/Malon0825/imposter-app/settings/pages).

The [visual comparison review](design/VISUAL-REVIEW.md) links all 24 before/after screenshots, the side-by-side proposal gallery, and compact/tall phone captures. Open the live gallery at `http://127.0.0.1:1428/output/playwright/visual-review/index.html` while the preview is running.

## Play

1. Download **imposter-1.1.0-android.apk** from the [v1.1.0 preview](https://github.com/Malon0825/imposter-app/releases/tag/v1.1.0) on the Android host, open it, and allow installation from your browser when Android asks. Android guests may also install it; browser guests need no installation. Connect everyone to the same reachable router's Wi-Fi. The signed APK includes ARM64 phones and x86_64 emulators; minimum Android 8 / API 26. The [v1.0.0 release](https://github.com/Malon0825/imposter-app/releases/tag/v1.0.0) remains the stable native-only release.
2. Choose **Host party**, enter a name, and label the shared Wi-Fi. The host can enable background hosting with an ongoing notification, visit battery settings, or choose to keep the app open.
3. Guests scan the host's QR using their Camera/QR reader to join through their chosen browser, or use **Join party → Scan invitation** inside the updated Android app to play natively. Android browser joining also offers **Open in Imposter** where supported. Enter a unique name and mark ready. Tapping the host's QR enlarges it; copy/paste is supported. Browser traffic uses unencrypted local HTTP, so use Wi-Fi you trust.
4. The host selects topic packs and starts the round with 3–12 players. Each player privately reveals their role, then hides it and marks ready.
5. Talk and give clues face to face. The host opens secret voting whenever the group is ready. There is no game timer.
6. Review results, take Drink/Dare/Skip turns, and see cumulative rankings. The host starts another round or ends the party.

Exactly one independently random imposter is selected each round; consecutive imposter turns are possible. Civilians see the word. The imposter sees their role and an indirect starting hint. A civilian earns **+1** for correctly identifying the imposter on their original ballot. The imposter earns **+2** if they escape the most votes. Self-votes are disallowed. Tied top counts trigger one runoff; a repeated tie means escape. Original ballots determine civilian points even when a runoff occurs.

Wrong civilian voters and a caught imposter enter a randomly ordered punishment queue. Only the current player controls their choice. Dare names a randomly selected, connected player to invent the dare in person. The app contains no dare prompts, text submission, or dare verification. Skipping never changes points.

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

This builds the frontend and runs 15 Rust tests covering scoring, ties, role privacy, ready gates, duplicate/stale actions, disconnect/reconnect, punishment ownership, content integrity, real TLS clients, certificate trust, shared invitations, production browser authorization/recovery, mixed-client games, and server shutdown.

With both preview processes running and a Playwright CLI browser session open at the preview URL, the browser scenario can be replayed using:

```powershell
npx --package @playwright/cli playwright-cli -s=imposter open http://127.0.0.1:1428
npx --package @playwright/cli playwright-cli -s=imposter run-code --filename=scripts/ui-smoke.js
```

The scenario creates four players, plays two rounds, checks concealed/private cards, original voting and a repeated runoff tie, validates 0/1/2 scores, completes human-given dare/drink turns, and verifies final rankings persist when the host returns home. It writes screenshots under `output/playwright/`.

Motion checks use `scripts/motion-check.js` in a separate Playwright session. They exercise rapid navigation and selection, sheet drag/cancel, immediate private-card concealment, score counting, celebration cleanup, and reduced motion. After that check, `scripts/motion-demo.js` records a representative flow using isolated sample-party state. See [design/MOTION.md](design/MOTION.md) for timings and tuning.

Completed native baseline verification: frontend production build, the four-player/two-round browser scenario, an installed API 36 Android emulator, native Wi-Fi/battery/notification paths, real encrypted native-host clients, a 20-second background-hosting check, foreground-service shutdown after ending the party, and an installed Android guest joining an encrypted Rust host and restoring the same identity after process restart. Android back-button confirmation, camera permission, and scanner cancellation were also checked. The 22 topic packs contain 221 authored word/hint pairs. Current browser-preview verification includes all 15 Rust tests, Chromium/WebKit/Firefox guest flows, 12-player capacity, and an installed Android host serving mixed native/browser players; see [the implementation record](design/WEB-GUEST-IMPLEMENTATION.md) for evidence and limits.

Remaining device validation: QR recognition through physical cameras, multiple physical phones on one router, screen-off hosting over longer sessions, manufacturer-specific battery restrictions, and playtesting hint quality. A foreground service improves hosting continuity but cannot guarantee survival after force stop or operating-system process termination.
