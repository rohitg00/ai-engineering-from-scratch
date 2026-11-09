# Sự kết hợp của các chuyên gia (MoE)

> Một biến thể 70B dày đặc kích hoạt mọi tham số cho mỗi token. một 671B MoE kích hoạt chỉ 37B cho mỗi token và đánh bại nó trên mọi điểm chuẩn. Sparsity là ý tưởng quy mô quan trọng nhất của thập kỷ.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## Vấn đề

FLOPs của một biến thể dày đặc khi suy luận bằng số parameter của nó (nói 2 cho chuyển tiếp phía trước). Scale lên một mô hình dày đặc và mỗi token trả phí đầy đủ. Đến năm 2024 biên giới đã đâm vào một bức tường tính toán: để có ý nghĩa thông minh hơn, bạn cần tăng trưởng theo tỉ lệ tăng FLOPs cho mỗi token.

Sự kết hợp của các chuyên gia phá vỡ mối liên kết này.$E$các chuyên gia độc lập + một bộ định tuyến chọn $k$Các chuyên gia cho mỗi token.$E \times \text{FFN size}$. Các tham số hoạt động cho mỗi token = $k \times \text{FFN size}$. Tự cấu hình điển hình năm 2026: $E=256$- $k=8$. Scales lưu trữ với $E$, tính toán các quy mô với $k$- Tôi không biết.

Biên giới 2026 gần như hoàn toàn là MoE: DeepSeek-V3 (671B tổng / 37B hoạt động), Mixtral 8×22B, Qwen2.5-MoE, Llama 4, Kimi K2, gpt-oss.

## Khái niệm

![MoE layer: router selects k of E experts per token](../assets/moe.svg)

### Việc trao đổi FFN

Phong chuyển đổi dày đặc:

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

Phòng MoE:

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

Mỗi chuyên gia là một FFN độc lập (thường là SwiGLU).`k`chuyên gia và có được một hỗn hợp được khóa ra của sản phẩm của họ.

### Vấn đề cân bằng tải

Nếu router đưa 90% mã thông qua Expert 3, các chuyên gia khác chết đói.

1. **Auxiliary load-balancing loss**(Switch Transformer, Mixtral). Thêm một hình phạt tương xứng với sự khác biệt trong việc sử dụng chuyên gia.
2. **Expert capacity + token dropping**(Switch sớm). Mỗi chuyên gia quá trình tối đa$C \times N/E$token; token quá tải bỏ qua lớp.
3. **Auxiliary-loss-free balancing**(DeepSeek-V3). Thêm một sự thiên vị được học theo chuyên gia thay đổi lựa chọn top-k của router. Bias được cập nhật bên ngoài sự mất tập. Không có hình phạt về mục tiêu chính.

Phương pháp của DeepSeek-V3: sau mỗi bước đào tạo, cho mỗi chuyên gia, kiểm tra xem việc sử dụng nó có trên hoặc dưới mục tiêu.`±γ`. Sử dụng lựa chọn `scores + bias`Các xác suất chuyên gia được sử dụng để gài là nguyên liệu`scores`Không thay đổi.

### Các chuyên gia chung

DeepSeek-V2/V3 cũng chia các chuyên gia thành *shared* và *routed*. Mỗi token đi qua tất cả các chuyên gia được chia sẻ. Các chuyên gia được chia sẻ được chọn qua top-k. Các chuyên gia được chia sẻ nắm bắt kiến thức chung; các chuyên gia được chia sẻ chuyên môn. V3 chạy 1 chuyên gia được chia sẻ cộng với top-8 trong 256 người được định tuyến.

### Các chuyên gia hạt mỏng

Classic MoE (GShard, Switch): mỗi chuyên gia rộng như một FFN đầy đủ. `E`là nhỏ (864), `k`là nhỏ (12).

MoE hạt mỏng hiện đại (DeepSeek-V3, Qwen-MoE): mỗi chuyên gia nhỏ hơn (1/8 kích thước FFN). $E$là lớn (256+), $k$là lớn hơn (8+). cùng số tham số tổng thể, nhưng kết hợp quy mô nhanh hơn nhiều. $\binom{256}{8} \approx 400$có thể có hàng nghìn tỷ "người chuyên gia" cho mỗi token chất lượng tăng lên, thời gian trễ vẫn ổn định.

### Tương tự chi phí

Mỗi token, mỗi lớp:

| Config | Active params / token | Total params |
|--------|-----------------------|--------------|
| Mixtral 8×22B | ~39B | 141B |
| Llama 3 70B (dense) | 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2 (MoE) | ~32B | 1T |

DeepSeek-V3 đánh bại Llama 3 70B (thấp) trên hầu hết mọi điểm chuẩn trong khi làm **fewer active FLOPs per token**. nhiều tham số hơn = nhiều kiến thức hơn. FLOP hoạt động hơn = nhiều tính toán hơn cho mỗi token. MoE tách chúng ra.

### Lòng nhớ

Tất cả các chuyên gia sống trên GPU bất kể người nào bắn. Một mô hình 671B cần ~ 1.3 TB VRAM cho trọng lượng fp16. Việc triển khai MoE biên giới đòi hỏi sự song song chuyên gia  các chuyên gia phân mảnh trên GPU, đường dẫn token trên mạng.

```figure
expert-routing
```

## Hãy xây dựng nó

Nhìn xem`code/main.py`Một lớp MoE nhỏ gọn trong chất xơ tinh khiết với:

- `n_experts=8`Các chuyên gia SwiGLU (mỗi người đều có một hình tuyến tính, ví dụ)
- top-k=2 định tuyến
- trọng lượng cửa được chuẩn hóa với độ mềm tối đa
- cân bằng không mất mát phụ trợ thông qua sự thiên vị của mỗi chuyên gia

