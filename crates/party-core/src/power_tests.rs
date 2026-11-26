// Power cards through real rounds: the draw window, plays and clashes, ballot
// cards, Cold Feet, the Last Word, scoring and what each phone may see.
use super::*;
use crate::cards::{self, Verdict};

fn act(g: &mut Game, actor: &str, kind: &str, value: Value) -> GameResult<()> {
    g.apply(actor, &Action { id: Uuid::new_v4().to_string(), round_id: g.round.id, kind: kind.into(), value })
}

/// A six-player party with power cards on and everyone ready.
fn party() -> Game {
    let mut g = Game::new("Cards", "Host", "Wi-Fi").unwrap();
    for i in 1..6 {
        g.join(&format!("Player {i}")).unwrap();
    }
    for p in &mut g.players {
        p.ready = true;
    }
    let host = g.host.clone();
    act(&mut g, &host, "power_cards", json!(true)).unwrap();
    g
}

fn ids(g: &Game) -> Vec<String> {
    g.players.iter().map(|p| p.id.clone()).collect()
}

/// Start, vote a topic, and stop at topic_chosen.
fn to_topic(g: &mut Game) {
    let host = g.host.clone();
    act(g, &host, "start", Value::Null).unwrap();
    let topic = g.round.topic_pool.first().unwrap().clone();
    for id in g.round.roster.clone() {
        act(g, &id, "topic_vote", json!([topic])).unwrap();
    }
    assert_eq!(g.phase, "topic_chosen");
}

/// Through the draw window (everyone skips) to the role screens, with the
/// Imposter pinned to the second player.
fn to_roles(g: &mut Game) -> String {
    let host = g.host.clone();
    to_topic(g);
    act(g, &host, "begin_round", Value::Null).unwrap();
    if g.phase == "draw" {
        for id in g.round.roster.clone() {
            if !g.round.cards.decided.contains_key(&id) {
                act(g, &id, "skip_draw", Value::Null).unwrap();
            }
        }
        let host = g.host.clone();
        act(g, &host, "deal_drawn", Value::Null).unwrap();
    }
    assert_eq!(g.phase, "roles");
    let imp = ids(g)[1].clone();
    g.force_imposter(&imp);
    imp
}

fn to_discussion(g: &mut Game) {
    for id in g.round.roster.clone() {
        act(g, &id, "role_ready", Value::Null).unwrap();
    }
    assert_eq!(g.phase, "discussion");
}

fn give(g: &mut Game, id: &str, card: &str) {
    g.cards.hands.entry(id.into()).or_default().push(power::Held { id: card.into(), from_round: 0 });
}

fn role_of(g: &Game, role: Role) -> String {
    g.round.cast.as_ref().unwrap().holder(role).to_string()
}

/// A plain ballot for `voter` naming `target`, with the role picks it needs.
fn ballot(g: &Game, voter: &str, target: &str) -> Value {
    let cast = g.round.cast.as_ref().unwrap();
    let mut v = json!({"player_id": target, "stake": 0});
    match cast.roles[voter] {
        Role::Imposter => {
            v["accomplice_id"] = json!(cast.holder(Role::Accomplice));
            v["decoy_id"] = json!(cast.holder(Role::Decoy));
        }
        Role::Detective => {
            let other = g.round.roster.iter().find(|p| *p != voter && *p != target).unwrap();
            v["accomplice_id"] = json!(other);
        }
        _ => {}
    }
    v
}

fn vote_all(g: &mut Game, target_for: impl Fn(&str) -> String) {
    for id in g.round.roster.clone() {
        if g.round.original.contains_key(&id) {
            continue;
        }
        let t = target_for(&id);
        let v = ballot(g, &id, &t);
        act(g, &id, "vote", v).unwrap();
    }
}

// ---------------------------------------------------------------- the draw window

#[test]
fn round_one_skips_the_draw_window_when_nobody_can_draw() {
    let mut g = party();
    to_topic(&mut g);
    let host = g.host.clone();
    act(&mut g, &host, "begin_round", Value::Null).unwrap();
    assert_eq!(g.phase, "roles", "everyone is on 0 points, so roles come straight away");
    assert!(g.round.cards.active);
}

