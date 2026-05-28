# Model, System, and Dataset Cards

> AI transparency は3つの documentation format で整理される。Model Cards (Mitchell et al. 2019) — models の nutrition labels: training data、quantitative disaggregated analyses、ethical considerations、caveats。Hugging Face model cards のうち ethical considerations を document するものは 0.3% のみ (Oreamuno et al. 2023)。Datasheets for Datasets (Gebru et al. 2018, CACM) — motivation、composition、collection process、labeling、distribution、maintenance。electronics-datasheet analogy。Data Cards (Pushkarna et al., Google 2022) — 多様な読者のための boundary objects として modular layered detail (telescopic, periscopic, microscopic)。2024-2025 developments: LLM による automated generation (CardGen, Liu et al. 2024)。model-card detail は HF で最大 29% の download increase と相関 (Liang et al. 2024)。verifiable attestations (Laminator, Duddu et al. 2024)。carbon/water の sustainability reporting additions (Jouneaux et al. 2025年7月)。EU/ISO regulatory cards の emerging。System Cards (Sidhpurwala 2024; Meta system-level transparency; "Blueprints of Trust" arXiv:2509.20394) — security capabilities、prompt-injection protection、data-exfiltration detection、human values との alignment を含む end-to-end AI system documentation。

**種別:** 構築
**言語:** Python (stdlib, model-card + datasheet + system-card generator)
**前提条件:** Phase 18 · 18 (safety frameworks), Phase 18 · 24 (regulatory)
**所要時間:** 約60分

## Learning Objectives

- Mitchell et al. 2019 の original model card と Gebru et al. 2018 の datasheet を説明する。
- Data Cards の telescopic/periscopic/microscopic layering を説明する。
- System Cards とその end-to-end coverage を説明する。
- 2024-2025 developments を3つ述べる (automated generation、verifiable attestations、sustainability reporting)。

## 問題

Regulatory frameworks (Lesson 24) と lab safety policies (Lesson 18) はどちらも documentation を要求する。Documentation formats は model-specific (model cards) から dataset-specific (datasheets)、system-specific (system cards) へ進化した。それぞれが transparency の異なる scope を扱う。2024-2025年の automation と verifiable-attestation の work は、長年の adoption problem に対処する。

## The Concept

### Model Cards (Mitchell et al. 2019)

Sections:
- Model details。
- Intended use。
- Factors (evaluation に関連する demographic または environmental factors)。
- Metrics。
- Evaluation data。
- Training data。
- Quantitative analyses (factors ごとの disaggregation)。
- Ethical considerations。
- Caveats and recommendations。

Adoption problem: Oreamuno et al. 2023 による Hugging Face model cards の audit では、ethical considerations を document しているものは 0.3% のみだった。

### Datasheets for Datasets (Gebru et al. 2018)

Electronics-datasheet analogy。Sections:
- Motivation (dataset が作られた理由)。
- Composition (何が含まれるか)。
- Collection process (どのように assembled されたか)。
- Labeling (該当する場合)。
- Uses (intended, prohibited, risks)。
- Distribution。
- Maintenance。

CACM 2021 に掲載。datasheet は upstream documentation であり、model card は datasheet が正確であることに依存する。

### Data Cards (Pushkarna et al., Google 2022)

Modular layered detail。3つの zoom level:
- **Telescopic.** non-experts 向け high-level summary。
- **Periscopic.** ML practitioners 向け middle-level overview。
- **Microscopic.** auditors 向け detailed feature-level documentation。

Boundary-object framing: 異なる readers が同じ document から異なる information を取り出す。

### System Cards

Scope: model + safety stack + deployment context を含む end-to-end AI system。典型 sections:
- Security capabilities。
- Prompt-injection protection。
- Data-exfiltration detection。
- stated human values との alignment。
- Incident response。

Sidhpurwala 2024 と Meta system-level transparency work。"Blueprints of Trust" (arXiv:2509.20394) は System Card を Model Cards に対する deployment-layer complement として formalize する。

### 2024-2025 developments

- **CardGen (Liu et al. 2024).** LLM による automated model-card generation。standardized Mitchell 2019 fields で、多くの human-authored cards より高い objectivity を報告。
- **Download correlation (Liang et al. 2024).** detailed model cards は HF で最大 29% 高い download rates と相関。adoption pressure は compliance-driven だけでなく market-driven になっている。
- **Laminator (Duddu et al. 2024).** hardware TEE / cryptographic signatures による verifiable attestations。model card が単なる claim ではなく proof-of-claim を持てる。
- **Sustainability (Jouneaux et al. July 2025).** carbon、water、compute-energy footprint の additions。emerging ISO standards。
- **Regulatory cards.** EU AI Act (Lesson 24) GPAI Code of Practice Transparency chapter は model cards を compliance artifact として要求する。

### Where this fits in Phase 18

Lessons 24-25 は regulatory layer と CVE layer。Lesson 26 は documentation layer。Lesson 27 は datasheet の upstream である training-data governance。Lesson 28 は cards が参照する evaluations を生む research ecosystem を扱う。

## Use It

`code/main.py` は toy deployment の minimal model card、datasheet、system card を生成する。それぞれ canonical section structure に従う。format を inspect し、3つの scope を比較できる。

## Ship It

この lesson では `outputs/skill-card-audit.md` を作る。model card、datasheet、system card が与えられたとき、section coverage、numerical disaggregation、verifiable attestations の有無を監査する。

## Exercises

1. `code/main.py` を実行する。生成された cards を inspect する。弱い section (placeholder-only) を特定し、それを強める evidence を指定する。

2. 2つの demographic groups にまたがる quantitative disaggregated analysis で model card を拡張する (Lesson 20)。

3. Oreamuno et al. 2023 の 0.3% adoption rate を読む。ethical-considerations adoption を増やす model card specification の structural change を1つ提案する。

4. Laminator (Duddu et al. 2024) は TEEs を verifiable attestations に使う。evaluation result の cryptographic attestation を運ぶ model-card field を設計し、verifier の役割を説明する。

5. 過去の自分の project または hypothetical deployment について System Card (Model Card ではなく System Card) を書く。third-party auditors にとって最も価値の高い section を特定する。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Model Card | 「Mitchell card」 | ML models のための Mitchell et al. 2019 standard documentation |
| Datasheet | 「Gebru datasheet」 | datasets のための Gebru et al. 2018 standard documentation |
| Data Card | 「Pushkarna card」 | Google 2022 の modular layered data documentation |
| System Card | 「deployment card」 | safety stack を含む end-to-end AI system documentation |
| Boundary object | 「異なる readers、1つの doc」 | Data Cards の framing。同じ document が多様な audiences に役立つ |
| Verifiable attestation | 「Laminator attestation」 | documentation claim に付与される cryptographic または TEE proof |
| Sustainability field | 「carbon / water footprint」 | environmental accounting のための 2025年 emerging addition |

## 参考文献

- [Mitchell et al. — Model Cards for Model Reporting (arXiv:1810.03993, FAT* 2019)](https://arxiv.org/abs/1810.03993) — canonical model card
- [Gebru et al. — Datasheets for Datasets (CACM 2021, arXiv:1803.09010)](https://arxiv.org/abs/1803.09010) — datasheet paper
- [Pushkarna et al. — Data Cards (Google 2022)](https://arxiv.org/abs/2204.01075) — layered data documentation
- [Sidhpurwala et al. — Blueprints of Trust (arXiv:2509.20394)](https://arxiv.org/abs/2509.20394) — System Card formalization
