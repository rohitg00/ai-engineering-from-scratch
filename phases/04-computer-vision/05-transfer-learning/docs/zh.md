# 05 · 迁移学习与微调

> 别人已经花了上百万 GPU 小时教一个网络认识边缘、纹理和物体部件长什么样。在训练自己的网络之前，你应当先借用这些特征。

**类型：** 实战构建
**语言：** Python
**前置：** 第 4 阶段第 03 课（CNN）、第 4 阶段第 04 课（图像分类）
**时长：** 约 75 分钟

## 学习目标

- 区分「特征提取（feature extraction）」与「微调（fine-tuning）」，并根据数据集规模、领域差距与算力预算选出正确方案
- 加载预训练「骨干网络（backbone）」、替换其分类头，并仅训练分类头，用不到 20 行代码得到一个可用的基线
- 采用「判别式学习率（discriminative learning rate）」逐步解冻各层，使早期通用特征获得比后期任务相关特征更小的更新
- 诊断三类常见故障：解冻块上学习率过高导致的特征漂移、小数据集上的 BN 统计量崩塌，以及「灾难性遗忘（catastrophic forgetting）」

## 问题所在

在 ImageNet 上训练一个 ResNet-50 大约需要 2000 GPU 小时。极少有团队能为他们要交付的每个任务都掏出这笔预算。几乎每个团队实际交付的，是一个预训练骨干网络配上一个用几百到几千张任务专属图像训练出来的新分类头。

这不是偷懒走捷径。任何在 ImageNet 上训练的 CNN，其第一个卷积块都会学到边缘和类 Gabor 滤波器。接下来的几个块学到纹理和简单的图案基元。中间的块学到物体部件。最后的块学到的组合开始呈现出 ImageNet 的 1000 个类别的样子。这套层级体系的前 90% 几乎原封不动地迁移到医学影像、工业检测、卫星数据以及其他任何视觉任务上——因为大自然的边缘和纹理词汇是有限的。你真正要训练的，是最后那 10%。

把迁移做对，有三个 bug 在等着你：用过高的学习率毁掉预训练特征、冻结过多导致模型信息匮乏，以及任由 BatchNorm 的运行统计量（running statistics）朝着一个网络其余部分从未学过的微小数据集漂移。本课会刻意把这三个问题逐一走一遍。

## 核心概念

### 特征提取 vs 微调

两种模式，由你对预训练特征的信任程度以及拥有多少数据来决定选用哪一种。

〔图：特征提取与微调两种模式对比流程图〕

经验法则：

| 数据集规模 | 领域差距 | 方案 |
|--------------|-----------------|--------|
| < 1k 张图像 | 接近 ImageNet | 冻结骨干网络，仅训练分类头 |
| 1k-10k | 接近 | 冻结前 2-3 个 stage，微调其余部分 |
| 10k-100k | 任意 | 用判别式学习率端到端微调 |
| 100k+ | 远 | 微调全部参数；若领域足够远，可考虑从头训练 |

「接近 ImageNet」大致是指内容包含类物体的自然 RGB 照片。医学 CT 扫描、俯拍卫星影像和显微图像属于远领域——这些特征依然有帮助，但你需要让更多的层去适应。

### 冻结为什么能奏效

CNN 在 ImageNet 上学到的特征并非专门针对那 1000 个类别。它们专门针对的是自然图像的统计规律：特定朝向的边缘、纹理、对比模式、形状基元。这些统计规律在人能叫得出名字的几乎所有视觉领域里都是稳定的。这正是为什么：一个在 ImageNet 上训练的模型，在 CIFAR-10 上仅换一个新的线性分类头（不微调骨干网络）做零样本评估，准确率就能达到 80% 以上。分类头要学的，是为当前任务给那些早已学好的特征赋多大权重。

### 判别式学习率

当你确实要解冻时，早期层应当比后期层训练得更慢。早期层编码的是你想保留的通用特征；后期层编码的是任务相关结构，需要大幅移动。

```
典型配方：

  stage 0 (stem + first group): lr = base_lr / 100    (基本固定)
  stage 1:                       lr = base_lr / 10
  stage 2:                       lr = base_lr / 3
  stage 3 (last backbone group): lr = base_lr
  head:                          lr = base_lr  (或略高)
```

