# Browser guests with an Android host

Status: implemented as the 1.1.0 preview; physical-device validation remains pending. Updated 2026-11-02. See [delivered behavior, verification, and limits](WEB-GUEST-IMPLEMENTATION.md). The original approved proposal is preserved below. Android 1.0.0 remains the stable native-only release.

## Product proposal

Only the host needs the Android app. Guests can join using an ordinary iPhone or Android browser, or use the installed Android app if they already have it. All clients share one party. The host's installed app runs the authoritative Rust game, serves the player interface in local mode, and controls the party. The host can also participate as a normal player; hosting must not expose a cheat panel with assignments or ballots.

The intended experience is: connect to the shared Wi-Fi, scan the host's QR, enter a name, and play. Scanning inside Imposter joins through the installed app; scanning with the phone's Camera or another QR reader opens the browser path. Browser guests need no account, native installation, Apple signing, or TestFlight. Respect the phone's selected default browser on both iPhone and Android; do not force Safari or Chrome. Use a normal web URL without a browser-specific scheme. Third-party readers may keep links inside their own embedded browser; provide copy-link/open-in-browser guidance for that case. Embedded browsers in messaging/social apps are outside the first supported set.

Confirmed by the user: offline play on the same Wi-Fi takes priority. The Android phone supplies all pages and game communication; no public website, cloud relay, or internet access is required for this milestone. A local prototype comes first; browser compatibility and the limits of plain local HTTP must be demonstrated before the full guest interface is implemented.

## Responsibilities

The Android host owns membership, random roles and words, phase transitions, vote acceptance, ties, scoring, punishment order, and rankings. Browsers submit intentions and render only the view authorized for their player. Guest JavaScript never decides a winner or receives the full secret state.

The host's private playing screen stays separate from its party controls. Host controls show readiness, connection status, received-vote totals, pause/resume, and round/party controls. Unresolved ballots and other players' private cards remain unavailable through the ordinary host UI.

## One invitation for installed apps and browsers

Confirmed user direction: keep native Android guests supported alongside browser guests. The host shows one primary browser-compatible URL QR, and the installed app's scanner recognizes that same QR as a party invitation. Guest transport does not change roles, points, capacity, readiness, voting eligibility, or punishment ownership.

### Routing behavior

- **Imposter scanner:** choose Join party → Scan invitation, scan the shared QR, parse it within the app, validate the native invitation, and continue to the native connection/name/lobby flow. Do not launch a browser or load the scanned address as unrestricted content inside the app.
- **Phone Camera / third-party QR reader:** follow the local web URL to the browser guest experience. A scanner may use its own browser or Android's link defaults, so describe this as the supported default rather than promising identical behavior in every scanner.
- **Android browser landing page:** offer a secondary **Open in Imposter** action and a clear **Continue in browser** action before admitting a new player. The app-launch action is triggered by a real tap and passes the same party invitation. Use a package-targeted Android intent where supported, with a custom deep-link handler in the updated app and browser fallback. If the app is missing or the browser declines the launch, browser joining remains available. Do not depend on detecting installed apps from JavaScript, timed redirects, or an offline app-store download.
- **iPhone default browser:** continue directly through the web flow in the user's chosen browser, such as Safari, Chrome, Firefox, or Edge; no Safari-only routing and no Android app-launch action. These are compatibility test targets, not an exclusive browser allowlist.

### Automatic opening from an external scanner

Android verified App Links normally provide app-first routing for an approved website domain. Verification associates a website's HTTPS `assetlinks.json` with the app's signing identity. Android 12+ generally sends unapproved web links to the browser. Our offline invitation uses a variable private IP/port, rather than an owned verified website domain, so an installed app alone does not establish reliable automatic routing for that URL.

The MVP must not require automatic external-scanner detection, manual Android link-default configuration, or claiming every `http` URL. Do not put an app-only custom scheme or `intent:` URI in the primary QR: those would weaken browser fallback and iPhone compatibility. A verified-domain design can be reconsidered later, but cannot introduce an unnoticed internet dependency into offline joining.

### Invitation contents and native trust

Evolve the fragment into a bounded, versioned invitation envelope containing browser admission/routing information and the native pinned-TLS invitation material. The installed scanner can obtain the native endpoint and its certificate directly from the scanned payload and validate it using the existing native trust model. Do not fetch a new certificate over plain HTTP and treat it as equivalent to a certificate obtained from the scanned QR. The native app must not silently downgrade its existing connection to HTTP just because a browser endpoint is present.

