# Tree of Thoughts 与 LATS：审慎搜索

> 单个思维链（chain-of-thought）轨迹没有回溯的空间。ToT（Yao 等人，2023）将推理变成一棵带有每个节点自我评估的树。LATS（Zhou 等人，2024）在蒙特卡洛树搜索（MCTS）下统一了 ToT、ReAct 和 Reflexion。24 点游戏从 4%（CoT）提升到 74%（ToT）；LATS 在 HumanEval 上达到 92.7% 的 pass@1。

**类型：** 构建（Build）
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 01（Agent 循环）、阶段 14 · 03（Reflexion）
**时长：** 约 75 分钟

## 学习目标

- 将推理构建为搜索：节点是"思考"，边是"扩展"，价值是"有多大希望"。
- 实现一个带有自我评估评分的标准库 ToT 风格 BFS 树搜索。
- 扩展到一个玩具 LATS MCTS 循环，包含选择（select）/ 扩展（expand）/ 模拟（simulate）/ 回溯（backpropagate）。
- 决定何时搜索值得 token 倍增器（24 点游戏、代码生成），以及何时单个轨迹就足够（简单问答）。

## 问题背景

思维链（Chain-of-thought）是一种线性行走。如果第一步是错误的，每个后续步骤都在糟糕的前提下工作。在 24 点游戏（使用 + − × ÷ 和四个数字得到 24）上，GPT-4 CoT 的准确率为 4%。模型早期选择了错误的子表达式，无法恢复。

推理需要的是提出多个候选、评估它们、选择有希望的那个，并在出现死胡同时回溯的能力。这就是搜索。Tree of Thoughts 和 LATS 是两个规范公式。

## 核心概念

### Tree of Thoughts（Yao 等人，NeurIPS 2023）

每个节点是一个连贯的中间步骤（"一个思考"）。每个节点可以扩展到 K 个子思考。LLM 用评分提示对每个节点进行自我评估。搜索探索树——BFS、DFS 或 beam。

```
                     (根："从 4 6 4 1 找到 24")
                    /               |            \
           ("6 - 4 = 2")    ("4 + 1 = 5")    ("4 * 6 = 24")  <- 分数：高
              /   \              |                  |
          ...    ...          ...                finish
```

自我评估是承重部分。论文展示了三种变体：`sure / likely / impossible` 分类、`1..10` 数字分数，以及候选之间的投票。所有这三种在 24 点游戏上都大幅击败 CoT（4% -> 74%，使用 GPT-4）。

### LATS（Zhou 等人，ICML 2024）

LATS 在 MCTS 下统一了 ToT、ReAct 和 Reflexion。LLM 扮演三个角色：

- **策略（Policy）**：提出候选的下一个行动（ReAct 风格）。
- **价值函数（Value function）**：对部分轨迹评分（ToT 风格的自我评估）。
- **自我反思器（Self-reflector）**：失败时，写一份自然语言反思（Reflexion 风格），并用它重新播种未来的 rollout。

环境反馈（观察）混合到价值函数中，因此搜索由真实的工具结果通知，而不仅仅是模型意见。论文时的结果：使用 GPT-4 的 HumanEval pass@1 为 92.7%（SOTA），使用 GPT-3.5 的 WebShop 平均分为 75.9（接近基于梯度的微调）。

### MCTS，最小化

每次迭代的四个阶段：

1. **选择（Select）**——使用 UCT（树的置信上限）从根走到叶子。
2. **扩展（Expand）**——通过策略生成 K 个子节点。
3. **模拟（Simulate）**——使用策略从子节点 rollout，用价值函数（或环境奖励）对叶子评分。
4. **回溯（Backpropagate）**——沿路径向上更新访问计数和价值估计。

UCT 公式：`Q(s, a) + c * sqrt(ln N(s) / N(s, a))`。第一项是利用（exploitation）；第二项是探索（exploration）。按任务调整 `c`。

### 成本现实

搜索会爆炸 token。24 点游戏上的 ToT 使用的 token 是 CoT 的 100-1000 倍。LATS 类似。这不是免费的；将搜索保留用于：

