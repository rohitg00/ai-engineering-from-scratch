# 評估（evaluation）——FID、CLIP score、人類偏好（human preference）

> 每份生成模型排行榜都會引用 FID、CLIP score，以及人類偏好競技場的勝率。每個數字都有失效模式，有心的研究者可以利用這些指標的弱點。你如果不知道這些失效模式，就分不出真正的改進，和一輪鑽指標。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 01 (Taxonomy), Phase 2 · 04 (Evaluation Metrics)
**Time:** ~45 minutes

## The Problem｜問題

生成模型的評判，看的是*樣本品質（sample quality）*和*條件貼合（conditioning adherence）*。兩者都沒有閉式度量。你的模型得渲染 1 萬張影像；得有東西替它們標上數字；這些數字還得跨模型族、跨解析度、跨架構都信得過。三個指標撐過了 2014 到 2026：

- **FID（Fréchet Inception Distance）。** 在 Inception 網路（network）的特徵空間（feature space）裡，真實與生成兩個分布（distribution）之間的距離。越低越好。
- **CLIP score。** 生成影像的 CLIP 影像 embedding，和一段 prompt 的 CLIP 文字 embedding，兩者的餘弦相似度（cosine similarity）。越高越好。量的是 prompt 貼合。
- **人類偏好。** 同一個 prompt 上讓兩個模型對打，請人（或 GPT-4 等級的模型）挑更好的那個，再彙總成 Elo 分數。

你還會看到：IS（inception score，大致已退役）、KID、CMMD、ImageReward、PickScore、HPSv2、MJHQ-30k。每一個都在補前一個的某個失效。

## The Concept｜核心概念

![FID, CLIP, and preference: three axes, different failure modes](../assets/evaluation.svg)

### FID——樣本品質

Heusel et al.（2017）。步驟：

1. 對 N 張真實影像和 N 張生成影像，抽取 Inception-v3 特徵（2048 維）。
2. 每一池擬合一個高斯：算平均數（mean）`μ_r, μ_g` 和共變異數（covariance）`Σ_r, Σ_g`。
3. FID = `||μ_r - μ_g||² + Tr(Σ_r + Σ_g - 2 · (Σ_r · Σ_g)^0.5)`。

解讀：特徵空間裡，兩個多變量高斯（multivariate Gaussian）之間的 Fréchet 距離。越低 = 分布越像。

失效模式：

- **小 N 有偏差（bias）。** FID 是特徵分布上的均方——N 小就會低估共變異數，給出假的低 FID。一律用 N ≥ 1 萬。
- **依賴 Inception。** Inception-v3 在 ImageNet 上訓練。離 ImageNet 很遠的領域（人臉、藝術、帶文字的影像）會算出沒有意義的 FID。改用該領域自己的特徵抽取器（feature extractor）。
- **鑽指標。** 對 Inception 的先驗（prior）過度擬合（overfit），FID 會變低，視覺品質並沒有變好。用下面的 CMMD 打掉它。

### CLIP score——prompt 貼合

Radford et al.（2021）。給一張生成影像加一段 prompt：

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

對 3 萬張生成影像取平均，得到一個可以跨模型比的純量。

失效模式：

- **CLIP 自己的盲點。** CLIP 的組合推理很弱（「紅色方塊放在藍色球上」常常失敗）。模型可以在 CLIP score 上排名很好，其實沒跟上複雜 prompt。
- **短 prompt 偏差。** 短 prompt 在真實資料裡有更多 CLIP 影像對得上。長 prompt 的 CLIP score 在機制上就比較低。
- **prompt 鑽指標。** prompt 裡加上「high quality, 4k, masterpiece」，CLIP score 會灌高，影像和文字的綁定並沒有變好。

CMMD（Jayasumana et al.，2024）補上其中一部分：用 CLIP 特徵取代 Inception，用最大平均差異（maximum mean discrepancy）取代 Fréchet。更能抓到細微的品質差。

