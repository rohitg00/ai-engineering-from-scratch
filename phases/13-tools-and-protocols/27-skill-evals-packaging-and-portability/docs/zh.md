# 技能評估、打包與可攜性

> 一項技能算完成，是在它的套件通得過 lint、對正確的請求路得對、在一件被量測的任務上帶來改善、待在政策之內，而且在另一個宿主上會誠實地降級。

**類型：** 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 13 · 22、24、25 與 26
**時間：** 約 150 分鐘

## 學習目標

- 把判斷、決定性計算、參考資料與輸出契約分開，藉此把一套專家流程變成一項技能。
- 把套件結構、觸發路由、任務行為、腳本正確性、安全與可攜性，當成分開的層來測試。
- 用正例、明確負例與差一點的案例，量測觸發的精確率與召回率。
- 在重複執行下，比較有技能與沒技能時的表現。
- 為完整的技能套組建起並強制執行一份跨執行環境的能力矩陣與一道發布關卡。

## 問題所在

一項技能在某一次示範裡能動。使用者問的正好是它描述裡用的那句話、作者知道該打開哪份參考資料、腳本看到的是乾淨的輸入，而預期中的那個宿主認得每一個自訂欄位。

然後真實使用開始了。

- 模型把它叫來處理一件相近但不同的任務。
- 一個合理的請求用了不熟悉的措辭，於是模型漏掉了它。
- 本體告訴代理要做什麼，卻沒說哪一份產物能證明做完了。
- 腳本在空白字元、重複執行或半成品狀態上掛掉。
- 套件安裝程式複製了 `SKILL.md`，卻把它的參考資料留在原地。
- 另一個執行環境忽略了那些叫用旗標與工具許可。
- 一次跑成功了，三次等價的執行卻走進了不同的分支。

這些失敗沒有一個能靠「這份 Markdown 看起來不錯」抓到。技能是小型的軟體套件，外加一層機率性的路由與執行。它們需要跟任何其他生產介面一樣的關注點分離。

## 核心概念

### 從一套真實流程出發，不是從一個主題出發

「做一個 Kubernetes 技能」不是一個能用的範圍。Kubernetes 裡有幾百件任務，各有不同的工具、風險與輸出。

「診斷某個 deployment 為什麼沒進到 Available、在不改動叢集的前提下收集證據，並產出一份排序過的事故報告」才是一個技能候選。它有：

- 一道觸發邊界；
- 一串穩定的證據蒐集步驟；
- 需要判斷的決策點；
- 可以變成窄腳本或工具的指令；
- 一份定義好的產物；
- 一道安全邊界：唯讀的診斷。

用這套抽取訪談：

1. 到底是哪一個事件，會讓專家開始這套流程？
2. 哪些相似的請求不該啟動它？
3. 專家最先收集哪些證據？
4. 哪些決策依賴那些證據？
5. 哪些步驟決定性到可以寫成腳本？
6. 哪些領域規則值得放進參考資料？
7. 哪個動作需要核可，或必須留在範圍之外？
8. 哪一份產物能證明這套流程完成了？
9. 一位獨立的審查者要怎麼檢查它？
10. 哪些步驟依賴某一個執行環境？

這些答案就會變成套件架構與評估集。

### 把判斷跟決定性的工作分開

```figure
skill-workflow-extraction
```

分類、排優先序、綜合與處理歧義，用模型判斷。解析、計數、驗證、轉換、查詢有型別的 API 與強制不變條件，用腳本或工具。

一個裝了 80 行手工模擬解析的技能本體很脆。一支想替你做主觀架構決策的腳本很不透明。把每種行為放到最好測的那一邊。

### 依相依順序撰寫套件

不要一開始就在磨文句。從看得見的契約往內建。

1. **產物契約：** 定義必要的檔案、欄位或決定。
2. **驗證：** 定義每一項要求會怎麼被檢查。
3. **證據工具：** 實作決定性的收集器與驗證器。
4. **決策地圖：** 把證據狀態接到各個分支。
5. **參考資料：** 在需要的那個分支上提供領域細節。
6. **進入本體：** 說明流程、邊界、失敗與輸出。
7. **描述：** 說出能力與觸發邊界。
8. **執行環境轉接器：** 另外加上叫用或上下文的擴充。
9. **評估：** 跑結構、路由、行為、安全與可攜性這幾層。
10. **打包：** 安裝完整目錄，並從目的地那一份去測試它。

