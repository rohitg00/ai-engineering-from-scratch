# Các kiến trúc song song / Swarm / Networked

> Sự khác biệt với giám sát viên: không có người quyết định trung tâm. Các đại lý đọc một chuyến đi chung, bắt đầu công việc không đồng bộ, viết lại kết quả. LangGraph rõ ràng hỗ trợ "Swarm Architecture" cho môi trường phi tập trung, động. Matrix (arXiv:2511.21686) đại diện cho cả sự kiểm soát và lưu lượng dữ liệu như các tin nhắn được phân phối qua hàng phân tán để loại bỏ nút thắt của nhạc công. Sự thỏa hiệp là rõ ràng: quyết định và khả năng truy xuất để có thể mở rộng. Swarm phù hợp với các nhiệm vụ với nhiều phụ vấn độc lập; nó không phù hợp với các nhiệm vụ cần một kế hoạch nhất quán.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`, `queue`), TypeScript
**Prerequisites:** Phase 16 · 05 (Supervisor Pattern), Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## Vấn đề

Giám đốc chỉ định một vài người lao động. Còn hàng trăm người thì sao? Giám đốc chính là nút thắt: mọi quyết định về việc ai làm gì thông qua một đại lý. Một bước kế hoạch chậm chạp làm đình trệ toàn bộ hệ thống.

Các kiến trúc đám đông đảo thay đổi thiết kế. Thay vì một nhà hoạch định trung tâm gửi công việc, công nhân chọn công việc từ một hàng đợi chung. "sự phối hợp" được nướng vào ngữ nghĩa của xe buýt sự kiện. Không có nhạc cụ; hệ thống cân bằng cho đến khi hàng đợi làm.

## Khái niệm

### Hình dạng

```
                ┌──── shared queue ────┐
                │                      │
       ┌────────┼────────┐  ◄──────┬───┘
       ▼        ▼        ▼         │
     Worker  Worker  Worker   Worker
      A       B       C        D
       │        │        │         │
       └────────┴────────┴─────────┘
                 │
                 ▼
            results pool
