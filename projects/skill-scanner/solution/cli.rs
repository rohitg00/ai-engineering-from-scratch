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
fn collect(
    root: &std::path::Path,
    folder: &std::path::Path,
    out: &mut Vec<std::path::PathBuf>,
) -> Result<(), Error> {
    for entry in std::fs::read_dir(folder).map_err(|e| Error::Io(e.to_string()))? {
        let entry = entry.map_err(|e| Error::Io(e.to_string()))?;
        let path = entry.path();
        let kind = entry.file_type().map_err(|e| Error::Io(e.to_string()))?;
        if kind.is_symlink() {
            return Err(Error::Invalid("symlink in bundle".into()));
        }
        if !path.starts_with(root) {
            return Err(Error::Conflict);
        }
        if kind.is_dir() {
            collect(root, &path, out)?
        } else if kind.is_file() {
            out.push(path)
        }
        if out.len() > 200 {
            return Err(Error::Limit);
        }
    }
    Ok(())
}
fn run() -> Result<(), Error> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let target = std::path::Path::new(
        args.first()
            .ok_or_else(|| Error::Invalid("usage: scanner file-or-bundle [threshold]".into()))?,
    );
    let threshold = args
        .get(1)
        .map(|v| v.parse::<u32>())
        .transpose()
        .map_err(|_| Error::Invalid("invalid threshold".into()))?
        .unwrap_or(3);
    if threshold == 0 {
        return Err(Error::Invalid("positive threshold required".into()));
    }
    let root = target
        .canonicalize()
        .map_err(|e| Error::Io(e.to_string()))?;
    let mut files = vec![];
    if root.is_dir() {
        collect(&root, &root, &mut files)?
    } else {
        files.push(root.clone())
    }
    files.sort();
    let mut results = vec![];
    let mut total = 0u32;
    for file in files {
        let text = read_file(&file, 100000)?;
        let findings = scan(&spans(&text, 100000)?);
        let score = risk_score(&findings)?;
        total = total.checked_add(score).ok_or(Error::Limit)?;
        let rows:Vec<String>=findings.iter().map(|f|format!("{{\"rule\":{},\"severity\":{},\"line\":{},\"start\":{},\"end\":{},\"quote\":{}}}",json(&f.rule),f.severity,f.line,f.start,f.end,json(&text[f.start..f.end]))).collect();
        let label = if root.is_dir() {
            file.strip_prefix(&root).unwrap_or(&file)
        } else {
            file.file_name().map(std::path::Path::new).unwrap_or(&file)
        };
        results.push(format!(
            "{{\"path\":{},\"score\":{},\"findings\":[{}]}}",
            json(&label.to_string_lossy()),
            score,
            rows.join(",")
        ));
    }
    println!(
        "{{\"schema_version\":1,\"advisory\":true,\"state\":{},\"score\":{},\"files\":[{}]}}",
        json(if total >= threshold {
            "review-required"
        } else {
            "below-threshold"
        }),
        total,
        results.join(",")
    );
    Ok(())
}
fn main() {
    if let Err(e) = run() {
        eprintln!("{:?}", e);
        std::process::exit(1)
    }
}
