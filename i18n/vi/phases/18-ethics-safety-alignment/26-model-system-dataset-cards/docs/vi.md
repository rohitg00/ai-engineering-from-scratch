# Mô hình, hệ thống và Dataset Card

> Ba định dạng tài liệu cấu trúc minh bạch AI. Mô hình thẻ (Mitchell et al. 2019)  nhãn dinh dưỡng cho các mô hình: dữ liệu đào tạo, phân tích phân chia số lượng, các cân nhắc đạo đức, cảnh báo; chỉ 0,3% thẻ mô hình Hugging Face ghi nhận các cân nhắc đạo đức (Oreamuno et al. 2023). Các trang dữ liệu cho các tập dữ liệu (Gebru et al. 2018, CACM)  động lực, thành phần, quy trình thu thập, dán nhãn, phân phối, bảo trì; điện tử-đồ sơ tương tự. Các thẻ dữ liệu (Pushkarna et al., Google 2022)  chi tiết lớp học mô-đun (trường kính, kính viễn vọng, kính hiển vi) như các đối tượng biên giới cho các độc giả khác nhau. Những phát triển 2024-2025: sản xuất tự động thông qua LLM (CardGen, Liu et al. Các chi tiết của thẻ mô hình tương quan với tăng lên đến 29% tải về trên HF (Liang et al. 2024); chứng nhận có thể kiểm tra (Laminator, Duddu et al. 2024); các báo cáo về tính bền vững cho carbon/hơi nước (Jouneaux et al. Tháng 7 năm 2025); thẻ EU/ISO mới nổi. Thẻ hệ thống (Sidhpurwala 2024; minh bạch cấp hệ thống Meta; "Blueprints of Trust" arXiv:2509.20394)  Tài liệu hệ thống AI toàn diện bao gồm khả năng bảo mật, bảo vệ tiêm nhanh, phát hiện dữ liệu thoát, phù hợp với giá trị con người.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, model-card + datasheet + system-card generator)
**Prerequisites:** Phase 18 · 18 (safety frameworks), Phase 18 · 24 (regulatory)
**Time:** ~60 minutes

## Mục tiêu học tập

- Mô tả thẻ mô hình Mitchell et al. 2019 gốc và trang dữ liệu Gebru et al. 2018.
- Mô tả lớp kính thiên văn / periscopic / microscopic của thẻ dữ liệu.
- Mô tả thẻ hệ thống và bảo hiểm toàn diện của chúng.
- Cụ thể, các nhà sản xuất có thể sử dụng các sản phẩm có giá trị cao nhất trong ngành công nghiệp.

## Vấn đề

Các khung pháp lý (Học 24) và các chính sách an toàn phòng thí nghiệm (Học 18) đều yêu cầu tài liệu. Các định dạng tài liệu đã phát triển từ mô hình cụ thể (học mô hình) đến tập hợp dữ liệu cụ thể (bảng dữ liệu) đến hệ thống cụ thể (học hệ thống). Mỗi đề cập đến phạm vi minh bạch khác nhau. Công việc tự động hóa và chứng thực có thể xác minh 2024-2025 giải quyết vấn đề chấp nhận lâu dài.

## Khái niệm

### Mô hình thẻ (Mitchell et al. 2019)

Các phần:
- Chi tiết mô hình.
- Sử dụng dự định.
- Các yếu tố (nhiều yếu tố nhân khẩu học hoặc môi trường có liên quan để đánh giá).
- Métrics.
- Dữ liệu đánh giá.
- Dữ liệu huấn luyện.
- Các phân tích số (được phân chia theo các yếu tố).
- Những quan điểm đạo đức.
- Các hang và khuyến nghị.

Vấn đề nhận nuôi: Oreamuno et al. 2023 kiểm tra thẻ mẫu Hugging Face chỉ tìm thấy 0,3% tài liệu các cân nhắc đạo đức.

### Các trang dữ liệu cho các tập dữ liệu (Gebru et al. 2018)

Phân tích bảng dữ liệu điện tử.
- Động lực (tại sao bộ dữ liệu được tạo ra).
- Thành phần (điều gì trong nó).
- Quá trình thu thập (làm thế nào nó được lắp ráp).
- Đánh nhãn (nếu có).
- Sử dụng (được dự định, bị cấm, rủi ro).
- Chuyển phát.
- Bảo trì.

Được công bố trong CACM 2021. Bảng dữ liệu là tài liệu dòng chảy; thẻ mô hình phụ thuộc vào tính chính xác của bảng dữ liệu.

### Các thẻ dữ liệu (Pushkarna et al., Google 2022)

Chi tiết lớp hợp nhất. Ba cấp độ phóng to:
- **Telescopic.**Tổng kết cấp cao cho người không phải chuyên gia.
- **Periscopic.**Đồ chung cấp trung bình cho các chuyên gia ML.
- **Microscopic.**Tài liệu chi tiết cấp tính năng cho các kiểm toán viên.

Quát định đối tượng giới hạn: người đọc khác nhau trích xuất thông tin khác nhau từ cùng một tài liệu.

### Các thẻ hệ thống

