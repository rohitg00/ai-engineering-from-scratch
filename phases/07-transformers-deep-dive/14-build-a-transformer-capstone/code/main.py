"""Capstone: decoder-only transformer from scratch.

Uses PyTorch. If torch is not installed, prints a friendly message and
degrades to a parameter-count estimator so the script still runs cleanly.

Default: 4 layers, 4 heads, d_model=128, seq_len=128, 500 steps on a
tiny built-in Shakespeare excerpt. Finishes in ~2 minutes on a laptop.
"""

import math
import os
import random
import sys


TINY_SHAKESPEARE = """First Citizen:
Before we proceed any further, hear me speak.

All:
Speak, speak.

First Citizen:
You are all resolved rather to die than to famish?

All:
Resolved. resolved.

First Citizen:
First, you know Caius Marcius is chief enemy to the people.

All:
We know't, we know't.

First Citizen:
Let us kill him, and we'll have corn at our own price.
Is't a verdict?

All:
No more talking on't; let it be done: away, away!

Second Citizen:
One word, good citizens.

First Citizen:
We are accounted poor citizens, the patricians good.
What authority surfeits on would relieve us: if they
would yield us but the superfluity, while it were
wholesome, we might guess they relieved us humanely;
but they think we are too dear: the leanness that
afflicts us, the object of our misery, is as an
inventory to particularise their abundance; our
sufferance is a gain to them Let us revenge this with
our pikes, ere we become rakes: for the gods know I
speak this in hunger for bread, not in thirst for revenge.
"""


def param_count(vocab_size, d_model, n_layers, n_heads, ffn_expansion=2.67, block_size=128):
    # token emb + pos emb
    emb = vocab_size * d_model + block_size * d_model
    # per-layer: 4*d*d (attn) + 3*d*(exp*d) (SwiGLU) + 2*d (RMSNorm)
    per_layer = 4 * d_model * d_model + 3 * d_model * int(d_model * ffn_expansion) + 2 * d_model
    # final norm + lm head tied to token emb (so 0 extra if tied)
    final = 2 * d_model
    return emb + per_layer * n_layers + final


def run_param_preview():
    print("=== parameter counts for capstone configs ===")
    print(f"{'name':<16}  {'V':>5}  {'L':>3}  {'H':>3}  {'d':>5}  {'~params':>10}")
    configs = [
        ("nano",    65,   4,  4,  128),
        ("mini",    65,   6,  6,  192),
        ("small",   65,  12, 12,  384),
        ("base",  50257, 12, 12,  768),
    ]
    for name, V, L, H, d in configs:
        p = param_count(V, d, L, H)
        print(f"  {name:<14}  {V:>5}  {L:>3}  {H:>3}  {d:>5}  {p:>10}")


