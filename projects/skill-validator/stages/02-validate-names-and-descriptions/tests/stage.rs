#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn valid() {
    let f = parse(
        "---
name: code-review
description: Check code
---
Run",
    )
    .unwrap();
    assert_eq!(validate(&f, "code-review").unwrap().body, "Run");
}
#[test]
fn name_mismatch() {
    let f = parse(
        "---
name: a
description: b
---",
    )
    .unwrap();
    assert_eq!(validate(&f, "other"), Err(Error::Conflict));
}
#[test]
fn uppercase() {
    let f = parse(
        "---
name: A
description: b
---",
    )
    .unwrap();
    assert!(validate(&f, "A").is_err());
}
#[test]
fn missing_description() {
    let f = parse(
        "---
name: a
---",
    )
    .unwrap();
    assert!(validate(&f, "a").is_err());
}
#[test]
fn double_hyphen() {
    let f = parse(
        "---
name: a--b
description: b
---",
    )
    .unwrap();
    assert!(validate(&f, "a--b").is_err());
}
