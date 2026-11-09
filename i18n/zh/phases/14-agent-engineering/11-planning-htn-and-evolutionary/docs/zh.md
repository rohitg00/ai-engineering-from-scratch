# 通过HTN和进化搜索进行规划

> 象征性规划处理了计划可以证明正确的情况.进化代码搜索处理了健身功能可以机器检查的情况.ChatHTN (2025) 和AlphaEvolve (2025) 显示了与LLM结合时每个程序都会解锁什么.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 02 (ReWOO and Plan-and-Execute)
**Time:** ~75 minutes

## 学习目标

- 解释层次任务网络:任务,方法,操作员,先决条件,效果.
- 描述ChatHTN的混合循环与LLM倒退分解的象征搜索.
- 解释AlphaEvolve的进化循环,以及为什么它只能与程序评估器合作.
- 执行玩具HTN规划器加上玩具进化搜索在STDlib.

## 问题

计划和执行,以及 ReAct 涵盖了大多数代理计划.

1. **Plans with provable correctness.**计划必须是合适的构建. 一个流动的LLM计划,有时会产生幻觉,是不可接受的.
2. **Optimizations with a machine-checkable fitness function.**矩阵乘法,规划的论,编译器通过 目标不是"正确的计划",而是"最佳计划".

 HTN 规划和 AlphaEvolve 解决了两个不同的问题.

## 概念

### 层次任务网络

 HTN 是:

- **Tasks**复合 (可分解) 和原始 (直接执行).
- **Methods**方法将复合任务分解成子任务,有先决条件.
- **Operators**具有先决条件和影响的原始行动.
- **State**一系列事实.

规划:给出目标任务和初始状态,找到一个分解为原始运营商,其先决条件是顺序满足的.

 HTN比 LLM更老,仍然是可证明正确的计划的参考.

### 特纳 (Gopalakrishnan等, 2025)

聊天网络 (arXiv:2505.11814) 与LLM查询交换了象征性HTN:

1. 试图用现有方法分解当前的复合任务.
2. 如果没有方法,请问法师:"你会如何分解?`task`在州`s`"我没有什么.
3. 转化LLM答案为候选子任务.
4. 根据操作符方案验证;拒绝无效的分解.
5. 复制.

论文的核心要求:每一个制造的计划都很合理,因为LLM建议只作为候选分解,从来没有作为直接的计划编辑.

在线学习方法 (OpenReview `gwYEDY9j2x`通过回归将LLM产生的分解量缩,降低LLM查询频率至75%的学习者.

### 果 (果) 产品

亚尔法Evolve (arXiv:2506.13131,DeepMind,2025年6月) 是一个不同的野兽:由双子座2.0闪电/Pro组合主导的进化代码搜索.

环节:

1. 开始一个种子程序 +一个程序评估员 (返回一个健身分数).
2. 法律法学团队提出突变.
3. 通过评估器进行突变.
4. 保持最好的; 变化再次.

发布的获奖:

- 在56年来,对4×4复杂矩阵乘法的斯特拉森的第一次改进 (48次 skalar乘法).
- 只有0.7%的人通过Borg的时间表表表表度来恢复谷歌的计算.
- 边境工作量增速32%.

们的们都在们的眼前,

### 什么时候使用

| Problem class | Use | Why |
|---------------|-----|-----|
| Scheduling with hard constraints | HTN + ChatHTN | Provable soundness |
| Compiler optimization | AlphaEvolve | Machine-checkable fitness |
| Multi-step task execution | ReAct / ReWOO | LLM in the loop, no formal guarantees |
| Code improvement with tests | AlphaEvolve | Tests are the evaluator |
| Policy-bound automation | HTN | Preconditions encode policy |

### 在这个模式出现错误的地方

- **HTN without operators.**没有先决条件/效果方案,稳定性要求崩.ChatHTN的"LLM建议分解"要求该方案拒绝无效的运动.
- **AlphaEvolve without a real evaluator.**"问法师,如果代码更好"不是一个健身功能.
- **Over-engineering.**大多数代理任务都不需要,先找ReAct或ReWOO.

```figure
htn-tree-expand
```

## 建立它

`code/main.py`实现两个玩具:

- 具有操作员,方法,先决条件,效果和一个`LLMFallback`现在,我们需要一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个程序,一个,一个程序,一个,一个,一个程序,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个,一个, 谁,一个
- 通过数学的程序进行一个简单的进化搜索: 增长出口量最小化的表达式`|f(x) - target|`评估器是确定性的.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

痕迹显示HTN规划器分解一个复合任务 (具有中期计划LLM倒退) 和进化循环在目标表达式上融合.

## 用它

- **HTN planners** `pyhop`现在`SHOP3`或是为特定领域的政策执行而建立自己的.
- **ChatHTN**研究代码;图案 (象征性+LLM倒退) 清洁地将其输送到任何HTN规划器.
- **AlphaEvolve** DeepMind 论文;模式 (组件+评估器) 可复制.OpenEvolve 和类似的开源叉子正在出现.
- **Agent frameworks**没有出货第一级 HTN或AlphaEvolve.

## 运送它

`outputs/skill-hybrid-planner.md`产生一个混合规划器架子 (HTN或进化) 具有明确的 LLM 角色.

## 运动

1. 延长HTN规划器后续追踪:当运营商的后条件在运行时失败时,倒车并尝试下一个方法.
2. 添加LLM方法缓存到ChatHTN:当LLM分解任务时`T`在状态模式中`P`在下一次电话中,请检查方法库.
3. 改进进性搜索评估器,将其转换为实验套件. 开发一个通过20个测试案例的排序函数; 报告代数到融合.
4. 阅读AlphaEvolve的评估器设计说明. 设计一个对您关心的域名进行评估器 (SQL查询优化,测试组最小化,部署YAML).
5. 结合:使用HTN将复合任务分解为子任务,然后使用进化搜索在每个子任务的原始运算器上.它在哪里闪耀,它在哪里过度工程?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| HTN | "Hierarchical planner" | Task decomposition with operators, preconditions, effects |
| Method | "Decomposition rule" | Way to break a compound task into subtasks |
| Operator | "Primitive action" | Concrete step with precondition and effect |
| ChatHTN | "LLM + HTN" | Symbolic planner asks LLM when no method matches |
| AlphaEvolve | "Evolutionary code search" | Ensemble LLMs mutate code; deterministic evaluator selects |
| Fitness function | "Evaluator" | Deterministic, machine-checkable score over outputs |
| Online method learning | "Cached LLM decomposition" | Store + generalize LLM plans to cut query cost |

## 进一步阅读

- [Gopalakrishnan et al., ChatHTN (arXiv:2505.11814)](https://arxiv.org/abs/2505.11814)象征性+LLM混合规划器
- [Novikov et al., AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131)与LLM突变的进化代码搜索
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)什么时候达到规划器与简单循环