The browser interprets only its relevant fields and still uses the selected local web transport. An app-launch handoff originating in an HTTP page inherits that page's unauthenticated-delivery limitation; it must not be advertised as identical to physically scanning the original QR inside the app. Validate all incoming payloads, expiry, supported versions, party identity, allowed endpoint schemes/addresses, and lengths before any native request. Never execute arbitrary scanned URLs or expose host commands through a deep link. Bound QR density and test camera readability before settling the envelope format.

### Existing versions and identity handoff

Android 1.0.0 currently accepts only `imposter://join/...` and has no browser-to-app join intent filter. The new shared-URL scanner and app-opening support require an updated Android app. Preserve legacy native invitation parsing; an optional advanced copy-native-invitation action can support older installed versions without adding a second primary QR. Older versions can also join through the browser.

Place the app/browser choice before name submission so switching does not create two players. Native and browser storage are separate: the app cannot automatically read a browser's saved player credential. Switching after joining is therefore not a seamless MVP promise; offer explicit leave-and-rejoin in the lobby, preserve normal resume within the same client, and defer mid-round client transfer. A future transfer mechanism would need authenticated, single-use handoff and invalidation of the old controller. Deep links must not silently replace an existing active party; open a confirmation or resume the matching party. Test app launch both from a stopped process and while the app is already open.

## Connection architecture and the transport decision

### Local mode: the phone serves the website

The host bundles a production browser build in the APK. While a party is running, a Rust listener on the host's Wi-Fi address serves the HTML, scripts, artwork, fonts, and a restricted guest API. The page and API share an origin. The router carries traffic between phones; it does not host the game. All guest assets come from the phone, so a first-time visitor needs no internet or previously installed cache.

A shared join QR would contain a URL shaped like `http://192.168.1.42:43127/join#invite=<versioned-invitation>` rather than only the current native `imposter://` invitation. The address and port are examples. The installed app can unwrap the native invitation from the same QR, as described above. Bind a stable available web port for the party, verify the Wi-Fi address, and generate the actual URL at runtime. Never advertise `localhost` or `127.0.0.1` to another phone.

The fragment keeps the invitation payload out of the initial HTTP request URL. The page reads the browser ticket, exchanges it in a request body, and removes the fragment from the address bar once the selected client can recover or continue its join attempt. This reduces accidental URL logging; it does not encrypt an HTTP session. Do not add analytics, external scripts, third-party fonts, or external navigation that can disclose invitations.

There is an important security tradeoff: a plain local HTTP website has no transport encryption or authenticated delivery of its JavaScript. Someone able to inspect or modify traffic on the network could read or tamper with roles, credentials, or votes. Per-player filtering and authentication still protect against ordinary unauthorized API use, but cannot supply network secrecy over HTTP. Do not describe this as equivalent to the existing pinned-TLS native mode, or promise that custom JavaScript encryption fixes an unauthenticated initial page load.

Modern browsers can also warn about HTTP or apply local-network restrictions. A private LAN IP is not the same secure-context exception as `localhost` on the guest's own device. Browser camera scanning, service workers, and installable/offline-PWA behavior must not be dependencies of this mode. Scan with the phone's existing Camera/QR reader instead. Test direct same-origin LAN access in multiple actual iPhone and Android browsers; do not assume rules for a public website contacting a local device apply identically to a directly opened local page.

**Local-mode release gate:** prove the complete join/play/rejoin flow on real iPhones and Android phones and document browser warnings and the HTTP tradeoff for trusted-network use. Offline joining is the confirmed product direction; whether the measured browser experience is good enough to release is the feasibility gate. Do not ask players to install root certificates or disable browser security as the standard joining experience.

### Deferred alternative: secure internet mode

This is outside the confirmed offline scope. If a later product decision prioritizes browser-trusted internet joining, serve the browser client from a public HTTPS origin and give the host an outbound authenticated connection to a small relay. Browsers connect to that same public service. The relay routes commands to the phone and routes individually filtered responses back; the Rust engine on the host still decides all game outcomes.

