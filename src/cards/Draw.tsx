// The draw window. No timer: everyone draws or skips, takes as long as they
// like with their card, and taps Continue; roles are dealt when the whole
// table is done (the host can deal past someone who wandered off).
//
// A draw is a game moment (design/power-cards-v1 §5.1, §6): the card spins out
// of the deck and lands with an impact, its frame ignites in the tier colour
// while the tier word slams in, then it idles sealed (showcase spin, float,
// breathing glow) until a tap winds it up and flips it with a flash and a
// burst of sparks. Only this phone sees the tier or the card.
import { useEffect, useRef, useState } from "react";
import { play as playSound } from "../sound";
import { Type } from "../theme";
import type { CardTier, View } from "../types";
import { CardBack, CardFace } from "./Card";
import { card } from "./catalog";
import { centre, EASE, flash, go, reducedMotion, ring, shake, sleep, slamLetters, sparks, TIER_FX } from "./fx";
import type { Who } from "./Round";

type Send = (k: string, v?: unknown) => Promise<void> | void;

export function DrawScreen({ view, send, busy, who }: { view: View; send: Send; busy: boolean; who: Who }) {
  const c = view.cards!;
  const mine = c.mine;
  const drawn = c.draw?.decided.includes(view.my_id) ? mine.hand.find((h) => h.new)?.id ?? null : null;
  const ready = c.draw?.ready.includes(view.my_id);
  if (drawn && !ready) return <SealedDraw key={`${view.round_id}-${drawn}`} id={drawn} send={send} />;
  if (mine.decided || ready) return <DrawWait view={view} send={send} busy={busy} who={who} />;
  return <DrawOffer view={view} send={send} busy={busy} who={who} />;
}

