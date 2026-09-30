#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn honest() {
    let n = needs("untrusted=false").unwrap();
    assert!(plan(&n, &profiles()[0])
        .unwrap()
        .contains("os_isolation=false"));
}
#[test]
fn shared_kernel() {
    let n = needs("network=true").unwrap();
    assert!(plan(&n, &profiles()[2])
        .unwrap()
        .contains("shared-host-kernel"));
}
#[test]
fn microvm() {
    let n = needs("host_kernel=true").unwrap();
    assert!(!plan(&n, &profiles()[3])
        .unwrap()
        .contains("shared-host-kernel"));
}
#[test]
fn insufficient() {
    let n = needs("secrets=true").unwrap();
    assert!(plan(&n, &profiles()[0]).is_err());
}
#[test]
fn verification() {
    let n = needs("untrusted=false").unwrap();
    assert!(plan(&n, &profiles()[0]).unwrap().contains("escape-tests"));
}
