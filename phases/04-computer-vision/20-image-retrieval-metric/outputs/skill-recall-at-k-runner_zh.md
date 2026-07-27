---
name: skill-recall-at-k-runner
description: 编写干净的 recall@K 评估框架，包括训练/验证/图库分割和正确的数据契约
version: 1.0.0
phase: 4
lesson: 20
tags: [retrieval, evaluation, recall, faiss]
---

# Recall@K 运行器

将查询和图库图像文件夹及其标签转换为可重现的 recall@K 指标。

## 使用时机

- 新骨干网络的首次检索基准测试。
- 追踪微调过程中各 epoch 的嵌入质量。
- 在同一数据集上比较两个检索系统。

## 输入

- `query_images`：路径列表。
- `gallery_images`：路径列表（查询集可能重叠也可能不重叠）。
- `query_labels`，`gallery_labels`：类别或实例 ID。
- `encoder_fn`：可调用函数 `image -> embedding`（可预计算或实时计算）。
- `ks`：列表如 `[1, 5, 10]`。

## 步骤

1. 一次性编码所有图库图像。保存为 numpy 数组。
2. 编码每个查询图像。
3. 对两组嵌入进行 L2 归一化。
4. 对每个查询，计算与所有图库项的相似度。
5. 降序排序，取前 max(ks) 个。
6. 对于每个 K，检查前 K 个图库项中是否有与查询共享标签的。
7. 报告 `recall@K = 在前 K 个中至少有一个正确邻居的查询的比例`。

## 输出模板

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

## 报告

```
[evaluation]
  num queries:   <整数>
  num gallery:   <整数>
  embedding_dim: <整数>

[recall]
  recall@1:  <浮点数>
  recall@5:  <浮点数>
  recall@10: <浮点数>
```

## 规则

- 在计算相似度之前对嵌入进行归一化；FAISS 对归一化向量的 IndexFlatIP 等同于余弦相似度。
- 当查询的地面真值标签在图库中不存在时，排除该查询；否则 recall 被琐碎地限制在 1 以下。
- 如果查询和图库有重叠，从查询自身的 top-K 中排除查询本身，否则你测量的是自相似度而非检索。
- 对于 `num_queries > 10,000`，分批进行相似度矩阵乘法以避免内存溢出。
