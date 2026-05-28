"""
小さな language model 用の完全な evaluation pipeline。

参照: phases/19-capstone-projects/41-eval-pipeline/docs/en.md

実装内容:
  - perplexity_eval (held-out language modelling)
  - exact_match_eval (短い事実回答)
  - token_f1_eval (open-form similarity)
  - judge_eval (deterministic scoring の mock LLM-as-judge)
  - Aggregator (eval ごとの正規化と重み付き平均)
  - run_demo: 小さな TinyGPT を短く学習し、4 つの eval を実行し、
    この file の横に report.json を書く。成功時は 0 で終了する。
"""

from __future__ import annotations

import json
import math
import os
import random
import sys
from dataclasses import asdict, dataclass, field
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset


# ---------------------------------------------------------------------------
# Tokenizer と TinyGPT (lessons 38-41 で共有)。
# ---------------------------------------------------------------------------


class InstructionTokenizer:
    INST_ID = 256
    RESP_ID = 257
    PAD_ID = 258
    VOCAB = 260
    IGNORE_INDEX = -100

    def encode_pair(self, instruction: str, response: str, max_len: int) -> Tuple[List[int], int]:
        ids = [self.INST_ID]
        ids.extend(instruction.encode("utf-8", errors="ignore"))
        ids.append(self.RESP_ID)
        resp_start = len(ids)
        ids.extend(response.encode("utf-8", errors="ignore"))
        if len(ids) > max_len:
            ids = ids[:max_len]
        return ids, resp_start

    def encode_prefix(self, instruction: str, max_len: int) -> List[int]:
        ids = [self.INST_ID]
        ids.extend(instruction.encode("utf-8", errors="ignore"))
        ids.append(self.RESP_ID)
        if len(ids) > max_len:
            ids = ids[:max_len]
        return ids

    def encode_text(self, text: str, max_len: int) -> List[int]:
        ids = list(text.encode("utf-8", errors="ignore"))
        if len(ids) > max_len:
            ids = ids[:max_len]
        return ids

    def decode_response(self, ids: Sequence[int]) -> str:
        return bytes(i for i in ids if i < 256).decode("utf-8", errors="replace")


class CausalSelfAttention(nn.Module):
    def __init__(self, hidden: int, heads: int, max_len: int):
        super().__init__()
        if hidden % heads != 0:
            raise ValueError("hidden must divide heads")
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
        return x + self.fc2(F.gelu(self.fc1(h)))


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
# Eval result dataclasses
# ---------------------------------------------------------------------------


@dataclass
class ExampleRecord:
    instruction: str
    prediction: str
    reference: str
    score: float
    detail: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EvalResult:
    name: str
    metric: float
    n_examples: int
    records: List[ExampleRecord] = field(default_factory=list)
    extras: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "metric": self.metric,
            "n_examples": self.n_examples,
            "records": [asdict(r) for r in self.records],
            "extras": self.extras,
        }


# ---------------------------------------------------------------------------
# 正規化と string utility
# ---------------------------------------------------------------------------


_TERMINAL_PUNCT = ".!?"


def normalise(text: str) -> str:
    s = text.lower().strip()
    while "  " in s:
        s = s.replace("  ", " ")
    return s


def strip_trailing_punctuation(text: str) -> str:
    s = text
    while s and s[-1] in _TERMINAL_PUNCT:
        s = s[:-1]
    return s


def normalise_for_em(text: str) -> str:
    return strip_trailing_punctuation(normalise(text))


def tokenize_text(text: str) -> List[str]:
    return [t for t in normalise(text).split() if t]


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------


