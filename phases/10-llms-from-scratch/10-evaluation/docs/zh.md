# 评估：基准测试、评测与 LM Harness

> 古德哈特定律：当一项指标成为目标时，它就不再是好的指标。每个前沿实验室都在操纵基准测试。MMLU 分数上升，而模型仍然无法可靠地数出 "strawberry" 中有多少个 R。唯一重要的评估是**你的**评估——在**你的**任务上，用**你的**数据。

**类型：** 构建
**语言：** Python
**前置要求：** 第 10 阶段，第 01-05 课（从零构建 LLM）
**时间：** ~90 分钟

## 学习目标

- 构建一个自定义评估 harness，对语言模型运行多选题和开放式基准测试
- 解释为什么标准基准测试（MMLU、HumanEval）会饱和，无法区分前沿模型
- 使用适当的指标实现任务特定的评估：精确匹配、F1、BLEU 和 LLM-as-judge 评分
- 设计针对你特定用例的自定义评估套件，而不是仅依赖公共排行榜

## 问题

MMLU 于 2020 年发布，包含 57 个学科的 15,908 道题目。三年内，前沿模型就将其饱和。GPT-4 得分 86.4%。Claude 3 Opus 得分 86.8%。Llama 3 405B 得分 88.6%。排行榜压缩到 3 分的范围内，差异只是统计噪声，而非真正的能力差距。

与此同时，这些同样的模型在 10 岁孩子无需思考就能处理的任务上失败。Claude 3.5 Sonnet 在 MMLU 上得分 88.7%，最初却无法数出 "strawberry" 中的字母——这项任务不需要任何世界知识和推理，只需字符级迭代。HumanEval 用 164 道题目测试代码生成。模型得分 90%+，但仍会产生在初级开发者都能发现的边界情况上崩溃的代码。

基准测试性能与现实世界可靠性之间的差距是 LLM 评估的核心问题。基准测试告诉你模型在基准测试上的表现。它们几乎不告诉你该模型在你的特定任务上、用你的特定数据、在你的特定失败模式下会如何表现。如果你正在构建客服机器人，MMLU 无关紧要。如果你正在构建代码助手，HumanEval 只覆盖函数级生成——它完全不涉及跨文件的调试、重构或代码解释。

你需要自定义评估。不是因为基准测试没用——它们对粗略的模型选择有用——而是因为最终评估必须完全匹配你的部署条件。

## 核心概念

### 评估全景

评估有三类，每类有不同的成本和信号质量。

**基准测试**是标准化测试套件。MMLU、HumanEval、SWE-bench、MATH、ARC、HellaSwag。你在基准测试上运行模型并获得分数。优势：每个人都用同样的测试，所以你可以比较模型。劣势：模型和训练数据越来越多地污染这些基准测试。实验室在包含基准题目的数据上训练。分数上升。能力可能并未提升。

**自定义评估**是你为特定用例构建的测试套件。你定义输入、预期输出和评分函数。法律文档摘要器用法律文档评估。SQL 生成器用你的数据库 schema 评估。这些创建成本高，但它们是唯一能预测生产性能的评估。

**人类评估**使用付费标注员根据有用性、正确性、流畅性和安全性等标准评判模型输出。开放式任务中自动评分失败时的黄金标准。Chatbot Arena 已收集超过 200 万条人类偏好投票，覆盖 100+ 模型。缺点：成本（每次评判 $0.10-$2.00）和速度（数小时到数天）。

```mermaid
graph TD
    subgraph Eval["评估全景"]
        direction LR
        B["基准测试\n(MMLU, HumanEval)\n便宜、标准化\n可操纵、过时"]
        C["自定义评估\n你的任务、你的数据\n最高信号\n构建昂贵"]
        H["人类评估\n(Chatbot Arena)\n黄金标准\n慢、贵"]
    end

    B -->|"粗略模型选择"| C
    C -->|"模糊案例"| H

    style B fill:#1a1a2e,stroke:#ffa500,color:#fff
    style C fill:#1a1a2e,stroke:#51cf66,color:#fff
    style H fill:#1a1a2e,stroke:#e94560,color:#fff
```

