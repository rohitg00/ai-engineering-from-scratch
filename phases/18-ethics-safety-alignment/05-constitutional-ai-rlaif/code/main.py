"""Toy Constitutional-AI critique-and-revise loop — stdlib Python。

response は vocabulary から引いた tokens の bag です。"principle" は harmful
subset の tokens を flag します。critique model は harmful tokens を特定します。
revision は mapping に従って safe alternatives に置き換えます。これを corpus 上で
実行して新しい SFT set を作り、before / after の harmful-token rate を測ります。

Usage: python3 code/main.py
"""

from __future__ import annotations

import random
from dataclasses import dataclass


random.seed(11)

SAFE_TOKENS = [
    "please", "help", "explain", "consider", "inform",
    "guide", "describe", "understand", "thoughts", "share",
]
HARMFUL_TOKENS = [
    "harm", "attack", "exploit", "hack", "destroy",
    "weapon", "manipulate", "deceive",
]
REPLACEMENT = {
    "harm": "help",
    "attack": "understand",
    "exploit": "describe",
    "hack": "explain",
    "destroy": "consider",
    "weapon": "resource",
    "manipulate": "guide",
    "deceive": "inform",
}

PRINCIPLES = [
    "physical, psychological, or material harm を起こし得る output を避ける",
    "attacks への operational uplift を提供しない",
    "明確で non-violent な explanations を優先する",
    "third parties を守りながら user を助ける",
]


def base_model_sample(n_tokens: int = 6, p_harmful: float = 0.35) -> list[str]:
    """Base model: p_harmful の rate で harmful tokens を出すことがあります。"""
    out = []
    for _ in range(n_tokens):
        if random.random() < p_harmful:
            out.append(random.choice(HARMFUL_TOKENS))
        else:
            out.append(random.choice(SAFE_TOKENS))
    return out


def harmful_token_rate(response: list[str]) -> float:
    if not response:
        return 0.0
    return sum(1 for t in response if t in HARMFUL_TOKENS) / len(response)


def critique(response: list[str], principle: str) -> list[str]:
    """sampled principle に違反する tokens を特定します。"""
    return [t for t in response if t in HARMFUL_TOKENS]


def revise(response: list[str], bad: list[str]) -> list[str]:
    """mapping に従って harmful tokens を safe alternatives に置き換えます。"""
    bad_set = set(bad)
    return [REPLACEMENT.get(t, t) if t in bad_set else t for t in response]


@dataclass
class SftCorpus:
    prompts: list[list[str]]
    targets: list[list[str]]


def build_cai_sft_corpus(n_examples: int = 500) -> SftCorpus:
    """Phase 1: initial response を生成し、critique し、revise し、revised
    response を SFT target として保持します。"""
    prompts = []
    targets = []
    for _ in range(n_examples):
        prompt = base_model_sample(n_tokens=4, p_harmful=0.1)
        response = base_model_sample()
        principle = random.choice(PRINCIPLES)
        bad = critique(response, principle)
        revised = revise(response, bad)
        prompts.append(prompt)
        targets.append(revised)
    return SftCorpus(prompts, targets)


def toy_sft_train(corpus: SftCorpus) -> dict[tuple[str, ...], list[str]]:
    """prompt-prefix → completion lookup を作ります。trivial な SFT surrogate です。"""
    model = {}
    for p, t in zip(corpus.prompts, corpus.targets):
        key = tuple(p[-2:]) if len(p) >= 2 else tuple(p)
        model[key] = t
    return model


def cai_model_sample(prompt: list[str], model: dict, n_tokens: int = 6) -> list[str]:
    key = tuple(prompt[-2:]) if len(prompt) >= 2 else tuple(prompt)
    if key in model:
        return list(model[key])
    return [random.choice(SAFE_TOKENS) for _ in range(n_tokens)]


def ai_feedback_rank(a: list[str], b: list[str]) -> int:
    """Phase 2 RLAIF: AI labeler は harmful-token rate が低い方を好みます。"""
    ra = harmful_token_rate(a)
    rb = harmful_token_rate(b)
    if ra < rb:
        return 0
    if rb < ra:
        return 1
    return random.randint(0, 1)


def evaluate(model_fn, n: int = 200) -> float:
    rates = []
    for _ in range(n):
        prompt = base_model_sample(n_tokens=4, p_harmful=0.1)
        resp = model_fn(prompt)
        rates.append(harmful_token_rate(resp))
    return sum(rates) / len(rates)


def main() -> None:
    print("=" * 70)
    print("CONSTITUTIONAL AI TOY PIPELINE (Phase 18, Lesson 5)")
    print("=" * 70)

    print("\nPhase 0 — base model (alignment なし)。")
    base = lambda prompt: base_model_sample()
    base_rate = evaluate(base)
    print(f"  200 prompts 上の harmful-token rate: {base_rate:.3f}")

    print("\nPhase 1 — critique-and-revise SFT corpus を生成しました。")
    corpus = build_cai_sft_corpus(500)
    trained = toy_sft_train(corpus)
    print(f"  corpus size: {len(corpus.prompts)} examples")
    print(f"  principle pool: {len(PRINCIPLES)} principles")

    cai = lambda prompt: cai_model_sample(prompt, trained)
    cai_rate = evaluate(cai)
    print(f"  CAI-SFT 後の harmful-token rate : {cai_rate:.3f}")
    print(f"  reduction                       : "
          f"{(base_rate - cai_rate) / base_rate * 100:.1f}%")

    print("\nPhase 2 — RLAIF (completion pair に対する AI feedback)。")
    wins = 0
    trials = 500
    for _ in range(trials):
        prompt = base_model_sample(n_tokens=4, p_harmful=0.1)
        a = base(prompt)
        b = cai(prompt)
        if ai_feedback_rank(a, b) == 1:
            wins += 1
    print(f"  AI-feedback で CAI が base に勝つ回数: {wins}/{trials} "
          f"= {wins/trials:.1%}")

    print("\n" + "=" * 70)
    print("要点: CAI-SFT だけでも harmful-token rate は大きく下がります。")
    print("RLAIF はさらに optimize するための preference signal を加えます。")
    print("preference signal が legible であること、つまり principles を読め、")
    print("どの principle がどの critique を生んだか inspect できることが、")
    print("human labels に対する主な advantage です。cost だけではありません。")
    print("=" * 70)


if __name__ == "__main__":
    main()
