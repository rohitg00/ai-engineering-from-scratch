# 19 · OCR 与文档理解

> OCR 是一条三阶段流水线——检测文本框、识别字符，然后还原版面。每一个现代 OCR 系统都是在重排这些阶段，或者把它们合并起来。

**类型：** 学习 + 使用
**语言：** Python
**前置：** 第 4 阶段第 06 课（目标检测），第 7 阶段第 02 课（自注意力）
**时长：** 约 45 分钟

## 学习目标

- 梳理经典 OCR 流水线（检测 -> 识别 -> 版面还原）以及现代端到端替代方案（Donut、Qwen-VL-OCR）
- 实现用于序列到序列 OCR 训练的「CTC 损失（Connectionist Temporal Classification，联结主义时序分类）」
- 在无需训练的情况下，使用 PaddleOCR 或 EasyOCR 完成生产级文档解析
- 区分 OCR、版面解析（layout parsing）与文档理解（document understanding）——并为每类任务挑选合适的工具

## 问题所在

满是文字的图像无处不在：收据、发票、证件、扫描书籍、表单、白板、标识牌、截图。从中抽取结构化数据——不仅是字符，而是「这是总金额」——是价值最高的应用视觉问题之一。

这个领域可拆分为三个能力层：

1. **OCR 本身**：把像素变成文本。
2. **版面解析**：把 OCR 输出归并成区域（标题、正文、表格、页眉）。
3. **文档理解**：从版面中抽取结构化字段（`invoice_total = $42.50`）。

每一层都有经典方法与现代方法，而「我想从图像里拿到文字」和「我需要这张收据上的总金额」之间的鸿沟，比大多数团队意识到的要大得多。

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

- **文本检测（text detection）** 产出逐行或逐词的四边形框。
- **识别（recognition）** 把每个区域裁剪到固定高度，再跑一遍 CNN + BiLSTM + CTC，输出字符序列。
- **版面（layout）** 重建阅读顺序（拉丁文是从上到下、从左到右；阿拉伯文、日文则不同）。

### 一段话讲清 CTC

OCR 识别要从一张定长的特征图产出一个变长序列。CTC（Graves 等人，2006）让你无需字符级对齐就能训练这种模型。模型在每个时间步上输出一个覆盖（词表 + 空白符）的分布；CTC 损失对所有「在合并重复、去除空白符后能归约为目标文本」的对齐方式进行边缘化求和。

```
raw output: "h h h _ _ e e l l _ l l o _ _"
after merge repeats and remove blanks: "hello"
```

CTC 正是 CRNN 在 2015 年得以奏效的原因，到 2026 年它仍在训练着大多数生产级 OCR 模型。

### 现代端到端模型

- **Donut**（Kim 等人，2022）——一个 ViT 编码器 + 一个文本解码器；读入图像后直接吐出 JSON。没有文本检测器，也没有版面模块。
- **TrOCR**——ViT + Transformer 解码器，用于行级 OCR。
- **Qwen-VL-OCR / InternVL**——针对 OCR 任务微调的完整视觉语言模型；在 2026 年的复杂文档上精度最佳。
- **PaddleOCR**——成熟的生产级软件包，采用经典的 DB + CRNN 流水线；至今仍是开源界的主力工具。

端到端模型需要更多数据与算力，但能跳过多阶段流水线的误差累积问题。

### 版面解析

对于结构化文档，跑一个版面检测器（LayoutLMv3、DocLayNet），它会为每个区域打上标签：标题（Title）、段落（Paragraph）、图（Figure）、表格（Table）、脚注（Footnote）。这样一来，阅读顺序就变成「按版面顺序遍历各区域并拼接」。

对于表单，使用 **键值抽取（Key-Value extraction）** 模型（视觉信息丰富的文档用 Donut，普通扫描件用 LayoutLMv3）。它们接收图像 + 检测到的文本 + 位置，预测出结构化的键值对。

### 评测指标

- **字符错误率（Character Error Rate，CER）**——莱文斯坦距离（Levenshtein distance）/ 参考文本长度。越低越好。生产目标：干净扫描件上低于 2%。
- **词错误率（Word Error Rate，WER）**——同上，但在词级别上计算。
- **结构化字段的 F1**——用于键值任务；衡量 `{invoice_total: 42.50}` 是否正确出现。
- **JSON 上的编辑距离**——用于端到端文档解析；Donut 论文引入了归一化的树编辑距离（normalised tree edit distance）。

## 动手构建

### 第 1 步：CTC 损失 + 贪心解码器

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


