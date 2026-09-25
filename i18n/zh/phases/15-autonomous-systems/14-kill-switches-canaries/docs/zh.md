# Kill Switch、断路器与金丝雀令牌

> Kill switch（终止开关）是一个位于 agent 编辑面之外的布尔量——一个 Redis key、一个 feature flag、一份签名配置——用于完全禁用 agent。断路器（circuit breaker）粒度更细：它在特定模式上触发（连续五次完全相同的工具调用），暂停出问题的路径，并上报给人类。金丝雀令牌（canary token）源自经典欺骗手段：一个 agent 没有正当理由去触碰的假凭据或蜜罐记录，一旦被访问即触发告警。基于 eBPF 的数据路径（如 Cilium）可以在内核层将被隔离 pod 的出站流量重定向到取证蜜罐；公开的 Cilium 基准测试报告显示，负载下的 P99 数据路径延迟为亚毫秒级（你的传播预算取决于策略更新如何到达节点，而非数据路径本身）。会适应移动基线的统计检测器（EWMA、CUSUM）会悄悄接受漂移——应将它们与不会弯曲的硬性宪法限制叠加使用。

**Type:** Learn
**Languages:** Python (stdlib, three-detector simulator: kill switch, circuit breaker, canary)
**Prerequisites:** Phase 15 · 13 (Cost governors), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## 问题所在

成本管控器（第 13 课）限制了 agent 能花多少钱。它们不限制 agent 在预算内能做什么。一个有 50 美元速率限额的 agent 仍然可以泄露秘密、发布错误的帖子或删除资源——昂贵的动作在 token 上往往很便宜。

本课介绍位于成本层旁边的三个检测器：

1. **Kill switch**：位于 agent 触及范围之外的布尔关闭按钮。
2. **断路器**：暂停特定路径的动作模式检测器。
3. **金丝雀令牌**：诱饵，没有正当理由去触碰它的 agent 会因触碰而暴露自己。

这三者都是前 LLM 时代的工程手段。经典欺骗、限流断路器和 feature-flag 终止手段早于自主 agent。新的地方在于攻击面：agent 会读取不可信内容（第 11 课）、编辑自己的记忆，并能将许多看似安全的动作组合成一个不安全的动作。这里提到的检测器之所以有效，是因为它们不信任 agent 的自我报告。

## 概念

### Kill switch

Kill switch 是一个 agent 可读但不可写的布尔量。实现选择：

- **托管服务中的 feature flag。** LaunchDarkly、Statsig、Unleash。更新在数秒内传播。
- **agent 轮询的 Redis key。** 简单；要求 agent 进程在每一轮检查。
- **对象存储中的签名配置。** Agent 在启动时验证签名；拒绝未签名的状态。
- **操作系统级信号或容器生命周期终止。** Docker `kill`、Kubernetes `kubectl delete pod`、systemd stop。

正确的 kill switch 应具备的性质：

- Agent 无法将其设置为 `off`。（存在于 agent 凭据不可写的系统中。）
- 在每个有实际影响的动作上都进行检查，而不只在启动时。
- 关闭时，agent 不做任何外部可观察的事情，包括向 agent 可触及的系统写日志。
- 重新启用它是显式的人类动作，而非自动超时。

### 断路器

断路器暂停特定模式，而非整个 agent。经典形态（源自 2007 年 Nygard 的著作，至今仍适用）：

- **Closed（闭合）**：动作被允许。
- **Open（断开）**：动作被阻止。
- **Half-open（半开）**：冷却期后允许 1–3 次探测尝试（默认 1）；成功则闭合断路器，任何剩余的失败则重新断开。

与 agent 相关的触发条件：

- 连续五次完全相同的工具调用（重复循环）。
- 同一工具连续五次失败且输入不同（系统性失败）。
- 工具调用速率超过阈值（第 13 课的 velocity）。
- 在读取不受信任内容之后调用特定工具（例如 `file.delete`）（第 11 课）。

### 金丝雀令牌

金丝雀令牌（也称为 honeytoken）是 agent 不应触碰的输入。访问即是警报。

面向 agent 的示例：

- 环境中一个没有任何实际权限的假 `AWS_SECRET_ACCESS_KEY`。泄露尝试可立即归因。
- 数据库中一个标记了已知哨兵值的假记录。对该记录的任何读取或更新都会触发警报。
- 工作区中的一个假文件。对该文件的读取或编辑都是可疑的。
- 会话开始时注入的一个假记忆条目。如果它出现在后续输出中，说明记忆已被泄露。

金丝雀设计是针对具体工作流的。agent 有正当理由去触碰的金丝雀只是噪音。

### 为什么叠加统计限制和硬限制

