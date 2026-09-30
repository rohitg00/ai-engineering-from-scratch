#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    Invalid(String),
    Limit,
    Conflict,
    Io(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub body: String,
}
