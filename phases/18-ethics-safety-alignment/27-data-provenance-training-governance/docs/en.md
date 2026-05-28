# Data Provenance and Training-Data Governance

> EU AI Act は GPAI について 2025年8月までに machine-readable opt-out standards を要求する (EU Copyright Directive TDM exception 経由)。California AB 2013 (2024年 signed) — Generative AI training-data transparency は、developers に 12 mandated fields を持つ dataset summary の公開を要求する。2025年の DPA alignment on legitimate interest: Irish DPC (2025年5月21日) は EDPB opinion 後、safeguards 付きで Meta の first-party public EU/EEA adult content による LLM training を受け入れた。Cologne Higher Regional Court (2025年5月23日) は injunction を dismissed。Hamburg DPA は urgency を drop。UK ICO (2025年9月23日) は LinkedIn の AI-training safeguards (transparency、simplified opt-out、extended objection windows) に positive regulatory response を出し、monitoring を継続 — formal clearance ではない。Brazilian ANPD (2024年7月2日) は insufficient information transparency を理由に Meta の processing を suspended。preventive measure は Meta が compliance plan を提出した後、2024年8月30日に lifted。重要な irreversibility problem: cookie-consent frameworks は real-time かつ reversible な tracking を想定している。data が model weights に入ると surgical erasure は不可能であり、trained neural networks に practical な GDPR right-to-erasure はない。compliance window は collection time にある。Data Provenance Initiative (dataprovenance.org, Longpre, Mahari, Lee et al., "Consent in Crisis", 2024年7月): 大規模 audit は、publishers が robots.txt restrictions を追加するにつれて AI data commons が急速に縮小していることを示す。

**種別:** 学習
**言語:** Python (stdlib, 12-field California AB 2013 scaffolding generator)
**前提条件:** Phase 18 · 24 (regulatory), Phase 18 · 26 (cards)
**所要時間:** 約60分

## Learning Objectives

- Generative AI training-data transparency に関する California AB 2013 の 12 mandated fields を説明する。
- legitimate-interest LLM training に関する 2025年の DPA position (Irish DPC, UK ICO, Hamburg, Cologne) を述べる。
- irreversibility problem、つまり GDPR right-to-erasure に trained neural networks の practical equivalent がない理由を説明する。
- Data Provenance Initiative の "Consent in Crisis" finding を述べる。

## 問題

Training-data governance は、すべての model card (Lesson 26) と regulatory obligation (Lesson 24) の upstream である。2024-2025年、regulatory landscape は3つの principle に収束した: opt-out infrastructure、per-dataset disclosure、publicly available data に対する legitimate-interest accommodations。collection time に comply しない providers は downstream で remediation できない。

## The Concept

### California AB 2013

2024年 signed。2022年1月1日以降に released された systems について、2026年1月1日までに documentation を posted しなければならない。Section 3111(a) は developers に、training に使った datasets の high-level summary を12の statutory items 付きで公開することを要求する:
1. datasets の sources または owners。
2. datasets が AI system の intended purpose をどのように further するかの description。
3. datasets 内の data points 数 (general ranges 可。dynamic datasets は estimates)。
4. data points の types の description (labeled datasets は label types、unlabeled は general characteristics)。
5. datasets が copyright、trademark、patent で protected な data を含むか、または完全に public domain か。
6. datasets が purchased または licensed されたか。
7. datasets が personal information (Cal. Civ. Code §1798.140(v)) を含むか。
8. datasets が aggregate consumer information (Cal. Civ. Code §1798.140(b)) を含むか。
9. developer による cleaning、processing、その他 modification と intended purpose。
10. data が collected された time period。collection が ongoing の場合は notice。
11. development 中に datasets が最初に使われた dates。
12. system が synthetic data generation を使う、または継続的に使うか。

Item 12 (synthetic data) は Gebru et al. 2018 datasheets に対して新しい。Item 7 (personal information) は Privacy Rights Act (CPRA) obligations を trigger する。この statute は security/integrity、aircraft-operation、federal-only national-security systems を exempt する (Section 3111(b))。

### EU AI Act (Lesson 24) and TDM opt-out

EU Copyright Directive の text-and-data-mining exception は、rightholder が opt out しない限り publicly available content で training することを許す。EU AI Act GPAI Code of Practice Copyright chapter は GPAI providers に machine-readable opt-out signals (robots.txt, C2PA "No AI Training" claim など) を尊重することを要求する。

### 2025 DPA convergence on legitimate interest

