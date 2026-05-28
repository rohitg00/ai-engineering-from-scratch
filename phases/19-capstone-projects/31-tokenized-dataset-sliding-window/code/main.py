"""next-token training 用の sliding window tokenized dataset。

tokenizer で encode 済みの id stream を PyTorch Dataset と DataLoader で包み、training loop が (B, T) input と (B, T) target batch を取り出せるようにします。

tokenizer は lesson 30 の小さな byte-level BPE をインライン化したものなので、lesson 間 import なしで動きます。

Run: Python3 code/main.py
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
    """インライン byte-level BPE tokenizer（lesson 30 と同じ契約）。"""

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
    min_vocab_size = BYTE_ALPHABET_SIZE + len(DEFAULT_SPECIALS)
    if target_vocab_size < min_vocab_size:
        raise ValueError(
            f"target_vocab_size must be >= {min_vocab_size}, got {target_vocab_size}"
        )
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
    """平坦な id stream 上の PyTorch Dataset。

    各例は size T+1 の window です。__getitem__ は target = input を1つ左へずらした
    (input_ids, target_ids) を返します。
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
    """epoch ごとに deterministic shuffle する DataLoader を作ります。"""
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
素早い茶色の狐が怠けた犬を飛び越える
千里の道も一歩から始まる
よい仕事をする唯一の方法はその仕事を好きになることだ
木を植える最良の時期は二十年前だった
次に良い時期は今である
練習は意図と技能をつなぐ橋である
小さな日々の行動は大きな成果へ積み上がる
書くより多く読み話すより多く書く
地図は領土ではなくメニューは食事ではない
測るものは管理されるが測定は誠実でなければならない
素早い茶色の狐が夜明けの草地を走る
今日の小さな一歩は明日の完璧な計画よりよい
勇気とは恐れがないことではなく恐れても行動することだ
怠けた犬は古い樫の木の下で眠る
どの専門家もかつては諦めなかった初心者だった
集中とは百のよい案にノーと言うことだ
今日渡れない川も明日は渡りやすくなる
基礎が見えなくなるまで基礎を練習する
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

    _print_section("コーパスと tokenizer")
    print(f"コーパス文字数      : {len(DEMO_CORPUS)}")
    print(f"語彙サイズ          : {tokenizer.vocab_size}")
    print(f"総 id 数            : {len(ids)}")

    dataset = SlidingWindowDataset(ids, context_length=context_length, stride=stride)
    print(f"context length     : {context_length}")
    print(f"stride             : {stride}")
    print(f"window 数          : {len(dataset)}")
    expected = SlidingWindowDataset.count_windows(len(ids), context_length, stride)
    assert len(dataset) == expected, "len(dataset) は count_windows と一致する必要があります"

    _print_section("1例を確認")
    input_ids, target_ids = dataset[0]
    print(f"input shape        : {tuple(input_ids.shape)}")
    print(f"target shape       : {tuple(target_ids.shape)}")
    assert input_ids.shape == target_ids.shape, "shape が一致する必要があります"
    assert torch.equal(input_ids[1:], target_ids[:-1]), "target は input を1つずらしたものです"

    _print_section("DataLoader から batch を取り出す")
    loader = make_dataloader(dataset, batch_size=batch_size, base_seed=base_seed, epoch=0)
    inputs, targets = next(iter(loader))
    print(f"inputs             : {tuple(inputs.shape)}")
    print(f"targets            : {tuple(targets.shape)}")
    print(f"最初の input row    : {inputs[0].tolist()}")
    print(f"最初の target row   : {targets[0].tolist()}")
    assert inputs.shape == (batch_size, context_length)
    assert targets.shape == (batch_size, context_length)

    _print_section("shuffle は seed 済み")
    loader_a = make_dataloader(dataset, batch_size=batch_size, base_seed=base_seed, epoch=0)
    loader_b = make_dataloader(dataset, batch_size=batch_size, base_seed=base_seed, epoch=0)
    batch_a = next(iter(loader_a))
    batch_b = next(iter(loader_b))
    assert torch.equal(batch_a[0], batch_b[0]), "同じ seed は同じ first batch を生成する必要があります"
    print("同じ seed -> 同じ first batch: OK")

    loader_c = make_dataloader(dataset, batch_size=batch_size, base_seed=base_seed, epoch=1)
    batch_c = next(iter(loader_c))
    assert not torch.equal(batch_a[0], batch_c[0]), "異なる epoch では順序が変わる必要があります"
    print("異なる epoch -> 異なる順序: OK")

    _print_section("stride の trade-off")
    for s in (4, 8, 16):
        ds = SlidingWindowDataset(ids, context_length=context_length, stride=s)
        print(f"  stride {s:>2}: {len(ds):>4} windows")

    print("\nデモ OK。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
