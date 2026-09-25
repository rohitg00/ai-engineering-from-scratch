# 命名实体识别

> 把名字抽出来。听起来简单，直到你要面对模糊的边界、嵌套实体和领域术语。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF)，Phase 5 · 03 (Word Embeddings)
**Time:** 约 75 分钟

## 问题

"Apple sued Google over its iPhone search deal in the US." 这句话包含五个实体：Apple（ORG）、Google（ORG）、iPhone（PRODUCT）、search deal（可能）、US（GPE）。一个好的 NER 系统能以正确的类型把它们全部抽取出来。一个差的系统会漏掉 iPhone，把苹果公司混淆成水果 Apple，并把 "US" 标为 PERSON。

NER 是所有结构化抽取管道背后的主力。简历解析、合规日志扫描、病历匿名化、搜索查询理解、聊天机器人响应的接地、法律合同抽取。你几乎从不直接看到它，却总是依赖它。

本课沿着经典路径（基于规则、HMM、CRF）走向现代路径（BiLSTM-CRF，再到 Transformer）。每一步都解决了前一步的某个具体局限。这个模式本身就是本课的精髓。

## 概念

**BIO 标注**（或 BILOU）把实体抽取转化为序列标注问题。给每个 token 标注 `B-TYPE`（实体开始）、`I-TYPE`（实体内部）或 `O`（不在任何实体内）。

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

多 token 实体串联：`New B-GPE`、`York I-GPE`、`City I-GPE`。一个理解 BIO 的模型可以抽取任意跨度的片段。

架构演进：

- **基于规则。** 正则表达式 + 词典查找。对已知实体精度高，对新实体覆盖率为零。
- **HMM。** 隐马尔可夫模型。给定标签时 token 的发射概率、标签间的转移概率。用 Viterbi 解码。需要标注数据训练。
- **CRF。** 条件随机场。类似 HMM 但属于判别式模型，因此可以混合任意特征（词形、大小写、相邻词）。到 2026 年，它仍然是低资源部署场景下的经典生产主力。
- **BiLSTM-CRF。** 用神经网络学到的特征取代手工特征。LSTM 从两个方向读句子，顶部的 CRF 层保证标签序列的一致性。
- **基于 Transformer。** 用 token 分类头微调 BERT。准确率最高，算力消耗最大。

```figure
ner-bio-tagging
```

## 动手实现

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

对于经典（非神经）NER，特征就是一切。有用的特征：

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

`word_shape("iPhone")` 返回 `xXxxxx`。`word_shape("USA-2024")` 返回 `XXX-dddd`。大小写模式对专有名词是高信息量信号。

### 第 3 步：简单的规则 + 词典基线

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

生产级词典包含数百万条从 Wikipedia 和 DBpedia 抓取的词条。覆盖不错，但消歧（`Apple` 是公司还是水果）非常糟糕。这就是统计模型胜出的原因。

### 第 4 步：CRF 步骤（概览，非完整实现）

在缺乏概率论基础的情况下，用 50 行代码从零实现完整 CRF 并没有启发意义。改用 `sklearn-crfsuite`：

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

`c1` 和 `c2` 分别是 L1 和 L2 正则化。`all_possible_transitions=True` 允许模型学会非法序列（例如 `O` 之后的 `I-ORG`）不太可能出现——这正是 CRF 在无需你手写约束的情况下保证 BIO 一致性的方式。

### 第 5 步：BiLSTM-CRF 增加了什么

特征变成了学出来的。输入：token 嵌入（GloVe 或 fastText）。LSTM 从左到右和从右到左各读一遍。拼接后的隐藏状态经过 CRF 输出层。CRF 仍然保证标签序列的一致性；LSTM 用学习到的特征取代了手工特征。

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

对于 CRF 层，使用 `torchcrf.CRF`（pip install pytorch-crf）。相比手工特征 CRF 的提升是可测的，但除非你有数万条标注句子，否则比预期的要小。

## 使用它

spaCy 开箱即带生产级 NER。

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

注意 `iPhone` 被标为 `ORG` 而不是 `PRODUCT` —— spaCy 的小模型对产品实体的覆盖较弱。大模型（`en_core_web_lg`）表现更好。Transformer 模型（`en_core_web_trf`）还要更好。

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

