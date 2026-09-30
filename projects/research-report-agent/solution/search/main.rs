// Research Report Agent, stage 1: the corpus search engine.
// Lesson: projects/research-report-agent/stages/01-search-the-corpus/docs/en.md
// Loads a folder of markdown documents, builds a BM25 index, and answers one JSON
// request per line on stdin with one JSON line on stdout. Stdlib only.
// Build: rustc --edition 2021 -O main.rs -o rra-search   Run: ./rra-search <corpus_dir>

use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::Path;

pub const STOPWORDS: &[&str] = &[
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from", "has",
    "have", "how", "if", "in", "into", "is", "it", "its", "not", "of", "on", "or", "so", "such",
    "that", "the", "their", "them", "then", "there", "these", "this", "to", "was", "what", "when",
    "where", "which", "while", "who", "why", "will", "with", "you", "your",
];

#[derive(Debug, Clone, PartialEq)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub source_url: String,
    pub published: String,
    pub text: String,
}

pub fn tokenize(text: &str) -> Vec<String> {
    let lower = text.to_lowercase();
    let mut tokens = Vec::new();
    let mut current = String::new();
    for ch in lower.chars() {
        if ch.is_ascii_lowercase() || ch.is_ascii_digit() {
            current.push(ch);
        } else if !current.is_empty() {
            tokens.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens.retain(|t| !STOPWORDS.contains(&t.as_str()));
    tokens
}

pub fn parse_document(id: &str, raw: &str) -> Result<Document, String> {
    let mut header: HashMap<String, String> = HashMap::new();
    let lines: Vec<&str> = raw.lines().collect();
    let mut index = 0;
    while index < lines.len() && !lines[index].trim().is_empty() {
        match lines[index].split_once(':') {
            Some((key, value)) => {
                header.insert(key.trim().to_lowercase(), value.trim().to_string());
                index += 1;
            }
            None => break,
        }
    }
    let mut missing = Vec::new();
    for key in ["title", "source_url", "published"] {
        if !header.contains_key(key) {
            missing.push(key);
        }
    }
    if !missing.is_empty() {
        return Err(format!("{}: missing header keys {:?}", id, missing));
    }
    let body = lines[index..].join("\n").trim().to_string();
    Ok(Document {
        id: id.to_string(),
        title: header["title"].clone(),
        source_url: header["source_url"].clone(),
        published: header["published"].clone(),
        text: body,
    })
}

pub fn load_corpus(dir: &Path) -> Result<Vec<Document>, String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("corpus directory not found: {} ({})", dir.display(), e))?;
    let mut paths: Vec<_> = entries
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().map(|x| x == "md").unwrap_or(false))
        .collect();
    paths.sort();
    let mut docs = Vec::new();
    for path in paths {
        let id = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
        let raw = fs::read_to_string(&path).map_err(|e| format!("{}: {}", path.display(), e))?;
        docs.push(parse_document(&id, &raw)?);
    }
    Ok(docs)
}

#[derive(Clone)]
pub struct Index {
    pub documents: Vec<Document>,
    pub k1: f64,
    pub b: f64,
    term_counts: Vec<HashMap<String, usize>>,
    lengths: Vec<usize>,
    avg_length: f64,
    idf: HashMap<String, f64>,
}

impl Index {
    pub fn new(documents: Vec<Document>) -> Index {
        let mut term_counts = Vec::new();
        let mut lengths = Vec::new();
        let mut doc_freq: HashMap<String, usize> = HashMap::new();
        for doc in &documents {
            let mut counts: HashMap<String, usize> = HashMap::new();
            for token in tokenize(&format!("{} {}", doc.title, doc.text)) {
                *counts.entry(token).or_insert(0) += 1;
            }
            lengths.push(counts.values().sum());
            for term in counts.keys() {
                *doc_freq.entry(term.clone()).or_insert(0) += 1;
            }
            term_counts.push(counts);
        }
        let total = documents.len() as f64;
        let avg_length = if lengths.is_empty() { 0.0 } else { lengths.iter().sum::<usize>() as f64 / lengths.len() as f64 };
        let idf = doc_freq
            .into_iter()
            .map(|(term, df)| {
                let df = df as f64;
                (term, (1.0 + (total - df + 0.5) / (df + 0.5)).ln())
            })
            .collect();
        Index { documents, k1: 1.5, b: 0.75, term_counts, lengths, avg_length, idf }
    }

