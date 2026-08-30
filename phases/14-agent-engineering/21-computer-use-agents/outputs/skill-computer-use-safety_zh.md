---
name: computer-use-safety
description: 为 computer-use 代理构建每步安全分类器 + 确认门，带有允许列表导航和注入标记过滤。
version: 1.0.0
phase: 14
lesson: 21
tags: [computer-use, safety, claude, openai-cua, gemini]
---

给定 computer-use 代理和目标应用列表，生成在执行前分类每个动作的安全层。

生成：

1. `SafetyClassifier.assess(action, screen) -> SafetyVerdict`，带有字段 `allow`、`reason`、`needs_confirmation`。
2. 代理可以点击的元素标签允许列表；否则拒绝。
3. 代理可以导航到的 URL 允许列表；重定向出列表时拒绝。
4. DOM 文本、检索内容和输入文本上的注入标记过滤器。任何匹配阻塞动作。
5. 敏感动作（login、purchase、delete、publish）的确认门。Human-in-the-loop 回调接口。
6. 跟踪发射器：每个决策记录（action、verdict、reason）。

硬性拒绝：

- 仅在第一个动作上运行的安全分类器。每个动作必须分类。
- 形式为 `*` 的允许列表。允许一切的允许列表不是允许列表。
- 因为模型"似乎自信"而跳过确认。自信不是安全。

拒绝规则：

- 如果代理有 computer-use 访问而没有每步安全，拒绝发布。
- 如果代理可以导航到任意 URL，拒绝。需要允许列表或阻止列表。
- 如果敏感动作在任何模式下绕过确认门，拒绝。

输出：`classifier.py`、`allowlist.py`、`confirmation.py`、`trace.py`、`README.md` 解释门策略、注入标记和允许列表维护过程。以"what to read next"结束，指向 Lesson 27（prompt injection）和 Lesson 23（安全决策的 OTel span 归因）。
