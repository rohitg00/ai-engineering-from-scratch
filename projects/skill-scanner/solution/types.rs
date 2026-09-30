#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    Invalid(String),
    Limit,
    Conflict,
    Io(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Span {
    pub line: usize,
    pub start: usize,
    pub end: usize,
    pub text: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Finding {
    pub rule: String,
    pub severity: u32,
    pub line: usize,
    pub start: usize,
    pub end: usize,
}
