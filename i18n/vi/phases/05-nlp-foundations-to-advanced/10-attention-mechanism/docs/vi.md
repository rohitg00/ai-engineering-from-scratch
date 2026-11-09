# Cơ chế chú ý  Sự đột phá

> Bộ giải mã ngừng nhìn vào một bản tóm tắt nén và bắt đầu nhìn vào toàn bộ nguồn.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 09 (Sequence-to-Sequence Models)
**Time:** ~45 minutes

## Vấn đề

Bài học 09 kết thúc với một sự thất bại đo lường. Một bộ mã hóa-bẻ khóa GRU được đào tạo trên một nhiệm vụ sao chép đồ chơi đi từ độ chính xác 89% ở độ dài 5 đến gần như xác suất ở độ dài 80. Lý do là cấu trúc, không phải là lỗi đào tạo: mỗi bit thông tin mà bộ mã hóa thu thập phải phù hợp với một trạng thái ẩn kích thước cố định, và bộ mã hóa không bao giờ thấy bất cứ điều gì khác.

Bahdanau, Cho và Bengio đã công bố một sửa chữa ba dòng vào năm 2014. Thay vì chỉ cho máy giải mã trạng thái giải mã cuối cùng, hãy giữ cho từng máy giải mã trạng thái.`i`"Đây là thời điểm của chúng ta".

Đó là ý tưởng. Transformers mở rộng nó. Sự chú ý tự tính áp dụng nó cho một chuỗi đơn lẻ. Sự chú ý đa đầu chạy nó song song. Nhưng phiên bản 2014 đã phá vỡ nút thắt, và một khi bạn có nó, tâm điểm của các transformer là kỹ thuật, không phải khái niệm.

## Khái niệm

![Bahdanau attention: decoder queries all encoder states](../assets/attention.svg)

Ở mỗi bước giải mã `t`- Có thể là:

1. Sử dụng trạng thái ẩn của máy giải mã trước đó `s_{t-1}`như một **query**- Tôi không biết.
2. Đánh giá nó so với mọi trạng thái ẩn của mã hóa`h_1, ..., h_T`Một scalar cho mỗi vị trí mã hóa.
3. Tối đa điểm để có được trọng lượng chú ý `α_{t,1}, ..., α_{t,T}`số đó là 1.
4. Vêctơ ngữ cảnh `c_t = Σ α_{t,i} * h_i`- Tỷ lệ trung bình trọng lượng của các trạng thái mã hóa.
5. Decoder lấy `c_t`cộng với token đầu ra trước, tạo ra token tiếp theo.

Đường trung bình trọng lượng là điểm. Khi máy giải mã cần dịch "Je" thành "I", nó cân nặng trạng thái mã hóa trên "Je" cao và các loại khác thấp. Khi nó cần "không", nó cân nặng "pas" cao.

## Các hình dạng (làm gì đó cắn tất cả mọi người)

Đây là nơi mọi sự thực hiện sự chú ý đều sai lần đầu tiên.

| Thing | Shape | Notes |
|-------|-------|-------|
| Encoder hidden states `H` | `(T_enc, d_h)` | If BiLSTM, `d_h = 2 * d_hidden` |
| Decoder hidden state `s_{t-1}` | `(d_s,)` | One vector |
| Attention score `e_{t,i}` | scalar | One per encoder position |
| Attention weight `α_{t,i}` | scalar | After softmax over all `i` |
| Context vector `c_t` | `(d_h,)` | Same shape as an encoder state |

**Bahdanau (additive) score.** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`- Tôi không biết.

- `s_{t-1}`có hình dạng`(d_s,)`- `h_i`có hình dạng`(d_h,)`- Tôi không biết.
- `W_a`có hình dạng`(d_attn, d_s)`- `U_a`có hình dạng`(d_attn, d_h)`- Tôi không biết.
- Số lượng của chúng bên trong tanh có hình dạng`(d_attn,)`- Tôi không biết.
- `v_α`có hình dạng`(d_attn,)`. sản phẩm bên trong với `v_α`- Nó sụp đổ thành một con đường.**This is what `v_α` does.**Nó không phải là phép thuật, mà là sự chiếu biến một vector ánh sáng ánh sáng thành một điểm số scalar.

**Luong (multiplicative) score.**Ba biến thể:

- `dot``e_{t,i} = s_t^T * h_i`- Cần`d_s == d_h`- Cấm nếu mã hóa của bạn là hai chiều.
- `general``e_{t,i} = s_t^T * W * h_i`với `W`hình dạng`(d_s, d_h)`- Giảm giới hạn độ mờ bằng nhau.
- `concat`: chủ yếu là hình thức Bahdanau. hiếm khi được sử dụng vì hai hình thức đầu tiên rẻ hơn.

**One Bahdanau / Luong gotcha worth naming.**Bahdanau sử dụng `s_{t-1}`(các trạng thái decoder * trước khi * tạo ra từ hiện tại). Luong sử dụng `s_t`(the state *after*). khi trộn chúng lại tạo ra gradient sai lầm rất khó để gỡ lỗi. chọn một giấy và bám vào quy tắc của nó.

```figure
attention-heatmap
```

## Hãy xây dựng nó

### Bước 1: sự chú ý phụ gia (Bahdanau)

```python
import numpy as np


