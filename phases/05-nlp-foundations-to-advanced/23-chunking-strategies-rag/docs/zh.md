# 23 · 面向 RAG 的分块策略

> 分块（chunking）配置对检索质量的影响，与嵌入模型（embedding model）的选择同等重要（Vectara NAACL 2025）。分块做错了，再多的重排序（reranking）也救不回来。

**类型：** 实战构建
**语言：** Python
**前置：** 阶段 5 · 14（信息检索）、阶段 5 · 22（嵌入模型）
**时长：** 约 60 分钟

## 问题所在

你把一份 50 页的合同放进 RAG 系统。用户问：「终止条款是什么？」检索器却返回了封面页。为什么？因为模型是在 512 词元（token）的分块上训练的，而终止条款位于第 20 页，被分页符切成两半，本地又没有任何关键词把它和查询关联起来。

解决之道不是「买一个更好的嵌入模型」。解决之道是分块。分多大？要不要重叠（overlap）？在哪里切？要不要带上周围的上下文？

2026 年 2 月的基准测试给出了令人意外的结果：

- Vectara 2026 年的研究：递归式（recursive）512 词元分块以 69% 对 54% 的准确率击败了语义分块（semantic chunking）。
- SPLADE + Mistral-8B 在 Natural Questions 上：重叠没有带来任何可测量的收益。
- 上下文悬崖（context cliff）：当上下文逼近 2,500 词元时，回答质量陡然下降。

那个「显而易见」的答案（语义分块、20% 重叠、1000 词元）往往是错的。本课为六种策略建立直觉，并告诉你何时该用哪一种。

## 核心概念

〔图：在同一段文字上可视化展示六种分块策略〕

**固定分块（Fixed chunking）。** 每隔 N 个字符或词元切一刀。最简单的基线方案。会从句子中间切断。压缩率好，连贯性差。

**递归分块（Recursive）。** 即 LangChain 的 `RecursiveCharacterTextSplitter`。先尝试按 `\n\n` 切分，然后是 `\n`，再是 `.`，最后是空格。回退（fallback）过程干净利落。2026 年的默认选择。

**语义分块（Semantic）。** 对每个句子做嵌入。计算相邻句子之间的余弦相似度（cosine similarity）。在相似度低于阈值的地方切分。能保持主题连贯性。速度较慢；有时会产生只有 40 词元的微小碎片，反而损害检索效果。

**句子分块（Sentence）。** 按句子边界切分。每个分块放一个句子，或放 N 个句子构成的窗口。在约 5k 词元以内，效果可媲美语义分块，而成本只是后者的零头。

**父文档分块（Parent-document）。** 既存储用于检索的小子块（child chunk），*也*存储用于提供上下文的较大父块（parent chunk）。用子块检索；返回父块。优雅降级：即便子块质量差，仍能返回合理的父块。

**晚分块（Late chunking，2024）。** 先在词元级别对整篇文档做嵌入，然后把词元嵌入池化（pool）成分块嵌入。能保留跨块的上下文。配合长上下文嵌入器（BGE-M3、Jina v3）使用。算力开销更高。

**上下文检索（Contextual retrieval，Anthropic，2024）。** 在每个分块前面，加上一段由大语言模型（LLM）生成的、说明其在文档中位置的摘要（「本块是终止条款的第 3.2 节……」）。在 Anthropic 自家的基准测试中带来 35-50% 的检索提升。建立索引的代价很高。

### 击败所有默认方案的那条规则

让分块大小与查询类型相匹配：

| 查询类型 | 分块大小 |
|------------|-----------|
| 事实型（「CEO 叫什么名字？」） | 256-512 词元 |
| 分析型 / 多跳（multi-hop） | 512-1024 词元 |
| 整节理解型 | 1024-2048 词元 |

出自 NVIDIA 2026 年的基准测试。分块要足够大，以容纳答案外加本地上下文；又要足够小，让检索器返回的 top-K 聚焦于答案本身，而非上下文噪声。

## 动手构建

### 第 1 步：固定分块与递归分块

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

### 第 2 步：语义分块

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

在你自己的领域上调优 `threshold`。太高 → 产生碎片。太低 → 变成一个超大块。

### 第 3 步：父文档分块

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

