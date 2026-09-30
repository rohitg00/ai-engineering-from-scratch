#![allow(dead_code)]
mod learner {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use learner::*;

#[test]
fn help_parsed() {
    assert_eq!(parse_action("help").unwrap(), Action::Help);
}
#[test]
fn read_preserves_spaces() {
    assert_eq!(
        parse_action("read my notes.md").unwrap(),
        Action::Read("my notes.md".into())
    );
}
#[test]
fn search_uses_tab() {
    assert_eq!(
        parse_action("search memory search\tnotes.md").unwrap(),
        Action::Search {
            pattern: "memory search".into(),
            path: "notes.md".into()
        }
    );
}
#[test]
fn arbitrary_shell_rejected() {
    assert!(parse_action("exec rm -rf /").is_err());
}
#[test]
fn malformed_search_rejected() {
    assert!(parse_action("search no-tab").is_err());
}
#[test]
fn oversized_command_rejected() {
    assert!(parse_action(&"x".repeat(4097)).is_err());
}