    pub fn idf(&self, term: &str) -> f64 {
        *self.idf.get(term).unwrap_or(&0.0)
    }

    pub fn idf_table(&self) -> BTreeMap<String, f64> {
        self.idf.iter().map(|(k, v)| (k.clone(), *v)).collect()
    }

    pub fn score(&self, query_tokens: &[String], position: usize) -> f64 {
        let counts = &self.term_counts[position];
        let length = self.lengths[position] as f64;
        let mut total = 0.0;
        for term in query_tokens {
            let freq = *counts.get(term).unwrap_or(&0) as f64;
            if freq == 0.0 {
                continue;
            }
            let norm = freq + self.k1 * (1.0 - self.b + self.b * length / self.avg_length);
            total += self.idf(term) * freq * (self.k1 + 1.0) / norm;
        }
        total
    }

    pub fn search(&self, query: &str, k: usize) -> Vec<(String, f64)> {
        let query_tokens = tokenize(query);
        let mut scored: Vec<(String, f64)> = Vec::new();
        for (position, doc) in self.documents.iter().enumerate() {
            let value = self.score(&query_tokens, position);
            if value > 0.0 {
                scored.push((doc.id.clone(), value));
            }
        }
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap().then_with(|| a.0.cmp(&b.0)));
        scored.truncate(k);
        scored
    }
}

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
    if input.len() > 65536 { return Err("request too large".into()); }
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
    if chars.get(*pos) == Some(&'-') { *pos += 1; }
    match chars.get(*pos) {
        Some('0') => *pos += 1,
        Some('1'..='9') => while chars.get(*pos).map_or(false, |c| c.is_ascii_digit()) { *pos += 1; },
        _ => return Err("expected number digits".into()),
    }
    if chars.get(*pos) == Some(&'.') {
        *pos += 1;
        let digits = *pos;
        while chars.get(*pos).map_or(false, |c| c.is_ascii_digit()) { *pos += 1; }
        if *pos == digits { return Err("fraction needs digits".into()); }
    }
    if matches!(chars.get(*pos), Some('e' | 'E')) {
        *pos += 1;
        if matches!(chars.get(*pos), Some('+' | '-')) { *pos += 1; }
        let digits = *pos;
        while chars.get(*pos).map_or(false, |c| c.is_ascii_digit()) { *pos += 1; }
        if *pos == digits { return Err("exponent needs digits".into()); }
    }
    let text: String = chars[start..*pos].iter().collect();
    let value = text.parse::<f64>().map_err(|_| "invalid number")?;
    if !value.is_finite() { return Err("number out of range".into()); }
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
                        let hex: String = chars.get(*pos..*pos + 4).ok_or("short unicode escape")?.iter().collect();
                        *pos += 4;
                        let code = u32::from_str_radix(&hex, 16).map_err(|_| "bad unicode escape")?;
                        let scalar = if (0xd800..=0xdbff).contains(&code) {
                            if chars.get(*pos..*pos + 2) != Some(&['\\', 'u'][..]) {
                                return Err("missing low surrogate".into());
                            }
                            *pos += 2;
                            let low_hex: String = chars.get(*pos..*pos + 4).ok_or("short low surrogate")?.iter().collect();
                            *pos += 4;
                            let low = u32::from_str_radix(&low_hex, 16).map_err(|_| "bad low surrogate")?;
                            if !(0xdc00..=0xdfff).contains(&low) { return Err("invalid low surrogate".into()); }
                            0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00)
                        } else { code };
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

