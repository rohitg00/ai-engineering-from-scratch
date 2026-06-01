# 13 · 问答系统

> 三种系统塑造了现代问答。抽取式找出答案片段。检索增强将其锚定在文档之中。生成式直接产出答案。每一个现代 AI 助手都是这三者的混合体。

**类型：** 构建
**语言：** Python
**前置：** 阶段 5 · 11（机器翻译）、阶段 5 · 10（注意力机制）
**时长：** 约 75 分钟

## 问题所在

用户输入「第一代 iPhone 是什么时候发布的？」，期待得到「2007 年 6 月 29 日」。不是「苹果的历史悠久而多样」。也不是孤零零的、没有任何语句包裹的「2007」。而是一个直接、有据可依、正确的答案。

过去十年里，三种架构在问答领域占据了主导地位。

- **抽取式问答（Extractive QA）。** 给定一个问题和一段已知包含答案的文章，找出答案片段在文章中的起始与结束索引。SQuAD 是该领域的标杆基准。
- **开放域问答（Open-domain QA）。** 不给定文章。先检索出相关文章，再抽取或生成答案。这是当今每一条 RAG 流水线的基石。
- **生成式 / 闭卷问答（Generative / Closed-book QA）。** 由大型语言模型凭其参数化记忆作答。无检索环节。推理速度最快，但在事实方面最不可靠。

2026 年的趋势是混合式：先检索出最相关的几段文章，再提示一个生成式模型基于这些文章作答。这就是 RAG，第 14 课会深入讲解其中的检索一半。本课构建的是问答一半。

## 核心概念

〔图：问答架构：抽取式、检索增强、生成式〕

**抽取式。** 用一个 transformer（BERT 系列）将问题与文章一起编码。训练两个预测头，分别预测答案的起始与结束 token 索引。损失函数是在合法位置上的交叉熵。输出是文章中的一个片段。从构造上看它永远不会幻觉，也永远无法处理文章本身无法回答的问题。

**检索增强（RAG）。** 分两个阶段。首先，检索器从语料库中找出排名前 `k` 的文章。其次，阅读器（抽取式或生成式）利用这些文章产出答案。检索器与阅读器的分离让两者可以独立训练和评估。现代 RAG 常常在两者之间再加一个重排器（reranker）。

**生成式。** 一个仅解码器（decoder-only）的大型语言模型（GPT、Claude、Llama）凭学到的权重作答。没有检索步骤。在常识方面表现出色，在罕见或近期事实方面则灾难性地失败。幻觉率与事实在预训练数据中出现的频率呈负相关。

## 动手构建

### 第 1 步：用预训练模型做抽取式问答

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

`deepset/roberta-base-squad2` 在 SQuAD 2.0 上训练，该数据集包含无法回答的问题。默认情况下，`question-answering` 流水线会返回得分最高的片段，即便模型的空答案得分（null score）胜出也是如此——它*不会*自动返回空答案。要获得显式的「无答案」行为，请在调用流水线时传入 `handle_impossible_answer=True`：此后流水线仅在空答案得分超过所有片段得分时才返回空答案。无论哪种方式，都务必检查 `score` 字段。

### 第 2 步：检索增强流水线（示意）

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

两阶段流水线。稠密检索器（Sentence-BERT）通过语义相似度找出相关文章。抽取式阅读器（RoBERTa-SQuAD）从合并后的最相关文章中抽取答案片段。适用于小型语料库。面对百万级文档的语料库时，请使用 FAISS 或向量数据库。

### 第 3 步：结合 RAG 的生成式

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

提示词的写法很关键。明确告诉模型基于上下文作答、并在上下文不足时返回「I don't know」，相比朴素提示能将幻觉率降低 40%-60%。更精细的写法还会加入引用、置信度分数以及结构化抽取。

### 第 4 步：贴合真实世界的评估

SQuAD 使用**精确匹配（Exact Match，EM）**和 **token 级 F1**。EM 是经过归一化（转小写、去标点、删除冠词）后的严格匹配——预测要么完全匹配，要么得 0 分。F1 则基于预测与参考答案之间的 token 重叠来计算，给予部分得分。两者都会低估同义改写：「June 29, 2007」与「June 29th, 2007」相比，EM 通常得 0（序数词破坏了归一化），但仍能凭重叠 token 获得可观的 F1。

对于生产环境的问答：

