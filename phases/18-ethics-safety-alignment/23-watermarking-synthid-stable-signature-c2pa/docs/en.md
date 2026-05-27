# Watermarking — SynthID, Stable Signature, C2PA

> Three technologies structure 2026 AI-generated-content provenance. SynthID (Google DeepMind) — image watermarking launched August 2023, text+video May 2024 (Gemini + Veo), text open-sourced October 2024 via Responsible GenAI Toolkit, unified multi-media detector November 2025 alongside Gemini 3 Pro. Text watermarking adjusts next-token sampling probabilities imperceptibly; image/video watermarks survive compression, cropping, filters, frame-rate changes. Stable Signature (Fernandez et al., ICCV 2023, arXiv:2303.15435) — fine-tunes the latent diffusion decoder so every output contains a fixed message; cropped (10% of content) generated images detected >90% at FPR<1e-6. Follow-up "Stable Signature is Unstable" (arXiv:2405.07145, May 2024) — fine-tuning removes the watermark while preserving quality. C2PA — cryptographically signed, tamper-evident metadata standard (C2PA 2.2 Explainer 2025). Watermarking and C2PA are complementary: metadata can be stripped but carries richer provenance; watermarks persist through transcoding but carry less information.

**Type:** Build
**Languages:** Python (stdlib, token-watermark embed + detect)
**Prerequisites:** Phase 10 · 04 (sampling), Phase 01 · 09 (information theory)
**Time:** ~75 minutes

## Learning Objectives

- Describe token-level watermarking (SynthID-text style) and the mechanism by which it is detectable.
- Describe Stable Signature and the 2024 removal attack that broke it.
- State C2PA's role and why it is complementary to watermarking.
- Describe the key limitations: model-specific signal, robustness under paraphrase, and meaning-preserving attacks (arXiv:2508.20228).

## The Problem

2023-2024 saw deepfakes and AI-generated content enter political and consumer contexts at scale. Watermarking is the proposed technical provenance signal: mark generations at creation time, detect them later. 2025 evidence: no watermark is unconditionally robust, but layered with C2PA metadata the combination provides a usable provenance story.

## The Concept

### Text watermarking (SynthID-text style)

The Kirchenbauer et al. 2023 mechanism, productionized by Google:

1. At each decoding step, hash the previous K tokens to produce a pseudorandom partition of the vocabulary into "green" and "red" sets.
2. Bias sampling toward the green set by adding δ to green logits.
3. The generation contains more green tokens than chance would produce.

Detection: rehash each prefix, count green tokens in the generation, compute a z-score. The z-score is >0 for watermarked text, ~0 for human text.

Properties:
- Imperceptible to readers (δ is small enough that quality loss is minor).
- Detectable with access to the vocabulary partition function.
- Not robust to paraphrase — rewriting the text destroys the signal.

SynthID-text is open-sourced October 2024 via Google's Responsible GenAI Toolkit.

### Stable Signature (image)

Fernandez et al. ICCV 2023. Fine-tune the latent diffusion decoder so every generated image contains a fixed binary message embedded in the latent representation. Detection is decoded from the latent with a neural decoder. Cropped (to 10% of content) images detected >90% at FPR<1e-6.

May 2024 "Stable Signature is Unstable" (arXiv:2405.07145): fine-tuning the decoder removes the watermark while preserving image quality. Adversarial post-generation fine-tuning is cheap; the watermark's adversarial robustness is limited.

### SynthID unified detector (November 2025)

Alongside Gemini 3 Pro: a multi-media detector that reads SynthID signals from text, image, audio, and video in one API. Unifies the Google provenance stack.

### C2PA

Coalition for Content Provenance and Authenticity. Cryptographically signed tamper-evident metadata standard. C2PA 2.2 Explainer (2025). A C2PA manifest records provenance claims (who created, when, what transformations) signed by the creator's key.

Complementary to watermarking:
- Metadata can be stripped; watermarks cannot (easily).
- Metadata is rich (full provenance chain); watermarks carry bits.
- C2PA depends on platform adoption; watermarks embed automatically.

Google integrates both in Search, Ads, and "About this image."

### Limitations

- **Model-specific.** SynthID watermarks generations from SynthID-enabled models. A generation from a model without SynthID is not watermarked, so "no SynthID signal" is not proof of authenticity.
- **Paraphrase.** Text watermarks do not survive meaning-preserving paraphrase.
- **Transformation attacks.** arXiv:2508.20228 (2025) shows meaning-preserving attacks that destroy both text watermarks and many image watermarks.
- **Fine-tune removal.** Per "Stable Signature is Unstable," post-generation fine-tuning removes embedded watermarks.

### EU AI Act Article 50

Transparency Code for AI-generated content labeling (first draft December 2025, second draft March 2026, expected final June 2026 per the [European Commission status page](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)). The Code remains in draft as of April 2026 and the timeline is subject to change. The regulatory layer that requires the technical layer. Deepfakes must be labeled.

### Where this fits in Phase 18

Lessons 22-23 are about what the model emits (private data, provenance signal). Lesson 27 covers training-data governance. Lesson 24 is the regulatory framework that requires these technical measures.

## Use It

`code/main.py` builds a toy text watermark. Tokens are integers 0..N-1; watermarked sampling biases toward the hash-defined green set. A detector computes the green-token z-score. You can observe detection at 1000-token generations, watch paraphrase destroy the signal, and measure the false-positive rate on human text.

## Ship It

This lesson produces `outputs/skill-provenance-audit.md`. Given a content deployment with a provenance claim, it audits: the watermark mechanism (if any), the C2PA signing chain (if any), the adversarial robustness of each, and the per-modality coverage.

## Exercises

1. Run `code/main.py`. Report z-scores for watermarked 1000-token generation vs human-authored text. Identify the false-positive rate at the 95% confidence threshold.

2. Implement a paraphrase attack that replaces 30% of tokens with synonyms. Re-measure the z-score.

3. Read Kirchenbauer et al. 2023 Section 6 on robustness. Why do text watermarks fail under paraphrase but image watermarks survive cropping?

4. Design a deployment that uses SynthID-text + C2PA metadata. Describe the provenance chain a consumer sees. Identify one failure mode of each component.

5. The 2024 "Stable Signature is Unstable" result shows fine-tuning removes the image watermark. Design a deployment control that limits this attack — for example, require signed releases of fine-tuned checkpoints.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SynthID | "Google's watermark" | Cross-modal provenance signal; text, image, audio, video |
| Token watermark | "Kirchenbauer-style" | Biased-sampling text watermark detectable via green-token z-score |
| Stable Signature | "image watermark" | Fine-tuned-decoder watermark; ICCV 2023 |
| C2PA | "the metadata standard" | Cryptographically signed tamper-evident provenance metadata |
| Paraphrase robustness | "does rewording break it" | Text watermark property; currently limited |
| Fine-tune removal | "adversarial unwatermark" | Attack that removes image watermark via decoder fine-tuning |
| Cross-modal detector | "unified SynthID" | November 2025 unified API across modalities |

## Further Reading

- [Kirchenbauer et al. — A Watermark for Large Language Models (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226) — the token-watermark mechanism
- [Fernandez et al. — Stable Signature (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435) — image watermark paper
- ["Stable Signature is Unstable" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145) — the removal attack
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/) — the cross-modal watermark
- [C2PA 2.2 Explainer (2025)](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) — metadata standard
