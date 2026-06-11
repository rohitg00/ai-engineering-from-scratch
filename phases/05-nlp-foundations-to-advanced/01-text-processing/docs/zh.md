# Text Processing — Tokenization, Stemming, Lemmatization

> 语言是连续的。模型是离散的。预处理是桥梁。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段2 · 14（天真的Bayes）
** 时间：** ~45分钟

## The Problem

模特无法读到“猫在跑。“它读取的是integer。

每个NLP系统都会以相同的三个问题开始。一个词从哪里开始。这个词的词根是什么。当“run”、“running”、“run”有帮助时，我们如何将其视为同一件事，而当它没有帮助时，我们如何将其视为不同的事情。

标记化错误，模型就会从垃圾中学习。如果您的标记器将“don ' t '视为一个标记，但将“don ' t '视为两个标记，则训练分布会分裂。如果你的词干器将“组织”和“器官”合并到同一词干，主题建模就会消亡。如果你的词元转换器需要词性上下文但你没有通过它，那么动词就会被视为名词。

本课从头开始构建三个预处理基元，然后展示NLTK和spaCy如何执行相同的工作，以便您可以看到权衡。

## The Concept

三项手术。每个都有一个作业和一个失败模式。

![Preprocessing pipeline: raw text → tokens → stems or lemmas → model](./assets/pipeline.svg)

** 令牌化 ** 将字符串拆分为令牌。“Token”故意模糊，因为正确的粒度取决于任务。经典NLP的单词级。变形金刚的副词。不带空白的语言的字符。

**Stemming** 用规则切碎后缀。速度快、好斗、愚蠢。'运行'。“组织->机关”。第二个是失败模式。

** 词化 ** 使用语法知识将单词简化为词典形式。速度较慢、准确，需要查找表或形态分析仪。' ran -'（需要知道“ran”是“run”的过去时）。“更好->好”（需要了解比较形式）。

经验法则。当速度很重要并且您可以容忍噪音（搜索索引、粗略分类）时停止。当意义很重要时（问题回答、语义搜索、用户会阅读的任何内容），简化字母表。

## Build It

### Step 1: a regex word tokenizer

最简单有用的标记化器会拆分非字母数字字符，同时保留标点符号作为自己的标记。不完美，不是最终的，但它是一行。

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

按优先顺序排列有三种模式。带有可选内撇号的单词（“don ' t '、'）。纯粹的数字。任何单个非空白非字母数字字符作为独立标记（标点符号）。

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

需要注意的故障模式。“3 PM”分裂为“' 3”，“pm ']'，因为我们在字母运行和数字运行之间交替。对于大多数任务来说已经足够好了。网址、电子邮件、标签都崩溃了。对于生产，请在常规图案之前添加图案。

### Step 2: a Porter stemmer (step 1a only)

完整的波特算法有五个规则阶段。仅第1a步就涵盖了最常见的英语后缀并教授该模式。

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

自上而下阅读规则。' ies -' i '规则是为什么' pony '，而不是'。Real Porter有第1b步可以解决这个问题。规则相互竞争。早期规则获胜。顺序比任何单一规则都重要。

### Step 3: a lookup-based lemmatizer

真正的引体化需要形态学。一个易于处理的教学版本使用一个小引理表和一个后备。

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

最后一个案例是教学的关键时刻。“watched”不在我们的表中，我们的后备只处理“ing”。真正的词元化涵盖“ed”、不规则动词、比较形容词、带有发音变化的复数（“children -> children”）。这就是为什么生产系统使用WordNet、spaCy的形态生成器或完整的形态分析仪。

### Step 4: pipe them together

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

缺失的部分是POS标签。阶段5 · 07（POS标签）构建一个。目前，将所有内容默认为“NOUN”并承认限制。

## Use It

NLTK和spaCy推出了生产版本。每条几行。

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

' word_tokenize '处理压缩、Unicode、regex未命中的边缘情况。“PorterStemmer”负责所有五个阶段。“WordNetLemmatizer”需要将POS标签从NLTK的Penn Treebank方案翻译为WordNet的缩写集。上面的翻译连接是大多数教程跳过的部分。

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

spaCy将整个管道隐藏在'后面。代币化、POS标记和词元化都会运行。规模上快于NLTK。更准确的开箱即用。代价是您无法轻易交换单个组件。

### When to pick which

| 情况 | 接 |
|-----------|------|
| 教学、研究、交换组件 | NLTK |
| 制作、多语言、速度很重要 | spaCy |
| Transformer管道（无论如何，您都会使用模型的标记器进行标记） | 使用“标记器”/“转换器”并跳过经典预处理 |

### The two failure modes nobody warns you about

大多数教程都会教授算法并停止。有两件事会咬到真正的预处理管道，而且它们几乎从未被覆盖。

** 复制性漂移。** NLTK和spaCy更改了版本之间的标记化和词元化行为。spaCy 2.x中产生“' do '，'，'，' t ']'。您的模型在一个分布上训练。推理现在运行在不同的推理上。准确性悄然下降，没有人知道原因。将库版本固定在“relevants. text”中。编写一个预处理回归测试，冻结20个示例句子的预期标记化。在每次升级时运行它。

** 训练/推理不匹配。**通过积极的预处理（预设、停止词删除、词干）进行训练，部署在原始用户输入上，观察性能火山口。这是最常见的生产NLP故障。如果您在训练期间进行预处理，则必须在推理期间运行相同的功能。将预处理作为模型包内的一项功能进行传递，而不是作为服务团队重写的笔记本单元。

## Ship It

一个可重复使用的提示，帮助工程师在无需阅读三本教科书的情况下选择预处理策略。

另存为“输出/prompt-preprocessing-advisor.md”：

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

## Exercises

1. ** 简单。**扩展“tokenize”以将URL保留为单个令牌。测试：' tokenize（'立即访问https://example.com。“）'应该产生一个URL令牌。
2. ** 中等。**实施波特步骤1b。如果一个词包含元音并且以“ed”或“ing”结尾，则将其删除。处理双辅音规则（“hopping -> hop”，而不是“hopp”）。
3. ** 很难。**构建一个词元转换器，使用WordNet作为查找表，但当WordNet没有条目时，会退回到Porter stemmer。针对普通WordNet和普通Porter测量标记数据库的准确性。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 令牌 | 一句话 | 模型消耗任何单位。可以是字、子字、字符或字节。 |
| 干 | 词根 | 基于规则的后缀剥离的结果。并不总是一个真实的词。 |
| 引理 | 词典形式 | 您要查找的表格。需要语法上下文才能正确计算。 |
| POS标签 | 词性 | 像NOUN、VERB、ADJ这样的类别。需要准确地归零。 |
| 形态 | 词形规则 | 一个词如何根据时态、数字、格改变形式。文学化取决于它。 |

## Further Reading

- [Porter，M. F.（1980年）。后缀剥离的算法]（https：//tartarus.org/martin/PorterStemmer/def.txt）-原始论文，五页，仍然是最清晰的解释。
- [spaCy 101 -语言特征]（https：//spacy.io/usage/linguistic-features）-如何连接真正的管道。
- [NLTK书，第3章]（https：//www.nltk.org/book/ch03.html）-您还没有想到的标记化边缘案例。
