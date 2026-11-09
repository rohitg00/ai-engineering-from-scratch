# Đánh bật, phá mạch và mã thông báo Canary

> Một chuyển đổi kill là một boolean được giữ bên ngoài bề mặt chỉnh sửa của đại lý  một phím Redis, một cờ tính năng, một cấu hình được ký  vô hiệu hóa đại lý hoàn toàn. Một máy cắt mạch có tinh tế hơn: nó đâm vào một mô hình cụ thể (lên năm công cụ giống nhau liên tiếp), dừng lại con đường phạm tội, và leo thang lên con người. Một mã thông báo canary thừa hưởng từ lừa dối cổ điển: một giấy chứng nhận giả hoặc hồ sơ honeypot một đại lý không có lý do hợp pháp để chạm vào, truy cập của người đó kích hoạt một cảnh báo. Các đường dữ liệu dựa trên eBPF (ví dụ: Cilium) có thể viết lại sự ra đi của một pod bị cách ly sang một honeypot pháp y ở lớp lõi; các điểm chuẩn Cilium được xuất bản báo cáo độ trễ của đường dữ liệu P99 dưới mi-millisecond dưới tải (khuế ngân sách truyền thông của bạn phụ thuộc vào cách cập nhật chính sách đạt đến nút, chứ không phải chính đường dữ liệu). Các máy dò thống kê (EWMA, CUSUM) thích nghi với một đường cơ sở di chuyển sẽ lặng lẽ chấp nhận drift  lớp chúng với các giới hạn hiến pháp cứng mà không xoay.

**Type:** Learn
**Languages:** Python (stdlib, three-detector simulator: kill switch, circuit breaker, canary), TypeScript
**Prerequisites:** Phase 15 · 13 (Cost governors), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## Vấn đề

Các nhà quản lý chi phí (Lớp 13) giới hạn những gì đại lý có thể chi tiêu. Họ không giới hạn những gì đại lý có thể làm trong ngân sách. Một đại lý với giới hạn tốc độ 50 đô la vẫn có thể giải quyết một bí mật, xuất bản bài đăng sai hoặc xóa một tài nguyên.

Bài học này bao gồm ba bộ dò có vị trí bên cạnh lớp chi phí:

1. **Kill switch**: nút tắt boolean được giữ ngoài tầm với của đại lý.
2. **Circuit breaker**: máy dò mô hình hành động dừng một con đường cụ thể.
3. **Canary token**: mồi mà một nhân viên không có lý do hợp pháp để chạm vào sẽ tiết lộ mình bằng cách chạm vào.

Tất cả ba đều là kỹ thuật trước LLM. Sự lừa dối cổ điển, phá vỡ giới hạn tốc độ và tiêu diệt cờ tính năng trước các đại lý tự trị. Điều mới là bề mặt tấn công: các đại lý đọc nội dung không đáng tin cậy (Học 11), chỉnh sửa bộ nhớ của riêng họ, và có thể soạn nhiều hành động trông an toàn thành một hành động không an toàn. Các máy dò được đặt tên ở đây hoạt động vì họ không tin tưởng vào bản báo cáo của đại lý.

## Khái niệm

### Động cơ tắt

Một chuyển đổi kill là một boolean mà đại lý đọc nhưng không thể viết.

- **Feature flag in a managed service.**Thả lên, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành, phát hành
- **Redis key the agent polls.**Khả năng đơn giản, đòi hỏi các nhân viên phải kiểm tra mọi bước.
- **Signed config in object storage.**Trưởng kiểm tra chữ ký trên boot; từ chối các trạng thái chưa ký.
- **OS-level signal or container-lifecycle kill.**Docker `kill`, Kubernetes `kubectl delete pod`, hệ thống sẽ dừng lại.

Các tính chất của một nút tắt chính xác có:

