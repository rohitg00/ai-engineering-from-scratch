"""Architecture calculator for open LLMs.

Given a HuggingFace-style config dict, compute parameter counts by component,
KV cache at max context, MLP ratio, and a verdict on the architecture. Ships
with configs for Llama 3 8B, Mistral 7B, Mixtral 8x7B, DeepSeek V3, Qwen 2.5,
and GPT-2 Small for direct comparison.

Stdlib only. No torch, no downloads. The point is to read configs, not weights.
"""

from __future__ import annotations

from dataclasses import dataclass


CONFIGS = {
    "gpt2-small": {
        "hidden_size": 768, "intermediate_size": 3072,
        "num_hidden_layers": 12, "num_attention_heads": 12,
        "num_key_value_heads": 12, "vocab_size": 50257,
        "max_position_embeddings": 1024,
        "activation": "gelu", "norm": "layernorm",
        "position": "learned", "moe": False,
    },
    "mistral-7b": {
        "hidden_size": 4096, "intermediate_size": 14336,
        "num_hidden_layers": 32, "num_attention_heads": 32,
        "num_key_value_heads": 8, "vocab_size": 32000,
        "max_position_embeddings": 32768,
        "activation": "swiglu", "norm": "rmsnorm",
        "position": "rope", "moe": False,
    },
    "llama3-8b": {
        "hidden_size": 4096, "intermediate_size": 14336,
        "num_hidden_layers": 32, "num_attention_heads": 32,
        "num_key_value_heads": 8, "vocab_size": 128256,
        "max_position_embeddings": 131072,
        "activation": "swiglu", "norm": "rmsnorm",
        "position": "rope", "moe": False,
    },
    "llama3-70b": {
        "hidden_size": 8192, "intermediate_size": 28672,
        "num_hidden_layers": 80, "num_attention_heads": 64,
        "num_key_value_heads": 8, "vocab_size": 128256,
        "max_position_embeddings": 131072,
        "activation": "swiglu", "norm": "rmsnorm",
        "position": "rope", "moe": False,
    },
    "mixtral-8x7b": {
        "hidden_size": 4096, "intermediate_size": 14336,
        "num_hidden_layers": 32, "num_attention_heads": 32,
        "num_key_value_heads": 8, "vocab_size": 32000,
        "max_position_embeddings": 32768,
        "activation": "swiglu", "norm": "rmsnorm",
        "position": "rope",
        "moe": True, "num_experts": 8, "experts_per_token": 2,
    },
    "qwen2.5-72b": {
        "hidden_size": 8192, "intermediate_size": 29568,
        "num_hidden_layers": 80, "num_attention_heads": 64,
        "num_key_value_heads": 8, "vocab_size": 152064,
        "max_position_embeddings": 131072,
        "activation": "swiglu", "norm": "rmsnorm",
        "position": "rope-yarn", "moe": False,
    },
    "deepseek-v3": {
        "hidden_size": 7168, "intermediate_size": 18432,
        "moe_intermediate_size": 2048,
        "num_hidden_layers": 61, "first_dense_layers": 3,
        "num_attention_heads": 128,
        "num_key_value_heads": 128, "vocab_size": 129280,
        "max_position_embeddings": 131072,
        "activation": "swiglu", "norm": "rmsnorm",
        "position": "rope",
        "moe": True, "num_experts": 256, "experts_per_token": 8,
        "shared_experts": 1,
        "attention": "mla", "kv_lora_rank": 512,
    },
}


@dataclass
class Breakdown:
    name: str
    total_params: int
    active_params: int
    mlp_params_per_layer: int
    attn_params_per_layer: int
    embedding_params: int
    kv_cache_bytes_bf16: int
    mlp_ratio: float
    attention_scheme: str
    verdict: str


def attention_scheme(config: dict) -> str:
    if config.get("attention") == "mla":
        return "MLA"
    q_heads = config["num_attention_heads"]
    kv_heads = config["num_key_value_heads"]
    if kv_heads == 1:
        return "MQA"
    if kv_heads == q_heads:
        return "MHA"
    return f"GQA ({q_heads}/{kv_heads})"


def attention_params_per_layer(config: dict) -> int:
    h = config["hidden_size"]
    q_heads = config["num_attention_heads"]
    kv_heads = config["num_key_value_heads"]
    head_dim = h // q_heads
    if config.get("attention") == "mla":
        lora = config.get("kv_lora_rank", 512)
        return h * h + 2 * (h * lora + lora * q_heads * head_dim) + h * h
    q_proj = h * h
    kv_proj = 2 * h * (kv_heads * head_dim)
    out_proj = h * h
    return q_proj + kv_proj + out_proj


def mlp_params(h: int, ff: int, activation: str) -> int:
    if activation == "swiglu":
        gate_and_up = 2 * h * ff
        down = ff * h
        return gate_and_up + down
    return 2 * h * ff


def mlp_params_per_layer(config: dict) -> int:
    return mlp_params(
        config["hidden_size"],
        config["intermediate_size"],
        config.get("activation", "gelu"),
    )


def layer_norm_params_per_layer(config: dict) -> int:
    h = config["hidden_size"]
    if config.get("norm") == "rmsnorm":
        return 2 * h
    return 4 * h


