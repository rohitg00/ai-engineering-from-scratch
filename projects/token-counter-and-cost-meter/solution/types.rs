#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    Invalid(String),
    Limit,
    Conflict,
    Io(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Usage {
    pub input: u64,
    pub output: u64,
    pub cached: u64,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rates {
    pub input: u64,
    pub output: u64,
    pub cached: u64,
}
