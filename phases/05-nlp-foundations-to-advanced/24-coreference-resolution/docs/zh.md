# Coreference Resolution

> “她打电话给他。他没有回答。医生正在吃午饭。“三次提到了两个人，但没有人透露姓名。共指决议确定谁是谁。

** 类型：** 学习
** 语言：** Python
** 先决条件：** 阶段5 · 06（NER）、阶段5 · 07（POS和解析）
** 时间：** ~60分钟

## The Problem

摘录所有提及苹果公司的内容。来自一篇300字的文章。当文章说“苹果。“当它说‘公司’、‘他们’、‘库比蒂诺的科技巨头’或‘乔布斯的公司’时，就很难了。“如果不将这些提及解决为同一实体，您的NER管道将错过60-80%的提及。

共指解析将引用同一现实世界实体的每个表达链接到一个集群中。它是表面级NLP（NER、解析）和下游语义（IE、QA、摘要、KG）之间的粘合剂。

为什么2026年很重要：

- 总结：“首席执行官宣布.“vs”蒂姆·库克宣布.“-摘要应该点名首席执行官。
- 回答问题：“她给谁打了电话？“需要解决”她。"
- 信息提取：以“PER 1创立苹果”和“乔布斯创立苹果”作为单独条目的知识图是错误的。
- 多文档IE：合并有关同一事件的文章中的提及就是跨文档共指。

## The Concept

![Coreference clustering: mentions → entities](../assets/coref.svg)

** 任务。**输入：文档。输出：提及（跨度）的集群，其中每个集群引用一个实体。

** 提及类型。**

- ** 命名实体。**“蒂姆·库克”
- ** 名义上的。**“首席执行官”、“公司”
- ** 代词。**“他”、“她”、“他们”、“它”
- ** 赞同。**“蒂姆·库克，苹果首席执行官，”

** 建筑。**

1. ** 基于规则（霍布斯，1978）。**使用语法规则的基于语法树的代词解析。良好的基线。令人惊讶的是，代词很难被击败。
2. ** 提及对分类器。**对于每对提及（m_i，m_j），预测它们是否共同指代。通过传递闭合进行聚集。标准2016年之前。
3. ** 提及排名。**对于每次提及，对候选前身进行排名（包括“无前身”）。挑选顶部。
4. ** 基于Span的端到端（Lee等人，2017年）。** Transformer编码器。列举所有候选人的长度上限。预测提到分数。预测每个跨度的先行概率。贪婪的集群。现代的默认值。
5. ** 世代相传（2024年+）。**提示LLM：“列出本文中的每个代词及其先行词。“在简单的案例、冗长的文件和罕见的参考文献中表现出色。

** 评估指标。**五个标准指标（MUC、B³、CEAF、BLANC、LEA），因为没有单一指标可以捕捉集群质量。将前三个的平均值报告为CoNLL F1。2026年最先进的CoNLL-2012：~83 F1。

* * 已知的困难案例。**

- 针对前面几页介绍的实体的明确描述。
- 桥形回指（“轮子”--前面提到的汽车）。
- 中文和日语等语言中的零回指。
- Cataphora（指代词前的代词）：“当 ** 她 ** 走进来时，玛丽笑了。"

## Build It

### Step 1: pretrained neural coreference (AllenNLP / spaCy-experimental)

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said they would ship soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

在更长的文档中，您会得到类似于以下内容：
- 第一组：[苹果，公司，他们]
- 第二类：[新产品]

### Step 2: rule-based pronoun resolver (teaching)

有关仅限stdlib的实现，请参阅“code/main.py”：

1. 摘录提及：命名实体（大写跨度）、代词（dict查找）、明确描述（“X”）。
2. 对于每个代词，查看之前提到的K并通过以下方式评分：
   - 性别/数字一致（启发式）
   - 最近度（更接近获胜）
   - 语法角色（科目优先）
3. 链接得分最高的先行者。

不与神经模型竞争。但它显示了搜索空间和端到端模型必须做出的决策。

### Step 3: using LLMs for coreference

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

两种值得关注的失败模式。首先，LLM过度合并（“他”和“她”指的是两个不同的人）。其次，LLM在长文档中默默地删除提及。始终通过翼展偏置检查进行验证。

### Step 4: evaluation

