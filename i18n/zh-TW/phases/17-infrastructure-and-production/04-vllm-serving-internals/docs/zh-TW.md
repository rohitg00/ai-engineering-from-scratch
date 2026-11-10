# 推論服務引擎內部架構——PagedAttention、連續批次、分塊 Prefill（Serving Engine Internals — PagedAttention, Continuous Batching, Chunked Prefill）

> 現代推論服務引擎的高吞吐量建立在三大相輔相成的核心預設機制之上，絕非單一技巧的功勞。PagedAttention 始終預設開啟。連續批次處理（Continuous batching）在每次解碼（Decode）迭代之間，動態將新請求注入運作中的批次。分塊 Prefill（Chunked prefill）將長 Prompt 拆解為微小切片，使解碼 Token 永遠不致陷入飢餓空轉。將這三者同時開啟後，單張 H100 SXM5 上的 Llama 3.3 70B FP8 模型在 128 個並行請求下能飆出 2,200 至 2,400 tok/s 的吞吐量——比 vLLM 自身的預設配置提升約 25%，更是原生天真 PyTorch 迴圈的 3 至 4 倍。本課帶你從架構圖層級深入剖析 vLLM（上述三大技術的基準參考實作引擎）的排程器與注意力核心（Kernel），並在 `code/main.py` 中以純 Python 打造一個能如 vLLM 般精準協調 Prefill 與 Decode 的微型連續批次排程器。

**Type:** Learn
**Languages:** Python (stdlib, toy continuous batching scheduler)
**Prerequisites:** Phase 17 · 01 (Model Serving), Phase 11 (LLM Engineering)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 將 PagedAttention 深刻理解為 KV 快取的虛擬記憶體配置器：掌握 Block 區塊、Block 表的底層原理，以及為何在正式環境負載下顯示記憶體碎片率能始終壓低在 4% 以下。
- 在迭代週期（Iteration）層次精準繪製連續批次處理架構圖：清楚理解已完成序列如何退出批次、新序列如何在不排空現有批次的前提下無縫併入。
- 以一句話精準概括分塊 Prefill（Chunked prefill），並指出它所守護的核心延遲指標（提示：守護的是 TTFT 長尾延遲，而非平均吞吐量）。
- 在一口氣啟用所有進階最佳化選項之前，學會嚴格依據你所採用的具體 vLLM 版本核對官方功能相容性矩陣。

## The Problem｜問題

天真的原生 PyTorch 服務迴圈一次僅處理一個請求：Tokenize 文本、執行 Prefill、逐步 Decode 直至觸發結束符 EOS，隨後回傳結果。當系統僅有 1 位使用者時運作良好；然而一旦湧入 100 位使用者，服務便會退化為一條漫長的排隊人龍。顯而易見的初級改良方案——靜態批次處理（Static batching）——會將窗口內的所有請求統一填充 Padding 至該批次中最長的 Prompt 長度，並將每次解碼統一填充至最長預期輸出長度，導致整個批次的進度被迫卡死在吐字最慢的單一序列上。你得為沒有用到的 Padding 浪費運算資源，且原本極速的短請求被迫苦等緩慢的長請求。

vLLM 同時解決了這三大核心痛點。PagedAttention 徹底終結了傳統連續記憶體配置浪費高達 60% 至 80% 的 GPU 記憶體的悲劇。連續批次處理允許請求在解碼的每次迭代之間自由併入與退出，確保 GPU 批次永遠充斥著高價值的真實運算。分塊 Prefill 則將高達 32k Token 的超長 Prompt 拆解為約 512 Token 的微小切片，並將其與常規解碼過程精巧交錯排程，使長 Prompt 絕不會引發 GPU 解碼全域凍結。

在 2026 年的正式環境中，同時開啟這三大機制已是標準預設。你必須深刻理解各自的運作細節，因為推論服務的絕大多數崩潰模式皆源自排程器，而非神經網路模型本身。

## The Concept｜核心概念

