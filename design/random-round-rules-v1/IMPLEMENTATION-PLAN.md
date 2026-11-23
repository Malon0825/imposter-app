# Random round rules and persistent word deduction — implementation plan

Status: **Implementation plan and acceptance criteria.** The original baseline in section 2 describes the app before this feature.

Prepared 2026-11-17 from the current code, the nine feature mockups, the reviewed 581-word catalog, and the reported experience of repeated words and similar clues. The reported experience is the product requirement; it has not been reproduced in a new physical-device playtest during planning.

## 1. Intended result

Deliver the complete Classic / Act It / Sound Only feature and replace the current word reset behavior with a durable word deck.

After a word is dealt, remove that word and its reviewed equivalent concepts from future draws in the active word deck. This deduction survives a new score session, ending the party, creating a new party, and restarting the host app on the same device. A separate recent-clue rule keeps closely related words and similar sounds or gestures apart.

The full experience becomes:

**Ready players → determine a feasible random rule → reveal the rule → vote on compatible, fresh topics → choose the topic → durably deduct one word → deal private cards → clue turns → discussion → voting → results → reports → Drink/Dare → standings.**

With random rules disabled, the server assigns Classic and goes directly to topic voting. Persistent deductions and clue variety remain active in Classic.

This plan assumes the same installed device continues hosting. Another host device has its own local deck until an explicit history-transfer feature is implemented. There is no account, cloud synchronization, or automatic host migration in this feature.

## 2. What the current implementation does

The existing foundation is useful, but it does not yet deliver this behavior:

1. `crates/party-core/src/game.rs` keeps `Game.used` as an in-memory set of display strings. `new_session` preserves that set, so starting the next score session within a living party already avoids exact repeats until exhaustion.
2. `Game::new` initializes an empty set. Closing the party, dropping its host, or restarting the process loses the history. Browser credential storage in `src/storage.ts` and `src/api.ts` does not preserve host word history.
3. `Topic::draw_word` in `crates/party-core/src/content.rs` automatically clears the compatible subset when it is exhausted. That makes exact repeats legitimate again without the players making a deliberate choice.
4. Exact display strings do not recognize related entries. Cake and Birthday cake can be different entries; Pasta and Noodles can encourage very similar clues. Sound Only also needs to distinguish repeated clue styles across topics, such as Ringtone in Technology and Phone ringing in a meeting in Everyday chaos.
5. `begin_round` still selects Classic and copies the Classic hint. It does not draw or freeze a round rule, use a mode-specific hint, or apply persistent history.
6. The reviewed content supplies 23 Classic topics, 21 Act It topics and 14 Sound Only topics, with 581 / 486 / 194 words in those playable pools. These are starting-content counts, not a guarantee that every one of those topics remains available after deductions.
7. Mode compatibility and static hint alternatives are validated. Hint alternatives have not yet been evaluated against a changing persistent deck or a recent-similarity policy.
8. Host actions currently reach `Game::apply` through several paths: local `Session::send`, the native HTTPS action handler, and the production browser action handler. Durable consumption must be enforced centrally, not separately in one transport.
9. The feature screens are proposed mockups in this folder. They are not implemented or considered visually accepted by this plan.

## 3. Product rules to implement

### 3.1 Round rules

- **Classic:** spoken clues using the existing face-to-face flow and optional clue text history.
- **Act It:** silent physical clues. No words, sounds, spelling or mouthing answers. No required props, contact or strenuous movements.
- **Sound Only:** player-made sounds. No words, lyrics, spelling, gestures as additional clues, recordings or soundboards.
- Restrictions apply to giving clues. Discussion and accusations can use normal speech.
- Everyone in the round receives the same public rule, including the imposter.
- Civilians see the selected secret word. The imposter sees their role and the selected private hint for this mode and remaining pool.
- All additional clue turns retain the rule, word, hint, roles and starting player.
- Keep existing voting, bets, streaks, reports, punishments, scoring and imposter-selection fairness.

### 3.2 Randomness

Draw uniformly from the rules that currently have at least one feasible topic inside the host's enabled packs. With all three rules feasible, each has a one-in-three chance. If only Classic and Act It are feasible, each has a one-in-two chance.

Rule repetitions remain possible. Do not introduce a mode shuffle bag, forced rotation or a hidden preference for modes with more words. Word variety is handled by the word selector.

The host commits one authoritative rule result before the reveal animation. Reloading, reconnecting, repeated taps, changing the toggle or reopening settings cannot redraw it. An explicit abandonment ends that round; starting a different round may draw a different rule.

### 3.3 Session control

