#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn append() {
    let mut l = vec![];
    let c = call("1|reader|read|a", 100).unwrap();
    audit(&mut l, &c, &Decision::Allow, 2).unwrap();
    assert_eq!(l[0], "1	reader	read	Allow");
}
#[test]
fn no_arguments() {
    let mut l = vec![];
    let c = call("1|reader|read|secret-name", 100).unwrap();
    audit(&mut l, &c, &Decision::Allow, 2).unwrap();
    assert!(!l[0].contains("secret-name"));
}
#[test]
fn duplicate() {
    let mut l = vec![];
    let c = call("1|reader|read|a", 100).unwrap();
    audit(&mut l, &c, &Decision::Allow, 2).unwrap();
    assert_eq!(audit(&mut l, &c, &Decision::Allow, 2), Err(Error::Conflict));
}
#[test]
fn cap() {
    let mut l = vec![];
    let c = call("1|reader|read|a", 100).unwrap();
    assert_eq!(audit(&mut l, &c, &Decision::Allow, 0), Err(Error::Limit));
    assert!(l.is_empty());
}
#[test]
fn deny_logged() {
    let mut l = vec![];
    let c = call("1|reader|shell|id", 100).unwrap();
    audit(&mut l, &c, &decide(&c), 2).unwrap();
    assert!(l[0].ends_with("Deny"));
}
