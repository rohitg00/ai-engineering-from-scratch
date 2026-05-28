# Regulatory Frameworks — EU, US, UK, Korea

> 2026年の AI governance landscape は4つの主要な regulatory regime で定義される。EU AI Act (2024年8月1日 in force) — prohibited practices と AI literacy は 2025年2月2日から、GPAI obligations は 2025年8月2日から、full applicability と Article 50 transparency は 2026年8月2日から、legacy GPAI と embedded high-risk systems は 2027年8月2日から。penalties は最大 15M EUR または global turnover の3%。GPAI Code of Practice (2025年7月10日): 3 chapters — Transparency, Copyright, Safety and Security — 12 commitments。enforcement は 2026年8月開始。UK AISI -> AI Security Institute (2025年2月): rename は scope の narrowing を示す。US AISI -> CAISI (2025年6月): NIST 下の Center for AI Standards and Innovation。pro-growth posture への shift。Korean AI Framework Act (2024年12月 passed、2026年1月 effective): Article 12 は MSIT 下に AISI を設立し、foreign AI companies の local representatives、risk assessment、high-impact AI と generative AI の safety measures を義務付ける。

**種別:** 学習
**言語:** なし
**前提条件:** Phase 18 · 18 (frontier frameworks), Phase 18 · 27 (data governance)
**所要時間:** 約75分

## Learning Objectives

- EU AI Act の risk tiers (prohibited, high-risk, general-purpose, limited-risk) と 2025年8月 / 2026年8月 / 2027年8月の timeline を説明する。
- GPAI Code of Practice の3 chapters と、それぞれがどの providers を bind するかを説明する。
- 2025年の rebrands: UK AISI -> AI Security Institute、US AISI -> CAISI と、それぞれが policy direction について何を示すかを説明する。
- Korea's AI Framework Act の core provision を述べる。

## 問題

Lab frameworks (Lesson 18) は voluntary である。Regulatory frameworks は compulsory である。2024-2026年には comprehensive AI regulation の first wave が施行された。deployers は technical controls を regulatory obligations に map しなければならない。その mapping は jurisdiction ごとに異なる。

## The Concept

### EU AI Act

**2024年8月1日 in force。** Risk-tier structure:

- **Prohibited practices** (Article 5)。Social scoring、公衆空間での real-time remote biometric identification (law-enforcement exceptions あり)、vulnerable groups の exploitative manipulation。2025年2月2日適用。
- **High-risk systems** (Annex III)。Employment、education、credit、law enforcement、justice、migration。conformity assessment、risk management、logging、transparency が必要。
- **General-Purpose AI (GPAI) models**。2025年8月2日適用。すべての GPAI providers に obligations があり、systemic-risk GPAI (>1e25 FLOP training compute) には追加 obligations がある。
- **Limited-risk systems**。Article 50 に基づく transparency obligations (AI-generated content labelling)。2026年8月2日適用。

Timeline:
- 2025年2月2日: prohibited practices + AI literacy。
- 2025年8月2日: GPAI + governance。
- 2026年8月2日: full applicability + Article 50 transparency + penalties 最大 15M EUR / global turnover の3%。
- 2027年8月2日: legacy GPAI + embedded high-risk。

Commission は 2025年後半に high-risk timeline を16か月へ調整する案を出した。

### GPAI Code of Practice

2025年7月10日公開。3 chapters:

- **Transparency.** すべての GPAI providers。
- **Copyright.** すべての GPAI providers。
- **Safety and Security.** Systemic-risk GPAI providers (推定 5-15 companies)。

合計12 commitments。AI Office が議長を務める Signatory Taskforce が implementation を管理する。Enforcement は 2026年8月2日開始。それまでは good-faith compliance が受け入れられる。

### Transparency Code for Article 50

First draft 2025年12月17日。Second draft 2026年3月。Final version 2026年6月。deepfakes を含む AI-generated content labelling を扱う。これは Lesson 23 の watermarking technology を要求する regulatory layer である。

### UK AI Security Institute (February 2025)

AI Safety Institute から rename。rebrand は scope を狭める。algorithmic bias と free-speech framing を落とし、frontier capability security に focus する。Inspect evaluation tool を open-sourced (2024年5月)。control safety cases で Redwood (Lesson 10) と collaborate する。

### US CAISI (June 2025)

