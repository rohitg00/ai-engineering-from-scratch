# Các giao dịch cơ bản của đại lý  Hình ảnh, vai trò và dàn nhạc diễn viên

> Mỗi framework bán cùng một demo (nhà nghiên cứu xây dựng một báo cáo) và ẩn cùng một lỗi (chế hoạch trạng thái chiến đấu với lớp dàn xếp). Chọn framework có trừu tượng phù hợp với hình dạng của vấn đề của bạn; tất cả những thứ khác là dán bạn viết hai lần.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 16 (LangGraph)
**Time:** ~45 minutes

## Vấn đề

Bạn có một nhiệm vụ cần nhiều hơn một cuộc gọi LLM. Có thể đó là một dòng công việc nghiên cứu (kế hoạch, tìm kiếm, tóm tắt, trích dẫn). Có thể đó là một đường ống sửa đổi mã (đánh phân, phê bình, sửa chữa, xác nhận). Có thể đó là một trợ lý đa lượt ghi lại các chuyến bay, viết email và lưu trữ báo cáo chi phí. Bạn chọn một khung.

Ba ngày sau, bạn phát hiện ra các sự rò rỉ của khung trừu tượng. CrewAI cho bạn vai trò nhưng chiến đấu với bạn khi "nhà nghiên cứu" cần phải trao một kế hoạch có cấu trúc cho "nhà viết". AutoGen cho bạn trò chuyện giữa các đại lý nhưng không có trạng thái hạng nhất vì vậy điểm kiểm soát của bạn là một nhựa nhựa của một nhật ký trò chuyện. LangGraph đưa ra một biểu đồ trạng thái nhưng buộc bạn phải đặt tên cho mỗi chuyển đổi trước khi bạn biết đại lý sẽ làm gì. Agno cho bạn một bản trừu tượng đơn đại lý mà thét lên khi bạn cố gắng phát triển ra ba công nhân đồng thời.

Giải pháp không phải là "chọn khung tốt nhất". Nó là để phù hợp với bản trừu tượng cốt lõi của khung với hình dạng của vấn đề của bạn. Bài học này vẽ bản đồ đó.

## Khái niệm

![Agent framework matrix: core abstraction vs problem shape](../assets/framework-matrix.svg)

Bốn khung thống trị phong cảnh năm 2026.

