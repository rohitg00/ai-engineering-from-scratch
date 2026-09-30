#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn empty() {
    assert_eq!(estimate("", 4), Ok(0));
}
#[test]
fn round_up() {
    assert_eq!(estimate("hello", 4), Ok(2));
}
#[test]
fn exact() {
    assert_eq!(estimate("abcd", 4), Ok(1));
}
#[test]
fn unicode() {
    assert_eq!(estimate("é🙂", 1), Ok(2));
}
#[test]
fn zero_ratio() {
    assert!(estimate("a", 0).is_err());
}
