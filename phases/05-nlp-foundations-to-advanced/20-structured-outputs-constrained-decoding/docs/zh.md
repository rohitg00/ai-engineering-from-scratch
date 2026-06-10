# 20 · 结构化输出与受约束解码

> 让大语言模型（LLM）返回 JSON，它大多数时候确实会返回 JSON。但在生产环境中，「大多数时候」恰恰是问题所在。「受约束解码（constrained decoding）」通过在采样前直接编辑 logits，把「大多数时候」变成「永远」。

**类型：** 实战
**语言：** Python
**前置：** 阶段 5 · 17（聊天机器人），阶段 5 · 19（子词分词）
**时长：** 约 60 分钟

## 问题所在

一个分类器向 LLM 发出提示：「请返回 {positive, negative, neutral} 中的一个。」模型却返回了「这条情感是正面的——因为顾客明确表示他们……，所以这条评论压倒性地偏向好评」。你的解析器崩溃了，分类器的 F1 分数变成了 0.0。

自由形式的生成不是一份合同，它只是一个建议。而生产系统需要的是一份合同。

到了 2026 年，存在三个层次的方案。

1. **提示工程（Prompting）。** 客气地请求。「请只返回 JSON 对象。」在前沿模型上有效率约 80%，在较小的模型上则更低。
2. **原生结构化输出 API。** OpenAI 的 `response_format`、Anthropic 的工具调用（tool use）、Gemini 的 JSON 模式。在受支持的 schema 上可靠，但被供应商锁定。
3. **受约束解码。** 在每一个生成步骤修改 logits，使模型*无法*产出非法 token。从构造上保证 100% 合法。可用于任何本地模型。

本课为这三种方案建立直觉，并指明何时该选用哪一种。

## 核心概念

〔图：受约束解码在每一步屏蔽非法 token〕

**受约束解码如何工作。** 在每个生成步骤，LLM 会在整个词表（约 10 万个 token）上产生一个 logit 向量。一个「logit 处理器（logit processor）」位于模型与采样器之间。它根据当前在目标语法中的位置——可以是 JSON Schema、正则表达式或上下文无关文法——计算出哪些 token 是合法的，并将所有非法 token 的 logit 设为负无穷。对剩余 logits 求 softmax，概率质量便只会落在合法的续写上。

2026 年的实现方案：

- **Outlines。** 把 JSON Schema 或正则表达式编译成「有限状态机（finite-state machine，FSM）」。每个 token 都能进行 O(1) 的「下一个合法 token」查询。由于基于 FSM，递归 schema 需要先扁平化处理。
- **XGrammar / llguidance。** 上下文无关文法（context-free grammar，CFG）引擎。可处理递归的 JSON Schema。解码开销接近于零。OpenAI 在其 2025 年的结构化输出实现中曾致谢 llguidance。
- **vLLM 引导式解码。** 通过 Outlines、XGrammar 或 lm-format-enforcer 后端内置了 `guided_json`、`guided_regex`、`guided_choice`、`guided_grammar`。
- **Instructor。** 基于 Pydantic、可包装任意 LLM 的封装库。在校验失败时重试。跨供应商，但它不修改 logits——而是依赖重试 + 感知结构化输出的提示词。

### 反直觉的结论

受约束解码往往*比*无约束生成更*快*。原因有二。其一，它缩小了下一个 token 的搜索空间。其二，巧妙的实现会对强制 token 完全跳过 token 生成（例如 `{"name": "` 这类脚手架——每个字节都是确定的）。

### 会让你付出代价的陷阱

字段顺序很重要。如果把 `answer` 放在 `reasoning` 之前，模型就会在思考之前先确定答案。JSON 是合法的，但答案是错的，而且没有任何校验能捕获到这一点。

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

Schema 的字段顺序属于逻辑，而非格式。

## 动手构建

### 第 1 步：从零实现正则约束生成

参见 `code/main.py` 中独立的 FSM 实现。30 行内的核心思路如下：

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

FSM 跟踪我们到目前为止已经满足了语法的哪些部分。`valid_tokens(state, tokenizer)` 计算出哪些词表 token 能够推进 FSM 而不脱离接受路径。

### 第 2 步：用 Outlines 处理 JSON Schema

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

零校验错误。永远不会出错。FSM 让非法输出根本无从产生。

### 第 3 步：用 Instructor 实现供应商无关的 Pydantic

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

机制不同。Instructor 不触碰 logits。它把 schema 格式化进提示词，解析输出，并在校验失败时重试（默认 3 次）。可与任何供应商配合使用。重试会增加延迟和成本。其卖点在于跨供应商的可移植性。

