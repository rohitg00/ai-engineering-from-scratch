# Việc giải mã giả định và Eagle

> Một LLM biên giới tạo ra một token đòi hỏi một quá trình tiến hành đầy đủ trên hàng tỷ tham số. Việc đi trước đó là quá cung cấp: hầu hết thời gian một mô hình nhỏ hơn có thể đoán đúng 3-5 token tiếp theo, và mô hình lớn chỉ cần xác minh đoán. Khi đoán đúng, bạn có 5 token với giá 1 token. Việc giải mã giả định (Leviathan et al. 2023) đã làm điều này chính xác, và EAGLE-3 (2025) đẩy tỷ lệ chấp nhận lên ~ 4,5 token mỗi xác minh  tăng tốc độ 4-5x tại phân phối đầu ra phù hợp.

**Type:** Build
**Languages:** Python (with numpy)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## Vấn đề

Tính năng giải mã cho mô hình lớp 70B trên H100 thường là 40-80 token/thấp. Mỗi token yêu cầu một thẻ chuyển tiếp đầy đủ đọc tất cả trọng lượng mô hình từ HBM. Bạn không thể làm cho mô hình nhỏ hơn mà không thay đổi đầu ra của nó. Bạn không thể tăng kích thước lô vượt quá bộ nhớ. Bạn bị mắc kẹt  trừ khi bạn có thể để cho mô hình phát ra nhiều hơn một token mỗi thẻ chuyển tiếp.

Thế hệ tự động suy giảm trông giống như một loạt:`x_{t+1} = sample(p(· | x_{1:t}))`Nhưng có một cơ hội đồng thời. Nếu bạn có một dự đoán rẻ tiền nói "các mã thông báo tiếp theo 4 có thể là [a, b, c, d]" bạn có thể xác minh tất cả 5 vị trí trong một **single forward pass of the big model**và chấp nhận dấu tiền trùng hợp dài nhất.

Leviathan, Kalai, Matias (2023, "Sự suy đoán nhanh từ Transformers thông qua giải mã suy đoán") đã thực hiện điều này thông qua một quy tắc chấp nhận / từ chối thông minh bảo tồn phân phối mẫu của mô hình mục tiêu.

## Khái niệm

### Thiết lập hai mô hình

- **Target model** `M_p`: mô hình lớn, chậm, chất lượng cao bạn thực sự muốn mẫu từ.`p(x)`- Tôi không biết.
- **Draft model** `M_q`: một mô hình nhỏ, nhanh, chất lượng thấp hơn.`q(x)`5-30x nhỏ hơn.

Mỗi bước:

1. Dự thảo mô hình đề xuất `K`token theo cách tự động: `x_1, x_2, ..., x_K ~ q`- Tôi không biết.
2. Mô hình mục tiêu chạy 1 bước đi trước trên tất cả `K+1`các vị trí song song, tạo ra `p(x_k)`cho mỗi token được đề xuất.
3. Tận dụng/Từ chối mỗi token từ trái sang phải thông qua quy tắc lấy mẫu từ chối được sửa đổi dưới đây.
4. Nếu bất kỳ token nào bị từ chối, lấy mẫu thay thế từ phân phối đã sửa và dừng. Nếu không lấy mẫu một token thưởng từ `p(· | x_1...x_K)`- Tôi không biết.

Nếu dự thảo phù hợp hoàn hảo với mục tiêu, bạn sẽ nhận được K + 1 token cho mỗi mục tiêu đi trước. Nếu dự thảo sai ở vị trí 1, bạn chỉ nhận được 1 token.

### Quy tắc chính xác

Việc giải mã giả định là **provably equivalent in distribution to sampling from p**Quy tắc từ chối:

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

nơi `(p - q)+`chỉ ra phần tích cực của sự khác biệt về điểm.`p ≈ q`) chấp nhận gần 1. Khi họ không đồng ý, phân phối dư được xây dựng để tổng mẫu vẫn chính xác `p`- Tôi không biết.

