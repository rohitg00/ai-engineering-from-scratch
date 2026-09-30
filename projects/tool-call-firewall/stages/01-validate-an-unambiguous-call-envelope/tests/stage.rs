#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn valid() {
    assert_eq!(call("c1|reader|read|notes.md", 100).unwrap().tool, "read");
}
#[test]
fn empty_id() {
    assert!(call("|reader|read|notes.md", 100).is_err());
}
#[test]
fn extra_field() {
    assert!(call("c1|reader|read|a|b", 100).is_err());
}
#[test]
fn control() {
    assert!(call(
        "c1|reader|read|a
b",
        100
    )
    .is_err());
}
#[test]
fn limit() {
    assert_eq!(call("c1|reader|read|notes.md", 3), Err(Error::Limit));
}
