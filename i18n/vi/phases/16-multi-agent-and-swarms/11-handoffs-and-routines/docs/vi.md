# Handoffs và Routines  Phong nhạc vô quốc tịch

> OpenAI Swarm ( Tháng 10 năm 2024) đã chưng cất dàn nhạc đa đại lý cho hai nguyên thủy: **routines**(các hướng dẫn + công cụ như một lời nhắc hệ thống) và **handoffs**(một công cụ đưa một nhân viên khác về). Không có máy nhà nước, không có DSL nhánh  các tuyến LLM bằng cách gọi công cụ giao hàng đúng. OpenAI Agents SDK (March 2025) là kế thừa sản xuất. Swarm chính nó vẫn là tham chiếu khái niệm sạch nhất  toàn bộ nguồn của nó phù hợp với một vài trăm dòng. Mô hình này là viral bởi vì bề mặt API là "agent = prompt + tools; handoff = function returning agent".

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Vấn đề

Mỗi framework đa đại lý muốn bạn học được DSL của nó: Lớp nối LangGraph và cạnh, CrewAI và nhiệm vụ, AutoGen GroupChat và quản lý. DSL là trừu tượng thực sự, nhưng chúng làm cho việc cảm thấy nặng hơn nó cần phải là.

Swarm đẩy theo hướng ngược lại: sử dụng khả năng gọi công cụ mà mô hình đã có. Handoffs trở thành gọi công cụ.

## Khái niệm

### Hai nguyên thủy

**Routine.**Một lệnh hệ thống xác định vai trò của một đại lý và các công cụ có sẵn. Hãy nghĩ về nó như một bộ hướng dẫn có mục tiêu: "bạn là một đại lý phân loại; nếu người dùng hỏi về hoàn lại, hãy giao cho đại lý hoàn lại".

**Handoff.**Một công cụ mà đại lý có thể gọi mà trả về một đối tượng mới của đại lý. thời gian chạy Swarm phát hiện giá trị trả về của đại lý và chuyển đổi đại lý hoạt động cho lượt tiếp theo.

Đó là toàn bộ sự trừu tượng.

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

Các thông báo hệ thống của đại lý phân loại cho phép nó chọn giao hàng đúng dựa trên thông điệp của người dùng.

### Tại sao nó là virus

- **Small API.**Hai khái niệm cần học.
- **Uses what the model already does.**Việc gọi công cụ đã được cấp sản xuất trên các nhà cung cấp.
- **No state-machine burden.**Bạn không mô tả biểu đồ; các thông báo của các đại lý mô tả họ giao cho ai.

### Thương mại vô quốc tịch

Swarm là một hệ thống không có chính sách giữa các lần chạy. Framework lưu trữ lịch sử tin nhắn trong một lần chạy, nhưng nó không tồn tại bất cứ điều gì.

Trong sản xuất (OpenAI Agents SDK, tháng 3 năm 2025) đây là một trong những điều chính đã thay đổi: SDK thêm vào quản lý phiên tích hợp, hàng rào và theo dõi trong khi giữ cho giao hàng nguyên thủy.

### Khi Swarm/Handoffs phù hợp

- **Triage patterns.**Các đại lý hàng đầu sẽ đưa người dùng đến một chuyên gia.
- **Skill-based handoffs.**"Nếu nhiệm vụ cần mã, hãy gọi cho người lập mã; nếu nó cần nghiên cứu, hãy gọi cho nhà nghiên cứu".
- **Short, bounded conversations.**Hỗ trợ khách hàng, FAQ-to-ticket, các quy trình làm việc đơn giản.

### Khi Swarm đấu tranh

- **Long sessions with shared memory.**Handoffs đặt lại trạng thái cuộc trò chuyện vào lịch sử liên tục của nhân viên mới.
- **Parallel execution.**Handoff là một lần trong một thời gian  các chuyển đổi của đại lý hoạt động.
- **Audit and replay.**Các chạy không có quốc tịch khó để chơi lại chính xác; sự lựa chọn của LLM không xác định.

### OpenAI Agents SDK (March 2025)

Người kế nhiệm sản xuất thêm:

- **Session state.**Dòng liên tục qua các đường.
- **Guardrails.**Các cái nát xác nhận đầu vào/phản xuất.
- **Tracing.**Mọi cuộc gọi và giao hàng đều được ghi lại.
- **Handoff filters.**Kiểm soát những gì chuyển ngữ cảnh khi giao tiếp.

Việc giao tiếp nguyên thủy tồn tại; ergonomics sản xuất được thêm vào xung quanh nó.

### Swarm vs GroupChat

