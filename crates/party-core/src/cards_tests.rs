use super::*;
use rand::{rngs::StdRng, SeedableRng};
use std::path::Path;

fn s(v: &str) -> String {
    v.to_string()
}
fn set(v: &[&str]) -> BTreeSet<String> {
    v.iter().map(|x| s(x)).collect()
}

// ---------------------------------------------------------------- catalog

#[test]
fn catalog_has_the_v11_deck_and_every_card_has_art() {
    let cards = catalog();
    let count = |t: Tier| cards.iter().filter(|c| c.tier == t).count();
    assert_eq!((count(Tier::Common), count(Tier::Rare), count(Tier::Golden)), (15, 12, 10));
    let ids: BTreeSet<_> = cards.iter().map(|c| c.id.as_str()).collect();
    assert_eq!(ids.len(), 37, "card ids are unique");
    let art = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../public/art/cards");
    for c in cards {
        assert!(art.join(format!("{}.webp", c.id)).exists(), "{} has no art", c.id);
        assert!(!c.text.en.is_empty() && !c.text.fil.is_empty(), "{} needs both languages", c.id);
        match c.kind {
            Kind::Active => {
                assert_eq!(c.ratings.len(), 6, "{} needs a rating for every role", c.id);
                for (role, rating) in &c.ratings {
                    assert_eq!(*rating == Rating::Cant, c.cant_play.contains(role), "{} {role:?}", c.id);
                }
                assert!(c.when.is_some(), "{} needs a when-to-play line", c.id);
            }
            Kind::Passive => assert!(c.ratings.is_empty() && c.cant_play.is_empty(), "{}", c.id),
        }
    }
    // Only the Golden cards are all active.
    assert!(cards.iter().filter(|c| c.tier == Tier::Golden).all(|c| c.kind == Kind::Active));
}

#[test]
fn cant_play_covers_role_lead_and_bet() {
    assert!(cant_play("master-key", Role::Judge, false, 0).is_some());
    assert!(cant_play("master-key", Role::Decoy, false, 0).is_none());
    assert!(cant_play("second-opinion", Role::Accomplice, false, 0).is_some());
    assert!(cant_play("heavy-vote", Role::Imposter, false, 0).is_some());
    assert!(cant_play("robin-hood", Role::Gambler, true, 0).is_some());
    assert!(cant_play("robin-hood", Role::Gambler, false, 0).is_none());
    assert!(cant_play("double-or-nothing", Role::Gambler, false, 0).is_some());
    assert!(cant_play("double-or-nothing", Role::Gambler, false, 1).is_none());
    assert!(cant_play("jackpot", Role::Gambler, false, 0).is_some(), "passives are never played");
}

// ---------------------------------------------------------------- deck

#[test]
fn every_common_and_rare_shows_up_once_before_any_repeats() {
    let mut rng = StdRng::seed_from_u64(1);
    let mut deck = Deck::new(&mut rng);
    for (tier, size) in [(Tier::Common, 15), (Tier::Rare, 12)] {
        let mut seen = BTreeSet::new();
        for _ in 0..size {
            let (id, got) = deck.draw(tier, &[], &mut rng).unwrap();
            assert_eq!(got, tier);
            assert!(seen.insert(id.clone()), "{id} repeated before the line ran out");
            deck.give_back(&id);
        }
        // The line comes round again in the same order.
        let again: Vec<_> = (0..size).map(|_| {
            let (id, _) = deck.draw(tier, &[], &mut rng).unwrap();
            deck.give_back(&id);
            id
        }).collect();
        assert_eq!(again.iter().collect::<BTreeSet<_>>().len(), size);
    }
}

#[test]
fn a_held_card_is_skipped_and_keeps_its_place() {
    let mut rng = StdRng::seed_from_u64(2);
    let mut deck = Deck::new(&mut rng);
    let front = deck.common[0].clone();
    let second = deck.common[1].clone();
    let (id, _) = deck.draw(Tier::Common, &[front.clone()], &mut rng).unwrap();
    assert_eq!(id, second);
    assert_eq!(deck.common[0], front, "the skipped card stays at the front");
}

