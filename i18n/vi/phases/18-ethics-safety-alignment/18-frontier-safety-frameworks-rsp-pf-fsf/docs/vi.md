# Các khung an toàn biên giới  RSP, PF, FSF

> Ba khung phòng thí nghiệm chính xác định quản lý ngành công nghiệp của khả năng biên giới năm 2026. Chính sách quy mô chịu trách nhiệm nhân loại v3.0 (Thiáng Hai 2026) giới thiệu các mức độ an toàn AI cấp bậc (ASL-1 đến ASL-5+), được mô hình hóa dựa trên mức độ an toàn sinh học, với ASL-3 được kích hoạt vào tháng 5 năm 2025 cho các mô hình liên quan đến CBRN. OpenAI Preparedness Framework v2 ( Tháng 4 năm 2025) xác định năm tiêu chí cho khả năng theo dõi và tách ra các báo cáo khả năng từ báo cáo bảo vệ. DeepMind Frontier Safety Framework v3.0 (Tháng 9 năm 2025) giới thiệu các cấp độ khả năng quan trọng bao gồm một CCL thao tác độc hại mới. Cả ba hiện có các điều khoản điều chỉnh đối thủ cạnh tranh cho phép hoãn nếu các phòng thí nghiệm đồng nghiệp vận chuyển mà không có bảo vệ tương đương. Sự sắp xếp giữa các phòng thí nghiệm vẫn là cấu trúc, không phải là thuật ngữ: "Thỉ số khả năng", "Thỉ số khả năng cao" và "Thực lượng khả năng quan trọng" chỉ ra các cấu trúc tương tự.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 07-09 (deception failures)
**Time:** ~75 minutes

## Mục tiêu học tập

- Mô tả cấu trúc cấp độ ASL của Anthropic và điều gì kích hoạt ASL-3.
- Tên gọi năm tiêu chí OpenAI Preparedness Framework v2 cho khả năng theo dõi.
- Mô tả cấu trúc cấp độ khả năng quan trọng của DeepMind và CCL thao tác gây hại.
- Giải thích các điều khoản điều chỉnh đối thủ cạnh tranh và lý do tại sao chúng quan trọng đối với động lực chủng tộc.
- Định nghĩa một trường hợp an toàn và mô tả cấu trúc ba trụ (phòng dõi, không thể đọc, không thể đọc).

## Vấn đề

Bài học 7-17 thiết lập rằng lừa dối có thể xảy ra, khả năng sử dụng kép tồn tại, và đánh giá có giới hạn. Một phòng thí nghiệm có mô hình có khả năng biên giới cần một cấu trúc quản trị nội bộ:
- Định nghĩa ngưỡng khi cần có biện pháp bảo vệ mới.
- Định nghĩa các đánh giá cần thiết trước khi mở rộng quy mô.
- Mô tả một trường hợp an toàn trông như thế nào.
- Xử lý vấn đề động lực đua (nếu các đối thủ cạnh tranh vận chuyển mà không có bảo vệ, bạn làm gì?).

Ba khung 2025-2026 là hiện đại  không hoàn hảo, phát triển và phù hợp đủ giữa các phòng thí nghiệm để câu hỏi quản trị bây giờ là liệu các khung có phù hợp không, chứ không phải liệu chúng có tồn tại hay không.

## Khái niệm

### Chính sách quy mô chịu trách nhiệm nhân loại v3.0 (Tháng 2 năm 2026)

Cấu trúc ASL:
- ASL-1: không phải mô hình biên giới (được tổng hợp bằng cơ sở yếu hơn biên giới).
- ASL-2: đường cơ sở biên giới hiện tại; được triển khai với các biện pháp bảo vệ thông thường.
- ASL-3: nguy cơ lạm dụng thảm họa cao hơn đáng kể; khả năng liên quan đến CBRN. Được kích hoạt vào tháng 5 năm 2025.
- ASL-4: AI R&D-2 vượt ngưỡng; mô hình có thể tự động hóa nghiên cứu AI cấp độ nhập học.
- ASL-5+: mô hình nghiên cứu và phát triển AI tiên tiến, đẩy nhanh hiệu quả quy mô.

