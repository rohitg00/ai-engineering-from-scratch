# 視覺 transformer（Vision Transformer，ViT）

> 把影像切成小塊（patch），把每個小塊當成一個詞，跑一個標準的 transformer。不用再回頭。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 Lesson 02 (Self-Attention), Phase 4 Lesson 04 (Image Classification)
**Time:** ~45 minutes

## Learning Objectives｜學習目標

- 從零實作 patch embedding（小塊 embedding）、學來的 positional embedding（位置 embedding）、class token（類別 token）、以及 transformer 編碼器（encoder）區塊，組出一個最小的 ViT
- 說明為什麼大家一度以為 ViT 需要海量預訓練資料，直到 DeiT 和 MAE 證明並非如此
- 比較 ViT、Swin、ConvNeXt 的架構先驗：沒有、局部視窗注意力、卷積骨幹（backbone）
- 用 `timm` 和標準的線性探測（linear probe）／fine-tuning 做法，在小資料集（dataset）上 fine-tune 一個預訓練的 ViT

## The Problem｜問題

有十年，卷積（convolution）幾乎就等於電腦視覺。CNN 有很強的歸納偏誤（inductive bias）：局部性、平移等變（translation equivariance）。當時沒有人認為這些歸納偏誤能被取代。然後 Dosovitskiy 等人（2020）顯示，把普通的 transformer 用在展平的影像小塊上，完全不用卷積那套，在夠大的規模就能打平或贏過最好的 CNN。

但條件是「夠大的規模」。ViT 在 ImageNet-1k 上輸給 ResNet。先在 ImageNet-21k 或 JFT-300M 上預訓練，再在 ImageNet-1k 上 fine-tuning，就贏了。結論是 transformer 缺少有用的先驗，但資料夠多就能學到。後來的工作（DeiT、MAE、DINO）顯示，訓練配方對了，強的資料增強（augmentation）、自監督預訓練、蒸餾，小資料上 ViT 也訓得起來。

到 2026 年，純 CNN 在邊緣裝置上仍有競爭力（ConvNeXt 最強），但其他地方是 transformer 在主導：分割（Mask2Former、SegFormer）、偵測（DETR、RT-DETR）、多模態（CLIP、SigLIP）、影片（VideoMAE、VJEPA）。要熟的是 ViT 的區塊結構。

## The Concept｜核心概念

### 這條管線（pipeline）

```mermaid
flowchart LR
    IMG["影像<br/>(3, 224, 224)"] --> PATCH["patch embedding（小塊 embedding）<br/>卷積 16x16 s=16<br/>-> (768, 14, 14)"]
    PATCH --> FLAT["展平成<br/>(196, 768) 個 token"]
    FLAT --> CAT["前面接上<br/>[CLS] token"]
    CAT --> POS["加上學來的<br/>positional embedding（位置 embedding）"]
    POS --> ENC["N 個 transformer<br/>編碼器區塊"]
    ENC --> CLS["取出 [CLS]<br/>token 的輸出"]
    CLS --> HEAD["MLP 分類器"]

    style PATCH fill:#dbeafe,stroke:#2563eb
    style ENC fill:#fef3c7,stroke:#d97706
    style HEAD fill:#dcfce7,stroke:#16a34a
```

七步。小塊變成 token，再做注意力，再進分類器。每個變體（DeiT、Swin、ConvNeXt、MAE 預訓練）只改這七步裡的一兩步，其餘不動。

### patch embedding（小塊 embedding）

第一個卷積是關鍵。核大小 16、步幅 16，所以 224x224 的影像變成 14x14 格、每格 16x16 的小塊，再投影成 768 維的 embedding。這一個卷積同時把影像切成小塊，並做線性投影。

```
Input:  (3, 224, 224)
Conv (3 -> 768, k=16, s=16, no padding):
Output: (768, 14, 14)
Flatten spatial: (196, 768)
```

