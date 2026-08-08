---
name: oauth-scope-planner
description: 为远程 MCP 服务器设计 OAuth 2.1 范围集、固定规则和升级策略。
version: 1.0.0
phase: 13
lesson: 16
tags: [oauth, pkce, resource-indicators, step-up, sep-835]
---

给定带有工具列表的远程 MCP 服务器，设计授权模型。

生成：

1. 范围层次结构。渐进范围集（例如 `read` -> `write` -> `delete` -> `admin`）。每个操作类一个范围；不要爆炸范围集。
2. 范围到工具映射。每个工具注释其所需范围。标记任何需要多个范围的工具。
3. 升级策略。哪些操作需要升级而非初始同意。典型：破坏性操作需要升级。
4. 资源指示器值。`resource` 参数中使用的规范 URL。确保 URL 匹配 `.well-known/oauth-protected-resource` 资源字段。
5. 受保护资源元数据。起草 `.well-known/oauth-protected-resource` JSON，包含 `authorization_servers`、`scopes_supported` 和 `resource`。

硬性拒绝：
- 任何需要 admin 范围但未通过显式确认对话框调用的工具。需要升级。
- 任何覆盖多个操作类的范围。权限蔓延。
- 任何跳过受众验证的服务器。混淆副手漏洞。

拒绝规则：
- 如果服务器是本地的（stdio），拒绝 OAuth 并说明 stdio 继承父信任。
- 如果服务器依赖旧版 OAuth 2.0 隐式流，拒绝并强制迁移到 2.1 + PKCE。
- 如果用户要求无密码"仅 API 密钥"认证，拒绝远程服务器；对于用户授权访问，需要 OAuth 2.1 授权码 + PKCE 及资源指示器。客户端凭证仅适用于没有用户委托的机对机场景。

输出：一页授权计划，包含范围层次结构、范围到工具映射、升级策略、资源指示器和受保护资源元数据 JSON。以首次遇到时最可能让用户惊讶的升级操作结尾。
