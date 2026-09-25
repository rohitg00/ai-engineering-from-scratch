# 序列到序列模型

> 两个假装自己是翻译器的 RNN。它们遇到的瓶颈正是注意力机制存在的原因。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 08(CNN 与 RNN 处理文本)，Phase 3 · 11(PyTorch 入门)
**Time:** 约 75 分钟

## 问题所在

分类是将一个可变长度的序列映射到单个标签。翻译则是将一个可变长度的序列映射到另一个可变长度的序列。输入和输出处于不同的词表中，甚至可能是不同的语言，且长度没有任何对齐保证。

seq2seq 架构(Sutskever、Vinyals、Le,2014)用一个刻意简单的方案解决了这个问题：两个 RNN。一个读取源句子，生成一个固定大小的上下文向量；另一个读取该向量，逐个 token 地生成目标句子。本质上就是你第 08 课写过的代码，只是以不同的方式拼接在一起。

这个课题值得研究有两个原因。首先，上下文向量瓶颈是 NLP 中最具教学价值的失败案例，它解释了注意力和 Transformer 的全部优势所在。其次，其训练方案(teacher forcing、scheduled sampling、推理时的 beam search)至今仍适用于包括 LLM 在内的所有现代生成系统。

## 核心概念

**编码器。** 读取源句子的 RNN。其最终隐藏状态就是**上下文向量**——对整个输入的固定大小摘要。理论上，除了源句子本身，不丢失任何信息。

**解码器。** 从上下文向量初始化的另一个 RNN。每一步它以上一步生成的 token 作为输入，输出目标词表上的一个分布。通过采样或 argmax 选出下一个 token,再将其喂回去。如此重复，直到生成 `<EOS>` token 或达到最大长度。

**训练：** 在解码器的每一步计算交叉熵损失，并对整个序列求和。标准的通过时间的反向传播，贯穿两个网络。

**Teacher forcing。** 训练时，解码器在步 `t` 的输入是位置 `t-1` 的*真实* token,而非解码器自己上一步的预测。这能稳定训练；若不这样做，早期错误会不断累积，模型永远学不会。而推理时只能使用模型自身的预测，因此始终存在训练/推理分布差距。这个差距被称为**曝光偏差(exposure bias)**。

**瓶颈。** 编码器学到的关于源句的一切都必须压缩进那一个上下文向量。长句子丢失细节，生僻词变得模糊，语序调整(chat noir 与 black cat)只能靠记忆而非计算。

注意力机制(第 10 课)通过让解码器查看*每一个*编码器隐藏状态——而不仅仅是最后一个——来解决这个问题。这就是它的全部卖点。

```figure
lstm-gates
```

## 动手构建

### 第 1 步：编码器

```python
import torch
import torch.nn as nn


class Encoder(nn.Module):
    def __init__(self, src_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(src_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)

    def forward(self, src):
        e = self.embed(src)
        outputs, hidden = self.gru(e)
        return outputs, hidden
```

`outputs` 的形状为 `[batch, seq_len, hidden_dim]`——每个输入位置对应一个隐藏状态。`hidden` 的形状为 `[1, batch, hidden_dim]`——最后一步的状态。第 08 课说过“对输出做池化用于分类”。这里我们保留最后一个隐藏状态作为上下文向量，忽略逐步的输出。

### 第 2 步：解码器

```python
class Decoder(nn.Module):
    def __init__(self, tgt_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(tgt_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, tgt_vocab_size)

    def forward(self, token, hidden):
        e = self.embed(token)
        out, hidden = self.gru(e, hidden)
        logits = self.fc(out)
        return logits, hidden
```

解码器每次只被调用一步。输入：一批单个 token 和当前隐藏状态。输出：下一个 token 的词表 logits 以及更新后的隐藏状态。

### 第 3 步：带 teacher forcing 的训练循环

```python
def train_batch(encoder, decoder, src, tgt, bos_id, optimizer, teacher_forcing_ratio=0.9):
    optimizer.zero_grad()
    _, hidden = encoder(src)
    batch_size, tgt_len = tgt.shape
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    loss = 0.0
    loss_fn = nn.CrossEntropyLoss(ignore_index=0)

    for t in range(tgt_len):
        logits, hidden = decoder(input_token, hidden)
        step_loss = loss_fn(logits.squeeze(1), tgt[:, t])
        loss += step_loss
        use_teacher = torch.rand(1).item() < teacher_forcing_ratio
        if use_teacher:
            input_token = tgt[:, t].unsqueeze(1)
        else:
            input_token = logits.argmax(dim=-1)

    loss.backward()
    optimizer.step()
    return loss.item() / tgt_len
```

两个值得了解的参数。`ignore_index=0` 跳过填充 token 上的损失。`teacher_forcing_ratio` 是每一步使用真实 token 还是模型自身预测的概率。从 1.0 开始(完全 teacher forcing),随训练退火降至约 0.5,以缩小曝光偏差造成的差距。

### 第 4 步：推理循环(贪心)

