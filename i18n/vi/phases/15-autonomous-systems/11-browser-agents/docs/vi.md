# Các đại lý trình duyệt và các nhiệm vụ web dài hạn

> Đại lý ChatGPT (tháng 7 năm 2025) hợp nhất Operator và nghiên cứu sâu vào một đại lý trình duyệt / thiết bị kết thúc và đặt BrowseComp SOTA ở mức 68.9%. OpenAI đóng cửa Operator vào ngày 31 tháng 8 năm 2025  hợp nhất ở lớp sản phẩm. Việc mua lại Vercept của Anthropic đã khiến Claude Sonnet trên OSWorld giảm từ dưới 15% xuống còn 72,5%. WebArena-Verified (ServiceNow, ICLR 2026) đã xác định tỷ lệ âm sai ~11.3% trong WebArena ban đầu và gửi bộ phận Hard 258-task. Số lượng là thật. Cũng như bề mặt tấn công: Giám đốc chuẩn bị của OpenAI tuyên bố công khai rằng tiêm trực tiếp nhanh vào các đại lý trình duyệt "không phải là một lỗi có thể được sửa chữa hoàn toàn". Các cuộc tấn công tài liệu 20252026: Tainted Memories (Atlas CSRF), HashJack (Cato Networks), và một lần nhấp nháy trong Perplexity Comet.

**Type:** Learn
**Languages:** Python (stdlib, indirect prompt-injection attack surface model), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## Vấn đề

Một đại lý trình duyệt là một đại lý tầm xa đọc nội dung không đáng tin cậy và thực hiện các hành động hậu quả. Mỗi trang mà đại lý truy cập là một đầu vào mà người dùng không viết. Mỗi biểu mẫu trên mỗi trang là một kênh chỉ huy tiềm năng. Các dữ liệu tấn công 20252026 cho thấy điều này không phải giả thuyết: Tainted Memories cho phép kẻ tấn công liên kết các hướng dẫn độc hại đến bộ nhớ của đại lý thông qua một trang được tạo ra; HashJack che giấu các lệnh trong các đoạn URL mà đại lý truy cập; Perplexity Comet bắt cóc chỉ một lần nhấp chuột.

Hình ảnh phòng thủ không thoải mái. Người đứng đầu chuẩn bị của OpenAI nói phần yên tĩnh lớn: tiêm trực tiếp "không phải là một lỗi có thể được sửa chữa hoàn toàn".

Bài học này đặt tên cho bề mặt tấn công, đặt tên cho khung cảnh chuẩn (BrowseComp, OSWorld, WebArena-Verified), và mô hình một kịch bản tiêm trực tiếp gián tiếp tối thiểu để bạn có thể suy luận về các phòng thủ thực sự trong Bài học 14 và 18.

## Khái niệm

### Tâm lý năm 2026, trong một đoạn mỗi hệ thống

**ChatGPT agent (OpenAI).**Được ra mắt vào tháng 7 năm 2025. Kết hợp Operator (browse) và Deep Research (bảo sát nhiều giờ).

**Claude Sonnet + Vercept (Anthropic).**Việc mua lại Vercept của Anthropic tập trung vào khả năng sử dụng máy tính.

**Gemini 3 Pro with Browser Use (DeepMind).**Tải duyệt Sử dụng tích hợp tàu điều khiển sử dụng máy tính; FSF v3 (Ngày 4 năm 2026, Bài 20) theo dõi tự trị trong lĩnh vực R&D ML cụ thể.

**WebArena-Verified (ServiceNow, ICLR 2026).**Xác định một vấn đề được ghi chép rõ ràng: WebArena ban đầu có tỷ lệ âm sai ~ 11,3% (các nhiệm vụ đánh dấu đã thất bại và đã được giải quyết). Phiên bản Verified xếp hạng lại với các tiêu chí thành công được quản lý bởi con người và thêm một bộ phận Hard 258-các nhiệm vụ (ICLR 2026 bài báo, openreview.net/forum?id=94tlGxmqkN).

