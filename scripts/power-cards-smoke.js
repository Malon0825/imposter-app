// Power cards in the browser with six phones: the host's switch, the draw
// window (draw, sealed, reveal, skip), a role-reveal card (Late Arrival), a
// discussion card (Anonymous Tip, published when voting opens), a ballot
// card (Cold Feet, then changing the bet), and a caught Imposter's Last Word.
// Needs a debug build of the dev bridge (it uses the `dev_cards` action).
//   npx --package @playwright/cli playwright-cli -s=imposter open http://127.0.0.1:1428
//   npx --package @playwright/cli playwright-cli -s=imposter run-code --filename=scripts/power-cards-smoke.js
// Screenshots: output/playwright/power-cards/*.png
async function powerCardsSmoke(hostPage) {
  const origin = new URL(hostPage.url()).origin;
  const browser = hostPage.context().browser();
  const contexts = [];
  const out = "output/playwright/power-cards";
  const checks = [];
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const button = (page, name) => page.getByRole("button", { name, exact: true });
  const call = async (method, body) => {
    const response = await hostPage.request.post(`${origin}/api/${method}`, { headers: { "X-Imposter-Dev": "1" }, data: body });
    const data = await response.json();
    if (!response.ok()) throw Error(data.error || JSON.stringify(data));
    return data;
  };
  let seq = 0;
  const hostAct = async (session, kind, value) => {
    const view = await call("state", { session_id: session.session_id });
    return call("action", { session_id: session.session_id, action: { id: `smoke-${Date.now()}-${seq++}`, round_id: view.round_id, kind, value } });
  };
  const capture = async (page, name) => {
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert(!overflow, `${name} scrolls sideways`);
    await page.screenshot({ path: `${out}/${name}.png` });
  };
  try {
    const party = "Card night";
    const names = ["Alex", "Ben", "Cleo", "Dev", "Eve", "Kai"];
    const host = await call("create", { name: party, player: names[0], wifi: "Home Wi-Fi" });
    const sessions = [host];
    for (const name of names.slice(1)) sessions.push(await call("join", { invitation: host.credentials.native_invitation, player: name }));
    const pages = [];
    for (const session of sessions) {
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

    // The host turns power cards on from the lobby.
    await hostTab.getByRole("switch", { name: "Power cards" }).click();
    await hostTab.getByRole("switch", { name: "Power cards", checked: true }).waitFor();
    checks.push("host switch");
    await hostAct(host, "dev_cards", { points: 5 });
    await button(hostTab, "Start round").click();

    // Topic vote, then the draw window on every phone.
    await hostTab.getByRole("heading", { name: "What should we play?", exact: true }).waitFor({ timeout: 15000 });
    const vote = (await call("state", { session_id: host.session_id })).topic_vote;
    const topic = (await call("catalog", {})).find((entry) => entry.id === vote.available_topics[0]).name;
    await Promise.all(pages.map(async (page) => {
      await button(page, topic).click();
      await button(page, "Lock my vote").click();
    }));
    await Promise.all(pages.map((page) => page.getByRole("heading", { name: "Draw a power card?" }).waitFor({ timeout: 15000 })));
    await capture(hostTab, "01-draw-window");
    await button(hostTab, "Draw · 3 points").click();
    // The card spins out, lands, ignites and idles sealed before it can be tapped.
    await hostTab.locator(".pc-hint").waitFor({ timeout: 10000 });
    await capture(hostTab, "02-sealed");
    // The sealed card idles (spins and floats), so it is never "stable" to Playwright.
    await hostTab.getByRole("button", { name: "Tap the card to reveal it" }).click({ force: true });
    await button(hostTab, "Add to my case file").waitFor({ timeout: 10000 });
    await capture(hostTab, "03-revealed");
    await button(hostTab, "Add to my case file").click();
    for (const page of pages.slice(1)) await button(page, "Skip").click();
    checks.push("draw, sealed reveal, skip");

    // Roles are dealt. Deal named cards to three civilians and Last Word to the Imposter.
    await Promise.all(pages.map((page) => button(page, "Reveal my role").waitFor({ timeout: 20000 })));
    const views = await Promise.all(sessions.map((s) => call("state", { session_id: s.session_id })));
    const imposterIndex = views.findIndex((v) => v.private_role?.imposter);
    const civilians = [0, 1, 2, 3, 4, 5].filter((i) => i !== imposterIndex && views[i].private_role?.role !== "accomplice");
    const [spotIdx, lateIdx, tipIdx, coldIdx] = civilians.slice(0, 4);
    // The real word, from someone who holds it (the Decoy's card shows a cousin word).
    const word = views.find((v) => v.private_role && !v.private_role.imposter && v.private_role.role !== "decoy").private_role.clue;
    const idOf = (i) => views[i].my_id;
    const imposterId = idOf(imposterIndex);
    await hostAct(host, "dev_cards", {
      give: {
        [idOf(lateIdx)]: ["late-arrival"],
        [idOf(tipIdx)]: ["anonymous-tip"],
        [idOf(coldIdx)]: ["cold-feet"],
        [idOf(spotIdx)]: ["spotlight"],
        [imposterId]: ["last-word"],
      },
    });

    // Role reveal window: Late Arrival, played from the nudge after checking the role.
    const passRole = async (page) => {
      await button(page, "Reveal my role").click();
      await page.getByRole("button", { name: /^See my/ }).click();
      await page.locator(".role-title").waitFor();
      await button(page, "Hide & ready").click();
    };
    const late = pages[lateIdx];
    await passRole(late);
    await late.getByRole("button", { name: /You can play a card now/ }).click();
    await late.getByRole("img", { name: "Late Arrival, common" }).click();
    await capture(late, "04-card-detail");
    await button(late, "Play").click();
    await capture(late, "05-confirm");
    await button(late, "Play card").click();
    // Every phone gets the banner.
    const watcher = pages[(lateIdx + 1) % pages.length];
    await watcher.locator(".pc-banner").waitFor({ timeout: 5000 });
    await capture(watcher, "11-banner");
    checks.push("role-reveal card", "play banner");
    for (const [i, page] of pages.entries()) if (i !== lateIdx) await passRole(page);

    // Discussion window: the Anonymous Tip, which shows only once voting opens.
    await hostTab.getByRole("heading", { name: /Who sounds/ }).waitFor({ timeout: 15000 });
    assert((await hostTab.locator(".pc-plays li").count()) === 1, "the Late Arrival play is on the strip");
    const order = (await call("state", { session_id: host.session_id })).speaking_order;
    assert(order.at(-1) === idOf(lateIdx), "Late Arrival speaks last");
    const tip = pages[tipIdx];
    await tip.getByRole("button", { name: /You can play a card now/ }).click();
    await tip.getByRole("img", { name: "Anonymous Tip, common" }).click();
    await button(tip, "Play").click();
    await tip.locator(".pc-pick-list button").filter({ hasText: names[imposterIndex] }).click();
    await button(tip, "Play card").click();
    await tip.waitForTimeout(400);
    assert((await hostTab.getByText("Someone suspects").count()) === 0, "the tip waits for the vote");
    await capture(hostTab, "06-discussion");
    checks.push("discussion card");
    // A Golden play takes over every phone.
    const spot = pages[spotIdx];
    const spotWatcher = pages[spotIdx === 0 ? 1 : 0];
    await spot.getByRole("button", { name: /You can play a card now/ }).click();
    await spot.getByRole("img", { name: "Spotlight, golden" }).click();
    await button(spot, "Play").click();
    await spot.locator(".pc-pick-list button").filter({ hasText: names[tipIdx] }).click();
    await button(spot, "Play card").click();
    await spotWatcher.locator(".pc-takeover").waitFor({ timeout: 5000 });
    await spotWatcher.waitForTimeout(400);
    await spotWatcher.screenshot({ path: `${out}/12-golden-takeover.png` });
    await spotWatcher.locator(".pc-takeover").waitFor({ state: "detached", timeout: 6000 });
    assert((await spotWatcher.getByText(/is on the (civilian|Imposter’s) side/).count()) === 1, "Spotlight is public");
    checks.push("golden takeover");
    await button(hostTab, "Open voting").click();

    // Ballot window: Cold Feet rides with the vote, then the bet changes once.
    const cold = pages[coldIdx];
    await cold.locator(".ballot-row").filter({ hasText: names[imposterIndex] }).click();
    if (views[coldIdx].private_role?.role === "detective")
      await cold.getByRole("group", { name: "Who’s the accomplice?" }).locator("button:not([disabled])").last().click();
    await cold.getByRole("button", { name: /^Bet 1 point/ }).click();
    await cold.locator(".pc-ballot-slot").getByRole("img", { name: "Cold Feet, common" }).click();
    // Tapping a ballot card opens its details; choose it from there.
    await cold.getByRole("button", { name: "Use it with my vote" }).click();
    await capture(cold, "07-ballot-card");
    await cold.getByRole("button", { name: /^(Lock vote|Confirm vote)/ }).click();
    await cold.getByRole("group", { name: /Cold Feet/ }).waitFor();
    await cold.getByRole("group", { name: /Cold Feet/ }).getByRole("button", { name: "2", exact: true }).click();
    await cold.waitForTimeout(500);
    assert((await call("state", { session_id: sessions[coldIdx].session_id })).betting.my_stake === 2, "Cold Feet changed the bet");
    await capture(cold, "08-cold-feet");
    assert((await cold.getByText("Someone suspects").count()) === 1, "the tip shows once voting opens");
    checks.push("ballot card and Cold Feet");

    // Everyone else names the Imposter; the Imposter names a civilian. Last Word fires.
    for (const [i, page] of pages.entries()) {
      if (i === coldIdx) continue;
      const v = views[i];
      await page.locator(".ballot-row, .crew-ballot").first().waitFor();
      if (await page.getByRole("heading", { name: "Find your crew", exact: true }).count()) {
        await page.getByRole("group", { name: "Your accomplice?" }).locator("button:not([disabled])").first().click();
        await page.getByRole("group", { name: "The decoy?" }).locator("button:not([disabled])").nth(1).click();
      } else {
        await page.locator(".ballot-row").filter({ hasText: names[imposterIndex] }).click();
        if (v.private_role?.role === "detective")
          await page.getByRole("group", { name: "Who’s the accomplice?" }).locator("button:not([disabled])").last().click();
      }
      await page.getByRole("button", { name: /^(Lock vote|Confirm vote)/ }).click();
    }
    const imp = pages[imposterIndex];
    await imp.getByRole("heading", { name: "Caught. Name the real word." }).waitFor({ timeout: 15000 });
    await capture(imp, "09-last-word");
    await button(imp, word).click();
    await Promise.all(pages.map((page) => page.locator(".personal-stage").waitFor({ timeout: 20000 })));
    const settled = await call("state", { session_id: sessions[imposterIndex].session_id });
    await imp.locator(".personal-result, .everyone-results").first().waitFor({ timeout: 20000 });
    const result = await call("state", { session_id: sessions[imposterIndex].session_id });
    assert(result.result.score.base > 0, "a right Last Word scores the Imposter as escaped");
    checks.push("Last Word");
    await capture(imp, "10-imposter-result");
    void settled;

    // The room: the round's cards turned face up.
    await button(hostTab, "See the room").click();
    await hostTab.locator(".pc-replay li").first().waitFor({ timeout: 10000 });
    assert((await hostTab.locator(".pc-replay li").count()) === 4, "four cards in the replay");
    await hostTab.waitForTimeout(3000);
    await hostTab.locator(".pc-replay").scrollIntoViewIfNeeded();
    await hostTab.screenshot({ path: `${out}/13-cards-this-round.png` });
    checks.push("cards this round");

    // Drink or Dare, then the standings with the Wanted poster.
    await button(hostTab, "Continue").click();
    for (let turn = 0; turn < pages.length; turn++) {
      await hostTab.waitForTimeout(700);
      let loser = null;
      for (const page of pages) if (await button(page, "Drink").count()) loser = page;
      if (!loser) break;
      await button(loser, "Drink").click();
      await button(loser, "Done").click();
    }
    await hostTab.locator(".standings").waitFor({ timeout: 15000 });
    await capture(hostTab, "14-standings");
    assert((await hostTab.locator(".pc-wanted").count()) === 1, "the leader is on a Wanted poster");
    checks.push("standings");

    // End the party: the Story of the night.
    await button(hostTab, "End party").click();
    await hostTab.getByRole("button", { name: "End party", exact: true }).last().click();
    await button(hostTab, "Story of the night").click();
    await hostTab.locator(".pc-story").waitFor();
    await capture(hostTab, "15-story");
    assert((await hostTab.getByText("Golden moments").count()) === 1, "the story has the Golden moment");
    checks.push("story of the night");
    return { passed: true, checks };
  } catch (error) {
    for (const [i, context] of contexts.entries())
      for (const page of context.pages()) await page.screenshot({ path: `${out}/failure-${i}.png` }).catch(() => {});
    throw Error(`${error.message}\nPassed so far: ${checks.join(", ")}`);
  } finally {
    for (const context of contexts) await context.close();
  }
}