- One host-controlled **Random round rules** setting, available in the lobby and during a round, including a manual pause.
- First upgrade defaults to Off to preserve the current entry experience. Subsequent new parties can inherit the host's last saved preference. A new score session retains the party's setting.
- Before a rule is committed, changing the setting affects that next draw.
- After a rule is committed, changing the setting affects the next round. It cannot change the active rule, ballot, word, hint or scores.
- Turning it off during Sound Only shows: **“Random rules are off from next round.”** The current round continues as Sound Only.
- A paused party remains paused when settings change. Disconnection and readiness gates still apply to advancing play.
- **Done** closes the settings sheet; the toggle action is already applied. No separate save action.

## 4. Define the lifetimes clearly

Use distinct names in code and user copy:

- **Clue turn:** another pass of clues with the same word and roles.
- **Game round:** one rule, topic, secret word, imposter and accusation result.
- **Score session:** a race to the selected score target, possibly containing many rounds.
- **Party:** the live host and connected players; it can contain several score sessions.
- **Word deck:** the local collection of word exclusions and recent clue history. Its lifetime is independent of the party.
- **Deck cycle:** a deliberate fresh run through that deck. Only the host's explicit **Start fresh word deck** action starts another cycle and permits previously consumed concepts again.

Normal round completion, a new score session, ending a party, creating another party, enabling or disabling random rules, and app restarts do **not** start another deck cycle.

The first release uses one default deck on each hosting device. Named decks for different friend groups can be added later; a new score session must never silently create a new deck.

## 5. Rework the content model for lasting identity and clue variety

### 5.1 Stable word identity

Add an authored, immutable `word_id` to every canonical entry in `crates/party-core/content/topics.json`.

- IDs must not be recalculated from the current display spelling at runtime.
- Correcting capitalization, punctuation, spelling, display names or hints retains the original ID.
- IDs are unique, are never recycled for a different concept, and remain recognizable across catalog upgrades.
- Keep a reviewed alias/migration registry for renamed or merged entries.
- Catalog removals leave tombstones in history. Reintroducing the same ID or a known alias must not make it fresh again.
- Maintain a catalog revision and a separate persistent-history schema version.

Display-string normalization can help migrate known legacy strings or detect mistakes. It is not the identity system.

### 5.2 Three distinct kinds of deduction

**A. Exact word deduction — permanent within a deck cycle.**

Once dealt, exclude that `word_id` from every topic and every rule for the rest of the cycle. Classic → Act It → Sound Only does not make a consumed word available again.

**B. Equivalent-concept deduction — permanent within a deck cycle.**

Assign a reviewed `concept_id` to entries that would effectively repeat the same answer or performance despite different wording or topic placement. Cake / Birthday cake is a candidate for this review. Dealing one consumes its equivalent concept, so another label for it does not evade the exclusion.

Equivalence is a narrow editorial decision. Do not merge distinct concepts merely because one is a substring of another, they share a topic, or they use the same hint. For example, a ticket and a vehicle are not automatically the same concept.

The inventory must distinguish catalog-entry counts from distinct concept counts after this review. Do not advertise 581 independent experiences if several entries belong to the same consumed concept.

**C. Recent clue-family exclusion — temporary, persisted across parties.**

Add reviewed semantic families and mode-specific clue families. They describe likely clue overlap:

- Closely related meanings: Pasta / Noodles, or a small reviewed family of closely related string instruments.
- Similar spoken associations across topics: a reviewed hot-drink routine family may link Coffee with Mug.
- Similar Sound Only performances: phone ringtones across Technology and Everyday chaos; low creature roars within Animals or Movies; closely overlapping mechanical clicks.
- Similar Act It performances: a reviewed subset of typing gestures, strumming gestures or sleeping gestures.

Use multiple families when a word has several common clue paths. Keep families specific enough to prevent repetitive play without excluding whole topics such as Animals, Food or Music.

Do not turn every shared imposter hint into a hard family. A useful ambiguous hint intentionally covers different answers; this does not prove their player clues are interchangeable.

### 5.3 Initial similarity policy

Use these as explicit starting values for implementation and playtesting, not measured optimal settings:

- Exclude semantic families seen in the previous **6 dealt rounds**.
- Exclude the current mode's clue families seen in the previous **4 dealt rounds**.
- Independently exclude the last **6 word/concept IDs** across cycle boundaries. This prevents a just-played word with no shared family from immediately returning after an explicit fresh-deck action.
- Measure both windows with a persistent monotonic deal sequence, not `Game.round.id`, wall-clock time or time since the party began.
- Match mode-specific clue families against recent events where that clue mode was actually used. Other rounds still advance the global sequence, so a mode cannot trap itself behind a cooldown that never ages.
- Persist the sequence and recent family events. Ending and immediately restarting a party does not age a cooldown.
- After explicit cycle renewal, retain the recent-family window. A fresh deck should not immediately serve the last word or a nearly identical clue.
- Within equally eligible targets, an older approved hint or a less recently used family can be a preference. Such preferences must never override permanent deductions or the hard recent-family windows.

