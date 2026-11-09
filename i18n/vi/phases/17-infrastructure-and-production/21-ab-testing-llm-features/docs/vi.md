# A / B kiểm tra LLM Features  GrowthBook, Statsig, và Vibes vấn đề

> Việc kiểm tra A/B truyền thống không được xây dựng cho LLM không xác định. Sự phân biệt quan trọng: các đánh giá trả lời "có thể mô hình làm công việc này không?" Các thử nghiệm A / B trả lời "có người dùng quan tâm không?" Cả hai đều cần thiết; vận chuyển trên kiểm tra vibe đã kết thúc. Những gì phải thử nghiệm vào năm 2026: kỹ thuật nhanh chóng (lập luận), lựa chọn mô hình (GPT-4 vs GPT-3.5 vs OSS; độ chính xác vs chi phí vs thời gian trễ), các tham số sản xuất (giới nhiệt, top-p). Các trường hợp thực tế: một biến thể mô hình thưởng chatbot cung cấp +70% chiều dài cuộc trò chuyện và +30% lưu giữ; Các thí nghiệm dòng chủ đề AI Nextdoor cung cấp +1% CTR sau khi tinh chỉnh chức năng thưởng; Khan Academy Khanmigo lặp lại trên trục độ trễ so với độ chính xác toán học. Phân chia nền tảng: **Statsig**(được mua lại bởi OpenAI với giá 1,1 tỷ đô la vào tháng 9 năm 2025)  kiểm tra theo trình tự, CUPED, tất cả trong một. **GrowthBook** mã nguồn mở, nhà kho, Bayesian + Frequentist + động cơ theo trình tự, CUPED, kiểm tra SRM, Benjamini-Hochberg + Bonferroni sửa chữa. Bạn chọn dựa trên sở thích nhà kho-SQL và liệu "được mua bởi OpenAI" có quan trọng với tổ chức của bạn hay không.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy sequential test simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 20 (Progressive Deployment)
**Time:** ~60 minutes

## Mục tiêu học tập

- Sự khác biệt giữa các đánh giá ("có thể mô hình làm công việc") và các thử nghiệm A/B ("do users care").
- Đếm ba trục có thể kiểm tra (giải pháp, mô hình, tham số) và chọn số liệu cho mỗi trục.
- Giải thích CUPED, kiểm tra theo trình tự và sửa đổi so sánh nhiều lần của Benjamini-Hochberg.
- Chọn Statsig hoặc GrowthBook dựa trên tư thế kho-SQL và lập trường mua lại của công ty.

## Vấn đề

Bạn đã điều chỉnh một lời nhắc hệ thống. Nó cảm thấy tốt hơn. Bạn gửi nó. Thay đổi chuyển đổi bằng tiếng ồn. Bạn đổ lỗi cho các thước đo. hoặc bạn gửi một mô hình mới và chuyển đổi không di chuyển  mô hình đã xuống cấp hoặc thay đổi quá nhỏ để phát hiện? Bạn không biết, bởi vì bạn đã gửi mà không có A / B.

Các điểm Evals trả lời liệu mô hình có thể thực hiện một nhiệm vụ trên một bộ có nhãn hay không. Họ không trả lời liệu người dùng có thích đầu ra hay không. Chỉ một thí nghiệm trực tuyến được kiểm soát trả lời điều đó, và chỉ khi thí nghiệm có đủ sức mạnh, kiểm soát cho không xác định và sửa chữa cho nhiều so sánh.

## Khái niệm

### Các thử nghiệm Evals vs A/B

**Evals** offline, set được dán nhãn, thẩm phán (rubic hoặc LLM-as-judge hoặc con người).

**A/B test** trực tuyến, người dùng trực tiếp, ngẫu nhiên. Phản ứng: "Phác thức mới có di chuyển các métric cấp người dùng quan trọng không?"

Cả hai đều cần thiết. Evals bắt hồi phục trước khi tiếp xúc; A / B xác nhận tác động của sản phẩm sau đó.

### Điều gì để kiểm tra

1. **Prompt engineering** định dạng, cấu trúc hệ thống-giải pháp, ví dụ.
2. **Model selection** GPT-4 vs GPT-3.5-Turbo vs Llama-OSS. Métric: độ chính xác (các nhiệm vụ) + chi phí / yêu cầu + độ trễ P99.
3. **Generation parameters** nhiệt độ, top-p, max_tokens.

### CUPED  Giảm biến số

Các thí nghiệm được kiểm soát sử dụng dữ liệu trước thí nghiệm. Khác lại sự khác biệt trước giai đoạn trước khi so sánh sau giai đoạn. Giảm sự khác biệt điển hình: 30-70%.

Thực hiện: cả Statsig và GrowthBook thực hiện.

### Kiểm tra theo trình tự

A / B cổ điển giả định kích thước mẫu cố định. Các thử nghiệm theo dõi ("peek-and-decide") kiểm soát tỷ lệ dương tính sai dưới sự nhìn lặp lại. Các thủ tục theo dõi luôn hợp lệ (mSPRT, chuỗi sự tin tưởng của Howard) cho phép bạn dừng sớm về người chiến thắng rõ ràng.

