import { mkdirSync, writeFileSync } from "node:fs";
const names = [
  "Welcome",
  "Create party",
  "Background hosting",
  "Host lobby",
  "Scan invitation",
  "Same Wi-Fi",
  "Player identity",
  "Guest lobby",
  "Topics",
  "Concealed role",
  "Civilian role",
  "Imposter role",
  "Discussion",
  "Secret ballot",
  "Vote locked",
  "Personal result",
  "Drink or Dare",
  "Dare giver",
  "Drink turn",
  "Rankings",
  "Runoff",
  "Reconnecting",
  "Final rankings",
  "How to play",
];
const ids = [
  "welcome",
  "create",
  "host-setup",
  "host-lobby",
  "scan",
  "wifi",
  "identity",
  "guest-lobby",
  "topics",
  "role-concealed",
  "civilian",
  "imposter",
  "discussion",
  "ballot",
  "vote-locked",
  "results",
  "choose",
  "dare",
  "drink",
  "rankings",
  "runoff",
  "reconnecting",
  "final",
  "help",
];
const boards = [
  "01-host-party",
  "02-join-party",
  "03-topics-and-roles",
  "04-voting-and-results",
  "05-punishment-and-rankings",
  "06-branches-and-ending",
];
const columns = [54, 462, 870, 1279];
const css = `*{box-sizing:border-box}body{margin:0;background:#edeae2;color:#171a18;font-family:Arial,sans-serif}header{padding:28px 32px;border-bottom:1px solid #cecac0}header h1{margin:0 0 8px;font-size:28px}header p{margin:0;line-height:1.5;max-width:850px;color:#536050}nav{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}nav a{color:inherit;padding:7px 10px;border:1px solid #b8beb0;border-radius:8px;text-decoration:none}section{padding:26px 32px;border-bottom:1px solid #cecac0;scroll-margin-top:10px}h2{font-size:22px;margin:0 0 20px}.pairs{display:grid;grid-template-columns:repeat(2,710px);gap:28px 35px}.pair h3{font-size:17px;margin:0 0 10px}.frames{display:grid;grid-template-columns:344px 344px;gap:14px}.frame{margin:0}.label{font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;display:block;margin:0 0 8px;color:#4b5846}.reference,.capture{width:344px;height:662px;background:#141916;overflow:hidden;border-radius:16px;position:relative}.reference img{position:absolute;width:1672px;height:941px;max-width:none;top:-150px}.capture img{display:block;width:344px;height:auto}.before{display:none}body[data-mode=before] .after{display:none}body[data-mode=before] .before{display:block}.toggle{border:1px solid #7d8b71;background:#d6f56b;padding:10px 14px;border-radius:8px;font-weight:bold;cursor:pointer}@media(max-width:1450px){.pairs{grid-template-columns:710px}}@media(max-width:760px){section{padding:20px 14px}.pairs{grid-template-columns:1fr}.frames{grid-template-columns:1fr}.reference,.capture{width:344px;max-width:100%}}`;
const body = boards
  .map(
    (board, b) =>
      `<section id="board-${b + 1}"><h2>${String(b + 1).padStart(2, "0")} / ${["Bring everyone together", "Join the same room", "A secret on every screen", "Trust your instinct", "Face the room", "Keep the party moving"][b]}</h2><div class="pairs">${names
        .slice(b * 4, b * 4 + 4)
        .map((name, c) => {
          const i = b * 4 + c,
            num = String(i + 1).padStart(2, "0"),
            file = `${num}-${ids[i]}.png`;
          return `<article class="pair"><h3>${num} · ${name}</h3><div class="frames"><figure class="frame"><figcaption class="label">Approved proposal</figcaption><div class="reference"><img style="left:-${columns[c]}px" src="../../../design/proposal-v1/${board}.png" alt="Approved ${name} screen"></div></figure><figure class="frame"><figcaption class="label">Current app <span class="after">After refinement</span><span class="before">Before refinement</span></figcaption><div class="capture"><img class="after" src="../visual-after/${file}" alt="Current ${name} screenshot"><img class="before" src="../visual-before/${file}" alt="Before ${name} screenshot"></div></figure></div></article>`;
        })
        .join("")}</div></section>`,
  )
  .join("");
mkdirSync("output/playwright/visual-review", { recursive: true });
writeFileSync(
  "output/playwright/visual-review/index.html",
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IMPOSTER · Visual comparison</title><style>${css}</style><body data-mode="after"><header><h1>IMPOSTER · Proposal / implemented app</h1><p>All 24 screen states rendered by the app at 390 × 750. Fixed sample players make layout comparisons consistent. Device frames and illustrative OS bars are excluded. Native commands are isolated test fixtures; no fixture code is included in the app. Camera images and QR payloads remain real at runtime.</p><nav>${boards.map((b, i) => `<a href="#board-${i + 1}">Board ${i + 1}</a>`).join("")}<button class="toggle" onclick="document.body.dataset.mode=document.body.dataset.mode==='before'?'after':'before';this.textContent=document.body.dataset.mode==='before'?'Show after refinement':'Show before refinement'">Show before refinement</button></nav></header>${body}</body></html>`,
);
console.log("Visual comparison gallery written.");
