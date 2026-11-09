# 文本处理 标记化,排序,化

> 语言是连续的,模型是离散的,预处理是桥梁.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## 问题

模型不能读"猫们跑了". 它读完整数.

每个NLP系统都以相同的三个问题开启.一个词从哪里开始.这个词的根源是什么?我们如何把"跑","跑","跑"当它帮助的时候,当它帮助的时候,当它帮助的时候,当它帮助的时候,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它帮助时,当它对待时,当它帮助时,当它对待时,当它对待时,当它对待时,当它对它对它有所帮助时,当它对它对它对它有所帮助时,当它对它对它对它对它有不同的影响时,当它对它对它对它对它对它对它对它有所影响.

如果你的代币器处理了,`don't`作为一个标志,但`do n't`如果你的投票崩,`organization`其他`organ`如果你的化器需要部分语文背景,但你没有通过它,动词将被视为名词.

这一课程将从零开始构建三个预处理步骤,然后展示NLTK和spaCy如何做同样的工作,

## 概念

三个操作,每个操作都有一个任务,一个失败模式.

**Tokenization**字符串分为代币. "代币"是故意模糊的,因为正确的细分性取决于任务. 经典NLP的字面级别. 变压器的字体. 语言的字符没有白色空间.

**Stemming**快速,侵略性,愚蠢.`running -> run`现在,我们要去.`organization -> organ`第二个是失败模式.

**Lemmatization**通过使用语法知识将一个词缩小到词典形式. 慢慢,准确,需要一个搜索表或形态分析仪. `ran -> run`(需要知道"跑"是"跑"的过去时代).`better -> good`(需要了解相对形式).

语:当速度重要时,你可以容忍噪音 (搜索索索引,粗略分类).当意义重要时,你可以语 (回答问题,语义搜索,用户会阅读任何东西).

```figure
edit-distance
```

## 建立它

### 步骤1:一个regex字符标记器

最简单的有用代币器分成非字母符号,同时保留符号作为自己的代币. 不完美,不是最终的,但它运行在一个行.

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

字母的排序:`don't`现在`it's`) 纯数字:任何单个非白色空间非字母符作为独立的标记 (点点).

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

检测失败模式.`3pm`分成`['3', 'pm']`因为我们在字母运行和数字运行之间交替. 足够适合大多数任务. URL,电子邮件,hashtag都破裂.

### 步骤2:一个 Porter stemmer (仅步骤1a)

波特算法包含五个阶段的规则. 单独的第一步涵盖了最常见的英语后音,并教导了模式.

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

阅读下面的规则.`ies -> i`规则是为什么`ponies -> poni`没有`pony`实际的波特有第一步B,可以解决问题,规则竞争,以前的规则赢得,秩序比任何单一规则都重要.

### 步骤3:基于搜索的化器

化需要形态学.一个可操作的教学版本使用一个小的形表和一个倒退.

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

最后一个案例是教学的关键时刻.`watched`没有在我们的桌子上,我们的倒退只能处理.`ing`实际的化覆盖`ed`无规律的动词,比较形容词,音调变化的多元 (`children -> child`这就是为什么生产系统使用WordNet, spaCy的形态分析仪,或一个完整的形态分析仪.

### 步骤4:将它们连接在一起

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

现在,默认所有东西都在`NOUN`承认自己的限制.

## 用它

产品版本的NLTK和SpaCy运输,每行几行.

### 其他国家

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

`word_tokenize`处理缩短,Unicode,边缘案例,你的regex错过了.`PorterStemmer`它们在五个阶段都运行.`WordNetLemmatizer`需要从NLTK的Penn Treebank计划转换到WordNet的缩写集.上面的翻译线程是大多数教程的跳过.

### 空间

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

太空系统隐藏了整个管道.`nlp(text)`标记, POS标记和 lemmatization都运行. 比NLTK更快. 精确. 折衷是,你不能轻松交换个体组件.

### 什么时候选择哪个

| Situation | Pick |
|-----------|------|
| Teaching, research, swapping components | NLTK |
| Production, multi-language, speed matters | spaCy |
| Transformer pipeline (you'll tokenize with the model's tokenizer anyway) | Use `tokenizers` / `transformers` and skip classical preprocessing |

### 没有人警告你

两件事会造成真正的预处理管道,而且几乎从来都没有被覆盖.

**Reproducibility drift.**它们的版本在NLTK和 spaCy之间改变了代码化和 lemmatizer行为.`['do', "n't"]`在 spaCy 2.x 中可能产生`["don't"]`现在,你的模型在一个分布上运行. 推理现在运行在另一个. 精度缓慢降低,没有人知道为什么.`requirements.txt`写一个预处理回归测试, 结20个样本句子的预期标记.

**Training / inference mismatch.**训练使用积极的预处理 (小字母,停止字母删除,源),部署在原始用户输入,表现坑.这是最常见的生产NLP失败.如果你在训练中预处理,你必须在推断期间运行相同的功能. 运输预处理作为模型包内功能,而不是作为笔记本电脑细胞服务团队重写.

## 运送它

帮助工程师在没有阅读三本教科书的情况下选择预处理策略的可重复使用提示.

保存如`outputs/prompt-preprocessing-advisor.md`其他:

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

## 运动

1. **Easy.**延长时间`tokenize`测试: `tokenize("Visit https://example.com today.")`应该产生一个URL代码.
2. **Medium.**执行 Porter 步骤 1b. 如果一个词包含一个音符,`ed`或`ing`取消它. 处理双语音规则 (`hopping -> hop`没有`hopp`)
3. **Hard.**建立一个使用WordNet作为搜索表的 lemmatizer,但当WordNet没有输入时,它会回到你的 Porter stemmer.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Token | A word | Whatever unit the model consumes. Can be word, subword, character, or byte. |
| Stem | Root of a word | Result of rule-based suffix stripping. Not always a real word. |
| Lemma | Dictionary form | The form you'd look up. Requires grammatical context to compute correctly. |
| POS tag | Part of speech | Category like NOUN, VERB, ADJ. Needed to lemmatize accurately. |
| Morphology | Word shape rules | How a word changes form based on tense, number, case. Lemmatization depends on it. |

## 进一步阅读

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt)五页的原始论文,仍然是最清晰的解释.
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features)如何连接一个真正的管道.
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html)你还没有想到的代币化边缘案例.