The selector remains random among candidates at the selected variety tier. The rule draw remains uniform among feasible rules. Record any later policy change with a version and regression tests.

### 5.4 Review and validation work

Review all 581 entries again for identity, equivalent concepts, semantic families and mode-specific clue families. This is additional work beyond the completed mode classification.

Extend the canonical catalog and add a development-only diversity review with a short rationale for equivalences and family membership. Validate:

- Every word has a stable ID and a concept ID.
- All family references exist and refer to the appropriate rule.
- Equivalent concepts, aliases and tombstones are explicit and non-conflicting.
- No unreviewed automatic stemming, synonym matching or embedding similarity decides exclusions at runtime.
- Each playable starting topic/mode still has at least ten reviewed entries; report its distinct concepts and clue families as well.
- Every accepted mode retains its concrete clue examples and exclusions.
- Every selectable hint option is explicitly reviewed for that word and mode.

The feature remains offline. Runtime selection does not call an AI service or an internet API.

## 6. Re-evaluate imposter hints after deduction

Static review is insufficient once played words and similar clues are removed.

Suppose a hint originally fits three words. If two are already consumed, it may effectively disclose the only remaining answer. Reusing the original hint would undermine the imposter mechanic even if the word itself is fresh.

For each word/mode, maintain a preferred hint plus any explicitly reviewed fallback hints. A fallback is not generated during the game and is not automatically approved merely because a word appears in another review list.

Before offering a topic:

1. Build its mode-compatible, unconsumed, non-cooled-down word set.
2. For each target, find approved hint options whose plausible candidates include that target and at least two other words from that current set.
3. Remove targets with no viable hint.
4. Re-evaluate the remaining alternatives until the set stops changing. Alternatives must themselves remain selectable targets, rather than words already removed by this check.
5. A topic is feasible only if this final set is nonempty.

This fixed-point check is deterministic and bounded by the finite number of words in the topic. A hint option continues to require at least three plausible selectable answers. Candidate count is a safeguard, not proof that no answer is disproportionately obvious; editorial review and playtesting remain necessary.

Prefer the existing mode-specific hint when it remains viable. Use a reviewed fallback only when necessary for a fair pool or to avoid a strongly repeated hint. Store the chosen hint in the round once; card rechecks and reconnects never recompute it.

Generate a compact host-only selection index from the reviewed catalog, approved hints and family metadata. Keep it separate from the large example/explanation records. Commit the generated index and check it for staleness in content validation. The runtime index contains IDs and candidate relationships; the public catalog and guest views contain no future word pools, history lists or alternative answers.

## 7. Replace the automatic-reset selector

Create `crates/party-core/src/selection.rs` for the pure selection rules. Keep content loading and compatibility in `content.rs`; remove its responsibility for resetting used words.

### 7.1 Candidate calculation

For each enabled topic and proposed rule, apply these filters in order:

1. The topic is explicitly enabled by the host; opt-in packs are not introduced automatically.
2. The static topic/mode pool satisfies the ten-reviewed-word requirement.
3. The target supports that mode and has approved mode-specific hint options.
4. Its stable word ID is not consumed in the active cycle.
5. Its equivalent concept is not consumed in the active cycle, including mapped legacy aliases.
6. Its semantic families are outside the six-round recent window.
7. Its current-mode clue families are outside the four-round recent window.
8. It survives the dynamic hint-alternative check in section 6.

Return an internal `SelectionAvailability` with feasible rules, topics, candidates, hint options, the deck revision, and structured reasons for exclusions. Return only sanitized topic availability and appropriate summary messages to clients.

The ten-word rule applies to the reviewed **starting pool**. Do not hide a topic simply because its fresh remainder falls from ten to nine. It can continue while the hint-alternative check and other rules support a valid target. A final remainder of one or two words may be unavailable because no fair hint remains; explain that accurately.

### 7.2 Draw order and frozen state

1. The host presses **Reveal round rule** while everyone is ready and connected.
2. Calculate availability from the enabled topics, current deck and similarity policy.
3. If no round is feasible, show the host the exhaustion state without drawing a rule or opening a ballot.
4. With random rules On, uniformly draw one feasible rule. With it Off, require feasible Classic content and assign Classic.
5. Freeze the rule, enabled-topic snapshot, feasible topic/candidate snapshot, deck revision, catalog revision and policy version in this round.
6. Show the rule reveal when random rules are On. Guests see the same committed outcome; only the host advances.
7. Open topic voting from the frozen feasible topic list. Preserve current approval votes, private selections, tie rules and readiness/disconnection behavior.
8. After the chosen topic is committed, the host continues to roles.
9. Draw one target from that topic's final feasible set and choose an approved viable hint. Do not give a word extra probability because it has more approved hints.
10. Durably consume the word and concept before publishing any private card.
11. Publish the round's word, hint, roles, starting player and first clue turn together.

