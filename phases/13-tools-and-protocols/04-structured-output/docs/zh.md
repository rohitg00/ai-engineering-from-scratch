# 结构化输出——JSON Schema、Pydantic、Zod、约束解码

> "礼貌地要求模型返回 JSON" 在前沿模型上也有 5% 到 15% 的失败率。结构化输出通过约束解码弥合这个差距：模型被字面阻止发出违反模式的 token。OpenAI 的严格模式、Anthropic 的模式类型化工具使用、Gemini 的 `responseSchema`、Pydantic AI 的 `output_type` 和 Zod 的 `.parse` 是同一想法的五种表面形式。本课构建模式验证器和严格模式契约，学习者将用于每个生产提取管道。

**类型：** Build
**语言：** Python（stdlib，JSON Schema 2020-12 子集）
**前置知识：** Phase 13 · 02（函数调用深入解析）
**时间：** ~75 分钟

## 学习目标

- 使用正确的约束（enum、min/max、required、pattern）为提取目标编写 JSON Schema 2020-12。
- 解释为什么严格模式和约束解码提供与"生成后验证"不同的保证。
- 区分三种失败模式：解析错误、模式违规、模型拒绝。
- 发布带类型化修复和类型化拒绝处理的提取管道。

## 问题所在

读取采购订单邮件的代理需要将自由文本转换为 `{customer, line_items, total_usd}`。三种方法。

**方法一：提示 JSON。** "以 JSON 回复，字段为 customer、line_items、total_usd。"在前沿模型上 85% 到 95% 的时间有效。以六种方式失败：缺少大括号、尾随逗号、错误类型、幻觉字段、token 限制处截断、泄漏散文如"这是你的 JSON："。

**方法二：生成后验证。** 自由生成，解析，针对模式验证，失败时重试。可靠但昂贵——你为每次重试付费，截断错误每次发生花费一个额外回合。

**方法三：约束解码。** 提供商在解码时强制执行模式。无效 token 从采样分布中屏蔽。输出保证解析且保证验证。失败坍缩为一种模式：拒绝（模型决定输入不适合模式）。

每个 2026 年前沿提供商都发布某种形式的方法三。

- **OpenAI。** `response_format: {type: "json_schema", strict: true}` 加上响应中的 `refusal`（如果模型拒绝）。
- **Anthropic。** `tool_use` 输入上的模式强制执行；`stop_reason: "refusal"` 不存在，但没有工具调用的 `end_turn` 是信号。
- **Gemini。** 请求级别的 `responseSchema`；2026 年 Gemini 为选定类型发布 token 级语法约束。
- **Pydantic AI。** `output_type=InvoiceModel` 发出结构化 `RunResult`，类型化为 `InvoiceModel`。
- **Zod（TypeScript）。** 运行时解析器，针对 Zod 模式验证提供商输出；与 OpenAI 的 `beta.chat.completions.parse` 配对。

共同线索：声明一次模式，端到端强制执行。

## 核心概念

### JSON Schema 2020-12——通用语言

每个提供商都接受 JSON Schema 2020-12。你最常用的构造：

- `type`：`object`、`array`、`string`、`number`、`integer`、`boolean`、`null` 之一。
- `properties`：字段名到子模式的映射。
- `required`：必须出现的字段名列表。
- `enum`：允许值的封闭集。
- `minimum` / `maximum`（数字），`minLength` / `maxLength` / `pattern`（字符串）。
- `items`：应用于每个数组元素的子模式。
- `additionalProperties`：`false` 禁止额外字段（默认值因模式而异）。

OpenAI 严格模式添加三个要求：每个属性必须列在 `required` 中，处处 `additionalProperties: false`，无未解析的 `$ref`。如果你违反这些，API 在请求时返回 400。

### Pydantic，Python 绑定

Pydantic v2 通过 `model_json_schema()` 从数据类形状模型生成 JSON Schema。Pydantic AI 包装此，因此你写：

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

代理框架将模式转换为 OpenAI 严格模式、Anthropic `input_schema` 或 Gemini `responseSchema`。模型的输出作为类型化的 `Invoice` 实例返回。验证错误引发带类型化错误路径的 `ValidationError`。

### Zod，TypeScript 绑定

Zod（`z.object({customer: z.string(), ...})`）是 TS 等价物。OpenAI 的 Node SDK 暴露 `zodResponseFormat(Invoice)`，转换为 API 的 JSON Schema 载荷。

### 拒绝

严格模式不能强制模型回答。如果输入无法适合模式（"邮件是一首诗，不是发票"），模型发出包含原因的 `refusal` 字段。你的代码必须将此作为一等结果处理，而非失败。拒绝也是有用的安全信号：被要求从受保护内容邮件中提取信用卡号的模型返回带安全原因附加的拒绝。

### 开放权重中的约束解码

开放权重实现使用三种技术。

1. **基于语法的解码**（`outlines`、`guidance`、`lm-format-enforcer`）：从模式构建确定性有限自动机；在每一步，屏蔽违反 FSM 的 token 的 logits。
2. **带 JSON 解析器的 logit 掩码**：与模型同步运行流式 JSON 解析器；在每一步，计算有效下一 token 集。
3. **带验证器的推测解码**：廉价草稿模型提出 token，验证器强制执行模式。

