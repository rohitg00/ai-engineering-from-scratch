# 代理可觀測性：Langfuse、Phoenix、Opik

> 2026 年由三個開源的代理可觀測性平台主導。Langfuse（MIT）—— 每月 600 萬次以上安裝，追蹤 + 提示詞管理 + 評測 + 工作階段重播。Arize Phoenix（Elastic 2.0）—— 深入的代理專屬評測、RAG 相關性、OpenInference 自動儀器化。Comet Opik（Apache 2.0）—— 自動化提示詞最佳化、護欄、LLM 裁判式幻覺偵測。

**類型：** 學習
**程式語言：** Python (stdlib)
**先修單元：** 階段 14 · 23（OTel GenAI）
**時間：** 約 45 分鐘

## 學習目標

- 說出三大開源代理可觀測性平台與它們的授權。
- 分辨各自最強的地方：Langfuse（提示詞管理 + 工作階段）、Phoenix（RAG + 自動儀器化）、Opik（最佳化 + 護欄）。
- 解釋為何到 2026 年有 89% 的組織回報已經備妥代理可觀測性。
- 用 stdlib 實作一條從追蹤到儀表板的管線，帶 LLM 裁判評測。

## 問題所在

OTel GenAI（第 23 課）給了你 schema。你仍然需要一個平台去吃下 span、跑評測、存放提示詞版本，並把回歸浮出來。這三個競爭者各自強調生命週期中不同的部分。

## 核心概念

### Langfuse（MIT）

- 每月 600 萬次以上 SDK 安裝，19k+ GitHub 星數。
- 功能：追蹤、帶版本控制與 playground 的提示詞管理、評測（LLM-as-judge、使用者回饋、自訂）、工作階段重播。
- 2025 年 6 月：原本的商業模組（LLM-as-a-judge、標註佇列、提示詞實驗、Playground）以 MIT 授權開源。
- 最強項：端到端可觀測性，配上緊密的提示詞管理迴圈。

### Arize Phoenix（Elastic License 2.0）

- 更深入的代理專屬評測：軌跡分群、異常偵測、給 RAG 用的檢索相關性。
- 原生 OpenInference 自動儀器化。
- 生產環境可搭配託管的 Arize AX。
- 沒有提示詞版本控制 —— 它把自己定位成搭在更廣平台旁邊的漂移／行為回歸工具。
- 最強項：RAG 相關性、行為漂移、異常偵測。

### Comet Opik（Apache 2.0）

- 透過 A/B 實驗做自動化提示詞最佳化。
- 護欄（PII 遮蔽、主題限制）。
- LLM 裁判式的幻覺偵測。
- 來自 Comet 自家量測的基準：Opik 記錄 + 評測花 23.44 秒，Langfuse 花 327.15 秒（約 14 倍差距）—— 廠商基準只能當方向性參考。
- 最強項：最佳化迴圈、自動化實驗、護欄強制執行。

### 業界數據

依 Maxim（2026 年田野分析）：89% 的組織已備妥代理可觀測性；品質問題是生產環境的頭號障礙（32% 的受訪者點名）。

### 挑一個

| 需求 | 挑 |
|------|------|
| 帶提示詞管理的全家桶 | Langfuse |
| 深入的 RAG 評測 + 漂移 | Phoenix |
| 自動化最佳化 + 護欄 | Opik |
| 開放授權、不要 ELv2 | Langfuse（MIT）或 Opik（Apache 2.0） |
| 與 Datadog／New Relic 整合 | 都可以 —— 它們全都匯出 OTel |

### 這套模式在哪裡會出錯

- **沒有評測策略。** 只有追蹤而沒有評測，就只是很貴的日誌。
- **自己搓一個沒有接地的 LLM 裁判。** CRITIC 模式（第 05 課）同樣適用 —— 裁判需要外部工具來做事實查證。
- **提示詞版本沒綁上追蹤。** 生產環境回歸時，你沒辦法二分搜尋出是哪個提示詞造成的。

```figure
wb-trace-ingest
```

## 動手實作

`code/main.py` 用 stdlib 實作一個追蹤收集器 + LLM 裁判評估器：

- 吃進 GenAI 形狀的 span。
- 依工作階段分組，替失敗的執行打標（護欄被絆到、評測信心低）。
- 一個腳本化的 LLM 裁判，依一份評分準則替代理回應評分。
- 一份類似儀表板的摘要：失敗率、主要失敗原因、評測分數分布。

跑它：

```
python3 code/main.py
```

輸出：逐工作階段的評測分數與失敗分類，對映 Langfuse／Phoenix／Opik 會顯示的東西。

## 框架應用

- **Langfuse** 自架或雲端；透過 OTel 或他們的 SDK 接。
- **Arize Phoenix** 自架；自動儀器化 OpenInference。
- **Comet Opik** 自架或雲端；自動化最佳化迴圈。
- **Datadog LLM Observability** 給那些本來就在跑 Datadog、維運與 ML 混編的團隊。

## 產出交付

`outputs/skill-obs-platform-wiring.md` 會挑一個平台，並把追蹤 + 評測 + 提示詞版本接進既有代理。

## 練習

1. 把一週的 OTel 追蹤匯出到 Langfuse 雲端（免費方案）。哪些工作階段失敗了？為什麼？
2. 替你的領域寫一份 LLM 裁判的評分準則（事實正確性、語氣、是否守住範圍）。在 50 條軌跡上測。
3. 拿 Langfuse 的提示詞版本控制跟 Phoenix 的軌跡分群比較。哪一個讓你更快知道壞了什麼？
4. 讀 Opik 的護欄文件。替你其中一趟代理執行接上一個 PII 遮蔽護欄。
5. 在你自己的語料上替這三個做基準測試。無視廠商公布的數字；量你自己的。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| 追蹤 | 「Span 收集器」 | 吃進 OTel／SDK 的 span；依工作階段建索引 |
| 提示詞管理 | 「提示詞 CMS」 | 綁著追蹤的版本化提示詞 |
| LLM-as-judge | 「自動化評測」 | 另一個 LLM 依評分準則替代理輸出評分 |
| 工作階段重播 | 「軌跡回放」 | 逐步走過過往執行以便除錯 |
| RAG 相關性 | 「檢索品質」 | 檢索回來的脈絡跟查詢對不對得上 |
| 軌跡分群 | 「行為分組」 | 把相似的執行分群以偵測漂移 |
| 護欄強制執行 | 「記錄時的政策」 | 對被記錄的內容做 PII／毒性／範圍檢查 |

## 延伸閱讀

- [Langfuse docs](https://langfuse.com/) —— 追蹤、評測、提示詞管理
- [Arize Phoenix docs](https://docs.arize.com/phoenix) —— 自動儀器化、漂移
- [Comet Opik](https://www.comet.com/site/products/opik/) —— 最佳化 + 護欄
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 這三者都吃的那套 schema
