// Power cards after the vote: card lines in your breakdown, the round's
// cards turned face up one by one, the Bounty, the Wanted poster on the
// standings, and the Story of the night at the end of a session.
import { useEffect, useRef } from "react";
import { play as playSound } from "../sound";
import { centre, EASE, flash, go, reducedMotion, sleep, sparks, stampSlam } from "./fx";
import { Stamp, Type } from "../theme";
import type { CardsView, PlayEffect, StoryPlay, View } from "../types";
import { CardBack, CardFace } from "./Card";
import { card } from "./catalog";
import type { Who } from "./Round";

const signed = (n: number) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

/** A card line in your own breakdown. */
export function cardLineLabel(line: { card: string; from: string }, myId: string, who: Who) {
  if (line.card === "bounty") return "Bounty";
  const name = card(line.card)?.name ?? line.card;
  return line.from && line.from !== myId ? `${name} · ${who.name(line.from)}` : name;
}

/** One sentence on what a play did, for the replay and the story. */
export function outcome(p: { card: string; tier: string; real_tier?: string; cancelled?: boolean; verdict?: string | null; pick?: string | null; effect?: PlayEffect }, who: Who) {
  if (p.verdict === "blocked") return "Blocked by Lawyer Up.";
  if (p.cancelled && p.verdict !== "vetoed") return "Cancelled by an Objection.";
  if (p.card === "bluff-card") return p.tier === "golden" ? "Looked GOLDEN. Nothing happened. Fooled the room." : `Looked ${p.tier}. Nothing happened.`;
  const moved = p.effect?.moved ?? [];
  if (moved.length) return moved.map((m) => `${who.name(m.player_id)} ${signed(m.points)}`).join(" · ");
  if (p.card === "cover-story" && p.effect?.claim_true != null) return p.effect.claim_true ? "The claim was true." : "The claim was a lie.";
  if (["midas-touch", "double-or-nothing", "turncoat", "golden-pardon", "second-opinion"].includes(p.card) && p.effect?.owner_total != null)
    return `Their round: ${signed(p.effect.owner_total)}.`;
  const on = who.name(p.pick);
  const said: Record<string, string> = {
    "late-arrival": "Gave their clue last.",
    "opening-act": "Gave their clue first.",
    "put-on-the-spot": `Made ${on} give one more clue.`,
    "anonymous-tip": `Tipped the room about ${on}.`,
    "on-the-record": `Put a vote for ${on} on the record.`,
    "word-count": "Counted the letters in the real word.",
    "borrowed-hint": "Read the Imposter’s hint.",
    "master-key": "Read the real word.",
    "private-eye": "Checked two players’ sides.",
    "x-ray": `Saw ${on}’s exact role.`,
    "wiretap": `Listened in on ${on}’s vote.`,
    "spotlight": `Showed everyone ${on}’s side.`,
    "lawyer-up": "Lawyered up.",
    "objection": `Objected to ${on}’s card.`,
    "pocket-veto": `Vetoed ${on}’s vote.`,
    "heavy-vote": "Voted with extra weight.",
    "golden-ballot": "Voted four times over.",
    "cold-feet": "Kept the option to change their bet.",
    "reshuffle": "Traded the card for a new draw.",
    "sealed-alibi": `Predicted ${on} would be accused. It didn’t pay.`,
    "decoy-contract": "Wanted the room to accuse them. It didn’t.",
    "shadow": `Shadowed ${on}, who earned nothing.`,
    "crown-heist": "Tried to steal the crown. It didn’t pay.",
    "robin-hood": "Took from the rich.",
  };
  return said[p.card] ?? (p.pick ? `On ${on}.` : "Played.");
}