def ctc_loss(log_probs, targets, input_lengths, target_lengths, blank=0):
    """
    log_probs:      (T, N, C) 在词表上的 log-softmax，空白符位于索引 0
    targets:        (N, S) 整数目标（不含空白符）
    input_lengths:  (N,) 每个样本使用的时间步数
    target_lengths: (N,) 每个样本的目标长度
    """
    return F.ctc_loss(log_probs, targets, input_lengths, target_lengths,
                      blank=blank, reduction="mean", zero_infinity=True)


def greedy_ctc_decode(log_probs, blank=0):
    """
    log_probs: (T, N, C) log-softmax
    返回: 索引序列的列表（已去除空白符、合并重复）
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

`F.ctc_loss` 在可用时会调用高效的 CuDNN 实现。贪心解码器比束搜索（beam search）更简单，CER 通常与之相差在 1% 以内。

### 第 2 步：迷你 CRNN 识别器

用于行级 OCR 的最小化 CNN + BiLSTM。

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

输入高度固定（CNN 把高度最大池化到 1）。宽度则是 CTC 所用的时间维度。

### 第 3 步：合成 OCR 数据

生成黑底白字（black-on-white）的数字串，用于端到端的冒烟测试。

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

真实的 OCR 数据集还会加入字体、噪声、旋转、模糊和色彩。但上面这套流水线是完全一样的。

### 第 4 步：训练框架草图

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

在这份极简的合成数据上，损失应在 200 步内从约 3 降到约 0.2。

## 实战运用

三条生产路径：

- **PaddleOCR**——成熟、快速、支持多语言。一行即用：`paddleocr.PaddleOCR(lang="en").ocr(image_path)`。
- **EasyOCR**——原生 Python，多语言，以 PyTorch 为骨干。
- **Tesseract**——经典工具；当模型力不从心时，对处理陈旧的扫描文档仍然有用。

对于端到端文档解析，使用 Donut 或一个 VLM：

```python
from transformers import DonutProcessor, VisionEncoderDecoderModel

processor = DonutProcessor.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
model = VisionEncoderDecoderModel.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
```

对于结构可复现的收据、发票和表单，微调 Donut。对于任意文档，或是需要推理的 OCR，像 Qwen-VL-OCR 这样的 VLM 是当下的默认选择。

## 交付成果

本课产出：

- `outputs/prompt-ocr-stack-picker.md`——一个提示词，根据文档类型、语言和结构，从 Tesseract / PaddleOCR / Donut / VLM-OCR 中挑选方案。
- `outputs/skill-ctc-decoder.md`——一个 skill，从零编写贪心与束搜索的 CTC 解码器，包含长度归一化。

## 练习

1. **（简单）** 在 5 位随机数字串上训练 TinyCRNN 共 500 步。在保留集（held-out set）上报告 CER。
2. **（中等）** 用束搜索（beam_width=5）替换贪心解码。报告 CER 的变化量。在哪些输入上束搜索更胜一筹？
3. **（困难）** 在一组 20 张收据上使用 PaddleOCR，抽取行项目（line items），并针对 {item_name, price} 键值对，与人工标注的真值计算 F1。

## 关键术语

| 术语 | 人们口中的说法 | 它实际的含义 |
|------|----------------|----------------------|
| OCR | 「从像素得到文本」 | 把图像区域转换成字符序列 |
| CTC | 「免对齐损失」 | 无需逐时间步标签即可训练序列模型的损失；对各种对齐方式做边缘化 |
| CRNN | 「经典 OCR 模型」 | 卷积特征提取器 + BiLSTM + CTC；2015 年的基线，至今仍用于生产 |
| Donut | 「端到端 OCR」 | ViT 编码器 + 文本解码器；从图像直接吐出 JSON |
| 版面解析 | 「找区域」 | 检测并标注文档中的 标题/表格/图/段落 区域 |
| 阅读顺序 | 「文本序列」 | 把识别出的区域排成一句话的顺序；拉丁文很简单，混合版面则不然 |
| CER / WER | 「错误率」 | 字符或词粒度上的 莱文斯坦距离 / 参考文本长度 |
| VLM-OCR | 「会读字的 LLM」 | 经训练或经提示来做 OCR 任务的视觉语言模型；当前复杂文档上的 SOTA |

## 延伸阅读

- [CRNN（Shi 等人，2015）](https://arxiv.org/abs/1507.05717)——最初的 CNN+RNN+CTC 架构
- [CTC（Graves 等人，2006）](https://www.cs.toronto.edu/~graves/icml_2006.pdf)——最初的 CTC 论文；密集承载了各种算法思想
- [Donut（Kim 等人，2022）](https://arxiv.org/abs/2111.15664)——免 OCR 的文档理解 Transformer
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)——开源的生产级 OCR 技术栈