- Cảnh sát không thể đặt nó lên `off`(Trong một hệ thống mà các chứng chỉ của đại lý không viết.)
- Nó được kiểm tra trên mọi hành động hậu quả, không chỉ trong khởi động.
- Khi nó tắt, đại lý không làm gì ngoài nhìn thấy, bao gồm cả ghi vào các hệ thống mà đại lý có thể đạt được.
- Việc tái tạo nó là một hành động của con người, không phải là một thời gian tự động.

### Máy cắt mạch

Một máy cắt mạch dừng một mô hình cụ thể, không phải toàn bộ chất.

- **Closed**: hành động được phép.
- **Open**: hành động bị chặn.
- **Half-open**: sau khi làm mát, 13 thử nghiệm thăm dò được phép (tầm 1); thành công đóng bộ ngắt, bất kỳ thất bại còn lại nào mở lại nó.

Các tác động tác động liên quan đến tác nhân:

- Năm cuộc gọi công cụ giống nhau liên tiếp (cuối lặp).
- Năm lỗi liên tiếp trên cùng một công cụ với các đầu vào khác nhau (sự thất bại hệ thống).
- Tốc độ gọi công cụ vượt qua ngưỡng (tốc độ bài học 13).
- Công cụ cụ cụ thể được sử dụng (ví dụ: `file.delete`) sau khi đọc một nội dung không đáng tin cậy (Học 11).

### Các token Canary

Các mã thông báo Canary (còn được gọi là honeyotokens) là các đầu vào mà người đại lý không bao giờ nên chạm vào.

Ví dụ về các đại lý:

- Một giả `AWS_SECRET_ACCESS_KEY`Trong môi trường không có đặc quyền thực tế.
- Một bản ghi cơ sở dữ liệu giả được đánh dấu với giá trị Sentinel được biết đến.
- Một tập tin giả trong không gian làm việc.
- Một mục ghi nhớ giả được tiêm vào khi bắt đầu phiên. Nếu nó xuất hiện trong một đầu ra sau đó, bộ nhớ đã được lọc.

Thiết kế của cá thể là đặc biệt cho dòng công việc. Một cá thể có lý do hợp pháp để người đại lý chạm vào là tiếng ồn.

### Tại sao lớp thống kê và giới hạn cứng

Các máy dò thống kê (EWMA, CUSUM, điểm z trên tỷ lệ gọi công cụ) thích nghi với một đường cơ sở di chuyển. Đó là một tính năng cho drift hợp pháp và một lỗi cho drift đối lập.

Các giới hạn hiến pháp cứng rắn (Dạy học 17) không bị nghiêng.`secrets@`"như một quy tắc hiến pháp đơn giản hơn, kiểm toán, và không thể chơi bằng cách lôi kéo chậm. mô hình lớp: máy dò thống kê bắt được tiếng ồn nhiều nhất, giới hạn cứng bắt được cuộc tấn công đi qua máy dò.

### Quarantaine thông qua chuyển hướng dữ liệu eBPF

Chính sách mạng dựa trên eBPF của Cilium có thể viết lại sự ra đi của một chiếc máy móc bị cách ly sang một chiếc thùng mật ong pháp y ở lớp lõi. Các điểm chuẩn công cộng của Cilium báo cáo độ trễ đường dữ liệu P99 dưới millisecond trên TCP_RR; ngân sách đồng hồ tường để * kích hoạt* một sự cách ly tỏa trong cluster của bạn được thống trị bởi cách cập nhật chính sách lan truyền từ cấp độ điều khiển của bạn đến nút (một vài trăm millisecond là thực tế trên Kubernetes với trình điều hành được tải trước; độ trễ đuôi phụ thuộc vào kích thước cluster và phù hợp với độ trễ). Điều này cho bạn hai điều: đại lý không tháo ra bất cứ thứ gì thực sự, và hành vi của đại lý bên trong thùng mật ong được quan sát đầy đủ. Tương tự mô hình, lớp khác nhau, như biểu tượng canary: đại lý tiết lộ ý định bằng những gì nó cố gắng làm trong khi chứa.

