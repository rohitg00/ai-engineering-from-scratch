# Sự hiểu biết về tài liệu và biểu đồ

> Tài liệu không phải là hình ảnh. Một bản PDF, giấy khoa học, hóa đơn hoặc hình thức viết tay có bố cục, bảng, sơ đồ, ghi chú chân, tiêu đề và cấu trúc ngữ nghĩa mà sự hiểu biết hình ảnh đơn giản không thể nắm bắt được. Dòng trước VLM là một đường ống: Tesseract OCR + LayoutLMv3 + Heuristics khai thác bảng. Đợt VLM thay thế nó bằng các mô hình không OCR  Donut (2022), Nougat (2023), DocLLM (2023)  phát ra dấu hiệu cấu trúc trực tiếp. Đến năm 2026, biên giới chỉ là "giới thiệu hình ảnh trang cho Claude Opus 4.7 ở 2576px bản địa", và đầu ra đánh dấu cấu trúc được cung cấp miễn phí. Bài học này đọc được vòng cung ba thời đại của AI tài liệu.

**Type:** Build
**Languages:** Python (stdlib, layout-aware document parser skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 5 (NLP)
**Time:** ~180 minutes

## Mục tiêu học tập

- Giải thích ba thời đại của AI tài liệu: đường ống OCR, không OCR, VLM-đồng.
- Mô tả ba dòng đầu vào của LayoutLMv3: văn bản, bố cục (bbox), các bản vá hình ảnh, với sự che giấu thống nhất.
- So sánh Donut (không OCR, hình ảnh → đánh dấu), Nougat (biên khoa học → LaTeX), DocLLM (sản xuất nhận thức về bố cục), PaliGemma 2 (tự do VLM).
- Chọn mô hình tài liệu cho một nhiệm vụ mới (phần hóa đơn, báo cáo khoa học, biểu mẫu bằng tay, biên bản bằng tiếng Trung).

## Vấn đề

"Hiểu PDF này" là khó hiểu. Thông tin nằm trong:

- Nội dung văn bản (90% tín hiệu).
- Layout (chủ đề, ghi chú chân, thanh bên, định dạng hai cột).
- Bảng (các hàng, cột, các tế bào hợp nhất).
- Hình ảnh và sơ đồ.
- Những ghi chú bằng tay.
- Các font và kiểu chữ (tít hiệu so với thân hình).

Một hệ thống quan tâm đến hóa đơn cần biết "Total: $1,245" đến từ bên dưới bên phải, không phải từ một ghi chú chân.

## Khái niệm

### Thời đại 1  Đường ống OCR (trước năm 2021)

Thống cổ điển:

1. PDF → hình ảnh trên mỗi trang.
2. Tesseract (hoặc OCR thương mại) trích xuất văn bản với các hộp giới hạn mỗi từ.
3. Bộ phân tích bố trí xác định các khối (tên, bảng, đoạn).
4. Các cấu trúc bảng nhận dạng phân tích bảng.
5. Quy tắc miền + trường trích xuất regex.

Làm việc cho văn bản in sạch. Phá vỡ chữ viết tay, quét sơn, bảng phức tạp, kịch bản không tiếng Anh. Mỗi chế độ thất bại đòi hỏi một con đường ngoại lệ tùy chỉnh.

### TrOCR (2021)

TrOCR (Li et al., arXiv:2109.10282) đã thay thế CNN-CTC cổ điển của Tesseract bằng một bộ mã hóa-chế lập trình được đào tạo trên hình ảnh văn bản tổng hợp + thực.

### Thời đại 2  Không OCR (2022-2023)

Các mô hình không OCR đầu tiên nói: bỏ qua phát hiện hoàn toàn, bản đồ ảnh ảnh ảnh cho kết quả cấu trúc trực tiếp.

Donut (Kim et al., arXiv:2111.15664):
- Bộ chuyển đổi mã hóa-đánh mã, mã hóa là Swin-B.
- Output là JSON để hiểu hình thức, đánh dấu cho tổng kết, hoặc bất kỳ sơ đồ cụ thể nào về nhiệm vụ.
- Không OCR, không bố cục, không phát hiện.

Nougat (Blecher et al., arXiv:2308.13418):
- Được đào tạo đặc biệt về các bài báo khoa học.
- Khả năng phát ra là LaTeX / dấu xuống.
- xử lý các phương trình, bố cục nhiều cột, các số.
- Mô hình mà mọi người gọi.

Đây là những chuyên gia, không phải những người nói chung.

### LayoutLMv3 (2022)

Một bài hát khác. LayoutLMv3 (Huang et al., arXiv:2204.08387) giữ OCR nhưng thêm hiểu biết về bố cục:

- Ba dòng đầu vào: token văn bản OCR, hộp giới hạn 2D mỗi token, các bản vá hình ảnh.
- Mục tiêu đào tạo che giấu trên cả ba phương pháp (môn ngữ che giấu, các bản vá che giấu, bố cục che giấu).
- Dòng chảy xuống: phân loại, khai thác đơn vị, bảng QA.

LayoutLMv3 là đỉnh cao của sự hiểu biết tài liệu dựa trên OCR. Cung cấp mạnh mẽ trên các biểu mẫu và hóa đơn.

### DocLLM (2023)

DocLLM (Wang et al., arXiv:2401.00908, được gửi vào ngày 31 tháng 12 năm 2023, vì vậy ID mang một tiền tố tháng 1 năm 2024) là người anh em sinh của LayoutLM. Nên tạo ra các câu trả lời dạng miễn phí tùy thuộc vào các mã thông báo bố trí.

### Thời đại 3  VLM-native (2024+)

2024 VLM đã trở nên đủ tốt để thay thế đường ống hoàn toàn. Đưa hình ảnh toàn trang ở độ phân giải cao đến VLM, đặt câu hỏi, nhận câu trả lời.

- LLaVA-NeXT 336-tile AnyRes hoạt động cho các tài liệu nhỏ.
- Qwen2.5VL phân giải động xử lý 2048+ pixel theo bản địa.
- Claude Opus 4.7 hỗ trợ tài liệu 2576px.
- PaliGemma 2 (Thi 12 2024) đào tạo đặc biệt cho tài liệu + chữ tay.

Khoảng cách giữa ống VLM-native và ống OCR đã nhanh chóng đóng cửa.

- Văn bản cảnh (được viết tay + in, kịch bản hỗn hợp).
- Các bảng phức tạp với các tế bào hợp nhất.
- Các phương trình toán học được nhúng vào văn bản.
- Các hình ảnh với các chú thích văn bản.

Các đường ống OCR vẫn thắng:

- Lượng công việc quét sạch trên quy mô lớn nơi độ trễ mỗi trang quan trọng.
- Đán chắc của đường ống (sự thất bại quyết định so với ảo giác VLM).
- Môi trường được điều chỉnh đòi hỏi phải có kết quả OCR kiểm toán được.

### Biên giới Claude 4.7 / GPT-5

Với đầu vào bản địa 2576 pixel, VLM biên giới ghi nhận sự hiểu biết với độ chính xác gần như con người.

- DocVQA: Claude 4.7 ~ 95.1, PaliGemma 2 ~ 88.4, Nougat ~ 77.3, đường ống LayoutLMv3 ~ 83.
- ChartQA: Claude 4.7 ~ 92,2, GPT-4V ~ 78.
- VisualMRC: Claude 4.7 ~ 94.

Hỗng cách trong mô hình đóng cửa chủ yếu là độ phân giải và quy mô LLM cơ sở.

### Phương trình toán học và đầu ra LaTeX

Các bài báo khoa học cần phải có kết quả LaTeX chính xác cho các phương trình. Nougat được đào tạo về điều này. VLM được đào tạo với mục tiêu LaTeX (Qwen2.5-VL-Math, phái sinh Nougat) tạo ra LaTeX có thể sử dụng.

Đối với các đường ống giấy khoa học vào năm 2026: chuỗi Nougat trên PDF, sau đó là VLM trên các trang khó khăn.

### Tác giả

Tuy nhiên, nhiệm vụ phụ khó khăn nhất. Phép in hỗn hợp + chữ viết tay (bảng ghi chú của bác sĩ, biểu mẫu được điền) là nơi các đường ống OCR vẫn đánh bại VLM về chi phí.

### Công thức 2026

Đối với một dự án AI tài liệu mới:

- Hóa đơn in nguyên chất ở quy mô: LayoutLMv3 + quy tắc, hiệu quả về chi phí.
- Tài liệu hỗn hợp (khoa học + chữ tay + biểu mẫu): VLM bản địa (PaliGemma 2 hoặc Qwen2.5-VL).
- Nóng cho toán học, VLM cho số liệu.
- Quy định: đường ống OCR + xác thực VLM để kiểm tra chéo.

```figure
mm-doc-layout
```

## Sử dụng nó

`code/main.py`- Có thể là:

- Một tokeniser thức về bố cục đồ chơi: cho các cặp (text, bbox), tạo ra đầu vào kiểu LayoutLMv3.
- Một máy phát triển kế hoạch nhiệm vụ kiểu Donut: mẫu JSON cho các biểu mẫu.
- Một so sánh ngân sách token trên mỗi trang trên OCR-pipeline, Donut, Nougat và VLM-native.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-document-ai-stack-picker.md`. Với một dự án AI tài liệu (khu vực, quy mô, chất lượng, quy định), chọn giữa đường ống OCR, chuyên gia không OCR và VLM-native.

## Các bài tập

1. Dự án của ông là 10 triệu hóa đơn mỗi ngày.

2. Tại sao LayoutLMv3 vượt trội hơn CLIP-VLM trong hình thức QA nhưng kém trong scene-text?

3. Nougat tạo ra LaTeX. đề xuất một trường hợp thử nghiệm trong đó VLM-đổi phát bản địa đánh bại Nougat trên độ trung thành LaTeX, và một trường hợp trong đó Nougat thắng.

4. Đọc bài báo PaliGemma 2 (Google, 2024). Sự bổ sung dữ liệu đào tạo chính đã nâng lên độ chính xác tài liệu so với PaliGemma 1 là gì?

5. Thiết kế một hệ thống lai hợp pháp an toàn: đường ống OCR là chính, VLM là kiểm tra chéo thứ cấp. Làm thế nào để giải quyết bất đồng?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OCR pipeline | "Tesseract-style" | Stage-wise stack: detect -> OCR -> layout -> rules; deterministic, fragile |
| OCR-free | "Donut-style" | Image-to-output transformer that skips explicit OCR; single model |
| Layout-aware | "LayoutLM" | Input includes per-token bbox coordinates; unified masking across modalities |
| VLM-native | "Frontier VLM" | Feed page image directly to Claude/GPT/Qwen VLM at high resolution; no pipeline |
| DocVQA | "Doc benchmark" | Document VQA standard; most-cited score |
| Markup output | "LaTeX / MD" | Structured output format instead of free-form text; enables downstream automation |

## Đọc thêm

- [Li et al. — TrOCR (arXiv:2109.10282)](https://arxiv.org/abs/2109.10282)
- [Blecher et al. — Nougat (arXiv:2308.13418)](https://arxiv.org/abs/2308.13418)
- [Huang et al. — LayoutLMv3 (arXiv:2204.08387)](https://arxiv.org/abs/2204.08387)
- [Kim et al. — Donut (arXiv:2111.15664)](https://arxiv.org/abs/2111.15664)
- [Wang et al. — DocLLM (arXiv:2401.00908)](https://arxiv.org/abs/2401.00908)
