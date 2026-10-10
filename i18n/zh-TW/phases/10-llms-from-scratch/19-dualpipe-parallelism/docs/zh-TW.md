# DualPipe 平行處理

> DeepSeek-V3 是在分散於各節點的 2,048 張 H800 GPU 上訓練的，MoE 專家散落在群集中。跨節點的專家 all-to-all 通訊，讓每進行 1 個 GPU 小時的計算就伴隨 1 個 GPU 小時的通訊開銷。GPU 有一半的時間處於閒置。DualPipe（DeepSeek，2024 年 12 月）是一種雙向管線，能將前向與反向計算與它們所觸發的 all-to-all 通訊重疊。管線氣泡大幅驟降、吞吐量飆升，且保留兩份模型參數的開銷（即名為「Dual」的原因）在專家平行早已將專家分攤至各個 rank 時顯得微不足道。本課是深入剖析 DualPipe 實際運作原理的導覽，並探討 Sea AI Lab 的 DualPipeV 改良版如何以極微幅的氣泡代價省去 2 倍參數開銷。

**Type:** Learn
**Languages:** Python (stdlib, schedule simulator)
**Prerequisites:** Phase 10 · 05 (distributed training, FSDP, DeepSpeed), Phase 10 · 14 (open-model architectures and MoE)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 指出 DualPipe 前向－反向區塊的四個組成元件，以及為何每個元件都能獲得專屬的重疊視窗
- 解釋大規模訓練下的管線氣泡問題，以及宣傳用語中的「無氣泡」在實務上的真正意義
- 手動推導 8 個 PP ranks 與 16 個微批次的 DualPipe 排程表，驗證正向與反向資料流如何填補彼此的閒置槽位
- 陳述 DualPipeV（Sea AI Lab，2025 年）所做的權衡：在未啟用專家平行時，以稍微擴大的氣泡為代價消除 2 倍參數複本開銷

## The Problem｜問題

在 2,000 張 H800 GPU 上訓練 6,710 億參數的 MoE 模型，會遭遇三個相互疊加的瓶頸：

1. **記憶體極限壓力。** 每張 GPU 僅持有模型的一小部分切片。在序列長度 8k、橫跨 61 層與 128 個頭的配置下，活化值記憶體極其龐大。
2. **管線氣泡（Pipeline bubbles）。** 傳統的管線平行（GPipe、1F1B）使 GPU 在等待其階段的輸入或梯度時被迫閒置。在 8 個階段下，即使採用 1F1B 排程，仍有約 12% 的 GPU 時間淪為氣泡空轉。
3. **跨節點 All-to-all 通訊。** 結合專家平行的 MoE 將專家打散至不同節點。每次前向傳遞（forward pass）都會觸發一次 all-to-all 通訊將 token 分發至對應專家，隨後再觸發一次通訊進行匯總。在 2,000 張 GPU 下，運算與通訊時間比很容易惡化至 1:1。

每項難題各有其單獨的解方：針對記憶體採用活化值檢查點、針對管線氣泡採用 Zero Bubble（Sea AI Lab，2023 年）、針對 all-to-all 採用專用通訊核心。而 DualPipe 的突破在於讓這三者協同運作。其排程機制在單一前向－反向區塊內重疊計算與通訊，同時從管線兩端注入微批次，並利用由此產生的排程表將 all-to-all 通訊隱藏在計算視窗內部。

回報成果：近乎消除了管線氣泡，在 DeepSeek-V3 的 14.8 兆 token 訓練執行作業中達到了 95% 以上的 GPU 利用率。

## The Concept｜核心概念

### 管線平行溫故知新

將 N 層模型拆分至 P 個裝置上。裝置 `i` 持有第 `i * N/P .. (i+1) * N/P - 1` 層。微批次向前流經裝置 0 到 P-1，隨後反向從 P-1 流回 0。每個裝置只有在前一個裝置送達輸出時才能啟動前向傳遞，且只有在下游裝置送達上游梯度時才能啟動反向傳遞（backward pass）。

