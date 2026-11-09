// Lesson: Differential Attention (V2) (phase 10 / lesson 16)
// Rust port of code/main.py. Standard library only.
// Source: phases/10-llms-from-scratch/16-differential-attention-v2/docs/en.md
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

type Matrix = Vec<Vec<f64>>;

fn dot(a: &[f64], b: &[f64]) -> f64 {
    a.iter().zip(b).map(|(x, y)| x * y).sum()
}

fn softmax_row(row: &[f64]) -> Vec<f64> {
    let m = row.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let exps: Vec<f64> = row.iter().map(|x| (x - m).exp()).collect();
    let s: f64 = exps.iter().sum();
    exps.iter().map(|e| e / s).collect()
}

fn weighted_values(weights: &[Vec<f64>], v: &[Vec<f64>]) -> Matrix {
    let d_v = v[0].len();
    weights
        .iter()
        .map(|w| (0..d_v).map(|c| (0..v.len()).map(|j| w[j] * v[j][c]).sum()).collect())
        .collect()
}

#[allow(dead_code)]
fn standard_attention(q: &[Vec<f64>], k: &[Vec<f64>], v: &[Vec<f64>]) -> (Matrix, Matrix) {
    let scale = (q[0].len() as f64).sqrt();
    let weights: Matrix = q
        .iter()
        .map(|qr| softmax_row(&k.iter().map(|kr| dot(qr, kr) / scale).collect::<Vec<f64>>()))
        .collect();
    let out = weighted_values(&weights, v);
    (weights, out)
}

#[allow(dead_code)]
fn diff_attention(q1: &[Vec<f64>], k1: &[Vec<f64>], q2: &[Vec<f64>], k2: &[Vec<f64>], v: &[Vec<f64>], lam: f64) -> (Matrix, Matrix) {
    let scale = (q1[0].len() as f64).sqrt();
    let mut weights = Vec::new();
    for (a, b) in q1.iter().zip(q2) {
        let row1 = softmax_row(&k1.iter().map(|k| dot(a, k) / scale).collect::<Vec<f64>>());
        let row2 = softmax_row(&k2.iter().map(|k| dot(b, k) / scale).collect::<Vec<f64>>());
        let diff: Vec<f64> = row1.iter().zip(&row2).map(|(x, y)| x - lam * y).collect();
        weights.push(diff);
    }
    let out = weighted_values(&weights, v);
    (weights, out)
}

#[allow(dead_code)]
fn random_projection(d_in: usize, d_out: usize, rng: &mut Rng) -> Matrix {
    let sigma = 1.0 / (d_in as f64).sqrt();
    (0..d_in).map(|_| (0..d_out).map(|_| rng.gauss(0.0, sigma)).collect()).collect()
}

#[allow(dead_code)]
fn matmul(x: &[Vec<f64>], w: &[Vec<f64>]) -> Matrix {
    let d_out = w[0].len();
    x.iter()
        .map(|row| (0..d_out).map(|c| (0..row.len()).map(|k| row[k] * w[k][c]).sum()).collect())
        .collect()
}

#[allow(dead_code)]
fn build_signal_plus_noise(n_tokens: usize, signal_pos: usize, d_embed: usize, noise_scale: f64, rng: &mut Rng) -> (Matrix, Vec<f64>) {
    let pattern: Vec<f64> = (0..d_embed).map(|_| rng.gauss(0.0, 1.0)).collect();
    let norm = pattern.iter().map(|x| x * x).sum::<f64>().sqrt();
    let pattern: Vec<f64> = pattern.iter().map(|x| x / norm).collect();
    let mut x = Vec::new();
    for i in 0..n_tokens {
        if i == signal_pos {
            x.push(pattern.iter().map(|p| p + rng.gauss(0.0, noise_scale * 0.1)).collect());
        } else {
            x.push((0..d_embed).map(|_| rng.gauss(0.0, noise_scale)).collect());
        }
    }
    let q = pattern.clone();
    (x, q)
}

fn snr(weights_row: &[f64], signal_pos: usize) -> f64 {
    let sig = weights_row[signal_pos].abs();
    let noise_vals: Vec<f64> = weights_row
        .iter()
        .enumerate()
        .filter(|(i, _)| *i != signal_pos)
        .map(|(_, w)| w.abs())
        .collect();
    let mean_noise = noise_vals.iter().sum::<f64>() / noise_vals.len() as f64;
    if mean_noise == 0.0 {
        return f64::INFINITY;
    }
    sig / mean_noise
}

#[allow(dead_code)]
struct ParamDiff {
    baseline: u64,
    diff_v1: u64,
    diff_v2: u64,
    extra_v1: i64,
    extra_v2: i64,
}

fn attention_params_baseline(hidden: u64) -> u64 {
    4 * hidden * hidden
}

fn attention_params_diff_v1(hidden: u64, n_heads: u64, d_head: u64) -> u64 {
    let q_params = 2 * (hidden * (n_heads * d_head / 2));
    let k_params = 2 * (hidden * (n_heads * d_head / 2));
    let v_params = hidden * hidden;
    let o_params = hidden * hidden;
    let lam_params = 4 * n_heads * (d_head / 2);
    q_params + k_params + v_params + o_params + lam_params
}

fn attention_params_diff_v2(hidden: u64, n_heads: u64, d_head: u64, kv_heads: u64) -> u64 {
    let q_params = hidden * (2 * n_heads * d_head);
    let k_params = hidden * (kv_heads * d_head);
    let v_params = hidden * (kv_heads * d_head);
    let o_params = (2 * n_heads * d_head) * hidden;
    let lam_params = 4 * n_heads * d_head;
    q_params + k_params + v_params + o_params + lam_params
}

