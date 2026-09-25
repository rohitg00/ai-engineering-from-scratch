# 思维树与 LATS：审慎搜索

> 单条思维链轨迹没有回溯的余地。ToT(Yao et al., 2023) 将推理转化为树结构，并对每个节点进行自评估。LATS(Zhou et al., 2024) 在蒙特卡洛树搜索下统一了 ToT、ReAct 与 Reflexion。Game of 24 从 4%(CoT)提升到 74%(ToT);LATS 在 HumanEval 上达到 92.7% pass@1。

**Type:** Build
**Languages:** Python(stdlib)
**Prerequisites:** Phase 14 · 01(Agent Loop)、Phase 14 · 03(Reflexion)
**Time:** 约 75 分钟

## 学习目标

- 将推理框定为搜索：节点是"想法"，边是"展开"，价值是"多有前景"。
- 使用标准库实现 ToT 风格的 BFS 树搜索，并带自评估打分。
- 扩展为一个玩具版 LATS MCTS 循环，包含 select / expand / simulate / backpropagate。
- 判断何时值得为搜索付出 token 代价(Game of 24、代码生成)，何时单条轨迹即可(简单问答)。

## 问题所在

思维链是一条线性路径。如果第一步错了，后续每一步都在错误的前提下进行。在 Game of 24(用四个数字和 + − × ÷ 得到 24)上，GPT-4 的 CoT 准确率只有 4%。模型很早就选错了子表达式且无法恢复。

推理需要的是能够提出多个候选、评估它们、挑选有前景的，并在遇到死胡同时回溯。这就是搜索。Tree of Thoughts 与 LATS 是两种经典表述。

## 核心概念

### Tree of Thoughts(Yao et al., NeurIPS 2023)

每个节点是一个连贯的中间步骤(即"一个想法")。每个节点可以展开为 K 个子想法。LLM 通过评分提示对每个节点进行自评估。搜索遍历这棵树——BFS、DFS 或束搜索。

```
                     (root: "find 24 from 4 6 4 1")
                    /               |            \
           ("6 - 4 = 2")    ("4 + 1 = 5")    ("4 * 6 = 24")  <- Score: HIGH
              /   \              |                  |
          ...    ...          ...                finish
```

自评估是承重部件。论文给出了三种变体：`sure / likely / impossible` 分类、`1..10` 数值评分，以及对候选投票。三者都在 Game of 24 上大幅超越 CoT(GPT-4 下从 4% 提升到 74%)。

### LATS(Zhou et al., ICML 2024)

LATS 在 MCTS 框架下统一了 ToT、ReAct 与 Reflexion。LLM 扮演三个角色：

- **策略(Policy)**:提出候选的下一步动作(ReAct 风格)。
- **价值函数(Value function)**:为部分轨迹打分(ToT 风格的自评估)。
- **自我反思器(Self-reflector)**:失败时撰写自然语言反思(Reflexion 风格)，并用它重新引导未来的 rollout。

环境反馈(观察)会融入价值函数，使搜索由真实的工具结果而非仅凭模型自身判断来驱动。论文发表时的结果：使用 GPT-4 在 HumanEval 上 pass@1 达 92.7%(SOTA),使用 GPT-3.5 在 WebShop 上平均 75.9(接近基于梯度的微调)。

### 最小化理解 MCTS

每次迭代包含四个阶段：

1. **Select** —— 使用 UCT(树的置信上界)从根节点走到叶节点。
2. **Expand** —— 通过策略生成 K 个子节点。
3. **Simulate** —— 从某个子节点用策略 rollout,用价值函数(或环境奖励)对叶节点打分。
4. **Backpropagate** —— 沿路径向上更新访问计数与价值估计。

UCT 公式：`Q(s, a) + c * sqrt(ln N(s) / N(s, a))`。第一项是利用，第二项是探索。按任务调节 `c`。

### 成本现实

搜索会令 token 爆炸。ToT 在 Game of 24 上消耗的 token 是 CoT 的 100–1000 倍。LATS 类似。这不是免费的；请把搜索留给：