**Greedy case.**Để lấy mẫu nhiệt độ=0 chỉ cần kiểm tra `argmax(p) == x_t`Nếu có, hãy chấp nhận; nếu không, hãy ra`argmax(p)`và dừng lại.

### Tăng tốc dự kiến

Nếu tỷ lệ chấp nhận cấp token của mô hình dự thảo là `α`, các token dự kiến được sản xuất cho mỗi mục tiêu chuyển tiếp là:

```math
\mathbb{E}[\text{tokens}] = \frac{1 - \alpha^{K+1}}{1 - \alpha} \qquad K = \text{draft length}, \ \alpha \in [0, 1]
```

Tại `α = 0.8, K = 4``(1 - 0.8^5)/(1 - 0.8) = 3.36`Các token trên mỗi forward.`cost_q * K + cost_p`(K dự thảo bước cộng với một mục tiêu xác minh). Nếu `cost_p >> cost_q * K`tỷ lệ tăng tốc là `3.36× / 1 = 3.36×`về thông qua.

Các tham số thực duy nhất là`α`Một bản thảo tốt là tất cả.

### Việc đào tạo dự án: Chất cất

Một mô hình nhỏ ngẫu nhiên tạo ra một bản thảo kém.

1. Chọn một kiến trúc nhỏ (~ 1B cho mục tiêu 70B, ~ 500M cho mục tiêu 7B).
2. Lên mô hình mục tiêu trên một tập tin văn bản lớn; lưu trữ phân phối mã thông báo tiếp theo của nó.
3. Trình bày bản thảo với sự khác biệt KL đối với phân phối mục tiêu (không phải đối với các token thực tại cơ bản).

Kết quả là:`α`Thông thường là 0,6-0,8 trong coding, 0,7-0,85 trong chat ngôn ngữ tự nhiên.

### Eagle: Cây vẽ + tính năng tái sử dụng

Li, Wei, Zhang, Zhang (2024, "EGLE: Speculative Sampling Requires Rethinking Feature Uncertainty") đã quan sát hai thiếu hiệu quả trong việc giải mã tính toán tiêu chuẩn:

1. Dự thảo thực hiện các bước hàng loạt K, mỗi đống đầy đủ. Nhưng dự thảo có thể tái sử dụng các tính năng của mục tiêu (thị trạng ẩn) từ các xác minh gần đây nhất  mục tiêu đã tính toán đại diện giàu có rằng dự thảo được bắt nguồn từ đầu.
2. Dự thảo sẽ đưa ra một chuỗi tuyến tính. Nếu dự thảo có thể đưa ra một * cây * của các ứng cử viên (mỗi nút nhiều đoán), một lần đi về phía trước của mục tiêu có thể xác minh nhiều con đường ứng cử viên song song qua một mặt nạ chú ý cây, và chọn nhánh được chấp nhận dài nhất.

Thay đổi của EAGLE-1:
- Draft input = trạng thái ẩn cuối cùng của mục tiêu ở vị trí t, không phải token nguyên liệu.
- Thiết kế kiến trúc = 1 lớp decoder biến thể (không phải mô hình nhỏ riêng biệt).
- Tạo ra = cây K = 4-8 ứng cử viên cho độ sâu, độ sâu 4-6.

EAGLE-2 (2024) thêm topology cây động: cây phát triển rộng hơn nơi có dự án không chắc chắn và duy trì hẹp khi nó tự tin.`α_effective`không tăng chi phí xác minh.

Eagle-3 (Li et al. 2025, "EAGLE-3: Scaling Up Inference Acceleration of Large Language Models via Training-Time Test") loại bỏ sự phụ thuộc tính năng lớp trên cố định và đào tạo bản thảo với một lỗ hổng "simulans thời gian thử nghiệm" mới. Tỷ lệ chấp nhận tăng từ 0,75 (EAGLE-2) lên 0,82 (EAGLE-3), và trung bình token / xác minh từ 3,0 lên 4,5. Những con số này đến từ một thiết lập tham chiếu. Việc chấp nhận phụ thuộc vào cặp mô hình, cây dự thảo và lưu lượng truy cập: Giai đoạn 10 · 15 trích dẫn 0,88 đến 0,92 cho mỗi token đường được chấp nhận trên các tiêu chuẩn trò chuyện, và Giai đoạn 17 · 05 kế hoạch với 0,6 đến 0,8 trên trò chuyện chung sản xuất.

