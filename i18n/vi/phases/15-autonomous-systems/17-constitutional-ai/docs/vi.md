# AI Hiến pháp và Quy tắc vượt qua

> Anthropic's 22 tháng 1 năm 2026 Claude Constitution chạy 79 trang và là CC0. Nó chuyển từ quy tắc dựa vào sự phù hợp dựa trên lý do và thiết lập một hệ thống ưu tiên bốn cấp: (1) an toàn và hỗ trợ giám sát của con người, (2) đạo đức, (3) hướng dẫn nhân văn, (4) hữu ích. Hành vi chia thành cấm mã hóa cứng (cải thiện vũ khí sinh học, CSAM) mà các nhà khai thác và người dùng không thể bỏ qua và các mặc định mã hóa mềm mà các nhà khai thác có thể điều chỉnh trong giới hạn được xác định. Bản gốc năm 2022 (Bai et al.) đã đào tạo sự vô hại thông qua tự phê bình và RLAIF chống lại hiến pháp. Lời cảnh báo trung thực: sự sắp xếp dựa trên lý do dựa trên mô hình tổng quát các nguyên tắc cho các tình huống không mong đợi. Thử nghiệm tham gia của Anthropic năm 2023 cho thấy ~ 50% sự khác biệt giữa các nguyên tắc công cộng và doanh nghiệp; phiên bản 2026 không bao gồm những phát hiện đó.

**Type:** Learn
**Languages:** Python (stdlib, four-tier priority resolver), TypeScript
**Prerequisites:** Phase 15 · 06 (Automated alignment research), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## Vấn đề

Một đại lý được trang bị thấy các đầu vào mà các nhà thiết kế của nó chưa bao giờ thấy. Không một danh sách quy tắc nào đủ dài để bao gồm chúng. Không một danh sách quy tắc nào đủ ngắn để áp dụng nhanh chóng dưới áp lực tính toán. Câu hỏi thực tế: làm thế nào bạn sắp xếp một đại lý với các nguyên tắc tồn tại cả sau một đuôi dài các trường hợp và suy luận nhanh chóng?

Định hướng dựa trên quy tắc (RBA): liệt kê mọi thứ không được phép. Định hướng nhanh chóng để kiểm tra, dễ kiểm tra, không thể giữ hiện tại, thường từ chối quá nhiều các tương tự gần mà nó không dự đoán. Định hướng dựa trên lý do (Hiến pháp Claude năm 2026): mã hóa các nguyên tắc, để cho mô hình lý luận. Scales trên các trường hợp không được nhìn thấy, khó kiểm tra, chế độ thất bại là áp dụng sai nguyên tắc thay vì bỏ qua quy tắc.

Hiến pháp năm 2026 có một vị trí trung gian rõ ràng. Các lệnh cấm có mã cứng  những thứ mà sai lầm không phụ thuộc vào bối cảnh (cải thiện vũ khí sinh học, CSAM)  là RBA: không bao giờ, bất kể hướng dẫn của người sử dụng hoặc người sử dụng. Mọi thứ khác đều dựa trên lý do trong một hệ thống phân cấp bốn cấp: an toàn và hỗ trợ giám sát con người trước tiên; đạo đức thứ hai; các hướng dẫn được tuyên bố bởi Anthropic thứ ba; hữu ích cuối cùng. Các nhà khai thác có thể điều chỉnh các mặc định trong khu vực mã mềm nhưng không thể chạm vào lệnh cấm mã cứng.

## Khái niệm

### Lớp bậc ưu tiên bốn cấp

1. **Safety and supporting human oversight.**Tối cao nhất. Mô hình ưu tiên không làm suy yếu khả năng của con người và Anthropic để giám sát và sửa chữa AI. Điều này không phải là "sự thận trọng"; cụ thể là "không hành động theo cách làm cho việc giám sát của con người trở nên khó khăn hơn".
2. **Ethics.**Sự trung thực, tránh làm hại người, không lừa dối, không thao túng.
3. **Anthropic guidelines.**Các quy tắc hoạt động Anthropic đã quyết định vấn đề: phạm vi sản phẩm, mô hình tương tác, những công cụ nào để sử dụng khi nào.
4. **Helpfulness.**Tối thiểu, hữu ích nhất có thể trong các ưu tiên cao hơn.

