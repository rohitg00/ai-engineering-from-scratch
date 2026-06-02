# 命名实体识别（Named Entity Recognition）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 把名字抽出来。听上去简单，直到你撞上模糊边界、嵌套实体和领域黑话。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word Embeddings)
**Time:** ~75 minutes

## 问题（The Problem）

"Apple sued Google over its iPhone search deal in the US." 这句里有五个实体：Apple（ORG）、Google（ORG）、iPhone（PRODUCT）、search deal（也许算）、US（GPE）。一个好的 NER 系统能把它们全抽出来并打对类型；糟糕的系统会漏掉 iPhone，把水果 Apple 和公司 Apple 搞混，还把 "US" 标成 PERSON。

NER 是所有结构化抽取流水线（pipeline）下面的主力。简历解析、合规日志扫描、病历脱敏、搜索 query 理解、聊天机器人答复的 grounding、法律合同抽取……你几乎从不直接看到它，却处处依赖它。

本课沿着经典路线（基于规则、HMM、CRF）走进现代路线（BiLSTM-CRF，再到 transformer）。每一步都在解决前一步的某个具体局限。这条演化路径本身就是这节课要传达的东西。

## 概念（The Concept）

**BIO tagging**（或 BILOU）把实体抽取转成序列标注问题。给每个 token 打上 `B-TYPE`（实体起始）、`I-TYPE`（实体内部）或 `O`（不属于任何实体）。

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

多 token 实体会串起来：`New B-GPE`、`York I-GPE`、`City I-GPE`。一个能理解 BIO 的模型就能抽取任意 span。

架构演进：

- **基于规则（Rule-based）。** 正则 + 词典（gazetteer）查表。已知实体的精度（precision）很高，新实体的覆盖（coverage）为零。
- **HMM。** 隐马尔可夫模型（Hidden Markov Model）。给定标签的 token 发射概率，加上标签到标签的转移概率。Viterbi 解码。在标注数据上训练。
- **CRF。** 条件随机场（Conditional Random Field）。和 HMM 类似但属于判别式模型，因此可以混入任意特征（词形、大小写、相邻词）。直到 2026 年，在低资源部署里它仍是经典的生产主力。
- **BiLSTM-CRF。** 用学到的神经特征替代手工特征。LSTM 双向读句子，顶上叠一个 CRF 层来强制标签序列一致。
- **Transformer-based。** 给 BERT 加一个 token-classification 头做微调。精度最高，算力消耗也最大。

## 动手实现（Build It）

### Step 1: BIO tagging helpers

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

### Step 2: hand-crafted features

对经典（非神经）NER 来说，特征就是一切。常用的有：

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

`word_shape("iPhone")` 返回 `xXxxxx`，`word_shape("USA-2024")` 返回 `XXX-dddd`。大小写模式对识别专有名词信号极强。

### Step 3: a simple rule-based + dictionary baseline

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

生产级 gazetteer 通常有几百万条，是从 Wikipedia 和 DBpedia 爬来的。覆盖率不错，但消歧（公司 `Apple` 还是水果 `Apple`）非常糟糕。这就是为什么统计模型最终胜出。

### Step 4: the CRF step (sketch, not full impl)

不到 50 行代码从头实现完整 CRF——在没有概率论基础的前提下并不能带来什么启发。直接用 `sklearn-crfsuite`：

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

`c1` 和 `c2` 分别是 L1、L2 正则化项。`all_possible_transitions=True` 让模型自己学到非法序列（例如 `O` 后面接 `I-ORG`）的概率应该很低——CRF 就是这样在你不写约束的情况下保证 BIO 一致性的。

### Step 5: what a BiLSTM-CRF adds

特征变成学出来的。输入是 token embedding（GloVe 或 fastText）。LSTM 同时从左到右、从右到左读，把拼接后的 hidden state 送进一个 CRF 输出层。CRF 仍然负责强制标签序列的一致性，LSTM 则把手工特征替换成学习到的特征。

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

CRF 层用 `torchcrf.CRF`（pip install pytorch-crf）。相比手工特征 CRF，提升能测出来，但除非你有几万条标注句子，否则收益小于你的预期。

## 用起来（Use It）

spaCy 自带生产级 NER，开箱即用。

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

注意 `iPhone` 被标成了 `ORG` 而不是 `PRODUCT`——spaCy 的小模型对 product 类型实体覆盖较弱。大模型（`en_core_web_lg`）会好一些，transformer 模型（`en_core_web_trf`）更好。