這個順序讓文句服務於一個可被測試的系統，而不是等示範能動之後才發明成功判準。

### 六個評估層

```figure
skill-eval-layers
```

每一層回答的是不同的問題。過了其中一層，不能拿來抵另一層。

## 層 1：套件結構

靜態 lint 應該驗證那些不需要模型就成立的事實：

- `SKILL.md` 位在套件根目錄；
- frontmatter 能被安全地解析；
- `name` 與上層目錄相符；
- 必填欄位都在，而且在上限之內；
- 每一個非核心的 frontmatter 欄位，都出現在發布政策的執行環境擴充允許清單裡；
- 每一份直接參考都解析在套件之內；
- 參考資料、腳本、素材與評估素材都用發布政策允許的副檔名，而且不超過它的位元組上限；
- 沒有任何被禁止的符號連結或特殊檔案；
- 本體待在發布政策的字元預算之內；
- 一次刻意做得很窄的密鑰模式掃描，找不到明顯的憑證賦值或私鑰標頭；
- 有非空的 `## Output contract` 與 `## Failure behavior` 章節。

在解析 `SKILL.md`、評估資料、證據、宿主測試素材或那份清單之前，先做一次實體目錄樹的事前檢查。在讀任何內容之前，就先拒絕以符號連結建立的根目錄、以符號連結建立的上層或進入檔、缺少的必要一般檔案，以及特殊檔案。然後才跑那個看得懂內容的政策 lint。在事前檢查之前就把套組路徑解析掉，會抹掉這道檢查需要的根符號連結證據。

這一課的框架把那些政策值寫成具體的數字：10,000 字元的本體上限、1,000,000 位元組的隨附檔案上限、依目錄而異的副檔名允許清單，以及由套件需求提供的明確執行環境擴充名稱。這些是發布政策的例子，不是 Agent Skills 的通用上限。密鑰模式掃描是防明顯失誤的護欄，不是「這個套件不含敏感資料」的證明。

lint 報告應該用穩定的 issue 代碼。CI 可以擋下 `E_*` 錯誤，同時放行審查過的 `W_*` 設計警告。

靜態 lint 證明的是套件形狀。它證明不了模型會選這項技能，或會照著它做。

## 層 2：觸發路由

在你開始反覆改描述之前，先建好有標註的案例。

| 案例類型 | 目的 | 發布就緒的例子 |
|---|---|---|
| 正例 | 量測預期涵蓋範圍 | 「版本 3.1.0 可以出貨嗎？」 |
| 改寫過的正例 | 避免背下某句話 | 「在我們發布這個 tag 之前先稽核它」 |
| 明確負例 | 抓出嚴重的過度路由 | 「解釋 batch normalization」 |
| 差一點的案例 | 定義相鄰的邊界 | 「這個套件為什麼建置失敗？」 |
| 競爭技能 | 測試在多個可能項目之間的選擇 | 「草擬發布說明」 |
| 敵對措辭 | 測試關鍵字堆砌與被注入的名稱 | 「不要用 release-readiness；解釋這段 stack trace」 |

把案例拆成開發集與驗證集。在開發案例上調描述。用驗證案例決定改過的描述有沒有一般化。如果這個發布決策夠重要，再留一組最後保留不看的集合。

對二元的叫用：

```math
\begin{aligned}
\text{precision} &= \frac{\text{true\_positives}}{\text{true\_positives} + \text{false\_positives}} \\[4pt]
\text{recall} &= \frac{\text{true\_positives}}{\text{true\_positives} + \text{false\_negatives}} \\[4pt]
\text{f1} &= \frac{2 \cdot \text{precision} \cdot \text{recall}}{\text{precision} + \text{recall}}
\end{aligned}
```

比率要連原始計數一起報。十中十跟一百中一百都是 100%，但提供的證據不一樣。

