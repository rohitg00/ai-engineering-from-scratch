#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn minimal() {
    assert_eq!(
        select(&needs("untrusted=true").unwrap(), &profiles(), 10)
            .unwrap()
            .name,
        "filesystem-fixture"
    );
}
#[test]
fn kernel_budget() {
    assert_eq!(
        select(&needs("host_kernel=true").unwrap(), &profiles(), 4),
        Err(Error::Limit)
    );
}
#[test]
fn exact() {
    assert_eq!(
        select(&needs("host_kernel=true").unwrap(), &profiles(), 5)
            .unwrap()
            .cost,
        5
    );
}
#[test]
fn empty() {
    assert!(select(&needs("untrusted=false").unwrap(), &[], 9).is_err());
}
#[test]
fn tie() {
    let mut p = profiles()[0].clone();
    p.name = "aaa".into();
    assert_eq!(
        select(
            &needs("untrusted=false").unwrap(),
            &[profiles()[0].clone(), p],
            1
        )
        .unwrap()
        .name,
        "aaa"
    );
}
