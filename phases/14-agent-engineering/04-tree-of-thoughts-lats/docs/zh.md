# Tree of Thoughts 与 LATS：审慎搜索

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 单条 chain-of-thought 轨迹没有回退的余地。ToT（Yao et al., 2023）把推理变成一棵带自我评估节点的树。LATS（Zhou et al., 2024）在 Monte Carlo Tree Search 框架下把 ToT、ReAct 和 Reflexion 统一起来。Game of 24 的准确率从 4%（CoT）跃升到 74%（ToT）；LATS 在 HumanEval 上拿到 92.7% 的 pass@1。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 把推理理解为一种搜索：节点是「thought（想法）」，边是「expansion（扩展）」，价值是「有多大希望」。
- 用标准库实现一个 ToT 风格的 BFS 树搜索，并带自我评估打分。
- 扩展为一个玩具版的 LATS MCTS 循环，包含 select / expand / simulate / backpropagate。
- 判断什么时候搜索值得 token 倍增的代价（Game of 24、代码生成），什么时候单条轨迹就够了（简单问答）。

## 问题（The Problem）

Chain-of-thought 是一次线性行走。如果第一步错了，后面每一步都建立在错误的前提之上。在 Game of 24（用四个数字加上 + − × ÷ 凑出 24）这个任务上，GPT-4 的 CoT 准确率只有 4%。模型在早期挑错了子表达式，之后再也回不了头。

推理真正需要的，是提出多个候选、评估它们、挑出有希望的那些、并在死胡同时回溯的能力。这就是搜索。Tree of Thoughts 和 LATS 是其中两种典型的形式化方案。

## 概念（The Concept）

### Tree of Thoughts（Yao et al., NeurIPS 2023）

每个节点是一个连贯的中间步骤（「一个 thought」）。每个节点可以扩展出 K 个子 thought。LLM 用一段评分 prompt 给每个节点做自我评估。搜索就在这棵树上展开 —— BFS、DFS 或 beam search 都行。

```
                     (root: "find 24 from 4 6 4 1")
                    /               |            \
           ("6 - 4 = 2")    ("4 + 1 = 5")    ("4 * 6 = 24")  <- Score: HIGH
              /   \              |                  |
          ...    ...          ...                finish
```

自我评估是承重那一块。论文给出了三种变体：`sure / likely / impossible` 三档分类、`1..10` 数值打分，以及候选之间投票。三种方案在 Game of 24 上都比 CoT 强出一大截（GPT-4 上 4% → 74%）。

### LATS（Zhou et al., ICML 2024）

LATS 在 MCTS 框架下统一了 ToT、ReAct 和 Reflexion。LLM 同时扮演三种角色：

- **Policy（策略）**：提出候选的下一步动作（ReAct 风格）。
- **Value function（价值函数）**：给一段不完整的轨迹打分（ToT 风格的自我评估）。
- **Self-reflector（自我反思器）**：失败时写一段自然语言反思（Reflexion 风格），并用它来给后续 rollout 重新播种。

环境反馈（observation）会混入价值函数，让搜索基于真实工具结果而不仅是模型自己的意见。论文当时的结果：HumanEval pass@1 用 GPT-4 拿到 92.7%（SOTA），WebShop 用 GPT-3.5 平均 75.9（接近基于梯度的微调水平）。

### MCTS，最小版

每轮迭代有四个阶段：

1. **Select（选择）** —— 用 UCT（upper confidence bound for trees）从根走到一个叶子。
2. **Expand（扩展）** —— 通过 policy 生成 K 个子节点。
3. **Simulate（模拟）** —— 从某个子节点开始用 policy rollout，用价值函数（或环境奖励）给叶子打分。
4. **Backpropagate（回传）** —— 沿路径向上更新访问次数和价值估计。

UCT 公式：`Q(s, a) + c * sqrt(ln N(s) / N(s, a))`。第一项是利用（exploitation），第二项是探索（exploration）。`c` 要按任务调。

### 成本现实

搜索会让 token 用量爆炸。ToT 在 Game of 24 上用掉的 token 是 CoT 的 100–1000 倍。LATS 类似。这不是免费午餐；只在以下情况上搜索：

