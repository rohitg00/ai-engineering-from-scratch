# Build a Transformer from Scratch — The Capstone

> Thirteen lessons. One model. No shortcuts.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 01 through 13. Don't skip.
**Time:** ~120 minutes

## The Problem

You've read every paper. You've implemented attention, multi-head splits, positional encodings, encoder and decoder blocks, BERT and GPT losses, MoE, KV cache. Now make them work together on a real task.

The capstone: train a small decoder-only transformer end-to-end on a character-level language modeling task. It reads Shakespeare. It generates new Shakespeare. It is small enough to train on a laptop in under 10 minutes. It is correct enough that swapping in a bigger dataset and longer training gets you a real LM.

This is the "nanoGPT" of the course. It is not original — Karpathy's 2023 nanoGPT tutorial is the reference implementation every student writes at least once. We lift the shape and retool it around what we've covered.

## The Concept

![Transformer-from-scratch block diagram](../assets/capstone.svg)

The architecture, annotated:

```
input tokens (B, N)
   │
   ▼
token embedding + positional embedding  ◀── Lesson 04 (RoPE option)
   │
   ▼
┌──── block × L ────────────────────┐
│  RMSNorm                          │  ◀── Lesson 05
│  MultiHeadAttention (causal)      │  ◀── Lesson 03 + 07 (causal mask)
│  residual                         │
│  RMSNorm                          │
│  SwiGLU FFN                       │  ◀── Lesson 05
│  residual                         │
└────────────────────────────────── ┘
   │
   ▼
final RMSNorm
   │
   ▼
lm_head (tied to token embedding)
   │
   ▼
logits (B, N, V)
   │
   ▼
shift-by-one cross-entropy            ◀── Lesson 07
```

### What we ship

