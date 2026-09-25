# 实体链接与消歧

> NER 找到了 "Paris。" 实体链接来决定：是法国巴黎？Paris Hilton？德克萨斯州 Paris？还是特洛伊王子 Paris?没有链接,你的知识图谱就始终有歧义。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 06 (NER)、Phase 5 · 24 (指代消解)
**Time:** 约 60 分钟

## 问题所在

一个句子:"Jordan beat the press." 你的 NER 将 "Jordan" 标注为 PERSON。很好。但*是哪个* Jordan?

- Michael Jordan(篮球运动员)?
- Michael B. Jordan(演员)?
- Michael I. Jordan(Berkeley 机器学习教授——是的,这种混淆在 ML 论文中真实存在)?
- Jordan(国家)?
- Jordan(希伯来语名字)?

实体链接(EL)将每个 mention 解析为知识库中的唯一条目:Wikidata、Wikipedia、DBpedia,或你所在领域的 KB。两个子任务:

1. **候选生成。** 给定 "Jordan",哪些 KB 条目是可能的?
2. **消歧。** 给定上下文,哪个候选是正确的?

两个步骤都是可学习的,都有基准测试。组合流水线十年来一直稳定——变化的是消歧器的质量。

## 核心概念

![Entity linking pipeline: mention → candidates → disambiguated entity](../assets/entity-linking.svg)

**候选生成。** 给定 mention 的表层形式("Jordan"),在别名索引中查找候选。Wikipedia 别名词典覆盖了大多数命名实体:"JFK" → John F. Kennedy、Jacqueline Kennedy、JFK 机场、JFK(电影)。典型索引每次查询返回 10-30 个候选。

**消歧:三种方法。**

1. **先验 + 上下文(Milne & Witten, 2008)。** `P(entity | mention) × context-similarity(entity, text)`。效果好、快、无需训练。
2. **基于嵌入(ESS / REL / Blink)。** 对 mention + 上下文进行编码。对每个候选的描述进行编码。取最大余弦相似度。2020-2024 年的默认方案。
3. **生成式(GENRE, 2021;基于 LLM, 2023+)。** 逐 token 解码实体的规范名称。约束在有效实体名称的 trie 上,因此输出保证是有效的 KB id。

**端到端 vs 流水线。** 现代模型(ELQ、BLINK、ExtEnD、GENRE)在一次前向中运行 NER + 候选生成 + 消歧。流水线系统在生产环境中仍占主导,因为你可以替换组件。

### 两个度量指标

- **Mention 召回率(候选生成)。** 正确的 KB 条目出现在候选列表中的黄金 mention 比例。这是整个流水线的下限。
- **消歧准确率 / F1。** 给定正确候选,top-1 正确的频率。

始终同时报告两者。一个在 80% 候选召回率上达到 99% 消歧准确率的系统,整体就是一个 80% 的流水线。

```figure
gx-entity-linking
```

## 动手实现

### 步骤 1:从 Wikipedia 重定向构建别名索引

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

Wikipedia 别名数据:约 1800 万个(别名, 实体)对。从 Wikidata dumps 下载。存储为倒排索引。

### 步骤 2:基于上下文的消歧

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

Jaccard 重叠只是一个玩具。请替换为基于嵌入的余弦相似度(transformer 版本见 `code/main.py` 的步骤 2)。

### 步骤 3:基于嵌入的方法(BLINK 风格)

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

在索引时,对每个 KB 实体嵌入一次。在查询时,对 mention + 上下文嵌入一次,与候选池做点积,取最大值。

### 步骤 4:生成式实体链接(概念)

GENRE 逐字符解码实体的 Wikipedia 标题。约束解码(见第 20 课)确保只能输出有效的标题。与 KB 支持的 trie 紧密集成。其现代后继者是 REL-GEN 以及带结构化输出的 LLM 提示式 EL。

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

结合白名单(Outlines `choice`),这是 2026 年最简单、可上线的 EL 流水线。

### 步骤 5:在 AIDA-CoNLL 上评估

AIDA-CoNLL 是标准的 EL 基准:1,393 篇 Reuters 文章、3.4 万个 mention、Wikipedia 实体。报告 in-KB 准确率(`P@1`)和 out-of-KB NIL 检测率。

## 常见陷阱

- **NIL 处理。** 有些 mention 不在 KB 中(新出现的实体、冷门人物)。系统必须预测 NIL,而不是猜错实体。需要单独度量。
- **Mention 边界错误。** 上游 NER 漏掉部分跨度("Bank of America" 只被标注为 "Bank")。EL 召回率随之下降。
- **流行度偏差。** 训练后的系统倾向于过度预测高频实体。ML 论文中出现的 "Michael I. Jordan" 常被链接到篮球运动员 Jordan。
- **跨语言 EL。** 将中文文本中的 mention 映射到英文 Wikipedia 实体。需要多语言编码器或翻译步骤。
- **KB 过时。** 新公司、新事件、新人物不在去年的 Wikipedia dump 中。生产流水线需要刷新机制。

## 应用场景

2026 年的技术选型:

| 场景 | 选择 |
|-----------|------|
| 通用英文 + Wikipedia | BLINK 或 REL |
| 跨语言,KB = Wikipedia | mGENRE |
| LLM 友好,mention 少 | 用候选列表 + 约束 JSON 提示 Claude/GPT-4 |
| 领域 KB(医疗、法律) | 自定义 BERT + KB 感知检索 + 在领域 AIDA 风格数据集上微调 |
| 极低延迟 | 仅精确匹配先验(Milne-Witten 基线) |
| 研究 SOTA | GENRE / ExtEnD / 生成式 LLM-EL |

2026 年可上线的生产模式:NER → 指代消解 → 对每个 mention 做 EL → 将簇合并为每个簇一个规范实体。输出:文档中每个实体一个 KB id,而不是每个 mention 一个。

## 发布

保存为 `outputs/skill-entity-linker.md`:

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

1. **简单。** 在 `code/main.py` 上对 10 个有歧义的 mention(Paris、Jordan、Apple)实现先验+上下文消歧器。手工标注正确实体。测量准确率。
2. **中等。** 用句子 transformer 编码 50 个有歧义的 mention。对每个候选的描述进行嵌入。比较基于嵌入的消歧与 Jaccard 上下文重叠。
3. **困难。** 构建一个 1k 实体的领域 KB(例如贵公司的员工 + 产品)。端到端实现 NER + EL。在 100 个留出句子上测量精确率和召回率。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 实体链接(EL) | 链接到 Wikipedia | 将 mention 映射到唯一的 KB 条目。 |
| 候选生成 | 可能是谁? | 为一个 mention 返回一列可能的 KB 条目。 |
| 消歧 | 选对的那一个 | 用上下文对候选打分,选出胜者。 |
| 别名索引 | 查找表 | 从表层形式 → 候选实体的映射。 |
| NIL | 不在 KB 中 | 明确预测没有 KB 条目匹配。 |
| KB | 知识库 | Wikidata、Wikipedia、DBpedia,或你的领域 KB。 |
| AIDA-CoNLL | 基准数据集 | 1,393 篇带黄金实体链接的 Reuters 文章。 |

## 延伸阅读

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://www.cs.waikato.ac.nz/~ihw/papers/08-DM-IHW-LearningToLinkWithWikipedia.pdf) — 奠基性的先验+上下文方法。
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) — 基于嵌入的主力方案。
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) — 带约束解码的生成式 EL。
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) — 基准论文。
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) — 开源生产技术栈。