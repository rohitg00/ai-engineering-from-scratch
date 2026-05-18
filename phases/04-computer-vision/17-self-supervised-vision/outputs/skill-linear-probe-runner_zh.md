---
name: skill-linear-probe-runner
description: 运行线性探测评估
version: 1.0.0
phase: 4
lesson: 17
tags: [self-supervised, evaluation, linear-probe]
---

# 线性探测运行器

## 什么是线性探测

冻结预训练骨干，只训练线性分类头，评估特征质量。

## 实现

```python
# 冻结骨干
for param in model.backbone.parameters():
    param.requires_grad = False

# 只训练分类头
optimizer = torch.optim.SGD(model.head.parameters(), lr=30.0, momentum=0.9)

# 训练
for epoch in range(90):
    for images, labels in dataloader:
        features = model.backbone(images)
        logits = model.head(features)
        loss = F.cross_entropy(logits, labels)
        ...
```

## 关键超参数

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| 学习率 | 10-100x | 比端到端训练高很多 |
| 优化器 | SGD | 比Adam更好 |
| 轮数 | 90 | ImageNet标准 |
| 调度 | cosine | 余弦退火 |

## 评估指标

- **Top-1准确率**：主要指标
- **Top-5准确率**：辅助指标
- **与监督基线差距**：< 1%为优秀
