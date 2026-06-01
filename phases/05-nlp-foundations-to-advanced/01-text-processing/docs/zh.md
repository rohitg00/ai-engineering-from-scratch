# 01 · 文本处理 —— 分词、词干提取与词形还原

> 语言是连续的，模型是离散的。预处理就是二者之间的桥梁。

**类型：** 实践（Build）
**语言：** Python
**前置：** 阶段 2 · 14（朴素贝叶斯）
**时长：** 约 45 分钟

## 问题所在

模型读不懂 "The cats were running."，它读到的是整数。

每个 NLP 系统开篇都要面对相同的三个问题：一个词从哪里开始；这个词的词根是什么；以及当我们需要时如何把 "run"、"running"、"ran" 当作同一个东西，而在不需要时又把它们当作不同的东西。

分词一旦出错，模型学到的就是垃圾。如果你的「分词器（tokenizer）」把 `don't` 当作一个 token，却把 `do n't` 当作两个，训练分布就会被劈开。如果你的「词干提取器（stemmer）」把 `organization` 和 `organ` 归并到同一个词干，主题建模就废了。如果你的「词形还原器（lemmatizer）」需要词性上下文而你没有传入，动词就会被当成名词处理。

本课将从零构建这三个预处理步骤，然后展示 NLTK 与 spaCy 是如何完成同样的工作的，让你看清其中的取舍。

## 核心概念

三种操作，每一种都有自己的职责和失效模式。

**「分词（Tokenization）」** 把一个字符串切分成若干 token。"Token" 这个词刻意保持模糊，因为合适的粒度取决于任务：经典 NLP 用词级别，Transformer 用子词，无空格分隔的语言用字符。

**「词干提取（Stemming）」** 用规则砍掉后缀。快、激进、笨。`running -> run`，`organization -> organ`。后一个就是它的失效模式。

**「词形还原（Lemmatization）」** 借助语法知识把一个词还原为它的词典形式。更慢、更准确，需要一张查找表或一个形态分析器。`ran -> run`（需要知道 "ran" 是 "run" 的过去式）。`better -> good`（需要知道比较级形式）。

经验法则：当速度重要、且你能容忍噪声时（搜索索引、粗糙分类），用词干提取；当语义重要时（问答、语义搜索，以及任何会被用户读到的东西），用词形还原。

## 动手构建

### 第 1 步：一个基于正则的词级分词器

最简单且实用的分词器是按非字母数字字符切分，同时把标点当作独立的 token。它并不完美，也不是终极方案，但一行就能跑起来。

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

三个模式按优先级排列：带可选内部撇号的单词（`don't`、`it's`）；纯数字；任何单个的非空白、非字母数字字符作为独立 token（标点）。

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

需要留意的失效模式：`3pm` 被切成了 `['3', 'pm']`，因为我们是在字母串和数字串之间交替匹配。对大多数任务来说够用了。URL、邮箱、话题标签都会被切坏。要用于生产，请在通用模式之前加入这些专门的模式。

### 第 2 步：一个 Porter 词干提取器（仅 step 1a）

完整的 Porter 算法有五个阶段的规则。仅 step 1a 就覆盖了英语中最高频的后缀，并能讲清这套模式。

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

自上而下读这些规则。`ies -> i` 这条规则正是 `ponies -> poni` 而非 `pony` 的原因。真正的 Porter 算法有 step 1b 来修正它。规则之间相互竞争，靠前的规则获胜。规则的顺序比任何单条规则都更重要。

### 第 3 步：一个基于查表的词形还原器

真正的词形还原需要形态学知识。一个便于教学、可行的版本使用一张小型词元表外加一个兜底逻辑。

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

最后一个例子是关键的教学点。`watched` 不在我们的表里，而我们的兜底逻辑只处理 `ing`。真正的词形还原要覆盖 `ed`、不规则动词、比较级形容词，以及带读音变化的复数（`children -> child`）。这正是生产系统会使用 WordNet、spaCy 的形态分析器（morphologizer），或一个完整形态分析器的原因。

### 第 4 步：把它们串成流水线

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

