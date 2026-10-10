# 3D 生成

> 3D 是3D 最能從 2D 技術獲益的模態。2023 年的突破是 3D Gaussian Splatting。2024 到 2026 這波生成，是在上面再疊多視角擴散（multi-view diffusion）加 3D 重建（reconstruction），從一段 prompt 或一張照片產出物件和場景。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 4 (Vision), Phase 8 · 07 (Latent Diffusion)
**Time:** ~45 minutes

## The Problem｜問題

3D 內容很難做：

- **表示法（representation）。** 網格（mesh）、點雲（point cloud）、體素網格（voxel grid）、有號距離場（signed distance field，SDF）、神經輻射場（neural radiance field，NeRF）、3D Gaussian。每一種都有取捨。
- **資料稀缺。** ImageNet 有 1400 萬張影像。最大的乾淨 3D 資料集（dataset）是 Objaverse-XL（2023），約有 1000 萬個物件，多數品質不高。
- **記憶體。** 512³ 的體素網格有 1.28 億個體素；一個有用的場景 NeRF，每條射線要 100 萬個取樣點。生成比重建更難。
- **監督（supervision）。** 2D 影像你手上有像素。3D 通常只有少數幾張 2D 視角，還得抬升（lift）到 3D。

2026 年的做法把兩個問題拆開。先用擴散模型生成*2D 多視角影像*。再把*3D 表示*（通常是 Gaussian splatting）擬合（fit）到那些影像上。

## The Concept｜核心概念

![3D generation: multi-view diffusion + 3D reconstruction](../assets/3d-generation.svg)

### 表示法：3D Gaussian Splatting（Kerbl et al.，2023）

把場景表示成約 100 萬個 3D Gaussian 組成的雲。每個有 59 個參數：位置 3 個；共變異數（covariance）6 個，或寫成四元數（quaternion）4 個加尺度 3 個；不透明度（opacity）1 個；球諧（spherical harmonics）顏色在 3 階有 48 個、在 0 階有 3 個。

渲染 = 投影 + alpha 合成（alpha compositing）。很快（4090 上、1080p、約 100 fps）。可微分（differentiable）。用梯度下降法（gradient descent）對著真實照片（ground-truth）擬合。消費級 GPU 上，一個場景 5 到 30 分鐘擬合完。

上面還有兩個 2023 到 2024 的新做法：

- **生成式 Gaussian splat。** LGM、LRM、InstantMesh 這類模型，從一張或少數幾張影像直接預測 Gaussian 雲。
- **4D Gaussian Splatting。** Gaussian 帶每幀偏移，用來做動態場景。

### 多視角擴散

拿一個已經預訓練（pretrained）過的影像擴散模型來 fine-tune，讓它從文字 prompt 或單張影像，生成同一物件、彼此一致的多個視角。Zero123（Liu et al.，2023）、MVDream（Shi et al.，2023）、SV3D（Stability，2024）、CAT3D（Google，2024）。通常繞著物件輸出 4 到 16 個視角，再經 Gaussian splatting 或 NeRF 抬到 3D。

### 文字到 3D 的管線（pipeline）

| 模型 | 輸入 | 輸出 | 時間 |
|------|------|------|------|
| DreamFusion (2022) | 文字 | 經由 SDS（score distillation sampling）的 NeRF | 每個資產約 1 小時 |
| Magic3D | 文字 | 網格 + 貼圖 | 約 40 分鐘 |
| Shap-E (OpenAI, 2023) | 文字 | 隱式（implicit）3D | 約 1 分鐘 |
| SJC / ProlificDreamer | 文字 | NeRF／網格 | 約 30 分鐘 |
| LRM (Meta, 2023) | 影像 | triplane | 約 5 秒 |
| InstantMesh (2024) | 影像 | 網格 | 約 10 秒 |
| SV3D (Stability, 2024) | 影像 | 新視角（novel view） | 約 2 分鐘 |
| CAT3D (Google, 2024) | 1 到 64 張影像 | 3D NeRF | 約 1 分鐘 |
| TripoSR (2024) | 影像 | 網格 | 約 1 秒 |
| Meshy 4 (2025) | 文字 + 影像 | PBR（physically-based rendering）網格 | 約 30 秒 |
| Rodin Gen-1.5 (2025) | 文字 + 影像 | PBR 網格 | 約 60 秒 |
| Tencent Hunyuan3D 2.0 (2025) | 影像 | 網格 | 約 30 秒 |

