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
  if (name.startsWith("vote-")) {
    const type = name.slice(5);
    const props = {
      viewBox: "0 0 80 80",
      className: `topic-art topic-art-voting topic-art-${type}`,
      "aria-hidden": true as const,
    };
    if (type === "suitcase") {
      return (
        <svg {...props}>
          <path
            d="M28 22v-6a7 7 0 0 1 7-7h10a7 7 0 0 1 7 7v6"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="5"
          />
          <rect x="5" y="21" width="70" height="45" rx="10" fill="var(--ink)" />
          <path d="M19 21h7v45h-7zm36 0h7v45h-7z" fill="var(--muted)" />
          <path d="m53 19 5 6 7 2 3 17-13 3-4-16 3-5-4-5Z" fill="#b9785b" />
        </svg>
      );
    }
    if (type === "football") {
      return (
        <svg {...props}>
          <circle cx="40" cy="40" r="34" fill="var(--ink)" />
          <path
            d="m40 26 14 10-5 16H31l-5-16zM31 7h18l5 7-14 12-14-12Zm39 17 4 14-5 13-15-15ZM61 67l-14 7H33l-12-7 10-15h18ZM9 24l17 12-15 15-5-13Z"
            fill="var(--muted)"
            stroke="#778b76"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    if (type === "cup")
      return (
        <svg {...props}>
          <g fill="none" stroke="#d79b7e" strokeWidth="3" strokeLinecap="round">
            <path d="M25 22c-8-6 8-11 2-18M40 22c-8-6 8-11 2-18M55 22c-8-6 8-11 2-18" />
          </g>
          <path d="M15 29h43v33q0 11-21 11T15 62Z" fill="#f1ecda" />
          <path
            d="M58 35h6q16 0 10 17-4 8-16 7"
            fill="none"
            stroke="#f1ecda"
            strokeWidth="7"
          />
        </svg>
      );
    if (type === "pizza-card")
      return (
        <svg {...props}>
          <path
            d="M6 75Q2 78 4 71L20 12Q20 4 29 5Q65 4 79 29Q82 35 75 39L9 76Z"
            fill="#e9b45b"
          />
          <path
            d="M20 12Q19 4 29 5Q64 4 79 29Q82 35 75 39Q57 17 20 19Z"
            fill="#cd9467"
          />
          <g fill="#cf795f">
            <circle cx="22" cy="43" r="9" />
            <circle cx="48" cy="33" r="9" />
            <circle cx="34" cy="52" r="8" />
          </g>
          <g fill="#4b5241">
            <ellipse
              cx="29"
              cy="24"
              rx="2"
              ry="3"
              transform="rotate(25 29 24)"
            />
            <ellipse
              cx="48"
              cy="48"
              rx="2"
              ry="3"
              transform="rotate(25 48 48)"
            />
            <ellipse
              cx="14"
              cy="63"
              rx="2"
              ry="3"
              transform="rotate(25 14 63)"
            />
          </g>
        </svg>
      );
    if (type === "pizza")
      return (
        <svg {...props}>
          <path d="M9 72 34 7q28 6 40 42Z" fill="#e9b45b" />
          <path d="M34 7q28 6 40 42l-8 4Q55 27 30 16Z" fill="#cd9467" />
          <g fill="#cf795f">
            <circle cx="39" cy="30" r="8" />
            <circle cx="29" cy="49" r="7" />
            <circle cx="54" cy="47" r="7" />
          </g>
          <g className="pizza-olive" fill="#4b5241">
            <ellipse
              cx="31"
              cy="29"
              rx="2"
              ry="3"
              transform="rotate(25 31 29)"
            />
            <ellipse
              cx="47"
              cy="48"
              rx="2"
              ry="3"
              transform="rotate(25 47 48)"
            />
            <ellipse
              cx="22"
              cy="59"
              rx="2"
              ry="3"
              transform="rotate(25 22 59)"
            />
          </g>
        </svg>
      );
    if (type === "paw")
      return (
        <svg {...props} fill="#bd8a65">
          <ellipse
            cx="16"
            cy="31"
            rx="8"
            ry="12"
            transform="rotate(-20 16 31)"
          />
          <ellipse
            cx="32"
            cy="19"
            rx="8"
            ry="12"
            transform="rotate(-8 32 19)"
          />
          <ellipse
            cx="50"
            cy="20"
            rx="8"
            ry="12"
            transform="rotate(13 50 20)"
          />
          <ellipse
            cx="65"
            cy="34"
            rx="8"
            ry="12"
            transform="rotate(25 65 34)"
          />
          <path d="M18 63c-6-8 5-17 11-23 6-8 16-9 23 0 5 6 18 17 13 25-5 10-17 2-23 2-9-1-18 6-24-4Z" />
        </svg>
      );
    if (type === "film")
      return (
        <svg {...props}>
          <rect x="11" y="32" width="59" height="39" rx="4" fill="#a8b9a2" />
          <path d="m10 26 55-15 4 12-55 15Z" fill="#a8b9a2" />
          <path
            d="m17 24 8-2 11 10-9 2Zm22-6 9-2 10 10-9 2ZM15 35h11l8 11H23Zm23 0h11l8 11H46Zm23 0h9v11Z"
            fill="#f1ecda"
          />
        </svg>
      );
    if (type === "music")
      return (
        <svg {...props} fill="#a8b9a2">
          <path d="M30 20 69 10v43h-6V24l-27 7v31h-6Z" />
          <ellipse
            cx="22"
            cy="64"
            rx="13"
            ry="9"
            transform="rotate(-25 22 64)"
          />
          <ellipse
            cx="56"
            cy="55"
            rx="13"
            ry="9"
            transform="rotate(-25 56 55)"
          />
        </svg>
      );
    return <TopicArt name={type} />;
  }
  const common = {
    viewBox: "0 0 80 80",
    className: `topic-art topic-art-${name}`,
    "aria-hidden": true as const,
  };
  if (name === "nature")
    return (
      <svg {...common} fill="#a2bca5">
        <path d="M20 70 55 12l3 2-35 58Z" />
        <path d="M38 43C15 41 12 24 15 10c19 7 28 17 23 33ZM40 38C39 19 54 8 69 7c-1 19-9 30-29 31ZM30 61C9 63 6 49 7 39c18 2 27 8 23 22ZM34 55c7-19 23-20 36-15-8 16-20 22-36 15Z" />
      </svg>
    );
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
