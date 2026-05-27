# 实体链接与消歧

> NER 找到了 "Paris"。实体链接决定：是法国巴黎？帕丽斯·希尔顿？德克萨斯州巴黎？还是（特洛伊王子）帕里斯？若不链接，你的知识图谱将一直处于含混状态。

**类型：** 构建  
**语言：** Python  
**前置条件：** 阶段 5 · 06 (NER)，阶段 5 · 24 (共指消解)  
**时间：** 约 60 分钟  

## 问题

一个句子写道："Jordan beat the press." 你的 NER 将 "Jordan" 标注为 PERSON。很好。但 *哪个* Jordan？

- Michael Jordan (篮球运动员)？
- Michael B. Jordan (演员)？
- Michael I. Jordan (伯克利机器学习教授——是的，这种混淆在 ML 论文中真实存在)？
- Jordan (国家)？
- Jordan (希伯来语名字)？

实体链接（Entity Linking, EL）将每个提及（mention）解析到知识库中的唯一条目：维基数据（Wikidata）、维基百科（Wikipedia）、DBpedia 或你的领域知识库。包含两个子任务：

1. **候选生成（Candidate generation）**。给定 "Jordan"，哪些知识库条目是合理的？
2. **消歧（Disambiguation）**。根据上下文，哪个候选才是正确的？

两个步骤都是可学习的，且都有基准评测。这个组合流水线已经稳定使用了十年——变化的是消歧器的质量。

## 概念

![实体链接流水线：提及 → 候选 → 消歧后的实体](../assets/entity-linking.svg)

**候选生成**。给定提及的表面形式 ("Jordan")，在别名索引（alias index）中查找候选。维基百科别名词典覆盖了大多数命名实体："JFK" → 约翰·F·肯尼迪、杰奎琳·肯尼迪、JFK 机场、电影《JFK》。典型索引每次提及返回 10–30 个候选。

**消歧：三种方法。**

1. **先验 + 上下文（Milne & Witten, 2008）**。`P(实体 | 提及) × 上下文相似度(实体, 文本)`。效果好、速度快、无需训练。
2. **基于嵌入（ESS / REL / Blink）**。对提及 + 上下文进行编码；对每个候选的描述进行编码；取最大余弦相似度。2020–2024 年的默认选择。
3. **生成式（GENRE, 2021；基于 LLM, 2023+）**。逐词解码实体的规范名称。受限于有效实体名称的字典树，确保输出是有效的知识库 ID。

**端到端 vs 流水线**。现代模型（ELQ、BLINK、ExtEnD、GENRE）将 NER + 候选生成 + 消歧一次性运行。流水线系统在生产环境中仍然占主导，因为你可以替换各个组件。

### 两个评估指标

- **提及召回率（候选生成）**：标准答案中正确知识库条目出现在候选列表中的比例。它是整个流水线的下限。
- **消歧准确率 / F1**：给定正确候选，top-1 正确的频率。

始终同时报告两者。一个消歧准确率 99% 但候选召回率只有 80% 的系统，实际流水线效果仅为 80%。

## 构建

### 步骤 1：从维基百科重定向构建别名索引

```python
alias_to_entities = {
    "jordan": ["Q41421 (迈克尔·乔丹)", "Q810 (约旦, 国家)", "Q254110 (迈克尔·B·乔丹)"],
    "paris":  ["Q90 (巴黎, 法国)", "Q663094 (巴黎, 德克萨斯州)", "Q55411 (帕丽斯·希尔顿)"],
    "apple":  ["Q312 (苹果公司)", "Q89 (苹果, 水果)"],
}
```

维基百科别名数据：约 1800 万 (别名, 实体) 对。从维基数据（Wikidata）转储下载，存储为倒排索引。

### 步骤 2：基于上下文的消歧

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

Jaccard 重叠只是一个玩具示例。用嵌入上的余弦相似度替换（见 `code/main.py` step-2 的 transformer 版本）。

### 步骤 3：基于嵌入（BLINK 风格）

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

在索引时，对每个知识库实体编码一次。在查询时，对提及 + 上下文编码一次，与候选池进行点积，选取最大值。

### 步骤 4：生成式实体链接（概念）

GENRE 逐字符解码实体的维基百科标题。约束解码（见第 20 课）确保只能输出有效标题。与知识库支持的字典树紧密集成。现代的延续是 REL-GEN 和基于 LLM 提示的 EL 结构化输出。

```python
prompt = f"""文本：{text}
提及：{mention}
列出此提及的最佳维基百科标题。
以 JSON 格式响应：{{"title": "..."}}"""
```

结合白名单（Outlines `choice`），这是 2026 年部署最简单的 EL 流水线。

### 步骤 5：在 AIDA-CoNLL 上评估

