mod contracts;
mod runtime;

use std::sync::Mutex;

use tauri::State;

pub use contracts::{CompleteCaptureRequest, SliceResult, SliceStatus, StartCaptureRequest};
pub use runtime::V1SliceState;

#[tauri::command]
pub fn v1_slice_status(state: State<'_, Mutex<V1SliceState>>) -> Result<SliceStatus, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    Ok(state.status())
}

#[tauri::command]
pub fn start_v1_slice_capture(
    request: StartCaptureRequest,
    state: State<'_, Mutex<V1SliceState>>,
) -> Result<SliceStatus, String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.start_capture(request)
}

#[tauri::command]
pub fn complete_v1_slice_capture(
    request: CompleteCaptureRequest,
    state: State<'_, Mutex<V1SliceState>>,
) -> Result<SliceResult, String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.complete_capture(request)
}

#[tauri::command]
pub fn reset_v1_slice(state: State<'_, Mutex<V1SliceState>>) -> Result<SliceStatus, String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    Ok(state.reset())
}
