# 基准测试：SWE-bench、GAIA、AgentBench

> 三个基准测试锚定了 2026 年的智能体评估。SWE-bench 测试代码修补。GAIA 测试通用工具使用。AgentBench 测试多环境推理。了解它们的构成、数据污染情况，以及它们不测什么。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 06 (Tool Use)
**Time:** ~60 minutes

## 学习目标

- 说出 SWE-bench 的测试框架（FAIL_TO_PASS），并解释它为什么以单元测试作为门控。
- 解释 SWE-bench Verified（OpenAI，500 个任务）为何存在，以及它移除了什么。
- 描述 GAIA 的设计：对人类简单，对 AI 困难；三个难度级别。
- 说出 AgentBench 的八个环境，以及开源 LLM 追赶的主要阻碍。
- 总结 SWE-bench+ 的污染发现及其影响。

## 问题

排行榜只告诉你哪个模型在某个基准上获胜。它们不会告诉你：

- 该基准是否被污染（解法存在于训练数据中、测试泄露）。
- 该基准是否衡量你关心的东西（代码 vs 浏览 vs 通用能力）。
- 评估器是否稳健（AST 匹配、状态检查、人工审查）。

在引用任何数字之前，先了解这三个锚定基准及其失效模式。

## 概念

### SWE-bench（Jimenez 等，ICLR 2024 oral）

- 来自 12 个流行 Python 仓库的 2,294 个真实 GitHub issue。
- 智能体获得：修复前 commit 的代码库 + 自然语言 issue 描述。
- 智能体产出：一个补丁。
- 评估器：应用补丁，运行仓库的测试套件。补丁必须让 FAIL_TO_PASS 测试（之前失败，现在通过）翻转，且不破坏 PASS_TO_PASS 测试。

SWE-agent（Yang 等，2024）发布时达到 12.5%，其关键在于强调智能体-计算机接口（文件编辑命令、模型能理解的搜索语法）。

### SWE-bench Verified

OpenAI，2024 年 8 月。人工筛选的 500 任务子集。移除了模糊的 issue、不可靠的测试以及修复方式不清晰的任务。它是"你的智能体能否交付真实补丁？"的主要基准。

### 污染

- SWE-bench 超过 94% 的 issue 早于大多数模型的训练截止日期。
- **SWE-bench+** 发现 32.67% 的成功补丁存在 issue 文本中泄露解法的情况（模型在描述中看到了修复方法），另有 31.08% 因测试覆盖薄弱而可疑。
- Verified 更干净，但并非无污染。

实践启示：一个在 SWE-bench 上得 50% 的模型在 SWE-bench+ 上可能只有 35%。如果你声称 SWE-bench 性能，请同时报告两者。

### GAIA（Mialon 等，2023 年 11 月）

- 466 个问题；300 个保留用于 huggingface.co/gaia-benchmark 的私密排行榜。
- 设计理念："对人类概念上简单（92%），但对 AI 困难（带插件的 GPT-4：15%）。"
- 测试推理、多模态、网页、工具使用。
- 三个难度级别；Level 3 需要跨模态的长工具链。

GAIA 是你用来衡量"通用能力"的基准。不要与代码专用基准混淆。

### AgentBench（Liu 等，ICLR 2024）

- 8 个环境，涵盖代码（Bash、DB、KG）、游戏（Alfworld、LTP）、网页（WebShop、Mind2Web）和开放式生成。
- 多轮，每个 split 约 4k-13k 轮。
- 主要发现：长期推理、决策制定和指令遵循是开源 LLM 追赶商业模型的主要阻碍。

### 这些基准不测什么

- 真实世界的运营成本（token、耗时）。
- 对抗条件下的安全行为。
- 在你的领域上的表现（使用你自己的评估，见 Lesson 30）。
- 尾部失败（基准取平均值；生产运维关心最差的 1%）。

### 基准测试容易出错的地方

- **单一数字执念。** SWE-bench 50% 告诉你的信息少于 P50/P75/P95 成本 + 步骤分布。
- **被污染的声明。** 报告 SWE-bench 而不提 Verified 或 SWE-bench+ 是误导性的。
- **以基准为开发目标。** 针对基准优化会偏离生产实用性。

```figure
ae-swebench-gate
```

## 动手实现

`code/main.py` 实现了一个玩具级的类 SWE-bench 框架：

- 合成的 bug 修复任务（3 个任务）。
- 一个提出补丁的脚本化"智能体"。
- 一个测试运行器，检查 FAIL_TO_PASS（bug 已修复）和 PASS_TO_PASS（没有破坏任何东西）。
- 一个基于问题分解深度的 GAIA 风格难度分类器。

运行它：

```
python3 code/main.py
```

输出显示每个任务和每个难度的解决率，并使评估器规则具体化。

## 使用场景

- **SWE-bench Verified** 用于代码智能体。始终报告 Verified 分数。
- **GAIA** 用于通用智能体。使用私密排行榜 split。
- **AgentBench** 用于多环境比较。
- **自定义评估**（Lesson 30）用于你产品的实际形态。

## 上线实践

`outputs/skill-benchmark-harness.md` 为任意代码库-任务对构建带 FAIL_TO_PASS / PASS_TO_PASS 门控的 SWE-bench 风格框架。

## 练习

1. 将玩具框架移植到一个真实仓库上运行（选你自己的一个）。为已知 bug 编写 3 个 FAIL_TO_PASS 测试。
2. 添加一个步骤数指标。在你的 3 个任务上，每次解决需要多少智能体步骤？
3. 阅读 SWE-bench+ 论文。实现一个解法泄露检查（将 issue 文本与 diff 进行模式匹配）。
4. 从公开 split 下载一个 GAIA 问题。追踪一个 GPT-4 级别的智能体会怎么做。它需要哪些工具？
5. 阅读 AgentBench 的按环境分解。哪个环境最接近你的产品形态？在那里"SOTA"是什么样的？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| SWE-bench | "代码智能体基准" | 2,294 个 GitHub issue；补丁必须让 FAIL_TO_PASS 测试翻转 |
| SWE-bench Verified | "干净的 SWE-bench" | 500 个人工筛选的任务，OpenAI |
| FAIL_TO_PASS | "修复门控" | 之前失败、补丁后必须通过的测试 |
| PASS_TO_PASS | "无回归门控" | 之前通过、补丁后必须仍然通过的测试 |
| GAIA | "通用基准" | 466 个人类觉得容易 / AI 觉得难的多工具问题 |
| AgentBench | "多环境基准" | 8 个环境；长程多轮 |
| 污染 | "训练集泄露" | 基准任务出现在模型训练数据中 |
| SWE-bench+ | "污染审计" | 在成功的 SWE-bench 补丁中发现 32.67% 的解法泄露 |

## 延伸阅读

- [Jimenez 等，SWE-bench (arXiv:2310.06770)](https://arxiv.org/abs/2310.06770) — 原始基准
- [OpenAI，SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — 筛选后的子集
- [Mialon 等，GAIA (arXiv:2311.12983)](https://arxiv.org/abs/2311.12983) — 通用基准
- [Liu 等，AgentBench (arXiv:2308.03688)](https://arxiv.org/abs/2308.03688) — 多环境套件