### 为什么基准测试会失效

三种机制导致基准测试分数停止反映真实能力。

**数据污染。** 训练语料从互联网抓取。基准测试题目存在于互联网上。模型在训练期间看到了答案。这不是传统意义上的作弊——实验室并非有意包含基准数据。但网络规模的抓取几乎不可能排除这些内容。

**应试教学。** 实验室为基准测试性能优化训练混合。如果训练混合的 5% 是 MMLU 风格的多选题，模型就学会了格式和答案分布。MMLU 是 4 选 1。模型学到答案分布在 A/B/C/D 上大致均匀，这即使模型不知道答案也有帮助。

**饱和。** 当每个前沿模型在某个基准上得分 85-90% 时，该基准就失去了区分力。剩余 10-15% 的题目可能是模糊的、标注错误的，或需要冷门的领域知识。在 MMLU 上从 87% 提升到 89% 可能意味着模型多记住了两道冷门题目，而非变得更聪明。

### 困惑度：快速健康检查

困惑度衡量模型对一系列 token 的惊讶程度。形式上，它是指数化的平均负对数似然：

```
PPL = exp(-1/N * sum(log P(token_i | context)))
```

困惑度为 10 意味着模型平均而言，在每个 token 位置上的不确定程度相当于在 10 个选项中均匀选择。越低越好。GPT-2 在 WikiText-103 上困惑度约为 30。GPT-3 约为 20。Llama 3 8B 约为 7。

困惑度在相同测试集上比较模型时有用，但它有盲点。模型可以通过擅长预测常见模式来获得低困惑度，同时在罕见但重要的模式上表现糟糕。它也不涉及指令遵循、推理或事实准确性。将其作为合理性检查，而非最终裁决。

### LLM-as-Judge

用强大的模型评估较弱模型的输出。想法很简单：让 GPT-4o 或 Claude Sonnet 按 1-5 分对响应的正确性、有用性和安全性进行评分。使用 GPT-4o-mini 每次评判约 $0.01，与人工评判的相关性出奇地高——大多数任务上约 80% 一致。

评分 prompt 比模型更重要。模糊的 prompt（"Rate this response"）产生嘈杂的分数。带有评分标准的结构化 prompt（"如果答案事实正确并引用来源则给 5 分，正确但未引用来源给 4 分，部分正确给 3 分……"）产生一致、可复现的分数。

失败模式：评判模型表现出位置偏差（在成对比较中偏好第一个响应）、冗长偏差（偏好更长的响应）和自我偏好（GPT-4 给 GPT-4 的输出评分高于等价的 Claude 输出）。缓解措施：随机化顺序、对长度进行归一化、使用与被评估模型不同的评判模型。

### 成对比较的 ELO 评分

Chatbot Arena 的方法。向人类（或 LLM 评判员）展示来自不同模型的对同一 prompt 的两个响应。选择更好的一个。从数千次这样的比较中，计算每个模型的 ELO 评分——与国际象棋使用的相同系统。

ELO 优势：相对排名比绝对评分更可靠，优雅地处理平局，并且比独立评分每个输出需要更少的比较就能收敛。截至 2026 年初，Chatbot Arena 排名显示 GPT-4o、Claude 3.5 Sonnet 和 Gemini 1.5 Pro 在顶部分差在 20 个 ELO 点以内。

```mermaid
graph LR
    subgraph ELO["ELO 评分流水线"]
        direction TB
        P["Prompt"] --> MA["模型 A 输出"]
        P --> MB["模型 B 输出"]
        MA --> J["评判员\n（人类或 LLM）"]
        MB --> J
        J --> W["A 赢 / B 赢 / 平局"]
        W --> E["ELO 更新\nK=32"]
    end

    style P fill:#1a1a2e,stroke:#0f3460,color:#fff
    style J fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#51cf66,color:#fff
```

### 评估框架

**lm-evaluation-harness** (EleutherAI)：标准的开源评估框架。支持 200+ 基准测试。用一条命令对任何 Hugging Face 模型运行 MMLU、HellaSwag、ARC 等。被 Open LLM Leaderboard 使用。

