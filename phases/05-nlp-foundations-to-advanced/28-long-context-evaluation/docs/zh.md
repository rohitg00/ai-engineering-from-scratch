# 28 · 长上下文评估——NIAH、RULER、LongBench、MRCR

> Gemini 3 Pro 宣传支持 10M token 的上下文。但在 1M token 时，8-needle MRCR 的得分跌到 26.3%。宣传值 ≠ 可用值。长上下文评估告诉你正在交付的模型的真实容量。

**类型：** 学习
**语言：** Python
**前置：** 阶段 5 · 13（问答）、阶段 5 · 23（分块策略）
**时长：** 约 60 分钟

## 问题所在

你有一份 200 页的合同。模型声称支持 1M token 的上下文。你把整份合同粘进去并提问：「终止条款是什么？」模型回答了——但它是依据封面页作答的，因为终止条款位于 120k token 的深处，超出了模型实际能注意到的范围。

这就是 2026 年的上下文容量鸿沟。规格表上写着 1M 或 10M。现实却是其中只有 60-70% 可用，而「可用」还取决于任务类型。

- **检索（haystack 中的单个 needle）：** 在前沿模型上，直到宣传的上限几乎都是完美的。
- **多跳 / 聚合：** 在大多数模型上，超过约 128k 后急剧退化。
- **对分散事实的推理：** 最先失败的任务。

长上下文评估正是衡量这些维度。本课会点名各个基准、说明每个基准实际衡量什么，以及如何为你的领域构建自定义的 needle 测试。

## 核心概念

〔图：NIAH 基线、RULER 多任务、LongBench 全面评估〕

**大海捞针（Needle-in-a-Haystack, NIAH，2023）。** 把一个事实（「魔法词是 pineapple」）放在长上下文中受控的深度上，要求模型把它检索出来。在深度 × 长度两个维度上扫描。这是最早的长上下文基准。前沿模型如今已经把它刷满；它是一个必要但不充分的基线。

**RULER（英伟达，2024）。** 涵盖 4 个类别的 13 种任务类型：检索（单键 / 多键 / 多值）、多跳追踪（变量追踪）、聚合（高频词频率）、问答（QA）。上下文长度可配置（4k 到 128k 以上）。它能揭示那些刷满 NIAH 却在多跳上失败的模型。在 2024 年的发布中，17 个声称支持 32k 以上上下文的模型里，只有一半能在 32k 处保持质量。

**LongBench v2（2024）。** 503 道多选题，上下文为 8k-2M 词，分为六个任务类别：单文档问答、多文档问答、长上下文学习、长对话、代码仓库、长结构化数据。这是衡量真实世界长上下文行为的生产级基准。

**MRCR（多轮共指消解，Multi-Round Coreference Resolution）。** 大规模的多轮共指。包含 8-needle、24-needle、100-needle 变体。它暴露出在注意力退化之前模型能同时周旋多少个事实。

**NoLiMa。** 「非词面 needle」。needle 与查询之间没有任何字面重叠；检索需要一步语义推理。比 NIAH 更难。

**HELMET。** 把许多文档拼接起来，再就其中任意一篇提问。考察选择性注意力。

**BABILong。** 把 bAbI 推理链嵌入无关的 haystack 中。考察的是 haystack 中的推理，而不仅仅是检索。

### 真正该上报哪些指标

- **宣传的上下文窗口。** 规格表上的数字。
- **有效检索长度。** NIAH 在某个阈值（例如 90%）下通过的长度。
- **有效推理长度。** 多跳或聚合任务在该阈值下通过的长度。
- **退化曲线。** 准确率随上下文长度的变化，按任务类型分别绘制。

为你的规格表准备两个数字：检索有效长度和推理有效长度。通常推理有效长度只有宣传窗口的 25-50%。

## 动手构建

### 步骤 1：为你的领域构建自定义 NIAH

参见 `code/main.py`。骨架如下：

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

    # 重复填充文本，直到长到足以填满 haystack 主体。
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

在 `depth_ratio` ∈ {0, 0.25, 0.5, 0.75, 1.0} × `total_tokens` ∈ {1k, 4k, 16k, 64k} 上扫描，绘制热力图。这就是你目标模型的 NIAH 评估卡片。

### 步骤 2：多 needle 变体

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

像「三个魔法词是什么？」这样的问题要求把三个都检索出来。单 needle 的成功并不能预测多 needle 的成功。

