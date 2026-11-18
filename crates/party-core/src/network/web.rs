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
    recoveries: HashMap<String, Recovery>,    // private browser proof -> host-reviewed request
}
struct Recovery {
    id: String,
    player_id: String,
    created: Instant,
    decision: RecoveryDecision,
}
enum RecoveryDecision {
    Pending,
    Approved(String),
    Rejected,
}
const RECOVERY_TTL: Duration = Duration::from_secs(120);
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
        .route("/guest/recover", post(recover))
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

pub(super) async fn host_view(host: &Host, player_id: &str) -> Value {
    let sessions = web(host).sessions.lock().await;
    let game = host.game.lock().await;
    let mut view = game.view(player_id);
    let mut pending: Vec<_> = sessions
        .recoveries
        .values()
        .filter(|r| {
            r.created.elapsed() < RECOVERY_TTL && matches!(r.decision, RecoveryDecision::Pending)
        })
        .filter_map(|r| {
            game.players
                .iter()
                .find(|p| p.id == r.player_id && !p.left && !p.connected)
                .map(|p| {
                    (
                        r.created,
                        json!({"id":r.id,"name":p.name,"code":r.id[..6].to_uppercase()}),
                    )
                })
        })
        .collect();
    pending.sort_by_key(|(created, _)| *created);
    view["reconnect_requests"] = json!(pending.into_iter().map(|(_, r)| r).collect::<Vec<_>>());
    view
}

// Only the locally owned host session calls this. Guest actions cannot approve recovery.
pub(super) async fn decide_recovery(host: &Host, action: &Action) -> GameResult<()> {
    let mut sessions = web(host).sessions.lock().await;
    let game = host.game.lock().await;
    if game.phase == "ended"
        || action.round_id != game.round.id
        || action.id.is_empty()
        || action.id.len() > 80
    {
        return Err("This recovery request is no longer available.".into());
    }
    let request_id = action.value.as_str().unwrap_or_default();
    let proof = sessions
        .recoveries
        .iter()
        .find(|(_, r)| r.id == request_id && r.created.elapsed() < RECOVERY_TTL)
        .map(|(proof, _)| proof.clone())
        .ok_or("This recovery request expired. Ask the player to try again.")?;
    let recovery = &sessions.recoveries[&proof];
    if !matches!(recovery.decision, RecoveryDecision::Pending) {
        return Ok(()); // A retried host approval must not rotate credentials twice.
    }
    let id = recovery.player_id.clone();
    if action.kind == "reject_reconnect" {
        sessions.recoveries.get_mut(&proof).unwrap().decision = RecoveryDecision::Rejected;
        return Ok(());
    }
    if !game
        .players
        .iter()
        .any(|p| p.id == id && !p.left && !p.connected)
    {
        return Err("This player has already reconnected or left the party.".into());
    }
    let old_tokens: Vec<_> = sessions
        .players
        .iter()
        .filter(|(_, p)| p.player_id == id)
        .map(|(token, _)| token.clone())
        .collect();
    sessions.players.retain(|_, p| p.player_id != id);
    sessions
        .joins
        .retain(|_, (_, token)| !old_tokens.contains(token));
    for recovery in sessions
        .recoveries
        .values_mut()
        .filter(|r| r.player_id == id)
    {
        recovery.decision = RecoveryDecision::Rejected;
    }
    let token = Uuid::new_v4().to_string();
    sessions.players.insert(
        token.clone(),
        BrowserPlayer {
            player_id: id,
            controller: String::new(),
        },
    );
    let recovery = sessions.recoveries.get_mut(&proof).unwrap();
    recovery.decision = RecoveryDecision::Approved(token);
    recovery.created = Instant::now();
    Ok(())
}