This avoids asking Safari to trust a certificate generated by a stranger's phone or connect from a public HTTPS site to a local HTTP server. It introduces internet dependence, hosted infrastructure, and a relay trust boundary. TLS protects each connection; it does not automatically create end-to-end encryption through the relay. The relay must enforce party membership and recipient isolation. Its cost and availability need a separate hosting decision; no free-forever promise.

In this mode, being on one router is no longer a technical requirement. If we retain a same-Wi-Fi instruction as a social rule, do not pretend the browser can verify it. Internet interruptions pause/reconnect rather than moving authority into a browser. Do not silently switch a running party between local and relay transports.

### Why the existing native HTTPS listener cannot simply become the web URL

Native invitations include a certificate that the Rust guest pins to the party. Browser JavaScript cannot install that certificate into Safari's trust store or bypass ordinary TLS validation for a fetch. A new self-signed `https://<host-ip>` QR does not provide a normal warning-free browser join flow. Managed trusted certificates, domain/DNS provisioning, or managed-network certificate installation are possible design projects, but are outside this first guest implementation. Never bundle a shared TLS private key into every APK.

## Host flow

1. **Create party:** reuse the current name, party, and network setup. Offer browser joining when its transport has passed validation. In local mode, verify usable Wi-Fi before showing an active invitation.
2. **Prepare hosting:** retain Android foreground-hosting setup and keep-open guidance. Start the guest listener together with the party and stop it when the party ends. Background hosting improves continuity but does not survive force stop or guarantee every manufacturer's battery behavior.
3. **Invite:** show one large shared URL QR, the host-supplied Wi-Fi label, and the instruction **Connect to this Wi-Fi first, then scan**. Add **Have Imposter? Scan with Join party in the app. Otherwise, use your phone's Camera.** Offer copy link and a readable local address. A room code alone cannot locate an unknown phone on a LAN; it is only useful after opening the host page, or with a public relay.
4. **Lobby:** show 3–12 players, host identity, connection state, and ready state. Distinguish a disconnected player from a new join. Preserve the existing host participation and game-start rules. Do not add manual admission for every normal scan in the first version.
5. **Command center:** show phase-appropriate actions, public progress, pause/reconnect state, and confirmation for ending or abandoning a round. These controls stay in the installed host app and are rejected by the server for browser guest credentials.
6. **End:** commit final rankings, reject new joins/actions, and keep the final view available until the host closes the recap or a bounded shutdown grace completes. Let connected clients acknowledge the final revision; a disconnected client cannot be guaranteed delivery. Guests retain their in-memory final view and stop polling after closure. Closing/reloading after the host server has stopped cannot be promised to restore those rankings. Shut down listeners, connections, foreground resources, and party credentials. Shutdown grace is an internal reliability measure, not a game timer.

A future Wi-Fi QR would be separate from the party URL and would require the real SSID/security/password from the host. Our current editable network label is not verified SSID data. Do not silently put a Wi-Fi password in the party QR.

## Browser guest flow

1. **Before opening:** connect to the Wi-Fi shown on the host, then scan with the system Camera/QR reader.
2. **Opening / checking:** load the guest assets and validate the invitation with the host. Show the party and host name only after validation. Reject expired, full, closed, incompatible, and already-started invitations clearly.
3. **Identity:** enter a unique display name and tap **Join party**. Returning players resume with their saved credential instead of creating a duplicate identity. Offer an explicit action to leave an existing saved identity before joining as someone else.
4. **Lobby:** confirm the party, show players, and tap **I'm ready**. Guests have no topic-edit, start-round, or host settings controls.
5. **Private role:** start concealed; tap **Reveal my role**; show the civilian word or the imposter badge and indirect hint; tap **Hide & ready**. Conceal on page hide, page exit, navigation, and when returning from background. Never automatically reopen a revealed role after reconnecting. A browser cannot guarantee native screenshot or app-switcher protection.
6. **Discussion:** show the starting player and public progress. Clues happen face to face, without a timer.
7. **Secret ballot:** pick another eligible player, confirm once, then show **Your vote is locked** and aggregate completion. Retry safely if the acknowledgement is lost. No premature vote choices or counts by suspect.
8. **Result:** display the resolved outcome, personal score, and punishment status. Preserve the existing runoff and repeated-tie behavior.
9. **Drink / Dare:** everyone sees whose turn it is; only that player chooses and completes/skips the turn. Dare names another player who invents the dare in person.
10. **Rankings / next round:** show cumulative points, then wait for the host's next action.
11. **Reconnect:** show **Reconnecting to Alex's party…** with the expected Wi-Fi label after the page has loaded. Retrieve a fresh authorized snapshot before enabling actions. Return to a concealed role if still in the role phase.
12. **Final / leave:** show final standings or confirm leaving. Expire saved credentials on explicit leave or known party closure.