2025 到 2026 的方向：直接的文字到網格模型，帶 PBR 材質，適合遊戲引擎。對一般物件，多視角擴散這個中間步驟仍是效果最好的配方。

### NeRF（當背景）

Neural Radiance Field（Mildenhall et al.，2020）。一個很小的 MLP 吃 `(x, y, z, view direction)`，輸出 `(color, density)`。沿著射線積分來渲染。品質上勝過以網格為本的新視角合成，但渲染慢上 100 到 1000 倍。即時用途大多被 Gaussian splatting 取代，研究裡仍是主流。

```figure
v4-3d-multiview
```

## Build It｜動手實作

`code/main.py` 實作一個玩具版的 2D「Gaussian splatting」擬合：把一張合成目標影像（平滑漸層）表示成一堆 2D Gaussian splat 的和。用梯度下降法調整位置、顏色和共變異數，使它對上目標。你會看到兩個核心運算：前向渲染（splat 加 alpha 合成），以及用梯度下降法擬合。

### 步驟 1：2D Gaussian splat

```python
def gaussian_at(x, y, gaussian):
    px, py = gaussian["pos"]
    sigma = gaussian["sigma"]
    d2 = (x - px) ** 2 + (y - py) ** 2
    return math.exp(-d2 / (2 * sigma * sigma))
```

### 步驟 2：把 splat 加總來渲染

```python
def render(image_size, gaussians):
    img = [[0.0] * image_size for _ in range(image_size)]
    for g in gaussians:
        for y in range(image_size):
            for x in range(image_size):
                img[y][x] += g["color"] * gaussian_at(x, y, g)
    return img
```

真正的 3D Gaussian splatting 依深度把 Gaussian 排序，再依序做 alpha 合成。我們這個 2D 玩具只做加總。

### 步驟 3：用梯度下降法擬合

```python
for step in range(steps):
    pred = render(size, gaussians)
    loss = mse(pred, target)
    gradients = compute_grads(pred, target, gaussians)
    update(gaussians, gradients, lr)
```

## 容易踩的坑

- **視角不一致。** 若 4 個視角各自生成，而且物件結構彼此對不上，3D 擬合就會糊。修法：用共享注意力（attention）的多視角擴散。
- **背面幻覺（hallucination）。** 單張影像到 3D，得把沒看到的那一面編出來。品質落差很大。
- **Gaussian splat 爆掉。** 不加約束的訓練會長到 1000 萬個 splat，而且過度擬合（overfit）。致密化（densification）加修剪（pruning）這些啟發式（來自 3D-GS 原論文）缺一不可。
- **拓撲（topology）問題。** 從隱式場（SDF）做出的網格常有破洞或自交。出貨前先跑重網格器（remesher），例如 blender 的體素重網格。
- **訓練資料的授權。** Objaverse 的授權混在一起；能不能商用，每個模型不同。

## Use It｜實際應用

| 任務 | 2026 年的選擇 |
|------|-----------|
| 用照片重建場景 | Gaussian splatting（3DGS、Gsplat、Scaniverse） |
| 給遊戲用的文字生 3D 物件 | Meshy 4 或 Rodin Gen-1.5（PBR 輸出） |
| 影像生 3D | Hunyuan3D 2.0、TripoSR、InstantMesh |
| 從少數影像做新視角合成 | CAT3D、SV3D |
| 動態場景重建 | 4D Gaussian Splatting |
| 虛擬人（avatar）／穿衣人體 | Gaussian Avatar、HUGS |
| 研究／SOTA | 上週剛放出來的那個 |

若要在遊戲或電商管線裡出貨生產級 3D：Meshy 4 或 Rodin Gen-1.5 輸出的 PBR 網格，可以直接進 Unity／Unreal。

## Ship It｜交付成果

