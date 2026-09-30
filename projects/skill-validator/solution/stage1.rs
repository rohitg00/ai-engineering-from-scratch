use super::*;
pub fn parse(text: &str) -> Result<std::collections::BTreeMap<String, String>, Error> {
    let lines: Vec<&str> = text.lines().collect();
    if lines.first() != Some(&"---") {
        return Err(Error::Invalid("missing frontmatter".into()));
    }
    let end = lines
        .iter()
        .skip(1)
        .position(|x| *x == "---")
        .ok_or_else(|| Error::Invalid("unclosed frontmatter".into()))?
        + 1;
    let mut result = std::collections::BTreeMap::new();
    for line in &lines[1..end] {
        if line.trim().is_empty() {
            continue;
        }
        let (key, value) = line
            .split_once(':')
            .ok_or_else(|| Error::Invalid("expected key: value".into()))?;
        let key = key.trim();
        let value = value.trim();
        if key.is_empty()
            || value.is_empty()
            || value.starts_with(['!', '&', '*', '|', '>', '[', '{', '\''])
        {
            return Err(Error::Invalid("unsupported YAML syntax".into()));
        }
        let value = if value.starts_with('"') {
            quoted_scalar(value)?
        } else {
            value.to_string()
        };
        if result.insert(key.into(), value).is_some() {
            return Err(Error::Conflict);
        }
    }
    result.insert("$body".into(), lines[end + 1..].join("\n"));
    Ok(result)
}

fn quoted_scalar(text: &str) -> Result<String, Error> {
    let fail = || Error::Invalid("invalid quoted scalar".into());
    if !text.ends_with('"') || text.len() < 2 {
        return Err(fail());
    }
    let mut chars = text[1..text.len() - 1].chars();
    let mut out = String::new();
    while let Some(ch) = chars.next() {
        if ch == '"' || ch.is_control() {
            return Err(fail());
        }
        if ch != '\\' {
            out.push(ch);
            continue;
        }
        match chars.next().ok_or_else(fail)? {
            '"' => out.push('"'),
            '\\' => out.push('\\'),
            '/' => out.push('/'),
            'n' => out.push('\n'),
            'r' => out.push('\r'),
            't' => out.push('\t'),
            'b' => out.push('\u{8}'),
            'f' => out.push('\u{c}'),
            'u' => {
                let hex: String = chars.by_ref().take(4).collect();
                if hex.len() != 4 {
                    return Err(fail());
                }
                let mut code = u32::from_str_radix(&hex, 16).map_err(|_| fail())?;
                if (0xd800..=0xdbff).contains(&code) {
                    if chars.next() != Some('\\') || chars.next() != Some('u') {
                        return Err(fail());
                    }
                    let low: String = chars.by_ref().take(4).collect();
                    if low.len() != 4 {
                        return Err(fail());
                    }
                    let low = u32::from_str_radix(&low, 16).map_err(|_| fail())?;
                    if !(0xdc00..=0xdfff).contains(&low) {
                        return Err(fail());
                    }
                    code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
                }
                out.push(char::from_u32(code).ok_or_else(fail)?);
            }
            _ => return Err(fail()),
        }
    }
    Ok(out)
}
