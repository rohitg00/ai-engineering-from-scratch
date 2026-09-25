# 自主代理的权限模式

> 权限阶梯——从"每步都审查"到"全部批准"的渐进式自主级别——是 harness 约束自主代理在无需询问的情况下能做什么的方式。Claude Code(本课的实例)提供了六种这样的模式:"plan" 在每个动作前都询问,"default"(在 UI 中标记为 "Manual")只对高风险动作询问,"acceptEdits" 自动批准文件写入但仍确认 shell 执行,而 "bypassPermissions" 则批准一切。Auto Mode——即 `auto` 权限模式——用一个独立的分类器模型取代逐动作批准:该模型在每个动作运行前进行审查,并阻止任何超出请求范围的升级行为。动作预算通过 `max_turns` 和 `max_budget_usd` 来强制执行。`auto` 的可用性取决于套餐、组织启用状态、模型和提供商——而且 Anthropic 明确表示,单靠分类器是不够的。

**Type:** Learn
**Languages:** Python (stdlib, two-stage classifier simulator)
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 09 (Coding-agent landscape)
**Time:** ~45 minutes

## 问题所在

在你机器上运行的自主编码代理是一个独特的安全类别。攻击面是代理能触及的一切——文件系统、网络、凭据、剪贴板、任何浏览器标签页、任何打开的终端。Bruce Schneier 等人已公开指出这一点:计算机使用代理并不是聊天机器人的"功能更新",而是一种带有全新风险特征的新工具。

Claude Code 的权限系统是 Anthropic 的回应。它不是单一的"自主/非自主"开关,而是跨越能力阶梯的六种模式:plan → default → acceptEdits → … → bypassPermissions。每种模式都是速度与逐动作审查之间的不同权衡。Auto Mode(2026 年 3 月)增加了一个独立的分类器模型,将批准从用户的关键路径上移开:它在每个动作运行前进行审查,并阻止任何超出请求范围的升级行为。

工程问题在于:这套系统能捕获什么,会漏掉什么,以及某个具体任务实际上需要哪种模式?

## 核心概念

### 六种权限模式

| 模式 | 行为 | 适用场景 |
|---|---|---|
| `plan` | 代理提出一个计划;用户批准整个计划;每个动作在执行前都被审查 | 不熟悉的任务;接近生产环境的代码;首次在某个仓库上使用代理 |
| `default` | 在 UI 中标记为 "Manual"。代理执行动作;对任何"有风险"的动作(shell 执行、破坏性操作、网络调用)提示用户 | 大多数交互式编码会话 |
| `acceptEdits` | 文件写入自动批准;shell 执行和网络调用仍会提示 | 跨多个文件的重构 |
| `auto` | 一个独立的分类器模型在每个动作运行前进行审查;阻止任何超出请求范围的升级行为 | 受限工作区中的长时间无人值守运行 |
| `dontAsk` | 从不提示;未被权限规则预先批准的动作将被拒绝 | 临时沙箱、CI 任务、研究脚本 |
| `bypassPermissions` | 批准一切 | 文档注明"仅用于你愿意丢弃的临时容器" |

(以上名称与公开的 Claude Code 文档一致;UI 将 `default` 标记为 "Manual"。)

### 一页读懂 Auto Mode

Auto Mode(2026 年 3 月 24 日发布)是首个将逐动作批准委托给模型的权限模式。结构:

1. **一个独立的分类器模型。** 在每个提议的动作运行前进行审查,依据是声明的任务和会话的当前状态,并阻止任何超出请求范围的升级行为。被阻止的动作回退到用户处理。
2. **受限的可用性。** `auto` 是否被提供取决于套餐、组织启用状态、模型和提供商。

预算控制与分类器并行:

- `max_turns` —— 会话中的总迭代次数。
- `max_budget_usd` —— 中止会话的金额上限。
- 每个工具的动作次数限制(不超过 N 次 `WebFetch` 调用等)。

### 这套系统能捕获什么

- 直接注入到工具输入中的提示注入,且注入的指令映射到已知高风险的动作形态。
- 重复的工具循环——分类器能看到动作 N+1 与动作 N 几乎相同,连续五次如此。
- 在本应只进行文件编辑的会话中明显超出范围的 shell 命令。

### 这套系统可能漏掉什么

