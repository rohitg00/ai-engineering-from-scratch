#![allow(dead_code)]
mod learner {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use learner::*;

#[test]
fn capture_before_click() {
    let mut c = Controller::new(FixtureBackend::new(), 5).unwrap();
    assert!(c.click(1.0, 1.0, 0).is_err());
    assert_eq!(c.calls, 0);
}
#[test]
fn stale_generation_rejected() {
    let mut c = Controller::new(FixtureBackend::new(), 5).unwrap();
    c.capture().unwrap();
    assert!(c.click(1.0, 1.0, 9).is_err());
    assert_eq!(c.calls, 1);
}
#[test]
fn mutation_invalidates_frame() {
    let mut c = Controller::new(FixtureBackend::new(), 5).unwrap();
    c.capture().unwrap();
    c.click(30.0, 70.0, 0).unwrap();
    assert!(c.click(30.0, 70.0, 0).is_err());
}
#[test]
fn budget_enforced() {
    let mut c = Controller::new(FixtureBackend::new(), 1).unwrap();
    c.capture().unwrap();
    assert!(c.capture().is_err());
    assert_eq!(c.calls, 1);
}
#[test]
fn failed_backend_consumes_call() {
    let mut c = Controller::new(FixtureBackend::new(), 5).unwrap();
    assert!(c.type_text("Ada").is_err());
    assert_eq!(c.calls, 1);
}
#[test]
fn invalid_budget_rejected() {
    assert!(Controller::new(FixtureBackend::new(), 0).is_err());
}
