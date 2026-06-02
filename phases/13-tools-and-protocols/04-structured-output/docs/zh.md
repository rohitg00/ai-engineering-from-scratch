# 结构化输出 — JSON Schema、Pydantic、Zod、约束解码

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> "好好请求模型返回 JSON" 在前沿模型上仍有 5 到 15 个百分点的失败率。结构化输出（structured outputs）通过约束解码（constrained decoding）补上这道口子：模型在采样时被强行禁止吐出任何会破坏 schema 的 token。OpenAI 的 strict 模式、Anthropic 的 schema 化 tool use、Gemini 的 `responseSchema`、Pydantic AI 的 `output_type`、Zod 的 `.parse`，都是同一思想的五种外观。本课构建 schema 校验器（validator）和 strict 模式契约，学习者后续每条生产级抽取流水线都会用到。

**Type:** Build
**Languages:** Python (stdlib, JSON Schema 2020-12 subset)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 用合适的约束（enum、min/max、required、pattern）为某个抽取目标写一份 JSON Schema 2020-12。
- 解释为什么 strict 模式与约束解码给出的保证，与"生成后再校验"完全不同。
- 区分三种失败模式：解析错误（parse error）、schema 违规（schema violation）、模型拒答（refusal）。
- 上线一条带类型化修复（typed repair）和类型化拒答处理（typed refusal handling）的抽取流水线。

## 问题（Problem）

一个读采购订单邮件的 agent 需要把自由文本变成 `{customer, line_items, total_usd}`。三种做法。

**做法一：在 prompt 里要 JSON。** "请用 JSON 回复，字段为 customer、line_items、total_usd。" 在前沿模型上有 85 到 95 个百分点的成功率。会从六种姿势挂掉：缺花括号、多余逗号、类型错、幻觉出（hallucinate）多余字段、被 token 上限截断、漏出像 "Here is your JSON:" 这样的散文。

**做法二：生成后再校验。** 自由生成、解析、用 schema 校验、失败重试。可靠但贵 —— 每次重试都要付费，截断 bug 每出现一次就多耗一回合。

**做法三：约束解码（constrained decoding）。** 由 provider 在解码阶段强制 schema。非法 token 会被从采样分布里直接 mask 掉。输出保证可解析、保证通过校验。失败只剩下一种形态：拒答（模型判定输入无法匹配 schema）。

每家 2026 年的前沿 provider 都有某种形式的做法三。

- **OpenAI。** `response_format: {type: "json_schema", strict: true}`，模型若拒答会在响应里带上 `refusal` 字段。
- **Anthropic。** 在 `tool_use` 的 input 上强制 schema；`stop_reason: "refusal"` 这种东西不存在，但是 `end_turn` 且没有 tool 调用就是信号。
- **Gemini。** 请求级 `responseSchema`；2026 年 Gemini 对部分类型上了 token 级语法约束。
- **Pydantic AI。** `output_type=InvoiceModel` 输出一个被类型化为 `InvoiceModel` 的结构化 `RunResult`。
- **Zod (TypeScript)。** 运行时 parser，把 provider 输出按 Zod schema 校验；和 OpenAI 的 `beta.chat.completions.parse` 配套。

主线只有一条：schema 声明一次，端到端强制。

## 概念（Concept）

### JSON Schema 2020-12 — 通用语（lingua franca）

每家 provider 都接受 JSON Schema 2020-12。最常用的几个构件：

- `type`：取值为 `object`、`array`、`string`、`number`、`integer`、`boolean`、`null` 之一。
- `properties`：字段名到子 schema 的映射。
- `required`：必须出现的字段名列表。
- `enum`：允许取值的封闭集合。
- `minimum` / `maximum`（数字），`minLength` / `maxLength` / `pattern`（字符串）。
- `items`：对数组每个元素都生效的子 schema。
- `additionalProperties`：`false` 表示禁止额外字段（默认值因模式而异）。

OpenAI strict 模式额外要求三件事：每个 property 都必须出现在 `required` 里、所有层级都要 `additionalProperties: false`、不能有未解析的 `$ref`。违反这些，API 在请求时直接返回 400。

### Pydantic — Python 端的绑定

Pydantic v2 通过 `model_json_schema()` 从 dataclass 形态的 model 生成 JSON Schema。Pydantic AI 在外面再包一层，让你可以直接写：

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

agent 框架会在边界处把 schema 翻译成 OpenAI strict 模式、Anthropic 的 `input_schema`、或 Gemini 的 `responseSchema`。模型输出回来就是一个类型化的 `Invoice` 实例。校验失败抛 `ValidationError`，错误路径是带类型的。

### Zod — TypeScript 端的绑定

Zod（`z.object({customer: z.string(), ...})`）是 TS 上的对应物。OpenAI 的 Node SDK 暴露了 `zodResponseFormat(Invoice)`，会翻译成 API 的 JSON Schema payload。

### 拒答（Refusals）

strict 模式没法逼模型必须回答。如果输入无法塞进 schema（"这封邮件是首诗，不是发票"），模型会在 `refusal` 字段里写明原因。你的代码必须把它当作一等结果（first-class outcome），而不是失败。拒答还有个用处是当作安全信号：要求模型从一封受保护内容邮件里抽信用卡号，模型会回一个带安全原因的拒答。

### 开源世界里的约束解码

开源权重（open-weights）实现常用三种技术。

