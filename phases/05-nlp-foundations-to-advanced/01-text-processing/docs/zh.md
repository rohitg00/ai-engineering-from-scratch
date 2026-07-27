# 文本处理——Tokenization、Stemming、Lemmatization

> 语言是连续的。模型是离散的。预处理是桥梁。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 2 · 14（Naive Bayes）
**时间：** ~45 分钟

## 问题

模型无法直接读取 "The cats were running."，它读取的是整数。

每个 NLP 系统一开始都会面临三个同样的问题：词从哪里开始？词的词根是什么？我们如何将 "run"、"running"、"ran" 在需要时视为同一事物，在不需要时视为不同事物？

Tokenization 做错了，模型就会从垃圾数据中学习。如果你的 tokenizer 把 `don't` 当作一个 token，而把 `do n't` 当作两个，训练分布就会分裂。如果你的 stemmer 把 `organization` 和 `organ` 归为同一个词干，topic modeling 就会失效。如果你的 lemmatizer 需要词性上下文但你却没有传入，动词就会被当作名词处理。

本课将从零构建这三个预处理步骤，然后展示 NLTK 和 spaCy 如何完成同样的工作，让你看到其中的权衡。

## 概念

三种操作，每种都有其职责和失败模式。

**Tokenization** 将字符串切分为 tokens。"Token" 这个词故意模棱两可，因为合适的粒度取决于任务。词级用于经典 NLP，子词用于 transformer，字符用于没有空格的语言。

**Stemming** 通过规则切除后缀。快速、激进、粗暴。`running -> run`，`organization -> organ`。第二个就是它的失败模式。

**Lemmatization** 利用语法知识将词归约到词典形式。较慢、准确，需要查找表或形态分析器。`ran -> run`（需要知道 "ran" 是 "run" 的过去式）。`better -> good`（需要知道比较级形式）。

经验法则：当速度重要且可以容忍噪声时（搜索索引、粗略分类），用 stemming；当含义重要时（问答、语义搜索、任何用户会阅读的内容），用 lemmatization。

```figure
edit-distance
```

## 开始构建

### 第 1 步：正则表达式词 tokenizer

最简单实用的 tokenizer 按非字母数字字符分割，同时将标点保留为独立 token。不完美，不是最终方案，但一行代码就能运行。

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

按优先级排列的三个模式：带可选内部撇号的词（`don't`、`it's`）；纯数字；任何单个非空白、非字母数字字符作为独立 token（标点）。

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

需要注意的失败模式：`3pm` 被拆分为 `['3', 'pm']`，因为我们在字母序列和数字序列之间交替。对大多数任务来说足够好。URL、电子邮件、标签（hashtags）都会出错。生产环境需要在通用模式之前添加特定模式。

### 第 2 步：Porter stemmer（仅 step 1a）

完整的 Porter 算法有五阶段规则。仅 step 1a 就覆盖了最常见的英语后缀，并展示了其模式。

```python
def stem_step_1a(word):
    if word.endswith("sses"):
        return word[:-2]
    if word.endswith("ies"):
        return word[:-2]
    if word.endswith("ss"):
        return word
    if word.endswith("s") and len(word) > 1:
        return word[:-1]
    return word
```

```python
>>> [stem_step_1a(w) for w in ["caresses", "ponies", "caress", "cats"]]
['caress', 'poni', 'caress', 'cat']
```

从上到下阅读规则。`ies -> i` 规则是为什么 `ponies -> poni` 而不是 `pony`。真正的 Porter 有 step 1b 来修复这个问题。规则相互竞争，较早的规则获胜。顺序比任何单个规则都重要。

### 第 3 步：基于查找表的 lemmatizer

真正的 lemmatization 需要形态学。一个可教学的简化版本使用一个小型 lemma 表和回退机制。

```python
LEMMA_TABLE = {
    ("running", "VERB"): "run",
    ("ran", "VERB"): "run",
    ("runs", "VERB"): "run",
    ("better", "ADJ"): "good",
    ("best", "ADJ"): "good",
    ("cats", "NOUN"): "cat",
    ("cat", "NOUN"): "cat",
    ("were", "VERB"): "be",
    ("was", "VERB"): "be",
    ("is", "VERB"): "be",
}

def lemmatize(word, pos):
    key = (word.lower(), pos)
    if key in LEMMA_TABLE:
        return LEMMA_TABLE[key]
    if pos == "VERB" and word.endswith("ing"):
        return word[:-3]
    if pos == "NOUN" and word.endswith("s"):
        return word[:-1]
    return word.lower()
```

```python
>>> lemmatize("running", "VERB")
'run'
>>> lemmatize("cats", "NOUN")
'cat'
>>> lemmatize("better", "ADJ")
'good'
>>> lemmatize("watched", "VERB")
'watched'
```

最后一个案例是关键的教学时刻。`watched` 不在我们的表中，我们的回退只处理了 `ing`。真正的 lemmatization 涵盖 `ed`、不规则动词、比较级形容词、带有音变的复数形式（`children -> child`）。这就是为什么生产系统使用 WordNet、spaCy 的 morphologizer 或完整的形态分析器。

### 第 4 步：组合在一起

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

缺少的部分是 POS tagger。阶段 5 · 07（POS Tagging）会构建一个。现在，将所有默认设为 `NOUN` 并承认这个限制。

## 使用现成工具

