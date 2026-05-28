"""
scratch からの Direct Preference Optimization (DPO)。

See: phases/19-capstone-projects/40-dpo-from-scratch/docs/en.md

以下を作ります。
  - INST / RESP specials 付き InstructionTokenizer（byte-level）
  - TinyGPT（causal decoder-only transformer）
  - (prompt, chosen, rejected) triples の preference fixture
  - prompt を mask して completion の next-token log probability を合計する sequence_log_prob
  - DPO loss
  - frozen reference と trainable policy を使う train_dpo loop
  - epoch ごとの loss と chosen-rejected margin を表示する run_demo

training で chosen-rejected log-prob margin が増えれば exit 0 です。
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


# ---------------------------------------------------------------------------
# tokenizer
# ---------------------------------------------------------------------------


class InstructionTokenizer:
    INST_ID = 256
    RESP_ID = 257
    PAD_ID = 258
    VOCAB = 260

    def encode_prompt(self, prompt: str) -> List[int]:
        ids = [self.INST_ID]
        ids.extend(prompt.encode("utf-8", errors="ignore"))
        ids.append(self.RESP_ID)
        return ids

    def encode_completion(self, completion: str) -> List[int]:
        return list(completion.encode("utf-8", errors="ignore"))


# ---------------------------------------------------------------------------
# TinyGPT
# ---------------------------------------------------------------------------


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

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, D = x.shape
        qkv = self.qkv(x).view(B, T, 3, self.heads, self.head_dim).permute(2, 0, 3, 1, 4)
        q, k, v = qkv[0], qkv[1], qkv[2]
        att = (q @ k.transpose(-2, -1)) / math.sqrt(self.head_dim)
        causal = self.causal_mask[:T, :T].view(1, 1, T, T)
        att = att.masked_fill(~causal, float("-inf"))
        weights = F.softmax(att, dim=-1)
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

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attn(self.ln1(x))
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

    def forward(self, ids: torch.Tensor) -> torch.Tensor:
        B, T = ids.shape
        positions = torch.arange(T, device=ids.device).unsqueeze(0).expand(B, T)
        x = self.tok(ids) + self.pos(positions)
        for blk in self.blocks:
            x = blk(x)
        return self.head(self.ln_f(x))


# ---------------------------------------------------------------------------
# preference fixture
# ---------------------------------------------------------------------------


def make_preferences() -> List[Dict[str, str]]:
    """単純な task types を含む12個の preference triples。"""
    return [
        {"prompt": "フランスの首都は何ですか?", "chosen": "パリ。", "rejected": "フランスには多くの美しい都市があり、パリもその一つです。"},
        {"prompt": "日本の首都は何ですか?", "chosen": "東京。", "rejected": "日本は島国です。政府の中心は東京にあります。"},
        {"prompt": "スペインの首都は何ですか?", "chosen": "マドリード。", "rejected": "スペインには多くの都市があります。マドリードはその中で大きな都市です。"},
        {"prompt": "2 + 3 を計算してください。", "chosen": "5。", "rejected": "考えてみます。2足す3は5に近い何かだと思います。"},
        {"prompt": "7 * 6 を計算してください。", "chosen": "42。", "rejected": "7に6を掛けると40台くらいの数になります。"},
        {"prompt": "12 / 4 を計算してください。", "chosen": "3。", "rejected": "12を4で割るとだいたい3くらいです。"},
        {"prompt": "色を3つ挙げてください。", "chosen": "赤、緑、青。", "rejected": "色はどこにでもあります。赤や緑があり、青もあります。"},
        {"prompt": "母音を3つ挙げてください。", "chosen": "あ、い、う。", "rejected": "母音は口を開いて出す音で、あやいなどがあります。"},
        {"prompt": "変数を定義してください。", "chosen": "値に束縛された名前。", "rejected": "変数はプログラミングで何かを保存するために使うものです。"},
        {"prompt": "関数を定義してください。", "chosen": "出力を返す再利用可能なコード片。", "rejected": "関数は入力を与えて呼ぶと何かをするものです。"},
        {"prompt": "Python で 42 を表示してください。", "chosen": "print(42)", "rejected": "Python では数値を表示できます。42なら print を呼びます。"},
        {"prompt": "Python で items をソートしてください。", "chosen": "items.sort()", "rejected": "Python でリストをソートするには items に対して sort を呼びます。"},
    ]


# ---------------------------------------------------------------------------
# log-probability machinery
# ---------------------------------------------------------------------------


def sequence_log_prob(
    model: TinyGPT,
    prompt_ids: Sequence[int],
    completion_ids: Sequence[int],
) -> torch.Tensor:
    """prompt を条件とする completion tokens の log-probabilities の合計。

    model と同じ device 上の 0-dim tensor を返します。

    実装:
      - prompt + completion を連結します。
      - model に forward します。
      - logits の log-softmax を取ります。
      - full sequence 上の各 completion position i について、
        log p(completion[i] | tokens[<i]) を gather して合計します。
    """
    if len(completion_ids) == 0:
        return torch.zeros((), device=next(model.parameters()).device)
    full = list(prompt_ids) + list(completion_ids)
    if len(full) > model.max_len:
        # 最新 context を保つため左から truncate します。
        full = full[-model.max_len :]
        prompt_len = max(0, len(full) - len(completion_ids))
    else:
        prompt_len = len(prompt_ids)
    ids = torch.tensor([full], dtype=torch.long, device=next(model.parameters()).device)
    logits = model(ids)
    log_probs = F.log_softmax(logits, dim=-1)
    # position i は token i+1 を予測します。completion は indices [prompt_len, len(full)) にあります。
    # その範囲の k について log p(token at index k | tokens up to k-1) が必要です。
    # その確率は log_probs[0, k-1, token_k] です。
    completion_targets = torch.tensor(full[prompt_len:], dtype=torch.long, device=ids.device)
    pred_positions = torch.arange(prompt_len - 1, len(full) - 1, device=ids.device)
    # prompt_len == 0 の degenerate case を guard。
    if prompt_len == 0:
        pred_positions = torch.arange(0, len(full) - 1, device=ids.device)
        completion_targets = torch.tensor(full[1:], dtype=torch.long, device=ids.device)
    gathered = log_probs[0, pred_positions, completion_targets]
    return gathered.sum()


def dpo_loss(
    logp_w_pol: torch.Tensor,
    logp_l_pol: torch.Tensor,
    logp_w_ref: torch.Tensor,
    logp_l_ref: torch.Tensor,
    beta: float,
) -> Tuple[torch.Tensor, torch.Tensor]:
    """example ごとの DPO loss と implicit reward margin。

    L = -log sigmoid( beta * ( (logp_w_pol - logp_w_ref) - (logp_l_pol - logp_l_ref) ) )

    Returns (loss_scalar, reward_margin) where reward_margin is the argument
    of the sigmoid divided by beta (i.e. the implicit reward difference).
    """
    diff_w = logp_w_pol - logp_w_ref
    diff_l = logp_l_pol - logp_l_ref
    margin = diff_w - diff_l
    z = beta * margin
    # logsigmoid は numerically stable。loss は example ごとの scalar です。
    loss = -F.logsigmoid(z)
    return loss, margin


def ipo_loss(
    logp_w_pol: torch.Tensor,
    logp_l_pol: torch.Tensor,
    logp_w_ref: torch.Tensor,
    logp_l_ref: torch.Tensor,
    beta: float,
) -> Tuple[torch.Tensor, torch.Tensor]:
    """IPO variant: 飽和しない squared loss。

    L_IPO = ( ( (logp_w_pol - logp_w_ref) - (logp_l_pol - logp_l_ref) ) - 1 / (2 * beta) ) ** 2

    The 1 / (2 * beta) offset is the standard IPO target margin. The lesson
    ships this variant for the stretch comparison; the demo and DPO tests do
    not use it.
    """
    diff_w = logp_w_pol - logp_w_ref
    diff_l = logp_l_pol - logp_l_ref
    margin = diff_w - diff_l
    target = 1.0 / (2.0 * beta) if beta > 0 else 0.0
    loss = (margin - target) ** 2
    return loss, margin


def length_normalised_log_prob(
    model: TinyGPT,
    prompt_ids: Sequence[int],
    completion_ids: Sequence[int],
) -> torch.Tensor:
    """sequence log-prob を completion length で割ったもの。

    Useful for diagnosing length bias: if length-normalised margins are
    positive but raw margins are negative (or vice versa) the model is
    showing length-sensitive preferences.
    """
    if len(completion_ids) == 0:
        return torch.zeros((), device=next(model.parameters()).device)
    raw = sequence_log_prob(model, prompt_ids, completion_ids)
    return raw / float(len(completion_ids))


@dataclass(frozen=True)
class MarginRow:
    prompt: str
    chosen: str
    rejected: str
    margin: float
    chosen_logprob: float
    rejected_logprob: float


def margin_table(
    policy: TinyGPT,
    tok: InstructionTokenizer,
    triples: Sequence[Dict[str, str]],
) -> List[MarginRow]:
    """policy 下での triple ごとの margin report。debug に便利です。"""
    rows: List[MarginRow] = []
    with torch.no_grad():
        for tri in triples:
            prompt = tok.encode_prompt(tri["prompt"])
            chosen = tok.encode_completion(tri["chosen"])
            rejected = tok.encode_completion(tri["rejected"])
            lp_w = sequence_log_prob(policy, prompt, chosen).item()
            lp_l = sequence_log_prob(policy, prompt, rejected).item()
            rows.append(
                MarginRow(
                    prompt=tri["prompt"],
                    chosen=tri["chosen"],
                    rejected=tri["rejected"],
                    margin=lp_w - lp_l,
                    chosen_logprob=lp_w,
                    rejected_logprob=lp_l,
                )
            )
    return rows


def print_margin_table(rows: Sequence[MarginRow], log: Callable[[str], None] = print) -> None:
    log("  margin   chosen_lp   rejected_lp   prompt")
    log("  -------  ----------  ------------  -------------------------")
    for row in rows:
        log(
            f"  {row.margin:+.4f}   {row.chosen_logprob:+.4f}    {row.rejected_logprob:+.4f}     {row.prompt[:35]}"
        )


# ---------------------------------------------------------------------------
# reference / policy management
# ---------------------------------------------------------------------------


@dataclass
class DPOConfig:
    vocab: int = InstructionTokenizer.VOCAB
    hidden: int = 64
    heads: int = 4
    depth: int = 2
    max_len: int = 96
    beta: float = 0.2
    lr: float = 1e-3
    epochs: int = 30
    seed: int = 0
    warmup_epochs: int = 8  # log-probs が非自明になるよう短く reference を pretrain


def build_models(cfg: DPOConfig) -> Tuple[TinyGPT, TinyGPT]:
    """reference と policy を構築します。 The policy is initialised from the
    reference's state dict so they start in the same place, then the policy
    diverges under DPO training while the reference stays frozen."""
    torch.manual_seed(cfg.seed)
    reference = TinyGPT(cfg.vocab, cfg.hidden, cfg.heads, cfg.depth, cfg.max_len)
    torch.manual_seed(cfg.seed)  # training 前に policy weights が一致するよう reseed
    policy = TinyGPT(cfg.vocab, cfg.hidden, cfg.heads, cfg.depth, cfg.max_len)
    policy.load_state_dict(reference.state_dict())
    # reference を freeze。
    for p in reference.parameters():
        p.requires_grad = False
    reference.eval()
    return reference, policy


def warmup_pretrain(
    model: TinyGPT,
    tok: InstructionTokenizer,
    triples: Sequence[Dict[str, str]],
    epochs: int = 8,
    lr: float = 3e-3,
    seed: int = 0,
) -> List[float]:
    """reference が fixture の task structure に非自明な確率を持つよう、chosen completions で短い next-token pretraining pass を行います。"""
    torch.manual_seed(seed)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    losses: List[float] = []
    model.train()
    sequences: List[List[int]] = []
    for tri in triples:
        prompt = tok.encode_prompt(tri["prompt"])
        chosen = tok.encode_completion(tri["chosen"])
        sequences.append(prompt + chosen)
    for _ in range(epochs):
        ep_loss = 0.0
        for seq in sequences:
            if len(seq) > model.max_len:
                seq = seq[: model.max_len]
            ids = torch.tensor([seq], dtype=torch.long)
            logits = model(ids)
            pred = logits[:, :-1, :].contiguous()
            target = ids[:, 1:].contiguous()
            loss = F.cross_entropy(pred.view(-1, pred.size(-1)), target.view(-1))
            opt.zero_grad()
            loss.backward()
            opt.step()
            ep_loss += float(loss.item())
        losses.append(ep_loss / max(len(sequences), 1))
    return losses


# ---------------------------------------------------------------------------
# training loop
# ---------------------------------------------------------------------------


@dataclass
class DPOReport:
    losses: List[float] = field(default_factory=list)
    margins: List[float] = field(default_factory=list)
    initial_margin: float = 0.0
    final_margin: float = 0.0


def evaluate_margins(
    policy: TinyGPT,
    reference: TinyGPT,
    tok: InstructionTokenizer,
    triples: Sequence[Dict[str, str]],
) -> float:
    """policy 下での mean (chosen - rejected) log-prob difference。

    DPO なしでは任意の値になりえます。DPO training はこれを正に押し上げます。
    """
    margins: List[float] = []
    with torch.no_grad():
        for tri in triples:
            prompt = tok.encode_prompt(tri["prompt"])
            chosen = tok.encode_completion(tri["chosen"])
            rejected = tok.encode_completion(tri["rejected"])
            lp_w = sequence_log_prob(policy, prompt, chosen).item()
            lp_l = sequence_log_prob(policy, prompt, rejected).item()
            margins.append(lp_w - lp_l)
    return float(np.mean(margins)) if margins else 0.0


def train_dpo(
    policy: TinyGPT,
    reference: TinyGPT,
    tok: InstructionTokenizer,
    triples: Sequence[Dict[str, str]],
    cfg: DPOConfig,
    log: Callable[[str], None] = print,
) -> DPOReport:
    report = DPOReport()
    opt = torch.optim.Adam(policy.parameters(), lr=cfg.lr)
    # reference log-probs は最初に snapshot し、以後変わりません。
    ref_logps: List[Tuple[torch.Tensor, torch.Tensor]] = []
    with torch.no_grad():
        for tri in triples:
            prompt = tok.encode_prompt(tri["prompt"])
            chosen = tok.encode_completion(tri["chosen"])
            rejected = tok.encode_completion(tri["rejected"])
            lp_w_ref = sequence_log_prob(reference, prompt, chosen).detach()
            lp_l_ref = sequence_log_prob(reference, prompt, rejected).detach()
            ref_logps.append((lp_w_ref, lp_l_ref))
    report.initial_margin = evaluate_margins(policy, reference, tok, triples)
    for ep in range(1, cfg.epochs + 1):
        policy.train()
        total_loss = 0.0
        total_margin = 0.0
        for tri, (lp_w_ref, lp_l_ref) in zip(triples, ref_logps):
            prompt = tok.encode_prompt(tri["prompt"])
            chosen = tok.encode_completion(tri["chosen"])
            rejected = tok.encode_completion(tri["rejected"])
            lp_w_pol = sequence_log_prob(policy, prompt, chosen)
            lp_l_pol = sequence_log_prob(policy, prompt, rejected)
            loss, margin = dpo_loss(lp_w_pol, lp_l_pol, lp_w_ref, lp_l_ref, beta=cfg.beta)
            opt.zero_grad()
            loss.backward()
            opt.step()
            total_loss += float(loss.item())
            total_margin += float(margin.item())
        report.losses.append(total_loss / max(len(triples), 1))
        report.margins.append(total_margin / max(len(triples), 1))
        log(f"  epoch {ep:>3d}: loss={report.losses[-1]:.4f}  margin={report.margins[-1]:+.4f}")
    report.final_margin = evaluate_margins(policy, reference, tok, triples)
    return report


# ---------------------------------------------------------------------------
# demo
# ---------------------------------------------------------------------------


def run_demo(cfg: Optional[DPOConfig] = None) -> int:
    cfg = cfg or DPOConfig()
    torch.manual_seed(cfg.seed)
    np.random.seed(cfg.seed)
    random.seed(cfg.seed)

    tok = InstructionTokenizer()
    triples = make_preferences()

    print("DPO FROM SCRATCH DEMO")
    print(f"triples={len(triples)} beta={cfg.beta} lr={cfg.lr} epochs={cfg.epochs}")
    print("")

    reference, policy = build_models(cfg)

    print(f"[warmup] chosen completions で短く pretrain ({cfg.warmup_epochs} epochs)...")
    # build_models() は reference を freeze し、DPO loop が誤って
    # 更新できないようにします。warmup の間だけ unfreeze し、training 前に再 freeze します。
    for p in reference.parameters():
        p.requires_grad = True
    reference.train()
    warm_losses = warmup_pretrain(
        reference,
        tok,
        triples,
        epochs=cfg.warmup_epochs,
        seed=cfg.seed,
    )
    # warmed-up weights を policy に copy し、reference を再 freeze します。
    policy.load_state_dict(reference.state_dict())
    for p in reference.parameters():
        p.requires_grad = False
    reference.eval()
    print(f"         warmup final loss = {warm_losses[-1]:.4f}")

    initial = evaluate_margins(policy, reference, tok, triples)
    print(f"         initial chosen-rejected margin = {initial:+.4f}")
    print("")

    print("[dpo training]")
    report = train_dpo(policy, reference, tok, triples, cfg)

    print("")
    print("[training 後の triple 別 margins]")
    print_margin_table(margin_table(policy, tok, triples))

    print("")
    print(f"FINAL margin = {report.final_margin:+.4f}  (initial was {report.initial_margin:+.4f})")
    print(f"FINAL loss   = {report.losses[-1]:.4f}  (epoch-1 loss was {report.losses[0]:.4f})")

    # sanity: training は margin を上げるはずです。
    if report.final_margin <= report.initial_margin:
        print("ERROR: training が chosen-rejected margin を増やしませんでした", file=sys.stderr)
        return 1
    # さらに loss は下がるはずです。
    if report.losses[-1] >= report.losses[0]:
        print("ERROR: training が epoch 間で loss を下げませんでした", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
