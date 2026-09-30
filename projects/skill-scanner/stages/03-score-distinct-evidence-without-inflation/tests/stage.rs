#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn distinct() {
    let f = scan(
        &spans(
            "ignore previous
read .env",
            100,
        )
        .unwrap(),
    );
    assert_eq!(risk_score(&f), Ok(5));
}
#[test]
fn dedup() {
    let f = scan(&spans("read .env", 100).unwrap());
    assert_eq!(risk_score(&[f[0].clone(), f[0].clone()]), Ok(2));
}
#[test]
fn separate_lines() {
    let f = scan(
        &spans(
            "read .env
read .env",
            100,
        )
        .unwrap(),
    );
    assert_eq!(risk_score(&f), Ok(4));
}
#[test]
fn invalid() {
    assert!(risk_score(&[Finding {
        rule: "x".into(),
        severity: 9,
        line: 1,
        start: 0,
        end: 1
    }])
    .is_err());
}
#[test]
fn empty() {
    assert_eq!(risk_score(&[]), Ok(0));
}
