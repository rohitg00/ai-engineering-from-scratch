# 專案實戰 04——多模態文件問答（視覺優先 PDF、表格與圖表）（Capstone 04 — Multimodal Document QA (Vision-First PDF, Tables, Charts)）

> 2026 年的文件問答（Document-QA）前沿技術已從「先跑 OCR 轉純文字再檢索」的範式轉向，轉向以「視覺優先之後期交互（Vision-First Late Interaction）」為核心的新架構。ColPali、ColQwen2.5 與 ColQwen3-omni 將 PDF 的每一頁直接視為一張高解析度影像，透過多向量後期交互機制提取影像區塊特徵，並讓查詢 Token 直接與影像 Patch 進行 late interaction／MaxSim 比對。在面對複雜財務年報（10-K）、公式密集的學術論文以及手寫筆記時，視覺優先方法大幅優於 OCR-first。本專案實戰要求你端到端建構一套能處理 1 萬頁龐大文件庫的工業級系統，並產出其與傳統 OCR 方案的同台對比評測基準。

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (viewer UI)
**Prerequisites:** Phase 4 (computer vision), Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:** P4 · P5 · P7 · P11 · P12 · P17
**Time:** 30 hours

## Problem｜問題

當代企業內部儲存著大量會讓傳統 OCR 管線產生嚴重失真的複雜 PDF 文件：表格旋轉的掃描版 10-K、公式密集的學術論文、必須以圖像理解的圖表，以及帶有手寫批註的文件。以文字優先方式處理這些文件，意味著會遺失約一半的訊號。2026 年的做法是在原始頁面影像上直接實施基於多向量的後期交互檢索。由 Illuin Tech 提出的 ColPali 開創了這一流派；隨後 ColQwen2.5-v0.2 與 ColQwen3-omni 進一步提升了準確率。在 ViDoRe v3 權威基準上，視覺優先檢索的得分以顯著幅度高於傳統的「先 OCR 後純文字」管線——且在圖表、跨欄表格與手寫筆記上，兩者的差距進一步擴大。

然而這種極致精準度換來的代價是儲存空間與運算延遲的急劇膨脹。一個 ColQwen image embedding 在單頁上會產生約 2048 個 Patch 向量，而非傳統單一的 1024 維向量。向量資料庫的原始儲存量大幅增加。2026 年推出的 DocPruner 演算法能在不造成可測得準確率損失的情況下剪枝 50%。你將在本專案實戰中為 1 萬頁文件建立全量索引、精確測量 ViDoRe v3 上的 nDCG@5 指標、將端到端查詢回答延遲壓制在 2 秒內，並直接對標「先 OCR 後純文字」的傳統基準線展開全面橫向剖析。

## Concept｜核心概念

所謂後期交互（Late Interaction），是指查詢語句中的每一個 Token 會與頁面中的每一個影像 Patch Token 獨立計算相似度得分，隨後在查詢維度上取最大匹配值（MaxSim）並進行全局求和。這讓系統無需將整張頁面硬性壓縮為單一的平均向量，即可進行細粒度的語義比對。多向量索引庫（如 Vespa、支援多向量特性的 Qdrant 或 AstraDB）負責持久化儲存每個頁面的所有 Patch 向量，並在檢索時執行 MaxSim 計算。

答案合成器則全面採用前沿的視覺語言模型（VLM）。模型同時接收使用者的查詢文本以及被檢索召回的 Top-K 頁面原始影像，並在回答中強制附帶具備可解釋性的證據區域（Bounding Box 座標邊界框或明確頁碼參照）。Qwen3-VL-30B、Gemini 2.5 Pro 以及 InternVL3 是 2026 年工業落地的首選前沿模型。針對公式極度密集、科學符號深奧的極端頁面，系統可無縫掛接專屬的 OCR 旁路（如 Nougat 或 dots.ocr），將光學識別文字作為輔助通道注入模型。

評測體系採用二維交叉矩陣展開全面驗收。橫軸：文件內容類型（純文字段落、高密度跨欄表格、柱狀圖／折線圖、手寫雜記、數學公式）；縱軸：檢索架構選型（視覺優先後期交互 vs 先 OCR 後文字 vs 兩者融合之混合架構）。矩陣中的每一格皆必須實測並填入精確的 nDCG@5 檢索分數與問答準確率。這份嚴謹的對比報告是本專案實戰的核心交付物。

## 系統架構