存成 `outputs/skill-3d-pipeline.md`。這個 skill 吃一份 3D 簡報（輸入：文字／一張影像／少數影像；輸出：網格／splat／NeRF；用途：渲染／遊戲／VR），輸出：管線（多視角擴散加擬合，或直接的網格模型）、基模型（base model）、迭代預算、拓撲後處理、需要的材質通道。

## Exercises｜練習

1. **簡單。** 用 4、16、64 個 Gaussian 跑 `code/main.py`。回報相對目標的最終 MSE。
2. **中等。** 擴充成彩色 Gaussian（RGB）。確認重建對得上目標的顏色模式。
3. **困難。** 用 gsplat 或 Nerfstudio，從 50 張照片的拍攝重建一個真實物件。回報擬合時間，以及留出（held-out）視角上的最終 SSIM。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 3D Gaussian Splatting | 「3DGS」 | 場景是一團 3D Gaussian；可微分的 alpha 合成渲染。 |
| NeRF | 「神經輻射場」 | MLP 在一個 3D 點輸出顏色加密度（density）；沿射線積分來渲染。 |
| Triplane | 「三張 2D 平面」 | 把 3D 拆成三張軸對齊的 2D 特徵網格；比體積表示便宜。 |
| SDS | 「分數蒸餾取樣」 | 拿 2D 擴散的分數（score）當偽梯度，來訓練 3D 模型。 |
| 多視角擴散 | 「一次很多視角」 | 一次輸出一批一致相機視角的擴散模型。 |
| PBR | 「基於物理的渲染」 | 帶反照率、粗糙度、金屬度、法線這些通道的材質。 |
| 致密化 | 「把 splat 變多」 | 3DGS 訓練的啟發式：在高梯度區域把 splat 分開或複製。 |

## 正式環境筆記：3D 還沒有共同的基底

不像影像（潛在擴散加 DiT）和影片（時空 DiT），3D 在 2026 年沒有單一主導的執行環境（runtime）。正式環境的決策樹依表示法分岔：

- **NeRF／triplane。** 推論（inference）是射線步進（ray marching），再加上每個取樣點一次 MLP 前向傳遞。一張 512² 渲染要數百萬次 MLP 前向傳遞。把射線上的取樣點積極做成批次（batch）；SDPA／xformers 用得上。
- **多視角擴散加 LRM 重建。** 兩階段管線。第 1 階段（多視角 DiT）是擴散伺服器，跟第 07 課一樣。第 2 階段（LRM transformer）是把那些視角一次前向傳遞跑完。整體的延遲輪廓是「擴散加一次到位」——各階段的服務元件就照這個挑。
- **SDS／DreamFusion。** 這是逐資產擬合，不是推論。建的是工作，不是請求處理器。

多數 2026 的產品，對的做法是：「請求來了就跑多視角擴散，非同步重建成 3DGS，再把 3DGS 拿來即時看」。工作就乾淨地拆成 GPU 推論伺服器（inference server，快）和離線最佳化器（optimizer，慢）。

## Further Reading｜延伸閱讀

- [Mildenhall et al. (2020). NeRF: Representing Scenes as Neural Radiance Fields](https://arxiv.org/abs/2003.08934) ——NeRF。
- [Kerbl et al. (2023). 3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079) ——3DGS。
- [Poole et al. (2022). DreamFusion: Text-to-3D using 2D Diffusion](https://arxiv.org/abs/2209.14988) ——SDS。
- [Liu et al. (2023). Zero-1-to-3: Zero-shot One Image to 3D Object](https://arxiv.org/abs/2303.11328) ——Zero123。
- [Shi et al. (2023). MVDream](https://arxiv.org/abs/2308.16512) ——多視角擴散。
- [Hong et al. (2023). LRM: Large Reconstruction Model for Single Image to 3D](https://arxiv.org/abs/2311.04400) ——LRM。
- [Gao et al. (2024). CAT3D: Create Anything in 3D with Multi-View Diffusion Models](https://arxiv.org/abs/2405.10314) ——CAT3D。
- [Stability AI (2024). Stable Video 3D (SV3D)](https://stability.ai/research/sv3d-novel-multi-view-synthesis-and-3d-generation-from-a-single-image-using-latent-video-diffusion) ——SV3D。
