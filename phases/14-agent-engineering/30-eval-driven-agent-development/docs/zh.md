# 30 · 评测驱动的智能体开发

> Anthropic 的建议是：「从简单的提示词开始，用全面的评测来优化它们，只在确有必要时才加入多步智能体系统。」评测不是最后一步，它是驱动第 14 阶段所有其他选择的外层循环。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置：** 完成第 14 阶段全部内容。
**时长：** 约 60 分钟

## 学习目标

- 说出三个评测层级——「静态基准（static benchmarks）」、「自定义离线评测（custom offline）」、「线上生产评测（online production）」——以及各自的用途。
- 解释「评估器-优化器（evaluator-optimizer）」的紧密循环。
- 描述 2026 年的最佳实践：评测与代码放在一起、在 CI 中运行、对 PR 进行门禁。
- 把第 14 阶段的每一课与它所产生的评测用例对应起来。

## 问题所在

智能体能通过演示（demo），却会以演示无法预测的方式在生产中失败。基准回答的是「这个模型是否具备广泛能力？」，而不是「这个智能体是否为我的产品交付了正确的补丁？」答案是：在三个层级上进行评测，持续运行，并把每一道护栏（guardrail）和每一条习得规则都映射到一个评测用例上。

## 核心概念

### 三个评测层级

1. **静态基准（static benchmarks）** —— 面向代码的 SWE-bench Verified（第 19 课），面向浏览/桌面的 WebArena/OSWorld（第 20 课），面向通用智能的 GAIA（第 19 课），面向工具调用的 BFCL V4（第 06 课）。用于跨模型对比和回归门禁。数据污染是真实存在的：SWE-bench+ 发现了 32.67% 的解答泄漏。务必报告 Verified / 经过审计（+-audited）的分数。

2. **自定义离线评测（custom offline evals）** —— 贴合你产品的形态：
   - 「LLM 作为评判者（LLM-as-judge）」（Langfuse、Phoenix、Opik——第 24 课）。
   - 基于执行的评测（运行补丁，检查测试）。
   - 基于轨迹的评测（将动作序列与黄金标准对比；OSWorld-Human 显示顶级智能体的步数是黄金标准的 1.4-2.7 倍）。

3. **线上评测（online evals）** —— 生产环境：
   - 会话重放（Langfuse）。
   - 护栏触发的告警（第 16、21 课）。
   - 逐步的成本/延迟追踪（第 23 课的 OTel span）。

### 评估器-优化器（Anthropic）

这个紧密循环是：

1. 提议器（proposer）生成输出。
2. 评估器（evaluator）进行评判。
3. 反复精修，直到评估器通过。

这是「自我精修（Self-Refine）」（第 05 课）的泛化形式。任何你在意的智能体流程，都可以包裹进评估器-优化器循环以获得可靠性。

### 2026 年最佳实践

- 评测与代码放在一起。
- 在每个 PR 上通过 CI 运行评测。
- 以评测分数对合并进行门禁（例如「相对 main 分支回归不超过 5%」）。
- 每一道护栏都映射到一个评测用例。
- 每一条习得规则（Reflexion、pro-workflow 的 learn-rule）都映射到一个失败用例。

### 把第 14 阶段串起来

第 14 阶段的每一课都会产生评测用例：

