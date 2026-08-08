---
name: skill-function-calling-patterns
description: 在生产环境中实现函数调用的决策框架——工具设计、错误处理、安全和提供商模式
version: 1.0.0
phase: 11
lesson: 09
tags: [function-calling, tool-use, agents, mcp, security, openai, anthropic]
---

# 函数调用模式

在构建使用工具的 LLM 应用时，应用此决策框架。

## 何时使用函数调用

**在以下情况使用函数调用：**
- 模型需要实时数据（天气、股票价格、数据库查询）
- 任务需要副作用（发送邮件、创建记录、部署代码）
- 模型必须基于用户意图在多个动作之间选择
- 你在构建与外部系统交互的 agent

**在以下情况改用结构化输出：**
- 你需要从文本中提取数据（无需外部调用）
- 输出是最终产品，而非中间步骤
- 你有单个 schema，而非多个工具可供选择

**在以下情况两者都用：**
- 模型调用工具，然后将工具结果结构化为特定输出格式

## 工具设计指南

1. **一个工具，一个动作。** 名为 `manage_database` 的工具如果处理查询、插入、更新和删除，就太宽泛了。拆分为 `query_records`、`insert_record`、`update_record`。模型用具体工具选择得更好。

2. **描述就是提示词。** 模型读取工具描述来决定选择。像为初级开发人员编写指令一样编写它们。包含工具返回什么，而不仅仅是它做什么。

3. **用枚举约束。** 如果参数有 3-10 个有效值，使用枚举。模型会发明字符串——"celsius"、"Celsius"、"C"、"metric"——除非你约束它。

4. **工具越少越好。** GPT-4o 能很好地处理 5-10 个工具。20+ 工具时选择准确率下降。50+ 工具时，预期 10-15% 的错误工具选择。将相关功能分组或使用路由层。

5. **必填意味着必填。** 仅当工具确实没有该参数就无法运行时才标记为必填。带有良好默认值的可选参数可减少工具调用失败。

## 提供商特定模式

### OpenAI (GPT-4o, o3, GPT-4o-mini)

```python
tools=[{"type": "function", "function": {"name": ..., "parameters": ...}}]
tool_choice="auto"       # 模型决定
tool_choice="required"   # 必须调用至少一个工具
tool_choice={"type": "function", "function": {"name": "specific_tool"}}
```

- 支持并行工具调用（一个响应中多个 `tool_calls`）
- 工具调用 ID 必须随结果传回
- `gpt-4o-mini` 便宜 10 倍，能很好地处理简单工具路由
- 结构化输出模式与工具参数配合以保证 schema 合规

### Anthropic (Claude 3.5 Sonnet, Claude 4 Opus)

```python
tools=[{"name": ..., "description": ..., "input_schema": ...}]
tool_choice={"type": "auto"}     # 模型决定
tool_choice={"type": "any"}      # 必须调用至少一个工具
tool_choice={"type": "tool", "name": "specific_tool"}
```

- 工具调用以 `type: "tool_use"` 的内容块形式出现
- 结果以 `type: "tool_result"` 放入用户消息
- 字段名是 `input_schema`，不是 `parameters`（常见的迁移 bug）
- 支持每个响应多个工具调用

### Google (Gemini 2.0 Flash, Gemini 2.0 Pro)

```python
function_declarations=[{"name": ..., "description": ..., "parameters": ...}]
function_calling_config={"mode": "AUTO"}   # 或 "ANY" 或 "NONE"
```

- 在顶层使用 `function_declarations`
- 通过 `function_response` 部分返回结果
- 支持并行函数调用

### 开源模型 (Llama 3, Hermes, Qwen)

- 无标准化格式——因模型和 serving 框架而异
- Hermes 格式 (NousResearch) 是最常见的微调约定
- vLLM 为支持的模型提供 OpenAI 兼容的工具调用
- Ollama 为兼容模型支持基本工具调用
- 生产前测试工具选择准确率——在 Berkeley Function Calling Leaderboard 上，开源模型比 GPT-4o 低 15-30%

## 错误处理模式

### 返回结构化错误

```json
{"error": true, "message": "City 'Toky' not found. Did you mean 'Tokyo'?", "code": "NOT_FOUND", "suggestions": ["Tokyo"]}
```

包含可操作的信息。"Not found" 不好。"Not found, did you mean X?" 好。模型使用错误消息来自我纠正。

### 重试策略

1. 工具调用因可纠正错误而失败（拼写错误、错误枚举值）
2. 将错误作为工具结果传回模型
3. 模型调整并重试
4. 每个工具调用最多重试 3 次
5. 3 次失败后，将错误返回给用户

### 超时处理

为所有工具执行设置超时。30 秒是合理的默认值。如果工具超时，返回结构化超时错误，让模型告知用户而非挂起。

## 安全清单

| 检查 | 原因 | 方法 |
|-------|-----|-----|
| 允许列表函数 | 防止任意代码执行 | 仅注册用户需要的工具 |
| 验证参数类型 | 防止类型混淆攻击 | 执行前检查类型 |
| 清理字符串参数 | 防止注入 | 拒绝或转义特殊字符 |
| 参数化数据库查询 | 防止 SQL 注入 | 切勿直接传递模型生成的 SQL |
| 过滤工具结果 | 防止数据泄漏 | 移除 API 密钥、PII、内部错误 |
| 限制工具调用速率 | 防止失控循环 | 每次对话最多 10-20 次调用 |
| 记录所有工具调用 | 审计追踪 | 存储工具名、参数、结果、时间戳 |
| 阻止路径遍历 | 防止文件系统访问 | 拒绝文件工具中的 `..` 和绝对路径 |
| 沙箱代码执行 | 防止系统访问 | 使用容器或受限内置函数 |
| 验证返回大小 | 防止上下文填充 | 截断超过 10KB 的结果 |

## 性能优化

- **并行调用：** 当模型请求多个独立工具时，使用 `asyncio.gather()` 或 `concurrent.futures` 并发执行
- **缓存：** 在同一会话中缓存相同参数的工具结果（60 秒内天气不会改变）
- **流式：** 在获取工具结果时流式传输模型的最终响应
- **工具裁剪：** 如果上下文紧张，仅包含与当前查询相关的工具定义（使用分类器过滤）
- **用于路由的小模型：** 使用 `gpt-4o-mini` 或 `claude-3-5-haiku` 进行工具选择，然后将结果传递给更强的模型进行合成

## 常见失败模式

| 失败 | 原因 | 修复 |
|---------|-------|-----|
| 选择了错误工具 | 描述模糊 | 用特定触发词重写描述 |
| 缺少必填参数 | 模型忘记参数 | 在参数描述中添加清晰示例 |
| 无限工具循环 | 模型不断调用相同工具 | 设置最大迭代次数（5-10）并检测重复调用 |
| 幻觉参数 | 模型发明看似合理但错误的值 | 使用枚举，针对已知值验证 |
| 工具结果太大 | API 返回 100KB 数据 | 传回前截断或摘要 |
| 模型忽略工具结果 | 结果格式混乱 | 返回带清晰字段名的干净 JSON |
