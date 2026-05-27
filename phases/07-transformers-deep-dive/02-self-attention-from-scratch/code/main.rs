// Self-attention kernel from scratch, stdlib only.
// Topic: scaled dot-product attention with explicit row-major memory.
// References (cited in spirit, not as deps):
//   - Vaswani 2017, "Attention Is All You Need": https://arxiv.org/abs/1706.03762
//   - candle reference attention kernel:        https://github.com/huggingface/candle/blob/main/candle-nn/src/ops.rs
//   - Karpathy llm.c attention forward pass:    https://github.com/karpathy/llm.c/blob/master/train_gpt2.c
//
// Compile + run:  rustc --edition 2021 main.rs -o /tmp/sa && /tmp/sa

use std::f32::consts::E;

// Row-major matrix backed by a flat Vec<f32>. Helpers index by (row, col).
struct Mat {
    rows: usize,
    cols: usize,
    data: Vec<f32>,
}

impl Mat {
    fn zeros(rows: usize, cols: usize) -> Self {
        Mat { rows, cols, data: vec![0.0; rows * cols] }
    }

    #[inline] fn at(&self, i: usize, j: usize) -> f32 { self.data[i * self.cols + j] }
    #[inline] fn set(&mut self, i: usize, j: usize, v: f32) { self.data[i * self.cols + j] = v; }

    fn matmul(&self, b: &Mat) -> Mat {
        assert_eq!(self.cols, b.rows, "shape mismatch: {}x{} @ {}x{}", self.rows, self.cols, b.rows, b.cols);
        let mut out = Mat::zeros(self.rows, b.cols);
        for i in 0..self.rows {
            for k in 0..self.cols {
                let aik = self.at(i, k);
                if aik == 0.0 { continue; }
                let row_base = i * out.cols;
                let bk_base = k * b.cols;
                for j in 0..b.cols {
                    out.data[row_base + j] += aik * b.data[bk_base + j];
                }
            }
        }
        out
    }

    fn transpose(&self) -> Mat {
        let mut t = Mat::zeros(self.cols, self.rows);
        for i in 0..self.rows {
            for j in 0..self.cols {
                t.set(j, i, self.at(i, j));
            }
        }
        t
    }

    fn scale(&mut self, s: f32) {
        for v in self.data.iter_mut() { *v *= s; }
    }
}

// Softmax along the last axis (per row), numerically stable.
fn softmax_rows(m: &Mat) -> Mat {
    let mut out = Mat::zeros(m.rows, m.cols);
    for i in 0..m.rows {
        let mut row_max = f32::NEG_INFINITY;
        for j in 0..m.cols { if m.at(i, j) > row_max { row_max = m.at(i, j); } }
        let mut sum = 0.0f32;
        for j in 0..m.cols {
            let e = E.powf(m.at(i, j) - row_max);
            out.set(i, j, e);
            sum += e;
        }
        let inv = 1.0 / sum;
        for j in 0..m.cols {
            let v = out.at(i, j) * inv;
            out.set(i, j, v);
        }
    }
    out
}

// Q @ K^T / sqrt(d_k), softmax, then @ V.
fn scaled_dot_product_attention(q: &Mat, k: &Mat, v: &Mat) -> (Mat, Mat) {
    let dk = q.cols as f32;
    let k_t = k.transpose();
    let mut scores = q.matmul(&k_t);
    scores.scale(1.0 / dk.sqrt());
    let weights = softmax_rows(&scores);
    let out = weights.matmul(v);
    (out, weights)
}

// Deterministic, dependency-free Gaussian via Box-Muller from a Lehmer LCG.
struct Rng { state: u64 }
impl Rng {
    fn new(seed: u64) -> Self { Rng { state: seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1 } }
    fn next_u32(&mut self) -> u32 {
        self.state = self.state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        (self.state >> 33) as u32
    }
    fn uniform(&mut self) -> f32 {
        (self.next_u32() as f32 + 1.0) / (u32::MAX as f32 + 2.0)
    }
    fn gauss(&mut self) -> f32 {
        let u1 = self.uniform();
        let u2 = self.uniform();
        (-2.0 * u1.ln()).sqrt() * (2.0 * std::f32::consts::PI * u2).cos()
    }
}

fn randn(rows: usize, cols: usize, scale: f32, rng: &mut Rng) -> Mat {
    let mut m = Mat::zeros(rows, cols);
    for v in m.data.iter_mut() { *v = rng.gauss() * scale; }
    m
}

struct SelfAttention {
    wq: Mat,
    wk: Mat,
    wv: Mat,
}

