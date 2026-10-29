# Capstone 86 — 憲法規則引擎（Constitutional Rules Engine）

> 一條規則必須具備名稱、謂詞條件（Predicate）與違規解釋。缺少這三者中任意一項的陳述，都只不過是一場模糊的口頭願望，絕不能算作規則。

**Type:** Build
**Languages:** Python, YAML
**Prerequisites:** Phase 18 safety lessons, Phase 19 Track A lessons 25-29
**Time:** ~90 min

## Problem｜問題

分類器涵蓋可辨識的失誤，規則引擎則涵蓋合約型約束。一家研發智慧程式設計助手的團隊渴望施加一條剛性約束：「任何包含程式碼的回答，其末尾必須以可執行的程式碼區塊收尾，或者明確說明一項假設」；一家維運智慧客服機器人的團隊渴望施加一條業務約束：「每一次拒絕回答使用者的提問時，必須主動提供替代的引導下一步」。這些具備強業務屬性的邊界，根本不是傳統分類器能夠天然解決的目標。它們本質上是作用於回答文字、對話脈絡與系統政策之上的邏輯謂詞，且必須讓非工程師也能讀懂。

如實的表示形式，是**宣告式規則設定檔（Declarative File）**。一份憲法（Constitution）以標準 YAML 格式與原始碼並列存放在版本控制系統中，遵循獨立的審查流程。每條規則明確宣告其 `name`、觸發謂詞 `predicate`、嚴重度等級 `severity` 以及一句預設的 `explanation` 違規解釋模板。引擎動態載入該檔案、針對候選回答逐條求值，並為每一條被觸發的規則回傳一個結構化的 `Violation` 違規記錄。本課的規則引擎支援使用 `all_of`、`any_of` 與 `not_` 進行複雜布林邏輯複合，使單條規則能夠精準表達：「若回答中包含程式碼，則其末尾必須以可執行的程式碼區塊或明示假設收尾，**且**不得引用內部專用函式庫」。

本課的另一半核心靈魂在於**自動修訂（Revision）**。一個只會冰冷阻斷的規則引擎只完成了一半的工程使命。一個能夠主動提出修補處方的規則引擎才具備真正的實戰生產力：助手產出回答初稿，引擎標記出各項違規，修復器（Fixer）自動生成修訂後的版本，引擎再次審查確認修訂版本已完全滿足憲法規則。本課交付了一個極簡的修復器（按規則實施正則替換），並輸出草稿與修訂版本之間結構化的 Diff 變更清單（包含逐行的追加、刪除與修改）。

## Concept｜核心概念

```mermaid
flowchart LR
  D[草稿回應] --> RE[規則引擎]
  RE -->|violations| F[修復器]
  F --> R[修訂後回應]
  R --> RE2[規則引擎第 2 次檢查]
  RE2 -->|verdict| OUT[通過或升級處理]
  D -.->|diff| R
```

一條標準的憲法規則形態如下：

```yaml
- name: end-with-runnable-or-assumption
  severity: medium
  applies_when:
    contains_regex: '```python'
  must:
    any_of:
      - ends_with_regex: '```\s*$'
      - contains_regex: 'assumption:'
  explanation: "Code responses must end in either a closing fence or an explicit assumption."
  fix:
    append_if_missing: "\n\nAssumption: example inputs are valid."