LM_CORPUS = [
    "すばやい茶色の狐がのんびりした犬を飛び越える。",
    "生きるべきか否か、それが問題である。",
    "光るものすべてが金ではない。黄色いだけのものもある。",
    "スペインの雨は主に平野に降る。",
    "1 日 1 個のりんごは医者を遠ざける。",
    "the early bird catches the worm, but the second mouse gets the cheese.",
    "ほとんどの場合、行動は言葉より雄弁である。",
    "ローマ was not built in a day, but the romans worked at it daily.",
    "a stitch in time saves nine future stitches, every tailor agrees.",
    "the pen is mightier than the sword in the hands of an editor.",
    "どんな雲にも銀の縁取りがある。",
    "birds of a feather flock together near the same trees.",
    "do not count your chickens before they hatch under the hen.",
    "absence makes the heart grow fonder of letters and small notes.",
    "actions taken in haste are regretted at greater length later on.",
    "beauty is in the eye of the beholder and the budget of the buyer.",
    "fortune favours the bold, the brave, and occasionally the foolish.",
    "great minds think alike but fools seldom differ either.",
    "honesty is the best policy in most negotiations and contracts.",
    "忍耐は身につけ保つのに時間がかかる美徳である。",
]


EM_PAIRS = [
    ("フランスの首都は何ですか?", "パリ"),
    ("日本の首都は何ですか?", "東京"),
    ("イタリアの首都は何ですか?", "ローマ"),
    ("スペインの首都は何ですか?", "マドリード"),
    ("ブラジルの首都は何ですか?", "ブラジリア"),
    ("2 + 3 を計算してください。", "5"),
    ("7 + 8 を計算してください。", "15"),
    ("9 - 4 を計算してください。", "5"),
    ("6 * 3 を計算してください。", "18"),
    ("20 / 5 を計算してください。", "4"),
    ("最大の惑星を答えてください。", "木星"),
    ("最小の惑星を答えてください。", "水星"),
    ("variable を定義してください。", "値に束縛された名前"),
    ("function を定義してください。", "再利用可能な code block"),
    ("loop を定義してください。", "繰り返しを行う control structure"),
    ("Python: 42 を print してください。", "print(42)"),
    ("Python: こんにちは を print してください。", "print('こんにちは')"),
    ("Python: x の長さ。", "len(x)"),
    ("晴れた日の空の色は何ですか?", "青"),
    ("植物が取り込む気体は何ですか?", "二酸化炭素"),
]


F1_PAIRS = [
    (
        "要約: the sun rises in the east and sets in the west.",
        "the sun moves from east to west across the sky.",
    ),
    (
        "要約: water boils at one hundred degrees celsius at sea level.",
        "water boils at 100 degrees at sea level.",
    ),
    (
        "要約: the moon orbits the earth roughly every 27 days.",
        "the moon takes about 27 days to orbit earth.",
    ),
    (
        "要約: light travels at three hundred thousand kilometres per second.",
        "light moves at 300000 km per second.",
    ),
    (
        "要約: bees pollinate flowers as they collect nectar.",
        "bees pollinate flowers while gathering nectar.",
    ),
    (
        "要約: dna stores genetic information in cells.",
        "dna holds the genetic code inside cells.",
    ),
    (
        "要約: the heart pumps blood through arteries and veins.",
        "the heart moves blood through veins and arteries.",
    ),
    (
        "要約: the great wall of china stretches thousands of kilometres.",
        "the great wall extends thousands of kilometres across china.",
    ),
    (
        "要約: shakespeare は plays and sonnets in elizabethan english.",
        "shakespeare authored plays and sonnets in old english.",
    ),
    (
        "要約: photosynthesis converts sunlight into chemical energy.",
        "plants convert sunlight into chemical energy via photosynthesis.",
    ),
    (
        "要約: electricity flows easily through metals like copper and silver.",
        "electricity travels well through copper and silver wires.",
    ),
    (
        "要約: the human body has 206 bones in adulthood.",
        "adults have 206 bones in the human body.",
    ),
    (
        "要約: gravity pulls objects toward the centre of the earth.",
        "gravity attracts objects toward the earth centre.",
    ),
    (
        "要約: vaccines train the immune system to recognise pathogens.",
        "vaccines teach the immune system to identify germs.",
    ),
    (
        "要約: tectonic plates move slowly across the earth's surface.",
        "tectonic plates drift slowly across the surface.",
    ),
    (
        "要約: the equator is the imaginary line around the middle of earth.",
        "the equator is the line around the middle of the planet.",
    ),
    (
        "要約: octopuses have three hearts and 青 blood.",
        "octopuses possess three hearts and 青 blood.",
    ),
    (
        "要約: honey never spoils due to its low water content.",
        "honey does not spoil because of low water.",
    ),
    (
        "要約: deserts can be cold or hot but are always dry.",
        "deserts may be cold or hot but are dry places.",
    ),
    (
        "要約: the brain consumes around twenty percent of body energy.",
        "the brain uses about twenty percent of the body energy.",
    ),
]


