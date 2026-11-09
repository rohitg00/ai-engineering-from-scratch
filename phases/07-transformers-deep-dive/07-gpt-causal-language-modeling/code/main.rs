// Lesson: GPT: Causal Language Modeling (phase 07 / lesson 07)
// Rust port of code/main.py. Standard library only.
// Source: phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

struct Rng {
    state: u64,
    spare: Option<f64>,
}

impl Rng {
    fn new(seed: u64) -> Self {
        Rng { state: seed, spare: None }
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
}

fn softmax(logits: &[f64], temperature: f64) -> Vec<f64> {
    let scaled: Vec<f64> = if temperature != 1.0 {
        logits.iter().map(|x| x / temperature).collect()
    } else {
        logits.to_vec()
    };
    let m = scaled.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let exps: Vec<f64> = scaled.iter().map(|x| (x - m).exp()).collect();
    let s: f64 = exps.iter().sum();
    exps.iter().map(|e| e / s).collect()
}

fn causal_mask(n: usize) -> Vec<Vec<f64>> {
    (0..n)
        .map(|i| (0..n).map(|j| if j <= i { 0.0 } else { f64::NEG_INFINITY }).collect())
        .collect()
}

fn attention_scores_with_mask(raw_scores: &[Vec<f64>], mask: &[Vec<f64>]) -> Vec<Vec<f64>> {
    raw_scores
        .iter()
        .zip(mask)
        .map(|(row, mrow)| row.iter().zip(mrow).map(|(s, m)| s + m).collect())
        .collect()
}

fn apply_softmax_row(row: &[f64]) -> Vec<f64> {
    let finite: Vec<f64> = row.iter().cloned().filter(|&x| x != f64::NEG_INFINITY).collect();
    if finite.is_empty() {
        return vec![0.0; row.len()];
    }
    let m = finite.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let exps: Vec<f64> = row
        .iter()
        .map(|&x| if x != f64::NEG_INFINITY { (x - m).exp() } else { 0.0 })
        .collect();
    let s: f64 = exps.iter().sum();
    exps.iter().map(|e| if s > 0.0 { e / s } else { 0.0 }).collect()
}

fn cross_entropy_shifted(logits_per_pos: &[Vec<f64>], target_ids: &[usize]) -> f64 {
    let mut total = 0.0;
    let mut count = 0;
    for i in 0..target_ids.len() - 1 {
        let probs = softmax(&logits_per_pos[i], 1.0);
        let p = probs[target_ids[i + 1]];
        total += -(p.max(1e-12)).ln();
        count += 1;
    }
    total / count as f64
}

fn sample_greedy(probs: &[f64]) -> usize {
    let mut best = 0;
    for i in 1..probs.len() {
        if probs[i] > probs[best] {
            best = i;
        }
    }
    best
}

fn sample_temperature(logits: &[f64], t: f64, rng: &mut Rng) -> usize {
    let probs = softmax(logits, t);
    sample_from_distribution(&probs, rng)
}

fn sample_from_distribution(probs: &[f64], rng: &mut Rng) -> usize {
    let r = rng.random();
    let mut cum = 0.0;
    for (i, p) in probs.iter().enumerate() {
        cum += p;
        if r <= cum {
            return i;
        }
    }
    probs.len() - 1
}

fn sorted_desc(values: &[f64]) -> Vec<(usize, f64)> {
    let mut indexed: Vec<(usize, f64)> = values.iter().cloned().enumerate().collect();
    indexed.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    indexed
}

fn sample_top_k(logits: &[f64], k: usize, rng: &mut Rng, temperature: f64) -> usize {
    let indexed = sorted_desc(logits);
    let keep = &indexed[..k.min(indexed.len())];
    let keep_ids: Vec<usize> = keep.iter().map(|&(i, _)| i).collect();
    let keep_logits: Vec<f64> = keep.iter().map(|&(_, v)| v).collect();
    let probs = softmax(&keep_logits, temperature);
    let chosen = sample_from_distribution(&probs, rng);
    keep_ids[chosen]
}

fn sample_renormed(kept: &[(usize, f64)], rng: &mut Rng) -> usize {
    let total: f64 = kept.iter().map(|&(_, pi)| pi).sum();
    let renorm: Vec<(usize, f64)> = kept.iter().map(|&(idx, pi)| (idx, pi / total)).collect();
    let r = rng.random();
    let mut cum = 0.0;
    for &(idx, pi) in &renorm {
        cum += pi;
        if r <= cum {
            return idx;
        }
    }
    renorm[renorm.len() - 1].0
}

fn sample_top_p(logits: &[f64], p: f64, rng: &mut Rng, temperature: f64) -> usize {
    let probs = softmax(logits, temperature);
    let indexed = sorted_desc(&probs);
    let mut cum = 0.0;
    let mut cutoff = indexed.len();
    for (i, &(_, pi)) in indexed.iter().enumerate() {
        cum += pi;
        if cum >= p {
            cutoff = i + 1;
            break;
        }
    }
    sample_renormed(&indexed[..cutoff], rng)
}

fn sample_min_p(logits: &[f64], min_p: f64, rng: &mut Rng, temperature: f64) -> usize {
    let probs = softmax(logits, temperature);
    let max_p = probs.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let threshold = min_p * max_p;
    let kept: Vec<(usize, f64)> = probs.iter().cloned().enumerate().filter(|&(_, pi)| pi >= threshold).collect();
    sample_renormed(&kept, rng)
}

fn demo_causal_mask() {
    println!("=== causal attention matrix (post-softmax) ===");
    let n = 6;
    let mut rng = Rng::new(42);
    let raw: Vec<Vec<f64>> = (0..n).map(|_| (0..n).map(|_| rng.gauss(0.0, 1.0)).collect()).collect();
    let mask = causal_mask(n);
    let masked = attention_scores_with_mask(&raw, &mask);
    let attn: Vec<Vec<f64>> = masked.iter().map(|row| apply_softmax_row(row)).collect();
    for row in &attn {
        let cells: Vec<String> = row.iter().map(|v| format!("{:.3}", v)).collect();
        println!("  {}", cells.join("  "));
    }
    println!("  (every row is a valid probability distribution over positions 0..i)");
    println!();
}

fn demo_sampling() {
    println!("=== sampling strategies on a fake next-token distribution ===");
    let vocab = ["the", "cat", "dog", "sat", "ran", "jumped", "on", "mat", "floor", "."];
    let logits = [3.2, 1.1, 2.8, 0.4, 0.9, 1.5, -0.2, 2.1, 0.7, 0.1];
    let probs = softmax(&logits, 1.0);
    println!("token       logit   prob");
    for i in 0..vocab.len() {
        println!("  {:<8}  {:+.2}   {:.3}", vocab[i], logits[i], probs[i]);
    }
    println!();

    let mut rng = Rng::new(0);
    println!("greedy:         {}", vocab[sample_greedy(&probs)]);
    println!("temp=0.7:       {}", vocab[sample_temperature(&logits, 0.7, &mut rng)]);
    println!("temp=2.0:       {}", vocab[sample_temperature(&logits, 2.0, &mut rng)]);
    println!("top-k=3:        {}", vocab[sample_top_k(&logits, 3, &mut rng, 1.0)]);
    println!("top-p=0.9:      {}", vocab[sample_top_p(&logits, 0.9, &mut rng, 1.0)]);
    println!("min-p=0.1:      {}", vocab[sample_min_p(&logits, 0.1, &mut rng, 1.0)]);
    println!();
}

fn demo_ce_loss() {
    println!("=== cross-entropy next-token loss ===");
    let vocab_size = 10;
    let seq = [3usize, 1, 7, 0, 4, 9];
    let mut rng = Rng::new(7);
    let mut logits: Vec<Vec<f64>> = seq.iter().map(|_| (0..vocab_size).map(|_| rng.gauss(0.0, 1.0)).collect()).collect();
    for i in 0..seq.len() - 1 {
        logits[i][seq[i + 1]] += 2.0;
    }
    let loss_trained = cross_entropy_shifted(&logits, &seq);
    let logits_rand: Vec<Vec<f64>> = seq.iter().map(|_| (0..vocab_size).map(|_| rng.gauss(0.0, 1.0)).collect()).collect();
    let loss_rand = cross_entropy_shifted(&logits_rand, &seq);
    println!("loss with biased logits (trained-ish):  {:.3}", loss_trained);
    println!("loss with random logits:                {:.3}", loss_rand);
    println!("random-baseline loss (ln V = ln {}):      {:.3}", vocab_size, (vocab_size as f64).ln());
    println!();
}

fn main() {
    demo_causal_mask();
    demo_sampling();
    demo_ce_loss();
    println!("takeaway: the mask is one line. the rest is the same transformer.");
}
