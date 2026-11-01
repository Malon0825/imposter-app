export interface Player {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  left: boolean;
  points: number;
  earned: number;
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
  token: string;
  player_id: string;
  is_host: boolean;
}
export interface View {
  id: string;
  name: string;
  wifi: string;
  phase: string;
  revision: number;
  round_id: number;
  host_id: string;
  my_id: string;
  is_host: boolean;
  paused: boolean;
  pause_reason: string | null;
  topics: string[];
  catalog: Topic[];
  players: Player[];
  private_role: { imposter: boolean; clue: string } | null;
  role_ready: boolean;
  ready_count: number;
  starting_id: string | null;
  vote_count: number;
  my_vote: string | null;
  candidates: string[];
  result: {
    imposter_id: string;
    word: string;
    accused_id: string | null;
    escaped: boolean;
    my_vote: string | null;
    earned: number;
    was_imposter: boolean;
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
export interface DeviceStatus {
  platform: string;
  wifi: boolean;
  wifi_name: string;
  ip: string;
  battery_unrestricted: boolean;
  background_supported: boolean;
}
