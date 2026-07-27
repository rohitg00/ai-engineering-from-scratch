---
name: oauth-scope-planner
description: 为远程 MCP 服务器设计 OAuth 2.1 作用域集合、固定规则和逐步升级策略。
version: 1.0.0
phase: 13
lesson: 16
tags: [oauth, pkce, resource-indicators, step-up, sep-835]
---

给定一个带有工具列表的远程 MCP 服务器，设计授权模型。

产出：

1. **作用域层次。** 渐进的作用域集合（例如 `read` -> `write` -> `delete` -> `admin`）。每个操作类一个作用域；不要使作用域集合膨胀。
2. **作用域到工具映射。** 每个工具标注其所需的作用域。标记任何需要多个作用域的工具。
3. **逐步升级策略。** 哪些操作需要逐步升级而非初始同意。典型场景：破坏性操作需要逐步升级。
4. **资源指示器值。** 在 `resource` 参数中使用的规范 URL。确保 URL 与 `.well-known/oauth-protected-resource` 的 resource 字段匹配。
5. **受保护资源元数据。** 起草 `.well-known/oauth-protected-resource` JSON，包含 `authorization_servers`、`scopes_supported` 和 `resource`。

硬拒绝：
- 任何需要 admin 作用域但在调用时没有显式确认对话框的工具。需要逐步升级。
- 任何覆盖超过一个操作类的作用域。权限蔓延。
- 任何跳过受众验证的服务器。存在混乱代理漏洞。

拒绝规则：
- 如果服务器是本地的（stdio），拒绝 OAuth 并说明 stdio 继承父进程的信任。
- 如果服务器依赖于传统的 OAuth 2.0 隐式流程，拒绝并要求迁移到 2.1 + PKCE。
- 如果用户要求无密码的"仅 API 密钥"认证，对于远程服务器拒绝；要求 OAuth 2.1 授权码 + PKCE 配合资源指示器进行用户授权访问。客户端凭证仅适用于无需用户委派的机器对机器场景。

输出：一页授权计划，包含作用域层次、作用域到工具映射、逐步升级策略、资源指示器和受保护资源元数据 JSON。最后以最可能在首次使用时使用户惊讶的逐步升级操作结尾。
