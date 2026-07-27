# 图像分类

> 分类器是一个从像素到类别概率分布的函数。其他一切只是管道。

**类型：** 构建
**语言：** Python
**前置条件：** 阶段2 第09课（模型评估），阶段3 第10课（小型框架），阶段4 第03课（CNN）
**时间：** ~75分钟

## 学习目标

- 在CIFAR-10上构建端到端图像分类pipeline：数据集、数据增强、模型、训练循环、评估
- 解释每个组件（dataloader、loss、optimizer、scheduler、augmentation）的作用，并预测破坏其中任何一个会在损失曲线中如何表现
- 从零实现mixup、cutout和label smoothing，并证明每种方法何时值得添加
- 读取混淆矩阵和每个类别的precision/recall表，以诊断数据集和模型在聚合准确率之外的故障

## 问题

每个交付的视觉任务在某种程度上都归结为图像分类。检测对区域分类。分割对像素分类。检索通过与类别中心点的相似性进行排序。让分类正确——数据集循环、数据增强策略、损失、评估——是能够迁移到本阶段每个其他任务的技能。

大多数分类bug不在模型中。它们存在于pipeline中：损坏的normalization、未打乱的训练集、扭曲标签的数据增强、被训练数据污染的验证集、在第30个epoch后悄然发散的学习率。一个在正确设置下能在CIFAR-10上达到93%准确率的CNN，在错误设置下通常只能得到70-75%，而且损失曲线全程看起来都合理。

本课手动连接整个pipeline，使每个部分都可检查。你不会使用`torchvision.datasets`中可能隐藏bug的任何内容。

## 概念

### 分类pipeline

```mermaid
flowchart LR
    A["数据集<br/>(图像 + 标签)"] --> B["数据增强<br/>(随机变换)"]
    B --> C["Normalize<br/>(mean/std)"]
    C --> D["DataLoader<br/>(batch + shuffle)"]
    D --> E["模型<br/>(CNN)"]
    E --> F["Logits<br/>(N, C)"]
    F --> G["交叉熵损失"]
    F --> H["Argmax<br/>评估时"]
    G --> I["Backward"]
    I --> J["优化器步骤"]
    J --> K["调度器步骤"]
    K --> E

    style A fill:#dbeafe,stroke:#2563eb
    style E fill:#fef3c7,stroke:#d97706
    style G fill:#fecaca,stroke:#dc2626
    style H fill:#dcfce7,stroke:#16a34a
```

这个循环中的每一行都可能存在bug。Cross-entropy接收原始logits，而不是softmax输出，因此在损失之前任何`model(x).softmax()`都会静默地计算出错误的梯度。Augmentation只应用于输入，而不是标签——除了mixup，它混合两者。`optimizer.zero_grad()`必须在每一步发生一次；跳过它会累积梯度，看起来像是一个疯狂不稳定的学习率。这些bug中的每一个都会使学习曲线变平而不抛出错误。

### Cross-entropy、logits和softmax

分类器为每个图像生成`C`个数字，称为logits。应用softmax将它们转换为概率分布：

```
softmax(z)_i = exp(z_i) / sum_j exp(z_j)
```

Cross-entropy衡量正确类别的负对数概率：

```
CE(z, y) = -log( softmax(z)_y )
        = -z_y + log( sum_j exp(z_j) )
```

右手边的形式是数值稳定的（log-sum-exp）。PyTorch的`nn.CrossEntropyLoss`在一个操作中融合了softmax + NLL，并直接接收原始logits。先自己应用softmax几乎总是一个bug——你计算了log(softmax(softmax(z)))，一个无意义的量。

### 为什么数据增强有效

CNN具有平移的归纳偏置（来自权重共享），但对裁剪、翻转、颜色抖动或遮挡没有内建的 invariance。教会它这些invariance的唯一方法是向它展示利用这些变换的像素。训练期间的每个随机变换都是在说："这两张图像有相同的标签；学习忽略差异的特征。"

