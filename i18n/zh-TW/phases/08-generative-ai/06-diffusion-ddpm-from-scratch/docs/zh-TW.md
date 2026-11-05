# 擴散模型——從零做 DDPM

> Ho、Jain、Abbeel（2020）給了這個領域一套廣泛採用的配方。用一千個小步驟的雜訊把資料毀掉。訓練一個神經網路（neural network）去預測雜訊。推論（inference）時把過程倒過來。今天每個主流的影像、影片、3D、音樂模型都跑在這個迴圈上，上面可能再加流匹配（flow matching）或一致性（consistency）手法。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## The Problem｜問題

你要一個 `p_data(x)` 的取樣器（sampler）。GAN 玩一場常常發散的極小極大（minimax）賽局。VAE 從高斯解碼器產生模糊的樣本。你真正要的訓練目標是：(a) 單一、穩定的損失（loss），沒有鞍點（saddle point）、沒有極小極大，(b) `log p(x)` 的一個下界，所以你有概似（likelihood），(c) 樣本品質對得上目前最強。

Sohl-Dickstein 等人（2015）有理論答案：定義一條馬可夫鏈（Markov chain）`q(x_t | x_{t-1})`，逐步加上高斯雜訊，再訓練一條反向鏈 `p_θ(x_{t-1} | x_t)` 來去噪。Ho、Jain、Abbeel（2020）指出損失可以簡化成一行——預測雜訊——並整理了數學推導。2020 年這還只是新鮮事。2021 年它做出當時最強的樣本。2022 年它變成 Stable Diffusion。2026 年它是底層。

## The Concept｜核心概念

![DDPM: forward noise, reverse denoise](../assets/ddpm.svg)

**前向過程（forward process） `q`。** 在 `T` 個小步驟裡加高斯雜訊。閉式解之所以讓數學可以處理，是因為累積後的那一步也是高斯：

```
q(x_t | x_0) = N( sqrt(α̅_t) · x_0,  (1 - α̅_t) · I )
```

其中 `α̅_t = ∏_{s=1..t} (1 - β_s)`，對應一組 `β_t` 排程（schedule）。`β_t` 從 1e-4 線性走到 0.02，經過 T=1000 步，`x_T` 就大約是 `N(0, I)`。

**反向過程（reverse process） `p_θ`。** 學一個神經網路 `ε_θ(x_t, t)`，預測加進去的雜訊。給定 `x_t`，這樣去噪：

```
x_{t-1} = (1 / sqrt(α_t)) · ( x_t - (β_t / sqrt(1 - α̅_t)) · ε_θ(x_t, t) )  +  σ_t · z
```

其中 `σ_t` 要麼是 `sqrt(β_t)`，要麼是學來的變異數（variance）。式子較為繁複，但它只是代數——從後驗（posterior）`q(x_{t-1} | x_t, x_0)` 解出 `x_{t-1}`，再用雜訊預測出來的估計換掉 `x_0`。

**訓練損失。**

```
L_simple = E_{x_0, t, ε} [ || ε - ε_θ( sqrt(α̅_t) · x_0 + sqrt(1 - α̅_t) · ε,  t ) ||² ]
```

從資料抽 `x_0`，隨機挑一個 `t`，抽 `ε ~ N(0, I)`，用閉式一次算出帶噪的 `x_t`，再對雜訊做迴歸。一個損失，沒有極小極大，沒有 KL，沒有重新參數化（reparameterization）手法。

**取樣（sampling）。** 從 `x_T ~ N(0, I)` 開始。反向步驟從 `t = T` 走到 `1`。結束。

## 為什麼行得通

三個直覺：

1. **去噪容易，生成難。** 在 `t=T`，資料是純雜訊——網路要解的是簡單問題。在 `t=0`，網路只要清掉幾個像素。在中間的 `t`，問題難，但每個雜訊程度都有很多梯度（gradient）流過同一組權重。
2. **偽裝的分數匹配（score matching）。** Vincent（2011）證明預測雜訊等價於估計 `∇_x log q(x_t | x_0)`，也就是*分數（score）*。反向 SDE 用這個分數沿著密度（density）梯度往上走——一場被引導的隨機遊走，走向高機率區域。
3. **證據下界（ELBO）化成簡單的均方誤差（MSE）。** 完整的變分下界每個時間步有一個 KL 項。用 DDPM 的參數化（parameterization），那些 KL 項化成帶特定係數的雜訊預測 MSE；Ho 省略係數，稱之為「簡單」損失，品質*變好了*。

