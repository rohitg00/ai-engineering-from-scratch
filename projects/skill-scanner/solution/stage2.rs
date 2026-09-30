use super::*;
pub fn scan(lines: &[Span]) -> Vec<Finding> {
    let mut out = Vec::new();
    for s in lines {
        let t = s.text.to_lowercase();
        let mut rules = Vec::new();
        if t.contains("ignore previous") || t.contains("ignore all instructions") {
            rules.push(("instruction-override", 3));
        }
        if t.contains(".ssh/") || t.contains(".env") {
            rules.push(("secret-access", 2));
        }
        if (t.contains("curl ") || t.contains("wget "))
            && (t.contains("http://") || t.contains("https://"))
        {
            rules.push(("network-command", 2));
        }
        for (rule, severity) in rules {
            out.push(Finding {
                rule: rule.into(),
                severity,
                line: s.line,
                start: s.start,
                end: s.end,
            });
        }
    }
    out
}
