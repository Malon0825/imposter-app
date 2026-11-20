import { motion, useReducedMotion } from "motion/react";
import { Icon } from "./icons";
import { MOTION } from "./motion";
import type { RoundRule } from "./types";

export const ROUND_RULES = {
  classic: {
    name: "Classic",
    headline: "Choose your words.",
    short: "Give a spoken clue.",
    instruction: "Choose a clue linked to your word.",
    detail: "Keep the hidden word to yourself.",
    next: "Choose a topic together next.",
    reminder: "Spoken clues",
  },
  act_it: {
    name: "Act It",
    headline: "Let your actions talk.",
    short: "No words. No sounds.",
    instruction: "Act out a clue linked to your word.",
    detail: "Talking is allowed during discussion.",
    next: "Only act-ready topics come next.",
    reminder: "No words or sounds",
  },
  sound_only: {
    name: "Sound Only",
    headline: "Make some noise.",
    short: "No words. No gestures.",
    instruction: "Make a sound linked to your word.",
    detail: "Talking is allowed during discussion.",
    next: "Only sound-ready topics come next.",
    reminder: "No words",
  },
} satisfies Record<RoundRule, Record<string, string>>;

export function RuleArt({ rule }: { rule: RoundRule }) {
  return (
    <svg className="rule-art" viewBox="0 0 200 150" aria-hidden="true">
      {rule === "sound_only" ? (
        <>
          <rect x="22" y="58" width="46" height="61" rx="13" fill="#27332c" />
          <path
            d="M59 61 109 24q11-7 11 7v102q0 14-11 7l-50-25Z"
            fill="#9caf96"
          />
          <path
            d="M133 66q14 20 0 42m17-56q24 34 0 69m16-83q34 47 0 95"
            fill="none"
            stroke="#26342c"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </>
      ) : rule === "act_it" ? (
        <>
          <path
            d="M24 85q7-9 35-9l14 65-36 6q-12 0-15-13l-7-33q-2-10 9-16Z"
            fill="#27332c"
          />
          <path
            d="M53 82c12-16 29-16 34-38l5-19c3-12 20-10 22 2 3 12-2 28-6 34l67-11c17-2 20 18 4 22l-28 6c16-1 19 17 4 22 11 2 10 15 0 19 7 6 4 15-6 19l-32 8c-20 5-38 3-51-6Z"
            fill="#9caf96"
          />
          <path
            d="m151 78-35 7m39 15-34 7m33 12-30 7"
            fill="none"
            stroke="#728970"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d="M22 20h82q28 0 28 26v32q0 25-28 25H64l-35 24 7-25Q12 97 12 78V45q0-25 10-25Z"
            fill="#a5b79b"
          />
          <path
            d="M97 64h65q28 0 28 26v22q0 26-28 26h-6l-22 11 2-11H97q-28 0-28-26V90q0-26 28-26Z"
            fill="#26342c"
          />
        </>
      )}
      <path
        d="m158 22 7-13m7 22 13-9m-8 20 13 1"
        fill="none"
        stroke="#c7e958"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RuleIndicator({ rule }: { rule: RoundRule }) {
  return (
    <p className="round-rule-indicator">
      <Icon
        name={
          rule === "sound_only"
            ? "waveform"
            : rule === "act_it"
              ? "body"
              : "chat"
        }
        size={22}
      />
      <span>
        {ROUND_RULES[rule].name} · {ROUND_RULES[rule].reminder}
      </span>
    </p>
  );
}

export function RuleReveal({ rule }: { rule: RoundRule }) {
  const reduced = useReducedMotion();
  const copy = ROUND_RULES[rule];
  return (
    <>
      <div className="rule-reveal-heading">
        <h1>{copy.headline}</h1>
        <p className="muted">The rule for everyone this round.</p>
      </div>
      <motion.div
        className="round-rule-card"
        initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: reduced ? 0 : MOTION.roleReveal,
          ease: MOTION.easeOut,
        }}
      >
        <b>THIS ROUND</b>
        <RuleArt rule={rule} />
        <h2>{copy.name}</h2>
        <p>{copy.short}</p>
      </motion.div>
      <div className="rule-reveal-explanation">
        <h2>{copy.instruction}</h2>
        <p className="muted">{copy.detail}</p>
      </div>
      <p className="center muted compact">
        Chosen at random · Same rule for all
      </p>
    </>
  );
}
