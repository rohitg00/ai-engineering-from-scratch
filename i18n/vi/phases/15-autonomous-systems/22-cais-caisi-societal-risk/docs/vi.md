# CAIS, CAISI và rủi ro quy mô xã hội

> Trung tâm An toàn AI (CAIS, San Francisco, được thành lập năm 2022 bởi Hendrycks và Zhang) công bố khung bốn rủi ro  sử dụng độc hại, cuộc đua AI, rủi ro tổ chức, AI gian lận  và tuyên bố tháng 5 năm 2023 về nguy cơ tuyệt chủng được ký bởi hàng trăm giáo sư và lãnh đạo công ty. Các bản phát hành năm 2026 từ CAIS: bảng điều khiển AI cho đánh giá mô hình biên giới, Chỉ số lao động từ xa (với AI quy mô), Tờ chiến lược siêu thông minh, Báo chí AI Frontiers. Một thực thể riêng biệt: Trung tâm tiêu chuẩn và đổi mới AI của NIST (CAISI)  Các thỏa thuận tình nguyện đối mặt với chính phủ Hoa Kỳ và đánh giá khả năng không được phân loại tập trung vào rủi ro vũ khí mạng, sinh học và hóa học. CAIS đánh dấu rủi ro tổ chức là một trong bốn rủi ro cấp cao nhất: văn hóa an toàn, kiểm toán nghiêm ngặt, phòng thủ đa tầng và an ninh thông tin là cơ bản nhưng thường xuyên được giao dịch so với tốc độ triển khai. California SB-53, nếu được ký kết, sẽ là quy định rủi ro thảm họa cấp tiểu bang đầu tiên của Hoa Kỳ.

**Type:** Learn
**Languages:** Python (stdlib, four-risk inventory and mitigation matcher), TypeScript
**Prerequisites:** Phase 15 · 19 (RSP), Phase 15 · 20 (PF + FSF)
**Time:** ~45 minutes

## Vấn đề

Bài học 19 và 20 bao gồm các chính sách quy mô nội bộ trong phòng thí nghiệm. Bài học 21 bao gồm đánh giá khả năng độc lập. Bài học này bao gồm quan điểm thứ ba: xã hội dân sự và các tổ chức chính phủ định hình cuộc thảo luận công cộng và cơ sở quy định cho rủi ro AI thảm họa.

CAIS là một tổ chức nghiên cứu phi lợi nhuận xuất bản khung để suy nghĩ về rủi ro AI và phối hợp các tuyên bố công cộng. CAISI là một trung tâm chính phủ Hoa Kỳ trong NIST điều hành các thỏa thuận tự nguyện với các phòng thí nghiệm và đánh giá khả năng không được phân loại. Tên bắt chước; các nhiệm vụ không chồng chéo.

Nội dung thực tế: Quadro bốn rủi ro của CAIS là phân loại rủi ro quy mô xã hội được trích dẫn rộng rãi nhất trong văn học. Văn hóa an toàn và rủi ro tổ chức là một trong bốn, và đây là một trong những trực tiếp nhất dưới sự kiểm soát của một học viên. SB-53 (California) sẽ là quy định rủi ro thảm họa cấp tiểu bang đầu tiên của Hoa Kỳ nếu được ký; các vấn đề khung của dự luật vì quy định cấp tiểu bang đã dẫn đến hành động liên bang trong chính sách công nghệ của Hoa Kỳ.

## Khái niệm

### CAIS  Trung tâm An toàn AI

