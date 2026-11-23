// A phone on a busy Wi-Fi drops the odd request. A short blip must not throw the
// player onto the reconnect screen and tell them to check a Wi-Fi they are
// already on; a real outage still must. The host keeps a 9s presence grace, so
// the guest's own screen should not give up well before the host does.
async function presenceBlipSmoke(page) {
  const origin = new URL(page.url()).origin;
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const call = async (method, body = {}) => {
    const response = await page.request.post(`${origin}/api/${method}`, {
      headers: { "X-Imposter-Dev": "1" },
      data: body,
    });
    const value = await response.json();
    if (!response.ok()) throw Error(value.error);
    return value;
  };
  const host = await call("create", {
    name: "Blip test",
    player: "Alex",
    wifi: "Shared Wi-Fi",
  });
  const contexts = [];
  try {
    const context = await page.context().browser().newContext({
      viewport: { width: 390, height: 844 },
    });
    contexts.push(context);
    const guest = await context.newPage();
    await guest.goto(host.credentials.invitation);
    await guest.getByRole("button", { name: "Continue in browser", exact: true }).click();
    await guest.getByRole("textbox", { name: "Your name", exact: true }).fill("Mia");
    await guest.getByRole("button", { name: "Join party", exact: true }).click();
    await guest.getByRole("button", { name: "I’m ready", exact: true }).waitFor();

    const holding = guest.getByRole("heading", { name: "Hold that thought.", exact: true });
    const blip = async (ms) => {
      await guest.route("**/guest/state", (route) => route.abort("connectionfailed"));
      await guest.waitForTimeout(ms);
      await guest.unroute("**/guest/state");
    };

    // A two second blip is ordinary Wi-Fi behaviour on a phone.
    await blip(2000);
    const flipped = await holding.count();
    await guest.getByRole("button", { name: "I’m ready", exact: true }).waitFor();
    assert(flipped === 0, "A two second blip threw the player onto the reconnect screen");

    // A sustained outage must still be reported, and must recover on its own.
    await guest.route("**/guest/state", (route) => route.abort("connectionfailed"));
    await holding.waitFor({ timeout: 20000 });
    await guest.unroute("**/guest/state");
    await guest.getByRole("button", { name: "I’m ready", exact: true }).waitFor({ timeout: 20000 });
    assert(
      (await holding.count()) === 0,
      "The reconnect screen stayed up after the host became reachable again",
    );

    // The host never saw the guest leave, because its own grace is longer.
    const view = await call("state", { session_id: host.session_id });
    assert(
      view.players.every((p) => p.connected),
      "The host dropped a guest that was only briefly unreachable",
    );
    return { passed: true, checks: ["short blip tolerated", "sustained outage reported", "automatic recovery", "host presence unaffected"] };
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await call("close", { session_id: host.session_id }).catch(() => {});
  }
}