def additive_attention(decoder_state, encoder_states, W_a, U_a, v_a):
    projected_dec = W_a @ decoder_state
    projected_enc = encoder_states @ U_a.T
    combined = np.tanh(projected_enc + projected_dec)
    scores = combined @ v_a
    weights = softmax(scores)
    context = weights @ encoder_states
    return context, weights


def softmax(x):
    x = x - np.max(x)
    e = np.exp(x)
    return e / e.sum()
```

Hãy kiểm tra hình dạng của bạn với bảng trên. `encoder_states`có hình dạng`(T_enc, d_h)`- `projected_enc`có hình dạng`(T_enc, d_attn)`- `projected_dec`có hình dạng`(d_attn,)`và phát sóng. `combined`có hình dạng`(T_enc, d_attn)`- `scores`có hình dạng`(T_enc,)`- `weights`có hình dạng`(T_enc,)`- `context`có hình dạng`(d_h,)`- Đưa đi.

### Bước 2: Luong dot và chung

```python
def dot_attention(decoder_state, encoder_states):
    scores = encoder_states @ decoder_state
    weights = softmax(scores)
    return weights @ encoder_states, weights


def general_attention(decoder_state, encoder_states, W):
    projected = W.T @ decoder_state
    scores = encoder_states @ projected
    weights = softmax(scores)
    return weights @ encoder_states, weights
```

3 dòng mỗi, đó là lý do tại sao tờ giấy của Luong xuất hiện, chính xác như hầu hết các nhiệm vụ, ít mã hơn nhiều.

### Bước 3: ví dụ số được làm việc

Với ba trạng thái mã hóa (khoảng "cat", "sat", "mat") và trạng thái mã hóa phù hợp nhất với thứ nhất, sự phân phối sự chú ý tập trung vào vị trí 0. Nếu trạng thái mã hóa thay đổi để phù hợp với thứ cuối cùng, sự chú ý chuyển sang vị trí 2.

```python
H = np.array([
    [1.0, 0.0, 0.2],
    [0.5, 0.5, 0.1],
    [0.1, 0.9, 0.3],
])

s_close_to_cat = np.array([0.9, 0.1, 0.2])
ctx, w = dot_attention(s_close_to_cat, H)
print("weights:", w.round(3))
```

```
weights: [0.464 0.305 0.231]
```

Lần đầu tiên thắng. sau đó di chuyển trạng thái decoder gần hơn đến trạng thái encoder thứ ba và xem trọng lượng chuyển đổi. Đó là nó.

### Bước 4: tại sao đây là cây cầu dẫn đến các bộ biến đổi

Dịch ngôn ngữ trên thành Q/K/V:

- **Query**= trạng thái decoder `s_{t-1}`
- **Key**= các trạng thái mã hóa (tại điểm gì chúng ta đánh giá)
- **Value**= các trạng thái mã hóa (tổng số và trọng lượng)

Trong sự chú ý cổ điển, chìa khóa và giá trị là cùng một thứ. Sự chú ý tự phân biệt chúng: bạn có thể truy vấn một chuỗi chống lại chính nó, với các dự đoán học được khác nhau cho K và V. Sự chú ý đa đầu chạy nó song song với các dự đoán học được khác nhau. Các bộ biến chuyển xếp chồng toàn bộ giai đoạn nhiều lần và thả RNN.

Các toán học giống nhau, hình dạng giống nhau, sự nhảy vọt giáo dục từ sự chú ý Bahdanau đến sự chú ý sản phẩm điểm quy mô chủ yếu là ghi chú.

## Sử dụng nó

PyTorch và TensorFlow sẽ đưa sự chú ý trực tiếp.

```python
import torch
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=128, num_heads=8, batch_first=True)
query = torch.randn(2, 5, 128)
key = torch.randn(2, 10, 128)
value = torch.randn(2, 10, 128)

