# Việc giải mã giả định và EAGLE-3

> Giai đoạn 7 · Bài học 16 chứng minh toán học: quy tắc từ chối Leviathan bảo tồn phân phối xác minh chính xác. Bài học này là quan điểm tập hợp đào tạo về việc giải mã đầu cơ sản xuất năm 2026. EAGLE-3 biến mô hình dự thảo từ một ước tính rẻ thành một mạng lưới nhỏ được xây dựng riêng được đào tạo trên các trạng thái ẩn của người xác minh, sau đó thêm một vòng kiểm tra thời gian đào tạo phù hợp với phân phối tàu và suy luận của nó. Kết quả: tăng tốc từ 3x đến 6.5x, chấp nhận tỷ lệ trên 0,9 trên mỗi token trên chat, không có sự thỏa hiệp phân phối. Mỗi đống suy luận sản xuất vào năm 2026 đều gửi theo mặc định.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 7 · 16 (speculative decoding math), Phase 10 · 12 (inference optimization)
**Time:** ~75 minutes

## Mục tiêu học tập

- Giới thiệu định lý Leviathan trong một câu và chứng minh rằng vòng đầu cơ tạo ra các mẫu được phân phối giống nhau cho người xác minh.
- Đi theo tiến trình hai năm từ việc giải mã đặc điểm vani (Leviathan 2023) qua EAGLE, EAGLE-2, và EAGLE-3 và đặt tên giới hạn chính xác từng bước được loại bỏ.
- Lập toán tốc độ dự kiến từ tỷ lệ chấp nhận `α`và tỷ lệ chi phí dự thảo đối với kiểm tra viên `c`, và chọn chiều dài dự thảo tối ưu `N`cho mỗi chế độ.
- Thực hiện vòng lặp đầu cơ hoàn toàn từ đầu: thảo, xác minh, từ chối-chví mẫu từ phần còn lại, xoay bộ nhớ cache KV trở lại khi từ chối, phát hành token tiền thưởng khi chấp nhận đầy đủ.

## Vấn đề

Tính toán tự động xuống cấp trên mô hình 70B chạy với khoảng 35 token mỗi giây trên H100. GPU không gần như bão hòa. Độ băng thông bộ nhớ là trần: mỗi token tải 70B trọng từ HBM, thực hiện một bước toán học, và tạo ra một float. Các đơn vị tính toán ngồi hầu hết vô hiệu.

Việc giải mã dự đoán biến điều đó thành một vấn đề thông suất mà bạn có thể giải quyết.`N`token trong `N`Các thẻ đi trước nhỏ.`N`Nếu phân phối của người xác minh tại vị trí `i`(trong một nghĩa thống kê chúng ta sẽ làm chính xác), chúng ta chấp nhận; nếu không, chúng ta từ chối và lấy mẫu một sự điều chỉnh từ phân phối dư.`N+1`nhận token thay vì một.

Lý thuyết quan trọng là Leviathan, Kalman, Matias (ICML 2023): phân phối đầu ra giống như việc lấy mẫu từ người xác minh trực tiếp sẽ tạo ra. Không gần như.

Những gì giai đoạn 7 · Bài học 16 đã cung cấp cho bạn là toán học. Những gì bài học này cung cấp cho bạn là tập luyện. Một bản thảo tốt có giá trị tăng tốc gấp 2 lần so với một bản thảo rẻ. EAGLE, EAGLE-2, và EAGLE-3 (Li et al., 20242025) đã biến "đề án = phiên bản nhỏ hơn của cùng một mô hình" thành một ngành kỹ thuật chính xác.

## Khái niệm

### Các không biến đổi: lấy mẫu từ chối Leviathan

Để `p(t)`là phân phối bản thảo cho biểu tượng tiếp theo với một số tiền đề, và `q(t)`Hãy lấy mẫu một bản mã hóa.`d ~ p`Hãy chấp nhận với khả năng`min(1, q(d) / p(d))`Khi bị từ chối, mẫu từ phân phối dư thừa `(q - p)_+ / ||(q - p)_+||_1`Các mẫu được phân phối theo quy định của quy định:`q`Điều này đúng bất kể xấu xí đến mức nào.`p`là  càng tệ, bạn càng từ chối, nhưng kết quả vẫn chính xác.

Đọc `N`của các cuộc gọi này trở lại trở lại sử dụng một xác minh chuyển tiếp chuyển tiếp `prefix + d_1 + ... + d_N`. Người xác minh trả lại `q_1, q_2, ..., q_{N+1}`cùng lúc. Đi từ trái sang phải.`j`, mẫu từ `residual(q_j, p_j)`Khi chấp nhận hoàn toàn, lấy một token tiền thưởng từ`q_{N+1}`- Tôi không biết.

### Điều gì quyết định tốc độ

