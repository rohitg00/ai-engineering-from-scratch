"""Speculative decoding server — draft/verify scheduler scaffold。

重要な architecture primitive は draft/verify scheduler である。Draft
model が k 個の candidate token を提案し、target model が 1 回の batched
pass でそれらを verify する。Accepted prefix は commit され、rejected
suffix は target から resample される。この scaffold は synthetic token
probability を使って scheduler を実装し、accept/reject logic と throughput
math を end to end で観測できるようにする。

実行:  python main.py
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# synthetic models  --  小さな vocabulary 上の probability distribution
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
# target  --  call 数を節約したい高コスト model
# ---------------------------------------------------------------------------

@dataclass
class TargetModel:
    calls: int = 0
    tokens_verified: int = 0

    def distribution(self, ctx_seed: int) -> list[float]:
        return softmax_from(ctx_seed * 7 + 13)

    def verify(self, draft_tokens: list[int], ctx_seed: int,
               rng: random.Random) -> tuple[list[int], int]:
        """(accepted_tokens, resampled_next) を返す。
        1 回の target call で draft_tokens を batched pass として verify できる。
        Target は position ごとに probability を出し、最初の rejection まで accept する。
        """
        self.calls += 1
        self.tokens_verified += len(draft_tokens) + 1
        accepted: list[int] = []
        for pos, tok in enumerate(draft_tokens):
            dist = self.distribution(ctx_seed + pos)
            # 単純な accept criterion: この token の target prob >= 0.5 * max prob
            if dist[tok] >= 0.5 * max(dist):
                accepted.append(tok)
            else:
                break
        # accept 後の position で target から next token を resample する
        ctx = ctx_seed + len(accepted)
        dist = self.distribution(ctx)
        next_tok = sample(dist, rng)
        return accepted, next_tok


# ---------------------------------------------------------------------------
# draft  --  target とおおむね aligned している低コスト model
# ---------------------------------------------------------------------------

@dataclass
class DraftModel:
    calls: int = 0
    alignment: float = 0.80     # draft が target と同じ選択をする確率

    def propose(self, ctx_seed: int, k: int, rng: random.Random,
                target: TargetModel) -> list[int]:
        self.calls += 1
        draft_tokens: list[int] = []
        for pos in range(k):
            dist = target.distribution(ctx_seed + pos)
            # alignment の確率で target の best を出し、それ以外では sample する
            if rng.random() < self.alignment:
                draft_tokens.append(max(range(len(dist)), key=lambda i: dist[i]))
            else:
                draft_tokens.append(sample(dist, rng))
        return draft_tokens


# ---------------------------------------------------------------------------
# decode scheduler  --  比較用の speculative loop + baseline greedy
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
# sweep  --  k と draft alignment ごとの speedup を比較する
# ---------------------------------------------------------------------------

def main() -> None:
    n_tokens = 500
    print(f"=== {n_tokens} tokens を decode: baseline と speculative を比較 ===")

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
