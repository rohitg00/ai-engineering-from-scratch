# Thường độ ổn định số

> Điểm nổi là một sự trừu tượng bị rò rỉ. Nó sẽ cắn bạn trong khi tập luyện, và bạn sẽ không thấy nó đến.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~120 minutes

## Mục tiêu học tập

- Thực hiện softmax ổn định về số và log-sum-exp bằng cách sử dụng thủ thuật trừ tối đa
- Xác định quá tải, quá tải thấp và hủy bỏ thảm họa trong các tính toán điểm nổi
- Kiểm tra gradient phân tích so với gradient số bằng cách sử dụng sự khác biệt hữu hạn trung tâm
- Giải thích tại sao bfloat16 được ưu tiên so với float16 để đào tạo và cách quy mô lỗ ngăn ngừa dòng chảy thấp gradient

## Vấn đề

Các mô hình của bạn được đào tạo trong ba giờ, sau đó mất mát trở thành NaN. Bạn thêm một tuyên bố in. các logit là tốt ở bước 9.000. ở bước 9.001 họ là`inf`Theo bước 9.002 mỗi độ nghiêng là`nan`và huấn luyện đã chết.

Hoặc: mô hình của bạn đi đến hoàn thành nhưng độ chính xác là 2% tệ hơn các tuyên bố trên giấy. Bạn kiểm tra mọi thứ. Kiến trúc phù hợp. Hiperparameter phù hợp. Dữ liệu phù hợp. Vấn đề là giấy sử dụng float32 và bạn sử dụng float16 mà không có quy mô đúng. 32 bit tích lũy sai lầm tròn lặng lẽ ăn sự chính xác của bạn.

Hoặc: bạn thực hiện mất tích entropy chéo từ đầu. Nó hoạt động trên logits nhỏ. Khi logits vượt quá 100, nó trở lại`inf`- Tối cao mềm chảy quá vì`exp(100)`là lớn hơn float32 có thể đại diện. mỗi framework ML xử lý điều này với một trò chơi hai dòng.

Sự ổn định số không phải là một mối quan tâm lý thuyết. Nó là sự khác biệt giữa một cuộc tập luyện thành công và một cuộc tập luyện thất bại lặng lẽ.

## Khái niệm

### IEEE 754: Cách máy tính lưu trữ số thực

Máy tính lưu trữ số thực như các giá trị điểm nổi theo tiêu chuẩn IEEE 754. Một float có ba phần: một bit dấu hiệu, một biểu tượng và một mantissa (sự quan trọng).

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

Mantissa xác định độ chính xác (càng số đáng kể).

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

float32 cho bạn khoảng 7 chữ số thập phân độ chính xác. Điều đó có nghĩa là nó có thể phân biệt 1.0000001 và 1.0000002, nhưng không phải 1.00000001 và 1.00000002. Sau 7 chữ số, mọi thứ đều là tiếng ồn tròn.

float16 cho bạn khoảng 3 chữ số. Số lớn nhất nó có thể đại diện là 65,504. Đó là đáng lo ngại nhỏ cho ML nơi logits, gradient và kích hoạt thường vượt quá điều này.

bfloat16 là câu trả lời của Google cho vấn đề phạm vi của float16. Nó có cùng một biểu tượng 8 bit như float32 (những phạm vi tương tự, lên đến 3.4e38) nhưng chỉ có 7 bit mantissa (sự chính xác ít hơn float16).

### Tại sao 0.1 + 0.2 ! = 0.3

Số 0.1 không thể được đại diện chính xác trong điểm nổi nhị phân.

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

Float32 cắt giảm thành 23 bit mantissa. Giá trị lưu trữ là khoảng 0,100000001490116.

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

Điều này quan trọng đối với ML vì:

1. So sánh thua lỗ như `if loss < threshold`có thể đưa ra những câu trả lời sai
2. Tiết kiệm nhiều giá trị nhỏ (sự cập nhật theo từng bước hàng ngàn) dẫn đến sự biến mất từ tổng thực
3. Các kiểm tra tổng và các xét nghiệm khả năng tái tạo thất bại nếu bạn so sánh các máy bay nổi với `==`

Điều khắc phục: đừng bao giờ so sánh các chiếc nổi với `==`- Sử dụng`abs(a - b) < epsilon`hoặc `math.isclose()`- Tôi không biết.