```

Không có người dàn nhạc. Mỗi người lao động lặp lại: kéo một nhiệm vụ, tiến hành, viết kết quả (và tùy chọn là theo dõi theo dõi).

### Khi đám đông phù hợp

- **Many independent tasks.**Việc phế liệu, biến đổi, phân loại, nhiệm vụ không phụ thuộc vào nhau.
- **Variable-duration work.**Nếu một số công việc mất 100ms và những công việc khác mất 10s, một đám cân bằng tải tự động  nhanh nhân viên kéo ra công việc tiếp theo.
- **Throughput over determinism.**Anh quan tâm đến thời gian hoàn thành, không phải quy định nghiêm ngặt.

### Khi đám đông thất bại

- **Ordered workflows.**Nếu bước 3 cần đầu ra bước 2, một đám nguy cơ bước 3 bắn trước khi bước 2 được thực hiện.
- **Global-plan tasks.**Những câu hỏi nghiên cứu phức tạp được một nhà lập kế hoạch lợi ích.
- **Debugging.**Không có nhật ký trung tâm và công việc không đồng bộ, tái tạo một lỗi là tốn kém.

### Matrix (arXiv:2511.21686)

Matrix là bài báo năm 2025 đưa hàng loạt đến kết luận tự nhiên của nó: cả lưu lượng điều khiển và lưu lượng dữ liệu là các tin nhắn được phân phối theo chuỗi trên hàng rào phân phối. Không có điều phối viên trung tâm. Sự dung nạp lỗi đến từ độ bền của tin nhắn. Scalability là vấn đề của người môi giới tin nhắn, không phải của hệ thống.

Đóng góp: một mô hình lập trình mà phối hợp đa đại lý là "những thông điệp chủ đề đại lý này đăng ký?" thay vì "những đại lý nào giám sát chọn tiếp theo?" Điều này làm cho hệ thống trông giống như một lưới pub / sub sự kiện.

### Swarm trong khung đồ thị

Các tài liệu LangGraph 2025 mô tả rõ ràng "Swarm Architecture" là một trong những mô hình đa đại lý: đại lý là nút, nhưng cạnh hình thành một biểu đồ hướng dẫn với chu kỳ và bất kỳ nút nào có thể được kích hoạt từ hồ bơi.

### Phương thức không hoạt động: đói và phát hiện điểm nóng

Nếu tất cả nhân viên làm việc nhanh nhất có sẵn, các công việc dài không bao giờ được chọn cho đến khi chúng là những người duy nhất còn lại.

Giảm thiểu:
- Các hàng xếp ưu tiên với sự lão hóa rõ ràng (tăng ưu tiên với thời gian chờ đợi).
- Sự chuyên môn của công nhân: một số công nhân chỉ thực hiện các nhiệm vụ "trường dài".
- Khác áp lực: giới hạn số lượng các nhiệm vụ nhanh vào hàng.

### Liên kết định tuyến dựa trên nội dung

Các cặp sưu tập tự nhiên với định tuyến dựa trên nội dung (Dạy 22) Thay vì một hàng hàng chung, có một hàng hàng cho mỗi loại tin nhắn.

```figure
sw-work-stealing
```

## Hãy xây dựng nó

`code/main.py`thực hiện một đám 4 dây lao động kéo từ một chia sẻ `queue.Queue`Các nhiệm vụ có thời gian thay đổi (một số nhanh, một số chậm).

- **Sequential baseline:**Một người lao động xử lý tất cả các nhiệm vụ theo một loạt.
- **Fixed assignment:**mỗi nhiệm vụ được giao trước cho một công nhân cụ thể (tương tự giám sát viên).
- **Swarm:**Công nhân rút ra khỏi hàng.

Các cân nặng đống tự động tải lên; việc giao nhiệm kỳ cố định khiến người lao động nhanh chóng không làm việc khi nhiệm vụ giao nhiệm vụ của họ chậm.

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả cho thấy số lượng công việc cho mỗi người lao động (square phân phối không đồng đều nhưng tối ưu) và thời gian đồng hồ tường.

## Sử dụng nó

`outputs/skill-swarm-fit.md`đánh giá liệu một nhiệm vụ có nên sử dụng swarm vs supervisor hay không. Các đầu vào: độc lập nhiệm vụ, sự khác biệt thời gian, yêu cầu đặt hàng, nhu cầu gỡ lỗi.

## Chuyển nó

Danh sách kiểm tra:

- **Priority queue with aging.**Giữ phòng khỏi nạn đói.
- **Worker idempotency.**Một công việc có thể được kéo ra nhiều lần nếu một công nhân bị tai nạn giữa thời gian chạy.
- **Durable queue.**Sử dụng Kafka, Redis Streams, hoặc một hàng xếp dựa trên cơ sở dữ liệu để sản xuất. `queue.Queue`chỉ là trong ký ức.
- **Observability per task.**Mỗi nhiệm vụ đều có một thẻ nhận dạng; mỗi nhân viên ghi lại bắt đầu/sự kết thúc với nó.
- **Back-pressure.**Nếu hàng đợi tăng nhanh hơn người lao động cạn kiệt, hãy làm chậm người sản xuất.

## Các bài tập

1. Đi chạy`code/main.py`Thống lượng nhanh hơn bao nhiêu so với thứ tự trên khối lượng công việc thời gian biến đổi?
2. Thêm một biến thể hàng ưu tiên ( Sử dụng `queue.PriorityQueue`Đặt ưu tiên theo mục "bất quan trọng" nhiệm vụ. Xem xem các nhiệm vụ ưu tiên thấp có bao giờ bị đói khi tải liên tục hay không.
3. Thực hiện một máy dò điểm nóng: ghi lại khi một công nhân nào đó xử lý 3 lần nhiều nhiệm vụ hơn công nhân chậm nhất. Điều đó cho thấy gì về phân phối thời gian nhiệm vụ?
4. Đọc bài viết Matrix (arXiv:2511.21686) trừu tượng và Phần 3. Xác định một tradeoff cụ thể Matrix chấp nhận (scability gain) và một nó từ bỏ (traceability, định nghĩa).
5. Chuyển đổi demo swarm để sử dụng `queue.Queue`của (task_type, payload) tuples, với người lao động chỉ đăng ký các loại cụ thể.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Swarm architecture | "Decentralized agents" | Workers pull from shared queue; no central orchestrator. |
| Event bus | "Agents subscribe to topics" | Message broker that routes tasks to workers by type or content. |
| Starvation | "Task never runs" | Low-priority task never gets picked because higher-priority work arrives continuously. |
| Hot-spotting | "One worker drowns" | Load imbalance where one worker gets most tasks. |
| Back-pressure | "Slow down the producer" | Mechanism that signals upstream to stop producing when the queue fills up. |
| Idempotent worker | "Safe to re-run" | A task processed twice produces the same result. Required because workers may crash mid-run. |
| Durable queue | "Survives crashes" | Queue backed by disk or replicated storage; tasks are not lost when a worker crashes. |
| Matrix framework | "Full message-passing swarm" | Both data and control flow are serialized messages on distributed queues. |

## Đọc thêm

- [LangGraph workflows and agents — Swarm Architecture](https://docs.langchain.com/oss/python/langgraph/workflows-agents) hỗ trợ đống đông rõ ràng
- [Matrix — A Decentralized Framework for Multi-Agent Systems](https://arxiv.org/abs/2511.21686) Lâu đài thông điệp đầy đủ
- [Anthropic engineering — why supervisor not swarm in Research](https://www.anthropic.com/engineering/multi-agent-research-system) lý do tại sao một hệ thống sản xuất cụ thể đã chọn rõ ràng người giám sát hơn đàn
- [AutoGen v0.4 actor-model docs](https://microsoft.github.io/autogen/stable/) diễn viên dựa trên sự kiện viết lại, gần hơn với đám đông hơn GroupChat của v0.2
