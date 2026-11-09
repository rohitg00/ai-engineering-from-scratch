// Lesson: Jamba: Hybrid SSM-Transformer (phase 10 / lesson 21)
// Rust port of code/main.py. Standard library only.
// Source: phases/10-llms-from-scratch/21-jamba-hybrid-ssm-transformer/docs/en.md
// Build: rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson

const BYTES_BF16: u64 = 2;
#[allow(dead_code)]
const BYTES_FP8: u64 = 1;

#[allow(dead_code)]
struct HybridConfig {
    name: &'static str,
    total_layers: u64,
    attn_layers: u64,
    hidden: u64,
    n_q_heads: u64,
    n_kv_heads: u64,
    head_dim: u64,
    ssm_state_size: u64,
}

fn kv_cache_bytes(cfg: &HybridConfig, ctx: u64, bytes_per_elem: u64) -> u64 {
    2 * cfg.attn_layers * cfg.n_kv_heads * cfg.head_dim * ctx * bytes_per_elem
}

fn ssm_state_bytes(cfg: &HybridConfig, bytes_per_elem: u64) -> u64 {
    let ssm_layers = cfg.total_layers - cfg.attn_layers;
    ssm_layers * cfg.hidden * cfg.ssm_state_size * bytes_per_elem
}

fn fmt_bytes(b: u64) -> String {
    let mut b = b as f64;
    for unit in ["B", "KB", "MB", "GB", "TB"] {
        if b < 1024.0 {
            return format!("{:.2}{}", b, unit);
        }
        b /= 1024.0;
    }
    format!("{:.2}PB", b)
}

fn cfg(
    name: &'static str,
    total_layers: u64,
    attn_layers: u64,
    hidden: u64,
    n_q_heads: u64,
    n_kv_heads: u64,
    head_dim: u64,
    ssm_state_size: u64,
) -> HybridConfig {
    HybridConfig {
        name,
        total_layers,
        attn_layers,
        hidden,
        n_q_heads,
        n_kv_heads,
        head_dim,
        ssm_state_size,
    }
}

fn main() {
    println!("{}", "=".repeat(74));
    println!("JAMBA HYBRID SSM-TRANSFORMER MEMORY CALCULATOR (Phase 10, Lesson 21)");
    println!("{}", "=".repeat(74));
    println!();

    let configs = [
        cfg("pure Transformer 32L", 32, 32, 4096, 32, 32, 128, 0),
        cfg("pure Transformer 32L (GQA 8)", 32, 32, 4096, 32, 8, 128, 0),
        cfg("Jamba 1:7 hybrid 32L", 32, 4, 4096, 32, 32, 128, 16),
        cfg("Jamba 1:3 hybrid 32L", 32, 8, 4096, 32, 32, 128, 16),
        cfg("Jamba 1:15 hybrid 32L", 32, 2, 4096, 32, 32, 128, 16),
        cfg("pure Mamba 32L", 32, 0, 4096, 0, 0, 128, 16),
    ];

    let contexts: [u64; 4] = [8_192, 65_536, 131_072, 262_144];

    println!("{}", "-".repeat(74));
    println!("Memory at BF16 (2 bytes per element)");
    println!("{}", "-".repeat(74));
    let mut header = format!("  {:<32}", "config");
    for ctx in contexts {
        header += &format!("{:>10}", format!("{}k", ctx / 1000));
    }
    println!("{}", header);
    for c in &configs {
        let mut row = format!("  {:<32}", c.name);
        for ctx in contexts {
            let kv = kv_cache_bytes(c, ctx, BYTES_BF16);
            let ss = ssm_state_bytes(c, BYTES_BF16);
            let total = kv + ss;
            row += &format!("{:>10}", fmt_bytes(total));
        }
        println!("{}", row);
    }
    println!();

    println!("{}", "-".repeat(74));
    println!("Headline savings at 256k context (BF16), vs pure Transformer full-MHA");
    println!("{}", "-".repeat(74));
    let baseline = kv_cache_bytes(&configs[0], 262_144, BYTES_BF16);
    for c in &configs {
        let kv = kv_cache_bytes(c, 262_144, BYTES_BF16);
        let ss = ssm_state_bytes(c, BYTES_BF16);
        let total = kv + ss;
        let savings = (1.0 - total as f64 / baseline as f64) * 100.0;
        println!(
            "  {:<32} total {:>10}  ({:+.1}% vs baseline)",
            c.name,
            fmt_bytes(total),
            savings
        );
    }
    println!();

    println!("{}", "-".repeat(74));
    println!("Attention layer fraction vs memory fraction at 256k (BF16)");
    println!("{}", "-".repeat(74));
    for c in &configs {
        let attn_frac = if c.total_layers > 0 {
            c.attn_layers as f64 / c.total_layers as f64
        } else {
            0.0
        };
        let kv = kv_cache_bytes(c, 262_144, BYTES_BF16);
        let ss = ssm_state_bytes(c, BYTES_BF16);
        let mem_frac = if kv + ss > 0 {
            kv as f64 / (kv + ss + 1) as f64
        } else {
            0.0
        };
        println!(
            "  {:<32} attn_frac={:.3}  kv_frac_of_total_cache={:.3}",
            c.name, attn_frac, mem_frac
        );
    }
    println!();

    println!("{}", "=".repeat(74));
    println!("TAKEAWAY");
    println!("{}", "-".repeat(74));
    println!("  Pure Transformer at 256k = 128 GB just for KV cache, will not fit");
    println!("  on an 80GB single-GPU deployment after you add weights and activations.");
    println!("  Jamba 1:7 = 16 GB KV cache + ~4 MB SSM state = fits comfortably.");
    println!("  That is the 256k-on-one-GPU claim from the AI21 paper, concretely.");
    println!("  Mamba-3 pushes pure SSM further; hybrids will likely adopt it as");
    println!("  the SSM side of the next-generation recipe.");
}
