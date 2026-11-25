// App revamp v1: the whole app in the noir case-file theme, in play order.
// Uses design/power-cards-v1/mockup/mockup.js as a component library (P, I, card, back, av, hdr, plays, seal, FIT, ART, S).
// ?s=<key> renders one screen; no query renders the gallery.

Object.assign(I, {
  wifi: "M3 9a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 15a5 5 0 0 1 6 0M12 19h.01",
  gear: "m9 3 6 0 1 4 4 1v7l-4 1-1 5H9l-1-5-5-1V8l5-1 1-4ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  battery: "M3 8h15v8H3zM21 11v2M6 11h5",
  camera: "M3 8h4l2-3h6l2 3h4v12H3zM12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  exit: "M10 4H4v16h6M15 8l4 4-4 4M19 12H9",
  x: "m6 6 12 12M6 18 18 6",
  trophy: "M7 3h10v9a5 5 0 0 1-10 0V3ZM7 5H3v4a4 4 0 0 0 4 4M17 5h4v4a4 4 0 0 1-4 4M12 17v5M8 22h8",
  cup: "M6 3h12l-2 18H8L6 3ZM7 8h10",
  people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8a3 3 0 0 1 0 6M22 21v-2a4 4 0 0 0-3-4",
  phone: "M7 2h10v20H7zM11 18h2",
  pen: "m15 4 5 5M4 16 16 4a3 3 0 0 1 4 4L8 20l-5 1 1-5Z",
  book: "M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-7a3 3 0 0 0-3 3",
  pause: "M8 5v14M16 5v14",
  skip: "m5 5 9 7-9 7zM19 5v14",
  flag: "M5 21V4h12l-2 4 2 4H5",
  // topic glyphs
  coffee: "M5 8h12v6a6 6 0 0 1-12 0V8ZM17 9h2a3 3 0 0 1 0 6h-2M8 2v3M12 2v3",
  paw: "M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4M17 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4M4 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4M20 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4M12 12c-3 0-5 3-5 6 0 2 2 3 5 2 3 1 5 0 5-2 0-3-2-6-5-6",
  leaf: "M5 19c0-9 6-14 15-14 0 9-5 15-14 15M5 19l8-8",
  film: "M3 3h18v18H3zM7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4",
  pizza: "m3 21 7-18a22 22 0 0 1 11 11L3 21ZM9 6c4 1 7 4 9 8M10 12h.01M13 16h.01M7 17h.01",
  music: "M9 18V5l12-2v13M9 9l12-2M5 15a4 3 0 1 0 0 6 4 3 0 0 0 0-6M17 13a4 3 0 1 0 0 6 4 3 0 0 0 0-6",
});

const ico = (n, s = 22, c = "currentColor", w = 2) => P(I[n]).replace("<svg", `<svg style="width:${s}px;height:${s}px;fill:none;stroke:${c};stroke-width:${w};stroke-linecap:round;stroke-linejoin:round;flex:none"`);
// Art slot: a labelled placeholder for an Astra illustration. IDs match design/app-revamp-v1/ART-BRIEF.md.
// When Astra's file exists in design/app-revamp-v1/art/<file>.png it replaces the placeholder.
function slot(id, label, w, h, { light = false, glyph = "eye", style = "", file = "" } = {}) {
  const img = file ? `<img src="../art/${file}.png" alt="" onerror="this.remove()">` : "";
  return `<div class="slot ${light ? "light" : ""}" style="width:${w}px;height:${h}px;${style}"><span class="num">${id}</span>${P(I[glyph]).replace("<svg", '<svg class="g"')}<span class="lbl">ART · ${label}</span>${img}</div>`;
}
const T = (s, size = 12, c = "var(--kraft-dk)", extra = "") => `<div class="type" style="font-size:${size}px;color:${c};${extra}">${s}</div>`;
const tog = (on, dis) => `<span class="tog ${on ? "on" : ""} ${dis ? "off-dis" : ""}"></span>`;
const dots = (n, on) => `<div class="dots">${Array.from({ length: n }, (_, i) => `${i ? "<b></b>" : ""}<i class="${i < on ? "on" : ""}"></i>`).join("")}</div>`;
const PLAYERS = [["AL", "Alex", "you"], ["MA", "Maya", "t"], ["BE", "Ben", ""], ["CL", "Cleo", "t"], ["KA", "Kai", ""], ["EV", "Eve", ""]];

// ---------------------------------------------------------------- screens
const A = [];
const add = (act, key, title, note, html) => A.push({ act, key, title, note, html });
const pc = (act, key, n, extra = "") => A.push({ act, key, title: S[n].title, note: S[n].note + extra, html: S[n].html, pc: true });

// ===== 1. Getting in
add(1, "welcome", "Welcome", "The case-file cover. The engraved card back replaces the paper cards; the cast illustration sits behind the wordmark.",
  () => `<div class="content" style="padding-top:22px;align-items:center;position:relative">
    <div style="position:absolute;right:18px;top:20px">${T("CASE No. 1.3", 11)}</div>
    ${slot("A1", "THE CAST AROUND A CARD TABLE UNDER ONE HANGING LAMP", 350, 260, { glyph: "people", style: "margin-top:26px", file: "a1-welcome" })}
    <div class="anton" style="font-size:82px;line-height:.9;margin-top:-30px;letter-spacing:1px;text-shadow:0 6px 24px rgba(0,0,0,.6);position:relative">Imposter</div>
    <div style="display:flex;gap:-30px;margin-top:14px;height:120px;position:relative">
      <div style="transform:rotate(-14deg) translate(18px,6px)">${back("mid").replace('class="card back', 'style="--w:86px" class="card back')}</div>
      <div style="transform:translateY(-6px);z-index:2">${back("mid").replace('class="card back', 'style="--w:86px" class="card back')}</div>
      <div style="transform:rotate(14deg) translate(-18px,6px)">${back("mid").replace('class="card back', 'style="--w:86px" class="card back')}</div>
    </div>
    <div style="font-size:24px;font-weight:800;margin-top:12px">Someone is bluffing.</div>
    ${T("ONE ROOM. ONE SECRET. TRUST NO ONE.", 13, "var(--kraft-dk)", "margin-top:6px")}
  </div>
  <div class="bottom"><div class="btn primary">Host party</div><div class="btn secondary small">Join party</div><div class="small center" style="text-decoration:underline">How to play</div></div>`);

