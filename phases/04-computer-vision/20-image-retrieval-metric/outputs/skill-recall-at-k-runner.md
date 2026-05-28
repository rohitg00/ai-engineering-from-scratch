---
name: skill-recall-at-k-runner
description: train/val/gallery splits と適切な data contract を持つ recall@K evaluation harness を書く
version: 1.0.0
phase: 4
lesson: 20
tags: [retrieval, evaluation, recall, faiss]
---

# Recall@K Runner

query と gallery images の folders と labels から、reproducible な recall@K number を作ります。

## When to use

- 新しい backbone の最初の retrieval benchmark。
- fine-tune epochs にわたる embedding quality の追跡。
- 同じ dataset 上で2つの retrieval systems を比較する。

## Inputs

- `query_images`: paths の list。
- `gallery_images`: paths の list (query と overlap してもしなくてもよい)。
- `query_labels`, `gallery_labels`: class または instance IDs。
- `encoder_fn`: callable `image -> embedding` (precomputed または live)。
- `ks`: `[1, 5, 10]` のような list。

## Steps

1. すべての gallery image を一度 encode する。numpy array として保存する。
2. すべての query image を encode する。
3. 両方の embedding sets を L2-normalise する。
4. 各 query について、すべての gallery items との similarity を計算する。
5. descending に sort し、top max(ks) を取る。
6. 各 K について、top-K gallery items のいずれかが query の label を共有するか確認する。
7. `recall@K = fraction of queries that had at least one correct neighbour in top K` を報告する。

## Output template

```python
import numpy as np
from sklearn.preprocessing import normalize

def encode_all(images, encoder_fn, batch=32):
    out = []
    for i in range(0, len(images), batch):
        embs = encoder_fn(images[i:i + batch])
        out.append(embs)
    return np.concatenate(out)


def recall_at_k(query_emb, gallery_emb, q_labels, g_labels,
                ks=(1, 5, 10), query_ids=None, gallery_ids=None):
    if len(query_emb) == 0 or len(gallery_emb) == 0:
        return {f"recall@{k}": 0.0 for k in ks}

    g_label_set = set(g_labels.tolist())
    keep = np.array([lbl in g_label_set for lbl in q_labels])
    if not keep.any():
        return {f"recall@{k}": 0.0 for k in ks}

    q_emb_f = query_emb[keep]
    q_lab_f = q_labels[keep]
    q_id_f = query_ids[keep] if query_ids is not None else None

    q = normalize(q_emb_f)
    g = normalize(gallery_emb)
    sims = q @ g.T

    if q_id_f is not None and gallery_ids is not None:
        self_mask = q_id_f[:, None] == gallery_ids[None, :]
        sims = np.where(self_mask, -np.inf, sims)

    top_k_max = min(max(ks), g.shape[0])
    if top_k_max <= 0:
        return {f"recall@{k}": 0.0 for k in ks}

    top = np.argpartition(-sims, top_k_max - 1, axis=1)[:, :top_k_max]
    sorted_top = np.take_along_axis(
        top, np.argsort(-sims[np.arange(len(q))[:, None], top], axis=1), axis=1
    )
    out = {}
    for k in ks:
        k_eff = min(k, top_k_max)
        hits = np.any(g_labels[sorted_top[:, :k_eff]] == q_lab_f[:, None], axis=1)
        out[f"recall@{k}"] = float(hits.mean())
    return out


def evaluate(query_images, query_labels, gallery_images, gallery_labels, encoder_fn, ks=(1, 5, 10)):
    q_emb = encode_all(query_images, encoder_fn)
    g_emb = encode_all(gallery_images, encoder_fn)
    return recall_at_k(q_emb, g_emb, np.array(query_labels), np.array(gallery_labels), ks)
```

## Report

```
[evaluation]
  num queries:   <int>
  num gallery:   <int>
  embedding_dim: <int>

[recall]
  recall@1:  <float>
  recall@5:  <float>
  recall@10: <float>
```

## Rules

- similarity を計算する前に embeddings を normalise すること。normalised vectors に対する FAISS IndexFlatIP は cosine と等価です。
- query の ground-truth label が gallery に存在しない場合は除外すること。そうしないと recall は自明に 1 未満に capped されます。
- query と gallery が overlap する場合は、query 自身を自分の top-K から除外すること。そうしないと retrieval ではなく self-similarity を測っています。
- `num_queries > 10,000` では、OOM を避けるため similarity matmul を batch 化すること。