**RAGAS**：专门用于 RAG 流水线的评估框架。衡量忠实性（答案是否与检索到的上下文匹配？）、相关性（检索到的上下文是否与问题相关？）和答案正确性。

**promptfoo**：用于 prompt 工程的配置驱动评估。在 YAML 中定义测试用例，对多个模型运行，获得通过/失败报告。适用于 prompt 的回归测试——确保 prompt 更改不会破坏现有测试用例。

### 构建自定义评估

唯一对生产重要的评估。流程：

1. **定义任务。** 模型到底应该做什么？要精确。"回答问题"太模糊。"给定客户投诉邮件，提取产品名称、问题类别和情感"是一个你可以评估的任务。

2. **创建测试用例。** 原型评估最少 50 个，生产环境 200+。每个测试用例是（input, expected_output）对。包含边界情况：空输入、对抗性输入、模糊输入、其他语言的输入。

3. **定义评分。** 结构化输出用精确匹配。文本相似度用 BLEU/ROUGE。开放式质量用 LLM-as-judge。提取任务用 F1。用权重组合多个指标。

4. **自动化。** 每次评估用一条命令运行。没有手动步骤。以支持跨时间比较的格式存储结果。

5. **跟踪趋势。** 孤立的评估分数没有意义。你需要趋势线。上次 prompt 更改后分数提高了吗？切换模型后退化了吗？将评估与 prompt 一起版本化。

| 评估类型 | 每次评判成本 | 与人类一致性 | 最适合 |
|-----------|-------------|------------|--------|
| 精确匹配 | ~$0 | 100%（适用时） | 结构化输出、分类 |
| BLEU/ROUGE | ~$0 | ~60% | 翻译、摘要 |
| LLM-as-judge | ~$0.01 | ~80% | 开放式生成 |
| 人类评估 | $0.10-$2.00 | N/A（就是真理） | 模糊、高风险任务 |

## 构建

### 步骤 1：最小评估框架

定义核心抽象。评估用例包含输入、预期输出和可选的元数据字典。评分器接受预测和参考，返回 0 到 1 之间的分数。

```python
import json
from collections import Counter

class EvalCase:
    def __init__(self, input_text, expected, metadata=None):
        self.input_text = input_text
        self.expected = expected
        self.metadata = metadata or {}

class EvalSuite:
    def __init__(self, name, cases, scorers):
        self.name = name
        self.cases = cases
        self.scorers = scorers

    def run(self, model_fn):
        results = []
        for case in self.cases:
            prediction = model_fn(case.input_text)
            scores = {}
            for scorer_name, scorer_fn in self.scorers.items():
                scores[scorer_name] = scorer_fn(prediction, case.expected)
            results.append({
                "input": case.input_text,
                "expected": case.expected,
                "prediction": prediction,
                "scores": scores,
            })
        return results
```

### 步骤 2：评分函数

构建精确匹配、token F1 和模拟的 LLM-as-judge 评分器。

```python
def exact_match(prediction, expected):
    return 1.0 if prediction.strip().lower() == expected.strip().lower() else 0.0

def token_f1(prediction, expected):
    pred_tokens = set(prediction.lower().split())
    exp_tokens = set(expected.lower().split())
    if not pred_tokens or not exp_tokens:
        return 0.0
    common = pred_tokens & exp_tokens
    precision = len(common) / len(pred_tokens)
    recall = len(common) / len(exp_tokens)
    if precision + recall == 0:
        return 0.0
    return 2 * (precision * recall) / (precision + recall)

def llm_judge_simulated(prediction, expected):
    pred_words = set(prediction.lower().split())
    exp_words = set(expected.lower().split())
    if not exp_words:
        return 0.0
    overlap = len(pred_words & exp_words) / len(exp_words)
    length_penalty = min(1.0, len(prediction) / max(len(expected), 1))
    return round(overlap * 0.7 + length_penalty * 0.3, 3)
```

### 步骤 3：ELO 评分系统

用 ELO 更新实现成对比较。这正是 Chatbot Arena 用来排名模型的系统。

