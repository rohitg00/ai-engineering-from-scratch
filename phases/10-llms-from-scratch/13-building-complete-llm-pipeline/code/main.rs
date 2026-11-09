// Lesson: Building a Complete LLM Pipeline (phase 10 / lesson 13)
// Rust port of code/main.py. Standard library only.
// Source: phases/10-llms-from-scratch/13-building-complete-llm-pipeline/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

use std::collections::BTreeMap;
use std::collections::HashMap;
use std::time::Instant;

const SHA256_K: [u32; 64] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

fn sha256_hex(data: &[u8]) -> String {
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    let mut msg = data.to_vec();
    let bit_len = (data.len() as u64).wrapping_mul(8);
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bit_len.to_be_bytes());
    for chunk in msg.chunks(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([chunk[4 * i], chunk[4 * i + 1], chunk[4 * i + 2], chunk[4 * i + 3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }
        let mut v = h;
        for i in 0..64 {
            let s1 = v[4].rotate_right(6) ^ v[4].rotate_right(11) ^ v[4].rotate_right(25);
            let ch = (v[4] & v[5]) ^ (!v[4] & v[6]);
            let t1 = v[7].wrapping_add(s1).wrapping_add(ch).wrapping_add(SHA256_K[i]).wrapping_add(w[i]);
            let s0 = v[0].rotate_right(2) ^ v[0].rotate_right(13) ^ v[0].rotate_right(22);
            let maj = (v[0] & v[1]) ^ (v[0] & v[2]) ^ (v[1] & v[2]);
            let t2 = s0.wrapping_add(maj);
            v[7] = v[6];
            v[6] = v[5];
            v[5] = v[4];
            v[4] = v[3].wrapping_add(t1);
            v[3] = v[2];
            v[2] = v[1];
            v[1] = v[0];
            v[0] = t1.wrapping_add(t2);
        }
        for i in 0..8 {
            h[i] = h[i].wrapping_add(v[i]);
        }
    }
    h.iter().map(|x| format!("{:08x}", x)).collect()
}

#[derive(Clone)]
enum Json {
    Bool(bool),
    Int(i64),
    Float(f64),
    Str(String),
    List(Vec<Json>),
    Obj(BTreeMap<String, Json>),
}

fn py_float(x: f64) -> String {
    format!("{:?}", x)
}

fn json_str(s: &str) -> String {
    let mut out = String::from("\"");
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            c if (c as u32) < 0x20 || (c as u32) > 0x7f => {
                let mut buf = [0u16; 2];
                for unit in c.encode_utf16(&mut buf) {
                    out.push_str(&format!("\\u{:04x}", unit));
                }
            }
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn json_scalar(v: &Json) -> Option<String> {
    match v {
        Json::Bool(b) => Some(if *b { "true".to_string() } else { "false".to_string() }),
        Json::Int(i) => Some(i.to_string()),
        Json::Float(f) => Some(py_float(*f)),
        Json::Str(s) => Some(json_str(s)),
        Json::List(l) if l.is_empty() => Some("[]".to_string()),
        Json::Obj(o) if o.is_empty() => Some("{}".to_string()),
        _ => None,
    }
}

fn json_dumps(v: &Json) -> String {
    if let Some(s) = json_scalar(v) {
        return s;
    }
    match v {
        Json::List(l) => format!("[{}]", l.iter().map(json_dumps).collect::<Vec<_>>().join(", ")),
        Json::Obj(o) => format!(
            "{{{}}}",
            o.iter().map(|(k, x)| format!("{}: {}", json_str(k), json_dumps(x))).collect::<Vec<_>>().join(", ")
        ),
        _ => unreachable!(),
    }
}

fn json_dumps_indent(v: &Json, level: usize) -> String {
    if let Some(s) = json_scalar(v) {
        return s;
    }
    let pad = "  ".repeat(level + 1);
    let close = "  ".repeat(level);
    match v {
        Json::List(l) => {
            let items: Vec<String> = l.iter().map(|x| format!("{}{}", pad, json_dumps_indent(x, level + 1))).collect();
            format!("[\n{}\n{}]", items.join(",\n"), close)
        }
        Json::Obj(o) => {
            let items: Vec<String> = o
                .iter()
                .map(|(k, x)| format!("{}{}: {}", pad, json_str(k), json_dumps_indent(x, level + 1)))
                .collect();
            format!("{{\n{}\n{}}}", items.join(",\n"), close)
        }
        _ => unreachable!(),
    }
}

const STAGES: [(&str, &[&str], &str); 12] = [
    ("01_tokenizer_vocab", &[], "tokenizer"),
    ("02_tokenizer_trained", &["01_tokenizer_vocab"], "tokenizer"),
    ("03_dataset_sharded", &["02_tokenizer_trained"], "dataset"),
    ("04_pretrained_base", &["03_dataset_sharded"], "checkpoint"),
    ("05_scaled_recipe", &["04_pretrained_base"], "checkpoint"),
    ("06_sft_checkpoint", &["05_scaled_recipe"], "sft_model"),
    ("07_reward_ppo_policy", &["06_sft_checkpoint"], "policy"),
    ("08_dpo_policy", &["06_sft_checkpoint"], "policy"),
    ("09_cai_grpo_policy", &["07_reward_ppo_policy", "08_dpo_policy"], "policy"),
    ("10_eval_report", &["09_cai_grpo_policy"], "eval_report"),
    ("11_quantized_weights", &["09_cai_grpo_policy"], "quantized_model"),
    ("12_inference_server", &["11_quantized_weights"], "server_spec"),
];

#[derive(Clone)]
struct Gate {
    op: &'static str,
    value: f64,
}

fn default_gates() -> Vec<(String, Gate)> {
    vec![
        ("mmlu".to_string(), Gate { op: ">=", value: 65.0 }),
        ("humaneval".to_string(), Gate { op: ">=", value: 40.0 }),
        ("truthfulqa".to_string(), Gate { op: ">=", value: 50.0 }),
        ("safety_refusal_rate".to_string(), Gate { op: "<=", value: 0.05 }),
        ("kl_from_reference".to_string(), Gate { op: "<=", value: 25.0 }),
        ("cost_total_usd".to_string(), Gate { op: "<=", value: 50000.0 }),
    ]
}

struct StageRecord {
    name: String,
    stage_type: String,
    input_hashes: Vec<String>,
    output_hash: String,
    wall_clock_sec: f64,
    cost_usd: f64,
    status: String,
}

struct Manifest {
    pipeline_version: String,
    seed: i64,
    git_commit: String,
    stages: Vec<StageRecord>,
    gates: Vec<(String, Gate)>,
    eval_metrics: Vec<(String, f64)>,
    budget_usd: f64,
    total_cost_usd: f64,
    shippable: bool,
}

impl Manifest {
    fn new(pipeline_version: &str, seed: i64, git_commit: &str) -> Self {
        Manifest {
            pipeline_version: pipeline_version.to_string(),
            seed,
            git_commit: git_commit.to_string(),
            stages: Vec::new(),
            gates: default_gates(),
            eval_metrics: Vec::new(),
            budget_usd: 50000.0,
            total_cost_usd: 0.0,
            shippable: false,
        }
    }

    fn metric(&self, name: &str) -> Option<f64> {
        self.eval_metrics.iter().find(|(k, _)| k == name).map(|(_, v)| *v)
    }

    fn set_metric(&mut self, name: &str, value: f64) {
        match self.eval_metrics.iter_mut().find(|(k, _)| k == name) {
            Some(entry) => entry.1 = value,
            None => self.eval_metrics.push((name.to_string(), value)),
        }
    }
}

struct ArtifactStore {
    store: HashMap<String, Vec<u8>>,
}

impl ArtifactStore {
    fn new() -> Self {
        ArtifactStore { store: HashMap::new() }
    }

    fn put(&mut self, blob: Vec<u8>) -> String {
        let h = sha256_hex(&blob);
        self.store.insert(h.clone(), blob);
        h
    }

    #[allow(dead_code)]
    fn get(&self, h: &str) -> &[u8] {
        &self.store[h]
    }

    fn has(&self, h: &str) -> bool {
        self.store.contains_key(h)
    }

    fn len(&self) -> usize {
        self.store.len()
    }
}

fn simulate_stage(name: &str, stage_type: &str, inputs: &[String], seed: i64) -> (Vec<u8>, f64, f64) {
    let mut payload = BTreeMap::new();
    payload.insert("stage".to_string(), Json::Str(name.to_string()));
    payload.insert("type".to_string(), Json::Str(stage_type.to_string()));
    payload.insert("inputs".to_string(), Json::List(inputs.iter().map(|s| Json::Str(s.clone())).collect()));
    payload.insert("seed".to_string(), Json::Int(seed));
    let blob = json_dumps(&Json::Obj(payload)).into_bytes();

    let (wall, cost) = match stage_type {
        "tokenizer" => (60, 5),
        "dataset" => (1800, 50),
        "checkpoint" => (7200, 400),
        "sft_model" => (3600, 150),
        "policy" => (5400, 300),
        "eval_report" => (600, 20),
        "quantized_model" => (300, 10),
        "server_spec" => (30, 1),
        _ => (100, 5),
    };
    (blob, wall as f64, cost as f64)
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

fn plan(manifest: &Manifest) -> String {
    let mut lines = vec!["PLAN".to_string()];
    lines.push("=".repeat(60));
    lines.push(format!("pipeline_version  : {}", manifest.pipeline_version));
    lines.push(format!("seed              : {}", manifest.seed));
    lines.push(format!("budget_usd        : ${}", group_digits(&format!("{:.0}", manifest.budget_usd))));
    lines.push(String::new());
    lines.push("dag:".to_string());
    for (name, deps, stage_type) in STAGES {
        let dep_str = if deps.is_empty() { "-".to_string() } else { deps.join(", ") };
        lines.push(format!("  {:<28}  [{}]  <- {}", name, stage_type, dep_str));
    }
    lines.push(String::new());
    lines.push("gates:".to_string());
    for (metric, gate) in &manifest.gates {
        lines.push(format!("  {:<22}  {}  {}", metric, gate.op, py_float(gate.value)));
    }
    lines.join("\n")
}

fn run(mut manifest: Manifest, store: &mut ArtifactStore, injected_eval: Option<Vec<(String, f64)>>) -> Manifest {
    let mut name_to_hash: HashMap<String, String> = HashMap::new();

    for (name, deps, stage_type) in STAGES {
        let input_hashes: Vec<String> = deps.iter().map(|d| name_to_hash[*d].clone()).collect();
        for h in &input_hashes {
            if !store.has(h) {
                panic!("input hash missing for stage {}: {}...", name, &h[..12]);
            }
        }

        let (blob, wall, cost) = simulate_stage(name, stage_type, &input_hashes, manifest.seed);
        let output_hash = store.put(blob);

        manifest.total_cost_usd += cost;
        if manifest.total_cost_usd > manifest.budget_usd {
            manifest.stages.push(StageRecord {
                name: name.to_string(),
                stage_type: stage_type.to_string(),
                input_hashes,
                output_hash: String::new(),
                wall_clock_sec: wall,
                cost_usd: cost,
                status: "halted_over_budget".to_string(),
            });
            return manifest;
        }

        manifest.stages.push(StageRecord {
            name: name.to_string(),
            stage_type: stage_type.to_string(),
            input_hashes,
            output_hash: output_hash.clone(),
            wall_clock_sec: wall,
            cost_usd: cost,
            status: "ok".to_string(),
        });
        name_to_hash.insert(name.to_string(), output_hash);
    }

    manifest.eval_metrics = match injected_eval {
        Some(e) => e,
        None => vec![
            ("mmlu".to_string(), 68.4),
            ("humaneval".to_string(), 42.1),
            ("truthfulqa".to_string(), 53.7),
            ("safety_refusal_rate".to_string(), 0.03),
            ("kl_from_reference".to_string(), 18.5),
            ("cost_total_usd".to_string(), manifest.total_cost_usd),
        ],
    };
    manifest
}

fn gate(manifest: &mut Manifest) -> (bool, Vec<String>) {
    let mut reasons = Vec::new();
    let mut all_pass = true;
    for (metric, g) in &manifest.gates {
        let value = match manifest.metric(metric) {
            None => {
                reasons.push(format!("HOLD: missing metric {}", metric));
                all_pass = false;
                continue;
            }
            Some(v) => v,
        };

        let passed = if g.op == ">=" { value >= g.value } else { value <= g.value };
        if !passed {
            reasons.push(format!("HOLD: {}={} fails gate {} {}", metric, py_float(value), g.op, py_float(g.value)));
            all_pass = false;
        } else {
            reasons.push(format!("PASS: {}={} {} {}", metric, py_float(value), g.op, py_float(g.value)));
        }
    }

    manifest.shippable = all_pass;
    (all_pass, reasons)
}

fn manifest_to_json(manifest: &Manifest) -> String {
    let mut d = BTreeMap::new();
    d.insert("pipeline_version".to_string(), Json::Str(manifest.pipeline_version.clone()));
    d.insert("seed".to_string(), Json::Int(manifest.seed));
    d.insert("git_commit".to_string(), Json::Str(manifest.git_commit.clone()));
    let stages = manifest
        .stages
        .iter()
        .map(|s| {
            let mut o = BTreeMap::new();
            o.insert("name".to_string(), Json::Str(s.name.clone()));
            o.insert("stage_type".to_string(), Json::Str(s.stage_type.clone()));
            o.insert(
                "input_hashes".to_string(),
                Json::List(s.input_hashes.iter().map(|h| Json::Str(h.clone())).collect()),
            );
            o.insert("output_hash".to_string(), Json::Str(s.output_hash.clone()));
            o.insert("wall_clock_sec".to_string(), Json::Float(s.wall_clock_sec));
            o.insert("cost_usd".to_string(), Json::Float(s.cost_usd));
            o.insert("status".to_string(), Json::Str(s.status.clone()));
            Json::Obj(o)
        })
        .collect();
    d.insert("stages".to_string(), Json::List(stages));
    let mut gates = BTreeMap::new();
    for (metric, g) in &manifest.gates {
        let mut o = BTreeMap::new();
        o.insert("op".to_string(), Json::Str(g.op.to_string()));
        o.insert("value".to_string(), Json::Float(g.value));
        gates.insert(metric.clone(), Json::Obj(o));
    }
    d.insert("gates".to_string(), Json::Obj(gates));
    let mut metrics = BTreeMap::new();
    for (k, v) in &manifest.eval_metrics {
        metrics.insert(k.clone(), Json::Float(*v));
    }
    d.insert("eval_metrics".to_string(), Json::Obj(metrics));
    d.insert("budget_usd".to_string(), Json::Float(manifest.budget_usd));
    d.insert("total_cost_usd".to_string(), Json::Float(manifest.total_cost_usd));
    d.insert("shippable".to_string(), Json::Bool(manifest.shippable));
    json_dumps_indent(&Json::Obj(d), 0)
}

fn real_main(argv: &[String]) -> i32 {
    let command = if argv.len() > 1 { argv[1].as_str() } else { "demo" };
    let mut manifest = Manifest::new("1.2.3", 42, "a1b2c3d");
    let mut store = ArtifactStore::new();

    if command == "plan" {
        println!("{}", plan(&manifest));
        return 0;
    }

    if command == "run" {
        manifest = run(manifest, &mut store, None);
        println!("{}", manifest_to_json(&manifest));
        return if manifest.stages.iter().all(|s| s.status == "ok") { 0 } else { 2 };
    }

    if command == "gate" {
        manifest = run(manifest, &mut store, None);
        let (ok, reasons) = gate(&mut manifest);
        println!("{}", reasons.join("\n"));
        println!("{}", if ok { "SHIP" } else { "HOLD" });
        return if ok { 0 } else { 2 };
    }

    if command == "demo" {
        println!("{}", plan(&manifest));
        println!();
        println!("{}", "=".repeat(60));
        println!("RUN");
        println!("{}", "=".repeat(60));
        let t0 = Instant::now();
        manifest = run(manifest, &mut store, None);
        for s in &manifest.stages {
            let short = if s.output_hash.is_empty() { "-" } else { &s.output_hash[..10] };
            println!(
                "  {:<28} {:<20} hash={:<10} cost=${:>7.0}  wall={:>6.0}s",
                s.name, s.status, short, s.cost_usd, s.wall_clock_sec
            );
        }
        println!("\nartifacts stored : {}", store.len());
        println!("total cost_usd   : ${}", group_digits(&format!("{:.0}", manifest.total_cost_usd)));
        println!("wall (simulated) : {:.3}s of orchestrator overhead", t0.elapsed().as_secs_f64());

        println!();
        println!("{}", "=".repeat(60));
        println!("GATE (passing eval)");
        println!("{}", "=".repeat(60));
        let (ok, reasons) = gate(&mut manifest);
        for r in &reasons {
            println!("  {}", r);
        }
        println!("  -> {}", if ok { "SHIP" } else { "HOLD" });

        println!();
        println!("{}", "=".repeat(60));
        println!("GATE (failing eval)");
        println!("{}", "=".repeat(60));
        manifest.set_metric("mmlu", 42.0);
        manifest.set_metric("kl_from_reference", 40.0);
        let (ok2, reasons2) = gate(&mut manifest);
        for r in &reasons2 {
            println!("  {}", r);
        }
        println!("  -> {}", if ok2 { "SHIP" } else { "HOLD" });
        return 0;
    }

    eprintln!("unknown command: {}", command);
    eprintln!("usage: main.py [plan|run|gate|demo]");
    1
}

fn main() {
    let argv: Vec<String> = std::env::args().collect();
    std::process::exit(real_main(&argv));
}
