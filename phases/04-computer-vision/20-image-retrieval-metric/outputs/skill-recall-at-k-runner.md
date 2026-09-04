---
name: skill-recall-at-k-runner
description: Write a clean evaluation harness for recall@K with train/val/gallery splits and proper data contract
version: 1.0.0
phase: 4
lesson: 20
tags: [retrieval, evaluation, recall, faiss]
---

# Recall@K Runner

Turn a folder of query and gallery images plus labels into a reproducible recall@K number.

## When to use

- First retrieval benchmark for a new backbone.
- Tracking embedding quality across fine-tune epochs.
- Comparing two retrieval systems on the same dataset.

## Inputs

- `query_images`: list of paths.
- `gallery_images`: list of paths (query may or may not overlap).
- `query_labels`, `gallery_labels`: class or instance IDs.
- `encoder_fn`: callable `image -> embedding` (precomputed or live).
- `ks`: list like `[1, 5, 10]`.

## Steps

1. Encode every gallery image once. Save as numpy array.
2. Encode every query image.
3. L2-normalise both sets of embeddings.
4. For each query, compute similarity against all gallery items.
5. Sort descending, take top max(ks).
6. For each K, check whether any of the top-K gallery items shares the query's label.
7. Report `recall@K = fraction of queries that had at least one correct neighbour in top K`.

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

- Normalise embeddings before computing similarity; FAISS IndexFlatIP on normalised vectors equals cosine.
- When a query's ground-truth label is absent from the gallery, exclude it; otherwise recall is trivially capped below 1.
- If query and gallery overlap, exclude the query itself from its own top-K or you measure self-similarity, not retrieval.
- For `num_queries > 10,000`, batch the similarity matmul to avoid OOM.
