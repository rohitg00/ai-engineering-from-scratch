# 序列到序列模型

> 两个 RNN 假装成一个翻译器。它们遇到的瓶颈正是 attention 存在的原因。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 08（用于文本的 CNN + RNN），阶段 3 · 11（PyTorch 入门）
**时间：** ~75 分钟

## 问题

分类将变长序列映射到单个标签。翻译将变长序列映射到另一个变长序列。输入和输出位于不同的词汇表中，可能是不同的语言，且长度不一定对等。

seq2seq 架构（Sutskever, Vinyals, Le, 2014）用一个故意简单的配方解决了这个问题。两个 RNN。一个读取源句子并生成固定大小的上下文向量。另一个读取该向量并逐个 token 生成目标句子。你在第 08 课写的同样代码，以不同的方式拼接在一起。

这值得学习有两个原因。第一，上下文向量瓶颈是 NLP 中最具教学价值的失败。它驱动了 attention 和 transformer 擅长的所有东西。第二，训练配方（teacher forcing、scheduled sampling、推理时的 beam search）仍然适用于每个现代生成系统，包括 LLM。

## 概念

**编码器（Encoder）。** 一个读取源句子的 RNN。其最终隐藏状态是**上下文向量**——整个输入的固定大小摘要。据说，源信息无一丢失。

**解码器（Decoder）。** 另一个 RNN，从上下文向量初始化。每一步它将之前生成的 token 作为输入，产生目标词汇表上的分布。采样或 argmax 来选择下一个 token。将其反馈回去。重复直到生成 `<EOS>` token 或达到最大长度。

**训练：** 每个解码器步骤的交叉熵损失，按序列求和。通过两个网络的标准时间反向传播。

**Teacher forcing。** 训练时，解码器在步骤 `t` 的输入是位置 `t-1` 的*真实* token，而不是解码器自己之前的预测。这稳定了训练；没有它，早期的错误会级联，模型永远学不会。推理时，你不得不使用模型自己的预测，所以总是存在训练/推理分布差距。这个差距称为**暴露偏差（exposure bias）**。

**瓶颈。** 编码器学到的关于源的所有信息必须被压缩到那一个上下文向量中。长句子丢失细节。罕见词变得模糊。重新排序（chat noir vs. black cat）必须被记忆，而不是计算。

Attention（第 10 课）通过让解码器查看*每个*编码器隐藏状态而不仅仅是最后一个来修复这个问题。这就是全部要点。

```figure
lstm-gates
```

## 开始构建

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

`outputs` 的形状为 `[batch, seq_len, hidden_dim]`——每个输入位置一个隐藏状态。`hidden` 的形状为 `[1, batch, hidden_dim]`——最后一步。第 08 课说"对输出进行池化以用于分类"。这里我们保留最后一个隐藏状态作为上下文向量，并忽略每步的输出。

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

解码器一次一步调用。输入：一批单个 token 和当前隐藏状态。输出：下一个 token 的词汇表 logits 和更新后的隐藏状态。

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

两个值得命名的调节参数。`ignore_index=0` 跳过填充 token 上的损失。`teacher_forcing_ratio` 是在每一步使用真实 token 与模型预测的概率。从 1.0（完全 teacher forcing）开始，在训练过程中退火到约 0.5，以缩小暴露偏差差距。

### 第 4 步：推理循环（贪婪）

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

贪婪解码每一步选取概率最高的 token。它可能走偏：一旦你 commit 到一个 token，你就不能撤回。**Beam search** 保持 top-`k` 部分序列存活，并在最后选取得分最高的完整序列。波束宽度 3-5 是标准做法。

### 第 5 步：瓶颈演示

在玩具复制任务上训练模型：源 `[a, b, c, d, e]`，目标 `[a, b, c, d, e]`。增加序列长度。观察准确率。

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

单个 GRU 隐藏状态无法无损记忆 40 个 token 的输入。信息在每个编码器步骤中都存在，但解码器只看到最后一个状态。Attention 直接修复了这个问题。

## 使用现成工具

PyTorch 有 `nn.Transformer` 和基于 `nn.LSTM` 的 seq2seq 模板。Hugging Face 的 `transformers` 库提供了在数十亿 tokens 上训练的完整编码器-解码器模型（BART、T5、mBART、NLLB）。

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

现代编码器-解码器用 transformer 替代了 RNN。高层形状（编码器、解码器、逐 token 生成）与 2014 年的 seq2seq 论文相同。每个块内部的机制不同。

### 何时仍然使用基于 RNN 的 seq2seq

对于新项目，几乎从不。特定例外：

- 流式翻译，你需要一次消费一个 token，具有有界内存。
- 设备端文本生成，transformer 的内存成本过高。
- 教学。理解编码器-解码器瓶颈是理解为什么 transformer 胜出的最快途径。

### 暴露偏差及其缓解措施

- **Scheduled sampling。** 在训练过程中退火 teacher forcing 比例，使模型学会从自己的错误中恢复。
- **Minimum risk training。** 在句子级 BLEU 分数上训练，而不是 token 级交叉熵。更接近你实际想要的。
- **强化学习微调。** 用一个指标奖励序列生成器。用于现代 LLM RLHF。

所有三种方法仍然适用于基于 transformer 的生成。

## 交付

保存为 `outputs/prompt-seq2seq-design.md`：

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

1. **简单。** 实现玩具复制任务。在输入-输出对（目标等于源）上训练 GRU seq2seq。在长度 5、10、20 上测量准确率。重现瓶颈。
2. **中等。** 添加波束宽度为 3 的 beam search 解码。在小型并行语料库上测量 BLEU 与贪婪解码的对比。记录 beam search 在何处胜出（通常是最后的 token）以及在何处没有区别。
3. **困难。** 在 10k 对释义数据集上微调 `facebook/bart-base`。比较微调模型的 beam-4 输出与基础模型在留出输入上的表现。报告 BLEU 并挑选 10 个定性示例。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| Encoder | 输入 RNN | 读取源。产生每步隐藏状态和最终上下文向量。 |
| Decoder | 输出 RNN | 从上下文向量初始化。逐次生成目标 token。 |
| Context vector | 摘要 | 编码器的最终隐藏状态。固定大小。Attention 解决的瓶颈。 |
| Teacher forcing | 使用真实 token | 训练时喂入真实的上一个 token。稳定学习。 |
| Exposure bias | 训练/测试差距 | 在真实 token 上训练的模型从未练习过从自己的错误中恢复。 |
| Beam search | 更好的解码 | 每一步保持前 k 个部分序列存活，而不是贪婪地提交。 |

## 延伸阅读

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) —— 原始 seq2seq 论文。四页。
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) —— 引入了 GRU 和编码器-解码器框架。
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) —— attention 论文。学完本课后立即阅读。
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) —— 可构建的 seq2seq + attention 代码。