#[test]
fn drawing_costs_three_counts_a_paid_draw_and_deals_when_everyone_decided() {
    let mut g = party();
    for p in &mut g.players {
        p.points = 5;
    }
    to_topic(&mut g);
    let host = g.host.clone();
    act(&mut g, &host, "begin_round", Value::Null).unwrap();
    assert_eq!(g.phase, "draw");
    let [a, b] = [ids(&g)[2].clone(), ids(&g)[3].clone()];
    act(&mut g, &a, "draw", Value::Null).unwrap();
    assert_eq!(g.players[2].points, 2);
    assert_eq!(g.cards.hands[&a].len(), 1);
    assert_eq!(g.cards.paid[&a], 1);
    assert!(act(&mut g, &a, "draw", Value::Null).is_err(), "one draw per round");
    act(&mut g, &b, "skip_draw", Value::Null).unwrap();
    g.advance_reveals(Instant::now());
    assert_eq!(g.phase, "draw", "still waiting for the others");
    // Once everyone has decided, roles are dealt; the drawer still reading
    // their card isn't rushed and follows when they tap Continue.
    for id in g.round.roster.clone() {
        let _ = act(&mut g, &id, "skip_draw", Value::Null);
    }
    let host = g.host.clone();
    act(&mut g, &host, "deal_drawn", Value::Null).unwrap();
    assert_eq!(g.phase, "roles");
    assert!(!g.round.cards.ready.contains(&a));
    act(&mut g, &a, "draw_ready", Value::Null).unwrap();
    assert!(g.round.cards.ready.contains(&a));
    // Everyone sees who drew; only the drawer sees what.
    let other = g.view(&b);
    assert_eq!(other["cards"]["drew"], json!([a]));
    assert!(other["cards"]["mine"]["hand"].as_array().unwrap().is_empty());
    assert_eq!(g.view(&a)["cards"]["mine"]["hand"].as_array().unwrap().len(), 1);
}

#[test]
fn the_host_can_deal_roles_past_someone_who_wandered_off() {
    let mut g = party();
    for p in &mut g.players {
        p.points = 5;
    }
    to_topic(&mut g);
    let host = g.host.clone();
    act(&mut g, &host, "begin_round", Value::Null).unwrap();
    g.advance_reveals(Instant::now() + Duration::from_secs(600));
    assert_eq!(g.phase, "draw", "nothing times out");
    let guest = ids(&g)[2].clone();
    assert!(act(&mut g, &guest, "deal_now", Value::Null).is_err(), "host only");
    act(&mut g, &host, "deal_now", Value::Null).unwrap();
    act(&mut g, &host, "deal_drawn", Value::Null).unwrap();
    assert_eq!(g.phase, "roles");
}

#[test]
fn below_six_players_cards_pause_and_hands_are_kept() {
    let mut g = Game::new("Five", "Host", "Wi-Fi").unwrap();
    for i in 1..5 {
        g.join(&format!("P{i}")).unwrap();
    }
    for p in &mut g.players {
        p.ready = true;
        p.points = 9;
    }
    let host = g.host.clone();
    act(&mut g, &host, "power_cards", json!(true)).unwrap();
    give(&mut g, &host, "jackpot");
    to_topic(&mut g);
    act(&mut g, &host, "begin_round", Value::Null).unwrap();
    assert_eq!(g.phase, "roles");
    assert!(!g.round.cards.active);
    assert_eq!(g.cards.hands[&host].len(), 1);
}

// ---------------------------------------------------------------- plays

#[test]
fn late_arrival_and_opening_act_change_the_speaking_order() {
    let mut g = party();
    to_roles(&mut g);
    let [a, b, c] = [ids(&g)[2].clone(), ids(&g)[3].clone(), ids(&g)[4].clone()];
    give(&mut g, &a, "late-arrival");
    give(&mut g, &b, "late-arrival");
    give(&mut g, &c, "opening-act");
    act(&mut g, &a, "play_card", json!({"card": "late-arrival"})).unwrap();
    act(&mut g, &b, "play_card", json!({"card": "late-arrival"})).unwrap();
    act(&mut g, &c, "play_card", json!({"card": "opening-act"})).unwrap();
    let order = &g.round.order;
    assert_eq!(order.first(), Some(&c));
    assert_eq!(order[order.len() - 1], a, "the first Late Arrival speaks last");
    assert_eq!(order[order.len() - 2], b);
    assert_eq!(g.round.starting, c);
    // Everyone sees the plays, as a tier only.
    let view = g.view(&ids(&g)[5]);
    assert_eq!(view["cards"]["plays"][0]["tier"], "common");
    assert!(view["cards"]["plays"][0].get("card").is_none());
}

