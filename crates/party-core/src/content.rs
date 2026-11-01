use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Word {
    pub word: String,
    pub hint: String,
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
pub fn topics() -> Vec<Topic> {
    serde_json::from_str(include_str!("../content/topics.json"))
        .expect("bundled content is validated at build/test time")
}
pub fn catalog() -> serde_json::Value {
    serde_json::Value::Array(topics().iter().map(|t| serde_json::json!({"id":t.id,"name":t.name,"icon":t.icon,"description":t.description,"opt_in":t.opt_in,"count":t.words.len()})).collect())
}
