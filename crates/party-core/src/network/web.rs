//! Production, same-origin LAN guest transport. It never exports host authority.
use super::*;
use axum::{
    body::{Body, Bytes},
    extract::{ConnectInfo, Request},
    http::{header, HeaderValue, Method},
    middleware::{self, Next},
    response::{IntoResponse, Response},
};
use std::{collections::BTreeMap, path::Path};
use tokio::sync::Notify;

pub type WebAsset = Bytes;
pub type WebAssets = BTreeMap<String, Bytes>;

pub fn load_web_assets(root: &Path) -> GameResult<WebAssets> {
    fn visit(root: &Path, directory: &Path, assets: &mut WebAssets) -> GameResult<()> {
        for item in std::fs::read_dir(directory).map_err(|e| e.to_string())? {
            let item = item.map_err(|e| e.to_string())?;
            let kind = item.file_type().map_err(|e| e.to_string())?;
            if kind.is_dir() {
                visit(root, &item.path(), assets)?;
            } else if kind.is_file() {
                let path = item.path();
                let name = format!(
                    "/{}",
                    path.strip_prefix(root)
                        .unwrap()
                        .to_string_lossy()
                        .replace('\\', "/")
                );
                assets.insert(
                    name,
                    Bytes::from(std::fs::read(path).map_err(|e| e.to_string())?),
                );
            }
        }
        Ok(())
    }
    let mut assets = WebAssets::new();
    visit(root, root, &mut assets)?;
    if !assets.contains_key("/index.html") {
        return Err("Build the browser assets first: npm run build".into());
    }
    Ok(assets)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SharedInvitation {
    pub version: u8,
    pub native: Invitation,
    pub browser: BrowserInvitation,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BrowserInvitation {
    pub endpoint: String,
    pub admission: String,
}
impl SharedInvitation {
    pub fn encode(&self) -> String {
        format!(
            "{}join#invite={}",
            self.browser.endpoint,
            B64.encode(serde_json::to_vec(self).unwrap())
        )
    }
    pub fn parse(text: &str) -> GameResult<Self> {
        if text.len() > 10_000 {
            return Err("That invitation is too long.".into());
        }
        let url = url::Url::parse(text.trim()).map_err(|_| "Invalid party link.")?;
        let data = url
            .fragment()
            .and_then(|f| f.strip_prefix("invite="))
            .ok_or("This link is missing its invitation.")?;
        let shared: Self = serde_json::from_slice(
            &B64.decode(data)
                .map_err(|_| "This invitation is damaged.")?,
        )
        .map_err(|_| "This invitation is damaged.")?;
        if shared.version != 2 {
            return Err("Update Imposter to join this party.".into());
        }
        Invitation::parse(&shared.native.encode())?;
        let ip: Ipv4Addr = url
            .host_str()
            .ok_or("Missing party address.")?
            .parse()
            .map_err(|_| "Use the host's local Wi-Fi invitation.")?;
        let native_url = url::Url::parse(&shared.native.endpoint)
            .map_err(|_| "Invalid native party address.")?;
        if url.scheme() != "http"
            || !(ip.is_private() || ip.is_loopback())
            || url.port().is_none()
            || url.path() != "/join"
            || url.query().is_some()
            || !url.username().is_empty()
            || url.password().is_some()
            || shared.browser.endpoint != format!("{}/", url.origin().ascii_serialization())
            || native_url.host_str() != url.host_str()
            || Uuid::parse_str(&shared.browser.admission).is_err()
        {
            return Err("This is not a valid local party link.".into());
        }
        Ok(shared)
    }
}

pub(super) struct WebHost {
    pub invitation: SharedInvitation,
    pub shutdown: Arc<Notify>,
    assets: Arc<WebAssets>,
    sessions: Mutex<BrowserSessions>,
    rates: Mutex<HashMap<IpAddr, (Instant, u32)>>,
}
#[derive(Default)]
struct BrowserSessions {
    players: HashMap<String, BrowserPlayer>,
    joins: HashMap<String, (String, String)>, // pending join proof -> name, resume token
}
struct BrowserPlayer {
    player_id: String,
    controller: String,
}

pub(super) fn prepare(
    native: &Invitation,
    assets: Arc<WebAssets>,
) -> GameResult<(WebHost, tokio::net::TcpListener)> {
    let native_url = url::Url::parse(&native.endpoint).map_err(|e| e.to_string())?;
    let ip: Ipv4Addr = native_url
        .host_str()
        .unwrap()
        .parse()
        .map_err(|_| "Invalid Wi-Fi address.")?;
    let socket = std::net::TcpListener::bind((ip, 0))
        .map_err(|e| format!("Cannot start browser joining: {e}"))?;
    socket.set_nonblocking(true).map_err(|e| e.to_string())?;
    let port = socket.local_addr().map_err(|e| e.to_string())?.port();
    let listener = tokio::net::TcpListener::from_std(socket).map_err(|e| e.to_string())?;
    Ok((
        WebHost {
            invitation: SharedInvitation {
                version: 2,
                native: native.clone(),
                browser: BrowserInvitation {
                    endpoint: format!("http://{ip}:{port}/"),
                    admission: Uuid::new_v4().to_string(),
                },
            },
            shutdown: Arc::new(Notify::new()),
            assets,
            sessions: Mutex::new(BrowserSessions::default()),
            rates: Mutex::new(HashMap::new()),
        },
        listener,
    ))
}
pub(super) fn serve(host: &Arc<Host>, listener: tokio::net::TcpListener) {
    let weak = Arc::downgrade(host);
    let shutdown = host.web.as_ref().unwrap().shutdown.clone();
    let router = Router::new()
        .route("/guest/bootstrap", post(bootstrap))
        .route("/guest/join", post(browser_join))
        .route("/guest/resume", post(resume))
        .route("/guest/state", post(browser_state))
        .route("/guest/action", post(browser_action))
        .fallback(static_asset)
        .layer(DefaultBodyLimit::max(16 * 1024))
        .layer(middleware::from_fn_with_state(weak.clone(), guard))
        .with_state(weak);
    tokio::spawn(async move {
        let _ = axum::serve(
            listener,
            router.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .with_graceful_shutdown(async move { shutdown.notified().await })
        .await;
    });
}
fn error(status: StatusCode, code: &str, message: &str) -> Response {
    (status, Json(json!({"error":message,"code":code}))).into_response()
}
fn bad(message: &str) -> Response {
    error(StatusCode::BAD_REQUEST, "rejected", message)
}
fn web(host: &Host) -> &WebHost {
    host.web.as_ref().unwrap()
}
fn details(game: &Game) -> Value {
    json!({"party_id":game.id,"name":game.name,"host_name":game.players[0].name,"wifi":game.wifi,"phase":game.phase,"protocol":2})
}
async fn guard(State(state): State<HostState>, request: Request, next: Next) -> Response {
    let Ok(host) = upgrade(&state) else {
        return error(
            StatusCode::GONE,
            "party_closed",
            "The host closed this party.",
        );
    };
    let site = &web(&host).invitation.browser.endpoint;
    let expected = site.trim_end_matches('/');
    let authority = expected.trim_start_matches("http://");
    if request
        .headers()
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        != Some(authority)
    {
        return error(
            StatusCode::FORBIDDEN,
            "wrong_host",
            "Use the invitation shown on the host's phone.",
        );
    }
    if request.method() == Method::POST
        && (request
            .headers()
            .get(header::ORIGIN)
            .and_then(|v| v.to_str().ok())
            != Some(expected)
            || request
                .headers()
                .get("x-imposter-client")
                .and_then(|v| v.to_str().ok())
                != Some("web-v1"))
    {
        return error(
            StatusCode::FORBIDDEN,
            "wrong_origin",
            "Open the party link in your browser.",
        );
    }
    if let Some(peer) = request.extensions().get::<ConnectInfo<SocketAddr>>() {
        let mut rates = web(&host).rates.lock().await;
        if rates.len() > 128 {
            rates.retain(|_, (time, _)| time.elapsed() < Duration::from_secs(5));
        }
        let entry = rates.entry(peer.0.ip()).or_insert((Instant::now(), 0));
        if entry.0.elapsed() >= Duration::from_secs(5) {
            *entry = (Instant::now(), 0);
        }
        entry.1 += 1;
        if entry.1 > 240 {
            return error(
                StatusCode::TOO_MANY_REQUESTS,
                "rate_limit",
                "Too many requests. Wait a moment and try again.",
            );
        }
    }
    drop(host);
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert("referrer-policy", HeaderValue::from_static("no-referrer"));
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    headers.insert("content-security-policy", HeaderValue::from_static("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"));
    response
}

#[derive(Deserialize)]
struct Admission {
    party_id: String,
    admission: String,
}
fn valid_admission(host: &Host, party_id: &str, admission: &str) -> bool {
    let invitation = &web(host).invitation;
    invitation.native.party_id == party_id
        && invitation.browser.admission == admission
        && invitation.native.expires >= now()
}
async fn bootstrap(State(state): State<HostState>, Json(body): Json<Admission>) -> Response {
    let Ok(host) = upgrade(&state) else {
        return error(StatusCode::GONE, "party_closed", "This party closed.");
    };
    if !valid_admission(&host, &body.party_id, &body.admission) {
        return error(
            StatusCode::UNAUTHORIZED,
            "invitation_expired",
            "This invitation expired. Scan the host's current QR.",
        );
    }
    let game = host.game.lock().await;
    Json(details(&game)).into_response()
}
#[derive(Deserialize)]
struct BrowserJoin {
    party_id: String,
    admission: String,
    name: String,
    request_id: String,
    controller: String,
}
fn uuid(text: &str) -> bool {
    Uuid::parse_str(text).is_ok()
}
fn credentials(host: &Host, token: &str, player: &BrowserPlayer, view: Value) -> Value {
    json!({"session_id":player.player_id,"credentials":{"invitation":web(host).invitation.encode(),"token":token,"player_id":player.player_id,"is_host":false},"view":view})
}
async fn browser_join(State(state): State<HostState>, Json(body): Json<BrowserJoin>) -> Response {
    let Ok(host) = upgrade(&state) else {
        return error(StatusCode::GONE, "party_closed", "This party closed.");
    };
    if !valid_admission(&host, &body.party_id, &body.admission) {
        return error(
            StatusCode::UNAUTHORIZED,
            "invitation_expired",
            "This invitation expired. Scan the host's current QR.",
        );
    }
    if !uuid(&body.request_id) || !uuid(&body.controller) {
        return bad("Invalid join request.");
    }
    let mut sessions = web(&host).sessions.lock().await;
    let mut game = host.game.lock().await;
    if let Some((name, token)) = sessions.joins.get(&body.request_id).cloned() {
        if name != body.name {
            return bad("That join request was already used.");
        }
        let player = sessions.players.get_mut(&token).unwrap();
        if !game
            .players
            .iter()
            .any(|p| p.id == player.player_id && !p.left)
        {
            return bad("Your previous place was removed. Start a new join.");
        }
        // Recover a lost join response even if its page has since reloaded.
        player.controller = body.controller;
        let id = player.player_id.clone();
        game.connection(&id, true);
        let result = credentials(&host, &token, player, game.view(&id));
        drop(game);
        drop(sessions);
        host.seen.lock().await.insert(id, Instant::now());
        return Json(result).into_response();
    }
    if sessions.joins.len() >= 512 {
        return bad("This party has had too many joins. Ask the host to create a new party.");
    }
    let player = match game.join(&body.name) {
        Ok(player) => player,
        Err(message) => return bad(&message),
    };
    let token = Uuid::new_v4().to_string();
    let browser_player = BrowserPlayer {
        player_id: player.id.clone(),
        controller: body.controller.clone(),
    };
    let result = credentials(&host, &token, &browser_player, game.view(&player.id));
    sessions
        .joins
        .insert(body.request_id, (body.name, token.clone()));
    sessions.players.insert(token, browser_player);
    drop(game);
    drop(sessions);
    host.seen.lock().await.insert(player.id, Instant::now());
    Json(result).into_response()
}
#[derive(Deserialize)]
struct Resume {
    party_id: String,
    player_id: String,
    controller: String,
}
async fn resume(
    State(state): State<HostState>,
    headers: HeaderMap,
    Json(body): Json<Resume>,
) -> Response {
    let Ok(host) = upgrade(&state) else {
        return error(StatusCode::GONE, "party_closed", "This party closed.");
    };
    if body.party_id != host.invitation.party_id || !uuid(&body.controller) {
        return bad("Invalid saved party.");
    }
    let Ok(token) = bearer(&headers) else {
        return error(
            StatusCode::UNAUTHORIZED,
            "no_player",
            "Your saved player is missing.",
        );
    };
    let mut sessions = web(&host).sessions.lock().await;
    let Some(player) = sessions.players.get_mut(token) else {
        return error(
            StatusCode::UNAUTHORIZED,
            "no_player",
            "Your saved place is no longer available.",
        );
    };
    let mut game = host.game.lock().await;
    if player.player_id != body.player_id
        || !game
            .players
            .iter()
            .any(|p| p.id == player.player_id && !p.left)
    {
        return error(
            StatusCode::UNAUTHORIZED,
            "no_player",
            "Your place was removed. Join again from the lobby.",
        );
    }
    player.controller = body.controller;
    game.connection(&player.player_id, true);
    let id = player.player_id.clone();
    let result = credentials(&host, token, player, game.view(&id));
    drop(game);
    drop(sessions);
    host.seen.lock().await.insert(id, Instant::now());
    Json(result).into_response()
}
async fn browser_request(state: HostState, headers: HeaderMap, action: Option<Action>) -> Response {
    let Ok(host) = upgrade(&state) else {
        return error(StatusCode::GONE, "party_closed", "This party closed.");
    };
    if headers
        .get("x-imposter-party")
        .and_then(|v| v.to_str().ok())
        != Some(host.invitation.party_id.as_str())
    {
        return error(
            StatusCode::UNAUTHORIZED,
            "no_player",
            "This player belongs to another party.",
        );
    }
    let Ok(token) = bearer(&headers) else {
        return error(
            StatusCode::UNAUTHORIZED,
            "no_player",
            "Player credentials are missing.",
        );
    };
    let sessions = web(&host).sessions.lock().await;
    let Some(player) = sessions.players.get(token) else {
        return error(
            StatusCode::UNAUTHORIZED,
            "no_player",
            "Your place is no longer available.",
        );
    };
    if headers
        .get("x-imposter-controller")
        .and_then(|v| v.to_str().ok())
        != Some(player.controller.as_str())
    {
        return error(
            StatusCode::CONFLICT,
            "controller_replaced",
            "Your player is open in another tab. Use that tab or reload this one to take control.",
        );
    }
    let id = player.player_id.clone();
    let mut game = host.game.lock().await;
    if !game.players.iter().any(|p| p.id == id && !p.left) {
        return error(
            StatusCode::UNAUTHORIZED,
            "no_player",
            "Your place was removed. Join again from the lobby.",
        );
    }
    game.connection(&id, true);
    if let Some(action) = action {
        if ![
            "ready",
            "role_ready",
            "vote",
            "choice",
            "done",
            "skip",
            "leave",
        ]
        .contains(&action.kind.as_str())
        {
            return error(
                StatusCode::FORBIDDEN,
                "host_only",
                "Only the installed host app can do that.",
            );
        }
        if game.phase == "ended" {
            return bad("The party has ended.");
        }
        if let Err(message) = game.apply(&id, &action) {
            return bad(&message);
        }
    }
    let result = game.view(&id);
    drop(game);
    drop(sessions);
    host.seen.lock().await.insert(id, Instant::now());
    Json(result).into_response()
}
async fn browser_state(State(state): State<HostState>, headers: HeaderMap) -> Response {
    browser_request(state, headers, None).await
}
async fn browser_action(
    State(state): State<HostState>,
    headers: HeaderMap,
    Json(action): Json<Action>,
) -> Response {
    browser_request(state, headers, Some(action)).await
}

async fn static_asset(State(state): State<HostState>, request: Request) -> Response {
    if request.method() != Method::GET && request.method() != Method::HEAD {
        return error(
            StatusCode::METHOD_NOT_ALLOWED,
            "not_allowed",
            "That operation is unavailable.",
        );
    }
    let Ok(host) = upgrade(&state) else {
        return error(StatusCode::GONE, "party_closed", "This party closed.");
    };
    let path = request.uri().path();
    let path = if ["/", "/join", "/play"].contains(&path) {
        "/index.html"
    } else {
        path
    };
    let Some(bytes) = web(&host).assets.get(path) else {
        return error(
            StatusCode::NOT_FOUND,
            "not_found",
            "This page is unavailable. Open the host's party link.",
        );
    };
    let mime = match path.rsplit('.').next().unwrap_or_default() {
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        _ => "application/octet-stream",
    };
    let body = if request.method() == Method::HEAD {
        Body::empty()
    } else {
        Body::from(bytes.clone())
    };
    ([(header::CONTENT_TYPE, mime)], body).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::Client;
    fn assets() -> Arc<WebAssets> {
        Arc::new(WebAssets::from([
            (
                "/index.html".into(),
                Bytes::from_static(b"<!doctype html><title>Offline party</title>"),
            ),
            (
                "/assets/game.js".into(),
                Bytes::from_static(b"const offline=true;"),
            ),
        ]))
    }
    async fn host() -> Session {
        Session::create_with_web(
            "Offline party",
            "Alex",
            "Shared router",
            Some("127.0.0.1".into()),
            assets(),
        )
        .await
        .unwrap()
    }
    fn request(
        client: &Client,
        invite: &SharedInvitation,
        route: &str,
        body: Value,
        player: Option<&Value>,
        controller: &str,
    ) -> reqwest::RequestBuilder {
        let mut request = client
            .post(format!("{}{route}", invite.browser.endpoint))
            .header("Origin", invite.browser.endpoint.trim_end_matches('/'))
            .header("X-Imposter-Client", "web-v1")
            .json(&body);
        if let Some(player) = player {
            request = request
                .bearer_auth(player["credentials"]["token"].as_str().unwrap())
                .header("X-Imposter-Party", &invite.native.party_id)
                .header("X-Imposter-Controller", controller);
        }
        request
    }
    async fn joined(
        client: &Client,
        invite: &SharedInvitation,
        name: &str,
        controller: &str,
    ) -> Value {
        let response = request(client, invite, "guest/join", json!({"party_id":invite.native.party_id,"admission":invite.browser.admission,"name":name,"request_id":Uuid::new_v4().to_string(),"controller":controller}), None, "").send().await.unwrap();
        assert!(response.status().is_success());
        response.json().await.unwrap()
    }
    fn command(round: u32, kind: &str, value: Value) -> Action {
        Action {
            id: Uuid::new_v4().to_string(),
            round_id: round,
            kind: kind.into(),
            value,
        }
    }
    #[tokio::test]
    async fn web_assets_and_shared_qr_preserve_native_tls_and_origin_guards() {
        let host = host().await;
        let invite = SharedInvitation::parse(&host.invitation()).unwrap();
        let client = Client::new();
        let page = client
            .get(format!("{}join", invite.browser.endpoint))
            .send()
            .await
            .unwrap();
        assert_eq!(page.status(), StatusCode::OK);
        assert_eq!(page.headers()["cache-control"], "no-store");
        assert!(page.headers().get("access-control-allow-origin").is_none());
        assert!(page.text().await.unwrap().contains("Offline party"));
        let native = Session::join(&host.invitation(), "Sam").await.unwrap();
        assert_eq!(
            native.snapshot().await.unwrap()["players"]
                .as_array()
                .unwrap()
                .len(),
            2
        );
        let forbidden = client
            .post(format!("{}guest/bootstrap", invite.browser.endpoint))
            .json(&json!({"party_id":invite.native.party_id,"admission":invite.browser.admission}))
            .send()
            .await
            .unwrap();
        assert_eq!(forbidden.status(), StatusCode::FORBIDDEN);
        let wrong_host = client
            .get(&invite.browser.endpoint)
            .header("Host", "attacker.example")
            .send()
            .await
            .unwrap();
        assert_eq!(wrong_host.status(), StatusCode::FORBIDDEN);
        let admin = request(
            &client,
            &invite,
            "api/create",
            json!({"name":"Other"}),
            None,
            "",
        )
        .send()
        .await
        .unwrap();
        assert_eq!(admin.status(), StatusCode::METHOD_NOT_ALLOWED);
        let mut malformed = invite.clone();
        malformed.browser.endpoint = "http://8.8.8.8:1234/".into();
        assert!(SharedInvitation::parse(&malformed.encode()).is_err());
        malformed = invite.clone();
        malformed.native.endpoint = "https://192.168.2.5:1234/".into();
        assert!(SharedInvitation::parse(&malformed.encode()).is_err());
    }
    #[tokio::test]
    async fn web_join_retries_resume_and_controller_replacement_cannot_create_host_privileges() {
        let host = host().await;
        let invite = SharedInvitation::parse(&host.invitation()).unwrap();
        let client = Client::new();
        let first = Uuid::new_v4().to_string();
        let body = json!({"party_id":invite.native.party_id,"admission":invite.browser.admission,"name":"Mia","request_id":Uuid::new_v4().to_string(),"controller":first});
        let player: Value = request(&client, &invite, "guest/join", body.clone(), None, "")
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        let retried: Value = request(&client, &invite, "guest/join", body, None, "")
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        assert_eq!(player["credentials"], retried["credentials"]);
        assert_eq!(
            host.snapshot().await.unwrap()["players"]
                .as_array()
                .unwrap()
                .len(),
            2
        );
        let second = Uuid::new_v4().to_string();
        let resume_body = json!({"party_id":invite.native.party_id,"player_id":player["credentials"]["player_id"],"controller":second});
        let resumed = request(
            &client,
            &invite,
            "guest/resume",
            resume_body,
            Some(&player),
            "",
        )
        .send()
        .await
        .unwrap();
        assert!(resumed.status().is_success());
        let stale = request(
            &client,
            &invite,
            "guest/action",
            serde_json::to_value(command(0, "ready", json!(true))).unwrap(),
            Some(&player),
            &first,
        )
        .send()
        .await
        .unwrap();
        assert_eq!(stale.status(), StatusCode::CONFLICT);
        for kind in ["start", "end", "topics", "remove", "open_vote", "abandon"] {
            let denied = request(
                &client,
                &invite,
                "guest/action",
                serde_json::to_value(command(0, kind, Value::Null)).unwrap(),
                Some(&player),
                &second,
            )
            .send()
            .await
            .unwrap();
            assert_eq!(denied.status(), StatusCode::FORBIDDEN);
        }
        let spoofed = request(&client,&invite,"guest/resume",json!({"party_id":invite.native.party_id,"player_id":host.player_id,"controller":second}),Some(&player),"").send().await.unwrap();
        assert_eq!(spoofed.status(), StatusCode::UNAUTHORIZED);
        let tls = invite
            .native
            .client()
            .unwrap()
            .get(format!("{}state", invite.native.endpoint))
            .bearer_auth(player["credentials"]["token"].as_str().unwrap())
            .send()
            .await
            .unwrap();
        assert!(!tls.status().is_success());
        assert_eq!(host.snapshot().await.unwrap()["phase"], "lobby");
    }
    #[tokio::test]
    async fn mixed_native_and_browser_players_complete_one_authoritative_game() {
        let host = host().await;
        let invite = SharedInvitation::parse(&host.invitation()).unwrap();
        let native = Session::join(&host.invitation(), "Sam").await.unwrap();
        let client = Client::new();
        let controllers = [Uuid::new_v4().to_string(), Uuid::new_v4().to_string()];
        let browsers = [
            joined(&client, &invite, "Mia", &controllers[0]).await,
            joined(&client, &invite, "Ben", &controllers[1]).await,
        ];
        async fn web_action(
            client: &Client,
            invite: &SharedInvitation,
            player: &Value,
            controller: &str,
            action: Action,
        ) -> Value {
            let response = request(
                client,
                invite,
                "guest/action",
                serde_json::to_value(action).unwrap(),
                Some(player),
                controller,
            )
            .send()
            .await
            .unwrap();
            assert!(
                response.status().is_success(),
                "{}",
                response.text().await.unwrap_or_default()
            );
            response.json().await.unwrap()
        }
        native.send(command(0, "ready", json!(true))).await.unwrap();
        for (p, c) in browsers.iter().zip(&controllers) {
            web_action(&client, &invite, p, c, command(0, "ready", json!(true))).await;
        }
        host.send(command(0, "start", Value::Null)).await.unwrap();
        let game = host.host.as_ref().unwrap().game.lock().await;
        let imposter = game.round.imposter.clone();
        let word = game.round.word.clone();
        let round = game.round.id;
        drop(game);
        for (p, c) in browsers.iter().zip(&controllers) {
            let view: Value = request(&client, &invite, "guest/state", json!({}), Some(p), c)
                .send()
                .await
                .unwrap()
                .json()
                .await
                .unwrap();
            assert!(view["result"].is_null());
            assert!(view.get("word").is_none());
            if view["my_id"] == imposter {
                assert_ne!(view["private_role"]["clue"], word);
            } else {
                assert_eq!(view["private_role"]["clue"], word);
            }
            web_action(
                &client,
                &invite,
                p,
                c,
                command(round, "role_ready", Value::Null),
            )
            .await;
        }
        host.send(command(round, "role_ready", Value::Null))
            .await
            .unwrap();
        native
            .send(command(round, "role_ready", Value::Null))
            .await
            .unwrap();
        host.send(command(round, "open_vote", Value::Null))
            .await
            .unwrap();
        for session in [&host, &native] {
            let target = if session.player_id == imposter {
                browsers[0]["credentials"]["player_id"].as_str().unwrap()
            } else {
                &imposter
            };
            session
                .send(command(round, "vote", json!(target)))
                .await
                .unwrap();
        }
        for (p, c) in browsers.iter().zip(&controllers) {
            let target = if p["credentials"]["player_id"] == imposter {
                &host.player_id
            } else {
                &imposter
            };
            let action = command(round, "vote", json!(target));
            web_action(&client, &invite, p, c, action.clone()).await;
            web_action(&client, &invite, p, c, action).await;
        }
        let result = host.snapshot().await.unwrap();
        assert_eq!(result["phase"], "results");
        assert_eq!(result["result"]["escaped"], false);
        for p in result["players"].as_array().unwrap() {
            assert_eq!(p["points"], if p["id"] == imposter { 0 } else { 1 });
        }
        host.send(command(round, "punish", Value::Null))
            .await
            .unwrap();
        let view = host.snapshot().await.unwrap();
        let current = view["punishment"]["player_id"].as_str().unwrap();
        let choose = command(round, "choice", json!("dare"));
        let done = command(round, "done", Value::Null);
        if current == host.player_id {
            host.send(choose).await.unwrap();
            host.send(done).await.unwrap();
        } else if current == native.player_id {
            native.send(choose).await.unwrap();
            native.send(done).await.unwrap();
        } else {
            let index = browsers
                .iter()
                .position(|p| p["credentials"]["player_id"] == current)
                .unwrap();
            web_action(
                &client,
                &invite,
                &browsers[index],
                &controllers[index],
                choose,
            )
            .await;
            web_action(
                &client,
                &invite,
                &browsers[index],
                &controllers[index],
                done,
            )
            .await;
        }
        assert_eq!(host.snapshot().await.unwrap()["phase"], "rankings");
        host.send(command(round, "end", Value::Null)).await.unwrap();
        let ended: Value = request(
            &client,
            &invite,
            "guest/state",
            json!({}),
            Some(&browsers[0]),
            &controllers[0],
        )
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
        assert_eq!(ended["phase"], "ended");
        assert_eq!(ended["players"], host.snapshot().await.unwrap()["players"]);
        let endpoint = invite.browser.endpoint.clone();
        drop(host);
        tokio::time::sleep(Duration::from_millis(50)).await;
        let stopped = client.get(endpoint).send().await;
        assert!(stopped.is_err() || stopped.unwrap().status() == StatusCode::GONE);
    }
}