Trump administration は NIST の AI Safety Institute を Center for AI Standards and Innovation に変えた。VP Vance の Paris AI Action Summit remarks によれば "pro-growth AI policies" への shift。pre-deployment evaluation の emphasis は弱まり、standards と innovation support を重視する。EU AI Act の regulatory posture に対する国内 counterweight。

### Korean AI Framework Act

2024年12月 passed。2025年1月 enacted。2026年1月 effective。19本の個別 AI bill を統合。

Article 12 は Ministry of Science and ICT (MSIT) 下に AISI を設立する。義務:
- Korea で活動する foreign AI companies の local representatives。
- "high-impact" AI systems の risk assessment。
- generative AI と high-impact AI の safety measures。

comprehensive horizontal AI regulation を持つ最初の Asian jurisdiction。

### Cross-jurisdiction dynamics

- EU: strict、risk-tiered、heavy penalties。privacy-adjacent regulation の benchmark。
- US: innovation-favouring、decentralized、states (e.g., California AB 2013 — Lesson 27) が federal gaps を埋める。
- UK: narrow security focus、strong evaluation infrastructure。
- Korea: MSIT-led、foreign-provider-focused。

競合する regulatory philosophies。複数 jurisdictions で deploy する事業者は最も strict な rule に comply する必要があり、2026年では通常 EU AI Act がそれに当たる。

### Where this fits in Phase 18

Lesson 18 は lab-voluntary governance。Lesson 24 は regulatory。Lesson 25 は AI systems に対する emerging CVEs。Lessons 26-27 は documentation (cards) と training-data governance を扱う。

## Use It

コードはない。EU AI Act primary sources、regulation text、GPAI Code of Practice、UK AISI Inspect framework を読む。自分の deployment を jurisdiction ごとの applicable obligations に map する。

## Ship It

この lesson では `outputs/skill-regulatory-map.md` を作る。deployment description が与えられたとき、applicable jurisdictions、各 jurisdiction の tier classifications、per-jurisdiction obligations、deadline structure を map する。

## Exercises

1. EU AI Act (regulation 2024/1689) と GPAI Code of Practice (2025年7月10日) を読む。すべての GPAI providers に適用される obligations を3つ、systemic-risk GPAI にのみ適用される obligations を3つ特定する。

2. deployment は US company が作り、EU infrastructure 上で動き、Korean users に提供されている。どの3つの jurisdictions の rules が適用され、各 substantive question でどの rule が bind するか。

3. UK AI Security Institute の rename は scope を狭める。その narrower framing への賛成と反対を論じる。それぞれの立場が依存する policy assumption を特定する。

4. CAISI の "pro-growth" framing は 2022-2024年の AI safety institute model からの departure である。この framing から生じる measurable policy shifts を2つ特定する。

5. Korea's AI Framework Act は foreign providers に local representatives を要求する。Korean users にサービスを提供する Bay Area company にとっての operational implications を説明する。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| EU AI Act | 「the regulation」 | risk-tier-based な horizontal AI regulation。2024年8月 in force |
| GPAI | 「general-purpose AI」 | large foundation models。systemic-risk subset には追加 obligations |
| Article 50 | 「transparency obligations」 | AI-generated content labelling。2026年8月適用 |
| UK AISI | 「AI Security Institute」 | 2025年2月 rename。より narrow な frontier-security focus |
| CAISI | 「US center for AI standards」 | 2025年6月に AI Safety Institute から rename。pro-growth posture |
| Korean AI Framework Act | 「MSIT horizontal regulation」 | Asia 初の comprehensive AI law。2026年1月 effective |
| Systemic-risk GPAI | 「1e25 FLOP threshold」 | 追加 obligations tier。推定 5-15 companies が bound |

## 参考文献

- [EU AI Act text (Regulation 2024/1689)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) — regulation と timeline
- [GPAI Code of Practice (10 July 2025)](https://digital-strategy.ec.europa.eu/en/library/final-version-general-purpose-ai-code-practice) — three-chapter code
- [UK AI Security Institute (renamed Feb 2025)](https://www.gov.uk/government/organisations/ai-security-institute) — official page
- [CSET — South Korea AI Framework Act Analysis (2025)](https://cset.georgetown.edu/publication/south-korea-ai-law-2025/) — Korean framework analysis
