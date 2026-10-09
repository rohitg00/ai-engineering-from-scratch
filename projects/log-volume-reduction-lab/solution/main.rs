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
    if s.len() > 1_048_576 {
        return Err("input exceeds one MiB".into());
    };
    let mut out = Vec::new();
    for (i, line) in s.lines().enumerate() {
        if i >= 10_000 {
            return Err("too many records".into());
        };
        if line.len() > 4096 {
            return Err("record too long".into());
        };
        let (level, message) = line.split_once('\t').ok_or("expected LEVEL<TAB>message")?;
        if !["DEBUG", "INFO", "WARN", "ERROR"].contains(&level)
            || message.trim().is_empty()
            || message.chars().any(|c| c.is_control())
        {
            return Err("invalid level or message".into());
        };
        out.push(Record {
            line: i + 1,
            level: level.into(),
            message: message.into(),
            template: template(message),
        })
    }
    Ok(out)
}
pub fn group(records: &[Record]) -> Vec<Group> {
    let mut groups: BTreeMap<(String, String), Group> = BTreeMap::new();
    for r in records {
        let g = groups
            .entry((r.level.clone(), r.template.clone()))
            .or_insert(Group {
                level: r.level.clone(),
                template: r.template.clone(),
                count: 0,
                first: r.line,
                last: r.line,
                example: r.message.clone(),
            });
        g.count += 1;
        g.first = g.first.min(r.line);
        g.last = g.last.max(r.line)
    }
    groups.into_values().collect()
}
pub fn sample(records: &[Record], budget: usize, policy: &str) -> Result<Vec<Record>, String> {
    if policy != "uniform" && policy != "rarity" {
        return Err("unknown policy".into());
    };
    if budget == 0 || records.is_empty() {
        return Ok(vec![]);
    };
    let n = budget.min(records.len());
    if policy == "uniform" {
        return Ok((0..n)
            .map(|i| records[i * records.len() / n].clone())
            .collect());
    }
    let groups = group(records);
    let counts: BTreeMap<_, _> = groups
        .iter()
        .map(|g| ((g.level.clone(), g.template.clone()), g.count))
        .collect();
    let mut order: Vec<_> = records.iter().collect();
    order.sort_by_key(|r| (counts[&(r.level.clone(), r.template.clone())], r.line));
    let mut selected = Vec::new();
    let mut seen = BTreeSet::new();
    for r in &order {
        if seen.insert((r.level.clone(), r.template.clone())) {
            selected.push((*r).clone());
            if selected.len() == n {
                return Ok(selected);
            }
        }
    }
    for r in order {
        if !selected.iter().any(|x| x.line == r.line) {
            selected.push(r.clone());
            if selected.len() == n {
                break;
            }
        }
    }
    Ok(selected)
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
    let keys: BTreeSet<_> = selected
        .iter()
        .map(|r| (r.level.clone(), r.template.clone()))
        .collect();
    let mut out = String::new();
    for g in group(records) {
        if keys.contains(&(g.level.clone(), g.template.clone())) {
            out.push_str(&format!("{{\"schemaVersion\":1,\"level\":{},\"template\":{},\"count\":{},\"firstLine\":{},\"lastLine\":{},\"example\":{}}}\n",quote(&g.level),quote(&g.template),g.count,g.first,g.last,quote(&g.example)))
        }
    }
    out
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
