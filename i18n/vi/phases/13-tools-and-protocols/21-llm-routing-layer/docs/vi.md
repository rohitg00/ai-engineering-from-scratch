# LLM Routing Layer  LiteLLM, OpenRouter, Portkey

> Việc khóa nhà cung cấp là đắt tiền. Các khối lượng công việc gọi công cụ khác nhau phù hợp với các mô hình khác nhau. Các cổng định tuyến cung cấp một bề mặt API, thử lại, lỗi, theo dõi chi phí và hàng rào. Ba kiểu nguyên mẫu thống trị năm 2026: LiteLLM (đánh nguồn tự lưu trữ), OpenRouter (đánh giá SaaS), Portkey (tạo sản xuất, nguồn mở vào tháng 3 năm 2026). Bài học này nêu tên các tiêu chí quyết định và đi bộ một cửa ngõ định tuyến stdlib.

**Type:** Learn
**Languages:** Python (stdlib, routing + failover + cost tracker), TypeScript
**Prerequisites:** Phase 13 · 02 (function calling), Phase 13 · 17 (gateways)
**Time:** ~45 minutes

## Mục tiêu học tập

- Sự khác biệt giữa các tùy chọn định tuyến tự lưu trữ, quản lý và cấp sản xuất.
- Thực hiện một chuỗi trở lại để thử lại các lỗi của nhà cung cấp theo một thứ tự ưu tiên xác định.
- Theo dõi chi phí theo yêu cầu và việc sử dụng token trên các nhà cung cấp.
- Quyết định giữa LiteLLM, OpenRouter và Portkey cho một hạn chế sản xuất nhất định.

## Vấn đề

Các kịch bản trong đó định tuyến nhà cung cấp quan trọng:

1. **Cost.**Claude Sonnet chi phí 3 lần so với Haiku, cho một nhiệm vụ phân loại, Haiku là đủ, cho một nhiệm vụ tổng hợp, Sonnet là đáng giá.

2. **Failover.**OpenAI có một giờ tồi tệ, mọi yêu cầu đều thất bại, bạn muốn tự động quay lại Anthropic mà không cần chuyển đổi.

3. **Latency.**Một giao diện trò chuyện trực tiếp cần mã thông báo thời gian nhanh chóng.

4. **Compliance.**Người dùng EU phải ở lại các vùng EU.

5. **Experimentation.**A/B hai mô hình trên cùng một khối lượng công việc.

Mã hóa bằng tay tất cả điều này mỗi tích hợp là lặp đi lặp lại. Một cửa cổng định tuyến cung cấp một API tương thích với OpenAI và xử lý phần còn lại.

## Khái niệm

### Hình dạng đại diện tương thích với OpenAI

Mọi người đều nói OpenAI.`/v1/chat/completions`, chấp nhận chương trình OpenAI, và nội bộ đại diện cho Anthropic / Gemini / Cohere / Ollama / bất cứ điều gì.

### Tên đếm mẫu

Thay vì ghi thẻ ID, mã của bạn nói `our_smart_model`Khi một nhà cung cấp gửi một thế hệ mới, bạn thay đổi phía máy chủ tên; mã của bạn không chạm vào bất cứ thứ gì.

### Các chuỗi quay trở lại

```
primary: openai/gpt-4o
on 5xx: anthropic/claude-3-5-sonnet
on 5xx: google/gemini-1.5-pro
on 5xx: refuse
```

Gateways định nghĩa điều này trong một cấu hình. Các thử nghiệm trở lại tính toán với ngân sách để các cơn suy giảm không làm nổ chi phí.

### Caching ngữ nghĩa

Các lời nhắc giống hệt hoặc gần giống hệt nhau xảy ra trong cache thay vì nhà cung cấp.

### Đường dây bảo vệ

Tầng cửa:

- **PII redaction.**Regex hoặc ML-based pass trước khi gửi lời nhắc.
- **Policy violations.**Tránh các lời nhắc với nội dung bị cấm.
- **Output filters.**Trải hoàn thành để tìm thấy rò rỉ.

Portkey và Kong đều có hệ thống bảo vệ, LiteLLM lại cho phép chúng không được sử dụng.

### Các giới hạn lãi suất mỗi khóa

Một API key = một nhóm. Ngân sách mỗi khóa ngăn cản một nhóm tiêu thụ hạn ngạch chia sẻ. Hầu hết các cổng thông tin hỗ trợ điều này.

### Các giao dịch tự lưu trữ vs giao dịch quản lý

| Factor | LiteLLM (self-hosted) | OpenRouter (managed) | Portkey (production) |
|--------|----------------------|----------------------|----------------------|
| Code | Open source, Python | Managed SaaS | Open source (Mar 2026) + managed |
| Setup | Deploy a proxy | Sign up | Either |
| Providers | 100+ | 300+ | 100+ |
| Billing | Your own keys | OpenRouter credits | Your own keys |
| Observability | OpenTelemetry | Dashboard | Full OTel + PII redaction |
| Best for | Teams that want full control | Rapid prototyping | Production with compliance |

