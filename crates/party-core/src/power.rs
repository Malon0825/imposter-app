//! Power cards inside a round: the session's hands, the draw window, card
//! plays and their effects, ballot cards, Cold Feet, the Last Word, scoring
//! through `cards::settle`, and what each phone sees. A child of `game`, so
//! it works on the game's own state; the rules themselves live in `cards`.
use super::*;
use crate::cards::{self, Kind, Play, Target, Tier, Verdict, Window};
use std::collections::BTreeSet;

/// How long a caught Imposter has to pick the real word.
pub(crate) const LAST_WORD_WINDOW: Duration = Duration::from_secs(20);

#[derive(Clone, Debug)]
pub(crate) struct Held {
    pub id: String,
    /// The first round it can be played: a Reshuffle's new card waits a round.
    pub from_round: u32,
}

/// Lives for a score session: hands, odds, paid draws, the deck and the Bounty.
#[derive(Clone, Debug, Default)]
pub(crate) struct CardSession {
    pub on: bool,
    pub deck: Option<cards::Deck>,
    pub hands: BTreeMap<String, Vec<Held>>,
    pub chance: BTreeMap<String, u32>,
    pub paid: BTreeMap<String, u32>,
    pub bounty: cards::Bounty,
    /// Players carrying a Rain Check into their next round.
    pub rain: BTreeSet<String>,
    /// Rounds scored this session (Underdogs start in round 3).
    pub rounds: u32,
    /// Every card played this session, for the Story of the night.
    pub story: Vec<Value>,
    /// Points each player earned while an Underdog (the comeback headline).
    pub comeback: BTreeMap<String, i32>,
}

#[derive(Clone, Debug)]
pub(crate) struct PlayRec {
    pub play: Play,
    /// The tier every phone was told (a Bluff Card's is fake).
    pub shown: Tier,
    pub claim: Option<Role>,
    /// What the owner privately learned, shown only on their phone.
    pub read: Value,
    pub verdict: Option<Verdict>,
}

/// A clash verdict, shown on every phone as a stamp.
#[derive(Clone, Debug, Serialize)]
pub(crate) struct Stamp {
    pub verdict: Verdict,
    /// Whose card stopped the other (Lawyer Up's or Objection's owner).
    pub by: Option<String>,
    /// Whose card was stopped or let through.
    pub on: Option<String>,
    /// A sustained Objection exposed a Bluff Card.
    pub bluff: bool,
}

#[derive(Clone, Debug)]
pub(crate) struct LastWord {
    pub options: Vec<String>,
    pub until: Instant,
    pub escaped: bool,
    pub perfect_bluff: bool,
}

/// Lives for one round.
#[derive(Clone, Debug, Default)]
pub(crate) struct CardRound {
    /// Power cards are on and the round has at least six players.
    pub active: bool,
    pub opened: bool,
    /// Players done with their card: they skipped, or drew and tapped
    /// Continue. Roles don't wait for this, only for everyone to decide; a
    /// drawer still looking at their card follows the table when they're done.
    pub ready: BTreeSet<String>,
    /// Who decided in the draw window: Some(card) drew it, None skipped.
    pub decided: BTreeMap<String, Option<String>>,
    pub leaders: BTreeSet<String>,
    pub underdogs: BTreeSet<String>,
    pub plays: Vec<PlayRec>,
    pub stamps: Vec<Stamp>,
    pub base_order: Vec<String>,
    pub openers: Vec<String>,
    pub lates: Vec<String>,
    /// Put on the Spot: players who still owe a clue.
    pub owed: BTreeSet<String>,
    /// Lawyer Up: owner and the seq it was played at.
    pub lawyered: BTreeMap<String, u32>,
    pub heavy: BTreeSet<String>,
    pub golden: BTreeSet<String>,
    pub vetoed: BTreeSet<String>,
    /// Cold Feet holders who may still change their bet once.
    pub cold_feet: BTreeSet<String>,
    pub voting_opened: bool,
    /// Other words from the hint's group, for the Last Word's three choices.
    pub spares: Vec<String>,
    pub last_word: Option<LastWord>,
    /// The Last Word's answer: whether the Imposter picked the real word.
    pub last_word_right: Option<bool>,
}

fn side(role: Option<Role>) -> &'static str {
    if matches!(role, Some(Role::Imposter | Role::Accomplice)) {
        "imposter"
    } else {
        "civilian"
    }
}

impl Game {
    fn role_in_round(&self, id: &str) -> Option<Role> {
        self.round.cast.as_ref().and_then(|c| c.roles.get(id).copied())
    }

    fn points_of(&self, id: &str) -> i32 {
        self.players.iter().find(|p| p.id == id).map(|p| p.points).unwrap_or(0)
    }

    fn deck_mut(&mut self) -> &mut cards::Deck {
        self.cards.deck.get_or_insert_with(|| cards::Deck::new(&mut rand::thread_rng()))
    }

