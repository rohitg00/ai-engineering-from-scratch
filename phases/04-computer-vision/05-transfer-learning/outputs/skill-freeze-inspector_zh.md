---
name: skill-freeze-inspector
description: 检查模型哪些层被冻结，哪些在训练
version: 1.0.0
phase: 4
lesson: 5
tags: [transfer-learning, freezing, debugging]
---

# 冻结检查器

## 检查参数可训练性

```python
def inspect_freeze_status(model):
    total = 0
    trainable = 0
    frozen = 0
    
    for name, param in model.named_parameters():
        total += param.numel()
        if param.requires_grad:
            trainable += param.numel()
            status = "TRAINABLE"
        else:
            frozen += param.numel()
            status = "FROZEN"
        
        print(f"{name:60s} {status:10s} {param.numel():>12,}")
    
    print(f"\n总计: {total:,}")
    print(f"可训练: {trainable:,} ({trainable/total*100:.1f}%)")
    print(f"冻结: {frozen:,} ({frozen/total*100:.1f}%)")
```

## 常见冻结模式

**模式1：只训练头**
```python
for param in model.backbone.parameters():
    param.requires_grad = False
```

**模式2：解冻最后几层**
```python
for param in model.backbone.layer4.parameters():
    param.requires_grad = True
```

**模式3：分层学习率**
```python
# 不冻结，但用不同学习率
optimizer = torch.optim.SGD([
    {'params': model.backbone.parameters(), 'lr': 1e-4},
    {'params': model.head.parameters(), 'lr': 1e-2},
], momentum=0.9)
```

## 警告

- 检查BatchNorm：冻结时是否也在训练模式？
- 检查Dropout：推理时是否关闭？
- 检查梯度：冻结参数是否有梯度？
