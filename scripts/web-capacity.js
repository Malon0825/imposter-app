async function checkBrowserCapacity(page) {
  // Full Cast shows the role on its own screen before the card, once per round per tab.
  const passRoleStage = async (p) => {
    const see = p.getByRole("button", { name: /^See my/ });
    await see.or(p.locator(".role-heading.revealed")).first().waitFor();
    if (await see.count()) await see.click();
  };
  const base = new URL(page.url()).origin;
  const call = async (method, body = {}) => {
    const r = await page.request.post(`${base}/api/${method}`, {
      headers: { "X-Imposter-Dev": "1" },
      data: body,
    });
    const v = await r.json();
    if (!r.ok()) throw Error(v.error);
    return v;
  };
  const assert = (v, m) => {
    if (!v) throw Error(m);
  };
  const host = await call("create", {
    name: "Twelve players",
    player: "Alex",
    wifi: "Shared Wi-Fi",
  });
  let round = 0;
  const act = async (kind, value = null) => {
    const v = await call("action", {
      session_id: host.session_id,
      action: { id: crypto.randomUUID(), round_id: round, kind, value },
    });
    round = v.round_id;
    return v;
  };
  const browser = page.context().browser();
  const contexts = [],
    guests = [];
  for (let i = 0; i < 11; i++) {
    const context = await browser.newContext({
      viewport: { width: 360, height: 700 },
    });
    contexts.push(context);
    const p = await context.newPage();
    await p.goto(host.credentials.invitation);
    await p
      .getByRole("button", { name: "Continue in browser", exact: true })
      .click();
    await p
      .getByRole("textbox", { name: "Your name", exact: true })
      .fill(`Player ${i + 1}`);
    await p.getByRole("button", { name: "Join party", exact: true }).click();
    await p.getByRole("button", { name: "I’m ready", exact: true }).click();
    const saved = await p.evaluate(() =>
      JSON.parse(localStorage.getItem("imposter.web.session.v1")),
    );
    guests.push({ page: p, id: saved.credentials.player_id });
  }
  const overflow = await browser.newContext({
    viewport: { width: 360, height: 700 },
  });
  contexts.push(overflow);
  const extra = await overflow.newPage();
  await extra.goto(host.credentials.invitation);
  await extra
    .getByRole("button", { name: "Continue in browser", exact: true })
    .click();
  await extra
    .getByRole("textbox", { name: "Your name", exact: true })
    .fill("Overflow");
  await extra.getByRole("button", { name: "Join party", exact: true }).click();
  await extra.getByRole("alert").filter({ hasText: "full" }).waitFor();
  await overflow.close();
  contexts.pop();
  let state = await call("state", { session_id: host.session_id });
  assert(state.players.length === 12, "Capacity was not enforced");
  await act("start");
  await act("topic_vote", ["food"]);
  for (const g of guests) {
    await g.page.getByRole("button", { name: "Food", exact: true }).click();
    await g.page
      .getByRole("button", { name: "Lock my vote", exact: true })
      .click();
  }
  // The host deals as soon as the last topic ballot locks.
  const waitPhase = async (phase) => {
    for (let tick = 0; tick < 200; tick++) {
      const view = await call("state", { session_id: host.session_id });
      if (view.phase === phase) return view;
      await page.waitForTimeout(100);
    }
    throw Error(`The party never reached ${phase}`);
  };
  await waitPhase("roles");
  for (const g of guests) {
    await g.page
      .getByRole("button", { name: "Reveal my role", exact: true })
      .click();
    await passRoleStage(g.page);
    await g.page
      .getByRole("button", { name: "Hide & ready", exact: true })
      .click();
  }
  await act("role_ready");
  await act("open_vote");
  // Full Cast at twelve: the imposter names a crew, the Detective adds an
  // accomplice pick and cannot vote the player they cleared.
  const hostRole = (await call("state", { session_id: host.session_id })).private_role.role;
  const hostVote = { player_id: guests[0].id, stake: 0 };
  if (hostRole === "imposter") Object.assign(hostVote, { accomplice_id: guests[0].id, decoy_id: guests[1].id });
  if (hostRole === "detective") hostVote.accomplice_id = guests[1].id;
  await act("vote", hostVote);
  for (const [i, g] of guests.entries()) {
    // Wait for the ballot itself, or the crew check below can run too early.
    await g.page.locator(".ballot-row, .crew-ballot").first().waitFor();
    if (await g.page.getByRole("heading", { name: "Find your crew", exact: true }).count()) {
      await g.page.getByRole("group", { name: "Your accomplice?" }).locator("button:not([disabled])").first().click();
      await g.page.getByRole("group", { name: "The decoy?" }).locator("button:not([disabled])").first().click();
    } else {
      const alex = g.page.locator(".ballot-row").filter({ hasText: "Alex" });
      await (await alex.isDisabled() ? g.page.locator(".ballot-row:not([disabled])").first() : alex).click();
      const sidePick = g.page.getByRole("group", { name: "Who’s the accomplice?" });
      if (await sidePick.count()) await sidePick.locator("button:not([disabled])").last().click();
    }
    await g.page
      .getByRole("button", { name: "Confirm vote", exact: true })
      .click();
    if (i === 9) {
      await g.page
        .getByRole("heading", { name: "Your vote is locked", exact: true })
        .waitFor();
      assert(
        (await g.page.locator(".progress-dots > i").count()) === 12,
        "Progress did not include every player",
      );
      const metrics = await g.page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        dots: document.querySelector(".progress-dots").getBoundingClientRect()
          .right,
        width: innerWidth,
      }));
      assert(
        !metrics.overflow && metrics.dots <= metrics.width,
        "12-player progress overflowed the phone",
      );
      await g.page.screenshot({
        path: "output/playwright/web-twelve-vote-progress.png",
      });
    }
  }
  state = await call("state", { session_id: host.session_id });
  state = await waitPhase("results");
  assert(state.phase === "results", "Full party did not resolve all ballots");
  assert(
    state.result.accused_id === host.credentials.player_id,
    "Most-vote result was incorrect",
  );
  await act("end");
  for (const context of contexts) await context.close();
  await call("close", { session_id: host.session_id });
  return {
    passed: true,
    players: 12,
    rejectedThirteenth: true,
    checks: [
      "11 independent browser identities",
      "12 ready acknowledgements",
      "12 secret ballots",
      "most-vote resolution",
      "compact progress layout",
    ],
  };
}