def analyze(name: str, config: dict) -> Breakdown:
    h = config["hidden_size"]
    n_layers = config["num_hidden_layers"]
    vocab = config["vocab_size"]
    activation = config.get("activation", "gelu")
    dense_ff = config["intermediate_size"]

    emb = vocab * h
    attn = attention_params_per_layer(config)
    dense_mlp = mlp_params(h, dense_ff, activation)
    norm = layer_norm_params_per_layer(config)
    final_norm = h if config.get("norm") == "rmsnorm" else 2 * h

    if config.get("moe"):
        n_experts = config["num_experts"]
        experts_per_tok = config["experts_per_token"]
        shared = config.get("shared_experts", 0)
        moe_ff = config.get("moe_intermediate_size", dense_ff)
        expert_mlp = mlp_params(h, moe_ff, activation)
        first_dense = config.get("first_dense_layers", 0)
        n_moe_layers = n_layers - first_dense
        router = h * n_experts

        dense_block_params = attn + dense_mlp + norm
        moe_block_params = (
            attn
            + expert_mlp * n_experts
            + expert_mlp * shared
            + router
            + norm
        )
        active_moe_block = (
            attn
            + expert_mlp * (experts_per_tok + shared)
            + router
            + norm
        )

        total = (
            emb
            + first_dense * dense_block_params
            + n_moe_layers * moe_block_params
            + final_norm
        )
        active = (
            emb
            + first_dense * dense_block_params
            + n_moe_layers * active_moe_block
            + final_norm
        )
        mlp = expert_mlp
    else:
        dense_block_params = attn + dense_mlp + norm
        total = emb + n_layers * dense_block_params + final_norm
        active = total
        mlp = dense_mlp

    head_dim = h // config["num_attention_heads"]
    max_seq = config["max_position_embeddings"]
    if config.get("attention") == "mla":
        latent = config.get("kv_lora_rank", 512)
        kv_cache_bytes = 2 * n_layers * latent * max_seq * 2
    else:
        kv_heads = config["num_key_value_heads"]
        kv_cache_bytes = 2 * n_layers * kv_heads * head_dim * max_seq * 2

    if config.get("moe"):
        mlp_ratio = config.get("moe_intermediate_size", dense_ff) / h
    else:
        mlp_ratio = dense_ff / h

    flags = []
    flags.append(config.get("norm", "layernorm").upper())
    flags.append(config.get("activation", "gelu").upper())
    flags.append(config.get("position", "learned").upper())
    scheme = attention_scheme(config)
    flags.append(scheme)
    if config.get("moe"):
        flags.append(f"MoE {config['num_experts']}e/top-{config['experts_per_token']}")
    verdict = " · ".join(flags)

    return Breakdown(
        name=name,
        total_params=total,
        active_params=active,
        mlp_params_per_layer=mlp,
        attn_params_per_layer=attn,
        embedding_params=emb,
        kv_cache_bytes_bf16=kv_cache_bytes,
        mlp_ratio=mlp_ratio,
        attention_scheme=scheme,
        verdict=verdict,
    )


def fmt_billions(x: int) -> str:
    if x >= 1_000_000_000:
        return f"{x / 1e9:.1f}B"
    if x >= 1_000_000:
        return f"{x / 1e6:.1f}M"
    return f"{x:,}"


def fmt_bytes(b: int) -> str:
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if b < 1024:
            return f"{b:.1f}{unit}"
        b /= 1024
    return f"{b:.1f}PB"


def print_breakdown(b: Breakdown, config: dict) -> None:
    print(f"\n{b.name}")
    print("-" * 70)
    print(f"  architecture    : {b.verdict}")
    print(f"  total params    : {fmt_billions(b.total_params)}")
    print(f"  active params   : {fmt_billions(b.active_params)}")
    print(f"  embedding       : {fmt_billions(b.embedding_params)}")
    print(f"  attn / layer    : {fmt_billions(b.attn_params_per_layer)}")
    print(f"  mlp  / layer    : {fmt_billions(b.mlp_params_per_layer)}  "
          f"(ratio ff/h = {b.mlp_ratio:.2f})")
    print(f"  context length  : {config['max_position_embeddings']:,}")
    print(f"  KV cache BF16   : {fmt_bytes(b.kv_cache_bytes_bf16)}  (per sequence at max context)")


def main() -> None:
    print("=" * 70)
    print("OPEN MODEL ARCHITECTURE WALKTHROUGH")
    print("=" * 70)
    for name, config in CONFIGS.items():
        b = analyze(name, config)
        print_breakdown(b, config)
    print()
    print("=" * 70)
    print("HEADLINE RATIOS")
    print("=" * 70)
    for name, config in CONFIGS.items():
        b = analyze(name, config)
        ratio = b.active_params / b.total_params if b.total_params else 1.0
        print(
            f"  {name:18s}  "
            f"total={fmt_billions(b.total_params):>8s}  "
            f"active={fmt_billions(b.active_params):>8s}  "
            f"active/total={ratio:.2%}  "
            f"attn={b.attention_scheme}"
        )


if __name__ == "__main__":
    main()
