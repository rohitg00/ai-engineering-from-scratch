# 结构化输出 — JSON Schema、Pydantic、Zod、约束解码

> "礼貌地让模型返回 JSON" 即使在最先进的模型上也有 5% 到 15% 的失败率。结构化输出通过约束解码弥补了这一差距：模型被从根本上阻止生成违反模式的 token。OpenAI 的 strict 模式、Anthropic 的 schema 类型工具调用、Gemini 的 `responseSchema`、Pydantic AI 的 `output_type` 以及 Zod 的 `.parse` 是同一思想的五种表现形式。本节课将构建模式验证器和 strict 模式契约，这是每个生产级提取管线的学习者都必须掌握的。

**类型：** 构建  
**语言：** Python（标准库，JSON Schema 2020-12 子集）  
**前置知识：** 第 13 章 · 02（函数调用深入探讨）  
**时长：** 约 75 分钟

## 学习目标

- 为提取目标编写 JSON Schema 2020-12，使用正确的约束（enum、min/max、required、pattern）。
- 解释 strict 模式和约束解码为何能提供与"生成后验证"不同的保障。
- 区分三种失败模式：解析错误、模式违例、模型拒绝。
- 交付一个带有类型化修复和类型化拒绝处理的提取管线。

## 问题

一个阅读采购订单邮件的代理需要将自由文本转换为 `{customer, line_items, total_usd}`。有三种方法。

**方法一：提示生成 JSON。** "请以 JSON 格式回复，字段包括 customer、line_items、total_usd。"在顶级模型上 85% 到 95% 的情况下有效。失败方式有六种：缺少大括号、尾部逗号、类型错误、幻觉字段、在 token 限制处截断、泄露诸如"这是您要求的 JSON："之类的散文。

**方法二：生成后验证。** 自由生成，解析，根据模式验证，失败时重试。可靠但代价高昂——每次重试都要付费，截断问题每次出现就多消耗一次交互。

**方法三：约束解码。** 提供商在解码时强制实施模式。无效 token 被从采样分布中屏蔽。输出保证能解析、保证能验证。失败坍缩为一种模式：拒绝（模型判定输入不适合该模式）。

2026 年的每个前沿提供商都提供了某种形式的方法三。

- **OpenAI。** `response_format: {type: "json_schema", strict: true}` 加上响应中的 `refusal` 字段（当模型拒绝时）。
- **Anthropic。** 对 `tool_use` 输入实施模式强制；没有"`stop_reason: refusal`"这种说法，但 `end_turn` 且没有工具调用就是一个信号。
- **Gemini。** 请求级别的 `responseSchema`；2026 年 Gemini 为选定类型提供了 token 级语法约束。
- **Pydantic AI。** `output_type=InvoiceModel` 输出一个类型化为 `InvoiceModel` 的结构化 `RunResult`。
- **Zod（TypeScript）。** 运行时解析器，根据 Zod 模式验证提供商输出；与 OpenAI 的 `beta.chat.completions.parse` 配合使用。

共同主线：声明模式一次，端到端地强制实施。

## 概念

### JSON Schema 2020-12 — 通用语言

每个提供商都接受 JSON Schema 2020-12。你最常用的结构：

- `type`：取值 `object`、`array`、`string`、`number`、`integer`、`boolean`、`null` 之一。
- `properties`：字段名到子模式的映射。
- `required`：必须出现的字段名列表。
- `enum`：允许值的封闭集合。
- `minimum` / `maximum`（数字），`minLength` / `maxLength` / `pattern`（字符串）。
- `items`：应用于每个数组元素的子模式。
- `additionalProperties`：`false` 禁止额外字段（默认行为因模式而异）。

OpenAI strict 模式增加了三个要求：每个属性都必须在 `required` 中列出，处处设置 `additionalProperties: false`，且不能有未解析的 `$ref`。如果违反这些要求，API 会在请求时返回 400。

### Pydantic — Python 绑定

Pydantic v2 通过 `model_json_schema()` 从数据类风格模型生成 JSON Schema。Pydantic AI 封装了这一点，让你编写：

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

然后代理框架在边缘将模式转换为 OpenAI strict 模式、Anthropic `input_schema` 或 Gemini `responseSchema`。模型的输出以类型化的 `Invoice` 实例形式返回。验证错误会引发 `ValidationError`，其中包含类型化的错误路径。

### Zod — TypeScript 绑定

Zod（`z.object({customer: z.string(), ...})`）是 TypeScript 的等价物。OpenAI 的 Node SDK 暴露了 `zodResponseFormat(Invoice)`，它会转换为 API 的 JSON Schema 载荷。

### 拒绝（Refusals）

Strict 模式无法强制模型回答。如果输入无法适配模式（"那封邮件是一首诗，不是发票"），模型会发出一个包含原因的 `refusal` 字段。你的代码必须将拒绝视为一等结果，而非失败。拒绝也可以作为安全信号：当模型被要求从受保护内容邮件中提取信用卡号时，它会返回一个包含安全原因的拒绝。

### 开源领域的约束解码

开源权重实现使用三种技术：

1. **基于语法的解码**（`outlines`、`guidance`、`lm-format-enforcer`）：从模式构建确定性有限自动机；在每一步屏蔽会违反 FSM 的 token 的 logits。
2. **带 JSON 解析器的 logit 屏蔽**：与模型同步运行流式 JSON 解析器；在每一步计算有效下一 token 集合。
3. **带验证者的推测解码**：廉价的草稿模型提出 token，验证者强制实施模式。

