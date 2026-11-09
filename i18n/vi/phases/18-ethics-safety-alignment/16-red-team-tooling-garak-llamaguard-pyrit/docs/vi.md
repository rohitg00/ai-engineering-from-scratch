# Đội Red Tooling  Garak, Llama Guard, PyRIT

> Ba công cụ sản xuất khung các đội đỏ 2026 xếp hàng. Llama Guard (Meta)  một bộ phân loại Llama-3.1-8B được điều chỉnh tốt trên 14 loại nguy cơ MLCommons; Llama Guard 4 năm 2025 là một bộ phân loại đa phương thức 12B được cắt từ Llama 4 Scout. Garak (NVIDIA)  Tấm mã mở của scanner lỗ hổng LLM với các thăm dò tĩnh, động và thích ứng cho ảo giác, rò rỉ dữ liệu, tiêm nhanh, độc tính và jailbreaks. PyRIT (Microsoft)  nhiều vòng đội đỏ chiến dịch với Crescendo, TAP, và chuỗi chuyển đổi tùy chỉnh cho khai thác sâu. Llama Guard 3 được ghi lại trong Meta's "Llama 3 Herd of Models" (arXiv:2407.21783); Llama Guard 3-1B-INT4 trong arXiv:2411.17713; kiến trúc thăm dò của Garak trong github.com/NVIDIA/garak. Những công cụ này là giao diện sản xuất năm 2026 giữa nghiên cứu nhóm đỏ (Dân học 12-15) và triển khai (Dân học 17+).

**Type:** Build
**Languages:** Python, TypeScript (stdlib, tool-architecture simulator and Llama Guard-style classifier mock)
**Prerequisites:** Phase 18 · 12-15 (jailbreaks and IPI)
**Time:** ~75 minutes

## Mục tiêu học tập

- Mô tả vị trí của Llama Guard 3/4 trong đống an toàn: phân loại đầu vào, phân loại đầu ra hoặc cả hai.
- Hãy nêu tên 14 loại nguy cơ MLCommons và chỉ ra một loại không rõ ràng (Việc lạm dụng thông dịch mã).
- Mô tả kiến trúc thăm dò của Garak: thăm dò, máy dò, dây đeo.
- Mô tả cấu trúc chiến dịch nhiều lượt của PyRIT và cách nó kết hợp với các thăm dò Garak.

## Vấn đề

Bài học 12-15 trình bày bề mặt tấn công. Việc triển khai sản xuất cần đánh giá lặp lại, có thể mở rộng. Ba công cụ thống trị năm 2026: Llama Guard (chính định phòng thủ), Garak (tài duyệt), PyRIT (các tổ chức chiến dịch). Mỗi mục tiêu là một lớp khác nhau của vòng đời đội đỏ.

## Khái niệm

### Llama Guard (Meta)

Llama Guard 3 là một mô hình Llama-3.1-8B được điều chỉnh tốt để phân loại đầu vào / ra ngoài trên các loại MLCommons AILuminate 14:
- Hành vi bạo lực, tội phạm không bạo lực, liên quan đến tình dục, CSAM, sự sỉ nhục
- Tư vấn chuyên môn, quyền riêng tư, IP, vũ khí vô phân biệt, thù hận
- Tự tử/ngăn thương bản thân, nội dung tình dục, bầu cử, lạm dụng người giải thích mã

Hỗ trợ 8 ngôn ngữ. Sử dụng: đặt trước LLM (trình độ nhập), sau LLM (trình độ sản xuất), hoặc cả hai.

Llama Guard 3-1B-INT4 (arXiv:2411.17713, 440MB, ~ 30 token / s trên CPU di động) là biến thể cạnh lượng tử.

Llama Guard 4 (ngày 4 tháng 4 năm 2025) là 12B, đa phương tiện, được cắt từ Llama 4 Scout. Nó thay thế cả văn bản 8B và tiền nhiệm tầm nhìn 11B bằng một trình phân loại hấp thụ văn bản + hình ảnh.

### Garak (NVIDIA)

Bộ quét lỗ hổng nguồn mở.
- **Probes.**Các máy phát điện tấn công cho ảo giác, rò rỉ dữ liệu, tiêm nhanh, độc tính, jailbreak.
- **Detectors.**Kết quả kết quả với các chế độ thất bại dự kiến  độc, rò rỉ, jailbreak.
- **Harnesses.**Quản lý các cặp dò dò, chạy chiến dịch, tạo ra báo cáo.

TrustyAI tích hợp Garak với các tấm khiên Llama-Stack (Prompt-Guard-86M phân loại đầu vào, Llama-Guard-3-8B phân loại đầu ra) để đánh giá mục tiêu được bảo vệ từ đầu đến cuối. Điểm số dựa trên cấp (TBSA) thay thế pass / fail nhị phân.

### PyRIT (Microsoft)