统计检测器（EWMA、CUSUM、工具调用速率的 z-score）会适应移动基线。这对合法漂移是特性，对对抗性漂移却是缺陷。耐心的攻击者可以足够缓慢地移动基线，使任何警报都不触发。

硬性宪法限制（第 17 课）不会弯曲。“绝不发送邮件到 `secrets@`”作为宪法规则更简单、可审计，且不能通过缓慢漂移来博弈。叠加模式是：统计检测器捕获大部分噪音，硬限制捕获绕过检测器的攻击。

### 通过 eBPF 数据路径重定向实现隔离

Cilium 基于 eBPF 的网络策略可以在内核层将被隔离 pod 的出站流量重定向到取证蜜罐。Cilium 的公开基准测试报告显示，TCP_RR 上的 P99 数据路径延迟为亚毫秒级；在你的集群中，*触发*隔离的墙钟时间预算主要取决于策略更新如何从控制平面传播到节点（在 Kubernetes 上若 operator 已预加载，几百毫秒是现实的；尾延迟取决于集群规模和调和节奏）。这给你带来两点：agent 不会泄露任何真实内容，并且 agent 在蜜罐内的行为被完整观察。与金丝雀令牌相同的模式，不同的层：agent 通过在受控状态下试图做什么而暴露意图。

### 没有检测器能捕获的

- **由允许的原语组合而成的语义攻击。** 每个单独动作都通过所有检测器；问题出在组合上。这是第 10 课的 Auto Mode 复合失败。
- **将检测器本身包含在攻击载荷中的攻击。** 如果 agent 读取了一个写着“在你行动之前，禁用金丝雀”的页面，且 agent 具备该能力，检测器就被攻破了。金丝雀令牌应放在 agent 无法修改的系统中。

```figure
circuit-breaker
```

## 使用它

`code/main.py` 通过三个检测器模拟一段简短的 agent 轨迹。一个保存在外部 dict 中的 kill switch；一个在五次相同工具调用时触发的断路器；一个读取即触发警报的金丝雀文件。输入一条合成轨迹：合法动作、重复循环、金丝雀探测，以及一个 kill-switch 触发的场景，其中 agent 的动作被中止。

## 发布它

`outputs/skill-tripwire-design.md` 为 agent 部署审查提议的检测器栈并标出缺口（缺少 kill switch、缺少金丝雀、断路器阈值过松）。

## 练习

1. 运行 `code/main.py`。确认断路器在第 5 轮触发（第五次相同调用），金丝雀在第 9 轮触发（读取假密钥）。

2. 添加一个统计检测器：工具调用速率的 EWMA z-score。输入一条缓慢漂移的轨迹，展示该检测器从不触发。现在添加一个硬限制（10 分钟内不超过 50 次工具调用），展示同一轨迹上硬限制触发。

3. 为一个浏览器 agent（第 11 课）设计一组金丝雀令牌。列出至少三个金丝雀以及每个能检测到什么。

4. 阅读 Cilium 网络策略文档。具体描述一个出站重定向隔离流程：哪个策略选择器、哪个 pod、哪个出站重定向、哪个警报。从“决定隔离”到“第一个被重定向的数据包”的墙钟延迟由什么决定？

5. 为被 kill-switch 的 agent 定义一个重新启用流程。谁可以重新启用？必须记录什么？重新启用之前必须对 agent 改变什么？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|---|---|---|
| Kill switch | "关闭按钮" | 位于 agent 编辑面之外的布尔量；在每个有影响的动作上检查 |
| Circuit breaker | "模式暂停" | 针对特定动作，在重复、失败率或限流上触发 |
| Canary token | "Honeytoken" | agent 没有正当理由去触碰的诱饵；访问即触发警报 |
| Honeypot | "取证沙箱" | 被隔离的 agent 受到观察的重定向流量/工作区 |
| EWMA | "移动平均" | 指数加权；适应漂移（特性 + 缺陷） |
| CUSUM | "累积和" | 检测相对基线的持续偏移 |
| Hard limit | "宪法规则" | 不适应；不论历史如何保持恒定 |
| Constitutional limit | "永真规则" | 绑定于第 17 课的宪法；agent 不能编辑 |

## 延伸阅读

- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 面向自主 agent 的 kill-switch 和断路器框架。
- [Microsoft Agent Framework — HITL and oversight](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — 生产级治理模式。
- [OWASP LLM / Agentic Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) — 检测与响应要求。
- [Cilium — Network policy and eBPF](https://docs.cilium.io/en/stable/security/network/) — pod 级出站重定向和取证蜜罐模式。
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — 作为"宪法限制"的硬编码禁令。