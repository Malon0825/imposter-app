async function captureVisuals(page) {
  // Isolated native-command fixtures exercise the production React components.
  // They are installed only in this Playwright page, never in the shipped app.
  const base = "http://127.0.0.1:1428";
  const params = new URL(page.url()).searchParams;
  const pass = params.get("capture") || "before";
  const width = Number(params.get("width") || 390);
  const height = Number(params.get("height") || 750);
  const only = params.get("screens")?.split(",");
  const keep = params.has("keep");
  const output = `output/playwright/visual-${pass}`;
  const catalogResponse = await page.request.post(base + "/api/catalog", {
    headers: { "X-Imposter-Dev": "1" },
    data: {},
  });
  const catalog = await catalogResponse.json();
  const people = [
    {
      id: "alex",
      name: "Alex",
      ready: true,
      connected: true,
      left: false,
      points: 0,
      earned: 0,
    },
    {
      id: "sam",
      name: "Sam",
      ready: true,
      connected: true,
      left: false,
      points: 2,
      earned: 2,
    },
    {
      id: "mia",
      name: "Mia",
      ready: true,
      connected: true,
      left: false,
      points: 1,
      earned: 1,
    },
    {
      id: "ben",
      name: "Ben",
      ready: true,
      connected: true,
      left: false,
      points: 0,
      earned: 0,
    },
  ];
  for (const p of people) Object.assign(p, {report_penalty: 0, report_round: null});
  const sampleNative = {
    version: 1,
    wifi: "Home Wi-Fi",
    party_name: "Friday night",
    endpoint: "https://192.168.1.10:4567/",
    party_id: "visual-review",
    admission: "11111111-1111-4111-8111-111111111111",
    certificate: "visual-review-only",
    expires: Math.floor(Date.now() / 1000) + 3600,
  };
  const invitation =
    "http://192.168.1.10:4568/join#invite=" +
    btoa(
      JSON.stringify({
            version: 2,
            native: sampleNative,
            browser: {
              endpoint: "http://192.168.1.10:4568/",
              admission: "22222222-2222-4222-8222-222222222222",
            },
      }),
    );
  const view = (phase = "lobby", extra = {}) => ({
    id: "visual-review",
    name: "Friday night",
    wifi: "Home Wi-Fi",
    phase,
    revision: 10,
    round_id: 1,
    score_session: { number: 1, target: 15, started: true, complete: false, winner_ids: [] },
    betting: { eligible: false, max_stake: 0, my_stake: null, original_vote: null, reading_streak: 0 },
    host_id: "alex",
    my_id: "alex",
    is_host: true,
    paused: false,
    pause_reason: null,
    topics: ["animals"],
    catalog,
    players: people,
    private_role: null,
    role_ready: false,
    ready_count: 0,
    starting_id: "mia",
    vote_count: 0,
    my_vote: null,
    candidates: [],
    result: null,
    punishment: null,
    ...extra,
  });
  const result = {
    imposter_id: "sam",
    word: "Dog",
    accused_id: "mia",
    escaped: true,
    my_vote: "mia",
    earned: 0,
    was_imposter: false,
    score: { before: 0, base: 0, bet: 0, streak: 0, bluff: 0, penalty: 0, after: 0 }, imposter_bonus: 0, report_penalty: 0, report_round: null,
  };
  const scenarios = [
    { id: "01-welcome" },
    { id: "02-create", nav: ["Host party"] },
    { id: "03-host-setup", nav: ["Host party", "Continue"] },
    { id: "04-host-lobby", view: view() },
    { id: "05-scan", nav: ["Join party"] },
    { id: "06-wifi", join: "wifi" },
    { id: "07-identity", join: "identity" },
    {
      id: "08-guest-lobby",
      view: view("lobby", {
        my_id: "sam",
        is_host: false,
        players: people.map((p) =>
          p.id === "sam" ? { ...p, ready: false } : p,
        ),
      }),
    },
    { id: "09-topics", view: view(), nav: ["Topic settings"] },
    {
      id: "10-role-concealed",
      view: view("roles", { private_role: { imposter: false, clue: "Dog" } }),
    },
    {
      id: "11-civilian",
      view: view("roles", { private_role: { imposter: false, clue: "Dog" } }),
      nav: ["Reveal my role"],
    },
    {
      id: "12-imposter",
      view: view("roles", {
        my_id: "sam",
        is_host: false,
        private_role: { imposter: true, clue: "Paws" },
      }),
      nav: ["Reveal my role"],
    },
    { id: "13-discussion", view: view("discussion") },
    { id: "14-ballot", view: view("voting"), select: "Mia" },
    {
      id: "15-vote-locked",
      view: view("voting", { my_vote: "mia", vote_count: 3 }),
    },
    { id: "16-results", view: view("results", { result }) },
    {
      id: "17-choose",
      view: view("punishment", {
        result,
        punishment: {
          player_id: "alex",
          giver_id: null,
          choice: null,
          turn: 1,
          total: 2,
        },
      }),
    },
    {
      id: "18-dare",
      view: view("punishment", {
        result,
        punishment: {
          player_id: "alex",
          giver_id: "sam",
          choice: "dare",
          turn: 1,
          total: 2,
        },
      }),
    },
    {
      id: "19-drink",
      view: view("punishment", {
        my_id: "ben",
        is_host: false,
        result: { ...result, my_vote: "alex" },
        punishment: {
          player_id: "ben",
          giver_id: null,
          choice: "drink",
          turn: 2,
          total: 2,
        },
      }),
    },
    { id: "20-rankings", view: view("rankings", { result }) },
    {
      id: "21-tie-escape",
      view: view("result_reveal", {
        round_id: 2,
        verdict: { imposter_id: "sam", escaped: true, tied: true },
        reveal: { stage: "verdict", round_id: 2 },
      }),
    },
    {
      id: "22-reconnecting",
      view: view("discussion", { my_id: "ben", is_host: false }),
      offline: true,
    },
    { id: "23-final", view: view("ended", { result }) },
    { id: "24-help", nav: ["How to play"] },
    {
      id: "25-reports",
      view: view("results", { result,
        reporting: {
          my_reports: null,
          submitted_count: 0,
          total: 4,
          majority: 3,
          player_ids: people.map((p) => p.id),
        },
      }),
      nav: ["Report a rule violation"],
      check: "Sam",
    },
    {
      id: "26-reports-submitted",
      view: view("results", { result,
        reporting: {
          my_reports: ["sam", "ben"],
          submitted_count: 2,
          total: 4,
          majority: 3,
          player_ids: people.map((p) => p.id),
        },
      }),
    },
    {
      id: "27-reports-skipped",
      view: view("results", { result,
        reporting: {
          my_reports: [],
          submitted_count: 1,
          total: 4,
          majority: 3,
          player_ids: people.map((p) => p.id),
        },
      }),
    },
    {
      id: "28-report-deduction",
      view: view("results", {
        round_id: 2,
        result: {
          ...result,
          my_vote: "sam",
          earned: 1,
          score: { before: 0, base: 1, bet: 0, streak: 0, bluff: 0, penalty: 1, after: 0 },
          report_penalty: 1,
          report_round: 1,
        },
      }),
    },
  ];
  const captures = [];
  for (const old of page.context().pages()) if (old !== page) await old.close();
  for (const scenario of scenarios.filter(
    (s) => !only || only.includes(s.id.slice(0, 2)),
  )) {
    const p = await page.context().newPage();
    await p.setViewportSize({ width, height });
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.addInitScript(
      ({ scenario, invitation }) => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem("imposter.name", scenario.join ? "Sam" : "Alex");
        window.isTauri = true;
        const credentials = {
          is_host: scenario.view?.is_host ?? true,
          invitation,
          token: "visual-review-only",
          player_id: scenario.view?.my_id || "alex",
        };
        if (scenario.view)
          localStorage.setItem(
            "imposter.session.v1",
            JSON.stringify({ session_id: "visual-review", credentials }),
          );
        let reads = 0,
          scanReject;
        window.__TAURI_INTERNALS__ = {
          invoke: async (command, args) => {
            if (command === "native_action")
              return {
                platform: "android",
                wifi: true,
                wifi_name: "Home Wi-Fi",
                ip: "192.168.1.10",
                battery_unrestricted: false,
                background_supported: true,
              };
            if (command === "game_state") {
              if (scenario.offline && ++reads > 4)
                throw Error("Offline fixture");
              return scenario.view;
            }
            if (command === "game_inspect")
              return {
                name: "Friday night",
                host_name: "Alex",
                wifi: "Home Wi-Fi",
              };
            if (
              command === "plugin:barcode-scanner|check_permissions" ||
              command === "plugin:barcode-scanner|request_permissions"
            )
              return { camera: "granted" };
            if (command === "plugin:barcode-scanner|scan")
              return new Promise((resolve, reject) => {
                scanReject = reject;
              });
            if (command === "plugin:barcode-scanner|cancel") {
              scanReject?.({ message: "Scan cancelled" });
              return;
            }
            throw Error("Visual fixture does not implement " + command);
          },
        };
      },
      { scenario, invitation },
    );
    await p.goto(base);
    await p.locator(".boot").waitFor({ state: "hidden" });
    if (scenario.join) {
      await p.getByRole("button", { name: "Join party", exact: true }).click();
      await p
        .getByRole("button", { name: "Enter invitation instead", exact: true })
        .click();
      await p
        .getByRole("textbox", { name: "Party invitation", exact: true })
        .fill(invitation);
      await p.getByRole("button", { name: "Continue", exact: true }).click();
      if (scenario.join === "identity") {
        await p
          .getByRole("button", { name: "Check connection", exact: true })
          .click();
        await p
          .getByRole("button", { name: "Join party", exact: true })
          .click();
        await p.waitForTimeout(2700);
      }
    }
    for (const action of scenario.nav || [])
      await p.getByRole("button", { name: action, exact: true }).click();
    if (scenario.select)
      await p
        .locator(".ballot-row")
        .filter({ hasText: scenario.select })
        .click();
    if (scenario.check)
      await p
        .locator(".report-sheet-row")
        .filter({ hasText: scenario.check })
        .click();
    if (scenario.offline)
      await p.getByRole("heading", { name: "Hold that thought." }).waitFor();
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(900);
    const metrics = await p.evaluate(() => ({
      pageHeight: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
      buttons: [...document.querySelectorAll(".actions .button")].map((b) => ({
        text: b.innerText,
        y: b.getBoundingClientRect().y,
        height: b.getBoundingClientRect().height,
      })),
    }));
    await p.screenshot({
      path: `${output}/${scenario.id}.png`,
      fullPage: false,
    });
    captures.push({ screen: scenario.id, ...metrics });
    if (!keep) await p.close();
  }
  return {
    pass,
    width,
    height,
    passed: captures.every((c) => c.pageHeight <= height + 1 && !c.overflow),
    captures,
  };
}
