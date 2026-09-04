// Inference optimization: KV cache + speculative decoding sketch. Stdlib only.
// Topic: prefill vs decode, KV cache memory layout, prefix cache trie, draft-verify loop.
// References (cited in spirit, not as deps):
//   - vLLM PagedAttention (Kwon 2023):    https://arxiv.org/abs/2309.06180
//   - Speculative decoding (Leviathan):   https://arxiv.org/abs/2211.17192
//   - candle KV cache:                    https://github.com/huggingface/candle/blob/main/candle-transformers/src/models/llama.rs
//   - llm.c inference notes:              https://github.com/karpathy/llm.c
//
// Compile + run:  rustc --edition 2021 main.rs -o /tmp/inf && /tmp/inf

use std::collections::HashMap;
use std::f32::consts::PI;

// ---------- xorshift64 RNG (deterministic, good distribution in low bits) ----------
struct Rng { state: u64 }
impl Rng {
    fn new(seed: u64) -> Self {
        let mut s = seed;
        if s == 0 { s = 0xdead_beef_cafe_babe; }
        Rng { state: s }
    }
    fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        x
    }
    fn next_u32(&mut self) -> u32 { (self.next_u64() >> 32) as u32 }
    fn uniform(&mut self) -> f32 { (self.next_u32() as f32 + 1.0) / (u32::MAX as f32 + 2.0) }
    fn gauss(&mut self) -> f32 {
        let u1 = self.uniform();
        let u2 = self.uniform();
        (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
    }
    fn range(&mut self, hi: usize) -> usize { (self.next_u32() as usize) % hi }
    fn choice(&mut self, probs: &[f32]) -> usize {
        let r = self.uniform();
        let mut acc = 0.0;
        for (i, p) in probs.iter().enumerate() {
            acc += *p;
            if r <= acc { return i; }
        }
        probs.len() - 1
    }
}

// ---------- KVCache: layered [num_layers, num_heads, max_seq, head_dim] ----------
struct KVCache {
    num_layers: usize,
    num_heads: usize,
    head_dim: usize,
    max_seq_len: usize,
    bytes_per_element: usize,
    k: Vec<f32>,
    v: Vec<f32>,
    seq_len: usize,
}

impl KVCache {
    fn new(num_layers: usize, num_heads: usize, head_dim: usize, max_seq_len: usize) -> Self {
        let total = num_layers * num_heads * max_seq_len * head_dim;
        KVCache {
            num_layers, num_heads, head_dim, max_seq_len,
            bytes_per_element: 2, // simulate fp16
            k: vec![0.0; total],
            v: vec![0.0; total],
            seq_len: 0,
        }
    }

    fn idx(&self, layer: usize, head: usize, pos: usize, dim: usize) -> usize {
        ((layer * self.num_heads + head) * self.max_seq_len + pos) * self.head_dim + dim
    }

    // Write new K/V slices of shape [n_new, num_heads, head_dim] for one layer.
    fn update(&mut self, layer: usize, new_k: &[f32], new_v: &[f32], n_new: usize) {
        assert_eq!(new_k.len(), n_new * self.num_heads * self.head_dim);
        assert_eq!(new_v.len(), n_new * self.num_heads * self.head_dim);
        assert!(layer < self.num_layers, "layer index out of range");
        let start = self.seq_len;
        assert!(start + n_new <= self.max_seq_len, "KV cache capacity exceeded");
        for t in 0..n_new {
            for h in 0..self.num_heads {
                for d in 0..self.head_dim {
                    let src = (t * self.num_heads + h) * self.head_dim + d;
                    let dst = self.idx(layer, h, start + t, d);
                    self.k[dst] = new_k[src];
                    self.v[dst] = new_v[src];
                }
            }
        }
    }

    fn advance(&mut self, n: usize) { self.seq_len += n; }

