---
name: skill-linear-probe-runner
description: 任意の frozen encoder と labelled dataset に対する完全な linear-probe evaluation を書く
version: 1.0.0
phase: 4
lesson: 17
tags: [self-supervised, evaluation, linear-probe, pytorch]
---

# Linear Probe Runner

frozen encoder の特徴を評価するため、その上に単一の linear classifier を学習します。すべての self-supervised paper における標準評価です。

## When to use

- self-supervised checkpoints を比較する。
- pretraining epochs にわたって feature quality を追跡する。
- pretrained encoder が downstream task に対して fine-tuning なしで十分かを判断する。

## Inputs

- `encoder`: 画像ごとに fixed-dim feature を返す frozen `nn.Module`。
- `feature_dim`: encoder output の dimensionality。
- `train_dataset`: labelled dataset (image, class_id)。
- `val_dataset`: held-out set。
- `num_classes`: task classes。
- `epochs`: 通常 ImageNet-scale では 100、小さな datasets では 50。

## Steps

1. encoder を eval mode にし、すべての parameter で `requires_grad=False` にする。
2. train と val sets の両方から一度だけ feature-extract する。numpy arrays または memory-mapped file として保存する。
3. cached features の上で SGD + cosine schedule により `nn.Linear(feature_dim, num_classes)` を学習する。
4. 標準 hyperparameters: `lr=0.1`, `momentum=0.9`, `weight_decay=0`, `batch_size=1024`。Linear probe は意外に `lr` に敏感です。accuracy が低ければ sweep してください。
5. 学習終了時に val の top-1 accuracy を報告する。

## Output template

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

## Report

```
[linear probe]
  encoder:     <name + pretrain checkpoint>
  feature_dim: <int>
  epochs:      <int>
  best_val_top1: <float>
```

## Rules

- linear probe 中に encoder weights を更新しないこと。それは probe ではなく fine-tune です。
- features は一度だけ precompute すること。毎 epoch encoder を再実行すると compute を 100x 無駄にします。
- SGD with cosine schedule と weight decay なしを使うこと。ここでは Adam が劣る場合があります。
- encoder family ごとに少なくとも一度は learning rates を sweep すること。最適値は SSL methods によって変わります。
