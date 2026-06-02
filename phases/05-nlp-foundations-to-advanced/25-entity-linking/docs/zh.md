# 实体链接与消歧（Entity Linking & Disambiguation）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> NER 找到了 "Paris"。实体链接（entity linking）要决定：是法国巴黎？Paris Hilton？德州 Paris？还是特洛伊王子 Paris？没有链接，你的知识图谱就一直含糊不清。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 24 (Coreference Resolution)
**Time:** ~60 minutes

## 问题（The Problem）

一句话写着：「Jordan beat the press.」你的 NER 把 "Jordan" 标成 PERSON。很好。但*哪个* Jordan？

- Michael Jordan（篮球）？
- Michael B. Jordan（演员）？
- Michael I. Jordan（伯克利 ML 教授——是的，这种混淆在 ML 论文里真实存在）？
- Jordan（约旦这个国家）？
- Jordan（希伯来语名字）？

实体链接（Entity linking, EL）的任务是把每一个 mention 解析到知识库里唯一的一条条目：Wikidata、Wikipedia、DBpedia 或你自己的领域 KB。两个子任务：

1. **候选生成（Candidate generation）。** 给定 "Jordan"，KB 里哪些条目是合理候选？
2. **消歧（Disambiguation）。** 给定上下文，哪个候选才是对的？

两步都是可学习的，两步也都有 benchmark。整条 pipeline 的形态稳定了十年——变化的是消歧器（disambiguator）的质量。

## 概念（The Concept）

![Entity linking pipeline: mention → candidates → disambiguated entity](../assets/entity-linking.svg)

**候选生成。** 给定 mention 表层形式（"Jordan"），到别名索引（alias index）里查候选。Wikipedia 的别名词典覆盖了大部分命名实体："JFK" → John F. Kennedy、Jacqueline Kennedy、JFK 机场、电影 JFK。典型索引每个 mention 返回 10-30 个候选。

**消歧：三种思路。**

1. **先验 + 上下文（Milne & Witten, 2008）。** `P(entity | mention) × context-similarity(entity, text)`。效果不错，速度快，无需训练。
2. **基于 embedding（ESS / REL / Blink）。** 编码 mention + 上下文，编码每个候选的描述，取余弦最大者。这是 2020-2024 年的默认方案。
3. **生成式（GENRE, 2021；基于 LLM 的方法, 2023+）。** 逐 token 解码实体的规范名称（canonical name）。约束在合法实体名的 trie 上，确保输出一定是合法的 KB id。

**端到端 vs pipeline。** 现代模型（ELQ、BLINK、ExtEnD、GENRE）一遍过完成 NER + 候选生成 + 消歧。但生产环境里 pipeline 系统仍占主导，因为各组件可以单独替换。

### 两个度量

- **Mention recall（候选生成）。** 在 gold mention 中，正确 KB 条目出现在候选列表里的比例。这是整条 pipeline 的天花板下限。
- **消歧准确率 / F1。** 给定正确候选时，top-1 命中率是多少。

两者都要报告。一个候选 recall 80%、消歧 99% 的系统，整条 pipeline 也只有 80%。

## 动手实现（Build It）

### Step 1: build an alias index from Wikipedia redirects

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

Wikipedia 别名数据：约 1800 万条 (alias, entity) pair。从 Wikidata dump 下载，存为倒排索引。

### Step 2: context-based disambiguation

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

Jaccard 重叠只是个玩具版。换成 embedding 上的余弦相似度（看 `code/main.py` step-2 的 transformer 版本）。

### Step 3: embedding-based (BLINK-style)

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

建索引时把每个 KB 实体 embed 一次。查询时把 mention + 上下文 embed 一次，与候选池做点积，取最大值。

### Step 4: generative entity linking (concept)

GENRE 一字一字地解码实体的 Wikipedia 标题。约束解码（见 lesson 20）保证只能输出合法标题，并紧密集成 KB 支撑的 trie。它的现代后裔是 REL-GEN，以及通过结构化输出做 prompt 的 LLM-EL。

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

