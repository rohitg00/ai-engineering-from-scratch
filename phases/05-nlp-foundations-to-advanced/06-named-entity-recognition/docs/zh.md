# 命名实体识别

> 提取名称。听起来简单，但当你面对模糊边界、嵌套实体和领域术语时，就变得棘手了。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 02（词袋模型（BoW）+ TF-IDF），阶段 5 · 03（词嵌入（Word Embeddings））
**时间：** 约 75 分钟

## 问题

"Apple sued Google over its iPhone search deal in the US." 五个实体：Apple (ORG)、Google (ORG)、iPhone (PRODUCT)、search deal (可能)、US (GPE)。一个好的NER系统能提取所有实体并识别正确类型。糟糕的系统则会遗漏 iPhone，将作为水果的 Apple 与作为公司的 Apple 混淆，并将 "US" 标记为人物（PERSON）。

NER 是每个结构化抽取管线的核心工作单元。简历解析、合规日志扫描、病历匿名化、搜索查询理解、聊天机器人响应的知识锚定、法律合同提取。你几乎看不到它，但始终依赖它。

本课程沿着经典路线（基于规则、隐马尔可夫模型（HMM）、条件随机场（CRF））走向现代路线（双向长短期记忆网络-条件随机场（BiLSTM-CRF），然后 Transformer）。每一步都解决了上一步的特定限制。模式本身就是一课。

## 概念

**BIO 标注**（或 BILOU）将实体抽取转化为序列标注问题。用 `B-TYPE`（实体开始）、`I-TYPE`（实体内部）或 `O`（外部）标记每个词元。

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

多词元实体链成：`New B-GPE`，`York I-GPE`，`City I-GPE`。理解 BIO 的模型能提取任意跨度。

架构演进：

- **基于规则。** 正则表达式 + 词典查找。对已知实体精度高，对新实体零覆盖。
- **隐马尔可夫模型（HMM）。** 隐马尔可夫模型。给定标签的词元发射概率，标签到标签的转移概率。维特比解码。在标注数据上训练。
- **条件随机场（CRF）。** 条件随机场。与 HMM 类似但为判别式，因此可混合任意特征（词形、大小写、相邻词）。在 2026 年对于低资源部署仍是经典的工业工作主力。
- **双向长短期记忆网络-条件随机场（BiLSTM-CRF）。** 神经网络特征取代手工特征。LSTM 双向读取句子，上层 CRF 层确保标签序列一致性。
- **基于 Transformer。** 用词元分类头微调 BERT。精度最高，计算量最大。

## 构建

### 步骤 1：BIO 标注辅助函数

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

### 步骤 2：手工特征

对于经典（非神经网络）NER，特征就是一切。有用的特征：

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

`word_shape("iPhone")` 返回 `xXxxxx`。`word_shape("USA-2024")` 返回 `XXX-dddd`。大小写模式对于专有名词是强信号。

### 步骤 3：简单的基于规则+词典基线

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

生产环境的词典有数百万条目，从维基百科和DBpedia抓取。覆盖度好。歧义消解（`Apple` 公司 vs 水果）则很糟糕。这就是统计模型胜出的原因。

### 步骤 4：CRF 步骤（草图，非完整实现）

在没有概率论基础的情况下，从零实现完整 CRF 的 50 行代码并无启发性。改用 `sklearn-crfsuite`：

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

`c1` 和 `c2` 是 L1 和 L2 正则化。`all_possible_transitions=True` 让模型学会非法序列（例如 `O` 之后出现 `I-ORG`）的可能性很低，这就是 CRF 在无需手动编写约束的情况下强制执行 BIO 一致性的方式。

### 步骤 5：BiLSTM-CRF 增加了什么

特征变成学习得到的。输入：词元嵌入（GloVe 或 fastText）。LSTM 从左到右和从右到左读取。拼接后的隐藏状态送入 CRF 输出层。CRF 仍然强制标签序列一致性；LSTM 用学习后的特征取代了手工特征。

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

对于 CRF 层，使用 `torchcrf.CRF`（安装命令：pip install pytorch-crf）。与手工 CRF 相比，增益是可测量的，但除非你有数万条标注句子，否则该增益比你预期的要小。

## 使用

spaCy 开箱即用地提供了生产级 NER。

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

注意 `iPhone` 被标记为 `ORG` 而非 `PRODUCT`——spaCy 的小型模型产品实体覆盖较弱。大型模型（`en_core_web_lg`）表现更好。Transformer 模型（`en_core_web_trf`）则更优。

Hugging Face 的基于 BERT 的 NER：

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

`aggregation_strategy="simple"` 将连续的 B-X、I-X 词元合并为一个跨度。不使用它时，你会得到词元级标签，需要自行合并。