    fn capacity_bytes(&self) -> usize {
        2 * self.k.len() * self.bytes_per_element
    }
    fn used_bytes(&self) -> usize {
        let per_tok = 2 * self.num_layers * self.num_heads * self.head_dim * self.bytes_per_element;
        per_tok * self.seq_len
    }
}

// ---------- Prefix cache trie (PagedAttention-style prefix sharing) ----------
struct TrieNode {
    children: HashMap<usize, usize>, // token -> node idx
    hit_count: usize,
}

struct PrefixCache {
    nodes: Vec<TrieNode>,
    max_entries: usize,
    hits: usize,
    misses: usize,
}

impl PrefixCache {
    fn new(max_entries: usize) -> Self {
        PrefixCache {
            nodes: vec![TrieNode { children: HashMap::new(), hit_count: 0 }],
            max_entries,
            hits: 0,
            misses: 0,
        }
    }

    fn walk(&self, tokens: &[usize]) -> usize {
        let mut node = 0usize;
        let mut depth = 0usize;
        for &t in tokens {
            match self.nodes[node].children.get(&t) {
                Some(&next) => { node = next; depth += 1; }
                None => break,
            }
        }
        depth
    }

    fn lookup(&mut self, tokens: &[usize]) -> usize {
        let depth = self.walk(tokens);
        if depth > 0 {
            self.hits += 1;
            let mut node = 0usize;
            for &t in tokens.iter().take(depth) {
                node = *self.nodes[node].children.get(&t).unwrap();
                self.nodes[node].hit_count += 1;
            }
        } else {
            self.misses += 1;
        }
        depth
    }

    fn insert(&mut self, tokens: &[usize]) -> usize {
        let mut node = 0usize;
        for (i, &t) in tokens.iter().enumerate() {
            if !self.nodes[node].children.contains_key(&t) {
                if self.nodes.len() >= self.max_entries { return i; }
                let new_idx = self.nodes.len();
                self.nodes.push(TrieNode { children: HashMap::new(), hit_count: 0 });
                self.nodes[node].children.insert(t, new_idx);
            }
            node = *self.nodes[node].children.get(&t).unwrap();
        }
        tokens.len()
    }

    fn hit_rate(&self) -> f32 {
        let total = self.hits + self.misses;
        if total == 0 { 0.0 } else { self.hits as f32 / total as f32 }
    }
}

// ---------- Batching simulators ----------
#[derive(Clone)]
struct Request {
    arrival: usize,
    output_tokens: usize,
    tokens_generated: usize,
    start: usize,
    end: usize,
}
impl Request {
    fn new(arrival: usize, output_tokens: usize) -> Self {
        Request { arrival, output_tokens, tokens_generated: 0, start: 0, end: 0 }
    }
    fn done(&self) -> bool { self.tokens_generated >= self.output_tokens }
}

fn simulate_static_batching(mut reqs: Vec<Request>, batch_size: usize) -> Vec<Request> {
    reqs.sort_by_key(|r| r.arrival);
    let mut step = 0;
    let mut completed = Vec::new();
    let mut idx = 0;
    while idx < reqs.len() {
        let mut batch: Vec<Request> = Vec::new();
        while idx < reqs.len() && batch.len() < batch_size {
            let mut r = reqs[idx].clone();
            r.start = step.max(r.arrival);
            batch.push(r);
            idx += 1;
        }
        if !batch.is_empty() {
            step = step.max(batch.iter().map(|r| r.start).max().unwrap());
            let max_out = batch.iter().map(|r| r.output_tokens).max().unwrap();
            for mut r in batch.into_iter() {
                r.tokens_generated = r.output_tokens;
                r.end = step + max_out;
                completed.push(r);
            }
            step += max_out;
        }
    }
    completed
}

