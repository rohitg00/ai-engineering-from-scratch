#![allow(dead_code)]
mod learner {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use learner::*;

use std::io::Cursor;
#[test]
fn newline_and_quotes_escaped() {
    assert_eq!(json_string("a\n\"b"), "\"a\\n\\\"b\"");
}
#[test]
fn crlf_supported() {
    assert_eq!(
        read_bounded(&mut Cursor::new(b"help\r\n")).unwrap(),
        Some("help".into())
    );
}
#[test]
fn eof_line_processed() {
    assert_eq!(
        read_bounded(&mut Cursor::new(b"help")).unwrap(),
        Some("help".into())
    );
}
#[test]
fn bounded_reader_rejects_long_input() {
    assert!(read_bounded(&mut Cursor::new(vec![b'x'; 5000])).is_err());
}
#[test]
fn real_loop_emits_until_quit() {
    let mut s = Session::new(std::path::Path::new("."), 10).unwrap();
    let mut out = Vec::new();
    let count = run_loop(
        &mut s,
        &mut Cursor::new(b"help\nquit\nread ignored\n"),
        &mut out,
    )
    .unwrap();
    assert_eq!(count, 2);
    let text = String::from_utf8(out).unwrap();
    assert_eq!(text.lines().count(), 2);
    assert!(text.contains("\"terminal\":true"));
}
#[test]
fn invalid_utf8_rejected() {
    assert!(read_bounded(&mut Cursor::new(vec![255, b'\n'])).is_err());
}