One active party owns the default deck during this flow. History imports, resets and other parties cannot mutate that deck behind the frozen ballot. At the deal boundary, still validate its revision and ownership. A mismatch returns a recoverable conflict before dealing; it must not silently change the rule, reinterpret votes or use a stale candidate.

### 7.3 No implicit refill

Remove the current behavior that deletes eligible words from `used` after exhaustion. A changed mode, new score session or party restart must not function as a refill.

Never fall back from a mode to incompatible words, from a depleted topic to another topic after voting, or from a failed hint check to a single-answer hint.

## 8. Exhaustion and host recovery

Differentiate these conditions internally and in concise host messages:

- No enabled topic supports the requested rule.
- Compatible words exist, but they have already been played in this deck cycle.
- Fresh words exist, but recent clue families temporarily block them.
- Fresh words exist, but their remaining hint alternatives cannot support a fair round.
- Persistent history could not be loaded or saved.

Offer these recovery actions before a rule/ballot is frozen:

1. **Enable more topics** that already have a reviewed, fresh pool.
2. **Adjust the variety setting** through an explicit host choice, if implementing a one-round relaxed-similarity option. Relaxing similarity may permit related clues, but it never permits consumed words or concepts and never lowers the hint requirement. Default to the strict policy.
3. **Start fresh word deck**, with clear copy that previously played words can return. This creates a new cycle rather than deleting the ledger. Retain the recent-family window to avoid an immediate repeat.

The relaxed-similarity option is secondary to the core feature and can be omitted from the first release. If omitted, availability and messages must still work without a hidden relaxation fallback.

Do not claim the entire catalog is used up when only the enabled packs, current mode or valid hint sets are exhausted. Do not promise endless fresh rounds from a finite catalog.

Deck reset and enabling more topics happen in the lobby before a new draw. They must not alter an active ballot or dealt round. Preserve players, connections, scores and the score-session target when returning to this setup step.

## 9. Durable history architecture

### 9.1 Storage choice and scope

Add `crates/party-core/src/history.rs` with a storage interface and implementations for in-memory tests and persistent local storage.

Use a local transactional SQLite store as the planned production backend. Validate the chosen Rust binding and bundled SQLite build on the existing ARM64 and x86_64 Android targets in the persistence milestone before building the rest on it. If that feasibility check fails, revise this storage decision explicitly; do not quietly substitute browser storage or a non-atomic file write.

Use explicit durable transaction/journal settings, unique constraints for deal events and cycle deductions, and a consistent database backup mechanism. Verify recovery after abrupt process termination. A backup must represent a consistent database snapshot, including any active journal state; do not assume copying one live database file is sufficient.

The installed app resolves its private application-data directory in `src-tauri/src/lib.rs` and injects the store into `Sessions` and the host. Do not put this database in the workspace, APK assets, browser localStorage, an invitation URL or a guest-accessible endpoint.

The development bridge uses an explicit local development directory. Unit and browser smoke tests inject isolated temporary stores. Automated tests must never consume the developer's real word deck.

### 9.2 Stored records

The persistent model needs:

- History schema version, catalog revision and selection-policy version.
- A stable deck ID and active cycle ID.
- A monotonic deal sequence that survives party and score-session resets.
- A unique deal event ID tied to the party instance and round instance.
- The stable word ID and equivalent concept ID consumed by that event.
- Topic ID, actual rule, approved hint ID, and the relevant semantic/clue-family IDs at the time of dealing.
- Cycle-level exact-word and concept exclusions, either indexed directly or derived transactionally from the event ledger.
- Durable recent-family lookup data, or a safely derived view of recent events.
- Idempotency receipts and history revision needed to resolve retries.
- Minimal host preferences such as the random-rules toggle.

This is word history, not full party recovery. Do not store player credentials, votes, role assignments, scores or private card renderings in this ledger. Closing or killing the host still ends the live party; a later party resumes the word deck.

Preserve consumed IDs for the active cycle for its entire lifetime. Compaction can archive older completed cycles, but it cannot make an active-cycle word fresh by deleting old events.

### 9.3 When a word becomes consumed

Consume at **successful durable deal commitment**, immediately before cards become available:

- Merely revealing a rule, voting for topics or choosing a topic consumes no word.
- Checking or rechecking a card consumes nothing extra.
- Another clue turn consumes nothing extra.
- Reconnects, repeated taps and retries consume nothing extra.
- Abandoning before cards are committed consumes no word.
- Abandoning after the deal keeps the word consumed, even if some players never opened their card.
- A crash after durable commitment may conservatively consume a word that nobody saw. A crash must never expose a word and then forget it was consumed.

### 9.4 One authoritative commit path

Introduce a central host action coordinator and route local host actions, native HTTPS actions and browser actions through it. Keep `Game::apply` or a replacement transition function pure with respect to disk access.

For a history-changing transition:

1. Validate identity, controller authority where applicable, action ID, round ID, phase, readiness, pause state and deck ownership.
2. Serialize it with other game mutations, including joins and presence changes that could invalidate the staged transition.
3. Stage a copy/transition result with one chosen target, hint, role assignment and deal event. Do not publish it yet.
4. Commit the event, exact/concept deductions, recent-family sequence and idempotency receipt in one transaction.
5. Only after the transaction succeeds, publish the staged game state and its new revision.
6. A duplicate action returns the latest authorized view without drawing or charging another word. Do not replay a cached private response belonging to another player or expose an old card after its round has resolved.

Document and test a single lock order. Release browser-session authentication locks before entering the serialized game/history commit. Do not allow a store callback to acquire the game lock in reverse order.

An acceptable first implementation keeps the game mutation lock while awaiting a bounded database worker, so snapshots cannot see staged secrets and concurrent presence updates cannot be overwritten by a stale clone. Run blocking database work off the async executor. Measure the delay on Android. If it is too slow, move the coordinator to an owned command queue while preserving the same publish-after-commit invariant.

An incoming HTTP request cancellation must not cancel a committed host transition halfway through publication. Own the critical transition independently of that request's lifetime. Process death after database commit burns the word and ends the live party; it does not start an undepleted party on next launch.

On write failure, retain the previous visible game state, return a retryable error and expose no new private word. If commit success is ambiguous, resolve the durable event receipt before allowing another selection. Do not enable an automatic in-memory fallback that would falsely promise cross-restart deductions.

### 9.5 Ownership and version migration

- Enforce one active host-party owner per deck. Include cross-process ownership protection if more than one app process can access the same store. Guests do not own a deck.
- New score sessions reuse that owner and deck. Party closure releases ownership but retains history.
- Existing versions have no durable played-word ledger. An upgrade cannot reconstruct past words after the old process has ended. Make this first-use limitation clear; do not invent prior history.
- A later manual already-played-word import can seed known exclusions, but it is not required for the initial persistence release.
- Migrate schema and IDs transactionally. Preserve a recoverable store before destructive migrations.
- On catalog upgrades, retain consumed IDs, apply reviewed aliases/concept merges and reconcile recent family IDs. New words are fresh; renamed words are not.
- Never treat a damaged or unknown future-schema database as an empty deck. Offer retry/recovery or an explicit fresh-deck decision while retaining the problematic file for recovery.
- App data clearing or uninstalling removes local history unless it has been explicitly transferred or backed up. Persistence across ordinary app restarts does not imply persistence across uninstall.

## 10. State-machine and API changes

### 10.1 Round and party state

Extend `Game` / `Round` with explicit state for:

- Requested random-rules setting and whether it differs from the active round.
- Frozen round rule and whether its reveal was committed.
- Frozen feasible topic/candidate snapshot or immutable selection-plan reference.
- Deck ID/cycle reference, history revision, catalog revision and policy version.
- Stable selected word ID and approved hint ID, alongside the existing private display values.
- Per-player, per-clue-turn performed markers for nonverbal rules.

Separate these fields from score-session state. Keep `Game.used` only as a short-lived migration/test compatibility detail if necessary; the persistent store becomes authoritative. Remove the old automatic-clearing path after callers migrate.

### 10.2 Phases and actions

Add a committed **rule reveal** phase between lobby start and topic voting when random rules are On. Existing topic tie/result/chosen phases stay in place.

Add host actions for setting the toggle, continuing from rule reveal, inspecting sanitized deck status and starting a fresh deck cycle in permitted setup states. Add a player-owned action for marking or unmarking their own performed clue turn before voting.

Update every affected phase allowlist: abandon, host settings while manually paused, leave/remove before roles, reconnect preservation, late-join handling and invitation access. A reveal-phase participant who leaves may trigger the existing minimum-player return to the lobby. It must not redraw a finalized rule merely because the roster changed while at least three remain.

Classic retains its existing optional text entry, edit/remove ownership and read-only voting history. Nonverbal rounds reject text-clue writes on the server. Their board accepts only a typed performed marker; a client cannot supply arbitrary text under that action.

