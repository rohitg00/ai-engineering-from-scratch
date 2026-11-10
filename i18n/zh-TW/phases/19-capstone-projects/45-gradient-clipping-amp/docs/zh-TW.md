# 梯度裁剪與自動混合精度（Gradient Clipping and Mixed Precision）

> 前一課所建構的最佳化器與學習率排程，皆天然假設模型反向傳播產出的梯度是正常理性的。但在真實世界中，情況往往恰恰相反。單一劣質異常批次（Bad Batch）便足以讓梯度範數暴增三個數量級。而自動混合精度（AMP）訓練更在損失端引入了 FP16 浮點數溢出的風險。本課將親手打造正式環境模型預訓練不可或缺的兩條安全帶：依設定的全域 L2 範數裁剪（Gradient Clipping），以及結合 autocast 與 GradScaler 的混合精度控制迴圈——能即時偵測 NaN 與 Inf、安全跳過當前損壞步進，並記錄動態縮放因子以供事後鑑識與演算法追查。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 19 lessons 30-37
**Time:** ~90 minutes

## Learning Objectives｜學習目標

- 在所有可訓練參數的梯度張量上計算全局 L2 範數，並在數值突破設定閾值時實施原地（In-place）裁剪。
- 將訓練單步封裝進 autocast 與 GradScaler 之中，使 FP16 前向傳播與反向傳播能承受溢位。
- 在損失函數或梯度張量中即時偵測 NaN 與 Inf 異常，安全跳過（Skip）最佳化器更新，並審計記錄該次跳過事件。
- 在每一步即時監控並呈報 GradScaler 的縮放因子（Scaling Factor），使連續跳過異常能夠在第一時間被工程師察覺。

## The Problem｜問題

一場昨天執行得好好的訓練作業，突然在第 8,217 步時損失函數曲線呈現筆直向上的垂直發散。罪魁禍首往往只是一個偶然路過的劣質批次：其梯度 L2 範數高達 4,200，是先前峰值的 20 倍。若缺乏梯度裁剪，最佳化器將根據該暴躁梯度發起一次災難性的大步更新，瞬間重置模型先前的學習成果。而一旦引入了將全局 L2 範數嚴格卡死在 1.0 的裁剪機制，這個異常批次被等比例縮放為單位向量；損失函數平穩維持在既有收斂軌道上，整場訓練得以安全續存。

自動混合精度（AMP）透過在 FP16 半精度下執行前向矩陣乘法與絕大多數反向傳播，能將吞吐量提升 2 至 3 倍。但其代價是 FP16 的指數範圍較窄。典型梯度若在 FP16 中溢位會變成 Inf，並在後續層傳播為 NaN，接著在下一次最佳化器更新時讓所有權重都變成 NaN。PyTorch 的 GradScaler 巧妙化解了該危機：在反向傳播前將損失乘以一個巨大的縮放因子，將微小梯度強行放大至 FP16 安全表示區間；在最佳化器更新前，再將計算出的梯度除以相同的縮放因子還原。若在還原（Unscale）時發現任何梯度包含 Inf 或 NaN，縮放器立即安全跳過該步參數更新，並將縮放因子減半；若連續 N 步完全健康，縮放器自動將縮放因子翻倍。在整個訓練週期中，縮放器能動態自適應找到 FP16 物理極限所允許的最大安全放大倍率。

整個工程建構中最危險的陷阱，在於運算步驟的先後調度順序：若在還原前實施梯度裁剪，裁剪閾值將錯誤地施加在被放大了數萬倍的虛假梯度上；若在還原後裁剪，則必須精確處理 GradScaler 的狀態機。唯一正確無誤的工程調度鏈條為：`scaler.scale(loss).backward()`，接著 `scaler.unscale_(optimizer)`，然後 `clip_grad_norm_`，再執行 `scaler.step(optimizer)` 與 `scaler.update()`。任何其餘順序皆會產出一個在底層靜默破壞數學正確性的殘缺迴圈。