配合白名单（Outlines 的 `choice`），这就是 2026 年最容易上线的 EL pipeline。

### Step 5: evaluate on AIDA-CoNLL

AIDA-CoNLL 是 EL 的标准 benchmark：1393 篇路透社文章，3.4 万 mention，对接 Wikipedia 实体。报告 in-KB 准确率（`P@1`）和 out-of-KB 的 NIL 检出率。

## 陷阱（Pitfalls）

- **NIL 处理。** 有些 mention 不在 KB 里（新出现的实体、冷门人物）。系统必须预测 NIL 而不是硬猜一个错的实体。这个指标单独度量。
- **Mention 边界错误。** 上游 NER 漏掉部分 span（"Bank of America" 只标成 "Bank"），EL recall 跟着掉。
- **流行度偏差（Popularity bias）。** 训练出来的系统会过度预测高频实体。一篇 ML 论文里出现 "Michael I. Jordan"，常常被链到篮球的 Jordan。
- **跨语言 EL。** 把中文文本里的 mention 映射到英文 Wikipedia 实体。要么用多语言 encoder，要么加一步翻译。
- **KB 时效性。** 新公司、新事件、新人物不在去年的 Wikipedia dump 里。生产 pipeline 需要刷新循环（refresh loop）。

## 用起来（Use It）

2026 年的技术栈：

| 场景 | 选型 |
|-----------|------|
| 通用英文 + Wikipedia | BLINK 或 REL |
| 跨语言，KB = Wikipedia | mGENRE |
| 对 LLM 友好、每天 mention 量小 | prompt Claude/GPT-4 + 候选列表 + 约束 JSON |
| 领域 KB（医疗、法律） | 自定义 BERT，搭配 KB 感知的检索 + 在领域 AIDA 风格数据上 fine-tune |
| 极低延迟 | 仅用精确匹配先验（Milne-Witten 基线） |
| 研究 SOTA | GENRE / ExtEnD / 生成式 LLM-EL |

2026 年生产可上线的 pattern：NER → 共指（coref） → 对每个 mention 跑 EL → 把 cluster 折叠成每个 cluster 一个规范实体。最终输出：每篇文档里每个实体一个 KB id，而不是每个 mention 一个。

## 上线部署（Ship It）

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

1. **Easy.** 在 `code/main.py` 上对 10 个有歧义的 mention（Paris、Jordan、Apple）实现先验+上下文消歧器。手工标注正确实体，测准确率。
2. **Medium.** 用 sentence transformer 对 50 个有歧义的 mention 做编码，把每个候选的描述也 embed，对比基于 embedding 的消歧和 Jaccard 上下文重叠。
3. **Hard.** 构建一个 1k 实体的领域 KB（比如你公司的员工 + 产品），端到端实现 NER + EL，在 100 个 hold-out 句子上度量 precision 和 recall。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Entity linking (EL) | 链到 Wikipedia | 把一个 mention 映射到 KB 里唯一的条目。 |
| Candidate generation | 它可能是谁？ | 给一个 mention 返回若干合理 KB 条目候选。 |
| Disambiguation | 选对那个 | 用上下文给候选打分，挑赢家。 |
| Alias index | 那张查询表 | 表层形式 → 候选实体的映射。 |
| NIL | 不在 KB 里 | 显式预测「没有 KB 条目匹配」。 |
| KB | Knowledge base | Wikidata、Wikipedia、DBpedia 或你的领域 KB。 |
| AIDA-CoNLL | 那个 benchmark | 1393 篇路透社文章 + gold 实体链接。 |

## 延伸阅读（Further Reading）

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://www.cs.waikato.ac.nz/~ihw/papers/08-DM-IHW-LearningToLinkWithWikipedia.pdf) — 奠基的「先验+上下文」方法。
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) — 基于 embedding 的主力方案。
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) — 用约束解码做生成式 EL。
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) — benchmark 论文。
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) — 开源生产栈。
