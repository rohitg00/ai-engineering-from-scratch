# 前沿安全框架——RSP、PF 與 FSF（Frontier Safety Frameworks — RSP, PF, FSF）

> 全球三大頂尖實驗室的安全治理框架，共同定義了 2026 年前沿模型能力的產業治理規範。Anthropic《負責任擴展政策 v3.0》（RSP，2026 年 2 月）借鑑生物安全等級標準，引入了分級的 AI 安全等級體系（ASL-1 至 ASL-5+），其中針對涉及 CBRN（化學、生物、放射性、核子）危險能力的 ASL-3 已於 2025 年 5 月正式觸發啟動。OpenAI《防備框架 v2》（Preparedness Framework, PF，2025 年 4 月）確立了納入重點追蹤能力的五大嚴苛準則，並在治理層面嚴格分離「能力報告」與「防護措施報告」。Google DeepMind《前沿安全框架 v3.0》（FSF，2025 年 9 月）劃定了各領域的臨界能力等級（CCL），並在 v3.0 中全新增設了「有害操縱（Harmful Manipulation）」CCL。三大實驗室如今皆已正式引入了「競爭對手調整條款（Competitor-adjustment clauses）」，允許在同行未實施對等防護便冒進發布時彈性順延自身的安全約束。跨實驗室的治理共識在架構上高度一致，僅在名詞術語上略有差異：Anthropic 的「能力閾值（Capability Thresholds）」、OpenAI 的「高能力閾值（High Capability thresholds）」以及 DeepMind 的「臨界能力等級（Critical Capability Levels）」指的是相似的概念。

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 07-09 (deception failures)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 深入描述 Anthropic 的 ASL 分級階梯結構，以及觸發啟動 ASL-3 安全防護的具體條件。
- 列出 OpenAI《防備框架 v2》中判定一項危險能力是否納入重點追蹤的五大關鍵準則。
- 掌握 DeepMind 的臨界能力等級（CCL）架構，並闡明 v3.0 全新增設的「有害操縱」CCL 的實質內涵。
- 深刻剖析各框架中引入的「競爭對手調整條款」，並解釋其為何會影響競賽動態。
- 定義安全論證（Safety case），並掌握其三大支柱結構（監控、不可解讀性、無能力）。

## The Problem｜問題

第 07 至 17 節的研究顯示，欺騙是可能的、軍民兩用能力存在，而且評估有所限制。一個擁有前沿能力模型的實驗室，需要一套內部治理架構，用以明確界定：
- 定義何種能力閾值會要求新增防護措施。
- 定義擴展之前所需的評測。
- 一份「安全論證（Safety Case）」應當包含哪些要素？
- 處理競爭動態問題：若競爭對手未採取防護措施便發布，該怎麼辦？

這三套 2025 至 2026 年框架代表目前的技術水準——它們並不完美且仍在演進，但各實驗室間的對齊程度已足以讓治理問題轉為框架是否足夠，而非它們是否存在。

## The Concept｜核心概念

### Anthropic《負責任擴展政策 v3.0》（2026 年 2 月）（Anthropic Responsible Scaling Policy v3.0 (February 2026)）

ASL（AI Safety Level）階梯架構：
- **ASL-1**：非前沿模型（納入弱於前沿基準模型的範圍）。
- **ASL-2**：當前前沿基礎線；遵循常規安全流程即可交付發布。
- **ASL-3**：引發災難性濫用的風險顯著攀升；具備實質性的 CBRN 賦能能力。已於 2025 年 5 月正式宣告觸發啟動。
- **ASL-4**：跨越「AI R&D-2」能力閾值；模型能自動化入門級 AI 研究。
- **ASL-5+**：進階 AI 研發；模型能大幅加速有效規模擴展。

