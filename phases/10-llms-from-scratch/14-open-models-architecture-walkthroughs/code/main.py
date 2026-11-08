"""Architecture calculator for open LLMs.

Given a HuggingFace-style config dict, compute parameter counts by component,
KV cache at max context, MLP ratio, and a verdict on the architecture. Ships
with configs for Llama 3 8B, Mistral 7B, Mixtral 8x7B, DeepSeek V3, Qwen 2.5,
Gemma 2 9B, Spark-X2.5 4B, and GPT-2 Small for direct comparison.

Fields follow the HuggingFace config names where they exist: an explicit
head_dim overrides hidden_size / num_attention_heads, tie_word_embeddings
decides whether the LM head is counted separately, and layer_types plus
sliding_window decide how many layers cache the full context.

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
        "tie_word_embeddings": True,
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
    "gemma2-9b": {
        "hidden_size": 3584, "intermediate_size": 14336,
        "num_hidden_layers": 42, "num_attention_heads": 16,
        "num_key_value_heads": 8, "head_dim": 256, "vocab_size": 256000,
        "max_position_embeddings": 8192,
        "activation": "geglu", "norm": "rmsnorm", "norms_per_layer": 4,
        "position": "rope-sliding", "moe": False,
        "tie_word_embeddings": True,
        "layer_types": ["sliding_attention", "full_attention"] * 21,
        "sliding_window": 4096,
    },
    "spark-x2.5-4b": {
        "hidden_size": 2560, "intermediate_size": 10240,
        "num_hidden_layers": 36, "num_attention_heads": 16,
        "num_key_value_heads": 4, "head_dim": 256, "vocab_size": 131072,
        "max_position_embeddings": 1048576,
        "activation": "geglu", "norm": "rmsnorm",
        "position": "rope-sliding", "moe": False,
        "tie_word_embeddings": True,
        "attn_output_gate": "headwise",
        "layer_types": (["sliding_attention"] * 3 + ["full_attention"]) * 9,
        "sliding_window": 512,
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
    kv_cache_all_full_bytes_bf16: int
    full_attention_layers: int
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


def head_dim(config: dict) -> int:
    return config.get("head_dim", config["hidden_size"] // config["num_attention_heads"])


def attention_params_per_layer(config: dict) -> int:
    h = config["hidden_size"]
    q_heads = config["num_attention_heads"]
    kv_heads = config["num_key_value_heads"]
    hd = head_dim(config)
    if config.get("attention") == "mla":
        lora = config.get("kv_lora_rank", 512)
        return h * h + 2 * (h * lora + lora * q_heads * hd) + h * h
    q_proj = h * (q_heads * hd)
    kv_proj = 2 * h * (kv_heads * hd)
    out_proj = (q_heads * hd) * h
    gate = h * q_heads if config.get("attn_output_gate") == "headwise" else 0
    return q_proj + kv_proj + out_proj + gate


LAYER_TYPES = ("full_attention", "sliding_attention")


def layer_types(config: dict) -> list[str]:
    n_layers = config["num_hidden_layers"]
    kinds = config.get("layer_types")
    if kinds is None:
        return ["full_attention"] * n_layers
    # Same rule HuggingFace applies when it loads a config: one entry per layer.
    if len(kinds) != n_layers:
        raise ValueError(
            f"layer_types has {len(kinds)} entries but num_hidden_layers is {n_layers}"
        )
    unknown = sorted(set(kinds) - set(LAYER_TYPES))
    if unknown:
        raise ValueError(f"unsupported layer_types: {', '.join(unknown)}")
    if "sliding_attention" in kinds and not config.get("sliding_window"):
        raise ValueError("layer_types has sliding_attention layers but no sliding_window")
    return list(kinds)


def cached_tokens_per_layer(config: dict) -> list[int]:
    max_seq = config["max_position_embeddings"]
    window = config.get("sliding_window")
    return [
        min(max_seq, window) if kind == "sliding_attention" and window else max_seq
        for kind in layer_types(config)
    ]


def mlp_params(h: int, ff: int, activation: str) -> int:
    if activation in ("swiglu", "geglu"):
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
    norms = config.get("norms_per_layer", 2)
    if config.get("norm") == "rmsnorm":
        return norms * h
    return norms * 2 * h


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
    lm_head = 0 if config.get("tie_word_embeddings", False) else vocab * h

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
            + lm_head
        )
        active = (
            emb
            + first_dense * dense_block_params
            + n_moe_layers * active_moe_block
            + final_norm
            + lm_head
        )
        mlp = expert_mlp
    else:
        dense_block_params = attn + dense_mlp + norm
        total = emb + n_layers * dense_block_params + final_norm + lm_head
        active = total
        mlp = dense_mlp

    max_seq = config["max_position_embeddings"]
    cached = cached_tokens_per_layer(config)
    full_layers = sum(1 for kind in layer_types(config) if kind == "full_attention")
    if config.get("attention") == "mla":
        per_token_per_layer = config.get("kv_lora_rank", 512)
    else:
        per_token_per_layer = config["num_key_value_heads"] * head_dim(config)
    kv_cache_bytes = 2 * per_token_per_layer * sum(cached) * 2
    kv_cache_all_full = 2 * per_token_per_layer * n_layers * max_seq * 2

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
    if full_layers < n_layers:
        flags.append(f"{full_layers} full / {n_layers - full_layers} sliding")
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
        kv_cache_all_full_bytes_bf16=kv_cache_all_full,
        full_attention_layers=full_layers,
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
    # Decimal units, matching the GB figures in the lesson text.
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if b < 1000:
            return f"{b:.1f}{unit}"
        b /= 1000
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
    if b.kv_cache_bytes_bf16 < b.kv_cache_all_full_bytes_bf16:
        print(f"  if all full     : {fmt_bytes(b.kv_cache_all_full_bytes_bf16)}  "
              f"(sliding window {config['sliding_window']:,} on "
              f"{config['num_hidden_layers'] - b.full_attention_layers} layers)")


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
