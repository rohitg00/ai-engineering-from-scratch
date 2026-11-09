# OpenAI Agents SDK: Handoffs, Guardrails, Tracing

> OpenAI Agents SDK là framework đa đại lý nhẹ được xây dựng dựa trên API Responses. Năm nguyên thủy: Agent, Handoff, Guardrail, Session, Tracing. Handoffs là các công cụ có tên `transfer_to_<agent>`- Đường dây bảo vệ bị hỏng khi nhập hoặc ra.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## Mục tiêu học tập

- Hãy nêu tên năm nguyên thủy của OpenAI Agents SDK.
- Giải thích các giao hàng: tại sao chúng được mô hình hóa như là công cụ, hình dạng tên nào mà mô hình nhìn thấy và cách chuyển ngữ cảnh.
- Hóa ra sự khác biệt giữa các cửa hàng đầu vào, cửa hàng đầu ra và cửa hàng công cụ; giải thích `run_in_parallel`với chế độ chặn.
- Thực hiện thời gian chạy stdlib với giao hàng + ván bảo vệ + theo dõi theo kiểu span.

## Vấn đề

Các đại lý không thể ủy thác sạch sẽ cuối cùng là lấp đầy mọi thứ trong một prompt. Các đại lý không có hàng rào gửi PII, sản xuất vi phạm chính sách, hoặc vòng lặp mãi mãi. SDK của OpenAI mã hóa ba nguyên thủy làm cho việc đa đại lý dễ xử lý.

## Khái niệm

### 5 nguyên thủy

1. **Agent.**LLM + hướng dẫn + công cụ + giao hàng.
2. **Handoff.**Đưa đại diện cho một đại lý khác.`transfer_to_<agent_name>`- Tôi không biết.
3. **Guardrail.**Thiết lập bằng chứng khi nhập (chỉ là đại lý đầu tiên), xuất (chỉ là đại lý cuối cùng) hoặc gọi công cụ (bằng công cụ chức năng).
4. **Session.**Lịch sử trò chuyện tự động qua các vòng.
5. **Tracing.**Các hệ thống tích hợp cho LLM, gọi công cụ, giao hàng, che chở.

### Giúp như là công cụ

Mô hình thấy `transfer_to_billing_agent`Địa chỉ cho nó báo hiệu thời gian chạy đến:

1. Tải lại ngữ cảnh cuộc trò chuyện (hoặc phá vỡ nó qua `nest_handoff_history`beta).
2. Đưa ra lệnh cho tác nhân mục tiêu.
3. Cứ tiếp tục chạy với nhân viên mục tiêu.

Đây là mô hình giám sát (Dạy học 13 / Dạy học 28) được sản xuất.

### Đường dây bảo vệ

Ba hương vị:

- **Input guardrails.**Hãy chạy theo thông tin của đại lý đầu tiên, từ chối các yêu cầu không an toàn hoặc ngoài phạm vi trước khi gọi LLM.
- **Output guardrails.**Đi vào nguồn gốc của nhân viên cuối cùng, bắt được thông tin cá nhân rò rỉ, vi phạm chính sách, phản ứng sai.
- **Tool guardrails.**Đánh thành công cụ tính năng, xác nhận lập luận, kiểm tra quyền, thực hiện kiểm toán.

Phương thức:

