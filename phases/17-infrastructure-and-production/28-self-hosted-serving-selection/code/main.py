"""Self-hosted LLM engine decision-tree walker — 標準ライブラリのみの Python。

hardware、scale、workload を受け取り、理由つきで engine を選びます。
"""

from __future__ import annotations


def pick_engine(hardware: str, scale: str, workload: str) -> dict:
    reasons = []
    engine = None

    if hardware == "CPU":
        engine = "llama.cpp"
        reasons.append("hardware が CPU — competitive なのは llama.cpp だけ")
        if scale == "single_user":
            reasons.append("single-user dev → Ollama は llama.cpp を one-command UX で wrap する")
            engine = "Ollama (llama.cpp under the hood)"
    elif hardware == "Apple Silicon":
        engine = "Ollama" if scale == "single_user" else "llama.cpp"
        reasons.append("Apple Silicon → llama.cpp 経由の Metal (Ollama が wrap)")
    elif hardware == "AMD":
        engine = "vLLM"
        reasons.append("AMD → vLLM ROCm support。TRT-LLM は NVIDIA-only")
        if "agentic" in workload.lower() or "prefix" in workload.lower():
            engine = "SGLang"
            reasons.append("agentic / prefix-heavy → SGLang RadixAttention")
    elif hardware == "NVIDIA Hopper":
        if "agentic" in workload.lower() or "prefix" in workload.lower():
            engine = "SGLang"
            reasons.append("Hopper + agentic/prefix → SGLang が specialist")
        elif scale == "single_user":
            engine = "Ollama"
            reasons.append("Hopper の single-user は dev scenario → Ollama で十分")
        else:
            engine = "vLLM"
            reasons.append("Hopper production → vLLM が broad default")
    elif hardware == "NVIDIA Blackwell":
        engine = "TRT-LLM"
        reasons.append("Blackwell + throughput priority → B200/GB200 では TRT-LLM が先行")
        if scale in ("small_team", "production") and "agentic" not in workload.lower():
            reasons.append("vLLM Blackwell SM120 は僅差の second (v0.15.1 Feb 2026)")

    if scale == "enterprise":
        reasons.append("10k+ users → production-stack (Phase 17 · 18)"
                      " + disaggregated (Phase 17 · 17) + cache-aware router (Phase 17 · 11) と stack")

    reasons.append("TGI は 2025 年 12 月 11 日から maintenance mode — new projects では TGI 以外を default にする")

    return {
        "hardware": hardware,
        "scale": scale,
        "workload": workload,
        "engine": engine,
        "reasons": reasons,
    }


SCENARIOS = [
    ("CPU",              "single_user",   "chat"),
    ("Apple Silicon",    "single_user",   "coding assistant"),
    ("NVIDIA Hopper",    "production",    "general chat"),
    ("NVIDIA Hopper",    "production",    "agentic multi-turn"),
    ("NVIDIA Blackwell", "enterprise",    "MoE frontier serving"),
    ("AMD",              "production",    "RAG with heavy prefix reuse"),
    ("NVIDIA Hopper",    "small_team",    "long-context 128K"),
]


def main() -> None:
    print("=" * 80)
    print("SELF-HOSTED ENGINE DECISION TREE — hardware / scale / workload")
    print("=" * 80)
    for hw, sc, wl in SCENARIOS:
        d = pick_engine(hw, sc, wl)
        print(f"\n[{hw}] [{sc}] [{wl}]")
        print(f"  → engine: {d['engine']}")
        for r in d["reasons"]:
            print(f"    · {r}")


if __name__ == "__main__":
    main()
