# 三維生成

> 三維是「用 2D 撬動 3D」槓桿最大的一種模態。2023 年的突破是 3D 高斯潑濺。2024 到 2026 年的生成式推進，則在它之上疊了多視角擴散 + 三維重建，讓你能從單一提示詞或單張照片生出物件與場景。

**類型：** 學習
**程式語言：** Python
**先修單元：** 階段 4（視覺）、階段 8 · 07（潛在擴散）
**時間：** 約 45 分鐘

## 問題所在

三維內容很難搞：

- **表示法。** 網格、點雲、體素網格、有號距離場（SDF）、神經輻射場（NeRF）、三維高斯。每一種都有取捨。
- **資料稀缺。** ImageNet 有 1400 萬張影像。最大的乾淨三維資料集（Objaverse-XL, 2023）約 1000 萬個物件，而且多半品質不佳。
- **記憶體。** 512³ 的體素網格是 1.28 億個體素；一個堪用的場景 NeRF 每條光線要 100 萬個取樣點。生成比重建更難。
- **監督訊號。** 一張 2D 影像，你手上就有像素。三維則通常只有寥寥幾個 2D 視角，得自己把它抬升到三維。

2026 年的技術棧把這兩個問題拆開。第一步，用擴散模型生成 *2D 多視角影像*。第二步，對這些影像擬合出一個*三維表示*（通常是高斯潑濺）。

## 核心概念

![三維生成：多視角擴散 + 三維重建](../assets/3d-generation.svg)

### 表示法：3D 高斯潑濺（Kerbl et al., 2023）

把場景表示成一團約 100 萬個三維高斯。每個高斯有 59 個參數：位置（3）、共變異數（6，或四元數 4 + 尺度 3）、不透明度（1）、球諧函數顏色（3 階時 48 個，0 階時 3 個）。

渲染＝投影 + alpha 合成。很快（4090 上 1080p 約 100 fps）。可微分。用梯度下降對著真實照片擬合。在消費級 GPU 上，一個場景 5 到 30 分鐘就能擬合完。

在這之上有兩項 2023 到 2024 年的創新：
- **生成式高斯潑濺。** LGM、LRM、InstantMesh 這類模型能直接從一張或少數幾張影像預測出一團高斯雲。
- **4D 高斯潑濺。** 讓高斯帶有逐影格的位移，用來處理動態場景。

### 多視角擴散

微調一個預訓練的影像擴散模型，讓它能從文字提示詞或單張影像生成同一物件的多個一致視角。Zero123（Liu et al., 2023）、MVDream（Shi et al., 2023）、SV3D（Stability, 2024）、CAT3D（Google, 2024）。通常會輸出繞著物件一圈的 4 到 16 個視角，再透過高斯潑濺或 NeRF 抬升到三維。

### 文字到三維的流程

| 模型 | 輸入 | 輸出 | 時間 |
|-------|-------|--------|------|
| DreamFusion (2022) | 文字 | 透過 SDS 得到 NeRF | 每個素材約 1 小時 |
| Magic3D | 文字 | 網格 + 貼圖 | 約 40 分鐘 |
| Shap-E (OpenAI, 2023) | 文字 | 隱式三維 | 約 1 分鐘 |
| SJC / ProlificDreamer | 文字 | NeRF／網格 | 約 30 分鐘 |
| LRM (Meta, 2023) | 影像 | 三平面 | 約 5 秒 |
| InstantMesh (2024) | 影像 | 網格 | 約 10 秒 |
| SV3D (Stability, 2024) | 影像 | 新視角 | 約 2 分鐘 |
| CAT3D (Google, 2024) | 1 到 64 張影像 | 三維 NeRF | 約 1 分鐘 |
| TripoSR (2024) | 影像 | 網格 | 約 1 秒 |
| Meshy 4 (2025) | 文字 + 影像 | PBR 網格 | 約 30 秒 |
| Rodin Gen-1.5 (2025) | 文字 + 影像 | PBR 網格 | 約 60 秒 |
| Tencent Hunyuan3D 2.0 (2025) | 影像 | 網格 | 約 30 秒 |

