// Lesson: Multi-Token Prediction (MTP) (phase 10 / lesson 18)
// Rust port of code/main.py. Standard library only.
// Source: phases/10-llms-from-scratch/18-multi-token-prediction/docs/en.md
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

    fn randrange(&mut self, n: usize) -> usize {
        ((self.random() * n as f64) as usize).min(n - 1)
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

fn rand_matrix(rows: usize, cols: usize, rng: &mut Rng, scale: f64) -> Matrix {
    (0..rows).map(|_| (0..cols).map(|_| rng.gauss(0.0, scale)).collect()).collect()
}

fn matvec(m: &[Vec<f64>], v: &[f64]) -> Vec<f64> {
    m.iter().map(|row| (0..v.len()).map(|j| row[j] * v[j]).sum()).collect()
}

fn add(a: &[f64], b: &[f64]) -> Vec<f64> {
    a.iter().zip(b).map(|(x, y)| x + y).collect()
}

fn rms_norm(v: &[f64]) -> Vec<f64> {
    let eps = 1e-6;
    let ms = v.iter().map(|x| x * x).sum::<f64>() / v.len() as f64;
    let r = 1.0 / (ms + eps).sqrt();
    v.iter().map(|x| x * r).collect()
}

fn silu(x: f64) -> f64 {
    x / (1.0 + (-x).exp())
}

fn swiglu(v: &[f64], w_gate: &[Vec<f64>], w_up: &[Vec<f64>], w_down: &[Vec<f64>]) -> Vec<f64> {
    let gate: Vec<f64> = matvec(w_gate, v).into_iter().map(silu).collect();
    let up = matvec(w_up, v);
    let inner: Vec<f64> = gate.iter().zip(&up).map(|(g, u)| g * u).collect();
    matvec(w_down, &inner)
}

fn softmax(row: &[f64]) -> Vec<f64> {
    let m = row.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let exps: Vec<f64> = row.iter().map(|x| (x - m).exp()).collect();
    let s: f64 = exps.iter().sum();
    exps.iter().map(|e| e / s).collect()
}

#[allow(dead_code)]
struct MtpModule {
    hidden: usize,
    ff: usize,
    m_k: Matrix,
    wq: Matrix,
    wk: Matrix,
    wv: Matrix,
    wo: Matrix,
    w_gate: Matrix,
    w_up: Matrix,
    w_down: Matrix,
}

fn make_mtp_module(hidden: usize, ff: usize, rng: &mut Rng) -> MtpModule {
    MtpModule {
        hidden,
        ff,
        m_k: rand_matrix(hidden, hidden, rng, 0.1),
        wq: rand_matrix(hidden, hidden, rng, 0.1),
        wk: rand_matrix(hidden, hidden, rng, 0.1),
        wv: rand_matrix(hidden, hidden, rng, 0.1),
        wo: rand_matrix(hidden, hidden, rng, 0.1),
        w_gate: rand_matrix(ff, hidden, rng, 0.1),
        w_up: rand_matrix(ff, hidden, rng, 0.1),
        w_down: rand_matrix(hidden, ff, rng, 0.1),
    }
}

fn attention_single(v_in: &[f64], wq: &[Vec<f64>], wk: &[Vec<f64>], wv: &[Vec<f64>], wo: &[Vec<f64>]) -> Vec<f64> {
    let q = matvec(wq, v_in);
    let k = matvec(wk, v_in);
    let v = matvec(wv, v_in);
    let _score = (0..q.len()).map(|i| q[i] * k[i]).sum::<f64>() / (q.len() as f64).sqrt();
    let weight = 1.0;
    let attended: Vec<f64> = v.iter().map(|vi| weight * vi).collect();
    matvec(wo, &attended)
}

fn mtp_forward(prev_hidden: &[f64], next_embed: &[f64], module: &MtpModule) -> Vec<f64> {
    let a = rms_norm(prev_hidden);
    let b = rms_norm(next_embed);
    let folded = add(&a, &b);
    let projected = matvec(&module.m_k, &folded);
    let post_attn = add(&projected, &attention_single(&projected, &module.wq, &module.wk, &module.wv, &module.wo));
    add(&post_attn, &swiglu(&rms_norm(&post_attn), &module.w_gate, &module.w_up, &module.w_down))
}

fn shared_head_logits(hidden: &[f64], e: &[Vec<f64>]) -> Vec<f64> {
    e.iter().map(|row| (0..hidden.len()).map(|i| row[i] * hidden[i]).sum()).collect()
}

fn cross_entropy(logits: &[f64], target: usize) -> f64 {
    let probs = softmax(logits);
    -probs[target].max(1e-12).ln()
}

fn mtp_loss(backbone_hidden: &[Vec<f64>], tokens: &[usize], modules: &[MtpModule], e: &[Vec<f64>], lam: f64) -> (f64, Vec<f64>) {
    let d = modules.len();
    let mut per_depth = vec![0.0; d];
    let mut n_valid = 0;
    for i in 0..backbone_hidden.len().saturating_sub(d + 1) {
        let mut h_prev = backbone_hidden[i].clone();
        for k in 1..=d {
            let next_embed = &e[tokens[i + k]];
            h_prev = mtp_forward(&h_prev, next_embed, &modules[k - 1]);
            let logits = shared_head_logits(&h_prev, e);
            per_depth[k - 1] += cross_entropy(&logits, tokens[i + k + 1]);
        }
        n_valid += 1;
    }
    let per_depth: Vec<f64> = per_depth.iter().map(|loss| loss / n_valid as f64).collect();
    let total = (lam / d as f64) * per_depth.iter().sum::<f64>();
    (total, per_depth)
}

#[allow(dead_code)]
struct ParamReport {
    embedding: u64,
    head_shared: bool,
    per_mtp: u64,
    main_attention_per_layer: u64,
    main_mlp_per_layer: u64,
    main_total: u64,
    mtp_total: u64,
    total: u64,
}

fn count_parameters(vocab: u64, hidden: u64, ff: u64, n_layers: u64, d: u64) -> ParamReport {
    let emb = vocab * hidden;
    let attn = 4 * hidden * hidden;
    let mlp = 3 * hidden * ff;
    let main = emb + n_layers * (attn + mlp) + hidden;
    let per_mtp = hidden * hidden + attn + mlp;
    let mtp_total = d * per_mtp;
    ParamReport {
        embedding: emb,
        head_shared: true,
        per_mtp,
        main_attention_per_layer: attn,
        main_mlp_per_layer: mlp,
        main_total: main,
        mtp_total,
        total: main + mtp_total,
    }
}

fn fmt(n: u64) -> String {
    if n >= 1_000_000_000 {
        return format!("{:.1}B", n as f64 / 1e9);
    }
    if n >= 1_000_000 {
        return format!("{:.1}M", n as f64 / 1e6);
    }
    if n >= 1_000 {
        return format!("{:.1}K", n as f64 / 1e3);
    }
    format!("{}", n)
}

fn noisy_backbone(e: &[Vec<f64>], tokens: &[usize], hidden: usize, noise: f64, rng: &mut Rng) -> Matrix {
    tokens
        .iter()
        .map(|&t| {
            let jitter: Vec<f64> = (0..hidden).map(|_| rng.gauss(0.0, noise)).collect();
            rms_norm(&add(&e[t], &jitter))
        })
        .collect()
}

fn main() {
    let mut rng = Rng::new(4);
    println!("{}", "=".repeat(70));
    println!("MULTI-TOKEN PREDICTION: DeepSeek-V3 sequential MTP (Phase 10, Lesson 18)");
    println!("{}", "=".repeat(70));
    println!();

    let vocab = 32;
    let hidden = 8;
    let ff = 16;
    let seq = 12;
    let d = 2;
    let lam = 0.3;

    println!("{}", "-".repeat(70));
    println!("Step 1: toy setup  vocab={}, hidden={}, ff={}, seq={}, D={}", vocab, hidden, ff, seq, d);
    println!("{}", "-".repeat(70));

    let e = rand_matrix(vocab, hidden, &mut rng, 0.2);
    let tokens: Vec<usize> = (0..seq).map(|_| rng.randrange(vocab)).collect();

    let backbone_hidden = noisy_backbone(&e, &tokens, hidden, 0.1, &mut rng);

    let modules: Vec<MtpModule> = (0..d).map(|_| make_mtp_module(hidden, ff, &mut rng)).collect();

    let (total, per_depth) = mtp_loss(&backbone_hidden, &tokens, &modules, &e, lam);
    let parts: Vec<String> = per_depth.iter().enumerate().map(|(k, loss)| format!("L_{}={:.3}", k + 1, loss)).collect();
    println!("  per-depth losses   : {}", parts.join(", "));
    println!("  joint L_MTP (lam={})  : {:.4}", lam, total);
    println!("  (uniform random-guess reference: {:.3} per depth)", (vocab as f64).ln());
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 2: parameter accounting");
    println!("{}", "-".repeat(70));
    for (name, h, ff_h, l, d_h) in [
        ("toy", hidden as u64, ff as u64, 2u64, d as u64),
        ("mini GPT", 768, 3072, 12, 1),
        ("7B dense", 4096, 14336, 32, 1),
        ("70B dense", 8192, 28672, 80, 1),
        ("DeepSeek-V3-shape", 7168, 18432, 61, 1),
    ] {
        let v = if name != "toy" { 128000 } else { vocab as u64 };
        let r = count_parameters(v, h, ff_h, l, d_h);
        println!(
            "  {:<22} main={:>7}  + {} MTP module(s) = {:>6}  ({:.1}% overhead)",
            name,
            fmt(r.main_total),
            d_h,
            fmt(r.mtp_total),
            100.0 * r.mtp_total as f64 / r.main_total as f64
        );
    }
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 3: per-depth loss vs training progress (synthetic)");
    println!("{}", "-".repeat(70));
    println!("  simulate a training step: reduce noise in backbone hidden states");
    println!("  and watch L_1 and L_2 both drop.");
    println!();
    println!("  {:>7}  {:>6}  {:>6}  {:>7}", "noise", "L_1", "L_2", "L_MTP");
    for noise_scale in [0.50, 0.30, 0.15, 0.05] {
        let mut local_rng = Rng::new(42);
        let bh = noisy_backbone(&e, &tokens, hidden, noise_scale, &mut local_rng);
        let (total, per_depth) = mtp_loss(&bh, &tokens, &modules, &e, lam);
        let l1 = per_depth[0];
        let l2 = if per_depth.len() > 1 { per_depth[1] } else { f64::NAN };
        println!("  {:>7.2}  {:>6.3}  {:>6.3}  {:>7.4}", noise_scale, l1, l2, total);
    }
    println!();

    println!("takeaway: DeepSeek-V3 MTP adds ~1-2% parameters for a dense model and");
    println!("          ~14B out of 671B for the MoE model. Denser training signal +");
    println!("          free speculative-decoding draft at inference (80%+ accept)");
    println!("          with reported 1.8x throughput speedup.");
}
