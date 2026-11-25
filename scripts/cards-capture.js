// Every power-card screen at 360 and 390 wide, with an automatic layout check
// on each: no page scrolls sideways, no sheet scrolls sideways, and no element
// sits past the screen edge (outside a scrolling row that is meant to).
// Run with the app preview and the debug dev bridge:
//   npx --package @playwright/cli playwright-cli -s=imposter open http://127.0.0.1:1428
//   npx --package @playwright/cli playwright-cli -s=imposter run-code --filename=scripts/cards-capture.js
// Screenshots: output/playwright/cards-<width>/*.png. Returns the problems found.
async function cardsCapture(hostPage) {
  const origin = new URL(hostPage.url()).origin;
  const browser = hostPage.context().browser();
  const problems = [];
  const button = (page, name) => page.getByRole("button", { name, exact: true });
  const call = async (method, body) => {
    const response = await hostPage.request.post(`${origin}/api/${method}`, { headers: { "X-Imposter-Dev": "1" }, data: body });
    const data = await response.json();
    if (!response.ok()) throw Error(data.error || JSON.stringify(data));
    return data;
  };
  let seq = 0;
  const act = async (session, kind, value) => {
    const view = await call("state", { session_id: session.session_id });
    return call("action", { session_id: session.session_id, action: { id: `cap-${Date.now()}-${seq++}`, round_id: view.round_id, kind, value } });
  };
  // Elements past the screen edge, ignoring rows that are meant to scroll.
  const check = (page) =>
    page.evaluate(() => {
      const out = [];
      const W = innerWidth;
      if (document.documentElement.scrollWidth > W + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${W})`);
      for (const s of document.querySelectorAll(".bottom-sheet"))
        if (s.scrollWidth > s.clientWidth + 1) out.push(`sheet scrolls sideways: .${[...s.classList].join(".")} (${s.scrollWidth} > ${s.clientWidth})`);
      const scroller = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === "auto" || o === "scroll") return true;
          if (p.classList.contains("fx-layer") || p.classList.contains("pc-stage") || p.classList.contains("pc-takeover")) return true;
        }
        return false;
      };
      for (const el of document.querySelectorAll("body *")) {
        if (el.closest(".fx-layer, .pc-rays, .pc-stage-glow, .pc-takeover-glow, script, style")) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.opacity === "0" || cs.display === "none") continue;
        if ((r.right > W + 2 || r.left < -2) && !scroller(el)) {
          const name = el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
          out.push(`${name} at ${Math.round(r.left)}..${Math.round(r.right)} "${(el.textContent || "").trim().slice(0, 30)}"`);
        }
      }
      return [...new Set(out)].slice(0, 12);
    });

  async function flow(width) {
    const out = `output/playwright/cards-${width}`;
    const contexts = [];
    const shot = async (page, name, wait = 700) => {
      await page.waitForTimeout(wait);
      await page.screenshot({ path: `${out}/${name}.png` });
      for (const p of await check(page)) problems.push(`${width} ${name}: ${p}`);
    };
    try {
      const names = ["Host", "Ben", "Cleo", "Dev", "Eve", "Kai", "Mia"];
      const host = await call("create", { name: "Capture", player: names[0], wifi: "Home Wi-Fi" });
      const sessions = [host];
      for (const n of names.slice(1)) sessions.push(await call("join", { invitation: host.credentials.native_invitation, player: n }));
      for (const s of sessions.slice(1)) await act(s, "ready", true);
      const pages = [];
      for (const s of sessions) {
        const context = await browser.newContext({ viewport: { width, height: 780 } });
        contexts.push(context);
        const page = await context.newPage();
        await page.goto(origin);
        await button(page, "Host party").waitFor();
        await page.evaluate((d) => sessionStorage.setItem("imposter.session.v1", JSON.stringify(d)), s);
        await page.reload();
        await page.getByRole("heading", { name: "Capture", exact: true }).waitFor();
        pages.push(page);
      }
      const [hostTab] = pages;
      await hostTab.getByRole("switch", { name: "Power cards" }).click();
      await act(host, "dev_cards", { points: 6 });
      await shot(hostTab, "01-lobby");
      await button(hostTab, "Start round").click();
      await hostTab.getByRole("heading", { name: "What should we play?", exact: true }).waitFor({ timeout: 15000 });
      const vote = (await call("state", { session_id: host.session_id })).topic_vote;
      const topic = (await call("catalog", {})).find((e) => e.id === vote.available_topics[0]).name;
      await Promise.all(pages.map(async (p) => {
        await button(p, topic).click();
        await button(p, "Lock my vote").click();
      }));
      await Promise.all(pages.map((p) => p.getByRole("heading", { name: "Draw a power card?" }).waitFor({ timeout: 15000 })));
      await shot(hostTab, "02-draw-offer");
      // The host draws and lingers; Ben skips and waits; others skip later.
      await button(hostTab, "Draw · 3 points").click();
      await hostTab.locator(".pc-hint").waitFor({ timeout: 10000 });
      await shot(hostTab, "03-sealed", 400);
      await button(pages[1], "Skip").click();
      await shot(pages[1], "04-draw-wait");
      for (const p of pages.slice(2)) await button(p, "Skip").click();
      await hostTab.getByRole("button", { name: "Tap the card to reveal it" }).click({ force: true });
      await button(hostTab, "Add to my case file").waitFor({ timeout: 10000 });
      await shot(hostTab, "05-revealed");
      // Roles are dealt while the host is still on the card.
      await pages[1].getByRole("button", { name: "Reveal my role" }).waitFor({ timeout: 15000 });
      await shot(pages[1], "06-roles-while-host-reads");
      await button(hostTab, "Add to my case file").click();
      await hostTab.getByRole("button", { name: "Reveal my role" }).waitFor({ timeout: 15000 });

      const views = await Promise.all(sessions.map((s) => call("state", { session_id: s.session_id })));
      const imp = views.findIndex((v) => v.private_role?.imposter);
      const others = [0, 1, 2, 3, 4, 5, 6].filter((i) => i !== imp && views[i].private_role?.role !== "accomplice");
      const [a, b, c, d, e] = others;
      const id = (i) => views[i].my_id;
      await act(host, "dev_cards", {
        give: {
          [id(a)]: ["late-arrival", "jackpot", "safety-net"],
          [id(b)]: ["cover-story", "objection"],
          [id(c)]: ["x-ray", "anonymous-tip"],
          [id(d)]: ["cold-feet", "pocket-veto"],
          [id(e)]: ["spotlight", "on-the-record"],
          [id(imp)]: ["last-word"],
        },
      });
      const passRole = async (p) => {
        await button(p, "Reveal my role").click();
        await p.getByRole("button", { name: /^See my/ }).click();
        await p.locator(".role-title").waitFor();
        await button(p, "Hide & ready").click();
      };
      // Role reveal window: the hand, detail and confirm for Late Arrival.
      await passRole(pages[a]);
      await pages[a].getByRole("button", { name: /You can play a card now/ }).click();
      await shot(pages[a], "07-hand-sheet");
      await pages[a].getByRole("img", { name: "Late Arrival, common" }).click();
      await shot(pages[a], "08-card-detail");
      await button(pages[a], "Play").click();
      await shot(pages[a], "09-confirm");
      await button(pages[a], "Play card").click();
      await shot(pages[(a + 1) % 7], "10-banner", 500);
      for (const [i, p] of pages.entries()) if (i !== a) await passRole(p);
      await hostTab.getByRole("heading", { name: /Who sounds/ }).waitFor({ timeout: 15000 });

      // Discussion: Cover Story (role pick), X-Ray (player pick + private read), Objection, Spotlight.
      const play = async (i, cardName, pick, extra) => {
        const p = pages[i];
        await p.getByRole("button", { name: /You can play a card now/ }).click();
        await p.getByRole("img", { name: cardName }).click();
        await button(p, "Play").click();
        if (pick) await p.locator(".pc-pick-list button").filter({ hasText: pick }).first().click();
        if (extra) await extra(p);
        await button(p, "Play card").click();
        await p.waitForTimeout(900);
      };
      await pages[b].getByRole("button", { name: /You can play a card now/ }).click();
      await pages[b].getByRole("img", { name: "Cover Story, common" }).click();
      await button(pages[b], "Play").click();
      await shot(pages[b], "11-pick-role");
      await pages[b].locator(".pc-pick-list button").filter({ hasText: "Detective" }).click();
      await button(pages[b], "Play card").click();
      await pages[b].waitForTimeout(900);
      await play(c, "X-Ray, golden", names[imp]);
      await shot(pages[c], "12-private-read", 4200);
      await shot(pages[e], "13-golden-takeover", 600);
      await pages[e].waitForTimeout(3200);
      await play(e, "Spotlight, golden", names[b]);
      await pages[e].waitForTimeout(3200);
      await pages[a].waitForTimeout(500);
      await shot(hostTab, "14-discussion-notes", 3000);
      await button(hostTab, "Open voting").click();

      // Ballot: Pocket Veto with a pick; Cold Feet then a bet change.
      const ballot = async (i, target) => {
        const p = pages[i];
        await p.locator(".ballot-row, .crew-ballot").first().waitFor();
        if (await p.getByRole("heading", { name: "Find your crew", exact: true }).count()) {
          await p.getByRole("group", { name: "Your accomplice?" }).locator("button:not([disabled])").first().click();
          await p.getByRole("group", { name: "The decoy?" }).locator("button:not([disabled])").nth(1).click();
        } else {
          await p.locator(".ballot-row").filter({ hasText: target }).click();
          if (views[i].private_role?.role === "detective") await p.getByRole("group", { name: "Who’s the accomplice?" }).locator("button:not([disabled])").last().click();
        }
      };
      await ballot(d, names[imp]);
      await pages[d].getByRole("button", { name: /^Bet 1 point/ }).click();
      await pages[d].locator(".pc-ballot-slot").getByRole("img", { name: "Cold Feet, common" }).click();
      await pages[d].locator(".pc-ballot-slot").scrollIntoViewIfNeeded();
      await shot(pages[d], "15-ballot-card");
      await pages[d].getByRole("button", { name: /^(Lock vote|Confirm vote)/ }).click();
      await pages[d].getByRole("group", { name: /Cold Feet/ }).waitFor();
      await shot(pages[d], "16-locked-cold-feet");
      for (const [i, p] of pages.entries()) {
        if (i === d) continue;
        await ballot(i, names[imp]);
        await p.getByRole("button", { name: /^(Lock vote|Confirm vote)/ }).click();
      }
      await pages[imp].getByRole("heading", { name: "Caught. Name the real word." }).waitFor({ timeout: 15000 });
      await shot(pages[imp], "17-last-word");
      await shot(pages[a], "18-last-word-waiting", 200);
      const word = views.find((v) => v.private_role && !v.private_role.imposter && v.private_role.role !== "decoy").private_role.clue;
      await button(pages[imp], word).click();
      await pages[a].locator(".personal-result").waitFor({ timeout: 20000 });
      await shot(pages[a], "19-your-result");
      await button(pages[a], "See the room").click();
      await pages[a].locator(".pc-replay").waitFor();
      await pages[a].waitForTimeout(6000);
      await pages[a].locator(".pc-replay").scrollIntoViewIfNeeded();
      await shot(pages[a], "20-cards-this-round", 300);
      await button(hostTab, "See the room").click({ timeout: 4000 }).catch(() => {});
      await button(hostTab, "Continue").click();
      for (let t = 0; t < 7; t++) {
        await hostTab.waitForTimeout(700);
        let loser = null;
        for (const p of pages) if (await button(p, "Drink").count()) loser = p;
        if (!loser) break;
        await button(loser, "Drink").click();
        await button(loser, "Done").click();
      }
      await hostTab.locator(".standings").waitFor({ timeout: 15000 });
      await shot(hostTab, "21-standings", 1200);
      await button(hostTab, "End party").click();
      await hostTab.getByRole("button", { name: "End party", exact: true }).last().click();
      await button(hostTab, "Story of the night").click();
      await shot(hostTab, "22-story");
    } finally {
      for (const ctx of contexts) await ctx.close();
    }
  }
  await flow(360);
  await flow(390);
  return { problems };
}
