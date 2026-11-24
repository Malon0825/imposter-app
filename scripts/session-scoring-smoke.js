async function sessionScoringSmoke(page) {
  // Full Cast shows the role on its own screen before the card, once per round per tab.
  const passRoleStage = async (p) => {
    const see = p.getByRole("button", { name: /^See my/ });
    await see.or(p.locator(".role-heading.revealed")).first().waitFor();
    if (await see.count()) await see.click();
  };
  const base = new URL(page.url()).origin;
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
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
    name: "Score night",
    player: "Alex",
    wifi: "Shared Wi-Fi",
  });
  const natives = [host];
  const errors = [];
  let context,
    guest,
    guestHeaders,
    guestId,
    round = 0,
    alive = true,
    civilianReads = 0;
  const state = () => call("state", { session_id: host.session_id });
  const act = async (session, kind, value = null) => {
    const v = await call("action", {
      session_id: session.session_id,
      action: { id: crypto.randomUUID(), round_id: round, kind, value },
    }).catch((error) => {
      throw Error(`${kind} in round ${round}: ${error.message}`);
    });
    round = v.round_id;
    return v;
  };
  const heartbeat = (async () => {
    while (alive) {
      await page.waitForTimeout(1000);
      if (alive)
        await Promise.all(
          natives.map((s) =>
            call("state", { session_id: s.session_id }).catch(() => {}),
          ),
        );
    }
  })();
  const watch = (p) => {
    p.on("pageerror", (e) => {
      // Windows WebKit emits page errors for intentionally aborted fetches
      // during the reload/closed-tab/lost-response recovery scenarios.
      if (
        !/Fetch API cannot load .*\/(?:api|guest)\/(?:state|action) due to access control checks/.test(
          e.message,
        )
      )
        errors.push(e.message);
    });
    p.on("request", (req) => {
      if (req.url().endsWith("/guest/state")) guestHeaders = req.headers();
      if (req.url().endsWith("/guest/resume"))
        guestHeaders = {
          ...req.headers(),
          "x-imposter-controller": req.postDataJSON().controller,
        };
    });
  };
  const guestState = async () => {
    const r = await guest.request.post(
      `${new URL(host.credentials.invitation).origin}/guest/state`,
      {
        headers: {
          ...guestHeaders,
          Origin: new URL(host.credentials.invitation).origin,
        },
        data: {},
      },
    );
    const value = await r.json();
    if (!r.ok()) throw Error(value.error);
    return value;
  };
  const capture = async (p, name) => {
    await p.waitForTimeout(550);
    const overflow = await p
      .locator("main")
      .evaluate((el) => el.scrollWidth > innerWidth + 1);
    assert(!overflow, `Horizontal overflow: ${name}`);
    await p.screenshot({
      path: `output/playwright/session-scoring-${name}.png`,
      fullPage: true,
    });
  };
  const waitPhase = async (p, phase) =>
    p.locator(`main.screen-${phase}`).waitFor();
  const nativeView = (s) => call("state", { session_id: s.session_id });
  const finish = async () => {
    await waitPhase(page, "results");
    // The host reads their own result first, then the room's, where Continue lives.
    const room = page.getByRole("button", { name: "See the room", exact: true });
    const next = page.getByRole("button", { name: "Continue", exact: true });
    await room.or(next).first().waitFor();
    if (await room.count()) await room.click();
    await next.click();
    let v = await state();
    while (v.phase === "punishment")
      v = await act(host, "skip", v.punishment.turn);
    await waitPhase(page, v.phase);
    return v;
  };
  const begin = async () => {
    let v = await state();
    if (v.phase === "rankings") await act(host, "next");
    v = await state();
    if (v.phase === "lobby") {
      for (const s of natives.slice(1)) await act(s, "ready", true);
      await guest
        .getByRole("button", { name: "I’m ready", exact: true })
        .click();
      // The guest's tap is a request of its own; start only once it lands.
      for (let i = 0; i < 50 && !(await state()).players.every((p) => p.left || p.ready); i++)
        await page.waitForTimeout(200);
      await act(host, "start");
    }
    await waitPhase(page, "topic_voting");
    v = await state();
    round = v.round_id;
    const topicId = v.topic_vote.available_topics[0];
    assert(topicId, "No topic is available for the scoring round");
    const topic = v.catalog.find((entry) => entry.id === topicId);
    for (const s of natives) await act(s, "topic_vote", [topicId]);
    await guest.getByRole("button", { name: topic.name, exact: true }).click();
    await guest
      .getByRole("button", { name: "Lock my vote", exact: true })
      .click();
    await waitPhase(page, "roles");
    const views = await Promise.all(natives.map(nativeView));
    for (const s of natives) await act(s, "role_ready");
    await guest
      .getByRole("button", { name: "Reveal my role", exact: true })
      .click();
    await passRoleStage(guest);
    await guest
      .getByRole("button", { name: "Hide & ready", exact: true })
      .click();
    await act(host, "open_vote");
    await waitPhase(guest, "voting");
    const gv = await guestState();
    return {
      gv,
      imposter: gv.private_role.imposter
        ? guestId
        : views.find((v) => v.private_role.imposter).my_id,
    };
  };
  const nativeVotes = async (imposter, perfect = false) => {
    const ids = (await state()).players.filter((p) => !p.left).map((p) => p.id);
    const accused = ids.find((id) => id !== imposter && id !== guestId);
    for (const s of natives) {
      const id = s.credentials.player_id;
      const target = perfect
        ? id === accused
          ? ids.find((x) => x !== id && x !== imposter)
          : accused
        : id === imposter
          ? ids.find((x) => x !== id)
          : imposter;
      await act(s, "vote", { player_id: target, stake: 0 });
    }
    return accused;
  };
  const guestVote = async (target, stake = 0, lostResponse = false) => {
    const gv = await guestState();
    const name = gv.players.find((p) => p.id === target).name;
    await guest
      .locator(".ballot-row")
      .filter({ has: guest.getByText(name, { exact: true }) })
      .click();
    if (!gv.private_role.imposter)
      await guest
        .getByRole("button", {
          name: stake
            ? new RegExp(`^Bet ${stake} point${stake === 1 ? "" : "s"}`)
            : /^No bet$/,
        })
        .click();
    let dropped = false;
    if (lostResponse)
      await guest.route("**/guest/action", async (route) => {
        if (route.request().postDataJSON().kind === "vote" && !dropped) {
          dropped = true;
          await route.fetch();
          await route.abort();
        } else await route.continue();
      });
    await guest
      .getByRole("button", {
        name: stake ? `Lock vote · Bet ${stake}` : "Confirm vote",
        exact: true,
      })
      .click();
    if (lostResponse) {
      await guest
        .getByRole("heading", { name: "Your vote is locked", exact: true })
        .waitFor();
      assert(dropped, "Lost-response path not exercised");
      const savedId = (await guestState()).my_id;
      await guest.close();
      guest = await context.newPage();
      watch(guest);
      await guest.goto(host.credentials.invitation);
      await guest
        .getByRole("heading", { name: "Your vote is locked", exact: true })
        .waitFor();
      const resumed = await guestState();
      assert(
        resumed.my_id === savedId && resumed.betting.my_stake === stake,
        "Rescan lost identity or bet",
      );
      await capture(guest, "reconnected-locked-bet");
    }
  };
  try {
    watch(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await page
      .getByRole("button", { name: "Host party", exact: true })
      .waitFor();
    await page.evaluate(
      (s) => sessionStorage.setItem("imposter.session.v1", JSON.stringify(s)),
      host,
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "Score night", exact: true })
      .waitFor();
    await page.getByRole("button", { name: /Session 1 · First to 15/ }).click();
    await page.getByRole("button", { name: "10 points", exact: true }).click();
    await capture(page, "target");
    await page
      .getByRole("button", { name: "Save target", exact: true })
      .click();
    for (const name of ["Sam", "Ben"])
      natives.push(
        await call("join", {
          invitation: host.credentials.invitation,
          player: name,
        }),
      );
    context = await page
      .context()
      .browser()
      .newContext({ viewport: { width: 390, height: 844 } });
    guest = await context.newPage();
    watch(guest);
    await guest.goto(host.credentials.invitation);
    await guest
      .getByRole("button", { name: "Continue in browser", exact: true })
      .click();
    await guest
      .getByRole("textbox", { name: "Your name", exact: true })
      .fill("Mia");
    await guest
      .getByRole("button", { name: "Join party", exact: true })
      .click();
    await guest
      .getByRole("button", { name: "I’m ready", exact: true })
      .waitFor();
    guestId = await guest.evaluate(
      () =>
        JSON.parse(localStorage.getItem("imposter.web.session.v1")).credentials
          .player_id,
    );
    let final;
    for (let index = 0; index < 16; index++) {
      const { gv, imposter } = await begin();
      const mine = gv.players.find((p) => p.id === guestId);
      let stake = 0;
      if (!gv.private_role.imposter) {
        civilianReads++;
        stake =
          civilianReads === 3
            ? 2
            : civilianReads >= 4
              ? Math.min(3, mine.points)
              : 0;
        assert(
          (await guest
            .getByRole("button", { name: "No bet", exact: true })
            .getAttribute("aria-pressed")) === "true",
          "Bet failed to reset",
        );
        for (let n = 1; n <= 3; n++)
          assert(
            (await guest
              .getByRole("button", {
                name: new RegExp(`^Bet ${n} point${n === 1 ? "" : "s"}`),
              })
              .isDisabled()) ===
              n > mine.points,
            "Affordability mismatch",
          );
        if (civilianReads === 3) {
          await guest
            .getByRole("button", { name: /^Bet 2 points/ })
            .click();
          await capture(guest, "bet");
          await guest.setViewportSize({ width: 320, height: 640 });
          await capture(guest, "bet-compact");
          await guest.setViewportSize({ width: 390, height: 844 });
        }
      } else {
        await guest
          .getByText("Escape to keep your points.", { exact: true })
          .waitFor();
        assert(
          (await guest
            .getByRole("group", { name: "Escape bet", exact: true })
            .count()) === 1,
          "The imposter is missing the escape bet",
        );
      }
      const target =
        imposter === guestId
          ? gv.players.find((p) => p.id !== guestId).id
          : imposter;
      await guestVote(
        target,
        stake,
        civilianReads === 3 && !gv.private_role.imposter,
      );
      const hidden = await state();
      assert(
        hidden.betting.my_stake === null &&
          hidden.players.every((p) => !("stake" in p)),
        "Guest stake leaked to host before results",
      );
      await nativeVotes(imposter);
      await waitPhase(guest, "results");
      const scored = await guestState();
      assert(scored.result.score.after >= 0, "Negative balance");
      if (civilianReads === 3 && !gv.private_role.imposter) {
        // Each role's base and bonus are covered by the Rust tests; the bet
        // must settle on top of them.
        const sc = scored.result.score;
        assert(
          sc.bet === 2 &&
            sc.after ===
              sc.before + sc.base + sc.bet + sc.bluff + (sc.bonus || 0) - sc.penalty,
          "Bet total is incorrect",
        );
        await capture(guest, "bet-result");
      }
      final = await finish();
      if (final.phase === "session_complete") break;
      await capture(page, "standings");
    }
    assert(
      civilianReads >= 4 && final.phase === "session_complete",
      "Target session did not finish",
    );
    assert(
      final.score_session.winner_ids.includes(guestId),
      "Highest score did not win",
    );
    await waitPhase(guest, "session_complete");
    await capture(page, "complete");
    await guest.reload();
    await waitPhase(guest, "session_complete");
    assert(
      (await guestState()).players.find((p) => p.id === guestId).points >= 10,
      "Final standings reset on reload",
    );
    await page
      .getByRole("button", { name: "Start next session", exact: true })
      .click();
    await waitPhase(page, "lobby");
    const fresh = await state();
    round = fresh.round_id;
    assert(
      fresh.score_session.number === 2 &&
        fresh.players.every((p) => p.points === 0),
      "Session scores did not reset",
    );
    assert(
      fresh.id === host.view.id &&
        fresh.result === null &&
        fresh.betting.my_stake === null,
      "Party identity or stale result after reset",
    );
    await waitPhase(guest, "lobby");
    assert((await guestState()).my_id === guestId, "Player identity reset incorrect");
    await capture(page, "fresh-session");
    // Earn one point, then lose a one-point bet: real server, same browser player.
    let earned = false,
      lost = false;
    for (let index = 0; index < 10 && !lost; index++) {
      const { gv, imposter } = await begin();
      const wrong = earned && !gv.private_role.imposter;
      const target = wrong
        ? gv.players.find((p) => p.id !== imposter && p.id !== guestId).id
        : imposter === guestId
          ? gv.players.find((p) => p.id !== guestId).id
          : imposter;
      await guestVote(target, wrong ? 1 : 0);
      await nativeVotes(imposter);
      await waitPhase(guest, "results");
      const r = (await guestState()).result;
      if (wrong) {
        // A Judge's read pays +2, so the balance before may be above one.
        assert(
          r.score.bet === -1 && r.score.after === Math.max(0, r.score.before - 1 - r.score.penalty),
          "Failed bet did not settle",
        );
        await capture(guest, "lost-bet");
        lost = true;
      } else if (!gv.private_role.imposter) earned = true;
      await finish();
    }
    assert(lost, "Lost bet not exercised");
    const { gv, imposter } = await begin();
    const ids = gv.players.map((p) => p.id);
    const accused = ids.find((id) => id !== imposter && id !== guestId);
    const target =
      guestId === accused
        ? ids.find((id) => id !== accused && id !== imposter)
        : accused;
    await guestVote(target, 0);
    await nativeVotes(imposter, true);
    await waitPhase(guest, "results");
    const r = (await guestState()).result;
    assert(r.imposter_bonus === 1 && r.escaped, "Perfect bluff missing");
    const observer = imposter === guestId ? guest : page;
    if (imposter !== guestId) {
      const session = natives.find((s) => s.credentials.player_id === imposter);
      await page.evaluate(
        (s) => sessionStorage.setItem("imposter.session.v1", JSON.stringify(s)),
        session,
      );
      await page.reload();
      await waitPhase(page, "results");
    }
    await capture(observer, "perfect-bluff");
    assert(errors.length === 0, errors.join("; "));
    return {
      passed: true,
      civilianReads,
      final_scores: final.players.map((p) => ({
        name: p.name,
        points: p.points,
      })),
      checks: [
        "target selection",
        "affordable/optional bets",
        "imposter escape bet",
        "private stakes",
        "lost-response recovery",
        "closed-tab QR reconnect",
        "bet on a third read",
        "zero floor",
        "session completion",
        "final scores survive reload",
        "restart preserves party and identity",
        "perfect bluff",
        "compact phone layout",
      ],
    };
  } finally {
    alive = false;
    await heartbeat;
    if (context) await context.close();
    for (const s of natives.slice(1))
      await call("close", { session_id: s.session_id }).catch(() => {});
    await call("close", { session_id: host.session_id }).catch(() => {});
    await page
      .evaluate(() => sessionStorage.removeItem("imposter.session.v1"))
      .catch(() => {});
  }
}
