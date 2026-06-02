# 群聊与发言人选择（Group Chat and Speaker Selection）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> AutoGen GroupChat 与 AG2 GroupChat 让 N 个 agent 共享同一段对话；一个 selector 函数（LLM、轮询或自定义）决定下一个发言的是谁。这是「涌现式多 agent 对话」的原型——agent 并不知道自己在某张静态图里扮演什么角色，它们只是对共享池作出反应。AutoGen v0.2 的 GroupChat 语义在 AG2 fork 中被保留下来；AutoGen v0.4 则把它重写成事件驱动的 actor 模型。微软在 2026 年 2 月把 AutoGen 切到维护模式，并将其与 Semantic Kernel 合并进 **Microsoft Agent Framework**（2026 年 2 月 RC）。GroupChat 这个原语在 AG2 和 Microsoft Agent Framework 两条线里都活了下来——学一次，到处能用。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## 问题（Problem）

静态图（LangGraph）在工作流已知的时候很好用。但真实对话不是静态的：有时 coder 问 reviewer，有时问 researcher，有时问 writer。把所有可能的 handoff（交接）都硬编码进去，会带来边的爆炸。你想要的是 *agent 对一个共享池作出反应*，再用某个函数决定下一个谁说话。

而这正是 AutoGen GroupChat 在做的事。

## 概念（Concept）

### 形态（The shape）

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

每个 agent 都能看到每条消息。每一轮都会调用一次 selector 函数，挑出下一个发言人。

### 三种 selector 风味（The three selector flavors）

**Round-robin（轮询）。** 固定循环。完全确定性。在 N 上线性扩展，但忽略上下文——即使话题是法务审核，coder 也会被轮到。

**LLM-selected（LLM 选）。** 调一次 LLM，让它读最近的消息池并返回最合适的下一位发言人。上下文感知，但慢：每一轮都多一次 LLM 调用。这是 AutoGen 的默认。

**Custom（自定义）。** 一段你想怎么写就怎么写的 Python 函数。典型做法：以 LLM-selected 为主，加上兜底规则（比如「coder 之后永远轮到 verifier」）。

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

`GroupChatManager` 持有 selector。当一个 agent 完成一轮发言，manager 调用 selector，由它返回下一位 agent。循环一直跑，直到命中终止条件。

### 终止（Termination）

三种常见模式：

- **Max rounds（最大轮数）。** 总轮数硬上限。
- **「TERMINATE」token。** agent 可以发出哨兵消息；manager 一看到就停。
- **Goal-reached check（目标达成检查）。** 每轮跑一个轻量级 verifier，达成就停止聊天。

### AutoGen → AG2 的分裂，以及 Microsoft Agent Framework 的合并

2025 年初，微软围绕事件驱动的 actor 模型对 AutoGen 进行了大重写（v0.4）。社区把 AutoGen v0.2 的 GroupChat 语义 fork 成 AG2，保留了早期采用者已经接入的 API。

2026 年 2 月，微软宣布 AutoGen 进入维护模式，事件驱动的 actor 模型并入 **Microsoft Agent Framework**（2026 年 2 月 RC，现已与 Semantic Kernel 合并）。GroupChat 这个概念在两条线里都活下来了，只是实现细节不同。要写兼容 v0.2 的代码，AG2 是首选上游。

### GroupChat 适合的场景（When GroupChat fits）

- **涌现式对话。** 你不想把每一种「下一个谁说话」都提前接死。
- **角色混搭的任务。** Coder 问 researcher，researcher 问 archivist，archivist 又回头问 coder。流程不是一张 DAG（有向无环图）。
- **探索性的问题求解。** 想想「头脑风暴会议」，而不是「装配流水线」。

### 它失败的时候（When it fails）

- **严格确定性。** LLM selector 可能不一致。同一个 prompt，不同次运行，挑出的下一位发言人可能不同。
- **谄媚级联（sycophancy cascades）。** agent 会向最自信的发言者靠拢。要在 prompt 里显式反着压。
- **上下文膨胀（context bloat）。** 每个 agent 都读每条消息；10 轮之后 context 就爆炸。用 projection（投影，见 Lesson 15）来限定视图范围。
- **Hot speakers（强势发言人）。** 某个 agent 因为 selector 偏爱它的特长，而独霸对话。把「发言均衡度」作为 selector 的一个特征引入。