基于 BERT 的 NER 走 Hugging Face：

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

`aggregation_strategy="simple"` 会把连续的 B-X、I-X token 合并成一个 span。不加它就只能拿到 token 级标签，要自己去合。

### 基于 LLM 的 NER（2026 年的新选项）

如今 zero-shot 和 few-shot 的 LLM NER，在很多领域已经能与微调模型分庭抗礼，而在标注数据稀缺时远远更强。

- **Zero-shot prompting。** 把实体类型列表和一个示例 schema 喂给 LLM，让它返回 JSON。开箱即用；在新领域上准确率中等。
- **ZeroTuneBio 风格的 prompting。** 把任务拆解为：候选抽取 → 含义解释 → 判定 → 复核。这种多阶段（不是 one-shot）的 prompt 在生物医学 NER 上能显著提升准确率，同样的模式在法律、金融、科学领域都成立。
- **配合 RAG 的 dynamic prompting。** 每次推理（inference）时，从一个小规模标注种子集中检索最相似的标注示例，现场组装 few-shot prompt。在 2026 年的 benchmark 上，这能把 GPT-4 在生物医学 NER 上的 F1 比静态 prompting 提升 11–12%。
- **按实体类型拆解。** 长文档里，一次调用就抽所有类型实体的做法会随文档长度增加而召回（recall）下滑。改成每种实体类型跑一遍。推理成本变高，但精度大幅提升。这是临床记录和法律合同的标准做法。

2026 年的生产建议：在收集训练数据之前，先用 LLM 跑一个 zero-shot 基线（baseline）。很多时候 F1 已经够用，根本不需要去微调。

### 经典 NER 仍然胜出的场景

即便有 LLM 可用，经典 NER 在以下场景依然占优：

- 延迟预算低于 50ms。
- 你已有上千条标注样本，并且需要 98%+ 的 F1。
- 领域有稳定的本体（ontology），预训练好的 CRF 或 BiLSTM 能很好迁移。
- 监管要求本地部署、不能用生成式模型。

### 翻车的地方

- **领域漂移（Domain shift）。** 在 CoNLL 上训练的 NER 拿去跑法律合同，效果还不如 gazetteer。请在你的领域上微调。
- **嵌套实体（Nested entities）。** "Bank of America Tower" 既是 ORG 又是 FACILITY。标准 BIO 表达不了重叠 span。需要嵌套 NER（多遍扫描或基于 span 的模型）。
- **超长实体。** "United States Federal Deposit Insurance Corporation"。token 级模型有时候会把它切碎。用 `aggregation_strategy` 或后处理来合并。
- **稀疏类型。** 医学 NER 标签如 DRUG_BRAND、ADVERSE_EVENT、DOSE，通用模型完全不认识。Scispacy 和 BioBERT 是这类场景的起点。

## 上线部署（Ship It）

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

## 练习（Exercises）

1. **Easy。** 实现 `bio_to_spans`（`spans_to_bio` 的逆运算），并在 10 句话上验证往返一致性。
2. **Medium。** 在 CoNLL-2003 英文 NER 数据集上训练上面的 sklearn-crfsuite CRF。用 `seqeval` 报告每类实体的 F1。典型结果：~84 F1。
3. **Hard。** 在某个领域 NER 数据集（医疗、法律或金融）上微调 `distilbert-base-cased`。和 spaCy 小模型做对比。记录数据泄露检查过程，并写下哪些点出乎你意料。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NER | 抽取名字 | 给 token span 打类型标签（PERSON、ORG、GPE、DATE …）。 |
| BIO | 标注方案 | `B-X` 起始、`I-X` 延续、`O` 不属于任何实体。 |
| BILOU | 升级版 BIO | 增加 `L-X`（last）和 `U-X`（unit），让边界更干净。 |
| CRF | 结构化分类器 | 不仅建模发射概率，还建模标签间的转移概率，强制有效序列。 |
| Nested NER | 重叠实体 | 一个 span 整体是一个实体，其内部子 span 又是另一个实体。BIO 表达不了。 |
| Entity-level F1 | 正确的 NER 指标 | 预测 span 必须和真值 span 完全匹配。token-level F1 会高估精度。 |

## 延伸阅读（Further Reading）

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) — BiLSTM-CRF 那篇论文。经典必读。
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) — 引入了后来成为标准的 token-classification 范式。
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities) — `Doc.ents` 和 `Span` 上每个属性的实用参考。
- [seqeval](https://github.com/chakki-works/seqeval) — 正确的指标库。永远用它。
