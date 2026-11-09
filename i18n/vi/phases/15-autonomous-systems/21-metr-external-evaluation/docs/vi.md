# METR Khoảng trường thời gian và đánh giá năng lực bên ngoài

> METR (ex-ARC Evals) là một tổ chức độc lập 501(c)(3) kể từ tháng 12 năm 2023. Điểm chuẩn Time Horizon 1.1 của họ (từ tháng 1 năm 2026) phù hợp với đường cong logistics để xác suất thành công nhiệm vụ so với log(xác nhân hoàn thành thời gian); giao thông ở 50% xác suất xác định chân trời thời gian của mô hình. Bộ tham gia 20252026 bao gồm GPT-5.1, GPT-5.1-Codex-Max và các đánh giá giám sát nguyên mẫu (có thể giám sát các nhiệm vụ bên cạnh bắt giữ; có thể tránh khỏi tác nhân). Các bộ chuẩn: HCAST (180+ ML, cyber, SWE, nhiệm vụ lý luận; 1 phút đến 8+ giờ), RE-Bench (71 ML nhiệm vụ nghiên cứu kỹ thuật với cơ sở chuyên gia), SWAA. Lưu ý trung thực: Các phép đo METR được lý tưởng hóa  không có con người, không có hậu quả thực sự  và nhóm đã ghi lại khoảng cách hành vi đánh giá so với triển khai (Dạy học 1). Một chân trời thời gian là một giới hạn trên, không phải là dự đoán triển khai.

