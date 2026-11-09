// Lesson: vLLM Serving Internals (phase 17 / lesson 04)
// Rust port of code/main.py. Standard library only.
// Source: phases/17-infrastructure-and-production/04-vllm-serving-internals/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

use std::collections::VecDeque;

const FORWARD_LATENCY_PER_TOKEN: f64 = 0.0005;
const PREFILL_LATENCY_PER_TOKEN: f64 = 0.00004;
const BATCH_OVERHEAD: f64 = 0.0002;
const CHUNK_SIZE: usize = 512;
const KV_BLOCK_SIZE: usize = 16;
const KV_BLOCKS_AVAILABLE: usize = 1800;

struct Rng(u64);

impl Rng {
    fn new(seed: u64) -> Self {
        Rng(seed)
    }
    fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
    fn random(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }
    fn expovariate(&mut self, lambd: f64) -> f64 {
        -(1.0 - self.random()).ln() / lambd
    }
    fn randint(&mut self, lo: usize, hi: usize) -> usize {
        lo + (self.next_u64() % (hi - lo + 1) as u64) as usize
    }
    fn choice<T: Copy>(&mut self, xs: &[T]) -> T {
        xs[(self.next_u64() % xs.len() as u64) as usize]
    }
}

#[derive(Clone)]
struct Request {
    prompt_len: usize,
    output_len: usize,
    arrived_at: f64,
    prefilled: usize,
    generated: usize,
    ttft: Option<f64>,
    last_token_at: Option<f64>,
    itl_samples: Vec<f64>,
}

impl Request {
    fn new(prompt_len: usize, output_len: usize, arrived_at: f64) -> Self {
        Request {
            prompt_len,
            output_len,
            arrived_at,
            prefilled: 0,
            generated: 0,
            ttft: None,
            last_token_at: None,
            itl_samples: Vec::new(),
        }
    }
    fn in_prefill(&self) -> bool {
        self.prefilled < self.prompt_len
    }
    fn done(&self) -> bool {
        self.generated >= self.output_len
    }
    fn blocks_needed(&self) -> usize {
        let total = self.prompt_len + self.output_len;
        total.div_ceil(KV_BLOCK_SIZE)
    }
}

fn make_workload(n: usize, seed: u64) -> Vec<Request> {
    let mut rng = Rng::new(seed);
    let mut reqs = Vec::new();
    let mut now = 0.0;
    for _ in 0..n {
        now += rng.expovariate(40.0);
        let prompt_len = rng.choice(&[128, 256, 512, 2048, 8192]);
        let out_len = rng.randint(50, 300);
        reqs.push(Request::new(prompt_len, out_len, now));
    }
    reqs
}

fn report(label: &str, reqs: &[Request], sim_end: f64) {
    let ttfts: Vec<f64> = reqs.iter().filter_map(|r| r.ttft.map(|t| t - r.arrived_at)).collect();
    let mut itls: Vec<f64> = reqs.iter().flat_map(|r| r.itl_samples.iter().copied()).collect();
    let total_out: usize = reqs.iter().map(|r| r.generated).sum();
    let throughput = if sim_end != 0.0 { total_out as f64 / sim_end } else { 0.0 };
    let mean_ttft = if ttfts.is_empty() { 0.0 } else { ttfts.iter().sum::<f64>() / ttfts.len() as f64 * 1000.0 };
    let p99_itl = if itls.is_empty() {
        0.0
    } else {
        itls.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let idx = (0.99 * itls.len() as f64) as isize - 1;
        let idx = if idx < 0 { itls.len() as isize + idx } else { idx } as usize;
        itls[idx] * 1000.0
    };
    let finished = reqs.iter().filter(|r| r.done()).count();
    println!(
        "{:<28}  throughput={:6.0} tok/s   mean_TTFT={:6.1} ms   P99_ITL={:5.1} ms   finished={}/{}",
        label,
        throughput,
        mean_ttft,
        p99_itl,
        finished,
        reqs.len()
    );
}

fn simulate_naive(reqs: &mut [Request]) -> f64 {
    let mut now: f64 = 0.0;
    for r in reqs.iter_mut() {
        if now < r.arrived_at {
            now = r.arrived_at;
        }
        now += r.prompt_len as f64 * PREFILL_LATENCY_PER_TOKEN + BATCH_OVERHEAD;
        r.prefilled = r.prompt_len;
        r.ttft = Some(now);
        r.last_token_at = Some(now);
        for _ in 0..r.output_len {
            let prev = r.last_token_at.unwrap();
            now += FORWARD_LATENCY_PER_TOKEN + BATCH_OVERHEAD;
            r.generated += 1;
            r.itl_samples.push(now - prev);
            r.last_token_at = Some(now);
        }
    }
    now
}

