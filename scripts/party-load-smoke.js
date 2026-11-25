// Sustained multi-player presence check: every guest polls the host the way the
// app does, so a party that looks connected stays connected. Reports failures by
// code, latency percentiles, and any player the host marked offline.
async function partyLoadSmoke(page, options = {}) {
  const guests = options.guests ?? 7;
  const seconds = options.seconds ?? 45;
  const interval = options.interval ?? 600; // Matches the client poll loop.
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
    name: "Load test",
    player: "Alex",
    wifi: "Shared Wi-Fi",
  });
  const inviteOrigin = new URL(host.credentials.invitation).origin;
  const partyId = JSON.parse(
    atob(host.credentials.invitation.split("#invite=")[1].replace(/-/g, "+").replace(/_/g, "/")),
  ).native.party_id;
  const admission = JSON.parse(
    atob(host.credentials.invitation.split("#invite=")[1].replace(/-/g, "+").replace(/_/g, "/")),
  ).browser.admission;
  const failures = [];
  const latencies = [];
  const players = [];
  try {
    // Everyone scans the QR at once, so the joins race rather than queue.
    const joins = Array.from({ length: guests }, async (_, i) => {
      const controller = crypto.randomUUID();
      const response = await page.request.post(`${inviteOrigin}/guest/join`, {
        headers: {
          "X-Imposter-Client": "web-v1",
          "X-Imposter-Gameplay": "power-cards-v1",
          Origin: inviteOrigin,
        },
        data: {
          party_id: partyId,
          admission,
          name: `Guest ${i + 1}`,
          request_id: crypto.randomUUID(),
          controller,
        },
      });
      const value = await response.json();
      assert(response.ok(), `Guest ${i + 1} could not join: ${value.error}`);
      players.push({ name: `Guest ${i + 1}`, controller, credentials: value.credentials });
    });
    await Promise.all(joins);
    players.sort((a, b) => a.name.localeCompare(b.name));
    assert(
      (await call("state", { session_id: host.session_id })).players.length === guests + 1,
      "The host did not see every guest join",
    );

    const until = Date.now() + seconds * 1000;
    const poll = async (player) => {
      while (Date.now() < until) {
        const started = Date.now();
        try {
          const response = await page.request.post(`${inviteOrigin}/guest/state`, {
            headers: {
              "X-Imposter-Client": "web-v1",
              "X-Imposter-Gameplay": "power-cards-v1",
              "X-Imposter-Party": partyId,
              "X-Imposter-Controller": player.controller,
              Authorization: `Bearer ${player.credentials.token}`,
              Origin: inviteOrigin,
            },
            data: {},
          });
          const value = await response.json();
          if (!response.ok())
            failures.push({ who: player.name, status: response.status(), code: value.code });
        } catch (error) {
          failures.push({ who: player.name, status: 0, code: String(error.message).slice(0, 60) });
        }
        latencies.push(Date.now() - started);
        const wait = interval - (Date.now() - started);
        if (wait > 0) await page.waitForTimeout(wait);
      }
    };
    const hostPoll = (async () => {
      while (Date.now() < until) {
        await call("state", { session_id: host.session_id }).catch((error) =>
          failures.push({ who: "Alex", status: 0, code: String(error.message).slice(0, 60) }),
        );
        await page.waitForTimeout(interval);
      }
    })();
    await Promise.all([...players.map(poll), hostPoll]);

    const view = await call("state", { session_id: host.session_id });
    const offline = view.players.filter((p) => !p.connected).map((p) => p.name);
    latencies.sort((a, b) => a - b);
    const at = (q) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))];
    const byCode = {};
    for (const failure of failures) {
      const key = `${failure.status}:${failure.code}`;
      byCode[key] = (byCode[key] || 0) + 1;
    }
    const report = {
      guests,
      seconds,
      polls: latencies.length,
      failures: failures.length,
      byCode,
      latency_ms: { p50: at(0.5), p95: at(0.95), p99: at(0.99), max: latencies.at(-1) },
      offline,
    };
    assert(failures.length === 0, `Guest polls failed: ${JSON.stringify(report)}`);
    assert(offline.length === 0, `Host marked players offline: ${JSON.stringify(report)}`);
    return { passed: true, ...report };
  } finally {
    await call("close", { session_id: host.session_id }).catch(() => {});
  }
}