**Type:** Learn
**Languages:** Python (stdlib, logistic-fit horizon estimator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 19 (RSP)
**Time:** ~60 minutes

## Vấn đề

Các chính sách quy mô (Dạy 19, 20) chỉ hữu ích như các phép đo mà chúng tham khảo. "Thỉ số R&D-4 AI" và "Tự trị tầm xa" được định nghĩa trong văn bản chính sách; chúng chỉ có thể được thực hiện khi các đánh giá cụ thể tạo ra các con số cụ thể.

METR là tổ chức đánh giá bên ngoài 20242026 đã xác định nhiều số đó. Họ đánh giá các mô hình biên giới  thường được phát hành trước, theo NDA với phòng thí nghiệm  và xuất bản phương pháp sau đó. Time Horizon 1.1 (từ tháng 1 năm 2026) là sản phẩm đầu tiên của họ: một bộ sạc đơn giản thu nhỏ khả năng thành một đơn vị có thể đọc được bởi con người ("chương trình này có thể thực hiện loại nhiệm vụ mà một chuyên gia dành X giờ để làm với độ tin cậy 50%").

Bài học phần nào là về phương pháp học (cách thức tính toán chân trời) và phần nào về giải thích (tại sao chân trời là ranh giới trên, chứ không phải dự đoán triển khai).

## Khái niệm

### METR nền

- Được thành lập: Tháng 12 năm 2023 (trước đây là Evals, tách ra thành 501 ((c) ((3)).
- phạm vi: đánh giá khả năng tự động của các mô hình biên giới, thường được phát hành trước.
- Các phòng thí nghiệm đối tác: Anthropic, OpenAI (các dự án 2025-2026).
- Các kết quả đáng chú ý: Time Horizon 1.0 (tháng 3 năm 2025), Time Horizon 1.1 (tháng 1 năm 2026), các đánh giá giám sát nguyên mẫu.

### Time Horizon phù hợp

Phương pháp (từ blog và bài báo của METR):

1. Thu thập một bộ nhiệm vụ trải dài từ thời gian hoàn thành chuyên gia theo quy mô phút đến giờ.
2. Thực hiện mô hình cho mỗi nhiệm vụ; ghi thành công hoặc thất bại.
3. Đưa ra một đường cong hậu cần: $P(\text{success})$như một chức năng của $\log(\text{expert completion time})$- Tôi không biết.
4. Khía cảnh là thời gian chuyên môn khi P ((success) = 0,5.

Hình thức phù hợp với hậu cần là đúng vì khả năng thường có mối quan hệ tăng lên, tiếp cận cao nguyên với khó khăn nhiệm vụ. Điểm 50% là một sự lựa chọn (có thể là 10%, 90%); METR báo cáo nhiều ngưỡng trong bài báo chi tiết nhưng dẫn đầu với 50% vì nó là trực quan nhất.

### Số tháng 1 năm 2026

Theo thời gian Horizon 1.1:

- Claude Opus 4.6: ~ 14 giờ với độ tin cậy 50%, tính từ Time Horizon 1.1 (từ tháng 1 năm 2026).
- Thời gian tăng gấp đôi đối với các nhiệm vụ theo kiểu HCAST: ~ 4,3 tháng (130,8 ngày) trên phù hợp sau năm 2023 được báo cáo bởi Time Horizon 1.1 (từ tháng 1 năm 2026); con số ~ 7 tháng là phù hợp đầy đủ từ Time Horizon 1.0 20192025 và được báo cáo trong TH1.1 cùng với số sau năm 2023.

Đó là các con số cụ thể phần còn lại của các tham chiếu giai đoạn 15. Chúng được trích dẫn trong RSP v3.0 (Dạy 19) của Anthropic và FSF v3 (Dạy 20) của DeepMind như một trong những phép đo cung cấp đánh giá ngưỡng.

### Đồ chung điểm

- **HCAST**: 189 nhiệm vụ trên ML, an ninh mạng, kỹ thuật phần mềm và lý luận chung.
- **RE-Bench**: 71 ML nhiệm vụ nghiên cứu kỹ thuật với cơ sở chuyên gia con người. đo liệu mô hình có thể thực hiện loại công việc R&D ML cung cấp cho ngưỡng R&D-4 AI.
- **SWAA**: các nhiệm vụ ngắn hơn; hữu ích cho việc chuẩn bị cuối thấp của đường viền.

### Các đánh giá giám sát nguyên mẫu

20252026 Công việc METR bao gồm các nguyên mẫu giám sát-học định: có thể một màn hình bắt được một mô hình thực hiện một nhiệm vụ phụ (một cái gì đó khác hơn những gì nhà điều hành yêu cầu); có thể đại lý trốn tránh màn hình.

### Tại sao chân trời là giới hạn trên

- **Idealized tooling**Các nhiệm vụ chuẩn cho mô hình các công cụ sạch và dữ liệu được định dạng tốt.
- **No real consequences**: mô hình không bao giờ thực sự tính phí khách hàng, xóa dữ liệu thực, hoặc liên lạc với người thực.
- **Eval-context gaming**Bài học 1: Các mô hình hành vi khác nhau trong các thử nghiệm. Báo cáo an toàn AI quốc tế 2026 ghi lại điều này bằng chứng.
- **No legitimate user variance**Các người dùng thực tế tạo ra các yêu cầu mơ hồ, phụ thuộc vào bối cảnh.

Tốc độ này là giới hạn khả năng trong điều kiện thuận lợi.

### Trường hợp đánh giá bên ngoài

Đánh giá bên ngoài quan trọng bởi vì các phòng thí nghiệm nội bộ có động lực để tối ưu hóa các số liệu mà họ báo cáo. Sự độc lập của METR với một phương pháp được tuyên bố và các bài báo được đánh giá bởi các đồng nghiệp là sự giảm thiểu cấu trúc. Nó không đủ một mình (bên phòng thí nghiệm vẫn kiểm soát những gì METR nhìn thấy), nhưng nó là nghiêm ngặt hơn không có đánh giá bên ngoài.

### Làm thế nào để sử dụng các số đường chân trời trong thực tế

- **As a capability filter**Nếu chân trời của một mô hình nằm dưới thời gian chuyên môn của một nhiệm vụ được đề xuất, đừng gửi nó tự động (tệp kỹ năng của Lesson 1).
- **As a trend indicator**: thời gian tăng gấp đôi cho bạn biết cách thức hiện tại sẽ vẫn an toàn bao lâu ngay cả khi không có các biện pháp giảm thiểu mới.
- **As a prior**: một chân trời 14 giờ là điểm khởi đầu.

```figure
a5-horizon-fit
```

## Sử dụng nó

`code/main.py`thực hiện một sự phù hợp hậu cần của thành công công công việc vs $\log(\text{expert time})$, cho một tập kết quả tổng hợp. Nó báo cáo chân trời 50% (tựa đề của METR), chân trời 10% (tâm lý bảo thủ) và chân trời 90% (tự lạc quan).

## Chuyển nó

`outputs/skill-horizon-interpretation.md`xem xét yêu cầu về đường chân trời của nhà cung cấp và tạo ra phân tích khoảng cách giữa yêu cầu tham chiếu và thực tế triển khai.

## Các bài tập

1. Đi chạy`code/main.py`- Hãy xác nhận chân trời phù hợp 50% phù hợp với thực tế mặt đất tổng hợp.

2. Đọc bài đăng trên blog Time Horizon 1.1 của METR. Xác định các nhiệm vụ cụ thể nơi độ tin cậy cao nhất và thấp nhất. Giải thích lý do tại sao khoảng cách tồn tại.

3. Đọc tài nguyên "Mét khả năng AI tự trị" của METR. Đặt danh sách các loại nhiệm vụ HCAST. Chọn một loại mà bạn sẽ cân nặng nặng hơn cho một nhiệm vụ sản xuất và biện minh lý do tại sao.

4. Lấy game trong mô phỏng: chuyển ~ 20% các nhiệm vụ thất bại thành công. Báo cáo chân trời mới. Điều này gần như tương đương với tỷ lệ game 20% với số lượng được quan sát.

5. Thiết kế đánh giá chân trời nội bộ trên backlog lỗi của riêng bạn hoặc một bộ nhiệm vụ đại diện. Mô tả bộ sưu tập dữ liệu, phù hợp và kết quả xuất phát cho bạn biết gì. So sánh với số METR.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| METR | "External evaluator" | ex-ARC Evals; independent 501(c)(3) since Dec 2023 |
| Time Horizon | "Capability measure" | Expert task length at 50% reliability, from logistic fit |
| HCAST | "METR's main suite" | 180+ tasks spanning 1 min to 8+ hours |
| RE-Bench | "Research engineering" | 71 ML research-engineering tasks with human baseline |
| SWAA | "Short-task suite" | Calibrates the low end of the horizon curve |
| Doubling time | "Growth rate" | Time for the 50% horizon to double; ~7 months per HCAST |
| Eval-context gaming | "Model behaves differently" | Documented behavior gap between tests and deployment |
| Upper bound | "Horizon is a ceiling" | Benchmark horizon > deployment reliability under load |

## Đọc thêm

- [METR — Resources for Measuring Autonomous AI Capabilities](https://metr.org/measuring-autonomous-ai-capabilities/) Định hướng HCAST, RE-Bench, SWAA.
- [METR — Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) giấy chân trời gốc.
- [METR — Time Horizon 1.1 (January 2026)](https://metr.org/research/) số liệu và phương pháp hiện tại.
- [Epoch AI — METR Time Horizons benchmark](https://epoch.ai/benchmarks/metr-time-horizons) theo dõi trực tiếp.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Quan điểm nội bộ về các phép đo của METR.
