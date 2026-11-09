// Lesson: DeepSeek-V3 Architecture Walkthrough (phase 10 / lesson 20)
// Rust port of code/main.py. Standard library only.
// Source: phases/10-llms-from-scratch/20-deepseek-v3-walkthrough/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

#[allow(dead_code)]
#[derive(Clone)]
struct Config {
    hidden_size: u64,
    intermediate_size: u64,
    moe_intermediate_size: u64,
    num_hidden_layers: u64,
    first_k_dense_layers: u64,
    num_attention_heads: u64,
    num_key_value_heads: u64,
    kv_lora_rank: u64,
    q_lora_rank: u64,
    num_experts: u64,
    num_experts_per_tok: u64,
    shared_experts: u64,
    max_position_embeddings: u64,
    rope_theta: f64,
    vocab_size: u64,
    mtp_modules: u64,
    moe_router_enabled: bool,
}

const DEEPSEEK_V3: Config = Config {
    hidden_size: 7168,
    intermediate_size: 18432,
    moe_intermediate_size: 2048,
    num_hidden_layers: 61,
    first_k_dense_layers: 3,
    num_attention_heads: 128,
    num_key_value_heads: 128,
    kv_lora_rank: 512,
    q_lora_rank: 1536,
    num_experts: 256,
    num_experts_per_tok: 8,
    shared_experts: 1,
    max_position_embeddings: 163_840,
    rope_theta: 10000.0,
    vocab_size: 129_280,
    mtp_modules: 1,
    moe_router_enabled: true,
};

struct ComponentParams {
    embedding: u64,
    attention_per_layer: u64,
    dense_mlp_per_layer: u64,
    expert_mlp_each: u64,
    shared_expert: u64,
    router_per_layer: u64,
    rmsnorm_per_layer: u64,
    final_norm: u64,
    mtp_module: u64,
}

fn mla_attention_params(hidden: u64, n_heads: u64, head_dim: u64, kv_lora: u64, q_lora: u64) -> u64 {
    let q_down = hidden * q_lora;
    let q_up = q_lora * (n_heads * head_dim);
    let kv_down = hidden * kv_lora;
    let k_up = kv_lora * (n_heads * head_dim);
    let v_up = kv_lora * (n_heads * head_dim);
    let o_proj = (n_heads * head_dim) * hidden;
    q_down + q_up + kv_down + k_up + v_up + o_proj
}

fn swiglu_mlp_params(hidden: u64, ff: u64) -> u64 {
    2 * hidden * ff + ff * hidden
}

fn router_params(hidden: u64, n_experts: u64) -> u64 {
    hidden * n_experts
}

fn rmsnorm_params(hidden: u64) -> u64 {
    2 * hidden
}

fn mtp_module_params(hidden: u64, ff: u64) -> u64 {
    let projection = 2 * hidden * hidden;
    let attention = 4 * hidden * hidden;
    let mlp = swiglu_mlp_params(hidden, ff);
    let norms = 2 * rmsnorm_params(hidden);
    projection + attention + mlp + norms
}

fn compute_components(cfg: &Config) -> ComponentParams {
    let h = cfg.hidden_size;
    let n_heads = cfg.num_attention_heads;
    let head_dim = h / n_heads;
    let vocab = cfg.vocab_size;
    let dense_ff = cfg.intermediate_size;
    let moe_ff = cfg.moe_intermediate_size;

    let emb = vocab * h;
    let attn = mla_attention_params(h, n_heads, head_dim, cfg.kv_lora_rank, cfg.q_lora_rank);
    let dense_mlp = swiglu_mlp_params(h, dense_ff);
    let expert = swiglu_mlp_params(h, moe_ff);
    let shared = swiglu_mlp_params(h, moe_ff) * cfg.shared_experts;
    let router = router_params(h, cfg.num_experts);
    let norm_per = 2 * rmsnorm_params(h);
    let final_norm = rmsnorm_params(h);
    let mtp = mtp_module_params(h, dense_ff) * cfg.mtp_modules;

    ComponentParams {
        embedding: emb,
        attention_per_layer: attn,
        dense_mlp_per_layer: dense_mlp,
        expert_mlp_each: expert,
        shared_expert: shared,
        router_per_layer: router,
        rmsnorm_per_layer: norm_per,
        final_norm,
        mtp_module: mtp,
    }
}

struct ArchReport {
    total: u64,
    active: u64,
    active_ratio: f64,
    kv_cache_bytes: u64,
    gqa_kv_cache_bytes_ref: u64,
    per_layer_attn: u64,
    per_layer_moe_block: u64,
    per_layer_active: u64,
    emb: u64,
}

