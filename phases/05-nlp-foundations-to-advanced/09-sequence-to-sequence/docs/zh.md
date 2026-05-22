# 序列到序列模型

> 两个RNN假装自己是翻译器。它们遇到的瓶颈正是注意力机制存在的原因。

**类型：** 构建  
**语言：** Python  
**前置知识：** 第五阶段·第08课（用于文本的CNN+RNN）、第三阶段·第11课（PyTorch入门）  
**时长：** 约75分钟  

## 问题

分类任务将可变长度序列映射到一个标签。翻译任务将可变长度序列映射到另一个可变长度序列。输入和输出处于不同的词汇表中，可能是不同的语言，并且长度没有保证对等。

序列到序列架构（Sequence-to-Sequence Architecture, seq2seq）（Sutskever, Vinyals, Le, 2014）用一种故意简单的配方解决了这个问题。两个RNN。一个读取源句子并生成固定大小的上下文向量（Context Vector）。另一个读取该向量并逐token生成目标句子。与你在第08课中编写的代码相同，只是以不同的方式粘合在一起。

值得研究这个架构有两个原因。首先，上下文向量瓶颈是NLP中最具教学意义的失败案例。它激发了注意力机制和Transformer擅长的所有事情。其次，训练配方（教师强制（Teacher Forcing）、计划采样（Scheduled Sampling）、推理时的束搜索（Beam Search））仍然适用于包括LLM在内的所有现代生成系统。

## 概念

**编码器（Encoder）。** 一个读取源句子的RNN。其最终隐藏状态就是**上下文向量**——整个输入的固定大小的摘要。按理说不会丢失任何源信息。

**解码器（Decoder）。** 另一个由上下文向量初始化的RNN。每一步将先前生成的token作为输入，并输出目标词汇表上的概率分布。使用采样或argmax来选择下一个token。将其反馈回去。重复直到生成`<EOS>` token或达到最大长度。

**训练：** 每个解码器步骤的交叉熵损失，沿着序列求和。通过两个网络进行标准的随时间反向传播（Backpropagation Through Time, BPTT）。

**教师强制（Teacher Forcing）。** 在训练期间，解码器在时间步`t`的输入是位置`t-1`的*真实* token，而不是解码器自己的先前预测。这稳定了训练；如果没有它，早期的错误会级联，模型永远学不会。在推理时，必须使用模型自己的预测，因此总是存在训练/推理分布差距。这个差距称为**曝光偏差（Exposure Bias）**。

**瓶颈。** 编码器关于源句子学到的所有信息都必须被压缩到那个单一的上下文向量中。长句子会丢失细节。不常见的单词会被模糊化。重排序（chat noir vs. black cat）必须被记忆，而不是计算出来。

注意力机制（第10课）通过允许解码器查看*每一个*编码器隐藏状态（而不仅仅是最后一个）来修复这个问题。这就是全部要点。

## 构建它

### 第一步：编码器

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

`outputs`的形状是`[batch, seq_len, hidden_dim]`——每个输入位置对应一个隐藏状态。`hidden`的形状是`[1, batch, hidden_dim]`——最后一步。第08课说过“池化outputs用于分类”。这里我们保留最后的隐藏状态作为上下文向量，并忽略每个时间步的outputs。

### 第二步：解码器

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

解码器一次调用一步。输入：一批单个token和当前隐藏状态。输出：下一个token的词汇表logits以及更新后的隐藏状态。

### 第三步：带教师强制的训练循环

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

两个值得命名的旋钮。`ignore_index=0`跳过填充token上的损失。`teacher_forcing_ratio`是在每一步使用真实token与模型预测的概率。从1.0（完全教师强制）开始，并随着训练退火到约0.5，以缩小曝光偏差差距。

### 第四步：推理循环（贪心解码）

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

贪心解码（Greedy Decoding）每一步选择概率最高的token。它可能会偏离：一旦你commit到一个token，就无法收回。**束搜索（Beam Search）** 保持top-`k`部分序列存活，并在最后选择得分最高的完整序列。束宽3-5是标准配置。

### 第五步：展示瓶颈

在一个玩具复制任务上训练模型：源`[a, b, c, d, e]`，目标`[a, b, c, d, e]`。增加序列长度。观察准确率。

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

