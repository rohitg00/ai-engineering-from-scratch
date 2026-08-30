# 25 · 实体链接与消歧

> 命名实体识别（NER）找到了「Paris」。实体链接则要决定：是法国巴黎（Paris, France）？是帕丽斯·希尔顿（Paris Hilton）？是德州的帕里斯（Paris, Texas）？还是（特洛伊王子）帕里斯（Paris）？没有链接，你的知识图谱就始终是模糊的。

**类型：** 实践构建
**语言：** Python
**前置：** 第 5 阶段 · 06（命名实体识别）、第 5 阶段 · 24（共指消解）
**时长：** 约 60 分钟

## 问题所在

有这样一句话：「Jordan beat the press.」你的 NER 把「Jordan」标记为 PERSON（人名）。很好。但到底是*哪个* Jordan？

- 迈克尔·乔丹（Michael Jordan，篮球）？
- 迈克尔·B·乔丹（Michael B. Jordan，演员）？
- 迈克尔·I·乔丹（Michael I. Jordan，伯克利的机器学习教授——是的，这种混淆在机器学习论文里真实存在）？
- 约旦（Jordan，这个国家）？
- 乔丹（Jordan，希伯来语名字）？

实体链接（Entity Linking，EL）将每一处提及（mention）解析到知识库中唯一的条目：Wikidata、Wikipedia、DBpedia，或你自己的领域知识库。它包含两个子任务：

1. **候选生成（candidate generation）。** 给定「Jordan」，哪些知识库条目是合理的候选？
2. **消歧（disambiguation）。** 给定上下文，哪个候选才是正确的那一个？

这两步都是可学习的，也都有基准测试。整个组合管线已经稳定了十年——真正在变化的是消歧器（disambiguator）的质量。

## 核心概念

〔图：实体链接管线：提及 → 候选 → 消歧后的实体〕

**候选生成。** 给定提及的表层形式（surface form，如「Jordan」），在别名索引（alias index）中查找候选。Wikipedia 的别名词典覆盖了绝大多数命名实体：「JFK」→ 约翰·F·肯尼迪（John F. Kennedy）、杰奎琳·肯尼迪（Jacqueline Kennedy）、JFK 机场、电影《刺杀肯尼迪》（JFK）。典型的索引每处提及会返回 10 到 30 个候选。

**消歧：三种方法。**

1. **先验 + 上下文（Milne 与 Witten，2008）。** `P(entity | mention) × context-similarity(entity, text)`。效果好、速度快、无需训练。
2. **基于嵌入（ESS / REL / Blink）。** 编码提及 + 上下文，再编码每个候选的描述，取余弦相似度最大者。这是 2020 至 2024 年的默认方案。
3. **生成式（GENRE，2021；基于大语言模型，2023 年起）。** 逐 token 解码出实体的规范名称。解码被约束在一棵由合法实体名构成的字典树（trie）上，因此输出必然是一个合法的知识库 id。

**端到端 vs 管线。** 现代模型（ELQ、BLINK、ExtEnD、GENRE）在一次推理中同时完成 NER + 候选生成 + 消歧。而管线式系统在生产环境中仍占主导，因为你可以单独替换其中的组件。

### 两项度量指标

- **提及召回率（候选生成）。** 在所有金标准（gold）提及中，正确知识库条目出现在候选列表里的比例。它是整条管线的天花板下限。
- **消歧准确率 / F1。** 在候选正确的前提下，top-1 命中正确的频率。

务必同时报告这两项指标。一个在 80% 候选召回率上做到 99% 消歧准确率的系统，整体也只是一条 80% 的管线。

## 动手构建

### 第 1 步：从 Wikipedia 重定向构建别名索引

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

Wikipedia 别名数据：约 1800 万对（别名，实体）。可从 Wikidata 转储中下载。以倒排索引（inverted index）形式存储。

### 第 2 步：基于上下文的消歧

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

这里的 Jaccard 重叠只是个玩具实现。请替换为基于嵌入的余弦相似度（Transformer 版本见 `code/main.py` 的 step-2）。

### 第 3 步：基于嵌入（BLINK 风格）

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

建索引时，对每个知识库实体编码一次。查询时，对提及 + 上下文编码一次，与候选池做点积，取最大值。