LiteLLM thắng khi bạn có một nhóm SRE và muốn chủ quyền dữ liệu. OpenRouter thắng khi bạn muốn một thuê bao duy nhất và không có infra. Portkey thắng khi bạn cần bao vây và tuân thủ ra khỏi hộp.

### Theo dõi chi phí

Mỗi yêu cầu đều có`provider`- `model`- `input_tokens`- `output_tokens`- Tăng bằng giá mỗi mẫu/token (được rút ra từ bảng giá mà cửa khẩu duy trì).

### MCP cộng với định tuyến

Một gateway có thể định tuyến cả hai cuộc gọi LLM và yêu cầu lấy mẫu MCP. Khi mô hình yêu cầu lấy mẫuTích thích thích một mô hình cụ thể, gateway chuyển sang phía sau phải. Đây là nơi giai đoạn 13 · 17 (MCP gateway) và gateway định tuyến của bài học này đôi khi hợp nhất thành một dịch vụ.

### Chiến lược định tuyến

- **Static priority.**Đầu tiên trong danh sách; quay lại lỗi.
- **Load balancing.**Round-robin hoặc cân nặng.
- **Cost-aware.**Chọn mô hình rẻ nhất đáp ứng độ trễ / chất lượng.
- **Latency-aware.**Chọn mô hình nhanh nhất trong vòng 9 phút.
- **Task-aware.**Các tuyến phân loại nhanh có mã hóa cho một mô hình, tóm tắt cho mô hình khác.

```figure
tp-router-failover
```

## Sử dụng nó

`code/main.py`thực hiện một cửa ngõ định tuyến trong ~ 150 dòng: chấp nhận các yêu cầu hình dạng OpenAI, dịch sang các đoạn thu thập hàng cho mỗi nhà cung cấp, chạy chuỗi sự cố trở lại ưu tiên, theo dõi chi phí mỗi yêu cầu, và áp dụng một thông qua chỉnh sửa PII cho các đầu vào.

Những gì cần xem:

- `ROUTES`dict: alias -> danh sách các nhà cung cấp cụ thể theo thứ tự ưu tiên.
- Chuyện quay lại lại lại ở 5xx.
- Cost tracker nhân số việc sử dụng token bằng tỷ lệ cho mỗi mô hình.
- PII biên tập scrubs SSN hình mẫu trước khi chuyển tiếp.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-routing-config-designer.md`. Với một hồ sơ tải trọng công việc (sự trễ, chi phí, tuân thủ), kỹ năng chọn LiteLLM / OpenRouter / Portkey và tạo ra một cấu hình định tuyến.

## Các bài tập

1. Đi chạy`code/main.py`- Tạo ra tình huống ngừng hoạt động; xác nhận sự thất bại trên nhà cung cấp thứ hai và chi phí được gán đúng.

2. Thêm bộ nhớ cache ngữ nghĩa: SHA256 của lời nhắc là một khóa tìm kiếm; các lần nhấn bộ nhớ cache trở lại ngay lập tức. Đo tiết kiệm chi phí trên một cuộc gọi lặp lại.

3. Thêm một trình phân loại nhanh chóng hướng dẫn "code ... " yêu cầu một tên gọi ủng hộ thông minh và "chổ chốt ... " yêu cầu một tên gọi ủng hộ tốc độ.

4. Thiết kế ngân sách cho mỗi nhóm: mỗi nhóm có một giới hạn chi tiêu hàng tháng; Gateway từ chối yêu cầu một khi giới hạn được chạm. Chọn một độ phân tích thực thi (per request hoặc windowsed).

5. Đọc các tài liệu LiteLLM, OpenRouter và Portkey bên cạnh nhau.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routing gateway | "LLM proxy" | One-API-surface layer in front of many providers |
| OpenAI-compatible | "Speaks the OpenAI schema" | Accepts `/v1/chat/completions` shape, translates to any backend |
| Model alias | "our_smart_model" | Name in your code that the gateway maps to a concrete model |
| Fallback chain | "Retry list" | Ordered list of providers attempted on failure |
| Semantic caching | "Prompt-embedding cache" | Key is embedding of the prompt; near-duplicates share a cache hit |
| Guardrails | "Input/output filters" | Redact PII, reject policy violations |
| Per-key rate limit | "Team budget" | Quota scoped to an API key |
| Cost tracking | "Per-request spend" | Aggregate token usage x price per model |
| LiteLLM | "The open proxy" | Self-hostable OSS routing gateway |
| OpenRouter | "The managed SaaS" | Hosted gateway with credit-based billing |
| Portkey | "The production option" | Open-source + managed with guardrails built in |

## Đọc thêm

- [LiteLLM — docs](https://docs.litellm.ai/) Gateway tự lưu trữ
- [OpenRouter — quickstart](https://openrouter.ai/docs/quickstart) quản lý định tuyến SaaS
- [Portkey — docs](https://portkey.ai/docs) định tuyến sản xuất với đường dây bảo vệ
- [TrueFoundry — LiteLLM vs OpenRouter](https://www.truefoundry.com/blog/litellm-vs-openrouter) hướng dẫn quyết định
- [Relayplane — LLM gateway comparison 2026](https://relayplane.com/blog/llm-gateway-comparison-2026) Nghiên cứu nhà cung cấp
