# 序列到序列模型

> 两名RNN假装是翻译者. 他们遇到的瓶是人们的关注的原因.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 08 (CNNs + RNNs for Text), Phase 3 · 11 (PyTorch Intro)
**Time:** ~75 minutes

## 问题

类别将变量长度序列映射到单个标签上. 翻译将变量长度序列映射到另一个变量长度序列上. 输入和输出在不同的词汇库中,可能是不同的语言,没有保证长度平衡.

后2seq架构 (Sutskever,Vinyals,Le,2014) 用一个简单的食谱来解解开这个问题.两个RNN.一个读取源句子并产生一个固体尺寸的语境向量.另一个读取该向量并生成目标句子代币.同一个代码你为08课写的,粘合在一起以不同的方式.

首先,文本向量瓶是NLP中最具教学效益的失败.它激励了注意力和变压器擅长的一切.第二,培训配方 (教师强迫,计划采样,线束搜索在推断) 仍然适用于包括LLM在内的每个现代生成系统.

## 概念

**Encoder.**读取源句子的RNN. 它的最后隐藏状态是**context vector**总结整个输入的总结. 据说除了源头之外,没有什么丢失.

**Decoder.**另一个RNN从文本向量初始化.在每个步骤中,它将先前生成的代币作为输入,并产生目标词汇中的分布. 样本或 argmax来选择下一个代币. 输入它.重复直到一个`<EOS>`标志产生的或最大长度被击中.

**Training:**通过两个网络,通过时间进行标准的背后支持.

**Teacher forcing.**在训练过程中,解码器的输入步骤`t`是位置上的*真实地图*符号`t-1`没有它,早期错误会发生,模型永远不会学习.在推断时,你必须使用模型的预测,所以总是存在火车/推理分布差距.这个差距被称为**exposure bias**现在,我们要去.

**The bottleneck.**编码器学到关于源的所有信息都必须挤进一个文本向量中.长短句子会失去细节.罕见的词语会模糊.重排 (聊天黑与黑猫) 必须记忆,而不是计算.

注意力 (课 10) 通过让解码器查看 *每一个*编码器的隐藏状态,而不仅仅是最后一个.

```figure
lstm-gates
```

## 建立它

### 步骤1:编码器

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

`outputs`具有形状`[batch, seq_len, hidden_dim]`每一个输入位置一个隐藏状态.`hidden`具有形状`[1, batch, hidden_dim]`最后一步. 第08课说"分类输出".在这里我们将最后一个隐藏状态作为文本向量,并忽略每一步输出.

### 步骤 2: 解码器

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

输入:单个代币的批量和当前隐藏状态.输出:下一个代币和更新的隐藏状态的词汇记录.

### 步骤3:教师强迫的训练循环

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

两个值得命名的.`ignore_index=0`置代币的损失.`teacher_forcing_ratio`根据模型的预测,在每一步使用真符号的概率.从1.0开始 (完全强迫教师) 并在训练中降至0.5以缩小暴露偏差.

### 步骤4:推断循环 (贪)

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

贪的解码会在每一步都选择最有可能的代币. 它可以走开:一旦你承诺一个代币,**Beam search**保持了顶部...`k`部分序列活着,最后选择最高分的完整序列.

### 步骤5:瓶,已证明

训练模型做玩具复制任务:来源 `[a, b, c, d, e]`目标`[a, b, c, d, e]`增加序列长度,观察准确性.

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

单个GRU隐藏状态不能无损地记住40代码输入.信息在每个编码器步骤上都存在,但解码器只能看到最后一个状态.注意力直接解决这一问题.

## 用它

皮托奇已经`nn.Transformer`其他`nn.LSTM`基于"接着"的模板.`transformers`库运输了大量的代码器和解码器模型 (BART,T5, mBART,NLLB),

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

现代编码解码器将RNN用于变压器.高层形状 (编码器,解码器,生成代币-按代币) 与2014年 seq2seq纸相同.每个区块内部的机制是不同的.

### 什么时候还可以找到基于RNN的seq2seq

对于新项目来说,几乎从来没有.

- 流媒体翻译,其中你一次输入一个代币,
- 在设备上发送文字,变压器内存成本是极高的.
- 了解编码和解码瓶是最快的方法来了解变压器为什么赢了.

### 暴露偏见及其减轻

- **Scheduled sampling.**训练期间的教师强迫比率,使得模型学会从自己的错误中恢复.
- **Minimum risk training.**训练用语句级蓝色分数而不是代币级交叉,更接近你真正想要的.
- **Reinforcement learning fine-tuning.**奖励序列生成器用一个指标.

它们都适用于变压器发电.

## 运送它

保存如`outputs/prompt-seq2seq-design.md`其他:

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

## 运动

1. **Easy.**执行玩具复制任务. 训练一个GRU seq2seq在输出输入对等目标的源. 测量精度在长度 5, 10, 20. 复制瓶.
2. **Medium.**添加光束搜索解码. 3. 测量蓝色在一个小平行体上,以抵制贪. 光束搜索获胜的文件 (通常是最后的代币),并且它没有区别.
3. **Hard.**精细调节`facebook/bart-base`根据10k对对对法拉斯数据集,比较细调模型的光束-4输出与基本模型的持久输入.报告BLEU,选择10个质量例子.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder | Input RNN | Reads source. Produces per-step hidden states and a final context vector. |
| Decoder | Output RNN | Initialized from context vector. Generates target tokens one at a time. |
| Context vector | The summary | Final encoder hidden state. Fixed size. The bottleneck attention solves. |
| Teacher forcing | Use true tokens | Feed the ground-truth previous token at training time. Stabilizes learning. |
| Exposure bias | Train/test gap | Model trained on true tokens never practiced recovering from its own mistakes. |
| Beam search | Better decoding | Keep top-k partial sequences alive at each step instead of committing greedily. |

## 进一步阅读

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215)原始的"后二后二"纸.
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078)引入了GRU和编码器-解码器框架.
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)注意力论文. 课后立即阅读.
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html)可构建的seq2seq+注意码.
