# 專案實戰 17——個人 AI 家教（自適應、多模態、帶記憶）（Capstone 17 — Personal AI Tutor (Adaptive, Multimodal, with Memory)）

> 可汗學院的 Khanmigo、Duolingo Max、Google 的 LearnLM / Gemini for Education、Quizlet 的 Q-Chat 以及 Synthesis Tutor，在 2026 年皆已大規模推出自適應多模態 AI 家教服務。其共通架構模型包含：蘇格拉底式引導教學策略（Socratic Policy，不直接把答案告訴學習者，而以問題引導）、在每一次對話互動後即時動態更新的學習者認知模型（貝氏知識追蹤（Bayesian knowledge tracing，BKT））、支援語音 + 文字 + 拍照解題的多模態輸入、課程知識圖譜檢索、間隔重複記憶排程，以及針對青少年兒童內容安全的硬性防護過濾。本專案實戰要求你端到端打造一個特定學科領域的自適應家教（K-12 代數或 Python 入門），針對 10 名真實學習者展開為期兩週的學習成效實證研究，並通過嚴苛的兒童內容安全合規審計。

**Type:** Capstone
**Languages:** Python (backend, learner model), TypeScript (web app), SQL (curriculum graph via Postgres + Neo4j)
**Prerequisites:** Phase 5 (NLP), Phase 6 (speech), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 14 (agents), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P5 · P6 · P11 · P12 · P14 · P17 · P18
**Time:** 30 hours

## Problem｜問題

自適應個人化教學曾經長期停留在教育科技學術論文的象牙塔中。然而到了 2026 年，它已徹底普及為大眾消費級數位產品。Khanmigo 部署進了美國多數學區；Duolingo Max 斬獲數千萬月活躍用戶；Google 的 LearnLM / Gemini for Education 為 Google Classroom 提供家教功能；Quizlet Q-Chat 與數位字卡深度綁定；Synthesis Tutor 則以面向好奇孩子的家教產品而迅速走紅。它們的共同特徵包括：多模態輸入（打字輸入、即時語音、拍照上傳數學公式）、蘇格拉底啟發式教學法（先提問引導思考、後給予知識點剖析）、逐輪即時更新的學習者掌握度模型，以及嚴格、適齡的內容安全防護。

你將親手為一組特定的學生群體建構這套系統。專案的核心驗收標準是一場真實的教學成效實證研究：針對 10 名真實學習者進行前後兩週的前測（Pre-test）與後測（Post-test）客觀評估。即時語音對話必須絲滑流暢（複用專案實戰 03 的低延遲技術堆疊）；學習記憶儲存必須尊重青少年隱私；內容安全過濾器必須通過考量 COPPA 的 K-12 紅隊測試。

## Concept｜核心概念

整套系統由四大神經中樞構成。**教學策略控制器（Tutor Policy）**：驅動一個嚴謹的蘇格拉底引導迴圈——當學生直接索取答案時，策略拋出具備啟發性的思考問題；當學生回答正確時，自動推進至下一階概念；當學生思維卡關時，逐步提供階梯式的鷹架提示（Scaffolded Hint）。**學習者掌握度模型（Learner Model）**：基於經典的貝氏知識追蹤演算法（BKT）或現代變體，在每一次對話互動後，即時重新計算學生對知識圖譜中各個概念節點的精準掌握機率。**課程知識圖譜（Curriculum Graph）**：部署在 Neo4j 中，由 50 至 150 個知識點節點與前置依賴邊（Prerequisite Edges）構成；教學策略沿著圖譜拓撲動態遊走，精準選取下一項最適合教授的知識點。**記憶管理中樞（Memory）**：採用「情節記憶 + 語意模式記憶」的雙層持久化架構，忠實記錄學生的歷史互動、經典易錯盲區與學習偏好。

使用者介面全面擁抱多模態。文字輸入用於常規回答；語音輸入透過 LiveKit + Whisper 處理（複用專案實戰 03）；拍照解題調用 dots.ocr 或 PaliGemma 2 視覺模型進行公式結構化轉譯；語音輸出使用 Cartesia Sonic-2。安全防護網全面調用 Llama Guard 4 搭配客製化的未成年人專屬過濾器（封殺暴力、自殘、成人內容），並採用考量 COPPA 的記憶留存政策。

教學成效實證報告是本專案的核心研究產出。組織 10 名學生展開為期兩週的學習追蹤，出具嚴格的前測與後測評分。量化學習成效的淨提升幅度與統計信賴區間。並與「不具備自適應能力的傳統線性順序對照組」展開客觀橫向對比。

