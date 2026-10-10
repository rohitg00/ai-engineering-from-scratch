# 非同步與 Hogwild! 推論

> 推測解碼（speculative decoding，第 10 階段第 15 課）在單一序列內部實現 token 的平行化。多 agent（Multi-agent）框架跨完整序列進行平行化，但必須依賴顯式的協調機制（投票、子任務拆解）。Hogwild! 推論（Rodionov 等人，arXiv:2504.06261）則開闢了另一條道路：讓同一個 LLM 的 N 個實例針對同一個「共享鍵值快取（Shared KV Cache）」並行運作。每個 worker 都能即時看見其他所有 worker 生成的 token。現代推理模型——QwQ、DeepSeek-R1——在完全未經任何 fine-tuning 的情況下，就能透過該共享快取自發進行協調分工。這項方法雖處於實驗前沿，但它開啟了一條與推測解碼完全正交的全新推論平行化維度。本課以標準 Python 實作一個雙 worker 的 Hogwild! 模擬器，並剖析為何這種共享快取協作能從既有模型的推理能力中自然湧現。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 10 · 12 (inference optimization), Phase 10 · 15 (speculative decoding)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 描述三種常見的平行 LLM 拓撲架構（投票、子任務、Hogwild!），並指出每種架構各自鎖定的問題領域
- 陳述 Hogwild! 的核心配置：多個 worker、單一共享 KV 快取，以及透過自我 prompt 實現的湧現式協調
- 根據 worker 數量 `N`、任務級可平行化比例 `p` 以及協調開銷 `c`，計算 Hogwild! 的實際耗時加速比
- 在玩具問題上實作雙 worker 的 Hogwild! 模擬器，並觀察任務分工的湧現過程

## The Problem｜問題

現代 LLM 解決複雜難題仰賴於產出冗長的思維鏈——動輒包含 5,000 個 token 的逐步推導極為常見，在深奧數學問題上甚至高達數萬個 token。在 70B 模型以每秒 35 個 token 的解碼速度（decode speed）下，50,000 個 token 意味著需要 24 分鐘。模型仍不適合即時互動。

推測解碼（第 10 階段第 15 課）透過在單一序列內部進行平行化，能為你帶來 3 到 5 倍的加速。但在此之外，自回歸解碼嚴格的循序依賴性是一道無法踰越的硬天花板：每個新 token 都嚴格依賴於之前的所有 token。

顯而易見的問題來了：我們能否跨序列實現平行化？針對同一個問題執行同一個模型的多個複本，讓它們相互合作、分工解題？

先前的嘗試包括：投票集成（voting ensemble，執行 N 個模型，採多數決答案）、思維樹（tree of thought，展開多條分岔推理路徑隨後再重組），以及多 agent 框架（為每個 agent 指派子任務，並由協調器統一指揮）。這些在特定任務領域中皆有所助益，但無一例外都引入了顯式協調機制——投票規則、分岔與剪枝邏輯、agent 間的訊息傳遞協議。

Hogwild! 推論採取了截然不同的進路。N 個 worker 共同共享單一個 KV 快取。每個 worker 都能立即看見其他所有 worker 生成的 token，就如同看見自己剛生成的文字脈絡一樣。這些 worker——在完全沒有任何專項訓練或 fine-tuning 的情況下——自行摸索出如何分工合作。現代推理模型（QwQ、DeepSeek-R1、Claude 系列的思考模式）在閱讀共享快取後，會自然展現出如「我注意到 worker 2 已經處理了基礎情況，因此我將著手處理歸納步驟」的自發協調行為。

截至 2026 年 4 月，其加速幅度高度依賴於具體工作負載且仍屬前沿探索。但這個想法極具啟發性，因為它打開了一條全新的推論平行化軸線。

## The Concept｜核心概念

### 架構設置

初始化 N 個 worker 行程，皆執行同一個 LLM。不再為每個 worker 維護專屬的 KV 快取，而是維護「單一共享快取」。當 worker `i` 生成 token `t_j` 時，該 token 會被直接寫入共享快取的下一個可用位置。當 worker `k` 執行下一步時，它讀取的是快取的最新狀態（包含迄今為止所有 N 個 worker 生成的全部內容）。

在執行步驟時，各 worker 相互競爭寫入 token。不存在逐 worker 的位置索引——快取本質上是一條單一增長的連續序列。先後順序純粹取決於寫入請求的到達時間。

