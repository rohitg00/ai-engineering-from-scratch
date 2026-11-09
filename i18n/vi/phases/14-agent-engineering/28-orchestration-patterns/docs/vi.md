# Các mẫu dàn nhạc: giám sát viên, nhóm, cấp bậc

> Bốn mô hình dàn xếp lặp lại trên các khung 2026: người giám sát, nhóm / đồng nghiệp, phân cấp, tranh luận. hướng dẫn của Anthropic: "Đó là về việc xây dựng hệ thống phù hợp với nhu cầu của bạn". Bắt đầu đơn giản; chỉ thêm topology khi một đại lý duy nhất cộng với năm mô hình luồng công việc là không đủ.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 25 (Multi-Agent Debate)
**Time:** ~60 minutes

## Mục tiêu học tập

- Hãy nêu tên bốn kiểu dàn nhạc lặp lại và mỗi kiểu phù hợp.
- Mô tả khuyến nghị LangChain 2026: giám sát dựa trên các công cụ và thư viện giám sát.
- Giải thích quy tắc "giải thiện hệ thống" của Anthropic và cách nó ngăn chặn sự lựa chọn topology.
- Thực hiện tất cả bốn trong stdlib chống lại một LLM kịch bản chung.

## Vấn đề

Các nhóm tìm kiếm "multi-agent" trước khi họ cần nó. Bốn mô hình lặp lại trên các khung; một khi bạn có thể đặt tên cho chúng, bạn có thể chọn đúng  hoặc bỏ qua topology hoàn toàn.

## Khái niệm

### Nhân viên giám sát

- Một trung tâm định tuyến LLM gửi đến các đại lý chuyên nghiệp.
- Quyết định: quay lại với bản thân, giao cho chuyên gia, chấm dứt.
- Các chuyên gia không nói chuyện với nhau; tất cả các tuyến đường đi qua người giám sát.

Các khung: LangGraph `create_supervisor`, nhân vật nhạc sĩ-thợ, CrewAI Hierarchical Process.

**2026 LangChain recommendation:**làm giám sát thông qua các cuộc gọi trực tiếp công cụ thay vì `create_supervisor`. Giúp kiểm soát kỹ thuật ngữ tinh tế hơn  bạn quyết định chính xác những gì mỗi chuyên gia thấy.

### Swarm / peer-to-peer

- Các đại lý giao thông trực tiếp qua một bề mặt công cụ chung.
- Không có bộ định tuyến trung tâm.
- Trễ hơn so với người giám sát (nhiều hop hơn).
- Khó hơn để lý luận về (không có một điểm kiểm soát duy nhất).

Các khung: Topology swarm LangGraph, OpenAI Agents SDK handoffs (khi tất cả các đại lý có thể trao cho tất cả những người khác).

### Đường bậc

- Giám sát viên quản lý phụ giám sát viên quản lý nhân viên.
- Thực hiện như các subgraph tổ trong LangGraph; các phi hành đoàn tổ trong CrewAI.
- Scale đến các nhóm đại lý lớn với chi phí phức tạp hoạt động.

Khi bạn cần nó: khi ngân sách ngữ cảnh của một giám sát viên duy nhất không thể chứa mô tả về tất cả các chuyên gia.

### Cuộc tranh luận

- Các đề xuất song song + phê bình chéo lặp lại (Học 25).
- Không thực sự dàn xếp  nhiều xác minh  nhưng xuất hiện như một lựa chọn topology trong các khung.

### Các đội tự trị so với dòng chảy xác định

CrewAI chính thức hóa hai chế độ triển khai:

- **Flow**cho tự động hóa xác định dựa trên sự kiện (điểm khởi đầu được khuyến cáo cho sản xuất).
- **Crew**cho sự hợp tác dựa trên vai trò tự trị.

Điều này là thẳng thắn với bốn mô hình ở trên nhưng bản đồ cho topology: Flow thường là giám sát hoặc phân cấp; Crew thường là giám sát với một bộ định tuyến LLM.