fn compute_totals(cfg: &Config, ctx: Option<u64>) -> ArchReport {
    let c = compute_components(cfg);
    let n_layers = cfg.num_hidden_layers;
    let first_dense = cfg.first_k_dense_layers;
    let n_moe = n_layers - first_dense;
    let n_experts = cfg.num_experts;
    let top_k = cfg.num_experts_per_tok;
    let max_seq = ctx.unwrap_or(cfg.max_position_embeddings);

    let dense_layer = c.attention_per_layer + c.dense_mlp_per_layer + c.rmsnorm_per_layer;
    let moe_layer = c.attention_per_layer
        + n_experts * c.expert_mlp_each
        + c.shared_expert
        + c.router_per_layer
        + c.rmsnorm_per_layer;
    let active_moe_layer = c.attention_per_layer
        + top_k * c.expert_mlp_each
        + c.shared_expert
        + c.router_per_layer
        + c.rmsnorm_per_layer;

    let total = c.embedding + first_dense * dense_layer + n_moe * moe_layer + c.final_norm + c.mtp_module;
    let active = c.embedding + first_dense * dense_layer + n_moe * active_moe_layer + c.final_norm;

    let kv_cache = n_layers * cfg.kv_lora_rank * max_seq * 2;
    let kv_heads_hypothetical = 8;
    let head_dim_hypothetical = 128;
    let kv_cache_gqa = 2 * n_layers * kv_heads_hypothetical * head_dim_hypothetical * max_seq * 2;

    ArchReport {
        total,
        active,
        active_ratio: active as f64 / total as f64,
        kv_cache_bytes: kv_cache,
        gqa_kv_cache_bytes_ref: kv_cache_gqa,
        per_layer_attn: c.attention_per_layer,
        per_layer_moe_block: moe_layer,
        per_layer_active: active_moe_layer,
        emb: c.embedding,
    }
}

fn fmt(n: u64) -> String {
    if n >= 1_000_000_000 {
        return format!("{:.1}B", n as f64 / 1e9);
    }
    if n >= 1_000_000 {
        return format!("{:.1}M", n as f64 / 1e6);
    }
    if n >= 1_000 {
        return format!("{:.1}K", n as f64 / 1e3);
    }
    format!("{}", n)
}

fn fmt_bytes(b: u64) -> String {
    let mut b = b as f64;
    for unit in ["B", "KB", "MB", "GB", "TB"] {
        if b < 1024.0 {
            return format!("{:.1}{}", b, unit);
        }
        b /= 1024.0;
    }
    format!("{:.1}PB", b)
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

fn print_report(name: &str, cfg: &Config, ctx: Option<u64>) {
    let r = compute_totals(cfg, ctx);
    println!("\n{}", name);
    println!("{}", "-".repeat(70));
    println!("  total params       : {}", fmt(r.total));
    println!("  active params      : {}", fmt(r.active));
    println!("  active ratio       : {:.1}%", r.active_ratio * 100.0);
    println!("  embedding          : {}", fmt(r.emb));
    println!("  attention / layer  : {}  (MLA)", fmt(r.per_layer_attn));
    println!("  moe block / layer  : {}  (total)", fmt(r.per_layer_moe_block));
    println!("  active moe / layer : {}  (per forward)", fmt(r.per_layer_active));
    let ctx_used = ctx.unwrap_or(cfg.max_position_embeddings);
    println!("  KV cache BF16, {} ctx : {}", group_digits(ctx_used), fmt_bytes(r.kv_cache_bytes));
    println!("  GQA(8/128) reference       : {}", fmt_bytes(r.gqa_kv_cache_bytes_ref));
    println!(
        "  MLA savings              : {:.0}%",
        (1.0 - r.kv_cache_bytes as f64 / r.gqa_kv_cache_bytes_ref as f64) * 100.0
    );
}

fn main() {
    println!("{}", "=".repeat(70));
    println!("DEEPSEEK-V3 ARCHITECTURE WALKTHROUGH (Phase 10, Lesson 20)");
    println!("{}", "=".repeat(70));

    print_report("DeepSeek-V3 (published config)", &DEEPSEEK_V3, Some(131_072));

    let mut variant = DEEPSEEK_V3.clone();
    variant.kv_lora_rank = 256;
    print_report("DeepSeek-V3 (MLA rank 256 what-if)", &variant, Some(131_072));

    let mut variant = DEEPSEEK_V3.clone();
    variant.num_experts = 512;
    variant.num_experts_per_tok = 8;
    print_report("DeepSeek-V3 (512 experts, top-8 what-if)", &variant, Some(131_072));

    let mut variant = DEEPSEEK_V3.clone();
    variant.num_experts_per_tok = 16;
    print_report("DeepSeek-V3 (256 experts, top-16 what-if)", &variant, Some(131_072));

    println!();
    println!("{}", "=".repeat(70));
    println!("HEADLINE: 671B total / 37B active published, this calculator hits");
    println!("          ~664B total / ~30B active");
    println!("{}", "-".repeat(70));
    println!("  The delta comes from simplifications: MLA here skips the decoupled");
    println!("  RoPE dimensions, the untied output head is not counted, and the MTP");
    println!("  module is a dense stand-in (the published one is 14B and sits");
    println!("  outside the 671B). The active/total ratio lands near the paper's.");
}