### 協作行為為何能夠湧現

所有 worker 共享同一份 prompt。通常類似於：「你是共同解決此問題的 N 個實例之一。每個實例皆能讀取共享記憶體，並看見其他實例寫下的內容。請避免重複勞動。」Prompt 加上共享快取就已足夠。推理模型在閱讀快取後，會注意到問題的哪些部分已經被嘗試解答過，並（通常但並非總是）自發轉向未探索的子問題。

Hogwild! 論文（Rodionov 等人，2025 年）記錄了諸多令人驚嘆的現象：

- Worker 能自行制定計畫，並透過快取將其溝通給其他 worker。
- Worker 能敏銳察覺其他 worker 推導中的邏輯謬誤，並在後續輸出中指正。
- 當某一計畫受阻時，Worker 能自適應調整並提出替代解法。
- 當被提示檢查重複性時，Worker 能偵測到多餘勞動並迅速轉向。

這一切皆不需要專門的 fine-tuning。這種湧現行為直接源自模型原本就已具備的深層推理能力。

### 命名由來

論文名稱借鑑了 Hogwild! SGD（Recht 等人，2011 年）——一種非同步更新的最佳化演算法。其類比在於：SGD 中的非同步 workers 全都無鎖寫入共享參數向量；而 Hogwild! 推論中的 workers 則全都寫入共享 KV 快取。兩者皆依賴於實證上的經驗收斂，而非嚴格的同步保證。

### RoPE 讓此架構具備工程可行性

旋轉位置編碼（RoPE，Su 等人，2021 年）透過在 Q 與 K 向量中旋轉來編碼位置資訊。由於位置純粹表現為旋轉角度而非寫死的絕對偏移量，因此 token 的位置即便發生平移，也無需重新計算 KV 快取條目。當 worker `i` 在位置 `p` 寫入共享快取時，其他讀取該位置的 worker 可以直接複用已快取的條目——完全不需要重新旋轉。

若在學習得來的絕對位置編碼模型中，Hogwild! 在每次並行寫入時都必須使快取失效。而 RoPE 讓共享快取能夠保持高度穩定。

### 實際耗時算式

令 `T_serial` 為單一 worker 獨立解題所需的時間。令 `p` 為任務層級的可平行化比例。令 `c` 為每步的協調開銷（讀取擴展後的快取、判斷接下來該寫什麼）。

單一 worker 時間：`T_serial`。
N 個 worker 在無協調開銷下的 Hogwild! 時間：`T_serial * ((1 - p) + p / N)`，經典阿姆達爾定律（Amdahl's law）。
納入協調開銷後：`T_serial * ((1 - p) + p / N) + c * steps_per_worker`。

若要讓多 worker 真正具備產能，`c` 相對於單步 decode 時間必須夠小。在產出 5,000 個以上 token 的推理模型中，workers 完全能承擔數百個 token 的協調代價，且依然能在整體時間上勝出。但在短對話任務中，協調開銷將佔據主導地位，此時 Hogwild! 的表現會比單一循序執行更差。

### 具體案例試算

推理問題：包含 10,000 個 token 的思維鏈。假設該問題具備 `p = 0.7` 的可平行化內容（不同的證明路徑、不同的案例分類討論），且每個 worker 耗費 `c = 200` 個 token 的協調開銷。在 `N = 4` 個 worker 下：

- 循序耗時：10,000 個 decode 步驟。
- Hogwild! 耗時：10,000 * (0.3 + 0.7 / 4) + 200 * 4 = 10,000 * 0.475 + 800 = 5,550 個 decode 步驟。
- 加速比：10,000 / 5,550 = 1.8 倍。

這幅度看似溫和。但面對更深奧的推理難題（50,000 個 token）時，協調開銷被極大幅度分攤，加速比可推升至 2.5 到 3 倍。Hogwild! 在推論層面的角色，就像是在一門原生支援多執行緒的程式語言中編寫自然的多執行緒程式碼。

### 何時採用 Hogwild!

- 需要產出數千 token 的長推理問題，且任務可被拆解為多個獨立的子目標。
- 專門受過逐步思考訓練的強大推理模型。非推理模型無法自發形成有效協調。
- 單節點部署且具備充裕 VRAM，能容納共享快取加上 N 個 worker 行程的活化值記憶體。

