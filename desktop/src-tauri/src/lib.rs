use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, Runtime,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// ---- show / hide --------------------------------------------------------
//
// On macOS the capture window is converted into an NSPanel (see `setup_panel`)
// so it can float over fullscreen apps, so we drive show/hide through the panel
// handle rather than the plain window.

#[cfg(target_os = "macos")]
fn show_window<R: Runtime>(app: &tauri::AppHandle<R>) {
    use tauri_nspanel::ManagerExt;
    // The panel has no `center()`, but it shares the underlying NSWindow with
    // the Tauri window handle, so we center through that.
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.center();
    }
    if let Ok(panel) = app.get_webview_panel("main") {
        panel.show();
    }
}

#[cfg(target_os = "macos")]
fn toggle_window<R: Runtime>(app: &tauri::AppHandle<R>) {
    use tauri_nspanel::ManagerExt;
    if let Ok(panel) = app.get_webview_panel("main") {
        if panel.is_visible() {
            panel.order_out(None);
        } else {
            show_window(app);
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn show_window<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.center();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[cfg(not(target_os = "macos"))]
fn toggle_window<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            show_window(app);
        }
    }
}

// ---- macOS NSPanel setup ------------------------------------------------

/// Convert the capture window into a non-activating NSPanel that floats over
/// fullscreen apps (Spotlight/Raycast-style) and hides itself when it loses
/// key focus.
///
/// `alwaysOnTop` only controls z-level *within* a Space; overlaying a
/// native-fullscreen app additionally requires `FullScreenAuxiliary`, and
/// setting that on a normal window is documented to break in release builds
/// (tauri-apps/tauri#5566). An NSPanel is the supported path.
#[cfg(target_os = "macos")]
// tauri-nspanel still re-exports the (deprecated) `cocoa` crate for its public
// API; this is the library's canonical usage. (The `unexpected_cfgs` noise from
// its panel_delegate! macro is silenced crate-wide in Cargo.toml.)
#[allow(deprecated)]
fn setup_panel(app: &tauri::App) -> tauri::Result<()> {
    use tauri_nspanel::{
        cocoa::appkit::NSWindowCollectionBehavior, panel_delegate, ManagerExt, WebviewWindowExt,
    };

    let window = app.get_webview_window("main").unwrap();
    let panel = window.to_panel().unwrap();

    // Floating window level (above normal windows).
    panel.set_level(4);

    // NSWindowStyleMaskNonactivatingPanel — showing the panel must not steal
    // activation from the user's current (possibly fullscreen) app.
    panel.set_style_mask(1 << 7);

    // Join every Space and overlay native-fullscreen spaces.
    panel.set_collection_behaviour(
        NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces,
    );

    // Hide the panel when it resigns key (i.e. the user clicked elsewhere).
    let handle = app.app_handle().to_owned();
    let delegate = panel_delegate!(MyTodoPanelDelegate {
        window_did_become_key,
        window_did_resign_key
    });
    delegate.set_listener(Box::new(move |name: String| {
        if name == "window_did_resign_key" {
            if let Ok(panel) = handle.get_webview_panel("main") {
                panel.order_out(None);
            }
        }
    }));
    panel.set_delegate(delegate);

    Ok(())
}

// ---- run ----------------------------------------------------------------

pub fn run() {
    // ⌘⇧Space (Cmd on macOS / Super on Windows+Linux) + Shift + Space.
    let capture_shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space);
    let handler_shortcut = capture_shortcut.clone();

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, shortcut, event| {
                if *shortcut == handler_shortcut && event.state == ShortcutState::Pressed {
                    toggle_window(app);
                }
            })
            .build(),
    );

    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }

    builder
        .setup(move |app| {
            // Menu-bar only app on macOS (no Dock icon).
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Convert the capture window into a fullscreen-capable NSPanel.
            #[cfg(target_os = "macos")]
            setup_panel(app)?;

            app.global_shortcut().register(capture_shortcut.clone())?;

            // Tray icon + menu.
            let show_i = MenuItem::with_id(app, "show", "Capture  (⌘⇧Space)", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let mut tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                });

            // Icons may not be generated yet during early dev; only set if present.
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            // Keep running in the tray when the window is hidden/closed.
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
