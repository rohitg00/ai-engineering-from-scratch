# 自編碼器與變分自編碼器（VAE）

> 普通自編碼器先壓縮再重建。它只會記住訓練資料。它不會生成。加一個手法——強迫編碼趨近高斯分布——你就得到一個取樣器。那一個手法，把 `z = μ + σ·ε` 重新參數化（reparameterization），就是為什麼你 2026 年用的每個潛在擴散（latent diffusion）和流匹配（flow matching）影像模型，輸入端都有一個 VAE。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 07 (CNNs), Phase 8 · 01 (Taxonomy)
**Time:** ~75 minutes

## The Problem｜問題

把 784 像素（pixel）的 MNIST 數字壓成 16 個數字的編碼，再重建。普通自編碼器的重建均方誤差（MSE）會很低，但編碼空間（encoding space）凹凸不平。在編碼空間隨便挑一點再解碼，得到的是雜訊。它沒有取樣器。它不過是外表精緻的壓縮模型。

你真正要的是：(a) 編碼空間是乾淨、平滑、可以從中取樣（sampling）的分布（distribution），比方等向（isotropic）高斯 `N(0, I)`，(b) 解碼任何一個樣本都得到像真的數字，(c) 編碼器（encoder）和解碼器（decoder）的壓縮仍然做得好。三個目標，由同一個架構與同一個損失（loss）達成。

Kingma 2013 的 VAE 這樣解：訓練編碼器輸出一個*分布* `q(z|x) = N(μ(x), σ(x)²)`，用 KL 懲罰（KL penalty）把這個分布拉向先驗（prior）`N(0, I)`，然後解碼前從 `q(z|x)` 取樣 `z`。推論（inference）時丟掉編碼器，取樣 `z ~ N(0, I)`，再解碼。逼編碼空間有結構的，就是這個 KL 懲罰。

2026 年 VAE 很少單獨部署——原始影像品質已被擴散模型超越——但它們是每個潛在擴散模型選用的編碼器，包括 SD 1／2／XL／3、Flux、AudioCraft。學會 VAE，就學會你用的每條影像管線（pipeline）看不見的第一層。

## The Concept｜核心概念

![Autoencoder vs VAE: the reparameterization trick](../assets/vae.svg)

**自編碼器。** `z = encoder(x)`，`x̂ = decoder(z)`，損失 = `||x - x̂||²`。編碼空間沒有結構。

**VAE 編碼器。** 輸出兩個向量：`μ(x)` 和 `log σ²(x)`。它們定義 `q(z|x) = N(μ, diag(σ²))`。

**重新參數化手法。** 從 `q(z|x)` 取樣不可微。把樣本改寫成 `z = μ + σ·ε`，其中 `ε ~ N(0, I)`。現在 `z` 是 `(μ, σ)` 的確定函數，加上一份不是參數（parameter）的雜訊——梯度（gradient）流過 `μ` 和 `σ`。

**損失。** 證據下界（ELBO），兩項：

```
loss = reconstruction + β · KL[q(z|x) || N(0, I)]
     = ||x - x̂||²  + β · Σ_i ( σ_i² + μ_i² - log σ_i² - 1 ) / 2
```

重建把 `x̂` 推向 `x`。KL 把 `q(z|x)` 推向先驗。兩邊在拉鋸。β 小（小於 1）等於樣本更銳，編碼空間比較不像高斯。β 大（大於 1）等於編碼空間更乾淨，樣本更糊。β-VAE（Higgins 2017）讓這個旋鈕出了名，也開啟了解纏（disentanglement）研究。

**取樣。** 推論時：抽 `z ~ N(0, I)`，送進解碼器。一次前向傳遞——不像擴散那樣迭代取樣。

```figure
vae-latent-grid
```

## Build It｜動手實作