### 基于 LLM 的 NER（2026 年选项）

零样本和少样本 LLM NER 如今在许多领域已与微调模型竞争激烈，并且在标注数据稀缺时表现显著更好。

- **零样本提示。** 给 LLM 一组实体类型和一个示例模式。要求输出 JSON。开箱即用；在新颖领域上精度中等。
- **ZeroTuneBio 式提示。** 将任务分解为候选提取 → 含义解释 → 判断 → 再检查。多阶段提示（非一次性）大幅提升了生物医学 NER 的精度。同样的模式适用于法律、金融和科学领域。
- **结合检索增强生成（RAG）的动态提示。** 对于每次推理调用，从少量标注种子集中检索最相似的标签示例；动态构建少样本提示。在 2026 年的基准测试中，这使 GPT-4 的生物医学 NER F1 值比静态提示提升了 11-12%。
- **按实体类型分解。** 对于长文档，一次性提取所有实体类型的单次调用会随着长度增加而降低召回率。对每种实体类型分别运行一次提取。推理成本更高，但精度显著提高。这是临床笔记和法律合同的标准模式。

截至 2026 年的生产建议：在收集训练数据之前，先以 LLM 零样本基线开始。通常 F1 已经足够好，以至于你永远不需要微调。

### 经典 NER 仍在哪些场景胜出

即使有 LLM，经典 NER 在以下场景仍占优：

- 延迟预算低于 50 毫秒。
- 你有数千个标注示例，且需要 98%+ 的 F1。
- 领域具有稳定的本体，预训练的 CRF 或 BiLSTM 能够很好地迁移。
- 监管要求使用本地、非生成式模型。

### 它在哪里失效

- **领域偏移。** 在 CoNLL 上训练的 NER 用于法律合同时效果比词典还差。请在您的领域上微调。
- **嵌套实体。** "Bank of America Tower" 同时是 ORG 和 FACILITY。标准 BIO 无法表示重叠跨度。你需要嵌套 NER（多遍或基于跨度的模型）。
- **长实体。** "United States Federal Deposit Insurance Corporation." 词元级模型有时会将其拆分。使用 `aggregation_strategy` 或后处理。
- **稀疏类型。** 医学 NER 标签如 DRUG_BRAND、ADVERSE_EVENT、DOSE。通用模型对此一无所知。Scispacy 和 BioBERT 是那里的起点。

## 交付

保存为 `outputs/skill-ner-picker.md`：

```markdown
---
name: ner-picker
description: 为给定的提取任务选择正确的NER方法。
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

给定任务描述（领域、标签集、语言、延迟、数据量），输出：

1. 方法。基于规则 + 词典、CRF、BiLSTM-CRF 或 Transformer 微调。
2. 起始模型。命名它（spaCy 模型 ID、Hugging Face 检查点 ID，或“自定义，从头训练”）。
3. 标注策略。BIO、BILOU 或基于跨度。用一句话说明理由。
4. 评估。使用 `seqeval`。始终报告实体级 F1（而非词元级）。

如果标注示例少于 500 条，且用户尚未拥有预训练领域模型，则拒绝推荐微调 Transformer。如果存在嵌套实体，标记为需要基于跨度或多遍模型。如果用户提到“生产规模”且标签与 CoNLL-2003 相同，则要求进行词典审计。
```

## 练习

1. **简单。** 实现 `bio_to_spans`（`spans_to_bio` 的逆函数）并在 10 个句子上验证往返一致性。
2. **中等。** 在 CoNLL-2003 英文 NER 数据集上训练上述 sklearn-crfsuite CRF。使用 `seqeval` 报告每个实体的 F1。典型结果：约 84 F1。
3. **困难。** 在特定领域 NER 数据集（医学、法律或金融）上微调 `distilbert-base-cased`。与 spaCy 小型模型比较。记录数据泄漏检查，并写下令你惊讶的内容。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| NER | 提取名称 | 用类型（人物（PERSON）、组织（ORG）、地域政治实体（GPE）、日期（DATE）等）标记词元跨度。 |
| BIO | 标注方案 | `B-X` 开始，`I-X` 继续，`O` 外部。 |
| BILOU | 改进的 BIO | 增加了 `L-X`（最后），`U-X`（单元）以获得更清晰的边界。 |
| CRF | 结构化分类器 | 对标签间的转移进行建模，而不仅仅是发射。强制有效序列。 |
| 嵌套 NER | 重叠实体 | 一个跨度与它的子跨度是不同的实体。BIO 无法表达这一点。 |
| 实体级 F1 | 正确的 NER 指标 | 预测跨度必须与真实跨度完全匹配。词元级 F1 夸大了准确性。 |

## 延伸阅读

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) —