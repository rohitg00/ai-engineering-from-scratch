# 基准测试：SWE-bench、GAIA、AgentBench（Benchmarks: SWE-bench, GAIA, AgentBench）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年有三个基准（benchmark）锚定了 agent 评估。SWE-bench 测代码补丁，GAIA 测通用工具使用，AgentBench 测多环境推理。在引用任何分数前，先搞清楚它们的构成、污染情况，以及它们没有衡量什么。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 06 (Tool Use)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 说出 SWE-bench 的测试 harness（FAIL_TO_PASS），并解释它为什么以单元测试作为通过门槛。
- 解释 SWE-bench Verified（OpenAI，500 个任务）为什么存在，以及它移除了什么。
- 描述 GAIA 的设计：对人简单、对 AI 困难；三个难度等级。
- 说出 AgentBench 的八个环境，以及它对开源 LLM 的主要拦路虎。
- 总结 SWE-bench+ 的污染发现及其影响。

## 问题（The Problem）

排行榜只告诉你哪个模型在某个基准上赢了。它不会告诉你：

- 这个基准是否被污染（解法已经在训练数据里、测试集泄漏）。
- 这个基准是否衡量了你真正在意的东西（写代码 vs 浏览网页 vs 通用能力）。
- 评估器是否稳健（AST 匹配、状态校验、人工 review）。

在引用一个数字之前，先认清这三个锚定基准和它们的失败模式。

## 概念（The Concept）

### SWE-bench（Jimenez 等，ICLR 2024 oral）

- 来自 12 个流行 Python 仓库的 2,294 个真实 GitHub issue。
- agent 拿到的是：修复前那个 commit 的代码库 + 自然语言的 issue 描述。
- agent 产出的是：一份补丁。
- 评估器：把补丁打上去，跑这个仓的测试套件。补丁必须让 FAIL_TO_PASS 的测试翻盘（之前失败、现在通过），并且不能弄坏 PASS_TO_PASS 的测试。

SWE-agent（Yang 等，2024）发布时拿到 12.5%，靠的是强调 agent-computer 接口（文件编辑器命令、模型能理解的搜索语法）。

### SWE-bench Verified

OpenAI，2024 年 8 月。人工筛选过的 500 任务子集。剔除了表述模糊的 issue、不可靠的测试、以及修复方案不明确的任务。这是回答「你的 agent 真的能交付补丁吗？」的首选基准。

### 污染（Contamination）

- 超过 94% 的 SWE-bench issue 都早于大多数模型的训练截止日期。
- **SWE-bench+** 发现，32.67% 的成功补丁其实是 issue 文本里就泄漏了解法（模型在描述里直接看到了修复方案），另有 31.08% 因为测试覆盖太弱而可疑。
- Verified 干净一些，但也并非完全无污染。

实务影响：一个在 SWE-bench 上得 50% 的模型，到了 SWE-bench+ 上可能只有 35%。如果你声称自己在 SWE-bench 上的成绩，请始终把两个数都报出来。

### GAIA（Mialon 等，2023 年 11 月）

- 466 道题；其中 300 道保留在 huggingface.co/gaia-benchmark 的私有排行榜。
- 设计哲学：「对人在概念上简单（92%），但对 AI 困难（带插件的 GPT-4：15%）」。
- 考察推理、多模态、网页浏览、工具使用。
- 三个难度等级；Level 3 需要跨模态的长工具链。

GAIA 是用来衡量「通用能力（generalist capability）」的。不要把它和代码专用的基准混为一谈。

### AgentBench（Liu 等，ICLR 2024）

- 8 个环境，跨越代码（Bash、DB、KG）、游戏（Alfworld、LTP）、网页（WebShop、Mind2Web）和开放式生成。
- 多轮对话，每个 split 大约 4k–13k 轮。
- 主要发现：长期推理、决策、指令遵循，是开源 LLM 追赶商业模型的主要拦路虎。

### 这些基准没有衡量什么