#[test]
fn golden_cards_are_unique_and_an_empty_pool_rolls_over_to_rare() {
    let mut rng = StdRng::seed_from_u64(3);
    let mut deck = Deck::new(&mut rng);
    let mut seen = BTreeSet::new();
    for _ in 0..10 {
        let (id, tier) = deck.draw(Tier::Golden, &[], &mut rng).unwrap();
        assert_eq!(tier, Tier::Golden);
        assert!(seen.insert(id.clone()));
        deck.give_back(&id); // played: a Golden stays out
    }
    assert!(deck.golden.is_empty());
    assert_eq!(deck.draw(Tier::Golden, &[], &mut rng).unwrap().1, Tier::Rare);
}

#[test]
fn a_line_with_nothing_that_fits_falls_to_the_other_line() {
    let mut rng = StdRng::seed_from_u64(4);
    let mut deck = Deck::new(&mut rng);
    let held: Vec<String> = deck.rare.iter().cloned().collect();
    assert_eq!(deck.draw(Tier::Rare, &held, &mut rng).unwrap().1, Tier::Common);
}

// ---------------------------------------------------------------- odds

#[test]
fn tier_odds_and_golden_chance() {
    let mut rng = StdRng::seed_from_u64(5);
    let n = 40_000;
    let mut c = [0; 3];
    for _ in 0..n {
        c[roll_tier(GOLDEN_BASE, &mut rng) as usize] += 1;
    }
    let pct = |i: usize| c[i] as f64 / n as f64;
    assert!((pct(0) - 0.65).abs() < 0.01 && (pct(1) - 0.25).abs() < 0.01 && (pct(2) - 0.10).abs() < 0.01, "{c:?}");
    // A higher Golden chance comes out of the Common share.
    let mut c = [0; 3];
    for _ in 0..n {
        c[roll_tier(20, &mut rng) as usize] += 1;
    }
    assert!((c[1] as f64 / n as f64 - 0.25).abs() < 0.01);
    assert_eq!(chance_after_draw(10, Tier::Common), 12);
    assert_eq!(chance_after_draw(19, Tier::Rare), 20);
    assert_eq!(chance_after_draw(18, Tier::Golden), 10);
    assert_eq!(chance_after_lead(20), 20);
    assert_eq!(chance_after_lead(14), 15);
}

// ---------------------------------------------------------------- comeback

#[test]
fn underdogs_from_round_three_a_third_of_the_target_behind() {
    assert_eq!([15, 20, 25, 30].map(underdog_gap), [5, 7, 9, 10]);
    let scores: BTreeMap<String, i32> = [("a", 10), ("b", 3), ("c", 4), ("d", 10)].map(|(k, v)| (s(k), v)).into();
    assert!(underdogs(&scores, 20, 2).is_empty());
    assert_eq!(underdogs(&scores, 20, 3), set(&["b"]));
    assert_eq!(leaders(&scores), set(&["a", "d"]));
    let zero: BTreeMap<String, i32> = [("a", 0), ("b", 0)].map(|(k, v)| (s(k), v)).into();
    assert!(leaders(&zero).is_empty(), "nobody leads at 0");
}

#[test]
fn the_bounty_grows_while_the_leader_survives_and_resets_after_paying() {
    let lead = set(&["a"]);
    let mut b = Bounty::default();
    assert_eq!(b.current(&lead), 1);
    for want in [2, 3, 3] {
        let (paid, next) = b.settle(&lead, false, true);
        assert_eq!((paid, next.value), (0, want));
        b = next;
    }
    let (paid, next) = b.settle(&lead, true, true);
    assert_eq!((paid, next.value), (3, 1));
    // A new leader starts the Bounty over.
    assert_eq!(b.current(&set(&["z"])), 1);
    // No Underdogs: nothing to pay, nothing reset.
    let (paid, next) = b.settle(&lead, true, false);
    assert_eq!((paid, next.value), (0, 3));
}

// ---------------------------------------------------------------- clash rules (one test per sheet row)

#[test]
fn clash_seat_first_played_wins_between_commons() {
    assert!(beats((Tier::Common, 1), (Tier::Common, 2)));
    assert!(!beats((Tier::Common, 2), (Tier::Common, 1)));
}

#[test]
fn clash_lawyer_up_blocks_commons_whenever_they_were_played() {
    for card in ["put-on-the-spot", "anonymous-tip"] {
        assert!(aims_at_player(card));
        assert_eq!(against_lawyer((tier_of(card), 1), 5), Some(Verdict::Blocked));
        assert_eq!(against_lawyer((tier_of(card), 9), 5), Some(Verdict::Blocked));
    }
}

