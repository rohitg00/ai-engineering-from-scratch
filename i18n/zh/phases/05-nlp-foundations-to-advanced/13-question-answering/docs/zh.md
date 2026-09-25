# 问答系统

> 三种系统塑造了现代问答。抽取式找到文本片段。检索增强将其锚定在文档中。生成式产出答案。每个现代 AI 助手都是三者的混合体。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 11（机器翻译），Phase 5 · 10（注意力机制）
**Time:** 约 75 分钟

## 问题所在

用户输入“第一代 iPhone 是什么时候发布的？”并期望得到“2007 年 6 月 29 日”。而不是“苹果的历史悠久而多变”。也不是孤立地给出“2007”而没有完整句子。用户要的是直接、有依据、正确的答案。

过去十年里，三种架构主导了问答领域。

- **抽取式问答。** 给定一个问题和一段已知包含答案的文本，在文本中找到答案片段的起止索引。SQuAD 是标准基准。
- **开放域问答。** 不给定期望文本。先检索相关段落，再抽取或生成答案。这是当今所有 RAG 管线的基石。
- **生成式 / 闭卷问答。** 大型语言模型从其参数化记忆中作答。无检索。推理最快，事实可靠性最低。

2026 年的趋势是混合式：先检索出最好的几个段落，然后提示生成式模型基于这些段落作答。这就是 RAG，第 14 课深入讲解了检索部分。本课构建问答部分。

## 核心概念

![QA architectures: extractive, retrieval-augmented, generative](../assets/qa.svg)

**抽取式。** 用 transformer（BERT 系列）将问题和文本一起编码。训练两个头，分别预测答案的起止 token 索引。损失是在有效位置上的交叉熵。输出是文本中的一个片段。从构造上保证不会产生幻觉，也从构造上无法处理文本无法回答的问题。

**检索增强（RAG）。** 两个阶段。首先，检索器从语料库中找出 top-`k` 个段落。其次，阅读器（抽取式或生成式）使用这些段落生成答案。检索器-阅读器的分离使两者可以独立训练和评估。现代 RAG 常在两者之间加入重排序器。

**生成式。** 仅解码器的 LLM（GPT、Claude、Llama）从学到的权重中作答。无检索步骤。对常识表现出色，对罕见或近期事实则表现灾难性。幻觉率与预训练数据中的事实频率成反比。

```figure
qa-span
```

## 动手构建

### 第 1 步：使用预训练模型的抽取式问答

```python
from transformers import pipeline

qa = pipeline("question-answering", model="deepset/roberta-base-squad2")

passage = (
    "Apple Inc. released the first iPhone on June 29, 2007. "
    "The device was announced by Steve Jobs at Macworld in January 2007."
)
question = "When was the first iPhone released?"

answer = qa(question=question, context=passage)
print(answer)
```

```python
{'score': 0.98, 'start': 57, 'end': 70, 'answer': 'June 29, 2007'}
```

`deepset/roberta-base-squad2` 在 SQuAD 2.0 上训练，该数据集包含不可回答的问题。默认情况下，即使模型的 null 分数胜出，`question-answering` 管线也会返回得分最高的片段——它*不会*自动返回空答案。要获得明确的“无答案”行为，需在管线调用中传入 `handle_impossible_answer=True`：这样只有在 null 分数超过所有片段分数时，管线才会返回空答案。无论如何，都要检查 `score` 字段。

### 第 2 步：一个检索增强管线（草图）

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

corpus = [
    "Apple Inc. released the first iPhone on June 29, 2007.",
    "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
    "Android launched in 2008 as Google's mobile operating system.",
    "The first iPod was released in 2001.",
]
corpus_embeddings = encoder.encode(corpus, normalize_embeddings=True)


def retrieve(question, top_k=2):
    q_emb = encoder.encode([question], normalize_embeddings=True)
    sims = (corpus_embeddings @ q_emb.T).squeeze()
    order = np.argsort(-sims)[:top_k]
    return [corpus[i] for i in order]


def answer(question):
    passages = retrieve(question, top_k=2)
    combined = " ".join(passages)
    return qa(question=question, context=combined)


print(answer("When was the first iPhone released?"))
```

两阶段管线。稠密检索器（Sentence-BERT）通过语义相似度找到相关段落。抽取式阅读器（RoBERTa-SQuAD）从合并后的顶级段落中提取答案片段。适用于小型语料库。对于百万级文档语料库，请使用 FAISS 或向量数据库。

### 第 3 步：带 RAG 的生成式问答

```python
def rag_generate(question, llm):
    passages = retrieve(question, top_k=3)
    prompt = f"""Context:
{chr(10).join('- ' + p for p in passages)}

Question: {question}

Answer using only the context above. If the context does not contain the answer, say "I don't know."
"""
    return llm(prompt)
