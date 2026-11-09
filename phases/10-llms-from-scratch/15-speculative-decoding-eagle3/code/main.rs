// Lesson: Speculative Decoding and EAGLE-3 (phase 10 / lesson 15)
// Rust port of code/main.py. Standard library only.
// Source: phases/10-llms-from-scratch/15-speculative-decoding-eagle3/docs/en.md
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

fn sample(probs: &[f64], rng: &mut Rng) -> usize {
    let u = rng.random();
    let mut acc = 0.0;
    for (i, p) in probs.iter().enumerate() {
        acc += p;
        if u < acc {
            return i;
        }
    }
    probs.len() - 1
}

fn residual(q: &[f64], p: &[f64]) -> Vec<f64> {
    let raw: Vec<f64> = q.iter().zip(p).map(|(qi, pi)| (qi - pi).max(0.0)).collect();
    let s: f64 = raw.iter().sum();
    if s == 0.0 {
        return q.to_vec();
    }
    raw.iter().map(|r| r / s).collect()
}

fn kl(q: &[f64], p: &[f64]) -> f64 {
    let mut total = 0.0;
    for (qi, pi) in q.iter().zip(p) {
        if *qi > 0.0 && *pi > 0.0 {
            total += qi * (qi / pi).ln();
        }
    }
    total
}

#[derive(Default)]
struct KvBuffer {
    length: usize,
}

impl KvBuffer {
    fn extend(&mut self, n: usize) {
        self.length += n;
    }

    fn truncate_to(&mut self, n: usize) {
        self.length = n;
    }
}

fn spec_step(q: &[f64], p: &[f64], n: usize, kv: &mut KvBuffer, rng: &mut Rng) -> (Vec<usize>, usize) {
    let prefix_len = kv.length;
    let mut drafts = Vec::new();
    let mut p_probs = Vec::new();
    for _ in 0..n {
        let d = sample(p, rng);
        drafts.push(d);
        p_probs.push(p[d]);
    }

    let mut emitted = Vec::new();
    for (i, &d) in drafts.iter().enumerate() {
        let u = rng.random();
        let q_prob = q[d];
        let p_prob = p_probs[i];
        let ratio = if p_prob > 0.0 { q_prob / p_prob } else { f64::INFINITY };
        if u < ratio.min(1.0) {
            emitted.push(d);
            kv.extend(1);
        } else {
            let correction = sample(&residual(q, p), rng);
            emitted.push(correction);
            kv.truncate_to(prefix_len + emitted.len());
            return (emitted, 1);
        }
    }

    let bonus = sample(q, rng);
    emitted.push(bonus);
    kv.extend(1);
    (emitted, 1)
}

#[allow(dead_code)]
fn direct_sample(q: &[f64], n: usize, rng: &mut Rng) -> Vec<usize> {
    (0..n).map(|_| sample(q, rng)).collect()
}

fn distribution_check(q: &[f64], p: &[f64], n_steps: usize, rng: &mut Rng) -> (Vec<usize>, Vec<usize>) {
    let mut spec_counts = vec![0; q.len()];
    let mut direct_counts = vec![0; q.len()];
    for _ in 0..n_steps {
        let mut kv = KvBuffer::default();
        let (tokens, _) = spec_step(q, p, 1, &mut kv, rng);
        spec_counts[tokens[0]] += 1;
        direct_counts[sample(q, rng)] += 1;
    }
    (spec_counts, direct_counts)
}

fn chi_square(observed: &[usize], expected: &[usize]) -> f64 {
    let total_obs: usize = observed.iter().sum();
    let total_exp: usize = expected.iter().sum();
    if total_obs == 0 || total_exp == 0 {
        return 0.0;
    }
    let mut result = 0.0;
    for (&o, &e) in observed.iter().zip(expected) {
        let e_norm = e as f64 * total_obs as f64 / total_exp as f64;
        if e_norm > 0.0 {
            result += (o as f64 - e_norm).powi(2) / e_norm;
        }
    }
    result
}

fn measure_alpha(q: &[f64], p: &[f64], n_samples: usize, rng: &mut Rng) -> f64 {
    let mut hits = 0;
    for _ in 0..n_samples {
        let d = sample(p, rng);
        let u = rng.random();
        let q_prob = q[d];
        let p_prob = p[d];
        if p_prob > 0.0 && u < (q_prob / p_prob).min(1.0) {
            hits += 1;
        }
    }
    hits as f64 / n_samples as f64
}

fn expected_tokens_per_verify(alpha: f64, n: usize) -> f64 {
    if alpha >= 1.0 {
        return (n + 1) as f64;
    }
    if alpha <= 0.0 {
        return 1.0;
    }
    (1.0 - alpha.powf((n + 1) as f64)) / (1.0 - alpha)
}

fn wall_time_per_token(alpha: f64, n: usize, c: f64) -> f64 {
    (1.0 + n as f64 * c) / expected_tokens_per_verify(alpha, n)
}

