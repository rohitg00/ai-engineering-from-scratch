"""Multimodal RAG toy — three retrievers + score fusion + grounded generator.

Stdlib. A synthetic restaurant corpus with text reviews, image-feature tags,
and audio-ambiance scores. Runs three retrievers, fuses scores, emits a stub
answer with citations. Demonstrates agentic reformulation on low-confidence.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Restaurant:
    id: str
    name: str
    review_text: str
    image_tags: list[str]
    ambient_db: float


CORPUS = [
    Restaurant("r1", "Sunday Plant Bistro",
               "best vegan brunch, quiet mornings, lots of windows", ["natural_light", "minimal"], 38),
    Restaurant("r2", "Orange Grove Cafe",
               "all-day vegan brunch, noisy music, industrial style", ["industrial"], 68),
    Restaurant("r3", "Vine & Leaf",
               "vegan lunch, dim lighting", ["warm_lighting"], 55),
    Restaurant("r4", "Morning Glow",
               "vegan brunch, airy space, lots of sun", ["natural_light", "airy"], 42),
    Restaurant("r5", "Steak Central",
               "steakhouse, loud atmosphere", ["dark"], 72),
]


def text_retrieve(query: str) -> dict[str, float]:
    """Crude keyword matching for the query against review text."""
    keywords = [w.lower() for w in query.split() if len(w) > 2]
    scores = {}
    for r in CORPUS:
        text = r.review_text.lower()
        s = sum(text.count(k) for k in keywords)
        scores[r.id] = s / len(keywords) if keywords else 0
    return scores


def image_retrieve(query: str) -> dict[str, float]:
    q = query.lower()
    tag_hints = []
    if "light" in q or "sun" in q:
        tag_hints.append("natural_light")
    if "airy" in q or "spacious" in q:
        tag_hints.append("airy")
    if "minimal" in q:
        tag_hints.append("minimal")
    scores = {}
    for r in CORPUS:
        s = sum(1.0 for t in tag_hints if t in r.image_tags)
        scores[r.id] = s / max(1, len(tag_hints))
    return scores


def audio_retrieve(query: str) -> dict[str, float]:
    q = query.lower()
    scores = {}
    if "quiet" in q or "calm" in q:
        for r in CORPUS:
            scores[r.id] = max(0.0, 1.0 - r.ambient_db / 80.0)
    else:
        for r in CORPUS:
            scores[r.id] = 0.5
    return scores


def fuse(scores_list: list[dict[str, float]], weights: list[float]) -> dict[str, float]:
    fused = {}
    for r in CORPUS:
        s = 0.0
        for w, scores in zip(weights, scores_list):
            s += w * scores.get(r.id, 0)
        fused[r.id] = s
    return fused


def top_k(scored: dict[str, float], k: int = 3) -> list[tuple[str, float]]:
    return sorted(scored.items(), key=lambda x: -x[1])[:k]


def grounded_generate(query: str, ranked: list[tuple[str, float]]) -> str:
    lines = [f"Answer for: '{query}'"]
    for i, (rid, score) in enumerate(ranked, 1):
        r = next(x for x in CORPUS if x.id == rid)
        lines.append(
            f"  {i}. {r.name} (score {score:.2f})"
            f" [review {rid}] [img tags {r.image_tags}] [ambient {r.ambient_db}dB]")
    return "\n".join(lines)


def agentic_loop(query: str, confidence_floor: float = 0.8) -> str:
    t = text_retrieve(query)
    i = image_retrieve(query)
    a = audio_retrieve(query)
    fused = fuse([t, i, a], [0.3, 0.4, 0.3])
    top = top_k(fused, k=3)
    confidence = top[0][1] if top else 0

    trace = [f"round 1: top={top[0]}  confidence={confidence:.2f}"]
    if confidence < confidence_floor:
        trace.append("  confidence low; reformulating query")
        query2 = query + " bright windows low noise"
        i2 = image_retrieve(query2)
        a2 = audio_retrieve(query2)
        fused = fuse([t, i2, a2], [0.3, 0.5, 0.2])
        top = top_k(fused, k=3)
        trace.append(f"round 2: top={top[0]}  confidence={top[0][1]:.2f}")
    return "\n".join(trace) + "\n\n" + grounded_generate(query, top)


def surveys_table() -> None:
    print("\n2025 MULTIMODAL RAG SURVEYS")
    print("-" * 60)
    rows = [
        ("Abootorabi et al.", "Feb 2025", "comprehensive taxonomy"),
        ("Mei et al.",        "Apr 2025", "sub-task benchmarks + failure modes"),
        ("Zhao et al.",       "Mar 2025", "vision-focused, strong on ColPali"),
    ]
    for name, date, note in rows:
        print(f"  {name:<22}{date:<10}{note}")


def main() -> None:
    print("=" * 60)
    print("MULTIMODAL RAG (Phase 12, Lesson 24)")
    print("=" * 60)

    query = "find me a quiet vegan brunch with natural light"
    print(f"\nQUERY: {query}")
    print("-" * 60)
    result = agentic_loop(query, confidence_floor=0.7)
    print(result)

    surveys_table()

    print("\nFUSION STRATEGIES")
    print("-" * 60)
    print("  score fusion : weighted sum, simple, fast")
    print("  MoE fusion   : gating routes to experts, learnable, trains")
    print("  attention    : small network weights retrieved items")
    print("  default: score fusion + slight bias toward dominant modality")


if __name__ == "__main__":
    main()
