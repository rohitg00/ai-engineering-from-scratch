# 自主编码代理景观 (2026)

> 在三年内,SWE-bench Verified从4%上升到80.9%. 同样的Claude Sonnet 4.5在SWE-agent v1上获得了43.2%的分数,59.8%在Cline自主,模型周围的架架现在与模型本身一样重要. 开户手 (原是OpenDevin) 是最活跃的MIT许可平台,其CodeAct循环直接执行Python操作在沙盒中,而不是JSON工具调用. 标题数字隐藏了一个方法问题:在500个SWE-bench验证任务中,161只需要12行变化,而SWE-bench Pro (10+行任务) 在相同的边界模型中占2359%

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, CodeAct vs JSON tool-call comparison)
**Prerequisites:** Phase 14 · 07 (Tool use), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## 问题

问题是:在一个与我工作相匹配的任务分配下,

在2022年至2026年间,该领域学会了架,检索层,规划器,沙盒,编辑-验证循环,反格式, 在SWE-agent v1上,Claude Sonnet 4.5在SWE-bench Verified上获得了43.2%的分数;在Cline的自动架子内,同样的模型获得了59.8%. 16.6 绝对差异点,重量相同. 基本模型是一个组成部分,循环是产品.

随之而来的问题是,基准度隐藏了回归.SWE-bench Verified接近度,而轻松任务尾声 (161个500项任务需要 ≤2行) 拉上了顶级分数.现实世界质量更好地测量在SWE-bench Pro (10+行变化) 等分布上,其中相同的领导者仍然坐在2359%.

## 概念

### 苏联委员会,一段

通过基因真相补丁,SWE-bench (Jimenez等) 将真正的GitHub问题处理,并要求代理制作一个补丁,使测试套件通过.SWE-bench Verified (OpenAI, 2024) 是由人类策划的500个任务子集,其中模糊和破解的任务被删除.SWE-bench Pro是更难的继承者.需要10+行变化的任务,目前的边境代理处于2359%.

### 实际上2022年到2026年曲线显示的

- **2022**的研究模型在原材料中占~4%.
- **2024**:GPT-4 + 德文式架在 ~ 14%;SWE剂在 ~ 12%
- **2025**: 克劳德3.5/3.7 内和SWE剂推进到4055%的范围.
- **2026**欧盟的领导者:Claude Sonnet 4.5和边界竞争对手在SWE-bench Verified上以7080%以上的价格.

倾斜来自三个组合来源:更好的基模型,更好的架构 (CodeAct,反射,验证循环) 和更好的基准 (验证消除噪音).

### 代码Act与JSON工具调用

开手 (All-Hands-AI, arXiv:2407.16741,以前是OpenDevin) 采取了特定的架构投注:而不是模型发射一个主机解码和执行的JSON工具调用,模型发射了Python代码,一个Jupyter式内核将其运行在一个沙盒中.代理可以循环文件,链工具,并在一个操作中捕获自己的例外.

交易:

- **JSON tool calls**:每次行动都是一次回复的;易于进行审计;具有有限的组合性;默认安全,因为每次调用都通过了明确的验证器.
- **CodeAct**操作可能是整个程序; 构成; 需要硬化的沙盒 (OpenHands使用Docker隔离); 失败模式包括沙盒运行时间允许的任何东西.

两个架构都在生产中. CodeAct 在开放平台 (OpenHands, smolagents) 中占主导地位. JSON 工具调用仍然占主导地位在管理服务 (人类管理代理,OpenAI助理) 中,供应商控制执行者.

### 2026年景观中的架

| Scaffold | License | Execution model | Notable property |
|---|---|---|---|
| OpenHands (OpenDevin) | MIT | CodeAct in Docker | Most active open platform; event-stream replayable |
| SWE-agent | MIT | Agent-Computer Interface (ACI) | First end-to-end SWE-bench scaffold |
| Aider | Apache-2 | edit-via-diff in local repo | Minimal scaffold, strong regression stability |
| Cline | Apache-2 | VS Code agent with tool policy | Highest-scoring open scaffold on Sonnet 4.5 |
| Devin (Cognition) | Proprietary | Managed VM + planner | First "AI software engineer" product category |
| Claude Code | Proprietary | Permission modes + routines | Lesson 10 covers the agent loop in detail |

