// Lesson: BPE Tokenizer from Scratch (phase 19 / lesson 30)
// Rust port of code/main.py. Standard library only.
// Source: phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

use std::collections::HashMap;

const BYTE_ALPHABET_SIZE: usize = 256;
const DEFAULT_SPECIALS: [&str; 2] = ["<|endoftext|>", "<|pad|>"];

type Pair = (u32, u32);

#[derive(Default)]
struct BpeTokenizer {
    vocab: Vec<Vec<u8>>,
    inv_vocab: HashMap<Vec<u8>, u32>,
    merges: Vec<(Pair, u32)>,
    merge_lookup: HashMap<Pair, u32>,
    special_to_id: Vec<(String, u32)>,
    id_to_special: HashMap<u32, String>,
}

impl BpeTokenizer {
    fn vocab_size(&self) -> usize {
        self.vocab.len()
    }

    fn add_token(&mut self, token_bytes: Vec<u8>) -> u32 {
        if let Some(&id) = self.inv_vocab.get(&token_bytes) {
            return id;
        }
        let token_id = self.vocab.len() as u32;
        self.inv_vocab.insert(token_bytes.clone(), token_id);
        self.vocab.push(token_bytes);
        token_id
    }

    fn initialize(&mut self, specials: &[&str]) {
        *self = BpeTokenizer::default();
        for i in 0..BYTE_ALPHABET_SIZE {
            self.add_token(vec![i as u8]);
        }
        for s in specials {
            let token_id = self.vocab.len() as u32;
            self.vocab.push(s.as_bytes().to_vec());
            self.inv_vocab.insert(s.as_bytes().to_vec(), token_id);
            self.special_to_id.push((s.to_string(), token_id));
            self.id_to_special.insert(token_id, s.to_string());
        }
    }

    fn add_merge(&mut self, pair: Pair, new_id: u32) {
        self.merges.push((pair, new_id));
        self.merge_lookup.insert(pair, new_id);
    }

    fn special_id(&self, s: &str) -> Option<u32> {
        self.special_to_id.iter().find(|(k, _)| k == s).map(|(_, v)| *v)
    }
}

fn is_py_space(c: char) -> bool {
    c.is_whitespace() || ('\u{1c}'..='\u{1f}').contains(&c)
}

fn pretokenize(text: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut start = 0;
    let mut current: Option<bool> = None;
    for (i, c) in text.char_indices() {
        let space = is_py_space(c);
        match current {
            Some(kind) if kind != space => {
                out.push(&text[start..i]);
                start = i;
            }
            _ => {}
        }
        current = Some(space);
    }
    if start < text.len() {
        out.push(&text[start..]);
    }
    out
}

fn word_to_byte_ids(word: &str) -> Vec<u32> {
    word.bytes().map(u32::from).collect()
}

fn count_pairs(corpus_units: &HashMap<Vec<u32>, usize>) -> HashMap<Pair, usize> {
    let mut pairs: HashMap<Pair, usize> = HashMap::new();
    for (symbols, count) in corpus_units {
        for w in symbols.windows(2) {
            *pairs.entry((w[0], w[1])).or_insert(0) += count;
        }
    }
    pairs
}

fn apply_merge(symbols: &[u32], pair: Pair, new_id: u32) -> Vec<u32> {
    if symbols.len() < 2 {
        return symbols.to_vec();
    }
    let mut out = Vec::with_capacity(symbols.len());
    let mut i = 0;
    while i < symbols.len() {
        if i < symbols.len() - 1 && symbols[i] == pair.0 && symbols[i + 1] == pair.1 {
            out.push(new_id);
            i += 2;
        } else {
            out.push(symbols[i]);
            i += 1;
        }
    }
    out
}