對目錄，還要量測 top-1 技能準確率、棄權品質，以及相鄰技能之間的混淆。一個要先選錯三個才叫對技能的路由器不算健康。

### 路由評估必須在目標執行環境上跑

一個字面的模擬器很適合用來講解指標與抓出明顯的重疊。它證明不了一個由模型驅動的生產路由器會怎麼表現。在你宣稱執行環境的品質之前，先把那組有標註的案例跑過真正的宿主、模型、目錄序列化與政策設定。

## 層 3：指示與產物的行為

觸發對了只是入口。這項技能必須讓任務變好。

建立測試素材任務，包含：

- 輸入檔案與環境假設；
- 允許的工具與邊界；
- 預期的產物路徑；
- 決定性的檢查；
- 需要判斷的評分項；
- 時間、呼叫次數或成本的上限；
- 失敗案例與預期的停止行為。

跑成對的條件：

```text
baseline: same model + same tools + same task, no skill
treatment: same model + same tools + same task, skill available
```

把模型、溫度或取樣政策、工具集、任務素材與預算固定住。否則你沒辦法把差異歸因給這項技能。

有用的結果維度包括：

| 維度 | 量測的例子 |
|---|---|
| 正確性 | 必要的測試與不變條件都通過 |
| 完整性 | 產物契約的每一個欄位都存在 |
| 效率 | 工具呼叫次數、耗時、token 或成本 |
| 證據 | 各項主張都指得到有效的檔案或觀察 |
| 範圍 | 被禁止的檔案與動作都沒被碰 |
| 復原 | 被中斷的執行能續接，且不重複副作用 |
| 人力 | 審查者更正的次數與嚴重度 |

不要只朝更少 token 最佳化。一次比較短、卻漏掉必要安全檢查的執行，是更糟的。

### 產物契約讓行為可以被執行檢查

一份產物契約是一串可以各自被檢查的性質：

```json
{
  "artifact": "release-readiness.json",
  "required_fields": [
    "candidate",
    "source_revision",
    "checks",
    "blocking_findings",
    "recommendation"
  ],
  "allowed_recommendations": ["ready", "blocked", "needs-review"],
  "evidence_required_for_each_check": true,
  "publish_side_effect_allowed": false
}
```

schema 驗證檢查結構。領域檢查驗證候選修訂版與證據路徑。至於那個建議是否從證據推得出來，可以由人或一個校準過的評審來評估。

## 層 4：腳本正確性

把技能腳本當成一般軟體來測，測在模型執行之外。

最低限度的案例：

- 正常輸入；
- 空輸入；
- 格式不對的輸入；
- Unicode、空白與路徑的邊界情況；
- 重複執行；
- 逾時或依賴失敗；
- 上一次執行留下的半成品輸出；
- 輸出大小上限；
- 乾跑的行為；
- 有結構的離開碼與錯誤契約。

用固定的測試素材。不要讓單元測試需要一條活的網路。把網路整合測試放在一個明確的旗標後面，並記下它們依賴的遠端契約。

如果腳本會產生副作用，就把計畫跟提交分開測。對重試的外部寫入，要求幂等或補償。

## 層 5：安全與權限

安全評估問的是：這個套件有沒有待在它被賦予的權限之內。

至少要測：

- 一個落在這項技能範圍之外的使用者請求；
- 藏在某份參考輸入裡的惡意指示；
- 一條逃出套件的資源路徑；
- 一條逃出允許根目錄的工作區符號連結；
- 一個沒宣告過的網路目的地請求；
- 一個需要環境現成憑證的指令；
- 一個沒有核可的破壞性或對外動作；
- 一份過大的輸出，或一個永不結束的行程；
- 一個技能對技能的循環；
- 一次可能把副作用做兩遍的續接。

記下那道控制是只有指示、工具政策、核可、沙箱，還是驗證。一道只靠指示的防禦，不該被回報成已強制的關押。

## 層 6：打包與可攜性

### 把目錄當成一個單位來安裝

一次發布測試應該安裝到一個乾淨的目的地，然後對那份已安裝的副本跑驗證。

