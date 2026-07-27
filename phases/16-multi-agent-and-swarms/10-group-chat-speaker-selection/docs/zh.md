# 群聊与发言者选择

> AutoGen GroupChat 和 AG2 GroupChat 让多个智能体共享一个会话；选择器函数（LLM、轮询或自定义）决定下一个谁来发言。这是涌现式多智能体对话的原型 —— 智能体并不知道自己在静态图中的角色，它们只对共享的消息池做出反应。AutoGen v0.2 的 GroupChat 语义在 AG2 分支中得以保留；AutoGen v0.4 将其重写为事件驱动的 actor 模型。微软于 2026 年 2 月将 AutoGen 置于维护模式，并将其与 Semantic Kernel 合并为 Microsoft Agent Framework（2026 年 2 月 RC）。GroupChat 原语在 AG2 和 Microsoft Agent Framework 中均得以保留 —— 一次学习，随处可用。

**类型：** 学习 + 构建  
**语言：** Python（标准库）  
**前置条件：** 阶段 16 · 04（原语模型）  
**时长：** 约 60 分钟

## 问题

静态图（LangGraph）在工作流已知的情况下非常出色。但真实的对话并非静态：有时候程序员需要询问审查者，有时候是研究员，有时候是文档编写者。将每一种可能的交接都硬编码会导致边的爆炸式增长。你需要的是*对共享池做出反应的智能体*，由某个函数来决定谁接着发言。

这正是 AutoGen GroupChat 所做的。

## 概念

### 结构

```
              ┌─── 共享池 ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │（所有人都能读取所有消息）
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
   智能体 A  智能体 B  智能体 C  智能体 D  选择器
                                           │
                                           ▼
                                  "下一个发言者 = C"
```

每个智能体都能看到每一条消息。在每个轮次，选择器函数被调用来决定下一个谁来发言。

### 三种选择器风格

**轮询（Round-robin）。** 固定循环。确定性。规模随 N 线性增长，但忽略上下文 —— 即使当前话题是法律审查，程序员也会轮到发言。

**LLM 选择。** 调用 LLM 读取最近的消息池，返回最佳的下一个发言者。能感知上下文，但速度慢：每个轮次都需要一次 LLM 调用。AutoGen 的默认方式。

**自定义。** 一个 Python 函数，逻辑完全由你决定。典型用法：LLM 选择加上回退规则（例如，"总是让验证者在程序员之后发言"）。

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

`GroupChatManager` 持有选择器。当一个智能体完成一轮发言后，管理器调用选择器，选择器返回下一个智能体。循环持续直到满足终止条件。

### 终止条件

三种常见模式：

- **最大轮次。** 对总轮次的硬性上限。
- **"TERMINATE" 令牌。** 智能体可以发出一个哨兵消息；管理器在发现该消息时停止。
- **目标达成检查。** 一个轻量级验证器在每个轮次运行，任务完成时停止对话。

### AutoGen → AG2 的分裂与 Microsoft Agent Framework 合并

2025 年初，微软开始对 AutoGen 进行重大重写（v0.4），转向事件驱动的 actor 模型。社区将 AutoGen v0.2 的 GroupChat 语义分叉为 AG2，保留了早期采用者已经集成的 API。

2026 年 2 月，微软宣布 AutoGen 将进入维护模式，事件驱动的 actor 模型将合并到 **Microsoft Agent Framework**（2026 年 2 月 RC，现已与 Semantic Kernel 合并）中。GroupChat 概念在两个分支中均得以保留，但实现细节有所不同。AG2 是 v0.2 兼容代码的首选上游。

### GroupChat 何时适用

- **涌现式对话。** 你不想预置每一条可能的发言者路径。
- **角色混合任务。** 程序员问研究员，研究员问档案管理员，档案管理员又回头问程序员。流程不是 DAG。
- **探索性问题解决。** 想象"头脑风暴会议"，而不是"流水线"。

### GroupChat 何时不适用

