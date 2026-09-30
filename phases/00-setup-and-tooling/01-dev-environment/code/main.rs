// Lesson: Dev Environment (phase 00 / lesson 01)
// Topic: verify that the four-layer toolchain (system, package managers, runtimes, libs)
// is reachable from a Rust binary. Spawns each tool with `--version`, captures stdout,
// reports PASS/FAIL plus the parsed version string. Stdlib only.
// Refs:
//   https://doc.rust-lang.org/std/process/struct.Command.html
//   https://doc.rust-lang.org/std/process/struct.Output.html
//   https://doc.rust-lang.org/book/ch12-00-an-io-project.html
// Build: rustc --edition 2021 code/main.rs -o /tmp/lesson_dev_env && /tmp/lesson_dev_env

use std::process::{Command, ExitCode};

struct Check {
    name: &'static str,
    program: &'static str,
    args: &'static [&'static str],
    optional: bool,
}

impl Check {
    const fn new(name: &'static str, program: &'static str, optional: bool) -> Self {
        Check {
            name,
            program,
            args: &["--version"],
            optional,
        }
    }
}

const CHECKS: &[Check] = &[
    Check::new("Git", "git", false),
    Check::new("Python 3.10+", "python3", false),
    Check::new("Node.js", "node", false),
    Check::new("Rust (rustc)", "rustc", false),
    Check::new("Cargo", "cargo", false),
    Check::new("uv (Python)", "uv", true),
    Check::new("pnpm", "pnpm", true),
    Check::new("Julia", "julia", true),
];

fn run_check(check: &Check) -> Result<String, String> {
    let output = Command::new(check.program)
        .args(check.args)
        .output()
        .map_err(|e| format!("{}: {}", check.program, e))?;

    if !output.status.success() {
        return Err(format!("exit code {:?}", output.status.code()));
    }

    let combined = if !output.stdout.is_empty() {
        &output.stdout
    } else {
        &output.stderr
    };

    let raw = String::from_utf8_lossy(combined);
    let line = raw.lines().next().unwrap_or("").trim().to_string();
    if line.is_empty() {
        Err("empty version output".to_string())
    } else {
        Ok(line)
    }
}

fn parse_minor_python(version_line: &str) -> Option<(u32, u32)> {
    let trimmed = version_line.trim_start_matches("Python").trim();
    let mut parts = trimmed.split('.');
    let major: u32 = parts.next()?.parse().ok()?;
    let minor: u32 = parts.next()?.parse().ok()?;
    Some((major, minor))
}

fn print_header() {
    println!();
    println!("=== AI Engineering from Scratch — Environment Check (Rust) ===");
    println!();
    println!("Layer 1 (system) -> Layer 2 (package managers) -> Layer 3 (runtimes) -> Layer 4 (libs)");
    println!();
}

fn main() -> ExitCode {
    print_header();

    let mut required_pass = 0u32;
    let mut required_total = 0u32;
    let mut optional_pass = 0u32;
    let mut optional_total = 0u32;

    let mut python_ok = true;

    println!("Required tools:");
    for check in CHECKS.iter().filter(|c| !c.optional) {
        required_total += 1;
        match run_check(check) {
            Ok(version) => {
                if check.name.starts_with("Python") {
                    match parse_minor_python(&version) {
                        Some((major, minor)) if (major, minor) >= (3, 10) => {}
                        _ => {
                            println!("  [FAIL] {:<14} {} (need parseable Python 3.10+)", check.name, version);
                            python_ok = false;
                            continue;
                        }
                    }
                }
                required_pass += 1;
                println!("  [PASS] {:<14} {}", check.name, version);
            }
            Err(why) => {
                println!("  [FAIL] {:<14} {}", check.name, why);
                if check.name.starts_with("Python") {
                    python_ok = false;
                }
            }
        }
    }

    println!();
    println!("Optional tools:");
    for check in CHECKS.iter().filter(|c| c.optional) {
        optional_total += 1;
        match run_check(check) {
            Ok(version) => {
                optional_pass += 1;
                println!("  [PASS] {:<14} {}", check.name, version);
            }
            Err(_) => {
                println!("  [skip] {:<14} not installed", check.name);
            }
        }
    }

    println!();
    println!("Summary: {}/{} required, {}/{} optional",
             required_pass, required_total, optional_pass, optional_total);

    if required_pass == required_total && python_ok {
        println!();
        println!("Environment is ready. Start with Phase 1.");
        ExitCode::SUCCESS
    } else {
        println!();
        println!("Fix the failed checks above, then run this again.");
        ExitCode::from(1)
    }
}