- 单条轨迹明显不够用的任务(Game of 24、复杂代码)。
- 正确性比墙钟时间更重要的任务。
- 拥有廉价可靠价值函数的任务(代码的单元测试、数学题的明确目标)。

如果你的任务只有唯一正确答案而评估器噪声很大，搜索往往适得其反——它会找到一个"打分很好"的错误答案。

### 2026 年的定位

大多数生产级 agent 并不运行 LATS。它们运行带工具接地验证的 ReAct(CRITIC,Lesson 05)。搜索出现在一些专门领域：

- 以测试作为价值函数的编码 agent(HumanEval 式)。
- 探索多条查询路径的深度研究 agent。
- LangGraph 子图内部的规划密集型工作流。

AlphaEvolve(Lesson 11)是 2025 年的极端案例：在代码上进行进化搜索，适应度可机器验证，取得前沿成果(56 年来首个 4x4 矩阵乘法改进)。

```figure
tree-of-thoughts
```

## 动手构建

`code/main.py` 实现了：

- 在一个风格化的"挑选算术运算"任务上的小型 ToT BFS。
- 同一任务上的玩具版 LATS MCTS 循环(Select / Expand / Simulate / Backpropagate),使用 UCT 选择。
- 一个由符号评分加自评估评分组合而成的价值函数。

运行：

```
python3 code/main.py
```

轨迹展示了 ToT 以 BFS 在每个节点展开三个候选，而 LATS 通过 MCTS 收敛到最佳 rollout。两者均打印 token 计数。

## 使用

LangGraph 以子图模式提供 ToT 风格的探索；LangChain 团队关于 LATS 的博客(2024 年 5 月)是参考教程。LlamaIndex 提供了一个 `TreeOfThoughts` agent。对大多数 2026 年的生产 agent 而言，这一模式位于一个 `if task_complexity > threshold: use_search()` 门控之后——参见 Lesson 05 的评估器-优化器模式。

## 上线

`outputs/skill-search-policy.md` 依据任务形态、预算与评估器保真度，在线性 ReAct、ToT、LATS 与进化搜索之间进行选择。

## 练习

1. 分别用 UCT c=0.1 与 c=2.0 运行玩具版 LATS。轨迹有何变化？
2. 将价值函数换成噪声更大的打分器(加入随机抖动)。MCTS 仍能找到最佳叶节点吗？它能容忍的最低信噪比是多少？
3. 实现束搜索版 ToT(每层保留 top-k)并与 BFS 比较。在 token 预算紧张时哪个更好？
4. 阅读 LATS 第 5.1 节。复现 HumanEval 的轨迹计数：达到报告的 pass@1 需要多少次 rollout?
5. 阅读 LATS 论文中关于"LATS 帮助较小"的讨论。写一段话的决策规则，将任务形态映射到搜索策略。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|------------------------| 
| Tree of Thoughts | "分支的 CoT" | Yao et al. —— 带自评估的思维节点树 |
| LATS | "面向 LLM 的 MCTS" | Zhou et al. —— 在 MCTS 下统一 ToT + ReAct + Reflexion |
| UCT | "置信上界" | 平衡利用(Q)与探索(ln N / n)的选择公式 |
| Value function | "这个状态有多好" | 提示 LLM 的评分或环境奖励；用于回传更新 |
| Policy | "动作提出者" | ReAct 风格的生成器；产出候选的下一步想法/动作 |
| Rollout | "模拟轨迹" | 用策略从节点走到叶节点，再用价值函数打分 |
| Backpropagate | "更新祖先" | 将叶节点的奖励沿路径向上推送，更新访问计数与 Q |
| Search cost | "token 爆炸" | 在 Game of 24 上是 CoT 的 100-1000 倍；采用前先做预算 |

## 延伸阅读

- [Yao et al., Tree of Thoughts (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) —— 权威论文
- [Zhou et al., LATS (arXiv:2310.04406)](https://arxiv.org/abs/2310.04406) —— 带 Reflexion 反馈的 MCTS
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— 用于搜索的子图模式
- [AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) —— 使用程序化评估器的进化搜索