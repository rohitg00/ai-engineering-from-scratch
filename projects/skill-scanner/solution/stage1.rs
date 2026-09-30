use super::*;
pub fn spans(text: &str, max_bytes: usize) -> Result<Vec<Span>, Error> {
    if text.len() > max_bytes {
        return Err(Error::Limit);
    }
    let mut offset = 0;
    let mut out = Vec::new();
    for (i, raw) in text.split_inclusive('\n').enumerate() {
        let clean = raw
            .strip_suffix('\n')
            .unwrap_or(raw)
            .strip_suffix('\r')
            .unwrap_or(raw.strip_suffix('\n').unwrap_or(raw));
        out.push(Span {
            line: i + 1,
            start: offset,
            end: offset + clean.len(),
            text: clean.into(),
        });
        offset += raw.len();
    }
    Ok(out)
}
