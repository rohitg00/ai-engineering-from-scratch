---
name: skill-linear-probe-runner
description: 为任何冻结的编码器和带标签的数据集编写完整的线性探测评估
version: 1.0.0
phase: 4
lesson: 17
tags: [self-supervised, evaluation, linear-probe, pytorch]
---

# 线性探测运行器

通过训练一个顶层的线性分类器来评估冻结编码器的特征。这是每篇自监督论文的标准评估方法。

## 使用时机

- 比较自监督检查点。
- 跟踪预训练过程中各 epoch 的特征质量。
- 决定预训练编码器是否足够好以用于下游任务而无需微调。

## 输入

- `encoder`：冻结的 `nn.Module`，每张图像返回固定维度的特征。
- `feature_dim`：编码器输出的维度。
- `train_dataset`：带标签的数据集（图像，类别 ID）。
- `val_dataset`：保留的验证集。
- `num_classes`：任务类别数。
- `epochs`：ImageNet 规模通常为 100，较小数据集为 50。

## 步骤

1. 将编码器设置为 eval 模式，并在每个参数上设置 `requires_grad=False`。
2. 一次性提取训练集和验证集的特征。存储为 numpy 数组或内存映射文件。
3. 在缓存的特征上使用 SGD + 余弦退火调度训练 `nn.Linear(feature_dim, num_classes)`。
4. 标准超参数：`lr=0.1`，`momentum=0.9`，`weight_decay=0`，`batch_size=1024`。线性探测对 `lr` 异常敏感——如果准确率不佳则进行扫描。
5. 报告训练结束时验证集上的 top-1 准确率。

## 输出模板

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torch.optim import SGD
from torch.optim.lr_scheduler import CosineAnnealingLR

def extract(encoder, loader, device="cpu"):
    encoder.eval()
    feats, labels = [], []
    with torch.no_grad():
        for x, y in loader:
            f = encoder(x.to(device)).cpu()
            feats.append(f)
            labels.append(y)
    return torch.cat(feats), torch.cat(labels)


def linear_probe(encoder, feature_dim, train_loader, val_loader,
                 num_classes, epochs=50, lr=0.1, device="cpu"):
    for p in encoder.parameters():
        p.requires_grad = False

    f_train, y_train = extract(encoder, train_loader, device)
    f_val, y_val = extract(encoder, val_loader, device)

    head = nn.Linear(feature_dim, num_classes).to(device)
    opt = SGD(head.parameters(), lr=lr, momentum=0.9, weight_decay=0)
    sched = CosineAnnealingLR(opt, T_max=epochs)

    ds = torch.utils.data.TensorDataset(f_train, y_train)
    train_iter = DataLoader(ds, batch_size=1024, shuffle=True)

    best_val = 0.0
    for ep in range(epochs):
        head.train()
        for x, y in train_iter:
            x, y = x.to(device), y.to(device)
            loss = F.cross_entropy(head(x), y)
            opt.zero_grad(); loss.backward(); opt.step()
        sched.step()

        head.eval()
        with torch.no_grad():
            acc = (head(f_val.to(device)).argmax(-1).cpu() == y_val).float().mean().item()
        best_val = max(best_val, acc)
    return best_val
```

## 报告

```
[linear probe]
  encoder:     <名称 + 预训练检查点>
  feature_dim: <整数>
  epochs:      <整数>
  best_val_top1: <浮点数>
```

## 规则

- 在线性探测期间绝不更新编码器权重；那将是微调而非探测。
- 预先计算特征一次；每个 epoch 重新训练编码器会浪费 100 倍的计算量。
- 使用 SGD + 余弦退火调度且无权重衰减；Adam 有时在此处表现较差。
- 每个编码器系列至少扫描一次学习率；最优值因 SSL 方法而异。
