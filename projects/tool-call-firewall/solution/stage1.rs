use super::*;
pub fn call(line: &str, max_bytes: usize) -> Result<Call, Error> {
    if line.len() > max_bytes {
        return Err(Error::Limit);
    }
    if line.chars().any(|c| c.is_control()) {
        return Err(Error::Invalid("control character".into()));
    }
    let p: Vec<&str> = line.split('|').collect();
    if p.len() != 4 || p.iter().any(|s| s.is_empty()) {
        return Err(Error::Invalid("id|role|tool|argument required".into()));
    }
    Ok(Call {
        id: p[0].into(),
        role: p[1].into(),
        tool: p[2].into(),
        argument: p[3].into(),
    })
}
