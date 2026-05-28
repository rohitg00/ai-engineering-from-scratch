# Benchmarks: SWE-bench, GAIA, AgentBench

> 2026年のagent評価を支える代表的なbenchmarkは3つあります。SWE-benchはcode patchingを、GAIAはgeneralistなtool useを、AgentBenchは複数環境でのreasoningをテストします。それぞれの構成、contaminationの事情、そして測れていないものを理解しておきましょう。

**種別:** 学習
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 06 (Tool Use)
**所要時間:** 約60分

## Learning Objectives

- SWE-benchのtest harness (FAIL_TO_PASS) を挙げ、なぜunit testsでgateするのかを説明する。
- SWE-bench Verified (OpenAI、500 tasks) が存在する理由と、何を取り除いているのかを説明する。
- GAIAの設計、つまり「人間には単純、AIには難しい」ことと3つのdifficulty levelsを説明する。
- AgentBenchの8つのenvironmentと、open-source LLMの主なblockerを挙げる。
- SWE-bench+のcontaminationに関する発見と、その含意を要約する。

## 問題

Leaderboardは、あるbenchmarkでどのmodelが勝つかを教えてくれます。しかし次のことは教えてくれません。

- benchmarkがcontaminatedかどうか (training data内のsolution、test leakage)。
- benchmarkがあなたの関心対象を測っているかどうか (code、browsing、generalistなど)。
- evaluatorがrobustかどうか (AST matching、state checks、human review)。

数値を引用する前に、軸になる3つのbenchmarkとそのfailure modesを理解してください。

## The Concept

### SWE-bench (Jimenez et al., ICLR 2024 oral)

- 人気のある12個のPython repoから集めた2,294件の実GitHub issue。
- Agentが受け取るもの: fix前commitのcodebase + natural-languageのissue description。
- Agentが生成するもの: patch。
- Evaluator: patchを適用し、repoのtest suiteを実行する。patchはFAIL_TO_PASS tests (以前は失敗、今は成功) をflipしつつ、PASS_TO_PASS testsを壊してはいけない。

SWE-agent (Yang et al., 2024) は、agent-computer interface (file editor commands、modelが理解しやすいsearch syntax) を重視することで、release時に12.5%を達成しました。

### SWE-bench Verified

OpenAI、2024年8月。人間がcurateした500-task subsetです。曖昧なissue、信頼できないtest、fixが不明確なtaskを取り除きます。「あなたのagentは実際のpatchをshipできるのか」を見る主要benchmarkです。

### Contamination

- SWE-bench issueの94%超は、多くのmodel cutoffより前に存在しています。
- **SWE-bench+** は、successful patchの32.67%でissue text内にsolution leakageがあった (modelがdescription内でfixを見ていた) こと、31.08%が弱いtest coverageのため疑わしいことを発見しました。
- Verifiedはよりcleanですが、contamination-freeではありません。

実務上の含意: SWE-benchで50%を取るmodelが、SWE-bench+では35%になるかもしれません。SWE-bench performanceを主張するなら、常に両方を報告してください。

### GAIA (Mialon et al., Nov 2023)

- 466問。huggingface.co/gaia-benchmarkのprivate leaderboardには300問が残されています。
- 設計思想: 「人間には概念的に単純 (92%) だが、AIには難しい (plugins付きGPT-4: 15%)」。
- reasoning、multi-modality、web、tool useをテストします。
- difficulty levelは3段階。Level 3はmodalityをまたぐ長いtool chainを必要とします。

GAIAは「generalist capability」を測るために実行するものです。code-specific benchmarkと混同しないでください。

### AgentBench (Liu et al., ICLR 2024)

- code (Bash、DB、KG)、games (Alfworld、LTP)、web (WebShop、Mind2Web)、open-ended generationにまたがる8 environment。
- Multi-turnで、splitごとに約4k-13k turns。
- 主な発見: OSS LLMがcommercial modelに追いつくうえでのblockerは、long-term reasoning、decision-making、instruction followingです。

