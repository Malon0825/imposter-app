// Game motion toolkit, ported from the approved mockups
// (design/power-cards-v1/mockup/mockup.js): anticipation, overshoot and
// impact (screen shake, shockwave rings, flashes, spark bursts), words that
// slam in letter by letter, and count-ups. Plain DOM + Web Animations, drawn
// on one fixed layer above the app so effects can cross the whole screen.
// Every effect respects reduced motion: it either does nothing or jumps to
// its end state.

export const EASE = {
  out: "cubic-bezier(0.22,1,0.36,1)",
  back: "cubic-bezier(.34,1.56,.64,1)",
  in: "cubic-bezier(.55,0,1,.45)",
  snap: "cubic-bezier(.2,1.4,.4,1)",
  whip: "cubic-bezier(.7,0,.12,1)",
};

export const reducedMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, reducedMotion() ? 0 : ms));

/** Animate, or with reduced motion jump to the last keyframe. */
export function go(el: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions = {}) {
  if (!el) return null;
  if (reducedMotion()) {
    Object.assign((el as HTMLElement).style, kf[kf.length - 1] as Record<string, string>);
    return null;
  }
  return el.animate(kf, { fill: "both", easing: EASE.out, ...o });
}

let layerEl: HTMLDivElement | null = null;
/** The shared effects layer: fixed over the whole app, never catches taps. */
export function layer() {
  if (layerEl?.isConnected) return layerEl;
  layerEl = document.createElement("div");
  layerEl.className = "fx-layer";
  layerEl.setAttribute("aria-hidden", "true");
  document.body.appendChild(layerEl);
  return layerEl;
}

function mk(css: string) {
  const d = document.createElement("div");
  d.style.cssText = "position:absolute;pointer-events:none;" + css;
  layer().appendChild(d);
  return d;
}