fn doc_json(doc: &Document) -> String {
    format!(
        "{{\"doc_id\":{},\"title\":{},\"source_url\":{},\"published\":{},\"text\":{}}}",
        json_string(&doc.id),
        json_string(&doc.title),
        json_string(&doc.source_url),
        json_string(&doc.published),
        json_string(&doc.text)
    )
}

fn error_json(message: &str) -> String {
    format!("{{\"error\":{}}}", json_string(message))
}

pub fn handle_line(index: &Index, line: &str) -> String {
    let request = match parse_json(line) {
        Ok(value @ Json::Object(_)) => value,
        Ok(_) => return error_json("request must be a JSON object"),
        Err(e) => return error_json(&format!("bad json: {}", e)),
    };
    let mut index = index.clone();
    if let Some(value) = request.get("k1") {
        match value { Json::Number(n) if *n > 0.0 => index.k1 = *n, _ => return error_json("k1 must be positive") }
    }
    if let Some(value) = request.get("b") {
        match value { Json::Number(n) if (0.0..=1.0).contains(n) => index.b = *n, _ => return error_json("b must be between 0 and 1") }
    }
    let cmd = match request.get("cmd") {
        Some(Json::Str(s)) => s.as_str(),
        Some(_) => return error_json("cmd must be a string"),
        None => "search",
    };
    match cmd {
        "search" => {
            let query = match request.get("query") {
                Some(Json::Str(q)) => q.clone(),
                _ => return error_json("search needs a string query"),
            };
            let k = match request.get("k") {
                Some(Json::Number(n)) if *n >= 0.0 && n.fract() == 0.0 && *n <= 10000.0 => *n as usize,
                None => 5,
                _ => return error_json("k must be an integer between 0 and 10000"),
            };
            let results: Vec<String> = index
                .search(&query, k)
                .iter()
                .map(|(id, score)| format!("{{\"doc_id\":{},\"score\":{}}}", json_string(id), score))
                .collect();
            format!("{{\"results\":[{}]}}", results.join(","))
        }
        "score" => {
            let query = match request.get("query") { Some(Json::Str(s)) => s, _ => return error_json("score needs query") };
            let position = match request.get("position") {
                Some(Json::Number(n)) if *n >= 0.0 && n.fract() == 0.0 && *n < index.documents.len() as f64 => *n as usize,
                _ => return error_json("invalid document position"),
            };
            format!("{{\"score\":{}}}", index.score(&tokenize(query), position))
        }
        "doc" => {
            let id = match request.get("doc_id") {
                Some(Json::Str(s)) => s,
                _ => return error_json("doc needs a string doc_id"),
            };
            match index.documents.iter().find(|d| &d.id == id) {
                Some(doc) => doc_json(doc),
                None => error_json(&format!("unknown doc_id {}", id)),
            }
        }
        "docs" => {
            let docs: Vec<String> = index.documents.iter().map(doc_json).collect();
            format!("{{\"docs\":[{}]}}", docs.join(","))
        }
        "idf" => {
            let pairs: Vec<String> = index.idf_table().iter().map(|(t, v)| format!("{}:{}", json_string(t), v)).collect();
            format!("{{\"idf\":{{{}}}}}", pairs.join(","))
        }
        "tokenize" => {
            let text = match request.get("text") {
                Some(Json::Str(s)) => s,
                _ => return error_json("tokenize needs a string text"),
            };
            let tokens: Vec<String> = tokenize(text).iter().map(|t| json_string(t)).collect();
            format!("{{\"tokens\":[{}]}}", tokens.join(","))
        }
        other => error_json(&format!("unknown cmd {}", other)),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 2 {
        eprintln!("usage: rra-search <corpus_dir>");
        std::process::exit(2);
    }
    let documents = match load_corpus(Path::new(&args[1])) {
        Ok(docs) => docs,
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    };
    let index = Index::new(documents);
    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        if line.trim().is_empty() {
            continue;
        }
        let reply = handle_line(&index, &line);
        if writeln!(stdout, "{}", reply).and_then(|_| stdout.flush()).is_err() {
            break;
        }
    }
}
