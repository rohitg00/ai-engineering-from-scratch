# GAN——產生器（generator）對鑑別器（discriminator）

> Goodfellow 在 2014 年的手法是完全跳過密度（density）。兩個網路（network）。一個造假。一個抓假。它們打到假的和真的分不出來。它不該行得通。也常常行不通。行得通的時候，窄領域的樣本仍是文獻裡最銳的。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 08 (Optimizers), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## The Problem｜問題

VAE 的樣本會糊，因為 MSE 解碼器損失對*平均*影像是貝氏最佳——很多張都說得通的數字，多個合理數字的平均會模糊。你要的損失（loss）獎勵的是*像真的*，不是逐像素靠近任何一個目標。像真的沒有閉式。你得把它學出來。

Goodfellow 的想法：訓練一個分類器（classifier）`D(x)` 來分辨真影像和假的。訓練一個產生器（generator）`G(z)` 去騙 `D`。`G` 的損失信號，就是 `D` D 目前判定為真實的特徵。`G` 一變好，這個信號就更新，追的是移動目標。兩個網路都收斂的話，`G` 已經學會資料分布（distribution），卻從來沒寫下 `log p(x)`。

這就是對抗訓練（adversarial training）。數學是一場極小極大（minimax）賽局：

```
min_G max_D  E_real[log D(x)] + E_fake[log(1 - D(G(z)))]
```

2026 年 GAN 不再是最強的產生器，擴散和流匹配（flow matching）拿走了那頂王冠。但 StyleGAN 2／3 仍是曾經發布過的最清晰臉部模型，GAN 鑑別器（discriminator）被當成擴散訓練裡的*知覺損失（perceptual loss）*，而對抗訓練撐起快速的一步蒸餾（distillation），像是 SDXL-Turbo、SD3-Turbo、LCM，讓你能支援即時擴散生成。

## The Concept｜核心概念

![GAN training: generator and discriminator in minimax](../assets/gan.svg)

**產生器 `G(z)`。** 把雜訊向量 `z ~ N(0, I)` 映成樣本 `x̂`。形狀像解碼器的網路，全連接或轉置卷積（transposed convolution）。

**鑑別器 `D(x)`。** 把樣本映成一個純量（scalar）機率，或一個分數。真的 → 1，假的 → 0。

**損失。** 兩次交替更新：

- **訓練 `D`：** `loss_D = -[ log D(x) + log(1 - D(G(z))) ]`。真實標成 1、假的標成 0 的二元交叉熵（binary cross-entropy）。
- **訓練 `G`：** `loss_G = -log D(G(z))`。這是 Goodfellow 用的*不飽和（non-saturating）*形式。原本的 `log(1 - D(G(z)))` 會飽和，`D` 很有把握時梯度（gradient）會死。

**訓練迴圈（training loop）。** `D` 一步，`G` 一步。重複。

**為什麼行得通。** 如果 `G` 完美貼合 `p_data`，`D` 最好也只能隨機亂猜，到處輸出 0.5；`G` 再也拿不到梯度。這是均衡。

**為什麼會壞。** 模式崩塌（mode collapse）——`G` 找到一個 `D` 分不出來的模式，就一直鑄這一個；梯度消失（vanishing gradient）——`D` 學太快，`log D` 飽和；訓練不穩——學習率（learning rate）、批次（batch）大小，什麼都可能是原因。

## 讓 GAN 行得通的變體

| 年份 | 創新 | 修了什麼 |
|------|------------|-----|
| 2015 | DCGAN | 卷積／反卷積、批次正規化（batch norm）、LeakyReLU——第一個穩定的架構。 |
| 2017 | WGAN、WGAN-GP | 用瓦瑟斯坦距離（Wasserstein distance）加梯度懲罰（gradient penalty）換掉二元交叉熵。修好梯度消失。 |
| 2017 | 譜正規化（spectral normalization） | 把鑑別器的利普希茨（Lipschitz）常數框住。2026 年的鑑別器還在用。 |
| 2018 | Progressive GAN | 先訓練低解析度，再加層。第一批百萬像素的結果。 |
| 2019 | StyleGAN／StyleGAN2 | 映射網路加自適應實例正規化（AdaIN）。固定領域照片級寫實的前沿。 |
| 2021 | StyleGAN3 | 無混疊（alias-free）、平移等變（translation-equivariant）——2026 年仍是臉部的黃金標準。 |
| 2022 | StyleGAN-XL | 有條件、看得到類別、規模更大。 |
| 2024 | R3GAN | 用更強的正則重新包裝；1024² 不用花招也能動。 |

```figure
gan-minimax
```

## Build It｜動手實作

`code/main.py` 在一維資料上訓練迷你 GAN：兩個高斯的混合。產生器和鑑別器都是單隱藏層 MLP。我們手寫前向、反向，和極小極大迴圈。目標是看見兩個關鍵失敗模式當場發生：模式崩塌，和梯度消失。

### 步驟 1：不飽和損失

原版 Goodfellow 損失 `log(1 - D(G(z)))` 在 D 很有把握地把 G 的假樣本判成假的時候會走到 0。那時候 G 的梯度基本上是零——G 無法變好。不飽和形式 `-log D(G(z))` 的漸近線相反：D 很有把握時它會衝得很大，給 G 一個很強的信號。

```python
def g_loss(d_fake):
    # maximize log D(G(z))  <=>  minimize -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### 步驟 2：鑑別器一步，產生器一步

```python
for step in range(steps):
    # train D
    real_batch = sample_real(batch_size)
    fake_batch = [G(z) for z in sample_noise(batch_size)]
    update_D(real_batch, fake_batch)

    # train G
    fake_batch = [G(z) for z in sample_noise(batch_size)]  # fresh fakes
    update_G(fake_batch)