v3.0 版本的重大突破：
- 引入「前沿安全路線圖（Frontier Safety Roadmaps）」（以脫敏形式向全球公眾發布）。
- 發布每季度風險報告（Risk Reports，部分報告會接受外部審查）。
- 將 AI 研發能力細緻解耦為「AI R&D-2」與「AI R&D-4」兩個獨立里程碑。
- 一旦跨越「AI R&D-4」，就必須提出**肯定性的安全論證（affirmative safety case）**，以辨識模型追求不對齊目標所帶來的風險。

### OpenAI《防備框架 v2》（2025 年 4 月 15 日）（OpenAI Preparedness Framework v2 (April 15, 2025)）

納入重點追蹤危險能力的五大審核準則：
- **具備合理可行性（Plausible）**：存在合理的威脅模型。
- **具備可測量性（Measurable）**：可以進行實證評估。
- **危害後果嚴重（Severe）**：傷害程度重大。
- **屬於全新增量（Net-new）**：不是既有風險的擴大。
- **具備瞬間爆發性或不可逆性（Instantaneous-or-irremediable）**：傷害發生迅速或無法挽回。

同時符合這五項條件的能力會被追蹤；其他能力則不追蹤。

PF v2 版本的其他核心治理架構：
- 將「能力報告（Capabilities Reports，評估模型能做到什麼）」與「防護措施報告（Safeguards Reports，評估有哪些控制措施）」分開。
- 由安全諮詢小組（Safety Advisory Group）審查。
- 由公司領導層批准；董事會下設的「安全與防護委員會」負責監督。
- **「競爭調整條款（Adjustment clause）」**：若另一家實驗室在未採取可比防護措施的情況下發布，OpenAI 可能降低要求。

### Google DeepMind《前沿安全框架 v3.0》（2025 年 9 月）（DeepMind Frontier Safety Framework v3.0 (September 2025)）

依據垂直領域劃定的臨界能力等級（Critical Capability Levels, CCLs）：
- 生物武器賦能臨界線（Bioweapon Uplift CCL）
- 網路提升幅臨界線（Cyber Uplift CCL）
- 機器學習自主研發加速臨界線（ML R&D Acceleration CCL）
- **有害操縱臨界線（Harmful Manipulation CCL，v3.0 全新增設）**：涵蓋可能在高風險情境中實質改變信念或行為的模型。

2025 年 2 月發布的 v2.0 版本已先行引入了欺騙性對齊專章，並為 ML R&D 臨界能力等級提高了安全等級。

### 跨實驗室架構對齊與術語收斂（Cross-lab alignment）

- Anthropic 稱之為「能力閾值（Capability Thresholds）」。
- DeepMind 稱之為「臨界能力等級（Critical Capability Levels, CCLs）」。
- OpenAI 稱之為「高能力閾值（High Capability thresholds）」。

產業界尚未統一術語。在架構上，三者對齊：皆將前沿能力分為三個層級，並公布評估準則；自 2025 年起，三者都納入競爭對手調整條款。

### 安全論證架構（Safety cases）

安全論證是一份書面論證，用以說明在最壞情況假設下，某款模型的部署仍具可接受的安全性。標準的現代安全論證必須立足於三大支柱：

- **監控支柱（Monitoring）**：能否偵測到發生的不良行為？
- **不可解讀性支柱（Illegibility）**：模型是否缺乏執行連貫有害計畫的能力？
- **無能力支柱（Incapability）**：模型是否缺乏造成相關傷害的能力？

不同類型的風險分別主攻不同的支柱。對於 ASL-3 的 CBRN 安全論證，無能力（以機器遺忘作為主要手段）是第一核心支柱；對於欺騙性對齊，監控與不可解讀性論證是主攻方向；而對於網路能力提升，三大支柱都相關。

### 競賽博弈困境與競爭對手調整條款（The race-dynamic problem）

競爭對手調整條款引發了全球安全學界的劇烈爭議。批評者認為該條款會造成「逐底競爭（Race to the bottom）」：若三家實驗室都會在競爭對手背離時降低要求，均衡便會向背離移動。辯護者則認為，若一方單方面採取防護，而背離的一方對安全較不重視，結果會更糟。

