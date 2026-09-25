# RAG 的分块策略

> 分块配置对检索质量的影响不亚于嵌入模型的选择(Vectara NAACL 2025)。分块做错了,再多的重排序也救不了你。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 14(信息检索),Phase 5 · 22(嵌入模型)
**Time:** ~60 分钟

## 问题所在

你把一份 50 页的合同放进 RAG 系统。用户问:"终止条款是什么?"检索器返回的却是封面。为什么?因为模型是在 512 token 的分块上训练的,而终止条款位于第 20 页附近,跨页被切开,且没有任何局部关键词将它与查询关联起来。

解决办法不是"买一个更好的嵌入模型"。解决办法是分块。多大?多少重叠?在哪里切分?是否附带上下文?

2026 年 2 月的基准测试给出了令人意外的结果:

- Vectara 的 2026 年研究:递归 512 token 分块的准确率为 69%,超过了语义分块的 54%。
- SPLADE + Mistral-8B 在 Natural Questions 上:重叠带来的可度量收益为零。
- 上下文悬崖:当上下文达到约 2,500 token 时,回答质量急剧下降。

"显而易见"的答案(语义分块、20% 重叠、1000 token)往往是错的。本课将帮你建立对六种策略的直觉,并告诉你何时该用哪一种。

## 核心概念

![Six chunking strategies visualized on one passage](../assets/chunking.svg)

**固定分块。** 每 N 个字符或 token 切分一次。最简单的基线。会在句子中间切断。压缩好,连贯性差。

**递归分块。** LangChain 的 `RecursiveCharacterTextSplitter`。先尝试按 `\n\n` 切分,再尝试 `\n`,然后 `.`,最后按空格。可以干净地回退。2026 年的默认选择。

**语义分块。** 对每个句子做嵌入。计算相邻句子的余弦相似度。在相似度低于阈值处切分。保持主题连贯性。速度较慢;有时会产生损害检索质量的 40 token 小碎片。

**句子分块。** 按句子边界切分。每块一个句子,或一个 N 句的窗口。成本只是语义分块的一小部分,但在约 5k token 内效果与之相当。

**父文档分块。** 同时存储用于检索的小子块 *和* 用于上下文的较大父块。按子块检索;返回父块。可优雅降级:即使子块很差,仍能返回合理的父块。

**延迟分块(2024)。** 先在 token 层面对整个文档做嵌入,再将 token 嵌入池化为分块嵌入。保留跨块上下文。适用于长上下文嵌入器(BGE-M3、Jina v3)。计算开销较高。

**上下文检索(Anthropic,2024)。** 在每个分块前加上由 LLM 生成的、关于其在文档中位置的摘要("该分块是终止条款的第 3.2 节……")。在 Anthropic 自己的基准中检索提升 35-50%。索引成本高昂。

### 比一切默认值都有效的规则

根据查询类型匹配分块大小:

| 查询类型 | 分块大小 |
|------------|-----------|
| 事实型("CEO 叫什么名字?") | 256-512 token |
| 分析型 / 多跳 | 512-1024 token |
| 整节理解 | 1024-2048 token |

NVIDIA 的 2026 年基准测试。分块应足够大以包含答案及其局部上下文,又要足够小,使检索器的 top-K 返回聚焦于答案而非上下文噪声。

```figure
n5-chunk-cuts
```

## 动手实现

### 第 1 步:固定分块与递归分块

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

### 第 2 步:语义分块

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

在你的领域上调整 `threshold`。太高 → 碎片。太低 → 一个巨大分块。

### 第 3 步:父文档分块

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

关键洞察:对父块去重。多个子块可能映射到同一个父块;全部返回会浪费上下文。

### 第 4 步:上下文检索(Anthropic 模式)

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

对附加了上下文的分块建立索引。查询时,检索将受益于这些额外的上下文信号。

### 第 5 步:评估

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

一定要做基准测试。对你的语料库"最优"的策略可能不匹配任何博客文章。

## 常见陷阱

- **只在事实型查询上评估分块。** 多跳查询会揭示截然不同的赢家。使用按查询类型分层的评估集。
- **语义分块不设最小尺寸。** 会产生损害检索的 40 token 碎片。务必强制执行 `min_tokens`。
- **把重叠当 cargo cult。** 2026 年的研究发现重叠常常收益为零,却使索引成本翻倍。要测量,不要假设。
- **不设最小/最大限制。** 5 token 或 5000 token 的分块都会破坏检索。要做钳制。
- **跨文档分块。** 绝不让一个分块跨越两个文档。务必先按文档分块,再合并。

## 应用场景

2026 年的技术栈:

| 场景 | 策略 |
|-----------|----------|
| 首次构建,语料库未知 | 递归,512 token,无重叠 |
| 事实型问答 | 递归,256-512 token |
| 分析型 / 多跳 | 递归,512-1024 token + 父文档分块 |
| 大量交叉引用(合同、论文) | 延迟分块或上下文检索 |
| 会话 / 对话语料库 | 轮次级分块 + 说话人元数据 |
| 短文本(推文、评论) | 一个文档 = 一个分块 |

从递归 512 开始。在 50 个查询的评估集上测量 recall@5。然后据此调优。

## 上线部署

保存为 `outputs/skill-chunker.md`:

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

1. **简单。** 用 fixed(512, 0)、recursive(512, 0) 和 recursive(512, 100) 对一份 20 页的文档分块。比较分块数量和边界质量。
2. **中等。** 在 5 份文档上构建一个 30 查询的评估集。测量递归、语义和父文档分块的 recall@5。哪个胜出?与博客文章的结论一致吗?
3. **困难。** 实现上下文检索。测量 MRR 相对于基线递归的提升。报告索引成本(LLM 调用)与准确率增益的对比。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 分块 | 文档的一小段 | 被嵌入、索引和检索的子文档单元。 |
| 重叠 | 安全余量 | 相邻分块之间共享的 N 个 token;在 2026 年的基准中常常无用。 |
| 语义分块 | 智能分块 | 在相邻句子嵌入相似度下降处切分。 |
| 父文档分块 | 两级检索 | 检索小子块,返回较大父块。 |
| 延迟分块 | 先嵌入后分块 | 在 token 层面嵌入完整文档,再池化为分块向量。 |
| 上下文检索 | Anthropic 的技巧 | 索引前在每个分块前附加 LLM 生成的摘要。 |
| 上下文悬崖 | 2500 token 之墙 | 2026 年 1 月在 RAG 中观察到的、约 2.5k 上下文 token 处的质量下降。 |

## 延伸阅读

- [Yepes et al. / LangChain — Recursive Character Splitting 文档](https://python.langchain.com/docs/how_to/recursive_text_splitter/) — 生产环境中的默认选择。
- [Vectara (2024, NAACL 2025). 分块配置分析](https://arxiv.org/abs/2410.13070) — 分块的重要性不亚于嵌入模型的选择。
- [Jina AI — Late Chunking in Long-Context Embedding Models (2024)](https://jina.ai/news/late-chunking-in-long-context-embedding-models/) — 延迟分块论文。
- [Anthropic — Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) — 使用 LLM 生成的上下文前缀带来 35-50% 的检索提升。
- [NVIDIA 2026 分块大小基准 — Premai 总结](https://blog.premai.io/rag-chunking-strategies-the-2026-benchmark-guide/) — 按查询类型选择分块大小。