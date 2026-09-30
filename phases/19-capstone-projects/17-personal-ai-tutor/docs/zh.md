# 綜合專案 17 —— 個人 AI 家教（自適應、多模態、帶記憶）

> Khanmigo（可汗學院）、Duolingo Max、Google LearnLM / Gemini for Education、Quizlet Q-Chat 與 Synthesis Tutor，在 2026 年都大規模出貨了自適應的多模態家教。共通的形狀是：一套蘇格拉底式政策（絕不直接把答案倒出來）、一個每次互動後就更新的學習者模型（貝氏知識追蹤風格）、語音 + 文字 + 拍照數學的輸入、課綱圖檢索、間隔重複排程，以及針對年齡適切內容的硬性安全過濾。這個綜合專案要出貨一位主題專屬的家教（K-12 代數或 Python 入門）、以 10 位學習者跑一次為期兩週的成效研究，並通過一次內容安全稽核。

**類型：** 綜合專案
**程式語言：** Python (backend, learner model), TypeScript (web app), SQL (curriculum graph via Postgres + Neo4j)
**先修單元：** 階段 5（NLP）、階段 6（語音）、階段 11（LLM 工程）、階段 12（多模態）、階段 14（代理）、階段 17（基礎設施）、階段 18（安全）
**演練到的階段：** P5 · P6 · P11 · P12 · P14 · P17 · P18
**時間：** 30 小時

## 問題

自適應家教以前是教育科技的研究小眾。到了 2026 年它是一項消費性產品。Khanmigo 部署在美國大多數學區。Duolingo Max 衝到數千萬月活躍使用者。Google 的 LearnLM / Gemini for Education 驅動了 Google Classroom 裡的家教。Quizlet Q-Chat 就擺在單字卡旁邊。Synthesis Tutor 以「給好奇小孩的家教」爆紅。共通的元素是：多模態輸入（打字、說話、拍下方程式）、蘇格拉底式教學法（先問，再解釋）、每次互動後更新的學習者模型，以及嚴格的年齡適切安全。

你會替一個特定群體建一套這樣的東西。量測標準是一次真正的成效研究：以 10 位學習者做為期兩週的前測與後測分數。語音迴路必須感覺自然（沿用綜合專案 03 的子堆疊）。記憶必須尊重隱私。安全過濾器必須通過針對 K-12 的、意識到 COPPA 的紅隊測試。

## 概念

四個元件。**家教政策**是一條蘇格拉底式迴路：當學習者要答案時，政策問一個引導性問題；當他們答對了，就移到下一個概念；當他們卡住了，就給一個有鷹架的提示。**學習者模型**是貝氏知識追蹤（或一個簡單變體），在每次互動後更新每個課綱節點的精熟機率。**課綱圖**是一張存放概念與先備關係邊的 Neo4j；政策走這張圖來挑下一個概念。**記憶**是一個情節式 + 語意式的儲存（agentmemory 風格），存放過往互動、錯誤與偏好。

使用體驗是多模態的。打字答案用文字輸入。語音輸入透過 LiveKit + Whisper（沿用綜合專案 03）。數學題的照片輸入透過 dots.ocr 或 PaliGemma 2。語音輸出透過 Cartesia Sonic-2。安全性用 Llama Guard 4 加上一個年齡適切過濾器（擋掉成人內容、暴力、自傷），以及一套意識到 COPPA 的記憶保存政策。

那份成效研究就是交付物。10 位學習者、前測與後測、為期兩週。回報學習增益的差值與信賴區間。與一個非自適應基線（同樣內容以線性方式呈現、沒有家教政策）比較。

## 架構

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

- 科目選擇：K-12 代數或 Python 入門（挑一個做深）
- 家教政策：跑在 Claude Sonnet 4.7 上的 LangGraph（配提示詞快取）
- 學習者模型：貝氏知識追蹤（經典款），或用 FSRS 做間隔安排
- 課綱圖：存放概念 + 先備邊 + OER 內容的 Neo4j
- 記憶：agentmemory 風格的持久向量 + 情節式 + 語意式儲存
- 語音：LiveKit Agents 1.0 + Cartesia Sonic-2（沿用綜合專案 03 的子堆疊）
- 拍照數學：用 dots.ocr 或 PaliGemma 2 做方程式辨識
- 安全：Llama Guard 4 + 自訂的年齡適切過濾器
- 評估：Bloom 層級的題目生成、前後測框架、成效研究工具

```figure
cf-tutor-loop
```

## 動手建

1. **課綱圖。** 建一張含 50-150 個概念節點（例如 K-12 代數，從「數線」到「二次公式」）與先備邊的 Neo4j。替每個節點附上 OER 內容（Open Textbook、OpenStax）。