`code/main.py` 實作一個不用 numpy、也不用 torch 的迷你 VAE。輸入是 8 維合成資料，從 8 維裡的雙成分高斯混合抽出。編碼器和解碼器都是單隱藏層的 MLP。我們實作 tanh 活化（activation）、前向傳遞、損失，和手寫的反向傳播。不是給正式環境（production）用的，是教學用的。

### 步驟 1：編碼器前向傳遞

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

用 `log σ²` 而不是 `σ`，這樣網路輸出不受約束。對 σ 做 softplus 是陷阱——σ ≈ 0 時梯度會死。

### 步驟 2：重新參數化再解碼

```python
def reparameterize(mu, log_sigma2, rng):
    eps = [rng.gauss(0, 1) for _ in mu]
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    return [m + s * e for m, s, e in zip(mu, sigma, eps)]

def decode(z, dec):
    h = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    return add(matmul(dec["W_out"], h), dec["b_out"])
```

### 步驟 3：ELBO

```python
def elbo(x, x_hat, mu, log_sigma2, beta=1.0):
    recon = sum((a - b) ** 2 for a, b in zip(x, x_hat))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1 for m, lv in zip(mu, log_sigma2))
    return recon + beta * kl, recon, kl
```

因為兩個分布都是高斯，KL 有精確的閉式。不要做數值積分。2026 年仍有人出貨以蒙地卡羅（Monte Carlo）估計 KL 的程式，沒有必要地慢上 3 倍。

### 步驟 4：生成

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

這就是生成模型。只需五行程式碼。

## 容易踩的坑

- **後驗崩塌（posterior collapse）。** KL 項把 `q(z|x) → N(0, I)` 推得太兇，`z` 幾乎不帶 `x` 的資訊。修法：β 退火（β-annealing），從 β=0 爬到 1；或用自由位元（free bits）；或對沒在用的維度（dimension）跳過 KL。
- **樣本糊掉。** 高斯解碼器的概似（likelihood）意味著用 MSE 重建，而那對 L2 是貝氏最佳，最佳的是平均數——一組都說得通的數字，平均起來是一個模糊的數字。修法：改用離散解碼器，例如 VQ-VAE、NVAE；或 VAE 只當編碼器，在潛在表示上疊擴散，Stable Diffusion 就是這樣。
- **β 太大、太早。** 見後驗崩塌。從 β≈0.01 開始再爬。
- **潛在維度太小。** 16 維夠 MNIST，ImageNet 256² 用 256 維，ImageNet 1024² 用 2048 維。Stable Diffusion 的 VAE 把 512×512×3 壓成 64×64×4，空間面積下採樣 32 倍，通道也是 32 倍。

## Use It｜實際應用

2026 年的 VAE 組合：

| 情況 | 選 |
|-----------|------|
| 給擴散用的影像潛在編碼器 | Stable Diffusion VAE（`sd-vae-ft-ema`）或 Flux VAE |
| 音訊潛在編碼器 | Encodec（Meta）、SoundStream，或 DAC（Descript） |
| 影片潛在表示 | Sora 的時空圖塊、Latte VAE、WAN VAE |
| 解纏表示學習 | β-VAE、FactorVAE、TCVAE |
| 離散潛在表示，給 transformer 建模 | VQ-VAE、RVQ（ResidualVQ） |
| 用來生成的連續潛在表示 | 普通 VAE，再在那個潛在空間（latent space）裡給流或擴散模型加條件 |

潛在擴散模型就是在 VAE 的編碼器與解碼器之間加入一個擴散模型。VAE 負責粗壓縮，擴散模型負責主要工作。影片和音訊是同一套：影片用 VAE 加影片擴散 DiT，音訊用 Encodec 加 MusicGen 的 transformer。

## Ship It｜交付成果

存成 `outputs/skill-vae-trainer.md`。

這個 skill 吃：資料集（dataset）輪廓、目標潛在維度、下游用途，也就是重建、取樣，或潛在擴散的輸入。它輸出：架構選擇，普通、β、VQ 或 RVQ；β 排程；潛在維度；解碼器概似，高斯或類別型；以及評估計畫，重建 MSE、每個維度的 KL、`q(z|x)` 和 `N(0, I)` 之間的 Fréchet 距離。

