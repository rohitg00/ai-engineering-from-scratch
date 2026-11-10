# OpenTelemetry GenAI  Công cụ theo dõi gọi từ đầu đến cuối

> Một đại lý gọi 5 công cụ, 3 máy chủ MCP và 2 đại lý phụ. Anh cần một dấu vết trên tất cả. Các quy ước ngữ nghĩa OpenTelemetry GenAI (chế độ liên tục ổn định trong v1.37 trở lên) là tiêu chuẩn 2026, được hỗ trợ bởi Datadog, Langfuse, Arize Phoenix, OpenLLMetry và AgentOps. Bài học này nêu tên các thuộc tính cần thiết, đi qua hệ thống phân cấp thời gian (công cụ đại lý → LLM → công cụ), và gửi một máy phát phát sóng thời gian stdlib bạn có thể kết nối với bất kỳ nhà xuất khẩu OTel nào.

**Type:** Build
**Languages:** Python (stdlib, OTel span emitter), TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~75 minutes

## Mục tiêu học tập

- Đề xuất các thuộc tính OTel GenAI cần thiết cho một khoảng thời gian LLM và một khoảng thời gian thực hiện công cụ.
- Xây dựng một hệ thống phân cấp theo dõi bao gồm vòng tròn đại lý, LLM gọi, tool gọi, và MCP khách hàng gửi.
- Quyết định nội dung nào để chụp (tự chọn) vs chỉnh sửa (tầm định).
- Giả phát các đoạn văn cho một người thu thập địa phương (Jaeger, Langfuse) mà không cần viết lại mã công cụ.

## Vấn đề

Một lỗi từ tháng 2 năm 2026: người dùng báo cáo "trong thời gian đại lý của tôi phải trả lời 30 giây; thời gian khác 3 giây". Không có dấu vết. Các nhật ký cho thấy cuộc gọi LLM, nhưng không phải việc gửi công cụ, không phải chuyến đi trở lại của máy chủ MCP, không phải là đại lý phụ. Bạn đoán. Cuối cùng bạn sẽ thấy: một máy chủ MCP đôi khi bị treo trên một khởi động lạnh.

Không có việc theo dõi từ đầu đến cuối, bạn không thể tìm thấy điều này.

Các quy ước được giải quyết trong năm 2025-2026 dưới nhóm các quy ước ngữ nghĩa OpenTelemetry. Họ xác định tên thuộc tính ổn định để Datadog, Langfuse, Phoenix, OpenLLMetry và AgentOps tất cả phân tích cùng một khoảng thời gian.

## Khái niệm

### Tỷ lệ bậc của Span

