# Chính sách quy mô chịu trách nhiệm nhân loại v3.0

> RSP v3.0 đã có hiệu lực vào ngày 24 tháng 2 năm 2026, thay thế chính sách năm 2023. Lượng giảm thiểu hai cấp: những gì Anthropic sẽ làm một bên so với những gì được hình thành như một khuyến nghị toàn ngành (bao gồm cả các tiêu chuẩn bảo mật RAND SL-4). Thêm lộ trình an toàn biên giới và báo cáo rủi ro như các tài liệu thường xuyên thay vì các tài liệu giao hàng một lần. Thả lời hứa nghỉ ngơi năm 2023. Giới thiệu ngưỡng R&D-4 AI: một khi vượt qua, Anthropic phải xuất bản một trường hợp xác nhận xác định rủi ro và giảm thiểu sự không phù hợp. Claude Opus 4.6 không vượt qua nó. Anthropic tuyên bố trong v3.0 thông báo rằng "để loại trừ điều này trở nên khó khăn". SaferAI xếp hạng RSP 2023 ở mức 2.2; họ hạ cấp v3.0 xuống còn 1.9, đưa Anthropic vào danh mục RSP "thô yếu" cùng với OpenAI và DeepMind. Các ngưỡng chất lượng thay thế các cam kết định lượng năm 2023; việc loại bỏ điều khoản tạm dừng là sự lùi mạnh nhất.

**Type:** Learn
**Languages:** Python (stdlib, RSP threshold decision engine), TypeScript
**Prerequisites:** Phase 15 · 06 (AAR), Phase 15 · 07 (RSI)
**Time:** ~45 minutes

## Vấn đề

Các phòng thí nghiệm biên giới xuất bản các chính sách quy mô phần nào là tài liệu kỹ thuật, phần nào là tài liệu quản lý và phần nào là tín hiệu cho các nhà quản lý. RSP v3.0 là tài liệu Anthropic hiện tại. Đọc nó kỹ càng không phải vì tuân thủ nó là ràng buộc (không phải vậy), nhưng bởi vì khung hình hình hóa cách một phòng thí nghiệm hiểu rủi ro thảm họa và cách họ truyền đạt sự thỏa hiệp với công chúng.

Sự khác biệt v3.0 vs v2.0 là đơn vị hữu ích. Những gì đã được thêm vào: Bức lộ trình an toàn biên giới, Báo cáo rủi ro, ngưỡng nghiên cứu và phát triển AI-4. Điều đã bị xóa bỏ: cam kết tạm dừng năm 2023. Điều đã được tái định dạng: một lịch trình giảm nhẹ hai cấp chia giữa Anthropic- đơn phương và ngành công nghiệp khuyến cáo. Phân tích bên ngoài  SaferAI  hạ điểm từ 2.2 (v2) xuống còn 1.9 (v3.0). Đây là cách mà một chính sách quy mô có thể trở nên ít nghiêm ngặt hơn trong khi trông đẹp hơn.

## Khái niệm

### Chương trình giảm thiểu hai cấp

- **Anthropic unilateral actions**: những gì Anthropic sẽ làm bất kể những gì các phòng thí nghiệm khác làm.
- **Industry-wide recommendations**: những gì Anthropic nghĩ ngành công nghiệp nên làm chung bao gồm các tiêu chuẩn an ninh RAND SL-4.

Cơ cấu hai cấp không có trong v2. Điều này có nghĩa là người đọc cần phải xem từng cột nào trong mỗi cam kết sống.

### Tỉ lệ nghiên cứu và phát triển AI-4

Đây là mức năng lực RSP v3.0 đặt tên là ngưỡng tiếp theo quan trọng. cụ thể: một mô hình có thể tự động hóa một phần đáng kể của nghiên cứu AI với chi phí cạnh tranh. Một khi Anthropic tin rằng một mô hình vượt qua nó, họ phải xuất bản một trường hợp xác nhận xác định rủi ro và giảm thiểu sự không phù hợp trước khi tiếp tục mở rộng quy mô.

Claude Opus 4.6 không vượt qua nó theo thông báo v3.0. Tài liệu này thêm: "Thật tự tin rằng việc loại trừ điều này đang trở nên khó khăn".

Bài học 6 (Thiết học Tích ứng tự động) và Bài học 7 (Thiết học tự cải thiện tái phát) tiếp cận trực tiếp với ngưỡng này. Các nhà nghiên cứu sắp xếp tự động vượt qua các thanh chất lượng nghiên cứu là bằng chứng cho thấy ngưỡng R&D-4 AI đang gần gũi.

### Các lộ trình an toàn biên giới và báo cáo rủi ro

v3.0 nâng cao hai loại đồ tạo vật lên các tài liệu hiện hữu:

- **Frontier Safety Roadmap**: tài liệu nhìn về tương lai mô tả công việc an toàn được lên kế hoạch, kỳ vọng về khả năng và nghiên cứu giảm thiểu.
- **Risk Report**: tài liệu phản hồi về các mô hình cụ thể sau khi phát hành, mô tả khả năng được quan sát và rủi ro dư thừa.

Cả hai đều công khai. Cả hai đều được cập nhật theo một thời gian được tuyên bố. Sự hữu ích là: người đọc có thể theo dõi cách những gì Anthropic nói họ sẽ làm trong một lộ trình so sánh với những gì họ báo cáo trong một Báo cáo rủi ro.

### Tẩy ra cụm từ tạm dừng

RSP 2023 bao gồm một cam kết tạm dừng rõ ràng: nếu một mô hình vượt qua ngưỡng khả năng cụ thể, đào tạo sẽ tạm dừng cho đến khi giảm thiểu được thực hiện. v3.0 thay thế tạm dừng rõ ràng bằng một công thức mềm hơn (bổ bản một trường hợp khẳng định, tiếp tục nếu giảm thiểu là đầy đủ). SaferAI và các nhà phân tích khác gọi điều này trực tiếp là sự lùi lại mạnh nhất trong tài liệu mới.