196 個小塊就是 196 個 token。每個 token 的特徵（feature）維度是 768（ViT-B）、1024（ViT-L）或 1280（ViT-H）。

### class token（類別 token）

序列前面接上一個學來的向量：

```
tokens = [CLS; patch_1; patch_2; ...; patch_196]   shape (197, 768)
```

經過 N 個 transformer 區塊之後，`[CLS]` 的輸出就是整張影像的表示。分類頭只讀這一個向量。

### positional embedding（位置 embedding）

transformer 本身不知道空間位置。每個 token 加上一個學來的向量：

```
tokens = tokens + learned_pos_embedding   (also shape (197, 768))
```

這個 embedding 是模型的參數（parameter）。用梯度（gradient）訓練，它會適應 2D 影像的結構。也有正弦的 2D 替代，實務上很少用。

### transformer 編碼器區塊

就是標準的那一塊。多頭自注意力（self-attention）、MLP、殘差連接、前 LayerNorm。

```
x = x + MSA(LN(x))
x = x + MLP(LN(x))

MLP is two-layer with GELU: Linear(d -> 4d) -> GELU -> Linear(4d -> d)
```

ViT-B/16 疊 12 個這樣的區塊，每個 12 個注意力頭，一共 8600 萬個參數。

### 為什麼用前 LayerNorm

早期 transformer 用後 LayerNorm（`x = LN(x + sublayer(x))`），沒有預熱（warmup）就很難訓過 6 到 8 層。前 LayerNorm（`x = x + sublayer(LN(x))`）可以穩定地訓練更深的網路，而且不用預熱。每個 ViT、每個現代 LLM 都用前 LayerNorm。

### 小塊大小的取捨

- 16x16 的小塊，196 個 token，標準。
- 32x32 的小塊，49 個 token，較快，但解析度較低。
- 8x8 的小塊，784 個 token，較細，但 O(n^2) 的注意力成本會變得很糟。

小塊越大，token 越少，越快，空間細節越少。SwinV2 在階層視窗裡用 4x4 的小塊。

### DeiT：讓 ViT 能在 ImageNet-1k 上訓練的配方

原始 ViT 要靠 JFT-300M 才贏過 CNN。DeiT（Touvron 等人，2020）只在 ImageNet-1k 上把 ViT-B 訓到 top-1 81.8%，改了四件事：

1. 很重的資料增強：RandAugment、Mixup、CutMix、Random Erasing。
2. 隨機深度：訓練時隨機整塊丟掉。
3. 重複增強：同一張影像在一個批次裡抽 3 次。
4. 從 CNN 老師蒸餾（可選，準確率（accuracy）還能再抬高）。

每個現代 ViT 訓練配方都從 DeiT 演變而來。

### Swin 對 ConvNeXt

- **Swin**（Liu 等人，2021）。以視窗為單位的注意力。每個區塊只在局部視窗裡注意。下一個區塊把視窗平移，讓資訊跨視窗混合。把 CNN 那種局部性先驗帶回來，注意力這個算子還留著。
- **ConvNeXt**（Liu 等人，2022）。重新設計的 CNN，對齊 Swin 的架構選擇：深度卷積（depthwise convolution）、LayerNorm、GELU、倒置瓶頸（inverted bottleneck）。它顯示差距不在「注意力對卷積」，而在「現代訓練配方加架構」。

2026 年，ConvNeXt-V2 和 Swin-V2 都達到正式環境的水準。選哪個，看你的推論（inference）堆疊（ConvNeXt 編譯起來更適合邊緣），以及預訓練語料。

### MAE 預訓練

遮罩自編碼器（Masked Autoencoder，He 等人，2022）：隨機遮掉 75% 的小塊，編碼器只處理看得到的 25%，再用一個小解碼器，從編碼器的輸出把被遮住的小塊重建回來。預訓練之後丟掉解碼器，對編碼器做 fine-tuning。

MAE 讓 ViT 單靠 ImageNet-1k 就訓得動，打到目前最好，也是目前自監督的預設配方。

