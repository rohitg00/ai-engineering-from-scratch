# Gia đình Optimize Preference trực tiếp

> Rafailov et al. (2023) cho thấy tối ưu của RLHF có hình thức đóng về dữ liệu ưu tiên, vì vậy bạn có thể bỏ qua mô hình phần thưởng rõ ràng và tối ưu hóa chính sách trực tiếp. Sự hiểu biết đó đã sinh ra một gia đình  IPO, KTO, SimPO, ORPO, BPO  mỗi người sửa chữa một chế độ thất bại của DPO. Năm 2026, các thuật toán sắp xếp trực tiếp sẽ vận chuyển nhiều chuyến chạy sau đào tạo hơn PPO. Nhưng đường cong tối ưu hóa quá mức từ Bài học 2 vẫn áp dụng: DAA không thoát khỏi Goodhart, họ chỉ di chuyển đến nơi nó cắn.

**Type:** Learn
**Languages:** Python (stdlib, six-variant preference-loss comparator), TypeScript
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking), Phase 10 · 08 (DPO basics)
**Time:** ~75 minutes

## Mục tiêu học tập

- Thuộc dẫn hình thức DPO đóng từ RLHF-with-KL tối ưu.
- Cụ thể chế độ thất bại của mỗi sửa chữa IPO, KTO, SimPO, ORPO, BPO trong DPO.
- Hóa ra sự khác biệt giữa "sự chênh lệch phần thưởng ngầm" và "sức mạnh ưu tiên" và giải thích lý do tại sao việc lập bản đồ danh tính của IPO là quan trọng.
- Giải thích lý do tại sao Rafailov et al. (NeurIPS 2024) chứng minh DAAs quá tối ưu hóa mặc dù không có RM rõ ràng.

## Vấn đề

Mục tiêu RLHF (Lớp 1):

```math
\max_{\pi} \; \mathbb{E}_{x, y \sim \pi} \big[ r(x, y) \big] - \beta \, \mathrm{KL}(\pi \,\|\, \pi_{\text{ref}})
```

có một tối ưu được biết đến:

```math
\pi^*(y \mid x) = \frac{1}{Z(x)} \, \pi_{\text{ref}}(y \mid x) \exp\!\left(\frac{r(x, y)}{\beta}\right)
```

Vì vậy, phần thưởng được xác định ngầm bởi tỷ lệ chính sách tối ưu với tham chiếu:

```math
r(x, y) = \beta \log \frac{\pi^*(y \mid x)}{\pi_{\text{ref}}(y \mid x)} + \beta \log Z(x)
```

Thay thế nó vào khả năng ưu tiên Bradley-Terry và chức năng phân vùng `Z(x)`hủy vì nó chỉ phụ thuộc vào `x`. Điều còn lại là một sự mất mát trong các tham số chính sách một mình không cần mô hình thưởng. Đó là DPO.

Sự nếp nhăn: dẫn xuất giả định tối ưu có thể đạt được, dữ liệu ưu tiên là trong phân phối, và chính sách tham chiếu là neo chế độ thực.

## Khái niệm

### DPO (Rafailov et al., 2023)

```math
L_{\text{DPO}} = -\log \sigma\!\left(
  \beta \log \frac{\pi(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)}
  - \beta \log \frac{\pi(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)}
\right)
```

Có thể sai gì?

- Sự chênh lệch phần thưởng ngầm `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)`Một sự ưu tiên nhỏ có thể tạo ra một khoảng cách lớn tùy tiện.
- Các ổ đĩa mất chọn và từ chối log-prob trong các hướng đối lập. nó có thể đẩy được chọn log-prob tuyệt đối xuống miễn là bị từ chối rơi nhanh hơn.
- Các ưu tiên không phân phối (cặp đôi khi cả hai câu trả lời đều hiếm trong chính sách tham chiếu) tạo ra những phần thưởng ngầm tùy ý.

### IPO (Azar et al., 2024)