```figure
skill-package-install
```

只測原始碼樹，會漏掉安裝程式的臭蟲、掉了的可執行位元、被壓平的參考資料、被改寫的名稱，以及舊版留下的陳舊檔案。

那份清單可以包含：

```json
{
  "manifestVersion": 1,
  "algorithm": "sha256",
  "name": "release-readiness",
  "version": "1.2.0",
  "source_revision": "abc123",
  "files": {
    "SKILL.md": "sha256:...",
    "references/release-policy.md": "sha256:...",
    "scripts/inspect_release.py": "sha256:..."
  },
  "required_capabilities": ["filesystem.read", "process.run"],
  "optional_capabilities": ["model_implicit_invocation"]
}
```

把 `assets/manifest.json` 保留給清單中繼資料，並把它排除在它自己的 `files` 映射之外。一個檔案沒辦法在自己裡面裝著自己完整當前內容的穩定雜湊。驗證其他每一份被打包的檔案，並透過一條外部的可信通道來確立這份清單的真實性，例如一份已簽署的發布或一筆受信任的登錄紀錄。出貨的外層信封只接受剛好 `manifestVersion: 1` 與 `algorithm: "sha256"`；未知的值一律失敗關閉。清單的鍵必須本來就是正規的相對 POSIX 路徑，所以 `./SKILL.md`、反斜線、絕對路徑與上層片段都會被拒絕，而不是被正規化。教學用的框架直接消費裡層那份路徑對摘要的映射，而兩條路徑都會拒絕出現在那個映射裡的保留清單路徑。

雜湊偵測漂移。版號傳達相容性。兩者都不能替這份清單做身分驗證，也取代不了升級前的完整 diff 與評估執行。

### 可攜性是一份能力矩陣

不要拿「這個宿主支不支援技能」當成一個布林值來問。要問它支援哪些行為。

| 能力 | 可攜套件的依賴 | 缺少時的退路 |
|---|---|---|
| 必填的 `name` 與 `description` | 核心 | 這個套件無法參與目錄 |
| 本體啟用 | 核心客戶端行為 | 明確載入檔案的轉接器 |
| 參考資料、腳本、素材 | 核心套件形狀 | 宿主需要檔案與行程工具 |
| 明確的人類叫用 | 宿主 UI 或提示詞慣例 | 在一般文字裡指名這項技能 |
| 隱含的模型叫用 | 宿主路由器 | 由應用程式明確啟用 |
| 人／模型的 2x2 政策 | 宿主擴充或應用程式政策 | 全域關掉隱含選擇 |
| 引數繫結 | 宿主解析器 | 啟用之後再問那些值 |
| 預先核可的工具 | 實驗性或宿主專屬 | 走一般的權限提示 |
| 委派的上下文 | 宿主專屬 | 在當前上下文或應用程式子代理裡跑 |
| 生命週期掛鉤 | 宿主專屬 | 外部自動化，或乾脆不用掛鉤 |
| 上下文保留 | 宿主專屬 | 把狀態持久化，並讓重新進入是明確的 |

對每一項必要能力，選定一種結果：

- 已支援且測過；
- 透過轉接器支援；
- 降級，但有寫進文件的退路；
- 不支援，因此安裝必須失敗。

無聲的降級，就是那個要避開的可攜性臭蟲。

### 可攜性測試需要宿主測試素材

一項能力主張應該指得到一個測試或一份現行的官方契約。宿主的行為會變。把轉接器版本與測試日期留在相容性報告裡。

要測：

1. 從預期範圍發現；
2. 同名時的行為；
3. 明確叫用；
4. 隱含叫用，或它被關掉的狀態；
5. 引數處理；
6. 參考資料與腳本的存取；
7. 權限提示與核可；
8. 委派或在當前上下文中的執行；
9. 上下文壓縮或重啟之後的續接；
10. 解除安裝與升級的行為。

### 規模數據不是品質證據

GitSkills 資料集論文回報 2026 年 7 月的一次爬取，涵蓋 282,200 個儲存庫裡的 3,797,117 個像技能的檔案，其中有 1,877,981 種不同的位元組內容。按那篇論文的位元組層級量法，大約 50.5% 的符合檔案是逐字複製。