Cả hai đều sử dụng định tuyến LLM, nhưng chúng khác nhau về **who picks next**- Có thể là:

- GroupChat: một người chọn ( chức năng hoặc LLM) chọn người phát biểu tiếp theo từ bên ngoài.
- Swarm: đại lý hiện tại chọn người kế vị của mình bằng cách gọi một công cụ chuyển giao.

Swarm là "nhà quyết định những gì tiếp theo"; GroupChat là "hành trướng quyết định những gì tiếp theo". Quyết định của Swarm sống trong cuộc gọi công cụ của đại lý hoạt động; GroupChat sống trong `GroupChatManager`- Tôi không biết.

```figure
sw-handoff-routing
```

## Hãy xây dựng nó

`code/main.py`thực hiện Swarm từ đầu: một lớp dữ liệu Agent, một cơ chế chuyển giao (công cụ trả lại Agent), và một vòng chạy phát hiện các chuyển đổi agent.

Demo: một đại lý phân loại các tuyến đường để hoàn lại, bán hàng hoặc hỗ trợ các chuyên gia. Mỗi chuyên gia có công cụ riêng của mình.

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

## Sử dụng nó

`outputs/skill-handoff-designer.md`thiết kế một topology handoff cho một nhiệm vụ nhất định: những đại lý nào tồn tại, những handoff nào họ có thể gọi, những chuyển giao ngữ cảnh nào.

## Chuyển nó

Danh sách kiểm tra:

- **Handoff logging.**Mỗi giao hàng viết ra một sự kiện theo dõi với từ đại lý, đến đại lý, khung cảnh snapshot.
- **Context transfer rules.**Quyết định chuyển động nào trên giao hàng: lịch sử đầy đủ (chi phí tốn kém), tin nhắn N cuối cùng, hoặc một tóm tắt.
- **Guardrail on handoff.**Việc giao cho một chuyên gia có quyền công cụ khác nhau phải được xác thực  nếu không, tiêm nhanh có thể buộc phải giao không mong muốn.
- **Loop detection.**Hai đại lý chuyển về phía trước và về phía sau là một thất bại phổ biến; phát hiện bằng một kiểm tra vòng cuối cùng-K đơn giản.
- **Fallback agent.**Nếu mục tiêu giao không tồn tại, hãy quay lại một mục tiêu không được giao.

## Các bài tập

1. Đi chạy`code/main.py`Hãy xác nhận người hoạt động của vòng hai đã hoàn lại tiền.
2. Thêm một quy tắc phát hiện vòng: nếu hai đại lý tương tự đã giao 3 lần liên tiếp, buộc một lối thoát. Thiết kế sự lùi.
3. Đọc các tài liệu SDK của OpenAI Agents về bộ lọc giao hàng. Thực hiện một phiên bản "summary-on-handoff": đại lý ra đi nén bối cảnh thành một bản tóm tắt đạn trước khi đại lý tiếp theo tiếp quản.
4. So sánh giao dịch Swarm với một chọn GroupChatManager.
5. Đọc sách nấu ăn của Swarm (https://developers.openai.com/cookbook/examples/orchestrating_agents). Định danh một quyết định thiết kế rõ ràng Swarm làm cho OpenAI Agents SDK thay đổi hoặc giữ lại.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routine | "The agent prompt" | System prompt + tool list. Defines role and available handoffs. |
| Handoff | "Transfer to another agent" | A tool the active agent can call that returns a new Agent. The runtime switches active agent. |
| Stateless | "No memory between runs" | Swarm does not persist anything; memory is the caller's responsibility. |
| Active agent | "Who's speaking now" | The agent currently holding the conversation. Handoff changes this. |
| Context transfer | "What moves on handoff" | Policy for what history the incoming agent sees: full, last N, or summarized. |
| Handoff loop | "Agents ping-pong" | Failure mode where two agents keep handing back to each other. |
| OpenAI Agents SDK | "Production Swarm" | March 2025 successor; adds sessions, guardrails, tracing on top of the handoff primitive. |
| Handoff filter | "Gate on transfer" | SDK feature to inspect and modify context at the handoff boundary. |

## Đọc thêm

- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) câu nói tham chiếu
- [OpenAI Swarm repo](https://github.com/openai/swarm) thực hiện ban đầu, được giữ như một tham chiếu khái niệm
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) người kế nhiệm sản xuất với các buổi và theo dõi
- [Anthropic handoff-in-Claude notes](https://docs.anthropic.com/en/docs/claude-code) cách các subagents Claude Code sử dụng mô hình như giao hàng qua `Task`