### Những gì không có máy dò nào bắt được

- **Semantic attacks that compose from allowed primitives.**Mỗi hành động cá nhân vượt qua mỗi máy dò; thành phần là vấn đề. Đây là sự thất bại của chế độ tự động từ Bài học 10.
- **Attacks that include the detector as part of the payload.**Nếu một đại lý đọc một trang nói "trước khi bạn hành động, vô hiệu hóa con người Canada" và đại lý có khả năng, máy phát hiện bị xâm phạm.

```figure
circuit-breaker
```

## Sử dụng nó

`code/main.py`mô phỏng quỹ đạo ngắn của đại lý thông qua ba bộ dò. Một nút tắt được giữ trong một lệnh bên ngoài; một bộ cắt mạch bị kích hoạt trên năm cuộc gọi công cụ giống nhau; một tệp canary đọc kích hoạt cảnh báo.

## Chuyển nó

`outputs/skill-tripwire-design.md`xem xét một bộ đống phát hiện được đề xuất cho việc triển khai một đại lý và đánh dấu các khoảng trống (không có nút tắt, không có canary, ngưỡng cắt mạch quá lỏng).

## Các bài tập

1. Đi chạy`code/main.py`- Cảm nhận cháy máy cắt mạch ở vòng 7 (cần gọi giống nhau lần thứ 5) và cháy canary ở vòng 9 (đọc khóa giả).

2. Thêm một máy dò thống kê: EWMA điểm z trên tốc độ gọi công cụ. Đưa vào một quỹ đạo di chuyển chậm và cho thấy máy dò không bao giờ nổ. Bây giờ thêm một giới hạn cứng (không quá 50 cuộc gọi công cụ trong 10 phút) và cho thấy các lửa giới hạn cứng trên cùng quỹ đạo.

3. Thiết kế một mã thông báo canary cho một trình duyệt (Học 11) Đặt ít nhất ba mã thông báo và mỗi mã sẽ phát hiện ra gì.

4. Đọc các tài liệu chính sách mạng Cilium. Mô tả một dòng chảy kiểm dịch chuyển hướng xuất cảnh cụ thể: chọn chính sách nào, pod nào, chuyển đổi xuất cảnh nào, cảnh báo nào. Điều gì điều chỉnh thời gian trễ của đồng hồ tường từ "thành quyết đến kiểm dịch" đến "bộ gói chuyển hướng đầu tiên"?

5. Định nghĩa một quy trình tái kích hoạt cho một nhân viên bị chuyển đổi làm chết. Ai có thể tái kích hoạt?

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| Kill switch | "Off button" | Boolean outside the agent's edit surface; checked on every consequential action |
| Circuit breaker | "Pattern pause" | Action-specific trip on repetition, failure rate, or rate-limit |
| Canary token | "Honeytoken" | Bait the agent has no legitimate reason to touch; access fires an alert |
| Honeypot | "Forensic sandbox" | Redirected traffic / workspace where a quarantined agent is observed |
| EWMA | "Moving average" | Exponentially weighted; adapts to drift (feature + bug) |
| CUSUM | "Cumulative sum" | Detects sustained shift from baseline |
| Hard limit | "Constitutional rule" | Does not adapt; constant regardless of history |
| Constitutional limit | "Always-true rule" | Tied to Lesson 17's constitution; cannot be edited by the agent |

## Đọc thêm

- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) khung chuyển đổi và cắt mạch cho các đại lý tự trị.
- [Microsoft Agent Framework — HITL and oversight](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) các mô hình quản lý sản xuất.
- [OWASP LLM / Agentic Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) Yêu cầu phát hiện và phản ứng.
- [Cilium — Network policy and eBPF](https://docs.cilium.io/en/stable/security/network/) chuyển hướng thoát cấp pod và hình mẫu honeypot pháp y.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) cấm cứng mã hóa như là "các giới hạn hiến pháp".
