# LLM 评估 — RAGAS、DeepEval、G-Eval

> 精确匹配和 F1 无法捕捉语义等价。人工审查无法规模化。LLM-as-judge 是生产环境的答案——但需要足够的校准来信任这个分数。

**类型：** 构建
**语言：** Python
**前置条件：** 阶段 5 · 13（问答）、阶段 5 · 14（信息检索）
**时间：** 约 75 分钟

## 问题

你的 RAG 系统回答："June 29th, 2007."
金标准答案是："June 29, 2007."
精确匹配得分为 0。F1 约为 75%。人类评分则为 100%。

现在将这个测试乘以 10,000 个案例。再乘以每次对检索器、分块、提示词或模型的更改。你需要一个评估器，它能理解语义、在规模化下低成本运行、不隐瞒回归问题，并呈现正确的失败模式。

2026 年，有三个框架主导了这个问题。

- **RAGAS.** 检索增强生成评估。包含四个 RAG 指标（忠实度、答案相关性、上下文精确度、上下文召回率），后端基于 NLI + LLM 评判。经过研究验证，轻量级。
- **DeepEval.** 面向 LLM 的 Pytest。包含 G-Eval、任务完成度、幻觉、偏见等指标。原生支持 CI/CD。
- **G-Eval.** 一种方法（以及 DeepEval 中的一个指标）：基于思维链（Chain-of-Thought）、自定义标准、0-1 评分的 LLM-as-judge。

这三个框架都依赖 LLM-as-judge。本课程将建立对该方法及其信任层（Trust Layer）的直觉。

## 概念

![四个评估维度，LLM-as-judge 架构](../assets/llm-evaluation.svg)

**LLM-as-judge.** 用静态指标替换为 LLM，由 LLM 根据给定的评分规则对输出进行评分。给定 `(查询，上下文，答案)`，向评判模型（Judge LLM）提示："根据忠实度评分 0-1。"返回分数。

为什么有效：LLM 以极低的成本近似人类判断。GPT-4o-mini 每次评分约 $0.003，使得 1000 个样本的回归评估运行成本低于 $5。

为什么它会静默失败：

1. **评判偏见（Judge bias）。** 评判模型偏爱更长的答案、来自自己模型家族的答案、与提示风格匹配的答案。
2. **JSON 解析失败。** 错误的 JSON → NaN 分数 → 在聚合中被静默排除。RAGAS 用户深知此痛点。通过 try/except + 显式失败模式来处理。
3. **模型版本漂移。** 升级评判模型会改变所有指标。冻结评判模型的型号和版本。

**RAG 四指标。**

| 指标 | 问题 | 后端 |
|--------|----------|---------|
| 忠实度 | 答案中的每个主张是否都来自检索到的上下文？ | 基于 NLI 的蕴含关系 |
| 答案相关性 | 答案是否回答了问题？ | 从答案生成假设性问题；与真实问题比较 |
| 上下文精确度 | 在检索到的分块中，有多大比例是相关的？ | LLM 评判 |
| 上下文召回率 | 检索是否返回了所有必要信息？ | 根据金标准答案进行 LLM 评判 |

**G-Eval.** 定义一个自定义标准："答案是否引用了正确的来源？"框架会自动将其扩展为思维链评估步骤，然后评分 0-1。适用于 RAGAS 未覆盖的特定领域质量维度。

**校准。** 在获得与人类标签的相关性之前，切勿信任原始评判分数。运行 100 个人工标注的示例。绘制评判分数与人类分数图。计算斯皮尔曼等级相关系数 rho。如果 rho < 0.7，则你的评判规则需要改进。

## 构建

### 第一步：使用 NLI 进行忠实度评估（RAGAS 风格）

```python
from typing import Callable
from transformers import pipeline

nli = pipeline("text-classification",
               model="MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli",
               top_k=None)

# `llm` 是任何可调用对象：提示字符串 -> 生成字符串。
# 示例：llm = lambda p: client.messages.create(model="claude-haiku-4-5", ...).content[0].text
LLM = Callable[[str], str]


def atomic_claims(answer: str, llm: LLM) -> list[str]:
    prompt = f"""将这个答案分解成简单的事实性主张（每行一个）：
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

将答案分解为原子主张（Atomic Claims）。对每个主张与检索到的上下文进行 NLI 检查。忠实度 = 被支持主张的比例。

### 第二步：答案相关性

```python
import numpy as np
from sentence_transformers import SentenceTransformer

# encoder: 任何实现 .encode(texts, normalize_embeddings=True) -> ndarray 的模型
# 例如：encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")

def answer_relevance(question: str, answer: str, encoder, llm: LLM, n: int = 3) -> float:
    prompt = f"写出 {n} 个这个问题可能作为答案的问题：\n{answer}"
    generated = [line for line in llm(prompt).splitlines() if line.strip()][:n]
    if not generated:
        return 0.0
    q_emb = np.asarray(encoder.encode([question], normalize_embeddings=True)[0])
    g_embs = np.asarray(encoder.encode(generated, normalize_embeddings=True))
    sims = [float(q_emb @ g_emb) for g_emb in g_embs]
    return sum(sims) / len(sims)
```

如果答案暗示的问题与所问的不同，则相关性降低。

### 第三步：G-Eval 自定义指标

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams, LLMTestCase

metric = GEval(
    name="正确性",
    criteria="答案应事实准确并与预期输出匹配。",
    evaluation_steps=[
        "阅读预期输出。",
        "阅读实际输出。",
        "列出实际输出中的事实性主张。",
        "对于每个主张，标记为预期输出支持或未支持。",
        "返回分数 = 被支持的比例。",
    ],
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
)

test = LLMTestCase(input="第一代 iPhone 是什么时候发布的？",
                   actual_output="2007年6月29日。",
                   expected_output="2007年6月29日。")
metric.measure(test)
print(metric.score, metric.reason)
```

