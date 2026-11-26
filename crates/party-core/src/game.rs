use crate::{
    cast::{self, Cast, Picks, Role},
    content::{self, GameMode},
    history::Deck,
    selection,
};
use icu_normalizer::ComposingNormalizer;
use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, HashSet},
    time::{Duration, Instant},
};
use uuid::Uuid;

#[path = "power.rs"]
mod power;

pub type GameResult<T> = Result<T, String>;
pub(crate) const NO_FRESH_TOPICS: &str = "No fresh topics are available with these round settings.";
const RULE_SHUFFLE: Duration = Duration::from_millis(1250);
const RULE_HOLD: Duration = Duration::from_secs(3);
// The chosen topic stays on screen this long before the round is dealt
// (or the power-card draw opens over it).
const TOPIC_HOLD: Duration = Duration::from_millis(3500);
const RESULT_BEAT: Duration = Duration::from_secs(1);
// Each player reads their own outcome before everyone's results open.
const PERSONAL_BEAT: Duration = Duration::from_secs(2);
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
    pub bluff: i32,
    /// Full Cast extras: pair bonus, decoy catch, and the decoy's caught-imposter point.
    pub bonus: i32,
    /// Full Cast: spotted this round, so no gains (a lost bet still counts).
    pub voided: bool,
    /// Power cards: points moved by cards, the Bounty and Robin Hood.
    pub cards: Vec<crate::cards::Line>,
    pub penalty: i32,
    pub after: i32,
}
#[derive(Clone, Debug, Default)]
pub struct Round {
    pub id: u32,
    pub clue_turn: u32,
    pub clues: BTreeMap<String, BTreeMap<u32, String>>,
    pub performed: BTreeMap<String, std::collections::BTreeSet<u32>>,
    rule: Option<GameMode>,
    random_at_start: bool,
    eligible_targets: selection::Topics,
    deck_revision: u64,
    pub word_id: Option<String>,
    pub(crate) retry_word_id: Option<String>,
    reveal_at: Option<Instant>,
    reveal_landed: bool,
    /// When the topic was chosen: the host loop deals after `TOPIC_HOLD`.
    topic_chosen_at: Option<Instant>,
    pub(crate) deal_error: Option<String>,
    pub roster: Vec<String>,
    pub topic_voters: Vec<String>,
    pub topic_pool: Vec<String>,
    pub topic_ballots: BTreeMap<String, Vec<String>>,
    pub topic_counts: BTreeMap<String, usize>,
    pub topic_leaders: Vec<String>,
    pub topic: Option<String>,
    pub imposter: String,
    pub word: String,
    definition: String,
    pub hint: String,
    pub starting: String,
    /// The round's speaking order, starting player first.
    pub order: Vec<String>,
    pub acknowledged: HashSet<String>,
    pub original: BTreeMap<String, String>,
    pub stakes: BTreeMap<String, u32>,
    pub scores: BTreeMap<String, ScoreBreakdown>,
    pre_score_points: BTreeMap<String, i32>,
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
    cast: Option<Cast>,
    picks: BTreeMap<String, Picks>,
    cast_facts: Option<cast::Facts>,
    judge_tiebreak: bool,
    pub(crate) cards: power::CardRound,
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
    pub(crate) deck: Deck,
    pub session_number: u32,
    pub target_score: i32,
    pub session_started: bool,
    pub session_winners: Vec<String>,
    pending_reports: BTreeMap<String, u32>,
    // Party-only selection history, deliberately excluded from per-player views.
    imposter_turns: BTreeMap<String, u64>,
    rule_turns: BTreeMap<GameMode, u64>,
    last_rule: Option<GameMode>,
    last_imposter: Option<String>,
    /// Who spoke first last round; they never open the next one.
    last_starting: Option<String>,
    /// Full Cast seats held per role (the imposter uses `imposter_turns`).
    role_turns: BTreeMap<(Role, String), u64>,
    last_roles: BTreeMap<String, Role>,
    processed: HashSet<String>,
    replacement: bool,
    restart_notice: Option<&'static str>,
    pub(crate) cards: power::CardSession,
    #[cfg(test)]
    // Pins the two tests that still cover the removed runoff path.
    pub(crate) legacy_test_flow: bool,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Action {
    pub id: String,
    pub round_id: u32,
    pub kind: String,
    #[serde(default)]
    pub value: Value,
}
/// A fresh random speaking order each round. Whoever opened the previous
/// round never opens this one: they swap with a random later speaker.
fn speaking_order(roster: &[String], last_first: Option<&str>, rng: &mut impl rand::Rng) -> Vec<String> {
    let mut order = roster.to_vec();
    order.shuffle(rng);
    if order.len() > 1 && order.first().map(String::as_str) == last_first {
        let other = rng.gen_range(1..order.len());
        order.swap(0, other);
    }
    order
}
pub fn clean_name(s: &str) -> GameResult<String> {
    let s = ComposingNormalizer::new_nfc().normalize(s.trim());
    if s.is_empty() || s.chars().count() > 28 || s.chars().any(char::is_control) {
        return Err("Use a name between 1 and 28 characters.".into());
    }
    Ok(s.into_owned())
}
fn player_name_key(name: &str) -> String {
    name.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .replace(['\u{2018}', '\u{2019}'], "'")
        .to_lowercase()
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
            deck: Deck::default(),
            session_number: 1,
            target_score: 15,
            session_started: false,
            session_winners: vec![],
            pending_reports: BTreeMap::new(),
            imposter_turns: BTreeMap::new(),
            rule_turns: BTreeMap::new(),
            last_rule: None,
            last_imposter: None,
            last_starting: None,
            role_turns: BTreeMap::new(),
            last_roles: BTreeMap::new(),
            processed: HashSet::new(),
            replacement: false,
            restart_notice: None,
            cards: power::CardSession::default(),
            #[cfg(test)]
            legacy_test_flow: false,
        })
    }
    pub fn active(&self) -> Vec<&Player> {
        self.players.iter().filter(|p| !p.left).collect()
    }
    pub(crate) fn player_named(&self, name: &str) -> Option<&Player> {
        let key = player_name_key(name);
        self.players
            .iter()
            .find(|p| !p.left && player_name_key(&p.name) == key)
    }
    pub fn join(&mut self, name: &str) -> GameResult<Player> {
        if self.phase != "lobby" {
            return Err("This round has started. Join when the host returns to the lobby.".into());
        }
        if self.active().len() >= 12 {
            return Err("This party is full (12 players).".into());
        }
        let name = clean_name(name)?;
        if self.player_named(&name).is_some() {
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
    fn rule_weights(&self, feasible: &[GameMode]) -> Vec<(GameMode, f64)> {
        // A rule that has never been feasible starts level with the least aired
        // one, so it is preferred without flooding the next several rounds.
        let minimum = feasible
            .iter()
            .filter_map(|rule| self.rule_turns.get(rule).copied())
            .min()
            .unwrap_or(0);
        feasible
            .iter()
            .map(|rule| {
                let turns = self.rule_turns.get(rule).copied().unwrap_or(minimum);
                // Same shape as the imposter weighting: one extra airing drops
                // the weight to 1/4, two to 1/9, and the last rule is halved.
                let gap = turns.saturating_sub(minimum).min(15) as f64;
                let recent = if self.last_rule == Some(*rule) { 0.5 } else { 1.0 };
                (*rule, recent / (1.0 + gap).powi(2))
            })
            .collect()
    }
    fn record_rule(&mut self, rule: GameMode) {
        let turns = self.rule_turns.entry(rule).or_default();
        *turns = turns.saturating_add(1);
        self.last_rule = Some(rule);
    }
    /// One seat's weight in the deal: the fewer turns a player has had in this
    /// role, the likelier they are to draw it next.
    fn role_weight(&self, role: Role, id: &str) -> f64 {
        let roster = &self.round.roster;
        if role == Role::Imposter {
            let turns = |p: &str| self.imposter_turns.get(p).copied().unwrap_or(0);
            let minimum = roster.iter().map(|p| turns(p)).min().unwrap_or(0);
            return cast::weight(turns(id), minimum, self.last_imposter.as_deref() == Some(id));
        }
        let minimum = roster
            .iter()
            .filter_map(|p| self.role_turns.get(&(role, p.clone())).copied())
            .min()
            .unwrap_or(0);
        // Someone never dealt into Full Cast starts level with the group, like
        // a late arrival's imposter history.
        let turns = self.role_turns.get(&(role, id.into())).copied().unwrap_or(minimum);
        cast::weight(turns, minimum, self.last_roles.get(id) == Some(&role))
    }
    /// The imposter rotation on its own. The deal draws every seat jointly
    /// (see `cast::assign`); these isolate the curve the draw is weighted by.
    #[cfg(test)]
    fn imposter_weights(&self) -> Vec<(&str, f64)> {
        self.players
            .iter()
            .filter(|p| !p.left && p.connected && self.round.roster.contains(&p.id))
            .map(|p| (p.id.as_str(), self.role_weight(Role::Imposter, &p.id)))
            .collect()
    }
    #[cfg(test)]
    fn choose_imposter(&self, rng: &mut impl rand::Rng) -> GameResult<String> {
        self.imposter_weights()
            .choose_weighted(rng, |(_, weight)| *weight)
            .map(|(id, _)| (*id).to_owned())
            .map_err(|_| "No connected players are available for this round.".into())
    }
    /// Tests pin who the imposter is; the dealt cast follows them, with the
    /// other seats filled from the back of the roster.
    #[cfg(test)]
    pub(crate) fn force_imposter(&mut self, id: &str) {
        let ids = self.round.roster.clone();
        if let Some(cast) = &mut self.round.cast {
            let mut roles: BTreeMap<String, Role> =
                ids.iter().map(|p| (p.clone(), Role::Gambler)).collect();
            roles.insert(id.to_string(), Role::Imposter);
            let mut seats = ids.iter().rev().filter(|p| p.as_str() != id);
            for role in cast::specials(ids.len()).iter().filter(|r| **r != Role::Imposter) {
                if let Some(p) = seats.next() {
                    roles.insert(p.clone(), *role);
                }
            }
            cast.cleared = ids
                .iter()
                .find(|p| matches!(roles[*p], Role::Judge | Role::Decoy | Role::Gambler))
                .cloned()
                .unwrap_or_default();
            cast.roles = roles;
        }
        self.round.imposter = id.to_string();
    }
    fn record_cast(&mut self, roles: &BTreeMap<String, Role>) {
        for role in [Role::Accomplice, Role::Detective, Role::Judge, Role::Decoy, Role::Gambler] {
            let minimum = roles
                .keys()
                .filter_map(|p| self.role_turns.get(&(role, p.clone())).copied())
                .min()
                .unwrap_or(0);
            for p in roles.keys() {
                self.role_turns.entry((role, p.clone())).or_insert(minimum);
            }
        }
        for (p, role) in roles {
            if let Some(turns) = self.role_turns.get_mut(&(*role, p.clone())) {
                *turns = turns.saturating_add(1);
            }
        }
        self.last_roles = roles.clone();
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
        if ["roles", "discussion", "voting", "runoff"].contains(&self.phase.as_str())
            && !connected
            && !self.paused
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
        if self.paused
            && ![
                "resume",
                "abandon",
                "skip_round",
                "leave",
                "end",
                "random_rules",
            ]
            .contains(&action.kind.as_str())
        {
            return Err("The round is paused.".into());
        }
        let value = action.value.as_str().unwrap_or_default();
        match action.kind.as_str() {
            "random_rules" => {
                self.require_host(actor)?;
                if self.phase == "ended" {
                    return Err("The party has ended.".into());
                }
                let enabled = action
                    .value
                    .as_bool()
                    .ok_or("Set random round rules on or off.")?;
                if self.deck.random_rules != enabled {
                    self.deck.random_rules = enabled;
                    self.deck.revision += 1;
                    // The preference is independent of the frozen word deck.
                    if self.round.rule.is_some() {
                        self.round.deck_revision = self.deck.revision;
                    }
                }
            }
            "fresh_word_deck" => {
                self.require_host(actor)?;
                self.require_phase(&["lobby"])?;
                self.deck.renew()?;
            }
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
                self.reset_card_session();
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
                self.require_phase(&[
                    "lobby",
                    "rule_reveal",
                    "topic_voting",
                    "topic_results",
                    "topic_chosen",
                    "draw",
                ])?;
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
                let id = value.to_string();
                self.drop_hand(&id);
                self.remove_topic_voter(&id);
            }
            "start" => {
                self.require_host(actor)?;
                self.require_phase(&["lobby"])?;
                if !self.replacement {
                    self.restart_notice = None;
                }
                self.kickoff(true)?;
            }
            "open_topics" => {
                self.require_host(actor)?;
                self.require_phase(&["rule_reveal"])?;
                if self.streamlined() {
                    return Err("Topic voting opens after the reveal.".into());
                }
                if self.active().iter().any(|p| !p.connected) {
                    return Err(
                        "Wait for everyone to reconnect or remove the missing player.".into(),
                    );
                }
                self.phase = "topic_voting".into();
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
                // With power cards on, an untimed draw window comes first.
                if !self.open_draw() {
                    self.deal()?;
                }
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
                if self.round.rule.is_some_and(GameMode::nonverbal) {
                    return Err(
                        "This rule uses in-person clues and optional performed markers.".into(),
                    );
                }
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
                    self.clue_given(actor);
                }
            }
            "performed" => {
                self.require_phase(&["discussion"])?;
                if !matches!(self.round.rule, Some(GameMode::ActIt | GameMode::SoundOnly)) {
                    return Err("Performed markers are for Act It and Sound Only.".into());
                }
                if !self.round.roster.iter().any(|id| id == actor) {
                    return Err("You did not play in this round.".into());
                }
                #[derive(Deserialize)]
                #[serde(deny_unknown_fields)]
                struct Marker {
                    turn: u32,
                    performed: bool,
                }
                let marker: Marker = serde_json::from_value(action.value.clone())
                    .map_err(|_| "Mark or unmark one of your clue turns.")?;
                if marker.turn == 0 || marker.turn > self.round.clue_turn {
                    return Err("Choose a clue turn from this round.".into());
                }
                let turns = self.round.performed.entry(actor.into()).or_default();
                if marker.performed {
                    turns.insert(marker.turn);
                    self.round.cards.owed.remove(actor);
                } else {
                    turns.remove(&marker.turn);
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
                // Put on the Spot: an owed clue asks for the host's OK first.
                let confirm = action.value.get("confirm").and_then(Value::as_bool).unwrap_or(false);
                self.open_vote_cards(confirm)?;
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
                    if actor == self.round.imposter && !self.streamlined() {
                        return Err("The imposter cannot place a confidence bet.".into());
                    }
                    // Underdogs may bet up to 3 whatever their balance.
                    self.check_stake(actor, stake)?;
                }
                // The Imposter's ballot names their accomplice pick and never
                // counts, so their On the Record vote is only for show.
                if let Some(recorded) = self.recorded_vote(actor).filter(|_| actor != self.round.imposter) {
                    if recorded != target {
                        return Err("Your vote is on the record. It can’t change.".into());
                    }
                }
                let picks = if is_runoff {
                    None
                } else {
                    self.cast_picks(actor, target, &action.value)?
                };
                if !is_runoff && self.round.cards.active {
                    if self.round.original.contains_key(actor) {
                        return Err("Your vote is already locked.".into());
                    }
                    // A ballot card rides with the vote and is announced as it locks.
                    self.ballot_card(actor, target, stake, &action.value)?;
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
                if let Some(picks) = picks {
                    self.round.picks.insert(actor.into(), picks);
                }
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
                if self.round.roster.iter().any(|id| {
                    self.players
                        .iter()
                        .any(|player| &player.id == id && player.left)
                }) && ["roles", "discussion", "voting", "runoff"].contains(&self.phase.as_str())
                {
                    return Err("A player left. Abandon this round to continue.".into());
                }
                if self.active().iter().any(|p| !p.connected) {
                    return Err("Wait for everyone to reconnect, or abandon the round.".into());
                }
                self.paused = false;
                self.pause_reason = None;
            }
            "abandon" => {
                self.require_host(actor)?;
                self.require_phase(&[
                    "rule_reveal",
                    "topic_voting",
                    "topic_results",
                    "topic_chosen",
                    "draw",
                    "roles",
                    "discussion",
                    "voting",
                    "runoff",
                ])?;
                self.to_lobby();
            }
            "skip_round" => {
                self.require_host(actor)?;
                self.require_phase(&[
                    "rule_reveal",
                    "topic_voting",
                    "topic_chosen",
                    "draw",
                    "roles",
                    "discussion",
                    "voting",
                ])?;
                let next = self
                    .round
                    .id
                    .checked_add(1)
                    .ok_or("Create a new party to continue.")?;
                let enabled = action
                    .value
                    .as_bool()
                    .ok_or("Choose whether to use random rules.")?;
                if self.deck.random_rules != enabled {
                    self.deck.random_rules = enabled;
                    self.deck.revision += 1;
                }
                let same_roster = self.same_connected_roster();
                let id = self.round.id;
                self.round = Round {
                    id,
                    ..Default::default()
                };
                self.to_lobby();
                self.replacement = true;
                self.restart_notice = Some("Round skipped. Scores are unchanged.");
                let started = same_roster && self.kickoff(false).is_ok();
                if !started {
                    self.round.id = next;
                }
            }
            "open_reports" => {
                self.require_host(actor)?;
                self.require_phase(&["results"])?;
                if self.streamlined() {
                    return Err("Reports are available on Results.".into());
                }
                self.phase = "reporting".into();
            }
            "report" => {
                self.require_phase(if self.streamlined() {
                    &["results"]
                } else {
                    &["reporting"]
                })?;
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
                if !self.streamlined() && self.round.reports.len() == self.round.roster.len() {
                    self.finish_reports();
                }
            }
            "punish" => {
                self.require_host(actor)?;
                self.require_phase(if self.streamlined() {
                    &["results"]
                } else {
                    &["reporting"]
                })?;
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
                // A host can skip anyone, so a delayed tap must identify the turn it was made on.
                if actor == self.host && action.kind == "skip" {
                    self.require_punishment_turn(&action.value)?;
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
                self.require_punishment_turn(&action.value)?;
                if self.round.choice.as_deref() != Some("dare") {
                    return Err("There is no dare giver to replace.".into());
                }
                let recipient = self.round.queue.get(self.round.turn).unwrap();
                let choices: Vec<_> = self
                    .active()
                    .iter()
                    .filter(|p| {
                        p.connected
                            && &p.id != recipient
                            && self.round.giver.as_ref() != Some(&p.id)
                    })
                    .map(|p| p.id.clone())
                    .collect();
                let giver = choices
                    .choose(&mut rand::thread_rng())
                    .cloned()
                    .ok_or("Wait for another player to reconnect, or skip this turn.")?;
                self.round.giver = Some(giver);
            }
            "next" | "setup" => {
                self.require_host(actor)?;
                self.require_phase(&["rankings"])?;
                self.restart_notice = None;
                if self.streamlined() && action.kind == "next" {
                    if !self.same_connected_roster() {
                        self.restart_notice =
                            Some("Confirm everyone is connected and ready for the next round.");
                    } else if self.kickoff(false).is_ok() {
                        self.processed.insert(format!("{actor}:{}", action.id));
                        self.revision += 1;
                        return Ok(());
                    } else {
                        self.restart_notice = Some(NO_FRESH_TOPICS);
                    }
                }
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
                self.rule_turns.clear();
                self.last_rule = None;
            }
            "leave" => {
                if actor == self.host {
                    return Err("Use End party to leave as host.".into());
                }
                let p = self.players.iter_mut().find(|p| p.id == actor).unwrap();
                p.left = true;
                p.connected = false;
                self.drop_hand(actor);
                self.remove_topic_voter(actor);
                if ["roles", "discussion", "voting", "runoff"].contains(&self.phase.as_str()) {
                    self.paused = true;
                    self.pause_reason =
                        Some("A player left. Abandon this round to continue.".into());
                }
            }
            "power_cards" => {
                self.require_host(actor)?;
                let on = action.value.as_bool().ok_or("Set power cards on or off.")?;
                self.power_cards(on)?;
            }
            "draw" => self.draw_card(actor, true)?,
            "skip_draw" => self.draw_card(actor, false)?,
            "draw_ready" => self.draw_ready(actor)?,
            "deal_now" => {
                self.require_host(actor)?;
                self.deal_now()?;
            }
            "deal_drawn" => {
                self.require_host(actor)?;
                self.deal_drawn()?;
            }
            "play_card" => self.play_card(actor, &action.value)?,
            "change_bet" => self.change_bet(actor, &action.value)?,
            "clue_given" => {
                self.require_host(actor)?;
                self.require_phase(&["discussion"])?;
                self.clue_given(value);
            }
            "last_word" => self.answer_last_word(actor, &action.value)?,
            // Debug builds only (smoke tests): set points and deal named cards.
            #[cfg(debug_assertions)]
            "dev_cards" => {
                self.require_host(actor)?;
                if let Some(points) = action.value.get("points").and_then(Value::as_i64) {
                    for p in &mut self.players {
                        p.points = points as i32;
                    }
                }
                if let Some(give) = action.value.get("give").and_then(Value::as_object) {
                    for (id, ids) in give {
                        for card in ids.as_array().into_iter().flatten().filter_map(Value::as_str) {
                            self.cards.hands.entry(id.clone()).or_default().push(power::Held { id: card.into(), from_round: 0 });
                        }
                    }
                }
            }
            _ => return Err("Unknown party action.".into()),
        }
        self.processed.insert(format!("{actor}:{}", action.id));
        self.revision += 1;
        Ok(())
    }
    pub(crate) fn streamlined(&self) -> bool {
        #[cfg(test)]
        {
            !self.legacy_test_flow
        }
        #[cfg(not(test))]
        {
            true
        }
    }

    fn same_connected_roster(&self) -> bool {
        let active = self.active();
        active.len() >= 3
            && active.len() == self.round.roster.len()
            && active
                .iter()
                .all(|player| player.connected && self.round.roster.contains(&player.id))
    }

    fn kickoff(&mut self, require_ready: bool) -> GameResult<()> {
        let players = self.active();
        if players.len() < 3 {
            return Err("You need at least 3 players to start.".into());
        }
        if players
            .iter()
            .any(|p| (require_ready && !p.ready) || !p.connected)
        {
            return Err("Wait until everyone is connected and ready.".into());
        }
        let roster: Vec<String> = players.iter().map(|p| p.id.clone()).collect();
        let random = self.deck.random_rules;
        let mut availability = selection::availability(&self.topics, &self.deck, random).modes;
        let modes: Vec<_> = availability.keys().copied().collect();
        let rule = self
            .rule_weights(&modes)
            .choose_weighted(&mut rand::thread_rng(), |(_, weight)| *weight)
            .map(|(rule, _)| *rule)
            .map_err(|_| NO_FRESH_TOPICS)?;
        let eligible_targets = availability.remove(&rule).expect("sampled a feasible rule");
        self.round = Round {
            id: self
                .round
                .id
                .checked_add(1)
                .ok_or("Create a new party to continue.")?,
            topic_voters: roster.clone(),
            roster,
            topic_pool: eligible_targets.keys().cloned().collect(),
            eligible_targets,
            rule: Some(rule),
            random_at_start: random,
            deck_revision: self.deck.revision,
            ..Default::default()
        };
        // Charged once the round exists, and only for a genuine choice, so
        // fixed-Classic rounds never bias the draw when random rules return.
        if modes.len() > 1 {
            self.record_rule(rule);
        }
        for p in &mut self.players {
            p.earned = 0;
        }
        self.phase = if random || self.replacement {
            "rule_reveal"
        } else {
            "topic_voting"
        }
        .into();
        if self.streamlined() && self.phase == "rule_reveal" {
            let now = Instant::now();
            self.round.reveal_landed = !random;
            self.round.reveal_at = Some(if random { now + RULE_SHUFFLE } else { now });
        }
        self.replacement = false;
        self.session_started = true;
        self.processed.clear();
        Ok(())
    }

    /// The host loop deals once the chosen topic has had its moment on screen.
    pub(crate) fn topic_held(&self, now: Instant) -> bool {
        self.phase == "topic_chosen" && self.round.topic_chosen_at.is_none_or(|at| now >= at + TOPIC_HOLD)
    }

    pub(crate) fn advance_reveals(&mut self, now: Instant) {
        self.advance_cards(now);
        let Some(at) = self.round.reveal_at else {
            return;
        };
        if self.phase == "rule_reveal" && now >= at + RULE_HOLD {
            self.phase = "topic_voting".into();
        } else if self.phase == "result_reveal" && now >= at + PERSONAL_BEAT {
            self.phase = "results".into();
        } else if now >= at
            && !self.round.reveal_landed
            && ["rule_reveal", "result_reveal"].contains(&self.phase.as_str())
        {
            self.round.reveal_landed = true;
            self.revision += 1;
            return;
        } else {
            return;
        }
        self.round.reveal_at = None;
        self.revision += 1;
    }

    /// Deals the round: the word, the cast and the speaking order.
    pub(crate) fn deal(&mut self) -> GameResult<()> {
        if self.round.roster.len() < 3 || self.active().iter().any(|p| !p.connected) {
            return Err(
                "Wait until everyone is connected, or remove the missing player.".into(),
            );
        }
        if self.deck.revision != self.round.deck_revision {
            return Err(
                "Word deck changed. Return to the lobby and start a new round.".into(),
            );
        }
        let topic = self
            .round
            .topic
            .as_deref()
            .ok_or("The round needs a chosen topic.")?;
        let mode = self.round.rule.ok_or("The round needs a rule.")?;
        let mut rng = rand::thread_rng();
        let candidate = self
            .round
            .eligible_targets
            .get(topic)
            .and_then(|targets| match &self.round.retry_word_id {
                Some(id) => targets
                    .iter()
                    .find(|candidate| &candidate.word.word_id == id),
                None => targets.choose(&mut rng),
            })
            .ok_or(NO_FRESH_TOPICS)?;
        let deal =
            selection::deal(candidate, &self.deck, &self.id, self.round.id, topic, mode);
        // The Last Word's other choices come from the hint's own group.
        let spares: Vec<String> = candidate.decoys.iter().map(|w| w.word.clone()).collect();
        let cast = {
            let roster = self.round.roster.clone();
            // Above four the decoy word shares the imposter's hint group:
            // Wallet's decoy may talk about keys while the imposter only
            // knows "Pocket". Below that the decoy holds the real word.
            let decoy = if cast::bait_decoy(roster.len()) {
                None
            } else {
                Some(candidate.decoys.choose(&mut rng).copied().ok_or(NO_FRESH_TOPICS)?)
            };
            let roles = cast::assign(&roster, |role, id| self.role_weight(role, id), &mut rng)
                .ok_or("You need at least 3 players to start.")?;
            let clear: Vec<_> = roles
                .iter()
                .filter(|(_, r)| !matches!(r, Role::Imposter | Role::Accomplice | Role::Detective))
                .map(|(id, _)| id.clone())
                .collect();
            Cast {
                cleared: clear.choose(&mut rng).cloned().unwrap_or_default(),
                roles,
                decoy_word: decoy.map(|d| d.word.clone()).unwrap_or_default(),
                decoy_definition: decoy.map(|d| d.definition.clone()).unwrap_or_default(),
            }
        };
        let imposter = cast.holder(Role::Imposter).to_owned();
        let order = speaking_order(&self.round.roster, self.last_starting.as_deref(), &mut rng);
        let starting = order[0].clone();
        self.round.word_id = Some(deal.word.clone());
        self.round.word = candidate.word.word.clone();
        self.round.definition = candidate.word.definition.clone();
        self.round.hint = candidate.hint.into();
        self.deck.deals.push(deal);
        self.deck.revision += 1;
        self.round.eligible_targets.clear();
        // Charge the turn when cards are dealt, including abandoned
        // rounds. Action deduplication prevents retry double-counting.
        self.record_imposter(&imposter);
        self.record_cast(&cast.roles);
        self.round.cast = Some(cast);
        self.round.imposter = imposter;
        self.last_starting = Some(starting.clone());
        self.round.starting = starting;
        self.round.order = order;
        self.round.cards.base_order = self.round.order.clone();
        self.round.cards.spares = spares;
        self.round.clue_turn = 1;
        self.round.deal_error = None;
        self.phase = "roles".into();
        Ok(())
    }
    fn require_punishment_turn(&self, value: &Value) -> GameResult<()> {
        if value.as_u64() != Some((self.round.turn + 1) as u64) {
            return Err("That turn has finished or changed.".into());
        }
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
        self.round.rule = None;
        self.round.eligible_targets.clear();
        self.round.performed.clear();
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
            self.round.topic_chosen_at = Some(Instant::now());
            self.phase = "topic_chosen".into();
        } else if self.streamlined() {
            self.choose_topic(&mut rand::thread_rng());
        } else {
            self.phase = "topic_results".into();
        }
    }
    fn choose_topic(&mut self, rng: &mut impl rand::Rng) {
        // SliceRandom samples each tied topic once, independently of pack size,
        // catalog order, and approvals for lower-scoring topics.
        self.round.topic = self.round.topic_leaders.choose(rng).cloned();
        self.round.topic_chosen_at = Some(Instant::now());
        self.phase = "topic_chosen".into();
    }
    fn remove_topic_voter(&mut self, id: &str) {
        if ![
            "rule_reveal",
            "topic_voting",
            "topic_results",
            "topic_chosen",
        ]
        .contains(&self.phase.as_str())
        {
            return;
        }
        self.round.roster.retain(|p| p != id);
        if self.round.roster.len() < cast::MIN_PLAYERS {
            self.to_lobby();
            return;
        }
        if ["rule_reveal", "topic_voting"].contains(&self.phase.as_str()) {
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
    /// Validates the extra Full Cast ballot fields for the voter's role.
    fn cast_picks(&self, actor: &str, accused: &str, value: &Value) -> GameResult<Option<Picks>> {
        let field = |key: &str| value.get(key).and_then(Value::as_str);
        let (accomplice, decoy) = (field("accomplice_id"), field("decoy_id"));
        let not_yours = || Err("That pick isn't part of your role.".to_string());
        let Some(cast) = &self.round.cast else {
            return if accomplice.or(decoy).is_some() { not_yours() } else { Ok(None) };
        };
        let in_round = |id: &str| id != actor && self.round.roster.iter().any(|p| p == id);
        // Below five there is no accomplice to name and the decoy holds the
        // real word, so the imposter's ballot is a plain vote.
        if cast::bait_decoy(self.round.roster.len()) {
            return if accomplice.or(decoy).is_some() { not_yours() } else { Ok(None) };
        }
        match cast.roles.get(actor) {
            Some(Role::Imposter) => {
                let (Some(a), Some(d)) = (accomplice, decoy) else {
                    return Err("Pick your accomplice and the decoy.".into());
                };
                if !in_round(a) || !in_round(d) || a == d {
                    return Err("Pick two different players.".into());
                }
                Ok(Some(Picks {
                    accomplice: Some(a.into()),
                    decoy: Some(d.into()),
                }))
            }
            Some(Role::Detective) => {
                if decoy.is_some() {
                    return not_yours();
                }
                // Both reads are required; the bet rides on the accomplice pick.
                let Some(a) = accomplice else {
                    return Err("Pick the accomplice too.".into());
                };
                if !in_round(a) || a == accused {
                    return Err("Pick someone other than your imposter pick as the accomplice.".into());
                }
                Ok(Some(Picks {
                    accomplice: Some(a.into()),
                    decoy: None,
                }))
            }
            _ if accomplice.or(decoy).is_some() => not_yours(),
            _ => Ok(None),
        }
    }
    fn score_full_cast(&mut self, escaped: bool, perfect_bluff: bool) {
        let Some(cast) = self.round.cast.clone() else {
            return;
        };
        let picked = |role: Role, pick: fn(&Picks) -> Option<&String>| {
            self.round.picks.get(cast.holder(role)).and_then(pick).map(String::as_str)
        };
        let facts = cast::Facts {
            escaped,
            perfect_bluff,
            accomplice_caught: picked(Role::Detective, |p| p.accomplice.as_ref())
                == Some(cast.holder(Role::Accomplice)),
            decoy_caught: picked(Role::Imposter, |p| p.decoy.as_ref()) == Some(cast.holder(Role::Decoy)),
            pair_named: picked(Role::Imposter, |p| p.accomplice.as_ref())
                == Some(cast.holder(Role::Accomplice)),
            bait_decoy: cast::bait_decoy(self.round.roster.len()),
            // Only ballots that count toward the verdict can bait the Decoy.
            decoy_voted: self.round.original.iter().any(|(voter, target)| {
                target == cast.holder(Role::Decoy)
                    && !(self.streamlined() && voter == &self.round.imposter)
            }),
            decoy_convicted: self.round.accused.as_deref() == Some(cast.holder(Role::Decoy)),
        };
        if self.round.cards.active {
            let settled = self.settle_cards(&facts);
            for p in &mut self.players {
                let Some(score) = settled.scores.get(&p.id) else {
                    continue;
                };
                p.earned = score.total();
                let before = p.points;
                p.points = (p.points + p.earned).max(0);
                let a = score.award;
                self.round.scores.insert(
                    p.id.clone(),
                    ScoreBreakdown {
                        before,
                        base: a.base,
                        bet: a.bet,
                        bluff: a.bluff,
                        bonus: a.bonus,
                        voided: a.voided,
                        cards: score.lines.clone(),
                        after: p.points,
                        ..Default::default()
                    },
                );
                if score.lost {
                    self.round.queue.push(p.id.clone());
                }
            }
            self.round.cast_facts = Some(facts);
            return;
        }
        for p in &mut self.players {
            let Some(&role) = cast.roles.get(&p.id) else {
                continue;
            };
            let correct = self.round.original.get(&p.id) == Some(&self.round.imposter);
            let stake = self.round.stakes.get(&p.id).copied().unwrap_or(0);
            let side_pick = role == Role::Detective && facts.accomplice_caught;
            let award = cast::award(role, &facts, correct, side_pick, stake);
            p.earned = award.total();
            let before = p.points;
            p.points = (p.points + p.earned).max(0);
            self.round.scores.insert(
                p.id.clone(),
                ScoreBreakdown {
                    before,
                    base: award.base,
                    bet: award.bet,
                    bluff: award.bluff,
                    bonus: award.bonus,
                    voided: award.voided,
                    after: p.points,
                    ..Default::default()
                },
            );
            // Each role decides its own loss.
            if award.lost {
                self.round.queue.push(p.id.clone());
            }
        }
        self.round.cast_facts = Some(facts);
    }
    fn resolve(&mut self, runoff: bool) {
        let streamlined = self.streamlined();
        let votes = if runoff {
            &self.round.runoff
        } else {
            &self.round.original
        };
        // The Judge's doubled ballot waits for a room it cannot decide alone;
        // until then they hold the tiebreak and nothing else.
        let judge = self.round.cast.as_ref().map(|c| c.holder(Role::Judge).to_owned());
        let doubled = self.round.roster.len() >= cast::JUDGE_DOUBLE_FROM;
        let mut counts: BTreeMap<String, usize> = BTreeMap::new();
        for (actor, v) in votes {
            if streamlined && actor == &self.round.imposter {
                continue;
            }
            *counts.entry(v.clone()).or_default() +=
                if doubled && judge.as_ref() == Some(actor) { 2 } else { 1 };
        }
        let max = counts.values().copied().max().unwrap_or(0);
        let mut tied: Vec<_> = counts
            .into_iter()
            .filter(|(_, n)| *n == max)
            .map(|(id, _)| id)
            .collect();
        // The Judge breaks a tie only by catching the imposter; any other tie
        // still lets the imposter escape.
        let mut tiebreak = tied.len() > 1
            && tied.contains(&self.round.imposter)
            && judge.and_then(|j| votes.get(&j)) == Some(&self.round.imposter);
        // Power cards: Heavy Vote, Golden Ballot and Pocket Veto change the count.
        if self.round.cards.active && streamlined {
            let t = crate::cards::tally(votes, &self.round.imposter, &self.card_weights());
            tiebreak = t.judge_tiebreak;
            tied = match t.accused {
                Some(id) => vec![id],
                None => vec![String::new(), String::new()],
            };
        }
        if tiebreak {
            tied = vec![self.round.imposter.clone()];
        }
        self.round.judge_tiebreak = tiebreak;
        if !streamlined && tied.len() > 1 && !runoff {
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
        // A caught Imposter holding Last Word picks the real word first.
        if self.last_word_due() {
            self.open_last_word(imposter_escaped, perfect_bluff);
            return;
        }
        self.commit_round(imposter_escaped, perfect_bluff);
    }
    /// Scores a decided round, applies reports, checks the session target and
    /// moves to the results.
    pub(crate) fn commit_round(&mut self, imposter_escaped: bool, perfect_bluff: bool) {
        let streamlined = self.streamlined();
        if streamlined {
            self.round.pre_score_points = self
                .players
                .iter()
                .map(|p| (p.id.clone(), p.points))
                .collect();
        }
        self.score_full_cast(imposter_escaped, perfect_bluff);
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
            let winners = self
                .players
                .iter()
                .filter(|p| p.points == maximum)
                .map(|p| p.id.clone())
                .collect();
            // Cardboard Crown breaks a tie for first.
            self.session_winners = self.crown_winners(winners);
        }
        self.record_story();
        self.cards.rounds += 1;
        self.round.queue.shuffle(&mut rand::thread_rng());
        self.round.committed = true;
        self.phase = if streamlined {
            self.round.reveal_at = Some(Instant::now() + RESULT_BEAT);
            "result_reveal"
        } else {
            "results"
        }
        .into();
    }
    pub fn view(&self, actor: &str) -> Value {
        let me = self.players.iter().find(|p| p.id == actor);
        let staged = self.phase == "result_reveal";
        let now = Instant::now();
        let reveal = self.round.reveal_at.map(|at| {
            let (stage, duration) = match self.phase.as_str() {
                "rule_reveal" if !self.round.reveal_landed => ("shuffle", RULE_SHUFFLE),
                "rule_reveal" => ("rule", RULE_HOLD),
                "result_reveal" if !self.round.reveal_landed => ("suspense", RESULT_BEAT),
                "result_reveal" => ("verdict", PERSONAL_BEAT),
                _ => return Value::Null,
            };
            let deadline = if self.round.reveal_landed { at + duration } else { at };
            json!({"stage":stage,"remaining_ms":deadline.saturating_duration_since(now).as_millis(),"total_ms":duration.as_millis(),"shuffled":self.phase == "rule_reveal" && self.round.random_at_start})
        });
        let escaped = self.round.accused.as_ref() != Some(&self.round.imposter);
        // A right Last Word: the Imposter's side counts as escaped for themselves.
        let side_escaped = escaped || self.round.cards.last_word_right == Some(true);
        let facts = self.round.cast_facts.unwrap_or_default();
        let role_of = |id: &str| self.round.cast.as_ref().and_then(|c| c.roles.get(id).copied());
        let outcome = |id: &str| -> Option<&'static str> {
            match role_of(id) {
                Some(Role::Accomplice) if facts.accomplice_caught => return Some("spotted"),
                Some(Role::Decoy) if facts.decoy_caught => return Some("spotted"),
                // The bait Decoy went too far and took the fall themselves.
                Some(Role::Decoy) if facts.decoy_convicted => return Some("spotted"),
                // The accomplice shares the imposter's fate.
                Some(Role::Accomplice) => return Some(if side_escaped { "escaped" } else { "caught" }),
                _ => {}
            }
            if id == self.round.imposter {
                Some(if side_escaped { "escaped" } else { "caught" })
            } else {
                // A civilian's own ballot decides their result, even on a tie.
                let vote = self.round.original.get(id)?;
                Some(if vote == &self.round.imposter { "correct" } else { "wrong" })
            }
        };
        let delta = |id: &str| self.round.scores.get(id).map(|s| s.after - s.before);
        // The personal beat carries only the viewer's own outcome; everyone
        // else's waits for the recap.
        let verdict = (reveal.as_ref().is_some_and(|v| v["stage"] == "verdict")).then(|| json!({
            "imposter_id":self.round.imposter,"escaped":escaped,"tied":self.round.accused.is_none(),
            "my_outcome":outcome(actor),"my_delta":delta(actor),"my_role":role_of(actor)
        }));
        let outcomes: Vec<Value> = self
            .round
            .roster
            .iter()
            .map(|id| json!({"player_id":id,"outcome":outcome(id),"delta":delta(id)}))
            .collect();
        let visible_points = |p: &Player| {
            self.round
                .pre_score_points
                .get(&p.id)
                .copied()
                .filter(|_| staged)
                .unwrap_or(p.points)
        };
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
        let private_role = roles.then(|| {
            if let Some(cast) = &self.round.cast {
                let role = cast.roles.get(actor).copied();
                return match role {
                    Some(Role::Imposter) => json!({"role":role,"imposter":true,"clue":self.round.hint}),
                    // The bait Decoy holds the real word, so their card is the usual one.
                    Some(Role::Decoy) if !cast.decoy_word.is_empty() => json!({"role":role,"imposter":false,"clue":cast.decoy_word,"definition":cast.decoy_definition}),
                    _ => json!({"role":role,"imposter":false,"clue":self.round.word,"definition":self.round.definition,
                        "imposter_id":(role == Some(Role::Accomplice)).then_some(&self.round.imposter),
                        "cleared_id":(role == Some(Role::Detective)).then_some(&cast.cleared)}),
                };
            }
            if actor == self.round.imposter {
                json!({"imposter":true,"clue":self.round.hint})
            } else {
                json!({"imposter":false,"clue":self.round.word,"definition":self.round.definition})
            }
        });
        let current = self.round.queue.get(self.round.turn);
        let votes = if self.phase == "runoff" {
            &self.round.runoff
        } else {
            &self.round.original
        };
        let eligible: Vec<_> = self
            .players
            .iter()
            .filter(|p| !p.left || visible_points(p) != 0 || self.round.roster.contains(&p.id))
            .collect();
        let host = actor == self.host;
        let deck_status = (host && self.phase == "lobby").then(|| {
            let available = selection::availability(&self.topics, &self.deck, self.deck.random_rules);
            json!({"played":self.deck.deals.iter().rev().take_while(|deal| deal.cycle == self.deck.cycle).count(),
                "reason":available.modes.is_empty().then(|| available.reason())})
        });
        json!({"id":self.id,"name":self.name,"wifi":self.wifi,"phase":self.phase,"revision":self.revision,"round_id":self.round.id,"host_id":self.host,"my_id":actor,"is_host":host,"paused":self.paused,"pause_reason":self.pause_reason,"topics":self.topics,"catalog":content::catalog(),
          "round_rule":self.round.rule,"random_rules":host.then_some(self.deck.random_rules),
          "reveal":reveal,"verdict":verdict,"deal_error":self.round.deal_error,"round_notice":self.restart_notice,
          "rule_change_pending":host && self.round.rule.is_some() && self.deck.random_rules != self.round.random_at_start,
          "deck_status":deck_status,
          "score_session":{"number":self.session_number,"target":self.target_score,"started":self.session_started,"complete":!staged && !self.session_winners.is_empty(),"winner_ids":if staged {&[][..]}else{&self.session_winners}},
          "betting":{"eligible":roles && (self.streamlined() || actor!=self.round.imposter),"max_stake":if roles && (self.streamlined() || actor!=self.round.imposter) {self.max_stake(actor) as i32}else{0},"my_stake":self.round.stakes.get(actor),"original_vote":self.round.original.get(actor),
            "top_payout":if role_of(actor) == Some(Role::Gambler) {5}else{3},"my_picks":self.round.picks.get(actor)},
          "topic_vote":if !self.round.topic_voters.is_empty() && !["lobby","rule_reveal"].contains(&self.phase.as_str()) {Some(json!({
            "my_topics":self.round.topic_ballots.get(actor), "submitted_ids":self.round.topic_ballots.keys().collect::<Vec<_>>(),
            "player_ids":self.round.topic_voters,"available_topics":self.round.topic_pool,
            "counts":if self.phase == "topic_voting" {Value::Null}else{json!(self.round.topic_counts)},
            "leaders":if self.phase == "topic_voting" {vec![]}else{self.round.topic_leaders.clone()},
            "selected_topic":self.round.topic
          }))}else{None},
          "players":eligible.iter().map(|p|json!({"id":p.id,"name":p.name,"ready":p.ready,"connected":p.connected,"left":p.left,"points":visible_points(p),"earned":if results {p.earned}else{0},"report_penalty":if results {self.round.scores.get(&p.id).map(|s|s.penalty).unwrap_or(0)}else{0},"report_round":if results {self.round.report_penalties.get(&p.id)}else{None}})).collect::<Vec<_>>(),
          "private_role":private_role,
          "cards":self.cards_view(actor, results),
          "clue_turn":self.round.clue_turn,"clues":self.round.clues.iter().flat_map(|(player_id, turns)| turns.iter().map(move |(turn, text)| json!({"player_id":player_id,"turn":turn,"text":text}))).collect::<Vec<_>>(),
          "performed":self.round.performed.iter().flat_map(|(player_id, turns)| turns.iter().map(move |turn| json!({"player_id":player_id,"turn":turn}))).collect::<Vec<_>>(),
          "role_ready":self.round.acknowledged.contains(actor),"ready_count":self.round.acknowledged.len(),"starting_id":if self.phase=="discussion" {Some(&self.round.starting)}else{None},"speaking_order":if self.phase=="discussion" {Some(&self.round.order)}else{None},
          "vote_count":votes.len(),"my_vote":votes.get(actor),"candidates":if self.phase=="runoff" {self.round.candidates.clone()}else{vec![]},
          "result":if results {Some(json!({"imposter_id":self.round.imposter,"word":self.round.word,"definition":self.round.definition,"accused_id":self.round.accused,"escaped":self.round.accused.as_ref()!=Some(&self.round.imposter),"my_vote":self.round.original.get(actor),"earned":me.map(|p|p.earned).unwrap_or(0),"was_imposter":actor==self.round.imposter,"last_word":self.round.cards.last_word_right,"report_penalty":self.round.scores.get(actor).map(|s|s.penalty).unwrap_or(0),"report_round":self.round.report_penalties.get(actor),"score":self.round.scores.get(actor),"imposter_bonus":self.round.scores.get(&self.round.imposter).map(|s|s.bluff).unwrap_or(0),"outcomes":outcomes,
            "cast":self.round.cast.as_ref().map(|c| json!({"roles":c.roles,"decoy_word":c.decoy_word,"my_role":c.roles.get(actor),
              "bait_decoy":facts.bait_decoy,"decoy_voted":facts.decoy_voted,
              "accomplice_caught":facts.accomplice_caught,"decoy_caught":facts.decoy_caught,"pair_bonus":facts.pair_bonus(),"judge_tiebreak":self.round.judge_tiebreak}))}))}else{None},
          "reporting":if self.phase=="reporting" || (self.streamlined() && self.phase=="results") {Some(json!({"my_reports":self.round.reports.get(actor),"submitted_count":self.round.reports.len(),"total":self.round.roster.len(),"majority":self.round.roster.len()/2+1,"player_ids":self.round.roster}))}else{None},
          "punishment":if self.phase=="punishment" {Some(json!({"player_id":current,"giver_id":self.round.giver,"choice":self.round.choice,"turn":self.round.turn+1,"total":self.round.queue.len()}))}else{None}})
    }
}

#[cfg(test)]
#[path = "scoring_tests.rs"]
mod scoring_tests;

#[cfg(test)]
#[path = "cast_tests.rs"]
mod cast_tests;

#[cfg(test)]
#[path = "power_tests.rs"]
mod power_tests;

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
        let topic = g
            .round
            .topic_pool
            .iter()
            .find(|topic| topic.as_str() == "food")
            .or_else(|| g.round.topic_pool.first())
            .unwrap()
            .clone();
        for id in g.round.roster.clone() {
            action(g, &id, "topic_vote", json!([topic])).unwrap();
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

    #[test]
    fn a_departure_after_dealing_requires_abandoning_the_round() {
        let mut g = party();
        let host = g.host.clone();
        let departing = g.players[1].id.clone();
        action(&mut g, &departing, "leave", Value::Null).unwrap();
        assert!(g.paused);
        assert!(action(&mut g, &host, "resume", Value::Null).is_err());
        assert!(g.paused);
        action(&mut g, &host, "abandon", Value::Null).unwrap();
        assert_eq!(g.phase, "lobby");
        assert_eq!(g.active().len(), 3);
    }

    #[test]
    fn speaking_order_is_a_fresh_shuffle_that_never_repeats_the_opener() {
        let roster: Vec<String> = (0..6).map(|i| format!("p{i}")).collect();
        let mut rng = rand::thread_rng();
        let mut last: Option<String> = None;
        let mut openers = BTreeMap::new();
        for _ in 0..3000 {
            let order = speaking_order(&roster, last.as_deref(), &mut rng);
            let mut sorted = order.clone();
            sorted.sort();
            assert_eq!(sorted, roster, "every player speaks once");
            assert_ne!(Some(&order[0]), last.as_ref(), "same opener twice in a row");
            *openers.entry(order[0].clone()).or_insert(0) += 1;
            last = Some(order[0].clone());
        }
        // Everyone opens rounds, about a sixth of the time each.
        assert!(openers.values().all(|n| (400..=600).contains(n)), "{openers:?}");
        assert_eq!(speaking_order(&roster[..1], Some("p0"), &mut rng), vec!["p0".to_string()]);
    }

    #[test]
    fn streamlined_catches_at_every_party_size_and_masks_the_score_until_recap() {
        for size in 3..=12 {
            let mut game = Game::new("Round flow", "Alex", "Wi-Fi").unwrap();
            for n in 1..size {
                game.join(&format!("Player {n}")).unwrap();
            }
            for player in &mut game.players {
                player.ready = true;
                player.points = 3;
            }
            let host = game.host.clone();
            action(&mut game, &host, "start", Value::Null).unwrap();
            finish_topics(&mut game);
            game.force_imposter(&host);
            let civilians = game.round.roster[1..].to_vec();
            game.phase = "voting".into();
            assert!(action(
                &mut game,
                &host,
                "vote",
                json!({"player_id":civilians[0],"stake":4})
            )
            .is_err());
            for id in &civilians {
                let ballot = with_picks(&game, id, json!({"player_id":host,"stake":1}));
                action(&mut game, id, "vote", ballot).unwrap();
            }
            assert_eq!(game.phase, "voting");
            let ballot = with_picks(&game, &host, json!({"player_id":civilians[0],"stake":3}));
            action(&mut game, &host, "vote", ballot).unwrap();
            assert_eq!(game.phase, "result_reveal");
            let suspense = game.view(&host);
            assert!(suspense["result"].is_null() && suspense["verdict"].is_null());
            assert_eq!(suspense["players"][0]["points"], 3);
            assert_eq!(suspense["vote_count"], size);
            let at = game.round.reveal_at.unwrap();
            game.advance_reveals(at);
            let verdict = game.view(&host);
            assert_eq!(verdict["verdict"]["escaped"], false);
            assert!(verdict["result"].is_null());
            assert_eq!(verdict["players"][0]["points"], 3);
            assert!(action(&mut game, &host, "skip_round", json!(false)).is_err());
            game.advance_reveals(at + PERSONAL_BEAT);
            assert_eq!(game.view(&host)["result"]["score"]["bet"], -3);
            assert_eq!(game.view(&host)["players"][0]["points"], 0);
            assert_eq!(game.view(&civilians[0])["result"]["score"]["base"], 1);
            assert_eq!(game.view(&civilians[0])["result"]["score"]["bet"], 1);
        }
    }

    #[test]
    fn dummy_vote_does_not_break_a_tie_and_skip_preserves_the_deck_and_scores() {
        let mut game = party();
        let [host, a, b, c]: [String; 4] = game.round.roster.clone().try_into().unwrap();
        game.force_imposter(&host);
        game.players[0].points = 3;
        game.phase = "voting".into();
        for (voter, target, stake) in [(&host, &b, 3), (&a, &host, 0), (&b, &c, 0), (&c, &b, 0)] {
            action(
                &mut game,
                voter,
                "vote",
                json!({"player_id":target,"stake":stake}),
            )
            .unwrap();
        }
        assert!(game.round.accused.is_none());
        let at = game.round.reveal_at.unwrap();
        game.advance_reveals(at);
        assert_eq!(game.view(&host)["verdict"]["tied"], true);
        game.advance_reveals(at + PERSONAL_BEAT);
        assert_eq!(game.round.scores[&host].before, 3);
        assert_eq!(game.round.scores[&host].after, 8);
        assert_eq!(game.round.scores[&a].base, 1);
        action(&mut game, &a, "report", json!([b])).unwrap();
        action(&mut game, &host, "punish", Value::Null).unwrap();
        while game.phase == "punishment" {
            let recipient = game.round.queue[game.round.turn].clone();
            let turn = game.round.turn + 1;
            action(&mut game, &recipient, "skip", json!(turn)).unwrap();
        }
        action(&mut game, &host, "next", Value::Null).unwrap();
        assert_eq!(game.phase, "topic_voting");
        finish_topics(&mut game);
        let played = game.deck.deals.len();
        let old_id = game.round.id;
        game.phase = "voting".into();
        game.pending_reports.insert(a.clone(), old_id - 1);
        action(&mut game, &a, "vote", json!({"player_id":host,"stake":1})).unwrap();
        assert!(action(&mut game, &a, "skip_round", json!(false)).is_err());
        action(&mut game, &host, "skip_round", json!(false)).unwrap();
        assert_eq!(game.round.id, old_id + 1);
        assert_eq!(game.view(&host)["reveal"]["stage"], "rule");
        assert_eq!(game.round.rule, Some(GameMode::Classic));
        assert_eq!(game.deck.deals.len(), played);
        assert_eq!(game.players[0].points, 8);
        assert_eq!(game.players[1].points, 1);
        assert_eq!(game.pending_reports.get(&a), Some(&(old_id - 1)));
        assert!(game.view(&a)["private_role"].is_null());
        assert!(game
            .apply(
                &host,
                &Action {
                    id: "stale".into(),
                    round_id: old_id,
                    kind: "skip_round".into(),
                    value: json!(false)
                }
            )
            .is_err());
        game.advance_reveals(game.round.reveal_at.unwrap() + RULE_HOLD);
        assert_eq!(game.phase, "topic_voting");
    }

    #[test]
    fn each_player_sees_their_own_outcome_before_everyone_elses() {
        let mut game = party();
        let [host, a, b, c]: [String; 4] = game.round.roster.clone().try_into().unwrap();
        game.force_imposter(&host);
        game.phase = "voting".into();
        for (voter, target) in [(&a, &host), (&b, &host), (&c, &a), (&host, &b)] {
            action(&mut game, voter, "vote", json!(target)).unwrap();
        }
        let at = game.round.reveal_at.unwrap();
        game.advance_reveals(at);

        // The personal beat: each phone holds only its own result.
        let mine = |game: &Game, id: &str| game.view(id)["verdict"].clone();
        assert_eq!(mine(&game, &a)["my_outcome"], "correct");
        assert_eq!(mine(&game, &a)["my_delta"], 1);
        assert_eq!(mine(&game, &c)["my_outcome"], "wrong");
        assert_eq!(mine(&game, &c)["my_delta"], 0);
        assert_eq!(mine(&game, &host)["my_outcome"], "caught");
        for id in [&host, &a, &b, &c] {
            let view = game.view(id);
            assert!(view["result"].is_null(), "everyone's results leaked early");
            assert!(view["verdict"].get("outcomes").is_none());
        }

        // A beat later the whole room's results open, in roster order.
        game.advance_reveals(at + RESULT_BEAT);
        assert_eq!(game.phase, "result_reveal", "the personal beat ended too soon");
        game.advance_reveals(at + PERSONAL_BEAT);
        assert_eq!(game.phase, "results");
        let outcomes = game.view(&b)["result"]["outcomes"].clone();
        let by_player: BTreeMap<_, _> = outcomes
            .as_array()
            .unwrap()
            .iter()
            .map(|o| (o["player_id"].as_str().unwrap().to_owned(), o.clone()))
            .collect();
        assert_eq!(by_player.len(), 4);
        assert_eq!(by_player[&host]["outcome"], "caught");
        assert_eq!(by_player[&a]["outcome"], "correct");
        assert_eq!(by_player[&b]["outcome"], "correct");
        assert_eq!(by_player[&c]["outcome"], "wrong");
        assert_eq!(by_player[&a]["delta"], 1);
        // Nobody's ballot target or stake is part of the shared recap.
        assert!(by_player.values().all(|o| o.get("vote").is_none() && o.get("stake").is_none()));
    }

    #[test]
    fn escape_stakes_settle_with_the_verdict_and_keep_the_perfect_bluff_bonus() {
        for escaped in [false, true] {
            for stake in 0..=3 {
                let mut game = party();
                let [host, a, b, c]: [String; 4] = game.round.roster.clone().try_into().unwrap();
                game.force_imposter(&host);
                game.players[0].points = stake as i32;
                game.phase = "voting".into();
                assert!(action(&mut game, &host, "vote", json!({"player_id":a,"stake":stake + 1})).is_err());
                let targets = if escaped { [&b, &a, &a] } else { [&host; 3] };
                for (voter, target) in [&a, &b, &c].into_iter().zip(targets) {
                    action(&mut game, voter, "vote", json!(target)).unwrap();
                }
                action(&mut game, &host, "vote", json!({"player_id":b,"stake":stake})).unwrap();
                let score = &game.round.scores[&host];
                assert_eq!(score.base, if escaped { 2 } else { 0 });
                assert_eq!(score.bet, if escaped { stake as i32 } else { -(stake as i32) });
                assert_eq!(score.bluff, i32::from(escaped));
                assert_eq!(score.after, if escaped { 3 + 2 * stake as i32 } else { 0 });
            }
        }
    }

    #[test]
    fn late_reports_stale_votes_and_repeat_fallbacks_each_resolve_once() {
        let moved_on = "The party has moved on. Your screen will update.";
        let mut game = party();
        let [host, a, b, c]: [String; 4] = game.round.roster.clone().try_into().unwrap();
        game.force_imposter(&host);
        game.phase = "voting".into();
        for voter in [&a, &b, &c] {
            action(&mut game, voter, "vote", json!(&host)).unwrap();
        }
        action(&mut game, &host, "vote", json!(&a)).unwrap();
        let at = game.round.reveal_at.unwrap();
        game.advance_reveals(at);
        assert!(action(&mut game, &a, "report", json!([b])).is_err());
        game.advance_reveals(at + PERSONAL_BEAT);
        assert_eq!(game.phase, "results");
        // A report that wins the race to Continue applies; one that loses is refused.
        action(&mut game, &a, "report", json!([b])).unwrap();
        action(&mut game, &host, "punish", Value::Null).unwrap();
        assert_eq!(action(&mut game, &b, "report", json!([a])).unwrap_err(), moved_on);
        assert_eq!(action(&mut game, &host, "punish", Value::Null).unwrap_err(), moved_on);
        assert_eq!(game.round.reports.len(), 1);
        while game.phase == "punishment" {
            let recipient = game.round.queue[game.round.turn].clone();
            let turn = game.round.turn + 1;
            action(&mut game, &recipient, "skip", json!(turn)).unwrap();
        }
        assert_eq!(game.phase, "rankings");

        // Next round falls back to the lobby when the roster is not all connected.
        game.players[1].connected = false;
        action(&mut game, &host, "next", Value::Null).unwrap();
        assert_eq!(game.phase, "lobby");
        assert_eq!(
            game.view(&host)["round_notice"],
            "Confirm everyone is connected and ready for the next round."
        );

        // It also falls back when no rule has a usable topic left.
        game.players[1].connected = true;
        game.phase = "rankings".into();
        let topics = std::mem::take(&mut game.topics);
        action(&mut game, &host, "next", Value::Null).unwrap();
        assert_eq!(game.phase, "lobby");
        assert_eq!(game.view(&host)["round_notice"], NO_FRESH_TOPICS);
        game.topics = topics;

        // The other skip-versus-final-vote order: the last ballot arrives too late.
        for p in &mut game.players {
            p.ready = true;
        }
        action(&mut game, &host, "start", Value::Null).unwrap();
        finish_topics(&mut game);
        let stale_round = game.round.id;
        game.force_imposter(&host);
        game.phase = "voting".into();
        for voter in [&a, &b, &c] {
            action(&mut game, voter, "vote", json!(&host)).unwrap();
        }
        action(&mut game, &host, "skip_round", json!(false)).unwrap();
        assert_eq!(game.round.id, stale_round + 1);
        assert_eq!(
            game.apply(
                &host,
                &Action {
                    id: "late-ballot".into(),
                    round_id: stale_round,
                    kind: "vote".into(),
                    value: json!(&a),
                }
            )
            .unwrap_err(),
            "That action belongs to a different round."
        );
        assert_eq!(game.phase, "rule_reveal");
        assert!(game.round.scores.is_empty());
    }

    #[test]
    fn delayed_host_actions_cannot_skip_or_change_the_next_punishment_turn() {
        let mut g = party();
        let host = g.host.clone();
        let first = g.players[1].id.clone();
        let second = g.players[2].id.clone();
        g.phase = "punishment".into();
        g.round.queue = vec![first.clone(), second.clone()];
        g.round.choice = Some("dare".into());
        action(&mut g, &first, "done", Value::Null).unwrap();
        action(&mut g, &second, "choice", json!("dare")).unwrap();
        let giver = g.round.giver.clone();
        assert!(action(&mut g, &host, "skip", json!(1)).is_err());
        assert!(action(&mut g, &host, "reassign", json!(1)).is_err());
        assert_eq!(g.round.turn, 1);
        assert_eq!(g.round.giver, giver);
        action(&mut g, &host, "reassign", json!(2)).unwrap();
        assert_ne!(g.round.giver, giver);
        action(&mut g, &host, "skip", json!(2)).unwrap();
        assert_eq!(g.phase, "rankings");
    }

    #[test]
    fn nonverbal_rules_stay_fixed_and_performed_markers_follow_their_owner() {
        for wanted in [GameMode::ActIt, GameMode::SoundOnly] {
            let mut game = Game::new("Rules", "Alex", "Wi-Fi").unwrap();
            let host = game.host.clone();
            let guest = game.join("Sam").unwrap().id;
            game.join("Mia").unwrap();
            game.topics = vec!["animals".into()];
            assert!(action(&mut game, &guest, "random_rules", json!(true)).is_err());
            action(&mut game, &host, "random_rules", json!(true)).unwrap();
            for _ in 0..100 {
                for player in &mut game.players {
                    player.ready = true;
                }
                action(&mut game, &host, "start", Value::Null).unwrap();
                assert_eq!(game.phase, "rule_reveal");
                assert_eq!(game.view(&guest)["topic_vote"], Value::Null);
                assert_eq!(game.view(&guest)["private_role"], Value::Null);
                if game.round.rule == Some(wanted) {
                    break;
                }
                action(&mut game, &host, "abandon", Value::Null).unwrap();
            }
            assert_eq!(game.round.rule, Some(wanted));
            assert!(game.deck.deals.is_empty());
            action(&mut game, &host, "random_rules", json!(false)).unwrap();
            assert_eq!(game.round.rule, Some(wanted));
            assert_eq!(game.view(&host)["rule_change_pending"], true);
            assert!(action(&mut game, &guest, "open_topics", Value::Null).is_err());
            assert!(action(&mut game, &host, "open_topics", Value::Null).is_err());
            game.advance_reveals(game.round.reveal_at.unwrap() + RULE_HOLD);
            assert_eq!(game.phase, "topic_voting");
            let roster = game.round.roster.clone();
            for player in &roster {
                action(&mut game, player, "topic_vote", json!(["animals"])).unwrap();
            }
            action(&mut game, &host, "begin_round", Value::Null).unwrap();
            let word = game.round.word_id.as_ref().unwrap();
            let pair = content::bundled_topics()
                .iter()
                .flat_map(|t| &t.words)
                .find(|pair| &pair.word_id == word)
                .unwrap();
            assert!(pair.hint_for_mode(wanted).is_some());
            assert_eq!(game.deck.deals.len(), 1);
            for player in &roster {
                action(&mut game, player, "role_ready", Value::Null).unwrap();
            }
            assert!(action(&mut game, &guest, "clue", json!({"turn":1,"text":"A word"})).is_err());
            assert!(action(
                &mut game,
                &guest,
                "performed",
                json!({"turn":1,"performed":true,"player_id":host})
            )
            .is_err());
            action(
                &mut game,
                &guest,
                "performed",
                json!({"turn":1,"performed":true}),
            )
            .unwrap();
            assert_eq!(
                game.view(&host)["performed"],
                json!([{"turn":1,"player_id":guest}])
            );
            action(&mut game, &host, "next_clue_turn", json!(1)).unwrap();
            assert_eq!(game.round.rule, Some(wanted));
            assert_eq!(game.deck.deals.len(), 1);
            action(&mut game, &host, "open_vote", Value::Null).unwrap();
            assert!(action(
                &mut game,
                &guest,
                "performed",
                json!({"turn":1,"performed":false})
            )
            .is_err());
            action(&mut game, &host, "abandon", Value::Null).unwrap();
            for player in &mut game.players {
                player.ready = true;
            }
            action(&mut game, &host, "start", Value::Null).unwrap();
            assert_eq!(game.phase, "topic_voting");
            assert_eq!(game.round.rule, Some(GameMode::Classic));
        }
    }
    /// Adds the picks a role owes with its ballot from five players up.
    fn with_picks(g: &Game, voter: &str, mut value: Value) -> Value {
        let Some(cast) = &g.round.cast else { return value };
        let others: Vec<String> = g
            .round
            .roster
            .iter()
            .filter(|p| p.as_str() != voter)
            .cloned()
            .collect();
        match cast.roles.get(voter) {
            Some(Role::Imposter) if !cast::bait_decoy(g.round.roster.len()) => {
                value["accomplice_id"] = json!(others[0]);
                value["decoy_id"] = json!(others[1]);
            }
            Some(Role::Detective) => {
                let accused = value["player_id"].as_str().unwrap_or_default().to_string();
                value["accomplice_id"] = json!(others.iter().find(|p| **p != accused).unwrap());
            }
            _ => {}
        }
        value
    }
    fn ballots(g: &mut Game, targets: [usize; 4]) {
        g.phase = "voting".into();
        let second = g.players[1].id.clone();
                g.force_imposter(&second);
        for (i, t) in targets.iter().enumerate() {
            let id = g.players[i].id.clone();
            let v = g.players[*t].id.clone();
            action(g, &id, "vote", json!(v)).unwrap();
        }
        settle(g);
    }
    // The host schedules both Results beats; tests stand in for that scheduler.
    fn settle(g: &mut Game) {
        if let Some(at) = g.round.reveal_at {
            g.advance_reveals(at);
            g.advance_reveals(at + PERSONAL_BEAT);
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
    fn weighted_rule_draw_spreads_the_rules_and_never_excludes_one() {
        let feasible = GameMode::ALL.to_vec();
        let mut g = party();

        // A rule that has just aired is the least likely of equals.
        g.record_rule(GameMode::SoundOnly);
        let weights: BTreeMap<_, _> = g.rule_weights(&feasible).into_iter().collect();
        assert!(weights[&GameMode::SoundOnly] < weights[&GameMode::Classic]);
        // An unplayed rule sits level with the least aired one, not above it.
        assert_eq!(weights[&GameMode::Classic], weights[&GameMode::ActIt]);

        // A rule aired far more often keeps real but much lower odds.
        g.rule_turns.insert(GameMode::Classic, 5);
        let weights: BTreeMap<_, _> = g.rule_weights(&feasible).into_iter().collect();
        assert!(weights[&GameMode::Classic] > 0.0);
        assert!(weights[&GameMode::Classic] * 10.0 < weights[&GameMode::ActIt]);

        // Over a long party every rule airs, and no rule runs away with it.
        g.rule_turns.clear();
        g.last_rule = None;
        let mut repeats = 0;
        for _ in 0..600 {
            let previous = g.last_rule;
            g.to_lobby();
            for player in &mut g.players {
                player.ready = true;
            }
            g.deck.random_rules = true;
            g.kickoff(false).unwrap();
            let rule = g.round.rule.unwrap();
            if previous == Some(rule) {
                repeats += 1;
            }
        }
        let counts: Vec<_> = GameMode::ALL
            .iter()
            .map(|rule| g.rule_turns.get(rule).copied().unwrap_or(0))
            .collect();
        assert_eq!(counts.iter().sum::<u64>(), 600);
        assert!(counts.iter().all(|n| *n > 0), "a rule never aired: {counts:?}");
        // Uniform draws would land near 100 each; weighting tightens the spread.
        assert!(
            counts.iter().max().unwrap() - counts.iter().min().unwrap() < 40,
            "rules drifted apart: {counts:?}"
        );
        // Back-to-back repeats stay possible, just rarer than a uniform 1 in 6.
        assert!(repeats < 60, "the same rule kept appearing: {repeats}");
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
    // Reports live on Results now, so this only waits out the verdict beat.
    fn open_reports(g: &mut Game) {
        settle(g);
        assert_eq!(g.phase, "results");
    }
    fn next_round(g: &mut Game) {
        let host = g.host.clone();
        if g.phase == "results" {
            action(g, &host, "punish", Value::Null).unwrap();
        }
        while g.phase == "punishment" {
            let turn = g.round.turn;
            let recipient = g.round.queue[turn].clone();
            action(g, &recipient, "skip", json!(turn + 1)).unwrap();
        }
        action(g, &host, "next", Value::Null).unwrap();
        // Next round restarts in place unless validation sent us to the lobby.
        if g.phase == "lobby" {
            let ids = g.active().iter().map(|p| p.id.clone()).collect::<Vec<_>>();
            for id in ids {
                action(g, &id, "ready", json!(true)).unwrap();
            }
            action(g, &host, "start", Value::Null).unwrap();
        }
        finish_topics(g);
    }
    #[test]
    fn reports_allow_multiple_targets_and_apply_once_after_next_scoring() {
        let mut g = party();
        ballots(&mut g, [2, 0, 1, 2]);
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
        // Continue closes reporting; a full set of ballots no longer self-closes.
        assert_eq!(g.phase, "results");
        action(&mut g, &ids[0], "punish", Value::Null).unwrap();
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
        ballots(&mut g, [2, 0, 1, 2]);
        assert_eq!(
            g.players.iter().map(|p| p.points).collect::<Vec<_>>(),
            vec![0, 4, 3, 0]
        );
        let view = g.view(&ids[2]);
        assert_eq!(view["result"]["earned"], 2);
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
                let second = g.players[1].id.clone();
                g.force_imposter(&second);
                let ids = g.players.iter().map(|p| p.id.clone()).collect::<Vec<_>>();
                for (i, id) in ids.iter().enumerate() {
                    let ballot = json!({"player_id": ids[if i == 1 { 0 } else { 1 }], "stake": 0});
                    let ballot = with_picks(&g, id, ballot);
                    action(&mut g, id, "vote", ballot).unwrap();
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
        action(&mut g, &ids[0], "punish", Value::Null).unwrap();
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
                    assert!(view["private_role"].get("definition").is_none());
                    assert!(!view.to_string().contains(&format!("\"{}\"", g.round.word)));
                    assert!(!view.to_string().contains(&g.round.definition));
                } else {
                    assert_eq!(view["private_role"]["definition"], g.round.definition);
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
    fn results_reveal_the_same_definition_to_every_player() {
        let mut g = party();
        assert!(!g.round.definition.is_empty());
        assert!(g.view(&g.host)["catalog"]
            .as_array()
            .unwrap()
            .iter()
            .all(|topic| topic.get("words").is_none()));
        ballots(&mut g, [1, 0, 1, 1]);
        assert_eq!(g.phase, "results");
        for player in &g.players {
            let view = g.view(&player.id);
            assert!(view["private_role"].is_null());
            assert_eq!(view["result"]["word"], g.round.word);
            assert_eq!(view["result"]["definition"], g.round.definition);
        }
    }
    #[test]
    fn escaping_imposter_and_correct_civilian_both_score() {
        let mut g = party();
        // Two ballots land on the Judge, so the imposter walks even though the
        // Judge read them right: +2 for the Judge, +2 for the escape.
        ballots(&mut g, [2, 0, 1, 2]);
        assert_eq!(g.phase, "results");
        assert_eq!(
            g.players.iter().map(|p| p.points).collect::<Vec<_>>(),
            vec![0, 2, 2, 0]
        );
        assert_eq!(g.round.queue.len(), 2);
    }
    #[test]
    fn caught_imposter_gets_zero_and_wrong_voters_lose() {
        let mut g = party();
        ballots(&mut g, [1, 0, 1, 2]);
        assert_eq!(
            g.players.iter().map(|p| p.points).collect::<Vec<_>>(),
            vec![1, 0, 2, 0] // The Judge's correct vote pays two.
        );
    }
    #[test]
    fn repeated_tie_escapes_original_ballots_score_once() {
        let mut g = party();
        // ponytail: the shipped flow gives a tie to the imposter and never
        // enters a runoff. Delete this with the runoff code.
        g.legacy_test_flow = true;
        g.phase = "voting".into();
        let second = g.players[1].id.clone();
        g.force_imposter(&second);
        // The Judge's tiebreak would settle this before a runoff, so hand the
        // seat to a player whose ballot does not name the imposter.
        if let Some(cast) = &mut g.round.cast {
            let (third, fourth) = (g.players[2].id.clone(), g.players[3].id.clone());
            cast.roles.insert(third, Role::Decoy);
            cast.roles.insert(fourth, Role::Judge);
        }
        for (i, t) in [1, 0, 1, 0].iter().enumerate() {
            let id = g.players[i].id.clone();
            let v = g.players[*t].id.clone();
            action(&mut g, &id, "vote", json!(v)).unwrap();
        }
        settle(&mut g);
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
        assert_eq!(g.phase, "topic_chosen");
        // The chosen topic gets its moment before the host loop deals.
        let now = Instant::now();
        assert!(!g.topic_held(now), "the topic reveal is not cut short");
        assert!(g.topic_held(now + TOPIC_HOLD));
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
        let selected = g.round.topic.clone();
        assert!(selected.is_some());
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
