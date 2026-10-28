//! Freevobe-skalet.
//!
//! Skalet gör tre saker: startar den lokala agent-backenden (som sidecar, eller med `node`
//! under utveckling), väntar tills den svarar, och injicerar adress + token i webbvyn så att
//! gränssnittet kan prata med agenten på 127.0.0.1. Ingen trafik går någon annanstans.
//!
//! Beroenden hålls medvetet små: ingen HTTP-klient behövs eftersom kontrollen av agenten görs
//! med en enkel TCP-förfrågan mot loopback.

use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::ShellExt;

/// Standardporten för agenten. Måste matcha AGENT_SERVER_PORT i @vibeforge/protocol.
const DEFAULT_AGENT_PORT: u16 = 4319;

#[derive(Default)]
pub struct AgentProcess {
    child: Option<Child>,
    pid: Option<u32>,
    url: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct AgentStatus {
    pub url: String,
    pub running: bool,
    pub pid: Option<u32>,
    pub token_present: bool,
    pub home: String,
    pub note: String,
}

fn vibeforge_home() -> PathBuf {
    if let Ok(explicit) = std::env::var("VIBEFORGE_HOME") {
        if !explicit.trim().is_empty() {
            return PathBuf::from(explicit);
        }
    }
    let base = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(base).join(".vibeforge")
}

/// Token skrivs av agenten själv (mode 0600) och läses bara för att skickas vidare till webbvyn.
fn read_token() -> Option<String> {
    let file = vibeforge_home().join("token");
    std::fs::read_to_string(file)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn agent_port() -> u16 {
    std::env::var("VIBEFORGE_PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(DEFAULT_AGENT_PORT)
}

fn agent_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}")
}

/// Namnet på sidobinären i paketet. Tauri paketerar `bundle.externalBin` bredvid appens egen
/// binär och utan mål-trippel i namnet.
fn sidecar_file_name() -> String {
    const AGENT_BINARY: &str = "vibeforge-agent";
    if cfg!(windows) {
        format!("{AGENT_BINARY}.exe")
    } else {
        AGENT_BINARY.to_string()
    }
}

/// Letar upp den paketerade agent-binären: bredvid appens egen binär (där Tauri lägger
/// externalBin), i resurskatalogen, eller via VIBEFORGE_AGENT_BIN.
fn find_agent_binary(app: &tauri::AppHandle) -> Option<PathBuf> {
    if let Ok(explicit) = std::env::var("VIBEFORGE_AGENT_BIN") {
        if !explicit.trim().is_empty() {
            return Some(PathBuf::from(explicit));
        }
    }

    let file_name = sidecar_file_name();
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(current) = std::env::current_exe() {
        if let Some(dir) = current.parent() {
            candidates.push(dir.join(&file_name));
        }
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join(&file_name));
        candidates.push(resource_dir.join("binaries").join(&file_name));
    }

    candidates.into_iter().find(|candidate| candidate.exists())
}

/// De inbyggda skillsen paketeras som resurs; en SEA-binär kan inte bära med sig markdown-filerna.
fn find_builtin_skills(app: &tauri::AppHandle) -> Option<PathBuf> {
    if let Ok(explicit) = std::env::var("VIBEFORGE_BUILTIN_SKILLS") {
        if !explicit.trim().is_empty() {
            return Some(PathBuf::from(explicit));
        }
    }

    let candidate = app.path().resource_dir().ok()?.join("builtin-skills");
    if candidate.is_dir() {
        Some(candidate)
    } else {
        None
    }
}

/// Letar upp agentens startpunkt i källkoden: används i utvecklingsläge, när ingen binär finns.
fn find_agent_entry(app: &tauri::AppHandle) -> Option<PathBuf> {
    if let Ok(explicit) = std::env::var("VIBEFORGE_AGENT_ENTRY") {
        if !explicit.trim().is_empty() {
            return Some(PathBuf::from(explicit));
        }
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("agent").join("index.js"));
        candidates.push(resource_dir.join("binaries").join("vibeforge-agent.js"));
    }
    // Utvecklingsläge: src-tauri ligger i apps/desktop/src-tauri.
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(
            cwd.join("..")
                .join("..")
                .join("packages")
                .join("agent-server")
                .join("dist")
                .join("index.js"),
        );
        candidates.push(
            cwd.join("..")
                .join("..")
                .join("packages")
                .join("agent-server")
                .join("src")
                .join("index.ts"),
        );
    }

    candidates.into_iter().find(|candidate| candidate.exists())
}

fn spawn_agent(app: &tauri::AppHandle) -> Result<(Child, String), String> {
    let port = agent_port();
    let url = agent_url(port);
    let mut command = if let Some(binary) = find_agent_binary(app) {
        Command::new(binary)
    } else if let Some(entry) = find_agent_entry(app) {
        let mut command = Command::new("node");
        if entry.extension().map(|value| value == "ts").unwrap_or(false) {
            command.arg("--experimental-strip-types");
        }
        command.arg(entry);
        command
    } else {
        return Err(
            "Hittade ingen agent-server att starta. Bygg binären (npm run sidecar:build) eller starta agenten med npm run dev:server."
                .to_string(),
        );
    };

    command
        .env("VIBEFORGE_PORT", port.to_string())
        .env("VIBEFORGE_HOST", "127.0.0.1")
        .env("VIBEFORGE_HOME", vibeforge_home());

    // I ett paketerat bygge ligger de inbyggda skillsen i appens resurskatalog.
    if let Some(skills) = find_builtin_skills(app) {
        command.env("VIBEFORGE_BUILTIN_SKILLS", skills);
    }

    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
        .spawn()
        .map(|child| (child, url))
        .map_err(|error| format!("Kunde inte starta agenten: {error}"))
}

