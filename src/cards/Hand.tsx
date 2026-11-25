// The hand: the header button, the case-file sheet, card detail with your
// role's guidance, choosing a player or role, the confirm step that shows
// exactly what the room will see, and the CLASSIFIED file for private reads.
import { useState, type ReactNode } from "react";
import { MotionSheet } from "../motion-ui";
import { play as playSound } from "../sound";
import { Stamp, Type } from "../theme";
import type { CastRole, View } from "../types";
import { CardBack, CardDetailBody, CardFace, fitOf } from "./Card";
import { flyCard } from "./fx";
import { CardTextSwitch, type Who } from "./Round";
import { ability, card, FIT_LABEL, needsPlayer, needsRole, needsTwo, type CardInfo } from "./catalog";

const READS = new Set(["word-count", "borrowed-hint", "master-key", "private-eye", "x-ray", "reshuffle", "wiretap"]);
const ROLES: CastRole[] = ["imposter", "accomplice", "detective", "judge", "decoy", "gambler"];
const ROLE_NAME: Record<CastRole, string> = { imposter: "Imposter", accomplice: "Accomplice", detective: "Detective", judge: "Judge", decoy: "Decoy", gambler: "Gambler" };

export function HandButton({ view, onOpen }: { view: View; onOpen: () => void }) {
  const c = view.cards;
  const count = c?.mine.hand.length ?? 0;
  if (!c?.on || (!count && !c.mine.played)) return null;
  const live = c.active && c.mine.hand.some((h) => h.playable);
  return (
    <button type="button" className={`icon-button pc-hand-button ${live ? "live" : ""}`} aria-label={`Your cards: ${count}`} onClick={onOpen}>
      <span className="pc-fan" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="pc-badge">{count}</span>
    </button>
  );
}

/** "You can play a card now", under the header, never over the main action. */
export function PlayableNudge({ view, onOpen }: { view: View; onOpen: () => void }) {
  const c = view.cards;
  if (!c?.active || !c.mine.hand.some((h) => h.playable && !card(h.id)?.windows.includes("ballot"))) return null;
  return (
    <button type="button" className="pc-nudge" onClick={onOpen}>
      <span className="dot" />
      You can play a card now
      <span className="lime">Open</span>
    </button>
  );
}

type Step = { kind: "list" } | { kind: "detail"; id: string } | { kind: "pick"; id: string } | { kind: "confirm"; id: string; player?: string; second?: string; role?: CastRole };

