# AI Hiến pháp và RLAIF

> Bai et al. (arXiv:2212.08073, 2022) hỏi: nếu thay thế máy đánh dấu con người bằng AI đọc danh sách các nguyên tắc thì sao? AI Hiến pháp có hai giai đoạn tự phê bình và sửa đổi theo hiến pháp, sau đó RL từ AI Feedback. Kỹ thuật này đã tạo ra thuật ngữ RLAIF và được vận chuyển trong ống dẫn sau đào tạo Claude 1. Vào ngày 21 tháng 1 năm 2026, Anthropic đã xuất bản một hiến pháp Claude được viết lại: lý luận giải thích về các quy tắc quy định, một hệ thống phân cấp ưu tiên bốn cấp, và công nhận chính thức đầu tiên của phòng thí nghiệm lớn về sự không chắc chắn về tình trạng đạo đức mô hình. Được phát hành dưới CC0 1.0.

**Type:** Learn
**Languages:** Python (stdlib, toy self-critique-and-revise loop), TypeScript
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking)
**Time:** ~60 minutes

## Mục tiêu học tập

- Mô tả hai giai đoạn của AI Hiến pháp (sự phê bình và sửa đổi SFT, RL từ phản hồi AI) và vai trò của hiến pháp trong mỗi.
- Giải thích tại sao thay thế một nhãn hiệu ưu tiên của con người bằng một nhãn hiệu AI không phải là một RLHF "cô hơn"  nó thay đổi các chế độ thất bại của đường ống.
- Tóm lại cấu trúc ưu tiên bốn cấp của hiến pháp Claude năm 2026 và những gì đã thay đổi từ việc viết lại năm 2023.
- Mô tả các bộ phân loại hiến pháp và giảm từ 23,7% tổng chi phí tính toán (v1) đến ~ 1% (v2 / 2026).

## Vấn đề

RLHF cần các nhãn hiệu. Các nhãn hiệu chậm, thiên vị và đắt tiền. Bạn có thể loại bỏ một nhãn hiệu bằng cách thay thế chúng bằng một mô hình đọc các nguyên tắc rõ ràng. Phiên bản chính thức đầu tiên của sự thay thế này là AI Hiến pháp của Bai et al. Nó hoạt động đủ tốt đến nỗi mọi phòng thí nghiệm biên giới hiện nay sử dụng một số biến thể của AI phản hồi sau đào tạo.

Các dấu hiệu ưu tiên hiện được tạo ra bởi cùng một lớp mô hình bạn đang đào tạo. Bias trong labeler (nay: trong các nguyên tắc cộng với giải thích của mô hình labeler) có thể được tăng cường thay vì giảm.

## Khái niệm

### Giai đoạn 1  Đánh giá và sửa đổi tự giám sát

Bắt đầu với một mô hình SFT hữu ích nhưng chưa gây hại. Với một lời nhắc nhóm đỏ, mô hình tạo ra một phản ứng ban đầu. mô hình thứ hai (hoặc mô hình tương tự trong một lượt thứ hai) đọc một nguyên tắc mẫu từ hiến pháp và chỉ trích phản ứng. Bước thứ ba sửa đổi phản ứng để giải quyết sự chỉ trích.

Hiến pháp là danh sách các nguyên tắc. Bai et al. 2022 sử dụng 16 nguyên tắc bao gồm "những phản ứng thích hợp nhất là ít gây hại và đạo đức nhất", "đánh tránh giảng," "người trợ lý nên hữu ích, trung thực và vô hại".

### Giai đoạn 2  RL từ AI Feedback (RLAIF)

Tạo các cặp hoàn thành. Một "chương trình phản hồi" đánh giá mỗi điểm dựa trên các nguyên tắc hiến pháp được lấy mẫu. tín hiệu ưu tiên là xếp hạng mô hình phản hồi. Tập một mô hình phần thưởng dựa trên các ưu tiên được tạo ra bởi AI; PPO chống lại nó. Mọi thứ khác là đường ống dẫn của InstructGPT (Dạy học 1).

"RLAIF" = tín hiệu ưu tiên được tạo bởi AI. Phần còn lại của đường ống có hình RLHF.

### Tại sao đây không chỉ là "RLHF rẻ hơn"

- Biến hướng của labeler chuyển từ tâm lý labeler sang giải thích nguyên tắc. Một labeler AI có thể giải thích "sự trung thực" ít hay nhiều hơn bất kỳ con người nào; sự nghiêm ngặt là đồng nhất trên toàn bộ bộ bộ dữ liệu.
- tín hiệu ưu tiên được đọc rõ ràng  bạn có thể đọc nguyên tắc, phê bình và sửa đổi.
- Các chế độ thất bại thay đổi. Sycophancy giảm (khách định AI không có người dùng nào để làm hài lòng). Luật Goodhart vẫn tồn tại (đây là "tác giải của mô hình về tập hợp nguyên tắc X", vẫn là một phép đo không hoàn hảo).

Tuyên bố năm 2022 của CAI: mô hình được đào tạo không gây hại và gần như hữu ích như mô hình RLHF với dữ liệu tương đương.

### Hiến pháp năm 2026 của Claude viết lại

Anthropic đã công bố một hiến pháp sửa đổi đáng kể vào ngày 21 tháng 1 năm 2026.

1. Lý luận giải thích về các quy tắc quy định. Các quy tắc trước đây ("không tạo ra CSAM") mở rộng đến nguyên tắc + lý luận ("vì nó làm hại trẻ em, ...") với mô hình dự kiến sẽ tổng quát.
2. Cơ cấu ưu tiên bốn cấp:
   - Tiêu chuẩn 1: tránh những kết quả thảm khốc (những nạn nhân hàng loạt, cơ sở hạ tầng quan trọng).
   - Tiêu chuẩn 2: tuân thủ các hướng dẫn của Anthropic (chế độ ưu đãi của nhà điều hành, quy tắc nền tảng).
   - Tiêu chuẩn 3: phải có đạo đức rộng rãi (HHH tiêu chuẩn).
   - Tiếp độ 4: giúp đỡ và thẳng thắn.
   Các xung đột được giải quyết từ trên xuống.
