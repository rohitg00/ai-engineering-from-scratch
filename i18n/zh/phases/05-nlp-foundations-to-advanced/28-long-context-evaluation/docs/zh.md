# 长上下文评估 — NIAH、RULER、LongBench、MRCR

> Gemini 3 Pro 宣称支持 10M token 的上下文。但在 1M token 时，8-needle MRCR 骤降至 26.3%。宣传值 ≠ 可用值。长上下文评估告诉你即将上线的模型的真实容量。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 13（问答），Phase 5 · 23（分块策略）
**Time:** ~60 分钟

## 问题所在

你有一份 200 页的合同。模型宣称拥有 1M token 的上下文。你把合同粘贴进去并提问：“终止条款是什么？”模型给出了回答——但答案来自封面页，因为终止条款位于 120k token 深处，超出了模型实际关注（attend）的范围。

这就是 2026 年的上下文容量鸿沟。规格表上写着 1M 或 10M。现实是其中 60-70% 可用，而且“可用”取决于任务。

- **检索（干草堆中的单根针）：** 前沿模型在标称最大长度内接近完美。
- **多跳 / 聚合：** 大多数模型在 ~128k 之后急剧退化。
- **对分散事实的推理：** 第一个失败的任务。

长上下文评估衡量这些维度。本课介绍这些基准、各自实际测量的内容，以及如何为你的领域构建自定义的“针”测试。

## 核心概念

![NIAH baseline, RULER multi-task, LongBench holistic](../assets/long-context-eval.svg)

**大海捞针（Needle-in-a-Haystack，NIAH，2023）。** 将一个事实（“魔法词是 pineapple”）放在长上下文中受控的深度处，要求模型检索它。遍历深度 × 长度。这是原始的长上下文基准。前沿模型如今已在此饱和；它是必要但不充分的基线。

**RULER（Nvidia，2024）。** 4 大类共 13 种任务类型：检索（单键 / 多键 / 多值）、多跳追踪（变量追踪）、聚合（常见词频）、问答。可配置上下文长度（4k 至 128k+）。揭示了那些在 NIAH 上饱和却在多跳上失败的模型。在 2024 年的发布中，17 个宣称支持 32k+ 上下文的模型中只有一半在 32k 时保持了质量。

**LongBench v2（2024）。** 503 道多选题，8k-2M 词的上下文，六大任务类别：单文档问答、多文档问答、长上下文学习、长对话、代码仓库、长结构化数据。这是面向真实世界长上下文行为的生产级基准。

**MRCR（Multi-Round Coreference Resolution，多轮共指消解）。** 大规模的多轮共指。有 8-needle、24-needle、100-needle 变体。它揭示了一个模型在注意力退化之前能同时处理多少事实。

**NoLiMa。** “非词法针。”针和查询之间没有字面重叠；检索需要一步语义推理。比 NIAH 更难。

**HELMET。** 拼接多份文档，从其中任意一份提问。测试选择性注意力。

**BABILong。** 将 bAbI 推理链嵌入无关的干草堆中。测试干草堆中的推理能力，而不仅是检索。

### 实际应当报告什么

- **标称上下文窗口。** 规格表上的数字。
- **有效检索长度。** NIAH 在某个阈值（如 90%）下的通过情况。
- **有效推理长度。** 多跳或聚合任务在该阈值下的通过情况。
- **退化曲线。** 准确率 vs 上下文长度，按任务类型分别绘制。

给规格表的两个数字：检索有效和推理有效。通常推理有效值是标称窗口的 25-50%。

```figure
gx-niah-decay
```

## 动手实现

### 第 1 步：为你的领域构建自定义 NIAH

见 `code/main.py`。骨架如下：

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

遍历 `depth_ratio` ∈ {0, 0.25, 0.5, 0.75, 1.0} × `total_tokens` ∈ {1k, 4k, 16k, 64k}。绘制热力图。这就是你的目标模型的 NIAH 卡片。

### 第 2 步：多针变体

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