NLTK 和 spaCy 提供了生产版本。各需几行代码。

### NLTK

```python
import nltk
nltk.download("punkt_tab")
nltk.download("wordnet")
nltk.download("averaged_perceptron_tagger_eng")

from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer, WordNetLemmatizer
from nltk import pos_tag

text = "The cats were running."
tokens = word_tokenize(text)
stems = [PorterStemmer().stem(t) for t in tokens]
lemmatizer = WordNetLemmatizer()
tagged = pos_tag(tokens)


def nltk_pos_to_wordnet(tag):
    if tag.startswith("V"):
        return "v"
    if tag.startswith("J"):
        return "a"
    if tag.startswith("R"):
        return "r"
    return "n"


lemmas = [lemmatizer.lemmatize(t, nltk_pos_to_wordnet(tag)) for t, tag in tagged]
```

`word_tokenize` 处理缩约形式、Unicode 以及你的正则表达式遗漏的边缘情况。`PorterStemmer` 运行全部五个阶段。`WordNetLemmatizer` 需要将 POS 标签从 NLTK 的 Penn Treebank 方案转换为 WordNet 的缩写集。上面这个转换接线代码是大多数教程会跳过的地方。

### spaCy

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running.")

for token in doc:
    print(token.text, token.lemma_, token.pos_)
```

```
The      the     DET
cats     cat     NOUN
were     be      AUX
running  run     VERB
.        .       PUNCT
```

spaCy 将整个 pipeline 隐藏在 `nlp(text)` 后面。Tokenization、POS tagging 和 lemmatization 全部运行。大规模使用时比 NLTK 更快，开箱即用更准确。代价是你不能轻易替换单个组件。

### 何时选择哪个

| 场景 | 选择 |
|-----------|------|
| 教学、研究、更换组件 | NLTK |
| 生产环境、多语言、速度重要 | spaCy |
| Transformer pipeline（反正会用模型的 tokenizer 来 tokenize）| 使用 `tokenizers` / `transformers`，跳过经典预处理 |

### 没人警告你的两种失败模式

大多数教程教完算法就停止了。有两件事会在真实预处理 pipeline 中给你带来麻烦，而且几乎从未被提及。

**可复现性漂移。** NLTK 和 spaCy 会在版本之间改变 tokenization 和 lemmatizer 的行为。在 spaCy 2.x 中产生 `['do', "n't"]` 的代码，在 3.x 中可能产生 `["don't"]`。你的模型是在一个分布上训练的，现在推理却在另一个分布上运行。准确率悄悄下降，没人知道原因。在 `requirements.txt` 中锁定库版本。编写一个预处理回归测试，冻结 20 个示例句子的预期 tokenization。每次升级时运行它。

**训练/推理不匹配。** 训练时使用激进的预处理（小写化、停用词移除、stemming），部署时对原始用户输入运行，性能暴跌。这是最常见的生产 NLP 失败。如果你在训练期间做预处理，在推理期间必须运行相同的函数。将预处理作为模型包内的函数交付，而不是作为服务团队重写的 notebook 单元格。

## 交付

一个可复用的 prompt，帮助工程师在不读三本教科书的情况下选择合适的预处理策略。

保存为 `outputs/prompt-preprocessing-advisor.md`：

```markdown
---
name: preprocessing-advisor
description: Recommends a tokenization, stemming, and lemmatization setup for an NLP task.
phase: 5
lesson: 01
---

You advise on classical NLP preprocessing. Given a task description, you output:

1. Tokenization choice (regex, NLTK word_tokenize, spaCy, or transformer tokenizer). Explain why.
2. Whether to stem, lemmatize, both, or neither. Explain why.
3. Specific library calls. Name the functions. Quote the POS-tag translation if NLTK is involved.
4. One failure mode the user should test for.

Refuse to recommend stemming for user-visible text. Refuse to recommend lemmatization without POS tags. Flag non-English input as needing a different pipeline.
```

## 练习

1. **简单。** 扩展 `tokenize` 以将 URL 保留为单个 token。测试：`tokenize("Visit https://example.com today.")` 应产生一个 URL token。
2. **中等。** 实现 Porter step 1b。如果一个词包含元音并以 `ed` 或 `ing` 结尾，则移除它。处理双辅音规则（`hopping -> hop`，而不是 `hopp`）。
3. **困难。** 构建一个 lemmatizer，使用 WordNet 作为查找表，但在 WordNet 没有条目时回退到你的 Porter stemmer。在标注语料库上测量准确率，与纯 WordNet 和纯 Porter 对比。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| Token | 一个词 | 模型消费的任何单位。可以是词、子词、字符或字节。 |
| Stem | 词的词根 | 基于规则的后缀切除结果。不总是一个真实的词。 |
| Lemma | 词典形式 | 你会去查词典的形式。需要语法上下文才能正确计算。 |
| POS tag | 词性 | 像 NOUN、VERB、ADJ 这样的类别。需要准确地进行 lemmatization。 |
| Morphology | 词的形态规则 | 词如何根据时态、数、格改变形式。Lemmatization 依赖于它。 |

## 延伸阅读

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt) —— 原始论文，五页，仍然是最清晰的解释。
- [spaCy 101 —— linguistic features](https://spacy.io/usage/linguistic-features) —— 真实 pipeline 的接线方式。
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html) —— 你还没想到的 tokenization 边缘情况。
