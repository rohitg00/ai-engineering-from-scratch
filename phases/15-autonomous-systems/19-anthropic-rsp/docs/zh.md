# Anthropic 負責任擴展政策 v3.0

> RSP v3.0 於 2026 年 2 月 24 日生效，取代 2023 年的政策。兩層式緩解：Anthropic 會單方面去做的事，對上被定位成全業界建議的事（包含 RAND SL-4 安全標準）。它把 Frontier Safety Roadmaps 與 Risk Reports 升格為常設文件，而不是一次性的交付物。它拿掉了 2023 年的暫停承諾。它引入 AI R&D-4 門檻：一旦跨過，Anthropic 就必須發表一份指認失準風險與緩解措施的正面論證。Claude Opus 4.6 並未跨過它。Anthropic 在 v3.0 的公告中表示「要有把握地排除這件事，正變得困難」。SaferAI 給 2023 年 RSP 打 2.2 分；他們把 v3.0 降到 1.9，把 Anthropic 放進「弱」這一類 RSP，與 OpenAI 和 DeepMind 並列。質性門檻取代了 2023 年的量化承諾；拿掉暫停條款是最尖銳的一次倒退。

**類型：** 學習
**程式語言：** Python (stdlib, RSP threshold decision engine)
**先修單元：** 階段 15 · 06（AAR）、階段 15 · 07（RSI）
**時間：** 約 45 分鐘

## 問題所在

前沿實驗室發表的擴展政策，一部分是技術文件、一部分是治理文件，還有一部分是給監管者的訊號。RSP v3.0 是 Anthropic 當前的那份文件。細讀它之所以要緊，不是因為遵守它有法律拘束力（沒有），而是因為那套框架形塑了一間實驗室如何構想災難性風險，以及他們如何向大眾溝通取捨。

v3.0 相對 v2.0 的差異，才是有用的單位。加了什麼：Frontier Safety Roadmaps、Risk Reports、AI R&D-4 門檻。拿掉了什麼：2023 年的暫停承諾。重新定位了什麼：一份分成「Anthropic 單方面」與「業界建議」兩層的緩解時程表。外部審視 —— SaferAI —— 把分數從 2.2（v2）降到 1.9（v3.0）。這就是一份擴展政策如何在看起來更精緻的同時變得更不嚴謹。

## 核心概念

### 兩層式緩解時程表

- **Anthropic 單方面的行動**：不管其他實驗室怎麼做，Anthropic 都會做的事。超過門檻就停止訓練、特定的安全措施、特定的部署閘門。
- **全業界的建議**：Anthropic 認為業界應該集體去做的事。包含 RAND SL-4 安全標準。這些不是 Anthropic 這一側的承諾；它們是 Anthropic 的政策倡議。

兩層結構在 v2 裡並不存在。這意味著讀者必須去看每一項承諾住在哪一欄。一項落在「全業界建議」欄的安全措施，不是 Anthropic 的承諾；那是 Anthropic 的希望。

### AI R&D-4 門檻

這是 RSP v3.0 點名為下一個重要門檻的能力等級。具體來說：一個能以具競爭力的成本自動化相當大一部分 AI 研究的模型。一旦 Anthropic 認為某個模型跨過它，他們就必須在繼續擴展之前，發表一份指認失準風險與緩解措施的正面論證。

依 v3.0 的公告，Claude Opus 4.6 並未跨過它。該文件補上一句：「要有把握地排除這件事，正變得困難。」那個措辭很要緊；它承認這道門檻已經近到成為一項現實顧慮，而不是一個空想的極限。

第 6 課（自動化對齊研究）與第 7 課（遞迴式自我改善）直接餵養這道門檻。自主對齊研究員跨過研究品質的門檻，就是 AI R&D-4 門檻正在逼近的證據。

### Frontier Safety Roadmaps 與 Risk Reports

v3.0 把兩種產物升格為常設文件：

- **Frontier Safety Roadmap**：前瞻性文件，描述規劃中的安全工作、能力預期，以及緩解研究。
- **Risk Report**：回顧性文件，針對特定模型在發布之後，描述觀察到的能力與殘餘風險。

兩者都是公開的。兩者都依宣告好的節奏更新。用處在於：讀者可以追蹤 Anthropic 在 Roadmap 裡說要做的事，跟他們在 Risk Report 裡回報的事，兩相比對。

### 拿掉暫停條款

2023 年的 RSP 含有一項明確的暫停承諾：若某個模型跨過特定能力門檻，訓練就暫停，直到緩解措施就位。v3.0 把明確的暫停換成一種較軟的表述（發表一份正面論證，若緩解足夠就繼續）。SaferAI 與其他分析者都直接把這點點名為新文件中最強的一次倒退。