JUDGE_SET = [
    ("フランスの首都を答えてください。", "the capital of france is パリ."),
    ("日本の首都を答えてください。", "the capital of japan is 東京."),
    ("variable を定義してください。", "a variable is a name that holds a value."),
    ("3 + 4 を計算してください。", "the result is 7."),
    ("Python: print 100.", "print(100) prints the integer 100."),
    ("色を 3 つ挙げてください。", "red, green, and 青 are three colors."),
    ("function を定義してください。", "a function is 再利用可能な code block."),
    ("11 - 4 を計算してください。", "the result is 7."),
    ("最大の惑星を答えてください。", "the largest planet is 木星."),
    ("Python: length of items.", "len(items) returns the length of the list."),
    ("母音を 3 つ挙げてください。", "a, e, and i are vowels."),
    ("6 * 5 を計算してください。", "the result is 30."),
    ("loop を定義してください。", "a loop is 繰り返しを行う control structure."),
    ("最小の海を答えてください。", "the smallest ocean is the arctic ocean."),
    ("8 / 2 を計算してください。", "the result is 4."),
    ("Python: open f in read mode.", "open('f.txt', 'r') opens a file in read mode."),
    ("string を定義してください。", "a string is a sequence of characters."),
    ("最長の川を答えてください。", "the longest river is the nile."),
    ("果物を 3 つ挙げてください。", "apple, banana, and cherry are fruits."),
    ("9 + 6 を計算してください。", "the result is 15."),
]


# ---------------------------------------------------------------------------
# Datasets
# ---------------------------------------------------------------------------


class LMTextDataset(Dataset):
    def __init__(self, texts: Sequence[str], tok: InstructionTokenizer, max_len: int):
        self.texts = list(texts)
        self.tok = tok
        self.max_len = max_len

    def __len__(self) -> int:
        return len(self.texts)

    def __getitem__(self, idx: int):
        ids = self.tok.encode_text(self.texts[idx], self.max_len)
        attn = [1] * len(ids)
        pad = self.max_len - len(ids)
        ids = ids + [InstructionTokenizer.PAD_ID] * pad
        attn = attn + [0] * pad
        return torch.tensor(ids, dtype=torch.long), torch.tensor(attn, dtype=torch.long)


# ---------------------------------------------------------------------------
# Perplexity eval
# ---------------------------------------------------------------------------


@torch.no_grad()
def perplexity_eval(
    model: TinyGPT,
    tok: InstructionTokenizer,
    texts: Sequence[str],
    max_len: int,
    batch_size: int = 8,
) -> EvalResult:
    model.eval()
    ds = LMTextDataset(texts, tok, max_len)
    dl = DataLoader(ds, batch_size=batch_size, shuffle=False)
    total_nll = 0.0
    total_tokens = 0
    per_example_nll: List[float] = []
    for ids, attn in dl:
        logits = model(ids, key_pad_mask=attn)
        pred = logits[:, :-1, :].contiguous()
        target = ids[:, 1:].contiguous()
        target_mask = attn[:, 1:].contiguous()  # exclude pad targets
        loss_per_pos = F.cross_entropy(
            pred.view(-1, pred.size(-1)),
            target.view(-1),
            reduction="none",
        ).view(target.shape)
        loss_per_pos = loss_per_pos * target_mask
        per_seq_sum = loss_per_pos.sum(dim=-1)
        per_seq_tok = target_mask.sum(dim=-1).clamp(min=1.0)
        per_example_nll.extend((per_seq_sum / per_seq_tok).tolist())
        total_nll += float(loss_per_pos.sum().item())
        total_tokens += int(target_mask.sum().item())
    if total_tokens == 0:
        ppl = float("inf")
    else:
        mean_nll = total_nll / total_tokens
        ppl = math.exp(mean_nll)
    records = [
        ExampleRecord(
            instruction=texts[i],
            prediction="",
            reference=texts[i],
            score=math.exp(per_example_nll[i]) if per_example_nll[i] < 50 else float("inf"),
            detail={"mean_nll": per_example_nll[i]},
        )
        for i in range(len(texts))
    ]
    return EvalResult(
        name="perplexity",
        metric=ppl,
        n_examples=len(texts),
        records=records,
        extras={"total_tokens": total_tokens, "mean_nll": total_nll / max(total_tokens, 1)},
    )


