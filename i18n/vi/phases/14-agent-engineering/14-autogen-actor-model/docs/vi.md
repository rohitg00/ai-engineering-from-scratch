# Mô hình diễn viên cho các đại lý  Thông điệp không đồng bộ và thời gian chạy được đánh dấu

> Các đại lý như các diễn viên: trao đổi tin nhắn không đồng bộ, xử lý các sự kiện, cách ly lỗi, đồng thời tự nhiên. AutoGen v0.4 (Microsoft Research, tháng 1 năm 2025) đã thiết kế lại dàn xếp đại lý xung quanh mô hình này; khung hiện đang trong chế độ bảo trì, với Microsoft Agent Framework (bước xem trước công cộng tháng 10 năm 2025) là người kế nhiệm sản xuất của nó.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~75 minutes

## Mục tiêu học tập

- Mô tả mô hình diễn viên: đại lý như diễn viên, tin nhắn như IPC duy nhất, sự cô lập thất bại cho mỗi diễn viên.
- Tên gọi ba lớp API của AutoGen v0.4  Core, AgentChat, Extensions  và mỗi lớp là gì.
- Giải thích tại sao việc tách thông điệp từ việc xử lý cho phép sự cô lập lỗi và đồng thời tự nhiên.
- Thực hiện một runtime diễn viên stdlib trong Python và chuyển một dòng kiểm tra mã hai đại lý vào nó.

## Vấn đề

Hầu hết các khung đại lý đều đồng bộ: một đại lý sản xuất, một đại lý tiêu thụ, trong một đống gọi. Các thất bại gây ra sự cố.

Câu trả lời của AutoGen v0.4: mô hình diễn viên. Mỗi đại lý là một diễn viên với một hộp thư đến riêng. Thông điệp là tương tác duy nhất. Thời gian chạy tách giao hàng khỏi xử lý. Các thất bại cô lập với một diễn viên. Sự cạnh tranh là bản địa. Phân phối chỉ là giao thông khác nhau.

## Khái niệm

### Các diễn viên

Một diễn viên có:

- Một nhà nước tư nhân (không bao giờ được chạm trực tiếp từ bên ngoài).
- Một hộp thư đến (trung thư).
- Một người quản lý:`receive(message) -> effects`nơi mà hiệu ứng có thể là "đưa trả lời", "đưa cho một diễn viên khác", "đưa ra một diễn viên mới", "được cập nhật trạng thái", "đừng tự".

Hai diễn viên không thể chia sẻ trí nhớ, họ chỉ có thể gửi tin nhắn.

### Ba lớp API

AutoGen v0.4 chia bề mặt thành ba phần:

1. **Core.**Quản lý các diễn viên cấp thấp. `AgentRuntime`- `Agent`- `Message`- `Topic`- Chuyển đổi tin nhắn đồng bộ, dựa trên sự kiện.
2. **AgentChat.**API cấp cao dựa trên nhiệm vụ (đổi thay cho ConversableAgent của v0.2). `AssistantAgent`- `UserProxyAgent`- `RoundRobinGroupChat`- `SelectorGroupChat`- Tôi không biết.
3. **Extensions.**Các tích hợp  OpenAI, Anthropic, Azure, công cụ, bộ nhớ.

### Tại sao việc tách biệt quan trọng

Trong mô hình v0.2, gọi `agent_a.chat(agent_b)`đồng thời chặn agent_a cho đến khi agent_b quay lại.`send(agent_b, msg)`đưa tin vào hộp thư đến của agent_b và trả lại. thời gian chạy đưa ra sau đó. Ba hậu quả:

- **Fault isolation.**Cảnh sát B không bị hỏng Cảnh sát A  thời gian chạy bắt được sự thất bại trong bộ xử lý của B và quyết định phải làm gì (đăng ký, thử lại, thư chết).
- **Natural concurrency.**Nhiều tin nhắn trên máy bay cùng một lúc; các diễn viên xử lý hộp thư đến của họ cùng một lúc.
- **Distribution-ready.**Hộp thư đến + vận chuyển là trừu tượng tương tự cho dù diễn viên đang trong quá trình hoặc trên một máy chủ khác.

### Topology

- **RoundRobinGroupChat.**Các nhân viên thay lượt trong một vòng quay cố định.
- **SelectorGroupChat.**Một đại lý chọn lựa chọn người đi tiếp theo dựa trên bối cảnh cuộc trò chuyện.
- **Magentic-One.**Nhóm quản lý đa đại lý để duyệt web, xử lý mã, xử lý tệp.

