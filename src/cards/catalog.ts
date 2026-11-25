// The power card catalog, shared with the Rust engine: one JSON file,
// generated from the rules sheet by scripts/cards-from-sheet.py.
import data from "../../crates/party-core/content/cards.json";
import type { CardTier, CastRole } from "../types";
import { preferences } from "../storage";

export type Rating = "best" | "fine" | "worst" | "cant";
export type CardWindow = "role_reveal" | "discussion" | "ballot" | "results" | "session_end";

export interface CardInfo {
  id: string;
  name: string;
  tier: CardTier;
  kind: "active" | "passive";
  windows: CardWindow[];
  target: "none" | "player" | "two_players" | "played_card";
  cant_play: CastRole[];
  leader_cant_play: boolean;
  needs_bet: boolean;
  hidden_for_last_voter: boolean;
  text: { en: string; fil: string };
  ratings?: Partial<Record<CastRole, Rating>>;
  when?: string;
  notes?: Partial<Record<CastRole, string>>;
}

export const CARDS: CardInfo[] = (data as { cards: CardInfo[] }).cards;
const BY_ID = new Map(CARDS.map((c) => [c.id, c]));
export const card = (id: string): CardInfo | undefined => BY_ID.get(id);

/** Cards that need a choice before they can be played. */
export const needsPlayer = (c: CardInfo) =>
  c.target !== "none" || ["on-the-record", "sealed-alibi", "second-opinion"].includes(c.id);
export const needsTwo = (c: CardInfo) => c.target === "two_players";
export const needsRole = (c: CardInfo) => c.id === "cover-story";

export const WINDOW_LABEL: Record<CardWindow, string> = {
  role_reveal: "Role reveal",
  discussion: "Discussion",
  ballot: "Ballot",
  results: "Passive",
  session_end: "Passive",
};

// ---------------------------------------------------------------- card text language

const TEXT_KEY = "imposter.cardText";
export type CardLanguage = "en" | "fil";
let language: CardLanguage = preferences.getItem(TEXT_KEY) === "fil" ? "fil" : "en";
const listeners = new Set<(l: CardLanguage) => void>();
export const cardLanguage = () => language;
export function setCardLanguage(l: CardLanguage) {
  language = l;
  preferences.setItem(TEXT_KEY, l);
  listeners.forEach((fn) => fn(l));
}
export function onCardLanguage(fn: (l: CardLanguage) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
/** A card's ability in this phone's chosen language. Names stay English. */
export const ability = (c: CardInfo) => (language === "fil" ? c.text.fil : c.text.en);

// ---------------------------------------------------------------- role guidance

export const FIT_LABEL: Record<Rating, string> = {
  best: "Good for you",
  fine: "Fine",
  worst: "Weak for you",
  cant: "Can’t play",
};
/** One line for the evidence tag: your role's note if the card has one, else when to play. */
export const tipFor = (c: CardInfo, role?: CastRole | null) =>
  (role && c.notes?.[role]) || c.when || "";