- 真实世界的运营成本（token、墙钟时间）。
- 对抗条件下的安全行为。
- 你自己业务领域上的表现（用你自己的 eval，见 Lesson 30）。
- 尾部失败（基准测平均值；生产环境的运维人员更在意最差的那 1%）。

### 基准测试常出错的地方

- **单数字执念。** SWE-bench 50% 这个数告诉你的信息，比 P50/P75/P95 成本 + 步骤分布要少得多。
- **被污染的成绩。** 报 SWE-bench 时不提 Verified 或 SWE-bench+，就是误导。
- **把基准当成开发目标。** 为基准而优化，会让你和生产可用性渐行渐远。

## 动手实现（Build It）

`code/main.py` 实现了一个玩具版的 SWE-bench 风格 harness：

- 合成的 bug 修复任务（3 个任务）。
- 一个写死脚本的「agent」，会提出补丁。
- 一个测试 runner，检查 FAIL_TO_PASS（bug 已修）和 PASS_TO_PASS（什么都没弄坏）。
- 一个 GAIA 风格的难度分类器，依据问题分解的深度来判定。

跑起来：

```
python3 code/main.py
```

输出会展示每个任务、每个难度的解决率，并把评估器的规则具体落地。

## 用起来（Use It）

- **SWE-bench Verified** 用于代码 agent。永远报 Verified 分数。
- **GAIA** 用于通用 agent。使用私有排行榜的 split。
- **AgentBench** 用于多环境对比。
- **自定义 eval**（Lesson 30）用于贴合你产品实际形态的评估。

## 上线部署（Ship It）

`outputs/skill-benchmark-harness.md` 为任意「代码库—任务」组合构建一个 SWE-bench 风格的 harness，带 FAIL_TO_PASS / PASS_TO_PASS 门槛。

## 练习（Exercises）

1. 把这个玩具 harness 移植到一个真实仓库上（挑你自己的一个）。为已知 bug 写 3 个 FAIL_TO_PASS 测试。
2. 增加一个「步数」指标。在你那 3 个任务上，每次解决平均要多少 agent 步骤？
3. 阅读 SWE-bench+ 论文。实现一个解法泄漏检查（用模式匹配把 issue 文本和 diff 对比）。
4. 从 GAIA 的公开 split 下载一道题。推演一个 GPT-4 级别的 agent 会怎么做。它需要哪些工具？
5. 阅读 AgentBench 按环境分项的结果。哪个环境最贴合你的产品形态？那里的「SOTA」长什么样？

## 关键术语（Key Terms）

| Term | 大家嘴上说的 | 它真正的意思 |
|------|----------------|------------------------|
| SWE-bench | 「代码 agent 基准」 | 2,294 个 GitHub issue；补丁必须让 FAIL_TO_PASS 测试翻盘 |
| SWE-bench Verified | 「干净版 SWE-bench」 | 500 个人工筛选过的任务，OpenAI 出品 |
| FAIL_TO_PASS | 「修复门槛」 | 之前失败、打补丁后必须通过的测试 |
| PASS_TO_PASS | 「不回归门槛」 | 之前通过、打补丁后仍必须通过的测试 |
| GAIA | 「通用能力基准」 | 466 道对人简单、对 AI 难的多工具题 |
| AgentBench | 「多环境基准」 | 8 个环境；长链路（long-horizon）多轮 |
| Contamination | 「训练集泄漏」 | 基准任务出现在了模型训练数据里 |
| SWE-bench+ | 「污染审计」 | 在 SWE-bench 成功补丁中发现 32.67% 存在解法泄漏 |

## 延伸阅读（Further Reading）

- [Jimenez et al., SWE-bench (arXiv:2310.06770)](https://arxiv.org/abs/2310.06770) — 原始基准
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — 筛选后的子集
- [Mialon et al., GAIA (arXiv:2311.12983)](https://arxiv.org/abs/2311.12983) — 通用能力基准
- [Liu et al., AgentBench (arXiv:2308.03688)](https://arxiv.org/abs/2308.03688) — 多环境套件
