# WMDP và đánh giá khả năng sử dụng hai lần

> Li et al., "The WMDP Benchmark: Measuring and Reducing Malicious Use With Unlearning" (ICML 2024, arXiv:2403.03218). 4.157 câu hỏi đa lựa chọn về an ninh sinh học (1.520), an ninh mạng (2.225) và hóa học (412). Các câu hỏi hoạt động trong "vùng vàng"  gần khả năng kiến thức, được lọc bằng đánh giá đa chuyên gia và tuân thủ pháp lý ITAR/EAR. Mục đích hai: đánh giá đại diện về khả năng sử dụng hai lần, và điểm chuẩn không học (phương pháp RMU đồng hành làm giảm hiệu suất WMDP trong khi vẫn giữ lại khả năng chung). 2024-2025 câu chuyện về lĩnh vực: các đánh giá đầu tiên của OpenAI / Anthropic 2024 báo cáo "sự nâng cao nhẹ" trên tìm kiếm trên Internet; vào tháng 4 năm 2025, OpenAI's Preparedness Framework v2 cho biết các mô hình đang "ở trên bờ vực giúp người mới bắt đầu tạo ra những mối đe dọa sinh học được biết đến".

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, WMDP-shaped uplift evaluation harness)
**Prerequisites:** Phase 18 · 16 (red-team tooling), Phase 14 (agent engineering)
**Time:** ~60 minutes

## Mục tiêu học tập

- Mô tả ba miền của WMDP, số lượng câu hỏi và tiêu chí lọc "vùng vàng".
- Giải thích RMU và lý do tại sao WMDP là cả một đánh giá và một tiêu chuẩn không học tập.
- Mô tả câu chuyện nâng cao 2024-2025: "phát nâng nhẹ" -> "ở đỉnh" -> "không đủ để loại trừ ASL-3".
- Sự khác biệt giữa sự nâng cao tương đối với người mới bắt đầu và khả năng tuyệt đối của chuyên gia.

## Vấn đề

Khả năng sử dụng hai lần là vấn đề đo lường trong khuôn khổ an toàn biên giới của mỗi phòng thí nghiệm (Học 18). Câu hỏi: mô hình X có nâng cao khả năng gây hại lớn cho người mới bắt đầu trong sinh học, hóa học, hoặc mạng không? Việc đo lường trực tiếp (hãy yêu cầu mô hình thực sự tạo ra thiệt hại) là bất hợp pháp và không đạo đức. Đánh giá đại diện cần một điểm chuẩn mà mô hình không thể từ chối (đưa ra các số khả năng trung thực) nhưng những câu hỏi của nó không phải là bản thân các ấn phẩm có hại.

## Khái niệm

### "Thùng vàng"

Những câu hỏi đòi hỏi sự gần gũi, cho phép biết về một quá trình gây hại mà không phải là một công thức tổng hợp trực tiếp. "Điều phản ứng nào xúc tác bước 4 của [cách xuất bản]?" chứ không phải "làm thế nào tôi làm ra [công hợp nguy hiểm]?" Mỗi câu hỏi được xem xét bởi nhiều chuyên gia lĩnh vực; lọc để tuân thủ ITAR / EAR kiểm soát xuất khẩu.

Tổng cộng 4.157 câu hỏi:
- Biosight: 1.520
- An ninh mạng: 2.225
- Hóa học: 412

Mô hình đa lựa chọn: mô hình trả lời mà không được yêu cầu hỗ trợ bất cứ điều gì; khả năng có thể được đo mà không gây ra hành vi gây hại.

### RMU  Định hướng sai lầm về việc không học

Phương pháp học tập không học kèm theo. Được áp dụng cho LLaMa-2-7B, giảm điểm WMDP gần như ngẫu nhiên trong khi vẫn giữ MMLU và các điểm tham khảo khả năng chung khác trong vòng vài điểm phần trăm. Phương pháp được công bố là cơ sở học tập không học cho mỗi bài học học không học sinh hóa-tự do tiếp theo.

### Câu chuyện nâng cao 2024-2025

Ba giai đoạn:

1. **2024 "mild uplift."**Các đánh giá đầu tiên của OpenAI và Anthropic Preparedness / RSP báo cáo về những lợi thế nhỏ so với tìm kiếm trên Internet cho người mới bắt đầu thử các nhiệm vụ sinh học gần đó.

2. **April 2025 "on the cusp."**OpenAI's Preparedness Framework v2 báo cáo các mô hình "được chuẩn bị để giúp đỡ người mới bắt đầu tạo ra những mối đe dọa sinh học được biết đến". Không phải là một tuyên bố khả năng  cảnh báo rằng đỉnh điểm đã gần.

3. **Anthropic's 2025 bioweapon-acquisition trial.**Nghiên cứu kiểm soát với những người tham gia mới bắt đầu, đo thành công tương đối trong các nhiệm vụ giai đoạn thu thập. báo cáo tăng 2.53x. Không đủ để loại trừ ASL-3 (Dạy 18)  ngưỡng cho Chính sách quy mô có trách nhiệm cấp 3 của Anthropic được đáp ứng hoặc gần.

### Người mới bắt đầu tương đối với chuyên gia tuyệt đối

