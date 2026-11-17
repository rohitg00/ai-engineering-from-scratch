# 紅隊工具鏈——Garak、Llama Guard、PyRIT（Red-Team Tooling — Garak, Llama Guard, PyRIT）

> 三款正式環境工具構成了 2026 年紅隊演練技術堆疊。**Llama Guard**（Meta 出品）——基於 Llama-3.1-8B 在 MLCommons 確立的 14 項危害大類上進行專門 fine-tuning 的防護分類器；2025 年發布的 Llama Guard 4 則是直接從 Llama 4 Scout 剪枝而成的 12B 原生多模態分類模型。**Garak**（NVIDIA 出品）——開源 LLM 漏洞掃描器，配備針對幻覺、資料外洩、Prompt 注入、毒性內容與越獄攻擊的靜態、動態與自適應探針（Probe）。**PyRIT**（微軟出品）——專為多輪對話深度紅隊戰役而生，內建 Crescendo 漸進升級、TAP 樹狀搜尋與自定義轉譯器鏈（Converter chains），專門挖掘深層邊界失效。Llama Guard 3 的技術細節完整記錄於 Meta 官方論文《Llama 3 Herd of Models》（arXiv:2407.21783）；Llama Guard 3-1B-INT4 詳見 arXiv:2411.17713；Garak 的探針架構開源於 github.com/NVIDIA/garak。這三款工具是 2026 年紅隊研究（第 12 至 15 節）與部署（第 17 課之後）之間的正式環境工具介面。

**Type:** Build
**Languages:** Python (stdlib, tool-architecture simulator and Llama Guard-style classifier mock)
**Prerequisites:** Phase 18 · 12-15 (jailbreaks and IPI)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 深入描述 Llama Guard 3/4 在整體安全技術堆疊中的架構位階：作為前置輸入分類器、後置輸出分類器，或兩者兼具。
- 梳理 MLCommons AILuminate 的 14 項標準危害大類，並指出其中較不直觀的類別（如程式碼直譯器濫用）。
- 掌握 Garak 的模組化探針架構：探針（Probes）、偵測器（Detectors）與測試框架（Harnesses）的三位一體。
- 剖析微軟 PyRIT 的多輪對話戰役結構，並說明其如何與 Garak 的單輪探針形成有機互補。

## The Problem｜問題

第 12 至 15 節全景展示了當前模型所面臨的各類受攻擊面。正式環境部署需要可重複、可規模化的評估。三款工具在 2026 年佔據主導地位：Llama Guard（即時防禦分類盾）、Garak（全自動漏洞掃描儀）、PyRIT（多輪深層紅隊攻擊戰役編排器）。每一款工具各自鎖定紅隊生命週期的不同戰略層次。

## The Concept｜核心概念

### Llama Guard（Meta）

Llama Guard 3 是一個基於 Llama-3.1-8B 打造的專屬安全分類模型，在 MLCommons AILuminate 的 14 大核心危害類別上進行了深度 fine-tuning：
- 暴力犯罪、非暴力犯罪、性相關、兒童性剝削與虐待（CSAM）、名譽毀謗
- 專業建議、隱私、智慧財產權、無差別武器、仇恨言論
- 自殺與自殘、性相關內容、選舉、程式碼直譯器濫用（Code Interpreter Abuse）

支援 8 種語言。實務架構位階：部署在 LLM 入口前端（輸入審查過濾）、部署在 LLM 出口後端（輸出合規審查），或前後端雙重夾擊。這兩種用途會產生不同的訓練資料分布；Llama Guard 3 以單一模型處理兩者。

Llama Guard 3-1B-INT4（arXiv:2411.17713，體積僅 440MB，在行動端手機 CPU 上吐字達約 30 tokens/s）是專為邊緣端打造的極致量化變體。

Llama Guard 4（2025 年 4 月發布）參數量為 12B，採原生多模態架構，由 Llama 4 Scout 剪枝而來。它以單一模型一舉取代了先前的 8B 文字版與 11B 視覺版，原生支援同時審查圖文交錯輸入。

### Garak（NVIDIA）

開源弱點自動化掃描器。標準架構包含三大核心元件：
- **探針（Probes）**。攻擊樣本生成器，專攻幻覺、資料洩漏、Prompt 注入、毒性內容與越獄繞過。涵蓋靜態探針（固定 Prompt 字典）、動態探針（產生 prompt）、自適應探針（依據目標回應即時動態回饋）。
- **偵測器（Detectors）**。評估器模組，對照預期失效模式為目標輸出打分——檢驗是否包含毒性、是否外洩資料、是否已構成實質越獄。
- **測試框架（Harnesses）**。統籌調度「探針-偵測器」配對，管理自動化測試戰役，並產出結構化漏洞分析報告。

TrustyAI 將 Garak 與 Meta 的 Llama-Stack 安全防護盾（Prompt-Guard-86M 前置輸入分類盾 + Llama-Guard-3-8B 後置輸出分類盾）整合，以進行端到端的受防護目標評測。分層危害評分體系（TBSA）取代二元通過／失敗評分：同一探針可能在嚴重性等級 3 通過，在等級 5 失敗。