### Hướng dẫn của Anthropic

"Sự thành công trong lĩnh vực LLM không phải là xây dựng hệ thống tinh vi nhất mà là xây dựng hệ thống phù hợp với nhu cầu của bạn".

Định lệnh quyết định:

1. Một đại lý + các mô hình lưu lượng công việc (Dạy học 12)  bắt đầu từ đây.
2. Người giám sát làm việc  khi bạn có 2-4 chuyên gia.
3. Thập tràn khi độ trễ quan trọng hơn sự rõ ràng của lý luận.
4. Đường bậc  chỉ khi ngân sách trong bối cảnh giám sát thất bại.
5. Vài cuộc tranh luận  khi tính chính xác quan trọng hơn chi phí.

### Khi mô hình này đi sai

- **Topology-first thinking.**"Chúng tôi cần nhiều đại lý" trước khi xác định vấn đề mà nhiều đại lý giải quyết.
- **Bouncing handoffs in swarm.**A -> B -> A -> B. Sử dụng máy tính đếm hop.
- **Fake hierarchy.**Ba tầng vì "công ty"; hai đội thực sự.

```figure
orchestration-pattern
```

## Hãy xây dựng nó

`code/main.py`thực hiện tất cả bốn mô hình trong stdlib đối với một LLM kịch bản:

- `Supervisor` bộ định tuyến trung tâm.
- `Swarm` Tương tự với người khác với sự giao tiếp trực tiếp.
- `Hierarchical` Giám sát viên của giám sát viên.
- `Debate` đề xuất song song + chỉ trích.

Mỗi mô hình xử lý cùng một nhiệm vụ ba ý định (trái tiền / lỗi / bán hàng).

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả: theo dõi theo mô hình + số lượng op. Giám sát viên sạch nhất; đàn đông ngắn nhất; cấp bậc là sâu nhất; tranh luận đắt tiền nhất.

## Sử dụng nó

- **LangGraph**cho giám sát và cấp bậc (đồ sơ phụ có tổ).
- **OpenAI Agents SDK**cho việc trao đổi như công cụ (tình hình giám sát viên).
- **CrewAI Flow**cho sản xuất xác định.
- **Custom**để tranh luận hoặc khi nào bạn muốn kiểm soát chính xác.

## Chuyển nó

`outputs/skill-orchestration-picker.md`chọn một topology và thực hiện nó.

## Các bài tập

1. Làm cho một người làm việc giám sát trở thành một đám đông bằng cách loại bỏ bộ định tuyến.
2. Thêm một con số nhảy vào đám đông: từ chối sau 3 lần giao hàng.
3. Xây dựng một hệ thống phân cấp hai cấp cho một lĩnh vực chuyên môn 12.
4. Xác định bốn mô hình trên khối lượng công việc hình dạng sản xuất.
5. Đọc bài viết của Anthropic về "Building Effective Agents" và lập bản đồ từng dòng sản xuất của bạn cho một trong bốn dòng sản xuất.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor-worker | "Router + specialists" | Central LLM dispatches to specialists; they don't talk to each other |
| Swarm | "Peer-to-peer" | Direct handoffs via shared tools; no central router |
| Hierarchical | "Supervisors of supervisors" | Nested subgraphs for large populations |
| Debate | "Proposer + critique" | Parallel proposers, cross-critique (Lesson 25) |
| Tool-call-based supervision | "Supervisor without a library" | Implement supervisor as direct tool calls for context control |
| Crew | "Autonomous team" | CrewAI's role-based collaboration mode |
| Flow | "Deterministic workflow" | CrewAI's event-driven production mode |

## Đọc thêm

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)5 mô hình + đại lý đối với dòng công việc
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) giám sát viên, đám đông, cấp bậc
- [CrewAI docs](https://docs.crewai.com/en/introduction) Đội ngũ nhân viên đối với dòng chảy
- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) Mô hình tranh luận
