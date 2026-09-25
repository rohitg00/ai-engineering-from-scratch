# 结构化输出 — JSON Schema、Pydantic、Zod、约束解码

> “客气地让模型返回 JSON”在 5% 到 15% 的情况下会失败，即使是在前沿模型上。结构化输出通过约束解码弥补了这一差距：模型实际上被禁止生成会违反 schema 的 token。OpenAI 的 strict 模式、Anthropic 的 schema 类型化工具调用、Gemini 的 `responseSchema`、Pydantic AI 的 `output_type`，以及 Zod 的 `.parse`，都是同一思想的五种表现形式。本课程将构建 schema 校验器和 strict 模式契约，学习者将在每一个生产级抽取流水线中使用它们。

**Type:** Build
**Languages:** Python (标准库, JSON Schema 2020-12 子集)
**Prerequisites:** Phase 13 · 02 (函数调用深入解析)
**Time:** 约 75 分钟

## 学习目标

- 使用恰当的约束（enum、min/max、required、pattern）为一个抽取目标编写 JSON Schema 2020-12。
- 解释为什么 strict 模式和约束解码与“生成后校验”提供不同的保证。
- 区分三种失败模式：解析错误、schema 违反、模型拒绝。
- 交付一个带有类型化修复和类型化拒绝处理的抽取流水线。

## 问题所在

一个阅读采购订单邮件的代理需要把自由文本转换为 `{customer, line_items, total_usd}`。有三种方法。

**方法一：通过提示词要求 JSON。** “用 JSON 回复，包含字段 customer、line_items、total_usd。” 在前沿模型上有 85% 到 95% 的成功率。会以六种方式失败：缺少括号、尾随逗号、类型错误、幻觉字段、在 token 上限处被截断、泄漏出“这是你的 JSON：”之类的散文文本。

**方法二：生成后校验。** 自由生成、解析、根据 schema 校验，失败时重试。可靠但昂贵——每次重试都要付费，而且截断类 bug 每次发生都要多花一轮交互。

**方法三：约束解码。** 提供方在解码时强制执行 schema。无效 token 从采样分布中被屏蔽。输出保证可解析、保证能通过校验。失败收敛为一种模式：拒绝（模型判定输入不符合 schema）。

2026 年的每一个前沿提供方都提供了方法三的某种形式。

- **OpenAI。** `response_format: {type: "json_schema", strict: true}`，如果模型拒绝，则在响应中附带 `refusal`。
- **Anthropic。** 在 `tool_use` 输入上强制执行 schema；`stop_reason: "refusal"` 并不存在，但 `end_turn` 且未调用工具就是该信号。
- **Gemini。** 请求级别的 `responseSchema`；2026 年 Gemini 为选定类型提供 token 级别的文法约束。
- **Pydantic AI。** `output_type=InvoiceModel` 发出一个结构化的、类型为 `InvoiceModel` 的 `RunResult`。
- **Zod (TypeScript)。** 运行时解析器，根据 Zod schema 校验提供方的输出；与 OpenAI 的 `beta.chat.completions.parse` 配合使用。

共同点：声明 schema 一次，端到端强制执行。

## 概念

### JSON Schema 2020-12 — 通用语言

每个提供方都接受 JSON Schema 2020-12。你最常用的结构：

- `type`：`object`、`array`、`string`、`number`、`integer`、`boolean`、`null` 之一。
- `properties`：字段名到子 schema 的映射。
- `required`：必须出现的字段名列表。
- `enum`：允许值的封闭集合。
- `minimum` / `maximum`（数字），`minLength` / `maxLength` / `pattern`（字符串）。
- `items`：应用于每个数组元素的子 schema。
- `additionalProperties`：`false` 禁止额外字段（默认值因模式而异）。

OpenAI strict 模式增加了三个要求：每个属性都必须列在 `required` 中、处处都要有 `additionalProperties: false`，并且不允许未解析的 `$ref`。如果违反了这些要求，API 会在请求时返回 400。

### Pydantic，Python 绑定

Pydantic v2 通过 `model_json_schema()` 从 dataclass 形状的模型生成 JSON Schema。Pydantic AI 对此进行了封装，你只需编写：

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

代理框架会在边缘处把该 schema 转换为 OpenAI strict 模式、Anthropic 的 `input_schema`，或 Gemini 的 `responseSchema`。模型的输出以类型化的 `Invoice` 实例返回。校验错误会引发带有类型化错误路径的 `ValidationError`。

### Zod，TypeScript 绑定

Zod（`z.object({customer: z.string(), ...})`）是 TS 中的等价物。OpenAI 的 Node SDK 暴露了 `zodResponseFormat(Invoice)`，它会转换为 API 的 JSON Schema 载荷。

### 拒绝

Strict 模式无法强迫模型回答。如果输入不符合 schema（“这封邮件是一首诗，不是发票”），模型会发出一个包含原因的 `refusal` 字段。你的代码必须将其作为一等结果处理，而不是失败。拒绝也是有用的安全信号：当要求从受保护内容的邮件中提取信用卡号时，模型会返回拒绝并附带安全原因。

### 开放权重下的约束解码

开放权重的实现使用三种技术。