1. **基于语法的解码**（`outlines`、`guidance`、`lm-format-enforcer`）：从 schema 构造一个确定性有限自动机（DFA），在每一步 mask 掉所有会让 FSM 进入非法状态的 token 的 logits。
2. **配合 JSON parser 的 logit 屏蔽**：跑一个流式 JSON parser，与模型同步推进；每一步算出合法的下一个 token 集合。
3. **带 verifier 的推测解码（speculative decoding）**：便宜的 draft 模型先提议 token，verifier 强制 schema。

商业 provider 在背后会挑其中一种。2026 年的 SOTA 在短结构化输出上比纯生成还快，长输出大约持平。

### 三种失败模式

1. **解析错误（Parse error）。** 输出不是合法 JSON。strict 模式下不可能发生。在非 strict provider 上仍可能发生。
2. **Schema 违规。** 输出能解析但不满足 schema。strict 模式下不可能发生。在 strict 之外很常见。
3. **拒答（Refusal）。** 模型不答。必须当作一种类型化的结果来处理。

### 重试策略

当你处在 strict 模式之外（Anthropic 的 tool use、非 strict 的 OpenAI、老版 Gemini）时，恢复模式是：

```
generate -> parse -> validate -> if fail, inject error and retry, max 3x
```

通常一次重试就够了。三次重试能兜住弱模型的偶发抽风。超过三次说明 schema 设计有问题：模型对某些输入根本满足不了它，得改 prompt 或改 schema。

### 小模型也能用

约束解码在小模型上也奏效。一个带语法强制的 3B 参数开源模型，在结构化任务上能压过一个用裸 prompt 的 70B 参数模型。这是结构化输出对生产很重要的根本原因：它把可靠性从模型规模上解耦出来了。

## 用起来（Use It）

`code/main.py` 用 stdlib 给出了一个最小 JSON Schema 2020-12 校验器（覆盖 types、required、enum、min/max、pattern、items、additionalProperties）。它包了一份 `Invoice` schema，把一段假的 LLM 输出走一遍校验器，演示解析错误、schema 违规、拒答三条路径。生产里把这段假输出换成任意 provider 的真实响应即可。

值得看的几点：

- 校验器返回一个类型化的 `[ValidationError]` 列表，带 path 和 message。这正是你想塞回重试 prompt 的形态。
- 拒答分支**不**重试。它打日志、返回一个类型化的拒答。Phase 14 · 09 会把拒答当作安全信号使用。
- `additionalProperties: false` 检查会在对抗性测试输入上触发，说明为什么 strict 模式能堵死幻觉字段那扇门。

## 上线部署（Ship It）

本课产出 `outputs/skill-structured-output-designer.md`。给定一个自由文本抽取目标（发票、客服 ticket、简历等等），这个 skill 会产出一份 strict 模式兼容的 JSON Schema 2020-12，以及一份与之对齐的 Pydantic model，并把类型化拒答和重试处理的桩（stub）一起留出来。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。加第四个测试用例，其中 `total_usd` 是负数。确认校验器以 `minimum` 约束的路径拒绝它。

2. 扩展校验器，让它支持带 discriminator 的 `oneOf`。常见场景：`line_item` 要么是 product，要么是 service，由 `kind` 标记。strict 模式在这里有些微妙规则；查一下 OpenAI 的 structured outputs 指南。

3. 把同一份 Invoice schema 写成一个 Pydantic BaseModel，比较 `model_json_schema()` 的输出和你手写的 schema。指出 Pydantic 默认会加、而手写版本省掉的那一个字段。

4. 度量拒答率。构造十段不应该被抽取的输入（一段歌词、一份数学证明、一封空白邮件），用一个真实的 strict 模式 provider 跑一遍。统计拒答数 vs 幻觉输出数。这就是你做拒答感知重试（refusal-aware retries）的 ground truth。

5. 把 OpenAI 的 structured outputs 指南从头到尾读一遍。找出它在 strict 模式下明确禁止、而原生 JSON Schema 允许的那一个构件。然后设计一份 schema，让它非本质地用上这个被禁的构件，再重构成 strict 兼容版本。

## 关键术语（Key Terms）

| 术语 | 大家口里的说法 | 它实际指什么 |
|------|----------------|------------------------|
| JSON Schema 2020-12 | "schema 规范" | 每家现代 provider 都讲的 IETF-draft schema 方言 |
| Strict mode | "保证 schema" | OpenAI 通过约束解码强制 schema 的开关 |
| Constrained decoding | "logit 屏蔽" | 解码时强制：mask 掉非法的下一个 token |
| Refusal | "模型不答" | 输入塞不进 schema 时的类型化结果 |
| Parse error | "JSON 不合法" | 输出不能解析为 JSON；strict 下不可能 |
| Schema violation | "形状不对" | 能解析但违反 type / required / enum / range |
| `additionalProperties: false` | "不许多塞" | 禁止未知字段；OpenAI strict 必须 |
| Pydantic BaseModel | "类型化输出" | 能产出并校验 JSON Schema 的 Python 类 |
| Zod schema | "TypeScript 输出类型" | 校验 provider 输出的 TS 运行时 schema |
| Grammar enforcement | "开源权重的约束解码" | 基于 FSM 的 logit 屏蔽，比如 outlines / guidance |

## 延伸阅读（Further Reading）

- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) — strict 模式、拒答、schema 要求
- [OpenAI — Introducing structured outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) — 2024 年 8 月发布稿，解释解码层面的保证
- [Pydantic AI — Output](https://ai.pydantic.dev/output/) — 类型化 output_type 绑定，序列化到各家 provider
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) — 规范本体
- [Microsoft — Structured outputs in Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) — 企业部署笔记和 strict 模式注意事项
