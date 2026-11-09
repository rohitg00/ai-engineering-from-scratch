# 长文本评估 NIAH,RULER,LongBench,MRCR

> 双子座3 Pro 广告10万语境代币.在1万代币时,8针MRCR下降到26.3%.广告可使用.长语境评估告诉你你运输的模型的实际容量.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 23 (Chunking Strategies)
**Time:** ~60 minutes

## 问题

您的合同是200页的.模型声称一个M代币的背景.您将合同粘贴到中并问:"终止条款是什么?"模型回答,但答案来自封面页面,因为终止条款位于120k代币深处,在模型实际上参加的地方之后.

实际情况说,60%至70%的空间可用,而"可用"取决于任务.

- **Retrieval (single needle in haystack):**接近完美,高于广告的极限车型.
- **Multi-hop / aggregation:**在大多数模型上,它会大幅降低到128k.
- **Reasoning over dispersed facts:**首先是失败的任务.

长文本评估测量这些轴. 这一课标识了基准,每个指标实际测量什么,以及如何为您的域构建一个定制的针测试.

## 概念

![NIAH baseline, RULER multi-task, LongBench holistic](../assets/long-context-eval.svg)

**Needle-in-a-Haystack (NIAH, 2023).**设置一个事实 ("魔术词是松") 在一个长文本中控制深度.请模型检索它.扫描深度 × 长度.原始长文本基准.边界模型现在化了这一点;这是必要的,但不够的基准.

**RULER (Nvidia, 2024).**检索 (单键/多键/多值),多跳跟踪 (变量跟踪),汇集 (通用词频率),QA.可配置的语境长度 (4k至 128k+). 揭示了充满NIAH但在多跳上失败的模型.在2024年发布中,仅有17种声称32k+语境的模型中一半保持了32k的质量.

**LongBench v2 (2024).**503个多选择问题,8k-2M字文本,六个任务类别:单文档QA,多文档QA,长文本学习,长对话,代码回复,长文本数据.

**MRCR (Multi-Round Coreference Resolution).**许多转向的核心指数,8针,24针,100针的变体, 展示模型在注意力降低之前可以道多少事实.

**NoLiMa.**"非语法针".针和查询没有字面上的重叠;检索需要一个步骤的语义推理.比NIAH更难.

**HELMET.**考察了许多文件,向任何一个人提出问题,测试了选择性的注意力.

**BABILong.**试验在一堆草中推理,而不是仅仅检索.

### 实际上要报告什么

- **Advertised context window.**规格表号.
- **Effective retrieval length.**通过某个门 (例如90%).
- **Effective reasoning length.**通过多跳或聚合在这个门.
- **Degradation curve.**准确性与文本长度,按任务类型绘制.

总是是推理效率为广告窗口的25-50%.

```figure
gx-niah-decay
```

## 建立它

### 步骤1:为您的域名进行定制NIAH

看到`code/main.py`骨架:

```python
def build_haystack(filler_text, needle, depth_ratio, total_tokens):
    if not (0.0 <= depth_ratio <= 1.0):
        raise ValueError(f"depth_ratio must be in [0, 1], got {depth_ratio}")
    if total_tokens <= 0:
        raise ValueError(f"total_tokens must be positive, got {total_tokens}")

    filler_tokens = tokenize(filler_text)
    needle_tokens = tokenize(needle)
    if not filler_tokens:
        raise ValueError("filler_text produced no tokens")

    # Repeat filler until long enough to fill the haystack body.
    body_len = max(total_tokens - len(needle_tokens), 0)
    while len(filler_tokens) < body_len:
        filler_tokens = filler_tokens + filler_tokens
    filler_tokens = filler_tokens[:body_len]

    insert_at = min(int(body_len * depth_ratio), body_len)
    haystack = filler_tokens[:insert_at] + needle_tokens + filler_tokens[insert_at:]
    return " ".join(haystack)


def score_niah(model, haystack, question, expected):
    answer = model.complete(f"Context: {haystack}\nQ: {question}\nA:", max_tokens=50)
    return 1 if expected.lower() in answer.lower() else 0
```

扫描`depth_ratio`∈ {0, 0.25, 0.5, 0.75, 1.0} × `total_tokens`图示热图,这是你的目标模型的NIAH卡.

### 步骤2:多针的变体

```python
def build_multi_needle(filler, needles, total_tokens):
    depths = [0.1, 0.4, 0.7]
    chunks = [filler[:int(total_tokens * 0.1)]]
    for depth, needle in zip(depths, needles):
        chunks.append(needle)
        next_chunk = filler[int(total_tokens * depth): int(total_tokens * (depth + 0.3))]
        chunks.append(next_chunk)
    return " ".join(chunks)
```

需要检索三种神奇词的答案. 一针成功并不能预测多针成功.

