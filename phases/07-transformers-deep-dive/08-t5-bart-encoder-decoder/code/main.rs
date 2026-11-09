// Lesson: T5, BART: Encoder-Decoder Models (phase 07 / lesson 08)
// Rust port of code/main.py. Standard library only.
// Source: phases/07-transformers-deep-dive/08-t5-bart-encoder-decoder/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

use std::collections::HashMap;

struct Rng {
    state: u64,
    spare: Option<f64>,
}

impl Rng {
    fn new(seed: u64) -> Self {
        let mut rng = Rng { state: seed, spare: None };
        rng.state = rng.next_u64();
        rng
    }

    fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    fn random(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    fn randrange(&mut self, lo: usize, hi: usize) -> usize {
        lo + (self.random() * (hi - lo) as f64) as usize
    }

    fn gauss(&mut self, mu: f64, sigma: f64) -> f64 {
        if let Some(z) = self.spare.take() {
            return mu + sigma * z;
        }
        let mut u1 = self.random();
        while u1 <= f64::MIN_POSITIVE {
            u1 = self.random();
        }
        let u2 = self.random();
        let r = (-2.0 * u1.ln()).sqrt();
        let theta = 2.0 * std::f64::consts::PI * u2;
        self.spare = Some(r * theta.sin());
        mu + sigma * r * theta.cos()
    }

    fn shuffle<T>(&mut self, items: &mut [T]) {
        for i in (1..items.len()).rev() {
            let j = self.randrange(0, i + 1);
            items.swap(i, j);
        }
    }
}

fn sentinel(i: usize) -> String {
    format!("<extra_id_{}>", i)
}

fn corrupt_spans(tokens: &[String], mask_rate: f64, mean_span: f64, rng: &mut Rng) -> (Vec<String>, Vec<String>) {
    let n = tokens.len();
    let n_mask = 1.max((n as f64 * mask_rate).round_ties_even() as i64);
    let n_spans = 1.max((n_mask as f64 / mean_span).round_ties_even() as i64);
    let mut positions: Vec<usize> = (0..n).collect();
    rng.shuffle(&mut positions);
    let mut starts: Vec<usize> = Vec::new();
    let mut used = vec![false; n];
    let mut span_lengths: Vec<usize> = Vec::new();
    let mut remaining = n_mask;
    for _ in 0..n_spans {
        if remaining <= 0 {
            break;
        }
        let mut random_order: Vec<usize> = (0..n).collect();
        rng.shuffle(&mut random_order);
        let mut chosen_start = None;
        for &start in &random_order {
            if used[start] {
                continue;
            }
            let length = 1.max(rng.gauss(mean_span, 1.0) as i64);
            let length = length.min(remaining).min((n - start) as i64);
            if length < 1 {
                continue;
            }
            let length = length as usize;
            if (start..start + length).any(|i| used[i]) {
                continue;
            }
            chosen_start = Some(start);
            for flag in used.iter_mut().skip(start).take(length) {
                *flag = true;
            }
            starts.push(start);
            span_lengths.push(length);
            remaining -= length as i64;
            break;
        }
        if chosen_start.is_none() {
            break;
        }
    }

    let mut ordered: Vec<(usize, usize)> = starts.into_iter().zip(span_lengths).collect();
    ordered.sort_by_key(|x| x.0);

    let mut source: Vec<String> = Vec::new();
    let mut target: Vec<String> = Vec::new();
    let mut prev_end = 0;
    for (idx, &(start, length)) in ordered.iter().enumerate() {
        source.extend_from_slice(&tokens[prev_end..start]);
        source.push(sentinel(idx));
        target.push(sentinel(idx));
        target.extend_from_slice(&tokens[start..start + length]);
        prev_end = start + length;
    }
    source.extend_from_slice(&tokens[prev_end..]);
    target.push(sentinel(ordered.len()));
    (source, target)
}

fn round_trip(source: &[String], target: &[String]) -> Vec<String> {
    let mut spans: HashMap<String, Vec<String>> = HashMap::new();
    let mut current_key: Option<String> = None;
    let mut current_span: Vec<String> = Vec::new();
    for tok in target {
        if tok.starts_with("<extra_id_") {
            if let Some(key) = current_key.take() {
                spans.insert(key, std::mem::take(&mut current_span));
            }
            current_key = Some(tok.clone());
            current_span = Vec::new();
        } else {
            current_span.push(tok.clone());
        }
    }
    let mut out = Vec::new();
    for tok in source {
        if tok.starts_with("<extra_id_") {
            if let Some(span) = spans.get(tok) {
                out.extend_from_slice(span);
            }
        } else {
            out.push(tok.clone());
        }
    }
    out
}

fn token_mask(tokens: &[String], rate: f64, rng: &mut Rng, mask_token: &str) -> Vec<String> {
    tokens
        .iter()
        .map(|t| if rng.random() < rate { mask_token.to_string() } else { t.clone() })
        .collect()
}

fn token_delete(tokens: &[String], rate: f64, rng: &mut Rng) -> Vec<String> {
    tokens.iter().filter(|_| rng.random() >= rate).cloned().collect()
}

fn text_infill(tokens: &[String], rate: f64, mean_span: f64, rng: &mut Rng, mask_token: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut i = 0;
    let n = tokens.len();
    let mut budget = (n as f64 * rate) as i64;
    while i < n {
        if budget > 0 && rng.random() < 0.3 {
            let g = rng.gauss(mean_span, 1.0) as i64;
            let span_len = 1.max(g.min(budget).min((n - i) as i64));
            out.push(mask_token.to_string());
            budget -= span_len;
            i += span_len as usize;
        } else {
            out.push(tokens[i].clone());
            i += 1;
        }
    }
    out
}

fn sentence_permute(sentences: &[Vec<String>], rng: &mut Rng) -> Vec<Vec<String>> {
    let mut sents = sentences.to_vec();
    rng.shuffle(&mut sents);
    sents
}

fn document_rotate(tokens: &[String], rng: &mut Rng) -> Vec<String> {
    if tokens.len() <= 1 {
        return tokens.to_vec();
    }
    let pivot = rng.randrange(1, tokens.len());
    let mut out = tokens[pivot..].to_vec();
    out.extend_from_slice(&tokens[..pivot]);
    out
}

fn words(s: &str) -> Vec<String> {
    s.split_whitespace().map(String::from).collect()
}

fn main() {
    let mut rng = Rng::new(42);

    let sentence = words(
        "the quick brown fox jumps over the lazy dog a stitch in time saves nine \
         language models learn statistical patterns subword tokenization helps rare words",
    );

    println!("=== T5 span corruption ===");
    let (source, target) = corrupt_spans(&sentence, 0.20, 3.0, &mut rng);
    println!("corrupted source:");
    println!("  {}", source.join(" "));
    println!();
    println!("decoder target:");
    println!("  {}", target.join(" "));
    println!();
    let reconstructed = round_trip(&source, &target);
    println!(
        "reconstruction matches original: {}",
        if reconstructed == sentence { "YES" } else { "NO" }
    );
    if reconstructed != sentence {
        println!("  reconstructed: {}", reconstructed.join(" "));
    }

    println!();
    println!("=== BART noise functions ===");
    let head = &sentence[..14];
    println!("original: {}", head.join(" "));
    println!();
    println!("token mask:     {}", token_mask(head, 0.2, &mut Rng::new(1), "<mask>").join(" "));
    println!("token delete:   {}", token_delete(head, 0.2, &mut Rng::new(2)).join(" "));
    println!("text infill:    {}", text_infill(head, 0.3, 3.0, &mut Rng::new(3), "<mask>").join(" "));

    let sentences = vec![
        words("the quick brown fox"),
        words("a stitch in time"),
        words("language models learn patterns"),
    ];
    let perm = sentence_permute(&sentences, &mut Rng::new(4));
    println!("sentence permute:");
    for s in &perm {
        println!("  {}", s.join(" "));
    }

    println!();
    println!("document rotate: {}", document_rotate(head, &mut Rng::new(5)).join(" "));
}
