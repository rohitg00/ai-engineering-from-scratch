# 04 · 思维树与 LATS：审慎搜索

> 单条思维链（chain-of-thought）轨迹没有回溯的余地。ToT（Yao 等，2023）把推理变成一棵树，并在每个节点上做自我评估。LATS（Zhou 等，2024）在蒙特卡洛树搜索（Monte Carlo Tree Search）框架下，把 ToT 与 ReAct、Reflexion 统一起来。Game of 24 的准确率从 4%（CoT）跃升到 74%（ToT）；LATS 在 HumanEval 上拿到了 92.7% 的 pass@1。

**类型：** 构建
**语言：** Python（标准库）
**前置：** 第 14 阶段 · 01（智能体循环），第 14 阶段 · 03（Reflexion）
**时长：** 约 75 分钟

## 学习目标

- 把推理建模为搜索：节点是「思维（thought）」，边是「扩展（expansion）」，价值（value）衡量「有多大希望」。
- 用标准库实现一个 ToT 风格的 BFS 树搜索，配合自我评估打分。
- 扩展为一个玩具级 LATS MCTS 循环，包含 select / expand / simulate / backpropagate 四步。
- 判断什么时候搜索值得付出 token 倍增的代价（Game of 24、代码生成），什么时候单条轨迹就够用（简单问答）。

## 问题所在

思维链是一次线性行走。如果第一步就错了，后续每一步都建立在错误前提之上。在 Game of 24（用四个数字加上 + − × ÷ 凑出 24）上，GPT-4 的 CoT 只有 4% 的准确率。模型早早选错了子表达式，之后无法挽回。

推理真正需要的能力是：提出多个候选，逐一评估，挑出有希望的，并在遇到死路时回溯。这就是搜索。思维树（Tree of Thoughts）和 LATS 是两种经典的表述方式。

## 核心概念

### 思维树（Tree of Thoughts，Yao 等，NeurIPS 2023）

每个节点是一个连贯的中间步骤（「一个思维」）。每个节点可以扩展出 K 个子思维。LLM 用一个打分提示词对每个节点做自我评估。搜索在这棵树上展开——可以是 BFS、DFS 或束搜索（beam）。

```
                     (root: "find 24 from 4 6 4 1")
                    /               |            \
           ("6 - 4 = 2")    ("4 + 1 = 5")    ("4 * 6 = 24")  <- Score: HIGH
              /   \              |                  |
          ...    ...          ...                finish
```

自我评估是整个方法的承重部件。论文给出三种变体：`sure / likely / impossible` 分类、`1..10` 数值打分，以及候选之间的投票。三者在 Game of 24 上都大幅超越 CoT（用 GPT-4 时从 4% 提升到 74%）。

### LATS（Zhou 等，ICML 2024）

LATS 在 MCTS 框架下统一了 ToT、ReAct 和 Reflexion。LLM 扮演三种角色：

- **策略（Policy）**：提出候选的下一步动作（ReAct 风格）。
- **价值函数（Value function）**：为一条部分轨迹打分（ToT 风格的自我评估）。
- **自我反思器（Self-reflector）**：失败时写一段自然语言反思（Reflexion 风格），并用它来重新播种未来的 rollout。

环境反馈（观测结果）会混入价值函数，使搜索由真实的工具结果引导，而不仅仅依赖模型的主观判断。论文发表时的结果：用 GPT-4 在 HumanEval 上 pass@1 达 92.7%（SOTA）；用 GPT-3.5 在 WebShop 上平均得分 75.9（逼近基于梯度的微调）。

### MCTS，最小化讲解

每次迭代分为四个阶段：

1. **选择（Select）**——用 UCT（树的置信上界，upper confidence bound for trees）从根走到一个叶子。
2. **扩展（Expand）**——通过策略生成 K 个子节点。
3. **模拟（Simulate）**——从某个子节点用策略做 rollout，用价值函数（或环境奖励）为叶子打分。
4. **回传（Backpropagate）**——沿路径向上更新访问次数和价值估计。

UCT 公式：`Q(s, a) + c * sqrt(ln N(s) / N(s, a))`。第一项是利用（exploitation），第二项是探索（exploration）。`c` 需针对每个任务调参。

### 成本现实

搜索会让 token 量爆炸。ToT 在 Game of 24 上消耗的 token 是 CoT 的 100–1000 倍。LATS 也差不多。这不是免费的；把搜索留给以下场景：

