use super::*;
pub fn audit(
    log: &mut Vec<String>,
    c: &Call,
    d: &Decision,
    max_entries: usize,
) -> Result<(), Error> {
    if log.len() >= max_entries {
        return Err(Error::Limit);
    }
    let prefix = format!("{}\t", c.id);
    if log.iter().any(|row| row.starts_with(&prefix)) {
        return Err(Error::Conflict);
    }
    log.push(format!("{}\t{}\t{}\t{:?}", c.id, c.role, c.tool, d));
    Ok(())
}