If the guest is on mobile data or an isolated guest network when the QR is first opened, the local page may never load. That failure happens before our page can show helpful instructions. Put the essential instructions on the host's invitation screen; a locally hosted page cannot solve its own initial unreachability. A public help/landing page would require an additional internet path and is optional later.

## Reconnection and identity

Use party-scoped, unguessable player credentials. For local browser mode, persist only the opaque resume credential and minimum routing metadata when storage is available; never persist secret cards, words, hints, or ballots. Explain the limitation if private browsing or cleared storage prevents resuming.

Browser storage is scoped to the origin. A host address/port change can break both connectivity and access to the previous saved credential. Keep the endpoint stable for a party; treat a Wi-Fi/address change as an interruption, require the host to return to the original network or end/recreate, and do not promise automatic cross-origin identity recovery. A later host-approved recovery mechanism would need explicit protection against claiming another player's seat.

One active controller per player is recommended. A refreshed/restored page should replace or invalidate an older controller session; simultaneous tabs must not become independent voters. Resume and join must be distinct operations. Hidden/background browser tabs may be throttled or suspended; do not require continuous background polling. On visibility return, resync immediately. Retain the current missing-player pause/abandon policy and score-commit rules.

## Implementation outline

- **`crates/party-core` remains authoritative.** Reuse `Game::view(player_id)`, action validation, original-ballot scoring, action IDs, round IDs, and revisions. A web guest must enter the same game instance as native guests and the host, not a parallel browser-only copy.
- **Add a production guest web server.** Bundle static guest assets, health/bootstrap, invitation validation/exchange, guest join/resume, filtered state, validated player actions, and leave. Limit bodies and rates; scope all credentials to the party. The existing `party-dev` bridge is loopback-only test tooling and exposes development create/session management. Do not ship it or merely bind it to all interfaces.
- **Separate transport adapters.** Keep native Tauri commands for the host and existing native guests. Add an explicit browser-player adapter for the new server. The current non-Tauri branch is a Vite development bridge, not a production LAN browser client.
- **Reuse the approved React UI.** Guest-only entry removes app-install, app-camera, host battery, and host administration screens. Keep the existing typography, artwork, privacy affordances, motion, and reduced-motion support. No UI redesign in this plan.
- **Use the existing polling protocol first.** Approximately 600 ms visible-page polling is already implemented. Benchmark 12 clients, avoid overlapping requests, back off on failure/hidden pages, and resync immediately when visible. WebSockets/SSE are later optimizations rather than a second state machine in the MVP.
- **Authenticate every request.** Derive player identity from a server-validated credential, not a submitted player ID or an app-local session ID. Browser guest credentials cannot invoke host-only actions. Check Origin/Host and CSRF exposure for the chosen credential scheme; do not add wildcard CORS. If cookies are chosen, design their protection for that transport; a Secure-cookie strategy is incompatible with plain LAN HTTP.
- **Keep secrets out of caches.** Sensitive responses use `Cache-Control: no-store`; no secret-bearing URLs, analytics, console logs, browser history, or persistent stores. Restrict framing and script sources. Static assets contain no round assignments or secret content dump.
- **Keep Android's native TLS path.** A local HTTP guest listener would be an explicit additional transport, not a global downgrade of existing native pinned HTTPS. Both transports share the same authority. The installed app remains the only host in this milestone.

## Delivery phases and acceptance gates

### 1. Browser feasibility spike

Serve one bundled page from an actual Android APK. Scan its URL with a physical iPhone and an Android phone, on a normal shared router. Also scan the same QR with the updated installed Android app and prove both paths reach the same party. Exchange a small personalized message and exercise an authenticated action. On iPhone, test Safari, Chrome, Firefox, and Edge, including a non-Safari default browser. On Android, test Chrome, Samsung Internet, Firefox, and Edge where available, including a non-Chrome default browser. Test first visit, reload, manual URL, HTTP/HTTPS warnings, denied permissions where present, no-internet Wi-Fi, browser background/return, and isolated guest Wi-Fi failure. Record tested browser/OS versions and capability failures rather than blocking other browsers by brand. Use a small bundle initially to separate connectivity from game/UI issues.