add(1, "create", "Host: open a case", "Party setup as a case intake form. Same fields as today: your name, party name, Wi-Fi.",
  () => `${hdr("", { icons: [] })}<div class="content">
    <h1>Make it your party</h1><p class="sub">You'll host from this phone.</p>
    <div class="form" style="margin-top:18px">
      <span class="stamp red" style="position:absolute;right:14px;top:-12px;font-size:13px;background:rgba(232,217,188,.9);transform:rotate(6deg)">New case</span>
      ${T("CASE INTAKE · HOST", 12, "#5b4a2c")}
      <div class="f"><div class="k">YOUR NAME</div><div class="v">Alex</div></div>
      <div class="f"><div class="k">PARTY NAME</div><div class="v">Friday night</div></div>
      <div class="f" style="display:flex;align-items:center;gap:10px;margin-top:16px">${ico("wifi", 20, "#1d1a14")}<div style="flex:1"><div class="k">NETWORK</div><b>Home Wi-Fi</b> <span style="color:#2f6b2f;font-weight:700">· Connected</span></div>${ico("x", 0)}</div>
    </div>
  </div><div class="bottom"><div class="btn primary">Continue</div></div>`);

add(1, "battery", "Host: stay connected", "The battery-usage step, with an illustration instead of the three line-drawn phones.",
  () => `${hdr("", { icons: [] })}<div class="content">
    <h1>Keep the party connected</h1>
    ${slot("A2", "THREE PHONES ON A TABLE, TIED TOGETHER WITH RED STRING", 350, 220, { glyph: "phone", style: "margin:16px 0", file: "a2-connected" })}
    <p class="sub" style="color:var(--ink);font-size:18px;line-height:1.4">Allow background usage so your party stays connected.</p>
    <div class="panel" style="display:flex;align-items:center;gap:12px;margin-top:14px">${ico("battery", 24, "var(--muted)")}<div style="flex:1"><b>Battery usage</b><div style="color:var(--terra);font-size:14px">Setup needed</div></div></div>
  </div><div class="bottom"><div class="btn primary">Open battery settings</div><div class="small center" style="text-decoration:underline">Keep app open instead</div></div>`);

add(1, "host-lobby", "Host lobby", "The host's lobby as the case board: suspects with READY stamps, the session line, the invitation, and tonight's cast with the role art.",
  () => `<div class="hdr"><span style="flex:1"></span><span class="ico">${P(I.gear)}</span><span class="ico">${P(I.exit)}</span></div>
  <div class="content" style="margin-top:-8px">
    ${T("CASE · FRIDAY NIGHT", 12)}
    <div style="display:flex;align-items:flex-end;gap:10px"><h1 style="font-size:36px;margin:2px 0 4px;flex:1">Cast of 6</h1>
      <div class="panel" style="padding:6px 10px;display:flex;align-items:center;gap:6px;border-color:#4a4236">${ico("qr", 18, "var(--kraft)")}<span class="type" style="font-size:11px;color:var(--kraft)">INVITE</span></div></div>
    <div class="small" style="display:flex;align-items:center;gap:6px">${ico("wifi", 14)}Hosting · Home Wi-Fi · ${ico("trophy", 14)} First to 20</div>
    <div class="rows" style="margin-top:10px">
      ${PLAYERS.map(([n, nm, c], i) => `<div class="row" style="padding:7px 0">${av(n, c, "sm")}<div class="grow"><b>${nm}</b>${i === 0 ? '<span class="small"> · You · Host</span>' : ""}</div>${i === 0 ? ico("crown", 20, "var(--lime)") : i < 5 ? `<span class="stamp lime" style="font-size:10px;padding:1px 6px;transform:rotate(-4deg)">Ready</span>` : `<span class="small">Joining…</span>`}</div>`).join("")}
    </div>
    <div style="margin-top:12px;background:#211f19;border:1px solid #4a4236;border-radius:14px;padding:10px 12px">
      <div style="display:flex;justify-content:space-between;align-items:center">${T("TONIGHT'S CAST", 12)}<span class="pill gold" style="height:22px;font-size:10px">${P(I.auto)}Power cards on</span></div>
      <div class="roles" style="margin-top:8px">${[["imposter", "Imposter"], ["accomplice", "Accompl."], ["detective", "Detective"], ["judge", "Judge"], ["decoy", "Decoy"], ["gambler", "Gambler"]].map(([f, n]) => `<div class="r"><span class="face" style="width:40px;height:40px;background-image:url(${ART(f)})"></span><span class="nm2">${n}</span></div>`).join("")}</div>
    </div>
  </div><div class="bottom"><div class="btn primary">Start round 1</div></div>`);

