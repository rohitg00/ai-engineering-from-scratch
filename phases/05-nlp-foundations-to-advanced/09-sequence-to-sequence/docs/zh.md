# 09 · 序列到序列模型

> 两个 RNN 假装自己是一名翻译。它们撞上的瓶颈，正是注意力机制存在的理由。

**类型：** 实践构建
**语言：** Python
**前置：** 第 5 阶段 · 08（用于文本的 CNN 与 RNN）、第 3 阶段 · 11（PyTorch 入门）
**时长：** 约 75 分钟

## 问题所在

分类任务把变长序列映射为单个标签。翻译任务则把变长序列映射为另一个变长序列。输入与输出处于不同的词表中，可能属于不同的语言，而且无法保证两者长度相等。

序列到序列（seq2seq）架构（Sutskever、Vinyals、Le，2014）用一套刻意保持简单的方案攻克了这个问题。两个 RNN。一个读取源句子并产出一个固定大小的上下文向量（context vector），另一个读取这个向量并逐个 token 地生成目标句子。和你在第 08 课写的代码完全一样，只是拼接方式不同。

它值得研究有两个原因。第一，上下文向量瓶颈是 NLP 中在教学意义上最有价值的失败案例。它解释了注意力机制和 Transformer 之所以擅长的一切。第二，它的训练方案（「教师强制（teacher forcing）」、「计划采样（scheduled sampling）」、推理时的「束搜索（beam search）」）至今仍适用于包括大语言模型（LLM）在内的每一个现代生成系统。

## 核心概念

**编码器（Encoder）。** 一个读取源句子的 RNN。它的最终隐藏状态就是**上下文向量（context vector）**——对整个输入的固定大小摘要。理论上，除了源句子本身，它什么都没丢失。

**解码器（Decoder）。** 另一个 RNN，用上下文向量进行初始化。在每一步，它以上一步生成的 token 作为输入，产出一个在目标词表上的概率分布。通过采样或取 argmax 选出下一个 token，再把它喂回去，如此重复，直到产出 `<EOS>` token 或达到最大长度为止。

**训练：** 在每个解码器步骤上计算交叉熵损失，再在整个序列上求和。在两个网络上做标准的「随时间反向传播（backprop through time）」。

**教师强制（teacher forcing）。** 训练时，解码器在第 `t` 步的输入是位置 `t-1` 处的*真实（ground-truth）* token，而非解码器自己上一步的预测。这能稳定训练；没有它，早期的错误会层层累积，模型永远学不会。而在推理时，你只能使用模型自己的预测，因此训练与推理之间始终存在一个分布差距。这个差距被称为**暴露偏差（exposure bias）**。

**瓶颈所在。** 编码器关于源句子学到的一切，都必须被压缩进那一个上下文向量里。长句会丢失细节，罕见词会被模糊处理，而词序调整（chat noir 与 black cat）只能靠死记硬背，而非计算得来。

注意力机制（第 10 课）直接解决了这个问题：它让解码器能查看*每一个*编码器隐藏状态，而不只是最后一个。这就是它全部的卖点。

## 动手构建

### 第 1 步：一个编码器

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

`outputs` 的形状为 `[batch, seq_len, hidden_dim]`——每个输入位置对应一个隐藏状态。`hidden` 的形状为 `[1, batch, hidden_dim]`——即最后一步的状态。第 08 课说过「对 outputs 做池化以用于分类」。这里我们把最后的隐藏状态保留为上下文向量，并忽略逐步的 outputs。

### 第 2 步：一个解码器

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

解码器每次只被调用一步。输入：一批单个 token 以及当前隐藏状态。输出：下一个 token 的词表 logits 以及更新后的隐藏状态。

### 第 3 步：带教师强制的训练循环

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

有两个旋钮值得点名。`ignore_index=0` 会跳过对填充 token（padding token）的损失计算。`teacher_forcing_ratio` 是每一步使用真实 token 而非模型预测的概率。从 1.0（完全教师强制）开始，在训练过程中逐步退火（anneal）降到约 0.5，以缩小暴露偏差的差距。

### 第 4 步：推理循环（贪心）

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