```
原始裁剪:  "向左的狗"
翻转:      "向右的狗"       <- 相同标签，不同像素
旋转(+15): "狗，轻微倾斜"
颜色抖动:  "更暖光线中的狗"
RandomErasing: "带缺失块的狗"
```

规则：数据增强必须保持标签不变。对数字进行Cutout和旋转可能将"6"变成"9"；对于那个数据集，你使用更小的旋转范围并选择尊重数字特定invariance的数据增强。

### Mixup和Cutmix

普通的数据增强变换像素但保持标签为one-hot。**Mixup**和**cutmix**通过插值两者来打破这一点。

```
Mixup:
  lambda ~ Beta(a, a)
  x = lambda * x_i + (1 - lambda) * x_j
  y = lambda * y_i + (1 - lambda) * y_j

Cutmix:
  将x_j的一个随机矩形粘贴到x_i中
  y = 面积加权的y_i和y_j的混合
```

为什么有帮助：模型停止记忆尖锐的one-hot目标，并学习在类别之间插值。训练损失上升，测试准确率上升。这是任何分类器最便宜的鲁棒性升级。

### Label smoothing

Mixup的近亲。不是针对`[0, 0, 1, 0, 0]`训练，而是针对`[eps/C, eps/C, 1-eps, eps/C, eps/C]`训练，其中`eps`很小，如0.1。阻止模型产生任意尖锐的logits，并以几乎零成本改善校准。自PyTorch 1.10起内置于`nn.CrossEntropyLoss(label_smoothing=0.1)`中。

### 超越准确率的评估

聚合准确率隐藏了不平衡性。一个总是预测多数类别的90-10二分类器得分90%。真正能告诉你发生了什么的工具：

- **每个类别的准确率** — 每个类别一个数字；立即暴露表现不佳的类别。
- **混淆矩阵** — C x C网格，行i列j = 真实类别i被预测为j的计数；对角线是正确的，非对角线是你的模型所在之处。
- **Top-1 / Top-5** — 正确类别是否在前1或前5个预测中；Top-5对ImageNet很重要，因为像"Norwich terrier" vs "Norfolk terrier"这样的类别确实模棱两可。
- **Calibration (ECE)** — 0.8置信度的预测80%的时间正确吗？现代网络系统性地过于自信；用temperature scaling或label smoothing修复。

```figure
receptive-field
```

## 构建

### 第1步：确定性合成数据集

CIFAR-10存在于磁盘上。为了使本课可重现且快速，我们构建一个看起来像CIFAR的合成数据集——32x32 RGB图像，具有模型必须学习的类别特定结构。完全相同的pipeline可以不做修改地在真实CIFAR-10上工作。

```python
import numpy as np
import torch
from torch.utils.data import Dataset


def synthetic_cifar(num_per_class=1000, num_classes=10, seed=0):
    rng = np.random.default_rng(seed)
    X = []
    Y = []
    for c in range(num_classes):
        centre = rng.uniform(0, 1, (3,))
        freq = 2 + c
        for _ in range(num_per_class):
            yy, xx = np.meshgrid(np.linspace(0, 1, 32), np.linspace(0, 1, 32), indexing="ij")
            r = np.sin(xx * freq) * 0.5 + centre[0]
            g = np.cos(yy * freq) * 0.5 + centre[1]
            b = (xx + yy) * 0.5 * centre[2]
            img = np.stack([r, g, b], axis=-1)
            img += rng.normal(0, 0.08, img.shape)
            img = np.clip(img, 0, 1)
            X.append(img.astype(np.float32))
            Y.append(c)
    X = np.stack(X)
    Y = np.array(Y)
    idx = rng.permutation(len(X))
    return X[idx], Y[idx]


class ArrayDataset(Dataset):
    def __init__(self, X, Y, transform=None):
        self.X = X
        self.Y = Y
        self.transform = transform

    def __len__(self):
        return len(self.X)

    def __getitem__(self, i):
        img = self.X[i]
        if self.transform is not None:
            img = self.transform(img)
        img = torch.from_numpy(img).permute(2, 0, 1)
        return img, int(self.Y[i])
```

每个类别都有自己的调色板和频率模式，加上高斯噪声，迫使模型学习信号而不是记忆像素。十个类别，每类一千张图像，已排列。

