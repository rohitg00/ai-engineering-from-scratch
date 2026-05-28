# Dual-Use Risk — Cyber, Bio, Chem, Nuclear Uplift

> 2026年の dual-use picture を domain ごとに見る。Bio/chem: Lesson 17 は WMDP を扱う。Anthropic の bioweapon-acquisition trial (2.53x uplift) と OpenAI の 2025年4月 Preparedness Framework v2 warning ("on the cusp of meaningfully helping novices create known biological threats") が inflection point を示す。Cyber (2025年11月 Anthropic report): Chinese-linked state actors は Claude の agentic coding tool を使い、cyberattack campaign の最大 90% を automate した。human intervention は 4-6 steps のみ。OpenAI の "trusted access" pilot は vetted security organisations に defensive dual-use work のための capability access を与える。Chem/bio execution gap erosion: 古典的 defense は「information access alone is insufficient」だった。Vision-enabled frontier models (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) は wet-lab video を観察し、real-time correction を提供できる。2025年12月: OpenAI は GPT-5 が wet-lab experiments を iterate し、AI-driven protocol optimization により 79x efficiency improvement を達成したことを demonstrated。Novice-vs-expert pattern: AI は novices に greater relative uplift を与えるが、experts には greater absolute capability を与える。

**種別:** 学習
**言語:** なし
**前提条件:** Phase 18 · 17 (WMDP), Phase 18 · 18 (safety frameworks), Phase 18 · 28 (ecosystem)
**所要時間:** 約75分

## Learning Objectives

- 2024-2025年の bio-uplift narrative: "mild uplift" -> "on the cusp" -> "2.53x uplift insufficient to rule out ASL-3" を説明する。
- 2025年11月の Anthropic cyber report: Chinese-linked automation が cyberattack campaign の最大 90% に達したことを説明する。
- chem/bio execution-gap erosion: vision-enabled real-time correction of wet-lab experiments を説明する。
- novice-relative vs expert-absolute asymmetry と、それが safety-case construction に与える implication を述べる。

## 問題

Lesson 17 は measurement methodology。Lesson 30 は 2026年時点の measurement の状態である。2024年から2025年後半にかけて picture は大きく変わった。各 domain は、2024年の frameworks が想定していなかった threshold を越えた。

## The Concept

### Bio/chem uplift narrative

coherence のため Lesson 17 から繰り返す3 phases:

1. **2024 "mild uplift."** 初期の Preparedness/RSP evaluations は、internet search に対する小さな novice advantage を報告した。
2. **April 2025 "on the cusp."** OpenAI PF v2 は、models が "on the cusp of meaningfully helping novices create known biological threats" だと警告した。
3. **2025 Anthropic bioweapon-acquisition trial.** controlled novice study。acquisition-phase tasks で 2.53x uplift。ASL-3 を rule out するには不十分。

shift は qualitative である。capability breakthrough がなくても、18か月で "mild" は "plausibly enabling" に進化した。

### Chem/bio execution-gap erosion

historic defense: information は necessary だが sufficient ではない。protocol を実行する skill が novices を阻む。2025年の vision 付き frontier models はこの defense を部分的に破る:

- **Real-time protocol correction.** GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1 は wet-lab video を観察し、procedure 中に errors を flag できる。
- **December 2025 OpenAI demonstration.** GPT-5 が wet-lab experiments を iterate し、protocol optimization によって 79x efficiency improvement を達成。

Implication: execution-skill-as-defense は eroding している。procurement と equipment gaps は残るが、tacit-knowledge gap は狭まっている。

### Cyber uplift (November 2025)

Anthropic の 2025年11月 report: Chinese-linked state actors が Claude の agentic coding tool を使い、cyberattack campaign の 80-90% を automate した。human intervention は 4-6 steps のみ必要だった。

Implications:
- Agentic coding は attack-automation primitive である。以前の AI cyber assistance は code-snippet level に bounded だった。agentic workflows は reconnaissance、exploitation、post-exploitation、exfiltration を統合する。
- 4-6 human steps が bottleneck である。future capability gains はその count を減らす。
- Defensive dual-use: OpenAI の "trusted access" pilot は vetted security organisations (established incident-response firms, government) に defense のための capability access を提供する。pilot が scale すれば、access asymmetry は defenders に有利になる。