function DrawOffer({ view, send, busy, who }: { view: View; send: Send; busy: boolean; who: Who }) {
  const c = view.cards!;
  const mine = c.mine;
  const underdog = c.underdogs.includes(view.my_id);
  const deck = useRef<HTMLDivElement>(null);
  const roster = view.topic_vote?.player_ids ?? view.players.filter((p) => !p.left).map((p) => p.id);
  const points = view.players.find((p) => p.id === view.my_id)?.points ?? 0;
  return (
    <div className="pc-draw">
      <div className="pc-draw-head">
        <div>
          <h1>Draw a power card?</h1>
          <p className="muted">Roles are dealt once everyone has drawn or skipped. Your card waits for you.</p>
        </div>
      </div>
      <div className="pc-deck" ref={deck} aria-hidden="true">
        <CardBack width={110} />
        <CardBack width={110} />
        <CardBack width={110} />
      </div>
      <dl className="pc-draw-status">
        <div>
          <dt>Price</dt>
          <dd>
            {mine.price === 0 ? (
              <span className="pc-pill lime">Free · Underdog</span>
            ) : mine.price ? (
              `${mine.price} points`
            ) : (
              <span className="muted">{underdog ? "—" : points < 3 ? "Needs 3 points" : "No draws left"}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Golden chance</dt>
          <dd><span className="pc-pill gold">{mine.golden_chance}%</span></dd>
        </div>
        <div>
          <dt>Paid draws left</dt>
          <dd>{mine.paid_draws_left} of 4</dd>
        </div>
      </dl>
      <TableStrip view={view} roster={roster} who={who} />
      <div className="actions">
        <button
          type="button"
          className="button primary"
          disabled={busy || mine.price == null}
          onClick={async (e) => {
            // Anticipation: the button squashes and the deck shudders.
            go(e.currentTarget, [{ transform: "scale(1)" }, { transform: "scale(.94,.9)", offset: 0.35 }, { transform: "scale(1.03)", offset: 0.7 }, { transform: "scale(1)" }], { duration: 260 });
            go(deck.current, [{ transform: "none" }, { transform: "translateY(4px) scale(.98)", offset: 0.4 }, { transform: "translateY(-3px)", offset: 0.7 }, { transform: "none" }], { duration: 240 });
            playSound("draw");
            await sleep(180);
            await send("draw");
          }}
        >
          {mine.price === 0 ? "Draw · Free" : mine.price ? `Draw · ${mine.price} points` : "Draw"}
        </button>
        <button type="button" className="button outline" disabled={busy} onClick={() => send("skip_draw")}>
          Skip
        </button>
      </div>
    </div>
  );
}

function TableStrip({ view, roster, who }: { view: View; roster: string[]; who: Who }) {
  const c = view.cards!;
  return (
    <>
      <Type>At the table</Type>
      <ul className="pc-table">
        {roster.map((id) => {
          const decided = c.draw?.decided.includes(id);
          const drew = c.drew.includes(id);
          const ready = c.draw?.ready.includes(id);
          return (
            <li key={id} className={ready ? "ready" : ""}>
              {who.avatar(id)}
              <span>{drew ? (ready ? "Drew ✓" : "Looking…") : decided ? "Skipped" : "Deciding…"}</span>
              {drew && <CardBack size="chip" />}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function DrawWait({ view, send, busy, who }: { view: View; send: Send; busy: boolean; who: Who }) {
  const c = view.cards!;
  const roster = view.topic_vote?.player_ids ?? view.players.filter((p) => !p.left).map((p) => p.id);
  const done = c.draw?.decided.length ?? 0;
  return (
    <div className="pc-draw">
      <div className="pc-draw-head">
        <div>
          <h1>Waiting for the table.</h1>
          <p className="muted">
            {done} of {roster.length} decided. Roles come once everyone has drawn or skipped.
          </p>
        </div>
      </div>
      <div className="pc-deck small" aria-hidden="true">
        <CardBack width={80} />
        <CardBack width={80} />
        <CardBack width={80} />
      </div>
      <TableStrip view={view} roster={roster} who={who} />
      <div className="actions">
        {view.is_host && done < roster.length && (
          <button type="button" className="button outline" disabled={busy} onClick={() => send("deal_now")}>
            Deal roles now
          </button>
        )}
        {view.is_host && done < roster.length && <p className="muted center compact">Anyone still deciding skips.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the sealed draw

function SealedDraw({ id, send }: { id: string; send: Send }) {
  const info = card(id)!;
  const tier = info.tier as CardTier;
  const T = TIER_FX[tier];
  const stage = useRef<HTMLDivElement>(null);
  const hold = useRef<HTMLButtonElement>(null);
  const flip = useRef<HTMLDivElement>(null);
  const word = useRef<HTMLHeadingElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const rays = useRef<HTMLDivElement>(null);
  const spin = useRef<Animation | null>(null);
  const [step, setStep] = useState<"landing" | "sealed" | "revealing" | "revealed" | "leaving">("landing");

  // The draw: spin out of the deck, impact, ignite, slam the tier, then idle.
  useEffect(() => {
    let live = true;
    (async () => {
      const h = hold.current!;
      const [x, y] = centre(h);
      go(stage.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      go(h, [
        { transform: "translate(0,90px) scale(.42) rotate(0deg)", opacity: 0 },
        { transform: "translate(-30px,-70px) scale(.85) rotate(-250deg)", opacity: 1, offset: 0.5 },
        { transform: "translate(0,8px) scale(1.08) rotate(-356deg)", offset: 0.82 },
        { transform: "translate(0,0) scale(1) rotate(-360deg)" },
      ], { duration: 720, easing: "cubic-bezier(.3,.7,.4,1)" });
      await sleep(720);
      if (!live) return;
      shake(undefined, 5, 300);
      ring(x, y, "rgba(244,241,232,.6)", 380, 600);
      sparks(x, y + 160, { n: 14, c1: "#cfd9c9", c2: "#8d9a8a", spread: 140, dur: 700, up: 40 });
      await sleep(260);
      if (!live) return;
      // The frame ignites in the tier colour; the tier word slams in.
      h.querySelectorAll(".pc-seal").forEach((s) => s.classList.remove("plain"));
      h.querySelectorAll(".pc-seal").forEach((s) =>
        go(s, [{ filter: "brightness(1) saturate(0)" }, { filter: "brightness(2.2) saturate(1.4)", offset: 0.3 }, { filter: "brightness(1) saturate(1)" }], { duration: 650 }),
      );
      h.querySelectorAll(".pc-shine").forEach((s) => go(s, [{ backgroundPosition: "160% 0" }, { backgroundPosition: "-60% 0" }], { duration: 700, easing: "ease-in-out" }));
      go(glow.current, [{ opacity: 0, transform: "translate(-50%,-50%) scale(.6)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)" }], { duration: 600 });
      flash(T.c2, tier === "golden" ? 0.35 : 0.18, 320);
      ring(x, y, T.c2, 520, 800);
      sparks(x, y, { n: T.sparks, c1: T.c1, c2: T.c2, spread: tier === "golden" ? 300 : 210, dur: 1200 });
      shake(undefined, T.shake, 420);
      if (tier !== "common")
        go(rays.current, [{ opacity: 0, transform: "translate(-50%,-50%) scale(.3) rotate(0deg)" }, { opacity: tier === "golden" ? 1 : 0.55, transform: "translate(-50%,-50%) scale(1.15) rotate(30deg)" }], { duration: 900 });
      if (word.current) word.current.style.opacity = "1";
      await slamLetters(word.current, { stagger: tier === "golden" ? 55 : 40 });
      if (!live) return;
      setStep("sealed");
      if (!reducedMotion()) {
        // Idle: a slow, then whipping, then gliding showcase spin (both sides
        // are sealed backs, so the face never shows); float; breathing glow.
        spin.current = flip.current!.animate(
          [{ transform: "rotateY(0deg)", easing: EASE.whip }, { transform: "rotateY(720deg)", offset: 0.74 }, { transform: "rotateY(720deg)" }],
          { duration: 3800, iterations: Infinity },
        );
        h.animate([{ translate: "0 0" }, { translate: "0 -7px" }, { translate: "0 0" }], { duration: 2400, iterations: Infinity, easing: "ease-in-out" });
        glow.current?.animate([{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }], { duration: 2400, iterations: Infinity });
        rays.current?.animate([{ rotate: "0deg" }, { rotate: "360deg" }], { duration: 40000, iterations: Infinity });
      }
    })();
    return () => {
      live = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reveal = async () => {
    if (step !== "sealed") return;
    setStep("revealing");
    const f = flip.current!;
    if (spin.current) {
      // Read the real angle, then turn the rest of the way to the front.
      const m = getComputedStyle(f).transform.match(/matrix3d\(([^)]+)\)/);
      const v = m ? m[1].split(",").map(Number) : null;
      const ang = v ? ((Math.atan2(v[8], v[0]) * 180) / Math.PI + 360) % 360 : 0;
      spin.current.cancel();
      if (ang > 1 && ang < 359) {
        go(f, [{ transform: `rotateY(${ang}deg)` }, { transform: "rotateY(360deg)" }], { duration: 160 + (360 - ang) });
        await sleep(160 + (360 - ang));
      }
      f.getAnimations().forEach((a) => a.cancel());
    }
    f.classList.add("show-face");
    playSound("reveal");
    // Wind-up: the card tenses, shivers and glows harder.
    go(f, [{ transform: "rotateY(0) scale(1)" }, { transform: "rotateY(-14deg) scale(.93) rotate(-2deg)", offset: 0.45 }, { transform: "rotateY(8deg) scale(.95) rotate(2deg)", offset: 0.75 }, { transform: "rotateY(0) scale(.94)" }], { duration: 300 });
    go(glow.current, [{ transform: "translate(-50%,-50%) scale(1)" }, { transform: "translate(-50%,-50%) scale(1.35)" }], { duration: 300 });
    await sleep(300);
    // The flip, with overshoot; a white flash on the edge-on moment.
    go(f, [{ transform: "rotateY(0) scale(.94)" }, { transform: "rotateY(100deg) scale(1.12)", offset: 0.45 }, { transform: "rotateY(195deg) scale(1.04)", offset: 0.8 }, { transform: "rotateY(180deg) scale(1)" }], { duration: 520 });
    await sleep(190);
    const [x, y] = centre(hold.current);
    flash("#fff", tier === "golden" ? 0.75 : 0.45, 300);
    shake(undefined, T.shake + 2, 380);
    ring(x, y, T.c1, 600, 760);
    sparks(x, y, { n: T.sparks + 14, c1: T.c1, c2: T.c2, spread: 320, dur: 1300 });
    await sleep(330);
    const face = hold.current!.querySelector(".pc-flip-back .pc-card");
    go(face?.querySelector(".pc-art"), [{ transform: "scale(.4)", opacity: 0 }, { transform: "scale(1.12)", opacity: 1, offset: 0.65 }, { transform: "scale(1)", opacity: 1 }], { duration: 480 });
    go(face?.querySelector(".pc-name"), [{ transform: "translateY(14px)", opacity: 0, letterSpacing: ".3em" }, { transform: "none", opacity: 1, letterSpacing: ".02em" }], { duration: 420, delay: 120 });
    go(word.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
    setStep("revealed");
  };

  // Into the case file: the card shrinks and flies to the hand button.
  const keep = async () => {
    setStep("leaving");
    playSound("file");
    const target = document.querySelector(".pc-hand-button") ?? document.querySelector(".appbar");
    const [tx, ty] = centre(target);
    const [x, y] = centre(hold.current);
    go(hold.current, [{ transform: "none" }, { transform: `translate(${(tx - x) * 0.3}px,${(ty - y) * 0.3 - 40}px) scale(.6) rotate(-8deg)`, offset: 0.4 }, { transform: `translate(${tx - x}px,${ty - y}px) scale(.08) rotate(-20deg)`, opacity: 0.7 }], { duration: 520, easing: EASE.in });
    go(stage.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 200 });
    await sleep(520);
    sparks(tx, ty, { n: 10, c1: T.c1, c2: T.c2, spread: 60, dur: 600 });
    ring(tx, ty, T.c2, 90, 420);
    await send("draw_ready");
  };

  return (
    <div className={`pc-stage ${tier}`} ref={stage}>
      <div className="pc-stage-glow" ref={glow} style={{ background: `radial-gradient(circle, ${T.glow}, transparent 62%)` }} />
      <div className={`pc-rays ${tier}`} ref={rays} />
      <div className="pc-stage-title">
        <Type>You drew a</Type>
        <h1 ref={word} className={`pc-tier-word ${tier}`} style={{ opacity: 0 }}>
          {tier}
        </h1>
      </div>
      <button
        type="button"
        className="pc-hold"
        ref={hold}
        aria-label={step === "revealed" || step === "leaving" ? info.name : "Tap the card to reveal it"}
        onClick={reveal}
      >
        <div className="pc-flip" ref={flip}>
          <div className={`pc-flip-front pc-seal ${tier} plain`}>
            <CardBack width={230} />
            <span className="pc-shine" />
          </div>
          <div className={`pc-flip-rear-seal pc-seal ${tier} plain`}>
            <CardBack width={230} />
            <span className="pc-shine" />
          </div>
          <div className="pc-flip-back">
            <CardFace id={id} width={242} />
          </div>
        </div>
      </button>
      <div className="pc-stage-foot">
        {step === "sealed" && (
          <>
            <p className="pc-hint">
              <span className="dot" />
              Tap the card to reveal it
            </p>
            <Type>Show it off. Nobody can tell which {tier} it is.</Type>
            <button type="button" className="button outline" onClick={keep}>
              Keep it sealed
            </button>
          </>
        )}
        {step === "revealed" && (
          <>
            <p className="muted center compact">Only you can see this card. Take your time: your role waits for you.</p>
            <button type="button" className="button primary" onClick={keep}>
              Add to my case file
            </button>
          </>
        )}
      </div>
    </div>
  );
}
