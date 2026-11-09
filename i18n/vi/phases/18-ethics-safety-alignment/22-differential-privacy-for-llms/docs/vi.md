# Sự riêng tư khác biệt cho LLM

> DP-SGD vẫn là chuẩn  các cập nhật độ sốc tiêm tiếng  cung cấp các bảo đảm chính thức (epsilon, delta). Chi phí tổng thể trong tính toán, bộ nhớ và tiện ích là đáng kể; điều chỉnh DP hiệu quả các tham số (LoRA + DP-SGD) là cấu hình 2025 phổ biến (ACM 2025). Hai cơ quan bằng chứng trong căng thẳng: suy luận thành viên dựa trên các ngôn ngữ (Duan et al., 2024) báo cáo thành công hạn chế đối với các mô hình ngôn ngữ; khai thác dữ liệu đào tạo (Carlini et al., 2021; Nasr et al., 2025) phục hồi ghi nhớ từ ngữ đáng kể. Nghị quyết (arXiv:2503.06808, tháng 3 năm 2025): khoảng cách là trong những gì được đo  canaries được đưa vào so với dữ liệu "có thể thu được nhiều nhất". Các thiết kế mới của canary cho phép MIA dựa trên tổn thất mà không có mô hình bóng tối và tạo ra kiểm toán DP không nhỏ đầu tiên của một LLM được đào tạo trên dữ liệu thực với đảm bảo DP thực tế. Các lựa chọn thay thế: PMixED (arXiv:2403.15638)  dự đoán riêng tư tại thời điểm suy luận thông qua sự pha trộn của các chuyên gia về phân phối mã thông báo tiếp theo; DP tạo dữ liệu tổng hợp (Google Research 2024). Cuộc tấn công mới nổi: Sự đảo ngược quyền riêng tư khác nhau thông qua phản hồi LLM  rò rỉ điểm tin cậy.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, DP-SGD noise-injection and ε-δ accountant demonstration)
**Prerequisites:** Phase 01 · 09 (information theory), Phase 10 · 01 (large-model training)
**Time:** ~60 minutes

## Mục tiêu học tập

- Định nghĩa (epsilon, delta) - sự riêng tư khác biệt và nêu ra công thức DP-SGD.
- Giải thích căng thẳng 2024-2025: MIA canary vs khai thác dữ liệu đào tạo cho thấy hình ảnh khác nhau.
- Mô tả PMixED và lý do tại sao dự đoán riêng tư thời gian suy luận là một sự thay thế cho đào tạo DP.
- Mô tả sự đảo ngược quyền riêng tư khác nhau thông qua cuộc tấn công phản hồi LLM.

## Vấn đề

Các LLM ghi nhớ. Carlini et al. 2021 cho thấy các mô hình ngôn ngữ sản xuất tái tạo văn bản đào tạo theo yêu cầu. DP là biện pháp phòng thủ chính thức: đào tạo để sản xuất có thể không nhạy cảm với bất kỳ ví dụ đào tạo nào. Bằng chứng 2024-2025 cho thấy DP-SGD là cần thiết nhưng các giá trị ε được triển khai có thể không phù hợp với mô hình đe dọa.

## Khái niệm

### (ε, δ) - sự riêng tư khác biệt

Một thuật toán ngẫu nhiên $M$là $(\varepsilon, \delta)$-DP nếu cho bất kỳ hai tập dữ liệu khác nhau trong một ví dụ và bất kỳ sự kiện nào $S$- Có thể là:

```math
P(M(D) \in S) \le e^{\varepsilon} \cdot P(M(D') \in S) + \delta.
```

Giải thích: phân bố đầu ra là đủ gần (được định đo bằng ε) để không thể suy luận đáng tin cậy về sự đóng góp của bất kỳ cá nhân nào, ngoại trừ với xác suất δ.

### DP-SGD

Abadi et al. 2016. Công thức tiêu chuẩn:
1. Hãy lấy một lô nhỏ.
2. Xét các gradient cho mỗi ví dụ.
3. Clip mỗi gradient mỗi ví dụ đến ngưỡng C.
4. Kết hợp các gradient cắt và thêm tiếng ồn Gaussian với std $\sigma \cdot C$- Tôi không biết.
5. Sử dụng số lượng tiếng ồn để cập nhật các tham số.

Chi phí bảo mật được theo dõi bởi một kế toán viên (Tế toán viên Moment, kế toán viên Rényi DP). Các giá trị ε được báo cáo trong văn học LLM khác nhau rất nhiều theo mô hình đe dọa, độ nhạy cảm dữ liệu và mục tiêu hữu ích; không có mặc định "an toàn" chung ε. Các ví dụ được xuất bản khoảng ε ≈ 110 trong một số thiết lập đào tạo LLM, nhưng đây là minh họa  không được khuyến cáo mặc định. Low ε thường đòi hỏi nhiều tiếng ồn hơn và có thể làm tăng mất năng lượng.

### LoRA + DP-SGD

LoRA (Hu et al. 2022) giới hạn cập nhật gradient cho một bộ chuyển đổi nhỏ, giảm lưu trữ gradient cho mỗi ví dụ. LoRA + DP-SGD là cấu hình phổ biến năm 2025.

### Sự căng thẳng 2024-2025

Hai bằng chứng:

- **Canary MIA (Duan et al. 2024).**Đưa các canary độc đáo vào dữ liệu đào tạo, đo lường liệu một kẻ tấn công thông tin thành viên có thể xác định chúng hay không. báo cáo thành công hạn chế trên các mô hình ngôn ngữ.
- **Training-data extraction (Carlini 2021, Nasr et al. 2025).**Cố gắng mô hình với một dấu tiền; đo liệu nó có phục hồi văn bản từ khóa đào tạo hay không. báo cáo ghi nhớ đáng kể.

