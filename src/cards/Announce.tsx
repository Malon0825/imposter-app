// Play announcements on every phone (design/power-cards-v1 §5.4, §6): a banner
// for Common and Rare plays, a full takeover for Golden ones, and a stamp for
// every clash verdict. Each phone announces what is new since it last looked;
// a phone that joins mid-round starts at rest instead of replaying.
import { useEffect, useRef, useState } from "react";
import { play as playSound } from "../sound";
import { Stamp, Type } from "../theme";
import type { CardTier, View } from "../types";
import { CardBack } from "./Card";
import { centre, EASE, flash, go, ring, shake, sleep, slamLetters, sparks, stampSlam, TIER_FX } from "./fx";
import type { Who } from "./Round";

type Item =
  | { key: string; kind: "play"; player: string; tier: CardTier }
  | { key: string; kind: "stamp"; verdict: string; by: string | null; on: string | null; bluff: boolean };

export function Announcements({ view, who }: { view: View; who: Who }) {
  const seen = useRef<{ round: number; seq: number; stamps: number } | null>(null);
  const [queue, setQueue] = useState<Item[]>([]);
  const c = view.cards;

  useEffect(() => {
    if (!c?.active) return;
    const maxSeq = c.plays.reduce((m, p) => Math.max(m, p.seq), 0);
    const stamps = c.stamps.length;
    if (!seen.current || seen.current.round !== view.round_id) {
      seen.current = { round: view.round_id, seq: maxSeq, stamps };
      return;
    }
    const fresh: Item[] = [];
    for (const p of c.plays)
      if (p.seq > seen.current.seq) fresh.push({ key: `p${view.round_id}-${p.seq}`, kind: "play", player: p.player_id, tier: p.tier });
    c.stamps.slice(seen.current.stamps).forEach((s, i) => fresh.push({ key: `s${view.round_id}-${seen.current!.stamps + i}`, kind: "stamp", ...s }));
    seen.current = { round: view.round_id, seq: Math.max(seen.current.seq, maxSeq), stamps: Math.max(seen.current.stamps, stamps) };
    if (fresh.length) setQueue((q) => [...q, ...fresh]);
  }, [view.revision, view.round_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = queue[0];
  const done = () => setQueue((q) => q.slice(1));
  if (!current) return null;
  if (current.kind === "play" && current.tier === "golden") return <GoldenTakeover key={current.key} player={current.player} who={who} onDone={done} />;
  if (current.kind === "play") return <PlayBanner key={current.key} player={current.player} tier={current.tier} who={who} onDone={done} />;
  return <StampBanner key={current.key} item={current} who={who} onDone={done} />;
}

function GoldenTakeover({ player, who, onDone }: { player: string; who: Who; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const rays = useRef<HTMLDivElement>(null);
  const whoRef = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLParagraphElement>(null);
  const word = useRef<HTMLHeadingElement>(null);
  const note = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      playSound("playGolden");
      go(root.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
      await sleep(120);
      // The card drops from above, spinning, and slams down.
      go(cardRef.current, [
        { transform: "translateY(-520px) rotate(-540deg) scale(1.9)", opacity: 0 },
        { transform: "translateY(16px) rotate(-6deg) scale(.96)", opacity: 1, offset: 0.82 },
        { transform: "translateY(0) rotate(-4deg) scale(1)", opacity: 1 },
      ], { duration: 560, easing: EASE.in });
      await sleep(560);
      if (!live) return;
      const [x, y] = centre(cardRef.current);
      shake(undefined, 11, 420);
      flash("#e9c46a", 0.4, 280);
      ring(x, y, "#f8e6a6", 560, 760);
      sparks(x, y, { n: 50, c1: "#f8e6a6", c2: "#e9c46a", spread: 330, dur: 1300 });
      go(glow.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
      go(rays.current, [{ opacity: 0, transform: "translate(-50%,-50%) scale(.3)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1.2) rotate(25deg)" }], { duration: 900 });
      go(whoRef.current, [{ opacity: 0, transform: "translateX(-40px)" }, { opacity: 1, transform: "none" }], { duration: 360, easing: EASE.back });
      go(line.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: 120 });
      if (word.current) word.current.style.opacity = "1";
      await slamLetters(word.current, { stagger: 42 });
      go(note.current, [{ opacity: 0, letterSpacing: ".3em" }, { opacity: 1, letterSpacing: ".02em" }], { duration: 400 });
      await sleep(900);
      if (!live) return;
      // Into the Plays strip, leaving a trail of sparks; the chip pops.
      const chip = document.querySelector(".pc-plays li:last-child");
      const [tx, ty] = chip ? centre(chip) : [x, 40];
      const dx = tx - x;
      const dy = ty - y;
      go(cardRef.current, [
        { transform: "rotate(-4deg) scale(1)" },
        { transform: `translate(${dx * 0.4}px,${dy * 0.2 - 60}px) rotate(80deg) scale(.5)`, offset: 0.45 },
        { transform: `translate(${dx}px,${dy}px) rotate(186deg) scale(.1)`, opacity: 0.9 },
      ], { duration: 560, easing: EASE.in });
      for (let i = 0; i < 6; i++)
        setTimeout(() => sparks(x + dx * (i / 6), y + dy * (i / 6) - 40 * Math.sin(i / 2), { n: 5, c1: "#f8e6a6", c2: "#e9c46a", spread: 50, dur: 500 }), i * 80);
      [glow.current, rays.current, whoRef.current, line.current, word.current, note.current].forEach((el) => go(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, delay: 160 }));
      go(root.current, [{ backgroundColor: "#080b09e6" }, { backgroundColor: "#080b0900" }], { duration: 420, delay: 160 });
      await sleep(560);
      if (chip) {
        go(chip, [{ transform: "scale(1)" }, { transform: "scale(1.45)", offset: 0.35 }, { transform: "scale(.92)", offset: 0.7 }, { transform: "scale(1)" }], { duration: 480, fill: "none" });
        ring(tx, ty, "#e9c46a", 120, 520);
      }
      await sleep(200);
      if (live) onDone();
    })();
    return () => {
      live = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="pc-takeover" ref={root} role="status" aria-live="polite">
      <div className="pc-takeover-glow" ref={glow} />
      <div className="pc-rays golden" ref={rays} />
      <div className="pc-takeover-who" ref={whoRef} style={{ opacity: 0 }}>
        {who.avatar(player)}
        <b>{who.name(player)}</b>
      </div>
      <div ref={cardRef} className="pc-takeover-card">
        <CardBack tier="golden" width={200} />
      </div>
      <p className="pc-takeover-line" ref={line} style={{ opacity: 0 }}>
        played a
      </p>
      <h2 className="pc-takeover-word" ref={word} style={{ opacity: 0 }}>
        Golden card
      </h2>
      <div ref={note} style={{ opacity: 0 }}>
        <Type>Card played · contents sealed</Type>
      </div>
    </div>
  );
}

function PlayBanner({ player, tier, who, onDone }: { player: string; tier: CardTier; who: Who; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      playSound(tier === "rare" ? "playRare" : "playCommon");
      go(root.current, [
        { opacity: 0, transform: "translate(-50%,-34px)" },
        { opacity: 1, transform: "translate(-50%,6px)", offset: 0.6 },
        { opacity: 1, transform: "translate(-50%,0)" },
      ], { duration: 360, easing: EASE.back });
      await sleep(260);
      go(chip.current, [{ transform: "scale(1) rotate(6deg)" }, { transform: "scale(1.6) rotate(-8deg)", offset: 0.35 }, { transform: "scale(.9) rotate(10deg)", offset: 0.7 }, { transform: "scale(1) rotate(6deg)" }], { duration: 460 });
      const [x, y] = centre(chip.current);
      ring(x, y, TIER_FX[tier].c2, 110, 480);
      if (tier === "rare") sparks(x, y, { n: 12, c1: TIER_FX.rare.c1, c2: TIER_FX.rare.c2, spread: 70, dur: 700 });
      await sleep(2100);
      go(root.current, [{ opacity: 1, transform: "translate(-50%,0)" }, { opacity: 0, transform: "translate(-50%,-20px)" }], { duration: 200, easing: EASE.in });
      await sleep(200);
      if (live) onDone();
    })();
    return () => {
      live = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`pc-banner ${tier}`} ref={root} role="status" aria-live="polite">
      {who.avatar(player)}
      <span>
        <b>{who.name(player)}</b> played a <b className={tier}>{tier === "rare" ? "Rare" : "Common"}</b> card
      </span>
      <span ref={chip} className="pc-banner-chip">
        <CardBack size="chip" tier={tier} />
      </span>
    </div>
  );
}

