# 對齊科研生態系——MATS、Redwood、Apollo、METR（Alignment Research Ecosystem — MATS, Redwood, Apollo, METR）

> 五個機構構成了 2026 年非實驗室端（Non-lab）的 AI 對齊研究生態。**MATS（機器學習對齊與理論學者計畫）**：自 2021 年底以來已有 527 名以上研究者，發表 180 篇以上學術論文，總引用量突破 1 萬次，h-index 達到 47；2024 年夏季正式註冊為美國 501(c)(3) 非營利組織，單屆擁有約 90 名學者與 40 位導師；2025 年前的校友中有 80% 從事安全與資安工作，200 多人遍布於 Anthropic、DeepMind、OpenAI、英國 AISI、蘭德智庫（RAND）、Redwood、METR 與 Apollo。**Redwood Research**：由 Buck Shlegeris 創立的應用對齊實驗室；提出 AI Control（第 10 課）研究議程；持續與英國 AISI 聯合推進控制安全論證。**Apollo Research**：專門為前沿實驗室提供上線前謀劃行為評測；撰寫了《In-Context Scheming》（第 8 課）與《Towards Safety Cases for AI Scheming》。**METR（模型評估與威脅研究機構）**：專精於基於任務的能力評測與自主任務時間跨度研究；其《前沿 AI 安全政策的共通要素》是橫向對比各大實驗室治理框架的文獻。**Eleos AI Research**：專精於模型福祉的上線前評估（第 19 課）；完成了 Claude Opus 4 的模型福祉評估。

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 01-27 (prior Phase 18 lessons)
**Time:** ~45 minutes

## Learning Objectives｜學習目標

- 梳理實驗室外對齊研究生態系中的五個組織及其核心產出。
- 描述 MATS 的規模（研究者、論文、h-index）及其作為人才培育途徑的角色。
- 描述 Redwood Research 的 AI Control 議程及其與英國 AISI 的合作關係。
- 說明 METR 的任務型能力評估方法，以及自主任務時間跨度研究。

## The Problem｜問題

前沿實驗室（第 18 課）在內部進行安全評估，並選擇性公布結果。實驗室外的生態系統可驗證這些評估、首先發現新的失效模式，並培育人才。了解這個生態系統，有助於理解哪些研究發現受到哪些人的信任。

## The Concept｜核心概念

### MATS（機器學習對齊與理論學者計畫）

於 2021 年底發起。這是一項研究導師計畫：學者與資深研究者針對特定對齊問題合作 10 至 12 週。

2026 年最新量化規模：
- 自成立以來有 527 名以上研究人員。
- 發表 180 篇以上論文。
- 累計學術引用量突破 1 萬次大關。
- MATS 的 h-index 為 47。
- 2024 年夏季：單期匯聚 90 名學者與 40 位導師；正式法人化為 501(c)(3) 非營利實體。

人才走向：2025 年前畢業的校友中，約 80% 從事 AI 安全或資安相關工作。200 多名校友目前在 Anthropic、DeepMind、OpenAI、英國 AISI、RAND、Redwood、METR 與 Apollo。

### Redwood Research

應用對齊實驗室，由 Buck Shlegeris 創立。提出 AI Control 議程（第 10 課），與英國 AISI 合作研究控制安全論證，並就 DeepMind 與 Anthropic 的評估設計提供建議。

標誌性論文：Greenblatt、Shlegeris 等人的《AI Control》（arXiv:2312.06942，ICML 2024）；與 Anthropic 聯合發表的《Alignment Faking》（Greenblatt、Denison、Wright 等人，arXiv:2412.14093）。

研究風格：明確的威脅模型、最壞情況的對手，以及可進行壓力測試的具體協定。

### Apollo Research

為前沿實驗室提供部署前的謀劃行為評估。撰寫了《In-Context Scheming》（第 8 課，arXiv:2412.04984）。2025 年參與與 OpenAI 合作的反謀劃訓練。發布了《Towards Safety Cases for AI Scheming》（2024 年）。

科研風格：在可能出現欺騙的 agent 情境中進行評估；以三支柱分解謀劃行為（目標背離、目標導向性、情境感知）。

### METR（模型評估與威脅研究機構）

以任務為基礎進行能力評估。研究自主任務完成所需的時間跨度（time horizon）。其發布的《前沿 AI 安全政策的共通要素》（metr.org/common-elements，2025 年）比較各實驗室的框架。

與 Apollo 聯合起草了 AI 謀劃安全論證架構草案。