### 第 4 步：原生供应商 API

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

服务端受约束解码。在受支持的 schema 上，其可靠性与 Outlines 相当。无需管理本地模型。但会把你锁定到该供应商。

## 陷阱

- **递归 schema。** Outlines 会把递归扁平化到固定深度。树状结构的输出（嵌套评论、抽象语法树）需要使用 XGrammar 或 llguidance（基于 CFG）。
- **超大枚举。** 一个有 10,000 个选项的枚举编译缓慢，甚至会超时。改用检索器：先预测前 k 个候选项，再约束到这些候选项上。
- **语法过于严格。** 强制要求 `date: "YYYY-MM-DD"` 正则后，模型在日期缺失时就无法输出 `"unknown"`，于是它会通过编造一个日期来弥补。应允许 `null` 或某个哨兵值（sentinel）。
- **过早确定。** 参见上文的字段顺序陷阱。永远把推理（reasoning）放在最前面。
- **不带 schema 的供应商 JSON 模式。** 纯 JSON 模式只能保证 JSON 合法，并不能保证它*符合你的用例*。务必提供完整的 schema。

## 实际运用

2026 年的技术栈：

| 场景 | 选择 |
|-----------|------|
| OpenAI/Anthropic/Google 模型，简单 schema | 原生供应商结构化输出 |
| 任意供应商，Pydantic 工作流，可容忍重试 | Instructor |
| 本地模型，需要 100% 合法性，扁平 schema | Outlines（FSM） |
| 本地模型，递归 schema | XGrammar 或 llguidance |
| 自托管推理服务器 | vLLM 引导式解码 |
| 批处理且可接受重试 | Instructor + 最便宜的模型 |

## 交付成果

保存为 `outputs/skill-structured-output-picker.md`：

```markdown
---
name: structured-output-picker
description: Choose a structured output approach, schema design, and validation plan.
version: 1.0.0
phase: 5
lesson: 20
tags: [nlp, llm, structured-output]
---

Given a use case (provider, latency budget, schema complexity, failure tolerance), output:

1. Mechanism. Native vendor structured output, Instructor retries, Outlines FSM, or XGrammar CFG. One-sentence reason.
2. Schema design. Field order (reasoning first, answer last), nullable fields for "unknown", enum vs regex, required fields.
3. Failure strategy. Max retries, fallback model, graceful `null` handling, out-of-distribution refusal.
4. Validation plan. Schema compliance rate (target 100%), semantic validity (LLM-judge), field-coverage rate, latency p50/p99.

Refuse any design that puts `answer` or `decision` before reasoning fields. Refuse to use bare JSON mode without a schema. Flag recursive schemas behind an FSM-only library.
```

## 练习

1. **简单。** 在不使用受约束解码的情况下，用一个小型开源权重模型（例如 Llama-3.2-3B）针对 `Review(sentiment, confidence, evidence_span)` 进行提示。在 100 条评论上测量能解析为合法 JSON 的比例。
2. **中等。** 在相同语料上使用 Outlines JSON 模式。对比合法率、延迟和语义准确度。
3. **困难。** 从零实现一个针对电话号码（`\d{3}-\d{3}-\d{4}`）的正则约束解码器。验证在 1000 个样本上产生 0 个非法输出。

## 关键术语

| 术语 | 人们怎么说 | 它实际指的是什么 |
|------|-----------------|-----------------------|
| 受约束解码 | 强制产生合法输出 | 在每个生成步骤屏蔽非法 token 的 logit。 |
| logit 处理器 | 进行约束的那个东西 | 一个函数：`(logits, state) -> masked_logits`。 |
| FSM | 有限状态机 | 编译后的语法表示；可进行 O(1) 的「下一个合法 token」查询。 |
| CFG | 上下文无关文法 | 能处理递归的语法；比 FSM 更慢但更具表达力。 |
| Schema 字段顺序 | 它重要吗？ | 重要——第一个字段会先确定下来；永远把推理放在答案之前。 |
| 引导式解码 | vLLM 对它的称呼 | 同一个概念，集成进了推理服务器。 |
| JSON 模式 | OpenAI 的早期版本 | 保证 JSON 语法正确；但不保证符合 schema。 |

## 延伸阅读

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) —— Outlines 论文。
- [XGrammar 论文 (2024)](https://arxiv.org/abs/2411.15100) —— 快速的基于 CFG 的受约束解码。
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) —— 推理服务器集成。
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) —— API 参考与注意事项。
- [Instructor library](https://python.useinstructor.com/) —— Pydantic + 跨供应商重试。
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) —— 对 6 种受约束解码框架的基准测试。
