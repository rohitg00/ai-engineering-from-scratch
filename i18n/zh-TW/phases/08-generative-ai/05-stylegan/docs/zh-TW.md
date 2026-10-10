# StyleGAN

> 大多數產生器把 `z` 同時攪進每一層。StyleGAN 把它拆開：先把 `z` 映成中間的 `w`，再在每個解析度透過 AdaIN *注入* `w`。那一個改動解開了潛在空間（latent space），也讓照片級寫實的臉連續七年來都能生成難以超越的寫實人臉。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 08 (Normalization), Phase 3 · 07 (CNNs)
**Time:** ~45 minutes

## The Problem｜問題

DCGAN 用一疊轉置卷積（transposed convolution）把 `z` 映成影像。問題是 `z` 什麼都控——姿勢、光線、身份、背景——纏在一起。沿著 `z` 的一個軸走，四種屬性同時改變。你不能叫模型「同一個人、不同姿勢」，因為表示沒有這樣分解。

Karras 等人（2019，NVIDIA）提議：不要把 `z` 直接送進卷積層。網路（network）輸入改餵一個常數張量 `4×4×512`。學一個 8 層 MLP，做 `z ∈ Z → w ∈ W` 這段映射。每個解析度用*自適應實例正規化（adaptive instance normalization）*，也就是 AdaIN，注入 `w`：先正規化每個卷積特徵圖（feature map），再依 `w` 的仿射投影（affine projection）縮放並平移。每一層加雜訊，做隨機細節，皮膚毛孔、頭髮絲。

結果：`W` 大致有正交的軸，一邊是「高層風格」，姿勢、身份，一邊是「細風格」，光線、顏色。你可以交換兩張影像的風格：低解析度用影像 A 的 `w`，高解析度用影像 B 的 `w`。這打開了編輯、跨領域風格化，和整條 StyleGAN 反演（inversion）研究線。

## The Concept｜核心概念

![StyleGAN: mapping network + AdaIN + per-layer noise](../assets/stylegan.svg)

**映射網路（mapping network）。** `f: Z → W`，一個 8 層 MLP。`Z = N(0, I)^512`。`W` 不被逼成高斯——它學一個配合資料的形狀。

**合成網路。** 從學來的常數 `4×4×512` 開始。每個解析度區塊是 `upsample → conv → AdaIN(w_i) → noise → conv → AdaIN(w_i) → noise`。解析度加倍：4、8、16、32、64、128、256、512、1024。

**AdaIN。**

```
AdaIN(x, y) = y_scale · (x - mean(x)) / std(x) + y_bias
```

其中 `y_scale` 和 `y_bias` 來自 `w` 的仿射投影。按特徵圖正規化，再交換風格。「風格」在這裡是特徵圖的一階和二階統計。

**逐層雜訊。** 每個特徵圖加上單通道高斯雜訊，再乘一個學來的逐通道係數。控制隨機細節，不動全域結構。

**截斷手法（truncation trick）。** 推論（inference）時抽 `z`，算 `w = mapping(z)`，然後 `w' = ŵ + ψ·(w - ŵ)`，其中 `ŵ` 是很多樣本上 `w` 的平均。`ψ < 1` 以多樣性換取品質。幾乎每個 StyleGAN 展示都用 `ψ ≈ 0.7`。

## StyleGAN 從 1 到 2 到 3

| 版本 | 年份 | 創新 |
|---------|------|------------|
| StyleGAN | 2019 | 映射網路加 AdaIN、雜訊、漸進式增長（progressive growing）。 |
| StyleGAN2 | 2020 | 權重解調（weight demodulation）換掉 AdaIN，修好水滴狀瑕疵；跳躍／殘差架構；路徑長度正則（path-length regularization）。 |
| StyleGAN3 | 2021 | 無混疊（alias-free）卷積加等變核（kernel）；紋理不再黏在像素格子上。 |
| StyleGAN-XL | 2022 | 類別條件、1024²、ImageNet。 |
| R3GAN | 2024 | 用更強的正則以更強的正則化重新設計；在 FFHQ-1024 上縮小和擴散的差距，參數（parameter）少到 20 分之一。 |

2026 年 StyleGAN3 仍是這些的預設：(a) 高畫面更新率（FPS）的窄領域照片級寫實，(b) 少樣本（few-shot）領域調適（domain adaptation），用 100 張影像訓練新的資料集（dataset），映射網路凍住，(c) 以反演為基礎的編輯，找出能重建一張真實照片的 `w`，再編那個 `w`。開放領域的文字生影像，不該用它——擴散才是。

```figure
gx-stylegan-mapping
```

## Build It｜動手實作

`code/main.py` 實作一維的玩具「精簡 style-GAN」：一個映射 MLP，一個合成函數，吃學來的常數向量，用從 `w` 來的縮放和偏置去調它，再加上逐層雜訊。它顯示：透過仿射調變注入 `w`，比得上或贏過把 `z` 串進產生器輸入。

### 步驟 1：映射網路

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### 步驟 2：自適應實例正規化

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

每個特徵圖的縮放和偏置，來自 `w` 的線性投影。

### 步驟 3：逐層雜訊

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

逐通道的 sigma 是可學的。

## 容易踩的坑