Một sự khác biệt quan trọng:

- **Novice-relative uplift.**Mô hình này giúp một người không chuyên gia bao nhiêu?
- **Expert-absolute capability.**Một chuyên gia có thể thu thập được nhiều hơn một người mới bắt đầu.

Các trường hợp an toàn (Dạy học 18) nhắm đến cả hai: "mô hình không thể cho người mới bắt đầu đủ nâng cao để thực hiện" cộng với "một chuyên gia không thể trích xuất thông tin từ mô hình chưa được công bố".

### Bẫy đo

WMDP là một đại diện khả năng, không phải là một phép đo triển khai. Một mô hình có điểm cao trên WMDP có thể hoặc không thể được khai thác bởi một người mới bắt đầu trong thực tế, tùy thuộc vào:
- Kháng kháng kích hoạt (não cần phải làm hỏng bộ lọc an toàn)
- Kiến thức ngầm (khả năng đòi hỏi kỹ năng trong phòng thí nghiệm ướt, không phải thông tin)
- Các rào cản thực hiện (tiền mua sắm, thiết bị)

Thử nghiệm mua vũ khí sinh học năm 2025 của Anthropic thêm lớp tạo ra mới trên cùng khả năng kiểu WMDP: nó đo lường thành công thực tế của nhiệm vụ, chứ không phải khả năng lựa chọn nhiều.

### Khi điều này phù hợp với giai đoạn 18

Bài học 12-16 là tấn công và công cụ phòng thủ trên các sản phẩm mô hình. Bài học 17 là lớp khả năng sử dụng kép  đo lường mà các khung an toàn biên giới ( Bài học 18) đánh giá. Bài học 30 đóng cung với bằng chứng nâng cao mạng / sinh học / hóa học / hạt nhân hiện tại năm 2026.

```figure
al-wmdp-yellow-zone
```

## Sử dụng nó

`code/main.py`xây dựng một vòng đánh giá hình đồ chơi WMDP. Một mô hình giả được thử nghiệm trên các câu hỏi liên kết với các loại; điểm số cho mỗi miền được báo cáo. Một can thiệp không học tập đơn giản (khuyến biểu diễn cụ thể cho miền không) làm giảm điểm số; bạn có thể đo lường sự thỏa hiệp so với khả năng chung.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-wmdp-eval.md`. Với một tuyên bố khả năng sử dụng kép ("chương trình của chúng tôi không giúp ích đáng kể với vũ khí sinh học"), nó kiểm toán: các tiêu chuẩn tham chiếu đã được chạy, con đường từ chối nào đã được sử dụng để đánh giá (làm hoàn thành nguyên liệu so với chính sách), và liệu các nghiên cứu tạo ra sự bổ sung cho kết quả lựa chọn đa.

## Các bài tập

1. Đi chạy`code/main.py`- Báo cáo chính xác cho từng lĩnh vực trước và sau bước giải trí đồ chơi.

2. Tăng đồ chơi WMDP với một lĩnh vực thứ tư (ví dụ, hình xạ). Định nghĩa hai loại câu hỏi minh họa trong vùng màu vàng. Giải thích tại sao việc tạo ra những câu hỏi như vậy khó hơn là thêm câu hỏi hình MMLU.

3. Đọc WMDP 2024 Phần 5 (Phương pháp RMU). Bác thảo một cách tiếp cận không học đơn giản hơn (ví dụ: ức chế các tế bào thần kinh top-k cho nội dung miền) và mô tả chi phí khả năng chung dự kiến của nó.

4. Phương pháp thử nghiệm mua vũ khí sinh học của Anthropic 2025 báo cáo tăng 2.53 lần. Mô tả hai cách số này có thể bị thiên vị lên (kích thước mẫu mới, độ trung thành nhiệm vụ) và hai cách giảm (vị trần dẫn, cửa an toàn mô hình).

5. Định nghĩa những gì một trường hợp an toàn cho ASL-3 đòi hỏi ngoài việc vượt qua việc không học WMDP.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| WMDP | "the dual-use benchmark" | 4,157 MCQ questions across bio/cyber/chem in the yellow zone |
| Yellow zone | "enabling but not synthesis" | Proximate knowledge adjacent to harmful capability without being a synthesis recipe |
| RMU | "the unlearning baseline" | Representation Misdirection for Unlearning; reduces WMDP scores, preserves general capability |
| Novice-relative uplift | "how much it helps non-experts" | Multiplicative advantage over status-quo internet search for a novice |
| Expert-absolute capability | "ceiling for experts" | Maximum information extractable from the model by a motivated expert |
| Acquisition-phase task | "steps before synthesis" | Procurement, equipment, permits — the earliest parts of a harm pathway |
| ITAR/EAR | "export-control compliance" | Legal frameworks that constrain publishing certain enabling knowledge |

## Đọc thêm

- [Li et al. — The WMDP Benchmark (arXiv:2403.03218, ICML 2024)](https://arxiv.org/abs/2403.03218) báo giá chuẩn và giấy RMU
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) "tại bờ vực"
- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) Tỉ lệ sinh học ASL-3 và kết quả thử nghiệm thu nhập
- [DeepMind — Frontier Safety Framework v3.0 (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) CCL nâng sinh học
