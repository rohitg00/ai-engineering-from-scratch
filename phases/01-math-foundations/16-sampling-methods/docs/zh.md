# 取樣方法

> 取樣是 AI 探索可能性空間的方式。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 1 · 單元 06-07（機率、貝氏定理）
**時間：** 約 120 分鐘

## 學習目標

- 只用均勻隨機數，從零實作逆 CDF 取樣、拒絕取樣與重要性取樣
- 為語言模型的詞元生成打造溫度、top-k 與 top-p（nucleus）取樣
- 說明重參數化技巧，以及它為什麼能讓梯度在 VAE 裡穿過取樣這一步
- 跑 Metropolis-Hastings MCMC，從一個未正規化的目標分布取樣

## 問題所在

語言模型讀完你的提示詞，輸出一個有 50,000 個 logits 的向量。詞彙表裡每個詞元一個。現在它得挑一個出來。怎麼挑？

如果它總是挑機率最高的詞元，那每次回應都一模一樣。決定性的。無聊。如果它均勻隨機亂挑，輸出就是一團亂碼。答案在這兩個極端之間的某處，而那個「某處」是由取樣控制的。

取樣不只用在文字生成。強化學習透過取樣軌跡來估計策略梯度。VAE 透過從學到的分布取樣、再讓梯度穿過這些隨機性，來學出潛在表示。擴散模型先取樣雜訊，再反覆去噪來生成圖片。蒙地卡羅方法用來估計沒有封閉解的積分。MCMC 演算法則用來探索那些根本不可能逐一列舉的高維後驗分布。

每一個生成式 AI 系統都是一個取樣系統。取樣策略決定了輸出的品質、多樣性與可控性。這個單元會從零打造所有主要的取樣方法，從均勻隨機數開始，一路做到驅動現代 LLM 與生成模型的那些技術。

## 核心概念

### 取樣為什麼重要

取樣在 AI 與機器學習裡扮演四種根本角色：

**生成。** 語言模型、擴散模型與 GAN 都是靠取樣產生輸出的。取樣演算法直接控制創造力、連貫性與多樣性。溫度、top-k 與 nucleus 取樣就是工程師每天在轉的旋鈕。

**訓練。** 隨機梯度下降會取樣 mini-batch。Dropout 會取樣要關掉哪些神經元。資料增強會取樣隨機的轉換。重要性取樣則會重新加權樣本，以縮減強化學習（PPO、TRPO）中的梯度變異數。

**估計。** ML 裡很多量都沒有封閉解。像是在資料分布上的期望損失、能量模型的配分函數、貝氏推論裡的證據。蒙地卡羅估計把這些全都用樣本平均來近似。

**探索。** MCMC 演算法在貝氏推論裡探索後驗分布。演化策略會取樣參數的擾動。Thompson sampling 則在 bandit 問題裡平衡探索與利用。

核心的難題是：你只能直接從簡單的分布（均勻、常態）取樣。其他所有情況，你都需要一個方法，把簡單的樣本轉換成目標分布的樣本。

### 均勻隨機取樣

每一種取樣方法都從這裡開始。均勻隨機數產生器產生 [0, 1) 之間的值，其中任何等長的子區間機率都相同。

```
U ~ Uniform(0, 1)

P(a <= U <= b) = b - a    for 0 <= a <= b <= 1

Properties:
  E[U] = 0.5
  Var(U) = 1/12
```

要從 n 個項目的離散集合中均勻取樣，就產生 U 然後回傳 floor(n * U)。要從連續區間 [a, b] 取樣，就計算 a + (b - a) * U。

關鍵的洞見是：一個均勻隨機數所含的隨機性，剛剛好足以產生任何分布的一個樣本。訣竅在於找到對的轉換。

### 逆 CDF 法（反轉換取樣）

累積分布函數（CDF）把數值映射到機率：

```
F(x) = P(X <= x)

Properties:
  F is non-decreasing
  F(-inf) = 0
  F(+inf) = 1
  F maps the real line to [0, 1]
```

逆 CDF 則把機率映射回數值。如果 U ~ Uniform(0, 1)，那麼 X = F_inverse(U) 就服從目標分布。

```
Algorithm:
  1. Generate u ~ Uniform(0, 1)
  2. Return F_inverse(u)

Why it works:
  P(X <= x) = P(F_inverse(U) <= x) = P(U <= F(x)) = F(x)
```

