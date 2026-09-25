# OCR 与文档理解

> OCR 是一个三阶段流水线——检测文本框、识别字符、然后进行版面排版。每个现代 OCR 系统都会重新排列或合并这些阶段。

**Type:** Learn + Use
**Languages:** Python
**Prerequisites:** Phase 4 Lesson 06（检测），Phase 7 Lesson 02（自注意力）
**Time:** ~45 分钟

## 学习目标

- 梳理经典 OCR 流水线（检测 -> 识别 -> 版面）以及现代端到端替代方案（Donut、Qwen-VL-OCR）
- 实现用于序列到序列 OCR 训练的 CTC（Connectionist Temporal Classification）损失
- 使用 PaddleOCR 或 EasyOCR 在无需训练的情况下进行生产级文档解析
- 区分 OCR、版面解析和文档理解——并为每个任务选择合适的工具

## 问题所在

充满文字的图像无处不在：收据、发票、证件、扫描书籍、表单、白板、标牌、截图。从中提取结构化数据——不仅是字符，还有"这是总金额"——是应用视觉领域价值最高的问题之一。

该领域分为三个技能层次：

1. **狭义 OCR**:将像素转为文本。
2. **版面解析**:将 OCR 输出分组为区域（标题、正文、表格、页眉）。
3. **文档理解**：从版面中提取结构化字段（"invoice_total = $42.50"）。

每一层都有经典方法和现代方法，而"我想从图像中获取文本"与"我需要从这张收据中获取总金额"之间的差距比大多数团队意识到的要大。

## 核心概念

### 经典流水线

```mermaid
flowchart LR
    IMG["Image"] --> DET["Text detection<br/>(DB, EAST, CRAFT)"]
    DET --> BOX["Word/line<br/>bounding boxes"]
    BOX --> CROP["Crop each region"]
    CROP --> REC["Recognition<br/>(CRNN + CTC)"]
    REC --> TXT["Text strings"]
    TXT --> LAY["Layout<br/>ordering"]
    LAY --> OUT["Reading-order text"]

    style DET fill:#dbeafe,stroke:#2563eb
    style REC fill:#fef3c7,stroke:#d97706
    style OUT fill:#dcfce7,stroke:#16a34a
```

- **文本检测**产生逐行或逐词的四边形框。
- **识别**将每个区域裁剪为固定高度，运行 CNN + BiLSTM + CTC 以生成字符序列。
- **版面**重建阅读顺序（拉丁文为从上到下、从左到右；阿拉伯文和日文则不同）。

### 一段话讲清 CTC

OCR 识别要从固定长度的特征图产生可变长度的序列。CTC（Graves 等人，2006）让你无需字符级对齐即可训练该模型。模型在每个时间步输出 (词表 + blank) 上的分布；CTC 损失对所有对齐路径进行边际化——即那些在合并重复字符并移除 blank 后可归约为目标文本的对齐。

```
raw output: "h h h _ _ e e l l _ l l o _ _"
after merge repeats and remove blanks: "hello"
```

CTC 是 CRNN 在 2015 年能工作的原因，而且在 2026 年仍驱动着大多数生产级 OCR 模型的训练。

### 现代端到端模型

- **Donut**（Kim 等人，2022）——ViT 编码器 + 文本解码器；直接读取图像并输出 JSON。没有文本检测器，没有版面模块。
- **TrOCR**——ViT + transformer 解码器，用于行级 OCR。
- **Qwen-VL-OCR / InternVL**——针对 OCR 任务微调的完整视觉-语言模型；在 2026 年复杂文档上准确率最佳。
- **PaddleOCR**——成熟生产包中的经典 DB + CRNN 流水线；仍是开源领域的主力。

端到端模型需要更多数据和算力，但避免了多阶段流水线的误差累积。

### 版面解析

对于结构化文档，运行版面检测器（LayoutLMv3、DocLayNet）为每个区域打标签：Title、Paragraph、Figure、Table、Footnote。阅读顺序于是变成"按版面顺序遍历区域，拼接文本"。

对于表单，使用**键值抽取**模型（视觉丰富文档用 Donut，普通扫描件用 LayoutLMv3）。它们以图像 + 检测到的文本 + 位置为输入，预测结构化的键值对。

### 评估指标

