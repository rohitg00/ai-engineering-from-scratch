# 10 · 群聊与发言人选择

> AutoGen GroupChat 与 AG2 GroupChat 让 N 个智能体共享同一段对话；一个选择器函数（LLM、轮询或自定义）决定下一个发言者是谁。这是「涌现式多智能体对话（emergent multi-agent conversation）」的原型——智能体并不知道自己在某个静态图中的角色，它们只是对共享池（shared pool）做出反应。AutoGen v0.2 的 GroupChat 语义在 AG2 分支中被保留下来；AutoGen v0.4 则将其重写为「事件驱动的 actor 模型（event-driven actor model）」。微软于 2026 年 2 月将 AutoGen 置于维护模式，并将其与 Semantic Kernel 合并为 Microsoft Agent Framework（2026 年 2 月进入 RC 阶段）。GroupChat 这一原语（primitive）在 AG2 和 Microsoft Agent Framework 中都得以延续——学一次，处处可用。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置：** 阶段 16 · 04（原语模型）
**时长：** 约 60 分钟

## 问题

静态图（LangGraph）在工作流已知时非常好用。但真实对话并非静态：有时是程序员去问评审员，有时去问研究员，有时去问写作者。把每一种可能的交接都硬编码下来会导致「边爆炸（edge explosion）」。你想要的是*智能体对共享池做出反应*，由某个函数来决定下一个谁来说话。

这正是 AutoGen GroupChat 所做的事。

## 概念

### 整体形态

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

每个智能体都能看到每一条消息。每一轮都会调用一个选择器函数来决定下一个发言者。

### 三种选择器风格

**轮询（Round-robin）。** 固定循环。确定性的。在 N 上线性扩展，但忽略上下文——即使当前话题是法律评审，程序员仍会轮到发言。

**LLM 选择（LLM-selected）。** 调用一次 LLM，让它读取最近的共享池并返回最合适的下一位发言者。具备上下文感知，但慢：每一轮都额外增加一次 LLM 调用。这是 AutoGen 的默认方式。

**自定义（Custom）。** 一个你想写什么逻辑都行的 Python 函数。典型做法：LLM 选择加上兜底规则（例如「程序员之后总是把发言权交给验证者」）。

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

`GroupChatManager` 持有选择器。当一个智能体完成其轮次后，管理器调用选择器，选择器返回下一个智能体。循环持续进行，直到满足终止条件。

### 终止

三种常见模式：

- **最大轮次（Max rounds）。** 对总轮次设硬性上限。
- **「TERMINATE」标记。** 智能体可以发出一条哨兵（sentinel）消息；当出现该消息时管理器停止。
- **目标达成检查（Goal-reached check）。** 每一轮运行一个轻量验证器，完成时停止对话。

### AutoGen → AG2 的分裂与 Microsoft Agent Framework 的合并

2025 年初，微软围绕事件驱动的 actor 模型对 AutoGen 进行了一次大规模重写（v0.4）。社区将 AutoGen v0.2 的 GroupChat 语义分叉为 AG2，保留了早期采用者已经集成的那套 API。

2026 年 2 月，微软宣布 AutoGen 将进入维护模式，事件驱动的 actor 模型并入 **Microsoft Agent Framework**（2026 年 2 月进入 RC 阶段，现已与 Semantic Kernel 合并）。GroupChat 这一概念在两条路线中都得以延续，只是实现细节不同。对于兼容 v0.2 的代码而言，AG2 是首选的上游。

### GroupChat 适用的场景

- **涌现式对话。** 你不想预先接线（pre-wire）每一种可能的下一位发言者。
- **角色混合任务。** 程序员问研究员，研究员问档案员，档案员又回头问程序员。流程不是一个 DAG。
- **探索式问题求解。** 把它想成「头脑风暴会议」，而不是「流水线」。

### GroupChat 失效的场景

- **严格确定性。** LLM 选择器可能前后不一致。同样的提示词，不同的运行，得到不同的下一位发言者。
- **谄媚级联（Sycophancy cascades）。** 智能体倾向于附和那个说得最自信的人。要用反向提示词显式对抗。
- **上下文膨胀（Context bloat）。** 每个智能体都读取每一条消息；10 轮之后上下文会变得巨大。使用投影（projection，见第 15 课）来限定视图范围。
- **热门发言人（Hot speakers）。** 某个智能体主导了整场对话，因为选择器偏好它的专长。把发言均衡作为选择器的一项特性引入。

