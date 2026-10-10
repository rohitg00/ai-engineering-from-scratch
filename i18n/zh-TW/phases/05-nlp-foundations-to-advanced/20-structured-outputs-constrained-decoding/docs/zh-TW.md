# 結構化輸出與約束解碼（constrained decoding）

> 向 LLM 要 JSON。大多時候會拿到 JSON。在正式環境（production）裡，「大多」才是問題。約束解碼在取樣（sampling）之前改 logit（logit），把「大多」變成「總是」。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## The Problem｜問題

分類器（classifier）這樣 prompt 一個 LLM：「Return one of {positive, negative, neutral}.」。模型回「The sentiment is positive — this review is overwhelmingly favorable because the customer explicitly states that they ...」。你的解析器崩潰。你的分類器 F1 是 0.0。

自由生成不是契約。它是建議。正式環境的系統需要契約。

2026 年有三層。

1. **prompting。** 好好請。「Return only the JSON object.」。前沿模型上大約 80% 行得通，較小的模型更少。
2. **原生的結構化輸出 API。** OpenAI 的 `response_format`、Anthropic 的工具使用、Gemini 的 JSON 模式。支援的 schema 上可靠。鎖在廠商上。
3. **約束解碼。** 在每個生成步驟改 logit，讓模型*不能*吐出不合法的 token。構造上 100% 合法。任何本地模型都行。

這一課為三者建立直覺，並點名何時該伸手拿哪一個。

## The Concept｜核心概念

![Constrained decoding masking invalid tokens at each step](../assets/constrained-decoding.svg)

**約束解碼怎麼運作。** 每個生成步驟，LLM 在整個詞彙表（vocabulary）（大約 10 萬個 token）上產出一個 logit 向量。一個 *logit 處理器* 坐在模型和取樣器之間。它依目標文法裡的當前位置——JSON Schema、正規表示式（regex）、上下文無關文法（context-free grammar）——算出哪些 token 合法，再把所有不合法 token 的 logit 設成負無窮。剩下的 logit 做 softmax，機率質量只落在合法的延續上。

2026 年的實作：

- **Outlines。** 把 JSON Schema 或正規表示式編成有限狀態機（finite-state machine）。每個 token 用 O(1) 查下一個合法 token。基於有限狀態機，所以遞迴 schema 需要攤平。
- **XGrammar／llguidance。** 上下文無關文法引擎。處理遞迴的 JSON Schema。解碼額外開銷近乎零。OpenAI 在 2025 年的結構化輸出實作裡點名了 llguidance。
- **vLLM 引導解碼。** 內建 `guided_json`、`guided_regex`、`guided_choice`、`guided_grammar`，後端是 Outlines、XGrammar 或 lm-format-enforcer。
- **Instructor。** 以 Pydantic 為基礎，為各種 LLM 提供包裝層。驗證失敗就重試。跨供應商，但不改 logit——它靠重試，加上知道結構化輸出的 prompt。

### 反直覺的結果

約束解碼常常比不受約束的生成*更快*。兩個原因。第一，它縮小下一個 token 的搜尋空間。第二，聰明的實作對被迫的 token 整個跳過生成（像 `{"name": "` 這類固定格式片段——每個位元組（byte）都已確定）。

### 會讓你付代價的那個坑

欄位順序要緊。把 `answer` 放在 `reasoning` 前面，模型會在思考之前就承諾一個答案。JSON 合法。答案是錯的。沒有驗證抓得到。

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

schema 的欄位順序是邏輯，不是排版。

```figure
constrained-decoder
```

## Build It｜動手實作

### 步驟 1：從零做正規表示式約束的生成

見 `code/main.py` 的獨立有限狀態機實作。30 行裡的核心想法：

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

有限狀態機追蹤文法裡我們到目前為止滿足了哪些部分。`valid_tokens(state, tokenizer)` 算出哪些詞彙表 token 能推進它，又不離開一條可接受的路徑。

### 步驟 2：用 Outlines 處理 JSON Schema

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

