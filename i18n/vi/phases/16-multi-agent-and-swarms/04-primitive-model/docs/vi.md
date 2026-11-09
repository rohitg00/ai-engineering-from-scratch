# Mô hình nguyên thủy đa tác nhân

> Bốn nguyên thủy, không có gì hơn  đại lý, giao hàng, trạng thái chia sẻ, nhạc cụ  trải dài một không gian thiết kế bốn chiều, và các khung đa đại lý lớn được vận chuyển vào năm 2026 (AutoGen, LangGraph, CrewAI, OpenAI Agents SDK, Microsoft Agent Framework) là điểm trong đó. Bài học này xây dựng chúng từ 0, chạy một hệ thống đồ chơi trên tất cả bốn, sau đó lập bản đồ tất cả các khung chính trên cùng một trục để bạn có thể đọc bất kỳ phát hành mới trong một đoạn.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 (Agent Engineering), Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## Vấn đề

Mỗi sáu tháng một khung đa đại lý mới được xuất hiện. AutoGen vào năm 2023. CrewAI vào năm 2024. LangGraph và OpenAI Swarm vào năm 2024. Google ADK vào tháng 4 năm 2025. Microsoft Agent Framework RC vào tháng 2 năm 2026. Mỗi thông cáo báo chí tuyên bố là "sự trừu tượng đúng".

Nếu bạn cố gắng học chúng một lần một, bạn sẽ bị cháy. các API trông khác nhau. Các tài liệu không đồng ý về "agent" là gì. Một khung gọi bộ nhớ chia sẻ của nó là "blackboard", một cái gọi là "bể tin nhắn", một cái gọi là "StateGraph". Bạn bắt đầu nghi ngờ rằng lĩnh vực chỉ là thổi thùng.

Không, dưới nền tảng tiếp thị, bốn nguyên thủy đều ổn định. Hãy học chúng một lần, đọc từng khung mới trong một đoạn.

## Khái niệm

### Bốn nguyên thủy

1. **Agent** một hệ thống nhắc cộng với một danh sách công cụ. Không quốc tịch; mỗi chạy bắt đầu từ hệ thống nhắc và lịch sử tin nhắn hiện tại.
2. **Handoff** chuyển giao kiểm soát được cấu trúc từ một đại lý sang một đại lý khác.
3. **Shared state** bất kỳ cấu trúc dữ liệu nào mà nhiều đại lý có thể đọc (thỉnh thoảng viết).
4. **Orchestrator** người nào quyết định ai nói tiếp theo. Các tùy chọn: một biểu đồ rõ ràng (định nghĩa), một trình chọn loa LLM (mềm), cuộc gọi giao tiếp của người nói cuối cùng (OpenAI Swarm), hoặc một trình lập lịch trên một hàng (kiến trúc swarm).

Đó là toàn bộ không gian thiết kế. Mỗi khung chọn các mặc định cho mỗi trục; phần còn lại là tổng hợp bề mặt.

### Làm thế nào mỗi khung 2026 được lập bản đồ

| Framework | Agent | Handoff | Shared state | Orchestrator |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | tool returns Agent | caller's problem | the LLM's next handoff call |
| AutoGen v0.4 / AG2 | `ConversableAgent` | speaker-selector on GroupChat | message pool | selector function (LLM or round-robin) |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Task outputs chained | manager LLM or static order |
| LangGraph | node function | graph edge + condition | `StateGraph` reducer | the graph, deterministic |
| Microsoft Agent Framework | agent + orchestration patterns | pattern-specific | thread / context | pattern-specific |
| Google ADK | agent + A2A card | A2A task | A2A artifacts | host decides |

Sự khác biệt bề mặt trông rất lớn.

### Tại sao điều này quan trọng

Khi bạn thấy các nguyên thủy, so sánh khung trở thành một danh sách kiểm tra ngắn:

- Người tổ chức có tin tưởng LLM để định tuyến (Swarm) hay nó pin định tuyến trong mã (LangGraph)?
- Có chia sẻ toàn bộ lịch sử trạng thái (GroupChat) hay dự đoán (StateGraph reducer)?
- Các đại lý có thể sửa đổi các yêu cầu của nhau (các người quản lý CrewAI) hay chỉ giao tay (Swarm)?

