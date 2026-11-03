# Tự đoán giải mã  Dự thảo, xác minh, lặp lại

> Autoregressive decoding là hàng loạt. Mỗi token chờ đợi cho token trước đó. Spekulative decoding phá vỡ chuỗi: một mô hình rẻ tiền che chở N token, mô hình đắt tiền xác minh tất cả N trong một lần đi trước. Khi dự thảo đúng, bạn đã trả một tiền lớn cho N thế hệ.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 07 (GPT Causal LM), Phase 7 · 12 (KV Cache & Flash Attention)
**Time:** ~60 minutes

## Vấn đề

Một mẫu 70B LLM lấy một token mất ~ 30 ms trên một H100. Một mô hình dự thảo 3B mất ~ 3 ms. Nếu chúng ta để dự thảo 3B 5 token trước, sau đó chạy 70B * một lần * để xác minh tất cả 5, tổng là $5 \times 3 + 30 = 45$ms cho tối đa 5 token được chấp nhận  so với `5×30 = 150 ms`Đó là mức độ giải mã đầu cơ đầy đủ: trao đổi một lượng nhỏ bộ nhớ GPU bổ sung (chương trình dự thảo) cho độ trễ giải mã thấp hơn 24x.

Trù này phải bảo vệ phân phối. Tiêu chuẩn lấy mẫu dự đoán, được đưa ra bởi Leviathan et al. (2023) và bởi Chen et al. đồng thời, đảm bảo rằng chuỗi đầu ra là **identically distributed**Không có sự thỏa hiệp về chất lượng, chỉ nhanh hơn.

Bốn gia đình của các cặp kiểm tra dự thảo thống trị suy luận 2026:

1. **Vanilla speculative (Leviathan 2023).**Mô hình dự thảo riêng biệt (ví dụ: Llama 3 1B) + xác minh (ví dụ: Llama 3 70B).
2. **Medusa (Cai 2024).**Nhiều đầu giải mã trên xác minh dự đoán vị trí `t+1..t+k`Không có mô hình dự thảo riêng biệt.
3. **EAGLE family (Li 2024, 2025).**Dự thảo nhẹ sử dụng lại các trạng thái ẩn của người xác minh; tỷ lệ chấp nhận gần hơn so với vanilla; 34× điển hình.
4. **Lookahead decoding (Fu 2024).**- Không cần mô hình dự thảo, tự đoán, không phụ thuộc.

Mỗi sản xuất kết luận xếp chồng vào năm 2026 tàu dự đoán giải mã mặc định. vLLM, TensorRT-LLM, SGLang, và llama.cpp tất cả hỗ trợ ít nhất vanilla + EAGLE-2.

## Khái niệm

### Các thuật toán cốt lõi

Với một người xác minh $M_q$và một bản thảo rẻ hơn $M_p$- Có thể là:

1. Để $x_1 \ldots x_k$là tiền tố đã được giải mã.
2. **Draft**: sử dụng $M_p$để tự lập lập đề xuất $d_{k+1}, d_{k+2}, \ldots, d_{k+N}$với dự thảo xác suất $p_1 \ldots p_N$- Tôi không biết.
3. **Verify in parallel**: chạy $M_q$Một lần nữa $x_1 \ldots x_k, d_{k+1}, \ldots, d_{k+N}$, nhận xác minh xác suất $q_1 \ldots q_{N+1}$cho các vị trí $k+1 \ldots k+N+1$- Tôi không biết.
4. **Accept/reject each draft token left to right**: cho mỗi $i$, chấp nhận với khả năng$\min(1, q_i(d_i) / p_i(d_i))$- Tôi không biết.
5. Khi bị từ chối lần đầu tiên tại vị trí $j$: mẫu $t_j$từ phân phối "bỏ còn" $(q_j - p_j)_+$Tất cả các bản thảo sau đó$j$được loại bỏ.
6. Về việc chấp nhận tất cả$N$: mẫu một token thêm $t_{N+1}$từ $q_{N+1}$(tương hiệu tiền thưởng miễn phí).

