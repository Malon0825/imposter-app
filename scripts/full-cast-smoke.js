// Full Cast in the browser at 3, 4 and 5 players: every role screen, the size-aware
// copy, the role-specific ballots and the results. Run with:
//   npx --package @playwright/cli playwright-cli -s=imposter run-code --filename=scripts/full-cast-smoke.js
async function fullCastSmoke(hostPage) {
  const origin = new URL(hostPage.url()).origin;
  const browser = hostPage.context().browser();
  const contexts = [];
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const button = (page, name) => page.getByRole("button", { name, exact: true });
  const call = async (method, body) => {
    const response = await hostPage.request.post(`${origin}/api/${method}`, { headers: { "X-Imposter-Dev": "1" }, data: body });
    const data = await response.json();
    if (!response.ok()) throw Error(data.error);
    return data;
  };
  const lineup = {
    3: ["Imposter", "Decoy", "Gambler"],
    4: ["Imposter", "Judge", "Decoy", "Gambler"],
    5: ["Imposter", "Accomplice", "Detective", "Judge", "Decoy"],
  };
  const capture = async (page, name) => {
    await page.waitForTimeout(700);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} overflowed`);
    await page.screenshot({ path: `output/playwright/full-cast-${name}.png`, fullPage: true });
  };
  try {
    for (const size of [3, 4, 5]) {
      const party = `Cast of ${size}`;
      const host = await call("create", { name: party, player: "Alex", wifi: "Playtest Wi-Fi" });
      const sessions = [host];
      for (const name of ["Ben", "Cleo", "Dev", "Eve"].slice(0, size - 1))
        sessions.push(await call("join", { invitation: host.credentials.native_invitation, player: name }));
      const pages = [];
      for (const [index, session] of sessions.entries()) {
        // Fresh contexts for everyone, the host too: a tab keeps its party across reloads.
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        contexts.push(context);
        const page = await context.newPage();
        await page.goto(origin);
        await button(page, "Host party").waitFor();
        await page.evaluate((data) => sessionStorage.setItem("imposter.session.v1", JSON.stringify(data)), session);
        await page.reload();
        await page.getByRole("heading", { name: party, exact: true }).waitFor();
        pages.push(page);
      }
      const [hostTab] = pages;
      await Promise.all(pages.slice(1).map((page) => button(page, "I’m ready").click()));
      await hostTab.locator(".cast-lineup").waitFor();
      const shown = await hostTab.locator(".cast-lineup li strong").allTextContents();
      assert(shown.map((s) => s.replace(/ ×\d+$/, "")).join() === lineup[size].join(), `Lineup at ${size}: ${shown}`);
      await capture(hostTab, `${size}-lobby`);
      await button(hostTab, "Start round").click();

      // Topic vote, then each player meets their role before the card.
      await hostTab.getByRole("heading", { name: "What should we play?", exact: true }).waitFor({ timeout: 15000 });
      const vote = (await call("state", { session_id: host.session_id })).topic_vote;
      const topic = (await call("catalog", {})).find((entry) => entry.id === vote.available_topics[0]).name;
      await Promise.all(pages.map(async (page) => {
        await button(page, topic).click();
        await button(page, "Lock my vote").click();
      }));
      const roles = [];
      for (const page of pages) {
        await button(page, "Reveal my role").click({ timeout: 15000 });
        const role = await page.locator(".role-stage-name").textContent().then((s) => s.trim());
        const goal = (await page.locator(".role-stage-goal").innerText()).trim();
        roles.push(role);
        if (role === "Decoy") assert((goal === "Pull votes onto yourself.") === (size < 5), `Decoy goal at ${size}: ${goal}`);
        if (role === "Judge") assert(goal.includes("counts twice") === (size >= 6), `Judge goal at ${size}: ${goal}`);
        await capture(page, `${size}-${role.toLowerCase()}-stage`);
        await page.getByRole("button", { name: /^See my/ }).click();
        await page.locator(".role-title").waitFor();
        await capture(page, `${size}-${role.toLowerCase()}-card`);
        await button(page, "Hide & ready").click();
      }
      const dealt = [...roles].sort().join();
      const want = [...lineup[size], ...Array(size - lineup[size].length).fill("Gambler")];
      assert(dealt === want.sort().join(), `Dealt at ${size}: ${roles}`);

      await button(hostTab, "Open voting").click();
      for (const [index, page] of pages.entries()) {
        const role = roles[index];
        await page.locator(".ballot-row, .crew-ballot").first().waitFor();
        if (await page.getByRole("heading", { name: "Find your crew", exact: true }).count()) {
          await page.getByRole("group", { name: "Your accomplice?" }).locator("button:not([disabled])").first().click();
          await page.getByRole("group", { name: "The decoy?" }).locator("button:not([disabled])").first().click();
        } else {
          await page.locator(".ballot-row:not([disabled])").first().click();
          if (role === "Detective")
            await page.getByRole("group", { name: "Who’s the accomplice?" }).locator("button:not([disabled])").last().click();
        }
        if (index === 0) await capture(page, `${size}-${role.toLowerCase()}-ballot`);
        await button(page, "Confirm vote").click();
        // The last ballot resolves the round, so that voter goes straight to their result.
        if (index < size - 1) await page.getByRole("heading", { name: "Your vote is locked", exact: true }).waitFor();
      }
      await Promise.all(pages.map((page) => page.locator(".personal-stage").waitFor({ timeout: 15000 })));
      await capture(pages.at(-1), `${size}-${roles.at(-1).toLowerCase()}-personal`);
      await button(hostTab, "See the room").click();
      await hostTab.locator(".everyone-results").waitFor({ timeout: 20000 });
      await capture(hostTab, `${size}-results`);
      const view = await call("state", { session_id: host.session_id });
      assert(view.phase === "results" && Object.keys(view.result.cast.roles).length === size, `Results at ${size}`);
      assert(view.result.cast.bait_decoy === (size < 5), `Bait flag at ${size}`);
      for (const context of contexts.splice(0)) await context.close();
    }
    return "Full Cast smoke passed at 3, 4 and 5 players";
  } catch (error) {
    // Leave every open tab on disk to show where the flow stopped.
    for (const [i, context] of contexts.entries())
      for (const page of context.pages()) await page.screenshot({ path: `output/playwright/full-cast-failure-${i}.png` }).catch(() => {});
    throw error;
  } finally {
    for (const context of contexts) await context.close();
  }
}
