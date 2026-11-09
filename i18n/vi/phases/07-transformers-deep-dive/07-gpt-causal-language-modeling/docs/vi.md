# GPT  Mô hình hóa ngôn ngữ nguyên nhân

> BERT nhìn cả hai bên. GPT chỉ nhìn thấy quá khứ. Mặt nạ tam giác là dòng mã đơn nhất trong AI hiện đại.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT)
**Time:** ~75 minutes

## Vấn đề

Một mô hình ngôn ngữ trả lời một câu hỏi: cho phép đầu tiên `t-1`token, phân phối xác suất trên token là gì `t`Đào tạo vào tín hiệu đó  dự đoán mã thông báo tiếp theo  và bạn có được một mô hình có thể tạo ra văn bản tùy ý một mã thông báo một lần.

Để đào tạo nó từ đầu đến cuối trên một chuỗi toàn bộ song song, bạn cần dự đoán của mỗi vị trí chỉ phụ thuộc vào vị trí trước đó. Nếu không mô hình lừa dối tầm thường bằng cách nhìn vào câu trả lời.

Mặt nạ nguyên nhân làm điều này. Đó là một matrix ba giác trên đơn`-inf`các giá trị được thêm vào điểm chú ý trước softmax. Sau softmax, các vị trí đó trở thành 0. Mỗi vị trí chỉ có thể tham gia vào chính nó và các vị trí trước đó. Và bởi vì bạn áp dụng nó một lần cho toàn bộ chuỗi, bạn nhận được N tương đồng dự đoán token tiếp theo trong một chuyển tiếp về phía trước.

GPT-1 (2018), GPT-2 (2019), GPT-3 (2020), GPT-4 (2023), GPT-5 (2025), Claude, Llama, Qwen, Mistral, DeepSeek, Kimi  tất cả đều là các bộ chuyển đổi nguyên nhân chỉ có mã hóa với cùng một vòng lặp cốt lõi. Điều phân biệt chúng là chất lượng dữ liệu, quy mô và tinh tế kiến trúc, và sau đào tạo (SFT, RLHF, DPO và những người kế nhiệm của chúng).

## Khái niệm

![Causal mask creates a triangular attention matrix](../assets/causal-attention.svg)

### Mặt nạ

Với một chuỗi dài $N$, xây dựng một $N \times N$Matrix:

```math
M_{ij} = \begin{cases} 0 & \text{if } j \le i \\ -\infty & \text{if } j > i \end{cases}
```

Thêm `M`cho điểm chú ý nguyên chất trước softmax. $\exp(-\infty) = 0$, vì vậy các vị trí che giấu đóng góp trọng lượng không. mỗi hàng của ma trận chú ý là phân phối xác suất trên các vị trí trước đó chỉ.

Chi phí thực hiện: 1 `torch.tril()`Tiếng gọi, thời gian tính toán: nanoseconds, tác động trên trường: mọi thứ.

### Từ đâu được hình tam giác

Mặt nạ thường được trình bày như một vá được gắn vào sự chú ý. Tiến dẫn theo hướng khác và nó không còn bí ẩn: sự chú ý là sự tinh tế thứ ba của một trung bình tiền tố, và tam giác là ranh giới vòng lặp của trung bình đó, được viết như một matrix.

**Stage 1 — prefix average.**Kết luận nguyên nhân ngu ngốc nhất của một chuỗi: vị trí$i$trở thành trung bình của các vị trí $0 \ldots i$Như một vòng lặp, đó là`out[i] = X[:i+1].mean(0)`- cùng một tính toán là một số tử liệu nhân. lấy một số tử liệu ba góc dưới của một, chia mỗi hàng bằng số lượng của nó, nhân:

```python
import numpy as np

A = np.tril(np.ones((n, n)))
A = A / A.sum(axis=1, keepdims=True)
out = A @ X
```

Đường $i$của $A$là $[1/(i+1), \ldots, 1/(i+1), 0, \ldots, 0]$Những con số 0 trên đường viền là nguyên nhân. Không có gì về tương lai được che giấu; tương lai không bao giờ là tổng.

**Stage 2 — learned weights.**Một trung bình đồng nhất xử lý mọi token trước đây như là tương đương. Thay thế những người với một số điểm học được .`S`. Bây giờ các hàng không còn cộng với một bằng cách xây dựng, vì vậy bình thường hóa mỗi hàng bằng Softmax thay vì chia bằng số. Softmax không bao giờ đưa ra một số không chính xác, điều này phá vỡ tính nhân quả  trừ khi điểm số trong tương lai đi vào như `-inf`, bởi vì`exp(-inf) = 0`- Có thể là:

