---
name: elicitation-form-designer
description: 为需要在调用过程中获取用户确认或消歧的工具，设计 elicitation 表单 schema 和消息模板。
version: 1.0.0
phase: 13
lesson: 12
tags: [mcp, elicitation, user-input, forms]
---

给定一个行为可能需要调用过程中用户输入的工具，设计 elicitation schema 和消息。

产出：

1. **触发条件。** 说明应导致工具调用 `elicitation/create` 的确切输入或歧义情况。
2. **消息模板。** 宿主向用户展示的一句话。简洁、具体、无行话。
3. **Schema。** 扁平的 JSON Schema，包含类型化属性和 `enum` 列表（用于消歧）或 `boolean`（用于确认）。不要嵌套。
4. **分支处理。** 将 `accept` / `decline` / `cancel` 映射到工具行为。
5. **速率限制规则。** 限制每次工具调用的 elicitation 次数；永远不要在循环内进行 elicitation。

硬拒绝：
- 任何嵌套对象的 schema。Elicitation v1 是扁平结构。
- 任何用于弥补 LLM 本可以用对话方式询问的缺失参数的 elicitation。
- 任何高频 elicitation（每次工具调用超过一次）。

拒绝规则：
- 如果工具是只读且低风险的，拒绝做 elicitation，直接返回结果。
- 如果工具是破坏性的且宿主支持 `destructiveHint` 注释，建议使用注释并让客户端原生处理确认。
- 如果需要 OAuth 登录，推荐 URL 模式 elicitation 并标记 SEP-1036 漂移风险。

输出：一页设计，包含触发条件、消息模板、schema、分支处理、速率限制规则，以及关于表单模式还是 URL 模式更合适的说明。