Để `α`là tỷ lệ chấp nhận dự kiến cho mỗi token được dự thảo.`c = cost(draft) / cost(verifier)`Số lượng token được chấp nhận được dự kiến cho mỗi người xác minh trước là:

```math
\mathbb{E}[\text{accepted}] = \frac{1 - \alpha^{N+1}}{1 - \alpha}
```

Thời gian tường dự kiến tổng cộng cho mỗi token được chấp nhận là `(N * c + 1) / E[accepted]`Giảm thiểu điều đó với sự quan tâm của `N`và anh sẽ có điểm thích hợp.`α = 0.8, c = 0.05`: tối ưu `N`là khoảng 57, tốc độ là 3.2x.`α = 0.95, c = 0.02`: tối ưu `N`là khoảng 8x10, tăng tốc đẩy 5x.

Lòng đòn bẩy lớn nhất là`α`- Từ `α = 0.6`(tạo bản vanilla) đến `α = 0.9`(Eagle-3) ở số cố định `N = 5`đưa bạn từ 2.2 dự kiến được chấp nhận token cho mỗi xác minh tiếp tục đến 4.1. gần 2x thông qua nhiều hơn từ cùng một xác minh.

### Sự tiến triển hai năm

**Vanilla speculative (Leviathan, 2023).**Mô hình dự thảo là một LLM nhỏ hơn được đào tạo độc lập từ cùng một gia đình.`α ≈ 0.6`, tăng tốc khoảng 2x tối đa.

**EAGLE-1 (Li et al., 2024).**Draft là một bộ biến đổi nhỏ  thường là một hoặc hai lớp  lấy trạng thái ẩn lớp cuối cùng của người xác minh như là đầu vào và dự đoán mã thông báo tiếp theo trực tiếp. Bởi vì bản thảo nhìn thấy đại diện tính năng của người xác minh, phân phối của nó gần hơn nhiều với người xác minh. `α`tăng lên 0,70,8.

**EAGLE-2 (Li et al., 2024).**Thêm một cây dự thảo động: thay vì đề xuất một chuỗi đơn của `N`các token, đề xuất một cây nhỏ của ứng cử viên, ghi điểm mỗi người với xác minh trong một lần đi trước (tránh tâm cây), và đi theo con đường có khả năng cao nhất.`α`mỗi token đường được chấp nhận tăng lên trên 0,85.

**EAGLE-3 (Li et al., 2025, NeurIPS).**Hai thay đổi nữa. Đầu tiên, loại bỏ mất tính năng dự đoán hoàn toàn  EAGLE-1/2 đào tạo bản thảo để phù hợp với các trạng thái ẩn của người xác minh, điều này giới hạn bao nhiêu dữ liệu giúp. Eagle-3 được đào tạo trực tiếp theo dự báo token. Thứ hai, kiểm tra thời gian đào tạo (TTT): trong quá trình đào tạo dự thảo, cung cấp lại dự đoán trước của dự thảo như đầu vào qua nhiều bước, giống như cách nó hoạt động khi suy luận. Điều này sắp xếp phân phối tàu và thử nghiệm và ngăn chặn sự tích lũy lỗi. Tốc độ đo lường: lên đến 6,5x trên chat, cải thiện thông qua 38% tại lô 64 trong SGLang trên H100.

### KV cache rollback

Truyển chứng mở rộng cache KV của người xác minh bằng `N`Nếu từ chối xảy ra ở vị trí `j`, cache chứa vị trí trước `j-1`Hai thực hiện phổ biến: viết cho một bộ đệm cào và cam kết khi chấp nhận (vLLM, TensorRT-LLM), hoặc giữ một bộ nhớ cache KV vật lý cộng với một chiều dài hợp lý và cắt giảm trên từ chối.

Để tìm kiếm cây EAGLE-2, người xác minh chạy sự chú ý bằng một mặt nạ không gây nguyên nhân tôn trọng topology cây.

### Dự thảo kiến trúc vào năm 2026

| Strategy | Draft type | `α` | Speedup | Training cost |
|----------|-----------|-----|---------|---------------|
| Vanilla | Separate small LLM | 0.55-0.70 | 1.8-2.3× | None (reuse existing small model) |
| Medusa | Extra LM heads on verifier | 0.65-0.75 | 2-3× | ~1B SFT tokens |
| EAGLE-1 | 1-layer transformer on hidden states | 0.70-0.80 | 2.5-3× | ~60B tokens |
| EAGLE-2 | EAGLE-1 + dynamic draft tree | 0.80-0.88 | 3-4× | ~60B tokens |
| EAGLE-3 | Multi-layer feature fusion + TTT | 0.88-0.92 | 3.5-6.5× | ~60-200B tokens |
| Lookahead | No draft (Jacobi iteration) | N/A | 1.3-1.6× | None |