Python Risk Identification Toolkit, nhiều chiến dịch của nhóm đỏ.
- **Converters.**Chuyển đổi một lời nhắc hạt giống  phrasing, mã hóa, dịch, role play.
- **Orchestrators.**Tiến hành chiến dịch: Crescendo (sự leo thang), TAP (các chi nhánh), RedTeaming (lòng tùy chỉnh).
- **Scoring.**LLM- như thẩm phán hoặc phân loại như thẩm phán.

PyRIT là người anh em họ nặng hơn của Garak. Garak chạy hàng ngàn tàu thăm dò quay một lần; PyRIT chạy các chiến dịch nhiều lượt sâu được thiết kế để phá vỡ các chế độ thất bại cụ thể.

### - Đám

Đặt Llama Guard ở cả hai bên của mô hình. chạy Garak mỗi đêm để hồi phục. chạy PyRIT cho các chiến dịch trước khi phát hành. Đây là cấu hình mặc định 2026 cho hầu hết các triển khai sản xuất.

### Các bẫy đánh giá

- **Judge identity.**Cả ba công cụ đều có thể sử dụng một thẩm phán LLM; các ổ đĩa hiệu chuẩn thẩm phán báo cáo ASR (Dạy 12.
- **Probe staleness.**Garak thám tử tuổi khi các mô hình được dán vào chúng. thám tử thích ứng (PAIR hình dạng) tuổi chậm hơn các thám tử tĩnh.
- **Llama Guard FPR on benign content.**Các phiên bản Llama Guard sớm có nội dung chính trị và LGBTQ +; Llama Guard 3/4 hiệu chuẩn được cải thiện nhưng không được hiệu chuẩn cho mỗi triển khai.

### Khi điều này phù hợp với giai đoạn 18

Bài học 12-15 là các gia đình tấn công. Bài học 16 là công cụ sản xuất. Bài học 17 (WMDP) là đánh giá khả năng sử dụng kép. Bài học 18 là các khung an toàn biên giới bao gồm các công cụ này trong một cấu trúc chính sách.

```figure
al-guard-stack
```

## Sử dụng nó

`code/main.py`xây dựng một bộ phân loại kiểu đồ chơi Llama Guard (từ khóa + tính năng ngữ nghĩa trên 14 loại), một vòng xoáy đồ chơi Garak (lòng dò dò), và một chuỗi chuyển đổi nhiều vòng kiểu PyRIT. Bạn có thể chạy ba công cụ chống lại một mục tiêu giả và quan sát các chữ ký bảo hiểm khác nhau.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-red-team-stack.md`Với mô tả triển khai, nó nêu tên những công cụ nào trong ba công cụ phù hợp, điều gì để cấu hình trong mỗi công cụ và thời gian quay trở nào để chạy.

## Các bài tập

1. Đi chạy`code/main.py`So sánh tốc độ phát hiện của bộ phân loại kiểu Llama-Guard trên các cuộc tấn công một lần và nhiều lần.

2. Thực hiện một con tàu Garak mới: một yêu cầu gây hại mã hóa base64. đo được phát hiện của nó bằng bộ phân loại kiểu Llama-Guard.

3. Cải rộng chuỗi chuyển đổi kiểu PyRIT bằng một chuyển đổi "t dịch sang tiếng Pháp, sau đó phác thảo".

4. Đọc danh sách các danh mục nguy hiểm của Llama Guard 3. Xác định hai danh mục mà dữ liệu đào tạo thực tế sẽ tạo ra tỷ lệ dương tính sai cao đối với nội dung phát triển hợp pháp.

5. So sánh các nguyên tắc thiết kế của Garak và PyRIT. Phúc tụi việc triển khai nơi mỗi công cụ là công cụ phù hợp.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Llama Guard | "the classifier" | Fine-tuned Llama-3.1-8B/4-12B safety classifier with 14 hazard categories |
| Garak | "the scanner" | NVIDIA open-source vulnerability scanner; probes, detectors, harnesses |
| PyRIT | "the campaign tool" | Microsoft multi-turn red-team orchestrator; converters, orchestrators, scoring |
| Prompt-Guard | "the small classifier" | Meta's 86M prompt-injection classifier, paired with Llama Guard |
| TBSA | "tier-based scoring" | Garak's tier-based pass/fail replacing binary outcomes |
| Converter chain | "paraphrase + encode + ..." | PyRIT composition primitive for building multi-step attacks |
| MLCommons hazard categories | "the 14 taxonomies" | Industry-standard taxonomy Llama Guard targets |

## Đọc thêm

- [Meta — Llama Guard 3 (in Llama 3 Herd paper, arXiv:2407.21783)](https://arxiv.org/abs/2407.21783) Bộ phân loại 8B
- [Meta — Llama Guard 3-1B-INT4 (arXiv:2411.17713)](https://arxiv.org/abs/2411.17713) Bộ phân loại di động định lượng
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) bộ nhớ và tài liệu của máy quét
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) bộ công cụ chiến dịch
