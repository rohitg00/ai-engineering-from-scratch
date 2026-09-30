use super::*;
pub fn decide(c: &Call) -> Decision {
    if !matches!(c.role.as_str(), "reader" | "editor") {
        return Decision::Deny;
    }
    let p = std::path::Path::new(&c.argument);
    if c.argument.starts_with('.')
        || c.argument.contains('\\')
        || p.components()
            .any(|x| !matches!(x, std::path::Component::Normal(_)))
    {
        return Decision::Deny;
    }
    match (c.role.as_str(), c.tool.as_str()) {
        (_, "read") => Decision::Allow,
        ("editor", "write") => Decision::ApprovalRequired,
        _ => Decision::Deny,
    }
}
