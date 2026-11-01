use crate::game::{Action, Game, GameResult};
use axum::{
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD as B64, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    net::{IpAddr, Ipv4Addr, SocketAddr},
    sync::Arc,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::sync::Mutex;
use uuid::Uuid;

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
    invitation: Invitation,
    seen: Mutex<HashMap<String, Instant>>,
    shutdown: axum_server::Handle,
}
impl Drop for Host {
    fn drop(&mut self) {
        self.shutdown.shutdown();
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
    let token = bearer(headers)?;
    let mut g = host.game.lock().await;
    let actor = g.actor(token)?;
    g.connection(&actor, true);
    drop(g);
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
    Json(body): Json<Join>,
) -> Result<Json<Value>, ApiError> {
    let host = upgrade(&state)?;
    if body.admission != host.invitation.admission || host.invitation.expires < now() {
        return Err(err("The invitation is no longer valid."));
    }
    let mut game = host.game.lock().await;
    let p = game.join(&body.name).map_err(err)?;
    let v = game.view(&p.id);
    drop(game);
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
    let mut g = host.game.lock().await;
    g.apply(&id, &a).map_err(err)?;
    Ok(Json(g.view(&id)))
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
        let _ = rustls::crypto::ring::default_provider().install_default();
        let game = Game::new(name, player, wifi)?;
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
        let host = Arc::new(Host {
            game: Mutex::new(game),
            invitation: invitation.clone(),
            seen: Mutex::new(HashMap::new()),
            shutdown: handle.clone(),
        });
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
            let mut interval = tokio::time::interval(Duration::from_secs(2));
            loop {
                interval.tick().await;
                let Some(host) = weak.upgrade() else {
                    break;
                };
                let stale: Vec<String> = host
                    .seen
                    .lock()
                    .await
                    .iter()
                    .filter(|(_, t)| t.elapsed() > Duration::from_secs(9))
                    .map(|(id, _)| id.clone())
                    .collect();
                let mut game = host.game.lock().await;
                for id in stale {
                    game.connection(&id, false);
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
        json!({"invitation":self.invitation.encode(),"token":self.token,"player_id":self.player_id,"is_host":self.host.is_some()})
    }
    pub async fn snapshot(&self) -> GameResult<Value> {
        if let Some(host) = &self.host {
            let g = host.game.lock().await;
            Ok(g.view(&self.player_id))
        } else {
            response(
                self.client
                    .get(format!("{}state", self.invitation.endpoint))
                    .bearer_auth(&self.token)
                    .send()
                    .await,
            )
            .await
        }
    }
    pub async fn send(&self, action: Action) -> GameResult<Value> {
        if let Some(host) = &self.host {
            let mut g = host.game.lock().await;
            g.apply(&self.player_id, &action)?;
            Ok(g.view(&self.player_id))
        } else {
            response(
                self.client
                    .post(format!("{}action", self.invitation.endpoint))
                    .bearer_auth(&self.token)
                    .json(&action)
                    .send()
                    .await,
            )
            .await
        }
    }
    pub fn invitation(&self) -> String {
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
}
impl Sessions {
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
        let view = a.snapshot().await.unwrap();
        assert_eq!(view["phase"], "roles");
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
