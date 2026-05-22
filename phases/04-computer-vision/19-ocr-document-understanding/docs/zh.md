# OCR 与文档理解（OCR & Document Understanding）

> OCR 是一个三阶段流水线——检测文本框、识别字符，然后进行版面排列。所有现代 OCR 系统都会重新排序这些阶段或将其合并。

**类型：** 学习 + 使用
**语言：** Python
**前置知识：** 阶段 4 第 06 课（检测）、阶段 7 第 02 课（自注意力）
**时间：** ~45 分钟

## 学习目标

- 追踪经典 OCR 流水线（检测 -> 识别 -> 版面排列）以及现代端到端替代方案（Donut、Qwen-VL-OCR）
- 实现 CTC（Connectionist Temporal Classification）损失用于序列到序列的 OCR 训练
- 使用 PaddleOCR 或 EasyOCR 进行生产级文档解析，无需训练
- 区分 OCR、版面解析和文档理解——并为每项任务选择合适的工具

## 问题

包含文本的图像无处不在：收据、发票、身份证、扫描书籍、表格、白板、标志、截图。从中提取结构化数据——不仅仅是字符，而是“这是总金额”——是应用视觉领域中价值最高的问题之一。

该领域分为三个技能层次：

1. **纯正 OCR**：将像素转换为文本。
2. **版面解析**：将 OCR 输出分组为区域（标题、正文、表格、页眉）。
3. **文档理解**：从版面中提取结构化字段（“invoice_total = $42.50”）。

每个层次都有经典和现代的方法，而“我想从图像中获取文本”与“我需要从这张收据中获取总金额”之间的差距比大多数团队意识到的要大得多。

## 概念

### 经典流水线

```mermaid
flowchart LR
    IMG["图像"] --> DET["文本检测<br/>（DB，EAST，CRAFT）"]
    DET --> BOX["词/行<br/>边界框"]
    BOX --> CROP["裁剪每个区域"]
    CROP --> REC["识别<br/>（CRNN + CTC）"]
    REC --> TXT["文本字符串"]
    TXT --> LAY["版面<br/>排序"]
    LAY --> OUT["按阅读顺序的文本"]

    style DET fill:#dbeafe,stroke:#2563eb
    style REC fill:#fef3c7,stroke:#d97706
    style OUT fill:#dcfce7,stroke:#16a34a
```

- **文本检测** 产生每行或每词的四边形。
- **识别** 将每个区域裁剪到固定高度，运行 CNN + BiLSTM + CTC 以产生字符序列。
- **版面** 重建阅读顺序（对于拉丁文是上到下、左到右；对于阿拉伯文、日文则不同）。

### CTC 一句话说明

OCR 识别从固定长度的特征图产生可变长度的序列。CTC（Graves 等人，2006）允许在不进行字符级对齐的情况下训练模型。模型在每个时间步输出（词汇表+空白）上的分布；CTC 损失对所有在合并重复并移除空白后会缩减为目标文本的对齐方式进行边缘化。

```
原始输出："h h h _ _ e e l l _ l l o _ _"
合并重复并移除空白后："hello"
```

CTC 是 CRNN 在 2015 年能够工作，并且在 2026 年仍然训练大多数生产级 OCR 模型的原因。

### 现代端到端模型

- **Donut**（Kim 等人，2022）—— ViT 编码器 + 文本解码器；读取图像并直接输出 JSON。没有文本检测器，没有版面模块。
- **TrOCR**—— ViT + transformer 解码器，用于行级 OCR。
- **Qwen-VL-OCR / InternVL**—— 针对 OCR 任务微调的完整视觉语言模型；2026 年在复杂文档上具有最佳准确率。
- **PaddleOCR**—— 经典 DB + CRNN 流水线，封装在成熟的生产级包中；仍然是开源工作的主力。

端到端模型需要更多的数据和计算，但跳过了多阶段流水线的错误累积。

### 版面解析

对于结构化文档，运行一个版面检测器（LayoutLMv3、DocLayNet），对每个区域进行标记：标题、段落、图形、表格、脚注。阅读顺序变为“按版面顺序遍历区域，拼接”。

对于表单，使用 **键值提取（Key-Value Extraction）** 模型（视觉丰富文档用 Donut，普通扫描件用 LayoutLMv3）。它们接收图像 + 检测到的文本 + 位置，并预测结构化的键值对。