2. **學習者模型。** 用先驗初始化貝氏知識追蹤：猜對率、失手率、學習率。每次互動後更新逐概念的精熟度。逐學習者持久化。

3. **家教政策。** 帶這些節點的 LangGraph：`read_signal`（學習者的答案是對的／部分對的／卡住了？）、`select_concept`（走課綱圖挑出優先度最高的概念）、`scaffold`（蘇格拉底式提示）、`update_mastery`。

4. **記憶。** 每次互動都寫進情節式儲存。錯誤與偏好會晉升到語意記憶。意識到 COPPA 的保存政策：一年後自動刪除、家長可存取。

5. **語音路徑。** 一個接到家教政策上的 LiveKit Agents 工作者。ASR 用 Whisper-v3-turbo。TTS 用 Cartesia Sonic-2。支援插話（沿用綜合專案 03 的機制）。

6. **拍照數學路徑。** 上傳或拍攝影像；跑 dots.ocr 或 PaliGemma 2 辨識方程式；把它當成結構化輸入餵給家教。

7. **安全。** 每一份模型輸出都通過 Llama Guard 4 + 一個年齡適切過濾器（擋掉自傷、成人內容、暴力）。記憶存取以學習者 ID 收窄範圍；提供家長端的刪除介面。

8. **成效研究。** 10 位學習者、前測（一份標準化的 30 題基線）、兩週的家教互動（每週 3 次）、後測。與另外 10 位學習者、跑同樣內容的非自適應基線群體比較。

9. **每週進度報告。** 逐學習者自動產出一份 PDF 摘要，含探索過的主題、精熟度軌跡，以及建議的下一步。

## 動手用

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

## 產出交付

`outputs/skill-ai-tutor.md` 就是那份交付物。一位主題專屬的自適應家教，帶多模態輸入、學習者模型、記憶、安全，以及量測過的成效。

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | 學習增益差值 | 10 位學習者、為期兩週研究中的前後測差值 |
| 20 | 蘇格拉底式的忠實度 | 對逐字稿樣本的評分準則分數 |
| 20 | 多模態使用體驗 | 語音 + 拍照 + 文字端到端的一致性 |
| 20 | 安全與隱私姿態 | Llama Guard 4 通過率 + 意識到 COPPA 的保存政策 |
| 15 | 課綱廣度與圖的品質 | 概念涵蓋率 + 先備關係圖的一致性 |
| **100** | | |

## 練習

1. 在有與沒有自適應學習者模型（概念順序隨機）的情況下各跑一次成效研究。回報差值。預期自適應會贏，但那個幅度才是有趣的數字。

2. 加上一項多模態探測：同一個概念問題分別以文字、語音與照片呈現。量測學習者是否在他們偏好的模態下收斂得更快。

3. 建一個家長儀表板：練習過的主題、精熟度軌跡、即將學到的概念、安全事件（任何護欄觸發）。符合 COPPA。

4. 加上一種語言切換模式：家教接受西班牙文輸入並以西班牙文教學。量測 X-Guard 的涵蓋率。

5. 對記憶隱私施壓：驗證學習者 A 就算透過語音片段重新攝取的攻擊，也看不到學習者 B 的資料。記錄那次嘗試存取並發警報。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| 蘇格拉底式政策 | 「要問，不要倒答案」 | 家教問一個引導性問題，而不是直接給答案 |
| 貝氏知識追蹤 | 「BKT」 | 替每個概念算精熟機率的經典學習者模型方程式 |
| FSRS | 「自由間隔重複排程器」 | 2024 年的間隔重複排程器，比 SM-2 更好 |
| 課綱圖 | 「概念 DAG」 | 存放概念與先備邊的 Neo4j |
| 情節式記憶 | 「逐互動的日誌」 | 每一次互動都存起來供日後檢索 |
| 語意式記憶 | 「已學樣式的儲存」 | 從情節式晉升上來、經壓縮的錯誤與偏好 |
| COPPA | 「兒童隱私法」 | 限制蒐集 13 歲以下兒童資料的美國法律 |

## 延伸閱讀

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) —— 消費性 K-12 家教的參考
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) —— 語言學習家教的參考
- [Google LearnLM / Gemini for Education](https://blog.google/products-and-platforms/products/education/google-learnlm-gemini-generative-ai/) —— 託管式的參考模型
- [Quizlet Q-Chat](https://quizlet.com) —— 另一個參考
- [Synthesis Tutor](https://www.synthesis.com) —— 新創的參考
- [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) —— 間隔重複排程器
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) —— 學習者模型的經典
- [LiveKit Agents](https://github.com/livekit/agents) —— 語音堆疊
