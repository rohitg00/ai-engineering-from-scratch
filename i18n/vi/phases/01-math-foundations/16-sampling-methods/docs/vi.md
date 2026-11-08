# Phương pháp lấy mẫu

> Tiêu mẫu là cách AI khám phá không gian của khả năng.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06-07 (Probability, Bayes' Theorem)
**Time:** ~120 minutes

## Mục tiêu học tập

- Thực hiện ngược CDF, từ chối và quan trọng lấy mẫu từ đầu chỉ sử dụng số ngẫu nhiên đồng nhất
- Xây dựng mô hình nhiệt độ, top-k và top-p (tâm) để tạo token mô hình ngôn ngữ
- Giải thích thủ thuật tái định đo lường và lý do tại sao nó cho phép lây lan ngược thông qua lấy mẫu trong VAEs
- Tiến hành Metropolis-Hastings MCMC để lấy mẫu từ phân phối mục tiêu không bình thường

## Vấn đề

Một mô hình ngôn ngữ hoàn thành xử lý yêu cầu của bạn và tạo ra một vector 50.000 logit, một cho mỗi token trong từ vựng của nó. Bây giờ nó phải chọn một. Làm thế nào?

Nếu nó luôn chọn mã hiệu có khả năng cao nhất, mọi phản ứng đều giống nhau. Định nghĩa. Chán chán. Nếu nó chọn một cách ngẫu nhiên, kết quả là nhầm lẫn. Câu trả lời sống ở đâu đó giữa những cực đoan này, và ở đâu đó được kiểm soát bằng cách lấy mẫu.

Việc lấy mẫu không giới hạn trong việc tạo văn bản. Học tập tăng cường ước tính các gradient chính sách bằng cách lấy mẫu quỹ đạo. VAE học các đại diện ẩn bằng cách lấy mẫu từ các phân phối được học và lây lan ngược qua sự ngẫu nhiên. Các mô hình phân tán tạo ra hình ảnh bằng cách lấy mẫu tiếng ồn và lặp đi lặp lại. Phương pháp Monte Carlo ước tính các tích hợp không có giải pháp hình thức đóng. Các thuật toán MCMC khám phá các phân phối hậu chiều cao không thể đếm được.

Mỗi hệ thống AI tạo ra là một hệ thống lấy mẫu. Chiến lược lấy mẫu xác định chất lượng, đa dạng và khả năng kiểm soát của sản phẩm. Bài học này xây dựng mọi phương pháp lấy mẫu lớn từ đầu, bắt đầu từ các số ngẫu nhiên đồng nhất và kết thúc với các kỹ thuật cung cấp năng lượng cho LLM và mô hình tạo ra hiện đại.

## Khái niệm

### Tại sao việc lấy mẫu là quan trọng

Việc lấy mẫu xuất hiện trong bốn vai trò cơ bản trên AI và học máy:

**Generation.**Các mô hình ngôn ngữ, mô hình phân tán và GAN đều tạo ra sản lượng bằng cách lấy mẫu.

**Training.**Các mẫu giảm gradient stochastic nhỏ. Các mẫu bỏ neuron để vô hiệu hóa. Các mẫu tăng dữ liệu biến đổi ngẫu nhiên.

**Estimation.**Nhiều lượng trong ML không có giải pháp hình thức đóng. Sự mất mát dự kiến trên phân phối dữ liệu, chức năng phân vùng của một mô hình dựa trên năng lượng, bằng chứng trong suy luận Bayesian.

**Exploration.**Các thuật toán MCMC khám phá các phân bố sau trong suy luận Bayesian. Chiến lược tiến hóa lấy mẫu các nhiễu thông số.

Thách thức cốt lõi: bạn chỉ có thể lấy mẫu trực tiếp từ phân phối đơn giản (tương tự, bình thường). Đối với tất cả mọi thứ khác, bạn cần một phương pháp để chuyển đổi các mẫu đơn giản thành mẫu từ phân phối mục tiêu của bạn.

### Phân tích ngẫu nhiên thống nhất

Mỗi phương pháp lấy mẫu bắt đầu từ đây. Một máy phát điện số ngẫu nhiên đồng nhất tạo ra các giá trị trong$[0, 1)$nơi mỗi phân đoạn dài bằng nhau có xác suất bằng nhau.

```
U ~ Uniform(0, 1)

P(a <= U <= b) = b - a    for 0 <= a <= b <= 1

Properties:
  E[U] = 0.5
  Var(U) = 1/12
```

Để lấy mẫu một cách đồng nhất từ một tập hợp riêng biệt của $n$các mục, tạo ra $U$và quay lại$\lfloor n U \rfloor$Để lấy mẫu từ một phạm vi liên tục $[a, b]$, tính toán$a + (b - a) U$- Tôi không biết.

Ý tưởng chính: một số ngẫu nhiên đồng nhất có chứa chính xác số lượng ngẫu nhiên phù hợp để tạo ra một mẫu từ bất kỳ phân phối nào.

### Phương pháp CDF ngược (Thiết mẫu biến ngược)

Chức năng phân phối tích lũy (CDF) lập bản đồ các giá trị thành xác suất:

```
F(x) = P(X <= x)

Properties:
  F is non-decreasing
  F(-inf) = 0
  F(+inf) = 1
  F maps the real line to [0, 1]
```

CDF ngược sẽ lập bản đồ xác suất trở lại với giá trị.$U \sim \text{Uniform}(0, 1)$, sau đó $X = F^{-1}(U)$theo mục tiêu phân phối.

```
Algorithm:
  1. Generate u ~ Uniform(0, 1)
  2. Return F_inverse(u)

Why it works:
  P(X <= x) = P(F_inverse(U) <= x) = P(U <= F(x)) = F(x)
```

**Exponential distribution example:**

```
PDF: f(x) = lambda * exp(-lambda * x),   x >= 0
CDF: F(x) = 1 - exp(-lambda * x)

Solve F(x) = u for x:
  u = 1 - exp(-lambda * x)
  exp(-lambda * x) = 1 - u
  x = -ln(1 - u) / lambda

Since (1 - U) and U have the same distribution:
  x = -ln(u) / lambda
```

Điều này hoạt động hoàn hảo khi bạn có thể ghi lại$F^{-1}$Đối với phân bố bình thường, không có CDF ngược hình thức đóng, vì vậy chúng tôi sử dụng các phương pháp khác (Box-Muller, hoặc ước tính số).

**Discrete version:**Đối với phân phối riêng biệt, xây dựng CDF như một tổng cộng, tạo $U$, và tìm chỉ số đầu tiên khi tổng số hóa vượt quá $U$Đây là cách mà`sample_categorical`làm việc trong Bài học 06.

### Phân tích mẫu từ chối

Khi bạn không thể đảo ngược CDF nhưng có thể đánh giá mục tiêu PDF lên đến một liên tục, việc lấy mẫu từ chối hoạt động.

```
Target distribution: p(x)  (can evaluate, possibly unnormalized)
Proposal distribution: q(x)  (can sample from)
Bound: M such that p(x) <= M * q(x) for all x

Algorithm:
  1. Sample x ~ q(x)
  2. Sample u ~ Uniform(0, 1)
  3. If u < p(x) / (M * q(x)), accept x
  4. Otherwise, reject and go to step 1

Acceptance rate = Z/M, where Z is the integral of p(x)
                (Z = 1, so the rate is 1/M, when p is normalized)
```

Càng chặt hơn thì càng chặt hơn$M$, tỷ lệ chấp nhận cao hơn. Trong các chiều kích thấp (1-3), lấy mẫu từ chối hoạt động tốt. Trong các chiều kích cao, tỷ lệ chấp nhận giảm theo cấp số lượng bởi vì phần lớn khối lượng đề xuất bị từ chối. Đây là lời nguyền về chiều kích cho lấy mẫu từ chối.

**Example: sampling from a truncated normal.**Sử dụng một đề xuất thống nhất trên phạm vi cắt giảm.$M$là tối đa của PDF bình thường trong phạm vi đó.

**Example: sampling from a semicircle.**Đề xuất một cách đồng đều trong hình chữ nhật biên giới. chấp nhận nếu điểm rơi vào trong bán vòng tròn. Đây là cách Monte Carlo tính toán$\pi$: tỷ lệ chấp nhận bằng tỷ lệ diện tích $\pi/4$- Tôi không biết.

### Việc lấy mẫu quan trọng

Đôi khi bạn không cần các mẫu từ phân phối mục tiêu $p(x)$Bạn cần ước tính một kỳ vọng dưới$p(x)$, và bạn có mẫu từ phân phối khác nhau $q(x)$- Tôi không biết.

```
Goal: estimate E_p[f(x)] = integral of f(x) * p(x) dx

Rewrite:
  E_p[f(x)] = integral of f(x) * (p(x)/q(x)) * q(x) dx
            = E_q[f(x) * w(x)]

where w(x) = p(x) / q(x)  are the importance weights.

Estimator:
  E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))    where x_i ~ q(x)
```

Điều này rất quan trọng trong việc học tập tăng cường. Trong PPO (Proposal Policy Optimization), bạn thu thập quỹ đạo theo một chính sách cũ $\pi_{\text{old}}$nhưng muốn tối ưu hóa một chính sách mới $\pi_{\text{new}}$. trọng lượng quan trọng là $\pi_{\text{new}}(a \mid s) / \pi_{\text{old}}(a \mid s)$PPO cắt giảm những cân nặng này để ngăn chặn chính sách mới đi xa quá xa với chính sách cũ.

Sự khác biệt của ước tính lấy mẫu tầm quan trọng phụ thuộc vào mức độ tương tự $q$là để $p$Nếu$q$rất khác với $p$, một vài mẫu có trọng lượng khổng lồ và thống trị ước tính.

```math
\mathbb{E}_p[f(x)] \approx \frac{\sum_i w_i \, f(x_i)}{\sum_i w_i}
```

### Đánh giá Monte Carlo

Phân tích Monte Carlo ước tính gần gũi bằng cách trung bình các mẫu ngẫu nhiên. Luật số lớn đảm bảo sự hội tụ.

```
Goal: estimate I = integral of g(x) dx over domain D

Method:
  1. Sample x_1, ..., x_N uniformly from D
  2. I ~ (Volume of D / N) * sum(g(x_i))

Error: O(1 / sqrt(N))   regardless of dimension
```

Tỷ lệ lỗi là không phụ thuộc vào kích thước. Đó là lý do tại sao phương pháp Monte Carlo thống trị ở các kích thước cao nơi tích hợp dựa trên lưới là không thể.

**Estimating pi:**

```
Sample (x, y) uniformly from [-1, 1] x [-1, 1]
Count how many fall inside the unit circle: x^2 + y^2 <= 1
pi ~ 4 * (count inside) / (total count)
```

**Estimating expectations:**

```
E[f(X)] ~ (1/N) * sum(f(x_i))    where x_i ~ p(x)

The sample mean converges to the true expectation.
Variance of the estimator = Var(f(X)) / N
```

### Đường dây Markov Monte Carlo (MCMC): Metropolis-Hastings

MCMC xây dựng một chuỗi Markov mà phân phối tĩnh là mục tiêu phân phối $p(x)$Sau khi có đủ bước, các mẫu từ chuỗi là (khoảng) các mẫu từ $p(x)$- Tôi không biết.

```
Target: p(x)  (known up to a normalizing constant)
Proposal: q(x'|x)  (how to propose the next state given the current state)

Metropolis-Hastings algorithm:
  1. Start at some x_0
  2. For t = 1, 2, ..., T:
     a. Propose x' ~ q(x'|x_t)
     b. Compute acceptance ratio:
        alpha = [p(x') * q(x_t|x')] / [p(x_t) * q(x'|x_t)]
     c. Accept with probability min(1, alpha):
        - If u < alpha (u ~ Uniform(0,1)): x_{t+1} = x'
        - Otherwise: x_{t+1} = x_t
  3. Discard first B samples (burn-in)
  4. Return remaining samples
```

Đối với các đề xuất đối xứng $(q(x' \mid x) = q(x \mid x'))$, tỷ lệ đơn giản hóa thành $p(x')/p(x)$Đây là thuật toán Metropolis ban đầu.

**Why it works.**Quy tắc chấp nhận đảm bảo sự cân bằng chi tiết: khả năng ở $x$và chuyển đến $x'$bằng với xác suất ở $x'$và chuyển đến $x$Sự cân bằng chi tiết cho thấy rằng$p(x)$là sự phân phối tĩnh của chuỗi.

**Practical considerations:**
- Đốt: loại bỏ các mẫu sơ khai trước khi chuỗi đạt được cân bằng
- Thâm mỏng: giữ tất cả $k$- mẫu thứ hai để giảm sự tương quan tự động
- Skala đề xuất: quá nhỏ và chuỗi di chuyển chậm (tự chấp nhận cao, khám phá chậm); quá lớn và hầu hết các đề xuất bị từ chối (tự chấp nhận thấp, bị mắc kẹt)
- Tỷ lệ chấp nhận tối ưu cho một đề xuất Gaussian ở kích thước cao là khoảng 0,234

### Gibbs Sampling

Phân tích Gibbs là một trường hợp đặc biệt của MCMC cho phân phối đa biến. Thay vì đề xuất chuyển động trong tất cả các chiều kích cùng một lúc, nó cập nhật một biến một lần từ phân phối điều kiện của nó.

```
Target: p(x_1, x_2, ..., x_d)

Algorithm:
  For each iteration t:
    Sample x_1^{t+1} ~ p(x_1 | x_2^t, x_3^t, ..., x_d^t)
    Sample x_2^{t+1} ~ p(x_2 | x_1^{t+1}, x_3^t, ..., x_d^t)
    ...
    Sample x_d^{t+1} ~ p(x_d | x_1^{t+1}, x_2^{t+1}, ..., x_{d-1}^{t+1})
```

Việc lấy mẫu Gibbs đòi hỏi bạn có thể lấy mẫu từ mỗi phân phối có điều kiện .$p(x_i \mid x_{-i})$Điều này rất đơn giản đối với nhiều mô hình:
- Các mạng Bayesian: điều kiện theo sau từ cấu trúc đồ thị
- Các hỗn hợp Gaussian: điều kiện là Gaussian
- Các mô hình Ising: điều kiện của mỗi spin chỉ phụ thuộc vào các hàng xóm của nó

Tỷ lệ chấp nhận luôn là 1 (mỗi đề xuất đều được chấp nhận) vì việc lấy mẫu từ điều kiện chính xác tự động đáp ứng cân bằng chi tiết.

**Limitation.**Khi các biến có liên quan cao, việc lấy mẫu Gibbs trộn chậm vì cập nhật một biến một lần không thể thực hiện các chuyển động đường vạch lớn thông qua phân phối.

### Tiêu chuẩn nhiệt độ (được sử dụng trong LLM)

Các mô hình ngôn ngữ xuất logits $z_1, \ldots, z_V$Softmax chuyển đổi chúng thành xác suất. nhiệt độ tái định lượng các logit trước softmax:

```
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0: standard softmax (original distribution)
T -> 0:  argmax (deterministic, always picks highest logit)
T -> inf: uniform (all tokens equally likely)
T < 1.0: sharpens the distribution (more confident, less diverse)
T > 1.0: flattens the distribution (less confident, more diverse)
```

**Why it works.**Chia logit bởi $T < 1$làm tăng sự khác biệt giữa các logit.$z_1 = 2$và $z_2 = 1$, chia bằng $T = 0.5$cho $z_1/T = 4$và $z_2/T = 2$Sau Softmax, token logit cao nhất sẽ có phần lớn hơn nhiều.

**In practice:**
- $T = 0.0$: decoding tham lam, tốt nhất cho Q&A thực tế
- $T = 0.3\text{-}0.7$: hơi sáng tạo, tốt cho việc tạo ra mã
- $T = 0.7\text{-}1.0$: cân bằng, tốt cho cuộc trò chuyện chung
- $T = 1.0\text{-}1.5$: viết sáng tạo, suy nghĩ
- $T > 1.5$: ngày càng ngẫu nhiên, hiếm khi hữu ích

Nhiệt độ không thay đổi các token có thể, nó thay đổi khối lượng xác suất được phân bổ cho mỗi token.

### Top-k Sampling

Top-k lấy mẫu giới hạn ứng cử viên được đặt ra cho $k$token có xác suất cao nhất, sau đó tái bình thường hóa và lấy mẫu từ tập hợp hạn chế đó.

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Keep only the top k tokens
  4. Renormalize: p_i' = p_i / sum(p_j for j in top-k)
  5. Sample from the renormalized distribution

k = 1:  greedy decoding
k = V:  no filtering (standard sampling)
k = 40: typical setting, removes long tail of unlikely tokens
```

Top-k ngăn chặn mô hình chọn các mã thông báo cực kỳ khó có thể (typos, nonsense) tồn tại trong đuôi dài của phân phối từ vựng. Vấn đề: $k$Nếu mô hình là tự tin (một token có khả năng 95%), $k = 40$vẫn cho phép 39 lựa chọn thay thế. Khi mô hình không chắc chắn (khả năng được phân bố trên 1000 token), $k = 40$cắt giảm các lựa chọn hợp lý.

### Top-p (Nucleus) lấy mẫu

Top-p lấy mẫu thay vì giữ một số lượng mã thông báo cố định, nó giữ bộ mã thông báo nhỏ nhất có khả năng tích lũy vượt quá $p$- Tôi không biết.

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Find smallest k such that sum of top-k probabilities >= p
  4. Keep only those k tokens
  5. Renormalize and sample

p = 0.9:  keeps tokens covering 90% of probability mass
p = 1.0:  no filtering
p = 0.1:  very restrictive, nearly greedy
```

Khi mô hình tự tin, lấy mẫu hạt nhân giữ ít mã thông báo (có lẽ 2-3). Khi mô hình không chắc chắn, nó giữ nhiều (có lẽ 200). Hành vi thích ứng này là lý do tại sao lấy mẫu hạt nhân thường tạo ra văn bản tốt hơn so với top-k.

**Common combinations:**
- Nhiệt độ 0,7 + top-p 0,9: thiết lập mục đích chung tốt
- Nhiệt độ 0.0 (cười tham): tốt nhất cho các nhiệm vụ xác định
- Nhiệt độ 1.0 + top-k 50: Fan et al. (2018) thiết lập giấy gốc

Top-k và top-p có thể được kết hợp.

### Trù sửa chữa (chỉ sử dụng trong VAEs)

Các bộ tự động mã hóa biến thể (VAE) học bằng cách mã hóa đầu vào vào một phân phối trong không gian ẩn, lấy mẫu từ phân phối đó và giải mã lại mẫu. Vấn đề: bạn không thể lây lan trở lại thông qua một hoạt động lấy mẫu.

```
Standard sampling (not differentiable):
  z ~ N(mu, sigma^2)

  The randomness blocks gradient flow.
  d/d_mu [sample from N(mu, sigma^2)] = ???
```

Tránh tái định đo phân tách sự ngẫu nhiên từ các tham số:

```
Reparameterized sampling:
  epsilon ~ N(0, 1)          (fixed random noise, no parameters)
  z = mu + sigma * epsilon   (deterministic function of parameters)

  Now z is a deterministic, differentiable function of mu and sigma.
  d(z)/d(mu) = 1
  d(z)/d(sigma) = epsilon

  Gradients flow through mu and sigma.
```

Điều này hiệu quả bởi vì$\mathcal{N}(\mu, \sigma^2)$có phân phối tương tự như $\mu + \sigma \cdot \mathcal{N}(0, 1)$. Thông tin quan trọng: chuyển sự ngẫu nhiên đến một nguồn không có tham số ($\epsilon$), sau đó thể hiện mẫu như một biến đổi phân biệt các tham số.

**In the VAE training loop:**
1. Các đầu ra mã hóa $\mu$và $\log(\sigma^2)$cho mỗi đầu vào
2. Mô hình $\epsilon \sim \mathcal{N}(0, 1)$
3. Lưu ý$z = \mu + \sigma \epsilon$
4. Tự giải mã $z$để tái cấu trúc đầu vào
5. Chuyển ngược qua các bước 4, 3, 2, 1 (có thể bởi vì bước 3 có thể phân biệt)

Nếu không có thủ thuật tái định đo lường, VAE không thể được đào tạo với sự lây lan ngược tiêu chuẩn.

### Gumbel-Softmax (Phân tích phân loại khác nhau)

Tránh tái định đo lường hoạt động cho phân phối liên tục (Gaussian). Đối với phân phối thể loại riêng biệt, chúng ta cần một cách tiếp cận khác. Gumbel-Softmax cung cấp một sự gần gũi phân biệt với lấy mẫu thể loại.

**The Gumbel-Max trick (non-differentiable):**

```
To sample from a categorical distribution with log-probabilities log(p_1), ..., log(p_k):
  1. Sample g_i ~ Gumbel(0, 1) for each category
     (g = -log(-log(u)), where u ~ Uniform(0, 1))
  2. Return argmax(log(p_i) + g_i)

This produces exact categorical samples.
```

**Gumbel-Softmax (differentiable approximation):**

```
Replace the hard argmax with a soft softmax:
  y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))

tau (temperature) controls the approximation:
  tau -> 0:  approaches a one-hot vector (hard categorical)
  tau -> inf: approaches uniform (1/k, 1/k, ..., 1/k)
  tau = 1.0: soft approximation
```

Gumbel-Softmax tạo ra sự thư giãn liên tục của một mẫu phân biệt. Kết quả là một vector xác suất (mềm một nóng) thay vì một nóng cứng. Các gradient chảy qua softmax. Trong quá trình đi về phía trước trong đào tạo, bạn có thể sử dụng ước tính "thẳng qua": sử dụng argmax cứng cho quá trình đi về phía trước nhưng gradient mềm Gumbel-Softmax cho quá trình đi về phía sau.

**Applications:**
- Các biến ẩn trong các VAE
- Tìm kiếm kiến trúc thần kinh (chọn các hoạt động riêng biệt)
- Cơ chế chú ý cứng
- Học tập tăng cường bằng các hành động riêng biệt

### Tiêu chuẩn lấy mẫu

Các mẫu mẫu Monte Carlo tiêu chuẩn có thể để lại khoảng trống trong không gian mẫu do tình cờ.

```
Standard Monte Carlo:
  Sample N points uniformly from [0, 1]
  Some regions may have clusters, others gaps

Stratified sampling:
  Divide [0, 1] into N equal strata: [0, 1/N), [1/N, 2/N), ..., [(N-1)/N, 1)
  Sample one point uniformly within each stratum
  x_i = (i + u_i) / N   where u_i ~ Uniform(0, 1),  i = 0, ..., N-1
```

Các mẫu phân cấp luôn có sự biến dạng thấp hơn hoặc bằng nhau so với Monte Carlo tiêu chuẩn:

```
Var(stratified) <= Var(standard Monte Carlo)

The improvement is largest when f(x) varies smoothly.
For piecewise-constant functions, stratified sampling is exact.
```

**Applications:**
- Kết hợp số (quasi-Monte Carlo)
- Các phân chia dữ liệu đào tạo (đảm bảo sự cân bằng lớp học trong mỗi lần)
- Tiêu chuẩn lấy mẫu quan trọng với phân bố lớp (combination of both techniques)
- NeRF (Neural Radiance Fields) sử dụng lấy mẫu phân tầng dọc theo các tia máy ảnh

### Kết nối với các mô hình phân phối

Các mô hình phân tán tạo ra hình ảnh thông qua một quá trình lấy mẫu.$T$tiến hành cho đến khi nó trở thành tiếng ồn thuần túy.

```
Forward process (known):
  x_t = sqrt(alpha_t) * x_{t-1} + sqrt(1 - alpha_t) * epsilon
  where epsilon ~ N(0, I)

  After T steps: x_T ~ N(0, I)  (pure noise)

Reverse process (learned):
  x_{t-1} = (1/sqrt(alpha_t)) * (x_t - (1 - alpha_t)/sqrt(1 - alpha_bar_t) * epsilon_theta(x_t, t)) + sigma_t * z
  where z ~ N(0, I)

  Each denoising step is a sampling step.
```

Kết nối với các phương pháp trong bài học này:
- Mỗi bước khử sử dụng thủ thuật tái định đo (mô hình tiếng ồn, áp dụng biến đổi xác định)
- Thời gian âm thanh $\lbrace \alpha_t \rbrace$điều khiển một hình thức điều khiển nhiệt độ
- Việc đào tạo sử dụng ước tính Monte Carlo để gần ELBO (bằng chứng bên dưới)
- Tiêu mẫu tổ tiên trong các mô hình phân tán là chuỗi Markov (mỗi bước chỉ phụ thuộc vào trạng thái hiện tại)

Toàn bộ quá trình tạo hình ảnh là lấy mẫu lặp lại: bắt đầu từ tiếng ồn, và ở mỗi bước, lấy mẫu một phiên bản ít tiếng ồn hơn một chút theo mô hình từ chối được học.

```figure
monte-carlo-pi
```

## Hãy xây dựng nó

### Bước 1: Tiểu mẫu CDF thống nhất và ngược

```python
import math
import random

def sample_uniform(a, b):
    return a + (b - a) * random.random()

def sample_exponential_inverse_cdf(lam):
    u = random.random()
    return -math.log(u) / lam
```

Tạo ra 10.000 mẫu biểu diễn và xác minh trung bình là $1/\lambda$- Tôi không biết.

### Bước 2: Tiểu mẫu từ chối

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

Sử dụng mẫu từ chối để rút ra từ phân bố bình thường bị cắt.

### Bước 3: Tiểu mẫu tầm quan trọng

```python
def importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n):
    total = 0
    for _ in range(n):
        x = proposal_sample()
        w = target_pdf(x) / proposal_pdf(x)
        total += f(x) * w
    return total / n
```

Đếm số$\mathbb{E}[X^2]$Phân tích của các câu trả lời được biết đến ($\mu^2 + \sigma^2$().

### Bước 4: ước tính Monte Carlo của pi

```python
def monte_carlo_pi(n):
    inside = 0
    for _ in range(n):
        x = random.uniform(-1, 1)
        y = random.uniform(-1, 1)
        if x*x + y*y <= 1:
            inside += 1
    return 4 * inside / n
```

### Bước 5: Metropolis-Hastings MCMC

```python
def metropolis_hastings(target_log_pdf, proposal_sample, proposal_log_pdf, x0, n_samples, burn_in):
    samples = []
    x = x0
    for i in range(n_samples + burn_in):
        x_new = proposal_sample(x)
        log_alpha = (target_log_pdf(x_new) + proposal_log_pdf(x, x_new)
                     - target_log_pdf(x) - proposal_log_pdf(x_new, x))
        if math.log(random.random()) < log_alpha:
            x = x_new
        if i >= burn_in:
            samples.append(x)
    return samples
```

Mô hình từ phân bố bimodal (cộn lẫn hai Gaussians).

### Bước 6: lấy mẫu Gibbs

```python
def gibbs_sampling_2d(conditional_x_given_y, conditional_y_given_x, x0, y0, n_samples, burn_in):
    x, y = x0, y0
    samples = []
    for i in range(n_samples + burn_in):
        x = conditional_x_given_y(y)
        y = conditional_y_given_x(x)
        if i >= burn_in:
            samples.append((x, y))
    return samples
```

### Bước 7: Tiêu chuẩn nhiệt độ

```python
def softmax(logits):
    max_l = max(logits)
    exps = [math.exp(z - max_l) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def temperature_sample(logits, temperature):
    scaled = [z / temperature for z in logits]
    probs = softmax(scaled)
    return sample_from_probs(probs)
```

Hiển thị cách nhiệt độ thay đổi phân phối đầu ra cho một tập hợp logit token.

### Bước 8: Tiêu chuẩn top-k và top-p

```python
def top_k_sample(logits, k):
    indexed = sorted(enumerate(logits), key=lambda x: -x[1])
    top = indexed[:k]
    top_logits = [l for _, l in top]
    probs = softmax(top_logits)
    idx = sample_from_probs(probs)
    return top[idx][0]

def top_p_sample(logits, p):
    probs = softmax(logits)
    indexed = sorted(enumerate(probs), key=lambda x: -x[1])
    cumsum = 0
    selected = []
    for token_idx, prob in indexed:
        cumsum += prob
        selected.append((token_idx, prob))
        if cumsum >= p:
            break
    sel_probs = [pr for _, pr in selected]
    total = sum(sel_probs)
    sel_probs = [pr / total for pr in sel_probs]
    idx = sample_from_probs(sel_probs)
    return selected[idx][0]
```

### Bước 9: Tránh sửa chữa

```python
def reparam_sample(mu, sigma):
    epsilon = random.gauss(0, 1)
    return mu + sigma * epsilon

def reparam_gradient(mu, sigma, epsilon):
    dz_dmu = 1.0
    dz_dsigma = epsilon
    return dz_dmu, dz_dsigma
```

Hiển thị rằng gradient chảy qua mẫu tái định đo nhưng không thông qua lấy mẫu trực tiếp.

### Bước 10: Gumbel-Softmax

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [math.log(p) + gumbel_sample() for p in logits]
    return softmax([g / temperature for g in gumbels])
```

Hãy cho thấy nhiệt độ giảm làm cho đầu ra tiếp cận một vector nóng.

Các thực hiện đầy đủ với tất cả các hình ảnh hóa là trong `code/sampling.py`- Tôi không biết.

Cổng TypeScript đang được cài đặt `code/sampling.ts`Nó sử dụng máy phát điện ngẫu nhiên của riêng nó, vì vậy số ngẫu nhiên của nó khác với đầu ra Python.

## Sử dụng nó

Với NumPy và SciPy, các phiên bản sản xuất:

```python
import numpy as np

rng = np.random.default_rng(42)

exponential_samples = rng.exponential(scale=2.0, size=10000)
print(f"Exponential mean: {exponential_samples.mean():.4f} (expected 2.0)")

from scipy import stats
normal = stats.norm(loc=0, scale=1)
print(f"CDF at 1.96: {normal.cdf(1.96):.4f}")
print(f"Inverse CDF at 0.975: {normal.ppf(0.975):.4f}")

logits = np.array([2.0, 1.0, 0.5, 0.1, -1.0])
temperature = 0.7
scaled = logits / temperature
probs = np.exp(scaled - scaled.max()) / np.exp(scaled - scaled.max()).sum()
token = rng.choice(len(logits), p=probs)
print(f"Sampled token index: {token}")
```

Đối với MCMC trên quy mô, sử dụng thư viện chuyên dụng:
- PyMC: mô hình Bayesian đầy đủ với NUTS (HMC thích ứng)
- emcee: bộ mẫu MCMC
- NumPyro/JAX: MCMC tăng tốc GPU

Anh đã xây dựng những cái này từ đầu rồi, giờ anh biết những gì thư viện gọi đang làm.

## Các bài tập

1. Thực hiện lấy mẫu CDF ngược cho phân phối Cauchy.$F(x) = 0.5 + \arctan(x)/\pi$. Tạo 10.000 mẫu và vẽ histogram so với PDF thực. Nhận thấy đuôi nặng (giá trị cực xa trung tâm).

2. Sử dụng mẫu từ chối để tạo mẫu từ phân phối Beta(2, 5) sử dụng đề xuất Uniform(0, 1). Chụp các mẫu được chấp nhận so với PDF Beta thực tế. Tỷ lệ chấp nhận lý thuyết là gì?

3. Đếm số tích hợp của $\sin(x)$từ 0 đến $\pi$sử dụng Monte Carlo với 1.000, 10.000 và 100.000 mẫu. So sánh lỗi ở mỗi cấp độ.$O(1/\sqrt{N})$- Tôi không biết.

4. Thực hiện Metropolis-Hastings để lấy mẫu từ phân phối 2D $p(x, y)$tương xứng với $\exp(-(x^2 y^2 + x^2 + y^2 - 8x - 8y) / 2)$- Chụp các mẫu và đường đi chuỗi.

5. Xây dựng một bản demo tạo văn bản hoàn chỉnh: với một từ vựng 10 từ với logit, tạo ra chuỗi 20 mã thông báo bằng cách sử dụng (a) tham lam, (b) nhiệt độ = 0,7, (c) top-k = 3, (d) top-p = 0,9. So sánh sự đa dạng của các đầu ra trong 5 lần chạy.

### Những gợi ý

**Exercise 1.**Giải quyết $u = F(x)$cho $x$, cho phép$x = \tan(\pi(u - 0.5))$Kiểm tra xem liệu trung bình mẫu có gần 0 và khoảng 6% mẫu có $\lvert x \rvert > 10$, đó là $1 - (2/\pi)\arctan(10)$- Tôi không biết.

**Exercise 2.**Độ dày Beta ((2, 5) là $30x(1-x)^4$Tìm giá trị lớn nhất của nó ở chế độ $x = 1/5$và sử dụng giá trị đó như $M$trong `rejection_sample`Tỷ lệ chấp nhận lý thuyết là$1/M$, nên so sánh nó với phần nhỏ các đề xuất mà bạn chấp nhận.

**Exercise 3.**Giá trị chính xác là 2.`monte_carlo_integral(math.sin, 0, math.pi, n)`cho mỗi $n$và lặp lại mỗi lần chạy với nhiều hạt giống.$n$tăng gấp 10 lần, lỗi trung bình sẽ giảm khoảng $\sqrt{10} \approx 3.2$- Tôi không biết.

**Exercise 4.**Viết nhật ký của mục tiêu, đó là $-(x^2 y^2 + x^2 + y^2 - 8x - 8y)/2$, và chuyển nó cho `metropolis_hastings_2d`- ghi lại tỷ lệ chấp nhận cho mỗi đề xuất lệch chuẩn: một giá trị rất nhỏ chấp nhận hầu hết mọi bước nhưng di chuyển chậm, và một giá trị rất lớn từ chối hầu hết mọi bước.

**Exercise 5.**Việc giải mã tham lam lấy chỉ số logit lớn nhất ở mỗi bước.`temperature_sample`- `top_k_sample`, và`top_p_sample`Tham mê phải đưa ra cùng một chuỗi trong tất cả 5 lần chạy, vì vậy hãy đếm các chuỗi riêng biệt cho mỗi phương pháp để đo đa dạng.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Sampling | "Drawing random values" | Generating values according to a probability distribution. The mechanism behind all generative AI |
| Uniform distribution | "All equally likely" | Every value in $[a, b]$ has equal probability density $1/(b-a)$. The starting point for all sampling methods |
| Inverse CDF | "Probability transform" | $F^{-1}(U)$ converts a uniform sample into a sample from any distribution with known CDF. Exact and efficient |
| Rejection sampling | "Propose and accept/reject" | Generate from a simple proposal, accept with probability proportional to target/proposal ratio. Exact but wastes samples |
| Importance sampling | "Reweight samples" | Estimate expectations under $p(x)$ using samples from $q(x)$ by weighting each sample by $p(x)/q(x)$. Core to PPO in RL |
| Monte Carlo | "Average random samples" | Approximate integrals as sample averages. Error $O(1/\sqrt{N})$ regardless of dimension |
| MCMC | "Random walk that converges" | Construct a Markov chain whose stationary distribution is the target. Metropolis-Hastings is the foundational algorithm |
| Metropolis-Hastings | "Accept uphill, sometimes downhill" | Propose moves, accept based on density ratio. Detailed balance ensures convergence to target distribution |
| Gibbs sampling | "One variable at a time" | Update each variable from its conditional distribution holding others fixed. 100% acceptance rate |
| Temperature | "Confidence knob" | Divides logits by $T$ before softmax. $T<1$ sharpens (more confident), $T>1$ flattens (more diverse) |
| Top-k sampling | "Keep the k best" | Zero out all but the $k$ highest-probability tokens, renormalize, sample. Fixed candidate set size |
| Nucleus sampling (top-p) | "Keep the probable ones" | Keep the smallest set of tokens whose cumulative probability exceeds $p$. Adaptive candidate set size |
| Reparameterization trick | "Move randomness outside" | Write $z = \mu + \sigma \epsilon$ where $\epsilon \sim \mathcal{N}(0,1)$. Makes sampling differentiable. Essential for VAE training |
| Gumbel-Softmax | "Soft categorical sampling" | Differentiable approximation to categorical sampling using Gumbel noise + softmax with temperature |
| Stratified sampling | "Forced coverage" | Divide sample space into strata, sample from each. Always lower variance than naive Monte Carlo |
| Burn-in | "Warm-up period" | Initial MCMC samples discarded before the chain reaches its stationary distribution |
| Detailed balance | "Reversibility condition" | $p(x) T(x \to y) = p(y) T(y \to x)$. Sufficient condition for $p$ to be the stationary distribution of a Markov chain |
| Diffusion sampling | "Iterative denoising" | Generate data by starting from noise and applying learned denoising steps. Each step is a conditional sampling operation |

## Đọc thêm

- [Holbrook (2023): The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010)- hướng dẫn chi tiết về cơ sở MCMC
- [Jang, Gu, Poole (2017): Categorical Reparameterization with Gumbel-Softmax](https://arxiv.org/abs/1611.01144)- giấy gốc Gumbel-Softmax
- [Holtzman et al. (2020): The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751)- giấy lấy mẫu hạt nhân (top-p)
- [Kingma & Welling (2014): Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114)- VAE giấy giới thiệu thủ thuật tái định đo lường
- [Ho, Jain, Abbeel (2020): Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239)- DDPM kết nối lấy mẫu với việc tạo hình ảnh
