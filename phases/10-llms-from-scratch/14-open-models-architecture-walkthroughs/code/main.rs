// Lesson: Open Models: Architecture Walkthroughs (phase 10 / lesson 14)
// Rust port of code/main.py. Standard library only.
// Source: phases/10-llms-from-scratch/14-open-models-architecture-walkthroughs/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

use std::collections::BTreeSet;

struct Config {
    hidden_size: u64,
    intermediate_size: u64,
    num_hidden_layers: u64,
    num_attention_heads: u64,
    num_key_value_heads: u64,
    vocab_size: u64,
    max_position_embeddings: u64,
    head_dim: Option<u64>,
    activation: Option<&'static str>,
    norm: Option<&'static str>,
    norms_per_layer: Option<u64>,
    position: Option<&'static str>,
    moe: bool,
    tie_word_embeddings: bool,
    layer_types: Option<Vec<&'static str>>,
    sliding_window: Option<u64>,
    attn_output_gate: Option<&'static str>,
    num_experts: Option<u64>,
    experts_per_token: Option<u64>,
    moe_intermediate_size: Option<u64>,
    first_dense_layers: Option<u64>,
    shared_experts: Option<u64>,
    attention: Option<&'static str>,
    kv_lora_rank: Option<u64>,
}

fn base_config() -> Config {
    Config {
        hidden_size: 0,
        intermediate_size: 0,
        num_hidden_layers: 0,
        num_attention_heads: 0,
        num_key_value_heads: 0,
        vocab_size: 0,
        max_position_embeddings: 0,
        head_dim: None,
        activation: None,
        norm: None,
        norms_per_layer: None,
        position: None,
        moe: false,
        tie_word_embeddings: false,
        layer_types: None,
        sliding_window: None,
        attn_output_gate: None,
        num_experts: None,
        experts_per_token: None,
        moe_intermediate_size: None,
        first_dense_layers: None,
        shared_experts: None,
        attention: None,
        kv_lora_rank: None,
    }
}