    fn chance(&self, id: &str) -> u32 {
        self.cards.chance.get(id).copied().unwrap_or(cards::GOLDEN_BASE)
    }

    pub(crate) fn power_cards(&mut self, on: bool) -> GameResult<()> {
        if self.phase == "ended" {
            return Err("The party has ended.".into());
        }
        // Applies from the next round, like random rules.
        self.cards.on = on;
        Ok(())
    }

    /// A fresh score session clears hands, returns the Golden cards and
    /// resets everyone's odds. Power cards stay on or off.
    pub(crate) fn reset_card_session(&mut self) {
        self.cards = CardSession { on: self.cards.on, ..Default::default() };
    }

    /// A player who leaves puts their hand back in the deck.
    pub(crate) fn drop_hand(&mut self, id: &str) {
        if let Some(hand) = self.cards.hands.remove(id) {
            for held in hand {
                self.deck_mut().give_back(&held.id);
            }
        }
    }

    /// Run as the host begins the round: decides whether cards play this
    /// round, snapshots leaders, Underdogs and the Bounty, and opens the draw
    /// window if anyone can draw. Returns true when the draw window opened.
    pub(crate) fn open_draw(&mut self) -> bool {
        if self.round.cards.opened {
            return false;
        }
        let active = self.cards.on && self.round.roster.len() >= cards::MIN_PLAYERS;
        self.round.cards = CardRound { active, opened: true, ..Default::default() };
        if !active {
            return false;
        }
        let scores: BTreeMap<String, i32> =
            self.round.roster.iter().map(|id| (id.clone(), self.points_of(id))).collect();
        let leaders = cards::leaders(&scores);
        let underdogs = cards::underdogs(&scores, self.target_score, self.cards.rounds + 1);
        for id in &leaders {
            let next = cards::chance_after_lead(self.chance(id));
            self.cards.chance.insert(id.clone(), next);
        }
        self.round.cards.leaders = leaders;
        self.round.cards.underdogs = underdogs;
        let anyone = self.round.roster.iter().any(|id| self.draw_price(id).is_some());
        if anyone {
            self.phase = "draw".into();
        }
        anyone
    }

    /// What a draw costs this player now, or None if they can't draw.
    fn draw_price(&self, id: &str) -> Option<i32> {
        if self.round.cards.underdogs.contains(id) {
            return Some(0);
        }
        let paid = self.cards.paid.get(id).copied().unwrap_or(0);
        (paid < cards::PAID_DRAWS && self.points_of(id) >= cards::PRICE).then_some(cards::PRICE)
    }

    /// Draws a card into a hand at this player's odds; returns its id.
    fn draw_into_hand(&mut self, id: &str, from_round: u32) -> Option<String> {
        let held: Vec<String> = self.cards.hands.get(id).map(|h| h.iter().map(|c| c.id.clone()).collect()).unwrap_or_default();
        let mut rng = rand::thread_rng();
        let rolled = cards::roll_tier(self.chance(id), &mut rng);
        let (card, tier) = self.deck_mut().draw(rolled, &held, &mut rng)?;
        let next = cards::chance_after_draw(self.chance(id), tier);
        self.cards.chance.insert(id.into(), next);
        self.cards.hands.entry(id.into()).or_default().push(Held { id: card.clone(), from_round });
        Some(card)
    }

    pub(crate) fn draw_card(&mut self, actor: &str, draw: bool) -> GameResult<()> {
        self.require_phase(&["draw"])?;
        if !self.round.roster.iter().any(|id| id == actor) {
            return Err("You did not play in this round.".into());
        }
        if self.round.cards.decided.contains_key(actor) {
            return Err("You already decided this round.".into());
        }
        if !draw {
            self.round.cards.decided.insert(actor.into(), None);
            self.round.cards.ready.insert(actor.into());
            return Ok(());
        }
        let price = self.draw_price(actor).ok_or("You can’t draw right now.")?;
        let card = self.draw_into_hand(actor, self.round.id).ok_or("The deck is empty.")?;
        if price > 0 {
            if let Some(p) = self.players.iter_mut().find(|p| p.id == actor) {
                p.points -= price;
            }
            *self.cards.paid.entry(actor.into()).or_default() += 1;
        }
        self.round.cards.decided.insert(actor.into(), Some(card));
        Ok(())
    }

    /// After drawing, a player takes their time with the card, then taps
    /// Continue, even if the table has already moved on to roles.
    pub(crate) fn draw_ready(&mut self, actor: &str) -> GameResult<()> {
        self.require_phase(&["draw", "roles"])?;
        if !self.round.cards.decided.contains_key(actor) {
            return Err("Draw or skip first.".into());
        }
        self.round.cards.ready.insert(actor.into());
        Ok(())
    }

