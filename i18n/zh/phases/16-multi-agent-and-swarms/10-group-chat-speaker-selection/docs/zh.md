# 群聊与发言者选择

> 共享会话编排将 N 个智能体置于同一会话中；由一个选择函数（LLM、轮询或自定义）决定下一个发言者。这是涌现式多智能体会话的原型——智能体并不知道自己在一个静态图中的角色，它们只是对共享消息池作出反应。AutoGen GroupChat 和 AG2 GroupChat 是参考实现：AutoGen v0.2 的 GroupChat 语义在 AG2 分支中得到保留；AutoGen v0.4 将其重写为事件驱动的 actor 模型。微软于 2026 年 2 月将 AutoGen 置于维护模式，并将其与 Semantic Kernel 合并为 Microsoft Agent Framework（2026 年 2 月发布 RC 版）。GroupChat 原语在 AG2 和 Microsoft Agent Framework 中都得以保留——学一次，处处可用。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## 问题

静态图（LangGraph）在工作流已知时非常适用。但真实对话不是静态的：有时编码者会询问审查者，有时是研究员，有时是写作者。把每种可能的交接都硬编码会导致边的爆炸式增长。你想要的是*智能体对共享池作出反应*，由某个函数决定下一个发言者。

这正是 AutoGen GroupChat 所做的事情。

## 概念

### 形态

```
              ┌─── shared pool ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (everyone reads all)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    Agent A  Agent B  Agent C  Agent D  Selector
                                           │
                                           ▼
                                  "next speaker = C"
```

每个智能体都能看到每条消息。每一轮都会调用一个选择函数来决定下一个发言者。

### 三种选择器风格

**轮询（Round-robin）。** 固定循环。确定性的。在 N 上线性扩展但忽略上下文——即使话题是法律审查，编码者也会轮到发言。

**LLM 选择。** 调用一个 LLM，读取近期消息池并返回最佳的下一位发言者。具备上下文感知能力但速度慢：每轮都会增加一次 LLM 调用。这是 AutoGen 的默认方式。

**自定义。** 一个包含任意逻辑的 Python 函数。典型做法：以 LLM 选择为主，辅以回退规则（例如，“编码者发言后总是轮到验证者”）。