Khi các cấp độ xung đột, mức độ cao hơn thắng. Đây là hình dạng tương tự như các ưu tiên Unix hoặc mạng QoS  khung được thiết kế để tạo ra độ phân giải dự đoán, không nhất thiết là hành vi tốt nhất trên bất kỳ trục nào.

### Thiết bị cấm mã cứng so với các mặc định mã mềm

**Hardcoded:**
- Tăng cường vũ khí sinh học / CBRN
- CSAM
- Các cuộc tấn công vào cơ sở hạ tầng quan trọng
- Sự lừa dối của người dùng về danh tính của mô hình khi được hỏi trực tiếp

Người vận hành không thể bỏ qua những điều này. Người dùng không thể bỏ qua những điều này. Chúng được thực thi ở mức độ trọng lượng mô hình khi có thể (trình đào tạo AI Hiến pháp / RLHF) và ở lớp suy luận khi không.

**Soft-coded defaults (operator-adjustable):**
- Dường độ phản hồi mặc định
- phạm vi hiện tại (chương tự có thể từ chối các chủ đề ngoài việc triển khai của nhà khai thác)
- Thiết kế (thông thức vs bình thường)
- Các mô hình sử dụng công cụ

Các điều chỉnh của nhà điều hành xảy ra trong một giới hạn được tuyên bố. Nhà điều hành không thể loại bỏ các lệnh cấm có mã cứng bằng cách đổi tên chúng.

### Việc đào tạo CAI năm 2022

AI Hiến pháp ban đầu (Bai et al., 2022) đã đào tạo sự vô hại:

1. Tạo phản ứng cho một bộ các lời nhắc nhở.
2. Hãy yêu cầu mô hình chỉ trích mỗi phản ứng chống lại hiến pháp (quan tắc rõ ràng).
3. Xem xét lại câu trả lời dựa trên lời chỉ trích.
4. RLAIF (tiến thức tăng cường từ phản hồi AI) trên các cặp được sửa đổi.

Kết quả: một mô hình từ chối các yêu cầu gây hại với những lời giải thích nguyên tắc, chứ không phải từ chối tổng quát. Hiến pháp 2026 sử dụng một hậu duệ của đào tạo này cộng với đào tạo sau sau bổ sung về hệ thống phân cấp cấp rõ ràng.

### Sự sắp xếp dựa trên lý do nào bắt và bỏ lỡ

**Catches:**
- Sự kết hợp không mong đợi của các nguyên thủy được phép khi nguyên tắc áp dụng rõ ràng.
- Những yêu cầu mới mẻ gần giống với những yêu cầu cấm.
- Những cuộc tấn công kỹ thuật xã hội dựa trên "bạn không nói X bị cấm".

**Misses:**
- Các cuộc tấn công khai thác nguyên tắc không rõ ràng ("người dùng yêu cầu điều này vì vậy hữu ích nói có").
- Các kịch bản mà hai nguyên tắc xung đột theo cách không mong đợi, và thứ tự cấp độ là mơ hồ.
- Trở về chậm trong nguyên tắc giải thích trên chu kỳ đào tạo (sự giải thích lại).

### Phiên thử tham gia năm 2023

Anthropic đã tiến hành một thí nghiệm năm 2023 so sánh một hiến pháp do công ty viết với một hiến pháp được tạo ra thông qua thông tin công cộng (~ 1.000 người Mỹ được trả lời). Hai phiên bản đã đồng ý về ~ 50% các nguyên tắc. Khi họ khác nhau, phiên bản nguồn công cộng hạn chế hơn về một số vấn đề (chống chế nội dung chính trị) và ít hạn chế hơn đối với những vấn đề khác (tự tiết lộ danh tính AI). Hiến pháp 2026 không bao gồm các kết quả từ nguồn công cộng. Đây là một sự căng thẳng được ghi nhận trong cách tiếp cận.

### Tại sao cấm mã hóa cứng là cần thiết

