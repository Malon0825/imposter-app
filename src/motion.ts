import { useEffect, useState } from "react";
import type { Variants } from "motion/react";

// Durations are seconds; these are the app's shared motion tuning controls.
export const MOTION = {
  easeOut: [0.22, 1, 0.36, 1] as const,
  easeIn: [0.4, 0, 1, 1] as const,
  press: { type: "spring" as const, stiffness: 620, damping: 34, mass: 0.55 },
  select: { type: "spring" as const, stiffness: 440, damping: 29, mass: 0.65 },
  sheet: { type: "spring" as const, stiffness: 420, damping: 38, mass: 1 },
  pageEnter: 0.24,
  pageExit: 0.1,
  turn: 0.16,
  roleReveal: 0.42,
  score: 0.5,
  check: 0.2,
  celebration: 1.05,
  busyDelay: 250,
} as const;

export type ScreenMotion = "page" | "phase" | "turn" | "runoff";
export function screenVariants(kind: ScreenMotion, reduced: boolean): Variants {
  const slide = kind === "page" && !reduced;
  return {
    enter: (direction: number) => ({
      opacity: reduced ? 1 : 0,
      x: slide ? 18 * direction : 0,
      y: kind === "runoff" && !reduced ? 24 : 0,
    }),
    rest: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: reduced
          ? 0
          : kind === "turn"
            ? MOTION.turn
            : MOTION.pageEnter,
        ease: MOTION.easeOut,
      },
    },
    exit: (direction: number) => ({
      opacity: reduced ? 1 : 0,
      x: slide ? -12 * direction : 0,
      y: 0,
      transition: {
        duration: reduced ? 0 : MOTION.pageExit,
        ease: MOTION.easeIn,
      },
    }),
  };
}

export function usePageVisible() {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const update = () => {
      setVisible(!document.hidden);
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return visible;
}

export function useDelayedBusy(busy: boolean) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!busy) {
      setShow(false);
      return;
    }
    const timer = window.setTimeout(() => setShow(true), MOTION.busyDelay);
    return () => window.clearTimeout(timer);
  }, [busy]);
  return busy && show;
}