### 第2步：Normalization和augmentation

每个视觉pipeline都有的两个变换。

```python
def standardize(mean, std):
    mean = np.array(mean, dtype=np.float32)
    std = np.array(std, dtype=np.float32)
    def _fn(img):
        return (img - mean) / std
    return _fn


def random_hflip(p=0.5):
    def _fn(img):
        if np.random.random() < p:
            return img[:, ::-1, :].copy()
        return img
    return _fn


def random_crop(pad=4):
    def _fn(img):
        h, w = img.shape[:2]
        padded = np.pad(img, ((pad, pad), (pad, pad), (0, 0)), mode="reflect")
        y = np.random.randint(0, 2 * pad)
        x = np.random.randint(0, 2 * pad)
        return padded[y:y + h, x:x + w, :]
    return _fn


def compose(*fns):
    def _fn(img):
        for fn in fns:
            img = fn(img)
        return img
    return _fn
```

裁剪前使用reflect填充，而不是zero填充，因为黑色边界是一种模型会以无用的方式学会忽略的信号。

### 第3步：Mixup

在训练步骤内混合两张图像和两个标签。实现为批次变换，因此它位于前向传播旁边而不是数据集内部。

```python
def mixup_batch(x, y, num_classes, alpha=0.2):
    if alpha <= 0:
        return x, torch.nn.functional.one_hot(y, num_classes).float()
    lam = float(np.random.beta(alpha, alpha))
    idx = torch.randperm(x.size(0), device=x.device)
    x_mixed = lam * x + (1 - lam) * x[idx]
    y_onehot = torch.nn.functional.one_hot(y, num_classes).float()
    y_mixed = lam * y_onehot + (1 - lam) * y_onehot[idx]
    return x_mixed, y_mixed


def soft_cross_entropy(logits, soft_targets):
    log_probs = torch.log_softmax(logits, dim=-1)
    return -(soft_targets * log_probs).sum(dim=-1).mean()
```

`soft_cross_entropy` 是针对软标签分布的交叉熵。当目标恰好是one-hot时，它退化为通常的one-hot情况。

### 第4步：训练循环

完整的配方：数据一次遍历，每个batch一次梯度，每个epoch一次scheduler步骤。

```python
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torch.optim import SGD
from torch.optim.lr_scheduler import CosineAnnealingLR

def train_one_epoch(model, loader, optimizer, device, num_classes, use_mixup=True):
    model.train()
    total, correct, loss_sum = 0, 0, 0.0
    for x, y in loader:
        x, y = x.to(device), y.to(device)
        if use_mixup:
            x_m, y_soft = mixup_batch(x, y, num_classes)
            logits = model(x_m)
            loss = soft_cross_entropy(logits, y_soft)
        else:
            logits = model(x)
            loss = nn.functional.cross_entropy(logits, y, label_smoothing=0.1)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        loss_sum += loss.item() * x.size(0)
        total += x.size(0)
        # 当mixup开启时，对未混合标签`y`的训练准确率只是一个近似值
        # （模型看到了软目标，而不是y）。将其视为粗略进度信号；
        # 依赖验证准确率获取真实性能。
        with torch.no_grad():
            pred = logits.argmax(dim=-1)
            correct += (pred == y).sum().item()
    return loss_sum / total, correct / total


@torch.no_grad()
def evaluate(model, loader, device, num_classes):
    model.eval()
    total, correct = 0, 0
    loss_sum = 0.0
    cm = torch.zeros(num_classes, num_classes, dtype=torch.long)
    for x, y in loader:
        x, y = x.to(device), y.to(device)
        logits = model(x)
        loss = nn.functional.cross_entropy(logits, y)
        pred = logits.argmax(dim=-1)
        for t, p in zip(y.cpu(), pred.cpu()):
            cm[t, p] += 1
        loss_sum += loss.item() * x.size(0)
        total += x.size(0)
        correct += (pred == y).sum().item()
    return loss_sum / total, correct / total, cm
```

你每次编写训练循环时检查的五个不变量：