### PagedAttention 作為虛擬記憶體系統（PagedAttention as a virtual memory system）

對於單一序列而言，KV 快取所需的 GPU 記憶體用量為 `num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element`。以 Llama 3.3 70B 模型在 8,192 Token 長度下的 BF16 精度為例，單一序列便需消耗約 1.25 GB GPU 記憶體。若你為每個請求皆預先固定預留 8,192 個位置，而平均每個請求實際使用 1,500 Token，你將白白浪費所預留高頻寬記憶體（HBM）的約 82%。傳統靜態批次處理必須默默承受這項驚人的記憶體浪費。

PagedAttention 巧妙借鑑了作業系統的虛擬分頁記憶體思想。它打破了 KV 快取必須連續分佈於實體 GPU 記憶體中的硬性枷鎖，將其劃分為固定大小的微小 Block 區塊（預設大小為 16 Token）。每個序列皆維護一張專屬的 Block 表（Block table），精準將邏輯 Token 位置映射至實體 Block 索引。當序列長度超越當前配置的 Block 時，系統動態追加一個新 Block；當該序列推論完畢時，對應的 Block 立即釋放回全域資源池。

GPU 記憶體碎片浪費率因而從傳統連續配置的 60% 至 80% 驟降至 4% 以下。在 vLLM 中，你無需手動傳入任何開關參數——PagedAttention 是其唯一內建的記憶體配置器。核心調整參數是 `--gpu-memory-utilization`（預設值為 0.9），它直接指示 vLLM 在扣除模型權重與暫態活化值（Activation）之後，允許將多少比例的剩餘 HBM 劃歸為 KV Block 資源池。

### 迭代週期的連續批次處理（Continuous batching at the iteration level）

舊時代的「動態批次處理（Dynamic batching）」通常會等待一個固定的時間窗口（例如 10 ms）以拼湊出一批請求，隨後連續執行 Prefill + Decode + Decode + Decode 直至該批次內所有序列全部完工。提早吐字結束的短序列被迫在 GPU 記憶體中乾等閒置，直到 GPU 慢吞吞地算完最後一個超長序列。

連續批次處理則深入至每次解碼步進（Iteration）之間運作。我們將當前正在推論中的活躍序列集合稱為 `RUNNING` 清單。在每一次迭代中：

1. 檢查 `RUNNING` 清單，凡是剛剛產生 EOS 標記或達到最大長度的序列，立即剔除並釋放 GPU 記憶體。
2. 排程器巡檢等待佇列（waiting queue）。若全域資源池中有足夠的閒置 KV Block，立即准入新序列（執行 Prefill 或還原先前暫停的序列）。
3. 針對當前 `RUNNING` 清單中的所有序列統一執行一次 Forward 前向傳播，為每條序列並行產出一個全新 Token。

批次大小不再死板固定，亦無需 Padding。處於不同生成進度的序列共用一次融合式前向傳遞。在 2026 年 vLLM 中，這被稱為 `V1 scheduler`。其核心鐵律在於：排程器在每次解碼迭代時皆會執行一次，而非按請求生命週期觸發。

### 分塊 Prefill 捍衛長尾 TTFT 延遲（Chunked prefill protects TTFT tail）

Prefill 階段屬於典型的運算受限（Compute-bound）操作。在單張 H100 上為 Llama 3.3 70B 處理一段 32k Token 的超長 Prompt，需要約 800 ms 的純 Prefill 運算時間。在此期間，批次中所有其他序列的解碼吐字運算將被迫全數掛起等待。在多租戶服務環境下，單一使用者的超長 Prompt 會直接導致全場數十位其他使用者的 Token 間延遲（Inter-Token Latency, ITL）發生劇烈跳躍與卡頓。