Trù phân phối dư là cái nhìn toán học giữ cho sản phẩm được phân phối chính xác như thể $M_q$đã lấy mẫu từ đầu.

### Điều gì quyết định tốc độ

Để $\alpha$= tỷ lệ chấp nhận dự kiến cho mỗi dự án token.$c$= tỷ lệ chi phí dự thảo đối với kiểm tra viên.

- Thế hệ ngây thơ sẽ gọi 1 mẫu lớn cho mỗi token.
- Tiêu chuẩn cho 1 cuộc gọi lớn mỗi tháng$(1 - \alpha^{N+1}) / (1 - \alpha) \approx 1/(1-\alpha)$token khi $\alpha$cao.

Quy tắc điển hình của thằng bé$\alpha = 0.75$và $N = 5$: 3 lần ít hơn các cuộc gọi lớn mô hình. chi phí dự thảo là 5 lần rẻ. Tổng đồng hồ tường giảm ~ 2,5 lần.

**$\alpha$ depends on:**

- Làm thế nào để dự thảo gần gũi với xác minh.$\alpha$đáng kể.
- Chiến lược giải mã. Dự thảo tham lam chống lại xác minh tham lam: cao $\alpha$- Tiêu chuẩn nhiệt độ: khó để phù hợp; chấp nhận giảm.
- Loại nhiệm vụ: Mã và kết quả cấu trúc chấp nhận nhiều hơn (đáng dự đoán); viết sáng tạo dạng tự do chấp nhận ít hơn.

### Medusa  Dự thảo không có mô hình dự thảo

Medusa thay thế mô hình dự thảo bằng các đầu đầu ra ngoài thêm trên xác minh.`t`- Có thể là:

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

Mỗi đầu phát ra logits của riêng mình. Khi suy luận bạn lấy mẫu từ mỗi đầu để có được một chuỗi ứng cử viên, sau đó xác minh bằng một lần đi trước bằng cách sử dụng một kế hoạch chú ý cây xem xét tất cả các tiếp tục ứng cử viên cùng một lúc.

Lợi thế: không có mô hình thứ hai. Khối thấu: thêm các tham số có thể đào tạo; cần một giai đoạn điều chỉnh tinh tế được giám sát (~ 1B token); tỷ lệ chấp nhận thấp hơn một chút so với loại vanilla đầu cơ với một bản thảo tốt.

### Eagle  mô tả tốt hơn bằng cách tái sử dụng các trạng thái ẩn

EAGLE-1/2/3 (Li et al., 20242025) làm cho mô hình dự thảo trở thành một bộ biến đổi nhỏ (thường là 1 lớp) nuốt vào trạng thái ẩn lớp cuối cùng của người xác minh. Bởi vì bản thảo thấy đại diện tính năng của người xác minh, dự đoán của nó tương quan chặt chẽ với phân phối đầu ra của người xác minh. Tỷ lệ chấp nhận tăng từ ~ 0,6 (vanilla) lên 0,85+. Đây là tỷ lệ mỗi token trên các tiêu chuẩn trò chuyện, với một bản thảo được đào tạo trên dữ liệu trò chuyện phù hợp. Đối với lưu lượng sản xuất hỗn hợp, giai đoạn 17 · 05 có kế hoạch 0,6 đến 0,8 cho EAGLE-3, và lưu lượng domain có thể thấp hơn.

EAGLE-3 (2025) đã thêm tìm kiếm cây trên các tiếp tục ứng cử viên. vLLM và SGLang tàu EAGLE-2/3 như là con đường thông số mặc định cho Llama 3/4 và Qwen 3.

### Vũ vẹ KV

Các nguồn cấp dữ liệu xác minh $N$dự thảo mã thông báo vào xác minh trong một lần đi trước. Điều này mở rộng bộ nhớ cache KV của xác minh bởi $N$Nếu một số bản thảo bị từ chối, bạn phải xoay bộ nhớ cache trở lại chiều dài tiền tố được chấp nhận.

