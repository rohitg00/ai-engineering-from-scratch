// Lesson: Mixture of Experts (phase 07 / lesson 11)
// Rust port of code/main.py. Standard library only.
// Source: phases/07-transformers-deep-dive/11-mixture-of-experts/docs/en.md
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

fn silu(x: f64) -> f64 {
    x / (1.0 + (-x).exp())
}

fn make_expert(d_in: usize, d_hidden: usize, rng: &mut Rng) -> Matrix {
    assert!(d_in > 0 && d_hidden > 0, "expert dimensions must be positive");
    let scale = (2.0 / (d_in + d_hidden) as f64).sqrt();
    (0..d_in)
        .map(|_| (0..d_hidden).map(|_| rng.gauss(0.0, scale)).collect())
        .collect()
}

fn apply_expert(x: &[f64], w: &Matrix) -> Vec<f64> {
    assert_eq!(x.len(), w.len(), "input length must match expert input size");
    let d_hidden = w[0].len();
    let mut out = vec![0.0; d_hidden];
    for (i, &xi) in x.iter().enumerate() {
        if xi == 0.0 {
            continue;
        }
        for j in 0..d_hidden {
            out[j] += xi * w[i][j];
        }
    }
    out.into_iter().map(silu).collect()
}

fn route(hidden: &[f64], w_router: &Matrix, top_k: usize, bias: &[f64]) -> (Vec<usize>, Vec<f64>) {
    let e = w_router.len();
    assert!(top_k >= 1 && top_k <= e, "top_k must be between 1 and the number of experts");
    assert_eq!(bias.len(), e, "bias needs one value per expert");
    let scores: Vec<f64> = w_router
        .iter()
        .map(|row| hidden.iter().zip(row).map(|(h, w)| h * w).sum())
        .collect();
    let biased: Vec<f64> = scores.iter().zip(bias).map(|(s, b)| s + b).collect();
    let mut order: Vec<usize> = (0..e).collect();
    order.sort_by(|&a, &b| biased[b].total_cmp(&biased[a]));
    let top_idx: Vec<usize> = order.into_iter().take(top_k).collect();
    let chosen: Vec<f64> = top_idx.iter().map(|&i| scores[i]).collect();
    let m = chosen.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let exps: Vec<f64> = chosen.iter().map(|c| (c - m).exp()).collect();
    let s: f64 = exps.iter().sum();
    let gates = exps.iter().map(|v| v / s).collect();
    (top_idx, gates)
}

fn moe_layer_forward(
    x: &[f64],
    experts: &[Matrix],
    w_router: &Matrix,
    top_k: usize,
    bias: &[f64],
) -> (Vec<f64>, Vec<usize>) {
    let (top_idx, gates) = route(x, w_router, top_k, bias);
    let d_hidden = experts[0][0].len();
    let mut out = vec![0.0; d_hidden];
    for (&e_idx, &gate) in top_idx.iter().zip(&gates) {
        let h = apply_expert(x, &experts[e_idx]);
        for j in 0..d_hidden {
            out[j] += gate * h[j];
        }
    }
    (out, top_idx)
}

fn update_bias(bias: &mut [f64], usage_counts: &[usize], target: f64, gamma: f64) {
    assert_eq!(bias.len(), usage_counts.len(), "bias and usage need the same length");
    for e in 0..bias.len() {
        let u = usage_counts[e] as f64;
        if u > target {
            bias[e] -= gamma;
        } else if u < target {
            bias[e] += gamma;
        }
    }
}

fn run_epoch(tokens: &[Vec<f64>], experts: &[Matrix], w_router: &Matrix, top_k: usize, bias: &[f64]) -> Vec<usize> {
    let mut usage = vec![0usize; experts.len()];
    for x in tokens {
        let (_, top_idx) = moe_layer_forward(x, experts, w_router, top_k, bias);
        for e in top_idx {
            usage[e] += 1;
        }
    }
    usage
}

