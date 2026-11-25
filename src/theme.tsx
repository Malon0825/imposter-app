// The noir case-file theme (design/app-revamp-v1): small pieces layered on the
// approved system. Typewriter labels, rubber stamps, kraft paper, mugshots and
// engraved art appear only where they carry meaning; buttons and body text
// stay as they are.
import { useEffect, useRef, type ReactNode } from "react";
import { centre, ring, shake } from "./cards/fx";
import { motion, useReducedMotion } from "motion/react";

/** App art from design/app-revamp-v1/art, converted by scripts/prepare-art.py. */
export const appArt = (name: string) => `/art/app/${name}.webp`;
/** Card art by id (and the shared back), at full or hand size. */
export const cardArt = (id: string, small = false) =>
  `/art/cards/${id}${small ? "-sm" : ""}.webp`;

/** Typewriter label: case numbers, field names, side notes. Never body copy. */
export function Type({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`type ${className}`}>{children}</span>;
}

/**
 * A rubber stamp. `slam` drops it in from 3x with a little overshoot, the
 * same beat the results stamps use; reduced motion shows it at rest.
 */
export function Stamp({
  children,
  tone = "red",
  slam = false,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  tone?: "red" | "lime" | "ink";
  slam?: boolean;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const animate = slam && !reduced;
  const ref = useRef<HTMLSpanElement>(null);
  // On landing, the paper jolts and an ink ring spreads from the stamp.
  useEffect(() => {
    if (!animate) return;
    const t = window.setTimeout(() => {
      const el = ref.current;
      if (!el?.isConnected) return;
      shake(el.parentElement, 3, 220);
      const [x, y] = centre(el);
      ring(x, y, tone === "lime" ? "rgba(214,245,107,.7)" : tone === "ink" ? "rgba(244,241,232,.5)" : "rgba(196,80,58,.8)", 120, 420);
    }, delay * 1000 + 230);
    return () => window.clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <motion.span
      ref={ref}
      className={`stamp ${tone} ${className}`}
      initial={animate ? { scale: 3, opacity: 0, rotate: -34 } : false}
      animate={{ scale: 1, opacity: 0.92, rotate: 0 }}
      transition={
        animate
          ? { delay, duration: 0.24, ease: [0.55, 0, 1, 0.45] }
          : { duration: 0 }
      }
    >
      {children}
    </motion.span>
  );
}

/** An engraved illustration from the app art set. Decorative by default. */
export function Art({
  name,
  className = "",
  alt = "",
}: {
  name: string;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      className={`app-art ${className}`}
      src={appArt(name)}
      alt={alt}
      draggable={false}
      decoding="async"
    />
  );
}

/** The engraved card back, fanned. Replaces the old paper cards. */
export function CardBacks({
  count = 3,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  const spread = count === 1 ? [0] : count === 2 ? [-8, 8] : [-14, 0, 14];
  return (
    <div className={`card-backs n${count} ${className}`} aria-hidden="true">
      {spread.map((angle, i) => (
        <img
          key={i}
          src={cardArt("card-back", true)}
          alt=""
          draggable={false}
          style={{ ["--angle" as string]: `${angle}deg` }}
        />
      ))}
    </div>
  );
}

/** Booking photo: the player's initials against a height chart, name on a board. */
export function BookingPhoto({
  initials,
  label,
}: {
  initials: string;
  label: string;
}) {
  return (
    <div className="booking" aria-hidden="true">
      <div className="booking-marks">
        <span>6'</span>
        <span>5'</span>
        <span>4'</span>
        <span>3'</span>
      </div>
      <span className="booking-face">{initials || "?"}</span>
      <span className="nameplate type">{label}</span>
    </div>
  );
}

/** A mugshot frame around an avatar, with a typed caption board. */
export function Mugshot({
  children,
  caption,
}: {
  children: ReactNode;
  caption: string;
}) {
  return (
    <figure className="mugshot">
      <div className="mugshot-frame">{children}</div>
      <figcaption className="type">{caption}</figcaption>
    </figure>
  );
}

// Topic pack ids (content/topics.json) to their engraved emblem (app art A6).
const TOPIC_ART: Record<string, string> = {
  chaos: "everyday-chaos",
  space: "space-science",
  memory: "psychology",
  social: "social-behavior",
  dating: "relationships",
  puberty: "body-puberty",
  health: "sex-education",
};

/** A topic pack's engraved emblem. Keeps the `topic-art` sizing of the old icons. */
export function TopicEmblem({ id, className = "" }: { id: string; className?: string }) {
  return (
    <img
      className={`topic-art topic-emblem ${className}`}
      src={appArt(`a6-topic-${TOPIC_ART[id] ?? id}`)}
      alt=""
      draggable={false}
      decoding="async"
    />
  );
}
