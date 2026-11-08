#[allow(dead_code, unused_imports, unused_variables)]
mod m {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}

#[test]
fn valid() {
    let r = m::parse_logs("INFO\tjob 12 ready\n").unwrap();
    assert_eq!(r[0].line, 1);
    assert_eq!(r[0].template, "job # ready");
}
#[test]
fn unicode() {
    assert_eq!(m::parse_logs("INFO\t雪 12").unwrap()[0].message, "雪 12");
}
#[test]
fn bad_level() {
    assert!(m::parse_logs("FATAL\toops").is_err());
}
#[test]
fn blank() {
    assert!(m::parse_logs("WARN\t ").is_err());
}
#[test]
fn bounds() {
    assert!(m::parse_logs(&format!("INFO\t{}", "a".repeat(4096))).is_err());
}
#[test]
fn heldout() {
    let r = m::parse_logs("DEBUG\tid=92-4 result=ok\nERROR\tquota exceeded").unwrap();
    assert_eq!(r[0].template, "id=#-# result=ok");
    assert_eq!(r[1].line, 2);
}