1. 训练前`model.train()`，评估前`model.eval()`——翻转dropout和batchnorm行为。
2. `.backward()`之前`.zero_grad()`。
3. 累积指标时使用`.item()`，这样不会保持计算图存活。
4. 评估期间使用`@torch.no_grad()`——节省内存和时间，防止微妙的事故。
5. 对原始logits进行Argmax，而不是softmax——结果相同，少一个操作。

### 第5步：整合

使用上一课中的`TinyResNet`，训练几个epoch，评估。

```python
from main import synthetic_cifar, ArrayDataset
from main import standardize, random_hflip, random_crop, compose
from main import mixup_batch, soft_cross_entropy
from main import train_one_epoch, evaluate
# TinyResNet来自上一课（03-cnns-lenet-to-resnet）。
# 调整导入路径到你存储上一课代码的位置。
from cnns_lenet_to_resnet import TinyResNet  # 示例占位符

X, Y = synthetic_cifar(num_per_class=500)
split = int(0.9 * len(X))
X_train, Y_train = X[:split], Y[:split]
X_val, Y_val = X[split:], Y[split:]

mean = [0.5, 0.5, 0.5]
std = [0.25, 0.25, 0.25]
train_tf = compose(random_hflip(), random_crop(pad=4), standardize(mean, std))
eval_tf = standardize(mean, std)

train_ds = ArrayDataset(X_train, Y_train, transform=train_tf)
val_ds = ArrayDataset(X_val, Y_val, transform=eval_tf)

train_loader = DataLoader(train_ds, batch_size=128, shuffle=True, num_workers=0)
val_loader = DataLoader(val_ds, batch_size=256, shuffle=False, num_workers=0)

device = "cuda" if torch.cuda.is_available() else "cpu"
model = TinyResNet(num_classes=10).to(device)
optimizer = SGD(model.parameters(), lr=0.1, momentum=0.9, weight_decay=5e-4, nesterov=True)
scheduler = CosineAnnealingLR(optimizer, T_max=10)

for epoch in range(10):
    tr_loss, tr_acc = train_one_epoch(model, train_loader, optimizer, device, 10, use_mixup=True)
    va_loss, va_acc, _ = evaluate(model, val_loader, device, 10)
    scheduler.step()
    print(f"epoch {epoch:2d}  lr {scheduler.get_last_lr()[0]:.4f}  "
          f"train {tr_loss:.3f}/{tr_acc:.3f}  val {va_loss:.3f}/{va_acc:.3f}")
```

在合成数据集上，这会在五个epoch内达到近乎完美的验证准确率，这正是要点：pipeline是正确的，模型可以学习可学习的内容。将数据集换成真实CIFAR-10，相同的循环无需更改就能训练到约90%。

### 第6步：读取混淆矩阵

仅准确率从不告诉你模型在哪里失败。混淆矩阵可以。

```python
def print_confusion(cm, labels=None):
    c = cm.shape[0]
    labels = labels or [str(i) for i in range(c)]
    print(f"{'':>6}" + "".join(f"{l:>5}" for l in labels))
    for i in range(c):
        row = cm[i].tolist()
        print(f"{labels[i]:>6}" + "".join(f"{v:>5}" for v in row))
    print()
    tp = cm.diag().float()
    fp = cm.sum(dim=0).float() - tp
    fn = cm.sum(dim=1).float() - tp
    prec = tp / (tp + fp).clamp_min(1)
    rec = tp / (tp + fn).clamp_min(1)
    f1 = 2 * prec * rec / (prec + rec).clamp_min(1e-9)
    for i in range(c):
        print(f"{labels[i]:>6}  prec {prec[i]:.3f}  rec {rec[i]:.3f}  f1 {f1[i]:.3f}")

_, _, cm = evaluate(model, val_loader, device, 10)
print_confusion(cm)
```

行是真实类别，列是预测。类别3和5之间的非对角线计数簇意味着模型混淆了这两者，并为你提供了有针对性的数据收集或类别特定数据增强的起点。

## 使用

