# SRE cho AI  Phản ứng các sự cố đa đại lý, Runbook, Khám phá dự đoán

> AI SRE sử dụng LLM dựa trên dữ liệu cơ sở hạ tầng (logbock, runbook, topology dịch vụ) thông qua RAG để tự động hóa các giai đoạn điều tra, tài liệu và phối hợp. Mô hình kiến trúc năm 2026 là tổ chức đa đại lý  các đại lý chuyên môn (logbo, métrics, runbook) được phối hợp bởi một giám sát viên; AI đề xuất giả thuyết và câu hỏi, con người chấp thuận các cuộc gọi phán xét. Datadog Bits AI và Azure SRE Agent vận chuyển này như các sản phẩm được quản lý. Các sổ chạy đang phát triển: NeuBird Hawkeye sử dụng đánh giá đối kháng ( hai mô hình phân tích cùng một sự cố; sự đồng thuận = sự tin tưởng, bất đồng = không chắc chắn); trí nhớ hoạt động tồn tại trong các thay đổi nhóm. Tự trị tự động vẫn thận trọng: AI đề nghị, con người chấp thuận. Hành động tự trị hoàn toàn là hẹp (tái khởi động pod, rollback cụ thể triển khai) với các rào chắn chặt chẽ  bất cứ ai bán "đặt nó và quên nó" là bán quá mức. Biên giới mới nổi: dự đoán trước sự cố. Nghiên cứu của MIT báo cáo một LLM được đào tạo về các nhật ký lịch sử + thời gian GPU + mô hình lỗi API dự đoán 89% các vụ gián đoạn 10-15 phút sớm hơn. Dự báo: 95% LLM doanh nghiệp đã tự động chuyển giao thất bại vào cuối năm 2026.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy multi-agent incident triage simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 24 (Chaos Engineering)
**Time:** ~60 minutes

## Mục tiêu học tập

- Chụp đồ họa kiến trúc AI SRE đa đại lý: giám sát viên + đại lý chuyên ngành (logbo, métrics, runbook) + cổng chấp thuận con người.
- Giải thích lý do tại sao tự khắc phục lại lại lại là hẹp (tái khởi động, tái triển khai) thay vì rộng (công vụ tái thiết).
- Hãy nêu tên mô hình đánh giá đối kháng (NeuBird Hawkeye): hai mô hình đồng ý = sự tin tưởng; không đồng ý = leo thang.
- Hãy trích dẫn kết quả phát hiện sớm 89% của MIT và hạn chế hoạt động: dự đoán không kích hoạt chỉ là bảng điều khiển.

## Vấn đề

Một kỹ sư đang gọi được gọi vào 3 giờ sáng "Tỷ lệ lỗi cao trong thanh toán". Họ kiểm tra Datadog, Loki, ba sổ chạy, nhật ký triển khai. 30 phút sau họ nhận ra nguyên nhân gốc là một vLLM OOM từ một ổ đĩa cache KV. Họ khởi động lại pod; lỗi xóa.

Năm 2026, 20 phút đầu tiên của cuộc điều tra đó có thể tự động hóa. Nhóm nhật ký theo dịch vụ, tương quan với các triển khai gần đây, phù hợp với các sổ chạy  tất cả là RAG + sử dụng công cụ. Một đại lý được giám sát có thể thực hiện phân loại lần đầu tiên và trình bày một giả thuyết trước khi con người mở Datadog.

Phong trào tự trị hoàn toàn là một vấn đề khác. Khởi động lại: an toàn. Scale GPU pool: an toàn nếu chính sách cho phép. tái thiết kế dịch vụ: hoàn toàn không. Phân lý đang vẽ đường hẹp.

## Khái niệm

### Kiến trúc đa đại lý

```
          Incident
             │
             ▼
        Supervisor
        /    |    \
       ▼     ▼     ▼
  Log agent  Metric agent  Runbook agent
       │     │     │
       └─────┴─────┘
             │
             ▼
        Hypothesis + evidence
             │
             ▼
        Human approval
             │
             ▼
        Action (narrow set)
```

Giám sát viên chia vụ việc thành các câu hỏi phụ. Các đại lý chuyên môn có quyền truy cập công cụ (hướng dẫn tìm kiếm nhật ký, PromQL, tìm kiếm tài liệu). Giám sát viên tổng hợp, trình bày giả thuyết + bằng chứng cho con người. Con người chấp thuận hoặc chuyển hướng.

### Khu vực tự trị

**Safe (narrow)**: khởi động lại pod, quay lại triển khai cụ thể, quy mô trong giới hạn được chấp thuận trước, cho phép cờ tính năng được chấp thuận trước.

**Not safe (broad)**: thay đổi topology dịch vụ, thay đổi giới hạn nguồn lực, triển khai mã mới, thay đổi IAM, thay đổi cơ sở dữ liệu.

Bất cứ ai bán "đặt nó và quên nó" là bán quá mức.

