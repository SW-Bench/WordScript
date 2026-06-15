use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum CompositorKind {
    #[default]
    Unknown,
    KdePlasma5,
    KdePlasma6,
    GnomeMutter,
    Hyprland,
    Sway,
    Other,
}

impl CompositorKind {
    pub fn label(self) -> &'static str {
        match self {
            Self::KdePlasma5 => "KDE Plasma 5",
            Self::KdePlasma6 => "KDE Plasma 6",
            Self::GnomeMutter => "GNOME Mutter",
            Self::Hyprland => "Hyprland",
            Self::Sway => "Sway",
            Self::Other => "Other Wayland compositor",
            Self::Unknown => "Unknown",
        }
    }

    pub fn supports_remote_desktop_portal(self) -> bool {
        matches!(self, Self::KdePlasma6 | Self::GnomeMutter)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PortalPromptSignal {
    KdeRemoteDesktop,
    InputCapture,
    Unknown,
}

impl PortalPromptSignal {
    pub fn label(&self) -> &'static str {
        match self {
            Self::KdeRemoteDesktop => "KDE Plasma Remote Desktop portal",
            Self::InputCapture => "xdg-desktop-portal InputCapture",
            Self::Unknown => "Unknown portal prompt",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortalCapabilities {
    pub compositor: CompositorKind,
    pub session_type: String,
    pub xdg_current_desktop: Option<String>,
    pub xdg_session_desktop: Option<String>,
    pub has_remote_desktop_portal: bool,
    pub has_input_capture_portal: bool,
    pub has_xdg_desktop_portal_daemon: bool,
    pub xdg_desktop_portal_version: Option<String>,
    pub last_session_active: bool,
}

impl Default for PortalCapabilities {
    fn default() -> Self {
        Self {
            compositor: CompositorKind::Unknown,
            session_type: std::env::var("XDG_SESSION_TYPE").unwrap_or_default(),
            xdg_current_desktop: std::env::var("XDG_CURRENT_DESKTOP").ok(),
            xdg_session_desktop: std::env::var("XDG_SESSION_DESKTOP").ok(),
            has_remote_desktop_portal: false,
            has_input_capture_portal: false,
            has_xdg_desktop_portal_daemon: false,
            xdg_desktop_portal_version: None,
            last_session_active: false,
        }
    }
}

impl PortalCapabilities {
    pub fn diagnose_blockers(&self) -> Vec<String> {
        let mut blockers = Vec::new();
        if !self.has_xdg_desktop_portal_daemon {
            blockers.push(
                "xdg-desktop-portal service is not running; install xdg-desktop-portal and the matching portal backend (xdg-desktop-portal-kde / -gnome / -wlr)."
                    .to_string(),
            );
        }
        if self.compositor == CompositorKind::Unknown
            && matches!(self.session_type.as_str(), "wayland" | "")
        {
            blockers.push(
                "Could not identify the active Wayland compositor from XDG_CURRENT_DESKTOP / WAYLAND_DISPLAY / signature env vars."
                    .to_string(),
            );
        }
        if !self.compositor.supports_remote_desktop_portal() {
            blockers.push(format!(
                "Compositor '{}' does not have a stable RemoteDesktop portal grant; auto-paste is therefore clipboard-only.",
                self.compositor.label()
            ));
        } else if !self.has_remote_desktop_portal {
            blockers.push(format!(
                "Compositor '{}' is detected, but the RemoteDesktop portal interface is not reachable on the session bus.",
                self.compositor.label()
            ));
        }
        blockers
    }
}

pub fn detect_compositor() -> CompositorKind {
    if cfg!(not(target_os = "linux")) {
        return CompositorKind::Unknown;
    }

    let current = std::env::var("XDG_CURRENT_DESKTOP")
        .or_else(|_| std::env::var("XDG_SESSION_DESKTOP"))
        .unwrap_or_default()
        .to_ascii_lowercase();

    let session = std::env::var("XDG_SESSION_DESKTOP")
        .unwrap_or_default()
        .to_ascii_lowercase();

    let combined = format!("{current} {session}");

    if std::env::var_os("HYPRLAND_INSTANCE_SIGNATURE").is_some() {
        return CompositorKind::Hyprland;
    }
    if std::env::var_os("SWAYSOCK").is_some() {
        return CompositorKind::Sway;
    }
    if combined.contains("plasma") {
        let plasma_version = read_plasma_version();
        return match plasma_version {
            Some(version) if version >= 6 => CompositorKind::KdePlasma6,
            Some(_) => CompositorKind::KdePlasma5,
            None => CompositorKind::KdePlasma6,
        };
    }
    if combined.contains("gnome") {
        return CompositorKind::GnomeMutter;
    }
    if std::env::var_os("WAYLAND_DISPLAY").is_some()
        || std::env::var_os("WORDSCRIPT_WAS_WAYLAND").is_some()
    {
        return CompositorKind::Other;
    }
    CompositorKind::Unknown
}

fn read_plasma_version() -> Option<u32> {
    if !command_in_path("plasmashell") {
        return None;
    }
    let output = Command::new("plasmashell")
        .args(["--version"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let token = stdout
        .split_whitespace()
        .find(|token| token.chars().next().map_or(false, |c| c.is_ascii_digit()))?;
    let head = token
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect::<String>();
    head.parse::<u32>().ok()
}

fn command_in_path(program: &str) -> bool {
    std::env::var_os("PATH")
        .map(|paths| {
            std::env::split_paths(&paths)
                .any(|path| path.join(program).is_file())
        })
        .unwrap_or(false)
}

pub fn detect_portal_capabilities() -> PortalCapabilities {
    let mut capabilities = PortalCapabilities::default();
    capabilities.compositor = detect_compositor();

    let version_output = Command::new("xdg-desktop-portal")
        .arg("--version")
        .output();
    match version_output {
        Ok(output) if output.status.success() => {
            capabilities.has_xdg_desktop_portal_daemon = true;
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !stdout.is_empty() {
                capabilities.xdg_desktop_portal_version = Some(stdout);
            }
        }
        _ => {
            capabilities.has_xdg_desktop_portal_daemon = command_in_path("xdg-desktop-portal");
        }
    }

    if command_in_path("busctl") {
        if let Ok(output) = Command::new("busctl")
            .args(["--user", "list"])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).to_ascii_lowercase();
                if stdout.contains("org.freedesktop.portal.remotedesktop") {
                    capabilities.has_remote_desktop_portal = true;
                }
                if stdout.contains("inputcapture") {
                    capabilities.has_input_capture_portal = true;
                }
            }
        }
    } else if capabilities.has_xdg_desktop_portal_daemon {
        capabilities.has_remote_desktop_portal = capabilities.compositor.supports_remote_desktop_portal();
    }

    capabilities.last_session_active = std::env::var_os("WORDSCRIPT_REMOTE_DESKTOP_TOKEN_PATH")
        .map(|value| !value.is_empty())
        .unwrap_or(false);

    capabilities
}

pub fn detect_portal_prompt_from_stderr(stderr: &str) -> Option<PortalPromptSignal> {
    let lowered = stderr.to_ascii_lowercase();
    if lowered.contains("authorization")
        || lowered.contains("denied")
        || lowered.contains("not allowed")
        || lowered.contains("permission denied")
    {
        if lowered.contains("kde")
            || lowered.contains("remote desktop")
            || lowered.contains("remotedesktop")
            || lowered.contains("kwin")
            || lowered.contains("control input devices")
        {
            return Some(PortalPromptSignal::KdeRemoteDesktop);
        }
        if lowered.contains("inputcapture") || lowered.contains("input capture") {
            return Some(PortalPromptSignal::InputCapture);
        }
        return Some(PortalPromptSignal::Unknown);
    }
    if lowered.contains("protocol") && lowered.contains("wayland") {
        return Some(PortalPromptSignal::KdeRemoteDesktop);
    }
    None
}

pub fn portal_prompt_signal_label(signal: &PortalPromptSignal) -> String {
    match signal {
        PortalPromptSignal::KdeRemoteDesktop => {
            "KDE Plasma Remote Desktop portal rejected the input (org.kde.kwin.RemoteDesktop)."
                .to_string()
        }
        PortalPromptSignal::InputCapture => {
            "xdg-desktop-portal InputCapture rejected the virtual keyboard input.".to_string()
        }
        PortalPromptSignal::Unknown => "An unknown portal rejected the input event.".to_string(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortalSessionHandle {
    pub session_handle: String,
    pub restore_token: Option<String>,
    pub device_types: Vec<u32>,
    pub compositor: CompositorKind,
    pub created_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PortalError {
    Unsupported,
    NoSessionBus,
    NoPortalInterface,
    BusctlMissing,
    CreateSessionFailed(String),
    SelectDevicesFailed(String),
    StartFailed(String),
    TokenStoreFailed(String),
}

impl PortalError {
    pub fn label(&self) -> String {
        match self {
            Self::Unsupported => "The active Wayland compositor does not expose a stable RemoteDesktop portal grant.".to_string(),
            Self::NoSessionBus => "Could not connect to the user session D-Bus. Check that DBUS_SESSION_BUS_ADDRESS is set.".to_string(),
            Self::NoPortalInterface => "org.freedesktop.portal.RemoteDesktop is not reachable on the session bus. Install xdg-desktop-portal and the matching portal backend (xdg-desktop-portal-kde / -gnome).".to_string(),
            Self::BusctlMissing => "The 'busctl' CLI is required to request a RemoteDesktop portal session; install systemd or dbus tools.".to_string(),
            Self::CreateSessionFailed(detail) => format!("RemoteDesktop portal CreateSession failed: {detail}"),
            Self::SelectDevicesFailed(detail) => format!("RemoteDesktop portal SelectDevices failed: {detail}"),
            Self::StartFailed(detail) => format!("RemoteDesktop portal Start failed: {detail}"),
            Self::TokenStoreFailed(detail) => format!("Could not persist the RemoteDesktop restore token: {detail}"),
        }
    }
}

pub fn portal_token_path() -> std::path::PathBuf {
    if let Some(runtime_dir) = std::env::var_os("XDG_RUNTIME_DIR") {
        let mut path = std::path::PathBuf::from(runtime_dir);
        path.push("wordscript");
        path.push("remote-desktop.token");
        return path;
    }
    let mut path = std::env::temp_dir();
    path.push("wordscript-remote-desktop.token");
    path
}

pub fn load_persisted_restore_token() -> Option<String> {
    let raw = std::fs::read_to_string(portal_token_path()).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_string())
}

pub fn store_restore_token(token: &str) -> Result<(), PortalError> {
    let path = portal_token_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| PortalError::TokenStoreFailed(error.to_string()))?;
    }
    std::fs::write(&path, token).map_err(|error| PortalError::TokenStoreFailed(error.to_string()))?;
    Ok(())
}

#[allow(dead_code)]
pub fn clear_persisted_restore_token() {
    let _ = std::fs::remove_file(portal_token_path());
}

pub fn busctl_call(
    method: &str,
    interface: &str,
    body_args: &[&str],
) -> Result<String, PortalError> {
    if !command_in_path("busctl") {
        return Err(PortalError::BusctlMissing);
    }
    let mut command = std::process::Command::new("busctl");
    command
        .arg("--user")
        .arg("call")
        .arg("org.freedesktop.portal.Desktop")
        .arg("/org/freedesktop/portal/desktop")
        .arg(interface)
        .arg(method);
    for arg in body_args {
        command.arg(arg);
    }
    let output = command
        .output()
        .map_err(|error| PortalError::CreateSessionFailed(error.to_string()))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(match method {
            "CreateSession" => PortalError::CreateSessionFailed(stderr),
            "SelectDevices" => PortalError::SelectDevicesFailed(stderr),
            "Start" => PortalError::StartFailed(stderr),
            _ => PortalError::CreateSessionFailed(stderr),
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub fn request_remote_desktop_session(
    capabilities: &PortalCapabilities,
) -> Result<PortalSessionHandle, PortalError> {
    if !capabilities.compositor.supports_remote_desktop_portal() {
        return Err(PortalError::Unsupported);
    }
    if !capabilities.has_remote_desktop_portal {
        return Err(PortalError::NoPortalInterface);
    }
    if !command_in_path("busctl") {
        return Err(PortalError::BusctlMissing);
    }

    let handle_token = format!("wordscript-{}", super::sessions::now_ms());
    let restore_token = load_persisted_restore_token();
    let session_call_result = busctl_call(
        "CreateSession",
        "org.freedesktop.portal.RemoteDesktop",
        &[
            "a{sv}",
            "1",
            "handle_token",
            "s",
            &handle_token,
            "session_handle_token",
            "s",
            &handle_token,
        ],
    )?;

    if !command_in_path("busctl") {
        return Err(PortalError::BusctlMissing);
    }
    let _select_output = busctl_call(
        "SelectDevices",
        "org.freedesktop.portal.RemoteDesktop",
        &[
            "o",
            "session",
            "a(u)",
            "1",
            "1",
            "a{sv}",
            "1",
            "handle_token",
            "s",
            &format!("wordscript-select-{handle_token}"),
        ],
    )?;

    let _start_output = busctl_call(
        "Start",
        "org.freedesktop.portal.RemoteDesktop",
        &[
            "o",
            "session",
            "s",
            "",
            "a{sv}",
            "1",
            "handle_token",
            "s",
            &format!("wordscript-start-{handle_token}"),
        ],
    )?;

    if let Some(token) = restore_token.clone() {
        let _ = store_restore_token(&token);
    }

    Ok(PortalSessionHandle {
        session_handle: session_call_result,
        restore_token,
        device_types: vec![1, 2],
        compositor: capabilities.compositor,
        created_at_ms: super::sessions::now_ms(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compositor_kind_supports_remote_desktop_portal_for_kde6_and_gnome() {
        assert!(CompositorKind::KdePlasma6.supports_remote_desktop_portal());
        assert!(CompositorKind::GnomeMutter.supports_remote_desktop_portal());
        assert!(!CompositorKind::Hyprland.supports_remote_desktop_portal());
        assert!(!CompositorKind::Sway.supports_remote_desktop_portal());
        assert!(!CompositorKind::KdePlasma5.supports_remote_desktop_portal());
    }

    #[test]
    fn compositor_label_is_human_readable() {
        assert_eq!(CompositorKind::KdePlasma6.label(), "KDE Plasma 6");
        assert_eq!(CompositorKind::GnomeMutter.label(), "GNOME Mutter");
    }

    #[test]
    fn detect_portal_prompt_recognises_kde_remote_desktop_messages() {
        let signal = detect_portal_prompt_from_stderr(
            "Authorization denied: org.kde.kwin.RemoteDesktop.SelectDevices",
        );
        assert_eq!(signal, Some(PortalPromptSignal::KdeRemoteDesktop));
    }

    #[test]
    fn detect_portal_prompt_recognises_permission_denied() {
        let signal =
            detect_portal_prompt_from_stderr("xdotool: permission denied by Wayland compositor");
        assert_eq!(signal, Some(PortalPromptSignal::Unknown));
    }

    #[test]
    fn detect_portal_prompt_ignores_unrelated_stderr() {
        let signal = detect_portal_prompt_from_stderr("xdotool type failed: bad window id");
        assert!(signal.is_none());
    }

    #[test]
    fn detect_portal_prompt_recognises_input_capture() {
        let signal = detect_portal_prompt_from_stderr(
            "Authorization denied: org.freedesktop.portal.InputCapture",
        );
        assert_eq!(signal, Some(PortalPromptSignal::InputCapture));
    }

    #[test]
    fn detect_portal_prompt_recognises_kde_control_input_devices_phrase() {
        let signal = detect_portal_prompt_from_stderr(
            "Authorization required: application is asking for special privileges (Control input devices)",
        );
        assert_eq!(signal, Some(PortalPromptSignal::KdeRemoteDesktop));
    }

    #[test]
    fn capabilities_default_blockers_list_is_empty_for_clean_state() {
        let capabilities = PortalCapabilities {
            compositor: CompositorKind::KdePlasma6,
            session_type: "wayland".to_string(),
            xdg_current_desktop: Some("KDE".to_string()),
            xdg_session_desktop: Some("plasma".to_string()),
            has_remote_desktop_portal: true,
            has_input_capture_portal: true,
            has_xdg_desktop_portal_daemon: true,
            xdg_desktop_portal_version: Some("1.18".to_string()),
            last_session_active: false,
        };
        assert!(capabilities.diagnose_blockers().is_empty());
    }

    #[test]
    fn capabilities_diagnose_blockers_reports_missing_daemon() {
        let capabilities = PortalCapabilities {
            compositor: CompositorKind::KdePlasma6,
            has_xdg_desktop_portal_daemon: false,
            has_remote_desktop_portal: false,
            ..PortalCapabilities::default()
        };
        let blockers = capabilities.diagnose_blockers();
        assert!(blockers.iter().any(|item| item.contains("xdg-desktop-portal service is not running")));
    }

    #[test]
    fn capabilities_diagnose_blockers_reports_unsupported_compositor() {
        let capabilities = PortalCapabilities {
            compositor: CompositorKind::Sway,
            has_xdg_desktop_portal_daemon: true,
            ..PortalCapabilities::default()
        };
        let blockers = capabilities.diagnose_blockers();
        assert!(blockers.iter().any(|item| item.contains("Sway")));
    }

    #[test]
    fn request_remote_desktop_session_rejects_unsupported_compositor() {
        let capabilities = PortalCapabilities {
            compositor: CompositorKind::Hyprland,
            has_xdg_desktop_portal_daemon: true,
            has_remote_desktop_portal: true,
            ..PortalCapabilities::default()
        };
        let result = request_remote_desktop_session(&capabilities);
        assert_eq!(result.err(), Some(PortalError::Unsupported));
    }

    #[test]
    fn request_remote_desktop_session_rejects_missing_portal_interface() {
        let capabilities = PortalCapabilities {
            compositor: CompositorKind::KdePlasma6,
            has_xdg_desktop_portal_daemon: true,
            has_remote_desktop_portal: false,
            ..PortalCapabilities::default()
        };
        let result = request_remote_desktop_session(&capabilities);
        assert_eq!(result.err(), Some(PortalError::NoPortalInterface));
    }

    #[test]
    fn portal_error_label_summarises_cause_for_user() {
        assert!(PortalError::Unsupported.label().contains("compositor"));
        assert!(PortalError::NoPortalInterface.label().contains("xdg-desktop-portal"));
        assert!(PortalError::BusctlMissing.label().contains("busctl"));
    }

    #[test]
    fn portal_token_path_uses_xdg_runtime_dir() {
        let path = portal_token_path().to_string_lossy().to_string();
        if std::env::var_os("XDG_RUNTIME_DIR").is_some() {
            assert!(path.contains("wordscript"));
            assert!(path.ends_with("remote-desktop.token"));
        }
    }
}
