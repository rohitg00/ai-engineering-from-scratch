// Lesson: Scaling Laws (phase 07 / lesson 13)
// Rust port of code/main.py. Standard library only.
// Source: phases/07-transformers-deep-dive/13-scaling-laws/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

const A: f64 = 406.4;
const B_CONST: f64 = 410.7;
const ALPHA: f64 = 0.34;
const BETA: f64 = 0.28;
const E_CONST: f64 = 1.69;

fn chinchilla_loss(n: f64, d: f64) -> f64 {
    A / n.powf(ALPHA) + B_CONST / d.powf(BETA) + E_CONST
}

fn compute_optimal(c_flops: f64, n_grid: usize) -> (f64, f64, f64) {
    let log_n_min = 1e5f64.log10();
    let log_n_max = 1e13f64.log10();
    let mut best = (f64::NAN, f64::NAN, f64::INFINITY);
    for i in 0..n_grid {
        let log_n = log_n_min + (log_n_max - log_n_min) * i as f64 / (n_grid - 1) as f64;
        let n = 10f64.powf(log_n);
        let d = c_flops / (6.0 * n);
        if d < 1e6 {
            continue;
        }
        let loss = chinchilla_loss(n, d);
        if loss < best.2 {
            best = (n, d, loss);
        }
    }
    best
}

fn pretty(n: f64) -> String {
    for (unit, k) in [("T", 1e12), ("B", 1e9), ("M", 1e6), ("K", 1e3)] {
        if n >= k {
            return format!("{:.1}{}", n / k, unit);
        }
    }
    format!("{:.0}", n)
}

fn sci0(x: f64) -> String {
    let s = format!("{:.0e}", x);
    let (mantissa, exp) = s.split_once('e').unwrap();
    let e: i32 = exp.parse().unwrap();
    let sign = if e < 0 { '-' } else { '+' };
    format!("{}e{}{:02}", mantissa, sign, e.abs())
}

fn main() {
    println!("=== compute-optimal (N, D) across compute budgets ===");
    println!("{:>12}  {:>10}  {:>10}  {:>7}  {:>7}", "compute", "N*", "D*", "D/N", "loss");
    for c in [1e18, 1e19, 1e20, 1e21, 1e22, 1e23, 1e24, 1e25] {
        let (n, d, l) = compute_optimal(c, 200);
        println!(
            "  {:>10}   {:>9}   {:>9}   {:>6.1}   {:>6.3}",
            sci0(c),
            pretty(n),
            pretty(d),
            d / n,
            l
        );
    }
    println!();
    println!("Hoffmann 2022 published D/N ≈ 20 as the headline. with the fitted");
    println!("constants above (alpha=0.34, beta=0.28) the optimum D/N grows with C.");
    println!("Hoffmann's direct fits put the optimum near 20 at ~1e22 to 1e23 FLOPs;");
    println!("this parametric fit gives 65 to 85 there, so the two methods disagree.");
    println!();

    println!("=== over-training cost (Llama-style) ===");
    let c = 1e24;
    let (n_opt, d_opt, l_opt) = compute_optimal(c, 200);
    let n_under = n_opt / 10.0;
    let d_over = d_opt * 10.0;
    let l_over = chinchilla_loss(n_under, d_over);
    println!("compute budget:                 {} FLOPs", sci0(c));
    println!(
        "chinchilla optimal:             N={}  D={}  loss={:.3}",
        pretty(n_opt),
        pretty(d_opt),
        l_opt
    );
    println!(
        "over-trained  (N/10, D×10):     N={}  D={}  loss={:.3}",
        pretty(n_under),
        pretty(d_over),
        l_over
    );
    println!("loss penalty (over-train):      {:+.3}", l_over - l_opt);
    println!("inference FLOP savings (~N):    {:.0}x cheaper at inference", n_opt / n_under);
    println!();

    println!("=== real models vs predicted loss ===");
    let models = [
        ("GPT-3 175B", 175e9, 300e9),
        ("Chinchilla 70B", 70e9, 1400e9),
        ("Llama 2 70B", 70e9, 2000e9),
        ("Llama 3 8B", 8e9, 15_000e9),
        ("Llama 3 70B", 70e9, 15_000e9),
        ("DeepSeek-V3 (active)", 37e9, 14_800e9),
        ("Qwen 2.5 72B", 72e9, 18_000e9),
    ];
    println!("{:<24}  {:>8}  {:>8}  {:>7}  {:>7}", "model", "N", "D", "D/N", "loss");
    for (name, n, d) in models {
        let l = chinchilla_loss(n, d);
        println!(
            "  {:<22}  {:>7}  {:>7}  {:>6.1}  {:>6.3}",
            name,
            pretty(n),
            pretty(d),
            d / n,
            l
        );
    }
    println!();
    println!("many 2026 models are massively past chinchilla (D/N ≈ 20).");
    println!("reason: inference cost scales with N; over-training saves inference");
    println!("at the price of extra pretrain FLOPs.");
}