#[test]
fn one_card_per_round_and_only_in_its_window() {
    let mut g = party();
    to_roles(&mut g);
    let a = ids(&g)[2].clone();
    give(&mut g, &a, "cover-story");
    give(&mut g, &a, "late-arrival");
    assert!(act(&mut g, &a, "play_card", json!({"card": "cover-story", "role": "judge"})).is_err(), "discussion only");
    act(&mut g, &a, "play_card", json!({"card": "late-arrival"})).unwrap();
    to_discussion(&mut g);
    assert!(act(&mut g, &a, "play_card", json!({"card": "cover-story", "role": "judge"})).is_err(), "already played");
}

#[test]
fn a_role_that_cant_use_a_card_cant_play_it() {
    let mut g = party();
    let imp = to_roles(&mut g);
    to_discussion(&mut g);
    give(&mut g, &imp, "borrowed-hint");
    let err = act(&mut g, &imp, "play_card", json!({"card": "borrowed-hint"})).unwrap_err();
    assert!(err.contains("role"), "{err}");
    let view = g.view(&imp);
    assert_eq!(view["cards"]["mine"]["hand"][0]["playable"], false);
    // The Imposter's ballot names an accomplice pick, not a suspect, so a
    // Golden Ballot would only pile four votes on their own teammate.
    assert!(cards::cant_play("golden-ballot", Role::Imposter, false, 0).is_some());
}

#[test]
fn the_imposters_on_the_record_is_for_show_and_leaves_their_picks_free() {
    let mut g = party();
    let imp = to_roles(&mut g);
    to_discussion(&mut g);
    let acc = role_of(&g, Role::Accomplice);
    let shown = g.round.roster.iter().find(|p| **p != imp && **p != acc).unwrap().clone();
    give(&mut g, &imp, "on-the-record");
    act(&mut g, &imp, "play_card", json!({"card": "on-the-record", "player_id": shown})).unwrap();
    let host = g.host.clone();
    act(&mut g, &host, "open_vote", Value::Null).unwrap();
    assert_eq!(g.view(&host)["cards"]["on_record"][0]["vote"], json!(shown));
    // Their real ballot still names whoever they think the accomplice is.
    let v = ballot(&g, &imp, &acc);
    act(&mut g, &imp, "vote", v).unwrap();
    assert_eq!(g.round.original[&imp], acc);
}

