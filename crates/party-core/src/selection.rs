use crate::{
    content::{self, GameMode, Word},
    history::{Deal, Deck},
};
use serde::Deserialize;
use std::{
    collections::{BTreeMap, HashSet},
    sync::OnceLock,
};

const SEMANTIC_WINDOW: usize = 6;
const PERFORMANCE_WINDOW: usize = 4;
const POLICY_REVISION: u32 = 1;

#[derive(Deserialize)]
struct Hint {
    text: String,
    candidates: Vec<String>,
}

#[derive(Deserialize)]
struct WordReview {
    concept: String,
    semantic: Vec<String>,
    performance: BTreeMap<GameMode, Vec<String>>,
    hints: BTreeMap<GameMode, Vec<Hint>>,
}

#[derive(Deserialize)]
struct Index {
    revision: u32,
    aliases: BTreeMap<String, String>,
    words: BTreeMap<String, WordReview>,
}

fn index() -> &'static Index {
    static INDEX: OnceLock<Index> = OnceLock::new();
    INDEX.get_or_init(|| {
        serde_json::from_str(include_str!("../content/selection-index.json"))
            .expect("selection index must pass the content validator")
    })
}

#[derive(Clone, Debug)]
pub(crate) struct Candidate {
    pub word: &'static Word,
    pub hint: &'static str,
}

pub(crate) type Topics = BTreeMap<String, Vec<Candidate>>;

#[derive(Default)]
pub(crate) struct Availability {
    pub modes: BTreeMap<GameMode, Topics>,
    has_compatible: bool,
    has_unplayed: bool,
    has_spaced: bool,
}

impl Availability {
    pub fn reason(&self) -> &'static str {
        if !self.has_compatible {
            "incompatible"
        } else if !self.has_unplayed {
            "played"
        } else if !self.has_spaced {
            "recent"
        } else {
            "hints"
        }
    }
}

struct Exclusions<'a> {
    words: HashSet<&'a str>,
    concepts: HashSet<&'a str>,
    recent_words: HashSet<&'a str>,
    recent_concepts: HashSet<&'a str>,
    semantic: HashSet<&'a str>,
    performance: HashSet<&'a str>,
}

impl<'a> Exclusions<'a> {
    fn new(deck: &'a Deck, mode: GameMode) -> Self {
        let mut rules = Self {
            words: HashSet::new(),
            concepts: HashSet::new(),
            recent_words: HashSet::new(),
            recent_concepts: HashSet::new(),
            semantic: HashSet::new(),
            performance: HashSet::new(),
        };
        let index = index();
        for (age, deal) in deck.deals.iter().rev().enumerate() {
            if age >= SEMANTIC_WINDOW && deal.cycle != deck.cycle {
                break;
            }
            let id = index.aliases.get(&deal.word).unwrap_or(&deal.word);
            let review = index.words.get(id);
            if deal.cycle == deck.cycle {
                rules.words.insert(id);
                rules.concepts.insert(&deal.concept);
                if let Some(review) = review {
                    rules.concepts.insert(&review.concept);
                }
            }
            if age < SEMANTIC_WINDOW {
                rules.recent_words.insert(id);
                rules.recent_concepts.insert(&deal.concept);
                rules
                    .semantic
                    .extend(deal.semantic.iter().map(String::as_str));
                if let Some(review) = review {
                    rules.recent_concepts.insert(&review.concept);
                    rules
                        .semantic
                        .extend(review.semantic.iter().map(String::as_str));
                }
            }
            if age < PERFORMANCE_WINDOW && deal.mode == mode {
                rules
                    .performance
                    .extend(deal.performance.iter().map(String::as_str));
                if let Some(groups) = review.and_then(|entry| entry.performance.get(&mode)) {
                    rules.performance.extend(groups.iter().map(String::as_str));
                }
            }
        }
        rules
    }
}

pub(crate) fn availability(enabled: &[String], deck: &Deck, random_rules: bool) -> Availability {
    let modes = if random_rules {
        &GameMode::ALL[..]
    } else {
        &[GameMode::Classic]
    };
    availability_for(enabled, deck, modes)
}

