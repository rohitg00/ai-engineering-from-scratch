# Theo quy định của SOC 2, HIPAA, GDPR, PCI-DSS, EU AI Act, ISO 42001

> Bảo hiểm đa khung là những cổ phần bàn cho các giao dịch doanh nghiệp năm 2026. **EU AI Act**: có hiệu lực từ ngày 1 tháng 8 năm 2024. Hầu hết các yêu cầu rủi ro cao được thực thi ngày 2 tháng 8 năm 2026. Hình phạt lên đến 15 triệu euro hoặc 3% doanh thu hàng năm toàn cầu cho các nghĩa vụ hệ thống rủi ro cao (Công nghệ 99(4)); lên đến 35 triệu euro hoặc 7% cho các thực hành AI bị cấm (Công nghệ 99(3)).**Colorado AI Act**: có hiệu lực từ ngày 30 tháng 6 năm 2026 (đã trì hoãn từ tháng 2 năm 2026 bởi SB25B-004)  đánh giá tác động cho các hệ thống có rủi ro cao, quyền kháng cáo quyết định AI. Virginia tương tự cho tín dụng / việc làm / nhà ở / giáo dục. **SOC 2 Type II**: yêu cầu thực tế về AI B2B (Typ II, không phải Type I, cho fintech). **GDPR**: tiền phạt lớn nhất được ghi nhận về AI là 30,5 triệu euro đối với Clearview AI (DPA Hà Lan, tháng 9 năm 2024); Garante của Ý đã phát hành 15 triệu euro đối với OpenAI vào tháng 12 năm 2024 (sau đó bị đảo ngược khi kháng cáo vào tháng 3 năm 2026). Việc chỉnh sửa PII theo thời gian thực là tiêu chuẩn có thể bảo vệ; thanh lọc sau khi xử lý không đủ. **HIPAA**: chăm sóc sức khỏe bị ràng buộc không thể gửi PHI đến các dịch vụ AI bên ngoài mà không có BAA. **PCI-DSS**: Cụ thể của AI-interaction layer đòi hỏi cấu hình + thỏa thuận hợp đồng, không phải tự động. **ISO 42001**: tiêu chuẩn quản lý AI mới nổi, nhu cầu mua sắm ngày càng tăng cùng với ISO 27001. hồ sơ tham chiếu: OpenAI duy trì SOC 2 Type 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA) / FERPA, PCI-DSS cho các thành phần thanh toán ChatGPT. Khép đồ xuyên khung giảm mệt mỏi kiểm toán: kiểm soát truy cập bản đồ trên ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a).

**Type:** Learn
**Languages:** (Python, TypeScript optional: compliance is policy + process, not code)
**Prerequisites:** Phase 17 · 25 (Security), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Mục tiêu học tập

- Đặt danh sách bảy khung năm 2026 liên quan đến các sản phẩm LLM và phù hợp với từng phân khúc khách hàng.
- Citing thời gian thực thi của EU AI Act (nhu cầu có hiệu lực tháng 8 năm 2024; thực thi rủi ro cao tháng 8 năm 2026) và giới hạn phạt hai cấp (€ 15M / 3% đối với các nghĩa vụ rủi ro cao, € 35M / 7% đối với các hoạt động bị cấm).
- Giải thích tại sao việc làm sạch PII sau khi xử lý không đủ cho GDPR và đặt tên biên dịch lớp suy luận thời gian thực như tiêu chuẩn đáng bảo vệ.
- Mô tả bản đồ kiểm soát xuyên khung (ví dụ: bản đồ kiểm soát truy cập ISO 27001 A.5.15-5.18 + GDPR Art. 32 + HIPAA §164.312(a)).

## Vấn đề

Nhóm mua sắm của khách hàng doanh nghiệp yêu cầu SOC 2 Type II, GDPR, HIPAA BAA, ISO 27001, và "Báo cáo tuân thủ Luật AI EU". Nhóm của bạn có SOC 2 Type I. Bạn đã sáu tháng từ Type II và chưa bắt đầu ghi lại Điều 30 GDPR.

Bảo hiểm đa khung không phải là vấn đề LLM  đó là vấn đề Enterprise-SaaS, với các lớp phủ cụ thể của LLM. Các nhóm mua sắm vào năm 2026 muốn một matrix với một hàng trên mỗi khung và một cột trên mỗi điều khiển, không phải là một PDF.

