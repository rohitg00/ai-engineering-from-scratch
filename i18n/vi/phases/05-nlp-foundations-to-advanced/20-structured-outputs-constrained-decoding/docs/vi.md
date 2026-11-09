# Các kết quả được cấu trúc và mã hóa bị hạn chế

> Khi bạn làm việc với một người khác, bạn sẽ phải làm việc với người khác để làm việc với họ.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## Vấn đề

Một phân loại yêu cầu một LLM: "Vậy trả lại một trong { tích cực, tiêu cực, trung lập}. " Mô hình trả lại "Sentiment là tích cực  đánh giá này là cực kỳ thuận lợi bởi vì khách hàng rõ ràng tuyên bố rằng họ ...". Parser của bạn bị hỏng. F1 của phân loại của bạn là 0.0.

Sản xuất dạng tự do không phải là hợp đồng, mà là một đề xuất.

Ba tầng tồn tại vào năm 2026.

1. **Prompting.**Hãy hỏi một cách tốt. "Vậy chỉ trả lại đối tượng JSON". Nó hoạt động khoảng 80% trên các mô hình biên giới, ít hơn trên các mô hình nhỏ hơn.
2. **Native structured output APIs.**OpenAI `response_format`, sử dụng công cụ nhân bản, chế độ JSON Gemini, đáng tin cậy trên các chương trình được hỗ trợ.
3. **Constrained decoding.**Thay đổi logit tại mỗi bước thế hệ để mô hình * không thể * phát ra các token không hợp lệ. 100% hợp lệ bằng cách xây dựng.

Bài học này giúp bạn có trực giác cho cả ba và biết khi nào bạn cần tìm kiếm.

## Khái niệm

![Constrained decoding masking invalid tokens at each step](../assets/constrained-decoding.svg)

**How constrained decoding works.**Tại mỗi bước thế hệ, LLM tạo ra một vector logit trên toàn bộ từ vựng (~ 100k token). Một bộ xử lý logit nằm giữa mô hình và mẫu. Nó tính toán các token nào hợp lệ với vị trí hiện tại trong ngữ pháp mục tiêu  JSON Schema, regex, ngữ pháp không liên quan  và đặt các logit của tất cả các token không hợp lệ lên âm vô hạn. Softmax trên các logit còn lại chỉ đặt khối lượng xác suất trên các tiếp tục hợp lệ.

Thực hiện vào năm 2026:

- **Outlines.**Sắp xếp JSON Schema hoặc Regex vào một máy giới hạn.$O(1)$tìm kiếm mã thông báo mới có giá trị dựa trên FSM, vì vậy các chương trình tái tạo cần phải được phẳng.
- **XGrammar / llguidance.**Các công cụ ngữ pháp không liên quan. xử lý quy trình JSON tái tạo. Chi phí giải mã gần bằng không. OpenAI ghi nhận sự hướng dẫn trong việc thực hiện đầu ra cấu trúc năm 2025 của họ.
- **vLLM guided decoding.**Được xây dựng `guided_json`- `guided_regex`- `guided_choice`- `guided_grammar`thông qua đường sơ đồ, XGrammar, hoặc lm-format-enforcer backends.
- **Instructor.**Pydantic dựa trên bao bì trên bất kỳ LLM. Thử nghiệm về thất bại xác thực. Cross-công viên, nhưng không sửa đổi logits  nó dựa trên các thử nghiệm lại + cấu trúc-output-thông thức lời nhắc.

### Kết quả trái với trực giác

Việc giải mã hạn chế thường * nhanh hơn * so với việc tạo ra không hạn chế. Hai lý do. Thứ nhất, nó thu hẹp không gian tìm kiếm mã thông báo tiếp theo. Thứ hai, các triển khai thông minh bỏ qua việc tạo mã thông báo hoàn toàn cho mã thông báo buộc (scaffolding như `{"name": "` mỗi byte được xác định).

### Cái bẫy mà bạn phải trả

Lệnh trật tự là quan trọng.`answer`trước đây`reasoning`, và mô hình cam kết trả lời trước khi nó nghĩ. JSON là hợp lệ. Câu trả lời là sai. Không xác nhận bắt được nó.

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

Trình độ trường sơ đồ là logic, không phải định dạng.

```figure
constrained-decoder
```

## Hãy xây dựng nó

### Bước 1: thế hệ bị hạn chế regex từ đầu

Nhìn xem`code/main.py`cho một thực hiện FSM độc lập.

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