### Kiểm tra sự chú ý của cây

Khi bản thảo xuất ra một cây, mô hình mục tiêu xác minh nó bằng một lần đi trước sử dụng một **tree attention mask** một mặt nạ nguyên nhân mã hóa topology cây thay vì một đường thẳng thuần túy. Mỗi token chỉ phục vụ tổ tiên của nó trong cây. Pass xác minh vẫn là một phía trước, một matmul; mặt nạ topological chỉ tốn một vài mục KV thêm.

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

Nếu`a, b`đang cạnh tranh với các ứng cử viên đầu tiên và `c, d, e, f`là ứng cử viên mã thông báo thứ hai, tất cả sáu vị trí được xác minh bằng một lần đi trước.

### Khi nó thắng, khi nó không thắng

**Wins:**
- Chat / hoàn thành với văn bản có thể dự đoán được (định luật, tiếng Anh chung, đầu ra có cấu trúc). `α`cao.
- Cài đặt với tính toán GPU không được sử dụng trong thời gian giải mã (phase bị ràng buộc trong bộ nhớ).

**Loses / no win:**
- Kết quả cao stochastic (tác phẩm sáng tạo ở nhiệt độ cao). `α`giảm xuống hướng tới `1/|vocab|`- Tôi không biết.
- Các lô phục vụ với sự đồng thời rất cao  lô đã lấp đầy các FLOP, không có nhiều chỗ cho xác minh cây.
- Những mô hình mục tiêu rất nhỏ mà dự án không nhỏ hơn nhiều.

Các cửa hàng sản xuất thường báo cáo tăng tốc độ 2-3x trên trò chuyện, 3-5x trên việc tạo ra mã và gần bằng không trên viết sáng tạo.

```figure
speculative-decoding
```

## Hãy xây dựng nó

`code/main.py`- Có thể là:

- Một tài liệu tham chiếu`speculative_decode(target, draft, prompt, K, temperature)`thực hiện quy tắc từ chối chính xác và xác minh rằng nó bảo vệ phân phối mục tiêu (khiệt nghiệm KL < 0,01 so với lấy mẫu mục tiêu đơn giản).
- Một cây kiểu Eagle mà xây dựng một cây sâu K với các nhánh trên cùng.
- Một nhà xây dựng mặt nạ chú ý cây tạo ra mô hình nguyên nhân phù hợp cho một người xác minh.
- Một vòng dây có tốc độ chấp nhận chạy cả hai trên một LM nhỏ (tắt một GPT-2- nhỏ từ một mục tiêu trung bình GPT-2-).

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """One round of speculative decoding. Returns list of accepted tokens."""
    # 1. Draft K tokens
    draft_tokens = []
    q_dists = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_dists.append(probs)
        state = draft_step(state, t)

    # 2. Target computes p at every drafted position + 1 extra
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. Accept/reject left-to-right
    accepted = []
    for k, tok in enumerate(draft_tokens):
        r = np.random.uniform()
        if r < p_probs_all[k][tok] / q_dists[k][tok]:
            accepted.append(tok)
        else:
            residual = np.maximum(p_probs_all[k] - q_dists[k], 0)
            residual /= residual.sum()
            accepted.append(np.random.choice(len(residual), p=residual))
            return accepted
    # 4. All K accepted → sample bonus token from target
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## Sử dụng nó

