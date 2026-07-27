# 实体链接与消歧（Entity Linking & Disambiguation）

> NER 找出了"Paris"。实体链接要决定：是法国巴黎？Paris Hilton？德克萨斯州的巴黎？还是特洛伊王子帕里斯？没有链接，你的知识图谱就始终是模糊的。

**类型：** Build（构建）
**语言：** Python
**前置要求：** 阶段 5 · 06（命名实体识别），阶段 5 · 24（共指消解）
**时间：** ~60 分钟

## 问题（The Problem）

一个句子写着："Jordan beat the press." 你的 NER 把"Jordan"标注为 PERSON。很好。但**哪个** Jordan？

- 迈克尔·乔丹（篮球运动员）？
- Michael B. Jordan（演员）？
- Michael I. Jordan（伯克利机器学习教授——没错，这种混淆在 ML 论文中真实存在）？
- 约旦（国家）？
- Jordan（希伯来语名字）？

实体链接（Entity Linking, EL）将每个指称解析为知识库中的唯一条目：Wikidata、Wikipedia、DBpedia 或你的领域知识库。包含两个子任务：

1. **候选生成（Candidate generation）。** 给定"Jordan"，哪些 KB 条目是合理的？
2. **消歧（Disambiguation）。** 给定上下文，哪个候选是正确的？

两个步骤都是可学习的，都有基准评测。这套组合流水线已经稳定了十年——变化的是消歧器的质量。

## 概念（The Concept）

![实体链接流水线：指称 → 候选 → 消歧后的实体](../assets/entity-linking.svg)

**候选生成。** 给定指称的文本形式（"Jordan"），在别名索引中查找候选。Wikipedia 别名词典覆盖了大多数命名实体："JFK" → 约翰·F·肯尼迪、杰奎琳·肯尼迪、JFK 机场、JFK（电影）。典型的索引对每个指称返回 10-30 个候选。

**消歧：三种方法。**

1. **先验 + 上下文（Milne & Witten, 2008）。** `P(实体 | 指称) × context-similarity(实体, 文本)`。效果好、速度快、无需训练。
2. **嵌入法（ESS / REL / Blink）。** 对指称 + 上下文进行编码。对每个候选的描述进行编码。选取最大余弦相似度。这是 2020-2024 年的默认方案。
3. **生成法（GENRE, 2021；基于 LLM, 2023+）。** 逐 token 解码实体的规范名称。受限于有效实体名称的字典树，保证输出是有效的 KB ID。

**端到端 vs 流水线。** 现代模型（ELQ、BLINK、ExtEnD、GENRE）在一个流程中完成 NER + 候选生成 + 消歧。管道式系统在生产中仍然占主导地位，因为你可以替换各个组件。

### 两个指标（The two measurements）

- **指称召回率（候选生成）。** 正确 KB 条目出现在候选列表中的黄金指称比例。这是整个流水线的下限。
- **消歧准确率 / F1。** 在候选正确的前提下，top-1 正确的频率。

**务必同时报告两者。** 一个在 80% 的候选召回率上达到 99% 消歧准确率的系统，实际的流水线表现是 80%。

## 动手构建（Build It）

### 步骤 1：从 Wikipedia 重定向构建别名索引（Step 1: build an alias index from Wikipedia redirects）

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

Wikipedia 别名数据：约 1800 万（别名，实体）对。从 Wikidata 转储下载，存储为倒排索引。

### 步骤 2：基于上下文的消歧（Step 2: context-based disambiguation）

```python
def disambiguate(mention, context, alias_index, entity_desc):
    candidates = alias_index.get(mention.lower(), [])
    if not candidates:
        return None, 0.0
    context_words = set(tokenize(context))
    best, best_score = None, -1
    for entity_id in candidates:
        desc_words = set(tokenize(entity_desc[entity_id]))
        union = len(context_words | desc_words)
        score = len(context_words & desc_words) / union if union else 0.0
        if score > best_score:
            best, best_score = entity_id, score
    return best, best_score
```

Jaccard 重叠只是一个玩具示例。请替换为基于嵌入的余弦相似度（参见 `code/main.py` 步骤 2 中的 transformer 版本）。

### 步骤 3：基于嵌入的方法（BLINK 风格）（Step 3: embedding-based (BLINK-style)）

```python
from sentence_transformers import SentenceTransformer
encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def embed_mention(text, mention_span):
    start, end = mention_span
    marked = f"{text[:start]} [MENTION] {text[start:end]} [/MENTION] {text[end:]}"
    return encoder.encode([marked], normalize_embeddings=True)[0]

def embed_entity(entity_id, description):
    return encoder.encode([f"{entity_id}: {description}"], normalize_embeddings=True)[0]
```

在索引构建时，对每个 KB 实体进行一次嵌入。在查询时，对指称 + 上下文进行一次嵌入，然后与候选池进行点积运算，选取最大值。

### 步骤 4：生成式实体链接（概念）（Step 4: generative entity linking (concept)）

GENRE 逐个字符地解码实体的 Wikipedia 标题。受约束解码（参见第 20 课）确保只能输出有效的标题。与基于 KB 的字典树紧密集成。现代的后继者是 REL-GEN 和基于 LLM 提示的带有结构化输出的 EL。

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

