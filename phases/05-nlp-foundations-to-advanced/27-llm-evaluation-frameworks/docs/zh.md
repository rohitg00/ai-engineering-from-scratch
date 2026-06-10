# 27 · 大语言模型评测 —— RAGAS、DeepEval、G-Eval

> 精确匹配（Exact Match）与 F1 无法捕捉语义等价。人工评审无法规模化。「大模型充当评委（LLM-as-judge）」是生产级答案——前提是有足够的校准，让这个分数值得信赖。

**类型：** 构建（Build）
**语言：** Python
**前置：** 阶段 5 · 13（问答系统）、阶段 5 · 14（信息检索）
**时长：** 约 75 分钟

## 问题所在

你的 RAG 系统回答：「June 29th, 2007.」
标准答案是：「June 29, 2007.」
精确匹配（Exact Match）得 0 分。F1 约 75%。人类则会给 100 分。

现在把这个差异乘以 10,000 个测试用例。再乘以你对检索器、分块、提示词或模型所做的每一次改动。你需要一个评测器，它能理解含义、在规模上以低成本运行、不会对回归（regression）撒谎，并且能暴露出真正的失败模式。

2026 年有三个框架主导着这一问题域。

- **RAGAS。** Retrieval-Augmented Generation ASsessment（检索增强生成评估）。四项 RAG 指标（faithfulness、answer-relevance、context-precision、context-recall），后端基于 NLI + 大模型评委。有研究背书，且轻量。
- **DeepEval。** 面向大模型的 Pytest。提供 G-Eval、任务完成度、幻觉、偏见等指标。原生支持 CI/CD。
- **G-Eval。** 一种方法（同时也是 DeepEval 中的一个指标）：带思维链（chain-of-thought）、自定义评判标准、输出 0-1 分的「大模型充当评委」。

三者都依赖「大模型充当评委」。本课旨在建立对该方法及其外围信任层的直觉。

## 核心概念

〔图：四个评测维度与大模型充当评委的架构〕

**大模型充当评委（LLM-as-judge）。** 用一个依据评分量表（rubric）打分的大模型，取代静态指标。给定 `(query, context, answer)`，向评委大模型发出提示词：「在 faithfulness 维度上打 0-1 分。」返回该分数。

它为何有效：大模型以极小的成本逼近人类判断。GPT-4o-mini 每个打分用例约 $0.003，使得 1000 样本的回归评测运行成本低于 $5。

它为何会悄无声息地失效：

1. **评委偏见。** 评委偏好更长的答案、来自自身模型家族的答案、以及与提示词风格相符的答案。
2. **JSON 解析失败。** 错误的 JSON → NaN 分数 → 被悄悄从聚合结果中剔除。RAGAS 用户深知此痛。用 try/except + 显式失败模式来兜底。
3. **跨模型版本的漂移（drift）。** 升级评委会改变每一项指标。冻结评委模型 + 版本。

**RAG 四件套。**

| 指标 | 它在问什么 | 后端 |
|--------|----------|---------|
| Faithfulness（忠实度） | 答案中的每条主张是否都来自检索到的上下文？ | 基于 NLI 的蕴含（entailment）判断 |
| Answer relevance（答案相关性） | 答案是否回应了问题？ | 从答案生成若干假设性问题；与真实问题比较 |
| Context precision（上下文精确率） | 在检索到的分块中，相关的占多大比例？ | 大模型评委 |
| Context recall（上下文召回率） | 检索是否返回了所需的全部内容？ | 大模型评委，对照标准答案 |

**G-Eval。** 定义一个自定义评判标准：「答案是否引用了正确的来源？」框架会自动展开成思维链式的评测步骤，然后输出 0-1 分。适合 RAGAS 未覆盖的、与具体领域相关的质量维度。

**校准（Calibration）。** 在你拿到与人工标注之间的相关性之前，永远不要信任原始评委分数。运行 100 个手工标注的样例。绘制评委 vs 人类的对比图。计算 Spearman rho（斯皮尔曼等级相关系数）。如果 rho < 0.7，说明你的评委评分量表还需打磨。

## 动手构建

### 第 1 步：用 NLI 实现 faithfulness（RAGAS 风格）

```python
from typing import Callable
from transformers import pipeline

nli = pipeline("text-classification",
               model="MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli",
               top_k=None)

# `llm` 是任意可调用对象：提示词 str -> 生成的 str。
# 示例：llm = lambda p: client.messages.create(model="claude-haiku-4-5", ...).content[0].text
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

把答案分解为原子化的主张（atomic claims）。对每条主张针对检索到的上下文做 NLI 检验。Faithfulness = 被支持主张的占比。

### 第 2 步：answer relevance（答案相关性）

```python
import numpy as np
from sentence_transformers import SentenceTransformer

