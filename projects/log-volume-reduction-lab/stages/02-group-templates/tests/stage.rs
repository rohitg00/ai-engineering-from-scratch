#[allow(dead_code, unused_imports, unused_variables)]
mod m {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}

#[test]
fn counts() {
    let g = m::group(&m::parse_logs("INFO\tjob 1\nINFO\tjob 2").unwrap());
    assert_eq!(g[0].count, 2);
}
#[test]
fn separate_levels() {
    assert_eq!(
        m::group(&m::parse_logs("INFO\tx 1\nERROR\tx 2").unwrap()).len(),
        2
    );
}
#[test]
fn locators() {
    let g = m::group(&m::parse_logs("INFO\tjob 1\nERROR\toops\nINFO\tjob 2").unwrap());
    let x = g.iter().find(|x| x.level == "INFO").unwrap();
    assert_eq!((x.first, x.last), (1, 3));
}
#[test]
fn representative() {
    assert_eq!(
        m::group(&m::parse_logs("INFO\tjob 91\nINFO\tjob 18").unwrap())[0].example,
        "job 91"
    );
}
#[test]
fn empty() {
    assert!(m::group(&[]).is_empty());
}