诸如“三个魔法词是什么？”的问题需要检索全部三个。单针成功并不能预测多针成功。

### 第 3 步：多跳变量追踪（RULER 风格）

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

答案需要串联三次赋值。前沿模型在 128k 时在这里往往降至 50-70% 的准确率。

### 第 4 步：在你的技术栈上运行 LongBench v2

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

按类别分别报告准确率。聚合分数会掩盖巨大的任务级差异。

## 陷阱

- **仅用 NIAH 评估。** 在 1M token 上通过 NIAH 对多跳毫无说明。务必运行 RULER 或自定义多跳测试。
- **均匀深度采样。** 许多实现只测试 depth=0.5。要测试 depth=0、0.25、0.5、0.75、1.0——“lost in the middle”效应是真实存在的。
- **与填充内容的词法重叠。** 如果针与填充内容共享关键词，检索就变得微不足道。使用 NoLiMa 风格的非重叠针。
- **忽略延迟。** 1M token 的提示词预填充（prefill）需要 30-120 秒。在测准确率的同时测量首 token 时间。
- **厂商自报数字。** OpenAI、Google、Anthropic 都发布自己的分数。务必在你的用例上独立复现。

## 实践应用

2026 年的技术栈：

| 情形 | 基准 |
|-----------|-----------|
| 快速健全性检查 | 自定义 NIAH，3 深度 × 3 长度 |
| 生产模型选型 | RULER（13 任务），在你的目标长度 |
| 真实世界问答质量 | LongBench v2 单文档问答子集 |
| 多跳推理 | BABILong 或自定义变量追踪 |
| 会话 / 对话 | MRCR 8-needle，在你的目标长度 |
| 模型升级回归 | 固定的内部 NIAH + RULER 测试框架，每个新模型都运行 |

生产经验法则：在你按目标长度完成 NIAH + 1 项推理任务之前，永远不要相信一个上下文窗口。

## 交付

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

1. **简单。** 构建一个 NIAH，3 深度（0.25、0.5、0.75）× 3 长度（1k、4k、16k）。在任意模型上运行。以 3×3 热力图绘制通过率。
2. **中等。** 添加 3 针变体。测量每个长度下 3 针全部检索的情况。与同一长度下的单针通过率比较。
3. **困难。** 构造一个嵌入 64k 填充内容中的变量追踪任务（X1 → X2 → X3，3 跳）。测量 3 个前沿模型的准确率。报告每个模型的有效推理长度。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| NIAH | 干草堆中的针 | 在填充内容中植入事实，要求模型检索。 |
| RULER | 加强版 NIAH | 涵盖检索 / 多跳 / 聚合 / 问答的 13 种任务类型。 |
| 有效上下文 | 真实容量 | 准确率仍高于阈值时的长度。 |
| Lost in the middle | 深度偏差 | 模型对长输入中间内容的关注度不足。 |
| Multi-needle | 同时多个事实 | 多处植入；测试注意力的统筹能力，而非仅检索。 |
| MRCR | 多轮共指 | 8、24 或 100-needle 共指；揭示注意力饱和。 |
| NoLiMa | 非词法针 | 针与查询无共享字面 token；需要推理。 |

## 延伸阅读

- [Kamradt (2023). Needle in a Haystack analysis](https://github.com/gkamradt/LLMTest_NeedleInAHaystack) — 原始 NIAH 仓库。
- [Hsieh et al. (2024). RULER: What's the Real Context Size of Your Long-Context LMs?](https://arxiv.org/abs/2404.06654) — 多任务基准。
- [Bai et al. (2024). LongBench v2](https://arxiv.org/abs/2412.15204) — 真实世界长上下文评估。
- [Modarressi et al. (2024). NoLiMa: Non-lexical needles](https://arxiv.org/abs/2404.06666) — 更难的针。
- [Kuratov et al. (2024). BABILong](https://arxiv.org/abs/2406.10149) — 干草堆中的推理。
- [Liu et al. (2024). Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) — 深度偏差论文。