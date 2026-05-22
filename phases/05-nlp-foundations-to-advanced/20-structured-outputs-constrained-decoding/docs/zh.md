# 结构化输出（Structured Outputs）与约束解码（Constrained Decoding）

> 让语言模型返回JSON。大多数时候你确实能拿到JSON。但在生产环境中，“大多数”就是问题所在。约束解码通过在采样前修改logits，将“大多数”变成了“始终”。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段5·17（聊天机器人），阶段5·19（子词分词）
**时长：** ~60分钟

## 问题

一个分类器提示语言模型：“返回 {positive, negative, neutral} 中的一个。”模型却返回“The sentiment is positive — this review is overwhelmingly favorable because the customer explicitly states that they ...”。你的解析器崩溃了。你的分类器F1值为0.0。

自由形式的生成不是一种契约，而只是一种建议。生产系统需要契约。

在2026年，存在三个层级：

1. **提示工程（Prompting）。** 礼貌地请求。“只返回JSON对象。”在前沿模型上成功率约80%，在较小模型上更低。
2. **原生结构化输出API。** OpenAI `response_format`、Anthropic工具调用、Gemini JSON模式。在支持的schema上可靠。但供应商锁定。
3. **约束解码（Constrained decoding）。** 在每一步生成时修改logits，使得模型*无法*发出无效标记。通过构造保证100%有效。适用于任何本地模型。

本课旨在为你建立这三种方法的直觉，并告诉你何时该用哪一种。

## 概念

![约束解码在每一步屏蔽无效标记](../assets/constrained-decoding.svg)

**约束解码的工作原理。** 在每一步生成时，语言模型生成一个覆盖整个词汇表（约10万标记）的logit向量。一个*logit处理器*位于模型和采样器之间。它根据当前在目标语法（JSON Schema、正则表达式、上下文无关文法）中所处的位置，计算出哪些标记是有效的，并将所有无效标记的logit设为负无穷。然后对剩余logit进行softmax，概率质量只分布在有效的后续标记上。

2026年的实现方式：

- **Outlines。** 将JSON Schema或正则表达式编译成有限状态机（Finite-State Machine, FSM）。每个标记都有一个O(1)的“下一个有效标记”查找。基于FSM，因此递归schema需要展平。
- **XGrammar / llguidance。** 上下文无关文法引擎。处理递归JSON Schema。解码开销接近零。OpenAI在其2025年的结构化输出实现中承认使用了llguidance。
- **vLLM guided decoding。** 内置的`guided_json`、`guided_regex`、`guided_choice`、`guided_grammar`，后端支持Outlines、XGrammar或lm-format-enforcer。
- **Instructor。** 基于Pydantic的封装，适用于任何LLM。在验证失败时重试。跨供应商，但不修改logits——它依赖重试和结构化输出感知的提示。

### 反直觉的结果

约束解码通常比无约束生成*更快*。两个原因：第一，它缩小了下一个标记的搜索空间。第二，巧妙的实现对强制标记（如脚手架`{"name": "`——每个字节都已确定）完全跳过标记生成。

### 代价高昂的陷阱

字段顺序很重要。把`answer`放在`reasoning`之前，模型会在思考之前就做出回答。JSON是有效的，但答案错了。没有任何验证能捕捉到这一点。

```json
// 不好
{"answer": "yes", "reasoning": "because ..."}

// 好
{"reasoning": "... therefore ...", "answer": "yes"}
```

Schema字段顺序是逻辑问题，不是格式问题。

## 动手实践

### 第1步：从零构建正则约束生成

请参阅 `code/main.py` 中的独立FSM实现。30行的核心思想如下：

```python
def mask_logits(logits, valid_token_ids):
    mask = [float("-inf")] * len(logits)
    for tid in valid_token_ids:
        mask[tid] = logits[tid]
    return mask


def generate_constrained(model, tokenizer, prompt, fsm):
    ids = tokenizer.encode(prompt)
    state = fsm.initial_state
    while not fsm.is_accept(state):
        logits = model.next_token_logits(ids)
        valid = fsm.valid_tokens(state, tokenizer)
        logits = mask_logits(logits, valid)
        tok = sample(logits)
        ids.append(tok)
        state = fsm.transition(state, tok)
    return tokenizer.decode(ids)
```

FSM跟踪到目前为止我们已经满足的语法部分。`valid_tokens(state, tokenizer)` 计算哪些词汇标记可以在不离开接受路径的情况下推进FSM。

### 第2步：使用Outlines处理JSON Schema

```python
from pydantic import BaseModel
from typing import Literal
import outlines


class Review(BaseModel):
    sentiment: Literal["positive", "negative", "neutral"]
    confidence: float
    evidence_span: str


model = outlines.models.transformers("meta-llama/Llama-3.2-3B-Instruct")
generator = outlines.generate.json(model, Review)

result = generator("Classify: 'The wait staff was attentive and the food arrived hot.'")
print(result)
# Review(sentiment='positive', confidence=0.93, evidence_span='attentive ... hot')
```

零验证错误。永不出错。FSM使无效输出不可到达。

### 第3步：使用Instructor实现供应商无关的Pydantic

```python
import instructor
from anthropic import Anthropic
from pydantic import BaseModel, Field


class Invoice(BaseModel):
    vendor: str
    total_usd: float = Field(ge=0)
    line_items: list[str]


client = instructor.from_anthropic(Anthropic())
invoice = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    response_model=Invoice,
    messages=[{"role": "user", "content": "Extract from: 'Acme Corp $420. Widget, Gizmo.'"}],
)
```