add(1, "settings", "Session settings", "The settings sheet gains the Power cards switch. It's disabled below 6 players, with the reason shown.",
  () => `<div class="content" style="opacity:.35;padding-top:30px"><h1>Cast of 6</h1></div><div class="scrim"></div>
  <div class="sheet"><div class="handle"></div>
    <div style="display:flex;align-items:center"><h2 style="font-size:24px;flex:1">Session settings</h2>${ico("x", 22, "var(--muted)")}</div>
    ${T("FIRST TO", 12, "var(--kraft-dk)", "margin:16px 0 8px")}
    <div class="seg" style="grid-template-columns:repeat(5,1fr)">${[10, 15, 20, 25, 30].map((v) => `<span class="${v === 20 ? "on" : ""}">${v}</span>`).join("")}</div>
    <div class="rows" style="margin-top:16px">
      <div class="row"><div class="grow"><b>Random round rules</b><div class="small">A surprise rule before every topic vote.</div></div>${tog(true)}</div>
      <div class="row"><div class="grow"><b style="display:flex;align-items:center;gap:6px">${ico("auto", 16, "var(--gold)")}Power cards</b><div class="small">Draw, hold and play cards. 6 or more players.</div></div>${tog(true)}</div>
      <div class="row"><div class="grow"><b>Adult packs</b><div class="small">Relationships, Sex education, Body & puberty, Consent.</div></div>${tog(false)}</div>
      <div class="row" style="border-bottom:0"><div class="grow"><b>Topic packs</b><div class="small">23 packs · 19 on</div></div>${ico("back", 20, "var(--muted)").replace("<svg", '<svg transform="scale(-1,1)"')}</div>
    </div>
    <div class="btn primary" style="margin-top:8px">Done</div>
  </div>`);

add(1, "scan", "Guest: find the party", "Scanning the invitation. The viewfinder corners and the typewriter label carry the theme; no art needed.",
  () => `${hdr("", { icons: [] })}<div class="content">
    <h1>Find your party</h1><p class="sub">Scan the QR on your host's phone.</p>
    <div style="margin-top:18px;height:330px;border-radius:22px;background:#0f1210;position:relative;display:grid;place-items:center;overflow:hidden">
      ${["left:20px;top:20px;border-width:3px 0 0 3px", "right:20px;top:20px;border-width:3px 3px 0 0", "left:20px;bottom:20px;border-width:0 0 3px 3px", "right:20px;bottom:20px;border-width:0 3px 3px 0"].map((s) => `<i style="position:absolute;width:34px;height:34px;border-style:solid;border-color:var(--lime);${s}"></i>`).join("")}
      <div style="width:150px;height:150px;border-radius:12px;background:repeating-linear-gradient(90deg,#d6cfc0 0 9px,transparent 9px 14px),repeating-linear-gradient(0deg,#d6cfc0 0 9px,transparent 9px 14px);opacity:.18"></div>
      <div style="position:absolute;bottom:22px">${T("POINT AT THE HOST'S INVITATION", 12)}</div>
    </div>
  </div><div class="bottom"><div class="btn primary">${ico("camera", 20, "#141916")}<span style="margin-left:8px">Scan invitation</span></div><div class="small center" style="text-decoration:underline">Enter invitation instead</div></div>`);

add(1, "wifi", "Guest: same Wi-Fi", "The Wi-Fi check, with an illustration in place of the empty space.",
  () => `${hdr("", { icons: [] })}<div class="content">
    <h1>Same room.<br>Same Wi-Fi.</h1><p class="sub">Connect to the host's router before joining.</p>
    ${slot("A3", "AN OLD TABLE RADIO WITH ITS DIAL GLOWING", 350, 200, { glyph: "wifi", style: "margin:16px 0", file: "a3-wifi" })}
    <div class="panel" style="display:flex;align-items:center;gap:12px">${ico("wifi", 22, "var(--muted)")}<div><b>Home Wi-Fi</b><div style="color:var(--terra);font-size:14px">Connection needed</div></div></div>
    <p class="small" style="margin-top:10px">Internet isn't required. Everyone needs the same local Wi-Fi.</p>
  </div><div class="bottom"><div class="btn primary">Open Wi-Fi settings</div><div class="btn secondary small">Check connection</div></div>`);

add(1, "identity", "Guest: your name", "Choosing a name becomes a booking photo: initials against a height chart, with the name on the board.",
  () => `<div class="content" style="padding-top:16px">
    <div style="display:flex;align-items:center;gap:10px"><span class="av" style="width:34px;height:34px;background:var(--lime)">${ico("check", 18, "#141916", 3)}</span><div><b>Host reachable</b><div class="small">Friday night · Host: Alex</div></div></div>
    <h1 style="margin-top:18px">What should we call you?</h1>
    <div class="booking" style="margin-top:14px"><div class="marks"><span>6'</span><span>5'</span><span>4'</span><span>3'</span></div>
      <span class="av" style="position:absolute;left:50%;bottom:-20px;transform:translateX(-50%);width:150px;height:150px;font-size:54px;border-radius:50% 50% 30px 30px">SA</span>
      <div class="nameplate" style="position:absolute;left:50%;top:96px;transform:translateX(-50%) rotate(-2deg);font-size:13px;white-space:nowrap">SAM · FRIDAY NIGHT</div>
    </div>
    ${T("YOUR NAME", 12, "var(--kraft-dk)", "margin-top:18px")}
    <div style="border-bottom:2px solid var(--kraft-dk);padding:8px 0;font-size:22px;font-weight:700">Sam</div>
  </div><div class="bottom"><div class="btn primary">Join party</div></div>`);

add(1, "guest-lobby", "Guest lobby", "The guest's view of the case board. READY stamps replace the check marks.",
  () => `<div class="hdr"><span style="flex:1"></span><span class="ico">${P(I.exit)}</span></div><div class="content" style="margin-top:-8px">
    ${T("CASE · FRIDAY NIGHT", 12)}<h1 style="font-size:34px;margin:2px 0 2px">The suspects</h1>
    <div class="small" style="display:flex;align-items:center;gap:6px">${ico("wifi", 14)}Home Wi-Fi · <span style="color:var(--lime)">Connected</span></div>
    <div class="rows" style="margin-top:12px">${[["AL", "Alex", "you", "Host"], ["SA", "Sam", "", "You"], ["MA", "Maya", "t", ""], ["BE", "Ben", "", ""]].map(([n, nm, c, s], i) => `<div class="row">${av(n, i === 1 ? "you" : c === "you" ? "" : c)}<div class="grow"><div class="name">${nm}</div>${s ? `<div class="small">${s}</div>` : ""}</div>${i === 0 ? ico("crown", 22, "var(--lime)") : i > 1 ? `<span class="stamp lime" style="font-size:11px;transform:rotate(-4deg)">Ready</span>` : ""}</div>`).join("")}</div>
    <div class="row" style="border-bottom:1px solid var(--line)">${ico("flag", 20, "var(--muted)")}<div class="grow"><b>Topics</b><div class="small">Animals · Food · Movies</div></div></div>
  </div><div class="bottom"><div class="btn primary">I'm ready</div><div class="small center">Waiting for Alex to start.</div></div>`);

