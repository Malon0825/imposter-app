async function smokeGame(page) {
  const base = "http://127.0.0.1:1428";
  const names = ["Alex", "Sam", "Mia", "Ben"];
  for (const old of page.context().pages())
    if (old !== page && old.url().startsWith(base)) await old.close();
  await page.goto(base);
  await page.evaluate(async () => {
    const saved = JSON.parse(
      sessionStorage.getItem("imposter.session.v1") || "null",
    );
    if (saved) {
      try {
        const post = async (m, b) => {
          const r = await fetch("/api/" + m, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Imposter-Dev": "1",
            },
            body: JSON.stringify(b),
          });
          return r.json();
        };
        const v = await post("state", { session_id: saved.session_id });
        await post("action", {
          session_id: saved.session_id,
          action: {
            id: crypto.randomUUID(),
            round_id: v.round_id,
            kind: "end",
            value: null,
          },
        });
        await post("close", { session_id: saved.session_id });
      } catch {}
      sessionStorage.removeItem("imposter.session.v1");
    }
  });
  await page.reload();
  await page.getByRole("button", { name: "Host party", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your name", exact: true })
    .fill("Alex");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Create party", exact: true }).click();
  await page
    .getByRole("heading", { name: "Friday night", exact: true })
    .waitFor();
  const invitation = await page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("imposter.session.v1")).credentials
        .invitation,
  );
  const pages = [page];
  for (const name of names.slice(1)) {
    const p = await page.context().newPage();
    await p.setViewportSize({ width: 430, height: 880 });
    await p.goto(base);
    await p.getByRole("button", { name: "Join party", exact: true }).click();
    await p
      .getByRole("button", { name: "Enter invitation instead", exact: true })
      .click();
    await p
      .getByRole("textbox", { name: "Party invitation", exact: true })
      .fill(invitation);
    await p.getByRole("button", { name: "Continue", exact: true }).click();
    await p
      .getByRole("button", { name: "Check connection", exact: true })
      .click();
    await p.getByRole("button", { name: "Join party", exact: true }).click();
    await p.getByRole("textbox", { name: "Your name", exact: true }).fill(name);
    await p.getByRole("button", { name: "Join party", exact: true }).click();
    await p.getByRole("button", { name: "I’m ready", exact: true }).click();
    pages.push(p);
  }
  await page
    .getByRole("button", { name: "Start round", exact: true })
    .waitFor({ state: "visible" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "output/playwright/lobby.png" });
  await page
    .getByRole("button", { name: "Choose topics", exact: true })
    .click();
  await page.getByRole("heading", { name: "Choose the mood" }).waitFor();
  if ((await page.locator(".topic-tile").count()) !== 22)
    throw Error("Missing topic packs");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "output/playwright/topics.png" });
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  const readRoles = async (round) => {
    await page
      .getByRole("button", { name: "Start round", exact: true })
      .click();
    let imp = -1;
    const civilian = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      await p
        .getByRole("button", { name: "Reveal my role", exact: true })
        .click();
      if (
        await p
          .getByRole("heading", { name: "You are the imposter", exact: true })
          .count()
      )
        imp = i;
      else civilian.push(await p.locator(".secret-word").innerText());
      if (round === 1) {
        await p.waitForTimeout(1200);
        await p.screenshot({ path: `output/playwright/role-${i}.png` });
      }
    }
    if (imp < 0 || civilian.some((w) => w !== civilian[0]))
      throw Error("Incorrect role distribution");
    for (const p of pages)
      await p
        .getByRole("button", { name: "Hide & ready", exact: true })
        .click();
    await page
      .getByRole("heading", { name: "Who sounds suspicious?" })
      .waitFor();
    return imp;
  };
  const finishPunishment = async (capture) => {
    await page
      .getByRole("button", { name: "Drink or Dare", exact: true })
      .click();
    for (let turn = 0; turn < 5; turn++) {
      await page.waitForTimeout(850);
      if (
        await page
          .getByRole("heading", { name: "The standings", exact: true })
          .count()
      )
        return;
      let actor;
      for (const p of pages)
        if (await p.getByRole("button", { name: "Drink", exact: true }).count())
          actor = p;
      for (let retry = 0; !actor && retry < 16; retry++) {
        await page.waitForTimeout(500);
        if (
          await page
            .getByRole("heading", { name: "The standings", exact: true })
            .count()
        )
          return;
        for (const p of pages)
          if (
            await p.getByRole("button", { name: "Drink", exact: true }).count()
          )
            actor = p;
      }
      if (!actor) throw Error("No active punishment recipient");
      await actor
        .getByRole("button", {
          name: turn === 0 ? "Dare" : "Drink",
          exact: true,
        })
        .click();
      await actor.getByRole("button", { name: "Done", exact: true }).waitFor();
      if (capture) {
        await actor.waitForTimeout(1200);
        await actor.screenshot({
          path: `output/playwright/punishment-${turn}.png`,
        });
      }
      if (turn === 0) {
        const text = (await actor.locator(".dare-title").innerText()).replace(
          /\s+/g,
          " ",
        );
        if (!text.includes(" gives ") || !text.includes(" a dare."))
          throw Error("Missing dare giver");
        if (await actor.locator("textarea").count())
          throw Error("App should not collect dare content");
      }
      await actor.getByRole("button", { name: "Done", exact: true }).click();
    }
    throw Error("Punishment did not finish");
  };
  const imp = await readRoles(1);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "output/playwright/discussion.png" });
  await page.getByRole("button", { name: "Open voting", exact: true }).click();
  const wrong = (imp + 1) % 4,
    correct = (imp + 2) % 4,
    other = (imp + 3) % 4;
  const votes = [];
  votes[imp] = wrong;
  votes[wrong] = other;
  votes[correct] = imp;
  votes[other] = wrong;
  for (let i = 0; i < 4; i++) {
    const p = pages[i];
    await p.locator(".ballot-row").filter({ hasText: names[votes[i]] }).click();
    if (i === 0) {
      await p.waitForTimeout(1200);
      await p.screenshot({ path: "output/playwright/ballot.png" });
    }
    await p.getByRole("button", { name: "Confirm vote", exact: true }).click();
    if (i === 0) {
      await p.waitForTimeout(1200);
      await p.screenshot({ path: "output/playwright/vote-locked.png" });
    }
  }
  await page.locator(".round-points").waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "output/playwright/results.png" });
  for (let i = 0; i < 4; i++) {
    const expected = i === imp ? 2 : i === correct ? 1 : 0;
    const text = await pages[i].locator(".round-points").innerText();
    if (text !== `+${expected} points`)
      throw Error(`Wrong points for ${names[i]}: ${text}`);
  }
  await finishPunishment(true);
  await page
    .getByRole("heading", { name: "The standings", exact: true })
    .waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "output/playwright/rankings.png" });
  await page.getByRole("button", { name: "Next round", exact: true }).click();
  for (const p of pages.slice(1))
    await p.getByRole("button", { name: "I’m ready", exact: true }).click();
  await readRoles(2);
  await page.getByRole("button", { name: "Open voting", exact: true }).click();
  const tie = [1, 0, 1, 0];
  for (let i = 0; i < 4; i++) {
    const p = pages[i];
    await p.locator(".ballot-row").filter({ hasText: names[tie[i]] }).click();
    await p.getByRole("button", { name: "Confirm vote", exact: true }).click();
  }
  await page
    .getByRole("heading", { name: "One more vote.", exact: true })
    .waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "output/playwright/runoff.png" });
  for (let i = 0; i < 4; i++) {
    const p = pages[i];
    await p.locator(".ballot-row").filter({ hasText: names[tie[i]] }).click();
    await p.getByRole("button", { name: "Confirm vote", exact: true }).click();
  }
  await page
    .getByText("The runoff tied. No one was accused.", { exact: true })
    .waitFor();
  await finishPunishment(false);
  await page.getByRole("button", { name: "End party", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "End party", exact: true })
    .click();
  for (const p of pages)
    await p
      .getByRole("heading", { name: "That’s a wrap.", exact: true })
      .waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "output/playwright/final-rankings.png" });
  await page.getByRole("button", { name: "Back to home", exact: true }).click();
  await pages[1].waitForTimeout(1300);
  if (
    !(await pages[1]
      .getByRole("heading", { name: "That’s a wrap.", exact: true })
      .count())
  )
    throw Error("Final rankings disappeared after host left");
  return {
    passed: true,
    players: 4,
    rounds: 2,
    checks: [
      "host/join UI",
      "22 topic packs",
      "private roles/hints",
      "secret ballots",
      "individual scoring",
      "named human dare giver",
      "Drink turn",
      "cumulative rankings",
      "runoff/repeated tie",
      "replay",
      "host ending",
      "final score retention",
    ],
  };
}