fn entropy(counts: &[usize]) -> f64 {
    let total: usize = counts.iter().sum();
    if total == 0 {
        return 0.0;
    }
    -counts
        .iter()
        .filter(|&&c| c > 0)
        .map(|&c| {
            let p = c as f64 / total as f64;
            p * p.ln()
        })
        .sum::<f64>()
}

fn dense_active_params(n_experts: u64, expert_params: u64, top_k: u64, _d_model: u64) -> (u64, u64) {
    (n_experts * expert_params, top_k * expert_params)
}

fn usage_line(it: usize, usage: &[usize]) -> String {
    let cells: Vec<String> = usage.iter().map(|u| format!("{:>4}", u)).collect();
    format!("iteration {:>2}  usage: {}  entropy={:.3}", it, cells.join(" "), entropy(usage))
}

fn main() {
    let mut rng = Rng::new(42);
    let d_model = 16;
    let d_hidden = 32;
    let n_experts = 8;
    let top_k = 2;
    let n_tokens = 1000;

    let experts: Vec<Matrix> = (0..n_experts).map(|_| make_expert(d_model, d_hidden, &mut rng)).collect();
    let w_router: Matrix = (0..n_experts)
        .map(|_| (0..d_model).map(|_| rng.gauss(0.0, 0.3)).collect())
        .collect();
    let tokens: Vec<Vec<f64>> = (0..n_tokens)
        .map(|_| (0..d_model).map(|_| rng.gauss(0.0, 1.0)).collect())
        .collect();

    let mut bias = vec![0.0; n_experts];
    let target = (n_tokens * top_k) as f64 / n_experts as f64;

    println!("=== MoE routing: auxiliary-loss-free balance ===");
    println!(
        "config: {} experts, top-{}, {} tokens, target usage = {:.0} per expert",
        n_experts, top_k, n_tokens, target
    );
    println!();
    let mut usage = run_epoch(&tokens, &experts, &w_router, top_k, &bias);
    println!("{}", usage_line(0, &usage));

    for it in 1..11 {
        update_bias(&mut bias, &usage, target, 0.15);
        usage = run_epoch(&tokens, &experts, &w_router, top_k, &bias);
        println!("{}", usage_line(it, &usage));
    }
    println!("max entropy (uniform) = ln({}) = {:.3}", n_experts, (n_experts as f64).ln());
    println!();

    println!("=== parameter counts (FFN portion, per layer) ===");
    let ffn_params = (d_model * d_hidden * 3) as u64;
    let (toy_total, toy_active) = dense_active_params(n_experts as u64, ffn_params, top_k as u64, d_model as u64);
    println!("  toy MoE       : total={:>10}  active={:>10}", toy_total, toy_active);

    let d: u64 = 7168;
    let shared: u64 = 1;
    let routed: u64 = 256;
    let active: u64 = 8;
    let layers: u64 = 61;
    let ffn_full = 3 * d * (d as f64 * 2.67) as u64;
    let fine_expert = ffn_full / 8;
    let total_moe_per_layer = (shared + routed) * fine_expert;
    let active_moe_per_layer = (shared + active) * fine_expert;
    println!(
        "  deepseek-v3-ish per layer:  total={:.1}B  active={:.1}B",
        total_moe_per_layer as f64 / 1e9,
        active_moe_per_layer as f64 / 1e9
    );
    println!(
        "  deepseek-v3 FFN total (×{} layers): ~{:.0}B total,  ~{:.0}B active",
        layers,
        (total_moe_per_layer * layers) as f64 / 1e9,
        (active_moe_per_layer * layers) as f64 / 1e9
    );
    println!("  llama-3-70b FFN total: ~{:.0}B  (all active every token)", (32 * ffn_full) as f64 / 1e9);
    println!();
    println!("takeaway: same active FLOPs, vastly larger parameter footprint.");
}
