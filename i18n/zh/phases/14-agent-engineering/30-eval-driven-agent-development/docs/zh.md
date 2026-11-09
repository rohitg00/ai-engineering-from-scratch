# 基于Eval驱动的代理开发

> 国际娱乐平台注册平台"在线娱乐平台注册平台"在线娱乐平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册平台注册

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** All of Phase 14.
**Time:** ~60 minutes

## 学习目标

- 列出三个评估层静态基准,定制离线,在线生产以及每个层的目的.
- 解释评估者-优化器紧密循环.
- 描述2026年最佳实践:评估在代码旁边进行,运行在CI中,关口 PR.
- 连接每个阶段14课程到它生成的评估案例.

## 问题

代理通过演示.他们无法预测的方法无法生产.基准答案是"这个模型是否广泛的?"而不是"这个代理是否为我的产品发送正确的补丁?"答案是:在三个层次的评估,连续运行,每个防护和学习规则都被映射到一个评估案例.

## 概念

### 评估三层

1. **Static benchmarks**SWE-bench 验证代码 (课19),WebArena/OSWorld 浏览/桌面 (课20),GAIA 对于一般主义者 (课19),BFCL V4用于工具使用 (课06).用于跨模型比较和回归盖特.污染是真实的:SWE-bench+发现了32.67%的解决方案泄漏.总是报告SWE-bench Verified或SWE-bench+等泄漏审计集中的成绩.

2. **Custom offline evals**产品的形状:
   - 作为法官的LLM (Langfuse,城,Opik 课 24).
   - 基于执行 (运行补丁,检查测试).
   - 基于轨迹 (比较与黄金的行动序列;OSWorld-Human显示黄金的顶级代理人1.4-2.7倍).

3. **Online evals**生产:
   - 会议重播 (长).
   - 警报警报 (课 16,21).
   - 逐步成本/延迟追踪 (课程23 OTel范围).

### 评价器优化器 (人类)

紧密的循环:

1. 发射器产生输出.
2. 评价员评审员.
3. 在评估员通过之前,再精炼.

任何你关心的代理流量都可以用评估器优化,以确保可靠性.

### 2026 年最佳实践

- 子住在代码旁边.
- 报警每次公关.
- 通过测试结果,关口结合 (例如"没有回归>5%与主要").
- 每个护都会给一个评估案例.
- 每个学到的规则 (反思,工作流动支持学习规则) 都将一个失败案例映射出来.

### 结合14期

在第14阶段的大部分课程都产生了评估案例.表列出了最清楚的课程:

| Lesson | Eval case it generates |
|--------|------------------------|
| 01 Agent Loop | Budget-exhausted, infinite-loop guard |
| 02 ReWOO | Planner replans correctly when a tool fails |
| 03 Reflexion | Learned reflections apply on retry |
| 05 Self-Refine/CRITIC | Judge passes refined output |
| 06 Tool Use | Argument coercion works; unknown tools rejected |
| 07-10 Memory | Retrieval citations match sources; stale facts invalidate |
| 12 Workflow Patterns | Each pattern produces correct output |
| 13 LangGraph | Resume reproduces state exactly |
| 14 AutoGen Actors | DLQ catches crashed handlers |
| 16 OpenAI Agents SDK | Guardrail trips on the right inputs |
| 17 Claude Agent SDK | Subagent results return to orchestrator |
| 19-20 Benchmarks | SWE-bench Verified score, WebArena success rate, OSWorld efficiency |
| 21 Computer Use | Per-step safety catches injected DOM |
| 23 OTel | Spans emit required attributes |
| 26 Failure Modes | Detectors tag known failures |
| 27 Prompt Injection | PVE refuses poisoned retrievals |
| 28 Orchestration | Supervisor routes to the right specialist |
| 29 Runtime Shapes | DLQ handles N% failure |

如果你的评估套件每行都有一个案例,你已经覆盖了14阶段的核心.

### 没有评估驱动的开发

- **No baseline.**没有最后一个已知的东西的等值是不可读的.
- **LLM-judge without grounding.**评判模式 (课05) 评判理由在外部工具上.
- **Over-fitting to evals.**优化评估与生产有用性不同.
- **Flaky evals.**没有确定性的情况会引起虚假报警.

```figure
ae-eval-three-layers
```

## 建立它

`code/main.py`是一个 stdlib eval 带:

- 类别的案例登记簿 (标准标志,定制,在线).
- 一个经过测试的经纪人.
- 评估者-优化者循环:提出,判断,完善到通过或最大轮.
- 关口:总通过率+与基线相反的回归.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

输出:每案合格/失败,退缩标志,CI门判决.

## 用它

- 写出评估案例与代理代码相同的备忘录.
- 通过信息通讯,查看他们每一个公关.
- 没有回归的基础.
- 随着时间的推移.
- 连接每一个生产失败到一个新的案例.

## 运送它

`outputs/skill-eval-suite.md`建立一个为代理产品的三层评估套件,具有CI门和回归跟踪.

## 运动

1. 写一个复制的评估案例,你的代理现在通过了吗?
2. 建立一个为您的领域的LLM法官分类,以三个维度 (事实,语调,范围).
3. 输入评估套件到CI. 输出在>=5%回归.
4. 添加一个轨迹效率指标:代理采取了多少步骤?
5. 给你一个评估案例,每一个14阶段的课程.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Static benchmark | "Off-the-shelf eval" | SWE-bench, GAIA, AgentBench, WebArena, OSWorld |
| Custom offline eval | "Domain eval" | LLM-as-judge / exec / trajectory on your product shape |
| Online eval | "Production eval" | Session replay, guardrail alerts, cost/latency tracking |
| Evaluator-optimizer | "Propose-judge-refine" | Iterate until judge passes |
| CI gate | "Merge blocker" | Fail the build on eval regression |
| Baseline | "Last-known-good" | Reference score to detect regression |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human expert minimum |

## 进一步阅读

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)"开始简单,优化使用评估"
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) 评选的基准指数
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html)工具使用基准
- [Langfuse docs](https://langfuse.com/)评估+实践中重播会议
