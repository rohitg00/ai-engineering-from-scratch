# OCR 与文档理解

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> OCR 是一条三段式流水线 —— 检测文本框、识别字符、再做版面排版。所有现代 OCR 系统要么重排这几个阶段，要么把它们融合在一起。

**Type:** Learn + Use
**Languages:** Python
**Prerequisites:** Phase 4 Lesson 06 (Detection), Phase 7 Lesson 02 (Self-Attention)
**Time:** ~45 minutes

## 学习目标（Learning Objectives）

- 梳理经典 OCR 流水线（detect -> recognise -> layout）以及现代端到端方案（Donut、Qwen-VL-OCR）
- 实现用于 OCR 序列到序列训练的 CTC（Connectionist Temporal Classification，连接主义时序分类）损失
- 不需要训练就能用 PaddleOCR 或 EasyOCR 做生产级文档解析
- 区分 OCR、版面解析（layout parsing）和文档理解 —— 并按任务挑对工具

## 问题（The Problem）

带文字的图像无处不在：小票、发票、证件、扫描书、表单、白板、招牌、截图。从中提取出结构化数据 —— 不只是字符，而是「这一项是合计金额」—— 是应用视觉里价值最高的问题之一。

这个领域可以拆成三层技能：

1. **OCR 本身**：把像素变成文字。
2. **版面解析（Layout parsing）**：把 OCR 结果按区域分组（标题、正文、表格、页眉）。
3. **文档理解（Document understanding）**：从版面里抽出结构化字段（`invoice_total = $42.50`）。

每一层都有经典做法和现代做法，而「我想从图里拿到文字」和「我要从这张小票里拿到合计金额」之间的鸿沟，比大多数团队意识到的要大得多。

## 概念（The Concept）

### 经典流水线

```mermaid
flowchart LR
    IMG["图像"] --> DET["文本检测<br/>（DB、EAST、CRAFT）"]
    DET --> BOX["词／行<br/>边界框"]
    BOX --> CROP["裁剪每个区域"]
    CROP --> REC["识别<br/>（CRNN + CTC）"]
    REC --> TXT["文本字符串"]
    TXT --> LAY["版面<br/>排序"]
    LAY --> OUT["按阅读顺序的文本"]

    style DET fill:#dbeafe,stroke:#2563eb
    style REC fill:#fef3c7,stroke:#d97706
    style OUT fill:#dcfce7,stroke:#16a34a
```

- **文本检测（Text detection）** 输出按行或按词的四边形框。
- **识别（Recognition）** 把每个区域裁剪到固定高度，跑一个 CNN + BiLSTM + CTC 输出字符序列。
- **版面（Layout）** 重建阅读顺序（拉丁文是从上到下、从左到右；阿拉伯文、日文不一样）。

### 一段话讲完 CTC

OCR 识别要从定长特征图里产出变长序列。CTC（Graves et al., 2006）让你不需要字符级对齐就能训练这种模型。模型在每个时间步输出一个对（vocab + blank）的分布；CTC 损失会在所有「合并重复并去掉 blank 后等于目标文本」的对齐路径上做边缘化。

```
raw output: "h h h _ _ e e l l _ l l o _ _"
after merge repeats and remove blanks: "hello"
```

CTC 是 CRNN 在 2015 年能跑通的原因，到了 2026 年仍然撑起了生产环境里的大多数 OCR 模型训练。

### 现代端到端模型

- **Donut** (Kim et al., 2022) —— ViT encoder + 文本 decoder；读图直接吐 JSON。没有文本检测器，也没有版面模块。
- **TrOCR** —— ViT + transformer decoder，用于行级 OCR。
- **Qwen-VL-OCR / InternVL** —— 完整的视觉-语言模型，在 OCR 任务上做过微调；2026 年在复杂文档上精度最高。
- **PaddleOCR** —— 经典的 DB + CRNN 流水线，封装成熟的生产包；至今仍是开源主力。

端到端模型需要更多数据和算力，但绕开了多阶段流水线的误差累积。

### 版面解析

对结构化文档，跑一个版面检测器（LayoutLMv3、DocLayNet）给每个区域打标签：Title、Paragraph、Figure、Table、Footnote。阅读顺序就变成「按版面顺序遍历区域、拼接」。

对表单，用 **Key-Value 抽取（Key-Value extraction）** 模型（视觉富文档用 Donut，普通扫描件用 LayoutLMv3）。它们吃图像 + 检测出的文本 + 位置，预测结构化的键值对。

### 评估指标

- **字符错误率 CER（Character Error Rate）** —— 编辑距离 / 参考长度。越低越好。生产目标：干净扫描件上 < 2%。
- **词错误率 WER（Word Error Rate）** —— 同样的指标但按词计算。
- **结构化字段的 F1** —— 给 key-value 任务用；衡量 `{invoice_total: 42.50}` 是否正确出现。
- **JSON 上的编辑距离** —— 给端到端文档解析用；Donut 论文里提出了归一化树编辑距离。