Identity Preference Optimization thay thế log-sigmoid bằng một bản đồ danh tính trên xác suất ưu tiên.

```math
L_{\text{IPO}} = \left( \log \frac{\pi(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)} - \log \frac{\pi(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)} - \frac{1}{2\beta} \right)^2
```

Lợi nhuận được giới hạn bởi `1/(2 beta)`- Tăng cường ưu tiên và khoảng cách phần thưởng ngầm là tương xứng.

### KTO (Ethayarajh et al., 2024)

Kahneman-Tversky Optimization giảm cấu trúc đôi hoàn toàn. Với một đầu ra được dán nhãn duy nhất và một tín hiệu "thích" hoặc "không mong muốn" nhị phân, nó được lập bản đồ cho một tiện ích lý thuyết triển vọng:

```math
v(x, y) = \sigma\!\left(\beta \log \frac{\pi(y \mid x)}{\pi_{\text{ref}}(y \mid x)} - z_{\text{ref}}\right)
```

lợi ích: bạn có thể sử dụng dữ liệu không cặp, đó là nhiều hơn nhiều.

### SimPO (Meng et al., 2024)

Simple Preference Optimization phù hợp tín hiệu đào tạo với hệ thống.

```math
L_{\text{SimPO}} = -\log \sigma\!\left(
  \frac{\beta}{|y_w|} \log \pi(y_w \mid x)
  - \frac{\beta}{|y_l|} \log \pi(y_l \mid x)
  - \gamma
\right)
```

với một biên giới`gamma`Việc bình thường hóa chiều dài loại bỏ động lực để khai thác chế độ thất bại về chiều dài của DPO (longer `y_w`cho một khoảng cách lớn hơn log-prob theo xây dựng).

### ORPO (Hong et al., 2024)

Optimization Preference Ratio Optimization thêm một thuật ngữ ưu tiên cho SFT tiêu chuẩn khả năng log âm:

```math
\begin{aligned}
L_{\text{ORPO}} &= L_{\text{NLL}}(y_w) + \lambda L_{\text{OR}} \\
L_{\text{OR}} &= -\log \sigma\!\left(\log \frac{\text{odds}(y_w)}{\text{odds}(y_l)}\right)
\end{aligned}
```

Không có chính sách tham chiếu  thuật ngữ SFT là điều chỉnh. Đường bộ trong một giai đoạn từ mô hình cơ sở đến mô hình được sắp xếp. Không có điểm kiểm soát SFT riêng biệt.

### BPO (ICLR 2026 đệ trình, OpenReview id=b97EwMUWu7)

Xác định vấn đề Phản ứng được chọn xuống cấp: DPO giữ xếp hạng `y_w > y_l`Nhưng sự kiểm tra toàn diện của `y_w`BPO thêm một sửa đổi một dòng phạt chuyển động xuống trên câu trả lời được chọn. báo cáo chính xác +10.1% trên Llama-3.1-8B-Instruct về lý luận toán học trên DPO.

### Kết quả phổ biến: DAAs vẫn tối ưu hóa quá mức

Rafailov et al. "Các quy luật về tối ưu hóa quá mức mô hình phần thưởng trong thuật toán sắp xếp trực tiếp" (NeurIPS 2024) đào tạo các chính sách với DPO, IPO, SLiC về nhiều bộ dữ liệu trên các ngân sách KL. Các đường cong vàng-mức thưởng-về-KL có hình dạng cao điểm và sụp đổ Gao et al. Các câu hỏi phần thưởng ngầm ngoài phân phối mẫu trong quá trình đào tạo; điều chỉnh KL không ổn định điều này.

DAAs không thoát khỏi Goodhart. Chúng thay đổi bề mặt nơi nó cắn từ "mô hình phần thưởng được tối ưu hóa quá mức" đến "tỷ lệ chính sách tham chiếu được tối ưu hóa quá mức".

### Chọn trong số họ (2026)

