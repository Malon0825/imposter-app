async function topicVotingSmoke(page) {
  const base = new URL(page.url()).origin;
  const assert = (value, message) => {
    if (!value) throw Error(message);
  };
  const call = async (method, data = {}) => {
    const response = await page.request.post(`${base}/api/${method}`, {
      headers: { "X-Imposter-Dev": "1" },
      data,
    });
    const value = await response.json();
    if (!response.ok()) throw Error(value.error);
    return value;
  };
  const host = await call("create", {
    name: "Topic voting",
    player: "Alex",
    wifi: "Shared Wi-Fi",
  });
  const contexts = [],
    guests = [],
    natives = [],
    errors = [];
  let round = 0,
    alive = true;
  const act = async (session, kind, value = null) => {
    const state = await call("action", {
      session_id: session.session_id,
      action: { id: crypto.randomUUID(), round_id: round, kind, value },
    });
    round = state.round_id;
    return state;
  };
  const heartbeat = (async () => {
    while (alive) {
      await page.waitForTimeout(2000);
      if (alive)
        await Promise.all(
          natives.map((s) =>
            call("state", { session_id: s.session_id }).catch(() => {}),
          ),
        );
    }
  })();
  const watch = (p) => p.on("pageerror", (e) => errors.push(e.message));
  const choose = async (p, topic) =>
    p.getByRole("button", { name: topic, exact: true }).click();
  const capture = async (name) => {
    await page.waitForTimeout(650);
    await page.screenshot({
      path: `output/playwright/topic-voting-${name}.png`,
    });
    const bounds = await page
      .locator("main")
      .evaluate((el) => ({ width: el.scrollWidth, screen: innerWidth }));
    assert(bounds.width <= bounds.screen + 1, `Horizontal overflow: ${name}`);
    const primary = page.locator("main .button.primary").last();
    if (await primary.count()) {
      const box = await primary.boundingBox();
      assert(
        box &&
          box.y >= 0 &&
          box.y + box.height <= (await page.viewportSize()).height,
        `Primary action clipped: ${name}`,
      );
    }
  };
  try {
    watch(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await page.evaluate(
      (s) => sessionStorage.setItem("imposter.session.v1", JSON.stringify(s)),
      host,
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "Topic voting", exact: true })
      .waitFor();
    for (const name of ["Sam", "Jo", "Lee"])
      natives.push(
        await call("join", {
          invitation: host.credentials.invitation,
          player: name,
        }),
      );
    for (const name of ["Mia", "Ben"]) {
      const context = await page
        .context()
        .browser()
        .newContext({ viewport: { width: 360, height: 700 } });
      contexts.push(context);
      const p = await context.newPage();
      watch(p);
      await p.goto(host.credentials.invitation);
      await p
        .getByRole("button", { name: "Continue in browser", exact: true })
        .click();
      await p
        .getByRole("textbox", { name: "Your name", exact: true })
        .fill(name);
      await p.getByRole("button", { name: "Join party", exact: true }).click();
      await p.getByRole("button", { name: "I’m ready", exact: true }).click();
      const saved = await p.evaluate(() =>
        JSON.parse(localStorage.getItem("imposter.web.session.v1")),
      );
      guests.push({ page: p, id: saved.credentials.player_id, name });
    }
    for (const s of natives) await act(s, "ready", true);
    await page
      .getByRole("button", { name: "Vote for topic", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Choose the mood", exact: true })
      .waitFor();
    round = (await call("state", { session_id: host.session_id })).round_id;
    assert(
      (await page.locator(".topic-tile").count()) === 19,
      "Opt-in packs silently enabled",
    );
    assert(
      await page
        .getByRole("button", { name: "Lock my vote", exact: true })
        .isDisabled(),
      "Empty ballot enabled",
    );
    await choose(page, "Food");
    await choose(page, "Animals");
    for (let i = 0; i < 20; i++) await choose(page, "Food");
    assert(
      (await page
        .getByRole("button", { name: "Food", exact: true })
        .getAttribute("aria-pressed")) === "true",
      "Rapid taps lost selection",
    );
    const mia = guests[0].page,
      ben = guests[1].page;
    await choose(mia, "Animals");
    await choose(mia, "Music");
    await mia.reload();
    await mia
      .getByRole("heading", { name: "Choose the mood", exact: true })
      .waitFor();
    assert(
      (await mia
        .getByRole("button", { name: "Animals", exact: true })
        .getAttribute("aria-pressed")) === "true",
      "Draft lost on reload",
    );
    await mia
      .getByRole("button", { name: "Lock my vote", exact: true })
      .click();
    await choose(ben, "Food");
    await choose(ben, "Animals");
    await ben
      .getByRole("button", { name: "Lock my vote", exact: true })
      .click();
    await act(natives[0], "topic_vote", ["food", "everyday"]);
    await act(natives[1], "topic_vote", ["food"]);
    const partial = await call("state", { session_id: host.session_id });
    assert(
      partial.topic_vote.counts === null && partial.private_role === null,
      "Partial tally or role leaked",
    );
    await page.getByText("4 of 6 players voted", { exact: true }).waitFor();
    await capture("01-ballot");
    await page
      .getByRole("button", { name: "Lock my vote", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Your topics are locked", exact: true })
      .waitFor();
    await capture("02-locked");
    await page.reload();
    await page
      .getByRole("heading", { name: "Your topics are locked", exact: true })
      .waitFor();
    await mia.reload();
    await mia
      .getByRole("heading", { name: "Your topics are locked", exact: true })
      .waitFor();
    await act(natives[2], "topic_vote", ["animals", "everyday"]);
    await page
      .getByRole("heading", { name: "It’s a tie.", exact: true })
      .waitFor();
    const tied = await call("state", { session_id: host.session_id });
    assert(
      JSON.stringify(tied.topic_vote.counts) ===
        JSON.stringify({ animals: 4, everyday: 2, food: 4, music: 1 }),
      "Wrong approval totals",
    );
    assert(
      (await page.getByText("50%", { exact: true }).count()) === 2,
      "Tied leaders do not show equal chances",
    );
    assert(
      (await mia
        .getByRole("button", { name: "Draw topic", exact: true })
        .count()) === 0,
      "Guest received draw control",
    );
    for (const size of [
      { width: 390, height: 844 },
      { width: 360, height: 700 },
      { width: 430, height: 880 },
    ]) {
      await page.setViewportSize(size);
      await capture(`03-tie-${size.width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Draw topic", exact: true }).click();
    await page
      .getByRole("button", { name: "Continue to roles", exact: true })
      .waitFor();
    const selected = await call("state", { session_id: host.session_id });
    const topic = selected.topic_vote.selected_topic;
    assert(
      ["food", "animals"].includes(topic),
      "A lower-voted topic entered the draw",
    );
    assert(selected.private_role === null, "Role revealed before continuation");
    for (const size of [
      { width: 390, height: 844 },
      { width: 360, height: 700 },
      { width: 430, height: 880 },
    ]) {
      await page.setViewportSize(size);
      await capture(`04-chosen-${size.width}`);
    }
    await page.getByRole("button", { name: "View votes", exact: true }).click();
    assert(
      (await page
        .getByRole("button", { name: "Draw topic", exact: true })
        .count()) === 0,
      "Review allows reroll",
    );
    await page
      .getByRole("button", { name: "Back to topic", exact: true })
      .click();
    await page.reload();
    await page
      .getByRole("button", { name: "Continue to roles", exact: true })
      .waitFor();
    assert(
      (await call("state", { session_id: host.session_id })).topic_vote
        .selected_topic === topic,
      "Reload changed draw",
    );
    await page
      .getByRole("button", { name: "Continue to roles", exact: true })
      .click();
    const states = await Promise.all(
      [host, ...natives].map((s) =>
        call("state", { session_id: s.session_id }),
      ),
    );
    for (const g of guests) {
      await g.page
        .getByRole("button", { name: "Reveal my role", exact: true })
        .click();
      const imp = await g.page
        .getByRole("heading", { name: "You are the imposter", exact: true })
        .count();
      states.push({
        my_id: g.id,
        private_role: {
          imposter: !!imp,
          clue: await g.page.locator(".secret-word").innerText(),
        },
      });
      await g.page
        .getByRole("button", { name: "Hide & ready", exact: true })
        .click();
    }
    assert(
      states.filter((s) => s.private_role.imposter).length === 1,
      "Incorrect role distribution",
    );
    const word = states.find((s) => !s.private_role.imposter).private_role.clue;
    assert(
      states
        .filter((s) => !s.private_role.imposter)
        .every((s) => s.private_role.clue === word),
      "Civilian words differ",
    );
    const imposter = states.find((s) => s.private_role.imposter).my_id;
    assert(
      states.find((s) => s.private_role.imposter).private_role.clue !== word,
      "Imposter received secret word",
    );
    for (const s of [host, ...natives]) await act(s, "role_ready");
    await act(host, "open_vote");
    for (const s of [host, ...natives])
      await act(
        s,
        "vote",
        s.credentials.player_id === imposter ? guests[0].id : imposter,
      );
    for (const g of guests) {
      const target = g.id === imposter ? host.credentials.player_id : imposter;
      const name = selected.players.find((p) => p.id === target).name;
      await g.page.locator(".ballot-row").filter({ hasText: name }).click();
      await g.page
        .getByRole("button", { name: "Confirm vote", exact: true })
        .click();
    }
    const result = await call("state", { session_id: host.session_id });
    assert(
      result.phase === "results" && !result.result.escaped,
      "Round did not finish correctly",
    );
    await act(host, "open_reports");
    for (const s of [host, ...natives]) await act(s, "report", []);
    for (const g of guests)
      await g.page
        .getByRole("button", { name: "Skip reporting", exact: true })
        .click();
    const punishment = await call("state", { session_id: host.session_id });
    await act(host, "skip", punishment.punishment.turn);
    await act(host, "next");
    for (const s of natives) await act(s, "ready", true);
    for (const g of guests)
      await g.page
        .getByRole("button", { name: "I’m ready", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Vote for topic", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Choose the mood", exact: true })
      .waitFor();
    round = (await call("state", { session_id: host.session_id })).round_id;
    assert(
      await page
        .getByRole("button", { name: "Lock my vote", exact: true })
        .isDisabled(),
      "New round reused selections",
    );
    const topicName = selected.catalog.find((t) => t.id === topic).name;
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const p of [page, ...guests.map((g) => g.page)]) {
      await choose(p, topicName);
      await p
        .getByRole("button", { name: "Lock my vote", exact: true })
        .click();
    }
    for (const s of natives) await act(s, "topic_vote", [topic]);
    await page
      .getByRole("button", { name: "Continue to roles", exact: true })
      .waitFor();
    assert(
      (await page
        .getByRole("button", { name: "Draw topic", exact: true })
        .count()) === 0,
      "Unique winner needs unnecessary draw",
    );
    await capture("05-unique-reduced-motion");
    await page
      .getByRole("button", { name: "Continue to roles", exact: true })
      .click();
    const second = await call("state", { session_id: host.session_id });
    assert(
      second.phase === "roles" && second.round_id === 2,
      "Next round did not reach roles",
    );
    const secondStates = await Promise.all(
      [host, ...natives].map((s) =>
        call("state", { session_id: s.session_id }),
      ),
    );
    const civilian = secondStates.find((s) => !s.private_role.imposter);
    assert(
      civilian.private_role.clue !== word,
      "Word repeated within chosen topic",
    );
    assert(!errors.length, errors.join("; "));
    return {
      passed: true,
      players: 6,
      rounds: 2,
      checks: [
        "multi-select approvals",
        "private tallies",
        "opt-in exclusion",
        "rapid taps",
        "draft and locked reload",
        "50/50 tied leaders",
        "one committed draw",
        "unique winner",
        "native/browser roles",
        "full scoring/reporting round",
        "fresh next ballot",
        "word-repeat avoidance",
        "360/390/430px layouts",
        "reduced motion",
      ],
    };
  } finally {
    alive = false;
    await act(host, "end").catch(() => {});
    await Promise.all(contexts.map((c) => c.close()));
    await heartbeat;
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
}
