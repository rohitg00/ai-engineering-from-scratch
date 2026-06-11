---
name: handoff-generator
description: 从工作台工件生成会话结束交接数据包，生成人类可读的 Markdown 和机器可读的 JSON，键入七个规范字段。
version: 1.0.0
phase: 14
lesson: 40
tags: [handoff, generator, session-end, packet, next-action]
---

给定工作台（state、verdict、review、feedback log、diff），生成连接到代理运行时的会话结束交接生成器。

生成：

1. `tools/generate_handoff.py`，暴露 `generate_handoff(snapshot) -> (markdown, payload)`。
2. `outputs/handoff/<session_id>/handoff.md` 和 `handoff.json`。
3. `handoff.schema.json`，覆盖七个必需字段和 feedback tail 格式。
4. 运行生成器并拒绝关闭会话（如果任何字段缺失）的会话结束钩子脚本。
5. `docs/handoff.md`，列出七个字段、它们的来源和修剪策略。

硬性拒绝：

- 没有 `next_action` 的交接。伪装成交接的状态报告会毒害下一个会话。
- 手写摘要的生成器。代理的工作是将工作台留在可生成状态。
- 与 JSON 分歧的 markdown 数据包。JSON 是来源；markdown 是 JSON 的渲染。
- 超过 30 个条目的 feedback tail。完整日志在版本控制中；数据包必须保持小。

拒绝规则：

- 如果验证报告缺失，拒绝生成数据包。没有裁决的交接是愿望。
- 如果审查报告缺失且预期人类审查者，拒绝并要求先通过审查。
- 如果差异摘要为空但会话运行超过 5 分钟，在生成之前提出异常；怀疑楔入会话而不是真正的 no-op。

输出结构：

```
<repo>/
├── outputs/handoff/<session_id>/
│   ├── handoff.md
│   └── handoff.json
├── tools/generate_handoff.py
├── handoff.schema.json
└── docs/handoff.md
```

以"what to read next"结束，指向：

- Lesson 41 用于真实风格示例应用的端到端练习。
- Lesson 42 用于将生成器打包到 capstone 工作台包中。
- Lesson 29 (Production Runtimes) 用于将会话结束连接到 queue、event 和 cron 触发器。