output, weights = mha(query, key, value)
print(output.shape, weights.shape)
```

```
torch.Size([2, 5, 128]) torch.Size([2, 5, 10])
```

Đó là một lớp chú ý biến đổi. Nhóm truy vấn 5 vị trí, khóa/định giá 10 vị trí, mỗi vị trí có 128 chiều, 8 đầu.`output`là các truy vấn mới tăng cường ngữ cảnh. `weights`là các 5x10 trục trọng mà bạn có thể hình dung.

### Khi sự chú ý cổ điển vẫn quan trọng

- Lập trình đơn, đơn lớp, dựa trên RNN làm cho mọi khái niệm trở nên rõ ràng.
- Các nhiệm vụ theo trình trên thiết bị khi các bộ biến không phù hợp.
- Bất kỳ bài báo nào từ năm 2014 đến 2017 bạn sẽ đọc sai nó mà không biết sự kiện của Bahdanau.
- Phân tích sắp xếp tinh tế trong MT. Năng lượng chú ý thô là một công cụ giải thích ngay cả trên các mô hình biến thể, và đọc chúng đòi hỏi phải biết chúng là gì.

### Cái bẫy chú ý trọng lượng như giải thích

Các trọng lượng chú ý trông có thể diễn giải được. Chúng là trọng lượng tổng hợp với một người qua các vị trí; bạn có thể vẽ chúng; cao có nghĩa là "để nhìn vào điều này".

Chúng không thể diễn giải được như chúng trông thấy. Jain và Wallace (2019) cho thấy rằng phân phối sự chú ý có thể được thay đổi và thay thế bằng các thay thế tùy ý mà không thay đổi dự đoán mô hình cho một số nhiệm vụ.

## Chuyển nó

Cứ như `outputs/prompt-attention-shapes.md`- Có thể là:

```markdown
---
name: attention-shapes
description: Debug shape bugs in attention implementations.
phase: 5
lesson: 10
---

Given a broken attention implementation, you identify the shape mismatch. Output:

1. Which matrix has the wrong shape. Name the tensor.
2. What its shape should be, derived from (d_s, d_h, d_attn, T_enc, T_dec, batch_size).
3. One-line fix. Transpose, reshape, or project.
4. A test to catch regressions. Typically: assert `output.shape == (batch, T_dec, d_h)` and `weights.shape == (batch, T_dec, T_enc)` and `weights.sum(dim=-1) close to 1`.

Refuse to recommend fixes that silently broadcast. Broadcast-hiding bugs surface later as silent accuracy degradation, the worst kind of attention bug.

For Bahdanau confusion, insist the decoder input is `s_{t-1}` (pre-step state). For Luong, `s_t` (post-step state). For dot-product, flag dimension mismatch between query and key as the most common first-time error.
```

## Các bài tập

1. **Easy.**Thực hiện`softmax`che giấu để mã hóa mã thông báo trong mã hóa nhận được trọng lượng chú ý bằng không.
2. **Medium.**Thêm nhiều đầu chú ý đến Luong `general`hình dạng. chia.`d_h`vào`n_heads`nhóm, chạy sự chú ý mỗi đầu, kết nối.
3. **Hard.**Trén một bộ mã hóa-chế lập GRU với sự chú ý Bahdanau vào nhiệm vụ sao chép đồ chơi từ bài học 09. Độ chính xác của bản vẽ so với chiều dài chuỗi. So sánh với đường cơ sở không chú ý. Bạn nên thấy khoảng cách mở rộng khi chiều dài tăng lên, xác nhận sự chú ý nâng nút thắt.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Attention | Looking at things | Weighted average of a value sequence, weights computed from a query-key similarity. |
| Query, Key, Value | QKV | Three projections: Q asks, K is what to match, V is what to return. |
| Additive attention | Bahdanau | Feed-forward score: `v^T tanh(W q + U k)`. |
| Multiplicative attention | Luong dot / general | Score is `q^T k` or `q^T W k`. Cheaper, same accuracy on most tasks. |
| Alignment matrix | The pretty picture | Attention weights as a `(T_dec, T_enc)` grid. Read it to see what the model attended to. |

## Đọc thêm

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)- Báo.
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) ba biến thể điểm số và so sánh của chúng.
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) cảnh báo về khả năng giải thích.
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) chạy qua với PyTorch.