## The Concept｜核心概念

```mermaid
flowchart TD
  Forward[在 autocast 中前向傳播] --> Loss[FP32 損失]
  Loss --> Scale[scaler.scale(loss)]
  Scale --> Backward[反向傳播，FP16 梯度]
  Backward --> Unscale[scaler.unscale_(optimizer)]
  Unscale --> NormCheck[計算全域 L2 範數]
  NormCheck --> Detect{NaN 或 Inf？}
  Detect -- yes --> Skip[略過步驟 + 記錄 + scaler.update 降低倍率]
  Detect -- no --> Clip[將梯度裁剪至 max_norm]
  Clip --> StepOpt[scaler.step(optimizer)]
  StepOpt --> Update[scaler.update 調高或調低倍率]
  Update --> NextStep[下一步]
  Skip --> NextStep
```

### 全域 L2 範數

全局 L2 範數指的是將全模型所有可訓練參數的梯度向量展平拼接後，計算出的單一歐幾里得幾何長度，而非針對各個參數分別計算的局部範數。PyTorch 將其標準封裝在 `torch.nn.utils.clip_grad_norm_(parameters, max_norm)` 中。該函式回傳裁剪前的原始範數數值，使我們的記錄系統能同時記錄裁剪前的自然範數與裁剪後的封頂範數，這對於精確診斷「系統當前是否步步皆在觸發嚴重裁剪」至關重要。

### autocast 與 GradScaler 的協同

`torch.amp.autocast(device_type)` 是一個上下文管理器，會選擇性以 FP16 執行符合條件的運算（多為矩陣乘法類運算）。`torch.amp.GradScaler(device_type)` 則是在反向傳播前放大損失、在更新前逆縮放梯度的核心輔助器。兩者在架構上天然成對設計；單獨使用其中一個而遺漏另一個是嚴重的配置失誤。

本課在教學演示中採用 CPU autocast，因為它可在本機或 CI 的 CPU 環境執行，無需 CUDA；完全相同的邏輯只需將 `device_type="cpu"` 替換為 `device_type="cuda"`，即可百分之百直接移植至 GPU 叢集。CPU 上的 GradScaler 實質上是一個空操作樁（因為 CPU autocast 預設運作在動態範圍極寬的 BF16 上，本質上不需要損失放大），但保留其完整的調用鏈路，能保證與 GPU 程式碼結構完全一致。

### NaN 與 Inf 的雙重主動偵測

數值異常偵測在兩處核心關卡中實施雙保險。第一道關卡在反向傳播之前：直接使用 `torch.isfinite` 檢驗前向傳播輸出的損失純量；一個已經變成 Inf 或 NaN 的損失絕無可能反向傳導出任何有意義的梯度，系統直接短路跳過，絕不將其推入最佳化器。第二道關卡在 `scaler.unscale_(optimizer)` 之後：使用 `has_non_finite_grad(...)` 逐一掃描還原後的梯度張量，一旦發現任何 Inf 或 NaN，立即判定該步為 Skip 跳過。兩道防線雙管齊下，精確覆蓋了前向傳播溢出與反向傳播爆炸兩種不同的失效模式。

### 縮放因子的即時健康診斷

縮放因子是 GradScaler 內部神經狀態的直接體現。在每一步訓練中，我們調用 `scaler.get_scale()` 並將其與即時學習率、梯度範數並列記錄。在健康的訓練作業中，縮放因子會以 2 的冪次方平穩爬升，最終在 `2^17` 或 `2^18` 附近飽和震盪。若在一場運作不良的異常任務中，縮放因子在極高數值與極低數值之間劇烈上下波動，這是一個強烈的生理告警信號：表明模型的梯度數值正在 FP16 的動態範圍邊界上頻繁瀕臨崩潰！缺乏該指標記錄，此類隱患在常規監控中將徹底隱形。

```figure
grad-clip-monitor
```

## Build It｜動手實作

