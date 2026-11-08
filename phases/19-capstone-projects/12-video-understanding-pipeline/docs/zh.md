# 綜合專案 12 —— 影片理解管線（場景、問答、搜尋）

> Twelve Labs 把 Marengo + Pegasus 產品化。VideoDB 出貨了「影片版 CRUD」API。AI2 的 Molmo 2 發表了開源 VLM 檢查點。Gemini 的長脈絡原生處理得了數小時的影片。TimeLens-100K 大規模地定義了時序定位。2026 年的管線已經定了：場景切分、逐場景字幕 + 嵌入、逐字稿對齊、多向量索引，以及一個以（起、迄）時間戳加上影格預覽作答的查詢。這個綜合專案就是攝取 100 小時、打上公開基準，並量測在計數與動作類問題上的幻覺。

**類型：** 總結專案
**程式語言：** Python (pipeline), TypeScript (UI)
**先修單元：** 階段 4（電腦視覺）、階段 6（語音）、階段 7（transformer）、階段 11（LLM 工程）、階段 12（多模態）、階段 17（基礎設施）
**演練到的階段：** P4 · P6 · P7 · P11 · P12 · P17
**時間：** 30 小時

## 問題

長片問答是 2026 年規模下最吃頻寬的多模態問題。Gemini 2.5 Pro 原生讀得了一支兩小時的影片，但要把 100 小時的影片攝取成一份可查詢的語料，仍然需要一份場景層級的索引。生產上的形狀結合了場景切分（TransNetV2 或 PySceneDetect）、用 VLM 做逐場景字幕（Gemini 2.5、Qwen3-VL-Max，或 Molmo 2）、逐字稿對齊（帶詞級時間戳的 Whisper-v3-turbo），以及一份把字幕、影格嵌入與逐字稿並排存放的多向量索引。查詢管線以（起、迄）時間戳加上影格預覽作答。

基準是公開的（ActivityNet-QA、NeXT-GQA），再加上你自己的 100 題自訂集。計數與動作類問題上的幻覺是已知的困難失敗類別；這個綜合專案會明確地量它。

## 概念

攝取時有三條管線平行跑。**場景切分**把影片切成場景。**VLM 下字幕**替每個場景產生一段字幕，並從一張關鍵影格產生一個影格嵌入。**ASR 對齊**產出詞級的時間戳。這三道串流以（scene_id, 時間範圍）接起來。每個場景在多向量索引（Qdrant）裡拿到三種向量型別：字幕嵌入、關鍵影格嵌入、逐字稿嵌入。

查詢時，那則自然語言問題對三種向量同時發動；結果用 RRF 合併；一個時序定位轉接器（TimeLens 風格）在最佳場景之內把（起、迄）窗口再磨細。VLM 合成器（Gemini 2.5 Pro 或 Qwen3-VL-Max）吃下查詢 + 最佳場景 + 裁切影格，並以帶引用的時間戳與一張影格預覽作答。

那份幻覺量測很要緊。計數（「有幾個人走進房間？」）與動作類（「廚師是先倒再攪嗎？」）問題出了名地不可靠。要把它們的準確率與描述型問題分開回報。

## 架構

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

- 場景切分：TransNetV2（2024-26 年的最先進水準）或 PySceneDetect
- ASR：透過 faster-whisper 的 Whisper-v3-turbo，帶詞級時間戳
- VLM 下字幕與作答：Gemini 2.5 Pro、Qwen3-VL-Max，或 Molmo 2
- 時序定位：以 TimeLens-100K 訓練的轉接器，或 VideoITG
- 索引：支援多向量的 Qdrant（字幕／影格／逐字稿）
- UI：Next.js 15 配 HTML5 影片播放器與場景縮圖
- 評估：ActivityNet-QA、NeXT-GQA、自訂的 100 題人工標註集
- 幻覺基準：帶人工標籤的計數與動作類子集

```figure
cf-scene-index
```

## 動手實作

1. **攝取走訪器。** 接受 YouTube 網址或本地 MP4。必要時降到 720p。持久化 `{video_id, file_path}`。

