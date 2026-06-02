# 问答系统（Question Answering Systems）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 三种系统塑造了现代 QA。Extractive（抽取式）找答案 span。Retrieval-augmented（检索增强）把答案锚定到文档里。Generative（生成式）直接产出答案。如今每个 AI 助手都是这三者的混合体。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 11（机器翻译）, Phase 5 · 10（注意力机制）
**Time:** ~75 minutes

## 问题（The Problem）

用户输入「第一代 iPhone 什么时候发布的？」，期待的回答是「2007 年 6 月 29 日」。不是「Apple 的历史漫长且多元」，也不是孤零零一个「2007」、上下文都没有。要的是一个直接、有依据、正确的答案。

过去十年里，三种架构主导了 QA。

- **Extractive QA（抽取式）。** 给定问题和一段已知包含答案的 passage（段落），找出答案 span 在 passage 中的起止 token 索引。SQuAD 是这一类的标准 benchmark（基准）。
- **Open-domain QA（开放域）。** 不给 passage。先检索出相关 passage，再抽取或生成答案。这是当今所有 RAG 流水线的基石。
- **Generative / Closed-book QA（生成式 / 闭卷）。** 大语言模型直接从参数化记忆里回答。不做检索。inference（推理）时最快，事实层面最不可靠。

2026 年的趋势是混合式：先检索出最相关的若干 passage，再 prompt 一个生成模型基于这些 passage 作答。这就是 RAG，第 14 课会深入讲检索那一半。本课聚焦 QA 这一半。

## 概念（The Concept）

![QA 架构：抽取式、检索增强、生成式](../assets/qa.svg)

**Extractive。** 用一个 transformer（BERT 家族）把问题和 passage 一起编码。训练两个 head 分别预测答案的起、止 token 索引。损失函数是有效位置上的 cross-entropy（交叉熵）。输出是 passage 中的一个 span。结构上不会 hallucinate（幻觉）；同样，结构上也无法回答 passage 中不存在答案的问题。

**Retrieval-augmented (RAG)。** 两阶段。第一步，retriever（检索器）从语料库里找出 top-`k` 个 passage。第二步，reader（reader，可以是抽取式或生成式）用这些 passage 产出答案。retriever-reader 的拆分让两边可以独立训练和评估。现代 RAG 经常在中间加一层 reranker。

**Generative。** 一个 decoder-only LLM（GPT、Claude、Llama）直接从训练学到的权重里作答。没有检索步骤。在常识题上表现优异，在罕见或最新的事实上则灾难性翻车。hallucination 率与该事实在预训练数据中出现的频率呈反比。

## 动手实现（Build It）

### Step 1：用预训练模型做 extractive QA

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

`deepset/roberta-base-squad2` 是在 SQuAD 2.0 上训练的，这一版本包含「无法回答」的问题。默认情况下，`question-answering` pipeline 会返回得分最高的 span，**即使**模型的 null 分数（认为「无答案」）更高 —— 它*不会*自动返回空答案。要拿到显式的「no answer」行为，需要在 pipeline 调用里传 `handle_impossible_answer=True`：这样只有当 null 分数高过所有 span 分数时，pipeline 才会返回空答案。无论哪种情况，都务必检查 `score` 字段。

### Step 2：检索增强流水线（草图）

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

两阶段流水线。Dense retriever（Sentence-BERT）按语义相似度找出相关 passage。抽取式 reader（RoBERTa-SQuAD）在拼接后的 top passage 中抽出答案 span。这套方案在小语料上够用。要面对百万级文档语料，请上 FAISS 或向量数据库。

### Step 3：生成式 + RAG

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

Prompt 模式很关键。明确要求模型仅基于 context 作答、并在 context 不足时返回「I don't know」，相比朴素 prompt 能把 hallucination 率压下 40–60%。更精细的模式还会加上引用、置信度分数、结构化抽取等。

### Step 4：贴近真实世界的评估

SQuAD 用 **Exact Match (EM)** 和 **token 级 F1**。EM 在归一化（小写、去标点、去冠词）之后做严格匹配 —— 要么完全相等，要么 0 分。F1 在预测和参考之间按 token 重叠计算，给部分分。两者对 paraphrase（改写）都会低估：「June 29, 2007」对「June 29th, 2007」一般 EM 拿 0（序数词 `th` 破坏了归一化），但因为 token 重叠仍能拿到不低的 F1。

