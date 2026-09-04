"""Token and positional embeddings.

Builds three modules:

- TokenEmbedding: vocab_size x d_model lookup
- LearnedPositionalEmbedding: max_context_length x d_model lookup
- SinusoidalPositionalEmbedding: parameter-free sin/cos table

Composes them via EmbeddingComposer for the transformer input.

Run: python3 code/main.py
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import torch
import torch.nn as nn


DEFAULT_INIT_STD = 0.02


def _init_normal(weight: torch.Tensor, std: float = DEFAULT_INIT_STD) -> None:
    """Init a parameter tensor in place from a small Gaussian."""
    with torch.no_grad():
        weight.normal_(mean=0.0, std=std)


class TokenEmbedding(nn.Module):
    """Vocabulary-id to vector lookup."""

    def __init__(self, vocab_size: int, d_model: int, init_std: float = DEFAULT_INIT_STD) -> None:
        super().__init__()
        if vocab_size < 1:
            raise ValueError(f"vocab_size must be >= 1, got {vocab_size}")
        if d_model < 1:
            raise ValueError(f"d_model must be >= 1, got {d_model}")
        self.vocab_size = vocab_size
        self.d_model = d_model
        self.embedding = nn.Embedding(vocab_size, d_model)
        _init_normal(self.embedding.weight, std=init_std)

    def forward(self, ids: torch.Tensor) -> torch.Tensor:
        if ids.dtype != torch.long:
            raise TypeError(f"ids must be long tensor, got {ids.dtype}")
        if ids.dim() != 2:
            raise ValueError(f"ids must be (B, T), got shape {tuple(ids.shape)}")
        return self.embedding(ids)


class LearnedPositionalEmbedding(nn.Module):
    """Position-id to vector lookup with learned parameters."""

    def __init__(
        self,
        max_context_length: int,
        d_model: int,
        init_std: float = DEFAULT_INIT_STD,
    ) -> None:
        super().__init__()
        if max_context_length < 1:
            raise ValueError(f"max_context_length must be >= 1, got {max_context_length}")
        if d_model < 1:
            raise ValueError(f"d_model must be >= 1, got {d_model}")
        self.max_context_length = max_context_length
        self.d_model = d_model
        self.embedding = nn.Embedding(max_context_length, d_model)
        _init_normal(self.embedding.weight, std=init_std)

    def forward(self, seq_len: int) -> torch.Tensor:
        if seq_len < 1:
            raise ValueError(f"seq_len must be >= 1, got {seq_len}")
        if seq_len > self.max_context_length:
            raise ValueError(
                f"seq_len {seq_len} exceeds max_context_length {self.max_context_length}"
            )
        positions = torch.arange(seq_len, device=self.embedding.weight.device)
        return self.embedding(positions)


class SinusoidalPositionalEmbedding(nn.Module):
    """Parameter-free position-to-vector mapping.

    pe[p, 2k]     = sin(p / 10000^(2k/d_model))
    pe[p, 2k+1]   = cos(p / 10000^(2k/d_model))
    """

    def __init__(self, max_context_length: int, d_model: int, base: float = 10000.0) -> None:
        super().__init__()
        if max_context_length < 1:
            raise ValueError(f"max_context_length must be >= 1, got {max_context_length}")
        if d_model < 1:
            raise ValueError(f"d_model must be >= 1, got {d_model}")
        if d_model % 2 != 0:
            raise ValueError(f"d_model must be even for sinusoidal, got {d_model}")
        self.max_context_length = max_context_length
        self.d_model = d_model
        self.base = base
        pe = self._build_table(max_context_length, d_model, base)
        self.register_buffer("pe", pe, persistent=False)

    @staticmethod
    def _build_table(max_context_length: int, d_model: int, base: float) -> torch.Tensor:
        pos = torch.arange(max_context_length, dtype=torch.float32).unsqueeze(1)
        i = torch.arange(d_model // 2, dtype=torch.float32)
        denom = base ** (2 * i / d_model)
        angle = pos / denom
        pe = torch.zeros(max_context_length, d_model, dtype=torch.float32)
        pe[:, 0::2] = torch.sin(angle)
        pe[:, 1::2] = torch.cos(angle)
        return pe

    def forward(self, seq_len: int) -> torch.Tensor:
        if seq_len < 1:
            raise ValueError(f"seq_len must be >= 1, got {seq_len}")
        if seq_len > self.max_context_length:
            raise ValueError(
                f"seq_len {seq_len} exceeds max_context_length {self.max_context_length}"
            )
        return self.pe[:seq_len]


class EmbeddingComposer(nn.Module):
    """Sums a token embedding with a positional embedding.

    The positional embedding may be learned or sinusoidal.
    """

    def __init__(
        self,
        token_embedding: TokenEmbedding,
        positional_embedding: nn.Module,
    ) -> None:
        super().__init__()
        if not isinstance(token_embedding, TokenEmbedding):
            raise TypeError("token_embedding must be a TokenEmbedding")
        if not isinstance(
            positional_embedding,
            (LearnedPositionalEmbedding, SinusoidalPositionalEmbedding),
        ):
            raise TypeError(
                "positional_embedding must be Learned or Sinusoidal Positional Embedding"
            )
        if token_embedding.d_model != getattr(positional_embedding, "d_model", None):
            raise ValueError("token and positional embeddings must share d_model")
        self.token_embedding = token_embedding
        self.positional_embedding = positional_embedding

    @property
    def d_model(self) -> int:
        return self.token_embedding.d_model

    def forward(self, ids: torch.Tensor) -> torch.Tensor:
        if ids.dim() != 2:
            raise ValueError(f"ids must be (B, T), got shape {tuple(ids.shape)}")
        seq_len = ids.shape[1]
        tok = self.token_embedding(ids)
        pos = self.positional_embedding(seq_len)
        return tok + pos.unsqueeze(0)


def count_parameters(module: nn.Module) -> int:
    return sum(p.numel() for p in module.parameters() if p.requires_grad)


def neighbour_cosine_curve(table: torch.Tensor, max_offset: int = 8) -> list[float]:
    """Average cosine similarity between row p and row p+k for k in 1..max_offset.

    Returns a list of length max_offset.
    """
    if table.dim() != 2:
        raise ValueError("table must be (L, D)")
    if max_offset < 1:
        raise ValueError(f"max_offset must be >= 1, got {max_offset}")
    if max_offset >= table.shape[0]:
        raise ValueError(
            f"max_offset {max_offset} must be < number of rows {table.shape[0]}"
        )
    rows = table.detach().to(torch.float32)
    norms = rows.norm(dim=1, keepdim=True).clamp(min=1e-8)
    unit = rows / norms
    result: list[float] = []
    for k in range(1, max_offset + 1):
        a = unit[:-k]
        b = unit[k:]
        dot = (a * b).sum(dim=1).mean().item()
        result.append(dot)
    return result


@dataclass
class DemoConfig:
    vocab_size: int = 320
    d_model: int = 64
    max_context_length: int = 128
    batch_size: int = 4
    seq_len: int = 32
    seed: int = 11


def _print_section(title: str) -> None:
    bar = "-" * len(title)
    print(f"\n{title}\n{bar}")


def main() -> int:
    cfg = DemoConfig()
    torch.manual_seed(cfg.seed)

    token_emb = TokenEmbedding(cfg.vocab_size, cfg.d_model)
    learned_pos = LearnedPositionalEmbedding(cfg.max_context_length, cfg.d_model)
    sinusoidal_pos = SinusoidalPositionalEmbedding(cfg.max_context_length, cfg.d_model)

    learned_composer = EmbeddingComposer(token_emb, learned_pos)
    sinusoidal_composer = EmbeddingComposer(token_emb, sinusoidal_pos)

    ids = torch.randint(0, cfg.vocab_size, (cfg.batch_size, cfg.seq_len), dtype=torch.long)

    _print_section("Shapes")
    out_learned = learned_composer(ids)
    out_sinusoidal = sinusoidal_composer(ids)
    print(f"token_emb output  : {tuple(token_emb(ids).shape)}")
    print(f"learned composer  : {tuple(out_learned.shape)}")
    print(f"sinusoidal cmp.   : {tuple(out_sinusoidal.shape)}")
    assert out_learned.shape == (cfg.batch_size, cfg.seq_len, cfg.d_model)
    assert out_sinusoidal.shape == (cfg.batch_size, cfg.seq_len, cfg.d_model)

    _print_section("Parameter counts")
    token_params = count_parameters(token_emb)
    learned_params = count_parameters(learned_pos)
    sinusoidal_params = count_parameters(sinusoidal_pos)
    print(f"token embedding         : {token_params:>7}")
    print(f"learned positional      : {learned_params:>7}")
    print(f"sinusoidal positional   : {sinusoidal_params:>7}  (parameter-free)")
    assert sinusoidal_params == 0

    _print_section("Neighbour cosine similarity")
    learned_curve = neighbour_cosine_curve(learned_pos.embedding.weight, max_offset=6)
    sinusoidal_curve = neighbour_cosine_curve(sinusoidal_pos.pe, max_offset=6)
    print("offset k | learned cos | sinusoidal cos")
    for k, (a, b) in enumerate(zip(learned_curve, sinusoidal_curve), start=1):
        print(f"   {k:>4}  |   {a:>+7.4f}  |   {b:>+7.4f}")

    _print_section("Sinusoidal property: smooth decay")
    monotone_count = sum(
        sinusoidal_curve[i] >= sinusoidal_curve[i + 1] - 1e-3
        for i in range(len(sinusoidal_curve) - 1)
    )
    print(
        f"sinusoidal curve monotone steps: {monotone_count}/{len(sinusoidal_curve) - 1}"
    )

    _print_section("Length extrapolation")
    short = cfg.max_context_length // 2
    long = cfg.max_context_length
    print(f"sinusoidal at len {short:>3} : ok")
    _ = sinusoidal_pos(short)
    print(f"sinusoidal at len {long:>3} : ok")
    _ = sinusoidal_pos(long)
    print("learned bounded by max_context_length: must error past max")
    try:
        _ = learned_pos(long + 1)
    except ValueError as e:
        print(f"  caught: {e}")

    print("\nDemo OK.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