`code/main.rs`là một cổng Rust với cùng các chức năng và demo. Nó chỉ sử dụng thư viện tiêu chuẩn. Số ngẫu nhiên khác với Python, nhưng kết luận in là giống nhau.

```bash
python3 code/main.py
rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson
```

### Bước 1: bộ định tuyến

```python
def route(hidden, W_router, top_k, bias):
    scores = [sum(h * w for h, w in zip(hidden, W_router[e])) for e in range(len(W_router))]
    biased = [s + b for s, b in zip(scores, bias)]
    top_idx = sorted(range(len(biased)), key=lambda i: -biased[i])[:top_k]
    # softmax over ORIGINAL scores of the chosen experts
    chosen = [scores[i] for i in top_idx]
    m = max(chosen)
    exps = [math.exp(c - m) for c in chosen]
    s = sum(exps)
    gates = [e / s for e in exps]
    return top_idx, gates
```

Bias ảnh hưởng đến sự lựa chọn, không phải trọng lượng cổng. Đó là thủ thuật DeepSeek-V3  Bias sửa chữa mất cân bằng tải mà không điều khiển dự đoán của mô hình.

### Bước 2: chạy 100 token qua bộ định tuyến

Theo dõi các chuyên gia bắn bao nhiêu lần.`-γ`cho các chuyên gia sử dụng quá mức, `+γ`cho sử dụng chưa được sử dụng), sử dụng hội tụ đến phân phối đồng nhất trong một vài lần lặp lại.

### Bước 3: So sánh số param

Bác "đồng độ mật độ" của cấu hình MoE. DeepSeek-V3-shaped: 256 routed + 1 shared, 8 active, d_model=7168.

## Sử dụng nó

HuggingFace Loading:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 kết luận sản xuất: vLLM hỗ trợ định tuyến MoE theo bản địa. SGLang có con đường đồng bộ chuyên gia nhanh nhất. Cả hai đều tự động xử lý lựa chọn top-k và đồng bộ chuyên gia.

**When to pick MoE:**
- Bạn muốn chất lượng hàng rào với chi phí suy luận thấp hơn cho mỗi token.
- Bạn có cơ sở hạ tầng VRAM / chuyên gia song song.
- Nhiệm vụ công việc của bạn là token-heavy (chat, code) không có ngữ cảnh-heavy (doc dài).

**When NOT to pick MoE:**
- Việc triển khai cạnh  bạn trả tiền cho lưu trữ đầy đủ cho bất kỳ FLOP hoạt động nào.
- Lạt-chẩn đoán một người dùng phục vụ  chuyên gia định tuyến thêm chi phí chung.
- Các mô hình nhỏ (<7B)  Lợi thế chất lượng của MoE chỉ xuất hiện trên ngưỡng tính toán (~ 6B các tham số hoạt động).

## Chuyển nó

Nhìn xem`outputs/skill-moe-configurator.md`. Kỹ năng chọn E, k, và chia sẻ chuyên gia bố cục cho một bộ phận mới của Bộ cho tham số ngân sách, mã thông báo đào tạo và mục tiêu triển khai.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`Xem cách cập nhật thiên vị không mất tích phụ giúp như thế nào để đồng hóa việc sử dụng chuyên gia trên 50 lần lặp lại.
2. **Medium.**Thay thế bộ định tuyến được học bằng một bộ định tuyến dựa trên hash (định nghĩa, không học). So sánh chất lượng và cân bằng. Tại sao bộ định tuyến được học tốt hơn?
3. **Hard.**Thực hiện "chế độ phân phối phù hợp" theo kiểu GRPO (truc DeepSeek-V3.2): ghi lại các chuyên gia bắn trong quá trình suy luận, buộc cùng một định tuyến trong quá trình tính toán gradient. Đo hiệu ứng trên thiết lập chính sách đồ chơi-gradient.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Expert | "One FFN among many" | An independent feed-forward network; parameters dedicated to a sparse slice of the FFN computation. |
| Router | "The gate" | A tiny linear layer that scores each token against each expert; top-k selection. |
| Top-k routing | "k active experts per token" | Each token's FFN computation goes through exactly k experts, weighted by gate. |
| Auxiliary loss | "Load-balance penalty" | Extra loss term that penalizes skewed expert usage. |
| Auxiliary-loss-free | "DeepSeek-V3's trick" | Balance via per-expert bias on the router's selection only; no extra gradient. |
| Shared expert | "Always on" | Extra expert through which every token passes; captures common knowledge. |
| Expert parallelism | "Shard by expert" | Distribute different experts to different GPUs; route tokens across the network. |
| Sparsity | "Active params < total params" | The ratio $k \times \text{expert size} / (E \times \text{expert size})$; 37/671 ≈ 5.5% for DeepSeek-V3. |

## Đọc thêm

- [Shazeer et al. (2017). Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538) ý tưởng.
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961) Switch, MoE cổ điển.
- [Jiang et al. (2024). Mixtral of Experts](https://arxiv.org/abs/2401.04088) Mixtral 8×7B.
- [DeepSeek-AI (2024). DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) MLA + MoE không mất mát hỗ trợ + MTP.
- [Wang et al. (2024). Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664) giấy cân bằng dựa trên sự thiên vị.
- [Dai et al. (2024). DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066) các chi tiết tinh tế + chia sẻ chuyên gia chia sẻ các sử dụng của router bài học này.
- [Kim et al. (2022). DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training](https://arxiv.org/abs/2201.05596) bài báo chuyên gia chung gốc.