// ===== 2. The round begins
add(2, "rule-shuffle", "Rule draw", "Every phone at once: the round's rule is shuffled with the engraved card backs.",
  () => `${hdr("Round 5 · Rule", { icons: ["gear", "qr"] })}<div class="content" style="align-items:center">
    <h1 style="text-align:center;margin-top:24px">Choosing this<br>round's rule.</h1>
    <div style="position:relative;width:240px;height:300px;margin-top:30px">
      ${[-16, -5, 7].map((r, i) => `<div style="position:absolute;left:${40 + i * 12}px;top:${10 + i * 6}px;transform:rotate(${r}deg)">${back("").replace('class="card back', 'style="--w:150px" class="card back')}</div>`).join("")}
    </div>
    ${T("EVERYONE GETS THE SAME RULE", 13, "var(--kraft-dk)", "margin-top:16px")}
  </div>`);

add(2, "rule-reveal", "Rule revealed", "The rule card keeps its ivory layout; each of the six rules gets its own engraved illustration.",
  () => `${hdr("Round 5 · Rule", { icons: ["gear", "qr"] })}<div class="content" style="align-items:center">
    <h1 style="text-align:center;margin-top:6px;font-size:28px">Make sounds. No words.</h1><p class="sub center">The rule for everyone this round.</p>
    <div class="ivory" style="width:100%;margin-top:16px;padding:16px;position:relative">
      ${T("THIS ROUND", 12, "#5b4a2c", "text-align:center")}
      ${slot("A5", "SOUND ONLY · A GRAMOPHONE HORN BLASTING NOTES", 318, 200, { light: true, glyph: "music", style: "margin:10px auto", file: "a5-rule-sound-only" })}
      <div class="anton center" style="font-size:44px;line-height:1">Sound Only</div>
      <div class="center" style="font-size:16px;margin-top:6px">Clue with a sound. No words, no gestures.</div>
      <span class="stamp red" style="position:absolute;right:12px;top:12px;font-size:12px;transform:rotate(8deg)">Rule 3</span>
    </div>
    <div style="width:100%;margin-top:18px">${T("TOPIC VOTING OPENS NEXT", 12, "var(--kraft-dk)", "text-align:center;margin-bottom:8px")}<div style="height:4px;border-radius:2px;background:var(--line)"><div style="width:62%;height:100%;border-radius:2px;background:var(--lime)"></div></div></div>
  </div>`);

add(2, "topic-vote", "Topic vote", "Tiles keep the approved grid. The paper-cut icons become small engraved emblems (one per pack).",
  () => `${hdr("Round 5 · Topic vote", { icons: ["gear"] })}<div class="content">
    <h1 style="font-size:28px">What should we play?</h1><p class="sub">Choose one or more topics.</p>
    <div class="tiles" style="margin-top:12px">${[["coffee", "Everyday", 0], ["pizza", "Food", 1], ["paw", "Animals", 1], ["leaf", "Nature", 0], ["film", "Movies", 0], ["music", "Music", 0]].map(([g, n, on]) => `<div class="tile ${on ? "on" : ""}">${on ? `<span class="ck">${P(I.check)}</span>` : ""}${slot("", "", 54, 54, { glyph: g, style: "border-radius:12px;border-width:1px", file: "a6-topic-" + n.toLowerCase() }).replace('<span class="lbl">ART · </span>', "")}${n}</div>`).join("")}</div>
    <div style="margin-top:14px">${dots(6, 2)}</div><p class="small center" style="margin-top:8px">2 of 6 players voted · 2 topics selected</p>
    ${T("A6 · ENGRAVED TOPIC EMBLEMS, ONE PER PACK (23)", 11, "var(--kraft-dk)", "text-align:center;margin-top:4px")}
  </div><div class="bottom"><div class="btn primary">Lock my vote</div></div>`);

add(2, "topic-chosen", "Topic chosen", "The winning topic, the rule reminder, then (with power cards on) the draw window opens.",
  () => `${hdr("Round 5", { icons: ["gear", "qr"] })}<div class="content" style="align-items:center">
    ${T("SOUND ONLY · ANIMALS", 13, "var(--kraft-dk)", "margin-top:6px")}
    <h1 style="text-align:center;margin-top:10px">Tonight's case:</h1>
    <div class="ivory" style="width:100%;margin-top:14px;padding:22px;text-align:center;position:relative">
      ${slot("A6", "ANIMALS EMBLEM", 130, 130, { light: true, glyph: "paw", style: "margin:0 auto 12px", file: "a6-topic-animals" })}
      <div class="anton" style="font-size:52px;line-height:1">Animals</div>
      <div style="font-size:15px;margin-top:4px">3 votes · won the tie draw</div>
      <span class="stamp red" style="position:absolute;left:14px;top:14px;font-size:12px;transform:rotate(-8deg)">Chosen</span>
    </div>
    <p class="sub center" style="margin-top:20px">Power cards next: draw before roles are dealt.</p>
  </div><div class="bottom"><div class="btn primary">Continue</div></div>`);

pc(2, "draw", 1);
pc(2, "sealed", 2);

