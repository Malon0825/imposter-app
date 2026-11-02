use party_core::{game::Action, network::Sessions, Session};
use serde_json::{json, Value};
use tauri::{Manager, State};
include!(concat!(env!("OUT_DIR"), "/web_assets.rs"));

#[cfg(target_os = "android")]
struct Native(tauri::plugin::PluginHandle<tauri::Wry>);

async fn platform(app: tauri::AppHandle, operation: String) -> Result<Value, String> {
    #[cfg(target_os = "android")]
    {
        tauri::async_runtime::spawn_blocking(move || {
            app.state::<Native>()
                .0
                .run_mobile_plugin::<Value>(&operation, json!({}))
                .map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, operation);
        Ok(
            json!({"platform":if cfg!(target_os="ios"){ "ios" }else{ "desktop" },"wifi":true,"wifi_name":"Local network","ip":party_core::network::local_ip(),"battery_unrestricted":false,"background_supported":false}),
        )
    }
}
#[tauri::command]
async fn native_action(app: tauri::AppHandle, operation: String) -> Result<Value, String> {
    if ![
        "status",
        "prepareNetwork",
        "wifiSettings",
        "batterySettings",
        "startHosting",
        "stopHosting",
        "secureScreen",
        "minimize",
        "consumeInvitation",
    ]
    .contains(&operation.as_str())
    {
        return Err("Unsupported device action.".into());
    }
    platform(app, operation).await
}
#[tauri::command]
async fn game_create(
    app: tauri::AppHandle,
    sessions: State<'_, Sessions>,
    name: String,
    player: String,
    wifi: String,
) -> Result<Value, String> {
    let status = platform(app.clone(), "prepareNetwork".into()).await?;
    if !status["wifi"].as_bool().unwrap_or(false) {
        return Err("Connect to the shared router's Wi-Fi before hosting.".into());
    }
    let address = status["ip"].as_str().map(str::to_string);
    let session =
        Session::create_with_web(&name, &player, &wifi, address, sessions.web_assets.clone())
            .await?;
    let credentials = session.credentials();
    let view = session.snapshot().await?;
    let id = sessions.insert(session).await;
    Ok(json!({"session_id":id,"credentials":credentials,"view":view}))
}
#[tauri::command]
async fn game_inspect(app: tauri::AppHandle, invitation: String) -> Result<Value, String> {
    let s = platform(app, "prepareNetwork".into()).await?;
    if !s["wifi"].as_bool().unwrap_or(false) {
        return Err("Connect to the host's Wi-Fi first.".into());
    }
    Session::inspect(&invitation).await
}
#[tauri::command]
async fn game_join(
    app: tauri::AppHandle,
    sessions: State<'_, Sessions>,
    invitation: String,
    player: String,
) -> Result<Value, String> {
    let s = platform(app, "prepareNetwork".into()).await?;
    if !s["wifi"].as_bool().unwrap_or(false) {
        return Err("Connect to the host's Wi-Fi first.".into());
    }
    let session = Session::join(&invitation, &player).await?;
    let credentials = session.credentials();
    let view = session.snapshot().await?;
    let id = sessions.insert(session).await;
    Ok(json!({"session_id":id,"credentials":credentials,"view":view}))
}
#[tauri::command]
async fn game_resume(
    app: tauri::AppHandle,
    sessions: State<'_, Sessions>,
    invitation: String,
    token: String,
    player_id: String,
) -> Result<Value, String> {
    platform(app, "prepareNetwork".into()).await?;
    let session = Session::resume(&invitation, &token, &player_id).await?;
    let credentials = session.credentials();
    let view = session.snapshot().await?;
    let id = sessions.insert(session).await;
    Ok(json!({"session_id":id,"credentials":credentials,"view":view}))
}
#[tauri::command]
async fn game_state(sessions: State<'_, Sessions>, session_id: String) -> Result<Value, String> {
    sessions.get(&session_id).await?.snapshot().await
}
#[tauri::command]
async fn game_action(
    app: tauri::AppHandle,
    sessions: State<'_, Sessions>,
    session_id: String,
    action: Action,
) -> Result<Value, String> {
    let session = sessions.get(&session_id).await?;
    let view = session.send(action).await?;
    let _ = app;
    Ok(view)
}
#[tauri::command]
async fn game_close(
    app: tauri::AppHandle,
    sessions: State<'_, Sessions>,
    session_id: String,
) -> Result<(), String> {
    let session = sessions.get(&session_id).await?;
    if session.credentials()["is_host"] == true {
        if session.snapshot().await?["phase"] == "ended" {
            // Give visible guests a final polling opportunity before closing the LAN server.
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
        let _ = platform(app, "stopHosting".into()).await;
    }
    sessions.remove(&session_id).await;
    Ok(())
}
#[tauri::command]
fn game_catalog() -> Value {
    party_core::content::catalog()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder =
        tauri::Builder::default().manage(Sessions::with_web_assets(bundled_web_assets()));
    #[cfg(target_os = "android")]
    {
        builder = builder.plugin(
            tauri::plugin::Builder::<tauri::Wry>::new("party-native")
                .setup(|app, api| {
                    let handle =
                        api.register_android_plugin("com.imposter.party", "PartyPlugin")?;
                    app.manage(Native(handle));
                    Ok(())
                })
                .build(),
        );
    }
    builder
        .plugin(tauri_plugin_barcode_scanner::init())
        .invoke_handler(tauri::generate_handler![
            native_action,
            game_create,
            game_inspect,
            game_join,
            game_resume,
            game_state,
            game_action,
            game_close,
            game_catalog
        ])
        .run(tauri::generate_context!())
        .expect("Imposter could not start");
}