```figure
diffusion-denoise
```

## Build It｜動手實作

`code/main.py` 實作一維 DDPM。資料是雙峰混合。這個「網路」是迷你 MLP，吃 `(x_t, t)`，輸出預測的雜訊。訓練就是那一行損失。取樣把反向鏈走一遍。

### 步驟 1：前向排程，閉式

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
alphas = [1 - b for b in betas]
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### 步驟 2：一次抽出 `x_t`

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### 步驟 3：一個訓練步驟

```python
def train_step(x0, model, alpha_bars, rng):
    t = rng.randrange(T)
    x_t, eps = forward_sample(x0, t, alpha_bars, rng)
    eps_hat = model_forward(model, x_t, t)
    loss = (eps - eps_hat) ** 2
    return loss, gradient_step(model, ...)
```

### 步驟 4：反向取樣（reverse sampling）

```python
def sample(model, alpha_bars, T, rng):
    x = rng.gauss(0, 1)
    for t in range(T - 1, -1, -1):
        eps_hat = model_forward(model, x, t)
        beta_t = 1 - alphas[t]
        x = (x - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat) / math.sqrt(alphas[t])
        if t > 0:
            x += math.sqrt(beta_t) * rng.gauss(0, 1)
    return x
```

一維問題、40 個時間步、24 單元的 MLP，大約 200 個 epoch 就學會雙峰混合。

## 時間條件（time conditioning）

網路需要知道正在去噪的是哪個時間步。兩個標準做法：

- **正弦（sinusoidal）embedding。** 像 Transformer 的位置編碼。`embed(t) = [sin(t/ω_0), cos(t/ω_0), sin(t/ω_1), ...]`。送進一個 MLP，再廣播進網路。
- **FiLM／群組正規化（group normalization）條件。** 把 embedding 投影成每個通道的縮放和偏置，也就是 FiLM，加在每個區塊。

玩具程式用正弦 embedding 再串接。正式環境（production）的 U-Net 用 FiLM。

## 容易踩的坑

- **排程影響很大。** 線性 `β` 是 DDPM 預設，但餘弦雜訊排程（Nichol 與 Dhariwal，2021）同樣的運算能得到更好的 FID。品質停滯就換排程。
- **時間步 embedding 很脆弱。** 把原始 `t` 當浮點數傳，玩具一維行得通，影像不行；務必使用適當的 embedding。
- **V 預測對上 ε 預測。** 在很窄的區間，t 很小或很大，`ε` 的訊號雜訊比（signal-to-noise）很差。V 預測 `v = α·ε - σ·x` 是速度（velocity），更穩；SDXL、SD3、Flux 都用它。
- **無分類器引導（classifier-free guidance）。** 推論時同時算條件和無條件的 `ε`，然後 `ε_cfg = (1 + w) · ε_cond - w · ε_uncond`，`w ≈ 3-7`。第 08 課會講。
- **1000 步很多。** 正式環境用 DDIM（20 到 50 步）、DPM-Solver（10 到 20 步），或蒸餾（distillation，1 到 4 步）。見第 12 課。

## Use It｜實際應用

| 角色 | 2026 年的典型組合 |
|------|-----------------------|
| 影像像素空間擴散，小的、玩具 | DDPM 加 U-Net |
| 影像潛在擴散 | VAE 編碼器加 U-Net 或 DiT（第 07 課） |
| 影片潛在擴散 | 時空 DiT，Sora、Veo、WAN |
| 音訊潛在擴散 | Encodec 加擴散 transformer |
| 科學：分子、蛋白質、物理 | 等變擴散（equivariant diffusion），EDM、RFdiffusion、AlphaFold3 |

擴散是通用的生成骨幹（backbone）。流匹配（第 13 課）是 2024 到 2026 的競爭者，同樣品質下通常在推論速度上贏。

## Ship It｜交付成果

