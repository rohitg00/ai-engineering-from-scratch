"""CLIP / SigLIP contrastive loss toy — stdlib Python.

Implements InfoNCE (softmax) and sigmoid pairwise loss on a hand-constructed
similarity matrix. Also runs a tiny zero-shot-classification walkthrough using
synthetic image and text embeddings.

No numpy. No torch. The point is to see the loss math and the argmax pattern.
"""

from __future__ import annotations

import math
import random


def normalize(v: list[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def similarity_matrix(images: list[list[float]],
                      texts: list[list[float]],
                      tau: float) -> list[list[float]]:
    I = [normalize(v) for v in images]
    T = [normalize(v) for v in texts]
    N = len(I)
    S = [[0.0] * N for _ in range(N)]
    for i in range(N):
        for j in range(N):
            S[i][j] = cosine(I[i], T[j]) / tau
    return S


def log_sum_exp(row: list[float]) -> float:
    m = max(row)
    return m + math.log(sum(math.exp(x - m) for x in row))


def infonce_loss(S: list[list[float]]) -> float:
    """Symmetric InfoNCE over rows and columns."""
    N = len(S)
    loss_i2t = 0.0
    for i in range(N):
        loss_i2t += -S[i][i] + log_sum_exp(S[i])
    loss_t2i = 0.0
    for j in range(N):
        col = [S[i][j] for i in range(N)]
        loss_t2i += -S[j][j] + log_sum_exp(col)
    return (loss_i2t + loss_t2i) / (2 * N)


def sigmoid(x: float) -> float:
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


def sigmoid_loss(S: list[list[float]], bias: float = 0.0) -> float:
    """SigLIP-style per-pair BCE. Positives are the diagonal."""
    N = len(S)
    total = 0.0
    count = 0
    for i in range(N):
        for j in range(N):
            logit = S[i][j] + bias
            y = 1.0 if i == j else 0.0
            p = sigmoid(logit)
            eps = 1e-9
            term = y * math.log(p + eps) + (1 - y) * math.log(1 - p + eps)
            total += -term
            count += 1
    return total / count


def zero_shot_classify(image: list[float],
                       class_texts: dict[str, list[float]]) -> list[tuple[str, float]]:
    """Argmax cosine similarity over class prompts."""
    img = normalize(image)
    scores = []
    for name, vec in class_texts.items():
        scores.append((name, cosine(img, normalize(vec))))
    scores.sort(key=lambda p: p[1], reverse=True)
    return scores


def make_fake_embedding(seed: int, dim: int = 64) -> list[float]:
    rng = random.Random(seed)
    return [rng.gauss(0, 1) for _ in range(dim)]


def demo_infonce() -> None:
    print("\nDEMO 1: InfoNCE on 4 aligned pairs")
    print("-" * 60)
    images = [make_fake_embedding(i) for i in range(4)]
    texts = [[x + 0.05 * make_fake_embedding(i + 100)[k] for k, x in enumerate(v)]
             for i, v in enumerate(images)]

    for tau in (0.07, 0.1, 1.0):
        S = similarity_matrix(images, texts, tau=tau)
        loss = infonce_loss(S)
        slip = sigmoid_loss(S)
        print(f"  tau={tau:4.2f}  InfoNCE={loss:.4f}  SigLIP={slip:.4f}")


def demo_shuffled() -> None:
    print("\nDEMO 2: what happens with misaligned pairs")
    print("-" * 60)
    images = [make_fake_embedding(i) for i in range(6)]
    texts = [make_fake_embedding(i + 500) for i in range(6)]
    S = similarity_matrix(images, texts, tau=0.07)
    loss = infonce_loss(S)
    slip = sigmoid_loss(S)
    print(f"  misaligned: InfoNCE={loss:.4f}  SigLIP={slip:.4f}")
    aligned_imgs = [make_fake_embedding(i) for i in range(6)]
    aligned_txt = [[x + 0.02 for x in v] for v in aligned_imgs]
    S2 = similarity_matrix(aligned_imgs, aligned_txt, tau=0.07)
    print(f"  aligned   : InfoNCE={infonce_loss(S2):.4f}  "
          f"SigLIP={sigmoid_loss(S2):.4f}")
    print("  aligned loss < misaligned loss confirms the gradient signal.")


def demo_zero_shot() -> None:
    print("\nDEMO 3: zero-shot classification")
    print("-" * 60)
    classes = {
        "cat": make_fake_embedding(42),
        "dog": make_fake_embedding(43),
        "bird": make_fake_embedding(44),
        "car": make_fake_embedding(45),
    }
    query_image = [c + 0.3 * make_fake_embedding(999)[i]
                   for i, c in enumerate(classes["dog"])]

    ranked = zero_shot_classify(query_image, classes)
    print("  query image (close to 'dog' prototype):")
    for name, score in ranked:
        print(f"    {name:6s}: {score:+.4f}")
    print(f"  top-1: {ranked[0][0]}")


def demo_prompt_ensemble() -> None:
    print("\nDEMO 4: prompt template ensemble")
    print("-" * 60)
    templates = [
        "a photo of a {class}",
        "a picture of a {class}",
        "an image of a {class}",
    ]
    class_name = "golden retriever"
    ensemble_vec = [0.0] * 64
    count = 0
    for t in templates:
        prompt = t.format(**{"class": class_name})
        seed = sum(ord(c) for c in prompt)
        emb = make_fake_embedding(seed)
        for k in range(64):
            ensemble_vec[k] += emb[k]
        count += 1
    ensemble_vec = [x / count for x in ensemble_vec]
    print(f"  ensembled {count} prompts for '{class_name}'")
    print(f"  first 6 dims: {[round(x, 3) for x in ensemble_vec[:6]]}")
    print("  single-template: noisier; ensemble: +1-3 points on real benchmarks.")


def main() -> None:
    print("=" * 60)
    print("CLIP / SIGLIP CONTRASTIVE TRAINING (Phase 12, Lesson 02)")
    print("=" * 60)
    demo_infonce()
    demo_shuffled()
    demo_zero_shot()
    demo_prompt_ensemble()
    print("\n" + "=" * 60)
    print("TAKEAWAYS")
    print("-" * 60)
    print("  · InfoNCE penalizes rows AND columns (symmetric)")
    print("  · Lower tau -> sharper softmax -> more hard-negative pressure")
    print("  · Sigmoid loss decouples pairs -> no all-gather in distributed runs")
    print("  · Zero-shot = argmax cos(image, prompt) over class prompts")


if __name__ == "__main__":
    main()