## 动手实现（Build It）

### Step 1：CTC 损失 + 贪心解码器

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


def ctc_loss(log_probs, targets, input_lengths, target_lengths, blank=0):
    """
    log_probs:      (T, N, C) log-softmax over vocab including blank at index 0
    targets:        (N, S) int targets (no blanks)
    input_lengths:  (N,) per-sample time steps used
    target_lengths: (N,) per-sample target length
    """
    return F.ctc_loss(log_probs, targets, input_lengths, target_lengths,
                      blank=blank, reduction="mean", zero_infinity=True)


def greedy_ctc_decode(log_probs, blank=0):
    """
    log_probs: (T, N, C) log-softmax
    returns: list of index sequences (blanks removed, repeats merged)
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

`F.ctc_loss` 在有 CuDNN 时会用其高效实现。贪心解码器比 beam search 简单，CER 通常也只比 beam search 差 1% 以内。

### Step 2：迷你 CRNN 识别器

最小化的 CNN + BiLSTM，用于行级 OCR。

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

输入高度固定（CNN 把高度 max-pool 到 1）。宽度作为 CTC 的时间维。

### Step 3：合成 OCR 数据

生成黑底白字的数字串，做端到端冒烟测试。

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
print(f"images: {imgs.shape}   targets: {targets.shape}   lengths: {lengths.tolist()}")
```

真实 OCR 数据集会再加上字体、噪声、旋转、模糊和颜色。但流水线本身和上面这套是一模一样的。

### Step 4：训练雏形

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

在这个简单合成数据上，loss 应该会在 200 步内从 ~3 降到 ~0.2。

## 用起来（Use It）

三条生产路径：

- **PaddleOCR** —— 成熟、快、多语种。一行就能用：`paddleocr.PaddleOCR(lang="en").ocr(image_path)`。
- **EasyOCR** —— Python 原生、多语种、PyTorch 后端。
- **Tesseract** —— 经典老将；模型搞不定的老旧扫描件，它依然管用。

要做端到端文档解析，用 Donut 或 VLM：

```python
from transformers import DonutProcessor, VisionEncoderDecoderModel

processor = DonutProcessor.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
model = VisionEncoderDecoderModel.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
```

对结构可重复的小票、发票、表单，fine-tune Donut。对任意文档，或需要带推理的 OCR，目前默认选 Qwen-VL-OCR 这类 VLM。

## 上线部署（Ship It）

这节课产出：

- `outputs/prompt-ocr-stack-picker.md` —— 一个 prompt，根据文档类型、语种和结构，挑 Tesseract / PaddleOCR / Donut / VLM-OCR。
- `outputs/skill-ctc-decoder.md` —— 一个 skill，从零写贪心和 beam search CTC 解码器，包含长度归一化。

## 练习（Exercises）

1. **（简单）** 在 5 位随机数字串上训练 TinyCRNN 500 步。在留出集上报告 CER。
2. **（中等）** 把贪心解码换成 beam search（beam_width=5）。报告 CER 差值。在哪类输入上 beam search 会赢？
3. **（困难）** 用 PaddleOCR 处理 20 张小票，抽出每个 line item，对 `{item_name, price}` 这对值跟手工标注的 ground truth 算 F1。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| OCR | "Text from pixels" | 把图像区域变成字符序列 |
| CTC | "Alignment-free loss" | 训练序列模型时不需要逐时间步标签的损失；在所有对齐路径上做边缘化 |
| CRNN | "Classic OCR model" | 卷积特征抽取 + BiLSTM + CTC；2015 年的 baseline，至今仍跑在生产里 |
| Donut | "End-to-end OCR" | ViT encoder + 文本 decoder；从图像直接吐 JSON |
| Layout parsing | "Find regions" | 在文档里检测并标注 Title/Table/Figure/Paragraph 等区域 |
| Reading order | "Text sequence" | 把识别出的区域排成一段话；拉丁文很容易，混合版面就不容易 |
| CER / WER | "Error rates" | 字符或词粒度上的编辑距离 / 参考长度 |
| VLM-OCR | "LLM that reads" | 为 OCR 任务训练或 prompt 出来的视觉-语言模型；目前在复杂文档上是 SOTA |

## 延伸阅读（Further Reading）

- [CRNN (Shi et al., 2015)](https://arxiv.org/abs/1507.05717) —— 最初的 CNN+RNN+CTC 架构
- [CTC (Graves et al., 2006)](https://www.cs.toronto.edu/~graves/icml_2006.pdf) —— CTC 原始论文；算法思路密度极高
- [Donut (Kim et al., 2022)](https://arxiv.org/abs/2111.15664) —— 不依赖 OCR 的文档理解 transformer
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) —— 开源生产级 OCR 全家桶