`code/main.py` 實作了以下核心模組：

- `clip_global_l2_norm`：封裝 `torch.nn.utils.clip_grad_norm_`，同時精確回傳裁剪前與裁剪後的真實梯度範數。
- `has_non_finite_grad`：深度掃描全模型梯度張量是否潛藏 NaN 或 Inf 的高效檢查輔助器。
- `AmpTrainState`：將目標模型、`AdamW` 最佳化器、GradScaler 與 autocast 運算裝置封裝為統一的單步執行物件。暴露 `step(inputs, targets)` 方法，完整串聯前向混合精度、損失放大、反向傳播、梯度還原、異常跳過、全局裁剪與動態更新全流程。
- `StepLog` 與 `SkipLog`：結構化的單步執行明細與異常跳過審計記錄類別。
- 底部演示程式：建構微型 `nn.Linear` 模型訓練 20 步，在第 5 步故意人為向梯度張量注入一個致命的 Inf，展示系統如何精準觸發 Skip 跳過路徑，並在終端機印出完整的記錄串流。

執行測試：

```bash
python3 code/main.py
```

腳本以結束碼 0 安全退出，在終端機印出每一步的詳細記錄（明確標註 `STEP` 正常執行或 `SKIP` 異常跳過），且至少包含一行被精確捕獲的 `SKIP` 記錄。

## 工業級正式環境落地模式

四大實戰工程架構模式，能確保你的大模型訓練迴圈在正式環境中具備無懈可擊的健壯性：

**以跳過計數器發出告警，而不只是寫入記錄**：每次訓練作業中少數步驟被略過是健康現象。每個 Epoch 若出現數百次跳過，就應發出強烈告警：這表示 FP16 無法承受目前的數值範圍，訓練迴圈正悄悄失效。本課追蹤 1,000 步的移動跳過率；正式環境可在比率高於 5% 時通知值班人員。

**裁剪閾值必須收斂於設定檔**：`max_norm = 1.0` 是現代語言模型訓練的標準預設。建議永遠先在小模型上實施小規模掃描；較大的閾值能讓模型從真正困難的批次中復原；較小的閾值會限制最壞情況，但代價是損失曲線較雜訊。該參數必須與第四十四課的學習率排程一同存放在被 Git 版本控制的 YAML 或 JSON 設定檔中。

**梯度範數與學習率同表記錄至 CSV**：輸出的 CSV 欄位順序固定為：`step, lr, grad_l2_pre_clip, grad_l2_post_clip, loss, skipped, skip_reason, scaler_scale`。審查人員打開這份檔案，能在一行之中同時看見學習率節奏、梯度生理特徵、縮放因子位準以及跳過裁決（附帶具體跳過原因）。將這些欄位拆散存放在不同檔案中是引發時序錯位的典型架構失誤。

**`scaler.update()` 在每一步皆必須無條件執行，即便當前步被 Skip 跳過**：在正常執行步中，縮放器遞增內部計數器並在適當時機將因子翻倍；而在跳過步中，縮放器正是依賴調用 update() 才能將縮放因子減半並重設計數器！若在 Skip branch 中粗心忘記調用 `update()`，將會引發極端嚴重的「縮放因子永遠鎖死不變」的隱性 Bug。

## Use It｜實際應用

正式環境實務模式：

- **Autocast 運算裝置必須與最佳化器裝置嚴格一致**：GPU 叢集訓練強制綁定 `torch.amp.autocast(device_type="cuda")`；CPU 本機測試強制綁定 `torch.amp.autocast(device_type="cpu")`。若裝置型別發生錯配，PyTorch 會引發不易察覺的型別轉換異常，導致損失曲線看似平穩下降但模型實質上根本學不到任何知識。
- **反向傳播前強制執行損失數值檢查**：調用 `torch.isfinite(loss).all()` 僅僅是一次極速的純量歸約；其運算開銷微乎其微，但卻能在損失崩潰為 NaN 時為你節省整整一次昂貴且毫無意義的反向傳播開銷。永遠不要省去這行檢查。
- **在 `zero_grad` 中啟用 `set_to_none=True`**：將梯度張量重設為 `None` 而非覆寫為全 0，允許最佳化器跳過未受影響參數群組的計算。這是一項完全免費的訓練吞吐量提升技巧，並略微縮小可能出現程式錯誤的範圍。