export function HandSheet({
  view,
  send,
  busy,
  who,
  onClose,
}: {
  view: View;
  send: (kind: string, value?: unknown) => Promise<void> | void;
  busy: boolean;
  who: Who;
  onClose: () => void;
}) {
  const c = view.cards!;
  const role = view.private_role?.role ?? null;
  const me = who.name(view.my_id);
  const [step, setStep] = useState<Step>({ kind: "list" });
  const played = c.mine.played;
  const others = view.players.filter((p) => !p.left && p.id !== view.my_id);
  const playedBy = new Set(c.plays.map((p) => p.player_id));
  const title = step.kind === "list" ? "Your case file" : card(step.id)?.name ?? "";

  const content = () => {
    if (step.kind === "list")
      return (
        <>
          <Type>Case · {me}’s evidence</Type>
          <div className="pc-hand-head">
            {role && <span className="pc-role-line">Your role this round: <b>{ROLE_NAME[role]}</b></span>}
            <span className="pc-pill gold">Golden {c.mine.golden_chance}%</span>
          </div>
          {played && (
            <div className="pc-played-note">
              <Type>Played this round</Type>
              <span>
                {card(played.card)?.name}
                {played.cancelled && <Stamp className="pc-mini-stamp">{played.verdict ?? "Stopped"}</Stamp>}
              </span>
              <PrivateRead view={view} who={who} />
            </div>
          )}
          <p className="muted compact pc-rules">One active card per round. Passives wait if you play an active.</p>
          {c.mine.hand.length === 0 ? (
            <p className="muted">No cards in hand.</p>
          ) : (
            <div className="pc-hand-grid">
              {c.mine.hand.map((h) => {
                const info = card(h.id)!;
                const fit = fitOf(info, role);
                return (
                  <button key={h.id} type="button" className="pc-hand-card" onClick={() => setStep({ kind: "detail", id: h.id })}>
                    <CardFace id={h.id} size="hand" state={h.playable ? "playable" : info.kind === "passive" ? "plain" : "later"} />
                    {info.kind === "passive" ? (
                      <span className="pc-fit ok">Fires on its own</span>
                    ) : fit ? (
                      <span className={`pc-fit ${fit}`}>{FIT_LABEL[fit]}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
          <CardTextSwitch />
        </>
      );
    const info = card(step.id)!;
    const held = c.mine.hand.find((h) => h.id === step.id);
    if (step.kind === "detail") {
      return (
        <>
          <CardDetailBody info={info} role={role} playable={held?.playable} />
          <div className="actions">
            {held?.playable && !info.windows.includes("ballot") ? (
              <button
                type="button"
                className="button primary"
                onClick={() => setStep(needsPlayer(info) || needsRole(info) ? { kind: "pick", id: info.id } : { kind: "confirm", id: info.id })}
              >
                Play
              </button>
            ) : (
              <button type="button" className="button outline" disabled>
                {info.windows.includes("ballot") && held?.playable ? "Play it on your ballot" : held?.reason ?? "Not now"}
              </button>
            )}
            <button type="button" className="button text" onClick={() => setStep({ kind: "list" })}>
              Back to the case file
            </button>
          </div>
        </>
      );
    }
    if (step.kind === "pick") {
      const choose = (p: string) => setStep({ kind: "confirm", id: info.id, player: p });
      const candidates = info.id === "objection" ? others.filter((p) => playedBy.has(p.id)) : info.id === "sealed-alibi" ? view.players.filter((p) => !p.left) : others;
      return (
        <>
          <h2>{info.id === "sealed-alibi" ? "Who will the room accuse?" : needsRole(info) ? "Which role do you claim?" : needsTwo(info) ? "Pick the first player" : "Pick a player"}</h2>
          {needsRole(info) ? (
            <div className="pc-pick-list">
              {ROLES.map((r) => (
                <button key={r} type="button" onClick={() => setStep({ kind: "confirm", id: info.id, role: r })}>
                  {ROLE_NAME[r]}
                </button>
              ))}
            </div>
          ) : (
            <div className="pc-pick-list">
              {candidates.map((p) => (
                <button key={p.id} type="button" onClick={() => choose(p.id)}>
                  {who.avatar(p.id)}
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          )}
          <button type="button" className="button text" onClick={() => setStep({ kind: "detail", id: info.id })}>
            Back
          </button>
        </>
      );
    }
    // confirm (Private Eye picks its second player here)
    const needSecond = needsTwo(info) && !step.second;
    if (needSecond)
      return (
        <>
          <h2>Pick the second player</h2>
          <div className="pc-pick-list">
            {others
              .filter((p) => p.id !== step.player)
              .map((p) => (
                <button key={p.id} type="button" onClick={() => setStep({ ...step, second: p.id })}>
                  {who.avatar(p.id)}
                  <span>{p.name}</span>
                </button>
              ))}
          </div>
        </>
      );
    const fit = fitOf(info, role);
    const tierWord = info.tier === "golden" ? "GOLDEN" : info.tier === "rare" ? "Rare" : "Common";
    return (
      <>
        <div className="pc-confirm-card">
          <CardFace id={info.id} width={120} />
        </div>
        <div className="pc-confirm-head">
          <h2>Play {info.name}?</h2>
          {fit && <span className={`pc-fit ${fit}`}>{FIT_LABEL[fit]}</span>}
        </div>
        <Type>Everyone will see</Type>
        <div className="pc-everyone">
          <span>
            <b>{me}</b> played a <b>{info.id === "bluff-card" ? "random-tier" : tierWord}</b> card
          </span>
          <CardBack size="chip" tier={info.id === "bluff-card" ? undefined : info.tier} />
        </div>
        {sideEffect(info, step, who) && <p className="pc-side">{sideEffect(info, step, who)}</p>}
        <Type>Only you get</Type>
        <p className="pc-only">{ability(info)}</p>
        <div className="actions">
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={async () => {
              const from = document.querySelector(".pc-confirm-card .pc-card");
              const flight = READS.has(info.id) ? null : flyCard(from, document.querySelector(".pc-plays ul") ?? document.querySelector(".appbar"), info.tier);
              if (flight) onClose();
              await send("play_card", { card: info.id, player_id: step.player, second_id: step.second, role: step.role });
              playSound("file");
              await flight;
              // A private read stays open on its file; anything else closes so
              // you see the room react.
              if (READS.has(info.id)) setStep({ kind: "list" });
            }}
          >
            Play card
          </button>
          <button type="button" className="button outline" onClick={() => setStep({ kind: "list" })}>
            Keep it
          </button>
        </div>
      </>
    );
  };

  return (
    <MotionSheet labelledBy="pc-hand-title" busy={busy} onDismiss={onClose} className="pc-hand-sheet case-sheet">
      <button className="sheet-close icon-button" aria-label="Close your cards" onClick={onClose}>
        ×
      </button>
      <h2 id="pc-hand-title" className="sr-only">
        {title}
      </h2>
      {content()}
    </MotionSheet>
  );
}

function sideEffect(info: CardInfo, step: { player?: string; role?: CastRole }, who: Who) {
  const p = who.name(step.player);
  switch (info.id) {
    case "late-arrival":
      return "Everyone will see you give your clue last.";
    case "opening-act":
      return "Everyone will see you give your clue first.";
    case "put-on-the-spot":
      return `Everyone will see: ${p}, one more clue.`;
    case "anonymous-tip":
      return `When voting opens: “Someone suspects ${p}”. Your name stays hidden.`;
    case "on-the-record":
      return `Everyone will see: you vote ${p}, locked now.`;
    case "cover-story":
      return `Everyone will see: you claim to be the ${step.role ? ROLE_NAME[step.role] : "…"}.`;
    case "spotlight":
      return `Everyone will see which side ${p} is on.`;
    case "objection":
      return `Everyone will see the verdict on ${p}’s card.`;
    default:
      return "";
  }
}

/** What a private card showed you: a CLASSIFIED file, only on your phone. */
export function PrivateRead({ view, who }: { view: View; who: Who }) {
  const c = view.cards;
  const played = c?.mine.played;
  const read = played?.read as Record<string, unknown> | Array<Record<string, unknown>> | null | undefined;
  const wiretap = c?.mine.wiretap;
  if (!played || (!read && !wiretap)) return null;
  let body: ReactNode = null;
  switch (played.card) {
    case "word-count":
      body = <p>The real word has <b>{String((read as Record<string, unknown>).letters)}</b> letters.</p>;
      break;
    case "borrowed-hint":
      body = <p>The Imposter’s hint: <b>{String((read as Record<string, unknown>).hint)}</b></p>;
      break;
    case "master-key":
      body = <p>The real word: <b>{String((read as Record<string, unknown>).word)}</b></p>;
      break;
    case "x-ray": {
      const r = read as { player_id: string; role: CastRole };
      body = <p>{who.name(r.player_id)} is the <b>{ROLE_NAME[r.role]}</b>.</p>;
      break;
    }
    case "private-eye":
      body = (
        <ul className="pc-reads">
          {(read as Array<{ player_id: string; side?: string; blocked?: boolean }>).map((r) => (
            <li key={r.player_id}>
              {who.avatar(r.player_id)}
              <span>{who.name(r.player_id)}</span>
              <b className={r.blocked ? "muted" : r.side === "imposter" ? "terra" : "lime"}>{r.blocked ? "Blocked" : r.side === "imposter" ? "Imposter’s side" : "Civilian side"}</b>
            </li>
          ))}
        </ul>
      );
      break;
    case "reshuffle": {
      const drew = (read as Record<string, unknown>).drew as string | null;
      body = <p>{drew ? <>You drew <b>{card(drew)?.name}</b>. Playable from next round.</> : "The deck was empty."}</p>;
      break;
    }
    case "wiretap":
      body = wiretap ? <p>{who.name(wiretap.player_id)} {wiretap.vote ? <>voted <b>{who.name(wiretap.vote)}</b>.</> : "hasn’t voted yet."}</p> : null;
      break;
  }
  if (!body) return null;
  return (
    <div className="pc-classified">
      <Stamp>Classified</Stamp>
      <Type>{card(played.card)?.name} · only you can see this</Type>
      {body}
    </div>
  );
}
