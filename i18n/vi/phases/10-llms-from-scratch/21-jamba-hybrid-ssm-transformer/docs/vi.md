# Jamba  SSM-Transformer Hybrid

> Các mô hình không gian nhà nước (SSM) và các bộ biến đổi muốn những thứ khác nhau. Các máy biến đổi mua chất lượng thông qua sự chú ý với chi phí bình phương. SSM mua suy luận thời gian tuyến tính và bộ nhớ liên tục thông qua sự tái phát nhưng chất lượng chậm. Jamba (March 2024) và Jamba 1.5 (Tháng 8 2024) của AI21 đặt chúng trong cùng một mô hình: 1 lớp biến thể cho mỗi 7 lớp Mamba, MoE trên mỗi khối khác, và một cửa sổ bối cảnh 256k phù hợp với một GPU 80GB duy nhất. Mamba-3 (ICLR 2026) thắt chặt phía SSM bằng không gian trạng thái có giá trị phức tạp và dự đoán MIMO. Bài học này đọc cả hai kiến trúc cuối cùng và giải thích tại sao công thức lai đã sống sót ba năm quy mô khi Pure-SSM và Pure-Transformer cố gắng ngữ cảnh dài không.

**Type:** Learn
**Languages:** Python (stdlib, layer-mix calculator), Rust
**Prerequisites:** Phase 10 · 14 (open-model architectures), Phase 10 · 17 (native sparse attention)
**Time:** ~60 minutes

## Mục tiêu học tập

- Giải thích ba nguyên thủy trong một khối Jamba  Lớp biến đổi, Lớp Mamba, MoE  và công thức 1:7: thậm chí là để lại.
- Giải thích sự tái phát của một SSM trông như thế nào ở mức cao và tại sao nó cho phép suy luận về bộ nhớ liên tục.
- Xét dấu chân cache KV của mô hình Jamba ở ngữ cảnh 256k và so sánh với những gì mô hình Pure-Transformer cần.
- Hãy nêu tên ba sáng kiến Mamba-3 (sự phân tích trapezoidal theo hàm số, cập nhật trạng thái có giá trị phức tạp, MIMO) và vấn đề mà mỗi một trong số đó nhắm mục tiêu.

## Vấn đề

Sự chú ý là hình vuông trong chiều dài chuỗi. Các mô hình không gian trạng thái là tuyến tính. Sự khác biệt đó là hợp chất: với 256k token, một bản đồ chú ý Transformer là 65B đầu vào; trạng thái lặp lại của SSM là kích thước cố định bất kể chiều dài chuỗi.

Các mô hình SSM tinh khiết (Mamba, Mamba-2) phù hợp với sự phức tạp của Transformer ở quy mô nhỏ nhưng chậm lại trong các nhiệm vụ theo dõi trạng thái và thất bại trong một số loại truy xuất trong ngữ cảnh.

Sự giải quyết rõ ràng: sử dụng cả hai. Đặt các lớp Transformer nơi ghi nhớ chính xác quan trọng. Sử dụng các lớp SSM ở nơi khác. Định nghĩa tỷ lệ. Jamba là mô hình cấp sản xuất đầu tiên gửi công thức lai này trên quy mô (52B tổng, 12B hoạt động, bối cảnh 256k, GPU 80GB đơn). Jamba 1.5 mở rộng gia đình lên 398B tổng / 94B hoạt động. Mamba-3 (ICLR 2026) là cơ sở tốt nhất hiện tại của SSM tinh khiết mà các lai có thể được xây dựng lại xung quanh.

Bài học này đọc cả ba bài báo và tạo ra mô hình tâm lý cho "đặt tỷ lệ đúng".

## Khái niệm

### Một SSM trong một trang

Một mô hình không gian trạng thái xử lý một chuỗi`x_1, ..., x_N`qua một trạng thái kích thước cố định `h`- Có thể là:

```math
\begin{aligned}
h_t &= A h_{t-1} + B x_t \\
y_t &= C h_t
\end{aligned}
```

Ở mỗi bước, trạng thái phát triển qua động lực tuyến tính.`A`, lấy thông tin `B x_t`, và phát ra sản lượng`C h_t`- `A, B, C`Hãy chú ý đến tính chất quan trọng: tính toán`y_t`chỉ cần `h_{t-1}`và `x_t`, không có gì trước đây `x`Tưởng thức là không đổi, suy đoán là không đổi.$O(1)$mỗi token.

