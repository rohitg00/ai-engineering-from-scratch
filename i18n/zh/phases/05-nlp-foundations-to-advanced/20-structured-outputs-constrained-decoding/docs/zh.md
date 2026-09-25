# 结构化输出与受限解码

> 让 LLM 返回 JSON。大多数时候能拿到 JSON。在生产环境中，"大多数"就是问题所在。受限解码通过在采样前修改 logits,把"大多数"变成"总是"。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 17(Chatbots)、Phase 5 · 19(Subword Tokenization)
**Time:** 约 60 分钟

## 问题

一个分类器提示 LLM:"返回 {positive, negative, neutral} 之一。"模型返回"情感是正面的——这条评论之所以明显是好评，因为客户明确表示……"。你的解析器崩溃了。分类器的 F1 变成 0.0。

自由格式生成不是契约，只是建议。生产系统需要契约。

2026 年有三层方案。

1. **提示工程。** 好好请求。"只返回 JSON 对象。"在前沿模型上约 80% 有效，小模型上更低。
2. **原生结构化输出 API。** OpenAI `response_format`、Anthropic tool use、Gemini JSON mode。在受支持的 schema 上很可靠。但被厂商锁定。
3. **受限解码。** 在每个生成步骤修改 logits,使模型*无法*输出无效 token。构造上即 100% 有效。适用于任何本地模型。

本课帮助你建立对这三者的直觉，并说明何时该用哪一种。

## 概念

![Constrained decoding masking invalid tokens at each step](../assets/constrained-decoding.svg)

**受限解码的原理。** 在每个生成步骤，LLM 会在整个词表(约 10 万个 token)上产生一个 logit 向量。一个 *logit processor* 位于模型和采样器之间。它根据当前在目标语法——JSON Schema、正则表达式、上下文无关文法——中的位置计算哪些 token 是有效的，并把所有无效 token 的 logits 设为负无穷。对剩余 logits 做 softmax 后，概率质量只会落在有效的续写上。

2026 年的实现：

- **Outlines。** 将 JSON Schema 或正则表达式编译为有限状态机。每个 token 可获得 O(1) 的有效下一 token 查询。基于 FSM,因此递归 schema 需要展平。
- **XGrammar / llguidance。** 上下文无关文法引擎。能处理递归 JSON Schema。解码开销近乎为零。OpenAI 在其 2025 年的结构化输出实现中致谢了 llguidance。
- **vLLM guided decoding。** 内置 `guided_json`、`guided_regex`、`guided_choice`、`guided_grammar`,通过 Outlines、XGrammar 或 lm-format-enforcer 后端实现。
- **Instructor。** 基于任意 LLM 的 Pydantic 封装。验证失败时重试。跨提供商，但不修改 logits——它依赖重试 + 结构化输出感知的提示。

### 反直觉的结果

受限解码往往比无约束生成*更快*。两个原因。第一，它缩小了下一 token 的搜索空间。第二，巧妙的实现对被强制 token 完全跳过生成过程(像 `{"name": "` 这样的脚手架——每个字节都是确定的)。

### 让你付出代价的陷阱

字段顺序很重要。把 `answer` 放在 `reasoning` 之前，模型会在思考之前就锁定答案。JSON 是合法的，但答案是错的。没有任何验证能发现这一点。

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

Schema 字段顺序是逻辑，不是格式问题。

```figure
constrained-decoder
```

## 动手构建

### 步骤 1:从零实现正则受限生成

独立 FSM 实现见 `code/main.py`。核心思路只需 30 行：

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

FSM 追踪我们目前已满足语法的哪些部分。`valid_tokens(state, tokenizer)` 计算哪些词表 token 能推进 FSM 而不会离开可接受路径。

### 步骤 2:用 Outlines 处理 JSON Schema

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

零验证错误。永远不会出错。FSM 使无效输出不可达。

### 步骤 3:用 Instructor 实现与提供商无关的 Pydantic

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

机制不同。Instructor 不触碰 logits。它把 schema 格式化进提示，解析输出，并在验证失败时重试(默认 3 次)。可与任何提供商配合。重试会增加延迟和成本。跨提供商可移植性才是它的卖点。

### 步骤 4:原生厂商 API

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

服务端受限解码。对受支持的 schema 而言，可靠性与 Outlines 相当。无需管理本地模型。但会把你锁定在厂商生态中。

## 陷阱

- **递归 schema。** Outlines 将递归展平到固定深度。树状输出(嵌套评论、AST)需要 XGrammar 或 llguidance(基于 CFG)。
- **巨大的枚举。** 一万个选项的枚举编译缓慢或超时。改用检索器：先预测 top-k 候选，再在这些候选内进行约束。
- **语法过严。** 强制 `date: "YYYY-MM-DD"` 正则，模型就无法对缺失日期输出 `"unknown"`。模型会通过编造日期来补偿。应允许 `null` 或哨兵值。
- **过早锁定。** 见上面的字段顺序陷阱。务必把推理放在最前面。
- **没有 schema 的厂商 JSON mode。** 纯 JSON mode 只保证 JSON 合法，不保证*对你的用例*合法。务必提供完整 schema。

## 应用场景

2026 年的技术选型：

| 情况 | 选择 |
|-----------|------|
| OpenAI/Anthropic/Google 模型，简单 schema | 原生厂商结构化输出 |
| 任意提供商，Pydantic 工作流，可容忍重试 | Instructor |
| 本地模型，需要 100% 有效性，扁平 schema | Outlines(FSM) |
| 本地模型，递归 schema | XGrammar 或 llguidance |
| 自托管推理服务器 | vLLM guided decoding |
| 批处理且可接受重试 | Instructor + 最便宜的模型 |

## 上线部署

保存为 `outputs/skill-structured-output-picker.md`:

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

1. **简单。** 对小型开源权重模型(如 Llama-3.2-3B)不使用受限解码进行 `Review(sentiment, confidence, evidence_span)` 提示。在 100 条评论上测量能解析为合法 JSON 的比例。
2. **中等。** 在同一语料上使用 Outlines JSON mode。比较合规率、延迟和语义准确性。
3. **困难。** 从零为电话号码实现一个正则受限解码器(`\d{3}-\d{3}-\d{4}`)。在 1000 个样本上验证 0 个无效输出。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 受限解码 | 强制合法输出 | 在每个生成步骤屏蔽无效 token 的 logits。 |
| Logit processor | 起约束作用的东西 | 函数：`(logits, state) -> masked_logits`。 |
| FSM | 有限状态机 | 编译后的语法表示；O(1) 的有效下一 token 查询。 |
| CFG | 上下文无关文法 | 能处理递归的语法；比 FSM 慢但更具表达力。 |
| Schema 字段顺序 | 重要吗？ | 重要——第一个字段就锁定答案；务必把推理放在答案之前。 |
| Guided decoding | vLLM 对它的称呼 | 同一概念，集成进推理服务器。 |
| JSON mode | OpenAI 的早期版本 | 只保证 JSON 语法；不保证匹配 schema。 |

## 延伸阅读

- [Willard, Louf (2023)。Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) — Outlines 论文。
- [XGrammar 论文 (2024)](https://arxiv.org/abs/2411.15100) — 快速基于 CFG 的受限解码。
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) — 推理服务器集成。
- [OpenAI — Structured Outputs 指南](https://platform.openai.com/docs/guides/structured-outputs) — API 参考 + 注意事项。
- [Instructor 库](https://python.useinstructor.com/) — 跨提供商的 Pydantic + 重试。
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) — 对 6 个受限解码框架的基准测试。