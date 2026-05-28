"""
supervised fine-tuning (SFT) による instruction tuning。

See: phases/19-capstone-projects/39-instruction-tuning-sft/docs/en.md

以下を作ります。
  - INST / RESP / PAD specials 付き byte-level tokenizer
  - 200件の instruction-response pair 上の SFT dataset
  - instruction と pad tokens を -100 で mask する collate function
  - TinyGPT body と LM head
  - SFT loop、greedy generator、exact-match metric
  - 20 epochs 学習して category 別 exact-match を表示する run_demo

trained model が held-out set で random baseline 0.0 を上回れば exit 0 です。
"""

from __future__ import annotations

import math
import random
import sys
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Sequence, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset


# ---------------------------------------------------------------------------
# tokenizer
# ---------------------------------------------------------------------------


class InstructionTokenizer:
    """INST、RESP、PAD specials を持つ byte-level tokenizer。"""

    INST_ID = 256
    RESP_ID = 257
    PAD_ID = 258
    VOCAB = 260
    IGNORE_INDEX = -100

    def encode_pair(self, instruction: str, response: str, max_len: int) -> Tuple[List[int], int]:
        """(token_ids, response_start_index) を返します。 必要なら max_len に切り詰めますが、RESP marker と少なくとも1つの response token は常に残すため、SFT collation が全 mask labels を作ることはありません。"""
        if max_len < 3:
            raise ValueError("max_len must be >= 3 to fit INST, RESP, and one response token")
        inst_bytes = list(instruction.encode("utf-8", errors="ignore"))
        resp_bytes = list(response.encode("utf-8", errors="ignore"))
        # 2つの control tokens + 少なくとも1 response byte を確保。
        max_inst = max_len - 3
        inst_bytes = inst_bytes[:max_inst]
        ids = [self.INST_ID] + inst_bytes + [self.RESP_ID]
        resp_start = len(ids)
        ids.extend(resp_bytes[: max_len - len(ids)])
        return ids, resp_start

    def encode_prefix(self, instruction: str, max_len: int) -> List[int]:
        """generation 用に instruction prefix だけを encode します。 RESP marker を常に残すため、model は training 時と同じ boundary を見ます。"""
        if max_len < 2:
            raise ValueError("max_len must be >= 2 to fit INST and RESP")
        inst_bytes = list(instruction.encode("utf-8", errors="ignore"))[: max_len - 2]
        ids = [self.INST_ID] + inst_bytes + [self.RESP_ID]
        return ids

    def decode_response(self, ids: Sequence[int]) -> str:
        """specials を除いて generated response を decode します。"""
        chunk = bytes(i for i in ids if i < 256)
        return chunk.decode("utf-8", errors="replace")


# ---------------------------------------------------------------------------
# Tiny GPT
# ---------------------------------------------------------------------------


