// Lesson: Speculative Decoding (phase 07 / lesson 16)
// Rust port of code/main.py. Standard library only.
// Source: phases/07-transformers-deep-dive/16-speculative-decoding/docs/en.md
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
    assert!(!probs.is_empty(), "cannot sample from an empty distribution");
    let u = rng.random();
    let mut c = 0.0;
    for (i, p) in probs.iter().enumerate() {
        c += p;
        if u < c {
            return i;
        }
    }
    probs.len() - 1
}

fn residual(q: &[f64], p: &[f64]) -> Vec<f64> {
    assert_eq!(q.len(), p.len(), "q and p need the same length");
    let raw: Vec<f64> = q.iter().zip(p).map(|(qi, pi)| (qi - pi).max(0.0)).collect();
    let s: f64 = raw.iter().sum();
    if s == 0.0 {
        return q.to_vec();
    }
    raw.iter().map(|r| r / s).collect()
}

fn kl(q: &[f64], p: &[f64]) -> f64 {
    assert_eq!(q.len(), p.len(), "q and p need the same length");
    let mut total = 0.0;
    for (&qi, &pi) in q.iter().zip(p) {
        if qi > 0.0 && pi > 0.0 {
            total += qi * (qi / pi).ln();
        }
    }
    total
}

fn accept_ratio(q_prob: f64, p_prob: f64) -> f64 {
    if p_prob > 0.0 {
        (q_prob / p_prob).min(1.0)
    } else {
        1.0
    }
}

fn spec_step_one_token(q: &[f64], p: &[f64], rng: &mut Rng) -> (usize, bool) {
    assert_eq!(q.len(), p.len(), "q and p need the same length");
    let d = sample(p, rng);
    let u = rng.random();
    if u < accept_ratio(q[d], p[d]) {
        return (d, true);
    }
    (sample(&residual(q, p), rng), false)
}

#[allow(dead_code)]
fn spec_step_n(q: &[f64], p: &[f64], n: usize, rng: &mut Rng) -> (usize, usize) {
    assert_eq!(q.len(), p.len(), "q and p need the same length");
    let mut accepted = 0;
    for _ in 0..n {
        let d = sample(p, rng);
        let u = rng.random();
        if u < accept_ratio(q[d], p[d]) {
            accepted += 1;
        } else {
            return (sample(&residual(q, p), rng), accepted);
        }
    }
    let bonus = sample(q, rng);
    (bonus, accepted + 1)
}

fn run_distribution_check(q: &[f64], p: &[f64], n_samples: usize, rng: &mut Rng) -> (Vec<usize>, Vec<usize>) {
    let mut spec_counts = vec![0usize; q.len()];
    let mut direct_counts = vec![0usize; q.len()];
    for _ in 0..n_samples {
        let (d, _) = spec_step_one_token(q, p, rng);
        spec_counts[d] += 1;
        direct_counts[sample(q, rng)] += 1;
    }
    (spec_counts, direct_counts)
}

fn chi_square(observed: &[usize], expected: &[usize]) -> f64 {
    assert_eq!(observed.len(), expected.len(), "observed and expected need the same length");
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

fn acceptance_rate(q: &[f64], p: &[f64], n_samples: usize, rng: &mut Rng) -> f64 {
    assert!(n_samples > 0, "n_samples must be positive");
    let mut hits = 0;
    for _ in 0..n_samples {
        let (_, was) = spec_step_one_token(q, p, rng);
        if was {
            hits += 1;
        }
    }
    hits as f64 / n_samples as f64
}

fn perturb(q: &[f64], amount: f64, rng: &mut Rng) -> Vec<f64> {
    let p: Vec<f64> = q.iter().map(|qi| (qi + amount * rng.gauss(0.0, 1.0)).max(1e-6)).collect();
    let s: f64 = p.iter().sum();
    p.iter().map(|pi| pi / s).collect()
}

fn expected_tokens_per_verify(alpha: f64, n: i32) -> f64 {
    if alpha >= 1.0 {
        return (n + 1) as f64;
    }
    if alpha == 0.0 {
        return 1.0;
    }
    (1.0 - alpha.powi(n + 1)) / (1.0 - alpha)
}

fn format_counts(counts: &[usize]) -> String {
    format!("{:?}", counts)
}

fn main() {
    let mut rng = Rng::new(7);
    let v = 8;
    let q = [0.35, 0.20, 0.15, 0.10, 0.08, 0.06, 0.04, 0.02];
    let p_good = perturb(&q, 0.02, &mut rng);
    let _p_bad = perturb(&q, 0.25, &mut rng);

    println!("=== verifier distribution ===");
    let qs: Vec<String> = q.iter().map(|qi| format!("{:.3}", qi)).collect();
    println!("  q: {}", qs.join(" "));
    println!();

    println!("=== speculative vs direct sampling (distribution equivalence) ===");
    let (spec_c, direct_c) = run_distribution_check(&q, &p_good, 50000, &mut rng);
    let chi = chi_square(&spec_c, &direct_c);
    println!("  spec   counts (50000 samples): {}", format_counts(&spec_c));
    println!("  direct counts (50000 samples): {}", format_counts(&direct_c));
    println!("  chi^2 = {:.2}   (V-1 = {} df; large means distributions differ)", chi, v - 1);
    println!(
        "  {}: spec-decoded tokens match verifier distribution",
        if chi < 30.0 { "PASS" } else { "FAIL" }
    );
    println!();

    println!("=== acceptance rate vs KL(q || p) ===");
    println!("  {:>10}  {:>14}", "KL(q||p)", "acceptance α");
    for noise in [0.005, 0.02, 0.05, 0.10, 0.25, 0.5] {
        let mut noise_rng = Rng::new((noise * 1000.0) as u64);
        let p = perturb(&q, noise, &mut noise_rng);
        let alpha = acceptance_rate(&q, &p, 5000, &mut rng);
        println!("  {:>10.4}  {:>14.3}", kl(&q, &p), alpha);
    }
    println!();

    println!("=== expected tokens per verifier call (theory) ===");
    let ns = [1, 3, 5, 7, 10];
    let header: String = ns.iter().map(|n| format!("  N={:>2}", n)).collect();
    println!("  {:>5} {}", "α", header);
    for alpha in [0.3, 0.5, 0.7, 0.85, 0.95] {
        let cells: String = ns
            .iter()
            .map(|&n| format!("  {:>4.2}", expected_tokens_per_verify(alpha, n)))
            .collect();
        println!("  {:>5.2} {}", alpha, cells);
    }
    println!();

    println!("takeaway: Leviathan's theorem holds: spec-decoded distribution = verifier's.");
    println!("          At α=0.85 and N=5: ~4.1 tokens per verifier call ≈ 4x fewer big-model");
    println!("          forwards (minus draft-model overhead).");
}