缺失的一环是「词性标注器（POS tagger）」。阶段 5 · 07（词性标注）会构建一个。眼下，我们把所有词默认标为 `NOUN`，并坦承这一局限。

## 上手使用

NLTK 与 spaCy 都自带了生产级实现，各自只需几行代码。

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

`word_tokenize` 能处理缩写、Unicode，以及你的正则会漏掉的各种边界情况。`PorterStemmer` 会跑完全部五个阶段。`WordNetLemmatizer` 需要把词性标签从 NLTK 的 Penn Treebank 体系翻译成 WordNet 的缩写集合。上面那段翻译接线代码，正是大多数教程会跳过的部分。

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

spaCy 把整条流水线都藏在了 `nlp(text)` 背后。分词、词性标注、词形还原全都会运行。大规模处理时比 NLTK 更快，开箱即用的准确率也更高。代价是你无法轻易替换其中的单个组件。

### 何时选哪个

| 场景 | 选择 |
|-----------|------|
| 教学、研究、需要替换组件 | NLTK |
| 生产、多语言、速度重要 | spaCy |
| Transformer 流水线（反正你会用模型自带的分词器来分词） | 使用 `tokenizers` / `transformers`，跳过经典预处理 |

### 没人提醒你的两个失效模式

大多数教程教完算法就结束了。有两件事会咬住真实的预处理流水线，而它们几乎从不被提及。

**可复现性漂移（Reproducibility drift）。** NLTK 与 spaCy 会在版本之间改变分词和词形还原的行为。在 spaCy 2.x 中产出 `['do', "n't"]` 的输入，到了 3.x 可能产出 `["don't"]`。你的模型是在一种分布上训练的，如今推理却跑在另一种分布上。准确率悄悄下滑，却没人知道原因。请在 `requirements.txt` 中锁定库的版本。编写一个预处理回归测试，冻结 20 个样例句子的预期分词结果，并在每次升级时运行它。

**训练 / 推理不一致（Training / inference mismatch）。** 训练时用了激进的预处理（小写化、去停用词、词干提取），部署时却直接喂入用户的原始输入，于是眼看着性能崩塌。这是生产 NLP 中最常见的单一失败原因。如果你在训练时做了预处理，那么在推理时必须运行完全相同的函数。把预处理作为模型包内的一个函数一起发布，而不是当成一个由部署团队各自重写的 notebook 单元格。

## 交付成果

下面是一个可复用的提示词，帮助工程师在不用啃三本教科书的情况下挑选预处理策略。

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

1. **简单。** 扩展 `tokenize`，把 URL 保留为单个 token。测试：`tokenize("Visit https://example.com today.")` 应当产出一个 URL token。
2. **中等。** 实现 Porter step 1b。如果一个词包含元音且以 `ed` 或 `ing` 结尾，就去掉它。处理双辅音规则（`hopping -> hop`，而非 `hopp`）。
3. **困难。** 构建一个词形还原器，以 WordNet 作为查找表，但当 WordNet 中没有对应条目时，回退到你的 Porter 词干提取器。在一个带词性标注的语料库上，将其准确率与纯 WordNet、纯 Porter 进行对比测量。

## 关键术语

| 术语 | 人们常说的 | 它实际的含义 |
|------|-----------------|-----------------------|
| Token（词元/标记） | 一个词 | 模型所消费的任意单元。可以是词、子词、字符或字节。 |
| Stem（词干） | 词的词根 | 基于规则剥离后缀的结果。不一定是真实的词。 |
| Lemma（词元/词典形） | 词典形式 | 你会去查阅的那个形式。需要语法上下文才能正确计算。 |
| POS tag（词性标签） | 词性 | 诸如 NOUN、VERB、ADJ 之类的类别。准确词形还原所必需。 |
| Morphology（形态学） | 词形变化规则 | 一个词如何依据时态、数、格而改变形态。词形还原依赖于它。 |

## 延伸阅读

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt) —— 原始论文，五页，至今仍是最清晰的讲解。
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) —— 一条真实流水线是如何接线的。
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html) —— 你还没想到的那些分词边界情况。
