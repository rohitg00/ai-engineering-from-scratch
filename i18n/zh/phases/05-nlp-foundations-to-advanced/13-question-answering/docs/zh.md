# 答案系统

> 现在,我们在研究中发现了一些技术,这些技术可以帮助我们理解这些技术.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 11 (Machine Translation), Phase 5 · 10 (Attention Mechanism)
**Time:** ~75 minutes

## 问题

用户输入"第一款iPhone什么时候发布?"并预计"2007年6月29日". 不是"果的历史很长,多样化. "不是"2007年"坐隔离,没有句子.

在过去十年中,三种建筑主导了质量评估.

- **Extractive QA.**给出一个问题和一个已知含有答案的段落,在段落中找到答案跨度的开始和结尾指数.
- **Open-domain QA.**现在,我们需要找到一个答案,然后提取一个答案.这是每一个RAG管道的基础.
- **Generative / Closed-book QA.**语言模型从其参数内存中得到答案,没有检索,最快的推断,最不靠事实.

2026年的趋势是混合式的:检索最好的几段落,然后要求一个生成模型根据这些段落回答.这是RAG,课程14涵盖检索的一半.这个课程构建了QA的一半.

## 概念

![QA architectures: extractive, retrieval-augmented, generative](../assets/qa.svg)

**Extractive.**编码问题和通过与变压器 (BERT家族) 一起.训练两个头脑预测答案的开始和结束标志指数.损失是有效位置的交叉透.输出是通过的跨度.从来没有幻觉 (通过构建),从来处理问题,通过无法回答 (通过构建).

**Retrieval-augmented (RAG).**首先,一个车找到顶部的...`k`读者 (抽取或生成) 使用这些段落生成答案. 复习器-读者分区允许每个段落独立训练和评估. 现代RAG经常在它们之间添加一个重排器.

**Generative.**仅使用解码器的LLM (GPT,Claude,Llama) 根据学习的重量回答.没有检索步骤.在普通知识上非常出色,在罕见或最近的事实上非常灾难性.预训数据中的幻觉率与事实频率相反相相关.

```figure
qa-span
```

## 建立它

### 步骤1:采集型质量测试,采用预训练模型

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

`deepset/roberta-base-squad2`根据标准, 技术技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术的基础上, 技术`question-answering`管道返回最高得分的跨度,即使模型的零得分获胜. 它不会自动返回空答案.`handle_impossible_answer=True`输入到管道调用:只有当零分数超过每一个跨度分数时,管道才会返回空答.`score`无论如何,都会有.

### 步骤2:采集增强的管道 (图)

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

密集检索器 (Sentence-BERT) 通过语义相似性找到相关段落.提取读者 (RoBERTa-SQuAD) 从组合的顶段中抽取答案跨度. 在小型体中工作.对于百万份文件体,使用FAISS或矢量数据库.

### 步骤3:使用RAG生成

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

提示模式是重要的.明确地告诉模型在文本中地并返回"我不知道"当文本不足时,与天真提示相比,幻觉率减少40-60%.更精密的模式增加了引用,信心分数和结构化提取.

### 步骤4:反映现实世界的评估

SQuAD使用**Exact Match (EM)**其他**token-level F1**现在,我们要去.  EM是正常化后的严格匹配 (小字母,条纹分分,删除文章) 预测完全匹配或得分0. 预测和参考之间的代币重叠计算 F1 并给予部分信贷. 两种低信用表达式:"2007年6月29日"与"2007年6月29日"通常获得0EM (顺序中断正常化),但仍然从重叠的代币中获得大量F1.

对于生产QA:

- **Answer accuracy**(LLM或人类判断,因为指标不捕捉到语义等效).
- **Citation accuracy.**引用的段落是否确实支持答案? 通过自动检查生成的引用和检索的段落之间的字符串匹配是无用的.
- **Refusal calibration.**当答案不在检索的段落中时,系统是否正确地说"我不知道"?测量虚假的信任率.
- **Retrieval recall.**在评估读者之前, 测量读者是否得到了正确的通道到上方`k`一位读者不能修复一个缺失的段落.

### 拉加斯:2026年生产评估框架

`RAGAS`它是针对RAG系统的专用设计,并是2026年发货默认的. 它具有四个维度,而不需要黄金参考:

- **Faithfulness.**根据NLI的含义来测量. 你的主要幻觉指标.
- **Answer relevance.**通过从答案中产生假设问题并与真实问题进行比较来测量.
- **Context precision.**检索的部分中,哪些部分实际上是相关的?
- **Context recall.**检索集是否包含所有必要信息? 低回忆 = 读者无法成功.

无引用的评分让你在没有精选的黄金答案的情况下评估现场生产流量. 在开放式问题上,Layer LLM作为评审者,在准确匹配的指标是无用的.

`pip install ragas`连接回收器+读器,每次查询得到4个 skalar,警告回归.

## 用它

现在我们要去.

| Use case | Recommended |
|---------|-------------|
| Given passage, find answer span | `deepset/roberta-base-squad2` |
| Over a fixed corpus, closed-book not acceptable | RAG: dense retriever + LLM reader |
| Real-time over a document store | RAG with hybrid (BM25 + dense) retriever + reranker (lesson 14) |
| Conversational QA (follow-up questions) | LLM with conversation history + RAG on each turn |
| Highly factual, regulated domains | Extractive over an authoritative corpus; never generative alone |

提取质量检查 (QA) 已经在2026年变得不流行了,因为RAG与LLM处理更多案件.它仍然在需要字面上引用的环境中运输:法律研究,监管合规,审计工具.

## 运送它

保存如`outputs/skill-qa-architect.md`其他:

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

## 运动

1. **Easy.**设置SQuAD提取管道上 10 个维基百科段.手工 10 个问题.测量答案是多少次正确.如果段落和问题是清洁的,你应该看到 7-9 正确.
2. **Medium.**添加拒绝分类器.当顶级检索分数低于门值时 (例如0.3 cosine),反复"我不知道"而不是打电话给读者.按一个被保留的集合调整门值.
3. **Hard.**根据您选择的10,000份文件组建一个RAG管道. 通过RRF融合实现混合检索 (BM25+密集) (见14课). 测量混合步骤和没有的答案精度. 文件中哪些问题类型最受益.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive QA | Find the answer span | Predict start and end indices of the answer within a given passage. |
| Open-domain QA | QA over a corpus | No given passage; must retrieve then answer. |
| RAG | Retrieve then generate | Retrieval-augmented generation. Retriever + reader pipeline. |
| SQuAD | Canonical benchmark | Stanford Question Answering Dataset. EM + F1 metrics. |
| Hallucination | Made-up answer | Reader output not supported by retrieved context. |
| Refusal calibration | Know when to shut up | System correctly says "I don't know" when unable to answer. |

## 进一步阅读

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250)参考文件.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906)DPR,是QA的常规密度检索器.
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)报纸称Rag.
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997)全面的RAG调查.
