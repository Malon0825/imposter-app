use super::*;

fn act(g: &mut Game, actor: &str, kind: &str, value: Value) -> GameResult<()> {
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
fn lobby(size: usize) -> Game {
    let mut g = Game::new("Score session", "Host", "Wi-Fi").unwrap();
    for i in 1..size {
        g.join(&format!("Player {i}")).unwrap();
    }
    g
}
fn deal(g: &mut Game) {
    let host = g.host.clone();
    for p in &mut g.players {
        p.ready = true;
    }
    act(g, &host, "start", Value::Null).unwrap();
    let topic = g.round.topic_pool.first().unwrap().clone();
    for id in g.round.roster.clone() {
        act(g, &id, "topic_vote", json!([topic])).unwrap();
    }
    act(g, &host, "begin_round", Value::Null).unwrap();
    for id in g.round.roster.clone() {
        act(g, &id, "role_ready", Value::Null).unwrap();
    }
    act(g, &host, "open_vote", Value::Null).unwrap();
    // Deterministic role assignment for rule tests; production still uses the
    // weighted assignment tested independently across all supported sizes.
    g.round.imposter = g.players[1].id.clone();
}
fn vote(g: &mut Game, who: usize, target: usize, stake: u32) -> GameResult<()> {
    let id = g.players[who].id.clone();
    let target = g.players[target].id.clone();
    act(g, &id, "vote", json!({"player_id": target, "stake": stake}))
}
fn caught(g: &mut Game, stake: u32) {
    for i in 0..g.players.len() {
        vote(
            g,
            i,
            if i == 1 { 0 } else { 1 },
            if i == 0 { stake } else { 0 },
        )
        .unwrap();
    }
    assert_eq!(g.phase, "results");
}
fn finish(g: &mut Game) {
    let host = g.host.clone();
    act(g, &host, "open_reports", Value::Null).unwrap();
    act(g, &host, "punish", Value::Null).unwrap();
    while g.phase == "punishment" {
        let turn = g.round.turn + 1;
        act(g, &host, "skip", json!(turn)).unwrap();
    }
}
fn next(g: &mut Game) {
    finish(g);
    let host = g.host.clone();
    act(g, &host, "next", Value::Null).unwrap();
    deal(g);
}

#[test]
fn every_target_is_host_only_and_locked_until_next_session() {
    let mut g = lobby(3);
    let host = g.host.clone();
    let guest = g.players[1].id.clone();
    assert_eq!(g.target_score, 15);
    for target in [10, 15, 20, 25, 30] {
        assert!(act(&mut g, &guest, "session_target", json!(target)).is_err());
        act(&mut g, &host, "session_target", json!(target)).unwrap();
        assert_eq!(g.target_score, target);
    }
    for target in [
        json!(0),
        json!(11),
        json!(31),
        json!(-10),
        json!(15.5),
        json!("15"),
        Value::Null,
    ] {
        assert!(act(&mut g, &host, "session_target", target).is_err());
        assert_eq!(g.target_score, 30);
    }
    deal(&mut g);
    assert!(act(&mut g, &host, "session_target", json!(10)).is_err());
    act(&mut g, &host, "abandon", Value::Null).unwrap();
    assert!(act(&mut g, &host, "session_target", json!(10)).is_err());
    assert!(act(&mut g, &host, "new_session", Value::Null).is_err());
}

#[test]
fn affordable_stakes_and_maximum_are_enforced_for_three_to_twelve_players() {
    for size in 3..=12 {
        for balance in 0..=4 {
            for stake in 0..=3 {
                let mut g = lobby(size);
                deal(&mut g);
                g.players[0].points = balance;
                let result = vote(&mut g, 0, 1, stake);
                assert_eq!(
                    result.is_ok(),
                    stake as i32 <= balance,
                    "size={size}, balance={balance}, stake={stake}"
                );
                if result.is_ok() {
                    for i in 1..size {
                        vote(&mut g, i, if i == 1 { 0 } else { 1 }, 0).unwrap();
                    }
                    assert_eq!(g.players[0].points, balance + 1 + stake as i32);
                } else {
                    assert!(g.round.original.is_empty());
                    assert!(g.round.stakes.is_empty());
                }
            }
        }
    }
}

#[test]
fn malformed_imposter_self_and_locked_bets_cannot_mutate_the_ballot() {
    let mut g = lobby(4);
    deal(&mut g);
    g.players[0].points = 3;
    g.players[1].points = 10;
    let host = g.host.clone();
    let target = g.players[1].id.clone();
    for stake in [
        json!(-1),
        json!(4),
        json!(1.5),
        json!("2"),
        json!(null),
        json!(true),
        json!(u64::MAX),
    ] {
        assert!(act(
            &mut g,
            &host,
            "vote",
            json!({"player_id":target,"stake":stake})
        )
        .is_err());
        assert!(g.round.original.is_empty());
    }
    assert!(vote(&mut g, 1, 0, 1).is_err());
    assert!(vote(&mut g, 0, 0, 1).is_err());
    assert!(act(
        &mut g,
        &host,
        "vote",
        json!({"player_id":"unknown","stake":0})
    )
    .is_err());
    let request = Action {
        id: "bet-retry".into(),
        round_id: g.round.id,
        kind: "vote".into(),
        value: json!({"player_id":target,"stake":3}),
    };
    g.apply(&host, &request).unwrap();
    g.apply(&host, &request).unwrap();
    assert!(vote(&mut g, 0, 2, 0).is_err());
    assert_eq!(g.round.stakes[&host], 3);
    assert_eq!(g.players[0].points, 3); // Stake settles once at scoring.
}

#[test]
fn own_locked_bet_survives_reconnect_but_is_never_in_other_views() {
    let mut g = lobby(4);
    deal(&mut g);
    g.players[0].points = 3;
    vote(&mut g, 0, 1, 3).unwrap();
    let host = g.host.clone();
    g.connection(&host, false);
    g.connection(&host, true);
    assert_eq!(g.view(&host)["betting"]["my_stake"], 3);
    assert_eq!(g.view(&host)["my_vote"], g.players[1].id);
    for other in &g.players[1..] {
        let view = g.view(&other.id);
        assert!(view["betting"]["my_stake"].is_null());
        assert!(view["betting"]["original_vote"].is_null());
        assert!(view["result"].is_null());
        assert!(view.get("stakes").is_none());
        for p in view["players"].as_array().unwrap() {
            assert!(p.get("stake").is_none());
        }
    }
}

#[test]
fn wrong_bet_and_report_floor_at_zero_without_changing_punishment_rules() {
    let mut g = lobby(4);
    deal(&mut g);
    g.players[0].points = 2;
    let host = g.host.clone();
    g.reading_streaks.insert(host.clone(), 2);
    g.pending_reports.insert(host.clone(), 0);
    vote(&mut g, 0, 2, 2).unwrap();
    vote(&mut g, 1, 2, 0).unwrap();
    vote(&mut g, 2, 1, 0).unwrap();
    vote(&mut g, 3, 2, 0).unwrap();
    assert_eq!(g.players[0].points, 0);
    assert_eq!(g.players[0].earned, -2);
    assert_eq!(g.reading_streaks[&host], 0);
    assert!(g.round.queue.contains(&host));
    let score = &g.round.scores[&host];
    assert_eq!(
        (score.before, score.bet, score.penalty, score.after),
        (2, -2, 0, 0)
    );
    g.resolve(false);
    assert_eq!(g.players[0].points, 0);
}

#[test]
fn every_third_read_awards_once_imposter_and_abandoned_rounds_preserve_streak() {
    let mut g = lobby(4);
    deal(&mut g);
    let host = g.host.clone();
    for read in 1..=6 {
        caught(&mut g, 0);
        assert_eq!(g.reading_streaks[&host], read);
        assert_eq!(g.round.scores[&host].streak, i32::from(read % 3 == 0));
        g.resolve(false);
        assert_eq!(g.reading_streaks[&host], read);
        if read != 6 {
            next(&mut g);
        }
    }
    assert_eq!(g.players[0].points, 8);
    next(&mut g);
    act(&mut g, &host, "abandon", Value::Null).unwrap();
    assert_eq!(g.reading_streaks[&host], 6);
    deal(&mut g);
    g.round.imposter = host.clone();
    for i in 0..4 {
        vote(&mut g, i, if i == 0 { 1 } else { 0 }, 0).unwrap();
    }
    assert_eq!(g.reading_streaks[&host], 6);
}

#[test]
fn maximum_civilian_award_is_five_and_perfect_bluff_is_three() {
    let mut g = lobby(4);
    deal(&mut g);
    let host = g.host.clone();
    g.players[0].points = 3;
    g.reading_streaks.insert(host.clone(), 2);
    caught(&mut g, 3);
    assert_eq!(g.players[0].earned, 5);
    assert_eq!(g.players[0].points, 8);
    next(&mut g);
    for (i, target) in [2, 2, 0, 2].into_iter().enumerate() {
        vote(&mut g, i, target, 0).unwrap();
    }
    assert_eq!(g.players[1].earned, 3);
    assert_eq!(g.round.scores[&g.players[1].id].bluff, 1);
    assert_eq!(g.view(&host)["result"]["imposter_bonus"], 1);
}

#[test]
fn runoff_changes_neither_original_accusation_nor_bet_and_scores_once() {
    let mut g = lobby(4);
    deal(&mut g);
    g.players[0].points = 3;
    let host = g.host.clone();
    g.reading_streaks.insert(host.clone(), 2);
    for (i, target) in [1, 0, 1, 0].into_iter().enumerate() {
        vote(&mut g, i, target, if i == 0 { 3 } else { 0 }).unwrap();
    }
    assert_eq!(g.phase, "runoff");
    assert_eq!(g.players[0].points, 3);
    assert!(vote(&mut g, 0, 1, 1).is_err());
    for (i, target) in [1, 0, 0, 0].into_iter().enumerate() {
        vote(&mut g, i, target, 0).unwrap();
    }
    assert_eq!(g.round.accused.as_ref(), Some(&host));
    assert_eq!(g.round.stakes[&host], 3);
    assert_eq!(g.players[0].points, 8);
    assert_eq!(g.players[1].points, 2); // One original accusation denies perfect bluff.
    assert_eq!(g.players[2].points, 1); // Original correct guess still counts.
    g.resolve(true);
    assert_eq!(g.players[0].points, 8);
}

#[test]
fn target_checks_after_penalties_and_settles_all_players_before_choosing_winners() {
    for target in [10, 15, 20, 25, 30] {
        let mut g = lobby(4);
        g.target_score = target;
        deal(&mut g);
        g.players[0].points = target - 1;
        g.players[2].points = target - 2;
        let host = g.host.clone();
        g.pending_reports.insert(host.clone(), 0);
        caught(&mut g, 0);
        assert!(g.session_winners.is_empty()); // Base award was offset by report.
        assert_eq!(g.players[0].points, target - 1);
        next(&mut g);
        g.players[0].points = target - 1;
        g.players[2].points = target - 1;
        caught(&mut g, 3);
        assert_eq!(g.players[0].points, target + 3);
        assert_eq!(g.players[2].points, target);
        assert_eq!(g.session_winners, vec![host.clone()]);
        assert!(act(&mut g, &host, "next", Value::Null).is_err());
        finish(&mut g);
        assert_eq!(g.phase, "session_complete");
        assert!(act(&mut g, &host, "start", Value::Null).is_err());
        assert!(act(&mut g, &host, "next", Value::Null).is_err());
    }
}

#[test]
fn shared_win_and_restart_clear_session_state_preserving_connections_and_fairness() {
    let mut g = lobby(12);
    deal(&mut g);
    let host = g.host.clone();
    let guest = g.players[1].id.clone();
    g.players[0].points = 14;
    g.players[2].points = 14;
    let tokens: Vec<_> = g.players.iter().map(|p| p.token.clone()).collect();
    let history = g.imposter_turns.clone();
    let used = g.deck.clone();
    caught(&mut g, 0);
    assert_eq!(g.session_winners.len(), 2);
    finish(&mut g);
    assert_eq!(g.phase, "session_complete");
    assert_eq!(g.view(&host)["result"]["word"], g.round.word);
    g.connection(&guest, false);
    g.pending_reports.insert(host.clone(), g.round.id);
    assert!(act(&mut g, &guest, "new_session", Value::Null).is_err());
    let request = Action {
        id: "restart-retry".into(),
        round_id: g.round.id,
        kind: "new_session".into(),
        value: Value::Null,
    };
    g.apply(&host, &request).unwrap();
    g.apply(&host, &request).unwrap();
    assert_eq!(g.phase, "lobby");
    assert_eq!(g.session_number, 2);
    assert_eq!(g.target_score, 15);
    assert!(!g.session_started);
    assert!(g.session_winners.is_empty());
    assert!(g.players.iter().all(|p| p.points == 0 && p.earned == 0));
    assert!(g.reading_streaks.is_empty() && g.pending_reports.is_empty());
    assert!(g.round.stakes.is_empty() && g.round.scores.is_empty() && !g.round.committed);
    assert_eq!(g.imposter_turns, history);
    assert_eq!(g.deck, used);
    assert_eq!(
        g.players
            .iter()
            .map(|p| p.token.clone())
            .collect::<Vec<_>>(),
        tokens
    );
    assert!(!g.players[1].connected);
    assert!(g.view(&host)["result"].is_null());
    act(&mut g, &host, "session_target", json!(30)).unwrap();
    let stale = Action {
        id: "late-old-vote".into(),
        kind: "vote".into(),
        value: json!(guest),
        ..request
    };
    assert!(g.apply(&host, &stale).is_err());
}

#[test]
fn abandoning_a_wager_changes_neither_balance_nor_streak_or_pending_reports() {
    let mut g = lobby(4);
    deal(&mut g);
    let host = g.host.clone();
    g.players[0].points = 3;
    g.reading_streaks.insert(host.clone(), 2);
    g.pending_reports.insert(host.clone(), 0);
    vote(&mut g, 0, 1, 3).unwrap();
    act(&mut g, &host, "abandon", Value::Null).unwrap();
    assert_eq!(g.players[0].points, 3);
    assert_eq!(g.reading_streaks[&host], 2);
    assert_eq!(g.pending_reports[&host], 0);
    assert!(g.round.stakes.is_empty());
    deal(&mut g);
    assert_eq!(g.view(&host)["betting"]["my_stake"], Value::Null);
}
