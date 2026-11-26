use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct CommandError {
    pub code: String,
    pub detail: Option<String>,
}

impl CommandError {
    pub fn new(code: &str) -> Self {
        Self {
            code: code.to_string(),
            detail: None,
        }
    }

    pub fn with_detail(code: &str, detail: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            detail: Some(detail.into()),
        }
    }

    pub fn io(detail: impl Into<String>) -> Self {
        Self::with_detail("io", detail)
    }
}

impl From<std::io::Error> for CommandError {
    fn from(error: std::io::Error) -> Self {
        CommandError::io(error.to_string())
    }
}

impl From<serde_json::Error> for CommandError {
    fn from(error: serde_json::Error) -> Self {
        CommandError::with_detail("invalid_response", error.to_string())
    }
}
