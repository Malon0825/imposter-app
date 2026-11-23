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
fn party(size: usize) -> Game {
    let mut g = Game::new("Full Cast", "Host", "Wi-Fi").unwrap();
    for i in 1..size {
        g.join(&format!("Player {i}")).unwrap();
    }
    g
}
fn ready(g: &mut Game) {
    for p in &mut g.players {
        p.ready = true;
    }
}
/// Starts a Full Cast round and opens voting.
fn deal(g: &mut Game) {
    let host = g.host.clone();
    ready(g);
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
}
fn who(g: &Game, role: Role) -> String {
    g.round.cast.as_ref().unwrap().holder(role).to_owned()
}
fn gamblers(g: &Game) -> Vec<String> {
    let cast = g.round.cast.as_ref().unwrap();
    cast.roles.iter().filter(|(_, r)| **r == Role::Gambler).map(|(id, _)| id.clone()).collect()
}
fn settle(g: &mut Game) {
    if let Some(at) = g.round.reveal_at {
        g.advance_reveals(at);
        g.advance_reveals(at + PERSONAL_BEAT);
    }
    assert_eq!(g.phase, "results");
}

#[test]
fn every_size_deals_the_full_cast_with_private_cards_only() {
    for size in 3..=12 {
        let mut g = party(size);
        deal(&mut g);
        let cast = g.round.cast.clone().unwrap();
        assert_eq!(cast.roles.len(), size);
        for role in Role::SPECIAL {
            let want = usize::from(cast::specials(size).contains(&role));
            assert_eq!(cast.roles.values().filter(|r| **r == role).count(), want, "size={size}");
        }
        assert_eq!(who(&g, Role::Imposter), g.round.imposter);
        assert!(matches!(cast.roles[&cast.cleared], Role::Judge | Role::Decoy | Role::Gambler));
        let bait = cast::bait_decoy(size);
        assert_eq!(cast.decoy_word.is_empty(), bait, "size={size}");
        if !bait {
            assert_ne!(cast.decoy_word, g.round.word);
            let topic = content::topics().into_iter().find(|t| Some(&t.id) == g.round.topic.as_ref()).unwrap();
            assert!(topic.words.iter().any(|w| w.word == cast.decoy_word), "decoy shares the topic");
        }
        for (id, role) in &cast.roles {
            let view = g.view(id);
            let card = &view["private_role"];
            assert_eq!(card["role"], json!(role));
            let text = view.to_string();
            match role {
                Role::Imposter => {
                    assert_eq!(card["clue"], g.round.hint);
                    assert!(!text.contains(&format!("\"{}\"", g.round.word)));
                }
                // Below five the Decoy holds the real word and plays as bait.
                Role::Decoy if !bait => {
                    assert_eq!(card["clue"], cast.decoy_word);
                    assert!(!text.contains(&format!("\"{}\"", g.round.word)));
                }
                _ => assert_eq!(card["clue"], g.round.word),
            }
            assert_eq!(card["imposter_id"].is_string(), *role == Role::Accomplice);
            assert_eq!(card["cleared_id"].is_string(), *role == Role::Detective);
            assert!(view["result"].is_null());
        }
    }
}

#[test]
fn ballots_accept_only_the_picks_each_role_has() {
    let mut g = party(6);
    deal(&mut g);
    for p in &mut g.players {
        p.points = 3;
    }
    let (imp, acc, det, judge, decoy) = (
        who(&g, Role::Imposter),
        who(&g, Role::Accomplice),
        who(&g, Role::Detective),
        who(&g, Role::Judge),
        who(&g, Role::Decoy),
    );
    let gambler = gamblers(&g)[0].clone();
    let vote = |g: &mut Game, id: &str, v: Value| act(g, id, "vote", v);
    // Imposter must name two different other players.
    assert!(vote(&mut g, &imp, json!({"player_id":acc,"stake":0})).is_err());
    assert!(vote(&mut g, &imp, json!({"player_id":acc,"stake":0,"accomplice_id":acc,"decoy_id":acc})).is_err());
    assert!(vote(&mut g, &imp, json!({"player_id":acc,"stake":0,"accomplice_id":imp,"decoy_id":acc})).is_err());
    // Nobody else may name a decoy; only the detective may name an accomplice.
    assert!(vote(&mut g, &judge, json!({"player_id":imp,"stake":0,"accomplice_id":acc})).is_err());
    assert!(vote(&mut g, &gambler, json!({"player_id":imp,"stake":0,"decoy_id":decoy})).is_err());
    assert!(vote(&mut g, &det, json!({"player_id":imp,"stake":1,"decoy_id":decoy})).is_err());
    assert!(vote(&mut g, &det, json!({"player_id":imp,"stake":1,"accomplice_id":imp})).is_err());
    // The detective must name an accomplice as well as the imposter.
    assert!(vote(&mut g, &det, json!({"player_id":imp,"stake":1})).is_err());
    assert!(vote(&mut g, &acc, json!({"player_id":imp,"stake":4})).is_err());
    vote(&mut g, &det, json!({"player_id":imp,"stake":2,"accomplice_id":acc})).unwrap();
    // The locked picks are visible to their owner only.
    assert_eq!(g.view(&det)["betting"]["my_picks"]["accomplice"], json!(acc));
    assert!(g.view(&imp)["betting"]["my_picks"].is_null());
    assert_eq!(g.view(&gambler)["betting"]["top_payout"], 5);
    assert_eq!(g.view(&judge)["betting"]["top_payout"], 3);
}

