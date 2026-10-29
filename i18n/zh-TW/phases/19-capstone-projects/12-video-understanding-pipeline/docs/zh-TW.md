# 專案實戰 12——長影片理解管線（場景分割、問答與語義檢索）（Capstone 12 — Video Understanding Pipeline (Scene, QA, Search)）

> Twelve Labs 將 Marengo 與 Pegasus 成功商業化。VideoDB 推出了專為影片量身打造的 CRUD API。艾倫人工智慧研究所（AI2）發布了 Molmo 2 開放權重 VLM checkpoints。Google Gemini 原生支援長達數小時的超長影片上下文。TimeLens-100K 定義了大規模時序定位（Temporal Grounding）。2026 年影片理解管線已定型：場景邊界分割、單場景 VLM 語義描述與關鍵影格 frame embedding、音訊字幕精確對齊、多向量索引儲存，並支援回傳精確 (開始, 結束) 時間戳記與影格預覽縮圖的問答檢索。本專案實戰要求你端到端攝取 100 小時的龐大長影片庫，使用公開基準測試評估，並針對「計數類」與「動作類（action-type）」問題上的經典幻覺展開嚴格度量。

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (UI)
**Prerequisites:** Phase 4 (CV), Phase 6 (speech), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:** P4 · P6 · P7 · P11 · P12 · P17
**Time:** 30 hours

## Problem｜問題

在 2026 年的工業規模下，超長影片問答（Long-Form Video QA）是對頻寬需求最高的多模態問題。雖然 Gemini 2.5 Pro 能夠直接原生吞下長達 2 小時的完整影片，但若要將 100 小時的長影片庫轉化為可供查詢的語料庫，依然必須建置場景層級（Scene-Level）的精細索引。成熟的正式環境架構結合了：自動場景鏡頭分割（TransNetV2 或 PySceneDetect）、單場景多模態 VLM 語義標註（Gemini 2.5、Qwen3-VL-Max 或 Molmo 2）、音軌逐字對齊（Whisper-v3-turbo 產出單詞級時間戳記），以及同時並列儲存文本描述、關鍵影格特徵與字幕語義的多向量索引庫。查詢管線能精準定位 (開始, 結束) 時間戳記並即時呈現關鍵影格預覽。

評測依託公開權威基準（ActivityNet-QA、NeXT-GQA）以及你自建的 100 道私有長影片問答集。「計數類問題」與「動作類問題」上的幻覺是已知的難題；本專案實戰將對這兩類邊界缺陷進行獨立專項量化。

## Concept｜核心概念

在資料攝取時，三大管線並行運作。**場景邊界分割**：將整段長影片依照鏡頭切換切割為獨立的場景片段。**VLM 標註與影像特徵化**：為每個場景抽取關鍵影格（Keyframe），調用 VLM 生成精煉的自然語言描述，並計算該關鍵影格的視覺特徵向量。**語音轉錄對齊**：提取影片音軌，產生附帶單詞級精確時間戳記的逐字稿。系統以 (scene_id, 時間範圍) 作為錨點，將三路資料流完美對齊縫合。隨後在多向量資料庫（Qdrant）中為每個場景儲存三種獨立命名的向量：文字描述向量、關鍵影格視覺向量、逐字稿 embedding。

在查詢時，自然語言提問同時對這三組向量發起並行檢索；透過倒數排名融合（RRF）合併打分；調用時序定位適配器（TimeLens 風格）在召回的最佳場景內部進一步收斂、細化出 (開始, 結束) 視窗。最後，多模態 VLM 合成器（Gemini 2.5 Pro 或 Qwen3-VL-Max）接收提問 + 精選場景片段 + 關鍵影格影像，產出附帶可點選時間戳記與縮圖預覽的答案。

幻覺的客觀度量至關重要。模型在面對計數類與動作類問題時往往不可靠。在評測報告中，必須分別呈報計數類、動作類與描述類問題的正確率。

## 系統架構