### Các sửa đổi so sánh nhiều lần

Tiến hành 20 thử nghiệm A / B với sự tự tin 95% tạo ra một dương tính sai tình cờ.

### SRM  tỷ lệ mẫu không phù hợp

Hash phân bổ ngẫu nhiên người dùng thành biến thể. Nếu phân chia 50/50 cung cấp 47/53, một cái gì đó bị hỏng  SRM kiểm tra đánh dấu nó. Cả hai nền tảng thực hiện.

### Statsig vs GrowthBook

**Statsig**- Có thể là:
- Được mua bởi OpenAI với giá 1,1 tỷ USD (Tháng 9 năm 2025).
- Kiểm tra theo trình tự, CUPED, người sống sót.
- Tất cả trong một: cờ đặc trưng + thí nghiệm + khả năng quan sát.
- Đơn vị thích hợp nhất: nhóm đã muốn một sản phẩm được gói, không quan tâm đến quyền sở hữu của OpenAI.

**GrowthBook**- Có thể là:
- Open-source (MIT); warehouse-native (đọc trực tiếp từ Snowflake/BigQuery/Redshift).
- Nhiều động cơ: Bayesian, Frequentist, Sequential.
- CUPED, SRM, Bonferroni, BH sửa chữa.
- Self-host hoặc quản lý đám mây.
- Tích hợp tốt nhất: cửa hàng kho SQL, nhóm dữ liệu kiểm soát lớp mét, muốn OSS.

### Không quyết định nghĩa làm phức tạp quyền lực

Một số tính toán năng lượng truyền thống giả định các quan sát IID. Với LLM không xác định, kích thước mẫu hiệu quả thấp hơn danh nghĩa.

### Kết quả thực tế của trường hợp

- Phân biến mô hình thưởng chatbot: + 70% chiều dài cuộc trò chuyện, + 30% lưu giữ.
- Các dòng chủ đề tiếp theo: +1% CTR sau khi tinh chỉnh chức năng thưởng.
- Khan Academy Khanmigo: giao dịch trễ lặp lại so với độ chính xác toán học.

### Phản ứng: vận chuyển trên vibes

Mỗi kỹ sư cấp cao có thể đặt tên một tính năng được vận chuyển bởi vì "nó cảm thấy tốt hơn" mà không có A / B. Hầu hết các số liệu sản phẩm đã trở lại mà nhóm không nhận thấy trong nhiều tháng. A / B là chức năng buộc.

### Những con số mà bạn nên nhớ

- Statsig được OpenAI mua lại: $1.1B, tháng 9 năm 2025.
- GrowthBook: mã nguồn mở MIT; Bayesian + Frequentist + Sequential.
- Giảm biến biến số CUPED: 30-70%.
- LLM không xác định → +30-50% buffer kích thước mẫu.

```figure
mx-sequential-test
```

## Sử dụng nó

`code/main.py`mô phỏng một thử nghiệm A / B theo trình tự với ranh giới cố định và theo trình tự. cho thấy các thứ tự cho phép bạn dừng sớm.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-ab-plan.md`. Với sự thay đổi tính năng, tải trọng công việc, đường cơ sở, chọn nền tảng, cổng, kích thước mẫu.

## Các bài tập

1. Đi chạy`code/main.py`Đối với một nâng 5% dự kiến với chuyển đổi 3% cơ sở, kích thước mẫu nào đến 80% sức mạnh?
2. Chọn Statsig hoặc GrowthBook cho khách hàng được điều chỉnh bởi chăm sóc sức khỏe tại địa điểm.
3. Thiết kế một A/B để thử nghiệm GPT-4 so với GPT-3.5 trên chi phí cho mỗi vé được giải quyết.
4. Canary của bạn qua nhưng A/B cho thấy chuyển đổi -1,2%.
5. Sử dụng CUPED với một tỷ lệ đồng hóa trước thời kỳ giải thích 60% sự khác biệt sau thời gian (squared correlation 0,6).

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Eval | "offline test" | Labeled-set evaluation of model capability |
| A/B test | "experiment" | Live randomized comparison on users |
| CUPED | "variance reduction" | Pre-period regression to reduce variance |
| Sequential test | "peek-ok test" | Always-valid procedure allowing early stop |
| Multiple comparison | "the family error" | Running many tests inflates false positives |
| Bonferroni | "tight correction" | Divide α by number of tests |
| Benjamini-Hochberg | "BH FDR" | False-discovery-rate control, less conservative |
| SRM | "bad split" | Sample ratio mismatch; assignment bug |
| Statsig | "OpenAI owned" | Commercial all-in-one, acquired 2025 |
| GrowthBook | "the OSS one" | MIT warehouse-native platform |
| mSPRT | "sequential probability ratio test" | Classical sequential procedure |

## Đọc thêm

- [GrowthBook — How to A/B Test AI](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/)
- [Statsig — Beyond Prompts: Data-Driven LLM Optimization](https://www.statsig.com/blog/llm-optimization-online-experimentation)
- [Statsig vs GrowthBook comparison](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools)
- [Deng et al. — CUPED](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
- [Howard — Confidence Sequences](https://arxiv.org/abs/1810.08240)
