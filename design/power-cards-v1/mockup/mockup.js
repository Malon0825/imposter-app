// Power cards mockups. Each screen is a function returning the inside of a 390×844 phone.
// ?s=N renders one screen; ?demo=draw|golden|replay renders a motion demo; no query renders the gallery.

// Card art lives in design/power-cards-v1/art; pages elsewhere set window.ART_BASE to reach it.
const AB = window.ART_BASE || "../art/";
const P = (d, cls = "") => `<svg viewBox="0 0 24 24" class="${cls}"><path d="${d}"/></svg>`;
const I = {
  back: "m14 5-7 7 7 7M7 12h14",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  qr: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2",
  chat: "M20 10a8 7 0 0 1-8 7H9l-5 4 1-7a7 7 0 0 1-1-4 8 7 0 0 1 16 0Z",
  ballot: "M4 8h16v12H4zM4 8l3-5h10l3 5M9 13l2 2 4-4",
  reveal: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  auto: "m12 2 2 7 8 3-8 3-2 7-3-7-7-3 7-3 3-7Z",
  lock: "M6 10h12v11H6zM8 10V7a4 4 0 0 1 8 0v3",
  crown: "m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z",
  check: "m5 12 4 4L19 6",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 11v6M12 7h.01",
  target: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 11a1 1 0 1 0 0 2",
  // card glyphs
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 3",
  key: "M8 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8ZM12 12h9M18 12v3M21 12v2",
  weight: "M4 20h16l-3-10H7L4 20ZM9 10a3 3 0 1 1 6 0",
  coins: "M12 4c4 0 7 1 7 2.5S16 9 12 9 5 8 5 6.5 8 4 12 4ZM5 6.5v4C5 12 8 13 12 13s7-1 7-2.5v-4M5 10.5v4C5 16 8 17 12 17s7-1 7-2.5v-4",
  lens: "M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM14.5 14.5 20 20",
  mask: "M3 7c3-2 6-2 9 0 3-2 6-2 9 0 0 6-3 10-9 10S3 13 3 7ZM7 10l2 1M17 10l-2 1",
  midas: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 6v12M15 9c0-1.2-1.3-2-3-2s-3 .8-3 2 1.3 1.8 3 2.3 3 1 3 2.3-1.3 2-3 2-3-.8-3-2",
  tip: "M20 10a8 7 0 0 1-8 7H9l-5 4 1-7a7 7 0 0 1-1-4 8 7 0 0 1 16 0ZM10 8.5a2 2 0 1 1 2.5 2c-.5.2-.5.6-.5 1M12 14h.01",
};
const W = { reveal: ["reveal", "Role reveal"], disc: ["chat", "Discussion"], ballot: ["ballot", "Ballot"], passive: ["auto", "Passive"] };

const EYE = `<span class="eye"><svg viewBox="0 0 48 24"><path d="M2 12s8-10 22-10 22 10 22 10-8 10-22 10S2 12 2 12Z"/><circle cx="24" cy="12" r="6"/><circle cx="24" cy="12" r="2" fill="currentColor"/></svg></span>`;

function card({ tier = "common", name, fx = "", win = "disc", glyph = "clock", size = "", now = false, state = "", golden = false, type = "Active" }) {
  const [wi, wl] = W[win];
  const slug = name.toLowerCase().replace(/[^a-z]+/g, "-");
  // Golden art comes from Astra (design/power-cards-v1/art/golden-<name>.png); until then the glyph shows.
  // Common and Rare art: art/common-<name>.png, art/rare-<name>.png; the line glyph shows until it exists.
  const art = tier === "golden"
    ? `<span class="emblem">${P(I[glyph])}<img src="${AB}golden-${slug}.png" alt="" onerror="this.remove()"></span>`
    : `<span class="plate">${P(I[glyph])}<img src="${AB}${tier}-${slug}.png" alt="" onerror="this.remove()"></span>`;
  return `<div class="card ${tier} ${size} ${state}">
    <div class="face">
      <div class="top"><span class="win ${now ? "now" : ""}">${P(I[wi])}${now ? "Play now" : wl}</span><span class="tier">${tier}</span></div>
      <div class="art">${art}</div>
      <div class="nm">${name}</div>
      <div class="fx">${fx}</div>
      <div class="ft"><span>${type}</span><span>${wl}</span></div>
    </div></div>`;
}
const back = (size = "", t = "") => `<div class="card back ${size} ${t ? "t-" + t : ""}">${EYE}</div>`;
const av = (n, c = "", s = "") => `<span class="av ${c} ${s}">${n}</span>`;

function hdr(title, { hand = 0, live = false, icons = ["eye", "qr"] } = {}) {
  const handBtn = hand ? `<span class="ico hand-btn ${live ? "live" : ""}"><span class="fan"><i></i><i></i><i></i></span><span class="badge">${hand}</span></span>` : "";
  return `<div class="hdr ${hand ? "two" : ""}"><span class="ico">${P(I.back)}</span><span class="title">${title}</span>${handBtn}${icons.map((i) => `<span class="ico">${P(I[i])}</span>`).join("")}</div>`;
}

function plays(list) {
  return `<div class="plays"><span class="lbl">Plays</span>${list
    .map(([n, t, c, isNew]) => `<span class="play ${isNew ? "new" : ""}">${av(n, c, "xs")}${back("chip", t)}</span>`)
    .join("")}</div>`;
}

// ---------------------------------------------------------------- screens
const S = {};

