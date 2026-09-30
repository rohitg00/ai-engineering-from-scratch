#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn installer_quotes_round_trip() {
    let f = parse("---\nname: \"review\"\ndescription: \"Read diffs\"\n---\n# Review").unwrap();
    assert_eq!(validate(&f, "review").unwrap().description, "Read diffs");
}
#[test]
fn escaped_scalar() {
    let f = parse(
        r#"---
name: "review"
description: "Read \"quoted\" paths and \u00e9"
---
Body"#,
    )
    .unwrap();
    assert_eq!(f["description"], "Read \"quoted\" paths and é");
}
#[test]
fn broken_quote_rejected() {
    assert!(parse("---\nname: \"review\n---").is_err());
}