- Nếu bạn có dữ liệu ưu tiên cặp lớn: DPO với beta bảo thủ, SimPO nếu sự thiên vị chiều dài rõ ràng.
- Nếu bạn có phản hồi nhị phân không cặp: KTO.
- Nếu bạn muốn một đường ống một giai đoạn từ một mô hình cơ bản: ORPO.
- Nếu bạn thấy các bản kiểm tra hồ sơ được chọn bị suy giảm trong hồ sơ DPO: BPO.
- Nếu ưu tiên mạnh khác nhau rất nhiều và DPO là bão hòa: IPO.

Mỗi phòng thí nghiệm chạy tất cả năm trên một pin và chọn người chiến thắng cho mỗi nhiệm vụ.

```figure
dpo-margin
```

## Sử dụng nó

`code/main.py`so sánh sáu lỗ (DPO, IPO, KTO, SimPO, ORPO, BPO) trên một bộ dữ liệu ưu tiên đồ chơi nơi sức mạnh ưu tiên thực sự thay đổi theo cặp. Mỗi lỗ được tối ưu hóa so với mẫu 500 cặp cùng với chính sách softmax nhỏ.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-preference-loss-selector.md`. Với số liệu thống kê của bộ dữ liệu (cặp với không cặp, biến với sức mạnh ưu tiên đồng nhất, phân phối chiều dài) và mục tiêu (một giai đoạn hoặc SFT-then-preference), đề nghị mất ưu tiên và báo cáo chế độ thất bại mà nó bảo vệ chống lại.

## Các bài tập

1. Đi chạy`code/main.py`. báo cáo sự sụt giảm cuối cùng của các hồ sơ kiểm tra được chọn cho DPO và BPO. BPO nên giữ cho xác suất tuyệt đối được chọn cao hơn

2. Thay đổi dữ liệu ưu tiên để tất cả các cặp có sức mạnh bằng nhau.

3. Làm cho các phản ứng bị từ chối trung bình dài hơn 2 lần so với lựa chọn.

4. Rafailov et al. (NeurIPS 2024) tuyên bố DAAs tối ưu hóa quá mức. Tạo lại một phiên bản điểm duy nhất: biểu đồ chọn-minus-đánh chối sự khác biệt KL và quan sát tối ưu hóa quá mức trong DPO ở beta lớn.

5. Đọc bản tóm tắt của BPO (OpenReview b97EwMUWu7).`code/main.py`- Tôi không biết.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| DPO | "RLHF without a reward model" | Loss derived from the closed-form RLHF optimum; policy parameters only |
| Implicit reward | "the log-ratio" | `beta * log(pi(y\|x) / pi_ref(y\|x))` — the DPO-implied reward |
| IPO | "bounded DPO" | Replaces log-sigmoid with identity; implicit reward gap capped by `1/(2 beta)` |
| KTO | "unpaired DPO" | Prospect-theory utility over single labels with loss aversion |
| SimPO | "reference-free DPO" | Length-normalized log-likelihood + margin; no reference policy |
| ORPO | "one-stage DPO" | NLL + odds-ratio preference term; trains from base model in one pass |
| BPO | "chosen-preserving DPO" | DPO plus a penalty for decreasing the chosen response's absolute log-prob |
| Degraded Chosen | "chosen goes down" | DPO decreases chosen log-prob so long as rejected falls faster |
| DAA | "direct alignment algorithm" | Any preference-loss method that skips an explicit RM |

## Đọc thêm

- [Rafailov et al. — Direct Preference Optimization (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290)
- [Azar et al. — A General Theoretical Paradigm to Understand Learning from Human Preferences (AISTATS 2024, arXiv:2310.12036)](https://arxiv.org/abs/2310.12036) IPO
- [Ethayarajh et al. — KTO: Model Alignment as Prospect Theoretic Optimization (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691)
- [BPO — Behavior Preservation Optimization (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov et al. — Scaling Laws for RM Overoptimization in DAAs (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900)