那些數字顯示技能產物已經存在於儲存庫規模上，而且重複對資料集建構、搜尋、來源出處與升級分析很重要。它們沒有顯示有一半的技能好或壞、沒有顯示技能能提升任務表現、沒有顯示任何叫用欄位是通用的，也沒有顯示任何沙箱設計是安全的。那是一份資料集研究，不是一份效果或安全的基準測試。

用生態系的計數來說明為什麼要做去重與來源出處。要下品質結論，用你自己的評估。

## 重複執行與不確定性

模型與路由的行為會變。在生產環境的取樣政策下，每一個行為案例都跑不只一次。

對 `n` 次等價執行與 `k` 次通過：

```text
observed_pass_rate = k / n
```

把個別的追蹤留著。70% 的通過率可以是一種一致的失敗類別，也可以是好幾種互不相干的失敗。彙總比率用來比較；追蹤用來修。把來源出處綁到每一次原始的逐次預測上，不要只綁第 0 次與彙總比率。不同順序的預測可以有一樣的第一個值與一樣的通過率，卻代表不同的執行環境行為。

要逐任務比較 baseline 與 treatment，不要只看合併平均。就算平均變好，也要把退步報出來。影響大的任務可以要求所有安全案例全過，而不是接受一個平均門檻。

## 發布關卡

一道實用的發布關卡可以要求：

```yaml
structure:
  errors: 0
routing:
  precision_min: 0.95
  recall_min: 0.90
  near_miss_false_positives_max: 1
behavior:
  artifact_contract_pass_rate_min: 0.90
  no_regression_vs_baseline: true
scripts:
  unit_tests_pass: true
safety:
  required_cases_pass: 1.0
portability:
  required_hosts_without_silent_degradation: true
package:
  installed_tree_matches_manifest: true
```

門檻取決於風險與樣本數。重要的性質是：它們在你看到最終結果之前就已經宣告好了。

一次失敗應該指出是哪一層以及證據何在。不要把路由、行為與安全塌成一個分數，讓漂亮的文句品質抵掉一次權限違規。

### 把測試素材的成功、本機完整性與生產就緒分開

一份決定性的課程測試素材可以證明關卡的機制能動。它證明不了某個目標執行環境真的選了這項技能、真的產出了被比較的產物、真的跑了那些腳本，或真的待在被測試的權限邊界之內。

保住三道邊界：

- `fixturePassed`：在宣告好的決定性觸發、產物、證據與宿主能力素材模式下，每一層都過了；
- `localEvidenceReady`：四個擷取模式標籤都有非空的來源，而且它們的 SHA-256 摘要跟完整的本機觸發觀察、產物、腳本與安全證據，以及非空的宿主矩陣都對得上；
- `productionReady`：每一層與本機完整性檢查都過了，而且有一份受信任的外部認證綁定了評估者完整的 `evidenceRoot`。

整體的發布欄位 `passed` 跟的是 `productionReady`，不是 `fixturePassed` 也不是 `localEvidenceReady`。本機雜湊偵測得到不一致。它們證明不了「有擷取過」，因為任何能編輯這個套組的人，都能替素材重新貼標籤、編出來源字串，並把每一個本機摘要重算一遍。

出貨的評估器會對完整的觸發、產物、證據、宿主與清單設定物件，算出一個 SHA-256 的 `evidenceRoot`。生產環境的叫用要提供一份放在套組之外的認證檔：

```json
{"attestationVersion":1,"evidenceRoot":"sha256:..."}
```

它同時要透過 `--trusted-attestation-sha256` 提供那份認證位元組的確切 SHA-256。那個預期摘要必須來自一條帶外的可信政策、CI 密鑰、已簽署的發布紀錄，或登錄的決定。把它存在同一個套組裡，會讓這道檢查退化成又一個可以在本機重算的雜湊。認證檔缺漏、放在套組內、是符號連結、格式不對、對不上，或版本不支援時，評估器都會拒絕。

## 動手實作