#[test]
fn clash_lawyer_up_against_rares_the_first_played_wins() {
    for card in ["private-eye", "wiretap", "pocket-veto", "objection"] {
        assert!(aims_at_player(card));
        assert_eq!(against_lawyer((Tier::Rare, 6), 5), Some(Verdict::Blocked), "{card} after Lawyer Up");
        assert_eq!(against_lawyer((Tier::Rare, 4), 5), None, "{card} before Lawyer Up already worked");
    }
}

#[test]
fn clash_golden_cards_pierce_lawyer_up() {
    for card in ["x-ray", "spotlight", "shadow"] {
        assert!(aims_at_player(card));
        assert_eq!(against_lawyer((tier_of(card), 9), 1), Some(Verdict::Pierced));
    }
}

#[test]
fn clash_objection_sustained_against_commons_and_bluffs() {
    assert_eq!(objection(tier_of("cover-story")), Verdict::Sustained);
    assert_eq!(objection(tier_of("bluff-card")), Verdict::Sustained, "a Bluff is Common whatever it announced");
}

#[test]
fn clash_objection_overruled_by_rare_and_golden() {
    assert_eq!(objection(tier_of("heavy-vote")), Verdict::Overruled);
    assert_eq!(objection(tier_of("midas-touch")), Verdict::Overruled);
}

#[test]
fn clash_pocket_veto_beats_a_vote_and_a_heavy_vote() {
    assert_eq!(veto(false), Verdict::Vetoed);
    let votes: BTreeMap<String, String> = [("j", "b"), ("h", "b"), ("c", "x"), ("d", "x"), ("e", "x")]
        .map(|(k, v)| (s(k), s(v))).into();
    let w = Weights { judge: Some(s("j")), judge_doubles: true, heavy: set(&["h"]), vetoed: set(&["h"]), ..Default::default() };
    let t = tally(&votes, "x", &w);
    assert_eq!(t.against["b"], 2, "the vetoed Heavy Vote counts nothing");
}

#[test]
fn clash_pocket_veto_overruled_by_golden_ballot() {
    assert_eq!(veto(true), Verdict::Overruled);
    let votes: BTreeMap<String, String> = [("g", "b")].map(|(k, v)| (s(k), s(v))).into();
    let w = Weights { golden: set(&["g"]), vetoed: set(&["g"]), ..Default::default() };
    assert_eq!(tally(&votes, "x", &w).against["b"], 4);
}

#[test]
fn clash_two_pocket_vetoes_both_apply() {
    let votes: BTreeMap<String, String> = [("a", "x"), ("b", "x"), ("c", "y")].map(|(k, v)| (s(k), s(v))).into();
    let w = Weights { vetoed: set(&["a", "b"]), ..Default::default() };
    assert_eq!(tally(&votes, "i", &w).accused, Some(s("y")));
}

#[test]
fn clash_reads_never_clash_with_turncoat() {
    // Reads show the dealt side and role; nothing in the ladder touches Turncoat.
    assert!(!aims_at_player("turncoat"));
}

#[test]
fn clash_a_sustained_objection_cannot_undo_what_already_happened() {
    // Settlement only sees what is still pending: a cancelled On the Record pays nothing.
    let seats = seats_with(&[("o", Role::Gambler, 0, 0, Some("imp"))]);
    let mut plays = vec![play(1, "o", "on-the-record", None)];
    assert_eq!(settle_simple(&seats, &plays).scores["o"].cards(), 2);
    plays[0].cancelled = true;
    assert_eq!(settle_simple(&seats, &plays).scores["o"].cards(), 0);
}

// ---------------------------------------------------------------- tally

#[test]
fn tally_weights_the_judge_heavy_vote_and_golden_ballot() {
    let votes: BTreeMap<String, String> = [("j", "a"), ("h", "b"), ("p", "c"), ("imp", "c")]
        .map(|(k, v)| (s(k), s(v))).into();
    let w = Weights { judge: Some(s("j")), judge_doubles: true, heavy: set(&["h"]), ..Default::default() };
    let t = tally(&votes, "imp", &w);
    assert_eq!((t.against["a"], t.against["b"], t.against["c"]), (2, 2, 1), "the Imposter's vote never counts");
    // Judge with Heavy Vote: three.
    let w = Weights { judge: Some(s("j")), judge_doubles: true, heavy: set(&["j"]), ..Default::default() };
    assert_eq!(tally(&votes, "imp", &w).against["a"], 3);
    // Golden Ballot: four in total, the Judge included (4, not 8).
    let w = Weights { judge: Some(s("j")), judge_doubles: true, golden: set(&["h", "j"]), ..Default::default() };
    let t = tally(&votes, "imp", &w);
    assert_eq!((t.against["a"], t.against["b"], t.against["c"]), (4, 4, 1));
}

