---
name: skill-recall-at-k-runner
description: 计算Recall@K指标
version: 1.0.0
phase: 4
lesson: 20
tags: [retrieval, metrics, recall]
---

# Recall@K计算器

## 定义

Recall@K：在前K个检索结果中，包含相关样本的比例。

## 实现

```python
def recall_at_k(similarities, ground_truth, k=10):
    """
    similarities: (N, M) 查询-样本相似度矩阵
    ground_truth: (N,) 每个查询的真实标签
    """
    # 获取top-k索引
    top_k_indices = similarities.topk(k, dim=1).indices  # (N, K)
    
    # 检查是否包含正样本
    recalls = []
    for i, indices in enumerate(top_k_indices):
        # 假设ground_truth[i]是正样本索引
        if ground_truth[i] in indices:
            recalls.append(1.0)
        else:
            recalls.append(0.0)
    
    return np.mean(recalls)
```

## 变体

- **Recall@1**：最严格，要求第一个就是正样本
- **Recall@5/10**：常用评估
- **mAP@K**：考虑排序质量

## 评估建议

- 使用多个K值（1, 5, 10, 100）
- 报告平均和中位数
- 按类别分析