## 系統架構

```
learner device
  |
  +-- text         -> web app
  +-- voice        -> LiveKit Agents (ASR + TTS)
  +-- photo math   -> dots.ocr / PaliGemma 2
       |
       v
  tutor policy (LangGraph)
       - Socratic decision head
       - next-concept chooser (curriculum graph walk)
       - hint scaffolder
       - mastery update
       |
       v
  learner model (BKT / item-response theory)
       - per-concept mastery probability
       - spaced-repetition scheduler (SM-2 or FSRS)
       |
       v
  memory (agentmemory-style)
       - episodic: every interaction
       - semantic: learned mistakes, preferences
       - retention policy: COPPA / GDPR aware
       |
       v
  curriculum graph (Neo4j)
       - prerequisite edges
       - OER content attached
       |
       v
  safety:
    Llama Guard 4 + age-appropriate filter
    memory access guarded by learner ID scope
```

## 技術堆疊

- 目標學科領域：K-12 初等代數，或零基礎 Python 程式設計入門（任選其一深入鑽研）
- 教學策略決策引擎：LangGraph，後台對接全面啟用 Prompt 快取的 Claude Sonnet 4.7
- 學習者認知模型：經典貝氏知識追蹤演算法（BKT），或使用 FSRS 進行間隔重複排程
- 課程知識圖譜：Neo4j 圖資料庫，儲存知識點實體、前置先修依賴邊，並掛載開放教育資源（OER）教材
- 記憶管理儲存庫：基於 agentmemory 風格的向量 + 情節記憶 + 抽象語意混合記憶庫
- 即時語音子系統：LiveKit Agents 1.0 + Cartesia Sonic-2（複用專案實戰 03 核心模組）
- 視覺公式辨識：dots.ocr 或 PaliGemma 2 視覺語言模型，專門解析拍照上傳的數學方程式
- 內容安全防護欄：Llama Guard 4 搭配自定義未成年人專屬過濾器
- 評測驗收工具：基於布魯姆認知維度（Bloom's Taxonomy）的試題自動生成器、前測／後測評分工具鏈

```figure
cf-tutor-loop
```

## Build It｜動手實作

1. **課程知識圖譜建構**。在 Neo4j 中建置包含 50 至 150 個核心知識點節點的圖譜（例如 K-12 代數：自「數線基礎」一路延伸至「一元二次方程式公式解」），建立嚴密的前置依賴邊。為每個節點掛載開放教育資源（OpenStax 等 OER 教材）。

2. **貝氏認知模型初始化**。實作經典 BKT 演算法，配置初始先驗機率：猜測率（Guess）、失誤率（Slip）、學習轉移率（Learn-rate）。在每次對話互動後，即時更新學生對該知識點的掌握機率。資料依學習者 ID 嚴格隔離持久化。

3. **蘇格拉底教學決策狀態機**。使用 LangGraph 編排核心節點：`read_signal`（判定學生上一輪回答是完全正確、局部正確還是完全卡關？）、`select_concept`（沿著圖譜拓撲動態選取當前優先級最高的最優教學節點）、`scaffold`（生成階梯式啟發引導 Prompt）、`update_mastery`（更新掌握度）。

4. **青少年隱私安全記憶中樞**。每一次互動對話都會寫入情節記憶儲存區。歷史重複犯下的思維誤區與偏好特徵自動提煉晉升至語意記憶。採用考量 COPPA 的留存政策：超過 1 年的資料自動徹底銷毀，並提供家長存取方式。

5. **低延遲語音對話通道**。將 LiveKit Agents 的工作者無縫掛載至教學決策狀態機。ASR 採用 Whisper-v3-turbo；TTS 採用 Cartesia Sonic-2。原生支援插話打斷機制（複用專案實戰 03 核心機制）。

6. **拍照解題多模態通道**。支援學生上傳或拍攝影像；調用 dots.ocr 或 PaliGemma 2 辨識方程式，並將結果作為結構化輸入傳給教學策略。

7. **未成年人內容安全防禦**。模型的每一次輸出皆強制通過 Llama Guard 4 與專屬的年齡適配過濾器（封鎖自殘、成人內容與暴力）。記憶存取嚴格綁定學生唯一 ID，杜絕跨帳號資料串擾，並提供家長可存取的記憶刪除機制。

8. **兩週教學成效實證研究**。召集成員包含 10 名真實學生的實驗組：執行前測（標準化 30 道基礎題目測驗），開展為期兩週的常態化 AI 家教輔導（每週 3 次），隨後執行後測。與 10 名接受傳統無自適應線性教學的對照組學生進行橫向對比。

