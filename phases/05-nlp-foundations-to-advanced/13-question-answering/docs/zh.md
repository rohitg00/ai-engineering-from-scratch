# Question Answering Systems

> 三个系统塑造了现代QA。提取性发现跨度。检索增强后将它们固定在文件中。生成的答案。每个现代人工智能助手都是三者的混合体。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 11（机器翻译）、阶段5 · 10（注意力机制）
** 时间：** ~75分钟

## The Problem

用户输入“第一款iPhone是什么时候推出的？“并预计”2007年6月29日。“不是”苹果的历史悠久而多样化。“不是“2007”单独坐着，没有判刑。直接、脚踏实地、正确的答案。

在过去的十年中，有三种架构主导了QA。

- ** 提取性QA。**给定一个问题和已知包含答案的段落，在段落中找到答案跨度的开始和结束索引。SQuAD是规范基准。
- ** 开放领域QA。**段落没有给出。首先删除相关段落，然后提取或生成答案。这是当今每条RAG管道的基石。
- ** 生成式/闭门QA。**大型语言模型从其参数记忆中给出答案。无法检索。推理最快，事实最不可靠。

2026年的趋势是混合的：检索最好的几个段落，然后提示生成模型以这些段落为基础进行回答。这就是RAG，第14课涵盖了检索的一半深度。本课构建了QA的一半。

## The Concept

![QA architectures: extractive, retrieval-augmented, generative](../assets/qa.svg)

** 榨取。**将问题和段落与Transformer（BERT系列）一起编码。训练两个预测答案开始和结束代币指数的头部。损失是有效位置上的交叉熵。输出是从文章的跨度。从不产生幻觉（通过结构），从不处理段落无法回答的问题（通过结构）。

** 检索增强（RAG）。**两个阶段。首先，猎犬从文集中找到顶部的“k”段。其次，读者（摘录或生成）使用这些段落产生答案。检索器-阅读器的分离允许每个人独立训练和评估。现代RAG经常在他们之间添加一个重新排名者。

** 富有创造力。**仅解码器的LLM（GPT、Claude、Llama）根据学习的权重进行回答。没有检索步骤。在常识方面表现出色，在罕见或最近的事实方面表现出色。幻觉率与预训练数据中的事实频率呈负相关。

## Build It

### Step 1: extractive QA with a pretrained model

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

“deepset/roberta-base-squad 2”在SQuAD 2.0上进行训练，其中包括无法回答的问题。默认情况下，即使模型的空分数获胜，“问答”管道也会返回最高评分跨度-它 * 不会 * 自动返回空答案。要获得显式的“无答案”行为，请向管道调用传递' handle_impossible_answer=True '：只有当空分数超过每个跨度分数时，管道才会返回空答案。无论如何，始终检查“分数”字段。

### Step 2: a retrieval-augmented pipeline (sketch)

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

两级管道。密集检索器（Sentence-BERT）通过语义相似性查找相关段落。提取性读者（RoBERTa-SQuAD）从合并的顶部段落中提取答案跨度。工作于小型库。对于百万个文档的文集，请使用FAISS或载体数据库。

### Step 3: generative with RAG

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

提示模式很重要。与天真的提示相比，明确地告诉模型基于上下文并在上下文不充分时返回“我不知道”可以将幻觉率降低40-60%。更复杂的模式添加了引用、置信度分数和结构化提取。

### Step 4: evaluation that reflects the real world

SQuAD使用 ** 精确匹配（EM）** 和 ** 标记级F1**。EM在规范化后是严格匹配（删除标点符号、删除文章）-要么预测完全匹配，要么得分为0。F1是根据预测和参考之间的代币重叠计算的，并给出部分信用。两种信贷不足的解释：“2007年6月29日”与“2007年6月29日”通常获得0 EM（顺序打破正常化），但仍然从重叠代币中获得大量F1。

对于生产QA：

