# RAG のためのチャンキング戦略

> チャンキング設定は、embedding model の選択と同じくらい検索品質に影響します (Vectara NAACL 2025)。チャンキングを間違えると、どれだけ reranking しても救えません。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 5 · 14 (Information Retrieval), Phase 5 · 22 (Embedding Models)
**所要時間:** 約60分

## 問題

50 ページの契約書を RAG システムに入れます。ユーザーは「解除条項は何ですか」と尋ねます。retriever は表紙を返します。なぜでしょうか。モデルが 512-token chunks で訓練されていて、解除条項は 20 ページ目にあり、ページ区切りをまたいで分割され、query と結びつく局所的な keywords がないからです。

解決策は「より良い embedding model を買うこと」ではありません。解決策はチャンキングです。どれくらいの大きさか。Overlap は必要か。どこで分割するか。周囲の context を持たせるか。

2026 年 2 月の benchmarks は意外な結果を示しています。

- Vectara の 2026 年研究: recursive 512-token chunking は semantic chunking を 69% → 54% の accuracy で上回りました。
- Natural Questions 上の SPLADE + Mistral-8B: overlap は測定可能な利益をまったく出しませんでした。
- Context cliff: response quality は context 約 2,500 tokens 付近で急落します。

「明らかな」答え (semantic chunking、20% overlap、1000 tokens) は、多くの場合間違っています。このレッスンでは 6 つの戦略への直感を作り、どの状況でどれを選ぶべきかを示します。

## 概念

![1 つの passage 上に可視化した 6 つの chunking strategies](../assets/chunking.svg)

**Fixed chunking。** N characters または tokens ごとに分割します。最も単純な baseline です。文の途中で切れます。圧縮率は良いですが、coherence は低くなります。

**Recursive。** LangChain の `RecursiveCharacterTextSplitter` です。まず `\n\n` で分割を試し、次に `\n`、`.`、space と試します。きれいに fallback します。2026 年の default です。

**Semantic。** 各文を embed します。隣接文どうしの cosine similarity を計算します。similarity が threshold を下回る箇所で分割します。topic coherence を保ちます。遅く、ときどき retrieval を悪化させる 40-token 程度の小さな fragments を作ります。

**Sentence。** 文境界で分割します。1 文 1 chunk、または N 文の window にします。コストのほんの一部で、約 5k tokens までは semantic chunking に匹敵します。

**Parent-document。** 検索用に小さな child chunks を保存し、context 用に大きな parent chunk も保存します。child で検索し、parent を返します。劣化がなだらかです。不完全な child chunks でも妥当な parents を返せます。

**Late chunking (2024)。** まず document 全体を token level で embed し、その後 token embeddings を chunk embeddings へ pool します。chunk をまたぐ context を保ちます。long-context embedders (BGE-M3, Jina v3) で機能します。compute は高くなります。

**Contextual retrieval (Anthropic, 2024)。** 各 chunk の先頭に、その document 内での位置を LLM が生成した summary として付けます (「この chunk は解除条項の section 3.2 です...」)。Anthropic 自身の benchmark では retrieval が 35-50% 改善しました。indexing は高コストです。

### すべての default に勝つルール

chunk size を query type に合わせます。

| クエリタイプ | Chunk size |
|------------|-----------|
| Factoid (「CEO の名前は何ですか」) | 256-512 tokens |
| 分析 / multi-hop | 512-1024 tokens |
| section 全体の理解 | 1024-2048 tokens |

NVIDIA の 2026 年 benchmark です。chunk は、答えと局所 context を含められるだけ大きく、かつ retriever の top-K が context noise ではなく答えに集中できるだけ小さい必要があります。

## 作ってみる

### Step 1: fixed と recursive chunking

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

`threshold` は自分の domain で調整してください。高すぎると fragments になります。低すぎると 1 つの巨大な chunk になります。

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

重要な insight: parents を dedupe します。複数の children が同じ parent に map されることがあります。すべて返すと context を無駄にします。

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

contextualized chunks を index します。query 時には、追加された周辺 signal によって retrieval が改善します。

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

必ず benchmark してください。自分の corpus にとっての「best」strategy は、どの blog post とも一致しないかもしれません。

## 落とし穴

