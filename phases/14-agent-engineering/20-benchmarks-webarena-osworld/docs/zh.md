# 基準：WebArena 與 OSWorld

> WebArena 在四個自架應用上測網頁代理的能力。OSWorld 在 Ubuntu、Windows、macOS 上測桌面代理的能力。發布當時（2023–2024），兩者都顯示同級最佳代理與人類之間有很大的落差。落差正在縮小；失敗模式沒有變。

**類型：** 學習
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 19（SWE-bench、GAIA）
**時間：** 約 60 分鐘

## 學習目標

- 描述 WebArena 的四個自架應用，以及基於執行的評測為何重要。
- 解釋 OSWorld 為何用真實作業系統的截圖，而不是無障礙 API。
- 說出 OSWorld 的兩個主要失敗模式：GUI 接地與操作知識。
- 摘要 OSWorld-G 與 OSWorld-Human 在基礎基準之上加了什麼。

## 問題所在

通才代理會呼叫工具。那它們能不能操作瀏覽器、跨 20 次點擊完成一次購物結帳？能不能只用鍵盤與滑鼠設定好一台 Linux 機器？這些就是 WebArena 與 OSWorld 要回答的問題。

## 核心概念

### WebArena（Zhou 等人，ICLR 2024）

- 812 項長時程任務，橫跨四個自架網頁應用：一個購物網站、一個論壇、一個類 GitLab 的開發工具、一個商務 CMS。
- 外加一些工具：地圖、計算機、暫存簿。
- 評測是透過 gym API、基於執行的 —— 訂單下成了嗎？issue 關掉了嗎？CMS 頁面更新了嗎？
- 發布當時：最好的 GPT-4 代理打到 14.41% 成功率，人類是 78.24%。

自架這個框架很要緊 —— 這個基準不會時好時壞，因為目標應用是被釘版本、可重現的。

### 延伸

- **VisualWebArena** —— 視覺接地的任務，成功與否取決於能不能解讀影像（截圖是一等的觀察）。
- **TheAgentCompany**（2024 年 12 月）—— 加上終端機 + 寫程式；更像真實的遠距工作環境。

### OSWorld（Xie 等人，NeurIPS 2024）

- 369 項真實的電腦任務，橫跨 Ubuntu、Windows、macOS。
- 對真實應用程式做自由形式的鍵盤與滑鼠操控。
- 觀察是 1920×1080 的截圖。
- 發布當時：最好的模型 12.24%，人類 72.36%。

### 主要失敗模式

1. **GUI 接地。** 像素 → 元件的對映。模型很難在 1920×1080 裡可靠地定位 UI 元件。
2. **操作知識。** 那個設定在哪個選單、哪個鍵盤快捷鍵、哪個偏好設定面板。這是人類累積多年才長出來的知識長尾。

### 後續作品

- **OSWorld-G** —— 564 個樣本的接地套組 + Jedi 訓練集。把接地從規劃中拆出來，讓你可以分開量測。
- **OSWorld-Human** —— 人工策展的黃金行動軌跡。顯示頂尖代理用掉的步數是必要步數的 1.4-2.7 倍（那個軌跡效率落差）。

### 為什麼這件事要緊

Claude computer use、OpenAI CUA、Gemini 2.5 Computer Use（第 21 課）全都在由 WebArena 與 OSWorld 所塑形的工作負載上訓練。基準是那個標靶；生產模型是出貨的答案。

### 做基準測試在哪裡會出錯

- **只看截圖的評測。** OSWorld 是截圖驅動的；拿一個使用 DOM 或無障礙 API 的代理去跑 OSWorld，會錯過接地這項挑戰。
- **無視軌跡長度。** 只計成功率，會漏掉 OSWorld-Human 揭露的那 1.4-2.7 倍步數低效。
- **過期的自架應用。** WebArena 的應用釘死了特定版本；沒有重新策展就升級，會破壞可比性。

```figure
ae-agent-human-gap
```

## 動手實作

`code/main.py` 實作一個玩具版的網頁代理執行框架：

- 一台最小的「購物應用」狀態機：list_items、add_to_cart、checkout。
- 3 項任務的黃金軌跡。
- 一個腳本化的代理，逐項嘗試。
- 基於執行的評估器（狀態檢查）與軌跡效率指標（步數相對於黃金軌跡）。

跑它：

```
python3 code/main.py
```

輸出：逐任務的成功率與軌跡效率，對映 OSWorld-Human 的方法論。

## 框架應用

- **WebArena Verified** 自架在內部叢集上做持續評測。
- **OSWorld** 跑在一群 VM 上，給桌面代理用。
- **Computer-use 代理**（第 21 課）—— Claude、OpenAI CUA、Gemini —— 全都在這類工作負載上訓練。
- **你自己的產品流程** —— 替你最重要的 20 項任務捕捉黃金軌跡；每週拿代理去跑它們。

## 產出交付

`outputs/skill-web-desktop-harness.md` 會蓋出一個網頁／桌面代理的執行框架，帶基於執行的評測與軌跡效率指標。

## 練習

1. 替這個玩具執行框架擴充第二個應用（一個論壇）。寫 3 項任務加黃金軌跡。
2. 加上逐任務的軌跡效率回報。在你的玩具裡，代理是黃金軌跡的 1 倍、2 倍還是 3 倍？
3. 實作一項「誘餌」工具 —— 黃金軌跡從不使用的那種。腳本化的代理會被誘惑嗎？
4. 讀 OSWorld-G。在你自己的評測裡，你會怎麼把接地失敗與規劃失敗分開？
5. 讀 WebArena 那些應用的 README。當你升級其中一個被釘死的應用版本時，什麼會壞掉？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| WebArena | 「網頁代理基準」 | 4 個自架應用上的 812 項任務；gym 式評測 |
| VisualWebArena | 「視覺版 WebArena」 | 視覺接地的 WebArena；觀察就是截圖 |
| OSWorld | 「桌面代理基準」 | 真實 Ubuntu／Windows／macOS 上的 369 項任務 |
| GUI 接地 | 「像素到元件的對映」 | 模型在 1920x1080 裡定位 UI 元件 |
| 操作知識 | 「作業系統的門道」 | 哪個選單、哪個快捷鍵、哪個偏好設定面板 |
| OSWorld-G | 「接地套組」 | 564 個純接地樣本 + 訓練集 |
| OSWorld-Human | 「黃金軌跡」 | 人工的專家行動序列，用來量效率 |
| 軌跡效率 | 「相對黃金軌跡的步數」 | 代理步數除以人類最少步數 |

## 延伸閱讀

- [Zhou et al., WebArena (arXiv:2307.13854)](https://arxiv.org/abs/2307.13854) —— 四應用的網頁基準
- [Xie et al., OSWorld (arXiv:2404.07972)](https://arxiv.org/abs/2404.07972) —— 跨作業系統的桌面基準
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) —— Claude 那項由基準塑形的能力
- [OpenAI, Computer-Using Agent](https://openai.com/index/computer-using-agent/) —— OSWorld 與 WebArena 的數字
