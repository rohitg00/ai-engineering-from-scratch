"""Transformer block from scratch: LayerNorm, multi head causal attention, residual, MLP, residual.

Implements both pre-LN and post-LN configurations behind a single flag. The demo
builds a six layer stack of each, sends a single forward and backward pass through,
and prints the gradient norm at the input embedding for each variant. The pre-LN
stack carries an order of magnitude larger gradient at the embedding than the
post-LN stack at identical learning rate, which is the mechanism that lets
modern decoder LLMs train without a warmup schedule.

Run: python3 code/main.py
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class BlockConfig:
    """Hyperparameters shared across attention, MLP, and the wrapping block."""

    d_model: int = 768
    num_heads: int = 12
    context_length: int = 1024
    mlp_expansion: int = 4
    attn_dropout: float = 0.1
    residual_dropout: float = 0.1
    use_bias: bool = True
    pre_ln: bool = True


class LayerNorm(nn.Module):
    """Layer normalization with learnable scale and shift.

    Normalizes over the last dimension (the embedding axis) for every token
    independently. Equivalent to nn.LayerNorm(d_model) but spelled out so the
    eps placement and the parameter shapes are visible.
    """

    def __init__(self, d_model: int, eps: float = 1e-5) -> None:
        super().__init__()
        self.eps = eps
        self.scale = nn.Parameter(torch.ones(d_model))
        self.shift = nn.Parameter(torch.zeros(d_model))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        mean = x.mean(dim=-1, keepdim=True)
        var = x.var(dim=-1, keepdim=True, unbiased=False)
        return self.scale * (x - mean) / torch.sqrt(var + self.eps) + self.shift


class MultiHeadAttention(nn.Module):
    """Multi head causal self attention with a fused QKV projection.

    Fused QKV: one linear of width 3 * d_model instead of three linears, one
    kernel launch, one matmul. The causal mask is registered as a buffer so it
    is allocated once at construction and sliced per forward.
    """

    def __init__(self, cfg: BlockConfig) -> None:
        super().__init__()
        if cfg.d_model % cfg.num_heads != 0:
            raise ValueError(
                f"d_model ({cfg.d_model}) must be divisible by num_heads ({cfg.num_heads})"
            )
        self.d_model = cfg.d_model
        self.num_heads = cfg.num_heads
        self.head_dim = cfg.d_model // cfg.num_heads
        self.context_length = cfg.context_length

        self.qkv = nn.Linear(cfg.d_model, 3 * cfg.d_model, bias=cfg.use_bias)
        self.out_proj = nn.Linear(cfg.d_model, cfg.d_model, bias=cfg.use_bias)
        self.attn_dropout = nn.Dropout(cfg.attn_dropout)
        self.resid_dropout = nn.Dropout(cfg.residual_dropout)

        mask = torch.triu(
            torch.ones(cfg.context_length, cfg.context_length, dtype=torch.bool),
            diagonal=1,
        )
        self.register_buffer("causal_mask", mask, persistent=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch, seq, dim = x.shape
        if seq > self.context_length:
            raise ValueError(
                f"sequence length {seq} exceeds context length {self.context_length}"
            )

        qkv = self.qkv(x)
        q, k, v = qkv.split(self.d_model, dim=-1)

        q = q.view(batch, seq, self.num_heads, self.head_dim).transpose(1, 2)
        k = k.view(batch, seq, self.num_heads, self.head_dim).transpose(1, 2)
        v = v.view(batch, seq, self.num_heads, self.head_dim).transpose(1, 2)

        scores = q @ k.transpose(-2, -1) / math.sqrt(self.head_dim)
        mask = self.causal_mask[:seq, :seq]
        scores = scores.masked_fill(mask, float("-inf"))
        attn = F.softmax(scores, dim=-1)
        attn = self.attn_dropout(attn)

        out = attn @ v
        out = out.transpose(1, 2).contiguous().view(batch, seq, dim)
        out = self.out_proj(out)
        out = self.resid_dropout(out)
        return out


class FeedForward(nn.Module):
    """Position wise MLP. No token mixing happens here; all of that lives in attention."""

    def __init__(self, cfg: BlockConfig) -> None:
        super().__init__()
        hidden = cfg.mlp_expansion * cfg.d_model
        self.fc1 = nn.Linear(cfg.d_model, hidden, bias=cfg.use_bias)
        self.act = nn.GELU(approximate="tanh")
        self.fc2 = nn.Linear(hidden, cfg.d_model, bias=cfg.use_bias)
        self.dropout = nn.Dropout(cfg.residual_dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.fc1(x)
        x = self.act(x)
        x = self.fc2(x)
        x = self.dropout(x)
        return x


class TransformerBlock(nn.Module):
    """One transformer block. Toggle pre_ln to switch between configurations.

    Pre-LN: norm inside the residual branch before each sublayer. The residual
    carries an unnormalized tensor through every block; gradients propagate
    cleanly to the embedding layer without a warmup schedule.

    Post-LN: norm after the residual add. Gradient must pass through the norm
    on every block; deep stacks need warmup to avoid divergence.
    """

    def __init__(self, cfg: BlockConfig) -> None:
        super().__init__()
        self.pre_ln = cfg.pre_ln
        self.ln1 = LayerNorm(cfg.d_model)
        self.attn = MultiHeadAttention(cfg)
        self.ln2 = LayerNorm(cfg.d_model)
        self.mlp = FeedForward(cfg)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if self.pre_ln:
            x = x + self.attn(self.ln1(x))
            x = x + self.mlp(self.ln2(x))
        else:
            x = self.ln1(x + self.attn(x))
            x = self.ln2(x + self.mlp(x))
        return x


class BlockStack(nn.Module):
    """A small stack used by the demo. The lesson 35 GPT uses the same pattern with twelve blocks."""

    def __init__(self, cfg: BlockConfig, depth: int) -> None:
        super().__init__()
        self.embed = nn.Embedding(num_embeddings=128, embedding_dim=cfg.d_model)
        self.blocks = nn.ModuleList([TransformerBlock(cfg) for _ in range(depth)])
        self.final_ln = LayerNorm(cfg.d_model)

    def forward(self, tokens: torch.Tensor) -> torch.Tensor:
        x = self.embed(tokens)
        for block in self.blocks:
            x = block(x)
        x = self.final_ln(x)
        return x


def gradient_norm_at_embedding(stack: BlockStack, tokens: torch.Tensor) -> float:
    """Send one forward and one backward through the stack, return the embedding gradient norm.

    The loss is the sum of squares of the final tensor. The magnitude is unitless;
    what matters is the ratio between pre-LN and post-LN at the same depth.
    """
    stack.zero_grad(set_to_none=True)
    out = stack(tokens)
    loss = out.pow(2).sum()
    loss.backward()
    grad = stack.embed.weight.grad
    if grad is None:
        return 0.0
    return float(grad.norm().item())


def _set_eval_mode(stack: BlockStack) -> None:
    """Disable dropout so the comparison between pre-LN and post-LN is deterministic."""
    stack.eval()


def demo() -> None:
    torch.manual_seed(0)
    cfg_pre = BlockConfig(
        d_model=192,
        num_heads=6,
        context_length=64,
        attn_dropout=0.0,
        residual_dropout=0.0,
        pre_ln=True,
    )
    cfg_post = BlockConfig(
        d_model=192,
        num_heads=6,
        context_length=64,
        attn_dropout=0.0,
        residual_dropout=0.0,
        pre_ln=False,
    )

    depth = 6
    pre_stack = BlockStack(cfg_pre, depth=depth)
    post_stack = BlockStack(cfg_post, depth=depth)

    post_stack.load_state_dict(pre_stack.state_dict())
    _set_eval_mode(pre_stack)
    _set_eval_mode(post_stack)

    tokens = torch.randint(0, 128, (2, 32))

    with torch.no_grad():
        pre_out = pre_stack(tokens)
        post_out = post_stack(tokens)

    print("Pre-LN output shape :", tuple(pre_out.shape))
    print("Post-LN output shape:", tuple(post_out.shape))
    assert pre_out.shape == post_out.shape == (2, 32, 192)

    pre_grad = gradient_norm_at_embedding(pre_stack, tokens)
    post_grad = gradient_norm_at_embedding(post_stack, tokens)

    print(f"Pre-LN  embedding grad norm: {pre_grad:.6f}")
    print(f"Post-LN embedding grad norm: {post_grad:.6f}")
    if post_grad > 0:
        ratio = pre_grad / post_grad
        print(f"Pre-LN / Post-LN ratio    : {ratio:.2f}x")

    n_params = sum(p.numel() for p in pre_stack.parameters())
    print(f"Stack parameter count     : {n_params:,}")
    print("Block check passed.")


if __name__ == "__main__":
    demo()