```

原子謂詞支援：`contains_regex`、`not_contains_regex`、`ends_with_regex`、`starts_with_regex`、`max_words`、`min_words`。複合謂詞支援：`all_of`、`any_of`、`not_`。引擎首先對 `applies_when` 進行求值；若該規則當前並不適用，該次校驗被標記為 `not_applicable`（不適用）；若適用，引擎隨即對 `must` 條件展開求值，產出 `pass`（合格）或 `violation`（違規）。

嚴重度等級同樣對齊第八十五課：`low`、`medium`、`high`。下游的安全閘門（第八十七課）對 `high` 級別的規則違規實施與 `high` 級別分類器裁決完全對等的處置：堅決阻斷。

修復器由一組宣告式的文字變換操作構成：`append_if_missing`（缺失時末尾追加）、`prepend_if_missing`（缺失時開頭前綴）、`replace_regex`（正則替換）。每項操作將規則名稱精確映射為一種變換。修復器刻意限制在局部修飾層面；深層的結構性重寫由本課未涵蓋的拒絕與協助層處理。

Diff 變更清單在原始草稿與修訂文字之間精確計算。它由包含操作型別 `op`（add、remove、edit）與對應文字的 `Change` 記錄組成。下游安全閘門可以記錄該 Diff，方便人類審查員長期審計修復器的行為軌跡。

```figure
cd-constitution-loop
```

## Build It｜動手實作

憲法規則定義於 `code/rules.yml` 之中。在 `code/main.py` 中的載入器相容 YAML 檔案（當系統安裝了 PyYAML 時）或純 JSON 格式。本課內建了這份標準的 `rules.yml`，單元測試在兩條讀取路徑上皆能無縫解析。`code/main.py` 定義了 `Engine` 核心引擎、`Fixer` 修復器以及 `diff` 比對函式。複合邏輯採用遞迴求值，並在 `any_of` 遇到首個真值時實施短路。

內建的六大經典憲法規則：

- `no-empty-refusal`（中危）：每次拒絕都必須提供建議或轉介。
- `end-with-runnable-or-assumption`（中危）：包含程式碼的回答必須妥善結尾。
- `no-pii-in-examples`（高危）：示例資料不得包含符合電話或電子郵件格式的字串。
- `cite-when-asserting-fact`（低危）：以「According to」開頭的行必須包含括號引用。
- `no-internal-library-leak`（高危）：輸出文字不得出現 `internal-only` 和 `policybot-internal`。
- `bounded-length`（低危）：回答不得超過 800 個詞。

## Use It｜實際應用

在終端機執行 `python3 main.py`。演示程式將驅動三篇候選草稿穿透規則引擎、印出被捕獲的違規細項、啟動自動修復器、印出逐行 Diff 變更對比，並輸出 `outputs/rules_report.json`。針對不包含程式碼的測試樣本，報告清晰展示 `not_applicable`，向團隊直觀證明引擎確實對每條規則皆進行了顯式的條件審查。

## Ship It｜交付成果

交付的 `outputs/skill-constitutional-rules-engine.md` 規範了憲法規則的語法標準與修復器的宣告格式。

## Exercises｜練習

1. 追加一條全新的業務規則：當使用者 Prompt 提及「安全」時，模型回答中必須強制包含「If this is urgent」這句緊急引導文字。使用複合謂詞實作。
2. 將簡單的正則替換修復器，升級為支援具名插槽（Named Slots）的模板修復器。在該新架構下重寫並展示一條規則的自動修補。
3. 為規則引擎擴充指標統計端點：給定一批草稿時，回傳各規則的違規率，讓團隊看出哪條規則觸發過多。

## Key Terms｜關鍵術語

| 術語 | 常見口語說法 | 嚴格精準定義 |
|---|---|---|
| Constitution（憲法） | 一份模糊的政策文字 | 一份宣告了謂詞條件、嚴重度等級與違規解釋的 YAML 規則設定檔 |
| Predicate（謂詞） | 一道檢查條件 | 一個可呼叫物件，可將文字映射為布林值，並支援原子算子與 all_of/any_of/not_ 複合邏輯 |
| Violation（違規記錄） | 一次校驗失敗 | 包含被觸發規則名稱、嚴重度、解釋文本與命中跨度位置的結構化審計記錄 |
| Fixer（自動修補器） | 模型 fine-tuning 修復 | 依宣告式規則逐條將草稿轉換為修訂稿的確定性模組 |
| Diff（變更對比） | 字串比對 | 在原始草稿與修訂文字之間精確計算出的 add、remove、edit 操作清單 |

## Further Reading｜延伸閱讀

第八十七課將把本規則引擎、第八十三課的輸入端偵測器與第八十五課的輸出端分類器，全量匯聚為統一的端到端安全閘門。
