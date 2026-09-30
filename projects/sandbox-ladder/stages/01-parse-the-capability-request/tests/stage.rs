#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn defaults() {
    assert!(!needs("untrusted=true").unwrap().secrets);
}
#[test]
fn network() {
    assert!(needs("network=true").unwrap().network);
}
#[test]
fn unknown() {
    assert!(needs("root=true").is_err());
}
#[test]
fn ambiguous() {
    assert!(needs("network=yes").is_err());
}
#[test]
fn duplicate() {
    assert_eq!(needs("network=true,network=false"), Err(Error::Conflict));
}
