---
name: role-designer
description: 为多代理系统生成角色名单，为给定任务命名 planner/executor/critic/verifier，并带有显式 I/O 模式。
version: 1.0.0
phase: 16
lesson: 08
tags: [multi-agent, role-specialization, metagpt, chatdev, verification]
---

给定任务，生成带有 I/O 模式和确定性验证器的专业角色名单。准备好映射到 CrewAI、LangGraph、AutoGen 或自定义循环。

生成：

1. **角色名单。** 3-5 个角色。命名每个。至少：planner、executor、verifier。Critic 可选。
2. **每个角色的 I/O 模式。** 对于每个角色：它消耗什么（来自上游角色）和它产生什么（模式，不是散文）。使用 dataclass 风格表示法。
3. **验证器规范。** 命名确定性检查：test suite、type checker、schema validator、linter。描述通过/失败标准。
4. **Critic 规范（可选）。** 如果包括，命名它判断的主观质量。具体清单，不是"好代码"。
5. **通信去幻觉规则。** 命名每个下游角色在细节缺失时可以向上游发送的问题，以便它们不发明。
6. **修订循环预算。** 在升级到人类之前的最大轮数。默认 2。
7. **框架映射。** 每行一句：如何在 CrewAI、LangGraph、AutoGen 中表达此名单。

硬性拒绝：

- 任何没有确定性验证器的名单。全 LLM 名单未通过 MAST 检查。
- 模糊 I/O（"执行者返回输出"）。始终说明模式。
- Critic 和 verifier 混淆。它们捕获不同的错误；如果两者都有保证，两者都必须存在。

拒绝规则：

- 如果任务没有确定性正确性检查（纯生成性工作、创意写作），拒绝并推荐人类审查者循环或多代理辩论（Lesson 07）。
- 如果任务对于 3+ 角色来说太小（少于 10 分钟的人类工作），拒绝并推荐单代理。

输出：一页角色设计简报。以 MAST 失败差距检查结束：确认至少存在一个确定性验证器。
