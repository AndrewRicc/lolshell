//! Desktop side of the app: the only code that talks to the League client's local API.
//! It reads the lockfile, forwards requests from the UI, serves the client's own images,
//! and relays the client's events to the window.

use std::{sync::LazyLock, time::Duration};

use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{
    http::Response,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tokio_tungstenite::{
    connect_async_tls_with_config,
    tungstenite::{client::IntoClientRequest, Message},
    Connector,
};

struct Lcu {
    port: String,
    auth: String,
}

fn parse_lockfile(s: &str) -> Option<Lcu> {
    let p: Vec<&str> = s.trim().split(':').collect();
    (p.len() >= 5 && p[2].parse::<u16>().is_ok()).then(|| Lcu {
        port: p[2].into(),
        auth: format!("Basic {}", STANDARD.encode(format!("riot:{}", p[3]))),
    })
}

/// Finds the running client. Re-read on every use: port and password change at each start,
/// and the install folder differs from one PC to another (the Riot Client records it).
fn lockfile() -> Option<Lcu> {
    let data = std::env::var("PROGRAMDATA").ok()?;
    let installs = std::fs::read_to_string(format!("{data}\\Riot Games\\RiotClientInstalls.json")).ok()?;
    let installs: Value = serde_json::from_str(&installs).ok()?;
    installs["associated_client"].as_object()?.keys().find_map(|dir| {
        parse_lockfile(&std::fs::read_to_string(std::path::Path::new(dir).join("lockfile")).ok()?)
    })
}

/// The only root trusted for the client's certificate.
const RIOT_ROOT: &[u8] = include_bytes!("../riotgames.pem");

fn http_client() -> reqwest::Client {
    http_client_with(RIOT_ROOT)
}

// Hostname check off: the client's cert has no SAN, and the host is always 127.0.0.1.
fn http_client_with(root: &[u8]) -> reqwest::Client {
    reqwest::Client::builder()
        .tls_built_in_root_certs(false)
        .add_root_certificate(reqwest::Certificate::from_pem(root).expect("root cert"))
        .danger_accept_invalid_hostnames(true)
        .pool_max_idle_per_host(CONNECTIONS)
        .build()
        .expect("http client")
}

fn tls_connector(root: &[u8]) -> Option<native_tls::TlsConnector> {
    native_tls::TlsConnector::builder()
        .disable_built_in_roots(true)
        .add_root_certificate(native_tls::Certificate::from_pem(root).ok()?)
        .danger_accept_invalid_hostnames(true) // same reason as http_client_with
        .build()
        .ok()
}

// The client stops accepting connections after a couple of hundred: a champion grid asks for
// every icon at once, so requests wait for one of a few connections, as a browser would.
const CONNECTIONS: usize = 6;
static GATE: LazyLock<tokio::sync::Semaphore> = LazyLock::new(|| tokio::sync::Semaphore::new(CONNECTIONS));

#[derive(Serialize)]
struct Reply {
    status: u16,
    body: String,
}

/// Status, content type and body: read in full while holding one of the few connections.
async fn request(http: &reqwest::Client, method: &str, path: &str, body: Option<String>) -> Result<(u16, Option<String>, Vec<u8>), String> {
    // The path is appended to the host: without the leading slash it could rewrite the host.
    if !path.starts_with('/') {
        return Err("percorso non valido".into());
    }
    let l = lockfile().ok_or("Il client di League non è avviato.")?;
    let method = reqwest::Method::from_bytes(method.as_bytes()).map_err(|e| e.to_string())?;
    let mut rq = http
        .request(method, format!("https://127.0.0.1:{}{}", l.port, path))
        .header("Authorization", l.auth);
    if let Some(b) = body {
        rq = rq.header("Content-Type", "application/json").body(b);
    }
    let _permit = GATE.acquire().await.map_err(|e| e.to_string())?;
    let r = rq.send().await.map_err(|e| e.to_string())?;
    let kind = r.headers().get("content-type").and_then(|v| v.to_str().ok()).map(str::to_owned);
    Ok((r.status().as_u16(), kind, r.bytes().await.map_err(|e| e.to_string())?.to_vec()))
}

#[tauri::command]
async fn lcu(http: tauri::State<'_, reqwest::Client>, method: String, path: String, body: Option<String>) -> Result<Reply, String> {
    let (status, _, body) = request(&http, &method, &path, body).await?;
    Ok(Reply { status, body: String::from_utf8_lossy(&body).into_owned() })
}

/// `lcu://` serves images straight from the client (splash art, profile icons). GET only.
async fn image(http: reqwest::Client, path: String) -> Response<Vec<u8>> {
    let (status, kind, bytes) = match request(&http, "GET", &path, None).await {
        Ok((status, Some(kind), bytes)) => (status, kind, bytes),
        _ => (502, "text/plain".into(), Vec::new()),
    };
    Response::builder()
        .status(status)
        .header("content-type", kind)
        .body(bytes)
        .expect("response")
}

type Socket = tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

async fn connect(l: &Lcu) -> Option<Socket> {
    let mut rq = format!("wss://127.0.0.1:{}/", l.port).into_client_request().ok()?;
    rq.headers_mut().insert("Authorization", l.auth.parse().ok()?);
    let tls = tls_connector(RIOT_ROOT)?;
    let (ws, _) = connect_async_tls_with_config(rq, None, false, Some(Connector::NativeTls(tls))).await.ok()?;
    Some(ws)
}

/// Keeps one event subscription open for as long as the app runs, reconnecting when the
/// client restarts. The UI hears everything on the `lcu` event.
async fn relay_events(app: tauri::AppHandle) {
    loop {
        if let Some(mut ws) = match lockfile() {
            Some(l) => connect(&l).await,
            None => None,
        } {
            let _ = ws.send(Message::Text(r#"[5,"OnJsonApiEvent"]"#.into())).await;
            let _ = app.emit("lcu", json!({ "uri": "/bridge", "data": "connected" }));
            while let Some(Ok(msg)) = ws.next().await {
                let Message::Text(text) = msg else { continue };
                if let Ok(frame) = serde_json::from_str::<Value>(text.as_str()) {
                    if let Some(event) = frame.get(2) {
                        let _ = app.emit("lcu", event);
                    }
                }
            }
            let _ = app.emit("lcu", json!({ "uri": "/bridge", "data": "disconnected" }));
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(http_client())
        .invoke_handler(tauri::generate_handler![lcu])
        .register_asynchronous_uri_scheme_protocol("lcu", |ctx, rq, responder| {
            let http = ctx.app_handle().state::<reqwest::Client>().inner().clone();
            let path = rq.uri().path_and_query().map(|p| p.as_str().to_owned()).unwrap_or_default();
            tauri::async_runtime::spawn(async move { responder.respond(image(http, path).await) });
        })
        .setup(|app| {
            tauri::async_runtime::spawn(relay_events(app.handle().clone()));
            TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("app icon").clone())
                .tooltip("LoL client")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the app");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lockfile_is_parsed_and_garbage_is_refused() {
        let l = parse_lockfile("LeagueClient:1234:58305:s3cret:https\n").unwrap();
        assert_eq!(l.port, "58305");
        assert_eq!(l.auth, format!("Basic {}", STANDARD.encode("riot:s3cret")));
        assert!(parse_lockfile("").is_none());
        assert!(parse_lockfile("LeagueClient:1234:notaport:pw:https").is_none());
    }

    #[test]
    fn a_path_cannot_redirect_the_request_to_another_host() {
        let err = tauri::async_runtime::block_on(request(&http_client(), "GET", "@evil.example/", None));
        assert_eq!(err.unwrap_err(), "percorso non valido");
    }

    /// A TLS server with the test leaf (CN=127.0.0.1, no SAN) that answers 204 to anything.
    fn tls_server() -> u16 {
        use std::io::{Read, Write};
        let id = native_tls::Identity::from_pkcs8(include_bytes!("../tests/tls/leaf.pem"), include_bytes!("../tests/tls/leaf.key")).unwrap();
        let acceptor = native_tls::TlsAcceptor::new(id).unwrap();
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for tcp in listener.incoming().flatten() {
                // A refused handshake fails here: keep serving the next one.
                let Ok(mut s) = acceptor.accept(tcp) else { continue };
                let _ = s.read(&mut [0; 4096]);
                let _ = s.write_all(b"HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n");
            }
        });
        port
    }

    #[test]
    fn only_the_pinned_root_is_trusted() {
        let port = tls_server();
        let test_root = include_bytes!("../tests/tls/root.pem");
        let get = |root: &[u8]| tauri::async_runtime::block_on(
            http_client_with(root).get(format!("https://127.0.0.1:{port}/")).send());
        assert_eq!(get(test_root).unwrap().status(), 204);
        assert!(get(RIOT_ROOT).is_err());

        let handshake = |root: &[u8]| tls_connector(root).unwrap()
            .connect("127.0.0.1", std::net::TcpStream::connect(("127.0.0.1", port)).unwrap()).is_ok();
        assert!(handshake(test_root));
        assert!(!handshake(RIOT_ROOT));
    }

    /// Needs a running, logged-in League client: `cargo test -- --ignored`.
    #[test]
    #[ignore]
    fn talks_to_the_running_client() {
        tauri::async_runtime::block_on(async {
            let (status, _, _) = request(&http_client(), "GET", "/lol-gameflow/v1/gameflow-phase", None).await.unwrap();
            assert_eq!(status, 200);
            assert!(connect(&lockfile().unwrap()).await.is_some(), "event socket");
        });
    }
}