fn simulate_continuous_batching(mut reqs: Vec<Request>, batch_size: usize) -> Vec<Request> {
    reqs.sort_by_key(|r| r.arrival);
    let mut step = 0usize;
    let mut completed = Vec::new();
    let mut waiting: Vec<Request> = Vec::new();
    let mut active: Vec<Request> = Vec::new();
    let mut idx = 0;

    while idx < reqs.len() || !active.is_empty() || !waiting.is_empty() {
        while idx < reqs.len() && reqs[idx].arrival <= step {
            waiting.push(reqs[idx].clone());
            idx += 1;
        }
        while !waiting.is_empty() && active.len() < batch_size {
            let mut r = waiting.remove(0);
            r.start = step;
            active.push(r);
        }
        if active.is_empty() {
            if !waiting.is_empty() { step += 1; continue; }
            if idx < reqs.len() { step = reqs[idx].arrival; continue; }
            break;
        }
        for r in active.iter_mut() { r.tokens_generated += 1; }
        let mut still: Vec<Request> = Vec::new();
        for mut r in active.drain(..) {
            if r.done() {
                r.end = step + 1;
                completed.push(r);
            } else {
                still.push(r);
            }
        }
        active = still;
        step += 1;
    }
    completed
}

struct BatchStats {
    avg_latency: f32,
    p50: f32,
    p99: f32,
    total_time: f32,
    throughput: f32,
}

fn batch_stats(completed: &[Request]) -> BatchStats {
    let mut lats: Vec<f32> = completed.iter().map(|r| (r.end - r.arrival) as f32).collect();
    lats.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let avg = lats.iter().sum::<f32>() / lats.len() as f32;
    let p50 = lats[lats.len() / 2];
    let p99 = lats[((lats.len() as f32 * 0.99) as usize).min(lats.len() - 1)];
    let total = completed.iter().map(|r| r.end).max().unwrap() as f32
        - completed.iter().map(|r| r.arrival).min().unwrap() as f32;
    let total_tokens: usize = completed.iter().map(|r| r.output_tokens).sum();
    let thr = if total > 0.0 { total_tokens as f32 / total } else { 0.0 };
    BatchStats { avg_latency: avg, p50, p99, total_time: total, throughput: thr }
}

// ---------- Speculative decoding sketch ----------
struct DraftModel { vocab: usize, acceptance_rate: f32 }
struct TargetModel { vocab: usize }

impl DraftModel {
    fn generate(&self, k: usize, rng: &mut Rng) -> Vec<usize> {
        (0..k).map(|_| rng.range(self.vocab)).collect()
    }
}

impl TargetModel {
    // Returns a (uniform) probability vector. A real target would sample its true distribution.
    fn uniform_probs(&self) -> Vec<f32> { vec![1.0 / self.vocab as f32; self.vocab] }
}

#[allow(dead_code)]
struct SpecResult {
    total_tokens: usize,
    spec_cost: f32,
    seq_cost: f32,
    speedup: f32,
    avg_accepted: f32,
}

fn speculative_decode(
    draft: &DraftModel, target: &TargetModel,
    context: &[usize], num_spec: usize,
    draft_cost: f32, target_cost: f32, verify_cost: f32,
    max_tokens: usize,
    rng: &mut Rng,
) -> SpecResult {
    let mut ctx: Vec<usize> = context.to_vec();
    let mut total_tokens = 0usize;
    let mut total_cost = 0.0f32;
    let mut accepted_counts: Vec<usize> = Vec::new();

    while total_tokens < max_tokens {
        let draft_tokens = draft.generate(num_spec, rng);
        total_cost += draft_cost * num_spec as f32;

        // One verify pass scores all k tokens.
        total_cost += verify_cost;

        let mut accepted = 0usize;
        for &tok in &draft_tokens {
            if total_tokens >= max_tokens { break; }
            let r = rng.uniform();
            if r < draft.acceptance_rate {
                accepted += 1;
                ctx.push(tok);
                total_tokens += 1;
            } else {
                let probs = target.uniform_probs();
                let resampled = rng.choice(&probs);
                ctx.push(resampled);
                total_tokens += 1;
                break;
            }
        }
        accepted_counts.push(accepted);

        if accepted == num_spec && total_tokens < max_tokens {
            // Bonus token from target's free-standing prediction.
            let probs = target.uniform_probs();
            let bonus = rng.choice(&probs);
            ctx.push(bonus);
            total_tokens += 1;
        }
    }
    let seq_cost = total_tokens as f32 * target_cost;
    let avg_accept = accepted_counts.iter().sum::<usize>() as f32 / accepted_counts.len() as f32;
    SpecResult {
        total_tokens,
        spec_cost: total_cost,
        seq_cost,
        speedup: if total_cost > 0.0 { seq_cost / total_cost } else { 1.0 },
        avg_accepted: avg_accept,
    }
}