### 步骤 3：多跳变量追踪（RULER 风格）

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

答案需要把三次赋值串起来。前沿模型在 128k 处的准确率往往会跌到 50-70%。

### 步骤 4：在你的技术栈上跑 LongBench v2

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

按类别分别上报准确率。聚合后的总分会掩盖任务层面的巨大差异。

## 常见陷阱

- **只做 NIAH 评估。** 在 1M token 处通过 NIAH，并不能说明任何关于多跳的事情。务必同时跑 RULER 或自定义的多跳测试。
- **均匀深度采样。** 许多实现只测试 depth=0.5。请测试 depth=0、0.25、0.5、0.75、1.0——「迷失在中间（lost in the middle）」效应是真实存在的。
- **needle 与填充文本有词面重叠。** 如果 needle 与填充文本共享关键词，检索就变得轻而易举。请使用 NoLiMa 风格的无重叠 needle。
- **忽视延迟。** 1M token 的 prompt 需要 30-120 秒来预填充（prefill）。在衡量准确率的同时，也要衡量首 token 时延（time-to-first-token）。
- **厂商自报数字。** OpenAI、Google、Anthropic 都会公布自家的分数。务必针对你自己的使用场景独立地重新跑一遍。

## 实战运用

2026 年的技术栈：

| 场景 | 基准 |
|-----------|-----------|
| 快速健全性检查 | 自定义 NIAH，3 深度 × 3 长度 |
| 生产环境选型 | 在你的目标长度上跑 RULER（13 个任务） |
| 真实世界问答质量 | LongBench v2 single-doc-QA 子集 |
| 多跳推理 | BABILong 或自定义变量追踪 |
| 对话场景 | 在你的目标长度上跑 MRCR 8-needle |
| 模型升级回归 | 固定的内部 NIAH + RULER 评估套件，在每个新模型上运行 |

生产环境经验法则：在你打算使用的长度上跑过 NIAH + 1 个推理任务之前，永远不要信任一个上下文窗口。

## 交付物

保存为 `outputs/skill-long-context-eval.md`：

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

## 练习

1. **简单。** 构建一个 NIAH，3 个深度（0.25、0.5、0.75）× 3 个长度（1k、4k、16k）。在任意模型上运行。把通过率绘制成 3×3 的热力图。
2. **中等。** 加入一个 3-needle 变体。在每个长度上衡量三个 needle 全部被检索到的情况。将其与同一长度下的单 needle 通过率作比较。
3. **困难。** 构造一个变量追踪任务（X1 → X2 → X3，共 3 跳），嵌入 64k 的填充文本中。在 3 个前沿模型上衡量准确率。分别上报每个模型的有效推理长度。

## 关键术语

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| NIAH | 大海捞针 | 在填充文本中埋一个事实，要求模型把它检索出来。 |
| RULER | 加强版 NIAH | 涵盖检索 / 多跳 / 聚合 / 问答的 13 种任务类型。 |
| 有效上下文（Effective context） | 真实容量 | 准确率仍能保持在阈值之上的长度。 |
| 迷失在中间（Lost in the middle） | 深度偏置 | 模型对长输入中间部分的内容关注不足。 |
| 多 needle（Multi-needle） | 一次多个事实 | 埋入多个事实；考察注意力周旋能力，而不只是检索。 |
| MRCR | 多轮共指 | 8、24 或 100-needle 共指；暴露注意力饱和。 |
| NoLiMa | 非词面 needle | needle 与查询不共享任何字面 token；需要推理。 |

## 延伸阅读

- [Kamradt (2023). Needle in a Haystack analysis](https://github.com/gkamradt/LLMTest_NeedleInAHaystack) —— 最早的 NIAH 仓库。
- [Hsieh et al. (2024). RULER: What's the Real Context Size of Your Long-Context LMs?](https://arxiv.org/abs/2404.06654) —— 多任务基准。
- [Bai et al. (2024). LongBench v2](https://arxiv.org/abs/2412.15204) —— 真实世界长上下文评估。
- [Modarressi et al. (2024). NoLiMa: Non-lexical needles](https://arxiv.org/abs/2404.06666) —— 更难的 needle。
- [Kuratov et al. (2024). BABILong](https://arxiv.org/abs/2406.10149) —— haystack 中的推理。
- [Liu et al. (2024). Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) —— 深度偏置论文。