分塊 Prefill 將龐大的 Prefill 任務拆解為固定大小的微小 Chunk（預設通常為 512 Token），並將每個 Chunk 視為獨立的調度單元。在每個 Chunk 運算完畢的間隙，排程器能及時切入，讓等待解碼的序列順利向前推進一個 Token。你僅僅付出了極微小的絕對 Prefill 耗時代價（每個分塊額外增加數毫秒開銷），便換來了解碼端顯著降低的延遲抖動。在各類公開實測中，混合負載下的 P99 ITL 延遲從約 50 ms 驟降至約 15 ms。

### 三大核心預設機制的深度聯動（The three defaults interact）

這三大功能彼此高度共生、互為基石。PagedAttention 為排程器提供了細粒度的 KV GPU 記憶體資源；連續批次處理依賴這項細粒度資源，使得新序列的併入無需牽動全局記憶體搬移重組；而分塊 Prefill 則是排程器在同一個 `RUNNING` 清單上做出的精緻切片決策——它是排程器的一種策略體現，而非獨立存在的割裂系統。

你無需背誦每一項瑣碎的命令列參數。你只需看清排程器的終極目標：在嚴格鎖定的 KV Block 預算上限內，在分塊 Prefill 的切片約制下，將系統的 Goodput 推向極限。

### 嚴格核對版本相容性矩陣（Check the compatibility matrix）

在將所有最佳化標記全數開啟之前，務必仔細對照你所採用的確切 vLLM 版本的官方相容性矩陣，因為跨版本之間的功能相容性時常發生演進。在 v0.18.0 中，官方功能矩陣明確標註推測解碼（Speculative Decoding）已能與分塊 Prefill 及前綴快取（Prefix Caching）相容；而在推測解碼專屬頁面上，則列出了兩項已知的歷史不相容限制：v0.15.0 之前的流水線平行（Pipeline Parallelism），以及 v0.10.0 之前的獨立草稿模型推測（Draft-model speculation）。針對草稿模型方法本身，2026 年常見的選擇是 EAGLE-3（`"method": "eagle3"`），這將在第 17 課第 05 節深度展開。

### 務必銘記的核心數字指標（Numbers you should remember）

- Llama 3.3 70B FP8 模型在單張 H100 SXM5 上、128 並行、三項全開下的吞吐量：2,200 至 2,400 tok/s。
- 相同模型在 vLLM 預設配置下（未啟用分塊 Prefill）：約 1,800 tok/s。
- 相同模型在天真 PyTorch 原生迴圈下：僅約 600 tok/s。
- 正式環境高負載下 PagedAttention 的 GPU 記憶體碎片浪費率：低於 4%。
- 混合負載下的 P99 ITL 延遲：啟用分塊 Prefill 後約 15 ms，未啟用時高達 50 ms。

### 排程器核心架構全貌（What the scheduler looks like）

```
while True:
    finished = [s for s in RUNNING if s.is_done()]
    for s in finished: release_blocks(s); RUNNING.remove(s)

    while WAITING and have_free_blocks_for(WAITING[0]):
        s = WAITING.pop(0)
        allocate_initial_blocks(s)
        RUNNING.append(s)

    # schedule prefill chunks + decode in one batch
    batch = []
    for s in RUNNING:
        if s.in_prefill:
            batch.append(next_prefill_chunk(s))   # e.g. 512 tokens
        else:
            batch.append(decode_one_token(s))     # 1 token

    run_forward(batch)                            # one fused GPU call
```

`code/main.py` 正是以純標準函式庫 Python 精確還原了上述迴圈，搭配模擬的 Token 計數與模擬 Forward 延遲。執行該程式，能清晰直觀地觀察到分塊 Prefill 如何在超長 Prefill 的夾縫中頑強保證解碼序列平穩吐字。

```figure
tensor-parallel
```

## Use It｜實際應用

`code/main.py` 模擬了一套具備各類功能開關的 vLLM 風格排程器。執行該程式可比對：

- `NAIVE` 模式：單請求串列執行，零批次。
- `STATIC` 模式：固定 Padding 統一等待，傳統批次處理。
- `CONTINUOUS` 模式：解碼迭代週期的無縫准入與退出。
- `CONTINUOUS + CHUNKED` 模式：Prefill 微分塊與解碼交錯排程。

