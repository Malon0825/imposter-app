async function roundRulesSmoke(page) {
  const base = new URL(page.url()).origin;
  const contexts = [];
  const errors = [];
  const assert = (condition, message) => {
    if (!condition) throw Error(message);
  };
  const button = (p, name) => p.getByRole("button", { name, exact: true });
  async function call(method, data) {
    const response = await page.request.post(`${base}/api/${method}`, {
      headers: { "X-Imposter-Dev": "1" },
      data,
    });
    const result = await response.json();
    if (!response.ok()) throw Error(result.error);
    return result;
  }
  const act = (session, round, kind, value = null) =>
    call("action", {
      session_id: session.session_id,
      action: { id: crypto.randomUUID(), round_id: round, kind, value },
    });
  const snapshot = (session) =>
    call("state", { session_id: session.session_id });
  async function capture(name, target = page) {
    await target.evaluate(() => document.fonts.ready);
    await target.evaluate(() =>
      Promise.all(
        [...document.images].map((image) => image.decode().catch(() => {})),
      ),
    );
    await target.waitForTimeout(500);
    const width = await target
      .locator(".app-shell")
      .evaluate((el) => el.scrollWidth);
    assert(
      width <= target.viewportSize().width + 1,
      `Horizontal overflow: ${name}`,
    );
    await target.screenshot({
      path: `output/playwright/round-rules-${name}.png`,
      fullPage: true,
    });
  }
  const host = await call("create", {
    name: "Friday night",
    player: "Alex",
    wifi: "Home Wi-Fi",
  });
  const native = [];
  let keepAlive = true;
  const heartbeat = (async () => {
    while (keepAlive) {
      await page.waitForTimeout(1200);
      if (keepAlive)
        await Promise.all(native.map((s) => snapshot(s).catch(() => {})));
    }
  })();
  page.on("pageerror", (error) => errors.push(error.message));
  let stage = "host lobby";
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await button(page, "Host party").waitFor();
    await page.evaluate(
      (s) => sessionStorage.setItem("imposter.session.v1", JSON.stringify(s)),
      host,
    );
    await page.reload();
    await page.getByRole("heading", { name: "Friday night" }).waitFor();
    stage = "browser guest join";
    for (const player of ["Sam", "Ben"]) {
      native.push(
        await call("join", { invitation: host.credentials.invitation, player }),
      );
    }
    const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width: 360, height: 700 } });
    contexts.push(context);
    const guest = await context.newPage();
    guest.on("pageerror", (error) => errors.push(error.message));
    await guest.goto(host.credentials.invitation);
    await button(guest, "Continue in browser").click();
    await guest.getByRole("textbox", { name: "Your name" }).fill("Mia");
    await button(guest, "Join party").click();
    await guest.getByRole("heading", { name: "Friday night" }).waitFor();
    stage = "enable random rules";
    await button(page, "Session settings").click();
    await page.getByRole("switch", { name: "Random round rules" }).click();
    await page
      .getByRole("switch", { name: "Random round rules", checked: true })
      .waitFor();
    await capture("02-settings-on");
    await button(page, "Done").click();

    const RULE_NAMES = {
    classic: "Classic",
    act_it: "Act It",
    sound_only: "Sound Only",
  };
  const variants = {
      classic: "05-classic",
      act_it: "04-act-it",
      sound_only: "03-sound-only",
    };
    stage = "reveal the nonverbal and classic rules";
    const observed = new Set();
    let round = 0;
    for (const session of native)
      await act(session, (await snapshot(host)).round_id, "ready", true);
    await button(guest, "I’m ready").click();
    await capture("01-lobby");
    await act(host, 0, "start");
    for (let attempt = 0; attempt < 240; attempt++) {
      const state = await snapshot(host);
      round = state.round_id;
      if (state.phase === "rule_reveal") {
        assert(
          !state.topic_vote && !state.private_role,
          "Rule reveal leaked a ballot or role",
        );
        const rule = state.round_rule;
        if (variants[rule] && !observed.has(rule)) {
          const landed = page.getByRole("heading", {
            name: RULE_NAMES[rule],
            exact: true,
          });
          await landed.or(page.getByRole("heading", { name: "What should we play?" })).first().waitFor();
          if (await landed.isVisible()) {
            observed.add(rule);
            await capture(variants[rule]);
          }
        }
      }
      if (observed.size === 3 && (await snapshot(host)).round_rule === "sound_only") break;
      await act(host, (await snapshot(host)).round_id, "skip_round", true);
    }
    assert(observed.size === 3, `Did not capture all rule variants: ${[...observed]}`);
    assert(
      (await snapshot(host)).round_rule === "sound_only",
      "The round did not settle on Sound Only",
    );
    await page.getByRole("heading", { name: "What should we play?" }).waitFor();
    round = (await snapshot(host)).round_id;
    await guest.reload();
    stage = "resume browser guest and vote on topics";
    // The rule stays pinned above the ballot after the reveal.
    await guest
      .locator(".round-rule-indicator")
      .filter({ hasText: "Sound Only" })
      .waitFor();
    await button(page, "Animals").click();
    await button(page, "Music").click();
    assert(
      (await button(page, "Food").count()) === 0,
      "Sound Only offered an incompatible topic",
    );
    await button(guest, "Animals").click();
    await button(guest, "Lock my vote").click();
    for (const session of native)
      await act(session, round, "topic_vote", ["animals"]);
    await capture("06-sound-topic-vote");
    await capture("06-compact-guest", guest);
    await button(page, "Lock my vote").click();
    stage = "private cards and performed clues";
    await button(page, "Reveal my role").waitFor();
    const players = [host, ...native];
    const cards = await Promise.all(players.map(snapshot));
    for (const session of players) await act(session, round, "role_ready");
    await button(guest, "Reveal my role").click();
    const guestImposter =
      (await guest
        .getByRole("heading", { name: "You are the imposter", exact: true })
        .count()) > 0;
    await button(guest, "Hide & ready").click();
    await button(guest, "Mark my turn performed").click();
    await act(native[0], round, "performed", { turn: 1, performed: true });
    await page
      .locator(".clue-entry")
      .filter({ hasText: "Turn 1: Performed" })
      .first()
      .waitFor();
    assert(
      (await page
        .getByRole("button", { name: "Add clue for turn 1" })
        .count()) === 0,
      "Nonverbal mode offered text entry",
    );
    await capture("08-sound-clue-turn");
    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await capture("08-320-reduced-motion");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await button(page, "Pause round").click();
    stage = "change settings while paused";
    await page.getByRole("heading", { name: "A little pause." }).waitFor();
    await button(page, "Session settings").click();
    await page.getByRole("switch").click();
    await page.getByText("Random rules are off from next round.").waitFor();
    assert((await snapshot(host)).paused, "Settings unpaused the round");
    await button(page, "Done").click();
    await act(host, round, "resume");
    await page
      .getByRole("heading", { name: "Who sounds suspicious?" })
      .waitFor();
    await button(page, "Session settings").click();
    await page.getByText("Random rules are off from next round.").waitFor();
    await capture("09-off-next-round");
    await button(page, "Done").click();
    stage = "complete the suspicion vote";
    await button(page, "Another clue turn").click();
    await button(page, "Open voting").click();
    const votingView = await snapshot(host);
    const guestId = votingView.players.find((p) => p.name === "Mia").id;
    const imposter = guestImposter
      ? guestId
      : cards.find((v) => v.private_role.imposter)?.my_id;
    assert(imposter, "No imposter found");
    for (const session of players) {
      const myId = session.credentials.player_id;
      await act(session, round, "vote", myId === imposter ? guestId : imposter);
    }
    const guestTarget = votingView.players.find(
      (p) => p.id === (guestImposter ? host.credentials.player_id : imposter),
    );
    await guest
      .locator(".ballot-row")
      .filter({ hasText: guestTarget.name })
      .click();
    await button(guest, "Confirm vote").click();
    let finished = null;
    for (let tick = 0; tick < 150 && !finished; tick++) {
      const view = await snapshot(host);
      if (view.phase === "results") finished = view;
      else await page.waitForTimeout(100);
    }
    assert(finished, "Accusations did not result in a completed round");
    assert(errors.length === 0, errors.join("\n"));
    return {
      observed: [...observed],
      mixedClients: 4,
      screenshots: "output/playwright/round-rules-*.png",
    };
  } catch (error) {
    const browser = contexts[0]?.pages()[0];
    const messages = await Promise.all(
      [page, ...(browser ? [browser] : [])].map((p) =>
        p
          .locator("body")
          .innerText()
          .catch(() => ""),
      ),
    );
    throw Error(`${stage}: ${error.message}\n${messages.join("\n---\n")}`);
  } finally {
    keepAlive = false;
    const state = await snapshot(host).catch(() => null);
    if (state) await act(host, state.round_id, "end").catch(() => {});
    await call("close", { session_id: host.session_id }).catch(() => {});
    for (const context of contexts) await context.close();
    for (const session of native)
      await call("close", { session_id: session.session_id }).catch(() => {});
    await heartbeat;
  }
}
