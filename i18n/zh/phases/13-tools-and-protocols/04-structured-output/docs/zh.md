# 结构化输出  JSON 方案,Pydantic,Zod,限制式解码

> 结构化输出通过限制解码缩小缩小了这一差距:模型字面上被阻止发出违反方案的代币.OpenAI的严格模式,Anthropic的方案类型工具使用,双胞胎的 `responseSchema`星的AI`output_type`,和佐德的`.parse`这一课构建了方案验证器,严格模式的合同学习者将用于每个生产提取管道.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, JSON Schema 2020-12 subset)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## 学习目标

- 写一个JSON Schema 2020-12用于抽取目标,使用正确的限制 (enum,min/max,要求,模式).
- 解释为什么严格模式和限制式解码提供了不同的保证与"后代有效性".
- 区分三个故障模式:解析错误,方案违规,模型拒绝.
- 运输一个采集管道,采用打字维修和打字拒绝处理.

## 问题

读取购买订单的电子邮件的代理人需要将免费文本转化为`{customer, line_items, total_usd}`接下来有三种方法.

**Approach one: prompt for JSON.**"用客户端,线_项目,总_usd的字段在JSON中回答". 在边界模型上,它在85-95%的时间内工作.在六种方式上失败:缺少支柱,后行逗号,错误类型,幻觉字段,在代币限制中缩小,泄露的散文如"这里是你的JSON:".

**Approach two: validate after generation.**根据该规则,每次试验都需要一个额外的转折,而每次试验都需要一个额外的转折.

**Approach three: constrained decoding.**提供商在解码时执行该方案.不有效的代币被隐藏在样本分布中.输出保证分析和验证.失败崩到一个模式:拒绝 (模型决定输入不符合该方案).

每一个2026年边境提供商都会提供某种方式.

- **OpenAI.** `response_format: {type: "json_schema", strict: true}`另外`refusal`如果模型下降,
- **Anthropic.**实施方案`tool_use`输入`stop_reason: "refusal"`没有什么问题,但`end_turn`没有工具的呼叫是信号.
- **Gemini.** `responseSchema`在要求水平上;在2026年,双子公司将为选定的类型发出代币级语法限制.
- **Pydantic AI.** `output_type=InvoiceModel`发出结构化`RunResult`标签:`InvoiceModel`现在,我们要去.
- **Zod (TypeScript).**运行时间解析器,与Zod方案进行供应商输出验证;与OpenAI的配对`beta.chat.completions.parse`现在,我们要去.

共同的线程:一次宣布方案,

## 概念

### 语法语 2020-12

每个提供商都接受JSON Schema 2020-12.

- `type`其中一个`object`现在`array`现在`string`现在`number`现在`integer`现在`boolean`现在`null`现在,我们要去.
- `properties`: 字段名称地图到子方案.
- `required`:必须出现的字段名称列表.
- `enum`: 允许的值的闭合集合.
- `minimum`现在,`maximum`其他国家`minLength`现在,`maxLength`现在,`pattern`现在,我们要去看看.
- `items`:对每个数组元素的子方案.
- `additionalProperties`其他`false`禁止额外的字段 (默认取决于模式).

开放AI严格模式增加了三个要求:每个财产必须在`required`现在`additionalProperties: false`没有一个未解决的问题.`$ref`如果你打破这些,API会在请求时返回400个.

### 丹,Python绑定

通过  数据类型模型生成JSON Schema`model_json_schema()`皮达尼斯人工智能将这封面包成一个字幕:

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

通过"机器人框架"将该方案转化为"OpenAI严格模式",`input_schema`两个双胞胎`responseSchema`模型的输出是打字的.`Invoice`验证错误增加`ValidationError`输入错误路径.