评估步骤就是评分规则。显式的步骤比隐式的"评分 0-1"提示更稳定。

### 第四步：CI 关卡

```python
import deepeval
from deepeval.metrics import FaithfulnessMetric, ContextualRelevancyMetric


def test_rag_system():
    cases = load_regression_cases()
    faith = FaithfulnessMetric(threshold=0.85)
    rel = ContextualRelevancyMetric(threshold=0.7)
    for case in cases:
        faith.measure(case)
        assert faith.score >= 0.85, f"case {case.id} 的忠实度回归"
        rel.measure(case)
        assert rel.score >= 0.7, f"case {case.id} 的相关性回归"
```

将其作为 pytest 文件部署。在每个 PR 上运行。在回归问题上阻止合并。

### 第五步：从头开始的玩具评估

参见 `code/main.py`。仅使用标准库实现的忠实度（答案主张与上下文的重叠）和相关性（答案词元与问题词元的重叠）的近似版。不能用于生产环境。仅展示形状。

## 陷阱

- **未校准。** 与人类标签相关性为 0.3 的评判模型就是噪声。要求在部署之前进行校准运行。
- **自我评估。** 使用同一个 LLM 生成和评判会使分数虚高 10-20%。评判模型应使用不同的模型家族。
- **成对评判中的位置偏见。** 评判者更喜欢第一个选项。务必随机化顺序并运行两次。
- **原始聚合掩盖了失败。** 平均分 0.85 通常掩盖了 5% 的灾难性失败。务必检查最低分位。
- **金标准数据集腐化。** 未版本化的评估集随时间漂移，会破坏纵向比较。每次更改都标记数据集。
- **LLM 成本。** 在规模化下，评判模型的调用占主导成本。使用满足校准阈值的最便宜的模型。GPT-4o-mini、Claude Haiku、Mistral-small。

## 使用

2026 年的技术栈：

| 用例 | 框架 |
|---------|-----------|
| RAG 质量监控 | RAGAS（4 个指标） |
| CI/CD 回归关卡 | DeepEval + pytest |
| 自定义领域标准 | DeepEval 中的 G-Eval |
| 在线实时流量监控 | RAGAS 无参考模式 |
| 人在回路抽查 | LangSmith 或带标注界面的 Phoenix |
| 红队/安全评估 | Promptfoo + DeepEval |

典型技术栈：RAGAS 用于监控，DeepEval 用于 CI，G-Eval 用于新颖的维度。同时运行三者；它们之间会存在有意义的差异。

## 交付

保存为 `outputs/skill-eval-architect.md`：

```markdown
---
name: eval-architect
description: 设计一个包含校准后评判模型和 CI 关卡的 LLM 评估计划。
version: 1.0.0
phase: 5
lesson: 27
tags: [nlp, evaluation, rag]
---

给定一个用例（RAG / 智能体 / 生成式任务），输出：

1. 指标。忠实度 / 相关性 / 上下文精确度 / 上下文召回率 + 任何带标准的自定义 G-Eval 指标。
2. 评判模型。指定的模型 + 版本，成本与准确性的理由。
3. 校准。人工标注集的大小，与人类评分的目标斯皮尔曼 rho > 0.7。
4. 数据集版本控制。标签策略，变更日志，分层。
5. CI 关卡。每个指标的阈值，回归窗口逻辑，最低分位告警。

拒绝依赖未经 ≥50 个人工标注示例测试的评判模型。拒绝自我评估（同一模型生成并评判）。拒绝仅聚合报告而不显示最低 10% 的情况。标记任何在未进行并行基线评估的情况下升级评判模型的流水线。
```

## 练习

1. **简单。** 在 10 个已知存在幻觉的 RAG 示例上使用 RAGAS。验证忠实度指标能捕获每一个。
2. **中等。** 人工标注 50 个问答答案的正确性（0-1 分）。使用 G-Eval 评分。测量评判模型与人类之间的斯皮尔曼 rho。
3. **困难。** 使用 DeepEval 构建一个 pytest CI 关卡。故意使检索器退化。验证关卡会失败。通过检查最低 10% 的阈值添加最低分位告警。

## 关键词

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| LLM-as-judge | 使用 LLM 进行评分 | 提示评判模型根据评分规则对输出进行 0-1 评分。 |
| RAGAS | RAG 指标库 | 开源评估框架，包含 4 个无参考的 RAG 指标。 |
| 忠实度 | 答案是否基于事实？ | 答案中被检索上下文蕴含的主张的比例。 |
| 上下文精确度 | 检索到的分块是否相关？ | 前 K 个分块中实际重要的比例。 |
| 上下文召回率 | 检索是否找齐了所有信息？ | 金标准答案中被检索分块支持的主张的比例。 |
| G-Eval | 自定义 LLM 评判 | 评分规则 + 思维链评估步骤 + 0-1 分数。 |
| 校准 | 信任但验证 | 评判分数与人类分数之间的斯皮尔曼相关系数。 |

## 延伸阅读

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) — RAGAS 论文。
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634) — G-Eval 论文。
- [DeepEval 文档](https://deepeval.com/docs/metrics-introduction) — 开源生产技术栈。
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) — 偏见、校准、局限性。
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) — 集成 RAGAS、DeepEval、Phoenix 的统一框架。