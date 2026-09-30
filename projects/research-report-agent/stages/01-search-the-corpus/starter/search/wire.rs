#[derive(Debug, Clone, PartialEq)]
pub enum Json {
    Null,
    Bool(bool),
    Number(f64),
    Str(String),
    Array(Vec<Json>),
    Object(Vec<(String, Json)>),
}

impl Json {
    pub fn get(&self, key: &str) -> Option<&Json> {
        match self {
            Json::Object(pairs) => pairs.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }
}

pub fn parse_json(input: &str) -> Result<Json, String> {
    if input.len() > 65536 {
        return Err("request too large".into());
    }
    let chars: Vec<char> = input.chars().collect();
    let mut pos = 0;
    let value = parse_value(&chars, &mut pos)?;
    skip_ws(&chars, &mut pos);
    if pos != chars.len() {
        return Err(format!("unexpected trailing input at {}", pos));
    }
    Ok(value)
}

fn skip_ws(chars: &[char], pos: &mut usize) {
    while *pos < chars.len() && matches!(chars[*pos], ' ' | '\n' | '\r' | '\t') {
        *pos += 1;
    }
}

fn parse_value(chars: &[char], pos: &mut usize) -> Result<Json, String> {
    skip_ws(chars, pos);
    match chars.get(*pos) {
        None => Err("unexpected end of input".to_string()),
        Some('{') => parse_object(chars, pos),
        Some('[') => parse_array(chars, pos),
        Some('"') => parse_string(chars, pos).map(Json::Str),
        Some('t') => parse_literal(chars, pos, "true", Json::Bool(true)),
        Some('f') => parse_literal(chars, pos, "false", Json::Bool(false)),
        Some('n') => parse_literal(chars, pos, "null", Json::Null),
        Some(c) if *c == '-' || c.is_ascii_digit() => parse_number(chars, pos),
        Some(c) => Err(format!("unexpected character {:?} at {}", c, pos)),
    }
}

fn parse_literal(chars: &[char], pos: &mut usize, word: &str, value: Json) -> Result<Json, String> {
    let end = *pos + word.len();
    if end <= chars.len() && chars[*pos..end].iter().collect::<String>() == word {
        *pos = end;
        Ok(value)
    } else {
        Err(format!("invalid literal at {}", pos))
    }
}

fn parse_number(chars: &[char], pos: &mut usize) -> Result<Json, String> {
    let start = *pos;
    if chars.get(*pos) == Some(&'-') {
        *pos += 1;
    }
    match chars.get(*pos) {
        Some('0') => *pos += 1,
        Some('1'..='9') => {
            while chars.get(*pos).map_or(false, |c| c.is_ascii_digit()) {
                *pos += 1;
            }
        }
        _ => return Err("expected number digits".into()),
    }
    if chars.get(*pos) == Some(&'.') {
        *pos += 1;
        let digits = *pos;
        while chars.get(*pos).map_or(false, |c| c.is_ascii_digit()) {
            *pos += 1;
        }
        if *pos == digits {
            return Err("fraction needs digits".into());
        }
    }
    if matches!(chars.get(*pos), Some('e' | 'E')) {
        *pos += 1;
        if matches!(chars.get(*pos), Some('+' | '-')) {
            *pos += 1;
        }
        let digits = *pos;
        while chars.get(*pos).map_or(false, |c| c.is_ascii_digit()) {
            *pos += 1;
        }
        if *pos == digits {
            return Err("exponent needs digits".into());
        }
    }
    let text: String = chars[start..*pos].iter().collect();
    let value = text.parse::<f64>().map_err(|_| "invalid number")?;
    if !value.is_finite() {
        return Err("number out of range".into());
    }
    Ok(Json::Number(value))
}

fn parse_string(chars: &[char], pos: &mut usize) -> Result<String, String> {
    *pos += 1;
    let mut out = String::new();
    while *pos < chars.len() {
        let c = chars[*pos];
        *pos += 1;
        match c {
            '"' => return Ok(out),
            '\\' => {
                let esc = *chars.get(*pos).ok_or("unterminated escape")?;
                *pos += 1;
                match esc {
                    '"' => out.push('"'),
                    '\\' => out.push('\\'),
                    '/' => out.push('/'),
                    'b' => out.push('\u{8}'),
                    'f' => out.push('\u{c}'),
                    'n' => out.push('\n'),
                    'r' => out.push('\r'),
                    't' => out.push('\t'),
                    'u' => {
                        let hex: String = chars
                            .get(*pos..*pos + 4)
                            .ok_or("short unicode escape")?
                            .iter()
                            .collect();
                        *pos += 4;
                        let code =
                            u32::from_str_radix(&hex, 16).map_err(|_| "bad unicode escape")?;
                        let scalar = if (0xd800..=0xdbff).contains(&code) {
                            if chars.get(*pos..*pos + 2) != Some(&['\\', 'u'][..]) {
                                return Err("missing low surrogate".into());
                            }
                            *pos += 2;
                            let low_hex: String = chars
                                .get(*pos..*pos + 4)
                                .ok_or("short low surrogate")?
                                .iter()
                                .collect();
                            *pos += 4;
                            let low = u32::from_str_radix(&low_hex, 16)
                                .map_err(|_| "bad low surrogate")?;
                            if !(0xdc00..=0xdfff).contains(&low) {
                                return Err("invalid low surrogate".into());
                            }
                            0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00)
                        } else {
                            code
                        };
                        out.push(char::from_u32(scalar).ok_or("invalid unicode scalar")?);
                    }
                    other => return Err(format!("unknown escape \\{}", other)),
                }
            }
            c if (c as u32) < 0x20 => return Err("unescaped control character".into()),
            c => out.push(c),
        }
    }
    Err("unterminated string".to_string())
}

fn parse_array(chars: &[char], pos: &mut usize) -> Result<Json, String> {
    *pos += 1;
    let mut items = Vec::new();
    skip_ws(chars, pos);
    if chars.get(*pos) == Some(&']') {
        *pos += 1;
        return Ok(Json::Array(items));
    }
    loop {
        items.push(parse_value(chars, pos)?);
        skip_ws(chars, pos);
        match chars.get(*pos) {
            Some(',') => *pos += 1,
            Some(']') => {
                *pos += 1;
                return Ok(Json::Array(items));
            }
            _ => return Err(format!("expected , or ] at {}", pos)),
        }
    }
}

fn parse_object(chars: &[char], pos: &mut usize) -> Result<Json, String> {
    *pos += 1;
    let mut pairs = Vec::new();
    skip_ws(chars, pos);
    if chars.get(*pos) == Some(&'}') {
        *pos += 1;
        return Ok(Json::Object(pairs));
    }
    loop {
        skip_ws(chars, pos);
        if chars.get(*pos) != Some(&'"') {
            return Err(format!("expected a key at {}", pos));
        }
        let key = parse_string(chars, pos)?;
        skip_ws(chars, pos);
        if chars.get(*pos) != Some(&':') {
            return Err(format!("expected : at {}", pos));
        }
        *pos += 1;
        let value = parse_value(chars, pos)?;
        pairs.push((key, value));
        skip_ws(chars, pos);
        match chars.get(*pos) {
            Some(',') => *pos += 1,
            Some('}') => {
                *pos += 1;
                return Ok(Json::Object(pairs));
            }
            _ => return Err(format!("expected , or }} at {}", pos)),
        }
    }
}

pub fn json_string(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 2);
    out.push('"');
    for c in text.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}