```figure
batchnorm-inference
```

## Build It｜動手實作

### 步驟 1：patch embedding（小塊 embedding）

```python
import torch
import torch.nn as nn

class PatchEmbedding(nn.Module):
    def __init__(self, in_channels=3, patch_size=16, dim=192, image_size=64):
        super().__init__()
        assert image_size % patch_size == 0
        self.proj = nn.Conv2d(in_channels, dim, kernel_size=patch_size, stride=patch_size)
        num_patches = (image_size // patch_size) ** 2
        self.num_patches = num_patches

    def forward(self, x):
        x = self.proj(x)
        return x.flatten(2).transpose(1, 2)
```

一個卷積、一次展平、一次轉置。影像變成 token 就這一步。

### 步驟 2：transformer 區塊

前 LayerNorm、多頭自注意力、帶 GELU 的 MLP、殘差連接。

```python
class Block(nn.Module):
    def __init__(self, dim, num_heads, mlp_ratio=4, dropout=0.0):
        super().__init__()
        self.ln1 = nn.LayerNorm(dim)
        self.attn = nn.MultiheadAttention(dim, num_heads, dropout=dropout, batch_first=True)
        self.ln2 = nn.LayerNorm(dim)
        self.mlp = nn.Sequential(
            nn.Linear(dim, dim * mlp_ratio),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(dim * mlp_ratio, dim),
            nn.Dropout(dropout),
        )

    def forward(self, x):
        a, _ = self.attn(self.ln1(x), self.ln1(x), self.ln1(x), need_weights=False)
        x = x + a
        x = x + self.mlp(self.ln2(x))
        return x
```

`nn.MultiheadAttention` 負責拆成多頭、縮放的點積，以及輸出投影。`batch_first=True` 讓形狀是 `(N, seq, dim)`。

### 步驟 3：ViT

```python
class ViT(nn.Module):
    def __init__(self, image_size=64, patch_size=16, in_channels=3,
                 num_classes=10, dim=192, depth=6, num_heads=3, mlp_ratio=4):
        super().__init__()
        self.patch = PatchEmbedding(in_channels, patch_size, dim, image_size)
        num_patches = self.patch.num_patches
        self.cls_token = nn.Parameter(torch.zeros(1, 1, dim))
        self.pos_embed = nn.Parameter(torch.zeros(1, num_patches + 1, dim))
        self.blocks = nn.ModuleList([
            Block(dim, num_heads, mlp_ratio) for _ in range(depth)
        ])
        self.ln = nn.LayerNorm(dim)
        self.head = nn.Linear(dim, num_classes)
        nn.init.trunc_normal_(self.pos_embed, std=0.02)
        nn.init.trunc_normal_(self.cls_token, std=0.02)

    def forward(self, x):
        x = self.patch(x)
        cls = self.cls_token.expand(x.size(0), -1, -1)
        x = torch.cat([cls, x], dim=1)
        x = x + self.pos_embed
        for blk in self.blocks:
            x = blk(x)
        x = self.ln(x[:, 0])
        return self.head(x)

vit = ViT(image_size=64, patch_size=16, num_classes=10, dim=192, depth=6, num_heads=3)
x = torch.randn(2, 3, 64, 64)
print(f"output: {vit(x).shape}")
print(f"params: {sum(p.numel() for p in vit.parameters()):,}")
```

大約 280 萬個參數。小到能在 CPU 上跑。真正的 ViT-B 是 8600 萬。同一個類別定義，改成 `dim=768, depth=12, num_heads=12` 就是。

### 步驟 4：健全檢查，單張影像推論

```python
logits = vit(torch.randn(1, 3, 64, 64))
print(f"logits: {logits}")
print(f"probs:  {logits.softmax(-1)}")
```

應該能跑完，而且不報錯。機率加總是 1。

## Use It｜實際應用

`timm` 提供每個 ViT 變體，以及 ImageNet 預訓練權重（weight）。一行：