9. **每週學習進度報告自動產出**。針對每位學生，系統每週自動排版並產出一份精美的 PDF 週報：視覺化展示已探索的知識點地圖、掌握度變化軌跡，並列出建議的下一步。

## Use It｜實際應用

```
learner: "I don't understand why 3x + 6 = 12 means x = 2"
[signal]   stuck
[concept]  'isolating variables' (prerequisite: addition-subtraction-equality)
[scaffold] "what number would you subtract from both sides to start?"
learner: "6"
[signal]   correct
[mastery]  addition-subtraction-equality: 0.62 -> 0.77
[concept]  continue 'isolating variables'
[scaffold] "great. now what is 3x / 3 equal to?"
```

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-ai-tutor.md`。它代表一套具備多模態即時交互、自適應認知模型、長效安全記憶、嚴苛未成年人防護欄，並經過真實學習者兩週教學實證驗收的個人化 AI 家教系統。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | 學習成效淨增益 Delta | 在 10 名學習者兩週研究中的前測與後測分數差值 |
| 20 | 蘇格拉底教學引導忠實度 | 對話紀錄樣本的評分 |
| 20 | 多模態端到端交互體感 | 語音、拍照解題與文字對話端到端的一致性 |
| 20 | 隱私安全與法規合規性 | Llama Guard 4 通過率 + 符合 COPPA 的兒童隱私保護與記憶留存規範 |
| 15 | 課程體系廣度與圖譜質量 | 知識點概念覆蓋完整度、前置依賴拓撲關聯的客觀邏輯一致性 |
| **100** | | |

## Exercises｜練習

1. 在教學成效研究中，對比「啟用自適應認知模型」與「關閉認知模型、依隨機概念順序安排教學」兩種模式。客觀呈報兩者在後測成績提升 Delta 上的差距數值。預期自適應模式會勝出，但有意思的是勝出的幅度。
2. 開發多模態學習效率探針：將同一個核心抽象概念分別以純文字、語音與照片輸入三種形式進行教學。衡量學習者在偏好模態下是否能更快收斂。
3. 開發家長專屬控制看板：呈現孩子練習過的知識點、各學科掌握度變化軌跡與即將學習的新模組，以及所有觸發的安全事件紀錄。全面對齊 COPPA 法規。
4. 擴充跨語言即時切換教學能力：家教能流暢聽懂西班牙語學生的提問，並使用道地的西班牙語執行蘇格拉底式引導教學。度量 X-Guard 在跨語種教育場景下的安全防禦覆蓋率。
5. 實施極限記憶隱私壓力測試：驗證學生 A 是否可能透過語音片段重新輸入攻擊，意外探測到學生 B 的個人隱私學習資料。對任何越權存取嘗試留下資安紀錄並向管理員告警。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Socratic policy |「提問引導，不直接給答案」| 家教透過引導式問題提問，而非直接給出答案 |
| Bayesian knowledge tracing |「BKT」| 用來估計各概念掌握機率的經典學習者模型方程式 |
| FSRS |「自由間隔重複排程器」| 2024 年推出的間隔重複排程器，優於 SM-2 |
| Curriculum graph |「概念 DAG」| 以 Neo4j 建立概念及其先備依賴關係的圖譜 |
| Episodic memory |「每次互動的記錄」| 儲存每次互動，供日後檢索 |
| Semantic memory |「已學習模式儲存區」| 從情節記憶提煉並保存的錯誤模式與偏好 |
| COPPA |「兒童隱私法」| 限制蒐集 13 歲以下兒童資料的美國法律 |

## Further Reading｜延伸閱讀

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) — 商業級消費端 K-12 自適應 AI 家教權威參考。
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) — 語言學習領域多模態 AI 家教標竿。
- [Google LearnLM / Gemini for Education](https://blog.google/products-and-platforms/products/education/google-learnlm-gemini-generative-ai/) — Google 託管參考模型。
- [Quizlet Q-Chat](https://quizlet.com) — 結合間隔重複記憶的對話式學習產品。
- [Synthesis Tutor](https://www.synthesis.com) — 專攻兒童好奇心啟蒙的創新型家教產品。
- [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) — 現代最佳化間隔重複排程演算法開源庫。
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) — 教育認知建模經典 BKT 理論。
- [LiveKit Agents](https://github.com/livekit/agents) — 高效能即時語音對話官方開源儲存庫。