### 第 4 步：生成式实体链接（概念）

GENRE 会逐字符解码出实体的 Wikipedia 标题。受约束解码（constrained decoding，见第 20 课）确保只能输出合法的标题。它与一个由知识库支撑的字典树紧密集成。其现代后继者是 REL-GEN，以及借助结构化输出的、由大语言模型提示驱动的实体链接。

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

结合一份白名单（Outlines 的 `choice`），这就是 2026 年最容易上线的实体链接管线。

### 第 5 步：在 AIDA-CoNLL 上评估

AIDA-CoNLL 是标准的实体链接基准：1393 篇路透社文章、3.4 万处提及、Wikipedia 实体。报告知识库内准确率（`P@1`）和知识库外的 NIL 检测率。

## 陷阱

- **NIL 处理。** 有些提及并不在知识库中（新兴实体、冷门人物）。系统必须预测 NIL，而不是猜一个错误的实体。这一项要单独度量。
- **提及边界错误。** 上游 NER 漏掉部分跨度（把「Bank of America」只标成「Bank」）。实体链接的召回率随之下降。
- **流行度偏置。** 训练出来的系统会过度预测高频实体。一篇机器学习论文里对「Michael I. Jordan」的提及，往往会被链接到篮球运动员乔丹。
- **跨语言实体链接。** 把中文文本中的提及映射到英文 Wikipedia 实体。需要一个多语言编码器或一个翻译步骤。
- **知识库陈旧。** 新公司、新事件、新人物不会出现在去年的 Wikipedia 转储里。生产管线需要一套刷新循环。

## 实际运用

2026 年的技术栈：

| 场景 | 选型 |
|-----------|------|
| 通用英文 + Wikipedia | BLINK 或 REL |
| 跨语言，知识库 = Wikipedia | mGENRE |
| 适合大语言模型、每天提及量很少 | 用候选列表 + 受约束 JSON 提示 Claude/GPT-4 |
| 领域专用知识库（医疗、法律） | 自定义 BERT，配合知识库感知检索 + 在领域内的 AIDA 风格数据集上微调 |
| 极低延迟 | 仅用精确匹配先验（Milne-Witten 基线） |
| 研究 SOTA | GENRE / ExtEnD / 生成式 LLM-EL |

2026 年可上线的生产模式：NER → 共指消解 → 对每处提及做实体链接 → 把共指簇折叠为每簇一个规范实体。输出：文档中每个实体对应一个知识库 id，而非每处提及一个。

## 交付物

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

## 练习

1. **简单。** 在 `code/main.py` 中实现「先验 + 上下文」消歧器，针对 10 处歧义提及（Paris、Jordan、Apple）运行。手工标注正确实体，度量准确率。
2. **中等。** 用句子 Transformer 编码 50 处歧义提及。编码每个候选的描述。把基于嵌入的消歧与 Jaccard 上下文重叠做对比。
3. **困难。** 构建一个 1000 实体的领域知识库（例如你公司里的员工 + 产品）。端到端实现 NER + EL。在 100 句留出（held-out）句子上度量精确率和召回率。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 实体链接（Entity linking，EL） | 链接到 Wikipedia | 把一处提及映射到唯一的知识库条目。 |
| 候选生成（Candidate generation） | 它可能是谁？ | 为一处提及返回一份合理的知识库条目候选名单。 |
| 消歧（Disambiguation） | 挑出对的那个 | 用上下文给候选打分，选出胜者。 |
| 别名索引（Alias index） | 查找表 | 从表层形式 → 候选实体的映射。 |
| NIL | 不在知识库中 | 明确预测「没有任何知识库条目匹配」。 |
| KB | 知识库 | Wikidata、Wikipedia、DBpedia，或你的领域知识库。 |
| AIDA-CoNLL | 那个基准 | 1393 篇带金标准实体链接的路透社文章。 |

## 延伸阅读

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://www.cs.waikato.ac.nz/~ihw/papers/08-DM-IHW-LearningToLinkWithWikipedia.pdf) —— 奠基性的「先验 + 上下文」方法。
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) —— 基于嵌入的主力方案。
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) —— 采用受约束解码的生成式实体链接。
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) —— 基准论文。
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) —— 开源的生产技术栈。
