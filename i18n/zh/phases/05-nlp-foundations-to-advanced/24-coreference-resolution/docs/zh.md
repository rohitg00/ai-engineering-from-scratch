# 核心提议

> "她打电话给他,他没有回答.医生在午餐上".三次提到两个人,没有人被命名.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 07 (POS & Parsing)
**Time:** ~60 minutes

## 问题

简单地说"果".很难说"公司","他们","库珀蒂诺的科技巨头",或"就业公司".没有把这些提及解决给同一实体,你的NER管道会错过60-80%.

核心解析度将指同一实体的每个表达式连接到一个集群中. 它是表面级NLP (NER,解析) 和下游语义 (IE,QA,总结,KG) 之间的粘合物.

2026年为什么这很重要:

- 总结:"首席执行官宣布... "vs"蒂姆·库克宣布... " 总结应该命名首席执行官.
- 回答"她叫谁?"的问题需要解决"她".
- 信息提取:一个知识图表,其中"PER1创立了果"和"Jobs创立了果"作为单独的条目是错误的.
- 多文档IE:将有关同一事件的文章中的提到合并是跨文档核心参考.

## 概念

![Coreference clustering: mentions → entities](../assets/coref.svg)

**The task.**输入:一个文件.输出:一个指名 (范围) 的集群,其中每个集群指的是一个实体.

**Mention types.**

- **Named entity.**"蒂姆·库克"
- **Nominal.**"CEO", "公司"
- **Pronominal.**"他", "她", "他们", "它"
- **Appositive.**"果公司首席执行官蒂姆·库克,

**Architectures.**

1. **Rule-based (Hobbs, 1978).**语法规则的语法定量,基本线程很好,在代名词上难以击败.
2. **Mention-pair classifier.**对于每一对提及$(m_i, m_j)$根据过渡关闭, 标准在2016年之前.
3. **Mention-ranking.**对于每一个提及,排名候选人的前例 (包括"没有前例").
4. **Span-based end-to-end (Lee et al., 2017).**变压器编码器. 列出所有候选人跨度到长度限制. 预测提及分数. 预测每个跨度的前例概率. 贪地集群. 现代默认.
5. **Generative (2024+).**简单的案例,长文档和罕见的参考文件.

**The evaluation metrics.**报告前三项的平均值为CoNLL F1.2026年最新情况:CONLL-2012: ~83F1.

**Known hard cases.**

- 关于之前引入的页面的实体的确定的描述.
- 桥梁"轮子" →之前提到的汽车.
- 在中国和日本等语言中,无法.
- 形 (引用者之前的代名词):**she**走进来,玛丽笑了.

```figure
coref-links
```

## 建立它

### 步骤1:预训练的神经核心 (AllenNLP / spaCy-实验)

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said it would ship them soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

在更长的文件上,你得到了这样的东西:
- 集团1: [果,公司,它]
- 集团2:[新产品,它们]

### 步骤2:基于规则的代名词解决器 (教学)

看到`code/main.py`仅用于执行:

1. 提取提及:命名实体 (大写范围),代名词 (直观搜索),明确描述 ("X").
2. 对于每个代词,看看前面的K提及,并以:
   - 性别/数量协议 (理性)
   - 收获 (收获)
   - 语法作用 (优先专题)
3. 连接最高分的前例.

但它显示了搜索空间和一个端到端模型必须做出的决定.

### 步骤3:使用LLM为核心参考

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

两个失败模式可以观看.第一,LLM过度合并 ("他"和"她"指两个不同的人).第二,LLM默默地放弃长文档中的提及.总是通过跨度抵消检查验证.

### 步骤4:评估

标准 conll-2012 脚本计算MUC,B3,CEAF-φ4并报告平均值.为了进行内部评估,首先使用跨度级别精度,然后回忆出注释测试集,然后添加引用链接F1.

## 陷

- **Singleton explosion.**某些系统将每一个提到的数据都视为自己的集群.B3是宽松的.MUC惩罚了这件事.
- **Pronouns in long context.**在2000个代币以上的文件上,性能下降了15 F1.
- **Gender assumptions.**硬编码的性别规则违反了非二进制指标,组织,动物.
- **LLM drift on long docs.**单个API调用不能可靠地集群在50+段落中提到.使用滑动窗口+合并.

## 用它

现在,我们要做什么?

| Situation | Pick |
|-----------|------|
| English, single document | `en_coreference_web_trf` (spaCy-experimental) or AllenNLP neural coref |
| Multilingual | SpanBERT / XLM-R trained on OntoNotes or Multilingual CoNLL |
| Cross-document event coref | Specialized end-to-end models (2025–26 SOTA) |
| Quick LLM baseline | GPT-4o / Claude with structured-output coref prompt |
| Production dialog systems | Rule-based fallback + neural primary + manual review for critical slots |

2026年将出现的集成模式:首先运行NER,运行coref,将coref集群合并到NER实体. 下游任务每集群都会看到一个实体,而不是每一个实体.

## 运送它

保存如`outputs/skill-coref-picker.md`其他:

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

## 运动

1. **Easy.**运行基于规则的解决器`code/main.py`根据5个手工制成的段落, 根据基础的真相衡量引用链接的准确性.
2. **Medium.**根据你自己的手动注释,它失败了哪里?
3. **Hard.**建立一个核心增强的NER管道:首先是NER,然后是通过核心集群合并.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mention | A reference | A span of text that refers to an entity (name, pronoun, noun phrase). |
| Antecedent | What "it" refers to | The earlier mention a later one corefers with. |
| Cluster | The entity's mentions | Set of mentions that all refer to the same real-world entity. |
| Anaphora | Backward reference | Later mention refers to earlier ("he" → "John"). |
| Cataphora | Forward reference | Earlier mention refers to later ("When he arrived, John..."). |
| Bridging | Implicit reference | "I bought a car. The wheels were bad." (wheels of THAT car.) |
| CoNLL F1 | The number on leaderboards | Average of MUC, B³, CEAF-φ4 F1 scores. |

## 进一步阅读

- [Jurafsky & Martin, SLP3 Ch. 26 — Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/26.pdf)经典教科书章节.
- [Lee et al. (2017). End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045)基于跨度的端到端.
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529)预训练,以改善核心.
- [Pradhan et al. (2012). CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/)基准指数
- [Hobbs (1978). Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064)基于规则的经典.