#[test]
fn tally_tiebreak_needs_a_counted_judge_vote_for_the_imposter() {
    let votes: BTreeMap<String, String> = [("j", "imp"), ("a", "b"), ("c", "b")].map(|(k, v)| (s(k), s(v))).into();
    let w = Weights { judge: Some(s("j")), judge_doubles: true, ..Default::default() };
    let t = tally(&votes, "imp", &w);
    assert!(t.judge_tiebreak && t.accused == Some(s("imp")));
    // A vetoed Judge loses the double and the tiebreak: the room accuses b.
    let w = Weights { vetoed: set(&["j"]), ..w };
    let t = tally(&votes, "imp", &w);
    assert!(!t.judge_tiebreak && t.accused == Some(s("b")));
}

// ---------------------------------------------------------------- settlement helpers

fn play(seq: u32, owner: &str, card: &str, pick: Option<&str>) -> Play {
    Play { seq, owner: s(owner), card: s(card), pick: pick.map(s), cancelled: false }
}

/// (id, role, score before, stake, vote)
fn seats_with(rows: &[(&str, Role, i32, u32, Option<&str>)]) -> BTreeMap<String, Seat> {
    rows.iter()
        .map(|(id, role, before, stake, vote)| {
            (s(id), Seat { role: Some(*role), before: *before, stake: *stake, vote: vote.map(s), ..Default::default() })
        })
        .collect()
}

struct Ctx {
    facts: Facts,
    accused: Option<String>,
    last_word: Option<bool>,
    underdogs: BTreeSet<String>,
    leaders: BTreeSet<String>,
    bounty: Bounty,
    tally: Tally,
}

impl Default for Ctx {
    fn default() -> Self {
        // Default verdict: the Imposter ("imp") is caught.
        Ctx {
            facts: Facts { escaped: false, ..Default::default() },
            accused: Some(s("imp")),
            last_word: None,
            underdogs: BTreeSet::new(),
            leaders: BTreeSet::new(),
            bounty: Bounty::default(),
            tally: Tally::default(),
        }
    }
}

fn settle_with(seats: &BTreeMap<String, Seat>, plays: &[Play], c: &Ctx) -> Settled {
    settle(&Round {
        seats,
        facts: c.facts,
        imposter: "imp",
        accused: c.accused.as_deref(),
        tally: &c.tally,
        plays,
        last_word: c.last_word,
        underdogs: &c.underdogs,
        leaders: &c.leaders,
        bounty: &c.bounty,
    })
}

fn settle_simple(seats: &BTreeMap<String, Seat>, plays: &[Play]) -> Settled {
    settle_with(seats, plays, &Ctx::default())
}

fn escaped() -> Ctx {
    Ctx { facts: Facts { escaped: true, pair_named: true, ..Default::default() }, accused: Some(s("x")), ..Default::default() }
}

// ---------------------------------------------------------------- each scoring card

#[test]
fn on_the_record_pays_two_only_for_the_imposter_pick() {
    let seats = seats_with(&[("a", Role::Gambler, 0, 0, Some("imp")), ("b", Role::Judge, 0, 0, Some("x"))]);
    let plays = [play(1, "a", "on-the-record", None), play(2, "b", "on-the-record", None)];
    let out = settle_simple(&seats, &plays);
    assert_eq!((out.scores["a"].cards(), out.scores["b"].cards()), (2, 0));
}

