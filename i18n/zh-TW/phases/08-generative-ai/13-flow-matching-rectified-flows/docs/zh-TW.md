# 流匹配（flow matching）與整流流（rectified flow）

> 擴散模型要走 20 到 50 個取樣步，因為它們從雜訊走到資料的路徑是彎的。流匹配（flow matching，Lipman et al.，2023）和整流流（rectified flow，Liu et al.，2022）訓練模型學得直線路徑。路徑越直，步數越少，推論（inference）越快。Stable Diffusion 3、Flux.1、AudioCraft 2 都在 2024 改成流匹配。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 06 (DDPM), Phase 1 · Calculus
**Time:** ~45 minutes

## The Problem｜問題

DDPM 的反向過程（reverse process），是從 `N(0, I)` 走回資料分布（distribution）的 1000 步隨機遊走（random walk）。DDIM 把它縮成 20 到 50 個確定性步驟。你想要更少步——理想是一步。卡住的地方是：解反向過程的 ODE 是剛性的（stiff）；路徑是彎的。

若能把模型訓練成從雜訊到資料的路徑是一條*直線*，從 `t=1` 到 `t=0` 做一次歐拉步（Euler step）就夠了。流匹配直接造出這件事：定義從 `x_1 ∼ N(0, I)` 到 `x_0 ∼ data` 的直線內插（interpolant），訓練向量場（vector field）`v_θ(x, t)` 去對上它的時間導數（time derivative），推論時再積分。

整流流（Liu 2022）再往前一步：用 reflow 程序反覆把路徑拉直，讓 ODE 越來越接近線性。兩次 reflow 之後，2 步取樣器就能對上 50 步 DDPM 的品質。

## The Concept｜核心概念

![Flow matching: straight-line interpolation between noise and data](../assets/flow-matching.svg)

### 直線流

定義：

```
x_t = t · x_1 + (1 - t) · x_0,   t ∈ [0, 1]
```

其中 `x_0 ~ data`，`x_1 ~ N(0, I)`。沿這條直線，時間導數是常數：

```
dx_t / dt = x_1 - x_0
```

定義神經向量場 `v_θ(x_t, t)`，訓練它去對上這個導數：

```
L = E_{x_0, x_1, t} || v_θ(x_t, t) - (x_1 - x_0) ||²
```

這就是**條件流匹配（conditional flow matching）**損失（Lipman 2023）。訓練不用模擬（simulation-free）：你從不把 ODE 展開。只要抽出 `(x_0, x_1, t)`，再做回歸。

### 取樣

推論時，把學到的向量場在時間上*往回*積分：

```
x_{t-Δt} = x_t - Δt · v_θ(x_t, t)
```

從 `x_1 ~ N(0, I)` 出發，用歐拉步降到 `t=0`。

### 整流流（Liu 2022）

直線流有用，但學到的路徑*其實並不直*——它們會彎，因為很多 `x_0` 可以映到同一個 `x_1`。整流流的 reflow 步驟：

1. 用隨機配對訓練流模型 v_1。
2. 把 v_1 從 `x_1` 積分到它落到的 `x_0`，取樣出 N 對 `(x_1, x_0)`。
3. 用這些配對範例訓練 v_2。配對既然已經跟 ODE 對上，兩者之間的直線內插就真的更平。
4. 重複。

實務上 2 次 reflow 就接近線性，推論可以是 2 到 4 步。SDXL-Turbo、SD3-Turbo、LCM 都是從流匹配蒸餾（distillation）出來的模型。

### 為什麼 2024 年它在影像上贏了

三個理由：

1. **不用模擬的訓練**——訓練時不展開 ODE，很好實作。
2. **損失的幾何更好**——直線路徑的訊噪比（signal-to-noise）一致，而 DDPM 的 ε 損失在排程兩端的 SNR 很差。
3. **推論更快**——SDXL-Turbo 的品質用 4 到 8 步就夠；一致性蒸餾（consistency distillation）則是 1 步。

## 流匹配對上 DDPM——確切的對應

帶高斯條件路徑的流匹配，就是*用了特定雜訊排程*的擴散。選用 `x_t = α(t) x_0 + σ(t) x_1` 這個排程，流匹配會還原成 Stratonovich 改寫的擴散，其中 `v = α'·x_0 - σ'·x_1`。對高斯路徑，兩者在代數上等價。

流匹配多出來三件事：目標*清楚*，那就是一個普通的速度（velocity）；損失更乾淨；也可以去試非高斯的內插。

```figure
normalizing-flow
```

## Build It｜動手實作

`code/main.py` 在兩個模式的高斯混合上實作一維流匹配。向量場 `v_θ(x, t)` 是一個很小的 MLP，用直線目標來訓練。推論時用 1、2、4、20 個歐拉步去積分，再比較樣本品質。

### 步驟 1：訓練損失

```python
def train_step(x0, net, rng, lr):
    x1 = rng.gauss(0, 1)
    t = rng.random()
    x_t = t * x1 + (1 - t) * x0
    target = x1 - x0
    pred = net_forward(x_t, t)
    loss = (pred - target) ** 2
    # backprop + update
```

### 步驟 2：多步推論

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### 步驟 3：比較步數

