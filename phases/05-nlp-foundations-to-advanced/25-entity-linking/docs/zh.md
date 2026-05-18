# Entity Linking & Disambiguation

> NER发现“巴黎。“实体链接决定：法国巴黎？帕丽斯·希尔顿？德克萨斯州巴黎？帕丽斯（特洛伊王子）？如果没有链接，您的知识图谱就会保持模糊。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 06（NER）、阶段5 · 24（共同参考解决方案）
** 时间：** ~60分钟

## The Problem

一句话写道：“乔丹击败了媒体。“您的NER将“Jordan”标记为人员。好.但是 * 哪个 * 乔丹？

- 迈克尔·乔丹（篮球）？
- Michael B.乔丹（演员）？
- 迈克尔一世Jordan（伯克利ML教授-是的，这种混乱在ML论文中是真实存在的）？
- 约旦（国家）？
- 约旦（希伯来语的名字）？

实体链接（EL）将每个提及解析为知识库中的唯一条目：维基数据、维基百科、DBpedia或您的域KB。两个子任务：

1. ** 候选人一代。**给定“Jordan”，哪些KB条目是合理的？
2. ** 消除歧义。**鉴于背景，哪位候选人是正确的？

这两个步骤都是可以学习的。两者都是基准。合并后的管道已经稳定了十年--变化的是消除歧义器的质量。

## The Concept

![Entity linking pipeline: mention → candidates → disambiguated entity](../assets/entity-linking.svg)

** 候选人一代。**给定提及表面形式（“Jordan”），在别名索引中查找候选项。维基百科别名词典涵盖大多数命名实体：“JFK”-John F.肯尼迪，杰奎琳·肯尼迪，肯尼迪机场，肯尼迪（电影）。典型指数每次提及返回10-30个候选人。

** 歧义消除：三种方法。**

1. ** 先验+背景（Milne & Witten，2008）。** `P（实体|提及）×上下文相似性（实体，文本）`。工作很好，快速，没有训练。
2. ** 基于嵌入（ESS / REL / Blink）。**编码提及+上下文。对每个候选人的描述进行编码。选择最大余弦。2020-2024年默认。
3. **Generative（GENRE，2021年;法学硕士，2023年+）。**逐代币解码实体的规范名称。限制于一系列有效实体名称，因此输出保证是有效的KB id。

** 端到端vs管道。**现代模型（ELQ、BLINK、ExtEnD、GENRE）一次运行NER +候选生成+歧义消除。管道系统仍然在生产中占据主导地位，因为您可以交换组件。

### The two measurements

- ** 提及召回（候选世代）。** Fraction of gold提到了正确的KB条目出现在候选列表中的位置。整个管道的地板。
- ** 歧义消除准确性/ F1。**假设正确的候选人，前1名正确的频率有多高。

始终报告两者。一个具有99%歧义消除率、80%候选人召回率的系统是一个80%的管道。

## Build It

### Step 1: build an alias index from Wikipedia redirects

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

维基百科别名数据：~ 18 M个（别名、实体）对。从维基数据转储下载。存储为倒置索引。

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

贾卡德重叠是一个玩具。替换为嵌入上的cos相似性（请参阅' code/main.py ' Step-2了解Transformer版本）。

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

在索引时，嵌入每个KB实体一次。在查询时，嵌入提及+上下文一次，针对候选人池进行点积，选择最大值。

### Step 4: generative entity linking (concept)

GENRE逐字符解码实体的维基百科标题。约束解码（参见第20课）确保仅输出有效的标题。与KB支持的Trie紧密集成。现代后裔是CLAR-GER和LLM提示的EL，具有结构化输出。

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

结合白名单（概述“选择”），这是2026年发货的最简单的EL管道。

### Step 5: evaluate on AIDA-CoNLL

AIDA-CoNLL是标准EL基准：1，393篇路透社文章，34，000篇提及，维基百科实体。报告KB内准确性（' P@1 '）和KB外NIL检测率。

## Pitfalls

- ** 无处理。**有些提及不在知识库中（新兴实体、默默无闻的人）。系统必须预测NIL，而不是猜测错误的实体。单独测量。
- ** 提及边界错误。**上游NER错过了部分跨度（“美国银行”仅标记为“银行”）。EL召回下降。
- ** 流行偏见。**训练有素的系统过度预测频繁实体。提到“迈克尔一世。ML论文上的“Jordan”通常链接到篮球Jordan。
- ** 跨语言EL。**将中文文本中的提及映射到英文维基百科实体。需要多语言编码器或翻译步骤。
- **KB陈旧。**去年的维基百科垃圾中没有出现新公司、新事件、新人物。生产管道需要更新循环。

## Use It

2026年堆栈：

| 情况 | 接 |
|-----------|------|
| 通用英语+维基百科 | 眨眼或真实 |
| 跨语言，KB =维基百科 | mGENRE |
| LLM友好，很少提及/天 | 提示Claude/GPT-4以及候选人列表+受约束的杨森 |
| 特定领域的知识库（医疗、法律） | 自定义BERT，具有KB感知检索+对域AID风格集进行微调 |
| 极低延迟 | 仅限之前精确匹配（米尔恩-威滕基线） |
| 研究SOTA | GENRE / ExtEnD / generative LLM-EL |

2026年推出的生产模式：NER-coref-每次提及时EL-将集群折叠为每个集群一个规范实体。输出：文档中的每个实体一个KB id，而不是每次提及一个KB id。

## Ship It

另存为“输出/skill-entity-linker.md”：

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

## Exercises

1. ** 简单。**在“code/main.py”中对10个模棱两可的提及（巴黎、约旦、苹果）实施previous +context消除歧义器。手工标记正确的实体。测量准确性。
2. ** 中等。**使用句子Transformer对50个模棱两可的提及进行编码。嵌入每个候选人的描述。将基于嵌入的消歧与Jaccard上下文重叠进行比较。
3. ** 很难。**构建1 k实体域KB（例如您公司中的员工+产品）。端到端实施NER + EL。测量100个已发表的句子的准确性和召回率。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 实体链接（EL） | 链接到维基百科 | 将提及映射到唯一的KB条目。 |
| 候选生成 | 会是谁？ | 返回看似合理的KB条目的入围列表以供提及。 |
| 消歧 | 选择正确的 | 使用上下文对候选人进行评分，选出获胜者。 |
| 收件箱指数 | 查找表 | 从表面形式映射到候选实体。 |
| 无 | 不在KB中 | 明确预测没有KB条目匹配。 |
| KB | 知识库 | 维基数据、维基百科、DBpedia或您的域KB。 |
| AIDA-CONLL | 基准 | 1，393篇带有黄金实体链接的路透社文章。 |

## Further Reading

- [Milne，Witten（2008）。学习与维基百科链接]（https：//www.cs.waikato.ac.nz/guardihw/papers/08-DM-IHW-LearningToLinkWithWikipedia.pdf）-基础的先验+上下文方法。
- [Wu等人（2020）。零镜头实体与密集实体检索链接（BLINK）]（https：//arxiv.org/ab/1911.03814）-基于嵌入的主力。
- [De Cao等人（2021）。自回归实体检索（GENRE）]（https：//arxiv.org/ab/2010.00904）-具有约束解码的生成EL。
- [Hoffart等人（2011）。文本中命名实体的稳健歧义消除（AIDA）]（https：//www.aclweb.org/anthology/D11-1072.pdf）-基准论文。
- [REL：站在巨人肩上的实体链接者（2020）]（https：//arxiv.org/ab/2006.01969）-开放生产堆栈。