const WORD: Record<string, string> = { sustained: "Sustained", overruled: "Overruled", blocked: "Blocked", vetoed: "Vetoed", pierced: "Pierced" };

function StampBanner({ item, who, onDone }: { item: Extract<Item, { kind: "stamp" }>; who: Who; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const stamp = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      go(root.current, [{ opacity: 0, transform: "translate(-50%,-34px)" }, { opacity: 1, transform: "translate(-50%,0)" }], { duration: 300, easing: EASE.back });
      await sleep(260);
      playSound(item.verdict === "sustained" && item.bluff ? "womp" : "stamp");
      const el = stamp.current?.querySelector<HTMLElement>(".stamp") ?? null;
      await stampSlam(el, { tone: item.verdict === "overruled" ? "rgba(244,241,232,.6)" : "rgba(196,80,58,.85)", jolt: item.bluff ? 9 : 6 });
      shake(root.current, item.bluff ? 8 : 4, 260);
      if (item.bluff) {
        const [x, y] = centre(root.current);
        sparks(x, y, { n: 18, c1: "#e9c46a", c2: "#c4503a", spread: 120, dur: 800 });
      }
      await sleep(2300);
      go(root.current, [{ opacity: 1 }, { opacity: 0, transform: "translate(-50%,-20px)" }], { duration: 200, easing: EASE.in });
      await sleep(200);
      if (live) onDone();
    })();
    return () => {
      live = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="pc-banner stamp" ref={root} role="status" aria-live="polite">
      <span ref={stamp} className="pc-banner-stamp">
        <Stamp tone={item.verdict === "overruled" || item.verdict === "pierced" ? "ink" : "red"}>
          {item.verdict === "sustained" ? "Objection! Sustained" : WORD[item.verdict] ?? item.verdict}
        </Stamp>
      </span>
      <span>
        {item.verdict === "blocked" && <>{who.name(item.on)}’s card bounced off {who.name(item.by)}.</>}
        {item.verdict === "sustained" && (item.bluff ? <b>It was a Bluff Card!</b> : <>{who.name(item.on)}’s card is cancelled.</>)}
        {item.verdict === "overruled" && (item.by && item.on ? <>{who.name(item.on)}’s card stands.</> : <>The Golden vote stands.</>)}
        {item.verdict === "vetoed" && <>One vote was vetoed.</>}
      </span>
    </div>
  );
}