## Khái niệm

### Bảy khung

| Framework | Scope | LLM-specific requirement |
|-----------|-------|--------------------------|
| SOC 2 Type II | B2B SaaS baseline | Process controls audited over 6-12 months |
| HIPAA | US healthcare | BAA required; PHI cannot leave infrastructure without signed agreement |
| GDPR | EU users | Real-time PII redaction; data subject rights; Article 30 records |
| PCI-DSS | Payment data | Configuration + contracts for AI touching payment |
| EU AI Act | Serving EU users | Risk tier classification; high-risk systems: conformity assessment, documentation, logging |
| Colorado AI Act | Serving CO residents | Impact assessments; right to appeal |
| ISO 42001 | AI governance | Emerging; pairs with ISO 27001 |

### Thời gian của EU AI Act

- Ngày 1 tháng 8 năm 2024: có hiệu lực.
- Ngày 2 tháng 2 năm 2025: thực thi các hoạt động AI bị cấm.
- Ngày 2 tháng 8 năm 2026: các hệ thống rủi ro cao được thực thi (phác định phù hợp, tài liệu, ghi chép).
- Tháng 8 năm 2027: hệ thống rủi ro cao trong sản phẩm theo luật pháp hài hòa.

Các cấp rủi ro: Không thể chấp nhận được (được cấm), rủi ro cao (sự tuân thủ + ghi chép), rủi ro hạn chế (tự minh bạch), rủi ro tối thiểu (không có ràng buộc). Hầu hết các dịch vụ SaaS LLM B2B có rủi ro hạn chế; rủi ro cao được đưa vào việc làm, tín dụng, giáo dục, thực thi pháp luật, di cư, dịch vụ thiết yếu.

Cồi thường (Công Điều 99): lên đến 15 triệu euro hoặc 3% doanh thu hàng năm toàn cầu cho vi phạm các nghĩa vụ hệ thống có rủi ro cao (Công Điều 99(4); lên đến 35 triệu euro hoặc 7% cho các hoạt động AI bị cấm (Công Điều 99(3)); tùy thuộc vào mức cao hơn.

### GDPR  biên tập thời gian thực là tiêu chuẩn

Việc làm sạch sau khi xử lý (tạo lại PII sau khi LLM thấy nó) không phải là một tư thế có thể bảo vệ  mô hình đã thấy dữ liệu.

- Việc công nhận thực thể trước khi gọi LLM.
- Đánh dấu liên tục (chương trình Mesh) bảo tồn ngữ nghĩa.
- Cung cấp chỉ các yêu cầu đã sửa đổi + đồng ý chọn vào nguyên liệu.

Việc thực thi gần đây: 30,5 triệu euro chống lại Clearview AI (DPA Hà Lan, tháng 9 năm 2024) là khoản phạt GDPR cụ thể nhất về AI được ghi chép cho đến nay; 15 triệu euro chống lại OpenAI (Garante của Ý, tháng 12 năm 2024) là khoản phạt cụ thể nhất về LLM, mặc dù nó đã bị đảo ngược khi kháng cáo vào tháng 3 năm 2026 và phán quyết vẫn đang được xem xét thêm.

### HIPAA  BAA không phải là tùy chọn

Bạn không thể gửi PHI đến các dịch vụ AI bên ngoài mà không có thỏa thuận liên kết kinh doanh được ký kết. Cả ba nền tảng LLM hyperscaler (Bedrock, Azure OpenAI, Vertex) đều cung cấp BAA. OpenAI trực tiếp API cung cấp BAA. Anthropic trực tiếp API cung cấp BAA.

### SOC 2 loại II

Loại I: các thiết kế và tài liệu điều khiển.
Loại II: các kiểm soát hoạt động hiệu quả trong 6-12 tháng.

Việc mua sắm B2B vào năm 2026 không được tính theo loại II. loại I là khởi động; loại II là cổng.

Các yếu tố điều tra phổ biến: nhật ký truy cập (người đã thấy cái gì), quản lý thay đổi (làm thế nào nó được triển khai), đánh giá rủi ro (tứ ba), phản ứng với sự cố (được thử nghiệm).

### Phân tích khung chéo

Một chính sách kiểm soát truy cập đáp ứng nhiều kiểm soát khung:

| Control | Frameworks |
|---------|-----------|
| Access logging | ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a) |
| Change management | ISO 27001 A.8.32, PCI DSS Req. 6, HIPAA breach-notification scope |
| Encryption in transit | ISO 27001 A.8.24, GDPR Art. 32, HIPAA §164.312(e) |
| Secrets management | ISO 27001 A.8.19, PCI DSS Req. 8, SOC 2 CC6.1 |