fn perturb(q: &[f64], amount: f64, rng: &mut Rng) -> Vec<f64> {
    let p: Vec<f64> = q.iter().map(|qi| (qi + amount * rng.gauss(0.0, 1.0)).max(1e-6)).collect();
    let s: f64 = p.iter().sum();
    p.iter().map(|pi| pi / s).collect()
}

fn list_str(v: &[usize]) -> String {
    let parts: Vec<String> = v.iter().map(|x| x.to_string()).collect();
    format!("[{}]", parts.join(", "))
}

fn main() {
    let mut rng = Rng::new(2);

    let q = vec![0.30, 0.22, 0.15, 0.10, 0.08, 0.07, 0.05, 0.03];
    let p_eagle3 = perturb(&q, 0.005, &mut Rng::new(1));
    let p_eagle1 = perturb(&q, 0.02, &mut Rng::new(2));
    let p_vanilla = perturb(&q, 0.08, &mut Rng::new(20));

    println!("{}", "=".repeat(70));
    println!("SPECULATIVE DECODING AND EAGLE-3 (Phase 10, Lesson 15)");
    println!("{}", "=".repeat(70));
    println!();
    let qs: Vec<String> = q.iter().map(|qi| format!("{:.3}", qi)).collect();
    println!("verifier q:  {}", qs.join(" "));
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 1: Leviathan distribution-equivalence check (N=1, 50000 trials)");
    println!("{}", "-".repeat(70));
    let (spec_c, direct_c) = distribution_check(&q, &p_eagle1, 50000, &mut rng);
    let chi = chi_square(&spec_c, &direct_c);
    println!("  spec   counts: {}", list_str(&spec_c));
    println!("  direct counts: {}", list_str(&direct_c));
    println!("  chi^2 = {:.2}  (df={}; 95% crit ~14.07)", chi, q.len() - 1);
    let verdict = if chi < 14.07 { "PASS" } else { "CHECK" };
    println!("  verdict: {}  (spec-decoded distribution matches verifier)", verdict);
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 2: measured acceptance rate alpha per draft quality");
    println!("{}", "-".repeat(70));
    println!("  {:<12} {:>10} {:>8}", "draft", "KL(q||p)", "alpha");
    for (name, p) in [("vanilla", &p_vanilla), ("eagle-1", &p_eagle1), ("eagle-3", &p_eagle3)] {
        let a = measure_alpha(&q, p, 20000, &mut Rng::new(7));
        println!("  {:<12} {:>10.4} {:>8.3}", name, kl(&q, p), a);
    }
    println!();

    let ns = [1usize, 3, 5, 7, 10];
    let alphas = [0.55, 0.70, 0.80, 0.90, 0.95];
    let header: String = ns.iter().map(|n| format!("{:>8}", format!("N={}", n))).collect();

    println!("{}", "-".repeat(70));
    println!("Step 3: expected tokens per verifier call (theory)");
    println!("{}", "-".repeat(70));
    println!("  {:>6}  {}", "alpha", header);
    for a in alphas {
        let cells: String = ns.iter().map(|&n| format!("{:>8.2}", expected_tokens_per_verify(a, n))).collect();
        println!("  {:>6.2}  {}", a, cells);
    }
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 4: wall time per token at c=0.04 (EAGLE-3-class draft cost)");
    println!("{}", "-".repeat(70));
    println!("  {:>6}  {}", "alpha", header);
    for a in alphas {
        let cells: String = ns.iter().map(|&n| format!("{:>8.3}", wall_time_per_token(a, n, 0.04))).collect();
        println!("  {:>6.2}  {}", a, cells);
    }
    println!("  (lower = faster. baseline no-spec-decode = 1.000 per token)");
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 5: end-to-end simulated run, N=5, draft=eagle-3, 1000 rounds");
    println!("{}", "-".repeat(70));
    let mut kv = KvBuffer::default();
    let mut total_tokens = 0;
    let mut total_forwards = 0;
    let mut accepted_per_round: Vec<usize> = Vec::new();
    for _ in 0..1000 {
        let (tokens, forwards) = spec_step(&q, &p_eagle3, 5, &mut kv, &mut rng);
        total_tokens += tokens.len();
        total_forwards += forwards;
        accepted_per_round.push(tokens.len());
    }
    let mean_tokens = total_tokens as f64 / 1000.0;
    println!("  total tokens emitted : {}", total_tokens);
    println!("  verifier forwards    : {}", total_forwards);
    println!("  mean tokens / forward: {:.2}", mean_tokens);
    println!("  kv logical length    : {}   (tracks accepted prefix)", kv.length);
    println!("  expected at alpha=0.95, N=5: {:.2}", expected_tokens_per_verify(0.95, 5));
    println!();

    println!("takeaway: EAGLE-3 class draft quality (alpha~0.9) at N=5 delivers");
    println!("          ~4-5 tokens per verifier forward. The 3-6.5x EAGLE-3 paper");
    println!("          number is that ratio plus tree-search and TTT gains.");
}