- **Parallel**(tầm định). Guardrail LLM chạy cùng với LLM chính.
- **Blocking**(`run_in_parallel=False`Guardrail LLM chạy trước, nếu bị ngã, không có token bị lãng phí trong cuộc gọi chính.

Cáp ba nâng lên `InputGuardrailTripwireTriggered`- `OutputGuardrailTripwireTriggered`- Tôi không biết.

### Theo dõi

Mỗi thế hệ LLM, công cụ gọi, giao, và guardrail phát ra một span. `OPENAI_AGENTS_DISABLE_TRACING=1`- Anh chọn ra.`add_trace_processor(processor)`Fan trải dài đến phần sau của bạn cùng với OpenAI.

### Các buổi

`Session`lưu trữ lịch sử cuộc trò chuyện trong một backend (SQLite, Redis, tùy chỉnh). `Runner.run(agent, input, session=session)`tự động tải và phụ kiện.

### Khi mô hình này đi sai

- **Handoff drift.**Cảnh sát A đưa tay sang Cảnh sát B, người trả lại cho Cảnh sát A. Thêm một bộ đếm hop.
- **Guardrail bypass.**Các cửa sổ bảo vệ công cụ chỉ bắn vào các công cụ chức năng; các công cụ tích hợp (đọc tập tin, lấy web) cần chính sách riêng biệt.
- **Over-tracing.**Nội dung nhạy cảm trong khoảng thời gian. Kết hợp với các quy tắc chụp nội dung OTel GenAI (Dạy học 23)  lưu trữ bên ngoài, tham chiếu bằng ID.

```figure
ae-agent-handoff
```

## Hãy xây dựng nó

`code/main.py`thực hiện hình dạng SDK trong stdlib:

- `Agent`- `FunctionTool`- `Handoff`(như một công cụ chức năng với ngữ nghĩa chuyển giao).
- `Runner`Với đường dây bảo vệ đầu vào/cởi ra/các công cụ, giao hàng và máy tính đếm hop.
- Một máy phát xạ dài đơn giản để cho thấy hình dạng dấu vết.
- Một đại lý phân loại cung cấp cho hóa đơn hoặc hỗ trợ dựa trên truy vấn của người dùng; Guardrail đi trên một đầu vào.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Hình ảnh cho thấy hai lần giao hàng thành công, một chuyến đi vào đường dây bảo vệ và một cây tròn phản ánh những gì SDK thực sự phát ra.

## Sử dụng nó

- **OpenAI Agents SDK**cho các sản phẩm OpenAI đầu tiên.
- **Claude Agent SDK**(Dân học 17) cho các sản phẩm Claude-first.
- **LangGraph**(Dân học 13) khi bạn muốn có một trạng thái rõ ràng và một hồ sơ lâu dài.
- **Custom**khi bạn cần kiểm soát chính xác (những dịch vụ bằng giọng nói, nhiều nhà cung cấp, các dịch vụ liên bang).

## Chuyển nó

`outputs/skill-agents-sdk-scaffold.md`Đặt một ứng dụng SDK của Agents với một đại lý phân loại, giao hàng, cửa sổ đầu vào/ ra ngoài/ công cụ, cửa hàng phiên và bộ xử lý theo dõi.

## Các bài tập

1. Thêm một con số chuyển giao: từ chối sau khi chuyển giao N. Theo dõi hành vi.
2. Thực hiện`nest_handoff_history`tùy chọn  kết hợp các thông điệp trước đó thành một bản tóm tắt trước khi chuyển.
3. Hãy so sánh độ trễ của các lệnh sẽ làm nó bị cản trở so với những lệnh mà đi qua.
4. Sợi dây`add_trace_processor`để ghi nhật ký JSON. hình dạng nào nó phát ra cho mỗi khoảng thời gian?
5. Đọc các tài liệu SDK. Đưa đồ chơi SDLIB của bạn vào `openai-agents-python`- Cậu làm sai mô hình gì?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "LLM + instructions" | Agent type in the SDK; owns tools and handoffs |
| Handoff | "Transfer" | Tool the model calls to delegate to another agent |
| Guardrail | "Policy check" | Validation on input / output / tool invocation |
| Tripwire | "Guardrail trip" | Exception raised when guardrail rejects |
| Session | "History store" | Conversation memory persisted between runs |
| Tracing | "Spans" | Built-in observability over LLM + tool + handoff + guardrail |
| Blocking guardrail | "Sequential check" | Guardrail runs first; no token waste on trip |
| Parallel guardrail | "Concurrent check" | Guardrail runs alongside; lower latency, wastes tokens on trip |

## Đọc thêm

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) nguyên thủy, giao hàng, đường dây bảo vệ, theo dõi
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) Phương đối tác có hương vị Claude
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) khi nào để tiếp cận cho các giao hàng
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) các SDK đại lý tiêu chuẩn trải dài từ bản đồ đến
