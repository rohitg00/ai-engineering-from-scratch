# LLM 评估 —— RAGAS、DeepEval、G-Eval

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 精确匹配（Exact Match）和 F1 抓不住语义等价。人工审阅又跑不动量。LLM-as-judge 才是生产环境的答案——前提是你给它做足校准，让那个分数值得信。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 13（Question Answering），Phase 5 · 14（Information Retrieval）
**Time:** ~75 分钟

## 问题（The Problem）

你的 RAG 系统答："June 29th, 2007."
gold 参考答案是："June 29, 2007."
Exact Match 给 0 分。F1 大概 75%。换个真人来评，肯定 100%。

把它乘上 1 万条测试用例。再乘上 retriever、chunking、prompt、模型每一次改动。你需要的评估器要懂语义、能在大规模下便宜地跑、不会对回归说谎、还能把对的失败模式翻出来。

2026 年有三个框架占住了这个问题。

- **RAGAS。** Retrieval-Augmented Generation ASsessment。四个 RAG 指标（faithfulness、answer-relevance、context-precision、context-recall），后端用 NLI + LLM-judge。有研究背书，轻量。
- **DeepEval。** 给 LLM 用的 pytest。带 G-Eval、task-completion、hallucination（幻觉）、bias 这些指标。CI/CD 原生。
- **G-Eval。** 一种方法（也是 DeepEval 里的一个指标）：LLM-as-judge 配上 chain-of-thought（CoT），可以自定义 criteria，输出 0-1 的分数。

三者都靠 LLM-as-judge。这一课要建立的是对这种方法本身、以及它周围那层信任机制的直觉。

## 概念（The Concept）

![四个评估维度，LLM-as-judge 架构](../assets/llm-evaluation.svg)

**LLM-as-judge。** 把静态指标换成一个 LLM，按 rubric（评分细则）给输出打分。给定 `(query, context, answer)`，去 prompt 一个 judge LLM："按 faithfulness 打 0-1 分。"拿回分数。

它为什么管用：LLM 能以极低成本逼近人类判断。GPT-4o-mini 每条评分约 $0.003，意味着 1000 个样本的回归 eval 跑一次不到 $5。

它为什么会悄悄翻车：

1. **Judge bias。** Judge 偏好更长的答案、来自自己模型家族的答案、贴合 prompt 风格的答案。
2. **JSON 解析失败。** 坏 JSON → NaN 分数 → 在聚合里被悄悄剔除。RAGAS 用户都懂这个痛。用 try/except 把它兜住，并显式标出 failure mode。
3. **跨模型版本漂移。** 升级 judge 会让所有指标都变。把 judge model + 版本冻住。

**RAG 四件套。**

| 指标 | 问题 | 后端 |
|--------|----------|---------|
| Faithfulness | 答案里的每条 claim 是否都来自检索到的 context？ | 基于 NLI 的蕴含判断 |
| Answer relevance | 答案是否回应了问题？ | 从答案反推假想问题，与真实问题对比 |
| Context precision | 检索到的 chunk 里，相关的占多少？ | LLM-judge |
| Context recall | 检索是否把需要的全找回来了？ | LLM-judge 对照 gold 答案 |

**G-Eval。** 自定义一条 criterion："答案是否引用了正确的来源？"框架会自动展开成 chain-of-thought 评估步骤，再打 0-1 分。适合 RAGAS 没覆盖的领域专属质量维度。

**Calibration（校准）。** 在拿到与人工标签的相关性之前，永远别相信原始的 judge 分数。手标 100 条样本。把 judge 和人工画散点图。算 Spearman rho。如果 rho < 0.7，说明你的 judge rubric 还得打磨。

## 动手实现（Build It）

### Step 1：用 NLI 做 faithfulness（RAGAS 风格）