Irish DPC (2025年5月21日): EDPB opinion 後、Meta が first-party public EU/EEA adult-user content で training する plan を safeguards 付きで受け入れた。Cologne Higher Regional Court (2025年5月23日) は Meta に対する injunction を dismissed: opt-out は sufficient。Hamburg DPA は EU-wide consistency のため urgency procedure を drop。UK ICO (2025年9月23日) は LinkedIn の similar safeguards と ongoing monitoring の下での AI training 再開に positive regulatory response を出した。ただし formal clearance ではない。

Convergent principle: legitimate interest は opt-out 付きで publicly available first-party content による training を justify し得る。consent は required ではない。

### Brazilian ANPD (June 2024)

AI training のための Brazilian user data processing について、information transparency が不十分として Meta の processing を suspended。EU DPAs とは異なる結果であり、ANPD は legitimate-interest admissibility より transparency を優先した。

### The irreversibility problem

Cookie-consent は real-time かつ reversible な tracking を想定して設計された。Training data は違う。data が model weights に入ると surgical erasure はできない。complete remediation は retraining from scratch だけであり、prohibitively expensive である。

Partial remediations:
- **Unlearning.** approximate removal。MIA で測定する (Lesson 22)。
- **Influence function-based localization.** data に最も影響された weights を特定し、selectively update する。
- **Fine-tune-suppression.** その data 由来の outputs を refuse するよう model を train する。

どれも完全な solution ではない。compliance window は collection time にある。

### Data Provenance Initiative

dataprovenance.org。Longpre, Mahari, Lee et al. "Consent in Crisis" (2024年7月): AI training data commons の大規模 audit。Finding: publishers は加速的に robots.txt restrictions を追加している。openly-trainable-upon commons は急速に縮小している。2023 -> 2024 で、top training sources の約25%が何らかの restriction を追加した。Implication: future training-data availability は新しい acquisition paradigms (licensing, synthetic generation, incentivized participation) に依存する。

### Where this fits in Phase 18

Lesson 26 は model-level documentation。Lesson 27 は dataset-level governance。両方で transparency layer を定義する。Lesson 28 はこれらの問題に取り組む research ecosystem を map する。

## Use It

`code/main.py` は toy dataset の California AB 2013-compliant な 12-field dataset summary scaffold を生成する。fields を埋め、どの項目が privacy や copyright の follow-on obligations を trigger するかを観察できる。

## Ship It

この lesson では `outputs/skill-provenance-check.md` を作る。training に使われた dataset が与えられたとき、AB 2013 の 12-field coverage、opt-out infrastructure compliance、DPA alignment、irreversibility-risk assessment を確認する。

## Exercises

1. `code/main.py` を実行する。toy dataset の 12-field summary を作成し、under-specified な fields を特定する。

2. EU Copyright Directive TDM opt-out は machine-readable である。opt-out signal の standard format を提案し、robots.txt と C2PA "No AI Training" と比較する。

3. Data Provenance Initiative の "Consent in Crisis" (2024年7月) を読む。最も速く restricting されている content categories を3つ説明し、経済的 consequence を1つ論じる。

4. 2025年の DPA alignment は public-content training に対する legitimate interest を受け入れる。legitimate interest では不十分な scenario を構成し、provider が代わりに必要とする legal basis を特定する。

5. AB 2013 fields と各 dataset の C2PA-signed provenance chain と compose する training-data-provenance manifest を sketch する。technical barrier と legal barrier を1つずつ特定する。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AB 2013 | 「California law」 | Generative AI training-data transparency。12 mandated fields |
| TDM exception | 「text-and-data-mining」 | opt-out 付きの EU Copyright Directive training-data exception |
| Legitimate interest | 「EU basis」 | public content での training を justify し得る GDPR Article 6 basis |
| Opt-out signal | 「machine-readable no-train」 | robots.txt, C2PA "No AI Training," TDM.Reservation |
| Irreversibility | 「un-train できない」 | model weights 内の data は surgical に除去できない |
| Unlearning | 「approximate removal」 | specific data への model dependence を減らす post-training interventions |
| Consent in Crisis | 「DPI audit」 | robots.txt restrictions が加速しているという 2024年7月の finding |

## 参考文献

- [California AB 2013](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2013) — Generative AI training-data transparency law
- [EU AI Act + GPAI Code of Practice (Lesson 24)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) — Copyright chapter
- [Longpre, Mahari, Lee et al. — Consent in Crisis (dataprovenance.org, July 2024)](https://www.dataprovenance.org/consent-in-crisis-paper) — DPI audit
- [IAPP — EU Digital Omnibus GDPR amendments (2025)](https://iapp.org/news/a/eu-digital-omnibus-amendments-to-gdpr-to-facilitate-ai-training-miss-the-mark) — regulatory context
