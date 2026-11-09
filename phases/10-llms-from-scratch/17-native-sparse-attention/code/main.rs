// Lesson: Native Sparse Attention (DeepSeek NSA) (phase 10 / lesson 17)
// Rust port of code/main.py. Standard library only.
// Source: phases/10-llms-from-scratch/17-native-sparse-attention/docs/en.md
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

fn softmax(row: &[f64]) -> Vec<f64> {
    let m = row.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let exps: Vec<f64> = row.iter().map(|x| (x - m).exp()).collect();
    let s: f64 = exps.iter().sum();
    exps.iter().map(|e| e / s).collect()
}

fn attention(q: &[f64], k: &[Vec<f64>], v: &[Vec<f64>]) -> (Vec<f64>, Vec<f64>) {
    let scale = (q.len() as f64).sqrt();
    let scores: Vec<f64> = k.iter().map(|kr| dot(q, kr) / scale).collect();
    let w = softmax(&scores);
    let d_v = v[0].len();
    let out = (0..d_v).map(|c| (0..v.len()).map(|j| w[j] * v[j][c]).sum()).collect();
    (w, out)
}

fn compress_mean(k: &[Vec<f64>], l: usize) -> Matrix {
    let n = k.len();
    let d = k[0].len();
    let n_blocks = n.div_ceil(l);
    let mut out = Vec::new();
    for b in 0..n_blocks {
        let (start, end) = (b * l, ((b + 1) * l).min(n));
        let block = &k[start..end];
        let summary = (0..d)
            .map(|c| block.iter().map(|row| row[c]).sum::<f64>() / block.len() as f64)
            .collect();
        out.push(summary);
    }
    out
}

fn top_k_blocks(scores: &[f64], k: usize) -> Vec<usize> {
    let mut indexed: Vec<usize> = (0..scores.len()).collect();
    indexed.sort_by(|&a, &b| scores[b].partial_cmp(&scores[a]).expect("finite scores"));
    let mut picks: Vec<usize> = indexed.into_iter().take(k).collect();
    picks.sort();
    picks
}

fn fine_grained_keys(k: &[Vec<f64>], v: &[Vec<f64>], l: usize, block_indices: &[usize]) -> (Matrix, Matrix) {
    let mut k_out = Vec::new();
    let mut v_out = Vec::new();
    for &b in block_indices {
        let (start, end) = (b * l, ((b + 1) * l).min(k.len()));
        k_out.extend_from_slice(&k[start..end]);
        v_out.extend_from_slice(&v[start..end]);
    }
    (k_out, v_out)
}

fn sliding_window(k: &[Vec<f64>], v: &[Vec<f64>], w: usize) -> (Matrix, Matrix) {
    let n = k.len();
    let start = n.saturating_sub(w);
    (k[start..].to_vec(), v[start..].to_vec())
}

fn gate(q: &[f64], wg: &[Vec<f64>]) -> Vec<f64> {
    (0..3).map(|i| 1.0 / (1.0 + (-dot(q, &wg[i])).exp())).collect()
}

struct NsaConfig {
    l: usize,
    k: usize,
    w: usize,
}

struct NsaInfo {
    cmp_keys: usize,
    sel_keys: usize,
    win_keys: usize,
    total_keys: usize,
    full_keys: usize,
    selected_blocks: Vec<usize>,
    gates: Vec<f64>,
}

fn nsa_step(q: &[f64], k: &[Vec<f64>], v: &[Vec<f64>], wg: &[Vec<f64>], cfg: &NsaConfig) -> (Vec<f64>, NsaInfo) {
    let k_cmp = compress_mean(k, cfg.l);
    let v_cmp = compress_mean(v, cfg.l);
    let (cmp_w, cmp_out) = attention(q, &k_cmp, &v_cmp);

    let picks = top_k_blocks(&cmp_w, cfg.k);
    let (k_sel, v_sel) = fine_grained_keys(k, v, cfg.l, &picks);
    let sel_out = if !k_sel.is_empty() {
        attention(q, &k_sel, &v_sel).1
    } else {
        vec![0.0; q.len()]
    };

    let (k_win, v_win) = sliding_window(k, v, cfg.w);
    let (_, win_out) = attention(q, &k_win, &v_win);

    let g = gate(q, wg);
    let combined = (0..cmp_out.len())
        .map(|i| g[0] * cmp_out[i] + g[1] * sel_out[i] + g[2] * win_out[i])
        .collect();

    let info = NsaInfo {
        cmp_keys: k_cmp.len(),
        sel_keys: k_sel.len(),
        win_keys: k_win.len(),
        total_keys: k_cmp.len() + k_sel.len() + k_win.len(),
        full_keys: k.len(),
        selected_blocks: picks,
        gates: g,
    };
    (combined, info)
}

