# Tỷ lệ sản xuất  Lịch, Điểm kiểm soát, Độ bền

> Tích thước các hệ thống đa đại lý đến hàng ngàn chạy đồng thời đòi hỏi **durable execution** xếp hàng làm việc cộng với các điểm kiểm soát, vì vậy bất kỳ công nhân nào có thể tiếp tục chạy sau bất kỳ tai nạn nào, miễn là xử lý thuê, tác dụng phụ không có khả năng và tái diễn xác định được thực hiện.`thread_id`(Từ khi bị trục xuất theo mặc định); công nhân bị tai nạn giải phóng hợp đồng thuê và một công nhân khác tiếp tục.**MegaAgent**(arXiv:2408.09955) chạy hàng nhà sản xuất-thành khách mỗi đại lý với ba trạng thái (Idle / Processing / Response) và phối hợp hai lớp (chát nội bộ nhóm + chat quản trị viên giữa nhóm). **Fiber/async**đánh đập thread-per-job cho LLM streaming: các thread ngồi idle 99% thời gian chờ đợi token, sợi hợp tác sản xuất trên I / O. Counterpoint: Ashpreet Bedi "Scaling Agentic Software" lập luận cho **FastAPI + Postgres + nothing else**cho đến khi tải chứng minh khác  kiến trúc đơn giản đi xa hơn dự kiến. Bài học này xây dựng một nhật ký kiểm soát lâu dài, hàng xếp hàng làm việc cho mỗi đại lý với chuyển đổi trạng thái, một bản demo async-vs-thread, và hạ cánh quy tắc thực tế "bắt đầu đơn giản".

**Type:** Learn + Build
**Languages:** Python (stdlib, `asyncio`, `sqlite3`), TypeScript
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Vấn đề

Một hệ thống đa đại lý nguyên mẫu hoạt động trên một máy tính xách tay với ba đại lý trong một vòng lặp trong bộ nhớ.

- Các đại lý đôi khi chạy trong nhiều giờ (sự nghiên cứu dài, người trong vòng chờ đợi).
- Các quy trình công nhân bị hỏng, khởi động lại mất trạng thái.
- Lượng tải cao nhất là trung bình 10x; bạn cần quy mô ngang.
- Người dùng trả tiền cho mỗi người vận hành; bạn cần một cách chính xác một lần để sạc.

Các tùy chọn canonical 2026 là:

1. Một động cơ lưu lượng công việc với các điểm kiểm soát (Temporal, LangGraph runtime).
2. Một dòng tin nhắn với một cửa hàng nhà nước (Postgres + SQS/RabbitMQ).
3. Các khung mô hình diễn viên (Mỹ nhân sản xuất-thành khách của mỗi đại lý).
4. FastAPI + Postgres (trách luận của Bedi).

Bài học này tạo ra một hình ảnh nhỏ của mỗi bài học.

## Khái niệm

### Hoạt động lâu dài, mô hình

Một động cơ thực hiện bền vững vẫn giữ trạng thái chương trình đầy đủ sau mỗi "giải" (giải siêu, bằng ngôn ngữ LangGraph).

```
worker crashes mid-step
  -> lease timeout
  -> another worker picks up the thread_id
  -> resumes from last checkpoint
  -> no duplicate side effects
```

Yêu cầu để điều này hoạt động:

- **Serializable state.**Tất cả tình trạng đại lý phải duy trì.
- **Deterministic resume.**Với cùng một trạng thái và cùng một đầu vào, đại lý tạo ra các hành động tương tự (hoặc di chuyển đến một ngôn ngữ xác định bên ngoài cho các cuộc gọi LLM).
- **Idempotent side effects.**Các cuộc gọi bên ngoài (các cuộc gọi công cụ, thanh toán) phải là không có khả năng hoặc sử dụng một khóa giảm trùng lặp.

LangGraph viết một điểm kiểm soát sau mỗi bước siêu; Temporal viết sau mỗi hoạt động; Restate sử dụng các tạp chí nguồn gốc sự kiện. Cả ba đều thực hiện mô hình tương tự.

### Một thời gian chạy điểm kiểm soát từng bước

Thời gian chạy của LangGraph là ví dụ được làm việc: mỗi đại lý có một `thread_id`; trạng thái là một lệnh đánh dấu; mỗi siêu bước viết một hàng cho bảng kiểm soát.`interrupt()`chờ đợi sự nhập cảnh của con người; thời gian chạy vẫn tồn tại và giải phóng người lao động.

Đây là thiết kế sản xuất tham chiếu vào tháng 4 năm 2026.

### Đường xếp hàng của MegaAgent cho mỗi đại lý

