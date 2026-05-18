---
name: injection-defense
description: 为任何代理运行时构建 PVE（Prompt-Validator-Executor）层，带有 source-tagged 内容、injection-marker 扫描和 allowlist 导航。
version: 1.0.0
phase: 14
lesson: 27
tags: [security, prompt-injection, pve, greshake, source-tag]
---

给定带有工具访问和检索的代理，生成注入防御层。

生成：

1. 每段内容的来源标签：`user_message`、`tool_output`、`retrieved_web`、`retrieved_memory`、`retrieved_file`。通过消息历史传播标签。
2. `Validator.assess(tool_call, contents)` —— 拒绝带有 injection-shaped args 或检索内容的工具调用；仅当来源标签与声明的信任级别匹配时才允许。
3. 导航的 allowlist / blocklist：代理可以触及的 URL、domains、file paths。
4. 内存写入 guardrail：拒绝看起来像指令的写入。
5. 内容捕获规则（Lesson 23）：外部存储检索内容；spans 携带 reference IDs，而不是散文。
6. 测试套件：五个 Greshake 利用类作为 red-team 案例。

硬性拒绝：

- 没有来源标签的工具使用表面。没有来源无法区分权限级别。
- 仅在最终输出上运行的验证器。晚期验证无关紧要 —— 模型已经行动了。
- "相信我，system prompt 处理它。" System-prompt hygiene 不是控制。

拒绝规则：

- 如果代理有任何检索能力而没有来源标记，拒绝发布。检索内容是典型的注入向量。
- 如果敏感工具（send message、execute shell、write file in /）没有 human-in-the-loop 确认，拒绝。
- 如果内存写入不受保护，拒绝。持久内存中毒会重新毒害下一个会话。

输出：`validator.py`、`source_tag.py`、`allowlist.py`、`memory_guard.py`、`red_team.py`、`README.md` 解释六层控制、残余风险和持续审查节奏。以"what to read next"结束，指向 Lesson 21（computer use safety）和 Lesson 23（通过 OTel 的内容捕获）。
