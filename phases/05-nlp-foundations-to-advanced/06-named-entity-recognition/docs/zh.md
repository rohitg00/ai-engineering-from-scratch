# 06 · 命名实体识别

> 把名称抽取出来。听起来很简单，直到你遇到模糊的边界、嵌套实体和领域行话。

**类型：** 实战
**语言：** Python
**前置：** 阶段 5 · 02（词袋 + TF-IDF）、阶段 5 · 03（词嵌入）
**时长：** 约 75 分钟

## 问题所在

"Apple sued Google over its iPhone search deal in the US."（苹果就其在美国的 iPhone 搜索协议起诉了谷歌。）这里有五个实体：Apple（ORG，机构）、Google（ORG）、iPhone（PRODUCT，产品）、search deal（也许算一个）、US（GPE，地缘政治实体）。一个优秀的「命名实体识别（Named Entity Recognition, NER）」系统会把它们全部抽取出来并标注正确的类型。一个糟糕的系统会漏掉 iPhone，把作为水果的 Apple 和作为公司的 Apple 混为一谈，还会把 "US" 标成 PERSON（人名）。

NER 是每一条结构化抽取流水线底层的主力军。简历解析、合规日志扫描、病历匿名化、搜索查询理解、聊天机器人响应的事实接地（grounding）、法律合同抽取，都离不开它。你几乎从未直接看到它，却始终依赖着它。

本课沿着经典路径（基于规则、HMM、CRF）一直走到现代路径（BiLSTM-CRF，再到 Transformer）。每一步都解决了前一步的某个具体局限。这种演进模式本身就是本课的重点。

## 核心概念

**BIO 标注**（或 BILOU）把实体抽取转化为一个序列标注问题。为每个词元（token）打上 `B-TYPE`（实体的开头）、`I-TYPE`（实体的内部）或 `O`（不属于任何实体）的标签。

```
Apple    B-ORG
sued     O
Google   B-ORG
over     O
its      O
iPhone   B-PRODUCT
search   O
deal     O
in       O
the      O
US       B-GPE
.        O
```

多词元实体通过链式标注表示：`New B-GPE`、`York I-GPE`、`City I-GPE`。一个理解 BIO 的模型能够抽取任意跨度（span）的实体。

架构演进路线：

- **基于规则。** 正则表达式 + 词典（gazetteer）查找。对已知实体精度很高，对新实体则毫无覆盖能力。
- **HMM。** 「隐马尔可夫模型（Hidden Markov Model, HMM）」。建模给定标签下词元的发射概率，以及标签到标签的转移概率，用维特比（Viterbi）算法解码，在标注数据上训练。
- **CRF。** 「条件随机场（Conditional Random Field, CRF）」。类似 HMM 但属于判别式模型，因此你可以混入任意特征（词形、大小写、相邻词）。在 2026 年，对于低资源部署，它仍然是经典的生产主力。
- **BiLSTM-CRF。** 用神经网络特征取代手工特征。LSTM 双向读取句子，顶部的 CRF 层强制保证标签序列的一致性。
- **基于 Transformer。** 在 BERT 上微调一个词元分类（token-classification）头。精度最佳，算力消耗最大。

## 动手构建

### 第 1 步：BIO 标注辅助函数

```python
def spans_to_bio(tokens, spans):
    labels = ["O"] * len(tokens)
    for start, end, label in spans:
        labels[start] = f"B-{label}"
        for i in range(start + 1, end):
            labels[i] = f"I-{label}"
    return labels


def bio_to_spans(tokens, labels):
    spans = []
    current = None
    for i, label in enumerate(labels):
        if label.startswith("B-"):
            if current:
                spans.append(current)
            current = (i, i + 1, label[2:])
        elif label.startswith("I-") and current and current[2] == label[2:]:
            current = (current[0], i + 1, current[2])
        else:
            if current:
                spans.append(current)
                current = None
    if current:
        spans.append(current)
    return spans
```

```python
>>> tokens = ["Apple", "sued", "Google", "over", "iPhone", "sales", "."]
>>> labels = ["B-ORG", "O", "B-ORG", "O", "B-PRODUCT", "O", "O"]
>>> bio_to_spans(tokens, labels)
[(0, 1, 'ORG'), (2, 3, 'ORG'), (4, 5, 'PRODUCT')]
```

### 第 2 步：手工特征

对于经典（非神经网络）NER，特征就是胜负关键。一些有用的特征：

```python
def token_features(token, prev_token, next_token):
    return {
        "lower": token.lower(),
        "is_upper": token.isupper(),
        "is_title": token.istitle(),
        "has_digit": any(c.isdigit() for c in token),
        "suffix_3": token[-3:].lower(),
        "shape": word_shape(token),
        "prev_lower": prev_token.lower() if prev_token else "<BOS>",
        "next_lower": next_token.lower() if next_token else "<EOS>",
    }


def word_shape(word):
    out = []
    for c in word:
        if c.isupper():
            out.append("X")
        elif c.islower():
            out.append("x")
        elif c.isdigit():
            out.append("d")
        else:
            out.append(c)
    return "".join(out)
```

