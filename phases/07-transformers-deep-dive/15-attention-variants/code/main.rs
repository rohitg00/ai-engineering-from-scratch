// Lesson: Attention Variants, Sliding Window, Sparse, Differential (phase 07 / lesson 15)
// Rust port of code/main.py. Standard library only.
// Source: phases/07-transformers-deep-dive/15-attention-variants/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

const NEG_INF: f64 = f64::NEG_INFINITY;

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

    fn uniform(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    fn gauss(&mut self, mu: f64, sigma: f64) -> f64 {
        if let Some(z) = self.spare.take() {
            return mu + sigma * z;
        }
        let mut u1 = self.uniform();
        while u1 <= 0.0 {
            u1 = self.uniform();
        }
        let u2 = self.uniform();
        let r = (-2.0 * u1.ln()).sqrt();
        let theta = 2.0 * std::f64::consts::PI * u2;
        self.spare = Some(r * theta.sin());
        mu + sigma * r * theta.cos()
    }
}

type Mask = Vec<Vec<f64>>;

fn causal_mask(n: usize) -> Mask {
    let mut m = vec![vec![NEG_INF; n]; n];
    for i in 0..n {
        for j in 0..=i {
            m[i][j] = 0.0;
        }
    }
    m
}

fn swa_mask(n: usize, window: usize) -> Mask {
    assert!(window > 0, "swa_mask: window must be positive");
    let mut m = vec![vec![NEG_INF; n]; n];
    for i in 0..n {
        let lo = (i + 1).saturating_sub(window);
        for j in lo..=i {
            m[i][j] = 0.0;
        }
    }
    m
}

fn strided_mask(n: usize, window: usize, stride: usize) -> Mask {
    assert!(window > 0, "strided_mask: window must be positive");
    assert!(stride > 0, "strided_mask: stride must be positive");
    let mut m = vec![vec![NEG_INF; n]; n];
    for i in 0..n {
        let lo = (i + 1).saturating_sub(window);
        for j in lo..=i {
            m[i][j] = 0.0;
        }
        for j in (0..=i).step_by(stride) {
            m[i][j] = 0.0;
        }
    }
    m
}

fn count_nonmasked(m: &Mask) -> usize {
    m.iter().flatten().filter(|v| **v == 0.0).count()
}

fn render(m: &Mask, label: &str) {
    let n = m.len();
    println!("{}  ({} / {} cells attended)", label, count_nonmasked(m), n * n);
    for (i, row) in m.iter().enumerate() {
        let cells: String = row.iter().map(|v| if *v == 0.0 { 'x' } else { '.' }).collect();
        println!("  {:>2} | {}", i, cells);
    }
    println!();
}

fn softmax(xs: &[f64]) -> Vec<f64> {
    assert!(!xs.is_empty(), "softmax: input must not be empty");
    let m = xs.iter().cloned().fold(NEG_INF, f64::max);
    let exps: Vec<f64> = xs.iter().map(|x| (x - m).exp()).collect();
    let s: f64 = exps.iter().sum();
    exps.iter().map(|e| e / s).collect()
}

fn weighted_sum(weights: &[f64], vs: &[Vec<f64>]) -> Vec<f64> {
    let d_v = vs[0].len();
    let mut out = vec![0.0; d_v];
    for (w, v) in weights.iter().zip(vs) {
        for j in 0..d_v {
            out[j] += w * v[j];
        }
    }
    out
}

fn attention_row(q: &[f64], ks: &[Vec<f64>], vs: &[Vec<f64>], mask_row: &[f64]) -> (Vec<f64>, Vec<f64>) {
    assert!(!vs.is_empty(), "attention_row: need at least one value");
    assert_eq!(ks.len(), vs.len(), "attention_row: keys and values must have the same count");
    assert_eq!(ks.len(), mask_row.len(), "attention_row: mask row must match the key count");
    let d = q.len() as f64;
    let scores: Vec<f64> = ks
        .iter()
        .zip(mask_row)
        .map(|(k, m)| {
            if *m == NEG_INF {
                NEG_INF
            } else {
                assert_eq!(k.len(), q.len(), "attention_row: key and query must have the same length");
                q.iter().zip(k).map(|(qi, ki)| qi * ki).sum::<f64>() / d.sqrt()
            }
        })
        .collect();
    let finite: Vec<f64> = scores.iter().cloned().filter(|s| *s != NEG_INF).collect();
    if finite.is_empty() {
        return (vec![0.0; vs[0].len()], vec![0.0; scores.len()]);
    }
    let shifted = softmax(&finite);
    let mut weights = Vec::with_capacity(scores.len());
    let mut k = 0;
    for s in &scores {
        if *s == NEG_INF {
            weights.push(0.0);
        } else {
            weights.push(shifted[k]);
            k += 1;
        }
    }
    let out = weighted_sum(&weights, vs);
    (out, weights)
}

