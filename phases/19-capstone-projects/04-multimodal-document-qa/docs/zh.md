# 綜合專案 04 —— 多模態文件問答（視覺優先的 PDF、表格、圖表）

> 2026 年文件問答的前沿，已經從「先 OCR 再處理文字」轉向視覺優先的後期互動。ColPali、ColQwen2.5 與 ColQwen3-omni 把每一頁 PDF 當成一張影像、用多向量後期互動去嵌入它，並讓查詢直接對那些圖塊做注意力。在財報 10-K、科學論文與手寫筆記上，這套模式大幅勝過「先 OCR」。把整條管線在 1 萬頁上從頭到尾建起來，並發表與「先 OCR 再處理文字」的並排比較。

**類型：** 總結專案
**程式語言：** Python (pipeline), TypeScript (viewer UI)
**先修單元：** 階段 4（電腦視覺）、階段 5（NLP）、階段 7（transformer）、階段 11（LLM 工程）、階段 12（多模態）、階段 17（基礎設施）
**演練到的階段：** P4 · P5 · P7 · P11 · P12 · P17
**時間：** 30 小時

## 問題

企業手上堆著一堆 OCR 管線會搞砸的 PDF：帶旋轉表格的掃描版 10-K、滿是方程式的科學論文、只有當成圖片才說得通的圖表、手寫的註記。把這些當成文字優先來處理，就等於丟掉一半的訊號。2026 年的答案是：在原始頁面影像上做後期互動的多向量檢索。ColPali（Illuin Tech）提出了它；ColQwen2.5-v0.2 與 ColQwen3-omni 把準確率推上去。在 ViDoRe v3 上，視覺優先檢索以有意義的幅度勝過「先 OCR 再處理文字」—— 而在圖表、表格與手寫上，那個差距還會拉大。

代價是儲存與延遲。一份 ColQwen 嵌入是每頁約 2048 個圖塊向量，不是單一個 1024 維向量。原始儲存量會膨脹。DocPruner（2026）帶來 50% 的剪枝，且沒有可量測的準確率損失。你會索引 1 萬頁、量測 ViDoRe v3 的 nDCG@5、在 2 秒內給出答案，並直接與「先 OCR 再處理文字」的基線比較。

## 概念

後期互動的意思是：每一個查詢詞元都與每一個圖塊詞元評分，然後把每個查詢詞元的最大分數加總起來。你得到細粒度的比對，而不需要單一個池化向量。一個多向量索引（Vespa、Qdrant 多向量，或 AstraDB）儲存逐圖塊的嵌入，並在檢索時執行 MaxSim。

作答者是一個視覺語言模型，它吃下查詢加上前 k 個被檢索出來的頁面影像，並寫出一份帶證據區域（邊界框或頁碼參照）的答案。Qwen3-VL-30B、Gemini 2.5 Pro 與 InternVL3 是 2026 年的前沿選擇。對於方程式與科學符號，會接上一條 OCR 退路（Nougat、dots.ocr）作為可選的文字通道。

評估是一張二維矩陣。一條軸是內容型別（純文字段落、密集表格、長條／折線圖、手寫筆記、方程式）。另一條軸是檢索方式（視覺優先後期互動、先 OCR 再處理文字、混合）。每一格都給出 nDCG@5 與答案準確率。那份報告就是交付物。

## 架構

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

- 頁面渲染：PyMuPDF（fitz），180 DPI，統一為直式
- 後期互動模型：ColQwen2.5-v0.2 或 ColQwen3-omni（Hugging Face 上的 vidore 團隊）
- 索引：帶多向量欄位的 Vespa、Qdrant 多向量，或帶 MaxSim 的 AstraDB
- 剪枝：DocPruner 2026 政策（保留高變異的圖塊，50% 壓縮、準確率損失 < 0.5%）
- OCR 退路（方程式／密集表格）：dots.ocr 或 Nougat
- VLM 作答者：自架的 Qwen3-VL-30B 或託管的 Gemini 2.5 Pro；InternVL3 作為退路
- 評估：ViDoRe v3 基準、供多頁推理用的 M3DocVQA
- 檢視器 UI：Next.js 15，用 canvas 疊層畫出證據區域

```figure
ce-late-interaction
```

## 動手實作

1. **攝取。** 走訪一批橫跨 10-K、科學論文與掃描文件的 1 萬頁 PDF 語料。把每一頁渲染成 1536x2048 的 PNG。持久化 `{doc_id, page_num, image_path}`。

2. **嵌入。** 對每一張頁面影像跑 ColQwen2.5-v0.2。輸出形狀約為 2048 個 128 維的圖塊嵌入。套用 DocPruner，保留訊號最強的那一半。寫進 Vespa 的多向量欄位或 Qdrant 多向量。