`word_shape("iPhone")` 返回 `xXxxxx`。`word_shape("USA-2024")` 返回 `XXX-dddd`。大小写模式对于专有名词是高信号特征。

### 第 3 步：一个简单的基于规则 + 词典的基线

```python
ORG_GAZETTEER = {"Apple", "Google", "Microsoft", "OpenAI", "Meta", "Amazon", "Netflix"}
GPE_GAZETTEER = {"US", "USA", "UK", "India", "Germany", "France"}
PRODUCT_GAZETTEER = {"iPhone", "Android", "Windows", "ChatGPT", "Claude"}


def rule_based_ner(tokens):
    labels = []
    for token in tokens:
        if token in ORG_GAZETTEER:
            labels.append("B-ORG")
        elif token in GPE_GAZETTEER:
            labels.append("B-GPE")
        elif token in PRODUCT_GAZETTEER:
            labels.append("B-PRODUCT")
        else:
            labels.append("O")
    return labels
```

生产级词典动辄有数百万条目，是从维基百科和 DBpedia 抓取来的。覆盖率不错，但消歧（`Apple` 是公司还是水果）能力极差。这正是统计模型最终胜出的原因。

### 第 4 步：CRF 步骤（仅勾勒思路，非完整实现）

在没有概率论基础铺垫的情况下，用 50 行代码从零实现完整的 CRF 并不能带来什么启发。这里改用 `sklearn-crfsuite`：

```python
import sklearn_crfsuite

def to_features(tokens):
    out = []
    for i, tok in enumerate(tokens):
        prev = tokens[i - 1] if i > 0 else ""
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        out.append({
            "word.lower()": tok.lower(),
            "word.isupper()": tok.isupper(),
            "word.istitle()": tok.istitle(),
            "word.isdigit()": tok.isdigit(),
            "word.suffix3": tok[-3:].lower(),
            "word.shape": word_shape(tok),
            "prev.word.lower()": prev.lower(),
            "next.word.lower()": nxt.lower(),
            "BOS": i == 0,
            "EOS": i == len(tokens) - 1,
        })
    return out


crf = sklearn_crfsuite.CRF(algorithm="lbfgs", c1=0.1, c2=0.1, max_iterations=100, all_possible_transitions=True)
X_train = [to_features(s) for s in sentences_tokenized]
crf.fit(X_train, bio_labels_train)
```

`c1` 和 `c2` 分别是 L1 和 L2 正则化系数。`all_possible_transitions=True` 让模型能够学到某些非法序列（例如 `O` 之后接 `I-ORG`）是不太可能出现的——CRF 正是借此在你无需手写约束的情况下强制保证 BIO 一致性。

### 第 5 步：BiLSTM-CRF 增加了什么

特征变为可学习的。输入：词元嵌入（GloVe 或 fastText）。LSTM 从左到右、再从右到左读取。拼接后的隐藏状态送入一个 CRF 输出层。CRF 仍然负责强制保证标签序列的一致性；LSTM 则用学习到的特征取代了手工特征。

```python
import torch
import torch.nn as nn


class BiLSTM_CRF_Head(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_labels):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(hidden_dim * 2, n_labels)

    def forward(self, token_ids):
        e = self.embed(token_ids)
        h, _ = self.lstm(e)
        emissions = self.fc(h)
        return emissions
```

CRF 层可使用 `torchcrf.CRF`（pip install pytorch-crf）。相比手工特征的 CRF，它带来的提升是可量化的，但比你预期的要小——除非你拥有数以万计的标注句子。

## 实战应用

spaCy 开箱即提供生产级的 NER。

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("Apple sued Google over its iPhone search deal in the US.")
for ent in doc.ents:
    print(f"{ent.text:20s} {ent.label_}")
```

```
Apple                ORG
Google               ORG
iPhone               ORG
US                   GPE
```

注意 `iPhone` 被标成了 `ORG` 而非 `PRODUCT`——spaCy 的小模型对产品类实体的覆盖能力较弱。大模型（`en_core_web_lg`）会做得更好，Transformer 模型（`en_core_web_trf`）则更胜一筹。

用 Hugging Face 做基于 BERT 的 NER：

```python
from transformers import pipeline

ner = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
print(ner("Apple sued Google over its iPhone in the US."))
```

```
[{'entity_group': 'ORG', 'word': 'Apple', ...},
 {'entity_group': 'ORG', 'word': 'Google', ...},
 {'entity_group': 'MISC', 'word': 'iPhone', ...},
 {'entity_group': 'LOC', 'word': 'US', ...}]
