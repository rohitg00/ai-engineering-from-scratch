# A/B Testing LLM Features — GrowthBook, Statsig, and the Vibes Problem

> 従来の A/B testing は non-deterministic な LLM を前提に作られていない。重要な区別: evals は「model は job を実行できるか？」に答える。A/B tests は「users はそれを気にするか？」に答える。両方が必要であり、vibe check だけで ship する時代は終わった。2026年に test すべきもの: prompt engineering（wording）、model selection（GPT-4 vs GPT-3.5 vs OSS。accuracy vs cost vs latency）、generation parameters（temperature、top-p）。実例: chatbot reward-model variant は conversation length +70%、retention +30% を出した。Nextdoor AI subject-line experiments は reward-function refinement 後に +1% CTR を出した。Khan Academy Khanmigo は latency-vs-math-accuracy axis で反復した。platform split: **Statsig**（2025年9月に OpenAI が $1.1B で買収）— sequential testing、CUPED、all-in-one。**GrowthBook** — open-source、warehouse-native、Bayesian + Frequentist + Sequential engines、CUPED、SRM checks、Benjamini-Hochberg + Bonferroni corrections。選択基準は warehouse-SQL preference と、「OpenAI に買収された」ことが組織にとって重要かどうかである。

**種別:** 学習
**言語:** Python (stdlib, toy sequential test simulator)
**前提条件:** Phase 17 · 13 (Observability), Phase 17 · 20 (Progressive Deployment)
**所要時間:** 約60分

## 学習目標

- evals（「model は job を実行できるか」）と A/B tests（「users は気にするか」）を区別する。
- 3つの testable axes（prompt、model、parameters）を列挙し、それぞれの metric を選ぶ。
- CUPED、sequential testing、Benjamini-Hochberg multiple-comparison corrections を説明する。
- warehouse-SQL posture と corporate acquisition stance に基づき Statsig または GrowthBook を選ぶ。

## 課題

system prompt を手で調整した。良くなった気がする。ship する。conversion は noise の範囲で動く。metric のせいにする。あるいは新しい model を ship して conversion が動かなかった。model が悪化したのか、detect するには change が小さすぎたのか。A/B なしで ship したので分からない。

evals は labeled set 上で model が task を実行できるかを答える。users が output を好むかは答えない。それに答えられるのは controlled online experiment だけであり、その experiment が十分な power を持ち、non-determinism を control し、multiple comparisons を補正している場合に限る。

## コンセプト

### evals vs A/B tests

**Evals** — offline、labeled set、judge（rubric、LLM-as-judge、人間）。答える問い: 「この fixed distribution 上で output は correct / helpful / safe か？」

**A/B test** — online、live users、randomized。答える問い: 「新しい variant は重要な user-level metric を動かすか？」

両方必要だ。evals は exposure 前に regression を捕まえ、A/B は exposure 後に product impact を確認する。

### test すべきもの

1. **Prompt engineering** — wording、system-prompt structure、examples。metric: task success、user retention、cost/request。
2. **Model selection** — GPT-4 vs GPT-3.5-Turbo vs Llama-OSS。metric: accuracy（task）+ cost/request + latency P99。multi-objective。
3. **Generation parameters** — temperature、top-p、max_tokens。metric: task-specific（output diversity vs determinism）。

### CUPED — variance reduction

Controlled-experiments Using Pre-Experiment Data。post-period を比較する前に pre-period variance を regress out する。典型的な variance reduction は30-70%。effective sample size が無料で増える。

implementation: Statsig と GrowthBook はどちらも実装している。

### sequential testing

classical A/B は fixed sample size を仮定する。sequential tests（"peek-and-decide"）は repeated looks 下でも false-positive rate を制御する。always-valid sequential procedures（mSPRT、Howard's confidence sequences）は明確な winner で early stop できる。

### multiple-comparison corrections

95% confidence で20個の A/B tests を走らせると、偶然1つは false positive になる。Bonferroni correction は test ごとの α を厳しくし、Benjamini-Hochberg は false-discovery rate を制御する。GrowthBook は両方を実装している。