```python
from typing import Callable
from transformers import pipeline

nli = pipeline("text-classification",
               model="MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli",
               top_k=None)

# `llm` is any callable: prompt str -> generated str.
# Example: llm = lambda p: client.messages.create(model="claude-haiku-4-5", ...).content[0].text
LLM = Callable[[str], str]


def atomic_claims(answer: str, llm: LLM) -> list[str]:
    prompt = f"""Break this answer into simple factual claims (one per line):
{answer}
"""
    return llm(prompt).splitlines()


def faithfulness(answer: str, context: str, llm: LLM) -> float:
    claims = atomic_claims(answer, llm)
    if not claims:
        return 0.0
    supported = 0
    for claim in claims:
        result = nli({"text": context, "text_pair": claim})[0]
        entail = next((s for s in result if s["label"] == "entailment"), None)
        if entail and entail["score"] > 0.5:
            supported += 1
    return supported / len(claims)
```

把答案拆成原子 claim。每条 claim 用 NLI 跟检索到的 context 对一次。Faithfulness = 被支持的比例。

### Step 2：answer relevance

```python
import numpy as np
from sentence_transformers import SentenceTransformer

# encoder: any model implementing .encode(texts, normalize_embeddings=True) -> ndarray
# e.g., encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")

def answer_relevance(question: str, answer: str, encoder, llm: LLM, n: int = 3) -> float:
    prompt = f"Write {n} questions this answer could be the answer to:\n{answer}"
    generated = [line for line in llm(prompt).splitlines() if line.strip()][:n]
    if not generated:
        return 0.0
    q_emb = np.asarray(encoder.encode([question], normalize_embeddings=True)[0])
    g_embs = np.asarray(encoder.encode(generated, normalize_embeddings=True))
    sims = [float(q_emb @ g_emb) for g_emb in g_embs]
    return sum(sims) / len(sims)
```

如果答案隐含的问题跟实际被问的不一致，相关性就掉下来。

### Step 3：G-Eval 自定义指标

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams, LLMTestCase

metric = GEval(
    name="Correctness",
    criteria="The answer should be factually accurate and match the expected output.",
    evaluation_steps=[
        "Read the expected output.",
        "Read the actual output.",
        "List factual claims in the actual output.",
        "For each claim, mark supported or unsupported by the expected output.",
        "Return score = fraction supported.",
    ],
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
)

test = LLMTestCase(input="When was the first iPhone released?",
                   actual_output="June 29th, 2007.",
                   expected_output="June 29, 2007.")
metric.measure(test)
print(metric.score, metric.reason)
```

那几条 evaluation steps 就是 rubric。显式步骤比隐式的"打 0-1 分"prompt 稳得多。

### Step 4：CI gate

```python
import deepeval
from deepeval.metrics import FaithfulnessMetric, ContextualRelevancyMetric


def test_rag_system():
    cases = load_regression_cases()
    faith = FaithfulnessMetric(threshold=0.85)
    rel = ContextualRelevancyMetric(threshold=0.7)
    for case in cases:
        faith.measure(case)
        assert faith.score >= 0.85, f"faithfulness regression on {case.id}"
        rel.measure(case)
        assert rel.score >= 0.7, f"relevancy regression on {case.id}"