Trùi để mô hình hóa chất lượng là cấu trúc của`A`. S4 (Gu 2021) sử dụng một trạm cấu trúc cao có thể được đánh giá hiệu quả như một sự xoay quanh dài trong quá trình đào tạo. Mamba (Gu, Dao 2023) thay thế các cố định `A, B, C`Mamba-2 (2024) tiếp tục đơn giản hóa cấu trúc. Mamba-3 (2026) thêm sự phức tạp ở các nơi cụ thể.

Tính chất chính: đối với một decoder LLM, một lớp SSM là một thay thế rơi vào một lớp chú ý, với trạng thái kích thước cố định cho mỗi lớp thay vì một bộ nhớ cache KV đang phát triển.

### Khu phố Jamba

Một khối Jamba nối các lớp theo hai số:

- `l`: tỷ lệ chú ý đến Mamba.`l = 8`, nghĩa là 1 lớp biến đổi cho mỗi 7 lớp Mamba (7 Mamba + 1 chú ý = 8 lớp cho mỗi nhóm).
- `e`: tần số MoE. Jamba sử dụng `e = 2`, nghĩa là mọi lớp khác áp dụng MoE.

Dòng lớp trong một khối:

```
M  M  M  M  M  M  M  A    (7 Mamba + 1 Attention)
|  M  |  M  |  M  |  M    (where | marks MoE applied)
```

Mỗi khối Jamba có 8 lớp. Ở độ sâu 4 khối (tổng cộng 32 lớp), bạn có 28 Mamba và 4 lớp chú ý. 16 trong số đó sử dụng MoE.

### Tại sao tỷ lệ 1:7

AI21 đã chạy các phép trừu tượng: tỷ lệ chú ý đến Mamba cho phép sự phức tạp tốt nhất cho mỗi tham số và nhớ trong ngữ cảnh trong các đánh giá ngữ cảnh dài của họ?

- Sự chú ý quá nhiều (1:1): chất lượng tăng lên nhưng trí nhớ và tốc độ suy giảm.
- Sự chú ý quá ít (1:15): trí nhớ là rất lớn nhưng tìm kiếm trong ngữ cảnh thất bại.
- Điểm ngọt ngào: 1:7 hoặc 1:8.

Nhận thức: các lớp Transformer xử lý việc ghi nhớ chính xác và theo dõi trạng thái.

### Mã hóa vị trí

Các lớp Mamba tự nhận thức vị trí (thông qua sự tái phát). Các lớp chú ý trong các lai mầm gốc dựa trên Mamba không sử dụng RoPE  các lớp SSM cung cấp thông tin vị trí. Jamba 1.5 thêm RoPE vào các lớp chú ý để tổng quát ngữ cảnh dài hơn, một tinh chỉnh hậu hoc dựa trên đánh giá ngữ cảnh dài thực nghiệm.

### Ngân sách bộ nhớ

Đối với hình dạng Jamba-1 (32 lớp: 28 Mamba + 4 chú ý, ẩn 4096, 32 đầu chú ý):

- KV cache (chỉ là các lớp chú ý): `2 * 4 * 32 * 128 * 256k * 2 = 16 GB`Chỉ có 4 lớp chú ý đóng góp. Jamba được phát hành sử dụng GQA với 8 đầu KV trong các lớp đó, đưa điều này lên 4 GB, con số trong giấy Jamba.
- Tình trạng SSM: `28 * hidden * state_size`cho mỗi dấu tiền, nhưng đây là một kích thước cố định cho mỗi lớp, không quy mô với chiều dài chuỗi. trạng thái Mamba điển hình là 16 cho mỗi tính năng, ẩn 4096: `28 * 4096 * 16 * 2 = 3.7 MB`Toàn bộ.

So sánh với một Transformer tinh khiết ở 32 lớp, cùng một ẩn, đầy đủ MHA ở 32 đầu: `2 * 32 * 32 * 128 * 256k * 2 = 128 GB`Tỷ lệ dự trữ KV giảm 8 lần.`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`), một máy hybrid 1:7 với 32 đầu KV ở 16 GB vẫn nhỏ hơn 2 lần.

Đó là điều AI21 có nghĩa là "256k ngữ cảnh trên một GPU 80GB duy nhất". Cache KV của một Transformer tinh khiết đầy đủ MHA sẽ không phù hợp; ngay cả một đường cơ sở GQA không để lại chỗ cho trọng lượng và kích hoạt; Jamba làm vậy.

