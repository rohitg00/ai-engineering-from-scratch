# AI SRE 架構——多 Agent 事故響應、維運手冊與預測性偵測（SRE for AI — Multi-Agent Incident Response, Runbooks, Predictive Detection）

> AI SRE 透過 RAG 以基礎架構資料（記錄、runbook、服務拓撲）為 LLM 提供依據，自動化調查、文件記錄與協調階段。2026 年的架構模式是多 Agent 編排——專門處理記錄、指標、runbook 的 agent 由 supervisor 協調；AI 提出假說與查詢，人類批准需要判斷的決策。Datadog Bits AI 與 Azure SRE Agent 以託管產品形式提供。Runbook 維運手冊亦在深刻演進：NeuBird Hawkeye 引入了對抗式雙模型交叉評估（兩個獨立模型分析同一起事故；意見一致 = 高信心，意見分歧 = 存在不確定性需升級審批）；系統維運組織記憶可跨越人員離職交接而持久留存。自動自癒（Auto-remediation）依然嚴格維持審慎原則：AI 負責給出建議，人類最終簽字授權。完全自主的閉環操作被嚴格限制在極狹窄的安全集合中（重啟 Pod、回滾特定部署），並受限於硬性防護欄——任何向你兜售「完全放手全自動維運」的廠商皆屬於過度誇大。新興技術前沿：事故前預測性偵測。MIT 2025 年研究指出，基於歷史記錄、GPU 溫度時序與 API 錯誤特徵專門訓練的 LLM，能在正式事故爆發前 10 至 15 分鐘精確預警 89% 的雲端中斷。預測到 2026 年底，95% 的企業級 LLM 將具備自動容錯移轉能力。

