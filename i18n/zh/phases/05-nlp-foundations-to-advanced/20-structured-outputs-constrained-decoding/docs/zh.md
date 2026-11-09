# 结构化输出和限制式解码

> 要求一个LLM获得JSON. 获取JSON大部分时间. 在生产中,"大多数"是问题. 限制式解码将"大多数"转化为"总是"通过在采样之前编辑记录.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## 问题

类别器提示LLM:"返回一个 {正,负,中立}."模型返回"情绪是正的这个评论是绝对有利的,因为客户明确表示他们...".你的解析器崩.你的类别器的F1是0.

无机生产不是合同,而是建议.

2026年,有三个层.

1. **Prompting.**问好. "只返回JSON对象". 在边界模型上工作80%左右,较小的模型上工作少.
2. **Native structured output APIs.**开放AI`response_format`通过"双子座"的JSON模式,可靠的支持方案,供应商锁定.
3. **Constrained decoding.**修改每次生成步骤的 logits,使模型 *不能*发出无效的代币. 100% 通过构建有效.

这一课让我们有了三种直觉,

## 概念

![Constrained decoding masking invalid tokens at each step](../assets/constrained-decoding.svg)

**How constrained decoding works.**在每一代阶段,LLM产生一个对整个词汇库 (~100k代币) 的逻辑向量. 模型和样本处理器之间设有*logit处理器* 它计算了目标语法中的当前位置,根据目标语法中的当前位置,并且设置了所有不有效的语法的逻辑到负无限. 剩余的 logits上的软max只将概率量放在有效的延续上.

2026年实施:

- **Outlines.**编译JSON图案或regex到一个有限状态机器.每个代币得到一个$O(1)$基于FSM,所以复制方案需要平坦化.
- **XGrammar / llguidance.**无文本语法引擎.处理复制 JSON 方案.近零的解码费用.OpenAI在他们的2025年结构化输出实施中获得了指导.
- **vLLM guided decoding.**内部`guided_json`现在`guided_regex`现在`guided_choice`现在`guided_grammar`通过轮,XGrammar或lm格式执行后台.
- **Instructor.**基于Pydantic的包装在任何LLM上. 检查验证失败.跨供应商,但不修改记录它依赖于检查 + 结构化输出意识提示.

### 结果是反直觉的

限制式解码通常比无限制式生成更快. 原因是两种. 一,它缩小了下一个代币的搜索空间. 第二,聪明的实现完全跳过代币生成,以强制代币 (如`{"name": "`每个字节都确定).

### 陷,这会让你

现场秩序是重要的.`answer`在之前`reasoning`模型在思考之前就会答复.JSON是有效的.答案是错误的.没有验证可以捕获它.

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

方案场序是逻辑,而不是格式化.

```figure
constrained-decoder
```

## 建立它

### 步骤1:从零开始,Regex限制的生成

看到`code/main.py`基本的想法是30条:

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

现在我们已经满足了语法的部分.`valid_tokens(state, tokenizer)`计算哪些词汇代币可以在不离开接受的道路上推进FSM.

### 步骤 2: JSON 方案的概述

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

没有验证错误,FSM使得无效输出无法达到.

### 步骤3:提供商无知Pydantic的教练

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

导师不触及登录.它将方案格式化成提示,解析输出,并重新尝试验证故障 (默认3次).与任何提供商一起工作. 复试增加延迟和成本.跨提供商可移植性是销售点.

### 步骤4:本地供应商API

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

服务器边限制解码,可靠性与支持方案的概况等等,没有本地模型管理,锁定您到供应商.

## 陷

- **Recursive schemas.**草图将回归平坦到固定深度.树结构输出 (嵌入式评论,AST) 需要XGrammar或illguidance (基于CFG).
- **Huge enums.**转换到一个回收器:先预测前候选人,然后限制到这些.
- **Grammar too strict.**力量`date: "YYYY-MM-DD"`regex和模型不能输出`"unknown"`模型通过发明日期来补偿.`null`或是守卫.
- **Premature commitment.**看到现场秩序陷,总是把推理放在第一位.
- **Vendor JSON mode without schema.**纯JSON模式只保证有效的JSON,而不是有效的*您的使用情况*.

## 用它

现在,我们要做什么?

| Situation | Pick |
|-----------|------|
| OpenAI/Anthropic/Google model, simple schema | Native vendor structured output |
| Any provider, Pydantic workflow, can tolerate retries | Instructor |
| Local model, need 100% validity, flat schema | Outlines (FSM) |
| Local model, recursive schema | XGrammar or llguidance |
| Self-hosted inference server | vLLM guided decoding |
| Batch processing with retries acceptable | Instructor + cheapest model |

## 运送它

保存如`outputs/skill-structured-output-picker.md`其他:

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

## 运动

1. **Easy.**提示一个小的开放权重模型 (例如,Llama-3.2-3B) 没有限制的解码`Review(sentiment, confidence, evidence_span)`测量在100个评论中分析为有效的JSON的分数.
2. **Medium.**根据标准,我们可以将数据与数据的数据进行比较.
3. **Hard.**实现从零开始对电话号码进行regex限制式解码器 (`\d{3}-\d{3}-\d{4}`) 验证1000个样本的0个不有效输出.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Constrained decoding | Force valid output | Mask invalid-token logits at every generation step. |
| Logit processor | The thing that constrains | Function: `(logits, state) -> masked_logits`. |
| FSM | Finite-state machine | Compiled grammar representation; $O(1)$ valid-next-token lookup. |
| CFG | Context-free grammar | Grammar that handles recursion; slower but more expressive than FSM. |
| Schema field order | Does it matter? | Yes — first field commits; always put reasoning before answer. |
| Guided decoding | vLLM's name for it | Same concept, integrated into the inference server. |
| JSON mode | OpenAI's early version | Guarantees JSON syntax; does NOT guarantee schema match. |

## 进一步阅读

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702)简介报.
- [XGrammar paper (2024)](https://arxiv.org/abs/2411.15100)快速基于CFG的限制解码.
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html)推断服务器集成.
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) API 参考+Gotchas
- [Instructor library](https://python.useinstructor.com/)Pydantic+在各供应商中重新尝试.
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868)基准评估 6 个限制式解码框架.