| 课程 | 它产生的评测用例 |
|--------|------------------------|
| 01 智能体循环（Agent Loop） | 预算耗尽、无限循环防护 |
| 02 ReWOO | 当某个工具失败时，规划器能正确重新规划 |
| 03 Reflexion | 习得的反思能在重试时生效 |
| 05 Self-Refine/CRITIC | 评判者通过精修后的输出 |
| 06 工具调用（Tool Use） | 参数强制转换可用；未知工具被拒绝 |
| 07-10 记忆（Memory） | 检索引用与来源匹配；过时事实被作废 |
| 12 工作流模式（Workflow Patterns） | 每种模式都产生正确输出 |
| 13 LangGraph | 恢复时能精确重现状态 |
| 14 AutoGen Actors | DLQ 能捕获崩溃的处理器 |
| 16 OpenAI Agents SDK | 护栏在正确的输入上触发 |
| 17 Claude Agent SDK | 子智能体结果能返回给编排器 |
| 19-20 基准（Benchmarks） | SWE-bench Verified 分数、WebArena 成功率、OSWorld 效率 |
| 21 计算机操作（Computer Use） | 逐步安全检查能拦住被注入的 DOM |
| 23 OTel | span 能发出必需的属性 |
| 26 失败模式（Failure Modes） | 检测器能标记已知失败 |
| 27 提示注入（Prompt Injection） | PVE 拒绝被投毒的检索结果 |
| 28 编排（Orchestration） | 监督器能路由到正确的专家 |
| 29 运行时形态（Runtime Shapes） | DLQ 能处理 N% 的失败 |

如果你的评测套件对上述每一项都有用例，你就覆盖了整个第 14 阶段。

### 评测驱动开发会在哪里失效

- **没有基线。** 没有「最近的已知良好版本（last-known-good）」，评测结果无法解读。要存储基线。
- **没有接地的 LLM 评判者。** 评判者也会产生幻觉。用 CRITIC 模式（第 05 课）——让评判者基于外部工具来接地（ground）。
- **对评测过拟合。** 为评测做优化会偏离生产中的实际有用性。要轮换用例。
- **不稳定的评测。** 非确定性用例会造成误报。固定随机种子，对状态做快照。

## 动手构建

`code/main.py` 是一个基于标准库的评测框架（harness）：

- 带分类（benchmark、custom、online）的用例注册表。
- 一个被测的脚本化智能体。
- 评估器-优化器循环：提议、评判、精修，直到通过或达到最大轮数。
- CI 门禁：汇总通过率 + 相对基线的回归。

运行它：

```
python3 code/main.py
```

输出：逐用例的通过/失败、回归标志、CI 门禁裁决。

## 如何使用

- 把评测用例写在与智能体代码相同的代码仓库里。
- 通过 CI 在每个 PR 上运行它们。
- 出现回归时让构建失败。
- 长期跟踪通过率。
- 把每一次生产失败都关联到一个新用例。

## 交付

`outputs/skill-eval-suite.md` 会为一个智能体产品构建带 CI 门禁和回归跟踪的三层评测套件。

## 练习

1. 选取你的一次生产失败。写一个能复现它的评测用例。你的智能体现在能通过吗？
2. 为你的领域构建一个含三个维度（事实性、语气、范围）的 LLM 评判者评分细则（rubric）。给 50 个会话打分。
3. 把评测套件接入 CI。当回归 >=5% 时让构建失败。
4. 加入一个轨迹效率指标：相比黄金轨迹，智能体多走了多少步？
5. 把第 14 阶段的每一课都映射到你套件中的一个评测用例。有遗漏吗？那就是要补上的缺口。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| 静态基准（Static benchmark） | 「现成的评测」 | SWE-bench、GAIA、AgentBench、WebArena、OSWorld |
| 自定义离线评测（Custom offline eval） | 「领域评测」 | 在你产品形态上运行的 LLM-as-judge / 执行 / 轨迹评测 |
| 线上评测（Online eval） | 「生产评测」 | 会话重放、护栏告警、成本/延迟追踪 |
| 评估器-优化器（Evaluator-optimizer） | 「提议-评判-精修」 | 反复迭代直到评判者通过 |
| CI 门禁（CI gate） | 「合并阻断器」 | 出现评测回归时让构建失败 |
| 基线（Baseline） | 「最近的已知良好版本」 | 用于检测回归的参考分数 |
| 轨迹效率（Trajectory efficiency） | 「相对黄金标准的步数」 | 智能体步数除以人类专家的最小步数 |

## 延伸阅读

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 「从简单开始，用评测优化」
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) —— 经过精挑的基准
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) —— 工具调用基准
- [Langfuse docs](https://langfuse.com/) —— 实践中的评测 + 会话重放