## Ship It｜交付成果

在真實商業專案中，交付的 `outputs/skill-clip-amp.md` 將詳細規範：目標任務所採用的具體裁剪閾值與 autocast 運算裝置型別、逐步 CSV 記錄在版本控制中的儲存規範，以及正式環境設定的滑動跳過率警報閾值。本課直接交付了該核心訓練引擎的完整原始碼。

## Exercises｜練習

1. 將程式碼中人為注入合成 Inf 的邏輯替換為真實的損失激增（例如將某個批次的目標值惡意乘以 1e8）。驗證系統能否透過正常計算路徑精準觸發 Skip 跳過邏輯。
2. 為訓練器追加 `--bf16` 模式開關，將底層 autocast 切換為 BF16 精度。BF16 的指數範圍比 FP16 寬，且很少需要損失縮放；在相同的演示任務上確認跳過率是否降至 0。
3. 為梯度裁剪封裝函式編寫單元測試，確認未觸發裁剪時，函式回傳的裁剪前與裁剪後範數正確。
4. 實作基於滑動視窗的跳過率即時計算邏輯，並追加一個 CLI 命令列旗標：當跳過率連續 100 步都超過設定閾值時，訓練任務即拋出異常退出。
5. 將控制迴圈與標準 CSV 匯出管線完整串聯（包含 `step, lr, grad_l2_pre_clip, grad_l2_post_clip, loss, skipped, skip_reason, scaler_scale` 全部 8 個欄位），並在每行寫入後手動調用 flush()，確保即使遭遇 Ctrl-C 強制中斷檔案亦不會損壞。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|------------------------|
| Global L2 norm | 「裁剪目標」 | 將所有可訓練參數的梯度向量串接後計算出的歐幾里得範數。 |
| autocast | 「混合精度」 | 在 `with` 區塊中，選擇性以 FP16（或 BF16）執行符合條件的運算。 |
| GradScaler | 「損失縮放器」 | 在反向傳播前將損失乘上倍率，並在最佳化器更新前將梯度除以相同倍率的輔助元件。 |
| Skip | 「略過步驟」 | 梯度或損失不是有限值時，拒絕執行最佳化器更新；縮放器會將倍率減半。 |
| Scaling factor | 「縮放器狀態」 | GradScaler 目前使用的乘數；連續正常時會加倍，每次略過時減半。 |
## Further Reading｜延伸閱讀

- [Micikevicius et al., Mixed Precision Training (arXiv 1710.03740)](https://arxiv.org/abs/1710.03740) — 自動混合精度與損失縮放奠基性學術論文。
- [Pascanu, Mikolov, Bengio, On the difficulty of training recurrent neural networks (arXiv 1211.5063)](https://arxiv.org/abs/1211.5063) — 梯度裁剪技術原創參考論文。
- [PyTorch torch.amp.GradScaler](https://docs.pytorch.org/docs/stable/amp.html) — PyTorch 官方 GradScaler API 技術文件。
- [PyTorch torch.nn.utils.clip_grad_norm_](https://docs.pytorch.org/docs/stable/generated/torch.nn.utils.clip_grad_norm_.html) — PyTorch 原生梯度裁剪算子說明。
- 第 19 階段第 42 課：深入了解為該訓練管線輸送海量原始語料的下載器。
- 第 19 階段第 43 課：深入了解為該控制迴圈輸送 Batch 張量的高效能 HDF5 資料管線。
- 第 19 階段第 44 課：回顧與該控制迴圈緊密配合的線性預熱餘弦退火排程器。