GPipe（Huang 等人，2019 年）一次僅排程單一微批次，浪費了絕大多數 GPU 時間。1F1B（Narayanan 等人，2021 年）交錯執行多個微批次的前向與反向傳遞。Zero Bubble（Qi 等人，2023 年）將反向傳遞拆分為兩部分——針對輸入的梯度反向（B）與針對權重的梯度反向（W）——並將它們靈活排程以填補氣泡。經過 Zero Bubble 最佳化後，管線已經相當緊湊。

DualPipe 則更進一步，在既有基礎上加入了兩大核心思想：

### 核心思想 1：區塊拆解

每個前向運算區塊被細分為四個元件：

- **注意力計算（Attention）。** Q/K/V 投影、注意力運算、輸出投影。
- **All-to-all 分發（All-to-all dispatch）。** 跨節點通訊，將 token 路由至其所屬的專家。
- **MLP 計算。** MoE 專家的核心前饋計算。
- **All-to-all 匯總（All-to-all combine）。** 跨節點通訊，將專家運算結果收集聚合。

反向運算區塊同樣包含這四者的梯度對應版本。DualPipe 巧妙排程它們，使得 all-to-all 分發與下一個區塊的注意力計算平行重疊進行，而 all-to-all 匯總則與後續區塊的 MLP 計算平行重疊。

### 核心思想 2：雙向排程

傳統的管線排程都是從階段 0 注入微批次並向階段 P-1 流動。而 DualPipe 從**管線兩端同時**注入微批次。階段 0 看見源自當地的正向微批次；階段 P-1 同樣看見源自當地的正向微批次。兩股資料流在中間匯合。

為了讓此架構生效，裝置 `i` 必須同時持有管線前期的第 `i` 層**以及**管線後期的第 `P - 1 - i` 層。這正是 DualPipe 名稱中「Dual」的由來：每個裝置維護了其所需服務的模型層的兩份複本（正反方向各一份）。在 DeepSeek-V3 的規模下，這意味著 2 倍的參數複本開銷。這之所以能夠負擔，是因為專家平行（Expert Parallelism）早已將 MoE 專家打散得極為稀疏，非專家層複製兩份的開銷在整體佔比中極其微小。

最關鍵的是：一個方向的前向資料流與另一個方向的反向資料流，恰好能在單向排程原本會產生氣泡的時隙中完美重疊。氣泡就此煙消雲散。

### 手動推導排程表

考慮 P = 4 個 ranks、8 個微批次（切分為 4 個正向 / 4 個反向）。時間由左至右移動；橫列代表各裝置 rank：

```
           Time →
rank 0:  F1 F2 F3 F4  F5R F6R F7R F8R  B1 B2 B3 B4  ...
rank 1:     F1 F2 F3  F4/F5R F6R F7R   B1 B2 ...
rank 2:        F1 F2  F3/F5R F4/F6R    B1 ...
rank 3:           F1  F2/F5R F3/F6R    ...
```

解讀「F4/F5R」標記：rank 1 在同一個時隙中，同時執行微批次 4 的前向傳遞（由左向右流經管線）**以及**微批次 5 的前向傳遞（由右向左反向流動）。這正是「雙向」在運作上的真實意義。

在 rank 2，兩股交叉資料流較早重疊；在 rank 0 與 P-1，它們最晚重疊。在排程的穩定中間階段，每個 rank 都在執行 X 方向的前向傳遞與 Y 方向的反向傳遞相互重疊的運算。計算核心始終全速運轉。前向的 all-to-all 分發隱藏在反向計算中；all-to-all 匯總則隱藏在前向計算中。氣泡被徹底擠出。

### 氣泡成本精算

標準 1F1B 管線氣泡（每個 rank 浪費的時間）：

```
bubble_1F1B = (P - 1) * forward_chunk_time
```

Zero Bubble 能將其壓縮，但無法降至零。DualPipe 在穩定階段中，若微批次數量能被管線深度的 2 倍整除，則能達到嚴格的零氣泡。在穩定階段之外（暖機與冷卻期），雖然存在少量氣泡，但它**絕不會隨著微批次數量增長而放大**——這是論文重點強調的關鍵特性。

