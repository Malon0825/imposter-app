async function reconnectAfterQrRescan(page) {
  const base = new URL(page.url()).origin;
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
    name: "QR rescan test",
    player: "Alex",
    wifi: "Shared Wi-Fi",
  });
  const invitation = host.credentials.invitation;
  const browser = page.context().browser();
  const original = await browser.newContext();
  const fresh = await browser.newContext();
  const openJoin = async (context) => {
    const tab = await context.newPage();
    await tab.goto(invitation);
    await tab
      .getByRole("button", { name: "Continue in browser", exact: true })
      .click();
    await tab
      .getByRole("textbox", { name: "Your name", exact: true })
      .fill("Maïa Lee");
    return tab;
  };
  const join = (tab) =>
    tab.getByRole("button", { name: "Join party", exact: true }).click();
  const saved = (tab) =>
    tab.evaluate(() => JSON.parse(localStorage.getItem("imposter.web.session.v1")));
  try {
    const oldTab = await openJoin(original);
    await join(oldTab);
    await oldTab
      .getByRole("button", { name: "I’m ready", exact: true })
      .waitFor();
    const before = await saved(oldTab);
    const returning = await openJoin(fresh);
    await oldTab.bringToFront();
    await oldTab.waitForResponse(
      (response) => response.url().endsWith("/guest/state") && response.ok(),
    );
    await oldTab.close();
    const [duplicate] = await Promise.all([
      returning.waitForResponse((response) => response.url().endsWith("/guest/join")),
      join(returning),
    ]);
    const joinResult = await duplicate.json();
    if (joinResult.code !== "reconnect_required") {
      throw Error(`The rescan treated the original name as a failed new join: ${joinResult.error}`);
    }
    await returning
      .getByRole("heading", { name: "Check with your host.", exact: true })
      .waitFor();
    const code = await returning.locator(".recovery-code").innerText();
    const hostView = await call("state", { session_id: host.session_id });
    const player = hostView.players.find(
      (entry) => entry.id === before.credentials.player_id,
    );
    if (!player?.connected) throw Error("The test missed the disconnect grace period");
    const review = hostView.reconnect_requests.find((entry) => entry.code === code);
    if (!review || (await saved(returning)))
      throw Error("The transfer must require host approval");
    await call("action", {
      session_id: host.session_id,
      action: {
        id: crypto.randomUUID(),
        round_id: hostView.round_id,
        kind: "approve_reconnect",
        value: review.id,
      },
    });
    await returning
      .getByRole("button", { name: "I’m ready", exact: true })
      .waitFor();
    const after = await saved(returning);
    if (
      after.credentials.player_id !== before.credentials.player_id ||
      after.credentials.token === before.credentials.token
    ) {
      throw Error("Recovery should keep the player and replace the old credential");
    }
    const final = await call("state", { session_id: host.session_id });
    if (final.players.length !== 2) throw Error("The QR rescan created a duplicate player");
    return {
      passed: true,
      checks: [
        "closed tab",
        "QR rescan with separate storage",
        "same name entered in join form",
        "host approval during heartbeat grace period",
        "original player restored",
      ],
    };
  } finally {
    await original.close();
    await fresh.close();
    await call("close", { session_id: host.session_id }).catch(() => {});
  }
}
