#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn offsets() {
    let x = spans(
        "one
two", 20,
    )
    .unwrap();
    assert_eq!((x[1].start, x[1].end), (4, 7));
}
#[test]
fn unicode() {
    let t = "é
🙂";
    let x = spans(t, 20).unwrap();
    assert_eq!(&t[x[1].start..x[1].end], "🙂");
}
#[test]
fn crlf() {
    let x = spans("a\r\nb", 10).unwrap();
    assert_eq!(x[0].text, "a");
    assert_eq!(x[1].start, 3);
}
#[test]
fn empty() {
    assert!(spans("", 0).unwrap().is_empty());
}
#[test]
fn size_cap() {
    assert_eq!(spans("abcd", 3), Err(Error::Limit));
}