### Sự hủy bỏ thảm khốc

Khi bạn trừ hai số điểm nổi gần như bằng nhau, các con số quan trọng bị hủy bỏ và bạn còn lại với tiếng ồn tròn được nâng lên các con số hàng đầu.

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

Đó là một lỗi tương đối 19% từ một lần trừ.

- Xét sự khác biệt của dữ liệu với trung bình lớn: $\mathbb{E}[x^2] - \mathbb{E}[x]^2$Khi nào $\mathbb{E}[x]$là lớn
- Giảm gần như tương đương log-chỉ có thể
- Xét các gradient khác biệt hữu hạn với epsilon quá nhỏ

Giải pháp: sắp xếp lại công thức để tránh trừ số lớn, gần như bằng nhau. Để biến đổi, sử dụng thuật toán Welford hoặc trung tâm dữ liệu trước. Đối với xác suất log, làm việc trong log-space trong suốt.

### Tăng và giảm

Overflow xảy ra khi một kết quả quá lớn để đại diện. Underflow xảy ra khi nó quá nhỏ (càng gần bằng không so với số tích cực đại diện nhỏ nhất).

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

- `exp()`hàm là nguồn đầu tiên của quá tải trong ML:

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

- `log()`hàm chạm vào hướng khác:

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

Trong ML, `exp()`xuất hiện trong các tính toán softmax, sigmoid và xác suất. `log()`xuất hiện trong sự tương ứng chéo, khả năng log-chỉ và sự khác biệt KL.`log(exp(x))`là một bãi mìn mà không có những thủ thuật đúng đắn.

### Tránh ghi lại số tiền

Máy tính `log(sum(exp(x_i)))`trực tiếp là nguy hiểm về mặt số.`x_i`là lớn,`exp(x_i)`Nếu tất cả mọi thứ`x_i`rất tiêu cực, mỗi `exp(x_i)`dòng chảy dưới đến 0 và `log(0)`là `-inf`- Tôi không biết.

Trù: trừ giá trị tối đa trước khi tăng số.

```math
\log\left(\sum_i \exp(x_i)\right) = \max(x) + \log\left(\sum_i \exp(x_i - \max(x))\right)
```

Tại sao điều này hoạt động: sau khi trừ `max(x)`, số nhân lớn nhất là `exp(0) = 1`Không có quá tải là có thể. ít nhất một thuật ngữ trong tổng là 1, vì vậy tổng là ít nhất là 1, và`log(1) = 0`Không có dòng chảy xuống `-inf`có thể.

Bằng chứng:

```math
\begin{aligned}
& \log\left(\sum_i \exp(x_i)\right) \\
&= \log\left(\sum_i \exp(x_i - c + c)\right) && \text{(add and subtract } c\text{)} \\
&= \log\left(\sum_i \exp(x_i - c) \cdot \exp(c)\right) && (\exp(a+b) = \exp(a) \cdot \exp(b)) \\
&= \log\left(\exp(c) \cdot \sum_i \exp(x_i - c)\right) && \text{(factor out } \exp(c)\text{)} \\
&= c + \log\left(\sum_i \exp(x_i - c)\right) && (\log(a \cdot b) = \log(a) + \log(b))
\end{aligned}
```

Đặt `c = max(x)`và sự tràn qua được loại bỏ.

Trù này xuất hiện khắp nơi trong ML:
- Tự bình thường hóa Softmax
- Xét tính mất tích liên quan đến entropy
- Tổng hợp xác suất ghi chép trong các mô hình chuỗi
- Trộn hợp Gaussians
- Kết luận biến thể

### Tại sao Softmax cần thủ thuật trừu tượng Max

Softmax chuyển đổi logits thành xác suất:

```math
\mathop{\mathrm{softmax}}(x_i) = \frac{\exp(x_i)}{\sum_j \exp(x_j)}
```

Nếu không có thủ thuật, logit của [100, 101, 102] gây ra tràn:

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

2.69e43 > 3.4e38, the float32 maximum, so every term overflows.
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

Với thủ thuật, trừ tối đa x = 102:

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

Những xác suất giống nhau, tính toán là an toàn, đây không phải là một tối ưu hóa, đó là yêu cầu cho sự chính xác.

### NaN và Inf: Khám phá và phòng ngừa