Gate: a documented go/no-go decision on the local browser experience, backed by the actual phone results. If local joining requires certificate installation or disabling protection, do not proceed as if the join experience is solved, and do not silently replace the offline requirement with a cloud dependency. Android emulators and desktop browser tests cannot replace this gate.

### 2. Production admission and session transport

Implement bundled assets, shared versioned URL invitations, native scanner parsing, optional user-tapped browser-to-app handoff, player credentials, guest-only API access, resume, duplicate-controller handling, listener lifecycle, and explicit connection errors. Test invalid/expired tickets, capacity, unauthorized host actions, identity impersonation, cross-party credentials, and stale/retried commands. Test app present/absent, updated/legacy app versions, cold/warm launches, malformed deep links, browser fallback, and failed app launches without duplicate admission or redirect loops.

### 3. Complete guest game flow

Wire the shared screens through the production guest adapter. Play one four-player party with an Android host, an installed Android guest, an iPhone browser guest, and an Android browser guest, then test the 12-player limit. Verify private roles, readiness, normal votes, both tie paths, personal +1/+2 scoring, punishment ownership, cumulative rankings, replay, and closure.

### 4. Phone and interruption polish

Verify safe areas, keyboard behavior, small displays, reduced motion, QR entry, default-browser routing, screen hide/return, refresh after a locked vote, lost response retries, blocked router access, host lock/background, host termination, and network changes across the browser test targets above. Use feature detection and readable capability errors rather than a Safari/Chrome-only allowlist. Check per-player network responses for secret leakage and measure host battery/traffic for a realistic party. Preserve all Android 1.0.0 native-client regressions.

### 5. Release

Version the guest bundle with the APK and protocol, document supported browsers and the selected transport's limits, and publish a new Android release. Browser guests use the host's bundled matching build, rather than an independently updated website that may mismatch the game protocol. Do not change or relabel the existing 1.0.0 release.

## MVP boundaries

One Android host; installed Android guests plus browser guests on iPhone and Android; offline on shared Wi-Fi; 3–12 players; approved game rules and UI; one shared QR with app-scanner/native and external-scanner/browser paths; optional explicit app-opening handoff; host-controlled phase changes; safe reconnection. No guaranteed automatic app opening from every external scanner, iOS native installer, accounts, mandatory PWA installation, browser hosting, host migration, hotspot guarantee, remote social gameplay, or new monetization system in this milestone. Internet relay mode is deferred and must not become a hidden dependency of local play.

## Sources and verification basis

Repository reviewed: `crates/party-core/src/network.rs`, `game.rs`, the loopback development bridge, `src/api.ts`, current shared screens, and Android `HostService.kt`. Existing native transport is authenticated certificate-pinned HTTPS with revisioned polling; browser preview support does not establish mobile LAN compatibility.

- [MDN: secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts): LAN HTTP is distinct from the same-device localhost exception.
- [MDN: camera access](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia): browser camera access requires a secure context.
- [MDN: service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API): secure-context requirement and HTTP interception risks.
- [WebKit: Safari HTTPS-first behavior](https://webkit.org/blog/16301/webkit-features-in-safari-18-2/): HTTPS-first navigation and optional insecure-fallback warning.
- [Chrome: local network access](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access): permission and mixed-content considerations for web-to-local connections; support must be checked per browser.
- [MDN: same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy): origin scoping and cross-origin restrictions.
- [Android: deep links](https://developer.android.com/training/app-links/create-deeplinks): web link routing and approved-domain behavior on Android 12+.
- [Android: App Link verification](https://developer.android.com/training/app-links/verify-applinks): HTTPS website associations and domain verification.
- [Chrome: Android intents](https://developer.chrome.com/docs/android/intents): user-triggered app opening, package targeting, and browser fallback; not a universal scanner/browser guarantee.

Compatibility conclusions above are engineering proposals derived from these constraints. Physical-device results are still required; no browser guest implementation or compatibility result is claimed in this plan.