`aggregation_strategy="simple"` 把连续的 B-X、I-X token 合并为一个跨度。没有它，你只能得到 token 级标签，还得自己合并。

### 基于 LLM 的 NER（2026 年的选项）

零样本和少样本 LLM NER 在许多领域已能与微调模型抗衡，在标注数据稀缺时更是显著占优。

- **零样本提示。** 给 LLM 一份实体类型列表和一个示例 schema，要求输出 JSON。开箱即用；在陌生领域上准确率中等。
- **ZeroTuneBio 式提示。** 把任务分解为候选抽取 → 含义解释 → 判断 → 复查。一个多阶段提示（而非一次性提示）能在生物医学 NER 上大幅提升准确率。同样的模式适用于法律、金融和科学领域。
- **结合 RAG 的动态提示。** 每次推理调用时，从一个小的标注种子集中检索最相似的标注样本；即时构建少样本提示。在 2026 年的基准测试中，相比静态提示，这使 GPT-4 生物医学 NER 的 F1 提升了 11-12%。
- **按实体类型分解。** 对于长文档，单次调用抽取所有实体类型的召回率会随长度增长而下降。每种实体类型单独跑一次抽取。推理成本更高，但准确率显著更高。这是临床笔记和法律合同的标准模式。

2026 年的生产建议：在收集训练数据之前，先跑一个 LLM 零样本基线。通常 F1 已经足够好，你根本不需要微调。

### 经典 NER 仍然占优的场景

即使 LLM 可用，经典 NER 在以下情况下仍然占优：

- 延迟预算在 50ms 以内。
- 你有数千条标注样本，需要 98% 以上的 F1。
- 领域有稳定的本体，预训练 CRF 或 BiLSTM 迁移效果好。
- 监管约束要求本地部署的非生成式模型。

### 它在哪里失效

- **领域漂移。** 在 CoNLL 上训练的 NER 用于法律合同时，表现还不如一个词典。要在你的领域上微调。
- **嵌套实体。** "Bank of America Tower" 同时是 ORG 和 FACILITY。标准 BIO 无法表示重叠跨度。你需要嵌套 NER（多轮或基于跨度的模型）。
- **长实体。** "United States Federal Deposit Insurance Corporation"。token 级模型有时会把它切开。使用 `aggregation_strategy` 或后处理。
- **稀疏类型。** 医学 NER 的标签如 DRUG_BRAND、ADVERSE_EVENT、DOSE。通用模型对此一无所知。Scispacy 和 BioBERT 是该领域的起点。

## 发布它

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

1. **简单。** 实现 `bio_to_spans`（`spans_to_bio` 的逆操作），并在 10 个句子上验证往返一致性。
2. **中等。** 在 CoNLL-2003 英文 NER 数据集上训练上面的 sklearn-crfsuite CRF。使用 `seqeval` 报告各实体类型的 F1。典型结果：约 84 F1。
3. **困难。** 在一个特定领域的 NER 数据集（医学、法律或金融）上微调 `distilbert-base-cased`。与 spaCy 小模型比较。记录数据泄漏检查，并写下让你惊讶的地方。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| NER | 抽取名字 | 给 token 跨度标注类型（PERSON、ORG、GPE、DATE 等）。 |
| BIO | 标注方案 | `B-X` 表示开始，`I-X` 表示延续，`O` 表示实体之外。 |
| BILOU | 更好的 BIO | 增加 `L-X`（最后一个）和 `U-X`（单元），使边界更清晰。 |
| CRF | 结构化分类器 | 建模标签之间的转移，而不仅仅是发射。保证合法序列。 |
| Nested NER | 重叠实体 | 某个跨度与其子跨度是不同的实体。BIO 无法表达这一点。 |
| Entity-level F1 | 真正的 NER 指标 | 预测跨度必须与真实跨度完全一致。token 级 F1 会高估准确率。 |

## 延伸阅读

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) —— BiLSTM-CRF 论文。经典之作。
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) —— 引入了后来成为标准的 token 分类模式。
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities) —— 关于 `Doc.ents` 和 `Span` 所有属性的实用参考。
- [seqeval](https://github.com/chakki-works/seqeval) —— 正确的指标库。请始终使用它。