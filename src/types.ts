export interface Player {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  left: boolean;
  points: number;
  earned: number;
  report_penalty: number;
  report_round: number | null;
}
export interface Topic {
  id: string;
  name: string;
  icon: string;
  description: string;
  opt_in: boolean;
  count: number;
}
export interface Credentials {
  invitation: string;
  native_invitation?: string;
  token: string;
  player_id: string;
  is_host: boolean;
}
export type RoundRule = "classic" | "act_it" | "sound_only" | "two_truths" | "if_it_could_talk" | "sell_it";

export interface RoundRevealStage {
  stage: "shuffle" | "rule" | "suspense" | "verdict";
  remaining_ms: number;
  total_ms: number;
  shuffled?: boolean;
}

export type RoundOutcome = "correct" | "wrong" | "escaped" | "caught" | "spotted";

export type CastRole = "imposter" | "accomplice" | "detective" | "judge" | "decoy" | "gambler";

export interface CastPicks {
  accomplice: string | null;
  decoy: string | null;
}

export interface RoundVerdict {
  imposter_id: string;
  escaped: boolean;
  tied: boolean;
  /** The viewer's own result; everyone else's opens with the recap. */
  my_outcome?: RoundOutcome | null;
  my_delta?: number | null;
  my_role?: CastRole | null;
}

export interface PerformedClue {
  player_id: string;
  turn: number;
}

export type CardTier = "common" | "rare" | "golden";
export type CardVerdict = "blocked" | "sustained" | "overruled" | "vetoed" | "pierced";

/** Power cards as this phone sees them (see crates/party-core/src/power.rs). */
export interface PlayEffect {
  moved: { player_id: string; points: number }[];
  owner_total: number | null;
  claim: CastRole | null;
  claim_true: boolean | null;
}

export interface StoryPlay {
  round: number;
  player_id: string;
  card: string;
  tier: CardTier;
  real_tier: CardTier;
  pick: string | null;
  cancelled: boolean;
  verdict: CardVerdict | null;
  effect: PlayEffect;
}

export interface CardsView {
  on: boolean;
  active: boolean;
  draw: { remaining_ms: number | null; total_ms: number; decided: string[] } | null;
  drew: string[];
  plays: {
    seq: number;
    player_id: string;
    tier: CardTier;
    /** Results only: */
    card?: string;
    real_tier?: CardTier;
    pick?: string | null;
    cancelled?: boolean;
    verdict?: CardVerdict | null;
    effect?: PlayEffect;
  }[];
  /** Results: what each Underdog got from the Bounty, if it paid. */
  bounty_paid?: number | null;
  /** The next round's leaders, Underdogs and Bounty, from the scores now. */
  standing?: { leaders: string[]; underdogs: string[]; bounty: number | null };
  /** Session complete: every card played this session. */
  story?: { plays: StoryPlay[]; comeback: Record<string, number> } | null;
  stamps: { verdict: CardVerdict; by: string | null; on: string | null; bluff: boolean }[];
  tips: string[];
  claims: { player_id: string; role: CastRole }[];
  on_record: { player_id: string; vote: string }[];
  spotlight: { player_id: string; side: "civilian" | "imposter" }[];
  owed: string[];
  vetoed: number;
  hand_counts: Record<string, number>;
  underdogs: string[];
  leaders: string[];
  bounty: number | null;
  mine: {
    hand: { id: string; playable: boolean; reason: string | null; new: boolean }[];
    golden_chance: number;
    paid_draws_left: number;
    price: number | null;
    decided: boolean;
    played: { seq: number; card: string; cancelled: boolean; verdict: CardVerdict | null; read: unknown } | null;
    wiretap: { player_id: string; vote: string | null } | null;
    cold_feet: boolean;
    rain_check: boolean;
    last_word: { options: string[]; remaining_ms: number } | null;
  };
}

export interface View {
  cards?: CardsView | null;
  reveal?: RoundRevealStage | null;
  verdict?: RoundVerdict | null;
  deal_error?: string | null;
  round_notice?: string | null;
  round_rule?: RoundRule | null;
  random_rules?: boolean | null;
  rule_change_pending?: boolean;
  performed?: PerformedClue[];
  deck_status?: {
    played: number;
    reason: "incompatible" | "played" | "recent" | "hints" | null;
  } | null;
  reconnect_requests?: { id: string; name: string; code: string }[];
  id: string;
  name: string;
  wifi: string;
  phase: string;
  revision: number;
  round_id: number;
  score_session: {
    number: number;
    target: number;
    started: boolean;
    complete: boolean;
    winner_ids: string[];
  };
  betting: {
    eligible: boolean;
    max_stake: number;
    my_stake: number | null;
    original_vote: string | null;
    /** 5 for a Gambler's top tier, otherwise 3. */
    top_payout?: number;
    my_picks?: CastPicks | null;
  };
  clue_turn: number;
  clues: { player_id: string; turn: number; text: string }[];
  host_id: string;
  my_id: string;
  is_host: boolean;
  paused: boolean;
  pause_reason: string | null;
  topics: string[];
  catalog: Topic[];
  topic_vote?: {
    my_topics: string[] | null;
    submitted_ids: string[];
    player_ids: string[];
    available_topics: string[];
    counts: Record<string, number> | null;
    leaders: string[];
    selected_topic: string | null;
  } | null;
  players: Player[];
  private_role: {
    imposter: boolean;
    clue: string;
    definition?: string;
    role?: CastRole;
    imposter_id?: string | null;
    cleared_id?: string | null;
  } | null;
  role_ready: boolean;
  ready_count: number;
  starting_id: string | null;
  /** Discussion only: this round's speaking order, first speaker first. */
  speaking_order?: string[] | null;
  vote_count: number;
  my_vote: string | null;
  candidates: string[];
  result: {
    imposter_id: string;
    word: string;
    definition?: string;
    accused_id: string | null;
    escaped: boolean;
    my_vote: string | null;
    earned: number;
    was_imposter: boolean;
    /** Power cards: the caught Imposter's Last Word was right. */
    last_word?: boolean | null;
    report_penalty: number;
    report_round: number | null;
    score: {
      before: number;
      base: number;
      bet: number;
      bluff: number;
      bonus?: number;
      voided?: boolean;
      /** Power cards: points moved by cards, the Bounty and Robin Hood. */
      cards?: { card: string; from: string; points: number }[];
      penalty: number;
      after: number;
    };
    imposter_bonus: number;
    cast?: {
      roles: Record<string, CastRole>;
      decoy_word: string;
      my_role: CastRole | null;
      bait_decoy: boolean;
      decoy_voted: boolean;
      accomplice_caught: boolean;
      decoy_caught: boolean;
      pair_bonus: boolean;
      judge_tiebreak: boolean;
    } | null;
    outcomes: {
      player_id: string;
      outcome: RoundOutcome | null;
      delta: number | null;
    }[];
  } | null;
  reporting: {
    my_reports: string[] | null;
    submitted_count: number;
    total: number;
    majority: number;
    player_ids: string[];
  } | null;
  punishment: {
    player_id: string;
    giver_id: string | null;
    choice: "drink" | "dare" | null;
    turn: number;
    total: number;
  } | null;
}
export interface SessionData {
  session_id: string;
  credentials: Credentials;
  view: View;
}
export interface RecoveryData {
  status: "pending" | "approved";
  code?: string;
  session?: SessionData;
}
export interface DeviceStatus {
  platform: string;
  wifi: boolean;
  wifi_name: string;
  ip: string;
  battery_unrestricted: boolean;
  background_supported: boolean;
  invitation?: string;
}