Ba câu hỏi đó trả lời 80% khung nào phù hợp với một vấn đề nhất định. Bạn ngừng mua "quang khung đa đại lý tốt nhất" và bắt đầu thiết kế cho trục bạn thực sự quan tâm.

### Sự hiểu biết vô quốc gia

Tất cả nguyên thủy ngoại trừ trạng thái chia sẻ là không có quốc gia. Agent là một hàm của (quick, công cụ). Handoff là một hàm gọi. Orchestrator là một lập trình. **The only stateful thing in the system is shared state.**Đó là nơi mà tất cả những lỗi thú vị sống: ngộ độc trí nhớ (Dạy học 15), sắp xếp tin nhắn, phiên bản, viết tranh cãi.

Các khung hình che giấu trạng thái chia sẻ (Swarm) đẩy vấn đề đến người gọi. Các khung hình tập trung nó (LangGraph checkpoint, AutoGen pool) làm cho nó có thể kiểm tra nhưng chuyển chi phí phối hợp vào việc thực hiện trạng thái chia sẻ.

### Phân tích của một nguyên thủy duy nhất

#### - Trưởng lý.

```
Agent = (system_prompt, tools, model, optional_name)
```

Không bộ nhớ, không trạng thái, hai đại lý với cùng một hệ thống thông báo và công cụ là có thể thay đổi, mọi thứ trông giống như trạng thái mỗi đại lý thực sự là trong trạng thái chia sẻ hoặc giao thức giao tiếp.

#### Chuyển

```
Handoff = (from_agent, to_agent, reason, payload)
```

Ba thực hiện thống trị:

- **Function return** công cụ trả lại đại lý tiếp theo. Đây là mô hình OpenAI Swarm. Các đại lý mang theo định tuyến trong các sơ đồ công cụ của họ.
- **Graph edge** LangGraph. Các cạnh là tuyên bố. LLM tạo ra một giá trị; một điều kiện chọn nút tiếp theo.
- **Speaker selection** AutoGen GroupChat. Một chức năng chọn lọc (đôi khi chính nó là cuộc gọi LLM) đọc hồ bơi và chọn người nói tiếp theo.

#### Nhà nước chung

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

Ít nhất, một danh sách các tin nhắn. Thông thường hơn: các vật thể có cấu trúc (các sản phẩm của CrewAI Task), ngữ cảnh được gõ (đảm độ LongGraph), bộ nhớ bên ngoài (MCP, vector DB).

Hai topology: **full pool**(mỗi nhân viên đều thấy mọi tin nhắn) và **projected**(các đại lý xem một khung hình vai trò). các hồ bơi đầy đủ là đơn giản và quy mô không tốt. các hồ bơi dự kiến quy mô nhưng yêu cầu thiết kế sơ đồ trước.

#### Nhà dàn nhạc

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

Bốn hương vị:

- **Static** biểu đồ được cố định tại thời gian xây dựng (LangGraph xác định, CrewAI theo trình tự).
- **LLM-selected** một LLM đọc hồ bơi và chọn người nói tiếp theo (AutoGen, CrewAI Hierarchical).
- **Handoff-driven** đại lý hiện tại quyết định bằng cách gọi một công cụ giao hàng (Swarm).
- **Queue-driven** công nhân kéo ra khỏi một hàng đợi chung; không có loa tiếp theo rõ ràng (nền kiến trúc đám đông, Matrix).

### Những thay đổi giữa các khung

Một khi nguyên thủy được cố định, các quyết định thiết kế còn lại là:

- **Memory strategy** kiểm tra tạm thời so với kiểm tra bền (chỉ lục LangGraph).
- **Safety boundary** người có thể chấp thuận giao hàng (người trong vòng lặp).
- **Cost accounting** ngân sách token cho mỗi đại lý.
- **Observability** theo dõi giao hàng, duy trì trạng thái để tái phát.

Tất cả đều có thể thực hiện trên những nguyên thủy.

```figure
a5-primitive-radar
```

## Hãy xây dựng nó

`code/main.py`thực hiện bốn nguyên thủy trong ~ 150 dòng stdlib Python. Không có LLM thực sự  mỗi đại lý là một chính sách kịch bản vì vậy trọng tâm vẫn còn trên cấu trúc phối hợp.

Các tập tin xuất khẩu:

- `Agent` một lớp dữ liệu tên, hệ thống prompt, công cụ, chức năng chính sách.
- `Handoff` một hàm trả lại một đại lý mới.
- `SharedState` một hồ chứa thông điệp an toàn.
- `Orchestrator` ba biến thể: `StaticOrchestrator`- `HandoffOrchestrator`- `LLMSelectorOrchestrator`(được mô phỏng).

Demos chạy cùng một đường ống ba đại lý (phát tích → viết → đánh giá) thông qua cả ba loại nhạc cụ và in hồ bơi tin nhắn ở cuối. Bạn có thể thấy rằng các kết quả chỉ khác nhau trong * ai chọn tiếp theo *; các đại lý và trạng thái chia sẻ là giống nhau trên các chạy.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả dự kiến: ba lần chạy nhạc cụ, một lần mỗi mẫu. Mỗi lần in hồ sơ tin nhắn cuối cùng.

## Sử dụng nó

`outputs/skill-primitive-mapper.md`là một kỹ năng đọc bất kỳ cơ sở mã hoặc tài liệu khung đa đại lý nào và trả lại bản đồ bốn nguyên thủy.

## Chuyển nó

Trước khi áp dụng một framework mới, hãy viết bản đồ nguyên thủy cho nó. Nếu bạn không thể, các tài liệu không đầy đủ hoặc framework đang phát minh ra một nguyên thủy thứ năm (đếm  kiểm tra hương vị trạng thái chia sẻ mà bạn không thấy).

Đặt bản đồ vào tài liệu kiến trúc của bạn. Khi một thành viên mới của nhóm tham gia, gửi bản đồ cho họ trước khi các tài liệu API. Khi phiên bản khung thay đổi, thay đổi bản đồ, không phải bản ghi thay đổi.

## Các bài tập

1. Đi chạy`code/main.py`3 lần với các chính sách của các đại lý khác nhau.
2. Thực hiện một loại nhạc công thứ tư: một loại điều khiển hàng rào nơi các đại lý thăm dò chia sẻ tình trạng cho công việc.
3. Hãy lấy LangGraph khởi động nhanh (https://docs.langchain.com/oss/python/langgraph/workflows-agentsPhương pháp đầu tiên của LangGraph là:
4. Đọc sách nấu ăn của OpenAI Swarm (https://developers.openai.com/cookbook/examples/orchestrating_agents). xác định được cái nào trong bốn nguyên thủy Swarm làm cho ergonomic nhất, và cái nào nó đẩy đến người gọi.
5. Tìm một khung trong bảng này mà ẩn hoàn toàn trạng thái chia sẻ. giải thích những gì phá vỡ khi các đại lý cần phối hợp qua giao hàng mà không cần đọc lại lịch sử.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "An LLM with tools" | A `(system_prompt, tools, model)` triple. Stateless. |
| Handoff | "Transfer of control" | A structured call that names the next agent and optional payload. Three implementations: function return, graph edge, speaker selection. |
| Shared state | "Memory" / "context" | The only stateful part of a multi-agent system. Message pool or blackboard. |
| Orchestrator | "Coordinator" | Whoever decides who runs next. Static graph, LLM selector, handoff-driven, or queue-driven. |
| Primitive | "Abstraction" | One of the four axes every framework parameterizes. Not a framework feature. |
| Message pool | "Shared chat history" | Full-history shared state. Easy to reason about, scales badly. |
| Projected state | "Scoped view" | Role-specific view into shared state. Scales, requires schema design. |
| Speaker selection | "Who talks next" | Orchestrator pattern where a function (often an LLM) picks the next agent from a group. |

## Đọc thêm

- [OpenAI cookbook: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) sự diễn giải rõ ràng nhất của dàn nhạc do tay tay tay
- [AutoGen stable docs](https://microsoft.github.io/autogen/stable/) GroupChat + sự lựa chọn loa là tham chiếu cho dàn nhạc LLM được lựa chọn
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) Phân phối cạnh biểu đồ và trạng thái chia sẻ dựa trên giảm
- [CrewAI introduction](https://docs.crewai.com/en/introduction) các nhân viên vai trò-goal-backstory, quy trình theo trình / Trật tự
- [AG2 (community AutoGen continuation)](https://github.com/ag2ai/ag2) dòng AutoGen v0.2 trực tiếp sau khi Microsoft chuyển v0.4 vào bảo trì