```python
import timm

model = timm.create_model("vit_base_patch16_224", pretrained=True, num_classes=10)
```

2026 年，`timm` 是視覺 transformer 在正式環境的預設。同一套 API 支援 ViT、DeiT、Swin、Swin-V2、ConvNeXt、ConvNeXt-V2、MaxViT、MViT、EfficientFormer，以及幾十個別的。

多模態（影像加文字）用 `transformers`，裡面有 CLIP、SigLIP、BLIP-2、LLaVA。這些模型的影像編碼器都是 ViT 的變體。

## Ship It｜交付成果

本課會產出：

- `outputs/prompt-vit-vs-cnn-picker.md`：一份 prompt，依資料集大小、計算和推論堆疊，在 ViT、ConvNeXt、Swin 之間挑一個
- `outputs/skill-vit-patch-and-pos-embed-inspector.md`：一項技能，檢查 ViT 的 patch embedding（小塊 embedding） 和 positional embedding（位置 embedding） 形狀是否對上模型預期的序列長度，抓出最常見的移植 bug

## Exercises｜練習

1. **（簡單）** 印出上面那個小 ViT 前向傳遞裡，每個中間張量（tensor）的形狀。確認：輸入 `(N, 3, 64, 64)`，小塊 `(N, 16, 192)`，加上 CLS 是 `(N, 17, 192)`，分類器輸入 `(N, 192)`，輸出 `(N, num_classes)`。
2. **（中等）** 在第 4 課的合成 CIFAR 資料集上，fine-tune 一個預訓練的 `timm` ViT-S/16。和同一份資料上的 ResNet-18 fine-tuning 比較。回報訓練時間和最後的準確率。
3. **（困難）** 為這個小 ViT 實作 MAE 預訓練：遮掉 75% 的小塊，訓練編碼器加上一個小解碼器，重建被遮住的小塊。比較預訓練前後，在合成資料上的線性探測準確率。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|----------------------|
| patch embedding（小塊 embedding） | 「第一個卷積」 | 核大小等於步幅、也等於小塊大小的卷積。把影像變成一格格的 token embedding |
| class token（類別 token） | 「[CLS]」 | 接在 token 序列前面的學來向量。它最後的輸出就是整張影像的表示 |
| positional embedding（位置 embedding） | 「學來的位置」 | 加到每個 token 上的學來向量，讓 transformer 知道每個小塊從哪來 |
| 前 LayerNorm | 「子層之前做 LayerNorm」 | 較穩的 transformer 變體：是 `x + sublayer(LN(x))`，不是 `LN(x + sublayer(x))` |
| 多頭注意力 | 「平行的注意力」 | 標準 transformer 注意力拆成 num_heads 個獨立子空間，再接回來 |
| ViT-B/16 | 「Base，小塊 16」 | 標準尺寸：dim=768、depth=12、heads=12、patch_size=16、影像 224。大約 8600 萬參數 |
| DeiT | 「資料效率高的 ViT」 | 只在 ImageNet-1k 上、用很強的增強訓練的 ViT。證明超大預訓練資料集不是硬性必要 |
| MAE | 「遮罩自編碼器」 | 自監督預訓練：遮掉 75% 的小塊再重建。目前主流的 ViT 預訓練配方 |

## Further Reading｜延伸閱讀

- [An Image is Worth 16x16 Words (Dosovitskiy et al., 2020)](https://arxiv.org/abs/2010.11929) ——ViT 那篇論文
- [DeiT: Data-efficient Image Transformers (Touvron et al., 2020)](https://arxiv.org/abs/2012.12877) ——怎麼只在 ImageNet-1k 上訓練 ViT
- [Masked Autoencoders are Scalable Vision Learners (He et al., 2022)](https://arxiv.org/abs/2111.06377) ——MAE 預訓練
- [timm documentation](https://huggingface.co/docs/timm) ——你在正式環境會用到的每個視覺 transformer 的參考