```python
class ELOTracker:
    def __init__(self, k=32, initial_rating=1500):
        self.ratings = {}
        self.k = k
        self.initial_rating = initial_rating
        self.history = []

    def _ensure_player(self, name):
        if name not in self.ratings:
            self.ratings[name] = self.initial_rating

    def expected_score(self, rating_a, rating_b):
        return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))

    def record_match(self, player_a, player_b, outcome):
        self._ensure_player(player_a)
        self._ensure_player(player_b)

        ea = self.expected_score(self.ratings[player_a], self.ratings[player_b])
        eb = 1 - ea

        if outcome == "a":
            sa, sb = 1.0, 0.0
        elif outcome == "b":
            sa, sb = 0.0, 1.0
        else:
            sa, sb = 0.5, 0.5

        self.ratings[player_a] += self.k * (sa - ea)
        self.ratings[player_b] += self.k * (sb - eb)

        self.history.append({
            "a": player_a, "b": player_b,
            "outcome": outcome,
            "rating_a": round(self.ratings[player_a], 1),
            "rating_b": round(self.ratings[player_b], 1),
        })

    def leaderboard(self):
        return sorted(self.ratings.items(), key=lambda x: -x[1])
```

### 步骤 4：困惑度计算

使用 token 概率计算困惑度。实践中你会从模型的 logits 获取这些。这里我们用概率分布模拟。

```python
import numpy as np

def perplexity(log_probs):
    if not log_probs:
        return float("inf")
    avg_neg_log_prob = -np.mean(log_probs)
    return float(np.exp(avg_neg_log_prob))

def token_log_probs_simulated(text, model_quality=0.8):
    np.random.seed(hash(text) % 2**31)
    tokens = text.split()
    log_probs = []
    for i, token in enumerate(tokens):
        base_prob = model_quality
        if len(token) > 8:
            base_prob *= 0.6
        if i == 0:
            base_prob *= 0.7
        prob = np.clip(base_prob + np.random.normal(0, 0.1), 0.01, 0.99)
        log_probs.append(float(np.log(prob)))
    return log_probs
```

### 步骤 5：汇总结果

计算评估运行的汇总统计：均值、中位数、阈值处的通过率，以及按指标细分。

```python
def summarize_results(results, threshold=0.8):
    all_scores = {}
    for r in results:
        for metric, score in r["scores"].items():
            all_scores.setdefault(metric, []).append(score)

    summary = {}
    for metric, scores in all_scores.items():
        arr = np.array(scores)
        summary[metric] = {
            "mean": round(float(np.mean(arr)), 3),
            "median": round(float(np.median(arr)), 3),
            "std": round(float(np.std(arr)), 3),
            "min": round(float(np.min(arr)), 3),
            "max": round(float(np.max(arr)), 3),
            "pass_rate": round(float(np.mean(arr >= threshold)), 3),
            "n": len(scores),
        }
    return summary

def print_summary(summary, suite_name="Eval"):
    print(f"\n{'=' * 60}")
    print(f"  {suite_name} Summary")
    print(f"{'=' * 60}")
    for metric, stats in summary.items():
        print(f"\n  {metric}:")
        print(f"    Mean:      {stats['mean']:.3f}")
        print(f"    Median:    {stats['median']:.3f}")
        print(f"    Std:       {stats['std']:.3f}")
        print(f"    Range:     [{stats['min']:.3f}, {stats['max']:.3f}]")
        print(f"    Pass rate: {stats['pass_rate']:.1%} (threshold >= 0.8)")
        print(f"    N:         {stats['n']}")
```

### 步骤 6：运行完整流水线

将所有内容组合在一起。定义任务、创建测试用例、模拟两个模型、运行评估、从成对比较计算 ELO，并打印排行榜。

