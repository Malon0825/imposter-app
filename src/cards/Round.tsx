// Power cards on the round's screens: the draw window, the plays strip and
// public effects, the ballot's card slot, Cold Feet, the Last Word, and the
// host's switch. The hand itself lives in Hand.tsx.
import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MOTION } from "../motion";
import { play as playSound } from "../sound";
import { Stamp, Type } from "../theme";
import type { CastRole, View } from "../types";
import { CardBack, CardFace } from "./Card";
import { card, cardLanguage, needsPlayer, onCardLanguage, setCardLanguage, type CardLanguage } from "./catalog";

export interface Who {
  name: (id: string | null | undefined) => string;
  avatar: (id: string) => ReactNode;
}

const ROLE_NAME: Record<CastRole, string> = {
  imposter: "Imposter",
  accomplice: "Accomplice",
  detective: "Detective",
  judge: "Judge",
  decoy: "Decoy",
  gambler: "Gambler",
};

/** Counts down from a host deadline in whole seconds. */
function useCountdown(remainingMs: number | null | undefined, key: unknown) {
  const [left, setLeft] = useState(remainingMs ?? 0);
  useEffect(() => {
    if (remainingMs == null) return;
    const end = Date.now() + remainingMs;
    setLeft(remainingMs);
    const t = window.setInterval(() => setLeft(Math.max(0, end - Date.now())), 200);
    return () => window.clearInterval(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return left;
}

function Ring({ leftMs, totalMs }: { leftMs: number; totalMs: number }) {
  const r = 27;
  const c = 2 * Math.PI * r;
  return (
    <div className="pc-ring" role="timer" aria-label={`${Math.ceil(leftMs / 1000)} seconds left`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle className="bg" cx="32" cy="32" r={r} />
        <circle className="fg" cx="32" cy="32" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - leftMs / totalMs)} />
      </svg>
      <b>{Math.ceil(leftMs / 1000)}</b>
    </div>
  );
}

// ---------------------------------------------------------------- the draw window

export function DrawScreen({ view, send, busy, who }: { view: View; send: (k: string, v?: unknown) => void; busy: boolean; who: Who }) {
  const cards = view.cards!;
  const mine = cards.mine;
  const reduced = useReducedMotion();
  const left = useCountdown(cards.draw?.remaining_ms, view.round_id);
  const drawn = mine.hand.find((h) => h.new)?.id ?? null;
  const [revealed, setRevealed] = useState(false);
  const [kept, setKept] = useState(false);
  const roster = view.topic_vote?.player_ids ?? view.players.map((p) => p.id);
  const underdog = cards.underdogs.includes(view.my_id);
  const info = drawn ? card(drawn) : undefined;
  if (drawn && info && !kept) {
    // Two taps: the card lands sealed (tier only), then the face on a tap.
    return (
      <div className="pc-draw-reveal">
        <Type className="center">You drew a</Type>
        <h1 className={`pc-tier-word ${info.tier}`}>{info.tier}</h1>
        <motion.button
          type="button"
          className="pc-sealed-button"
          aria-label={revealed ? info.name : "Tap the card to reveal it"}
          initial={reduced ? false : { y: -60, rotate: -14, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, rotate: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          onClick={() => {
            if (revealed) return;
            playSound("reveal");
            setRevealed(true);
          }}
        >
          <motion.div
            className={`pc-flip ${revealed ? "shown" : ""}`}
            animate={{ rotateY: revealed ? 180 : 0 }}
            transition={{ duration: reduced ? 0 : MOTION.roleReveal, ease: MOTION.easeOut }}
          >
            <div className={`pc-flip-front pc-seal ${info.tier}`}>
              <CardBack width={230} />
            </div>
            <div className="pc-flip-back">
              <CardFace id={drawn} width={230} />
            </div>
          </motion.div>
        </motion.button>
        <p className="muted center compact">
          {revealed ? "Only you can see this card." : "Tap the card to reveal it. Show it off: nobody can tell which card it is."}
        </p>
        <div className="actions">
          <button
            type="button"
            className="button primary"
            onClick={() => {
              playSound("file");
              setKept(true);
            }}
          >
            {revealed ? "Add to my case file" : "Keep it sealed"}
          </button>
          <p className="muted center compact">Roles in {Math.ceil(left / 1000)} s</p>
        </div>
      </div>
    );
  }
  return (
    <div className="pc-draw">
      <div className="pc-draw-head">
        <div>
          <h1>Draw a power card?</h1>
          <p className="muted">Roles are dealt when the timer ends.</p>
        </div>
        {cards.draw && <Ring leftMs={left} totalMs={cards.draw.total_ms} />}
      </div>
      <div className="pc-deck" aria-hidden="true">
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
              <span className="muted">{underdog ? "—" : view.players.find((p) => p.id === view.my_id)!.points < 3 ? "Needs 3 points" : "No draws left"}</span>
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
      <Type>At the table</Type>
      <ul className="pc-table">
        {roster.map((id) => {
          const decided = cards.draw?.decided.includes(id);
          const drew = cards.drew.includes(id);
          return (
            <li key={id}>
              {who.avatar(id)}
              <span>{drew ? "Drew" : decided ? "Skipped" : "…"}</span>
              {drew && <CardBack size="chip" />}
            </li>
          );
        })}
      </ul>
      <div className="actions">
        {mine.decided ? (
          <p className="muted center">Waiting for the others…</p>
        ) : (
          <>
            <button
              type="button"
              className="button primary"
              disabled={busy || mine.price == null}
              onClick={() => {
                playSound("draw");
                send("draw");
              }}
            >
              {mine.price === 0 ? "Draw · Free" : mine.price ? `Draw · ${mine.price} points` : "Draw"}
            </button>
            <button type="button" className="button outline" disabled={busy} onClick={() => send("skip_draw")}>
              Skip
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the plays strip and public effects

export function PlaysStrip({ view, who }: { view: View; who: Who }) {
  const plays = view.cards?.plays ?? [];
  if (!view.cards?.active || plays.length === 0) return null;
  return (
    <div className="pc-plays" aria-label="Cards played this round">
      <Type className="pc-plays-label">Plays</Type>
      <ul>
        {plays.map((p) => (
          <li key={p.seq} className={p.tier} title={`${who.name(p.player_id)} · ${p.tier}`}>
            {who.avatar(p.player_id)}
            <CardBack size="chip" tier={p.tier} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const STAMP_WORD = { blocked: "Blocked", sustained: "Sustained", overruled: "Overruled", vetoed: "Vetoed", pierced: "Pierced" } as const;

export function PublicNotes({ view, who }: { view: View; who: Who }) {
  const c = view.cards;
  if (!c?.active) return null;
  const notes: ReactNode[] = [];
  c.stamps.forEach((s, i) =>
    notes.push(
      <li key={`s${i}`} className="pc-note stamp-note">
        <Stamp tone={s.verdict === "sustained" || s.verdict === "vetoed" || s.verdict === "blocked" ? "red" : "ink"}>{STAMP_WORD[s.verdict]}</Stamp>
        <span>
          {s.verdict === "blocked" && <>{who.name(s.on)}’s card bounced off {who.name(s.by)}.</>}
          {s.verdict === "sustained" && <>{who.name(s.by)} objected to {who.name(s.on)}’s card.{s.bluff && <b> It was a Bluff Card!</b>}</>}
          {s.verdict === "overruled" && (s.by && s.on ? <>{who.name(s.by)} objected to {who.name(s.on)}’s card. Overruled.</> : <>The Golden vote stands.</>)}
          {s.verdict === "vetoed" && <>One vote was vetoed.</>}
        </span>
      </li>,
    ),
  );
  c.tips.forEach((id, i) =>
    notes.push(
      <li key={`t${i}`} className="pc-note kraft">
        <Type>Anonymous tip</Type>
        <span>Someone suspects <b className="terra">{who.name(id)}</b></span>
      </li>,
    ),
  );
  c.claims.forEach((cl) =>
    notes.push(
      <li key={`c${cl.player_id}`} className="pc-note kraft">
        <Type>Cover story</Type>
        <span><b>{who.name(cl.player_id)}</b> claims: {ROLE_NAME[cl.role]}. Check at results.</span>
      </li>,
    ),
  );
  c.on_record.forEach((r) =>
    notes.push(
      <li key={`r${r.player_id}`} className="pc-note kraft">
        <Type>On the record</Type>
        <span><b>{who.name(r.player_id)}</b> votes <b>{who.name(r.vote)}</b>, locked.</span>
      </li>,
    ),
  );
  c.spotlight.forEach((s) =>
    notes.push(
      <li key={`l${s.player_id}`} className="pc-note kraft">
        <Type>Spotlight</Type>
        <span><b>{who.name(s.player_id)}</b> is on the {s.side === "imposter" ? "Imposter’s" : "civilian"} side.</span>
      </li>,
    ),
  );
  c.owed.forEach((id) =>
    notes.push(
      <li key={`o${id}`} className="pc-note kraft">
        <Type>Put on the spot</Type>
        <span><b>{who.name(id)}</b>, one more clue.</span>
      </li>,
    ),
  );
  if (!notes.length) return null;
  return <ul className="pc-notes">{notes}</ul>;
}

// ---------------------------------------------------------------- the ballot's card slot

export interface BallotCard {
  id: string;
  player_id?: string;
}

export function BallotCardSlot({
  view,
  value,
  onChange,
  accused,
  stake,
  who,
}: {
  view: View;
  value: BallotCard | null;
  onChange: (c: BallotCard | null) => void;
  accused: string | null;
  stake: number;
  who: Who;
}) {
  const c = view.cards;
  if (!c?.active) return null;
  const options = c.mine.hand.filter((h) => h.playable && card(h.id)?.windows.includes("ballot"));
  if (!options.length) return null;
  const chosen = value ? card(value.id) : undefined;
  const others = view.players.filter((p) => !p.left && p.id !== view.my_id && (value?.id !== "second-opinion" || p.id !== accused));
  const playedBy = new Set(c.plays.map((p) => p.player_id));
  return (
    <section className="pc-ballot-slot" aria-label="Play a card with your vote">
      <Type>Play a card with your vote</Type>
      <div className="pc-ballot-cards">
        <button type="button" className={`pc-ballot-none ${value ? "" : "selected"}`} onClick={() => onChange(null)}>
          No card
        </button>
        {options.map((h) => {
          const needsStake = card(h.id)?.needs_bet && stake === 0;
          return (
            <button
              key={h.id}
              type="button"
              className={value?.id === h.id ? "selected" : ""}
              aria-pressed={value?.id === h.id}
              disabled={needsStake}
              onClick={() => onChange({ id: h.id })}
            >
              <CardFace id={h.id} size="hand" width={72} />
              {needsStake && <small>Place a bet</small>}
            </button>
          );
        })}
      </div>
      {chosen && needsPlayer(chosen) && (
        <div className="pc-pick" role="group" aria-label={`${chosen.name}: choose a player`}>
          <small className="muted">{chosen.id === "second-opinion" ? "Your backup suspect" : chosen.id === "pocket-veto" ? "Whose vote to veto" : "Whose card to object to"}</small>
          {others
            .filter((p) => chosen.id !== "objection" || playedBy.has(p.id))
            .map((p) => (
              <button key={p.id} type="button" className={value?.player_id === p.id ? "selected" : ""} onClick={() => onChange({ id: chosen.id, player_id: p.id })}>
                {p.name}
              </button>
            ))}
        </div>
      )}
      {chosen && <p className="muted compact">Everyone will see you played a {chosen.tier === "golden" ? "GOLDEN" : chosen.tier} card when your vote locks.</p>}
    </section>
  );
}

/** Ready to send: a card that needs a player has one. */
export const ballotCardReady = (c: BallotCard | null) => !c || !needsPlayer(card(c.id)!) || !!c.player_id;

// ---------------------------------------------------------------- Cold Feet

export function ColdFeet({ view, send, busy }: { view: View; send: (k: string, v?: unknown) => void; busy: boolean }) {
  if (!view.cards?.mine.cold_feet) return null;
  const max = view.betting.max_stake || 0;
  return (
    <div className="pc-cold-feet" role="group" aria-label="Cold Feet: change your bet once">
      <Type>Cold Feet · change your bet once</Type>
      <div className="bet-options">
        {[0, 1, 2, 3].map((n) => (
          <button key={n} type="button" disabled={busy || n > Math.max(max, view.betting.my_stake ?? 0)} className={view.betting.my_stake === n ? "selected" : ""} onClick={() => send("change_bet", n)}>
            {n === 0 ? "No bet" : n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the Last Word

export function LastWordScreen({ view, send, busy, who }: { view: View; send: (k: string, v?: unknown) => void; busy: boolean; who: Who }) {
  const lw = view.cards?.mine.last_word;
  const left = useCountdown(lw?.remaining_ms, view.revision > 0 && !!lw);
  if (!lw)
    return (
      <div className="center-stage">
        <Type>Evidence review</Type>
        <h1>One last word.</h1>
        <p className="muted">Someone gets a final chance. Results in a moment.</p>
      </div>
    );
  return (
    <div className="pc-last-word">
      <Type className="center">Last Word · private</Type>
      <h1 className="center">Caught. Name the real word.</h1>
      <p className="muted center">Right, and you and your Accomplice score as if you escaped.</p>
      <div className="pc-last-word-options">
        {lw.options.map((w) => (
          <button key={w} type="button" className="button outline" disabled={busy} onClick={() => send("last_word", w)}>
            {w}
          </button>
        ))}
      </div>
      <p className="muted center compact">{Math.ceil(left / 1000)} s</p>
    </div>
  );
}

// ---------------------------------------------------------------- switches

export function PowerCardsSwitch({ view, send, busy }: { view: View; send: (k: string, v?: unknown) => void; busy: boolean }) {
  const enough = view.players.filter((p) => !p.left).length >= 6;
  const on = !!view.cards?.on;
  return (
    <div className="round-settings-toggle kickoff-toggle pc-switch">
      <span>
        <strong>Power cards</strong>
        <small>{enough ? "Draw, hold and play cards. From next round." : "Needs 6 or more players."}</small>
      </span>
      <button type="button" className="rule-switch" role="switch" aria-label="Power cards" aria-checked={on} disabled={busy} onClick={() => send("power_cards", !on)} />
    </div>
  );
}

export function CardTextSwitch() {
  const [lang, setLang] = useState<CardLanguage>(cardLanguage);
  useEffect(() => onCardLanguage(setLang), []);
  return (
    <div className="pc-lang" role="group" aria-label="Card text language">
      <small className="muted">Card text</small>
      {(["en", "fil"] as const).map((l) => (
        <button key={l} type="button" className={lang === l ? "selected" : ""} aria-pressed={lang === l} onClick={() => setCardLanguage(l)}>
          {l === "en" ? "English" : "Filipino"}
        </button>
      ))}
    </div>
  );
}