```

給 G 用新的假樣本，不然梯度是過期的。

### 步驟 3：盯著模式崩塌

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

典型症狀：兩個真實模式有一個不再被生成。鑑別器不再糾正它，因為它從來沒被看成假的。

## 容易踩的坑

- **鑑別器太強。** 把 D 的學習率砍成 2 到 5 分之一，或在實例或層上加雜訊。D 的準確率（accuracy）一超過 95%，G 就死了。
- **產生器背下一個模式。** 給 D 的輸入加雜訊，用小批次鑑別（minibatch discrimination）層，或改用 WGAN-GP。
- **批次正規化漏統計。** 真實批次和假批次流過同一層 BN，統計會混在一起。改用實例正規化或譜範數。
- **刷 Inception score。** 樣本數少的時候 FID 和 IS 很吵。評估至少用 1 萬個樣本。
- **一次到位的取樣對條件任務是謊言。** 你還是需要無分類器引導（CFG）的尺度、截斷（truncation）手法，和重新取樣，才拿得到能用的輸出。

## Use It｜實際應用

2026 年的 GAN 組合：

| 情況 | 選 |
|-----------|------|
| 照片級寫實的人臉、姿勢固定 | StyleGAN3，最銳、也最小 |
| 動漫／風格化的臉 | StyleGAN-XL，或 Stable Diffusion 的 LoRA |
| 影像到影像的轉譯 | Pix2Pix／CycleGAN（第 8 階段第 04 課），或 ControlNet（第 8 階段第 08 課） |
| 快速的一步文字生影像 | 擴散的對抗蒸餾，SDXL-Turbo、SD3-Turbo |
| 擴散訓練器裡的知覺損失 | 在影像裁塊上放一個小的 GAN 鑑別器 |
| 任何多模態、開放式的 | 別用——改用擴散或流匹配 |

GAN 很銳，但很窄。當任務領域擴大時，照片、任意文字 prompt、影片，就改用擴散。對抗這個手法留下來當元件（component），用在知覺損失和蒸餾，而不是單獨的產生器。

## Ship It｜交付成果

存成 `outputs/skill-gan-debugger.md`。這個 skill 根據失敗的 GAN 訓練記錄，也就是損失曲線、樣本網格、資料集（dataset）大小，輸出可能原因的排序、一行修法，和重跑協議。

## Exercises｜練習

1. **簡單。** 用原設定跑 `code/main.py`。然後設 `D_LR = 5 * G_LR` 再跑。G 的損失多快塌成常數？
2. **中等。** 把 Goodfellow 的二元交叉熵損失換成 WGAN 損失：`loss_D = E[D(fake)] - E[D(real)]`、`loss_G = -E[D(fake)]`，並把 D 的權重裁到 `[-0.01, 0.01]`。訓練比較穩嗎？比較實際要跑多久才收斂。
3. **困難。** 把一維例子擴成二維資料，環上 8 個高斯的混合。追蹤 8 個模式裡，產生器在 1000、5000、1 萬步各抓到幾個。實作小批次鑑別再量一次。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 產生器 | 「G」 | 從雜訊到樣本的網路，`G: z → x̂`。 |
| 鑑別器 | 「D」 | 分類器 `D: x → [0, 1]`，分辨真假。 |
| 極小極大 | 「那場賽局」 | 對一個聯合目標做 `min_G max_D`。 |
| 不飽和損失 | 「那個修法」 | G 用 `-log D(G(z))`，而不是 `log(1 - D(G(z)))`。 |
| 模式崩塌 | 「G 背下了一個東西」 | 資料明明多樣，產生器卻只吐出少數幾種。 |
| WGAN | 「瓦瑟斯坦」 | 用推土機距離（Earth-Mover distance）加梯度懲罰換掉二元交叉熵；梯度更平滑。 |
| 譜範數 | 「利普希茨手法」 | 限制 D 的權重範數來框住斜率；訓練比較穩。 |
| StyleGAN | 「那個行得通的」 | 映射網路加 AdaIN；到 2026 年，臉部仍然是第一流。 |

## 正式環境筆記：一次到位的推論，是 GAN 留下來的優勢

GAN 在開放領域的樣本品質上已經不贏，但推論（inference）成本仍然贏。用正式環境推論（production inference）文獻的詞彙，GAN 有：

- **沒有預填（prefill），也沒有解碼階段。** 一次 `G(z)` 前向傳遞。首 token 時間（TTFT）約等於總延遲（latency）。
- **沒有 KV cache 的壓力。** 唯一的狀態是權重。批次大小被活化記憶體（activation memory）限制，不是被快取限制。
- **連續批次（continuous batching）很單純。** 每個請求的 FLOPs 都一樣、是固定的，所以在伺服器的目標佔用率放一個固定批次，通常就是最好。不需要處理途中請求的排程器。

這就是為什麼 GAN 蒸餾，SDXL-Turbo、SD3-Turbo、ADD、LCM，是 2026 年快速文字生影像的主力手法：它把 20 到 50 步的擴散管線（pipeline）縮成 1 到 4 次 GAN 式前向傳遞，同時保住擴散基模型的分布。對抗損失留下來，當訓練時的旋鈕，將慢速生成器轉為快速生成器。

## Further Reading｜延伸閱讀

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) ——最初的 GAN 論文。
- [Radford et al. (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434) ——第一個穩定的架構。
- [Arjovsky, Chintala, Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875) ——WGAN。
- [Miyato et al. (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) ——譜正規化。
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) ——StyleGAN2。
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) ——StyleGAN3。
- [Sauer et al. (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042) ——SDXL-Turbo。