fn availability_for(enabled: &[String], deck: &Deck, modes: &[GameMode]) -> Availability {
    let mut result = Availability::default();
    for &mode in modes {
        let exclusions = Exclusions::new(deck, mode);
        for topic in content::bundled_topics()
            .iter()
            .filter(|topic| enabled.contains(&topic.id))
        {
            if !topic.supports_mode(mode) {
                continue;
            }
            result.has_compatible = true;
            let mut pool = Vec::new();
            for word in topic.words_for_mode(mode) {
                let review = &index().words[&word.word_id];
                if exclusions.words.contains(word.word_id.as_str())
                    || exclusions.concepts.contains(review.concept.as_str())
                {
                    continue;
                }
                result.has_unplayed = true;
                if exclusions.recent_words.contains(word.word_id.as_str())
                    || exclusions.recent_concepts.contains(review.concept.as_str())
                    || review
                        .semantic
                        .iter()
                        .any(|family| exclusions.semantic.contains(family.as_str()))
                    || review.performance.get(&mode).is_some_and(|groups| {
                        groups
                            .iter()
                            .any(|family| exclusions.performance.contains(family.as_str()))
                    })
                {
                    continue;
                }
                result.has_spaced = true;
                pool.push(word);
            }
            let candidates = viable_hints(mode, pool);
            if !candidates.is_empty() {
                result
                    .modes
                    .entry(mode)
                    .or_default()
                    .insert(topic.id.clone(), candidates);
            }
        }
    }
    result
}

fn viable_hints(mode: GameMode, mut pool: Vec<&'static Word>) -> Vec<Candidate> {
    loop {
        let remaining: HashSet<_> = pool.iter().map(|word| word.word_id.as_str()).collect();
        let candidates: Vec<_> = pool
            .iter()
            .filter_map(|&word| {
                let hint = index().words[&word.word_id]
                    .hints
                    .get(&mode)?
                    .iter()
                    .find(|hint| {
                        hint.candidates
                            .iter()
                            .filter(|id| remaining.contains(id.as_str()))
                            .map(|id| &index().words[id].concept)
                            .collect::<HashSet<_>>()
                            .len()
                            >= 3
                    })?;
                Some(Candidate {
                    word,
                    hint: &hint.text,
                })
            })
            .collect();
        if candidates.len() == pool.len() {
            return candidates;
        }
        pool = candidates.into_iter().map(|entry| entry.word).collect();
    }
}

