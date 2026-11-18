async function clueBoardSmoke(page) {
  const base = new URL(page.url()).origin;
  const assert = (v, m) => {
    if (!v) throw Error(m);
  };
  const call = async (method, data = {}) => {
    const r = await page.request.post(`${base}/api/${method}`, {
      headers: { "X-Imposter-Dev": "1" },
      data,
    });
    const value = await r.json();
    if (!r.ok()) throw Error(value.error);
    return value;
  };
  const host = await call("create", {
    name: "Clue board",
    player: "Alex",
    wifi: "Shared Wi-Fi",
  });
  const native = await call("join", {
    invitation: host.credentials.invitation,
    player: "Sam",
  });
  let round = 0,
    alive = true;
  const contexts = [],
    guests = [],
    errors = [];
  // WebKit reports aborted fetches during our deliberate reload/close and
  // lost-response checks as page errors; the adapter handles these failures.
  const recordError = (e) => {
    if (!/guest\/(state|action).*access control checks/.test(e.message))
      errors.push(e.message);
  };
  const act = async (session, kind, value = null) => {
    const v = await call("action", {
      session_id: session.session_id,
      action: { id: crypto.randomUUID(), round_id: round, kind, value },
    });
    round = v.round_id;
    return v;
  };
  const heartbeat = (async () => {
    while (alive) {
      await page.waitForTimeout(1000);
      if (alive)
        await call("state", { session_id: native.session_id }).catch(() => {});
    }
  })();
  const edit = async (p, name, text) => {
    await p.getByRole("button", { name, exact: true }).click();
    await p.getByRole("textbox", { name: "Your clue", exact: true }).fill(text);
    await p.getByRole("button", { name: "Save clue", exact: true }).click();
    await p.getByRole("dialog").waitFor({ state: "hidden" });
  };
  const capture = async (p, name) => {
    await p.waitForTimeout(500);
    await p.screenshot({
      path: `output/playwright/clue-board-${name}.png`,
      fullPage: true,
    });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Overflow: ${name}`,
    );
  };
  try {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(base);
    await page
      .getByRole("button", { name: "Host party", exact: true })
      .waitFor();
    await page.evaluate(
      (s) =>
        sessionStorage.setItem(
          "imposter.session.v1",
          JSON.stringify({
            session_id: s.session_id,
            credentials: s.credentials,
          }),
        ),
      host,
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "Clue board", exact: true })
      .waitFor();
    for (const name of ["Mia", "Ben"]) {
      const c = await page
        .context()
        .browser()
        .newContext({ viewport: { width: 360, height: 740 } });
      contexts.push(c);
      const p = await c.newPage();
      p.on("pageerror", recordError);
      await p.goto(host.credentials.invitation);
      await p
        .getByRole("button", { name: "Continue in browser", exact: true })
        .click();
      await p
        .getByRole("textbox", { name: "Your name", exact: true })
        .fill(name);
      await p.getByRole("button", { name: "Join party", exact: true }).click();
      await p.getByRole("button", { name: "I’m ready", exact: true }).click();
      guests.push(p);
    }
    await act(native, "ready", true);
    await act(host, "start");
    await act(host, "topic_vote", ["food"]);
    await act(native, "topic_vote", ["food"]);
    for (const p of guests) {
      await p.getByRole("button", { name: "Food", exact: true }).click();
      await p
        .getByRole("button", { name: "Lock my vote", exact: true })
        .click();
    }
    await act(host, "begin_round");
    await act(host, "role_ready");
    await act(native, "role_ready");
    for (const p of guests) {
      await p
        .getByRole("button", { name: "Reveal my role", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Hide & ready", exact: true })
        .click();
    }
    const before = await call("state", { session_id: host.session_id });
    await page
      .getByRole("button", { name: "Another clue turn", exact: true })
      .waitFor();
    assert(
      await page
        .getByRole("button", { name: "Open voting", exact: true })
        .isEnabled(),
      "Optional clues block voting",
    );
    await edit(page, "Add clue for turn 1", "Umbrella");
    let lost = false;
    await guests[0].route("**/guest/action", async (route) => {
      const b = route.request().postDataJSON();
      if (b.kind === "clue" && !lost) {
        lost = true;
        await route.fetch();
        await route.abort();
      } else await route.continue();
    });
    await guests[0]
      .getByRole("button", { name: "Add clue for turn 1", exact: true })
      .click();
    await guests[0]
      .getByRole("textbox", { name: "Your clue", exact: true })
      .fill("Rain");
    await guests[0]
      .getByRole("button", { name: "Save clue", exact: true })
      .click();
    await guests[0].getByRole("alert").waitFor();
    assert(
      (await guests[0]
        .getByRole("textbox", { name: "Your clue", exact: true })
        .inputValue()) === "Rain",
      "Failed save lost the draft",
    );
    await guests[0]
      .getByRole("button", { name: "Save clue", exact: true })
      .click();
    await guests[0].getByRole("dialog").waitFor({ state: "hidden" });
    await guests[0].unroute("**/guest/action");
    await act(native, "clue", { turn: 1, text: "Boots" });
    await page
      .getByRole("button", { name: "Another clue turn", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add clue for turn 2", exact: true })
      .waitFor();
    await edit(page, "Add clue for turn 2", "Drizzle");
    await edit(guests[0], "Add clue for turn 2", "Puddle");
    await edit(guests[0], "Edit my clue for turn 1", "Cloud");
    await guests[0]
      .getByRole("button", { name: "Edit my clue for turn 1", exact: true })
      .click();
    await guests[0]
      .getByRole("button", { name: "Remove this clue", exact: true })
      .click();
    await guests[0].getByRole("dialog").waitFor({ state: "hidden" });
    let state = await call("state", { session_id: host.session_id });
    assert(
      state.clues.length === 4,
      "Retries, editing or removal corrupted clue history",
    );
    assert(
      state.round_id === before.round_id &&
        state.role_ready === before.role_ready &&
        state.ready_count === before.ready_count,
      "Clue turn changed game readiness",
    );
    assert(
      state.players.every((p) => p.points === 0),
      "Clues changed scores",
    );
    await capture(page, "discussion-mobile");
    await page.setViewportSize({ width: 1280, height: 900 });
    await capture(page, "discussion-desktop");
    await page.setViewportSize({ width: 393, height: 852 });
    await page
      .getByRole("button", { name: "Edit my clue for turn 2", exact: true })
      .click();
    await capture(page, "editor");
    const keyboardBounds = await page.evaluate(() => {
      const viewport = window.visualViewport;
      const descriptor = Object.getOwnPropertyDescriptor(viewport, "height");
      const visibleHeight = innerHeight - 300;
      Object.defineProperty(viewport, "height", {
        configurable: true,
        value: visibleHeight,
      });
      viewport.dispatchEvent(new Event("resize"));
      const bottom = document
        .querySelector('.clue-editor button[type="submit"]')
        .getBoundingClientRect().bottom;
      if (descriptor) Object.defineProperty(viewport, "height", descriptor);
      else delete viewport.height;
      viewport.dispatchEvent(new Event("resize"));
      return { bottom, visibleHeight };
    });
    assert(
      keyboardBounds.bottom <= keyboardBounds.visibleHeight + 1,
      "Save clue was covered by the simulated on-screen keyboard",
    );
    await page
      .getByRole("button", { name: "Close clue editor", exact: true })
      .click();
    await guests[0].reload();
    await guests[0]
      .getByRole("button", { name: "Edit my clue for turn 2", exact: true })
      .waitFor();
    const returningContext = guests[0].context();
    await guests[0].close();
    await page
      .locator(".player-connection-notice")
      .filter({ hasText: "Mia" })
      .waitFor({ timeout: 20000 });
    guests[0] = await returningContext.newPage();
    guests[0].on("pageerror", recordError);
    await guests[0].goto(host.credentials.invitation);
    await guests[0]
      .getByRole("button", { name: "Edit my clue for turn 2", exact: true })
      .waitFor();
    await guests[0]
      .getByRole("button", { name: "Edit my clue for turn 2", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Another clue turn", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add clue for turn 3", exact: true })
      .waitFor();
    await guests[0]
      .getByRole("textbox", { name: "Your clue", exact: true })
      .fill("Puddle edited");
    await guests[0]
      .getByRole("button", { name: "Save clue", exact: true })
      .click();
    await guests[0].getByRole("dialog").waitFor({ state: "hidden" });
    state = await call("state", { session_id: host.session_id });
    assert(
      state.clues.some((c) => c.turn === 2 && c.text === "Puddle edited") &&
        !state.clues.some((c) => c.turn === 3),
      "Turn advance silently retargeted an open editor",
    );
    await guests[0]
      .getByRole("button", { name: "Add clue for turn 3", exact: true })
      .click();
    await guests[0]
      .getByRole("textbox", { name: "Your clue", exact: true })
      .fill("Not saved");
    await page
      .getByRole("button", { name: "Open voting", exact: true })
      .click();
    await guests[0].getByRole("dialog").waitFor({ state: "hidden" });
    await page
      .locator(".ballot-row")
      .filter({ hasText: "Mia" })
      .getByText("Turn 2: Puddle edited", { exact: true })
      .waitFor();
    assert(
      !(await call("state", { session_id: host.session_id })).clues.some(
        (c) => c.text === "Not saved",
      ),
      "Voting accepted an unsaved clue",
    );
    await capture(page, "voting");
    await act(host, "vote", native.credentials.player_id);
    await act(native, "vote", host.credentials.player_id);
    for (const [i, p] of guests.entries()) {
      await p
        .locator(".ballot-row")
        .filter({ hasText: i === 0 ? "Sam" : "Alex" })
        .click();
      await p
        .getByRole("button", { name: "Confirm vote", exact: true })
        .click();
    }
    await page
      .getByRole("heading", { name: "One more vote.", exact: true })
      .waitFor();
    await page.getByText("Turn 2: Puddle edited", { exact: true }).waitFor();
    await act(host, "abandon");
    state = await call("state", { session_id: host.session_id });
    assert(
      state.clues.length === 0 && state.clue_turn === 0,
      "Abandon carried clues to lobby",
    );
    await act(native, "ready", true);
    for (const p of guests)
      await p.getByRole("button", { name: "I’m ready", exact: true }).click();
    await act(host, "start");
    await act(host, "topic_vote", ["food"]);
    await act(native, "topic_vote", ["food"]);
    for (const p of guests) {
      await p.getByRole("button", { name: "Food", exact: true }).click();
      await p
        .getByRole("button", { name: "Lock my vote", exact: true })
        .click();
    }
    state = await act(host, "begin_round");
    assert(
      state.clues.length === 0 && state.clue_turn === 1,
      "New round kept old clues",
    );
    assert(errors.length === 0, errors.join("; "));
    return {
      passed: true,
      checks: [
        "native and browser clue sharing",
        "optional entry",
        "three clue turns",
        "edit/remove older clues",
        "lost-response retry",
        "same-turn reload recovery",
        "closed-tab rescan restores clue history",
        "open editor retains target turn",
        "keyboard viewport keeps Save visible",
        "voting closes editor and freezes clues",
        "full runoff history",
        "new round reset",
        "no score/readiness changes",
      ],
    };
  } finally {
    alive = false;
    await heartbeat;
    for (const c of contexts) await c.close().catch(() => {});
    await call("close", { session_id: native.session_id }).catch(() => {});
    await call("close", { session_id: host.session_id }).catch(() => {});
    await page
      .evaluate(() => sessionStorage.removeItem("imposter.session.v1"))
      .catch(() => {});
  }
}
