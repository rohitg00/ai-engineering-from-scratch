# 群聊与说话者选择

> AutoGen GroupChat和AG2 GroupChat在N个智能体之间共享一个对话；选择器函数（LLM、轮询或自定义）选择下一个谁说话。这是涌现多智能体对话的原型——智能体不知道它们在静态图中的角色，它们只是对共享池做出反应。AutoGen v0.2的GroupChat语义在AG2分支中保留；AutoGen v0.4将其重写为事件驱动actor模型。Microsoft在2026年2月将AutoGen置于维护模式，并将其与Semantic Kernel合并为Microsoft Agent Framework（2026年2月RC）。GroupChat原语在AG2和Microsoft Agent Framework中都存活——学习一次，到处使用。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置知识：** 第16阶段 · 04（原语模型）
**时间：** 约60分钟

## 问题

静态图（LangGraph）在工作流已知时很棒。真实对话不是静态的：有时编码器问审查者，有时研究者，有时写作者。硬编码每个可能的交接产生边爆炸。你想要*对共享池做出反应的智能体*，有一些函数决定下一个谁说话。

这正是AutoGen GroupChat所做的。

## 核心概念

### 形状

```
              ┌─── 共享池 ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (每个人都读取全部)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    智能体A  智能体B  智能体C  智能体D  选择器
                                           │
                                           ▼
                                  "下一个说话者 = C"
```

每个智能体看到每条消息。每轮调用选择器函数来选择下一个谁说话。

### 三种选择器风格

**轮询。** 固定循环。确定性的。在N中线性扩展但忽略上下文——编码器即使在主题是法律审查时也获得轮次。

**LLM选择。** 调用读取最近池并返回最佳下一个说话者的LLM。上下文感知但慢：每轮增加一次LLM调用。AutoGen的默认。

**自定义。** 带有你想要的任何逻辑的Python函数。典型：LLM选择带有回退规则（例如，"总是在编码器之后给验证者轮次"）。

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

`GroupChatManager`持有选择器。当智能体完成一轮时，管理者调用选择器，选择器返回下一个智能体。循环继续直到终止条件。

### 终止

三种常见模式：

- **最大轮次。** 总轮次的硬上限。
- **"TERMINATE"令牌。** 智能体可以发出哨兵消息；管理者在出现时停止。
- **目标达成检查。** 轻量级验证者每轮运行，完成时停止聊天。

### AutoGen → AG2分裂和Microsoft Agent Framework合并

2025年初，Microsoft开始围绕事件驱动actor模型对AutoGen进行重大重写（v0.4）。社区将AutoGen v0.2的GroupChat语义分叉为AG2，保留了早期采用者已集成的API。

2026年2月，Microsoft宣布AutoGen将进入维护模式，事件驱动actor模型合并到**Microsoft Agent Framework**（2026年2月RC，现已与Semantic Kernel合并）。GroupChat概念在两个轨道中都存活；实现细节不同。AG2是v0.2兼容代码的首选上游。

### 群聊何时适合

- **涌现对话。** 你不想预先连接每个可能的下一个说话者。
- **角色混合任务。** 编码器问研究者，研究者问档案管理员，档案管理员回问编码器。流不是DAG。
- **探索性问题解决。** 想想"头脑风暴会议"，不是"流水线"。

### 何时失败

- **严格确定性。** LLM选择器可能不一致。相同提示，不同运行，不同下一个说话者。
- **谄媚级联。** 智能体听从说话最自信的人。显式反提示。
- **上下文膨胀。** 每个智能体读取每条消息；10轮之后上下文巨大。使用投影（第15课）来限定视图。
- **热门说话者。** 一个智能体主导对话，因为选择器偏爱其专业。引入说话者平衡作为选择器特性。

### 群聊 vs 监督者

相同原语，不同默认值：

- 监督者：一个智能体计划，其他执行。选择器是"问规划者该做什么"。
- 群聊：所有智能体是同伴；选择器是共享池上的函数。

两者都使用第04课的四个原语。群聊默认为LLM选择的编排和完整池共享状态。

## 构建它

`code/main.py`在标准库中从头实现GroupChat。三个智能体（编码器、审查者、管理者）、轮询和LLM选择变体，以及在`TERMINATE`令牌上终止。

演示打印对话记录加上两种变体的选择器决策跟踪。

运行：

```
python3 code/main.py
```

## 使用它

`outputs/skill-groupchat-selector.md`为给定任务配置GroupChat选择器——轮询 vs LLM选择 vs 自定义，以及使用什么选择器输入（最近消息、智能体专业、轮次计数）。

## 交付它

检查清单：

- **最大轮次上限。** 总是。典型任务10-20轮。
- **说话者平衡指标。** 追踪每个智能体的轮次；当不平衡超过阈值时警报。
- **终止令牌。** `TERMINATE`或专用验证者智能体。
- **投影或限定内存。** 约10条消息之后，考虑只给每个智能体限定视图以防止上下文膨胀。
- **选择器日志。** 对于LLM选择变体，记录选择器的输入和选择。否则调试不可能。

## 练习

1. 运行`code/main.py`。比较轮询 vs LLM选择下的对话。哪个智能体在每种情况下主导？
2. 在选择器中添加"每个智能体最大说话次数"规则。它如何影响记录？
3. 实现目标达成终止：当审查者返回"approved"时停止。它在轮次上限之前触发多频繁？
4. 阅读AutoGen稳定文档上的GroupChat（https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html）。识别`GroupChatManager`使用的默认选择器。
5. 阅读AG2仓库（https://github.com/ag2ai/ag2）并比较其v0.2 GroupChat与v0.4事件驱动版本。v0.4添加了什么具体属性（吞吐量、容错、可组合性）？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| 群聊 | "智能体在一个聊天室" | 共享消息池 + 选择器函数。AutoGen / AG2原语。 |
| 说话者选择 | "下一个谁说话" | 选择下一个智能体的函数。轮询、LLM选择或自定义。 |
| GroupChatManager | "会议主持人" | 拥有选择器并循环轮次的AutoGen组件。 |
| ConversableAgent | "基础智能体" | AutoGen基类；可以发送和接收消息的智能体。 |
| 终止令牌 | "'停止'词" | 结束聊天的哨兵字符串（通常是`TERMINATE`）。 |
| 热门说话者 | "一个智能体主导" | 选择器持续选择相同智能体的失败模式。 |
| 上下文膨胀 | "池无界增长" | 每个智能体读取每条先前消息；上下文随轮次增长。 |
| 投影 | "限定视图" | 共享池的角色特定视图以防止上下文膨胀。 |

## 延伸阅读

- [AutoGen群聊文档](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) —— 参考实现
- [AG2仓库](https://github.com/ag2ai/ag2) —— 社区AutoGen v0.2延续
- [Microsoft Agent Framework文档](https://microsoft.github.io/agent-framework/) —— 合并的继任者，2026年2月RC
- [AutoGen v0.4发布说明](https://microsoft.github.io/autogen/stable/) —— 事件驱动actor模型重写细节