### What these do not measure

- 実世界のoperational cost (tokens、wall-clock)。
- adversarial conditionsでのsafety behavior。
- あなたのdomainでのperformance (独自evalsを使う、Lesson 30)。
- tail failures (benchmarkはaverageを見るが、production operatorは最悪の1%を気にする)。

### Where benchmarking goes wrong

- **Single-number fixation。** SWE-bench 50%という数値だけでは、P50/P75/P95 cost + step distributionほど多くを語りません。
- **Contaminated claims。** VerifiedやSWE-bench+に触れずにSWE-benchを報告するのはmisleadingです。
- **Benchmark-as-development-target。** benchmarkに最適化すると、production usefulnessからずれていきます。

## 実装

`code/main.py`はtoy SWE-bench-like harnessを実装しています。

- Synthetic bug-fix tasks (3 tasks)。
- patchを提案するscripted "agent"。
- FAIL_TO_PASS (bugが直った) とPASS_TO_PASS (何も壊れていない) をcheckするtest runner。
- question decomposition depthに基づくGAIA-style difficulty classifier。

実行:

```
python3 code/main.py
```

出力はtask別 + difficulty別のresolution rateを示し、evaluator rulesを具体化します。

## Use It

- **SWE-bench Verified** はcode agent用。Verified scoreを必ず報告する。
- **GAIA** はgeneralist agent用。private leaderboard splitを使う。
- **AgentBench** はmulti-environment comparison用。
- **Custom evals** (Lesson 30) はあなたのproductの実際の形に合わせる。

## Ship It

`outputs/skill-benchmark-harness.md`は、任意のcodebase-task pair向けに、FAIL_TO_PASS / PASS_TO_PASS gatingを持つSWE-bench-style harnessを構築します。

## Exercises

1. toy harnessを実repoで動くようにportする (自分のrepoを1つ選ぶ)。既知bugに対して3つのFAIL_TO_PASS testsを書く。
2. step-count metricを追加する。3 taskで、resolutionごとにagent stepはいくつ必要か。
3. SWE-bench+ paperを読む。solution-leakage checkを実装する (issue textをdiffに対してpattern-matchする)。
4. public splitからGAIA questionを1つdownloadする。GPT-4-class agentが何をするかtraceする。どのtoolが必要か。
5. AgentBenchのenvironment別breakdownを読む。どのenvironmentがあなたのproduct surfaceを反映しているか。そこでの「SOTA」はどのようなものか。

## Key Terms

| Term | よくある言い方 | 実際の意味 |
|------|----------------|------------|
| SWE-bench | "Code agent benchmark" | 2,294件のGitHub issue。patchはFAIL_TO_PASS testsをflipする必要がある |
| SWE-bench Verified | "Clean SWE-bench" | OpenAIによる、人間がcurateした500 tasks |
| FAIL_TO_PASS | "Fix gate" | patch後にpassしなければならない、以前はfailしていたtest |
| PASS_TO_PASS | "No-regression gate" | 以前passしており、引き続きpassしなければならないtest |
| GAIA | "Generalist benchmark" | 人間には簡単 / AIには難しい466問のmulti-tool questions |
| AgentBench | "Multi-env benchmark" | 8 environments。long-horizon multi-turn |
| Contamination | "Training-set leak" | benchmark taskがmodel trainingに含まれていること |
| SWE-bench+ | "Contamination audit" | successful SWE-bench patchの32.67%にsolution leakageを発見 |

## 参考文献

- [Jimenez et al., SWE-bench (arXiv:2310.06770)](https://arxiv.org/abs/2310.06770) — original benchmark
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — curated subset
- [Mialon et al., GAIA (arXiv:2311.12983)](https://arxiv.org/abs/2311.12983) — generalist benchmark
- [Liu et al., AgentBench (arXiv:2308.03688)](https://arxiv.org/abs/2308.03688) — multi-environment suite
