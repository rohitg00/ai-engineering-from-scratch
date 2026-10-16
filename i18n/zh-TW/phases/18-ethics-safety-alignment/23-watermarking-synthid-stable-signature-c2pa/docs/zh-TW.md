# 數位浮水印技術——SynthID、Stable Signature 與 C2PA（Watermarking — SynthID, Stable Signature, C2PA）

> 三項技術構成了 2026 年 AI 生成內容（AIGC）的溯源體系。**SynthID**（Google DeepMind 出品）——影像浮水印於 2023 年 8 月正式推出，文字與影片浮水印於 2024 年 5 月推出（Gemini + Veo），文字浮水印演算法於 2024 年 10 月透過「負責任 GenAI 工具箱」正式開源，統一跨模態偵測器則於 2025 年 11 月隨 Gemini 3 Pro 一併發布。文字浮水印在解碼取樣時以人類肉眼完全無法察覺的微幅偏移調整 Next-token 預測機率；而影像與影片浮水印則可經受壓縮、裁切、濾鏡及幀率變更。**Stable Signature**（Fernandez 等人，ICCV 2023，arXiv:2303.15435）——對潛在擴散模型（Latent Diffusion）的解碼器進行專門 fine-tuning，使生成的每一幅影像的潛在表示都帶有一段固定的二進位訊息；在極端裁剪至僅剩原始畫面 10% 的殘酷測試下，偵測率依然突破 90%，且偽陽性率（FPR）低於 $10^{-6}$。後續研究《Stable Signature is Unstable》（arXiv:2405.07145，2024 年 5 月）則展示了脆弱面：對解碼器進行 fine-tuning，即可在不損害影像畫質的前提下移除浮水印。**C2PA**——經密碼學簽署、可偵測竄改的數位內容來源中繼資料標準（C2PA 2.2 解釋文件，2025 年）。數位浮水印與 C2PA 互補：中繼資料可能遭剝除，但可承載較豐富的溯源資訊；浮水印能經過轉碼而保留，但承載的資訊較少。

**Type:** Build
**Languages:** Python (stdlib, token-watermark embed + detect)
**Prerequisites:** Phase 10 · 04 (sampling), Phase 01 · 09 (information theory)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 描述 Token 級文字數位浮水印（SynthID-text 風格）的機制，以及如何偵測它。
- 掌握 Stable Signature 影像浮水印架構，並剖析 2024 年對抗性解碼器 fine-tuning 如何成功攻破該防禦。
- 闡述 C2PA 密碼學中繼資料標準的核心使命，並說明其與內容中的浮水印為何互補。
- 梳理數位浮水印的核心物理極限：模型專屬性依賴、改寫攻擊下的脆弱性，以及保持語意不變的攻擊（arXiv:2508.20228）。

## The Problem｜問題

2023 至 2024 年間，深偽與 AI 生成內容大規模進入政治與消費情境。浮水印是提議中的技術溯源信號：在內容生成時加上標記，之後再偵測。2025 年的證據顯示，沒有任何浮水印能無條件抵抗攻擊；但與 C2PA 中繼資料分層搭配，可提供可用的內容溯源資訊。

## The Concept｜核心概念

### 文字數位浮水印（SynthID-text 風格）

Kirchenbauer 等人於 2023 年確立、後由 Google 官方工程化推向大規模正式環境的標準機制：

1. 在自回歸解碼的每一個步進中，利用偽隨機雜湊函數對前置 K 個 Token 進行雜湊，將整個詞表（Vocabulary）動態且偽隨機地劃分為「綠名單（Green set）」與「紅名單（Red set）」。
2. 向落在綠名單內的 Token 對應的 Logit 數值中，人工疊加一個微小的正向偏置 δ。
3. 最終取樣產出的生成文本中，綠名單 Token 的出現頻率將高於純粹隨機碰巧應當出現的理論比例。

偵測判別演算法：對受測文字重新執行相同的雜湊劃分，統計整段文字中綠名單 Token 的累積數量，並據此計算出標準正態分佈下的 Z-score 統計分數。對於被打上浮水印的 AI 文本，Z-score 大於 0；而對於真實人類撰寫的文字，Z-score 約為 0。

核心物理特徵：
- 人類讀者無法察覺（偏置 δ 很小，品質損失也很小）。
- 偵測需要能存取詞彙表分割函數。
- 面對同義改寫（Paraphrase）極度脆弱——改寫文字會破壞浮水印訊號。

SynthID-text 於 2024 年 10 月透過 Google 的 Responsible GenAI Toolkit 開源。

### Stable Signature（影像生成浮水印）

Fernandez 等人於 ICCV 2023 提出。核心在於對潛在擴散模型（LDM）的解碼器進行 fine-tuning，使得經其解碼輸出的每一張影像，其潛在表示中都帶有一段固定的二進位訊息。偵測時由神經解碼器從潛在表示解碼出該訊息。在極端幾何裁剪（僅保留原始畫面的 10%）的殘酷破壞下，其偵測率依然高達 90% 以上，且偽陽性率（FPR）嚴格低於 $10^{-6}$。

2024 年 5 月的後續研究《Stable Signature is Unstable》（arXiv:2405.07145）指出，對解碼器進行 fine-tuning 可在保留影像品質的同時移除浮水印。對抗性後生成 fine-tuning 的成本低；該浮水印的對抗穩健性有限。

### SynthID 統一跨模態偵測器（2025 年 11 月）

隨 Gemini 3 Pro 同步發布：提供單一統一 API，能在同一套介面中同時讀取並驗證文字、靜態圖片、語音音訊以及動態影片中的 SynthID 隱形信號。整合 Google 的溯源技術堆疊。

