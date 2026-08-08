---
name: search-policy
description: 给定任务形状、令牌预算和评估器质量，选择搜索策略（ReAct、ToT、LATS、进化）。
version: 1.0.0
phase: 14
lesson: 04
tags: [tree-of-thoughts, lats, mcts, search, value-function]
---

给定任务形状（单答案/多答案/开放式）、令牌预算和可用评估器（标量测试/启发式/自评估），生成搜索策略推荐及具体参数。

生成：

1. 决策。以下之一：线性 ReAct、beam ToT（束宽 k）、BFS ToT（最大深度）、带剪枝的 DFS ToT、MCTS LATS（迭代和 UCT c）、进化搜索（仅当评估器是可编程和可检查时）。
2. 参数。对于每个策略，具体数值默认值：束宽、深度上限、分支因子 K、每级 rollout、UCT c（默认 1.4）、超时。
3. 价值函数。准确说明节点评分内容。选项：单元测试通过率、到目标的数值距离、带格式（sure/likely/impossible 或 1..10 或投票）的提示 LLM 分数，或环境奖励。
4. 令牌预算估算。最坏情况令牌 = branching_factor ^ depth * avg_prompt_tokens。显示数字。如果超过用户预算，推荐更便宜的策略。
5. 失败模式。对于每个选定策略，列出前两种失败模式及其缓解措施（例如 LATS + 嘈杂评估器 -> 按 CRITIC 添加工具接地验证，Lesson 05）。

硬性拒绝：
- 评估器不可靠时推荐搜索（仅自评估，无真实值）。回退到 ReAct + CRITIC。
- 无充分理由将分支因子 K 设置高于 5。K=3-5 是论文默认值；K=10 爆炸成本。
- 将 LATS 应用于聊天风格任务。搜索对无程序化目标的对话问答无帮助。
- 无机器可检查适应度的进化搜索。仅当适应度是可编程的（运行测试、测量速度、验证定理）时 AlphaEvolve 才有趣。

拒绝规则：
- 如果令牌预算 < 5x 单轨迹成本，拒绝搜索并推荐 ReAct + Reflexion（Lesson 03）。
- 如果挂钟延迟预算 < 10 秒，拒绝 LATS 并推荐 ReAct。
- 如果任务是纯信息检索，拒绝搜索并推荐 ReWOO（Lesson 02）。

输出：推荐块（选定策略、参数、价值函数、预算估算）加"接下来阅读什么"注释，指向 Lesson 05（CRITIC）用于评估器可靠性、Lesson 11（AlphaEvolve）用于进化变体，或 Lesson 30（评估驱动开发）用于基准级验证。
