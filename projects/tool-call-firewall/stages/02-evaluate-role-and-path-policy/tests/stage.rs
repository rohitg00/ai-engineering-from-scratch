#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn read() {
    assert_eq!(
        decide(&call("1|reader|read|a.txt", 100).unwrap()),
        Decision::Allow
    );
}
#[test]
fn write_reader() {
    assert_eq!(
        decide(&call("1|reader|write|a.txt", 100).unwrap()),
        Decision::Deny
    );
}
#[test]
fn approval() {
    assert_eq!(
        decide(&call("1|editor|write|a.txt", 100).unwrap()),
        Decision::ApprovalRequired
    );
}
#[test]
fn traversal() {
    assert_eq!(
        decide(&call("1|editor|read|docs/../key", 100).unwrap()),
        Decision::Deny
    );
}
#[test]
fn unknown() {
    assert_eq!(
        decide(&call("1|admin|shell|id", 100).unwrap()),
        Decision::Deny
    );
}
