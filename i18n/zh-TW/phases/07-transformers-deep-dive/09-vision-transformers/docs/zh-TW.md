# 視覺 Transformer（Vision Transformer，ViT）

> 一張影像是一格一格的圖塊（patch）。一句話是一格一格的 token。同一個 transformer 兩者都能處理。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 4 · 03 (CNNs), Phase 4 · 14 (Vision Transformers intro)
**Time:** ~45 minutes

## The Problem｜問題

2020 年以前，電腦視覺主要依賴卷積（convolution）。ImageNet、COCO、偵測評測上的每一個最前沿，都用 CNN 當骨幹。Transformer 是給語言用的。

Dosovitskiy et al.（2020）——「An Image is Worth 16x16 Words」——顯示你可以把卷積整個丟掉。把影像切成固定大小的圖塊（patch），每個圖塊線性投影（linear projection）成一個 embedding，再把這條序列送進標準的 transformer 編碼器。規模夠大時（ImageNet-21k 預訓練或更大），ViT 打平或打贏以 ResNet 為底的模型。

ViT 開了一個 2026 年更廣的模式：一種架構，很多模態。Whisper 把音訊切成 token。ViT 把影像切成 token。機器人用動作 token。影片用像素 token。Transformer 不在乎——餵它一條序列，它就學。

到 2026 年，ViT 和它的後代（DeiT、Swin、DINOv2、ViT-22B、SAM 3）成為多數視覺任務的主流。CNN 仍然在邊緣裝置（device）和對延遲（latency）敏感的任務上贏。其他地方的堆疊裡，某處都會有一個 ViT。

## The Concept｜核心概念

![Image → patches → tokens → transformer](../assets/vit.svg)

### 步驟 1——切成圖塊

把一張 `H × W × C` 的影像切成 `N × (P·P·C)` 的扁平圖塊序列。典型設定：`224 × 224` 的影像、`16 × 16` 的圖塊 → 196 個圖塊，每個 768 個值。

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

圖塊大小是那個槓桿。圖塊越小 = token 越多、解析度越好、注意力的二次方成本越高。圖塊越大 = 越粗、越便宜。

### 步驟 2——線性 embedding

一個學來的矩陣把每個扁平圖塊投影到 `d_model`。等價於核（kernel）大小 `P`、步幅（stride）`P` 的卷積。在 PyTorch 裡這就是 `nn.Conv2d(C, d_model, kernel_size=P, stride=P)`——只需兩行程式碼。

### 步驟 3——在前面加上 `[CLS]` token，再加位置 embedding

- 在前面加上一個可學習的 `[CLS]` token。它最終的隱藏狀態（hidden state）就是用來分類的影像表示。
- 加上可學習的位置 embedding（原始 ViT），或二維正弦（後來的變體）。
- 2024 年之後，RoPE 延伸到二維位置，有時不再用明確的 embedding。

### 步驟 4——標準的 transformer 編碼器

疊 L 個區塊：`LayerNorm → Self-Attention → + → LayerNorm → MLP → +`。和 BERT 一樣。沒有視覺專用的層。這就是那篇論文在教學上的重點。

### 步驟 5——頭

分類：取 `[CLS]` 的隱藏狀態 → 線性 → softmax。DINOv2 或 SAM 則丟掉 `[CLS]`，直接用圖塊 embedding。

### 真正要緊的變體

| 模型 | 年 | 改變 |
|-------|------|--------|
| ViT | 2020 | 原始的。固定圖塊大小，完整的全域注意力。 |
| DeiT | 2021 | 蒸餾；只在 ImageNet-1k 上就能訓練。 |
| Swin | 2021 | 階層式，帶位移視窗。次二次方的成本是固定的。 |
| DINOv2 | 2023 | 自監督（self-supervised，沒有標籤）。最好的通用視覺特徵（feature）。 |
| ViT-22B | 2023 | 220 億參數；縮放規律適用。 |
| SigLIP | 2023 | ViT 加語言配對，sigmoid 對比損失。 |
| SAM 3 | 2025 | 分割任何東西；ViT-Large 加可用 prompt 的遮罩解碼器。 |

### 為什麼花了一段時間

ViT 要*很多*資料才打得平 CNN，因為它沒有 CNN 的歸納偏差（inductive bias）：平移不變、局部性。沒有超過 1 億張有標籤（label）的影像，或強力的自監督預訓練，在相同計算量下 CNN 仍然贏。DeiT 在 2021 年用蒸餾手法補上；DINOv2 在 2023 年用自監督把它永久補上。

```figure
n5-patch-stream
```

