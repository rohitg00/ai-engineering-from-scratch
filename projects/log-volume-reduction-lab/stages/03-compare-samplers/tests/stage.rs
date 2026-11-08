#[allow(dead_code, unused_imports, unused_variables)]
mod m {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}

fn records() -> Vec<m::Record> {
    m::parse_logs("INFO\tjob 1\nINFO\tjob 2\nERROR\theldout failure\nINFO\tjob 3\nINFO\tjob 4")
        .unwrap()
}
#[test]
fn rare_first() {
    assert_eq!(m::sample(&records(), 1, "rarity").unwrap()[0].line, 3);
}
#[test]
fn uniform_positions() {
    let x = m::sample(&records(), 2, "uniform").unwrap();
    assert_eq!(x.iter().map(|r| r.line).collect::<Vec<_>>(), vec![1, 3]);
}
#[test]
fn zero() {
    assert!(m::sample(&records(), 0, "rarity").unwrap().is_empty());
}
#[test]
fn capped() {
    let x = m::sample(&records(), 50, "rarity").unwrap();
    let unique: std::collections::BTreeSet<_> = x.iter().map(|r| r.line).collect();
    assert_eq!(unique.len(), 5);
}
#[test]
fn bad_policy() {
    assert!(m::sample(&records(), 2, "random").is_err());
}
#[test]
fn empty() {
    assert!(m::sample(&[], 2, "uniform").unwrap().is_empty());
}