```
video file / URL
      |
      v
PySceneDetect / TransNetV2  (scene segmentation)
      |
      +--- per-scene keyframe --- VLM caption + frame embedding
      |                            (Gemini 2.5 Pro / Qwen3-VL-Max / Molmo 2)
      |
      +--- audio channel --- Whisper-v3-turbo ASR + word timestamps
      |
      v
multi-vector Qdrant: {caption_emb, keyframe_emb, transcript_emb}
      |
query:
  dense queries against all three -> RRF merge -> top-k scenes
      |
      v
TimeLens / VideoITG temporal grounding (refine start/end within scene)
      |
      v
VLM synth: query + top scenes + frame previews
      |
      v
answer + (start, end) timestamps + frame thumbs + citations
```

## 技術堆疊

- 場景分割演算法：TransNetV2（2024 至 2026 年 SOTA 標竿）或輕量級 PySceneDetect
- 語音辨識（ASR）：Whisper-v3-turbo，透過 faster-whisper 運行，強制導出單詞級時間戳記
- 多模態標註與問答 VLM：Gemini 2.5 Pro、Qwen3-VL-Max 或開源 Molmo 2
- 時序定位引擎：基於 TimeLens-100K 預訓練的適配器，或 VideoITG 時序細化模型
- 向量資料庫：Qdrant，啟用多向量命名欄位支援（caption / frame / transcript）
- 前端檢視介面：Next.js 15，整合 HTML5 Video Player 與關鍵影格縮圖預覽輪播條
- 評測驗收基準：ActivityNet-QA、NeXT-GQA，以及包含 100 道題目的手動精準標註測試集
- 幻覺專項評測：獨立抽離出包含計數類與動作類問題的專屬評測子集

```figure
cf-scene-index
```

## Build It｜動手實作

1. **影片攝取與前處理**。支援輸入 YouTube 網址或本機 MP4 檔案。視需要將解析度降至 720p。持久化中繼資料記錄：`{video_id, file_path}`。

2. **鏡頭與場景智慧切分**。運行 TransNetV2 或 PySceneDetect，將長影片切分為連續的場景區塊：`[{scene_id, start_ms, end_ms, keyframe_path}]`。在 100 小時的語料庫中，預計將產出約 6000 至 8000 個獨立場景。

3. **音訊語音轉錄與單詞級對齊**。從影片中分離音軌，調用 Whisper-v3-turbo；導出單詞級時間戳記；將語音文本精準切割映射至各個場景的時間區間內。

4. **VLM 自動描述與影格特徵提取**。遍歷每個場景，將抽取的關鍵影格送入 Gemini 2.5 Pro（或 Qwen3-VL-Max），依據結構化模板生成精確的場景行為摘要。同步提取該影格的高維視覺特徵向量。

5. **多向量索引入庫**。在 Qdrant 中建立包含三組命名向量的 Collection。裝填 Payload 中繼資料：`{video_id, scene_id, start_ms, end_ms, keyframe_url}`。

6. **跨模態混合檢索**。針對使用者的自然語言查詢，並行發射三路稠密向量搜尋；調用倒數排名融合（RRF）演算法進行打分融合；精選出 Top-K=5 的候選場景。

7. **時序精確定位（Temporal Grounding）**。在排名前列的最佳場景內部，運行 TimeLens 風格的時序定位適配器，將 (開始, 結束) 視窗在場景內進一步細化。

8. **多模態長上下文答案合成**。呼叫 Gemini 2.5 Pro，同時餵入提問文本、Top-3 場景的關鍵影格或短短片段影像，以及對應的對話字幕。強制要求模型在回答中精確標明 `(video_id, start_ms, end_ms)` 引用。

9. **全維度橫向評測**。在 ActivityNet-QA 與 NeXT-GQA 上全量運行。建置 100 道自定義問答測試集。產出總體準確率報告，並單獨列出計數類問題、動作類問題與描述類問題的各自精確得分。

## Use It｜實際應用

