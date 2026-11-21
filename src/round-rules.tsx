import { motion, useReducedMotion } from "motion/react";
import { Icon } from "./icons";
import { MOTION } from "./motion";
import type { RoundRevealStage, RoundRule } from "./types";

export const ROUND_RULES = {
  classic: {
    name: "Classic",
    headline: "Give a spoken clue.",
    short: "Give a spoken clue. Don’t say the word.",
    instruction: "Choose a clue linked to your word.",
    detail: "Keep the hidden word to yourself.",
    next: "Choose a topic together next.",
    reminder: "Spoken clues",
  },
  act_it: {
    name: "Act It",
    headline: "Show it silently.",
    short: "Act it out silently. No speaking or spelling.",
    instruction: "Act out a clue linked to your word.",
    detail: "Talking is allowed during discussion.",
    next: "Only act-ready topics come next.",
    reminder: "No words or sounds",
  },
  sound_only: {
    name: "Sound Only",
    headline: "Make some noise.",
    short: "Make a sound. No words or gestures.",
    instruction: "Make a sound linked to your word.",
    detail: "Talking is allowed during discussion.",
    next: "Only sound-ready topics come next.",
    reminder: "No words",
  },
  two_truths: {
    name: "Two Truths and a Lie", headline: "Keep them guessing.",
    short: "Say two true clues and one believable lie. Mix up the order.",
    instruction: "Say two true clues and one believable lie. Mix up the order.",
    detail: "Keep your lie to yourself until Results.", next: "Topic voting opens next", reminder: "Three short clues",
  },
  if_it_could_talk: {
    name: "If It Could Talk", headline: "Give it a voice.",
    short: "Become the secret word. Start with I or my.",
    instruction: "Speak as the word. Start with I or my.",
    detail: "Give one clue in first person.", next: "Topic voting opens next", reminder: "Speak in first person",
  },
  sell_it: {
    name: "Sell It", headline: "Make your pitch.",
    short: "Start with “You should buy it because…”",
    instruction: "You should buy it because…",
    detail: "Finish with one indirect selling point.", next: "Topic voting opens next", reminder: "One selling point",
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
      ) : rule === "two_truths" ? (
        <>
          <rect x="26" y="46" width="54" height="74" rx="7" transform="rotate(-15 50 80)" fill="#a5b79b" />
          <rect x="121" y="44" width="54" height="74" rx="7" transform="rotate(15 145 80)" fill="#a5b79b" />
          <rect x="72" y="34" width="56" height="86" rx="8" fill="#d98672" />
          <path d="m40 83 8 8 15-23m75 18 8 8 12-20m-68-13q10-17 22-3c9 12-11 16-11 28m0 13v2" fill="none" stroke="#26342c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : rule === "sell_it" ? (
        <>
          <path d="M26 47h100l37 31-37 31H26q-8 0-8-8V55q0-8 8-8Z" fill="#26342c" transform="rotate(-15 90 80)" />
          <path d="M138 62c16-25 47-45 51-20 3 18-20 23-51 20Z" fill="none" stroke="#a5b79b" strokeWidth="6" />
          <circle cx="139" cy="62" r="5" fill="#f4f1e8" />
        </>
      ) : rule === "act_it" ? (
        <>
          <circle cx="101" cy="55" r="25" fill="#a5b79b" />
          <path d="M49 32c-13 14-20 37-7 58l24 25m85-87c15 16 19 40 7 59l-25 28" fill="none" stroke="#a5b79b" strokeWidth="19" strokeLinecap="round" />
          <path d="M58 139c0-37 13-53 43-53s42 16 42 53Z" fill="#26342c" />
        </>
      ) : rule === "if_it_could_talk" ? (
        <>
          <rect x="22" y="48" width="95" height="83" rx="10" fill="#26342c" transform="rotate(-13 69 91)" />
          <path d="M43 91q27-30 54 0-25 30-54 0Z" fill="#f4f1e8" />
          <circle cx="70" cy="91" r="10" fill="#26342c" />
          <path d="M97 51c0-23 20-35 45-35s44 13 44 35-18 37-44 37h-8l-22 16 6-21C104 77 97 67 97 51Z" fill="#a5b79b" />
          <path d="m120 42 13 7m-14 11 15-3m9 12 12 4" fill="none" stroke="#26342c" strokeWidth="5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path
            d="M22 20h82q28 0 28 26v32q0 25-28 25H64l-35 24 7-25Q12 97 12 78V45q0-25 10-25Z"
            fill="#a5b79b"
          />
          <path d="m47 50 36-12M46 63h41M47 77l36 12" fill="none" stroke="#26342c" strokeWidth="7" strokeLinecap="round" />
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

export function RuleReveal({ rule, reveal }: { rule: RoundRule; reveal?: RoundRevealStage | null }) {
  const reduced = useReducedMotion();
  const copy = ROUND_RULES[rule];
  if (reveal?.stage === "shuffle" && !reduced) return (
    <div className="rule-shuffle center-stage">
      <h1>Choosing this round’s rule.</h1>
      <motion.img src="/art/secret-cards.png" alt="" animate={{ rotate: [-7, 5, -3] }} transition={{ duration: 1.25 }} />
      <p className="muted">Everyone gets the same rule.</p>
    </div>
  );
  return (
    <>
      <div className="rule-reveal-heading">
        <h1>{copy.headline}</h1>
        <p className="muted">The rule for everyone this round.</p>
      </div>
      <motion.div
        className="round-rule-card"
        initial={reduced || !reveal?.shuffled || reveal.remaining_ms < 2450 ? false : { transformPerspective: 850, rotateY: -75, opacity: 0 }}
        animate={{ opacity: 1, rotateY: 0 }}
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
      <div className="rule-reveal-next center">
        <strong>Topic voting opens next</strong>
        {!reduced && reveal && <div className="rule-countdown" aria-hidden="true"><motion.span key={reveal.stage} initial={{ scaleX: reveal.remaining_ms / reveal.total_ms }} animate={{ scaleX: 0 }} transition={{ duration: reveal.remaining_ms / 1000, ease: "linear" }} /></div>}
      </div>
    </>
  );
}

export function RandomRulesSwitch({ checked, disabled, toggle }: { checked: boolean; disabled?: boolean; toggle: () => void }) {
  return <div className="round-settings-toggle kickoff-toggle">
    <strong>Random rules</strong>
    <button type="button" className="rule-switch" role="switch" aria-label="Random rules" aria-checked={checked} disabled={disabled} onClick={toggle} />
  </div>;
}