- **答案准确率**（由 LLM 评判或人工评判，因为指标无法捕捉语义等价性）。
- **引用准确率。** 被引用的文章是否真正支撑该答案？通过对生成的引用与检索到的文章做字符串匹配，可轻松实现自动检查。
- **拒答校准。** 当答案不在检索到的文章中时，系统是否正确地回答「I don't know」？需衡量错误自信率（false confidence rate）。
- **检索召回率。** 在评估阅读器之前，先衡量检索器是否把正确的文章带进了前 `k` 个结果。阅读器无法弥补一段缺失的文章。

### RAGAS：2026 年的生产评估框架

`RAGAS` 专为 RAG 系统打造，是 2026 年的首选默认方案。它在不需要黄金参考答案的情况下从四个维度打分：

- **忠实度（Faithfulness）。** 答案中的每一条论断是否都来自检索到的上下文？通过基于 NLI 的蕴含判断来衡量。这是你最主要的幻觉指标。
- **答案相关性（Answer relevance）。** 答案是否切题？通过从答案反向生成假想问题，再与真实问题比较来衡量。
- **上下文精确率（Context precision）。** 在检索到的文本块中，真正相关的占多大比例？精确率低 = 提示词中存在噪声。
- **上下文召回率（Context recall）。** 检索到的集合是否包含所有所需信息？召回率低 = 阅读器无法成功作答。

无参考评分让你能在真实生产流量上评估，而无需精心整理的黄金答案。对于精确匹配指标完全失效的开放式问题，可在其上叠加 LLM 充当评判（LLM-as-judge）。

`pip install ragas`。接入你的检索器 + 阅读器。每条查询得到四个标量。在指标回退时触发告警。

## 实际运用

2026 年的技术栈。

| 使用场景 | 推荐方案 |
|---------|-------------|
| 给定文章，找出答案片段 | `deepset/roberta-base-squad2` |
| 面向固定语料库，且闭卷不可接受 | RAG：稠密检索器 + LLM 阅读器 |
| 面向文档库的实时问答 | 采用混合检索（BM25 + 稠密）+ 重排器的 RAG（第 14 课） |
| 对话式问答（含追问） | 带对话历史的 LLM + 每轮做 RAG |
| 高度事实导向、受监管的领域 | 在权威语料库上做抽取式；绝不单独使用生成式 |

抽取式问答在 2026 年已不时髦，因为带 LLM 的 RAG 能覆盖更多场景。但在需要逐字引用的语境中它仍在使用：法律研究、合规监管、审计工具。

## 交付落地

保存为 `outputs/skill-qa-architect.md`：

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

1. **简单。** 在 10 段维基百科文章上搭建上面的 SQuAD 抽取式流水线。手工编写 10 个问题。测量答案正确的频率。如果文章和问题都干净，你应该能看到 7-9 个正确。
2. **中等。** 添加一个拒答分类器。当最高检索得分低于某个阈值（比如 0.3 余弦相似度）时，返回「I don't know」而不是调用阅读器。在留出集（held-out set）上调优该阈值。
3. **困难。** 在你自选的一个 10,000 篇文档语料库上构建一条 RAG 流水线。实现混合检索（BM25 + 稠密），并采用 RRF 融合（见第 14 课）。测量有无混合步骤时的答案准确率。记录哪些问题类型受益最大。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 抽取式问答 | 找出答案片段 | 在给定文章中预测答案的起始与结束索引。 |
| 开放域问答 | 面向语料库的问答 | 不给定文章；必须先检索再作答。 |
| RAG | 先检索再生成 | 检索增强生成（Retrieval-augmented generation）。检索器 + 阅读器流水线。 |
| SQuAD | 标杆基准 | 斯坦福问答数据集（Stanford Question Answering Dataset）。采用 EM + F1 指标。 |
| 幻觉 | 编造的答案 | 阅读器输出不被检索到的上下文所支撑。 |
| 拒答校准 | 知道何时该闭嘴 | 系统在无法作答时正确地回答「I don't know」。 |

## 延伸阅读

- [Rajpurkar 等人 (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250) —— 基准论文。
- [Karpukhin 等人 (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) —— DPR，问答领域标杆性的稠密检索器。
- [Lewis 等人 (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) —— 为 RAG 命名的论文。
- [Gao 等人 (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) —— 全面的 RAG 综述。
