"""Tokenized dataset with sliding window for next-token training.

Wraps a tokenizer-encoded id stream in a PyTorch Dataset and DataLoader so a
training loop can pull (B, T) input and (B, T) target batches.

The tokenizer is the small byte-level BPE from lesson 30, inlined here so
this lesson runs without inter-lesson imports.

Run: python3 code/main.py
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Iterable

import torch
from torch.utils.data import DataLoader, Dataset


BYTE_ALPHABET_SIZE = 256
DEFAULT_SPECIALS = ("<|endoftext|>", "<|pad|>")
WORD_SPLIT_RE = re.compile(r"\S+|\s+")


@dataclass
class MiniBPE:
    """Inline byte-level BPE tokenizer (same contract as lesson 30)."""

    vocab: dict[int, bytes] = field(default_factory=dict)
    inv_vocab: dict[bytes, int] = field(default_factory=dict)
    merges: dict[tuple[int, int], int] = field(default_factory=dict)
    special_to_id: dict[str, int] = field(default_factory=dict)
    id_to_special: dict[int, str] = field(default_factory=dict)

    @property
    def vocab_size(self) -> int:
        return len(self.vocab)

    def initialize(self, specials: Iterable[str] = DEFAULT_SPECIALS) -> None:
        self.vocab.clear()
        self.inv_vocab.clear()
        self.merges.clear()
        self.special_to_id.clear()
        self.id_to_special.clear()
        for i in range(BYTE_ALPHABET_SIZE):
            self.vocab[i] = bytes([i])
            self.inv_vocab[bytes([i])] = i
        for s in specials:
            token_id = len(self.vocab)
            self.vocab[token_id] = s.encode("utf-8")
            self.inv_vocab[s.encode("utf-8")] = token_id
            self.special_to_id[s] = token_id
            self.id_to_special[token_id] = s


def _pretokenize(text: str) -> list[str]:
    return WORD_SPLIT_RE.findall(text)


def _count_pairs(units: dict[tuple[int, ...], int]) -> Counter:
    pairs: Counter = Counter()
    for symbols, count in units.items():
        for i in range(len(symbols) - 1):
            pairs[(symbols[i], symbols[i + 1])] += count
    return pairs


def _apply_merge_to_corpus(
    units: dict[tuple[int, ...], int],
    pair: tuple[int, int],
    new_id: int,
) -> dict[tuple[int, ...], int]:
    new_units: dict[tuple[int, ...], int] = {}
    for symbols, count in units.items():
        if len(symbols) < 2:
            new_units[symbols] = new_units.get(symbols, 0) + count
            continue
        out: list[int] = []
        i = 0
        a, b = pair
        while i < len(symbols):
            if i < len(symbols) - 1 and symbols[i] == a and symbols[i + 1] == b:
                out.append(new_id)
                i += 2
            else:
                out.append(symbols[i])
                i += 1
        merged = tuple(out)
        new_units[merged] = new_units.get(merged, 0) + count
    return new_units


def train_bpe(tokenizer: MiniBPE, corpus: str, target_vocab_size: int) -> None:
    tokenizer.initialize(DEFAULT_SPECIALS)
    chunks = _pretokenize(corpus)
    units: dict[tuple[int, ...], int] = {}
    for chunk in chunks:
        symbols = tuple(chunk.encode("utf-8"))
        units[symbols] = units.get(symbols, 0) + 1
    while tokenizer.vocab_size < target_vocab_size:
        pairs = _count_pairs(units)
        if not pairs:
            break
        max_count = max(pairs.values())
        candidates = sorted(p for p, c in pairs.items() if c == max_count)
        best = candidates[0]
        if pairs[best] < 2:
            break
        new_id = len(tokenizer.vocab)
        merged_bytes = tokenizer.vocab[best[0]] + tokenizer.vocab[best[1]]
        tokenizer.vocab[new_id] = merged_bytes
        tokenizer.inv_vocab[merged_bytes] = new_id
        tokenizer.merges[best] = new_id
        units = _apply_merge_to_corpus(units, best, new_id)


def encode_text(tokenizer: MiniBPE, text: str) -> list[int]:
    ranked = {pair: rank for rank, pair in enumerate(tokenizer.merges.keys())}
    out: list[int] = []
    for chunk in _pretokenize(text):
        symbols: list[int] = list(chunk.encode("utf-8"))
        while len(symbols) >= 2:
            best_rank = None
            best_index = -1
            best_pair: tuple[int, int] | None = None
            for i in range(len(symbols) - 1):
                pair = (symbols[i], symbols[i + 1])
                rank = ranked.get(pair)
                if rank is None:
                    continue
                if best_rank is None or rank < best_rank:
                    best_rank = rank
                    best_index = i
                    best_pair = pair
            if best_pair is None:
                break
            new_id = tokenizer.merges[best_pair]
            symbols = symbols[:best_index] + [new_id] + symbols[best_index + 2:]
        out.extend(symbols)
    return out


class SlidingWindowDataset(Dataset):
    """PyTorch Dataset over a flat id stream.

    Each example is a window of size T+1. __getitem__ returns
    (input_ids, target_ids) where target = input shifted left by one.
    """

    def __init__(
        self,
        ids: list[int],
        context_length: int,
        stride: int | None = None,
    ) -> None:
        if context_length < 1:
            raise ValueError(f"context_length must be >= 1, got {context_length}")
        if not ids:
            raise ValueError("ids must be non-empty")
        if stride is None:
            stride = context_length
        if stride < 1:
            raise ValueError(f"stride must be >= 1, got {stride}")
        self.ids = torch.tensor(ids, dtype=torch.long)
        self.context_length = context_length
        self.stride = stride

    @staticmethod
    def count_windows(num_ids: int, context_length: int, stride: int) -> int:
        usable = num_ids - (context_length + 1)
        if usable < 0:
            return 0
        return 1 + usable // stride

    def __len__(self) -> int:
        return self.count_windows(self.ids.numel(), self.context_length, self.stride)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor]:
        if index < 0:
            index += len(self)
        if index < 0 or index >= len(self):
            raise IndexError(f"window index {index} out of range")
        start = index * self.stride
        end = start + self.context_length + 1
        window = self.ids[start:end]
        return window[:-1].clone(), window[1:].clone()


def make_dataloader(
    dataset: SlidingWindowDataset,
    batch_size: int,
    shuffle: bool = True,
    base_seed: int = 0,
    epoch: int = 0,
    drop_last: bool = True,
) -> DataLoader:
    """Build a DataLoader with a deterministic per-epoch shuffle."""
    generator = torch.Generator()
    generator.manual_seed(base_seed + epoch)
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        drop_last=drop_last,
        generator=generator if shuffle else None,
        num_workers=0,
    )


def _encode_corpus_to_ids(tokenizer: MiniBPE, corpus: str, target_vocab: int) -> list[int]:
    train_bpe(tokenizer, corpus, target_vocab_size=target_vocab)
    return encode_text(tokenizer, corpus)


DEMO_CORPUS = """\
the quick brown fox jumps over the lazy dog
a journey of a thousand miles begins with a single step
the only way to do great work is to love what you do
the best time to plant a tree was twenty years ago
the second best time is now
practice is the bridge between intention and skill
small daily actions compound into large outcomes
read more than you write write more than you talk
the map is not the territory and the menu is not the meal
what gets measured gets managed if the measurement is honest
the quick brown fox runs across the meadow at dawn
a small step today is better than a perfect plan tomorrow
courage is not the absence of fear it is action despite fear
the lazy dog sleeps under the old oak tree
every expert was once a beginner who refused to quit
focus is saying no to a hundred good ideas
the river that you cannot cross today will be easier tomorrow
practice the basics until the basics become invisible
""" * 8


def _print_section(title: str) -> None:
    bar = "-" * len(title)
    print(f"\n{title}\n{bar}")


def main() -> int:
    target_vocab = 320
    context_length = 16
    stride = 8
    batch_size = 4
    base_seed = 7

    tokenizer = MiniBPE()
    ids = _encode_corpus_to_ids(tokenizer, DEMO_CORPUS, target_vocab)

    _print_section("Corpus and tokenizer")
    print(f"corpus chars      : {len(DEMO_CORPUS)}")
    print(f"vocab size        : {tokenizer.vocab_size}")
    print(f"total ids         : {len(ids)}")

    dataset = SlidingWindowDataset(ids, context_length=context_length, stride=stride)
    print(f"context length    : {context_length}")
    print(f"stride            : {stride}")
    print(f"num windows       : {len(dataset)}")
    expected = SlidingWindowDataset.count_windows(len(ids), context_length, stride)
    assert len(dataset) == expected, "len(dataset) must equal count_windows"

    _print_section("Inspect one example")
    input_ids, target_ids = dataset[0]
    print(f"input shape       : {tuple(input_ids.shape)}")
    print(f"target shape      : {tuple(target_ids.shape)}")
    assert input_ids.shape == target_ids.shape, "shapes must match"
    assert torch.equal(input_ids[1:], target_ids[:-1]), "target must be input shifted by one"

    _print_section("Pull a batch from the DataLoader")
    loader = make_dataloader(dataset, batch_size=batch_size, base_seed=base_seed, epoch=0)
    inputs, targets = next(iter(loader))
    print(f"inputs            : {tuple(inputs.shape)}")
    print(f"targets           : {tuple(targets.shape)}")
    print(f"first input row   : {inputs[0].tolist()}")
    print(f"first target row  : {targets[0].tolist()}")
    assert inputs.shape == (batch_size, context_length)
    assert targets.shape == (batch_size, context_length)

    _print_section("Shuffle is seeded")
    loader_a = make_dataloader(dataset, batch_size=batch_size, base_seed=base_seed, epoch=0)
    loader_b = make_dataloader(dataset, batch_size=batch_size, base_seed=base_seed, epoch=0)
    batch_a = next(iter(loader_a))
    batch_b = next(iter(loader_b))
    assert torch.equal(batch_a[0], batch_b[0]), "same seed must produce same first batch"
    print("same seed -> same first batch: OK")

    loader_c = make_dataloader(dataset, batch_size=batch_size, base_seed=base_seed, epoch=1)
    batch_c = next(iter(loader_c))
    assert not torch.equal(batch_a[0], batch_c[0]), "different epoch must change order"
    print("different epoch -> different order: OK")

    _print_section("Stride trade-off")
    for s in (4, 8, 16):
        ds = SlidingWindowDataset(ids, context_length=context_length, stride=s)
        print(f"  stride {s:>2}: {len(ds):>4} windows")

    print("\nDemo OK.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
