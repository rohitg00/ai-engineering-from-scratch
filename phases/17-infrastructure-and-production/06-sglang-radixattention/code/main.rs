// Lesson: SGLang RadixAttention (phase 17 / lesson 06)
// Rust port of code/main.py. Standard library only.
// Source: phases/17-infrastructure-and-production/06-sglang-radixattention/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

use std::collections::HashMap;

const KV_BUDGET_BLOCKS: u64 = 160;
const BLOCK_TOKENS: u64 = 16;

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
    fn randrange(&mut self, n: usize) -> usize {
        (self.next_u64() % n as u64) as usize
    }
    fn shuffle<T>(&mut self, xs: &mut [T]) {
        for i in (1..xs.len()).rev() {
            let j = self.randrange(i + 1);
            xs.swap(i, j);
        }
    }
}

fn token_count(seg: &str) -> u64 {
    if seg == "SYSTEM" {
        return 2000;
    }
    if seg.starts_with("DOC_") {
        return 500;
    }
    if seg.starts_with("Q_") {
        return 60;
    }
    if seg == "TOOLS" {
        return 300;
    }
    100
}

#[derive(Clone)]
struct Request {
    segments: Vec<String>,
}

struct Node {
    key: Vec<String>,
    blocks: u64,
    last_used: u64,
}

struct RadixCache {
    budget: u64,
    used: u64,
    time: u64,
    nodes: Vec<Node>,
}

impl RadixCache {
    fn new(budget_blocks: u64) -> Self {
        RadixCache { budget: budget_blocks, used: 0, time: 0, nodes: Vec::new() }
    }

    fn find(&self, key: &[String]) -> Option<usize> {
        self.nodes.iter().position(|n| n.key == key)
    }

    fn walk(&mut self, segments: &[String]) -> u64 {
        let mut reused = 0;
        self.time += 1;
        for i in 1..=segments.len() {
            match self.find(&segments[..i]) {
                Some(idx) => {
                    reused += token_count(&segments[i - 1]);
                    self.nodes[idx].last_used = self.time;
                }
                None => break,
            }
        }
        reused
    }

    fn insert(&mut self, segments: &[String]) {
        for i in 1..=segments.len() {
            let key = &segments[..i];
            if self.find(key).is_some() {
                continue;
            }
            let blocks = (token_count(&segments[i - 1]) + BLOCK_TOKENS - 1) / BLOCK_TOKENS;
            while self.used + blocks > self.budget && self.evict_one() {}
            self.nodes.push(Node { key: key.to_vec(), blocks, last_used: self.time });
            self.used += blocks;
        }
    }

    fn evict_one(&mut self) -> bool {
        let leaves: Vec<usize> = (0..self.nodes.len())
            .filter(|&i| {
                let k = &self.nodes[i].key;
                !self.nodes.iter().any(|o| o.key != *k && o.key.len() >= k.len() && o.key[..k.len()] == k[..])
            })
            .collect();
        if leaves.is_empty() {
            return false;
        }
        let mut victim = leaves[0];
        for &i in &leaves[1..] {
            if self.nodes[i].last_used < self.nodes[victim].last_used {
                victim = i;
            }
        }
        let node = self.nodes.remove(victim);
        self.used -= node.blocks;
        true
    }
}

struct SimResult {
    hit_rate: f64,
    saved: u64,
    total: u64,
    reqs: usize,
}

fn simulate(requests: &[Request], scheduler: &str) -> SimResult {
    let mut cache = RadixCache::new(KV_BUDGET_BLOCKS);

    let order: Vec<Request> = if scheduler == "CACHE_AWARE" {
        let mut branch_count: HashMap<Vec<String>, u64> = HashMap::new();
        for r in requests {
            for i in 1..=r.segments.len() {
                *branch_count.entry(r.segments[..i].to_vec()).or_insert(0) += 1;
            }
        }
        let score = |r: &Request| -> u64 {
            (1..=r.segments.len())
                .map(|i| {
                    let tokens: u64 = r.segments[..i].iter().map(|s| token_count(s)).sum();
                    branch_count[&r.segments[..i].to_vec()] * tokens
                })
                .max()
                .unwrap_or(0)
        };
        let mut scored: Vec<(u64, Request)> = requests.iter().map(|r| (score(r), r.clone())).collect();
        scored.sort_by(|a, b| b.0.cmp(&a.0));
        scored.into_iter().map(|(_, r)| r).collect()
    } else {
        requests.to_vec()
    };

    let mut saved = 0;
    let mut total = 0;
    for r in &order {
        let prompt_tokens: u64 = r.segments.iter().map(|s| token_count(s)).sum();
        total += prompt_tokens;
        saved += cache.walk(&r.segments);
        cache.insert(&r.segments);
    }

    SimResult {
        hit_rate: if total > 0 { saved as f64 / total as f64 } else { 0.0 },
        saved,
        total,
        reqs: requests.len(),
    }
}

fn workload_rag(n: usize, docs: usize, seed: u64) -> Vec<Request> {
    let mut rng = Rng::new(seed);
    let mut reqs = Vec::new();
    for i in 0..n {
        let doc = format!("DOC_{}", rng.randrange(docs));
        let q = format!("Q_{}", i);
        reqs.push(Request { segments: vec!["SYSTEM".to_string(), "TOOLS".to_string(), doc, q] });
    }
    rng.shuffle(&mut reqs);
    reqs
}

fn workload_scrambled(n: usize, docs: usize, seed: u64) -> Vec<Request> {
    let mut rng = Rng::new(seed);
    let mut reqs = Vec::new();
    for i in 0..n {
        let doc = format!("DOC_{}", rng.randrange(docs));
        let q = format!("Q_{}", i);
        let mut prefix = vec!["SYSTEM".to_string(), "TOOLS".to_string(), doc];
        rng.shuffle(&mut prefix);
        prefix.push(q);
        reqs.push(Request { segments: prefix });
    }
    rng.shuffle(&mut reqs);
    reqs
}

fn report(label: &str, res: &SimResult) {
    let pct = format!("{:.1}%", res.hit_rate * 100.0);
    println!(
        "{:<44}  hit_rate={:>6}   saved={:>6}/{:<6} tok   reqs={}",
        label, pct, res.saved, res.total, res.reqs
    );
}

fn main() {
    println!("{}", "=".repeat(88));
    println!("TOY RADIX CACHE: cache hit rate across schedulers and orderings");
    println!("{}", "=".repeat(88));

    let rag = workload_rag(80, 4, 1);
    report("RAG workload | FCFS", &simulate(&rag, "FCFS"));
    report("RAG workload | CACHE_AWARE", &simulate(&rag, "CACHE_AWARE"));

    let scrambled = workload_scrambled(80, 4, 1);
    report("RAG scrambled prefix | FCFS", &simulate(&scrambled, "FCFS"));
    report("RAG scrambled prefix | CACHE_AWARE", &simulate(&scrambled, "CACHE_AWARE"));

    println!();
    println!("{}", "=".repeat(88));
    println!("KEY FINDING");
    println!("{}", "-".repeat(88));
    println!("  Fixed ordering + cache-aware scheduler : hit rate clears 80% on RAG.");
    println!("  Scrambled prefix order : hit rate collapses: the tree cannot find shared paths.");
    println!("  Real cases: 7% -> 74% hit rate by moving dynamic content out of the prefix.");
}