### 群聊 vs supervisor（Group chat vs supervisor）

同样的原语，不同的默认设定：

- Supervisor：一个 agent 负责规划，其他人执行。Selector 就是「问 planner 下一步做啥」。
- Group chat：所有 agent 都是平级；selector 是一个作用在共享池上的函数。

两者都用 Lesson 04 里的四个原语。Group chat 的默认是 LLM-selected 编排 + 全池共享状态。

## 动手实现（Build It）

`code/main.py` 用标准库从零实现了一个 GroupChat。三个 agent（coder、reviewer、manager），轮询和 LLM-selected 两种变体，并用 `TERMINATE` token 终止。

demo 会同时打印对话记录，以及两种变体下 selector 的决策轨迹。

运行：

```
python3 code/main.py
```

## 用起来（Use It）

`outputs/skill-groupchat-selector.md` 为给定任务配置一个 GroupChat selector——选 round-robin、LLM-selected 还是 custom，以及该用什么作为 selector 的输入（最近消息、agent 专长、轮次计数）。

## 上线部署（Ship It）

Checklist：

- **Max rounds 上限。** 必加。典型任务 10–20。
- **发言均衡度指标。** 跟踪每个 agent 的轮次数；不均衡超阈值就告警。
- **终止 token。** `TERMINATE`，或一个专门的 verifier agent。
- **Projection 或限定作用域的 memory。** 大约 10 条消息以后，考虑给每个 agent 只看一个限定视图，防止 context 膨胀。
- **Selector 日志。** 对 LLM-selected 变体，selector 的输入和它的选择都要记。否则没法 debug。

## 练习（Exercises）

1. 跑 `code/main.py`。对比 round-robin 和 LLM-selected 下的对话。哪种模式下哪个 agent 独大？
2. 在 selector 里加一条「单 agent 最大发言数」规则。它怎样影响对话记录？
3. 实现一个目标达成型终止：当 reviewer 返回 "approved" 就停。它在到达轮数上限前触发的频率有多高？
4. 读 AutoGen stable 文档里关于 GroupChat 的部分（https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html ）。指出 `GroupChatManager` 默认用哪种 selector。
5. 读 AG2 仓库（https://github.com/ag2ai/ag2 ），对比它的 v0.2 GroupChat 和 v0.4 事件驱动版本。v0.4 在哪些具体属性上（吞吐、容错、可组合性）做了加法？

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GroupChat | 「一群 agent 在一个聊天室」 | 共享消息池 + selector 函数。AutoGen / AG2 的原语。 |
| Speaker selection | 「下一个谁说话」 | 挑下一位 agent 的函数。Round-robin、LLM-selected 或 custom。 |
| GroupChatManager | 「会议主持人」 | AutoGen 组件，持有 selector 并按轮循环。 |
| ConversableAgent | 「基础 agent」 | AutoGen 基类；能收发消息的 agent。 |
| Termination token | 「停止词」 | 哨兵字符串（通常是 `TERMINATE`），用来结束对话。 |
| Hot speaker | 「某个 agent 独大」 | selector 一直挑同一个 agent 的故障模式。 |
| Context bloat | 「池子无界增长」 | 每个 agent 都读全部历史消息；context 随轮次增长。 |
| Projection | 「限定作用域的视图」 | 针对角色对共享池开的视图，防止 context 膨胀。 |

## 延伸阅读（Further Reading）

- [AutoGen group chat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) — 参考实现
- [AG2 repo](https://github.com/ag2ai/ag2) — 社区延续 AutoGen v0.2
- [Microsoft Agent Framework docs](https://microsoft.github.io/agent-framework/) — 合并后的继任者，2026 年 2 月 RC
- [AutoGen v0.4 release notes](https://microsoft.github.io/autogen/stable/) — 事件驱动 actor 模型重写细节
