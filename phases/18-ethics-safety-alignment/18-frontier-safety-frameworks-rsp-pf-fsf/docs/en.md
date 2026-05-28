# Frontier Safety Frameworks — RSP, PF, FSF

> 3つの主要 lab framework が、2026 年の frontier capability に関する industry governance を定義しています。Anthropic Responsible Scaling Policy v3.0 (February 2026) は、biosafety levels をモデルにした tiered AI Safety Levels (ASL-1 から ASL-5+) を導入し、CBRN-relevant models について ASL-3 が 2025年5月に activated されました。OpenAI Preparedness Framework v2 (April 2025) は tracked capabilities の5 criteria を定義し、Capabilities Reports と Safeguards Reports を分離します。DeepMind Frontier Safety Framework v3.0 (September 2025) は、新しい Harmful Manipulation CCL を含む Critical Capability Levels を導入します。3つすべてに、peer labs が comparable safeguards なしで ship した場合に requirements を defer できる competitor-adjustment clauses が含まれています。cross-lab alignment は用語ではなく構造にあります。"Capability Thresholds"、"High Capability thresholds"、"Critical Capability Levels" は analogous constructs を指します。

**種別:** 学習
**言語:** なし
**前提条件:** Phase 18 · 17 (WMDP), Phase 18 · 07-09 (deception failures)
**所要時間:** 約75分

## 学習目標

- Anthropic の ASL tier structure と、ASL-3 が何によって activated されたかを説明する。
- OpenAI Preparedness Framework v2 の tracked capabilities に関する5 criteria を挙げる。
- DeepMind の Critical Capability Level structure と Harmful Manipulation CCL を説明する。
- competitor-adjustment clauses と、それが race dynamics にとって重要な理由を説明する。
- safety case を定義し、3 pillars (monitoring、illegibility、incapability) を説明する。

## 問題

Lessons 7-17 は、deception が可能であり、dual-use capability が存在し、evaluation には限界があることを示しました。frontier-capable model を持つ lab には、次を満たす internal governance structure が必要です。
- いつ新しい safeguards が必要になるかの thresholds を定義する。
- scaling 前に必要な evaluations を定義する。
- safety case の形を記述する。
- race-dynamic problem (competitors が safeguards なしで ship したらどうするか) に対応する。

2025-2026 年の3つの frameworks は state of the art です。不完全で、進化中で、しかも labs 間で十分に aligned しているため、governance の問いは「frameworks が存在するか」ではなく「frameworks が十分か」になっています。

## コンセプト

### Anthropic Responsible Scaling Policy v3.0 (February 2026)

ASL structure:
- ASL-1: frontier model ではない (weaker-than-frontier baseline に含まれる)。
- ASL-2: 現在の frontier baseline。通常の safeguards で deployed。
- ASL-3: catastrophic misuse の risk が大幅に高い。CBRN-relevant capabilities。2025年5月に activated。
- ASL-4: AI R&D-2 crossing threshold。entry-level AI research を automate できる models。
- ASL-5+: advanced AI R&D。effective scaling を劇的に加速する models。

v3.0 の新要素:
- Frontier Safety Roadmaps (redacted 形式で公開)。
- Risk Reports (quarterly、一部は external review)。
- AI R&D を AI R&D-2 と AI R&D-4 に分解。
- AI R&D-4 を超えると affirmative safety case が必要になり、misaligned goals を追求する models による misalignment risks を特定する。

### OpenAI Preparedness Framework v2 (April 15, 2025)

tracked capabilities の5 criteria:
- **Plausible。** reasonable threat model が存在する。
- **Measurable。** empirical evaluation が可能。
- **Severe。** harm が大きい。
- **Net-new。** pre-existing risk を scale up しただけではない。
- **Instantaneous-or-irremediable。** harm が高速に発生するか、取り返しがつかない。

5つすべてを満たす capability が tracked されます。それ以外は tracked されません。

PF v2 のその他の構造:
- Capabilities Reports (model が何をできるか) と Safeguards Reports (どの controls があるか) を分離。
- Safety Advisory Group が review。
- Leadership が approve し、Board の Safety & Security Committee が oversee。
- "Adjustment clause": 別 lab が comparable safeguards なしで ship した場合、OpenAI は requirements を reduce できる。

### DeepMind Frontier Safety Framework v3.0 (September 2025)

domain ごとの Critical Capability Levels (CCLs):
- Bioweapon Uplift
- Cyber Uplift
- ML R&D Acceleration
- Harmful Manipulation (v3.0 の新規): high-stakes contexts で beliefs/behavior を大きく変え得る models。

v2.0 (February 2025) は Deceptive Alignment section と、ML R&D CCLs 向けのより高い security levels を追加しました。