可以預期，4 步取樣器就已經對上 20 步的品質——對延遲來說這很要緊。

## 容易踩的坑

- **時間的參數化。** 流匹配用 `t ∈ [0, 1]`，`t=0` 在資料、`t=1` 在雜訊。DDPM 用 `t ∈ [0, T]`，`t=0` 在資料、`t=T` 在雜訊。方向一樣，尺度不同。論文一直把這個搞錯。
- **排程怎麼選。** 整流流的直線就是「那個」流匹配排程，但也可以用餘弦，或 logit-normal 的 t 抽樣（SD3 就是這樣），讓尺度覆蓋得更好。
- **reflow 的成本。** 為 reflow 產生配對資料集（dataset），每個樣本都要完整推論一次。只有真的需要 1 到 2 步推論時，才做 reflow。
- **無分類器引導（classifier-free guidance）仍然適用。** 線性組合裡把 ε 換成 v 就好：`v_cfg = (1+w) v_cond - w v_uncond`。

## Use It｜實際應用

| 用途 | 2026 年的組合 |
|------|-----------|
| 文字生影像，品質最好 | 流匹配：SD3、Flux.1-dev |
| 文字生影像，1 到 4 步 | 蒸餾過的流匹配：Flux.1-schnell、SD3-Turbo、SDXL-Turbo |
| 即時推論 | 從流匹配過的底座做一致性蒸餾（LCM、PCM） |
| 音訊生成 | 流匹配：Stable Audio 2.5、AudioCraft 2 |
| 影片生成 | 流匹配和擴散混用（Sora、Veo、Stable Video） |
| 科學／物理（粒子軌跡、分子） | 流匹配加等變（equivariant）向量場 |

2025 到 2026，論文只要說「比擴散快」，幾乎總是流匹配加蒸餾。

## Ship It｜交付成果

存成 `outputs/skill-fm-tuner.md`。這個 skill 吃一份擴散風格的模型規格，轉成流匹配的訓練設定：排程選擇、時間抽樣分布（均勻／logit-normal）、調校器（optimizer）、reflow 計畫、目標步數、評估協定。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`，比較 1 步和 20 步相對真實資料分布的 MSE。
2. **中等。** 把均勻的 `t` 抽樣改成 logit-normal（把抽樣集中在 t 的中段）。模型品質會變好嗎？
3. **困難。** 實作一次 reflow：積分第一個模型，產生配對的 (x_0, x_1)，用這些配對訓練第二個模型，再比較 1 步的樣本品質。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 流匹配 | 「直線擴散」 | 沿著內插訓練 `v_θ(x, t)`，讓它對上 `x_1 - x_0`。 |
| 整流流 | 「reflow」 | 把學到的流反覆拉直的程序。 |
| 速度場 | 「v_θ」 | 模型的輸出——`x_t` 該往哪移動。 |
| 直線內插 | 「那條路徑」 | `x_t = (1-t)·x_0 + t·x_1`；目標導數很單純。 |
| 歐拉取樣器 | 「一階 ODE 求解器」 | 最簡單的積分器；路徑是直的時候很好用。 |
| Logit-normal 的 t | 「SD3 的抽樣」 | 把 `t` 的抽樣集中到梯度最強的中段。 |
| 一致性蒸餾 | 「1 步取樣器」 | 訓練一個學生，把任何 `x_t` 直接映到 `x_0`。 |
| 速度上的 CFG | 「v-CFG」 | `v_cfg = (1+w) v_cond - w v_uncond`；同一招，換一個變數。 |

## 正式環境筆記：Flux.1-schnell 是流匹配最快的形態

流匹配在正式環境打贏的，是 Flux.1-schnell——一個做過流匹配的 DiT，蒸餾到 1 到 4 步推論，同時保住 Flux-dev 等級的品質。Niels 的「用 8 GB 機器跑 Flux」notebook 是參考的部署配方（deployment recipe）：T5 加 CLIP 編碼，量化後的 MMDiT 去噪（schnell 4 步，dev 50 步），再 VAE 解碼。成本這樣算：

| 變體 | 步數 | 在 L4 上、1024² 的延遲 | 總 FLOPs（相對） |
|------|------|------------------------|------------------|
| Flux.1-dev（原始） | 50 | 約 15 秒 | 1.0× |
| Flux.1-schnell | 4 | 約 1.2 秒 | 0.08×（快 12 倍） |
| SDXL-base | 30 | 約 4 秒 | 0.25× |
| SDXL-Lightning 2 步 | 2 | 約 0.3 秒 | 0.03× |

正式環境的規則：**流匹配底座加蒸餾，就是 2026 年快速文字生影像的預設。** 主要廠商都出這一套：SD3-Turbo（SD3 加流匹配加蒸餾）、Flux-schnell（Flux-dev 加整流流拉直）、CogView-4-Flash。純擴散底座只留在舊檢查點裡。

## Further Reading｜延伸閱讀

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) ——整流流。
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) ——流匹配。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) ——SD3，大規模的整流流。
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797) ——涵蓋流匹配加擴散的一般框架。
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) ——擴散／流的 1 步蒸餾。
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042) ——turbo 變體。
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) ——正式環境裡的流匹配。
