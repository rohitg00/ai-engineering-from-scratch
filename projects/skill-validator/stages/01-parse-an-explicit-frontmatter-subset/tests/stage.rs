#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn preserves_colon() {
    let m = parse(
        "---
name: review
description: Check: every line
---
Body",
    )
    .unwrap();
    assert_eq!(m["description"], "Check: every line");
}
#[test]
fn rejects_missing_header() {
    assert!(parse("name: review").is_err());
}
#[test]
fn rejects_duplicate() {
    assert_eq!(
        parse(
            "---
name: a
name: b
---"
        ),
        Err(Error::Conflict)
    );
}
#[test]
fn rejects_alias() {
    assert!(parse(
        "---
name: *value
---"
    )
    .is_err());
}
#[test]
fn keeps_body() {
    assert_eq!(
        parse(
            "---
name: a
---
# Run
hello"
        )
        .unwrap()["$body"],
        "# Run
hello"
    );
}
