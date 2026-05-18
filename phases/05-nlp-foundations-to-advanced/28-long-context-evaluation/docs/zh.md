# Long-Context Evaluation — NIAH, RULER, LongBench, MRCR

> Gemini 3 Pro支持1000万上下文令牌。在100万个代币时，8针MRCR下降到26.3%。可拆卸的。长上下文评估告诉您正在运输的模型的实际容量。

** 类型：** 学习
** 语言：** Python
** 先决条件：** 阶段5 · 13（问题解答）、阶段5 · 23（分块策略）
** 时间：** ~60分钟

## The Problem

您有一份200页的合同。该模型声称1 M代币上下文。你把合同粘贴进去并问：“终止条款是什么？“模型给出了答案--但答案来自封面，因为终止条款深度为12万个代币，超出了模型实际参与的范围。

这就是2026年的环境容量差距。规格表显示1 M或10 M。现实表明，其中60-70%是可用的，而“可用”取决于任务。

- ** 检索（大海捞针）：** 近乎完美，达到前沿型号上宣传的最大值。
- ** 多跳/聚合：** 在大多数型号上急剧下降至~ 128 k以上。
- ** 对分散的事实进行推理：** 第一个失败的任务。

长背景评估衡量这些轴。本课列出了基准、每个基准实际测量的内容以及如何为您的领域构建自定义针测试。

## The Concept

![NIAH baseline, RULER multi-task, LongBench holistic](../assets/long-context-eval.svg)

** 干草堆里的针（NIAH，2023）。**将一个事实（“神奇的词是菠萝”）放在长背景下的受控深度上。要求模型检索它。扫描深度x长度。最初的长期背景基准。前沿模型现在已经饱和了这一点;这是一个必要但还不够的基线。

** 统治者（Nvidia，2024）。** 4个类别的13种任务类型：检索（单/多关键/多值）、多跳跟踪（可变跟踪）、聚合（常用词频）、QA。可配置上下文长度（4k至128 k+）。揭示了NIAH饱和但在多跳上失败的模型。在2024年的发布中，声称32 k+上下文的17款型号中，只有一半的质量保持在32 k。

**LongBench v2（2024）。** 503个选择题、8 k-2 M个单词上下文、六个任务类别：单文档QA、多文档QA、长上下文学习、长对话、代码存储、长结构化数据。现实世界长上下文行为的生产基准。

**MRCR（多轮共同参考决议）。**大规模多回合共指。8针、24针、100针变体。揭示了模型在注意力下降之前可以兼顾多少事实。

**NoLiMa。**“非词汇针。“指针和查询没有字面重叠;检索需要一步语义推理。比NIAH更难。

** 头盔。**将许多文档串在一起，向任何人提出问题。测试选择性注意力。

** BABILLong。**将bAbI推理链嵌入不相关的干草堆中。测试大海捞针推理，而不仅仅是检索。

### What to actually report

- ** 同步上下文窗口。**规格表编号。
- ** 有效检索长度。** NIAH在某个阈值上通过（例如，90%）。
- ** 有效推理长度。**多跳或聚合通过该阈值。
- ** 降解曲线。**准确性与上下文长度，按任务类型绘制。

规格表有两个数字：检索有效和推理有效。通常推理效率为广告窗口的25-50%。

## Build It

### Step 1: a custom NIAH for your domain

请参阅' code/main.py '。骨架：

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

扫描`depth_ratio` ∈ {0，0.25，0.5，0.75，1.0} × `total_tokens` ∈ {1k，4k，16k，64k}。绘制热图。这是您的目标型号的NIAH卡。

### Step 2: a multi-needle variant

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

诸如“这三个神奇的词是什么？“需要取回所有三个。单针成功并不能预测多针成功。

### Step 3: multi-hop variable tracing (RULER-style)

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

答案需要链接三项作业。128 k的Frontier模型在这里的准确率通常降至50-70%。

### Step 4: LongBench v2 on your stack

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

报告每个类别的准确性。总分数隐藏了任务级别的巨大差异。

## Pitfalls

- ** 仅限NIAH评估。**以100万代币通过NIAH并不能说明多跳。始终运行RULER或自定义多跳测试。
- ** 均匀深度采样。**许多实现仅测试深度=0.5。测试深度=0、0.25、0.5、0.75、1.0 -“中途迷失”效应是真实存在的。
- ** 词汇与填充物重叠。**如果针与填充者共享关键词，则检索变得微不足道。使用NoLiMa式非重叠针。
- ** 忽略延迟。** 1 M代币提示需要30-120秒才能预填充。测量到第一个令牌的时间以及准确性。
- ** 供应商自我报告的数字。** OpenAI、Google、Anthropic都发布了自己的分数。始终根据您的用例独立重新运行。

## Use It

2026年堆栈：

| 情况 | 基准 |
|-----------|-----------|
| 快速健全检查 | 定制NIAH，3个深度x 3个长度 |
| 生产型号选择 | 目标长度的尺子（13项任务） |
| 现实世界的QA质量 | LongBench v2单文档QA子集 |
| 多跳推理 | BABILong或自定义变量跟踪 |
| 对话/对话 | MRCR 8针处于目标长度 |
| 模型升级回归 | 固定内部NIAH + RULER背带，在每个新型号上运行 |

生产经验法则：在您按预期长度完成NIAH + 1推理任务之前，切勿相信上下文窗口。

## Ship It

另存为“输出/skill-long-context-eval.md”：

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

## Exercises

1. ** 简单。**构建具有3个深度（0.25、0.5、0.75）x 3个长度（1k、4k、16 k）的NIAH。在任何型号上运行。将通过率绘制为3 x 3热图。
2. ** 中等。**添加3针变体。测量每个长度上所有3个的检索。与相同长度的单针通过率相比。
3. ** 很难。**构建一个变量跟踪任务（X1 → X2 → X3，3跳），嵌入64k的填充器中。测量3个前沿模型的准确性。报告每个模型的有效推理长度。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| Niah | 大海捞针 | 在填充物中植入事实，要求模型检索它。 |
| 统治者 | NIAH服用类固醇 | 跨检索/多跳/聚合/ QA的13种任务类型。 |
| 有效上下文 | 实际能力 | 准确性仍保持在阈值以上的长度。 |
| 迷失在中间 | 深度偏差 | 模特们在长时间的投入中对内容关注不足。 |
| 多针 | 同时出现很多事实 | 多个植物;测试注意力兼顾，而不仅仅是检索。 |
| MRCR | 多轮核心参考 | 8、24或100针共指涉;暴露注意力饱和度。 |
| NoLiMa | 非词汇针 | 针和查询不共享字面符号;需要推理。 |

## Further Reading

- [Kamradt（2023）。Haystack分析中的针]（https：//github.com/gkamradt/LLMTest_NeedleInAHaystack）-原始的NIAH仓库。
- [Hsieh等人（2024）。统治者：您的长上下文LM的实际上下文大小是多少？]（https：//arxiv.org/abs/2404.06654）-多任务基准。
- [Bai等人（2024）。LongBench v2]（https：//arxiv.org/abs/2412.15204）-现实世界的长上下文评估。
- [Modarressi等人（2024）。NoLiMa：非词汇针]（https：//arxiv.org/ab/2404.06666）-更硬的针。
- [库拉托夫等人（2024）。BABILLong]（https：//arxiv.org/abs/2406.10149）-haystack推理。
- [Liu等人（2024）。迷失在中间：语言模型如何使用长上下文]（https：//arxiv.org/ab/2307.03172）-深度偏见论文。
