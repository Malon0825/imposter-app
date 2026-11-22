// Hosts paste the party link into a group chat. Chat apps open links through a
// redirect "link shim" and an in-app browser with fresh storage, so the link
// has to survive that trip with its #invite= fragment intact and join cleanly.
async function sharedLinkSmoke(page) {
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
  const host = await call("create", { name: "Group chat", player: "Alex", wifi: "Shared Wi-Fi" });
  const link = host.credentials.invitation;
  const contexts = [];
  try {
    assert(/^http:\/\/[^/]+\/join#invite=[A-Za-z0-9_-]+$/.test(link), `Unexpected link shape: ${link.slice(0, 60)}`);
    const shim = "https://l.chat.test/l.php";
    const phones = [
      ["Mia", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS]", 393],
      ["Ben", "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.0.0 Mobile Safari/537.36 [FB_IAB/Orca-Android]", 360],
      ["Sam", "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/142.0.0.0 Mobile Safari/537.36", 412],
    ];
    for (const [name, userAgent, width] of phones) {
      // A fresh in-app browser: its own storage, no saved player.
      const context = await page.context().browser().newContext({ userAgent, viewport: { width, height: 820 } });
      contexts.push(context);
      const guest = await context.newPage();
      // The chat app's link shim redirects to the pasted URL, fragment included.
      await guest.route(`${shim}**`, (route) =>
        route.fulfill({ status: 302, headers: { location: decodeURIComponent(new URL(route.request().url()).searchParams.get("u")) } }),
      );
      await guest.goto(`${shim}?u=${encodeURIComponent(link)}`);
      assert(new URL(guest.url()).hash.startsWith("#invite="), `${name}'s link lost its invitation in the redirect`);
      await guest.getByRole("button", { name: "Continue in browser", exact: true }).click();
      await guest.getByRole("textbox", { name: "Your name", exact: true }).fill(name);
      await guest.getByRole("button", { name: "Join party", exact: true }).click();
      await guest.getByRole("button", { name: "I’m ready", exact: true }).waitFor();
    }
    const view = await call("state", { session_id: host.session_id });
    assert(view.players.length === phones.length + 1, `Expected ${phones.length + 1} players, saw ${view.players.length}`);
    return { passed: true, link_length: link.length, joined: view.players.map((p) => p.name) };
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await call("close", { session_id: host.session_id }).catch(() => {});
  }
}
