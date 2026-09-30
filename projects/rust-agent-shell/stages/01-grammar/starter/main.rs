#[derive(Debug, Clone, PartialEq)]
pub enum Action {
    Help,
    Pwd,
    List(String),
    Read(String),
    Search { pattern: String, path: String },
    Quit,
}
pub fn parse_action(_line: &str) -> Result<Action, String> {
    Err("Not implemented: parse action".into())
}
fn main() {
    panic!("Not implemented: agent action loop");
}
