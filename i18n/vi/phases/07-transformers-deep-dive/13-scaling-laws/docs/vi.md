# Luật quy mô

> Bài báo Kaplan năm 2020 nói: mô hình lớn hơn, tổn thất thấp hơn. Bài báo Hoffmann năm 2022 nói: bạn đang được đào tạo thấp.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## Vấn đề

Khi bạn có C FLOPs của đào tạo tính toán và muốn mô hình tốt nhất, bạn phải đối mặt với hai nút:

1. **How many parameters (N)?**Mô hình lớn hơn, dung lượng cao hơn.
2. **How many training tokens (D)?**Nhiều dữ liệu hơn, sử dụng năng lực tốt hơn.

FLOPs có quy mô khoảng như `6 × N × D`Bạn có thể đẩy N lên và D xuống, hoặc D lên và N xuống.

Trước năm 2022, câu trả lời là "thổi N cứng". GPT-3 (2020) là các tham số 175B được đào tạo trên các token ~ 300B. Tỷ lệ khoảng 1,7 token mỗi tham số. Các luật quy mô Kaplan hỗ trợ điều này.

Hoffmann et al. (2022), đào tạo một gia đình mô hình nhỏ gọi là Chinchilla, tìm thấy một điều khác biệt: tỷ lệ tối ưu gần hơn với **20 tokens per parameter**GPT-3 bị thiếu đào tạo 10 lần. Chinchilla (70B params, 1.4T token) đánh bại GPT-3 (175B, 300B token) trên mọi điểm chuẩn với chi phí suy luận thấp hơn 2,5 lần.

2026 là thế giới của Chinchilla với một sự xoay quanh quan trọng. Llama 3 8B được đào tạo trên 15 nghìn tỷ token, tỷ lệ 1.875 token mỗi tham số. Ninety-four lần vượt qua Chinchilla-optimal. Chi phí suy luận quan trọng hơn chi phí đào tạo cho các mô hình sẽ được sử dụng ở quy mô, vì vậy quá trình đào tạo (trước Chinchilla) cho một dấu chân có thể triển khai nhỏ hơn là mặc định năm 2026.

## Khái niệm

![Chinchilla curves: loss vs compute at various N/D ratios](../assets/scaling-laws.svg)

### Luật Hoffmann

Từ tờ Chinchilla, mất mát là sau:

```math
L(N, D) = \frac{A}{N^\alpha} + \frac{B}{D^\beta} + E
```

- $N$= các tham số (không bao gồm).
- $D$= token đào tạo.
- $\alpha \approx 0.34$- $\beta \approx 0.28$(cứu độ đối xứng).
- $E \approx 1.69$, mức tối đa mất mát không thể giảm.
- $A \approx 406$- $B \approx 411$- Tôi không biết.