### C2PA 密碼學中繼資料標準

內容溯源與真實性聯盟（Coalition for Content Provenance and Authenticity）。一套基於非對稱加密技術的可偵測竄改的中繼資料標準（詳見 C2PA 2.2 解釋文件，2025 年）。一份標準的 C2PA 聲明資訊清單（Manifest），會記錄由創作者金鑰簽署的溯源聲明：由誰建立、何時建立，以及經歷哪些轉換。

與內容中的浮水印互補：
- 中繼資料可能遭到剝除；浮水印則不易移除。
- 中繼資料承載豐富資訊（完整的溯源鏈條）；浮水印通常只承載少數幾個位元。
- C2PA 依賴平台採用；浮水印則會自動寫入內容。

Google 已在 Search、Ads 和「關於此圖片」功能中整合浮水印與 C2PA。

### 數位浮水印的四大客觀邊界

- **模型專屬性**。SynthID 只會為啟用 SynthID 的模型生成的內容加上浮水印。未啟用 SynthID 的模型所生成的內容不會帶有浮水印，因此「未偵測到 SynthID 訊號」不能證明內容真實。
- **同義改寫攻擊**。文字數位浮水印在經歷保持語意不變的同義詞改寫後，統計顯著性會瞬間被破壞殆盡。
- **保持語意不變的攻擊**。最新文獻（arXiv:2508.20228，2025 年）顯示：保持語意不變的攻擊能破壞文字浮水印與許多影像浮水印。
- **fine-tuning 擦除攻擊**。如《Stable Signature is Unstable》所示，對生成端解碼器進行輕量 fine-tuning 即可將潛在浮水印完全洗刷乾淨。

### 歐盟 AI 法案第 50 條法定約束

歐盟委員會專門針對 AI 生成內容標註提出《透明度行為準則》草案（首份草案於 2025 年 12 月發布，第二版草案於 2026 年 3 月更新，預計於 2026 年 6 月定稿，詳見[歐盟執委會官方進度頁面](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)）。截至 2026 年 4 月，該準則仍處於最後草案修訂階段，時間表仍可能變動。這是要求落實技術層面的監管制度：深度偽造內容必須標示。

### 該研究在第 18 階段中的宏觀座標

第 22–23 課討論模型輸出的內容（私人資料、溯源信號）。第 27 課介紹訓練資料治理；第 24 課則說明要求採取這些技術措施的監管框架。

```figure
an-watermark-greenlist
```

## Use It｜實際應用

`code/main.py` 實作了一套微型文字數位浮水印植入與偵測系統。將 Token 抽象為範圍為 0..N-1 的整數標籤；在取樣時基於雜湊演算法將機率偏置注入動態劃分的綠名單集合。偵測器即時統計被測文本中的綠名單 Token 佔比，並計算 Z-score。在終端機中，你可以觀察 1,000 Token 長度生成文字的偵測效果，觀察同義改寫如何破壞訊號，並測量人類文字上的偽陽性率。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-provenance-audit.md`。輸入一項內容生成業務的內容溯源宣稱方案，該 Skill 將檢查：浮水印機制（若有）、C2PA 簽署鏈（若有）、各項技術的對抗穩健性，以及各模態的涵蓋範圍。

## Exercises｜練習

1. 執行 `code/main.py`。記錄長度為 1,000 Token 的浮水印生成文字相較於純人類撰寫文字的 Z-score 差異。在 95% 統計信賴區間閾值下，精確計算系統的偽陽性率（FPR）。
2. 在腳本中實作一套微型同義改寫攻擊模組：隨機將文字中 30% 的 Token 替換為其同義詞。重新測量經過改寫後的 Z-score 指標位移。
3. 閱讀 Kirchenbauer 等人（2023）第 6 節（強健性分析）。為何文字浮水印在改寫下失效，而影像浮水印能承受裁切？
4. 設計一個整合 SynthID-text 與 C2PA 中繼資料的部署方案。描述消費者看到的溯源鏈條，並指出每個元件的一種失效模式。
5. 《Stable Signature is Unstable》顯示 fine-tuning 可移除影像浮水印。設計一項可降低此攻擊風險的部署控制措施，例如要求對 fine-tuned model checkpoint 的發布進行簽章。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| SynthID | 「Google 的浮水印」 | 跨模態溯源信號，涵蓋文字、影像、音訊與影片 |
| Token watermark | 「Kirchenbauer 式方法」 | 以偏置取樣生成的文字浮水印，可透過綠色 token 的 z-score 偵測 |
| Stable Signature | 「影像浮水印」 | 透過 fine-tune 解碼器建立的浮水印；ICCV 2023 |
| C2PA | 「中繼資料標準」 | 以密碼學簽署、可偵測竄改的溯源中繼資料 |
| Paraphrase robustness | 「改寫會破壞訊號嗎」 | 文字浮水印的特性，目前仍有限制 |
| Fine-tune removal | 「對抗式去除浮水印」 | 透過 fine-tune 解碼器移除影像浮水印的攻擊 |
| Cross-modal detector | 「統一的 SynthID」 | 2025 年 11 月推出、支援多種模態的統一 API |

## Further Reading｜延伸閱讀

- [Kirchenbauer et al. — A Watermark for Large Language Models (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226) — Token 級文字數位浮水印經典原著。
- [Fernandez et al. — Stable Signature (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435) — 影像擴散模型解碼器浮水印論文。
- ["Stable Signature is Unstable" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145) — 解碼器 fine-tuning 擦除浮水印攻擊論文。
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/) — 跨模態數位浮水印官方架構手冊。
- [C2PA 2.2 Explainer (2025)](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) — C2PA 密碼學內容溯源中繼資料標準規範。
