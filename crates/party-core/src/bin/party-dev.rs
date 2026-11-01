//! Loopback-only bridge for exercising the actual Rust/TLS game in a browser.
use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::Response,
    routing::post,
    Json, Router,
};
use party_core::{
    game::Action,
    network::{Session, Sessions},
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
type Error = (StatusCode, Json<Value>);
fn err(e: impl ToString) -> Error {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({"error":e.to_string()})),
    )
}
#[derive(Deserialize)]
struct Body {
    #[serde(default)]
    session_id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    player: String,
    #[serde(default)]
    wifi: String,
    #[serde(default)]
    invitation: String,
    #[serde(default)]
    token: String,
    #[serde(default)]
    player_id: String,
    action: Option<Action>,
}
async fn call(
    State(s): State<Arc<Sessions>>,
    axum::extract::Path(method): axum::extract::Path<String>,
    Json(b): Json<Body>,
) -> Result<Json<Value>, Error> {
    let v = match method.as_str() {
        "create" => {
            let session = Session::create(&b.name, &b.player, &b.wifi, Some("127.0.0.1".into()))
                .await
                .map_err(err)?;
            let c = session.credentials();
            let view = session.snapshot().await.map_err(err)?;
            let id = s.insert(session).await;
            json!({"session_id":id,"credentials":c,"view":view})
        }
        "inspect" => Session::inspect(&b.invitation).await.map_err(err)?,
        "join" | "resume" => {
            let session = if method == "join" {
                Session::join(&b.invitation, &b.player).await
            } else {
                Session::resume(&b.invitation, &b.token, &b.player_id).await
            }
            .map_err(err)?;
            let c = session.credentials();
            let view = session.snapshot().await.map_err(err)?;
            let id = s.insert(session).await;
            json!({"session_id":id,"credentials":c,"view":view})
        }
        "state" => s
            .get(&b.session_id)
            .await
            .map_err(err)?
            .snapshot()
            .await
            .map_err(err)?,
        "action" => s
            .get(&b.session_id)
            .await
            .map_err(err)?
            .send(b.action.ok_or_else(|| err("Missing action"))?)
            .await
            .map_err(err)?,
        "close" => {
            s.remove(&b.session_id).await;
            json!({})
        }
        "catalog" => party_core::content::catalog(),
        _ => return Err(err("Unknown method")),
    };
    Ok(Json(v))
}
async fn guard(req: Request, next: Next) -> Response {
    if req
        .headers()
        .get("x-imposter-dev")
        .and_then(|v| v.to_str().ok())
        != Some("1")
    {
        return axum::response::IntoResponse::into_response((
            StatusCode::FORBIDDEN,
            "Local development bridge only",
        ));
    }
    next.run(req).await
}
#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/{method}", post(call))
        .layer(axum::extract::DefaultBodyLimit::max(16 * 1024))
        .layer(middleware::from_fn(guard))
        .with_state(Arc::new(Sessions::default()));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3142")
        .await
        .expect("Port 3142 available");
    println!("Rust game bridge listening on http://127.0.0.1:3142 (loopback only)");
    axum::serve(listener, app).await.unwrap();
}