宣傳用語稱之為：「無氣泡（bubble-free）」。技術嚴謹術語則是：氣泡不隨微批次數量等比膨脹。Sea AI Lab 的後續分析（DualPipeV / Cut-in-half）指出，嚴格的零氣泡僅在專家平行通訊非瓶頸（bottleneck）時完全成立；在 EP 驅動的 all-to-all 下，永遠存在微小的排程折衷。

### DualPipeV——架構精煉

Sea AI Lab（2025 年）觀察到：當 EP 通訊重疊並非核心訴求時，2 倍參數複製純屬浪費。其 DualPipeV 排程將雙向注入摺疊為「V 字型」排程，僅在單一參數複本上執行。其氣泡略大於 DualPipe，但記憶體節省極其可觀。DeepSeek 在其開源的 DualPipe 實作中採納了 DualPipeV 作為關閉 EP 模式下的預設方案。

各方案權衡對比：

| 特性 | DualPipe | DualPipeV | 1F1B | Zero Bubble |
|---------|---------|-----------|------|------------|
| 每裝置參數複本數 | 2 | 1 | 1 | 1 |
| 氣泡隨微批次增長 | 固定常數 | 微幅增長 | 線性增長 | 線性增長 |
| 計算－通訊重疊 | 完全重疊 | 部分重疊 | 微乎其微 | 部分重疊 |
| 適用時機 | 重度依賴 EP 的 MoE | 稠密模型或輕量 EP | 基準參考 | 任何通用管線 |

### 在 14.8 兆 Token 訓練中的實際影響

DeepSeek-V3 在 2,048 張 H800 GPU 上消耗了約 280 萬個 GPU 小時，完成了 14.8 兆 token 的預訓練。若採用樸素的 1F1B，光是管線氣泡就會浪費 12% 到 15% 的時間——高達 34 萬至 42 萬個 GPU 小時，足夠完整訓練一個 70B 模型。DualPipe 挽回了其中的絕大部分損失。論文中宣稱在整個訓練過程中平均達到了 95% 以上的 GPU 利用率。

對於小型執行規模（1,000 張 GPU 以下），DualPipe 顯得過度設計——相對於總成本而言氣泡比例較小，且稠密模型訓練極少撞上 all-to-all 通訊天花板。但對於數千張 GPU 規模的前沿 MoE 訓練而言，它實務上幾乎不可或缺。

### 在技術堆疊中的定位

- 與 **FSDP**（第 10 階段第 5 課）互補：FSDP 跨 ranks 對模型參數進行分片；DualPipe 則跨 ranks 排程計算任務，兩者相輔相成。
- 與 **ZeRO-3** 梯度分片相容：兩份參數複本的記帳機制需與 ZeRO 分片梯度協同運作。
- 需要針對具體群集拓撲深度調校的**自訂 All-to-all 核心**：DeepSeek 的開源核心是其權威參考實作。

```figure
expert-capacity
```

## Use It｜實際應用

`code/main.py` 是一個管線排程模擬器。它接收 `(P, n_micro_batches, schedule)` 作為輸入，並印出 1F1B、Zero Bubble、DualPipe 與 DualPipeV 在穩定階段的利用率數字。它是一個教學工具——數值反映了論文中的定性結論，而非真實正式環境的實測加速保證。

模擬器的價值在於：調整不同的 P 與微批次數量，親眼觀察 1F1B 的氣泡比例如何不斷擴大，而 DualPipe 如何始終維持平穩。

真實訓練執行作業的整合注意事項：

- 挑選能被微批次數量整除的管線平行深度。
- 確保你的專家平行網格支援雙向 all-to-all 通訊（DeepSeek 的開源核心是業界參考）。
- 首次除錯排程時，預計需耗費一整週的時間；底層的狀態記帳極其繁瑣。
- 監控個別 rank 的 GPU 利用率，而非僅僅看總體平均。DualPipe 的威力在於縮小落後 rank 造成的差距。

## Ship It｜交付成果

本課產出 `outputs/skill-dualpipe-planner.md`。給定訓練群集規格（GPU 數量、拓撲架構、互連頻寬、模型結構），它會推薦適當的管線平行策略、所採用的排程演算法，以及目標規模下的預期氣泡佔比。

## Exercises｜練習