add(2, "role-poster", "Your role", "The role poster stays as approved (engraved art, Anton name). A CLASSIFIED stamp and typewriter side label add the theme.",
  () => `${hdr("Round 5 · Alex", { icons: ["info"] })}<div class="content" style="align-items:center;position:relative">
    <div style="width:330px;height:330px;margin-top:4px;background:url(${ART("judge")}) center / contain no-repeat;filter:drop-shadow(0 20px 30px rgba(0,0,0,.5))"></div>
    <span class="stamp red" style="position:absolute;right:26px;top:22px;font-size:14px;transform:rotate(10deg)">Classified</span>
    ${T("CIVILIAN SIDE", 13, "var(--lime)", "margin-top:8px")}
    <div class="role-stage-name anton" style="font-size:76px;line-height:1">Judge</div>
    <div style="font-size:20px;font-weight:800;margin-top:6px">Catch the imposter. Ties are yours.</div>
    <p class="small center" style="margin-top:6px;font-size:15px">Your vote counts twice. Breaks any tie that catches the imposter.</p>
  </div><div class="bottom"><div class="btn primary">See my word</div></div>`);

add(2, "concealed", "Card face down", "The private card waits face down (the engraved back) until you hold to reveal it.",
  () => `${hdr("Round 5", { icons: ["eye", "qr"] })}<div class="content" style="align-items:center">
    ${T("SOUND ONLY · ANIMALS", 13, "var(--kraft-dk)", "margin-top:4px")}
    <h1 style="text-align:center;margin-top:14px">For your eyes only.</h1>
    <div style="margin-top:20px;position:relative">${back("").replace('class="card back', 'style="--w:240px" class="card back')}<span class="stamp red" style="position:absolute;left:-10px;bottom:30px;font-size:15px;background:rgba(23,26,24,.85);transform:rotate(-12deg)">Top secret</span></div>
    <p class="sub center" style="margin-top:20px">Keep your screen private.</p>
  </div><div class="bottom"><div class="btn primary">Hold to reveal</div></div>`);

add(2, "word", "Your word", "The ivory word panel as approved, with typewriter labels. Swipe for the definition, as today.",
  () => `${hdr("Round 5 · Alex", { icons: ["info"] })}<div class="content" style="align-items:center">
    <span class="pill" style="background:#2f3a18;color:var(--lime);margin-top:4px">${P(I.target)}Judge</span>
    <h1 style="text-align:center;margin-top:12px">Your word</h1>
    <div class="ivory" style="width:100%;margin-top:12px;padding:22px 20px;text-align:center;position:relative;height:330px;display:flex;flex-direction:column;align-items:center;justify-content:center">
      ${T("THE WORD · ANIMALS", 12, "#5b4a2c")}
      <div style="font-size:58px;font-weight:800;letter-spacing:-1px;margin-top:8px">Owl</div>
      <div style="font-size:15px;color:#4b4a42;margin-top:10px;max-width:250px">A night bird with large forward-facing eyes.</div>
      ${T("SWIPE FOR THE MEANING →", 11, "#8a7a5a", "position:absolute;bottom:14px")}
      <span class="stamp red" style="position:absolute;right:14px;top:14px;font-size:12px;transform:rotate(8deg)">Eyes only</span>
    </div>
    <div class="panel" style="margin-top:14px;width:100%;font-size:15px;color:var(--muted)">Your vote counts twice. Ties go your way when you caught the imposter.</div>
  </div><div class="bottom"><div class="btn primary">Hide & ready</div></div>`);

add(2, "hint", "Imposter's hint", "The Imposter's version: the hint on the ivory panel with the terracotta label, plus the pair-up reminder.",
  () => `${hdr("Round 5 · Dev", { icons: ["info"] })}<div class="content" style="align-items:center">
    <span class="pill terra" style="margin-top:4px">${P(I.eye)}Imposter</span>
    <h1 style="text-align:center;margin-top:12px">You are the imposter</h1>
    <div class="ivory" style="width:100%;margin-top:12px;padding:22px 20px;text-align:center;position:relative;height:310px;display:flex;flex-direction:column;align-items:center;justify-content:center">
      ${T("YOUR STARTING HINT", 12, "#5b4a2c")}
      <div style="font-size:54px;font-weight:800;letter-spacing:-1px;margin-top:8px">Night</div>
      <div style="font-size:15px;color:#4b4a42;margin-top:10px;max-width:250px">Close to the word, not the word. Blend in.</div>
      <span class="stamp red" style="position:absolute;right:14px;top:14px;font-size:12px;transform:rotate(8deg)">Forged</span>
    </div>
    <div class="panel" style="margin-top:14px;width:100%;font-size:15px;color:var(--muted)">Your accomplice knows you. Name them, and the decoy, when you vote.</div>
  </div><div class="bottom"><div class="btn primary">Hide & ready</div></div>`);

add(2, "ready-wait", "Waiting for everyone", "After hiding the card: the dots fill as players finish checking their role.",
  () => `${hdr("Round 5", { icons: ["eye", "qr"] })}<div class="content" style="align-items:center">
    <div style="margin-top:60px;position:relative">${back("").replace('class="card back', 'style="--w:170px" class="card back')}<span class="stamp lime" style="position:absolute;right:-26px;top:40px;font-size:16px;background:rgba(20,25,22,.85);transform:rotate(10deg)">Sealed</span></div>
    <h1 style="text-align:center;margin-top:26px">Your secret is safe.</h1>
    <p class="sub center">4 of 6 players ready</p><div style="margin-top:14px">${dots(6, 4)}</div>
  </div><div class="bottom"><div class="small center" style="font-size:16px">Waiting for everyone to check their role.</div></div>`);