```
PDFs -> page renderer (PyMuPDF, 180 DPI)
           |
           v
  ColQwen2.5-v0.2 embed (multi-vector per page, ~2048 patches)
           |
           +------> DocPruner 50% compression
           |
           v
   multi-vector index (Vespa or Qdrant multi-vector)
           |
query ----+----> retrieve top-k pages (MaxSim)
           |
           v
  VLM answerer: Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    inputs: query + top-k page images + optional OCR text
           |
           v
  answer with cited page numbers + evidence regions
           |
           v
  Streamlit / Next.js viewer: highlighted boxes on source page
```

## 技術堆疊

- 頁面渲染引擎：PyMuPDF（fitz），設定 180 DPI，並實施直式縱向方向正規化
- 後期交互模型：ColQwen2.5-v0.2 或 ColQwen3-omni（Hugging Face 上的 vidore 官方權重）
- 多向量索引資料庫：原生支援多向量特性的 Vespa，或 Qdrant 多向量模式，或支援 MaxSim 算子的 AstraDB
- 向量剪枝演算法：DocPruner 2026 策略（基於變異數篩選高訊號 Patch，以低於 0.5% 的準確率損失換取 50% 儲存壓縮比）
- OCR 專屬旁路（專攻公式與極端表格）：dots.ocr 或 Meta 的 Nougat
- 答案合成 VLM：私有化部署之 Qwen3-VL-30B 或雲端託管之 Gemini 2.5 Pro；以 InternVL3 作為備用模型
- 權威評測基準：ViDoRe v3 檢索基準、M3DocVQA 跨頁問答測試集
- 視覺檢視前端：Next.js 15，搭載基於 HTML5 Canvas 的證據邊界框高亮圖層

```figure
ce-late-interaction
```

## Build It｜動手實作

1. **多模態資料攝取掃描**。遍歷包含 1 萬頁 PDF 的龐大語料庫（涵蓋 10-K 財務年報、前沿科研論文與掃描文件）。將每一頁以 1536x2048 解析度精準渲染為 PNG 圖片。持久化中繼資料記錄：`{doc_id, page_num, image_path}`。

2. **多向量 embedding 與動態剪枝**。在每一頁影像上運行 ColQwen2.5-v0.2。單頁輸出形狀約為 2048 個 128 維的 Patch 向量。調用 DocPruner 剪枝策略，僅保留訊號最高的一半向量。將精簡後的向量集批次寫入 Vespa 多向量欄位或 Qdrant 之中。

3. **MaxSim 後期交互查詢**。針對使用者輸入的自然語言提問，使用 ColQwen 的查詢塔（Query Tower）提取 Token 層級的多向量特徵。在資料庫中對候選頁面執行極限 MaxSim 點積計算：針對查詢中的每一個 Token，找出該頁面所有 Patch 中的最大點積相似度，最後在查詢長度上求和。精確截取 Top-K 候選頁面。

4. **VLM 長上下文綜合回答**。調用 Qwen3-VL-30B，並同時餵入使用者提問與 Top-5 頁面的原始高解析度圖片。Prompt 嚴格規範：「僅依據所提供的頁面內容回答問題。陳述任何論斷時，必須明確標註 (doc_id, page) 並清晰指出該資訊在頁面上的具體實體區域（圖表、表格或段落）。」

5. **視覺證據邊界框提取**。對 VLM 輸出的回答進行結構化後處理。若 VLM 輸出座標邊界框（Bounding Box，Qwen3-VL 原生支援），將邊界框顯示為檢視器上的覆疊。

6. **OCR 備援**。針對以影像變異數啟發式判定為公式密集的頁面，執行 Nougat 或 dots.ocr，並將 OCR 文字作為額外通道，與影像一併傳入。

7. **全維度橫向評測**。在全庫上全面運行 ViDoRe v3 基準（檢驗檢索 nDCG@5）與 M3DocVQA 基準（檢驗跨頁多跳問答準確率）。在相同語料庫上同步運行使用相同 synthesizer 的「先 OCR 後純文字」傳統對照管線。完整產出「內容類型 × 檢索架構」的二維交叉評測矩陣。

8. **前端檢視介面**。先製作 Streamlit 原型；再使用 Next.js 15 建置正式環境檢視器，逐頁呈現證據區域疊加圖。

## Use It｜實際應用