2025 到 2026 年的方向：直接的文字到網格模型，並輸出適合遊戲引擎使用的 PBR 材質。不過對一般物件而言，中間夾一層多視角擴散仍是表現最好的配方。

### NeRF（補充脈絡）

神經輻射場（Mildenhall et al., 2020）。一個很小的 MLP 吃 `(x, y, z, view direction)`，輸出 `(color, density)`。沿著光線做積分來渲染。在新視角合成的品質上勝過以網格為基礎的方法，但渲染慢上 100 到 1000 倍。在多數即時應用上已被高斯潑濺取代，但在研究領域仍然是主流。

```figure
v4-3d-multiview
```

## 動手實作

`code/main.py` 實作了一個玩具版的二維「高斯潑濺」擬合：把一張合成的目標影像（一段平滑漸層）表示成一堆二維高斯潑濺的總和。用梯度下降去最佳化位置、顏色與共變異數，讓它逼近目標。你會看到兩個核心操作：前向渲染（潑濺 + alpha 合成）以及梯度下降擬合。

### 步驟 1：二維高斯潑濺

```python
def gaussian_at(x, y, gaussian):
    px, py = gaussian["pos"]
    sigma = gaussian["sigma"]
    d2 = (x - px) ** 2 + (y - py) ** 2
    return math.exp(-d2 / (2 * sigma * sigma))
```

### 步驟 2：把所有潑濺加總來渲染

```python
def render(image_size, gaussians):
    img = [[0.0] * image_size for _ in range(image_size)]
    for g in gaussians:
        for y in range(image_size):
            for x in range(image_size):
                img[y][x] += g["color"] * gaussian_at(x, y, g)
    return img
```

真正的 3D 高斯潑濺會依深度排序，再照順序做 alpha 合成。我們這個二維玩具只是單純相加。

### 步驟 3：用梯度下降擬合

```python
for step in range(steps):
    pred = render(size, gaussians)
    loss = mse(pred, target)
    gradients = compute_grads(pred, target, gaussians)
    update(gaussians, gradients, lr)
```

## 常見陷阱

- **視角不一致。** 如果你獨立生成 4 個視角、而它們對物件結構各說各話，擬合出來的三維就會糊掉。解法：用共享注意力的多視角擴散。
- **背面的幻覺。** 單張影像 → 三維，就非得把看不見的那一面編出來不可。品質參差得很厲害。
- **高斯潑濺爆炸。** 沒有加約束的訓練會長到 1000 萬個潑濺並過度擬合。緻密化 + 剪枝的啟發式規則（來自 3D-GS 原始論文）不可或缺。
- **拓撲問題。** 從隱式場（SDF）萃取出來的網格常常有破洞或自交。交付前先跑一次重新網格化工具（例如 blender 的 voxel remesh）。
- **訓練資料的授權。** Objaverse 的授權混雜；能不能商用要看各個模型。

## 框架應用

| 任務 | 2026 年的選擇 |
|------|-----------|
| 從照片重建場景 | 高斯潑濺（3DGS、Gsplat、Scaniverse） |
| 給遊戲用的文字生三維物件 | Meshy 4 或 Rodin Gen-1.5（輸出 PBR） |
| 影像生三維 | Hunyuan3D 2.0、TripoSR、InstantMesh |
| 從少數影像做新視角合成 | CAT3D、SV3D |
| 動態場景重建 | 4D 高斯潑濺 |
| 虛擬人／穿衣人體 | Gaussian Avatar、HUGS |
| 研究／SOTA | 上禮拜剛掉下來的那個 |

若要在遊戲或電商流程中交付生產級三維：Meshy 4 或 Rodin Gen-1.5 輸出的 PBR 網格可以直接丟進 Unity／Unreal。

## 產出交付

存成 `outputs/skill-3d-pipeline.md`。這項技能吃一份三維需求（輸入：文字／單張影像／少數影像；輸出：網格／潑濺／NeRF；用途：渲染／遊戲／VR），輸出：流程（多視角擴散 + 擬合，或直接的網格模型）、基礎模型、迭代預算、拓撲後處理、需要哪些材質通道。

