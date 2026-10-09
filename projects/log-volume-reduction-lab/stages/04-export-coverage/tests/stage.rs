#[allow(dead_code, unused_imports, unused_variables)]
mod m {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}

#[test]
fn json_escape() {
    assert_eq!(m::quote("a\"b\\雪"), "\"a\\\"b\\\\雪\"");
}
#[test]
fn full_counts() {
    let r = m::parse_logs("INFO\tx 1\nINFO\tx 2").unwrap();
    let s = m::sample(&r, 1, "rarity").unwrap();
    let out = m::compact(&r, &s);
    assert!(out.contains("\"count\":2"));
    assert_eq!(out.lines().count(), 1);
}
#[test]
fn no_sample() {
    let r = m::parse_logs("ERROR\toops").unwrap();
    assert_eq!(m::compact(&r, &[]), "");
}
#[test]
fn locators() {
    let r = m::parse_logs("INFO\tx 1\nERROR\toops\nINFO\tx 2").unwrap();
    let out = m::compact(&r, &r);
    assert!(out.contains("\"firstLine\":1,\"lastLine\":3"));
}
#[test]
fn stable() {
    let r = m::parse_logs("INFO\tx 1\nERROR\toops").unwrap();
    assert_eq!(m::compact(&r, &r), m::compact(&r, &r));
}