fn train(tokenizer: &mut BpeTokenizer, corpus: &str, target_vocab_size: usize, specials: &[&str]) {
    tokenizer.initialize(specials);
    let mut units = build_initial_units(corpus);
    while tokenizer.vocab_size() < target_vocab_size {
        let pairs = count_pairs(&units);
        if pairs.is_empty() {
            break;
        }
        let max_count = *pairs.values().max().unwrap();
        let best = pairs.iter().filter(|(_, &c)| c == max_count).map(|(&p, _)| p).min().unwrap();
        if pairs[&best] < 2 {
            break;
        }
        let mut merged = tokenizer.vocab[best.0 as usize].clone();
        merged.extend_from_slice(&tokenizer.vocab[best.1 as usize]);
        let new_id = tokenizer.add_token(merged);
        tokenizer.add_merge(best, new_id);
        units = apply_merge_to_corpus(&units, best, new_id);
    }
}

fn build_initial_units(corpus: &str) -> HashMap<Vec<u32>, usize> {
    let mut units = HashMap::new();
    for chunk in pretokenize(corpus) {
        *units.entry(word_to_byte_ids(chunk)).or_insert(0) += 1;
    }
    units
}

fn apply_merge_to_corpus(units: &HashMap<Vec<u32>, usize>, pair: Pair, new_id: u32) -> HashMap<Vec<u32>, usize> {
    let mut new_units = HashMap::new();
    for (symbols, count) in units {
        *new_units.entry(apply_merge(symbols, pair, new_id)).or_insert(0) += count;
    }
    new_units
}

fn encode_chunk(tokenizer: &BpeTokenizer, chunk: &str) -> Vec<u32> {
    let mut symbols = word_to_byte_ids(chunk);
    if symbols.len() < 2 {
        return symbols;
    }
    let ranked: HashMap<Pair, usize> = tokenizer.merges.iter().enumerate().map(|(rank, (pair, _))| (*pair, rank)).collect();
    loop {
        let mut best: Option<(usize, usize, Pair)> = None;
        for i in 0..symbols.len() - 1 {
            let pair = (symbols[i], symbols[i + 1]);
            if let Some(&rank) = ranked.get(&pair) {
                if best.map_or(true, |(r, _, _)| rank < r) {
                    best = Some((rank, i, pair));
                }
            }
        }
        let Some((_, index, pair)) = best else { break };
        let new_id = tokenizer.merge_lookup[&pair];
        symbols.splice(index..index + 2, [new_id]);
    }
    symbols
}

fn encode(tokenizer: &BpeTokenizer, text: &str, allow_special: bool) -> Vec<u32> {
    if !allow_special || tokenizer.special_to_id.is_empty() {
        return encode_pretokenized(tokenizer, text);
    }
    let mut specials: Vec<&str> = tokenizer.special_to_id.iter().map(|(s, _)| s.as_str()).collect();
    specials.sort_by(|a, b| b.len().cmp(&a.len()));

    let mut parts: Vec<&str> = Vec::new();
    let mut start = 0;
    let mut i = 0;
    while i < text.len() {
        match specials.iter().find(|s| text[i..].starts_with(**s)) {
            Some(s) => {
                parts.push(&text[start..i]);
                parts.push(&text[i..i + s.len()]);
                i += s.len();
                start = i;
            }
            None => i += text[i..].chars().next().map_or(1, char::len_utf8),
        }
    }
    parts.push(&text[start..]);

    let mut out = Vec::new();
    for part in parts {
        if part.is_empty() {
            continue;
        }
        match tokenizer.special_id(part) {
            Some(id) => out.push(id),
            None => out.extend(encode_pretokenized(tokenizer, part)),
        }
    }
    out
}

fn encode_pretokenized(tokenizer: &BpeTokenizer, text: &str) -> Vec<u32> {
    pretokenize(text).into_iter().flat_map(|chunk| encode_chunk(tokenizer, chunk)).collect()
}

fn decode(tokenizer: &BpeTokenizer, ids: &[u32]) -> Result<String, String> {
    let mut pieces: Vec<u8> = Vec::new();
    for &token_id in ids {
        if let Some(s) = tokenizer.id_to_special.get(&token_id) {
            pieces.extend_from_slice(s.as_bytes());
            continue;
        }
        match tokenizer.vocab.get(token_id as usize) {
            Some(bytes) => pieces.extend_from_slice(bytes),
            None => return Err(format!("unknown token id: {}", token_id)),
        }
    }
    Ok(String::from_utf8_lossy(&pieces).into_owned())
}