`nan`(Không phải là một con số) và `inf`(không tận) lây lan virus thông qua tính toán.`nan`trong một cập nhật gradient làm cho trọng lượng `nan`, tạo ra mọi sản phẩm tiếp theo `nan`Trình luyện chỉ trong vòng một bước thôi.

Làm sao ?`inf`xuất hiện:
- `exp()`với số tích cực lớn
- Chia bằng không: `1.0 / 0.0`
- `float32`tràn vào các tích lũy

Làm sao ?`nan`xuất hiện:
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- `sqrt()`của một số âm
- `log()`của một số âm
- Bất kỳ toán học liên quan đến một hiện tại `nan`

Khám phá:

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

Chiến lược phòng ngừa:

1. Các đầu vào clamp đến `exp()``exp(clamp(x, -80, 80))`
2. Thêm epsilon vào các tên gọi: `x / (y + 1e-8)`
3. Thêm epsilon bên trong `log()``log(x + 1e-8)`
4. Sử dụng các thực hiện ổn định (log-sum-exp, softmax ổn định)
5. Cắt độ để ngăn chặn vụ nổ trọng lượng
6. Kiểm tra xem `nan`- Không.`inf`sau mỗi lần đi trước trong thời gian debugging

### Kiểm tra số lượng

Các gradient phân tích (từ backpropagation) có thể có lỗi. kiểm tra gradient số xác minh chúng bằng cách tính toán gradient với sự khác biệt hữu hạn.

Công thức khác biệt trung tâm:

```math
\frac{df}{dx} \approx \frac{f(x + h) - f(x - h)}{2h}
```

Đây là$O(h^2)$chính xác, tốt hơn nhiều so với sự khác biệt về phía trước $(f(x+h) - f(x)) / h$mà chỉ là $O(h)$- Tôi không biết.

Chọn$h$: quá lớn và sự gần gũi là sai lầm.`h = 1e-5`đến`1e-7`là điển hình.

Kiểm tra: tính toán sự khác biệt tương đối giữa các gradient phân tích và số.

```math
\text{relative\_error} = \frac{\lvert \text{grad}_{\text{analytical}} - \text{grad}_{\text{numerical}} \rvert}{\max(\lvert \text{grad}_{\text{analytical}} \rvert, \lvert \text{grad}_{\text{numerical}} \rvert, 10^{-8})}
```

Quy tắc của ngón tay:
- relative_error < 1e-7: hoàn hảo, gradient là chính xác
- relative_error < 1e-5: chấp nhận được, có thể chính xác
- relative_error > 1e-3: có gì đó không ổn
- relative_error > 1: gradient hoàn toàn sai

Luôn kiểm tra gradient khi thực hiện một lớp mới hoặc hàm mất. PyTorch cung cấp `torch.autograd.gradcheck()`vì chuyện này.

### Việc đào tạo chính xác hỗn hợp

Các GPU hiện đại có phần cứng chuyên dụng (Tensor Cores) tính toán các nhân số matrix float16 nhanh hơn 2-8 lần so với float32.

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

Vấn đề với việc đào tạo float16 tinh khiết: gradient thường rất nhỏ (1e-8 hoặc nhỏ hơn). Float16 chảy dưới bất cứ thứ gì dưới ~ 6e-8 đến không. Mô hình của bạn ngừng học bởi vì tất cả các cập nhật gradient là không.

Việc khắc phục là giảm quy mô:

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

Scaling mất động điều chỉnh yếu tố quy mô tự động. bắt đầu với một giá trị lớn (65536). Nếu gradient tràn đến `inf`- Nếu...$N$Đi qua các bậc thang mà không quá tải, gấp đôi.

### Bfloat16 vs. Float16: Tại sao bfloat16 thắng trong tập luyện

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

float16 có độ chính xác hơn (10 mantissa bits vs 7) nhưng phạm vi hạn chế (tối đa là ~65,504). bfloat16 có độ chính xác ít hơn nhưng phạm vi tương tự như float32 (tối đa là ~3.4e38).

Đối với đào tạo mạng thần kinh:

- Các hoạt động và logit thường xuyên vượt quá 65.504 trong các đợt tập luyện.
- Lượng đo lỗ được yêu cầu với float16 nhưng thường không cần thiết với bfloat16 vì phạm vi của nó bao gồm quang phổ độ độ lớn gradient.
- bfloat16 là một truncation đơn giản của float32: thả 16 bit dưới cùng của mantissa.

