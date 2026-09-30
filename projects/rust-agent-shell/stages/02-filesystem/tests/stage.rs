#![allow(dead_code)]
mod learner {
    include!(concat!(env!("PROJECT_WORKSPACE"), "/main.rs"));
}
use learner::*;
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT_DIRECTORY: AtomicU64 = AtomicU64::new(0);

fn temp() -> std::path::PathBuf {
    for _ in 0..1024 {
        let sequence = NEXT_DIRECTORY.fetch_add(1, Ordering::Relaxed);
        let dir =
            std::env::temp_dir().join(format!("shell-test-{}-{}", std::process::id(), sequence));
        match std::fs::create_dir(&dir) {
            Ok(()) => return dir.canonicalize().unwrap(),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => panic!("could not create fixture directory: {error}"),
        }
    }
    panic!("could not allocate a unique fixture directory");
}
#[test]
fn reads_file() {
    let d = temp();
    std::fs::write(d.join("a"), "hello").unwrap();
    assert_eq!(execute(&d, &Action::Read("a".into())).unwrap(), "hello");
    std::fs::remove_dir_all(d).unwrap();
}
#[test]
fn parent_escape_rejected() {
    let d = temp();
    assert!(contained(&d, "../outside").is_err());
    std::fs::remove_dir_all(d).unwrap();
}
#[test]
fn absolute_path_rejected() {
    let d = temp();
    assert!(contained(&d, "/etc/passwd").is_err());
    std::fs::remove_dir_all(d).unwrap();
}
#[test]
fn oversize_file_rejected() {
    let d = temp();
    std::fs::write(d.join("a"), vec![b'x'; 16385]).unwrap();
    assert!(execute(&d, &Action::Read("a".into())).is_err());
    std::fs::remove_dir_all(d).unwrap();
}
#[test]
fn literal_search_returns_line() {
    let d = temp();
    std::fs::write(d.join("a"), "one\nneedle here\n").unwrap();
    assert_eq!(
        execute(
            &d,
            &Action::Search {
                pattern: "needle".into(),
                path: "a".into()
            }
        )
        .unwrap(),
        "2:needle here"
    );
    std::fs::remove_dir_all(d).unwrap();
}
#[cfg(unix)]
#[test]
fn symlink_escape_rejected() {
    let d = temp();
    std::os::unix::fs::symlink(std::env::temp_dir(), d.join("escape")).unwrap();
    assert!(contained(&d, "escape").is_err());
    std::fs::remove_dir_all(d).unwrap();
}

#[test]
fn concurrent_reads_stay_in_their_own_workspaces() {
    let start = std::sync::Barrier::new(16);
    std::thread::scope(|scope| {
        for worker in 0..16 {
            let start = &start;
            scope.spawn(move || {
                start.wait();
                let dir = temp();
                let expected = format!("workspace {worker}");
                std::fs::write(dir.join("shared-name.txt"), &expected).unwrap();
                let actual = execute(&dir, &Action::Read("shared-name.txt".into())).unwrap();
                std::fs::remove_dir_all(dir).unwrap();
                assert_eq!(actual, expected);
            });
        }
    });
}