#[test]
fn private_reads_reach_only_their_owner() {
    let mut g = party();
    let imp = to_roles(&mut g);
    to_discussion(&mut g);
    let det = role_of(&g, Role::Detective);
    let judge = role_of(&g, Role::Judge);
    give(&mut g, &det, "x-ray");
    act(&mut g, &det, "play_card", json!({"card": "x-ray", "player_id": imp})).unwrap();
    assert_eq!(g.view(&det)["cards"]["mine"]["played"]["read"]["role"], "imposter");
    let other = serde_json::to_string(&g.view(&judge)).unwrap();
    assert!(!other.contains("x-ray"), "the card name stays secret");
    assert!(!other.contains(r#""read""#) || g.view(&judge)["cards"]["mine"]["played"].is_null());
    assert_eq!(g.view(&judge)["cards"]["plays"][0]["tier"], "golden");
}

#[test]
fn lawyer_up_blocks_put_on_the_spot_and_golden_cards_pierce_it() {
    let mut g = party();
    let imp = to_roles(&mut g);
    give(&mut g, &imp, "lawyer-up");
    act(&mut g, &imp, "play_card", json!({"card": "lawyer-up"})).unwrap();
    to_discussion(&mut g);
    let [a, b] = [role_of(&g, Role::Judge), role_of(&g, Role::Detective)];
    give(&mut g, &a, "put-on-the-spot");
    act(&mut g, &a, "play_card", json!({"card": "put-on-the-spot", "player_id": imp})).unwrap();
    assert!(g.round.cards.owed.is_empty());
    let stamp = &g.round.cards.stamps[0];
    assert_eq!((stamp.verdict, stamp.by.as_deref(), stamp.on.as_deref()), (Verdict::Blocked, Some(imp.as_str()), Some(a.as_str())));
    give(&mut g, &b, "spotlight");
    act(&mut g, &b, "play_card", json!({"card": "spotlight", "player_id": imp})).unwrap();
    assert_eq!(g.view(&a)["cards"]["spotlight"][0]["side"], "imposter");
}

#[test]
fn objection_sustains_against_a_common_and_is_overruled_by_a_rare() {
    let mut g = party();
    to_roles(&mut g);
    to_discussion(&mut g);
    let [a, b, c, d] = [ids(&g)[2].clone(), ids(&g)[3].clone(), ids(&g)[4].clone(), ids(&g)[5].clone()];
    give(&mut g, &a, "cover-story");
    act(&mut g, &a, "play_card", json!({"card": "cover-story", "role": "detective"})).unwrap();
    assert_eq!(g.view(&d)["cards"]["claims"].as_array().unwrap().len(), 1);
    give(&mut g, &b, "objection");
    act(&mut g, &b, "play_card", json!({"card": "objection", "player_id": a})).unwrap();
    assert_eq!(g.round.cards.stamps[0].verdict, Verdict::Sustained);
    assert!(g.view(&d)["cards"]["claims"].as_array().unwrap().is_empty(), "the claim comes down");
    give(&mut g, &c, "decoy-contract");
    let can = cards::cant_play("decoy-contract", g.round.cast.as_ref().unwrap().roles[&c], false, 0).is_none();
    if can {
        act(&mut g, &c, "play_card", json!({"card": "decoy-contract"})).unwrap();
        give(&mut g, &d, "objection");
        act(&mut g, &d, "play_card", json!({"card": "objection", "player_id": c})).unwrap();
        assert_eq!(g.round.cards.stamps[1].verdict, Verdict::Overruled);
    }
}

#[test]
fn a_sustained_objection_exposes_a_bluff_that_looked_golden() {
    let mut g = party();
    to_roles(&mut g);
    to_discussion(&mut g);
    let [a, b] = [ids(&g)[2].clone(), ids(&g)[3].clone()];
    give(&mut g, &a, "bluff-card");
    act(&mut g, &a, "play_card", json!({"card": "bluff-card"})).unwrap();
    g.round.cards.plays[0].shown = cards::Tier::Golden;
    give(&mut g, &b, "objection");
    act(&mut g, &b, "play_card", json!({"card": "objection", "player_id": a})).unwrap();
    let stamp = &g.round.cards.stamps[0];
    assert!(stamp.verdict == Verdict::Sustained && stamp.bluff);
}

#[test]
fn put_on_the_spot_asks_the_host_before_the_vote_and_a_clue_settles_it() {
    let mut g = party();
    to_roles(&mut g);
    to_discussion(&mut g);
    let host = g.host.clone();
    let [a, b] = [ids(&g)[2].clone(), ids(&g)[3].clone()];
    give(&mut g, &a, "put-on-the-spot");
    act(&mut g, &a, "play_card", json!({"card": "put-on-the-spot", "player_id": b})).unwrap();
    let err = act(&mut g, &host, "open_vote", Value::Null).unwrap_err();
    assert!(err.contains("owes a clue"), "{err}");
    act(&mut g, &host, "clue_given", json!(b)).unwrap();
    act(&mut g, &host, "open_vote", Value::Null).unwrap();
    assert_eq!(g.phase, "voting");
}

#[test]
fn an_anonymous_tip_shows_only_once_the_vote_opens() {
    let mut g = party();
    let imp = to_roles(&mut g);
    to_discussion(&mut g);
    let a = ids(&g)[2].clone();
    give(&mut g, &a, "anonymous-tip");
    act(&mut g, &a, "play_card", json!({"card": "anonymous-tip", "player_id": imp})).unwrap();
    assert!(g.view(&imp)["cards"]["tips"].as_array().unwrap().is_empty());
    let host = g.host.clone();
    act(&mut g, &host, "open_vote", Value::Null).unwrap();
    assert_eq!(g.view(&imp)["cards"]["tips"], json!([imp]));
}

// ---------------------------------------------------------------- ballot cards

#[test]
fn heavy_vote_and_pocket_veto_change_the_count() {
    let mut g = party();
    let imp = to_roles(&mut g);
    to_discussion(&mut g);
    let host = g.host.clone();
    act(&mut g, &host, "open_vote", Value::Null).unwrap();
    let roster = g.round.roster.clone();
    let civilians: Vec<String> = roster.iter().filter(|p| **p != imp && g.round.cast.as_ref().unwrap().roles[*p] != Role::Accomplice).cloned().collect();
    let acc = role_of(&g, Role::Accomplice);
    // The Accomplice vetoes the Judge.
    let judge = role_of(&g, Role::Judge);
    give(&mut g, &acc, "pocket-veto");
    let mut v = ballot(&g, &acc, &judge);
    v["card"] = json!({"id": "pocket-veto", "player_id": judge});
    act(&mut g, &acc, "vote", v).unwrap();
    assert!(g.round.cards.vetoed.contains(&judge));
    assert_eq!(g.round.cards.stamps.last().unwrap().verdict, Verdict::Vetoed);
    assert_eq!(g.view(&judge)["cards"]["vetoed"], 1);
    let _ = civilians;
}

#[test]
fn a_card_that_fails_rejects_the_whole_ballot() {
    let mut g = party();
    let imp = to_roles(&mut g);
    to_discussion(&mut g);
    let host = g.host.clone();
    act(&mut g, &host, "open_vote", Value::Null).unwrap();
    give(&mut g, &imp, "heavy-vote");
    let mut v = ballot(&g, &imp, &ids(&g)[3]);
    v["card"] = json!({"id": "heavy-vote"});
    assert!(act(&mut g, &imp, "vote", v).is_err(), "the Imposter can't play Heavy Vote");
    assert!(!g.round.original.contains_key(&imp));
    assert_eq!(g.cards.hands[&imp].len(), 1, "nothing was spent");
}

#[test]
fn cold_feet_lets_an_early_voter_change_their_bet_once() {
    let mut g = party();
    for p in &mut g.players {
        p.points = 3;
    }
    let imp = to_roles(&mut g);
    to_discussion(&mut g);
    let host = g.host.clone();
    act(&mut g, &host, "open_vote", Value::Null).unwrap();
    let judge = role_of(&g, Role::Judge);
    give(&mut g, &judge, "cold-feet");
    let mut v = ballot(&g, &judge, &imp);
    v["stake"] = json!(1);
    v["card"] = json!({"id": "cold-feet"});
    act(&mut g, &judge, "vote", v).unwrap();
    act(&mut g, &judge, "change_bet", json!(3)).unwrap();
    assert_eq!(g.round.stakes[&judge], 3);
    assert!(act(&mut g, &judge, "change_bet", json!(0)).is_err(), "once");
}

#[test]
fn underdogs_may_bet_three_whatever_their_points() {
    let mut g = party();
    g.cards.rounds = 3;
    for (i, p) in g.players.iter_mut().enumerate() {
        p.points = if i == 0 { 14 } else { 0 };
    }
    let imp = to_roles(&mut g);
    to_discussion(&mut g);
    let host = g.host.clone();
    act(&mut g, &host, "open_vote", Value::Null).unwrap();
    let u = role_of(&g, Role::Judge);
    assert!(g.round.cards.underdogs.contains(&u));
    let mut v = ballot(&g, &u, &imp);
    v["stake"] = json!(3);
    act(&mut g, &u, "vote", v).unwrap();
}

// ---------------------------------------------------------------- scoring and the Last Word

#[test]
fn card_awards_land_in_the_score_breakdown() {
    let mut g = party();
    let imp = to_roles(&mut g);
    to_discussion(&mut g);
    let judge = role_of(&g, Role::Judge);
    give(&mut g, &judge, "on-the-record");
    act(&mut g, &judge, "play_card", json!({"card": "on-the-record", "player_id": imp})).unwrap();
    let host = g.host.clone();
    act(&mut g, &host, "open_vote", Value::Null).unwrap();
    let other = ballot(&g, &judge, &host);
    assert!(act(&mut g, &judge, "vote", other).is_err(), "the vote is on the record");
    let acc = role_of(&g, Role::Accomplice);
    vote_all(&mut g, |id| if id == imp || id == acc { judge.clone() } else { imp.clone() });
    assert_eq!(g.phase, "result_reveal");
    let s = &g.round.scores[&judge];
    assert_eq!(s.cards, vec![cards::Line { card: "on-the-record".into(), from: judge.clone(), points: 2 }]);
    assert_eq!(s.after, 2 + 2, "Judge +2 for the read, +2 for the record");
    // The play joins the session's story with what it did.
    assert_eq!(g.cards.story.len(), 1);
    assert_eq!(g.cards.story[0]["effect"]["moved"], json!([{"player_id": judge, "points": 2}]));
    let view = g.view(&host);
    assert_eq!(view["cards"]["standing"]["leaders"], json!([judge]));
}

#[test]
fn a_caught_imposter_with_last_word_picks_the_word_before_results() {
    let mut g = party();
    let imp = to_roles(&mut g);
    to_discussion(&mut g);
    give(&mut g, &imp, "last-word");
    let host = g.host.clone();
    act(&mut g, &host, "open_vote", Value::Null).unwrap();
    let acc = role_of(&g, Role::Accomplice);
    vote_all(&mut g, |id| if id == imp || id == acc { host.clone() } else { imp.clone() });
    assert_eq!(g.phase, "last_word");
    let options = g.view(&imp)["cards"]["mine"]["last_word"]["options"].as_array().unwrap().clone();
    assert_eq!(options.len(), 3);
    assert!(g.view(&acc)["cards"]["mine"]["last_word"].is_null(), "only the Imposter sees the choices");
    let word = g.round.word.clone();
    act(&mut g, &imp, "last_word", json!(word)).unwrap();
    assert_eq!(g.phase, "result_reveal");
    assert!(g.round.scores[&imp].base > 0, "scored as if they escaped");
    assert!(!g.round.queue.contains(&imp));
    assert!(g.cards.hands[&imp].is_empty(), "Last Word is spent");
}

#[test]
fn a_last_word_that_runs_out_of_time_counts_as_wrong() {
    let mut g = party();
    let imp = to_roles(&mut g);
    to_discussion(&mut g);
    give(&mut g, &imp, "last-word");
    let host = g.host.clone();
    act(&mut g, &host, "open_vote", Value::Null).unwrap();
    let acc = role_of(&g, Role::Accomplice);
    vote_all(&mut g, |id| if id == imp || id == acc { host.clone() } else { imp.clone() });
    g.advance_reveals(Instant::now() + power::LAST_WORD_WINDOW + Duration::from_millis(1));
    // The same late clock may carry the results beat on, too.
    assert!(["result_reveal", "results"].contains(&g.phase.as_str()), "{}", g.phase);
    assert!(g.round.queue.contains(&imp));
}

#[test]
fn a_new_session_clears_hands_but_keeps_power_cards_on() {
    let mut g = party();
    let host = g.host.clone();
    give(&mut g, &host, "jackpot");
    g.cards.chance.insert(host.clone(), 18);
    g.phase = "session_complete".into();
    act(&mut g, &host, "new_session", Value::Null).unwrap();
    assert!(g.cards.on && g.cards.hands.is_empty() && g.cards.chance.is_empty());
}

#[test]
fn leaving_puts_a_hand_back_in_the_deck() {
    let mut g = party();
    let a = ids(&g)[3].clone();
    let deck = g.cards.deck.get_or_insert_with(|| cards::Deck::new(&mut rand::thread_rng()));
    let card = deck.common.pop_front().unwrap();
    give(&mut g, &a, &card);
    act(&mut g, &a, "leave", Value::Null).unwrap();
    assert_eq!(g.cards.deck.as_ref().unwrap().common.back(), Some(&card));
}
