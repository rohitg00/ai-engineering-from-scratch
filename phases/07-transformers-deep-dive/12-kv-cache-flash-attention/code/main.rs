// Lesson: KV Cache, Flash Attention & Inference Optimization (phase 07 / lesson 12)
// Rust port of code/main.py. Standard library only.
// Source: phases/07-transformers-deep-dive/12-kv-cache-flash-attention/docs/en.md
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

fn fmt_e(x: f64, prec: usize) -> String {
    if x.is_nan() {
        return "nan".to_string();
    }
    if x.is_infinite() {
        return if x > 0.0 { "inf".to_string() } else { "-inf".to_string() };
    }
    let s = format!("{:.*e}", prec, x);
    let (mantissa, exp) = s.split_once('e').expect("exponent");
    let exp: i32 = exp.parse().expect("integer exponent");
    let sign = if exp < 0 { '-' } else { '+' };
    format!("{}e{}{:02}", mantissa, sign, exp.abs())
}

fn dot(a: &[f64], b: &[f64]) -> f64 {
    assert_eq!(a.len(), b.len(), "dot: vectors must have the same length");
    a.iter().zip(b).map(|(x, y)| x * y).sum()
}

fn softmax(xs: &[f64]) -> Vec<f64> {
    assert!(!xs.is_empty(), "softmax: input must not be empty");
    let m = xs.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let exps: Vec<f64> = xs.iter().map(|x| (x - m).exp()).collect();
    let s: f64 = exps.iter().sum();
    exps.iter().map(|e| e / s).collect()
}

fn check_kv(q: &[f64], ks: &[Vec<f64>], vs: &[Vec<f64>]) {
    assert!(!q.is_empty(), "attention: query must not be empty");
    assert!(!ks.is_empty(), "attention: need at least one key");
    assert_eq!(ks.len(), vs.len(), "attention: keys and values must have the same count");
}

fn attention_full(q: &[f64], ks: &[Vec<f64>], vs: &[Vec<f64>]) -> Vec<f64> {
    check_kv(q, ks, vs);
    let scale = (q.len() as f64).sqrt();
    let scores: Vec<f64> = ks.iter().map(|k| dot(q, k) / scale).collect();
    let weights = softmax(&scores);
    let mut out = vec![0.0; vs[0].len()];
    for (w, v) in weights.iter().zip(vs) {
        for j in 0..out.len() {
            out[j] += w * v[j];
        }
    }
    out
}

fn tiled_softmax_dot(q: &[f64], ks: &[Vec<f64>], vs: &[Vec<f64>], tile: usize) -> Vec<f64> {
    check_kv(q, ks, vs);
    assert!(tile > 0, "tiled_softmax_dot: tile must be positive");
    let d_head = vs[0].len();
    let scale = 1.0 / (q.len() as f64).sqrt();
    let mut m = f64::NEG_INFINITY;
    let mut s = 0.0;
    let mut out = vec![0.0; d_head];
    let mut start = 0;
    while start < ks.len() {
        let end = (start + tile).min(ks.len());
        let k_block = &ks[start..end];
        let v_block = &vs[start..end];
        let scores: Vec<f64> = k_block.iter().map(|k| dot(q, k) * scale).collect();
        let new_m = scores.iter().cloned().fold(m, f64::max);
        let exp_old = if m == f64::NEG_INFINITY { 0.0 } else { (m - new_m).exp() };
        let exp_new: Vec<f64> = scores.iter().map(|sc| (sc - new_m).exp()).collect();
        s = s * exp_old + exp_new.iter().sum::<f64>();
        for j in 0..d_head {
            let block: f64 = exp_new.iter().zip(v_block).map(|(e, v)| e * v[j]).sum();
            out[j] = out[j] * exp_old + block;
        }
        m = new_m;
        start = end;
    }
    out.iter().map(|o| o / s).collect()
}

struct KVCache {
    k: Vec<Vec<f64>>,
    v: Vec<Vec<f64>>,
}

impl KVCache {
    fn new() -> Self {
        KVCache { k: Vec::new(), v: Vec::new() }
    }

    fn append(&mut self, k: &[f64], v: &[f64]) {
        self.k.push(k.to_vec());
        self.v.push(v.to_vec());
    }

    fn len(&self) -> usize {
        self.k.len()
    }
}