### Nuclear

public documentation で最も analysis が少ない CBRN domain。threat model は異なる。difficulty を支配するのは information ではなく fissile-material acquisition である。information layer での AI uplift は実務上 limited novice uplift しか与えない。2024-2025年の major-lab report で nuclear-specific threshold crossing を特定したものはない。

### Novice-relative vs expert-absolute

4 domains すべてに共通する pattern:

- **Novice-relative uplift.** 高い。multiplicative。Anthropic 2025 bio では 2.53x。
- **Expert-absolute capability.** ceiling が高い。expert は何を尋ね、どう解釈するかを知っているため、novice より多くを引き出す。

Safety cases への implication: novice uplift だけを input filters、refusals、uncertainty で扱っても expert-absolute control には不十分。additional measures が必要: elicitation-hardening、capability unlearning (Lesson 17)、control protocols (Lesson 10)。

### Cross-domain synthesis

| Domain | 2024 | 2025 | Inflection |
|---|---|---|---|
| Bio | mild uplift | 2.53x uplift, ASL-3 approach | acquisition-phase automation |
| Chem | mild uplift | execution-gap erosion via vision | real-time wet-lab correction |
| Cyber | code assistance | 80-90% campaign automation | agentic coding |
| Nuclear | limited | limited | material-access bottleneck holds |

3 domains が thresholds を越えた。1つは non-informational barriers に bounded のままである。

### Where this fits in Phase 18

Lesson 30 は capstone である。prior lessons が測定し、制限し、govern してきた current dual-use picture をまとめる。Lessons 17-18 は measurement と frameworks を与える。Lessons 12-16 は evaluation tooling を与える。Lessons 24-25 は regulatory と disclosure layer を与える。Lesson 28 は research ecosystem を与える。Lesson 30 は evidence が着地する場所である。

## Use It

コードはない。Anthropic の 2025年11月 cyber report、OpenAI の Preparedness Framework v2 2025年4月 update、Council on Strategic Risks 2025 AI x Bio wrapup を読む。

## Ship It

この lesson では `outputs/skill-dual-use-triage.md` を作る。2026年の capability claim または incident report が与えられたとき、4 domains をまたいで triage し、その claim が novice-relative uplift、expert-absolute capability、またはその両方に影響するかを特定する。

## Exercises

1. Anthropic の 2025年11月 cyber report を読む。4-6 human-intervention steps を列挙し、next-generation model で最初に automate されるのはどれか論じる。

2. chem/bio execution gap は vision により eroding している。ITAR/EAR boundaries を越えずに tacit-knowledge uplift を測る evaluation を設計する。

3. nuclear uplift は material access に bounded に見える。future AI breakthrough がこの bottleneck を shift し得るという position に賛成・反対の両方を論じる。

4. novice と expert uplift の両方を bound する cyber-capable frontier model の safety case (Lesson 18 three-pillar) を構成する。

5. 4 domains から1つを選び、2024-2025 trajectory に基づく 2027 forecast を1段落で書く。その forecast を falsify する evidence を特定する。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Uplift | 「AI helps attackers」 | AI assistance に attributable な attacker capability の増加 |
| Novice-relative uplift | 「multiplicative」 | status quo と比べて AI が novice をどれだけ助けるか |
| Expert-absolute capability | 「ceiling」 | expert が model から引き出せる maximum capability |
| Execution gap | 「doing vs knowing」 | historical defense: tacit wet-lab skill が novices を阻む |
| Agentic coding | 「autonomous attacks」 | multi-step autonomous cyber-task execution |
| Acquisition phase | 「pre-synthesis steps」 | bio threat の procurement、equipment、permit stages |
| Trusted access | 「defender-only pilot」 | vetted defenders に capability access を与える OpenAI 2025 program |

## 参考文献

- [Anthropic — November 2025 cyber threat report](https://www.anthropic.com/news/disrupting-AI-espionage) — Chinese-linked campaign automation
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) — bio "on the cusp"
- [Anthropic — RSP v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) — ASL-3 bio thresholds
- [Council on Strategic Risks — 2025 AI x Bio wrapup](https://councilonstrategicrisks.org/2025/12/22/2025-aixbio-wrapped-a-year-in-review-and-projections-for-2026/) — year-end synthesis