### 人類偏好——當成真值（ground truth）

挑一池 prompt。用模型 A 和模型 B 生成。把配對拿給人看（或一個強的 LLM 評判）。把勝場彙總成 Elo 或 Bradley-Terry 分數。基準（benchmark）有：

- **PartiPrompts（Google）**：1,600 條多元 prompt，12 個類別。
- **HPSv2**：10.7 萬筆人類標註，廣泛拿來當自動代理。
- **ImageReward**：13.7 萬組 prompt－影像偏好配對，MIT 授權。
- **PickScore**：在 Pick-a-Pic 的 260 萬筆偏好上訓練。
- **Chatbot-Arena 風格的影像競技場**：https://imagearena.ai/ 以及其他。

失效模式：

- **評判變異（variance）。** 非專家和專家的偏好不同。兩邊都要用。
- **prompt 分布。** 刻意挑過的 prompt 會偏袒某一族。一定要寫下來。
- **LLM 評判的獎勵操弄（reward hacking）。** GPT-4 評判會被好看但錯的輸出騙到。再用人類的判斷交叉對一下。

## 一起用

一份正式環境的評估報告應該包含：

1. 對留出（held-out）的真實分布，用 1 萬到 3 萬個樣本算 FID（樣本品質）。
2. 同一批樣本對上它們的 prompt，算 CLIP score／CMMD（貼合）。
3. 跟前一個模型在盲測競技場的勝率（整體偏好）。
4. 失效模式分析：隨機抽 50 張輸出，標出已知問題（手部結構、文字渲染、物體數量是否一致）。

任何單一指標都是謊言。三個互相佐證的指標，加上質性檢視（qualitative inspection），才構成一個主張。

```figure
gx-fid-distributions
```

## Build It｜動手實作

`code/main.py` 在合成的「特徵向量」（feature vector）上實作 FID、類似 CLIP score 的分數，以及 Elo 彙總（用 4 維向量代替 Inception 特徵）。你會看到：

- 小 N 和大 N 上的 FID——那個偏差。
- 「CLIP score」是特徵池之間的餘弦相似度。
- 從一條合成偏好流更新 Elo 的規則。

### 步驟 1：四行的 FID

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### 步驟 2：CLIP 風格的餘弦相似度

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### 步驟 3：Elo 彙總

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## 容易踩的坑

- **N=1000 的 FID。** N 低於 1 萬時，這個數字當經驗法則不可靠。報告低 N FID 的論文是在鑽指標。
- **跨解析度比 FID。** Inception 的 299×299 縮放會改掉特徵分布。只在對齊的解析度上比較。
- **只報一個 seed。** 至少跑 3 個 seed。回報標準差（std）。
- **用負面 prompt 灌高 CLIP score。** 有些管線靠把 prompt 過度擬合來拉高 CLIP。檢查有沒有視覺飽和。
- **prompt 重疊帶來的 Elo 偏差。** 如果兩個模型訓練時都看過基準裡的某條 prompt，Elo 就沒有意義。改用留出的 prompt 集。
- **付費群眾做的人類評估有偏斜。** Prolific、MTurk 的標註者偏年輕、較親近科技。再混進招募來的藝術和設計專家。

## Use It｜實際應用

2026 年的正式環境評估協定：

| 支柱 | 最低 | 建議 |
|------|------|------|
| 樣本品質 | 1 萬張對留出真實資料的 FID | 再加 5 千張的 CMMD，以及各類別子集的 FID |
| prompt 貼合 | 3 萬張的 CLIP score | 再加 HPSv2、ImageReward、VQA 式問答 |
| 偏好 | 相對基準（baseline）的 200 對盲測 | 再加 2000 對人類、LLM 評判、Chatbot Arena |
| 失效分析 | 人工標 50 張 | 人工標 500 張，加上自動的安全分類器 |

