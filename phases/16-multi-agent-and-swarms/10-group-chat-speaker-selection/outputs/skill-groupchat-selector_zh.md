---
name: groupchat-selector
description: 为任务配置 AutoGen/AG2 风格的 GroupChat 选择器，命名选择器变体、终止和反热发言者规则。
version: 1.0.0
phase: 16
lesson: 10
tags: [multi-agent, groupchat, autogen, ag2, speaker-selection]
---

给定任务和代理名单，生成 GroupChat 配置：选择器选择、选择器输入、终止规则和护栏。

生成：

1. **选择器变体。** Round-robin（便宜、公平、上下文盲）、LLM-selected（上下文感知、昂贵）或 custom（LLM + 基于规则的回退）。
2. **选择器输入。** 如果 LLM-selected：最近 N 条消息、代理专业、轮数。如果 custom：显式规则。
3. **终止规则。** Max rounds、TERMINATE token、goal-reached verifier 或组合。
4. **热发言者缓解。** 每代理轮上限、选择器输入中的发言者平衡分数、K 连续轮后强制轮换。
5. **上下文膨胀缓解。** 投影计划（每角色的范围视图）、摘要检查点、每代理上下文上限。
6. **可观测性。** 记录选择器的输入、选择器的选择、每轮代理延迟。

硬性拒绝：

- 任何没有记录选择器输入/输出的 LLM-selected 配置。调试变得不可能。
- 没有 max_rounds 上限的配置。
- 推理任务上的对称聊天（没有专业化）—— 改用辩论（Lesson 07）。

拒绝规则：

- 如果任务具有已知的 DAG 结构，拒绝 GroupChat 并推荐 LangGraph 静态图以确保确定性。
- 如果任务需要严格的审计跟踪，拒绝 GroupChat；推荐带有 checkpointer 的 LangGraph。
- 如果代理数量超过 5-6，拒绝扁平 GroupChat 并推荐嵌套组或分层模式。

输出：一页 GroupChat 配置简报。以成本估计结束（LLM-selected 每轮产生一个选择器调用）。