- **vLLM**và **SGLang**tàu lớp đầu tiên giải mã đầu cơ.`--speculative-config`một đối tượng JSON với `method`- `model`, và`num_speculative_tokens`; EAGLE-3 là `"method": "eagle3"`- Tôi không biết.
- **NVIDIA TensorRT-LLM**hỗ trợ cây Medusa và Eagle bản địa.
- **Reference draft models**`Qwen/Qwen3-0.6B`(Các dự thảo về Qwen3-32B),`meta-llama/Llama-3.2-1B-Instruct`(Các dự thảo về Llama 3.x 70B).
- **Medusa heads**(Cai et al. 2024, "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"): thay vì mô hình dự thảo, thêm các đầu dự đoán song song K vào mục tiêu.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-speculative-tuning.md` một kỹ năng mô tả khối lượng công việc của mô hình mục tiêu và chọn: mô hình dự thảo, K (giãn dài dự thảo), chiều rộng cây, nhiệt độ và khi nào để rơi lại để giải mã đơn giản.

## Các bài tập

1. Thực hiện quy tắc từ chối chính xác và xác minh bằng chứng.`speculative_decode`và thông qua lấy mẫu mục tiêu đơn giản; tính khoảng cách TV giữa hai phân phối đầu ra.

2. Xét công thức tăng tốc.`α`và `K`, biểu đồ các token dự kiến cho mỗi mục tiêu tiến. Tìm tối ưu $K$cho $\alpha \in \lbrace 0.5, 0.7, 0.9 \rbrace$- Tôi không biết.

3. Đưa một con đường nhỏ, lấy một mục tiêu GPT-2 124M và chưng cất một con đường GPT-2 30M trên 100M token với lỗ KL.`α`- Đường dự kiến: 0,6-0,7.

4. Thực hiện việc vẽ cây theo kiểu EAGLE. Thay vì chuỗi, hãy tạo ra các nhánh đầu ra trên 3 cành ở mỗi độ sâu. Xây dựng mặt nạ chú ý cây. Kiểm tra mục tiêu chấp nhận cành chính xác dài nhất.

5. Đo chế độ thất bại. chạy giải mã suy đoán ở nhiệt độ=1.5 (sự stochasticity cao). cho thấy α sụp đổ và thuật toán chậm hơn giải mã đơn giản do chi phí trên.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Target model | "The big model" | The slow, high-quality model you want samples from (p distribution) |
| Draft model | "The speculator" | The small, fast predictor (q distribution); 5-30x smaller |
| K / draft length | "Look-ahead" | Number of speculated tokens per verify pass |
| α / acceptance rate | "Hit rate" | Per-token probability that the draft's proposal is accepted |
| Exact rejection rule | "The accept test" | r < p/q compare that preserves target's distribution |
| Residual distribution | "Corrected p-q" | (p - q)+ / ||(p - q)+||_1, the distribution to sample from on rejection |
| Tree drafting | "Branching speculation" | Draft outputs a tree of candidates, verified in one pass with tree-structured attention mask |
| Tree attention mask | "Topological mask" | Causal mask encoding the tree topology so each node attends only to its ancestors |
| Medusa heads | "Parallel heads" | K extra prediction heads on the target itself; no separate draft model |
| EAGLE feature reuse | "Hidden-state draft" | Draft input is target's last hidden state, not raw tokens, shrinking the draft |
| Test-time simulation loss | "EAGLE-3 training" | Train draft on outputs matching target's test-time distribution, not teacher forcing |

## Đọc thêm

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) quy tắc từ chối chính xác và phân tích tăng tốc lý thuyết
- [Chen, Borgeaud, Irving et al., 2023 — "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318) giấy lấy mẫu đầu cơ đồng thời tại DeepMind
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774) Các đầu song song thay thế cho mô hình dự thảo
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077) tái sử dụng tính năng và vẽ cây
- [Li et al., 2024 — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858) Topology cây động
- [Li et al., 2025 — "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840) Thời gian tàu-đào giờ thử nghiệm
- [Fu, Haotian, Peng et al., 2024 — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057) Đánh mã Jacobi/lookahead, một lựa chọn thay thế không có nhà đầu cơ
