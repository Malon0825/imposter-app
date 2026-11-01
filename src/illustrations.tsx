import { Icon } from "./icons";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MOTION, usePageVisible } from "./motion";

export function Rays({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`rays ${className}`}
      viewBox="0 0 72 35"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M36 19V3M20 25 9 13M52 25l11-12" />
    </svg>
  );
}
export function ConnectionIllustration({
  broken = false,
}: {
  broken?: boolean;
}) {
  return (
    <svg
      className={`connection-illustration ${broken ? "broken" : ""}`}
      viewBox={broken ? "0 0 320 170" : "0 0 320 140"}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {broken ? (
        <>
          <g stroke="var(--muted)" strokeWidth="4">
            <rect x="30" y="15" width="72" height="138" rx="11" />
            <rect x="218" y="15" width="72" height="138" rx="11" />
            <path d="M59 24h15m173 0h15" strokeWidth="2" />
          </g>
          <g fill="var(--ink)">
            <path d="M41 89Q53 66 66 89Q53 111 41 89m25 0Q79 66 92 89Q79 111 66 89" />
            <ellipse cx="56" cy="89" rx="5" ry="9" fill="var(--bg)" />
            <ellipse cx="78" cy="89" rx="5" ry="9" fill="var(--bg)" />
          </g>
          <g stroke="var(--ink)" strokeWidth="5">
            <path d="M234 83q20-20 40 0m-32 8q12-12 24 0m-16 8q4-4 8 0" />
            <path d="M254 108h.1" />
          </g>
          <g stroke="var(--terra)" strokeWidth="4">
            <path d="M116 96h20m48 0h20" strokeDasharray="5 9" />
            <path d="m153 89 14 14m0-14-14 14m0-28-5-9m14 7V61m10 14 5-9" />
          </g>
        </>
      ) : (
        <>
          <g stroke="var(--muted)" strokeWidth="3.5">
            <rect x="16" y="44" width="48" height="82" rx="7" />
            <rect x="136" y="44" width="48" height="82" rx="7" />
            <rect x="256" y="44" width="48" height="82" rx="7" />
            <path
              d="M33 51h14m106 0h14m106 0h14M35 119h10m110 0h10m110 0h10"
              strokeWidth="2"
            />
          </g>
          <g stroke="var(--lime)" strokeWidth="2.5">
            <path d="M74 87q26-17 52 0m68 0q26-17 52 0" strokeDasharray="5 8" />
            <path d="M40 27V15m-10 16-7-9m27 9 7-9M160 27V15m-10 16-7-9m27 9 7-9M280 27V15m-10 16-7-9m27 9 7-9" />
          </g>
        </>
      )}
    </svg>
  );
}
export function PawStamp() {
  return (
    <div className="paw-stamp" aria-hidden="true">
      <svg
        viewBox="0 0 200 150"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
      >
        <path d="m22 104-15-8m17 24-15 8m169-24 15-8m-17 24 15 8" />
      </svg>
      <Icon name="paw" size={140} />
    </div>
  );
}
export function DareArrow() {
  return (
    <svg
      className="dare-arrow"
      viewBox="0 0 90 50"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 35Q40 8 78 30" strokeDasharray="6 6" />
      <path d="m73 19 7 13-15 4" />
    </svg>
  );
}
export function Confetti() {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const played = useRef(false);
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    if (reduced || !visible) {
      setBurst(false);
      return;
    }
    if (played.current) return;
    const start = window.setTimeout(() => {
      played.current = true;
      setBurst(true);
    }, 0);
    const end = window.setTimeout(() => setBurst(false), 1400);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
    };
  }, [reduced, visible]);
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <motion.i
          key={i}
          initial={reduced ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? 0 : 0.5,
            delay: reduced ? 0 : (i % 6) * 0.025,
            ease: MOTION.easeOut,
          }}
          style={{
            left: `${[5, 22, 43, 66, 89, 12, 94, 94, 7, 90, 22, 72, 5, 96, 34, 60][i]}%`,
            top: `${[3, 1, 5, 2, 4, 13, 12, 18, 73, 75, 80, 83, 37, 42, 4, 77][i]}%`,
            rotate: `${i * 37 + 12}deg`,
          }}
        />
      ))}
      {burst && (
        <div className="confetti-burst">
          {Array.from({ length: 12 }, (_, i) => (
            <motion.i
              key={i}
              style={{ left: i % 2 ? "100%" : "0%", top: "45%" }}
              initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
              animate={{
                x: (i % 2 ? -1 : 1) * (35 + (i % 4) * 17),
                y: -80 + (i % 6) * 35,
                opacity: [0, 1, 1, 0],
                rotate: (i % 2 ? -1 : 1) * (140 + i * 13),
              }}
              transition={{
                duration: MOTION.celebration,
                delay: i * 0.015,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TopicArt({ name }: { name: string }) {
  const common = {
    viewBox: "0 0 80 80",
    className: `topic-art topic-art-${name}`,
    "aria-hidden": true as const,
  };
  if (name === "cup")
    return (
      <svg {...common}>
        <path d="M18 24h39l-3 36q-1 10-17 10T21 60Z" fill="#f1ecda" />
        <path
          d="M56 30h6q16 0 10 18-4 9-18 8"
          fill="none"
          stroke="#f1ecda"
          strokeWidth="7"
        />
        <ellipse cx="37" cy="24" rx="20" ry="7" fill="#f7f1de" />
        <ellipse cx="37" cy="24" rx="16" ry="4.5" fill="#2c251d" />
      </svg>
    );
  if (name === "pizza")
    return (
      <svg {...common}>
        <path d="M13 68 39 12q26 8 32 43L13 68Z" fill="#e5b765" />
        <path d="M39 12q26 8 32 43l-9 3Q58 31 35 20Z" fill="#c48e60" />
        <g fill="#cb7257">
          <circle cx="40" cy="36" r="7" />
          <circle cx="31" cy="54" r="6" />
          <circle cx="54" cy="52" r="6" />
        </g>
        <path d="m24 61 3-6m25-15 4 1" stroke="#f6d07d" strokeWidth="3" />
      </svg>
    );
  if (name === "paw")
    return (
      <span className="topic-art topic-art-paw">
        <Icon name="paw" size={64} />
      </span>
    );
  if (name === "brain")
    return (
      <svg {...common}>
        <path
          d="M38 12C25 4 15 14 17 23 5 24 6 41 13 44 6 57 19 65 27 61c1 9 10 11 11 5Zm5 0C56 4 66 14 64 23c12 1 11 18 4 21 7 13-6 21-14 17-1 9-10 11-11 5Z"
          fill="#8fac91"
        />
        <g fill="none" stroke="#395643" strokeWidth="3" strokeLinecap="round">
          <path d="M38 18v49m5-49v49M24 20q7 3 2 12m-10 0q12 3 8 13m-7 8q9-5 13 3m8-16-8-4m26-16q-7 3-2 12m10 0q-12 3-8 13m7 8q-9-5-13 3m-7-16 8-4" />
        </g>
      </svg>
    );
  if (name === "education")
    return (
      <svg {...common} fill="none" strokeWidth="5" strokeLinecap="round">
        <g stroke="#7c99cd">
          <circle cx="28" cy="33" r="16" />
          <path d="M28 49v23m-9-9h18" />
        </g>
        <g stroke="#b7799f">
          <circle cx="48" cy="31" r="16" />
          <path d="m59 19 12-12M60 7h12v12" />
        </g>
      </svg>
    );
  if (name === "heart")
    return (
      <svg {...common}>
        <path
          d="M40 69C23 56 8 44 10 29 13 11 33 12 40 25 48 10 68 13 71 28 75 43 56 57 40 69Z"
          fill="#d47c65"
        />
        <path
          d="M17 29q1-8 10-9"
          fill="none"
          stroke="#e8a18b"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    );
  return (
    <span className={`topic-art topic-art-${name}`}>
      <Icon name={name} size={60} />
    </span>
  );
}
