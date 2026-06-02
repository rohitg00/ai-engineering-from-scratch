# 结构化输出与受限解码（Structured Outputs & Constrained Decoding）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 让 LLM 返回 JSON。它大多数时候会返回 JSON。但在生产环境里，「大多数」就是问题所在。受限解码（constrained decoding）通过在采样前编辑 logits，把「大多数」变成「永远」。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 17（聊天机器人）, Phase 5 · 19（子词 tokenization）
**Time:** ~60 分钟

## 问题（The Problem）

一个分类器给 LLM 提示：「从 {positive, negative, neutral} 里返回一个。」模型却返回「The sentiment is positive — this review is overwhelmingly favorable because the customer explicitly states that they ...」。你的解析器崩了。分类器的 F1 是 0.0。

自由形式的生成不是契约，只是一个建议。生产系统需要的是契约。

2026 年存在三层方案。

1. **Prompting（提示工程）。** 礼貌地请求。「只返回 JSON 对象。」在前沿模型上能成功 ~80%，更小的模型上更低。
2. **原生结构化输出 API。** OpenAI `response_format`、Anthropic tool use、Gemini JSON 模式。在受支持的 schema 上可靠，但绑定厂商。
3. **Constrained decoding（受限解码）。** 在每一步生成时修改 logits，让模型*无法*输出非法 token。结构上 100% 合法。任何本地模型都能用。

这一课为这三种方案建立直觉，并指明何时选哪一种。

## 概念（The Concept）

![Constrained decoding masking invalid tokens at each step](../assets/constrained-decoding.svg)

**受限解码是怎么工作的。** 在每一步生成时，LLM 在整个词表（约 10 万个 token）上产生一个 logit 向量。一个 *logit processor*（logit 处理器）位于模型和采样器之间。它根据当前位置在目标语法（JSON Schema、正则、上下文无关文法）中的状态，计算哪些 token 是合法的，并把所有非法 token 的 logits 设为负无穷。剩余 logits 上的 softmax 只会把概率质量分配给合法的延续。

2026 年的实现：

- **Outlines。** 把 JSON Schema 或正则编译成有限状态机（FSM）。每个 token 都有 O(1) 的合法下一 token 查询。基于 FSM，所以递归 schema 需要展平。
- **XGrammar / llguidance。** 上下文无关文法（CFG）引擎。能处理递归 JSON Schema。解码开销接近零。OpenAI 在 2025 年的结构化输出实现中致谢了 llguidance。
- **vLLM guided decoding。** 内置 `guided_json`、`guided_regex`、`guided_choice`、`guided_grammar`，后端可选 Outlines、XGrammar、lm-format-enforcer。
- **Instructor。** 基于 Pydantic 的跨 LLM 包装层。验证失败时自动重试。跨厂商，但不修改 logits——它依赖重试 + 结构化输出感知的 prompt。

### 反直觉的结果

受限解码常常比无约束生成*更快*。两个原因。第一，它缩小了下一 token 的搜索空间。第二，聪明的实现会对强制 token（像 `{"name": "` 这种每个字节都已确定的脚手架）完全跳过 token 生成。

### 那个会让你付出代价的坑

字段顺序很重要。把 `answer` 放在 `reasoning` 之前，模型就会先承诺一个答案，再去思考。JSON 是合法的。答案是错的。没有任何校验能抓到这个问题。

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

Schema 字段顺序是逻辑，不是格式。

## 动手实现（Build It）

### Step 1: 从零实现正则受限生成

完整的独立 FSM 实现见 `code/main.py`。30 行的核心思想：

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

FSM 跟踪我们到目前为止已经满足了语法的哪些部分。`valid_tokens(state, tokenizer)` 计算哪些词表 token 能让 FSM 在不离开接受路径的前提下向前推进。

### Step 2: 用 Outlines 处理 JSON Schema

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

零校验错误。永远。FSM 让非法输出根本不可达。

### Step 3: 用 Instructor 做厂商无关的 Pydantic

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

机制不同。Instructor 不碰 logits。它把 schema 写进 prompt，解析输出，校验失败就重试（默认 3 次）。任何厂商都能用。重试会带来额外的延迟和成本。卖点是跨厂商可移植。

### Step 4: 厂商原生 API

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

服务端的受限解码。在受支持的 schema 上可靠性与 Outlines 相当。无需管理本地模型。但被绑定到该厂商。

## 常见坑（Pitfalls）

- **递归 schema。** Outlines 会把递归展平到固定深度。树形结构输出（嵌套评论、AST）需要 XGrammar 或 llguidance（基于 CFG）。
- **巨大的 enum。** 10000 个选项的 enum 编译会很慢甚至超时。改用检索器：先预测 top-k 候选，再受限到这些候选。
- **语法太严。** 强制 `date: "YYYY-MM-DD"` 正则后，模型在日期缺失时无法输出 `"unknown"`。模型会通过编造日期来补偿。要允许 `null` 或一个哨兵值。
- **过早承诺。** 见上面字段顺序的坑。永远把 reasoning 放在前面。
- **没有 schema 的厂商 JSON 模式。** 纯 JSON 模式只保证合法 JSON，不保证*在你的使用场景下*合法。一定要提供完整 schema。

## 用起来（Use It）

2026 年的技术栈：

| 场景 | 选择 |
|-----------|------|
| OpenAI/Anthropic/Google 模型，简单 schema | 厂商原生结构化输出 |
| 任意厂商，Pydantic 工作流，能容忍重试 | Instructor |
| 本地模型，需要 100% 合法，扁平 schema | Outlines（FSM） |
| 本地模型，递归 schema | XGrammar 或 llguidance |
| 自托管推理服务 | vLLM guided decoding |
| 批处理且能接受重试 | Instructor + 最便宜的模型 |

## 上线部署（Ship It）

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

## 练习（Exercises）

1. **Easy.** 用一个小的开源模型（例如 Llama-3.2-3B），不开受限解码，对 `Review(sentiment, confidence, evidence_span)` 进行提示。在 100 条评论上测量能解析为合法 JSON 的比例。
2. **Medium.** 同一份语料，改用 Outlines JSON 模式。比较合规率、延迟和语义准确性。
3. **Hard.** 从零实现一个针对电话号码（`\d{3}-\d{3}-\d{4}`）的正则受限解码器。在 1000 条样本上验证 0 条非法输出。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 它实际是什么 |
|------|-----------------|-----------------------|
| Constrained decoding | 强制合法输出 | 在每一步生成时屏蔽非法 token 的 logits。 |
| Logit processor | 那个负责约束的东西 | 函数：`(logits, state) -> masked_logits`。 |
| FSM | 有限状态机 | 编译后的语法表示；O(1) 的合法下一 token 查询。 |
| CFG | 上下文无关文法 | 能处理递归的语法；比 FSM 慢但更具表达力。 |
| Schema 字段顺序 | 重要吗？ | 重要——第一个字段就承诺；永远把 reasoning 放在 answer 之前。 |
| Guided decoding | vLLM 对它的叫法 | 同一个概念，集成进了推理服务。 |
| JSON mode | OpenAI 的早期版本 | 保证 JSON 语法；*不*保证匹配 schema。 |

## 延伸阅读（Further Reading）

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) —— Outlines 论文。
- [XGrammar paper (2024)](https://arxiv.org/abs/2411.15100) —— 基于 CFG 的快速受限解码。
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) —— 推理服务的集成。
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) —— API 参考与坑点。
- [Instructor library](https://python.useinstructor.com/) —— 跨厂商的 Pydantic + 重试。
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) —— 6 个受限解码框架的基准评测。
