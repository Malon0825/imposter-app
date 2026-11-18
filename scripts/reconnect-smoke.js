async function checkReconnect(page) {
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
    name: "Reconnect party",
    player: "Alex",
    wifi: "Shared Wi-Fi",
  });
  const invitation = host.credentials.invitation;
  const native = await call("join", { invitation, player: "Sam" });
  const contexts = [];
  let round = 0,
    keepAlive = true,
    nativeOnline = true;
  const act = async (session, kind, value = null) => {
    const view = await call("action", {
      session_id: session.session_id,
      action: { id: crypto.randomUUID(), round_id: round, kind, value },
    });
    round = view.round_id;
    return view;
  };
  const heartbeat = (async () => {
    while (keepAlive) {
      await page.waitForTimeout(1000);
      if (keepAlive && nativeOnline)
        await call("state", { session_id: native.session_id }).catch(() => {});
    }
  })();
  const failures = [];
  const watch = (p) => p.on("pageerror", (e) => failures.push(e.message));
  try {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(base);
    await page.evaluate(
      (s) => sessionStorage.setItem("imposter.session.v1", JSON.stringify(s)),
      host,
    );
    await page.reload();
    await page
      .getByRole("heading", { name: "Reconnect party", exact: true })
      .waitFor();
    const browser = page.context().browser();
    const context = await browser.newContext({
      viewport: { width: 360, height: 740 },
    });
    contexts.push(context);
    let guest = await context.newPage();
    watch(guest);
    await guest.goto(invitation);
    await guest
      .getByRole("button", { name: "Continue in browser", exact: true })
      .click();
    await guest
      .getByRole("textbox", { name: "Your name", exact: true })
      .fill("Mia");
    await guest
      .getByRole("button", { name: "Join party", exact: true })
      .click();
    await guest.getByRole("button", { name: "I’m ready", exact: true }).click();
    const original = await guest.evaluate(() =>
      JSON.parse(localStorage.getItem("imposter.web.session.v1")),
    );
    const observerContext = await browser.newContext({
      viewport: { width: 393, height: 852 },
    });
    contexts.push(observerContext);
    const observer = await observerContext.newPage();
    watch(observer);
    await observer.goto(invitation);
    await observer
      .getByRole("button", { name: "Continue in browser", exact: true })
      .click();
    await observer
      .getByRole("textbox", { name: "Your name", exact: true })
      .fill("Ben");
    await observer
      .getByRole("button", { name: "Join party", exact: true })
      .click();
    await observer
      .getByRole("button", { name: "I’m ready", exact: true })
      .click();
    await act(native, "ready", true);
    await act(host, "start");
    await act(host, "topic_vote", ["food"]);
    await act(native, "topic_vote", ["food"]);
    for (const p of [guest, observer]) {
      await p.getByRole("button", { name: "Food", exact: true }).click();
      await p.getByRole("button", { name: "Lock my vote", exact: true }).click();
    }
    await act(host, "begin_round");
    await guest
      .getByRole("button", { name: "Reveal my role", exact: true })
      .waitFor();
    await page
      .locator(".role-flip")
      .evaluate((el) => el.setAttribute("data-connection-check", "role"));
    nativeOnline = false;
    await guest.close();
    await page
      .locator(".player-connection-notice")
      .filter({ hasText: "Mia" })
      .waitFor({ timeout: 20000 });
    await observer
      .locator(".player-connection-notice")
      .filter({ hasText: "Mia" })
      .waitFor();
    await page
      .locator(".player-connection-notice li")
      .filter({ hasText: "Sam" })
      .waitFor({ timeout: 20000 });
    assert(
      (await page.locator(".player-connection-notice li").count()) === 2,
      "Multiple disconnected players were not named separately",
    );
    nativeOnline = true;
    await call("state", { session_id: native.session_id });
    assert(
      (await page
        .locator('.role-flip[data-connection-check="role"]')
        .count()) === 1,
      "Another player's disconnect remounted the host role screen",
    );
    assert(
      (await page
        .getByRole("heading", { name: "A little pause.", exact: true })
        .count()) === 0,
      "Connected host was sent to the pause page",
    );
    await observer
      .getByRole("button", { name: "Reveal my role", exact: true })
      .click();
    await observer
      .getByRole("button", { name: "Hide my role", exact: true })
      .click();
    assert(
      await observer
        .locator(".role-back")
        .evaluate((el) => el.childElementCount === 0),
      "Role could not be hidden while another player was offline",
    );
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "output/playwright/disconnected-role-mobile.png",
    });
    await page
      .getByRole("button", { name: "Show invitation QR code", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "output/playwright/reconnect-paused-qr.png",
    });
    await page
      .getByRole("button", { name: "Close invitation", exact: true })
      .click();
    guest = await context.newPage();
    watch(guest);
    await guest.goto(invitation); // Rescan in the same browser after completely closing the tab.
    await guest
      .getByRole("button", { name: "Reveal my role", exact: true })
      .waitFor();
    const restored = await guest.evaluate(() =>
      JSON.parse(localStorage.getItem("imposter.web.session.v1")),
    );
    assert(
      restored.credentials.player_id === original.credentials.player_id,
      "QR rescan duplicated the player",
    );
    assert(
      await guest
        .locator(".role-back")
        .evaluate(
          (el) =>
            el.getAttribute("aria-hidden") === "true" &&
            el.childElementCount === 0,
        ),
      "Reconnect exposed the private card",
    );
    await guest
      .getByRole("button", { name: "Reveal my role", exact: true })
      .click();
    await guest
      .getByRole("button", { name: "Hide & ready", exact: true })
      .click();
    await observer
      .getByRole("button", { name: "Reveal my role", exact: true })
      .click();
    await observer
      .getByRole("button", { name: "Hide & ready", exact: true })
      .click();
    await act(native, "role_ready");
    await act(host, "role_ready");
    await observer
      .getByRole("heading", { name: "Who sounds suspicious?", exact: true })
      .waitFor();
    await observer.route("**/guest/state", (route) => route.abort());
    await observer
      .getByRole("heading", { name: "Hold that thought.", exact: true })
      .waitFor();
    assert(
      (await page
        .getByRole("heading", { name: "Who sounds suspicious?", exact: true })
        .count()) === 1,
      "One player's connection loss interrupted the connected host",
    );
    await observer.unroute("**/guest/state");
    await observer
      .getByRole("heading", { name: "Who sounds suspicious?", exact: true })
      .waitFor();
    await act(host, "pause");
    await page
      .getByRole("heading", { name: "A little pause.", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Resume round", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Who sounds suspicious?", exact: true })
      .waitFor();
    await guest.close();
    await page
      .locator(".player-connection-notice")
      .filter({ hasText: "Mia" })
      .waitFor({ timeout: 20000 });
    await observer
      .locator(".player-row")
      .filter({ hasText: "Mia" })
      .locator(".player-connection-label")
      .waitFor();
    assert(
      await page
        .getByRole("button", { name: "Open voting", exact: true })
        .isDisabled(),
      "Voting could advance while a player was disconnected",
    );
    await observer.waitForTimeout(500);
    await observer.screenshot({
      path: "output/playwright/disconnected-discussion-mobile.png",
    });
    guest = await context.newPage();
    watch(guest);
    await guest.goto(invitation);
    await guest
      .getByRole("heading", { name: "Who sounds suspicious?", exact: true })
      .waitFor();
    await act(host, "open_vote");
    await observer.locator(".ballot-row").filter({ hasText: "Sam" }).click();
    await observer
      .getByRole("button", { name: "Confirm vote", exact: true })
      .click();
    await observer
      .getByRole("heading", { name: "Your vote is locked", exact: true })
      .waitFor();
    await page.locator(".ballot-row").filter({ hasText: "Sam" }).click();
    await page
      .locator(".ballot-list")
      .evaluate((el) => el.setAttribute("data-connection-check", "ballot"));
    await guest.locator(".ballot-row").filter({ hasText: "Sam" }).click();
    await guest
      .getByRole("button", { name: "Confirm vote", exact: true })
      .click();
    await guest
      .getByRole("heading", { name: "Your vote is locked", exact: true })
      .waitFor();
    await guest.close();
    await page
      .locator(".player-connection-notice")
      .filter({ hasText: "Mia" })
      .waitFor({ timeout: 20000 });
    await observer
      .locator(".player-connection-notice")
      .filter({ hasText: "Mia" })
      .waitFor();
    assert(
      (await page
        .locator('.ballot-list[data-connection-check="ballot"]')
        .count()) === 1,
      "Disconnect remounted the ballot",
    );
    assert(
      (await page
        .locator(".ballot-row")
        .filter({ hasText: "Sam" })
        .getAttribute("aria-pressed")) === "true",
      "Disconnect cleared the selected vote",
    );
    assert(
      await page
        .getByRole("button", { name: "Confirm vote", exact: true })
        .isDisabled(),
      "A paused ballot was still submittable",
    );
    assert(
      (await observer
        .getByRole("heading", { name: "Your vote is locked", exact: true })
        .count()) === 1,
      "Disconnect replaced the connected player's locked-vote screen",
    );
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "output/playwright/disconnected-vote-mobile.png",
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: "output/playwright/disconnected-vote-desktop.png",
    });
    await page.setViewportSize({ width: 393, height: 852 });
    const fresh = await browser.newContext({
      viewport: { width: 360, height: 740 },
    });
    contexts.push(fresh);
    const returning = await fresh.newPage();
    watch(returning);
    await returning.goto(invitation); // A different browser/storage context has no saved credentials.
    await returning
      .getByRole("button", { name: "Reconnect my player", exact: true })
      .click();
    await returning
      .getByRole("textbox", { name: "Your name", exact: true })
      .fill("Mia");
    await returning
      .getByRole("button", { name: "Request reconnect", exact: true })
      .click();
    await returning
      .getByRole("heading", { name: "Check with your host.", exact: true })
      .waitFor();
    const code = await returning.locator(".recovery-code").innerText();
    await page
      .getByRole("button", { name: "Approve reconnect", exact: true })
      .waitFor();
    await page.waitForTimeout(500);
    assert(
      (await page.locator(".recovery-code").innerText()) === code,
      "Host and guest codes disagree",
    );
    assert(
      await returning.evaluate(
        () => !localStorage.getItem("imposter.web.session.v1"),
      ),
      "Recovery released credentials before approval",
    );
    await returning.screenshot({
      path: "output/playwright/reconnect-waiting-mobile.png",
    });
    await page.screenshot({
      path: "output/playwright/reconnect-host-approval-mobile.png",
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "output/playwright/reconnect-host-approval-desktop.png",
    });
    await returning.reload(); // Recover the same pending request after another accidental close/reload.
    await returning
      .getByRole("button", { name: "Reconnect my player", exact: true })
      .click();
    await returning
      .getByRole("textbox", { name: "Your name", exact: true })
      .fill("Mia");
    await returning
      .getByRole("button", { name: "Request reconnect", exact: true })
      .click();
    await returning
      .getByRole("heading", { name: "Check with your host.", exact: true })
      .waitFor();
    assert(
      (await returning.locator(".recovery-code").innerText()) === code,
      "Reload duplicated the pending request",
    );
    let lostApproval = false;
    await returning.route("**/guest/recover", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      if (!lostApproval && data.status === "approved") {
        lostApproval = true;
        return route.abort();
      }
      await route.fulfill({ response });
    });
    await page
      .getByRole("button", { name: "Approve reconnect", exact: true })
      .click();
    await returning
      .getByRole("heading", { name: "Your vote is locked", exact: true })
      .waitFor({ timeout: 15000 });
    assert(lostApproval, "Lost approval response was not exercised");
    const recovered = await returning.evaluate(() =>
      JSON.parse(localStorage.getItem("imposter.web.session.v1")),
    );
    assert(
      recovered.credentials.player_id === original.credentials.player_id,
      "Host recovery changed the player ID",
    );
    assert(
      recovered.credentials.token !== original.credentials.token,
      "Host recovery did not revoke old credentials",
    );
    const state = await call("state", { session_id: host.session_id });
    assert(
      state.players.length === 4 && !state.paused && state.vote_count === 2,
      "Recovery changed the roster or locked vote",
    );
    await page
      .locator(".player-connection-notice")
      .waitFor({ state: "hidden" });
    assert(
      await page
        .getByRole("button", { name: "Confirm vote", exact: true })
        .isEnabled(),
      "Voting did not resume after reconnection",
    );
    await returning.screenshot({
      path: "output/playwright/reconnect-restored-vote.png",
    });
    await returning.route("**/guest/resume", (route) => route.abort());
    await returning.reload();
    await returning.getByRole("alert").waitFor();
    assert(
      await returning.evaluate(
        () => !!localStorage.getItem("imposter.web.session.v1"),
      ),
      "Transient host failure erased the saved identity",
    );
    await returning.unroute("**/guest/resume");
    await returning
      .getByRole("button", { name: "Reconnect my player", exact: true })
      .click();
    await returning
      .getByRole("heading", { name: "Your vote is locked", exact: true })
      .waitFor();
    assert(failures.length === 0, failures.join("; "));
    return {
      passed: true,
      checks: [
        "tab-close QR rescan",
        "interrupted-round QR",
        "concealed role restoration",
        "missing-storage recovery",
        "host code verification",
        "pending-request reload",
        "lost approval response",
        "credential rotation",
        "locked-vote preservation",
        "transient startup failure retry",
        "connected role/discussion/ballot screens retained",
        "disconnected names labeled",
        "private cards remain concealable",
        "selected and locked votes retained",
        "round actions wait for reconnect",
        "only the offline player sees the reconnect page",
        "multiple disconnected players named",
        "intentional host pause preserved",
        "labels clear and actions resume after reconnect",
      ],
    };
  } finally {
    keepAlive = false;
    await heartbeat;
    for (const context of contexts) await context.close().catch(() => {});
    await call("close", { session_id: native.session_id }).catch(() => {});
    await call("close", { session_id: host.session_id }).catch(() => {});
    await page
      .evaluate(() => sessionStorage.removeItem("imposter.session.v1"))
      .catch(() => {});
  }
}
