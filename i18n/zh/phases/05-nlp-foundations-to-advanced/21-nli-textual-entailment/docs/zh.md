# 自然语言的推理 文本含义

> "t entails h"意味着人类的读数 t将得出 h 是真的. NLI 是预测含义/矛盾/中立的任务.表面上的无聊,生产中承载.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment Analysis), Phase 5 · 13 (Question Answering)
**Time:** ~60 minutes

## 问题

你建立了一个总结器,它产生了总结. 你怎么知道总结中没有幻觉?

你建立了一个聊天机器人,它回答说是的.你怎么知道答案是通过检索的经文支持的?

你需要按主题分类1万篇新闻文章. 你没有训练标签. 你能再利用模型吗?

由于这些问题都归结为自然语言推理.`t`假设`h`现在`h`造成的`t`它们是不是与其他国家相矛盾的,还是中立的 (无关)?

- **Hallucination check:** `t`= 源文件`h`没有结局 =幻觉.
- **Grounded QA:** `t`   `h`没有结论 = 捏造.
- **Zero-shot classification:** `t`文件`h`相关性 =预测标签.

由于每一个RAG评估框架都会在盖子下放一个NLI模型.

## 概念

![NLI: three-way classification, premise vs hypothesis](../assets/nli.svg)

**The three labels.**

- **Entailment.** `t`其他`h`"猫在床上"意味着"有猫".
- **Contradiction.** `t``h`"猫在床上"与"没有猫"相矛盾.
- **Neutral.**无论如何,没有推断. "猫在床上"是中立的"猫饿了".

**Not logical entailment.**简单的说法是"自然的"语言推断,而不是严格的逻辑. "约翰走了他的狗"在NLI中意味着"约翰有狗",但严格的第一级逻辑只会承认它,如果你对拥有权进行了定理.

**Datasets.**

- **SNLI**(2015). 570万个人类注释的对,图像标题作为前提.
- **MultiNLI**标准培训课程在2026年.
- **ANLI**(2019). 逆境的NLI.人类写了专门设计的例子来打破现有模型.
- **DocNLI, ConTRoL**文件长度设置.测试多跳和长距离推断.

**The architecture.**变压器编码器 (BERT, RoBERTa, DeBERTa) 读取`[CLS] premise [SEP] hypothesis [SEP]`现在,我们要去.`[CLS]`通过MNLI进行训练,根据已保留的基准评估,在分发对上获得90%以上的准确性.

**Zero-shot via NLI.**根据文件和候选标签,将每个标签变成一个假设 ("本文是关于体育").计算每个文件的含义概率.选择最大.这是拥抱脸背后的机制.`zero-shot-classification`管道.

```figure
nli-router
```

## 建立它

### 步骤1:运行预训练的NLI模型

```python
from transformers import pipeline

nli = pipeline("text-classification",
               model="facebook/bart-large-mnli",
               top_k=None)  # return all labels; replaces deprecated return_all_scores=True

premise = "The cat is sleeping on the couch."
hypothesis = "There is a cat in the room."

result = nli({"text": premise, "text_pair": hypothesis})[0]
print(result)
# [{'label': 'entailment', 'score': 0.97},
#  {'label': 'neutral', 'score': 0.02},
#  {'label': 'contradiction', 'score': 0.01}]
```

对于生产NLI,`facebook/bart-large-mnli`其他`MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli`德伯塔-v3是排名榜首.

### 步骤2:零射击分类

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

默认情况下,模板是"本例是关于 {标签}."`hypothesis_template`没有训练数据,没有细节调整,它是不必要的.

### 步骤3:对RAG的忠实性检查

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

根据RAGAS的信任,将生成的答案分为原子索赔.

### 步骤4:手动滚动NLI分类器 (概念)

看到`code/main.py`对于只使用ddlib的玩具:前提和假设通过词汇重叠 + 否定检测进行比较.与变压器模型不竞争,但它显示任务的形状:两个文本进,三向标签出,损失 = 交叉透`{entail, contradict, neutral}`现在,我们要去.

## 陷

- **Hypothesis-only shortcuts.**模型可以从假设单独预测标签在SNLI上60%左右,因为"不是","没有人","从来没有"与矛盾相关.
- **Lexical overlap heuristic.**后续性论 ("每一个后续性都包含") 通过SNLI,但失败HANS/ANLI. 使用对抗性基准.
- **Document-length degradation.**单句NLI模型在文件长度的场所下降20+F1. 长文本中使用DocNLI训练模型.
- **Zero-shot template sensitivity.**"这个例子是关于{标签}"对"{标签}"对"主题是 {标签}"可以调整准确度10+点.
- **Domain mismatch.**法律,医学和科学文本需要特定领域的NLI模型 (例如SciNLI,MedNLI).

## 用它

现在,我们要做什么?

| Use case | Model |
|---------|-------|
| General-purpose NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Fast / edge | `cross-encoder/nli-deberta-v3-base` |
| Zero-shot classification (lightweight) | `facebook/bart-large-mnli` |
| Document-level NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Multilingual | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| Hallucination detection in RAG | NLI layer inside RAGAS / DeepEval |

2026年元格:NLI是文字理解的粘贴带.你需要"A支持B吗?"或"A与B相矛盾吗?"

## 运送它

保存如`outputs/skill-nli-picker.md`其他:

```markdown
---
name: nli-picker
description: Pick an NLI model, label template, and evaluation setup for a classification / faithfulness / zero-shot task.
version: 1.0.0
phase: 5
lesson: 21
tags: [nlp, nli, zero-shot]
---

Given a use case (faithfulness check, zero-shot classification, document-level inference), output:

1. Model. Named NLI checkpoint. Reason tied to domain, length, language.
2. Template (if zero-shot). Verbalization pattern. Example.
3. Threshold. Entailment cutoff for the decision rule. Reason based on calibration.
4. Evaluation. Accuracy on held-out labeled set, hypothesis-only baseline, adversarial subset.

Refuse to ship zero-shot classification without a 100-example labeled sanity check. Refuse to use a sentence-level NLI model on document-length premises. Flag any claim that NLI solves hallucination — it reduces it; it does not eliminate it.
```

## 运动

1. **Easy.**跑步`facebook/bart-large-mnli`在20个手工制作的三重 (前提,假设,标签) 上,涵盖三个类. 测量准确性. 添加对抗性的"次序测量"陷 ("我没有吃蛋糕"与"我吃蛋糕") 并看看它是否破裂.
2. **Medium.**比较零射击模板`"This text is about {label}"`反对`"The topic is {label}"`其他`"{label}"`报道准确性波动.
3. **Hard.**建立一个RAG忠实度检查器:原子索赔分解+每索赔的NLI. 根据50个RAG生成的答案进行评估,以黄金背景进行评估. 测量假阳性和假负率与手标签.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NLI | Natural Language Inference | 3-way classification of premise-hypothesis relationship. |
| RTE | Recognizing Textual Entailment | Older name for NLI; same task. |
| Entailment | "t implies h" | A typical reader would conclude h is true given t. |
| Contradiction | "t rules out h" | A typical reader would conclude h is false given t. |
| Neutral | "undecided" | No inference from t to h either way. |
| Zero-shot classification | NLI as classifier | Verbalize labels as hypotheses, pick max entailment. |
| Faithfulness | Is the answer supported? | NLI over (retrieved context, generated answer). |

## 进一步阅读

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) SNLI
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) 多种.
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599)ANLI基准指数.
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) NLI-as-classifier.
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654)2026年NLI工作马.
