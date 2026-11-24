//! Full Cast: every player in a 6+ party holds a role. This module keeps the
//! pure parts — the joint weighted deal and per-role scoring — so they can be
//! tested without driving a whole round.
use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const MIN_PLAYERS: usize = 3;

/// The Judge's ballot only weighs double once the room is big enough that it
/// cannot decide alone: below this the Judge keeps the tiebreak and nothing more.
pub const JUDGE_DOUBLE_FROM: usize = 6;

/// Under this size the Decoy holds the real word and plays as bait — a cousin
/// word needs a majority of real-word holders to be misread against.
pub const DECOY_WORD_FROM: usize = 5;

/// Which roles are dealt at this size; everyone left over is a Gambler. The
/// Accomplice and the Detective are a pair: an accomplice nobody can spot earns
/// risk-free, and a detective with nobody to hunt has no second read to make.
pub fn specials(players: usize) -> &'static [Role] {
    match players {
        0..=2 => &[],
        3 => &[Role::Imposter, Role::Decoy],
        4 => &[Role::Imposter, Role::Decoy, Role::Judge],
        _ => &Role::SPECIAL,
    }
}

/// Small parties: the Decoy holds the real word and scores by drawing suspicion.
pub fn bait_decoy(players: usize) -> bool {
    players < DECOY_WORD_FROM
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Imposter,
    Accomplice,
    Detective,
    Judge,
    Decoy,
    Gambler,
}

impl Role {
    /// Exactly one of each per round; everyone else is a Gambler.
    pub const SPECIAL: [Self; 5] = [
        Self::Imposter,
        Self::Accomplice,
        Self::Detective,
        Self::Judge,
        Self::Decoy,
    ];
}

/// One Full Cast round's secret seating, frozen at the deal.
#[derive(Clone, Debug, Default)]
pub struct Cast {
    pub roles: BTreeMap<String, Role>,
    /// Shown only to the Detective: neither the imposter nor the accomplice.
    pub cleared: String,
    pub decoy_word: String,
    pub decoy_definition: String,
}

impl Cast {
    pub fn holder(&self, role: Role) -> &str {
        self.roles
            .iter()
            .find(|(_, r)| **r == role)
            .map(|(id, _)| id.as_str())
            .unwrap_or_default()
    }
}

/// Extra ballot choices: the imposter names an accomplice and a decoy; the
/// detective names an accomplice, and their bet rides on that pick.
#[derive(Clone, Debug, Default, Serialize)]
pub struct Picks {
    pub accomplice: Option<String>,
    pub decoy: Option<String>,
}

/// The shared fairness curve: one extra turn above the group minimum drops the
/// weight to 1/4, two to 1/9, capped at a gap of 15, and the most recent holder
/// is halved again. Never zero, so no assignment can be ruled out by the table.
pub fn weight(turns: u64, minimum: u64, recent: bool) -> f64 {
    let gap = turns.saturating_sub(minimum).min(15) as f64;
    (if recent { 0.5 } else { 1.0 }) / (1.0 + gap).powi(2)
}

/// Deals one of each special role and Gambler to the rest. Each complete
/// assignment is drawn with probability proportional to the product of every
/// player's weight for the role they receive, so a player's chance of each
/// role falls after holding it but never reaches zero.
///
/// The Gambler weights are folded in as a ratio, which leaves the product over
/// the whole roster unchanged up to a constant: only five seats are enumerated.
/// ponytail: full enumeration, at most 12·11·10·9·8 = 95,040 assignments.
pub fn assign(
    players: &[String],
    weight_of: impl Fn(Role, &str) -> f64,
    rng: &mut impl rand::Rng,
) -> Option<BTreeMap<String, Role>> {
    let n = players.len();
    let specials = specials(n);
    if n < MIN_PLAYERS || specials.is_empty() {
        return None;
    }
    let table: Vec<[f64; 5]> = players
        .iter()
        .map(|p| {
            let gambler = weight_of(Role::Gambler, p);
            let mut row = [1.0; 5];
            for (seat, role) in specials.iter().enumerate() {
                row[seat] = weight_of(*role, p) / gambler;
            }
            row
        })
        .collect();
    let mut options: Vec<([usize; 5], f64)> = Vec::new();
    let mut seats = [0usize; 5];
    fn fill(
        depth: usize,
        seats_to_fill: usize,
        n: usize,
        product: f64,
        seats: &mut [usize; 5],
        table: &[[f64; 5]],
        out: &mut Vec<([usize; 5], f64)>,
    ) {
        if depth == seats_to_fill {
            out.push((*seats, product));
            return;
        }
        for p in 0..n {
            if seats[..depth].contains(&p) {
                continue;
            }
            seats[depth] = p;
            fill(
                depth + 1,
                seats_to_fill,
                n,
                product * table[p][depth],
                seats,
                table,
                out,
            );
        }
    }
    fill(0, specials.len(), n, 1.0, &mut seats, &table, &mut options);
    let (seats, _) = options.choose_weighted(rng, |(_, w)| *w).ok()?;
    let mut roles: BTreeMap<String, Role> =
        players.iter().map(|p| (p.clone(), Role::Gambler)).collect();
    for (role, &seat) in specials.iter().zip(seats) {
        roles.insert(players[seat].clone(), *role);
    }
    Some(roles)
}