#[test]
fn sealed_alibi_pays_three_when_the_prediction_lands_and_your_side_wins() {
    let seats = seats_with(&[("civ", Role::Gambler, 0, 0, Some("imp")), ("imp", Role::Imposter, 0, 0, Some("x")), ("acc", Role::Accomplice, 0, 0, Some("x"))]);
    let plays = [play(1, "civ", "sealed-alibi", Some("imp")), play(2, "acc", "sealed-alibi", Some("imp"))];
    let out = settle_simple(&seats, &plays);
    assert_eq!(out.scores["civ"].cards(), 3);
    assert_eq!(out.scores["acc"].cards(), 0, "right prediction, but the Accomplice's side lost");
    // Villains predict an innocent and steer the room onto them.
    let plays = [play(1, "acc", "sealed-alibi", Some("x"))];
    assert_eq!(settle_with(&seats, &plays, &escaped()).scores["acc"].cards(), 3);
}

#[test]
fn decoy_contract_pays_three_if_the_room_accuses_you_even_when_voided() {
    let seats = seats_with(&[("x", Role::Decoy, 0, 0, Some("a"))]);
    let c = Ctx { facts: Facts { escaped: true, decoy_caught: true, ..Default::default() }, accused: Some(s("x")), ..Default::default() };
    let out = settle_with(&seats, &[play(1, "x", "decoy-contract", None)], &c);
    assert!(out.scores["x"].award.voided);
    assert_eq!(out.scores["x"].cards(), 3);
}

#[test]
fn second_opinion_saves_the_read_but_not_the_bet() {
    let seats = seats_with(&[("g", Role::Judge, 5, 2, Some("x"))]);
    let out = settle_simple(&seats, &[play(1, "g", "second-opinion", Some("imp"))]);
    let sc = &out.scores["g"];
    assert_eq!((sc.award.base, sc.award.bet, sc.lost), (2, -2, false), "Judge keeps +2 and skips Drink/Dare");
    // A wrong backup changes nothing.
    let out = settle_simple(&seats, &[play(1, "g", "second-opinion", Some("y"))]);
    assert!(out.scores["g"].lost);
}

#[test]
fn double_or_nothing_doubles_the_bet_and_the_underdog_bonus_comes_after() {
    let seats = seats_with(&[("g", Role::Gambler, 3, 3, Some("imp")), ("l", Role::Gambler, 9, 3, Some("x"))]);
    let plays = [play(1, "g", "double-or-nothing", None), play(2, "l", "double-or-nothing", None)];
    let out = settle_simple(&seats, &plays);
    assert_eq!((out.scores["g"].award.bet, out.scores["l"].award.bet), (10, -6));
    let c = Ctx { underdogs: set(&["g"]), ..Default::default() };
    assert_eq!(settle_with(&seats, &plays, &c).scores["g"].award.bet, 11);
}

#[test]
fn midas_touch_triples_gains_only() {
    let best = Ctx {
        facts: Facts { escaped: true, perfect_bluff: true, pair_named: true, decoy_caught: true, ..Default::default() },
        accused: Some(s("x")),
        ..Default::default()
    };
    let seats = seats_with(&[("imp", Role::Imposter, 9, 3, Some("x"))]);
    let plays = [play(1, "imp", "midas-touch", None)];
    assert_eq!(settle_with(&seats, &plays, &best).scores["imp"].total(), 24);
    let under = Ctx { underdogs: set(&["imp"]), ..best };
    assert_eq!(settle_with(&seats, &plays, &under).scores["imp"].total(), 27);
    // Losses stay at their normal value.
    assert_eq!(settle_simple(&seats, &plays).scores["imp"].total(), -3);
}

#[test]
fn golden_pardon_turns_a_loss_into_plus_five_and_the_bet_still_settles() {
    let seats = seats_with(&[("imp", Role::Imposter, 9, 3, Some("x"))]);
    let out = settle_simple(&seats, &[play(1, "imp", "golden-pardon", None)]);
    let sc = &out.scores["imp"];
    assert_eq!((sc.total(), sc.lost), (2, false));
    // No loss, no pardon.
    let out = settle_with(&seats, &[play(1, "imp", "golden-pardon", None)], &escaped());
    assert_eq!(out.scores["imp"].cards(), 0);
}

#[test]
fn turncoat_scores_four_on_an_escape_and_drinks_if_the_imposter_is_caught() {
    let seats = seats_with(&[("t", Role::Detective, 5, 2, Some("x"))]);
    let plays = [play(1, "t", "turncoat", None)];
    let sc = settle_with(&seats, &plays, &escaped()).scores["t"].clone();
    assert_eq!((sc.award.base, sc.award.bet, sc.lost), (4, 2, false));
    let sc = settle_simple(&seats, &plays).scores["t"].clone();
    assert_eq!((sc.total(), sc.lost), (-2, true));
}

