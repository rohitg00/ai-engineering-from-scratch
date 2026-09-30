#[allow(dead_code, unused_imports)]
mod project {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use project::*;
#[test]
fn actual_dispatch_binds_payload_and_consumes() {
    let root = std::env::temp_dir().join(format!("firewall-dispatch-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(root.join("note.txt"), "old").unwrap();
    let request = call("r1|editor|write|note.txt", 100).unwrap();
    let mut approval = ExecutionApproval {
        request: request.clone(),
        content: "new".into(),
        used: false,
    };
    assert!(dispatch(&root, &request, Some("changed"), Some(&mut approval)).is_err());
    assert_eq!(
        std::fs::read_to_string(root.join("note.txt")).unwrap(),
        "old"
    );
    dispatch(&root, &request, Some("new"), Some(&mut approval)).unwrap();
    assert_eq!(
        std::fs::read_to_string(root.join("note.txt")).unwrap(),
        "new"
    );
    assert!(dispatch(&root, &request, Some("new"), Some(&mut approval)).is_err());
    std::fs::remove_dir_all(root).unwrap();
}
#[test]
fn reader_cannot_write_file() {
    let root = std::env::temp_dir().join(format!("firewall-reader-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(root.join("note.txt"), "old").unwrap();
    assert!(dispatch(
        &root,
        &call("r|reader|write|note.txt", 100).unwrap(),
        Some("new"),
        None
    )
    .is_err());
    assert_eq!(
        std::fs::read_to_string(root.join("note.txt")).unwrap(),
        "old"
    );
    std::fs::remove_dir_all(root).unwrap();
}