// ===== 3. Discussion
pc(3, "discussion", 3);
pc(3, "hand", 4);
pc(3, "detail", 5);
pc(3, "confirm", 6);
pc(3, "golden", 7);
pc(3, "private", 8);
add(3, "round-settings", "Host: round settings", "The host's in-round sheet: pause, skip a spoiled round, and the session switches.",
  () => `${S[3].html()}<div class="scrim"></div><div class="sheet"><div class="handle"></div>
    <div style="display:flex;align-items:center"><h2 style="font-size:24px;flex:1">Round settings</h2>${ico("x", 22, "var(--muted)")}</div>
    <div class="rows" style="margin-top:12px">
      <div class="row">${ico("pause", 22, "var(--muted)")}<div class="grow"><b>Pause round</b><div class="small">Freeze every phone where it is.</div></div></div>
      <div class="row">${ico("skip", 22, "var(--terra)")}<div class="grow"><b>Skip round</b><div class="small">A fresh round. Points, held cards and played words stay.</div></div></div>
      <div class="row"><div class="grow"><b>Random round rules</b><div class="small">Applies from next round.</div></div>${tog(true)}</div>
      <div class="row" style="border-bottom:0"><div class="grow"><b>Power cards</b><div class="small">Applies from next round.</div></div>${tog(true)}</div>
    </div><div class="btn primary" style="margin-top:6px">Done</div></div>`);

// ===== 4. The vote
pc(4, "ballot", 9);
add(4, "locked", "Vote locked", "The locked vote as a wax-sealed envelope (Astra can engrave it). Progress dots never show who voted for whom.",
  () => `${hdr("Round 5 · Vote", { hand: 1 })}<div class="content" style="align-items:center">
    ${T("EVIDENCE SUBMITTED", 13, "var(--kraft-dk)", "margin-top:40px")}
    <div style="margin-top:16px;position:relative">${slot("A7", "SEALED ENVELOPE WITH A WAX SEAL", 240, 160, { glyph: "lock", file: "a7-envelope" })}</div>
    <h1 style="text-align:center;margin-top:24px">Your vote is locked</h1>
    <p class="sub center">You voted for <b style="color:var(--terra)">Cleo</b> · ×3 Heavy Vote</p>
    <p class="small center" style="margin-top:10px">Judge bet: 3 · Underdog</p>
    <div style="margin-top:18px">${dots(6, 3)}</div><p class="small center" style="margin-top:8px">3 of 6 votes in</p>
  </div><div class="bottom"><div class="btn secondary" style="color:var(--muted)">Waiting for everyone</div></div>`);

// ===== 5. Results
add(5, "personal", "Your result (beat)", "Each phone's own two-second beat, now a stamped verdict: CORRECT, CAUGHT, ESCAPED or SPOTTED.",
  () => `${hdr("Round 5 · Results", { icons: ["gear", "qr"] })}<div class="content" style="align-items:center;justify-content:center;position:relative">
    <div class="glow" style="top:42%;background:radial-gradient(circle,rgba(214,245,107,.18),transparent 65%)"></div>
    ${slot("A8", "VERDICT VIGNETTE · CORRECT: A MAGNIFYING GLASS OVER A FINGERPRINT", 190, 190, { glyph: "lens", style: "border-radius:50%;position:relative", file: "a8-correct" })}
    <span class="stamp lime" style="font-size:38px;margin-top:-30px;background:rgba(20,25,22,.9);position:relative">Correct</span>
    <h1 style="text-align:center;margin-top:22px;position:relative">You caught Cleo</h1>
    <div style="font-size:64px;font-weight:800;color:var(--lime);position:relative">+9</div>
  </div>`);

add(5, "your-result", "Your result", "Your breakdown, with card and Bounty lines alongside the role lines.",
  () => `${hdr("Round 5 · You", { icons: ["gear", "qr"] })}<div class="content">
    <div style="display:flex;align-items:center;gap:12px;margin-top:4px"><span class="stamp lime" style="font-size:22px;transform:rotate(-6deg)">Correct</span><span class="pill" style="background:#2f3a18;color:var(--lime)">${P(I.target)}Judge</span></div>
    <h1 style="margin-top:14px">You caught Cleo</h1><div style="font-size:56px;font-weight:800;color:var(--lime);line-height:1">+9 points</div>
    <div class="rows" style="margin-top:16px">${[["Voted Cleo (Judge)", "+2"], ["Judge bet · 3", "+3"], ["Underdog bonus", "+1"], ["Bounty · Cleo led and was caught", "+2"], ["Rare · Heavy Vote", "×3 weight"], ["Pending report deduction", "+1", "−"]].slice(0, 5).map(([k, v]) => `<div class="row" style="padding:11px 0"><span class="grow" style="font-size:16px">${k}</span><b style="color:${v.startsWith("+") ? "var(--lime)" : "var(--muted)"};font-size:18px">${v}</b></div>`).join("")}
      <div class="row" style="padding:11px 0"><span class="grow" style="font-size:16px">Report deduction (round 4)</span><b style="color:var(--terra);font-size:18px">−1</b></div></div>
    <div style="margin-top:14px;display:flex;align-items:baseline;justify-content:space-between"><b style="font-size:20px">Your score</b><b style="font-size:28px">1 → 9</b></div>
    <div style="height:8px;border-radius:4px;background:var(--line);margin-top:8px"><div style="width:45%;height:100%;border-radius:4px;background:var(--lime)"></div></div><p class="small" style="margin-top:6px">9 / 20 · Session target</p>
  </div><div class="bottom"><div class="btn primary">See the room</div></div>`);

