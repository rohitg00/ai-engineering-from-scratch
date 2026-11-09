# 实体链接和含义不一致

> 没有链接,你的知识图仍然模糊.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 24 (Coreference Resolution)
**Time:** ~60 minutes

## 问题

没有人能说,你是个好人,但什么是乔丹?

- 迈克尔·乔丹 (篮球)?
- 迈克尔·B.乔丹 (演员)?
- ,在ML论文中,这种混乱是真的吗?
- 约旦 (这个国家)?
- 约旦 (希伯来语的姓氏)?

实体链接 (EL) 解决每个提及的知识库中的一个独特的输入:维基数据,维基百科,DBpedia或您的域名 KB.两个子任务:

1. **Candidate generation.**鉴于"约旦",哪些 KB 条目是可行的?
2. **Disambiguation.**根据环境,哪个候选人是合适的?

两步都可学习.两步都具有基准值. 合并管道已经稳定了十年.

## 概念

![Entity linking pipeline: mention → candidates → disambiguated entity](../assets/entity-linking.svg)

**Candidate generation.**鉴于提到的表格 ("约旦"),在一个名指数中查找候选人.维基百科名词典涵盖大多数命名实体:"JFK" →约翰·F.肯尼迪,杰克林·肯尼迪,JFK机场,JFK (电影).典型的索引每次提名返回10-30名候选人.

**Disambiguation: three approaches.**

1. **Prior + context (Milne & Witten, 2008).** `P(entity | mention) × context-similarity(entity, text)`工作很好,快,没有训练.
2. **Embedding-based (ESS / REL / Blink).**编码说明 + 文本.编码每个候选人的描述. 选择最大的代码. 2020-2024 默认.
3. **Generative (GENRE, 2021; LLM-based, 2023+).**限制在有效实体名称的三组,因此输出可以保证是有效的 KB ID.

**End-to-end vs pipeline.**现代型号 (ELQ,BLINK, ExtEnD, GENRE) 在一个通道中运行NER +候选生成 +解读.管道系统仍然占据了生产的地位,因为你可以交换组件.

### 两项测量

- **Mention recall (candidate gen).**黄金的部分是指在候选人名单中出现正确的 KB 输入.
- **Disambiguation accuracy / F1.**给出了正确的候选人,前一是正确的.

总是报道两者. 在80%的提名程序中, 99%的不确定性是80%的管道.

```figure
gx-entity-linking
```

## 建立它

### 步骤1:从维基百科转向构建一个别名索引

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

维基百科号数据: ~18M (号,实体) 对. 从维基百科号下载. 作为逆向索引存储.

### 步骤2:基于环境的置歧义

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

卡德重叠是一个玩具.`code/main.py`转变器版本的第二步).

### 步骤3:基于嵌入式 (BLINK式)

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

在索引时间,嵌入每个 KB 实体一次.在查询时间,嵌入提到 + 文本一次,点-产品与候选人池,选择最大.

### 阶段4:生成性实体连接 (概念)

GENRE 解码实体的维基百科标题字符字符.限制解码 (见20课) 确保只有有效的标题才能输出.与 KB 支持的试验组紧密集成.现代后代是REL-GEN和LLM 提示的EL,具有结构输出.

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

结合白色清单 (概况)`choice`),这是2026年发射最简单的电气管道.

### 步骤5:对AIDA-CoNLL进行评估

报告中KB准确性 (`P@1`) 和KB外的NIL检测率.

## 陷

- **NIL handling.**系统必须预测NIL而不是猜测错误的实体. 单独测量.
- **Mention boundary errors.**美国银行 (Bank of America) 仅仅是"银行"标记的部分时间.
- **Popularity bias.**训练有素的系统过度预测常见实体. 在 ML 论文上提到"迈克尔 I. 约旦"通常与篮球 约旦联系在一起.
- **Cross-lingual EL.**绘图中文提到英语维基百科实体.需要多语言编码器或翻译步骤.
- **KB staleness.**公司,活动,人才都不在去年的维基百科垃圾中.

## 用它

现在,我们要做什么?

| Situation | Pick |
|-----------|------|
| General-purpose English + Wikipedia | BLINK or REL |
| Cross-lingual, KB = Wikipedia | mGENRE |
| LLM-friendly, few mentions/day | Prompt Claude/GPT-4 with candidate list + constrained JSON |
| Domain-specific KB (medical, legal) | Custom BERT with KB-aware retrieval + fine-tune on domain AIDA-style set |
| Extremely low-latency | Exact-match prior only (Milne-Witten baseline) |
| Research SOTA | GENRE / ExtEnD / generative LLM-EL |

2026年发出的生产模式:每次提到的NER → coref → EL → 集群的崩至每集群的一个定律实体.输出:每一个文件中的实体的 KB id,而不是每一个提到的.

## 运送它

保存如`outputs/skill-entity-linker.md`其他:

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

## 运动

1. **Easy.**实现前文+文本分歧符号`code/main.py`标签正确的实体. 测量准确性.
2. **Medium.**编码50个模糊的提及,用句子变换器. 嵌入每个候选人的描述. 比较基于嵌入的模糊与Jaccard的背景重叠.
3. **Hard.**建立一个1k实体域 KB (例如您的公司的员工+产品). 实现NER+EL端到端. 测量100个延期的句子的精度和回忆.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Entity linking (EL) | Link to Wikipedia | Map a mention to a unique KB entry. |
| Candidate generation | Who could it be? | Return a shortlist of plausible KB entries for a mention. |
| Disambiguation | Pick the right one | Score candidates using context, pick the winner. |
| Alias index | The lookup table | Map from surface form → candidate entities. |
| NIL | Not in KB | Explicit prediction that no KB entry matches. |
| KB | Knowledge base | Wikidata, Wikipedia, DBpedia, or your domain KB. |
| AIDA-CoNLL | The benchmark | 1,393 Reuters articles with gold entity links. |

## 进一步阅读

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://researchcommons.waikato.ac.nz/entities/publication/b9a0b520-abc5-47c5-a86a-da6c579893ab)基础的前文+文本方法.
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814)基于嵌入式工作马.
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904)生成式EL,有限制解码.
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf)参考文件.
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969)开放生产堆.