S[1] = {
  name: "01-draw-window",
  title: "Draw window",
  note: "New 10-second phase after the topic is chosen. Price shows Free for an Underdog. Golden chance is private to this phone. The table strip is public: everyone sees who draws.",
  html: () => `${hdr("Round 5 · Draw", { hand: 2, icons: ["qr"] })}
  <div class="content">
    <div style="display:flex;align-items:center;gap:14px;margin-top:2px">
      <div style="flex:1"><h1>Draw a power card?</h1><p class="sub">Roles are dealt when the timer ends.</p></div>
      <div class="ring"><svg viewBox="0 0 64 64"><circle class="bgc" cx="32" cy="32" r="28"/><circle class="fgc" cx="32" cy="32" r="28" stroke-dasharray="176" stroke-dashoffset="53"/></svg><b>7</b></div>
    </div>
    <div style="position:relative;height:248px;margin:10px 0 6px;display:grid;place-items:center">
      <div class="glow" style="width:300px;height:300px;background:radial-gradient(circle,rgba(214,245,107,.12),transparent 65%)"></div>
      <div style="position:relative;width:150px;height:210px">
        <div style="position:absolute;left:-26px;top:10px;transform:rotate(-12deg)">${back("mid")}</div>
        <div style="position:absolute;left:26px;top:10px;transform:rotate(12deg)">${back("mid")}</div>
        <div style="position:absolute;left:0;top:0">${back("mid")}</div>
      </div>
    </div>
    <div class="panel" style="padding:4px 16px">
      <div class="row" style="padding:11px 0"><span class="grow small" style="font-size:15px">Price</span><span class="pill lime">Free · Underdog</span></div>
      <div class="row" style="padding:11px 0"><span class="grow small" style="font-size:15px">Golden chance</span><span class="pill gold">${P(I.auto)}14%</span></div>
      <div class="row" style="padding:11px 0;border-bottom:0"><span class="grow small" style="font-size:15px">Paid draws left</span><b style="font-size:16px">3 of 4</b></div>
    </div>
    <div style="margin-top:14px">
      <div class="type" style="color:var(--kraft-dk);font-size:13px;margin-bottom:8px">AT THE TABLE</div>
      <div style="display:flex;justify-content:space-between">
        ${[["MA", "Drew", 1], ["BE", "", 0], ["CL", "Skip", 0], ["KA", "Drew", 1], ["EV", "", 0]]
          .map(([n, s, d]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:58px">${av(n, "", "sm")}<span style="display:flex;align-items:center;gap:4px;height:22px">${d ? back("chip").replace('class="card back', 'style="--w:16px" class="card back') : ""}<span class="small" style="font-size:12px;font-weight:700;color:${s === "Drew" ? "var(--ink)" : "var(--dim)"}">${s || "…"}</span></span></div>`)
          .join("")}
      </div>
    </div>
  </div>
  <div class="bottom"><div class="btn primary">Draw<span class="meta">· Free</span></div><div class="btn secondary small">Skip</div></div>`,
};

S[2] = {
  name: "02-draw-sealed-golden",
  title: "Draw, step 1: the sealed card",
  note: "The draw lands sealed. Only the tier shows (frame colour, Golden slam, rays), so a Golden drawer can hold the phone up to the table without giving away which Golden it is. A second tap reveals the card. Sealed cards can also go straight to the case file and be revealed later.",
  html: () => `${hdr("Round 5 · Draw", { hand: 2, icons: ["qr"] })}
  <div class="content" style="position:relative;align-items:center">
    <div class="rays" style="top:356px"></div><div class="glow" style="top:356px"></div>
    <div style="position:relative;text-align:center;margin-top:4px">
      <div class="type" style="font-size:13px;color:var(--kraft-dk)">YOU DREW A</div>
      <div class="anton" style="font-size:64px;line-height:1;background:linear-gradient(180deg,var(--gold-hi),var(--gold) 60%,var(--gold-lo));-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 0 18px rgba(233,196,106,.45))">Golden</div>
    </div>
    <div style="position:relative;margin-top:12px">${seal("golden")}</div>
    <div style="position:relative;margin-top:20px;display:flex;align-items:center;gap:8px;color:var(--gold-hi);font-weight:700;font-size:17px">
      <span style="width:10px;height:10px;border-radius:50%;background:var(--gold);box-shadow:0 0 10px var(--gold)"></span>Tap the card to reveal it
    </div>
    <p class="type center" style="position:relative;margin:10px 0 0;font-size:12px;color:var(--kraft-dk);line-height:1.5">SHOW IT OFF. NOBODY CAN TELL WHICH GOLDEN IT IS.</p>
  </div>
  <div class="bottom"><div class="btn secondary small">Keep it sealed</div><div class="small center">Sealed cards wait in your case file · Roles in 6 s</div></div>`,
};

S[3] = {
  name: "03-discussion-hand-plays",
  title: "Discussion with hand + Plays",
  note: "The hand lives behind one header button (fan + count). When a held card's window opens it gets a lime ring and a one-line nudge. The Plays strip is the round's log: who played, which tier, never which card. Public effects get a discussion card.",
  html: () => `${hdr("Round 5 · Turn 1", { hand: 3, live: true })}
  <div class="content">
    <div style="display:flex;align-items:center;gap:10px;background:rgba(214,245,107,.1);border:1px solid rgba(214,245,107,.45);border-radius:14px;padding:9px 12px;margin-bottom:6px">
      <span style="width:9px;height:9px;border-radius:50%;background:var(--lime)"></span>
      <span style="flex:1;font-weight:700;font-size:15px">You can play a card now</span><span style="color:var(--lime);font-weight:800;font-size:14px">Open</span>
    </div>
    ${plays([["EV", "common", ""], ["MA", "golden", "t"], ["KA", "golden", "", 1]])}
    <h1 style="font-size:30px;margin-top:0">Who sounds<br>suspicious?</h1>
    <div style="margin:10px 0 12px;display:flex;gap:12px;align-items:center;background:var(--kraft);color:var(--ink-dk);border-radius:8px;padding:12px 14px;transform:rotate(-.8deg);box-shadow:0 8px 20px rgba(0,0,0,.35)">
      <span style="color:#5b4a2c">${P(I.tip).replace("<svg", '<svg style="width:30px;height:30px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"')}</span>
      <div style="flex:1"><div class="type" style="font-size:12px">ANONYMOUS TIP</div><div style="font-size:18px;font-weight:700;margin-top:2px">Someone suspects <span style="color:var(--stamp)">Ben</span></div></div>
    </div>
    <div class="rows">
      ${[["AL", "Alex · You", "you", "Add clue for turn 1"], ["MA", "Maya", "t", "“Fluffy”"], ["BE", "Ben", "", "“Barks at night”"], ["CL", "Cleo", "", ""], ["KA", "Kai", "", ""]]
        .map(([n, nm, c, clue]) => `<div class="row" style="padding:10px 0">${av(n, c)}<div class="grow"><div class="name">${nm}</div>${clue ? `<div style="color:${c === "you" ? "var(--muted)" : "var(--ink)"};${c === "you" ? "text-decoration:underline;" : ""}font-size:15px;margin-top:2px">${clue}</div>` : ""}</div></div>`)
        .join("")}
    </div>
  </div>
  <div class="bottom"><div class="btn primary">Open voting</div></div>`,
};

S[7] = {
  name: "07-golden-announcement",
  title: "Golden announcement — every phone",
  note: "A 1.2-second takeover on every phone at once, then it collapses into the normal banner and a Plays chip. Common and Rare plays get only the banner (2.5 s, non-blocking).",
  html: () => `${hdr("Round 5 · Turn 1", { hand: 2 })}
  <div class="content"><h1 style="font-size:30px">Who sounds<br>suspicious?</h1></div>
  <div class="scrim" style="background:rgba(6,7,6,.86)"></div>
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
    <div class="rays" style="top:44%"></div><div class="glow" style="top:44%"></div>
    <div style="position:relative;display:flex;align-items:center;gap:10px;margin-bottom:24px">${av("KA", "", "")}<span style="font-size:26px;font-weight:800">Kai</span></div>
    <div style="position:relative;transform:rotate(-4deg)">${back("", "golden").replace('class="card back', 'style="--w:220px" class="card back')}</div>
    <div style="position:relative;margin-top:30px;text-align:center">
      <div style="font-size:20px;color:var(--muted);font-weight:600">played a</div>
      <div class="anton" style="font-size:58px;line-height:1.05;background:linear-gradient(180deg,var(--gold-hi),var(--gold) 60%,var(--gold-lo));-webkit-background-clip:text;color:transparent">Golden card</div>
      <div class="type" style="margin-top:10px;font-size:13px;color:var(--kraft-dk)">EVIDENCE #3 ENTERED · CONTENTS SEALED</div><div class="sub" style="margin-top:6px">Which one? You'll find out at results.</div>
    </div>
  </div>`,
};

// ---------------------------------------------------------------- noir case-file screens and role guidance
const ART = (r) => `../../full-cast-v1/art/${r}.png`;
const FIT = {
  good: `<span class="fit good">${P(I.check)}Good for you</span>`,
  weak: `<span class="fit weak">Weak for you</span>`,
  ok: `<span class="fit ok">Fine</span>`,
};

S[4] = {
  name: "04-hand-sheet",
  title: "Hand as a case file, with role guidance",
  note: "The hand sheet becomes the round's case file. Each card says how it fits the role you hold this round: Good for you, Fine, or Weak for you. It's private, like the rest of the hand, and it guides without blocking.",
  html: () => `${S[3].html()}<div class="scrim"></div>
  <div class="case">
    <div class="tab type">CASE 05 · ALEX'S EVIDENCE</div>
    <div class="body">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <span class="av" style="width:48px;height:48px;background:#2a2620 url(${ART("judge")}) center 18% / 150% no-repeat;border:2px solid var(--kraft-dk)"></span>
        <div style="flex:1"><div class="type" style="font-size:12px;color:var(--kraft-dk)">YOUR ROLE THIS ROUND</div><div style="font-weight:800;font-size:20px">Judge</div></div>
        <span class="pill gold">${P(I.auto)}Golden 10%</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,104px);justify-content:space-between;row-gap:10px">
        ${[
          [card({ tier: "rare", name: "Heavy Vote", glyph: "weight", win: "ballot", size: "hand" }), FIT.good],
          [card({ tier: "golden", name: "Master Key", glyph: "key", size: "hand", now: true, state: "playable" }), FIT.weak],
          [card({ tier: "common", name: "On the Record", glyph: "tip", size: "hand", now: true, state: "playable" }), FIT.good],
          [card({ tier: "rare", name: "Jackpot", glyph: "coins", win: "passive", size: "hand", type: "Passive" }), `<span class="fit ok">Passive</span>`],
        ].map(([c, f]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:9px">${c}${f}</div>`).join("")}
      </div>
      <div class="type" style="margin-top:16px;font-size:13px;line-height:1.5;color:var(--kraft-dk);border-top:1px dashed #4a4236;padding-top:12px">
        NOTE: As the Judge, your vote already counts twice. Heavy Vote makes it three.<br>Master Key shows the word you already know.
      </div>
    </div>
  </div>`,
};

S[5] = {
  name: "05-card-detail",
  title: "Card detail with role tip and role strip",
  note: "Your role's advice sits on an evidence tag. The strip shows how the card fits all six roles, so you learn it for later rounds. Outside its window, the Play button says when the card can be played.",
  html: () => {
    const rate = [["imposter", "Imposter", "worst"], ["accomplice", "Accompl.", "fine"], ["detective", "Detective", "best"], ["judge", "Judge", "best", 1], ["decoy", "Decoy", "fine"], ["gambler", "Gambler", "fine"]];
    return `${hdr("Round 5 · Turn 1", { hand: 3, live: true })}
  <div class="scrim" style="top:66px;background:rgba(6,8,7,.8)"></div>
  <div class="content" style="position:relative;align-items:center">
    <div style="position:relative;margin-top:4px">${card({ tier: "rare", name: "Heavy Vote", fx: "Your counted vote counts twice (a Judge's counts three times). The Imposter can't play it.", glyph: "weight", win: "ballot" }).replace('class="card rare ', 'style="--w:236px" class="card rare ')}</div>
    <div class="tag" style="width:100%;margin-top:18px">
      <div style="display:flex;align-items:center;gap:8px"><span class="type" style="font-size:12px;letter-spacing:.1em">AS THE JUDGE</span><span class="fit good" style="height:22px">${P(I.check)}Best</span></div>
      <div style="font-size:16px;font-weight:600;line-height:1.35;margin-top:6px">Your vote becomes three. Save it for a close vote and you decide the round.</div>
    </div>
    <div style="width:100%;margin-top:16px">
      <div class="type" style="font-size:12px;color:var(--kraft-dk);margin-bottom:8px">WHO IT SUITS</div>
      <div class="roles">${rate.map(([f, n, r, you]) => `<div class="r ${r} ${you ? "you" : ""}"><span class="face" style="background-image:url(${ART(f)})"></span><span class="nm2">${n}</span><span class="rt">${r}</span></div>`).join("")}</div>
    </div>
  </div>
  <div class="bottom" style="position:relative"><div class="btn secondary" style="color:var(--muted)">${P(I.lock).replace("<svg", '<svg style="width:20px;height:20px;margin-right:8px;fill:none;stroke:currentColor;stroke-width:2"')}Play when voting opens</div><div class="btn secondary small">Back to the case file</div></div>`;
  },
};

S[11] = {
  name: "11-standings-bounty-underdog",
  title: "Standings with the Wanted poster",
  note: "The leader's row becomes a Wanted poster carrying the Bounty: the clearest way to show that the table should go after them. Underdogs get a 'Long shot' stamp. Everything else stays the normal standings.",
  html: () => `${hdr("Standings", { icons: ["qr"] })}
  <div class="content">
    <div class="small" style="margin-bottom:12px">After round 5 · target 20</div>
    <div class="wanted">
      <div style="display:flex;gap:14px">
        <div class="mug"><span class="av t" style="width:76px;height:76px;font-size:26px;margin-bottom:-8px;border-radius:50% 50% 8px 8px">MA</span></div>
        <div style="flex:1;min-width:0">
          <div class="anton" style="font-size:44px;line-height:.95;letter-spacing:1px">Wanted</div>
          <div class="type" style="font-size:13px;margin-top:4px">FOR LEADING THE TABLE</div>
          <div style="font-weight:800;font-size:22px;margin-top:6px">Maya · 16 pts</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;border-top:2px solid var(--ink-dk);margin-top:12px;padding-top:10px">
        <div class="type" style="font-size:12px;line-height:1.35">PAID TO EVERY UNDERDOG<br>IF MAYA LOSES A ROUND</div>
        <div class="anton" style="font-size:36px;line-height:1;color:var(--stamp)">+1</div>
      </div>
      <span class="stamp red" style="position:absolute;left:22px;top:122px;font-size:12px;background:rgba(232,217,188,.85);transform:rotate(-10deg)">Bounty</span>
    </div>
    <div class="rows" style="margin-top:18px">
      ${[["2", "KA", "Kai", "", 14, "+12", 0, 1], ["3", "BE", "Ben", "", 12, "+1", 0, 0], ["4", "CL", "Cleo", "", 10, "−2", 0, 3], ["5", "AL", "Alex · You", "you", 9, "+9", 1, 2], ["6", "EV", "Eve", "", 8, "+2", 1, 1]]
        .map(([rk, n, nm, c, pts, d, under, h]) => `<div class="row" style="padding:9px 0">
          <span style="width:16px;font-weight:800;color:var(--dim)">${rk}</span>${av(n, c, "sm")}
          <div class="grow"><div style="display:flex;align-items:center;gap:7px"><span class="name" style="font-size:16px">${nm}</span>${under ? `<span class="stamp lime" style="font-size:10px;padding:1px 6px;transform:rotate(-3deg)">Long shot</span>` : ""}</div>
          <div style="display:flex;gap:3px;margin-top:4px">${Array.from({ length: h }, () => back("chip").replace('class="card back', 'style="--w:16px" class="card back')).join("")}</div></div>
          <div style="text-align:right"><div style="font-size:20px;font-weight:800">${pts}</div><div class="small" style="font-weight:700;color:${d.startsWith("−") ? "var(--terra)" : "var(--lime)"}">${d}</div></div></div>`)
        .join("")}
    </div>
  </div>
  <div class="bottom"><div class="btn primary">Next round</div></div>`,
};

S[12] = {
  name: "12-story-of-the-night",
  title: "Story of the night as a newspaper",
  note: "The end-of-session recap as a front page: a headline from the biggest moment, the winner's Golden art as the photo, and titles of the night worked out from what happened. Made to be screenshotted for the group chat.",
  html: () => `${hdr("Story of the night", { icons: [] })}
  <div class="paper">
    <div style="display:flex;justify-content:space-between" class="type"><span style="font-size:10px">FRIDAY NIGHT EDITION</span><span style="font-size:10px">9 ROUNDS · 14 CARDS</span></div>
    <div class="anton center" style="font-size:40px;line-height:1;margin-top:4px;letter-spacing:1px">The Imposter Times</div>
    <div class="rule"></div>
    <div class="anton center" style="font-size:44px;line-height:.98;margin:10px 0 6px">Kai walks<br>with the loot</div>
    <div class="center" style="font-size:14px;font-weight:600;line-height:1.3">Golden Midas Touch turns +6 into +18 in the final round. Kai wins at 21.</div>
    <div style="display:flex;gap:12px;margin-top:12px;align-items:stretch">
      <div style="width:132px;flex:none">
        <div style="aspect-ratio:1;border:2px solid #1d1a14;background:#15130d url(${AB}golden-midas-touch.png) center / 112% no-repeat;filter:sepia(.35) contrast(1.05)"></div>
        <div class="type" style="font-size:9px;margin-top:4px;line-height:1.3">THE TOUCH. "Didn't see it coming," said Cleo.</div>
      </div>
      <div style="flex:1;font-size:12.5px;line-height:1.4">
        <div class="type" style="font-size:11px;border-bottom:1px solid #1d1a14;padding-bottom:3px;margin-bottom:5px">TITLES OF THE NIGHT</div>
        ${[["The Mastermind", "Kai"], ["The Con Artist", "Maya · fake Golden fooled 4"], ["The Fall Guy", "Cleo · accused 3 times"], ["The Comeback Kid", "Alex · 2 → 15"]]
          .map(([t, w]) => `<div style="margin-bottom:6px"><b style="font-family:Anton;font-weight:400;font-size:15px;letter-spacing:.3px;text-transform:uppercase">${t}</b><br>${w}</div>`).join("")}
      </div>
    </div>
    <div class="rule" style="margin-top:10px"></div>
    <div class="col" style="font-size:11.5px;line-height:1.38;margin-top:6px">
      ${[["R7", "Maya's card hits the table as Golden. The Judge panics. It was a Bluff Card."], ["R6", "Robin Hood strikes: Maya −5, every Underdog +2."], ["R5", "Cleo leads, gets caught, pays the Bounty."], ["R3", "An anonymous tip points at Ben. Ben was innocent."]]
        .map(([r, t]) => `<p style="margin:0 0 6px;break-inside:avoid"><b>${r}</b> ${t}</p>`).join("")}
    </div>
    <div class="rule" style="margin-top:8px"></div>
    <div class="type" style="font-size:11px;margin:4px 0 6px">FINAL STANDINGS</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px 10px;font-size:12.5px">
      ${[["1", "Kai", 21], ["2", "Maya", 18], ["3", "Alex", 15], ["4", "Ben", 14], ["5", "Cleo", 11], ["6", "Eve", 9]]
        .map(([r, n, s]) => `<div style="display:flex;justify-content:space-between;border-bottom:1px dotted rgba(29,26,20,.4)"><span><b>${r}.</b> ${n}</span><b>${s}</b></div>`).join("")}
    </div>
    <span class="stamp red" style="position:absolute;left:30px;top:300px;font-size:11px;transform:rotate(-10deg);background:rgba(239,230,210,.75)">Case closed</span>
  </div>
  <div class="bottom"><div class="btn primary">Back to the party</div></div>`,
};

S[6] = {
  name: "06-confirm-play",
  title: "Confirm before playing",
  note: "Every play confirms. It shows the exact public line, any visible side effect and how the card fits your role, so nobody misplays with a drink in hand.",
  html: () => `${S[3].html()}<div class="scrim"></div>
  <div class="case">
    <div class="tab type">EVIDENCE · ON THE RECORD</div>
    <div class="body">
      <div style="display:flex;align-items:center;gap:10px"><h2 style="font-size:24px;flex:1">Play On the Record?</h2>${FIT.good}</div>
      <div class="type" style="font-size:13px;color:var(--kraft-dk);margin-top:6px;line-height:1.45">AS THE JUDGE: a public vote pulls the room your way.</div>
      <div class="type" style="font-size:12px;color:var(--muted);margin:16px 0 8px">EVERYONE WILL SEE</div>
      <div class="panel" style="padding:4px 14px;background:#211f19;border-color:#4a4236">
        <div class="row" style="padding:10px 0">${av("AL", "you", "sm")}<div class="grow" style="font-size:16px"><b>Alex</b> played a <b>Common</b> card</div>${back("chip", "common")}</div>
        <div class="row" style="padding:10px 0;border-bottom:0">${av("CL", "t", "sm")}<div class="grow" style="font-size:16px">Alex votes <b>Cleo</b>, locked now</div><span class="stamp red" style="font-size:10px">Locked</span></div>
      </div>
      <div class="type" style="font-size:12px;color:var(--muted);margin:16px 0 6px">ONLY YOU GET</div>
      <div style="font-size:17px;font-weight:700">+2 points if Cleo is the Imposter</div>
      <div style="display:flex;gap:10px;margin:14px 0 18px;color:var(--muted);font-size:14px;line-height:1.4">
        <span style="flex:none">${P(I.info).replace("<svg", '<svg style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"')}</span>
        This is your card for the round. Jackpot waits in your case file.
      </div>
      <div style="display:flex;flex-direction:column;gap:10px"><div class="btn primary">Play card</div><div class="btn secondary small">Keep it</div></div>
    </div>
  </div>`,
};

S[8] = {
  name: "08-private-eye-result",
  title: "Private read as a classified file",
  note: "Private reads open as a classified file, with the same reveal and concealment as the word card. It stays reachable from the spent card until the round ends.",
  html: () => `${hdr("Round 5 · Card", { hand: 2, icons: ["eye"] })}
  <div class="content" style="align-items:center">
    <div class="type" style="font-size:13px;color:var(--kraft-dk);margin-top:2px">RARE · PRIVATE EYE</div>
    <h1 style="text-align:center;margin-top:6px">Only you can see this</h1>
    <div style="width:100%;margin-top:16px">
      <div class="tab type" style="width:190px;height:32px;background:var(--kraft);color:var(--ink-dk);border-radius:10px 10px 0 0;display:flex;align-items:center;padding:0 14px;font-size:13px">FILE 05-B</div>
      <div style="background:var(--kraft);color:var(--ink-dk);border-radius:0 14px 14px 14px;padding:18px 18px 16px;position:relative;box-shadow:0 14px 30px rgba(0,0,0,.4)">
        <span class="stamp red" style="position:absolute;right:16px;top:-14px;font-size:15px;background:rgba(232,217,188,.85);transform:rotate(7deg)">Classified</span>
        <div class="type" style="font-size:12px;margin-bottom:6px">SUBJECTS EXAMINED: 2</div>
        ${[["BE", "Ben", "Civilian side", "#b4c8ad", "#22351f"], ["CL", "Cleo", "Imposter's side", "#d98672", "#3a1a12"]]
          .map(([n, nm, side, bg, fg], i) => `<div style="display:flex;align-items:center;gap:14px;padding:12px 0;${i ? "border-top:1px dashed rgba(29,26,20,.35)" : ""}">
            <span style="width:56px;height:64px;flex:none;border:2px solid var(--ink-dk);background:repeating-linear-gradient(transparent 0 9px, rgba(29,26,20,.22) 9px 10px),#d9c9a6;display:grid;place-items:end center;overflow:hidden">${av(n, n === "CL" ? "t" : "", "").replace('class="av', 'style="margin-bottom:-6px;border-radius:50% 50% 6px 6px" class="av')}</span>
            <span style="flex:1;font-size:22px;font-weight:800">${nm}</span><span class="pill" style="background:${bg};color:${fg};height:32px;font-size:13px">${side}</span></div>`)
          .join("")}
        <div class="type" style="font-size:12px;line-height:1.5;border-top:2px solid var(--ink-dk);margin-top:6px;padding-top:10px">IMPOSTER'S SIDE = THE IMPOSTER AND THE ACCOMPLICE.<br>THIS FILE DOESN'T SAY WHICH.</div>
      </div>
    </div>
  </div>
  <div class="bottom"><div class="btn primary">Hide the file</div></div>`,
};

S[9] = {
  name: "09-ballot-heavy-vote-underdog",
  title: "Ballot as a line-up: Heavy Vote + Underdog bet",
  note: "The ballot sits on a line-up height chart. Your own selected row shows your weight after Heavy Vote (×3 for a Judge). Underdogs unlock the 3-point bet whatever their balance, with the drink warning in terracotta.",
  html: () => `${hdr("Round 5 · Vote", { hand: 1 })}
  <div class="content">
    ${plays([["EV", "common", ""], ["MA", "golden", "t"], ["KA", "golden", ""], ["AL", "rare", "you", 1]])}
    <div class="type" style="font-size:13px;color:var(--kraft-dk);text-align:center">THE LINE-UP</div>
    <h1 style="text-align:center;margin-top:2px;margin-bottom:12px">Who is the imposter?</h1>
    <div class="lineup">
      ${[["CL", "Cleo", "t", 1], ["BE", "Ben", ""], ["MA", "Maya", "t"], ["KA", "Kai", ""]]
        .map(([n, nm, c, sel]) => `<div style="display:flex;align-items:center;gap:14px;height:62px;padding:0 14px;border-radius:14px;margin-bottom:8px;border:1.5px solid ${sel ? "var(--lime)" : "rgba(52,61,53,.9)"};background:${sel ? "rgba(35,43,32,.92)" : "rgba(28,33,30,.86)"}">${av(n, c)}<span style="flex:1;font-weight:700;font-size:19px">${nm}</span>${sel ? `<span class="pill" style="background:#2f3a18;color:var(--lime);border:1px solid var(--lime)">${P(I.weight)}×3</span><span class="av" style="width:30px;height:30px;background:var(--lime)">${P(I.check).replace("<svg", '<svg style="width:18px;height:18px;fill:none;stroke:#141916;stroke-width:3;stroke-linecap:round"')}</span>` : `<span style="width:30px;height:30px;border-radius:50%;border:1.5px solid #6a746b"></span>`}</div>`)
        .join("")}
    </div>
    <div style="border-top:1px solid var(--line);margin-top:6px;padding-top:12px">
      <div style="display:flex;align-items:center;gap:10px"><span style="font-weight:800;font-size:19px;flex:1">Judge bet</span><span class="stamp lime" style="font-size:11px;transform:rotate(-3deg)">Long shot</span></div>
      <div class="small" style="margin:6px 0 10px">Balance: 1 point · Underdog: a winning bet pays 1 more</div>
      <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;border:1.5px solid #5b665c;border-radius:16px;overflow:hidden;height:50px">
        ${["No bet", "1", "2", "3"].map((t, i) => `<span style="display:grid;place-items:center;font-weight:800;font-size:${i ? 20 : 16}px;${i === 3 ? "background:var(--lime);color:#141916" : i ? "border-left:1px solid var(--line)" : ""}">${t}</span>`).join("")}
      </div>
      <div style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;color:var(--terra);font-size:14px;line-height:1.35;font-weight:600">
        ${P(I.info).replace("<svg", '<svg style="width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"')}
        You can't cover 3. Lose this bet and you go to Drink/Dare. Win: +6.
      </div>
    </div>
  </div>
  <div class="bottom"><div class="btn primary">Lock vote</div></div>`,
};

const REPLAY = [
  ["EV", "Eve", "", card({ tier: "common", name: "Late Arrival", glyph: "clock", win: "reveal", size: "hand" }), "Common", "Gave her clue last.", "Played", "ink"],
  ["MA", "Maya", "t", card({ tier: "common", name: "Bluff Card", glyph: "mask", size: "hand" }), "Looked Golden", "Nothing happened. <b style='color:var(--lime)'>Fooled the room.</b>", "Bluff", "red"],
  ["KA", "Kai", "", card({ tier: "golden", name: "Midas Touch", glyph: "midas", win: "ballot", size: "hand" }), "Golden", "Tripled his round: <b style='color:var(--gold)'>+4 → +12</b>", "×3", "red"],
  ["AL", "Alex", "you", card({ tier: "rare", name: "Heavy Vote", glyph: "weight", win: "ballot", size: "hand" }), "Rare", "Counted three times for Cleo.", "×3", "ink"],
];
S[10] = {
  name: "10-results-cards-replay",
  title: "Results: Cards this round",
  note: "A new beat before Everyone's results. Each Plays chip turns face up in play order (420 ms flip, 600 ms stagger) with owner and outcome, and its stamp lands. This is where every announcement pays off. The host can skip.",
  html: () => `${hdr("Round 5 · Room")}
  <div class="content">
    <div style="display:flex;align-items:center;gap:12px;background:var(--kraft);color:var(--ink-dk);border-radius:8px;padding:11px 14px;margin-bottom:12px;position:relative;transform:rotate(-.6deg)">
      <div style="flex:1"><div class="type" style="font-size:12px">BOUNTY</div><div style="font-weight:800;font-size:17px">Cleo led and was caught</div><div style="font-size:13px">+2 to every Underdog</div></div>
      <span class="stamp red" style="font-size:16px;transform:rotate(-8deg)">Paid</span>
    </div>
    <div class="type" style="font-size:13px;color:var(--kraft-dk)">EVIDENCE REVIEW</div>
    <h1 style="margin:2px 0 10px">Cards this round</h1>
    <div class="rows">
      ${REPLAY.map(([n, nm, c, cardHtml, lab, out, st, sc]) => `<div class="row" style="padding:8px 0;align-items:center;gap:14px">
        <div style="position:relative;transform:scale(.72);transform-origin:left center;width:75px;height:105px;flex:none">${cardHtml}<span class="stamp ${sc === "red" ? "red" : ""}" style="position:absolute;left:8px;bottom:22px;font-size:15px;background:rgba(244,241,232,.88);${sc === "ink" ? "color:#3b3326;" : ""}transform:rotate(-14deg)">${st}</span></div>
        <div class="grow"><div style="display:flex;align-items:center;gap:8px">${av(n, c, "xs")}<b style="font-size:16px">${nm}</b><span class="small" style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;${lab === "Looked Golden" ? "color:var(--gold)" : ""}">${lab}</span></div>
        <div style="font-size:15px;margin-top:5px;line-height:1.35">${out}</div></div></div>`).join("")}
    </div>
  </div>
  <div class="bottom"><div class="btn primary">Everyone's results</div></div>`,
};

// ---------------------------------------------------------------- motion demos (game motion v2)
// Shared game-motion toolkit: anticipation, overshoot, impact (shake, shockwave, flash, sparks), slams and count-ups.
// Every effect is plain DOM + Web Animations, so it ports straight to React with the existing motion tokens.
const TIER = {
  golden: { label: "Golden", c1: "#f8e6a6", c2: "#e9c46a", glow: "rgba(233,196,106,.85)", sparks: 46, shake: 9 },
  rare: { label: "Rare", c1: "#d9e8ef", c2: "#8fb3c9", glow: "rgba(143,179,201,.8)", sparks: 22, shake: 5 },
  common: { label: "Common", c1: "#f4f1e8", c2: "#cfd9c9", glow: "rgba(244,241,232,.55)", sparks: 10, shake: 3 },
};
const FACE = {
  golden: () => card({ tier: "golden", name: "Master Key", fx: "Secretly read the real word.", glyph: "key", type: "Golden · Active" }),
  rare: () => card({ tier: "rare", name: "Heavy Vote", fx: "Your counted vote counts twice (a Judge's counts three times).", glyph: "weight", win: "ballot" }),
  common: () => card({ tier: "common", name: "Late Arrival", fx: "Give your clue last in the first clue round.", glyph: "clock", win: "reveal" }),
};
// sealed card: tier frame + neutral engraved back (only the drawer's phone ever shows the frame)
function seal(t = "golden") {
  return `<div class="seal ${t}"><div class="in"></div><div class="shine"></div></div>`;
}

const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const E = { out: "cubic-bezier(0.22,1,0.36,1)", back: "cubic-bezier(.34,1.56,.64,1)", in: "cubic-bezier(.55,0,1,.45)", snap: "cubic-bezier(.2,1.4,.4,1)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, REDUCE ? 0 : ms));
function go(el, kf, o = {}) {
  if (!el) return { finished: Promise.resolve() };
  if (REDUCE) { Object.assign(el.style, kf[kf.length - 1]); return { finished: Promise.resolve() }; }
  return el.animate(kf, { fill: "both", easing: E.out, ...o });
}
function mk(parent, css, html = "") {
  const d = document.createElement("div");
  d.style.cssText = "position:absolute;pointer-events:none;" + css;
  d.innerHTML = html;
  parent.appendChild(d);
  return d;
}
function shake(el, mag = 6, dur = 340) {
  if (REDUCE || !mag) return;
  const k = [];
  for (let i = 0; i <= 8; i++) { const m = mag * (1 - i / 8); k.push({ transform: `translate(${(Math.random() * 2 - 1) * m}px,${(Math.random() * 2 - 1) * m}px)` }); }
  k.push({ transform: "none" });
  el.animate(k, { duration: dur, easing: "linear" });
}
function sparks(layer, x, y, { n = 24, c1 = "#fff", c2 = "#e9c46a", spread = 230, dur = 1000, up = 0 } = {}) {
  if (REDUCE) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = spread * (0.35 + Math.random() * 0.65), s = 3 + Math.random() * 6;
    const p = mk(layer, `left:${x}px;top:${y}px;width:${s}px;height:${s * (Math.random() < .4 ? 3 : 1)}px;border-radius:${s}px;background:${Math.random() < .5 ? c1 : c2};box-shadow:0 0 ${s * 2}px ${c2}`);
    const dx = Math.cos(a) * r, dy = Math.sin(a) * r - up;
    p.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * .7}px),calc(-50% + ${dy * .7}px)) rotate(${a}rad) scale(1)`, opacity: 1, offset: .55 },
      { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy + 60}px)) rotate(${a}rad) scale(.2)`, opacity: 0 }],
      { duration: dur * (0.7 + Math.random() * 0.5), easing: E.out, fill: "both" }).finished.then(() => p.remove());
  }
}
function ring(layer, x, y, color, size = 340, dur = 650) {
  if (REDUCE) return;
  const r = mk(layer, `left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:50%;border:4px solid ${color};transform:translate(-50%,-50%) scale(0)`);
  r.animate([{ transform: "translate(-50%,-50%) scale(.15)", opacity: 1, borderWidth: "10px" }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0, borderWidth: "1px" }], { duration: dur, easing: E.out, fill: "both" }).finished.then(() => r.remove());
}
function flash(layer, color = "#fff", peak = .7, dur = 260) {
  if (REDUCE) return;
  const f = mk(layer, `inset:0;background:${color};opacity:0`);
  f.animate([{ opacity: 0 }, { opacity: peak, offset: .25 }, { opacity: 0 }], { duration: dur, fill: "both" }).finished.then(() => f.remove());
}
// slam a word in letter by letter, oversized and blurred, landing with a bounce
function slam(el, { stagger = 45, from = 2.6 } = {}) {
  const txt = el.textContent; el.textContent = "";
  [...txt].forEach((ch, i) => {
    const s = document.createElement("span"); s.textContent = ch === " " ? " " : ch; s.style.display = "inline-block"; el.appendChild(s);
    go(s, [{ transform: `scale(${from}) translateY(-18px)`, opacity: 0, filter: "blur(8px)" }, { transform: "scale(.92)", opacity: 1, filter: "blur(0)", offset: .7 }, { transform: "none", opacity: 1, filter: "blur(0)" }], { duration: 380, delay: i * stagger, easing: E.out });
  });
  return sleep(txt.length * stagger + 380);
}
function count(el, from, to, dur = 700, pre = "+") {
  if (REDUCE) { el.textContent = pre + to; return; }
  const t0 = performance.now();
  const tick = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = pre + Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

// ---------- 1. Draw: tap Draw → sealed card shows its tier → tap the card → reveal
async function demoDraw(root, tier, auto) {
  const T = TIER[tier], phone = root.querySelector(".phone");
  const L = root.querySelector("#L");
  const drawBtn = root.querySelector(".bottom .btn.primary");
  drawBtn.style.cursor = "pointer"; drawBtn.style.pointerEvents = "auto";
  const deck = root.querySelector(".deck");
  let started = false;
  const start = async () => {
    if (started) return; started = true;
    // press: squash + anticipation shudder on the deck
    go(drawBtn, [{ transform: "scale(1)" }, { transform: "scale(.94,.9)", offset: .35 }, { transform: "scale(1.03)" , offset: .7 }, { transform: "scale(1)" }], { duration: 260 });
    go(deck, [{ transform: "none" }, { transform: "translateY(4px) scale(.98)", offset: .4 }, { transform: "translateY(-3px)" , offset: .7 }, { transform: "none" }], { duration: 240 });
    await sleep(160);
    const scrim = mk(L, "inset:0;background:rgba(6,7,6,.94);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);opacity:0");
    go(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    const rays = mk(L, "left:50%;top:400px;width:760px;height:760px;opacity:0", "");
    rays.className = "rays"; rays.style.position = "absolute";
    const glow = mk(L, `left:50%;top:400px;width:440px;height:440px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle, ${T.glow}, transparent 62%);opacity:0`);
    // the card: flies out of the deck spinning flat (never shows its face), overshoots, lands
    const hold = mk(L, "left:45px;top:190px;width:300px;height:420px;perspective:1300px;cursor:pointer");
    hold.innerHTML = `<div class="flip" style="position:relative;width:300px;height:420px;transform-style:preserve-3d">
        <div class="side front" style="position:absolute;inset:0;backface-visibility:hidden">${seal(tier)}</div>
        <div class="side backrear" style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg)">${seal(tier)}</div>
        <div class="side rear" style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);display:none">${FACE[tier]()}</div></div>`;
    const flip = hold.querySelector(".flip"), sealEl = hold.querySelector(".seal");
    sealEl.classList.add("plain");
    go(hold, [
      { transform: "translate(0,90px) scale(.42) rotate(0deg)", opacity: 0 },
      { transform: "translate(-30px,-70px) scale(.85) rotate(-250deg)", opacity: 1, offset: .5 },
      { transform: "translate(0,8px) scale(1.08) rotate(-356deg)", offset: .82 },
      { transform: "translate(0,0) scale(1) rotate(-360deg)" }], { duration: 720, easing: "cubic-bezier(.3,.7,.4,1)" }); await sleep(720);
    // impact
    shake(phone, 5, 300); ring(L, 195, 400, "rgba(244,241,232,.6)", 380, 600);
    sparks(L, 195, 610, { n: 14, c1: "#cfd9c9", c2: "#8d9a8a", spread: 140, dur: 700, up: 40 });
    await sleep(260);
    // tier tease: frame ignites with a sweeping light, then the tier slams in
    sealEl.classList.remove("plain");
    go(sealEl, [{ filter: "brightness(1) saturate(0)" }, { filter: "brightness(2.2) saturate(1.4)", offset: .3 }, { filter: "brightness(1) saturate(1)" }], { duration: 650 });
    go(hold.querySelector(".shine"), [{ backgroundPosition: "160% 0" }, { backgroundPosition: "-60% 0" }], { duration: 700, easing: "ease-in-out" });
    go(glow, [{ opacity: 0, transform: "translate(-50%,-50%) scale(.6)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)" }], { duration: 600 });
    flash(L, T.c2, tier === "golden" ? .35 : .18, 320);
    ring(L, 195, 400, T.c2, 520, 800);
    sparks(L, 195, 400, { n: T.sparks, c1: T.c1, c2: T.c2, spread: tier === "golden" ? 300 : 210, dur: 1200 });
    shake(phone, T.shake, 420);
    if (tier !== "common") go(rays, [{ opacity: 0, transform: "translate(-50%,-50%) scale(.3) rotate(0deg)" }, { opacity: tier === "golden" ? 1 : .55, transform: "translate(-50%,-50%) scale(1.15) rotate(30deg)" }], { duration: 900 });
    rays.style.filter = tier === "rare" ? "hue-rotate(170deg) saturate(.7) brightness(1.4)" : "brightness(1.9)";
    const title = mk(L, "left:0;right:0;top:78px;text-align:center");
    title.innerHTML = `<div class="type" style="font-size:13px;color:var(--kraft-dk);opacity:0" id="yd">YOU DREW A</div><div class="anton" id="tl" style="font-size:64px;line-height:1;color:${T.c2};text-shadow:0 0 22px ${T.glow}">${T.label}</div>`;
    go(title.querySelector("#yd"), [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 300 });
    await slam(title.querySelector("#tl"), { stagger: tier === "golden" ? 55 : 40 });
    // idle spin: both sides are sealed backs, so the face never shows
    let spin = null;
    if (!REDUCE) {
      // slow start → fast whip (two full turns) → long slow glide to a halt, then a short rest
      spin = flip.animate([
        { transform: "rotateY(0deg)", easing: "cubic-bezier(.7,0,.12,1)" },
        { transform: "rotateY(720deg)", offset: .74 },
        { transform: "rotateY(720deg)" }], { duration: 3800, iterations: Infinity });
      hold.querySelectorAll(".shine").forEach((s) => s.animate([{ backgroundPosition: "160% 0", easing: "cubic-bezier(.7,0,.12,1)" }, { backgroundPosition: "-60% 0", offset: .74 }, { backgroundPosition: "-60% 0" }], { duration: 3800, iterations: Infinity }));
    }
    // idle: the sealed card floats and breathes; rays turn slowly
    if (!REDUCE) {
      hold.animate([{ transform: "translateY(0)" }, { transform: "translateY(-7px)" }, { transform: "translateY(0)" }], { duration: 2400, iterations: Infinity, easing: "ease-in-out", composite: "add" });
      glow.animate([{ opacity: 1 }, { opacity: .55 }, { opacity: 1 }], { duration: 2400, iterations: Infinity });
      rays.animate([{ rotate: "0deg" }, { rotate: "360deg" }], { duration: 40000, iterations: Infinity, composite: "add" });
    }
    const hint = mk(L, "left:0;right:0;top:632px;text-align:center");
    hint.innerHTML = `<div style="display:inline-flex;align-items:center;gap:8px;color:${T.c1};font-weight:700;font-size:17px"><span style="width:10px;height:10px;border-radius:50%;background:${T.c2};box-shadow:0 0 10px ${T.c2}"></span>Tap the card to reveal it</div>
      <div class="type" style="margin-top:10px;font-size:12px;color:var(--kraft-dk)">SHOW IT OFF. NOBODY CAN TELL WHICH ${T.label.toUpperCase()} IT IS.</div>`;
    go(hint, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 400 });
    if (!REDUCE) hint.firstElementChild.animate([{ opacity: 1 }, { opacity: .45 }, { opacity: 1 }], { duration: 1400, iterations: Infinity });
    hold.style.pointerEvents = "auto";

    let revealed = false;
    const reveal = async () => {
      if (revealed) return; revealed = true;
      if (spin) {
        // read the real angle off the card, then turn it the rest of the way to the front
        const m = getComputedStyle(flip).transform.match(/matrix3d\(([^)]+)\)/);
        const v = m ? m[1].split(",").map(Number) : null;
        const ang = v ? (Math.atan2(v[8], v[0]) * 180 / Math.PI + 360) % 360 : 0; // 720° spin: the angle mod 360 is all that matters
        spin.cancel();
        if (ang > 1 && ang < 359) { go(flip, [{ transform: `rotateY(${ang}deg)` }, { transform: "rotateY(360deg)" }], { duration: 160 + (360 - ang), easing: E.out }); await sleep(160 + (360 - ang)); }
        flip.getAnimations().forEach((a) => a.cancel());
      }
      hold.querySelector(".backrear").remove();
      hold.querySelector(".rear").style.display = "";
      go(hint, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      // wind-up: the card tenses, shivers and glows harder
      go(flip, [{ transform: "rotateY(0) scale(1)" }, { transform: "rotateY(-14deg) scale(.93) rotate(-2deg)", offset: .45 }, { transform: "rotateY(8deg) scale(.95) rotate(2deg)", offset: .75 }, { transform: "rotateY(0) scale(.94)" }], { duration: 300 });
      go(glow, [{ transform: "translate(-50%,-50%) scale(1)" }, { transform: "translate(-50%,-50%) scale(1.35)" }], { duration: 300 });
      await sleep(300);
      // flip with overshoot; flash at the edge-on moment
      go(flip, [{ transform: "rotateY(0) scale(.94)" }, { transform: "rotateY(100deg) scale(1.12)", offset: .45 }, { transform: "rotateY(195deg) scale(1.04)", offset: .8 }, { transform: "rotateY(180deg) scale(1)" }], { duration: 520, easing: E.out });
      await sleep(190);
      flash(L, "#fff", tier === "golden" ? .75 : .45, 300);
      shake(phone, T.shake + 2, 380);
      ring(L, 195, 400, T.c1, 600, 760);
      sparks(L, 195, 400, { n: T.sparks + 14, c1: T.c1, c2: T.c2, spread: 320, dur: 1300 });
      await sleep(330);
      // the face's art and name pop in
      const rear = hold.querySelector(".rear");
      go(rear.querySelector(".art"), [{ transform: "scale(.4)", opacity: 0 }, { transform: "scale(1.12)", opacity: 1, offset: .65 }, { transform: "scale(1)", opacity: 1 }], { duration: 480, easing: E.out });
      go(rear.querySelector(".nm"), [{ transform: "translateY(14px)", opacity: 0, letterSpacing: ".3em" }, { transform: "none", opacity: 1, letterSpacing: ".02em" }], { duration: 420, delay: 120 });
      go(rear.querySelector(".fx"), [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 300 });
      const tl = title.querySelector("#tl"); go(title, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      await sleep(500);
      const done = mk(L, "left:20px;right:20px;bottom:22px");
      done.innerHTML = `<div class="btn primary" style="pointer-events:auto">Add to my case file</div>`;
      go(done, [{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: E.back });
    };
    hold.addEventListener("click", reveal);
    if (auto) { await sleep(4200); reveal(); }
  };
  drawBtn.addEventListener("click", start);
  if (auto) { await sleep(700); start(); }
}

// ---------- 2. Golden announcement on every phone
async function demoGolden(root) {
  const phone = root.querySelector(".phone"), L = root.querySelector("#L");
  const scrim = mk(L, "inset:0;background:rgba(6,7,6,.93);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);opacity:0");
  go(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
  const glow = mk(L, "left:50%;top:44%;width:460px;height:460px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle, rgba(233,196,106,.6), transparent 62%);opacity:0");
  const rays = mk(L, "left:50%;top:44%;opacity:0;filter:brightness(1.9)"); rays.className = "rays"; rays.style.position = "absolute";
  const who = mk(L, "left:0;right:0;top:150px;display:flex;justify-content:center;align-items:center;gap:10px;opacity:0", `${av("KA", "", "")}<span style="font-size:26px;font-weight:800">Kai</span>`);
  const cardEl = mk(L, "left:85px;top:228px;width:220px;height:308px", back("", "golden").replace('class="card back', 'style="--w:220px" class="card back'));
  const words = mk(L, "left:0;right:0;top:560px;text-align:center", `<div style="font-size:20px;color:var(--muted);font-weight:600;opacity:0" id="pa">played a</div><div class="anton" id="gc" style="font-size:60px;line-height:1.05;color:var(--gold);text-shadow:0 0 24px rgba(233,196,106,.6)">Golden card</div><div class="type" id="ev" style="margin-top:10px;font-size:13px;color:var(--kraft-dk);opacity:0">EVIDENCE #3 ENTERED · CONTENTS SEALED</div>`);
  words.querySelector("#gc").style.opacity = 0;
  await sleep(120);
  // the card drops from above, spinning, and slams down
  go(cardEl, [{ transform: "translateY(-520px) rotate(-540deg) scale(1.9)", opacity: 0 }, { transform: "translateY(16px) rotate(-6deg) scale(.96)", opacity: 1, offset: .82 }, { transform: "translateY(0) rotate(-4deg) scale(1)", opacity: 1 }], { duration: 560, easing: E.in }); await sleep(560);
  shake(phone, 11, 420); flash(L, "#e9c46a", .4, 280); ring(L, 195, 382, "#f8e6a6", 560, 760);
  sparks(L, 195, 382, { n: 50, c1: "#f8e6a6", c2: "#e9c46a", spread: 330, dur: 1300 });
  go(glow, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
  go(rays, [{ opacity: 0, transform: "translate(-50%,-50%) scale(.3)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1.2) rotate(25deg)" }], { duration: 900 });
  go(who, [{ opacity: 0, transform: "translateX(-40px)" }, { opacity: 1, transform: "none" }], { duration: 360, easing: E.back });
  go(words.querySelector("#pa"), [{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: 120 });
  words.querySelector("#gc").style.opacity = 1;
  await slam(words.querySelector("#gc"), { stagger: 42 });
  go(words.querySelector("#ev"), [{ opacity: 0, letterSpacing: ".3em" }, { opacity: 1, letterSpacing: ".02em" }], { duration: 400 });
  await sleep(900);
  // the card shrinks and flies into the Plays strip; the chip pops
  const chip = root.querySelector(".play.new");
  const pr = phone.getBoundingClientRect(), cr = chip.getBoundingClientRect();
  const tx = cr.left - pr.left + cr.width - 24 - (85 + 110), ty = cr.top - pr.top + cr.height / 2 - (228 + 154);
  go(cardEl, [{ transform: "rotate(-4deg) scale(1)" }, { transform: `translate(${tx * .4}px,${ty * .2 - 60}px) rotate(80deg) scale(.5)`, offset: .45 }, { transform: `translate(${tx}px,${ty}px) rotate(186deg) scale(.1)`, opacity: .9 }], { duration: 560, easing: E.in });
  for (let i = 0; i < 6; i++) setTimeout(() => sparks(L, 195 + tx * (i / 6), 382 + ty * (i / 6) - 40 * Math.sin(i / 2), { n: 5, c1: "#f8e6a6", c2: "#e9c46a", spread: 50, dur: 500 }), i * 80);
  [scrim, glow, rays, who, words].forEach((el) => go(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, delay: 160 }));
  await sleep(560);
  cardEl.remove();
  go(chip, [{ transform: "scale(1)" }, { transform: "scale(1.45)", offset: .35 }, { transform: "scale(.92)", offset: .7 }, { transform: "scale(1)" }], { duration: 480 });
  const r = chip.getBoundingClientRect(); ring(L, r.left - pr.left + r.width / 2, r.top - pr.top + r.height / 2, "#e9c46a", 120, 520);
  const bn = mk(L, "left:14px;right:14px;top:72px;display:flex;align-items:center;gap:10px;background:#211f16;border:1px solid var(--gold);border-radius:16px;padding:9px 12px", `${av("KA", "", "sm")}<span style="flex:1;font-size:16px"><b>Kai</b> played a <b style="color:var(--gold)">Golden</b> card</span>${back("chip", "golden")}`);
  go(bn, [{ opacity: 0, transform: "translateY(-30px)" }, { opacity: 1, transform: "none", offset: .2 }, { opacity: 1, transform: "none", offset: .85 }, { opacity: 0, transform: "translateY(-10px)" }], { duration: 2800, easing: "linear" });
}

// ---------- 3. Results replay: cards are dealt face down, flip, and get stamped
async function demoReplay(root) {
  const phone = root.querySelector(".phone"), L = root.querySelector("#L");
  const rows = [...root.querySelectorAll(".rows .row")];
  const note = root.querySelector(".content > div");
  const paid = note.querySelector(".stamp");
  rows.forEach((row) => {
    const wrap = row.firstElementChild; // scaled card holder
    wrap.style.transformStyle = "preserve-3d";
    const cover = document.createElement("div");
    cover.className = "card back"; cover.style.cssText = "--w:104px;position:absolute;left:0;top:0;";
    wrap.appendChild(cover);
    wrap.querySelector(".stamp").style.opacity = 0;
    row.querySelector(".grow").style.opacity = 0;
    wrap.style.opacity = 0;
  });
  if (paid) paid.style.opacity = 0;
  await sleep(250);
  // deal: cards slide in from the right, face down, one after another
  rows.forEach((row, i) => go(row.firstElementChild, [{ transform: "translateX(320px) rotate(25deg) scale(.72)", opacity: 0 }, { transform: "translateX(-6px) rotate(-3deg) scale(.72)", opacity: 1, offset: .8 }, { transform: "scale(.72)", opacity: 1 }], { duration: 420, delay: i * 110, easing: E.out }));
  await sleep(420 + rows.length * 110 + 150);
  for (const row of rows) {
    const wrap = row.firstElementChild, cover = wrap.querySelector(".card.back"), stamp = wrap.querySelector(".stamp"), grow = row.querySelector(".grow");
    const golden = !!wrap.querySelector(".card.golden"), bluff = /Bluff/.test(stamp.textContent);
    go(wrap, [{ transform: "scale(.72) rotateY(0)" }, { transform: "scale(.8) rotateY(90deg)" }], { duration: 170, easing: E.in }); await sleep(170);
    cover.remove();
    go(wrap, [{ transform: "scale(.8) rotateY(-90deg)" }, { transform: "scale(.76) rotateY(12deg)", offset: .7 }, { transform: "scale(.72) rotateY(0)" }], { duration: 260, easing: E.out }); await sleep(260);
    const r = wrap.getBoundingClientRect(), pr = phone.getBoundingClientRect();
    const cx = r.left - pr.left + r.width / 2, cy = r.top - pr.top + r.height / 2;
    if (golden) { sparks(L, cx, cy, { n: 26, c1: "#f8e6a6", c2: "#e9c46a", spread: 140 }); flash(L, "#e9c46a", .15, 220); }
    go(grow, [{ opacity: 0, transform: "translateX(-14px)" }, { opacity: 1, transform: "none" }], { duration: 280 });
    const num = [...grow.querySelectorAll("b")].find((b) => /\+\d/.test(b.textContent));
    if (golden && num) { const m = num.textContent.match(/\+(\d+)\D+\+(\d+)/); if (m) { num.innerHTML = `+${m[1]} → <span id="cnt">+${m[1]}</span>`; setTimeout(() => count(num.querySelector("#cnt"), +m[1], +m[2], 800), 250); } }
    await sleep(240);
    // stamp slam
    stamp.style.opacity = 1;
    go(stamp, [{ transform: "scale(3) rotate(-40deg)", opacity: 0 }, { transform: "scale(.9) rotate(-12deg)", opacity: 1, offset: .7 }, { transform: "scale(1) rotate(-14deg)", opacity: 1 }], { duration: 230, easing: E.in });
    await sleep(170);
    shake(row, bluff ? 7 : 4, 240);
    ring(L, cx, cy, bluff ? "rgba(196,80,58,.8)" : "rgba(244,241,232,.5)", 120, 420);
    await sleep(bluff ? 520 : 380);
  }
  if (paid) {
    paid.style.opacity = 1;
    go(paid, [{ transform: "scale(3.2) rotate(-40deg)", opacity: 0 }, { transform: "scale(.9) rotate(-6deg)", opacity: 1, offset: .7 }, { transform: "scale(1) rotate(-8deg)", opacity: 1 }], { duration: 260, easing: E.in });
    await sleep(200); shake(note, 6, 260);
    const r = paid.getBoundingClientRect(), pr = phone.getBoundingClientRect();
    ring(L, r.left - pr.left + r.width / 2, r.top - pr.top + r.height / 2, "rgba(196,80,58,.8)", 160, 460);
  }
}

const DEMO = {
  draw: () => S[1].html().replace('<div style="position:relative;width:150px;height:210px">', '<div class="deck" style="position:relative;width:150px;height:210px">') + `<div class="demo-layer" id="L"></div>`,
  golden: () => `${S[3].html()}<div class="demo-layer" id="L"></div>`,
  replay: () => `${S[10].html()}<div class="demo-layer" id="L"></div>`,
};
function runDemo(kind, root) {
  const q = new URLSearchParams(location.search);
  if (kind === "draw") demoDraw(root, q.get("tier") || "golden", q.has("auto"));
  if (kind === "golden") demoGolden(root);
  if (kind === "replay") demoReplay(root);
}

// ---------------------------------------------------------------- render
const q = new URLSearchParams(location.search);
const app = document.getElementById("app");
// The full-app revamp (design/app-revamp-v1) loads this file as a component library and renders its own gallery.
if (window.MOCKUP_LIBRARY) {
  // components only
} else if (q.get("s")) {
  document.body.classList.add("single");
  app.innerHTML = `<div class="phone">${S[q.get("s")].html()}</div>`;
} else if (q.get("demo")) {
  document.body.classList.add("single", "anim");
  app.innerHTML = `<div class="phone">${DEMO[q.get("demo")]()}</div>`;
  document.fonts.ready.then(() => runDemo(q.get("demo"), app));
} else {
  app.innerHTML = `<div class="gallery">
    <h1>Power cards — mockups</h1><p class="note" style="font-size:18px"><a href="../../app-revamp-v1/mockup/" style="color:#d6f56b;font-weight:800">→ See the full app revamp (all 41 screens)</a> &nbsp; <a href="../../sound-v1/" style="color:#d6f56b;font-weight:800">→ Sound board</a></p>
    <p class="note">12 screens from design/power-cards-v1/README.md, built with the app's own colours, fonts and spacing, in the noir case-file theme. The motion demos below are live: tap Draw, then tap the sealed card.</p>
    ${Object.entries(S).map(([k, s]) => `<figure><iframe src="?s=${k}" loading="lazy"></iframe><figcaption><b>${k}. ${s.title}</b><br>${s.note}</figcaption></figure>`).join("")}
    <h1 style="margin-top:20px">Motion demos</h1>
    <figure><iframe id="d-draw" src="?demo=draw"></iframe><figcaption><b>Draw, two taps.</b> Tap <b>Draw</b>: the card spins out of the deck and lands sealed, then its tier ignites. Tap the card to reveal it.<br>
      ${["golden", "rare", "common"].map((t) => `<button onclick="document.getElementById('d-draw').src='?demo=draw&tier=${t}&r='+Date.now()">${t[0].toUpperCase() + t.slice(1)}</button> <button style="background:#2a2620;color:#e8d9bc" onclick="document.getElementById('d-draw').src='?demo=draw&tier=${t}&auto&r='+Date.now()">auto</button>`).join(" &nbsp; ")}</figcaption></figure>
    ${[["golden", "Golden announcement: the card slams down on every phone, then flies into the Plays strip"], ["replay", "Results replay: dealt face down, flipped, stamped; Midas counts up"]]
      .map(([k, t]) => `<figure><iframe id="d-${k}" src="?demo=${k}"></iframe><figcaption><b>${t}</b><br><button onclick="document.getElementById('d-${k}').src='?demo=${k}&r='+Date.now()">Replay</button></figcaption></figure>`).join("")}
  </div>`;
}
