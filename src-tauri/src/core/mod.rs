pub mod agent;
pub mod capture;
pub mod config;
pub mod history;
pub mod insertion;
pub mod mode_router;
pub mod paths;
pub mod prompt_enhance;
pub mod providers;
pub mod runtime_log;
pub mod sessions;
pub mod sound;
pub mod text_rules;
pub mod transcription_hints;
pub mod transform;
pub mod trigger;
pub mod updates;
pub mod workspace_context;

#[cfg(test)]
mod e2e_tests;