### 10.3 Public and private views

Add sanitized fields to `src/types.ts` and `Game::view`:

- Public active rule and concise instructions.
- Host-visible requested toggle and next-round-effect status.
- Public feasible topic IDs for the frozen ballot.
- Typed clue entries: Classic text or a performed marker, with player ID and turn.
- Host-only aggregate deck availability/exhaustion state.
- Structured recoverable error codes such as `no_fresh_topics`, `history_unavailable` and `selection_conflict`.

Do not send consumed-word lists, candidate word IDs, semantic families, hint alternatives, the host's full history or another player's private card. Even the host UI must not reveal the current hidden word through a history screen when the host is the imposter. Keep initial deck management aggregate-only; disable mutations during a frozen/dealt round.

The private card receives the frozen selected hint for the imposter and the secret word for civilians. Preserve concealment on entry/backgrounding and existing recheck behavior until results.

### 10.4 Transport compatibility

Update all three mutation paths and the browser guest action allowlist. Browser guests may mark their own performed turns; they cannot change rules, reset history or submit host actions.

Add a gameplay capability handshake independent of the invitation-format version. The new host needs clients that understand the reveal phase, rule reminders and performed clues because the host can enable the mechanic mid-party. Older installed guests should receive an update-required message before admission, with browser joining as the existing alternative. A stale host-served browser bundle should reload safely, preserving its player identity and locked actions.

Do not let an old client unknowingly type spoken clues into a Sound Only round.

## 11. Frontend implementation

Use the nine mockups in this folder and the existing `DESIGN.md` / motion system. Final implementation must be compared with the mockups; generated images are design references, not app backgrounds.

Implement:

1. Lobby rule summary, session-settings entry and **Reveal round rule** action when On.
2. Session-settings sheet with one toggle and the three rule descriptions.
3. Shared rule-reveal component with Classic, Act It and Sound Only variants.
4. Filtered topic ballot with a persistent rule reminder. Use authoritative availability, not frontend guesses from topic names.
5. Existing tie results with the rule retained. Topic tie odds still depend only on tied leaders.
6. Chosen-topic screen retaining the rule and leading to private cards.
7. Private card and ready/waiting views with a compact public rule reminder, without changing concealment behavior.
8. Nonverbal clue board with optional **Mark my turn performed** and no input/recording controls. Missing markers remain normal and never block another turn or voting.
9. Voting/runoff with read-only history appropriate to the active rule.
10. Mid-round settings showing the current rule and the next-round effect of a changed toggle.

Preserve invitation access, card rechecking, manual pause, the host's Another clue turn / Open voting controls, and all existing score/report/punishment flows.

Use restrained shared reveal motion. The animation presents a result already committed by the server. Reduced motion shows that same result directly. Do not add a roulette that can imply rerolling or delay authoritative game state.

### Additional designs required by persistent deduction

The current nine images do not cover these new requirements. Produce focused review mockups before final UI implementation:

- Aggregate **Word deck** status in host settings, distinguishing word deck from score session.
- No feasible fresh round / no fresh topics state, with an accurate reason and **Enable more topics** action.
- **Start fresh word deck** explanation and confirmation; players/scores stay, previously played concepts become eligible again.
- A concise history-save failure with retry, before private cards are dealt.

A history transfer UI is separate optional follow-up work. Do not add more toggles for individual rules unless the user requests that product change.

## 12. File-level work map

- `crates/party-core/content/topics.json`: stable word IDs, concepts and reviewed family references while preserving mode classification and display content.
- `crates/party-core/content/hint-review.json` and `mode-review.json`: approved dynamic hint options and candidate relationships that survive the new checks.
- New diversity review and generated compact selection index under `crates/party-core/content/`: equivalence/family evidence and deterministic runtime data.
- `scripts/prepare-content.py`, `scripts/test_prepare_content.py`, `TOPIC-MODES.md`: identity/family/index validation, negative cases, regenerated inventories and dynamic-pool simulation reports.
- `crates/party-core/src/content.rs`: load extended content and retain static mode compatibility; retire automatic refill.
- New `selection.rs`: pure availability, deductions, similarity windows, dynamic hint checks and random target/hint choice.
- New `history.rs`: store interface, migrations, durable event/cycle transactions, ownership and in-memory test implementation.
- `crates/party-core/src/game.rs`: new rule phase, frozen round state, mode hints, performed clues and staged transitions.
- `crates/party-core/src/network.rs` / `network/web.rs`: central coordinator, all transport paths, authorization/capability checks and sanitized snapshots.
- `crates/party-core/src/bin/party-dev.rs`: injected development history path and isolated test configuration.
- `src-tauri/src/lib.rs` and relevant Cargo configuration: app-data store initialization and Android persistence integration.
- `src/types.ts`, `src/api.ts`, `src/App.tsx`, existing illustration/icon/style/motion files: feature UI, typed actions/errors, reminders and optional markers.
- New browser smoke scripts for random rules, persistent deduction and exhaustion; update existing scripts affected by the new phase.
- `README.md`, `TOPICS.md`, `PRODUCT.md`, `PLAN.md`, feature implementation record and help/release copy: explain deck persistence, reset semantics and compatibility limits.

