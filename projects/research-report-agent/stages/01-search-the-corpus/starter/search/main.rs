pub const STOPWORDS: &[&str] = &[
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from", "has",
    "have", "how", "if", "in", "into", "is", "it", "its", "not", "of", "on", "or", "so", "such",
    "that", "the", "their", "them", "then", "there", "these", "this", "to", "was", "what", "when",
    "where", "which", "while", "who", "why", "will", "with", "you", "your",
];

use std::fs;
use std::io::{self, BufRead, Write};
use std::path::Path;
// Stage 1: implement the Rust search engine.
// Lesson: projects/research-report-agent/stages/01-search-the-corpus/docs/en.md
// JSON requests enter stdin; JSON replies leave stdout. RFC 8259 defines strings.
// Python's search adapter must call this binary, rather than duplicate BM25.
use std::collections::BTreeMap;
#[derive(Debug, Clone, PartialEq)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub source_url: String,
    pub published: String,
    pub text: String,
}
mod wire;
pub use wire::{json_string, parse_json, Json};
pub struct Index {
    pub documents: Vec<Document>,
}
pub fn tokenize(_: &str) -> Vec<String> {
    unimplemented!("Stage 1: implement Rust tokenizer")
}
pub fn parse_document(_: &str, _: &str) -> Result<Document, String> {
    unimplemented!("Stage 1: implement corpus parser")
}
pub fn handle_line(_: &Index, _: &str) -> String {
    unimplemented!("Stage 1: implement request handler")
}
impl Index {
    pub fn new(_: Vec<Document>) -> Self {
        unimplemented!("Stage 1: implement BM25 index")
    }
    pub fn search(&self, _: &str, _: usize) -> Vec<(String, f64)> {
        unimplemented!("Stage 1: implement ranking")
    }
    pub fn idf_table(&self) -> BTreeMap<String, f64> {
        unimplemented!("Stage 1: implement IDF table")
    }
}
pub fn load_corpus(dir: &Path) -> Result<Vec<Document>, String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("corpus directory not found: {} ({})", dir.display(), e))?;
    let mut paths: Vec<_> = entries
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().map(|x| x == "md").unwrap_or(false))
        .collect();
    paths.sort();
    let mut docs = Vec::new();
    for path in paths {
        let id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        let raw = fs::read_to_string(&path).map_err(|e| format!("{}: {}", path.display(), e))?;
        docs.push(parse_document(&id, &raw)?);
    }
    Ok(docs)
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
        if writeln!(stdout, "{}", reply)
            .and_then(|_| stdout.flush())
            .is_err()
        {
            break;
        }
    }
}