### Đánh giá đối lập (NeuBird Hawkeye)

Hai mô hình phân tích độc lập sự cố tương tự. Nếu họ đồng ý về nguyên nhân gốc rễ, sự tự tin cao. Nếu họ không đồng ý, leo thang lên con người với cả hai giả thuyết có thể nhìn thấy.

### Khoá sử dụng

Tiến đổi nhóm là việc giết chết im lặng của các lá kiến thức bộ lạc truyền thống của SRE. AI SRE lưu trữ sổ chạy + hậu tử vong trong một DB vector; các đại lý lấy lại trên mỗi sự cố mới. Khi các kỹ sư mới tham gia, AI có lịch sử đầy đủ.

### Dự đoán trước sự cố

Nghiên cứu MIT 2025: LLM được đào tạo về các nhật ký lịch sử, nhiệt độ GPU, mô hình lỗi API dự đoán 89% các sự cố xảy ra 10-15 phút trước khi chúng xảy ra trên bộ thử nghiệm.

Kiểm tra thực tế: dự đoán không có kích hoạt là bảng điều khiển. Câu hỏi hoạt động là "Khi chúng ta dự đoán, chúng ta làm gì?" Phòng thoát phòng ngừa? Pager? tự động quy mô? Câu trả lời là chính sách cụ thể.

### Sản phẩm vào năm 2026

- **Datadog Bits AI** quản lý SRE phi công bên trong Datadog.
- **Azure SRE Agent** Người gốc Azure.
- **NeuBird Hawkeye** đánh giá đối kháng + trí nhớ hoạt động.
- **PagerDuty AIOps** phân loại + giảm gấp đôi.
- **Incident.io Autopilot** chỉ huy vụ việc + phối hợp.

### Các sổ chạy như mã

Các runbook phát triển từ các trang Confluence đến các phiên bản đánh dấu xuống với các phần có cấu trúc (symptom, giả thuyết, xác minh, hành động).

### Những con số mà bạn nên nhớ

- Phát hiện sớm MIT: 89% các vụ gián đoạn, thời gian dẫn đầu 10-15 phút.
- Phân loại đa đại lý: giám sát viên + (logbo, métrics, runbook) + con người.
- Bộ tự động khắc phục an toàn: khởi động lại pod, tái triển khai, quy mô trong giới hạn.
- Đánh giá đối lập: hai mô hình độc lập; sự đồng thuận = sự tin tưởng.

```figure
i4-incident-agents
```

## Sử dụng nó

`code/main.py`mô phỏng phân loại đa đại lý: đại lý đăng ký tìm thấy lỗi, đại lý métric tìm thấy CPU spike, runbook đại lý phù hợp với vấn đề được biết đến. giám sát viên xếp hạng giả thuyết.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-ai-sre-plan.md`Với số lượng vụ việc hiện tại, độ trưởng thành của nhóm, thiết kế một AI SRE.

## Các bài tập

1. Đi chạy`code/main.py`Nếu các nhân viên ghi chép và đo không đồng ý thì làm sao người giám sát giải quyết?
2. Định nghĩa ba hành động tự khắc phục "an toàn" cho dịch vụ của bạn.
3. Viết một mẫu runbook có cấu trúc: các phần, các trường yêu cầu, lệnh xác minh.
4. Hình ảnh phát hiện dự đoán phát hiện ở mức 12 phút dẫn đầu.
5. Thảo luận liệu một nhóm 3 người nên áp dụng AI SRE vào năm 2026 hay chờ.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| AI SRE | "agent for on-call" | LLM-backed incident investigation + coordination |
| Supervisor agent | "the orchestrator" | Top-level agent breaking incidents into sub-queries |
| Specialized agent | "domain agent" | Sub-agent with tool access (logs, metrics, runbooks) |
| Auto-remediation | "AI fixes it" | Narrow pre-approved action; NOT broad re-architecture |
| Operational memory | "vector runbooks" | Post-mortems + runbooks in vector DB for RAG |
| Adversarial eval | "two-model check" | Independent analyses; agreement = confidence |
| NeuBird Hawkeye | "the adversarial one" | Product with adversarial-eval + memory pattern |
| Bits AI | "Datadog's SRE agent" | Datadog-managed AI SRE |
| Pre-incident prediction | "early detection" | 10-15 min lead time on outage prediction |

## Đọc thêm

- [incident.io — AI SRE Complete Guide 2026](https://incident.io/blog/what-is-ai-sre-complete-guide-2026)
- [InfoQ — Human-Centred AI for SRE](https://www.infoq.com/news/2026/01/opsworker-ai-sre/)
- [DZone — AI in SRE 2026](https://dzone.com/articles/ai-in-sre-whats-actually-coming-in-2026)
- [Datadog Bits AI](https://www.datadoghq.com/product/bits-ai/)
- [NeuBird Hawkeye](https://www.neubird.ai/)
- [awesome-ai-sre](https://github.com/agamm/awesome-ai-sre)
