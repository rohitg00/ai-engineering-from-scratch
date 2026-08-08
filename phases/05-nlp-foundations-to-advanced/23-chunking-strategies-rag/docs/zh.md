# Chunking Strategies for RAG

> 组块配置与嵌入模型的选择一样影响检索质量（Vectara NAACL 2025）。如果分块错误，再多的重新排序也救不了你。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 14（信息检索）、阶段5 · 22（嵌入模型）
** 时间：** ~60分钟

## The Problem

您将一份50页的合同放入RAG系统中。用户问：“终止条款是什么？“猎犬返回了封面。为什么？因为该模型是在512个令牌块上训练的，终止条款位于20页中，分散在一个页面上，没有本地关键字将其与查询联系起来。

解决办法不是“购买更好的嵌入模型。“解决办法是分块。有多大？重叠？去哪里分裂？与周围环境有关？

2026年2月基准显示令人惊讶的结果：

- Vectara 2026年的研究：循环512个令牌分块击败了语义分块69%-54%的准确性。
- SPLADE + Mistral-8B关于自然问题：重叠提供的可衡量益处为零。
- 上下文悬崖：响应质量在2，500个上下文代币左右急剧下降。

“明显”的答案（语义分块、20%重叠、1000个令牌）经常是错误的。本课建立了六种策略的直觉，并告诉您何时采取哪种策略。

## The Concept

![Six chunking strategies visualized on one passage](../assets/chunking.svg)

** 修复分块。**每隔N个字符或标记拆分一次。最简单的基线。话说到一半就打断了。压缩性好，连贯性差。

** 递进式的。** LangChain的“RecursiveDeliverTextSplitter”。尝试先在“\n\n”上分裂，然后是“\n”，然后是“。”，然后是空间。干净利落地向后倒。2026年的默认。

** 语义。**嵌入每个句子。计算相邻句子之间的cos相似度。在相似性低于阈值时进行拆分。保持主题连贯性。较慢;有时会产生40个令牌的微小碎片，从而损害检索。

** 句子。**句子边界分裂。每个块一个句子或N个句子的窗口。以一小部分的成本匹配高达~ 5 k个令牌的语义分块。

** 家长文件。**存储较小的子块以供检索 * 和较大的父块以供上下文。由孩子命名;返回父母。优雅地降级：坏孩子的大块仍然会回报理性的父母。

** 后期分块（2024）。**首先在令牌级别嵌入整个文档，然后将令牌嵌入池到块嵌入中。保留跨块上下文。与长上下文嵌入器（BGE-M3，Jina v3）一起使用。更高的计算。

** 上下文检索（Anthropic，2024）。**在每个块前面加上LLM生成的其在文档中位置的摘要（“这个块是终止条款的第3.2节. "). Anthropic自己的基准中检索改进了35-50%。索引昂贵。

### The rule that beats every default

将块大小与查询类型匹配：

| 查询类型 | 块大小 |
|------------|-----------|
| Factoid（“首席执行官叫什么？") | 256-512代币 |
| 分析/多跳 | 512-1024代币 |
| 全节理解 | 1024-2048代币 |

英伟达2026年基准。该块应该足够大，以包含答案和本地上下文，足够小，以使检索器的前K返回关注答案而不是上下文噪音。

## Build It

### Step 1: fixed and recursive chunking

```python
def chunk_fixed(text, size=512, overlap=0):
    step = size - overlap
    return [text[i:i + size] for i in range(0, len(text), step)]


def chunk_recursive(text, size=512, seps=("\n\n", "\n", ". ", " ")):
    if len(text) <= size:
        return [text]
    for sep in seps:
        if sep not in text:
            continue
        parts = text.split(sep)
        chunks = []
        buf = ""
        for p in parts:
            if len(p) > size:
                if buf:
                    chunks.append(buf)
                    buf = ""
                chunks.extend(chunk_recursive(p, size=size, seps=seps[1:] or (" ",)))
                continue
            candidate = buf + sep + p if buf else p
            if len(candidate) <= size:
                buf = candidate
            else:
                if buf:
                    chunks.append(buf)
                buf = p
        if buf:
            chunks.append(buf)
        return [c for c in chunks if c.strip()]
    return chunk_fixed(text, size)
```

### Step 2: semantic chunking

```python
def chunk_semantic(text, encoder, threshold=0.6, min_chars=200, max_chars=2048):
    sentences = split_sentences(text)
    if not sentences:
        return []
    embs = encoder.encode(sentences, normalize_embeddings=True)
    chunks = [[sentences[0]]]
    for i in range(1, len(sentences)):
        sim = float(embs[i] @ embs[i - 1])
        current_len = sum(len(s) for s in chunks[-1])
        if sim < threshold and current_len >= min_chars:
            chunks.append([sentences[i]])
        else:
            chunks[-1].append(sentences[i])

    result = []
    for group in chunks:
        text_group = " ".join(group)
        if len(text_group) > max_chars:
            result.extend(chunk_recursive(text_group, size=max_chars))
        else:
            result.append(text_group)
    return result
```

在您的域上调整“threts”。太高-碎片。太低-一大块。

### Step 3: parent-document

```python
def chunk_parent_child(text, parent_size=2048, child_size=256):
    parents = chunk_recursive(text, size=parent_size)
    mapping = []
    for p_idx, parent in enumerate(parents):
        children = chunk_recursive(parent, size=child_size)
        for child in children:
            mapping.append({"child": child, "parent_idx": p_idx, "parent": parent})
    return mapping


def retrieve_parent(child_query, mapping, encoder, top_k=3):
    child_embs = encoder.encode([m["child"] for m in mapping], normalize_embeddings=True)
    q_emb = encoder.encode([child_query], normalize_embeddings=True)[0]
    scores = child_embs @ q_emb
    top = np.argsort(-scores)[:top_k]
    seen, parents = set(), []
    for i in top:
        if mapping[i]["parent_idx"] not in seen:
            parents.append(mapping[i]["parent"])
            seen.add(mapping[i]["parent_idx"])
    return parents
```

