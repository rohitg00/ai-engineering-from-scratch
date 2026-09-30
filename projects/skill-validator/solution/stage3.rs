use super::*;
pub fn reference_path(root: &std::path::Path, resource: &str) -> Result<std::path::PathBuf, Error> {
    use std::path::Component;
    let rel = std::path::Path::new(resource);
    if resource.is_empty()
        || resource.contains('\\')
        || rel.components().any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err(Error::Invalid("relative resource required".into()));
    }
    let base = root.canonicalize().map_err(|e| Error::Io(e.to_string()))?;
    let target = base
        .join(rel)
        .canonicalize()
        .map_err(|e| Error::Io(e.to_string()))?;
    if !target.starts_with(base) {
        return Err(Error::Invalid("resource escapes root".into()));
    }
    Ok(target)
}
