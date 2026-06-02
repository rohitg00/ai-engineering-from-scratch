# RAG 的 chunking 策略（Chunking Strategies for RAG）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> chunking（切片）配置对检索质量的影响，与 embedding 模型的选择同等重要（Vectara NAACL 2025）。chunking 一旦做错，再多的 reranking 也救不回来。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 14 (Information Retrieval), Phase 5 · 22 (Embedding Models)
**Time:** ~60 分钟

## 问题（The Problem）

你把一份 50 页的合同丢进 RAG 系统。用户问：「termination clause（解约条款）是什么？」检索器返回的是封面。为什么？因为模型是在 512-token 的 chunk 上训练的，而解约条款在第 20 页里，跨页断开，附近也没有任何关键词把它和 query 关联起来。

修复方法不是「换个更好的 embedding 模型」。修复方法是 chunking。多大？是否 overlap？在哪里切？要不要保留周围的上下文？

2026 年 2 月的基准测试给出了一些出乎意料的结果：

- Vectara 2026 的研究：recursive 的 512-token chunking 击败了 semantic chunking，准确率 69% → 54%。
- SPLADE + Mistral-8B 在 Natural Questions 上的实验：overlap 没带来任何可测的收益。
- Context cliff（上下文悬崖）：当上下文逼近 2,500 token 时，回答质量会陡降。

那个「显然正确」的答案（semantic chunking、20% overlap、1000 token）往往是错的。本课带你建立对六种策略的直觉，并告诉你什么时候该用哪种。

## 概念（The Concept）

![同一段文本在六种 chunking 策略下的可视化](../assets/chunking.svg)

**Fixed chunking（定长切片）。** 每 N 个字符或 token 切一刀。最简单的 baseline。会在句中切断。压缩好，连贯性差。

**Recursive（递归）。** LangChain 的 `RecursiveCharacterTextSplitter`。先尝试按 `\n\n` 切，再按 `\n`，再按 `.`，最后按空格。回退路径干净。2026 年的默认选择。

**Semantic（语义）。** 对每个句子做 embedding，计算相邻句子之间的 cosine 相似度。在相似度跌破阈值的地方切。能保留主题连贯性。慢一些；有时会产出 40-token 的小碎片，反而拖累检索。

**Sentence（句子级）。** 按句子边界切。一句一个 chunk，或者 N 句一个滑窗。在 ~5k token 以内的场景下能匹敌 semantic chunking，且代价只是它的零头。

**Parent-document（父-子文档）。** 既存小的 child chunk 用于检索，*也*存更大的 parent chunk 用于上下文。按 child 检索，返回 parent。优雅降级：哪怕 child chunk 切得不好，返回的 parent 通常仍然合理。

**Late chunking（晚切片，2024）。** 先在 token 级别 embed 整个文档，再把 token embedding 池化成 chunk embedding。能保留跨 chunk 的上下文。需要长 context 的 embedder（BGE-M3、Jina v3）。算力开销更高。

**Contextual retrieval（上下文检索，Anthropic，2024）。** 给每个 chunk 前面拼上一段由 LLM 生成的、说明它在文档中位置的摘要（「本 chunk 是解约条款的 3.2 节……」）。在 Anthropic 自己的 benchmark 中带来 35-50% 的检索提升。索引成本高。

### 击败所有默认值的那条规则

把 chunk 大小匹配到 query 的类型：

| Query 类型 | Chunk 大小 |
|------------|-----------|
| Factoid（事实型，如「CEO 叫什么？」） | 256-512 token |
| Analytical / multi-hop（分析型 / 多跳） | 512-1024 token |
| Whole-section comprehension（整段理解） | 1024-2048 token |

来自 NVIDIA 2026 的基准测试。chunk 要大到能装下答案加上局部上下文，又要小到让检索器 top-K 的结果聚焦在答案上、而不是被上下文噪声淹没。

## 动手实现（Build It）

### Step 1：fixed 与 recursive chunking

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

### Step 2：semantic chunking

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

在你自己的领域语料上调 `threshold`。太高 → 全是碎片。太低 → 一个巨型 chunk。

### Step 3：parent-document

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

关键点：parent 要去重。多个 child 可能映射到同一个 parent；全部返回会浪费 context。

