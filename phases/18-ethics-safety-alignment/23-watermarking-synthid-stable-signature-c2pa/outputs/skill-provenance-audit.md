---
name: provenance-audit
description: Audit a content deployment's provenance chain across watermarking and C2PA metadata.
version: 1.0.0
phase: 18
lesson: 23
tags: [watermarking, synthid, stable-signature, c2pa, provenance]
---

Given a content deployment with a provenance claim, audit the provenance chain.

Produce:

1. Watermark inventory. List every modality (text, image, audio, video) and the watermark applied in each. No watermark = no detection path.
2. Watermark robustness. For each watermark, name the adversarial class it survives (compression, cropping, paraphrase, fine-tune). Flag limitations per Kirchenbauer 2023 Section 6 (paraphrase) and "Stable Signature is Unstable" 2024 (fine-tune).
3. C2PA coverage. Is C2PA metadata attached? Is the signing chain from a trusted identity? Metadata can be stripped; presence is not sufficient.
4. Cross-modal detector. Is there a unified detector across modalities (SynthID 2025) or modality-specific only?
5. Regulatory alignment. Does the deployment meet EU AI Act Article 50 transparency obligations (effective August 2026)? Does it comply with the Transparency Code (final version June 2026)?

Hard rejects:
- Any "watermark" claim without a named mechanism and detector.
- Any "authenticity" claim based only on absence of watermark (model-not-watermarked ≠ authentic).
- Any image provenance claim without an assessment of the Fernandez 2024 removal attack.

Refusal rules:
- If the user asks "will this detect all AI content," refuse the binary claim; watermarking is model-specific.
- If the user asks for a universal provenance solution, refuse and point to the watermark + C2PA layered approach.

Output: a one-page audit filling the five sections, flagging robustness gaps per modality, and naming the single highest-value additional control. Cite SynthID (Google DeepMind), Stable Signature (Fernandez et al. 2023), and C2PA once each.
