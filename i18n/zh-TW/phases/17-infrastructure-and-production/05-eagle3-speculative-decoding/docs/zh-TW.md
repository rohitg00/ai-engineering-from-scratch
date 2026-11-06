# 正式環境中的 EAGLE-3 推測解碼（EAGLE-3 Speculative Decoding in Production）

> 推測解碼（Speculative decoding）將輕量極速的草稿模型（Draft model）與大型目標模型（Target model）搭檔協同。草稿模型負責提前提出 K 個候選 Token；目標模型在單次前向傳播（Forward pass）中並行驗證全部 K 個候選；凡是通過驗證的 Token 實質上幾乎免費。在 2026 年，EAGLE-3 是該技術中適用於正式環境的變體——它直接在目標模型的內部隱藏狀態（Hidden states）而非原生 Token 上訓練極輕量的草稿頭部（Draft head），將常規對話場景下的接受率 alpha 推升至 0.6-0.8 區間。真正的關鍵決策問題絕非「草稿模型能跑多快」，而是「在你自身的真實業務流量下，alpha 究竟有多高？」若 alpha 跌落至約 0.55 以下，推測解碼在高並行壓力下將產生嚴重的負收益，因為每一次草稿被拒絕皆會被迫引發額外的目標模型二次前向傳播。本課教你堅持「先嚴密實測 alpha，再審慎開啟開關」的工程鐵律。