fn decode_naive(all_k: &[Vec<f64>], all_v: &[Vec<f64>], all_q: &[Vec<f64>]) -> (Vec<Vec<f64>>, usize) {
    let mut outputs = Vec::new();
    let mut ops = 0;
    for (t, q) in all_q.iter().enumerate() {
        let out = attention_full(q, &all_k[..t + 1], &all_v[..t + 1]);
        ops += t + 1;
        outputs.push(out);
    }
    (outputs, ops)
}

fn decode_cached(all_k: &[Vec<f64>], all_v: &[Vec<f64>], all_q: &[Vec<f64>]) -> (Vec<Vec<f64>>, usize) {
    let mut cache = KVCache::new();
    let mut outputs = Vec::new();
    let mut ops = 0;
    for ((q, k), v) in all_q.iter().zip(all_k).zip(all_v) {
        cache.append(k, v);
        let out = attention_full(q, &cache.k, &cache.v);
        ops += cache.len();
        outputs.push(out);
    }
    (outputs, ops)
}

fn kv_cache_bytes(n: u64, n_layers: u64, n_heads_kv: u64, d_head: u64, dtype: u64) -> u64 {
    2 * n * n_layers * n_heads_kv * d_head * dtype
}

fn random_matrix(rng: &mut Rng, rows: usize, cols: usize) -> Vec<Vec<f64>> {
    (0..rows).map(|_| (0..cols).map(|_| rng.gauss(0.0, 1.0)).collect()).collect()
}

fn max_abs_diff(a: &[f64], b: &[f64]) -> f64 {
    a.iter().zip(b).map(|(x, y)| (x - y).abs()).fold(0.0, f64::max)
}

fn main() {
    let mut rng = Rng::new(42);
    let d_head = 8;
    let n = 10;

    let all_q = random_matrix(&mut rng, n, d_head);
    let all_k = random_matrix(&mut rng, n, d_head);
    let all_v = random_matrix(&mut rng, n, d_head);

    let (naive, naive_ops) = decode_naive(&all_k, &all_v, &all_q);
    let (cached, cached_ops) = decode_cached(&all_k, &all_v, &all_q);

    println!("=== naive vs KV-cached decoding on N={} tokens ===", n);
    println!("naive attention ops:  {}  (O(N^2) = {})", naive_ops, n * (n + 1) / 2);
    println!("cached attention ops: {}  (O(N) with per-step cost, unchanged)", cached_ops);
    let diff = naive
        .iter()
        .zip(&cached)
        .map(|(a, b)| max_abs_diff(a, b))
        .fold(0.0, f64::max);
    println!("outputs match (max abs diff over all tokens): {}", fmt_e(diff, 2));
    println!();
    println!("* naive has same per-step cost; saving comes from not REcomputing earlier");
    println!("  hidden states. counting K,V recomputes would make naive O(N^2) in matmuls.");
    println!();

    println!("=== tiled-softmax (Flash) vs standard softmax agreement ===");
    let q = &all_q[n - 1];
    let std_out = attention_full(q, &all_k, &all_v);
    for tile in [1, 2, 4, 8, 32] {
        let tiled = tiled_softmax_dot(q, &all_k, &all_v, tile);
        let err = max_abs_diff(&std_out, &tiled);
        println!("  tile={:>3}  max abs diff = {}", tile, fmt_e(err, 2));
    }
    println!("  bit-identical up to floating-point reassociation. no approximation.");
    println!();

    println!("=== KV cache size table (fp16) ===");
    let configs: [(&str, u64, u64, u64); 6] = [
        ("Llama-3.2-3B", 28, 8, 128),
        ("Llama-3-8B", 32, 8, 128),
        ("Llama-3-70B", 80, 8, 128),
        ("Llama-3.1-405B", 126, 8, 128),
        ("Qwen2.5-72B", 80, 8, 128),
        ("DeepSeek-V3 (MLA)", 61, 1, 512),
    ];
    for (name, layers, h_kv, d_h) in configs {
        for n_ctx in [2048u64, 32768, 131072] {
            let b = kv_cache_bytes(n_ctx, layers, h_kv, d_h, 2);
            println!("  {:<24}  N={:>7}  -> {:.2} GB", name, n_ctx, b as f64 / 1e9);
        }
    }
    println!();
    println!("takeaway: at 128K context, 70B-class dense models use 10+ GB just for KV.");
    println!("GQA and MLA are why modern long-context inference is affordable.");
}
