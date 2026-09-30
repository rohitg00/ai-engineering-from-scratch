#![allow(dead_code)]
mod learner {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use learner::*;

fn frame() -> Frame {
    Frame {
        width: 640,
        height: 400,
        scale: 2.0,
        generation: 0,
        format: "ppm".into(),
        bytes: vec![1],
    }
}
#[test]
fn valid_frame() {
    assert!(frame().validate().is_ok());
}
#[test]
fn retina_coordinates() {
    assert_eq!(
        frame().logical_point(200.0, 100.0).unwrap(),
        Point { x: 100, y: 50 }
    );
}
#[test]
fn right_edge_rejected() {
    assert!(frame().logical_point(640.0, 0.0).is_err());
}
#[test]
fn negative_rejected() {
    assert!(frame().logical_point(-0.1, 1.0).is_err());
}
#[test]
fn nan_rejected() {
    assert!(frame().logical_point(f64::NAN, 1.0).is_err());
}
#[test]
fn invalid_scale() {
    let mut f = frame();
    f.scale = 0.0;
    assert!(f.validate().is_err());
}