AIDA-CoNLL 是标准的 EL 基准：1393 篇路透社文章、34000 个提及、维基百科实体。报告知识库内准确率（`P@1`）和知识库外 NIL 检测率。

## 陷阱

- **NIL 处理**。有些提及不在知识库中（新兴实体、冷门人物）。系统必须预测 NIL，而不是猜测错误的实体。需单独评估。
- **提及边界错误**。上游 NER 漏掉了部分跨度（"Bank of America" 被标注为 "Bank"）。EL 召回率下降。
- **流行度偏差**。训练系统过度预测频繁实体。一篇机器学习论文中提及 "Michael I. Jordan" 常常链接到篮球乔丹。
- **跨语言 EL**。将中文文本中的提及映射到英文维基百科实体。需要多语言编码器或翻译步骤。
- **知识库陈旧**。新的公司、事件、人物不在去年的维基百科转储中。生产流水线需要刷新循环。

## 使用

2026 年的技术栈：

| 场景 | 选择 |
|------|------|
| 通用英语 + 维基百科 | BLINK 或 REL |
| 跨语言，知识库 = 维基百科 | mGENRE |
| 适合大语言模型，少量提及/天 | 使用候选列表 + 约束 JSON 提示 Claude/GPT-4 |
| 领域特定知识库（医学、法律） | 自定义 BERT + 基于知识库的检索 + 在领域 AIDA 风格数据集上微调 |
| 极低延迟 | 仅精确匹配先验（Milne-Witten 基线） |
| 研究 SOTA | GENRE / ExtEnD / 生成式 LLM-EL |

2026 年可部署的生产模式：NER → 共指消解 → 对每个提及进行 EL → 将聚类坍缩为每个聚类一个规范实体。输出：文档中每个实体一个知识库 ID，而非每个提及一个。

## 打包

保存为 `outputs/skill-entity-linker.md`：

```markdown
---
name: entity-linker
description: 设计一个实体链接流水线——知识库、候选生成器、消歧器、评估。
version: 1.0.0
phase: 5
lesson: 25
tags: [nlp, entity-linking, knowledge-graph]
---

给定一个用例（领域知识库、语言、数据量、延迟预算），输出：

1. 知识库。维基数据 / 维基百科 / 自定义知识库。版本日期。刷新周期。
2. 候选生成器。别名索引、嵌入或混合。目标提及召回率 @ K。
3. 消歧器。先验 + 上下文、基于嵌入、生成式或大语言模型提示。
4. NIL 策略。对最高分数设阈值、使用分类器或显式 NIL 候选。
5. 评估。提及召回率 @ 30、top-1 准确率、在保留集上的 NIL 检测 F1。

拒绝任何没有提及召回率基线的 EL 流水线（不知道候选生成是否找到了正确实体，就无法评估消歧器）。拒绝任何使用大语言模型提示式 EL 但不约束输出为有效知识库 ID 的流水线。标记那些流行度偏差影响少数实体（例如名称冲突）且无领域微调的系统。
```

## 练习

1. **简单**。在 `code/main.py` 中实现先验+上下文消歧器，使用 10 个有歧义的提及（Paris、Jordan、Apple）。手工标注正确的实体。测量准确率。
2. **中等**。用一个句子编码器（sentence transformer）对 50 个有歧义的提及进行编码。嵌入每个候选的描述。比较基于嵌入的消歧与 Jaccard 上下文重叠。
3. **困难**。构建一个包含 1000 个实体的领域知识库（例如你公司的员工 + 产品）。实现端到端的 NER + EL。在 100 个保留句子上测量精确率和召回率。

## 关键术语

| 术语 | 通俗说法 | 实际含义 |
|------|---------|---------|
| 实体链接 (EL) | 链接到维基百科 | 将提及映射到唯一的知识库条目。 |
| 候选生成 | 可能是谁？ | 返回一个提及的合理知识库条目短列表。 |
| 消歧 | 选择正确的那个 | 使用上下文对候选进行评分，选出胜者。 |
| 别名索引 | 查找表 | 从表面形式映射到候选实体。 |
| NIL | 不在知识库中 | 明确预测没有知识库条目匹配。 |
| KB | 知识库 | 维基数据、维基百科、DBpedia 或你的领域知识库。 |
| AIDA-CoNLL | 基准数据集 | 带有标注实体链接的 1393 篇路透社文章。 |

## 延伸阅读

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://www.cs.waikato.ac.nz/~ihw/papers/08-DM-IHW-LearningToLinkWithWikipedia.pdf) —— 先验+上下文的奠基之作。
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) —— 基于嵌入的主力方法。
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) —— 带约束解码的生成式 EL。
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) —— 基准论文。
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) —— 开源生产栈。