1. **基于文法的解码**（`outlines`、`guidance`、`lm-format-enforcer`）：从 schema 构建确定性有限自动机；在每一步，屏蔽会违反 FSM 的 token 的 logits。
2. **带 JSON 解析器的 logit 屏蔽**：让流式 JSON 解析器与模型同步运行；在每一步计算合法的下一个 token 集合。
3. **带校验器的投机解码**：廉价的草稿模型提出 token，校验器强制执行 schema。

商业提供方在幕后选择其中之一。2026 年的最优实现在短结构化输出上比普通生成更快，在长输出上速度大致相同。

### 三种失败模式

1. **解析错误。** 输出不是合法的 JSON。在 strict 模式下不可能发生。在非 strict 提供方上仍可能发生。
2. **Schema 违反。** 输出可解析但违反 schema。在 strict 模式下不可能发生。在其之外很常见。
3. **拒绝。** 模型拒绝回答。必须作为类型化结果处理。

### 重试策略

当你处于 strict 模式之外时（Anthropic 工具调用、非 strict 的 OpenAI、旧版 Gemini），恢复模式是：

```
generate -> parse -> validate -> if fail, inject error and retry, max 3x
```

一次重试通常就足够了。三次重试可以应对弱模型的偶发失败。超过三次则是坏 schema 的迹象：模型在某些输入上无法满足它，需要修复提示词或 schema。

### 小模型支持

约束解码在小模型上同样有效。一个带文法强制的 3B 参数开源模型，在结构化任务上胜过一个仅靠原始提示词的 70B 参数模型。这是结构化输出对生产环境如此重要的主要原因：它把可靠性与模型规模解耦了。

```figure
constrained-decoding
```

## 动手实践

`code/main.py` 在标准库中实现了一个极简的 JSON Schema 2020-12 校验器（类型、required、enum、min/max、pattern、items、additionalProperties）。它封装了一个 `Invoice` schema，并将一个模拟的 LLM 输出通过校验器运行，演示解析错误、schema 违反和拒绝三条路径。在生产环境中，把模拟输出替换为任何提供方的真实响应。

需要关注的地方：

- 校验器返回带路径和消息的类型化 `[ValidationError]` 列表。这正是你希望呈现给重试提示词的形状。
- 拒绝分支不会重试。它会记录日志并返回类型化的拒绝。Phase 14 · 09 把拒绝用作安全信号。
- `additionalProperties: false` 检查会在对抗性测试输入上触发，说明 strict 模式为何能杜绝幻觉字段。

## 交付成果

本课程产出 `outputs/skill-structured-output-designer.md`。给定一个自由文本抽取目标（发票、支持工单、简历等），该技能产出一个兼容 strict 模式的 JSON Schema 2020-12，以及与之对应的 Pydantic 模型，并预置了类型化的拒绝和重试处理存根。

## 练习

1. 运行 `code/main.py`。添加第四个测试用例，其 `total_usd` 是负数。确认校验器以 `minimum` 约束路径拒绝它。

2. 扩展校验器以支持带判别器的 `oneOf`。常见情形：`line_item` 要么是产品要么是服务，用 `kind` 标记。Strict 模式在此有细微规则；请查阅 OpenAI 的结构化输出指南。

3. 用 Pydantic BaseModel 编写相同的 Invoice schema，并将 `model_json_schema()` 的输出与你的手写 schema 进行比较。找出 Pydantic 默认设置而手写版本遗漏的那个字段。

4. 测量拒绝率。构造十个不应可抽取的输入（一首歌词、一个数学证明、一封空白邮件），并用某个真实提供方的 strict 模式运行它们。统计拒绝与幻觉输出的数量。这是你做拒绝感知重试时的基准真值。

5. 从头到尾阅读 OpenAI 的结构化输出指南。找出它在 strict 模式中明确禁止而普通 JSON Schema 允许的那一个结构。然后设计一个非必要地使用该被禁结构的 schema，并将其重构为 strict 兼容。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| JSON Schema 2020-12 | “那个 schema 规范” | 每个现代提供方都支持的 IETF 草案 schema 方言 |
| Strict 模式 | “保证符合 schema” | OpenAI 的开关，通过约束解码强制执行 schema |
| 约束解码 | “logit 屏蔽” | 解码时强制执行，屏蔽无效的下一个 token |
| 拒绝 | “模型拒绝回答” | 输入不符合 schema 时的类型化结果 |
| 解析错误 | “非法 JSON” | 输出未能解析为 JSON；在 strict 下不可能 |
| Schema 违反 | “形状不对” | 可解析但违反了类型 / required / enum / 取值范围 |
| `additionalProperties: false` | “不允许多余字段” | 禁止未知字段；OpenAI strict 中必需 |
| Pydantic BaseModel | “类型化输出” | 生成并校验 JSON Schema 的 Python 类 |
| Zod schema | “TypeScript 输出类型” | 用于校验提供方输出的 TS 运行时 schema |
| 文法强制 | “开放权重约束解码” | 基于 FSM 的 logit 屏蔽，如 outlines / guidance |

## 延伸阅读

- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) — strict 模式、拒绝，以及 schema 要求
- [OpenAI — Introducing structured outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) — 2024 年 8 月的发布文章，解释解码保证
- [Pydantic AI — Output](https://ai.pydantic.dev/output/) — 序列化为各提供方格式的类型化 output_type 绑定
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) — 规范原文
- [Microsoft — Structured outputs in Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) — 企业部署说明与 strict 模式注意事项