use super::*;
pub fn validate(
    fields: &std::collections::BTreeMap<String, String>,
    directory: &str,
) -> Result<Skill, Error> {
    let name = fields
        .get("name")
        .ok_or_else(|| Error::Invalid("name required".into()))?;
    let desc = fields
        .get("description")
        .ok_or_else(|| Error::Invalid("description required".into()))?;
    if name.is_empty()
        || name.len() > 64
        || name.starts_with('-')
        || name.ends_with('-')
        || name.contains("--")
        || !name
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
    {
        return Err(Error::Invalid("invalid name".into()));
    }
    if name != directory {
        return Err(Error::Conflict);
    }
    if desc.trim().is_empty() || desc.chars().count() > 1024 {
        return Err(Error::Invalid("invalid description".into()));
    }
    Ok(Skill {
        name: name.clone(),
        description: desc.clone(),
        body: fields.get("$body").cloned().unwrap_or_default(),
    })
}