```python
@torch.no_grad()
def greedy_decode(encoder, decoder, src, bos_id, eos_id, max_len=50):
    _, hidden = encoder(src)
    batch_size = src.shape[0]
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    output_ids = []
    for _ in range(max_len):
        logits, hidden = decoder(input_token, hidden)
        next_token = logits.argmax(dim=-1)
        output_ids.append(next_token)
        input_token = next_token
        if (next_token == eos_id).all():
            break
    return torch.cat(output_ids, dim=1)
```

贪心解码在每一步选择概率最高的 token。它可能走偏：一旦确定了一个 token,就无法反悔。**Beam search** 则保留得分最高的 `k` 个部分序列，最后选出得分最高的完整序列。beam 宽度通常取 3-5。

### 第 5 步：实证展示瓶颈

在一个玩具复制任务上训练模型：源 `[a, b, c, d, e]`,目标 `[a, b, c, d, e]`。逐步增加序列长度，观察准确率。

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

单个 GRU 隐藏状态无法无损地记住一个 40 token 的输入。信息在每个编码器步骤都存在，但解码器只能看到最后一个状态。注意力机制直接解决了这个问题。

## 实际应用

PyTorch 提供了基于 `nn.Transformer` 和 `nn.LSTM` 的 seq2seq 模板。Hugging Face 的 `transformers` 库提供了在数十亿 token 上训练的完整编码器-解码器模型(BART、T5、mBART、NLLB)。

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

现代编码器-解码器模型用 Transformer 取代了 RNN。其高层结构(编码器、解码器、逐 token 生成)与 2014 年的 seq2seq 论文完全相同，只是每个模块内部的机制不同。

### 何时仍应选用基于 RNN 的 seq2seq

对新项目而言，几乎从不。特例包括：

- 流式翻译：需要以有界内存逐 token 消费输入。
- 端侧文本生成：Transformer 的内存开销过于昂贵。
- 教学用途：理解编码器-解码器瓶颈是理解 Transformer 为何获胜的最快途径。

### 曝光偏差及其缓解方法

- **Scheduled sampling。** 训练期间逐步降低 teacher forcing 比例，让模型学会从自身错误中恢复。
- **最小风险训练。** 以句子级 BLEU 分数而非 token 级交叉熵进行训练，更贴近你真正想要的目标。
- **强化学习微调。** 用某个指标作为奖励来训练序列生成器，这是现代 LLM RLHF 中使用的做法。

这三种方法在基于 Transformer 的生成中依然适用。

## 发布

保存为 `outputs/prompt-seq2seq-design.md`:

```markdown
---
name: seq2seq-design
description: Design a sequence-to-sequence pipeline for a given task.
phase: 5
lesson: 09
---

Given a task (translation, summarization, paraphrase, question rewrite), output:

1. Architecture. Pretrained transformer encoder-decoder (BART, T5, mBART, NLLB) is the default. RNN-based seq2seq only for specific constraints.
2. Starting checkpoint. Name it (`facebook/bart-base`, `google/flan-t5-base`, `facebook/nllb-200-distilled-600M`). Match the checkpoint to task and language coverage.
3. Decoding strategy. Greedy for deterministic output, beam search (width 4-5) for quality, sampling with temperature for diversity. One sentence justification.
4. One failure mode to verify before shipping. Exposure bias manifests as generation drift on longer outputs; sample 20 outputs at the 90th-percentile length and eyeball.

Refuse to recommend training a seq2seq from scratch for under a million parallel examples. Flag any pipeline that uses greedy decoding for user-facing content as fragile (greedy repeats and loops).
```

## 练习

1. **简单。** 实现玩具复制任务。在目标等于源的输入-输出对上训练一个 GRU seq2seq。测量长度为 5、10、20 时的准确率，复现瓶颈现象。
2. **中等。** 添加 beam 宽度为 3 的 beam search 解码。在一个小型平行语料上与贪心解码比较 BLEU。记录 beam search 的优势之处(通常是末尾 token)和没有差异之处。
3. **困难。** 在一个 1 万对的改写数据集上微调 `facebook/bart-base`。在留出数据上比较微调模型与基础模型的 beam-4 输出。报告 BLEU 并挑选 10 个定性示例。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 编码器 | 输入 RNN | 读取源句子。生成逐步隐藏状态和一个最终上下文向量。 |
| 解码器 | 输出 RNN | 从上下文向量初始化。逐个生成目标 token。 |
| 上下文向量 | 摘要 | 编码器最终的隐藏状态。固定大小。即注意力机制所解决的瓶颈。 |
| Teacher forcing | 使用真实 token | 训练时将真实的上一个 token 作为输入。稳定学习过程。 |
| 曝光偏差 | 训练/测试差距 | 模型在真实 token 上训练，从未练习过从自身错误中恢复。 |
| Beam search | 更好的解码 | 每一步保留 top-k 个部分序列，而不是贪心地做出不可逆的选择。 |

## 延伸阅读

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) — seq2seq 的原始论文。仅四页。
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) — 提出了 GRU 以及编码器-解码器的框架。
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) — 注意力机制的论文。建议在学完本课后立即阅读。
- [PyTorch NLP from Scratch 教程](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) — 可运行的 seq2seq + 注意力机制代码。