# LLM Evaluation — RAGAS, DeepEval, G-Eval

> 精确匹配和F1缺乏语义等效性。人类审查没有规模。LLM担任评委是生产答案-具有足够的校准以信任数字。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 13（问题解答）、阶段5 · 14（信息检索）
** 时间：** ~75分钟

## The Problem

您的RAG系统回答：“2007年6月29日。"
黄金参考是：“2007年6月29日。"
精确比赛得分0。F1得分~ 75%。人类的评分为100%。

现在乘以10，000个测试案例。再次乘以检索器、分块、提示或模型的每次更改。您需要一个理解含义、以廉价的规模运行、不会撒谎回归并揭示正确的失败模式的评估器。

2026年有三个框架存在这个问题。

- ** 拉格斯。**检索增强一代评估。四个RAG指标（忠诚度、答案相关性、上下文精确度、上下文召回），具有NLI + LLM法官后台。研究支持，轻量级。
- **DeepEval。** LLM的Pytest。G-Eval、任务完成、幻觉、偏见指标。CI/CD原生版。
- **G-Eval。**一种方法（和DeepEval指标）：LLM作为评委，具有思维链、自定义标准、0-1评分。

这三个人都依赖法学硕士作为法官。这一课建立了对方法和围绕它的信任层的直觉。

## The Concept

![Four evaluation dimensions, LLM-as-judge architecture](../assets/llm-evaluation.svg)

** 法学硕士作为法官。**用LLM替换静态指标，该LLM为给定标题的输出评分。给定“（查询、上下文、答案）”，提示LLM法官：“忠诚度评分0-1。“返回比分。

为什么它的工作原理：LLM以极小的一部分成本逼近人类的判断。GPT-4 o-mini每个评分病例的价格约为0.003美元，可运行1000个样本回归评估，价格低于5美元。

为什么它悄无声息地失败：

1. ** 法官偏见。**评委们更喜欢更长的答案、来自他们自己的模型家族的答案、与提示风格相匹配的答案。
2. ** SON解析失败。**不好的SON-NaN分数-默默地从总数中排除。RAGAS用户知道这种痛苦。带有try/except +显式失败模式的门。
3. ** 在型号版本上漂移。**升级法官会改变每个指标。冻结评委模型+版本。

** RAG四人组。**

| 度量 | 问题 | 后端 |
|--------|----------|---------|
| 信实 | 答案中的每个主张是否来自检索到的上下文？ | 基于NLI的内涵 |
| 答案相关性 | 答案是否解决了这个问题？ | 从答案生成假设问题;与真实问题进行比较 |
| 上下文精确性 | 在检索到的块中，哪些部分是相关的？ | 法学硕士-评委 |
| 上下文回忆 | 检索是否返回了所需的一切？ | 法学硕士-裁判反对金牌答案 |

**G-Eval。**定义自定义标准：“答案引用了正确的来源吗？“该框架自动扩展到思想链评估步骤，然后评分为0-1。适用于RAGAS未涵盖的特定领域质量维度。

** 校准。**永远不要相信原始评委评分，直到你与人类标签有关联。运行100个手工标记的示例。情节法官vs人类。计算斯皮尔曼ρ。如果rho < 0.7，你的判断规则需要修改。

## Build It

### Step 1: faithfulness with NLI (RAGAS-style)

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

把答案分解成原子的声明。NLI-根据检索到的上下文检查每个声明。忠诚度=支持分数。

### Step 2: answer relevance

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

如果答案暗示的问题与所问的问题不同，相关性就会下降。

### Step 3: G-Eval custom metric

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

评估步骤是标题。显式步骤比隐式“评分0-1”提示更稳定。

### Step 4: CI gate

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

作为pytest文件发货。在每个PR上运行。块在回归上合并。

### Step 5: toy eval from scratch

请参阅' code/main.py '。仅限标准库的忠实性（答案主张与上下文的重叠）和相关性（答案令牌与问题令牌的重叠）的近似。不是生产。显示形状。

## Pitfalls

- ** 无需校准。**与人类标签相关性为0.3的判断就是噪音。运输前需要进行校准运行。
- * * 自我评估。**使用相同的LLM来生成和判断分数会增加10 - 20%。为法官使用不同的模型家族。
- ** 成对判断中的位置偏差。**法官更喜欢提出的第一个选项。始终随机顺序并同时运行。
- ** 原始聚集隐藏了失败。**平均分0.85通常隐藏5%的灾难性故障。始终检查底部分位数。
- ** 黄金数据集腐烂。**随着时间的推移而漂移的未版本评估集打破了纵向比较。为数据集标记每个更改。
- ** 法学硕士费用。**就规模而言，法官称成本占主导地位。使用满足校准阈值的最便宜型号。GPT-4o-mini，Claude Haiku，Mistral-small。

## Use It

2026年堆栈：

| 用例 | 框架 |
|---------|-----------|
| RAG质量监控 | RAGAS（4个指标） |
| CI/CD回归门 | DeepEval + pytest |
| 自定义域标准 | DeepEval中的G-Eval |
| 在线实时交通监控 | RAGAS无引用模式 |
| 人在循环抽查 | 带有注释UI的LangSmith或Phoenix |
| 红色团队/安全评估 | Advertfoo + DeepEval |

典型堆栈：用于监控的RAGAS、用于CI的DeepEval、用于新颖维度的G-Eval。全部运行三个;他们的分歧是有益的。

## Ship It

另存为“输出/skill-eval-architect.md”：

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

## Exercises

1. ** 简单。**在10个已知有幻觉的RAG例子中使用RAGAS。验证忠诚度度量是否能捕捉到每一个。
2. ** 中等。**手工标记50个QA的正确性答案为0-1。用G-Eval评分。衡量法官和人类之间的斯皮尔曼·罗。
3. ** 很难。**使用DeepEval构建一个pytest CI门。故意让猎犬倒退。验证门是否出现故障。通过对最低10%的阈值检查添加最低分位数警报。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 法学硕士担任法官 | LLM评分 | 提示判断模型在给定标题的情况下对输出进行0-1评分。 |
| 拉格 | RAG指标库 | 开源eval框架，具有4个无引用的RAG指标。 |
| 信实 | 答案是否有根据？ | 检索到的上下文所包含的答案声明的比例。 |
| 上下文精确性 | 检索到的块是否相关？ | 真正重要的前K块的比例。 |
| 上下文回忆 | 检索找到一切了吗？ | 检索到的区块支持的黄金答案主张的比例。 |
| G-Eval | 定制法学硕士法官 | Rubric +思想链评估步骤+ 0-1分数。 |
| 校准 | 信任但要核实 | 裁判评分与人类评分的Spearman相关性。 |

## Further Reading

- [Es等人（2023）。RAGAS：检索增强生成的自动评估]（https：//arxiv.org/ab/2309.15217）-RAGAS论文。
- [Liu等人（2023）。G-Eval：使用具有更好人类对齐的GPT-4进行NLG评估]（https：//arxiv.org/ab/2303.16634）-G-Eval论文。
- [DeepEval docs]（https：//deepeval.com/docs/metrics-introduction）-打开生产堆栈。
- [郑等人（2023）。通过MT-Bench和Chatbot Arena作为法官评判法学硕士]（https：//arxiv.org/ab/2306.05685）-偏差、校准、限制。
- [MLFlow GenAI Scorer]（https：//mlFlow.org/blog/third-Party-scorers）-集成RAGAS、DeepEval、Phoenix的统一框架。