### 群聊 vs 监督者

相同的原语，不同的默认设定：

- 监督者（Supervisor）：一个智能体做规划，其他智能体执行。选择器就是「问规划者下一步做什么」。
- 群聊（Group chat）：所有智能体都是对等的；选择器是一个作用于共享池的函数。

两者都使用第 04 课的四个原语。群聊默认采用 LLM 选择式编排和全池共享状态。

## 动手构建

`code/main.py` 用标准库从零实现了一个 GroupChat。三个智能体（coder、reviewer、manager），轮询与 LLM 选择两种变体，以及基于 `TERMINATE` 标记的终止。

该演示会打印对话记录，外加两种变体下选择器的决策追踪。

运行：

```
python3 code/main.py
```

## 实际运用

`outputs/skill-groupchat-selector.md` 为给定任务配置一个 GroupChat 选择器——在轮询、LLM 选择和自定义之间做选择，以及使用哪些选择器输入（最近的消息、智能体专长、轮次计数）。

## 上线交付

清单：

- **最大轮次上限。** 永远要有。典型任务取 10-20。
- **发言均衡指标。** 跟踪每个智能体的轮次；当失衡超过阈值时告警。
- **终止标记。** `TERMINATE` 或一个专门的验证者智能体。
- **投影或限定范围的记忆。** 在大约 10 条消息之后，考虑只给每个智能体一个限定范围的视图，以防止上下文膨胀。
- **选择器日志。** 对于 LLM 选择式变体，同时记录选择器的输入和它的选择。否则调试将无从下手。

## 练习

1. 运行 `code/main.py`。比较轮询与 LLM 选择两种方式下的对话。在每种方式下，哪个智能体占据主导？
2. 在选择器中加入一条「每个智能体最大发言次数」规则。它如何影响对话记录？
3. 实现一个目标达成式终止：当评审员返回「approved」时停止。在触及轮次上限之前，它多久会触发一次？
4. 阅读 AutoGen 稳定版关于 GroupChat 的文档（https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html）。指出 `GroupChatManager` 使用的默认选择器。
5. 阅读 AG2 仓库（https://github.com/ag2ai/ag2），将其 v0.2 GroupChat 与 v0.4 事件驱动版本作比较。v0.4 增加了哪一项具体属性（吞吐量、容错性、可组合性）？

## 关键术语

| 术语 | 人们常说的 | 它实际的含义 |
|------|----------------|------------------------|
| GroupChat | 「一个聊天室里的智能体」 | 共享消息池 + 选择器函数。AutoGen / AG2 原语。 |
| 发言人选择（Speaker selection） | 「下一个谁说话」 | 挑选下一个智能体的函数。轮询、LLM 选择或自定义。 |
| GroupChatManager | 「会议主持人」 | 拥有选择器并对轮次进行循环的 AutoGen 组件。 |
| ConversableAgent | 「基础智能体」 | AutoGen 基类；一个能收发消息的智能体。 |
| 终止标记（Termination token） | 「那个『停』字」 | 用于结束对话的哨兵字符串（通常是 `TERMINATE`）。 |
| 热门发言人（Hot speaker） | 「某个智能体主导一切」 | 选择器一直挑同一个智能体的失效模式。 |
| 上下文膨胀（Context bloat） | 「池子无限增长」 | 每个智能体都读取此前的每一条消息；上下文随轮次增长。 |
| 投影（Projection） | 「限定范围的视图」 | 对共享池的、特定于角色的视图，用以防止上下文膨胀。 |

## 延伸阅读

- [AutoGen 群聊文档](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) —— 参考实现
- [AG2 仓库](https://github.com/ag2ai/ag2) —— 社区对 AutoGen v0.2 的延续
- [Microsoft Agent Framework 文档](https://microsoft.github.io/agent-framework/) —— 合并后的继任者，2026 年 2 月进入 RC 阶段
- [AutoGen v0.4 发布说明](https://microsoft.github.io/autogen/stable/) —— 事件驱动 actor 模型重写的详细信息