Tới trong v3.0:
- Bản đồ đường bộ an toàn biên giới (tự do trong hình thức được biên soạn).
- Báo cáo rủi ro (tứ ba năm, một số được xem xét bên ngoài).
- AI R&D được phân chia thành AI R&D-2 và AI R&D-4.
- Một khi AI R&D-4 đã được vượt qua, một trường hợp an toàn xác nhận là cần thiết, xác định rủi ro không phù hợp từ các mô hình theo đuổi mục tiêu không phù hợp.

### OpenAI Preparedness Framework v2 (15 tháng 4 năm 2025)

Năm tiêu chí cho khả năng theo dõi:
- **Plausible.**Có một mô hình đe dọa hợp lý.
- **Measurable.**Đánh giá bằng chứng có thể.
- **Severe.**Hành vi gây ra rất lớn.
- **Net-new.**Không phải là một rủi ro đã tồn tại.
- **Instantaneous-or-irremediable.**Sự tổn thương xảy ra nhanh chóng hoặc không thể được khắc phục.

Khả năng đáp ứng tất cả 5 được theo dõi.

Dấu trúc PF v2 khác:
- Các báo cáo về khả năng (các mô hình có thể làm gì) và báo cáo về bảo vệ (các kiểm soát nào tồn tại).
- Các đánh giá của nhóm tư vấn an toàn.
- Lãnh đạo chấp thuận; Ủy ban An toàn & An toàn của Hội đồng giám sát.
- "Thỏa khoản điều chỉnh": OpenAI có thể giảm yêu cầu nếu một tàu phòng thí nghiệm khác không có bảo vệ tương đương.

### DeepMind Frontier Safety Framework v3.0 (Tháng 9 năm 2025)

Các cấp độ khả năng quan trọng (CCL) theo lĩnh vực:
- Tăng cường vũ khí sinh học
- Tăng cường mạng
- ML Tăng tốc R&D
- Phong thủ độc hại (mới trong v3.0): mô hình có thể thay đổi đáng kể niềm tin / hành vi trong bối cảnh rủi ro cao.

V2.0 (tháng 2 năm 2025) đã thêm một phần Khớp Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định Định

### Định hướng giữa các phòng thí nghiệm

- "Thỉ số khả năng" nhân văn.
- DeepMind "Cấp độ khả năng quan trọng".
- OpenAI "Thỉ số khả năng cao".

Không có thuật ngữ tiêu chuẩn ngành. Dòng dọc: mỗi trong ba khung xác định ngưỡng khả năng cấp bậc với các tiêu chí đánh giá được công bố. Cả ba bao gồm các khoản điều chỉnh đối thủ cạnh tranh (2025 trở đi).

### Các trường hợp an toàn

Một trường hợp an toàn là một lập luận bằng văn bản cho rằng một triển khai là an toàn theo các giả định tồi tệ nhất.

- **Monitoring.**Chúng ta có thể phát hiện hành vi xấu nếu nó xảy ra không?
- **Illegibility.**Liệu mô hình không có khả năng thực hiện một kế hoạch liên kết để gây hại?
- **Incapability.**Có phải mô hình không có khả năng gây ra thiệt hại trong vấn đề?

Các trường hợp an toàn khác nhau nhắm vào các trụ cột khác nhau. Đối với trường hợp ASL-3 CBRN, không thể (thông qua không học) là mục tiêu chính. Đối với sự sắp xếp lừa đảo, giám sát và không thể đọc được là mục tiêu. Đối với nâng cao mạng, cả ba đều có liên quan.

### Vấn đề động lực chủng tộc

