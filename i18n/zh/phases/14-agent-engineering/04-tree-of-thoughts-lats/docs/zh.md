# 思想和行动的树:故意搜索

> 单一的思想链轨迹没有回溯的空间.ToT (Yao等同,2023) 将推理转化为一个树,每个节点都具有自我评估.LATS (Zhou等同,2024) 在蒙特卡罗树搜索下统一了ToT与ReAct和反思.24的游戏从4% (CoT) 降至74% (ToT);LATS在HumanEval上达到92.7%的pass@1.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~75 minutes

## 学习目标

- 框架推理是搜索:节点是"思想",边缘是"扩展",价值是"有多有希望".
- 执行一个以Stdlib ToT方式的BFS树搜索,并进行自我评估分数.
- 扩展到玩具LATS MCTS循环,选择/扩展/模拟/反扩散.
- 决定什么时候搜索值得代币乘法 (24的游戏,代码生成) 和什么时候一个轨迹足够 (简单的问答).

## 问题

思考链是一个线性走路.如果第一步是错误的,每一步都会基于一个错误的前提.在24游戏 (使用+ − × ÷的四个数字使24),GPT-4 CoT达到4%的准确性.模型早就选择错误的子表达,无法恢复.

推理需要能够提出多个候选人,评估他们,选择有前途的候选人,然后在出现死胡同时回头.

## 概念

### 思想树 (Yao等, NeurIPS 2023)

每个节点是一个连贯的中间步骤 ("一个想法").每个节点可以扩展到K儿童思想.LLM自行评估每个节点.搜索探索树BFS,DFS或束.

```
                     (root: "find 24 from 4 6 4 1")
                    /               |            \
           ("6 - 4 = 2")    ("4 + 1 = 5")    ("4 * 6 = 24")  <- Score: HIGH
              /   \              |                  |
          ...    ...          ...                finish
```

报告显示有三个变体:`sure / likely / impossible`类别`1..10`两位候选人都在24场比赛中大大击败了CoT (4% -> 74%与GPT-4).

### 和其他 (LATS)

通过MCS,LATS统一了ToT,ReAct和Reflexion.

- **Policy**:提出候选人下一步行动 (ReAct式).
- **Value function**部分轨迹 (ToT式自计).
- **Self-reflector**对于失败,请写一个自然语言反思 (反思式) 并使用它来重新考虑未来的推广.

环境反 (观察) 混合在值函数中,因此搜索由实际工具结果进行信息,而不是仅仅是模型意见. 结果在纸质时间:HumanEval pass@1 92.7%与GPT-4 (SOTA),WebShop平均 75.9与GPT-3.5 (接近基梯度细调).

### 低于 MCTS

每次代的四个阶段:

1. **Select**使用UCT (树木上部的信任) 从根到叶子走路.
2. **Expand**通过政策产生K儿童.
3. **Simulate**使用政策的孩子的推广,以值函数 (或环境奖励) 评分.
4. **Backpropagate**更新访问数量和值估计.

电气电气电气`Q(s, a) + c * sqrt(ln N(s) / N(s, a))`首先是剥削,第二是探索.`c`根据任务.

### 成本现实

搜索爆炸代币.24游戏的ToT使用了1001000倍的CoT代币.LATS类似.这不是免费的;保留搜索:

- 单一轨迹显而易见不够的任务 (24个游戏,复杂代码).
- 工作时钟的重点不如正确.
- 具有廉价可靠值函数的任务 (代码的单元测试,数学的明确目标).

如果你的任务只有一个正确的答案,并且有个杂的评价者,搜索往往会使事情变得更糟它会找到一个"好评"的错误答案.

### 2026 定位

许多生产代理都不运行LATS. 他们运行ReAct,使用工具基准验证 (CRITIC,课05).

- 编码器,以值函数运行测试 (HumanEval式).
- 探讨多个查询路径的深度研究代理.
- 计划重的工作流程在LangGraph子图中.

炼 (课 11) 是2025年的极端:进化搜索代码,机器可检查的健身,边界增长 (56年来第一次4×4的炼改善).

```figure
tree-of-thoughts
```

## 建立它

`code/main.py`执行:

- 对于一个风格化的"选择算术运营"任务.
- 玩具LATS MCTS循环在同一任务上 (选择/扩展/模拟/回传) 与UCT选择.
- 构成一个象征性分数加上一个自我等值分数的值函数.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

随着BFS的扩展,TT的每个节点扩展了3个候选人,而LATS通过MCTS在最佳推出时相对而相比.

## 用它

兰格拉夫将ToT类型的探索作为子图案;兰格莱恩团队在LATS上的博客 (2024年5月) 是参考教程.`TreeOfThoughts`对于大多数2026年生产代理人来说,这种模式存在于`if task_complexity > threshold: use_search()`查看课05中的评估者优化模式.

## 运送它

`outputs/skill-search-policy.md`根据任务形状,预算和评估者忠诚度,选择线性ReAct,ToT,LATS和进化搜索.

## 运动

1. 运行玩具LATS与UCT c=0.1vsc=2.0. 什么改变的痕迹?
2. 换取一个噪音得分器的值函数 (添加随机震动). MCTS是否仍然找到最好的叶子?它容忍的最低信号噪音是多少?
3. 执行光束搜索ToT (在每个级别保持顶级) 和比较BFS. 紧张的代币预算中哪个更好?
4. 读LATS第5.1节. 复制HumanEval轨迹数量:需要多少次推出才能达到报告的pass@1?
5. 阅读LATS论文讨论"LATS帮助不多的时候".写一段决定规则,绘制任务形状,以搜索策略.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Tree of Thoughts | "Branching CoT" | Yao et al. — tree of thought nodes with self-evaluation |
| LATS | "MCTS for LLMs" | Zhou et al. — unifies ToT + ReAct + Reflexion under MCTS |
| UCT | "Upper confidence bound" | Select formula balancing exploitation (Q) and exploration (ln N / n) |
| Value function | "How good is this state" | Prompted LLM score or environment reward; feeds backprop |
| Policy | "Action proposer" | ReAct-style generator; emits candidate next thoughts/actions |
| Rollout | "Simulated trajectory" | Walk from a node to a leaf using policy, score with value |
| Backpropagate | "Update ancestors" | Push the leaf's reward up the path, updating visit counts and Q |
| Search cost | "Token explosion" | 100-1000x CoT on Game of 24; budget before you adopt |

## 进一步阅读

- [Yao et al., Tree of Thoughts (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601)法典论文
- [Zhou et al., LATS (arXiv:2310.04406)](https://arxiv.org/abs/2310.04406) MCTS与反思反
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)搜索的子图模式
- [AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131)与程序评价者进行进化搜索