add(5, "room", "The room", "The verdict as a front-page clipping, then everyone's results with stamped outcomes.",
  () => `${hdr("Round 5 · Results", { icons: ["gear", "qr"] })}<div class="content">
    <div class="verdict">
      <div style="display:flex;gap:14px;align-items:center">
        <div class="mug" style="width:84px;height:96px"><span class="av t" style="width:66px;height:66px;font-size:22px;margin-bottom:-8px;border-radius:50% 50% 8px 8px">CL</span></div>
        <div style="flex:1">${T("THE VERDICT", 11, "#5b4a2c")}<div class="anton" style="font-size:34px;line-height:1">Cleo caught</div><div style="font-size:14px;font-weight:600;margin-top:4px">Imposter · 4 of 6 votes</div></div>
      </div>
      <span class="stamp red" style="position:absolute;right:12px;bottom:12px;font-size:16px;transform:rotate(-10deg)">Guilty</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 4px">${T("EVERYONE'S RESULTS", 12)}<span class="small">Word: Owl · Hint: Night</span></div>
    <div class="rows">${[["CL", "Cleo", "t", "Imposter", "bad", "Caught", "−2"], ["AL", "Alex", "you", "Judge · You", "ok", "Correct", "+9"], ["KA", "Kai", "", "Gambler", "ok", "Correct", "+12"], ["MA", "Maya", "t", "Detective", "ok", "Correct", "+3"], ["BE", "Ben", "", "Accomplice", "bad", "Spotted", "0"], ["EV", "Eve", "", "Decoy", "ok", "Correct", "+2"]].map(([n, nm, c, r, k, l, p]) => `<div class="row" style="padding:7px 0">${av(n, c, "sm")}<div class="grow"><b>${nm}</b><div class="small" style="font-size:12px">${r}</div></div><span class="res ${k}">${l}</span><b style="width:36px;text-align:right">${p}</b></div>`).join("")}</div>
  </div><div class="bottom"><div class="btn primary">Cards this round</div></div>`);

pc(5, "replay", 10);

