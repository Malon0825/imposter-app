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
    pub points: u32,
    pub earned: u32,
}
#[derive(Clone, Debug, Default)]
pub struct Round {
    pub id: u32,
    pub roster: Vec<String>,
    pub imposter: String,
    pub word: String,
    pub hint: String,
    pub starting: String,
    pub acknowledged: HashSet<String>,
    pub original: BTreeMap<String, String>,
    pub runoff: BTreeMap<String, String>,
    pub candidates: Vec<String>,
    pub accused: Option<String>,
    pub committed: bool,
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
            topics: vec!["everyday".into(), "animals".into()],
            round: Round::default(),
            paused: false,
            pause_reason: None,
            used: HashSet::new(),
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
                self.require_phase(&["lobby"])?;
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
                let catalog: Vec<_> = content::topics()
                    .into_iter()
                    .filter(|t| self.topics.contains(&t.id))
                    .collect();
                let mut rng = rand::thread_rng();
                let topic = catalog.choose(&mut rng).ok_or("Choose a topic first.")?;
                let mut words: Vec<_> = topic
                    .words
                    .iter()
                    .filter(|w| !self.used.contains(&w.word))
                    .collect();
                if words.is_empty() {
                    for w in &topic.words {
                        self.used.remove(&w.word);
                    }
                    words = topic.words.iter().collect();
                }
                let pair = words.choose(&mut rng).ok_or("This topic has no words.")?;
                let imposter = roster.choose(&mut rng).unwrap().clone();
                let starting = roster.choose(&mut rng).unwrap().clone();
                self.used.insert(pair.word.clone());
                self.round = Round {
                    id: self.round.id + 1,
                    roster,
                    imposter,
                    word: pair.word.clone(),
                    hint: pair.hint.clone(),
                    starting,
                    ..Default::default()
                };
                for p in &mut self.players {
                    p.earned = 0;
                }
                self.phase = "roles".into();
                self.processed.clear();
            }
            "role_ready" => {
                self.require_phase(&["roles"])?;
                self.round.acknowledged.insert(actor.into());
                if self.round.acknowledged.len() == self.round.roster.len() {
                    self.phase = "discussion".into();
                }
            }
            "open_vote" => {
                self.require_host(actor)?;
                self.require_phase(&["discussion"])?;
                self.phase = "voting".into();
            }
            "vote" => {
                self.require_phase(&["voting", "runoff"])?;
                if value == actor || !self.round.roster.contains(&value.to_string()) {
                    return Err("Choose another player.".into());
                }
                let is_runoff = self.phase == "runoff";
                if is_runoff && !self.round.candidates.contains(&value.into()) {
                    return Err("Choose one of the tied suspects.".into());
                }
                let votes = if is_runoff {
                    &mut self.round.runoff
                } else {
                    &mut self.round.original
                };
                if votes.contains_key(actor) {
                    return Err("Your vote is already locked.".into());
                }
                votes.insert(actor.into(), value.into());
                if votes.len() == self.round.roster.len() {
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
                self.require_phase(&["roles", "discussion", "voting", "runoff"])?;
                self.to_lobby();
            }
            "punish" => {
                self.require_host(actor)?;
                self.require_phase(&["results"])?;
                self.phase = if self.round.queue.is_empty() {
                    "rankings"
                } else {
                    "punishment"
                }
                .into();
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
                    self.phase = "rankings".into();
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
            }
            "leave" => {
                if actor == self.host {
                    return Err("Use End party to leave as host.".into());
                }
                let p = self.players.iter_mut().find(|p| p.id == actor).unwrap();
                p.left = true;
                p.connected = false;
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
        for p in &mut self.players {
            p.ready = p.id == self.host;
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
        for p in &mut self.players {
            if !self.round.roster.contains(&p.id) {
                continue;
            }
            p.earned = if p.id == self.round.imposter {
                if imposter_escaped {
                    2
                } else {
                    0
                }
            } else if self.round.original.get(&p.id) == Some(&self.round.imposter) {
                1
            } else {
                0
            };
            p.points += p.earned;
            if p.earned == 0 {
                self.round.queue.push(p.id.clone());
            }
        }
        self.round.queue.shuffle(&mut rand::thread_rng());
        self.round.committed = true;
        self.phase = "results".into();
    }
    pub fn view(&self, actor: &str) -> Value {
        let me = self.players.iter().find(|p| p.id == actor);
        let results = self.round.committed
            && ["results", "punishment", "rankings", "ended"].contains(&self.phase.as_str());
        let roles = self.phase == "roles" && self.round.roster.contains(&actor.to_string());
        let current = self.round.queue.get(self.round.turn);
        let votes = if self.phase == "runoff" {
            &self.round.runoff
        } else {
            &self.round.original
        };
        let eligible: Vec<_> = self
            .players
            .iter()
            .filter(|p| !p.left || p.points > 0 || self.round.roster.contains(&p.id))
            .collect();
        json!({"id":self.id,"name":self.name,"wifi":self.wifi,"phase":self.phase,"revision":self.revision,"round_id":self.round.id,"host_id":self.host,"my_id":actor,"is_host":actor==self.host,"paused":self.paused,"pause_reason":self.pause_reason,"topics":self.topics,"catalog":content::catalog(),
          "players":eligible.iter().map(|p|json!({"id":p.id,"name":p.name,"ready":p.ready,"connected":p.connected,"left":p.left,"points":p.points,"earned":if results {p.earned}else{0}})).collect::<Vec<_>>(),
          "private_role":if roles {Some(json!({"imposter":actor==self.round.imposter,"clue":if actor==self.round.imposter {&self.round.hint}else{&self.round.word}}))}else{None},
          "role_ready":self.round.acknowledged.contains(actor),"ready_count":self.round.acknowledged.len(),"starting_id":if self.phase=="discussion" {Some(&self.round.starting)}else{None},
          "vote_count":votes.len(),"my_vote":votes.get(actor),"candidates":if self.phase=="runoff" {self.round.candidates.clone()}else{vec![]},
          "result":if results {Some(json!({"imposter_id":self.round.imposter,"word":self.round.word,"accused_id":self.round.accused,"escaped":self.round.accused.as_ref()!=Some(&self.round.imposter),"my_vote":self.round.original.get(actor),"earned":me.map(|p|p.earned).unwrap_or(0),"was_imposter":actor==self.round.imposter}))}else{None},
          "punishment":if self.phase=="punishment" {Some(json!({"player_id":current,"giver_id":self.round.giver,"choice":self.round.choice,"turn":self.round.turn+1,"total":self.round.queue.len()}))}else{None}})
    }
}

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
    fn secret_views_never_include_other_roles_or_word() {
        let g = party();
        let view = g.view(&g.round.imposter).to_string();
        assert!(!view.contains(&format!("\"{}\"", g.round.word)));
        assert!(view.contains(&g.round.hint));
        let mut g = g;
        g.phase = "discussion".into();
        assert!(g.view(&g.host)["private_role"].is_null());
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
    #[test]
    fn bundled_content_has_unique_pairs_and_no_empty_hints() {
        let packs = content::topics();
        assert_eq!(packs.len(), 22);
        for t in packs {
            assert!(t.words.len() >= 10);
            for w in t.words {
                assert!(!w.hint.trim().is_empty());
                assert_ne!(w.word.to_lowercase(), w.hint.to_lowercase());
            }
        }
    }
}