Hai thuật ngữ giao dịch với nhau khi bạn mở rộng quy mô.$N$với tính toán cố định ($C = 6ND$(văn) và giải quyết.$\alpha$và $\beta$ở trên, các biểu tượng xuất hiện ở khoảng 0,45 cho $N$và 0,55 cho $D$, do đó tỷ lệ tối ưu chính xác thay đổi chậm với ngân sách; `code/main.py`Các phương pháp đầu tiên của bài báo, đo lường tối ưu trực tiếp, đặt cả hai biểu tượng ở khoảng 0,5. Điều đó cho ra quy tắc thực nghiệm của một tỷ lệ cố định.$D = 20N$trong $C = 6ND$Và quy tắc ngón tay là:

```math
\begin{aligned}
N_{\text{opt}} &\approx 0.22 \times (C/6)^{0.5} \\
D_{\text{opt}} &\approx 4.5 \times (C/6)^{0.5} \\
D_{\text{opt}} / N_{\text{opt}} &\approx 20
\end{aligned}
```

Tính tối ưu tính toán: 20 token cho mỗi tham số.

### Sao lại tập quá nhiều?

Chinchilla-optimal giảm thiểu sự mất mát trong tập luyện cho mỗi tập FLOP. Nhưng bạn trả phí huấn luyện một lần; chi phí suy luận mãi mãi.

Đối với một chatbot phục vụ một nghìn tỷ token mỗi tháng, suy luận thống trị tổng chi phí. Cách tiếp cận của Llama: đào tạo nhỏ hơn, dài hơn. 8B tại 15T token được tối ưu hóa sâu sắc theo suy luận:

- Khớp với GPU của người tiêu dùng.
- Tốc độ trễ là một phần nhỏ của 70B Chinchilla tối ưu.
- Chất lượng là đủ gần để làm hầu hết các nhiệm vụ.

Bài báo 2024 của DeepMind ("Thay đào tạo là tối ưu mới") đã chính thức hóa điều này. Đối với tải trọng công việc bị chi phối bởi suy luận, tỷ lệ đúng gần 100500 token mỗi tham số tùy thuộc vào khối lượng phục vụ.

### Sự xuất hiện vs sự trơn tru

Thuyết: một số khả năng (làm toán, lý luận nhiều bước, theo dõi chuỗi suy nghĩ) đột nhiên "phơi lên" ở một số quy mô.

Schaeffer et al. (2023) lập luận rằng đây là một đồ tạo phép đo: các métrics mới nổi sử dụng điểm số không liên tục (sự phù hợp chính xác, độ chính xác ở ngưỡng) che giấu sự cải thiện trơn tru trong các logit cơ bản.

Năm 2026, sự đồng thuận là: dự đoán thông qua mất tích liên tục là đáng tin cậy.

### Hình ảnh năm 2026

Luật quy mô vẫn còn hiệu quả, nhưng:

| Factor | Changed how |
|--------|-------------|
| Data quality | Curating "good" tokens (Phi-style) shifts curves by >2× effective compute |
| MoE | Total params decouple from active FLOPs; scaling laws per-active-FLOP |
| Post-training | Some capabilities (instruction following, code) shift with SFT+RLHF more than pretraining |
| Multimodality | Image + text tokens scale together; separate curves per modality |
| Synthetic data | Models generate training data; effective compute can compound |

Máy tối ưu hóa Muon (Kimi Moonlight, 2024) cho thấy tăng hiệu quả tính toán ~ 2x so với AdamW ở dữ liệu phù hợp. Một số chạy đào tạo 2026 sử dụng Muon mặc định.

```figure
scaling-laws
```

## Hãy xây dựng nó

Nhìn xem`code/main.py`Chúng ta thực hiện phương trình mất mát của Chinchilla và giải quyết cho tính toán tối ưu$(N, D)$trong mỗi số các ngân sách tính toán.

### Bước 1: mất Chinchilla

```python
def chinchilla_loss(N, D, A=406.4, B=410.7, alpha=0.34, beta=0.28, E=1.69):
    return A / N ** alpha + B / D ** beta + E
```

Hình ảnh$L$như một đường viền trên $(N, D)$ở mức cố định $C = 6ND$Tìm tối thiểu.

### Bước 2: Biên giới tối ưu tính toán

Đối với ngân sách tính toán từ `1e17`đến`1e25`FLOPs, tìm $(N, D)$giảm thiểu thiệt hại theo quy định của:$6ND = C$- Kiểm tra tỷ lệ$D/N \approx 20$- Tôi không biết.

### Bước 3: chi phí quá trình đào tạo

Xét thêm tổn thất bạn trả để đào tạo một mô hình nhỏ hơn 10 × (1/10 của tối ưu N, 10 × tối ưu D).

### Bước 4: so sánh với các mô hình thực

Đưa vào biết `(N, D)`cặp cho GPT-3, Chinchilla, Llama 3 8B, DeepSeek- V3 (chỉ số hoạt động), và so sánh dự đoán so với tổn thất được báo cáo.

## Sử dụng nó

Bạn không thể tự đào tạo một mô hình biên giới, nhưng luật quy mô cho bạn biết:

1. **Whether your fine-tune has enough data.**Nếu dữ liệu cụ thể của bạn là dưới 20 token mỗi param của mô hình cơ bản, mong đợi bão hòa ở một số mức thua lỗ.
2. **Whether to pick a bigger base model.**Nếu bạn đang chi tiêu tất cả ngân sách của mình cho suy luận, hãy chọn một mô hình nhỏ hơn, được đào tạo lâu hơn.
3. **Where the returns diminish.**Ngoài 1000x Chinchilla tối ưu, thay đổi mất gỗ trở thành tiếng ồn.

**The research trajectory in 2026:**

- **Data-constrained regime.**Web có một số lượng giới hạn của các token chất lượng cao (~ 510 nghìn tỷ tiếng Anh sau khi lọc). Bước trước hàng rào đang tiến gần ngưỡng này. Dữ liệu tổng hợp, đa ngôn ngữ, đa phương pháp và điều chỉnh tinh tế theo quy mô RLHF là các đòn bẩy tiếp theo.
- **Compute-multiplier tricks.**Muon Optimizer, MoE, data curation tốt hơn  mỗi thay đổi các định vị tuyệt đối, không phải asymptote.
- **Scaling laws for RL.**Câu hỏi mở: bằng chứng sớm cho thấy luật quyền lực trong các mẫu RL nhưng với các biểu tượng rất khác so với trước khi tập luyện.

## Chuyển nó

Nhìn xem`outputs/skill-training-budget-estimator.md`- Nghề chọn kỹ năng`(N, D, hours, GPU)`cho một cuộc đào tạo mới với ngân sách tính toán, hạn chế triển khai và mất mục tiêu.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`- Bác in Chinchilla tối ưu$(N, D)$cho ngân sách tính toán `1e20`- `1e22`- `1e24`So sánh với cái bàn mô hình thực.
2. **Medium.**Thực hiện đường cong mất tích như hàm của máy tính Hoffmann.`log10(C)`Để xác định khi nào luật pháp dự đoán chúng ta cần$>10^{28}$FLOPs cho việc giảm 0,1 lần nữa trong sự chuyển động.
3. **Hard.**Đáp ứng luật quy mô của riêng bạn trên 5 mô hình nhỏ (100K đến 10M params) được đào tạo trên cùng một tập dữ liệu.$\alpha$và $E$Các tác giả của anh phù hợp với những tác giả được công bố như thế nào?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Parameters (N) | "Model size" | Non-embedding weight count; determines capacity. |
| Tokens (D) | "Training data" | Number of training tokens seen; determines how well the parameters get used. |
| Compute (C) | "FLOPs spent" | Approximately `6 × N × D` for a standard transformer. |
| Chinchilla-optimal | "D/N ≈ 20" | Ratio that minimizes loss per FLOP of pretraining. |
| Over-training | "Past Chinchilla" | Spend extra training FLOPs to save inference FLOPs; D/N >> 20. |
| Irreducible loss | "The floor" | The $E$ term in the scaling law; the entropy of the data itself. |
| Emergent capability | "Sudden jumps at scale" | Often a scorer artifact; continuous loss is smooth. |
| Effective compute | "Training-efficiency multiplier" | Better data / optimizer / architecture multiplies how far a FLOP goes. |

## Đọc thêm

- [Kaplan et al. (2020). Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) bài báo luật quy mô đầu tiên; chưa được đào tạo.
- [Hoffmann et al. (2022). Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556) Chinchilla.
- [Schaeffer et al. (2023). Are Emergent Abilities of Large Language Models a Mirage?](https://arxiv.org/abs/2304.15004) xuất hiện như một vật tạo ra phép đo.
- [Sardana, Frankle (2024). Beyond Chinchilla-Optimal: Accounting for Inference in Language Model Scaling Laws](https://arxiv.org/abs/2401.00448) tại sao việc đào tạo quá mức của Llama là điều thích hợp cho khối lượng công việc của nó.
- [Jordan et al. (2024). Muon: An optimizer for hidden layers in neural networks](https://kellerjordan.github.io/posts/muon/) 2x nhân tính toán.
