#![allow(dead_code)]
mod learner {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use learner::*;

#[test]
fn successful_event() {
    let mut s = Session::new(std::path::Path::new("."), 3).unwrap();
    let e = s.handle("help");
    assert_eq!(e.kind, "ok");
    assert_eq!(e.seq, 1);
}
#[test]
fn rejection_consumes_budget() {
    let mut s = Session::new(std::path::Path::new("."), 1).unwrap();
    assert_eq!(s.handle("exec bad").kind, "rejected");
    assert!(s.handle("help").terminal);
}
#[test]
fn quit_closes() {
    let mut s = Session::new(std::path::Path::new("."), 3).unwrap();
    assert!(s.handle("quit").terminal);
    assert!(s.closed);
}
#[test]
fn no_actions_after_quit() {
    let mut s = Session::new(std::path::Path::new("."), 3).unwrap();
    s.handle("quit");
    assert_eq!(s.handle("help").output, "session already closed");
    assert_eq!(s.steps, 1);
}
#[test]
fn execution_error_separate() {
    let mut s = Session::new(std::path::Path::new("."), 3).unwrap();
    assert_eq!(s.handle("read surely-missing-file-829284").kind, "error");
}
#[test]
fn zero_budget_rejected() {
    assert!(Session::new(std::path::Path::new("."), 0).is_err());
}