# ---------------------------------------------------------------------------
# Generative evals (EM, F1, judge)
# ---------------------------------------------------------------------------


@torch.no_grad()
def generate_greedy(
    model: TinyGPT,
    tok: InstructionTokenizer,
    instruction: str,
    max_new_tokens: int = 48,
) -> str:
    model.eval()
    ids = tok.encode_prefix(instruction, max_len=model.max_len)
    sentence_ends = {ord("."), ord("!"), ord("?")}
    out_chars: List[int] = []
    for _ in range(max_new_tokens):
        if len(ids) >= model.max_len:
            break
        x = torch.tensor([ids], dtype=torch.long)
        attn = torch.ones_like(x)
        logits = model(x, key_pad_mask=attn)
        next_id = int(logits[0, -1, :].argmax().item())
        if next_id == tok.PAD_ID or next_id == tok.INST_ID or next_id == tok.RESP_ID:
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


def exact_match_score(pred: str, ref: str) -> int:
    return 1 if normalise_for_em(pred) == normalise_for_em(ref) else 0


def token_f1_score(pred: str, ref: str) -> float:
    p_tokens = tokenize_text(pred)
    r_tokens = tokenize_text(ref)
    if not p_tokens and not r_tokens:
        return 1.0
    if not p_tokens or not r_tokens:
        return 0.0
    p_counts: Dict[str, int] = {}
    for tok in p_tokens:
        p_counts[tok] = p_counts.get(tok, 0) + 1
    r_counts: Dict[str, int] = {}
    for tok in r_tokens:
        r_counts[tok] = r_counts.get(tok, 0) + 1
    intersection = 0
    for tok, n in p_counts.items():
        intersection += min(n, r_counts.get(tok, 0))
    if intersection == 0:
        return 0.0
    precision = intersection / len(p_tokens)
    recall = intersection / len(r_tokens)
    return (2 * precision * recall) / (precision + recall)


def exact_match_eval(
    model: TinyGPT,
    tok: InstructionTokenizer,
    pairs: Sequence[Tuple[str, str]],
) -> EvalResult:
    records: List[ExampleRecord] = []
    hits = 0
    for inst, ref in pairs:
        pred = generate_greedy(model, tok, inst)
        sc = exact_match_score(pred, ref)
        hits += sc
        records.append(
            ExampleRecord(
                instruction=inst,
                prediction=pred,
                reference=ref,
                score=float(sc),
            )
        )
    metric = hits / max(len(pairs), 1)
    return EvalResult(
        name="exact_match", metric=metric, n_examples=len(pairs), records=records
    )


def token_f1_eval(
    model: TinyGPT,
    tok: InstructionTokenizer,
    pairs: Sequence[Tuple[str, str]],
) -> EvalResult:
    records: List[ExampleRecord] = []
    total = 0.0
    for inst, ref in pairs:
        pred = generate_greedy(model, tok, inst)
        sc = token_f1_score(pred, ref)
        total += sc
        records.append(
            ExampleRecord(
                instruction=inst,
                prediction=pred,
                reference=ref,
                score=sc,
            )
        )
    metric = total / max(len(pairs), 1)
    return EvalResult(name="token_f1", metric=metric, n_examples=len(pairs), records=records)


# ---------------------------------------------------------------------------
# Mock LLM-as-judge
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class JudgeVerdict:
    score: int
    rationale: str


