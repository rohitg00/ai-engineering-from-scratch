// Lesson: Subword Tokenization: BPE, WordPiece, Unigram, SentencePiece (phase 05 / lesson 19)
// Rust port of code/main.py. Standard library only.
// Source: phases/05-nlp-foundations-to-advanced/19-subword-tokenization/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

use std::collections::{BTreeSet, HashMap};

type Symbols = Vec<String>;

struct Ordered<K> {
    keys: Vec<K>,
    counts: Vec<usize>,
    index: HashMap<K, usize>,
}

impl<K: Clone + Eq + std::hash::Hash> Ordered<K> {
    fn new() -> Self {
        Ordered { keys: Vec::new(), counts: Vec::new(), index: HashMap::new() }
    }

    fn add(&mut self, key: K, amount: usize) {
        match self.index.get(&key) {
            Some(&i) => self.counts[i] += amount,
            None => {
                self.index.insert(key.clone(), self.keys.len());
                self.keys.push(key);
                self.counts.push(amount);
            }
        }
    }

    fn set(&mut self, key: K, value: usize) {
        match self.index.get(&key) {
            Some(&i) => self.counts[i] = value,
            None => self.add(key, value),
        }
    }

    fn most_common(&self) -> Option<&K> {
        let mut best: Option<usize> = None;
        for i in 0..self.keys.len() {
            if best.map_or(true, |b| self.counts[i] > self.counts[b]) {
                best = Some(i);
            }
        }
        best.map(|i| &self.keys[i])
    }

    fn len(&self) -> usize {
        self.keys.len()
    }
}

fn word_counts(text: &str) -> Ordered<String> {
    let mut counts = Ordered::new();
    let lower = text.to_lowercase();
    let mut current = String::new();
    for c in lower.chars() {
        if c.is_ascii_alphabetic() {
            current.push(c);
        } else if !current.is_empty() {
            counts.add(std::mem::take(&mut current), 1);
        }
    }
    if !current.is_empty() {
        counts.add(current, 1);
    }
    counts
}

fn init_vocab(counts: &Ordered<String>) -> Ordered<Symbols> {
    let mut vocab = Ordered::new();
    for (word, &freq) in counts.keys.iter().zip(&counts.counts) {
        let mut symbols: Symbols = word.chars().map(|c| c.to_string()).collect();
        symbols.push("</w>".to_string());
        vocab.set(symbols, freq);
    }
    vocab
}

fn pair_counts(vocab: &Ordered<Symbols>) -> Ordered<(String, String)> {
    let mut pairs = Ordered::new();
    for (symbols, &freq) in vocab.keys.iter().zip(&vocab.counts) {
        for w in symbols.windows(2) {
            pairs.add((w[0].clone(), w[1].clone()), freq);
        }
    }
    pairs
}

fn merge_pair(vocab: &Ordered<Symbols>, pair: &(String, String)) -> Ordered<Symbols> {
    let (a, b) = pair;
    let merged_symbol = format!("{}{}", a, b);
    let mut new_vocab = Ordered::new();
    for (symbols, &freq) in vocab.keys.iter().zip(&vocab.counts) {
        let mut new_symbols = Vec::new();
        let mut i = 0;
        while i < symbols.len() {
            if i < symbols.len() - 1 && &symbols[i] == a && &symbols[i + 1] == b {
                new_symbols.push(merged_symbol.clone());
                i += 2;
            } else {
                new_symbols.push(symbols[i].clone());
                i += 1;
            }
        }
        new_vocab.set(new_symbols, freq);
    }
    new_vocab
}

fn train_bpe(text: &str, num_merges: usize) -> (Vec<(String, String)>, Vec<String>) {
    let counts = word_counts(text);
    if counts.len() == 0 {
        panic!("word_counts: corpus produced no words");
    }
    let mut vocab = init_vocab(&counts);
    let mut merges = Vec::new();
    for _ in 0..num_merges {
        let pairs = pair_counts(&vocab);
        let best = match pairs.most_common() {
            Some(p) => p.clone(),
            None => break,
        };
        vocab = merge_pair(&vocab, &best);
        merges.push(best);
    }
    let mut final_tokens = BTreeSet::new();
    for symbols in &vocab.keys {
        for s in symbols {
            final_tokens.insert(s.clone());
        }
    }
    (merges, final_tokens.into_iter().collect())
}

fn encode_bpe(word: &str, merges: &[(String, String)]) -> Symbols {
    let mut symbols: Symbols = word.chars().map(|c| c.to_string()).collect();
    symbols.push("</w>".to_string());
    for (a, b) in merges {
        let merged = format!("{}{}", a, b);
        let mut i = 0;
        while i + 1 < symbols.len() {
            if &symbols[i] == a && &symbols[i + 1] == b {
                symbols.splice(i..i + 2, [merged.clone()]);
            } else {
                i += 1;
            }
        }
    }
    symbols
}

fn main() {
    let corpus = "
    the quick brown fox jumps over the lazy dog
    a stitch in time saves nine
    language models learn from statistical patterns in text
    tokenization splits text into smaller units called tokens
    subword tokenization lets rare words decompose into known pieces
    byte pair encoding is the dominant tokenization algorithm today
    the lazy dog slept while the fox jumped again and again
    patterns of letters in words are learnable and reusable
    ";

    let (merges_small, tokens_small) = train_bpe(corpus, 30);
    let (merges_big, tokens_big) = train_bpe(corpus, 150);

    println!("=== BPE, 30 merges ===");
    println!("vocab size: {}", tokens_small.len());
    println!("first 10 merges:");
    for (i, (a, b)) in merges_small.iter().take(10).enumerate() {
        println!("  {}: '{}' + '{}' -> '{}{}'", i, a, b, a, b);
    }

    println!();
    println!("=== BPE, 150 merges ===");
    println!("vocab size: {}", tokens_big.len());

    println!();
    let held_out = ["tokenizable", "unlearnable", "foxhound", "languages"];
    println!("=== encoding held-out words (150-merge model) ===");
    for word in held_out {
        let pieces = encode_bpe(word, &merges_big);
        let tag = if pieces.len() == 1 { "OK".to_string() } else { format!("split({})", pieces.len()) };
        println!("  {:<14} -> {}  [{}]", word, pieces.join(" | "), tag);
    }

    println!();
    println!("note: with a tiny toy corpus, most held-out words will split.");
    println!("production vocabularies train on billions of tokens.");
}