### 编程:

 (`z.object({customer: z.string(), ...})`开放AI的 Node SDK 揭示了`zodResponseFormat(Invoice)`转换为API的JSON方案有效载荷.

### 拒绝

严格模式不能迫使模型回答. 如果输入无法符合方案 ("电子邮件是一个诗,而不是一个账单"),模型会发出一个`refusal`您的代码必须把此处理为一流的结果,而不是失败.拒绝也作为安全信号有用:一个要求从受保护内容的电子邮件中提取信用卡号码的模型将附上安全理由返回拒绝.

### 开放式限制解码

开放权重的实施使用三个技术.

1. **Grammar-based decoding**(`outlines`现在`guidance`现在`lm-format-enforcer`):从该方案中构建一个定制性有限的自动机;在每一步上,掩盖违反FSM的代币的logits.
2. **Logit masking with a JSON parser**运行一个流媒体JSON解析器,按模型锁步;在每一步计算有效-下一个代码.
3. **Speculative decoding with a verifier**廉价的草案模型提出代币,验证器执行方案.

商业供应商在幕后选择其中一个. 2026 年的最新技术速度比普通的短结构产品更快,长产品的速度也大致相同.

### 失败的三个模式

1. **Parse error.**输出是不有效的JSON.不能发生在严格模式下.仍然可以发生在非严格的提供商.
2. **Schema violation.**输出解析,但违反了方案.不能在严格模式下发生.
3. **Refusal.**模型下降,必须被处理为一个输入结果.

### 复试策略

当你在严格模式之外 (人类工具使用,非严格的OpenAI,旧的双胞胎),恢复模式是:

```
generate -> parse -> validate -> if fail, inject error and retry, max 3x
```

一次重试通常足够.三次重试会发现模型的弱点.三次重试是不良方案的迹象:模型无法满足某些输入,提示或方案需要修复.

### 支持小型模型

限制式解码在小型模型上运行.一个具有语法强制性的3B参数开放模型比70B参数模型更有效,并且在结构化任务上具有原始提示性.这是结构化输出的主要原因:它将可靠性与模型大小分离.

```figure
constrained-decoding
```

## 用它

`code/main.py`通过使用JSON Schema 2020-12验证器,它将一个最小的JSON Schema 2020-12验证器运送到 stdlib (类型,要求, enum, min/max,模式,项目,额外属性).`Invoice`通过验证器运行一个假的LLM输出,显示解析错误,方案违规和拒绝路径.

什么要看:

- 验证器返回输入的 `[ValidationError]`列表包含路径和消息. 这就是你想要在重试提示时出现的形状.
- 拒绝分支不会再尝试.它记录并返回输入的拒绝.14 · 09阶段使用拒绝作为安全信号.
- 其他`additionalProperties: false`检查对抗性测试输入的火灾,说明严格模式为什么会关闭幻觉场所的门.

## 运送它

这一课产生了`outputs/skill-structured-output-designer.md`鉴于自由文本提取目标 (发票,支持门票,简历等),该技能产生了一个严格模式兼容的JSON Schema 2020-12和一个反射的Pydantic模型,输入拒绝和重新尝试处理.

## 运动

1. 跑步`code/main.py`添加一个第四个试验案例`total_usd`确认验证器拒绝了它`minimum`限制路径.

2. 扩展验证器到支持`oneOf`常见情况:`line_item`是一个产品或服务,标记为 `kind`严格模式有细节的规则;请查看OpenAI的结构化输出指南.

3. 写出与Pydantic BaseModel相同的发票方案,并比较`model_json_schema()`默认的识别一个字段Pydantic设置,手动滚动版本遗漏.

4. 测量拒绝率. 构建不应该提取的十个输入 (歌词,数学证明,空白电子邮件) 并通过严格模式的真实提供商运行它们. 计算拒绝与幻觉输出. 这是拒绝意识的重试的基本真理.

5. 阅读OpenAI的结构化输出指南. 识别它明确禁止的构建,在简单的JSON方案允许的严格模式下.然后设计一个不必要的设计方案,并重新构建它以严格兼容.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| JSON Schema 2020-12 | "The schema spec" | IETF-draft schema dialect every modern provider speaks |
| Strict mode | "Guaranteed schema" | OpenAI flag that enforces schema via constrained decoding |
| Constrained decoding | "Logit masking" | Decode-time enforcement that masks invalid next-tokens |
| Refusal | "Model declines" | Typed outcome when input cannot fit the schema |
| Parse error | "Invalid JSON" | Output did not parse as JSON; impossible under strict |
| Schema violation | "Wrong shape" | Parsed but violated types / required / enum / range |
| `additionalProperties: false` | "No extras allowed" | Forbids unknown fields; required in OpenAI strict |
| Pydantic BaseModel | "Typed output" | Python class that emits and validates JSON Schema |
| Zod schema | "TypeScript output type" | TS runtime schema for provider output validation |
| Grammar enforcement | "Open-weights constrained decode" | FSM-based logit masking, as in outlines / guidance |

## 进一步阅读

- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs)严格的模式,拒绝和方案要求
- [OpenAI — Introducing structured outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) 2024 年 8 月启动后,解释了解码保证
- [Pydantic AI — Output](https://ai.pydantic.dev/output/)输出_类型的键字,将其连续到每个提供商
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes)法典规范
- [Microsoft — Structured outputs in Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs)企业部署说明和严格模式警告