### ConversableAgent API

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager` 持有选择器。当某个智能体完成一轮发言后，管理器调用选择器，选择器返回下一个智能体。循环持续进行，直到满足终止条件。

### 终止

三种常见模式：

- **最大轮数。** 对总轮数设置硬性上限。
- **"TERMINATE" 令牌。** 智能体可以发出一个哨兵消息；管理器在看到它时停止。
- **目标达成检查。** 一个轻量级验证器在每轮运行，完成时结束会话。

### 沿革：分叉与合并

2025 年初，微软开始围绕事件驱动的 actor 模型对 AutoGen（v0.4）进行大规模重写。社区将 AutoGen v0.2 的 GroupChat 语义分叉为 AG2，保留了早期采用者已经集成的 API。

2026 年 2 月，微软宣布 AutoGen 将进入维护模式，事件驱动的 actor 模型将合并入 **Microsoft Agent Framework**（2026 年 2 月发布 RC 版，现已与 Semantic Kernel 合并）。GroupChat 概念在两条线上都得以延续；实现细节有所不同。对于 v0.2 兼容的代码，AG2 是首选上游。

### GroupChat 适用的场景

- **涌现式对话。** 你不想预先设定每一种可能的下一位发言者。
- **角色混合任务。** 编码者询问研究员，研究员询问档案管理员，档案管理员又回头询问编码者。流程不是 DAG。
- **探索性问题求解。** 想象“头脑风暴会议”，而不是“流水线”。

### 失效场景

- **严格确定性。** LLM 选择器可能不一致。相同的提示，不同的运行，得到不同的下一位发言者。
- **谄媚级联。** 智能体会附和发言最自信的人。需要通过反向提示来明确对抗。
- **上下文膨胀。** 每个智能体读取每条消息；10 轮之后上下文会非常庞大。使用投影（Lesson 15）来限定视图范围。
- **热门发言者。** 由于选择器偏好某智能体的专长，它主导了整个对话。将发言者均衡作为选择器的一个特性引入。

### 群聊 vs 监督者

相同的原语，不同的默认值：

- 监督者：一个智能体规划，其他智能体执行。选择器是“询问规划者该做什么”。
- 群聊：所有智能体地位平等；选择器是对共享池的一个函数。

两者都使用 Lesson 04 的四个原语。群聊默认采用 LLM 选择的编排和全池共享状态。

```figure
swarm-speaker
```

## 动手构建

`code/main.py` 使用标准库从零实现一个 GroupChat。包含三个智能体（coder、reviewer、manager）、轮询和 LLM 选择两种变体，以及在 `TERMINATE` 令牌上的终止机制。

演示会打印对话记录，以及两种变体下选择器的决策轨迹。

运行：

```
python3 code/main.py
```

## 使用

`outputs/skill-groupchat-selector.md` 为给定任务配置一个 GroupChat 选择器——轮询 vs LLM 选择 vs 自定义，以及选择器应使用哪些输入（近期消息、智能体专长、发言次数）。

## 上线

检查清单：

- **最大轮数上限。** 一定要有。典型任务设为 10–20。
- **发言均衡指标。** 跟踪每个智能体的发言次数；当失衡超过阈值时告警。
- **终止令牌。** `TERMINATE` 或一个专门的验证器智能体。
- **投影或限定范围的记忆。** 大约 10 条消息之后，考虑只给每个智能体一个限定范围的视图，以防止上下文膨胀。
- **选择器日志。** 对于 LLM 选择变体，同时记录选择器的输入及其选择。否则无法调试。

## 练习

1. 运行 `code/main.py`。比较轮询与 LLM 选择下的对话。每种方式下哪个智能体占据主导？
2. 在选择器中添加一个“每个智能体最大发言次数”规则。它如何影响对话记录？
3. 实现一个目标达成的终止机制：当审查者返回"approved"时停止。它在达到轮数上限之前触发的频率如何？
4. 阅读 AutoGen 关于 GroupChat 的稳定版文档（https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html）。找出 `GroupChatManager` 使用的默认选择器。
5. 阅读 AG2 仓库（https://github.com/ag2ai/ag2），比较其 v0.2 的 GroupChat 与 v0.4 的事件驱动版本。v0.4 增加了哪些具体属性（吞吐量、容错性、可组合性）？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| GroupChat | “智能体在一个聊天室里” | 共享消息池 + 选择函数。AutoGen / AG2 原语。 |
| 发言者选择 | “谁下一个发言” | 选出下一个智能体的函数。轮询、LLM 选择或自定义。 |
| GroupChatManager | “会议主持人” | 持有选择器并循环执行各轮的 AutoGen 组件。 |
| ConversableAgent | “基础智能体” | AutoGen 基类；可以发送和接收消息的智能体。 |
| 终止令牌 | “‘停止’词” | 结束会话的哨兵字符串（通常是 `TERMINATE`）。 |
| 热门发言者 | “一个智能体主导对话” | 选择器不断选中同一个智能体的失效模式。 |
| 上下文膨胀 | “消息池无界增长” | 每个智能体读取此前所有消息；上下文随轮数增长。 |
| 投影 | “限定范围的视图” | 面向共享池的角色特定视图，用于防止上下文膨胀。 |

## 延伸阅读

- [AutoGen group chat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) — 参考实现
- [AG2 repo](https://github.com/ag2ai/ag2) — 社区对 AutoGen v0.2 的延续
- [Microsoft Agent Framework docs](https://learn.microsoft.com/en-us/agent-framework/) — 合并后的后继者，2026 年 2 月发布 RC 版
- [AutoGen v0.4 release notes](https://microsoft.github.io/autogen/stable/) — 事件驱动 actor 模型重写的细节