### Mamba-3: đường cơ sở của SSM thuần khiết vào năm 2026

Mamba-3 (ICLR 2026, arXiv:2603.15569) giới thiệu ba đổi mới về phía SSM thuần túy:

1. **Exponential-trapezoidal discretization.**Thay thế cách phân tích Euler trong Mamba-2 bằng một sự tái phát biểu biểu cảm hơn.`x_t`- Tôi không biết.

2. **Complex-valued state update.**Mamba-3 đã giảm các khối lượng trạng thái từ phức tạp (S4) xuống đường chọc thực (Mamba) đến danh tính quy mô (Mamba-2). Mamba-3 thêm lại các giá trị phức tạp tương đương với một sự nhúng xoay phụ thuộc dữ liệu vào trạng thái. Điều này khôi phục khả năng theo dõi trạng thái mà các đơn giản hóa giá trị thực trước đó chi phí.

3. **Multi-input multi-output (MIMO) projections.**Thay vì các dự đoán quy mô trên mỗi tính năng, sử dụng các dự đoán có giá trị matrix. Cải thiện sức mạnh mô hình hóa và sử dụng phần cứng thời gian suy luận mà không tăng độ trễ giải mã.

Ở các tham số 1.5B, Mamba-3 cải thiện độ chính xác trung bình dòng chảy xuống 0,6 điểm so với Gated DeltaNet; biến thể MIMO thêm 1,2 điểm để tăng tổng 1,8 điểm.

Mamba-3 chưa được vận chuyển trong một sản xuất lai quy mô  nhưng nó là ứng cử viên rõ ràng cho phía SSM của mô hình lớp Jamba tiếp theo.

### Khi nào để tìm một con lai

Hybrid thắng khi:

- Nội dung đủ dài để cache KV Transformer tinh khiết trở nên đau (64k+).
- Các nhiệm vụ kết hợp cấu trúc tầm ngắn (có lợi cho SSM) với việc thu hồi tầm xa (cần Transformer).
- Bạn muốn triển khai trên các ngân sách bộ nhớ GPU đơn nơi mà bộ nhớ cache KV Transformer đơn độc sẽ không phù hợp.

Hybrid thua khi:

- Nội dung ngắn (dưới 16k). SSM Overhead là lãng phí; Transformer tinh khiết là tốt.
- Các nhiệm vụ cần phải được chú ý ở mọi nơi (chủ nghĩa suy luận sâu sắc, tham chiếu chéo nhiều tài liệu).
- Bạn đang mở rộng quy mô lên hàng nghìn tỷ mô hình biên giới. Pure-Transformer + MLA + MoE (thiết kế DeepSeek-V3) hiện đang giành chiến thắng trong cuộc đua khả năng.

### Vị cảnh cạnh tranh

| Model | Family | Scale | Unique claim |
|-------|--------|------|-------------|
| Mamba-2 | pure SSM | 3B | linear time, constant memory |
| Jamba | hybrid | 52B/12B | 256k on 80GB |
| Jamba 1.5 Large | hybrid | 398B/94B | enterprise-grade long-context |
| Mamba-3 | pure SSM | 1.5B (paper) | state-tracking restored |
| DeepSeek-V3 | pure Transformer + MoE | 671B/37B | frontier capability |

Tâm lý năm 2026: Pure-Transformer MoE thống trị biên giới, nhưng các lai tạo sở hữu mảng bối cảnh 256k-plus.

```figure
swiglu-ffn
```

## Sử dụng nó

`code/main.py`là một máy tính nhớ cho các kiến trúc lai. Với tỷ lệ SSM-Transformer và cấu hình kích thước ẩn / số lớp, nó tính toán:

- KV cache tại ngữ cảnh mục tiêu.
- Tưởng thức trạng thái SSM.
- Tổng bộ nhớ tại ngữ cảnh N cho một loạt các hình dạng mô hình.

Máy tính hỗ trợ:

- Tỷ lệ cơ sở của Pure-Transformer (KV cache tăng lên với N).
- Hybrid kiểu Jamba 1:7
- Pure-SSM (không có cache KV).

Các con số được trực tiếp lấy từ các bài báo Jamba-1 và Jamba-1.5 cho các hình dạng được xuất bản và được phân tích cho các biến thể giả thuyết.