float16 được ưa thích cho việc suy luận khi các giá trị bị giới hạn và độ chính xác quan trọng hơn. bfloat16 được ưa thích cho đào tạo khi phạm vi quan trọng hơn.

### Tắt dần

Các gradient nổ xảy ra khi gradient tăng theo tốc độ theo nhiều lớp (thường xảy ra trong RNN, mạng sâu và chuyển đổi).

Hai loại cắt:

**Clip by value:**Cẹp từng phần tử gradient một cách độc lập.

```
grad = clamp(grad, -max_val, max_val)
```

Rất đơn giản nhưng có thể thay đổi hướng của vector gradient.

**Clip by norm:**Lượng độ của các phương tiện gradient là:

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

Giữ hướng của gradient.`torch.nn.utils.clip_grad_norm_()`Đó là lựa chọn tiêu chuẩn.

Giá trị điển hình: `max_norm=1.0`cho các bộ biến đổi, `max_norm=0.5`cho RL, `max_norm=5.0`cho các mạng đơn giản hơn.

Việc cắt độ không phải là một sự phá vỡ, mà là một cơ chế an toàn.

### Các lớp bình thường hóa như là các bộ ổn định số

Tiêu chuẩn hóa lô, bình thường hóa lớp và bình thường hóa RMS thường được trình bày như các chất điều chỉnh giúp đào tạo hội tụ.

Nếu không có bình thường hóa, kích hoạt có thể tăng lên hoặc thu hẹp theo cấp số theo các lớp:

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

Tiêu chuẩn hóa các recenters và tái kích hoạt ở mỗi lớp:

```math
\mathop{\mathrm{LayerNorm}}(x) = \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x) + \epsilon} \cdot \gamma + \beta
```

- `epsilon`(thường là 1e-5) ngăn chặn chia bằng không khi tất cả các hoạt động đều giống nhau.`gamma`và `beta`để mạng phục hồi bất kỳ quy mô nào nó cần.

Điều này giữ các giá trị trong phạm vi an toàn về mặt số trong toàn bộ mạng, ngăn chặn cả quá tải trong đường đi về phía trước và sự bùng nổ gradient trong đường đi ngược.

### Các lỗi số ML phổ biến

**Bug: Loss is NaN after a few epochs.**
Nguyên nhân: logits tăng quá lớn, softmax tràn hoặc tốc độ học tập quá cao và trọng lượng khác nhau.
Lắp đặt: sử dụng softmax ổn định (từ trừ tối đa), giảm tốc độ học tập, thêm cắt gradient.

**Bug: Loss is stuck at log(num_classes).**
Nguyên nhân: các kết quả của mô hình là xác suất gần giống nhau.
Lắp đặt: kiểm tra rằng nhãn dữ liệu là chính xác, xác minh hàm mất mát, kiểm tra cho chết ReLUs.

**Bug: Validation accuracy is lower than expected by 1-3%.**
Nguyên nhân: độ chính xác hỗn hợp mà không có quy mô mất tích thích hợp.
Lắp đặt: bật quy mô mất mát động, hoặc chuyển sang bfloat16.

**Bug: Gradient norms are 0.0 for some layers.**
Nguyên nhân: các tế bào thần kinh ReLU chết (tất cả đầu vào âm), hoặc float16 dưới dòng chảy.
Lấy LeakyReLU hoặc GELU, sử dụng quy mô gradient, kiểm tra kích hoạt trọng lượng.

**Bug: Model works on one GPU but gives different results on another.**
Nguyên nhân: thứ tự tích lũy điểm nổi không xác định. Giảm song song GPU tổng hợp trong các thứ tự khác nhau trên phần cứng khác nhau, và việc bổ sung điểm nổi không liên quan.
Xác định: chấp nhận những khác biệt nhỏ (1e-6), hoặc đặt `torch.use_deterministic_algorithms(True)`và chấp nhận hình phạt tốc độ.

**Bug: `exp()` returns `inf` in loss computation.**
Nguyên nhân: logit thô được chuyển đến `exp()`Không có thủ thuật trừ tối đa.
Phong sửa: sử dụng `torch.nn.functional.log_softmax()`thực hiện log-sum-exp bên trong.

