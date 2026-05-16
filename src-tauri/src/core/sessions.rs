use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NativeSessionStage {
    Idle,
    Capturing,
    Processing,
    Completed,
    Aborted,
    Error,
}

impl Default for NativeSessionStage {
    fn default() -> Self {
        Self::Idle
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeSessionStatus {
    pub stage: NativeSessionStage,
    pub active_session_id: Option<String>,
    pub active_trigger: Option<String>,
    pub started_at_ms: Option<u64>,
    pub completed_at_ms: Option<u64>,
    pub last_transcript: Option<String>,
    pub last_error: Option<String>,
    pub capture_owner: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeSessionEvent {
    pub event: String,
    pub status: NativeSessionStatus,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StartNativeSessionRequest {
    pub trigger: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CompleteNativeSessionRequest {
    pub text: String,
    pub corrected: Option<bool>,
}

#[derive(Debug, Clone)]
struct ActiveSession {
    id: String,
    trigger: String,
    started_at_ms: u64,
}

#[derive(Debug, Default)]
pub struct NativeSessionState {
    counter: u64,
    stage: NativeSessionStage,
    active_session: Option<ActiveSession>,
    completed_at_ms: Option<u64>,
    last_transcript: Option<String>,
    last_error: Option<String>,
}

impl NativeSessionState {
    pub fn status(&self) -> NativeSessionStatus {
        NativeSessionStatus {
            stage: self.stage.clone(),
            active_session_id: self
                .active_session
                .as_ref()
                .map(|session| session.id.clone()),
            active_trigger: self
                .active_session
                .as_ref()
                .map(|session| session.trigger.clone()),
            started_at_ms: self
                .active_session
                .as_ref()
                .map(|session| session.started_at_ms),
            completed_at_ms: self.completed_at_ms,
            last_transcript: self.last_transcript.clone(),
            last_error: self.last_error.clone(),
            capture_owner: "native_core_capture".to_string(),
        }
    }

    pub fn processing_session_id(&self) -> Option<String> {
        if !matches!(self.stage, NativeSessionStage::Processing) {
            return None;
        }

        self.active_session
            .as_ref()
            .map(|session| session.id.clone())
    }

    pub fn is_processing_session_current(&self, session_id: &str) -> bool {
        matches!(self.stage, NativeSessionStage::Processing)
            && self
                .active_session
                .as_ref()
                .map(|session| session.id == session_id)
                .unwrap_or(false)
    }

    pub fn start_capture(
        &mut self,
        trigger: impl Into<String>,
    ) -> Result<NativeSessionStatus, String> {
        if matches!(
            self.stage,
            NativeSessionStage::Capturing | NativeSessionStage::Processing
        ) {
            return Err("A native capture session is already active.".to_string());
        }

        let trigger = trigger.into().trim().to_string();
        if trigger.is_empty() {
            return Err("Trigger must not be empty.".to_string());
        }

        self.counter += 1;
        self.stage = NativeSessionStage::Capturing;
        self.completed_at_ms = None;
        self.last_error = None;
        self.active_session = Some(ActiveSession {
            id: format!("native-{}", self.counter),
            trigger,
            started_at_ms: now_ms(),
        });

        Ok(self.status())
    }

    pub fn stop_for_processing(&mut self) -> Result<NativeSessionStatus, String> {
        if self.active_session.is_none() || !matches!(self.stage, NativeSessionStage::Capturing) {
            return Err("No native capture session is currently recording.".to_string());
        }

        self.stage = NativeSessionStage::Processing;
        self.last_error = None;
        Ok(self.status())
    }

    pub fn enter_processing(
        &mut self,
        recovery_trigger: impl Into<String>,
        capture_is_recording: bool,
    ) -> Result<NativeSessionStatus, String> {
        match self.stop_for_processing() {
            Ok(status) => Ok(status),
            Err(_) if capture_is_recording => {
                Ok(self.force_processing_for_active_capture(recovery_trigger))
            }
            Err(error) => Err(error),
        }
    }

    pub fn force_processing_for_active_capture(
        &mut self,
        trigger: impl Into<String>,
    ) -> NativeSessionStatus {
        if self.active_session.is_none() {
            self.counter += 1;
            self.active_session = Some(ActiveSession {
                id: format!("native-{}", self.counter),
                trigger: trigger.into().trim().to_string(),
                started_at_ms: now_ms(),
            });
        }

        self.stage = NativeSessionStage::Processing;
        self.last_error = None;
        self.status()
    }

    pub fn complete_transcription(&mut self, text: impl Into<String>) -> NativeSessionStatus {
        self.stage = NativeSessionStage::Completed;
        self.active_session = None;
        self.completed_at_ms = Some(now_ms());
        self.last_error = None;
        self.last_transcript = Some(text.into());
        self.status()
    }

    pub fn complete_current_transcription(
        &mut self,
        text: impl Into<String>,
    ) -> Result<NativeSessionStatus, String> {
        let Some(session_id) = self.processing_session_id() else {
            return Err("No native session is waiting for transcription completion.".to_string());
        };

        self.complete_processing_session(&session_id, text)
            .ok_or_else(|| "No native session is waiting for transcription completion.".to_string())
    }

    pub fn complete_processing_session(
        &mut self,
        session_id: &str,
        text: impl Into<String>,
    ) -> Option<NativeSessionStatus> {
        if !self.is_processing_session_current(session_id) {
            return None;
        }

        Some(self.complete_transcription(text))
    }

    pub fn abort(&mut self, reason: impl Into<String>) -> NativeSessionStatus {
        self.stage = NativeSessionStage::Aborted;
        self.active_session = None;
        self.completed_at_ms = Some(now_ms());
        self.last_error = Some(reason.into());
        self.status()
    }

    pub fn empty_processing_session(
        &mut self,
        session_id: &str,
        reason: impl Into<String>,
    ) -> Option<NativeSessionStatus> {
        if !self.is_processing_session_current(session_id) {
            return None;
        }

        Some(self.abort(reason))
    }

    pub fn fail(&mut self, message: impl Into<String>) -> NativeSessionStatus {
        self.stage = NativeSessionStage::Error;
        self.active_session = None;
        self.completed_at_ms = Some(now_ms());
        self.last_error = Some(message.into());
        self.status()
    }

    pub fn fail_processing_session(
        &mut self,
        session_id: &str,
        message: impl Into<String>,
    ) -> Option<NativeSessionStatus> {
        if !self.is_processing_session_current(session_id) {
            return None;
        }

        Some(self.fail(message))
    }
}

#[tauri::command]
pub fn native_session_status(
    state: State<'_, Mutex<NativeSessionState>>,
) -> Result<NativeSessionStatus, String> {
    let state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.status())
}

#[tauri::command]
pub fn start_native_session(
    app: AppHandle,
    request: StartNativeSessionRequest,
    _state: State<'_, Mutex<NativeSessionState>>,
) -> Result<NativeSessionStatus, String> {
    start_from_native(&app, &request.trigger)
}

#[tauri::command]
pub fn stop_native_session(
    app: AppHandle,
    _state: State<'_, Mutex<NativeSessionState>>,
) -> Result<NativeSessionStatus, String> {
    processing_from_native(&app)
}

#[tauri::command]
pub fn abort_native_session(
    app: AppHandle,
    _state: State<'_, Mutex<NativeSessionState>>,
) -> Result<NativeSessionStatus, String> {
    abort_from_native(&app, "Capture aborted by native trigger.")
}

#[tauri::command]
pub fn complete_native_session(
    app: AppHandle,
    request: CompleteNativeSessionRequest,
    state: State<'_, Mutex<NativeSessionState>>,
) -> Result<NativeSessionStatus, String> {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let status = state.complete_current_transcription(request.text)?;
    emit_session_event(
        &app,
        if request.corrected.unwrap_or(false) {
            "transcription_corrected"
        } else {
            "transcription"
        },
        &status,
    );
    Ok(status)
}

pub fn complete_processing_session_from_transcription<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &str,
    text: &str,
    corrected: bool,
) -> Result<bool, String> {
    let state = app
        .try_state::<Mutex<NativeSessionState>>()
        .ok_or_else(|| "Native session state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let Some(status) = state.complete_processing_session(session_id, text.to_string()) else {
        return Ok(false);
    };

    emit_session_event(
        app,
        if corrected {
            "transcription_corrected"
        } else {
            "transcription"
        },
        &status,
    );
    Ok(true)
}

pub fn start_from_native<R: Runtime>(
    app: &AppHandle<R>,
    trigger: &str,
) -> Result<NativeSessionStatus, String> {
    let state = app
        .try_state::<Mutex<NativeSessionState>>()
        .ok_or_else(|| "Native session state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let status = state.start_capture(trigger)?;
    emit_session_event(app, "recording_started", &status);
    Ok(status)
}

pub fn fail_from_native_error<R: Runtime>(app: &AppHandle<R>, message: &str) {
    if let Some(state) = app.try_state::<Mutex<NativeSessionState>>() {
        if let Ok(mut state) = state.lock() {
            let status = state.fail(message.to_string());
            emit_session_event(app, "error", &status);
        }
    }
}

pub fn fail_processing_session_from_native_error<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &str,
    message: &str,
) -> Result<bool, String> {
    let state = app
        .try_state::<Mutex<NativeSessionState>>()
        .ok_or_else(|| "Native session state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let Some(status) = state.fail_processing_session(session_id, message.to_string()) else {
        return Ok(false);
    };
    emit_session_event(app, "error", &status);
    Ok(true)
}

pub fn processing_from_native<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<NativeSessionStatus, String> {
    processing_or_recover_from_native(app, false, "native_capture_recovery")
}

pub fn processing_or_recover_from_native<R: Runtime>(
    app: &AppHandle<R>,
    capture_is_recording: bool,
    recovery_trigger: &str,
) -> Result<NativeSessionStatus, String> {
    let state = app
        .try_state::<Mutex<NativeSessionState>>()
        .ok_or_else(|| "Native session state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let status = state.enter_processing(recovery_trigger, capture_is_recording)?;
    emit_session_event(app, "recording_stopped", &status);
    emit_session_event(app, "processing", &status);
    Ok(status)
}

pub fn abort_from_native<R: Runtime>(
    app: &AppHandle<R>,
    reason: &str,
) -> Result<NativeSessionStatus, String> {
    let state = app
        .try_state::<Mutex<NativeSessionState>>()
        .ok_or_else(|| "Native session state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let status = state.abort(reason.to_string());
    emit_session_event(app, "aborted", &status);
    emit_session_event(app, "empty", &status);
    Ok(status)
}

pub fn empty_processing_session_from_native<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &str,
    message: &str,
) -> Result<bool, String> {
    let state = app
        .try_state::<Mutex<NativeSessionState>>()
        .ok_or_else(|| "Native session state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let Some(status) = state.empty_processing_session(session_id, message.to_string()) else {
        return Ok(false);
    };
    emit_session_event(app, "empty", &status);
    Ok(true)
}

pub fn current_processing_session_id<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    let state = app.try_state::<Mutex<NativeSessionState>>()?;
    let state = state.lock().ok()?;
    state.processing_session_id()
}

pub fn is_processing_session_current<R: Runtime>(app: &AppHandle<R>, session_id: &str) -> bool {
    let Some(state) = app.try_state::<Mutex<NativeSessionState>>() else {
        return false;
    };
    state
        .lock()
        .map(|state| state.is_processing_session_current(session_id))
        .unwrap_or(false)
}

pub fn emit_session_event<R: Runtime>(
    app: &AppHandle<R>,
    event: &str,
    status: &NativeSessionStatus,
) {
    let _ = app.emit(
        "wordscript-native-event",
        NativeSessionEvent {
            event: event.to_string(),
            status: status.clone(),
        },
    );
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_capture_to_completed_session() {
        let mut state = NativeSessionState::default();
        let started = state.start_capture("hotkey").unwrap();
        assert_eq!(started.stage, NativeSessionStage::Capturing);

        let processing = state.stop_for_processing().unwrap();
        assert_eq!(processing.stage, NativeSessionStage::Processing);

        let completed = state.complete_transcription("Hello world.");
        assert_eq!(completed.stage, NativeSessionStage::Completed);
        assert_eq!(completed.last_transcript.as_deref(), Some("Hello world."));
        assert!(completed.active_session_id.is_none());
    }

    #[test]
    fn guarded_completion_requires_matching_processing_session() {
        let mut state = NativeSessionState::default();
        let started = state.start_capture("hotkey").unwrap();
        let session_id = started.active_session_id.unwrap();

        assert!(state
            .complete_processing_session(&session_id, "too early")
            .is_none());

        state.stop_for_processing().unwrap();
        let completed = state
            .complete_processing_session(&session_id, "Hello world.")
            .unwrap();

        assert_eq!(completed.stage, NativeSessionStage::Completed);
        assert_eq!(completed.last_transcript.as_deref(), Some("Hello world."));
        assert!(state
            .complete_processing_session(&session_id, "second result")
            .is_none());
    }

    #[test]
    fn stale_processing_completion_does_not_overwrite_new_session() {
        let mut state = NativeSessionState::default();
        let first = state.start_capture("first_hotkey").unwrap();
        let first_session_id = first.active_session_id.unwrap();
        state.stop_for_processing().unwrap();
        state.abort("user cancelled");

        let second = state.start_capture("second_hotkey").unwrap();
        let second_session_id = second.active_session_id.clone().unwrap();

        assert!(state
            .complete_processing_session(&first_session_id, "old transcript")
            .is_none());

        let status = state.status();
        assert_eq!(status.stage, NativeSessionStage::Capturing);
        assert_eq!(
            status.active_session_id.as_deref(),
            Some(second_session_id.as_str())
        );
        assert_eq!(status.active_trigger.as_deref(), Some("second_hotkey"));
        assert!(status.last_transcript.is_none());
    }

    #[test]
    fn stale_processing_failure_does_not_overwrite_completed_session() {
        let mut state = NativeSessionState::default();
        let started = state.start_capture("hotkey").unwrap();
        let session_id = started.active_session_id.unwrap();
        state.stop_for_processing().unwrap();
        state
            .complete_processing_session(&session_id, "fresh transcript")
            .unwrap();

        assert!(state
            .fail_processing_session(&session_id, "late provider error")
            .is_none());

        let status = state.status();
        assert_eq!(status.stage, NativeSessionStage::Completed);
        assert_eq!(status.last_transcript.as_deref(), Some("fresh transcript"));
        assert!(status.last_error.is_none());
    }

    #[test]
    fn force_processing_recovers_when_capture_state_is_authoritative() {
        let mut state = NativeSessionState::default();

        let recovered = state.force_processing_for_active_capture("native_capture_recovery");

        assert_eq!(recovered.stage, NativeSessionStage::Processing);
        assert_eq!(
            recovered.active_trigger.as_deref(),
            Some("native_capture_recovery")
        );
        assert!(recovered.active_session_id.is_some());
    }

    #[test]
    fn enter_processing_recovers_when_capture_state_is_authoritative() {
        let mut state = NativeSessionState::default();

        let recovered = state
            .enter_processing("native_capture_recovery", true)
            .unwrap();

        assert_eq!(recovered.stage, NativeSessionStage::Processing);
        assert_eq!(
            recovered.active_trigger.as_deref(),
            Some("native_capture_recovery")
        );
        assert!(recovered.active_session_id.is_some());
    }

    #[test]
    fn abort_clears_active_session_and_keeps_reason() {
        let mut state = NativeSessionState::default();

        state.start_capture("hotkey").unwrap();
        let aborted = state.abort("user cancelled");

        assert_eq!(aborted.stage, NativeSessionStage::Aborted);
        assert_eq!(aborted.last_error.as_deref(), Some("user cancelled"));
        assert!(aborted.active_session_id.is_none());
    }

    #[test]
    fn enter_processing_without_capture_or_recovery_errors() {
        let mut state = NativeSessionState::default();

        let error = state
            .enter_processing("native_capture_recovery", false)
            .unwrap_err();

        assert_eq!(error, "No native capture session is currently recording.");
    }
}