## 練習

1. **簡單。** 分別用 4、16、64 個高斯執行 `code/main.py`。回報相對於目標的最終 MSE。
2. **中等。** 擴充成彩色高斯（RGB）。確認重建結果符合目標的顏色分布。
3. **困難。** 用 gsplat 或 Nerfstudio，從 50 張照片的拍攝素材重建一個真實物件。回報擬合時間，以及在保留視角上的最終 SSIM。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| 3D 高斯潑濺 | 「3DGS」 | 把場景表示成一團三維高斯；可微分的 alpha 合成渲染。 |
| NeRF | 「神經輻射場」 | 在三維點上輸出顏色 + 密度的 MLP；靠光線積分來渲染。 |
| 三平面 | 「三張 2 維平面」 | 把三維分解成三張軸對齊的 2 維特徵網格；比體積表示便宜。 |
| SDS | 「分數蒸餾取樣」 | 拿 2D 擴散的分數當偽梯度來訓練三維模型。 |
| 多視角擴散 | 「一次出很多視角」 | 一次輸出一批一致鏡頭視角的擴散模型。 |
| PBR | 「基於物理的渲染」 | 帶有 albedo、粗糙度、金屬度、法線通道的材質。 |
| 緻密化 | 「長出更多潑濺」 | 3DGS 的訓練啟發法：在高梯度區域分裂／複製潑濺。 |

## 產品筆記：三維還沒有共通的底層

不像影像（潛在擴散 + DiT）和影片（時空 DiT），三維在 2026 年還沒有單一主導的執行環境。生產環境的決策樹會在表示法這裡分岔：

- **NeRF／三平面。** 推論是光線行進 + 每個取樣點跑一次 MLP 前向傳播。一張 512² 的渲染要跑幾百萬次 MLP 前向。要積極地把光線取樣點批次化；SDPA／xformers 適用。
- **多視角擴散 + LRM 重建。** 兩階段流程。第一階段（多視角 DiT）就是一台擴散伺服器，和單元 07 一樣。第二階段（LRM Transformer）是對這些視角跑一次性的前向傳播。整體延遲輪廓是「擴散 + 一次性前向」—— 每個階段要挑對應的服務原語。
- **SDS／DreamFusion。** 這是逐素材的最佳化，不是推論。要建構的是批次工作，不是請求處理器。

對 2026 年的多數產品來說，正確答案是「收到請求就跑多視角擴散模型，非同步地重建成 3DGS，再把 3DGS 拿去做即時瀏覽」。這樣能把工作量乾淨地拆給 GPU 推論伺服器（快）與離線最佳化器（慢）。

## 延伸閱讀

- [Mildenhall et al. (2020). NeRF: Representing Scenes as Neural Radiance Fields](https://arxiv.org/abs/2003.08934) —— NeRF。
- [Kerbl et al. (2023). 3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079) —— 3DGS。
- [Poole et al. (2022). DreamFusion: Text-to-3D using 2D Diffusion](https://arxiv.org/abs/2209.14988) —— SDS。
- [Liu et al. (2023). Zero-1-to-3: Zero-shot One Image to 3D Object](https://arxiv.org/abs/2303.11328) —— Zero123。
- [Shi et al. (2023). MVDream](https://arxiv.org/abs/2308.16512) —— 多視角擴散。
- [Hong et al. (2023). LRM: Large Reconstruction Model for Single Image to 3D](https://arxiv.org/abs/2311.04400) —— LRM。
- [Gao et al. (2024). CAT3D: Create Anything in 3D with Multi-View Diffusion Models](https://arxiv.org/abs/2405.10314) —— CAT3D。
- [Stability AI (2024). Stable Video 3D (SV3D)](https://stability.ai/research/sv3d-novel-multi-view-synthesis-and-3d-generation-from-a-single-image-using-latent-video-diffusion) —— SV3D。