### 评估指标

- **字符错误率（Character Error Rate, CER）**—— 莱文斯坦距离（Levenshtein distance）/ 参考长度。越低越好。生产目标：在清晰扫描件上 < 2%。
- **词错误率（Word Error Rate, WER）**—— 在词级别相同。
- **结构化字段上的 F1**—— 用于键值任务；衡量 `{invoice_total: 42.50}` 是否正确出现。
- **JSON 上的编辑距离**—— 用于端到端文档解析；Donut 论文引入了归一化树编辑距离（normalised tree edit distance）。

## 构建

### 步骤 1: CTC 损失 + 贪婪解码器

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


def ctc_loss(log_probs, targets, input_lengths, target_lengths, blank=0):
    """
    log_probs:      (T, N, C) 对词汇表（包括索引0处的空白）的 log-softmax
    targets:        (N, S) 整数目标（无空白）
    input_lengths:  (N,) 每个样本使用的时间步数
    target_lengths: (N,) 每个样本的目标长度
    """
    return F.ctc_loss(log_probs, targets, input_lengths, target_lengths,
                      blank=blank, reduction="mean", zero_infinity=True)


def greedy_ctc_decode(log_probs, blank=0):
    """
    log_probs: (T, N, C) log-softmax
    返回：索引序列列表（去除空白，合并重复）
    """
    preds = log_probs.argmax(dim=-1).transpose(0, 1).cpu().tolist()
    out = []
    for seq in preds:
        decoded = []
        prev = None
        for idx in seq:
            if idx != prev and idx != blank:
                decoded.append(idx)
            prev = idx
        out.append(decoded)
    return out
```

`F.ctc_loss` 在可用时使用高效的 CuDNN 实现。贪婪解码器比束搜索简单，并且通常 CER 误差在 1% 以内。

### 步骤 2: 微型 CRNN 识别器

用于行级 OCR 的最小 CNN + BiLSTM。

```python
class TinyCRNN(nn.Module):
    def __init__(self, vocab_size=40, hidden=128, feat=32):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(1, feat, 3, 1, 1), nn.BatchNorm2d(feat), nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(feat, feat * 2, 3, 1, 1), nn.BatchNorm2d(feat * 2), nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(feat * 2, feat * 4, 3, 1, 1), nn.BatchNorm2d(feat * 4), nn.ReLU(inplace=True),
            nn.MaxPool2d((2, 1)),
            nn.Conv2d(feat * 4, feat * 4, 3, 1, 1), nn.BatchNorm2d(feat * 4), nn.ReLU(inplace=True),
            nn.MaxPool2d((2, 1)),
        )
        self.rnn = nn.LSTM(feat * 4, hidden, bidirectional=True, batch_first=True)
        self.head = nn.Linear(hidden * 2, vocab_size)

    def forward(self, x):
        # x: (N, 1, H, W)
        f = self.cnn(x)                # (N, C, H', W')
        f = f.mean(dim=2).transpose(1, 2)  # (N, W', C)
        h, _ = self.rnn(f)
        return F.log_softmax(self.head(h).transpose(0, 1), dim=-1)  # (W', N, vocab)
```

固定高度输入（CNN 通过最大池化将高度降为 1）。宽度是 CTC 的时间维度。

### 步骤 3: 合成 OCR

生成白底黑字的数字字符串，用于端到端的冒烟测试。

```python
import numpy as np

def synthetic_line(text, height=32, char_width=16):
    W = char_width * len(text)
    img = np.ones((height, W), dtype=np.float32)
    for i, c in enumerate(text):
        x = i * char_width
        shade = 0.0 if c.isalnum() else 0.5
        img[6:height - 6, x + 2:x + char_width - 2] = shade
    return img


def build_batch(strings, vocab):
    H = 32
    W = 16 * max(len(s) for s in strings)
    imgs = np.ones((len(strings), 1, H, W), dtype=np.float32)
    target_lengths = []
    targets = []
    for i, s in enumerate(strings):
        imgs[i, 0, :, :16 * len(s)] = synthetic_line(s)
        ids = [vocab.index(c) for c in s]
        targets.extend(ids)
        target_lengths.append(len(ids))
    return torch.from_numpy(imgs), torch.tensor(targets), torch.tensor(target_lengths)


