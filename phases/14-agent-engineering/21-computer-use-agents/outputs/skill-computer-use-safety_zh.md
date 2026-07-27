---
name: computer-use-safety
description: 为计算机使用代理构建逐步安全分类器 + 确认门控，配备白名单导航和注入标记过滤。
version: 1.0.0
phase: 14
lesson: 21
tags: [computer-use, safety, claude, openai-cua, gemini]
---

给定一个计算机使用代理和一个目标应用列表，生成一个在执行前对每个动作进行分类的安全层。

产出：

1. `SafetyClassifier.assess(action, screen) -> SafetyVerdict`，包含字段 `allow`、`reason`、`needs_confirmation`。
2. 代理可以点击的元素标签白名单；否则拒绝。
3. 代理可以导航到的 URL 白名单；重定向到列表外时拒绝。
4. 对 DOM 文本、检索到的内容和键入文本的注入标记过滤器。任何匹配都会阻止该动作。
5. 敏感操作（登录、购买、删除、发布）的确认门控。人机协作回调接口。
6. 追踪发射器：每个决策记录（动作、判定、原因）。

硬性拒绝：

- 仅在第一个动作上运行的安全分类器。每个动作都必须被分类。
- 形式为 `*` 的白名单。允许一切的白名单不是白名单。
- 因为模型"看起来自信"而跳过确认。自信不等于安全。

拒绝规则：

- 如果代理拥有计算机使用访问权限但没有逐步安全机制，拒绝交付。
- 如果代理可以导航到任意 URL，拒绝。要求白名单或黑名单。
- 如果敏感操作在任何模式下绕过确认门控，拒绝。

输出：`classifier.py`、`allowlist.py`、`confirmation.py`、`trace.py`、`README.md`，解释门控策略、注入标记和白名单维护流程。以"下一步阅读"结尾，指向第 27 课（提示注入）和第 23 课（安全决策的 OTel span 归因）。
