// Plays one 6-player round in the browser and screenshots every screen the noir
// revamp touches, for comparison with design/app-revamp-v1. Run with the app
// preview on port 1428:
//   npx --package @playwright/cli playwright-cli -s=imposter open http://127.0.0.1:1428
//   npx --package @playwright/cli playwright-cli -s=imposter run-code --filename=scripts/revamp-capture.js
// Screenshots: output/playwright/revamp/<nn>-<screen>.png (390x844).
async function revampCapture(hostPage) {
  const origin = new URL(hostPage.url()).origin;
  const browser = hostPage.context().browser();
  const contexts = [];
  const out = "output/playwright/revamp";
  const button = (page, name) => page.getByRole("button", { name, exact: true });
  const heading = (page, name) => page.getByRole("heading", { name, exact: true });
  const call = async (method, body) => {
    const response = await hostPage.request.post(`${origin}/api/${method}`, { headers: { "X-Imposter-Dev": "1" }, data: body });
    const data = await response.json();
    if (!response.ok()) throw Error(data.error);
    return data;
  };
  const shots = [];
  const capture = async (page, name, wait = 700) => {
    await page.waitForTimeout(wait);
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    await page.screenshot({ path: `${out}/${name}.png` });
    shots.push(overflow ? `${name} (OVERFLOW)` : name);
  };
  const open = async (session, party) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto(origin);
    await button(page, "Host party").waitFor();
    if (!session) return page;
    await page.evaluate((data) => sessionStorage.setItem("imposter.session.v1", JSON.stringify(data)), session);
    await page.reload();
    await heading(page, party).waitFor();
    return page;
  };
  try {
    const welcome = await open(null);
    await capture(welcome, "01-welcome");
    await button(welcome, "How to play").click();
    await capture(welcome, "41-how-to");

    const party = "Friday night";
    const names = ["Alex", "Ben", "Cleo", "Dev", "Eve", "Kai"];
    const host = await call("create", { name: party, player: names[0], wifi: "Home Wi-Fi" });
    const sessions = [host];
    for (const name of names.slice(1))
      sessions.push(await call("join", { invitation: host.credentials.native_invitation, player: name }));
    const pages = [];
    for (const session of sessions) pages.push(await open(session, party));
    const [hostTab, guestTab] = pages;
    await Promise.all(pages.slice(1, 5).map((page) => button(page, "I’m ready").click()));
    await capture(hostTab, "04-host-lobby");
    await capture(guestTab, "09-guest-lobby");
    await button(pages[5], "I’m ready").click();
    await hostTab.getByRole("switch").first().click().catch(() => {});
    await button(hostTab, "Start round").click();

    // Rule reveal (random rules), then the topic vote.
    await hostTab.locator(".rule-shuffle").waitFor({ timeout: 8000 }).then(() => capture(hostTab, "10-rule-shuffle", 300)).catch(() => {});
    await hostTab.locator(".rule-card, .round-rule-card").first().waitFor({ timeout: 8000 }).then(() => capture(hostTab, "11-rule-reveal", 900)).catch(() => {});
    await heading(hostTab, "What should we play?").waitFor({ timeout: 15000 });
    const vote = (await call("state", { session_id: host.session_id })).topic_vote;
    const topic = (await call("catalog", {})).find((entry) => entry.id === vote.available_topics[0]).name;
    await button(guestTab, topic).click();
    await capture(guestTab, "12-topic-vote");
    await Promise.all(pages.map(async (page) => {
      if (page !== guestTab) await button(page, topic).click();
      await button(page, "Lock my vote").click();
    }));
    await hostTab.locator(".chosen-topic-card").waitFor({ timeout: 15000 }).then(() => capture(hostTab, "13-topic-chosen", 900)).catch(() => {});

    // Roles: the poster, the concealed card, the word or hint, then waiting.
    const roles = [];
    for (const [i, page] of pages.entries()) {
      await button(page, "Reveal my role").waitFor({ timeout: 15000 });
      if (i === 0) await capture(page, "17-concealed");
      await button(page, "Reveal my role").click();
      const role = (await page.locator(".role-stage-name").textContent()).trim();
      roles.push(role);
      if (role === "Judge" || role === "Imposter" || i === 0) await capture(page, `16-role-${role.toLowerCase()}`);
      await page.getByRole("button", { name: /^See my/ }).click();
      await page.locator(".role-title").waitFor();
      if (role === "Imposter") await capture(page, "19-hint");
      else if (!shots.some((s) => s.startsWith("18-word"))) await capture(page, "18-word");
      await button(page, "Hide & ready").click();
      if (i === 0) await capture(page, "20-ready-wait");
    }

    await capture(hostTab, "21-discussion");
    await hostTab.getByRole("button", { name: "Session settings" }).click();
    await capture(hostTab, "27-round-settings");
    await hostTab.keyboard.press("Escape");
    await hostTab.getByRole("button", { name: "Close" }).click().catch(() => {});
    await button(hostTab, "Open voting").click();

    for (const [index, page] of pages.entries()) {
      await page.locator(".ballot-row, .crew-ballot").first().waitFor();
      if (await heading(page, "Find your crew").count()) {
        await page.getByRole("group", { name: "Your accomplice?" }).locator("button:not([disabled])").first().click();
        await page.getByRole("group", { name: "The decoy?" }).locator("button:not([disabled])").first().click();
      } else {
        await page.locator(".ballot-row:not([disabled])").first().click();
        if (roles[index] === "Detective")
          await page.getByRole("group", { name: "Who’s the accomplice?" }).locator("button:not([disabled])").last().click();
      }
      if (index === 1) await capture(page, "28-ballot");
      await button(page, "Confirm vote").click();
      if (index < pages.length - 1) {
        await heading(page, "Your vote is locked").waitFor();
        if (index === 1) await capture(page, "29-locked");
      }
    }
    await Promise.all(pages.map((page) => page.locator(".personal-stage").waitFor({ timeout: 15000 })));
    await capture(hostTab, "30-personal", 200);
    await hostTab.locator(".everyone-results, .your-result").first().waitFor({ timeout: 15000 }).catch(() => {});
    await capture(hostTab, "31-your-result");
    await button(hostTab, "See the room").click().catch(() => {});
    await hostTab.locator(".everyone-results").waitFor({ timeout: 20000 });
    await capture(hostTab, "32-room");

    // A guest files a complaint, then Drink or Dare runs until the standings.
    await button(guestTab, "See the room").click().catch(() => {});
    await button(guestTab, "Report a rule violation").click();
    await guestTab.locator(".report-sheet-row").first().click();
    await capture(guestTab, "34-report");
    await guestTab.getByRole("button", { name: "Close report" }).click();
    await button(hostTab, "Continue").click();
    for (let turn = 0; turn < pages.length; turn++) {
      await hostTab.waitForTimeout(800);
      const loser = await (async () => {
        for (const page of pages) if (await button(page, "Drink").count()) return page;
        return null;
      })();
      if (!loser) break;
      if (turn === 0) {
        await capture(loser, "35-choose");
        await button(loser, "Dare").click();
        await loser.locator(".dare-pair").waitFor();
        await capture(loser, "36-dare-giver");
      } else {
        await button(loser, "Drink").click();
        if (turn === 1) await capture(loser, "35b-drink");
      }
      await button(loser, "Done").click();
    }
    await hostTab.locator(".standings").waitFor({ timeout: 15000 });
    await capture(hostTab, "37-standings");
    return shots;
  } catch (error) {
    for (const [i, context] of contexts.entries())
      for (const page of context.pages()) await page.screenshot({ path: `${out}/failure-${i}.png` }).catch(() => {});
    throw Error(`${error.message}\nCaptured so far: ${shots.join(", ")}`);
  } finally {
    for (const context of contexts) await context.close();
  }
}