存成 `outputs/skill-diffusion-trainer.md`。這個 skill 吃資料集（dataset）和運算預算，輸出：排程，線性、餘弦或 sigmoid；預測目標，ε、v 或 x；步數；引導尺度；取樣器家族；以及評估協議。

## Exercises｜練習

1. **簡單。** 把 `code/main.py` 裡的 T 從 40 改成 10。樣本品質，也就是輸出的視覺直方圖，怎麼變差？T 到多少，雙峰結構會塌？
2. **中等。** 從 ε 預測改成 v 預測。重新推導反向步驟。比較最後的樣本品質。
3. **困難。** 加上無分類器引導。條件是類別標籤（label）`c ∈ {0, 1}`，訓練時 10% 的時間丟掉它，取樣時用 `ε = (1+w)·ε_cond - w·ε_uncond`。在 `w = 0, 1, 3, 7` 量條件模式命中率。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 前向過程 | 「加雜訊」 | 固定的馬可夫鏈 `q(x_t \| x_{t-1})`，把資料毀掉。 |
| 反向過程 | 「去噪」 | 學來的鏈 `p_θ(x_{t-1} \| x_t)`，把資料重建回來。 |
| β 雜訊排程 | 「雜訊階梯」 | 每步的變異數；線性、餘弦，或 sigmoid。 |
| α̅ | 「alpha bar」 | 累積乘積 `∏(1 - β)`；從 `x_0` 給出閉式的 `x_t`。 |
| 簡單損失 | 「對雜訊的 MSE」 | `\|\|ε - ε_θ(x_t, t)\|\|²`；所有變分推導都化成這個。 |
| ε 預測 | 「預測雜訊」 | 輸出是加進去的雜訊；標準 DDPM。 |
| V 預測 | 「預測速度」 | 輸出是 `α·ε - σ·x`；跨 t 的條件更穩。 |
| DDPM | 「那篇論文」 | Ho 等人 2020；線性 β、1000 步、U-Net。 |
| DDIM | 「確定性取樣器」 | 非馬可夫取樣器，20 到 50 步，訓練目標相同。 |
| 無分類器引導 | 「CFG」 | 把條件和無條件的雜訊預測混在一起，放大條件。 |

## 正式環境筆記：擴散推論是步數問題

DDPM 論文跑 T=1000 個反向步驟。正式環境不會這樣出貨。每個真正的推論堆疊挑三種策略的其中一種，而且每一種都對得上正式環境裡「延遲（latency）從哪來」的框法：

1. **更快的取樣器，同一個模型。** DDIM（20 到 50 步）、DPM-Solver++（10 到 20）、UniPC（8 到 16）。反向迴圈直接替換；訓練好的 `ε_θ` 權重不動。延遲降至原來的 1/20 到 1/50。
2. **蒸餾。** 訓練學生用更少步數去貼老師：漸進蒸餾（progressive distillation）從 2 步到 1 步、一致性模型從任意步到 1 到 4 步、LCM、SDXL-Turbo、SD3-Turbo。延遲再砍到 5 到 10 分之一，但要重新訓練。
3. **快取和編譯。** `torch.compile(unet, mode="reduce-overhead")`、TensorRT-LLM 的擴散後端、`xformers`／SDPA 注意力、bf16 權重。每步延遲大約砍到 2 分之一。和 (1)、(2) 疊加。

正式環境的擴散伺服器，其成本討論的方式與文獻描述 LLM 的方式相同：延遲是 `num_steps × step_cost + VAE_decode`，吞吐量（throughput）是 `batch_size × (num_steps × step_cost)^-1`。首 token 時間（TTFT）很小，只有一步；對使用者來說影像生成是一次到位，所以相當於每位輸出 token 時間（TPOT）的是整段回應時間。

## Further Reading｜延伸閱讀

- [Sohl-Dickstein et al. (2015). Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585) ——擴散那篇，走在時代前面。
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) ——DDPM。
- [Song, Meng, Ermon (2021). Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502) ——DDIM，步數更少。
- [Nichol & Dhariwal (2021). Improved DDPM](https://arxiv.org/abs/2102.09672) ——餘弦排程、學來的變異數。
- [Dhariwal & Nichol (2021). Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) ——分類器引導（classifier guidance）。
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) ——CFG。
- [Karras et al. (2022). Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364) ——統一記號，最乾淨的配方。
