// Lesson: Async and Hogwild! Inference (phase 10 / lesson 22)
// Rust port of code/main.py. Standard library only.
// Source: phases/10-llms-from-scratch/22-async-hogwild-inference/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

struct Rng {
    state: u64,
}

impl Rng {
    fn new(seed: u64) -> Self {
        Rng { state: seed }
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
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Category {
    A,
    B,
    Noise,
    Coord,
}

#[derive(Clone, Copy, Debug)]
struct Counts {
    a: usize,
    b: usize,
    noise: usize,
    coord: usize,
}

impl Counts {
    fn get(&self, cat: Category) -> usize {
        match cat {
            Category::A => self.a,
            Category::B => self.b,
            Category::Noise => self.noise,
            Category::Coord => self.coord,
        }
    }

    fn repr(&self) -> String {
        format!(
            "{{'A': {}, 'B': {}, 'noise': {}, 'coord': {}}}",
            self.a, self.b, self.noise, self.coord
        )
    }
}

struct SharedCache {
    tokens: Vec<(usize, Category)>,
}

impl SharedCache {
    fn counts(&self) -> Counts {
        let mut c = Counts { a: 0, b: 0, noise: 0, coord: 0 };
        for &(_, cat) in &self.tokens {
            match cat {
                Category::A => c.a += 1,
                Category::B => c.b += 1,
                Category::Noise => c.noise += 1,
                Category::Coord => c.coord += 1,
            }
        }
        c
    }
}

struct Worker {
    id: usize,
    intended: Category,
    coordination_weight: f64,
    rng: Rng,
}

fn decide_next_category(worker: &mut Worker, cache: &SharedCache, _target_per_category: usize) -> Category {
    if worker.rng.random() < 0.05 {
        return Category::Noise;
    }

    let counts = cache.counts();
    let base = worker.intended;

    if worker.rng.random() < worker.coordination_weight {
        let mut candidates = [Category::A, Category::B];
        candidates.sort_by_key(|&c| counts.get(c));
        return candidates[0];
    }

    if worker.rng.random() < 0.1 {
        return Category::Coord;
    }

    base
}

#[allow(dead_code)]
#[derive(Debug)]
struct HogwildResult {
    workers: usize,
    step_budget: usize,
    tokens_emitted: usize,
    work_tokens: usize,
    unique_progress: usize,
    category_counts: Counts,
    coord_tokens: usize,
    noise_tokens: usize,
    tokens_per_step: f64,
    work_per_step: f64,
    progress_per_step: f64,
    sample_trace: Vec<(usize, Category, &'static str)>,
}

fn run_hogwild(
    n_workers: usize,
    step_budget: usize,
    target_per_category: usize,
    coordination_weight: f64,
    seed: u64,
) -> HogwildResult {
    let mut cache = SharedCache { tokens: Vec::new() };
    let mut workers: Vec<Worker> = Vec::new();
    for i in 0..n_workers {
        workers.push(Worker {
            id: i,
            intended: Category::A,
            coordination_weight,
            rng: Rng::new(seed + i as u64),
        });
    }

    let mut trace: Vec<(usize, Category, &'static str)> = Vec::new();
    let mut step = 0;
    let mut progress = 0;
    while step < step_budget {
        let mut this_step_categories: Vec<(usize, Category)> = Vec::new();
        for w in workers.iter_mut() {
            let cat = decide_next_category(w, &cache, target_per_category);
            cache.tokens.push((w.id, cat));
            this_step_categories.push((w.id, cat));
        }

        let mut seen_work_categories: Vec<Category> = Vec::new();
        for (w_id, cat) in this_step_categories {
            let mut tag = "redundant";
            if (cat == Category::A || cat == Category::B) && !seen_work_categories.contains(&cat) {
                seen_work_categories.push(cat);
                progress += 1;
                tag = "unique";
            }
            trace.push((w_id, cat, tag));
        }
        step += 1;
    }

    let counts = cache.counts();
    let work_tokens = counts.a + counts.b;
    trace.truncate(12);
    HogwildResult {
        workers: n_workers,
        step_budget,
        tokens_emitted: cache.tokens.len(),
        work_tokens,
        unique_progress: progress,
        category_counts: counts,
        coord_tokens: counts.coord,
        noise_tokens: counts.noise,
        tokens_per_step: cache.tokens.len() as f64 / step_budget as f64,
        work_per_step: work_tokens as f64 / step_budget as f64,
        progress_per_step: progress as f64 / step_budget as f64,
        sample_trace: trace,
    }
}

fn expected_speedup(t_serial: usize, p: f64, c: usize, n: usize, _steps_per_worker: usize) -> f64 {
    let t = t_serial as f64;
    let parallel = t * ((1.0 - p) + p / n as f64) + (c * n) as f64;
    t / parallel
}

const SEED: u64 = 42;

fn main() {
    println!("{}", "=".repeat(70));
    println!("HOGWILD! INFERENCE TOY SIMULATOR (Phase 10, Lesson 22)");
    println!("{}", "=".repeat(70));
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 1: baseline, single worker, 200 steps");
    println!("{}", "-".repeat(70));
    let r_1 = run_hogwild(1, 200, 100, 0.8, SEED);
    println!("  tokens emitted    : {}", r_1.tokens_emitted);
    println!("  work-tokens       : {}  ({:.2} / step)", r_1.work_tokens, r_1.work_per_step);
    println!("  unique progress   : {}  ({:.2} / step)", r_1.unique_progress, r_1.progress_per_step);
    println!("  category counts   : {}", r_1.category_counts.repr());
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 2: Hogwild, 2 workers, shared cache, strong coordination");
    println!("{}", "-".repeat(70));
    let r_2 = run_hogwild(2, 200, 100, 0.8, SEED);
    println!("  tokens emitted    : {}  ({:.2} / step)", r_2.tokens_emitted, r_2.tokens_per_step);
    println!("  work-tokens       : {}  ({:.2} / step)", r_2.work_tokens, r_2.work_per_step);
    println!("  unique progress   : {}  ({:.2} / step)", r_2.unique_progress, r_2.progress_per_step);
    println!("  category counts   : {}", r_2.category_counts.repr());
    println!(
        "  speedup vs N=1    : {:.2}x",
        r_2.unique_progress as f64 / r_1.unique_progress as f64
    );
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 3: coordination-weight sweep (N=2, same step budget)");
    println!("{}", "-".repeat(70));
    println!("  {:>14}  {:>10}  {:>15}", "coord weight", "progress", "speedup vs N=1");
    for cw in [0.0, 0.2, 0.5, 0.8, 1.0] {
        let r = run_hogwild(2, 200, 100, cw, SEED);
        let speedup = r.unique_progress as f64 / r_1.unique_progress as f64;
        println!("  {:>14.2}  {:>10}  {:>15.2}x", cw, r.unique_progress, speedup);
    }
    println!("  (coord weight 0.0 = both workers stay in category A = full redundancy)");
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 4: Amdahl-style theoretical speedup");
    println!("{}", "-".repeat(70));
    let t_serial = 10_000;
    println!("  reasoning task = 10000 decode tokens");
    println!("  c = coordination overhead per worker");
    let ns = [2usize, 4, 8];
    let head: String = ns.iter().map(|n| format!("{:>10}", format!("N={}", n))).collect();
    println!("  {:>5}  {}", "p", head);
    for p in [0.3, 0.5, 0.7, 0.9] {
        let mut row = format!("  {:>5.2}  ", p);
        for n in ns {
            let s = expected_speedup(t_serial, p, 200, n, t_serial / n);
            row += &format!("{:>9.2}x", s);
        }
        println!("{}", row);
    }
    println!("  (values: Hogwild! speedup over serial single-worker)");
    println!();

    println!("{}", "-".repeat(70));
    println!("Step 5: worst case (short task, weak coordination)");
    println!("{}", "-".repeat(70));
    println!("  {:>5}  {}", "p", head);
    for p in [0.1, 0.3, 0.5] {
        let mut row = format!("  {:>5.2}  ", p);
        for n in ns {
            let s = expected_speedup(1000, p, 150, n, 1000 / n);
            row += &format!("{:>9.2}x", s);
        }
        println!("{}", row);
    }
    println!("  (short 1000-token task, 150-token coordination overhead)");
    println!("  values below 1.0 mean parallel inference is SLOWER than serial");
    println!();

    println!("takeaway: Hogwild! speedup depends on parallelizable fraction p and");
    println!("          coordination overhead c. Reasoning tasks with p > 0.5 and");
    println!("          low per-step overhead are the sweet spot. Short chat with");
    println!("          c comparable to T_serial is the wrong place to use it.");
}