一个单一的GRU隐藏状态无法无损地记忆40个token的输入。信息存在于每个编码器步骤中，但解码器只看到最后一个状态。注意力机制直接修复了这个问题。

## 使用它

PyTorch提供了基于`nn.Transformer`和`nn.LSTM`的seq2seq模板。Hugging Face的`transformers`库提供了完整的编码器-解码器模型（BART、T5、mBART、NLLB），这些模型在数十亿token上进行了训练。

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

现代编码器-解码器已经将RNN替换为Transformer。高级形状（编码器、解码器、逐token生成）与2014年的seq2seq论文相同。每个模块内部的机制不同。

### 什么时候仍然使用基于RNN的seq2seq

对于新项目，几乎从不。特定例外情况：

- 流式翻译，你需要一次处理一个token且内存有界。
- 设备端文本生成，Transformer内存成本过高。
- 教学。理解编码器-解码器瓶颈是理解为什么Transformer获胜的最快路径。

### 曝光偏差及其缓解方法

- **计划采样（Scheduled Sampling）**：在训练期间退火教师强制比率，使模型学会从自己的错误中恢复。
- **最小风险训练（Minimum Risk Training）**：在句子级别的BLEU分数上进行训练，而不是token级别的交叉熵。更接近你实际想要的。
- **强化学习微调（Reinforcement Learning Fine-tuning）**：用一个指标奖励序列生成器。用于现代LLM的RLHF。

所有三种方法仍然适用于基于Transformer的生成。

## 交付它

保存为`outputs/prompt-seq2seq-design.md`：

```markdown
---
name: seq2seq-design
description: 为给定任务设计一个序列到序列管道。
phase: 5
lesson: 09
---

给定一个任务（翻译、摘要、释义、问题改写），输出：

1. 架构。默认使用预训练Transformer编码器-解码器（BART、T5、mBART、NLLB）。仅在有特定约束时使用基于RNN的seq2seq。
2. 起始检查点。命名它（`facebook/bart-base`、`google/flan-t5-base`、`facebook/nllb-200-distilled-600M`）。将检查点与任务和语言覆盖范围匹配。
3. 解码策略。确定性输出使用贪心解码，质量优先使用束搜索（宽度4-5），多样性使用带温度的采样。一句话理由。
4. 在交付前验证一个失败模式。曝光偏差表现为较长输出上的生成漂移；在90%分位长度上采样20个输出并目测。

拒绝建议在少于一百万个平行样本的情况下从头训练seq2seq。将任何对面向用户的内容使用贪心解码的管道标记为脆弱（贪心会重复和循环）。
```

## 练习

1. **简单。** 实现玩具复制任务。在输入-输出对（目标等于源）上训练一个GRU seq2seq。测量长度5、10、20时的准确率。复现瓶颈。
2. **中等。** 添加束宽为3的束搜索解码。在一个小的平行语料库上与贪心解码对比测量BLEU。记录束搜索获胜的地方（通常是最后几个token）和它没有区别的地方。
3. **困难。** 在10k对释义数据集上微调`facebook/bart-base`。对比微调模型与基础模型在保留输入上的束搜索（束宽4）输出。报告BLEU并挑选10个定性示例。

## 关键术语

| 术语 | 人们所说的 | 实际含义 |
|------|-----------------|-----------------------|
| 编码器（Encoder） | 输入RNN | 读取源。生成每个时间步的隐藏状态和一个最终上下文向量。 |
| 解码器（Decoder） | 输出RNN | 从上下文向量初始化。一次生成一个目标token。 |
| 上下文向量（Context vector） | 摘要 | 编码器最终隐藏状态。固定大小。注意力机制解决的瓶颈。 |
| 教师强制（Teacher forcing） | 使用真实token | 训练时馈送真实的前一个token。稳定学习。 |
| 曝光偏差（Exposure bias） | 训练/测试差距 | 模型在真实token上训练，从未练习从自己的错误中恢复。 |
| 束搜索（Beam search） | 更好的解码 | 每一步保持top-k部分序列存活，而不是贪心commit。 |

## 延伸阅读

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) — 原始seq2seq论文。四页。
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) — 引入了GRU和编码器-解码器框架。
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) — 注意力机制论文。在你学习完本课后立即阅读。
- [PyTorch NLP from Scratch 教程](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) — 可构建的seq2seq + 注意力代码。