机制不同。Instructor不触及logits。它将schema格式化为提示，解析输出，并在验证失败时重试（默认3次）。适用于任何供应商。重试会增加延迟和成本。跨供应商可移植性是它的卖点。

### 第4步：原生供应商API

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="gpt-5",
    input=[{"role": "user", "content": "Classify: 'The food was cold.'"}],
    text={"format": {"type": "json_schema", "name": "sentiment",
          "schema": {"type": "object", "required": ["sentiment"],
                     "properties": {"sentiment": {"type": "string",
                                                  "enum": ["positive", "negative", "neutral"]}}}}},
)
print(response.output_parsed)
```

服务端约束解码。对于支持的schema，可靠性可与Outlines媲美。无需管理本地模型。但锁定供应商。

## 陷阱

- **递归Schema（Recursive schemas）。** Outlines将递归展平到固定深度。树形结构输出（嵌套评论、抽象语法树（AST））需要使用XGrammar或llguidance（基于上下文无关文法（CFG））。
- **巨大的枚举（Huge enums）。** 10000个选项的枚举编译缓慢或超时。改用检索器：先预测top-k候选，再约束到这些候选。
- **语法过于严格。** 强制`date: "YYYY-MM-DD"`正则表达式，当日期缺失时模型无法输出`"unknown"`。模型会通过编造一个日期来补偿。允许`null`或一个占位符。
- **过早承诺（Premature commitment）。** 参见上面的字段顺序陷阱。始终将推理放在前面。
- **不含schema的供应商JSON模式（Vendor JSON mode without schema）。** 纯JSON模式只保证JSON语法正确，不保证*对你的用例*有效。始终提供完整的schema。

## 使用

2026年的技术栈：

| 情境 | 选择 |
|-----------|------|
| OpenAI/Anthropic/Google模型，简单schema | 原生供应商结构化输出 |
| 任意供应商，Pydantic工作流，可容忍重试 | Instructor |
| 本地模型，需要100%有效性，扁平schema | Outlines（FSM） |
| 本地模型，递归schema | XGrammar或llguidance |
| 自托管推理服务器 | vLLM guided decoding |
| 可接受重试的批量处理 | Instructor + 最便宜的模型 |

## 输出

保存为 `outputs/skill-structured-output-picker.md`：

```markdown
---
name: structured-output-picker
description: 选择结构化输出方法、schema设计和验证方案。
version: 1.0.0
phase: 5
lesson: 20
tags: [nlp, llm, structured-output]
---

给定一个用例（供应商、延迟预算、schema复杂度、容错性），输出：

1. 机制。原生供应商结构化输出、Instructor重试、Outlines FSM或XGrammar CFG。一句话解释原因。
2. Schema设计。字段顺序（推理在前，答案在后）、`"unknown"`时的可空字段、枚举vs正则表达式、必填字段。
3. 失败策略。最大重试次数、回退模型、优雅的`null`处理、分布外拒绝。
4. 验证方案。Schema合规率（目标100%）、语义有效性（LLM评判）、字段覆盖率、延迟p50/p99。

拒绝任何将`answer`或`decision`放在推理字段之前的设计。拒绝使用不带schema的裸JSON模式。对仅支持FSM的库中出现的递归schema进行标记。
```

## 练习

1. **简单。** 对一个小型开源模型（例如Llama-3.2-3B）使用无约束解码，提示其返回`Review(sentiment, confidence, evidence_span)`。在100条评论上测量可成功解析为有效JSON的比例。
2. **中等。** 使用Outlines JSON模式处理同一个语料库。比较合规率、延迟和语义准确度。
3. **困难。** 从零实现一个针对电话号码（`\d{3}-\d{3}-\d{4}`）的正则约束解码器。验证在1000个样本上无效输出为零。

## 关键术语

| 术语 | 人们常说的 | 它实际的含义 |
|------|-----------------|-----------------------|
| 约束解码（Constrained decoding） | 强制输出有效 | 在每一步生成时屏蔽无效标记的logit。 |
| Logit处理器（Logit processor） | 进行约束的东西 | 函数：`(logits, state) -> masked_logits`。 |
| FSM | 有限状态机 | 编译后的语法表示；O(1)的下一个有效标记查找。 |
| CFG | 上下文无关文法 | 处理递归的语法；比FSM慢但更具表现力。 |
| Schema字段顺序（Schema field order） | 重要吗？ | 是的——第一个字段会提交决定；始终将推理放在答案之前。 |
| 引导解码（Guided decoding） | vLLM的叫法 | 相同的概念，集成到推理服务器中。 |
| JSON模式（JSON mode） | OpenAI的早期版本 | 保证JSON语法正确；但并不保证与schema匹配。 |

## 延伸阅读

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) —— Outlines论文。
- [XGrammar 论文 (2024)](https://arxiv.org/abs/2411.15100) —— 基于CFG的快速约束解码。
- [vLLM — 结构化输出](https://docs.vllm.ai/en/latest/features/structured_outputs.html) —— 推理服务器集成。
- [OpenAI — 结构化输出指南](https://platform.openai.com/docs/guides/structured-outputs) —— API参考及陷阱。
- [Instructor 库](https://python.useinstructor.com/) —— 跨供应商的Pydantic + 重试。
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) —— 对6个约束解码框架的基准测试。