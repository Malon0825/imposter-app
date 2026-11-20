use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const MIN_MODE_WORDS: usize = 10;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum GameMode {
    Classic,
    ActIt,
    SoundOnly,
}

impl GameMode {
    pub const ALL: [Self; 3] = [Self::Classic, Self::ActIt, Self::SoundOnly];
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Word {
    pub word_id: String,
    pub word: String,
    pub hint: String,
    pub definition: String,
    pub modes: Vec<GameMode>,
    pub mode_hints: BTreeMap<GameMode, String>,
}

impl Word {
    pub fn hint_for_mode(&self, mode: GameMode) -> Option<&str> {
        if !self.modes.contains(&mode) {
            return None;
        }
        match mode {
            GameMode::Classic => Some(self.hint.as_str()),
            _ => self.mode_hints.get(&mode).map(String::as_str),
        }
        .filter(|hint| !hint.trim().is_empty())
    }
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Topic {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub description: String,
    pub opt_in: bool,
    pub words: Vec<Word>,
}

impl Topic {
    pub fn mode_word_count(&self, mode: GameMode) -> usize {
        self.words
            .iter()
            .filter(|word| word.hint_for_mode(mode).is_some())
            .count()
    }

    pub fn supports_mode(&self, mode: GameMode) -> bool {
        self.mode_word_count(mode) >= MIN_MODE_WORDS
    }

    /// Small reviewed subsets are retained for future editorial work, but must
    /// never become a playable topic or leak into an unrelated-mode fallback.
    pub fn words_for_mode(&self, mode: GameMode) -> Vec<&Word> {
        if !self.supports_mode(mode) {
            return vec![];
        }
        self.words
            .iter()
            .filter(|word| word.hint_for_mode(mode).is_some())
            .collect()
    }
}

/// Respect the host's enabled pack IDs, including the existing opt-in boundary.
pub fn topics_for_mode(enabled_ids: &[String], mode: GameMode) -> Vec<Topic> {
    topics()
        .into_iter()
        .filter(|topic| enabled_ids.contains(&topic.id) && topic.supports_mode(mode))
        .collect()
}

pub fn modes_for_topics(enabled_ids: &[String]) -> Vec<GameMode> {
    GameMode::ALL
        .into_iter()
        .filter(|mode| !topics_for_mode(enabled_ids, *mode).is_empty())
        .collect()
}
pub fn topics() -> Vec<Topic> {
    bundled_topics().to_vec()
}

pub(crate) fn bundled_topics() -> &'static [Topic] {
    static TOPICS: std::sync::OnceLock<Vec<Topic>> = std::sync::OnceLock::new();
    TOPICS.get_or_init(|| {
        serde_json::from_str(include_str!("../content/topics.json"))
            .expect("bundled content is validated at build/test time")
    })
}
pub fn catalog() -> serde_json::Value {
    serde_json::Value::Array(bundled_topics().iter().map(|t| serde_json::json!({"id":t.id,"name":t.name,"icon":t.icon,"description":t.description,"opt_in":t.opt_in,"count":t.words.len()})).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pack(id: &str) -> Topic {
        topics().into_iter().find(|topic| topic.id == id).unwrap()
    }

    #[test]
    fn playable_pools_require_ten_compatible_words_and_private_hints() {
        let mut totals = [0; 3];
        for topic in topics() {
            for (index, mode) in GameMode::ALL.into_iter().enumerate() {
                let pool = topic.words_for_mode(mode);
                if topic.supports_mode(mode) {
                    totals[index] += 1;
                    assert!(pool.len() >= MIN_MODE_WORDS, "{} / {mode:?}", topic.id);
                    assert!(pool.iter().all(
                        |word| word.modes.contains(&mode) && word.hint_for_mode(mode).is_some()
                    ));
                } else {
                    assert!(pool.is_empty(), "{} / {mode:?}", topic.id);
                }
            }
        }
        assert_eq!(totals, [23, 21, 14]);
        let everyday = pack("everyday");
        let wallet = everyday
            .words
            .iter()
            .find(|word| word.word == "Wallet")
            .unwrap();
        assert!(wallet.hint_for_mode(GameMode::Classic).is_some());
        assert!(wallet.hint_for_mode(GameMode::ActIt).is_some());
        assert!(wallet.hint_for_mode(GameMode::SoundOnly).is_none());
    }

    #[test]
    fn ten_word_threshold_is_exact_and_missing_hints_fail_closed() {
        let original = pack("everyday");
        let candidates: Vec<_> = original
            .words_for_mode(GameMode::SoundOnly)
            .into_iter()
            .cloned()
            .take(10)
            .collect();
        let mut topic = original.clone();
        topic.words = candidates[..9].to_vec();
        assert!(!topic.supports_mode(GameMode::SoundOnly));
        topic.words.push(candidates[9].clone());
        assert!(topic.supports_mode(GameMode::SoundOnly));
        topic.words[9].mode_hints.remove(&GameMode::SoundOnly);
        assert!(!topic.supports_mode(GameMode::SoundOnly));
        topic.words[9]
            .mode_hints
            .insert(GameMode::SoundOnly, " ".into());
        assert!(!topic.supports_mode(GameMode::SoundOnly));
    }

    #[test]
    fn mode_draw_respects_enabled_topics_and_opt_in_boundaries() {
        assert!(modes_for_topics(&[]).is_empty());
        assert!(modes_for_topics(&["unknown".into()]).is_empty());
        assert_eq!(
            modes_for_topics(&["food".into()]),
            vec![GameMode::Classic, GameMode::ActIt]
        );
        assert_eq!(
            modes_for_topics(&["health".into()]),
            vec![GameMode::Classic]
        );
        let available = topics_for_mode(&["animals".into()], GameMode::SoundOnly);
        assert_eq!(available.len(), 1);
        assert_eq!(available[0].id, "animals");
        assert!(!available[0].opt_in);
        let consent = topics_for_mode(&["consent".into()], GameMode::ActIt);
        assert_eq!(consent.len(), 1);
        assert!(consent[0].opt_in);
    }

    #[test]
    fn unknown_modes_and_missing_classifications_cannot_deserialize() {
        assert!(serde_json::from_str::<GameMode>("\"opposites\"").is_err());
        assert!(serde_json::from_str::<Word>(r#"{"word":"Wallet","hint":"Pocket"}"#).is_err());
        let value = serde_json::json!({
            "word":"Wallet", "hint":"Pocket", "modes":["classic"],
            "mode_hints":{"sound_typo":"Metal"}
        });
        assert!(serde_json::from_value::<Word>(value).is_err());
    }

    #[test]
    fn public_catalog_never_exposes_targets_hints_or_editorial_examples() {
        let public = catalog();
        for topic in public.as_array().unwrap() {
            assert!(topic.get("words").is_none());
            assert!(topic.get("mode_hints").is_none());
            assert!(topic.get("associations").is_none());
            assert!(topic.get("example").is_none());
        }
    }
}