add(5, "report", "Report a rule-break", "Reporting becomes filing a complaint: the same private multi-select, on a kraft form.",
  () => `${A.find((s) => s.key === "room").html()}<div class="scrim"></div><div class="sheet"><div class="handle"></div>
    <div class="form">
      <div style="display:flex;align-items:center">${T("COMPLAINT · ROUND 5", 12, "#5b4a2c", "flex:1")}${ico("x", 20, "#5b4a2c")}</div>
      <div style="font-size:22px;font-weight:800;margin-top:6px">Report a rule-break</div>
      <div style="font-size:14px;margin-top:2px">Pick one or more players. Reports are private.</div>
      ${[["MA", "Maya", 0], ["BE", "Ben", 1], ["CL", "Cleo", 0], ["KA", "Kai", 0], ["EV", "Eve", 0]].map(([n, nm, on]) => `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px dashed rgba(29,26,20,.3)"><span style="width:22px;height:22px;border:2px solid #1d1a14;border-radius:4px;display:grid;place-items:center">${on ? ico("check", 16, "#c4503a", 3.4) : ""}</span>${av(n, "", "xs")}<b style="flex:1">${nm}</b>${on ? `<span class="stamp red" style="font-size:10px">Reported</span>` : ""}</div>`).join("")}
    </div>
    <div class="btn primary" style="margin-top:14px">File report</div></div>`);

// ===== 6. Drink or Dare
add(6, "choose", "Drink or Dare", "The loser's choice, with an illustration for each option.",
  () => `${hdr("Drink or Dare", { icons: [] })}<div class="content" style="align-items:center">
    ${T("SENTENCING · TURN 1 OF 2", 13, "var(--kraft-dk)", "margin-top:4px")}
    <h1 style="text-align:center;margin-top:8px;font-size:34px">Ben, your turn.</h1>
    <p class="sub center">The app picked you first.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;margin-top:20px">
      ${[["A9", "DRINK · A WHISKEY GLASS, ICE AND A SPLASH", "cup", "Drink", 1], ["A10", "DARE · A LIT MATCH OVER A PLAYING CARD", "flag", "Dare", 0]].map(([id, l, g, n, sel]) => `<div style="border:1.5px solid ${sel ? "var(--lime)" : "var(--line)"};border-radius:18px;padding:10px;background:${sel ? "#232b20" : "var(--surface)"};text-align:center">${slot(id, l, 145, 170, { glyph: g, file: id.toLowerCase() + "-" + n.toLowerCase() })}<div class="anton" style="font-size:30px;margin-top:8px">${n}</div></div>`).join("")}
    </div>
  </div><div class="bottom"><div class="btn primary">Drink</div><div class="small center" style="text-decoration:underline">Skip</div></div>`);

add(6, "dare-giver", "The dare giver", "Everyone's phone: who gives the dare, as two mugshots and an arrow.",
  () => `${hdr("Drink or Dare", { icons: ["gear", "qr"] })}<div class="content" style="align-items:center">
    ${T("SENTENCING · TURN 2 OF 2", 13, "var(--kraft-dk)", "margin-top:4px")}
    <h1 style="text-align:center;margin-top:8px">Eve gives Kai<br>a dare.</h1>
    <div style="display:flex;align-items:center;gap:14px;margin-top:30px">
      ${[["EV", "Eve", "Dare giver"], ["KA", "Kai", "Their turn"]].map(([n, nm, s], i) => `${i ? `<div style="color:var(--lime);font-size:28px">⟶</div>` : ""}<div style="text-align:center"><div class="mug" style="width:118px;height:138px;margin:0 auto"><span class="av" style="width:92px;height:92px;font-size:30px;margin-bottom:-10px;border-radius:50% 50% 10px 10px">${n}</span></div><div class="nameplate" style="margin-top:8px;font-size:12px">${s.toUpperCase()}</div></div>`).join("")}
    </div>
    <p class="sub center" style="margin-top:30px;color:var(--ink)">Eve makes it up.<br>The room takes it from here.</p>
  </div><div class="bottom"><div class="small center" style="font-size:16px">Waiting for Kai to finish.</div></div>`);

// ===== 7. Standings and the end of the night
pc(7, "standings", 11);
add(7, "complete", "Session complete", "The winner's moment: CASE CLOSED, the trophy illustration and the existing restrained confetti.",
  () => `${hdr("Session complete", { icons: [] })}<div class="content" style="align-items:center;position:relative">
    ${["#d6f56b", "#d98672", "#b4c8ad", "#e9c46a"].map((c, i) => Array.from({ length: 4 }, (_, k) => `<i style="position:absolute;left:${k % 2 ? 300 + ((i * 23 + k * 7) % 60) : (i * 19 + k * 11) % 60}px;top:${(k * 53 + i * 37) % 230}px;width:9px;height:14px;border-radius:2px;background:${c};transform:rotate(${i * 40 + k * 25}deg);opacity:.8"></i>`).join("")).join("")}
    ${slot("A11", "TROPHY · A GOLD CUP ON A STACK OF CASE FILES", 220, 220, { glyph: "trophy", style: "margin-top:16px;position:relative", file: "a11-trophy" })}
    <span class="stamp red" style="font-size:20px;margin-top:-26px;background:rgba(20,25,22,.9);position:relative">Case closed</span>
    ${T("FIRST TO 20 · 9 ROUNDS", 13, "var(--kraft-dk)", "margin-top:16px")}
    <div class="anton" style="font-size:64px;line-height:1;margin-top:4px">Kai wins</div>
    <div style="font-size:26px;font-weight:800;color:var(--lime)">21 points</div>
    <div class="rows" style="width:100%;margin-top:12px">${[["2", "MA", "Maya", 18], ["3", "AL", "Alex", 15], ["4", "BE", "Ben", 14]].map(([r, n, nm, s]) => `<div class="row" style="padding:7px 0"><b style="width:16px;color:var(--dim)">${r}</b>${av(n, "", "xs")}<span class="grow">${nm}</span><b>${s}</b></div>`).join("")}</div>
  </div><div class="bottom"><div class="btn primary">Story of the night</div></div>`);
pc(7, "story", 12);

// ===== 8. Anywhere
add(8, "reconnecting", "Reconnecting", "Lost connection, themed: the line went dead. Same copy and actions as today.",
  () => `<div class="content" style="align-items:center;padding-top:40px">
    ${slot("A4", "A TELEPHONE HANDSET DANGLING OFF THE HOOK", 300, 230, { glyph: "phone", file: "a4-reconnecting" })}
    <h1 style="text-align:center;margin-top:24px">Hold that thought.</h1>
    <p class="sub center" style="color:var(--ink)">Reconnecting to Alex's party.</p>
    <p class="small center" style="margin-top:6px;font-size:15px">Your place, score and cards stay with the host while this party is running.</p>
    <div class="panel" style="width:100%;margin-top:18px;display:flex;align-items:center;gap:12px">${ico("wifi", 22, "var(--muted)")}<div><b>Home Wi-Fi</b><div class="small">Checking connection…</div></div></div>
  </div><div class="bottom"><div class="btn secondary small">Check connection</div><div class="small center" style="text-decoration:underline">Leave party</div></div>`);

add(8, "how-to", "How to play", "The help sheet as a field guide: the game, roles, power cards and scoring, each one tap deep.",
  () => `${hdr("Field guide", { icons: [] })}<div class="content">
    ${slot("A12", "FIELD GUIDE COVER · A DETECTIVE'S NOTEBOOK, PEN AND MAGNIFIER", 350, 150, { glyph: "book", file: "a12-field-guide" })}
    <h1 style="margin-top:14px;font-size:28px">How to play</h1>
    <div class="rows" style="margin-top:6px">${[["01", "The game", "One imposter has a hint, not the word. Clue, argue, vote."], ["02", "The cast", "Six roles, dealt by weighted history. Each scores its own way."], ["03", "Power cards", "Draw before roles. One card per round. Golden cards change everything."], ["04", "Underdogs & Bounty", "Fall behind and draws are free. Take down the leader for the Bounty."], ["05", "Drink or Dare", "Lose the round, face the sentence."]].map(([n, t, s]) => `<div class="row" style="align-items:flex-start;padding:11px 0"><span class="type" style="color:var(--kraft-dk);font-size:13px;margin-top:3px">${n}</span><div class="grow"><b style="font-size:17px">${t}</b><div class="small" style="font-size:14px;margin-top:2px">${s}</div></div>${ico("back", 18, "var(--muted)").replace("<svg", '<svg transform="scale(-1,1)"')}</div>`).join("")}</div>
  </div><div class="bottom"><div class="btn secondary small">Close</div></div>`);

const ACTS = { 1: ["Getting in", "Host and guests"], 2: ["The round begins", "Rule, topic, draw, roles"], 3: ["Discussion", "Clues, cards, plays"], 4: ["The vote", "The line-up"], 5: ["Results", "Verdict, replay, reports"], 6: ["Drink or Dare", "Sentencing"], 7: ["The end of the night", "Standings, winner, the paper"], 8: ["Anywhere", "Connection and help"] };

// ---------------------------------------------------------------- render
const qq = new URLSearchParams(location.search);
const root = document.getElementById("app");
A.forEach((s, i) => (s.n = String(i + 1).padStart(2, "0")));
if (qq.get("s")) {
  document.body.classList.add("single");
  const s = A.find((x) => x.key === qq.get("s"));
  root.innerHTML = `<div class="phone">${s.html()}</div>`;
} else {
  let html = `<div class="gallery"><h1>Imposter — app revamp mockups</h1>
    <p class="note">Every screen of the app in the noir case-file theme, in play order (${A.length} screens). Screens marked <span class="tagpc" style="margin:0">Power cards</span> come from design/power-cards-v1. Dashed frames marked <span class="type" style="color:var(--kraft-dk)">ART · A#</span> are illustrations for Astra (design/app-revamp-v1/ART-BRIEF.md). Live motion demos are in the <a href="../../power-cards-v1/mockup/" style="color:#d6f56b">power-cards gallery</a>; sounds are on the <a href="../../sound-v1/" style="color:#d6f56b">sound board</a>.</p>`;
  let act = 0;
  for (const s of A) {
    if (s.act !== act) { act = s.act; html += `<h2 class="act">${act}. ${ACTS[act][0]}<small>${ACTS[act][1]}</small></h2>`; }
    html += `<figure><iframe src="?s=${s.key}" loading="lazy"></iframe><figcaption><b>${s.n}. ${s.title}</b>${s.pc ? '<span class="tagpc">Power cards</span>' : ""}<br>${s.note}</figcaption></figure>`;
  }
  root.innerHTML = html + "</div>";
}
