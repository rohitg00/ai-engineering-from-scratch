# 分块策略 (Chunking Strategies for RAG)

> 分块配置对检索质量的影响不亚于嵌入模型的选择（Vectara NAACL 2025）。分块做错了，再多的重排序也救不了你。

**类型:** 动手实践 (Build)
**语言:** Python (Python)
**前置知识:** 阶段 5 · 14（信息检索）、阶段 5 · 22（嵌入模型）
**时间:** ~60 分钟

## 问题 (The Problem)

你把一份 50 页的合同放入 RAG 系统。用户问："终止条款是什么？"检索器返回了封面页。为什么？因为模型是在 512 个 token 的分块上训练的，而终止条款在第 20 页，被分页符切断，且没有局部关键词将其与查询关联起来。

解决方案不是"买个更好的嵌入模型"，而是分块。多大？重叠？在何处拆分？是否包含上下文？

2026 年 2 月的基准测试显示了令人惊讶的结果：

- Vectara 2026 年研究：递归 512-token 分块以 69% → 54% 的准确率击败了语义分块。
- SPLADE + Mistral-8B 在 Natural Questions 上：重叠带来的可测量收益为零。
- 上下文悬崖：响应质量在大约 2,500 个 token 的上下文处急剧下降。

"显而易见"的答案（语义分块、20% 重叠、1000 token）往往是错的。本课旨在建立六种策略的直觉，并告诉你何时该用哪一种。

## 概念 (The Concept)

![同一段落上六种分块策略的可视化](../assets/chunking.svg)

**固定分块 (Fixed chunking).** 每 N 个字符或 token 切分一次。最简单的基线。会在句子中间断开。压缩性好，连贯性差。

**递归分块 (Recursive).** LangChain 的 `RecursiveCharacterTextSplitter`。先尝试以 `\n\n` 分割，然后是 `\n`，然后是 `.`，最后是空格。优雅地回退。2026 年的默认选择。

**语义分块 (Semantic).** 对每个句子进行嵌入。计算相邻句子间的余弦相似度。在相似度低于阈值处断开。保留主题连贯性。速度较慢；有时会产生 40 个 token 的微小片段，损害检索效果。

**句子分块 (Sentence).** 在句子边界处拆分。每个块一个句子，或 N 个句子的窗口。在约 5k token 以下的效果与语义分块相当，但成本仅为后者的一小部分。

**父文档分块 (Parent-document).** 存储小的子块用于检索，同时保留更大的父块用于上下文。通过子块检索，返回父块。优雅降级：差的子块仍能返回合理的父块。

**延迟分块 (Late chunking, 2024).** 首先在 token 级别对整个文档进行嵌入，然后将 token 嵌入池化为块嵌入。保留跨块上下文。适用于长上下文嵌入器（BGE-M3、Jina v3）。计算量更高。

**上下文检索 (Contextual retrieval, Anthropic, 2024).** 在每个块前加上 LLM 生成的关于该块在文档中位置的摘要（"此块是终止条款的第 3.2 节……"）。在 Anthropic 自己的基准测试中，检索效果提升 35-50%。索引成本高。

### 胜过所有默认设置的规则 (The rule that beats every default)

将块大小与查询类型匹配：

| 查询类型 | 块大小 |
|-----------|-----------|
| 事实型（"CEO 的名字是什么？"） | 256-512 tokens |
| 分析型 / 多跳 | 512-1024 tokens |
| 全节理解 | 1024-2048 tokens |

NVIDIA 2026 年基准测试。块应该足够大，以容纳答案及局部上下文；同时足够小，使检索器的 top-K 结果聚焦于答案而非上下文噪声。

## 动手实践 (Build It)

### 第 1 步：固定分块与递归分块 (Step 1: fixed and recursive chunking)

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

### 第 2 步：语义分块 (Step 2: semantic chunking)

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

根据你的领域调整 `threshold`。太高 → 碎片化。太低 → 一个巨大块。

### 第 3 步：父文档分块 (Step 3: parent-document)

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

