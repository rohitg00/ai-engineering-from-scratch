# Named Entity Recognition

> 把名字拉出来。听起来很容易，直到您处理模糊的边界、嵌套实体和领域行话。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 02（BoW + TF-IDF）、阶段5 · 03（文字嵌入）
** 时间：** ~75分钟

## The Problem

“苹果就其在美国的iPhone搜索交易起诉谷歌。“五个实体：苹果（ORG）、谷歌（ORG）、iPhone（GROUP）、搜索协议（可能）、美国（GPE）。一个好的NER系统会以正确的类型提取所有它们。坏的人错过了iPhone，将苹果的水果与苹果的公司混为一谈，并将“美国”标记为一个人。

NER是每个结构化提取管道下面的主力。简历解析、合规日志扫描、医疗记录匿名化、搜索查询理解、聊天机器人响应基础、法律合同提取。你永远看不到它;你总是依赖它。

本课将经典路径（基于规则、Markov、CF）带入现代路径（BiLSTM-CF，然后是变形者）。每一步都解决了前一步的特定限制。模式就是教训。

## The Concept

![NER tagging: BIO schema + CRF+BiLSTM pipeline](./assets/ner.svg)

** BOP标记 **（或BILOU）将实体提取变成了序列标签问题。用“B-TYLL”（实体的开头）、“I-TYLL”（实体内部）或“O”（任何实体外部）标记每个令牌。

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

多代币实体链：“New B-GPE”、“York I-GPE”、“City I-GPE”。理解BOP的模型可以提取任意跨度。

建筑进步：

- ** 基于规则。** Regex +地名录查找。对已知实体的高精度，对新实体的零覆盖。
- ** 嗯。**隐马尔科夫模型。代币给定标签的发射概率，标签到标签的转移概率。维特比解码。接受过标签数据培训。
- ** 病例报告。**条件随机场。与Markov相似，但具有区分性，因此您可以混合任意特征（词形、大写、邻近词）。仍然是2026年低资源部署的经典生产主力。
- ** BiLSTM-CF。**神经功能而不是手工制作。LSTM双向读取句子，顶部的RF层强制执行一致的标签序列。
- ** 基于变形者。**带有代币分类头的BERT微调。最佳准确性。大多数计算。

## Build It

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

对于经典（非神经）NER来说，功能就是游戏。有用的：

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

' word_shape（' iPhone '）返回' xXxxxx '。' word_shape（' USA-2024 '）'返回' XXX-dddd '。大写模式对于专有名词来说是一个重要的信号。

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

制作地名录有数百万个从维基百科和DBpedia中抓取的条目。覆盖范围很好。消除歧义（“苹果”公司与水果）是可怕的。这就是统计模型获胜的原因。

### Step 4: the CRF step (sketch, not full impl)

如果没有概率论的基础，从头开始编写50行完整的病例报告就没有启发性。改用“sklearn-crfsuite”：

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

“c1”和“c2”是L1和L2正规化。' all_possible_translations =True '让模型学习非法序列（例如，“O”之后的“I-ORG”）不太可能，这就是在不编写约束的情况下，CR如何强制执行贝洛一致性。

### Step 5: what a BiLSTM-CRF adds

特征变得习得。输入：令牌嵌入（GloVe或fastText）。LSTM从左到右和从右到左读取。级联隐藏状态通过CF输出层。RF仍然强制执行标签序列一致性; LSTM用学习的功能取代手工制作的功能。

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

对于RF层，使用' torchcrf. CRS '（pip instally pytorch-crf）。与手工制作的CRS相比，收益是可以衡量的，但比您预期的要小，除非您有数万个标签句子。

## Use It

spaCy开箱即用即可交付生产级NER。

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

请注意，标记为“ORG”而不是“PRODUCT”的“iPhone”-- spaCy的小模型对产品实体的覆盖较弱。大型模型（`en_core_web_lg`）做得更好。Transformer模型（' en_core_web_trf '）做得更好。

BERT NER的拥抱面孔：

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

' aggregage_strategy=“simple”'将连续的B-X、I-X令牌合并到一个跨度中。如果没有它，您就会获得代币级标签，并且必须合并自己。