### SRM — sample ratio mismatch

assignment hash は users を variants に randomize する。50/50 split なのに 47/53 が配信されたら何かが壊れている。SRM check はそれを flag する。両 platform が実装している。

### Statsig vs GrowthBook

**Statsig**:
- OpenAI が $1.1B で買収（2025年9月）。hosted、SaaS。
- Sequential testing、CUPED、held-out populations。
- all-in-one: feature flags + experimentation + observability。
- best fit: bundled product が欲しく、OpenAI ownership を気にしない team。

**GrowthBook**:
- Open-source（MIT）。warehouse-native（Snowflake/BigQuery/Redshift から直接読む）。
- multiple engines: Bayesian、Frequentist、Sequential。
- CUPED、SRM、Bonferroni、BH corrections。
- self-host または managed cloud。
- best fit: warehouse-SQL shop、data team が metric layer を制御している、OSS が欲しい。

### non-determinism は power を複雑にする

同じ prompt でも output は変わる。従来の power calculation は IID observations を仮定する。LLM non-determinism では effective sample size が nominal より低い。安全 margin として required sample size に約1.3-1.5x を掛ける。

### 実例の outcome

- Chatbot reward model variant: conversation length +70%、retention +30%。
- Nextdoor subject lines: reward-function refinement 後に +1% CTR。
- Khan Academy Khanmigo: latency-vs-math-accuracy trade を反復。

### anti-pattern: vibes で ship する

すべての senior engineer は、「なんとなく良く感じる」ため A/B なしで ship された機能を挙げられる。その多くは product metrics を悪化させ、team は何か月も気づかなかった。A/B はその forcing function である。

### 覚えておくべき数字

- Statsig acquired by OpenAI: $1.1B、September 2025。
- GrowthBook: open-source MIT、Bayesian + Frequentist + Sequential。
- CUPED variance reduction: 30-70%。
- LLM non-determinism → +30-50% sample-size buffer。

## 使ってみる

`code/main.py` は fixed boundary と sequential boundary を使って sequential A/B test を simulate する。sequential がどのように early stop を可能にするかを示す。

## 成果物

この lesson は `outputs/skill-ab-plan.md` を生成する。feature change、workload、baseline を受け取り、platform、gates、sample size を選ぶ。

## 演習

1. `code/main.py` を実行する。baseline 3% conversion、expected 5% lift で 80% power に必要な sample size はいくつか。
2. healthcare-regulated on-prem customer に Statsig と GrowthBook のどちらを選ぶか。
3. cost-per-resolved-ticket で GPT-4 vs GPT-3.5 を test する A/B を設計する。primary metric、guardrail metric、secondary は何か。
4. canary は通過したが、A/B は conversion -1.2% を示した。ship するか。escalation criteria を書く。
5. post variance の60%を持つ pre-period に CUPED を適用する。effective-sample-size boost を計算する。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Eval | "offline test" | labeled-set evaluation of model capability |
| A/B test | "experiment" | users 上の live randomized comparison |
| CUPED | "variance reduction" | variance を減らす pre-period regression |
| Sequential test | "peek-ok test" | early stop を許す always-valid procedure |
| Multiple comparison | "the family error" | 多数 test により false positives が増えること |
| Bonferroni | "tight correction" | α を test 数で割る |
| Benjamini-Hochberg | "BH FDR" | より保守的でない false-discovery-rate control |
| SRM | "bad split" | Sample ratio mismatch。assignment bug |
| Statsig | "OpenAI owned" | 2025年に買収された commercial all-in-one |
| GrowthBook | "the OSS one" | MIT warehouse-native platform |
| mSPRT | "sequential probability ratio test" | classical sequential procedure |

## 参考資料

- [GrowthBook — How to A/B Test AI](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/)
- [Statsig — Beyond Prompts: Data-Driven LLM Optimization](https://www.statsig.com/blog/llm-optimization-online-experimentation)
- [Statsig vs GrowthBook comparison](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools)
- [Deng et al. — CUPED](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
- [Howard — Confidence Sequences](https://arxiv.org/abs/1810.08240)
