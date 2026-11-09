# Caching nhanh và Caching ngữ cảnh

> Hệ thống của bạn yêu cầu là 4.000 mã thông báo. ngữ cảnh RAG của bạn là 20.000 mã thông báo. Bạn gửi cả hai với mỗi yêu cầu. Bạn cũng trả cho cả hai lần. Cấp  nhanh cho phép nhà cung cấp giữ cho tiền đề ấm ở phía của họ và tính phí bạn 10% của tỷ lệ bình thường khi tái sử dụng. Được sử dụng đúng cách, nó cắt giảm chi phí suy luận bằng 5090% và độ trễ đầu tiên mã thông báo bằng 4085%.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 01 (Prompt Engineering), Phase 11 · 05 (Context Engineering), Phase 11 · 11 (Caching and Cost)
**Time:** ~60 minutes

## Vấn đề

Một đại lý lập trình gửi cùng một thông báo hệ thống 15.000 token cho Claude mỗi lần nói chuyện.$3/M input tokens is $0,90 trong chi phí đầu vào chỉ riêng  trước bất kỳ tin nhắn thực tế của người dùng. Nồng lên 10.000 cuộc trò chuyện hàng ngày và hóa đơn đạt 9.000 đô la / ngày cho văn bản không bao giờ thay đổi.

Bạn không thể thu hẹp lời nhắc mà không làm tổn hại đến chất lượng. Bạn không thể tránh gửi nó  mô hình cần nó ở mọi lượt.

Động thái đó là lưu trữ cache nhanh chóng. Anthropic đã đưa ra nó vào tháng 8 năm 2024 (với một biến thể TTL kéo dài 1 giờ vào năm 2025), OpenAI tự động hóa nó vào cuối năm đó, Google đã đưa ra lưu trữ bối cảnh rõ ràng cùng với Gemini 1.5, và cả ba bây giờ cung cấp nó như một tính năng hạng nhất trên các mô hình biên giới của họ.

## Khái niệm

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**The mechanic.**Khi tiền đề của yêu cầu phù hợp với một yêu cầu gần đây, nhà cung cấp phục vụ bộ nhớ cache KV từ chạy trước thay vì mã hóa lại các token. Bạn trả tiền viết nhỏ lần đầu tiên và giảm giá đọc lớn mỗi lần sau đó.

**Three provider flavors in 2026.**

| Provider | API style | Hit discount | Write premium | Default TTL | Min cacheable |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | Explicit `cache_control` markers on content blocks | 90% off input | 25% surcharge | 5 min (extendable to 1 hour) | 1,024 tokens (Sonnet/Opus), 2,048 (Haiku) |
| OpenAI | Automatic prefix detection | 50% off input | none | Up to 1 hour (best-effort) | 1,024 tokens |
| Google (Gemini) | Explicit `CachedContent` API | Storage-billed; read at ~25% of normal | Storage fee per token·hour | User-set (default 1 hour) | 4,096 tokens (Flash), 32,768 (Pro) |

**The invariant.**Tất cả ba bộ nhớ cache chỉ có tiền đề. Nếu bất kỳ token nào khác nhau giữa các yêu cầu, mọi thứ sau token khác nhau đầu tiên là một lỗi. Đặt các phần * ổn định * ở phía trên, các phần * biến * ở phía dưới.

### Layout thân thiện với cache

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

Vi phạm lệnh  đặt thông điệp người dùng trên lệnh hệ thống, bỏ lại các truy xuất động giữa vài lần chụp  và bộ nhớ cache không bao giờ chạm.

### Việc tính toán break-even

Premium viết 25% của Anthropic (5 phút TTL) trả cho chính nó khi đọc lần đầu tiên, bởi vì một bài đọc cache có giá 0.1x. 1 write + 1 read trung bình 0,675x chi phí cho mỗi yêu cầu (thất kiệm 32%); 1 write + 10 read trung bình 0,205x (thất kiệm 80%). TTL 1 giờ tính phí 2x cho việc viết, vì vậy khối cần hai đọc để xuất hiện trước. Quy tắc: lưu trữ bất cứ điều gì bạn mong đợi sử dụng lại ít nhất 3 lần trong TTL; điều đó xóa phá vỡ-chẳng trên cả hai TTL.

```figure
prompt-cache-hit
```

## Hãy xây dựng nó

### Bước 1: Cấp ấp yêu cầu nhân bản với các dấu hiệu rõ ràng

```python
import anthropic

client = anthropic.Anthropic()

SYSTEM = [
    {
        "type": "text",
        "text": "You are a senior Python reviewer. Follow the rubric exactly.\n\n" + RUBRIC_15K_TOKENS,
        "cache_control": {"type": "ephemeral"},
    }
]

def review(code: str):
    return client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=SYSTEM,
        messages=[{"role": "user", "content": code}],
    )
```