def try_train():
    try:
        import torch
        import torch.nn as nn
        import torch.nn.functional as F
    except ImportError:
        print("torch not installed. install with: pip install torch")
        print("once installed, rerunning will train a 4-layer char-level GPT")
        print("on the embedded Shakespeare excerpt and sample from it.")
        return

    torch.manual_seed(42)
    random.seed(42)

    # --- data ---
    data_path = os.path.join(os.path.dirname(__file__), "tinyshakespeare.txt")
    if os.path.exists(data_path):
        with open(data_path) as f:
            text = f.read()
    else:
        text = TINY_SHAKESPEARE

    chars = sorted(set(text))
    vocab_size = len(chars)
    stoi = {c: i for i, c in enumerate(chars)}
    itos = {i: c for c, i in stoi.items()}
    data = torch.tensor([stoi[c] for c in text], dtype=torch.long)
    n = int(0.9 * len(data))
    train_data = data[:n]
    val_data = data[n:]

    # --- config ---
    block_size = 64
    d_model = 64
    n_heads = 4
    n_layers = 3
    ffn_expansion = 2.67
    batch_size = 16
    max_steps = 500
    eval_interval = 100
    lr = 3e-4
    device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")

    # --- model ---
    class RMSNorm(nn.Module):
        def __init__(self, d, eps=1e-6):
            super().__init__()
            self.weight = nn.Parameter(torch.ones(d))
            self.eps = eps

        def forward(self, x):
            rms = x.pow(2).mean(-1, keepdim=True).add(self.eps).sqrt()
            return self.weight * (x / rms)

    class CausalSelfAttention(nn.Module):
        def __init__(self, d, h, block_size):
            super().__init__()
            assert d % h == 0
            self.h = h
            self.d_head = d // h
            self.qkv = nn.Linear(d, 3 * d, bias=False)
            self.out = nn.Linear(d, d, bias=False)
            self.register_buffer("mask", torch.tril(torch.ones(block_size, block_size)).view(1, 1, block_size, block_size))

        def forward(self, x):
            B, N, D = x.shape
            q, k, v = self.qkv(x).split(D, dim=2)
            q = q.view(B, N, self.h, self.d_head).transpose(1, 2)
            k = k.view(B, N, self.h, self.d_head).transpose(1, 2)
            v = v.view(B, N, self.h, self.d_head).transpose(1, 2)
            att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(self.d_head))
            att = att.masked_fill(self.mask[:, :, :N, :N] == 0, float("-inf"))
            att = F.softmax(att, dim=-1)
            y = (att @ v).transpose(1, 2).contiguous().view(B, N, D)
            return self.out(y)

    class SwiGLUFFN(nn.Module):
        def __init__(self, d, expansion):
            super().__init__()
            h = int(d * expansion)
            self.w1 = nn.Linear(d, h, bias=False)
            self.w2 = nn.Linear(h, d, bias=False)
            self.w3 = nn.Linear(d, h, bias=False)

        def forward(self, x):
            return self.w2(F.silu(self.w1(x)) * self.w3(x))

    class Block(nn.Module):
        def __init__(self, d, h, block_size, expansion):
            super().__init__()
            self.n1 = RMSNorm(d)
            self.attn = CausalSelfAttention(d, h, block_size)
            self.n2 = RMSNorm(d)
            self.ffn = SwiGLUFFN(d, expansion)

        def forward(self, x):
            x = x + self.attn(self.n1(x))
            x = x + self.ffn(self.n2(x))
            return x

    class GPT(nn.Module):
        def __init__(self, vocab_size, d, h, n_layers, block_size, expansion):
            super().__init__()
            self.tok_emb = nn.Embedding(vocab_size, d)
            self.pos_emb = nn.Embedding(block_size, d)
            self.blocks = nn.ModuleList([Block(d, h, block_size, expansion) for _ in range(n_layers)])
            self.norm_f = RMSNorm(d)
            self.lm_head = nn.Linear(d, vocab_size, bias=False)
            self.lm_head.weight = self.tok_emb.weight  # tied
            self.block_size = block_size

        def forward(self, idx, targets=None):
            B, N = idx.shape
            tok = self.tok_emb(idx)
            pos = self.pos_emb(torch.arange(N, device=idx.device))
            x = tok + pos
            for b in self.blocks:
                x = b(x)
            x = self.norm_f(x)
            logits = self.lm_head(x)
            loss = None
            if targets is not None:
                loss = F.cross_entropy(logits.view(-1, logits.size(-1)), targets.view(-1))
            return logits, loss

        @torch.no_grad()
        def generate(self, idx, max_new_tokens, temperature=1.0, top_k=None):
            for _ in range(max_new_tokens):
                idx_cond = idx[:, -self.block_size:]
                logits, _ = self(idx_cond)
                logits = logits[:, -1, :] / temperature
                if top_k is not None:
                    v, _ = torch.topk(logits, top_k)
                    logits[logits < v[:, [-1]]] = float("-inf")
                probs = F.softmax(logits, dim=-1)
                next_id = torch.multinomial(probs, num_samples=1)
                idx = torch.cat((idx, next_id), dim=1)
            return idx

    def get_batch(split):
        src = train_data if split == "train" else val_data
        ix = torch.randint(len(src) - block_size, (batch_size,))
        x = torch.stack([src[i:i + block_size] for i in ix]).to(device)
        y = torch.stack([src[i + 1:i + 1 + block_size] for i in ix]).to(device)
        return x, y

    model = GPT(vocab_size, d_model, n_heads, n_layers, block_size, ffn_expansion).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"=== capstone transformer ===")
    print(f"device:        {device}")
    print(f"vocab_size:    {vocab_size}")
    print(f"block_size:    {block_size}")
    print(f"d_model:       {d_model}")
    print(f"n_heads:       {n_heads}")
    print(f"n_layers:      {n_layers}")
    print(f"parameters:    {n_params}")
    print()

    opt = torch.optim.AdamW(model.parameters(), lr=lr, betas=(0.9, 0.95), weight_decay=0.1)

    print(f"training for {max_steps} steps...")
    for step in range(max_steps + 1):
        if step % eval_interval == 0:
            model.eval()
            with torch.no_grad():
                x, y = get_batch("train")
                _, train_loss = model(x, y)
                x, y = get_batch("val")
                _, val_loss = model(x, y)
            model.train()
            print(f"  step {step:>4}  train={train_loss.item():.3f}  val={val_loss.item():.3f}")
        if step == max_steps:
            break
        x, y = get_batch("train")
        _, loss = model(x, y)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()

    print()
    print("=== sample ===")
    prompt = torch.tensor([[stoi["F"], stoi["i"], stoi["r"], stoi["s"], stoi["t"]]], dtype=torch.long, device=device)
    out = model.generate(prompt, max_new_tokens=200, temperature=0.9, top_k=10)
    sampled = "".join(itos[int(i)] for i in out[0].tolist())
    print(sampled)


def main():
    run_param_preview()
    print()
    try_train()


if __name__ == "__main__":
    main()