### 何時不應採用

- 短互動對話：協調開銷佔據主導。
- 本質上不可平行的任務（單一線性推導、單一編譯流程）：N=1 就是上限。
- 非推理模型：完全無法湧現出協調行為。
- 跨節點分散式部署：共享快取需要極高速的跨 worker 同步，節點內同步可行，但跨節點會演變成延遲災難。

### 實驗現況

截至 2026 年 4 月，Hogwild! 仍是一項擁有開源 PyTorch 實作的前沿研究方法，尚未進入商業正式環境。需要不少系統工程工作：

1. 跨並行行程的共享 KV 快取記憶體管理具備極高的系統工程門檻。
2. 湧現式協調高度依賴於具體任務，基準測試評估體系仍在建立中。
3. 穩定而言，其提升較為溫和；雖然兩者可以相結合，但複合工程難度又提升了一個層次。

值得深度理解，值得動手實驗，但尚未到可以將核心商業產品押注其上的成熟度。

```figure
continuous-batching
```

## Build It｜動手實作

`code/main.py` 實作了一個玩具級的 Hogwild! 模擬器：

- 兩個 worker 行程，各自扮演一個確定性的「LLM」，以已知機率產出特定類別的 token（工作 token、觀察 token、協調 token）。
- 一個兩者皆可讀寫的共享快取（單純的 token 列表）。
- 一套簡潔的協調邏輯：當一個 worker 看見另一個 worker 已經在某個類別產出了足夠的工作 token 時，它會主動切換至其他類別。

模擬器在固定的步驟預算下執行，並回報：

- 產出的工作 token 總數。
- 總實際耗時（worker 步驟數）。
- 相對於單一 worker 的實質加速比。
- 每個 token 由哪個 worker 寫入的追蹤記錄。

### 步驟 1：共享快取

兩個 worker 共同追加寫入的列表。在真實實作中採用鎖機制（Python `threading.Lock`），在此處以計數器進行模擬。

### 步驟 2：Worker 迴圈

每個 worker 在每個步驟中：

- 讀取當前的共享快取。
- 根據既有內容判斷接下來該寫入哪個類別的 token。
- 寫入一個 token。

### 步驟 3：協調啟發式邏輯

若類別 X 在快取中已有 K 個 token 且 worker 原本計畫寫入 X，該 worker 會切換至類別 Y。這充當了推理模型「注意到此處已有人處理，主動轉向其他方向」行為的玩具級替代實作。

### 步驟 4：加速比實測

分別以 N=1 與 N=2 個 worker 執行模擬器，維持相同的總步驟預算。統計產出的工作 token 數量。由於協調機制促成了任務分工，N=2 應產出約 1.5 到 1.8 倍的工作 token。

### 步驟 5：壓力測試協調脆弱度

調降協調啟發式邏輯的敏感度並重新執行。觀察到若缺乏良好協調，N=2 會冗餘產生重複的 token，加速比直接跌落至 1 以下。這精準印證了論文的洞見：該技巧只有在 workers 具備充足推理能力以實現自我協調時才能成立。

## Use It｜實際應用

截至 2026 年 4 月，Hogwild! 在業界仍處於前沿研究水準。來自 Yandex/HSE/IST 的參考實作基於 PyTorch，專為在 DeepSeek-R1 與 QwQ 模型上執行單節點多程序所設計。

務實的評估路徑：

1. 分析你的推理任務負載，測量其中有多大比例屬於探索性 token（多路策略、案例枚舉、搜尋驗證）而非嚴格線性推導。
2. 若探索性佔比顯著，啟動雙 worker 的 Hogwild! 實驗，測量實際耗時改善幅度。
3. 若改善幅度低於 1.3 倍，說明已落入協調主導的劣勢區間，應退回單 worker。
4. 若改善幅度超過 1.5 倍，可推進至 N=4 並重新測量；邊際效益遞減通常在 N=4 到 8 之間出現。

與推測解碼複合運用：每個 Hogwild! worker 可在內部獨立啟用推測解碼。兩者的加速比大致呈相乘關係——3 倍的推測解碼乘上 1.8 倍的 Hogwild!，能在單一循序解碼基礎上疊加出高達 5.4 倍的實質加速。

## Ship It｜交付成果