1. 針對 `(P=8, micro_batches=16, schedule=dualpipe)` 與 `(P=8, micro_batches=16, schedule=1f1b)` 執行 `code/main.py`。計算 GPU 利用率的差距，並將其換算為每百萬訓練 token 所挽回的 GPU 小時數。

2. 手動推導 `(P=4, micro_batches=8, schedule=dualpipe)` 的排程表格。標記每個時隙的微批次 ID 與方向，並指出氣泡徹底消失的第一個時隙位置。

3. 研讀 DeepSeek-V3 技術報告（arXiv:2412.19437）的圖 5。找出 DualPipe 前向區塊內部 all-to-all 分發的重疊視窗，並解釋計算排程如何將其隱藏。

4. 針對帶有 P=8 管線階段的 70B 稠密模型，以及帶有 P=16 管線階段的 671B MoE 模型，分別計算 DualPipe 2 倍參數開銷的具體數值。展示為何在 MoE 情況下該開銷比例顯著更小（絕大多數參數為專家，已分片於龐大的 EP 組中）。

5. 比較 DualPipe 與 Chimera（2021 年提出的雙向排程器競品）。參考論文第 3.4 節，指出 DualPipe 相較於 Chimera 所額外具備的兩項具體特性。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| 管線氣泡（Pipeline bubble） | 「每個 rank 的閒置時間」 | 因管線階段正在等待其輸入資料或反向梯度而浪費的 GPU 週期 |
| 1F1B | 「預設管線排程」 | 一前向一反向交錯執行的排程演算法；DualPipe 所超越的基準線 |
| Zero Bubble | 「Sea AI Lab 2023 年方案」 | 將反向拆分為輸入梯度（B）與權重梯度（W）；近乎完全消除氣泡的技術 |
| DualPipe | 「DeepSeek-V3 排程演算法」 | 雙向管線結合計算與通訊重疊；氣泡不隨微批次數量增長 |
| DualPipeV | 「腰斬版排程」 | V 字型改進版排程，以略微擴大氣泡為代價消除 2 倍參數複製開銷 |
| 運算區塊（Chunk） | 「管線工作單元」 | 單一微批次通過單一管線階段的前向或反向傳遞過程 |
| All-to-all 分發（All-to-all dispatch） | 「將 token 送給專家」 | 跨節點通訊，將 token 路由至其所指派的 MoE 專家處 |
| All-to-all 匯總（All-to-all combine） | 「取回專家輸出」 | 跨節點通訊，在 MLP 運算後將各專家的輸出重新聚合 |
| 專家平行（Expert Parallelism，EP） | 「跨 GPU 分散專家」 | 跨 ranks 對 MoE 專家進行分片，使不同 GPU 持有不同的專家群 |
| 管線平行（Pipeline Parallelism，PP） | 「跨 GPU 分散模型層」 | 跨 ranks 對模型層進行分片；DualPipe 負責排程的核心維度 |
| 氣泡佔比（Bubble fraction） | 「浪費的 GPU 時間比例」 | （氣泡時間 / 總時間）；DualPipe 致力於將其壓制至接近零的關鍵指標 |

## Further Reading｜延伸閱讀

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437), Section 3.3.2 and Figure 5](https://arxiv.org/abs/2412.19437) ——DualPipe 的權威主要參考文獻
- [DeepSeek — DualPipe GitHub repository](https://github.com/deepseek-ai/DualPipe) ——包含 DualPipeV 模式的官方開源參考實作
- [Qi et al. — Zero Bubble Pipeline Parallelism (arXiv:2401.10241, Sea AI Lab 2023)](https://arxiv.org/abs/2401.10241) ——Zero Bubble 前驅研究論文
- [Sea AI Lab — DualPipe could be better without the Dual](https://sail.sea.com/blog/articles/63) ——啟發 DeepSeek 引入 EP-off 模式的 DualPipeV 深入分析
- [Narayanan et al. — PipeDream / 1F1B (arXiv:1806.03377, 2018-2021)](https://arxiv.org/abs/1806.03377) ——DualPipe 進行橫向對比的經典 1F1B 排程研究
- [Huang et al. — GPipe (arXiv:1811.06965, 2018)](https://arxiv.org/abs/1811.06965) ——提出管線平行與氣泡問題的開創性經典論文