fn synthesize_sequence(n: usize, d: usize, signal_blocks: &[usize], l: usize, rng: &mut Rng) -> (Matrix, Matrix, Vec<f64>) {
    let pattern: Vec<f64> = (0..d).map(|_| rng.gauss(0.0, 1.0)).collect();
    let norm = pattern.iter().map(|x| x * x).sum::<f64>().sqrt();
    let pattern: Vec<f64> = pattern.iter().map(|x| x / norm).collect();
    let mut k: Matrix = (0..n).map(|_| (0..d).map(|_| rng.gauss(0.0, 0.3)).collect()).collect();
    let v: Matrix = (0..n).map(|_| (0..d).map(|_| rng.gauss(0.0, 1.0)).collect()).collect();
    for &b in signal_blocks {
        let (start, end) = (b * l, ((b + 1) * l).min(n));
        for row in k.iter_mut().take(end).skip(start) {
            *row = pattern.clone();
        }
    }
    let q = pattern.clone();
    (k, v, q)
}

fn count_full_attention(n: usize) -> usize {
    n
}

fn count_nsa(n: usize, l: usize, k: usize, w: usize) -> usize {
    (n / l) + (k * l) + w
}

fn list_str(v: &[usize]) -> String {
    let parts: Vec<String> = v.iter().map(|x| x.to_string()).collect();
    format!("[{}]", parts.join(", "))
}

fn group_digits(n: usize) -> String {
    let s = n.to_string();
    let mut out = String::new();
    for (i, ch) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    out
}

fn main() {
    let mut rng = Rng::new(11);
    println!("{}", "=".repeat(70));
    println!("NATIVE SPARSE ATTENTION: DeepSeek NSA (Phase 10, Lesson 17)");
    println!("{}", "=".repeat(70));
    println!();

    let d = 16;
    let n = 1024;
    let (l, k, w) = (32, 4, 128);
    let signal_blocks = vec![3usize, 17, 28];

    println!("{}", "-".repeat(70));
    println!("Step 1: synthetic N={}, d={}, signal at blocks {}", n, d, list_str(&signal_blocks));
    println!("        config: l={} (compression block), k={} (top-k), W={} (sliding window)", l, k, w);
    println!("{}", "-".repeat(70));

    let (keys, values, q) = synthesize_sequence(n, d, &signal_blocks, l, &mut rng);
    let wg: Matrix = (0..3).map(|_| (0..d).map(|_| rng.gauss(0.0, 0.5)).collect()).collect();

    let (_out, info) = nsa_step(&q, &keys, &values, &wg, &NsaConfig { l, k, w });

    println!("  compressed branch keys : {}", info.cmp_keys);
    println!("  selected branch keys   : {}  (blocks {})", info.sel_keys, list_str(&info.selected_blocks));
    println!("  sliding window keys    : {}", info.win_keys);
    println!("  total keys attended    : {}", info.total_keys);
    println!(
        "  full-attention keys    : {}  ({:.1}x more)",
        info.full_keys,
        info.full_keys as f64 / info.total_keys as f64
    );
    println!(
        "  gate weights (cmp/sel/win): {:.3} / {:.3} / {:.3}",
        info.gates[0], info.gates[1], info.gates[2]
    );
    println!();

    let hit_signal: Vec<usize> = info.selected_blocks.iter().copied().filter(|b| signal_blocks.contains(b)).collect();
    let miss_signal: Vec<usize> = signal_blocks.iter().copied().filter(|b| !info.selected_blocks.contains(b)).collect();
    println!("  signal blocks retrieved: {}  (missed: {})", list_str(&hit_signal), list_str(&miss_signal));
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 2: compute savings at production context lengths");
    println!("{}", "-".repeat(70));
    println!(
        "  {:>8} {:>4} {:>4} {:>5}  {:>10}  {:>10}  {:>9}",
        "N", "l", "k", "W", "NSA keys", "full keys", "savings"
    );
    for (n_prod, l_prod, k_prod, w_prod) in [
        (4_096, 32, 8, 256),
        (16_384, 32, 16, 512),
        (32_768, 64, 16, 512),
        (65_536, 64, 16, 512),
        (131_072, 64, 16, 512),
        (262_144, 64, 16, 512),
    ] {
        let nsa = count_nsa(n_prod, l_prod, k_prod, w_prod);
        let full = count_full_attention(n_prod);
        println!(
            "  {:>8} {:>4} {:>4} {:>5}  {:>10} {:>10}  {:>8.1}x",
            n_prod,
            l_prod,
            k_prod,
            w_prod,
            group_digits(nsa),
            group_digits(full),
            full as f64 / nsa as f64
        );
    }
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 3: block-size vs top-k sweep (cost at N=65536, W=512)");
    println!("{}", "-".repeat(70));
    println!("  {:>4} {:>4}  {:>8}  {:>8}", "l", "k", "keys", "vs full");
    for l_p in [32, 64, 128] {
        for k_p in [8, 16, 32] {
            let cost = count_nsa(65_536, l_p, k_p, 512);
            println!("  {:>4} {:>4}  {:>8}  {:>7.1}x", l_p, k_p, group_digits(cost), 65_536.0 / cost as f64);
        }
    }
    println!();

    println!("takeaway: NSA's 3-branch decomposition turns O(N^2) attention into");
    println!("          O(N * (N/l + k*l + W)). At 64k-128k context, 25x-36x");
    println!("          fewer keys per query. Gradient flows through the");
    println!("          compressed-branch scores, so top-k selection is natively");
    println!("          trainable.");
}
