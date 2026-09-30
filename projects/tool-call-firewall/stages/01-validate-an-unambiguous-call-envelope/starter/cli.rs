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
    if args.len() < 5 {
        return Err(Error::Invalid("usage: firewall root trusted-role request-id read|write relative-path [content-file] [--approve]".into()));
    }
    call(
        &format!("{}|{}|{}|{}", args[2], args[1], args[3], args[4]),
        4096,
    )?;
    // Role comes from the application invocation, never from an untrusted model response.
    let request = Call {
        id: args[2].clone(),
        role: args[1].clone(),
        tool: args[3].clone(),
        argument: args[4].clone(),
    };
    let content = if request.tool == "write" {
        Some(read_file(
            std::path::Path::new(
                args.get(5)
                    .ok_or_else(|| Error::Invalid("content file required".into()))?,
            ),
            16384,
        )?)
    } else {
        None
    };
    let mut receipt = if args.last().is_some_and(|s| s == "--approve") {
        Some(ExecutionApproval {
            request: request.clone(),
            content: content.clone().unwrap_or_default(),
            used: false,
        })
    } else {
        None
    };
    let mut log = vec![];
    let decision = decide(&request);
    audit(&mut log, &request, &decision, 10)?;
    let output = dispatch(
        std::path::Path::new(&args[0]),
        &request,
        content.as_deref(),
        receipt.as_mut(),
    )?;
    let replay = if let Some(a) = receipt.as_mut() {
        dispatch(
            std::path::Path::new(&args[0]),
            &request,
            content.as_deref(),
            Some(a),
        )
        .is_err()
    } else {
        false
    };
    println!("{{\"schema_version\":1,\"request_id\":{},\"argument\":{},\"decision\":{},\"output\":{},\"approval_consumed\":{},\"replay_denied\":{}}}",json(&request.id),json(&request.argument),json(&format!("{:?}",decision)),json(&output),receipt.as_ref().is_some_and(|a|a.used),replay);
    Ok(())
}
fn main() {
    if let Err(e) = run() {
        eprintln!("{:?}", e);
        std::process::exit(1)
    }
}