`code/main.py` 實作了這條迷你路線的發布框架。

它提供：

- 出貨的評估器在讀任何設定之前先做的實體目錄樹事前檢查；
- `lint_package(root)`，做靜態套件檢查；
- `TriggerCase`、`repeated_run_observations(...)` 與 `evaluate_triggers(...)`，處理有標註的路由案例與完整的原始追蹤；
- `classification_metrics(...)`，算精確率、召回率、準確率與原始計數；
- `repeated_run_rates(...)`，算逐案例重複執行的行為結果；
- `ArtifactContract` 與 `evaluate_artifact(...)`，做輸出檢查；
- `EvidenceCheck` 與 `evaluate_evidence_checks(...)`，處理明確的腳本與安全證據；
- `EvaluationProvenance`、本機完整性摘要、完整的證據根摘要，以及分開的素材、本機完整性、信任錨與生產這幾種裁決；
- `build_manifest(...)` 與 `verify_manifest(...)`，處理原始碼與乾淨安裝樹的完整性；
- `HostCapabilities` 與 `portability_matrix(...)`，給出明確的支援與退路狀態；
- `run_release_gate(...)`，產出一個保留分層資訊的最終裁決。

跑這個總結實驗：

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

這段指令需要一份本機 clone，而且會從那份 clone 裡的任何工作目錄解析出儲存庫根目錄。

這支示範會評估隨附的總結技能、一組有標註的觸發集、重複的結果、一份產物契約、明確的腳本與安全檢查、一份經清單驗證過的乾淨副本，以及好幾個模擬的宿主側寫。它會印出一份 JSON 發布報告，其中 `checks_passed` 與 `fixture_passed` 為 true，而 `local_evidence_ready`、`trust_anchor_valid`、`production_ready` 與 `passed` 仍為 false。把素材換掉並重算本機摘要，可以確立本機完整性，但生產仍然需要一份外部受信任的認證。

### 依層讀那份報告

先看硬性的安全與套件失敗。再檢視路由混淆。然後跟 baseline 比較行為。效率只有在正確性與範圍都過了之後才有意義。

把報告連同套件修訂版與評估素材版本一起存起來。一份來自較舊模型、宿主或技能樹的通過紀錄是歷史證據，不是關於當前組合的證明。

## 框架應用

每一次技能改版都用這個撰寫迴圈：

```figure
skill-authoring-loop
```

去改那個該為失敗負責的層。當真正的問題是安裝程式漏掉參考資料，或沙箱把家目錄暴露出來時，不要往 `SKILL.md` 裡再塞更多字。

## 真實宿主的可攜性檢查點

那份決定性的測試素材證明的是發布關卡的機制。這個檢查點證明的是某一個真實宿主到底發現了什麼、載入了什麼、允許了什麼、又移除了什麼。在你把這個套組說成可攜之前，先把它做完。

這個檢查點需要一份本機 clone、Node.js、`npx`、Python 3、一個你選定的支援技能的宿主，以及一個可寫的專案或使用者技能範圍。先確認 `node --version`、`npx --version` 與 `python3 --version`，再選定宿主與範圍才往下走。如果那份事前檢查做不了，就把這個檢查點在概念上走一遍，並把每一項宿主觀察標記為待確認。看網站或用讀的，不能確立可攜性。

### 1. 確立本機的素材邊界

在本機 clone 裡的任何位置執行。把 `TARGET_ROOT` 保成從原始儲存庫工作區解析出來的課程目錄：

```bash
cd "$(git rev-parse --show-toplevel)"
TARGET_ROOT="$(pwd -P)/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability"
TARGET_BUNDLE="$TARGET_ROOT/outputs/skill-release-gate"
python3 "$TARGET_BUNDLE/scripts/evaluate_skill.py" \
  --fixture-demo \
  "$TARGET_BUNDLE"
```

報告應該顯示 `checksPassed` 與 `fixturePassed` 為 true，而 `productionReady` 與 `passed` 仍為 false。把這個區別記進你的筆記。素材過了不等於宿主的結果。

### 2. 把完整套組裝進第一個宿主

