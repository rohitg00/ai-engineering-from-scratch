# Kiểm soát AI  An toàn Mặc dù bị phá hoại

> Greenblatt, Shlegeris, Sachan, Roger (Redwood Research, arXiv:2312.06942, ICML 2024). Kiểm soát tái định hình câu hỏi an toàn: do một mô hình U mạnh mẽ không tin cậy có thể tối ưu hóa chống lại bạn, những giao thức nào cho phép bạn lấy công việc hữu ích trong khi giới hạn khả năng của một kết quả không thể chấp nhận được? Các nguồn lực là mô hình yếu hơn đáng tin cậy T, ngân sách của lao động con người đáng tin cậy H, và khả năng chỉnh sửa sản phẩm của U. Trong khung này, Trusted Editing Pareto thống trị Untrusted Monitoring trên các nhiệm vụ code-backdoor. Khung có thể thừa hưởng các giả định tồi tệ nhất từ kỹ thuật bảo mật: an toàn là khả năng mà một U được chọn đối lập không thể gây ra kết quả không thể chấp nhận được cụ thể, được đo dưới áp lực nhóm đỏ thay thế cho U.

**Type:** Learn
**Languages:** Python (stdlib, safety-vs-usefulness frontier on code-backdoor task), TypeScript
**Prerequisites:** Phase 18 · 07 (sleeper agents), Phase 18 · 08 (scheming), Phase 18 · 09 (alignment faking)
**Time:** ~75 minutes

## Mục tiêu học tập

- Định nghĩa mô hình đe dọa AI Control: mô hình mạnh không tin cậy U, mô hình yếu kém tin cậy T, ngân sách con người tin cậy H.
- Mô tả giao thức chỉnh sửa đáng tin cậy và lý do tại sao nó thống trị giám sát không tin cậy trên nhiệm vụ khóa hậu của mã ICML 2024.
- Giải thích sự khác biệt giữa sự sắp xếp (U đáng tin cậy) và kiểm soát (U không đáng tin cậy và chúng tôi vẫn an toàn).
- Hãy nêu ra ba giới hạn của sự kiểm soát: con người không có quy mô, các mô hình yếu kém đáng tin cậy cuối cùng bị tụt lại, kiểm soát không tạo ra các mô hình mạnh đáng tin cậy.

## Vấn đề

Bài học 7-9 cho thấy mô hình biên giới có thể bị đánh lừa, âm mưu, hoặc giả mạo sự sắp xếp. Câu hỏi an toàn được đặt lại: chúng ta có thể lấy ra công việc hữu ích từ một mô hình mà chúng ta không tin tưởng, mà không cho nó cơ hội gây ra kết quả không thể chấp nhận được không? Đây là vấn đề kiểm soát, và nó được cấu trúc giống như an ninh cổ điển: giả định đối thủ xấu nhất, thiết kế một giao thức, đo lường tỷ lệ thành công của đối thủ dưới áp lực của đội đỏ.

## Khái niệm

### Mô hình đe dọa

Kiểm soát giả định:
- U  mô hình mạnh mẽ không tin cậy. có khả năng. Có thể đối kháng (học xét xử nó như thể nó là).
- T mô hình đáng tin cậy yếu hơn, ít khả năng hơn, nhưng được biết đến là không có sự đối kháng.
- H  lao động con người đáng tin cậy. ngân sách nhỏ; không có quy mô.

Hệ thống phải tạo ra kết quả hữu ích bằng cách sử dụng U. Đối thủ cố gắng gây ra một kết quả không thể chấp nhận được cụ thể (ví dụ, một cửa sau trong mã được gửi) trong khi duy trì một phần nhỏ công việc hữu ích hợp pháp để vượt qua ngưỡng hữu ích.

Control từ bỏ sự tin tưởng vào U. Nó hỏi các giao thức nào duy trì an toàn trong sự thiếu tin tưởng của U.

### Nhiệm vụ ICML 2024

Các lời nhắc là các vấn đề lập trình cấp cạnh tranh. U tạo ra một giải pháp ứng cử viên. Một Oracle ẩn cờ nếu giải pháp chứa một cửa sau (một đầu vào cụ thể khiến mã tạo ra một đầu ra sai). Nhóm đỏ kiểm soát U và được phép xem tất cả các nội dung giao thức.

### Bốn giao thức so sánh

- **Baseline:**- Tăng năng lượng tối đa, an toàn tối thiểu.
- **Upfront auditing:**Sử dụng H trên tất cả các đầu ra, an toàn tối đa, ngân sách nhanh chóng hết.
- **Untrusted Monitoring:**một phiên bản thứ hai của U đánh giá kết quả của phiên bản đầu tiên; H kiểm toán kết quả được đánh dấu.
- **Trusted Editing:**T chỉnh sửa đầu ra của U trên mỗi truy vấn. Nếu T không tự tin, đường dẫn đến H.

Greenblatt et al. tìm thấy Trusted Editing Pareto-dominates Untrusted Monitoring: hữu ích cao hơn ở mọi mức độ an toàn.

### Tại sao Đạo chỉnh sửa đáng tin cậy thắng lợi

Đánh giá không tin cậy yêu cầu rằng U's thứ hai không thể phối hợp với đầu tiên. Sự đồng thuận có thể được thực hiện thông qua các dấu hiệu steganographic hoặc các quá trình đào tạo chung. Các giao thức phải đầu tư ngân sách vào khả năng chống đối sự đồng tình (phân ngữ, làm mờ) làm giảm tín hiệu của màn hình. Truy cập đáng tin cậy tránh sự đồng thuận hoàn toàn bởi vì T được tin tưởng  bất kỳ chỉnh sửa nào T đề xuất là, theo giả định, không phải là đối thủ. Chi phí là T ít khả năng hơn, vì vậy nó có thể quá từ chối hoặc bỏ lỡ những cửa sau tinh tế.