商业提供商在幕后选择其中之一。2026 年最先进的技术对短结构化输出比纯生成更快，对长结构化输出大致相同速度。

### 三种失败模式

1. **解析错误。** 输出不是有效 JSON。严格模式下不可能发生。在非严格提供商上仍可能发生。
2. **模式违规。** 输出解析但违反模式。严格模式下不可能发生。外部常见。
3. **拒绝。** 模型拒绝。必须作为类型化结果处理。

### 重试策略

当你处于严格模式之外（Anthropic 工具使用、非严格 OpenAI、旧版 Gemini）时，恢复模式是：

```
生成 -> 解析 -> 验证 -> 如果失败，注入错误并重试，最多 3 次
```

一次重试通常足够。三次重试捕获弱模型抖动。超过三次是坏模式的迹象：模型无法满足某些输入的模式，提示或模式需要修复。

### 小模型支持

约束解码在小模型上有效。带语法强制执行的 3B 参数开放模型在结构化任务上优于带原始提示的 70B 参数模型。这是结构化输出对生产重要的主要原因：它将可靠性与模型大小解耦。

## 使用它

`code/main.py` 在 stdlib 中发布最小 JSON Schema 2020-12 验证器（类型、必需、枚举、最小/最大、模式、项目、additionalProperties）。它包装一个 `Invoice` 模式并运行伪造 LLM 输出通过验证器，演示解析错误、模式违规和拒绝路径。在生产中用任何提供商的真实响应替换伪造输出。

看点：

- 验证器返回带路径和消息的类型化 `[ValidationError]` 列表。这是你想暴露给重试提示的形状。
- 拒绝分支不重试。它记录并返回类型化拒绝。Phase 14 · 09 将拒绝用作安全信号。
- `additionalProperties: false` 检查在对抗性测试输入上触发，显示严格模式为何关闭幻觉字段的门。

## 交付它

本课产出 `outputs/skill-structured-output-designer.md`。给定自由文本提取目标（发票、支持工单、简历等），该技能产生严格模式兼容的 JSON Schema 2020-12 和镜像它的 Pydantic 模型，附带类型化拒绝和重试处理存根。

## 练习

1. 运行 `code/main.py`。添加第四个测试用例，其 `total_usd` 为负数。确认验证器用 `minimum` 约束路径拒绝它。

2. 扩展验证器以支持带鉴别器的 `oneOf`。常见情况：`line_item` 是产品或服务，由 `kind` 标记。严格模式在这里有微妙规则；检查 OpenAI 的结构化输出指南。

3. 将相同的 Invoice 模式写为 Pydantic BaseModel 并比较 `model_json_schema()` 输出与你的手工模式。识别 Pydantic 默认设置但手工版本省略的一个字段。

4. 测量拒绝率。构建十个不应可提取的输入（一首歌的歌词、一个数学证明、一封空白邮件）并通过严格模式的真实提供商运行它们。统计拒绝 vs 幻觉输出。这是你拒绝感知重试的地面实况。

5. 从头到尾阅读 OpenAI 的结构化输出指南。识别它在严格模式中明确禁止但普通 JSON Schema 允许的一个构造。然后设计一个非本质地使用该禁止构造的模式，并将其重构为严格兼容。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| JSON Schema 2020-12 | "模式规范" | 每个现代提供商使用的 IETF 草案模式方言 |
| 严格模式 | "保证模式" | OpenAI 标志，通过约束解码强制执行模式 |
| 约束解码 | "Logit 掩码" | 解码时强制执行，屏蔽无效下一 token |
| 拒绝 | "模型拒绝" | 输入无法适合模式时的类型化结果 |
| 解析错误 | "无效 JSON" | 输出未解析为 JSON；严格模式下不可能 |
| 模式违规 | "错误形状" | 解析但违反类型 / 必需 / 枚举 / 范围 |
| `additionalProperties: false` | "不允许额外" | 禁止未知字段；OpenAI 严格模式必需 |
| Pydantic BaseModel | "类型化输出" | 发出并验证 JSON Schema 的 Python 类 |
| Zod 模式 | "TypeScript 输出类型" | 用于提供商输出验证的 TS 运行时模式 |
| 语法强制执行 | "开放权重约束解码" | 基于 FSM 的 logit 掩码，如 outlines / guidance |

## 延伸阅读

- [OpenAI — 结构化输出](https://platform.openai.com/docs/guides/structured-outputs) — 严格模式、拒绝和模式要求
- [OpenAI — 引入结构化输出](https://openai.com/index/introducing-structured-outputs-in-the-api/) — 2024 年 8 月发布帖子，解释解码保证
- [Pydantic AI — 输出](https://ai.pydantic.dev/output/) — 序列化到每个提供商的类型化 output_type 绑定
- [JSON Schema — 2020-12 发布说明](https://json-schema.org/draft/2020-12/release-notes) — 规范规范
- [Microsoft — Azure OpenAI 中的结构化输出](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) — 企业部署说明和严格模式注意事项