#[test]
fn crown_heist_raises_you_to_the_leaders_starting_score_if_you_win() {
    let seats = seats_with(&[("c", Role::Gambler, 4, 0, Some("imp")), ("lead", Role::Judge, 15, 0, Some("imp"))]);
    let out = settle_simple(&seats, &[play(1, "c", "crown-heist", None)]);
    // 4 + 1 for the read, then +10 to reach 15.
    assert_eq!(out.scores["c"].total(), 11);
    let seats = seats_with(&[("c", Role::Gambler, 4, 0, Some("x")), ("lead", Role::Judge, 15, 0, Some("imp"))]);
    assert_eq!(settle_simple(&seats, &[play(1, "c", "crown-heist", None)]).scores["c"].cards(), 0);
}

#[test]
fn shadow_copies_its_marks_positive_total_including_card_awards() {
    let seats = seats_with(&[("s", Role::Gambler, 0, 0, Some("x")), ("m", Role::Gambler, 3, 3, Some("imp")), ("n", Role::Gambler, 3, 3, Some("x"))]);
    let plays = [play(1, "s", "shadow", Some("m")), play(2, "m", "on-the-record", None)];
    let out = settle_simple(&seats, &plays);
    assert_eq!(out.scores["m"].total(), 1 + 5 + 2);
    assert_eq!(out.scores["s"].cards(), 8);
    // Losses aren't copied.
    let out = settle_simple(&seats, &[play(1, "s", "shadow", Some("n"))]);
    assert_eq!(out.scores["s"].cards(), 0);
}

#[test]
fn robin_hood_takes_five_from_every_leader() {
    let seats = seats_with(&[("r", Role::Gambler, 2, 0, None), ("l1", Role::Judge, 12, 0, None), ("l2", Role::Decoy, 12, 0, None), ("u", Role::Gambler, 1, 0, None)]);
    let plays = [play(1, "r", "robin-hood", None)];
    let c = Ctx { leaders: set(&["l1", "l2"]), underdogs: set(&["r", "u"]), ..Default::default() };
    let out = settle_with(&seats, &plays, &c);
    let rh = |id: &str| out.scores[id].lines.iter().filter(|l| l.card == "robin-hood").map(|l| l.points).sum::<i32>();
    assert_eq!((rh("l1"), rh("l2"), rh("u"), rh("r")), (-5, -5, 2, 2));
    // No Underdogs: the five go to whoever played it.
    let c = Ctx { leaders: set(&["l1"]), ..Default::default() };
    let out = settle_with(&seats, &plays, &c);
    assert_eq!(out.scores["r"].lines.iter().map(|l| l.points).sum::<i32>(), 5);
}

// ---------------------------------------------------------------- passives

fn with_passives(mut seats: BTreeMap<String, Seat>, id: &str, cards: &[&str]) -> BTreeMap<String, Seat> {
    seats.get_mut(id).unwrap().passives = cards.iter().map(|c| s(c)).collect();
    seats
}

#[test]
fn safety_net_returns_one_on_a_lost_bet_of_two_or_more() {
    let seats = with_passives(seats_with(&[("a", Role::Gambler, 5, 2, Some("x"))]), "a", &["safety-net"]);
    let out = settle_simple(&seats, &[]);
    assert_eq!(out.scores["a"].total(), -2 + 1);
    assert_eq!(out.fired, vec![(s("a"), s("safety-net"))]);
}

#[test]
fn rain_check_carries_a_free_bet_into_the_next_round() {
    let seats = with_passives(seats_with(&[("a", Role::Gambler, 5, 2, Some("x"))]), "a", &["rain-check"]);
    let out = settle_simple(&seats, &[]);
    assert!(out.rain_checks.contains("a"));
    let mut next = seats_with(&[("a", Role::Gambler, 3, 3, Some("x"))]);
    next.get_mut("a").unwrap().rain_check = true;
    let sc = &settle_simple(&next, &[]).scores["a"];
    assert_eq!(sc.award.bet, 0);
}

#[test]
fn clean_hands_needs_a_right_read_and_no_counted_vote_against_you() {
    let seats = with_passives(seats_with(&[("a", Role::Gambler, 0, 0, Some("imp"))]), "a", &["clean-hands"]);
    assert_eq!(settle_simple(&seats, &[]).scores["a"].cards(), 2);
    let c = Ctx { tally: Tally { against: [(s("a"), 1)].into(), ..Default::default() }, ..Default::default() };
    assert_eq!(settle_with(&seats, &[], &c).scores["a"].cards(), 0);
}