```python
def demo_model_good(prompt):
    responses = {
        "What is the capital of France?": "Paris",
        "What is 2 + 2?": "4",
        "Who wrote Hamlet?": "William Shakespeare",
        "What language is PyTorch written in?": "Python and C++",
        "What is the boiling point of water?": "100 degrees Celsius",
    }
    return responses.get(prompt, "I don't know")

def demo_model_bad(prompt):
    responses = {
        "What is the capital of France?": "Paris is the capital city of France",
        "What is 2 + 2?": "The answer is four",
        "Who wrote Hamlet?": "Shakespeare",
        "What language is PyTorch written in?": "Python",
        "What is the boiling point of water?": "212 Fahrenheit",
    }
    return responses.get(prompt, "Unknown")

cases = [
    EvalCase("What is the capital of France?", "Paris"),
    EvalCase("What is 2 + 2?", "4"),
    EvalCase("Who wrote Hamlet?", "William Shakespeare"),
    EvalCase("What language is PyTorch written in?", "Python and C++"),
    EvalCase("What is the boiling point of water?", "100 degrees Celsius"),
]

suite = EvalSuite(
    name="General Knowledge",
    cases=cases,
    scorers={
        "exact_match": exact_match,
        "token_f1": token_f1,
        "llm_judge": llm_judge_simulated,
    },
)

results_good = suite.run(demo_model_good)
results_bad = suite.run(demo_model_bad)

print_summary(summarize_results(results_good), "Model A (concise)")
print_summary(summarize_results(results_bad), "Model B (verbose)")
```

"好"模型给出精确答案。"坏"模型给出冗长的改写。精确匹配严厉惩罚冗长模型。Token F1 和 LLM-as-judge 更宽容。这说明了为什么指标选择很重要：同一个模型根据你如何评分，看起来可能很棒或很糟糕。

### 步骤 7：ELO 锦标赛

在多轮中运行模型之间的成对比较。

```python
elo = ELOTracker(k=32)

for case in cases:
    pred_a = demo_model_good(case.input_text)
    pred_b = demo_model_bad(case.input_text)

    score_a = token_f1(pred_a, case.expected)
    score_b = token_f1(pred_b, case.expected)

    if score_a > score_b:
        outcome = "a"
    elif score_b > score_a:
        outcome = "b"
    else:
        outcome = "tie"

    elo.record_match("model_a_concise", "model_b_verbose", outcome)

print("\nELO Leaderboard:")
for name, rating in elo.leaderboard():
    print(f"  {name}: {rating:.0f}")
```

### 步骤 8：困惑度比较

比较不同质量水平的"模型"之间的困惑度。

```python
test_text = "The quick brown fox jumps over the lazy dog in the garden"

for quality, label in [(0.9, "Strong model"), (0.7, "Medium model"), (0.4, "Weak model")]:
    log_probs = token_log_probs_simulated(test_text, model_quality=quality)
    ppl = perplexity(log_probs)
    print(f"  {label} (quality={quality}): perplexity = {ppl:.2f}")
```

## 使用它

### lm-evaluation-harness (EleutherAI)

在任何模型上运行基准测试的标准工具。

```python
# pip install lm-eval
# 命令行:
# lm_eval --model hf --model_args pretrained=meta-llama/Llama-3.1-8B --tasks mmlu --batch_size 8

# Python API:
# import lm_eval
# results = lm_eval.simple_evaluate(
#     model="hf",
#     model_args="pretrained=meta-llama/Llama-3.1-8B",
#     tasks=["mmlu", "hellaswag", "arc_easy"],
#     batch_size=8,
# )
# print(results["results"])
```

### promptfoo

用于 prompt 工程的配置驱动评估。在 YAML 中定义测试，对多个 provider 运行。

```yaml
# promptfoo.yaml
providers:
  - openai:gpt-4o-mini
  - anthropic:claude-3-haiku

prompts:
  - "Answer in one word: {{question}}"

tests:
  - vars:
      question: "What is the capital of France?"
    assert:
      - type: contains
        value: "Paris"
  - vars:
      question: "What is 2 + 2?"
    assert:
      - type: equals
        value: "4"
```

### RAGAS 用于 RAG 评估

```python
# pip install ragas
# from ragas import evaluate
# from ragas.metrics import faithfulness, answer_relevancy, context_precision
#
# result = evaluate(
#     dataset,
#     metrics=[faithfulness, answer_relevancy, context_precision],
# )
# print(result)
```