export function CardsReplay({ view, who }: { view: View; who: Who }) {
  const c = view.cards;
  const list = useRef<HTMLOListElement>(null);
  const skip = useRef(false);
  const plays = c?.active && c.plays.length && c.plays[0].card ? c.plays : null;
  // Dealt face down from the right, then each card flips, its outcome
  // slides in and its stamp slams with a jolt. A tap shows everything.
  useEffect(() => {
    if (!plays || !list.current) return;
    let live = true;
    const rows = [...list.current.querySelectorAll<HTMLElement>(":scope > li")];
    const showAll = () => rows.forEach((row) => row.classList.add("shown", "dealt"));
    (async () => {
      await sleep(250);
      rows.forEach((row, i) =>
        go(row.querySelector(".pc-replay-card"), [
          { transform: "translateX(320px) rotate(25deg)", opacity: 0 },
          { transform: "translateX(-6px) rotate(-3deg)", opacity: 1, offset: 0.8 },
          { transform: "none", opacity: 1 },
        ], { duration: 420, delay: i * 110 }),
      );
      rows.forEach((row) => row.classList.add("dealt"));
      await sleep(420 + rows.length * 110 + 150);
      for (const [i, row] of rows.entries()) {
        if (!live || skip.current) return showAll();
        const p = plays[i];
        const holder = row.querySelector<HTMLElement>(".pc-replay-card");
        go(holder, [{ transform: "rotateY(0)" }, { transform: "scale(1.1) rotateY(90deg)" }], { duration: 170, easing: EASE.in });
        await sleep(170);
        row.classList.add("shown");
        go(holder, [{ transform: "scale(1.1) rotateY(-90deg)" }, { transform: "scale(1.04) rotateY(12deg)", offset: 0.7 }, { transform: "none" }], { duration: 260 });
        await sleep(260);
        const [x, y] = centre(holder);
        if (p.real_tier === "golden") {
          sparks(x, y, { n: 26, c1: "#f8e6a6", c2: "#e9c46a", spread: 140 });
          flash("#e9c46a", 0.15, 220);
        }
        go(row.querySelector(".pc-replay-text"), [{ opacity: 0, transform: "translateX(-14px)" }, { opacity: 1, transform: "none" }], { duration: 280 });
        await sleep(240);
        const stamp = row.querySelector<HTMLElement>(".stamp");
        if (stamp) await stampSlam(stamp, { tone: p.cancelled ? "rgba(196,80,58,.85)" : "rgba(244,241,232,.55)", jolt: p.card === "bluff-card" ? 7 : 4 });
        if (p.card === "bluff-card" && p.tier === "golden") playSound("womp");
        else playSound("stamp");
        await sleep(p.card === "bluff-card" ? 520 : 380);
      }
    })();
    return () => {
      live = false;
    };
  }, [view.round_id, !!plays]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!plays) return null;
  return (
    <section className="pc-replay" aria-labelledby="pc-replay-title" onClick={() => {
      skip.current = true;
      list.current?.querySelectorAll(":scope > li").forEach((row) => row.classList.add("shown", "dealt"));
    }}>
      <Type>Evidence review</Type>
      <h2 id="pc-replay-title">Cards this round</h2>
      <ol ref={list} className={reducedMotion() ? "instant" : ""}>
        {plays.map((p) => (
          <li key={p.seq}>
            <div className="pc-replay-card">
              <CardFace id={p.card!} size="hand" width={64} state={p.cancelled ? "spent" : "plain"} />
              <div className="pc-replay-cover">
                <CardBack size="hand" width={64} />
              </div>
            </div>
            <div className="pc-replay-text">
              <span className="pc-replay-who">
                {who.avatar(p.player_id)}
                <b>{who.name(p.player_id)}</b>
                <small className={p.tier}>{p.card === "bluff-card" ? `looked ${p.tier}` : p.tier}</small>
              </span>
              <span className="pc-replay-name">{card(p.card!)?.name}</span>
              <span className="pc-replay-what">{outcome(p as Required<typeof p>, who)}</span>
            </div>
            {(p.verdict || p.card === "bluff-card") && (
              <Stamp tone={p.cancelled || p.card === "bluff-card" ? "red" : "ink"}>{p.card === "bluff-card" && !p.verdict ? "Bluff" : p.verdict}</Stamp>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function BountyNote({ view }: { view: View }) {
  const paid = view.cards?.bounty_paid;
  const stamp = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!paid) return;
    const t = window.setTimeout(() => {
      stampSlam(stamp.current?.querySelector<HTMLElement>(".stamp") ?? null, { jolt: 6 });
      playSound("coins");
    }, 900);
    return () => window.clearTimeout(t);
  }, [paid, view.round_id]);
  if (!paid) return null;
  return (
    <div className="pc-bounty clipping">
      <Type>Bounty</Type>
      <span>The leader lost. <b>{signed(paid)}</b> to every Underdog.</span>
      <span ref={stamp} className="pc-paid-holder">
        <Stamp className="pc-paid">Paid</Stamp>
      </span>
    </div>
  );
}

/** The leader on a Wanted poster, with the Bounty on their head. */
export function WantedPoster({ view, who }: { view: View; who: Who }) {
  const s = view.cards?.standing;
  if (!view.cards?.on || !s || !s.leaders.length) return null;
  const lead = s.leaders[0];
  const points = view.players.find((p) => p.id === lead)?.points ?? 0;
  return (
    <div className="pc-wanted" role="note" aria-label={`Wanted: ${who.name(lead)}`}>
      <div className="mugshot-frame">{who.avatar(lead)}</div>
      <div>
        <span className="pc-wanted-title">Wanted</span>
        <b>{s.leaders.map((id) => who.name(id)).join(" & ")}</b>
        <small>{points} points{s.leaders.length > 1 ? " each" : ""}</small>
        {s.bounty ? <Stamp className="pc-wanted-bounty">Bounty +{s.bounty}</Stamp> : <small>No Underdogs yet.</small>}
      </div>
    </div>
  );
}

/** Tags on a standings row: Long shot for Underdogs, and the hand size. */
export function StandingTags({ cards, id }: { cards: CardsView | null | undefined; id: string }) {
  if (!cards?.on) return null;
  const underdog = cards.standing?.underdogs.includes(id);
  const hand = cards.hand_counts[id] ?? 0;
  return (
    <span className="pc-standing-tags">
      {underdog && <Stamp tone="lime" className="pc-longshot">Long shot</Stamp>}
      {hand > 0 && (
        <span className="pc-hand-count" aria-label={`${hand} cards`}>
          <CardBack size="chip" />×{hand}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- the Story of the night

function swing(p: StoryPlay) {
  const moved = p.effect.moved.reduce((n, m) => n + Math.abs(m.points), 0);
  return Math.max(moved, Math.abs(p.effect.owner_total ?? 0) * (["midas-touch", "double-or-nothing"].includes(p.card) ? 1 : 0));
}

export function StoryOfTheNight({ view, who }: { view: View; who: Who }) {
  const story = view.cards?.story;
  const plays = story?.plays ?? [];
  const golden = plays.filter((p) => p.real_tier === "golden" && !p.cancelled);
  const biggest = [...plays].sort((a, b) => swing(b) - swing(a))[0];
  const bluff =
    plays.find((p) => p.card === "bluff-card" && p.tier === "golden" && !p.cancelled) ??
    plays.find((p) => p.card === "cover-story" && p.effect.claim_true === false && !p.cancelled);
  const comeback = Object.entries(story?.comeback ?? {}).sort((a, b) => b[1] - a[1])[0];
  const winners = view.players.filter((p) => view.score_session.winner_ids.includes(p.id));
  const rounds = [...new Set(plays.map((p) => p.round))];
  return (
    <article className="paper pc-story">
      <header>
        <Type>Party edition · Session {view.score_session.number}</Type>
        <h1 className="pc-masthead">The Imposter Times</h1>
        <div className="rule" />
        <h2 className="pc-headline">
          {winners.length ? `${winners.map((w) => w.name).join(" & ").toUpperCase()} TAKES THE NIGHT` : "CASE CLOSED"}
        </h2>
        <p className="pc-dek">{plays.length} cards played · {golden.length} Golden</p>
      </header>
      <div className="col">
        {golden.length > 0 && (
          <section>
            <h3>Golden moments</h3>
            {golden.map((p, i) => (
              <p key={i}>
                <b>{who.name(p.player_id)}</b> played <b>{card(p.card)?.name}</b> in round {p.round}. {outcome(p, who)}
              </p>
            ))}
          </section>
        )}
        {biggest && swing(biggest) > 0 && (
          <section>
            <h3>Biggest swing</h3>
            <p>
              <b>{who.name(biggest.player_id)}</b>’s <b>{card(biggest.card)?.name}</b> moved {swing(biggest)} points. {outcome(biggest, who)}
            </p>
          </section>
        )}
        {bluff && (
          <section>
            <h3>Best bluff</h3>
            <p>
              <b>{who.name(bluff.player_id)}</b> {bluff.card === "bluff-card" ? "faked a Golden card and the room bought it." : `claimed to be the ${bluff.effect.claim ? bluff.effect.claim[0].toUpperCase() + bluff.effect.claim.slice(1) : "…"} and lied.`}
            </p>
          </section>
        )}
        {comeback && comeback[1] > 0 && (
          <section>
            <h3>Comeback</h3>
            <p>
              <b>{who.name(comeback[0])}</b> climbed {comeback[1]} points as an Underdog.
            </p>
          </section>
        )}
        <section>
          <h3>Every card, round by round</h3>
          {rounds.length === 0 && <p>No cards were played this session.</p>}
          {rounds.map((r) => (
            <div key={r} className="pc-story-round">
              <h4>Round {r}</h4>
              {plays
                .filter((p) => p.round === r)
                .map((p, i) => (
                  <p key={i}>
                    <b>{who.name(p.player_id)}</b> · {card(p.card)?.name} ({p.real_tier}). {outcome(p, who)}
                  </p>
                ))}
            </div>
          ))}
        </section>
      </div>
    </article>
  );
}