### LLM-based NER (the 2026 option)

零镜头和少镜头LLM NER现在与许多领域的微调模型具有竞争力，并且在标记数据稀缺时表现得非常好。

- ** 零镜头提示。**为LLM提供实体类型列表和示例模式。请求SON输出。开箱即用;新颖领域的准确性中等。
- ** ZeroTuneBio风格提示。**将任务分解为候选提取、含义解释、判断、重新检查。多阶段提示（而不是一次性）大大提高了生物医学NER的准确性。同样的模式适用于法律、金融和科学领域。
- ** 使用RAG动态提示。**为每次推理调用从一个小的带注释种子集中初始化最相似的标记示例;动态构建少数镜头提示。在2026年基准中，这比静态提示将GPT-4生物医学NER F1提高了11-12%。
- ** 按实体类型分解。**对于长文档，一次提取所有实体类型的单个调用随着长度的增加而失去召回。每个实体类型运行一个提取过程。更高的推理成本，更高的准确性。这是临床笔记和法律合同的标准模式。

截至2026年的制作建议：在收集培训数据之前，从LLM零射击基线开始。通常F1已经足够好了，您不需要微调。

### Where classical NER still wins

即使有LLM可用，经典NER也会在以下情况下获胜：

- 延迟预算低于50 ms。
- 您有数千个已标记的示例，需要98%+ F1。
- 该领域具有稳定的主体，预训练的CRS或BiLSTM传输良好。
- 监管约束需要一种本地、非生成模型。

### Where it falls apart

- ** 域名转移。**接受过CoNLL法律合同培训的NER表现比地名录还差。对您的域名进行微调。
- ** 嵌套实体。**“美国银行大厦”同时是一个ORG和一个FACESCO。标准BOP不能代表重叠的跨度。您需要嵌套NER（多通道或基于跨度的模型）。
- ** 长实体。**“美国联邦存款保险公司。“代币级模型有时会分裂这一点。使用“聚合策略”或后处理。
- ** 稀疏类型。**医疗NER标签，例如DRUG_BRAND、ADVERSE_EVERSE、DOSE。通用模型不知道。Scispacy和BioBERT是那里的起点。

## Ship It

另存为“输出/skill-ner-picker.md”：

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

## Exercises

1. ** 简单。**实现“bio_to_spans”（“spans_to_bio”的反向）并验证10个句子的往返一致性。
2. ** 中等。**在CoNLL-2003英语NER数据集上训练上面的sklearn-crfsuite RF。使用“seqeval”报告每个实体F1。典型结果：~84 F1。
3. * * 很难。**对特定领域NER数据集（医疗、法律或金融）进行微调“蒸馏基础”。与spaCy小型号进行比较。记录数据泄露检查并写下令您惊讶的内容。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| NER | 提取名称 | 标签标记跨越类型（PERSON、ORG、GPE、UTE、.）。 |
| 生物 | 标签方案 | “B-X”开始，“I-X”继续，“O”在外面。 |
| 比卢 | 更好的比奥 | 添加`L-X`（最后一个）、`U-X`（单位）以使边界更清晰。 |
| CRF | 结构化分类器 | 模型在标签之间转换，而不仅仅是排放。强制执行有效序列。 |
| 巢式NER | 重叠图元 | 一个跨度与其子跨度是不同的实体。比奥无法表达这一点。 |
| 青少年级别F1 | 适当的NER指标 | 预测跨度必须与真实跨度完全匹配。代币级F1夸大了准确性。 |

## Further Reading

- [Lample等人（2016）。用于命名实体识别的神经架构]（https：//arxiv.org/abs/1603.01360）-BiLSTM-CF论文。经典的。
- [Devlin等人（2018）。- 你好Deep Bidirectional Transformers的预训练]（https：//arxiv.org/abs/1810.04805）-引入了成为标准的标记分类模式。
- [spaCy语言特征-命名实体]（https：//spacy.io/usage/linguistic-features#named-entities）-“Doc.ents”和“Span”上每个属性的实际参考。
- [seqeval]（https：//github.com/chaki-works/seqeval）-正确的指标库。始终使用它。