phạm vi: hệ thống AI toàn diện bao gồm mô hình + dung lượng an toàn + bối cảnh triển khai.
- Khả năng an ninh.
- Bảo vệ tiêm ngay.
- Khám phá dữ liệu-exfiltration.
- Sự phù hợp với các giá trị của con người.
- Đáp ứng vụ tai nạn.

Sidhpurwala 2024 và Meta làm việc minh bạch ở cấp độ hệ thống. "Bộ vẽ của niềm tin" (arXiv:2509.20394) chính thức hóa Thẻ Hệ thống như là sự bổ sung lớp triển khai cho Thẻ mô hình.

### Sự phát triển 2024-2025

- **CardGen (Liu et al. 2024).**Tạo ra thẻ mô hình tự động thông qua LLM; báo cáo tính khách quan cao hơn nhiều thẻ do con người viết trên các lĩnh vực Mitchell 2019 tiêu chuẩn hóa.
- **Download correlation (Liang et al. 2024).**Các thẻ mô hình chi tiết tương quan với tỷ lệ tải xuống cao hơn đến 29% trên áp lực áp dụng HF  hiện nay được thúc đẩy bởi thị trường, không chỉ dựa trên tuân thủ.
- **Laminator (Duddu et al. 2024).**Các chứng chỉ có thể xác minh thông qua chữ ký TEE / mã hóa phần cứng  cho phép thẻ mô hình mang theo bằng chứng về yêu cầu, không chỉ là yêu cầu.
- **Sustainability (Jouneaux et al. July 2025).**Các bổ sung cho carbon, nước và dấu chân năng lượng tính toán; các tiêu chuẩn ISO mới nổi.
- **Regulatory cards.**Luật AI của EU (Học 24) Chương GPAI Quy tắc thực hành Cải minh đòi hỏi các thẻ mô hình là một vật liệu tuân thủ.

### Khi điều này phù hợp với giai đoạn 18

Bài học 24-25 là các lớp quy định và CVE. Bài học 26 là lớp tài liệu. Bài học 27 là quản lý dữ liệu đào tạo, đó là dòng chảy trên của trang dữ liệu. Bài học 28 là hệ sinh thái nghiên cứu sản xuất các đánh giá được tham chiếu trong thẻ.

```figure
an-card-scopes
```

## Sử dụng nó

`code/main.py`tạo ra một thẻ mô hình tối thiểu, tờ dữ liệu và thẻ hệ thống cho việc triển khai đồ chơi. Mỗi một trong số đó theo cấu trúc phần quy luật. Bạn có thể kiểm tra định dạng và so sánh ba phạm vi.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-card-audit.md`Với một thẻ mẫu, tờ dữ liệu hoặc thẻ hệ thống, nó kiểm tra bảo hiểm phần, phân tích số và liệu có chứng chỉ có thể kiểm tra được hay không.

## Các bài tập

1. Đi chạy`code/main.py`- Kiểm tra các thẻ được tạo ra. Xác định các phần yếu (chỉ dành cho người giữ chỗ) và xác định bằng chứng nào sẽ củng cố chúng.

2. Cải tiến thẻ mô hình bằng cách phân tích phân tích số lượng trên hai nhóm nhân khẩu học (Học 20).

3. Đọc Oreamuno et al. 2023 về tỷ lệ chấp nhận 0,3%. đề xuất một thay đổi cấu trúc cho mô hình thẻ đặc tả sẽ tăng cường việc chấp nhận các cân nhắc đạo đức.

4. Laminator (Duddu et al. 2024) sử dụng TEE cho các chứng chỉ có thể kiểm chứng. Thiết kế một trường mẫu thẻ mang theo chứng chỉ mã hóa về kết quả đánh giá và mô tả vai trò của người xác minh.

5. Viết một thẻ hệ thống (System Card, không phải Model Card) cho một trong các dự án trước đây của bạn hoặc một triển khai giả thuyết.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Model Card | "the Mitchell card" | Mitchell et al. 2019 standard documentation for ML models |
| Datasheet | "the Gebru datasheet" | Gebru et al. 2018 standard documentation for datasets |
| Data Card | "the Pushkarna card" | Google 2022 modular layered data documentation |
| System Card | "the deployment card" | End-to-end AI system documentation including safety stack |
| Boundary object | "different readers, one doc" | Data Cards framing: same document serves diverse audiences |
| Verifiable attestation | "the Laminator attestation" | Cryptographic or TEE proof attached to a documentation claim |
| Sustainability field | "carbon / water footprint" | Emerging 2025 addition for environmental accounting |

## Đọc thêm

- [Mitchell et al. — Model Cards for Model Reporting (arXiv:1810.03993, FAT* 2019)](https://arxiv.org/abs/1810.03993) thẻ mô hình kinh điển
- [Gebru et al. — Datasheets for Datasets (CACM 2021, arXiv:1803.09010)](https://arxiv.org/abs/1803.09010) giấy tờ dữ liệu
- [Pushkarna et al. — Data Cards (Google 2022)](https://arxiv.org/abs/2204.01075) Tài liệu dữ liệu lớp
- [Sidhpurwala et al. — Blueprints of Trust (arXiv:2509.20394)](https://arxiv.org/abs/2509.20394) Việc chính thức hóa thẻ hệ thống