RAGAS 衡量通用评估遗漏的内容：模型的答案是否基于检索到的上下文，而不仅仅是答案在抽象意义上是否"正确"。

## 交付

本课程生成 `outputs/prompt-eval-designer.md` —— 一个可复用的 prompt，为任何任务设计自定义评估套件。给它一个任务描述，它会生成测试用例、评分函数和通过/失败阈值建议。

它还生成 `outputs/skill-evaluation.md` —— 一个决策框架，根据你的任务类型、预算和延迟要求选择正确的评估策略。

## 练习

1. 添加一个"一致性"评分器，将相同输入通过模型运行 5 次，测量输出匹配的频率。确定性输入上的不一致答案揭示了脆弱的 prompt 或过高的 temperature 设置。

2. 扩展 ELO tracker 以支持多个评判函数（精确匹配、F1、LLM-as-judge）并对它们加权。比较当你重权精确匹配与重权 F1 时排行榜如何变化。

3. 为特定任务构建评估套件：将邮件分类到 5 个类别。创建 100 个测试用例，包含多样化示例，包括边界情况（可能属于多个类别的邮件、空邮件、其他语言的邮件）。测量不同"模型"（基于规则、关键词匹配、模拟 LLM）的表现。

4. 实现污染检测：给定一组评估问题和训练语料，检查评估问题（或近似改写）中有多少百分比出现在训练数据中。这是研究人员审计基准有效性的方法。

5. 构建一个"模型差异"工具。给定两个模型版本的评估结果，突出显示哪些特定测试用例改善了、哪些退化了、哪些保持不变。这是评估版本的代码差异等价物——对于理解更改是有帮助还是有害至关重要。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| MMLU | "那个基准测试" | Massive Multitask Language Understanding —— 57 个学科的 15,908 道多选题，到 2025 年已被饱和至 88% 以上 |
| HumanEval | "代码评估" | OpenAI 的 164 道 Python 函数补全题，仅测试独立函数生成 |
| SWE-bench | "真实编码评估" | 来自 12 个 Python 仓库的 2,294 个 GitHub issue，衡量端到端 bug 修复，包括测试生成 |
| 困惑度 | "模型有多困惑" | exp(-avg(log P(token_i given context))) —— 越低表示模型给实际 token 赋予更高概率 |
| ELO 评分 | "模型的象棋排名" | 从成对胜负记录计算的相对技能评分，Chatbot Arena 用它排名 100+ 模型 |
| LLM-as-judge | "用 AI 给 AI 打分" | 强模型按评分标准给弱模型输出评分，与人工评判约 80% 一致，每次约 $0.01 |
| 数据污染 | "模型看过测试题" | 训练数据包含基准测试题目，抬高分数但不提升真实能力 |
| 评估套件 | "一堆测试" | 衡量特定能力的（input, expected_output, scorer）三元组的版本化集合 |
| 通过率 | "正确百分比" | 评估用例中分数超过阈值的占比 —— 比平均分更有可操作性，因为它衡量可靠性 |
| Chatbot Arena | "模型排名网站" | LMSYS 平台，200 万+ 人类偏好投票，通过 ELO 评分产生最可信的 LLM 排行榜 |

## 延伸阅读

- [Hendrycks et al., 2021 -- "Measuring Massive Multitask Language Understanding"](https://arxiv.org/abs/2009.03300) —— MMLU 论文，尽管已饱和仍是最常被引用的 LLM 基准测试
- [Chen et al., 2021 -- "Evaluating Large Language Models Trained on Code"](https://arxiv.org/abs/2107.03374) —— OpenAI 的 HumanEval 论文，建立了代码生成评估方法论
- [Zheng et al., 2023 -- "Judging LLM-as-a-Judge"](https://arxiv.org/abs/2306.05685) —— 使用 LLM 评估 LLM 的系统分析，包括位置偏差和冗长偏差发现
- [LMSYS Chatbot Arena](https://chat.lmsys.org/) —— 众包模型比较平台，200 万+ 投票，最可信的真实世界 LLM 排名