    /// The host's way past someone who wandered off: whoever hasn't decided
    /// skips, and roles are dealt.
    pub(crate) fn deal_now(&mut self) -> GameResult<()> {
        self.require_phase(&["draw"])?;
        for id in self.round.roster.clone() {
            self.round.cards.decided.entry(id.clone()).or_insert(None);
            self.round.cards.ready.insert(id);
        }
        Ok(())
    }

    /// The host loop deals once every player has drawn or skipped. There is
    /// no timer, and nobody waits for a drawer who is still reading their card.
    pub(crate) fn draw_done(&self, _now: Instant) -> bool {
        self.phase == "draw" && self.round.roster.iter().all(|id| self.round.cards.decided.contains_key(id))
    }

    fn played_by(&self, id: &str) -> Option<&PlayRec> {
        self.round.cards.plays.iter().find(|p| p.play.owner == id)
    }

    fn holds(&self, id: &str, card: &str) -> bool {
        self.cards.hands.get(id).is_some_and(|h| h.iter().any(|c| c.id == card))
    }

    /// Why this player can't play this held card right now, or Ok. The
    /// screen and the server share this, so they never disagree.
    pub(crate) fn playable(&self, actor: &str, card_id: &str) -> Result<(), &'static str> {
        let round = &self.round.cards;
        if !round.active {
            return Err("Power cards are paused this round.");
        }
        let card = cards::card(card_id).ok_or("Unknown card.")?;
        let held = self.cards.hands.get(actor).and_then(|h| h.iter().find(|c| c.id == card_id)).ok_or("That card isn’t in your hand.")?;
        if held.from_round > self.round.id {
            return Err("Playable from next round.");
        }
        if card.kind == Kind::Passive {
            return Err("Goes off on its own.");
        }
        if self.played_by(actor).is_some() {
            return Err("You already played a card this round.");
        }
        let role = self.role_in_round(actor).ok_or("Wait for the roles.")?;
        let leader = round.leaders.contains(actor);
        // Bets are checked with the ballot; here only role and lead.
        if let Some(reason) = cards::cant_play(card_id, role, leader, 3) {
            return Err(reason);
        }
        let window = match self.phase.as_str() {
            "roles" => Window::RoleReveal,
            "discussion" => Window::Discussion,
            "voting" if !self.round.original.contains_key(actor) => Window::Ballot,
            _ => return Err("Not now."),
        };
        if !card.windows.contains(&window) {
            return Err(match card.windows[0] {
                Window::RoleReveal => "Play it when you see your role.",
                Window::Discussion => "Play it during the discussion.",
                Window::Ballot => "Play it on your ballot.",
                _ => "Not now.",
            });
        }
        if card.hidden_for_last_voter && self.round.original.len() + 1 >= self.round.roster.len() {
            return Err("You’re the last to vote, so there’s no time to change your bet.");
        }
        if card.target == Target::PlayedCard && !round.plays.iter().any(|p| p.play.owner != actor) {
            return Err("Nobody else has played a card yet.");
        }
        Ok(())
    }

    fn in_round(&self, id: &str) -> bool {
        self.round.roster.iter().any(|p| p == id)
    }

    /// Recomputes the speaking order: Opening Acts first in the order played,
    /// Late Arrivals last with the first one played speaking last.
    fn apply_order(&mut self) {
        let r = &self.round.cards;
        let mut order: Vec<String> = r.openers.clone();
        order.extend(r.base_order.iter().filter(|id| !r.openers.contains(id) && !r.lates.contains(id)).cloned());
        order.extend(r.lates.iter().rev().cloned());
        if let Some(first) = order.first() {
            self.round.starting = first.clone();
            self.last_starting = Some(first.clone());
        }
        self.round.order = order;
    }

    /// Lawyer Up on `target`: the verdict for a card (tier, seq) aimed at them.
    fn lawyer_verdict(&self, target: &str, card: (Tier, u32)) -> Option<Verdict> {
        let &seq = self.round.cards.lawyered.get(target)?;
        cards::against_lawyer(card, seq)
    }

    /// Takes a played card out of the hand; Common and Rare go to the back of
    /// their line.
    fn spend(&mut self, actor: &str, card: &str) {
        if let Some(hand) = self.cards.hands.get_mut(actor) {
            if let Some(i) = hand.iter().position(|c| c.id == card) {
                hand.remove(i);
            }
        }
        self.deck_mut().give_back(card);
    }

    /// Undoes what a cancelled card still had pending.
    fn cancel_pending(&mut self, index: usize) {
        let rec = &mut self.round.cards.plays[index];
        rec.play.cancelled = true;
        let (card, owner, pick) = (rec.play.card.clone(), rec.play.owner.clone(), rec.play.pick.clone());
        match card.as_str() {
            "put-on-the-spot" => {
                if let Some(p) = pick {
                    self.round.cards.owed.remove(&p);
                }
            }
            "cold-feet" => {
                self.round.cards.cold_feet.remove(&owner);
            }
            _ => {}
        }
    }

    /// Plays a card in the role reveal or discussion window. Ballot cards
    /// arrive with the vote instead (`ballot_card`).
    pub(crate) fn play_card(&mut self, actor: &str, value: &Value) -> GameResult<()> {
        self.require_phase(&["roles", "discussion"])?;
        let id = value.get("card").and_then(Value::as_str).ok_or("Choose a card.")?;
        self.playable(actor, id)?;
        let pick = value.get("player_id").and_then(Value::as_str).map(String::from);
        let second = value.get("second_id").and_then(Value::as_str).map(String::from);
        let claim: Option<Role> = value.get("role").and_then(|v| serde_json::from_value(v.clone()).ok());
        self.apply_play(actor, id, pick, second, claim)
    }

    fn apply_play(&mut self, actor: &str, id: &str, pick: Option<String>, second: Option<String>, claim: Option<Role>) -> GameResult<()> {
        let card = cards::card(id).ok_or("Unknown card.")?;
        // Who the card names, checked before anything is spent.
        let other = |p: &Option<String>| p.as_deref().filter(|p| *p != actor && self.in_round(p)).map(String::from);
        match (card.target, id) {
            (Target::Player, _) | (_, "on-the-record") | (_, "second-opinion") => {
                other(&pick).ok_or("Choose another player.")?;
            }
            (Target::TwoPlayers, _) => {
                let (a, b) = (other(&pick).ok_or("Choose two other players.")?, other(&second).ok_or("Choose two other players.")?);
                if a == b {
                    return Err("Choose two different players.".into());
                }
            }
            (Target::PlayedCard, _) => {
                let p = other(&pick).ok_or("Choose a player who played a card.")?;
                if self.played_by(&p).is_none() {
                    return Err("They haven’t played a card this round.".into());
                }
            }
            (_, "sealed-alibi") => {
                pick.as_deref().filter(|p| self.in_round(p)).ok_or("Predict who the room will accuse.")?;
            }
            (_, "cover-story") if claim.is_none() => return Err("Choose the role you claim.".into()),
            _ => {}
        }
        let seq = self.round.cards.plays.len() as u32 + 1;
        let tier = card.tier;
        let shown = if id == "bluff-card" { cards::bluff_tier(&mut rand::thread_rng()) } else { tier };
        self.spend(actor, id);
        let mut rec = PlayRec {
            play: Play { seq, owner: actor.into(), card: id.into(), pick: pick.clone(), cancelled: false },
            shown,
            claim,
            read: Value::Null,
            verdict: None,
        };
        // A card aimed at someone who played Lawyer Up.
        if cards::aims_at_player(id) && card.target != Target::TwoPlayers {
            if let Some(target) = pick.as_deref() {
                match self.lawyer_verdict(target, (tier, seq)) {
                    Some(Verdict::Blocked) => {
                        rec.play.cancelled = true;
                        rec.verdict = Some(Verdict::Blocked);
                        self.round.cards.stamps.push(Stamp { verdict: Verdict::Blocked, by: Some(target.into()), on: Some(actor.into()), bluff: false });
                    }
                    Some(Verdict::Pierced) => rec.verdict = Some(Verdict::Pierced),
                    _ => {}
                }
            }
        }
        let live = !rec.play.cancelled;
        let word = self.round.word.clone();
        match id {
            "late-arrival" => {
                self.round.cards.lates.push(actor.into());
                self.apply_order();
            }
            "opening-act" => {
                self.round.cards.openers.push(actor.into());
                self.apply_order();
            }
            "lawyer-up" => {
                self.round.cards.lawyered.insert(actor.into(), seq);
                // Commons aimed at you that are still pending are blocked too.
                for i in 0..self.round.cards.plays.len() {
                    let p = &self.round.cards.plays[i];
                    let pending_common = !p.play.cancelled
                        && p.play.pick.as_deref() == Some(actor)
                        && matches!(p.play.card.as_str(), "put-on-the-spot" | "anonymous-tip")
                        && !(p.play.card == "anonymous-tip" && self.round.cards.voting_opened);
                    if pending_common {
                        let owner = p.play.owner.clone();
                        self.cancel_pending(i);
                        self.round.cards.plays[i].verdict = Some(Verdict::Blocked);
                        self.round.cards.stamps.push(Stamp { verdict: Verdict::Blocked, by: Some(actor.into()), on: Some(owner), bluff: false });
                    }
                }
            }
            "put-on-the-spot" if live => {
                self.round.cards.owed.insert(pick.clone().unwrap());
            }
            "word-count" => {
                rec.read = json!({"letters": word.chars().filter(|c| c.is_alphabetic()).count()});
            }
            "borrowed-hint" => rec.read = json!({"hint": self.round.hint}),
            "master-key" => rec.read = json!({"word": word}),
            "private-eye" => {
                // Each name is read on its own: Lawyer Up blocks only that one.
                let mut reads = vec![];
                for p in [pick.clone(), second.clone()].into_iter().flatten() {
                    if self.lawyer_verdict(&p, (tier, seq)) == Some(Verdict::Blocked) {
                        self.round.cards.stamps.push(Stamp { verdict: Verdict::Blocked, by: Some(p.clone()), on: Some(actor.into()), bluff: false });
                        reads.push(json!({"player_id": p, "blocked": true}));
                    } else {
                        reads.push(json!({"player_id": p, "side": side(self.role_in_round(&p))}));
                    }
                }
                rec.read = json!(reads);
            }
            "x-ray" if live => {
                let p = pick.clone().unwrap();
                rec.read = json!({"player_id": p, "role": self.role_in_round(&p)});
            }
            "reshuffle" => {
                let next = self.round.id + 1;
                let drawn = self.draw_into_hand(actor, next);
                rec.read = json!({"drew": drawn});
            }
            "objection" if live => {
                let target = pick.clone().unwrap();
                let i = self.round.cards.plays.iter().position(|p| p.play.owner == target).unwrap();
                let objected = self.round.cards.plays[i].play.card.clone();
                let verdict = cards::objection(cards::tier_of(&objected));
                if verdict == Verdict::Sustained {
                    self.cancel_pending(i);
                }
                rec.verdict = Some(verdict);
                self.round.cards.stamps.push(Stamp { verdict, by: Some(actor.into()), on: Some(target), bluff: verdict == Verdict::Sustained && objected == "bluff-card" });
            }
            _ => {}
        }
        self.round.cards.plays.push(rec);
        Ok(())
    }

    /// A card sent with a vote. Runs after the vote itself is valid and before
    /// it is stored, so a bad card rejects the whole ballot.
    pub(crate) fn ballot_card(&mut self, actor: &str, accused: &str, stake: u32, value: &Value) -> GameResult<()> {
        let Some(c) = value.get("card").filter(|c| !c.is_null()) else {
            return Ok(());
        };
        let id = c.get("id").and_then(Value::as_str).ok_or("Choose a card.")?;
        self.playable(actor, id)?;
        let role = self.role_in_round(actor).ok_or("Wait for the roles.")?;
        if let Some(reason) = cards::cant_play(id, role, self.round.cards.leaders.contains(actor), stake) {
            return Err(reason.into());
        }
        let pick = c.get("player_id").and_then(Value::as_str).map(String::from);
        if id == "second-opinion" && pick.as_deref() == Some(accused) {
            return Err("Pick a backup other than your vote.".into());
        }
        self.apply_play(actor, id, pick.clone(), None, None)?;
        let seq = self.round.cards.plays.len() as u32;
        let cancelled = self.round.cards.plays.last().is_some_and(|p| p.play.cancelled);
        if cancelled {
            return Ok(());
        }
        match id {
            "heavy-vote" => {
                self.round.cards.heavy.insert(actor.into());
            }
            "golden-ballot" => {
                self.round.cards.golden.insert(actor.into());
                if self.round.cards.vetoed.contains(actor) {
                    self.round.cards.stamps.push(Stamp { verdict: Verdict::Overruled, by: Some(actor.into()), on: None, bluff: false });
                }
            }
            "cold-feet" => {
                self.round.cards.cold_feet.insert(actor.into());
            }
            "pocket-veto" => {
                let target = pick.unwrap();
                let verdict = cards::veto(self.round.cards.golden.contains(&target));
                self.round.cards.vetoed.insert(target.clone());
                if let Some(rec) = self.round.cards.plays.iter_mut().find(|p| p.play.seq == seq) {
                    rec.verdict = Some(verdict);
                }
                self.round.cards.stamps.push(Stamp { verdict, by: None, on: (verdict == Verdict::Overruled).then_some(target), bluff: false });
            }
            _ => {}
        }
        Ok(())
    }

    /// Cold Feet: change your bet once after voting, until the last ballot.
    pub(crate) fn change_bet(&mut self, actor: &str, value: &Value) -> GameResult<()> {
        self.require_phase(&["voting"])?;
        if !self.round.cards.cold_feet.contains(actor) {
            return Err("You don’t have a bet to change.".into());
        }
        let stake = value.as_u64().filter(|n| *n <= 3).ok_or("Bet a whole number from 0 to 3 points.")? as u32;
        self.check_stake(actor, stake)?;
        self.round.cards.cold_feet.remove(actor);
        self.round.stakes.insert(actor.into(), stake);
        Ok(())
    }

    /// The bet cap: your points, or 3 for an Underdog whatever their balance.
    pub(crate) fn max_stake(&self, actor: &str) -> u32 {
        if self.round.cards.active && self.round.cards.underdogs.contains(actor) {
            3
        } else {
            self.points_of(actor).clamp(0, 3) as u32
        }
    }

    pub(crate) fn check_stake(&self, actor: &str, stake: u32) -> GameResult<()> {
        if stake > self.max_stake(actor) {
            return Err("Your bet cannot exceed your available points.".into());
        }
        Ok(())
    }

    /// On the Record locked this player's accusation.
    pub(crate) fn recorded_vote(&self, actor: &str) -> Option<&str> {
        self.round.cards.plays.iter().find(|p| p.play.owner == actor && p.play.card == "on-the-record").and_then(|p| p.play.pick.as_deref())
    }

    /// Opening the vote publishes Anonymous Tips; a clue still owed needs the host's OK.
    pub(crate) fn open_vote_cards(&mut self, confirm: bool) -> GameResult<()> {
        if !self.round.cards.active {
            return Ok(());
        }
        if let Some(owing) = self.round.cards.owed.iter().next() {
            if !confirm {
                let name = self.players.iter().find(|p| &p.id == owing).map(|p| p.name.clone()).unwrap_or_default();
                return Err(format!("{name} still owes a clue. Open the vote anyway?"));
            }
        }
        self.round.cards.voting_opened = true;
        Ok(())
    }

    /// A clue, a performed marker or the host's tick settles Put on the Spot.
    pub(crate) fn clue_given(&mut self, id: &str) {
        self.round.cards.owed.remove(id);
    }

    pub(crate) fn card_weights(&self) -> cards::Weights {
        cards::Weights {
            judge: self.round.cast.as_ref().map(|c| c.holder(Role::Judge).to_string()),
            judge_doubles: self.round.roster.len() >= cast::JUDGE_DOUBLE_FROM,
            heavy: self.round.cards.heavy.clone(),
            golden: self.round.cards.golden.clone(),
            vetoed: self.round.cards.vetoed.clone(),
        }
    }

    /// The caught Imposter's Last Word fires before anything is shown, if
    /// they hold it and played no active card.
    pub(crate) fn last_word_due(&self) -> bool {
        let imp = self.round.imposter.as_str();
        self.round.cards.active
            && self.round.accused.as_deref() == Some(imp)
            && self.holds(imp, "last-word")
            && self.played_by(imp).is_none()
    }

    pub(crate) fn open_last_word(&mut self, escaped: bool, perfect_bluff: bool) {
        let mut options = vec![self.round.word.clone()];
        let decoy = self.round.cast.as_ref().map(|c| c.decoy_word.clone()).unwrap_or_default();
        for w in std::iter::once(decoy).chain(self.round.cards.spares.iter().cloned()) {
            if options.len() < 3 && !w.is_empty() && !options.contains(&w) {
                options.push(w);
            }
        }
        options.shuffle(&mut rand::thread_rng());
        self.round.cards.last_word = Some(LastWord { options, until: Instant::now() + LAST_WORD_WINDOW, escaped, perfect_bluff });
        self.phase = "last_word".into();
    }

    /// The Imposter's pick, or None when time ran out (a wrong answer).
    pub(crate) fn finish_last_word(&mut self, word: Option<&str>) {
        let Some(lw) = self.round.cards.last_word.take() else { return };
        self.round.cards.last_word_right = Some(word == Some(self.round.word.as_str()));
        self.commit_round(lw.escaped, lw.perfect_bluff);
    }

    pub(crate) fn answer_last_word(&mut self, actor: &str, value: &Value) -> GameResult<()> {
        self.require_phase(&["last_word"])?;
        if actor != self.round.imposter {
            return Err("Only the caught Imposter answers.".into());
        }
        let word = value.as_str().ok_or("Pick one of the three words.")?;
        if !self.round.cards.last_word.as_ref().is_some_and(|lw| lw.options.iter().any(|w| w == word)) {
            return Err("Pick one of the three words.".into());
        }
        self.finish_last_word(Some(word));
        Ok(())
    }

    /// Deals once everyone has drawn or skipped. The host loop sends this as
    /// the `deal_drawn` action so the deal is saved to the word deck like any
    /// other. A failed deal returns to the topic with Retry deal.
    pub(crate) fn deal_drawn(&mut self) -> GameResult<()> {
        self.require_phase(&["draw"])?;
        if !self.draw_done(Instant::now()) {
            return Err("Wait until everyone has drawn or skipped.".into());
        }
        if let Err(error) = self.deal() {
            self.round.deal_error = Some(error);
            self.phase = "topic_chosen".into();
        }
        Ok(())
    }

    /// The deadline the host loop drives: the Last Word.
    pub(crate) fn advance_cards(&mut self, now: Instant) {
        if self.phase == "last_word" && self.round.cards.last_word.as_ref().is_some_and(|lw| now >= lw.until) {
            self.finish_last_word(None);
            self.revision += 1;
        }
    }

    /// Scores the round with cards. Returns the settled round so the caller
    /// can fill the breakdowns and the Drink/Dare queue.
    pub(crate) fn settle_cards(&mut self, facts: &cast::Facts) -> cards::Settled {
        let cast = self.round.cast.clone().unwrap_or_default();
        let seats: BTreeMap<String, cards::Seat> = self
            .round
            .roster
            .iter()
            .map(|id| {
                let role = cast.roles.get(id).copied();
                let passives = self.cards.hands.get(id).map(|h| {
                    h.iter().filter(|c| cards::card(&c.id).is_some_and(|c| c.kind == Kind::Passive)).map(|c| c.id.clone()).collect()
                });
                (id.clone(), cards::Seat {
                    role,
                    before: self.points_of(id),
                    stake: self.round.stakes.get(id).copied().unwrap_or(0),
                    vote: self.round.original.get(id).cloned(),
                    side_pick: role == Some(Role::Detective) && facts.accomplice_caught,
                    passives: passives.unwrap_or_default(),
                    rain_check: self.cards.rain.contains(id),
                })
            })
            .collect();
        let weights = self.card_weights();
        let tally = cards::tally(&self.round.original, &self.round.imposter, &weights);
        let plays: Vec<Play> = self.round.cards.plays.iter().map(|p| p.play.clone()).collect();
        let settled = cards::settle(&cards::Round {
            seats: &seats,
            facts: *facts,
            imposter: &self.round.imposter,
            accused: self.round.accused.as_deref(),
            tally: &tally,
            plays: &plays,
            last_word: self.round.cards.last_word_right,
            underdogs: &self.round.cards.underdogs,
            leaders: &self.round.cards.leaders,
            bounty: &self.cards.bounty,
        });
        // Fired passives leave the hand; Rain Checks carry to each player's
        // next round played; the Bounty moves on.
        for (owner, card) in &settled.fired {
            self.spend(owner, card);
        }
        let roster: BTreeSet<String> = self.round.roster.iter().cloned().collect();
        self.cards.rain = self.cards.rain.difference(&roster).cloned().chain(settled.rain_checks.iter().cloned()).collect();
        self.cards.bounty = settled.bounty_next.clone();
        settled
    }

    /// Cardboard Crown: a tied session's winners after the Crown.
    pub(crate) fn crown_winners(&self, winners: Vec<String>) -> Vec<String> {
        if !self.cards.on {
            return winners;
        }
        let holders: BTreeSet<String> = winners.iter().filter(|w| self.holds(w, "cardboard-crown")).cloned().collect();
        cards::crown(&winners, &holders)
    }

    /// What a play did, from the settled breakdowns: the points its card
    /// moved to each player, and the owner's whole round.
    fn play_effect(&self, p: &PlayRec) -> Value {
        let moved: Vec<Value> = self
            .round
            .scores
            .iter()
            .flat_map(|(id, s)| {
                s.cards
                    .iter()
                    .filter(|l| l.card == p.play.card && l.from == p.play.owner)
                    .map(move |l| json!({"player_id": id, "points": l.points}))
            })
            .collect();
        let owner = self.round.scores.get(&p.play.owner);
        let claim_true = p.claim.map(|c| self.role_in_round(&p.play.owner) == Some(c));
        json!({"moved": moved, "owner_total": owner.map(|s| s.after - s.before), "claim": p.claim, "claim_true": claim_true})
    }

    /// After a round settles: its plays join the session's story, and
    /// Underdogs' gains count toward the comeback.
    pub(crate) fn record_story(&mut self) {
        if !self.round.cards.active {
            return;
        }
        let round = self.cards.rounds + 1;
        let entries: Vec<Value> = self
            .round
            .cards
            .plays
            .iter()
            .map(|p| {
                json!({"round": round, "player_id": p.play.owner, "card": p.play.card, "tier": p.shown,
                       "real_tier": cards::tier_of(&p.play.card), "pick": p.play.pick, "cancelled": p.play.cancelled,
                       "verdict": p.verdict, "effect": self.play_effect(p)})
            })
            .collect();
        self.cards.story.extend(entries);
        for id in self.round.cards.underdogs.clone() {
            if let Some(s) = self.round.scores.get(&id) {
                let gained = (s.after - s.before).max(0);
                *self.cards.comeback.entry(id).or_default() += gained;
            }
        }
    }

    /// Who leads, who is an Underdog and the Bounty for the next round, from
    /// the scores as they stand.
    fn standing(&self) -> Value {
        let scores: BTreeMap<String, i32> = self.players.iter().filter(|p| !p.left).map(|p| (p.id.clone(), p.points)).collect();
        let leaders = cards::leaders(&scores);
        let underdogs = cards::underdogs(&scores, self.target_score, self.cards.rounds + 1);
        json!({"leaders": leaders, "underdogs": underdogs, "bounty": (!underdogs.is_empty()).then(|| self.cards.bounty.current(&leaders))})
    }

    /// What this phone sees of power cards. Hands, odds and private reads go
    /// only to their owner; at results every play is shown in full.
    pub(crate) fn cards_view(&self, actor: &str, results: bool) -> Value {
        let r = &self.round.cards;
        let hand: Vec<Value> = self
            .cards
            .hands
            .get(actor)
            .map(|h| {
                h.iter()
                    .map(|c| {
                        let state = self.playable(actor, &c.id);
                        json!({"id": c.id, "playable": state.is_ok(), "reason": state.err(),
                               "new": r.decided.get(actor).and_then(|d| d.as_deref()) == Some(c.id.as_str())})
                    })
                    .collect()
            })
            .unwrap_or_default();
        let mine = self.played_by(actor);
        let wiretap = mine.filter(|p| p.play.card == "wiretap" && !p.play.cancelled).and_then(|p| {
            let target = p.play.pick.as_deref()?;
            Some(json!({"player_id": target, "vote": self.round.original.get(target)}))
        });
        let live = |p: &&PlayRec| !p.play.cancelled;
        let plays: Vec<Value> = r
            .plays
            .iter()
            .map(|p| {
                if results {
                    json!({"seq": p.play.seq, "player_id": p.play.owner, "tier": p.shown, "card": p.play.card,
                           "real_tier": cards::tier_of(&p.play.card), "pick": p.play.pick, "cancelled": p.play.cancelled, "verdict": p.verdict,
                           "effect": self.play_effect(p)})
                } else {
                    json!({"seq": p.play.seq, "player_id": p.play.owner, "tier": p.shown})
                }
            })
            .collect();
        let tips: Vec<&str> = if r.voting_opened {
            r.plays.iter().filter(live).filter(|p| p.play.card == "anonymous-tip").filter_map(|p| p.play.pick.as_deref()).collect()
        } else {
            vec![]
        };
        let public_card = |card: &'static str| r.plays.iter().filter(live).filter(move |p| p.play.card == card);
        let hand_counts: BTreeMap<&String, usize> = self.cards.hands.iter().map(|(id, h)| (id, h.len())).collect();
        let last_word = (self.phase == "last_word" && actor == self.round.imposter)
            .then(|| r.last_word.as_ref().map(|lw| json!({"options": lw.options, "remaining_ms": lw.until.saturating_duration_since(Instant::now()).as_millis()})))
            .flatten();
        let bounty_paid = results
            .then(|| self.round.scores.values().flat_map(|s| s.cards.iter()).find(|l| l.card == "bounty").map(|l| l.points))
            .flatten();
        let story = ["session_complete", "ended"]
            .contains(&self.phase.as_str())
            .then(|| json!({"plays": self.cards.story, "comeback": self.cards.comeback}));
        json!({
            "on": self.cards.on,
            "active": r.active,
            "draw": (self.phase == "draw" || self.phase == "roles").then(|| json!({
                "decided": r.decided.keys().collect::<Vec<_>>(),
                "ready": r.ready,
            })),
            "drew": r.decided.iter().filter(|(_, c)| c.is_some()).map(|(id, _)| id).collect::<Vec<_>>(),
            "plays": plays,
            "bounty_paid": bounty_paid,
            "standing": self.standing(),
            "story": story,
            "stamps": r.stamps,
            "tips": tips,
            "claims": public_card("cover-story").map(|p| json!({"player_id": p.play.owner, "role": p.claim})).collect::<Vec<_>>(),
            "on_record": public_card("on-the-record").map(|p| json!({"player_id": p.play.owner, "vote": p.play.pick})).collect::<Vec<_>>(),
            "spotlight": public_card("spotlight").filter_map(|p| p.play.pick.as_deref()).map(|id| json!({"player_id": id, "side": side(self.role_in_round(id))})).collect::<Vec<_>>(),
            "owed": r.owed,
            "vetoed": r.stamps.iter().filter(|s| s.verdict == Verdict::Vetoed).count(),
            "hand_counts": hand_counts,
            "underdogs": r.underdogs,
            "leaders": r.leaders,
            "bounty": (!r.underdogs.is_empty()).then(|| self.cards.bounty.current(&r.leaders)),
            "mine": {
                "hand": hand,
                "golden_chance": self.chance(actor),
                "paid_draws_left": cards::PAID_DRAWS.saturating_sub(self.cards.paid.get(actor).copied().unwrap_or(0)),
                "price": self.draw_price(actor),
                "decided": r.decided.contains_key(actor),
                "played": mine.map(|p| json!({"seq": p.play.seq, "card": p.play.card, "cancelled": p.play.cancelled, "verdict": p.verdict, "read": p.read})),
                "wiretap": wiretap,
                "cold_feet": r.cold_feet.contains(actor),
                "rain_check": self.cards.rain.contains(actor),
                "last_word": last_word,
            },
        })
    }
}
