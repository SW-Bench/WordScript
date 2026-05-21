mod contracts;
mod runtime;

use std::sync::Mutex;

use tauri::{AppHandle, State};

pub use contracts::{CompleteCaptureRequest, SliceResult, SliceStatus, StartCaptureRequest};
pub use runtime::V1SliceState;
use runtime::runtime_contract_for_app;

#[tauri::command]
pub fn v1_slice_status(app: AppHandle, state: State<'_, Mutex<V1SliceState>>) -> Result<SliceStatus, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    Ok(state.status_with_runtime(runtime_contract_for_app(&app)))
}

#[tauri::command]
pub fn start_v1_slice_capture(
    request: StartCaptureRequest,
    app: AppHandle,
    state: State<'_, Mutex<V1SliceState>>,
) -> Result<SliceStatus, String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.start_capture_with_runtime(request, runtime_contract_for_app(&app))
}

#[tauri::command]
pub fn complete_v1_slice_capture(
    request: CompleteCaptureRequest,
    app: AppHandle,
    state: State<'_, Mutex<V1SliceState>>,
) -> Result<SliceResult, String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.complete_capture_with_runtime(request, runtime_contract_for_app(&app))
}

#[tauri::command]
pub fn reset_v1_slice(app: AppHandle, state: State<'_, Mutex<V1SliceState>>) -> Result<SliceStatus, String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    Ok(state.reset_with_runtime(runtime_contract_for_app(&app)))
}
