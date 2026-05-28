# Alignment Research Ecosystem — MATS, Redwood, Apollo, METR

> 2026年の non-lab alignment research layer は5つの organisations で定義される。MATS (ML Alignment & Theory Scholars): 2021年後半以降 527+ researchers、180+ papers、10K+ citations、h-index 47。2024年 summer cohort は 501(c)(3) として incorporated され、約90 scholars と40 mentors。pre-2025 alumni の80%は safety/security に従事し、200+ が Anthropic、DeepMind、OpenAI、UK AISI、RAND、Redwood、METR、Apollo にいる。Redwood Research: Buck Shlegeris が founded した applied alignment lab。AI Control (Lesson 10) を introduced。control safety cases で UK AISI と collaborate。Apollo Research: frontier labs の pre-deployment scheming evaluations。In-Context Scheming (Lesson 8) と Towards Safety Cases for AI Scheming の author。METR (Model Evaluation and Threat Research): task-based capability evaluations、autonomous-task time-horizon studies。"Common Elements of Frontier AI Safety Policies" は lab frameworks を比較する。Eleos AI Research: model-welfare pre-deployment evaluations (Lesson 19)。Claude Opus 4 welfare assessment を実施。

**種別:** 学習
**言語:** なし
**前提条件:** Phase 18 · 01-27 (prior Phase 18 lessons)
**所要時間:** 約45分

## Learning Objectives

- non-lab alignment research ecosystem の5つの organisations と core output を特定する。
- MATS の scale (scholars, papers, h-index) と talent pipeline としての役割を説明する。
- Redwood の AI Control agenda と UK AISI との partnership を説明する。
- METR の task-based evaluation methodology を説明する。

## 問題

frontier labs (Lesson 18) は safety evaluations を内部で作り、選択した results を publish する。lab 外の ecosystem は、その evaluations が validated され、新しい failure modes が最初に発見され、talent が育つ場所である。ecosystem を理解すると、どの research findings が誰に trusted されているかを解釈できる。

## The Concept

### MATS (ML Alignment & Theory Scholars)

2021年後半開始。research mentorship program。scholars は senior researcher と特定の alignment problem に 10-12週間取り組む。

Scale (2026):
- inception 以降 527+ researchers。
- 180+ papers published。
- 10K+ citations。
- h-index 47。
- Summer 2024: 90 scholars + 40 mentors。501(c)(3) として incorporated。

Career outcomes: pre-2025 alumni の約80%が safety/security に従事。Anthropic、DeepMind、OpenAI、UK AISI、RAND、Redwood、METR、Apollo に 200+。

### Redwood Research

Applied alignment lab。Buck Shlegeris が founded。AI Control agenda (Lesson 10) を introduced。control safety cases で UK AISI と collaborate。evaluation design について DeepMind と Anthropic に advise する。

Canonical papers: Greenblatt, Shlegeris et al., "AI Control" (arXiv:2312.06942, ICML 2024); Alignment Faking (Greenblatt, Denison, Wright et al., arXiv:2412.14093, Anthropic との joint)。

Style: specific threat models、worst-case adversaries、stress-test 可能な concrete protocols。

### Apollo Research

frontier labs の pre-deployment scheming evaluations。In-Context Scheming (Lesson 8, arXiv:2412.04984) を authored。2025年 OpenAI anti-scheming training collaboration の partner。Towards Safety Cases for AI Scheming (2024) を produce。

Style: deception が生じ得る agentic-setting evaluations。three-pillar decomposition (misalignment, goal-directedness, situational awareness)。

### METR (Model Evaluation and Threat Research)

Task-based capability evaluations。Autonomous-task completion time-horizon studies。"Common Elements of Frontier AI Safety Policies" (metr.org/common-elements, 2025) は lab frameworks を比較する。

Apollo と AI Scheming safety-case sketch を co-author。

Style: long-horizon task evaluations、empirical capability measurement、framework synthesis。

### Eleos AI Research

Model-welfare pre-deployment evaluations。system card の section 5.3 に document された Claude Opus 4 welfare assessment を実施。Lesson 19 の welfare-relevant claims に対する external methodology check を提供する。

### The flow

MATS が researchers を育てる。graduates は Anthropic、DeepMind、OpenAI (lab safety teams) または Redwood、Apollo、METR、Eleos (external evaluation) に行く。External evaluators は labs や UK AISI / CAISI と partner する。Publications は ecosystem に戻り、次の MATS cohort の input になる。

### Why this layer matters

Single-source evaluations は unreliable である。labs が自社 models を評価する場合、structural conflict of interest がある。External evaluators は、lab が underreport し得る failure modes を raise and validate できる。2024 Sleeper Agents paper (Lesson 7) は Anthropic + Redwood。Alignment Faking は Anthropic + Redwood。In-Context Scheming は Apollo。Anti-Scheming は Apollo + OpenAI。multi-org structure が quality control である。

### Where this fits in Phase 18

Lessons 7-11 は Redwood と Apollo の work を参照する。Lesson 18 は METR の framework comparison を参照する。Lesson 19 は Eleos を参照する。Lesson 28 は、Phase の残りが依存する ecosystem の explicit organisational map である。

## Use It

コードはない。METR の "Common Elements of Frontier AI Safety Policies" を読み、external synthesis が lab-internal policy work にどのように value を加えるかを見る。

## Ship It

この lesson では `outputs/skill-ecosystem-map.md` を作る。alignment claim または evaluation が与えられたとき、organisation、publication venue、methodological style を特定し、known-counterpart organisations と cross-check する。

## Exercises

1. Lessons 7-15 から paper を1つ選び、関与した organisations を特定する。authors を MATS alumni と current ecosystem affiliations に照らして cross-check する。

2. METR の "Common Elements of Frontier AI Safety Policies" を読む。彼らが強調する cross-lab convergences を3つ、largest divergences を2つ特定する。

3. MATS career outcomes は約80% safety/security である。この selection pressure が adaptive (field を育てる) か biased (heterodox positions を filter out する) かを論じる。

4. Redwood と Apollo はどちらも control/scheming work を行うが style が異なる。failure mode を1つ選び、それぞれがどう調査するか説明する。

5. Eleos AI は唯一の pure model-welfare organisation である。別の welfare-adjacent question (cognitive liberty, robotic embodiment など) に focus する hypothetical second organisation を設計し、その methodology を明確にする。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MATS | 「mentorship program」 | ML Alignment & Theory Scholars。2021年以降 527+ researchers |
| Redwood Research | 「control lab」 | applied alignment。AI Control authors。UK AISI partner |
| Apollo Research | 「scheming evals」 | frontier labs の pre-deployment scheming evaluations |
| METR | 「task-horizon evals」 | task-based capability evaluations。framework synthesis |
| Eleos AI | 「welfare lab」 | model-welfare pre-deployment evaluations |
| Talent pipeline | 「MATS -> labs」 | MATS graduates が Anthropic, DM, OpenAI, Redwood, Apollo, METR へ流れる |
| External evaluation | 「non-lab check」 | model producer 以外による evaluation。credibility を加える |

## 参考文献

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) — mentorship program
- [Redwood Research](https://www.redwoodresearch.org/) — AI Control papers
- [Apollo Research](https://www.apolloresearch.ai/) — scheming evaluations
- [METR — Common Elements of Frontier AI Safety Policies](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — framework comparison
- [Eleos AI Research](https://www.eleosai.org/research) — model welfare methodology