def mock_judge(instruction: str, prediction: str, reference: str) -> JudgeVerdict:
    """Deterministic judge: prediction を 1-5 で採点する。

    採点 rule:
      5: 正規化後 prediction が正規化後 reference と一致.
      4: token-F1 >= 0.8
      3: token-F1 in [0.5, 0.8)
      2: token-F1 in [0.2, 0.5)
      1: otherwise
    """
    norm_pred = normalise_for_em(prediction)
    norm_ref = normalise_for_em(reference)
    if norm_pred == norm_ref:
        return JudgeVerdict(score=5, rationale="正規化後に完全一致")
    f1 = token_f1_score(prediction, reference)
    if f1 >= 0.8:
        return JudgeVerdict(score=4, rationale=f"high token overlap (F1={f1:.2f})")
    if f1 >= 0.5:
        return JudgeVerdict(score=3, rationale=f"moderate token overlap (F1={f1:.2f})")
    if f1 >= 0.2:
        return JudgeVerdict(score=2, rationale=f"weak token overlap (F1={f1:.2f})")
    return JudgeVerdict(score=1, rationale=f"token overlap が低い (F1={f1:.2f})")


def judge_eval(
    model: TinyGPT,
    tok: InstructionTokenizer,
    pairs: Sequence[Tuple[str, str]],
    judge_fn: Callable[[str, str, str], JudgeVerdict] = mock_judge,
) -> EvalResult:
    records: List[ExampleRecord] = []
    total = 0.0
    for inst, ref in pairs:
        pred = generate_greedy(model, tok, inst)
        verdict = judge_fn(inst, pred, ref)
        total += verdict.score
        records.append(
            ExampleRecord(
                instruction=inst,
                prediction=pred,
                reference=ref,
                score=float(verdict.score),
                detail={"rationale": verdict.rationale},
            )
        )
    metric = total / max(len(pairs), 1)
    return EvalResult(name="judge", metric=metric, n_examples=len(pairs), records=records)


# ---------------------------------------------------------------------------
# Aggregator
# ---------------------------------------------------------------------------


DEFAULT_WEIGHTS = {
    "perplexity": 0.2,
    "exact_match": 0.3,
    "token_f1": 0.3,
    "judge": 0.2,
}


def normalise_metric(name: str, value: float) -> float:
    """raw metric を [0, 1] に写像する。"""
    if name == "perplexity":
        if value <= 0 or math.isinf(value) or math.isnan(value):
            return 0.0
        return 1.0 / (1.0 + math.log(max(value, 1.0)))
    if name == "exact_match":
        return max(0.0, min(1.0, float(value)))
    if name == "token_f1":
        return max(0.0, min(1.0, float(value)))
    if name == "judge":
        return max(0.0, min(1.0, float(value) / 5.0))
    raise ValueError(f"unknown metric name: {name}")


@dataclass
class FinalReport:
    per_eval: Dict[str, float]
    normalised: Dict[str, float]
    weights: Dict[str, float]
    aggregate: float
    details: Dict[str, EvalResult] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "per_eval": self.per_eval,
            "normalised": self.normalised,
            "weights": self.weights,
            "aggregate": self.aggregate,
            "details": {k: v.to_dict() for k, v in self.details.items()},
        }


def aggregate(results: Sequence[EvalResult], weights: Optional[Dict[str, float]] = None) -> FinalReport:
    weights = dict(weights or DEFAULT_WEIGHTS)
    # Normalise weights so they sum to 1.
    total_w = sum(weights.get(r.name, 0.0) for r in results)
    if total_w <= 0:
        raise ValueError("eval name に一致する正の weight がありません")
    norm_weights = {r.name: weights.get(r.name, 0.0) / total_w for r in results}
    per_eval = {r.name: r.metric for r in results}
    normalised = {r.name: normalise_metric(r.name, r.metric) for r in results}
    agg = sum(normalised[name] * norm_weights[name] for name in normalised)
    return FinalReport(
        per_eval=per_eval,
        normalised=normalised,
        weights=norm_weights,
        aggregate=agg,
        details={r.name: r for r in results},
    )


# ---------------------------------------------------------------------------
# Pretty printer
# ---------------------------------------------------------------------------


def render_report(report: FinalReport, log: Callable[[str], None] = print) -> None:
    log("EVAL REPORT")
    log("  eval          raw        normalised   weight")
    log("  ------------  ---------  -----------  ------")
    for name in sorted(report.per_eval.keys()):
        raw = report.per_eval[name]
        if name == "perplexity":
            raw_repr = f"{raw:>9.3f}"
        else:
            raw_repr = f"{raw:>9.3f}"
        norm = report.normalised[name]
        weight = report.weights[name]
        log(f"  {name:<12}  {raw_repr}  {norm:>11.3f}  {weight:>6.2f}")
    log("  ------------  ---------  -----------  ------")
    log(f"  AGGREGATE                            {report.aggregate:.3f}")