## Exercises｜練習

1. **簡單。** 把 `code/main.py` 裡的 `β` 改成 `0.01`、`0.1`、`1.0`、`5.0`。記下最後的重建 MSE 和 KL。對你的合成資料，哪個 β 在 Pareto 意義上最好？
2. **中等。** 把高斯解碼器概似換成伯努利概似，損失用交叉熵（cross-entropy）。在同一份合成資料的二值化版本上比較樣本品質。
3. **困難。** 把 `code/main.py` 擴成迷你 VQ-VAE：用碼本（codebook）裡 K=32 個項目的最近鄰查表，換掉連續的 `z`。比較重建 MSE，並報告碼本有幾個項目被用到。碼本崩塌是真的。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 自編碼器 | 編碼再解碼的網路 | `x → z → x̂`，學 MSE。不會生成。 |
| VAE | 帶取樣器的自編碼器 | 編碼器輸出一個分布，KL 懲罰把編碼空間塑形。 |
| ELBO | 證據下界 | `log p(x) ≥ recon - KL[q(z\|x) \|\| p(z)]`；當 `q = p(z\|x)` 時這個界是緊的。 |
| 重新參數化 | `z = μ + σ·ε` | 把隨機節點改寫成確定部分加純雜訊。這樣取樣過程也能反向傳播。 |
| 先驗 | `p(z)` | 潛在表示的目標分布，通常是 `N(0, I)`。 |
| 後驗崩塌 | 「KL 項贏了」 | 編碼器無視 `x`，輸出先驗；解碼器只好幻覺（hallucination）。 |
| β-VAE | 可調的 KL 權重 | `loss = recon + β·KL`。β 越高越解纏，但越糊。 |
| VQ-VAE | 離散潛在表示 | 用最近的碼本向量換掉連續的 `z`；這樣才能做 transformer 建模。 |

## 正式環境筆記：VAE 是擴散伺服器裡負載最重的路徑

在 Stable Diffusion／Flux／SD3 管線裡，VAE 每個請求叫兩次——做圖生圖（img2img）或修補（inpainting）時編碼一次，另外解碼一次。在 1024²，解碼那一次常常是整條管線裡活化記憶體（activation memory）的最大峰值，因為它把 `128×128×16` 的潛在表示上採樣回 `1024×1024×3`。兩個實際後果：

- **把解碼切片或分塊。** `diffusers` 提供 `pipe.vae.enable_slicing()` 和 `pipe.vae.enable_tiling()`。分塊會帶來少量接縫假影，但記憶體需求為 `O(tile²)` 而非 `O(H·W)`。消費級 GPU 要做 1024² 以上，這是必要的。
- **解碼器用 bf16，最後縮放那步用 fp32 的數值精度（precision）。** SD 1.x 的 VAE 以 fp32 釋出，在 1024² 以上轉成 fp16 時會*不聲不響地生出 NaN*。SDXL 附了 `madebyollin/sdxl-vae-fp16-fix`——優先用這個 fp16-fix 變體，或改用 bf16。

## Further Reading｜延伸閱讀

- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) ——VAE 那篇。
- [Higgins et al. (2017). β-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework](https://openreview.net/forum?id=Sy2fzU9gl) ——解纏的 β-VAE。
- [van den Oord et al. (2017). Neural Discrete Representation Learning](https://arxiv.org/abs/1711.00937) ——VQ-VAE。
- [Vahdat & Kautz (2021). NVAE: A Deep Hierarchical Variational Autoencoder](https://arxiv.org/abs/2007.03898) ——前沿的影像 VAE。
- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) ——Stable Diffusion；VAE 當編碼器。
- [Défossez et al. (2022). High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) ——Encodec，音訊 VAE 的標準。