/** The centre of an element on screen. */
export function centre(el: Element | null | undefined): [number, number] {
  if (!el) return [innerWidth / 2, innerHeight / 2];
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

/** The whole phone shakes, fading out. */
export function shake(el: Element | null | undefined = document.querySelector(".app-shell"), mag = 6, dur = 340) {
  if (!el || reducedMotion() || !mag) return;
  const k: Keyframe[] = [];
  for (let i = 0; i <= 8; i++) {
    const m = mag * (1 - i / 8);
    k.push({ transform: `translate(${(Math.random() * 2 - 1) * m}px,${(Math.random() * 2 - 1) * m}px)` });
  }
  k.push({ transform: "none" });
  el.animate(k, { duration: dur, easing: "linear", composite: "add" });
}

export function sparks(x: number, y: number, { n = 24, c1 = "#fff", c2 = "#e9c46a", spread = 230, dur = 1000, up = 0 } = {}) {
  if (reducedMotion()) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = spread * (0.35 + Math.random() * 0.65);
    const s = 3 + Math.random() * 6;
    const p = mk(
      `left:${x}px;top:${y}px;width:${s}px;height:${s * (Math.random() < 0.4 ? 3 : 1)}px;border-radius:${s}px;background:${Math.random() < 0.5 ? c1 : c2};box-shadow:0 0 ${s * 2}px ${c2}`,
    );
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r - up;
    p.animate(
      [
        { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.7}px),calc(-50% + ${dy * 0.7}px)) rotate(${a}rad) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy + 60}px)) rotate(${a}rad) scale(.2)`, opacity: 0 },
      ],
      { duration: dur * (0.7 + Math.random() * 0.5), easing: EASE.out, fill: "both" },
    ).finished.then(() => p.remove());
  }
}

/** A shockwave ring from a point. */
export function ring(x: number, y: number, color: string, size = 340, dur = 650) {
  if (reducedMotion()) return;
  const r = mk(`left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:50%;border:4px solid ${color};transform:translate(-50%,-50%) scale(0)`);
  r.animate(
    [
      { transform: "translate(-50%,-50%) scale(.15)", opacity: 1, borderWidth: "10px" },
      { transform: "translate(-50%,-50%) scale(1)", opacity: 0, borderWidth: "1px" },
    ],
    { duration: dur, easing: EASE.out, fill: "both" },
  ).finished.then(() => r.remove());
}

/** A full-screen flash of colour. */
export function flash(color = "#fff", peak = 0.7, dur = 260) {
  if (reducedMotion()) return;
  const f = mk(`inset:0;background:${color};opacity:0`);
  f.animate([{ opacity: 0 }, { opacity: peak, offset: 0.25 }, { opacity: 0 }], { duration: dur, fill: "both" }).finished.then(() => f.remove());
}

/** Slams a word in letter by letter, oversized and blurred, landing with a bounce. */
export function slamLetters(el: HTMLElement | null, { stagger = 45, from = 2.6 } = {}) {
  if (!el) return Promise.resolve();
  const txt = el.dataset.text ?? el.textContent ?? "";
  el.dataset.text = txt;
  el.textContent = "";
  [...txt].forEach((ch, i) => {
    const s = document.createElement("span");
    s.textContent = ch === " " ? " " : ch;
    s.style.display = "inline-block";
    el.appendChild(s);
    go(
      s,
      [
        { transform: `scale(${from}) translateY(-18px)`, opacity: 0, filter: "blur(8px)" },
        { transform: "scale(.92)", opacity: 1, filter: "blur(0)", offset: 0.7 },
        { transform: "none", opacity: 1, filter: "blur(0)" },
      ],
      { duration: 380, delay: i * stagger },
    );
  });
  return sleep(txt.length * stagger + 380);
}

/** Counts a number up with an ease-out. */
export function countUp(el: HTMLElement | null, from: number, to: number, dur = 700, pre = "+") {
  if (!el) return;
  if (reducedMotion()) {
    el.textContent = pre + to;
    return;
  }
  const t0 = performance.now();
  const tick = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = pre + Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** A stamp slamming down: from big and tilted, then the page jolts and an ink ring spreads. */
export async function stampSlam(el: HTMLElement | null, { tone = "rgba(196,80,58,.8)", jolt = 4 } = {}) {
  if (!el) return;
  el.style.opacity = "1";
  go(
    el,
    [
      { transform: "scale(3) rotate(-40deg)", opacity: 0 },
      { transform: "scale(.9) rotate(-12deg)", opacity: 1, offset: 0.7 },
      { transform: "scale(1) rotate(-6deg)", opacity: 1 },
    ],
    { duration: 240, easing: EASE.in },
  );
  await sleep(180);
  shake(el.parentElement, jolt, 240);
  const [x, y] = centre(el);
  ring(x, y, tone, 140, 440);
}

/** Tier colours for sparks, glows and flashes. */
export const TIER_FX = {
  golden: { c1: "#f8e6a6", c2: "#e9c46a", glow: "rgba(233,196,106,.85)", sparks: 46, shake: 9 },
  rare: { c1: "#d9e8ef", c2: "#8fb3c9", glow: "rgba(143,179,201,.8)", sparks: 22, shake: 5 },
  common: { c1: "#f4f1e8", c2: "#cfd9c9", glow: "rgba(244,241,232,.55)", sparks: 10, shake: 3 },
} as const;

/**
 * A card leaves the hand: a copy lifts off where it is, spins down to a
 * chip and flies to `to` (the plays strip, or the top of the screen),
 * landing with sparks in its tier colour.
 */
export async function flyCard(from: Element | null, to: Element | null, tier: keyof typeof TIER_FX) {
  if (!from || reducedMotion()) return;
  const r = from.getBoundingClientRect();
  const ghost = from.cloneNode(true) as HTMLElement;
  ghost.style.cssText += `;position:absolute;left:${r.left}px;top:${r.top}px;margin:0;pointer-events:none`;
  layer().appendChild(ghost);
  const [tx, ty] = to ? centre(to) : [innerWidth / 2, 70];
  const dx = tx - (r.left + r.width / 2);
  const dy = ty - (r.top + r.height / 2);
  const T = TIER_FX[tier];
  await ghost.animate(
    [
      { transform: "none" },
      { transform: "translateY(-24px) scale(1.08) rotate(-3deg)", offset: 0.28 },
      { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 50}px) scale(.5) rotate(120deg)`, offset: 0.65 },
      { transform: `translate(${dx}px,${dy}px) scale(.1) rotate(240deg)`, opacity: 0.8 },
    ],
    { duration: 720, easing: EASE.in, fill: "both" },
  ).finished;
  ghost.remove();
  sparks(tx, ty, { n: tier === "golden" ? 24 : 12, c1: T.c1, c2: T.c2, spread: 80, dur: 600 });
  ring(tx, ty, T.c2, 110, 460);
}