/// En enkel HTTP-kontroll mot loopback. Returnerar true när /api/health svarar 200.
fn health_ok(port: u16) -> bool {
    let address = format!("127.0.0.1:{port}");
    let Ok(mut stream) = TcpStream::connect_timeout(
        &address.parse().expect("loopback-adress"),
        Duration::from_millis(800),
    ) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(800)));
    let request = "GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut buffer = String::new();
    let _ = stream.read_to_string(&mut buffer);
    buffer.starts_with("HTTP/1.1 200") || buffer.starts_with("HTTP/1.0 200")
}

/// Pollar tills agenten svarar. Vi pollar hellre än gissar.
fn wait_for_agent(port: u16, timeout: Duration) -> bool {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if health_ok(port) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    false
}

/// Injicerar adress och token i webbvyn innan appen använder den.
fn inject_bootstrap(app: &tauri::AppHandle, url: &str, token: Option<&str>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let script = match token {
        Some(token) => format!(
            "window.__VIBEFORGE_BOOTSTRAP__ = {{ baseUrl: '{}', token: '{}' }};",
            url,
            token.replace('\'', "")
        ),
        None => format!("window.__VIBEFORGE_BOOTSTRAP__ = {{ baseUrl: '{}' }};", url),
    };
    let _ = window.eval(&script);
}

fn status_snapshot(state: &Mutex<AgentProcess>) -> AgentStatus {
    let guard = state.lock().unwrap();
    AgentStatus {
        url: guard.url.clone().unwrap_or_else(|| agent_url(agent_port())),
        running: guard.child.is_some(),
        pid: guard.pid,
        token_present: read_token().is_some(),
        home: vibeforge_home().display().to_string(),
        note: "Agenten lyssnar bara på 127.0.0.1 och kräver token i x-vibeforge-token.".to_string(),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Mutex::new(AgentProcess::default()))
        .invoke_handler(tauri::generate_handler![
            agent_status,
            start_agent,
            stop_agent,
            agent_home
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Starta agenten i en egen tråd så att fönstret ritas direkt.
            std::thread::spawn(move || {
                let port = agent_port();
                let url = agent_url(port);

                {
                    let state = handle.state::<Mutex<AgentProcess>>();
                    let mut guard = match state.lock() {
                        Ok(guard) => guard,
                        Err(_) => return,
                    };
                    match spawn_agent(&handle) {
                        Ok((child, url)) => {
                            guard.pid = Some(child.id());
                            guard.url = Some(url);
                            guard.child = Some(child);
                        }
                        Err(error) => {
                            eprintln!("Freevobe: {error}");
                            drop(guard);
                            inject_bootstrap(&handle, &url, None);
                            return;
                        }
                    }
                }

                if !wait_for_agent(port, Duration::from_secs(30)) {
                    eprintln!("Freevobe: agenten svarade inte inom 30 sekunder på {url}.");
                }
                let token = read_token();
                inject_bootstrap(&handle, &url, token.as_deref());
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Freevobe kunde inte starta")
        .run(|app, event| {
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                // Städa upp agentprocessen när appen stängs.
                if let Some(state) = app.try_state::<Mutex<AgentProcess>>() {
                    if let Ok(mut guard) = state.lock() {
                        if let Some(child) = guard.child.as_mut() {
                            let _ = child.kill();
                        }
                        guard.child = None;
                        guard.pid = None;
                    }
                }
            }
        });
}

#[tauri::command]
fn agent_status(state: tauri::State<'_, Mutex<AgentProcess>>) -> AgentStatus {
    status_snapshot(state.inner())
}

#[tauri::command]
async fn start_agent(app: tauri::AppHandle) -> Result<AgentStatus, String> {
    let port = agent_port();
    let url = agent_url(port);

    {
        let state = app.state::<Mutex<AgentProcess>>();
        let mut guard = state.lock().map_err(|error| error.to_string())?;
        if guard.child.is_none() {
            let (child, url) = spawn_agent(&app)?;
            guard.pid = Some(child.id());
            guard.url = Some(url);
            guard.child = Some(child);
        }
    }

    let ready = tauri::async_runtime::spawn_blocking(move || wait_for_agent(port, Duration::from_secs(30)))
        .await
        .map_err(|error| error.to_string())?;
    if !ready {
        return Err(format!("Agenten startade men svarade inte på {url} inom 30 sekunder."));
    }

    let token = read_token();
    inject_bootstrap(&app, &url, token.as_deref());
    Ok(status_snapshot(app.state::<Mutex<AgentProcess>>().inner()))
}

#[tauri::command]
fn stop_agent(state: tauri::State<'_, Mutex<AgentProcess>>) -> Result<(), String> {
    let mut guard = state.lock().map_err(|error| error.to_string())?;
    if let Some(child) = guard.child.as_mut() {
        child.kill().map_err(|error| error.to_string())?;
    }
    guard.child = None;
    guard.pid = None;
    Ok(())
}

#[tauri::command]
fn agent_home() -> String {
    vibeforge_home().display().to_string()
}

/// Öppnar hjälpsidor i systemets webbläsare (används av "Öppna hjälp"-knapparna).
#[allow(dead_code)]
fn open_help(app: &tauri::AppHandle, url: &str) -> Result<(), String> {
    app.shell().open(url, None).map_err(|error| error.to_string())
}
