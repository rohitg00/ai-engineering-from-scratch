# 文本处理 —— 分词、词干化、词形还原（Text Processing — Tokenization, Stemming, Lemmatization）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 语言是连续的，模型是离散的，预处理是这两者之间的桥梁。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## 问题（The Problem）

模型读不懂 "The cats were running."，它读的是整数。

每个 NLP 系统开篇都会面对同样的三个问题：一个词从哪里开始？一个词的词根是什么？什么时候我们应该把 "run"、"running"、"ran" 当作同一个东西（这有用），又什么时候应该把它们当作不同的东西（这不该混淆）？

tokenization（分词）一旦做错，模型就在用垃圾学习。如果你的 tokenizer 把 `don't` 当成一个 token，但又把 `do n't` 当成两个，训练分布就裂开了。如果你的 stemmer（词干化器）把 `organization` 和 `organ` 归到同一个词干，主题建模就废了。如果你的 lemmatizer（词形还原器）需要词性（part-of-speech）上下文，而你没传，动词就会被当成名词处理。

本课会从零搭出这三个预处理步骤，然后展示 NLTK 和 spaCy 是怎么做同样的事的，让你看清各自的取舍。

## 概念（The Concept）

三种操作。每一种都有它的用途和它的失败模式。

**Tokenization（分词）** 把字符串切成 token。「token」之所以故意说得模糊，是因为合适的粒度取决于任务。经典 NLP 用词级；transformer 用 subword（子词）；没有空格的语言用字符级。

**Stemming（词干化）** 用规则砍后缀。快、激进、笨。`running -> run`。`organization -> organ`。后一个就是它的失败模式。

**Lemmatization（词形还原）** 借助语法知识把一个词还原到字典形式。慢、准确，需要查找表或形态分析器。`ran -> run`（要知道 "ran" 是 "run" 的过去式）。`better -> good`（要懂比较级形式）。

经验法则：当速度优先、能容忍噪声时（搜索建索引、粗分类）用 stem；当意思重要时（问答、语义搜索、任何用户会读到的输出）用 lemmatize。

## 动手实现（Build It）

### Step 1：基于正则的词级 tokenizer

最简单又能用的 tokenizer 在非字母数字处切分，同时把标点本身当成独立 token。不完美，也不是最终版，但一行能跑出来。

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

按优先级排好的三种模式：带可选内嵌单引号的词（`don't`、`it's`）；纯数字；任何单个非空白非字母数字的字符作为独立 token（标点）。

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

注意几个失败模式。`3pm` 会被切成 `['3', 'pm']`，因为我们在字母段和数字段之间交替匹配。对大多数任务来说够用了。URL、邮件地址、hashtag 都会挂掉。生产环境中要把这些专门的模式加在通用模式之前。

### Step 2：Porter stemmer（只做 step 1a）

完整的 Porter 算法有五个阶段的规则。光是 step 1a 就覆盖了英文里最常见的后缀，并且足以教会你这套套路。

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

从上往下读规则。`ies -> i` 这条规则就是为什么 `ponies -> poni` 而不是 `pony`。真正的 Porter 还有 step 1b 会修这个问题。规则之间互相竞争，谁排前面谁赢。规则的顺序比任何单条规则都更重要。

### Step 3：基于查表的 lemmatizer

正经的词形还原需要形态学。一个适合教学、能跑得起来的版本是：用一张小的 lemma 表加一个兜底逻辑。

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

最后一个例子才是关键的教学时刻。`watched` 不在我们的表里，而我们的兜底只处理 `ing`。真正的词形还原要覆盖 `ed`、不规则动词、形容词比较级、带语音变化的复数（`children -> child`）等等。这正是为什么生产系统会用 WordNet、spaCy 的 morphologizer，或者一个完整的形态分析器。

### Step 4：把它们串起来

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

缺的那一块是 POS tagger（词性标注器）。Phase 5 · 07（POS Tagging）会自己造一个。眼下先把所有 token 都默认成 `NOUN`，并明确承认这个局限。