#[derive(Deserialize)]
struct Recover {
    party_id: String,
    admission: String,
    name: String,
    request_id: String,
    controller: String,
}
async fn recover(State(state): State<HostState>, Json(body): Json<Recover>) -> Response {
    let Ok(host) = upgrade(&state) else {
        return error(StatusCode::GONE, "party_closed", "This party closed.");
    };
    if !valid_admission(&host, &body.party_id, &body.admission) {
        return error(
            StatusCode::UNAUTHORIZED,
            "invitation_expired",
            "Scan the host's current QR to reconnect.",
        );
    }
    if !uuid(&body.request_id) || !uuid(&body.controller) {
        return bad("Invalid recovery request.");
    }
    let name = match crate::game::clean_name(&body.name) {
        Ok(name) => name,
        Err(message) => return bad(&message),
    };
    let mut sessions = web(&host).sessions.lock().await;
    let mut game = host.game.lock().await;
    sessions
        .recoveries
        .retain(|_, r| r.created.elapsed() < RECOVERY_TTL);
    if game.phase == "ended" {
        return error(
            StatusCode::GONE,
            "party_closed",
            "This party has ended. Ask the host for a new invitation.",
        );
    }
    let Some(player) = game
        .players
        .iter()
        .find(|p| p.id != game.host && !p.left && p.name.to_lowercase() == name.to_lowercase())
    else {
        return error(StatusCode::CONFLICT, "recovery_unavailable", "No returning player has that name. Use the name you joined with, or join as a new player in the lobby.");
    };
    let id = player.id.clone();
    let connected = player.connected;
    if let Some(recovery) = sessions.recoveries.get(&body.request_id) {
        if recovery.player_id != id {
            return bad("That recovery request was already used for another player.");
        }
        match &recovery.decision {
            RecoveryDecision::Rejected => {
                return error(
                    StatusCode::FORBIDDEN,
                    "recovery_rejected",
                    "The host declined this request. Check with them before trying again.",
                )
            }
            RecoveryDecision::Approved(token) => {
                let token = token.clone();
                let Some(player) = sessions.players.get_mut(&token) else {
                    return error(
                        StatusCode::CONFLICT,
                        "recovery_unavailable",
                        "This recovery was replaced. Ask the host to reconnect you again.",
                    );
                };
                player.controller = body.controller;
                game.connection(&id, true);
                let result = credentials(&host, &token, player, game.view(&id));
                drop(game);
                drop(sessions);
                host.seen.lock().await.insert(id, Instant::now());
                return Json(json!({"status":"approved","session":result})).into_response();
            }
            RecoveryDecision::Pending => {}
        }
    } else {
        if connected || !sessions.players.values().any(|p| p.player_id == id) {
            return error(StatusCode::CONFLICT, "recovery_unavailable", "That player is still connected. Close their old tab, wait about 10 seconds, then try again.");
        }
        if sessions.recoveries.len() >= 48 {
            return error(
                StatusCode::TOO_MANY_REQUESTS,
                "rate_limit",
                "Too many recovery requests. Wait two minutes and try again.",
            );
        }
        sessions.recoveries.insert(
            body.request_id.clone(),
            Recovery {
                id: Uuid::new_v4().to_string(),
                player_id: id,
                created: Instant::now(),
                decision: RecoveryDecision::Pending,
            },
        );
    }
    if connected {
        return error(
            StatusCode::CONFLICT,
            "recovery_unavailable",
            "This player has already reconnected. Use their active tab.",
        );
    }
    let recovery = &sessions.recoveries[&body.request_id];
    Json(json!({"status":"pending","code":recovery.id[..6].to_uppercase()})).into_response()
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
            "topic_vote",
            "role_ready",
            "clue",
            "vote",
            "report",
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
    fn recovery_body(invite: &SharedInvitation, name: &str) -> Value {
        json!({"party_id":invite.native.party_id,"admission":invite.browser.admission,
            "name":name,"request_id":Uuid::new_v4().to_string(),"controller":Uuid::new_v4().to_string()})
    }
    async fn recovery(
        client: &Client,
        invite: &SharedInvitation,
        body: Value,
    ) -> reqwest::Response {
        request(client, invite, "guest/recover", body, None, "")
            .send()
            .await
            .unwrap()
    }
    #[tokio::test]
    async fn host_approved_recovery_preserves_identity_role_score_and_locked_vote() {
        let host = host().await;
        let invite = SharedInvitation::parse(&host.invitation()).unwrap();
        let client = Client::new();
        let original = joined(&client, &invite, "Mia", &Uuid::new_v4().to_string()).await;
        joined(&client, &invite, "Ben", &Uuid::new_v4().to_string()).await;
        let id = original["credentials"]["player_id"].as_str().unwrap();
        let original_role;
        {
            let mut game = host.host.as_ref().unwrap().game.lock().await;
            for player in &mut game.players {
                player.ready = true;
            }
            game.players.iter_mut().find(|p| p.id == id).unwrap().points = 7;
            game.apply(&host.player_id, &command(0, "start", Value::Null))
                .unwrap();
            for voter in game.round.roster.clone() {
                game.apply(&voter, &command(1, "topic_vote", json!(["food"])))
                    .unwrap();
            }
            game.apply(&host.player_id, &command(1, "begin_round", Value::Null))
                .unwrap();
            original_role = game.view(id)["private_role"].clone();
            game.connection(id, false);
            assert!(game.paused);
        }
        let body = recovery_body(&invite, " mia ");
        let pending: Value = recovery(&client, &invite, body.clone())
            .await
            .json()
            .await
            .unwrap();
        assert_eq!(pending["status"], "pending");
        assert!(pending.get("session").is_none());
        assert!(pending.get("credentials").is_none());
        let view = host.snapshot().await.unwrap();
        let review = &view["reconnect_requests"][0];
        assert_eq!(review["code"], pending["code"]);
        assert_ne!(review["id"], body["request_id"]); // Public approval ID is not the private recovery proof.
        let approve = command(1, "approve_reconnect", review["id"].clone());
        host.send(approve.clone()).await.unwrap();
        host.send(approve).await.unwrap();
        let recovered: Value = recovery(&client, &invite, body.clone())
            .await
            .json()
            .await
            .unwrap();
        let session = &recovered["session"];
        assert_eq!(session["credentials"]["player_id"], id);
        assert_ne!(
            session["credentials"]["token"],
            original["credentials"]["token"]
        );
        assert_eq!(session["view"]["private_role"], original_role);
        assert_eq!(session["view"]["paused"], false);
        assert_eq!(session["view"]["players"].as_array().unwrap().len(), 3);
        assert_eq!(session["view"]["players"][1]["points"], 7);
        assert!(session["view"].get("reconnect_requests").is_none());
        let retry: Value = recovery(&client, &invite, body.clone())
            .await
            .json()
            .await
            .unwrap();
        assert_eq!(retry["session"]["credentials"], session["credentials"]);
        let denied = request(&client, &invite, "guest/resume", json!({"party_id":invite.native.party_id,"player_id":id,"controller":Uuid::new_v4().to_string()}), Some(&original), "").send().await.unwrap();
        assert_eq!(denied.status(), StatusCode::UNAUTHORIZED);
        let mut guessed = body.clone();
        guessed["request_id"] = review["id"].clone();
        assert_eq!(
            recovery(&client, &invite, guessed).await.status(),
            StatusCode::CONFLICT
        );
        {
            let mut game = host.host.as_ref().unwrap().game.lock().await;
            let ids: Vec<_> = game.players.iter().map(|p| p.id.clone()).collect();
            for actor in ids {
                game.apply(&actor, &command(1, "role_ready", Value::Null))
                    .unwrap();
            }
            game.apply(&host.player_id, &command(1, "open_vote", Value::Null))
                .unwrap();
            game.apply(id, &command(1, "vote", json!(host.player_id)))
                .unwrap();
            game.connection(id, false);
        }
        let ballot_body = recovery_body(&invite, "Mia");
        recovery(&client, &invite, ballot_body.clone())
            .await
            .error_for_status()
            .unwrap();
        let ballot_review = host.snapshot().await.unwrap()["reconnect_requests"][0]["id"].clone();
        host.send(command(1, "approve_reconnect", ballot_review))
            .await
            .unwrap();
        let ballot: Value = recovery(&client, &invite, ballot_body)
            .await
            .json()
            .await
            .unwrap();
        assert_eq!(ballot["session"]["view"]["my_vote"], host.player_id);
        assert_eq!(ballot["session"]["view"]["vote_count"], 1);
        assert_eq!(ballot["session"]["view"]["players"][1]["points"], 7);
        assert_eq!(
            recovery(&client, &invite, body).await.status(),
            StatusCode::FORBIDDEN
        );
    }
    #[tokio::test]
    async fn recovery_requires_disconnection_host_approval_and_a_live_place() {
        let host = host().await;
        let invite = SharedInvitation::parse(&host.invitation()).unwrap();
        let client = Client::new();
        let controller = Uuid::new_v4().to_string();
        let player = joined(&client, &invite, "Élodie", &controller).await;
        let id = player["credentials"]["player_id"].as_str().unwrap();
        for name in ["ÉLODIE", "Alex", "Nobody"] {
            assert_eq!(
                recovery(&client, &invite, recovery_body(&invite, name))
                    .await
                    .status(),
                StatusCode::CONFLICT
            );
        }
        let mut invalid = recovery_body(&invite, "élodie");
        invalid["admission"] = json!(Uuid::new_v4().to_string());
        assert_eq!(
            recovery(&client, &invite, invalid).await.status(),
            StatusCode::UNAUTHORIZED
        );
        host.host
            .as_ref()
            .unwrap()
            .game
            .lock()
            .await
            .connection(id, false);
        let body = recovery_body(&invite, " élODIE ");
        recovery(&client, &invite, body.clone())
            .await
            .error_for_status()
            .unwrap();
        let review = host.snapshot().await.unwrap()["reconnect_requests"][0]["id"].clone();
        for kind in ["approve_reconnect", "reject_reconnect"] {
            let denied = request(
                &client,
                &invite,
                "guest/action",
                serde_json::to_value(command(0, kind, review.clone())).unwrap(),
                Some(&player),
                &controller,
            )
            .send()
            .await
            .unwrap();
            assert_eq!(denied.status(), StatusCode::FORBIDDEN);
        }
        host.send(command(0, "reject_reconnect", review))
            .await
            .unwrap();
        assert_eq!(
            recovery(&client, &invite, body).await.status(),
            StatusCode::FORBIDDEN
        );
        host.host
            .as_ref()
            .unwrap()
            .game
            .lock()
            .await
            .connection(id, false);
        let expired = recovery_body(&invite, "élodie");
        recovery(&client, &invite, expired.clone())
            .await
            .error_for_status()
            .unwrap();
        let review = host.snapshot().await.unwrap()["reconnect_requests"][0]["id"].clone();
        web(host.host.as_ref().unwrap())
            .sessions
            .lock()
            .await
            .recoveries
            .get_mut(expired["request_id"].as_str().unwrap())
            .unwrap()
            .created = Instant::now() - RECOVERY_TTL;
        assert!(host
            .send(command(0, "approve_reconnect", review))
            .await
            .is_err());
        assert!(host.snapshot().await.unwrap()["reconnect_requests"]
            .as_array()
            .unwrap()
            .is_empty());
        let removed = recovery_body(&invite, "Élodie");
        recovery(&client, &invite, removed.clone())
            .await
            .error_for_status()
            .unwrap();
        let review = host.snapshot().await.unwrap()["reconnect_requests"][0]["id"].clone();
        host.send(command(0, "remove", json!(id))).await.unwrap();
        assert!(host
            .send(command(0, "approve_reconnect", review))
            .await
            .is_err());
        assert_eq!(
            recovery(&client, &invite, removed).await.status(),
            StatusCode::CONFLICT
        );
        host.send(command(0, "end", Value::Null)).await.unwrap();
        assert_eq!(
            recovery(&client, &invite, recovery_body(&invite, "Mia"))
                .await
                .status(),
            StatusCode::GONE
        );
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
        for kind in [
            "start",
            "begin_round",
            "draw_topic",
            "end",
            "topics",
            "remove",
            "open_vote",
            "abandon",
        ] {
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
        host.send(command(1, "topic_vote", json!(["food"])))
            .await
            .unwrap();
        native
            .send(command(1, "topic_vote", json!(["food"])))
            .await
            .unwrap();
        for (p, c) in browsers.iter().zip(&controllers) {
            web_action(
                &client,
                &invite,
                p,
                c,
                command(1, "topic_vote", json!(["food"])),
            )
            .await;
        }
        host.send(command(1, "begin_round", Value::Null))
            .await
            .unwrap();
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
        host.send(command(round, "open_reports", Value::Null))
            .await
            .unwrap();
        host.send(command(round, "report", json!([])))
            .await
            .unwrap();
        native
            .send(command(round, "report", json!([host.player_id])))
            .await
            .unwrap();
        for (p, c) in browsers.iter().zip(&controllers) {
            let report = command(round, "report", json!([host.player_id]));
            web_action(&client, &invite, p, c, report.clone()).await;
            web_action(&client, &invite, p, c, report).await;
        }
        let view = host.snapshot().await.unwrap();
        assert_eq!(view["phase"], "punishment");
        assert_eq!(view["result"]["report_penalty"], 0);
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