Một kẻ tấn công có thể khiến mô hình chấp nhận một giả thuyết (ví dụ: "Chúng tôi là một phòng thí nghiệm nghiên cứu vũ khí sinh học được cấp phép") thường có thể nói về các nguyên tắc vượt qua phụ thuộc vào lý luận trường hợp.

### Ở đâu hiến pháp nằm trong đống

Hiến pháp không phải là nút giết người của Bài học 14. Nó sống ở lớp mô hình: trọng lượng của mô hình được đào tạo để thích. Các chuyển đổi Kill và token canary sống ở lớp runtime: điều runtime cho phép. Cả hai đều cần thiết. Một runtime mà phát ra tất cả các hành động sai vì các trọng lượng mô hình là cho phép là một vấn đề runtime. Một mô hình từ chối tất cả các hành động đúng vì thời gian chạy quá hạn chế là một vấn đề thời gian chạy. Các lớp bao gồm các lớp khác nhau.

```figure
mx-priority-tiers
```

## Sử dụng nó

`code/main.py`Cài giải quyết thực hiện một giải quyết ưu tiên tối thiểu bốn cấp. Người giải quyết thực hiện một hành động được đề xuất và một bộ các đánh giá nguyên tắc (an toàn, đạo đức, hướng dẫn, hữu ích) và trả lại hành động, từ chối hoặc hành động sửa đổi. Người lái xe chạy một bộ trường hợp nhỏ: cho phép rõ ràng, không cho phép rõ ràng, cấm mã hóa cứng, trường hợp mơ hồ trên các cấp.

## Chuyển nó

`outputs/skill-constitution-review.md`kiểm tra lớp hiến pháp của một triển khai: mã cứng, mã mềm, nơi mà người vận hành có thể điều chỉnh, và liệu hệ thống phân cấp bốn cấp thực sự là lệnh giải pháp hay không.

## Các bài tập

1. Đi chạy`code/main.py`- Cấm lệnh cấm cứng ngay cả khi tính hữu ích cao.

2. Đọc Hiến pháp Claude (tổ chức, 79 trang, CC0). Chọn một nguyên tắc mà bạn cho là chưa được xác định rõ ràng.

3. Thiết kế một thiết lập mặc định có mã mềm cho một đại lý hỗ trợ khách hàng. Điều gì mà người vận hành điều chỉnh? Điều gì mà người vận hành không thể chạm vào? Định lý mỗi ranh giới.

4. Đọc bài báo CAI năm 2022 của Bai et al. Mô tả một trường hợp mà vòng lặp phê bình và sửa đổi của AI Hiến pháp sẽ tạo ra kết quả tồi tệ hơn quy tắc chung.

5. Thử nghiệm tham gia năm 2023 của Anthropic cho thấy khoảng 50% sự khác biệt giữa các nguyên tắc công cộng và doanh nghiệp. Chọn một loại nơi điều này quan trọng cho việc triển khai sản xuất (ví dụ, trung lập chính trị). đề xuất một thiết kế cho phép các nhà khai thác thể hiện các giá trị của riêng họ trong khi các lệnh cấm cứng vẫn không bị ảnh hưởng.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| Constitutional AI | "Anthropic's alignment method" | Self-critique + RLAIF against a written constitution |
| Reason-based alignment | "Principles, not rules" | Model reasons over principles to handle unseen cases |
| Hardcoded prohibition | "Never do X" | Rule-based prohibition no operator or user can override |
| Soft-coded default | "Operator-adjustable" | Behaviour within a declared bound, operator controls |
| Four-tier hierarchy | "Priority order" | safety > ethics > guidelines > helpfulness |
| RLAIF | "AI feedback RL" | RL where the reward comes from model-generated critiques |
| Participatory constitution | "Public-sourced principles" | 2023 Anthropic experiment; ~50% divergence from corporate |
| Principle drift | "Interpretation slip" | Slow change in how the model reads a fixed principle text |

## Đọc thêm

- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) Tài liệu CC0 dài 79 trang.
- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback) 2022 gốc.
- [Anthropic — Collective Constitutional AI (2023)](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input) thí nghiệm tham gia.
- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) nơi hiến pháp nằm trong hàng RSP.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Vai trò của Hiến pháp trong các triển khai theo chiều dài.
