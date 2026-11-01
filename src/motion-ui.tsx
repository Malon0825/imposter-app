import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useIsPresent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { MOTION, screenVariants, type ScreenMotion } from "./motion";

export function ScreenTransition({
  children,
  className,
  direction,
  kind,
}: {
  children: ReactNode;
  className: string;
  direction: number;
  kind: ScreenMotion;
}) {
  const reduced = useReducedMotion();
  const present = useIsPresent();
  const variants = useMemo(
    () => screenVariants(kind, !!reduced),
    [kind, reduced],
  );
  return (
    <motion.main
      className={className}
      custom={direction}
      variants={variants}
      initial={reduced ? false : "enter"}
      animate="rest"
      exit="exit"
      inert={!present}
      aria-hidden={!present}
      style={{ pointerEvents: present ? "auto" : "none" }}
    >
      {children}
    </motion.main>
  );
}

export function ExpandSection({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          className="expand-section"
          initial={reduced ? false : { height: 0, opacity: 0 }}
          animate={{
            height: "auto",
            opacity: 1,
            transitionEnd: { overflow: "visible" },
          }}
          exit={{ height: 0, opacity: 0, overflow: "hidden" }}
          style={{ overflow: "hidden" }}
          transition={{ duration: reduced ? 0 : 0.2, ease: MOTION.easeOut }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CheckStroke({
  size = 24,
  delay = 0,
}: {
  size?: number;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d="m5 12 4 4L19 6"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: reduced ? 0 : MOTION.check,
          delay: reduced ? 0 : delay,
          ease: MOTION.easeOut,
        }}
      />
    </svg>
  );
}

export function SelectionCheck({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      className="selection-mark"
      initial={reduced ? false : { scale: 0.65, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={reduced ? { duration: 0 } : MOTION.select}
    >
      {children}
    </motion.span>
  );
}

export function ScoreValue({
  value,
  from = value,
}: {
  value: number;
  from?: number;
}) {
  const reduced = useReducedMotion();
  const count = useMotionValue(reduced ? value : from);
  const rounded = useTransform(count, (v) => Math.round(v));
  useEffect(() => {
    if (reduced) {
      count.set(value);
      return;
    }
    const controls = animate(count, value, {
      duration: MOTION.score,
      ease: MOTION.easeOut,
    });
    return () => controls.stop();
  }, [value, reduced, count]);
  return (
    <motion.strong aria-label={`${value} points`}>{rounded}</motion.strong>
  );
}

export function ProgressDots({
  count,
  filled,
  linked = false,
}: {
  count: number;
  filled: number;
  linked?: boolean;
}) {
  const reduced = useReducedMotion();
  const size = count > 8 ? 14 : count > 5 ? 20 : 26;
  const gap = count > 8 ? 8 : count > 5 ? 16 : linked ? 40 : 24;
  return (
    <div
      className={`progress-dots motion-progress ${linked ? "is-linked" : ""}`}
      style={
        {
          "--progress-size": `${size}px`,
          "--progress-gap": `${gap}px`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className={i < filled ? "complete" : ""}>
          {i < filled && (
            <motion.span
              className="progress-fill"
              initial={reduced ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={reduced ? { duration: 0 } : MOTION.select}
            />
          )}
        </i>
      ))}
    </div>
  );
}

export function LockedVoteArt() {
  const reduced = useReducedMotion();
  return (
    <div className="envelope" aria-hidden="true">
      <svg
        className="rays envelope-rays"
        viewBox="0 0 72 35"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      >
        <path d="M36 19V3M20 25 9 13M52 25l11-12" />
      </svg>
      <motion.img
        src="/art/vote-envelope.png"
        alt=""
        initial={reduced ? false : { y: 6, rotate: -3 }}
        animate={{ y: 0, rotate: 0 }}
        transition={{ ...MOTION.select, delay: reduced ? 0 : 0.04 }}
      />
      <motion.span
        className="envelope-seal"
        initial={reduced ? false : { scale: 0.72 }}
        animate={{ scale: 1 }}
        transition={
          reduced ? { duration: 0 } : { ...MOTION.select, delay: 0.12 }
        }
      >
        <CheckStroke size={30} delay={0.18} />
      </motion.span>
    </div>
  );
}

export function MotionSheet({
  children,
  labelledBy,
  onDismiss,
  busy = false,
  className = "",
}: {
  children: ReactNode;
  labelledBy: string;
  onDismiss: () => void;
  busy?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const drag = useDragControls();
  const moved = useRef(false);
  const dismiss = () => {
    if (!busy) onDismiss();
  };
  return (
    <motion.div
      className="sheet-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.16 }}
      onClick={dismiss}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`bottom-sheet ${className}`}
        initial={reduced ? { opacity: 0 } : { y: "100%" }}
        animate={{ y: 0, opacity: 1 }}
        exit={
          reduced
            ? { opacity: 0 }
            : { y: "100%", transition: { duration: 0.18, ease: MOTION.easeIn } }
        }
        transition={reduced ? { duration: 0 } : MOTION.sheet}
        drag={busy || reduced ? false : "y"}
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        dragMomentum={false}
        onDrag={(_, info) => {
          if (Math.abs(info.offset.y) > 6) moved.current = true;
        }}
        onDragEnd={(_, info) => {
          if (
            info.offset.y > 85 ||
            (info.offset.y > 20 && info.velocity.y > 500)
          )
            dismiss();
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="sheet-grab"
          aria-label="Close dialog"
          disabled={busy}
          onPointerDown={(event) => {
            moved.current = false;
            if (!busy && !reduced) drag.start(event);
          }}
          onClick={(event) => {
            if (event.detail === 0 || !moved.current) dismiss();
          }}
        >
          <span />
        </button>
        {children}
      </motion.section>
    </motion.div>
  );
}