### 步骤3:多跳变量追踪 (RULER式)

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

边界模型的128k通常在50到70%的准确度下降.

### 步骤4: 长 v2 在你的堆上

```python
from datasets import load_dataset
longbench = load_dataset("THUDM/LongBench-v2")

def eval_model_on_longbench(model, subset="single-doc-qa"):
    tasks = [x for x in longbench["test"] if x["task"] == subset]
    correct = 0
    for x in tasks:
        answer = model.complete(x["context"] + "\n\nQ: " + x["question"], max_tokens=20)
        if normalize(answer) == normalize(x["answer"]):
            correct += 1
    return correct / len(tasks)
```

总分数隐藏了任务水平的巨大差异.

## 陷

- **NIAH-only evaluation.**通过NIAH的1M代币没有说明多跳.
- **Uniform depth sampling.**许多实现只测试深度=0.5.测试深度=0,0.25,0.5,0.75,1.0 "中途失落"效果是真实的.
- **Lexical overlap with filler.**如果针与填料共享关键字,则检索变得很微不足道. 使用NoLiMa式的非重叠针.
- **Ignoring latency.**预填需要30到120秒的时间,同时测量时间到首个代币.
- **Vendor-self-reported numbers.**开放AI,谷歌,人类都发布了自己的分数.

## 用它

现在,我们要做什么?

| Situation | Benchmark |
|-----------|-----------|
| Quick sanity check | Custom NIAH at 3 depths × 3 lengths |
| Model selection for production | RULER (13 tasks) at your target length |
| Real-world QA quality | LongBench v2 single-doc-QA subset |
| Multi-hop reasoning | BABILong or custom variable-tracing |
| Conversational / dialogue | MRCR 8-needle at your target length |
| Model upgrade regression | Fixed in-house NIAH + RULER harness, run on every new model |

生产的基本规则:除非您有NIAH+1推理任务,否则永远不要相信一个文本窗口.

## 运送它

保存如`outputs/skill-long-context-eval.md`其他:

```markdown
---
name: long-context-eval
description: Design a long-context evaluation battery for a given model and use case.
version: 1.0.0
phase: 5
lesson: 28
tags: [nlp, long-context, evaluation]
---

Given a target model, target context length, and use case, output:

1. Tests. NIAH depth × length grid; RULER multi-hop; custom domain task.
2. Sampling. Depths 0, 0.25, 0.5, 0.75, 1.0 at each length.
3. Metrics. Retrieval pass rate; reasoning pass rate; time-to-first-token; cost-per-query.
4. Cutoff. Effective retrieval length (90% pass) and effective reasoning length (70% pass). Report both.
5. Regression. Fixed harness, rerun on every model upgrade, surface deltas.

Refuse to trust a context window from the model card alone. Refuse NIAH-only evaluation for any multi-hop workload. Refuse vendor self-reported long-context scores as independent evidence.
```

## 运动

1. **Easy.**构建一个3深度 (0.25,0.5,0.75) ×3长度 (1k,4k,16k).运行在任何模型上. 插图通过速度作为3×3热地图.
2. **Medium.**添加一个3针的变体. 测量每个长度的3个. 进行同一长度的单针传递率.
3. **Hard.**构建一个嵌入于64k填充器中的变量追踪任务 (X1 → X2 → X3,有3个跳动).测量3个边界模型的准确性. 每个模型报告有效的推理长度.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NIAH | Needle in haystack | Plant a fact in filler, ask the model to retrieve it. |
| RULER | NIAH on steroids | 13 task types across retrieval / multi-hop / aggregation / QA. |
| Effective context | The real capacity | Length at which accuracy still holds above threshold. |
| Lost in the middle | Depth bias | Models under-attend to content in the middle of long inputs. |
| Multi-needle | Many facts at once | Multiple plants; tests attention juggling, not retrieval alone. |
| MRCR | Multi-round coref | 8, 24, or 100-needle coreference; exposes attention saturation. |
| NoLiMa | Non-lexical needle | Needle and query share no literal tokens; requires reasoning. |

## 进一步阅读

- [Kamradt (2023). Needle in a Haystack analysis](https://github.com/gkamradt/LLMTest_NeedleInAHaystack)原始的NIAH备忘录.
- [Hsieh et al. (2024). RULER: What's the Real Context Size of Your Long-Context LMs?](https://arxiv.org/abs/2404.06654)多任务基准.
- [Bai et al. (2024). LongBench v2](https://arxiv.org/abs/2412.15204)实世界长文本评估.
- [Modarressi et al. (2024). NoLiMa: Non-lexical needles](https://arxiv.org/abs/2404.06666)硬的针.
- [Kuratov et al. (2024). BABILong](https://arxiv.org/abs/2406.10149) 草中的推理.
- [Liu et al. (2024). Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172)深度偏差文件.