在 PyTorch 里，这只是传给优化器的一个参数组列表。一个模型，五个学习率，零额外代码。

### BatchNorm 问题

BN 层持有 `running_mean` 和 `running_var` 这两个缓冲区，它们是在 ImageNet 上计算出来的。如果你的任务有不同的像素分布——不同的光照、不同的传感器、不同的色彩空间——那么这些缓冲区就是错的。按偏好排序，有三种选项：

1. **以 train 模式微调 BN。** 让 BN 随其他一切一起更新它的运行统计量。当任务数据集中等规模（>= 5k 样本）时的默认选择。
2. **以 eval 模式冻结 BN。** 保留 ImageNet 的统计量，只训练权重。当你的数据集小到 BN 的滑动平均会变得很嘈杂时，这是正确做法。
3. **用 GroupNorm 替换 BN。** 彻底消除滑动平均问题。用于每张 GPU 的批大小极小的检测和分割骨干网络。

把这件事搞错，会悄无声息地把准确率拉低 5-15%。

### 分类头设计

分类头是 1-3 个线性层，外加一个可选的 dropout。每个 torchvision 骨干网络都自带一个默认分类头，你要把它替换掉：

```
backbone.fc = nn.Linear(backbone.fc.in_features, num_classes)          # ResNet
backbone.classifier[1] = nn.Linear(..., num_classes)                    # EfficientNet, MobileNet
backbone.heads.head = nn.Linear(..., num_classes)                       # torchvision ViT
```

对于小数据集，单个线性层通常就够了。当任务分布离骨干网络的训练分布更远时，加一个隐藏层（Linear -> ReLU -> Dropout -> Linear）会有帮助。

### 逐层学习率衰减

这是现代微调（BEiT、DINOv2、ViT-B 微调）中使用的、判别式学习率的更平滑版本。与其把层分组到各个 stage，不如给每一层都设置一个比它上一层略小的学习率：

```
lr_layer_k = base_lr * decay^(L - k)
```

当 decay = 0.75、L = 12 个 transformer 块时，第一个块以 `0.75^11 ≈ 0.04x` 分类头学习率的速率训练。对 transformer 微调而言这更重要；对 CNN 而言，按 stage 分组的学习率通常已经足够。

### 该评估什么

迁移学习的实验需要追踪两个在从头训练时不会去看的数字：

- **仅预训练准确率（Pretrained-only accuracy）**——骨干网络冻结时分类头的准确率。这是你的下限。
- **微调后准确率（Fine-tuned accuracy）**——同一个模型经过端到端训练后的准确率。这是你的上限。

如果微调后准确率低于仅预训练准确率，那你有一个学习率或 BN 的 bug。永远把这两个数都打印出来。

## 动手构建

### 第 1 步：加载一个预训练骨干网络并检视它

```python
import torch
import torch.nn as nn
from torchvision.models import resnet18, ResNet18_Weights

backbone = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
print(backbone)
print()
print("classifier head:", backbone.fc)
print("feature dim:", backbone.fc.in_features)
```

`ResNet18` 有四个 stage（`layer1..layer4`），外加一个 stem 和一个 `fc` 分类头。每个 torchvision 分类骨干网络都有类似的结构。

### 第 2 步：特征提取——冻结全部参数，替换分类头

```python
def make_feature_extractor(num_classes=10):
    model = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
    for p in model.parameters():
        p.requires_grad = False
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model

model = make_feature_extractor(num_classes=10)
trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
frozen = sum(p.numel() for p in model.parameters() if not p.requires_grad)
print(f"trainable: {trainable:>10,}")
print(f"frozen:    {frozen:>10,}")
```

只有 `model.fc` 是可训练的。骨干网络是一个被冻结的特征提取器。

### 第 3 步：判别式微调

一个用各 stage 专属学习率构建参数组的工具函数。

```python
def discriminative_param_groups(model, base_lr=1e-3, decay=0.3):
    stages = [
        ["conv1", "bn1"],
        ["layer1"],
        ["layer2"],
        ["layer3"],
        ["layer4"],
        ["fc"],
    ]
    groups = []
    for i, names in enumerate(stages):
        lr = base_lr * (decay ** (len(stages) - 1 - i))
        params = [p for n, p in model.named_parameters()
                  if any(n.startswith(k) for k in names)]
        if params:
            groups.append({"params": params, "lr": lr, "name": "_".join(names)})
    return groups

model = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
model.fc = nn.Linear(model.fc.in_features, 10)
for p in model.parameters():
    p.requires_grad = True

groups = discriminative_param_groups(model)
for g in groups:
    print(f"{g['name']:>10s}  lr={g['lr']:.2e}  params={sum(p.numel() for p in g['params']):>8,}")
```