fn simulate_static(reqs: &mut [Request], batch: usize) -> f64 {
    let mut now: f64 = 0.0;
    let mut i = 0;
    while i < reqs.len() {
        let end = (i + batch).min(reqs.len());
        let window = &mut reqs[i..end];
        i += batch;
        let latest = window.iter().map(|r| r.arrived_at).fold(f64::NEG_INFINITY, f64::max);
        now = now.max(latest);
        let pad_prompt = window.iter().map(|r| r.prompt_len).max().unwrap();
        let pad_output = window.iter().map(|r| r.output_len).max().unwrap();
        now += pad_prompt as f64 * PREFILL_LATENCY_PER_TOKEN + BATCH_OVERHEAD;
        for r in window.iter_mut() {
            r.prefilled = r.prompt_len;
            r.ttft = Some(now);
            r.last_token_at = Some(now);
        }
        let width = window.len() as f64;
        for _ in 0..pad_output {
            let prev_now = now;
            now += FORWARD_LATENCY_PER_TOKEN * width / 16.0 + BATCH_OVERHEAD;
            for r in window.iter_mut() {
                if r.generated < r.output_len {
                    r.generated += 1;
                    r.itl_samples.push(now - prev_now);
                    r.last_token_at = Some(now);
                }
            }
        }
    }
    now
}

fn truthy(x: Option<f64>) -> Option<f64> {
    x.filter(|v| *v != 0.0)
}

fn simulate_continuous(reqs: &mut [Request], chunked: bool) -> f64 {
    let mut order: Vec<usize> = (0..reqs.len()).collect();
    order.sort_by(|&a, &b| reqs[a].arrived_at.partial_cmp(&reqs[b].arrived_at).unwrap());
    let mut waiting: VecDeque<usize> = order.into_iter().collect();
    let mut running: Vec<usize> = Vec::new();
    let mut blocks_used = 0;
    let mut now: f64 = 0.0;
    while !waiting.is_empty() || !running.is_empty() {
        while let Some(&w) = waiting.front() {
            if reqs[w].arrived_at > now {
                break;
            }
            if blocks_used + reqs[w].blocks_needed() > KV_BLOCKS_AVAILABLE {
                break;
            }
            blocks_used += reqs[w].blocks_needed();
            running.push(waiting.pop_front().unwrap());
        }
        if running.is_empty() {
            match waiting.front() {
                None => break,
                Some(&w) => {
                    now = reqs[w].arrived_at;
                    continue;
                }
            }
        }

        let mut batch_tokens = 0;
        let mut prefill_work = 0;
        let mut decoded: Vec<usize> = Vec::new();
        for &ri in &running {
            let r = &mut reqs[ri];
            if r.in_prefill() {
                let remaining = r.prompt_len - r.prefilled;
                let take = if chunked { CHUNK_SIZE.min(remaining) } else { remaining };
                r.prefilled += take;
                prefill_work += take;
                if r.prefilled >= r.prompt_len {
                    r.ttft = Some(now + prefill_work as f64 * PREFILL_LATENCY_PER_TOKEN);
                }
            } else {
                decoded.push(ri);
                batch_tokens += 1;
            }
        }

        let dt = prefill_work as f64 * PREFILL_LATENCY_PER_TOKEN
            + batch_tokens as f64 * FORWARD_LATENCY_PER_TOKEN
            + BATCH_OVERHEAD;
        now += dt;
        for &ri in &decoded {
            let r = &mut reqs[ri];
            let prev = truthy(r.last_token_at).or(truthy(r.ttft)).unwrap_or(now);
            r.generated += 1;
            r.itl_samples.push(now - prev);
            r.last_token_at = Some(now);
            if r.ttft.is_none() {
                r.ttft = Some(now);
            }
        }

        let mut kept = Vec::new();
        for &ri in &running {
            if reqs[ri].done() {
                blocks_used -= reqs[ri].blocks_needed();
            } else {
                kept.push(ri);
            }
        }
        running = kept;
    }
    now
}

fn fresh(base: &[Request]) -> Vec<Request> {
    base.iter().map(|r| Request::new(r.prompt_len, r.output_len, r.arrived_at)).collect()
}

fn main() {
    println!("{}", "=".repeat(80));
    println!("TOY vLLM SCHEDULER: four modes on the same 60-request workload");
    println!("{}", "=".repeat(80));

    let base = make_workload(60, 7);
    let mut w1 = fresh(&base);
    let end = simulate_naive(&mut w1);
    report("NAIVE", &w1, end);

    let mut w2 = fresh(&base);
    let end = simulate_static(&mut w2, 16);
    report("STATIC (batch=16, padded)", &w2, end);

    let mut w3 = fresh(&base);
    let end = simulate_continuous(&mut w3, false);
    report("CONTINUOUS (no chunk)", &w3, end);

    let mut w4 = fresh(&base);
    let end = simulate_continuous(&mut w4, true);
    report("CONTINUOUS + CHUNKED", &w4, end);

    println!();
    println!("Read the CONTINUOUS+CHUNKED row. That is what vLLM ships as default.");
    println!("The gap between STATIC and CONTINUOUS is the whole reason vLLM exists.");
}