- `cache_control`Markers nói với Anthropic để lưu trữ khối trong 5 phút. sử dụng lại trong cửa sổ đó nhấn; sử dụng lại sau khi hết hạn và viết lại.

**Response usage fields:**

```python
response = review(code_a)
response.usage
# InputTokensUsage(
#     input_tokens=120,
#     cache_creation_input_tokens=15023,   # paid at 1.25x
#     cache_read_input_tokens=0,
#     output_tokens=340,
# )

response_b = review(code_b)
response_b.usage
# cache_creation_input_tokens=0
# cache_read_input_tokens=15023           # paid at 0.1x
```

Kiểm tra cả hai trường trong CI  nếu `cache_read_input_tokens`giữ ở mức không qua các yêu cầu, các khóa cache của bạn đang di chuyển.

### Bước 2: TTL kéo dài một giờ

Đối với các công việc hàng dài, thời gian mất 5 phút hết hạn giữa các công việc.`ttl`- Có thể là:

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

TTL 1 giờ chi phí gấp 2 lần phí viết (50% so với đường gốc thay vì 25%) nhưng trả lại nhanh chóng trên bất kỳ lô nào sử dụng lại tiền đề hơn 5 lần.

### Bước 3: OpenAI tự động lưu trữ

OpenAI không cho bạn gì để cấu hình. bất kỳ tiền tố trên 1.024 token phù hợp với yêu cầu gần đây nhận được giảm 50% tự động.

```python
from openai import OpenAI
client = OpenAI()

resp = client.chat.completions.create(
    model="gpt-5",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},   # long and stable
        {"role": "user", "content": user_msg},
    ],
)
resp.usage.prompt_tokens_details.cached_tokens  # the discounted portion
```

Cũng như quy tắc bố trí thân thiện với cache áp dụng. Hai điều giết chết cache của OpenAI mà không giết chết của Anthropic: thay đổi `user`Field (được sử dụng như một thành phần khóa cache) và các công cụ sắp xếp lại.

### Bước 4: Gemini cache ngữ cảnh rõ ràng

Gemini xử lý cache như một đối tượng hạng nhất bạn tạo ra và đặt tên:

```python
from google import genai
from google.genai import types

client = genai.Client()

cache = client.caches.create(
    model="gemini-3.8-flash",
    config=types.CreateCachedContentConfig(
        display_name="rubric-v3",
        system_instruction=RUBRIC,
        contents=[FEW_SHOT_EXAMPLES],
        ttl="3600s",
    ),
)

resp = client.models.generate_content(
    model="gemini-3.8-flash",
    contents=["Review this code:\n" + code],
    config=types.GenerateContentConfig(cached_content=cache.name),
)
```

Gemini tính phí lưu trữ mỗi token·hour cho đến khi bộ nhớ cache tồn tại, và đọc ở mức ~ 25% tốc độ nhập bình thường. Đây là hình dạng phù hợp khi bạn sử dụng lại cùng một lệnh khổng lồ trong nhiều phiên trong nhiều ngày.

### Bước 5: đo tốc độ tấn công trong sản xuất

Nhìn xem`code/main.py`cho một kế toán viên ba nhà cung cấp mô phỏng theo dõi ghi chép / đọc / bỏ qua và tính toán chi phí hỗn hợp cho mỗi yêu cầu 1K. Gate triển khai với tỷ lệ hit mục tiêu  hầu hết các thiết lập Anthropic sản xuất nên thấy > 80% phần đọc sau khi nóng lên.

## Những bẫy vẫn còn tồn tại vào năm 2026

- **Dynamic timestamps at the top.** `"Current time: 2026-04-22 15:30:02"`ở trên cùng của hệ thống yêu cầu. mọi yêu cầu bị bỏ lỡ. Di chuyển dấu thời gian dưới điểm vỡ cache.
- **Tool reordering.**Tạo ra các công cụ theo thứ tự ổn định  một sự sắp xếp lại giữa các triển khai phá vỡ mọi hit.
- **Free-text near-duplicates.**"Bạn là người hữu ích". vs "Bạn là một trợ lý hữu ích".
- **Too-small blocks.**Anthropic áp dụng một sàn 1.024 token (2.048 cho Haiku).
- **Blind cost dashboards.**Chia "tốc số đầu vào" thành cache vs không cache. Nếu không, giảm lưu lượng truy cập sẽ giống như một chiến thắng cache.

## Sử dụng nó

Lưu trữ 2026:

| Situation | Pick |
|-----------|------|
| Agent with stable 10k+ system prompt, many turns | Anthropic `cache_control` with 5-min TTL |
| Batch job reusing a prefix for 30+ minutes | Anthropic with `ttl: "1h"` |
| Serverless endpoints on GPT-5, no custom infra | OpenAI automatic (just make your prefix stable and long) |
| Multi-day reuse of a giant code/doc corpus | Gemini explicit `CachedContent` |
| Cross-provider fallback | Keep the cacheable prefix layout identical across providers so any hit works |