## 用起来（Use It）

NLTK 和 spaCy 都自带生产级实现。每个都只要几行。

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

`word_tokenize` 能处理你那个正则会漏掉的缩写、Unicode、各种边界情况。`PorterStemmer` 跑完整的五个阶段。`WordNetLemmatizer` 需要把 POS tag 从 NLTK 用的 Penn Treebank 体系翻译成 WordNet 的缩写集。上面那段翻译胶水代码，是绝大多数教程都会跳过的部分。

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

spaCy 把整条 pipeline（流水线）藏在 `nlp(text)` 后面：tokenization、POS tagging、lemmatization 一次跑完。规模上比 NLTK 快，开箱即用更准。代价是单个组件不容易拆出来换。

### 怎么选

| 场景 | 选谁 |
|-----------|------|
| 教学、做研究、要换组件 | NLTK |
| 生产、多语言、对速度敏感 | spaCy |
| Transformer 流水线（反正你会用模型自带的 tokenizer） | 用 `tokenizers` / `transformers`，跳过经典预处理 |

### 没人警告你的两个失败模式

大多数教程把算法讲完就停了。可有两件事会咬到真实的预处理流水线，而且几乎从不被提及。

**可复现性漂移（Reproducibility drift）。** NLTK 和 spaCy 在不同版本之间会改变 tokenization 和 lemmatizer 行为。在 spaCy 2.x 里产出 `['do', "n't"]` 的，在 3.x 里可能产出 `["don't"]`。你的模型是在某一种分布上训练的，推理（inference）时跑的却是另一种。准确率悄悄下降，没人知道为什么。在 `requirements.txt` 里把库版本钉死。写一个预处理回归测试，把 20 个样本句子的预期分词结果冻结下来，每次升级都跑一遍。

**训练 / 推理不一致（Training / inference mismatch）。** 训练时做了激进预处理（小写化、去停用词、词干化），上线时却拿原始用户输入直接跑——眼睁睁看着性能崩盘。这是生产 NLP 中最常见的单一故障。如果你在训练时做了预处理，那推理时必须跑同一个函数。把预处理作为一个函数随模型包一起发布，而不是让上线团队照着 notebook 单元格重写一遍。

## 上线部署（Ship It）

一段可复用的 prompt，帮工程师挑预处理策略时不用啃完三本教科书。

存为 `outputs/prompt-preprocessing-advisor.md`：

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

## 练习（Exercises）

1. **简单。** 扩展 `tokenize`，让它把 URL 当作一个完整 token。测试：`tokenize("Visit https://example.com today.")` 应该产出一个 URL token。
2. **中等。** 实现 Porter step 1b。如果一个词包含元音并且以 `ed` 或 `ing` 结尾，就把后缀去掉。处理双辅音规则（`hopping -> hop`，不是 `hopp`）。
3. **困难。** 造一个 lemmatizer：先查 WordNet，查不到就回退到你的 Porter stemmer。在一个带词性标注的语料上测准确率，分别和纯 WordNet、纯 Porter 比一比。

## 关键术语（Key Terms）

| 术语 | 大家嘴上是怎么说的 | 它实际是什么 |
|------|-----------------|-----------------------|
| Token | 一个词 | 模型实际消费的任意单位。可以是词、子词、字符或字节。 |
| Stem | 词根 | 基于规则砍后缀的产物，不一定是真实存在的词。 |
| Lemma | 字典形式 | 你查字典时会查的那个形式。要算准确需要语法上下文。 |
| POS tag | 词性 | 比如 NOUN、VERB、ADJ 这样的类别。准确做 lemmatization 离不开它。 |
| Morphology | 词形规则 | 词如何随时态、数、格变化形态。lemmatization 依赖它。 |

## 延伸阅读（Further Reading）

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt) —— 原始论文，五页，至今仍是最清晰的解释。
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) —— 一条真实流水线是怎么连起来的。
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html) —— 你还没想到的那些 tokenization 边界情况。