关键见解：消除父母的重复数据。多个孩子可以映射到同一个父母;返回所有孩子会浪费上下文。

### Step 4: contextual retrieval (Anthropic pattern)

```python
def contextualize_chunks(document, chunks, llm):
    context_prompts = [
        f"""<document>{document}</document>
Here is the chunk to situate: <chunk>{c}</chunk>
Write 50-100 words placing this chunk in the document's context."""
        for c in chunks
    ]
    contexts = llm.batch(context_prompts)
    return [f"{ctx}\n\n{c}" for ctx, c in zip(contexts, chunks)]
```

对上下文化的块进行索引。在查询时，检索受益于额外的周围信号。

### Step 5: evaluate

```python
def recall_at_k(queries, corpus_chunks, encoder, k=5):
    chunk_embs = encoder.encode(corpus_chunks, normalize_embeddings=True)
    hits = 0
    for q_text, gold_idxs in queries:
        q_emb = encoder.encode([q_text], normalize_embeddings=True)[0]
        top = np.argsort(-(chunk_embs @ q_emb))[:k]
        if any(i in gold_idxs for i in top):
            hits += 1
    return hits / len(queries)
```

始终是基准。您的文集的“最佳”策略可能与任何博客文章都不匹配。

## Pitfalls

- ** 分块仅对事实陈述查询进行评估。**多跳查询揭示了截然不同的获胜者。使用查询类型分层的评估集。
- ** 没有最小大小的语义分块。**产生40个令牌片段，损害检索。始终强制执行“min_tokens”。
- ** 货物崇拜重叠。** 2026年的研究发现，重叠通常带来零收益并使指数成本翻倍。衡量，不要假设。
- ** 没有最小/最大执行。** 5个令牌或5000个令牌的块都会中断检索。止血钳
- ** 跨文档分块。**永远不要让一个区块跨越两个文档。始终按文档分块，然后合并。

## Use It

2026年堆栈：

| 情况 | 战略 |
|-----------|----------|
| 首次构建，未知的数据库 | 递进式，512个令牌，没有重叠 |
| Factoid QA | 回归式，256-512个令牌 |
| 分析/多跳 | 递进式，512-1024个标记+父文档 |
| 大量交叉引用（合同、论文） | 后期分块或上下文检索 |
| 对话/对话文集 | 轮流级块+发言者元数据 |
| 简短的言论（推文、评论） | 一个文档=一大块 |

从迭代512开始。在50个查询的评估集上测量recall@5。从那里调整。

## Ship It

另存为“输出/skill-chunker.md”：

```markdown
---
name: chunker
description: Pick a chunking strategy, size, and overlap for a given corpus and query distribution.
version: 1.0.0
phase: 5
lesson: 23
tags: [nlp, rag, chunking]
---

Given a corpus (document types, avg length, domain) and query distribution (factoid / analytical / multi-hop), output:

1. Strategy. Recursive / sentence / semantic / parent-document / late / contextual. Reason.
2. Chunk size. Token count. Reason tied to query type.
3. Overlap. Default 0; justify if >0.
4. Min/max enforcement. `min_tokens`, `max_tokens` guards.
5. Evaluation plan. Recall@5 on 50-query stratified eval set (factoid, analytical, multi-hop).

Refuse any chunking strategy without min/max chunk size enforcement. Refuse overlap above 20% without an ablation showing it helps. Flag semantic chunking recommendations without a min-token floor.
```

## Exercises

1. ** 简单。**使用固定（512，0）、循环（512，0）和循环（512，100）将一个20页的文档分组。比较块计数和边界质量。
2. ** 中等。**在5个文档上构建一个包含30个查询的评估集。测量recall@5的迭代、语义和父文档。哪个获胜？它与博客文章相符吗？
3. ** 很难。**实现上下文检索。测量MRR相对于基线递归的改善。报告索引成本（LLM调用）与准确性增益。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 块 | 一份医生 | 嵌入、索引和检索的子文档单元。 |
| 重叠 | 安全裕度 | 相邻区块之间共享N个代币;在2026年基准测试中通常无用。 |
| 语义分块 | 智能分块 | 拆分邻句嵌入相似度下降的地方。 |
| 家长文件 | 两级检索 | 收养年幼的孩子，返回较大的父母。 |
| 后期分块 | 嵌入后的块 | 在代币级别嵌入完整文档，池到块载体中。 |
| 上下文检索 | 人的诡计 | LLM生成的摘要在索引之前预先添加到每个块。 |
| 上下文悬崖 | 2500-标志墙 | 在RAG中观察到约25，000个上下文令牌的质量下降（2026年1月）。 |

## Further Reading

- [Yepes et al. / LangChain - Recursive Charge Splitting docs]（https：//python.langchain.com/docs/how_to/recursive_text_splitter/）-生产中的默认值。
- [Vectara（2024，NAACL 2025）。分块配置分析]（https：//arxiv.org/abs/2410.13070）-分块与嵌入选择一样重要。
- [Jina AI -长上下文嵌入模型中的后期分块（2024）]（https：//jina.ai/news/late-chunking-in-long-context-embedding-models/）-后期分块论文。
- [Anthropic - Contextual Retrieve]（https：//www.anthropic.com/news/contextual-retrieve）-使用LLM生成的上下文前置，检索改进35-50%。
- [NVIDIA 2026块大小基准- Premai摘要]（https：//blog.premai.io/rag-chunking-strategies-the-2026-benchmark-guide/）-按查询类型划分的块大小。
