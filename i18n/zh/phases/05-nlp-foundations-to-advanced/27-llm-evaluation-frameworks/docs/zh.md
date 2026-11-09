# 法学士评价 RAGAS,DeepEval,G-Eval

> 精确匹配和F1失去了语义等效. 人类审查不扩展. LLM作为法官是生产答案,具有足够的校准度以信任数字.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## 问题

你的RAG系统回答:"2007年6月29日".
黄金的参考是:"2007年6月29日".
精确的比赛得分0.F1得分约75%.

现在乘以1万个测试案例. 再乘以每次检索器,分量,提示或模型的变化.你需要一个理解意义的评估员,在尺度上运行便宜,不撒谎关于回归,并显示正确的失败模式.

2026年有三个框架,

- **RAGAS.**检索增强代代 ASsessment. 四个RAG指标 (忠诚度,答案相关性,文本精确性,文本回忆) 与NLI + LLM评审后台. 研究支持,轻量.
- **DeepEval.**士的考试. G-Eval,任务完成,幻觉,偏见指标. CI/CD原生.
- **G-Eval.**一种方法 (以及一个DeepEval指标):具有思想链的法官,定制标准,0-1分数.

这一课建立了对方法的直觉,

## 概念

![Four evaluation dimensions, LLM-as-judge architecture](../assets/llm-evaluation.svg)

**LLM-as-judge.**取代静态指标的LLM,该指标将给出的输出进行评分.`(query, context, answer)`让法官说:"忠诚度为0:1".

法律法学在成本的微小部分上,接近人类判断力.$0.003 per scored case enables 1000-sample regression eval runs for under $5. 如何?

为什么它默默失败:

1. **Judge bias.**评委们更喜欢更长的答案,来自他们自己的模特家庭的答案,
2. **JSON parsing failures.**坏JSON → NaN分数 →默默排除在总体中.RAGAS用户知道这种痛苦.试用/除+明确失败模式的门.
3. **Drift over model versions.**升级评审者改变了每一个指标.

**The RAG four.**

| Metric | Question | Backend |
|--------|----------|---------|
| Faithfulness | Does each claim in the answer come from the retrieved context? | NLI-based entailment |
| Answer relevance | Does the answer address the question? | Generate hypothetical questions from answer; compare to real question |
| Context precision | Of retrieved chunks, what fraction were relevant? | LLM-judge |
| Context recall | Did retrieval return everything needed? | LLM-judge against gold answer |

**G-Eval.**定义一个定制标准:"答案是否引用了正确的来源?"框架自动扩展到思想链评估步骤,然后得分为0-1.对域特定质量维度很好.RAGAS不涵盖.

**Calibration.**永远不要相信原始评审员的分数,直到你与人类标签相对相关性.运行100个手工标签的例子.剧情评审员与人类.计算Spearman rho.如果 rho <0.7,你的评审员条目需要工作.

```figure
n5-judge-gauge
```

## 建立它

### 步骤1:对NLI (RAGAS类型) 的忠诚性

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

解答到原子索赔. NLI 检查每个索赔与检索的文本. 忠实性 = 支持的分数.

### 步骤2:答案的相关性

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

如果答案与问的不同,

### 步骤3:G-Eval 定制指标

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

显而易见的步骤比隐含的"0-1分数"提示更稳定.

### 步骤4:CI门

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

作为一个 pytest文件,运行每一个 PR. 块在回归合并.

### 步骤5:从零开始评估玩具

看到`code/main.py`仅仅仅是对信任性 (答案要求与背景重叠) 和相关性 (答案代币与问题代币重叠) 的近似. 不是生产.显示形状.

## 陷

- **No calibration.**对于人类标签的0.3相关性,是噪音.
- **Self-evaluation.**通过使用相同的法学士来生成和判断, 提高得分10-20%.
- **Positional bias in pairwise judging.**评委更喜欢第一个选择,总是随机排序,运行两者.
- **Raw aggregate hides failures.**平均分数0.85通常隐藏5%的灾难性失败.
- **Golden dataset rot.**随着时间的推移而流动的未经翻译的评估集打破了纵向比较.
- **LLM cost.**根据标准,评委的要求, 控制成本. 使用符合校准门的最便宜模型.

## 用它

现在,我们要做什么?

| Use case | Framework |
|---------|-----------|
| RAG quality monitoring | RAGAS (4 metrics) |
| CI/CD regression gates | DeepEval + pytest |
| Custom domain criteria | G-Eval within DeepEval |
| Online live-traffic monitoring | RAGAS with reference-free mode |
| Human-in-the-loop spot checks | LangSmith or Phoenix with annotation UI |
| Red-teaming / safety eval | Promptfoo + DeepEval |

典型的堆:RAGAS用于监测,DepEval用于CI,G-Eval用于新尺寸.运行三个;它们非常不一致.

## 运送它

保存如`outputs/skill-eval-architect.md`其他:

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

## 运动

1. **Easy.**通过使用RAGAS在已知幻觉的10个RAG例子上.
2. **Medium.**标签50个质量答案为0-1对准确性. 通过G-Eval,测量Spearman rho在法官和人类之间.
3. **Hard.**通过 DeepEval 构建一个最难的CI门. 故意退回检索器. 检查门失败. 通过最低10%的门检查添加底部量子力学警报.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LLM-as-judge | Scoring with an LLM | Prompt a judge model to score outputs 0-1 given a rubric. |
| RAGAS | The RAG metric library | Open-source eval framework with 4 reference-free RAG metrics. |
| Faithfulness | Is the answer grounded? | Fraction of answer claims entailed by retrieved context. |
| Context precision | Were retrieved chunks relevant? | Fraction of top-K chunks that actually mattered. |
| Context recall | Did retrieval find everything? | Fraction of gold-answer claims supported by retrieved chunks. |
| G-Eval | Custom LLM judge | Rubric + chain-of-thought eval steps + 0-1 score. |
| Calibration | Trust but verify | Spearman correlation between judge score and human score. |

## 进一步阅读

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217)RAGAS的报纸.
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634)G-Eval纸
- [DeepEval docs](https://deepeval.com/docs/metrics-introduction)开放生产堆.
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685)偏见,校准,限制.
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers)统一框架,将RAGAS,DeepEval,Phoenix集成在一起.