**Type:** Learn
**Languages:** Python (stdlib, toy multi-agent incident triage simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 24 (Chaos Engineering)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 精確繪製多 Agent AI SRE 協同架構圖：Supervisor 統籌者 + 專職 Agent（記錄、指標、維運手冊） + 人在迴圈中（HITL）審批閘門。
- 深刻解釋為何自動自癒必須嚴格限制在狹窄的安全原子操作（重啟 Pod、回滾部署），絕不可賦予其寬泛的系統重構權限。
- 掌握對抗式交叉評估設計模式（NeuBird Hawkeye）：雙模型獨立推導、結論一致代表信心較高、結論分歧立即升級人工介入。
- 引用 MIT 89% 事故前早期預警的研究結論，並直面殘酷的工程約束：缺乏自動執行機制的純預測，本質上只是一面會叫的監控儀表板。

## The Problem｜問題

值班工程師凌晨 3 點收到值班通知：「結帳服務錯誤率偏高。」他查看 Datadog、Loki 記錄、三份維運手冊與部署記錄。30 分鐘後，他發現事故根因是 vLLM 因 KV 快取暴增而發生 OOM。他重啟 Pod，錯誤消退。

在 2026 年，這項調查的前 20 分鐘可以自動化。依服務分組記錄、與近期部署建立關聯、比對 runbook——這些都可透過 RAG + 工具使用完成。受監督的 agent 可以進行首輪分流，並在人類打開 Datadog 前提出假說。

然而完全自主的自動自癒則是另一場嚴肅的硬仗。重啟 Pod：安全。依據策略動態擴展 GPU 資源池：安全可控。讓 AI 自行修改微服務架構程式碼：絕對禁止。這門學科的真正功力，在於精準劃定那條絕不可踰越的安全狹窄邊界。

## The Concept｜核心概念

### 多 Agent 協同架構（Multi-agent architecture）

```
          Incident
             │
             ▼
        Supervisor
        /    |    \
       ▼     ▼     ▼
  Log agent  Metric agent  Runbook agent
       │     │     │
       └─────┴─────┘
             │
             ▼
        Hypothesis + evidence
             │
             ▼
        Human approval
             │
             ▼
        Action (narrow set)
```

Supervisor 將事故拆成子查詢。專門的 agent 可使用工具（記錄搜尋、PromQL、文件檢索）。Supervisor 綜整結果，向人類呈現假說與證據。人類可以批准或重新指引。

### 自動自癒的受限範圍（Auto-remediation scope）

**安全操作集合（狹窄受控）**：重啟特定 Pod、回滾特定部署、在預先批准的硬性配額內動態彈性擴縮 GPU 節點池、啟用預先核准的 Feature Flag。

**危險操作集合（寬泛高危，堅決禁止）**：擅自變更微服務拓撲架構、修改資源限制、部署新程式碼、擅自修改 IAM 權限角色、變更資料庫。

任何宣稱「配置完成即可徹底高枕無憂全自動維運」的供應商都是言過其實。隨著 AI SRE 的持續演進，安全集合的邊界會逐步拓展，但安全邊界確實存在。

### 對抗式交叉驗證（NeuBird Hawkeye）（Adversarial evaluation (NeuBird Hawkeye)）

兩個模型獨立分析同一事故。如果它們對根因一致，信心就高；如果意見不一致，則將兩種假說呈現給人類並升級處理。這種簡單模式可有效過濾幻覺根因。

### 維運組織記憶（Operational memory）

人員頻繁流動是傳統企業 SRE 體系的隱形殺手——隨著核心資深工程師離職，大量實戰經驗也隨之煙消雲散。AI SRE 會將維運手冊與事後檢討報告（Post-mortems）存入向量資料庫；Agent 會在每起新事故中檢索歷史經驗。新進工程師加入時，AI 也能查閱團隊累積的歷史紀錄。

### 事故前預測性偵測（Pre-incident prediction）

MIT 2025 年研究：針對歷史系統記錄、實體 GPU 晶片溫度時序曲線與 API 錯誤分佈特徵進行深度學習訓練的 LLM，在測試集中提前 10 至 15 分鐘預測了 89% 的服務中斷。

冷靜的工程審視：缺乏自動執行機制的純預測，充其量只是一面儀表板。真正的維運挑戰在於「一旦模型給出預測，系統該採取何種具體動作？」提前排空流量？呼叫值班工程師？自動彈性擴容？答案取決於政策。

### 2026 年主流商用產品矩陣（Products in 2026）

- **Datadog Bits AI**——Datadog 內的託管式 SRE Copilot。
- **Azure SRE Agent**——Azure 原生 agent。
- **NeuBird Hawkeye**——對抗式評估與維運記憶。
- **PagerDuty AIOps**——警報分流與去重。
- **Incident.io Autopilot**——提供事故指揮與協調。

### 維運手冊即程式碼（Runbooks as code）

維運手冊正在經歷從非結構化的 Confluence 雜亂文章向版本受控的結構化 Markdown 演進。標準的現代 Runbook 包含標準章節：故障現象（Symptom）、根因假說（Hypothesis）、驗證指令（Verify）、標準處方（Act）。結構化的維運手冊有助於改善 RAG 檢索。開始導入 AI SRE 時，先將雜亂無章的手冊重構為結構化文件。

### 務必銘記的核心數字指標（Numbers you should remember）

- MIT 事故預警模型：在測試集中提前 10 至 15 分鐘預測了 89% 的服務中斷。
- 多 Agent 事故響應標準架構：Supervisor 統籌者 + (記錄、指標、手冊專職 Agent) + 人類審核閘門。
- 允許自動自癒的安全操作範疇：重啟 Pod、回滾特定部署、在預先核准範圍內自動擴縮。
- 對抗式交叉驗證模式：雙模型背靠背獨立推導；結論一致 = 高信心。

```figure
i4-incident-agents
```

## Use It｜實際應用

`code/main.py` 模擬了一套多 Agent 事故會診流程：記錄 Agent 發現錯誤、指標 Agent 捕捉到 CPU 暴增軌跡、手冊 Agent 精準匹配至歷史已知事故處方。Supervisor 統籌各方證據，為假說排序。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-ai-sre-plan.md`。根據目前的值班安排、事故量與團隊成熟度，該 Skill 規劃 AI SRE 的導入。

## Exercises｜練習

1. 執行 `code/main.py`。若記錄 Agent 與指標 Agent 針對根因產生了嚴重衝突，Supervisor 應當透過何種決策邏輯進行裁決？
2. 為你自身的業務微服務定義三項「保證安全可控」的自動自癒操作。立足於系統架構給出嚴密論證。
3. 撰寫一份標準的結構化 Runbook 模板：列出必填的中繼資料欄位、排查驗證指令宣告與處方動作規範。
4. 預測性偵測演算法在正式事故爆發前 12 分鐘精準亮起紅燈。你的團隊應當制定何種處置策略——直接呼叫值班工程師、自動預排空流量，還是兩者同步觸發？
5. 深入辯論一個僅有 3 位研發人員的微型新創團隊在 2026 年究竟應當立即導入 AI SRE 還是繼續保持手動？從業務成熟度、警報量級與潛在風險展開全方位評析。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| AI SRE | 「值班 agent」 | 以 LLM 支援的事故調查與協調 |
| Supervisor agent | 「統籌者」 | 將事故拆成子查詢的頂層 agent |
| Specialized agent | 「領域 agent」 | 可使用記錄、指標與 runbook 工具的子 agent |
| Auto-remediation | 「AI 自動修復」 | 預先核准的狹窄操作，不包含廣泛重新設計 |
| Operational memory | 「向量 runbook」 | 存入向量資料庫供 RAG 使用的事故檢討與 runbook |
| Adversarial eval | 「雙模型檢查」 | 獨立分析；結論一致代表信心較高 |
| NeuBird Hawkeye | 「對抗式評估工具」 | 採用對抗式評估與記憶模式的產品 |
| Bits AI | 「Datadog 的 SRE agent」 | Datadog 託管的 AI SRE |
| Pre-incident prediction | 「提早偵測」 | 提前 10 至 15 分鐘預測服務中斷 |

## Further Reading｜延伸閱讀

- [incident.io — AI SRE Complete Guide 2026](https://incident.io/blog/what-is-ai-sre-complete-guide-2026)
- [InfoQ — Human-Centred AI for SRE](https://www.infoq.com/news/2026/01/opsworker-ai-sre/)
- [DZone — AI in SRE 2026](https://dzone.com/articles/ai-in-sre-whats-actually-coming-in-2026)
- [Datadog Bits AI](https://www.datadoghq.com/product/bits-ai/)
- [NeuBird Hawkeye](https://www.neubird.ai/)
- [awesome-ai-sre](https://github.com/agamm/awesome-ai-sre)
