# Sự chú ý Các biến thể  cửa sổ trượt, Sparse, Differential

> Tất cả sự chú ý là một vòng tròn. Mỗi token nhìn thấy mỗi token, và bộ nhớ trả giá. Ba biến thể xoay hình dạng của vòng tròn và phục hồi một nửa chi phí.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head), Phase 7 · 12 (KV Cache / Flash Attention)
**Time:** ~60 minutes

## Vấn đề

Chi phí chăm sóc đầy đủ $O(N^2)$trí nhớ và$O(N^2)$tính toán theo chiều dài chuỗi. Đối với một Llama 3 70B 128K-context là 16 tỷ lần chú ý mỗi lớp, nhân 80 lớp.$O(N^2)$Memory kích hoạt nhưng không thay đổi chi phí toán học  mỗi token vẫn phục vụ cho mỗi token khác.

Ba lớp biến thể thay đổi topology của bản thân ma trận chú ý:

1. **Sliding window attention (SWA).**Mỗi token sẽ được xem xét bởi một cửa sổ hàng xóm, không phải là tiền tố đầy đủ.$O(N \cdot W)$nơi $W$Gemma 2/3, Mistral 7B, Phi-3-Long.
2. **Sparse / block attention.**Chỉ có các cặp được chọn `(i, j)`Đánh giá số điểm, phần còn lại bị buộc phải giảm trọng lượng. Longformer, BigBird, OpenAI thâm hụt.
3. **Differential attention.**Xét hai bản đồ chú ý với các dự đoán Q / K riêng biệt, trừ một từ một. Tử "trọn trọng tâm" làm chảy máu trọng lượng vào vài token đầu tiên. DIFF Transformer của Microsoft (2024).

Các mô hình biên giới 2026 thường trộn lẫn chúng: hầu hết các lớp là SWA-1024, mỗi thứ năm là toàn cầu toàn bộ chú ý, và một số ít là các đầu khác biệt làm sạch lấy lại.

## Khái niệm

### Chú ý cửa sổ trượt (SWA)

Mỗi truy vấn ở vị trí $i$chỉ tham gia vào các vị trí trong $[i - W, i]$(SWA nguyên nhân) hoặc $[i - W/2, i + W/2]$(trong hai hướng) Các token bên ngoài cửa sổ nhận được$-\infty$trong số số điểm.

```
full causal:           sliding window (W=4):
positions 0-7          positions 0-7, W=4
    0 1 2 3 4 5 6 7        0 1 2 3 4 5 6 7
0 | x                0 |  x
1 | x x              1 |  x x
2 | x x x            2 |  x x x
3 | x x x x          3 |  x x x x
4 | x x x x x        4 |    x x x x
5 | x x x x x x      5 |      x x x x
6 | x x x x x x x    6 |        x x x x
7 | x x x x x x x x  7 |          x x x x
```

Vì $N = 8192$và $W = 1024$, các số điểm tử liệu có 1024 × 8192 không bằng 0 hàng trong kỳ vọng  một giảm 8 ×.

**KV cache shrinks with SWA.**Chỉ là cuối cùng thôi$W$Các token của K và V cần phải được giữ cho mỗi lớp. Đối với cấu hình Gemma-3-ish (1024 cửa sổ, ngữ cảnh 128K), bộ nhớ cache KV giảm 128x.

**Quality cost.**Các bộ chuyển đổi chỉ có SWA gặp khó khăn với việc lấy lại tầm xa. Giải pháp: để lại các lớp SWA với các lớp tập trung đầy đủ. Gemma 3 sử dụng 5:1 SWA: toàn cầu. Mistral 7B sử dụng một đống SWA nguyên nhân nơi thông tin "thường chảy về phía trước" thông qua các cửa sổ chồng chéo  mỗi lớp mở rộng lĩnh vực tiếp nhận hiệu quả bằng 5$W$, và sau đó`L`các lớp mà mô hình có thể tham dự `L × W`Đồ tín hiệu trở lại.

### Sự chú ý thâm hụt / ngăn chặn

Chọn một `N × N`Mô hình thắt lưng trước thời gian.

