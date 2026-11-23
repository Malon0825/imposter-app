import { useId, useRef, useState, type PointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PawStamp } from "./illustrations";
import { MOTION } from "./motion";

export function RoleClue({ clue, imposter = false, label }: { clue: string; imposter?: boolean; label?: string }) {
  const size = clue.length > 14 ? "long-word" : clue.length > 5 ? "medium-word" : "";
  return (
    <>
      <p>{label ?? (imposter ? "Your starting hint" : "Your secret word")}</p>
      <strong className={`secret-word ${size}`}>{clue}</strong>
      <PawStamp />
    </>
  );
}

export function RoleMeaning({ word, definition, label }: { word: string; definition: string; label?: string }) {
  const [meaning, setMeaning] = useState(false);
  const swipeStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const panelId = useId();
  const reduced = useReducedMotion();

  function startSwipe(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    swipeStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    if (start?.id !== event.pointerId) return;
    swipeStart.current = null;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (Math.abs(x) < 48 || Math.abs(x) <= 1.4 * Math.abs(y)) return;
    setMeaning(x < 0);
  }

  return (
    <div className="role-meaning">
      <div
        id={panelId}
        className="role-meaning-panel"
        aria-live="polite"
        aria-atomic="true"
        onPointerDown={startSwipe}
        onPointerUp={finishSwipe}
        onLostPointerCapture={() => { swipeStart.current = null; }}
      >
        <motion.div
          className="role-meaning-face"
          key={meaning ? "meaning" : "word"}
          initial={reduced ? false : { x: meaning ? 20 : -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.16, ease: MOTION.easeOut }}
        >
          {meaning ? (
            <>
              <p>{word}</p>
              <div className="role-definition">{definition}</div>
            </>
          ) : (
            <RoleClue clue={word} label={label} />
          )}
        </motion.div>
      </div>
      <button
        type="button"
        className="role-meaning-toggle"
        aria-expanded={meaning}
        aria-controls={panelId}
        onClick={() => setMeaning(!meaning)}
      >
        {meaning ? "Back to word" : "Swipe for meaning"}
      </button>
    </div>
  );
}
