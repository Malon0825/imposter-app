use crate::content;
use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashSet};
use uuid::Uuid;

pub type GameResult<T> = Result<T, String>;
#[derive(Clone, Debug)]
pub struct Player {
    pub id: String,
    pub name: String,
    pub token: String,
    pub ready: bool,
    pub connected: bool,
    pub left: bool,
    pub points: i32,
    pub earned: i32,
}
#[derive(Clone, Debug, Default, Serialize)]
pub struct ScoreBreakdown {
    pub before: i32,
    pub base: i32,
    pub bet: i32,
    pub streak: i32,
    pub bluff: i32,
    pub penalty: i32,
    pub after: i32,
}
#[derive(Clone, Debug, Default)]
pub struct Round {
    pub id: u32,
    pub clue_turn: u32,
    pub clues: BTreeMap<String, BTreeMap<u32, String>>,
    pub roster: Vec<String>,
    pub topic_voters: Vec<String>,
    pub topic_pool: Vec<String>,
    pub topic_ballots: BTreeMap<String, Vec<String>>,
    pub topic_counts: BTreeMap<String, usize>,
    pub topic_leaders: Vec<String>,
    pub topic: Option<String>,
    pub imposter: String,
    pub word: String,
    pub hint: String,
    pub starting: String,
    pub acknowledged: HashSet<String>,
    pub original: BTreeMap<String, String>,
    pub stakes: BTreeMap<String, u32>,
    pub scores: BTreeMap<String, ScoreBreakdown>,
    pub runoff: BTreeMap<String, String>,
    pub candidates: Vec<String>,
    pub accused: Option<String>,
    pub committed: bool,
    pub reports: BTreeMap<String, Vec<String>>,
    pub report_penalties: BTreeMap<String, u32>,
    pub queue: Vec<String>,
    pub turn: usize,
    pub choice: Option<String>,
    pub giver: Option<String>,
}
#[derive(Clone, Debug)]
pub struct Game {
    pub id: String,
    pub name: String,
    pub wifi: String,
    pub host: String,
    pub phase: String,
    pub revision: u64,
    pub players: Vec<Player>,
    pub topics: Vec<String>,
    pub round: Round,
    pub paused: bool,
    pub pause_reason: Option<String>,
    pub used: HashSet<String>,
    pub session_number: u32,
    pub target_score: i32,
    pub session_started: bool,
    pub session_winners: Vec<String>,
    reading_streaks: BTreeMap<String, u32>,
    pending_reports: BTreeMap<String, u32>,
    // Party-only selection history, deliberately excluded from per-player views.
    imposter_turns: BTreeMap<String, u64>,
    last_imposter: Option<String>,
    processed: HashSet<String>,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Action {
    pub id: String,
    pub round_id: u32,
    pub kind: String,
    #[serde(default)]
    pub value: Value,
}
pub fn clean_name(s: &str) -> GameResult<String> {
    let s = s.trim();
    if s.is_empty() || s.chars().count() > 28 || s.chars().any(char::is_control) {
        return Err("Use a name between 1 and 28 characters.".into());
    }
    Ok(s.into())
}
impl Game {
    pub fn new(name: &str, host_name: &str, wifi: &str) -> GameResult<Self> {
        let host = Player {
            id: Uuid::new_v4().to_string(),
            name: clean_name(host_name)?,
            token: Uuid::new_v4().to_string(),
            ready: true,
            connected: true,
            left: false,
            points: 0,
            earned: 0,
        };
        Ok(Self {
            id: Uuid::new_v4().to_string(),
            name: clean_name(name)?,
            wifi: clean_name(wifi)?,
            host: host.id.clone(),
            phase: "lobby".into(),
            revision: 1,
            players: vec![host],
            topics: content::topics()
                .into_iter()
                .filter(|t| !t.opt_in)
                .map(|t| t.id)
                .collect(),
            round: Round::default(),
            paused: false,
            pause_reason: None,
            used: HashSet::new(),
            session_number: 1,
            target_score: 15,
            session_started: false,
            session_winners: vec![],
            reading_streaks: BTreeMap::new(),
            pending_reports: BTreeMap::new(),
            imposter_turns: BTreeMap::new(),
            last_imposter: None,
            processed: HashSet::new(),
        })
    }
    pub fn active(&self) -> Vec<&Player> {
        self.players.iter().filter(|p| !p.left).collect()
    }
    pub fn join(&mut self, name: &str) -> GameResult<Player> {
        if self.phase != "lobby" {
            return Err("This round has started. Join when the host returns to the lobby.".into());
        }
        if self.active().len() >= 12 {
            return Err("This party is full (12 players).".into());
        }
        let name = clean_name(name)?;
        if self
            .active()
            .iter()
            .any(|p| p.name.to_lowercase() == name.to_lowercase())
        {
            return Err("That name is taken. Try another name.".into());
        }
        let p = Player {
            id: Uuid::new_v4().to_string(),
            name,
            token: Uuid::new_v4().to_string(),
            ready: false,
            connected: true,
            left: false,
            points: 0,
            earned: 0,
        };
        // A late arrival joins the current fairness baseline, rather than being
        // repeatedly selected to catch up on rounds they never played.
        let baseline = self
            .active()
            .iter()
            .map(|p| self.imposter_turns.get(&p.id).copied().unwrap_or(0))
            .min()
            .unwrap_or(0);
        self.imposter_turns.insert(p.id.clone(), baseline);
        self.players.push(p.clone());
        self.revision += 1;
        Ok(p)
    }
    pub fn actor(&self, token: &str) -> GameResult<String> {
        self.players
            .iter()
            .find(|p| p.token == token && !p.left)
            .map(|p| p.id.clone())
            .ok_or_else(|| "Your place is no longer available. Join the party again.".into())
    }
    fn imposter_weights(&self) -> Vec<(&str, f64)> {
        let eligible: Vec<_> = self
            .players
            .iter()
            .filter(|p| !p.left && p.connected && self.round.roster.contains(&p.id))
            .collect();
        let minimum = eligible
            .iter()
            .map(|p| self.imposter_turns.get(&p.id).copied().unwrap_or(0))
            .min()
            .unwrap_or(0);
        eligible
            .into_iter()
            .map(|p| {
                let turns = self.imposter_turns.get(&p.id).copied().unwrap_or(0);
                // One extra turn reduces weight to 1/4; two extra turns to 1/9.
                // Bound the gap so even very long parties retain meaningful odds.
                let gap = turns.saturating_sub(minimum).min(15) as f64;
                let recent = if self.last_imposter.as_deref() == Some(p.id.as_str()) {
                    0.5
                } else {
                    1.0
                };
                (p.id.as_str(), recent / (1.0 + gap).powi(2))
            })
            .collect()
    }
    fn choose_imposter(&self, rng: &mut impl rand::Rng) -> GameResult<String> {
        self.imposter_weights()
            .choose_weighted(rng, |(_, weight)| *weight)
            .map(|(id, _)| (*id).to_owned())
            .map_err(|_| "No connected players are available for this round.".into())
    }
    fn record_imposter(&mut self, id: &str) {
        let turns = self.imposter_turns.entry(id.into()).or_default();
        *turns = turns.saturating_add(1);
        self.last_imposter = Some(id.into());
    }
    pub fn connection(&mut self, id: &str, connected: bool) {
        let Some(p) = self.players.iter_mut().find(|p| p.id == id && !p.left) else {
            return;
        };
        if p.connected == connected {
            return;
        }
        p.connected = connected;
        self.revision += 1;
        if ["roles", "discussion", "voting", "runoff"].contains(&self.phase.as_str()) && !connected
        {
            self.paused = true;
            self.pause_reason = Some("A player disconnected. Waiting for them to return.".into());
        }
        if self.pause_reason.as_deref()
            == Some("A player disconnected. Waiting for them to return.")
            && self.active().iter().all(|p| p.connected)
        {
            self.paused = false;
            self.pause_reason = None;
        }
    }
    fn require_host(&self, actor: &str) -> GameResult<()> {
        if actor == self.host {
            Ok(())
        } else {
            Err("Only the host can do that.".into())
        }
    }
    fn require_phase(&self, phases: &[&str]) -> GameResult<()> {
        if phases.contains(&self.phase.as_str()) {
            Ok(())
        } else {
            Err("The party has moved on. Your screen will update.".into())
        }
    }
    pub fn apply(&mut self, actor: &str, action: &Action) -> GameResult<()> {
        if action.id.is_empty() || action.id.len() > 80 {
            return Err("Invalid request identifier.".into());
        }
        if self.processed.contains(&format!("{actor}:{}", action.id)) {
            return Ok(());
        }
        if action.round_id != self.round.id {
            return Err("That action belongs to a different round.".into());
        }
        if !self.active().iter().any(|p| p.id == actor) {
            return Err("You are not in this party.".into());
        }
        if self.paused && !["resume", "abandon", "leave", "end"].contains(&action.kind.as_str()) {
            return Err("The round is paused.".into());
        }
        let value = action.value.as_str().unwrap_or_default();
        match action.kind.as_str() {
            "session_target" => {
                self.require_host(actor)?;
                self.require_phase(&["lobby"])?;
                if self.session_started {
                    return Err("The target is locked for this session.".into());
                }
                let target = action
                    .value
                    .as_i64()
                    .filter(|n| [10, 15, 20, 25, 30].contains(n))
                    .ok_or("Choose a target of 10, 15, 20, 25, or 30 points.")?;
                self.target_score = target as i32;
            }
            "new_session" => {
                self.require_host(actor)?;
                self.require_phase(&["session_complete"])?;
                let next_number = self
                    .session_number
                    .checked_add(1)
                    .ok_or("Create a new party to continue.")?;
                let next_round = self
                    .round
                    .id
                    .checked_add(1)
                    .ok_or("Create a new party to continue.")?;
                self.session_number = next_number;
                self.session_started = false;
                self.session_winners.clear();
                self.reading_streaks.clear();
                self.pending_reports.clear();
                for p in &mut self.players {
                    p.points = 0;
                    p.earned = 0;
                }
                // Invalidate outstanding requests from the completed session,
                // while preserving the party, credentials, and role history.
                self.round = Round {
                    id: next_round,
                    ..Default::default()
                };
                self.to_lobby();
            }
            "ready" => {
                self.require_phase(&["lobby"])?;
                let p = self.players.iter_mut().find(|p| p.id == actor).unwrap();
                p.ready = action.value.as_bool().unwrap_or(true);
            }
            "topics" => {
                self.require_host(actor)?;
                self.require_phase(&["lobby"])?;
                let ids: Vec<String> = serde_json::from_value(action.value.clone())
                    .map_err(|_| "Choose at least one topic.")?;
                let catalog = content::topics();
                if ids.is_empty()
                    || ids.len() > catalog.len()
                    || ids.iter().any(|id| !catalog.iter().any(|t| &t.id == id))
                {
                    return Err("Choose valid topic packs.".into());
                }
                self.topics = ids
                    .into_iter()
                    .collect::<HashSet<_>>()
                    .into_iter()
                    .collect();
                for p in &mut self.players {
                    p.ready = p.id == self.host;
                }
            }
            "remove" => {
                self.require_host(actor)?;
                self.require_phase(&["lobby", "topic_voting", "topic_results", "topic_chosen"])?;
                if value == self.host {
                    return Err("End the party to leave as host.".into());
                }
                let p = self
                    .players
                    .iter_mut()
                    .find(|p| p.id == value)
                    .ok_or("Player not found.")?;
                p.left = true;
                p.connected = false;
                self.remove_topic_voter(value);
            }
            "start" => {
                self.require_host(actor)?;
                self.require_phase(&["lobby"])?;
                let players = self.active();
                if players.len() < 3 {
                    return Err("You need at least 3 players to start.".into());
                }
                if players.iter().any(|p| !p.ready || !p.connected) {
                    return Err("Wait until everyone is connected and ready.".into());
                }
                let roster: Vec<String> = players.iter().map(|p| p.id.clone()).collect();
                if self.topics.is_empty() {
                    return Err("Enable at least one topic first.".into());
                }
                self.round = Round {
                    id: self.round.id + 1,
                    topic_voters: roster.clone(),
                    roster,
                    topic_pool: self.topics.clone(),
                    ..Default::default()
                };
                for p in &mut self.players {
                    p.earned = 0;
                }
                self.phase = "topic_voting".into();
                self.session_started = true;
                self.processed.clear();
            }
            "topic_vote" => {
                self.require_phase(&["topic_voting"])?;
                if !self.round.topic_voters.iter().any(|id| id == actor) {
                    return Err("You are not voting in this round.".into());
                }
                if self.round.topic_ballots.contains_key(actor) {
                    return Err("Your topics are already locked.".into());
                }
                let topics: Vec<String> = serde_json::from_value(action.value.clone())
                    .map_err(|_| "Choose one or more available topics.")?;
                let unique: HashSet<_> = topics.iter().collect();
                if topics.is_empty()
                    || unique.len() != topics.len()
                    || topics.iter().any(|id| !self.round.topic_pool.contains(id))
                {
                    return Err("Choose available topics, once each.".into());
                }
                self.round.topic_ballots.insert(actor.into(), topics);
                self.finish_topic_voting();
            }
            "draw_topic" => {
                self.require_host(actor)?;
                self.require_phase(&["topic_results"])?;
                self.choose_topic(&mut rand::thread_rng());
            }
            "begin_round" => {
                self.require_host(actor)?;
                self.require_phase(&["topic_chosen"])?;
                if self.round.roster.len() < 3 || self.active().iter().any(|p| !p.connected) {
                    return Err(
                        "Wait until everyone is connected, or remove the missing player.".into(),
                    );
                }
                let topic = content::topics()
                    .into_iter()
                    .find(|t| Some(&t.id) == self.round.topic.as_ref())
                    .ok_or("The round needs a chosen topic.")?;
                let mut rng = rand::thread_rng();
                // The current flow still uses Classic. The reviewed selector
                // also provides fail-closed pools for the upcoming rule flow.
                let mut next_used = self.used.clone();
                let pair = topic.draw_word(content::GameMode::Classic, &mut next_used, &mut rng)?;
                let imposter = self.choose_imposter(&mut rng)?;
                let starting = self.round.roster.choose(&mut rng).unwrap().clone();
                self.used = next_used;
                // Charge the turn when cards are dealt, including abandoned
                // rounds. Action deduplication prevents retry double-counting.
                self.record_imposter(&imposter);
                self.round.imposter = imposter;
                self.round.word = pair.word.clone();
                self.round.hint = pair.hint.clone();
                self.round.starting = starting;
                self.round.clue_turn = 1;
                self.phase = "roles".into();
            }
            "role_ready" => {
                self.require_phase(&["roles"])?;
                self.round.acknowledged.insert(actor.into());
                if self.round.acknowledged.len() == self.round.roster.len() {
                    self.phase = "discussion".into();
                }
            }
            "clue" => {
                self.require_phase(&["discussion"])?;
                if !self.round.roster.iter().any(|id| id == actor) {
                    return Err("You did not play in this round.".into());
                }
                let turn = action
                    .value
                    .get("turn")
                    .and_then(Value::as_u64)
                    .filter(|n| *n > 0 && *n <= u64::from(self.round.clue_turn))
                    .ok_or("Choose a clue turn from this round.")?
                    as u32;
                let text = action
                    .value
                    .get("text")
                    .and_then(Value::as_str)
                    .ok_or("Enter a word or short phrase.")?;
                if text.chars().any(char::is_control) || text.trim().chars().count() > 60 {
                    return Err("Use a single-line clue of up to 60 characters.".into());
                }
                let text = text.trim();
                if text.is_empty() {
                    if let Some(clues) = self.round.clues.get_mut(actor) {
                        clues.remove(&turn);
                    }
                    self.round.clues.retain(|_, clues| !clues.is_empty());
                } else {
                    self.round
                        .clues
                        .entry(actor.into())
                        .or_default()
                        .insert(turn, text.into());
                }
            }
            "next_clue_turn" => {
                self.require_host(actor)?;
                self.require_phase(&["discussion"])?;
                if action.value.as_u64() != Some(u64::from(self.round.clue_turn)) {
                    return Err("The clue turn has changed. Your screen will update.".into());
                }
                self.round.clue_turn = self
                    .round
                    .clue_turn
                    .checked_add(1)
                    .ok_or("Start a new round to continue.")?;
            }
            "open_vote" => {
                self.require_host(actor)?;
                self.require_phase(&["discussion"])?;
                self.phase = "voting".into();
            }
            "vote" => {
                self.require_phase(&["voting", "runoff"])?;
                let target = action
                    .value
                    .as_str()
                    .or_else(|| action.value.get("player_id").and_then(Value::as_str))
                    .ok_or("Choose another player.")?;
                let stake = if action.value.is_string() {
                    0
                } else {
                    action
                        .value
                        .get("stake")
                        .and_then(Value::as_u64)
                        .filter(|n| *n <= 3)
                        .ok_or("Bet a whole number from 0 to 3 points.")? as u32
                };
                if !self.round.roster.iter().any(|id| id == actor)
                    || target == actor
                    || !self.round.roster.iter().any(|id| id == target)
                {
                    return Err("Choose another player.".into());
                }
                let is_runoff = self.phase == "runoff";
                if is_runoff && !self.round.candidates.iter().any(|id| id == target) {
                    return Err("Choose one of the tied suspects.".into());
                }
                if is_runoff && stake != 0 {
                    return Err("Your original bet is locked. Runoff does not add a bet.".into());
                }
                if !is_runoff && stake > 0 {
                    if actor == self.round.imposter {
                        return Err("The imposter cannot place a confidence bet.".into());
                    }
                    let balance = self.players.iter().find(|p| p.id == actor).unwrap().points;
                    if stake as i32 > balance {
                        return Err("Your bet cannot exceed your available points.".into());
                    }
                }
                let votes = if is_runoff {
                    &mut self.round.runoff
                } else {
                    &mut self.round.original
                };
                if votes.contains_key(actor) {
                    return Err("Your vote is already locked.".into());
                }
                votes.insert(actor.into(), target.into());
                let all_voted = votes.len() == self.round.roster.len();
                if !is_runoff {
                    self.round.stakes.insert(actor.into(), stake);
                }
                if all_voted {
                    self.resolve(is_runoff);
                }
            }
            "pause" => {
                self.require_host(actor)?;
                self.require_phase(&["roles", "discussion", "voting", "runoff"])?;
                self.paused = true;
                self.pause_reason = Some("The host paused the round.".into());
            }
            "resume" => {
                self.require_host(actor)?;
                if self.active().iter().any(|p| !p.connected) {
                    return Err("Wait for everyone to reconnect, or abandon the round.".into());
                }
                self.paused = false;
                self.pause_reason = None;
            }
            "abandon" => {
                self.require_host(actor)?;
                self.require_phase(&[
                    "topic_voting",
                    "topic_results",
                    "topic_chosen",
                    "roles",
                    "discussion",
                    "voting",
                    "runoff",
                ])?;
                self.to_lobby();
            }
            "open_reports" => {
                self.require_host(actor)?;
                self.require_phase(&["results"])?;
                self.phase = "reporting".into();
            }
            "report" => {
                self.require_phase(&["reporting"])?;
                if !self.round.roster.iter().any(|id| id == actor) {
                    return Err("You did not play in this round.".into());
                }
                if self.round.reports.contains_key(actor) {
                    return Err("Your reports are already locked.".into());
                }
                let targets: Vec<String> = serde_json::from_value(action.value.clone())
                    .map_err(|_| "Choose players to report, or skip.")?;
                let unique: HashSet<_> = targets.iter().collect();
                if unique.len() != targets.len()
                    || targets
                        .iter()
                        .any(|id| id == actor || !self.round.roster.contains(id))
                {
                    return Err("Choose other players from this round, once each.".into());
                }
                self.round.reports.insert(actor.into(), targets);
                if self.round.reports.len() == self.round.roster.len() {
                    self.finish_reports();
                }
            }
            "punish" => {
                self.require_host(actor)?;
                self.require_phase(&["reporting"])?;
                self.finish_reports();
            }
            "choice" => {
                self.require_phase(&["punishment"])?;
                if self.round.queue.get(self.round.turn).map(String::as_str) != Some(actor) {
                    return Err("It is another player's turn.".into());
                }
                if self.round.choice.is_some() {
                    return Err("Your choice is already made.".into());
                }
                if !["drink", "dare"].contains(&value) {
                    return Err("Choose Drink or Dare.".into());
                }
                if value == "dare" {
                    let candidates: Vec<_> = self
                        .active()
                        .iter()
                        .filter(|p| p.id != actor && p.connected)
                        .map(|p| p.id.clone())
                        .collect();
                    self.round.giver = candidates.choose(&mut rand::thread_rng()).cloned();
                    if self.round.giver.is_none() {
                        return Err(
                            "Wait for another player to reconnect, or skip this turn.".into()
                        );
                    }
                }
                self.round.choice = Some(value.into());
            }
            "done" | "skip" => {
                self.require_phase(&["punishment"])?;
                let turn = self
                    .round
                    .queue
                    .get(self.round.turn)
                    .ok_or("No active turn.")?;
                if actor != turn && !(actor == self.host && action.kind == "skip") {
                    return Err("Only the current player can finish their turn.".into());
                }
                if action.kind == "done" && self.round.choice.is_none() {
                    return Err("Choose Drink or Dare first.".into());
                }
                self.round.turn += 1;
                self.round.choice = None;
                self.round.giver = None;
                if self.round.turn >= self.round.queue.len() {
                    self.finish_round();
                }
            }
            "reassign" => {
                self.require_host(actor)?;
                self.require_phase(&["punishment"])?;
                if self.round.choice.as_deref() != Some("dare") {
                    return Err("There is no dare giver to replace.".into());
                }
                let recipient = self.round.queue.get(self.round.turn).unwrap();
                let choices: Vec<_> = self
                    .active()
                    .iter()
                    .filter(|p| p.connected && &p.id != recipient)
                    .map(|p| p.id.clone())
                    .collect();
                self.round.giver = choices.choose(&mut rand::thread_rng()).cloned();
            }
            "next" | "setup" => {
                self.require_host(actor)?;
                self.require_phase(&["rankings"])?;
                self.to_lobby();
            }
            "end" => {
                self.require_host(actor)?;
                self.phase = "ended".into();
                self.paused = false;
                self.pause_reason = None;
                self.pending_reports.clear();
                self.imposter_turns.clear();
                self.last_imposter = None;
            }
            "leave" => {
                if actor == self.host {
                    return Err("Use End party to leave as host.".into());
                }
                let p = self.players.iter_mut().find(|p| p.id == actor).unwrap();
                p.left = true;
                p.connected = false;
                self.remove_topic_voter(actor);
                if ["roles", "discussion", "voting", "runoff"].contains(&self.phase.as_str()) {
                    self.paused = true;
                    self.pause_reason =
                        Some("A player left. Abandon this round to continue.".into());
                }
            }
            _ => return Err("Unknown party action.".into()),
        }
        self.processed.insert(format!("{actor}:{}", action.id));
        self.revision += 1;
        Ok(())
    }
    fn to_lobby(&mut self) {
        self.phase = "lobby".into();
        self.paused = false;
        self.pause_reason = None;
        self.round.topic_ballots.clear();
        self.round.topic_voters.clear();
        self.round.topic_counts.clear();
        self.round.topic_leaders.clear();
        self.round.topic = None;
        self.round.clue_turn = 0;
        self.round.clues.clear();
        self.round.stakes.clear();
        for p in &mut self.players {
            p.ready = p.id == self.host;
        }
    }
    fn finish_round(&mut self) {
        self.phase = if self.session_winners.is_empty() {
            "rankings"
        } else {
            "session_complete"
        }
        .into();
    }
    fn finish_topic_voting(&mut self) {
        if self.phase != "topic_voting"
            || self.round.topic_ballots.len() != self.round.topic_voters.len()
        {
            return;
        }
        let mut counts = BTreeMap::new();
        for ballot in self.round.topic_ballots.values() {
            for id in ballot {
                *counts.entry(id.clone()).or_insert(0) += 1;
            }
        }
        let max = counts.values().copied().max().unwrap_or(0);
        if max == 0 {
            return;
        }
        self.round.topic_leaders = counts
            .iter()
            .filter(|(_, n)| **n == max)
            .map(|(id, _)| id.clone())
            .collect();
        self.round.topic_counts = counts;
        if self.round.topic_leaders.len() == 1 {
            self.round.topic = self.round.topic_leaders.first().cloned();
            self.phase = "topic_chosen".into();
        } else {
            self.phase = "topic_results".into();
        }
    }
    fn choose_topic(&mut self, rng: &mut impl rand::Rng) {
        // SliceRandom samples each tied topic once, independently of pack size,
        // catalog order, and approvals for lower-scoring topics.
        self.round.topic = self.round.topic_leaders.choose(rng).cloned();
        self.phase = "topic_chosen".into();
    }
    fn remove_topic_voter(&mut self, id: &str) {
        if !["topic_voting", "topic_results", "topic_chosen"].contains(&self.phase.as_str()) {
            return;
        }
        self.round.roster.retain(|p| p != id);
        if self.round.roster.len() < 3 {
            self.to_lobby();
            return;
        }
        if self.phase == "topic_voting" {
            self.round.topic_voters.retain(|p| p != id);
            self.round.topic_ballots.remove(id);
            self.finish_topic_voting();
        }
    }
    fn finish_reports(&mut self) {
        let mut counts: BTreeMap<&str, usize> = BTreeMap::new();
        for targets in self.round.reports.values() {
            for target in targets {
                *counts.entry(target).or_default() += 1;
            }
        }
        // The entire round roster is the denominator. Skips, missing submissions,
        // and the reported player's own ballot all count as no report.
        for (target, count) in counts {
            if count > self.round.roster.len() / 2 {
                self.pending_reports.insert(target.into(), self.round.id);
            }
        }
        if self.round.queue.is_empty() {
            self.finish_round();
        } else {
            self.phase = "punishment".into();
        }
    }
    fn resolve(&mut self, runoff: bool) {
        let votes = if runoff {
            &self.round.runoff
        } else {
            &self.round.original
        };
        let mut counts: BTreeMap<String, usize> = BTreeMap::new();
        for v in votes.values() {
            *counts.entry(v.clone()).or_default() += 1;
        }
        let max = counts.values().copied().max().unwrap_or(0);
        let tied: Vec<_> = counts
            .into_iter()
            .filter(|(_, n)| *n == max)
            .map(|(id, _)| id)
            .collect();
        if tied.len() > 1 && !runoff {
            self.round.candidates = tied;
            self.phase = "runoff".into();
            return;
        }
        self.round.accused = if tied.len() == 1 {
            Some(tied[0].clone())
        } else {
            None
        };
        if self.round.committed {
            return;
        }
        let imposter_escaped = self.round.accused.as_ref() != Some(&self.round.imposter);
        let perfect_bluff = imposter_escaped
            && !self
                .round
                .original
                .values()
                .any(|id| id == &self.round.imposter);
        for p in &mut self.players {
            if !self.round.roster.contains(&p.id) {
                continue;
            }
            let was_imposter = p.id == self.round.imposter;
            let correct = self.round.original.get(&p.id) == Some(&self.round.imposter);
            let base = if was_imposter {
                if imposter_escaped {
                    2
                } else {
                    0
                }
            } else {
                i32::from(correct)
            };
            let mut score = ScoreBreakdown {
                before: p.points,
                base,
                ..Default::default()
            };
            if was_imposter {
                score.bluff = i32::from(perfect_bluff);
            } else {
                let stake = self.round.stakes.get(&p.id).copied().unwrap_or(0) as i32;
                score.bet = if correct { stake } else { -stake };
                let streak = self.reading_streaks.entry(p.id.clone()).or_default();
                *streak = if correct { streak.saturating_add(1) } else { 0 };
                score.streak = i32::from(correct && *streak % 3 == 0);
            }
            p.earned = score.base + score.bet + score.streak + score.bluff;
            p.points = (p.points + p.earned).max(0);
            score.after = p.points;
            self.round.scores.insert(p.id.clone(), score);
            // Drink/Dare depends on the original outcome, not points wagered
            // or deductions. Neither bets nor reports add punishment turns.
            if base == 0 {
                self.round.queue.push(p.id.clone());
            }
        }
        // Apply the previous completed round's reports only after this round's
        // normal scoring. Abandoned rounds never drain these pending penalties.
        for (id, source_round) in std::mem::take(&mut self.pending_reports) {
            if let Some(player) = self.players.iter_mut().find(|p| p.id == id) {
                let deduction = player.points.min(1).max(0);
                player.points -= deduction;
                self.round.report_penalties.insert(id, source_round);
                if let Some(score) = self.round.scores.get_mut(&player.id) {
                    score.penalty = deduction;
                    score.after = player.points;
                }
            }
        }
        // Decide only after every player's gains, wagers, and existing report
        // deductions settle. Keep the winner snapshot through the round flow.
        let maximum = self.players.iter().map(|p| p.points).max().unwrap_or(0);
        if maximum >= self.target_score {
            self.session_winners = self
                .players
                .iter()
                .filter(|p| p.points == maximum)
                .map(|p| p.id.clone())
                .collect();
        }
        self.round.queue.shuffle(&mut rand::thread_rng());
        self.round.committed = true;
        self.phase = "results".into();
    }
    pub fn view(&self, actor: &str) -> Value {
        let me = self.players.iter().find(|p| p.id == actor);
        let results = self.round.committed
            && [
                "results",
                "reporting",
                "punishment",
                "rankings",
                "session_complete",
                "ended",
            ]
            .contains(&self.phase.as_str());
        let roles = ["roles", "discussion", "voting", "runoff"].contains(&self.phase.as_str())
            && self.round.roster.iter().any(|id| id == actor)
            && me.is_some_and(|p| !p.left);
        let current = self.round.queue.get(self.round.turn);
        let votes = if self.phase == "runoff" {
            &self.round.runoff
        } else {
            &self.round.original
        };
        let eligible: Vec<_> = self
            .players
            .iter()
            .filter(|p| !p.left || p.points != 0 || self.round.roster.contains(&p.id))
            .collect();
        json!({"id":self.id,"name":self.name,"wifi":self.wifi,"phase":self.phase,"revision":self.revision,"round_id":self.round.id,"host_id":self.host,"my_id":actor,"is_host":actor==self.host,"paused":self.paused,"pause_reason":self.pause_reason,"topics":self.topics,"catalog":content::catalog(),
          "score_session":{"number":self.session_number,"target":self.target_score,"started":self.session_started,"complete":!self.session_winners.is_empty(),"winner_ids":self.session_winners},
          "betting":{"eligible":roles && actor!=self.round.imposter,"max_stake":if roles && actor!=self.round.imposter {me.map(|p|p.points.clamp(0,3)).unwrap_or(0)}else{0},"my_stake":self.round.stakes.get(actor),"original_vote":self.round.original.get(actor),"reading_streak":self.reading_streaks.get(actor).copied().unwrap_or(0)},
          "topic_vote":if !self.round.topic_voters.is_empty() && self.phase != "lobby" {Some(json!({
            "my_topics":self.round.topic_ballots.get(actor), "submitted_ids":self.round.topic_ballots.keys().collect::<Vec<_>>(),
            "player_ids":self.round.topic_voters,"available_topics":self.round.topic_pool,
            "counts":if self.phase == "topic_voting" {Value::Null}else{json!(self.round.topic_counts)},
            "leaders":if self.phase == "topic_voting" {vec![]}else{self.round.topic_leaders.clone()},
            "selected_topic":self.round.topic
          }))}else{None},
          "players":eligible.iter().map(|p|json!({"id":p.id,"name":p.name,"ready":p.ready,"connected":p.connected,"left":p.left,"points":p.points,"earned":if results {p.earned}else{0},"report_penalty":if results {self.round.scores.get(&p.id).map(|s|s.penalty).unwrap_or(0)}else{0},"report_round":if results {self.round.report_penalties.get(&p.id)}else{None}})).collect::<Vec<_>>(),
          "private_role":if roles {Some(json!({"imposter":actor==self.round.imposter,"clue":if actor==self.round.imposter {&self.round.hint}else{&self.round.word}}))}else{None},
          "clue_turn":self.round.clue_turn,"clues":self.round.clues.iter().flat_map(|(player_id, turns)| turns.iter().map(move |(turn, text)| json!({"player_id":player_id,"turn":turn,"text":text}))).collect::<Vec<_>>(),
          "role_ready":self.round.acknowledged.contains(actor),"ready_count":self.round.acknowledged.len(),"starting_id":if self.phase=="discussion" {Some(&self.round.starting)}else{None},
          "vote_count":votes.len(),"my_vote":votes.get(actor),"candidates":if self.phase=="runoff" {self.round.candidates.clone()}else{vec![]},
          "result":if results {Some(json!({"imposter_id":self.round.imposter,"word":self.round.word,"accused_id":self.round.accused,"escaped":self.round.accused.as_ref()!=Some(&self.round.imposter),"my_vote":self.round.original.get(actor),"earned":me.map(|p|p.earned).unwrap_or(0),"was_imposter":actor==self.round.imposter,"report_penalty":self.round.scores.get(actor).map(|s|s.penalty).unwrap_or(0),"report_round":self.round.report_penalties.get(actor),"score":self.round.scores.get(actor),"imposter_bonus":self.round.scores.get(&self.round.imposter).map(|s|s.bluff).unwrap_or(0)}))}else{None},
          "reporting":if self.phase=="reporting" {Some(json!({"my_reports":self.round.reports.get(actor),"submitted_count":self.round.reports.len(),"total":self.round.roster.len(),"majority":self.round.roster.len()/2+1,"player_ids":self.round.roster}))}else{None},
          "punishment":if self.phase=="punishment" {Some(json!({"player_id":current,"giver_id":self.round.giver,"choice":self.round.choice,"turn":self.round.turn+1,"total":self.round.queue.len()}))}else{None}})
    }
}

#[cfg(test)]
#[path = "scoring_tests.rs"]
mod scoring_tests;

#[cfg(test)]
mod tests {
    use super::*;
    fn action(g: &mut Game, actor: &str, kind: &str, value: Value) -> GameResult<()> {
        g.apply(
            actor,
            &Action {
                id: Uuid::new_v4().to_string(),
                round_id: g.round.id,
                kind: kind.into(),
                value,
            },
        )
    }
    fn finish_topics(g: &mut Game) {
        for id in g.round.roster.clone() {
            action(g, &id, "topic_vote", json!(["food"])).unwrap();
        }
        let host = g.host.clone();
        action(g, &host, "begin_round", Value::Null).unwrap();
    }
    fn party() -> Game {
        let mut g = Game::new("Friday", "Alex", "Wi-Fi").unwrap();
        for n in ["Sam", "Mia", "Ben"] {
            g.join(n).unwrap();
        }
        for p in &mut g.players {
            p.ready = true;
        }
        let h = g.host.clone();
        action(&mut g, &h, "start", Value::Null).unwrap();
        finish_topics(&mut g);
        g
    }
    fn ballots(g: &mut Game, targets: [usize; 4]) {
        g.phase = "voting".into();
        g.round.imposter = g.players[1].id.clone();
        for (i, t) in targets.iter().enumerate() {
            let id = g.players[i].id.clone();
            let v = g.players[*t].id.clone();
            action(g, &id, "vote", json!(v)).unwrap();
        }
    }
    #[test]
    fn clue_turns_are_optional_public_and_do_not_redeal_or_change_scores() {
        let mut g = party();
        let host = g.host.clone();
        let ids: Vec<_> = g.players.iter().map(|p| p.id.clone()).collect();
        for id in &ids {
            action(&mut g, id, "role_ready", Value::Null).unwrap();
        }
        let original = (
            g.round.id,
            g.round.imposter.clone(),
            g.round.word.clone(),
            g.round.hint.clone(),
            g.imposter_turns.clone(),
        );
        action(&mut g, &ids[1], "clue", json!({"turn":1,"text":" Rain 🌧 "})).unwrap();
        assert_eq!(g.view(&ids[2])["clues"][0]["text"], "Rain 🌧");
        let next = Action {
            id: Uuid::new_v4().to_string(),
            round_id: g.round.id,
            kind: "next_clue_turn".into(),
            value: json!(1),
        };
        g.apply(&host, &next).unwrap();
        g.apply(&host, &next).unwrap();
        assert_eq!(g.round.clue_turn, 2);
        assert!(action(&mut g, &host, "next_clue_turn", json!(1)).is_err());
        assert!(action(&mut g, &ids[1], "next_clue_turn", json!(2)).is_err());
        action(&mut g, &ids[1], "clue", json!({"turn":2,"text":"Puddle"})).unwrap();
        action(&mut g, &ids[1], "clue", json!({"turn":1,"text":"Cloud"})).unwrap();
        assert_eq!(g.round.clues[&ids[1]].len(), 2);
        assert!(!g.round.clues.contains_key(&host));
        assert_eq!(
            original,
            (
                g.round.id,
                g.round.imposter.clone(),
                g.round.word.clone(),
                g.round.hint.clone(),
                g.imposter_turns.clone()
            )
        );
        assert!(g.players.iter().all(|p| p.points == 0));
        let history = g.view(&host)["clues"].clone();
        g.connection(&ids[1], false);
        g.connection(&ids[1], true);
        assert_eq!(g.view(&ids[1])["clues"], history);
        action(&mut g, &host, "open_vote", Value::Null).unwrap();
        assert_eq!(g.view(&host)["clues"], history);
        assert!(action(
            &mut g,
            &ids[1],
            "clue",
            json!({"turn":1,"text":"Late edit"})
        )
        .is_err());
        assert!(action(&mut g, &host, "next_clue_turn", json!(2)).is_err());
        g.phase = "runoff".into();
        assert_eq!(g.view(&host)["clues"], history);
        assert!(action(&mut g, &ids[1], "clue", json!({"turn":1,"text":""})).is_err());
        action(&mut g, &host, "abandon", Value::Null).unwrap();
        assert!(g.view(&host)["clues"].as_array().unwrap().is_empty());
        for id in ids {
            action(&mut g, &id, "ready", json!(true)).unwrap();
        }
        action(&mut g, &host, "start", Value::Null).unwrap();
        finish_topics(&mut g);
        assert_eq!(g.round.clue_turn, 1);
        assert!(g.round.clues.is_empty());
    }
    #[test]
    fn clues_validate_input_ownership_removal_and_stale_rounds() {
        let mut g = party();
        let host = g.host.clone();
        let ids: Vec<_> = g.players.iter().map(|p| p.id.clone()).collect();
        assert!(action(&mut g, &host, "clue", json!({"turn":1,"text":"Too soon"})).is_err());
        for id in &ids {
            action(&mut g, id, "role_ready", Value::Null).unwrap();
        }
        for payload in [
            json!({"turn":0,"text":"No"}),
            json!({"turn":2,"text":"Future"}),
            json!({"turn":1.5,"text":"No"}),
            json!({"turn":1,"text":"a".repeat(61)}),
            json!({"turn":1,"text":"two\nlines"}),
            json!({"turn":1,"text":123}),
        ] {
            assert!(action(&mut g, &host, "clue", payload).is_err());
        }
        let save = Action {
            id: Uuid::new_v4().to_string(),
            round_id: g.round.id,
            kind: "clue".into(),
            value: json!({"turn":1,"text":"<b>hello</b>","player_id":ids[1]}),
        };
        g.apply(&host, &save).unwrap();
        g.apply(&host, &save).unwrap();
        assert_eq!(g.round.clues.len(), 1);
        assert_eq!(g.round.clues[&host][&1], "<b>hello</b>");
        assert!(!g.round.clues.contains_key(&ids[1]));
        action(&mut g, &host, "clue", json!({"turn":1,"text":" "})).unwrap();
        assert!(g.round.clues.is_empty());
        let stale = Action {
            id: Uuid::new_v4().to_string(),
            round_id: g.round.id - 1,
            kind: "clue".into(),
            value: json!({"turn":1,"text":"Old"}),
        };
        assert!(g.apply(&host, &stale).is_err());
        assert!(g.round.clues.is_empty());
    }
    #[test]
    fn weighted_imposter_selection_favors_fewer_turns_but_allows_repeats() {
        use rand::{rngs::StdRng, SeedableRng};
        let mut g = party();
        let ids: Vec<_> = g.players.iter().map(|p| p.id.clone()).collect();
        for (id, turns) in ids.iter().zip([0, 1, 2, 1]) {
            g.imposter_turns.insert(id.clone(), turns);
        }
        g.last_imposter = Some(ids[3].clone());
        let weights: Vec<_> = g.imposter_weights().iter().map(|(_, w)| *w).collect();
        g.players[0].points = 100;
        g.players[1].points = -10;
        assert_eq!(
            weights,
            g.imposter_weights()
                .iter()
                .map(|(_, w)| *w)
                .collect::<Vec<_>>()
        );
        let mut rng = StdRng::seed_from_u64(42);
        let mut draws = [0; 4];
        for _ in 0..10_000 {
            let selected = g.choose_imposter(&mut rng).unwrap();
            draws[ids.iter().position(|id| id == &selected).unwrap()] += 1;
        }
        assert!(draws[0] > 3 * draws[1]); // Fewer turns get substantially more opportunities.
        assert!(draws[1] > draws[3]); // Equal history, lower odds for the last imposter.
        assert!(draws.iter().all(|n| *n > 0)); // Neither repeats nor past leaders are excluded.

        g.imposter_turns.clear();
        g.last_imposter = None;
        let mut repeats = 0;
        for _ in 0..4_000 {
            let selected = g.choose_imposter(&mut rng).unwrap();
            if g.last_imposter.as_ref() == Some(&selected) {
                repeats += 1;
            }
            g.record_imposter(&selected);
        }
        let counts: Vec<_> = ids.iter().map(|id| g.imposter_turns[id]).collect();
        assert!(counts.iter().max().unwrap() - counts.iter().min().unwrap() < 12);
        assert!(repeats > 0);
    }
    #[test]
    fn weighted_selection_is_balanced_across_three_to_twelve_players() {
        use rand::{rngs::StdRng, SeedableRng};
        for size in 3..=12 {
            for seed in [0, 1, 7, 42, 2026] {
                let mut g = Game::new("Selection matrix", "Host", "Wi-Fi").unwrap();
                for i in 1..size {
                    g.join(&format!("Player {i}")).unwrap();
                }
                let ids: Vec<_> = g.players.iter().map(|p| p.id.clone()).collect();
                g.round.roster = ids.clone();
                let mut rng = StdRng::seed_from_u64(seed);
                let mut repeats = 0;
                for _ in 0..5_000 {
                    let selected = g.choose_imposter(&mut rng).unwrap();
                    assert!(ids.contains(&selected));
                    if g.last_imposter.as_ref() == Some(&selected) {
                        repeats += 1;
                    }
                    g.record_imposter(&selected);
                }
                let counts: Vec<_> = ids
                    .iter()
                    .map(|id| g.imposter_turns.get(id).copied().unwrap_or(0))
                    .collect();
                assert_eq!(counts.iter().sum::<u64>(), 5_000);
                assert!(
                    counts.iter().all(|n| *n > 0),
                    "starved player: size={size}, seed={seed}"
                );
                // This checks these seeded simulations, not a guarantee of a
                // maximum spread in every possible random sequence.
                let spread = counts.iter().max().unwrap() - counts.iter().min().unwrap();
                assert!(
                    spread < 20,
                    "unbalanced simulation: size={size}, seed={seed}, counts={counts:?}"
                );
                assert!(repeats > 0, "repeats excluded: size={size}, seed={seed}");
            }
        }
    }
    #[test]
    fn weighted_selection_deals_one_imposter_at_every_supported_party_size() {
        for size in 3..=12 {
            let mut g = Game::new("Deal matrix", "Host", "Wi-Fi").unwrap();
            for i in 1..size {
                g.join(&format!("Player {i}")).unwrap();
            }
            for p in &mut g.players {
                p.ready = true;
            }
            let host = g.host.clone();
            action(&mut g, &host, "start", Value::Null).unwrap();
            finish_topics(&mut g);
            assert_eq!(g.phase, "roles");
            assert_eq!(g.round.roster.len(), size);
            let imposter_count = g
                .players
                .iter()
                .filter(|p| g.view(&p.id)["private_role"]["imposter"] == true)
                .count();
            assert_eq!(imposter_count, 1, "size={size}");
            assert_eq!(g.imposter_turns.values().sum::<u64>(), 1);
            assert_eq!(g.imposter_turns[&g.round.imposter], 1);
        }
    }
    #[test]
    fn imposter_history_is_charged_once_at_deal_and_survives_abandon_and_reconnect() {
        let mut g = Game::new("Fair selection", "Alex", "Wi-Fi").unwrap();
        for name in ["Sam", "Mia", "Ben"] {
            g.join(name).unwrap();
        }
        for player in &mut g.players {
            player.ready = true;
        }
        let host = g.host.clone();
        action(&mut g, &host, "start", Value::Null).unwrap();
        assert!(g.imposter_turns.values().all(|n| *n == 0)); // Topic voting has not dealt roles.
        let ids: Vec<_> = g.players.iter().map(|p| p.id.clone()).collect();
        for id in ids {
            action(&mut g, &id, "topic_vote", json!(["everyday"])).unwrap();
        }
        let deal = Action {
            id: Uuid::new_v4().to_string(),
            round_id: g.round.id,
            kind: "begin_round".into(),
            value: Value::Null,
        };
        g.apply(&host, &deal).unwrap();
        let selected = g.round.imposter.clone();
        let history = g.imposter_turns.clone();
        assert_eq!(history.values().sum::<u64>(), 1);
        assert_eq!(history[&selected], 1);
        g.apply(&host, &deal).unwrap();
        assert_eq!(g.imposter_turns, history);
        g.connection(&selected, false);
        g.connection(&selected, true);
        assert_eq!(g.imposter_turns, history);
        action(&mut g, &host, "abandon", Value::Null).unwrap();
        assert_eq!(g.imposter_turns, history);
        assert_eq!(g.last_imposter.as_deref(), Some(selected.as_str()));
        let view = g.view(&host).to_string();
        assert!(!view.contains("imposter_turns"));
        assert!(!view.contains("last_imposter"));
        action(&mut g, &host, "end", Value::Null).unwrap();
        assert!(g.imposter_turns.is_empty());
        assert!(g.last_imposter.is_none());
        let fresh = Game::new("New party", "Alex", "Wi-Fi").unwrap();
        assert!(fresh.imposter_turns.is_empty());
        assert!(fresh.last_imposter.is_none());
    }
    #[test]
    fn new_players_start_at_the_active_groups_minimum_history() {
        let mut g = party();
        g.to_lobby();
        for p in &g.players {
            g.imposter_turns.insert(p.id.clone(), 4);
        }
        g.imposter_turns.insert(g.host.clone(), 6);
        // An old departed player must not drag the baseline down to zero.
        g.players[1].left = true;
        g.imposter_turns.insert(g.players[1].id.clone(), 0);
        let newcomer = g.join("New friend").unwrap();
        assert_eq!(g.imposter_turns[&newcomer.id], 4);
        assert_eq!(newcomer.points, 0);
    }
    #[test]
    fn selection_only_includes_connected_round_participants() {
        use rand::{rngs::StdRng, SeedableRng};
        let mut g = party();
        g.players[1].connected = false;
        g.players[2].left = true;
        let excluded = g.players[3].id.clone();
        g.round.roster.retain(|id| id != &excluded);
        let mut rng = StdRng::seed_from_u64(7);
        assert_eq!(g.choose_imposter(&mut rng).unwrap(), g.host);
        g.players[0].connected = false;
        assert!(g.choose_imposter(&mut rng).is_err());
    }
    fn open_reports(g: &mut Game) {
        let host = g.host.clone();
        action(g, &host, "open_reports", Value::Null).unwrap();
    }
    fn next_round(g: &mut Game) {
        while g.phase == "punishment" {
            let recipient = g.round.queue[g.round.turn].clone();
            action(g, &recipient, "skip", Value::Null).unwrap();
        }
        let host = g.host.clone();
        action(g, &host, "next", Value::Null).unwrap();
        let ids = g.active().iter().map(|p| p.id.clone()).collect::<Vec<_>>();
        for id in ids {
            action(g, &id, "ready", json!(true)).unwrap();
        }
        action(g, &host, "start", Value::Null).unwrap();
        finish_topics(g);
    }
    #[test]
    fn reports_allow_multiple_targets_and_apply_once_after_next_scoring() {
        let mut g = party();
        ballots(&mut g, [2, 2, 1, 0]);
        open_reports(&mut g);
        let ids = g.players.iter().map(|p| p.id.clone()).collect::<Vec<_>>();
        let scores = g.players.iter().map(|p| p.points).collect::<Vec<_>>();
        let source_round = g.round.id;
        for (i, targets) in [vec![2], vec![0, 2], vec![0], vec![0, 2]]
            .iter()
            .enumerate()
        {
            let targets = targets.iter().map(|&j| ids[j].clone()).collect::<Vec<_>>();
            action(&mut g, &ids[i], "report", json!(targets)).unwrap();
        }
        assert_eq!(g.phase, "punishment");
        assert_eq!(
            g.players.iter().map(|p| p.points).collect::<Vec<_>>(),
            scores
        );
        assert_eq!(g.pending_reports.len(), 2);
        assert!(g.view(&ids[0])["result"]["report_round"].is_null());
        assert_eq!(g.view(&ids[0])["result"]["report_penalty"], 0);
        next_round(&mut g);
        assert!(g.round.reports.is_empty());
        assert_eq!(g.players[0].points, 0);
        ballots(&mut g, [2, 2, 1, 0]);
        assert_eq!(
            g.players.iter().map(|p| p.points).collect::<Vec<_>>(),
            vec![0, 4, 1, 0]
        );
        let view = g.view(&ids[2]);
        assert_eq!(view["result"]["earned"], 1);
        assert_eq!(view["result"]["report_penalty"], 1);
        assert_eq!(view["result"]["report_round"], source_round);
        assert!(
            !g.round.queue.contains(&ids[2]),
            "Reports must not add punishment turns"
        );
        g.resolve(false);
        assert_eq!(
            g.players[0].points, 0,
            "Scoring retries must not deduct twice"
        );
        assert!(g.pending_reports.is_empty());
    }
    #[test]
    fn reports_require_majority_of_all_four_or_five_players() {
        for total in [4, 5] {
            for yes in [2, 3] {
                let mut g = party();
                if total == 5 {
                    g.to_lobby();
                    g.join("Eve").unwrap();
                    for p in &mut g.players {
                        p.ready = true;
                    }
                    let host = g.host.clone();
                    action(&mut g, &host, "start", Value::Null).unwrap();
                    finish_topics(&mut g);
                }
                g.phase = "voting".into();
                g.round.imposter = g.players[1].id.clone();
                let ids = g.players.iter().map(|p| p.id.clone()).collect::<Vec<_>>();
                for (i, id) in ids.iter().enumerate() {
                    action(&mut g, id, "vote", json!(ids[if i == 1 { 0 } else { 1 }])).unwrap();
                }
                open_reports(&mut g);
                assert_eq!(g.view(&ids[0])["reporting"]["majority"], 3);
                // The target does not submit and another player may disconnect:
                // neither event reduces the full-roster majority threshold.
                for id in ids.iter().take(yes + 1).skip(1) {
                    action(&mut g, id, "report", json!([ids[0]])).unwrap();
                }
                if yes == 2 {
                    g.connection(&ids[3], false);
                }
                action(&mut g, &ids[0], "punish", Value::Null).unwrap();
                assert_eq!(g.pending_reports.contains_key(&ids[0]), yes == 3);
                assert_eq!(g.pending_reports.len(), usize::from(yes == 3));
            }
        }
    }
    #[test]
    fn report_ballots_are_private_validated_locked_and_retry_safe() {
        let mut g = party();
        let ids = g.players.iter().map(|p| p.id.clone()).collect::<Vec<_>>();
        assert!(action(&mut g, &ids[0], "report", json!([ids[1]])).is_err());
        ballots(&mut g, [2, 2, 1, 0]);
        assert!(action(&mut g, &ids[1], "open_reports", Value::Null).is_err());
        open_reports(&mut g);
        assert!(action(&mut g, &ids[1], "punish", Value::Null).is_err());
        for value in [
            json!([ids[0]]),
            json!([ids[1], ids[1]]),
            json!(["missing"]),
            Value::Null,
        ] {
            assert!(action(&mut g, &ids[0], "report", value).is_err());
            assert!(g.round.reports.is_empty());
        }
        let request = Action {
            id: "report-retry".into(),
            round_id: g.round.id,
            kind: "report".into(),
            value: json!([ids[1], ids[2]]),
        };
        g.apply(&ids[0], &request).unwrap();
        g.apply(&ids[0], &request).unwrap();
        assert_eq!(g.round.reports.len(), 1);
        assert!(action(&mut g, &ids[0], "report", json!([])).is_err());
        assert_eq!(
            g.view(&ids[0])["reporting"]["my_reports"],
            json!([ids[1], ids[2]])
        );
        assert!(g.view(&ids[1])["reporting"]["my_reports"].is_null());
        assert!(g.view(&ids[1])["reporting"].get("reports").is_none());
        assert!(g.view(&ids[1])["private_role"].is_null());
        g.connection(&ids[0], false);
        g.connection(&ids[0], true);
        assert_eq!(g.view(&ids[0])["reporting"]["my_reports"], request.value);
        action(&mut g, &ids[1], "report", json!([])).unwrap();
        assert_eq!(g.view(&ids[1])["reporting"]["my_reports"], json!([]));
        action(&mut g, &ids[0], "punish", Value::Null).unwrap();
        assert!(g.pending_reports.is_empty());
        assert!(action(&mut g, &ids[2], "report", json!([ids[1]])).is_err());
    }
    #[test]
    fn reports_do_not_accumulate_across_rounds_or_wait_for_skipped_players() {
        let mut g = party();
        let ids = g.players.iter().map(|p| p.id.clone()).collect::<Vec<_>>();
        for _ in 0..2 {
            ballots(&mut g, [2, 2, 1, 0]);
            open_reports(&mut g);
            for id in &ids[1..3] {
                action(&mut g, id, "report", json!([ids[0]])).unwrap();
            }
            // One explicit skip and one missing submission both count as no.
            action(&mut g, &ids[0], "report", json!([])).unwrap();
            action(&mut g, &ids[0], "punish", Value::Null).unwrap();
            assert!(g.pending_reports.is_empty());
            next_round(&mut g);
        }
        assert_eq!(g.players[0].points, 0);
    }
    #[test]
    fn pending_reports_survive_abandonment_but_expire_when_party_ends() {
        let mut g = party();
        ballots(&mut g, [2, 2, 1, 0]);
        open_reports(&mut g);
        let ids = g.players.iter().map(|p| p.id.clone()).collect::<Vec<_>>();
        let source_round = g.round.id;
        for id in &ids[1..] {
            action(&mut g, id, "report", json!([ids[0]])).unwrap();
        }
        action(&mut g, &ids[0], "report", json!([])).unwrap();
        next_round(&mut g);
        action(&mut g, &ids[0], "abandon", Value::Null).unwrap();
        assert_eq!(g.players[0].points, 0);
        for p in &mut g.players {
            p.ready = true;
        }
        action(&mut g, &ids[0], "start", Value::Null).unwrap();
        finish_topics(&mut g);
        ballots(&mut g, [2, 2, 1, 0]);
        assert_eq!(g.players[0].points, 0);
        assert_eq!(g.view(&ids[0])["result"]["report_round"], source_round);
        open_reports(&mut g);
        for id in &ids[1..] {
            action(&mut g, id, "report", json!([ids[0]])).unwrap();
        }
        action(&mut g, &ids[0], "report", json!([])).unwrap();
        assert!(!g.pending_reports.is_empty());
        action(&mut g, &ids[0], "end", Value::Null).unwrap();
        assert!(g.pending_reports.is_empty());
        assert_eq!(g.players[0].points, 0);
    }
    #[test]
    fn secret_views_never_include_other_roles_or_word() {
        let mut g = party();
        for phase in ["roles", "discussion", "voting", "runoff"] {
            g.phase = phase.into();
            for player in &g.players {
                let view = g.view(&player.id);
                let imposter = player.id == g.round.imposter;
                assert_eq!(view["private_role"]["imposter"], imposter);
                assert_eq!(
                    view["private_role"]["clue"].as_str(),
                    if imposter {
                        Some(g.round.hint.as_str())
                    } else {
                        Some(g.round.word.as_str())
                    }
                );
                assert!(view["result"].is_null());
                if imposter {
                    assert!(!view.to_string().contains(&format!("\"{}\"", g.round.word)));
                }
            }
            assert!(g.view("unknown-player")["private_role"].is_null());
        }
        let id = g.players[1].id.clone();
        g.players[1].left = true;
        assert!(g.view(&id)["private_role"].is_null());
        for phase in ["lobby", "results", "punishment", "rankings", "ended"] {
            g.phase = phase.into();
            assert!(g.view(&g.host)["private_role"].is_null());
        }
    }
    #[test]
    fn escaping_imposter_and_correct_civilian_both_score() {
        let mut g = party();
        ballots(&mut g, [2, 2, 1, 0]);
        assert_eq!(g.phase, "results");
        assert_eq!(
            g.players.iter().map(|p| p.points).collect::<Vec<_>>(),
            vec![0, 2, 1, 0]
        );
        assert_eq!(g.round.queue.len(), 2);
    }
    #[test]
    fn caught_imposter_gets_zero_and_wrong_voters_lose() {
        let mut g = party();
        ballots(&mut g, [1, 0, 1, 2]);
        assert_eq!(
            g.players.iter().map(|p| p.points).collect::<Vec<_>>(),
            vec![1, 0, 1, 0]
        );
    }
    #[test]
    fn repeated_tie_escapes_original_ballots_score_once() {
        let mut g = party();
        ballots(&mut g, [1, 0, 1, 0]);
        assert_eq!(g.phase, "runoff");
        for (i, t) in [1, 0, 1, 0].iter().enumerate() {
            let id = g.players[i].id.clone();
            let v = g.players[*t].id.clone();
            action(&mut g, &id, "vote", json!(v)).unwrap();
        }
        assert_eq!(g.phase, "results");
        assert!(g.round.accused.is_none());
        assert_eq!(
            g.players.iter().map(|p| p.points).collect::<Vec<_>>(),
            vec![1, 2, 1, 0]
        );
        g.resolve(true);
        assert_eq!(g.players[1].points, 2);
    }
    #[test]
    fn duplicate_requests_and_stale_rounds_are_safe() {
        let mut g = party();
        g.phase = "voting".into();
        let actor = g.players[0].id.clone();
        let a = Action {
            id: "same".into(),
            round_id: g.round.id,
            kind: "vote".into(),
            value: json!(g.players[1].id),
        };
        g.apply(&actor, &a).unwrap();
        g.apply(&actor, &a).unwrap();
        assert_eq!(g.round.original.len(), 1);
        let mut stale = a;
        stale.id = "new".into();
        stale.round_id = 0;
        assert!(g.apply(&actor, &stale).is_err());
    }
    #[test]
    fn nonhost_cannot_control_or_punish_other_player() {
        let mut g = party();
        let guest = g.players[1].id.clone();
        assert!(action(&mut g, &guest, "open_vote", Value::Null).is_err());
        g.phase = "punishment".into();
        g.round.queue = vec![g.host.clone()];
        assert!(action(&mut g, &guest, "choice", json!("drink")).is_err());
    }
    #[test]
    fn disconnect_pauses_reconnect_restores_abandon_no_points() {
        let mut g = party();
        let guest = g.players[1].id.clone();
        g.connection(&guest, false);
        assert!(g.paused);
        g.connection(&guest, true);
        assert!(!g.paused);
        let host = g.host.clone();
        action(&mut g, &host, "abandon", Value::Null).unwrap();
        assert_eq!(g.phase, "lobby");
        assert!(g.players.iter().all(|p| p.points == 0));
    }
    #[test]
    fn ready_gate_and_topic_changes() {
        let mut g = Game::new("Party", "A", "Wi-Fi").unwrap();
        let h = g.host.clone();
        assert!(action(&mut g, &h, "start", Value::Null).is_err());
        let p = g.join("B").unwrap();
        g.join("C").unwrap();
        action(&mut g, &p.id, "ready", json!(true)).unwrap();
        action(&mut g, &h, "topics", json!(["food"])).unwrap();
        assert!(!g.players[1].ready);
        assert!(action(&mut g, &h, "topics", json!(["missing"])).is_err());
    }
    #[test]
    fn dare_giver_not_recipient_and_skip_preserves_score() {
        let mut g = party();
        ballots(&mut g, [2, 2, 1, 0]);
        let h = g.host.clone();
        open_reports(&mut g);
        action(&mut g, &h, "punish", Value::Null).unwrap();
        let who = g.round.queue[0].clone();
        action(&mut g, &who, "choice", json!("dare")).unwrap();
        assert_ne!(g.round.giver, Some(who.clone()));
        let points: Vec<_> = g.players.iter().map(|p| p.points).collect();
        action(&mut g, &who, "done", Value::Null).unwrap();
        assert_eq!(
            points,
            g.players.iter().map(|p| p.points).collect::<Vec<_>>()
        );
    }
    fn topic_party(total: usize) -> Game {
        let mut g = Game::new("Topics", "Host", "Wi-Fi").unwrap();
        for n in 1..total {
            g.join(&format!("Player {n}")).unwrap();
        }
        for p in &mut g.players {
            p.ready = true;
        }
        let host = g.host.clone();
        action(&mut g, &host, "start", Value::Null).unwrap();
        g
    }
    #[test]
    fn topic_ballots_are_private_validated_locked_and_retry_safe() {
        let mut g = topic_party(4);
        let ids = g.round.roster.clone();
        assert_eq!(g.phase, "topic_voting");
        assert_eq!(g.topics.len(), 19);
        assert!(g.round.word.is_empty() && g.round.imposter.is_empty());
        assert!(g.view(&ids[0])["private_role"].is_null());
        for invalid in [
            json!([]),
            json!(["food", "food"]),
            json!(["missing"]),
            json!(["health"]),
            json!("food"),
        ] {
            assert!(action(&mut g, &ids[1], "topic_vote", invalid).is_err());
        }
        let ballot = Action {
            id: "topic-retry".into(),
            round_id: g.round.id,
            kind: "topic_vote".into(),
            value: json!(["food", "animals"]),
        };
        g.apply(&ids[1], &ballot).unwrap();
        g.apply(&ids[1], &ballot).unwrap();
        assert_eq!(g.round.topic_ballots.len(), 1);
        assert!(action(&mut g, &ids[1], "topic_vote", json!(["music"])).is_err());
        let host_view = g.view(&ids[0]);
        assert!(host_view["topic_vote"]["my_topics"].is_null());
        assert!(host_view["topic_vote"]["counts"].is_null());
        assert!(host_view["topic_vote"].get("ballots").is_none());
        assert_eq!(
            g.view(&ids[1])["topic_vote"]["my_topics"],
            json!(["food", "animals"])
        );
        assert!(action(&mut g, &ids[0], "begin_round", Value::Null).is_err());
        assert!(action(&mut g, &ids[0], "topics", json!(["food"])).is_err());
        assert!(g.join("Late guest").is_err());
        g.connection(&ids[1], false);
        g.connection(&ids[1], true);
        assert_eq!(g.view(&ids[1])["topic_vote"]["my_topics"], ballot.value);
    }
    #[test]
    fn approvals_tally_each_selected_topic_and_only_leaders_enter_draw() {
        let mut g = topic_party(6);
        let ids = g.round.roster.clone();
        let ballots = [
            json!(["food", "animals"]),
            json!(["food", "everyday"]),
            json!(["animals", "music"]),
            json!(["food", "animals"]),
            json!(["food"]),
            json!(["animals", "everyday"]),
        ];
        for (id, ballot) in ids.iter().zip(ballots) {
            action(&mut g, id, "topic_vote", ballot).unwrap();
        }
        assert_eq!(g.phase, "topic_results");
        assert_eq!(
            g.round.topic_counts,
            BTreeMap::from([
                ("food".into(), 4),
                ("animals".into(), 4),
                ("everyday".into(), 2),
                ("music".into(), 1)
            ])
        );
        assert_eq!(g.round.topic_leaders, vec!["animals", "food"]);
        assert!(action(&mut g, &ids[1], "draw_topic", Value::Null).is_err());
        action(&mut g, &ids[0], "draw_topic", Value::Null).unwrap();
        assert!(g
            .round
            .topic_leaders
            .contains(g.round.topic.as_ref().unwrap()));
        let chosen = g.round.topic.clone();
        assert!(action(&mut g, &ids[0], "draw_topic", Value::Null).is_err());
        g.connection(&ids[1], false);
        g.connection(&ids[1], true);
        assert_eq!(g.round.topic, chosen);
        assert!(g.round.word.is_empty());
        assert!(g.players.iter().all(|p| p.points == 0));
        action(&mut g, &ids[0], "begin_round", Value::Null).unwrap();
        let pack = content::topics()
            .into_iter()
            .find(|t| Some(&t.id) == chosen.as_ref())
            .unwrap();
        assert!(pack
            .words
            .iter()
            .any(|w| w.word == g.round.word && w.hint == g.round.hint));
    }
    #[test]
    fn ties_of_any_size_use_uniform_sampling_and_unique_winner_skips_draw() {
        use rand::SeedableRng;
        let mut rng = rand::rngs::StdRng::seed_from_u64(98761);
        for size in [2, 3, 4, 19] {
            let mut g = topic_party(3);
            let choices = g.round.topic_pool[..size].to_vec();
            for id in g.round.roster.clone() {
                action(&mut g, &id, "topic_vote", json!(choices)).unwrap();
            }
            assert_eq!(g.round.topic_leaders.len(), size);
            let mut outcomes = BTreeMap::new();
            for _ in 0..4096 {
                let mut draw = g.clone();
                draw.choose_topic(&mut rng);
                let result = draw.round.topic.unwrap();
                assert!(choices.contains(&result));
                *outcomes.entry(result).or_insert(0) += 1;
            }
            let expected = 4096 / size;
            assert_eq!(outcomes.len(), size);
            assert!(outcomes
                .values()
                .all(|n| *n > expected * 3 / 4 && *n < expected * 5 / 4));
        }
        let mut g = topic_party(3);
        let ids = g.round.roster.clone();
        action(&mut g, &ids[0], "topic_vote", json!(["food", "music"])).unwrap();
        action(&mut g, &ids[1], "topic_vote", json!(["food"])).unwrap();
        action(&mut g, &ids[2], "topic_vote", json!(["animals"])).unwrap();
        assert_eq!(g.phase, "topic_chosen");
        assert_eq!(g.round.topic.as_deref(), Some("food"));
        assert!(action(&mut g, &ids[0], "draw_topic", Value::Null).is_err());
    }
    #[test]
    fn removing_voters_updates_open_tally_but_preserves_finalized_result() {
        let mut g = topic_party(5);
        let ids = g.round.roster.clone();
        action(&mut g, &ids[1], "topic_vote", json!(["music"])).unwrap();
        action(&mut g, &ids[0], "remove", json!(ids[1])).unwrap();
        assert!(!g.round.topic_ballots.contains_key(&ids[1]));
        for id in [&ids[0], &ids[2], &ids[3]] {
            action(&mut g, id, "topic_vote", json!(["food"])).unwrap();
        }
        action(&mut g, &ids[4], "leave", Value::Null).unwrap();
        assert_eq!(g.phase, "topic_chosen");
        assert_eq!(g.round.topic_counts.get("food"), Some(&3));
        // A fresh four-player vote can lose a player after tally without rerolling.
        let mut g = topic_party(4);
        let ids = g.round.roster.clone();
        for id in &ids {
            action(&mut g, id, "topic_vote", json!(["food", "music"])).unwrap();
        }
        action(&mut g, &ids[0], "draw_topic", Value::Null).unwrap();
        let selected = g.round.topic.clone();
        let counts = g.round.topic_counts.clone();
        action(&mut g, &ids[3], "leave", Value::Null).unwrap();
        assert_eq!(g.round.topic, selected);
        assert_eq!(g.round.topic_counts, counts);
        action(&mut g, &ids[0], "begin_round", Value::Null).unwrap();
        assert_eq!(g.round.roster.len(), 3);
        assert_ne!(g.round.imposter, ids[3]);
    }
    #[test]
    fn new_rounds_clear_topic_votes_reject_stale_ballots_and_keep_word_repeat_avoidance() {
        let mut g = topic_party(3);
        let ids = g.round.roster.clone();
        let old = g.round.id;
        for id in &ids {
            action(&mut g, id, "topic_vote", json!(["food"])).unwrap();
        }
        action(&mut g, &ids[0], "begin_round", Value::Null).unwrap();
        let word = g.round.word.clone();
        g.to_lobby();
        for p in &mut g.players {
            p.ready = true;
        }
        action(&mut g, &ids[0], "start", Value::Null).unwrap();
        assert!(g.round.topic_ballots.is_empty());
        assert!(g.round.topic.is_none());
        assert!(g
            .apply(
                &ids[1],
                &Action {
                    id: "stale-topics".into(),
                    round_id: old,
                    kind: "topic_vote".into(),
                    value: json!(["food"])
                }
            )
            .is_err());
        for id in &ids {
            action(&mut g, id, "topic_vote", json!(["food"])).unwrap();
        }
        action(&mut g, &ids[0], "begin_round", Value::Null).unwrap();
        assert_ne!(g.round.word, word);
        let mut g = topic_party(3);
        let host = g.host.clone();
        let guest = g.round.roster[1].clone();
        action(&mut g, &guest, "leave", Value::Null).unwrap();
        assert_eq!(g.phase, "lobby");
        assert!(g.view(&host)["topic_vote"].is_null());
    }
    #[test]
    fn bundled_content_has_enough_unique_words_and_valid_hint_format() {
        let packs = content::topics();
        assert_eq!(packs.len(), 23);
        let mut ids = HashSet::new();
        let mut words = HashSet::new();
        for t in packs {
            assert!(ids.insert(t.id.clone()), "duplicate topic: {}", t.id);
            assert!(t.words.len() >= 20, "topic too small: {}", t.id);
            assert_eq!(
                t.opt_in,
                ["dating", "puberty", "health", "consent"].contains(&t.id.as_str()),
                "unexpected opt-in setting: {}",
                t.id
            );
            for w in t.words {
                assert!(!w.word.trim().is_empty());
                assert_eq!(w.word, w.word.trim());
                assert_eq!(w.hint, w.hint.trim());
                let word = w.word.to_lowercase();
                let hint = w.hint.to_lowercase();
                let canonical: String = word.chars().filter(|c| c.is_alphanumeric()).collect();
                assert!(words.insert(canonical), "duplicate word: {}", w.word);
                assert!(!hint.is_empty(), "empty hint: {}", w.word);
                assert_eq!(hint.split_whitespace().count(), 1);
                assert_ne!(word, hint);
                assert!(
                    !word
                        .split(|c: char| !c.is_alphanumeric())
                        .any(|token| token == hint),
                    "hint repeats part of the answer: {} / {}",
                    w.word,
                    w.hint
                );
            }
        }
    }
    #[test]
    fn bundled_hints_have_reviewed_alternatives_in_the_same_topic() {
        let packs = content::topics();
        let review: Value =
            serde_json::from_str(include_str!("../content/hint-review.json")).unwrap();
        assert_eq!(review["version"], 1);
        let topic_reviews = review["topics"].as_array().unwrap();
        assert_eq!(topic_reviews.len(), packs.len());
        let mut ids = HashSet::new();
        for topic_review in topic_reviews {
            let id = topic_review["id"].as_str().unwrap();
            assert!(ids.insert(id), "duplicate review topic: {id}");
            let topic = packs.iter().find(|t| t.id == id).unwrap();
            let words: HashSet<_> = topic.words.iter().map(|w| w.word.as_str()).collect();
            let mut groups = BTreeMap::new();
            for association in topic_review["associations"].as_array().unwrap() {
                let hint = association["hint"].as_str().unwrap();
                let candidates = association["plausible_words"].as_array().unwrap();
                assert!((3..=6).contains(&candidates.len()), "{id} / {hint}");
                let candidates: HashSet<_> =
                    candidates.iter().map(|w| w.as_str().unwrap()).collect();
                assert_eq!(
                    candidates.len(),
                    association["plausible_words"].as_array().unwrap().len(),
                    "duplicate alternatives: {id} / {hint}"
                );
                assert!(candidates.is_subset(&words), "wrong topic: {id} / {hint}");
                assert!(groups.insert(hint, candidates).is_none());
            }
            let used_hints: HashSet<_> = topic.words.iter().map(|w| w.hint.as_str()).collect();
            assert_eq!(groups.len(), used_hints.len(), "unused review hints: {id}");
            for pair in &topic.words {
                assert!(
                    groups
                        .get(pair.hint.as_str())
                        .expect("missing hint review")
                        .contains(pair.word.as_str()),
                    "missing reviewed target: {id} / {}",
                    pair.word
                );
            }
        }
    }
    #[test]
    fn nature_entries_are_separate_from_animals() {
        let packs = content::topics();
        let animals = packs.iter().find(|t| t.id == "animals").unwrap();
        let nature = packs.iter().find(|t| t.id == "nature").unwrap();
        for word in ["Cactus", "Mushroom", "Waterfall", "Volcano"] {
            assert!(!animals.words.iter().any(|w| w.word == word));
            assert!(nature.words.iter().any(|w| w.word == word));
        }
    }
}
