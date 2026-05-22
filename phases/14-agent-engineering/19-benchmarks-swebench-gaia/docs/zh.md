# 基准测试：SWE-bench、GAIA、AgentBench

> 三个基准测试在 2026 年锚定 Agent 评估。SWE-bench 测试代码补丁。GAIA 测试通用工具使用。AgentBench 测试多环境推理。了解它们的组成、污染情况和未衡量的内容。

**类型：** 学习
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 06（工具使用）
**时长：** 约 60 分钟

## 学习目标

- 说出 SWE-bench 的测试框架（FAIL_TO_PASS）并解释为什么它以单元测试为门控。
- 解释 SWE-bench Verified（OpenAI，500 个任务）存在的原因以及它移除了什么。
- 描述 GAIA 的设计：对人类简单，对 AI 困难；三个难度级别。
- 说出 AgentBench 的八个环境以及其对开源 LLM 的主要障碍。
- 总结 SWE-bench+ 污染发现及其影响。

## 问题背景

排行榜告诉你哪个模型在单个基准测试上获胜。它们不会告诉你：

- 基准测试是否被污染（训练数据中的解决方案、测试泄漏）。
- 基准测试是否衡量你关心的内容（代码 vs 浏览 vs 通用）。
- 评估器是否健壮（AST 匹配、状态检查、人工审查）。

在引用数字之前，了解这三个锚定基准测试及其失败模式。

## 核心概念

### SWE-bench（Jimenez et al., ICLR 2024 oral）

- 来自 12 个流行 Python 仓库的 2,294 个真实 GitHub 问题。
- Agent 获得：前缀提交时的代码库 + 自然语言问题描述。
- Agent 产生：一个补丁。
- 评估器：应用补丁，运行仓库的测试套件。补丁必须翻转 FAIL_TO_PASS 测试（先前失败，现在通过），且不破坏 PASS_TO_PASS 测试。

SWE-agent（Yang et al., 2024）通过强调 Agent-计算机接口（模型理解的文件编辑器命令、搜索语法）在发布时达到 12.5%。

### SWE-bench Verified

OpenAI，2024 年 8 月。人工策划的 500 任务子集。移除了模糊问题、不可靠测试以及修复不明确的问题。"你的 Agent 能否交付真实补丁？"的主要基准测试。

### 污染

- 超过 94% 的 SWE-bench 问题早于大多数模型截止日期。
- **SWE-bench+** 发现 32.67% 的成功补丁在问题文本中泄漏了解决方案（模型在描述中看到了修复），31.08% 因测试覆盖率弱而可疑。
- Verified 更干净，但不是无污染的。

实际影响：在 SWE-bench 上得分 50% 的模型在 SWE-bench+ 上可能得分 35%。如果你声称 SWE-bench 性能，总是报告两者。

### GAIA（Mialon et al., Nov 2023）

- 466 个问题；300 个保留用于 huggingface.co/gaia-benchmark 的私有排行榜。
- 设计哲学："对人类概念上简单（92%），但对 AI 困难（带有插件的 GPT-4：15%）。"
- 测试推理、多模态、网页、工具使用。
- 三个难度级别；3 级需要跨模态的长工具链。

GAIA 是你用来衡量"通用能力"的测试。不要与特定于代码的基准测试混淆。

### AgentBench（Liu et al., ICLR 2024）

- 跨代码（Bash、DB、KG）、游戏（Alfworld、LTP）、网页（WebShop、Mind2Web）和开放式生成的 8 个环境。
- 多轮，每次拆分约 4k-13k 轮。
- 主要发现：长期推理、决策制定和指令遵循是开源 LLM 追赶商业模型的主要障碍。

### 这些未衡量的内容

- 真实世界运营成本（token、墙上时钟）。
- 对抗条件下的安全行为。
- 在你的领域上的性能（使用你自己的评估，第 30 课）。
- 尾部失败（基准测试平均；生产操作员关心最差的 1%）。

### 基准测试哪里会出错

- **单一数字 fixation。** SWE-bench 50% 告诉你的少于 P50/P75/P95 成本和步骤分布。
- **被污染的声明。** 在没有提及 Verified 或 SWE-bench+ 的情况下报告 SWE-bench 是误导性的。
- **基准测试作为开发目标。** 为基准测试优化会与生产有用性偏离。

## 构建它

`code/main.py` 实现一个玩具 SWE-bench 风格的框架：

- 合成 bug 修复任务（3 个任务）。
- 一个脚本化的"Agent"，提出补丁。
- 一个测试运行器，检查 FAIL_TO_PASS（bug 现在已修复）和 PASS_TO_PASS（没有破坏）。

运行它：

```
python3 code/main.py
```

输出显示每个任务的解决率和每个难度，并使评估器规则具体化。

## 使用它

- **SWE-bench Verified** 用于代码 Agent。总是报告 Verified 分数。
- **GAIA** 用于通用 Agent。使用私有排行榜拆分。
- **AgentBench** 用于多环境比较。
- **自定义评估**（第 30 课）用于你产品的实际形态。

## 部署它

`outputs/skill-benchmark-harness.md` 为任何代码库-任务对构建带有 FAIL_TO_PASS / PASS_TO_PASS 门控的 SWE-bench 风格框架。

## 练习

1. 将玩具框架移植到运行在一个真实仓库上（选一个你的）。为已知 bug 编写 3 个 FAIL_TO_PASS 测试。
2. 添加一个步骤计数指标。在你的 3 个任务上，每次解决需要多少 Agent 步骤？
3. 阅读 SWE-bench+ 论文。实现一个解决方案泄漏检查（将问题文本与差异进行模式匹配）。
4. 从公共拆分下载一个 GAIA 问题。追踪 GPT-4 级别 Agent 会做什么。它需要什么工具？
5. 阅读 AgentBench 的每环境细分。哪个环境反映你的产品表面？那里的"SOTA"看起来像什么？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| SWE-bench | "代码 Agent 基准测试" | 2,294 个 GitHub 问题；补丁必须翻转 FAIL_TO_PASS 测试 |
| SWE-bench Verified | "干净 SWE-bench" | 500 个人工策划的任务，OpenAI |
| FAIL_TO_PASS | "修复门控" | 先前失败且必须在补丁后通过的测试 |
| PASS_TO_PASS | "无回归门控" | 先前通过且必须仍然通过的测试 |
| GAIA | "通用基准测试" | 466 个人类简单 / AI 困难的多工具问题 |
| AgentBench | "多环境基准测试" | 8 个环境；长期多轮 |
| Contamination | "训练集泄漏" | 模型训练中出现的基准测试任务 |
| SWE-bench+ | "污染审计" | 在成功的 SWE-bench 补丁中发现 32.67% 解决方案泄漏 |

## 延伸阅读

- [Jimenez et al., SWE-bench (arXiv:2310.06770)](https://arxiv.org/abs/2310.06770)——原始基准测试
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/)——策划的子集
- [Mialon et al., GAIA (arXiv:2311.12983)](https://arxiv.org/abs/2311.12983)——通用基准测试
- [Liu et al., AgentBench (arXiv:2308.03688)](https://arxiv.org/abs/2308.03688)——多环境套件