四根支柱放在同一份報告 = 一個主張。單獨一根 = 行銷。

## Ship It｜交付成果

存成 `outputs/skill-eval-report.md`。這個 skill 吃一個新的模型檢查點（checkpoint）加基準，輸出完整的評估計畫：樣本數（sample size）、指標、失效模式探針、簽核標準。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。在同一組合成分布上，比較 N=100 和 N=1000 的 FID。回報偏差有多大。
2. **中等。** 用合成的 CLIP 風格特徵實作 CMMD（公式見 Jayasumana et al.，2024）。比較它和 FID 對品質差異有多敏感。
3. **困難。** 重做 HPSv2 的設置：從 Pick-a-Pic 的子集拿 1000 組影像－prompt 配對，在偏好上 fine-tune 一個小型、以 CLIP 為底的評分器，量它跟留出集的一致程度。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| FID | 「Fréchet Inception 距離」 | 把真實與生成的 Inception 特徵各自擬合高斯，再算 Fréchet 距離。 |
| CLIP score | 「文字與影像的相似度」 | CLIP 影像 embedding 和文字 embedding 的餘弦相似度。 |
| CMMD | 「FID 的替代」 | CLIP 特徵上的 MMD；偏差較小，不假設高斯。 |
| IS | 「Inception 分數」 | Exp KL(p(y|x) || p(y))；跟現代模型的相關性差，已經退役。 |
| HPSv2／ImageReward／PickScore | 「學來的偏好代理」 | 在人類偏好上訓練的小模型，用來當自動評判。 |
| Elo | 「西洋棋等級分」 | 把兩兩勝場做 Bradley-Terry 彙總。 |
| PartiPrompts | 「那套基準 prompt 集」 | Google 策展的 1,600 條 prompt，跨 12 個類別。 |
| FD-DINO | 「自監督替代」 | 用 DINOv2 特徵算的 FD；ImageNet 以外的領域更好。 |

## 正式環境筆記：評估也是一種推論（inference）工作負載

對 1 萬個樣本跑 FID，就是要生成 1 萬張影像。50 步的 SDXL 底座、1024²、單張 L4，大約是 11 小時的單請求推論。評估預算是真的，而框法正好就是離線推論那個情境（把吞吐量（throughput）拉到最大，不理首 token 時間（TTFT））：

- **批次（batch）做滿，忘掉延遲。** 離線評估 = 在記憶體裝得下的最大尺寸做靜態批次（static batching）。80 GB 的 H100 上，`pipe(...).images` 配 `num_images_per_prompt=8`，實際時間比單請求快 4 到 6 倍。
- **把真實特徵快取（cache）起來。** 真實參考集上的 Inception（給 FID）或 CLIP（給 CLIP score、CMMD）特徵抽取只跑*一次*，存成 `.npz`。不要每次評估重算。

給 CI／回歸測試閘：每個 PR 在 500 張子集上跑 FID 加 CLIP score（約 30 分鐘）；每晚跑完整的 1 萬張 FID，加上 HPSv2 和 Elo。

## Further Reading｜延伸閱讀

- [Heusel et al. (2017). GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium (FID)](https://arxiv.org/abs/1706.08500) ——FID 論文。
- [Jayasumana et al. (2024). Rethinking FID: Towards a Better Evaluation Metric for Image Generation (CMMD)](https://arxiv.org/abs/2401.09603) ——CMMD。
- [Radford et al. (2021). Learning Transferable Visual Models from Natural Language Supervision (CLIP)](https://arxiv.org/abs/2103.00020) ——CLIP。
- [Wu et al. (2023). HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341) ——HPSv2。
- [Xu et al. (2023). ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977) ——ImageReward。
- [Yu et al. (2023). Scaling Autoregressive Models for Content-Rich Text-to-Image Generation (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789) ——PartiPrompts。
- [Stein et al. (2023). Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675) ——失效模式的綜述。