`decay=0.3` 意味着每个 stage 以下一个 stage 学习率的 30% 进行训练。`fc` 拿到 `base_lr`，`layer4` 拿到 `0.3 * base_lr`，`conv1` 拿到 `0.3^5 * base_lr ≈ 0.00243 * base_lr`。听起来很极端；但经验上它确实有效。

### 第 4 步：BatchNorm 处理

一个在不冻结 BN 权重的前提下冻结其运行统计量的辅助函数。

```python
def freeze_bn_stats(model):
    for m in model.modules():
        if isinstance(m, (nn.BatchNorm1d, nn.BatchNorm2d, nn.BatchNorm3d)):
            m.eval()
            for p in m.parameters():
                p.requires_grad = False
    return model
```

在每个 epoch 开始时调用 `model.train()` 之后再调用它。`model.train()` 会把一切切换到训练模式；这个函数只把 BN 层翻转回去。

### 第 5 步：一个最小化的端到端微调循环

```python
from torch.optim import SGD
from torch.utils.data import DataLoader
from torch.optim.lr_scheduler import CosineAnnealingLR
import torch.nn.functional as F

def fine_tune(model, train_loader, val_loader, device, epochs=5, base_lr=1e-3, freeze_bn=False):
    model = model.to(device)
    groups = discriminative_param_groups(model, base_lr=base_lr)
    optimizer = SGD(groups, momentum=0.9, weight_decay=1e-4, nesterov=True)
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs)

    for epoch in range(epochs):
        model.train()
        if freeze_bn:
            freeze_bn_stats(model)
        tr_loss, tr_correct, tr_total = 0.0, 0, 0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            logits = model(x)
            loss = F.cross_entropy(logits, y, label_smoothing=0.1)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            tr_loss += loss.item() * x.size(0)
            tr_total += x.size(0)
            tr_correct += (logits.argmax(-1) == y).sum().item()
        scheduler.step()

        model.eval()
        va_total, va_correct = 0, 0
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                pred = model(x).argmax(-1)
                va_total += x.size(0)
                va_correct += (pred == y).sum().item()
        print(f"epoch {epoch}  train {tr_loss/tr_total:.3f}/{tr_correct/tr_total:.3f}  "
              f"val {va_correct/va_total:.3f}")
    return model
```

用上面的配方在 CIFAR-10 上跑五个 epoch，可以把 `ResNet18-IMAGENET1K_V1` 从约 70% 的零样本线性探针（linear-probe）准确率提升到约 93% 的微调后准确率。如果光靠分类头、从不触碰骨干网络，准确率会在 86% 左右停滞不前。

### 第 6 步：渐进式解冻

一个从末端向前端、每个 epoch 解冻一个 stage 的调度方案。它以多花几个 epoch 为代价，缓解特征漂移。

```python
def progressive_unfreeze_schedule(model):
    stages = ["layer4", "layer3", "layer2", "layer1"]
    yielded = set()

    def start():
        for p in model.parameters():
            p.requires_grad = False
        for p in model.fc.parameters():
            p.requires_grad = True

    def unfreeze(epoch):
        if epoch < len(stages):
            name = stages[epoch]
            yielded.add(name)
            for n, p in model.named_parameters():
                if n.startswith(name):
                    p.requires_grad = True
            return name
        return None

    return start, unfreeze
```

在第一个 epoch 之前调用一次 `start()`。在每个 epoch 开始时调用 `unfreeze(epoch)`。每当可训练参数集合发生变化时，都要重建优化器，否则被冻结的参数仍持有缓存的动量值，会把它弄糊涂。

## 实际运用

对大多数真实任务来说，`torchvision.models` 加三行代码就够了。上面那些更重的机制，只有当你撞上库的默认设置修不了的问题时才用得着。