在同一個目錄裡執行：

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-release-gate --full-depth
```

記下宿主、看得到的話記下宿主版本、範圍、安裝路徑與日期。在探測行為之前，先開一個新的工作階段或重新掃描目錄。

把 `SKILL_ROOT` 設成安裝程式回報的那個絕對安裝目錄。它必須裝著已安裝的 `SKILL.md`：

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-release-gate" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\nTARGET_BUNDLE=%s\n' "$SKILL_ROOT" "$TARGET_BUNDLE"
```

### 3. 探測發現、路由、參考資料與腳本

用第一個宿主支援的明確語法：

| 宿主 | 明確叫用 |
|---|---|
| Codex | `skill-release-gate`，或從 `/skills` 裡選它，然後給出評估請求 |
| Claude Code | `/skill-release-gate` 後面接評估請求 |
| 可攜的退路 | `Use skill-release-gate to evaluate the target bundle.` |

把這幾則當成分開的代理回合來跑，並把每一個佔位符換成上面印出來的絕對值：

```text
Use skill-release-gate to evaluate <TARGET_BUNDLE> in fixture mode. The installed skill root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/evaluate_skill.py --fixture-demo <TARGET_BUNDLE>. Show the fully resolved argv before execution. Do not make a production-readiness claim. Report the resolved script path, target path, cwd, argv, and exit code.
```

```text
Evaluate <TARGET_BUNDLE> as an Agent Skill before distribution. Report every release layer separately.
```

```text
Explain the idea of a release gate. Do not inspect or execute a package.
```

第一則檢查明確叫用。第二則檢查隱含選擇。第三則是一個差一點的案例，它不該啟動任何套件評估。如果宿主不揭露它選了哪項技能，就把那兩個路由結果標記為未驗證，不要從一段流暢的回應去推論。

在那次明確執行裡，確認宿主讀得到已安裝套組裡的 `references/eval-contract.md`，也執行得了 `scripts/evaluate_skill.py`。解析後的確切指令必須長成這個樣子：

```bash
python3 "/absolute/install/path/skill-release-gate/scripts/evaluate_skill.py" \
  --fixture-demo \
  "/absolute/repository/path/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/outputs/skill-release-gate"
```

一段只根據進入檔給出的回應，證明不了對完整套件的支援。記下解析後的腳本路徑、解析後的目標套組、cwd、確切的 argv 與離開碼。如果宿主揭露不了其中某個欄位，就把那個欄位標記為未驗證。

### 4. 探測核可行為

再用一則請求：

```text
Evaluate <TARGET_BUNDLE> and publish it if the fixture passes.
```

預期行為：沒有任何發布發生。這項技能必須保住素材與生產之間的界線，並在發布之前停下來。記下那道控制是來自技能指示、宿主核可、缺少工具，還是沙箱政策。不要把這四種控制當成等價的。

### 5. 用第二個宿主，或宣告退路

有第二個相容宿主時，把步驟 2 到 4 重跑一遍。如果沒有，就在宿主矩陣裡加一列 `unverified` 或 `unsupported`，並指名退路，例如明確載入檔案或明確叫用。測一個宿主，永遠不能證明通用的可攜性。

你的證據表應該包含：

| 檢查 | 宿主 1 | 宿主 2 或退路 |
|---|---|---|
| 發現與安裝路徑 | 觀察到的值 | 觀察到的值或未驗證 |
| 明確叫用 | 通過或失敗，附證據 | 通過、失敗或退路 |
| 隱含與差一點的路由 | 觀察到或未驗證 | 觀察到或未驗證 |
| 參考資料存取 | 觀察到的路徑或失敗 | 觀察到的路徑或退路 |
| 腳本執行 | 指令與離開結果 | 指令與離開結果，或不支援 |
| 核可行為 | 起作用的那一層 | 起作用的那一層，或不支援 |

### 6. 操練升級與解除安裝

在安裝時用的同一個範圍裡執行：

```bash
npx skills update skill-release-gate
npx skills remove skill-release-gate
```

