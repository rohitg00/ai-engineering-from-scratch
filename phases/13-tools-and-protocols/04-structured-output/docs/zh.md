# 04 · 结构化输出——JSON Schema、Pydantic、Zod 与受约束解码

> “礼貌地请模型返回 JSON”这种做法，即便在前沿模型上也有 5% 到 15% 的失败率。结构化输出（structured outputs）通过受约束解码（constrained decoding）弥补了这一差距：模型从根本上被阻止生成任何会违反 schema 的 token。OpenAI 的严格模式（strict mode）、Anthropic 的带 schema 类型的工具使用（tool use）、Gemini 的 `responseSchema`、Pydantic AI 的 `output_type`，以及 Zod 的 `.parse`，是同一思想的五种表层形式。本课将构建一个 schema 校验器以及严格模式契约，学习者将在每一条生产级抽取管线中用到它们。

**类型：** 构建（Build）
**语言：** Python（标准库，JSON Schema 2020-12 子集）
**前置：** 阶段 13 · 02（函数调用深入）
**时长：** 约 75 分钟

## 学习目标

- 为某个抽取目标编写一份 JSON Schema 2020-12，并使用正确的约束（enum、min/max、required、pattern）。
- 解释为什么严格模式与受约束解码所提供的保证，不同于“生成后再校验”。
- 区分三种失败模式：解析错误（parse error）、schema 违规（schema violation）、模型拒绝（model refusal）。
- 交付一条带有类型化修复与类型化拒绝处理的抽取管线。

## 问题所在

一个读取采购订单邮件的智能体（agent）需要把自由文本转换成 `{customer, line_items, total_usd}`。这有三种方法。

**方法一：提示要求 JSON。** “请用 JSON 回复，包含字段 customer、line_items、total_usd。”在前沿模型上有 85% 到 95% 的成功率。它会以六种方式失败：缺失括号、尾随逗号、类型错误、幻觉字段、在 token 上限处被截断、泄漏出诸如“这是你的 JSON：”之类的散文。

**方法二：生成后再校验。** 自由生成，解析，对照 schema 校验，失败则重试。可靠但昂贵——每次重试你都要付费，而截断 bug 每出现一次就要多花一个回合（turn）。

**方法三：受约束解码。** 由提供方在解码时强制执行 schema。无效的 token 会从采样分布中被屏蔽掉。输出保证可被解析、保证通过校验。失败收敛为唯一一种模式：拒绝（模型判定输入不符合 schema）。

每一家 2026 年的前沿提供方都提供了某种形式的方法三。

- **OpenAI。** `response_format: {type: "json_schema", strict: true}`，并在模型拒绝时于响应中返回 `refusal`。
- **Anthropic。** 对 `tool_use` 的输入强制执行 schema；不存在 `stop_reason: "refusal"` 这种东西，但 `end_turn` 且没有工具调用就是拒绝信号。
- **Gemini。** 在请求层面的 `responseSchema`；2026 年 Gemini 为选定类型提供了 token 级别的语法约束。
- **Pydantic AI。** `output_type=InvoiceModel` 会产出一个类型为 `InvoiceModel` 的结构化 `RunResult`。
- **Zod（TypeScript）。** 运行时解析器，对照 Zod schema 校验提供方的输出；与 OpenAI 的 `beta.chat.completions.parse` 配套使用。

共同的主线：声明一次 schema，端到端地强制执行它。

## 核心概念

### JSON Schema 2020-12——通用语言

每家提供方都接受 JSON Schema 2020-12。你最常用的构造如下：

- `type`：取值为 `object`、`array`、`string`、`number`、`integer`、`boolean`、`null` 之一。
- `properties`：字段名到子 schema 的映射。
- `required`：必须出现的字段名列表。
- `enum`：允许取值的封闭集合。
- `minimum` / `maximum`（数字），`minLength` / `maxLength` / `pattern`（字符串）。
- `items`：应用于数组中每个元素的子 schema。
- `additionalProperties`：设为 `false` 时禁止额外字段（默认值因模式而异）。

OpenAI 严格模式新增了三条要求：每个属性都必须列入 `required`、各处都要 `additionalProperties: false`、不得有未解析的 `$ref`。若违反这些规则，API 会在请求时返回 400。

### Pydantic，Python 端的绑定

Pydantic v2 通过 `model_json_schema()` 从形如 dataclass 的模型生成 JSON Schema。Pydantic AI 对其进行了封装，于是你可以这样写：

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

智能体框架会在边界处把该 schema 翻译为 OpenAI 严格模式、Anthropic 的 `input_schema` 或 Gemini 的 `responseSchema`。模型的输出会以类型化的 `Invoice` 实例返回。校验错误会抛出带有类型化错误路径的 `ValidationError`。

### Zod，TypeScript 端的绑定

Zod（`z.object({customer: z.string(), ...})`）是 TS 的等价物。OpenAI 的 Node SDK 暴露了 `zodResponseFormat(Invoice)`，它会翻译成 API 所需的 JSON Schema 载荷。

### 拒绝

严格模式无法强迫模型作答。如果输入无法套入 schema（“这封邮件是一首诗，不是发票”），模型会产出一个包含原因的 `refusal` 字段。你的代码必须把它当作一等公民的结果来处理，而不是当作失败。拒绝还可作为一个有用的安全信号：当模型被要求从一封受保护内容的邮件中抽取信用卡号时，它会返回一个附带安全原因的拒绝。

### 开放生态中的受约束解码

开放权重（open-weights）实现使用三种技术。