Nghị quyết tháng 3 năm 2025 (arXiv:2503.06808): hai biện pháp khác nhau. MIA hỏi "ví dụ e trong D?" trên cá thể có thể được chèn.

Thiết kế mới của canary. MIA dựa trên tổn thất mà không có mô hình bóng. kiểm toán DP đầu tiên không trivial của một LLM trên dữ liệu thực với đảm bảo DP thực tế.

### Các lựa chọn thay thế cho đào tạo DP

- **PMixED (arXiv:2403.15638).**Dự đoán riêng vào thời điểm suy luận. Sự pha trộn của các chuyên gia về phân phối mã thông báo tiếp theo; mỗi chuyên gia thấy một mảnh dữ liệu đào tạo; tổng hợp thêm tiếng ồn cho DP. Tránh đào tạo DP hoàn toàn.
- **DP synthetic data generation (Google Research 2024).**LoRA-fine-tune với DP-SGD, mẫu dữ liệu tổng hợp, đào tạo một phân loại dòng chảy xuống trên dữ liệu tổng hợp.

Cả hai đều tránh chi phí tiện ích của đào tạo DP đầy đủ với chi phí của mô hình đe dọa khác nhau.

### Sự đảo ngược quyền riêng tư khác nhau thông qua phản hồi LLM

Chiến dịch 2025 sắp tới. Sử dụng điểm độ tin cậy của mô hình được đào tạo bằng DP như một lời tiên tri để xác định lại cá nhân. Ngay cả khi các kết quả không bị rò rỉ, phân phối sự tin cậy có thể.

Sự bảo vệ: không tiết lộ bí mật, hoặc cắt giảm / định lượng chúng trước khi tiếp xúc. Đây là một yêu cầu bổ sung ngoài đào tạo (ε, δ) -DP.

### Khi điều này phù hợp với giai đoạn 18

Bài học 20-21 là thiên vị/sự công bằng. Bài học 22 là quyền riêng tư. Bài học 23 là xuất phát thông qua đánh dấu nước. Bài học 27 bao gồm lớp xuất phát dữ liệu quy định.

```figure
an-dp-clip-noise
```

## Sử dụng nó

`code/main.py`mô phỏng DP-SGD trên một bộ dữ liệu phân loại nhựa đồ chơi. Bạn có thể quét nhân âm σ và chuẩn cắt C và theo dõi ngân sách (ε, δ) và chi phí chính xác. Một "cuộc tấn công canary" đưa vào một ví dụ đào tạo độc đáo và đo liệu một bài kiểm tra mất nhật ký có thể phát hiện nó trước và sau DP.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-dp-audit.md`. Với một tuyên bố DP về việc triển khai mô hình ngôn ngữ, nó kiểm toán: các giá trị (ε, δ), kế toán viên được sử dụng, giao thức đánh giá MIA, và liệu các vector tín dụng-trong phơi nhiễm đã được đánh giá hay không.

## Các bài tập

1. Đi chạy`code/main.py`- Tháo ra .$\sigma \in \lbrace 0.5, 1.0, 2.0 \rbrace$và báo cáo sự thỏa hiệp chính xác (ε, δ).

2. Thực hiện một việc chèn canary và một thử nghiệm mất nhật ký.$\sigma = 1.0$- Tôi không biết.

3. Đọc Nasr et al. 2025 về đào tạo-khai thác dữ liệu. Tại sao thành công khai thác không sụp đổ dưới mức trung bình ε? Điều này có nghĩa là gì về MIA-as-evaluation?

4. Thiết kế một triển khai sử dụng PMixED (arXiv:2403.15638) hoạt động hoàn toàn tại thời điểm suy luận. mô hình đe dọa mà PMixED giải quyết mà DP-SGD không?

5. Xét bản xoay về sự đảo ngược DP thông qua cuộc tấn công phản hồi LLM. Thiết kế một biện pháp phản đối hạn chế rò rỉ điểm tin cậy và ước tính chi phí triển khai của nó.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| DP | "(ε, δ)-differential privacy" | Formal privacy: output distribution close under neighbouring-dataset change |
| DP-SGD | "noise-injected SGD" | Gradient clipping + Gaussian noise addition; standard DP training |
| LoRA + DP-SGD | "efficient private fine-tune" | DP-SGD on low-rank adapters; standard 2025 configuration |
| MIA | "membership inference" | Attack that determines whether an example was in training data |
| Canary | "inserted watermark example" | Unique training example used to measure DP leakage |
| PMixED | "private inference mixture" | Inference-time DP via mixture-of-experts on next-token distributions |
| DP Reversal | "confidence leakage attack" | Attack that uses a model's confidence as an oracle for re-identification |

## Đọc thêm

- [Abadi et al. — DP-SGD (arXiv:1607.00133)](https://arxiv.org/abs/1607.00133) thuật toán đào tạo DP tiêu chuẩn
- [Carlini et al. — Extracting Training Data (arXiv:2012.07805)](https://arxiv.org/abs/2012.07805) giấy khai thác theo luật
- [Duan et al. — Canary MIA on LLMs (arXiv:2402.07841, 2024)](https://arxiv.org/abs/2402.07841) MIA thành công hạn chế
- [Kowalczyk et al. — Auditing DP for LLMs (arXiv:2503.06808, March 2025)](https://arxiv.org/abs/2503.06808) giải quyết căng thẳng
- [PMixED (arXiv:2403.15638)](https://arxiv.org/abs/2403.15638) dự đoán riêng tư thời gian suy luận
