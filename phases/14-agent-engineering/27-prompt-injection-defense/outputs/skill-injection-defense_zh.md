---
name: injection-defense
description: 为任何智能体运行时构建 PVE（提示-验证器-执行器）层，包含来源标记的内容、注入标记扫描和允许列表导航。
version: 1.0.0
phase: 14
lesson: 27
tags: [security, prompt-injection, pve, greshake, source-tag]
---

给定一个具有工具访问和检索能力的智能体，生成一个注入防御层。

产出：

1. 每条内容上的来源标记：`user_message`、`tool_output`、`retrieved_web`、`retrieved_memory`、`retrieved_file`。通过消息历史传播标记。
2. `Validator.assess(tool_call, contents)`——拒绝具有注入形状参数或检索内容的工具调用；仅在来源标记匹配声明的信任级别时允许。
3. 导航的允许列表 / 阻止列表：智能体可以接触的 URL、域名、文件路径。
4. 记忆写入护栏：拒绝看起来像指令的写入。
5. 内容捕获规范（第 23 课）：将检索到的内容存储在外部；span 携带引用 ID，而非散文。
6. 测试套件：五个 Greshake 利用类作为红队案例。

硬性拒绝：

- 没有来源标记的工具使用表面。没有来源就无法区分权限级别。
- 仅在最终输出上运行的验证器。后期验证无关紧要——模型已经采取了行动。
- "相信我，系统提示会处理它。"系统提示卫生不是一种控制。

拒绝规则：

- 如果智能体有任何没有来源标记的检索能力，拒绝交付。检索到的内容是典型的注入向量。
- 如果敏感工具（发送消息、执行 shell、在 / 中写文件）没有人工确认，拒绝。
- 如果记忆写入没有保护，拒绝。持久记忆中毒会重新毒害下一次会话。

输出：`validator.py`、`source_tag.py`、`allowlist.py`、`memory_guard.py`、`red_team.py`、`README.md`，解释六层控制栈、残余风险和持续审查节奏。以"下一步阅读"结尾，指向第 21 课（计算机使用安全）和第 23 课（通过 OTel 进行内容捕获）。