关键洞察：对父块去重。多个子块可能映射到同一个父块；全部返回会浪费上下文。

### 第 4 步：上下文检索（Anthropic 模式）(Step 4: contextual retrieval (Anthropic pattern))

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

索引上下文化的块。在查询时，检索受益于额外附带的信号。

### 第 5 步：评估 (Step 5: evaluate)

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

始终进行基准测试。对你的语料库来说，"最佳"策略可能与任何博客文章都不一致。

## 陷阱 (Pitfalls)

- **仅基于事实型查询评估分块。** 多跳查询会揭示完全不同的优胜者。请使用按查询类型分层的评估集。
- **语义分块没有最小尺寸。** 会产生 40 个 token 的碎片，损害检索效果。始终强制设置 `min_tokens`。
- **重叠作为盲目惯例。** 2026 年的研究发现重叠通常带来零收益，却使索引成本翻倍。请测量，不要假设。
- **没有最小/最大限制。** 5 个 token 或 5000 个 token 的块都会破坏检索。请加以约束。
- **跨文档分块。** 绝不要让一个块跨越两个文档。始终按文档分块，然后合并。

## 应用 (Use It)

2026 年推荐方案：

| 场景 | 策略 |
|-----------|----------|
| 首次构建，未知语料库 | 递归分块，512 tokens，无重叠 |
| 事实型问答 | 递归分块，256-512 tokens |
| 分析型 / 多跳 | 递归分块，512-1024 tokens + 父文档分块 |
| 大量交叉引用（合同、论文） | 延迟分块或上下文检索 |
| 对话型 / 对话语料库 | 轮次级分块 + 说话人元数据 |
| 简短语句（推文、评论） | 一个文档 = 一个块 |

从递归 512 开始。在 50 条查询的评估集上测量 recall@5。然后据此调优。

## 交付 (Ship It)

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

## 练习 (Exercises)

1. **简单 (Easy).** 用 fixed(512, 0)、recursive(512, 0) 和 recursive(512, 100) 对一份 20 页的文档进行分块。比较块数和边界质量。
2. **中等 (Medium).** 在 5 份文档上构建 30 条查询的评估集。测量递归分块、语义分块和父文档分块的 recall@5。哪个胜出？是否与博客文章一致？
3. **困难 (Hard).** 实现上下文检索。测量相对于基线递归分块的 MRR 提升。报告索引成本（LLM 调用）与准确率提升的对比。

## 关键术语 (Key Terms)

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Chunk | 文档的一块 | 被嵌入、索引和检索的子文档单元。 |
| Overlap | 安全余量 | 相邻块之间共享的 N 个 token；在 2026 年基准测试中通常无用。 |
| Semantic chunking | 智能分块 | 在相邻句子嵌入相似度下降处切分。 |
| Parent-document | 两级检索 | 检索小子块，返回大父块。 |
| Late chunking | 先嵌入后分块 | 在 token 级别嵌入整个文档，然后池化为块向量。 |
| Contextual retrieval | Anthropic 的妙招 | 索引前在每个块前加上 LLM 生成的摘要。 |
| Context cliff | 2500 token 之壁 | RAG 中大约在 2.5k 上下文 token 处观察到的质量下降（2026 年 1 月）。 |

## 延伸阅读 (Further Reading)

- [Yepes et al. / LangChain — Recursive Character Splitting docs](https://python.langchain.com/docs/how_to/recursive_text_splitter/) — 生产环境中的默认方案。
- [Vectara (2024, NAACL 2025). Chunking configurations analysis](https://arxiv.org/abs/2410.13070) — 分块与嵌入选择同等重要。
- [Jina AI — Late Chunking in Long-Context Embedding Models (2024)](https://jina.ai/news/late-chunking-in-long-context-embedding-models/) — 延迟分块论文。
- [Anthropic — Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) — 使用 LLM 生成的上下文前缀实现 35-50% 的检索提升。
- [NVIDIA 2026 chunk-size benchmark — Premai summary](https://blog.premai.io/rag-chunking-strategies-the-2026-benchmark-guide/) — 按查询类型划分的块大小指南。