### PyRIT（Microsoft）

Python 風險識別工具箱（Python Risk Identification Toolkit）。專為長程多輪對話紅隊戰役而生。核心架構圍繞三大支柱：
- **轉譯器（Converters）**。對種子 Prompt 實施多重語意變異——同義改寫、編碼轉換、跨語言翻譯、角色扮演偽裝。
- **編排器（Orchestrators）**。全流程協調戰役推進：Crescendo（循序漸進升級誘導）、TAP（多路徑搜尋修剪）、RedTeaming（自定義迴圈）。
- **打分器（Scoring）**。支援調用 LLM-as-a-judge 或專用分類器進行即時評判。

PyRIT 是較重型的工具。Garak 執行數千個單輪探針；PyRIT 則執行旨在突破特定失效模式的深入多輪戰役。

### 正式環境推薦標準技術堆疊

在模型前後兩側部署 Llama Guard。每晚執行 Garak 進行回歸測試；在預發布前執行 PyRIT 戰役。這是 2026 年多數正式環境部署的預設配置。

### 評測實務經典陷阱

- **裁判身分**。三款工具都可使用 LLM judge；裁判的校準會影響回報的 ASR（第 12 節）。應在工具資訊旁註明裁判。
- **靜態探針鈍化過時**。隨著新版模型持續針對已知攻擊進行防禦修復，Garak 的靜態探針會迅速老化鈍化。自適應探針（類似 PAIR 架構）比靜態探針老化得慢。
- **Llama Guard 在良性內容上的偽陽性率（FPR）**。早期的 Llama Guard 在涉及政治與 LGBTQ+ 內容的良性對話中頻繁引發過度敏感誤殺；Llama Guard 3 與 4 的校準度有所改善，但並未針對個別部署進行校準。

### 該研究在第 18 階段中的宏觀座標

第 12 至 15 節全景梳理了各類攻擊流派；第 16 節將其全面收攏為標準化的工業級工程工具鏈；第 17 節（WMDP）將評估軍民兩用能力；第 18 節則將帶領讀者宏觀審視前沿安全框架（RSP / PF / FSF）如何將這些工具沉澱為政策架構。

```figure
al-guard-stack
```

## Use It｜實際應用

`code/main.py` 打造了一套微型紅隊工具箱：內建基於關鍵字與語義特徵的簡易 Llama Guard 風格分類器（涵蓋 14 大類別）、一個簡易 Garak 探針測試架構（探針-偵測器迴圈），以及一條 PyRIT 風格的多輪對話轉譯器鏈。你可以對照一個模擬目標模型運作這三款工具，清晰直觀地對比各工具在防禦覆蓋維度上的顯著特徵指紋。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-red-team-stack.md`。輸入一套線上服務部署說明，該 Skill 將自動為你推導並產出最合適的紅隊工具組合、各工具內部的細粒度參數配置清單，以及推薦落實的常態化回歸演練排程表。

## Exercises｜練習

1. 執行 `code/main.py`。橫向比對 Llama Guard 風格分類器在面對單輪與多輪攻擊時的偵測率。
2. 在腳本中實作一個全新的 Garak 探針：生成經過 Base64 編碼包裝的惡意請求。測量 Llama Guard 分類器能否精確捕捉該變體。
3. 為 PyRIT 轉譯器鏈追加一條全新規則：「先翻譯為法文，隨後進行同義改寫」。重新度量攻擊穿透率的變化。
4. 仔細研讀 Llama Guard 3 的 14 項危害大類。找出兩個類別，其訓練資料可能會在合法的開發者內容上產生較高的偽陽性率。
5. 深入對比 Garak 與 PyRIT 的底層架構哲學。說明一種部署情境，在其中 Garak 與 PyRIT 各自適合作為工具。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Llama Guard | 「分類器」 | 以 14 種危害類別資料 fine-tune 的 Llama-3.1-8B／4-12B 安全分類器 |
| Garak | 「掃描器」 | NVIDIA 開源弱點掃描器；包含探針、偵測器與測試框架 |
| PyRIT | 「紅隊戰役工具」 | Microsoft 多輪紅隊協調工具；包含轉譯器、協調器與評分機制 |
| Prompt-Guard | 「小型分類器」 | Meta 的 86M prompt injection 分類器，搭配 Llama Guard 使用 |
| TBSA | 「分級評分」 | Garak 以分級通過／失敗評分取代二元結果 |
| Converter chain | 「改寫 + 編碼 + ……」 | PyRIT 用來組合多步驟攻擊的基本元件 |
| MLCommons hazard categories | 「14 種分類法」 | Llama Guard 採用的業界標準分類法 |

## Further Reading｜延伸閱讀

- [Meta — Llama Guard 3 (in Llama 3 Herd paper, arXiv:2407.21783)](https://arxiv.org/abs/2407.21783) — 8B 安全分類器官方技術報告。
- [Meta — Llama Guard 3-1B-INT4 (arXiv:2411.17713)](https://arxiv.org/abs/2411.17713) — 行動端極致量化安全分類模型。
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) — 官方開源掃描器專案主頁。
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) — 微軟開源紅隊戰役編排工具庫。