## 13. Implementation sequence and completion gates

### Milestone 1 — selection specification and content identity

Finalize stable IDs, concept equivalences, family definitions, the initial cooldown policy and approved fallback hints. Add validators and generate the selection index. Produce a dry-run report for every topic/mode: starting entries, distinct concepts/families, hint-supported fresh targets and eventual stranded remainder.

**Gate:** all 581 entries classified for the new metadata; no ID/alias conflicts; reviewed starting pools remain valid; content checks catch stale indexes and invalid families. Report depletion limits honestly rather than inflating counts.

### Milestone 2 — durable store and host lifecycle

Implement the store interface, transactional event/cycle model, app-data injection, migrations and single-deck ownership. Prove the SQLite dependency builds and writes durably on both current Android ABIs. Add isolated development/test stores.

**Gate:** a word consumed by one host instance remains excluded in a completely new party and a new host process using the same store. Write failures and malformed stores cannot silently create a fresh deck.

### Milestone 3 — new pure selector

Implement exact and concept deductions, family windows, fixed-point hint viability, uniform feasible-rule availability and explicit exhaustion. Remove automatic refill from production selection. Integrate durable deduction with Classic first, before enabling the new rule screens.

**Gate:** Classic alone fixes cross-party repetition. No exact/equivalent repeat occurs before an explicit fresh cycle, and recent-family windows are enforced without resetting history.

### Milestone 4 — authoritative round rules and transports

Implement the new phase, frozen availability, toggle timing, mode-specific hint selection, performed markers and one durable commit path. Update native/browser authorization, capabilities, reconnection and pause/removal allowlists.

**Gate:** mixed native/browser clients share one rule and one deal. Duplicate actions, timeouts, disconnects and stale requests cannot redraw or double-consume content.

### Milestone 5 — frontend and additional state designs

Implement the nine screens and the additional deck/exhaustion/error designs using existing components. Keep all host controls and privacy behavior accessible. Update help text for actual rule semantics.

**Gate:** full Sound Only, Act It and Classic rounds work from lobby through the next score session; settings can change mid-party; visual comparisons and compact-phone checks pass.

### Milestone 6 — full regression and depletion simulations

Run content validation, frontend build, Rust tests, mixed-client flows, persistence process-restart tests and long deterministic selection simulations. Include restricted topic sets and prolonged repeated use of one mode.

**Gate:** simulations terminate with an explicit availability/exhaustion result, never an invalid deal, automatic refill or endless retry. Existing scoring, reports, recovery and opt-in behavior remain correct.

### Milestone 7 — device playtest and packaging

Build an APK containing the feature and reviewed data. Test on physical phones on one router, including browser guests. Play long enough to cross a score-session boundary, end and recreate the party, and restart the host app while retaining history.

Measure whether the six/four-round family windows reduce repetitive clues without removing too many useful topics. Record ambiguous words, ineffective hints, repeated acoustic/gesture families, stranded fresh content and selection latency. Revise content/policy with fresh participants as needed.

**Gate:** documented real-device evidence and user review of the resulting interface/gameplay. Passing automated tests does not constitute that review. Prepare the release notes and package; publishing remains a separate requested action.

## 14. Test coverage required

### Content and identity

- Stable IDs survive display/hint edits; IDs cannot be reused or duplicated.
- Aliases and concept merges retain previous deductions across catalog versions.
- Family references, rule scopes and approved hint candidates are complete and valid.
- Generated selection index and inventories match canonical sources.
- Starting pools satisfy ten reviewed entries; unsupported packs remain unavailable.
- Dynamic hint filtering correctly removes unique-answer and recursively unsupported candidates.

### Selection and history

- No word or consumed equivalent returns in another round, another mode, a new score session, a new party or a restarted process on the same store.
- New catalog words become available without restoring consumed IDs.
- Recent semantic and mode-specific clue families are spaced across party boundaries.
- Family cooldowns age by persisted deal sequence, including other modes; clock changes do not affect them.
- An exhausted pool never clears itself, chooses an incompatible word or changes the chosen topic.
- An explicit fresh cycle permits older concepts again while retaining the recent-family guard.
- Static minimum ten and dynamically feasible remainder are tested separately.
- Rule selection is uniform for a fixed feasible-rule set; target probability is not multiplied by its number of hint options. Topic tie sampling remains independently uniform.
- Long seeded simulations cover all-topic play, one-topic play, small enabled sets, opt-in-only sets and modes becoming unavailable during depletion.