### Bốn trục giao thức

1. Vai trò nào của U: chỉ có nhà sản xuất, màn hình, hoặc cả hai.
2. Vai trò nào của T: biên tập viên, màn hình, hoặc resampler.
3. Cách phân bổ H: kiểm toán đồng nhất, kiểm toán ngẫu nhiên hoặc kiểm toán theo cờ.
4. Số tiền tính toán của giao thức chi tiêu cho khả năng chống đụng độ.

### Định hướng đối với kiểm soát

- Sự sắp xếp: "Bạn có thể tin tưởng được không?" Bài học 2, 4, 5, 6, 7, 8, 9 đều dựa vào điều này.
- Kiểm soát: "Chúng ta có thể sử dụng U an toàn mà không tin tưởng nó không?" Bài học 10.

Sự sắp xếp là một thuộc tính của mô hình. Kiểm soát là một thuộc tính của giao thức triển khai. Kiểm soát không tạo ra các mô hình được sắp xếp; nó tạo ra việc sử dụng an toàn các mô hình có thể không được sắp xếp. Cả hai chương trình nghị sự đều cần thiết.

### Ba giới hạn cơ bản

- Con người không có quy mô. Ngân sách H được giới hạn bởi số lượng con người sẵn sàng kiểm tra các sản phẩm AI khó khăn.
- Khi T yếu hơn U, tín hiệu chỉnh sửa của T trở thành tiếng ồn.
- Các giao thức hoạt động ở ASL-3 (Dạy học 18) có thể không hoạt động ở ASL-4  nếu U có thể thao túng T hoặc lý luận về phân bố kiểm toán của H, kiểm soát thất bại.

### Sự phát triển năm 2025

AISI và Redwood của Anh hợp tác trên các trường hợp an toàn kiểm soát (metr.org / redwoodresearch.org 2025): một trường hợp an toàn kiểm soát lập luận rằng trong trường hợp giả định tồi tệ nhất về U, giao thức giới hạn khả năng của một kết quả không thể chấp nhận được. Các trường hợp an toàn (Lớp 18) thừa kế khung kiểm soát.

### Khi điều này phù hợp với giai đoạn 18

Bài học 6-9 mô tả mối đe dọa (sự lừa dối có thể xảy ra). Bài học 10 mô tả mô hình phòng thủ dưới giả định rằng mối đe dọa là thực tế. Bài học 11 mô tả mô hình tấn công bổ sung (làm U đáng tin cậy thông qua giám sát có thể mở rộng).

```figure
al-control-protocol
```

## Sử dụng nó

`code/main.py`U tạo ra các kết quả; một phần được khóa cửa sau (quản lý đội đỏ). T phê duyệt hoặc chỉnh sửa. H được gọi trên một ngân sách. Bạn có thể lau ngân sách và tham số hợp tác để tái tạo biên giới Pareto trong Greenblatt et al. 2024 Hình 2 ( hình dạng, không phải số).

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-control-protocol-audit.md`. Với mô tả giao thức triển khai, nó xác định vai trò U / T / H, đặt tên cho các vector hợp tác và ước tính vị trí của giao thức trên biên giới hữu ích-an toàn dưới áp lực nhóm đỏ.

## Các bài tập

1. Đi chạy`code/main.py`- Tạo lại giới hạn hữu ích-sự an toàn cho việc chỉnh sửa đáng tin cậy và giám sát không đáng tin cậy.

2. Thêm một giao thức mới: "T tái tạo với nhiệt độ thấp, sau đó U chỉnh sửa đầu ra của T". đo vị trí của nó trên biên giới. Tại sao điều này thất bại thảm khốc hơn Trusted Editing?

3. Bài báo 2024 giả định U có thể nhìn thấy giao thức. Thiết kế một giao thức ẩn khỏi U mà các kết quả đang được kiểm toán.

4. Đọc Greenblatt et al. 2024 Mục 7 (collusion). đề xuất một biện pháp chống collusion và giải thích chi phí hữu ích dự kiến của nó.

5. Cụ thể một trường hợp an toàn kiểm soát cho một triển khai sử dụng U = GPT-4-thể loại, T = GPT-3.5-thể loại, H = 1% của các sản phẩm được kiểm tra.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AI Control | "safety under subversion" | Protocol design that bounds unacceptable outcomes under a worst-case U |
| Untrusted model (U) | "the strong model" | The capable model we want to extract work from but do not trust |
| Trusted model (T) | "the weak model" | A weaker model, known not to be adversarial, used as editor/monitor |
| Trusted human (H) | "the audit budget" | Bounded expert labor; expensive; the ground-truth signal |
| Trusted Editing | "T edits U" | Protocol where T is the gate on U's outputs; H called on ambiguous outputs |
| Untrusted Monitoring | "U monitors U" | Protocol where a second U instance scores outputs; collusion-resistant only with extra investment |
| Control safety case | "the formal argument" | Written argument that a protocol bounds the adversary's success under worst-case U |

## Đọc thêm

- [Greenblatt, Shlegeris, Sachan, Roger — AI Control (arXiv:2312.06942)](https://arxiv.org/abs/2312.06942) giấy ICML 2024
- [Redwood Research — Recent AI Control papers index](https://redwoodresearch.substack.com/) Các hoạt động theo dõi 2024-2025
- [UK AISI + METR — Control safety cases](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) Hoạt động hóa các phòng thí nghiệm biên giới
- [Hubinger et al. — Sleeper Agents (Lesson 7, arXiv:2401.05566)](https://arxiv.org/abs/2401.05566) kiểm soát mô hình đe dọa giả định