关键要点：对父块去重。多个子块可能映射到同一个父块；全部返回会浪费上下文。

### 第 4 步：上下文检索（Anthropic 模式）

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

对这些带上下文的分块建立索引。查询时，检索能从这些额外的周边信号中获益。

### 第 5 步：评估

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

务必做基准测试。对你自己的语料库而言，「最好」的策略可能与任何一篇博客文章都对不上。

## 常见陷阱

- **只在事实型查询上评估分块。** 多跳查询会揭示出截然不同的赢家。请使用按查询类型分层的评估集。
- **没有最小尺寸约束的语义分块。** 会产生 40 词元的碎片，损害检索效果。务必强制 `min_tokens`。
- **把重叠当成迷信仪式（cargo cult）。** 2026 年的多项研究发现，重叠往往零收益，却让索引成本翻倍。要测量，别假设。
- **不做 min/max 约束。** 5 词元的块和 5000 词元的块都会破坏检索。要做钳制（clamp）。
- **跨文档分块。** 绝不让一个分块跨越两篇文档。永远先按文档分块，再做合并。

## 实际运用

2026 年的技术栈：

| 场景 | 策略 |
|-----------|----------|
| 首次构建、语料未知 | 递归分块，512 词元，无重叠 |
| 事实型问答 | 递归分块，256-512 词元 |
| 分析型 / 多跳 | 递归分块，512-1024 词元 + 父文档分块 |
| 大量交叉引用（合同、论文） | 晚分块或上下文检索 |
| 对话 / 会话语料 | 按轮次（turn-level）分块 + 说话人元数据 |
| 短文本（推文、评论） | 一篇文档 = 一个分块 |

从递归分块、512 词元起步。在一个 50 条查询的评估集上测量 recall@5。然后据此调优。

## 交付落地

保存为 `outputs/skill-chunker.md`：

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

## 练习

1. **简单。** 用 fixed(512, 0)、recursive(512, 0) 和 recursive(512, 100) 对同一份 20 页文档分块。比较分块数量与边界质量。
2. **中等。** 在 5 篇文档上构建一个 30 条查询的评估集。测量递归、语义、父文档三种策略的 recall@5。哪个胜出？是否与那些博客文章一致？
3. **困难。** 实现上下文检索。测量相对于基线递归分块的 MRR 提升。报告索引成本（LLM 调用次数）与准确率收益的对比。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 分块（Chunk） | 文档的一小片 | 被嵌入、索引和检索的子文档单元。 |
| 重叠（Overlap） | 安全冗余 | 相邻分块之间共享的 N 个词元；在 2026 年的基准测试中往往无用。 |
| 语义分块（Semantic chunking） | 智能分块 | 在相邻句子嵌入相似度下降处切分。 |
| 父文档分块（Parent-document） | 两级检索 | 检索小子块，返回较大的父块。 |
| 晚分块（Late chunking） | 先嵌入后分块 | 在词元级别嵌入整篇文档，再池化成分块向量。 |
| 上下文检索（Contextual retrieval） | Anthropic 的妙招 | 索引前给每个分块前置一段 LLM 生成的摘要。 |
| 上下文悬崖（Context cliff） | 2500 词元的墙 | RAG 中观察到的、约在 2.5k 上下文词元处出现的质量下降（2026 年 1 月）。 |

## 延伸阅读

- [Yepes 等人 / LangChain —— 递归字符分块文档](https://python.langchain.com/docs/how_to/recursive_text_splitter/) —— 生产环境中的默认方案。
- [Vectara（2024，NAACL 2025）。分块配置分析](https://arxiv.org/abs/2410.13070) —— 分块的重要性不亚于嵌入选择。
- [Jina AI —— 长上下文嵌入模型中的晚分块（2024）](https://jina.ai/news/late-chunking-in-long-context-embedding-models/) —— 晚分块的原始论文。
- [Anthropic —— 上下文检索](https://www.anthropic.com/news/contextual-retrieval) —— 借助 LLM 生成的上下文前缀实现 35-50% 的检索提升。
- [NVIDIA 2026 分块大小基准测试 —— Premai 总结](https://blog.premai.io/rag-chunking-strategies-the-2026-benchmark-guide/) —— 按查询类型确定分块大小。
