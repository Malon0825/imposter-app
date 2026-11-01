async function checkMotion(page) {
  const base = "http://127.0.0.1:1428";
  const catalog = await (
    await page.request.post(base + "/api/catalog", {
      headers: { "X-Imposter-Dev": "1" },
      data: {},
    })
  ).json();
  await page.setViewportSize({ width: 390, height: 750 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(
    ({ catalog }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("imposter.name", "Alex");
      const players = ["Alex", "Sam", "Mia", "Ben"].map((name, i) => ({
        id: name.toLowerCase(),
        name,
        ready: true,
        connected: true,
        left: false,
        points: 0,
        earned: 0,
      }));
      const invitation =
        "imposter://join/" +
        btoa(
          JSON.stringify({
            version: 1,
            wifi: "Home Wi-Fi",
            party_name: "Friday night",
            endpoint: "https://192.168.1.10:4567/",
            admission: "motion-test-only",
          }),
        );
      const view = {
        id: "motion-test",
        name: "Friday night",
        wifi: "Home Wi-Fi",
        phase: "lobby",
        revision: 1,
        round_id: 1,
        host_id: "alex",
        my_id: "alex",
        is_host: true,
        paused: false,
        pause_reason: null,
        topics: ["animals"],
        catalog,
        players,
        private_role: null,
        role_ready: false,
        ready_count: 0,
        starting_id: "mia",
        vote_count: 0,
        my_vote: null,
        candidates: [],
        result: null,
        punishment: null,
      };
      const fixture = { view, players, actions: [], delay: 0 };
      window.__motionTest = fixture;
      window.isTauri = true;
      const session = () => ({
        session_id: "motion-test",
        credentials: {
          is_host: true,
          player_id: "alex",
          token: "motion-test-only",
          invitation,
        },
        view: structuredClone(view),
      });
      window.__TAURI_INTERNALS__ = {
        invoke: async (command, args) => {
          if (command === "native_action")
            return {
              platform: "android",
              wifi: true,
              wifi_name: "Home Wi-Fi",
              ip: "192.168.1.10",
              background_supported: true,
              battery_unrestricted: false,
            };
          if (command === "game_state") return structuredClone(view);
          if (command === "game_create" || command === "game_resume")
            return session();
          if (command === "game_close") return;
          if (command === "game_action") {
            fixture.actions.push(args.action.kind);
            if (fixture.delay)
              await new Promise((resolve) =>
                setTimeout(resolve, fixture.delay),
              );
            const { kind, value } = args.action;
            if (kind === "topics") view.topics = value;
            if (kind === "open_vote") {
              view.phase = "voting";
              view.my_vote = null;
            }
            if (kind === "vote") {
              view.my_vote = value;
              view.vote_count = 3;
            }
            if (kind === "role_ready") view.role_ready = true;
            view.revision++;
            return structuredClone(view);
          }
          throw Error("Unsupported motion fixture command " + command);
        },
      };
    },
    { catalog },
  );
  await page.goto(base);
  await page.getByRole("button", { name: "Host party", exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const assert = (value, message) => {
    if (!value) throw Error(message);
  };
  const capture = async (name) =>
    page.screenshot({
      path: "output/playwright/motion-check/" + name + ".png",
    });
  const frames = (selector, duration = 650) =>
    page.evaluate(
      ({ selector, duration }) =>
        new Promise((resolve) => {
          const result = [],
            start = performance.now();
          const tick = () => {
            const e = document.querySelector(selector);
            if (e) {
              const s = getComputedStyle(e),
                m = new DOMMatrixReadOnly(
                  s.transform === "none" ? undefined : s.transform,
                );
              result.push({
                t: Math.round(performance.now() - start),
                x: m.m41,
                y: m.m42,
                scale: m.m11,
                angle: Math.abs((Math.atan2(m.m13, m.m11) * 180) / Math.PI),
                opacity: Number(s.opacity),
                className: e.className,
                text: e.textContent,
              });
            }
            if (performance.now() - start < duration)
              requestAnimationFrame(tick);
            else resolve(result);
          };
          tick();
        }),
      { selector, duration },
    );
  const rest = async () => {
    await page.waitForTimeout(450);
    const state = await page.locator("main").evaluate((e) => {
      const s = getComputedStyle(e),
        m = new DOMMatrixReadOnly(
          s.transform === "none" ? undefined : s.transform,
        );
      return { x: m.m41, y: m.m42, opacity: Number(s.opacity), inert: e.inert };
    });
    assert(
      Math.abs(state.x) < 0.1 &&
        Math.abs(state.y) < 0.1 &&
        state.opacity > 0.99 &&
        !state.inert,
      "Screen did not return to its resting state",
    );
  };

  // Navigation direction and rapid native-back interruptions.
  const [forward] = await Promise.all([
    frames("main"),
    page.getByRole("button", { name: "Host party", exact: true }).click(),
  ]);
  await rest();
  assert(
    forward.some(
      (f) => String(f.className).includes("screen-create") && f.x > 0.2,
    ),
    "Forward page did not enter from the right",
  );
  const [backward] = await Promise.all([
    frames("main"),
    page.getByRole("button", { name: "Go back", exact: true }).click(),
  ]);
  await rest();
  assert(
    backward.some(
      (f) => String(f.className).includes("screen-home") && f.x < -0.2,
    ),
    "Back page did not enter from the left",
  );
  for (let i = 0; i < 20; i++) {
    await page
      .getByRole("button", { name: "Host party", exact: true })
      .click({ force: true });
    await page.waitForTimeout(15);
    await page.evaluate(() => window.dispatchEvent(new Event("imposter-back")));
    await page
      .getByRole("button", { name: "Host party", exact: true })
      .waitFor();
    await page.waitForTimeout(350);
  }
  await rest();
  await page.getByRole("button", { name: "Host party", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Keep app open instead", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Friday night", exact: true })
    .waitFor();
  await rest();

  // A short drag returns; a deliberate drag dismisses. Repeat without ghost sheets.
  const dragHandle = async (distance) => {
    const b = await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + distance, {
      steps: 12,
    });
    await page.waitForTimeout(130);
    await page.mouse.up();
    await page.waitForTimeout(500);
  };
  await page
    .getByRole("button", { name: "Show invitation QR code", exact: true })
    .click();
  await page.waitForTimeout(450);
  await dragHandle(25);
  assert(
    (await page.getByRole("dialog").count()) === 1,
    "A short sheet drag incorrectly dismissed it",
  );
  await capture("sheet-rest");
  await dragHandle(150);
  assert(
    (await page.getByRole("dialog").count()) === 0,
    "Sheet did not dismiss after a deliberate drag",
  );
  for (let i = 0; i < 20; i++) {
    await page
      .getByRole("button", { name: "Show invitation QR code", exact: true })
      .click({ force: true });
    await page.waitForTimeout(65);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
  }
  assert(
    (await page.evaluate(() => document.body.style.overflow)) !== "hidden",
    "Sheet left the page scroll locked",
  );

  await page
    .getByRole("button", { name: "Choose topics", exact: true })
    .click();
  const topic = page.locator(".topic-tile").filter({ hasText: "Animals" });
  await topic.waitFor();
  await rest();
  const initialSelection = await topic.getAttribute("aria-pressed");
  for (let i = 0; i < 20; i++) {
    await topic.click({ force: true });
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(450);
  assert(
    (await topic.getAttribute("aria-pressed")) === initialSelection,
    "Rapid selections lost an input",
  );
  const box = await topic.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(100);
  const pressed = await topic.evaluate(
    (e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).m11,
  );
  await page.mouse.up();
  await page.waitForTimeout(500);
  const released = await topic.evaluate(
    (e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).m11,
  );
  assert(
    pressed < 0.995 && Math.abs(released - 1) < 0.003,
    "Press spring did not compress and return to rest",
  );
  // Restore the required topic after the press test's final click.
  if ((await topic.getAttribute("aria-pressed")) === "false")
    await topic.click();
  await page
    .getByRole("button", { name: "Search topics", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search topics", exact: true })
    .fill("Psych");
  await page
    .getByRole("button", { name: "Close topic search", exact: true })
    .click();
  await page.getByRole("button", { name: "Save topics", exact: true }).click();
  await page
    .getByRole("heading", { name: "Friday night", exact: true })
    .waitFor();

  const phase = async (name, extra = {}) => {
    await page.evaluate(
      ({ name, extra }) => {
        const f = window.__motionTest;
        Object.assign(f.view, {
          phase: name,
          players: f.players,
          private_role: null,
          my_vote: null,
          result: null,
          punishment: null,
          role_ready: false,
          ...extra,
        });
        f.view.revision++;
      },
      { name, extra },
    );
    await page.locator("main.screen-" + name).waitFor();
    await rest();
  };
  await phase("roles", { private_role: { imposter: false, clue: "Dog" } });
  const [roleFrames] = await Promise.all([
    frames(".role-flip", 700),
    page.getByRole("button", { name: "Reveal my role", exact: true }).click(),
  ]);
  assert(
    roleFrames.some((f) => f.angle > 10 && f.angle < 170),
    "No intermediate role-card frame was observed",
  );
  await page.waitForTimeout(200);
  await capture("role-rest");
  // Background concealment happens synchronously, before a React render or flip.
  const concealed = await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    return getComputedStyle(document.querySelector(".role-back")).visibility;
  });
  assert(concealed === "hidden", "Secret was visible after backgrounding");
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    delete document.hidden;
    delete document.visibilityState;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page
    .getByRole("button", { name: "Reveal my role", exact: true })
    .waitFor();
  assert(
    (await page.locator(".secret-word").count()) === 0,
    "Secret content survived concealment",
  );
  await page
    .getByRole("button", { name: "Reveal my role", exact: true })
    .click();
  await page.waitForTimeout(450);
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page
    .getByRole("button", { name: "Reveal my role", exact: true })
    .waitFor();

  // Fast local work must not flash a spinner; slow work must remain single-shot.
  await phase("discussion");
  await page.evaluate(() => {
    window.__motionTest.delay = 700;
  });
  await page
    .getByRole("button", { name: "Open voting", exact: true })
    .click({ clickCount: 2, delay: 20 });
  await page.waitForTimeout(100);
  assert(
    (await page.locator(".busy-indicator").count()) === 0,
    "Spinner flashed before the delay",
  );
  await page.waitForTimeout(220);
  assert(
    (await page.locator(".busy-indicator").count()) === 1,
    "Slow work did not show progress",
  );
  await page
    .getByRole("heading", { name: "Who is the imposter?", exact: true })
    .waitFor();
  assert(
    (await page.evaluate(
      () => window.__motionTest.actions.filter((x) => x === "open_vote").length,
    )) === 1,
    "Double tap submitted an action twice",
  );
  await page.evaluate(() => {
    window.__motionTest.delay = 0;
  });
  await page.locator(".ballot-row").filter({ hasText: "Mia" }).click();
  await page.getByRole("button", { name: "Confirm vote", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your vote is locked", exact: true })
    .waitFor();
  await page.waitForTimeout(600);
  await capture("vote-rest");
  await page.setViewportSize({ width: 360, height: 700 });
  await page.evaluate(() => {
    const f = window.__motionTest;
    f.view.players = Array.from({ length: 12 }, (_, i) => ({
      ...f.players[i % 4],
      id: "player-" + i,
      name: "Player " + i,
    }));
    f.view.vote_count = 9;
    f.view.revision++;
  });
  await page.waitForTimeout(750);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Twelve-player progress overflowed the phone",
  );
  await capture("twelve-player-progress");
  await page.setViewportSize({ width: 390, height: 750 });

  const result = {
    imposter_id: "sam",
    word: "Dog",
    accused_id: "mia",
    escaped: true,
    my_vote: "mia",
    earned: 0,
    was_imposter: false,
  };
  await page.evaluate(() => {
    const f = window.__motionTest;
    f.players[1].points = 2;
    f.players[1].earned = 2;
    f.players[2].points = 1;
    f.players[2].earned = 1;
  });
  // Start sampling before phase delivery so the complete count-up is observed.
  const scorePromise = frames(".rank-row:first-child .score strong", 1400);
  await phase("rankings", { result });
  const scoreFrames = await scorePromise;
  const scoreValues = scoreFrames.map((f) => Number(f.text));
  assert(
    scoreValues.at(-1) === 2 && scoreValues.some((v) => v < 2),
    "Score did not count up to the authoritative total",
  );
  assert(
    scoreValues.every((v, i) => i === 0 || v >= scoreValues[i - 1]),
    "Score count-up overshot or reversed",
  );
  await phase("ended", { result });
  await page.waitForTimeout(1600);
  assert(
    (await page.locator(".confetti-burst").count()) === 0,
    "Celebration particles were not cleaned up",
  );
  assert(
    (await page.locator(".confetti > i").count()) === 16,
    "Resting final composition changed",
  );
  await capture("final-rest");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole('button',{name:'Back to home',exact:true}).click();
  await page.getByRole('button',{name:'Host party',exact:true}).waitFor();
  await page.evaluate(()=>{const f=window.__motionTest;Object.assign(f.view,{phase:'lobby',result:null,my_vote:null,private_role:null,role_ready:false});f.view.revision++;});
  await page.getByRole('button',{name:'Host party',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Keep app open instead',exact:true}).click();
  await page.getByRole('heading',{name:'Friday night',exact:true}).waitFor();
  await phase("roles", { private_role: { imposter: false, clue: "Dog" } });
  await page
    .getByRole("button", { name: "Reveal my role", exact: true })
    .click();
  await page.waitForTimeout(40);
  const reducedAngle = await page
    .locator(".role-flip")
    .evaluate((e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).m11);
  assert(
    reducedAngle < -0.99,
    "Reduced motion still animated the private reveal",
  );
  await phase("ended", { result });
  assert(
    (await page.locator(".confetti-burst").count()) === 0,
    "Reduced motion played celebration particles",
  );
  await page.getByRole("button", { name: "Back to home", exact: true }).click();
  await page.getByRole("button", { name: "Host party", exact: true }).waitFor();
  assert(
    (await page
      .locator(".welcome-float")
      .evaluate((e) => getComputedStyle(e).transform)) === "none",
    "Reduced motion kept ambient movement",
  );
  return {
    passed: true,
    rapidNavigationCycles: 20,
    rapidSheetCycles: 20,
    rapidSelections: 20,
    press: { pressed, released },
    intermediateRoleFrames: roleFrames.filter(
      (f) => f.angle > 10 && f.angle < 170,
    ).length,
    scoreValues: [...new Set(scoreValues)],
    checks: [
      "forward/back direction",
      "rest states",
      "sheet drag and return",
      "rapid interruption",
      "immediate private concealment",
      "help return privacy",
      "slow action feedback and duplicate protection",
      "12-player progress",
      "monotonic scores",
      "bounded celebration",
      "reduced motion",
    ],
  };
}
