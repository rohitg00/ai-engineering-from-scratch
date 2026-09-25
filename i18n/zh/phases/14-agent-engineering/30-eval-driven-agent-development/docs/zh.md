# 评测驱动的智能体开发

> Anthropic 的指导原则："从简单的 prompt 开始，通过全面的评估进行优化，仅在需要时才添加多步智能体系统。" 评估不是最后一步。它是驱动 Phase 14 中所有其他选择的外层循环。

**Type:** Learn + Build
**Languages:** Python (标准库)
**Prerequisites:** Phase 14 全部内容。
**Time:** 约 60 分钟

## 学习目标

- 说出三个评估层——静态基准、自定义离线评估、在线生产评估——以及各自的用途。
- 解释评估器-优化器的紧密循环。
- 描述 2026 年的最佳实践：评测与代码同库存放、在 CI 中运行、作为 PR 的门禁。
- 将 Phase 14 的每一课与它产生的评测用例关联起来。

## 问题所在

智能体能通过演示。但它们在生产环境中会以演示无法预测的方式失败。基准测试回答的是“这个模型整体能力如何？"，而不是"这个智能体是否在为我的产品提交正确的补丁？"答案是：在三个层次上持续运行评估，并将每条防护栏和学到的规则映射到一个评测用例。

## 核心概念

### 三个评估层

1. **静态基准** — 代码用 SWE-bench Verified（第 19 课），浏览/桌面用 WebArena/OSWorld（第 20 课），通用智能用 GAIA（第 19 课），工具使用用 BFCL V4（第 06 课）。用于跨模型比较和回归门禁。数据污染是真实存在的：SWE-bench+ 发现了 32.67% 的解法泄露。务必报告经过审计的 Verified / +- 分数。

2. **自定义离线评测** — 针对你产品的形态：
   - LLM 作为裁判（Langfuse、Phoenix、Opik——第 24 课）。
   - 基于执行（运行补丁，检查测试）。
   - 基于轨迹（将动作序列与黄金标准对比；OSWorld-Human 显示顶级智能体比黄金标准高 1.4-2.7 倍）。

3. **在线评测** — 生产环境：
   - 会话回放（Langfuse）。
   - 防护栏触发的告警（第 16、21 课）。
   - 每步成本/延迟追踪（第 23 课 OTel spans）。

### 评估器-优化器（Anthropic）

紧密循环：

1. 提议者生成输出。
2. 评估者进行评判。
3. 迭代改进，直到评估者通过。

这是 Self-Refine（第 05 课）的泛化形式。任何你关心的智能体流程都可以用评估器-优化器包装以提高可靠性。

### 2026 年最佳实践

- 评测与代码同库存放。
- 在 CI 中对每个 PR 运行。
- 以评测分数作为合并门禁（例如“相对 main 的回归不得超过 5%"）。
- 每条防护栏对应一个评测用例。
- 每条学到的规则（Reflexion、pro-workflow learn-rule）对应一个失败用例。

### 串联 Phase 14

Phase 14 的每一课都产生评测用例：

| 课程 | 它产生的评测用例 |
|--------|------------------------|
| 01 Agent Loop | 预算耗尽、无限循环防护 |
| 02 ReWOO | 工具失败时规划器正确重规划 |
| 03 Reflexion | 学到的反思在重试时被应用 |
| 05 Self-Refine/CRITIC | 裁判通过改进后的输出 |
| 06 Tool Use | 参数强制转换正常；未知工具被拒绝 |
| 07-10 Memory | 检索引用与来源匹配；过时事实被失效处理 |
| 12 Workflow Patterns | 每种模式产生正确输出 |
| 13 LangGraph | 恢复后状态完全一致 |
| 14 AutoGen Actors | DLQ 捕获崩溃的处理器 |
| 16 OpenAI Agents SDK | 防护栏对正确的输入触发 |
| 17 Claude Agent SDK | 子智能体结果返回给编排器 |
| 19-20 Benchmarks | SWE-bench Verified 分数、WebArena 成功率、OSWorld 效率 |
| 21 Computer Use | 逐步安全检查捕获注入的 DOM |
| 23 OTel | Spans 发出必需的属性 |
| 26 Failure Modes | 检测器标记已知失败 |
| 27 Prompt Injection | PVE 拒绝被污染的检索内容 |
| 28 Orchestration | 监督者路由到正确的专家 |
| 29 Runtime Shapes | DLQ 处理 N% 的失败 |

如果你的评测套件覆盖了以上每一项，你就覆盖了 Phase 14。

### 评测驱动开发失效的场景

- **没有基线。** 缺少最近已知良好版本的评测结果无法解读。务必存储基线。
- **LLM 裁判缺乏依据。** 裁判也会产生幻觉。使用 CRITIC 模式（第 05 课）——让裁判基于外部工具进行验证。
- **对评测过拟合。** 针对评测做优化会偏离生产实用性。定期轮换用例。
- **不稳定的评测。** 非确定性用例会导致误报。固定随机种子，对状态做快照。

```figure
ae-eval-three-layers
```

## 动手构建

`code/main.py` 是一个基于标准库的评测框架：

- 带类别（benchmark、custom、online）的用例注册表。
- 一个被测的脚本化智能体。
- 评估器-优化器循环：提议、评判、迭代改进，直到通过或达到最大轮数。
- CI 门禁：汇总通过率 + 相对基线的回归检查。

运行它：

```
python3 code/main.py
```

输出：每个用例的通过/失败、回归标记、CI 门禁判定。

## 加以运用

- 在与智能体代码相同的仓库中编写评测用例。
- 通过 CI 在每个 PR 上运行它们。
- 出现回归时使构建失败。
- 持续追踪通过率随时间的变化。
- 将每个生产失败关联到一个新用例。

## 交付上线

`outputs/skill-eval-suite.md` 为一个智能体产品构建三层评测套件，包含 CI 门禁和回归追踪。

## 练习

1. 选一个你的生产失败案例。编写一个能复现它的评测用例。你的智能体现在能通过吗？
2. 为你的领域构建一个 LLM 裁判评分标准，包含三个维度（事实性、语气、范围）。对 50 个会话打分。
3. 将评测套件接入 CI。出现 >=5% 回归时使构建失败。
4. 添加一个轨迹效率指标：智能体用了多少步 vs 黄金轨迹？
5. 将 Phase 14 的每一课映射到你套件中的一个评测用例。有缺失吗？那就是需要补上的缺口。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Static benchmark | "现成的评测" | SWE-bench、GAIA、AgentBench、WebArena、OSWorld |
| Custom offline eval | "领域评测" | 针对产品形态的 LLM-as-judge / 执行 / 轨迹评估 |
| Online eval | "生产评测" | 会话回放、防护栏告警、成本/延迟追踪 |
| Evaluator-optimizer | "提议-评判-改进" | 迭代直到裁判通过 |
| CI gate | "合并阻断器" | 评测出现回归时使构建失败 |
| Baseline | "最近已知良好版本" | 用于检测回归的参考分数 |
| Trajectory efficiency | "相对黄金标准的步数" | 智能体步数除以人类专家最少步数 |

## 延伸阅读

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — "从简单开始，用评测优化"
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — 经过整理的基准
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) — 工具使用基准
- [Langfuse docs](https://langfuse.com/) — 评测与会话回放的实践