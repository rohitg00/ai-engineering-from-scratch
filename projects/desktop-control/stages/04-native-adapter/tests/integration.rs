use std::{
    fs,
    path::PathBuf,
    process::{Command, Output},
    sync::{
        atomic::{AtomicU64, Ordering},
        OnceLock,
    },
};
fn binary() -> &'static PathBuf {
    static BIN: OnceLock<PathBuf> = OnceLock::new();
    BIN.get_or_init(|| {
        let target = std::env::temp_dir().join(format!("desktop-cli-test-{}", std::process::id()));
        let build = Command::new("rustc")
            .args([
                "--edition",
                "2021",
                concat!(env!("PROJECT_WORKSPACE"), "/cli.rs"),
                "-o",
            ])
            .arg(&target)
            .output()
            .unwrap();
        assert!(
            build.status.success(),
            "{}",
            String::from_utf8_lossy(&build.stderr)
        );
        target
    })
}
fn run(input: &str) -> (Output, PathBuf) {
    static NEXT: AtomicU64 = AtomicU64::new(0);
    let dir = std::env::temp_dir().join(format!(
        "desktop-actions-{}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir(&dir).unwrap();
    fs::write(dir.join("input.tsv"), input).unwrap();
    let result = Command::new(binary())
        .arg(dir.join("input.tsv"))
        .arg(dir.join("frames"))
        .output()
        .unwrap();
    (result, dir)
}
#[test]
fn executes_input_and_writes_pixels() {
    let (out, dir) =
        run("capture\nclick\t50\t70\t0\ntype\tMira\ncapture\nclick\t230\t160\t2\ncapture\n");
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    assert!(String::from_utf8_lossy(&out.stdout).contains("complete=true"));
    assert!(fs::read(dir.join("frames/frame-6.ppm"))
        .unwrap()
        .starts_with(b"P6\n320 200"));
    fs::remove_dir_all(dir).unwrap();
}
#[test]
fn stale_generation_reports_input_line() {
    let (out, dir) = run("capture\nclick\t50\t70\t9\n");
    assert!(!out.status.success());
    assert!(String::from_utf8_lossy(&out.stderr).contains("line 2: stale frame"));
    fs::remove_dir_all(dir).unwrap();
}
#[test]
fn type_without_focus_fails() {
    let (out, dir) = run("type\tMira\n");
    assert!(!out.status.success());
    assert!(String::from_utf8_lossy(&out.stderr).contains("not focused"));
    fs::remove_dir_all(dir).unwrap();
}
#[test]
fn unknown_action_is_not_executed() {
    let (out, dir) = run("shell\tanything\n");
    assert!(!out.status.success());
    fs::remove_dir_all(dir).unwrap();
}
#[test]
fn input_budget_is_enforced() {
    let (out, dir) = run(&"capture\n".repeat(33));
    assert!(!out.status.success());
    assert!(String::from_utf8_lossy(&out.stderr).contains("budget exhausted"));
    fs::remove_dir_all(dir).unwrap();
}
