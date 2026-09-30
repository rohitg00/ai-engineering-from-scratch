use super::*;
pub fn cost(usage: &Usage, rates: &Rates) -> Result<u64, Error> {
    if usage.cached > usage.input {
        return Err(Error::Invalid("cached exceeds input".into()));
    }
    let a = (usage.input - usage.cached)
        .checked_mul(rates.input)
        .ok_or(Error::Limit)?;
    let b = usage.cached.checked_mul(rates.cached).ok_or(Error::Limit)?;
    let c = usage.output.checked_mul(rates.output).ok_or(Error::Limit)?;
    a.checked_add(b)
        .and_then(|x| x.checked_add(c))
        .ok_or(Error::Limit)
}
