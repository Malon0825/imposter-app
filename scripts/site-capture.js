// The website's app tour (docs/screens): plays one 6-player round with random
// rules and screenshots each screen the site shows, under the site's own file
// names, at 390x844. Power-card screens come from scripts/cards-capture.js and
// the setup screens from scripts/visual-capture.js; scripts/site-screens.py
// turns all of them into docs/screens/*.webp. Run with the app preview:
//   npx --package @playwright/cli playwright-cli -s=imposter open http://127.0.0.1:1428
//   npx --package @playwright/cli playwright-cli -s=imposter run-code --filename=scripts/site-capture.js
async function siteCapture(hostPage) {
  const origin = new URL(hostPage.url()).origin;
  const browser = hostPage.context().browser();
  const contexts = [];
  const out = "output/playwright/site";
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
    await button(pages[5], "I’m ready").click();
    await capture(hostTab, "cast-lobby");
    await hostTab.getByRole("switch", { name: "Random rules" }).click().catch(() => {});
    await button(hostTab, "Start round").click();

    // Rule reveal (random rules), then the topic vote.
    await hostTab.locator(".rule-shuffle").waitFor({ timeout: 8000 }).then(() => capture(hostTab, "rule-shuffle", 300)).catch(() => {});
    await hostTab.locator(".rule-card, .round-rule-card").first().waitFor({ timeout: 8000 }).then(() => capture(hostTab, "rule-revealed", 900)).catch(() => {});
    await heading(hostTab, "What should we play?").waitFor({ timeout: 15000 });
    const vote = (await call("state", { session_id: host.session_id })).topic_vote;
    const topic = (await call("catalog", {})).find((entry) => entry.id === vote.available_topics[0]).name;
    await button(guestTab, topic).click();
    await capture(guestTab, "round-topic-vote");
    await Promise.all(pages.map(async (page) => {
      if (page !== guestTab) await button(page, topic).click();
      await button(page, "Lock my vote").click();
    }));
    await hostTab.locator(".chosen-topic-card").waitFor({ timeout: 15000 }).then(() => capture(hostTab, "round-topic-chosen", 900)).catch(() => {});

    // Roles: the poster, the concealed card, the word or hint, then waiting.
    const roles = [];
    for (const [i, page] of pages.entries()) {
      await button(page, "Reveal my role").waitFor({ timeout: 15000 });
      if (i === 0) await capture(page, "round-concealed");
      await button(page, "Reveal my role").click();
      const role = (await page.locator(".role-stage-name").textContent()).trim();
      roles.push(role);
      await capture(page, `cast-${role.toLowerCase()}`, 1200);
      await page.getByRole("button", { name: /^See my/ }).click();
      await page.locator(".role-title").waitFor();
      if (role === "Imposter") await capture(page, "round-imposter-card", 1000);
      if (role === "Detective") await capture(page, "round-detective-card", 1000);
      await button(page, "Hide & ready").click();
    }

    await capture(hostTab, "round-clue-board");
    await hostTab.getByRole("button", { name: "Session settings" }).click();
    await capture(hostTab, "round-settings");
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
      if (roles[index] === "Judge") await capture(page, "round-ballot");
      await button(page, "Confirm vote").click();
      if (index < pages.length - 1) {
        await heading(page, "Your vote is locked").waitFor();
      }
    }
    await Promise.all(pages.map((page) => page.locator(".personal-stage").waitFor({ timeout: 15000 })));
    await hostTab.locator(".everyone-results, .your-result").first().waitFor({ timeout: 15000 }).catch(() => {});
    await capture(hostTab, "round-your-result");
    await button(hostTab, "See the room").click().catch(() => {});
    await hostTab.locator(".everyone-results").waitFor({ timeout: 20000 });
    await capture(hostTab, "round-the-room");

    // A guest files a complaint, then Drink or Dare runs until the standings.
    await button(guestTab, "See the room").click().catch(() => {});
    await button(guestTab, "Report a rule violation").click();
    await guestTab.locator(".report-sheet-row").first().click();
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
        await capture(loser, "turn-loser");
        await button(loser, "Dare").click();
        await loser.locator(".dare-pair").waitFor();
        await capture(loser, "turn-dare-giver");
      } else {
        await button(loser, "Drink").click();
      }
      await button(loser, "Done").click();
    }
    await hostTab.locator(".standings").waitFor({ timeout: 15000 });
    await capture(hostTab, "turn-standings");
    return shots;
  } catch (error) {
    for (const [i, context] of contexts.entries())
      for (const page of context.pages()) await page.screenshot({ path: `${out}/failure-${i}.png` }).catch(() => {});
    throw Error(`${error.message}\nCaptured so far: ${shots.join(", ")}`);
  } finally {
    for (const context of contexts) await context.close();
  }
}