本課產出 `outputs/skill-parallel-inference-router.md`。給定推理工作負載規格（token 預算、任務可平行度特徵、模型家族、部署硬體），它能在投票集成、思維樹、多 agent、Hogwild! 與推測解碼策略之間做出最適路由決策。

## Exercises｜練習

1. 以預設設定執行 `code/main.py`。確認在相同的實際耗時內，N=2 的 Hogwild! 配置產出的工作 token 數量多於 N=1 基準線。

2. 調降協調啟發式的權重（設定 `coordination_weight=0.1`）並重新執行。展示加速比如何崩潰，並解釋背後原因：當無法有效協調時，workers 會相互重複勞動。

3. 為帶有 `p=0.8, c=500` 的 50,000 token 推理任務在 N=4 下計算預期 Hogwild! 加速比；隨後為帶有 `p=0.3, c=200` 的 1,000 token 對話任務在 N=4 下計算相同數值。解釋為何一個有利、另一個卻不利。

4. 研讀 Hogwild! 論文第 4 節（初步評估）。指出作者所記錄的兩種失敗模式，並說明更周全的協調 prompt 如何緩解這兩種情況。

5. 在玩具實作中將 Hogwild! 與推測解碼結合：讓每個 worker 內部採用 2-token 推測解碼。回報相乘後的複合加速比。思考當兩個 worker 同時試圖延伸同一個共享快取前綴時，會產生何種記帳難題？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Hogwild! | 「平行 workers 共享快取」 | 同一個 LLM 的 N 個實例並行執行，共用單一共享 KV 快取；透過自我提示實現湧現式協作 |
| 共享 KV 快取（Shared KV cache） | 「協調的中介平台」 | 所有 worker 共同讀寫的單一增長 KV 緩衝區；使 token 在各 worker 間立即可見 |
| 湧現式協調（Emergent coordination） | 「不需要專案訓練」 | 具備強大推理能力的 LLM 在無任何 fine-tuning 或顯式協議下，自主閱讀共享快取並分工解題 |
| 協調開銷（c） | 「花在重新辨識方向上的 token」 | 每個 worker 讀取擴展後的快取並決策下一步所需的 token 代價；相對於總 decode 時間必須維持極小 |
| 可平行化比例（p） | 「能平行跑的部分」 | 任務層級的固有可平行度：總工作量中可平行處理的比例 |
| RoPE 賦能 Hogwild! | 「旋轉位置具備平移不變性」 | 由於位置純粹編碼為旋轉角度，寫入共享快取不需要為先前 token 重新計算鍵值 |
| 投票集成（Voting ensemble） | 「跑 N 次採多數決」 | 最簡單的平行推論拓撲；適合分類任務，不適合長篇連續推理 |
| 思維樹（Tree of thought） | 「分岔與剪枝」 | 同時探索多條推理路徑並進行剪枝的策略；依賴顯式的協調演算法邏輯 |
| 多 agent 框架（Multi-agent framework） | 「拆分指派子任務」 | 每個 agent 擁有明確角色分工，由協調器統一指揮；帶有沉重的協議與通訊開銷 |

## Further Reading｜延伸閱讀

- [Rodionov et al. — Hogwild! Inference: Parallel LLM Generation via Concurrent Attention (arXiv:2504.06261)](https://arxiv.org/abs/2504.06261) ——在 QwQ 與 DeepSeek-R1 上進行初步評估的 Hogwild! 原創論文
- [Recht, Re, Wright, Niu — Hogwild!: A Lock-Free Approach to Parallelizing Stochastic Gradient Descent (arXiv:1106.5730, NeurIPS 2011)](https://arxiv.org/abs/1106.5730) ——無鎖非同步 SGD 的原始 Hogwild! 論文，命名的靈感來源
- [Su et al. — RoFormer: Enhanced Transformer with Rotary Position Embedding (arXiv:2104.09864)](https://arxiv.org/abs/2104.09864) ——賦予共享快取推論工程可行性的 RoPE 經典論文
- [Yao et al. — Tree of Thoughts: Deliberate Problem Solving with Large Language Models (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) ——與 Hogwild! 彼此正交的思維樹推理策略
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) ——與 Hogwild! 完美複合增效的序列內推測解碼奠基之作
- [Hogwild! reference PyTorch implementation](https://github.com/eqimp/hogwild_llm) ——論文實驗的參考實作
