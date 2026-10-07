# 取樣方法

> 取樣是 AI 探索各種可能性的方式。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 06-07 (Probability, Bayes' Theorem)
**Time:** ~120 minutes

## Learning Objectives｜學習目標

- 只使用均勻隨機數，從頭實作反 CDF、拒絕取樣與重要性取樣
- 為語言模型 token 生成實作溫度、top-k 與 top-p（核取樣）
- 說明重參數化技巧，以及它為何能讓 VAE 透過取樣進行反向傳播
- 執行 Metropolis-Hastings MCMC，從未正規化的目標分布取樣

## The Problem｜問題

語言模型處理完提示後，產生一個包含 50,000 個 logits 的向量，詞彙表中的每個 token 對應一個 logit。接下來要從中選一個。怎麼選？

如果每次都選機率最高的 token，回答就會一模一樣：具決定性，也很無聊。如果均勻隨機選取，輸出就會變成亂碼。答案介於這兩個極端之間，而取樣決定了如何取得這個平衡。

取樣不只用於文字生成。強化學習會透過取樣軌跡估計策略梯度；VAE 會從學得的分布取樣潛在表示，並透過隨機性反向傳播；擴散模型透過取樣噪聲並逐步去噪來生成影像；蒙地卡羅方法用來估計沒有封閉形式解的積分；MCMC 演算法則探索無法逐一列舉的高維後驗分布。

每個生成式 AI 系統都是取樣系統。取樣策略會決定輸出的品質、多樣性與可控制性。本課程會從均勻隨機數出發，從頭建構各種主要取樣方法，最後介紹現代 LLM 與生成模型所使用的技巧。

## The Concept｜核心概念

### 為什麼取樣很重要

取樣在 AI 與機器學習中有四種基本用途：

**生成。** 語言模型、擴散模型與 GAN 都透過取樣產生輸出。取樣演算法直接控制創意、一致性與多樣性。溫度、top-k 與核取樣是工程師每天會調整的參數。

**訓練。** 隨機梯度下降會抽取小批次；Dropout 會抽樣決定停用哪些神經元；資料增強會抽取隨機轉換。重要性取樣會重新加權樣本，降低強化學習（PPO、TRPO）中的梯度變異。

**估計。** 機器學習中的許多量沒有封閉形式解，例如資料分布上的期望損失、基於能量模型的配分函數，以及貝氏推論中的證據。蒙地卡羅估計會對樣本取平均，近似這些量。

**探索。** 貝氏推論中的 MCMC 演算法會探索後驗分布；演化策略會取樣參數擾動；Thompson sampling 則會在多臂賭博機中平衡探索與利用。

核心挑戰是：你只能直接從簡單分布（均勻、常態）取樣。若要從其他分布取樣，就需要將簡單分布的樣本轉換成目標分布的樣本。

### 均勻隨機取樣

所有取樣方法都從這裡開始。均勻隨機數產生器會產生 [0, 1) 之間的數值，其中每個等長子區間的機率相同。

```text
U ~ Uniform(0, 1)

P(a <= U <= b) = b - a    當 0 <= a <= b <= 1

性質：
  E[U] = 0.5
  Var(U) = 1/12
```

若要從含 n 個項目的離散集合中均勻取樣，先產生 U，再回傳 floor(n * U)。若要從連續範圍 [a, b] 取樣，則計算 a + (b - a) * U。

重要觀念：單一均勻隨機數就含有足夠且恰當的隨機性，可用來從任意分布產生一個樣本。關鍵在於找到合適的轉換方式。

### 反 CDF 方法（反變換取樣）

累積分布函數（CDF）會將數值映射為機率：

```text
F(x) = P(X <= x)

性質：
  F 為非遞減函數
  F(-inf) = 0
  F(+inf) = 1
  F 將實數映射到 [0, 1]
```

反 CDF 會將機率映射回數值。如果 U ~ Uniform(0, 1)，那麼 X = F_inverse(U) 就符合目標分布。

```text
演算法：
  1. 產生 u ~ Uniform(0, 1)
  2. 回傳 F_inverse(u)

原理：
  P(X <= x) = P(F_inverse(U) <= x) = P(U <= F(x)) = F(x)
```

**指數分布範例：**

```text
PDF：f(x) = lambda * exp(-lambda * x)，x >= 0
CDF：F(x) = 1 - exp(-lambda * x)

令 F(x) = u，解出 x：
  u = 1 - exp(-lambda * x)
  exp(-lambda * x) = 1 - u
  x = -ln(1 - u) / lambda

由於 (1 - U) 與 U 的分布相同：
  x = -ln(u) / lambda
```

如果能以封閉形式寫出 F_inverse，這個方法就能完美運作。常態分布沒有封閉形式的反 CDF，因此我們會改用其他方法（Box-Muller 或數值近似）。

**離散版本：**對離散分布，先以累積總和建立 CDF，再產生 U，找出累積總和第一次超過 U 的索引。第 06 課的 `sample_categorical` 就是這樣運作。

### 拒絕取樣

當你無法反轉 CDF，但能計算目標 PDF（可能只知道未正規化值）時，可以使用拒絕取樣。

```text
目標分布：p(x)（可計算，可能尚未正規化）
提議分布：q(x)（可從中取樣）
界限：對所有 x，p(x) <= M * q(x)

演算法：
  1. 取樣 x ~ q(x)
  2. 取樣 u ~ Uniform(0, 1)
  3. 若 u < p(x) / (M * q(x))，接受 x
  4. 否則拒絕，回到步驟 1

接受率 = 1/M
```

界限 M 越緊，接受率就越高。在低維度（1 到 3 維）中，拒絕取樣效果不錯；在高維度中，大部分提議樣本都會被拒絕，接受率會呈指數下降。這就是拒絕取樣所面臨的維度災難。

**範例：從截斷常態分布取樣。**在截斷範圍中使用均勻提議分布，包絡上限 M 是該範圍內常態 PDF 的最大值。

**範例：從半圓取樣。**在外接矩形中均勻提出樣本，點落在半圓內才接受。蒙地卡羅法也以此估計 pi：接受率等於面積比例 pi/4。

### 重要性取樣

有時你不需要從目標分布 p(x) 取樣，而是要估計 p(x) 下的期望值，手邊卻只有從另一個分布 q(x) 取得的樣本。

```text
目標：估計 E_p[f(x)] = f(x) * p(x) 對 x 的積分

改寫後：
  E_p[f(x)] = f(x) * (p(x)/q(x)) * q(x) 對 x 的積分
            = E_q[f(x) * w(x)]

其中 w(x) = p(x) / q(x)，稱為重要性權重。

估計量：
  E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))，其中 x_i ~ q(x)
```

這在強化學習中非常重要。在 PPO（Proximal Policy Optimization，近端策略最佳化）中，你會根據舊策略 pi_old 收集軌跡，卻想最佳化新策略 pi_new。重要性權重是 pi_new(a|s) / pi_old(a|s)。PPO 會裁切這些權重，避免新策略偏離舊策略太遠。

重要性取樣估計量的變異取決於 q 與 p 有多相似。如果 q 與 p 差異很大，少數樣本會得到極大的權重，並主導估計結果。自正規化重要性取樣會將加權總和除以權重總和，以減輕這個問題：

```text
E_p[f(x)] ~ sum(w_i * f(x_i)) / sum(w_i)
```

### 蒙地卡羅估計

蒙地卡羅估計會對隨機樣本取平均，以近似積分。大數法則保證估計值會收斂。

```text
目標：估計定義域 D 上 g(x) 的積分 I

方法：
  1. 從 D 中均勻取樣 x_1, ..., x_N
  2. I ~（D 的體積 / N）* sum(g(x_i))

誤差：O(1 / sqrt(N))，與維度無關
```

誤差率與維度無關，因此在無法使用網格積分的高維空間中，蒙地卡羅方法特別有效。

**估計 pi：**

```text
從 [-1, 1] x [-1, 1] 均勻取樣 (x, y)
計算落在單位圓內的點數：x^2 + y^2 <= 1
pi ~ 4 *（圓內點數）/（總點數）
```

**估計期望值：**

```text
E[f(X)] ~ (1/N) * sum(f(x_i))，其中 x_i ~ p(x)

樣本平均會收斂至真實期望值。
估計量的變異數 = Var(f(X)) / N
```

### 馬可夫鏈蒙地卡羅（MCMC）：Metropolis-Hastings

MCMC 會建立一條馬可夫鏈，使其穩態分布等於目標分布 p(x)。經過足夠步數後，鏈中的樣本就會近似來自 p(x)。

```text
目標：p(x)（已知到一個正規化常數）
提議：q(x'|x)（根據目前狀態提議下一個狀態的方式）

Metropolis-Hastings 演算法：
  1. 從某個 x_0 開始
  2. 對 t = 1, 2, ..., T：
     a. 提議 x' ~ q(x'|x_t)
     b. 計算接受比率：
        alpha = [p(x') * q(x_t|x')] / [p(x_t) * q(x'|x_t)]
     c. 以 min(1, alpha) 的機率接受：
        - 若 u < alpha（u ~ Uniform(0,1)）：x_{t+1} = x'
        - 否則：x_{t+1} = x_t
  3. 捨棄前 B 個樣本（暖身期）
  4. 回傳剩餘樣本
```

對稱提議分布（q(x'|x) = q(x|x')）下，接受比率會簡化為 p(x')/p(x)。這就是原始的 Metropolis 演算法。

**原理。** 接受規則會確保細緻平衡：從 x 移動到 x' 的機率，等於從 x' 移動到 x 的機率。細緻平衡代表 p(x) 是這條鏈的穩態分布。

**實務注意事項：**
- 暖身期：捨棄鏈尚未達到平衡前的初始樣本
- 稀疏抽樣：每隔 k 個樣本才保留一個，以降低自相關
- 提議尺度：尺度太小，鏈移動緩慢（接受率高，但探索慢）；尺度太大，多數提議會被拒絕（接受率低，鏈停滯）
- 高維空間中的常態提議分布，最佳接受率約為 0.234

### Gibbs 取樣

Gibbs 取樣是用於多變量分布的 MCMC 特例。它不會一次提議所有維度的移動，而是每次從條件分布更新一個變數。

```text
目標：p(x_1, x_2, ..., x_d)

演算法：
  每次迭代 t：
    取樣 x_1^{t+1} ~ p(x_1 | x_2^t, x_3^t, ..., x_d^t)
    取樣 x_2^{t+1} ~ p(x_2 | x_1^{t+1}, x_3^t, ..., x_d^t)
    ...
    取樣 x_d^{t+1} ~ p(x_d | x_1^{t+1}, x_2^{t+1}, ..., x_{d-1}^{t+1})
```

Gibbs 取樣要求你能從每個條件分布 p(x_i | x_{-i}) 取樣。許多模型都能直接做到：
- 貝氏網路：條件分布由圖結構決定
- 高斯混合模型：條件分布是常態分布
- Ising 模型：每個自旋的條件分布只取決於相鄰自旋

接受率一定是 1（每個提議都會接受），因為從精確條件分布取樣本身就符合細緻平衡。

**限制。** 變數高度相關時，Gibbs 取樣會混合得很慢，因為一次只更新一個變數，無法沿著分布的大斜向移動。

### 溫度取樣（用於 LLM）

語言模型會為詞彙表中的每個 token 輸出 logits z_1, ..., z_V。Softmax 將它們轉為機率；溫度則會在 softmax 前重新縮放 logits：

```text
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0：標準 softmax（原始分布）
T -> 0：  argmax（確定性，每次都選最高 logit）
T -> inf：均勻分布（所有 token 的機率相同）
T < 1.0：分布變尖銳（更有把握、更多樣性較低）
T > 1.0：分布變平坦（較不確定、更多樣）
```

**原理。** 當 T < 1 時，logits 除以 T 會放大彼此差異。若 z_1 = 2、z_2 = 1，以 T = 0.5 相除後，z_1/T = 4、z_2/T = 2，差距就變大。經過 softmax 後，最高 logit 的 token 會取得大得多的機率。

**實務設定：**
- T = 0.0：貪婪解碼，適合事實問答
- T = 0.3–0.7：稍有創意，適合程式碼生成
- T = 0.7–1.0：較平衡，適合一般對話
- T = 1.0–1.5：適合創意寫作與腦力激盪
- T > 1.5：隨機性愈來愈高，通常不實用

溫度不會改變哪些 token 可能出現，只會改變分配給各 token 的機率質量。

### Top-k 取樣

Top-k 取樣會將候選集合限制為機率最高的 k 個 token，接著重新正規化，並從這個集合中取樣。

```text
演算法：
  1. 計算全部 V 個 token 的 softmax 機率
  2. 依機率由高至低排序 token
  3. 只保留機率最高的 k 個 token
  4. 重新正規化：p_i' = p_i / sum(p_j for j in top-k)
  5. 從重新正規化後的分布取樣

k = 1：貪婪解碼
k = V：不過濾（標準取樣）
k = 40：常見設定，去除長尾中的低機率 token
```

Top-k 能避免模型選到詞彙分布長尾中機率極低的 token（錯字、無意義內容）。問題是 k 不會依情境改變。模型很有把握（某個 token 機率為 95%）時，k = 40 仍會保留 39 個替代選項；模型不確定（機率分散在 1000 個 token）時，k = 40 又會刪去許多合理選項。

### Top-p（核）取樣

Top-p 取樣會動態調整候選集合大小。它不會保留固定數量的 token，而是保留累積機率超過 p 的最小 token 集合。

```text
演算法：
  1. 計算全部 V 個 token 的 softmax 機率
  2. 依機率由高至低排序 token
  3. 找出最小的 k，使 top-k 機率總和 >= p
  4. 只保留這 k 個 token
  5. 重新正規化後取樣

p = 0.9：保留累積機率涵蓋 90% 的 token
p = 1.0：不過濾
p = 0.1：限制非常嚴格，接近貪婪解碼
```

模型很有把握時，核取樣只會保留少數 token（可能 2 到 3 個）；模型不確定時，則會保留更多（可能 200 個）。這種自適應方式，讓核取樣通常能比 top-k 產生更好的文字。

**常見組合：**
- 溫度 0.7 + top-p 0.9：適合一般用途
- 溫度 0.0（貪婪解碼）：適合需要確定性結果的任務
- 溫度 1.0 + top-k 50：Fan 等人（2018）原始論文中的設定

Top-k 與 top-p 可以合併使用。先套用 top-k，再對剩餘集合套用 top-p。

### 重參數化技巧（用於 VAE）

變分自編碼器（VAE）會將輸入編碼為潛在空間中的分布，從中取樣，再解碼樣本。問題是：你無法透過取樣運算進行反向傳播。

```text
標準取樣（不可微分）：
  z ~ N(mu, sigma^2)

  隨機性會阻斷梯度傳遞。
  d/d_mu [從 N(mu, sigma^2) 取樣] = ???
```

重參數化技巧會將隨機性與參數分開：

```text
重參數化取樣：
  epsilon ~ N(0, 1)          （固定隨機雜訊，不含參數）
  z = mu + sigma * epsilon   （參數的確定性函數）

  現在 z 是 mu 與 sigma 的確定性可微分函數。
  d(z)/d(mu) = 1
  d(z)/d(sigma) = epsilon

  梯度可透過 mu 與 sigma 傳遞。
```

這是因為 N(mu, sigma^2) 與 mu + sigma * N(0, 1) 具有相同分布。關鍵想法是：將隨機性移到不含參數的來源（epsilon），再把樣本寫成參數的可微分轉換。

**VAE 訓練迴圈：**
1. 編碼器為每個輸入輸出 mu 與 log(sigma^2)
2. 取樣 epsilon ~ N(0, 1)
3. 計算 z = mu + sigma * epsilon
4. 解碼 z，重建輸入
5. 依序對步驟 4、3、2、1 反向傳播（因步驟 3 可微分，所以能做到）

若沒有重參數化技巧，就無法使用標準反向傳播訓練 VAE。這個關鍵想法讓 VAE 得以實際應用。

### Gumbel-Softmax（可微分類別取樣）

重參數化技巧適用於連續分布（常態分布）。對離散類別分布則需要另一種方法。Gumbel-Softmax 提供可微分的類別取樣近似。

**Gumbel-Max 技巧（不可微分）：**

```text
從對數機率 log(p_1), ..., log(p_k) 所定義的類別分布取樣：
  1. 為每個類別取樣 g_i ~ Gumbel(0, 1)
     （g = -log(-log(u))，其中 u ~ Uniform(0, 1)）
  2. 回傳 argmax(log(p_i) + g_i)

這會產生精確的類別樣本。
```

**Gumbel-Softmax（可微分近似）：**

```text
以 soft softmax 取代硬式 argmax：
  y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))

tau（溫度）控制近似程度：
  tau -> 0：趨近 one-hot 向量（硬式類別）
  tau -> inf：趨近均勻分布（1/k, 1/k, ..., 1/k）
  tau = 1.0：soft 近似
```

Gumbel-Softmax 會將離散樣本放寬成連續值。輸出是機率向量（soft one-hot），而不是硬式 one-hot；梯度可以透過 softmax 傳遞。訓練的前向傳播時，可使用「直通」估計量：前向傳播採用硬式 argmax，反向傳播則採用 soft Gumbel-Softmax 的梯度。

**應用：**
- VAE 中的離散潛在變數
- 神經架構搜尋（選擇離散運算）
- 硬式注意力機制
- 使用離散動作的強化學習

### 分層取樣

標準蒙地卡羅取樣可能會碰巧在樣本空間留下空隙。分層取樣會先將空間切成多個層，再從每一層取樣，確保涵蓋範圍均勻。

```text
標準蒙地卡羅取樣：
  從 [0, 1] 均勻取樣 N 個點
  某些區域可能樣本聚集，其他區域卻有空隙

分層取樣：
  將 [0, 1] 分成 N 個等長區段：[0, 1/N)、[1/N, 2/N)、...、[(N-1)/N, 1)
  在每個區段內均勻取樣一個點
  x_i = (i + u_i) / N，其中 u_i ~ Uniform(0, 1)，i = 0, ..., N-1
```

與標準蒙地卡羅方法相比，分層取樣的變異數一定較低或相同：

```text
Var（分層取樣） <= Var（標準蒙地卡羅）

當 f(x) 平滑變動時，改善幅度最大。
對分段常數函數而言，分層取樣可得到精確結果。
```

**應用：**
- 數值積分（準蒙地卡羅）
- 訓練資料切分（確保每折的類別比例相近）
- 結合分層的重要性取樣（同時使用兩種技巧）
- NeRF（神經輻射場）沿相機射線進行分層取樣

### 與擴散模型的關聯

擴散模型透過取樣程序生成影像。前向程序會在 T 步中不斷對影像加入高斯雜訊，直到變成純雜訊；反向程序則學習去除雜訊，一步步還原原始影像。

```text
前向程序（已知）：
  x_t = sqrt(alpha_t) * x_{t-1} + sqrt(1 - alpha_t) * epsilon
  其中 epsilon ~ N(0, I)

  經過 T 步後：x_T ~ N(0, I)（純雜訊）

反向程序（學得）：
  x_{t-1} = (1/sqrt(alpha_t)) * (x_t - (1 - alpha_t)/sqrt(1 - alpha_bar_t) * epsilon_theta(x_t, t)) + sigma_t * z
  其中 z ~ N(0, I)

  每一步去噪都是一次取樣。
```

與本課取樣方法的關聯：
- 每一步去噪都使用重參數化技巧（取樣雜訊，再套用確定性轉換）
- 雜訊排程 {alpha_t} 控制一種類似溫度退火的過程
- 訓練時使用蒙地卡羅估計近似 ELBO（證據下界）
- 擴散模型的祖先取樣是一條馬可夫鏈（每一步只依賴目前狀態）

整個影像生成過程是反覆取樣：從雜訊開始，每一步都根據學得的去噪模型取樣，得到稍微乾淨一些的版本。

```figure
monte-carlo-pi
```

## Build It

### 步驟 1：均勻取樣與反 CDF 取樣

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

使用拒絕取樣從截斷常態分布產生樣本，再繪製直方圖確認分布形狀。

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

使用均勻提議分布，估計常態分布下的 E[X^2]，並與已知答案（mu^2 + sigma^2）比較。

### 步驟 4：以蒙地卡羅估計 pi

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

從雙峰分布（兩個常態分布的混合）取樣，並繪製鏈的移動軌跡。

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

展示溫度如何改變一組 token logits 的輸出分布。

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

示範梯度如何透過重參數化樣本傳遞，以及直接取樣為何無法傳遞梯度。

### 步驟 10：Gumbel-Softmax

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [math.log(p) + gumbel_sample() for p in logits]
    return softmax([g / temperature for g in gumbels])
```

展示溫度降低時，輸出如何逐漸接近 one-hot 向量。

完整實作與所有視覺化請見 `code/sampling.py`。

## Use It

以下是搭配 NumPy 與 SciPy 的正式環境版本：

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

若要大規模執行 MCMC，請使用專用函式庫：
- PyMC：使用 NUTS（自適應 HMC）進行完整的貝氏建模
- emcee：集成式 MCMC 取樣器
- NumPyro/JAX：使用 GPU 加速 MCMC

你已經從頭實作過這些方法，現在能理解函式庫呼叫背後做了什麼。

## Exercises｜練習

1. 為 Cauchy 分布實作反 CDF 取樣。CDF 為 F(x) = 0.5 + arctan(x)/pi。產生 10,000 個樣本，並將直方圖與真實 PDF 比較，觀察重尾現象（遠離中心的極端值）。

2. 使用 Uniform(0, 1) 作為提議分布，以拒絕取樣產生 Beta(2, 5) 樣本。將接受的樣本與真實 Beta PDF 比較，並計算理論接受率。

3. 使用蒙地卡羅方法，以 1,000、10,000 與 100,000 個樣本估計 sin(x) 在 0 到 pi 之間的積分，比較各次誤差，並驗證誤差是否依 O(1/sqrt(N)) 縮放。

4. 使用 Metropolis-Hastings 從二維分布 p(x, y) ∝ exp(-(x^2 * y^2 + x^2 + y^2 - 8*x - 8*y) / 2) 取樣。繪出樣本與鏈的移動軌跡，並測試不同提議標準差的影響。

5. 完整實作文字生成示範：給定包含 10 個詞與 logits 的詞彙表，分別使用 (a) 貪婪解碼、(b) temperature=0.7、(c) top-k=3、(d) top-p=0.9 產生 20 個 token 的序列。比較 5 次執行的輸出多樣性。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------|----------|
| Sampling（取樣） |「抽取隨機值」| 依照機率分布產生數值，是所有生成式 AI 背後的機制 |
| Uniform distribution（均勻分布） |「每個結果的機率相同」| [a, b] 中每個值的機率密度均為 1/(b-a)，是各種取樣方法的起點 |
| Inverse CDF（反 CDF） |「機率轉換」| F_inverse(U) 會將均勻樣本轉換成 CDF 已知的任意分布樣本，精確且有效率 |
| Rejection sampling（拒絕取樣） |「提出後接受或拒絕」| 從簡單提議分布產生樣本，依目標／提議比率接受；結果精確，但會浪費樣本 |
| Importance sampling（重要性取樣） |「重新加權樣本」| 使用 q(x) 的樣本，以 p(x)/q(x) 為各樣本加權，估計 p(x) 下的期望值；是強化學習 PPO 的核心技巧 |
| Monte Carlo（蒙地卡羅） |「隨機樣本取平均」| 以樣本平均近似積分，誤差為 O(1/sqrt(N))，且不受維度影響 |
| MCMC |「會收斂的隨機漫步」| 建立一條穩態分布為目標分布的馬可夫鏈；Metropolis-Hastings 是基礎演算法 |
| Metropolis-Hastings |「上坡必接受，下坡有時接受」| 提議移動並依據機率密度比決定是否接受；細緻平衡可確保收斂至目標分布 |
| Gibbs sampling（Gibbs 取樣） |「一次更新一個變數」| 固定其他變數，依各變數的條件分布更新，接受率為 100% |
| Temperature（溫度） |「信心旋鈕」| Softmax 前先將 logits 除以 T；T<1 會使分布變尖銳（更有把握），T>1 會使分布變平坦（更多樣） |
| Top-k sampling（Top-k 取樣） |「保留最好的 k 個」| 將機率最高以外的 token 設為零，再重新正規化並取樣；候選集合大小固定 |
| Nucleus sampling（top-p 核取樣） |「保留較可能的選項」| 保留累積機率超過 p 的最小 token 集合，候選集合大小會動態調整 |
| Reparameterization trick（重參數化技巧） |「將隨機性移出去」| 將 z 寫成 mu + sigma * epsilon，其中 epsilon ~ N(0,1)，使取樣可微分，是訓練 VAE 的必要技巧 |
| Gumbel-Softmax |「soft 類別取樣」| 使用 Gumbel 雜訊與溫度 softmax，對類別取樣提供可微分近似 |
| Stratified sampling（分層取樣） |「強制均勻涵蓋」| 將樣本空間分層並從各層取樣，變異數一定不高於基本蒙地卡羅方法 |
| Burn-in（暖身期） |「熱身階段」| MCMC 鏈尚未到達穩態分布前應捨棄的初始樣本 |
| Detailed balance（細緻平衡） |「可逆條件」| p(x) * T(x->y) = p(y) * T(y->x)，是馬可夫鏈穩態分布為 p 的充分條件 |
| Diffusion sampling（擴散取樣） |「反覆去噪」| 從雜訊開始，套用學得的去噪步驟生成資料；每一步都是條件取樣 |

## Further Reading｜延伸閱讀

- [Holbrook（2023）：The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010) - MCMC 基礎的詳細教學
- [Jang、Gu、Poole（2017）：Categorical Reparameterization with Gumbel-Softmax](https://arxiv.org/abs/1611.01144) - Gumbel-Softmax 原始論文
- [Holtzman 等人（2020）：The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751) - 核取樣（top-p）論文
- [Kingma 與 Welling（2014）：Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) - 提出重參數化技巧的 VAE 論文
- [Ho、Jain、Abbeel（2020）：Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) - 說明取樣與影像生成關聯的 DDPM 論文
