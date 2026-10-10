# 抽樣方法

> 抽樣是 AI 探索各種可能性的方式。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 06-07 (Probability, Bayes' Theorem)
**Time:** ~120 minutes

## Learning Objectives｜學習目標

- 只用均勻亂數（uniform random numbers），從零實作反函數取樣（inverse CDF／inverse transform sampling）、拒絕取樣（rejection sampling）和重要性取樣（importance sampling）
- 為語言模型（language model）token 生成實作溫度取樣（temperature sampling）、top-k 取樣（top-k sampling）和 top-p（核取樣，nucleus sampling）
- 說明重參數化技巧（reparameterization trick）以及它如何讓變分自編碼器（variational autoencoder，VAE）讓梯度透過取樣步驟反向傳播（backpropagation）
- 執行 Metropolis-Hastings MCMC，從未正規化的目標分布（target distribution）取樣

## The Problem｜問題

語言模型處理完你的 prompt 後，會產生一個包含 50,000 個 logits 的向量。詞彙表（vocabulary）中的每個 token 都有一個 logit。現在它必須選出一個 token。要怎麼選？

如果它總是選機率最高的 token，每次回應都會一模一樣。結果固定、毫無變化。如果完全隨機地選，輸出就會是一堆亂碼。答案介於這兩個極端之間，而控制這個範圍的機制就是抽樣。

抽樣不只用於文字生成。強化學習（reinforcement learning）會透過抽樣軌跡（trajectory）估計策略梯度（policy gradient）。變分自編碼器會從學得的分布中抽樣，並透過隨機性反向傳播，藉此學習潛在表徵（latent representation）。擴散模型（diffusion model）會抽樣產生影像所需的雜訊，再逐步去除雜訊。蒙地卡羅（Monte Carlo）方法會估計沒有封閉解的積分。馬可夫鏈蒙地卡羅（Markov chain Monte Carlo，MCMC）演算法則會探索無法逐一列舉的高維後驗分布（posterior distribution）。

每個生成式 AI 系統都是抽樣系統。抽樣策略會決定輸出的品質、多樣性和可控性。本課會從零打造各種主要抽樣方法，從均勻亂數開始，一路介紹到推動現代大型語言模型（large language model，LLM）和生成模型的技術。

## The Concept｜核心概念

### 抽樣為何重要

抽樣在 AI 和機器學習中有四種基本用途：

**生成。** 語言模型、擴散模型和生成對抗網路（generative adversarial network，GAN）都透過抽樣產生輸出。抽樣演算法會直接控制創意、連貫性和多樣性。工程師每天都會調整溫度、top-k 和核取樣等參數。

**訓練。** 隨機梯度下降法（stochastic gradient descent）會抽樣選取小批次（mini-batch）。dropout 會抽樣選擇要停用的神經元。資料增強（data augmentation）會抽樣選擇隨機變換。在強化學習（PPO、TRPO）中，重要性取樣會重新加權樣本，以降低梯度變異數。

**估計。** 機器學習中的許多量沒有封閉解，例如資料分布上的期望損失、能量模型的配分函數（partition function）、貝氏推論（Bayesian inference）中的證據。蒙地卡羅估計會對樣本取平均，近似計算這些量。

**探索。** MCMC 演算法會探索貝氏推論中的後驗分布。演化策略會抽樣產生參數擾動。湯普森取樣（Thompson sampling）會在 bandit 中平衡探索與利用。

核心挑戰是：你只能直接從簡單分布（均勻分布（uniform distribution）、常態分布（normal distribution））取樣。其他情況下，你需要一種方法，將簡單分布的樣本變換成目標分布（target distribution）的樣本。

### 均勻隨機抽樣

均勻隨機抽樣（uniform random sampling）是所有抽樣方法的起點。均勻亂數產生器（uniform random number generator）會產生 [0, 1) 之間的數值，每個等長子區間的機率都相同。

```
U ~ Uniform(0, 1)

P(a <= U <= b) = b - a    for 0 <= a <= b <= 1

Properties:
  E[U] = 0.5
  Var(U) = 1/12
```

要從包含 n 個項目的離散集合均勻抽樣，先產生 U，再回傳 floor(n * U)。要從連續範圍 [a, b] 抽樣，則計算 a + (b - a) * U。

關鍵在於：一個均勻亂數就包含了產生任意分布中一個樣本所需的全部隨機性。關鍵是找到適當的變換方式。

### 反函數取樣

累積分布函數（cumulative distribution function，CDF）會將數值映射成機率：

```
F(x) = P(X <= x)

Properties:
  F is non-decreasing
  F(-inf) = 0
  F(+inf) = 1
  F maps the real line to [0, 1]
```

CDF 反函數（inverse CDF）會把機率映射回數值。如果 U ~ Uniform(0, 1)，那麼 X = F_inverse(U) 就會符合目標分布（target distribution）。

```
Algorithm:
  1. Generate u ~ Uniform(0, 1)
  2. Return F_inverse(u)

Why it works:
  P(X <= x) = P(F_inverse(U) <= x) = P(U <= F(x)) = F(x)
```

**指數分布範例：**

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

如果能寫出 CDF 反函數的封閉解，這個方法就能完美運作。常態分布沒有封閉形式的 CDF 反函數，因此要改用其他方法（Box-Muller 轉換（Box-Muller transform）或數值近似）。

**離散版本：**對離散分布（discrete distribution），先將機率累加成 CDF，產生 U，再找出累積和第一次超過 U 的索引。第 06 課的 `sample_categorical` 就是這樣運作。

### 拒絕取樣

如果你無法反轉 CDF，但能計算目標機率密度函數（probability density function，PDF，允許差一個常數），就可以使用拒絕取樣。

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

上界 M 越緊，接受率（acceptance rate）就越高。在低維度（1 至 3 維）時，拒絕取樣效果良好；在高維度時，接受率會呈指數下降，因為提議分布（proposal distribution）的大部分區域都會被拒絕。這就是拒絕取樣面臨的維度災難。

**範例：從截斷常態分布（truncated normal distribution）取樣。** 在截斷範圍內使用均勻分布作為提議分布。包絡上界 M 是該範圍內常態分布 PDF 的最大值。

**範例：從半圓取樣。** 在包住半圓的矩形內均勻提議樣本，若點落在半圓內就接受。蒙地卡羅方法便是這樣計算 pi：接受率等於面積比 pi/4。

### 重要性取樣

有時候你不需要從目標分布（target distribution） p(x) 取樣；你需要的是估計 p(x) 下的期望值（expectation），而你手上只有來自另一個分布 q(x) 的樣本。

```
Goal: estimate E_p[f(x)] = integral of f(x) * p(x) dx

Rewrite:
  E_p[f(x)] = integral of f(x) * (p(x)/q(x)) * q(x) dx
            = E_q[f(x) * w(x)]

where w(x) = p(x) / q(x)  are the importance weights.

Estimator:
  E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))    where x_i ~ q(x)
```

這在強化學習中非常重要。在近端策略最佳化（Proximal Policy Optimization，PPO）中，你根據舊策略 pi_old 收集軌跡，但想最佳化新策略 pi_new。重要性權重（importance weight）是 pi_new(a|s) / pi_old(a|s)。PPO 會裁剪這些權重，避免新策略偏離舊策略太多。

重要性取樣估計量（importance sampling estimator）的變異數取決於 q 和 p 有多相似。如果 q 和 p 差很多，少數樣本就會得到極大的重要性權重，主導整個估計。自我正規化重要性取樣（self-normalized importance sampling）會除以權重總和，以減輕這個問題：

```
E_p[f(x)] ~ sum(w_i * f(x_i)) / sum(w_i)
```

### 蒙地卡羅估計

蒙地卡羅估計（Monte Carlo estimation）會對隨機樣本取平均，近似計算積分。大數法則（law of large numbers）保證估計值會收斂。

```
Goal: estimate I = integral of g(x) dx over domain D

Method:
  1. Sample x_1, ..., x_N uniformly from D
  2. I ~ (Volume of D / N) * sum(g(x_i))

Error: O(1 / sqrt(N))   regardless of dimension
```

誤差率與維度無關。這就是為什麼在無法使用網格積分的高維空間中，蒙地卡羅方法佔優勢。

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

MCMC 會建立一條馬可夫鏈（Markov chain），使其平穩分布（stationary distribution）為目標分布（target distribution） p(x)。經過足夠多步後，鏈中的樣本就會近似來自 p(x)。

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

若使用對稱提議分布（q(x'|x) = q(x|x')），比率會簡化成 p(x')/p(x)。這就是原始的 Metropolis 演算法。

**原理。** 接受規則確保細緻平衡（detailed balance）：處於 x 並移動到 x' 的機率，等於處於 x' 並移動到 x 的機率。細緻平衡表示 p(x) 是該鏈的平穩分布（stationary distribution）。

**實務考量：**
- 暖身期（burn-in）：捨棄鏈尚未達到平衡前的早期樣本
- 抽稀（thinning）：每隔 k 個樣本保留一個，以降低自相關（autocorrelation）
- 提議尺度（proposal scale）：太小會讓鏈移動緩慢（接受率高，但探索速度慢）；太大則多數提議都會被拒絕（接受率低，鏈會卡住）
- 在高維度下，高斯提議分布（Gaussian proposal）的最佳接受率約為 0.234

### Gibbs 取樣

Gibbs 取樣（Gibbs sampling）是多變量分布中一種特殊的 MCMC 方法。它不會一次對所有維度提議移動，而是每次從條件分布（conditional distribution）更新一個變數。

```
Target: p(x_1, x_2, ..., x_d)

Algorithm:
  For each iteration t:
    Sample x_1^{t+1} ~ p(x_1 | x_2^t, x_3^t, ..., x_d^t)
    Sample x_2^{t+1} ~ p(x_2 | x_1^{t+1}, x_3^t, ..., x_d^t)
    ...
    Sample x_d^{t+1} ~ p(x_d | x_1^{t+1}, x_2^{t+1}, ..., x_{d-1}^{t+1})
```

Gibbs 取樣要求你能從每個條件分布 p(x_i | x_{-i}) 取樣。許多模型都很容易做到：
- 貝氏網路（Bayesian network）：條件分布可由圖結構推得
- 高斯混合模型（Gaussian mixture）：條件分布為常態分布（Gaussian distribution）
- 伊辛模型（Ising model）：每個自旋的條件分布只取決於它的鄰居

接受率永遠是 1（每個提議都會被接受），因為從精確的條件分布取樣會自動滿足細緻平衡。

**限制。** 當變數高度相關時，Gibbs 取樣的混合速度會很慢，因為一次只更新一個變數，無法沿著分布的對角方向大幅移動。

### 大型語言模型的溫度取樣（temperature sampling）

語言模型會為詞彙表中每個 token 輸出一個 logit z_1, ..., z_V。Softmax 會將這些 logits 轉成機率。溫度會在 softmax 前重新縮放 logits：

```
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0: standard softmax (original distribution)
T -> 0:  argmax (deterministic, always picks highest logit)
T -> inf: uniform (all tokens equally likely)
T < 1.0: sharpens the distribution (more confident, less diverse)
T > 1.0: flattens the distribution (less confident, more diverse)
```

**原理。** 當 T < 1 時，logits 除以 T 會放大彼此的差異。如果 z_1 = 2 且 z_2 = 1，以 T = 0.5 相除後，z_1/T = 4、z_2/T = 2，兩者的差距變大。經過 softmax 後，logit 最高的 token 就會分得更多機率。

**實務設定：**
- T = 0.0：貪婪解碼（greedy decoding），適合需要事實正確的問答
- T = 0.3-0.7：稍有創意，適合程式碼生成
- T = 0.7-1.0：較平衡，適合一般對話
- T = 1.0-1.5：適合創意寫作和腦力激盪
- T > 1.5：輸出會愈來愈隨機，通常不實用

溫度不會改變哪些 token 有可能出現，只會改變分配給各 token 的機率質量（probability mass）。

### Top-k 取樣

top-k 取樣（top-k sampling）會將候選集合限制為機率最高的 k 個 token，再重新正規化，並從中取樣。

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

top-k 可避免模型選到詞彙表長尾中極不可能出現的 token，例如錯字或無意義內容。問題在於 k 固定不變，不會依上下文調整。模型很有把握時（某個 token 的機率為 95%），k = 40 仍會保留 39 個替代選項；模型不確定時（機率分散在 1,000 個 token 上），k = 40 又會切掉許多合理選項。

### Top-p（核取樣）

top-p 取樣（top-p sampling），也稱核取樣（nucleus sampling），會動態調整候選集合的大小。它不保留固定數量的 token，而是保留累積機率超過 p 的最小 token 集合。

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

模型很有把握時，核取樣會只保留少數 token（可能只有 2 至 3 個）；模型不確定時，則會保留很多（可能有 200 個）。這種自適應特性讓核取樣通常比 top-k 產生更好的文字。

**常見組合：**
- 溫度 0.7 + top-p 0.9：適合一般用途
- 溫度 0.0（貪婪解碼）：最適合確定性任務
- 溫度 1.0 + top-k 50：Fan et al.（2018）原論文的設定

top-k 和 top-p 可以併用。先套用 top-k，再對剩餘集合套用 top-p。

### 重參數化技巧（VAE 使用）

變分自編碼器會將輸入編碼成潛在空間（latent space）中的分布，從中取樣，再將樣本解碼回原輸入。問題是：你無法透過取樣運算反向傳播。

```
Standard sampling (not differentiable):
  z ~ N(mu, sigma^2)

  The randomness blocks gradient flow.
  d/d_mu [sample from N(mu, sigma^2)] = ???
```

重參數化技巧會把隨機性和參數分開：

```
Reparameterized sampling:
  epsilon ~ N(0, 1)          (fixed random noise, no parameters)
  z = mu + sigma * epsilon   (deterministic function of parameters)

  Now z is a deterministic, differentiable function of mu and sigma.
  d(z)/d(mu) = 1
  d(z)/d(sigma) = epsilon

  Gradients flow through mu and sigma.
```

這樣可行，是因為 N(mu, sigma^2) 和 mu + sigma * N(0, 1) 的分布相同。關鍵在於把隨機性移到不含參數的來源（epsilon），再將樣本表示成參數的可微分變換。

**VAE 訓練迴圈：**
1. 編碼器（encoder）為每個輸入輸出 mu 和 log(sigma^2)
2. 抽樣取得 epsilon ~ N(0, 1)
3. 計算 z = mu + sigma * epsilon
4. 將 z 解碼，重建輸入
5. 透過步驟 4、3、2、1 反向傳播（可行，因為步驟 3 可微分）

沒有重參數化技巧，VAE 就無法用標準反向傳播訓練。這項關鍵發現讓 VAE 得以實際應用。

### 可微分類別取樣：Gumbel-Softmax

重參數化技巧適用於連續分布（例如高斯分布）。對離散的類別分布，我們需要不同方法。Gumbel-Softmax 提供一種可微分的類別取樣近似方法。

**Gumbel-Max 技巧（不可微分）：**

```
To sample from a categorical distribution with log-probabilities log(p_1), ..., log(p_k):
  1. Sample g_i ~ Gumbel(0, 1) for each category
     (g = -log(-log(u)), where u ~ Uniform(0, 1))
  2. Return argmax(log(p_i) + g_i)

This produces exact categorical samples.
```

**Gumbel-Softmax（可微分近似）：**

```
Replace the hard argmax with a soft softmax:
  y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))

tau (temperature) controls the approximation:
  tau -> 0:  approaches a one-hot vector (hard categorical)
  tau -> inf: approaches uniform (1/k, 1/k, ..., 1/k)
  tau = 1.0: soft approximation
```

Gumbel-Softmax 會對離散樣本做連續鬆弛（continuous relaxation）。輸出是機率向量（soft one-hot），而不是硬式 one-hot 向量（one-hot vector）。梯度可以透過 softmax 傳遞。訓練時，在前向傳遞可以使用「直通估計器（straight-through estimator）」：前向傳遞使用硬式 argmax，但反向傳遞使用 soft Gumbel-Softmax 的梯度。

**應用：**
- VAE 中的離散潛在變數
- 神經架構搜尋（neural architecture search；選擇離散運算）
- 硬式注意力（hard attention）機制
- 使用離散動作的強化學習

### 分層抽樣

一般蒙地卡羅抽樣可能因為機率因素而在樣本空間中留下空隙。分層抽樣（stratified sampling）會把空間分成多個層（strata），再從每一層取樣，確保各區域都有覆蓋。

```
Standard Monte Carlo:
  Sample N points uniformly from [0, 1]
  Some regions may have clusters, others gaps

Stratified sampling:
  Divide [0, 1] into N equal strata: [0, 1/N), [1/N, 2/N), ..., [(N-1)/N, 1)
  Sample one point uniformly within each stratum
  x_i = (i + u_i) / N   where u_i ~ Uniform(0, 1),  i = 0, ..., N-1
```

和一般蒙地卡羅相比，分層抽樣的變異數一定較低或相等：

```
Var(stratified) <= Var(standard Monte Carlo)

The improvement is largest when f(x) varies smoothly.
For piecewise-constant functions, stratified sampling is exact.
```

**應用：**
- 數值積分（準蒙地卡羅（quasi-Monte Carlo））
- 訓練資料切分（確保每個折中的類別平衡（class balance））
- 結合重要性取樣與分層抽樣
- NeRF（神經輻射場，Neural Radiance Fields）會沿著相機光線使用分層抽樣

### 與擴散模型的關聯

擴散模型會透過抽樣過程生成影像。前向過程（forward process）會在 T 個步驟中逐步對影像加入高斯雜訊（Gaussian noise），直到影像變成純雜訊。反向過程（reverse process）會學習如何逐步去除雜訊，還原原始影像。

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

與本課方法的關聯：
- 每個去雜訊步驟都使用重參數化技巧（抽樣雜訊，再套用確定性變換）
- 雜訊排程（noise schedule）{alpha_t} 控制一種溫度退火（temperature annealing）
- 訓練使用蒙地卡羅估計近似 ELBO（evidence lower bound）
- 擴散模型中的祖先取樣（ancestral sampling）是一條馬可夫鏈（每一步只取決於目前狀態）

整個影像生成過程都是反覆抽樣：從雜訊開始，每一步都根據學得的去雜訊模型，抽樣產生較少雜訊的版本。

```figure
monte-carlo-pi
```

## Build It｜動手實作

### 步驟 1：均勻與反函數取樣

```python
import math
import random

def sample_uniform(a, b):
    return a + (b - a) * random.random()

def sample_exponential_inverse_cdf(lam):
    u = random.random()
    return -math.log(u) / lam
```

產生 10,000 個指數分布樣本，確認平均數為 1/lambda。

### 步驟 2：拒絕取樣

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

使用拒絕取樣，從截斷常態分布取樣。將樣本繪製成直方圖，確認分布形狀。

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

用均勻分布作為提議分布，估計常態分布下的 E[X^2]，並和已知答案（mu^2 + sigma^2）比較。

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

從雙峰分布（bimodal distribution；兩個常態分布的混合）取樣，並將鏈的移動軌跡視覺化。

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

### 步驟 7：溫度取樣（temperature sampling）

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

展示溫度如何改變一組 token logits 的輸出分布。

### 步驟 8：top-k 和 top-p 取樣

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

展示梯度如何透過重參數化樣本傳遞，但無法透過直接取樣傳遞。

### 步驟 10：Gumbel-Softmax

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [math.log(p) + gumbel_sample() for p in logits]
    return softmax([g / temperature for g in gumbels])
```

展示溫度降低時，輸出如何趨近 one-hot 向量。

所有視覺化的完整實作都在 `code/sampling.py`。

## Use It｜實際應用

使用 NumPy 和 SciPy 的正式版本：

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

若要大規模執行 MCMC，可使用專用函式庫：
- PyMC：完整的貝氏建模，支援 NUTS（自適應 HMC）
- emcee：集成式 MCMC 取樣器（ensemble MCMC sampler）
- NumPyro/JAX：GPU 加速的 MCMC

你已經從零打造過這些方法，現在知道函式庫呼叫背後做了什麼。

## Exercises｜練習

1. 為柯西分布（Cauchy distribution）實作反函數取樣。其 CDF 為 F(x) = 0.5 + arctan(x)/pi。產生 10,000 個樣本，將直方圖和真實 PDF 比較。觀察厚尾（距中心很遠的極端值）。

2. 以 Uniform(0, 1) 均勻分布作為提議分布，以拒絕取樣產生 Beta(2, 5) 分布（Beta distribution）的樣本。將接受的樣本和真實 Beta PDF 比較。理論上的接受率是多少？

3. 用蒙地卡羅方法分別取 1,000、10,000 和 100,000 個樣本，估計 sin(x) 在 0 到 pi 之間的積分。比較各個樣本數的誤差，並確認誤差以 O(1/sqrt(N)) 的速度縮小。

4. 實作 Metropolis-Hastings，從與 exp(-(x^2 * y^2 + x^2 + y^2 - 8*x - 8*y) / 2) 成正比的二維分布 p(x, y) 取樣。繪製樣本和鏈的移動軌跡，並試試不同的提議標準差。

5. 建立完整的文字生成示範：給定一個含 10 個詞且各有 logits 的詞彙表，分別用（a）貪婪解碼、（b）溫度 = 0.7、（c）top-k = 3、（d）top-p = 0.9 產生 20 個 token 的序列。比較 5 次執行的輸出多樣性。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|---|---|---|
| 抽樣（sampling） |「抽取隨機值」| 根據機率分布產生數值，是所有生成式 AI 背後的機制。 |
| 均勻分布（uniform distribution） |「每個結果機率相同」| [a, b] 中每個數值的機率密度都是 1/(b-a)，是所有抽樣方法的起點。 |
| CDF 反函數（inverse CDF） |「機率變換」| F_inverse(U) 會將均勻分布樣本變換為 CDF 已知的目標分布（target distribution）樣本，精確且有效率。 |
| 拒絕取樣（rejection sampling） |「提議後接受或拒絕」| 從簡單的提議分布取樣，依目標分布（target distribution）與提議分布的比率決定接受機率。精確，但會浪費樣本。 |
| 重要性取樣（importance sampling） |「重新加權樣本」| 使用 q(x) 的樣本，透過 p(x)/q(x) 為每個樣本加權，估計 p(x) 下的期望值，是強化學習 PPO 的核心方法。 |
| 蒙地卡羅（Monte Carlo） |「隨機樣本取平均」| 將積分近似為樣本平均；誤差為 O(1/sqrt(N))，與維度無關。 |
| MCMC |「會收斂的隨機漫步」| 建立平穩分布（stationary distribution）為目標分布（target distribution）的馬可夫鏈；Metropolis-Hastings 是基礎演算法。 |
| Metropolis-Hastings |「向上就接受，向下有時也接受」| 提議移動，並依密度比率決定是否接受；細緻平衡確保鏈收斂到目標分布（target distribution）。 |
| Gibbs 取樣（Gibbs sampling） |「一次更新一個變數」| 固定其他變數，從該變數的條件分布更新它；接受率為 100%。 |
| 溫度（temperature） |「控制信心的旋鈕」| 在 softmax 前將 logits 除以 T；T < 1 會使分布更尖銳（信心更高），T > 1 則會使分布更平坦（多樣性更高）。 |
| top-k 取樣（top-k sampling） |「保留最好的 k 個」| 除最高機率的 k 個 token 外，將其他機率設為零，再重新正規化並取樣。候選集合大小固定。 |
| 核取樣（nucleus sampling，top-p） |「保留可能性高的項目」| 保留累積機率超過 p 的最小 token 集合，候選集合大小會依情況調整。 |
| 重參數化技巧（reparameterization trick） |「把隨機性移到外部」| 將 z 寫成 mu + sigma * epsilon，其中 epsilon ~ N(0,1)，讓取樣過程可微分，是訓練 VAE 的關鍵。 |
| Gumbel-Softmax |「軟式類別取樣」| 使用 Gumbel 雜訊和帶溫度的 softmax，對類別取樣提供可微分近似。 |
| 分層抽樣（stratified sampling） |「強制涵蓋各區域」| 將樣本空間分層，再從每層抽樣；變異數一定低於或等於一般蒙地卡羅方法。 |
| 暖身期（burn-in） |「熱身階段」| MCMC 鏈達到平穩分布（stationary distribution）前捨棄的初始樣本。 |
| 細緻平衡（detailed balance） |「可逆條件」| p(x) * T(x->y) = p(y) * T(y->x)，是 p 成為馬可夫鏈平穩分布（stationary distribution）的充分條件。 |
| 擴散取樣（diffusion sampling） |「反覆去除雜訊」| 從雜訊開始，透過學得的去雜訊步驟生成資料；每一步都是條件取樣。 |

## Further Reading｜延伸閱讀

- [Holbrook (2023): The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010) - MCMC 基礎的詳細教學
- [Jang, Gu, Poole (2017): Categorical Reparameterization with Gumbel-Softmax](https://arxiv.org/abs/1611.01144) - Gumbel-Softmax 原始論文
- [Holtzman et al. (2020): The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751) - 核取樣（top-p）論文
- [Kingma & Welling (2014): Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) - 提出重參數化技巧的 VAE 論文
- [Ho, Jain, Abbeel (2020): Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) - 將抽樣連結到影像生成的 DDPM
