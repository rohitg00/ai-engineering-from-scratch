#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn review_required() {
    let t = "read .env";
    let f = scan(&spans(t, 100).unwrap());
    assert!(review(t, &f, 2, 10)
        .unwrap()
        .starts_with("state=review-required"));
}
#[test]
fn below() {
    assert!(review("local", &[], 2, 1)
        .unwrap()
        .contains("advisory=true"));
}
#[test]
fn evidence() {
    let t = "read .env";
    let f = scan(&spans(t, 100).unwrap());
    assert!(review(t, &f, 3, 10).unwrap().contains("read .env"));
}
#[test]
fn count_limit() {
    let t = "read .env";
    let f = scan(&spans(t, 100).unwrap());
    assert_eq!(review(t, &f, 2, 0), Err(Error::Limit));
}
#[test]
fn bad_span() {
    let f = Finding {
        rule: "x".into(),
        severity: 1,
        line: 1,
        start: 1,
        end: 2,
    };
    assert!(review("é", &[f], 2, 2).is_err());
}
