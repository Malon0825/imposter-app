async function checkPrivateCardRecall(page) {
  const base = new URL(page.url()).origin;
  const assert = (value, message) => {
    if (!value) throw Error(message);
  };
  const call = async (method, body = {}) => {
    const response = await page.request.post(`${base}/api/${method}`, {
      headers: { "X-Imposter-Dev": "1" },
      data: body,
    });
    const data = await response.json();
    if (!response.ok()) throw Error(data.error);
    return data;
  };
  const host = await call("create", {
    name: "Card check",
    player: "Alex",
    wifi: "Shared Wi-Fi",
  });
  const contexts = [],
    players = [],
    failures = [];
  const watch = (p) => p.on("pageerror", (e) => failures.push(e.message));
  let round = 0;
  const act = async (kind, value = null) => {
    const view = await call("action", {
      session_id: host.session_id,
      action: { id: crypto.randomUUID(), round_id: round, kind, value },
    });
    round = view.round_id;
    return view;
  };
  const reveal = async (p) => {
    await p
      .getByRole("button", { name: "Reveal my role", exact: true })
      .click();
    await p.locator(".secret-word").waitFor();
  };
  const open = async (p) => {
    await p.getByRole("button", { name: "Check my card", exact: true }).click();
    await p
      .getByRole("heading", { name: "For your eyes only.", exact: true })
      .waitFor();
    assert(
      (await p.locator(".secret-word").count()) === 0,
      "Opening the card revealed the clue without a tap",
    );
  };
  const close = async (p) => {
    await p.getByRole("button", { name: "Hide & return", exact: true }).click();
  };
  try {
    watch(page);
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
      .getByRole("heading", { name: "Card check", exact: true })
      .waitFor();
    players.push({ page, name: "Alex", id: host.credentials.player_id });
    for (const name of ["Mia", "Ben"]) {
      const context = await page
        .context()
        .browser()
        .newContext({
          viewport: {
            width: name === "Mia" ? 360 : 393,
            height: name === "Mia" ? 740 : 852,
          },
        });
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
      players.push({ page: p, name, id: saved.credentials.player_id });
    }
    await act("start");
    await act("topic_vote", ["food"]);
    for (const g of players.slice(1)) {
      await g.page.getByRole("button", { name: "Food", exact: true }).click();
      await g.page.getByRole("button", { name: "Lock my vote", exact: true }).click();
    }
    await act("begin_round");
    for (const player of players) {
      const p = player.page;
      await reveal(p);
      player.clue = await p.locator(".secret-word").innerText();
      player.imposter =
        (await p
          .getByRole("heading", { name: "You are the imposter", exact: true })
          .count()) === 1;
      await p
        .getByRole("button", { name: "Hide & ready", exact: true })
        .click();
      if (player === players[0]) {
        await p
          .getByRole("heading", { name: "Your secret is safe.", exact: true })
          .waitFor();
        await open(p);
        await reveal(p);
        assert(
          (await p.locator(".secret-word").innerText()) === player.clue,
          "Ready player could not recheck the same clue",
        );
        await close(p);
        await p
          .getByRole("heading", { name: "Your secret is safe.", exact: true })
          .waitFor();
        assert(
          (await call("state", { session_id: host.session_id })).ready_count ===
            1,
          "Rechecking changed role readiness",
        );
      }
    }
    assert(
      players.filter((p) => p.imposter).length === 1,
      "Expected one imposter",
    );
    for (const player of players) {
      const p = player.page;
      await p
        .getByRole("heading", { name: "Who sounds suspicious?", exact: true })
        .waitFor();
      assert(
        (await p.locator(".secret-word").count()) === 0,
        "Public discussion rendered a clue",
      );
      await open(p);
      await reveal(p);
      assert(
        (await p.locator(".secret-word").innerText()) === player.clue,
        "Discussion recall changed the private clue",
      );
      await p.waitForTimeout(500);
      await p.screenshot({
        path: `output/playwright/card-recheck-${player.imposter ? "imposter" : "civilian"}-mobile.png`,
      });
      await p.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      assert(
        (await p
          .locator(".role-back")
          .evaluate((el) => getComputedStyle(el).visibility)) === "hidden",
        "Backgrounding left the clue visible",
      );
      await reveal(p);
      await close(p);
      await p
        .getByRole("heading", { name: "Who sounds suspicious?", exact: true })
        .waitFor();
    }
    await players[1].page.screenshot({
      path: "output/playwright/card-recheck-discussion-mobile.png",
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: "output/playwright/card-recheck-discussion-desktop.png",
    });
    await page.setViewportSize({ width: 393, height: 852 });
    await players[1].page.reload();
    await players[1].page
      .getByRole("heading", { name: "Who sounds suspicious?", exact: true })
      .waitFor();
    await open(players[1].page);
    await reveal(players[1].page);
    assert(
      (await players[1].page.locator(".secret-word").innerText()) ===
        players[1].clue,
      "Reload lost access to the private card",
    );
    await close(players[1].page);
    await act("pause");
    await page
      .getByRole("heading", { name: "A little pause.", exact: true })
      .waitFor();
    await open(page);
    await reveal(page);
    await close(page);
    await page
      .getByRole("button", { name: "Resume round", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Who sounds suspicious?", exact: true })
      .waitFor();
    await act("open_vote");
    for (const [i, player] of players.entries()) {
      const p = player.page,
        target = players[(i + 1) % players.length];
      await p.locator(".ballot-row").filter({ hasText: target.name }).click();
      await open(p);
      await reveal(p);
      assert(
        (await p.locator(".secret-word").innerText()) === player.clue,
        "Voting recall changed the clue",
      );
      await close(p);
      assert(
        (await p
          .locator(".ballot-row")
          .filter({ hasText: target.name })
          .getAttribute("aria-pressed")) === "true",
        "Card recall cleared the selected vote",
      );
      await p
        .getByRole("button", { name: "Confirm vote", exact: true })
        .click();
      if (i === 0) {
        await p
          .getByRole("heading", { name: "Your vote is locked", exact: true })
          .waitFor();
        await open(p);
        await reveal(p);
        await close(p);
        await p
          .getByRole("heading", { name: "Your vote is locked", exact: true })
          .waitFor();
      }
    }
    assert(
      (await call("state", { session_id: host.session_id })).phase === "runoff",
      "Expected a runoff from the three-way tie",
    );
    for (const [i, player] of players.entries()) {
      const p = player.page,
        target = players[(i + 1) % players.length];
      await p
        .getByRole("heading", { name: "One more vote.", exact: true })
        .waitFor();
      await open(p);
      await reveal(p);
      assert(
        (await p.locator(".secret-word").innerText()) === player.clue,
        "Runoff recall changed the clue",
      );
      await close(p);
      await p.locator(".ballot-row").filter({ hasText: target.name }).click();
      await p
        .getByRole("button", { name: "Confirm vote", exact: true })
        .click();
      if (i === 0) {
        await p
          .getByRole("heading", { name: "Your vote is locked", exact: true })
          .waitFor();
        await open(p);
        await reveal(p); // Leave this card open while the other ballots resolve the round.
      }
    }
    await page.locator(".screen-results").waitFor();
    assert(
      (await page.locator(".secret-word").count()) === 0,
      "Ended round kept the private card open",
    );
    assert(
      (await page
        .getByRole("button", { name: "Check my card", exact: true })
        .count()) === 0,
      "Card recall remained available after results",
    );
    for (const player of players.slice(1)) {
      const saved = await player.page.evaluate(() =>
        JSON.parse(localStorage.getItem("imposter.web.session.v1")),
      );
      assert(
        !saved.view && !saved.private_role,
        "Private card was persisted in browser storage",
      );
    }
    assert(failures.length === 0, failures.join("; "));
    return {
      passed: true,
      checks: [
        "same reveal screen reused",
        "ready-player recall",
        "civilian word and imposter hint",
        "discussion/voting/runoff recall",
        "manual-pause recall",
        "background concealment",
        "reload recovery",
        "selected and locked votes preserved",
        "automatic exit at results",
        "no stored private cards",
      ],
    };
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await call("close", { session_id: host.session_id }).catch(() => {});
    await page
      .evaluate(() => sessionStorage.removeItem("imposter.session.v1"))
      .catch(() => {});
  }
}