`torchvision`将上述所有内容包装成惯用组件。对于真实CIFAR-10，完整的pipeline是四行代码加上训练循环。

```python
from torchvision.datasets import CIFAR10
from torchvision.transforms import Compose, RandomCrop, RandomHorizontalFlip, ToTensor, Normalize

mean = (0.4914, 0.4822, 0.4465)
std = (0.2470, 0.2435, 0.2616)
train_tf = Compose([
    RandomCrop(32, padding=4, padding_mode="reflect"),
    RandomHorizontalFlip(),
    ToTensor(),
    Normalize(mean, std),
])
eval_tf = Compose([ToTensor(), Normalize(mean, std)])

train_ds = CIFAR10(root="./data", train=True,  download=True, transform=train_tf)
val_ds   = CIFAR10(root="./data", train=False, download=True, transform=eval_tf)
```

两件需要注意的事情：mean/std是**数据集特定的**——在CIFAR-10训练集上计算，而不是ImageNet——并且reflect pad是社区默认的crop策略。在这里复制粘贴ImageNet统计数据是一个约1%的准确率泄漏，直到有人分析模型之前没人会发现。

## 交付物

本课产出：

- `outputs/prompt-classifier-pipeline-auditor.md` — 一个prompt，审计训练脚本的上述五个不变量，并浮出第一个违规。
- `outputs/skill-classification-diagnostics.md` — 一个技能，给定混淆矩阵和类别名称列表，总结每个类别的失败并提出单个最有影响力的修复。

## 练习

1. **(简单)** 在合成数据集上，分别使用mixup和不使用mixup训练相同的模型五个epoch。绘制两者的训练和验证损失。解释为什么使用mixup时训练损失更高，但验证准确率相似或更好。
2. **(中等)** 实现Cutout — 在每个训练图像中将随机8x8方形区域置零 — 并进行消融实验 vs 无数据增强、hflip+crop、hflip+crop+cutout、hflip+crop+mixup。报告每种情况的验证准确率。
3. **(困难)** 构建CIFAR-100 pipeline（100个类别，相同输入尺寸），并复现ResNet-34训练运行到发布准确率的1%以内。额外内容：扫描三个学习率和两个weight decay，记录到本地CSV，生成最终的混淆矩阵-顶级混淆表。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|----------------------|
| Logits | "原始输出" | 每张图像的C个数字的pre-softmax向量；cross-entropy期望这些，而不是softmax值 |
| Cross-entropy | "损失" | 正确类别的负对数概率；在一个稳定操作中组合log-softmax和NLL |
| DataLoader | "批处理器" | 用shuffle、batching和（可选的）多worker加载封装数据集；被指责为一半训练bug的根源 |
| Augmentation | "随机变换" | 训练时任何保持标签不变的像素级变换；教会CNN本身不具备的invariance |
| Mixup / Cutmix | "混合两张图像" | 混合输入和标签，使分类器学习平滑插值而不是硬边界 |
| Label smoothing | "更软的目标" | 用(1-eps, eps/(C-1), ...)替换one-hot；改善校准并略微提升准确率 |
| Top-k accuracy | "Top-5" | 正确类别在k个最高概率预测中；用于具有真正模棱两可类别的数据集 |
| Confusion matrix | "错误在哪里" | C x C表格，其中条目(i, j)统计真实类别i被预测为j的图像数量；对角线正确，非对角线告诉你该修复什么 |

## 延伸阅读

- [CS231n: Training Neural Networks](https://cs231n.github.io/neural-networks-3/) — 仍然是在单页上对训练pipeline最清晰的介绍
- [Bag of Tricks for Image Classification (He et al., 2019)](https://arxiv.org/abs/1812.01187) — 每个小技巧共同为ImageNet上ResNet准确率增加3-4%
- [mixup: Beyond Empirical Risk Minimization (Zhang et al., 2017)](https://arxiv.org/abs/1710.09412) — 原始mixup论文；三页理论加上有说服力的实验
- [Why temperature scaling matters (Guo et al., 2017)](https://arxiv.org/abs/1706.04599) — 证明现代网络校准不良并用一个标量参数修复的论文