- `α`Cột là tỷ lệ chấp nhận mỗi token dọc theo con đường được chấp nhận, trên các tiêu chuẩn trò chuyện, với một bản thảo được đào tạo dựa trên dữ liệu trò chuyện phù hợp. Đó là băng thông trên. Giai đoạn 10 · 25 trích dẫn 0,82 cho EAGLE-3 từ một thiết lập khác, và Giai đoạn 17 · 05 lên kế hoạch triển khai sản xuất với 0,6 đến 0,8 trên trò chuyện chung.`α`trên giao thông của riêng bạn trước khi bạn chọn `N`- Tôi không biết.

Trong sản xuất năm 2026, vLLM và SGLang mặc định là EAGLE-3 khi có sẵn, EAGLE-2 nếu không. TensorRT-LLM có con đường Medusa nhanh nhất cho các mô hình công cộng Meta và NVIDIA. llama.cpp cung cấp vanilla draft cho việc triển khai CPU.

```figure
l5-spec-decode-eagle
```

## Hãy xây dựng nó

Nhìn xem`code/main.py`Đây là vòng đầu cơ Leviathan đầy đủ với tất cả các phần: draft-of-N, xác minh vượt qua song song, từ chối mỗi vị trí, lấy mẫu dư thừa, token tiền thưởng, KV rollback, và xác minh bằng chứng rằng phân phối đầu ra phù hợp với lấy mẫu trực tiếp từ `q`- Tôi không biết.

### Bước 1: quy tắc từ chối

```python
def accept(q_prob, p_prob, u):
    if p_prob <= 0:
        return True
    return u < min(1.0, q_prob / p_prob)
```

### Bước 2: phân phối dư

```python
def residual(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    if s == 0:
        return list(q)
    return [r / s for r in raw]
```

### Bước 3: một bước đầu cơ đầy đủ

- `spec_step`Dự thảo chức năng `N`token từ `p`, sau đó xác minh tất cả chúng trong một song song`q`đánh giá. Đối với mỗi token được soạn thảo, nó áp dụng quy tắc từ chối, và trên lần từ chối đầu tiên nó lấy mẫu sửa đổi từ phần còn lại. Nếu mọi thứ chấp nhận, nó phát hành một token thưởng từ `q_{N+1}`- Tôi không biết.

### Bước 4: Cụ thể hóa kế toán KV

Máy mô phỏng theo dõi một logic`kv_length`Khi chấp nhận`k`Dự thảo,`kv_length += k`. Về việc từ chối vị trí `j`, bộ nhớ cache đã được viết quá khứ `j`, nhưng chiều dài hợp lý được thiết lập đến `prefix_length + j + 1` một vượt qua mã hiệu sửa chữa.

### Bước 5: kiểm tra Leviathan

Thực hiện 50.000 bước đầu cơ. Đếm phân phối kinh nghiệm của các token được chấp nhận. So sánh với 50.000 mẫu trực tiếp từ `q`Các số liệu chi-quadrat nên là dưới giá trị quan trọng.

### Bước 6: tăng tốc so với α

Thử chất lượng dự thảo bằng cách làm rối loạn `p`xa khỏi `q`ở độ lớn khác nhau.`α`, sau đó lập biểu đồ các token dự kiến cho mỗi cuộc gọi xác minh như một hàm của `α`và `N`Mã in một bảng cho thấy cách chất lượng dự thảo lớp EAGLE-3 (`α ≈ 0.9`) mở khóa 45 token mỗi cuộc gọi xác minh.

## Sử dụng nó

Mức sản xuất `vllm serve`với EAGLE-3:

```bash
vllm serve meta-llama/Llama-3.3-70B-Instruct \
  --speculative-config '{
    "model": "yuhuili/EAGLE3-LLaMA3.3-Instruct-70B",
    "num_speculative_tokens": 5,
    "method": "eagle3"
  }'
```

SGLang với EAGLE-3 tại lô 64 trên H100: khoảng 1,38x dung lượng hơn so với lô 64 decoding vanilla, theo giấy EAGLE-3.

Khi nào để tìm kiếm giải mã giả định:

- Bất kỳ tải trọng làm việc trò chuyện tương tác nào mà độ trễ p50 quan trọng hơn là thông qua đỉnh.
- Tạo mã và đầu ra cấu trúc (JSON, SQL). `α`là trên 0,9 vì phân phối mục tiêu là rất dự đoán.
- Tạo ra hình thức dài (người dùng hàng ngàn token) và tăng tốc được giảm giá vẫn tiếp tục trả tiền.

Khi nào không nên:

- Mô hình rất nhỏ (< 3B).
- Các bộ nhớ nhỏ của mô hình dự thảo có thể không đáng giá.
- Tiêu chuẩn tạo mẫu nhiệt độ rất cao ở nơi `α`sụp đổ.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-eagle3-tuner.md`. Với khối lượng công việc suy luận (tiêu mẫu, kích thước lô, độ trễ mục tiêu, hồ sơ nhiệm vụ), nó khuyên bạn nên một chiến lược giải mã phỏng đoán và các tham số điều chỉnh (phát thảo, `N`, độ sâu cây, chuyển đổi nhiệt độ).

## Các bài tập

1. Đi chạy`code/main.py`- Đảm nhận số liệu chi-quad trên kiểm tra phân phối Leviathan ở dưới 95% giá trị quan trọng trên 50.000 mẫu.

2. Tháo `N`từ 1 đến 10 với `α`được giữ ở mức 0,9 và `c`được giữ tại 0.04. Bước biểu tượng dự kiến cho mỗi cuộc gọi xác minh và thời gian tường thực tế cho mỗi token. Tìm `N`Giúp cho tôi biết hình dạng của đường cong.

3. Thay đổi mã để mô phỏng tìm kiếm cây EAGLE-2: tại mỗi bước, bản thảo đề xuất một cây hình `[2, 2, 2]`(tám con đường ứng cử viên). Người xác minh chạy một lần, và con đường được chấp nhận có khả năng cao nhất thắng.`α`mỗi lá và tổng số token mỗi cuộc gọi xác minh. So sánh với mã hóa kỹ thuật chuỗi tuyến tính với tính toán tương đương.

4. Thực hiện mô phỏng quay lại KV đợt cho hai chuỗi đồng thời.`kv_length`được cập nhật theo trình tự và không có công việc nào bị lãng phí.

5. Đọc phần 4 (Thử nghiệm thời gian đào tạo) của bài báo EAGLE-3. Giải thích bằng hai câu tại sao việc đào tạo sơ đồ ngây thơ mà không có TTT bị thiên vị tiếp xúc, và tại sao việc cung cấp dự đoán của bản thân cho bản thảo trong quá trình đào tạo sẽ khắc phục nó. Kết nối điều này với các tài liệu lấy mẫu theo lịch trình trong seq2seq.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Leviathan rule | "min(1, q over p)" | Bernoulli accept/reject with probability `min(1, q(d)/p(d))`, preserves the verifier distribution exactly when you sample from the residual on rejection |
| Residual distribution | "(q minus p) plus, normalized" | `(q - p)_+` clamped at zero and renormalized — the correct distribution to sample from on rejection |
| Acceptance rate α | "how often the draft is right" | Expected per-token Bernoulli-success probability under the rejection rule; governs all speedup math |
| EAGLE-1 | "hidden-state draft" | Tiny transformer draft conditioned on the verifier's last-layer hidden state (Li et al., 2024) |
| EAGLE-2 | "dynamic draft tree" | EAGLE-1 plus a tree of candidate continuations scored with tree attention in one verifier pass |
| EAGLE-3 | "training-time test" | Drops the feature-prediction loss, trains on direct token prediction with the draft fed its own outputs during training |
| Training-time test (TTT) | "exposure bias fix" | Run the draft autoregressively during training so train and test input distributions match — the direct analog of scheduled sampling |
| KV rollback | "undo rejected drafts" | Bookkeeping that resets the verifier's KV cache to the accepted-prefix length after a rejection |
| Bonus token | "the free one" | When all `N` drafts accept, sample one extra from `q_{N+1}` at no additional verifier cost |
| Tree attention | "verify many candidates at once" | Attention with a non-causal mask that respects the topology of a draft tree; computes `q_i` for every node in the tree in one forward pass |

## Đọc thêm

- [Leviathan, Kalman, Matias — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192, ICML 2023)](https://arxiv.org/abs/2211.17192) bài báo cơ bản và định lý tương đương
- [Chen et al. — Accelerating Large Language Model Decoding with Speculative Sampling (arXiv:2302.01318)](https://arxiv.org/abs/2302.01318) Đưa ra độc lập cùng lúc với bằng chứng sạch
- [Li et al. — EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) EAGLE-1, dự thảo có điều kiện quốc gia ẩn
- [Li et al. — EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) tìm kiếm cây động
- [Li et al. — EAGLE-3: Scaling up Inference Acceleration via Training-Time Test (arXiv:2503.01840, NeurIPS 2025)](https://arxiv.org/abs/2503.01840) sản xuất thất bại năm 2026
- [Cai et al. — Medusa: Multiple Decoding Heads (arXiv:2401.10774)](https://arxiv.org/abs/2401.10774) Phương pháp thay thế không có dự thảo
- [vLLM Speculative Decoding documentation](https://docs.vllm.ai/en/latest/features/spec_decode.html) tham chiếu sản xuất theo quy định với tất cả các chiến lược được kết nối
