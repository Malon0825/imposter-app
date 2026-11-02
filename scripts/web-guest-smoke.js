async function smokeBrowserGuests(page) {
  const base = "http://127.0.0.1:1428";
  const assert = (value, message) => {
    if (!value) throw Error(message);
  };
  const bridge = async (method, body = {}) => {
    const response = await page.request.post(`${base}/api/${method}`, {
      headers: { "X-Imposter-Dev": "1" },
      data: body,
    });
    const data = await response.json();
    if (!response.ok()) throw Error(data.error);
    return data;
  };
  const host = await bridge("create", {
    name: "Offline friends",
    player: "Alex",
    wifi: "Home Wi-Fi",
  });
  const invitation = host.credentials.invitation;
  assert(
    invitation.startsWith("http://") && invitation.includes("#invite="),
    "Host did not generate a shared QR URL",
  );
  const native = await bridge("join", { invitation, player: "Sam" }); // Real Rust pinned-TLS guest.
  let round = 0;
  const act = async (session, kind, value = null) => {
    const v = await bridge("action", {
      session_id: session.session_id,
      action: { id: crypto.randomUUID(), round_id: round, kind, value },
    });
    round = v.round_id;
    return v;
  };
  await act(native, "ready", true);
  const ownedContexts = [];
  let keepNativeAlive = true;
  const nativeHeartbeat = (async () => {
    while (keepNativeAlive) {
      await page.waitForTimeout(1000);
      if (keepNativeAlive)
        await bridge("state", { session_id: native.session_id }).catch(
          () => {},
        );
    }
  })();
  try {
    const browser = page.context().browser();
    const guests = [];
    const failures = [];
    for (const [i, name] of ["Mia", "Ben"].entries()) {
      const context = await browser.newContext({
        viewport: { width: i ? 360 : 393, height: i ? 740 : 852 },
        userAgent: i
          ? "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/142.0.0.0 Mobile Safari/537.36"
          : "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1",
      });
      ownedContexts.push(context);
      await context.addInitScript(() => {
        Object.defineProperty(crypto, "randomUUID", {
          value: undefined,
          configurable: true,
        });
      });
      let p = await context.newPage();
      p.on("pageerror", (e) => failures.push(e.message));
      const origin = new URL(invitation).origin;
      p.on("request", (r) => {
        if (!r.url().startsWith(origin))
          failures.push(`External dependency: ${r.url().split("#")[0]}`);
      });
      await p.goto(invitation);
      await p
        .getByRole("button", { name: "Continue in browser", exact: true })
        .waitFor();
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(400);
      const layout = await p.evaluate(() => {
        const controls = [...document.querySelectorAll(".actions .button")];
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          bottom: Math.max(
            ...controls.map((b) => b.getBoundingClientRect().bottom),
          ),
          height: innerHeight,
        };
      });
      assert(
        !layout.overflow && layout.bottom <= layout.height + 1,
        "Browser join choices do not fit the phone screen",
      );
      await p.screenshot({
        path: `output/playwright/web-guest-${name.toLowerCase()}-join.png`,
      });
      assert(
        (await p
          .getByRole("button", { name: "Host party", exact: true })
          .count()) === 0,
        "Browser exposed host setup",
      );
      if (i)
        assert(
          (await p
            .getByRole("link", { name: "Open in Imposter", exact: true })
            .count()) === 1,
          "Android app handoff missing",
        );
      else
        assert(
          (await p
            .getByRole("link", { name: "Open in Imposter", exact: true })
            .count()) === 0,
          "iPhone showed Android app handoff",
        );
      await p
        .getByRole("button", { name: "Continue in browser", exact: true })
        .click();
      await p
        .getByRole("textbox", { name: "Your name", exact: true })
        .fill(name);
      if (i === 0) {
        let interrupted = false;
        await p.route("**/guest/join", async (route) => {
          if (interrupted) return route.continue();
          interrupted = true;
          await route.fetch();
          await route.abort();
        });
        await p
          .getByRole("button", { name: "Join party", exact: true })
          .click();
        await p.getByRole("alert").waitFor();
        await p.reload();
        await p
          .getByRole("button", { name: "Continue in browser", exact: true })
          .click();
        await p
          .getByRole("textbox", { name: "Your name", exact: true })
          .fill(name);
      }
      await p.getByRole("button", { name: "Join party", exact: true }).click();
      await p
        .getByRole("heading", { name: "Offline friends", exact: true })
        .waitFor();
      const stored = await p.evaluate(() =>
        JSON.parse(localStorage.getItem("imposter.web.session.v1")),
      );
      assert(
        stored && stored.credentials.is_host === false,
        "Browser identity is invalid",
      );
      assert(
        new URL(p.url()).hash === "",
        "Invitation stayed in the address bar after admission",
      );
      await p.reload();
      await p
        .getByRole("heading", { name: "Offline friends", exact: true })
        .waitFor();
      const restored = await p.evaluate(() =>
        JSON.parse(localStorage.getItem("imposter.web.session.v1")),
      );
      assert(
        restored.credentials.player_id === stored.credentials.player_id,
        "Refresh duplicated the player",
      );
      if (i === 0) {
        const replacement = await context.newPage();
        await replacement.goto(`${origin}/play`);
        await replacement
          .getByRole("heading", { name: "Offline friends", exact: true })
          .waitFor();
        await p
          .getByText("Your player is open in another tab.", { exact: false })
          .waitFor();
        await p.close();
        p = replacement;
      }
      await p.getByRole("button", { name: "I’m ready", exact: true }).click();
      guests.push({ page: p, context, session: restored, name });
    }
    assert(
      (await bridge("state", { session_id: host.session_id })).players
        .length === 4,
      "Join retry or reload created an extra player",
    );
    await act(host, "start");
    const views = [
      await bridge("state", { session_id: host.session_id }),
      await bridge("state", { session_id: native.session_id }),
    ];
    for (const guest of guests) {
      const p = guest.page;
      await p
        .getByRole("button", { name: "Reveal my role", exact: true })
        .waitFor();
      await p
        .getByRole("button", { name: "Reveal my role", exact: true })
        .click();
      await p.waitForTimeout(550);
      await p.screenshot({
        path: `output/playwright/web-guest-${guest.name.toLowerCase()}-role.png`,
      });
      const imposter = await p
        .getByRole("heading", { name: "You are the imposter", exact: true })
        .count();
      views.push({
        my_id: guest.session.credentials.player_id,
        private_role: { imposter: !!imposter },
      });
      await p.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      assert(
        (await p
          .locator(".role-back")
          .evaluate((el) => getComputedStyle(el).visibility)) === "hidden",
        "Page exit left the private face visible",
      );
      await p
        .getByRole("button", { name: "Reveal my role", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Hide & ready", exact: true })
        .click();
    }
    await act(host, "role_ready");
    await act(native, "role_ready");
    await act(host, "open_vote");
    const imposters = views.filter((v) => v.private_role?.imposter);
    assert(imposters.length === 1, "Mixed clients disagree about the imposter");
    const imposter = imposters[0].my_id;
    const publicView = await bridge("state", { session_id: host.session_id });
    for (const session of [host, native])
      await act(
        session,
        "vote",
        session.credentials.player_id === imposter
          ? guests[0].session.credentials.player_id
          : imposter,
      );
    for (const guest of guests) {
      const target =
        guest.session.credentials.player_id === imposter
          ? host.credentials.player_id
          : imposter;
      const targetName = publicView.players.find((p) => p.id === target).name;
      await guest.page
        .locator(".ballot-row")
        .filter({ hasText: targetName })
        .click();
      await guest.page
        .getByRole("button", { name: "Confirm vote", exact: true })
        .click();
      if (guest === guests[0]) {
        await guest.page
          .getByRole("heading", { name: "Your vote is locked", exact: true })
          .waitFor();
        await guest.page.reload();
        await guest.page
          .getByRole("heading", { name: "Your vote is locked", exact: true })
          .waitFor();
        await guest.page.screenshot({
          path: "output/playwright/web-guest-locked-vote.png",
        });
      }
    }
    const result = await bridge("state", { session_id: host.session_id });
    assert(
      result.phase === "results" && !result.result.escaped,
      "Mixed voting did not catch the imposter",
    );
    for (const p of result.players)
      assert(p.points === (p.id === imposter ? 0 : 1), "Incorrect score");
    await act(host, "punish");
    let state = await bridge("state", { session_id: host.session_id });
    const loser = state.punishment.player_id;
    const actor = [host, native].find((s) => s.credentials.player_id === loser);
    if (actor) {
      await act(actor, "choice", "dare");
      await act(actor, "done");
    } else {
      const g = guests.find((g) => g.session.credentials.player_id === loser);
      await g.page.getByRole("button", { name: "Dare", exact: true }).click();
      await g.page.getByRole("button", { name: "Done", exact: true }).click();
    }
    for (const g of guests)
      await g.page
        .getByRole("heading", { name: "The standings", exact: true })
        .waitFor();
    await act(host, "end");
    for (const g of guests) {
      await g.page
        .getByRole("heading", { name: "That’s a wrap.", exact: true })
        .waitFor();
      await g.page.waitForTimeout(1600);
      await g.page.screenshot({
        path: `output/playwright/web-guest-${g.name.toLowerCase()}-final.png`,
      });
      const storage = await g.page.evaluate(() =>
        JSON.parse(localStorage.getItem("imposter.web.session.v1")),
      );
      assert(
        !storage.view && !storage.private_role,
        "Secret view persisted in browser storage",
      );
    }
    assert(failures.length === 0, failures.join("; "));
    return {
      passed: true,
      players: 4,
      checks: [
        "production offline assets",
        "shared invitation",
        "native pinned-TLS guest",
        "iPhone and Android browser paths",
        "HTTP-compatible request IDs",
        "lost join response retry",
        "refresh identity",
        "duplicate-tab takeover",
        "private card concealment",
        "locked-vote reload",
        "mixed voting and scoring",
        "human dare turn",
        "final rankings",
        "no external requests",
      ],
    };
  } finally {
    keepNativeAlive = false;
    await nativeHeartbeat;
    for (const context of ownedContexts) await context.close().catch(() => {});
    await bridge("close", { session_id: native.session_id }).catch(() => {});
    await bridge("close", { session_id: host.session_id }).catch(() => {});
  }
}
