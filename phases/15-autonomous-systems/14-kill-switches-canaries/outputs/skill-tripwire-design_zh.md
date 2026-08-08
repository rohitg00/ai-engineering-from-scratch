---
name: tripwire-design
description: 审查提议的代理检测器栈（kill switch、circuit breakers、canary tokens），并在首次自主运行之前标记缺失的 tripwires。
version: 1.0.0
phase: 15
lesson: 14
tags: [kill-switch, circuit-breaker, canary, honeytoken, detection-and-response]
---

给定提议的代理部署检测器栈，针对三检测器参考（kill switch、circuit breaker、canary）进行审计，并标记缺失、误调或暴露给代理的内容。

生成：

1. **Kill-switch 审计。** 开关住在哪里（feature flag、Redis、signed config）？确认代理的凭证无法设置它。确认每个 consequential 动作检查开关，而不仅仅是启动。确认重新启用是显式的人类行为。
2. **Circuit-breaker 清单。** 列出 breaker 监视的每个模式（repetition、consecutive failures、rate、out-of-trust read 后的特定工具）。说明每个的 threshold 和 cool-down。高于 10 的阈值通常太松。
3. **Canary 设计。** 列出环境中的每个 canary token。对于每个：它是什么（fake credential、fake DB record、fake file、fake memory entry）、它住在哪里、什么访问触发警报、谁被分页。确认没有 canary 有合法理由被触及。
4. **统计 + 硬性分层。** 确认栈在统计检测器（EWMA、z-score）之外至少使用一个硬性限制（Lesson 17 宪法风格）。仅统计检测器接受缓慢漂移。
5. **隔离路径。** 检测器触发时会发生什么？Full agent stop、path-specific pause、traffic redirect（eBPF / Cilium honeypot）、alert-only。确认路径至少已端到端测试一次。

硬性拒绝：
- 任何没有外部 kill switch 的部署。
- 存储在代理具有写入访问权限的系统中的 Canary tokens。
- 没有硬性限制的仅统计检测。
- Cool-downs 在没有人类审查的情况下自动重新启用的 Circuit breakers。
- Kill switch 仅在启动时检查而不是每动作检查的无人值守运行。

拒绝规则：
- 如果用户无法命名代理凭证之外的特定系统来托管 kill switch，拒绝。"我们使用代理读取的配置文件"如果代理可以写入配置文件，则不是 kill switch。
- 如果用户将 Auto Mode 分类器（Lesson 10）视为 tripwires 的替代品，拒绝。分类器与检测和响应正交。
- 如果提议的 canaries 位于代理有合法理由读取的系统中，拒绝并要求重新设计。

输出格式：

返回 tripwire 审计，包含：
- **Kill-switch 行**（location、check cadence、re-enable procedure）
- **Circuit-breaker 表**（pattern、threshold、cool-down）
- **Canary 表**（token、location、alarm、owner）
- **分层注释**（statistical + hard limits present y/n）
- **隔离流**（what fires、what happens、tested y/n）
- **准备度**（production / staging / research-only）