英國 AI 安全研究所（UK AISI）、美國 CAISI 以及歐盟 AI 辦公室（第 24 節）是外部治理對應方。實驗室框架屬於自願性；監管框架則正在形成。

### 該研究在第 18 階段中的宏觀座標

第 17 至 18 節是在欺騙與紅隊分析之上的測量與治理層。第 19 至 24 節涵蓋模型福祉、偏見、隱私、浮水印與監管架構。第 28 節則介紹執行評測的研究生態系（MATS、Redwood、Apollo、METR）。

```figure
al-asl-ladder
```

## Use It｜實際應用

本課不設具體程式碼。讀者應當端到端精讀三大一手文獻原文：Anthropic RSP v3.0、OpenAI PF v2 與 DeepMind FSF v3.0。動手繪製一張跨實驗室的橫向對照映射表，精確標註出每一家實驗室所定義的、但另外兩家尚未涵蓋的獨特安全閾值。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-framework-diff.md`。輸入任何一份全新的企業前沿安全政策或模型發布說明書，該 Skill 將自動將其各項閾值定義、必備安全評測項目以及安全論證結構，逐項對齊映射至 RSP v3.0、PF v2 與 FSF v3.0 的標準範式，並標示其中的跨框架缺口。

## Exercises｜練習

1. 精讀 RSP v3.0、PF v2 與 FSF v3.0 原文。整理出一份表格，橫向對比三大實驗室各自對 CBRN 威脅的觸發閾值、對 AI 自主研發加速的認定標準，以及在正式部署前強制要求的具體評測項目。
2. 競爭對手調整條款如今普遍存在於三大框架之中。撰寫一段短文論證支持該條款的合理性；隨後再撰寫一段短文論證其潛在危害。明確指出這兩種針鋒相對的立場各自依賴了何種底層核心假設。
3. 為一款跨越 Anthropic「AI R&D-4」閾值的模型設計一份安全論證大綱。明確列出其三大支柱（監控、不可解讀性、無能力）各自所需的實體佐證材料。
4. DeepMind 在 FSF v3.0 中全新增設了「有害操縱（Harmful Manipulation）」臨界能力等級。試提出三項可客觀量化的實證度量指標，用以判定某款前沿模型是否已實質跨越了該項危險紅線。
5. 研讀 METR 的《前沿 AI 安全政策的共通要素》（2025 年）。列出當前全球前沿實驗室在治理體系上達成的三大最強共識，以及分歧最大的兩處核心爭議。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| RSP | 「Anthropic 的框架」 | Responsible Scaling Policy；ASL 分級；2026 年 2 月版 v3.0 |
| PF | 「OpenAI 的框架」 | Preparedness Framework；五項準則；2025 年 4 月版 v2 |
| FSF | 「DeepMind 的框架」 | Frontier Safety Framework；CCL；2025 年 9 月版 v3.0 |
| ASL-3 | 「類似生物安全第 3 級」 | Anthropic 對應 CBRN 相關能力的級別；於 2025 年 5 月啟用 |
| CCL | 「臨界能力等級」 | DeepMind 的閾值概念，依領域劃分 |
| Safety case | 「正式論證」 | 在最壞情況假設下，說明部署安全性可接受的書面論證 |
| Adjustment clause | 「允許因競爭對手變更政策」 | 若競爭對手在未採取可比防護措施下發布模型，框架可據此降低要求 |

## Further Reading｜延伸閱讀

- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) — ASL 階梯體系、安全路線圖與 AI 研發解耦。
- [OpenAI — Updating the Preparedness Framework (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) — 五大追蹤準則與競爭調整條款。
- [DeepMind — Strengthening our Frontier Safety Framework (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — CCL v3.0 架構與有害操縱紅線。
- [METR — Common Elements of Frontier AI Safety Policies (2025)](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — 跨實驗室前沿政策橫向深度評析。