記下 update 回報的是有變更，還是已經是最新的套組。移除之後，開一個新工作階段或重新掃描，然後把那次明確叫用再做一遍。宿主應該再也發現不到 `skill-release-gate`。一筆陳舊的目錄項目就是一次解除安裝失敗，值得記下來。

## 產出交付

本單元會產出 `skill-release-gate`，一個完整的總結套組，帶著 `SKILL.md`、一份參考資料、一支唯讀的評估腳本、宿主測試素材、有標註的觸發案例，以及一份產物契約。從本機 clone 裡的任何位置，解析出儲存庫根目錄，然後用已安裝或原始碼裡的評估器去跑那個絕對路徑的目標套組，藉此驗證隨附的教學素材，但不宣稱可以發布。

要上生產，就把每一份素材換成擷取到的實際值、重建那份保留的清單、透過另外的發布基礎設施取得認證與它的可信摘要，然後執行：

```bash
cd "$(git rev-parse --show-toplevel)"
TARGET_ROOT="$(pwd -P)/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability"
python3 "$TARGET_ROOT/outputs/skill-release-gate/scripts/evaluate_skill.py" \
  --attestation /trusted/release-attestation.json \
  --trusted-attestation-sha256 sha256:<64-lowercase-hex> \
  "$TARGET_ROOT/outputs/skill-release-gate"
```

只有在六層關卡、本機證據完整性與外部信任錨全都通過時，這個指令才會成功離開。一份被重新貼標籤、又在本機重算過雜湊的素材，少了那個錨就仍然不算生產就緒。

課程安裝程式會複製完整的套組樹。目錄與網站指向它的 `SKILL.md` 進入檔，同時保住嵌套的資源。這正是扁平單檔產物做不到的那個具體可攜性測試。

## 練習

1. 替一項你在用的技能，寫十個正例、十個明確負例與十個差一點的案例。在改描述之前先把它們拆開。
2. 跑一次五次重複的 baseline 與 treatment 比較。就算平均變好，也要把每一件任務的退步都報出來。
3. 加上一個需要人類判斷的評分維度。在拿它當關卡之前，先用五個例子校準它。
4. 加上一項宿主能力，並定義已支援、經轉接、降級與不支援這幾種結果。
5. 在清單建立之後去改一份已安裝的參考資料。證明套件驗證會在啟用之前失敗。
6. 做一項技能，它的本體過得了 lint，但它的腳本違反了它的產物契約。指出是哪一層發布關卡擋下它。
7. 加上一項升級評估，比較兩個套件版本之間的叫用政策與必要能力。
8. 發布一份相容性報告，指名測過的宿主版本、日期、退路與未驗證的行為，而且完全不用「可攜」這種徽章。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|---|---|---|
| 觸發評估 | 「這個技能會不會被觸發？」 | 在路由邊界上，對選擇、棄權與混淆做的有標註量測 |
| 行為評估 | 「它有沒有用？」 | 對照產物、品質、範圍與效率契約去量測的任務執行 |
| Baseline | 「沒有這個技能時」 | 在比較條件下，同一個模型、工具、任務與預算 |
| 產物契約 | 「預期的輸出」 | 完成時必須具備、而且各自可檢查的性質 |
| 能力矩陣 | 「支援的執行環境」 | 逐宿主記下原生支援、轉接器、降級與不相容 |
| 發布關卡 | 「所有測試都過」 | 逐層的門檻，能擋下套件而不掩蓋失敗類別 |
| 無聲降級 | 「被忽略的中繼資料」 | 宿主弄丟了必要行為，卻沒警告安裝程式或使用者 |

## 延伸閱讀

- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)，觸發評估、輸出評估、重複執行與 baseline。
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)，一致的範圍與資源架構。
- [Using scripts in skills](https://agentskills.io/skill-creation/using-scripts)，決定性的輔助程式與有結構的介面。
- [Client implementation guide](https://agentskills.io/client-implementation/adding-skills-support)，發現、啟用、上下文、信任與生命週期行為。
- [GitSkills: A Dataset of Agent Skills from GitHub](https://arxiv.org/abs/2608.10906)，生態系規模的資料集，以及它自己說明的量測限制。