- 单条轨迹明显不够用的任务（Game of 24、复杂代码）。
- 墙钟时间不如正确性重要的任务。
- 拥有廉价、可靠价值函数的任务（代码的单元测试、数学的明确目标）。

如果你的任务只有唯一正确答案，而评估器又很嘈杂，搜索往往会让事情更糟——它会找到一个「打分很高」的错误答案。

### 2026 年的定位

大多数生产环境的智能体并不运行 LATS。它们运行的是带工具落地验证的 ReAct（CRITIC，见第 05 课）。搜索只出现在一些专门的细分场景：

- 把测试当作价值函数的编码智能体（HumanEval 风格）。
- 探索多条查询路径的深度研究智能体。
- LangGraph 子图内部那些重规划的工作流。

AlphaEvolve（第 11 课）是 2025 年的极端案例：在代码上做演化式搜索，使用机器可验证的适应度，取得前沿突破（56 年来首次改进 4x4 矩阵乘法）。

## 动手构建

`code/main.py` 实现了：

- 一个迷你 ToT BFS，运行在一个程式化的「挑选算术运算」任务上。
- 一个玩具级 LATS MCTS 循环，跑在同一个任务上（Select / Expand / Simulate / Backpropagate），采用 UCT 选择。
- 一个价值函数，由符号化分数加上自我评估分数组合而成。

运行它：

```
python3 code/main.py
```

跟踪输出展示了 ToT 用 BFS 在每个节点扩展三个候选，对比 LATS 通过 MCTS 收敛到最佳 rollout。两者都会打印 token 计数。

## 实际运用

LangGraph 以子图模式提供 ToT 风格的探索；LangChain 团队关于 LATS 的博客（2024 年 5 月）是参考教程。LlamaIndex 提供了一个 `TreeOfThoughts` 智能体。对 2026 年大多数生产环境的智能体而言，这个模式都藏在一道 `if task_complexity > threshold: use_search()` 闸门之后——参见第 05 课的评估器-优化器（evaluator-optimizer）模式。

## 交付落地

`outputs/skill-search-policy.md` 会根据任务形态、预算和评估器保真度，在线性 ReAct、ToT、LATS 和演化式搜索之间做出选择。

## 练习

1. 用 UCT c=0.1 和 c=2.0 分别运行玩具级 LATS。跟踪输出有什么变化？
2. 把价值函数换成更嘈杂的打分器（加入随机抖动）。MCTS 还能找到最佳叶子吗？它能容忍的最低信噪比是多少？
3. 实现束搜索版 ToT（每一层保留 top-k），并与 BFS 对比。在紧张的 token 预算下哪个更好？
4. 阅读 LATS 第 5.1 节。复现 HumanEval 的轨迹计数：需要多少次 rollout 才能达到论文报告的 pass@1？
5. 阅读 LATS 论文中关于「LATS 何时帮助较小」的讨论。写一段决策规则，把任务形态映射到搜索策略。

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|------|----------------|------------------------|
| 思维树（Tree of Thoughts） | 「分叉的 CoT」 | Yao 等——带自我评估的思维节点树 |
| LATS | 「面向 LLM 的 MCTS」 | Zhou 等——在 MCTS 下统一 ToT + ReAct + Reflexion |
| UCT | 「置信上界」 | 平衡利用（Q）与探索（ln N / n）的选择公式 |
| 价值函数（Value function） | 「这个状态有多好」 | 由提示词驱动的 LLM 打分或环境奖励；喂给反向传播 |
| 策略（Policy） | 「动作提议者」 | ReAct 风格的生成器；产出候选的下一步思维/动作 |
| Rollout | 「模拟轨迹」 | 用策略从某节点走到叶子，再用价值函数打分 |
| 回传（Backpropagate） | 「更新祖先节点」 | 把叶子的奖励沿路径向上推送，更新访问次数和 Q |
| 搜索成本 | 「token 爆炸」 | 在 Game of 24 上是 CoT 的 100-1000 倍；采用前先做预算 |

## 延伸阅读

- [Yao 等，Tree of Thoughts（arXiv:2305.10601）](https://arxiv.org/abs/2305.10601) —— 经典论文
- [Zhou 等，LATS（arXiv:2310.04406）](https://arxiv.org/abs/2310.04406) —— 带 Reflexion 反馈的 MCTS
- [LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview) —— 用于搜索的子图模式
- [AlphaEvolve（arXiv:2506.13131）](https://arxiv.org/abs/2506.13131) —— 带程序化评估器的演化式搜索
