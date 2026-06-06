// Positional encodings: sinusoidal, RoPE, ALiBi. Stdlib only.
// Topic: encode token position into queries, keys, or attention bias.
// References (cited in spirit, not as deps):
//   - Vaswani 2017 (sinusoidal):     https://arxiv.org/abs/1706.03762
//   - Su et al. 2021 (RoPE):         https://arxiv.org/abs/2104.09864
//   - Press et al. 2021 (ALiBi):     https://arxiv.org/abs/2108.12409
//   - candle rope impl:              https://github.com/huggingface/candle/blob/main/candle-nn/src/rotary_emb.rs
//
// Compile + run:  rustc --edition 2021 main.rs -o /tmp/pe && /tmp/pe

use std::f32::consts::PI;

// Sinusoidal positional encoding table [n, d].
fn sinusoidal_pe(n: usize, d: usize, base: f32) -> Vec<Vec<f32>> {
    let mut pe = vec![vec![0.0f32; d]; n];
    for pos in 0..n {
        for i in 0..(d / 2) {
            let theta = (pos as f32) / base.powf(2.0 * i as f32 / d as f32);
            pe[pos][2 * i] = theta.sin();
            pe[pos][2 * i + 1] = theta.cos();
        }
    }
    pe
}

// Rotate even/odd pairs of x by angle pos * theta_i. Returns a new Vec.
fn apply_rope(x: &[f32], pos: usize, base: f32) -> Vec<f32> {
    let d = x.len();
    let mut out = x.to_vec();
    for i in 0..(d / 2) {
        let theta = (pos as f32) / base.powf(2.0 * i as f32 / d as f32);
        let c = theta.cos();
        let s = theta.sin();
        let a = x[2 * i];
        let b = x[2 * i + 1];
        out[2 * i] = a * c - b * s;
        out[2 * i + 1] = a * s + b * c;
    }
    out
}

fn dot(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}

// ALiBi slopes: 2^(-8*(h+1)/n_heads) for h in 0..n_heads.
fn alibi_slopes(n_heads: usize) -> Vec<f32> {
    (0..n_heads)
        .map(|h| 2.0f32.powf(-8.0 * (h + 1) as f32 / n_heads as f32))
        .collect()
}

// ALiBi bias matrix for each head: -slope * |i - j|, with optional causal mask.
fn alibi_bias(n_heads: usize, seq_len: usize, causal: bool) -> Vec<Vec<Vec<f32>>> {
    let slopes = alibi_slopes(n_heads);
    let mut out = Vec::with_capacity(n_heads);
    for &m in &slopes {
        let mut head = vec![vec![0.0f32; seq_len]; seq_len];
        for i in 0..seq_len {
            for j in 0..seq_len {
                head[i][j] = if causal && j > i {
                    f32::NEG_INFINITY
                } else {
                    -m * (i as i64 - j as i64).abs() as f32
                };
            }
        }
        out.push(head);
    }
    out
}

// Tiny LCG for deterministic Gaussian samples.
struct Rng { state: u64 }
impl Rng {
    fn new(seed: u64) -> Self { Rng { state: seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1 } }
    fn next_u32(&mut self) -> u32 {
        self.state = self.state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        (self.state >> 33) as u32
    }
    fn uniform(&mut self) -> f32 { (self.next_u32() as f32 + 1.0) / (u32::MAX as f32 + 2.0) }
    fn gauss(&mut self) -> f32 {
        let u1 = self.uniform();
        let u2 = self.uniform();
        (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
    }
}

fn demo_sinusoidal() {
    println!("=== sinusoidal positional encoding ===");
    let pe = sinusoidal_pe(8, 8, 10000.0);
    println!("first 4 positions, first 4 dims:");
    for pos in 0..4 {
        print!("  pos={}: ", pos);
        for i in 0..4 {
            print!(" {:+.3}", pe[pos][i]);
        }
        println!();
    }
    println!();
}

fn demo_rope_relative() {
    println!("=== RoPE: dot product depends only on relative distance ===");
    let mut rng = Rng::new(0);
    let d = 16usize;
    let q: Vec<f32> = (0..d).map(|_| rng.gauss()).collect();
    let k: Vec<f32> = (0..d).map(|_| rng.gauss()).collect();

    let pairs = [(3usize, 5usize), (7, 9), (100, 102), (1024, 1026)];
    println!(" {:>6}  {:>6}  {:>4}  {:>18}", "pos_q", "pos_k", "gap", "<q_rot, k_rot>");
    for (pq, pk) in pairs {
        let q_rot = apply_rope(&q, pq, 10000.0);
        let k_rot = apply_rope(&k, pk, 10000.0);
        let d_prod = dot(&q_rot, &k_rot);
        println!(" {:>6}  {:>6}  {:>4}  {:>18.6}", pq, pk, (pk as i64) - (pq as i64), d_prod);
    }
    println!("all rows with gap=2 share the same dot product.");
    println!();
}

fn demo_rope_base_scaling() {
    println!("=== RoPE base scaling (NTK-aware for long context) ===");
    let mut rng = Rng::new(1);
    let d = 8usize;
    let q: Vec<f32> = (0..d).map(|_| rng.gauss()).collect();
    let k: Vec<f32> = (0..d).map(|_| rng.gauss()).collect();

    for base in [10_000.0f32, 100_000.0, 1_000_000.0] {
        let q_rot = apply_rope(&q, 4096, base);
        let k_rot = apply_rope(&k, 4098, base);
        println!("  base={:>9}  score={:+.6}", base as u64, dot(&q_rot, &k_rot));
    }
    println!("larger base = slower rotation = longer context without phase wrap.");
    println!();
}

fn demo_alibi() {
    println!("=== ALiBi bias matrix ===");
    let n_heads = 4usize;
    let slopes = alibi_slopes(n_heads);
    print!("slopes for {} heads:", n_heads);
    for s in &slopes { print!(" {:.4}", s); }
    println!();
    let bias = alibi_bias(n_heads, 6, false);
    println!("head 0 bias (closer tokens get smaller penalty):");
    for row in &bias[0] {
        print!(" ");
        for v in row { print!(" {:+6.2}", v); }
        println!();
    }
    println!();
}

fn demo_rope_microbench() {
    println!("=== microbench: 50K RoPE rotations (d=128) ===");
    let mut rng = Rng::new(2);
    let d = 128usize;
    let q: Vec<f32> = (0..d).map(|_| rng.gauss()).collect();
    let start = std::time::Instant::now();
    let mut sink = 0.0f32;
    for pos in 0..50_000usize {
        let r = apply_rope(&q, pos, 10_000.0);
        sink += r[0];
    }
    let elapsed = start.elapsed();
    println!("50K rotations in {:.2}ms ({:.0}/sec)  sink={:.4}",
        elapsed.as_secs_f64() * 1000.0,
        50_000.0 / elapsed.as_secs_f64(),
        sink,
    );
}

fn main() {
    demo_sinusoidal();
    demo_rope_relative();
    demo_rope_base_scaling();
    demo_alibi();
    demo_rope_microbench();
    println!();
    println!("takeaway: RoPE encodes relative position in the dot product itself.");
    println!("ALiBi skips embeddings entirely. sinusoidal is mostly historical now.");
}
