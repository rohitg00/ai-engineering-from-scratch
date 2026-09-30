use super::*;
pub fn reserve(spent: &mut u64, quote: u64, limit: u64) -> Result<u64, Error> {
    let next = spent.checked_add(quote).ok_or(Error::Limit)?;
    if next > limit {
        return Err(Error::Limit);
    }
    *spent = next;
    Ok(limit - next)
}