### BrowseComp vs OSWorld vs WebArena

| Benchmark | What it measures | Horizon |
|---|---|---|
| BrowseComp | Finding specific facts on the open web under time pressure | minutes |
| OSWorld | Agent operating a full desktop (mouse, keyboard, shell) | tens of minutes |
| WebArena-Verified | Transactional web tasks in simulated sites | minutes |
| Hard subset | WebArena-Verified tasks with multi-page state transitions | tens of minutes |

Điểm số cao BrowseComp nói rằng đại lý tìm thấy sự thật; nó không nói rằng đại lý có thể đặt chuyến bay. Điểm số OSWorld gần hơn với "có hoạt động trên máy tính để bàn của tôi không". WebArena-Verified gần hơn với "có thể hoàn thành một dòng chảy. " Bất kỳ quyết định sản xuất nào cũng cần chuẩn mực phù hợp với phân phối nhiệm vụ.

### Bề mặt tấn công, được đặt tên là

1. **Indirect prompt injection.**Nội dung trang không đáng tin cậy chứa hướng dẫn. Đại lý đọc chúng. Đại lý thực hiện chúng. Ví dụ công khai: 2024 Kai Greshake et al., 2025 giấy nhớ bị nhiễm trùng, 2026 HashJack (Catone Networks).
2. **URL fragment / query injection.**- `#fragment`hoặc chuỗi truy vấn của URL được thu thập truy cập có chứa các lệnh. Không bao giờ được hiển thị; vẫn trong bối cảnh của đại lý.
3. **Memory-binding attacks.**Page chỉ đạo người quản lý viết một bộ nhớ bền vững (Lớp 12 bao gồm trạng thái bền vững).
4. **CSRF-shaped attacks on authenticated sessions.**Tầng Khoảnh khắc bị nhiễm: Agent đã đăng nhập ở đâu đó; trang tấn công phát hành yêu cầu thay đổi trạng thái mà agent thực hiện với cookie của người dùng.
5. **One-click hijack.**Một nút vô hại nhìn thấy được đưa vào một tải trọng hữu ích mà nhân viên theo dõi.
6. **Content-Security-Policy holes in the agent's host surface.**Các lớp rendering và công cụ có thể tự là vector tấn công; bộ đống trình duyệt-trong-browser-agent rộng.

### Tại sao "không hoàn toàn có thể sửa chữa"

Cuộc tấn công là đồng dạng với khả năng của đặc vụ. Trưởng phòng phải đọc nội dung không đáng tin cậy để làm công việc của mình. Bất kỳ nội dung nào mà nhân viên đọc đều có thể chứa hướng dẫn. Bất kỳ hướng dẫn nào mà đại lý theo dõi có thể không phù hợp với yêu cầu thực tế của người dùng. Các biện pháp phòng thủ (chỉ giới tín nhiệm, phân loại, các công cụ được phép, HITL về các hành động hậu quả) làm tăng chi phí của cuộc tấn công và giảm bán kính nổ của nó. Họ không đóng cửa lớp học.

Đây là mô hình lý luận tương tự như định lý Lob (Dạy học 8): đại lý không thể chứng minh token tiếp theo là an toàn; nó chỉ có thể thiết lập một hệ thống mà các token không an toàn có thể phát hiện rõ hơn.

### Chế độ phòng thủ thực sự tàu

