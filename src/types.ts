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
export type RoundRule = "classic" | "act_it" | "sound_only";

export interface PerformedClue {
  player_id: string;
  turn: number;
}

export interface View {
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
    reading_streak: number;
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
  private_role: { imposter: boolean; clue: string; definition?: string } | null;
  role_ready: boolean;
  ready_count: number;
  starting_id: string | null;
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
    report_penalty: number;
    report_round: number | null;
    score: {
      before: number;
      base: number;
      bet: number;
      streak: number;
      bluff: number;
      penalty: number;
      after: number;
    };
    imposter_bonus: number;
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