```python
def softmax(x, axis):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

S = S + np.triu(np.full((n, n), -np.inf), k=1)
A = softmax(S, axis=1)
out = A @ X
```

cùng một tam giác, cùng một matrix hàng-stochastic, cùng một matmul.`-inf`mask không phải là một máy móc mới. Nó là các mục 0 giai đoạn 1, được dịch thành lĩnh vực đầu vào của softmax.

**Stage 3 — content-dependent weights.**Trong giai đoạn 2, `S`được cố định sau khi tập luyện: vị trí 7 luôn cân nặng vị trí 3 giống nhau, bất kể các token nói. Hãy để điểm số phụ thuộc vào các token chính: `S = Q @ K.T / sqrt(d_k)`Không có gì khác thay đổi.

Ba giai đoạn, một không biến đổi: một chuỗi hàng-stochastic ba góc thấp gấp đôi chuỗi. trung bình thống nhất, học được trọng lượng tĩnh, trọng lượng phụ thuộc vào nội dung.

```figure
mask-derivation
```

### Việc đào tạo song song, suy luận hàng loạt

Việc đào tạo: chuyển tiếp toàn bộ`(N, d_model)`Dòng một lần, tính toán N mất tích entropy chéo (một trong mỗi vị trí), tổng, backprop. song song dọc theo chuỗi. Đây là lý do tại sao các quy mô đào tạo GPT  bạn xử lý 1M token trong một lô trong một GPU vượt qua.

Thuyết định: bạn tạo ra token theo token.`[t1, t2, t3]`, đi`t4`- Thức ăn`[t1, t2, t3, t4]`, đi`t5`- Thức ăn`[t1, t2, t3, t4, t5]`, đi`t6`KV cache (Dạy 12) lưu các trạng thái ẩn của `t1…tn`Vì vậy bạn không tính lại chúng mỗi bước. nhưng độ sâu hàng loạt tại suy luận = bước đầu ra. Đó là thuế tự rút và tại sao việc giải mã là nút nút kẹt độ của mỗi LLM.

### Lối mất  chuyển đổi từng người

Đồ tín hiệu được đưa ra `[t1, t2, t3, t4]`- Có thể là:

- Nhập: `[t1, t2, t3]`
- Mục tiêu: `[t2, t3, t4]`

Đối với mọi vị trí `i`, tính toán`-log P(target_i | inputs[:i+1])`Đây là sự chuyển động của toàn bộ chuỗi.

Mỗi bộ biến đổi LM mà bạn đã nghe nói về tàu trên mất mát này.

### Chiến lược giải mã

Sau khi đào tạo, lựa chọn lấy mẫu quan trọng hơn mọi người nghĩ.

| Method | What it does | When to use |
|--------|--------------|-------------|
| Greedy | Argmax every step | Deterministic tasks, code completion |
| Temperature | Divide logits by T, sample | Creative tasks, higher T = more diversity |
| Top-k | Sample from top-k tokens only | Kills low-probability tails |
| Top-p (nucleus) | Sample from smallest set with cumulative prob ≥ p | 2020+ default; adapts to distribution shape |
| Min-p | Keep tokens with `p > min_p * max_p` | 2024+; better at rejecting long tails than top-p |
| Speculative decoding | Draft model proposes N tokens, big model verifies | 2–3× latency reduction at same quality |

Năm 2026, nhiệt độ min-p + 0,7 là một mặc định hợp lý cho các mô hình trọng lượng mở.

### Điều gì khiến "giết chế GPT" hoạt động

1. **Decoder-only.**Không có bộ mã hóa trên đầu. Một lần lưu ý + FFN cho mỗi lớp.
2. **Scaling.**124M → 1.5B → 175B → nghìn tỷ. Luật quy mô Chinchilla (Dạy học 13) cho bạn biết cách chi tiêu tính toán.
3. **In-context learning.**Tạo ra khoảng 6B13B. Mô hình có thể theo dõi một vài ví dụ chụp mà không cần điều chỉnh tinh tế.
4. **RLHF.**Sau khi đào tạo về sở thích của con người chuyển đổi văn bản nguyên liệu được đào tạo trước thành trợ lý trò chuyện.
5. **Pre-norm + RoPE + SwiGLU.**Đào tạo ổn định ở quy mô.