```

`aggregation_strategy="simple"` 会把连续的 B-X、I-X 词元合并成一个跨度。如果不用它，你拿到的就是词元级别的标签，需要自己去合并。

### 基于 LLM 的 NER（2026 年的选项）

零样本（zero-shot）和少样本（few-shot）的 LLM NER 如今在许多领域已能与微调模型一较高下，而在标注数据稀缺时表现要好得多。

- **零样本提示。** 给 LLM 一份实体类型列表和一个示例 schema，要求其输出 JSON。开箱即用；在新颖领域上精度中等。
- **ZeroTuneBio 风格的提示。** 把任务拆解为「候选抽取 → 含义解释 → 判断 → 复核」。一个多阶段提示（而非一次性提示）能在生物医学 NER 上大幅提升精度。同样的模式也适用于法律、金融和科学领域。
- **结合 RAG 的动态提示。** 在每次推理调用时，从一个小规模标注种子集中检索出最相似的标注示例，即时构建少样本提示。在 2026 年的基准测试中，相比静态提示，这能把 GPT-4 在生物医学 NER 上的 F1 提升 11-12%。
- **按实体类型逐项拆解。** 对于长文档，一次性抽取所有实体类型的单次调用会随文档长度增长而损失召回率。改为每种实体类型各跑一遍抽取。推理成本更高，但精度显著提升。这是处理临床记录和法律合同的标准做法。

截至 2026 年的生产建议：在收集训练数据之前，先用 LLM 零样本基线起步。很多时候它的 F1 已经足够好，以至于你从头到尾都不需要微调。

### 经典 NER 仍能取胜的场景

即便有了 LLM，经典 NER 在以下情况仍占上风：

- 延迟预算低于 50ms。
- 你有数千个标注样本，且需要达到 98%+ 的 F1。
- 领域具有稳定的本体（ontology），预训练的 CRF 或 BiLSTM 能很好地迁移过来。
- 监管约束要求使用本地部署、非生成式的模型。

### 它会失灵的场景

- **领域漂移（domain shift）。** 在 CoNLL 上训练的 NER 用于法律合同时，表现还不如一个词典。请在你自己的领域上微调。
- **嵌套实体。** "Bank of America Tower"（美国银行大厦）同时既是 ORG 又是 FACILITY（设施）。标准 BIO 无法表示重叠的跨度。你需要嵌套 NER（多遍扫描或基于跨度的模型）。
- **超长实体。** "United States Federal Deposit Insurance Corporation"（美国联邦存款保险公司）。词元级别的模型有时会把它切开。请使用 `aggregation_strategy` 或做后处理。
- **稀疏类型。** 医学 NER 标签如 DRUG_BRAND（药品品牌）、ADVERSE_EVENT（不良事件）、DOSE（剂量）。通用模型对此一无所知。Scispacy 和 BioBERT 是这方面的起点。

## 交付产物

保存为 `outputs/skill-ner-picker.md`：

```markdown
---
name: ner-picker
description: Pick the right NER approach for a given extraction task.
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

Given a task description (domain, label set, language, latency, data volume), output:

1. Approach. Rule-based + gazetteer, CRF, BiLSTM-CRF, or transformer fine-tune.
2. Starting model. Name it (spaCy model ID, Hugging Face checkpoint ID, or "custom, trained from scratch").
3. Labeling strategy. BIO, BILOU, or span-based. Justify in one sentence.
4. Evaluation. Use `seqeval`. Always report entity-level F1 (not token-level).

Refuse to recommend fine-tuning a transformer for under 500 labeled examples unless the user already has a pretrained domain model. Flag nested entities as needing span-based or multi-pass models. Require a gazetteer audit if the user mentions "production scale" and labels are unchanged from CoNLL-2003.
```

## 练习

1. **简单。** 实现 `bio_to_spans`（`spans_to_bio` 的逆操作），并在 10 个句子上验证往返（round-trip）一致性。
2. **中等。** 在 CoNLL-2003 英文 NER 数据集上训练上面的 sklearn-crfsuite CRF。用 `seqeval` 报告各实体的 F1。典型结果：约 84 F1。
3. **困难。** 在某个领域专属的 NER 数据集（医学、法律或金融）上微调 `distilbert-base-cased`。与 spaCy 小模型做对比。记录数据泄漏（data leakage）检查过程，并写下令你意外的发现。

## 关键术语

| 术语 | 人们常说 | 它实际的含义 |
|------|-----------------|-----------------------|
| NER | 抽取名称 | 用类型（PERSON、ORG、GPE、DATE……）标注词元跨度。 |
| BIO | 标注方案 | `B-X` 开始，`I-X` 延续，`O` 在实体之外。 |
| BILOU | 更好的 BIO | 增加 `L-X`（末尾）、`U-X`（单词元实体），让边界更清晰。 |
| CRF | 结构化分类器 | 建模标签之间的转移，而不仅是发射概率。强制保证合法序列。 |
| 嵌套 NER | 重叠的实体 | 一个跨度与它的某个子跨度属于不同的实体。BIO 无法表达这种情况。 |
| 实体级 F1 | 正确的 NER 指标 | 预测的跨度必须与真实跨度完全匹配。词元级 F1 会高估准确率。 |

## 延伸阅读

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) —— BiLSTM-CRF 那篇论文。经典之作。
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) —— 提出了后来成为标准的词元分类范式。
- [spaCy 语言学特征 —— 命名实体](https://spacy.io/usage/linguistic-features#named-entities) —— `Doc.ents` 和 `Span` 上每个属性的实用参考。
- [seqeval](https://github.com/chakki-works/seqeval) —— 正确的指标库。请始终使用它。