### Sự quan sát

OpenTelemetry hỗ trợ được tích hợp. Mỗi tin nhắn phát ra một khoảng thời gian; các cuộc gọi công cụ mang `gen_ai.*`thuộc tính theo các công ước ngữ nghĩa OTel GenAI 2026 (Lớp 23).

### Tình trạng: chế độ bảo trì

Đầu năm 2026: AutoGen v0.7.x ổn định cho nghiên cứu và tạo mẫu. Microsoft đã chuyển phát triển tích cực sang Microsoft Agent Framework, kế nhiệm sản xuất (bước xem trước công khai ngày 1 tháng 10 năm 2025; 1.0 GA được nhắm mục tiêu cho cuối Q1 năm 2026).

```figure
actor-mailbox
```

## Hãy xây dựng nó

`code/main.py`thực hiện một runtime diễn viên stdlib:

- `Message` tải trọng hữu ích được đánh dấu với `sender`- `recipient`- `topic`- `body`- Tôi không biết.
- `Actor` trừu tượng với `receive(message, runtime)`- Tôi không biết.
- `Runtime` vòng lặp sự kiện với hàng đợi chung, giao hàng, cách ly thất bại.
- Một bản demo hai diễn viên:`ReviewerAgent`mã đánh giá, `ChecklistAgent`chạy một danh sách kiểm tra; họ trao đổi tin nhắn cho đến khi đồng thuận.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Hướng dẫn cho thấy giao thông thông tin, một sự thất bại mô phỏng trong một diễn viên mà không gây ra sự sụp đổ của người khác, và sự hội tụ trên một phán quyết chung.

## Sử dụng nó

- **AutoGen v0.4/v0.7**(hỗ trợ)  ổn định cho nghiên cứu, tạo ra nguyên mẫu, nhiều tác nhân mô hình.
- **Microsoft Agent Framework** kế thừa sản xuất (bước xem trước công khai vào tháng 10 năm 2025); cùng một ý tưởng diễn viên-chương mẫu trong một API được cập nhật.
- **LangGraph swarm topology**(Dạy 13)  mô hình tương tự qua việc trao đổi công cụ chung.
- **Custom actor runtime** khi bạn cần vận chuyển cụ thể (NATS, RabbitMQ, gRPC).

## Chuyển nó

`outputs/skill-actor-runtime.md`tạo ra thời gian chạy diễn viên tối thiểu cộng với một mẫu nhóm (RoundRobin hoặc Selector) cho một nhiệm vụ đa đại lý nhất định.

## Các bài tập

1. Thêm một hàng chữ cái chết: khi một người xử lý nâng lên, hãy đậu thông điệp thất bại để kiểm tra của con người.
2. Thực hiện`SelectorGroupChat`: một diễn viên chọn chọn người xử lý thông điệp tiếp theo dựa trên trạng thái trò chuyện.
3. Thêm vận chuyển phân tán: thay thế hàng trong quá trình cho một máy chủ JSON-over-HTTP để các diễn viên có thể chạy trong các quá trình riêng biệt.
4. Đưa ra một khoảng thời gian OTel cho mỗi tin nhắn (hoặc một không có hoạt động thay thế).`gen_ai.agent.name`- `gen_ai.operation.name`Mỗi bài học 23.
5. Đọc bài viết về kiến trúc của AutoGen v0.4.`autogen_core`API, anh bỏ qua điều gì quan trọng trong sản xuất?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Actor | "Agent" | Private state + inbox + handler; no shared memory |
| Message | "Event" | Typed payload; the only way actors interact |
| Inbox | "Mailbox" | Per-actor queue of pending messages |
| Runtime | "Agent host" | Event loop that routes messages and isolates failures |
| Topic | "Channel" | Named publish-subscribe route between actors |
| Fault isolation | "Let it crash" | One actor failing does not crash others |
| RoundRobinGroupChat | "Fixed-rotation team" | Agents take turns in order |
| SelectorGroupChat | "Context-routed team" | Selector picks who goes next |
| Magentic-One | "Reference team" | Multi-agent squad for web + code + files |

## Đọc thêm

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) bài thiết kế lại
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) thay thế hình đồ thị
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) kéo dài AutoGen phát ra theo mặc định