- Được thành lập: 2022 tại San Francisco, bởi Dan Hendrycks và Oliver Zhang. Hendrycks là Giám đốc điều hành và nghiên cứu; Zhang là Giám đốc điều hành.
- Tình trạng: 501 ((c) ((3) phi lợi nhuận.
- Kết quả đáng chú ý năm 2023: tuyên bố về nguy cơ tuyệt chủng, được đồng ký bởi hàng trăm nhà nghiên cứu và CEO. Được tuyên bố: "Há giảm nguy cơ tuyệt chủng từ AI nên là ưu tiên toàn cầu cùng với các rủi ro quy mô xã hội khác như đại dịch và chiến tranh hạt nhân".
- 2026 sản phẩm: bảng điều khiển AI cho đánh giá mô hình biên giới, Chỉ số lao động từ xa (cùng với AI quy mô), Tờ chiến lược siêu thông minh, Báo chí AI Frontiers.

### Quadro bốn rủi ro

Các cơ sở khung của CAIS nhóm rủi ro AI thảm họa thành bốn loại cấp cao:

1. **Malicious use**: một diễn viên xấu sử dụng AI để gây hại (sự tổng hợp vũ khí sinh học, thông tin sai lệch, tấn công mạng).
2. **AI races**: áp lực cạnh tranh giữa các phòng thí nghiệm, các công ty hoặc các quốc gia đẩy triển khai vượt qua điểm nơi nó an toàn.
3. **Organizational risks**: động lực trong phòng thí nghiệm (những thất bại trong văn hóa an toàn, kiểm toán không đủ, an ninh thiếu nguồn lực) tạo ra một sự triển khai kém.
4. **Rogue AIs**: một AI đủ khả năng theo đuổi các mục tiêu mâu thuẫn với phúc lợi con người.

Đây không phải là phân loại duy nhất; nó là được trích dẫn nhiều nhất. Các loại không loại trừ lẫn nhau  AI gian lận được sản xuất bởi một tổ chức giao dịch kiểm toán tốc độ trong một cuộc đua là tất cả bốn.

### Những nơi có rủi ro tổ chức

Trong bốn loại, rủi ro tổ chức là điều dễ thực hiện nhất cho các học viên. Văn hóa an toàn của phòng thí nghiệm, sự nghiêm ngặt kiểm toán, lớp bảo vệ và an ninh thông tin quyết định liệu các mẫu tàu của họ với các kiểm soát của Bài học 1018 thực sự có được thực hiện hay không, hoặc liệu những kiểm soát đó là các mục danh sách kiểm tra không ai xác minh.

Các đòn bẩy rủi ro tổ chức cụ thể:

- **Safety culture**Các cuộc khảo sát của CAIS cho thấy đây là một dự đoán mạnh mẽ về các đòn bẩy khác.
- **Rigorous audits**Các kiểm toán nội bộ chỉ tạo ra báo cáo lạc quan.
- **Multi-layered defenses**: không có một lớp duy nhất là đủ (đề tài chạy của giai đoạn 15).
- **Information security**: model weights leak, eval data leak, monitor-bypass techniques leak. RAND SL-4 trong bài học 19 là một tiêu chuẩn cụ thể.

### CAISI  Trung tâm tiêu chuẩn và đổi mới AI

- Hoạt động trong NIST.
- Có thỏa thuận tự nguyện với các phòng thí nghiệm biên giới.
- Ghiên bản đánh giá khả năng không được phân loại tập trung vào rủi ro vũ khí mạng, sinh học và hóa học.
- Khác với CAIS; các ký tự viết tắt va chạm; kiểm tra URL (nist.gov) để xác nhận bạn đang đọc.

Vai trò của CAISI là đối tác công cộng, đối diện với chính phủ đối với các hoạt động phòng thí nghiệm tư nhân của METR (Dạy 21). Các báo cáo CAISI không được phân loại; báo cáo METR thường được NDA-gate.

### California SB-53

Dự luật Thượng viện California (2025-2026 phiên) giải quyết rủi ro thảm họa từ các mô hình biên giới.

- Các ngưỡng khả năng cụ thể gây ra các nghĩa vụ ở cấp độ nhà nước.
- Bảo vệ người báo cáo cho nhân viên phòng thí nghiệm AI.
- Yêu cầu báo cáo sự cố đối với các thất bại thảm họa.

Nếu được ký kết, nó sẽ là quy định nguy cơ thảm họa cấp tiểu bang đầu tiên của Hoa Kỳ. Bất kể tình trạng ký kết, khung của dự luật định hình hóa cách các nhà lập pháp tiểu bang khác tiếp cận vấn đề. Các học viên ở California nên theo dõi tình trạng dự luật; học viên ở nơi khác nên đọc nó để hiểu quy định cấp tiểu bang Hoa Kỳ có thể sẽ trông như thế nào.

### Nguy cơ trên quy mô xã hội không phải là một vấn đề đơn

Chủ đề chạy của giai đoạn 15  phòng thủ sâu sắc  cũng áp dụng cho tầng xã hội. Không có tổ chức, quy định hoặc khung nào đóng cửa rủi ro thảm họa. Hệ sinh thái chỉ hoạt động khi:

- Các nhà thí nghiệm quy mô các chính sách tàu (Dạy 19, 20).
- Các nhà đánh giá bên ngoài tạo ra các phép đo (Học 21).
- Công chúng dân sự theo dõi và công bố (CAIS).
- Chính phủ chạy các chương trình tự nguyện và quy định cơ bản (CAISI, SB-53).
- Các học viên xây dựng các điều khiển đa tầng (Dạy 1018).

Đây là tổng hợp cuối cùng cho giai đoạn: mỗi bài học trước đó là một lớp trong một chồng có tính toàn diện quan trọng hơn sức mạnh của bất kỳ lớp nào.

```figure
a5-four-risks
```

## Sử dụng nó

`code/main.py`thực hiện một công cụ kiểm tra rủi ro nhỏ. Với một triển khai được đề xuất, nó đánh dấu việc triển khai theo bốn loại rủi ro và trả lại danh sách kiểm tra giảm thiểu. Nó là một trợ giúp đọc cho khung, không thay thế cho phán đoán của con người.

## Chuyển nó

`outputs/skill-societal-risk-review.md`xem xét một triển khai đối với các rủi ro trên quy mô xã hội: trong bốn loại nào nó liên quan, những biện pháp giảm thiểu nào đang được thực hiện, những rủi ro tổ chức nào.

## Các bài tập

1. Đi chạy`code/main.py`. Đưa vào ba triển khai tổng hợp ở các quy mô khác nhau. xác nhận các thẻ bốn rủi ro phù hợp với những gì bạn mong đợi; xác định một trường hợp nơi công cụ dưới hoặc quá thẻ.

2. Đọc toàn bộ bài báo CAIS về bốn rủi ro. Chọn một danh mục rủi ro và viết hai đoạn về những gì bạn tin là sự phát triển quan trọng nhất năm 2026 trong danh mục đó.

3. Hãy đọc bản thảo hiện tại của California SB-53. xác định một điều khoản mà bạn tin rằng củng cố tư thế nguy cơ thảm họa và một điều mà bạn tin rằng làm suy yếu nó.

4. Chọn một triển khai AI sản xuất mà bạn biết (của bạn hoặc một công bố). Đánh giá nó so với các yếu tố rủi ro tổ chức: văn hóa an toàn, nghiêm ngặt kiểm toán, phòng thủ đa tầng, an ninh thông tin.

5. Hãy vẽ một phiên bản năm 2028 của khung bốn rủi ro phản ánh một năm năng lực bổ sung và một năm kinh nghiệm triển khai bổ sung. Bạn sẽ thêm, loại bỏ hoặc tập hợp lại gì?

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| CAIS | "Center for AI Safety" | Non-profit; four-risk framework; 2023 extinction statement |
| CAISI | "US government AI safety" | NIST Center; voluntary agreements; unclassified evals |
| Four-risk framework | "CAIS's taxonomy" | malicious use, AI races, organizational risks, rogue AIs |
| Malicious use | "Bad actor uses AI" | Bioweapons, disinformation, cyberattacks |
| AI races | "Competitive pressure" | Labs/companies/nations push deployment past safety |
| Organizational risk | "Lab internal failure" | Safety culture, audit, defenses, infosec |
| Rogue AI | "Misaligned agent" | Capable AI pursuing goals conflicting with human welfare |
| California SB-53 | "State-level regulation" | 2025–2026 bill; first US state catastrophic-risk regulation if signed |

## Đọc thêm

- [Center for AI Safety](https://safe.ai/) tổ chức nhà của khung bốn rủi ro.
- [CAIS — AI Risks that Could Lead to Catastrophe](https://safe.ai/ai-risk) giấy có 4 rủi ro.
- [CAIS — May 2023 statement on extinction risk](https://safe.ai/statement-on-ai-risk) tuyên bố chung ngắn gọn.
- [NIST CAISI](https://www.nist.gov/caisi) Trung tâm công nghệ thông minh và đổi mới đối diện với chính phủ.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) kết nối các cam kết ở cấp độ phòng thí nghiệm với việc định hình quy mô xã hội.
