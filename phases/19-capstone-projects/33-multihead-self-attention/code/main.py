"""causal mask、single QKV projection、weight inspection を持つ multi-head self-attention。

デモは tiny model（attention + token/positional embeddings + LM head）を copy task で学習し、loss curve と head ごとの attention heatmap を表示します。

Run: Python3 code/main.py
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F


class MultiHeadSelfAttention(nn.Module):
    """single QKV linear と causal mask を持つ multi-head self-attention。"""

    def __init__(
        self,
        d_model: int,
        n_heads: int,
        max_context_length: int,
        attn_dropout: float = 0.0,
        out_dropout: float = 0.0,
    ) -> None:
        super().__init__()
        if d_model < 1:
            raise ValueError(f"d_model must be >= 1, got {d_model}")
        if n_heads < 1:
            raise ValueError(f"n_heads must be >= 1, got {n_heads}")
        if d_model % n_heads != 0:
            raise ValueError(
                f"d_model ({d_model}) must be divisible by n_heads ({n_heads})"
            )
        if max_context_length < 1:
            raise ValueError(f"max_context_length must be >= 1, got {max_context_length}")
        self.d_model = d_model
        self.n_heads = n_heads
        self.d_head = d_model // n_heads
        self.max_context_length = max_context_length

        self.qkv_proj = nn.Linear(d_model, 3 * d_model, bias=True)
        self.out_proj = nn.Linear(d_model, d_model, bias=True)
        self.attn_dropout = nn.Dropout(attn_dropout)
        self.out_dropout = nn.Dropout(out_dropout)

        causal_mask = torch.tril(torch.ones(max_context_length, max_context_length))
        self.register_buffer("causal_mask", causal_mask, persistent=False)

    def _split_heads(self, x: torch.Tensor) -> torch.Tensor:
        b, t, _ = x.shape
        return x.view(b, t, self.n_heads, self.d_head).transpose(1, 2)

    def _merge_heads(self, x: torch.Tensor) -> torch.Tensor:
        b, h, t, dh = x.shape
        return x.transpose(1, 2).contiguous().view(b, t, h * dh)

    def forward(
        self,
        x: torch.Tensor,
        return_weights: bool = False,
    ) -> torch.Tensor | tuple[torch.Tensor, torch.Tensor]:
        if x.dim() != 3:
            raise ValueError(f"input must be (B, T, D), got shape {tuple(x.shape)}")
        b, t, d = x.shape
        if d != self.d_model:
            raise ValueError(f"feature dim {d} != d_model {self.d_model}")
        if t > self.max_context_length:
            raise ValueError(f"seq_len {t} exceeds max_context_length {self.max_context_length}")

        qkv = self.qkv_proj(x)
        q, k, v = qkv.chunk(3, dim=-1)

        q = self._split_heads(q)
        k = self._split_heads(k)
        v = self._split_heads(v)

        scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(self.d_head)
        mask_slice = self.causal_mask[:t, :t]
        scores = scores.masked_fill(mask_slice == 0, float("-inf"))

        weights = F.softmax(scores, dim=-1)
        weights = self.attn_dropout(weights)

        context = torch.matmul(weights, v)
        context = self._merge_heads(context)

        out = self.out_proj(context)
        out = self.out_dropout(out)

        if return_weights:
            return out, weights
        return out


class TokenEmbedding(nn.Module):
    """vocab id から vector への lookup（lesson 32 の compact copy）。"""

    def __init__(self, vocab_size: int, d_model: int) -> None:
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        with torch.no_grad():
            self.embedding.weight.normal_(0.0, 0.02)

    def forward(self, ids: torch.Tensor) -> torch.Tensor:
        return self.embedding(ids)


class SinusoidalPositionalEmbedding(nn.Module):
    """parameter-free な sin/cos positional table（lesson 32 の compact copy）。"""

    def __init__(self, max_context_length: int, d_model: int, base: float = 10000.0) -> None:
        super().__init__()
        if max_context_length < 1:
            raise ValueError(f"max_context_length must be >= 1, got {max_context_length}")
        if d_model < 1:
            raise ValueError(f"d_model must be >= 1, got {d_model}")
        if d_model % 2 != 0:
            raise ValueError(f"d_model must be even, got {d_model}")
        self.max_context_length = max_context_length
        pos = torch.arange(max_context_length, dtype=torch.float32).unsqueeze(1)
        i = torch.arange(d_model // 2, dtype=torch.float32)
        denom = base ** (2 * i / d_model)
        angle = pos / denom
        pe = torch.zeros(max_context_length, d_model, dtype=torch.float32)
        pe[:, 0::2] = torch.sin(angle)
        pe[:, 1::2] = torch.cos(angle)
        self.register_buffer("pe", pe, persistent=False)

    def forward(self, seq_len: int) -> torch.Tensor:
        if seq_len < 1:
            raise ValueError(f"seq_len must be >= 1, got {seq_len}")
        if seq_len > self.max_context_length:
            raise ValueError(
                f"seq_len {seq_len} exceeds max_context_length {self.max_context_length}"
            )
        return self.pe[:seq_len]


class TinyAttentionLM(nn.Module):
    """Embedding + attention + LM head。copy task を学習するのに必要な最小構成です。"""

    def __init__(
        self,
        vocab_size: int,
        d_model: int,
        n_heads: int,
        max_context_length: int,
    ) -> None:
        super().__init__()
        self.token_emb = TokenEmbedding(vocab_size, d_model)
        self.pos_emb = SinusoidalPositionalEmbedding(max_context_length, d_model)
        self.attn = MultiHeadSelfAttention(
            d_model=d_model,
            n_heads=n_heads,
            max_context_length=max_context_length,
        )
        self.lm_head = nn.Linear(d_model, vocab_size)

    def forward(
        self,
        ids: torch.Tensor,
        return_weights: bool = False,
    ) -> torch.Tensor | tuple[torch.Tensor, torch.Tensor]:
        b, t = ids.shape
        tok = self.token_emb(ids)
        pos = self.pos_emb(t)
        x = tok + pos.unsqueeze(0)
        if return_weights:
            attn_out, weights = self.attn(x, return_weights=True)
            logits = self.lm_head(attn_out)
            return logits, weights
        attn_out = self.attn(x)
        logits = self.lm_head(attn_out)
        return logits


@dataclass
class DemoConfig:
    vocab_size: int = 64
    d_model: int = 32
    n_heads: int = 4
    seq_len: int = 12
    batch_size: int = 16
    n_epochs: int = 3
    steps_per_epoch: int = 120
    learning_rate: float = 5e-3
    seed: int = 42


def _make_repeat_batch(cfg: DemoConfig, generator: torch.Generator) -> tuple[torch.Tensor, torch.Tensor]:
    """repeat task。各 row で random id を1つ選び、その row 全体に繰り返します。

    model は次 token が前 token と同じであることを学ぶ必要があります。
    1 token 前を見る attention head が1つあれば解けます。
    """
    base = torch.randint(
        0, cfg.vocab_size, (cfg.batch_size, 1), generator=generator, dtype=torch.long
    )
    ids = base.expand(cfg.batch_size, cfg.seq_len + 1).contiguous()
    return ids[:, :-1], ids[:, 1:]


def _train(model: TinyAttentionLM, cfg: DemoConfig) -> list[float]:
    optimizer = torch.optim.Adam(model.parameters(), lr=cfg.learning_rate)
    generator = torch.Generator()
    generator.manual_seed(cfg.seed)
    loss_curve: list[float] = []
    for epoch in range(cfg.n_epochs):
        total = 0.0
        for _ in range(cfg.steps_per_epoch):
            inputs, targets = _make_repeat_batch(cfg, generator)
            logits = model(inputs)
            loss = F.cross_entropy(logits.reshape(-1, cfg.vocab_size), targets.reshape(-1))
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total += loss.item()
        avg = total / cfg.steps_per_epoch
        loss_curve.append(avg)
        print(f"epoch {epoch + 1}/{cfg.n_epochs}  avg loss: {avg:.4f}")
    return loss_curve


def _print_section(title: str) -> None:
    bar = "-" * len(title)
    print(f"\n{title}\n{bar}")


def _heatmap_row(row: torch.Tensor, width: int = 28) -> str:
    glyphs = " .:-=+*#%@"
    cells: list[str] = []
    for v in row.tolist():
        idx = int(min(len(glyphs) - 1, max(0, v * len(glyphs))))
        cells.append(glyphs[idx])
    return "".join(cells[:width])


def main() -> int:
    cfg = DemoConfig()
    torch.manual_seed(cfg.seed)

    _print_section("shape contract")
    attn = MultiHeadSelfAttention(
        d_model=cfg.d_model,
        n_heads=cfg.n_heads,
        max_context_length=cfg.seq_len,
    )
    x = torch.randn(cfg.batch_size, cfg.seq_len, cfg.d_model)
    out = attn(x)
    print(f"input  : {tuple(x.shape)}")
    print(f"output : {tuple(out.shape)}")
    assert out.shape == x.shape

    _print_section("causal mask check")
    out_with_weights, weights = attn(x, return_weights=True)
    upper = torch.triu(torch.ones(cfg.seq_len, cfg.seq_len), diagonal=1).bool()
    upper_mass = weights[0, 0][upper].abs().sum().item()
    print(f"weights shape          : {tuple(weights.shape)}")
    print(f"sum over future cells  : {upper_mass:.6f}")
    assert upper_mass < 1e-5, "未来位置の weight は0である必要があります"
    rows = weights[0, 0].sum(dim=-1)
    print(f"row sums (head 0, batch 0): min={rows.min().item():.4f}, max={rows.max().item():.4f}")

    _print_section("repeat task で tiny model を学習")
    model = TinyAttentionLM(
        vocab_size=cfg.vocab_size,
        d_model=cfg.d_model,
        n_heads=cfg.n_heads,
        max_context_length=cfg.seq_len,
    )
    initial_loss = math.log(cfg.vocab_size)
    print(f"random init の期待 loss ~ log(V) = {initial_loss:.4f}")
    curve = _train(model, cfg)
    assert curve[-1] < curve[0], "training 中に loss が下がる必要があります"

    _print_section("head ごとの attention heatmap")
    model.eval()
    with torch.no_grad():
        sample_gen = torch.Generator()
        sample_gen.manual_seed(cfg.seed + 1)
        base = torch.randint(0, cfg.vocab_size, (1, 1), generator=sample_gen, dtype=torch.long)
        sample_ids = base.expand(1, cfg.seq_len).contiguous()
        _, sample_weights = model(sample_ids, return_weights=True)
    head_id = 0
    print(f"head {head_id}, query rows は上から下、key cols は左から右")
    for t in range(cfg.seq_len):
        row = sample_weights[0, head_id, t]
        print(f"  q={t:>2}: |{_heatmap_row(row, width=cfg.seq_len)}|")

    print("\nデモ OK。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