```
$ doc-qa ask "what was the 2024 operating margin change for segment EMEA?"
[retrieve]   top-5 pages in 320ms (ColQwen2.5, MaxSim, Vespa)
[synth]      qwen3-vl-30b, 1.4s, cited (form-10k-2024, p. 88) + (..., p. 92)
answer:
  EMEA operating margin moved from 18.2% to 16.8%, a 140bp decline.
  cited: 10-K-2024.pdf p.88 (Table 4, Segment Operating Margin)
         10-K-2024.pdf p.92 (MD&A, Operating Performance)
[viewer]     open with highlighted bounding boxes overlaid on p.88 Table 4
```

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-doc-qa.md`。它代表一套針對特定語料調整，並在 ViDoRe v3 上與 OCR 基準比較評估的視覺優先的多模態文件問答系統。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | ViDoRe v3 與 M3DocVQA 精度 | 相較於傳統 OCR 文字方案與公開官方排行榜的具體實測提升點數 |
| 20 | 視覺證據區域錨定真實性 | 引用區域中實際包含答案片段的比例 |
| 20 | 儲存壓縮與線上延遲工程 | DocPruner 剪枝壓縮比、多向量索引檢索 p95 延遲、模型合成回答 p95 延遲 |
| 20 | 跨頁長程推理能力 | 在 100 道人工精準標註、需要翻閱多個頁面才能推導出結論的測試集上的準確率 |
| 15 | 來源文件檢視體驗 | 檢視器清晰度、疊加顯示的忠實度，以及並排比較工具 |
| **100** | | |

## Exercises｜練習

1. 在完全相同的 1 萬頁語料庫上，實測對比 ColQwen2.5-v0.2 與 ColQwen3-omni 的檢索表現。深入分析究竟哪一類型的頁面會被其中一個模型精準命中而被另一個模型遺漏？在索引庫中加入「內容分類」中繼資料標籤，進行動態路由。
2. 對 Patch embedding 實施更加激進的剪枝測試（例如 75% 與 90% 剪枝率）。尋找精度暴跌的「壓縮懸崖點（Compression Cliff）」：即 ViDoRe nDCG@5 指標徹底跌破傳統 OCR 基準線的臨界比例。
3. 建構一套混合架構：並行運行傳統「先 OCR 後純文字」檢索與 ColQwen 視覺檢索，使用倒數排名融合（RRF）演算法進行結果合併，並呼叫 Cross-Encoder 實施二次重排序。測量該混合模式是否能勝過任一單一模式？它究竟在哪些特定文件場景下帶來的增益最為顯著？
4. 將 Qwen3-VL-30B 替換為參數規模更小的 Qwen2.5-VL-7B。繪製每美元準確率曲線。
5. 為系統擴充極致潦草的手寫筆記支援。將手寫語料庫渲染為圖片，使用 ColQwen 計算多向量索引，實測其檢索召回率，並與傳統手寫專用 OCR 辨識方案展開橫向較量。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Late interaction |「ColPali 式檢索」| 查詢 Token 個別與頁面 Patch 計分，再由 MaxSim 彙整 |
| Multi-vector |「每個 Patch 各自有 embedding」| 每份文件有多個向量，而非只有一個彙整後的向量 |
| MaxSim |「後期交互計分」| 對每個查詢 Token，找出其與文件向量的最高相似度，再加總 |
| DocPruner |「Patch 壓縮」| 2026 年的剪枝方法，可保留 50% 的 Patch，且幾乎不損失準確度 |
| ViDoRe v3 |「文件檢索基準測試」| 2026 年視覺文件檢索的標準測試 |
| Evidence region |「引用範圍方框」| 在來源頁面上標示答案片段位置的邊界方框 |
| OCR fallback |「公式處理管線」| 對公式或表格較多的頁面，與視覺管線並用的文字處理管線 |

## Further Reading｜延伸閱讀

- [ColPali (Illuin Tech) repository](https://github.com/illuin-tech/colpali) — 後期交互文件檢索開創性官方開源儲存庫。
- [ColPali paper (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) — 視覺優先多向量檢索奠基性學術論文。
- [ColQwen family on Hugging Face](https://huggingface.co/vidore) — 工業級正式環境model checkpoints 發布主頁。
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) — 跨頁多模態 RAG 經典對照基準。
- [Vespa multi-vector tutorial](https://docs.vespa.ai/en/colpali.html) — 多向量推論服務端官方參考架構。
- [Qdrant multi-vector support](https://qdrant.tech/documentation/concepts/vectors/#multivectors) — Qdrant 多向量支援技術文件。
- [AstraDB multi-vector](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) — 雲端全託管多向量資料庫技術手冊。
- [Nougat OCR](https://github.com/facebookresearch/nougat) — 可處理公式的 OCR 備援工具。
