# 序列到序列模型（Sequence-to-Sequence Models）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 两个 RNN 假装自己是翻译器。它们撞上的瓶颈，正是 attention（注意力）存在的理由。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 08 (CNNs + RNNs for Text), Phase 3 · 11 (PyTorch Intro)
**Time:** ~75 minutes

## 问题（The Problem）

分类任务把变长序列映射成单个标签。翻译任务则把变长序列映射成另一段变长序列。输入和输出处在不同的词表里，可能是不同语言，长度也无法保证一致。

seq2seq 架构（Sutskever, Vinyals, Le, 2014）用一个刻意做得很简单的方案破解了这个问题。两个 RNN。一个读源句子，产出一个固定长度的 context vector（上下文向量）。另一个读这个向量，逐 token 生成目标句子。代码就是你在第 08 课写过的那套，只不过粘合方式不同。

值得花时间研究它，有两个理由。第一，context vector 的瓶颈是 NLP 里教学价值最高的失败案例。它解释了为什么 attention 和 transformer 擅长那些事。第二，它的训练配方（teacher forcing、scheduled sampling、推理时的 beam search）至今仍适用于每一个现代生成系统，包括 LLM。

## 概念（The Concept）

**Encoder。** 一个读源句子的 RNN。它的最终隐藏状态就是 **context vector** —— 整段输入的固定大小摘要。号称除了源句子本身什么都没丢。

**Decoder。** 另一个 RNN，用 context vector 来初始化。每一步把上一步生成的 token 作为输入，输出目标词表上的一个分布。采样或取 argmax 选下一个 token，再把它喂回去。重复直到生成 `<EOS>` 或达到最大长度。

**训练：** 在 decoder 每一步算 cross-entropy 损失，沿序列求和。两个网络都做标准的 BPTT（沿时间反向传播）。

**Teacher forcing。** 训练时，decoder 在第 `t` 步的输入是位置 `t-1` 的 *真实* token，而不是 decoder 自己上一步的预测。这样训练会更稳；不这么做的话，早期的错误会层层放大，模型根本学不会。推理时你只能用模型自己的预测，所以训练和推理之间永远存在一个分布差。这个差被称为 **exposure bias**（暴露偏差）。

**瓶颈。** encoder 学到的关于源句子的所有东西，都得被压进那一个 context vector。长句子会丢细节。生僻词会被糊掉。词序变化（chat noir vs. black cat）只能死记硬背，没法靠计算还原。

Attention（第 10 课）直接修掉了这个问题：让 decoder 看 *每一个* encoder 隐藏状态，而不仅仅是最后那个。整个卖点就这一句话。

## 动手实现（Build It）

### Step 1: an encoder

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

`outputs` 形状是 `[batch, seq_len, hidden_dim]` —— 每个输入位置一个隐藏状态。`hidden` 形状是 `[1, batch, hidden_dim]` —— 最后一步的状态。第 08 课说"分类时把 outputs 做 pooling"。这里我们保留最后一个 hidden 作为 context vector，忽略每一步的 outputs。

### Step 2: a decoder

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

decoder 每次只走一步。输入是一个 batch 的单 token 加上当前隐藏状态。输出是下一个 token 在词表上的 logits 以及更新后的隐藏状态。

### Step 3: training loop with teacher forcing

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

两个旋钮值得点名。`ignore_index=0` 让损失忽略 padding token。`teacher_forcing_ratio` 是每一步使用真值 token 而非模型预测的概率。从 1.0（完全 teacher forcing）开始，训练过程中退火到 ~0.5，以缩小 exposure bias 的差距。

### Step 4: inference loop (greedy)

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

greedy 解码每步都挑概率最高的那个 token。它会跑偏：一旦你确定了某个 token，就再也收不回来。**Beam search** 在每一步保留 top-`k` 条候选序列，最后选总分最高的完整序列。beam width 取 3-5 是常规配置。

### Step 5: the bottleneck, demonstrated

在玩具 copy 任务上训练模型：源序列 `[a, b, c, d, e]`，目标 `[a, b, c, d, e]`。逐步加长序列，观察准确率。

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

单个 GRU 隐藏状态没法无损地记住一个 40 token 的输入。信息在 encoder 的每一步其实都还在，但 decoder 只看得到最后那个状态。attention 直接修掉这一点。

## 用起来（Use It）

PyTorch 提供了 `nn.Transformer` 以及基于 `nn.LSTM` 的 seq2seq 模板。Hugging Face 的 `transformers` 库直接给你训练好（用了几十亿 token）的完整 encoder-decoder 模型（BART、T5、mBART、NLLB）。

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

现代 encoder-decoder 已经把 RNN 换成了 transformer。整体形态（encoder、decoder、逐 token 生成）跟 2014 年那篇 seq2seq 论文完全一样。每个 block 内部的机制不同而已。

### 什么时候还会用 RNN-based seq2seq（When to still reach for RNN-based seq2seq）

新项目里几乎没有。具体例外：

- 流式翻译：以有限内存逐 token 消费输入。
- 端侧文本生成：transformer 的内存开销太高用不起。
- 教学。理解 encoder-decoder 的瓶颈是理解 transformer 为何胜出最快的路径。

### Exposure bias 及其缓解（Exposure bias and its mitigations）

- **Scheduled sampling。** 训练时退火 teacher forcing ratio，让模型学会从自己的错误里回血。
- **Minimum risk training。** 用句子级 BLEU 分数训练，而非 token 级 cross-entropy。更贴近你真正想要的目标。
- **强化学习微调。** 用某个指标作为序列生成器的 reward。现代 LLM RLHF 用的就是这一招。

这三种做法在基于 transformer 的生成里依然适用。

## 上线部署（Ship It）

存为 `outputs/prompt-seq2seq-design.md`：

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

## 练习（Exercises）

1. **Easy。** 实现玩具 copy 任务。在目标等于源的输入-输出对上训练一个 GRU seq2seq。在长度 5、10、20 处测准确率。复现这个瓶颈。
2. **Medium。** 加入 beam width 3 的 beam search 解码。在一个小的平行语料上测 BLEU，与 greedy 对比。记下 beam search 在哪里赢（通常是末尾几个 token），又在哪里没差别。
3. **Hard。** 用一个 1 万对的 paraphrase 数据集微调 `facebook/bart-base`。在留出输入上比较微调模型的 beam-4 输出与 base 模型的输出。报告 BLEU，并挑 10 个定性例子。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder | 输入 RNN | 读源句子。产出每步的隐藏状态以及一个最终 context vector。 |
| Decoder | 输出 RNN | 用 context vector 初始化。每次生成一个目标 token。 |
| Context vector | 摘要 | encoder 的最终隐藏状态。固定大小。attention 要解决的就是它带来的瓶颈。 |
| Teacher forcing | 用真值 token | 训练时把上一步的真值 token 喂进去。让训练更稳。 |
| Exposure bias | 训/测差距 | 模型只在真值 token 上训练过，从没练过怎么从自己的错误里恢复。 |
| Beam search | 更好的解码 | 每步保留 top-k 条候选序列，而不是贪婪地一锤定音。 |

## 延伸阅读（Further Reading）

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) —— seq2seq 原始论文。四页。
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) —— 引入 GRU 以及 encoder-decoder 框架。
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) —— attention 论文。读完本课立刻读它。
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) —— 可直接构建的 seq2seq + attention 代码。