驗證錯誤是零。永遠。有限狀態機讓不合法的輸出到不了。

### 步驟 3：用 Instructor 做與供應商無關的 Pydantic

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

機制不同。Instructor 不碰 logit。它把 schema 寫進 prompt，解析輸出，驗證失敗就重試（預設 3 次）。任何供應商都能用。重試增加延遲（latency）和成本。賣點是跨供應商可攜。

### 步驟 4：廠商原生 API

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

伺服器端的約束解碼。支援的 schema 上，可靠度和 Outlines 相當。不用自己管本地模型。把你鎖在廠商上。

## 坑

- **遞迴 schema。** Outlines 把遞迴攤到固定深度。樹狀輸出（巢狀留言、AST）需要 XGrammar 或 llguidance（基於 CFG）。
- **巨大的列舉。** 1 萬個選項的列舉編譯很慢，或會逾時。改成檢索器：先預測前 k 個候選，再約束在那些上面。
- **文法太嚴。** 強制 `date: "YYYY-MM-DD"` 正規表示式，模型就不能對缺的日期輸出 `"unknown"`。模型會補一個編出來的日期。允許 `null` 或一個哨兵值。
- **過早承諾。** 見上面欄位順序的那個坑。永遠把推理放在前面。
- **沒有 schema 的廠商 JSON 模式。** 純 JSON 模式只保證 JSON 合法，不保證*對你的用途*合法。永遠給完整的 schema。

## Use It｜實際應用

2026 年的組合：

| 情況 | 選擇 |
|-----------|------|
| OpenAI／Anthropic／Google 模型，簡單 schema | 廠商原生的結構化輸出 |
| 任何供應商、Pydantic 工作流、可接受重試造成的延遲與成本 | Instructor |
| 本地模型、需要 100% 合法、平坦 schema | Outlines（有限狀態機） |
| 本地模型、遞迴 schema | XGrammar 或 llguidance |
| 自己架的推論（inference）伺服器 | vLLM 引導解碼 |
| 批次（batch）處理、重試可接受 | Instructor 加最便宜的模型 |

## Ship It｜交付成果

存成 `outputs/skill-structured-output-picker.md`：

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

## Exercises｜練習

1. **簡單。** 不用約束解碼，prompt 一個小型開放權重模型（例如 Llama-3.2-3B），要 `Review(sentiment, confidence, evidence_span)`。在 100 則評論上，量能解析成合法 JSON 的比例。
2. **中等。** 同一個語料庫（corpus）用 Outlines 的 JSON 模式。比較符合率、延遲和語意準確率（accuracy）。
3. **困難。** 從零實作電話號碼的正規表示式約束解碼器（`\d{3}-\d{3}-\d{4}`）。在 1000 個樣本上驗證不合法輸出是 0。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 約束解碼 | 強迫輸出合法 | 在每個生成步驟遮住不合法 token 的 logit。 |
| logit 處理器 | 做約束的那個東西 | 函式：`(logits, state) -> masked_logits`。 |
| 有限狀態機 | 有限狀態機 | 編成的文法表示；O(1) 查下一個合法 token。 |
| CFG | 上下文無關文法 | 處理遞迴的文法；比有限狀態機慢，但表達力更強。 |
| schema 欄位順序 | 有差嗎？ | 有——第一個欄位就承諾了；永遠把推理放在答案前面。 |
| 引導解碼 | vLLM 的叫法 | 同一個概念，做進推論伺服器。 |
| JSON 模式 | OpenAI 的早期版本 | 保證 JSON 語法；並不保證符合 schema。 |

## Further Reading｜延伸閱讀

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) ——Outlines 論文。
- [XGrammar paper (2024)](https://arxiv.org/abs/2411.15100) ——基於 CFG 的快速約束解碼。
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) ——推論伺服器的整合。
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) ——API 參考，加上容易踩的地方。
- [Instructor library](https://python.useinstructor.com/) ——跨供應商的 Pydantic 加重試。
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) ——對 6 個約束解碼框架做評測。