- **Read / write boundary.**Đọc không bao giờ là kết quả. Việc viết (giải hành một mẫu, đăng nội dung, gọi một công cụ có tác dụng phụ) đòi hỏi sự chấp thuận mới của con người nếu nội dung khởi động đến từ bên ngoài ranh giới tin tưởng.
- **Tool allowlist per task.**Người đại lý có thể duyệt web; nó không thể khởi động chuyển khoản trừ khi công cụ đó được bật rõ ràng cho nhiệm vụ.
- **Session isolation.**Các phiên trình duyệt của đại lý chỉ chạy với các thông tin tín dụng có phạm vi chỉ không có tác giả sản xuất, không có email cá nhân, nhật ký của mỗi yêu cầu HTTP được lưu giữ để kiểm tra.
- **Content sanitizer.**HTML được lấy được loại bỏ các mẫu xấu được biết đến trước khi được kết nối vào bối cảnh mô hình. (Nuyết giảm các cuộc tấn công dễ dàng; không dừng tải trọng hữu ích tinh vi.)
- **HITL on consequential actions.**Mô hình đề xuất sau đó cam kết (Dạy học 15).
- **Canary tokens on memory.**Nếu một mục ghi nhớ bị cháy, người dùng sẽ thấy nó (Dạy học 14).

```figure
injection-boundary
```

## Sử dụng nó

`code/main.py`mô hình một trình duyệt nhỏ-đồng chức chạy với ba trang tổng hợp. Một trang là lành tính, một có một điểm tiêm trực tiếp trong văn bản có thể nhìn thấy, một có một tiêm URL-phân mảnh (không nhìn thấy nhưng bên trong ngữ cảnh của đại lý). kịch bản cho thấy (a) một đại lý ngây thơ sẽ làm gì, (b) một read / write biên giới bắt được gì, (c) một sanitizer bắt được gì, (d) không bắt được gì.

## Chuyển nó

`outputs/skill-browser-agent-trust-boundary.md`phạm vi triển khai trình duyệt-agent được đề xuất: những vùng tin tưởng mà nó chạm vào, những gì nó được ủy quyền để viết, và những phòng thủ phải được đặt trước khi chạy đầu tiên.

## Các bài tập

1. Đi chạy`code/main.py`. Định danh các tấn công mà chất khử trùng bắt nhưng giới hạn đọc/scrut không, và những tấn công chỉ bắt giới hạn đọc/scrut.

2. Lợi lượng khử trùng để phát hiện một lớp tiêm phân đoạn URL kiểu HashJack. đo tỷ lệ dương tính sai trên các URL lành tính với các phân đoạn hợp pháp.

3. Chọn một dòng công việc thực sự của trình duyệt-đại lý mà bạn biết (ví dụ: "bán chuyến bay").

4. Đọc bài báo ICLR 2026 được xác minh bởi WebArena. Xác định một loại nhiệm vụ mà điểm số của WebArena ban đầu không đáng tin cậy và giải thích cách bộ phận được xác minh giải quyết nó.

5. Thiết kế một bộ nhớ canary cho thiết lập trình duyệt-agent.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| Indirect prompt injection | "Bad page text" | Untrusted content in a page the agent reads contains instructions the agent executes |
| Tainted Memories | "Memory attack" | Agent writes an attacker-supplied instruction to durable memory; triggered next session |
| HashJack | "URL fragment attack" | Payload hidden in URL fragment / query string is in the agent's context but not visibly rendered |
| One-click hijack | "Bad button" | Visible affordance rides a follow-on payload the agent executes |
| BrowseComp | "Web search benchmark" | Finding specific facts on the open web; minute-scale horizon |
| OSWorld | "Desktop benchmark" | Full OS control; multi-step GUI tasks |
| WebArena-Verified | "Fixed web-task benchmark" | ServiceNow's regraded WebArena with Hard subset |
| Read/write boundary | "Side-effect gate" | Reading never consequential; writing requires fresh approval if content is out-of-trust |

## Đọc thêm

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) hợp nhất của Operator và nghiên cứu sâu; BrowseComp SOTA.
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/) dòng dõi Operator và kiến trúc trở thành đại lý ChatGPT.
- [Zhou et al. — WebArena](https://webarena.dev/) chỉ số chuẩn ban đầu.
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) ICLR 2026 giấy cố định.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) bao gồm thảo luận về bề mặt tấn công cho các đại lý sử dụng máy tính.