Các điều khoản điều chỉnh đối thủ cạnh tranh là gây tranh cãi. Các nhà phê bình cho rằng họ tạo ra một cuộc đua xuống đáy: nếu cả ba phòng thí nghiệm sẽ giảm yêu cầu khi một đối thủ cạnh tranh bị lỗi, sự cân bằng chuyển sang đào ngũ. Những người bảo vệ cho rằng thay thế (các biện pháp bảo vệ đơn phương) sẽ tạo ra kết quả tồi tệ hơn nếu phòng thí nghiệm đào ngũ ít ý thức về an toàn hơn.

AISI của Anh, CAISI của Mỹ và Văn phòng AI của EU (Dạy 24) là đối tác quản trị bên ngoài.

### Khi điều này phù hợp với giai đoạn 18

Bài học 17-18 là lớp đo lường và quản lý trên đỉnh của các phân tích lừa đảo và nhóm đỏ. Bài học 19-24 bao gồm phúc lợi, thiên vị, quyền riêng tư, đánh dấu nước và cấu trúc quy định. Bài học 28 vẽ bản đồ hệ sinh thái nghiên cứu (MATS, Redwood, Apollo, METR) hoạt động các đánh giá.

```figure
al-asl-ladder
```

## Sử dụng nó

Không có mã cho bài học này. Đọc ba nguồn chính: RSP v3.0, PF v2, FSF v3.0. Hình ảnh cấu trúc cấp độ của mỗi phòng thí nghiệm với các lớp khác và xác định một ngưỡng mà mỗi phòng thí nghiệm xác định mà các phòng thí nghiệm khác không.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-framework-diff.md`. Với một khung an toàn hoặc thông báo phát hành, nó so sánh các định nghĩa ngưỡng của khung, các đánh giá cần thiết và cấu trúc trường hợp an toàn với RSP v3.0, PF v2, FSF v3.0 và các khoảng trống chéo giữa các phòng thí nghiệm.

## Các bài tập

1. Đọc RSP v3.0, PF v2 và FSF v3.0. Sẵn sàng biên soạn bảng về ngưỡng CBRN của mỗi phòng thí nghiệm, ngưỡng R&D AI của mỗi phòng thí nghiệm và đánh giá trước khi triển khai.

2. Điều khoản điều chỉnh đối thủ cạnh tranh được đưa ra trong cả ba khung (2025+).

3. Thiết kế một trường hợp an toàn cho một mô hình vượt qua ngưỡng R&D-4 AI của Anthropic.

4. FSF v3.0 của DeepMind giới thiệu một CCL thao tác gây hại. đề xuất ba phép đo kinh nghiệm cho thấy một mô hình đã vượt qua ngưỡng này.

5. Đọc "Các yếu tố chung của các chính sách an toàn AI biên giới" (2025) của METR. Hãy nêu tên ba sự hội tụ mạnh nhất giữa các phòng thí nghiệm và hai sự khác biệt lớn nhất.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| RSP | "Anthropic's framework" | Responsible Scaling Policy; ASL tiers; v3.0 February 2026 |
| PF | "OpenAI's framework" | Preparedness Framework; five criteria; v2 April 2025 |
| FSF | "DeepMind's framework" | Frontier Safety Framework; CCLs; v3.0 September 2025 |
| ASL-3 | "biosafety level 3-analog" | Anthropic tier for CBRN-relevant capabilities; activated May 2025 |
| CCL | "critical capability level" | DeepMind's threshold construct; per-domain |
| Safety case | "the formal argument" | Written argument that deployment is acceptably safe under worst-case U |
| Adjustment clause | "competitor defection allowance" | Framework provision for reducing requirements if competitors ship without comparable safeguards |

## Đọc thêm

- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) Các cấp ASL, lộ trình, phân chia R&D AI
- [OpenAI — Updating the Preparedness Framework (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/)5 tiêu chí, điều khoản điều chỉnh
- [DeepMind — Strengthening our Frontier Safety Framework (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) CCL v3.0, Manipulation có hại
- [METR — Common Elements of Frontier AI Safety Policies (2025)](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) So sánh giữa các phòng thí nghiệm
