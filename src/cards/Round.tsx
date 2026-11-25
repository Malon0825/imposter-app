// Power cards on the round's screens: the draw window, the plays strip and
// public effects, the ballot's card slot, Cold Feet, the Last Word, and the
// host's switch. The hand itself lives in Hand.tsx.
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MotionSheet } from "../motion-ui";
import { MOTION } from "../motion";
import { play as playSound } from "../sound";
import { Stamp, Type } from "../theme";
import type { CastRole, View } from "../types";
import { CardBack, CardDetailBody, CardFace } from "./Card";
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
  // The card being read up close; tapping a card opens it, so nobody has to
  // scroll back up to the hand to see what a card does.
  const [peek, setPeek] = useState<string | null>(null);
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
              aria-label={`${card(h.id)?.name}: read and choose`}
              onClick={() => setPeek(h.id)}
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
      {/* At the page root: the ballot sits in an animated (transformed)
          screen, which would pin a fixed sheet to itself, off-screen. */}
      {createPortal(<AnimatePresence>
        {peek && card(peek) && (
          <MotionSheet key="ballot-card" labelledBy="pc-ballot-card-title" onDismiss={() => setPeek(null)} className="pc-hand-sheet case-sheet">
            <button className="sheet-close icon-button" aria-label="Close the card" onClick={() => setPeek(null)}>
              ×
            </button>
            <h2 id="pc-ballot-card-title" className="sr-only">{card(peek)!.name}</h2>
            <CardDetailBody info={card(peek)!} role={view.private_role?.role ?? null} playable />
            <div className="actions">
              {value?.id === peek ? (
                <button type="button" className="button outline" onClick={() => { onChange(null); setPeek(null); }}>
                  Don’t use it
                </button>
              ) : card(peek)!.needs_bet && stake === 0 ? (
                <button type="button" className="button outline" disabled>
                  Place a bet to use it
                </button>
              ) : (
                <button type="button" className="button primary" onClick={() => { onChange({ id: peek }); setPeek(null); }}>
                  Use it with my vote
                </button>
              )}
              <button type="button" className="button text" onClick={() => setPeek(null)}>
                Back to my vote
              </button>
            </div>
          </MotionSheet>
        )}
      </AnimatePresence>, document.body)}
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