class CausalSelfAttention(nn.Module):
    def __init__(self, hidden: int, heads: int, max_len: int):
        super().__init__()
        if hidden % heads != 0:
            raise ValueError("hidden must divide by heads")
        self.heads = heads
        self.head_dim = hidden // heads
        self.qkv = nn.Linear(hidden, hidden * 3, bias=False)
        self.out = nn.Linear(hidden, hidden, bias=False)
        mask = torch.tril(torch.ones(max_len, max_len, dtype=torch.bool))
        self.register_buffer("causal_mask", mask, persistent=False)

    def forward(self, x: torch.Tensor, key_pad_mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        B, T, D = x.shape
        qkv = self.qkv(x).view(B, T, 3, self.heads, self.head_dim).permute(2, 0, 3, 1, 4)
        q, k, v = qkv[0], qkv[1], qkv[2]
        att = (q @ k.transpose(-2, -1)) / math.sqrt(self.head_dim)
        causal = self.causal_mask[:T, :T].view(1, 1, T, T)
        att = att.masked_fill(~causal, float("-inf"))
        if key_pad_mask is not None:
            # key_pad_mask: B x T, 1 for real, 0 for pad.
            km = key_pad_mask.view(B, 1, 1, T).to(torch.bool)
            att = att.masked_fill(~km, float("-inf"))
        weights = F.softmax(att, dim=-1)
        weights = torch.nan_to_num(weights, nan=0.0)
        ctx = (weights @ v).transpose(1, 2).contiguous().view(B, T, D)
        return self.out(ctx)


class Block(nn.Module):
    def __init__(self, hidden: int, heads: int, max_len: int):
        super().__init__()
        self.ln1 = nn.LayerNorm(hidden)
        self.attn = CausalSelfAttention(hidden, heads, max_len)
        self.ln2 = nn.LayerNorm(hidden)
        self.fc1 = nn.Linear(hidden, hidden * 4)
        self.fc2 = nn.Linear(hidden * 4, hidden)

    def forward(self, x: torch.Tensor, key_pad_mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        x = x + self.attn(self.ln1(x), key_pad_mask)
        h = self.ln2(x)
        h = self.fc2(F.gelu(self.fc1(h)))
        return x + h


class TinyGPT(nn.Module):
    def __init__(self, vocab: int, hidden: int, heads: int, depth: int, max_len: int):
        super().__init__()
        self.tok = nn.Embedding(vocab, hidden)
        self.pos = nn.Embedding(max_len, hidden)
        self.blocks = nn.ModuleList([Block(hidden, heads, max_len) for _ in range(depth)])
        self.ln_f = nn.LayerNorm(hidden)
        self.head = nn.Linear(hidden, vocab, bias=False)
        self.max_len = max_len

    def forward(self, ids: torch.Tensor, key_pad_mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        B, T = ids.shape
        positions = torch.arange(T, device=ids.device).unsqueeze(0).expand(B, T)
        x = self.tok(ids) + self.pos(positions)
        for blk in self.blocks:
            x = blk(x, key_pad_mask)
        return self.head(self.ln_f(x))


# ---------------------------------------------------------------------------
# instruction fixture
# ---------------------------------------------------------------------------


CAPITALS = [
    ("フランス", "パリ"),
    ("スペイン", "マドリード"),
    ("イタリア", "ローマ"),
    ("日本", "東京"),
    ("エジプト", "カイロ"),
    ("ブラジル", "ブラジリア"),
    ("カナダ", "オタワ"),
    ("オーストラリア", "キャンベラ"),
    ("ケニア", "ナイロビ"),
    ("スウェーデン", "ストックホルム"),
]

ARITHMETIC = [
    (2, 3, "+"),
    (5, 4, "*"),
    (9, 7, "-"),
    (12, 4, "/"),
    (7, 6, "+"),
    (11, 3, "-"),
    (8, 8, "+"),
    (15, 5, "/"),
    (6, 9, "*"),
    (20, 4, "/"),
]

LIST_NAMES = [
    ("色", ["赤", "緑", "青"]),
    ("惑星", ["水星", "gold星", "地球"]),
    ("母音", ["a", "e", "i"]),
    ("季節", ["春", "夏", "秋"]),
    ("gold属", ["鉄", "gold", "銀"]),
    ("素数", ["2", "3", "5"]),
    ("海洋", ["太平洋", "大西洋", "インド洋"]),
    ("言語", ["Python", "Rust", "go"]),
    ("楽器", ["ギター", "ピアノ", "ドラム"]),
    ("果物", ["りんご", "バナナ", "さくらんぼ"]),
]

SUMMARIES = [
    ("太陽は東から昇り西へ沈む。", "太陽は東から西へ動く。"),
    ("水は海面高度で摂氏百度で沸騰する。", "水は100度で沸騰する。"),
    ("月はおよそ27日で地球を回る。", "月は27日で地球を回る。"),
    ("光は秒速約300000キロメートルで進む。", "光は秒速300000キロメートルで進む。"),
    ("成人の人体には206個の骨がある。", "成人には206個の骨がある。"),
    ("植物は日光、水、二酸化炭素を使って食べ物を作る。", "植物は日光、水、二酸化炭素を使う。"),
    ("DNAは細胞内の遺伝情報を保存する。", "DNAは遺伝情報を保存する。"),
    ("心臓は体全体へ血液を送り出す。", "心臓は血液を送り出す。"),
    ("電気は導体を通って流れやすい。", "電流は導体を流れる。"),
    ("蜂は蜜を集めながら花粉を運ぶ。", "蜂は花粉を運ぶ。"),
]

CODE = [
    ("hello world を表示する", "print('hello world')"),
    ("数値42を表示する", "print(42)"),
    ("items というリストを昇順にソートする", "items.sort()"),
    ("items というリストを反転する", "items.reverse()"),
    ("items の長さを取得する", "len(items)"),
    ("ファイルを読み取りモードで開く", "open('f.txt', 'r')"),
    ("辞書 d の keys を取得する", "d.keys()"),
    ("x の絶対値を返す", "abs(x)"),
    ("x を小数2桁に丸める", "round(x, 2)"),
    ("x を文字列に変換する", "str(x)"),
]

DEFINITIONS = [
    ("variable", "メモリ内の値に束縛された名前。"),
    ("function", "入力を受け取り出力を返す再利用可能なコードブロック。"),
    ("loop", "コードブロックを繰り返す制御構造。"),
    ("class", "共通の構造を持つ object を作るための template。"),
    ("list", "順序を持つ mutable な値の sequence。"),
    ("dict", "key から value への mapping。"),
    ("string", "文字の sequence。"),
    ("integer", "小数部を持たない整数。"),
    ("float", "小数部を持つ数値を binary で保存したもの。"),
    ("module", "import できる Python code の file。"),
]


def _arithmetic_response(a: int, b: int, op: str) -> str:
    if op == "+":
        return f"{a} + {b} = {a + b}"
    if op == "-":
        return f"{a} - {b} = {a - b}"
    if op == "*":
        return f"{a} * {b} = {a * b}"
    if op == "/":
        return f"{a} / {b} = {a // b}"
    raise ValueError(f"unknown op {op}")


def make_dataset(seed: int = 0) -> Tuple[List[Dict[str, str]], List[str]]:
    """(pairs, categories) を返します。各 pair は instruction と response を持ちます。"""
    rng = random.Random(seed)
    pairs: List[Dict[str, str]] = []
    categories: List[str] = []

    # 首都 (40 pairs: 10 base x 4 templates)
    cap_templates = [
        "{country}の首都は何ですか?",
        "{country}の首都名を答えてください。",
        "{country}の首都は?",
        "{country}の首都を教えてください。",
    ]
    cap_resp_templates = [
        "{country}の首都は{city}です。",
        "{city}は{country}の首都です。",
        "{city}.",
        "答えは{city}です。",
    ]
    for country, city in CAPITALS:
        for i, t in enumerate(cap_templates):
            pairs.append(
                {
                    "instruction": t.format(country=country),
                    "response": cap_resp_templates[i].format(country=country, city=city),
                }
            )
            categories.append("capitals")

    # 算術 (30 pairs: 10 base x 3 templates)
    arith_templates = [
        "{a} {op} {b} を計算してください。",
        "{a} {op} {b} はいくつですか?",
        "{a} {op} {b}?",
    ]
    for a, b, op in ARITHMETIC:
        for t in arith_templates:
            pairs.append(
                {
                    "instruction": t.format(a=a, b=b, op=op),
                    "response": _arithmetic_response(a, b, op),
                }
            )
            categories.append("arithmetic")

    # リスト (30 pairs: 10 base x 3 templates)
    list_templates = [
        "{name}を3つ挙げてください。",
        "{name}を3つください。",
        "{name}を3つ答えてください。",
    ]
    for name, items in LIST_NAMES:
        for t in list_templates:
            pairs.append(
                {
                    "instruction": t.format(name=name),
                    "response": ", ".join(items) + ".",
                }
            )
            categories.append("lists")

    # 要約 (30 pairs: 10 base x 3 templates)
    sum_templates = [
        "要約してください: {text}",
        "一文で要約: {text}",
        "要約: {text}",
    ]
    for text, summary in SUMMARIES:
        for t in sum_templates:
            pairs.append({"instruction": t.format(text=text), "response": summary})
            categories.append("summaries")

    # コード (30 pairs: 10 base x 3 templates)
    code_templates = [
        "Write Python code to {task}.",
        "Python: {task}.",
        "{task} コード。",
    ]
    for task, code in CODE:
        for t in code_templates:
            pairs.append({"instruction": t.format(task=task), "response": code})
            categories.append("code")

    # 定義 (40 pairs: 10 base x 4 templates)
    def_templates = [
        "{term}を定義してください。",
        "{term}とは何ですか?",
        "{term}という用語を説明してください。",
        "{term}: それは何ですか?",
    ]
    for term, defn in DEFINITIONS:
        for t in def_templates:
            pairs.append({"instruction": t.format(term=term), "response": defn})
            categories.append("definitions")

    # total = 40 + 30 + 30 + 30 + 30 + 40 = 200。shuffle して返します。
    order = list(range(len(pairs)))
    rng.shuffle(order)
    return [pairs[i] for i in order], [categories[i] for i in order]


def split_dataset(
    pairs: Sequence[Dict[str, str]],
    cats: Sequence[str],
    test_frac: float = 0.2,
    seed: int = 0,
) -> Tuple[List[Dict[str, str]], List[str], List[Dict[str, str]], List[str]]:
    """category による stratified split。"""
    rng = random.Random(seed)
    by_cat: Dict[str, List[int]] = {}
    for i, c in enumerate(cats):
        by_cat.setdefault(c, []).append(i)
    train_idx: List[int] = []
    test_idx: List[int] = []
    for c, idxs in by_cat.items():
        idxs_copy = list(idxs)
        rng.shuffle(idxs_copy)
        cut = max(1, int(len(idxs_copy) * (1.0 - test_frac)))
        train_idx.extend(idxs_copy[:cut])
        test_idx.extend(idxs_copy[cut:])
    rng.shuffle(train_idx)
    rng.shuffle(test_idx)
    return (
        [pairs[i] for i in train_idx],
        [cats[i] for i in train_idx],
        [pairs[i] for i in test_idx],
        [cats[i] for i in test_idx],
    )


# ---------------------------------------------------------------------------
# dataset と collate
# ---------------------------------------------------------------------------


class SFTDataset(Dataset):
    def __init__(
        self,
        pairs: Sequence[Dict[str, str]],
        tok: InstructionTokenizer,
        max_len: int,
    ):
        self.pairs = list(pairs)
        self.tok = tok
        self.max_len = max_len

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int) -> Tuple[List[int], int]:
        pair = self.pairs[idx]
        ids, resp_start = self.tok.encode_pair(pair["instruction"], pair["response"], self.max_len)
        return ids, resp_start


def sft_collate(
    batch: Sequence[Tuple[List[int], int]],
    pad_id: int = InstructionTokenizer.PAD_ID,
    ignore_index: int = InstructionTokenizer.IGNORE_INDEX,
) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """batch 内の最長に padding し、instruction + pad に -100 mask を置いた labels を作ります。"""
    max_t = max(len(x[0]) for x in batch)
    input_ids: List[List[int]] = []
    labels: List[List[int]] = []
    attn_mask: List[List[int]] = []
    for ids, resp_start in batch:
        seq_len = len(ids)
        pad = [pad_id] * (max_t - seq_len)
        padded = list(ids) + pad
        # position i の label は input_ids[i+1] が何であるべきかを示します。その後
        # instruction と padding に対応する positions を mask します。
        lbl: List[int] = list(padded)
        for i in range(len(lbl)):
            if i < resp_start:
                # instruction または boundary token: これらの予測では学習しません。
                lbl[i] = ignore_index
            elif i >= seq_len:
                # padding region。
                lbl[i] = ignore_index
        am = [1] * seq_len + [0] * (max_t - seq_len)
        input_ids.append(padded)
        labels.append(lbl)
        attn_mask.append(am)
    return (
        torch.tensor(input_ids, dtype=torch.long),
        torch.tensor(labels, dtype=torch.long),
        torch.tensor(attn_mask, dtype=torch.long),
    )


def shifted_loss(
    logits: torch.Tensor, labels: torch.Tensor, ignore_index: int = InstructionTokenizer.IGNORE_INDEX
) -> torch.Tensor:
    """標準的な causal LM loss: next token を予測し、masked positions は無視します。"""
    # position i は labels の position i+1 を予測します。
    pred = logits[:, :-1, :].contiguous()
    target = labels[:, 1:].contiguous()
    return F.cross_entropy(
        pred.view(-1, pred.size(-1)),
        target.view(-1),
        ignore_index=ignore_index,
    )


# ---------------------------------------------------------------------------
# training と generation
# ---------------------------------------------------------------------------


@dataclass
class SFTConfig:
    vocab: int = InstructionTokenizer.VOCAB
    hidden: int = 96
    heads: int = 4
    depth: int = 2
    max_len: int = 96
    batch_size: int = 16
    epochs: int = 20
    lr: float = 5e-4
    seed: int = 0


def build_model(cfg: SFTConfig) -> TinyGPT:
    torch.manual_seed(cfg.seed)
    return TinyGPT(cfg.vocab, cfg.hidden, cfg.heads, cfg.depth, cfg.max_len)


@dataclass
class SFTReport:
    losses: List[float] = field(default_factory=list)
    eval_em: List[float] = field(default_factory=list)
    final_em: float = 0.0


def train_sft(
    model: TinyGPT,
    train_loader: DataLoader,
    cfg: SFTConfig,
    eval_pairs: Optional[Sequence[Dict[str, str]]] = None,
    tok: Optional[InstructionTokenizer] = None,
    eval_every: int = 5,
    log: Callable[[str], None] = print,
) -> SFTReport:
    torch.manual_seed(cfg.seed)
    opt = torch.optim.Adam(model.parameters(), lr=cfg.lr)
    report = SFTReport()
    for ep in range(1, cfg.epochs + 1):
        model.train()
        ep_loss = 0.0
        n_batches = 0
        for input_ids, labels, attn_mask in train_loader:
            logits = model(input_ids, key_pad_mask=attn_mask)
            loss = shifted_loss(logits, labels)
            opt.zero_grad()
            loss.backward()
            opt.step()
            ep_loss += float(loss.item())
            n_batches += 1
        avg = ep_loss / max(n_batches, 1)
        report.losses.append(avg)
        if eval_pairs is not None and tok is not None and ep % eval_every == 0:
            em = exact_match_set(model, tok, eval_pairs, cfg.max_len)
            report.eval_em.append(em)
            log(f"  epoch {ep:>3d}: loss={avg:.4f}  EM={em:.3f}")
        elif ep % eval_every == 0:
            log(f"  epoch {ep:>3d}: loss={avg:.4f}")
    if eval_pairs is not None and tok is not None:
        report.final_em = exact_match_set(model, tok, eval_pairs, cfg.max_len)
    return report


@torch.no_grad()
def generate(
    model: TinyGPT,
    tok: InstructionTokenizer,
    instruction: str,
    max_len: int,
    temperature: float = 0.0,
    max_new_tokens: int = 64,
    seed: int = 0,
) -> str:
    """greedy (temperature=0) または sampled generation。sentence-end が2連続したら停止します。"""
    model.eval()
    rng = torch.Generator()
    rng.manual_seed(seed)
    ids = tok.encode_prefix(instruction, max_len=max_len)
    sentence_ends = {ord("."), ord("!"), ord("?")}
    out_chars: List[int] = []
    for _ in range(max_new_tokens):
        if len(ids) >= max_len:
            break
        x = torch.tensor([ids], dtype=torch.long)
        attn_mask = torch.ones_like(x)
        logits = model(x, key_pad_mask=attn_mask)
        next_logits = logits[0, -1, :]
        if temperature <= 0.0:
            next_id = int(next_logits.argmax().item())
        else:
            probs = F.softmax(next_logits / temperature, dim=-1)
            next_id = int(torch.multinomial(probs, num_samples=1, generator=rng).item())
        if next_id == tok.PAD_ID:
            break
        if next_id == tok.INST_ID or next_id == tok.RESP_ID:
            # model が control token を生成したら停止します。
            break
        ids.append(next_id)
        out_chars.append(next_id)
        if (
            len(out_chars) >= 2
            and out_chars[-1] in sentence_ends
            and out_chars[-2] in sentence_ends
        ):
            break
    return tok.decode_response(out_chars)


# ---------------------------------------------------------------------------
# metrics
# ---------------------------------------------------------------------------


def normalise(text: str) -> str:
    s = text.lower().strip()
    while "  " in s:
        s = s.replace("  ", " ")
    return s


def exact_match(pred: str, gold: str) -> int:
    return 1 if normalise(pred) == normalise(gold) else 0


@torch.no_grad()
def exact_match_set(
    model: TinyGPT,
    tok: InstructionTokenizer,
    pairs: Sequence[Dict[str, str]],
    max_len: int,
) -> float:
    if not pairs:
        return 0.0
    hits = 0
    for pair in pairs:
        pred = generate(model, tok, pair["instruction"], max_len=max_len)
        hits += exact_match(pred, pair["response"])
    return hits / len(pairs)


def per_category_em(
    model: TinyGPT,
    tok: InstructionTokenizer,
    pairs: Sequence[Dict[str, str]],
    cats: Sequence[str],
    max_len: int,
) -> Dict[str, float]:
    by_cat: Dict[str, List[int]] = {}
    for p, c in zip(pairs, cats):
        pred = generate(model, tok, p["instruction"], max_len=max_len)
        by_cat.setdefault(c, []).append(exact_match(pred, p["response"]))
    return {c: sum(vs) / max(len(vs), 1) for c, vs in by_cat.items()}


# ---------------------------------------------------------------------------
# demo
# ---------------------------------------------------------------------------


def run_demo(cfg: Optional[SFTConfig] = None) -> int:
    cfg = cfg or SFTConfig()
    torch.manual_seed(cfg.seed)
    np.random.seed(cfg.seed)
    random.seed(cfg.seed)

    tok = InstructionTokenizer()
    pairs, cats = make_dataset(seed=cfg.seed)
    tr_pairs, tr_cats, te_pairs, te_cats = split_dataset(pairs, cats, test_frac=0.2, seed=cfg.seed)

    train_ds = SFTDataset(tr_pairs, tok, cfg.max_len)
    train_dl = DataLoader(
        train_ds,
        batch_size=cfg.batch_size,
        shuffle=True,
        collate_fn=lambda b: sft_collate(b),
    )

    print("INSTRUCTION TUNING (SFT) DEMO")
    print(f"train={len(tr_pairs)} test={len(te_pairs)} max_len={cfg.max_len}")
    print(f"categories: {sorted(set(cats))}")
    print("")

    model = build_model(cfg)
    initial_em = exact_match_set(model, tok, te_pairs, cfg.max_len)
    print(f"baseline (untrained) EM = {initial_em:.3f}")
    print("")

    print("[training]")
    report = train_sft(
        model,
        train_dl,
        cfg,
        eval_pairs=te_pairs,
        tok=tok,
        eval_every=5,
    )

    print("")
    print("[held-out の category 別 exact-match]")
    cat_em = per_category_em(model, tok, te_pairs, te_cats, cfg.max_len)
    for cat in sorted(cat_em):
        print(f"  {cat:>12s}: {cat_em[cat]:.3f}")

    print("")
    print("[sample generations]")
    for pair in te_pairs[:3]:
        pred = generate(model, tok, pair["instruction"], max_len=cfg.max_len)
        match = "MATCH" if exact_match(pred, pair["response"]) else "MISS "
        print(f"  [{match}] inst: {pair['instruction']}")
        print(f"          gold: {pair['response']}")
        print(f"          pred: {pred}")

    print("")
    print(f"FINAL EXACT MATCH = {report.final_em:.3f}  (baseline was {initial_em:.3f})")

    if report.final_em <= initial_em:
        print("ERROR: training が untrained baseline から EM を改善しませんでした", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