- **Factoid queries だけで chunking を評価する。** Multi-hop queries ではまったく別の勝者が見えることがあります。query-type-stratified eval set を使ってください。
- **Minimum size なしの semantic chunking。** retrieval を悪化させる 40-token fragments を作ります。必ず `min_tokens` を強制してください。
- **Cargo cult としての overlap。** 2026 年の研究では、overlap は利益ゼロで index cost を倍にすることが多いとされています。仮定せず測定してください。
- **Min/max enforcement がない。** 5 tokens の chunks も 5000 tokens の chunks も retrieval を壊します。clamp してください。
- **Cross-doc chunking。** 1 つの chunk が 2 つの documents にまたがることは絶対に避けてください。必ず document ごとに chunk し、その後 merge します。

## 使う

2026 年の stack:

| 状況 | 戦略 |
|-----------|----------|
| 初回 build、未知の corpus | Recursive, 512 tokens, overlap なし |
| Factoid QA | Recursive, 256-512 tokens |
| 分析 / multi-hop | Recursive, 512-1024 tokens + parent-document |
| cross-reference が多い (contracts、papers) | Late chunking または contextual retrieval |
| 会話 / dialog corpus | turn-level chunks + speaker metadata |
| 短い utterances (tweets、reviews) | 1 document = 1 chunk |

recursive 512 から始めます。50-query eval set で recall@5 を測ります。そこから調整してください。

## 出荷する

`outputs/skill-chunker.md` として保存:

```markdown
---
name: chunker
description: 与えられたコーパスと query distribution に対して、chunking strategy、size、overlap を選ぶ。
version: 1.0.0
phase: 5
lesson: 23
tags: [nlp, rag, chunking]
---

コーパス (document types、avg length、domain) と query distribution (factoid / analytical / multi-hop) が与えられたら、次を出力してください。

1. 戦略。Recursive / sentence / semantic / parent-document / late / contextual。理由。
2. Chunk size。Token count。query type に結びついた理由。
3. Overlap。デフォルト 0。>0 の場合は正当化する。
4. Min/max enforcement。`min_tokens`、`max_tokens` guards。
5. 評価計画。50-query stratified eval set (factoid、analytical、multi-hop) 上の Recall@5。

min/max chunk size enforcement のない chunking strategy は拒否する。効果があることを示す ablation なしに 20% を超える overlap は拒否する。min-token floor のない semantic chunking recommendations は警告する。
```

## 演習

1. **Easy.** 20 ページの document 1 件を fixed(512, 0)、recursive(512, 0)、recursive(512, 100) で chunk してください。chunk counts と boundary quality を比較します。
2. **Medium.** 5 documents に対して 30-query eval set を作ってください。recursive、semantic、parent-document の recall@5 を測ります。どれが勝ちますか。blog posts と一致しますか。
3. **Hard.** contextual retrieval を実装してください。baseline recursive に対する MRR improvement を測ります。index cost (LLM calls) と accuracy gain を報告します。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Chunk | doc の一部 | embed、index、retrieve される sub-document unit。 |
| Overlap | Safety margin | 隣接 chunks の間で共有される N tokens。2026 年 benchmarks では役に立たないことが多い。 |
| Semantic chunking | Smart chunking | 隣接文 embedding similarity が下がる箇所で分割する。 |
| Parent-document | Two-level retrieval | 小さな children を retrieve し、大きな parents を返す。 |
| Late chunking | Chunk after embedding | full doc を token level で embed し、chunk vectors に pool する。 |
| Contextual retrieval | Anthropic の trick | indexing 前に、LLM-generated summary を各 chunk の先頭に付ける。 |
| Context cliff | 2500-token wall | RAG で約 2.5k context tokens 付近に観測される quality drop (Jan 2026)。 |

## 参考文献

- [Yepes et al. / LangChain — Recursive Character Splitting docs](https://python.langchain.com/docs/how_to/recursive_text_splitter/) — production の default。
- [Vectara (2024, NAACL 2025). Chunking configurations analysis](https://arxiv.org/abs/2410.13070) — chunking は embedding choice と同じくらい重要。
- [Jina AI — Late Chunking in Long-Context Embedding Models (2024)](https://jina.ai/news/late-chunking-in-long-context-embedding-models/) — late chunking paper。
- [Anthropic — Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) — LLM-generated context prefixes による 35-50% retrieval improvement。
- [NVIDIA 2026 chunk-size benchmark — Premai summary](https://blog.premai.io/rag-chunking-strategies-the-2026-benchmark-guide/) — query type ごとの chunk size。
