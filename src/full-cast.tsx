import { motion, useReducedMotion } from "motion/react";
import { Stamp } from "./theme";
import { Icon } from "./icons";
import { MOTION } from "./motion";
import type { CastRole, Player } from "./types";

export const CAST: Record<CastRole, {
  name: string;
  side: "imposter" | "civilian";
  icon: string;
  title: string;
  power: string;
  reminder: string;
  vote: string;
  /** What this role's bet rides on. */
  bet: string;
  /** The one line a player needs on the role screen. */
  goal: string;
}> = {
  imposter: {
    name: "Imposter", side: "imposter", icon: "eye",
    title: "You are the imposter",
    power: "Gets a hint. Names the accomplice and the decoy.",
    reminder: "Blend in. Watch for a wink.",
    vote: "Name both. Escape to keep them.",
    bet: "Escape bet",
    goal: "Escape the vote.",
  },
  accomplice: {
    name: "Accomplice", side: "imposter", icon: "people",
    title: "You are the accomplice",
    power: "Knows the word and the imposter. Wins with the escape.",
    reminder: "Wink once. Don’t let the Detective see.",
    vote: "Your vote stays private.",
    bet: "Escape bet",
    goal: "Help the imposter escape.",
  },
  detective: {
    name: "Detective", side: "civilian", icon: "search",
    title: "You are the detective",
    power: "Clears one player. Names the imposter and the accomplice.",
    reminder: "Watch for winks. Anyone can claim your badge.",
    vote: "Name both. Your bet rides on the accomplice.",
    bet: "Accomplice bet",
    goal: "Catch the imposter and the accomplice.",
  },
  judge: {
    name: "Judge", side: "civilian", icon: "shield",
    title: "You are the judge",
    power: "Vote counts twice. Breaks ties that catch the imposter.",
    reminder: "Your vote counts twice. Make it count.",
    vote: "Your vote counts twice.",
    bet: "Confidence bet",
    goal: "Catch the imposter. Your vote counts twice.",
  },
  decoy: {
    name: "Decoy", side: "civilian", icon: "shuffle",
    title: "You are the decoy",
    power: "Holds a related word. Must blend in without misleading.",
    reminder: "Blend in. Listen for the real word.",
    vote: "Your vote stays private.",
    bet: "Confidence bet",
    goal: "Blend in. Don’t get spotted.",
  },
  gambler: {
    name: "Gambler", side: "civilian", icon: "flash",
    title: "You are a gambler",
    power: "Bigger bets: the top bet pays +5.",
    reminder: "Read the room, then bet big.",
    vote: "Your vote stays private.",
    bet: "Gambler’s bet",
    goal: "Catch the imposter. Bet big.",
  },
};

export const CAST_ORDER: CastRole[] = ["imposter", "accomplice", "detective", "judge", "decoy", "gambler"];

/** Mirrors party-core: which roles are dealt at this size, Gamblers aside. */
export const specials = (players: number): CastRole[] =>
  players < 3 ? []
  : players === 3 ? ["imposter", "decoy"]
  : players === 4 ? ["imposter", "decoy", "judge"]
  : ["imposter", "accomplice", "detective", "judge", "decoy"];
/** Below five the Decoy holds the real word and plays as bait. */
export const baitDecoy = (players: number) => players < 5;
/** The Judge's ballot only weighs double once the room is big enough. */
export const judgeDoubles = (players: number) => players >= 6;

/** The same role, worded for the size it is being played at. */
export function castCopy(role: CastRole, players: number) {
  const c = CAST[role];
  if (role === "decoy" && baitDecoy(players))
    return {
      ...c,
      power: "Holds the real word. Wants to look guilty.",
      reminder: "Draw suspicion. Just don’t get convicted.",
      goal: "Pull votes onto yourself.",
    };
  if (role === "imposter" && baitDecoy(players))
    return {
      ...c,
      power: "Gets a hint instead of the word.",
      reminder: "Blend in. Read the room.",
      vote: "Escape to keep your points.",
    };
  if (role === "judge" && !judgeDoubles(players))
    return {
      ...c,
      power: "Breaks any tie that catches the imposter.",
      reminder: "A tie is yours to break.",
      vote: "You break the tie.",
      goal: "Catch the imposter. Ties are yours.",
    };
  return c;
}

/** Public lobby preview: which roles are in play, never who holds them. */
export function CastLineup({ players }: { players: number }) {
  const lineup = specials(players);
  const gamblers = players - lineup.length;
  return (
    <section className="cast-lineup" aria-labelledby="cast-lineup-title">
      <h2 id="cast-lineup-title">
        <Icon name="cards" size={18} /> Tonight’s cast
      </h2>
      <ul>
        {CAST_ORDER.filter((role) => role === "gambler" ? gamblers > 0 : lineup.includes(role)).map((role) => (
          <li key={role} className={CAST[role].side}>
            <span className="cast-icon"><Icon name={CAST[role].icon} size={18} /></span>
            <span>
              <strong>
                {CAST[role].name}
                {role === "gambler" && gamblers > 1 ? ` ×${gamblers}` : ""}
              </strong>
              <small>{castCopy(role, players).power}</small>
            </span>
          </li>
        ))}
      </ul>
      {players < 6 && (
        <p className="muted compact" role="status">
          More players bring more roles: the Judge at 4, the Accomplice and Detective at 5.
        </p>
      )}
    </section>
  );
}

