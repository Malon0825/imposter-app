// One card component in three sizes (full, hand, chip) and four states
// (playable now, not now, spent, plain). Tier frames are CSS; the art is
// Astra's engraving from public/art/cards.
import type { CSSProperties } from "react";
import { cardArt } from "../theme";
import { Type } from "../theme";
import type { CardTier, CastRole } from "../types";
import { ability, card as info, FIT_LABEL, tipFor, WINDOW_LABEL, type CardInfo, type CardLanguage, type Rating } from "./catalog";

export type CardSize = "full" | "mid" | "hand" | "chip";
export type CardState = "playable" | "later" | "spent" | "plain";

export function CardFace({
  id,
  size = "full",
  state = "plain",
  width,
  lang,
}: {
  id: string;
  size?: CardSize;
  state?: CardState;
  width?: number;
  /** Force the ability text's language (the detail view shows English on the card). */
  lang?: CardLanguage;
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
        <div className="pc-fx">{lang ? c.text[lang] : ability(c)}</div>
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

const ROLES: CastRole[] = ["imposter", "accomplice", "detective", "judge", "decoy", "gambler"];
const ROLE_NAME: Record<CastRole, string> = { imposter: "Imposter", accomplice: "Accomplice", detective: "Detective", judge: "Judge", decoy: "Decoy", gambler: "Gambler" };

export function fitOf(c: CardInfo, role?: CastRole | null): Rating | null {
  if (!role || c.kind === "passive") return null;
  return c.ratings?.[role] ?? null;
}

/**
 * A card read up close: the face in English, the same ability in Filipino
 * underneath (so it is never shown twice in one language), your role's tip
 * and the six-role strip. The hand and the ballot both open it.
 */
export function CardDetailBody({ info, role, playable }: { info: CardInfo; role: CastRole | null; playable?: boolean }) {
  const fit = fitOf(info, role);
  return (
    <>
      <div className="pc-detail-card">
        <CardFace id={info.id} width={210} state={playable ? "playable" : "plain"} lang="en" />
      </div>
      <div className="pc-detail-fil" lang="fil">
        <Type>Sa Filipino</Type>
        <p className="pc-detail-fx">{info.text.fil}</p>
      </div>
      {info.kind === "active" && (
        <div className="tag pc-tag">
          {role && <Type>As the {ROLE_NAME[role]}{fit ? ` · ${FIT_LABEL[fit]}` : ""}</Type>}
          <span>{tipFor(info, role)}</span>
        </div>
      )}
      {info.ratings && (
        <ul className="pc-roles" aria-label="Who it suits">
          {ROLES.map((r) => (
            <li key={r} className={`${info.ratings![r]} ${r === role ? "you" : ""}`}>
              <img src={`/art/full-cast/${r}.webp`} alt="" />
              <span>{ROLE_NAME[r]}</span>
              <b>{info.ratings![r] === "cant" ? "Can’t" : info.ratings![r]}</b>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