#[test]
fn jackpot_pays_four_for_staying_out_of_drink_or_dare() {
    let seats = with_passives(seats_with(&[("a", Role::Gambler, 0, 0, Some("imp")), ("b", Role::Gambler, 0, 0, Some("x"))]), "a", &["jackpot"]);
    let seats = with_passives(seats, "b", &["jackpot"]);
    let out = settle_simple(&seats, &[]);
    assert_eq!((out.scores["a"].cards(), out.scores["b"].cards()), (4, 0));
    assert_eq!(out.fired, vec![(s("a"), s("jackpot"))], "a Jackpot that can't work stays in hand");
}

#[test]
fn the_oldest_passive_that_can_work_fires_and_an_active_play_makes_them_wait() {
    let seats = with_passives(seats_with(&[("a", Role::Gambler, 5, 2, Some("x"))]), "a", &["jackpot", "clean-hands", "safety-net"]);
    let out = settle_simple(&seats, &[]);
    assert_eq!(out.fired, vec![(s("a"), s("safety-net"))], "jackpot and clean hands can't work, safety net can");
    // Any active play, even a cancelled one, holds every passive.
    let mut p = play(1, "a", "cover-story", None);
    p.cancelled = true;
    assert!(settle_simple(&seats, &[p]).fired.is_empty());
}

#[test]
fn last_word_right_scores_the_imposter_side_as_escaped() {
    let seats = with_passives(
        seats_with(&[("imp", Role::Imposter, 0, 2, Some("x")), ("acc", Role::Accomplice, 0, 1, Some("x")), ("civ", Role::Gambler, 0, 0, Some("imp"))]),
        "imp",
        &["jackpot", "last-word"],
    );
    let c = Ctx { last_word: Some(true), facts: Facts { escaped: false, pair_named: true, ..Default::default() }, ..Default::default() };
    let out = settle_with(&seats, &[], &c);
    assert_eq!(out.scores["imp"].award.base, 2);
    assert!(!out.scores["imp"].lost && !out.scores["acc"].lost);
    assert_eq!(out.scores["civ"].award.base, 1, "civilians keep the room's verdict");
    assert_eq!(out.fired, vec![(s("imp"), s("last-word"))], "Last Word takes the round's passive");
    let c = Ctx { last_word: Some(false), ..Default::default() };
    let out = settle_with(&seats, &[], &c);
    assert!(out.scores["imp"].lost);
    assert_eq!(out.fired, vec![(s("imp"), s("last-word"))]);
}

#[test]
fn cardboard_crown_breaks_a_tie_for_first() {
    let w = vec![s("a"), s("b")];
    assert_eq!(crown(&w, &set(&["b"])), vec![s("b")]);
    assert_eq!(crown(&w, &set(&["a", "b"])), w);
    assert_eq!(crown(&[s("a")], &set(&["b"])), vec![s("a")]);
}

// ---------------------------------------------------------------- comeback inside settlement

#[test]
fn an_underdog_who_loses_an_uncovered_bet_drinks_and_the_bounty_pays_when_the_leader_loses() {
    let seats = seats_with(&[("u", Role::Gambler, 1, 3, Some("imp")), ("v", Role::Gambler, 0, 3, Some("x")), ("lead", Role::Judge, 12, 0, Some("x"))]);
    let c = Ctx { underdogs: set(&["u", "v"]), leaders: set(&["lead"]), bounty: Bounty { leaders: set(&["lead"]), value: 2 }, ..Default::default() };
    let out = settle_with(&seats, &[], &c);
    assert_eq!(out.scores["u"].award.bet, 6, "Gambler top tier +5, +1 as an Underdog");
    assert!(out.scores["v"].lost, "lost a 3 bet with 0 points");
    assert!(out.leader_lost && out.bounty_paid == 2);
    assert!(out.scores["u"].lines.contains(&Line { card: s("bounty"), from: s(""), points: 2 }));
    assert_eq!(out.bounty_next.value, 1);
}

// ---------------------------------------------------------------- fuzz

