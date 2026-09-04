"""Speculative decoding server — draft/verify scheduler scaffold.

The hard architectural primitive is the draft/verify scheduler: a draft
model proposes k candidate tokens; the target model verifies them in one
batched pass; any accepted prefix is committed and the rejected suffix is
resampled from the target. This scaffold implements the scheduler with
synthetic token probabilities so the accept/reject logic and the throughput
math are observable end to end.

Run:  python main.py
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# synthetic models  --  probability distributions over a tiny vocabulary
# ---------------------------------------------------------------------------

VOCAB = list("abcdefghij")


def softmax_from(seed: int) -> list[float]:
    rnd = random.Random(seed)
    weights = [rnd.random() for _ in VOCAB]
    total = sum(weights)
    return [w / total for w in weights]


def sample(dist: list[float], rng: random.Random) -> int:
    r = rng.random()
    acc = 0.0
    for i, p in enumerate(dist):
        acc += p
        if r <= acc:
            return i
    return len(dist) - 1


# ---------------------------------------------------------------------------
# target  --  the expensive model we are trying to save calls to
# ---------------------------------------------------------------------------

@dataclass
class TargetModel:
    calls: int = 0
    tokens_verified: int = 0

    def distribution(self, ctx_seed: int) -> list[float]:
        return softmax_from(ctx_seed * 7 + 13)

    def verify(self, draft_tokens: list[int], ctx_seed: int,
               rng: random.Random) -> tuple[list[int], int]:
        """Return (accepted_tokens, resampled_next). In one target call we can
        verify draft_tokens in a batched pass: the target produces a prob per
        position; we accept up to the first rejection."""
        self.calls += 1
        self.tokens_verified += len(draft_tokens) + 1
        accepted: list[int] = []
        for pos, tok in enumerate(draft_tokens):
            dist = self.distribution(ctx_seed + pos)
            # simple accept criterion: target prob on this token >= 0.5 * max prob
            if dist[tok] >= 0.5 * max(dist):
                accepted.append(tok)
            else:
                break
        # resample a next token from the target at the position after the accept
        ctx = ctx_seed + len(accepted)
        dist = self.distribution(ctx)
        next_tok = sample(dist, rng)
        return accepted, next_tok


# ---------------------------------------------------------------------------
# draft  --  a cheaper model that is mostly aligned with target
# ---------------------------------------------------------------------------

@dataclass
class DraftModel:
    calls: int = 0
    alignment: float = 0.80     # probability that draft picks what target would

    def propose(self, ctx_seed: int, k: int, rng: random.Random,
                target: TargetModel) -> list[int]:
        self.calls += 1
        draft_tokens: list[int] = []
        for pos in range(k):
            dist = target.distribution(ctx_seed + pos)
            # with prob alignment, emit target's best; otherwise sample a neighbour
            if rng.random() < self.alignment:
                draft_tokens.append(max(range(len(dist)), key=lambda i: dist[i]))
            else:
                draft_tokens.append(sample(dist, rng))
        return draft_tokens


# ---------------------------------------------------------------------------
# decode scheduler  --  speculative loop + baseline greedy for comparison
# ---------------------------------------------------------------------------

@dataclass
class Metrics:
    generated: int = 0
    target_calls: int = 0
    draft_calls: int = 0
    accepted_sum: int = 0

    def acceptance_rate(self, k: int) -> float:
        if self.target_calls == 0:
            return 0.0
        return self.accepted_sum / (self.target_calls * k)

    def tokens_per_target_call(self) -> float:
        return self.generated / max(1, self.target_calls)


def speculative_decode(n_tokens: int, k: int, rng: random.Random,
                       target: TargetModel, draft: DraftModel) -> Metrics:
    m = Metrics()
    ctx_seed = 1
    while m.generated < n_tokens:
        draft_tokens = draft.propose(ctx_seed, k, rng, target)
        m.draft_calls += 1
        accepted, next_tok = target.verify(draft_tokens, ctx_seed, rng)
        m.target_calls += 1
        m.accepted_sum += len(accepted)
        for tok in accepted:
            m.generated += 1
            ctx_seed += 1
            if m.generated >= n_tokens:
                break
        if m.generated < n_tokens:
            m.generated += 1     # resampled next_tok
            ctx_seed += 1
    return m


def baseline_decode(n_tokens: int, rng: random.Random,
                    target: TargetModel) -> Metrics:
    m = Metrics()
    ctx_seed = 1
    while m.generated < n_tokens:
        target.calls += 1
        m.target_calls += 1
        dist = target.distribution(ctx_seed)
        _ = sample(dist, rng)
        m.generated += 1
        ctx_seed += 1
    return m


# ---------------------------------------------------------------------------
# sweep  --  compare speedup across k and draft alignment
# ---------------------------------------------------------------------------

def main() -> None:
    n_tokens = 500
    print(f"=== decode {n_tokens} tokens, compare baseline vs speculative ===")

    target = TargetModel()
    rng = random.Random(7)
    base = baseline_decode(n_tokens, rng, target)
    print(f"baseline: {base.target_calls} target calls, "
          f"{base.tokens_per_target_call():.2f} tok/call")

    for alignment in (0.60, 0.75, 0.90):
        for k in (2, 4, 6):
            target = TargetModel()
            draft = DraftModel(alignment=alignment)
            rng = random.Random(7)
            m = speculative_decode(n_tokens, k, rng, target, draft)
            speedup = base.target_calls / max(1, m.target_calls)
            print(f"  align={alignment:.2f} k={k}  "
                  f"target_calls={m.target_calls:3d}  "
                  f"acceptance={m.acceptance_rate(k):.2f}  "
                  f"tok/call={m.tokens_per_target_call():.2f}  "
                  f"speedup={speedup:.2f}x")


if __name__ == "__main__":
    main()
