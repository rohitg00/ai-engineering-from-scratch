# 名称实体识别

> 听起来很容易,直到你处理模糊的边界,嵌套的实体,和域名语.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word Embeddings)
**Time:** ~75 minutes

## 问题

"果公司就其在美国的iPhone搜索协议起诉谷歌".五家实体:果 (ORG),谷歌 (ORG),iPhone (PRODUCT),搜索协议 (也许),美国 (GPE).一个好的NER系统将所有这些实体都用正确类型提取出来.一个坏的系统错过了iPhone,把果和果公司混为一谈,并标记"美国"为个体.

简历分析,合规日志扫描,医疗记录匿名化,搜索查询理解,聊天机器人响应的基础,法律合同提取.你永远不会完全看到它;你总是依赖它.

这一课程将经典的路径 (基于规则,HMM,CRF) 走向现代的路径 (BiLSTM-CRF,然后是变压器).每个步骤解决了之前的特定限制.模式是课程.

## 概念

**BIO tagging**标签每一个代币以 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标签 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标 标`B-TYPE`(实体的开始),`I-TYPE`(内部实体),或`O`(任何实体以外).

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

多代币实体链: `New B-GPE`现在`York I-GPE`现在`City I-GPE`了解生物的模型可以提取任意的跨度.

建筑发展:

- **Rule-based.**已知实体的高精度,新实体的覆盖率为零.
- **HMM.**隐藏的马科夫模型,给定的标签的发射概率,标签到标签的过渡概率,维特比解码,训练用标签数据.
- **CRF.**条件随机场.像HMM,但有歧视性,所以你可以混合任意的特征 (字形,字母,邻近的词).仍然是2026年低资源部署的经典生产工作马.
- **BiLSTM-CRF.**系统读取句子两方向,CRF层在上面执行一致的标签序列.
- **Transformer-based.**精细调节BERT,具有代币分类头,最准确,最计算.

```figure
ner-bio-tagging
```

## 建立它

### 步骤1:生物标签助手

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

### 步骤2:手工制作的特征

对于经典 (非神经) NER,功能是游戏. 有用的是:

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

`word_shape("iPhone")`收益`xXxxxx`现在,我们要去.`word_shape("USA-2024")`收益`XXX-dddd`资本化模式对正确名词具有高信号.

### 步骤3:基于简单的规则+字典基础

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

制作报纸上有数百万条文章从维基百科和DBpedia中摘录.`Apple`由于这些问题,我们必须要做出一些决定.

### 步骤4:CRF步骤 (草图,不是完整的插入)

没有概率理论的基础,就不会有启发.`sklearn-crfsuite`换取之而言:

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

`c1`其他`c2`         `all_possible_transitions=True`模型可以学习非法序列 (例如,`I-ORG`之后`O`) 很不可能,这就是CRF如何在没有你写下限制的情况下强制生物一致性.

### 步骤5: BiLSTM-CRF所增加的内容

功能变得学习.输入:代号嵌入 (GloVe或快文).LSTM读左到右和右到左. 连接隐藏状态通过CRF输出层.CRF仍然强制标签序列一致性;LSTM取代手工制造的功能与学习.

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

对于CRF层,使用`torchcrf.CRF`虽然手工CRF的效益是可测量的,但比你预期的小,除非你有数万个标记的句子.

## 用它

产品级NER的 spaCy 运输出了盒子.

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

注意`iPhone`标记`ORG`而不是`PRODUCT` spaCy的小型模型产品实体覆盖率较低.`en_core_web_lg`变压器模型 (`en_core_web_trf`) 情况更好.

基于BERT的NER的拥抱面孔:

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

`aggregation_strategy="simple"`没有它,你就会得到代币级别的标签,

### 基于LLM的NER (2026期选项)

零射和少射的LLM NER现在与许多领域的细节调整模型竞争,

- **Zero-shot prompting.**给LLM一个实体类型的列表和一个示例方案. 请求JSON输出. 工作出盒子;在新领域的准确度是中等的.
- **ZeroTuneBio-style prompting.**解散任务成候选人提取 → 解释 → 判断 → 重复检查.多阶段提示 (而不是一次性) 显著提高了生物医学NER的准确性.同样的模式适用于法律,金融和科学领域.
- **Dynamic prompting with RAG.**检索每次推断调用的小注释种子集合中最类似的标签示例;在飞行中构建几次调用提示.在2026年基准中,这将GPT-4生物医学NER F1提高11-12%于静态调用提示.
- **Per-entity-type decomposition.**对于长文件,一个单次调用,同时提取所有实体类型,随着长度的增加而失去回忆. 每个实体类型运行一个提取通行. 推断成本更高,准确度更高. 这是临床笔记和法律合同的标准模式.

根据2026年开始的生产建议:在收集训练数据之前,开始从LLM零射击基线开始.

### 传统的NER仍然在胜利

即使有LLM,经典的NER在:

- 延迟预算低于50ms.
- 你有数千个标记的例子,需要98%+F1.
- 该域具有稳定的定性,预训练的CRF或BiLSTM转移良好.
- 监管限制要求实地进行非创建模式.

### 在它崩的地方

- **Domain shift.**法律合同的NER比报纸员更差.
- **Nested entities.**美国银行塔同时是ORG和FASILITY.标准BIO不能代表重叠跨度.你需要嵌套NER (多通或跨度模型).
- **Long entities.**美国联邦存款保险公司的代币级别模型有时会分开这个.`aggregation_strategy`或是后处理.
- **Sparse types.**医疗NER标签如Drug_Brand,ADVERSE_EVENT,DOSE.一般用途模型没有任何想法.Scispacy和BioBERT是此起点.

## 运送它

保存如`outputs/skill-ner-picker.md`其他:

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

## 运动

1. **Easy.**实施`bio_to_spans`(反向的`spans_to_bio`) 并通过10句检查回路一致性.
2. **Medium.**训练上述 sklearn-crfsuite CRF在CoNLL-2003英语NER数据集上.`seqeval`典型结果: ~ 84 F1.
3. **Hard.**精细调节`distilbert-base-cased`根据该数据库的数据库,您可以在一个特定领域的NER数据集 (医疗,法律或金融) 上进行比较.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NER | Extract names | Label token spans with types (PERSON, ORG, GPE, DATE, ...). |
| BIO | Tagging scheme | `B-X` begins, `I-X` continues, `O` outside. |
| BILOU | Better BIO | Adds `L-X` (last), `U-X` (unit) for cleaner boundaries. |
| CRF | Structured classifier | Models transitions between labels, not just emissions. Enforces valid sequences. |
| Nested NER | Overlapping entities | One span is a different entity than a sub-span of it. BIO cannot express this. |
| Entity-level F1 | Proper NER metric | Predicted span must match true span exactly. Token-level F1 overstates accuracy. |

## 进一步阅读

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) BiLSTM-CRF纸. 经典.
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805)引入了成为标准的代币分类模式.
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities) 关于每一个属性的实际参考`Doc.ents`其他`Span`现在,我们要去.
- [seqeval](https://github.com/chakki-works/seqeval)正确的计量库.
