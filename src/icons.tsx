import type { CSSProperties } from "react";
const paths: Record<string, string> = {
  back: "m14 5-7 7 7 7M7 12h14",
  chevron: "m9 5 7 7-7 7",
  check: "m5 12 4 4L19 6",
  x: "m6 6 12 12M6 18 18 6",
  wifi: "M3 9a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 15a5 5 0 0 1 6 0M12 19h.01",
  crown: "m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7ZM7 22h10",
  people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8a3 3 0 0 1 0 6M22 21v-2a4 4 0 0 0-3-4",
  lock: "M6 10h12v11H6zM8 10V7a4 4 0 0 1 8 0v3",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  cup: "M5 6h12v9a6 6 0 0 1-12 0V6ZM17 7h2a3 3 0 0 1 0 6h-2M3 22h17",
  glass: "M6 3h12l-2 18H8L6 3ZM7 8h10",
  cards: "m4 6 11-3 5 16-11 3L4 6ZM4 6 2 7l4 15 3-1M10 10l4 4-4 2-2-4 2-2",
  settings:
    "m9 3 6 0 1 4 4 1v7l-4 1-1 5H9l-1-5-5-1V8l5-1 1-4ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  tag: "M3 3h8l10 10-8 8L3 11V3ZM7 7h.01",
  trophy:
    "M7 3h10v9a5 5 0 0 1-10 0V3ZM7 5H3v4a4 4 0 0 0 4 4M17 5h4v4a4 4 0 0 1-4 4M12 17v5M8 22h8",
  health: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z",
  shield: "m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6l9-4ZM8 12l3 3 5-6",
  heart: "M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 3 11 8 15 5-4 13-10 8-15Z",
  brain:
    "M12 4v17M12 5C9 0 4 4 5 8c-6 2-3 9 1 9 0 5 6 5 6 1M12 5c3-5 8-1 7 3 6 2 3 9-1 9 0 5-6 5-6 1M5 8l3 2M19 8l-3 2M6 17l2-3M18 17l-2-3",
  pizza:
    "m3 21 7-18a22 22 0 0 1 11 11L3 21ZM9 6c4 1 7 4 9 8M10 12h.01M13 16h.01M7 17h.01",
  pin: "M12 22s8-8 8-14a8 8 0 1 0-16 0c0 6 8 14 8 14ZM12 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  case: "M3 7h18v14H3zM8 7V3h8v4M3 12h18M12 10v5",
  plane: "m2 15 8-4V3l2-2 2 2v8l8 4v3l-8-2v5l-2 2-2-2v-5l-8 2v-3Z",
  film: "M3 3h18v18H3zM7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4",
  music:
    "M9 18V5l12-2v13M9 9l12-2M5 15a4 3 0 1 0 0 6 4 3 0 0 0 0-6M17 13a4 3 0 1 0 0 6 4 3 0 0 0 0-6",
  ball: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM4 5l15 14M5 20 20 5M2 12h20M12 2v20",
  game: "M7 7h10c4 0 7 13 3 13l-5-4H9l-5 4C0 20 3 7 7 7ZM7 10v5M4.5 12.5h5M16 11h.01M19 14h.01",
  spark: "m12 2 2 7 8 3-8 3-2 7-3-7-7-3 7-3 3-7Z",
  brush: "m14 3 7 7-9 9-7-7 9-9ZM5 12c-4 2-1 5-4 9 6 0 9-2 8-5",
  gift: "M3 8h18v13H3zM1 8h22M12 8v13M12 8C4 8 4 0 8 2l4 6ZM12 8c8 0 8-8 4-6l-4 6Z",
  planet: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM5 7C-5 15 2 22 15 14S27-1 18 5",
  body: "M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM4 10h16M9 10l-2 8h10l-2-8M10 18v5M14 18v5",
  qr: "M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 19h2v2h-2zM21 13v3M13 21v-3M13 11v2h4M19 11h2",
  camera: "M3 7h4l2-3h6l2 3h4v14H3V7ZM12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  flash: "m13 1-9 13h7l-1 9 10-14h-8l1-8",
  copy: "M8 8h13v13H8zM3 16V3h13",
  refresh: "M20 7a9 9 0 1 0 1 9M20 2v6h-6",
  search: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm5.5 13 5 5",
  pause: "M8 4v16M16 4v16",
  play: "m7 3 14 9-14 9V3Z",
  phone: "M6 2h12v20H6zM10 5h4M11 19h2",
  logout: "M10 3H3v18h7M9 12h13M17 7l5 5-5 5",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 10v7M12 6h.01",
};
export function Icon({
  name,
  size = 24,
  className = "",
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  if (name === "glass")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 60"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
      >
        <path d="m8 10 4 40q12 7 24 0l4-40" />
        <ellipse cx="24" cy="10" rx="16" ry="5" />
      </svg>
    );
  if (name === "cards")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
      >
        <rect
          x="8"
          y="8"
          width="30"
          height="43"
          rx="3"
          transform="rotate(-15 23 29.5)"
        />
        <g transform="rotate(12 40 36.5)">
          <rect x="25" y="15" width="30" height="43" rx="3" fill="var(--bg)" />
          <path d="M29 35q11-13 22 0-11 13-22 0Z" />
          <ellipse
            cx="40"
            cy="35"
            rx="3.5"
            ry="5"
            fill="currentColor"
            stroke="none"
          />
        </g>
      </svg>
    );
  if (name === "trophy")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 72"
        fill="currentColor"
        className={className}
        style={style}
        aria-hidden="true"
      >
        <path d="M17 18h30v20c0 10-6 16-13 18v7h11v6H19v-6h11v-7c-7-2-13-8-13-18Z" />
        <path
          d="M17 22H7v11q0 12 15 13M47 22h10v11q0 12-15 13"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          d="M32 9V1M19 12l-6-7m32 7 6-7"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    );
  if (name === "crown")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 28"
        fill="currentColor"
        className={className}
        style={style}
        aria-hidden="true"
      >
        <path d="m3 8 8 6 5-10 5 10 8-6-4 17H7Z" />
        <circle cx="3" cy="7" r="2" />
        <circle cx="16" cy="3" r="2" />
        <circle cx="29" cy="7" r="2" />
      </svg>
    );
  if (name === "paw")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="currentColor"
        className={className}
        style={style}
        aria-hidden="true"
      >
        <ellipse cx="12" cy="20" rx="7" ry="10" transform="rotate(-23 12 20)" />
        <ellipse cx="27" cy="12" rx="7" ry="10" />
        <ellipse cx="43" cy="14" rx="7" ry="10" transform="rotate(15 43 14)" />
        <ellipse cx="55" cy="27" rx="7" ry="10" transform="rotate(28 55 27)" />
        <path d="M32 27c-8 0-12 7-17 13-12 15 0 24 10 19 6-3 9-3 15 0 12 5 23-7 12-18-7-8-11-14-20-14Z" />
      </svg>
    );
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
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d={paths[name] || paths.spark} />
    </svg>
  );
}
