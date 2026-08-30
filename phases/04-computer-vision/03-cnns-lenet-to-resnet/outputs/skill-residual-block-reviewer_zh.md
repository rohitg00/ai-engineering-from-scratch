---
name: skill-residual-block-reviewer
description: 审查残差块实现并识别常见错误
version: 1.0.0
phase: 4
lesson: 3
tags: [resnet, residual-blocks, cnn, debugging]
---

# 残差块审查器

## 标准残差块（ResNet-18/34）

```python
def basic_block(x, in_channels, out_channels, stride=1):
    identity = x
    
    # 主路径
    out = conv3x3(x, in_channels, out_channels, stride)
    out = batch_norm(out)
    out = relu(out)
    out = conv3x3(out, out_channels, out_channels)
    out = batch_norm(out)
    
    # 快捷连接
    if stride != 1 or in_channels != out_channels:
        identity = conv1x1(x, in_channels, out_channels, stride)
        identity = batch_norm(identity)
    
    out += identity  # 残差连接
    out = relu(out)
    return out
```

## 瓶颈块（ResNet-50/101/152）

```python
def bottleneck_block(x, in_channels, out_channels, stride=1):
    identity = x
    mid_channels = out_channels // 4
    
    # 1x1降维
    out = conv1x1(x, in_channels, mid_channels)
    out = batch_norm(out)
    out = relu(out)
    
    # 3x3卷积
    out = conv3x3(out, mid_channels, mid_channels, stride)
    out = batch_norm(out)
    out = relu(out)
    
    # 1x1升维
    out = conv1x1(out, mid_channels, out_channels)
    out = batch_norm(out)
    
    # 快捷连接
    if stride != 1 or in_channels != out_channels:
        identity = conv1x1(x, in_channels, out_channels, stride)
        identity = batch_norm(identity)
    
    out += identity
    out = relu(out)
    return out
```

## 常见错误检查清单

- [ ] **维度不匹配**：输入和输出通道不同时，快捷连接没有1x1卷积
- [ ] **步幅遗漏**：下采样时快捷连接没有应用相同步幅
- [ ] **ReLU位置**：ReLU应在加法之后，不是在之前（预激活ResNet除外）
- [ ] **批归一化缺失**：每个卷积后应有BN
- [ ] **顺序错误**：Conv → BN → ReLU 是标准顺序
- [ ] **身份连接错误**：不要对identity应用ReLU（会丢失负值）

## 预激活残差块（ResNet-v2）

```python
def preactivation_block(x, in_channels, out_channels, stride=1):
    identity = x
    
    out = batch_norm(x)
    out = relu(out)
    out = conv3x3(out, in_channels, out_channels, stride)
    
    out = batch_norm(out)
    out = relu(out)
    out = conv3x3(out, out_channels, out_channels)
    
    if stride != 1 or in_channels != out_channels:
        identity = conv1x1(x, in_channels, out_channels, stride)
    
    out += identity
    return out
```

注意：预激活版本中，ReLU在卷积之前。