fn demo_corpus() -> String {
    let base = "\
the quick brown fox jumps over the lazy dog
a journey of a thousand miles begins with a single step
the only way to do great work is to love what you do
the best time to plant a tree was twenty years ago
the second best time is now
practice is the bridge between intention and skill
small daily actions compound into large outcomes
read more than you write, write more than you talk
the map is not the territory and the menu is not the meal
what gets measured gets managed if the measurement is honest
the quick brown fox runs across the meadow at dawn
a small step today is better than a perfect plan tomorrow
courage is not the absence of fear it is action despite fear
the lazy dog sleeps under the old oak tree
every expert was once a beginner who refused to quit
focus is saying no to a hundred good ideas
the river that you cannot cross today will be easier tomorrow
practice the basics until the basics become invisible
";
    base.repeat(6)
}

fn print_section(title: &str) {
    println!("\n{}\n{}", title, "-".repeat(title.chars().count()));
}

fn format_byte_token(token_bytes: &[u8]) -> String {
    match std::str::from_utf8(token_bytes) {
        Ok(s) => s.replace('\n', "\\n").replace(' ', "·"),
        Err(_) => token_bytes.iter().map(|b| format!("{:02x}", b)).collect(),
    }
}

fn py_repr(s: &str) -> String {
    let quote = if s.contains('\'') && !s.contains('"') { '"' } else { '\'' };
    let mut out = String::new();
    out.push(quote);
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if c == quote => {
                out.push('\\');
                out.push(c);
            }
            c => out.push(c),
        }
    }
    out.push(quote);
    out
}

fn main() {
    let target = 320;
    let mut tokenizer = BpeTokenizer::default();
    train(&mut tokenizer, &demo_corpus(), target, &DEFAULT_SPECIALS);

    print_section("Vocabulary summary");
    println!("target size       : {}", target);
    println!("final vocab size  : {}", tokenizer.vocab_size());
    println!("merges learned    : {}", tokenizer.merges.len());
    let specials: Vec<String> = tokenizer.special_to_id.iter().map(|(s, _)| py_repr(s)).collect();
    println!("special tokens    : [{}]", specials.join(", "));

    let held_out = "the fox is quick and the dog is lazy";
    let ids = encode(&tokenizer, held_out, false);
    let roundtrip = decode(&tokenizer, &ids).expect("decode");

    print_section("Encoding a held-out sentence");
    println!("input             : {}", py_repr(held_out));
    println!("encoded ids       : {:?}", ids);
    println!("id count          : {} (vs {} raw bytes)", ids.len(), held_out.len());
    println!("decoded back      : {}", py_repr(&roundtrip));
    assert_eq!(roundtrip, held_out, "round trip must be lossless");

    print_section("Highest-rank learned merges");
    for (rank, (pair, new_id)) in tokenizer.merges.iter().take(8).enumerate() {
        let left = format_byte_token(&tokenizer.vocab[pair.0 as usize]);
        let right = format_byte_token(&tokenizer.vocab[pair.1 as usize]);
        let merged = format_byte_token(&tokenizer.vocab[*new_id as usize]);
        println!("  rank {:>2}: ({:>8}, {:>8}) -> {}", rank, left, right, merged);
    }

    print_section("Special-token handling");
    let with_specials = "doc one<|endoftext|>doc two";
    let ids_special = encode(&tokenizer, with_specials, true);
    assert!(ids_special.contains(&tokenizer.special_id("<|endoftext|>").unwrap()));
    println!("input             : {}", py_repr(with_specials));
    println!("encoded ids       : {:?}", ids_special);
    println!("decoded back      : {}", py_repr(&decode(&tokenizer, &ids_special).expect("decode")));

    println!("\nDemo OK.");
}