贪心解码（greedy decoding）在每一步都挑选概率最高的 token。它可能会跑偏：一旦你认定了某个 token，就无法收回这句话。**束搜索（beam search）**会同时保留得分最高的 `k` 个部分序列，并在最后挑出得分最高的那个完整序列。束宽（beam width）取 3-5 是常见做法。

### 第 5 步：瓶颈，实测演示

在一个玩具复制任务上训练模型：源为 `[a, b, c, d, e]`，目标为 `[a, b, c, d, e]`。逐步增加序列长度，观察准确率。

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

单个 GRU 隐藏状态无法无损地记住一个 40-token 的输入。这些信息其实存在于每一个编码器步骤中，但解码器只能看到最后一个状态。注意力机制直接解决了这个问题。

## 上手使用

PyTorch 提供了基于 `nn.Transformer` 和 `nn.LSTM` 的 seq2seq 模板。Hugging Face 的 `transformers` 库则直接提供了在数十亿 token 上训练好的完整编码器-解码器模型（BART、T5、mBART、NLLB）。

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

现代的编码器-解码器已经抛弃了 RNN，转而采用 Transformer。其高层结构（编码器、解码器、逐 token 生成）与 2014 年的 seq2seq 论文完全一致，但每个模块内部的机制截然不同。

### 何时仍应选用基于 RNN 的 seq2seq

对于新项目来说，几乎从不。具体的例外有：

- 流式翻译（streaming translation），即在内存受限的情况下逐个 token 地消费输入。
- 端侧（on-device）文本生成，此时 Transformer 的内存开销过高、难以承受。
- 教学。理解编码器-解码器瓶颈，是理解 Transformer 为何获胜的最快路径。

### 暴露偏差及其缓解手段

- **计划采样（scheduled sampling）。** 在训练过程中对教师强制比例做退火，让模型学会从自己的错误中恢复。
- **最小风险训练（minimum risk training）。** 用句子级别的 BLEU 分数代替 token 级别的交叉熵进行训练。这更贴近你真正想要的目标。
- **强化学习微调（reinforcement learning fine-tuning）。** 用某个指标作为奖励来训练序列生成器。现代 LLM 的 RLHF 中就用到了它。

这三者都同样适用于基于 Transformer 的生成。

## 交付落地

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

1. **简单。** 实现玩具复制任务。在目标等于源的「输入-输出」对上训练一个 GRU seq2seq。测量长度为 5、10、20 时的准确率。复现这个瓶颈。
2. **中等。** 加入束宽为 3 的束搜索解码。在一个小型平行语料库上测量 BLEU，并与贪心解码对比。记录束搜索在哪里取胜（通常是末尾的 token），又在哪里毫无差别。
3. **困难。** 在一个含 1 万对样本的复述（paraphrase）数据集上微调 `facebook/bart-base`。在留出（held-out）输入上，将微调后模型的 beam-4 输出与基础模型进行对比。报告 BLEU，并挑选 10 个定性示例。

## 关键术语

| 术语 | 人们口中的说法 | 它实际的含义 |
|------|-----------------|-----------------------|
| 编码器（Encoder） | 输入 RNN | 读取源句子。产出逐步的隐藏状态和一个最终的上下文向量。 |
| 解码器（Decoder） | 输出 RNN | 用上下文向量初始化。一次生成一个目标 token。 |
| 上下文向量（Context vector） | 那份摘要 | 编码器的最终隐藏状态。固定大小。也是注意力机制要解决的瓶颈。 |
| 教师强制（Teacher forcing） | 使用真实 token | 训练时喂入真实的上一个 token。稳定学习过程。 |
| 暴露偏差（Exposure bias） | 训练/测试差距 | 在真实 token 上训练的模型从未练习过如何从自己的错误中恢复。 |
| 束搜索（Beam search） | 更好的解码 | 在每一步保留得分最高的 k 个部分序列，而非贪心地一锤定音。 |

## 延伸阅读

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) —— seq2seq 的原始论文。四页。
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) —— 引入了 GRU 以及编码器-解码器的框架。
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) —— 注意力机制的论文。读完本课后请立即阅读。
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) —— 可动手构建的 seq2seq + 注意力代码。