科研風格：長程複雜任務評測、實證能力邊界度量、跨機構治理框架綜合提煉。

### Eleos AI Research

專精於模型福祉（Model Welfare）的部署前評估。進行了 Claude Opus 4 的模型福祉評估，相關內容記錄於系統卡第 5.3 節。為第 19 課與福祉相關的主張提供外部方法論檢查。

### 全球對齊人才與智力流向閉環

MATS 培訓研究人員。畢業生加入 Anthropic、DeepMind、OpenAI 的實驗室安全團隊，或加入 Redwood、Apollo、METR、Eleos 等外部評估機構。外部評估者與各實驗室及 UK AISI／CAISI 合作。研究成果回饋至生態系統，供 MATS 培訓下一屆研究人員。

### 為何這層非實驗室機構至關重要

單一來源的評估並不可靠：實驗室在評估自家模型時存在結構性利益衝突。外部評估者能提出並驗證實驗室可能低報的失效模式。2024 年的《Sleeper Agents》（第 7 課）由 Anthropic 與 Redwood 合作；《Alignment Faking》（第 9 課）也由兩者合作；《In-Context Scheming》（第 8 課）由 Apollo 撰寫；反謀劃訓練由 Apollo 與 OpenAI 合作。多機構架構提供品質控管。

### 該研究在第 18 階段中的宏觀座標

第 7 至 11 課引用 Redwood 與 Apollo 的研究；第 18 課引用 METR 的框架比較；第 19 課引用 Eleos。第 28 課明確整理本階段其他課程所依據的研究生態系組織。

```figure
sae-features
```

## Use It｜實際應用

本課不設程式碼。閱讀 METR 的《前沿 AI 安全政策的共通要素》（Common Elements of Frontier AI Safety Policies），了解外部綜整如何為實驗室內部的政策工作增添價值。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-ecosystem-map.md`。輸入一項對齊主張或評估，該 Skill 將辨識其所屬組織、發表刊物與方法論風格，並與已知的對應組織交叉查核。

## Exercises｜練習

1. 從第 7 至 15 課中任選一篇論文，辨識其中涉及的組織。交叉核對作者是否為 MATS 校友，以及其目前在生態系中的所屬機構。
2. 研讀 METR 的《前沿 AI 安全政策的共通要素》白皮書。列出其著重強調的三大跨實驗室治理共識，以及分歧最大的兩處核心領域。
3. MATS 校友中約有 80% 從事 AI 安全或資安相關工作。討論這種人才選擇壓力是良性調適（培育這個領域），還是偏誤（篩除非主流觀點）。
4. Redwood 與 Apollo 皆長期深耕於控制與謀劃研究，但兩者的工程風格大相徑庭。挑選一項具體的安全失效模式，具體描述這兩家機構會分別採取何種不同的方法論路徑展開排查。
5. Eleos AI 是唯一純粹專注於模型福祉的組織。構思第二個聚焦於不同福祉相關問題（如模型認知自由、機器人具身性）的組織，並撰寫其核心研究方法論大綱。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| MATS | 「研究導師計畫」 | ML Alignment & Theory Scholars；自 2021 年以來培養 527 位以上研究者 |
| Redwood Research | 「控制研究機構」 | 應用對齊研究；AI Control 論文作者；UK AISI 合作夥伴 |
| Apollo Research | 「謀劃評測機構」 | 為前沿實驗室進行部署前謀劃評測 |
| METR | 「任務時間範圍評測機構」 | 以任務為基礎的能力評估與框架綜整 |
| Eleos AI | 「福祉研究機構」 | 部署前的模型福祉評估 |
| Talent pipeline | 「MATS 到實驗室的人才流向」 | MATS 畢業生進入 Anthropic、DM、OpenAI、Redwood、Apollo 與 METR |
| External evaluation | 「實驗室外的檢查」 | 非模型製造者執行的評估，可增加可信度 |

## Further Reading｜延伸閱讀

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) — 全球頂級對齊學者培養計畫官方主頁。
- [Redwood Research](https://www.redwoodresearch.org/) — 應用對齊與 AI 控制研究實驗室。
- [Apollo Research](https://www.apolloresearch.ai/) — 謀劃行為評測機構。
- [METR — Common Elements of Frontier AI Safety Policies](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — 跨大廠前沿政策綜合評析。
- [Eleos AI Research](https://www.eleosai.org/research) — 模型福祉評估方法論手冊。
