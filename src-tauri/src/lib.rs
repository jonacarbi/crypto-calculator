mod market;

use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use market::Snapshot;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WebviewWindow, WindowEvent};
use tauri_plugin_positioner::{Position, WindowExt};

const TRAY_ID: &str = "main";
// macOS tints a black template glyph; other trays need the full-colour logo or it vanishes on dark panels.
#[cfg(target_os = "macos")]
const TRAY_ICON: &[u8] = include_bytes!("../icons/tray.png");
#[cfg(not(target_os = "macos"))]
const TRAY_ICON: &[u8] = include_bytes!("../icons/64x64.png");
const REFRESH_EVERY: Duration = Duration::from_secs(60);
const RETRY_AFTER_ERROR: Duration = Duration::from_secs(20);
/// A tray click that lands right after the window auto-hid on blur must not re-open it.
const BLUR_DEBOUNCE: Duration = Duration::from_millis(250);

struct AppState {
    client: reqwest::Client,
    vs: Mutex<String>,
    last: Mutex<Option<Snapshot>>,
    hidden_at: Mutex<Option<Instant>>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as u64)
}

/// `error` marks the shown price as stale so the tray never silently lies.
fn update_tray(app: &AppHandle, snap: &Snapshot, error: Option<&str>) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else { return };
    let Some(price) = snap
        .coins
        .iter()
        .find(|c| c.id == "bitcoin")
        .and_then(|c| c.current_price)
    else {
        return;
    };
    let text = market::format_price(price, &snap.vs);
    let (mark, note) = error.map_or(("", String::new()), |e| (" ⚠", format!(" (stale: {e})")));
    let _ = tray.set_title(Some(format!("₿ {text}{mark}")));
    let _ = tray.set_tooltip(Some(format!("Bitcoin {text}{note}")));
}

async fn refresh_now(app: &AppHandle) -> Result<Snapshot, String> {
    let state = app.state::<AppState>();
    let vs = state.vs.lock().unwrap().clone();
    let coins = market::fetch(&state.client, &vs).await.inspect_err(|e| {
        if let Some(last) = state.last.lock().unwrap().as_ref() {
            update_tray(app, last, Some(e));
        }
        let _ = app.emit("markets-error", e);
    })?;
    // Hold the vs lock while publishing so set_currency can't interleave: a result for a
    // currency we've since left is dropped instead of overwriting the newer snapshot.
    let current = state.vs.lock().unwrap();
    if *current != vs {
        return Err("Currency changed during refresh".into());
    }
    let snap = Snapshot { vs, coins, fetched_at: now_ms() };
    update_tray(app, &snap, None);
    *state.last.lock().unwrap() = Some(snap.clone());
    let _ = app.emit("markets", &snap);
    drop(current);
    Ok(snap)
}

#[tauri::command]
fn get_snapshot(state: State<'_, AppState>) -> Option<Snapshot> {
    state.last.lock().unwrap().clone()
}

#[tauri::command]
async fn refresh(app: AppHandle) -> Result<Snapshot, String> {
    refresh_now(&app).await
}

#[tauri::command]
async fn set_currency(app: AppHandle, vs: String) -> Result<Snapshot, String> {
    let vs = vs.to_lowercase();
    if !market::is_supported(&vs) {
        return Err(format!("Unsupported currency: {vs}"));
    }
    *app.state::<AppState>().vs.lock().unwrap() = vs;
    refresh_now(&app).await
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

fn place(window: &WebviewWindow) {
    #[cfg(target_os = "windows")]
    let at = Position::TrayBottomCenter;
    #[cfg(not(target_os = "windows"))]
    let at = Position::TrayCenter;
    // Linux trays don't report a position; fall back to the top-right corner.
    if window.move_window(at).is_err() {
        let _ = window.move_window(Position::TopRight);
    }
}

fn show(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else { return };
    place(&window);
    let _ = window.show();
    let _ = window.set_focus();
}

fn toggle(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else { return };
    let just_hid = app
        .state::<AppState>()
        .hidden_at
        .lock()
        .unwrap()
        .is_some_and(|t| t.elapsed() < BLUR_DEBOUNCE);
    if window.is_visible().unwrap_or(false) || just_hid {
        let _ = window.hide();
    } else {
        show(app);
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Crypto Calculator", true, None::<&str>)?;
    let refresh = MenuItem::with_id(app, "refresh", "Refresh prices", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;
    let sep = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &refresh, &sep, &quit])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(Image::from_bytes(TRAY_ICON)?)
        .icon_as_template(cfg!(target_os = "macos"))
        .title("₿ …")
        .tooltip("Crypto Calculator")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show(app),
            "refresh" => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move { let _ = refresh_now(&app).await; });
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = reqwest::Client::builder()
        .user_agent(concat!("CryptoCalculator/", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(15))
        .build()
        .expect("HTTP client");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| show(app)))
        .plugin(tauri_plugin_positioner::init())
        .manage(AppState {
            client,
            vs: Mutex::new("usd".into()),
            last: Mutex::new(None),
            hidden_at: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![get_snapshot, refresh, set_currency, quit])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            build_tray(app.handle())?;

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    let wait = match refresh_now(&handle).await {
                        Ok(_) => REFRESH_EVERY,
                        Err(_) => RETRY_AFTER_ERROR,
                    };
                    tokio::time::sleep(wait).await;
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::Focused(false) => {
                *window.state::<AppState>().hidden_at.lock().unwrap() = Some(Instant::now());
                let _ = window.hide();
            }
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building Crypto Calculator")
        .run(|_, event| {
            // Tray app: closing the window must not quit; only an explicit exit(code) does.
            if let RunEvent::ExitRequested { api, code: None, .. } = event {
                api.prevent_exit();
            }
        });
}
