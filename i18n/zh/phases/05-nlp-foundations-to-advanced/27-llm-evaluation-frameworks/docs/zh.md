# LLM 评估 — RAGAS、DeepEval、G-Eval

> 精确匹配和 F1 无法捕捉语义等价。人工评审无法规模化。LLM-as-judge 是生产环境的答案——前提是有足够的校准来信任这个分数。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 13（问答），Phase 5 · 14（信息检索）
**Time:** ~75 分钟

## 问题所在

你的 RAG 系统回答："June 29th, 2007."
标准参考答案是："June 29, 2007."
精确匹配得分为 0。F1 得分约 75%。人类会打 100 分。

现在乘以 10,000 条测试用例。再乘以对检索器、分块、提示词或模型的每一次改动。你需要一个评估器：能理解语义、能低成本大规模运行、不会掩盖回归问题，并能暴露正确的失败模式。

2026 年有三个框架主导这个问题。

- **RAGAS.** Retrieval-Augmented Generation ASsessment。四种 RAG 指标（faithfulness、answer-relevance、context-precision、context-recall），以 NLI + LLM-judge 为后端。有研究支撑，轻量。
- **DeepEval.** LLM 的 pytest。提供 G-Eval、任务完成度、幻觉、偏差等指标。原生支持 CI/CD。
- **G-Eval.** 一种方法（也是 DeepEval 的一个指标）：LLM-as-judge，带思维链、自定义标准、0-1 评分。

三者都依赖 LLM-as-judge。本课帮助建立对该方法及其信任层的直觉。

## 概念

![Four evaluation dimensions, LLM-as-judge architecture](../assets/llm-evaluation.svg)

**LLM-as-judge.** 用一个根据评分规则对输出打分的 LLM 取代静态指标。给定 `(query, context, answer)`，提示一个裁判 LLM："按 faithfulness 打 0-1 分。"返回分数。

为什么有效：LLM 以极小的成本比例近似人类判断。GPT-4o-mini 约 $0.003 per scored case enables 1000-sample regression eval runs for under $5。

为什么它会静默失效：

1. **裁判偏差。** 裁判偏好更长的答案、来自同一家模型家族的答案、与提示词风格匹配的答案。
2. **JSON 解析失败。** 坏 JSON → NaN 分数 → 被静默排除出聚合结果。RAGAS 用户深知这种痛。用 try/except + 显式失败模式进行门控。
3. **随模型版本漂移。** 升级裁判会改变每一个指标。冻结裁判模型及版本。

**RAG 四指标。**

| 指标 | 问题 | 后端 |
|--------|----------|---------|
| Faithfulness | 答案中的每条论断是否都来自检索到的上下文？ | 基于 NLI 的蕴含判断 |
| Answer relevance | 答案是否回应了问题？ | 从答案生成假设性问题；与真实问题比较 |
| Context precision | 检索到的块中有多少比例是相关的？ | LLM-judge |
| Context recall | 检索是否返回了所有需要的内容？ | 以标准答案为参照的 LLM-judge |

**G-Eval.** 定义一个自定义标准："答案是否引用了正确的来源？"框架自动将其展开为思维链评估步骤，然后打 0-1 分。适合 RAGAS 未覆盖的领域特定质量维度。

**校准。** 在没有与人工标签的相关性验证之前，永远不要信任原始裁判分数。运行 100 条人工标注的样本。绘制裁判分数与人工分数的对比图。计算 Spearman rho。如果 rho < 0.7，你的裁判评分规则需要改进。

```figure
n5-judge-gauge
```

## 动手构建

### 步骤 1：用 NLI 计算 faithfulness（RAGAS 风格）

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

将答案分解为原子论断。用 NLI 将每条论断与检索到的上下文比对。Faithfulness = 被支持的论断比例。

### 步骤 2：answer relevance

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

如果答案暗示的问题与实际所问的问题不同，相关性就会下降。

### 步骤 3：G-Eval 自定义指标

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

评估步骤就是评分规则。显式步骤比隐式的"打 0-1 分"提示词更稳定。

### 步骤 4：CI 门控

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

以 pytest 文件的形式交付。在每个 PR 上运行。出现回归时阻止合并。

### 步骤 5：从零实现的玩具评估

见 `code/main.py`。仅用标准库近似实现 faithfulness（答案论断与上下文的重叠）和 relevance（答案词元与问题词元的重叠）。非生产级。展示其形态。

## 常见陷阱

- **不做校准。** 与人工标签相关性只有 0.3 的裁判就是噪音。交付前必须先运行校准。
- **自我评估。** 用同一个 LLM 既生成又评分会使分数虚高 10-20%。为裁判使用不同的模型家族。
- **成对比较中的位置偏差。** 裁判偏好先呈现的选项。务必随机化顺序并双向运行。
- **原始聚合值掩盖失败。** 平均分 0.85 往往掩盖了 5% 的灾难性失败。务必检查最低分位。
- **黄金数据集腐化。** 无版本管理、随时间漂移的评估集会破坏纵向比较。每次变更都给数据集打标签。
- **LLM 成本。** 在规模化场景下，裁判调用主导成本。使用满足校准阈值的最便宜模型。GPT-4o-mini、Claude Haiku、Mistral-small。

## 应用场景

2026 年的技术栈：

| 使用场景 | 框架 |
|---------|-----------|
| RAG 质量监控 | RAGAS（4 项指标） |
| CI/CD 回归门控 | DeepEval + pytest |
| 自定义领域标准 | DeepEval 内的 G-Eval |
| 在线实时流量监控 | RAGAS 无参考模式 |
| 人工抽检 | LangSmith 或 Phoenix（带标注 UI） |
| 红队测试 / 安全评估 | Promptfoo + DeepEval |

典型技术栈：RAGAS 用于监控，DeepEval 用于 CI，G-Eval 用于新维度。三者都运行；它们的分歧有参考价值。

## 交付

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

1. **简单。** 对 10 个已知存在幻觉的 RAG 示例使用 RAGAS。验证 faithfulness 指标能捕捉到每一个。
2. **中等。** 人工为 50 个 QA 答案按正确性打 0-1 分。用 G-Eval 打分。测量裁判与人工之间的 Spearman rho。
3. **困难。** 用 DeepEval 构建一个 pytest CI 门控。故意降低检索器性能。验证门控失败。通过在最低 10% 上做阈值检查，添加最低分位告警。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| LLM-as-judge | 用 LLM 打分 | 给定评分规则，提示裁判模型对输出打 0-1 分。 |
| RAGAS | RAG 指标库 | 开源评估框架，含 4 项无参考 RAG 指标。 |
| Faithfulness | 答案是否有据可依？ | 被检索上下文蕴含的答案论断比例。 |
| Context precision | 检索到的块相关吗？ | top-K 块中真正重要的比例。 |
| Context recall | 检索找到全部内容了吗？ | 被检索块支持的标准答案论断比例。 |
| G-Eval | 自定义 LLM 裁判 | 评分规则 + 思维链评估步骤 + 0-1 分数。 |
| Calibration | 信任但要验证 | 裁判分数与人工分数之间的 Spearman 相关性。 |

## 延伸阅读

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) — RAGAS 论文。
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634) — G-Eval 论文。
- [DeepEval 文档](https://deepeval.com/docs/metrics-introduction) — 开放的生产技术栈。
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) — 偏差、校准、局限。
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) — 集成 RAGAS、DeepEval、Phoenix 的统一框架。