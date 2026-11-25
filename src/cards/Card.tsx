// One card component in three sizes (full, hand, chip) and four states
// (playable now, not now, spent, plain). Tier frames are CSS; the art is
// Astra's engraving from public/art/cards.
import type { CSSProperties } from "react";
import { cardArt } from "../theme";
import type { CardTier } from "../types";
import { ability, card as info, WINDOW_LABEL, type CardInfo } from "./catalog";

export type CardSize = "full" | "mid" | "hand" | "chip";
export type CardState = "playable" | "later" | "spent" | "plain";

export function CardFace({
  id,
  size = "full",
  state = "plain",
  width,
}: {
  id: string;
  size?: CardSize;
  state?: CardState;
  width?: number;
}) {
  const c = info(id);
  if (!c) return null;
  const style = width ? ({ "--w": `${width}px` } as CSSProperties) : undefined;
  return (
    <div className={`pc-card ${size} ${c.tier} ${state}`} style={style} role="img" aria-label={`${c.name}, ${c.tier}`}>
      <div className="pc-face">
        <div className="pc-top">
          <span className={`pc-win ${state === "playable" ? "now" : ""}`}>{windowLabel(c)}</span>
          <span className="pc-tier">{c.tier}</span>
        </div>
        <div className="pc-art">
          <img src={cardArt(c.id, size !== "full")} alt="" draggable={false} decoding="async" />
        </div>
        <div className="pc-name">{c.name}</div>
        <div className="pc-fx">{ability(c)}</div>
        <div className="pc-ft">
          <span>{c.kind === "active" ? "Active" : "Passive"}</span>
          <span>{c.tier}</span>
        </div>
      </div>
    </div>
  );
}

function windowLabel(c: CardInfo) {
  return c.windows.map((w) => WINDOW_LABEL[w]).join(" · ");
}

/** The neutral back: identical for every tier, so a back never leaks one. */
export function CardBack({
  size = "full",
  tier,
  width,
}: {
  size?: CardSize;
  /** Only where the tier is already public (announcements, the plays strip). */
  tier?: CardTier;
  width?: number;
}) {
  const style = width ? ({ "--w": `${width}px` } as CSSProperties) : undefined;
  return (
    <div
      className={`pc-card back ${size} ${tier ? `t-${tier}` : ""}`}
      style={{ ...style, backgroundImage: `url(${cardArt("card-back", size !== "full")})` }}
      aria-hidden="true"
    />
  );
}