vocab = ["_"] + list("0123456789abcdefghijklmnopqrstuvwxyz")
imgs, targets, lengths = build_batch(["hello", "world"], vocab)
print(f"图像：{imgs.shape}   目标：{targets.shape}   长度：{lengths.tolist()}")
```

真实的 OCR 数据集会添加字体、噪声、旋转、模糊和颜色。上述流水线是相同的。

### 步骤 4: 训练草图

```python
model = TinyCRNN(vocab_size=len(vocab))
opt = torch.optim.Adam(model.parameters(), lr=1e-3)

for step in range(200):
    strings = ["abc" + str(step % 10)] * 4 + ["xyz" + str((step + 1) % 10)] * 4
    imgs, targets, target_lens = build_batch(strings, vocab)
    log_probs = model(imgs)  # (W', 8, vocab)
    input_lens = torch.full((8,), log_probs.size(0), dtype=torch.long)
    loss = ctc_loss(log_probs, targets, input_lens, target_lens, blank=0)
    opt.zero_grad(); loss.backward(); opt.step()
```

在这个简单的合成数据上，损失应该在 200 步内从大约 3 下降到大约 0.2。

## 使用

三种生产路径：

- **PaddleOCR**—— 成熟、快速、多语言。一行代码使用：`paddleocr.PaddleOCR(lang="en").ocr(image_path)`。
- **EasyOCR**—— 原生 Python、多语言、基于 PyTorch。
- **Tesseract**—— 经典；当模型难以处理时，对于旧的扫描文档仍然有用。

对于端到端文档解析，使用 Donut 或 VLM（视觉语言模型，Vision-Language Model）：

```python
from transformers import DonutProcessor, VisionEncoderDecoderModel

processor = DonutProcessor.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
model = VisionEncoderDecoderModel.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
```

对于具有重复结构的收据、发票和表单，微调 Donut。对于任意文档或需要推理的 OCR，类似 Qwen-VL-OCR 的 VLM 是当前默认选择。

## 交付

本课程产出：

- `outputs/prompt-ocr-stack-picker.md` —— 一个提示词，根据文档类型、语言和结构选择 Tesseract / PaddleOCR / Donut / VLM-OCR。
- `outputs/skill-ctc-decoder.md` —— 一个技能，从头编写贪婪和束搜索 CTC 解码器，包括长度归一化。

## 练习

1. **（简单）** 在 5 位随机数字字符串上训练 TinyCRNN 500 步。在保留集上报告 CER。
2. **（中等）** 用束搜索（beam_width=5）替换贪婪解码。报告 CER 差异。束搜索在哪些输入上更优？
3. **（困难）** 使用 PaddleOCR 对 20 张收据进行识别，提取行项目，并对手动标注的真值计算 {item_name, price} 对的 F1。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| OCR | “从像素中提取文本” | 将图像区域转换为字符序列 |
| CTC | “无需对齐的损失” | 一种损失函数，无需每个时间步的标签即可训练序列模型；对所有对齐方式进行边缘化 |
| CRNN | “经典 OCR 模型” | 卷积特征提取器 + BiLSTM + CTC；2015 年的基线，至今仍用于生产 |
| Donut | “端到端 OCR” | ViT 编码器 + 文本解码器；直接根据图像输出 JSON |
| 版面解析（Layout parsing） | “找到区域” | 检测并标记文档中的标题/表格/图形/段落区域 |
| 阅读顺序（Reading order） | “文本序列” | 将识别出的区域排序为句子；对于拉丁文很简单，对于混合布局则很复杂 |
| CER / WER | “错误率” | 字符或词粒度的莱文斯坦距离 / 参考长度 |
| VLM-OCR | “能读的 LLM” | 经过训练或提示用于 OCR 任务的视觉语言模型；当前复杂文档上的最优方法 |

## 延伸阅读

- [CRNN（Shi 等人，2015）](https://arxiv.org/abs/1507.05717) —— 原始的 CNN+RNN+CTC 架构
- [CTC（Graves 等人，2006）](https://www.cs.toronto.edu/~graves/icml_2006.pdf) —— 原始的 CTC 论文；密集包含了算法思想
- [Donut（Kim 等人，2022）](https://arxiv.org/abs/2111.15664) —— 无需 OCR 的文档理解 transformer
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) —— 开源生产级 OCR 工具栈