- ** 答案准确性 **（LLM判断或人类判断，因为指标不捕捉语义等效）。
- ** 引用准确性。**引用的段落真的支持这个答案吗？微不足道，可通过生成的引文和检索到的段落之间的字符串匹配自动检查。
- ** 拒绝校准。**当检索到的段落中没有答案时，系统是否正确地说“我不知道”？测量错误置信率。
- ** 检索召回。**在评估读者之前，先衡量猎犬是否将正确的段落放入顶部-' k '。读者无法修复缺失的段落。

### RAGAS: the 2026 production eval framework

“RAGAS”专为RAG系统而设计，是2026年的航运默认版本。它在不需要黄金参考的情况下对四个维度进行评分：

- ** 忠诚。**答案中的每个主张是否来自检索到的上下文？通过基于NLI的内涵来衡量。你的主要幻觉指标。
- ** 回答相关性。**答案是否解决了这个问题？通过根据答案生成假设问题并与真实问题进行比较来衡量。
- ** 上下文精度。**在检索到的块中，有多少部分是实际相关的？低精度=提示噪音。
- ** 上下文回顾。**检索到的集是否包含所有所需的信息？召回率低=读者无法成功。

无参考评分可让您评估现场制作流量，而无需精心策划的黄金答案。对于精确匹配指标毫无用处的开放式问题，将LLM作为评委。

`pip install ragas`。插入你的检索器+阅读器。每个查询获取四个标量。注意记忆衰退。

## Use It

2026年堆栈。

| 用例 | 建议 |
|---------|-------------|
| 给定段落，找到答案跨度 | “深度设置/roberta-base-squad 2” |
| 在固定的文集上，不接受闭卷 | RAG：密集检索器+ LLM阅读器 |
| 实时通过文档存储 | RAG带有混合（BM 25+密集）检索器+重新排名器（第14课） |
| 对话式QA（后续问题） | LLM与会话历史+ RAG在每一轮 |
| 高度真实、受监管的领域 | 对权威的文集进行提取;从不单独生成 |

提取性QA在2026年不再流行，因为RAG与LLM处理更多案件。它仍然适用于需要字面引用的环境：法律研究、监管合规性、审计工具。

## Ship It

另存为“输出/skill-qa-architect.md”：

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

## Exercises

1. ** 简单。**在维基百科的10个段落中设置上述SQuAD提取管道。手工制作10个问题。衡量答案正确的频率。如果段落和问题干净，您应该看到7-9正确。
2. ** 中等。**添加拒绝分类器。当最高检索分数低于阈值（例如0.3 cos）时，返回“我不知道”，而不是呼叫读者。在固定设置上调整阈值。
3. ** 很难。**根据您选择的10，000个文档的数据库构建RAG管道。使用RRF融合实现混合检索（BM 25+密集）（参见第14课）。使用和不使用混合步骤来衡量答案的准确性。记录哪些问题类型最受益。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 浸提QA | 找到答案跨度 | 预测给定段落中答案的开始和结束指数。 |
| 开放领域QA | 语料库上的问答 | 没有给出的段落;必须检索然后回答。 |
| 抹布 | 收件箱然后生成 | 检索增强一代。检索器+阅读器管道。 |
| 小队 | 规范基准 | 斯坦福大学问题志愿服务数据集。EM + F1指标。 |
| 幻觉 | 编造的答案 | 检索到的上下文不支持读取器输出。 |
| 拒绝校准 | 知道什么时候该闭嘴 | 当无法回答时，系统会正确地说“我不知道”。 |

## Further Reading

- [Rajpurkar等人（2016）。SQuAD：100，000 + Questions for Machine Comprehension of Text]（https：//arxiv.org/abs/1606.05250）-基准论文。
- [Karpukhin等人（2020）。开放域QA的密集通道检索]（https：//arxiv.org/ab/2004.04906）- DPR，QA的典型密集检索器。
- [刘易斯等人（2020）。知识密集型NLP任务的检索增强生成]（https：//arxiv.org/ab/2005.11401）-命名为RAG的论文。
- [Gao等人（2023）。大型语言模型的检索增强生成：调查]（https：//arxiv.org/ab/2312.10997）-全面的RAG调查。
