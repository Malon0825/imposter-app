async function smokeInstalledHost(page) {
  const test = "http://127.0.0.1:39145/__test/";
  const call = async (route, body = {}) => {
    const r = await page.request.post(test + route, { data: body });
    const v = await r.json();
    if (!r.ok()) throw Error(v.error);
    return v;
  };
  const info = await call("info");
  const assert = (v, m) => {
    if (!v) throw Error(m);
  };
  const guests = [];
  const browser = page.context().browser();
  const origin = new URL(info.invitation).origin;
  const external = [];
  for (const [i, name] of ["Mia", "Ben"].entries()) {
    const context = await browser.newContext({
      proxy: { server: info.proxy },
      viewport: { width: i ? 360 : 393, height: i ? 740 : 852 },
      userAgent: i
        ? "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/142.0.0.0 Mobile Safari/537.36"
        : "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1",
    });
    const p = await context.newPage();
    p.on("request", (r) => {
      if (!r.url().startsWith(origin)) external.push(r.url());
    });
    await p.goto(info.invitation);
    await p
      .getByRole("button", { name: "Continue in browser", exact: true })
      .waitFor();
    assert(
      !(await p.evaluate(() => window.isSecureContext)),
      "This check must use an actual private-IP HTTP origin",
    );
    assert(
      (await p.evaluate(() => typeof crypto.randomUUID)) === "undefined",
      "Expected local HTTP restrictions",
    );
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(500);
    await p.screenshot({
      path: `output/playwright/web-native-${name.toLowerCase()}-join.png`,
    });
    await p
      .getByRole("button", { name: "Continue in browser", exact: true })
      .click();
    await p.getByRole("textbox", { name: "Your name", exact: true }).fill(name);
    await p.getByRole("button", { name: "Join party", exact: true }).click();
    await p
      .getByRole("heading", { name: "Offline friends", exact: true })
      .waitFor();
    await p.getByRole("button", { name: "I’m ready", exact: true }).click();
    const s = await p.evaluate(() =>
      JSON.parse(localStorage.getItem("imposter.web.session.v1")),
    );
    guests.push({ page: p, context, id: s.credentials.player_id });
  }
  const started = await call("host-action", { kind: "start" });
  const native = await call("native-state");
  let imposter = started.private_role.imposter
    ? info.host
    : native.private_role.imposter
      ? info.native
      : null;
  await call("host-action", { kind: "role_ready" });
  await call("native-action", { kind: "role_ready" });
  for (const g of guests) {
    await g.page
      .getByRole("button", { name: "Reveal my role", exact: true })
      .click();
    await g.page.waitForTimeout(500);
    if (
      await g.page
        .getByRole("heading", { name: "You are the imposter", exact: true })
        .count()
    )
      imposter = g.id;
    await g.page.screenshot({
      path: `output/playwright/web-native-${g.id === guests[0].id ? "mia" : "ben"}-role.png`,
    });
    await g.page
      .getByRole("button", { name: "Hide & ready", exact: true })
      .click();
  }
  assert(imposter, "No imposter identified");
  const voting = await call("host-action", { kind: "open_vote" });
  for (const who of ["host", "native"]) {
    const id = who === "host" ? info.host : info.native;
    await call(who + "-action", {
      kind: "vote",
      value: id === imposter ? guests[0].id : imposter,
    });
  }
  for (const g of guests) {
    const target = g.id === imposter ? info.host : imposter;
    const name = voting.players.find((p) => p.id === target).name;
    await g.page.locator(".ballot-row").filter({ hasText: name }).click();
    await g.page
      .getByRole("button", { name: "Confirm vote", exact: true })
      .click();
  }
  const result = await call("host-state");
  assert(
    result.phase === "results" && !result.result.escaped,
    "Installed Android authority resolved incorrectly",
  );
  for (const p of result.players)
    assert(
      p.points === (p.id === imposter ? 0 : 1),
      "Installed host score mismatch",
    );
  const punishment = await call("host-action", { kind: "punish" });
  const loser = punishment.punishment.player_id;
  if (loser === info.host || loser === info.native) {
    const who = loser === info.host ? "host" : "native";
    await call(who + "-action", { kind: "choice", value: "dare" });
    await call(who + "-action", { kind: "done" });
  } else {
    const g = guests.find((g) => g.id === loser);
    await g.page.getByRole("button", { name: "Dare", exact: true }).click();
    await g.page.getByRole("button", { name: "Done", exact: true }).click();
  }
  for (const g of guests)
    await g.page
      .getByRole("heading", { name: "The standings", exact: true })
      .waitFor();
  await call("host-action", { kind: "end" });
  for (const g of guests) {
    await g.page
      .getByRole("heading", { name: "That’s a wrap.", exact: true })
      .waitFor();
    await g.page.waitForTimeout(1500);
    await g.page.screenshot({
      path: `output/playwright/web-native-${g === guests[0] ? "mia" : "ben"}-final.png`,
    });
    await g.context.close();
  }
  assert(!external.length, "Browser requested an external website");
  return {
    passed: true,
    host: "Installed Android API 36 APK",
    players: 4,
    guestOrigin: "Private-IP HTTP through an ADB-only test proxy",
    checks: [
      "APK serves its bundled website",
      "no secure-context APIs required",
      "native pinned-TLS peer",
      "two browser players",
      "one Rust authority",
      "private roles",
      "secret voting",
      "individual scores",
      "human dare",
      "final rankings",
      "no internet asset dependencies",
    ],
  };
}