1. **基于语法的解码**（`outlines`、`guidance`、`lm-format-enforcer`）：从 schema 构建一个确定性有限自动机；在每一步，屏蔽掉那些会违反该 FSM 的 token 的 logits。
2. **配合 JSON 解析器的 logit 屏蔽**：让一个流式 JSON 解析器与模型同步运行；在每一步，计算出合法的下一个 token 集合。
3. **带校验器的推测解码（speculative decoding）**：廉价的草稿模型提出 token，校验器强制执行 schema。

商用提供方在幕后会选用其中之一。2026 年的最优技术，对于短的结构化输出比普通生成更快，对于长输出则大致同速。

### 三种失败模式

1. **解析错误。** 输出不是合法的 JSON。在严格模式下不可能发生。在非严格的提供方上仍可能发生。
2. **schema 违规。** 输出可被解析，但违反了 schema。在严格模式下不可能发生。在严格模式之外则很常见。
3. **拒绝。** 模型不予作答。必须作为一种类型化结果来处理。

### 重试策略

当你处于严格模式之外时（Anthropic 工具使用、非严格的 OpenAI、较旧的 Gemini），恢复模式是：

```
generate -> parse -> validate -> if fail, inject error and retry, max 3x
```

通常一次重试就足够。三次重试能兜住弱模型的偶发抖动。超过三次就是 schema 有问题的信号：模型对某些输入无法满足它，需要修正提示词或 schema。

### 对小模型的支持

受约束解码在小模型上同样有效。一个 30 亿参数、带语法强制的开放模型，在结构化任务上的表现优于一个 700 亿参数、仅靠原始提示的模型。这正是结构化输出对生产至关重要的主要原因：它把可靠性与模型规模解耦了。

## 上手实践

`code/main.py` 用标准库实现了一个最小化的 JSON Schema 2020-12 校验器（types、required、enum、min/max、pattern、items、additionalProperties）。它封装了一份 `Invoice` schema，并让一段伪造的 LLM 输出经过该校验器，演示解析错误、schema 违规与拒绝三条路径。在生产中，把伪造输出换成任意提供方的真实响应即可。

需要关注的要点：

- 该校验器返回一个类型化的 `[ValidationError]` 列表，带路径和消息。这正是你想暴露给重试提示词的形态。
- 拒绝分支不会重试。它会记录日志并返回一个类型化的拒绝。阶段 14 · 09 会把拒绝当作安全信号使用。
- `additionalProperties: false` 检查会在对抗性测试输入上触发，展示了严格模式为何能对幻觉字段关上大门。

## 交付物

本课产出 `outputs/skill-structured-output-designer.md`。给定一个自由文本的抽取目标（发票、工单、简历等），该技能（skill）会产出一份与严格模式兼容的 JSON Schema 2020-12，以及一个与之镜像的 Pydantic 模型，并内置类型化拒绝与重试处理的桩代码。

## 练习

1. 运行 `code/main.py`。新增第四个测试用例，其 `total_usd` 为负数。确认校验器以 `minimum` 约束路径将其拒绝。

2. 扩展校验器以支持带判别器（discriminator）的 `oneOf`。常见场景：`line_item` 要么是产品要么是服务，由 `kind` 标记。严格模式在此处有微妙的规则；请查阅 OpenAI 的结构化输出指南。

3. 把同一份 Invoice schema 写成一个 Pydantic BaseModel，并把 `model_json_schema()` 的输出与你手写的 schema 作比较。找出 Pydantic 默认设置而手写版本遗漏的那一个字段。

4. 测量拒绝率。构造十个本不应可被抽取的输入（一段歌词、一份数学证明、一封空白邮件），用启用严格模式的真实提供方运行它们。统计拒绝数与幻觉输出数。这就是你做拒绝感知重试的基准真值（ground truth）。

5. 从头到尾通读 OpenAI 的结构化输出指南。找出它在严格模式下明确禁止、而普通 JSON Schema 允许的那一个构造。然后设计一份非必要地使用了该禁止构造的 schema，并将其重构为与严格模式兼容。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| JSON Schema 2020-12 | “那个 schema 规范” | 每家现代提供方都通用的 IETF 草案 schema 方言 |
| 严格模式（Strict mode） | “保证符合 schema” | OpenAI 的开关，通过受约束解码强制执行 schema |
| 受约束解码（Constrained decoding） | “logit 屏蔽” | 解码时的强制执行，屏蔽掉无效的下一个 token |
| 拒绝（Refusal） | “模型不答” | 输入无法套入 schema 时的类型化结果 |
| 解析错误（Parse error） | “无效 JSON” | 输出无法解析为 JSON；在严格模式下不可能 |
| schema 违规（Schema violation） | “形态错误” | 可解析但违反了 types / required / enum / 取值范围 |
| `additionalProperties: false` | “不允许多余字段” | 禁止未知字段；OpenAI 严格模式中必需 |
| Pydantic BaseModel | “类型化输出” | 既产出又校验 JSON Schema 的 Python 类 |
| Zod schema | “TypeScript 输出类型” | 用于校验提供方输出的 TS 运行时 schema |
| 语法强制（Grammar enforcement） | “开放权重的受约束解码” | 基于 FSM 的 logit 屏蔽，如 outlines / guidance 中所示 |

## 延伸阅读

- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) —— 严格模式、拒绝与 schema 要求
- [OpenAI — Introducing structured outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) —— 2024 年 8 月的发布文章，解释了解码层面的保证
- [Pydantic AI — Output](https://ai.pydantic.dev/output/) —— 类型化 output_type 绑定，可序列化为各家提供方格式
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) —— 权威规范
- [Microsoft — Structured outputs in Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) —— 企业部署说明与严格模式注意事项
