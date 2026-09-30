use super::*;
pub fn parse_usage(line: &str) -> Result<Usage, Error> {
    let p: Vec<&str> = line.trim().split(',').collect();
    if p.len() != 3 {
        return Err(Error::Invalid("input,output,cached required".into()));
    }
    let mut n = Vec::new();
    for part in p {
        if part.is_empty() || !part.bytes().all(|b| b.is_ascii_digit()) {
            return Err(Error::Invalid("unsigned counter required".into()));
        }
        n.push(part.parse::<u64>().map_err(|_| Error::Limit)?);
    }
    if n[2] > n[0] {
        return Err(Error::Invalid("cached exceeds input".into()));
    }
    Ok(Usage {
        input: n[0],
        output: n[1],
        cached: n[2],
    })
}
