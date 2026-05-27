# 群聊和发言人选择

> AutoGen GroupChat 和 AG2 GroupChat 在 N 个智能体之间共享一个对话；选择器函数（LLM、轮询、或自定义）选择谁下一个发言。这是新兴多智能体对话的原型——智能体在静态图中不知道自己的角色，它们只是对共享池做出反应。AutoGen v0.2 的 GroupChat 语义在 AG2 分支中保留；AutoGen v0.4 将其重写为事件驱动的参与者模型。Microsoft 在 2026 年 2 月将 AutoGen 置于维护模式，并将其与 Semantic Kernel 合并为 Microsoft Agent Framework（RC 2026 年 2 月）。GroupChat 原语在 AG2 和 Microsoft Agent Framework 中都存在——学习一次，随处使用。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置条件：** 阶段 16.04（原语模型）
**时长：** 约 60 分钟

## 问题背景

当你知道工作流时，静态图（LangGraph）很好。真实的对话不是静态的：有时编码员问审查员，有时问研究员，有时问作者。硬编码每个可能的交接会产生边爆炸。你想要*智能体对共享池做出反应*，用某个函数决定谁下一个说话。

这正是 AutoGen GroupChat 所做的。

## 概念讲解

### 形状

```
              ┌─── 共享池 ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │（每个人都读取所有）
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    智能体 A  智能体 B  智能体 C  智能体 D  选择器
                                           │
                                           ▼
                                  "下一个发言人 = C"
```

每个智能体看到每条消息。每轮调用选择器函数来选择谁下一个发言。

### 三种选择器风格

**轮询（Round-robin）。** 固定循环。确定性。在 N 中线性扩展但忽略上下文——即使主题是法律审查，编码员也会得到轮次。

**LLM 选择。** 调用 LLM 读取最近的池并返回最佳下一个发言人。上下文感知但缓慢：每轮添加一次 LLM 调用。AutoGen 的默认设置。

**自定义。** 具有你想要的任何逻辑的 Python 函数。典型：带有回退规则的 LLM 选择（例如，"在编码员之后总是给验证器轮次"）。

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

`GroupChatManager` 持有选择器。当智能体完成一轮时，管理者调用选择器，它返回下一个智能体。循环继续直到终止条件。

### 终止

三种常见模式：

- **最大轮次。** 总轮次的硬上限。
- **"TERMINATE" 令牌。** 智能体可以发出哨兵消息；当出现一个时管理者停止。
- **目标达成检查。** 轻量级验证器每轮运行，并在完成时停止聊天。

### AutoGen → AG2 分叉和 Microsoft Agent Framework 合并

在 2025 年初，Microsoft 开始围绕事件驱动的参与者模型对 AutoGen（v0.4）进行重大重写。社区将 AutoGen v0.2 的 GroupChat 语义分叉为 AG2，保留了早期采用者已集成的 API。

在 2026 年 2 月，Microsoft 宣布 AutoGen 将进入维护模式，事件驱动的参与者模型合并到 **Microsoft Agent Framework**（RC 2026 年 2 月，现已与 Semantic Kernel 合并）。GroupChat 概念在两个轨道中都存在；实现细节不同。AG2 是 v0.2 兼容代码的首选上游。

### 何时适合群聊

- **新兴对话。** 你不希望预先连接每个可能的下一个发言人。
- **角色混合任务。** 编码员问研究员，研究员问档案管理员，档案管理员问编码员回来。流程不是 DAG。
- **探索性问题解决。** 想想"头脑风暴会议"，而不是"装配线。"

### 何时失败

- **严格确定性。** LLM 选择器可能不一致。相同提示词，不同运行，不同的下一个发言人。
- **谄媚级联。** 智能体 defer 给说话最自信的人。显式反提示。
- **上下文膨胀。** 每个智能体读取每条消息；10 轮后上下文巨大。使用投影（第 15 课）来范围化视图。
- **热门发言人。** 一个智能体主导对话，因为选择器 favor 其专业技能。引入发言人平衡作为选择器特征。

### 群聊 vs 监督者

相同的原语，不同的默认值：

- 监督者：一个智能体规划，其他人执行。选择器是"询问规划器要做什么。"
- 群聊：所有智能体都是对等体；选择器是共享池上的函数。

两者都使用第 04 课中的四个原语。群聊默认为 LLM 选择的编排和全池共享状态。

## 构建实现

`code/main.py` 在标准库中从头实现 GroupChat。三个智能体（编码员、审查员、管理者）、轮询和 LLM 选择的变体，以及 `TERMINATE` 令牌上的终止。

演示打印对话记录和两个变体的选择器决策跟踪。

运行：

```
python3 code/main.py
```

## 实际应用

`outputs/skill-groupchat-selector.md` 为给定任务配置 GroupChat 选择器——轮询 vs LLM 选择 vs 自定义，以及要使用什么选择器输入（最近消息、智能体专业、轮次计数）。

## 部署实现

检查清单：

- **最大轮次上限。** 总是。典型任务 10-20 次。
- **发言人平衡度量。** 跟踪每个智能体的轮次；当不平衡超过阈值时警报。
- **终止令牌。** `TERMINATE` 或专用验证器智能体。
- **投影或范围化内存。** 约 10 条消息后，考虑给每个智能体只有范围化视图以防止上下文膨胀。
- **选择器日志记录。** 对于 LLM 选择的变体，记录选择器的输入及其选择。否则调试是不可能的。

## 练习

1. 运行 `code/main.py`。比较轮询 vs LLM 选择下的对话。每个哪个智能体占主导？
2. 在选择器中添加"每个智能体最大发言"规则。它如何影响记录？
3. 实现目标达成终止：当审查员返回"已批准"时停止。它在轮次上限之前触发频率如何？
4. 阅读 AutoGen 稳定文档关于 GroupChat（https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html）。确定 `GroupChatManager` 使用的默认选择器。
5. 阅读 AG2 仓库（https://github.com/ag2ai/ag2）并将其 v0.2 GroupChat 与 v0.4 事件驱动版本进行比较。v0.4 添加了什么具体属性（吞吐量、容错、可组合性）？

## 关键术语

| 术语 | 人们说的 | 它实际意味着什么 |
|------|----------------|------------------------|
| GroupChat | "在一个聊天室中的智能体" | 共享消息池 + 选择器函数。AutoGen / AG2 原语。 |
| Speaker selection（发言人选择） | "谁下一个说话" | 选择下一个智能体的函数。轮询、LLM 选择或自定义。 |
| GroupChatManager | "会议主持人" | 拥有选择器和轮次循环的 AutoGen 组件。 |
| ConversableAgent | "基础智能体" | AutoGen 基类；可以发送和接收消息的智能体。 |
| Termination token（终止令牌） | "停止词" | 结束聊天的哨兵字符串（通常是 `TERMINATE`）。 |
| Hot speaker（热门发言人） | "一个智能体占主导" | 选择器不断选择相同智能体的失败模式。 |
| Context bloat（上下文膨胀） | "池无界增长" | 每个智能体读取每条先前消息；上下文随轮次增长。 |
| Projection（投影） | "范围化视图" | 共享池中的角色特定视图以防止上下文膨胀。 |

## 延伸阅读

- [AutoGen 群聊文档](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) — 参考实现
- [AG2 仓库](https://github.com/ag2ai/ag2) — 社区 AutoGen v0.2 延续
- [Microsoft Agent Framework 文档](https://microsoft.github.io/agent-framework/) — 合并的后继者，RC 2026 年 2 月
- [AutoGen v0.4 发布说明](https://microsoft.github.io/autogen/stable/) — 事件驱动参与者模型重写细节
