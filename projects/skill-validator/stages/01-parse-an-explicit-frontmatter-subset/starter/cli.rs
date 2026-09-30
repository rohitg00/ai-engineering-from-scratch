pub mod types;
pub use types::*;
pub mod stage1;
pub use stage1::*;
pub mod stage2;
pub use stage2::*;
pub mod stage3;
pub use stage3::*;
pub mod stage4;
pub use stage4::*;
fn json(value: &str) -> String {
    let mut out = String::from("\"");
    for ch in value.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if c.is_control() => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}
fn read_file(path: &std::path::Path, max: u64) -> Result<String, Error> {
    use std::io::Read;
    let info = std::fs::metadata(path).map_err(|e| Error::Io(e.to_string()))?;
    if !info.is_file() || info.len() > max {
        return Err(Error::Limit);
    }
    let mut text = String::new();
    std::fs::File::open(path)
        .map_err(|e| Error::Io(e.to_string()))?
        .take(max + 1)
        .read_to_string(&mut text)
        .map_err(|e| Error::Io(e.to_string()))?;
    if text.len() as u64 > max {
        return Err(Error::Limit);
    }
    Ok(text)
}
fn run() -> Result<(), Error> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let root = std::path::Path::new(args.first().ok_or_else(|| {
        Error::Invalid(
            "usage: validator skill-directory [character-budget] [--activate] [relative-resource]"
                .into(),
        )
    })?);
    let budget = args
        .get(1)
        .map(|s| s.parse::<usize>())
        .transpose()
        .map_err(|_| Error::Invalid("invalid budget".into()))?
        .unwrap_or(2000);
    let activate = args.get(2).is_some_and(|s| s == "--activate");
    let source = reference_path(root, "SKILL.md")?;
    let name = root
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or(Error::Conflict)?;
    let skill = validate(&parse(&read_file(&source, 100000)?)?, name)?;
    let mut context = disclose(&skill, activate, budget)?;
    if let Some(resource) = args.get(3) {
        if !activate {
            return Err(Error::Invalid("resource requires activation".into()));
        }
        let text = read_file(&reference_path(root, resource)?, 100000)?;
        context.push_str("\n\n");
        context.push_str(&text);
        if context.chars().count() > budget {
            return Err(Error::Limit);
        }
    }
    println!(
        "{{\"schema_version\":1,\"name\":{},\"activated\":{},\"characters\":{},\"context\":{}}}",
        json(&skill.name),
        activate,
        context.chars().count(),
        json(&context)
    );
    Ok(())
}
fn main() {
    if let Err(e) = run() {
        eprintln!("{:?}", e);
        std::process::exit(1)
    }
}