### Step 4：contextual retrieval（Anthropic 模式）

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

把加了上下文的 chunk 拿去建索引。query 时，多出来的环境信号能帮到检索。

### Step 5：评估

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

永远要做基准测试。在你的语料上「最好」的策略，可能跟任何博客都对不上。

## 陷阱（Pitfalls）

- **只用 factoid 类 query 评估 chunking。** 多跳 query 会暴露完全不同的赢家。要用按 query 类型分层的评估集。
- **semantic chunking 不设最小长度。** 会产出 40-token 的碎片，拖累检索。永远强制 `min_tokens`。
- **把 overlap 当祖传秘方。** 2026 年的研究发现 overlap 经常没有任何收益、还把索引成本翻一倍。要测，不要默认。
- **不强制 min/max。** 5-token 或 5000-token 的 chunk 都会让检索崩。要做 clamp（截断到区间）。
- **跨文档 chunking。** 永远不要让一个 chunk 跨两份文档。先按 doc 切，再合并。

## 用起来（Use It）

2026 年的技术栈：

| 场景 | 策略 |
|-----------|----------|
| 第一次搭建、语料未知 | Recursive，512 token，无 overlap |
| Factoid QA | Recursive，256-512 token |
| 分析型 / multi-hop | Recursive，512-1024 token + parent-document |
| 大量交叉引用（合同、论文） | Late chunking 或 contextual retrieval |
| 对话 / 多轮语料 | 按轮次切的 chunk + 说话人元数据 |
| 短文本（推文、评论） | 一篇文档 = 一个 chunk |

从 recursive 512 起步。在 50 条 query 的评估集上测 recall@5。从那里开始调。

## 上线部署（Ship It）

保存到 `outputs/skill-chunker.md`：

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

## 练习（Exercises）

1. **Easy。** 用 fixed(512, 0)、recursive(512, 0)、recursive(512, 100) 三种方式切同一份 20 页文档。比较 chunk 数量和边界质量。
2. **Medium。** 在 5 份文档上构造 30 条 query 的评估集。分别测 recursive、semantic、parent-document 的 recall@5。谁赢？跟博客里说的一致吗？
3. **Hard。** 实现 contextual retrieval。测它相对 baseline recursive 的 MRR 提升。汇报索引成本（LLM 调用次数）vs 准确率收益。

## 关键术语（Key Terms）

| 术语 | 大家说什么 | 实际含义 |
|------|-----------------|-----------------------|
| Chunk | 文档的一块 | 用于 embed、建索引、检索的子文档单元。 |
| Overlap | 安全余量 | 相邻 chunk 之间共享 N 个 token；在 2026 的 benchmark 里通常没用。 |
| Semantic chunking | 「聪明」的 chunking | 在相邻句子的 embedding 相似度跌落处切。 |
| Parent-document | 两级检索 | 检索小 child，返回更大的 parent。 |
| Late chunking | 先 embed 再 chunk | 在 token 级别 embed 整篇文档，再池化为 chunk 向量。 |
| Contextual retrieval | Anthropic 的招 | 把 LLM 生成的摘要拼在每个 chunk 前再建索引。 |
| Context cliff | 2500-token 的墙 | RAG 中观测到上下文 ~2.5k token 附近的质量陡降（2026 年 1 月）。 |

## 延伸阅读（Further Reading）

- [Yepes et al. / LangChain — Recursive Character Splitting docs](https://python.langchain.com/docs/how_to/recursive_text_splitter/) — 生产环境的默认选择。
- [Vectara (2024, NAACL 2025). Chunking configurations analysis](https://arxiv.org/abs/2410.13070) — chunking 与 embedding 选择同等重要。
- [Jina AI — Late Chunking in Long-Context Embedding Models (2024)](https://jina.ai/news/late-chunking-in-long-context-embedding-models/) — late chunking 的论文。
- [Anthropic — Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) — 用 LLM 生成的上下文前缀带来 35-50% 的检索提升。
- [NVIDIA 2026 chunk-size benchmark — Premai summary](https://blog.premai.io/rag-chunking-strategies-the-2026-benchmark-guide/) — 按 query 类型选 chunk 大小。