#[test]
fn fuzz_random_rounds_with_random_cards_settle_consistently() {
    let mut rng = StdRng::seed_from_u64(42);
    let actives: Vec<&str> = catalog().iter().filter(|c| c.kind == Kind::Active).map(|c| c.id.as_str()).collect();
    let passives: Vec<&str> = catalog().iter().filter(|c| c.kind == Kind::Passive).map(|c| c.id.as_str()).collect();
    for round in 0..2_000 {
        let n = rng.gen_range(6..=12);
        let ids: Vec<String> = (0..n).map(|i| if i == 0 { s("imp") } else { format!("p{i}") }).collect();
        let mut roles = vec![Role::Imposter, Role::Accomplice, Role::Detective, Role::Judge, Role::Decoy];
        roles.resize(n, Role::Gambler);
        roles[1..].shuffle(&mut rng);
        let mut seats = BTreeMap::new();
        for (i, id) in ids.iter().enumerate() {
            let vote = loop {
                let v = ids.choose(&mut rng).unwrap();
                if v != id { break v.clone() }
            };
            seats.insert(id.clone(), Seat {
                role: Some(roles[i]),
                before: rng.gen_range(0..25),
                stake: rng.gen_range(0..=3),
                vote: Some(vote),
                side_pick: rng.gen_bool(0.3),
                passives: {
                    let k = rng.gen_range(0..3);
                    passives.choose_multiple(&mut rng, k).map(|c| s(c)).collect()
                },
                rain_check: rng.gen_bool(0.1),
            });
        }
        let mut plays = vec![];
        for (seq, id) in ids.iter().enumerate() {
            if rng.gen_bool(0.4) {
                let card = *actives.choose(&mut rng).unwrap();
                plays.push(Play { seq: seq as u32, owner: id.clone(), card: s(card), pick: Some(ids.choose(&mut rng).unwrap().clone()), cancelled: rng.gen_bool(0.15) });
            }
        }
        let votes: BTreeMap<String, String> = seats.iter().map(|(k, v)| (k.clone(), v.vote.clone().unwrap())).collect();
        let w = Weights { judge: ids.get(3).cloned(), judge_doubles: true, ..Default::default() };
        let t = tally(&votes, "imp", &w);
        let facts = Facts {
            escaped: t.accused.as_deref() != Some("imp"),
            pair_named: rng.gen_bool(0.5),
            accomplice_caught: rng.gen_bool(0.3),
            decoy_caught: rng.gen_bool(0.3),
            ..Default::default()
        };
        let scores: BTreeMap<String, i32> = seats.iter().map(|(k, v)| (k.clone(), v.before)).collect();
        let leaders = leaders(&scores);
        let underdogs = underdogs(&scores, 20, 3 + round % 5);
        let bounty = Bounty { leaders: leaders.clone(), value: rng.gen_range(1..=3) };
        let last_word = (!facts.escaped && rng.gen_bool(0.2)).then(|| rng.gen_bool(0.5));
        let out = settle(&Round {
            seats: &seats, facts, imposter: "imp", accused: t.accused.as_deref(), tally: &t, plays: &plays,
            last_word, underdogs: &underdogs, leaders: &leaders, bounty: &bounty,
        });
        assert_eq!(out.scores.len(), n);
        let active: BTreeSet<&str> = plays.iter().map(|p| p.owner.as_str()).collect();
        for (id, sc) in &out.scores {
            // A spotted player gains nothing from their role, whatever cards add.
            if sc.award.voided {
                assert_eq!((sc.award.base, sc.award.bluff, sc.award.bonus), (0, 0, 0), "round {round} {id}");
                assert!(sc.award.bet <= 0);
            }
            assert_eq!(sc.total(), sc.award.total() + sc.cards());
            // At most one passive per player, and never alongside an active play.
            let fired = out.fired.iter().filter(|(o, _)| o == id).count();
            assert!(fired <= 1 && !(fired == 1 && active.contains(id.as_str())), "round {round} {id}");
        }
        for p in plays.iter().filter(|p| !p.cancelled && p.card == "shadow") {
            let mark = p.pick.as_deref().unwrap();
            if mark != p.owner {
                let shadowed: i32 = out.scores[&p.owner].lines.iter().filter(|l| l.card == "shadow").map(|l| l.points).sum();
                assert_eq!(shadowed, out.scores[mark].total().max(0), "round {round}");
            }
        }
    }
}