fn repeat_kinds(pattern: &[&'static str], times: usize) -> Vec<&'static str> {
    let mut out = Vec::new();
    for _ in 0..times {
        out.extend_from_slice(pattern);
    }
    out
}

fn configs() -> Vec<(&'static str, Config)> {
    vec![
        (
            "gpt2-small",
            Config {
                hidden_size: 768,
                intermediate_size: 3072,
                num_hidden_layers: 12,
                num_attention_heads: 12,
                num_key_value_heads: 12,
                vocab_size: 50257,
                max_position_embeddings: 1024,
                activation: Some("gelu"),
                norm: Some("layernorm"),
                position: Some("learned"),
                moe: false,
                tie_word_embeddings: true,
                ..base_config()
            },
        ),
        (
            "mistral-7b",
            Config {
                hidden_size: 4096,
                intermediate_size: 14336,
                num_hidden_layers: 32,
                num_attention_heads: 32,
                num_key_value_heads: 8,
                vocab_size: 32000,
                max_position_embeddings: 32768,
                activation: Some("swiglu"),
                norm: Some("rmsnorm"),
                position: Some("rope"),
                moe: false,
                ..base_config()
            },
        ),
        (
            "llama3-8b",
            Config {
                hidden_size: 4096,
                intermediate_size: 14336,
                num_hidden_layers: 32,
                num_attention_heads: 32,
                num_key_value_heads: 8,
                vocab_size: 128256,
                max_position_embeddings: 131072,
                activation: Some("swiglu"),
                norm: Some("rmsnorm"),
                position: Some("rope"),
                moe: false,
                ..base_config()
            },
        ),
        (
            "llama3-70b",
            Config {
                hidden_size: 8192,
                intermediate_size: 28672,
                num_hidden_layers: 80,
                num_attention_heads: 64,
                num_key_value_heads: 8,
                vocab_size: 128256,
                max_position_embeddings: 131072,
                activation: Some("swiglu"),
                norm: Some("rmsnorm"),
                position: Some("rope"),
                moe: false,
                ..base_config()
            },
        ),
        (
            "gemma2-9b",
            Config {
                hidden_size: 3584,
                intermediate_size: 14336,
                num_hidden_layers: 42,
                num_attention_heads: 16,
                num_key_value_heads: 8,
                head_dim: Some(256),
                vocab_size: 256000,
                max_position_embeddings: 8192,
                activation: Some("geglu"),
                norm: Some("rmsnorm"),
                norms_per_layer: Some(4),
                position: Some("rope-sliding"),
                moe: false,
                tie_word_embeddings: true,
                layer_types: Some(repeat_kinds(&["sliding_attention", "full_attention"], 21)),
                sliding_window: Some(4096),
                ..base_config()
            },
        ),
        (
            "spark-x2.5-4b",
            Config {
                hidden_size: 2560,
                intermediate_size: 10240,
                num_hidden_layers: 36,
                num_attention_heads: 16,
                num_key_value_heads: 4,
                head_dim: Some(256),
                vocab_size: 131072,
                max_position_embeddings: 1048576,
                activation: Some("geglu"),
                norm: Some("rmsnorm"),
                position: Some("rope-sliding"),
                moe: false,
                tie_word_embeddings: true,
                attn_output_gate: Some("headwise"),
                layer_types: Some(repeat_kinds(
                    &["sliding_attention", "sliding_attention", "sliding_attention", "full_attention"],
                    9,
                )),
                sliding_window: Some(512),
                ..base_config()
            },
        ),
        (
            "mixtral-8x7b",
            Config {
                hidden_size: 4096,
                intermediate_size: 14336,
                num_hidden_layers: 32,
                num_attention_heads: 32,
                num_key_value_heads: 8,
                vocab_size: 32000,
                max_position_embeddings: 32768,
                activation: Some("swiglu"),
                norm: Some("rmsnorm"),
                position: Some("rope"),
                moe: true,
                num_experts: Some(8),
                experts_per_token: Some(2),
                ..base_config()
            },
        ),
        (
            "qwen2.5-72b",
            Config {
                hidden_size: 8192,
                intermediate_size: 29568,
                num_hidden_layers: 80,
                num_attention_heads: 64,
                num_key_value_heads: 8,
                vocab_size: 152064,
                max_position_embeddings: 131072,
                activation: Some("swiglu"),
                norm: Some("rmsnorm"),
                position: Some("rope-yarn"),
                moe: false,
                ..base_config()
            },
        ),
        (
            "deepseek-v3",
            Config {
                hidden_size: 7168,
                intermediate_size: 18432,
                moe_intermediate_size: Some(2048),
                num_hidden_layers: 61,
                first_dense_layers: Some(3),
                num_attention_heads: 128,
                num_key_value_heads: 128,
                vocab_size: 129280,
                max_position_embeddings: 131072,
                activation: Some("swiglu"),
                norm: Some("rmsnorm"),
                position: Some("rope"),
                moe: true,
                num_experts: Some(256),
                experts_per_token: Some(8),
                shared_experts: Some(1),
                attention: Some("mla"),
                kv_lora_rank: Some(512),
                ..base_config()
            },
        ),
    ]
}

struct Breakdown {
    name: String,
    total_params: u64,
    active_params: u64,
    mlp_params_per_layer: u64,
    attn_params_per_layer: u64,
    embedding_params: u64,
    kv_cache_bytes_bf16: u64,
    kv_cache_all_full_bytes_bf16: u64,
    full_attention_layers: u64,
    mlp_ratio: f64,
    attention_scheme: String,
    verdict: String,
}

fn attention_scheme(config: &Config) -> String {
    if config.attention == Some("mla") {
        return "MLA".to_string();
    }
    let q_heads = config.num_attention_heads;
    let kv_heads = config.num_key_value_heads;
    if kv_heads == 1 {
        return "MQA".to_string();
    }
    if kv_heads == q_heads {
        return "MHA".to_string();
    }
    format!("GQA ({}/{})", q_heads, kv_heads)
}

fn head_dim(config: &Config) -> u64 {
    config.head_dim.unwrap_or(config.hidden_size / config.num_attention_heads)
}

fn attention_params_per_layer(config: &Config) -> u64 {
    let h = config.hidden_size;
    let q_heads = config.num_attention_heads;
    let kv_heads = config.num_key_value_heads;
    let hd = head_dim(config);
    if config.attention == Some("mla") {
        let lora = config.kv_lora_rank.unwrap_or(512);
        return h * h + 2 * (h * lora + lora * q_heads * hd) + h * h;
    }
    let q_proj = h * (q_heads * hd);
    let kv_proj = 2 * h * (kv_heads * hd);
    let out_proj = (q_heads * hd) * h;
    let gate = if config.attn_output_gate == Some("headwise") { h * q_heads } else { 0 };
    q_proj + kv_proj + out_proj + gate
}

const LAYER_TYPES: [&str; 2] = ["full_attention", "sliding_attention"];

fn layer_types(config: &Config) -> Vec<&'static str> {
    let n_layers = config.num_hidden_layers;
    let kinds = match &config.layer_types {
        None => return vec!["full_attention"; n_layers as usize],
        Some(k) => k,
    };
    if kinds.len() as u64 != n_layers {
        panic!("layer_types has {} entries but num_hidden_layers is {}", kinds.len(), n_layers);
    }
    let unknown: BTreeSet<&str> = kinds.iter().copied().filter(|k| !LAYER_TYPES.contains(k)).collect();
    if !unknown.is_empty() {
        panic!("unsupported layer_types: {}", unknown.into_iter().collect::<Vec<_>>().join(", "));
    }
    let has_window = matches!(config.sliding_window, Some(w) if w != 0);
    if kinds.contains(&"sliding_attention") && !has_window {
        panic!("layer_types has sliding_attention layers but no sliding_window");
    }
    kinds.clone()
}

fn cached_tokens_per_layer(config: &Config) -> Vec<u64> {
    let max_seq = config.max_position_embeddings;
    let window = config.sliding_window;
    layer_types(config)
        .into_iter()
        .map(|kind| match window {
            Some(w) if kind == "sliding_attention" && w != 0 => max_seq.min(w),
            _ => max_seq,
        })
        .collect()
}

fn mlp_params(h: u64, ff: u64, activation: &str) -> u64 {
    if activation == "swiglu" || activation == "geglu" {
        let gate_and_up = 2 * h * ff;
        let down = ff * h;
        return gate_and_up + down;
    }
    2 * h * ff
}

#[allow(dead_code)]
fn mlp_params_per_layer(config: &Config) -> u64 {
    mlp_params(config.hidden_size, config.intermediate_size, config.activation.unwrap_or("gelu"))
}

fn layer_norm_params_per_layer(config: &Config) -> u64 {
    let h = config.hidden_size;
    let norms = config.norms_per_layer.unwrap_or(2);
    if config.norm == Some("rmsnorm") {
        return norms * h;
    }
    norms * 2 * h
}

fn analyze(name: &str, config: &Config) -> Breakdown {
    let h = config.hidden_size;
    let n_layers = config.num_hidden_layers;
    let vocab = config.vocab_size;
    let activation = config.activation.unwrap_or("gelu");
    let dense_ff = config.intermediate_size;

    let emb = vocab * h;
    let attn = attention_params_per_layer(config);
    let dense_mlp = mlp_params(h, dense_ff, activation);
    let norm = layer_norm_params_per_layer(config);
    let final_norm = if config.norm == Some("rmsnorm") { h } else { 2 * h };
    let lm_head = if config.tie_word_embeddings { 0 } else { vocab * h };

    let total;
    let active;
    let mlp;
    if config.moe {
        let n_experts = config.num_experts.expect("num_experts");
        let experts_per_tok = config.experts_per_token.expect("experts_per_token");
        let shared = config.shared_experts.unwrap_or(0);
        let moe_ff = config.moe_intermediate_size.unwrap_or(dense_ff);
        let expert_mlp = mlp_params(h, moe_ff, activation);
        let first_dense = config.first_dense_layers.unwrap_or(0);
        let n_moe_layers = n_layers - first_dense;
        let router = h * n_experts;

        let dense_block_params = attn + dense_mlp + norm;
        let moe_block_params = attn + expert_mlp * n_experts + expert_mlp * shared + router + norm;
        let active_moe_block = attn + expert_mlp * (experts_per_tok + shared) + router + norm;

        total = emb + first_dense * dense_block_params + n_moe_layers * moe_block_params + final_norm + lm_head;
        active = emb + first_dense * dense_block_params + n_moe_layers * active_moe_block + final_norm + lm_head;
        mlp = expert_mlp;
    } else {
        let dense_block_params = attn + dense_mlp + norm;
        total = emb + n_layers * dense_block_params + final_norm + lm_head;
        active = total;
        mlp = dense_mlp;
    }

    let max_seq = config.max_position_embeddings;
    let cached = cached_tokens_per_layer(config);
    let full_layers = layer_types(config).iter().filter(|k| **k == "full_attention").count() as u64;
    let per_token_per_layer = if config.attention == Some("mla") {
        config.kv_lora_rank.unwrap_or(512)
    } else {
        config.num_key_value_heads * head_dim(config)
    };
    let kv_cache_bytes = 2 * per_token_per_layer * cached.iter().sum::<u64>() * 2;
    let kv_cache_all_full = 2 * per_token_per_layer * n_layers * max_seq * 2;

    let mlp_ratio = if config.moe {
        config.moe_intermediate_size.unwrap_or(dense_ff) as f64 / h as f64
    } else {
        dense_ff as f64 / h as f64
    };

    let mut flags: Vec<String> = Vec::new();
    flags.push(config.norm.unwrap_or("layernorm").to_uppercase());
    flags.push(config.activation.unwrap_or("gelu").to_uppercase());
    flags.push(config.position.unwrap_or("learned").to_uppercase());
    let scheme = attention_scheme(config);
    flags.push(scheme.clone());
    if full_layers < n_layers {
        flags.push(format!("{} full / {} sliding", full_layers, n_layers - full_layers));
    }
    if config.moe {
        flags.push(format!(
            "MoE {}e/top-{}",
            config.num_experts.expect("num_experts"),
            config.experts_per_token.expect("experts_per_token")
        ));
    }
    let verdict = flags.join(" · ");

    Breakdown {
        name: name.to_string(),
        total_params: total,
        active_params: active,
        mlp_params_per_layer: mlp,
        attn_params_per_layer: attn,
        embedding_params: emb,
        kv_cache_bytes_bf16: kv_cache_bytes,
        kv_cache_all_full_bytes_bf16: kv_cache_all_full,
        full_attention_layers: full_layers,
        mlp_ratio,
        attention_scheme: scheme,
        verdict,
    }
}

fn group_digits(n: u64) -> String {
    let s = n.to_string();
    let mut out = String::new();
    for (i, ch) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    out
}

fn fmt_billions(x: u64) -> String {
    if x >= 1_000_000_000 {
        return format!("{:.1}B", x as f64 / 1e9);
    }
    if x >= 1_000_000 {
        return format!("{:.1}M", x as f64 / 1e6);
    }
    group_digits(x)
}

fn fmt_bytes(b: u64) -> String {
    let mut b = b as f64;
    for unit in ["B", "KB", "MB", "GB", "TB"] {
        if b < 1000.0 {
            return format!("{:.1}{}", b, unit);
        }
        b /= 1000.0;
    }
    format!("{:.1}PB", b)
}

fn print_breakdown(b: &Breakdown, config: &Config) {
    println!("\n{}", b.name);
    println!("{}", "-".repeat(70));
    println!("  architecture    : {}", b.verdict);
    println!("  total params    : {}", fmt_billions(b.total_params));
    println!("  active params   : {}", fmt_billions(b.active_params));
    println!("  embedding       : {}", fmt_billions(b.embedding_params));
    println!("  attn / layer    : {}", fmt_billions(b.attn_params_per_layer));
    println!(
        "  mlp  / layer    : {}  (ratio ff/h = {:.2})",
        fmt_billions(b.mlp_params_per_layer),
        b.mlp_ratio
    );
    println!("  context length  : {}", group_digits(config.max_position_embeddings));
    println!("  KV cache BF16   : {}  (per sequence at max context)", fmt_bytes(b.kv_cache_bytes_bf16));
    if b.kv_cache_bytes_bf16 < b.kv_cache_all_full_bytes_bf16 {
        println!(
            "  if all full     : {}  (sliding window {} on {} layers)",
            fmt_bytes(b.kv_cache_all_full_bytes_bf16),
            group_digits(config.sliding_window.expect("sliding_window")),
            config.num_hidden_layers - b.full_attention_layers
        );
    }
}

fn main() {
    let all = configs();
    println!("{}", "=".repeat(70));
    println!("OPEN MODEL ARCHITECTURE WALKTHROUGH");
    println!("{}", "=".repeat(70));
    for (name, config) in &all {
        let b = analyze(name, config);
        print_breakdown(&b, config);
    }
    println!();
    println!("{}", "=".repeat(70));
    println!("HEADLINE RATIOS");
    println!("{}", "=".repeat(70));
    for (name, config) in &all {
        let b = analyze(name, config);
        let ratio = if b.total_params != 0 {
            b.active_params as f64 / b.total_params as f64
        } else {
            1.0
        };
        println!(
            "  {:<18}  total={:>8}  active={:>8}  active/total={:.2}%  attn={}",
            name,
            fmt_billions(b.total_params),
            fmt_billions(b.active_params),
            ratio * 100.0,
            b.attention_scheme
        );
    }
}