終端機將即時輸出整體吞吐量（每虛擬秒 Token 數）、平均 TTFT（第一個 token 延遲）以及 P99 ITL。在混合流量下，`CONTINUOUS + CHUNKED` 模式應會占優。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-vllm-scheduler-reader.md`。給定具體的服務配置參數（批次大小、KV 記憶體利用率、分塊 Prefill 尺寸、推測解碼配置），該 Skill 將自動診斷當前排程器的效能瓶頸究竟卡在三大預設中的哪一項，並給出精準的調優建議。

## Exercises｜練習

1. 執行 `code/main.py`。在包含長短混合請求的負載下，對比 `STATIC` 與 `CONTINUOUS` 模式。兩者巨大的吞吐量落差究竟源自何處——是 Prefill 效率、解碼效率，還是長尾延遲的拖累？
2. 修改該微型排程器，手動引入 `--max-num-batched-tokens` 參數約束。對於在 H100 上運作 Llama 3.3 70B FP8 而言，該參數的最佳合理數值應當如何計算？（提示：它是 KV Block 大小與閒置 Block 數量的函數，而非單純的總顯示記憶體容量。）
3. 重讀 vLLM v0.18.0 的官方 Release Notes。哪些命令列開關組合當前依然互斥無法共存？完整列出它們。
4. 針對包含 1,000 個請求、輸出長度均值為 1,500 Token、標準差為 600 Token 的真實流量追蹤軌跡，精確計算以下兩種方案的顯示記憶體碎片浪費率：(a) 按 8,192 最大長度連續預留配置；(b) 採用 16-Token Block 的 PagedAttention 配置。
5. 用一段簡練的話解釋：為何單獨開啟分塊 Prefill 能夠極大改善 P99 ITL，卻無法在孤立狀態下提升總吞吐量？在真實正式環境中，吞吐量的額外增益究竟是透過什麼機制間接獲得的？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| PagedAttention | 「KV 快取技巧」 | 用於 KV 快取的固定大小區塊配置器；碎片率低於 4% |
| Block table | 「分頁表」 | 將每個序列的邏輯 token 位置對應至實體 KV 區塊的映射表 |
| Continuous batching | 「更完善的動態批次」 | 每次解碼迭代都會決定納入或移除哪些請求 |
| Chunked prefill | 「分塊 Prefill」 | 將長 Prefill 切成 512-token 片段，並與解碼交錯執行 |
| TTFT | 「第一個 token 延遲」 | Prefill、佇列與網路時間的總和；長 Prompt 下主要由 Prefill 決定 |
| ITL | 「token 間延遲」 | 連續兩個解碼 token 之間的時間；主要受批次大小影響 |
| Goodput | 「符合 SLO 的吞吐量」 | 每秒輸出且所有請求仍符合 TTFT 與 ITL 目標的 token 數 |
| V1 scheduler | 「新版排程器」 | vLLM 於 2026 年採用的排程器；以分塊 Prefill 執行連續批次 |
| `--gpu-memory-utilization` | 「記憶體設定參數」 | 載入權重和活化值後，保留給 KV 區塊的 HBM 比例 |

## Further Reading｜延伸閱讀

- [vLLM documentation — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode/) — 官方關於分塊 Prefill 與推測解碼相容性的權威文件。
- [vLLM Release Notes (NVIDIA)](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) — 2026 年版本迭代節奏與特定版本行為變更指南。
- [vLLM Blog — PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) — 奠定現代配置器架構思維的原創奠基文章。
- [PagedAttention paper (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180) — 記憶體碎片數學分析與排程器架構設計原著。
- [Aleksa Gordic — Inside vLLM](https://www.aleksagordic.com/blog/vllm) — 搭配火焰圖（Flame graph）深度剖析 V1 排程器的權威技術長文。