- **水滴狀瑕疵（droplet artifact）。** StyleGAN 1 的特徵圖裡會出現一塊塊水滴，因為 AdaIN 把平均數消成零。StyleGAN 2 的權重解調改成縮放卷積權重，把這個修好。
- **紋理黏住（texture sticking）。** StyleGAN 1 和 2 的紋理跟著像素座標，不跟物體座標，插值時看得到。StyleGAN 3 的無混疊卷積用加窗 sinc 濾波器修好。
- **模式覆蓋。** 截斷 `ψ < 0.7` 看起來乾淨，但樣本來自一個窄錐；需要多樣性就用 `ψ = 1.0`。
- **反演有損。** 把真實照片反演進 `W`，通常靠數值搜尋，或靠編碼器，e4e、ReStyle、HyperStyle。迭代多次，結果會逐漸偏移。

## Use It｜實際應用

| 用途 | 做法 |
|----------|----------|
| 照片級寫實的人臉，動漫、產品、窄領域也算 | StyleGAN3 FFHQ，或自訂 fine-tune |
| 從照片編輯臉 | e4e 反演，加上 StyleSpace／InterFaceGAN 方向 |
| 換臉／重新驅動 | StyleGAN 加編碼器，再混合 |
| 虛擬人管線（pipeline） | StyleGAN3 配 ADA，做少資料的 fine-tune |
| 從幾張影像做領域調適 | 凍住映射網路，fine-tune 合成網路 |
| 多模態或文字條件的生成 | 別用——改用擴散 |

產品級的展示，答案就是「某人臉部的照片」時，StyleGAN 在推論成本上打得過擴散：一次前向傳遞，4090 上不到 10 ms，同樣的品質標準也更銳。

## Ship It｜交付成果

存成 `outputs/skill-stylegan-inversion.md`。這個 skill 吃一張真實照片，輸出：反演方法，e4e／ReStyle／HyperStyle；預期的潛在損失；編輯預算，在 `W` 裡能走多遠才出現假影；以及已知好用的編輯方向清單，年齡、表情、姿勢。

## Exercises｜練習

1. **簡單。** `adain_on=True` 和 `adain_on=False` 各跑一次 `code/main.py`。比較固定潛在和被擾動潛在的輸出散開程度。
2. **中等。** 實作混合正則（mixing regularization）：一個訓練批次（batch）算出 `w_a`、`w_b`，合成的前半用 `w_a`，後半用 `w_b`。解碼器會學到解開的風格（disentangled）嗎？
3. **困難。** 拿一個預訓練（pretrained）的 StyleGAN3 FFHQ 模型，ffhq-1024.pkl。在有標籤（label）的樣本上訓練 SVM，找出控制「微笑」的 `w` 方向；報告身份開始漂之前你能推多遠。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 映射網路 | 「那個 MLP」 | `f: Z → W`，8 層，把潛在幾何和資料統計拆開。 |
| W 空間 | 「風格空間」 | 映射網路的輸出；大致是解開的。 |
| AdaIN | 「自適應實例正規化」 | 正規化特徵圖，再用 `w` 的投影做縮放和位移。 |
| 截斷手法 | 「Psi」 | `w = mean + ψ·(w - mean)`，ψ 小於 1 時以多樣性換取品質。 |
| 路徑長度正則 | 「PL reg」 | 懲罰影像對 `w` 的單位變化變太大；讓 `W` 更平滑。 |
| 權重解調 | 「StyleGAN2 的修法」 | 正規化的是卷積權重，不是活化（activation）；水滴狀瑕疵消失。 |
| 無混疊 | 「StyleGAN3 的手法」 | 加窗 sinc 濾波器；紋理不再黏在像素格子上。 |
| 反演 | 「幫真實影像找 w」 | 搜尋或編碼 `x → w`，讓 `G(w) ≈ x`。 |

## 正式環境筆記：為什麼 2026 年還在出貨 StyleGAN

StyleGAN3 在 4090 上生成一張 1024² 的 FFHQ 臉，不到 10 ms——`num_steps = 1`，沒有 VAE 解碼，沒有交叉注意力那一趟。放到正式環境裡看，這是任何影像產生器的延遲（latency）地板。同樣解析度、50 步的 SDXL 加 VAE 解碼管線大約 3 秒。那是 **300 倍**的差距。窄領域產品，虛擬人服務、證件管線、素材臉的生成，在總持有成本（TCO）上它贏。

兩個操作上的後果：

- **沒有排程器，也沒有批次器。** 在目標佔用率放一個靜態批次就是最好。連續批次（continuous batching）對 LLM 和擴散很必要，這裡一點好處都沒有，因為每個請求的 FLOPs 都一樣。
- **截斷 `ψ` 是安全旋鈕。** `ψ < 0.7` 從映射網路範圍裡的一個窄錐取樣。這是服務層能控制樣本變異的唯一槓桿。尖峰負載把 `ψ` 調低，付費使用者再調高。

## Further Reading｜延伸閱讀

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948) ——StyleGAN。
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) ——StyleGAN2。
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) ——StyleGAN3。
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766) ——e4e 反演。
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273) ——StyleGAN-XL。
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441) ——現代的極簡 GAN 配方。