Các thực hiện sản xuất (vLLM's `--speculative-config`- Thử xử lý với các bộ đệm KV.

```figure
draft-verify-tokens
```

## Hãy xây dựng nó

Nhìn xem`code/main.py`Chúng tôi thực hiện thuật toán lấy mẫu đầu cơ cốt lõi (phases of rejection + residual distribution) với:

- Một "chương trình lớn" là một xác định-softmax trên một phân phối mã hóa bằng tay (vì vậy chúng ta có thể xác minh toán học chấp nhận phân tích).
- Một "mô hình bản thảo" là một sự xáo trộn của mô hình lớn.
- Một vòng chấp nhận / từ chối tạo ra phân phối biên tương tự như lấy mẫu trực tiếp.

### Bước 1: Bước từ chối

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u`là một số ngẫu nhiên đồng nhất. `q_prob`là xác định xác suất của người xác minh cho token được soạn thảo. `p_prob`Lý thuyết Leviathan là quyết định Bernoulli này, tiếp theo là lấy mẫu từ phần còn lại khi từ chối, bảo tồn phân bố xác minh chính xác.

### Bước 2: phân phối dư

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

Giảm `p`từ `q`- Nhìn vào các yếu tố, clamp các giá trị âm xuống 0, tái bình thường hóa.

### Bước 3: một bước đầu cơ

```python
def spec_step(prefix, q_model, p_model, N, rng):
    drafts = []
    p_probs = []
    ctx = list(prefix)
    for _ in range(N):
        p_dist = p_model(ctx)
        d = sample(p_dist, rng)
        drafts.append(d)
        p_probs.append(p_dist[d])
        ctx.append(d)

    q_dists = [q_model(prefix + drafts[:i]) for i in range(N + 1)]

    for i, d in enumerate(drafts):
        u = rng.random()
        q_prob = q_dists[i][d]
        p_prob = p_probs[i]
        if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
            prefix = prefix + [d]
        else:
            res = residual_dist(q_dists[i], p_model(prefix))
            prefix = prefix + [sample(res, rng)]
            return prefix
    prefix = prefix + [sample(q_dists[N], rng)]
    return prefix
```

Năm chấp nhận → một tiền thưởng → sáu token được sản xuất trong một thẻ xác minh.

### Bước 4: đo lường tỷ lệ chấp nhận

Thực hiện 10.000 bước đầu cơ ở các cấp độ chất lượng dự thảo khác nhau. tỷ lệ chấp nhận bản đồ so với sự khác biệt KL giữa phân phối dự thảo và xác minh. Bạn nên thấy một mối quan hệ đơn tần sạch.

### Bước 5: kiểm tra sự tương đương phân phối

Theo kinh nghiệm: histogram của các token được tạo ra bởi vòng đầu cơ nên phù hợp với histogram được tạo ra bằng cách lấy mẫu trực tiếp từ người xác minh. Đây là định lý Leviathan trong thực tế. Một thử nghiệm chi-quad xác nhận trong sai lầm lấy mẫu.

## Sử dụng nó

Sản xuất:

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "eagle", "model": "/models/llama-3.1-eagle-70b", "draft_tensor_parallel_size": 1, "num_speculative_tokens": 5}'

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "draft_model", "model": "meta-llama/Llama-3.2-1B-Instruct", "num_speculative_tokens": 5}'
```

TensorRT-LLM có con đường Medusa nhanh nhất từ giữa năm 2026. `faster-whisper`bao trùm mã hóa giả định cho Whisper-large với một bản thảo nhỏ.

**Picking a draft:**

| Strategy | When to pick | Speedup |
|----------|--------------|---------|
| Vanilla draft (1B/3B Llama family) | Fast prototype, no training | 1.8–2.3× |
| Medusa heads | You can fine-tune the verifier | 2–3× |
| EAGLE-2 / 3 | Production, max speed | 3–4× |
| Lookahead | No draft, no training, no extra params | 1.3–1.6× |

**When NOT to spec-decode:**

- Tạo ra 1-5 token, tổng chi phí thống trị.
- Tiêu chuẩn thử nghiệm nhiệt độ cao ($\alpha$(đáng nhỏ).
- Việc triển khai bị hạn chế trong bộ nhớ (chương trình dự thảo thêm VRAM).

## Chuyển nó

Nhìn xem`outputs/skill-spec-decode-picker.md`Kỹ năng chọn một chiến lược giải mã phỏng đoán (vanilla / Medusa / EAGLE / lookahead) và điều chỉnh các tham số (N, nhiệt độ dự thảo) cho khối lượng công việc suy luận mới.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`. xác nhận phân phối mã thông báo đầu cơ phù hợp với phân phối mẫu trực tiếp của người xác minh trên 50.000 mã thông báo trong chi-quad p > 0,05.
2. **Medium.**Tốc độ nhanh hóa (tốc hiệu cho mô hình lớn tiến) như một hàm của $N$cho $\alpha = 0.5, 0.7, 0.85$- Định vị tối ưu $N$cho mỗi $\alpha$. (Công báo: dự kiến token cho mỗi cuộc gọi xác minh = $(1 - \alpha^{N+1}) / (1 - \alpha)$.)
3. **Hard.**Thực hiện một Medusa nhỏ: lấy GPT đá cuối từ Bài học 14, thêm 3 đầu LM bổ sung dự đoán các vị trí t + 2, t + 3, t + 4. Tập luyện trên Tinyshakespeare với một mất nhiều đầu chung. So sánh tỷ lệ chấp nhận so với một bản thảo vanilla được tạo bằng cách cắt giảm mô hình tương tự.
4. **Hard.**Thực hiện rollback: bắt đầu với một dự trữ dự trữ KV tiền đề 10 token, cấp dữ liệu 5 dự thảo token, mô phỏng từ chối ở vị trí 3. Kiểm tra đọc cache của bạn phù hợp với " dự thảo + 2 dự thảo được chấp nhận đầu tiên" ở lần lặp tiếp theo.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Draft model | "The cheap one" | A smaller model that proposes candidate tokens; usually 10–50× cheaper than the verifier. |
| Verifier | "The big one" | The target model whose distribution we preserve; runs once per speculative step. |
| Acceptance rate ($\alpha$) | "How often the draft is right" | Per-token probability that the verifier accepts the draft. 0.7–0.9 typical. |
| Residual distribution | "The rejection fallback" | `(q - p)_+` normalized; sampling from this on rejection preserves the verifier's distribution. |
| Bonus token | "The free one" | When all N drafts accepted, sample one more from the verifier's next-step distribution. |
| Medusa | "Draft-less speculative" | Multiple LM heads on the verifier predict positions t+1..t+k in parallel. |
| EAGLE | "Hidden-state draft" | Tiny transformer draft conditioned on the verifier's last-layer hidden states. |
| Lookahead decoding | "Jacobi iteration" | Self-speculation using a fixed-point iteration; no draft model. |
| Tree attention | "Verify many candidates at once" | Branching verification that considers several draft continuations simultaneously. |
| KV rollback | "Undo rejected drafts" | Scratch KV buffer; commit on acceptance, discard on reject. |

## Đọc thêm

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) thuật toán cốt lõi và định lý tương đương.
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) giới thiệu đồng thời; minh chứng từ chối Bernoulli sạch.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) Bức giấy Medusa; kiểm tra sự chú ý của cây.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) EAGLE-1; dự thảo có điều kiện ẩn trong nhà nước.
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) Eagle-2; độ sâu động của cây.
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840) Eagle-3.
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057) Nhìn thẳng vào phía trước, không có kế hoạch tiếp cận.
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) tham chiếu sản xuất theo quy định của luật pháp với tất cả bốn chiến lược được kết nối.
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) mã tham chiếu cho EAGLE-1/2/3.