- **Local + strided (OpenAI sparse transformer).**Hãy chờ đợi người cuối cùng$W$token cộng với mỗi `stride`-Thiết hiệu trước đó.$O(N \cdot \sqrt{N})$tính toán.
- **Longformer / BigBird.**Cửa sổ địa phương + một bộ nhỏ các token toàn cầu (ví dụ `[CLS]`) được tham gia bởi tất cả mọi người và được tham gia bởi tất cả mọi người + liên kết ngẫu nhiên.
- **Native Sparse Attention (DeepSeek, 2025).**Tìm hiểu những khối nào của `(Q, K)`- Vấn đề, bỏ qua các khối không ở cấp độ hạt nhân.

Sparse Attention là một câu chuyện kỹ thuật hạt nhân. toán học đơn giản (mátrix điểm số); chiến thắng đến từ không bao giờ tải các mục 0 vào SRAM. FlashAttention-3 và 2026 FlexAttention API làm cho các mẫu hiếm tùy chỉnh hạng nhất trong PyTorch.

### Sự chú ý khác biệt (DIFF Transformer, 2024)

Sự chú ý thường xuyên có một vấn đề "thủy bỏ sự chú ý": softmax buộc mỗi hàng cộng lên 1, vì vậy các token không muốn tham gia vào bất cứ điều gì cụ thể sẽ bị đẩy vào khối lượng đầu tiên (hoặc vài đầu tiên).

Sự chú ý khác biệt khắc phục điều này bằng cách tính toán **two**Bản đồ chú ý và trừ:

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d}) \\
\text{DiffAttn} &= (A_1 - \lambda \cdot A_2) V
\end{aligned}
```

nơi $\lambda$là một scalar được học (thường là 0.50.8). A1 nắm bắt trọng lượng nội dung thực; A2 nắm bắt trục. Phục trừ hủy trục, phân bổ trọng lượng cho các token liên quan.

Kết quả được báo cáo (Microsoft 2024): 510% độ bối rối thấp hơn, bối cảnh hiệu quả dài hơn 1,52x với cùng độ dài được đào tạo, lấy lại kim cương trong đống cỏ sắc hơn.

### So sánh khác nhau

| Variant | Compute | KV cache | Quality vs full | Production use |
|---------|---------|----------|-----------------|----------------|
| Full attention | $O(N^2)$ | $O(N)$ per layer | baseline | every model's default layer |
| SWA (window 1024) | $O(N \cdot W)$ | $O(W)$ per layer | -0.1 ppl, good with global layers | Gemma 2/3, Phi-3-Long |
| Local + strided sparse | $O(N \cdot \sqrt{N})$ | mixed | similar to SWA | OpenAI sparse transformer, Longformer |
| BigBird (local + global + random) | $O(N)$ approx | mixed | matches full at 2× context | early long-context BERT |
| Native Sparse (DeepSeek-V3.2) | $O(N \cdot \text{active fraction})$ | $O(N)$ | within 0.05 ppl | DeepSeek-V3.2, 2025 |
| Differential | $O(2 \cdot N^2)$ | $O(2N)$ | -5 to -10% ppl | DIFF Transformer, early 2026 models |

```figure
gqa-kv-sharing
```

## Hãy xây dựng nó

Nhìn xem`code/main.py`, hoặc cảng Rust của nó`code/main.rs`Để chạy phiên bản Rust:`rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson`Chúng tôi thực hiện một so sánh mặt nạ nhân quả cho thấy toàn bộ, SWA, địa phương + bước, và sự chú ý khác biệt bên cạnh nhau trên một chuỗi đồ chơi.

### Bước 1: mặt nạ nguyên nhân đầy đủ (tầm cơ sở)

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

Hình cơ bản từ Bài học 07. Ba giác; trọng lượng không trên đường vạch.

### Bước 2: mặt nạ nhân quả cửa sổ trượt

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

Một tham số  `window`- Vì `window >= n`, bạn phục hồi sự chú ý nguyên nhân đầy đủ.`window = 1`, mỗi token chỉ phục vụ cho chính mình.

### Bước 3: mặt nạ nhỏ bé địa phương + bước

```python
def strided_mask(n, window, stride):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
        for j in range(0, i + 1, stride):
            M[i][j] = 0.0
    return M
