// Lesson: DualPipe Parallelism (phase 10 / lesson 19)
// Rust port of code/main.py. Standard library only.
// Source: phases/10-llms-from-scratch/19-dualpipe-parallelism/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

#[allow(dead_code)]
struct ScheduleStats {
    name: String,
    stable_bubble_frac: f64,
    scales_with_micro_batches: bool,
    param_copies: usize,
    comm_overlap: String,
}

fn bubble_1f1b(p: usize, m: usize) -> f64 {
    let total = 2 * m + 2 * (p - 1);
    let bubble = 2 * (p - 1);
    bubble as f64 / total as f64
}

fn bubble_zero_bubble(p: usize, m: usize) -> f64 {
    let total = 3 * m + 2 * (p - 1);
    let bubble = p - 1;
    bubble as f64 / total as f64
}

fn bubble_dualpipe(p: usize, m: usize) -> f64 {
    let total = 3 * m + (p - 1);
    let bubble = (p - 1) / 2;
    bubble as f64 / total as f64
}

fn bubble_dualpipev(p: usize, m: usize) -> f64 {
    bubble_dualpipe(p, m) * 1.2
}

fn summarize(p: usize, m: usize) -> Vec<(&'static str, f64, usize, &'static str)> {
    vec![
        ("1F1B", bubble_1f1b(p, m), 1, "minimal"),
        ("Zero Bubble", bubble_zero_bubble(p, m), 1, "partial"),
        ("DualPipe", bubble_dualpipe(p, m), 2, "full"),
        ("DualPipeV", bubble_dualpipev(p, m), 1, "partial"),
    ]
}

struct Recovered {
    f1b_bubble_frac: f64,
    dualpipe_bubble_frac: f64,
    recovered_gpu_hours: f64,
}

fn gpu_hours_recovered(p: usize, m: usize, total_gpu_hours: f64) -> Recovered {
    let b1 = bubble_1f1b(p, m);
    let bd = bubble_dualpipe(p, m);
    let recovered = (b1 - bd) * total_gpu_hours;
    Recovered {
        f1b_bubble_frac: b1,
        dualpipe_bubble_frac: bd,
        recovered_gpu_hours: recovered,
    }
}

fn pct(x: f64) -> String {
    format!("{:.1}%", x * 100.0)
}

fn group_digits(s: &str) -> String {
    let (sign, rest) = if let Some(r) = s.strip_prefix('-') { ("-", r) } else { ("", s) };
    let end = rest.find(|c: char| !c.is_ascii_digit()).unwrap_or(rest.len());
    let (int_part, tail) = rest.split_at(end);
    let mut out = String::new();
    for (i, ch) in int_part.chars().enumerate() {
        if i > 0 && (int_part.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    format!("{}{}{}", sign, out, tail)
}

fn main() {
    let names = ["1F1B", "ZeroBubble", "DualPipe", "DualPipeV"];
    println!("{}", "=".repeat(70));
    println!("DUALPIPE PARALLELISM SIMULATOR (Phase 10, Lesson 19)");
    println!("{}", "=".repeat(70));
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 1: bubble fraction at P=8, micro_batches=16");
    println!("{}", "-".repeat(70));
    println!("  {:<14} {:>10} {:>14} {:>14}", "schedule", "bubble", "param copies", "comm overlap");
    for (name, b, pc, co) in summarize(8, 16) {
        println!("  {:<14} {:>9}  {:>14}  {:>14}", name, pct(b), pc, co);
    }
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 2: bubble fraction scaling vs micro_batches (P=8)");
    println!("{}", "-".repeat(70));
    let mut header = format!("  {:>6}", "M");
    for name in names {
        header += &format!("{:>12}", name);
    }
    println!("{}", header);
    for m in [4, 8, 16, 32, 64, 128] {
        let mut row = format!("  {:>6}", m);
        for (_, b, _, _) in summarize(8, m) {
            row += &format!("{:>12}", pct(b));
        }
        println!("{}", row);
    }
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 3: bubble fraction scaling vs pipeline depth (M=64 fixed)");
    println!("{}", "-".repeat(70));
    let mut header = format!("  {:>6}", "P");
    for name in names {
        header += &format!("{:>12}", name);
    }
    println!("{}", header);
    for p in [4, 8, 16, 32, 64] {
        let mut row = format!("  {:>6}", p);
        for (_, b, _, _) in summarize(p, 64) {
            row += &format!("{:>12}", pct(b));
        }
        println!("{}", row);
    }
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 4: recovered GPU-hours (DeepSeek-V3-shape run)");
    println!("{}", "-".repeat(70));
    println!("  DeepSeek-V3: 2048 H800 GPUs, ~2.8M GPU-hours total.");
    println!("  Assume P=16 pipeline depth, M=128 micro-batches per step.");
    let r = gpu_hours_recovered(16, 128, 2_800_000.0);
    println!("  1F1B bubble     : {}", pct(r.f1b_bubble_frac));
    println!("  DualPipe bubble : {}", pct(r.dualpipe_bubble_frac));
    println!("  recovered       : {} GPU-hours", group_digits(&format!("{:.0}", r.recovered_gpu_hours)));
    println!("  (that is roughly the cost of a full 70B dense pre-training run)");
    println!();

    println!("takeaway: bubbles do not grow with M for DualPipe. the 2x parameter");
    println!("          replication pays for itself at MoE scale because Expert");
    println!("          Parallelism already spreads the dominant weights thin.");
    println!("          DualPipeV drops the 2x at a small bubble cost.");
}