/// What the room decided, from which every Full Cast score follows.
#[derive(Clone, Copy, Debug, Default)]
pub struct Facts {
    pub escaped: bool,
    pub perfect_bluff: bool,
    pub accomplice_caught: bool,
    pub decoy_caught: bool,
    pub pair_named: bool,
    /// Small parties: the Decoy holds the real word and wants the suspicion.
    pub bait_decoy: bool,
    /// Bait Decoy only: at least one ballot named them.
    pub decoy_voted: bool,
    /// Bait Decoy only: the room convicted them, so the bluff went too far.
    pub decoy_convicted: bool,
}

impl Facts {
    /// Paid to both the imposter and the accomplice.
    pub fn pair_bonus(&self) -> bool {
        self.escaped && self.pair_named && !self.accomplice_caught
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Award {
    pub base: i32,
    pub bet: i32,
    pub bluff: i32,
    pub bonus: i32,
    pub voided: bool,
    /// Joins the Drink/Dare queue.
    pub lost: bool,
}

/// `correct`: the player's accusation named the imposter. `side_pick`: the
/// detective's accomplice pick was right; their stake always rides on it.
pub fn award(
    role: Role,
    facts: &Facts,
    correct: bool,
    side_pick: bool,
    stake: u32,
) -> Award {
    let s = stake as i32;
    let settle = |won: bool| if won { s } else { -s };
    let mut a = match role {
        Role::Imposter => Award {
            base: if facts.escaped { 2 } else { 0 },
            bluff: i32::from(facts.perfect_bluff),
            // A caught imposter gains nothing; the decoy catch still voids the decoy.
            bonus: if facts.escaped {
                i32::from(facts.pair_bonus()) + i32::from(facts.decoy_caught)
            } else {
                0
            },
            bet: settle(facts.escaped),
            lost: !facts.escaped,
            ..Default::default()
        },
        Role::Accomplice => Award {
            base: i32::from(facts.escaped),
            bonus: i32::from(facts.pair_bonus()),
            // A team bet: it rides on the imposter escaping.
            bet: settle(facts.escaped),
            voided: facts.accomplice_caught,
            lost: facts.accomplice_caught || !facts.escaped,
            ..Default::default()
        },
        Role::Detective => Award {
            base: i32::from(correct),
            bonus: i32::from(side_pick),
            bet: settle(side_pick),
            lost: !correct,
            ..Default::default()
        },
        Role::Judge => Award {
            base: if correct { 2 } else { 0 },
            bet: settle(correct),
            lost: !correct,
            ..Default::default()
        },
        // Below five the Decoy holds the real word: they score by pulling
        // suspicion onto themselves, and lose it all if the room convicts them.
        Role::Decoy if facts.bait_decoy => Award {
            base: i32::from(correct),
            bonus: i32::from(facts.decoy_voted),
            bet: settle(correct),
            voided: facts.decoy_convicted,
            lost: !correct || facts.decoy_convicted,
            ..Default::default()
        },
        Role::Decoy => Award {
            base: i32::from(correct),
            bonus: i32::from(!facts.escaped),
            bet: settle(correct),
            voided: facts.decoy_caught,
            lost: !correct || facts.decoy_caught,
            ..Default::default()
        },
        Role::Gambler => Award {
            base: i32::from(correct),
            // The top tier pays +5 against a 3-point risk.
            bet: if correct && stake == 3 { 5 } else { settle(correct) },
            lost: !correct,
            ..Default::default()
        },
    };
    if a.voided {
        // Spotted: no gains this round, but a lost bet still costs its stake.
        a.base = 0;
        a.bluff = 0;
        a.bonus = 0;
        a.bet = a.bet.min(0);
    }
    a
}

impl Award {
    pub fn total(&self) -> i32 {
        self.base + self.bet + self.bluff + self.bonus
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::{rngs::StdRng, SeedableRng};

    fn ids(n: usize) -> Vec<String> {
        (0..n).map(|i| format!("p{i}")).collect()
    }

    #[test]
    fn every_size_deals_its_lineup_and_gamblers_for_the_rest() {
        let mut rng = StdRng::seed_from_u64(7);
        assert!(assign(&ids(2), |_, _| 1.0, &mut rng).is_none());
        for n in 3..=12 {
            let roles = assign(&ids(n), |_, _| 1.0, &mut rng).unwrap();
            let lineup = specials(n);
            assert_eq!(roles.len(), n);
            for role in Role::SPECIAL {
                let want = usize::from(lineup.contains(&role));
                assert_eq!(roles.values().filter(|r| **r == role).count(), want, "n={n}");
            }
            assert_eq!(
                roles.values().filter(|r| **r == Role::Gambler).count(),
                n - lineup.len()
            );
        }
        // The dealt table: Judge from four, the Accomplice/Detective pair from five.
        assert_eq!(specials(3), [Role::Imposter, Role::Decoy]);
        assert_eq!(specials(4), [Role::Imposter, Role::Decoy, Role::Judge]);
        assert_eq!(specials(5).len(), 5);
        for (n, gamblers) in [(3, 1), (4, 1), (5, 0), (6, 1), (7, 2)] {
            assert_eq!(n - specials(n).len(), gamblers, "n={n}");
        }
    }

    #[test]
    fn repeat_holders_are_less_likely_but_never_excluded() {
        let players = ids(6);
        let mut rng = StdRng::seed_from_u64(11);
        // p0 has been the Judge three more times than anyone and held it last.
        let w = |role: Role, p: &str| {
            if role == Role::Judge && p == "p0" {
                weight(3, 0, true)
            } else {
                1.0
            }
        };
        let draws = 20_000;
        let judged = (0..draws)
            .filter(|_| assign(&players, w, &mut rng).unwrap()["p0"] == Role::Judge)
            .count();
        // Untouched odds are 1/6; p0 keeps a small, nonzero chance.
        assert!(judged > 0 && judged < draws / 30, "judged={judged}");
    }

    #[test]
    fn level_history_gives_every_player_every_role_evenly() {
        let players = ids(7);
        let mut rng = StdRng::seed_from_u64(3);
        let mut seen: BTreeMap<(String, Role), u32> = BTreeMap::new();
        let draws = 14_000;
        for _ in 0..draws {
            for (p, r) in assign(&players, |_, _| 1.0, &mut rng).unwrap() {
                *seen.entry((p, r)).or_default() += 1;
            }
        }
        for p in &players {
            for role in Role::SPECIAL {
                let got = seen[&(p.clone(), role)] as f64 / draws as f64;
                assert!((got - 1.0 / 7.0).abs() < 0.02, "{p} {role:?} {got}");
            }
        }
    }

    #[test]
    fn rolling_history_rotates_every_role_through_every_player() {
        let players = ids(6);
        let mut rng = StdRng::seed_from_u64(5);
        let mut turns: BTreeMap<(Role, String), u64> = BTreeMap::new();
        let mut last: BTreeMap<String, Role> = BTreeMap::new();
        for _ in 0..60 {
            let w = |role: Role, p: &str| {
                let min = players.iter().map(|q| turns.get(&(role, q.clone())).copied().unwrap_or(0)).min().unwrap();
                let t = turns.get(&(role, p.to_string())).copied().unwrap_or(0);
                weight(t, min, last.get(p) == Some(&role))
            };
            let roles = assign(&players, w, &mut rng).unwrap();
            for (p, r) in &roles {
                *turns.entry((*r, p.clone())).or_default() += 1;
            }
            last = roles;
        }
        // 60 rounds of six seats: everyone holds every role, close to 10 times.
        for p in &players {
            for role in Role::SPECIAL.into_iter().chain([Role::Gambler]) {
                let t = turns[&(role, p.clone())];
                assert!((6..=14).contains(&t), "{p} {role:?} {t}");
            }
        }
    }

    #[test]
    fn awards_match_the_settled_table() {
        let escape = Facts { escaped: true, pair_named: true, ..Default::default() };
        let caught = Facts { escaped: false, pair_named: true, decoy_caught: true, ..Default::default() };
        // Imposter best: escape, perfect bluff, pair, decoy, bet 3.
        let best = Facts { perfect_bluff: true, decoy_caught: true, ..escape };
        assert_eq!(award(Role::Imposter, &best, false, false, 3).total(), 8);
        // A caught imposter gains nothing, not even the decoy catch, and loses the bet.
        let a = award(Role::Imposter, &caught, false, false, 3);
        assert_eq!((a.base, a.bonus, a.bet, a.lost, a.total()), (0, 0, -3, true, -3));
        // Accomplice: escape +1, pair +1, and a team bet on the escape.
        assert_eq!(award(Role::Accomplice, &escape, false, false, 3).total(), 5);
        let a = award(Role::Accomplice, &caught, false, false, 2);
        assert_eq!((a.base, a.bonus, a.bet, a.lost), (0, 0, -2, true));
        // Spotted: the won bet is cancelled; a lost bet still costs.
        let spotted = Facts { accomplice_caught: true, ..escape };
        let a = award(Role::Accomplice, &spotted, false, false, 3);
        assert_eq!((a.total(), a.voided, a.lost), (0, true, true));
        let spotted_caught = Facts { accomplice_caught: true, ..caught };
        assert_eq!(award(Role::Accomplice, &spotted_caught, false, false, 3).total(), -3);
        // Spotting the accomplice cancels the imposter's pair bonus too.
        assert_eq!(award(Role::Imposter, &spotted, false, false, 0).bonus, 0);
        // Detective: two reads; the bet always rides on the accomplice pick.
        assert_eq!(award(Role::Detective, &caught, true, true, 3).total(), 5);
        assert_eq!(award(Role::Detective, &caught, true, false, 3).total(), -2);
        assert_eq!(award(Role::Detective, &caught, false, true, 3).total(), 4);
        // Judge +2.
        assert_eq!(award(Role::Judge, &caught, true, false, 3).total(), 5);
        assert_eq!(award(Role::Judge, &escape, false, false, 3).total(), -3);
        // Decoy +1 vote, +1 when the imposter is caught; spotted voids gains.
        assert_eq!(award(Role::Decoy, &Facts::default(), true, false, 3).total(), 5);
        let spotted_decoy = Facts { decoy_caught: true, ..Facts::default() };
        assert_eq!(award(Role::Decoy, &spotted_decoy, true, false, 3).total(), 0);
        let a = award(Role::Decoy, &Facts { decoy_caught: true, escaped: true, ..Default::default() }, false, false, 2);
        assert_eq!((a.total(), a.lost), (-2, true));
        // Bait Decoy: +1 vote, +1 for drawing a ballot, nothing if convicted.
        let bait = Facts { bait_decoy: true, decoy_voted: true, ..Facts::default() };
        assert_eq!(award(Role::Decoy, &bait, true, false, 2).total(), 4);
        let convicted = Facts { escaped: true, decoy_convicted: true, ..bait };
        let a = award(Role::Decoy, &convicted, false, false, 2);
        assert_eq!((a.total(), a.voided, a.lost), (-2, true, true));
        // Gambler tiers: ±1, ±2, +5/−3.
        for (stake, win, lose) in [(0, 1, 0), (1, 2, -1), (2, 3, -2), (3, 6, -3)] {
            assert_eq!(award(Role::Gambler, &caught, true, false, stake).total(), win);
            assert_eq!(award(Role::Gambler, &caught, false, false, stake).total(), lose);
        }
    }
}