3. **查詢。** 對每一則進來的查詢，用查詢塔做嵌入（詞元層級的嵌入）。對索引執行 MaxSim：對每一個查詢詞元，取它與頁面圖塊嵌入之間內積的最大值，再加總。回傳前 k 個頁面。

4. **合成。** 帶著查詢與前 5 個頁面影像呼叫 Qwen3-VL-30B。提示詞：「只用提供的頁面作答。替每一項主張標註 (doc_id, page) 引用，並說出那個區域（圖、表、段落）。」

5. **證據區域。** 後處理答案以抽出被引用的區域。若那個 VLM 會輸出邊界框（Qwen3-VL 會），就在檢視器裡把它們畫成疊層。

6. **OCR 退路。** 對被判定為方程式密集的頁面（以影像變異數做的捷思），跑 Nougat 或 dots.ocr，並把 OCR 文字連同影像一起當成額外通道傳進去。

7. **評估。** 跑 ViDoRe v3（檢索的 nDCG@5）與 M3DocVQA（多頁問答準確率）。同時在同一批語料上、用同一個合成器跑「先 OCR 再處理文字」的管線。產出一張「內容型別 × 方法」的矩陣。

8. **UI。** 先做 Streamlit 原型；再做帶逐頁證據區域疊層的 Next.js 15 生產檢視器。

## 框架應用

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

## 產出交付

`outputs/skill-doc-qa.md` 描述那份交付物：一套視覺優先的多模態文件問答系統，針對特定語料調校過，並在 ViDoRe v3 上與「先 OCR 再處理文字」的基線做過評估。

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA 準確率 | 對比 OCR 文字基線與公開排行榜的基準數字 |
| 20 | 證據區域的接地程度 | 被引用區域中真的含有答案跨度的比例 |
| 20 | 儲存與延遲工程 | DocPruner 的壓縮比、索引的 p95、答案的 p95 |
| 20 | 多頁推理 | 在一份人工標註的 100 題多頁題組上的準確率 |
| 15 | 來源檢視體驗 | 檢視器的清晰度、疊層的忠實度、並排比較工具 |
| **100** | | |

## 練習

1. 在同一批語料上量測 ColQwen2.5-v0.2 與 ColQwen3-omni。哪些頁面是一個答對、另一個漏掉的？在索引裡加上一個「內容類別」標籤，用來依型別做路由。

2. 積極地剪枝嵌入（75%、90%）。找出那個壓縮懸崖：ViDoRe nDCG@5 掉到 OCR 基線之下的那個點。

3. 做一套混合：平行跑「先 OCR 再處理文字」與 ColQwen，用 RRF 融合，再用交叉編碼器重排。這個混合有沒有打敗單獨任一者？它在哪裡幫助最大？

4. 把 Qwen3-VL-30B 換成一個較小的 VLM（Qwen2.5-VL-7B）。量測那條「每一美元換到多少準確率」的曲線。

5. 加上手寫筆記支援。渲染手寫語料、用 ColQwen 嵌入、量測檢索。與一條手寫 OCR 管線做比較。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| 後期互動 | 「ColPali 式的檢索」 | 查詢詞元各自獨立地對頁面圖塊評分；由 MaxSim 彙總 |
| 多向量 | 「逐圖塊的嵌入」 | 每份文件有很多向量，不是單一個池化向量 |
| MaxSim | 「後期互動的評分」 | 對每個查詢詞元取它與文件向量相似度的最大值；再加總 |
| DocPruner | 「圖塊壓縮」 | 2026 年的剪枝法，保留 50% 的圖塊而準確率損失可忽略 |
| ViDoRe v3 | 「文件檢索基準」 | 2026 年量測視覺文件檢索的標準 |
| 證據區域 | 「被引用的邊界框」 | 來源頁面上一個把答案跨度定位出來的邊界框 |
| OCR 退路 | 「方程式通道」 | 在方程式或表格繁重的頁面上，與視覺並用的文字管線 |

## 延伸閱讀

- [ColPali (Illuin Tech) repository](https://github.com/illuin-tech/colpali) —— 後期互動文件檢索的參考
- [ColPali paper (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) —— 那篇奠基的方法論文
- [ColQwen family on Hugging Face](https://huggingface.co/vidore) —— 可用於生產的檢查點
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) —— 多頁多模態 RAG 的基線
- [Vespa multi-vector tutorial](https://docs.vespa.ai/en/colpali.html) —— 參考用的服務堆疊
- [Qdrant multi-vector support](https://qdrant.tech/documentation/concepts/vectors/#multivectors) —— 另一種索引
- [AstraDB multi-vector](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) —— 另一種託管索引
- [Nougat OCR](https://github.com/facebookresearch/nougat) —— 能處理方程式的 OCR 退路
