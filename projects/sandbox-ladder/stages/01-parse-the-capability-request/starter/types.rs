#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    Invalid(String),
    Limit,
    Conflict,
    Io(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Needs {
    pub untrusted: bool,
    pub secrets: bool,
    pub network: bool,
    pub host_kernel: bool,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Profile {
    pub name: String,
    pub filesystem: bool,
    pub network: bool,
    pub kernel: bool,
    pub cost: u32,
}