/// Everyone votes `target` except the listed overrides.
fn ballot(g: &mut Game, target: &str, overrides: &[(&str, Value)]) {
    let imp = who(g, Role::Imposter);
    let acc = who(g, Role::Accomplice);
    let decoy = who(g, Role::Decoy);
    let det = who(g, Role::Detective);
    let roster = g.round.roster.clone();
    for id in roster.clone() {
        let value = overrides.iter().find(|(o, _)| *o == id).map(|(_, v)| v.clone()).unwrap_or_else(|| {
            let t = if id == target { imp.clone() } else { target.to_owned() };
            if id == imp {
                json!({"player_id":acc,"stake":0,"accomplice_id":acc,"decoy_id":decoy})
            } else if id == det {
                // A wrong accomplice read unless a test overrides the detective.
                let miss = roster.iter().find(|p| ![&det, &t, &acc].contains(p)).unwrap();
                json!({"player_id":t,"stake":0,"accomplice_id":miss})
            } else {
                json!({"player_id":t,"stake":0})
            }
        });
        act(g, &id, "vote", value).unwrap();
    }
    settle(g);
}

#[test]
fn judge_counts_twice_and_breaks_a_tie_only_toward_the_imposter() {
    let mut g = party(6);
    deal(&mut g);
    let (imp, acc, det, judge, decoy) = (
        who(&g, Role::Imposter),
        who(&g, Role::Accomplice),
        who(&g, Role::Detective),
        who(&g, Role::Judge),
        who(&g, Role::Decoy),
    );
    let gambler = gamblers(&g)[0].clone();
    // Judge (2) + gambler (1) on the imposter vs accomplice, detective, decoy on
    // the gambler: 3–3, so the Judge's ballot catches the imposter.
    ballot(&mut g, &imp, &[
        (&acc, json!({"player_id":gambler,"stake":0})),
        (&det, json!({"player_id":gambler,"stake":0,"accomplice_id":decoy})),
        (&decoy, json!({"player_id":gambler,"stake":0})),
    ]);
    assert_eq!(g.round.accused.as_deref(), Some(imp.as_str()));
    let recap = g.view(&judge);
    assert_eq!(recap["result"]["cast"]["judge_tiebreak"], true);
    assert_eq!(recap["result"]["score"]["base"], 2);

    // A tie where the Judge backed an innocent player lets the imposter escape.
    let mut g = party(6);
    deal(&mut g);
    let (imp, acc, det, judge, decoy) = (
        who(&g, Role::Imposter),
        who(&g, Role::Accomplice),
        who(&g, Role::Detective),
        who(&g, Role::Judge),
        who(&g, Role::Decoy),
    );
    let gambler = gamblers(&g)[0].clone();
    // Judge (2) + accomplice (1) on the gambler vs detective, decoy, gambler on
    // the imposter: 3–3, and the Judge backed an innocent player.
    ballot(&mut g, &imp, &[
        (&judge, json!({"player_id":gambler,"stake":0})),
        (&acc, json!({"player_id":gambler,"stake":0})),
    ]);
    assert_eq!(g.round.accused, None);
    assert!(!g.round.judge_tiebreak);
    assert_eq!(g.round.scores[&imp].base, 2, "escaped");
    let _ = (det, decoy);
}