- **字符错误率（CER）**——Levenshtein 距离 / 参考文本长度。越低越好。生产目标：干净扫描件上 < 2%。
- **词错误率（WER）**——在词级别上同理。
- **结构化字段的 F1**——用于键值任务；衡量 `{invoice_total: 42.50}` 是否被正确识别。
- **JSON 上的编辑距离**——用于端到端文档解析；Donut 论文引入了归一化树编辑距离。

```figure
cv3-ctc-collapse
```

## 动手实现

### 步骤 1:CTC 损失 + 贪心解码器

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

`F.ctc_loss` 在可用时使用高效的 CuDNN 实现。贪心解码器比束搜索更简单，通常与它的 CER 差距在 1% 以内。

### 步骤 2：微型 CRNN 识别器

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

固定高度输入（CNN 将高度最大池化到 1）。宽度是 CTC 的时间维度。

### 步骤 3：合成 OCR

生成白底黑字的数字字符串，用于端到端冒烟测试。

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

真实 OCR 数据集会增加字体、噪声、旋转、模糊和色彩。上面的流水线完全相同。

### 步骤 4：训练草图

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

在这个简单的合成数据上，损失应在 200 步内从 ~3 降到 ~0.2。

## 使用它

三条生产路径：

- **PaddleOCR**——成熟、快速、多语言。一行用法：`paddleocr.PaddleOCR(lang="en").ocr(image_path)`。
- **EasyOCR**——Python 原生、多语言、PyTorch 后端。
- **Tesseract**——经典方案；在模型表现不佳的旧扫描文档上仍然有用。

对于端到端文档解析，使用 Donut 或 VLM:

```python
from transformers import DonutProcessor, VisionEncoderDecoderModel

processor = DonutProcessor.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
model = VisionEncoderDecoderModel.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
```

对于结构可重复的收据、发票和表单，微调 Donut。对于任意文档或需要推理的 OCR,像 Qwen-VL-OCR 这样的 VLM 是当前默认选择。

## 发布它

本课产出：

- `outputs/prompt-ocr-stack-picker.md`——一个提示词，根据文档类型、语言和结构在 Tesseract / PaddleOCR / Donut / VLM-OCR 之间做出选择。
- `outputs/skill-ctc-decoder.md`——一项技能，从零编写贪心和束搜索 CTC 解码器，包括长度归一化。

## 练习

1. **(简单)** 在 5 位随机数字字符串上训练 TinyCRNN 500 步。报告在保留集上的 CER。
2. **(中等)** 用束搜索（beam_width=5）替换贪心解码。报告 CER 的变化。在哪些输入上束搜索更优？
3. **(困难)** 在 20 张收据上使用 PaddleOCR，提取行项目，并针对人工标注的真值计算 {item_name, price} 键值对的 F1。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| OCR | "从像素到文本" | 将图像区域转为字符序列 |
| CTC | "免对齐损失" | 无需逐时间步标签即可训练序列模型的损失；对所有对齐路径进行边际化 |
| CRNN | "经典 OCR 模型" | 卷积特征提取器 + BiLSTM + CTC;2015 年的基线,至今仍用于生产 |
| Donut | "端到端 OCR" | ViT 编码器 + 文本解码器；直接从图像输出 JSON |
| 版面解析 | "找到区域" | 检测并标记文档中的 Title/Table/Figure/Paragraph 区域 |
| 阅读顺序 | "文本序列" | 将识别出的区域排列成句子的顺序；对拉丁文轻而易举,对混合版面则不然 |
| CER / WER | "错误率" | 在字符或词粒度上的 Levenshtein 距离 / 参考长度 |
| VLM-OCR | "会读的 LLM" | 为 OCR 任务训练或提示的视觉-语言模型；在复杂文档上为当前 SOTA |

## 延伸阅读

- [CRNN（Shi 等人，2015）](https://arxiv.org/abs/1507.05717)——最初的 CNN+RNN+CTC 架构
- [CTC（Graves 等人，2006）](https://www.cs.toronto.edu/~graves/icml_2006.pdf)——最初的 CTC 论文；密集地包含了算法思想
- [Donut（Kim 等人，2022）](https://arxiv.org/abs/2111.15664)——免 OCR 的文档理解 Transformer
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)——开源生产级 OCR 技术栈