# Offline browser guests — 1.1.0 preview

Implemented 2026-11-02. The Android 1.0.0 release remains unchanged. This implements the [approved local browser plan](WEB-GUEST-PLAN.md), with the verification limits below.

## Play

1. Install the 1.1.0 APK on the Android host. Existing Android guests should also update if they want to scan the shared URL inside the app.
2. Connect everyone to the same router's reachable Wi-Fi. Internet is not required; isolated guest networks may prevent joining. The Wi-Fi label is supplied by the host, not a verified SSID.
3. Create a party in Imposter. Enable background hosting if you want the Android host to keep serving while its UI is backgrounded; otherwise keep the app open.
4. Open the host's invitation QR. Guests without the app scan with their phone's Camera or QR reader, then open the ordinary HTTP link in their chosen browser. Nothing forces Safari or Chrome. Third-party readers can choose their own embedded viewer; if it fails, open/copy the link into the default browser.
5. Installed Android guests use **Join party → Scan invitation**, or paste the shared link. The app unwraps the native invitation and joins over its existing certificate-pinned TLS connection.
6. An Android browser landing page offers **Open in Imposter** and **Continue in browser** before admission. App launch is a user-triggered Android intent with a browser fallback; it is not guaranteed in every browser/scanner. iPhone guests receive the browser flow directly.
7. Enter a name, mark ready, and play the existing role/discussion/vote/punishment/rankings flow. Keep one active browser tab per player. Reloading resumes that player and replaces the previous tab's controller. If persistent storage is unavailable, the page warns that it must remain open.
8. At the end, let guests see their final rankings before closing the host's recap. Closing the host tears down the web and TLS servers. Final views remain in already-open guest pages; reloading after shutdown cannot recover them.

## What changed

- The host serves a compiled guest bundle directly from the APK through a separate Rust HTTP listener bound to its selected local IPv4 address. It shares the same `Game` instance as the host and native TLS guests. There is no hosted website, cloud relay, service worker, or dev bridge in this guest path.
- The shared QR is an ordinary local URL with a versioned invitation fragment. The envelope carries browser admission plus the native endpoint and certificate. Native scanning validates the endpoint and pins the scanned certificate; it does not trust a certificate fetched over HTTP. Legacy `imposter://join/` invitations remain accepted.
- The browser adapter is distinct from the loopback Vite/Rust development adapter. Production browser routes provide invitation inspection, idempotent joining, credentialed resume, filtered state, and an allowlist of player actions. They never provide host create/end/topic/start controls.
- Browser resume credentials are separate from native game tokens. Every page has an independent controller proof; resuming replaces older controllers. Per-party identity checks, host/origin validation, body/rate limits, and no-cache sensitive responses protect the ordinary API boundary. No wildcard CORS or arbitrary scanned-URL navigation is enabled.
- Action IDs survive uncertain responses for retry; a repeated join request returns the same player. Private cards conceal on visibility change and page exit. Browser background polling pauses and resynchronizes on return. Scores and state remain authoritative on the host.
- The UI reuses the existing illustrations, typography, controls, 420 ms card flip, navigation, and reduced-motion behavior. It includes a browser landing page, app/browser choice, storage guidance, and explicit connection errors. Local HTTP request IDs use `crypto.getRandomValues`; neither secure-context-only UUID generation nor browser-camera access is required.
- Android handles explicit app-opening invitations on cold and warm starts. A different invitation cannot silently end an active party: it asks the player to leave/end first. A native app/browser identity transfer after joining is not implemented; choose the client before admission.
- The Android scanner includes ML Kit's bundled barcode model so first-use decoding does not depend on downloading a model. Shared scanner API dependencies remain present. The signing key is the same local release key used for 1.0.0.

## Connection security

Native clients retain pinned HTTPS. Browser guests use local HTTP and therefore do not receive transport encryption or authenticated JavaScript delivery. A network observer or intermediary able to inspect/alter traffic may compromise roles, credentials, or votes. The landing page explicitly describes this; use Wi-Fi you trust. Per-player authorization is not a substitute for encryption. Browsers may display HTTP warnings or reject connections according to their settings. The app does not require installing root certificates or disabling browser protection.

## Verification

Automated checks cover:

- All 15 Rust tests pass, including the original game tests and production web transport tests: static assets and headers, host/origin rejection, shared invitation validation, native TLS compatibility, join retries, resume/takeover, guest host-action rejection, token isolation, mixed-client scoring, punishment, final state, and listener shutdown.
- A four-player game with a real Rust pinned-TLS guest and two independent production browser clients, run under Chromium, WebKit, and Firefox. Checks include recovering the same seat after a lost join acknowledgement followed by a page reload, refresh identity, duplicate-tab invalidation, role concealment, locked-vote reload, scores, dare completion, final rankings, and no external page requests.
- A full 12-player party with 11 independent browser identities, 12 ready acknowledgements and ballots, rejection of a thirteenth player, and compact progress layout.
- The existing four-player/two-round native-client UI scenario, including runoff/repeated ties, 0/1/2 scoring, replay, and final-score retention.
- An installed Android API 36 host serving its actual bundled website to browser players through an ADB-only local test proxy, alongside a native certificate-pinned TLS peer. The browser used the real private-IP HTTP origin, with no secure-context UUID API, and completed the game against the installed host's authority. The proxy is test-only and is not part of the app or required for physical phones.
- The signed, non-debug 1.1.0 APK installed on that emulator: cold app-opening invitation, reopening the same invitation while warm, native pinned-TLS joining, readiness, role reveal, secret voting, final rankings, and returning home. Camera permission, local bundled barcode-model loading, and scanner cancellation passed. Live camera frames kept Android's UI-dump tool busy, so cancellation used the button bounds from the preceding accessibility snapshot and was verified with a fresh snapshot afterward.
- Motion regression: 20 rapid navigation cycles, 20 sheet interruptions, 20 selections, press recovery, private concealment, duplicate-action prevention, score counting, celebration cleanup, and reduced motion. The check waits for the same resting-state conditions with a bounded timeout so a busy emulator/browser host does not fail solely on a fixed sleep.

Checks write their results under ignored `output/`; replay entry points are `scripts/web-guest-smoke.js`, `scripts/web-capacity.js`, `scripts/native-web-smoke.js`, and `scripts/ui-smoke.js`. Browser tests require `npm run build`, `npm run dev:server`, and `npm run dev`. Native-host testing additionally uses the owned emulator and local test harness.

Physical iPhone/default-browser tests, real camera recognition of the dense shared QR, real shared-router traffic, and longer screen-off/manufacturer battery testing remain unverified. Windows Playwright WebKit is not physical Safari/iOS validation. The user reported that physical test devices are unavailable. Do not present this preview as having passed those hardware gates.

## Developer details

`crates/party-core/src/network/web.rs` implements the production guest listener; `network.rs` owns native/shared invitations and server lifetime. `src-tauri/build.rs` compiles the Vite output into the APK's Rust binary as immutable assets. Run the frontend build before compiling the host. `src/api.ts`, `src/invitation.ts`, and `src/storage.ts` implement browser transport, invitation validation, and storage/HTTP compatibility. Android manifest/activity/plugin changes implement explicit native handoff. No root certificate, domain association, or internet App Link service is required.