- `GPTConfig` — one place to configure all hyperparameters.
- `MultiHeadAttention` — causal, batched, with optional Flash-style pathway (PyTorch's `scaled_dot_product_attention`).
- `SwiGLUFFN` — modern FFN.
- `Block` — pre-norm, residual-wrapped attention + FFN.
- `GPT` — embeddings, stacked blocks, LM head, generate().
- Training loop with AdamW, cosine LR, gradient clipping.
- Char-level tokenizer on Shakespeare text.

### What we don't ship

- RoPE — implemented conceptually in Lesson 04. Here we use learned positional embeddings for simplicity. The exercises ask you to swap in RoPE.
- KV cache during generation — each generation step recomputes attention over the full prefix. Slower but simpler. The exercises ask you to add a KV cache.
- Flash Attention — PyTorch 2.0+ auto-dispatches if the inputs match; we use `F.scaled_dot_product_attention`.
- MoE — single FFN per block. You saw MoE in Lesson 11.

### Target metrics

On a Mac M2 laptop, a 4-layer, 4-head, d_model=128 GPT trained for 2,000 steps on `tinyshakespeare.txt`:

- Training loss converges from ~4.2 (random) to ~1.5 in about 6 minutes.
- Sampled output looks Shakespeare-shaped: archaic words, line breaks, proper names like "ROMEO:" emerge.
- Val loss (held-out final 10% of text) tracks training loss closely; no overfitting at this size/budget.

## Build It

This lesson uses PyTorch. Install `torch` (CPU build is fine). See `code/main.py`. The script handles:

- Downloading `tinyshakespeare.txt` if missing (or reading a local copy).
- Byte-level char tokenizer.
- Train/val split at 90/10.
- Training loop with bf16 autocast on supported hardware.
- Sampling after training completes.

### Step 1: data

```python
text = open("tinyshakespeare.txt").read()
chars = sorted(set(text))
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for c, i in stoi.items()}
encode = lambda s: [stoi[c] for c in s]
decode = lambda xs: "".join(itos[x] for x in xs)
```

65 unique characters. Tiny vocabulary. Fits a 4-byte vocab_size. No BPE, no tokenizer drama.

### Step 2: model

See `code/main.py`. The block is textbook from Lesson 05 — pre-norm, RMSNorm, SwiGLU, causal MHA. Parameter count for 4/4/128: ~800K.

### Step 3: training loop

Get a random batch of length-256 token windows. Forward. Shift-by-one cross-entropy. Backward. AdamW step. Log. Repeat.

```python
for step in range(max_steps):
    x, y = get_batch("train")
    logits = model(x)
    loss = F.cross_entropy(logits.view(-1, vocab_size), y.view(-1))
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step()
    opt.zero_grad()
```

### Step 4: sample

Given a prompt, repeatedly forward, sample from top-p logits, append, and continue. Stop after 500 tokens.

### Step 5: read the output

After 2,000 steps:

```
ROMEO:
Away and mild will not thy friend, that thou shalt wit:
The chief that well shame and hath been his friends,
...
```

Not Shakespeare. But Shakespeare-shaped. A clear win for ~800K parameters and 6 minutes on a laptop.

## Use It

This capstone is a reference architecture. Three extensions to ship it to something real:

1. **Swap the tokenizer.** Use BPE (e.g. `tiktoken.get_encoding("cl100k_base")`). Vocab size jumps from 65 to ~50,000. Model capacity needs to scale up to compensate.
2. **Train on a bigger corpus.** Use `OpenWebText` or `fineweb-edu` (HuggingFace). 10B tokens on a single A100 takes ~24 hours for a 125M-param GPT.
3. **Add RoPE + KV cache + Flash Attention.** The exercises below walk you through each.

This ends up as a 125M-parameter GPT that generates fluent English. Not a frontier model. But the same code path — just bigger — is what Karpathy, EleutherAI, and the Allen Institute use to train research checkpoints in 2026.

## Ship It

See `outputs/skill-transformer-review.md`. The skill reviews a transformer-from-scratch implementation for correctness across all 13 prior lessons.

## Exercises

1. **Easy.** Run `code/main.py`. Verify your trained model's final-step validation loss is under 2.0. Change `max_steps` from 2,000 to 5,000 — does val loss keep improving?
2. **Medium.** Replace learned positional embeddings with RoPE. Apply the rotation to Q and K inside `MultiHeadAttention`. Train and verify val loss is at least as low.
3. **Medium.** Implement a KV cache in the sampling loop. Generate 500 tokens with and without cache. Wall-clock should improve by 5–20× on a laptop.
4. **Hard.** Add a second head to the model that predicts the next-plus-one token (MTP — Multi-Token Prediction from DeepSeek-V3). Train jointly. Does it help?
5. **Hard.** Replace the single FFN per block with a 4-expert MoE. Router + top-2 routing. See how val loss changes at matched active parameters.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| nanoGPT | "Karpathy's tutorial repo" | Minimal decoder-only transformer training code, ~300 LOC; the canonical reference. |
| tinyshakespeare | "The standard toy corpus" | ~1.1 MB of text; every character-LM tutorial since 2015 uses it. |
| Tied embeddings | "Share input/output matrix" | LM head weight = transpose of token embedding matrix; saves parameters, improves quality. |
| bf16 autocast | "Training precision trick" | Run forward/back in bf16, keep optimizer state in fp32; standard since 2021. |
| Gradient clipping | "Stops spikes" | Cap global grad norm at 1.0; prevents training blowups. |
| Cosine LR schedule | "The 2020+ default" | LR ramps up linearly (warmup) then decays cosine-shaped to 10% of peak. |
| MFU | "Model FLOP Utilization" | Achieved FLOPs / theoretical peak; 40% dense, 30% MoE is strong in 2026. |
| Val loss | "Held-out loss" | Cross-entropy on data the model never saw; overfit detector. |

## Further Reading

- [The Annotated Transformer (Harvard NLP)](https://nlp.seas.harvard.edu/annotated-transformer/) — the classic annotated implementation.