```

Chiếc cửa sổ địa phương dày đặc cộng với mọi thứ`stride`-th token trở lại vào đầu chuỗi. trường nhận phát triển trong log bước với thêm lớp.

### Bước 4: sự chú ý khác biệt

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

Trong mã, chúng tôi so sánh bản đồ nhiệt độ tập trung-thấm của đơn so với phân biệt và xem bộ rửa sáp sụp đổ.

### Bước 5: KV cache kích thước

Bác kích thước cache trên mỗi lớp ở $N = 131072$cho mỗi biến thể. SWA và biến thể hiếm giảm 10100x. Differential đôi. Biết toán bộ nhớ của bạn một cách ý thức.

## Sử dụng nó

Các mô hình sản xuất năm 2026:

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

FlexAttention trong PyTorch 2.5+ chấp nhận chức năng mặt nạ:

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

Điều này biên soạn thành một hạt nhân Triton tùy chỉnh. Trong 10% tốc độ FlashAttention-3 cho các mẫu phổ biến, và chức năng mặt nạ là một Python có thể gọi.

**When to pick each:**

- **Pure full attention** mỗi lớp lên đến ~ 16K ngữ cảnh, hoặc khi chất lượng thu hồi là tối ưu.
- **SWA + global mix** ngữ cảnh dài (> 32K), tập luyện và suy luận có liên quan đến bộ nhớ.
- **Sparse block attention** hạt nhân tùy chỉnh, mô hình tùy chỉnh. Được dành riêng cho tải trọng công việc chuyên dụng (khám, âm thanh).
- **Differential attention** bất kỳ khối lượng công việc nào mà sự ô nhiễm nước lặn tập trung gây đau (RAG trong bối cảnh dài, kim trong đống cỏ).

## Chuyển nó

Nhìn xem`outputs/skill-attention-variant-picker.md`. Khả năng chọn một topology chú ý cho một mô hình mới do chiều dài bối cảnh mục tiêu, yêu cầu thu hồi và hồ sơ tính toán đào tạo / suy luận.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`- Kiểm tra SWA tại `window=4`- Đánh giá tất cả ngoài 4 token cuối cùng mỗi hàng.`window=n`tái tạo sự chú ý nguyên nhân đầy đủ theo bit-tương tự.
2. **Medium.**Thực hiện SWA nguyên nhân với `window=1024`Đọc 1000 bước trên Tinyshakespeare, giảm giá trị giảm giá bằng cách giảm sự chú ý?
3. **Hard.**Thực hiện một hỗn hợp lớp 5:1 kiểu Gemma-3 (5 SWA, 1 toàn cầu) trong mô hình đá cuối. So sánh chất lượng mất mát, bộ nhớ và sản xuất so với đường cơ sở SWA thuần khiết và đường cơ sở toàn cầu thuần khiết ở các tham số phù hợp.
4. **Hard.**Thực hiện sự chú ý khác biệt với một người học $\lambda$mỗi người. đào tạo về một nhiệm vụ lấy lại tổng hợp (một kim, 2.000 máy phân tâm). đo độ chính xác lấy lại so với một đường cơ sở chú ý duy nhất ở các tham số phù hợp.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sliding window attention (SWA) | "Local attention" | Each query attends to its last $W$ tokens; KV cache shrinks to $O(W)$. |
| Effective receptive field | "How far back the model sees" | In an $L$-layer SWA stack with window $W$, up to $L \times W$ tokens. |
| Longformer / BigBird | "Local + global + random" | Sparse patterns with a few always-attending global tokens; early long-context approach. |
| Native Sparse Attention | "DeepSeek's kernel trick" | Learn block-level sparsity; skip zero blocks at the kernel level while keeping quality. |
| Differential attention | "Two maps, one subtracts" | DIFF Transformer: subtract a learned $\lambda$ times a second attention map from the first to cancel attention sinks. |
| Attention sink | "Weight bleeds to token 0" | Softmax normalization forces rows to sum to 1; uninformative queries dump weight on position 0. |
| FlexAttention | "Mask-as-Python" | PyTorch 2.5+ API that compiles arbitrary mask functions into FlashAttention-shape kernels. |
| Layer type mix | "5:1 SWA-to-global" | Interleave sparse and full attention layers in a stack to keep quality at lower memory. |

## Đọc thêm

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) giấy cửa sổ trượt theo quy luật + giấy mã thông báo toàn cầu.
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062) địa phương + toàn cầu + ngẫu nhiên.
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) Mô hình địa phương + bước của OpenAI.
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) sự pha trộn 1:1 SWA: toàn cầu.
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) sự kết hợp 5:1 với window=1024 đó là sách giáo khoa mặc định.
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) Bảng biến đổi DIFF.
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) Sự chú ý về sự thâm hụt của DeepSeek-V3.2
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) Khán giả API cho mô hình mặt nạ như có thể gọi trong Use It.