| Framework | Core abstraction | Best fit | Worst fit |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph` — typed state, nodes, conditional edges, checkpointer. | Workflows with explicit state and human-in-the-loop interrupts; production agents needing time-travel debugging. | Loose, role-driven brainstorming where the topology is unknown. |
| **CrewAI** | `Crew` — roles (goal, backstory), tasks, process (sequential or hierarchical). | Role-playing or persona-driven workflows with a short linear/hierarchical plan. | Anything stateful beyond the crew's turn history; complex branching. |
| **AutoGen** | `ConversableAgent` pair — two or more agents that speak in turns until an exit condition. | Multi-agent *dialogue* (teacher-student, proposer-critic, actor-reviewer) where the thinking emerges from the chat. | Deterministic workflows with a known DAG; anything needing durable state across restarts. |
| **Agno** | `Agent` — a single LLM + tools + memory, composable into teams. | Fast-to-build single agents and lightweight teams; strong multi-modality and built-in storage drivers. | Deep, explicitly-branched graphs with custom reducers. |

### "Từ trừu tượng" thực sự có nghĩa là gì

Sự trừu tượng cốt lõi của một framework là thứ bạn vẽ trên bảng màu khi bạn đưa ra kiến trúc.

- **LangGraph**→ bạn vẽ một biểu đồ. nút là bước, cạnh là chuyển tiếp, và đối tượng trạng thái ở mỗi điểm được gõ. mô hình tâm lý là một máy trạng thái.
- **CrewAI**→ bạn vẽ một biểu đồ tổ chức. Mỗi vai trò có mô tả công việc và một người quản lý hướng các nhiệm vụ. mô hình tâm lý là một nhóm nhỏ các chuyên gia.
- **AutoGen**2 đại lý nhắn tin với nhau; một đại lý thứ ba gia nhập nếu bạn cần một người điều hành. Mô hình tâm lý là trò chuyện.
- **Agno**→ bạn vẽ một hộp đơn với các công cụ treo trên nó. đặt các hộp cạnh nhau cho một đội. mô hình tâm lý là "đồng hành với pin bao gồm".

### Câu hỏi nhà nước

Nhà nước là nơi mà hầu hết các lựa chọn khung bị phá vỡ trong sản xuất.

- **LangGraph.**Tiêu chuẩn trạng thái (`TypedDict`hoặc mô hình Pydantic), giảm per-field, điểm kiểm tra hạng nhất (SQLite/Postgres/Redis).
- **CrewAI.**Các dòng nước như các chuỗi giữa các nhiệm vụ qua `context`trường, hoặc cấu trúc qua `output_pydantic`Không có cửa hàng bền bỉ cho mỗi thủy thủ đoàn ra khỏi hộp; bạn tự mình đi nếu thủy thủ đoàn phải sống sót sau khi khởi động lại.
- **AutoGen.**State là lịch sử trò chuyện và bất kỳ người dùng xác định `context`. Các bản sao cuộc trò chuyện vẫn tồn tại; trạng thái workflow tùy ý không làm được trừ khi bạn viết bộ chuyển đổi.
- **Agno.**Các trình điều khiển lưu trữ tích hợp (SQLite, Postgres, Mongo, Redis, DynamoDB) được gắn vào một `Agent`qua `storage=` các phiên trò chuyện và ký ức người dùng tồn tại tự động. Không phải một điểm kiểm tra đồ thị đầy đủ; một cửa hàng phiên.

### Câu hỏi về phân nhánh

Tất cả các đại lý không nhỏ đều là những chi nhánh, những người quyết định những vấn đề.

- **LangGraph** bạn quyết định, thông qua các cạnh có điều kiện. Routing là một hàm Python với tên chi nhánh. Chi nhánh là lớp đầu tiên trong biểu đồ được biên soạn; điểm kiểm tra ghi lại chi nhánh nào đã được lấy.
- **CrewAI** người quản lý quyết định trong chế độ phân cấp; trong chế độ theo dõi bạn quyết định tại thời gian xây dựng. Routing là ngầm trong danh sách nhiệm vụ; không có "nếu" hạng nhất bên ngoài lời nhắc của người quản lý.
- **AutoGen** các đại lý quyết định qua trò chuyện.`GroupChatManager`chọn người phát biểu tiếp theo; bạn có thể viết tay một `speaker_selection_method`nhưng mặc định là LLM-driven.
- **Agno** đại lý quyết định công cụ nào để gọi tiếp theo.

### Câu hỏi khả năng quan sát

- **LangGraph** OpenTelemetry thông qua LangSmith hoặc bất kỳ nhà xuất khẩu OTel nào. Mỗi chuyển đổi nút là một khoảng thời gian theo dõi; các điểm kiểm soát gấp đôi như các dấu vết có thể chơi lại. LangSmith là tùy chọn bên đầu tiên; Langfuse / Phoenix cũng có bộ điều chỉnh.
- **CrewAI** OpenTelemetry hạng nhất kể từ cuối năm 2025; tích hợp với Langfuse, Phoenix, Opik, AgentOps.
- **AutoGen** Tích hợp OpenTelemetry thông qua `autogen-core`- AgentOps và Opik có các kết nối.
- **Agno** tích hợp `monitoring=True`cờ cộng với các nhà xuất khẩu OpenTelemetry; tích hợp chặt chẽ với Langfuse cho các dấu vết phiên.

### Chi phí và thời gian trễ

Tất cả bốn khung đều thêm chi phí chung mỗi cuộc gọi (điều logic khung, xác thực, phân phối hàng loạt).`GroupChatManager`LangGraph chỉ dùng token khi bạn viết.`llm.invoke`Con đường của Agno chỉ đơn độc là mỏng.

Khi chi phí cho mỗi chạy quan trọng, thích định tuyến rõ ràng (LangGraph edges, AutoGen `speaker_selection_method`) trên LLM chọn đường dẫn.

### Sự tương tác

- **LangGraph** **LangChain**Công cụ, máy lấy lại, LLM. Cấu hình MCP hạng nhất (các công cụ được nhập khẩu như máy chủ MCP).
- **CrewAI** các công cụ thừa kế từ `BaseTool`; Các công cụ LangChain, các công cụ LlamaIndex và các công cụ MCP đều thích nghi.`allow_delegation=True`- Tôi không biết.
- **AutoGen**→ `FunctionTool`bao bọc bất kỳ Python có thể gọi; chuyển đổi MCP có sẵn. kết nối chặt chẽ với hệ sinh thái AG2 cho các mô hình đại lý đến đại lý.
- **Agno**→ `@tool`thiết kế trang trí hoặc phân loại BaseTool; bộ điều chỉnh MCP; các công cụ có thể được chia sẻ giữa các đại lý và nhóm.

## Khả năng

> Bạn có thể giải thích, trong một câu, tại sao một khung nhất định là phù hợp với một vấn đề đặc vụ nhất định.

Danh sách kiểm tra trước khi xây dựng:

1. **Draw the shape.**Đây là một biểu đồ (tiêu trạng thái, tên chuyển đổi), một trò chơi vai trò (người chuyên gia giao công việc), một trò chuyện (nhà nhân nói chuyện cho đến khi hoàn thành), một đại lý duy nhất với công cụ?
2. **Decide who branches.**Các phân nhánh được quyết định bởi nhà phát triển → LangGraph. Manager-agent-decided → CrewAI hierarchical. Chat-emergent → AutoGen. Tool-call-decided → Agno.
3. **Check the state budget.**Bạn cần tiếp tục từ điểm kiểm tra? Du lịch thời gian? Con người gián đoạn giữa chạy? Nếu có, LangGraph là mặc định; các phiên Agno bao gồm trạng thái được mở rộng bằng cuộc trò chuyện.
4. **Check the cost budget.**Các đường dẫn được chọn bởi LLM chi phí thêm token mỗi lượt. Nếu đại lý chạy hàng ngàn lần một ngày, thích đường dẫn rõ ràng.
5. **Budget the framework overhead.**Mỗi framework là một sự phụ thuộc khác. Nếu nhiệm vụ là hai cuộc gọi LLM và một công cụ, hãy viết 30 dòng Python đơn giản; không khung nào rẻ hơn không khung nào.

Không muốn tìm ra một khung hình trước khi bạn có thể vẽ biểu đồ, biểu đồ tổ chức, trò chuyện, hoặc hộp đại lý.

## Matrix quyết định

| Problem shape | Preferred framework | Why |
|---------------|---------------------|-----|
| Workflow DAG with typed state, human approvals, long-running | LangGraph | First-class state, checkpointer, interrupts, time-travel. |
| Research / writing pipeline with distinct roles | CrewAI (sequential) or LangGraph subgraphs | Role-per-task is cheap to express in CrewAI; scale up with LangGraph when branching gets complex. |
| Proposer-critic or teacher-student dialogue | AutoGen | Two-agent chat is its native shape. |
| Single agent with tools, sessions, memory | Agno | Thinnest setup, built-in storage and memory. |
| Thousands of parallel fanouts with reducers | LangGraph + `Send` | The only one with a first-class parallel-dispatch API. |
| Quick prototype, no framework commitment | Plain Python + provider SDK | No framework is the fastest framework. |

```figure
l5-framework-fit
```

## Các bài tập

1. **Easy.**Hãy thực hiện cùng một nhiệm vụ  "phát tích trụ sở của Anthropic, viết một bản tóm tắt 200 từ, trích dẫn các nguồn"  và thực hiện nó trong LangGraph (bốn nút: lập kế hoạch, tìm kiếm, viết, trích dẫn) và trong CrewAI (ba vai trò: nhà nghiên cứu, nhà văn, biên tập viên).
2. **Medium.**Xây dựng nhiệm vụ tương tự trong AutoGen (phát tích  writer chat, biên tập viên tham gia qua `GroupChat`) và Agno (một đại lý duy nhất với `search_tools`và `write_tools`, cộng với một cửa hàng phiên bản). Đánh xếp bốn thực thi trên (a) chi phí mỗi chạy, (b) khả năng tiếp tục sau khi xảy ra tai nạn, (c) khả năng tiêm sự chấp thuận của con người trước bước viết.
3. **Hard.**Xây dựng một kịch bản decision tree `pick_framework.py`có một mô tả ngắn gọn về vấn đề (JSON: `{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`(văn đề xuất với một câu lý do) kiểm tra nó trên sáu trường hợp bạn tự thiết kế.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Orchestration | "How the agents coordinate" | The layer that decides which node/role/agent runs next. |
| Durable state | "Resume after a restart" | State that survives process death, attached to a checkpoint or session store. |
| LLM-selected routing | "Let the model decide" | A planner LLM picks the next step each turn; flexible but pays tokens on every decision. |
| Explicit routing | "Developer decides" | A Python function or static edge picks the next step; cheap and auditable. |
| Crew | "A CrewAI team" | Roles + tasks + process (sequential or hierarchical) bound into a single runnable. |
| GroupChat | "AutoGen's multi-agent chat" | A managed conversation between N agents with a speaker selector. |
| Team (Agno) | "Multi-agent Agno" | Route / coordinate / collaborate mode over a set of agents. |
| StateGraph | "LangGraph's graph" | Typed-state, node, conditional-edge, checkpointer abstraction. |

## Đọc thêm

- [LangGraph documentation](https://langchain-ai.github.io/langgraph/)StateGraph, điểm kiểm soát, gián đoạn, du lịch thời gian.
- [CrewAI documentation](https://docs.crewai.com/) Đội ngũ, dòng chảy, đại lý, nhiệm vụ, quy trình.
- [AutoGen documentation](https://microsoft.github.io/autogen/) ConversableAgent, GroupChat, nhóm, công cụ.
- [Agno documentation](https://docs.agno.com/) Trưởng lý, Nhóm, Luôn lưu lượng, lưu trữ, bộ nhớ.
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) thư viện mẫu (sự chuỗi nhanh, định tuyến, song song, nhạc công-người làm việc, đánh giá-tích cực) framework-agnostic.
- [Yao et al., "ReAct: Synergizing Reasoning and Acting" (ICLR 2023)](https://arxiv.org/abs/2210.03629) vòng lặp mỗi khung trang phục lên.
- [Wu et al., "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation" (2023)](https://arxiv.org/abs/2308.08155) Bức giấy thiết kế của AutoGen.
- [Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (UIST 2023)](https://arxiv.org/abs/2304.03442) nền tảng trò chơi vai trò mà các bộ đống nhân vật kiểu CrewAI xây dựng trên.
- Giai đoạn 11 · 16 (LangGraph)  khung bài học này đánh giá.
- Giai đoạn 11 · 19 (Tình phản xạ)  một mô hình vẽ sạch sẽ để LangGraph nhưng khó khăn cho CrewAI.
- Giai đoạn 11 · 22 (Sự quan sát sản xuất)  cách sử dụng các thiết bị tùy thuộc vào khung bạn chọn.
