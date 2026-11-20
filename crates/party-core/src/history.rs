use crate::{content::GameMode, game::GameResult};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::{
    fs::{File, OpenOptions},
    path::Path,
};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct Deal {
    pub party: String,
    pub round: u32,
    pub cycle: u64,
    pub word: String,
    pub concept: String,
    pub topic: String,
    pub mode: GameMode,
    pub hint: String,
    pub semantic: Vec<String>,
    pub performance: Vec<String>,
    pub catalog_revision: u32,
    pub policy_revision: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct Deck {
    pub cycle: u64,
    pub revision: u64,
    pub random_rules: bool,
    pub deals: Vec<Deal>,
}

impl Default for Deck {
    fn default() -> Self {
        Self {
            cycle: 1,
            revision: 0,
            random_rules: false,
            deals: Vec::new(),
        }
    }
}

impl Deck {
    pub fn renew(&mut self) -> GameResult<()> {
        self.cycle = self
            .cycle
            .checked_add(1)
            .ok_or("Word deck cycle limit reached.")?;
        self.revision += 1;
        Ok(())
    }
}

pub(crate) const HISTORY_ERROR: &str =
    "Could not save or load the word deck. Check device storage and try again.";

pub(crate) struct Store {
    connection: Connection,
    _ownership: File,
}

impl Store {
    #[cfg(test)]
    pub fn reject_deals(&self, reject: bool) {
        let sql = if reject {
            "CREATE TEMP TRIGGER reject_deal BEFORE INSERT ON deals BEGIN SELECT RAISE(ABORT, 'fixture write error'); END;"
        } else {
            "DROP TRIGGER reject_deal;"
        };
        self.connection.execute_batch(sql).unwrap();
    }

    pub fn open(path: &Path) -> GameResult<(Self, Deck)> {
        if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
            std::fs::create_dir_all(parent).map_err(|_| HISTORY_ERROR)?;
        }
        let ownership = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(path.with_extension("lock"))
            .map_err(|_| HISTORY_ERROR)?;
        ownership.try_lock().map_err(|error| match error {
            std::fs::TryLockError::WouldBlock => {
                "This device is already hosting a party with this word deck."
            }
            std::fs::TryLockError::Error(_) => HISTORY_ERROR,
        })?;
        let deck_exists = path.try_exists().map_err(|_| HISTORY_ERROR)?;
        let mut connection = Connection::open(path).map_err(|_| HISTORY_ERROR)?;
        connection
            .execute_batch("PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;")
            .map_err(|_| HISTORY_ERROR)?;
        let version: u32 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .map_err(|_| HISTORY_ERROR)?;
        if version == 0 && !deck_exists {
            let tx = connection.transaction().map_err(|_| HISTORY_ERROR)?;
            tx.execute_batch(
                "CREATE TABLE deck (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, cycle INTEGER NOT NULL, random_rules INTEGER NOT NULL);
                 INSERT INTO deck VALUES (1,0,1,0);
                 CREATE TABLE deals (sequence INTEGER PRIMARY KEY, party TEXT NOT NULL, round INTEGER NOT NULL,
                     cycle INTEGER NOT NULL, word TEXT NOT NULL, concept TEXT NOT NULL, payload TEXT NOT NULL,
                     UNIQUE(party, round), UNIQUE(cycle, word), UNIQUE(cycle, concept));
                 PRAGMA user_version=1;"
            ).map_err(|_| HISTORY_ERROR)?;
            tx.commit().map_err(|_| HISTORY_ERROR)?;
        } else if version != 1 {
            return Err("This word deck could not be opened. Its saved data has been kept.".into());
        }
        let deck = Self::load(&connection).map_err(|_| HISTORY_ERROR)?;
        Ok((
            Self {
                connection,
                _ownership: ownership,
            },
            deck,
        ))
    }

    fn load(connection: &Connection) -> rusqlite::Result<Deck> {
        let (revision, cycle, random_rules) = connection.query_row(
            "SELECT revision, cycle, random_rules FROM deck WHERE id=1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;
        let mut statement = connection.prepare("SELECT payload FROM deals ORDER BY sequence")?;
        let deals = statement
            .query_map([], |row| {
                let payload: String = row.get(0)?;
                serde_json::from_str(&payload).map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        0,
                        rusqlite::types::Type::Text,
                        Box::new(error),
                    )
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(Deck {
            cycle,
            revision,
            random_rules,
            deals,
        })
    }

    pub fn save(&mut self, previous: u64, deck: &Deck, deal: Option<&Deal>) -> GameResult<()> {
        let write = (|| -> rusqlite::Result<bool> {
            let tx = self
                .connection
                .transaction_with_behavior(TransactionBehavior::Immediate)?;
            if tx.execute(
                "UPDATE deck SET revision=?1, cycle=?2, random_rules=?3 WHERE id=1 AND revision=?4",
                params![deck.revision, deck.cycle, deck.random_rules, previous],
            )? != 1
            {
                return Ok(false);
            }
            if let Some(deal) = deal {
                let payload = serde_json::to_string(deal)
                    .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
                tx.execute("INSERT INTO deals(sequence, party, round, cycle, word, concept, payload) VALUES (?1,?2,?3,?4,?5,?6,?7)",
                    params![deck.deals.len(), deal.party, deal.round, deal.cycle, deal.word, deal.concept, payload])?;
            }
            tx.commit()?;
            Ok(true)
        })();
        match write {
            Ok(true) => Ok(()),
            // Resolve an ambiguous commit using the staged revision and deal receipt.
            _ => {
                let state = self
                    .connection
                    .query_row(
                        "SELECT revision, cycle, random_rules FROM deck WHERE id=1",
                        [],
                        |row| {
                            Ok((
                                row.get::<_, u64>(0)?,
                                row.get::<_, u64>(1)?,
                                row.get::<_, bool>(2)?,
                            ))
                        },
                    )
                    .ok();
                if state == Some((deck.revision, deck.cycle, deck.random_rules)) {
                    let receipt_matches = deal.is_none_or(|expected| {
                        self.connection
                            .query_row(
                                "SELECT payload FROM deals WHERE party=?1 AND round=?2",
                                params![expected.party, expected.round],
                                |row| row.get::<_, String>(0),
                            )
                            .optional()
                            .ok()
                            .flatten()
                            .and_then(|raw| serde_json::from_str::<Deal>(&raw).ok())
                            .as_ref()
                            == Some(expected)
                    });
                    if receipt_matches {
                        return Ok(());
                    }
                }
                Err(HISTORY_ERROR.into())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn store_keeps_ownership_and_deductions_across_host_instances() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("history.sqlite3");
        let (mut store, mut deck) = Store::open(&path).unwrap();
        assert!(Store::open(&path).is_err());
        let available = crate::selection::availability(&["everyday".into()], &deck, false);
        let candidate = &available.modes[&GameMode::Classic]["everyday"][0];
        let deal = crate::selection::deal(
            candidate,
            &deck,
            "first-party",
            1,
            "everyday",
            GameMode::Classic,
        );
        deck.deals.push(deal.clone());
        deck.revision += 1;
        store.save(0, &deck, Some(&deal)).unwrap();
        store.save(0, &deck, Some(&deal)).unwrap();
        drop(store);

        let (mut store, mut loaded) = Store::open(&path).unwrap();
        assert_eq!(loaded, deck);
        let available = crate::selection::availability(&["everyday".into()], &loaded, true);
        assert!(available
            .modes
            .values()
            .flat_map(|topics| topics.values())
            .flatten()
            .all(|candidate| candidate.word.word_id != deal.word));
        loaded.renew().unwrap();
        store.save(deck.revision, &loaded, None).unwrap();
        drop(store);
        assert_eq!(Store::open(&path).unwrap().1, loaded);
    }

    #[test]
    fn damaged_and_future_databases_are_preserved_and_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let damaged = dir.path().join("damaged.sqlite3");
        let bytes = b"unrecognized contents";
        std::fs::write(&damaged, bytes).unwrap();
        assert!(Store::open(&damaged).is_err());
        assert_eq!(std::fs::read(&damaged).unwrap(), bytes);
        let future = dir.path().join("future.sqlite3");
        Connection::open(&future)
            .unwrap()
            .execute_batch("PRAGMA user_version=99;")
            .unwrap();
        assert!(Store::open(&future).is_err());
        let version: u32 = Connection::open(&future)
            .unwrap()
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, 99);
    }
}