```
agent.invoke_agent  (top, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

Tất cả đều nằm dưới một danh tính, và các danh tính liên kết mối quan hệ giữa cha mẹ và con cái.

### Các thuộc tính cần thiết

Theo kỳ kết 2025-2026,:

- `gen_ai.operation.name` `"chat"`- `"text_completion"`- `"embeddings"`- `"execute_tool"`- `"invoke_agent"`- Tôi không biết.
- `gen_ai.provider.name` `"openai"`- `"anthropic"`- `"google"`- `"azure_openai"`- Tôi không biết.
- `gen_ai.request.model` chuỗi mô hình yêu cầu (ví dụ: `"gpt-4o-2024-08-06"`().
- `gen_ai.response.model` mô hình thực sự phục vụ.
- `gen_ai.usage.input_tokens`- `gen_ai.usage.output_tokens`- Tôi không biết.
- `gen_ai.response.id` ID phản ứng nhà cung cấp để tương quan.

Đối với các vòng tròn công cụ:

- `gen_ai.tool.name` Định dạng công cụ.
- `gen_ai.tool.call.id` danh tính gọi cụ thể.
- `gen_ai.tool.description` mô tả công cụ (không tùy chọn).

Đối với các đại lý:

- `gen_ai.agent.name`- `gen_ai.agent.id`- `gen_ai.agent.description`- Tôi không biết.

### Loại Span

- `SpanKind.CLIENT`cho các cuộc gọi vượt qua ranh giới quy trình (chuyên bố LLM, máy chủ MCP).
- `SpanKind.INTERNAL`cho các bước vòng lặp của đại lý và thực hiện công cụ.

### Tải nội dung chọn nhượng

Theo mặc định, các khoảng thời gian mang theo các số liệu và thời gian không phải yêu cầu hoặc hoàn thành.`OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`và các môi trường thu thập nội dung cụ thể để bao gồm nội dung.

### Các sự kiện trên các span

Các sự kiện cấp token có thể được thêm vào như các sự kiện trải dài:

- `gen_ai.content.prompt` thông điệp nhập.
- `gen_ai.content.completion` thông điệp xuất phát.
- `gen_ai.content.tool_call` gọi công cụ như ghi lại.

Các sự kiện theo thời gian trong một khoảng thời gian để lặp lại chi tiết.

### Các nhà xuất khẩu

OTel mở rộng xuất khẩu sang:

- **Jaeger / Tempo.**OSS, tại chỗ.
- **Langfuse.**LLM-observability-specific; hình dung việc sử dụng token.
- **Arize Phoenix.**Evals + tracing kết hợp.
- **Datadog.**Thương mại; phân tích bản địa `gen_ai.*`thuộc tính.
- **Honeycomb.**Chuẩn cho cột; thân thiện với truy vấn.

Tất cả đều nói OTLP, định dạng điện thoại.

### Sự lan truyền trên MCP

Khi một khách hàng MCP gọi cho một máy chủ, tiêm tiêu đề theo dõi W3C vào yêu cầu. Streamable HTTP hỗ trợ tiêu đề tiêu chuẩn. Stdio không mang tiêu đề HTTP bản địa; bản đồ đường bộ 2026 của quy định thảo luận thêm một `_meta.traceparent`trường trên các cuộc gọi JSON-RPC.

Cho đến khi tàu: bao gồm các dấu vết trong `_meta`của mỗi yêu cầu bằng tay. Server ghi lại ID theo dõi.

### Métrics

Bên cạnh các khoảng thời gian, GenAI semconv xác định các số liệu:

- `gen_ai.client.token.usage` HISTogram.
- `gen_ai.client.operation.duration` HISTogram.
- `gen_ai.tool.execution.duration` HISTogram.

Sử dụng chúng cho bảng điều khiển không cần chi tiết mỗi cuộc gọi.

### Lớp AgentOps

AgentOps (tạo ra năm 2024) chuyên về khả năng quan sát GenAI. Nó bao gồm các khung phổ biến (LangGraph, Pydantic AI, CrewAI) để phát ra các khoảng OTel tự động. hữu ích nếu chồng của bạn sử dụng một khung hỗ trợ; sử dụng công cụ thủ công nếu không.

```figure
t3-span-waterfall
```

## Sử dụng nó

`code/main.py`phát ra các bước dài hình OTel để stdout (trong định dạng OTLP-JSON) cho một đại lý gọi LLM, gửi hai công cụ, và thực hiện một chuyến đi về và về của MCP. Không có nhà xuất khẩu thực sự  bài học tập trung vào hình dạng và thuộc tính tập hợp. Paste đầu ra vào một người xem OTLP tương thích hoặc chỉ đọc nó.

Những gì cần xem:

- Đồ nhận dạng dấu vết được chia sẻ trên tất cả các phạm vi.
- Các liên kết cha mẹ-con được mã hóa qua `parentSpanId`- Tôi không biết.
- Cần `gen_ai.*`thuộc tính được lấp đầy.
- Việc ghi lại nội dung là mặc định; một kịch bản bật nó qua env var.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-otel-genai-instrumentation.md`Với một cơ sở mã đại lý, kỹ năng tạo ra một kế hoạch công cụ: nơi để thêm phạm vi, thuộc tính để dân cư, và những người xuất khẩu để nhắm mục tiêu.

## Các bài tập

1. Đi chạy`code/main.py`- Đếm khoảng thời gian và xác định là ai là khách hàng đối với nội bộ.

2. Khởi động chụp nội dung (env var) và xác nhận `gen_ai.content.prompt`và `gen_ai.content.completion`Các sự kiện xuất hiện.

3. Thêm metric tool-execution `gen_ai.tool.execution.duration`và phát ra nó như một mẫu histogram mỗi cuộc gọi.

4. Chuyển một người mẹ theo dõi từ một đại lý mẹ trải dài vào yêu cầu MCP `_meta.traceparent`kiểm tra máy chủ MCP sẽ thấy ID theo dõi tương tự.

5. Đọc các mô hình semconv của OTel GenAI. Xác định một thuộc tính được liệt kê trong semconv mà mã bài học này KHÔNG phát ra. Thêm nó.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| OTel | "OpenTelemetry" | Open standard for traces, metrics, logs |
| GenAI semconv | "GenAI semantic conventions" | Stable attribute names for LLM / tool / agent spans |
| `gen_ai.*` | "The attribute namespace" | All GenAI attributes share this prefix |
| Span | "Timed operation" | A unit of work with a start, end, and attributes |
| Trace | "Cross-span ancestry" | Tree of spans sharing a trace id |
| SpanKind | "CLIENT / SERVER / INTERNAL" | Hints about span direction |
| OTLP | "OpenTelemetry Protocol" | Wire format for exporters |
| Opt-in content | "Prompt / completion capture" | Off by default; env var to enable |
| traceparent | "W3C header" | Propagates trace context across services |
| Exporter | "Backend-specific shipper" | Component that sends spans to Jaeger / Datadog / etc. |

## Đọc thêm

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) các quy ước kinh điển cho các phạm vi, métrics và sự kiện của GenAI
- [OpenTelemetry — GenAI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) Danh sách các thuộc tính của LLM và thời gian thực hiện công cụ
- [OpenTelemetry — GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) cấp đại lý `invoke_agent`span
- [open-telemetry/semantic-conventions — GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) Nguồn tin được lưu trữ trên GitHub
- [Datadog — LLM OTel semantic convention](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) Lối tích hợp sản xuất