**Type:** Learn
**Languages:** Python (stdlib, toy acceptance-rate simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 18 (Multi-Token Prediction)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 指出推測解碼的三代演進，並深刻解釋 EAGLE-3 相較於 EAGLE-2 以及傳統獨立草稿模型在架構層面做出了哪些改變。
- 定義接受率（Acceptance rate）alpha，依據 alpha 與草稿步長 K 精確推導期望加速比，並針對你的目標並行度計算出損益平衡的關鍵臨界面。
- 解釋為何推測解碼在 2026 年的 vLLM 中依然屬於主動宣告（Opt-in）而非預設開啟，以及為何未經測量 alpha 盲目啟用是嚴重的正式環境反模式。
- 撰寫標準實測規劃書：界定評測基準、Prompt 分佈、並行度階梯，以及作為發布閘門的關鍵指標。

## The Problem｜問題

自回歸解碼是典型的記憶體頻寬受限（Memory-bound）操作。在單張 H100 上運作 Llama 3.3 70B FP8 模型時，每吐出一個 Token，GPU 就必須以約 140 GB/s 的頻寬讀取模型權重，卻僅僅計算產出單一 Token。在解碼過程中，GPU 的矩陣乘法運算單元絕大多數時間都在閒置空等——底層瓶頸是高頻寬記憶體（HBM）的物理頻寬，而非算力上限。

推測解碼巧妙利用了這項物理頻寬空隙。首先利用極為廉價的草稿模型快速生成 K 個候選 Token，隨後交由目標模型在單次前向傳播中一口氣驗證全部 K 個 Token。每一個驗證通過的 Token 實質上都是免費獲得的（因為目標模型本就必須執行一次前向傳播，驗證 K 個 Token 的頻寬開銷被完全均攤）。

傳統經典的獨立草稿模型方法，通常選用同家族的超輕量模型（例如以 Llama 3.2 1B 作為 Llama 3.3 70B 的草稿模型）。該方案雖然可行，但接受率往往差強人意——因為小模型的機率分佈與龐大的目標模型存在顯著偏差。隨後誕生的 EAGLE、EAGLE-2 與 EAGLE-3，選擇直接在目標模型自身的內部狀態上訓練一層輕量草稿頭部，使得草稿分佈能極為精準地咬合目標模型。這正是為何接受率 alpha 能從獨立小模型的 0.4 巨幅躍升至 EAGLE-3 的 0.6-0.8。

然而關鍵陷阱在於：EAGLE-3 在 2026 年的 vLLM 中依然是主動宣告（Opt-in）的。你必須在配置中明確宣告 `speculative_config`；若未明確配置，系統不會進行任何加速。許多工程團隊在未對真實流量嚴密實測 alpha 的情況下盲目開啟該開關，結果往往發現系統的長尾延遲非但沒有改善，反而變差。

## The Concept｜核心概念

### 推測解碼究竟為你購買了什麼（What speculative decoding actually buys）

在未開啟推測解碼時，每產出一個 Token 必須耗費一次目標模型的完整前向傳播。而在草稿步長為 K、接受率為 alpha 的推測解碼體系下，目標模型每一次前向傳播預期能斬獲的 Token 總數為 `1 + K * alpha`。其理論加速比為 `(1 + K * alpha) / (1 + epsilon)`，其中 epsilon 代表草稿生成加上驗證的額外開銷。當 K=5、alpha=0.7 時：`(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x`。在真實正式環境中，加速比通常收斂在 2 至 3 倍之間，因為真實業務流量下的 alpha 很少能維持理想高點，且高並行批次下 epsilon 會顯著放大。

### 為何接受率 alpha 是唯一關鍵的決定性指標（Why alpha is the only metric that matters）

被目標模型拒絕的 Token 並不會憑空消失——它們會強迫目標模型針對第一個遭拒絕的 Token 執行第二次前向傳播以重新生成。在 alpha 跌落至 0.4 的嚴苛負載下，你同時承擔了草稿開銷、驗證開銷以及重骰重算的巨大懲罰。在高並行壓力下（例如 256 個並行請求），解碼批次本就已經龐大到足以充分均攤記憶體頻寬，「單純目標模型」與「具備驗證的目標模型」之間的頻寬空隙被急劇壓縮。在 2026 年的絕大多數主流硬體上，一旦 alpha < 0.55，推測解碼的淨收益便會轉為負數。

alpha 會隨著業務領域的分佈產生劇烈波動。在 ShareGPT 風格的通用聊天場景下，基於通用語料訓練的 EAGLE-3 能穩定維持在 0.6-0.8；但在程式碼編寫、醫療診斷、法律審查等強專業領域流量中，以通用資料訓練的草稿頭，其 alpha 會降至 0.4-0.6。針對垂直領域專門訓練專屬的領域草稿頭部能迅速挽救 alpha——相較於重新 fine-tuning 龐大的目標模型，訓練一個草稿頭部極其輕量迅速。

### EAGLE 各代技術演進一覽（EAGLE generations at a glance）

- **經典獨立草稿模型（Classic draft model）**：同架構家族的超小模型。Alpha 0.3-0.5。維運架構相對簡單——同時載入兩個獨立模型，草稿模型在目標模型每次步進前連跑 K 次前向傳播。
- **EAGLE-1（2024）**：在目標模型最後一層隱藏狀態上訓練的單一輕量草稿頭部。Alpha ~0.5-0.6。在目標模型之上僅增加極微小的參數負擔。
- **EAGLE-2（2025）**：引入動態自適應草稿步長與樹狀草稿（Tree-based drafts，在單次目標模型步進中並行驗證多條分岔路徑）。Alpha ~0.6-0.7。草稿排程器複雜度顯著增加。
- **EAGLE-3（2025-2026）**：草稿頭部直接以目標模型的多個層（而非僅最後一層）訓練，語意對齊更好。在通用對話任務上 Alpha ~0.6-0.8。

### 2026 年正式環境落地 SOP（The 2026 production recipe）

1. 首先以未啟用推測解碼的目標模型上線。在目標並行度下，精確記錄基準 TTFT（第一個 token 延遲）、ITL 吐字間隔與整體吞吐量。
2. 透過 vLLM 的 `speculative_config` 配置啟用 EAGLE-3 草稿能力。重新執行相同的基準測試。
3. 嚴密監控並記錄接受率 alpha。vLLM V1 排程器將此暴露為 `spec_decode_metrics.accepted_tokens_per_request` 指標。將其除以配置的草稿長度 K 即可得出即時 alpha。
4. 若在真實正式環境流量分佈下 alpha < 0.55，果斷停用推測解碼，或安排資源訓練領域專屬的 EAGLE-3 草稿頭部。
5. 在正式環境全額並行度下重新壓測。嚴格確認 P99 ITL 延遲絕無反向惡化。

### 正式環境經典陷阱：長尾 P99 延遲惡化（The production pitfall: P99 tail）

啟用推測解碼後，平均 ITL 通常會顯著下降。然而若未經調整，P99 長尾延遲可能變差。一旦草稿被拒絕，系統將觸發兩階段串行懲罰（草稿生成 + 驗證失敗 + 重算 Token）。在滿載批次下，這兩次前向傳播會被迫串列排隊。評估效能時，必須死盯 P99 ITL，絕不可被光鮮的 P50 中位數所誤導。

### EAGLE-3 的現有落地前線（Where EAGLE-3 is already deployed）

Google 早在 2025 年便於 AI Overviews 搜尋摘要中部署推測解碼（品質相同，回應更快）。vLLM V1 將 `speculative_config` 作為標準正式介面提供，且其相容性矩陣明確標註推測解碼與分塊 Prefill 相容。SGLang 亦將 EAGLE-3 列為前綴密集型負載的建議草稿路徑。

### 一行公式掌握損益平衡點（Break-even math in one line）

理論期望加速比公式：`S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`。令 `S = 1` 即可推導出理論損益平衡點：`alpha_breakeven = verify_overhead / K`。若常規驗證開銷約為 0.15 且 K=5，理論平衡點僅為 `alpha_breakeven = 0.03`。然而這僅僅是單序列純解碼的理想數學。在正式環境的高並行壓力下，驗證開銷急劇膨脹，且解碼批次本就已經均攤了跨序列的記憶體讀取，導致真實世界的實質平衡門檻在實務中大幅攀升至 ~0.45-0.55 區間。

### 何時絕不該使用推測解碼（When not to use speculative decoding）

- 批次大小為 1 的完全離線非即時生成任務，其延遲毫無實質意義。直接使用裸目標模型即可。
- 極短輸出文本任務（例如輸出少於 50 個 Token）。草稿開銷與驗證成本將完全主導並拖垮推論。
- 高度垂直的特殊領域、且尚未訓練出專屬草稿頭部。此時 alpha 過低，開啟只會產生純負收益。
- 切忌盲目假設所有進階功能皆可隨意疊加。務必核對你的 vLLM 版本相容性矩陣：v0.18.0 標示推測解碼與分塊 Prefill 相容。

```figure
mx-speculative-tree
```

## Use It｜實際應用

`code/main.py` 模擬了一套在不同 alpha 接受率與草稿步長 K 組合下、開啟與未開啟推測解碼的解碼迴圈。程式將自動計算理論損益平衡 alpha、實測加速比以及長尾延遲行為。執行該腳本並遍歷多組 (alpha, K) 組合，精確掌握推測解碼在何種臨界條件下將徹底失效。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-eagle3-rollout.md`。輸入目標模型規格、業務流量特徵分佈與目標並行度，該 Skill 將自動產出標準的分階段 EAGLE-3 部署計畫書——建立基準壓測、啟用設定、實時度量 alpha、設定 alpha >= 0.55 上線門檻，並觀察 P99 ITL 指標。

## Exercises｜練習

1. 執行 `code/main.py`。在 K=5 的條件下，若要達到 2x 加速比，所需的 alpha 是多少？若要達到 3x 加速比呢？該數值對 verify_overhead 驗證開銷的敏感度如何？
2. 假設正式環境流量由 70% 通用對話與 30% 程式碼生成構成。在 ShareGPT 上訓練的 EAGLE-3 在對話任務上達到 alpha 0.7，但在程式碼任務上僅有 alpha 0.4。計算加權混合後的綜合 alpha，並判定此時啟用推測解碼是否具備正向收益。
3. 研讀 vLLM 官方 `speculative_config` 技術文件。列出其支援的三大模式（獨立草稿模型、EAGLE、N-gram），並對照你的 vLLM 版本確認各模式與其他推論功能的相容性邊界。
4. 你觀察到啟用 EAGLE-3 後，平均 ITL 下降了 25%，但 P99 ITL 卻反而惡化了 15%。給出清晰的故障診斷並提出具體的架構緩解手段。
5. 精確計算針對 Llama 3.3 70B 模型部署 EAGLE-3 草稿頭部所引入的額外記憶體開銷。將其與直接載入 Llama 3.2 1B 作為傳統獨立草稿模型進行記憶體用量橫向對比。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| Speculative decoding | 「草稿加驗證」 | 用低成本模型提出 K 個 token，再由目標模型以一次前向傳遞驗證全部 K 個 token |
| Acceptance rate alpha | 「推測解碼接受率」 | 草稿 token 被目標模型接受的比例；最重要的指標 |
| Draft length K | 「推測解碼的 K 值」 | 每次目標模型前向傳遞前，草稿模型提出的 token 數；通常為 4 至 8 個 |
| Verify overhead epsilon | 「推測解碼額外開銷」 | 相較於單純執行目標模型前向傳遞，驗證並重算所增加的成本；會隨批次增大 |
| EAGLE-3 | 「最新版 EAGLE」 | 2025 至 2026 年的變體；在目標模型的多個層上訓練草稿頭；一般對話的 alpha 為 0.6 至 0.8 |
| `speculative_config` | 「vLLM 推測解碼設定」 | vLLM V1 中明確啟用推測解碼的設定；預設未啟用，因此不會加速 |
| N-gram spec decode | 「N-gram 草稿」 | 在 GPU 端使用 prompt 中的 N-gram 查找來產生草稿；相容分塊 Prefill |
| Break-even alpha | 「損益兩平 alpha」 | 推測解碼不會帶來加速的 alpha；正式環境中應留意此值 |
| Rejected-draft two-pass | 「草稿遭拒後重算」 | 草稿遭拒時需執行兩次目標模型前向傳遞；會拉高 P99 長尾延遲 |

## Further Reading｜延伸閱讀

- [vLLM — Speculative Decoding docs](https://docs.vllm.ai/en/latest/features/spec_decode/) — 官方關於 `speculative_config` 與 V1 排程器中分塊 Prefill 相容性的權威指南。
- [vLLM Speculative Config API](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/) — 官方完整的配置欄位規格說明。
- [EAGLE paper (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) — EAGLE 特徵級草稿頭部的原創奠基論文。
- [EAGLE-2 paper (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) — 自適應動態步長與樹狀推測原著。
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html) — 基於推測解碼的高效 LLM 推論系統架構研究。
- [BentoML — Speculative Decoding](https://bentoml.com/llm/inference-optimization/speculative-decoding) — 工業級正式環境落地與驗收清單。