```

提示模式很重要。与朴素提示相比，明确告诉模型基于上下文作答、并在上下文不足时返回“我不知道”，可将幻觉率降低 40-60%。更精细的模式会增加引用、置信度分数和结构化抽取。

### 第 4 步：反映真实世界的评估

SQuAD 使用**精确匹配（EM）**和**token 级 F1**。EM 是归一化后（小写、去除标点、删除冠词）的严格匹配——预测要么完全匹配，要么得 0 分。F1 基于预测与参考之间的 token 重叠计算，给予部分得分。两者都会低估改写：“June 29, 2007” vs “June 29th, 2007” 通常得 0 EM（序数后缀破坏了归一化），但重叠的 token 仍能获得可观的 F1。

对于生产级问答：

- **答案准确率**（由 LLM 或人工评判，因为指标无法捕捉语义等价性）。
- **引用准确率。** 被引用的段落是否真的支持答案？通过在生成的引用与检索到的段落之间做字符串匹配，可以轻松自动检查。
- **拒答校准。** 当答案不在检索到的段落中时，系统是否正确地说“我不知道”？测量虚假置信率。
- **检索召回率。** 在评估阅读器之前，先测量检索器是否把正确的段落排进了 top-`k`。阅读器无法弥补缺失的段落。

### RAGAS：2026 年的生产级评估框架

`RAGAS` 专为 RAG 系统设计，是 2026 年的上线默认选择。它无需黄金参考即可对四个维度评分：

- **忠实度。** 答案中的每个论断是否都来自检索到的上下文？通过基于 NLI 的蕴含来测量。这是你首要的幻觉指标。
- **答案相关性。** 答案是否回应了问题？通过从答案生成假设性问题并与真实问题比较来测量。
- **上下文精确率。** 检索到的块中，实际相关的比例是多少？低精确率 = 提示中存在噪声。
- **上下文召回率。** 检索到的集合是否包含所有必需的信息？低召回率 = 阅读器无法成功。

无参考评分让你可以在实时生产流量上评估，而无需人工整理的黄金答案。在精确匹配指标失效的开放式问题上，再叠加 LLM-as-judge。

`pip install ragas`。接入你的检索器 + 阅读器。每个查询获得四个标量。对退化发出告警。

## 实际应用

2026 年的技术栈。

| 使用场景 | 推荐方案 |
|---------|-------------|
| 给定文本，找到答案片段 | `deepset/roberta-base-squad2` |
| 遍历固定语料库，闭卷不可接受 | RAG：稠密检索器 + LLM 阅读器 |
| 文档库上的实时问答 | 带混合检索器（BM25 + 稠密）+ 重排序器的 RAG（第 14 课） |
| 对话式问答（追问） | 带对话历史的 LLM + 每轮使用 RAG |
| 高事实性、受监管的领域 | 在权威语料库上做抽取式；绝不能只用生成式 |

抽取式问答在 2026 年不再流行，因为带 LLM 的 RAG 能覆盖更多场景。它仍在需要逐字引用的场景中上线：法律检索、合规监管、审计工具。

## 上线部署

保存为 `outputs/skill-qa-architect.md`:

```markdown
---
name: qa-architect
description: Choose QA architecture, retrieval strategy, and evaluation plan.
version: 1.0.0
phase: 5
lesson: 13
tags: [nlp, qa, rag]
---

Given requirements (corpus size, question type, factuality constraint, latency budget), output:

1. Architecture. Extractive, RAG with extractive reader, RAG with generative reader, or closed-book LLM. One-sentence reason.
2. Retriever. None, BM25, dense (name the encoder), or hybrid.
3. Reader. SQuAD-tuned model, LLM by name, or "domain-fine-tuned DistilBERT."
4. Evaluation. EM + F1 for extractive benchmarks; answer accuracy + citation accuracy + refusal calibration for production. Name what you are measuring and how you are measuring it.

Refuse closed-book LLM answers for regulatory or compliance-sensitive questions. Refuse any QA system without a retrieval-recall baseline (you cannot evaluate the reader without knowing the retriever surfaced the right passage). Flag questions that require multi-hop reasoning as needing specialized multi-hop retrievers like HotpotQA-trained systems.
```

## 练习

1. **简单。** 在 10 个维基百科段落上搭建上述 SQuAD 抽取式管线。手工编写 10 个问题。测量答案正确的频率。如果段落和问题都很干净，你应该能看到 7-9 个正确。
2. **中等。** 添加一个拒答分类器。当最高检索得分低于某个阈值（如 0.3 余弦相似度）时，返回“我不知道”而不是调用阅读器。在留出集上调节阈值。
3. **困难。** 在你选择的 10,000 个文档语料库上构建 RAG 管线。实现带 RRF 融合的混合检索（BM25 + 稠密）（见第 14 课）。测量有/无混合步骤时的答案准确率。记录哪些问题类型受益最大。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 抽取式问答 | 找到答案片段 | 在给定文本中预测答案的起止索引。 |
| 开放域问答 | 语料库上的问答 | 不给定期望文本；必须先检索再作答。 |
| RAG | 先检索再生成 | 检索增强生成。检索器 + 阅读器管线。 |
| SQuAD | 标准基准 | 斯坦福问答数据集。EM + F1 指标。 |
| 幻觉 | 编造的答案 | 阅读器输出不被检索到的上下文支持。 |
| 拒答校准 | 知道何时闭嘴 | 系统在无法作答时正确地说“我不知道”。 |

## 延伸阅读

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250) — 基准论文。
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) — DPR，问答领域的标准稠密检索器。
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) — 命名 RAG 的论文。
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) — 全面的 RAG 综述。