// ---------- KV cache memory analysis ----------
#[allow(dead_code)]
struct ModelCfg {
    name: &'static str,
    num_layers: usize,
    num_kv_heads: usize,
    head_dim: usize,
    params_b: f64,
}

fn kv_cache_mem(cfg: &ModelCfg, seq_len: usize, bytes: usize) -> (usize, f64) {
    let per_token = 2 * cfg.num_layers * cfg.num_kv_heads * cfg.head_dim * bytes;
    let total = per_token * seq_len;
    (per_token, total as f64 / (1024.0 * 1024.0 * 1024.0))
}

fn main() {
    let mut rng = Rng::new(42);

    // --- Step 1: KV cache memory analysis ---
    println!("{}", "=".repeat(70));
    println!("STEP 1: KV cache memory per model");
    println!("{}", "=".repeat(70));
    let configs: [ModelCfg; 5] = [
        ModelCfg { name: "Llama-3-8B",   num_layers: 32, num_kv_heads: 8, head_dim: 128, params_b: 8.0 },
        ModelCfg { name: "Llama-3-70B",  num_layers: 80, num_kv_heads: 8, head_dim: 128, params_b: 70.0 },
        ModelCfg { name: "Llama-3-405B", num_layers: 126, num_kv_heads: 8, head_dim: 128, params_b: 405.0 },
        ModelCfg { name: "Mistral-7B",   num_layers: 32, num_kv_heads: 8, head_dim: 128, params_b: 7.0 },
        ModelCfg { name: "GPT-4-est",    num_layers: 120, num_kv_heads: 96, head_dim: 128, params_b: 1800.0 },
    ];
    println!("  {:<20} {:>12} {:>12} {:>12} {:>12}", "Model", "Per Token", "@ 4K ctx", "@ 32K ctx", "@ 128K ctx");
    println!("  {}", "-".repeat(70));
    for c in &configs {
        let (pt, _) = kv_cache_mem(c, 1, 2);
        let (_, g4) = kv_cache_mem(c, 4096, 2);
        let (_, g32) = kv_cache_mem(c, 32768, 2);
        let (_, g128) = kv_cache_mem(c, 131072, 2);
        println!("  {:<20} {:>10}KB {:>10.2}GB {:>10.2}GB {:>10.2}GB",
            c.name, pt / 1024, g4, g32, g128);
    }

    // --- Step 2: KV cache with simulated attention writes ---
    println!("\n{}", "=".repeat(70));
    println!("STEP 2: KV cache prefill + decode");
    println!("{}", "=".repeat(70));
    let num_heads = 4usize;
    let head_dim = 16usize;
    let seq_len = 8usize;
    let mut cache = KVCache::new(1, num_heads, head_dim, 128);

    // Fake K/V tensors for prefill.
    let n_prefill = seq_len;
    let kv_size = n_prefill * num_heads * head_dim;
    let k: Vec<f32> = (0..kv_size).map(|_| rng.gauss()).collect();
    let v: Vec<f32> = (0..kv_size).map(|_| rng.gauss()).collect();
    cache.update(0, &k, &v, n_prefill);
    cache.advance(n_prefill);
    println!("  prefill: {} tokens cached, used={} bytes (cap={} bytes)",
        cache.seq_len, cache.used_bytes(), cache.capacity_bytes());

    // Decode: 4 steps, each appending 1 token's K/V.
    for step in 0..4 {
        let kv_size = num_heads * head_dim;
        let k_new: Vec<f32> = (0..kv_size).map(|_| rng.gauss()).collect();
        let v_new: Vec<f32> = (0..kv_size).map(|_| rng.gauss()).collect();
        cache.update(0, &k_new, &v_new, 1);
        cache.advance(1);
        println!("  decode step {}: cache={} tokens, used={} bytes",
            step + 1, cache.seq_len, cache.used_bytes());
    }

    // --- Step 3: static vs continuous batching ---
    println!("\n{}", "=".repeat(70));
    println!("STEP 3: static vs continuous batching");
    println!("{}", "=".repeat(70));

    let make_reqs = |seed: u64, n: usize| -> Vec<Request> {
        let mut r = Rng::new(seed);
        let mut out = Vec::with_capacity(n);
        for _ in 0..n {
            let arrival = r.range(20);
            // Pareto-ish: heavy tail via inverse uniform.
            let u = r.uniform().max(1e-3);
            let out_len = ((1.0 / u.powf(1.0 / 1.5)) * 15.0) as usize + 5;
            let out_len = out_len.min(200);
            out.push(Request::new(arrival, out_len));
        }
        out
    };
    let batch_size = 8usize;
    let s = simulate_static_batching(make_reqs(42, 30), batch_size);
    let c = simulate_continuous_batching(make_reqs(42, 30), batch_size);
    let ss = batch_stats(&s);
    let cs = batch_stats(&c);
    println!("  30 requests, batch_size={}", batch_size);
    println!("  {:<14} {:>12} {:>12} {:>12}", "Metric", "Static", "Continuous", "Delta");
    println!("  {}", "-".repeat(54));
    let print_delta = |name: &str, sv: f32, cv: f32, smaller_better: bool| {
        let delta = if smaller_better {
            if sv > 0.0 { format!("{:+.1}%", (sv - cv) / sv * 100.0) } else { "n/a".to_string() }
        } else {
            if sv > 0.0 { format!("{:.2}x", cv / sv) } else { "n/a".to_string() }
        };
        println!("  {:<14} {:>12.1} {:>12.1} {:>12}", name, sv, cv, delta);
    };
    print_delta("avg_latency", ss.avg_latency, cs.avg_latency, true);
    print_delta("p50_latency", ss.p50, cs.p50, true);
    print_delta("p99_latency", ss.p99, cs.p99, true);
    print_delta("total_time",  ss.total_time, cs.total_time, true);
    print_delta("throughput",  ss.throughput, cs.throughput, false);

    // --- Step 4: prefix cache ---
    println!("\n{}", "=".repeat(70));
    println!("STEP 4: prefix caching for shared system prompts");
    println!("{}", "=".repeat(70));
    let mut pc = PrefixCache::new(5000);
    let prompts: Vec<Vec<usize>> = vec![
        (100..200).collect(),
        (200..350).collect(),
        (400..480).collect(),
    ];
    for (i, p) in prompts.iter().enumerate() {
        let inserted = pc.insert(p);
        println!("  cached system prompt {}: {} tokens, {} new nodes inserted", i + 1, p.len(), inserted);
    }

    let mut hit_count = 0usize;
    let mut tokens_saved = 0usize;
    for _ in 0..100 {
        let idx = rng.range(prompts.len());
        let sys = &prompts[idx];
        let user_len = 20 + rng.range(30);
        let mut full = sys.clone();
        full.extend((0..user_len).map(|_| 500 + rng.range(500)));
        let depth = pc.lookup(&full);
        if depth > 0 { hit_count += 1; tokens_saved += depth; }
    }
    println!("  hit rate: {:.1}%", pc.hit_rate() * 100.0);
    println!("  tokens saved (prefix reuse): {}", tokens_saved);
    println!("  avg saved per hit: {:.1}", tokens_saved as f32 / hit_count.max(1) as f32);

    // --- Step 5: speculative decoding ---
    println!("\n{}", "=".repeat(70));
    println!("STEP 5: speculative decoding speedup (sketch)");
    println!("{}", "=".repeat(70));
    let vocab = 500usize;
    let trials = 10usize;
    let strategies: [(&str, f32, usize); 3] = [
        ("draft-target (8B->70B)", 0.78, 5),
        ("EAGLE",                  0.85, 6),
        ("n-gram lookup",          0.50, 4),
    ];
    println!("  {:<24} {:>14} {:>12} {:>10}", "Strategy", "AcceptRate", "AvgAccept", "Speedup");
    println!("  {}", "-".repeat(64));
    for (name, acc, k) in strategies {
        let mut speedups = 0.0f32;
        let mut accept_rates = 0.0f32;
        let mut avg_accepts = 0.0f32;
        for _ in 0..trials {
            let draft = DraftModel { vocab, acceptance_rate: acc };
            let target = TargetModel { vocab };
            let ctx: Vec<usize> = (0..10).map(|_| rng.range(vocab)).collect();
            let r = speculative_decode(&draft, &target, &ctx, k, 1.0, 10.0, 12.0, 100, &mut rng);
            speedups += r.speedup;
            accept_rates += r.avg_accepted / k as f32;
            avg_accepts += r.avg_accepted;
        }
        println!("  {:<24} {:>13.1}% {:>12.2} {:>9.2}x",
            name,
            accept_rates / trials as f32 * 100.0,
            avg_accepts / trials as f32,
            speedups / trials as f32,
        );
    }

    // --- Step 6: ops:byte ---
    println!("\n{}", "=".repeat(70));
    println!("STEP 6: ops:byte and memory vs compute bound");
    println!("{}", "=".repeat(70));
    let a100_tflops = 312.0f32;
    let a100_bandwidth_tbs = 2.0f32;
    let crossover = a100_tflops / a100_bandwidth_tbs;
    println!("  A100 specs: {} TFLOPS, {} TB/s bandwidth, crossover ops:byte = {:.0}",
        a100_tflops, a100_bandwidth_tbs, crossover);
    let scenarios: [(&str, usize); 7] = [
        ("Prefill, batch=1, seq=4096", 4096),
        ("Decode, batch=1",   1),
        ("Decode, batch=8",   8),
        ("Decode, batch=32",  32),
        ("Decode, batch=128", 128),
        ("Decode, batch=256", 256),
        ("Decode, batch=512", 512),
    ];
    println!("  {:<32} {:>10} {:>12} {:>12}", "Scenario", "Ops:Byte", "Bound", "Utilization");
    println!("  {}", "-".repeat(70));
    for (name, opb) in scenarios {
        let bound = if opb as f32 >= crossover { "Compute" } else { "Memory" };
        let util = if bound == "Memory" { opb as f32 / crossover * 100.0 } else { 100.0 };
        println!("  {:<32} {:>10} {:>12} {:>11.1}%", name, opb, bound, util);
    }

    println!("\n{}", "=".repeat(70));
    println!("SUMMARY");
    println!("{}", "=".repeat(70));
    println!("  1. KV cache trades memory for compute; per-token cost scales with layers x kv_heads x head_dim.");
    println!("  2. Continuous batching keeps the GPU busy as requests retire mid-batch.");
    println!("  3. Prefix caching shares KV entries across shared system prompts.");
    println!("  4. Speculative decoding amortizes verification across k draft tokens.");
    println!("  5. Decode is memory bound at small batch; raise batch until ops:byte clears crossover.");
}