**Bug: Training diverges after switching from float32 to float16.**
Nguyên nhân: float16 không thể đại diện cho độ lớn gradient dưới 6e-8 hoặc kích hoạt trên 65.504.
Lắp đặt: sử dụng độ chính xác hỗn hợp với quy mô mất mát (AMP), hoặc sử dụng bfloat16 thay vào đó.

```figure
logsumexp-stability
```

## Hãy xây dựng nó

### Bước 1: Cố gắng giới hạn độ chính xác điểm nổi

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### Bước 2: Thực hiện ngây thơ vs ổn định softmax

```python
import math

def softmax_naive(logits):
    exps = [math.exp(z) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def softmax_stable(logits):
    max_logit = max(logits)
    exps = [math.exp(z - max_logit) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

safe_logits = [2.0, 1.0, 0.1]
print(f"Naive:  {softmax_naive(safe_logits)}")
print(f"Stable: {softmax_stable(safe_logits)}")

dangerous_logits = [100.0, 101.0, 102.0]
print(f"Stable: {softmax_stable(dangerous_logits)}")
# softmax_naive(dangerous_logits) would return [nan, nan, nan]
```

### Bước 3: Thực hiện log-sum-exp ổn định

```python
def logsumexp_naive(values):
    return math.log(sum(math.exp(v) for v in values))

def logsumexp_stable(values):
    c = max(values)
    return c + math.log(sum(math.exp(v - c) for v in values))

safe = [1.0, 2.0, 3.0]
print(f"Naive:  {logsumexp_naive(safe):.6f}")
print(f"Stable: {logsumexp_stable(safe):.6f}")

large = [500.0, 501.0, 502.0]
print(f"Stable: {logsumexp_stable(large):.6f}")
# logsumexp_naive(large) returns inf
```

### Bước 4: Thực hiện sự liên kết liên tục ổn định

```python
def cross_entropy_naive(true_class, logits):
    probs = softmax_naive(logits)
    return -math.log(probs[true_class])

def cross_entropy_stable(true_class, logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    log_sum_exp = math.log(sum(math.exp(s) for s in shifted))
    log_prob = shifted[true_class] - log_sum_exp
    return -log_prob

logits = [2.0, 5.0, 1.0]
true_class = 1
print(f"Naive:  {cross_entropy_naive(true_class, logits):.6f}")
print(f"Stable: {cross_entropy_stable(true_class, logits):.6f}")
```

### Bước 5: Kiểm tra độ

```python
def numerical_gradient(f, x, h=1e-5):
    grad = []
    for i in range(len(x)):
        x_plus = x[:]
        x_minus = x[:]
        x_plus[i] += h
        x_minus[i] -= h
        grad.append((f(x_plus) - f(x_minus)) / (2 * h))
    return grad

def check_gradient(analytical, numerical, tolerance=1e-5):
    for i, (a, n) in enumerate(zip(analytical, numerical)):
        denom = max(abs(a), abs(n), 1e-8)
        rel_error = abs(a - n) / denom
        status = "OK" if rel_error < tolerance else "FAIL"
        print(f"  param {i}: analytical={a:.8f} numerical={n:.8f} "
              f"rel_error={rel_error:.2e} [{status}]")

def f(params):
    x, y = params
    return x**2 + 3*x*y + y**3

def f_grad(params):
    x, y = params
    return [2*x + 3*y, 3*x + 3*y**2]

point = [2.0, 1.0]
analytical = f_grad(point)
numerical = numerical_gradient(f, point)
check_gradient(analytical, numerical)
```

## Sử dụng nó

### Tái mô phỏng chính xác hỗn hợp

```python
import struct

def float32_to_float16_round(x):
    packed = struct.pack('f', x)
    f32 = struct.unpack('f', packed)[0]
    packed16 = struct.pack('e', f32)
    return struct.unpack('e', packed16)[0]

def simulate_bfloat16(x):
    packed = struct.pack('f', x)
    as_int = int.from_bytes(packed, 'little')
    truncated = as_int & 0xFFFF0000
    repacked = truncated.to_bytes(4, 'little')
    return struct.unpack('f', repacked)[0]
```

### Trình cắt gradient