- 单个轨迹明显不足的任务（24 点游戏、复杂代码）。
- 墙上时钟（wall-clock）不如正确性重要的任务。
- 具有廉价、可靠价值函数的任务（代码的单元测试、数学的明确目标）。

如果你的任务有一个正确的答案和一个嘈杂的评估器，搜索往往会使事情变得更糟——它找到一个"高分"的错误答案。

### 2026 年定位

大多数生产 Agent 不运行 LATS。它们运行带有工具 grounding 验证的 ReAct（CRITIC，第 05 课）。搜索出现在专门的小众领域：

- 以测试作为价值函数的编码 Agent（HumanEval 风格）。
- 探索多个查询路径的深度研究 Agent。
- LangGraph 子图内重度规划的工作流。

AlphaEvolve（第 11 课）是 2025 年的极端：对代码进行进化搜索，机器可检查的适应度，前沿收益（56 年来第一个 4x4 矩阵乘法改进）。

## 构建它

`code/main.py` 实现：

- 一个微小的 ToT BFS，用于风格化的"选择算术运算"任务。
- 同一任务上的玩具 LATS MCTS 循环（选择 / 扩展 / 模拟 / 回溯），带有 UCT 选择。
- 一个组合符号分数加自我评估分数的价值函数。

运行它：

```
python3 code/main.py
```

轨迹显示 ToT 在每个节点用 BFS 扩展三个候选，与 LATS 通过 MCTS 收敛到最佳 rollout 进行比较。打印两者的 token 计数。

## 使用它

LangGraph 将 ToT 风格的探索作为子图模式发布；LangChain 团队关于 LATS 的博客（2024 年 5 月）是参考教程。LlamaIndex 发布了一个 `TreeOfThoughts` Agent。对于大多数 2026 年的生产 Agent，此模式位于 `if task_complexity > threshold: use_search()` 门之后——参见第 05 课的评估器-优化器模式。

## 部署它

`outputs/skill-search-policy.md` 根据任务形态、预算和评估器保真度，在线性 ReAct、ToT、LATS 和进化搜索之间进行选择。

## 练习

1. 用 UCT c=0.1 与 c=2.0 运行玩具 LATS。轨迹中有什么变化？
2. 将价值函数换成一个更嘈杂的评分器（添加随机抖动）。MCTS 仍然能找到最佳叶子吗？它能容忍的最小信噪比是多少？
3. 实现 beam-search ToT（在每个级别保留 top-k）并与 BFS 比较。在紧张的 token 预算下哪个更好？
4. 阅读 LATS 第 5.1 节。重现 HumanEval 轨迹计数：需要多少次 rollout 才能达到报告的 pass@1？
5. 阅读 LATS 论文关于"LATS 帮助较少时"的讨论。写一个单段决策规则，将任务形态映射到搜索策略。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Tree of Thoughts | "分支 CoT" | Yao 等人——带有自我评估的思维节点树 |
| LATS | "LLM 的 MCTS" | Zhou 等人——在 MCTS 下统一 ToT + ReAct + Reflexion |
| UCT | "置信上限" | 平衡利用（Q）和探索（ln N / n）的选择公式 |
| Value function | "这个状态有多好" | 提示的 LLM 分数或环境奖励；反馈回溯 |
| Policy | "行动提议者" | ReAct 风格的生成器；发出候选的下一个思考/行动 |
| Rollout | "模拟轨迹" | 使用策略从节点走到叶子，用价值评分 |
| Backpropagate | "更新祖先" | 将叶子的奖励沿路径向上推送，更新访问计数和 Q |
| Search cost | "Token 爆炸" | 24 点游戏上是 CoT 的 100-1000 倍；在采用之前预算 |

## 延伸阅读

- [Yao et al., Tree of Thoughts (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601)——规范论文
- [Zhou et al., LATS (arXiv:2310.04406)](https://arxiv.org/abs/2310.04406)——带有 Reflexion 反馈的 MCTS
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)——搜索的子图模式
- [AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131)——带有程序化评估器的进化搜索