**指數分布的例子：**

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

當你能寫出 F_inverse 的封閉形式時，這個方法完美無缺。常態分布的逆 CDF 沒有封閉形式，所以我們得改用其他方法（Box-Muller，或數值近似）。

**離散版本：** 對離散分布，把 CDF 建成累積和，產生 U，然後找出第一個累積和超過 U 的索引。單元 06 的 `sample_categorical` 就是這樣運作的。

### 拒絕取樣

當你無法反轉 CDF，但可以（在差一個常數的意義下）計算目標 PDF 的值時，拒絕取樣就派得上用場。

```
Target distribution: p(x)  (can evaluate, possibly unnormalized)
Proposal distribution: q(x)  (can sample from)
Bound: M such that p(x) <= M * q(x) for all x

Algorithm:
  1. Sample x ~ q(x)
  2. Sample u ~ Uniform(0, 1)
  3. If u < p(x) / (M * q(x)), accept x
  4. Otherwise, reject and go to step 1

Acceptance rate = 1/M
```

上界 M 越緊，接受率就越高。在低維度（1-3 維）時，拒絕取樣表現得很好。在高維度時，接受率會指數下降，因為提議分布的體積大部分都被拒絕掉了。這就是拒絕取樣的維度災難。

**例子：從截斷常態分布取樣。** 在截斷的範圍上用均勻提議分布。包絡常數 M 就是常態 PDF 在該範圍內的最大值。

**例子：從半圓形取樣。** 在外接矩形內均勻提議。如果點落在半圓內就接受。蒙地卡羅計算 pi 就是這樣做的：接受率剛好等於面積比 pi/4。

### 重要性取樣

有時候你並不需要目標分布 p(x) 的樣本。你要的是估計 p(x) 之下的某個期望值，而你手上有的是另一個分布 q(x) 的樣本。

```
Goal: estimate E_p[f(x)] = integral of f(x) * p(x) dx

Rewrite:
  E_p[f(x)] = integral of f(x) * (p(x)/q(x)) * q(x) dx
            = E_q[f(x) * w(x)]

where w(x) = p(x) / q(x)  are the importance weights.

Estimator:
  E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))    where x_i ~ q(x)
```

這在強化學習裡至關重要。在 PPO（Proximal Policy Optimization）裡，你用舊策略 pi_old 蒐集軌跡，但想最佳化的是新策略 pi_new。重要性權重就是 pi_new(a|s) / pi_old(a|s)。PPO 會把這些權重裁剪掉，避免新策略跑得離舊策略太遠。

重要性取樣估計量的變異數，取決於 q 跟 p 有多像。如果 q 跟 p 差很多，就會有少數幾個樣本拿到超大的權重，主導整個估計。自我正規化的重要性取樣會除以權重總和，來減輕這個問題：

```
E_p[f(x)] ~ sum(w_i * f(x_i)) / sum(w_i)
```

### 蒙地卡羅估計

蒙地卡羅估計用隨機樣本的平均來近似積分。大數法則保證它會收斂。

```
Goal: estimate I = integral of g(x) dx over domain D

Method:
  1. Sample x_1, ..., x_N uniformly from D
  2. I ~ (Volume of D / N) * sum(g(x_i))

Error: O(1 / sqrt(N))   regardless of dimension
```

誤差率跟維度無關。這就是為什麼在格點式積分根本做不到的高維度裡，蒙地卡羅方法佔了主導地位。

**估計 pi：**

```
Sample (x, y) uniformly from [-1, 1] x [-1, 1]
Count how many fall inside the unit circle: x^2 + y^2 <= 1
pi ~ 4 * (count inside) / (total count)
```

**估計期望值：**

```
E[f(X)] ~ (1/N) * sum(f(x_i))    where x_i ~ p(x)

The sample mean converges to the true expectation.
Variance of the estimator = Var(f(X)) / N
```

### 馬可夫鏈蒙地卡羅（MCMC）：Metropolis-Hastings

MCMC 建構一條馬可夫鏈，讓它的穩態分布就是目標分布 p(x)。走了足夠多步之後，鏈上的樣本（近似）就是 p(x) 的樣本。

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

