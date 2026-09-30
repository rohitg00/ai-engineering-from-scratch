#![allow(dead_code)]
mod learner {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use learner::*;

#[test]
fn ppm_capture() {
    let f = FixtureBackend::new().capture().unwrap();
    assert!(f.bytes.starts_with(b"P6\n320 200\n255\n"));
    assert_eq!(f.bytes.len(), 15 + 320 * 200 * 3);
}
#[test]
fn typing_needs_focus() {
    assert!(FixtureBackend::new().type_text("Ada").is_err());
}
#[test]
fn click_focuses_field() {
    let mut b = FixtureBackend::new();
    b.click(Point { x: 30, y: 70 }).unwrap();
    assert!(b.focused);
}
#[test]
fn submit_requires_text() {
    let mut b = FixtureBackend::new();
    b.click(Point { x: 230, y: 160 }).unwrap();
    assert!(!b.complete);
}
#[test]
fn complete_scene() {
    let mut b = FixtureBackend::new();
    b.click(Point { x: 30, y: 70 }).unwrap();
    b.type_text("Ada").unwrap();
    b.click(Point { x: 230, y: 160 }).unwrap();
    assert!(b.complete);
    assert_eq!(b.generation, 3);
}
#[test]
fn control_characters_rejected() {
    let mut b = FixtureBackend::new();
    b.click(Point { x: 30, y: 70 }).unwrap();
    assert!(b.type_text("Ada\n").is_err());
}
