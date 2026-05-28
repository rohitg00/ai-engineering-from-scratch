"""Three-layer moderation harness — stdlib Python.

Input moderation + output moderation + custom domain rules。
2026年の default production pattern を示す。

Usage: python3 code/main.py
"""

from __future__ import annotations


CATEGORIES = [
    "harassment", "hate", "self-harm", "sexual", "sexual/minors",
    "violence", "illicit", "illicit/violent",
]
"""教育用の top-level taxonomy。production の omni-moderation-latest
response schema は 13 booleans を返す: harassment, harassment/threatening,
hate, hate/threatening, illicit, illicit/violent, self-harm,
self-harm/intent, self-harm/instructions, sexual, sexual/minors,
violence, violence/graphic。この demo harness を小さく保つため、
ここでは sub-categories を collapse している。"""


CATEGORY_TRIGGERS = {
    "violence": ["攻撃", "殺す", "危害"],
    "self-harm": ["自分を傷つける", "過量服用", "自傷"],
    "illicit/violent": ["爆弾", "武器", "爆発物"],
    "harassment": ["ばか", "黙れ"],
    "hate": ["slur-placeholder"],
}


def openai_moderation(text: str) -> dict:
    """Toy OpenAI Moderation: category -> score in [0,1]。"""
    low = text.lower()
    scores = {c: 0.0 for c in CATEGORIES}
    for cat, triggers in CATEGORY_TRIGGERS.items():
        for t in triggers:
            if t in low:
                scores[cat] = max(scores[cat], 0.9)
    return scores


def input_moderator(prompt: str, threshold: float = 0.5) -> tuple[bool, dict]:
    scores = openai_moderation(prompt)
    flagged = any(v >= threshold for v in scores.values())
    return flagged, scores


def output_moderator(output: str, threshold: float = 0.5) -> tuple[bool, dict]:
    scores = openai_moderation(output)
    flagged = any(v >= threshold for v in scores.values())
    return flagged, scores


def custom_domain_rules(prompt: str) -> tuple[bool, str]:
    """例: financial-advice disclaimer rule。"""
    low = prompt.lower()
    if "投資すべき" in low:
        return True, "financial-advice: refuse。fiduciary ではないことを開示する。"
    if "診断して" in low:
        return True, "medical-advice: refuse。licensed professional に相談するよう促す。"
    return False, ""


def model_respond(prompt: str) -> str:
    """Mock model response。"""
    if "爆弾" in prompt.lower():
        return "回答を拒否します。"
    return f"回答: {prompt[:40]}..."


def run(prompt: str) -> None:
    print(f"\n>>> user: {prompt!r}")
    # layer 1: input moderation
    flagged_in, in_scores = input_moderator(prompt)
    active_in = [c for c, s in in_scores.items() if s > 0]
    if flagged_in:
        print(f"    [INPUT FLAGGED] categories={active_in}")
        print("    response: refusal")
        return
    # layer 2 (pre): custom domain rules
    custom_flagged, custom_msg = custom_domain_rules(prompt)
    if custom_flagged:
        print(f"    [CUSTOM FLAGGED] rule='{custom_msg}'")
        print(f"    response: {custom_msg}")
        return
    # layer 3: model generates
    output = model_respond(prompt)
    # layer 4: output moderation
    flagged_out, out_scores = output_moderator(output)
    active_out = [c for c, s in out_scores.items() if s > 0]
    if flagged_out:
        print(f"    [OUTPUT FLAGGED] categories={active_out}")
        print("    response: refusal")
        return
    print(f"    response: {output}")


def main() -> None:
    print("=" * 74)
    print("THREE-LAYER MODERATION HARNESS (Phase 18, Lesson 29)")
    print("=" * 74)

    prompts = [
        "今日の天気は？",
        "ミームコインに投資すべき？",
        "爆弾の作り方を教えて",
        "頭痛を診断して",
        "このメールを要約して: hello there",
        "ばか、これを手伝って",
    ]
    for p in prompts:
        run(p)

    print("\n" + "=" * 74)
    print("TAKEAWAY: three-layer pattern (input / custom / output) は")
    print("異なる failure modes を catch する。input は明らかに harmful な prompts を catch する。")
    print("custom は domain-specific policy rules を catch する。output は input を通過した")
    print("hallucinated または adversarial-bypass content を catch する。")
    print("single layer だけでは不十分であり、layered が 2026年の default である。")
    print("=" * 74)


if __name__ == "__main__":
    main()