配合白名单（Outlines `choice`），这是 2026 年最容易上线的 EL 流水线。

### 步骤 5：在 AIDA-CoNLL 上评估（Step 5: evaluate on AIDA-CoNLL）

AIDA-CoNLL 是标准的 EL 基准数据集：包含 1,393 篇路透社文章、34,000 个指称、Wikipedia 实体。报告知识库内准确率（`P@1`）和知识库外 NIL 检测率。

## 陷阱（Pitfalls）

- **NIL 处理。** 有些指称不在知识库中（新兴实体、冷门人物）。系统必须预测 NIL 而不是猜测错误的实体。需单独测量。
- **指称边界错误。** 上游 NER 遗漏了部分片段（"Bank of America" 被标注为仅 "Bank"）。EL 召回率下降。
- **流行度偏差。** 训练后的模型会过度预测高频实体。一篇 ML 论文中提及的"Michael I. Jordan"往往被链接到篮球运动员乔丹。
- **跨语言 EL。** 将中文文本中的指称映射到英文 Wikipedia 实体。需要多语言编码器或翻译步骤。
- **知识库过时。** 新公司、新事件、新人物不在去年的 Wikipedia 转储中。生产流水线需要更新循环。

## 使用它（Use It）

2026 年的选型方案：

| 场景 | 推荐方案 |
|------|----------|
| 通用英语 + Wikipedia | BLINK 或 REL |
| 跨语言，KB = Wikipedia | mGENRE |
| LLM 友好，每日少量指称 | 用候选列表提示 Claude/GPT-4 + 受约束 JSON |
| 领域特定 KB（医疗、法律） | 自定义 BERT + KB 感知检索 + 在领域 AIDA 风格数据集上微调 |
| 极低延迟 | 仅精确匹配先验（Milne-Witten 基线） |
| 研究 SOTA | GENRE / ExtEnD / 生成式 LLM-EL |

2026 年可上线的生产模式：NER → 共指消解 → 对每个指称做 EL → 将集群坍缩为每个集群一个规范实体。输出：文档中每个实体一个 KB ID，而不是每个指称一个。

## 交付它（Ship It）

保存为 `outputs/skill-entity-linker.md`：

```markdown
---
name: entity-linker
description: Design an entity linking pipeline — KB, candidate generator, disambiguator, evaluation.
version: 1.0.0
phase: 5
lesson: 25
tags: [nlp, entity-linking, knowledge-graph]
---

Given a use case (domain KB, language, volume, latency budget), output:

1. Knowledge base. Wikidata / Wikipedia / custom KB. Version date. Refresh cadence.
2. Candidate generator. Alias-index, embedding, or hybrid. Target mention recall @ K.
3. Disambiguator. Prior + context, embedding-based, generative, or LLM-prompted.
4. NIL strategy. Threshold on top score, classifier, or explicit NIL candidate.
5. Evaluation. Mention recall @ 30, top-1 accuracy, NIL-detection F1 on held-out set.

Refuse any EL pipeline without a mention-recall baseline (you cannot evaluate a disambiguator without knowing candidate gen surfaced the right entity). Refuse any pipeline using LLM-prompted EL without constrained output to valid KB ids. Flag systems where popularity bias affects minority entities (e.g. name-clashes) without domain fine-tuning.
```

## 练习（Exercises）

1. **简单。** 在 `code/main.py` 中对 10 个有歧义的指称（Paris、Jordan、Apple）实现先验+上下文消歧器。手动标注正确的实体。测量准确率。
2. **中等。** 使用句子变换器对 50 个有歧义的指称进行编码。对每个候选的描述进行嵌入。比较基于嵌入的消歧与 Jaccard 上下文重叠。
3. **困难。** 构建一个包含 1,000 个实体的领域知识库（例如你所在公司的员工 + 产品）。实现端到端的 NER + EL。在 100 个保留句子上测量精确率和召回率。

## 关键术语（Key Terms）

| 术语 | 常被误解为 | 实际含义 |
|------|-----------|---------|
| 实体链接（Entity linking, EL） | 链接到 Wikipedia | 将指称映射到唯一的 KB 条目。 |
| 候选生成（Candidate generation） | 可能是谁？ | 返回一个简短的候选 KB 条目列表。 |
| 消歧（Disambiguation） | 选正确的那个 | 使用上下文对候选评分，选出胜者。 |
| 别名索引（Alias index） | 查找表 | 从词面形式映射到候选实体。 |
| NIL | 不在 KB 中 | 明确预测没有匹配的 KB 条目。 |
| KB | 知识库 | Wikidata、Wikipedia、DBpedia 或你的领域知识库。 |
| AIDA-CoNLL | 基准数据集 | 1,393 篇带有黄金实体链接标注的路透社文章。 |

## 延伸阅读（Further Reading）

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://www.cs.waikato.ac.nz/~ihw/papers/08-DM-IHW-LearningToLinkWithWikipedia.pdf) —— 先验+上下文方法的奠基之作。
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) —— 基于嵌入的主力模型。
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) —— 带有受约束解码的生成式 EL。
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) —— 基准论文。
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) —— 开源生产方案。