商业提供商在后台选择其中一种。2026 年的最新技术，对于短结构化输出比普通生成更快，对于长结构化输出速度大致相同。

### 三种失败模式

1. **解析错误。** 输出不是有效的 JSON。在 strict 模式下不可能发生。在非 strict 提供商上仍可能发生。
2. **模式违例。** 输出可以解析但违反了模式。在 strict 模式下不可能发生。在非 strict 模式下很常见。
3. **拒绝。** 模型拒绝。必须作为类型化结果处理。

### 重试策略

当你在 strict 模式之外时（Anthropic 工具调用、非 strict OpenAI、旧版 Gemini），恢复模式是：

```
生成 -> 解析 -> 验证 -> 若失败，注入错误并重试，最多 3 次
```

通常一次重试就足够了。三次重试能捕获弱模型的偶发问题。超过三次是模式有问题的信号：模型在某些输入上无法满足它，需要修正提示或模式。

### 小模型支持

约束解码在小模型上也有效。一个 30 亿参数的开放模型配合语法强制，在结构化任务上优于 700 亿参数模型配合原始提示。这是结构化输出对生产至关重要的主要原因：它将可靠性从模型规模中解耦出来。

## 使用

`code/main.py` 提供了一个用标准库实现的最小 JSON Schema 2020-12 验证器（类型、required、enum、min/max、pattern、items、additionalProperties）。它封装了一个 `Invoice` 模式，并通过验证器运行一个模拟的 LLM 输出，演示了解析错误、模式违例和拒绝路径。在生产环境中，将模拟输出替换为任何提供商的真实响应即可。

需要关注的点：

- 验证器返回一个类型化的 `[ValidationError]` 列表，包含路径和消息。这就是你想要暴露给重试提示的形状。
- 拒绝分支**不**重试。它记录日志并返回一个类型化的拒绝。第 14 章 · 09 将拒绝用作安全信号。
- `additionalProperties: false` 检查会在对抗性测试输入上触发，展示了为什么 strict 模式能堵住幻觉字段的大门。

## 交付

本节课产出 `outputs/skill-structured-output-designer.md`。给定一个自由文本提取目标（发票、工单、简历等），该技能会生成一个与 strict 模式兼容的 JSON Schema 2020-12 和一个与之镜像对应的 Pydantic 模型，其中包含类型化的拒绝和重试处理存根。

## 练习

1. 运行 `code/main.py`。添加第四个测试用例，其 `total_usd` 为负数。确认验证器通过 `minimum` 约束路径拒绝它。

2. 扩展验证器以支持带鉴别器的 `oneOf`。常见场景：`line_item` 要么是产品要么是服务，由 `kind` 标记。Strict 模式在这里有微妙的规则；请查看 OpenAI 的结构化输出指南。

3. 将相同的 Invoice 模式编写为 Pydantic BaseModel，并将 `model_json_schema()` 输出与你手写的模式进行比较。找出 Pydantic 默认设置而手写版本省略的那一个字段。

4. 测量拒绝率。构造十个不应被提取的输入（歌词、数学证明、空白邮件），在 strict 模式下通过真实提供商运行它们。统计拒绝次数与幻觉输出次数。这是你进行拒绝感知重试的基准真相。

5. 从头到尾阅读 OpenAI 的结构化输出指南。找出它在 strict 模式下明确禁止、而普通 JSON Schema 允许的那一个构造。然后设计一个非必要使用该禁止构造的模式，并将其重构为 strict 兼容。

## 关键术语

| 术语 | 人们所说的 | 实际含义 |
|------|-----------|---------|
| JSON Schema 2020-12 | "模式规范" | 每个现代提供商都使用的 IETF 草案模式方言 |
| Strict 模式 | "有保障的模式" | OpenAI 通过约束解码强制实施模式的标志 |
| 约束解码 | "Logit 屏蔽" | 解码时强制实施，屏蔽无效下一 token |
| 拒绝（Refusal） | "模型拒绝" | 输入无法适配模式时的类型化结果 |
| 解析错误 | "无效 JSON" | 输出未能解析为 JSON；strict 模式下不可能 |
| 模式违例 | "形状错误" | 已解析但违反了类型 / required / enum / 范围 |
| `additionalProperties: false` | "不允许额外字段" | 禁止未知字段；OpenAI strict 模式要求 |
| Pydantic BaseModel | "类型化输出" | 生成并验证 JSON Schema 的 Python 类 |
| Zod schema | "TypeScript 输出类型" | 用于提供商输出验证的 TS 运行时模式 |
| 语法强制 | "开源权重约束解码" | 基于 FSM 的 logit 屏蔽，如 outlines / guidance 所用 |

## 延伸阅读

- [OpenAI — 结构化输出](https://platform.openai.com/docs/guides/structured-outputs) — strict 模式、拒绝和模式要求
- [OpenAI — 介绍结构化输出](https://openai.com/index/introducing-structured-outputs-in-the-api/) — 2024 年 8 月发布文章，解释解码保证
- [Pydantic AI — 输出](https://ai.pydantic.dev/output/) — 可序列化到每个提供商的类型化 output_type 绑定
- [JSON Schema — 2020-12 发布说明](https://json-schema.org/draft/2020-12/release-notes) — 权威规范
- [Microsoft — Azure OpenAI 中的结构化输出](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) — 企业部署说明和 strict 模式注意事项
