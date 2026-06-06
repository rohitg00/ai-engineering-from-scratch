"""Whisper prompt format + chunking + budget math, built from stdlib.

Shows the decoder prompt you would pass, the chunk schedule for a long
clip, and the LoRA parameter count delta for a Large-v3-turbo-shaped model.

Run: python3 code/main.py
"""

import math


# Whisper special tokens (subset; real vocab has ~50-ish special tokens)
SPECIAL = {
    "SOT":            "<|startoftranscript|>",
    "EOT":            "<|endoftext|>",
    "TRANSCRIBE":     "<|transcribe|>",
    "TRANSLATE":      "<|translate|>",
    "NO_TIMESTAMPS":  "<|notimestamps|>",
    "NO_SPEECH":      "<|nospeech|>",
}

# Whisper supports ~99 languages; here are three for the demo
LANG = {"en": "<|en|>", "fr": "<|fr|>", "ja": "<|ja|>"}


def build_prompt(language, task="transcribe", timestamps=False):
    toks = [SPECIAL["SOT"], LANG[language]]
    toks.append(SPECIAL["TRANSCRIBE"] if task == "transcribe" else SPECIAL["TRANSLATE"])
    if not timestamps:
        toks.append(SPECIAL["NO_TIMESTAMPS"])
    return toks


def chunk_schedule(total_seconds, chunk_s=30.0, stride_s=5.0):
    if total_seconds <= chunk_s:
        return [(0.0, total_seconds)]
    out = []
    start = 0.0
    step = chunk_s - stride_s
    while start < total_seconds:
        end = min(total_seconds, start + chunk_s)
        out.append((round(start, 2), round(end, 2)))
        if end == total_seconds:
            break
        start += step
    return out


def encoder_frames(seconds, sr=16000, hop=160):
    samples = int(seconds * sr)
    return 1 + (samples - 400) // hop


def transformer_params(n_layers, d_model, d_ff, n_heads, vocab):
    # per-layer: 4 * d_model^2 (q,k,v,o) + 2 * d_model * d_ff + layer norms
    per_block = 4 * d_model * d_model + 2 * d_model * d_ff + 4 * d_model
    enc = n_layers * per_block
    dec = n_layers * (per_block + 4 * d_model * d_model + 4 * d_model)  # +cross-attn
    embed = vocab * d_model + 3000 * d_model  # token embed + pos embed (audio side 3000)
    return enc, dec, embed


def lora_params(n_layers, d_model, rank=16, modules=("q_proj", "v_proj")):
    per_module = 2 * d_model * rank
    per_block = len(modules) * per_module
    return n_layers * 2 * per_block  # encoder + decoder


def main():
    print("=== Step 1: build a Whisper decoder prompt ===")
    p_en = build_prompt("en", task="transcribe", timestamps=False)
    p_fr = build_prompt("fr", task="translate", timestamps=False)
    p_ja = build_prompt("ja", task="transcribe", timestamps=True)
    print(f"  EN transcribe, no ts: {' '.join(p_en)}")
    print(f"  FR->EN translate:    {' '.join(p_fr)}")
    print(f"  JA with timestamps:  {' '.join(p_ja)}")

    print()
    print("=== Step 2: encoder frame budget ===")
    for secs in [1.0, 10.0, 30.0]:
        n = encoder_frames(secs)
        print(f"  {secs:4.1f}s @16 kHz, 10 ms hop -> {n} frames")
    print("  Whisper zero-pads all inputs to 30 s -> 3000 frames after stride-2 conv -> 1500 encoder tokens")

    print()
    print("=== Step 3: chunk schedule for a 10-min clip ===")
    schedule = chunk_schedule(600.0, chunk_s=30.0, stride_s=5.0)
    print(f"  chunks (30 s window, 5 s stride): {len(schedule)}")
    for start, end in schedule[:6]:
        print(f"    {start:6.1f} s -> {end:6.1f} s")
    print(f"    ... ({len(schedule) - 6} more)")

    print()
    print("=== Step 4: param counts for Large-v3-turbo vs Large-v3 ===")
    configs = [
        ("Tiny",        4,   384,  1536,  6,  51865),
        ("Base",        6,   512,  2048,  8,  51865),
        ("Small",      12,   768,  3072, 12,  51865),
        ("Medium",     24,  1024,  4096, 16,  51865),
        ("Large-v3",   32,  1280,  5120, 20,  51865),
        ("Turbo",       4,  1280,  5120, 20,  51865),  # 4-layer decoder
    ]
    print("  variant     enc     dec     embed   total  (approx, M params)")
    for name, layers, d, d_ff, heads, vocab in configs:
        enc, dec, embed = transformer_params(layers, d, d_ff, heads, vocab)
        if name == "Turbo":
            enc_big, _, embed_big = transformer_params(32, d, d_ff, heads, vocab)
            dec = enc  # 4 decoder layers match 4-layer mini
            enc = enc_big
            embed = embed_big
        total = enc + dec + embed
        print(f"  {name:<10}  {enc/1e6:6.1f}  {dec/1e6:6.1f}  {embed/1e6:6.1f}  {total/1e6:7.1f}")

    print()
    print("=== Step 5: LoRA-r=16 on q_proj,v_proj reduces trainable params 100x+ ===")
    for name, layers, d, *_ in configs[3:6]:
        lp = lora_params(layers, d, rank=16)
        print(f"  {name:<10}  LoRA-trainable: {lp/1e6:.3f} M")

    print()
    print("=== Step 6: 2026 inference recipes ===")
    recipes = [
        ("offline English, best WER",    "large-v3-turbo via whisperx + Silero VAD"),
        ("long-form + word timestamps",  "whisperx (forced-align via wav2vec 2.0)"),
        ("streaming (2 s latency)",      "whisper-streaming or Parakeet-TDT"),
        ("mobile / edge",                "whisper-tiny int8 or moonshine"),
        ("low-resource language",        "LoRA fine-tune on 2-20 h domain audio"),
    ]
    for s, r in recipes:
        print(f"  {s:<30} -> {r}")


if __name__ == "__main__":
    main()
