#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn normal() {
    let mut s = 10;
    assert_eq!(reserve(&mut s, 5, 20), Ok(5));
    assert_eq!(s, 15);
}
#[test]
fn boundary() {
    let mut s = 10;
    assert_eq!(reserve(&mut s, 10, 20), Ok(0));
}
#[test]
fn reject_atomic() {
    let mut s = 10;
    assert_eq!(reserve(&mut s, 11, 20), Err(Error::Limit));
    assert_eq!(s, 10);
}
#[test]
fn overflow_atomic() {
    let mut s = u64::MAX;
    assert!(reserve(&mut s, 1, u64::MAX).is_err());
    assert_eq!(s, u64::MAX);
}
#[test]
fn zero() {
    let mut s = 0;
    assert_eq!(reserve(&mut s, 0, 0), Ok(0));
}
