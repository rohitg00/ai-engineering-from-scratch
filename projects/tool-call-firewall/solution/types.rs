#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    Invalid(String),
    Limit,
    Conflict,
    Io(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Call {
    pub id: String,
    pub role: String,
    pub tool: String,
    pub argument: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Decision {
    Allow,
    ApprovalRequired,
    Deny,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Approval {
    pub request: Call,
    pub used: bool,
}