impl SelfAttention {
    fn new(d_model: usize, dk: usize, dv: usize, rng: &mut Rng) -> Self {
        let s_qk = (2.0 / (d_model + dk) as f32).sqrt();
        let s_v = (2.0 / (d_model + dv) as f32).sqrt();
        SelfAttention {
            wq: randn(d_model, dk, s_qk, rng),
            wk: randn(d_model, dk, s_qk, rng),
            wv: randn(d_model, dv, s_v, rng),
        }
    }

    fn forward(&self, x: &Mat) -> (Mat, Mat) {
        let q = x.matmul(&self.wq);
        let k = x.matmul(&self.wk);
        let v = x.matmul(&self.wv);
        scaled_dot_product_attention(&q, &k, &v)
    }
}

fn print_attention(weights: &Mat, tokens: &[&str]) {
    print!("      ");
    for t in tokens { print!("{:>7}", t); }
    println!();
    for i in 0..weights.rows {
        print!("{:>6}", tokens[i]);
        for j in 0..weights.cols { print!("{:>7.3}", weights.at(i, j)); }
        println!();
    }
}

fn ascii_heatmap(weights: &Mat, tokens: &[&str]) {
    let chars = [' ', '\u{2591}', '\u{2592}', '\u{2593}', '\u{2588}'];
    let mut w_max = 0.0f32;
    for v in &weights.data { if *v > w_max { w_max = *v; } }
    print!("      ");
    for t in tokens { print!("{:>7}", t); }
    println!();
    for i in 0..weights.rows {
        print!("{:>6}", tokens[i]);
        for j in 0..weights.cols {
            let level = ((weights.at(i, j) * (chars.len() - 1) as f32) / w_max) as usize;
            let level = level.min(chars.len() - 1);
            print!("     {} ", chars[level]);
        }
        println!();
    }
}

fn softmax_vec(logits: &[f32]) -> Vec<f32> {
    let mut m = f32::NEG_INFINITY;
    for &x in logits { if x > m { m = x; } }
    let exps: Vec<f32> = logits.iter().map(|x| (x - m).exp()).collect();
    let s: f32 = exps.iter().sum();
    exps.into_iter().map(|x| x / s).collect()
}

fn main() {
    let sentence = ["The", "cat", "sat", "on", "the", "mat"];
    let n_tokens = sentence.len();
    let d_model: usize = 16;
    let dk: usize = 8;
    let dv: usize = 8;

    println!("{}", "=".repeat(60));
    println!("SELF-ATTENTION FROM SCRATCH (Rust port)");
    println!("{}", "=".repeat(60));

    let mut rng = Rng::new(42);
    let x = randn(n_tokens, d_model, 1.0, &mut rng);
    println!("\nSentence: {}", sentence.join(" "));
    println!("Tokens: {}, d_model: {}, dk: {}, dv: {}", n_tokens, d_model, dk, dv);
    println!("Input shape: ({}, {})", x.rows, x.cols);

    let mut rng_w = Rng::new(42);
    let attn = SelfAttention::new(d_model, dk, dv, &mut rng_w);
    let (out, weights) = attn.forward(&x);

    println!("\nOutput shape: ({}, {})", out.rows, out.cols);
    println!("\nAttention weights:");
    print_attention(&weights, &sentence);

    println!("\nASCII heatmap (darker = higher attention):");
    ascii_heatmap(&weights, &sentence);

    println!("\n{}", "=".repeat(60));
    println!("SOFTMAX DEMO");
    println!("{}", "=".repeat(60));

    let logits = [2.0f32, 1.0, 0.1];
    let probs = softmax_vec(&logits);
    println!("\nLogits:  {:?}", logits);
    println!("Softmax: {:?}", probs.iter().map(|p| (p * 10000.0).round() / 10000.0).collect::<Vec<_>>());
    println!("Sum:     {:.4}", probs.iter().sum::<f32>());

    let large = [100.0f32, 200.0, 300.0];
    let probs_l = softmax_vec(&large);
    println!("\nLarge logits:  {:?}", large);
    println!("Softmax:       {:?}", probs_l.iter().map(|p| (p * 10000.0).round() / 10000.0).collect::<Vec<_>>());
    println!("Sum:           {:.4}", probs_l.iter().sum::<f32>());
    println!("(numerically stable, no overflow)");

    println!("\n{}", "=".repeat(60));
    println!("MICROBENCH: 10K attention forwards");
    println!("{}", "=".repeat(60));
    let start = std::time::Instant::now();
    let mut sink = 0.0f32;
    for _ in 0..10_000 {
        let (o, _) = attn.forward(&x);
        sink += o.at(0, 0);
    }
    let elapsed = start.elapsed();
    println!("10K forwards in {:.2}ms ({:.0}/sec)  sink={:.4}",
        elapsed.as_secs_f64() * 1000.0,
        10_000.0 / elapsed.as_secs_f64(),
        sink,
    );
}
