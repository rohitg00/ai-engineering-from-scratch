---
name: card-audit
description: model card、datasheet、system card の completeness と verifiability を監査する。
version: 1.0.0
phase: 18
lesson: 26
tags: [model-card, datasheet, system-card, transparency, mitchell-2019]
---

model card、datasheet、system card が与えられたら、completeness、numerical disaggregation、verifiability を監査する。

作成するもの:

1. Section coverage。canonical section がすべて埋まっているか確認する。missing section を flag する。Ethical Considerations は model-card field の中で最も skip されやすい (Oreamuno et al. 2023)。
2. Quantitative disaggregation。evaluation metrics について、demographic または task factors にまたがる disaggregation があるかを報告する。aggregate-only metrics は allocational and representational harms を隠す。
3. Datasheet alignment。card が training data を参照する場合、companion datasheet (Gebru et al. 2018) は存在するか。model-card claims の強さは underlying datasheet に依存する。
4. Verifiable attestation。claims は cryptographic attestations (Laminator 2024, Duddu et al.) やその他の third-party verification で裏付けられているか。未検証の claim は self-report と label する。
5. Sustainability footprint。carbon / water / energy usage は報告されているか。2025年の emerging ISO / regulatory requirement。

Hard rejects:
- Ethical Considerations のない model card。
- datasheet または同等 documentation なしで dataset を引用する card。
- disaggregated metric reporting なしに「bias-tested」と主張する card。

Refusal rules:
- ユーザーが card が「good enough」かを尋ねたら、二値回答は拒否する。good-enough は audience と use case に依存する。
- ユーザーが auto-generated card を求めたら、CardGen-style (Liu et al. 2024) system と human review が使われる場合を除き拒否する。

出力: 5つの section を埋めた1ページの audit。missing content を flag し、最も urgent な addition を1つ名指しする。Mitchell et al. 2019 と Gebru et al. 2018 をそれぞれ一度引用する。