2. **場景切分。** 跑 TransNetV2 或 PySceneDetect，產出 `[{scene_id, start_ms, end_ms, keyframe_path}]`。目標 100 小時：約 6000-8000 個場景。

3. **ASR 階段。** 對音訊跑 Whisper-v3-turbo；匯出詞級時間戳；切成逐場景的逐字稿片段。

4. **VLM 下字幕。** 逐場景帶著關鍵影格與一份簡短的字幕樣板呼叫 Gemini 2.5 Pro（或 Qwen3-VL-Max）。產出字幕 + 影格嵌入。

5. **多向量索引。** 帶三個具名向量的 Qdrant 集合。酬載：`{video_id, scene_id, start_ms, end_ms, keyframe_url}`。

6. **查詢。** 自然語言問題發動三次稠密查詢；用倒數排名融合合併；取前 k=5 個場景。

7. **時序定位。** 對最佳場景跑 TimeLens 風格的轉接器，在該場景之內把（起、迄）窗口磨細。

8. **VLM 合成。** 帶著查詢 + 前 3 個場景片段（以影像或短片形式）+ 逐字稿呼叫 Gemini 2.5 Pro。要求標註 `(video_id, start_ms, end_ms)` 引用。

9. **評估。** 跑 ActivityNet-QA 與 NeXT-GQA。建一份 100 題的自訂集。回報整體準確率 + 逐類別拆解（計數、動作、描述）。

## 框架應用

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

## 產出交付

`outputs/skill-video-qa.md` 就是那份交付物。給定一個 YouTube 網址或上傳的影片，這條管線會索引場景，並以帶時間戳的引用回答問題。

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | 時序定位的 IoU | 在保留的定位集上的交集比聯集 |
| 20 | 問答準確率 | NeXT-GQA 與自訂的 100 題 |
| 20 | 攝取吞吐量 | 每花一美元處理多少小時影片 |
| 20 | UI 與引用體驗 | 時間戳連結、縮圖列、跳至影格 |
| 15 | 幻覺率 | 計數與動作類的準確率分開計算 |
| **100** | | |

## 練習

1. 在下字幕那一階把 Gemini 2.5 Pro 換成 Qwen3-VL-Max。在一份 50 個場景的人工評分樣本上回報字幕品質的差值。

2. 把逐場景的影格嵌入從多向量減成單一個池化向量。量測檢索的退化幅度。

3. 建一個「嚴格計數」模式：合成器把每一個被計入的實例連同時間戳抽出來，讓使用者點開驗證。量測使用者驗證有沒有降低幻覺。

4. 對攝取成本做基準測試：在三種 VLM 選擇下的「每美元多少小時影片」。挑出那個甜蜜點。

5. 加上帶說話人分離的逐字稿：對音訊跑 pyannote 說話人分離，並嵌入逐說話人的逐字稿。示範「Alice 關於 X 說了什麼？」這類查詢。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| 場景切分 | 「鏡頭偵測」 | 在鏡頭邊界把影片切成場景 |
| 多向量索引 | 「字幕 + 影格 + 逐字稿」 | 每種表示各一個具名向量的 Qdrant 集合 |
| 時序定位 | 「到底是什麼時候發生的」 | 替一則查詢答案磨細（起、迄）窗口 |
| 影格嵌入 | 「視覺表示」 | 一張關鍵影格的向量嵌入；用於場景視覺相似度 |
| RRF 融合 | 「倒數排名融合」 | 跨多份排序清單的合併策略；混合檢索的經典技巧 |
| 計數幻覺 | 「數錯」 | VLM 在「有幾個 X」問題上的已知失敗模式 |
| ActivityNet-QA | 「影片問答基準」 | 長片問答的準確率基準 |

## 延伸閱讀

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) —— 開源 VLM 檢查點
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) —— 大規模的時序定位
- [Gemini Video long-context](https://deepmind.google/technologies/gemini) —— 託管式的參考
- [VideoDB](https://videodb.io) —— 「影片版 CRUD」API 的參考
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) —— 商業參考
- [TransNetV2](https://github.com/soCzech/TransNetV2) —— 場景切分模型
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) —— 經典的開源替代方案
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) —— 參考用的評估基準
