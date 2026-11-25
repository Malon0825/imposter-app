use crate::game::{Action, Game, GameResult};
use crate::history::{Store, HISTORY_ERROR};
use axum::{
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD as B64, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::{
    collections::HashMap,
    net::{IpAddr, Ipv4Addr, SocketAddr},
    sync::Arc,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::sync::Mutex;
use uuid::Uuid;

mod web;
pub use web::{load_web_assets, SharedInvitation, WebAsset, WebAssets};

type ApiError = (StatusCode, Json<Value>);
fn err(s: impl ToString) -> ApiError {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({"error":s.to_string()})),
    )
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
pub fn local_ip() -> String {
    if_addrs::get_if_addrs()
        .unwrap_or_default()
        .iter()
        .filter(|i| !i.is_loopback())
        .find_map(|i| match i.ip() {
            IpAddr::V4(ip) if ip.is_private() => Some(ip.to_string()),
            _ => None,
        })
        .unwrap_or_else(|| "127.0.0.1".into())
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Invitation {
    pub version: u8,
    pub endpoint: String,
    pub party_id: String,
    pub party_name: String,
    pub wifi: String,
    pub admission: String,
    pub certificate: String,
    pub expires: u64,
}
impl Invitation {
    pub fn encode(&self) -> String {
        format!(
            "imposter://join/{}",
            B64.encode(serde_json::to_vec(self).unwrap())
        )
    }
    pub fn parse(text: &str) -> GameResult<Self> {
        if text.trim().starts_with("http://") {
            return SharedInvitation::parse(text).map(|shared| shared.native);
        }
        if text.len() > 6000 {
            return Err("That invitation is too long.".into());
        }
        let data = text
            .trim()
            .strip_prefix("imposter://join/")
            .ok_or("Scan or paste an IMPOSTER invitation.")?;
        let i: Self = serde_json::from_slice(
            &B64.decode(data)
                .map_err(|_| "This invitation is damaged.")?,
        )
        .map_err(|_| "This invitation is damaged.")?;
        if i.version != 1 {
            return Err("This party needs a different app version.".into());
        }
        if i.expires < now() {
            return Err("This invitation expired. Ask the host to create a new party.".into());
        }
        let url = url::Url::parse(&i.endpoint).map_err(|_| "Invalid party address.")?;
        let ip: Ipv4Addr = url
            .host_str()
            .ok_or("Missing party address.")?
            .parse()
            .map_err(|_| "Invitations must use a local Wi-Fi address.")?;
        if url.scheme() != "https"
            || !(ip.is_private() || ip.is_loopback())
            || url.port().is_none()
            || url.path() != "/"
            || url.query().is_some()
            || !url.username().is_empty()
            || url.password().is_some()
        {
            return Err("This is not a local party invitation.".into());
        }
        if i.admission.len() != 36 || i.certificate.len() > 3000 {
            return Err("Invalid invitation credentials.".into());
        }
        Ok(i)
    }
    fn client(&self) -> GameResult<reqwest::Client> {
        let der = B64
            .decode(&self.certificate)
            .map_err(|_| "Invalid host certificate.")?;
        let cert = reqwest::Certificate::from_der(&der).map_err(|_| "Invalid host certificate.")?;
        reqwest::Client::builder()
            .https_only(true)
            .tls_built_in_root_certs(false)
            .add_root_certificate(cert)
            .no_proxy()
            .timeout(Duration::from_secs(4))
            .build()
            .map_err(|e| e.to_string())
    }
}
pub struct Host {
    pub game: Mutex<Game>,
    history: Option<Arc<std::sync::Mutex<Store>>>,
    invitation: Invitation,
    seen: Mutex<HashMap<String, Instant>>,
    shutdown: axum_server::Handle,
    web: Option<web::WebHost>,
}
const GAMEPLAY_VERSION: &str = "power-cards-v1";
const UPDATE_GUEST: &str =
    "Update Imposter to join this party, or open the invitation in your browser.";

impl Host {
    async fn apply(self: &Arc<Self>, actor: String, action: Action) -> GameResult<Value> {
        if self.history.is_none()
            || ![
                "begin_round",
                "fresh_word_deck",
                "random_rules",
                "skip_round",
            ]
            .contains(&action.kind.as_str())
        {
            let mut game = self.game.lock().await;
            game.apply(&actor, &action)?;
            return Ok(game.view(&actor));
        }
        let host = self.clone();
        // Own the transition even if the requesting client times out.
        tokio::spawn(async move {
            let mut game = host.game.lock().await;
            let mut staged = game.clone();
            staged.apply(&actor, &action)?;
            let previous = game.deck.revision;
            if staged.deck.revision != previous {
                let deck = staged.deck.clone();
                let added_deal = deck.deals.len() > game.deck.deals.len();
                let store = host.history.as_ref().expect("persistent host").clone();
                let saved = tokio::task::spawn_blocking(move || {
                    let mut store = store.lock().map_err(|_| HISTORY_ERROR)?;
                    store.save(
                        previous,
                        &deck,
                        if added_deal { deck.deals.last() } else { None },
                    )
                })
                .await
                .map_err(|_| HISTORY_ERROR.to_owned())
                .and_then(|result| result);
                if let Err(error) = saved {
                    if added_deal {
                        game.round.retry_word_id = staged.round.word_id.clone();
                        game.round.deal_error = Some(error.clone());
                        game.revision += 1;
                    }
                    return Err(error);
                }
            }
            *game = staged;
            Ok(game.view(&actor))
        })
        .await
        .map_err(|_| HISTORY_ERROR.to_owned())?
    }

    fn check_client(&self, headers: &HeaderMap) -> GameResult<()> {
        if (cfg!(not(test)) || self.history.is_some())
            && headers
                .get("x-imposter-gameplay")
                .and_then(|value| value.to_str().ok())
                != Some(GAMEPLAY_VERSION)
        {
            return Err(UPDATE_GUEST.into());
        }
        Ok(())
    }
}
impl Drop for Host {
    fn drop(&mut self) {
        self.shutdown.shutdown();
        if let Some(web) = &self.web {
            web.shutdown.notify_one();
        }
    }
}
// The server owns a Weak host state so closing the last local session stops it.
type HostState = std::sync::Weak<Host>;
fn upgrade(s: &HostState) -> Result<Arc<Host>, ApiError> {
    s.upgrade().ok_or_else(|| err("The host ended this party."))
}
fn bearer(headers: &HeaderMap) -> GameResult<&str> {
    headers
        .get("authorization")
        .and_then(|s| s.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .ok_or_else(|| "Missing player credentials.".into())
}
async fn actor(host: &Host, headers: &HeaderMap) -> GameResult<String> {
    host.check_client(headers)?;
    let token = bearer(headers)?;
    let mut g = host.game.lock().await;
    let actor = g.actor(token)?;
    g.connection(&actor, true);
    host.seen.lock().await.insert(actor.clone(), Instant::now());
    Ok(actor)
}

#[derive(Deserialize)]
struct Join {
    name: String,
    admission: String,
}
async fn inspect(
    State(state): State<HostState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let host = upgrade(&state)?;
    host.check_client(&headers).map_err(err)?;
    if bearer(&headers).map_err(err)? != host.invitation.admission
        || host.invitation.expires < now()
    {
        return Err(err("The invitation is no longer valid."));
    }
    let g = host.game.lock().await;
    Ok(Json(
        json!({"party_id":g.id,"name":g.name,"host_name":g.players[0].name,"wifi":g.wifi,"phase":g.phase}),
    ))
}
async fn join(
    State(state): State<HostState>,
    headers: HeaderMap,
    Json(body): Json<Join>,
) -> Result<Json<Value>, ApiError> {
    let host = upgrade(&state)?;
    host.check_client(&headers).map_err(err)?;
    if body.admission != host.invitation.admission || host.invitation.expires < now() {
        return Err(err("The invitation is no longer valid."));
    }
    let mut game = host.game.lock().await;
    let p = game.join(&body.name).map_err(err)?;
    let v = game.view(&p.id);
    host.seen.lock().await.insert(p.id.clone(), Instant::now());
    Ok(Json(json!({"token":p.token,"player_id":p.id,"view":v})))
}
async fn state(
    State(state): State<HostState>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let host = upgrade(&state)?;
    let id = actor(&host, &headers).await.map_err(err)?;
    let g = host.game.lock().await;
    Ok(Json(g.view(&id)))
}
async fn action(
    State(state): State<HostState>,
    headers: HeaderMap,
    Json(a): Json<Action>,
) -> Result<Json<Value>, ApiError> {
    let host = upgrade(&state)?;
    let id = actor(&host, &headers).await.map_err(err)?;
    Ok(Json(host.apply(id, a).await.map_err(err)?))
}

pub struct Session {
    host: Option<Arc<Host>>,
    invitation: Invitation,
    client: reqwest::Client,
    token: String,
    player_id: String,
}
impl Session {
    pub async fn create(
        name: &str,
        player: &str,
        wifi: &str,
        address: Option<String>,
    ) -> GameResult<Self> {
        Self::create_inner(name, player, wifi, address, None, None).await
    }
    pub async fn create_with_web(
        name: &str,
        player: &str,
        wifi: &str,
        address: Option<String>,
        assets: Arc<WebAssets>,
    ) -> GameResult<Self> {
        Self::create_with_history(name, player, wifi, address, assets, None).await
    }
    pub async fn create_with_history(
        name: &str,
        player: &str,
        wifi: &str,
        address: Option<String>,
        assets: Arc<WebAssets>,
        history_path: Option<PathBuf>,
    ) -> GameResult<Self> {
        if !assets.contains_key("/index.html") {
            return Err(
                "The browser game bundle is missing. Rebuild the app before hosting.".into(),
            );
        }
        Self::create_inner(name, player, wifi, address, Some(assets), history_path).await
    }
    async fn create_inner(
        name: &str,
        player: &str,
        wifi: &str,
        address: Option<String>,
        assets: Option<Arc<WebAssets>>,
        history_path: Option<PathBuf>,
    ) -> GameResult<Self> {
        let _ = rustls::crypto::ring::default_provider().install_default();
        let mut game = Game::new(name, player, wifi)?;
        let history = if let Some(path) = history_path {
            let (store, deck) = tokio::task::spawn_blocking(move || Store::open(&path))
                .await
                .map_err(|_| HISTORY_ERROR)??;
            game.deck = deck;
            Some(Arc::new(std::sync::Mutex::new(store)))
        } else {
            None
        };
        let ip = address.unwrap_or_else(local_ip);
        let parsed: Ipv4Addr = ip.parse().map_err(|_| "Connect to Wi-Fi before hosting.")?;
        if !parsed.is_private() && !parsed.is_loopback() {
            return Err("Connect to a local Wi-Fi network first.".into());
        }
        let cert = rcgen::generate_simple_self_signed(vec![ip.clone(), "localhost".into()])
            .map_err(|e| e.to_string())?;
        let config = axum_server::tls_rustls::RustlsConfig::from_pem(
            cert.cert.pem().into_bytes(),
            cert.key_pair.serialize_pem().into_bytes(),
        )
        .await
        .map_err(|e| e.to_string())?;
        let listener = std::net::TcpListener::bind(SocketAddr::new(IpAddr::V4(parsed), 0))
            .map_err(|e| format!("Cannot host on this network: {e}"))?;
        listener.set_nonblocking(true).map_err(|e| e.to_string())?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        let invitation = Invitation {
            version: 1,
            endpoint: format!("https://{ip}:{port}/"),
            party_id: game.id.clone(),
            party_name: game.name.clone(),
            wifi: game.wifi.clone(),
            admission: Uuid::new_v4().to_string(),
            certificate: B64.encode(cert.cert.der()),
            expires: now() + 60 * 60 * 12,
        };
        let token = game.players[0].token.clone();
        let player_id = game.host.clone();
        let handle = axum_server::Handle::new();
        let (web, web_listener) = if let Some(assets) = assets {
            let (web, listener) = web::prepare(&invitation, assets)?;
            (Some(web), Some(listener))
        } else {
            (None, None)
        };
        let host = Arc::new(Host {
            game: Mutex::new(game),
            history,
            invitation: invitation.clone(),
            seen: Mutex::new(HashMap::new()),
            shutdown: handle.clone(),
            web,
        });
        if let Some(listener) = web_listener {
            web::serve(&host, listener);
        }
        let weak = Arc::downgrade(&host);
        let router = Router::new()
            .route("/inspect", get(inspect))
            .route("/join", post(join))
            .route("/state", get(state))
            .route("/action", post(action))
            .layer(DefaultBodyLimit::max(16 * 1024))
            .with_state(weak.clone());
        tokio::spawn(async move {
            let server = axum_server::from_tcp_rustls(listener, config);
            let _ = server
                .handle(handle)
                .serve(router.into_make_service())
                .await;
        });
        tokio::spawn(async move {
            let mut stages = tokio::time::interval(Duration::from_millis(100));
            let mut interval = tokio::time::interval(Duration::from_secs(2));
            loop {
                let sweep = tokio::select! {
                    _ = stages.tick() => false,
                    _ = interval.tick() => true,
                };
                let Some(host) = weak.upgrade() else {
                    break;
                };
                // Presence and the latest heartbeat must be read under the same game lock.
                let mut game = host.game.lock().await;
                if sweep {
                    let stale: Vec<String> = host
                        .seen
                        .lock()
                        .await
                        .iter()
                        .filter(|(_, t)| t.elapsed() > Duration::from_secs(9))
                        .map(|(id, _)| id.clone())
                        .collect();
                    for id in stale {
                        game.connection(&id, false);
                    }
                }
                if !game.streamlined() {
                    continue;
                }
                game.advance_reveals(Instant::now());
                if game.phase == "topic_chosen"
                    && game.round.deal_error.is_none()
                    && game.active().iter().all(|p| p.connected)
                {
                    let action = Action {
                        id: Uuid::new_v4().to_string(),
                        round_id: game.round.id,
                        kind: "begin_round".into(),
                        value: Value::Null,
                    };
                    let actor = game.host.clone();
                    drop(game);
                    if let Err(error) = host.apply(actor, action.clone()).await {
                        let mut game = host.game.lock().await;
                        if game.phase == "topic_chosen"
                            && game.round.id == action.round_id
                            && game.active().iter().all(|p| p.connected)
                            && game.round.deal_error.is_none()
                        {
                            game.round.deal_error = Some(error);
                            game.revision += 1;
                        }
                    }
                }
            }
        });
        Ok(Self {
            client: invitation.client()?,
            host: Some(host),
            invitation,
            token,
            player_id,
        })
    }
    pub async fn inspect(text: &str) -> GameResult<Value> {
        let i = Invitation::parse(text)?;
        let client = i.client()?;
        response(
            client
                .get(format!("{}inspect", i.endpoint))
                .header("X-Imposter-Gameplay", GAMEPLAY_VERSION)
                .bearer_auth(&i.admission)
                .send()
                .await,
        )
        .await
    }
    pub async fn join(text: &str, name: &str) -> GameResult<Self> {
        let invitation = Invitation::parse(text)?;
        let client = invitation.client()?;
        let v = response(
            client
                .post(format!("{}join", invitation.endpoint))
                .header("X-Imposter-Gameplay", GAMEPLAY_VERSION)
                .json(&json!({"admission":invitation.admission,"name":name}))
                .send()
                .await,
        )
        .await?;
        Ok(Self {
            host: None,
            invitation,
            client,
            token: v["token"].as_str().ok_or("Invalid host response.")?.into(),
            player_id: v["player_id"]
                .as_str()
                .ok_or("Invalid host response.")?
                .into(),
        })
    }
    pub async fn resume(text: &str, token: &str, player_id: &str) -> GameResult<Self> {
        let invitation = Invitation::parse(text)?;
        let session = Self {
            host: None,
            client: invitation.client()?,
            invitation,
            token: token.into(),
            player_id: player_id.into(),
        };
        let v = session.snapshot().await?;
        if v["my_id"] != player_id {
            return Err("That saved place belongs to another player.".into());
        }
        Ok(session)
    }
    pub fn credentials(&self) -> Value {
        json!({"invitation":self.invitation(),"native_invitation":self.invitation.encode(),"token":self.token,"player_id":self.player_id,"is_host":self.host.is_some()})
    }
    pub async fn snapshot(&self) -> GameResult<Value> {
        if let Some(host) = &self.host {
            if host.web.is_some() {
                return Ok(web::host_view(host, &self.player_id).await);
            }
            let g = host.game.lock().await;
            Ok(g.view(&self.player_id))
        } else {
            response(
                self.client
                    .get(format!("{}state", self.invitation.endpoint))
                    .header("X-Imposter-Gameplay", GAMEPLAY_VERSION)
                    .bearer_auth(&self.token)
                    .send()
                    .await,
            )
            .await
        }
    }
    pub async fn send(&self, action: Action) -> GameResult<Value> {
        if let Some(host) = &self.host {
            if host.web.is_some()
                && ["approve_reconnect", "reject_reconnect"].contains(&action.kind.as_str())
            {
                web::decide_recovery(host, &action).await?;
                return self.snapshot().await;
            }
            host.apply(self.player_id.clone(), action).await?;
            self.snapshot().await
        } else {
            response(
                self.client
                    .post(format!("{}action", self.invitation.endpoint))
                    .header("X-Imposter-Gameplay", GAMEPLAY_VERSION)
                    .bearer_auth(&self.token)
                    .json(&action)
                    .send()
                    .await,
            )
            .await
        }
    }
    pub fn invitation(&self) -> String {
        if let Some(web) = self.host.as_ref().and_then(|host| host.web.as_ref()) {
            return web.invitation.encode();
        }
        self.invitation.encode()
    }
}
async fn response(r: Result<reqwest::Response, reqwest::Error>) -> GameResult<Value> {
    let r =
        r.map_err(|_| "Can't reach the host. Check the shared Wi-Fi and try again.".to_string())?;
    let status = r.status();
    let value: Value = r
        .json()
        .await
        .map_err(|_| "The host sent an invalid response.")?;
    if !status.is_success() {
        return Err(value["error"]
            .as_str()
            .unwrap_or("The host rejected this action.")
            .into());
    }
    Ok(value)
}

#[derive(Default)]
pub struct Sessions {
    pub entries: Mutex<HashMap<String, Arc<Session>>>,
    pub web_assets: Arc<WebAssets>,
    pub history_path: Option<PathBuf>,
}
impl Sessions {
    pub fn with_web_assets(assets: WebAssets) -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
            web_assets: Arc::new(assets),
            history_path: None,
        }
    }
    pub async fn insert(&self, s: Session) -> String {
        let id = Uuid::new_v4().to_string();
        self.entries.lock().await.insert(id.clone(), Arc::new(s));
        id
    }
    pub async fn get(&self, id: &str) -> GameResult<Arc<Session>> {
        self.entries
            .lock()
            .await
            .get(id)
            .cloned()
            .ok_or_else(|| "This session ended. Return home and join again.".into())
    }
    pub async fn remove(&self, id: &str) {
        self.entries.lock().await.remove(id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // The host advances timed stages on its own schedule, so tests poll for them.
    pub(crate) async fn wait_phase(session: &Session, phase: &str) -> Value {
        for _ in 0..120 {
            let view = session.snapshot().await.unwrap();
            if view["phase"] == phase {
                return view;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        panic!("the party never reached {phase}");
    }
    #[tokio::test]
    async fn durable_deal_failure_keeps_cards_concealed_and_retry_consumes_once() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("deck.sqlite3");
        let host = Session::create_inner(
            "Deck test",
            "Alex",
            "Wi-Fi",
            Some("127.0.0.1".into()),
            None,
            Some(path),
        )
        .await
        .unwrap();
        let invitation = host.invitation();
        let outdated = Invitation::parse(&invitation)
            .unwrap()
            .client()
            .unwrap()
            .get(format!("{}inspect", host.invitation.endpoint))
            .bearer_auth(&host.invitation.admission)
            .send()
            .await
            .unwrap();
        assert_eq!(outdated.status(), StatusCode::BAD_REQUEST);
        // A native client without the gameplay header cannot join or act either.
        let client = Invitation::parse(&invitation).unwrap().client().unwrap();
        for (route, body) in [
            ("join", json!({"admission":host.invitation.admission,"name":"Old"})),
            ("action", json!({"id":"1","round_id":0,"kind":"ready","value":true})),
        ] {
            let refused = client
                .post(format!("{}{route}", host.invitation.endpoint))
                .bearer_auth(&host.token)
                .json(&body)
                .send()
                .await
                .unwrap();
            assert_eq!(refused.status(), StatusCode::BAD_REQUEST);
            assert_eq!(refused.json::<Value>().await.unwrap()["error"], UPDATE_GUEST);
        }
        let sam = Session::join(&invitation, "Sam").await.unwrap();
        let mia = Session::join(&invitation, "Mia").await.unwrap();
        let command = |round_id, kind: &str, value| Action {
            id: Uuid::new_v4().to_string(),
            round_id,
            kind: kind.into(),
            value,
        };
        for guest in [&sam, &mia] {
            guest.send(command(0, "ready", json!(true))).await.unwrap();
        }
        host.send(command(0, "start", Value::Null)).await.unwrap();
        for session in [&host, &sam, &mia] {
            session
                .send(command(1, "topic_vote", json!(["animals"])))
                .await
                .unwrap();
        }
        let inner = host.host.as_ref().unwrap();
        let store = inner.history.as_ref().unwrap();
        store.lock().unwrap().reject_deals(true);
        // The host scheduler also tries this deal; both must fail the same way.
        let action = command(1, "begin_round", Value::Null);
        assert_eq!(host.send(action.clone()).await.unwrap_err(), HISTORY_ERROR);
        assert_eq!(sam.snapshot().await.unwrap()["private_role"], Value::Null);
        let prepared_word = {
            let game = inner.game.lock().await;
            assert!(game.deck.deals.is_empty());
            assert_eq!(game.phase, "topic_chosen");
            game.round.retry_word_id.clone().unwrap()
        };
        store.lock().unwrap().reject_deals(false);
        let first = host.send(action.clone()).await.unwrap();
        assert_eq!(first["phase"], "roles");
        assert_eq!(
            first["private_role"],
            host.send(action).await.unwrap()["private_role"]
        );
        let game = inner.game.lock().await;
        assert_eq!(game.deck.deals.len(), 1);
        assert_eq!(game.deck.deals[0].word, prepared_word);
    }
    #[tokio::test]
    async fn real_tls_clients_join_reconnect_and_reject_wrong_credentials() {
        let host = Session::create(
            "Network test",
            "Alex",
            "Test Wi-Fi",
            Some("127.0.0.1".into()),
        )
        .await
        .unwrap();
        let text = host.invitation();
        let details = Session::inspect(&text).await.unwrap();
        assert_eq!(details["name"], "Network test");
        let a = Session::join(&text, "Sam").await.unwrap();
        let b = Session::join(&text, "Mia").await.unwrap();
        assert_eq!(
            host.snapshot().await.unwrap()["players"]
                .as_array()
                .unwrap()
                .len(),
            3
        );
        for s in [&a, &b] {
            s.send(Action {
                id: Uuid::new_v4().to_string(),
                round_id: 0,
                kind: "ready".into(),
                value: json!(true),
            })
            .await
            .unwrap();
        }
        host.send(Action {
            id: Uuid::new_v4().to_string(),
            round_id: 0,
            kind: "start".into(),
            value: Value::Null,
        })
        .await
        .unwrap();
        for session in [&host, &a, &b] {
            session
                .send(Action {
                    id: Uuid::new_v4().to_string(),
                    round_id: 1,
                    kind: "topic_vote".into(),
                    value: json!(["food"]),
                })
                .await
                .unwrap();
        }
        // The host deals automatically once the topic is locked.
        let view = wait_phase(&a, "roles").await;
        assert!(view["result"].is_null());
        let c = a.credentials();
        let resumed = Session::resume(
            &text,
            c["token"].as_str().unwrap(),
            c["player_id"].as_str().unwrap(),
        )
        .await
        .unwrap();
        assert_eq!(resumed.snapshot().await.unwrap()["my_id"], view["my_id"]);
        assert!(Session::resume(&text, "bad", &a.player_id).await.is_err());
        let mut invite = Invitation::parse(&text).unwrap();
        invite.admission = Uuid::new_v4().to_string();
        assert!(Session::join(&invite.encode(), "Other").await.is_err());
        let other = Session::create("Other", "Host", "Test Wi-Fi", Some("127.0.0.1".into()))
            .await
            .unwrap();
        let cert = Invitation::parse(&other.invitation()).unwrap();
        invite.certificate = cert.certificate;
        assert!(Session::inspect(&invite.encode()).await.is_err());
    }
    #[test]
    fn rejects_remote_and_expired_invitations() {
        let i = Invitation {
            version: 1,
            endpoint: "https://8.8.8.8:443/".into(),
            party_id: "p".into(),
            party_name: "p".into(),
            wifi: "w".into(),
            admission: Uuid::new_v4().to_string(),
            certificate: "x".into(),
            expires: now() + 10,
        };
        assert!(Invitation::parse(&i.encode()).is_err());
        let mut i = i;
        i.endpoint = "https://127.0.0.1:443/".into();
        i.expires = 0;
        assert!(Invitation::parse(&i.encode()).is_err());
    }
}