标准conll-2012脚本计算MUC、B³、CEAF-£ 4并报告平均值。对于内部评估，请从广度级别的精确度开始并回忆您的注释测试集，然后添加提及链接F1。

## Pitfalls

- **Singleton爆炸。**一些系统将每次提及报告为自己的集群。B³是宽大的。MUC对此进行了惩罚。始终检查所有三个指标。
- ** 长上下文中的代词。**超过2，000个令牌的文档的性能下降约15 F1。小心大块。
- ** 性别假设。**硬编码的性别规则打破了非二元参照物、组织、动物。使用习得的模型或中性评分。
- **LLM在长文档上漂移。**单个API调用无法可靠地将提及内容聚集在50多个段落中。使用滑动窗口+合并。

## Use It

2026年堆栈：

| 情况 | 接 |
|-----------|------|
| 英语，单一文档 | ' en_coreference_web_trf '（spaCy-实验性）或AllenNLP神经核心参考 |
| 多语言 | SpanBERT / XLM-R接受OntoNote或多语言CoNLL培训 |
| 跨文档事件核心参考 | 专业的端到端型号（2025-26 SOTA） |
| 快速LLM基线 | GPT-4 o/ Claude，具有结构化输出coref提示符 |
| 生产对话系统 | 基于规则的后备+神经初级+关键插槽手动审查 |

2026年发布的集成模式：首先运行NER，运行coref，将coref集群合并到NER实体中。下游任务看到每个集群一个实体，而不是每个提及一个实体。

## Ship It

另存为“输出/skill-coref-picker.md”：

```markdown
---
name: coref-picker
description: Pick a coreference approach, evaluation plan, and integration strategy.
version: 1.0.0
phase: 5
lesson: 24
tags: [nlp, coref, information-extraction]
---

Given a use case (single-doc / multi-doc, domain, language), output:

1. Approach. Rule-based / neural span-based / LLM-prompted / hybrid. One-sentence reason.
2. Model. Named checkpoint if neural.
3. Integration. Order of operations: tokenize → NER → coref → downstream task.
4. Evaluation. CoNLL F1 (MUC + B³ + CEAF-φ4 average) on held-out set + manual cluster review on 20 documents.

Refuse LLM-only coref for documents over 2,000 tokens without sliding-window merge. Refuse any pipeline that runs coref without a mention-level precision-recall report. Flag gender-heuristic systems deployed in demographically diverse text.
```

## Exercises

1. ** 简单。**在“code/main.py”中对5个手工制作的段落运行基于规则的解析器。根据实际情况衡量提及链接的准确性。
2. ** 中等。**在新闻文章中使用预先训练的神经核心模型。将集群与您自己的手动注释进行比较。哪里失败了？
3. ** 很难。**构建核心增强型NER管道：首先NER，然后通过核心集群合并。在100篇文章中衡量实体覆盖率与仅NER的改进。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 提到 | 参考 | 引用实体（名称、代词、名词短语）的文本范围。 |
| 先行词 | “它”指的是什么 | 较早的提及与较晚的提及有关。 |
| 集群 | 实体的提及 | 一组提及均指同一个现实世界实体。 |
| 回指 | 后方参照 | 后来提到的是指以前（“他”→“约翰”）。 |
| Cataphora | 前向参考 | 前面提到的是后来（“当他到达时，约翰.. "). |
| 桥接 | 隐式引用 | “我买了一辆车。轮子坏了。“（那辆车的轮子。） |
| 考恩LL F1 | 排行榜上的数字 | MUC、B³、CEAF-£ 4 F1得分的平均值。 |

## Further Reading

- [Jurafsky & Martin，SLP 3 Ch. 26 -共同参考决议和实体链接]（https：//web.stanford.edu/jurafsky/slp3/26.pdf）-规范教科书章节。
- [Lee等人（2017）。端到端神经共指解析]（https：//arxiv.org/ab/1707.07045）-基于跨度的端到端。
- [Joshi等人（2020）。SpanBERT]（https：//arxiv.org/ab/1907.10529）-改进coref的预训练。
- [Pradhan等人（2012）。CoNLL-2012共享任务]（https：//aclanthology.org/W12-4501/）-基准。
- [霍布斯（1978）。解析代词参考文献]（https：//www.sciencedirect.com/science/article/pii/0024384178900064）-基于规则的经典。
