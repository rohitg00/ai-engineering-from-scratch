#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn metadata_only() {
    let s = Skill {
        name: "a".into(),
        description: "b".into(),
        body: "secret body".into(),
    };
    assert_eq!(disclose(&s, false, 4).unwrap(), "a: b");
}
#[test]
fn activation() {
    let s = Skill {
        name: "a".into(),
        description: "b".into(),
        body: "run".into(),
    };
    assert_eq!(
        disclose(&s, true, 9).unwrap(),
        "a: b

run"
    );
}
#[test]
fn no_truncation() {
    let s = Skill {
        name: "a".into(),
        description: "b".into(),
        body: "run".into(),
    };
    assert_eq!(disclose(&s, true, 8), Err(Error::Limit));
}
#[test]
fn unicode_characters() {
    let s = Skill {
        name: "a".into(),
        description: "é".into(),
        body: "".into(),
    };
    assert!(disclose(&s, false, 4).is_ok());
}
#[test]
fn zero_budget() {
    let s = Skill {
        name: "a".into(),
        description: "b".into(),
        body: "".into(),
    };
    assert_eq!(disclose(&s, false, 0), Err(Error::Limit));
}