Kiến trúc cốt lõi không thay đổi nhiều kể từ GPT-2. Mọi thứ thú vị đã xảy ra trong dữ liệu, quy mô và sau đào tạo.

```figure
causal-mask
```

## Hãy xây dựng nó

### Bước 1: mặt nạ nguyên nhân

Nhìn xem`code/main.py`Một dòng:

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

Thêm vào điểm chú ý trước khi Softmax.

### Bước 2: mô hình GPT 2 lớp

Lắp lên hai khối decoder (đánh giá tự chú ý + FFN, không có sự chú ý chéo). Thêm một mã hóa token, mã hóa vị trí và unembedding (được gắn với mã hóa token  một thủ thuật tiêu chuẩn kể từ GPT-2).

### Bước 3: dự đoán mã thông báo tiếp theo, kết thúc đến kết thúc

Trên một từ ngữ đồ chơi 20 token, tạo logits ở mọi vị trí. tính toán mất tích entropy chéo so với mục tiêu chuyển đổi theo một. Không gradient  đây là kiểm tra trí tuệ vượt qua về phía trước.

### Bước 4: lấy mẫu

Thực hiện tham lam, nhiệt độ, top-k, top-p, min-p. chạy mỗi trên một prompt cố định và so sánh đầu ra.

## Sử dụng nó

PyTorch, 2026 ngôn ngữ:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")
tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")

prompt = "Attention is all you need because"
inputs = tok(prompt, return_tensors="pt")
out = model.generate(
    **inputs,
    max_new_tokens=64,
    temperature=0.7,
    top_p=0.9,
    do_sample=True,
)
print(tok.decode(out[0]))
```

Dưới cái nắp,`generate()`chạy chuyển tiếp về phía trước, kéo các logit vị trí cuối cùng, lấy mẫu mã thông báo tiếp theo, thêm nó và lặp lại. Mỗi đống suy luận LLM sản xuất (vLLM, TensorRT-LLM, llama.cpp, Ollama, MLX) thực hiện cùng một vòng lặp với tối ưu hóa nặng  prefill batch, batching liên tục, KV cache paging, giải mã suy đoán.

**GPT vs BERT, one line each:**GPT dự đoán $P(x_t \mid x_{<t})$BERT dự đoán$P(x_{\text{masked}} \mid x_{\text{unmasked}})$. Khối thối quyết định liệu mô hình có thể tạo ra.

## Chuyển nó

Nhìn xem`outputs/skill-sampling-tuner.md`. Kỹ năng chọn các tham số lấy mẫu cho một nhiệm vụ thế hệ mới và đánh dấu khi cần thiết giải mã xác định.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`và xác minh các hình tử liệu chú ý nguyên nhân là ba góc dưới sau softmax.
2. **Medium.**Thực hiện tìm kiếm chùm để có chiều rộng 4. So sánh sự bối rối của chùm-4 so với tham lam trên 10 lời nhắc ngắn.
3. **Hard.**Thực hiện giải mã phỏng đoán: sử dụng mô hình 2 tầng nhỏ như bản thảo và mô hình 6 tầng như xác minh. đo tốc độ đồng hồ tường trên 100 hoàn thành chiều dài 64.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Causal mask | "The triangle" | Upper-triangular `-inf` matrix added to attention scores so position `i` only sees positions `≤ i`. |
| Next-token prediction | "The loss" | Cross-entropy of the model's distribution against the true next token at every position. |
| Autoregressive | "Generate one at a time" | Feed output back as input; parallelism only during training, not during generation. |
| Logits | "Pre-softmax scores" | Raw output of the LM head before softmax; sampling happens on these. |
| Temperature | "Creativity knob" | Divide logits by $T$; $T \to 0$ = greedy, $T \to \infty$ = uniform. |
| Top-p | "Nucleus sampling" | Truncate distribution to smallest set summing to $\ge p$; sample from what remains. |
| Min-p | "Better than top-p" | Keep tokens where `p ≥ min_p × max_p`; adapts cutoff to sharpness of distribution. |
| Speculative decoding | "Draft + verify" | Cheap model proposes N tokens; big model verifies in parallel. |
| Teacher forcing | "Training trick" | During training, feed the true previous token, not the model's prediction. Standard for every seq2seq LM. |

## Đọc thêm

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) GPT-1.
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) GPT-2.
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) GPT-3 và học tập trong bối cảnh.
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) giấy giải mã kỹ thuật.
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) mã tham chiếu nguyên nhân-LM.