export function RoleBadge({ role }: { role: CastRole }) {
  return (
    <span className={`role-badge cast-badge ${CAST[role].side}`}>
      <Icon name={CAST[role].icon} size={18} />
      {CAST[role].name.toUpperCase()}
    </span>
  );
}

/** Private, below the card: the one extra fact each role is dealt. */
export function RoleIntel({
  role, name, players, imposterId, clearedId,
}: { role: CastRole; name: (id?: string | null) => string; players: number; imposterId?: string; clearedId?: string }) {
  const bait = baitDecoy(players);
  const line =
    role === "accomplice" && imposterId ? <>Your imposter is <b className="terra">{name(imposterId)}</b>. Wink when nobody’s looking.</>
    : role === "detective" && clearedId ? <><b className="lime">{name(clearedId)}</b> is not the imposter or the accomplice.</>
    : role === "judge" ? (judgeDoubles(players)
      ? <>Your vote counts as <b className="lime">two</b>. In a tie, it decides only if you caught the imposter.</>
      : <>In a tie, your vote decides — but only if you caught the imposter.</>)
    : role === "decoy" ? (bait
      ? <>You hold the <b className="lime">real word</b>. Score <b className="lime">+1</b> if anyone votes for you, <b className="terra">nothing</b> if the room convicts you.</>
      : <>This is a <b className="terra">related word</b>, not the real one. If the imposter spots you, you gain nothing.</>)
    : role === "gambler" ? <>Your bets: <b>±1</b>, <b>±2</b>, or <b className="lime">+5 / −3</b>.</>
    : role === "imposter" ? (bait
      ? <>Nobody is on your side tonight. Blend in and escape the vote.</>
      : <>Your accomplice knows you. Name them, and the decoy, when you vote.</>)
    : null;
  return line && <p className="role-intel" role="note">{line}</p>;
}

export function PickChips({
  icon, title, hint, players, value, exclude = [], onPick, disabled, optional,
}: {
  icon?: string;
  title: string;
  hint?: string;
  players: Player[];
  value: string | null;
  exclude?: (string | null)[];
  onPick: (id: string | null) => void;
  disabled?: boolean;
  optional?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <section className="pick-chips" aria-label={title}>
      <div className="bet-heading">
        <h2>{icon && <Icon name={icon} size={20} />}{title}</h2>
        {optional && <span className="muted">Optional</span>}
      </div>
      {hint && <p className="muted compact">{hint}</p>}
      <div className="pick-chip-list" role="group" aria-label={title}>
        {players.map((p) => {
          const blocked = exclude.includes(p.id);
          return (
            <motion.button
              key={p.id}
              type="button"
              className={value === p.id ? "selected" : ""}
              aria-pressed={value === p.id}
              disabled={disabled || blocked}
              onClick={() => onPick(value === p.id && optional ? null : p.id)}
              whileTap={reduced ? undefined : { scale: 0.96 }}
              transition={MOTION.press}
            >
              {p.name}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

/** The role moment: who you are this round, before the word or hint. */
export function RoleStage({ role, players }: { role: CastRole; players: number }) {
  const reduced = useReducedMotion();
  const c = castCopy(role, players);
  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: MOTION.roleReveal, ease: MOTION.easeOut, delay },
        };
  return (
    <div className={`role-stage ${c.side}`}>
      <motion.div
        className="role-stage-glow"
        aria-hidden="true"
        {...(reduced ? {} : { initial: { scale: 0.4, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { duration: 0.6, ease: MOTION.easeOut } })}
      />
      <motion.img
        className="role-stage-art"
        src={`/art/full-cast/${role}.webp`}
        alt=""
        draggable={false}
        {...(reduced ? {} : { initial: { opacity: 0, y: 40, scale: 0.92 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.55, ease: MOTION.easeOut, delay: 0.05 } })}
      />
      <Stamp className="role-stage-stamp" slam delay={0.6}>Classified</Stamp>
      <motion.p className="role-stage-side type" {...rise(0.25)}>
        {c.side === "imposter" ? "Imposter side" : "Civilian side"}
      </motion.p>
      <motion.h1 className="role-stage-name" {...rise(0.32)}>{c.name}</motion.h1>
      <motion.p className="role-stage-goal" {...rise(0.42)}>{c.goal}</motion.p>
      <motion.p className="role-stage-power" {...rise(0.5)}>{c.power}</motion.p>
    </div>
  );
}

/**
 * Your role on the ballot: a dossier strip with the role's portrait peeking
 * out of its top-right corner, the side, the role name and how your vote
 * works. It sits above the question and never covers the ballot.
 */
export function BallotRole({ role, players }: { role: CastRole; players: number }) {
  const reduced = useReducedMotion();
  const c = castCopy(role, players);
  return (
    <section className={`ballot-role ${c.side}`} aria-label={`Your role: ${c.name}`}>
      <div className="ballot-role-art" aria-hidden="true">
        <motion.img
          src={`/art/full-cast/${role}.webp`}
          alt=""
          draggable={false}
          {...(reduced ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, ease: MOTION.easeOut } })}
        />
      </div>
      <p className="ballot-role-side type">{c.side === "imposter" ? "Imposter side" : "Civilian side"}</p>
      <h2 className="ballot-role-name">{c.name}</h2>
      <p className="ballot-role-vote">{c.vote}</p>
    </section>
  );
}
