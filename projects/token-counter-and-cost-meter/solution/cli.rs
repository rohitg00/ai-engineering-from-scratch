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
    if args.len() != 5 {
        return Err(Error::Invalid("usage: cost-meter input,output,cached input-rate output-rate cached-rate budget (all rates in nano-dollars/token)".into()));
    }
    let usage = parse_usage(&args[0])?;
    let numbers: Result<Vec<u64>, _> = args[1..].iter().map(|s| s.parse::<u64>()).collect();
    let n =
        numbers.map_err(|_| Error::Invalid("unsigned integer rate and budget required".into()))?;
    let actual = cost(
        &usage,
        &Rates {
            input: n[0],
            output: n[1],
            cached: n[2],
        },
    )?;
    let mut spent = 0;
    let admitted = reserve(&mut spent, actual, n[3]).is_ok();
    println!("{{\"schema_version\":1,\"unit\":\"nano_dollars\",\"input_tokens\":{},\"output_tokens\":{},\"cached_tokens\":{},\"cost\":{},\"admitted\":{},\"remaining\":{}}}",usage.input,usage.output,usage.cached,actual,admitted,n[3]-spent);
    Ok(())
}
fn main() {
    if let Err(e) = run() {
        eprintln!("{:?}", e);
        std::process::exit(1)
    }
}