### Cross-lab alignment

- Anthropic "Capability Thresholds"。
- DeepMind "Critical Capability Levels"。
- OpenAI "High Capability thresholds"。

industry-standard terminology はありません。構造は aligned しています: published evaluation criteria を持つ frontier capability の3 tiers。3つすべてに competitor-adjustment clauses (2025 onward) が含まれます。

### Safety cases

safety case とは、worst-case assumptions のもとで deployment が acceptably safe であることを示す written argument です。標準構造は3 pillars を対象にします。

- **Monitoring。** 悪い behaviour が起きた場合に検出できるか。
- **Illegibility。** model は harm を引き起こす coherent plan を実行する能力を欠いているか。
- **Incapability。** model は問題の harm を引き起こす capability を欠いているか。

異なる safety cases は異なる pillars を対象にします。ASL-3 CBRN case では、incapability (unlearning 経由) が主な対象です。deceptive alignment では monitoring と illegibility が対象です。cyber uplift では3つすべてが relevant です。

### race-dynamic problem

competitor-adjustment clauses は論争的です。批判者は、これが race to the bottom を作ると主張します。3 labs がすべて、competitor が defection したときに requirements を下げるなら、均衡は defection 側に寄ります。擁護者は、defecting lab の方が safety-conscious でない場合、unilateral safeguards の代替案はより悪い outcomes を生むと主張します。

UK AISI、US CAISI、EU AI Office (Lesson 24) は external governance counterparts です。lab frameworks は voluntary であり、regulatory frameworks は emerging です。

### Phase 18 における位置づけ

Lessons 17-18 は、deception と red-team analyses の上にある measurement-and-governance layer です。Lessons 19-24 は welfare、bias、privacy、watermarking、regulatory structure を扱います。Lesson 28 は evaluations を operationalize する research ecosystem (MATS、Redwood、Apollo、METR) を map します。

## 使ってみる

この lesson には code はありません。3つの primary sources: RSP v3.0、PF v2、FSF v3.0 を読んでください。各 lab の tier structure を互いに対応づけ、それぞれが定義していて他が定義していない threshold を1つ特定してください。

## 成果物

この lesson は `outputs/skill-framework-diff.md` を生成します。safety framework または release note が与えられたら、その framework の threshold definitions、required evaluations、safety-case structure を RSP v3.0、PF v2、FSF v3.0 と比較し、cross-lab gaps を flag します。

## 演習

1. RSP v3.0、PF v2、FSF v3.0 を読んでください。各 lab の CBRN threshold、AI R&D threshold、required pre-deployment evaluation を表にしてください。

2. competitor-adjustment clause は3 frameworks すべてにあります (2025+)。賛成する paragraph を1つ、反対する paragraph を1つ書いてください。それぞれの立場が依存する assumption を特定してください。

3. Anthropic の AI R&D-4 threshold を超える model の safety case を設計してください。3 pillars (monitoring、illegibility、incapability) それぞれについて必要な evidence を挙げてください。

4. DeepMind の FSF v3.0 は Harmful Manipulation CCL を導入します。model がこの threshold を超えたことを示す empirical measurements を3つ提案してください。

5. METR の "Common Elements of Frontier AI Safety Policies" (2025) を読んでください。最も強い cross-lab convergences を3つ、最大の divergences を2つ挙げてください。

## 重要用語

| Term | よく言われる説明 | 実際の意味 |
|------|------------------|------------|
| RSP | 「Anthropic の framework」 | Responsible Scaling Policy。ASL tiers。v3.0 February 2026 |
| PF | 「OpenAI の framework」 | Preparedness Framework。five criteria。v2 April 2025 |
| FSF | 「DeepMind の framework」 | Frontier Safety Framework。CCLs。v3.0 September 2025 |
| ASL-3 | 「biosafety level 3-analog」 | CBRN-relevant capabilities 向けの Anthropic tier。2025年5月 activated |
| CCL | "critical capability level" | DeepMind の threshold construct。domain ごと |
| Safety case | 「formal argument」 | worst-case U のもとで deployment が acceptably safe であることを示す written argument |
| Adjustment clause | 「competitor defection allowance」 | competitors が comparable safeguards なしで ship した場合に requirements を下げる framework provision |

## 参考文献

- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) — ASL tiers、roadmaps、AI R&D disaggregation
- [OpenAI — Updating the Preparedness Framework (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) — five criteria、adjustment clause
- [DeepMind — Strengthening our Frontier Safety Framework (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — CCL v3.0、Harmful Manipulation
- [METR — Common Elements of Frontier AI Safety Policies (2025)](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — cross-lab comparison
