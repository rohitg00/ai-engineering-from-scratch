# Quản lý dữ liệu và đào tạo - Quản lý dữ liệu

> Luật AI của EU yêu cầu các tiêu chuẩn từ chối được đọc máy cho GPAI vào tháng 8 năm 2025 (thông qua Điều khoản Bản quyền EU ngoại lệ TDM). California AB 2013 (được ký vào năm 2024)  Hiển thị dữ liệu đào tạo AI tạo đòi hỏi các nhà phát triển phải xuất bản một bản tóm tắt các tập hợp dữ liệu với 12 lĩnh vực được ủy quyền. 2025 DPA phù hợp với lợi ích hợp pháp: DPC Ireland (21 tháng 5 năm 2025) chấp nhận đào tạo LLM của Meta về nội dung người lớn EU / EEA công khai bên đầu tiên với các biện pháp bảo vệ sau khi ý kiến của EDPB; Tòa án khu vực cao cấp Cologne (23 tháng 5 năm 2025) bác bỏ lệnh cấm; DPA Hamburg giảm cấp thiết; ICO của Anh (23 tháng 9 năm 2025) đưa ra phản ứng pháp lý tích cực đối với các biện pháp bảo vệ đào tạo AI của LinkedIn (trán minh, đơn giản hóa bỏ phiếu, mở rộng cửa sổ phản đối) và tiếp tục giám sát không phải là một thông tin chính thức. ANPD Brazil (2 tháng 7 năm 2024) đã đình chỉ việc xử lý của Meta vì không đủ minh bạch thông tin; biện pháp phòng ngừa đã được gỡ bỏ vào ngày 30 tháng 8 năm 2024 sau khi Meta nộp một kế hoạch tuân thủ. Vấn đề không thể đảo ngược chính: các khung cookie được thiết kế để theo dõi theo thời gian thực, đảo ngược; một khi dữ liệu ở trọng lượng mô hình, xóa phẫu thuật là không thể  không có quyền xóa GDPR thực tế cho các mạng thần kinh được đào tạo. Chiếc cửa sổ tuân thủ là vào thời điểm thu thập. Data Provenance Initiative (dataprovenance.org, Longpre, Mahari, Lee et al., "Consent in Crisis", tháng 7 năm 2024): kiểm toán quy mô lớn cho thấy sự suy giảm nhanh chóng của các thông tin chung AI khi các nhà xuất bản thêm các hạn chế robots.txt.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, 12-field California AB 2013 scaffolding generator)
**Prerequisites:** Phase 18 · 24 (regulatory), Phase 18 · 26 (cards)
**Time:** ~60 minutes

## Mục tiêu học tập

- Mô tả 12 lĩnh vực được ủy quyền của California AB 2013 cho minh bạch dữ liệu đào tạo AI tạo.
- Cụ thể lập trường của DPA năm 2025 về đào tạo LLM có lợi ích hợp pháp (DPC Ireland, ICO của Vương quốc Anh, Hamburg, Cologne).
- Mô tả vấn đề không thể đảo ngược: tại sao GDPR quyền xóa không có tương đương thực tế với các mạng thần kinh được đào tạo.
- Cụ thể cho thấy "Cái đồng trong cuộc khủng hoảng" của Data Provenance Initiative.

## Vấn đề

Quản trị dữ liệu đào tạo là nguồn gốc trước của mỗi thẻ mô hình (Học 26) và nghĩa vụ pháp lý (Học 24). Trong năm 2024-2025, bối cảnh pháp lý được hợp nhất trên ba nguyên tắc: cơ sở hạ tầng không tham gia, tiết lộ dữ liệu theo tập hợp dữ liệu và các điều khoản lợi ích hợp pháp cho dữ liệu có sẵn công khai. Các nhà cung cấp không tuân thủ vào thời điểm thu thập không thể khắc phục nguồn gốc.

## Khái niệm

### California AB 2013

