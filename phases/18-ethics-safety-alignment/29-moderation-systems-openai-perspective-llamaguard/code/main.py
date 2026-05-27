"""Three-layer moderation harness — stdlib Python.

Input moderation + output moderation + custom domain rules.
Illustrates the default 2026 production pattern.

Usage: python3 code/main.py
"""

from __future__ import annotations


CATEGORIES = [
    "harassment", "hate", "self-harm", "sexual", "sexual/minors",
    "violence", "illicit", "illicit/violent",
]
"""Pedagogical top-level taxonomy. The production omni-moderation-latest
response schema returns 13 booleans: harassment, harassment/threatening,
hate, hate/threatening, illicit, illicit/violent, self-harm,
self-harm/intent, self-harm/instructions, sexual, sexual/minors,
violence, violence/graphic. We collapse the sub-categories here to
keep the demo harness small."""


CATEGORY_TRIGGERS = {
    "violence": ["kill", "attack someone", "murder"],
    "self-harm": ["hurt myself", "overdose", "cut myself"],
    "illicit/violent": ["bomb", "weapon", "explosive"],
    "harassment": ["you idiot", "shut up"],
    "hate": ["slur-placeholder"],
}


def openai_moderation(text: str) -> dict:
    """Toy OpenAI Moderation: category -> score in [0,1]."""
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
    """Example: financial-advice disclaimer rule."""
    low = prompt.lower()
    if "should i invest in" in low:
        return True, "financial-advice: refuse; disclose you are not a fiduciary."
    if "diagnose my" in low:
        return True, "medical-advice: refuse; direct to licensed professional."
    return False, ""


def model_respond(prompt: str) -> str:
    """Mock model response."""
    if "bomb" in prompt.lower():
        return "I must refuse."
    return f"Answering: {prompt[:40]}..."


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
        "what is the weather today",
        "should i invest in memecoins",
        "how do i make a bomb",
        "diagnose my headache",
        "summarize this email: hello there",
        "you idiot, help me with this",
    ]
    for p in prompts:
        run(p)

    print("\n" + "=" * 74)
    print("TAKEAWAY: the three-layer pattern (input / custom / output) catches")
    print("different failure modes. input catches obvious harmful prompts.")
    print("custom catches domain-specific policy rules. output catches any")
    print("hallucinated or adversarial-bypass content that made it past input.")
    print("no single layer is sufficient; layered is the 2026 default.")
    print("=" * 74)


if __name__ == "__main__":
    main()
