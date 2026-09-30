use super::*;
pub fn review(
    text: &str,
    findings: &[Finding],
    threshold: u32,
    max_findings: usize,
) -> Result<String, Error> {
    if threshold == 0 {
        return Err(Error::Invalid("threshold must be positive".into()));
    }
    if findings.len() > max_findings {
        return Err(Error::Limit);
    }
    let score = risk_score(findings)?;
    let mut out = format!(
        "state={} score={} advisory=true\n",
        if score >= threshold {
            "review-required"
        } else {
            "below-threshold"
        },
        score
    );
    for f in findings {
        let quote = text
            .get(f.start..f.end)
            .ok_or_else(|| Error::Invalid("invalid source slice".into()))?;
        out.push_str(&format!("line {} {} {:?}\n", f.line, f.rule, quote));
    }
    Ok(out)
}