Được ký vào năm 2024. Tài liệu phải được đăng vào hoặc trước ngày 1 tháng 1 năm 2026 cho các hệ thống được phát hành vào hoặc sau ngày 1 tháng 1 năm 2022. Mục 3111 (a) yêu cầu các nhà phát triển xuất bản bản bản tóm tắt cấp cao của các tập hợp dữ liệu được sử dụng trong đào tạo với 12 mục quy định:
1. Nguồn hoặc chủ sở hữu của bộ dữ liệu.
2. Mô tả về cách các tập hợp dữ liệu thúc đẩy mục đích dự định của hệ thống AI.
3. Số điểm dữ liệu trong tập hợp dữ liệu (các phạm vi chung được chấp nhận; ước tính cho tập hợp dữ liệu động).
4. Mô tả các loại điểm dữ liệu (loại nhãn cho các tập hợp dữ liệu có nhãn; đặc điểm chung cho các tập hợp dữ liệu không có nhãn).
5. Cho dù các tập dữ liệu bao gồm bất kỳ dữ liệu nào được bảo vệ bởi bản quyền, nhãn hiệu hoặc bằng sáng chế, hoặc hoàn toàn thuộc sở hữu công cộng.
6. Cho dù các bộ dữ liệu đã được mua hoặc cấp phép.
7. Liệu các tập hợp dữ liệu có bao gồm thông tin cá nhân (theo Cal. Civ. Code §1798.140 ((v)).
8. Liệu các tập hợp dữ liệu có bao gồm thông tin tổng hợp về người tiêu dùng (theo Cal. Civ. Code §1798.140(b)).
9. Việc làm sạch, chế biến hoặc sửa đổi khác của nhà phát triển, với mục đích dự định.
10. Thời gian trong đó dữ liệu được thu thập, với thông báo nếu thu thập đang diễn ra.
11. Ngày các tập dữ liệu lần đầu tiên được sử dụng trong quá trình phát triển.
12. Cho dù hệ thống sử dụng hoặc liên tục sử dụng việc tạo dữ liệu tổng hợp.

Mục 12 (dữ liệu tổng hợp) là mới đối với các trang dữ liệu năm 2018. Mục 7 (dữ liệu cá nhân) kích hoạt các nghĩa vụ của Đạo luật Quyền Bảo mật (CPRA).

### Đạo luật AI của EU (Học 24) và TDM không tham gia

Điều khoản ngoại lệ của Đạo luật Bản quyền EU về khai thác văn bản và dữ liệu cho phép đào tạo về nội dung có sẵn công khai trừ khi người có quyền chọn ra ngoài.

### 2025 DPA hội tụ trên lợi ích hợp pháp

DPC Ireland (21 tháng 5 năm 2025): Kế hoạch đào tạo của Meta về nội dung người dùng người lớn EU/EEA công khai bên đầu được chấp nhận với các biện pháp bảo vệ sau khi đưa ra ý kiến của EDPB. Tòa án khu vực cao cấp Cologne (23 tháng 5 năm 2025) bác bỏ lệnh cấm chống lại Meta: sự từ chối là đủ. Hamburg DPA bỏ thủ tục khẩn cấp cho sự nhất quán trên toàn EU. ICO của Anh (23 tháng 9 năm 2025) đã đưa ra phản ứng pháp lý tích cực không phải thông tin chính thức về việc LinkedIn tiếp tục đào tạo AI với các biện pháp bảo vệ tương tự và giám sát liên tục.

Nguyên tắc hội tụ: lợi ích hợp pháp có thể biện minh cho việc đào tạo về nội dung bên đầu tiên có sẵn cho công chúng với sự từ chối.

### ANPD Brazil (tháng 7 năm 2024)

Việc xử lý dữ liệu người dùng Brazil của Meta được đình chỉ vì sự minh bạch thông tin không đủ. Kết quả khác với các DPA của EU  ANPD ưu tiên tính minh bạch hơn sự chấp nhận lợi ích hợp pháp.

### Vấn đề không thể đảo ngược

Cookie-consent được thiết kế để theo dõi thời gian thực, có thể đảo ngược. Dữ liệu đào tạo khác: một khi dữ liệu nhập vào trọng lượng mô hình, xóa phẫu thuật không thể. Trình luyện lại từ đầu là phương pháp khắc phục hoàn toàn duy nhất, và nó tốn kém quá nhiều.

Các biện pháp khắc phục một phần:
- **Unlearning.**Phân tích chi tiêu gần như; được đo bằng MIA (Học 22).
- **Influence function-based localization.**Xác định trọng lượng bị ảnh hưởng nhiều nhất bởi dữ liệu; cập nhật chọn lọc.
- **Fine-tune-suppression.**Trình luyện mô hình để từ chối các kết quả xuất phát từ dữ liệu.

Không có ai giải quyết đầy đủ vấn đề.

### Động thái về nguồn gốc dữ liệu

dataaprovenance.org. Longpre, Mahari, Lee và các "Consent in Crisis" (Thiều 7 năm 2024): kiểm toán quy mô lớn về dữ liệu chung về đào tạo AI. Tìm kiếm: các nhà xuất bản đang thêm các hạn chế robots.txt với tốc độ tăng tốc. Các công dụng có thể được đào tạo đang giảm nhanh chóng. 2023 -> 2024 đã thấy khoảng 25% các nguồn đào tạo hàng đầu thêm một số hạn chế. Sự liên quan: khả năng tiếp cận dữ liệu đào tạo trong tương lai phụ thuộc vào các mô hình mua lại mới (nghượng quyền, sản xuất tổng hợp, tham gia được khuyến khích).

### Khi điều này phù hợp với giai đoạn 18

Bài học 26 là tài liệu cấp mô hình. Bài học 27 là quản trị cấp dữ liệu. Cùng nhau chúng xác định lớp minh bạch. Bài học 28 vẽ bản đồ hệ sinh thái nghiên cứu làm việc về những câu hỏi này.

```figure
an-provenance-oneway
```

## Sử dụng nó

`code/main.py`tạo ra một bộ dữ liệu California AB 2013 phù hợp với 12 trường tổng hợp khung cho một bộ dữ liệu đồ chơi. Bạn có thể điền vào các trường và quan sát những trường nào kích hoạt quyền riêng tư hoặc quyền tác giả theo dõi nghĩa vụ.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-provenance-check.md`. Với một tập dữ liệu được sử dụng trong đào tạo, nó kiểm tra cho AB 2013 bao gồm 12 lĩnh vực, tuân thủ cơ sở hạ tầng từ chối, DPA phù hợp và đánh giá rủi ro không thể đảo ngược.

## Các bài tập

1. Đi chạy`code/main.py`- Tạo một bản tóm tắt 12 lĩnh vực cho một bộ dữ liệu đồ chơi và xác định các lĩnh vực nào chưa được xác định rõ.

2. Đạo luật TDM của EU về bản quyền là máy đọc được. đề xuất một định dạng tiêu chuẩn cho tín hiệu từ chối và so sánh nó với robots.txt và C2PA "Không đào tạo AI".

3. Đọc "Consent in Crisis" (Thiều tháng 7 năm 2024) của Data Provenance Initiative.

4. Sự sắp xếp DPA năm 2025 chấp nhận lợi ích hợp pháp cho đào tạo nội dung công cộng.

5. Bác thảo một bản biểu lộ nguồn gốc dữ liệu đào tạo bao gồm các trường AB 2013 và một chuỗi nguồn gốc ký kết C2PA cho mỗi tập dữ liệu.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AB 2013 | "the California law" | Generative AI training-data transparency; 12 mandated fields |
| TDM exception | "text-and-data-mining" | EU Copyright Directive training-data exception with opt-out |
| Legitimate interest | "the EU basis" | GDPR Article 6 basis that may justify training on public content |
| Opt-out signal | "machine-readable no-train" | robots.txt, C2PA "No AI Training," TDM.Reservation |
| Irreversibility | "cannot un-train" | Data in model weights is not surgically removable |
| Unlearning | "approximate removal" | Post-training interventions to reduce model dependence on specific data |
| Consent in Crisis | "the DPI audit" | July 2024 finding of accelerating robots.txt restrictions |

## Đọc thêm

- [California AB 2013](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2013) Luật minh bạch dữ liệu về đào tạo AI tạo
- [EU AI Act + GPAI Code of Practice (Lesson 24)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) Chương về bản quyền
- [Longpre, Mahari, Lee et al. — Consent in Crisis (dataprovenance.org, July 2024)](https://www.dataprovenance.org/consent-in-crisis-paper) Kiểm tra DPI
- [IAPP — EU Digital Omnibus GDPR amendments (2025)](https://iapp.org/news/a/eu-digital-omnibus-amendments-to-gdpr-to-facilitate-ai-training-miss-the-mark) bối cảnh quy định
