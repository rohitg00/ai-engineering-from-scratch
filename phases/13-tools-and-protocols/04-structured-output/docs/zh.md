# 结构化输出 — JSON Schema、Pydantic、Zod、约束解码

> "请模型礼貌地返回JSON"的方法即使在最前沿的模型上也会有5%到15%的失败率。结构化输出通过约束解码缩小了这个差距：模型被严格禁止发出违反schema的token。OpenAI的严格模式、Anthropic的schema类型工具使用、Gemini的`responseSchema`、Pydantic AI的`output_type`以及Zod的`.parse`都是同一理念的五种表现形式。本课程将构建schema验证器和严格模式合约，学员将在每个生产提取管道中使用它们。

**类型：** 构建
**语言：** Python（stdlib，JSON Schema 2020-12子集）
**先决条件：** 第13阶段 · 02（函数调用深入探讨）
**时间：** 约75分钟

## 学习目标

- 使用正确的约束（enum、min/max、required、pattern）为提取目标编写JSON Schema 2020-12。
- 解释为什么严格模式和约束解码比"生成后验证"提供不同的保证。
- 区分三种失败模式：解析错误、schema违规、模型拒绝。
- 发布带有类型化修复和类型化拒绝处理的提取管道。

## 问题

读取采购订单邮件的代理需要将自由文本转换为`{customer, line_items, total_usd}`。三种方法。

**方法一：提示JSON。** "以JSON格式回复，包含customer、line_items、total_usd字段。"在最前沿的模型上成功率为85%到95%。有六种失败方式：缺少大括号、尾随逗号、错误类型、幻觉字段、在token限制处截断、泄露如"这是您的JSON："之类的散文。

**方法二：生成后验证。** 自由生成、解析、对照schema验证、失败时重试。可靠但昂贵——每次重试都要付费，截断错误每次发生会额外消耗一轮。

**方法三：约束解码。** 提供者在解码时强制执行schema。无效token从采样分布中被屏蔽。输出保证可以解析且保证验证。失败简化为一种模式：拒绝（模型决定输入不符合schema）。

2026年的每个前沿提供者都以某种形式实现了方法三。

- **OpenAI。** `response_format: {type: "json_schema", strict: true}`加上响应中的`refusal`（如果模型拒绝）。
- **Anthropic。** 对`tool_use`输入的schema强制执行；`stop_reason: "refusal"`不存在，但`end_turn`且没有工具调用是信号。
- **Gemini。** 请求级别的`responseSchema`；2026年Gemini将为选定类型提供token级语法约束。
- **Pydantic AI。** `output_type=InvoiceModel`发出类型化为`InvoiceModel`的结构化`RunResult`。
- **Zod (TypeScript)。** 运行时解析器，对照Zod schema验证提供者输出；与OpenAI的`beta.chat.completions.parse`配对。

共同点：一次性声明schema，端到端强制执行。

## 概念

### JSON Schema 2020-12 — 通用语言

每个提供者都接受JSON Schema 2020-12。你最常用的结构：

- `type`：`object`、`array`、`string`、`number`、`integer`、`boolean`、`null`之一。
- `properties`：字段名到子schema的映射。
- `required`：必须出现的字段名列表。
- `enum`：允许值的封闭集合。
- `minimum` / `maximum`（数字）、`minLength` / `maxLength` / `pattern`（字符串）。
- `items`：应用于每个数组元素的子schema。
- `additionalProperties`：`false`禁止额外字段（默认值因模式而异）。

OpenAI严格模式添加三个要求：每个属性都必须列在`required`中，处处`additionalProperties: false`，没有未解决的`$ref`。如果违反这些，API会在请求时返回400。

### Pydantic，Python绑定

Pydantic v2通过`model_json_schema()`从类数据模型形状生成JSON Schema。Pydantic AI包装了这个功能，所以你可以编写：

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

代理框架将schema转换为OpenAI严格模式、Anthropic `input_schema`或Gemini `responseSchema`。模型的输出作为类型化的`Invoice`实例返回。验证错误会引发带有类型化错误路径的`ValidationError`。

### Zod，TypeScript绑定

Zod (`z.object({customer: z.string(), ...})`)是TypeScript等价物。OpenAI的Node SDK暴露`zodResponseFormat(Invoice)`，它转换为API的JSON Schema负载。

### 拒绝

严格模式不能强制模型回答。如果输入无法符合schema（"邮件是诗歌，不是发票"），模型发出包含拒绝理由的`refusal`字段。你的代码必须将其作为一流结果处理，而不是失败。拒绝也用作安全信号：被要求从受保护内容邮件中提取信用卡号的模型会返回带有安全理由的拒绝。

### 开源中的约束解码

开源实现使用三种技术。

1. **基于语法的解码**（`outlines`、`guidance`、`lm-format-enforcer`）：从schema构建确定性有限自动机；在每一步，屏蔽会违反FSM的token的logits。
2. **带JSON解析器的logit屏蔽**：与模型同步运行流式JSON解析器；在每一步，计算有效下一个token集合。
3. **带验证器的推测解码**：廉价草稿模型提出token，验证器强制执行schema。

