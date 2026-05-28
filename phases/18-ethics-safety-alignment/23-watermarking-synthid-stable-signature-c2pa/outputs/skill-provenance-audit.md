---
name: provenance-audit
description: watermarking と C2PA metadata をまたいで content deployment の provenance chain を監査する。
version: 1.0.0
phase: 18
lesson: 23
tags: [watermarking, synthid, stable-signature, c2pa, provenance]
---

provenance claim を持つ content deployment が与えられたら、provenance chain を監査する。

作成するもの:

1. Watermark inventory。各 modality (text, image, audio, video) と、それぞれに適用された watermark を列挙する。watermark がないなら detection path はない。
2. Watermark robustness。各 watermark について、どの adversarial class に耐えるかを名指しする (compression, cropping, paraphrase, fine-tune)。Kirchenbauer 2023 Section 6 (paraphrase) と "Stable Signature is Unstable" 2024 (fine-tune) に従って limitation を flag する。
3. C2PA coverage。C2PA metadata は付与されているか。signing chain は trusted identity から始まるか。Metadata は削除され得るため、存在するだけでは十分ではない。
4. Cross-modal detector。modalities 横断の unified detector (SynthID 2025) があるか、それとも modality-specific のみか。
5. Regulatory alignment。deployment は EU AI Act Article 50 transparency obligations (2026年8月有効) を満たすか。Transparency Code (final version 2026年6月) に準拠しているか。

Hard rejects:
- named mechanism と detector のない「watermark」claim。
- watermark がないことだけに基づく「authenticity」claim (model-not-watermarked ≠ authentic)。
- Fernandez 2024 removal attack の assessment がない image provenance claim。

Refusal rules:
- ユーザーが「これはすべての AI content を detect するか」と尋ねたら、二値の claim は拒否する。watermarking は model-specific である。
- ユーザーが universal provenance solution を求めたら拒否し、watermark + C2PA の layered approach を指す。

出力: 5つの section を埋めた1ページの監査。modality ごとの robustness gap を flag し、最も価値の高い追加 control を1つ名指しする。SynthID (Google DeepMind)、Stable Signature (Fernandez et al. 2023)、C2PA をそれぞれ一度引用する。
