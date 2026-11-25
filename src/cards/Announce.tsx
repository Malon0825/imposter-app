// Play announcements on every phone: a banner for Common and Rare plays, a
// takeover for Golden ones, and a stamp for every clash verdict. Each phone
// announces what is new since it last looked; a phone that joins mid-round
// starts at rest instead of replaying what it missed.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { play as playSound } from "../sound";
import { Stamp } from "../theme";
import type { CardTier, View } from "../types";
import { CardBack } from "./Card";
import type { Who } from "./Round";

type Item =
  | { key: string; kind: "play"; player: string; tier: CardTier }
  | { key: string; kind: "stamp"; verdict: string; by: string | null; on: string | null; bluff: boolean };

const BANNER_MS = 2500;
const GOLDEN_MS = 2600;

export function Announcements({ view, who }: { view: View; who: Who }) {
  const seen = useRef<{ round: number; seq: number; stamps: number } | null>(null);
  const [queue, setQueue] = useState<Item[]>([]);
  const reduced = useReducedMotion();
  const c = view.cards;

  useEffect(() => {
    if (!c?.active) return;
    const maxSeq = c.plays.reduce((m, p) => Math.max(m, p.seq), 0);
    const stamps = c.stamps.length;
    if (!seen.current || seen.current.round !== view.round_id) {
      // First look at this round: what's already there is at rest.
      seen.current = { round: view.round_id, seq: maxSeq, stamps };
      return;
    }
    const fresh: Item[] = [];
    for (const p of c.plays)
      if (p.seq > seen.current.seq) fresh.push({ key: `p${view.round_id}-${p.seq}`, kind: "play", player: p.player_id, tier: p.tier });
    c.stamps.slice(seen.current.stamps).forEach((s, i) =>
      fresh.push({ key: `s${view.round_id}-${seen.current!.stamps + i}`, kind: "stamp", ...s }),
    );
    seen.current = { round: view.round_id, seq: Math.max(seen.current.seq, maxSeq), stamps: Math.max(seen.current.stamps, stamps) };
    if (fresh.length) setQueue((q) => [...q, ...fresh]);
  }, [view.revision, view.round_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    if (current.kind === "play")
      playSound(current.tier === "golden" ? "playGolden" : current.tier === "rare" ? "playRare" : "playCommon");
    else playSound(current.verdict === "sustained" && current.bluff ? "womp" : "stamp");
    const ms = current.kind === "play" && current.tier === "golden" ? GOLDEN_MS : BANNER_MS;
    const t = window.setTimeout(() => setQueue((q) => q.slice(1)), ms);
    return () => window.clearTimeout(t);
  }, [current?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {current?.kind === "play" && current.tier === "golden" ? (
        <motion.div
          key={current.key}
          className="pc-takeover"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.25 }}
        >
          <div className="pc-rays" aria-hidden="true" />
          <div className="pc-takeover-who">
            {who.avatar(current.player)}
            <b>{who.name(current.player)}</b>
          </div>
          <motion.div
            initial={reduced ? false : { y: -320, rotate: -540, scale: 0.6 }}
            animate={{ y: 0, rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 150, damping: 15 }}
          >
            <CardBack tier="golden" width={170} />
          </motion.div>
          <p className="pc-takeover-line">played a</p>
          <motion.h2
            className="pc-takeover-word"
            initial={reduced ? false : { scale: 1.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: reduced ? 0 : 0.55, type: "spring", stiffness: 420, damping: 20 }}
          >
            Golden card
          </motion.h2>
          <p className="muted">Which one? You’ll find out at results.</p>
        </motion.div>
      ) : current ? (
        <motion.div
          key={current.key}
          className={`pc-banner ${current.kind === "play" ? current.tier : "stamp"}`}
          role="status"
          aria-live="polite"
          initial={reduced ? false : { y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { y: -24, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {current.kind === "play" ? (
            <>
              {who.avatar(current.player)}
              <span>
                <b>{who.name(current.player)}</b> played a <b className={current.tier}>{current.tier === "rare" ? "Rare" : "Common"}</b> card
              </span>
              <CardBack size="chip" tier={current.tier} />
            </>
          ) : (
            <>
              <Stamp slam tone={current.verdict === "overruled" || current.verdict === "pierced" ? "ink" : "red"}>
                {current.verdict === "sustained" ? "Objection! Sustained" : current.verdict}
              </Stamp>
              <span>
                {current.verdict === "blocked" && <>{who.name(current.on)}’s card bounced off {who.name(current.by)}.</>}
                {current.verdict === "sustained" && (current.bluff ? <><b>It was a Bluff Card!</b></> : <>{who.name(current.on)}’s card is cancelled.</>)}
                {current.verdict === "overruled" && (current.by && current.on ? <>{who.name(current.on)}’s card stands.</> : <>The Golden vote stands.</>)}
                {current.verdict === "vetoed" && <>One vote was vetoed.</>}
              </span>
            </>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
