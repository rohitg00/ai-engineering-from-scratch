use std::collections::HashMap;

struct BPETokenizer {
    merges: Vec<((u32, u32), u32)>,
    vocab: HashMap<u32, Vec<u8>>,
}

impl BPETokenizer {
    fn new() -> Self {
        let mut vocab = HashMap::new();
        for i in 0u32..256 {
            vocab.insert(i, vec![i as u8]);
        }
        BPETokenizer {
            merges: Vec::new(),
            vocab,
        }
    }

    fn get_pairs(tokens: &[u32]) -> HashMap<(u32, u32), usize> {
        let mut pairs = HashMap::new();
        for window in tokens.windows(2) {
            *pairs.entry((window[0], window[1])).or_insert(0) += 1;
        }
        pairs
    }

    fn merge_pair(tokens: &[u32], pair: (u32, u32), new_token: u32) -> Vec<u32> {
        let mut merged = Vec::with_capacity(tokens.len());
        let mut i = 0;
        while i < tokens.len() {
            if i < tokens.len() - 1 && tokens[i] == pair.0 && tokens[i + 1] == pair.1 {
                merged.push(new_token);
                i += 2;
            } else {
                merged.push(tokens[i]);
                i += 1;
            }
        }
        merged
    }

    fn train(&mut self, text: &str, num_merges: usize) {
        let mut tokens: Vec<u32> = text.as_bytes().iter().map(|&b| b as u32).collect();

        for i in 0..num_merges {
            let pairs = Self::get_pairs(&tokens);
            if pairs.is_empty() {
                break;
            }

            let best_pair = *pairs.iter().max_by_key(|&(_, count)| count).unwrap().0;
            let new_token = 256 + i as u32;

            tokens = Self::merge_pair(&tokens, best_pair, new_token);

            let mut new_bytes = self.vocab[&best_pair.0].clone();
            new_bytes.extend_from_slice(&self.vocab[&best_pair.1]);

            let display = String::from_utf8_lossy(&new_bytes);
            println!(
                "Merge {}: ({}, {}) -> {} = {:?}",
                i + 1,
                best_pair.0,
                best_pair.1,
                new_token,
                display
            );

            self.vocab.insert(new_token, new_bytes);
            self.merges.push((best_pair, new_token));
        }
    }

    fn encode(&self, text: &str) -> Vec<u32> {
        let mut tokens: Vec<u32> = text.as_bytes().iter().map(|&b| b as u32).collect();
        for &(pair, new_token) in &self.merges {
            tokens = Self::merge_pair(&tokens, pair, new_token);
        }
        tokens
    }

    fn decode(&self, tokens: &[u32]) -> String {
        let bytes: Vec<u8> = tokens
            .iter()
            .flat_map(|&t| self.vocab.get(&t).cloned().unwrap_or_else(|| vec![b'?']))
            .collect();
        String::from_utf8_lossy(&bytes).into_owned()
    }

    fn vocab_size(&self) -> usize {
        self.vocab.len()
    }
}

fn main() {
    let corpus = concat!(
        "The cat sat on the mat. The cat ate the rat. ",
        "The dog sat on the log. The dog ate the frog. ",
        "Natural language processing is the study of how computers ",
        "understand and generate human language."
    );

    println!("{}", "=".repeat(60));
    println!("Training BPE tokenizer");
    println!("{}", "=".repeat(60));

    let mut tokenizer = BPETokenizer::new();
    tokenizer.train(corpus, 30);

    println!("\nVocabulary size: {}", tokenizer.vocab_size());

    let test_sentences = vec![
        "The cat sat on the mat.",
        "The frog sat on the log.",
        "language processing",
        "unhappiness",
    ];

    println!("\n{}", "=".repeat(60));
    println!("Encoding test sentences");
    println!("{}", "=".repeat(60));

    for sentence in test_sentences {
        let encoded = tokenizer.encode(sentence);
        let decoded = tokenizer.decode(&encoded);
        let raw_bytes = sentence.len();

        println!("\nOriginal:  {}", sentence);
        println!("Encoded:   {:?}", encoded);
        println!("Decoded:   {}", decoded);
        println!("Tokens:    {} (from {} bytes)", encoded.len(), raw_bytes);
        println!("Ratio:     {:.2}", encoded.len() as f64 / raw_bytes as f64);
    }

    println!("\n{}", "=".repeat(60));
    println!("Performance: encode 100K iterations");
    println!("{}", "=".repeat(60));

    let test = "The cat sat on the mat and the dog sat on the log.";
    let start = std::time::Instant::now();
    for _ in 0..100_000 {
        let _ = tokenizer.encode(test);
    }
    let elapsed = start.elapsed();
    println!(
        "100K encodes in {:.2}ms ({:.0} encodes/sec)",
        elapsed.as_secs_f64() * 1000.0,
        100_000.0 / elapsed.as_secs_f64()
    );
}
