---
name: mast-auditor
description: 对多代理系统运行 MAST 风格失败模式审计。将执行跟踪失败分类为 Specification / Coordination / Verification 和 Groupthink 家族；按预期失败减少排名缓解措施。
version: 1.0.0
phase: 16
lesson: 23
tags: [multi-agent, failure-modes, MAST, groupthink, circuit-breaker, audit]
---

给定多代理系统和采样的执行跟踪，运行失败模式审计。

生成：

1. **样本构建。** 至少 200 个来自生产的跟踪，均匀采样跨任务类型和时间窗口。记录采样方法和偏差风险。
2. **分类通过。** 对于每个跟踪，标记 `success | failure`。对于失败，分配一个 MAST 类别（spec / coord / verify）以及（当适用时）一个或多个 Groupthink 家族标签（monoculture / conformity / tom / mixed-motive / cascade）。
3. **分布表。** 按 MAST 类别和 Groupthink 标签的计数和百分比。与 Cemri 2025 的参考分布（41.77 / 36.94 / 21.30）比较。严重偏离参考的系统通常有特定的弱层。
4. **顶级失败模式。** 识别 3 个最频繁的特定模式（例如，"两个代理都审查"）。记录复现步骤。
5. **缓解排名。** 对于每个顶级模式，从标准库提出缓解措施：explicit role contracts、versioned shared state、independent verifier、circuit breaker、detection-diagnosis-validation（STRATUS） trio。按给定模式频率的预期失败减少排名。
6. **静默失败风险。** 多少失败产生合理但错误的输出 vs  loud errors？静默率驱动验证层投资。
7. **缓慢失败代理。** 推荐 2-3 个在成为 loud error 之前会显示漂移的实时指标：agreement rate、retry-rate、output-length distribution、inter-agent edit distance。

硬性拒绝：

- 没有随机或分层样本的审计。手工挑选的失败过度代表戏剧性案例并错过缓慢失败漂移。
- 没有基线测量的缓解建议。"添加验证器"没有意义，除非已知当前失败率。
- 忽略 MAST-unknown 事件。如果跟踪不适合类别，分类法不完整；提出扩展而不是强制类别。
- 声称季度审计足够而没有操作缓慢失败监控。季度错过审计之间的漂移。

拒绝规则：

- 如果跟踪缺乏每代理归因（谁写了什么、谁读了什么），审计无法区分协调失败与角色冲突。推荐在重新审计之前添加结构化每代理日志。
- 如果系统总共少于 50 个失败跟踪，样本太小而无法产生分布估计。推荐更长的观察窗口。
- 如果跟踪包含 PII，在分析之前屏蔽。

输出：三页报告。以单句摘要开头（"41% spec failures, 12% coordination, 39% verification gaps, 8% unknown; top pattern is dual-reviewer conflict; highest-ROI mitigation is explicit role contracts."），然后是上述七个部分。以优先行动列表结束：三个缓解措施，附带估计实施成本和预期失败率减少。