Kết hợp với bộ nhớ cache ngữ nghĩa (Phase 11 · 11) cho lớp tin nhắn người dùng: xử lý bộ nhớ cache nhanh * token-identical * tái sử dụng, bộ nhớ cache ngữ nghĩa * nghĩa-identical * tái sử dụng.

## Chuyển nó

- Cứu lại`outputs/skill-prompt-caching-planner.md`- Có thể là:

```markdown
---
name: prompt-caching-planner
description: Design a cache-friendly prompt layout and pick the right provider caching mode.
version: 1.0.0
phase: 11
lesson: 15
tags: [llm-engineering, caching, cost]
---

Given a prompt (system + tools + few-shot + retrieval + history + user) and a usage profile (requests per hour, TTL needed, provider), output:

1. Layout. Reordered sections with a single cache breakpoint marked; explain which sections are stable, which are volatile.
2. Provider mode. Anthropic cache_control, OpenAI automatic, or Gemini CachedContent. Justify from TTL and reuse pattern.
3. Break-even. Expected reads per write within TTL; net cost vs no-cache with math.
4. Verification plan. CI assertion that cache_read_input_tokens > 0 on the second identical request; dashboard split by cached vs uncached tokens.
5. Failure modes. List the three most likely reasons the cache will miss in this setup (dynamic timestamp, tool reorder, near-duplicate text) and how you will prevent each.

Refuse to ship a cache plan that places a dynamic field above the breakpoint. Refuse to enable 1h TTL without a reuse count that makes the 2x write premium pay back.
```

## Các bài tập

1. **Easy.**Hãy nói chuyện 10 lần với một hệ thống 5000 token chống lại Claude.`cache_control`báo cáo hóa đơn đầu vào-token cho mỗi người.
2. **Medium.**Viết một vòng kiểm tra, với một mẫu nhanh chóng và một nhật ký yêu cầu, tính toán tỷ lệ hit dự kiến và tiết kiệm đô la cho mỗi nhà cung cấp (Anthropic 5m, Anthropic 1h, OpenAI tự động, Gemini rõ ràng).
3. **Hard.**Tạo một trình tối ưu hóa bố cục: được đưa ra một lời nhắc và một danh sách các trường được đánh dấu `stable=True/False`, viết lại lời nhắc để đặt một điểm vỡ cache duy nhất ở vị trí tối đa thân thiện với cache mà không mất thông tin.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Prompt caching | "Makes long prompts cheap" | Reusing a provider-side KV-cache for matching prefixes; 50-90% discount on repeated input tokens. |
| `cache_control` | "The Anthropic marker" | Content-block attribute that declares "everything up to here is cacheable"; `{"type": "ephemeral"}`. |
| Cache write | "Paying the premium" | The first request that populates the cache; billed at ~1.25x input rate on Anthropic, free on OpenAI. |
| Cache read | "The discount" | Subsequent requests matching the prefix; billed at 10% (Anthropic), 50% (OpenAI), ~25% (Gemini). |
| TTL | "How long it lives" | Seconds the cache stays warm; Anthropic 5m default (extendable 1h), OpenAI best-effort up to 1h, Gemini user-set. |
| Extended TTL | "1-hour Anthropic cache" | `{"type": "ephemeral", "ttl": "1h"}`; 2x write premium but worth it for batch reuse. |
| Prefix match | "Why my cache missed" | Caches only hit when every token from the start up to the breakpoint is byte-identical. |
| Context caching (Gemini) | "The explicit one" | Google's named, storage-billed cache object; best for multi-day reuse of large corpora. |

## Đọc thêm

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) `cache_control`, 1h TTL, bàn hòa.
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) tự động phù hợp với tiền tố.
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) `CachedContent`API và giá lưu trữ.
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) Đài khởi động ban đầu với số độ trễ.
- Giai đoạn 11 · 05 (Kỹ thuật ngữ)  nơi để cắt prompt để bộ nhớ cache có thể hạ cánh.
- Giai đoạn 11 · 11 (Caching and Cost)  cặp prompt caching với một cache ngữ nghĩa trên tin nhắn người dùng.
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) mô hình bộ nhớ cache KV- prompt caching cho người dùng; giải thích tại sao một prefix được lưu trữ trong cache lại rẻ hơn 10x so với tính toán lại.
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) prefill là các đường tắt lưu trữ cache prompt giai đoạn; bài báo này giải thích tại sao TTFT giảm đáng kể trên hit cache trong khi TPOT không bị ảnh hưởng.
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) Caching nhanh nằm cạnh việc giải mã suy đoán, Flash Attention và MQA/GQA như là các đòn bẩy làm cong cong cong cong chi phí suy luận; đọc đây cho ba phần còn lại.
