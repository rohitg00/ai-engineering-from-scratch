---
name: case-study-mapper
description: 将提议的多代理系统设计映射到最接近的 2026 生产参考（Anthropic Research、MetaGPT/ChatDev 或 OpenClaw/Moltbook）。提出已知权衡、推荐框架和已在生产中测试的特定设计决策。
version: 1.0.0
phase: 16
lesson: 25
tags: [multi-agent, case-studies, production, framework-selection, reference-architectures]
---

给定提议的多代理系统设计，选择最接近的规范 2026 案例研究并适应。

生成：

1. **设计指纹。** 任务类型（research / engineering / population / automation）、代理数量、验证要求、运行时长、角色区别、面向用户的网络暴露。
2. **最接近的案例研究。**
   - **Anthropic Research** 如果：research 或 knowledge-retrieval 任务、验证强制、multi-hour 运行、代理主要因上下文和范围而异（fresh-context subagents 获胜）。
   - **MetaGPT / ChatDev** 如果：engineering 或 structured workflow、角色明显可区分（planner / coder / reviewer / tester）、交接工件类型良好。
   - **OpenClaw / Moltbook** 如果：population-scale、面向用户的代理网络、prompt-injection 是实质性威胁、emergent economy 重要。
3. **要复制的模式。** 所选案例研究中适用的特定设计决策：fresh-context subagents、rainbow deploy、communicative dehallucination、DAG routing、unwritable verifier、substrate-level security。
4. **框架推荐。** LangGraph、CrewAI、AG2、Microsoft Agent Framework、OpenAI Agents SDK、Google ADK、Anthropic Claude Agent SDK 或 custom。默认案例研究的典型框架；注意如果特定设计的更好适配存在。
5. **案例中的反模式。** 参考案例发现不起作用的事情。在新设计中避免。
6. **成本预测。** 预期 token 乘数（Anthropic Research：~15x；MetaGPT：~5x；OpenClaw：取决于网络效应）。预期 wall-clock 和美元成本范围。
7. **评估方法。** 哪个基准（MARBLE、SWE-bench Pro、internal）相关；针对案例研究基线合理的 delta 是什么。

硬性拒绝：

- 当任务有正确性要求时忽略验证的设计。每个案例研究都支付验证税。
- 声称新基底而不承认 prompt-injection 作为攻击面的设计。OpenClaw/Moltbook 案例表明这是生产关注点，不是假设。
- 不映射到任何案例研究的"革命性"声明。多代理自 2024 年以来一直在生产；新颖声明需要显式比较。
- 没有正当理由跳过 MCP 或 A2A 采用的设计。协议支持是 table stakes。

拒绝规则：

- 如果设计没有明确的任务类型，推荐在选择案例研究之前确定任务范围。"Multi-agent for everything"不是设计。
- 如果设计声称生产准备但没有失败模式审计，推荐在参考映射之前进行 MAST 风格审计（Lesson 23）。
- 如果设计纯粹是实验性/研究性的，注意哪些方面在采用任何案例研究的生产模式之前需要加固。

输出：两页简报。以单句摘要开头（"Closest case study: MetaGPT / ChatDev. Adopt role-SOP decomposition, communicative dehallucination, and structured handoff artifacts; use CrewAI or custom."），然后是上述七个部分。以 90 天适应计划结束：从参考复制什么、定制什么以及针对基准验证什么。
