use std::collections::{BTreeMap, BTreeSet};
#[derive(Clone, Debug, PartialEq)]
pub struct Record {
    pub line: usize,
    pub level: String,
    pub message: String,
    pub template: String,
}
#[derive(Clone, Debug, PartialEq)]
pub struct Group {
    pub level: String,
    pub template: String,
    pub count: usize,
    pub first: usize,
    pub last: usize,
    pub example: String,
}
pub fn template(s: &str) -> String {
    let mut out = String::new();
    let mut digit = false;
    for c in s.chars() {
        if c.is_ascii_digit() {
            if !digit {
                out.push('#')
            };
            digit = true
        } else {
            out.push(c);
            digit = false
        }
    }
    out
}
pub fn parse_logs(s: &str) -> Result<Vec<Record>, String> {
    Err("TODO stage 1: parse logs".into())
}
pub fn group(records: &[Record]) -> Vec<Group> {
    Vec::new()
}
pub fn sample(records: &[Record], budget: usize, policy: &str) -> Result<Vec<Record>, String> {
    Err("TODO stage 3: sample logs".into())
}
pub fn quote(s: &str) -> String {
    let mut out = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 32 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}
pub fn compact(records: &[Record], selected: &[Record]) -> String {
    String::new()
}
fn main() {
    let a: Vec<_> = std::env::args().collect();
    let run = || -> Result<(), String> {
        if a.len() != 5 {
            return Err("usage: log-context INPUT BUDGET uniform|rarity OUTPUT".into());
        };
        let s = std::fs::read_to_string(&a[1]).map_err(|e| e.to_string())?;
        let records = parse_logs(&s)?;
        let budget = a[2].parse::<usize>().map_err(|e| e.to_string())?;
        let selected = sample(&records, budget, &a[3])?;
        let text = compact(&records, &selected);
        std::fs::write(&a[4], &text).map_err(|e| e.to_string())?;
        println!(
            "records={} selected={} retained_templates={} output={}",
            records.len(),
            selected.len(),
            text.lines().count(),
            a[4]
        );
        Ok(())
    };
    if let Err(e) = run() {
        eprintln!("{}", e);
        std::process::exit(1)
    }
}
