import { motion, useReducedMotion } from "motion/react";
import { Icon } from "./icons";
import { MOTION } from "./motion";
import type { RoundRevealStage, RoundRule } from "./types";
import { CardBacks, Stamp, Type, appArt } from "./theme";

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
  // Engraved rule illustrations (app art A5), one per round rule.
  return (
    <img
      className="rule-art"
      src={appArt(`a5-rule-${rule.replace(/_/g, "-")}`)}
      alt=""
      draggable={false}
      decoding="async"
    />
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
      <motion.div className="shuffle-backs" animate={{ rotate: [-7, 5, -3] }} transition={{ duration: 1.25 }}><CardBacks /></motion.div>
      <Type className="shuffle-note">Everyone gets the same rule</Type>
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
        <Type className="rule-card-label">This round</Type>
        <Stamp className="rule-card-stamp">In effect</Stamp>
        <div className="rule-art-frame"><RuleArt rule={rule} /></div>
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