- **隐蔽的提示注入**,在不产生任何被标记动作的情况下调节行为。间接提示注入并非完全可以修补的漏洞(OpenAI 准备工作负责人,2025 年,关于浏览器代理——见第 11 课)。
- **语义层面的不当行为。** 每个单独的动作可能看起来安全,而组合起来的轨迹却是有害的。分类器评判的是单个动作;它不会重新推导用户的意图。
- **通过合法渠道的数据外泄。** 将数据写入你拥有的文件,然后 `git push` 到公开仓库,是一系列被允许的动作,问题出在它们的组合上。

### 研究预览的定位

Anthropic 以研究预览的形式发布 Auto Mode。文档明确指出,分类器是一层防护,而不是解决方案:用户应将 Auto Mode 与预算、允许列表、隔离的工作区以及轨迹审计相结合(第 12–16 课)。研究预览的定位也反映了文档中记载的评估与部署之间的差距(第 1 课)——通过离线评估的分类器在真实会话中可能表现不同,因为用户的上下文可能是模糊的。

### 这个阶梯如何融入你的工作流

- 不熟悉的任务:从 `plan` 开始。阅读计划比回滚一次糟糕的运行代价更小。
- 已知的重构:`acceptEdits` 可以省去大量确认点击。
- 无人值守的后台运行:`auto` 仅在爆炸半径已测量过的工作区内使用(无凭据、无生产环境挂载、未主动选择的无出站流量)。
- 临时容器:`dontAsk` / `bypassPermissions` 仅在容器及其凭据可丢弃时才可接受。

```figure
autonomy-oversight
```

## 动手使用

`code/main.py` 将动作审查分类器模拟为一个两阶段流水线——这是一种教学简化;真正的 `auto` 模式由一个独立的分类器模型支撑,而非文档记载的两阶段契约。阶段 1 是针对提议动作的廉价关键词规则;阶段 2 是较慢的多规则审查器。驱动程序输入一段简短的合成轨迹(安全动作、一次提示注入尝试、一个重复循环),并展示分类器在哪里能捕获、在哪里会漏掉。

## 上线实践

`outputs/skill-permission-mode-picker.md` 将任务描述与合适的权限模式、预算上限和所需的隔离措施相匹配。

## 练习

1. 运行 `code/main.py`。哪种合成动作类型从未被阶段 1 标记,但总是被阶段 2 捕获?哪种两者都捕获不到?

2. 扩展阶段 1 的规则集,以捕获某个已知的特定危险形态(例如 `curl $ATTACKER/exfil`)。测量其在良性动作样本上的误报率。

3. 阅读 Anthropic 的"How the agent loop works"文档。列出代理在 `default` 模式下默认接触的每个外部状态。在无人值守运行 `auto` 之前,你需要单独对哪些进行限制?

4. 设计一个 24 小时无人值守运行预算:`max_turns`、`max_budget_usd`、每工具上限、允许列表。为每个数字给出理由。

5. 描述一条轨迹:其中每个单独的动作都被分类器批准,但组合起来的行为却是偏离目标的。(第 14 课讲解 kill switch 和 canary token 如何解决此问题。)

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|---|---|---|
| Permission mode | "代理能做多少事" | 六种命名策略之一,控制逐动作审批 |
| plan mode | "做任何事之前都先问" | 代理编写计划;用户在执行前批准 |
| acceptEdits | "让它写文件" | 文件写入自动批准;shell 执行仍会提示 |
| auto | "自动批准" | 独立的分类器模型审查每个动作;阻止超出请求范围的升级 |
| bypassPermissions | "完全放飞" | 批准一切;用于临时容器 |
| Stage 1(模拟器) | "快速关键词检查" | 在 `code/main.py` 中对提议动作的廉价规则 |
| Stage 2(模拟器) | "深度审查" | 在 `code/main.py` 中对被标记动作的较慢多规则审查器 |
| Research preview | "非正式发布" | Anthropic 对其失效模式仍在摸索中的功能的定位 |

## 延伸阅读

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) —— 权限模式、预算、动作格式。
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) —— 托管服务执行模型。
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code) —— 功能面与 Auto Mode 公告。
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) —— 影响分类器判断的基于原则的层面。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) —— 关于长时程权限设计的内部视角。