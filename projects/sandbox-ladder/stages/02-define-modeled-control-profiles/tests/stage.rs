#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn four() {
    assert_eq!(profiles().len(), 4);
}
#[test]
fn trusted() {
    let n = needs("untrusted=false").unwrap();
    assert!(satisfies(&n, &profiles()[0]));
}
#[test]
fn filesystem() {
    let n = needs("secrets=true").unwrap();
    assert!(!satisfies(&n, &profiles()[0]));
    assert!(satisfies(&n, &profiles()[1]));
}
#[test]
fn network() {
    let n = needs("network=true").unwrap();
    assert!(!satisfies(&n, &profiles()[1]));
    assert!(satisfies(&n, &profiles()[2]));
}
#[test]
fn kernel() {
    let n = needs("host_kernel=true").unwrap();
    assert!(!satisfies(&n, &profiles()[2]));
    assert!(satisfies(&n, &profiles()[3]));
}