# ---------------------------------------------------------------------------
# Demo: train a tiny model briefly and run all four evals.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class EvalConfig:
    vocab: int = InstructionTokenizer.VOCAB
    hidden: int = 64
    heads: int = 4
    depth: int = 2
    max_len: int = 80
    train_epochs: int = 5
    lr: float = 3e-3
    seed: int = 0


def train_small(model: TinyGPT, tok: InstructionTokenizer, cfg: EvalConfig) -> List[float]:
    """model が完全な random にならないよう LM corpus + EM pairs で短く pretraining する。

    This is enough to make all four metrics non-trivial without locking in a
    specific quality bar.
    """
    pairs: List[List[int]] = []
    for text in LM_CORPUS:
        pairs.append(tok.encode_text(text, cfg.max_len))
    for inst, ref in EM_PAIRS:
        ids, _ = tok.encode_pair(inst, ref, cfg.max_len)
        pairs.append(ids)
    opt = torch.optim.Adam(model.parameters(), lr=cfg.lr)
    losses: List[float] = []
    model.train()
    for _ in range(cfg.train_epochs):
        ep_loss = 0.0
        for seq in pairs:
            ids = torch.tensor([seq], dtype=torch.long)
            attn = torch.ones_like(ids)
            logits = model(ids, key_pad_mask=attn)
            pred = logits[:, :-1, :].contiguous()
            target = ids[:, 1:].contiguous()
            loss = F.cross_entropy(pred.view(-1, pred.size(-1)), target.view(-1))
            opt.zero_grad()
            loss.backward()
            opt.step()
            ep_loss += float(loss.item())
        losses.append(ep_loss / max(len(pairs), 1))
    return losses


def run_demo(cfg: Optional[EvalConfig] = None, write_json: bool = True) -> int:
    cfg = cfg or EvalConfig()
    torch.manual_seed(cfg.seed)
    np.random.seed(cfg.seed)
    random.seed(cfg.seed)

    print("EVAL PIPELINE DEMO")
    print(f"fixtures: lm={len(LM_CORPUS)} em={len(EM_PAIRS)} f1={len(F1_PAIRS)} judge={len(JUDGE_SET)}")
    print("")

    tok = InstructionTokenizer()
    model = TinyGPT(cfg.vocab, cfg.hidden, cfg.heads, cfg.depth, cfg.max_len)

    print(f"[training] {cfg.train_epochs} epochs over LM + EM combined corpus...")
    losses = train_small(model, tok, cfg)
    print(f"           final epoch loss = {losses[-1]:.4f}")
    print("")

    print("[evaluating]")
    ppl_res = perplexity_eval(model, tok, LM_CORPUS, cfg.max_len)
    em_res = exact_match_eval(model, tok, EM_PAIRS)
    f1_res = token_f1_eval(model, tok, F1_PAIRS)
    j_res = judge_eval(model, tok, JUDGE_SET)
    print(f"  perplexity   = {ppl_res.metric:.3f}")
    print(f"  exact_match  = {em_res.metric:.3f}")
    print(f"  token_f1     = {f1_res.metric:.3f}")
    print(f"  judge (1-5)  = {j_res.metric:.3f}")
    print("")

    report = aggregate([ppl_res, em_res, f1_res, j_res])
    render_report(report)

    print("")
    print("[per-task spot checks]")
    for res in [em_res, f1_res, j_res]:
        for rec in res.records[:2]:
            print(f"  {res.name:>11s}  inst='{rec.instruction[:35]}' pred='{rec.prediction[:35]}' score={rec.score:.2f}")

    if write_json:
        here = os.path.dirname(os.path.abspath(__file__))
        out_path = os.path.join(here, "report.json")
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(report.to_dict(), fh, indent=2, default=str)
        print("")
        print(f"書き込みました: {out_path}")

    if report.aggregate <= 0.0 or math.isnan(report.aggregate):
        print("ERROR: aggregate score is not positive", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