生产级 QA：

- **Answer accuracy（答案准确率）**（用 LLM-as-judge 或人工评判，因为机械指标抓不到语义等价）。
- **Citation accuracy（引用准确率）。** 被引用的 passage 是否真的支持这个答案？把生成的引用与检索到的 passage 做字符串匹配，自动检查极其简单。
- **Refusal calibration（拒答校准）。** 当答案不在检索到的 passage 里时，系统是否能正确说「I don't know」？衡量假自信率（false confidence rate）。
- **Retrieval recall（检索召回率）。** 在评估 reader 之前，先看 retriever 是否把正确的 passage 召到了 top-`k`。reader 救不了缺失的 passage。

### RAGAS：2026 生产级评估框架

`RAGAS` 是为 RAG 系统量身打造的评估框架，2026 年是默认上船选项。它在不需要 gold reference 的前提下，对四个维度打分：

- **Faithfulness（忠实度）。** 答案里的每个 claim 是否都源自检索到的 context？用 NLI（自然语言推理）的蕴含关系来衡量。这是你最主要的 hallucination 指标。
- **Answer relevance（答案相关性）。** 答案是否真的回答了问题？方法是从答案里反向生成假设性问题，再和原问题做比较。
- **Context precision（上下文精确率）。** 检索到的 chunk 里，真正相关的占多大比例？精确率低 = prompt 里有噪声。
- **Context recall（上下文召回率）。** 检索集合是否包含所有必要信息？召回率低 = reader 注定失败。

无参考评估让你能在线上真实流量上做评估，而不必先准备一批人工 gold answer。对于开放式问题（exact-match 类指标完全失效），再叠一层 LLM-as-judge。

`pip install ragas`。把你的 retriever + reader 接进去，每个 query 拿到四个标量。回归（regression）触发告警。

## 用起来（Use It）

2026 技术栈。

| 用例 | 推荐方案 |
|---------|-------------|
| 给定 passage，找答案 span | `deepset/roberta-base-squad2` |
| 在固定语料上检索，闭卷模式不可接受 | RAG：dense retriever + LLM reader |
| 实时面向文档存储 | RAG，hybrid（BM25 + dense）retriever + reranker（见第 14 课） |
| 对话式 QA（带追问） | LLM 带对话历史 + 每轮做一次 RAG |
| 高度事实导向、强监管领域 | 在权威语料上做 extractive；绝不能只用 generative |

Extractive QA 在 2026 年已经不算潮流了，因为 RAG + LLM 能覆盖更多场景。但在需要逐字引用的场景（法律研究、合规审查、审计工具）里，它仍在持续上线。

## 上线部署（Ship It）

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

## 练习（Exercises）

1. **Easy。** 把上面这套 SQuAD 抽取式流水线跑在 10 段 Wikipedia 文本上。手写 10 个问题，统计答对率。如果 passage 和问题都干净，应能看到 7–9 个答对。
2. **Medium。** 加一个 refusal classifier（拒答分类器）。当 top 检索分数低于某阈值（比如 cosine 0.3）时，直接返回「I don't know」而不调用 reader。在留出集上调阈值。
3. **Hard。** 在你选的一个 10,000 文档规模的语料上搭一条 RAG 流水线。实现 hybrid 检索（BM25 + dense）并用 RRF 融合（见第 14 课）。比较加 / 不加 hybrid 的答案准确率，记录哪些题型从 hybrid 中获益最大。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 真正含义 |
|------|-----------------|-----------------------|
| Extractive QA | 找答案 span | 在给定 passage 中预测答案的起、止 token 索引。 |
| Open-domain QA | 在语料上做 QA | 不给 passage；必须先检索再回答。 |
| RAG | 先检索再生成 | Retrieval-augmented generation。Retriever + reader 流水线。 |
| SQuAD | 标准 benchmark | Stanford Question Answering Dataset。指标是 EM + F1。 |
| Hallucination | 编出来的答案 | reader 输出不被检索到的 context 支持。 |
| Refusal calibration | 知道什么时候该闭嘴 | 系统在无法回答时正确说「I don't know」。 |

## 延伸阅读（Further Reading）

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250) —— benchmark 论文。
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) —— DPR，QA 领域的标杆 dense retriever。
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) —— 命名 RAG 的那篇论文。
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) —— 全面的 RAG 综述。
