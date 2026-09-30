#![allow(dead_code)]
mod learner {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use learner::*;

#[test]
fn click_arguments_are_numeric() {
    let args = click_argv(Point { x: 10, y: 20 });
    assert_eq!(&args[3..], &["10".to_string(), "20".to_string()]);
}
#[test]
fn text_is_argument_not_script() {
    let text = "\" & do shell script \"bad";
    let args = text_argv(text).unwrap();
    assert_eq!(args[3], text);
    assert!(!args[1].contains(text));
}
#[test]
fn newline_rejected() {
    assert!(text_argv("x\ny").is_err());
}
#[test]
fn png_header_parsed() {
    let mut b = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR".to_vec();
    b.extend(640u32.to_be_bytes());
    b.extend(400u32.to_be_bytes());
    assert_eq!(png_dimensions(&b).unwrap(), (640, 400));
}
#[test]
fn invalid_png_rejected() {
    assert!(png_dimensions(b"fake screenshot").is_err());
}
#[test]
fn zero_dimension_rejected() {
    let mut b = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR".to_vec();
    b.extend(0u32.to_be_bytes());
    b.extend(400u32.to_be_bytes());
    assert!(png_dimensions(&b).is_err());
}
