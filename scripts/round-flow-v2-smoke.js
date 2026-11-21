async function roundFlowSmoke(hostPage) {
  const origin = new URL(hostPage.url()).origin;
  const browser = hostPage.context().browser();
  const contexts = [];
  const call = async (method, body) => {
    const response = await hostPage.request.post(`${origin}/api/${method}`, {
      headers: { "X-Imposter-Dev": "1" }, data: body,
    });
    const data = await response.json();
    if (!response.ok()) throw Error(data.error);
    return data;
  };
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const button = (page, name) => page.getByRole("button", { name, exact: true });
  const heading = (page, name) => page.getByRole("heading", { name, exact: true });
  const host = await call("create", { name: "Round flow", player: "Alex", wifi: "Playtest Wi-Fi" });
  const state = () => call("state", { session_id: host.session_id });
  // Server-side wait: the host owns the timed stages and clients trail a poll.
  const waitPhase = async (phase) => {
    for (let tick = 0; tick < 150; tick++) {
      const view = await state();
      if (view.phase === phase) return view;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw Error(`The party never reached ${phase}`);
  };
  const adopt = async (page, session) => {
    await page.goto(origin);
    await button(page, "Host party").waitFor();
    await page.evaluate((data) => sessionStorage.setItem("imposter.session.v1", JSON.stringify(data)), session);
    await page.reload();
    await heading(page, "Round flow").waitFor();
  };
  const capture = async (page, name) => {
    // Let the entrance animation paint; a reveal beat captured at once is blank.
    await page.waitForTimeout(550);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} overflowed`);
    await page.screenshot({ path: `output/playwright/round-flow-v2-${name}.png`, fullPage: true });
  };
  const guests = [];
  try {
    await hostPage.setViewportSize({ width: 390, height: 844 });
    await adopt(hostPage, host);
    const native = await call("join", { invitation: host.credentials.native_invitation, player: "Ben" });
    const nativeContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    contexts.push(nativeContext);
    const nativePage = await nativeContext.newPage();
    await adopt(nativePage, native);
    guests.push({ page: nativePage, id: native.credentials.player_id, name: "Ben" });
    for (const [name, width] of [["Mia Alexandra Fitzgerald-Rey", 360], ["Sam", 390]]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: name === "Mia" ? "reduce" : "no-preference" });
      contexts.push(context);
      const page = await context.newPage();
      await page.goto(host.credentials.invitation);
      await button(page, "Continue in browser").click();
      await page.getByRole("textbox", { name: "Your name", exact: true }).fill(name);
      await button(page, "Join party").click();
      await button(page, "I’m ready").waitFor();
      const id = await page.evaluate(() => JSON.parse(localStorage.getItem("imposter.web.session.v1")).credentials.player_id);
      guests.push({ page, id, name });
    }
    const players = [{ page: hostPage, id: host.credentials.player_id, name: "Alex" }, ...guests];
    await Promise.all(guests.map(({ page }) => button(page, "I’m ready").click()));
    await capture(hostPage, "lobby");
    await button(hostPage, "Start round").click();

    const chooseTopics = async (makeTie) => {
      const lobby = await state();
      const available = lobby.topic_vote.available_topics;
      const topicNames = available.map((id) => lobby.catalog.find((entry) => entry.id === id).name);
      await Promise.all(players.map(async ({ page }, index) => {
        await button(page, topicNames[makeTie ? index % 2 : 0]).click();
        await button(page, "Lock my vote").click();
      }));
      await Promise.all(players.map(({ page }) => button(page, "Reveal my role").waitFor()));
      if (makeTie) await hostPage.getByText("Picked from a tie", { exact: true }).waitFor();
      await capture(hostPage, "concealed");
    };
    await chooseTopics(true);
    await hostPage.getByRole("button", { name: "Session settings", exact: true }).click();
    await button(hostPage, "Skip round").click();
    await heading(hostPage, "Skip this round?").waitFor();
    await capture(hostPage, "skip");
    await button(hostPage, "Cancel").click();
    assert((await state()).phase === "roles", "Cancel skipped the round");
    await hostPage.getByRole("button", { name: "Session settings", exact: true }).click();
    await button(hostPage, "Skip round").click();
    await button(hostPage, "Skip and start").click();
    await heading(hostPage, "Classic").waitFor();
    await capture(hostPage, "fixed-classic-reveal");
    await heading(hostPage, "What should we play?").waitFor();
    await chooseTopics(false);

    let imposter;
    for (const player of players) {
      await button(player.page, "Reveal my role").click();
      const privateTitle = await player.page.locator(".role-title").innerText();
      if (privateTitle === "You are the imposter") imposter = player;
      await button(player.page, "Hide & ready").click();
    }
    assert(imposter, "No imposter role was shown");
    await button(hostPage, "Open voting").click();
    const civilians = players.filter((player) => player !== imposter);
    await imposter.page.getByText("Your vote is a dummy vote. It won’t count toward the tally.").waitFor();
    assert(await imposter.page.getByRole("button", { name: "Bet 1 point", exact: true }).isDisabled(), "Zero-balance escape bet was enabled");
    await capture(imposter.page, "imposter-ballot");
    const pick = async (player, target) => {
      await player.page.locator(".ballot-row").filter({ hasText: target.name }).click();
      await button(player.page, "Confirm vote").click();
    };
    // Count three distinct civilian targets. The dummy would break the tie if counted.
    const firstBallots = [[imposter, civilians[1]], [civilians[0], imposter], [civilians[1], civilians[2]]];
    for (const [index, [player, target]] of firstBallots.entries()) {
      await pick(player, target);
      await heading(player.page, "Your vote is locked").waitFor();
      const progress = await state();
      assert(progress.vote_count === index + 1, `Expected ${index + 1} locks, got ${progress.vote_count}`);
    }
    await Promise.all([
      hostPage.locator(".result-suspense, .verdict-stage, .recap-verdict").first().waitFor({ timeout: 6500 }),
      pick(civilians[2], civilians[1]),
    ]).catch(async (error) => {
      const view = await state();
      throw Error(`Reveal did not start · ${view.phase} · ${view.vote_count} votes · ${error.message}`);
    });
    await hostPage.getByText("No one was accused.", { exact: true }).first().waitFor();
    await capture(hostPage, "tie-verdict");
    await button(hostPage, "Continue").waitFor();
    const result = (await state()).result;
    assert(result.escaped && !result.accused_id, "Dummy vote broke the civilian tie");
    await heading(civilians[0].page, "You got it").waitFor();
    await heading(imposter.page, "You escaped").waitFor();
    await capture(imposter.page, "escape-recap");
    await button(hostPage, "Report a rule violation").click();
    await hostPage.getByRole("checkbox", { name: guests[0].name }).click();
    await capture(hostPage, "report");
    await button(hostPage, "Submit report").click();
    await hostPage.getByText("Report submitted.", { exact: true }).waitFor();
    await button(hostPage, "Continue").click();
    for (let step = 0; step < players.length; step++) {
      const view = await state();
      if (view.phase !== "punishment") break;
      const recipient = players.find((player) => player.id === view.punishment.player_id);
      await button(recipient.page, "Skip").click();
      await button(recipient.page, "Skip").waitFor({ state: "hidden" });
    }
    await button(hostPage, "Next round").waitFor();
    await capture(hostPage, "rankings");
    await hostPage.getByRole("switch", { name: "Random rules" }).click();
    await button(hostPage, "Next round").click();
    await hostPage.locator(".screen-rule_reveal").waitFor();
    await heading(hostPage, "What should we play?").waitFor();
    const repeated = await state();
    assert(repeated.phase === "topic_voting" && repeated.round_id >= 3, "The repeat round returned to the lobby");
    const ruleLabels = {
      classic: "Classic", act_it: "Act It", sound_only: "Sound Only",
      two_truths: "Two Truths and a Lie", if_it_could_talk: "If It Could Talk", sell_it: "Sell It",
    };
    const spokenPacks = {
      two_truths: ["food", "animals"],
      if_it_could_talk: ["everyday", "chaos"],
      sell_it: ["technology", "travel"],
    };
    // The reveal lasts a fixed 4.25s, so a client one poll behind can miss it
    // entirely. Never block on the beat: retry the rule until a poll lands in it.
    const total = Object.keys(ruleLabels).length;
    const seen = new Set();
    const revealed = new Set();
    const ballotHeading = heading(hostPage, "What should we play?");
    for (let attempt = 0; attempt < 360 && (seen.size < total || revealed.size < total); attempt++) {
      const view = await state();
      const rule = view.round_rule;
      if (view.phase === "rule_reveal" && !revealed.has(rule)) {
        const ruleHeading = heading(hostPage, ruleLabels[rule]);
        await ruleHeading.or(ballotHeading).first().waitFor();
        if (await ruleHeading.isVisible()) {
          await capture(hostPage, `rule-${rule}`);
          revealed.add(rule);
        }
      }
      await ballotHeading.waitFor();
      if (!seen.has(rule)) {
        const pool = (await waitPhase("topic_voting")).topic_vote.available_topics;
        assert(pool.length > 0, `The ${rule} topic ballot was empty`);
        if (spokenPacks[rule]) assert(pool.every((id) => spokenPacks[rule].includes(id)), `Unreviewed packs appeared for ${rule}`);
        seen.add(rule);
      }
      if (seen.size < total || revealed.size < total) {
        await call("action", {
          session_id: host.session_id,
          action: { id: crypto.randomUUID(), round_id: (await state()).round_id, kind: "skip_round", value: true },
        });
      }
    }
    assert(seen.size === total, `Expected six filtered ballots, saw ${[...seen].join(", ")}`);
    assert(revealed.size === total, `Expected six rule reveals, saw ${[...revealed].join(", ")}`);
    return { passed: true, rules: [...seen], checks: ["mixed native and browser guests", "automatic tie draw", "durable automatic deal", "cancel and confirm skip", "fixed Classic reveal", "private dummy ballot", "civilian tie escape", "personal scoring", "report sheet", "direct randomized repeat", "six filtered rule ballots", "six rule reveal cards"] };
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await call("close", { session_id: host.session_id }).catch(() => {});
  }
}