商业提供者在幕后选择其中一种。2026年的技术水平对于短结构化输出比普通生成更快，对于长输出速度大致相同。

### 三种失败模式

1. **解析错误。** 输出不是有效的JSON。在严格模式下不可能发生。在非严格提供者上仍可能发生。
2. **Schema违规。** 输出解析但违反schema。在严格模式下不可能发生。在严格模式外常见。
3. **拒绝。** 模型拒绝。必须作为类型化结果处理。

### 重试策略

当你不在严格模式下时（Anthropic工具使用、非严格OpenAI、旧版Gemini），恢复模式是：

```
生成 -> 解析 -> 验证 -> 如果失败，注入错误并重试，最多3次
```

一次重试通常足够。三次重试捕获弱模型故障。超过三次是坏schema的迹象：模型无法为某些输入满足它，提示或schema需要修复。

### 小型模型支持

约束解码适用于小型模型。带有语法强化的30亿参数开源模型在结构化任务上优于使用原始提示的700亿参数模型。这是结构化输出对生产重要的主要原因：它将可靠性与模型大小解耦。

## 使用它

`code/main.py`提供了一个stdlib中最小的JSON Schema 2020-12验证器（类型、required、enum、min/max、pattern、items、additionalProperties）。它包装了一个`Invoice`schema并通过验证器运行模拟的LLM输出，演示了解析错误、schema违规和拒绝路径。在生产中，将模拟输出替换为任何提供者的真实响应。

查看内容：

- 验证器返回带有路径和消息的类型化`[ValidationError]`列表。这是你想要在重试提示中展示的形状。
- 拒绝分支不会重试。它记录并返回类型化的拒绝。第14阶段 · 09使用拒绝作为安全信号。
- `additionalProperties: false`检查在对抗测试输入上触发，显示为什么严格模式阻止了幻觉字段。

## 发布它

本课程产生`outputs/skill-structured-output-designer.md`。给定自由文本提取目标（发票、支持工单、简历等），该技能生成与严格模式兼容的JSON Schema 2020-12和镜像它的Pydantic模型，带有类型化拒绝和重试处理存根。

## 练习

1. 运行`code/main.py`。添加第四个测试用例，其`total_usd`为负数。确认验证器用`minimum`约束路径拒绝它。

2. 扩展验证器以支持带鉴别器的`oneOf`。常见情况：`line_item`是产品或服务，由`kind`标记。严格模式在这里有微妙规则；检查OpenAI的结构化输出指南。

3. 将相同的Invoice schema编写为Pydantic BaseModel，并比较`model_json_schema()`输出与你手动编写的schema。识别Pydantic默认设置而手动版本省略的一个字段。

4. 测量拒绝率。构建十个不应可提取的输入（歌词、数学证明、空白邮件），并通过严格模式的真实提供者运行它们。计算拒绝与幻觉输出的比例。这是你拒绝感知重试的基准真相。

5. 从头到尾阅读OpenAI的结构化输出指南。识别它明确禁止而普通JSON Schema允许的一个构造。然后设计一个使用非必要禁止构造的schema，并将其重构为严格兼容的。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| JSON Schema 2020-12 | "schema规范" | 每个现代提供者都支持的IETF草案schema方言 |
| 严格模式 | "保证的schema" | 通过约束解码强制执行schema的OpenAI标志 |
| 约束解码 | "logit屏蔽" | 解码时强制执行，屏蔽无效下一个token |
| 拒绝 | "模型拒绝" | 输入无法符合schema时的类型化结果 |
| 解析错误 | "无效JSON" | 输出未解析为JSON；在严格模式下不可能 |
| Schema违规 | "错误形状" | 已解析但违反类型/required/enum/范围 |
| `additionalProperties: false` | "不允许额外项" | 禁止未知字段；OpenAI严格模式中必需 |
| Pydantic BaseModel | "类型化输出" | 发出和验证JSON Schema的Python类 |
| Zod schema | "TypeScript输出类型" | 用于提供者输出验证的TS运行时schema |
| 语法强制 | "开源约束解码" | 基于FSM的logit屏蔽，如outlines/guidance中 |

## 进一步阅读

- [OpenAI — 结构化输出](https://platform.openai.com/docs/guides/structured-outputs) — 严格模式、拒绝和schema要求
- [OpenAI — 介绍结构化输出](https://openai.com/index/introducing-structured-outputs-in-the-API/) — 2024年8月发布文章，解释解码保证
- [Pydantic AI — 输出](https://ai.pydantic.dev/output/) — 序列化为每个提供者的`output_type`类型绑定
- [JSON Schema — 2020-12发布说明](https://json-schema.org/draft/2020-12/release-notes) — 官方规范
- [Microsoft — Azure OpenAI中的结构化输出](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) — 企业部署说明和严格模式注意事项