```
$ video-qa ask --url=https://youtube.com/watch?v=X "how many cars pass the intersection in the first minute?"
[scene]    23 scenes detected
[asr]      transcript complete, 4m12s
[index]    69 vectors written (23 scenes x 3)
[query]    top scene: scene 3 [01:32-01:54], confidence 0.84
[ground]   refined window: [00:12-00:58]
[synth]    gemini 2.5 pro, 1.4s
answer:    5 cars pass the intersection between 00:12 and 00:58.
citations: [scene 3: 00:12-00:58]
          [frame preview at 00:14, 00:27, 00:44, 00:51, 00:57]
```

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-video-qa.md`。輸入一個 YouTube 連結或本機上傳的長影片，該管線將自動為其場景建立索引，並回傳附帶時間戳記引用的答案。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | 時序定位精準度（IoU） | 在獨立時序定位測試集上的交併比（Intersection-over-Union）表現 |
| 20 | 跨模態問答客觀準確率 | 在 NeXT-GQA 與包含 100 道題目的自建測試集上的綜合正確率 |
| 20 | 影片攝取與向量化吞吐效能 | 每花費 1 美元算力所能處理並建立索引的影片物理時長（小時） |
| 20 | 前端檢視器與引用互動體驗 | 時間戳記連結、縮圖列、跳至影格功能 |
| 15 | 幻覺率 | 分別呈報計數類與動作類問題的準確率 |
| **100** | | |

## Exercises｜練習

1. 在場景描述階段以 Qwen3-VL-Max 取代 Gemini 2.5 Pro。在 50 個由人工評分的場景樣本上，回報描述品質的差異。
2. 將單個場景的關鍵影格多向量表徵降維為單一的平均池化向量（Pooled Vector）。重新度量檢索召回率的退化幅度。
3. 設計一套「嚴格計數驗證」模式：要求答案合成器在回答計數提問時，必須為其數出的每一個實體目標獨立標註一個精確的時間戳記，使用者點選該標籤可即時跳轉檢驗。度量引入使用者驗證後幻覺率是否降低。
4. 針對三種不同的 VLM 選型實施成本基準測量：計算每 1 美元預算所能完整處理的影片小時數。找出每美元可處理影片時數的最佳區間。
5. 為管線擴充說話人分離（Speaker Diarization）能力：在音訊軌道上運行 pyannote 模型，將轉錄逐字稿精確劃分至不同說話人。展示系統如何精準回答「Alice 剛才針對某個話題發表了什麼看法？」這類複雜提問。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Scene segmentation |「鏡頭偵測」| 在鏡頭邊界處將影片切分為場景 |
| Multi-vector index |「描述、影格與逐字稿」| Qdrant collection，為每種表示方式儲存具名向量 |
| Temporal grounding |「確切發生時間」| 細化查詢答案所對應的（開始、結束）時間範圍 |
| Frame embedding |「視覺表示」| 關鍵影格的向量 embedding，用於場景視覺相似度比對 |
| RRF fusion |「倒數排名融合」| 合併多個排序清單的策略，是經典的混合檢索技巧 |
| Counting hallucination |「計數錯誤」| VLM 回答「有多少個 X」時常見的失敗模式 |
| ActivityNet-QA |「影片問答基準測試」| 長影片問答準確度基準測試 |

## Further Reading｜延伸閱讀

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) — 艾倫人工智慧研究所發布的開放權重 VLM model checkpoints。
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) — 大規模影片時序精確定位權威框架。
- [Gemini Video long-context](https://deepmind.google/technologies/gemini) — 雲端全託管長影片多模態參考架構。
- [VideoDB](https://videodb.io) — 影片專屬資料庫與 CRUD 介面標竿。
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) — 商業級長影片語義檢索領先產品。
- [TransNetV2](https://github.com/soCzech/TransNetV2) — 高效能深度學習鏡頭切分模型儲存庫。
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) — 經典輕量級影片場景分割開源庫。
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) — 長影片多模態問答權威學術評測基準。