Các cân nhắc tích hợp cho một triển khai thực tế:

- Hầu hết các máy chủ suy luận sản xuất (vLLM, SGLang) hỗ trợ Jamba và Mamba.
- Ở khung cảnh 256k, lợi thế bộ nhớ của Jamba xuất hiện trong thông qua yêu cầu đồng thời.
- Mamba-3 như một mô hình độc lập vẫn chưa được vận chuyển trong sản xuất  nghiên cứu xem trước tại 1.5B.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-hybrid-picker.md`. Với một quy định tải trọng công việc (tương tự chiều dài ngữ cảnh, hỗn hợp nhiệm vụ, ngân sách bộ nhớ), nó khuyên nên giữa một Transformer tinh khiết, một hybrid kiểu Jamba, và một SSM tinh khiết, với lý luận rõ ràng về bộ nhớ và chất lượng tradeoffs.

## Các bài tập

1. Đi chạy`code/main.py`để tính toán bộ nhớ cache KV tại 256k ngữ cảnh cho một Transformer tinh khiết 32 tầng (bỏ 4096, 32 đầu) và cho một hybrid Jamba-1 cùng hình dạng.

2. Thay đổi máy tính để mô hình hóa một bộ nhớ đệm KV tương đương với bộ nhớ trạng thái SSM.

3. Đọc Phần 3 của bài báo Jamba (arXiv:2403.19887). Giải thích tại sao AI21 sử dụng Mamba-1 thay vì Mamba-2 mặc dù Mamba-2 nhanh hơn.

4. Xét số tham số trên của MoE-every-other-layer trong Jamba 1.5 Large (398B tổng, 94B hoạt động). So sánh tỷ lệ hoạt động với DeepSeek-V3 (37B/671B) và giải thích tại sao kiến trúc của Jamba đẩy tỷ lệ hoạt động lên hơn.

5. Đọc Phần 3 của bài báo Mamba-3 (arXiv:2603.15569). Giải thích bằng ba câu tại sao một bản cập nhật trạng thái có giá trị phức tạp tương đương với một việc nhúng xoay phụ thuộc vào dữ liệu. Kết nối câu trả lời với dẫn xuất RoPE của giai đoạn 7 · Bài học 04 .

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| State space model (SSM) | "Recurrence with a fixed state" | A layer with a learned recurrence `h_t = A h_{t-1} + B x_t`; constant memory per token |
| Selective SSM | "Mamba's trick" | Data-dependent A, B, C parameters that give the model gating-like selectivity at linear time |
| Attention-to-Mamba ratio | "How many attention layers" | In Jamba, `l = 8` means 1 attention layer per 7 Mamba layers |
| Jamba block | "The 8-layer group" | One attention + seven Mamba + MoE on alternate positions |
| SSM state | "The hidden buffer" | Fixed-size per-layer state that replaces the KV cache for Mamba layers |
| 256k context | "Jamba's flagship number" | The sequence length Jamba-1 fits on a single 80GB GPU; pure Transformer cannot at that size |
| Mamba-3 | "2026 pure SSM" | Current-best pure-SSM architecture with complex state + MIMO; the baseline hybrids rebuild around |
| MIMO | "Multi-input multi-output" | Mamba-3 innovation using matrix-valued projections instead of scalar per-feature |
| Exponential-trapezoidal discretization | "Mamba-3's recurrence" | More expressive recurrence that subsumes Mamba-2's Euler-method discretization |
| Hybrid architecture | "Mix attention and SSM" | Any model that interleaves Transformer and SSM layers; Jamba is the production archetype |

## Đọc thêm

- [Lieber et al. — Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887) giấy Jamba gốc, tỷ lệ trừ, 256k tuyên bố ngữ cảnh
- [AI21 — Jamba 1.5: Hybrid Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570) gia đình mở rộng, 398B/94B và 12B/52B công bố công khai
- [Gu, Dao — Mamba: Linear-Time Sequence Modeling with Selective State Spaces (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752) giấy SSM chọn lọc Jamba xây dựng trên
- [Dao, Gu — Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060) kế thừa không gian nhà nước có cấu trúc đơn giản
- [Lahoti et al. — Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569) Nhà nước có giá trị phức tạp, MIMO, biên giới 2026-SSM thuần túy
- [Gu et al. — Efficiently Modeling Long Sequences with Structured State Spaces (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396) Báo cáo S4, điểm khởi đầu của dòng dõi SSM cho LLM