```python
def clip_by_norm(gradients, max_norm):
    total_norm = math.sqrt(sum(g**2 for g in gradients))
    if total_norm > max_norm:
        scale = max_norm / total_norm
        return [g * scale for g in gradients]
    return gradients

grads = [10.0, 20.0, 30.0]
clipped = clip_by_norm(grads, max_norm=5.0)
print(f"Original norm: {math.sqrt(sum(g**2 for g in grads)):.2f}")
print(f"Clipped norm:  {math.sqrt(sum(g**2 for g in clipped)):.2f}")
print(f"Direction preserved: {[c/clipped[0] for c in clipped]} == {[g/grads[0] for g in grads]}")
```

### Khám phá NaN/Inf

```python
def check_tensor(name, values):
    has_nan = any(math.isnan(v) for v in values)
    has_inf = any(math.isinf(v) for v in values)
    if has_nan or has_inf:
        print(f"WARNING {name}: nan={has_nan} inf={has_inf}")
        return False
    return True

check_tensor("good", [1.0, 2.0, 3.0])
check_tensor("bad",  [1.0, float('nan'), 3.0])
check_tensor("ugly", [1.0, float('inf'), 3.0])
```

Nhìn xem`code/numerical.py`cho các thực hiện hoàn chỉnh với tất cả các trường hợp cạnh được chứng minh.`code/numerical.ts`là một cổng TypeScript với các chức năng và demo tương tự.

## Chuyển nó

Bài học này mang lại:
- `code/numerical.py`Với softmax ổn định, log-sum-exp, cross-entropy, kiểm tra gradient và mô phỏng chính xác hỗn hợp
- `outputs/prompt-numerical-debugger.md`cho việc chẩn đoán NaN/Inf và các vấn đề số trong đào tạo

Những thực hiện ổn định này xuất hiện lại trong giai đoạn 3 khi xây dựng vòng đào tạo và trong giai đoạn 4 khi thực hiện các cơ chế chú ý.

## Các bài tập

1. **Catastrophic cancellation.**Xét sự khác biệt của [1000000.0, 1000001.0, 1000002.0] bằng cách sử dụng công thức ngây thơ $\mathbb{E}[x^2] - \mathbb{E}[x]^2$Sau đó tính toán nó bằng cách sử dụng thuật toán trực tuyến của Welford. So sánh các lỗi với sự khác biệt thực (0,6667).

2. **Precision hunt.**Tìm giá trị float32 tích cực nhỏ nhất `x`như thế này`1.0 + x == 1.0`Đây là máy epsilon. Hãy kiểm tra xem nó phù hợp.`numpy.finfo(numpy.float32).eps`- Tôi không biết.

3. **Log-sum-exp edge cases.**Thử nghiệm `logsumexp_stable`(a) tất cả các giá trị bằng nhau, (b) một giá trị lớn hơn nhiều so với các giá trị khác, (c) tất cả các giá trị rất âm (-1000).

4. **Gradient checking a neural network layer.**Thực hiện một lớp tuyến tính đơn `y = Wx + b`và phân tích của nó đi ngược lại.`numerical_gradient`để xác minh sự chính xác cho một matrix trọng lượng 3x2.

5. **Loss scaling experiment.**Mô phỏng đào tạo với float16: tạo gradient ngẫu nhiên trong phạm vi [1e-9, 1e-3), chuyển đổi sang float16, và đo phân số nào trở thành không. Sau đó áp dụng quy mô mất mát (lập số bằng 1024), chuyển đổi sang float16, quy mô lại, và đo phân số không một lần nữa.

### Những gợi ý

**Exercise 1.**Chuyển đổi ba giá trị bằng `np.float32`trước khi bạn bình quân chúng, sau đó gọi `variance_naive`và `welford_variance`Giá trị gần$10^{12}$trong float32 có khoảng cách lớn hơn nhiều so với 1, vì vậy mong đợi kết quả ngây thơ sẽ xa từ 0.6667 và kết quả Welford sẽ gần.

**Exercise 2.**Bắt đầu với `x = np.float32(1.0)`và giảm một nửa trong khi `np.float32(1.0) + x != np.float32(1.0)`. Giữ mọi giá trị trong float32, sau đó so sánh giá trị cuối cùng mà vẫn thay đổi số tiền với `numpy.finfo(numpy.float32).eps`, đó là $2^{-23}$- Tôi không biết.

**Exercise 3.**Hãy dự đoán trước mỗi câu trả lời.$n$giá trị bình đẳng $c$, kết quả là $c + \ln n$Đối với một giá trị lớn, kết quả gần với giá trị đó. Đối với giá trị gần -1000, kết quả gần $-1000 + \ln n$, trong khi `logsumexp_naive`trả lại `-inf`vì mỗi hàm số biểu diễn chảy xuống 0.