### Durability and concurrency

- Duplicate begin/deal requests consume exactly once.
- No history write occurs for rule reveals, topic votes, card rechecks or extra clue turns.
- Failure before commit reveals no word; failure after commit cannot restore it as fresh.
- HTTP timeout/cancellation and lost responses do not cause another draw.
- A restart after durable commit loads the deduction even though the old live party cannot resume.
- Ownership prevents two live parties using the same deck from dealing stale candidates.
- Imports, resets and migrations cannot change a frozen ballot or active deal.
- Missing directories, permission errors, full storage, damaged databases and unknown schema versions have explicit behavior and no silent history loss.
- Test fixtures and smoke runs cannot touch production/developer history.

### Game and transport

- All three mode outcomes occur before topic voting and remain fixed through reconnects.
- On/off changes before and after commitment take effect at the specified boundary.
- Settings remain usable while manually paused without unpausing the round.
- Leaving/removing players during rule reveal follows the same roster/minimum-player rules as setup.
- Nonverbal text writes, editing another player's marker, stale turns, host actions from guests and actions from replaced browser controllers are rejected.
- Classic clue entry/edit/remove remains optional and behaves as before.
- Repeated clue turns, original ballots, runoff, bets, streaks, delayed report deductions, punishment order and session completion remain unchanged.
- No guest/public response leaks future candidates, history, alternate hints or other private cards. The host's own imposter UI also cannot inspect the current hidden word through deck management.
- Old native clients and stale browser bundles receive a clear compatibility path.

### UI and device flow

- Compare all implemented feature states to the proposed mockups, including guest waiting states.
- Check 320px width and compact 360×700 layouts as well as normal/tall phones; allow scrolling without hiding critical controls.
- Preserve keyboard/touch selection, large targets, screen-reader labels, reduced motion and contrast.
- Verify card concealment on backgrounding and successful recheck after reconnecting in every mode.
- End a party, create another and observe continued deductions; force-stop/reopen the host and repeat with a new party.
- Confirm the ledger survives an ordinary app upgrade that preserves app data.

## 15. Acceptance scenarios

1. **Fresh Sound Only round:** rule appears first; the topic ballot contains only currently feasible sound topics; the host deals one compatible word with a viable private hint; players mark performances optionally; normal voting and scoring finish.
2. **Mid-round toggle:** host turns random rules Off during Sound Only. Everyone keeps Sound Only until the round ends. Next round uses Classic and the same persistent word exclusions.
3. **New score session:** scores reset through the existing flow; no consumed word or concept becomes fresh, and recent clue families remain spaced.
4. **Party ended and recreated:** same host closes the party and creates another. Played words remain deducted without re-entering a code or reselecting a deck.
5. **Host restarted:** force-stopping ends the live party as today. On reopening and hosting a new party, durable deductions still apply.
6. **Similar clue avoidance:** after Pasta is played, Noodles is not selected inside the semantic window. After a phone-ring sound clue, related ringtone candidates across topics are excluded inside the acoustic window.
7. **Equivalent wording:** dealing an entry in a reviewed equivalent-concept set removes its alternate labels for the active cycle, even under another topic or mode.
8. **Content nearly exhausted:** the app offers only feasible topics. If none remain, it explains the cause and offers deliberate recovery. It never restarts the word list on its own.
9. **Write fails at deal time:** no private card is exposed and the host can retry. Once a deal is durably committed, retries preserve it and cannot consume a second word.
10. **New catalog version:** added words are fresh, renamed words keep deductions, reviewed equivalent merges apply, and unknown/removed historical IDs are retained rather than discarded.

## 16. Scope boundaries and follow-up work

Required for this feature: all three rules, rule-first topic voting, mid-party toggle, reviewed content integration, durable same-device deductions, near-clue spacing, safe hints, explicit exhaustion, transport parity, tests, additional-state UI and device validation.

Optional follow-ups: named group decks, manually marking older already-played words, one-round similarity relaxation, history export/import and transfer to another host. If transfer is implemented later, import into the target deck must merge consumed concepts and recent history safely; it must never overwrite them with a smaller exclusion set. Keep transfer outside active rounds and review its UI separately.

No automatic cloud synchronization or persistent live-party recovery is implied. Existing rounds, scores and credentials continue to follow their current lifetimes; only the word deck gains independent durable history.

The most important release condition is behavioral: **starting another score session, ending a party or restarting the host must never be an accidental shortcut to replaying already consumed words.**
