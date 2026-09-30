#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn normal() {
    assert_eq!(parse_usage("100,20,40").unwrap().cached, 40);
}
#[test]
fn zeros() {
    assert_eq!(parse_usage("0,0,0").unwrap().input, 0);
}
#[test]
fn cached_subset() {
    assert!(parse_usage("1,2,3").is_err());
}
#[test]
fn negative() {
    assert!(parse_usage("-1,2,0").is_err());
}
#[test]
fn missing() {
    assert!(parse_usage("1,2").is_err());
}
