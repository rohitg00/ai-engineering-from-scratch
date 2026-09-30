#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn parent() {
    assert!(reference_path(std::path::Path::new("."), "../secret").is_err());
}
#[test]
fn absolute() {
    assert!(reference_path(std::path::Path::new("."), "/tmp/secret").is_err());
}
#[test]
fn windows() {
    assert!(reference_path(std::path::Path::new("."), r"..\secret").is_err());
}
#[test]
fn existing() {
    let r = std::path::Path::new(env!("PROJECT_WORKSPACE"));
    assert!(reference_path(r, "main.rs").unwrap().ends_with("main.rs"));
}
#[test]
fn missing() {
    assert!(reference_path(
        std::path::Path::new(env!("PROJECT_WORKSPACE")),
        "absent-resource"
    )
    .is_err());
}

#[cfg(unix)]
#[test]
fn symlink_escape_is_rejected() {
    let base = std::env::temp_dir().join(format!("skill-reference-test-{}", std::process::id()));
    let root = base.join("skill");
    std::fs::create_dir_all(&root).unwrap();
    let outside = base.join("secret.txt");
    std::fs::write(&outside, "outside").unwrap();
    std::os::unix::fs::symlink(&outside, root.join("reference.txt")).unwrap();
    let result = reference_path(&root, "reference.txt");
    std::fs::remove_dir_all(&base).unwrap();
    assert!(matches!(result, Err(Error::Invalid(_))));
}