- **严格确定性。** LLM 选择器可能不一致。相同提示词，不同运行，不同发言者。
- **谄媚级联。** 智能体倾向于服从发言最自信的那个。需要明确地对抗提示。
- **上下文膨胀。** 每个智能体读取每一条消息；10 轮之后上下文变得巨大。使用投影（课程 15）来限定视图范围。
- **热点发言者。** 某个智能体因为选择器偏爱其专长而主导对话。引入发言者平衡作为选择器的一个特性。

### 群聊 vs 监督者

相同的原语，不同的默认值：

- 监督者：一个智能体负责规划，其他智能体执行。选择器就是"问规划者接下来做什么"。
- 群聊：所有智能体是平等的；选择器是一个作用于共享池的函数。

两者都使用了课程 04 中的四个原语。群聊默认采用 LLM 选择的编排方式和全池共享状态。

## 构建

`code/main.py` 使用标准库从头实现了一个 GroupChat。三个智能体（程序员、审查者、管理者），包含轮询和 LLM 选择两种变体，以及基于 `TERMINATE` 令牌的终止机制。

演示程序会输出对话记录以及两种变体下选择器的决策轨迹。

运行：

```
python3 code/main.py
```

## 使用

`outputs/skill-groupchat-selector.md` 为给定任务配置了一个 GroupChat 选择器 —— 轮询 vs LLM 选择 vs 自定义，以及选择器输入（最近消息、智能体专长、发言次数）的使用方式。

## 交付

检查清单：

- **最大轮次上限。** 始终设置。典型任务 10-20 轮。
- **发言者平衡指标。** 跟踪每个智能体的发言次数；当不平衡超过阈值时发出警报。
- **终止令牌。** `TERMINATE` 或一个专门的验证智能体。
- **投影或限定范围的记忆。** 大约 10 条消息后，考虑给每个智能体只提供限定范围的视图，以防止上下文膨胀。
- **选择器日志记录。** 对于 LLM 选择的变体，记录选择器的输入及其选择结果。否则调试将无从下手。

## 练习

1. 运行 `code/main.py`。比较轮询 vs LLM 选择下的对话。每种方式下哪个智能体占据主导？
2. 在选择器中添加一个"每个智能体最大发言次数"规则。这对对话记录有什么影响？
3. 实现目标达成终止：当审查者返回"approved"时停止。在达到轮次上限之前，这个条件多久会触发一次？
4. 阅读 AutoGen 稳定版关于 GroupChat 的文档（https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html）。找出 `GroupChatManager` 使用的默认选择器。
5. 阅读 AG2 仓库（https://github.com/ag2ai/ag2），比较其 v0.2 的 GroupChat 与 v0.4 的事件驱动版本。v0.4 增加了哪些具体特性（吞吐量、容错性、可组合性）？

## 关键术语

| 术语 | 人们常说的意思 | 实际含义 |
|------|----------------|----------|
| GroupChat | "智能体在同一个聊天室" | 共享消息池 + 选择器函数。AutoGen / AG2 原语。 |
| 发言者选择（Speaker selection） | "谁接着发言" | 选择下一个智能体的函数。轮询、LLM 选择或自定义。 |
| GroupChatManager | "会议主持人" | AutoGen 组件，拥有选择器并循环处理轮次。 |
| ConversableAgent | "基础智能体" | AutoGen 基类；能够发送和接收消息的智能体。 |
| 终止令牌（Termination token） | "'停止'词" | 哨兵字符串（通常是 `TERMINATE`），用于结束对话。 |
| 热点发言者（Hot speaker） | "某个智能体主导对话" | 选择器不断选择同一个智能体的故障模式。 |
| 上下文膨胀（Context bloat） | "消息池无限制增长" | 每个智能体读取所有历史消息；上下文随轮次增长。 |
| 投影（Projection） | "限定范围的视图" | 针对角色的共享池视图，用于防止上下文膨胀。 |

## 延伸阅读

- [AutoGen group chat 文档](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) —— 参考实现
- [AG2 仓库](https://github.com/ag2ai/ag2) —— 社区维护的 AutoGen v0.2 延续版本
- [Microsoft Agent Framework 文档](https://microsoft.github.io/agent-framework/) —— 合并后的继任者，2026 年 2 月 RC
- [AutoGen v0.4 发布说明](https://microsoft.github.io/autogen/stable/) —— 事件驱动 actor 模型重写详情