對於對稱的提議分布（q(x'|x) = q(x|x')），這個比值會簡化成 p(x')/p(x)。這就是最原始的 Metropolis 演算法。

**它為什麼有效。** 接受規則保證了細緻平衡：待在 x 然後移動到 x' 的機率，等於待在 x' 然後移動到 x 的機率。細緻平衡意味著 p(x) 就是這條鏈的穩態分布。

**實務上的考量：**
- 燒機期：在鏈還沒到達平衡之前，把早期的樣本丟掉
- 稀釋（thinning）：每 k 個樣本只留一個，以降低自相關
- 提議分布的尺度：太小，鏈就移動得很慢（接受率高，但探索緩慢）；太大，大部分的提議都會被拒絕（接受率低，卡在原地動不了）
- 在高維度使用高斯提議分布時，最佳接受率大約是 0.234

### Gibbs 取樣

Gibbs 取樣是 MCMC 用在多變數分布上的一個特例。它不是一次在所有維度上提議一個移動，而是一次只從某個變數的條件分布更新那一個變數。

```
Target: p(x_1, x_2, ..., x_d)

Algorithm:
  For each iteration t:
    Sample x_1^{t+1} ~ p(x_1 | x_2^t, x_3^t, ..., x_d^t)
    Sample x_2^{t+1} ~ p(x_2 | x_1^{t+1}, x_3^t, ..., x_d^t)
    ...
    Sample x_d^{t+1} ~ p(x_d | x_1^{t+1}, x_2^{t+1}, ..., x_{d-1}^{t+1})
```

Gibbs 取樣要求你能從每一個條件分布 p(x_i | x_{-i}) 取樣。對很多模型來說這很直接：
- 貝氏網路：條件分布可以從圖的結構推出來
- 高斯混合：條件分布是高斯
- Ising 模型：每個自旋的條件分布只跟它的鄰居有關

接受率永遠是 1（每個提議都被接受），因為從精確的條件分布取樣本身就自動滿足細緻平衡。

**限制。** 當變數之間高度相關時，Gibbs 取樣混合得很慢，因為一次只更新一個變數，沒辦法在分布上做出大幅的對角移動。

### 溫度取樣（LLM 用的）

語言模型會為詞彙表裡的每個詞元輸出 logits z_1, ..., z_V。Softmax 把它們轉成機率。溫度則在 softmax 之前重新縮放 logits：

```
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0: standard softmax (original distribution)
T -> 0:  argmax (deterministic, always picks highest logit)
T -> inf: uniform (all tokens equally likely)
T < 1.0: sharpens the distribution (more confident, less diverse)
T > 1.0: flattens the distribution (less confident, more diverse)
```

**它為什麼有效。** 把 logits 除以 T < 1 會放大 logits 之間的差距。如果 z_1 = 2 而 z_2 = 1，除以 T = 0.5 就得到 z_1/T = 4 與 z_2/T = 2，差距變大了。經過 softmax 之後，logit 最高的詞元就拿到大得多的份額。

**實務上：**
- T = 0.0：貪婪解碼，最適合事實性的問答
- T = 0.3-0.7：稍有創意，適合程式碼生成
- T = 0.7-1.0：均衡，適合一般對話
- T = 1.0-1.5：創意寫作、腦力激盪
- T > 1.5：越來越隨機，很少有用

溫度不會改變哪些詞元有可能被選中。它改變的是分配給每個詞元的機率質量。

### Top-k 取樣

Top-k 取樣把候選集合限制在機率最高的 k 個詞元，然後重新正規化，再從這個受限的集合取樣。

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

Top-k 能防止模型選到那些極不可能的詞元（錯字、無意義的東西），它們就住在詞彙分布的長尾裡。問題是：k 是固定的，不管上下文如何。當模型很有信心時（某個詞元有 95% 的機率），k = 40 還是留下了 39 個替代選項。當模型不確定時（機率散在 1000 個詞元上），k = 40 又切掉了合理的選項。

### Top-p（Nucleus）取樣

Top-p 取樣會動態調整候選集合的大小。它不是保留固定數量的詞元，而是保留累積機率超過 p 的最小詞元集合。

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

當模型很有信心時，nucleus 取樣只留下少數幾個詞元（也許 2-3 個）。當模型不確定時，它會留下很多個（也許 200 個）。這種自適應的行為，就是 nucleus 取樣通常比 top-k 產生更好文字的原因。

**常見的組合：**
- 溫度 0.7 + top-p 0.9：不錯的通用設定
- 溫度 0.0（貪婪）：最適合決定性的任務
- 溫度 1.0 + top-k 50：Fan et al.（2018）原始論文的設定

Top-k 與 top-p 可以合併使用。先套用 top-k，再對剩下的集合套用 top-p。

### 重參數化技巧（VAE 用的）

變分自編碼器（VAE）的學習方式是：把輸入編碼成潛在空間裡的一個分布，從那個分布取樣，再把樣本解碼回來。問題是：你沒辦法讓梯度穿過取樣這個操作。

```
Standard sampling (not differentiable):
  z ~ N(mu, sigma^2)

  The randomness blocks gradient flow.
  d/d_mu [sample from N(mu, sigma^2)] = ???
```

重參數化技巧把隨機性從參數裡分離出來：

```
Reparameterized sampling:
  epsilon ~ N(0, 1)          (fixed random noise, no parameters)
  z = mu + sigma * epsilon   (deterministic function of parameters)

  Now z is a deterministic, differentiable function of mu and sigma.
  d(z)/d(mu) = 1
  d(z)/d(sigma) = epsilon

  Gradients flow through mu and sigma.
```

這之所以行得通，是因為 N(mu, sigma^2) 跟 mu + sigma * N(0, 1) 是同一個分布。關鍵的洞見是：把隨機性搬到一個不含參數的來源（epsilon），然後把樣本寫成參數的可微轉換。

**在 VAE 的訓練迴圈裡：**
1. 編碼器為每個輸入輸出 mu 與 log(sigma^2)
2. 取樣 epsilon ~ N(0, 1)
3. 計算 z = mu + sigma * epsilon
4. 把 z 解碼以重建輸入
5. 反向傳播穿過步驟 4、3、2、1（之所以做得到，是因為步驟 3 可微）

少了重參數化技巧，VAE 就沒辦法用標準的反向傳播來訓練。就是這一個洞見讓 VAE 變得實用。

### Gumbel-Softmax（可微的類別取樣）

重參數化技巧適用於連續分布（高斯）。對離散的類別分布，我們需要另一套做法。Gumbel-Softmax 提供了類別取樣的一個可微近似。

**Gumbel-Max 技巧（不可微）：**

```
To sample from a categorical distribution with log-probabilities log(p_1), ..., log(p_k):
  1. Sample g_i ~ Gumbel(0, 1) for each category
     (g = -log(-log(u)), where u ~ Uniform(0, 1))
  2. Return argmax(log(p_i) + g_i)

This produces exact categorical samples.
```

**Gumbel-Softmax（可微的近似）：**

```
Replace the hard argmax with a soft softmax:
  y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))

tau (temperature) controls the approximation:
  tau -> 0:  approaches a one-hot vector (hard categorical)
  tau -> inf: approaches uniform (1/k, 1/k, ..., 1/k)
  tau = 1.0: soft approximation
```

Gumbel-Softmax 產生的是離散樣本的連續鬆弛版本。輸出是一個機率向量（軟的 one-hot），而不是硬的 one-hot。梯度能穿過 softmax。訓練時的前向傳遞，你可以用「straight-through」估計量：前向傳遞用硬的 argmax，反向傳遞則用軟的 Gumbel-Softmax 梯度。

**應用：**
- VAE 裡的離散潛在變數
- 神經架構搜尋（挑選離散的運算）
- 硬性注意力機制
- 動作空間離散的強化學習

### 分層取樣

標準的蒙地卡羅取樣可能碰巧在樣本空間裡留下空隙。分層取樣把空間切成若干層，並從每一層取樣，強制做到均勻覆蓋。

```
Standard Monte Carlo:
  Sample N points uniformly from [0, 1]
  Some regions may have clusters, others gaps

Stratified sampling:
  Divide [0, 1] into N equal strata: [0, 1/N), [1/N, 2/N), ..., [(N-1)/N, 1)
  Sample one point uniformly within each stratum
  x_i = (i + u_i) / N   where u_i ~ Uniform(0, 1),  i = 0, ..., N-1
```

跟標準蒙地卡羅相比，分層取樣的變異數永遠更低或相等：

```
Var(stratified) <= Var(standard Monte Carlo)

The improvement is largest when f(x) varies smoothly.
For piecewise-constant functions, stratified sampling is exact.
```

**應用：**
- 數值積分（quasi-Monte Carlo）
- 訓練資料的切分（確保每一折的類別平衡）
- 帶分層的重要性取樣（兩種技巧併用）
- NeRF（Neural Radiance Fields）沿著相機射線使用分層取樣

### 跟擴散模型的關聯

擴散模型透過一個取樣過程來生成圖片。前向過程在 T 個步驟中不斷對圖片加入高斯雜訊，直到它變成純雜訊。反向過程學的則是去噪，一步一步把原始圖片還原回來。

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

它跟這個單元講的方法之間的關聯：
- 每一個去噪步驟都用到重參數化技巧（取樣雜訊，再套用決定性的轉換）
- 雜訊排程 {alpha_t} 控制的是某種形式的溫度退火
- 訓練用蒙地卡羅估計來近似 ELBO（證據下界）
- 擴散模型裡的祖先取樣就是一條馬可夫鏈（每一步只取決於當前的狀態）

整個圖片生成過程就是反覆取樣：從雜訊出發，每一步都在已學到的去噪模型的條件下，取樣出雜訊少一點的版本。

```figure
monte-carlo-pi
```

## 動手實作

### 步驟 1：均勻取樣與逆 CDF 取樣

```python
import math
import random

def sample_uniform(a, b):
    return a + (b - a) * random.random()

def sample_exponential_inverse_cdf(lam):
    u = random.random()
    return -math.log(u) / lam
```

產生 10,000 個指數分布的樣本，並驗證平均值是 1/lambda。

### 步驟 2：拒絕取樣

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

用拒絕取樣從截斷常態分布抽樣。把樣本畫成直方圖來驗證形狀。

### 步驟 3：重要性取樣

```python
def importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n):
    total = 0
    for _ in range(n):
        x = proposal_sample()
        w = target_pdf(x) / proposal_pdf(x)
        total += f(x) * w
    return total / n
```

用均勻提議分布來估計常態分布之下的 E[X^2]。跟已知的答案（mu^2 + sigma^2）比對。

### 步驟 4：用蒙地卡羅估計 pi

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

### 步驟 5：Metropolis-Hastings MCMC

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

從一個雙峰分布（兩個高斯的混合）取樣。把鏈的軌跡視覺化。

### 步驟 6：Gibbs 取樣

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

### 步驟 7：溫度取樣

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

用一組詞元的 logits，展示溫度怎麼改變輸出的分布。

### 步驟 8：Top-k 與 top-p 取樣

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

### 步驟 9：重參數化技巧

```python
def reparam_sample(mu, sigma):
    epsilon = random.gauss(0, 1)
    return mu + sigma * epsilon

def reparam_gradient(mu, sigma, epsilon):
    dz_dmu = 1.0
    dz_dsigma = epsilon
    return dz_dmu, dz_dsigma
```

示範梯度能穿過重參數化後的樣本，但穿不過直接取樣。

### 步驟 10：Gumbel-Softmax

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [math.log(p) + gumbel_sample() for p in logits]
    return softmax([g / temperature for g in gumbels])
```

展示溫度下降時，輸出怎麼逐漸趨近一個 one-hot 向量。

完整實作與所有視覺化都在 `code/sampling.py` 裡。

## 框架應用

有了 NumPy 與 SciPy，正式環境的版本長這樣：

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

要做大規模的 MCMC，請用專門的函式庫：
- PyMC：完整的貝氏建模，搭配 NUTS（自適應 HMC）
- emcee：ensemble MCMC 取樣器
- NumPyro/JAX：GPU 加速的 MCMC

這些你都從零打造過了。現在你知道那些函式庫的呼叫到底在做什麼。

## 練習

1. 為柯西分布實作逆 CDF 取樣。它的 CDF 是 F(x) = 0.5 + arctan(x)/pi。產生 10,000 個樣本，把直方圖跟真正的 PDF 畫在一起。注意它的厚尾（離中心很遠的極端值）。

2. 用 Uniform(0, 1) 作為提議分布，以拒絕取樣從 Beta(2, 5) 分布產生樣本。把接受的樣本跟真正的 Beta PDF 畫在一起。理論上的接受率是多少？

3. 分別用 1,000、10,000 與 100,000 個樣本，以蒙地卡羅估計 sin(x) 從 0 到 pi 的積分。比較每個層級的誤差。驗證誤差是以 O(1/sqrt(N)) 縮放的。

4. 實作 Metropolis-Hastings，從一個正比於 exp(-(x^2 * y^2 + x^2 + y^2 - 8*x - 8*y) / 2) 的二維分布 p(x, y) 取樣。畫出樣本與鏈的軌跡。試試不同的提議分布標準差。

5. 打造一個完整的文字生成示範：給定一個有 10 個詞、各自帶 logits 的詞彙表，分別用 (a) 貪婪、(b) temperature=0.7、(c) top-k=3、(d) top-p=0.9 生成 20 個詞元的序列。跑 5 次，比較輸出的多樣性。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|----------------|----------------------|
| 取樣 | 「抽隨機值」 | 依照某個機率分布產生數值。所有生成式 AI 背後的機制 |
| 均勻分布 | 「每個都一樣可能」 | [a, b] 裡每個值的機率密度都是 1/(b-a)。所有取樣方法的起點 |
| 逆 CDF | 「機率變換」 | F_inverse(U) 把一個均勻樣本轉成任何已知 CDF 的分布的樣本。精確又有效率 |
| 拒絕取樣 | 「提議然後接受／拒絕」 | 從一個簡單的提議分布產生樣本，以正比於目標／提議比值的機率接受。精確，但會浪費樣本 |
| 重要性取樣 | 「重新加權樣本」 | 用 q(x) 的樣本估計 p(x) 之下的期望值，每個樣本以 p(x)/q(x) 加權。RL 裡 PPO 的核心 |
| 蒙地卡羅 | 「把隨機樣本平均起來」 | 用樣本平均近似積分。誤差是 O(1/sqrt(N))，跟維度無關 |
| MCMC | 「會收斂的隨機漫步」 | 建構一條穩態分布就是目標分布的馬可夫鏈。Metropolis-Hastings 是最基礎的演算法 |
| Metropolis-Hastings | 「往上一定接受，往下有時也接受」 | 提議移動，依密度比值決定是否接受。細緻平衡保證收斂到目標分布 |
| Gibbs 取樣 | 「一次一個變數」 | 固定其他變數，從每個變數的條件分布更新它。接受率 100% |
| 溫度 | 「信心旋鈕」 | 在 softmax 之前把 logits 除以 T。T<1 讓分布更尖（更有信心），T>1 讓它更平（更多樣） |
| Top-k 取樣 | 「留下最好的 k 個」 | 除了機率最高的 k 個詞元外全部歸零，重新正規化再取樣。候選集合大小固定 |
| Nucleus 取樣（top-p） | 「留下可能的那些」 | 保留累積機率超過 p 的最小詞元集合。候選集合大小會自適應 |
| 重參數化技巧 | 「把隨機性搬到外面」 | 寫成 z = mu + sigma * epsilon，其中 epsilon ~ N(0,1)。讓取樣變得可微。訓練 VAE 的必備條件 |
| Gumbel-Softmax | 「軟性的類別取樣」 | 用 Gumbel 雜訊加上帶溫度的 softmax，做出類別取樣的可微近似 |
| 分層取樣 | 「強制覆蓋」 | 把樣本空間切成若干層，每層都取樣。變異數永遠低於天真的蒙地卡羅 |
| 燒機期 | 「暖機階段」 | MCMC 早期的樣本，在鏈到達穩態分布之前先丟掉 |
| 細緻平衡 | 「可逆性條件」 | p(x) * T(x->y) = p(y) * T(y->x)。是 p 成為某條馬可夫鏈穩態分布的充分條件 |
| 擴散取樣 | 「反覆去噪」 | 從雜訊出發，套用學到的去噪步驟來生成資料。每一步都是一次條件取樣操作 |

## 延伸閱讀

- [Holbrook (2023): The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010) —— MCMC 基礎的詳細教學
- [Jang, Gu, Poole (2017): Categorical Reparameterization with Gumbel-Softmax](https://arxiv.org/abs/1611.01144) —— Gumbel-Softmax 的原始論文
- [Holtzman et al. (2020): The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751) —— nucleus（top-p）取樣的論文
- [Kingma & Welling (2014): Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) —— 引入重參數化技巧的 VAE 論文
- [Ho, Jain, Abbeel (2020): Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) —— DDPM 把取樣跟圖片生成連起來