Các công cụ tuân thủ (Drata, Vanta, Secureframe) tự động hóa bản đồ này.

### ISO 42001  phát triển

Được công bố cuối năm 2023. Khóa quản lý AI bao gồm quản lý rủi ro, chất lượng dữ liệu, minh bạch, giám sát con người.

### Tương tự tham chiếu của OpenAI

OpenAI duy trì SOC 2 Type 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA) / FERPA, PCI-DSS cho các thành phần thanh toán ChatGPT. Đó là khoảng phần cược của bảng doanh nghiệp vào năm 2026.

### Những con số mà bạn nên nhớ

- Các khoản phạt của EU AI Act: lên đến 15 triệu euro / 3% (các nghĩa vụ rủi ro cao, Điều 99(4)); lên đến 35 triệu euro / 7% (các hoạt động bị cấm, Điều 99(3)).
- Việc thực thi luật AI của EU có nguy cơ cao: ngày 2 tháng 8 năm 2026.
- Hình phạt GDPR lớn nhất được ghi nhận về AI: € 30,5M, Clearview AI (DPA Hà Lan, tháng 9 năm 2024).
- Hình phạt GDPR lớn nhất cụ thể cho LLM: 15 triệu euro, OpenAI (Giáo cáo Garante của Ý, tháng 12 năm 2024; bị hủy bỏ khi kháng cáo vào tháng 3 năm 2026).
- SOC 2 cửa sổ loại II: 6-12 tháng điều khiển hoạt động.
- Ngày hiệu lực của Đạo luật AI Colorado: 30 tháng 6 năm 2026 (đã bị hoãn từ tháng 2 năm 2026 bởi SB25B-004).

```figure
i4-control-matrix
```

## Sử dụng nó

`code/main.py`là một bảng tính lập bản đồ tuân thủ trong Python  được kiểm soát, liệt kê các khung mà nó đáp ứng.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-compliance-matrix.md`- Với phân khúc khách hàng và địa lý, xác định các khung và kiểm soát cần thiết.

## Các bài tập

1. Khách hàng doanh nghiệp đầu tiên của bạn cần SOC 2 Type II, HIPAA BAA, EU AI Act tuyên bố.
2. Lớp xếp ba sản phẩm LLM giả định theo các cấp rủi ro của Đạo luật AI của EU.
3. Anh vô tình gửi PHI đến một nhà cung cấp mà không có BAA.
4. Thảo luận liệu ISO 42001 là "cần thiết vào năm 2026" cho một nhà cung cấp AI trung bình thị trường.
5. Chế hoạch các lĩnh vực nhật ký kiểm toán LLM của bạn (Phase 17 · 25) cho ít nhất ba kiểm soát khung.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SOC 2 Type II | "audited controls" | Controls operating over 6-12 months, independently attested |
| HIPAA BAA | "healthcare contract" | Business Associate Agreement; required for PHI |
| GDPR | "EU privacy" | Real-time PII redaction is the defensible 2026 standard |
| EU AI Act | "EU AI rules" | High-risk enforcement August 2026; €15M / 3% (high-risk obligations) — €35M / 7% (prohibited practices) |
| Colorado AI Act | "US AI state law" | June 30, 2026 effective (delayed by SB25B-004); impact assessments |
| ISO 42001 | "AI governance" | Emerging framework for AI risk + transparency |
| ISO 27001 | "security ISMS" | Information Security Management System baseline |
| Conformity assessment | "EU AI doc package" | High-risk requirement: docs, testing, logging |
| Cross-framework mapping | "one control, many frames" | Single policy satisfies multiple framework controls |

## Đọc thêm

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/) hồ sơ tuân thủ tham chiếu.
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act official text](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) Nguồn chính.
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205) Nguồn chính.
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) Tiêu chuẩn hệ thống quản lý AI.