FSM theo dõi những phần của ngữ pháp mà chúng ta đã thỏa mãn cho đến nay. `valid_tokens(state, tokenizer)`tính toán các mã từ vựng nào có thể tiến bộ FSM mà không rời khỏi một con đường chấp nhận.

### Bước 2: Kế hoạch JSON

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

Không sai sót xác nhận, không bao giờ.

### Bước 3: Trình hướng dẫn cho Pydantic không biết cung cấp dịch vụ

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

Cơ chế khác nhau. Instructor không chạm vào logits. Nó định dạng sơ đồ vào prompt, phân tích đầu ra, và thử lại khi lỗi xác thực (tầm định 3 lần).

### Bước 4: API nhà cung cấp bản địa

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

Các hệ thống này có thể được giải mã theo các quy định của các nhà cung cấp, không có hệ thống quản lý mô hình địa phương, bạn bị khóa với nhà cung cấp.

## Những bẫy

- **Recursive schemas.**Các phác thảo làm phẳng sự tái diễn đến độ sâu cố định. Các kết quả có cấu trúc cây (những bình luận tổ, AST) cần XGrammar hoặc hướng dẫn (dựa trên CFG).
- **Huge enums.**Enum 10.000 tùy chọn biên soạn chậm hoặc thời gian ra. chuyển sang một retriever: dự đoán ứng cử viên top-k trước, hạn chế cho những người đó.
- **Grammar too strict.**Tăng lực`date: "YYYY-MM-DD"`Regex và mô hình không thể phát `"unknown"`mô hình bù đắp bằng cách phát minh ra một ngày. cho phép`null`hay một lính canh.
- **Premature commitment.**Hãy xem những cái bẫy trên đó.
- **Vendor JSON mode without schema.**Chế độ JSON tinh khiết chỉ đảm bảo JSON hợp lệ, không hợp lệ * cho trường hợp sử dụng của bạn*. Luôn cung cấp một sơ đồ đầy đủ.

## Sử dụng nó

Số 2026:

| Situation | Pick |
|-----------|------|
| OpenAI/Anthropic/Google model, simple schema | Native vendor structured output |
| Any provider, Pydantic workflow, can tolerate retries | Instructor |
| Local model, need 100% validity, flat schema | Outlines (FSM) |
| Local model, recursive schema | XGrammar or llguidance |
| Self-hosted inference server | vLLM guided decoding |
| Batch processing with retries acceptable | Instructor + cheapest model |

## Chuyển nó

Cứ như `outputs/skill-structured-output-picker.md`- Có thể là:

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

## Các bài tập

1. **Easy.**Tạo một mô hình nhỏ với trọng lượng mở (ví dụ, Llama-3.2-3B) mà không cần giải mã hạn chế cho `Review(sentiment, confidence, evidence_span)`- Đánh giá phần phân tích là JSON hợp lệ trên 100 đánh giá.
2. **Medium.**Cùng corpus với chế độ Outlines JSON. So sánh tỷ lệ tuân thủ, độ trễ và độ chính xác ngữ nghĩa.
3. **Hard.**Thực hiện một decoder bị hạn chế regex từ đầu cho số điện thoại (`\d{3}-\d{3}-\d{4}`). Kiểm tra 0 kết quả không hợp lệ trên 1000 mẫu.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Constrained decoding | Force valid output | Mask invalid-token logits at every generation step. |
| Logit processor | The thing that constrains | Function: `(logits, state) -> masked_logits`. |
| FSM | Finite-state machine | Compiled grammar representation; $O(1)$ valid-next-token lookup. |
| CFG | Context-free grammar | Grammar that handles recursion; slower but more expressive than FSM. |
| Schema field order | Does it matter? | Yes — first field commits; always put reasoning before answer. |
| Guided decoding | vLLM's name for it | Same concept, integrated into the inference server. |
| JSON mode | OpenAI's early version | Guarantees JSON syntax; does NOT guarantee schema match. |

## Đọc thêm

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) tờ Outlines.
- [XGrammar paper (2024)](https://arxiv.org/abs/2411.15100) mã hóa hạn chế dựa trên CFG nhanh.
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) Kết luận Server tích hợp.
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) Reference API + gotchas.
- [Instructor library](https://python.useinstructor.com/) Pydantic + thử lại trên các nhà cung cấp.
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) đánh giá so sánh 6 khung giải mã hạn chế.