```python
from torchvision.models import resnet50, ResNet50_Weights

model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)
model.fc = nn.Linear(model.fc.in_features, num_classes)
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4, weight_decay=1e-4)
```

另外两个生产级的默认选择：

- `timm` 提供约 800 个预训练视觉骨干网络，且 API 一致（`timm.create_model("resnet50", pretrained=True, num_classes=10)`）。对于 torchvision 模型库之外的任何微调，它是标准之选。
- 对于 transformer，`transformers.AutoModelForImageClassification.from_pretrained(name, num_labels=N)` 能给你 ViT / BEiT / DeiT，加载语义与文本模型完全相同。

## 交付成果

本课产出：

- `outputs/prompt-fine-tune-planner.md`——一个提示词，根据数据集规模、领域差距和算力预算，在「特征提取」「渐进式微调」「端到端微调」之间做出选择。
- `outputs/skill-freeze-inspector.md`——一项技能：给定一个 PyTorch 模型，报告哪些参数是可训练的、哪些 BatchNorm 层处于 eval 模式，以及优化器是否真的拿到了那些可训练参数。

## 练习

1. **（简单）** 在同一个合成 CIFAR 数据集上，把一个 `ResNet18` 分别作为线性探针（冻结骨干网络）和完整微调来训练。把两个准确率并排报告出来。解释哪一个差距告诉你特征迁移得好、哪一个告诉你迁移得不好。
2. **（中等）** 故意引入一个 bug：把骨干网络 stage 的 `base_lr` 设为 `1e-1`，而不是只对分类头这么设。展示训练损失如何爆炸，然后通过应用 `discriminative_param_groups` 辅助函数让它恢复。记录下每个 stage 开始发散时的学习率。
3. **（困难）** 取一个医学影像数据集（例如 CheXpert-small、PatchCamelyon 或 HAM10000），对比三种模式：（a）ImageNet 预训练的冻结骨干网络 + 线性分类头；（b）ImageNet 预训练 + 端到端微调；（c）从头训练。报告每种模式的准确率和算力成本。在多大的数据集规模下，从头训练开始变得有竞争力？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|----------------------|
| 特征提取（Feature extraction） | 「冻结，然后训练分类头」 | 骨干网络参数被冻结，只有新的分类头接收梯度 |
| 微调（Fine-tuning） | 「端到端重新训练」 | 所有参数都可训练，通常用比从头训练小得多的学习率 |
| 判别式学习率（Discriminative LR） | 「早期层用更小的学习率」 | 优化器参数组的一种设置：早期 stage 的学习率是后期 stage 学习率的一个分数 |
| 逐层学习率衰减（Layer-wise LR decay） | 「平滑的学习率梯度」 | 每层学习率乘以 decay^(L - k)；在 transformer 微调中常见 |
| 灾难性遗忘（Catastrophic forgetting） | 「模型把 ImageNet 弄丢了」 | 学习率过高，在新任务信号被学到之前就覆盖掉了预训练特征 |
| BN 统计量漂移（BN statistics drift） | 「running mean 是错的」 | BatchNorm 的 running_mean/var 是在与当前任务不同的分布上算出来的，悄无声息地损害准确率 |
| 线性探针（Linear probe） | 「冻结骨干网络 + 线性分类头」 | 对预训练特征的一种评估——在冻结表征之上、最优线性分类器的准确率 |
| 灾难性崩塌（Catastrophic collapse） | 「所有样本都预测成同一个类」 | 当微调使用的学习率高到在分类头的梯度尚未稳定之前就摧毁了特征时发生 |

## 延伸阅读

- [How transferable are features in deep neural networks? (Yosinski et al., 2014)](https://arxiv.org/abs/1411.1792)——量化了特征在各层之间可迁移性的论文
- [Universal Language Model Fine-tuning (ULMFiT, Howard & Ruder, 2018)](https://arxiv.org/abs/1801.06146)——判别式学习率 / 渐进式解冻配方的原始出处；这些思想直接迁移到视觉领域
- [timm documentation](https://huggingface.co/docs/timm)——现代视觉骨干网络的参考资料，以及它们训练时所用的确切微调默认设置
- [A Simple Framework for Linear-Probe Evaluation (Kornblith et al., 2019)](https://arxiv.org/abs/1805.08974)——为什么线性探针准确率很重要，以及如何正确地报告它