pub(crate) fn deal(
    candidate: &Candidate,
    deck: &Deck,
    party: &str,
    round: u32,
    topic: &str,
    mode: GameMode,
) -> Deal {
    let review = &index().words[&candidate.word.word_id];
    Deal {
        party: party.into(),
        round,
        cycle: deck.cycle,
        word: candidate.word.word_id.clone(),
        concept: review.concept.clone(),
        topic: topic.into(),
        mode,
        hint: candidate.hint.into(),
        semantic: review.semantic.clone(),
        performance: review.performance.get(&mode).cloned().unwrap_or_default(),
        catalog_revision: index().revision,
        policy_revision: POLICY_REVISION,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::{
        rngs::StdRng,
        seq::{IteratorRandom, SliceRandom},
        SeedableRng,
    };

    fn word(name: &str) -> &'static Word {
        content::bundled_topics()
            .iter()
            .flat_map(|topic| &topic.words)
            .find(|word| word.word == name)
            .unwrap()
    }

    fn seed(deck: &mut Deck, name: &str, mode: GameMode) {
        let candidate = Candidate {
            word: word(name),
            hint: "fixture",
        };
        deck.deals.push(deal(
            &candidate,
            deck,
            "fixture",
            deck.deals.len() as u32,
            "fixture",
            mode,
        ));
    }

    #[test]
    fn related_clues_and_equivalents_have_different_lifetimes() {
        let mut deck = Deck::default();
        seed(&mut deck, "Cake", GameMode::Classic);
        seed(&mut deck, "Pasta", GameMode::Classic);
        seed(&mut deck, "Phone ringing in a meeting", GameMode::SoundOnly);
        let classic = Exclusions::new(&deck, GameMode::Classic);
        assert!(classic.concepts.contains(
            index().words[&word("Birthday cake").word_id]
                .concept
                .as_str()
        ));
        assert!(classic.semantic.contains("noodle-dishes"));
        assert!(!classic.performance.contains("telephone"));
        assert!(Exclusions::new(&deck, GameMode::SoundOnly)
            .performance
            .contains("telephone"));
        deck.renew().unwrap();
        let classic = Exclusions::new(&deck, GameMode::Classic);
        assert!(classic.concepts.is_empty());
        assert!(classic.recent_concepts.contains("equivalent/cake"));
        for name in ["Dog", "Cat", "Lion", "Horse", "Harp", "Ocean"] {
            seed(&mut deck, name, GameMode::Classic);
        }
        let classic = Exclusions::new(&deck, GameMode::Classic);
        assert!(!classic.recent_concepts.contains("equivalent/cake"));
        assert!(!classic.semantic.contains("noodle-dishes"));
        assert!(!Exclusions::new(&deck, GameMode::SoundOnly)
            .performance
            .contains("telephone"));
    }

    #[test]
    fn hint_pruning_removes_a_target_if_its_alternatives_cannot_be_dealt() {
        let pool = ["Key", "Scissors", "Stapler"].map(word).to_vec();
        // Metal has three alternatives initially, but Craft and Desk do not.
        assert!(viable_hints(GameMode::SoundOnly, pool).is_empty());
        let pool = ["Key", "Scissors", "Stapler", "Wind chime"]
            .map(word)
            .to_vec();
        assert!(viable_hints(GameMode::SoundOnly, pool).is_empty());
    }

    #[test]
    fn fresh_catalog_has_every_supported_topic_and_long_draws_stop_without_repeat() {
        let ids: Vec<_> = content::bundled_topics()
            .iter()
            .map(|topic| topic.id.clone())
            .collect();
        let initial = availability(&ids, &Deck::default(), true);
        assert_eq!(
            initial
                .modes
                .values()
                .map(BTreeMap::len)
                .collect::<Vec<_>>(),
            [23, 21, 14, 2, 2, 2]
        );
        for enabled in [
            &ids[..],
            &["food".to_string()][..],
            &["animals".to_string()][..],
            &["health".to_string()][..],
        ] {
            for seed in 0..4 {
                let mut rng = StdRng::seed_from_u64(seed);
                let mut deck = Deck::default();
                let mut played = HashSet::new();
                for round in 0..=581 {
                    let available = availability(enabled, &deck, true);
                    let Some((&mode, topics)) = available.modes.iter().choose(&mut rng) else {
                        break;
                    };
                    let (topic, candidates) = topics.iter().choose(&mut rng).unwrap();
                    let candidate = candidates.choose(&mut rng).unwrap();
                    let event = deal(candidate, &deck, "simulation", round, topic, mode);
                    assert!(played.insert(event.concept.clone()));
                    assert!(candidate.word.modes.contains(&mode));
                    deck.deals.push(event);
                }
                assert!(!played.is_empty());
                assert!(availability(enabled, &deck, true).modes.is_empty());
                if enabled.len() > 1 {
                    assert!(played.len() > 60, "only {} playable deals", played.len());
                }
            }
        }
    }

    #[test]
    #[ignore = "catalog depletion report; run explicitly to review content changes"]
    fn topic_depletion_report() {
        println!("topic,mode,compatible_entries,distinct_concepts,distinct_families,initial_candidates,min_deals,max_deals,min_stranded,max_stranded");
        for topic in content::bundled_topics() {
            for mode in GameMode::ALL {
                if !topic.supports_mode(mode) {
                    continue;
                }
                let enabled = [topic.id.clone()];
                let words = topic.words_for_mode(mode);
                let concepts: HashSet<_> = words
                    .iter()
                    .map(|word| &index().words[&word.word_id].concept)
                    .collect();
                let families: HashSet<_> = words
                    .iter()
                    .flat_map(|word| {
                        let review = &index().words[&word.word_id];
                        review
                            .semantic
                            .iter()
                            .chain(review.performance.get(&mode).into_iter().flatten())
                    })
                    .collect();
                let initial = availability_for(&enabled, &Deck::default(), &[mode]).modes[&mode]
                    [&topic.id]
                    .len();
                let lengths: Vec<_> = (0..4)
                    .map(|seed| {
                        let mut rng = StdRng::seed_from_u64(seed);
                        let mut deck = Deck::default();
                        loop {
                            let next = availability_for(&enabled, &deck, &[mode]);
                            let Some(candidates) = next
                                .modes
                                .get(&mode)
                                .and_then(|topics| topics.get(&topic.id))
                            else {
                                break;
                            };
                            let candidate = candidates.choose(&mut rng).unwrap();
                            deck.deals.push(deal(
                                candidate,
                                &deck,
                                "simulation",
                                deck.deals.len() as u32,
                                &topic.id,
                                mode,
                            ));
                        }
                        deck.deals.len()
                    })
                    .collect();
                let min = *lengths.iter().min().unwrap();
                let max = *lengths.iter().max().unwrap();
                println!(
                    "{},{mode:?},{},{},{},{initial},{min},{max},{},{}",
                    topic.id,
                    words.len(),
                    concepts.len(),
                    families.len(),
                    concepts.len() - max,
                    concepts.len() - min
                );
            }
        }
    }
}
