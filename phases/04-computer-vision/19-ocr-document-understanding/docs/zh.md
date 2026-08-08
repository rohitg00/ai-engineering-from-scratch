# OCR和文档理解

> OCR是一个三阶段流水线-检测文本框、识别字符，然后将其布置。每个现代OCR系统都会重新排序这些阶段或合并它们。

** 类型：** 学习+使用
** 语言：** Python
** 先决条件：** 第4阶段第06课（检测），第7阶段第02课（自我注意）
** 时间：** ~45分钟

## 学习目标

- 跟踪经典OCR管道（检测->识别->布局）和现代端到端替代品（Donut、Qwen-VL-OCR）
- 对序列到序列OCR训练实施CTC（连接主义时态分类）损失
- 使用PaddleOCR或EasyOCR进行生产文档解析，无需培训
- 区分OCR、布局解析和文档理解-并为每个任务选择合适的工具

## 问题

充满文本的图像随处可见：收据、发票、身份证、扫描书籍、表格、白板、标牌、屏幕截图。从它们中提取结构化数据--不仅仅是字符，还有“这是总量”--是价值最高的应用视觉问题之一。

该领域分为三个技能层：

1. **OCR正确 **：将像素转换为文本。
2. ** 布局解析 **：将OCR输出分组为区域（标题、正文、表格、标题）。
3. **Document understanding**: extract structured fields ("invoice_total = $42.50") from layout.

每个层都有经典和现代的方法，“我想要图像中的文本”和“我需要这张收据的总金额”之间的差距比大多数团队意识到的要大。

## 概念

### The classical pipeline

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

- ** 文本检测 ** 生成每行或每字的千次体。
- ** 识别 ** 将每个区域裁剪到固定高度，运行CNN + BiLSTM + CTC以生成字符序列。
- ** 布局 ** 重建阅读顺序（拉丁语为从上到下、从左到右;阿拉伯语、日语不同）。

### 一段中的反恐委员会

OCR识别从固定长度的特征地图生成可变长度的序列。反恐委员会（格雷夫斯等人，2006）让您在无需字符级对齐的情况下训练该功能。该模型在每个时间步输出（vocab + blank）的分布;合并重复并删除空白后，在所有减少到目标文本的对齐中，CTC损失进行边缘化。

```
raw output: "h h h _ _ e e l l _ l l o _ _"
after merge repeats and remove blanks: "hello"
```

CRC是CRNN在2015年工作的原因，并且在2026年仍在培训大多数生产OCR模型。

### 现代端到端模型

- ** 甜甜圈 **（Kim等人，2022）-ViT编码器+文本解码器;读取图像并直接发出SON。没有文本检测器，没有布局模块。
- **TrOCR** — ViT + transformer decoder for line-level OCR.
- **Qwen-VL-OCR / InternVL** -针对OCR任务进行了微调的完整视觉语言模型;复杂文档的准确性将在2026年达到最佳。
- **PaddleOCR** -成熟产品包中的经典DB + CRNN管道;仍然是开源主力。

End-to-end models need more data and compute but skip the error accumulation of multi-stage pipelines.

### 布局解析

对于结构化文档，运行布局检测器（LayoutLMv3，DocLayNet），标记每个区域：标题，段落，图，表，脚注。然后，阅读顺序变为“按布局顺序遍历区域，连接”。"

对于表单，使用 **Key-Value提取 ** 模型（Donut用于视觉丰富的文档，LayoutLMv 3用于普通扫描）。它们获取图像+检测到的文本+位置并预测结构化的关键字-值对。

### 评估指标

- ** 字符错误率（BER）** - Levenshtein距离/引用长度。低越好。生产目标：清洁扫描< 2%。
- ** 字错误率（WER）** -字级别相同。
- **F1 on structured fields** — for key-value tasks; measures whether `{invoice_total: 42.50}` appears correctly.
- ** JSON上的编辑距离 ** -用于端到端文档解析; Donut论文引入了规范化树编辑距离。

## 建设党

### 第1步：CTC丢失+贪婪解码器

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

' F.ctc_loss '在可用时使用高效的CuDNN实现。贪婪解码器比束搜索更简单，通常在1%的BER范围内。

### 第2步：微型CRNN识别器

用于线路OCR的最低CNN + BiLSTM。

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

固定高度输入（CNN最大池高度为1）。宽度是CTC的时间维度。

### Step 3: Synthetic OCR

Generate black-on-white digit strings for an end-to-end smoke test.

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

真实的OCR数据集添加字体、噪音、旋转、模糊和颜色。上面的管道相同。

### 第4步：训练草图

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

对于这个微不足道的合成数据，经过200步，损失应该从~3下降到~0.2。

## 使用它

三种生产途径：

- **PaddleOCR** -成熟、快速、多语言。一行用法：' paddleOCR（lang=“en”）.ocr（Image_路径）'。
- **EasyOCR** -Python原生、多语言、PyTorch主干。
- **Tesseract** -经典;当模型遇到困难时，对于旧扫描文档仍然有用。

对于端到端文档解析，请使用Donut或VLM：

```python
from transformers import DonutProcessor, VisionEncoderDecoderModel

processor = DonutProcessor.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
model = VisionEncoderDecoderModel.from_pretrained("naver-clova-ix/donut-base-finetuned-cord-v2")
```

For receipts, invoices, and forms with repeatable structure, fine-tune Donut. For arbitrary documents or OCR with reasoning, a VLM like Qwen-VL-OCR is the current default.

## 把它运

本课产生：

- '输出/prompt-ocr-stack-picker.md '-一个提示，选择Tesseract / PaddleOCR / Donut / VLM-OCR给定的文档类型、语言和结构。
- `outputs/skill-ctc-decoder.md` — a skill that writes greedy and beam-search CTC decoders from scratch, including length normalisation.

## 演习

1. **（简单）** 在5位随机数字字符串上训练TinyCRNN 500步。报告持有的集的临床评价报告。
2. **（中等）** 用束搜索替换贪婪解码（beam_band =5）。报告BER增量。射束搜索在哪些输入上获胜？
3. **(Hard)** Use PaddleOCR on a set of 20 receipts, extract line items, and compute F1 against hand-labelled ground truth for {item_name, price} pairs.

## 关键术语

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| OCR | “像素文本” | 将图像区域转化为字符序列 |
| CTC | “无对齐损失” | 训练序列模型而没有按时步标签的损失;对对齐进行边缘化 |
| CRNN | “经典OCR模型” | Conv特征提取器+ BiLSTM + CIC; 2015年基线仍用于生产 |
| 甜甜圈 | “端到端OCR” | ViT编码器+文本解码器;直接从图像中发射SON |
| 布局解析 | “查找地区” | Detect and label Title/Table/Figure/Paragraph regions in a document |
| 阅读顺序 | “文本序列” | 将已识别的区域排序到句子中;拉丁语很琐碎，混合布局很重要 |
| BER/ WER | “错误率” | 字符或单词粒度的Levenshtein距离/引用长度 |
| VLM-OCR | “LLM内容如下” | 为OCR任务训练或提示的视觉语言模型;复杂文档上的当前SOTA |

## Further Reading

- [CRNN（施等人，2015）]（https：//arxiv.org/abs/1507.05717）-原始CNN+RNN+CTC架构
- [CTC（格雷夫斯等人，2006）]（https：//www.cs.toronto.edu/graves/icml_2006.pdf）-最初的CTE论文;充满了算法想法
- [甜甜圈（Kim等人，2022）]（https：//arxiv.org/abs/2111.15664）-无OCR文档理解Transformer
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) — the open-source production OCR stack