- 单条轨迹明显不够用的任务（Game of 24、复杂代码）。
- 墙上时钟（wall-clock）不如正确性重要的任务。
- 有便宜可靠的价值函数的任务（代码用单元测试，数学有明确目标）。

如果你的任务只有一个正确答案，但评估器还很噪，搜索往往会让结果更差 —— 它会找到一个「打分很高」的错误答案。

### 2026 年的定位

大多数生产级 agent 并不跑 LATS。它们跑的是带工具落地校验的 ReAct（CRITIC，详见 Lesson 05）。搜索只在一些特殊场景里出现：

- 用测试作为价值函数的代码 agent（HumanEval 那一类）。
- 探索多条 query 路径的 deep-research agent。
- LangGraph 子图（subgraph）里以规划为主的工作流。

AlphaEvolve（Lesson 11）是 2025 年的极端例子：在代码上做进化式搜索、机器可校验的适应度（fitness）、前沿级别的提升（56 年来首次改进 4×4 矩阵乘法）。

## 动手实现（Build It）

`code/main.py` 实现了：

- 一个迷你的 ToT BFS，跑在一个风格化的「挑选算术运算」任务上。
- 一个玩具版 LATS MCTS 循环，跑同一个任务（Select / Expand / Simulate / Backpropagate），用 UCT 做选择。
- 一个把符号化打分和自我评估打分组合起来的价值函数。

运行：

```
python3 code/main.py
```

Trace 里能看到 ToT 在每个节点用 BFS 扩展三个候选，对比 LATS 通过 MCTS 收敛到最佳 rollout。两边都打印 token 数。

## 用起来（Use It）

LangGraph 把 ToT 风格的探索作为子图模式发布；LangChain 团队 2024 年 5 月那篇关于 LATS 的博客是参考教程。LlamaIndex 提供了一个 `TreeOfThoughts` agent。在 2026 年大多数生产 agent 里，这个模式都藏在一个 `if task_complexity > threshold: use_search()` 的开关后面 —— 参见 Lesson 05 中的 evaluator-optimizer 模式。

## 上线部署（Ship It）

`outputs/skill-search-policy.md` 根据任务形态、预算和评估器保真度，在线性 ReAct、ToT、LATS 和进化式搜索之间做选型。

## 练习（Exercises）

1. 把玩具版 LATS 跑两遍：UCT `c=0.1` 与 `c=2.0`。trace 有什么不同？
2. 把价值函数换成一个更噪的打分器（加入随机抖动）。MCTS 还能找到最佳叶子吗？它能容忍的最低信噪比是多少？
3. 实现 beam-search 版本的 ToT（每层只保留 top-k），与 BFS 对比。在 token 预算紧张时哪个更好？
4. 阅读 LATS 第 5.1 节。复现 HumanEval 的 rollout 计数：要多少次 rollout 才能达到论文里报告的 pass@1？
5. 阅读 LATS 论文里关于「LATS 何时帮助有限」的讨论。写一段一段话的决策规则，把任务形态映射到搜索策略上。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际意思 |
|------|----------------|----------|
| Tree of Thoughts | 「分叉的 CoT」 | Yao et al. —— 带自我评估的 thought 节点树 |
| LATS | 「面向 LLM 的 MCTS」 | Zhou et al. —— 在 MCTS 下统一 ToT + ReAct + Reflexion |
| UCT | 「上置信界」 | 在利用（Q）和探索（ln N / n）之间平衡的选择公式 |
| Value function | 「这个状态有多好」 | LLM prompt 出来的分数或环境奖励；用于 backprop |
| Policy | 「动作提议器」 | ReAct 风格的生成器；产出候选的下一步 thought / action |
| Rollout | 「模拟轨迹」 | 用 policy 从某节点走到叶子，用 value 打分 |
| Backpropagate | 「更新祖先节点」 | 把叶子的奖励沿路径回传，更新访问次数和 Q |
| Search cost | 「token 爆炸」 | Game of 24 上 100–1000 倍 CoT；先算预算再用 |

## 延伸阅读（Further Reading）

- [Yao et al., Tree of Thoughts (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) —— 最经典的那篇
- [Zhou et al., LATS (arXiv:2310.04406)](https://arxiv.org/abs/2310.04406) —— 带 Reflexion 反馈的 MCTS
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— 用于搜索的子图模式
- [AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) —— 用程序化评估器做进化式搜索
