use super::*;
pub fn authorize(c: &Call, approval: Option<&mut Approval>) -> Result<(), Error> {
    todo!("Stage 3: implement authorize");
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
    todo!("authorize before real file access; bind content and contain paths")
}