支持這項改變的政策論點是：2023 年的量化門檻，到了 2026 年因為基準本身被重新校尺，反而變得達不到。反面論點是：擴展政策裡的暫停條款是一種承諾裝置；拿掉它就等於拿掉這份政策的可信度。

### SaferAI 的降評

SaferAI 是一個替 RSP 式文件評分的獨立組織。他們的公開評分：2023 年 Anthropic RSP 得 2.2（在一個 4.0 為當前最佳 RSP、1.0 為名目性的量表上）。v3.0 得 1.9。這把 Anthropic 從「中等」移到「弱」，與 OpenAI 和 DeepMind 一起落進弱這一類。

依 SaferAI，降評的因素是：
- 質性門檻取代了量化門檻。
- 暫停承諾被移除。
- AI R&D-4 門檻的緩解被描述成「正面論證」，而不是具體措施。
- 審視機制依賴 Anthropic 自家的安全顧問小組，獨立監督有限。

### 這一課不是什麼

這不是一堂法遵課。RSP v3.0 不是法規；沒有任何東西強迫 Anthropic 遵守它。這一課的重點在於，用這份文件應得的具體性與懷疑態度去讀它。擴展政策是前沿實驗室對外發出、關於災難性風險姿態的主要公開訊號。把它們讀好，對任何工作依賴前沿能力的人來說，都是一項實務技能。

```figure
a5-rsp-ladder
```

## 框架應用

`code/main.py` 實作一個小小的決策引擎，對映 RSP 門檻評估的形狀：給定一個候選模型與一組能力量測，回傳是否跨過 AI R&D-4 門檻、所需的正面論證章節，以及是否可以繼續部署。它刻意做得簡單；重點是把那份文件的邏輯攤開來。

## 產出交付

`outputs/skill-scaling-policy-review.md` 拿 v3.0 當參照，審視一份擴展政策（Anthropic、OpenAI、DeepMind，或內部版本）：兩層結構、門檻、暫停承諾、獨立審視。

## 練習

1. 跑 `code/main.py`。餵進三個不同能力等級的合成模型。確認門檻評估器的行為符合預期，並產出正確的正面論證樣板。

2. 完整讀完 RSP v3.0（32 頁）。指認出每一項住在「全業界建議」層的承諾。其中哪些在 v2 裡本來會是「Anthropic 單方面」？

3. 讀 SaferAI 的 RSP 評分方法論。把他們的評分準則套用到這份文件上，重現他們給 v3.0 的 1.9 分。哪一列評分準則最主導那次降評？

4. 2023 年的暫停承諾被移除了。提出一項替代承諾，既保住這份政策的可信度，又承認 2026 年基準重新校尺的問題。

5. 把 RSP v3.0 跟 OpenAI Preparedness Framework v2（第 20 課）比較。挑一個 v3.0 比較強的面向。再挑一個 Preparedness Framework 比較強的面向。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|---|---|---|
| RSP | 「Anthropic 的擴展政策」 | 負責任擴展政策；v3.0 於 2026 年 2 月 24 日生效 |
| AI R&D-4 | 「研究自動化門檻」 | 以具競爭力的成本自動化相當大一部分 AI 研究的能力 |
| 正面論證 | 「安全性的辯護」 | 公開發表的論證，說明風險已被指認、緩解措施足夠 |
| Frontier Safety Roadmap | 「前瞻計畫」 | 關於規劃中安全工作與預期能力的常設文件 |
| Risk Report | 「針對某個模型的回顧」 | 關於發布後觀察到的能力與殘餘風險的常設文件 |
| 兩層式緩解 | 「單方面 vs 業界」 | 把 Anthropic 的承諾與對業界的建議分開 |
| 暫停承諾 | 「2023 年的條款」 | 暫停訓練的明確承諾；在 v3.0 中被移除 |
| SaferAI 評分 | 「獨立的 RSP 評級」 | 第三方評分準則；v3.0 得 1.9（v2 是 2.2） |

## 延伸閱讀

- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) —— 完整的 32 頁政策。
- [Anthropic — RSP v3.0 announcement](https://www.anthropic.com/news/responsible-scaling-policy-v3) —— 相對 v2 的改動摘要。
- [Anthropic — Frontier Safety Roadmap](https://www.anthropic.com/responsible-scaling-policy/roadmap) —— RSP v3.0 連出去的那份常設文件。
- [Anthropic — Risk Report: February 2026](https://www.anthropic.com/feb-2026-risk-report) —— 針對 Claude Opus 4.6 的回顧，它是這份報告發表時的前沿模型。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) —— 把 AI R&D-4 連到被量測的自主性。
