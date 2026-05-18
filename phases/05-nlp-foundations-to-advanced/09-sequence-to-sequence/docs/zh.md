# Sequence-to-Sequence Models

> 两个RNN假装是翻译。他们遇到的瓶颈是引起关注的原因。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 08（CNN + RNN for Text）、阶段3 · 11（PyTorch简介）
** 时间：** ~75分钟

## The Problem

分类将变长序列映射到单个标签。翻译将变长序列映射到另一个变长序列。输入和输出存在于不同的词汇表中，可能存在不同的语言，并且不能保证长度对等。

seq 2seq架构（Sutskever，Vinyals，Le，2014）通过一个故意简单的食谱破解了这一点。两个RNN。读取源句子并生成固定大小的上下文载体。另一个读取该载体并逐个标记生成目标句子标记。与您为第08课编写的相同代码，但以不同的方式粘合在一起。

这值得研究，原因有两个。首先，上下文载体瓶颈是NLP中最有用的教学失败。它激发了所有关注和变形金刚所擅长的事情。其次，训练配方（教师强制、计划抽样、推理时的射束搜索）仍然适用于包括LLM在内的每个现代一代系统。

## The Concept

![Encoder-decoder with context vector bottleneck](./assets/seq2seq.svg)

** 编码器 **一个RNN，读取源句子。它的最终隐藏状态是 ** 上下文向量 ** -整个输入的固定大小摘要。只会失去消息来源。

** 解码器。**另一个RNN从上下文载体初始化。在每一步，它都会将之前生成的标记作为输入，并在目标词汇表上生成分布。样本或argmax来选择下一个令牌。把它反馈回去。重复上述步骤，直到产生“<EOS>”令牌或达到最大长度。

** 训练：** 每个解码器步骤的交叉熵损失，在序列上相加。通过两个网络的时间标准反向推进。

** 老师强迫。**在训练期间，解码器在步骤“t”的输入是位置“t-1”处的 * 地面真值 * 令牌，而不是解码器自己的先前预测。这可以稳定训练;如果没有它，早期错误就会发生，模型永远不会学习。在推理时，您必须使用模型自己的预测，因此始终存在训练/推理分布差距。这个差距称为 ** 暴露偏差 **。

** 瓶颈。**编码器了解到的有关源的一切都必须被压缩到该上下文载体中。长句失去细节。罕见的单词会变得模糊。重新排序（黑色聊天与黑猫）必须记住，而不是计算。

注意（第10课）通过让解码器查看 * 每个 * 编码器隐藏状态（而不仅仅是最后一个）来解决这个问题。这就是整个球场。

## Build It

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

'输出'具有形状'[batch，seq_len，hidden_dim]'-每个输入位置一个隐藏状态。“hidden”具有形状“[1，batch，hidden_dim]'-最后一步。第08课说“汇集输出进行分类。“在这里，我们保留最后一个隐藏状态作为上下文载体，并忽略每步的输出。

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

解码器一步一步地被称为。输入：一批单个令牌和当前隐藏状态。输出：下一个令牌和更新的隐藏状态的词汇表日志。

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

两个值得命名的旋钮。`ignore_index=0`跳过填充标记的丢失。`teacher_forcing_ratio`是在每一步使用真实令牌与模型预测的概率。从1.0开始（完全教师强制），并在训练中退火到~0.5，以缩小确定性-偏差差距。

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

贪婪解码在每一步都会选择最高概率的令牌。它可以四处游荡：一旦您承诺了一个代币，您就无法取消它。**Beam search** 会保持顶部的-' k '部分序列的活跃状态，并在最后选择得分最高的完整序列。标准梁宽3-5。

### Step 5: the bottleneck, demonstrated

在玩具复制任务中训练模型：源“[a，b，c，d，e]”，目标“[a，b，c，d，e]”。增加序列长度。观察准确性。

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

单个GRU隐藏状态无法丢失地记住40个令牌的输入。信息存在于每个编码器步骤，但解码器只看到最后一个状态。注意力直接解决了这个问题。

## Use It

PyTorch有基于`nn.Transformer`和`nn.LSTM`的seq 2seq模板。Hugging Face的“Transformers”库提供了在数十亿个代币上训练的完整编码器-解码器模型（BART、T5、mBART、NLLB）。

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

现代编码器-解码器放弃了变压器的RNN。高级形状（编码器、解码器、generate-token-by-token）与2014年seq 2 seq论文相同。每个区块内部的机制是不同的。

### When to still reach for RNN-based seq2seq

对于新项目来说，几乎从来没有。具体例外情况：

- 流式翻译，您在有限内存的情况下一次消费输入一个令牌。
- Transformer内存成本过高的设备上文本生成。
- 教育学了解编码器-解码器瓶颈是了解Transformers为何获胜的最快途径。

### Exposure bias and its mitigations

- ** 计划抽样。**在培训期间调整教师强迫率，以便模型学会从自己的错误中恢复过来。
- ** 最低风险培训。**根据企业级别的BLEU分数而不是代币级别的交叉信息进行训练。更接近您实际想要的。
- ** 强化学习微调。**用指标奖励序列生成器。用于现代LLM RL HF。

这三者仍然适用于基于变压器的发电。

## Ship It

另存为“输出/prompt-seq2seq-design.md”：

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

## Exercises

1. ** 简单。**实施玩具复制任务。在目标等于源的输入输出对上训练GRU seq 2 seq。测量长度5、10、20处的准确度。重现瓶颈。
2. ** 中等。**添加射束宽度为3的射束搜索解码。在一个小型平行文集上针对贪婪测量BLEU。记录射束搜索获胜的地方（通常是最后的令牌）以及它没有区别的地方。
3. ** 很难。**在10 k对的重述数据集上微调“Facebook/bart-base”。将微调模型的beam-4输出与基本模型的保持输入进行比较。报告BLEU并选择10个定性示例。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 编码器 | 输入RNN | 阅读来源。生成每一步隐藏状态和最终的上下文载体。 |
| 解码器 | 输出RNN | 从上下文载体初始化。一次生成一个目标代币。 |
| 上下文向量 | 摘要 | 最终编码器隐藏状态。固定尺寸。瓶颈注意力解决。 |
| 老师强迫 | 使用真实代币 | 在训练时喂食先前的基础真相代币。稳定学习。 |
| 暴露偏倚 | 训练/测试间隙 | 在真实代币上训练的模型从未练习过从自己的错误中恢复过来。 |
| 波束搜索 | 更好的解码 | 在每一步都保持前k部分序列的活跃性，而不是贪婪地提交。 |

## Further Reading

- [Sutskever，Vinyals，Le（2014）.使用神经网络进行序列到序列学习]（https：//arxiv.org/ab/1409.3215）-原始的seq 2seq论文。四页。
- [Cho等人（2014）。使用RNN编码器-解码器进行统计机器翻译学习短语表示]（https：//arxiv.org/ab/1406.1078）-介绍了GRU和编码器-解码器框架。
- [BahDanau、Cho、Bengio（2014）。联合学习对齐和翻译的神经机器翻译]（https：//arxiv.org/ab/1409.0473）-关注论文。本课结束后立即阅读。
- [Scratch教程中的PyTorch NLP]（https：//pytorch.org/tutorials/intermediate/seq2seq_accounttion_tutorial.html）-可构建的seq 2seq+注意代码。