#[test]
fn escape_scores_follow_each_role_and_queue_each_loser_once() {
    let mut g = party(7);
    deal(&mut g);
    for p in &mut g.players {
        p.points = 3;
    }
    let (imp, acc, det, judge, decoy) = (
        who(&g, Role::Imposter),
        who(&g, Role::Accomplice),
        who(&g, Role::Detective),
        who(&g, Role::Judge),
        who(&g, Role::Decoy),
    );
    let gamblers = gamblers(&g);
    // The room accuses the accomplice; the imposter names both correctly; the
    // detective misses the accomplice; one gambler bets the top tier on the
    // imposter (wrong side of the room but a correct read).
    ballot(&mut g, &acc, &[
        (&imp, json!({"player_id":acc,"stake":3,"accomplice_id":acc,"decoy_id":decoy})),
        (&acc, json!({"player_id":judge,"stake":2})),
        (&det, json!({"player_id":acc,"stake":1,"accomplice_id":judge})),
        (&gamblers[0], json!({"player_id":imp,"stake":3})),
    ]);
    assert_eq!(g.round.accused.as_deref(), Some(acc.as_str()));
    let score = |g: &Game, id: &str| g.round.scores[id].clone();
    // Imposter: escape 2, pair 1, decoy 1, bet 3 (one correct read: no perfect bluff).
    let s = score(&g, &imp);
    assert_eq!((s.base, s.bonus, s.bet, s.bluff, s.after), (2, 2, 3, 0, 10));
    // Accomplice took the fall: +1 escape, +1 pair, bet won.
    let s = score(&g, &acc);
    assert_eq!((s.base, s.bonus, s.bet, s.voided), (1, 1, 2, false));
    // Detective: wrong both ways, lost the accomplice bet.
    assert_eq!(score(&g, &det).after, 2);
    // Decoy spotted by the imposter: voided, but no bet to lose.
    let s = score(&g, &decoy);
    assert!(s.voided && s.after == 3);
    // Gambler read it right: +1 and the +5 tier.
    assert_eq!(score(&g, &gamblers[0]).after, 9);
    let mut queue = g.round.queue.clone();
    queue.sort();
    let mut losers = vec![det.clone(), judge.clone(), decoy.clone(), gamblers[1].clone()];
    losers.sort();
    assert_eq!(queue, losers);
    // Recap reveals the whole cast and marks the spotted decoy.
    let recap = g.view(&decoy);
    assert_eq!(recap["result"]["cast"]["roles"][&imp], "imposter");
    assert_eq!(recap["result"]["cast"]["decoy_caught"], true);
    assert_eq!(recap["result"]["cast"]["pair_bonus"], true);
    let row = |id: &str| recap["result"]["outcomes"].as_array().unwrap().iter().find(|o| o["player_id"] == id).unwrap()["outcome"].clone();
    assert_eq!(row(&decoy), "spotted");
    assert_eq!(row(&acc), "escaped");
}

#[test]
fn spotted_accomplice_gains_nothing_and_the_fine_still_bites() {
    let mut g = party(6);
    deal(&mut g);
    for p in &mut g.players {
        p.points = 3;
    }
    let (imp, acc, det) = (who(&g, Role::Imposter), who(&g, Role::Accomplice), who(&g, Role::Detective));
    ballot(&mut g, &imp, &[
        (&acc, json!({"player_id":det,"stake":3})),
        (&det, json!({"player_id":imp,"stake":3,"accomplice_id":acc})),
    ]);
    // Spotted, imposter caught, and voted the Detective: −3 bet, −1 fine.
    let s = &g.round.scores[&acc];
    assert!(s.voided && s.after == 0 && s.bet == -3 && s.fine == 1);
    // A caught imposter gains nothing, but the decoy they named still gains nothing too.
    let s = &g.round.scores[&imp];
    assert_eq!((s.base, s.bonus, s.after), (0, 0, 3));
    assert!(g.round.scores[&who(&g, Role::Decoy)].voided);
    let s = &g.round.scores[&det];
    assert_eq!((s.base, s.bonus, s.bet), (1, 1, 3));
    assert!(g.round.queue.contains(&acc) && g.round.queue.contains(&imp));
    assert_eq!(g.round.queue.iter().filter(|id| **id == acc).count(), 1);
}

#[test]
fn party_weights_rotate_every_role_and_never_lock_anyone_out() {
    let mut g = party(6);
    g.round.roster = g.players.iter().map(|p| p.id.clone()).collect();
    let roster = g.round.roster.clone();
    let mut rng = rand::thread_rng();
    let mut held: BTreeMap<(Role, String), u32> = BTreeMap::new();
    let mut repeats = 0;
    let mut last: BTreeMap<String, Role> = BTreeMap::new();
    for _ in 0..120 {
        let roles = cast::assign(&roster, |role, id| g.role_weight(role, id), &mut rng).unwrap();
        g.record_imposter(&roles.iter().find(|(_, r)| **r == Role::Imposter).unwrap().0.clone());
        g.record_cast(&roles);
        for (id, role) in &roles {
            *held.entry((*role, id.clone())).or_default() += 1;
            repeats += u32::from(last.get(id) == Some(role) && *role != Role::Gambler);
        }
        last = roles;
    }
    // 120 rounds: each player expects 20 turns of each seat.
    for id in &roster {
        for role in Role::SPECIAL.into_iter().chain([Role::Gambler]) {
            let n = held[&(role, id.clone())];
            assert!((12..=28).contains(&n), "{role:?} {n}");
        }
    }
    // Back-to-back special seats still happen, so roles stay unreadable.
    assert!(repeats > 0);
}

#[test]
fn accomplice_voting_the_detective_costs_one_without_voiding_gains() {
    let mut g = party(6);
    deal(&mut g);
    for p in &mut g.players {
        p.points = 3;
    }
    let (imp, acc, det) = (who(&g, Role::Imposter), who(&g, Role::Accomplice), who(&g, Role::Detective));
    let gambler = gamblers(&g)[0].clone();
    // The room accuses the gambler, so the imposter escapes; the accomplice's
    // blind vote lands on the Detective.
    ballot(&mut g, &gambler, &[(&acc, json!({"player_id":det,"stake":2}))]);
    assert_ne!(g.round.accused.as_deref(), Some(imp.as_str()));
    let s = &g.round.scores[&acc];
    // Escape +1, pair +1, team bet +2, fine −1.
    assert_eq!((s.base, s.bonus, s.bet, s.fine, s.voided, s.after), (1, 1, 2, 1, false, 6));
}