ArXiv:2408.09955 mô tả một thí nghiệm quy mô: hàng ngàn đại lý đồng thời trong một cụm.

```
agent i:
  state ∈ {Idle, Processing, Response}
  in_queue   <- messages addressed to agent i
  out_queue  -> replies + side effects

coordinators:
  intra-group chat  (agents in the same group)
  inter-group admin chat  (high-level routing)
```

Sự phối hợp hai lớp cho phép cuộc trò chuyện trong nhóm xảy ra dày đặc trong khi giữa nhóm vẫn còn hiếm  mô hình được sử dụng để giữ chi phí tuyến tính trong hàng ngàn đại lý.

### Async vs thread-per-job

Các cuộc gọi LLM là liên kết I / O. Một chuỗi chờ đợi token tiếp theo là vô hiệu 99% thời gian. Các chuỗi chi phí ~ 1MB RAM mỗi lần; với 10.000 cuộc gọi đồng thời, đó là 10GB chỉ cho các đống.

Sợi (Python `asyncio`, đi theo thói quen, Rust `tokio`(văn khoái) hợp tác trong I/O. Các cuộc gọi 10.000 tương tự phù hợp thoải mái trong quá trình.

Ngoại lệ: xử lý sau khi kết nối với CPU (trình tích hợp, các thủ thuật token) vẫn cần các chuỗi hoặc quy trình.

### Phản điểm của Bedi

"Scaling Agentic Software" (Ashpreet Bedi, 2026) lập luận rằng hầu hết các nhóm đã quá kỹ thuật trước khi đo tải.

- FastAPI + Postgres.
- Mỗi hành trình của đại lý là một hàng; trạng thái được cập nhật tại chỗ với sự đồng thời lạc quan.
- Các công việc trong nền tảng qua `pg_notify`hay một công nhân đơn giản của Celery.
- Lại thử chính sách trong mã ứng dụng.

Đối với tải dưới ~ 100 đồng thời chạy đại lý trên các nhiệm vụ có thể quản lý, đây thường là tất cả những gì bạn cần. nâng cấp khi bạn đo nó thất bại.

Quy tắc: áp dụng các khung thực hiện lâu dài khi bạn gặp một vấn đề cụ thể mà kiến trúc đơn giản không thể giải quyết.

### - Đúng là một lần -

Đối với các chuyến bay đại lý trả tiền, bạn cần "đúng một lần hiệu quả" (ít nhất một lần giao hàng + người tiêu dùng vô hiệu lực).

- **Dedup key per run.**Bao gồm nó trong mỗi cuộc gọi tác dụng phụ.
- **Outbox pattern.**Các tác dụng phụ viết cho một bảng trước, sau đó một quá trình riêng biệt thực hiện chúng.
- **Compensating transactions.**Khi một tác dụng phụ thành công nhưng ghi chép theo dõi của nó thất bại, lập kế hoạch một bù đắp.

Đây là các mô hình kỹ thuật cơ sở dữ liệu, không phải đặc biệt cho LLM. Thuế LLM chỉ là các cuộc gọi LLM chậm; tất cả những thứ khác là hệ thống phân tán tiêu chuẩn.

### Việc triển khai sơn sơn

Hệ thống nghiên cứu đa đại lý của Anthropic sử dụng "sử dụng cầu vồng": nhiều phiên bản của thời gian chạy đại lý chạy cùng lúc vì vậy các đại lý chạy lâu không phải bị giết chết trên mỗi bản triển khai mã.

Đây là tiêu chuẩn cho các hệ thống có trạng thái dài; sự thích nghi năm 2026 là các đại lý có thể sống trong nhiều giờ, vì vậy chu kỳ triển khai phải phù hợp.

### Danh sách kiểm tra sản xuất theo quy định

- Tương tự như là:
- - Hậu quả phụ không hiệu quả.
- Lớp I/O Async cho các cuộc gọi LLM.
- Ít nhất một lần giao hàng với Dedup.
- Việc triển khai rainbow/canary cho các khối lượng công việc đầy trạng thái.
- Hình ảnh: theo dõi mỗi đại lý, kiểm toán siêu bước, kiểm tra thử lại.

```figure
sw-checkpoint-replay
```

## Hãy xây dựng nó

`code/main.py`thực hiện:

- `CheckpointStore` Quý nhật ký điểm kiểm soát được hỗ trợ bởi SQLite với các khóa thread-id. Mỗi bước siêu thêm một hàng.
- `run_with_checkpoint(agent, thread_id)` mô phỏng một vụ tai nạn giữa chạy; một công nhân thứ hai tiếp tục từ điểm kiểm soát cuối cùng.
- `AgentQueue` mỗi đại lý Máy trạng thái không hoạt động / xử lý / phản ứng với hàng đợi làm việc nhỏ.
- `demo_async_vs_threads()` chạy 500 "call LLM" simulated đồng thời qua asyncio và qua các thread; báo cáo tường đồng hồ và bộ nhớ đỉnh (khoảng).

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

Khả năng đầu ra dự kiến: Checkpoint resume thành công sau khi bị hỏng mô phỏng; phiên bản async xử lý 500 cuộc gọi đồng thời trong < 1s; phiên bản thread mất vài giây và sử dụng nhiều bộ nhớ hơn theo thứ tự trên mỗi đơn vị đồng thời.

## Sử dụng nó

`outputs/skill-scaling-advisor.md`tư vấn về lựa chọn thực hiện bền: FastAPI + Postgres, LangGraph runtime, Temporal, hoặc tùy chỉnh.

## Chuyển nó

Thiết kế sản xuất canonical:

- **Start simple (Bedi's rule).**FastAPI + Postgres cho đến khi bạn đo lường nó thất bại.
- **Instrument everything before optimizing.**HISTORGAM HÀT LÀTN TẠI LÀN, thời gian mỗi bước, đếm lại, phân loại thất bại.
- **Outbox pattern for side effects.**Đặc biệt là thanh toán và các cuộc gọi API bên ngoài.
- **Rainbow deploys.**Đừng bao giờ giết người đang bay trong khi đang triển khai.
- **Adopt durable-execution engines (Temporal / LangGraph / Restate) when**Bạn gặp phải những vấn đề cụ thể: chờ đợi người trong vòng một giờ, phối hợp giữa các khu vực, các chính sách thử nghiệm lại / bồi thường phức tạp.
- **Async for the I/O layer.**Các dây chỉ dành cho xử lý sau khi kết nối với CPU.

## Các bài tập

1. Đi chạy`code/main.py`- Đảm bảo điểm kiểm soát làm việc tiếp tục; đo async vs thread sự khác biệt đồng thời.
2. Thực hiện một**outbox**bảng: mỗi cuộc gọi công cụ viết vào hộp thư ra trước, sau đó một goroutine / nhiệm vụ riêng biệt được thực hiện.
3. Tưởng tượng một **rainbow deploy**: hai phiên bản chạy cùng lúc; chuyển hướng một nửa các thread_ids mới cho mỗi; xác nhận rằng các thread trong chuyến bay trên phiên bản cũ không bị gián đoạn.
4. Đọc tài liệu thời gian chạy của LangGraph (đối kết dưới đây). Xác định các tính năng thời gian chạy nào sẽ mất nhiều thời gian hơn để sao chép trong phiên bản FastAPI + Postgres được quét bằng tay. Đó là lý do để áp dụng, hoặc bạn có thể hoãn lại?
5. Đọc MegaAgent (arXiv:2408.09955) Phần 3. Sự phối hợp hai lớp (trong nhóm + trò chuyện quản trị viên giữa nhóm) là rõ ràng.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Durable execution | "Persist the program state" | Engine writes state after each super-step; crash recovery is deterministic. |
| Super-step | "Transactional boundary" | Unit of work between checkpoints. LangGraph term. |
| thread_id | "Agent run identifier" | Key that binds checkpoints and resume logic. |
| Idempotency | "Safe to retry" | Repeating a side effect produces the same result as one attempt. |
| Outbox pattern | "Decouple side effects" | Write intent to a table; a separate executor performs and marks done. |
| At-least-once delivery | "Possible duplicates" | Message queue semantics; dedup key makes consumer effective-once. |
| Rainbow deploy | "Overlapping versions" | Multiple runtime versions concurrent during long-running workloads. |
| Async fiber | "Cooperative yielding" | User-mode concurrency; cheap compared to threads for I/O-bound loads. |
| Checkpoint | "State snapshot" | Serialized state at a super-step boundary; key for resume. |

## Đọc thêm

- [LangChain — The runtime behind production deep agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) Thiết kế thời gian chạy LangGraph
- [MegaAgent](https://arxiv.org/abs/2408.09955) hàng đầu sản xuất-thành khách mỗi đại lý; phối hợp hai tầng tại hàng ngàn đại lý đồng thời
- [Matrix](https://arxiv.org/abs/2511.21686) khung phân cấp với hàng rào thông điệp như là nền phối hợp
- [Temporal docs](https://docs.temporal.io/) động cơ lưu lượng công việc tham chiếu cho việc thực hiện lâu dài
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) Bài học sản xuất bao gồm việc triển khai cầu vồng