## Build It｜動手實作

見 `code/main.py`。僅用標準函式庫切分圖塊、線性 embedding、和健全檢查。沒有訓練——任何實際規模的 ViT 都需要 PyTorch 和數小時的 GPU 時間。

### 步驟 1：假影像

一張 24 × 24 的 RGB 影像，是一列列的 `(R, G, B)` 元組。我們用 6×6 的圖塊 → 16 個圖塊，每個是 108 維（dimension）的 embedding 向量。

### 步驟 2：切成圖塊

```python
def patchify(image, P):
    H = len(image)
    W = len(image[0])
    patches = []
    for i in range(0, H, P):
        for j in range(0, W, P):
            patch = []
            for di in range(P):
                for dj in range(P):
                    patch.extend(image[i + di][j + dj])
            patches.append(patch)
    return patches
```

光柵順序：格子上的列優先。每個 ViT 都用這個順序。

### 步驟 3：線性 embedding

每個扁平圖塊乘上一個隨機的 `(patch_flat_size, d_model)` 矩陣。確認在前面加上 `[CLS]` 之後，輸出形狀是 `(N_patches + 1, d_model)`。

### 步驟 4：數一個實際 ViT 的參數

印出 ViT-Base 的參數數量：12 層、12 個頭、d = 768、圖塊 = 16。和 ResNet-50（約 2500 萬）比。ViT-Base 落在約 8600 萬。ViT-Large 約 3.07 億。ViT-Huge 約 6.32 億。

## Use It｜實際應用

```python
from transformers import ViTImageProcessor, ViTModel
import torch
from PIL import Image

processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224-in21k")
model = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k")

img = Image.open("cat.jpg")
inputs = processor(img, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, 197, 768): [CLS] + 196 patches
cls_emb = out[:, 0]                       # image representation
```

**DINOv2 的 embedding 是 2026 年影像特徵的預設。** 把骨幹凍住，訓練一個小小的頭。分類、檢索、偵測、配字都行。Meta 的 DINOv2 checkpoint 在每一個非文字的視覺任務上表現勝過 CLIP。

**挑圖塊大小。** 小模型用 16×16（ViT-B/16）。稠密預測（分割）用 8×8 或 14×14（SAM、DINOv2）。非常大的模型用 14×14。

## Ship It｜交付成果

見 `outputs/skill-vit-configurator.md`。這個 skill 依資料集（dataset）大小、解析度、運算預算，為新的視覺任務挑 ViT 變體和圖塊大小。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。確認圖塊數等於 `(H/P) * (W/P)`，扁平圖塊的維度等於 `P*P*C`。
2. **中等。** 實作二維正弦位置 embedding——每個圖塊的 `row` 和 `col` 各一份獨立的正弦編碼，再接起來。送進一個小小的 PyTorch ViT，在 CIFAR-10 上和可學習的位置 embedding 比準確率（accuracy）。
3. **困難。** 做一個 3 層 ViT（PyTorch），用 4×4 圖塊在 1000 張 MNIST 影像上訓練。量測試準確率。再在同樣的 1000 張影像上加 DINOv2 預訓練（簡化版：只訓練編碼器，從被遮住的圖塊預測圖塊 embedding）。準確率會提高嗎？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 圖塊 | 「視覺 transformer 的 token」 | 影像上一塊 `P × P × C` 區域的像素值，拉成扁平向量。 |
| 切成圖塊 | 「切再開平」 | 把影像切成不重疊的圖塊，每個拉成一個向量。 |
| `[CLS]` token | 「影像的摘要」 | 加在前面的可學習 token；它最終的 embedding 就是影像表示。 |
| 歸納偏差 | 「模型假設了什麼」 | ViT 的先驗比 CNN 少；要更多資料才補得上落差。 |
| DINOv2 | 「自監督的 ViT」 | 不用標籤訓練，用影像增強加動量教師。2026 年最好的通用影像特徵。 |
| SigLIP | 「CLIP 的後繼」 | ViT 加文字編碼器，用 sigmoid 對比損失訓練；在相同計算量下比 CLIP 好。 |
| Swin | 「開了視窗的 ViT」 | 階層式 ViT，局部注意力加位移視窗；次二次方。 |
| 暫存器 token | 「2023 年的手法」 | 幾個額外的可學習 token，把吸收多餘的注意力；改善 DINOv2 的特徵。 |

## Further Reading｜延伸閱讀

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929) ——ViT 論文。
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877) ——DeiT。
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030) ——Swin。
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193) ——DINOv2。
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588) ——DINOv2 的暫存器 token 修法。