**Exercise 4.**Vì $y = Wx + b$với một tổn thất $L$, độ nghiêng của $W$là sản phẩm bên ngoài của độ lệch lên dòng và $x$. Bỏ mất tích như một chức năng của phẳng $W$, gọi `numerical_gradient`, và chuyển cả hai kết quả cho `check_gradient`- Tôi không biết.

**Exercise 5.**Mô tả các quy mô trên thang log với `10 ** np.random.uniform(-9, -3, n)`và chuyển đổi với `np.float16`. Float16 không thể giữ các giá trị dưới khoảng $6 \times 10^{-8}$, nên mong đợi khoảng một phần tư các giá trị sẽ trở thành 0 trước khi mở rộng và gần như không có khi bạn nhân bằng 1024.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| IEEE 754 | "The float standard" | International standard defining binary floating point formats, rounding rules, and special values (inf, nan). Every modern CPU and GPU implements it. |
| Machine epsilon | "The precision limit" | The smallest value $e$ such that $1.0 + e \ne 1.0$ in a given float format. For float32, it is about 1.19e-7. |
| Catastrophic cancellation | "Precision loss from subtraction" | When subtracting nearly equal floating point numbers, significant digits cancel and rounding noise dominates the result. |
| Overflow | "Number too big" | A result exceeds the maximum representable value and becomes inf. exp(89) overflows float32. |
| Underflow | "Number too small" | A result is closer to zero than the smallest representable positive number and becomes 0.0. exp(-104) underflows float32. |
| Log-sum-exp trick | "Subtract the max first" | Computing $\log(\sum \exp(x))$ by factoring out $\exp(\max(x))$ to prevent overflow and underflow. Used in softmax, cross-entropy, and log-probability math. |
| Stable softmax | "Softmax that does not explode" | Subtracting $\max(\text{logits})$ before exponentiating. Numerically identical result, no overflow possible. |
| Gradient checking | "Verify your backprop" | Comparing analytical gradients from backpropagation against numerical gradients from finite differences to catch implementation bugs. |
| Mixed precision | "Float16 forward, float32 backward" | Using lower-precision floats for speed-critical operations and higher-precision floats for numerically sensitive operations. Typical speedup is 2-3x. |
| Loss scaling | "Prevent gradient underflow" | Multiplying the loss by a large constant before backprop so gradients stay in float16's representable range, then dividing by the same constant before weight updates. |
| bfloat16 | "Brain floating point" | Google's 16-bit format with 8 exponent bits (same range as float32) and 7 mantissa bits (less precision than float16). Preferred for training. |
| Gradient clipping | "Cap the gradient norm" | Scaling the gradient vector so its norm does not exceed a threshold. Prevents exploding gradients from ruining weights. |
| NaN | "Not a Number" | Special float value from undefined operations (0/0, inf-inf, sqrt(-1)). Propagates through all subsequent arithmetic. |
| Inf | "Infinity" | Special float value from overflow or division by zero. Can combine to produce NaN (inf - inf, inf * 0). |
| Numerical gradient | "Brute force derivative" | Approximating a derivative by evaluating $f(x+h)$ and $f(x-h)$ and dividing by $2h$. Slow but reliable for verification. |

## Đọc thêm

- [What Every Computer Scientist Should Know About Floating-Point Arithmetic (Goldberg 1991)](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html)-- giới thiệu cuối cùng, dày đặc nhưng hoàn chỉnh
- [Mixed Precision Training (Micikevicius et al., 2018)](https://arxiv.org/abs/1710.03740)-- bài báo của NVIDIA giới thiệu quy mô lỗ cho việc đào tạo float16
- [AMP: Automatic Mixed Precision (PyTorch docs)](https://pytorch.org/docs/stable/amp.html)-- hướng dẫn thực tế cho độ chính xác hỗn hợp trong PyTorch
- [bfloat16 format (Google Cloud TPU docs)](https://cloud.google.com/tpu/docs/bfloat16)-- tại sao Google chọn định dạng này cho TPU
- [Kahan Summation (Wikipedia)](https://en.wikipedia.org/wiki/Kahan_summation_algorithm)-- thuật toán để giảm lỗi tròn trong số lượng điểm nổi