Nguyên lý chính sách cho sự thay đổi: ngưỡng số lượng vào năm 2023 đã không thể đạt được bởi các chuẩn khả năng thời kỳ 2026 bởi vì các chuẩn chính là đã được quy mô lại. Nguyên lý phản đối: một điều khoản tạm dừng trong một chính sách quy mô là một thiết bị cam kết; loại bỏ nó loại bỏ tính đáng tin cậy của chính sách.

### Thấp thấp của SaferAI

SaferAI là một tổ chức độc lập đánh giá các tài liệu kiểu RSP. Đánh giá công khai của họ: 2023 Anthropic RSP đạt 2.2 (từ một thang đo mà 4.0 là RSP tốt nhất hiện tại và 1.0 là danh nghĩa). v3.0 đạt 1.9. Điều này đã di chuyển Anthropic từ "tâm trung" đến "thô yếu", gia nhập OpenAI và DeepMind trong danh mục yếu.

Các yếu tố giảm cấp cho mỗi SAferAI:
- Các ngưỡng chất lượng thay thế các ngưỡng số lượng.
- Việc tạm dừng được xóa.
- Các biện pháp giảm thiểu ngưỡng R&D-4 của AI được mô tả là "vụ án xác nhận" chứ không phải là các biện pháp cụ thể.
- Cơ chế xem xét phụ thuộc vào Nhóm tư vấn an toàn của Anthropic, với giám sát độc lập hạn chế.

### Bài học này không phải là gì

Đây không phải là một bài học về tuân thủ. RSP v3.0 không phải là một quy định; không có gì buộc Anthropic phải tuân thủ nó. Bài học là đọc tài liệu với sự cụ thể và hoài nghi mà nó xứng đáng. Chính sách quy mô là các phòng thí nghiệm biên giới tín hiệu công cộng chính phát hành về tư thế rủi ro thảm họa. Việc đọc chúng một cách tốt là một kỹ năng thực tế cho bất kỳ ai mà công việc của họ phụ thuộc vào khả năng biên giới.

```figure
a5-rsp-ladder
```

## Sử dụng nó

`code/main.py`thực hiện một động cơ quyết định nhỏ phản ánh hình dạng đánh giá ngưỡng RSP: với một mô hình ứng viên và một bộ đo khả năng, trả về liệu ngưỡng AI R&D-4 đã vượt qua, các phần trường hợp xác nhận cần thiết, và liệu việc triển khai có thể tiếp tục hay không.

## Chuyển nó

`outputs/skill-scaling-policy-review.md`xem xét chính sách quy mô (Anthropic, OpenAI, DeepMind hoặc nội bộ) so với tham chiếu v3.0: cấu trúc hai cấp, ngưỡng, cam kết tạm dừng, xem xét độc lập.

## Các bài tập

1. Đi chạy`code/main.py`. Đưa vào ba mô hình tổng hợp ở các cấp độ khả năng khác nhau. Đảm bảo rằng người đánh giá ngưỡng hành vi như mong đợi và tạo ra mẫu trường hợp xác nhận đúng.

2. Đọc RSP v3.0 đầy đủ (32 trang). Định danh mọi cam kết sống trong cấp độ "sự khuyến nghị toàn ngành".

3. Đọc phương pháp đánh giá RSP của SaferAI. Tạo lại điểm số 1.9 của họ cho v3.0 bằng cách áp dụng rubric của họ cho tài liệu. Dòng rubric nào đã thúc đẩy downgrade nhiều nhất?

4. Thỏa thuận tạm dừng năm 2023 đã được loại bỏ. đề xuất một cam kết thay thế để bảo vệ uy tín của chính sách trong khi thừa nhận vấn đề tái quy mô điểm chuẩn năm 2026.

5. So sánh RSP v3.0 với OpenAI Preparedness Framework v2 (Dạy 20) Chọn một khu vực mà v3.0 mạnh hơn. Chọn một khu vực mà Preparedness Framework mạnh hơn.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| RSP | "Anthropic's scaling policy" | Responsible Scaling Policy; v3.0 effective Feb 24, 2026 |
| AI R&D-4 | "Research-automation threshold" | Capability to automate substantial AI research at competitive cost |
| Affirmative case | "Safety justification" | Published argument that risks are identified and mitigations adequate |
| Frontier Safety Roadmap | "Forward plan" | Standing document on planned safety work and expected capabilities |
| Risk Report | "Retrospective on a model" | Standing document on observed capability and residual risk after release |
| Two-tier mitigation | "Unilateral vs industry" | Anthropic commitments vs industry recommendations, separated |
| Pause commitment | "2023 clause" | Explicit promise to pause training; removed in v3.0 |
| SaferAI rating | "Independent RSP grade" | Third-party rubric; v3.0 scored 1.9 (v2 was 2.2) |

## Đọc thêm

- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) Chính sách đầy đủ 32 trang.
- [Anthropic — RSP v3.0 announcement](https://www.anthropic.com/news/responsible-scaling-policy-v3) tổng kết các thay đổi từ v2.
- [Anthropic — Frontier Safety Roadmap](https://www.anthropic.com/responsible-scaling-policy/roadmap) Tài liệu thường trực liên kết từ RSP v3.0.
- [Anthropic — Risk Report: February 2026](https://www.anthropic.com/feb-2026-risk-report) Nhìn lại về Claude Opus 4.6, mô hình biên giới khi nó được xuất bản.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) kết nối AI R&D-4 với tự trị được đo lường.
