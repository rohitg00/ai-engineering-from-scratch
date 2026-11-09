# OpenTelemetry GenAI Công ước ngữ nghĩa

> OpenTelemetry's GenAI SIG (được ra mắt vào tháng 4 năm 2024) xác định các quy trình tiêu chuẩn cho điện toán đại lý. Tên của span, thuộc tính và các quy tắc nắm bắt nội dung hội tụ giữa các nhà cung cấp vì vậy dấu vết đại lý có nghĩa là cùng một điều trong Datadog, Grafana, Jaeger và Honeycomb.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 24 (Observability Platforms)
**Time:** ~60 minutes

## Mục tiêu học tập

- Tên gọi các loại phạm vi GenAI: mô hình/thành khách, đại lý, công cụ.
- Nhận ra sự khác biệt`invoke_agent`KLIENT vs INTERNAL và khi nào mỗi ứng dụng.
- Đăng danh tính cấp cao nhất của GenAI: tên nhà cung cấp, mô hình yêu cầu, ID nguồn dữ liệu.
- Giải thích hợp đồng thu thập nội dung: chọn tham gia, `OTEL_SEMCONV_STABILITY_OPT_IN`, khuyến nghị tham chiếu bên ngoài.

## Vấn đề

Mỗi nhà cung cấp phát minh ra tên miền riêng của họ. nhóm Ops kết thúc xây dựng bảng điều khiển theo khung. OpenTelemetry's GenAI SIG sửa chữa điều này bằng cách xác định một tiêu chuẩn các mục tiêu toàn bộ hệ sinh thái.

## Khái niệm

### Các loại span

1. **Model / client spans.**Bao gồm các cuộc gọi LLM nguyên liệu. Được phát hành bởi các SDK của nhà cung cấp (Anthropic, OpenAI, Bedrock) và các bộ chuyển đổi mô hình khung.
2. **Agent spans.** `create_agent`(khi đại lý được xây dựng) và `invoke_agent`(Khi nó chạy).
3. **Tool spans.**Một cho mỗi công cụ gọi; kết nối với khoảng thời gian đại lý bởi mối quan hệ cha mẹ-cháu.

### Tên gọi của đại lý span

- Tên tiếng Tây Ban Nha: `invoke_agent {gen_ai.agent.name}`nếu có tên; fallback đến `invoke_agent`- Tôi không biết.
- Loại Span:
  - **CLIENT** cho các dịch vụ đại lý từ xa (OpenAI Assistants API, Bedrock Agents).
  - **INTERNAL** cho các khung đại lý trong quá trình (LangChain, CrewAI, ReAct địa phương).

### Các thuộc tính chính

- `gen_ai.provider.name` `anthropic`- `openai`- `aws.bedrock`- `google.vertex`- Tôi không biết.
- `gen_ai.request.model` Đơn vị nhận dạng mẫu.
- `gen_ai.response.model` mô hình được giải quyết (có thể khác với yêu cầu do định tuyến).
- `gen_ai.agent.name` Định danh đại lý.
- `gen_ai.operation.name` `chat`- `completion`- `invoke_agent`- `tool_call`- Tôi không biết.
- `gen_ai.data_source.id` cho RAG: các cơ sở hoặc cửa hàng đã được tham khảo.

Các công nghệ cụ thể có các quy ước cho Anthropic, Azure AI Inference, AWS Bedrock, OpenAI.

### Tải nội dung

Quy tắc mặc định: các thiết bị không nên ghi vào / ra ra mặc định.

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

Mô hình sản xuất được khuyến cáo: lưu trữ nội dung bên ngoài (S3, lưu trữ nhật ký của bạn), ghi lại tham chiếu trên khoảng thời gian (tín chỉ ID, không phải văn bản). Đây là phòng thủ độc chứa bài học 27 được kết nối với khả năng quan sát.

### Thường độ ổn định

Hầu hết các hội nghị là thử nghiệm từ tháng 3 năm 2026.

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

Datadog v1.37+ bản đồ GenAI gán bản địa vào sơ đồ LLM Observability của mình.

### Khi mô hình này đi sai

- **Capturing full prompts in spans.**PII, bí mật, dữ liệu khách hàng trong các dấu vết mà các ops có thể đọc.
- **No `gen_ai.provider.name`.**Các bảng điều khiển đa nhà cung cấp bị hỏng khi thuộc tính bị thiếu.
- **Spans without parent links.**Những công cụ mồ côi luôn truyền bá bối cảnh.
- **Not setting stability opt-in.**Các thuộc tính của bạn có thể được đổi tên trong nâng cấp backend.

```figure
ae-genai-span-tree
```

## Hãy xây dựng nó

`code/main.py`thực hiện một emiter bán kính stdlib phù hợp với các quy ước GenAI:

- `Span`với schema thuộc tính GenAI.
- `Tracer`với `start_span`, các bối cảnh tổ hợp.
- Một nhân viên kịch bản chạy phát ra: `create_agent`- `invoke_agent`(INTERNAL), mỗi công cụ trải dài, `chat`thời gian cho các cuộc gọi LLM.
- Một chế độ chụp nội dung lưu trữ các lời nhắc bên ngoài và ghi nhận ID trên khoảng thời gian.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả: một cây span với tất cả các thuộc tính GenAI cần thiết, và một "bảo lưu bên ngoài" cho thấy các tham chiếu nội dung chọn vào.

## Sử dụng nó

- **Datadog LLM Observability**(v1.37+) thuộc tính bản địa của bản đồ.
- **Langfuse / Phoenix / Opik**(Dân học 24)  tự động dụng cụ hệ sinh thái.
- **Jaeger / Honeycomb / Grafana Tempo** dấu vết OTel nguyên liệu; xây dựng bảng điều khiển từ thuộc tính GenAI.
- **Self-hosted** chạy bộ sưu tập OTel với bộ xử lý GenAI.

## Chuyển nó

`outputs/skill-otel-genai.md`cáp OTel GenAI mở rộng sang một đại lý hiện có với các mặc định ghi nội dung và lưu trữ tham chiếu bên ngoài.

## Các bài tập

1. Đồ chơi bài học 01 ReAct loop với `invoke_agent`(INTERNAL) + mỗi công cụ trải dài. gửi đến một bản Jaeger.
2. Thêm ghi nội dung trong chế độ "chỉ tham chiếu": các yêu cầu đến SQLite, thuộc tính span chỉ mang ID hàng.
3. Đọc thông số kỹ thuật cho `gen_ai.data_source.id`Đưa nó vào tìm kiếm của bạn về bài học 09 Mem0.
4. Đặt `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`và xác minh các thuộc tính của bạn không được đổi tên bởi người thu thập.
5. Xây dựng bảng điều khiển: "những lỗi công cụ nào tương quan với các mô hình nào" từ các thuộc tính của GenAI.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GenAI SIG | "OpenTelemetry GenAI group" | OTel working group defining the schema |
| invoke_agent | "Agent span" | Name of the span representing an agent run |
| CLIENT span | "Remote call" | Span for a call to a remote agent service |
| INTERNAL span | "In-process" | Span for an in-process agent run |
| gen_ai.provider.name | "Provider" | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | "RAG source" | Which corpus/store a retrieval hit |
| Content capture | "Prompt logging" | Opt-in capture of messages; store externally in prod |
| Stability opt-in | "Preview mode" | Env var to pin experimental conventions |

## Đọc thêm

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) thông số kỹ thuật
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) GenAI kéo dài theo mặc định
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) Các hệ thống OTel được xây dựng trong
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) W3C trace context propagation