fn compute_param_diff(hidden: u64, n_heads: u64, kv_heads: u64) -> ParamDiff {
    let d_head = hidden / n_heads;
    let base = attention_params_baseline(hidden);
    let v1 = attention_params_diff_v1(hidden, n_heads, d_head);
    let v2 = attention_params_diff_v2(hidden, n_heads, d_head, kv_heads);
    ParamDiff {
        baseline: base,
        diff_v1: v1,
        diff_v2: v2,
        extra_v1: v1 as i64 - base as i64,
        extra_v2: v2 as i64 - base as i64,
    }
}

fn fmt_m(n: i64) -> String {
    if n >= 1_000_000 {
        return format!("{:.1}M", n as f64 / 1e6);
    }
    if n >= 1_000 {
        return format!("{:.1}K", n as f64 / 1e3);
    }
    format!("{}", n)
}

fn noise_sum(row: &[f64], signal_pos: usize) -> f64 {
    row.iter()
        .enumerate()
        .filter(|(i, _)| *i != signal_pos)
        .map(|(_, w)| w.abs())
        .sum()
}

fn signed(x: f64, prec: usize) -> String {
    if x.is_sign_negative() {
        format!("{:.*}", prec, x)
    } else {
        format!("+{:.*}", prec, x)
    }
}

fn main() {
    let mut rng = Rng::new(17);
    println!("{}", "=".repeat(70));
    println!("DIFFERENTIAL ATTENTION V2 (Phase 10, Lesson 16)");
    println!("{}", "=".repeat(70));
    println!();

    let n_tokens = 1024;
    let signal_pos = 500;

    println!("{}", "-".repeat(70));
    println!("Step 1: direct-logit toy on length {}, signal at pos {}", n_tokens, signal_pos);
    println!("{}", "-".repeat(70));
    println!("  Both branches compute softmax over q.K logits. Branch 1 is a");
    println!("  TRAINED head that correctly amplifies the signal. Branch 2 is");
    println!("  an untrained/noise-seeing head. DIFF subtracts the shared");
    println!("  noise-floor component.");
    println!();

    let signal_logit = 4.0;
    let noise_std = 0.5;
    let mut logits_trained: Vec<f64> = (0..n_tokens).map(|_| rng.gauss(0.0, noise_std)).collect();
    logits_trained[signal_pos] = signal_logit;
    let logits_untrained: Vec<f64> = (0..n_tokens).map(|_| rng.gauss(0.0, noise_std)).collect();

    let a1 = softmax_row(&logits_trained);
    let a2 = softmax_row(&logits_untrained);

    let std_snr = snr(&a1, signal_pos);
    let std_signal = a1[signal_pos];
    let std_noise = noise_sum(&a1, signal_pos);
    println!("  standard softmax attention (branch 1 only):");
    println!("    weight on signal position  : {:.6}", std_signal);
    println!("    sum of |noise| weights     : {:.6}", std_noise);
    println!("    signal-to-noise ratio      : {:.2}", std_snr);
    println!();

    for lam in [0.0, 0.3, 0.6, 0.8, 1.0] {
        let diff: Vec<f64> = a1.iter().zip(&a2).map(|(x, y)| x - lam * y).collect();
        let dsnr = snr(&diff, signal_pos);
        let d_signal = diff[signal_pos];
        let d_noise = noise_sum(&diff, signal_pos);
        println!("  differential attention (lambda={:.1}):", lam);
        println!("    weight on signal position  : {}", signed(d_signal, 6));
        println!("    sum of |noise| weights     : {:.6}", d_noise);
        println!("    signal-to-noise ratio      : {:.2}", dsnr);
    }
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 2: noise-amplitude sweep (higher = noisier context)");
    println!("{}", "-".repeat(70));
    println!("  {:>10}  {:>9}  {:>20}", "noise_std", "std SNR", "diff SNR (lam=0.8)");
    for noise_scale in [0.25, 0.50, 1.0, 1.5, 2.0] {
        let mut lrng = Rng::new((noise_scale * 100.0) as u64);
        let mut l1: Vec<f64> = (0..n_tokens).map(|_| lrng.gauss(0.0, noise_scale)).collect();
        l1[signal_pos] = signal_logit;
        let l2: Vec<f64> = (0..n_tokens).map(|_| lrng.gauss(0.0, noise_scale)).collect();
        let a1s = softmax_row(&l1);
        let a2s = softmax_row(&l2);
        let diff_s: Vec<f64> = a1s.iter().zip(&a2s).map(|(a, b)| a - 0.8 * b).collect();
        let s_snr = snr(&a1s, signal_pos);
        let d_snr = snr(&diff_s, signal_pos);
        println!("  {:>10.2}  {:>9.2}  {:>20.2}", noise_scale, s_snr, d_snr);
    }
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 3: parameter-count diff, 7B-class config");
    println!("{}", "-".repeat(70));
    let pd = compute_param_diff(4096, 32, 8);
    println!("  baseline attention   : {}", fmt_m(pd.baseline as i64));
    println!("  DIFF V1 attention    : {}  (delta {})", fmt_m(pd.diff_v1 as i64), fmt_m(pd.extra_v1));
    println!("  DIFF V2 attention    : {}  (delta {})", fmt_m(pd.diff_v2 as i64), fmt_m(pd.extra_v2));
    println!();

    println!("takeaway: DIFF attention reliably improves signal-to-noise in long-context");
    println!("          queries. V2 brings the parameter cost down and matches baseline");
    println!("          decode speed by doubling Q heads rather than halving head_dim.");
}
