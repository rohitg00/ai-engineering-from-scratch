// Lesson: Structured Outputs & Constrained Decoding (phase 05 / lesson 20)
// Rust port of code/main.py. Standard library only.
// Source: phases/05-nlp-foundations-to-advanced/20-structured-outputs-constrained-decoding/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

use std::collections::HashSet;

const PHONE_REGEX: &str = r"^\d{3}-\d{3}-\d{4}$";

struct Rng {
    state: u64,
}

impl Rng {
    fn new(seed: u64) -> Rng {
        Rng { state: seed }
    }

    fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E3779B97F4A7C15);
        let mut z = self.state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
        z ^ (z >> 31)
    }

    fn random(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    fn gauss(&mut self, mu: f64, sigma: f64) -> f64 {
        let u1 = 1.0 - self.random();
        let u2 = self.random();
        mu + sigma * (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
    }
}

struct PhoneFsm {
    accept_state: usize,
}

impl PhoneFsm {
    fn new() -> PhoneFsm {
        PhoneFsm { accept_state: 12 }
    }

    fn valid_next(&self, state: usize) -> Vec<char> {
        match state {
            0 | 1 | 2 | 4 | 5 | 6 | 8 | 9 | 10 | 11 => "0123456789".chars().collect(),
            3 | 7 => vec!['-'],
            12 => vec![],
            _ => panic!("unknown state {}", state),
        }
    }

    fn transition(&self, state: usize, ch: char) -> Option<usize> {
        if !self.valid_next(state).contains(&ch) {
            return None;
        }
        Some(state + 1)
    }

    fn is_accept(&self, state: usize) -> bool {
        state == self.accept_state
    }
}

fn softmax(xs: &[f64]) -> Vec<f64> {
    let finite: Vec<f64> = xs.iter().copied().filter(|x| *x != f64::NEG_INFINITY).collect();
    if finite.is_empty() {
        return vec![0.0; xs.len()];
    }
    let m = finite.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let exps: Vec<f64> = xs.iter().map(|&x| if x != f64::NEG_INFINITY { (x - m).exp() } else { 0.0 }).collect();
    let z: f64 = exps.iter().sum();
    exps.iter().map(|e| e / z).collect()
}

fn sample(probs: &[f64], rng: &mut Rng) -> usize {
    let r = rng.random();
    let mut acc = 0.0;
    for (i, p) in probs.iter().enumerate() {
        acc += p;
        if r <= acc {
            return i;
        }
    }
    probs.len() - 1
}

fn mask_logits(logits: &[f64], valid_indices: &HashSet<usize>) -> Vec<f64> {
    (0..logits.len()).map(|i| if valid_indices.contains(&i) { logits[i] } else { f64::NEG_INFINITY }).collect()
}

fn fake_llm_logits(alphabet: &[char], rng: &mut Rng) -> Vec<f64> {
    alphabet.iter().map(|_| rng.gauss(0.0, 1.5)).collect()
}

fn generate_constrained(alphabet: &[char], fsm: &PhoneFsm, seed: u64) -> String {
    let mut rng = Rng::new(seed);
    let mut state = 0;
    let mut out = String::new();
    while !fsm.is_accept(state) {
        let logits = fake_llm_logits(alphabet, &mut rng);
        let valid_chars = fsm.valid_next(state);
        if valid_chars.is_empty() {
            break;
        }
        let valid_ids: HashSet<usize> =
            valid_chars.iter().map(|c| alphabet.iter().position(|a| a == c).unwrap()).collect();
        let masked = mask_logits(&logits, &valid_ids);
        let probs = softmax(&masked);
        let pick = sample(&probs, &mut rng);
        let ch = alphabet[pick];
        out.push(ch);
        match fsm.transition(state, ch) {
            Some(next) => state = next,
            None => break,
        }
    }
    out
}

fn generate_unconstrained(alphabet: &[char], max_len: usize, seed: u64) -> String {
    let mut rng = Rng::new(seed);
    let mut out = String::new();
    for _ in 0..max_len {
        let logits = fake_llm_logits(alphabet, &mut rng);
        let probs = softmax(&logits);
        let pick = sample(&probs, &mut rng);
        out.push(alphabet[pick]);
    }
    out
}

fn matches_phone(s: &str) -> bool {
    let chars: Vec<char> = s.chars().collect();
    chars.len() == 12
        && chars.iter().enumerate().all(|(i, c)| if i == 3 || i == 7 { *c == '-' } else { c.is_ascii_digit() })
}

fn main() {
    let alphabet: Vec<char> = "0123456789-".chars().collect();
    let fsm = PhoneFsm::new();

    println!("=== phone number generation: 20 samples ===");
    println!("target pattern: {}", PHONE_REGEX);
    println!();

    println!("UNCONSTRAINED (random-logit, no masking):");
    let mut unc_valid = 0;
    for seed in 0..20 {
        let s = generate_unconstrained(&alphabet, 12, seed);
        let ok = matches_phone(&s);
        unc_valid += ok as usize;
        let tag = if ok { "  OK" } else { "FAIL" };
        println!("  [{}] {}", tag, s);
    }
    println!("  => valid: {} / 20", unc_valid);

    println!();
    println!("CONSTRAINED (FSM-masked logits):");
    let mut con_valid = 0;
    for seed in 0..20 {
        let s = generate_constrained(&alphabet, &fsm, seed);
        let ok = matches_phone(&s);
        con_valid += ok as usize;
        let tag = if ok { "  OK" } else { "FAIL" };
        println!("  [{}] {}", tag, s);
    }
    println!("  => valid: {} / 20", con_valid);

    println!();
    println!("note: the toy LLM emits uniform-random logits.");
    println!("masking invalid tokens at each step is the only difference.");
    println!("real constrained decoding uses the same mask over a 100k+ vocabulary.");
}