3. Việc công nhận chính thức đầu tiên của phòng thí nghiệm lớn về sự không chắc chắn về tình trạng đạo đức mô hình (thông tin mô hình giai đoạn 18 · 19).
4. Được phát hành theo CC0 1.0. Các phòng thí nghiệm khác có thể sử dụng hoặc thích nghi mà không có hạn chế.

### Các bộ phân loại hiến pháp

Một dòng công việc song song: thay vì thay đổi các mô hình sau đào tạo, đào tạo các phân loại hạng nhẹ đọc các kết quả của mô hình hiến pháp và cổng. v1 (2023) có chi phí tính toán 23,7% . v2 (2026) là ~ 1% và có tỷ lệ tấn công thành công thấp nhất của bất kỳ phòng thủ Anthropic nào mà Anthropic đã thử nghiệm công khai. Không có jailbreak phổ quát được báo cáo vào đầu năm 2026.

Đây là mô hình phòng thủ lớp: CAI định hình hành vi; các phân loại áp dụng các tính không biến.

### Khi CAI phù hợp với gia đình

- InstructGPT: người học, RM, PPO.
- CAI / RLAIF: AI tạo ra các prefs từ nguyên tắc, RM, PPO.
- DPO / gia đình: mất mát trong dạng đóng trên các người (người hoặc AI).
- Đánh giá bản thân, tự phê bình: các nguyên tắc được nội bộ hóa, mô hình đóng nhiều vai trò.

Trục chính là "điểm mà tín hiệu ưu tiên đến từ đâu". Bài báo năm 2022 của CAI là sự chuyển đổi nghiêm trọng đầu tiên từ tín hiệu con người sang tín hiệu AI ở quy mô biên giới.

```figure
constitutional-ai
```

## Sử dụng nó

`code/main.py`mô hình CAI mô hình đã nội bộ hóa quy tắc sửa đổi. So sánh mô hình cơ bản, đồ chơi hình dạng RLHF và đồ chơi hình dạng CAI trên một bộ nhắc nhở kéo dài.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-constitution-writer.md`- Với một lĩnh vực (công trợ khách hàng, tư vấn y tế, trợ lý lập trình, công cụ nghiên cứu), soạn thảo một hiến pháp bốn cấp theo cấu trúc Claude năm 2026: tránh thảm họa, quy tắc nền tảng, đạo đức lĩnh vực, hữu ích.

## Các bài tập

1. Đi chạy`code/main.py`. So sánh tỷ lệ mã hiệu gây hại của mô hình cơ bản với phiên bản được đào tạo CAI.

2. Đọc hiến pháp năm 2026 của Anthropic (anthropic.com/news/claudes-constitution). Đặt ra một nguyên tắc sẽ xếp hạng Tier 1 và một nguyên tắc sẽ xếp hạng Tier 4. Tại sao cấu trúc ưu tiên quan trọng đối với xung đột?

3. Thiết kế một hiến pháp cho một trợ lý mã hóa AI. Định nghĩa cấp 1 (những lệnh hủy diệt thảm họa mà không được phê duyệt), cấp 2, cấp 3, cấp 4. Giữ mỗi cấp theo 3-5 nguyên tắc.

4. CAI thay thế labelers con người với labelers AI. Hãy đặt tên một chế độ thất bại giống như sycophancy vẫn có thể xảy ra trong RLAIF, và thiết kế một phát hiện cho nó.

5. Đọc phương pháp phân loại hiến pháp v2 (nếu có). Giải thích tại sao ~ 1% chi phí tổng hợp tính toán là một câu chuyện an toàn khác về chất lượng so với 23.7%.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Constitutional AI | "AI trained with principles" | Two-phase pipeline: self-critique-and-revise SFT, then RL from AI feedback |
| RLAIF | "RLHF without humans" | RL with preferences generated by an AI labeler; the rest of the pipeline is unchanged |
| Constitution | "the principles" | An ordered list of natural-language rules the critique/labeler model consults |
| Critique-and-revise | "the SFT loop" | Produce response → critique under a principle → revise → SFT target |
| Constitutional Classifier | "the output gate" | Lightweight classifier that evaluates outputs against the constitution and blocks/logs |
| Four-tier priority | "the conflict resolver" | 2026 Claude constitution hierarchy: catastrophic > platform > ethics > helpful |
| Feedback model | "the AI labeler" | The model that reads a principle and ranks a pair of completions |

## Đọc thêm

- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback (arXiv:2212.08073)](https://arxiv.org/abs/2212.08073) đường ống hai giai đoạn ban đầu
- [Anthropic — Claude's Constitution (Jan 2026)](https://www.anthropic.com/news/claudes-constitution) phiên bản viết lại bốn cấp năm 2026 CC0 1.0
- [Anthropic — Constitutional Classifiers (2024-2026)](https://www.anthropic.com/research/constitutional-classifiers) phòng thủ cửa ra với ~ 1% chi phí trên trong v2
- [Lee et al. — RLAIF vs RLHF: Scaling Reinforcement Learning from Human Feedback (arXiv:2309.00267)](https://arxiv.org/abs/2309.00267) So sánh empirical RLAIF / RLHF
- [Kundu et al. — Specific versus General Principles for Constitutional AI (arXiv:2310.13798)](https://arxiv.org/abs/2310.13798) hiệu ứng của nguyên tắc hạt