### 为什么脚架占据主导地位

编码运行是一个长视线轨迹 (课 1) 可靠性化合物跨步骤.三个地方,架架购买点:

1. **Retrieval**现在,我们需要一个新的方法来找到正确的文件,
2. **Verifier loop**测试,阅读堆痕迹,再试一次是10+点的三角形.
3. **Failure containment**由于这种情况,我们可以看到一个系统的变化,但它不能变化.

### 基准和实际分布

开手作者和Epoch AI都指出,SWE-bench Verified具有一个简单的尾声:500项任务中161只需要12行变化.高分数部分是由这个尾声驱动的.SWE-bench Pro限制到10+行变化,即使是边界系统也会返回2359%的分数.您的生产分布几乎肯定更接近Pro而不是 Verified.

选择代理的含义:运行您自己的 bug 后备的 Pro 类子集.重要的是您运送的任务的分数.

```figure
a5-scaffold-delta
```

## 用它

`code/main.py`根据固定的迷你任务分布,比较两个玩具代理架子:

1. **JSON tool-call**架每轮都需要一次行动.
2. **CodeAct**通过一个脚架,每次操作可以发出一个小的Python截图.

两者都使用一个"模型" (确定性规则) 杆,因此比较将架架与模型质量隔离.输出显示,CodeAct架架以更大的每动作爆炸半径的成本在更少的转折中解决更多任务.

## 运送它

`outputs/skill-scaffold-audit.md`帮助您在采用之前审核拟议的编码代理架构:检索质量,验证器存在,沙盒隔离和基准配送适合性.

## 运动

1. 跑步`code/main.py`每个脚架都在同一任务中做多少转?

2. 阅读OpenHands论文 (arXiv:2407.16741).论文认为 CodeAct 比复杂任务的JSON工具调用更好. 确定一种失败模式,该论文承认,并写一句话,当该模式在生产中占主导地位时.

3. 在您的 bug 后备中选择一个任务,需要在两个文件中进行10+ 个变化行.根据 (a) JSON 工具调用和 (b) CodeAct 估计边界模型的端到端成功概率.证明差距.

4. 通过SWE-bench Verified,我们可以完成161个单文件,12行任务. 构建一个排列表的分数,排除它们.

5. 阅读"引入SWE-bench Verified" (OpenAI). 解释消除模糊任务所使用的具体方法,并命名一个类别,策展会错过.

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| SWE-bench | "Coding benchmark" | Real GitHub issues with ground-truth patches and test suites |
| SWE-bench Verified | "Cleaned subset" | 500 human-curated tasks, easier-tail present |
| SWE-bench Pro | "Harder subset" | 10+ line changes; frontier sits at 23–59% |
| CodeAct | "Code-as-action" | Agent emits Python; Jupyter-style kernel executes in sandbox |
| JSON tool call | "Function calling" | Each action is a structured JSON payload validated before execution |
| Scaffold | "Agent framework" | Retrieval + planner + executor + verifier loop around the base model |
| ACI (Agent-Computer Interface) | "SWE-agent's format" | Command set designed for LLM ergonomics, not human shells |
| Verifier loop | "Test-and-retry" | Run tests, read output, revise patch; biggest non-model reliability gain |

## 进一步阅读

- [Jimenez et al. — SWE-bench](https://www.swebench.com/)原始基准和方法.
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/)如何构建选定的子集.
- [Wang et al. — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) CodeAct 架构和事件流设计.
- [Epoch AI — SWE-bench leaderboard](https://epoch.ai/benchmarks)现场记录.
- [Anthropic — Measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy)长视野编码剂可靠性框架.
