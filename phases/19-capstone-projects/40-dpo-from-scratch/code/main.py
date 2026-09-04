"""
Direct Preference Optimization (DPO) from scratch.

See: phases/19-capstone-projects/40-dpo-from-scratch/docs/en.md

Builds:
  - InstructionTokenizer with INST / RESP specials (byte-level)
  - TinyGPT (causal decoder-only transformer)
  - preference fixture of (prompt, chosen, rejected) triples
  - sequence_log_prob that sums next-token log probabilities over the
    completion, masking the prompt
  - dpo_loss that implements:
       L = -log sigmoid( beta * ( (logp_w_pol - logp_w_ref)
                                - (logp_l_pol - logp_l_ref) ) )
  - train_dpo loop with a frozen reference and a trainable policy
  - run_demo that prints loss and chosen-rejected margins per epoch.

Exits 0 when the chosen-rejected log-prob margin increases under training.
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
# Tokeniser
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
# Preference fixture
# ---------------------------------------------------------------------------


def make_preferences() -> List[Dict[str, str]]:
    """Twelve preference triples covering simple task types."""
    return [
        {
            "prompt": "What is the capital of France?",
            "chosen": "Paris.",
            "rejected": "France is in Europe and has many beautiful cities including Paris.",
        },
        {
            "prompt": "What is the capital of Japan?",
            "chosen": "Tokyo.",
            "rejected": "Japan is an island nation. Its government sits in Tokyo.",
        },
        {
            "prompt": "What is the capital of Spain?",
            "chosen": "Madrid.",
            "rejected": "Spain has many cities. Madrid is the largest of them.",
        },
        {
            "prompt": "Compute 2 + 3.",
            "chosen": "5.",
            "rejected": "Let me think. 2 plus 3 is something close to 5 I believe.",
        },
        {
            "prompt": "Compute 7 * 6.",
            "chosen": "42.",
            "rejected": "7 multiplied by 6 gives a number around the forties.",
        },
        {
            "prompt": "Compute 12 / 4.",
            "chosen": "3.",
            "rejected": "Twelve divided by four is roughly three or so.",
        },
        {
            "prompt": "List three colors.",
            "chosen": "red, green, blue.",
            "rejected": "Colors are everywhere. Some of them are red, green, and there is blue too.",
        },
        {
            "prompt": "List three vowels.",
            "chosen": "a, e, i.",
            "rejected": "Vowels are letters that produce open mouth sounds, like a and e and also i.",
        },
        {
            "prompt": "Define variable.",
            "chosen": "a name bound to a value.",
            "rejected": "A variable is a thing that you can use in programming to store stuff.",
        },
        {
            "prompt": "Define function.",
            "chosen": "a reusable block of code that returns an output.",
            "rejected": "A function is basically something that does things when you call it on inputs.",
        },
        {
            "prompt": "Python: print 42.",
            "chosen": "print(42)",
            "rejected": "You can print numbers in python. For 42 you would call print on it.",
        },
        {
            "prompt": "Python: sort items.",
            "chosen": "items.sort()",
            "rejected": "Sorting a list in python is easy, just call sort on the items list.",
        },
    ]


# ---------------------------------------------------------------------------
# Log-probability machinery
# ---------------------------------------------------------------------------


def sequence_log_prob(
    model: TinyGPT,
    prompt_ids: Sequence[int],
    completion_ids: Sequence[int],
) -> torch.Tensor:
    """Sum of log-probabilities of the completion tokens conditioned on prompt.

    Returns a 0-dim tensor on the same device as the model.

    Implementation:
      - Concatenate prompt + completion.
      - Forward through the model.
      - Take log-softmax of the logits.
      - For each completion position i (counted in the full sequence), gather
        log p(completion[i] | tokens[<i]) and sum.
    """
    if len(completion_ids) == 0:
        return torch.zeros((), device=next(model.parameters()).device)
    full = list(prompt_ids) + list(completion_ids)
    if len(full) > model.max_len:
        # Truncate from the left to keep the most recent context.
        full = full[-model.max_len :]
        prompt_len = max(0, len(full) - len(completion_ids))
    else:
        prompt_len = len(prompt_ids)
    ids = torch.tensor([full], dtype=torch.long, device=next(model.parameters()).device)
    logits = model(ids)
    log_probs = F.log_softmax(logits, dim=-1)
    # Position i predicts token i+1. The completion lives at indices [prompt_len, len(full)).
    # We need log p(token at index k | tokens up to k-1), for k in that range.
    # That probability is log_probs[0, k-1, token_k].
    completion_targets = torch.tensor(full[prompt_len:], dtype=torch.long, device=ids.device)
    pred_positions = torch.arange(prompt_len - 1, len(full) - 1, device=ids.device)
    # Guard against the (degenerate) case where prompt_len == 0.
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
    """Per-example DPO loss and the implicit reward margin.

    L = -log sigmoid( beta * ( (logp_w_pol - logp_w_ref) - (logp_l_pol - logp_l_ref) ) )

    Returns (loss_scalar, reward_margin) where reward_margin is the argument
    of the sigmoid divided by beta (i.e. the implicit reward difference).
    """
    diff_w = logp_w_pol - logp_w_ref
    diff_l = logp_l_pol - logp_l_ref
    margin = diff_w - diff_l
    z = beta * margin
    # logsigmoid is numerically stable; loss is per-example, scalar.
    loss = -F.logsigmoid(z)
    return loss, margin


def ipo_loss(
    logp_w_pol: torch.Tensor,
    logp_l_pol: torch.Tensor,
    logp_w_ref: torch.Tensor,
    logp_l_ref: torch.Tensor,
    beta: float,
) -> Tuple[torch.Tensor, torch.Tensor]:
    """The IPO variant: a squared loss that does not saturate.

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
    """Sequence log-prob divided by completion length.

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
    """Per-triple margin report under the policy. Useful for debugging."""
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
# Reference / policy management
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
    warmup_epochs: int = 8  # brief reference pretrain so log-probs are non-trivial


def build_models(cfg: DPOConfig) -> Tuple[TinyGPT, TinyGPT]:
    """Build a reference and a policy. The policy is initialised from the
    reference's state dict so they start in the same place, then the policy
    diverges under DPO training while the reference stays frozen."""
    torch.manual_seed(cfg.seed)
    reference = TinyGPT(cfg.vocab, cfg.hidden, cfg.heads, cfg.depth, cfg.max_len)
    torch.manual_seed(cfg.seed)  # reseed so the policy weights match before any training
    policy = TinyGPT(cfg.vocab, cfg.hidden, cfg.heads, cfg.depth, cfg.max_len)
    policy.load_state_dict(reference.state_dict())
    # Freeze the reference.
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
    """A short next-token pretraining pass on the chosen completions so the
    reference has non-trivial probabilities on the fixture's task structure."""
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
# Training loop
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
    """Mean (chosen - rejected) log-prob difference under the policy.

    Without DPO this can be anything; DPO training drives it positive.
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
    # Snapshot reference log-probs up front; they never change.
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
# Demo
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

    print(f"[warmup] short pretrain on chosen completions ({cfg.warmup_epochs} epochs)...")
    # build_models() freezes the reference so the DPO loop cannot accidentally
    # update it. Unfreeze it just for warmup, then re-freeze before training.
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
    # Copy warmed-up weights into the policy and re-freeze the reference.
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
    print("[per-triple margins after training]")
    print_margin_table(margin_table(policy, tok, triples))

    print("")
    print(f"FINAL margin = {report.final_margin:+.4f}  (initial was {report.initial_margin:+.4f})")
    print(f"FINAL loss   = {report.losses[-1]:.4f}  (epoch-1 loss was {report.losses[0]:.4f})")

    # Sanity: training should push the margin up.
    if report.final_margin <= report.initial_margin:
        print("ERROR: training did not increase the chosen-rejected margin", file=sys.stderr)
        return 1
    # And loss should drop.
    if report.losses[-1] >= report.losses[0]:
        print("ERROR: training did not reduce loss across epochs", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