fn diff_attention_row(
    q1: &[f64],
    q2: &[f64],
    k1: &[Vec<f64>],
    k2: &[Vec<f64>],
    v: &[Vec<f64>],
    mask_row: &[f64],
    lam: f64,
) -> (Vec<f64>, Vec<f64>) {
    let (_, w1) = attention_row(q1, k1, v, mask_row);
    let (_, w2) = attention_row(q2, k2, v, mask_row);
    let diff: Vec<f64> = w1.iter().zip(&w2).map(|(a, b)| a - lam * b).collect();
    let out = weighted_sum(&diff, v);
    (out, diff)
}

fn kv_cache_bytes(n_layers: u64, n_kv_heads: u64, d_head: u64, seq_len: u64, dtype_bytes: u64) -> u64 {
    2 * n_layers * n_kv_heads * d_head * seq_len * dtype_bytes
}

fn join(ws: &[f64], signed: bool) -> String {
    ws.iter()
        .map(|w| if signed { format!("{:+.3}", w) } else { format!("{:.3}", w) })
        .collect::<Vec<_>>()
        .join(" ")
}

fn main() {
    println!("=== attention mask shapes on an 8-token sequence ===");
    println!();
    render(&causal_mask(8), "full causal");
    render(&swa_mask(8, 4), "sliding window (W=4)");
    render(&strided_mask(8, 2, 3), "local (W=2) + strided (stride=3)");

    println!("=== attention sink: one 'noisy' query on 8 random tokens ===");
    let mut rng = Rng::new(0);
    let d = 8;
    let k: Vec<Vec<f64>> = (0..8).map(|_| (0..d).map(|_| rng.gauss(0.0, 1.0)).collect()).collect();
    let v: Vec<Vec<f64>> = (0..8).map(|_| (0..d).map(|_| rng.gauss(0.0, 1.0)).collect()).collect();
    let q: Vec<f64> = (0..d).map(|_| rng.gauss(0.0, 1.0)).collect();
    let mask = causal_mask(8)[7].clone();
    let (_, w_single) = attention_row(&q, &k, &v, &mask);
    println!("single attn weights: {}", join(&w_single, false));
    println!("  (notice the weight bleeding to position 0, the attention sink)");

    let q1 = q.clone();
    let q2: Vec<f64> = q.iter().map(|x| x + 0.2 * rng.gauss(0.0, 1.0)).collect();
    let k2: Vec<Vec<f64>> = k
        .iter()
        .map(|row| row.iter().map(|x| x + 0.2 * rng.gauss(0.0, 1.0)).collect())
        .collect();
    let (_, w_diff) = diff_attention_row(&q1, &q2, &k, &k2, &v, &mask, 0.5);
    println!("diff   attn weights: {}", join(&w_diff, true));
    println!("  (lambda=0.5 subtracts the sink component; negative weights allowed)");
    println!();

    println!("=== KV cache @ 128K context, Llama-3-70B-ish (80 layers, 8 KV heads, d_head=128, fp16) ===");
    let (n_layers, n_kv_heads, d_head) = (80, 8, 128);
    let n: u64 = 131072;
    let full = kv_cache_bytes(n_layers, n_kv_heads, d_head, n, 2) as f64;

    println!("  full attention              : {:>6.1} GB", full / 1e9);
    for window in [4096u64, 1024] {
        let reduced = full * (window as f64 / n as f64);
        println!(
            "  SWA window={:>5}             : {:>6.1} GB   ({:.0}x shrink)",
            window,
            reduced / 1e9,
            n as f64 / window as f64
        );
    }

    let gemma_total = full * (5.0 / 6.0) * (1024.0 / n as f64) + full * (1.0 / 6.0);
    println!(
        "  Gemma-3 mix (5:1, W=1024)   : {:>6.1} GB   ({:.1}x shrink)",
        gemma_total / 1e9,
        full / gemma_total
    );

    let diff = full * 2.0;
    println!("  differential attention (2x) : {:>6.1} GB   (pays 2x for sink-free weights)", diff / 1e9);
    println!();
    println!("takeaway: SWA is the cheapest long-context win.");
    println!("          Gemma 3's 5:1 mix keeps enough global layers for retrieval");
    println!("          while shrinking KV ~6x vs pure full attention.");
    println!("          DIFF attention pays 2x KV for sink-free, sharper retrieval.");
}
