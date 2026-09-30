use super::*;
pub fn authorize(c: &Call, approval: Option<&mut Approval>) -> Result<(), Error> {
    match decide(c) {
        Decision::Deny => Err(Error::Invalid("policy denied".into())),
        Decision::Allow => Ok(()),
        Decision::ApprovalRequired => {
            let a = approval.ok_or_else(|| Error::Invalid("approval required".into()))?;
            if a.used || a.request != *c {
                return Err(Error::Conflict);
            }
            a.used = true;
            Ok(())
        }
    }
}

#[derive(Debug, Clone)]
pub struct ExecutionApproval {
    pub request: Call,
    pub content: String,
    pub used: bool,
}

pub fn dispatch(
    root: &std::path::Path,
    request: &Call,
    content: Option<&str>,
    approval: Option<&mut ExecutionApproval>,
) -> Result<String, Error> {
    use std::io::Read;
    let base = root.canonicalize().map_err(|e| Error::Io(e.to_string()))?;
    if decide(request) == Decision::Deny {
        return Err(Error::Invalid("policy denied".into()));
    }
    let target = base
        .join(&request.argument)
        .canonicalize()
        .map_err(|e| Error::Io(e.to_string()))?;
    if !target.starts_with(&base) || !target.is_file() {
        return Err(Error::Invalid("existing contained file required".into()));
    }
    if request.tool == "write" {
        let text = content.ok_or_else(|| Error::Invalid("write content required".into()))?;
        if text.len() > 16384 {
            return Err(Error::Limit);
        }
        let receipt = approval.ok_or_else(|| Error::Invalid("approval required".into()))?;
        if receipt.used || receipt.request != *request || receipt.content != text {
            return Err(Error::Conflict);
        }
        let mut gate = Approval {
            request: receipt.request.clone(),
            used: receipt.used,
        };
        authorize(request, Some(&mut gate))?;
        receipt.used = true;
        std::fs::write(target, text).map_err(|e| Error::Io(e.to_string()))?;
        Ok(format!("wrote {} bytes", text.len()))
    } else {
        authorize(request, None)?;
        if content.is_some() {
            return Err(Error::Invalid("read has no content".into()));
        }
        let mut text = String::new();
        std::fs::File::open(target)
            .map_err(|e| Error::Io(e.to_string()))?
            .take(16385)
            .read_to_string(&mut text)
            .map_err(|e| Error::Io(e.to_string()))?;
        if text.len() > 16384 {
            return Err(Error::Limit);
        }
        Ok(text)
    }
}