# encoder：任意实现了 .encode(texts, normalize_embeddings=True) -> ndarray 的模型
# 例如：encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")

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

如果答案所暗示的问题与实际被问的问题不同，相关性就会下降。

### 第 3 步：G-Eval 自定义指标

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

这些评测步骤就是评分量表。显式的步骤比隐式的「打 0-1 分」提示词更稳定。

### 第 4 步：CI 门禁

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

作为一个 pytest 文件交付。在每个 PR 上运行。一旦发生回归就阻止合并。

### 第 5 步：从零实现的玩具评测

参见 `code/main.py`。仅用标准库（stdlib）对 faithfulness（答案主张与上下文的重叠）和 relevance（答案词元与问题词元的重叠）做近似实现。不可用于生产。只是展示其大致形态。

## 常见陷阱

- **没有校准。** 与人工标注相关性只有 0.3 的评委就是噪声。在上线前必须强制做一次校准运行。
- **自我评测。** 用同一个大模型既生成又评判，会让分数虚高 10-20%。评委要用不同的模型家族。
- **成对评判中的位置偏见。** 评委偏好呈现给它的第一个选项。务必随机化顺序并双向都跑一遍。
- **原始聚合值掩盖失败。** 0.85 的平均分往往掩盖了 5% 的灾难性失败。务必检查最低分位区间（bottom quantile）。
- **黄金数据集腐化。** 未做版本管理、随时间漂移的评测集会破坏纵向比较。每次改动都给数据集打标签。
- **大模型成本。** 在规模上，评委调用会主导成本。使用能满足校准阈值的最便宜的模型。例如 GPT-4o-mini、Claude Haiku、Mistral-small。

## 实战选型

2026 年的技术栈：

| 使用场景 | 框架 |
|---------|-----------|
| RAG 质量监控 | RAGAS（4 项指标） |
| CI/CD 回归门禁 | DeepEval + pytest |
| 自定义领域评判标准 | DeepEval 中的 G-Eval |
| 线上实时流量监控 | RAGAS 的无参考（reference-free）模式 |
| 人在回路（human-in-the-loop）抽检 | 带标注 UI 的 LangSmith 或 Phoenix |
| 红队 / 安全评测 | Promptfoo + DeepEval |

典型技术栈：RAGAS 用于监控，DeepEval 用于 CI，G-Eval 用于新颖维度。三者都跑；它们之间的分歧很有参考价值。

## 交付产物

保存为 `outputs/skill-eval-architect.md`：

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

## 练习

1. **简单。** 在 10 个含已知幻觉的 RAG 样例上使用 RAGAS。验证 faithfulness 指标能逐一捕捉到它们。
2. **中等。** 对 50 个 QA 答案按正确性手工标注 0-1。用 G-Eval 打分。测量评委与人类之间的 Spearman rho。
3. **困难。** 用 DeepEval 构建一个 pytest CI 门禁。故意让检索器发生回归。验证门禁会失败。通过对最低 10% 的阈值检查，加入最低分位告警。

## 关键术语

| 术语 | 人们常说 | 它的真正含义 |
|------|-----------------|-----------------------|
| LLM-as-judge | 用大模型来打分 | 提示一个评委模型，依据评分量表给输出打 0-1 分。 |
| RAGAS | 那个 RAG 指标库 | 开源评测框架，含 4 项无参考的 RAG 指标。 |
| Faithfulness | 答案有没有依据 | 被检索上下文所蕴含的答案主张占比。 |
| Context precision | 检索到的分块相关吗 | top-K 分块中真正起作用的占比。 |
| Context recall | 检索把该找的都找全了吗 | 标准答案中的主张被检索分块支持的占比。 |
| G-Eval | 自定义大模型评委 | 评分量表 + 思维链评测步骤 + 0-1 分。 |
| Calibration | 信任但要核验 | 评委分数与人类分数之间的 Spearman 相关性。 |

## 延伸阅读

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) —— RAGAS 论文。
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634) —— G-Eval 论文。
- [DeepEval 文档](https://deepeval.com/docs/metrics-introduction) —— 开源生产技术栈。
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) —— 偏见、校准与局限。
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) —— 整合 RAGAS、DeepEval、Phoenix 的统一框架。