```

当成 pytest 文件落盘。每个 PR 都跑。回归就 block 合并。

### Step 5：从零撸一个玩具 eval

见 `code/main.py`。只用标准库做的近似版 faithfulness（答案 claim 与 context 的 overlap）和 relevance（答案 token 与问题 token 的 overlap）。不是生产级。但形状对。

## 坑位（Pitfalls）

- **没做校准。** 一个跟人工标签相关性只有 0.3 的 judge 就是噪声。上线之前先跑一轮 calibration。
- **自评。** 用同一个 LLM 既生成又评分，会把分数虚抬 10-20%。Judge 用另一个模型家族。
- **成对评判里的位置 bias。** Judge 偏好排在前面的那个。永远把顺序随机化，再两边都跑一次。
- **裸聚合掩盖失败。** 平均分 0.85 经常藏着 5% 的灾难性失败。永远去看最低分位。
- **Golden 数据集腐烂。** 没版本号的 eval 集会随时间漂移，把纵向对比毁掉。每次改动都给数据集打 tag。
- **LLM 成本。** 到一定规模，judge 调用是成本大头。用满足 calibration 阈值的最便宜模型。GPT-4o-mini、Claude Haiku、Mistral-small。

## 用起来（Use It）

2026 年的技术栈：

| 用途 | 框架 |
|---------|-----------|
| RAG 质量监控 | RAGAS（4 个指标） |
| CI/CD 回归门禁 | DeepEval + pytest |
| 自定义领域 criteria | DeepEval 里的 G-Eval |
| 在线流量实时监控 | RAGAS 的 reference-free 模式 |
| Human-in-the-loop（人工确认）抽检 | LangSmith 或 Phoenix 加标注 UI |
| Red-teaming / 安全评估 | Promptfoo + DeepEval |

典型组合：RAGAS 做监控，DeepEval 做 CI，G-Eval 处理新增维度。三个一起跑；它们意见不一致的地方往往最有用。

## 上线部署（Ship It）

存为 `outputs/skill-eval-architect.md`：

```markdown
---
name: eval-architect
description: Design an LLM evaluation plan with calibrated judge and CI gates.
version: 1.0.0
phase: 5
lesson: 27
tags: [nlp, evaluation, rag]
---

Given a use case (RAG / agent / generative task), output:

1. Metrics. Faithfulness / relevance / context-precision / context-recall + any custom G-Eval metrics with criteria.
2. Judge model. Named model + version, rationale for cost vs accuracy.
3. Calibration. Hand-labeled set size, target Spearman rho vs human > 0.7.
4. Dataset versioning. Tag strategy, change log, stratification.
5. CI gate. Thresholds per metric, regression-window logic, bottom-quantile alert.

Refuse to rely on a judge untested against ≥50 human-labeled examples. Refuse self-evaluation (same model generates + judges). Refuse aggregate-only reporting without bottom-10% surfacing. Flag any pipeline where judge upgrade lands without parallel baseline eval.
```

## 练习（Exercises）

1. **简单。** 在 10 个带已知 hallucination 的 RAG 例子上跑 RAGAS。确认 faithfulness 指标每个都抓出来了。
2. **中等。** 手标 50 条 QA 答案的 correctness（0 或 1）。用 G-Eval 打分。算 judge 与人工的 Spearman rho。
3. **困难。** 用 DeepEval 搭一个 pytest CI gate。故意把 retriever 改差。确认 gate 会失败。再加一条最低分位告警：对最低 10% 做阈值检查。

## 关键术语（Key Terms）

| 术语 | 大家嘴上说的 | 它实际是什么 |
|------|-----------------|-----------------------|
| LLM-as-judge | "用 LLM 打分" | 给 judge model 一个 rubric，让它对输出打 0-1 分。 |
| RAGAS | "那个 RAG 指标库" | 开源评估框架，含 4 个 reference-free 的 RAG 指标。 |
| Faithfulness | "答案有没有依据？" | 答案里被检索 context 蕴含的 claim 占比。 |
| Context precision | "检索到的 chunk 相关吗？" | top-K chunk 里实际有用的占比。 |
| Context recall | "该找的都找到了吗？" | gold 答案 claim 中被检索 chunk 支持的占比。 |
| G-Eval | "自定义 LLM judge" | Rubric + chain-of-thought 评估步骤 + 0-1 分。 |
| Calibration | "信任，但要验证" | judge 分数与人工分数之间的 Spearman 相关性。 |

## 延伸阅读（Further Reading）

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) —— RAGAS 论文。
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634) —— G-Eval 论文。
- [DeepEval docs](https://deepeval.com/docs/metrics-introduction) —— 开源的生产级技术栈。
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) —— bias、calibration、能力边界。
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) —— 把 RAGAS、DeepEval、Phoenix 整合到一起的统一框架。
