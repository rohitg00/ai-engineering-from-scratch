# 合規框架——SOC 2、HIPAA、GDPR、PCI-DSS、歐盟 AI 法案、ISO 42001（Compliance — SOC 2, HIPAA, GDPR, PCI-DSS, EU AI Act, ISO 42001）

> 覆蓋多套合規框架是 2026 年敲定任何企業級大單的必備入場券。**歐盟 AI 法案（EU AI Act）**：自 2024 年 8 月 1 日起正式生效。絕大多數高風險系統的合規要求將於 2026 年 8 月 2 日強制執行。違背高風險系統法定義務最高可處以 1,500 萬歐元或全球年度營業額 3% 的巨額罰鍰（第 99(4) 條）；運作違禁 AI 行為的罰鍰上限更是高達 3,500 萬歐元或 7%（第 99(3) 條）。只要為歐盟境內使用者提供服務，即具有全球管轄效力。**科羅拉多州 AI 法案（Colorado AI Act）**：於 2026 年 6 月 30 日正式施行（經 SB25B-004 修正案自原定 2026 年 2 月順延）——強制要求對高風險系統實施演算法影響評估，並賦予使用者對 AI 裁決提出申訴抗辯的法定權利。維吉尼亞州亦在信用、就業、居住與教育領域落實了類似規範。**SOC 2 Type II**：B2B AI 產品的事實標準門檻（金融科技領域的業界慣例是 Type II，而非 Type I）。**GDPR**：目前有據可查的最大一筆 AI 專屬罰單是荷蘭資料保護局（DPA）於 2024 年 9 月對 Clearview AI 開出的 3,050 萬歐元；義大利 Garante 亦曾於 2024 年 12 月對 OpenAI 祭出 1,500 萬歐元罰鍰（後於 2026 年 3 月經上訴被撤銷裁決，目前仍待進一步審查）。在推論執行時期進行**即時 PII 脫敏**是較站得住腳的作法；事後補救清理在稽核時根本站不住腳。**HIPAA**：美國醫療鐵律——在未簽署 BAA 商業夥伴協議之前，嚴禁向任何外部 AI 服務傳輸受保護健康資訊（PHI）。**PCI-DSS**：AI 互動層對支付資料的合規覆蓋需要嚴格的系統配置與商業合約，絕非自動達成。**ISO 42001**：新興的 AI 治理標準，正逐漸成為與 ISO 27001 並列的採購要求。業界標準範本：OpenAI 官方同時維持 SOC 2 Type 2、ISO/IEC 27001:2022、ISO/IEC 27701:2019、GDPR/CCPA/HIPAA (BAA)/FERPA，以及適用於 ChatGPT 支付元件的 PCI-DSS。落實跨框架控制項映射（Cross-framework mapping）能大幅減輕稽核疲勞：單一存取控制政策可同時映射並滿足 ISO 27001 A.5.15-5.18、GDPR 第 32 條以及 HIPAA §164.312(a) 的要求。

**Type:** Learn
**Languages:** (Python optional — compliance is policy + process, not code)
**Prerequisites:** Phase 17 · 25 (Security), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 梳理與 LLM 產品切身相關的七大 2026 年主流法規框架，並將各自精準映射至對應的目標客戶群體。
- 引用歐盟 AI 法案的法定執法時間表（2024 年 8 月生效；2026 年 8 月強制執行高風險要求）以及雙層罰鍰上限（高風險義務違反為 1,500 萬歐元 / 3%；違禁行為為 3,500 萬歐元 / 7%）。
- 說明為何事後清理 PII 不足以符合 GDPR 的要求，並說明推論層即時脫敏是較站得住腳的作法。
- 掌握跨框架控制項映射方法論（例如將單一存取控制項統一對齊 ISO 27001 A.5.15-5.18 + GDPR 第 32 條 + HIPAA §164.312(a)）。

## The Problem｜問題

某企業客戶的採購部門要求 SOC 2 Type II、GDPR、HIPAA BAA、ISO 27001，以及「EU AI Act 合規聲明」。你的團隊目前只有 SOC 2 Type I，距離完成 Type II 還有六個月，也尚未開始 GDPR 第 30 條所要求的紀錄。

多框架覆蓋並非 LLM 專屬問題，而是企業 SaaS 面臨的問題，LLM 另有特定要求。2026 年的採購團隊需要一張每列對應框架、每欄對應控制項的矩陣，而不是 PDF。

## The Concept｜核心概念

### 七大核心合規框架（The seven frameworks）

| 法規框架 | 適用範疇 | LLM 專屬合規要求 |
|-----------|-------|--------------------------|
| SOC 2 Type II | B2B SaaS 基礎門檻 | 流程控制項在 6 至 12 個月期間接受稽核 |
| HIPAA | 美國醫療保健領域 | 強制簽署 BAA；未簽協議前 PHI 絕對禁止流出內部基礎架構 |
| GDPR | 歐盟境內使用者 | 推論層即時 PII 脫敏；資料主體權利響應；第 30 條處理活動紀錄 |
| PCI-DSS | 信用卡與支付資料 | 針對接觸支付流程的 AI 互動層實施嚴格配置與合約約束 |
| 歐盟 AI 法案 | 為歐盟使用者提供服務 | 風險分級；高風險系統強制實施合格評定、全生命週期文件與記錄 |
| 科羅拉多州 AI 法案 | 服務科州居民 | 演算法影響評估；賦予使用者對 AI 裁決提出異議申訴的權利 |
| ISO 42001 | 全球 AI 人工智慧治理體系 | 2026 新興標準；通常與 ISO 27001 共同作為大型標案採購要求 |

### 歐盟 AI 法案落地時間表（EU AI Act timeline）

- 2024 年 8 月 1 日：法案正式生效。
- 2025 年 2 月 2 日：全面禁止運作各類不可接受風險（Prohibited AI practices）的違禁 AI。
- 2026 年 8 月 2 日：全面強制執行高風險 AI 系統（High-risk systems）的法定義務（合格評定、技術文件、記錄）。
- 2027 年 8 月：受歐盟協調法規管轄之產品內嵌的高風險系統全面強制合規。

風險金字塔分級：不可接受風險（完全取締）、高風險（合格評定與記錄）、有限風險（履行基礎透明度標註義務）、微小風險（無硬性約束）。絕大多數通用 B2B LLM 應用落在有限風險區間；涉及就業、信用、教育、執法、移民或必要服務的應用則屬於高風險系統。

罰鍰裁決標準（第 99 條）：違反高風險系統法定義務者，最高處以 1,500 萬歐元或全球年營業額 3% 的罰鍰（第 99(4) 條）；運作違禁 AI 行為者，最高處以 3,500 萬歐元或 7% 的罰鍰（第 99(3) 條）；以兩者中金額較高者為準。

### GDPR——即時脫敏是較可辯護的標準（GDPR — real-time redaction is the standard）

事後清理（在 LLM 看過 PII 後才遮罩）並非可辯護的作法——模型已經看過資料。即時推論層遮罩是 2026 年的標準：

- 在發起外部 LLM 網路呼叫之前，先完成實體辨識（NER）。
- 採用一致性 tokenization（如 Mesh 模式），既去識別化個資，又完整保留上下文語意。
- 僅儲存已脫敏的 prompts；原始資料只在使用者同意（opt-in）後儲存。

近年重磅執法判例：荷蘭資料保護局於 2024 年 9 月對 Clearview AI 重罰 3,050 萬歐元，創下迄今有據可查的最大一筆 AI 專屬 GDPR 罰單；義大利隱私監管機構 Garante 亦曾於 2024 年 12 月對 OpenAI 開出 1,500 萬歐元罰鍰（後於 2026 年 3 月經上訴成功撤銷原裁決，該案目前仍處於進一步司法審查中）。事後處理的主張曾在稽核中失敗。

### HIPAA——BAA 絕對不可或缺（HIPAA — BAA is not optional）

在未簽署具備法律約束力的商業夥伴協議（Business Associate Agreement, BAA）之前，絕對禁止將任何受保護健康資訊（PHI）發送給第三方 AI 服務。目前三大超大規模雲端平台（AWS Bedrock、Azure OpenAI、GCP Vertex AI）皆原生提供簽署 BAA 服務。OpenAI 官方直接 API 亦提供企業級 BAA。Anthropic 官方直接 API 同樣支援 BAA。在發送任何醫療資料之前，先確認 BAA 已簽署。

### SOC 2 Type II

Type I：控制項已經完成設計，並白紙黑字形成制度文件。
Type II：控制項在 6 至 12 個月期間有效運作。

B2B 採購在 2026 年以 Type II 為預設門檻。Type I 是起步；Type II 則是門檻。

常見的稽核重點：存取記錄（誰看了什麼）、變更管理（如何部署）、風險評估（每季進行）、事故應變（是否經過測試）。第 17 課第 25 節的不可篡改稽核記錄可直接重複使用。

### 跨框架控制項映射（Cross-framework mapping）

一條優秀的存取控制政策，在架構底層能同時滿足多套不同法規的要求：

| 實體控制項 | 同時滿足的法規條款 |
|---------|-----------|
| 存取權限記錄 | ISO 27001 A.5.15-5.18、GDPR 第 32 條、HIPAA §164.312(a) |
| 變更管理 | ISO 27001 A.8.32、PCI DSS 第 6 項、HIPAA 洩漏通知規範範疇 |
| 傳輸中資料全流程加密 | ISO 27001 A.8.24、GDPR 第 32 條、HIPAA §164.312(e) |
| 機密資訊管理 | ISO 27001 A.8.19、PCI DSS 第 8 項、SOC 2 CC6.1 |

合規工具（Drata、Vanta、Secureframe）會自動化這項映射。規模擴大時，值得付費使用。

### ISO 42001——嶄露頭角的新興標準（ISO 42001 — emerging）

於 2023 年底發布。這是 AI 治理框架，涵蓋風險管理、資料品質、透明度與人類監督。與 ISO 27001 並列的採購需求正在增加。

### OpenAI 的基準合規檔案（OpenAI's reference profile）

OpenAI 維護的參考檔案列有 SOC 2 Type 2、ISO/IEC 27001:2022、ISO/IEC 27701:2019、GDPR/CCPA/HIPAA（BAA）/FERPA，以及適用於 ChatGPT 支付元件的 PCI-DSS。這大致是 2026 年企業服務的基本門檻。

### 務必銘記的核心數字指標（Numbers you should remember）

- 歐盟 AI 法案罰鍰上限：違反高風險義務最高 1,500 萬歐元 / 3%（第 99(4) 條）；違禁行為最高 3,500 萬歐元 / 7%（第 99(3) 條）。
- 歐盟高風險 AI 系統執法啟動日：2026 年 8 月 2 日。
- 有史以來最大一筆 AI 專屬 GDPR 罰單：荷蘭對 Clearview AI 處以 3,050 萬歐元（2024 年 9 月）。
- 史上最大 LLM GDPR 罰單案：義大利對 OpenAI 處以 1,500 萬歐元（2024 年 12 月開出，2026 年 3 月上訴撤銷，但仍待進一步審查）。
- SOC 2 Type II 審查觀察期：必須完整覆蓋 6 至 12 個月的連續運作記錄。
- 科羅拉多州 AI 法案施行日：2026 年 6 月 30 日（經 SB25B-004 修正延期）。

```figure
i4-control-matrix
```

## Use It｜實際應用

`code/main.py` 是以 Python 製作的合規映射表；輸入控制項後，會列出它符合的框架。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-compliance-matrix.md`。輸入目標企業客戶的行業類別、營運所在的目標地理區域，該 Skill 將自動為你推導出必須滿足的法規清單，並列出對應的工程控制項。

## Exercises｜練習

1. 你的第一個企業級大客戶要求系統必須具備 SOC 2 Type II、簽署 HIPAA BAA，並出具「歐盟 AI 法案合規宣告書」。設計一套能以最短時間順利成單的最小可行合規推進方案。
2. 虛擬設計三個不同功能定位的 LLM 軟體產品，並將它們精準歸入歐盟 AI 法案的風險金字塔層級。一旦被判定為高風險，系統在工程維運層面會面臨哪些硬性變更？
3. 你不小心將 PHI 傳送給一個沒有 BAA 的服務供應商。說明事故應變流程。
4. 論證 ISO 42001 對 2026 年的中型 AI 供應商是否必要。
5. 將你在第 17 課第 25 節中設計的推論稽核記錄欄位，精準映射至至少三個不同合規標準的具體法規條款中。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| SOC 2 Type II | 「稽核控制項」 | 控制項運作 6 至 12 個月，並經獨立鑑證 |
| HIPAA BAA | 「醫療照護合約」 | Business Associate Agreement；處理 PHI 所需的協議 |
| GDPR | 「歐盟隱私法規」 | 即時 PII 遮罩是較站得住腳的 2026 年標準 |
| EU AI Act | 「歐盟 AI 規則」 | 高風險執法始於 2026 年 8 月；高風險義務最高罰 €15M／3%，違禁作法最高罰 €35M／7% |
| Colorado AI Act | 「美國 AI 州法」 | 2026 年 6 月 30 日生效（SB25B-004 延期）；要求影響評估 |
| ISO 42001 | 「AI 治理」 | AI 風險與透明度的新興框架 |
| ISO 27001 | 「資安管理系統」 | 資訊安全管理系統的基礎標準 |
| Conformity assessment | 「歐盟 AI 文件套件」 | 高風險要求：文件、測試與記錄 |
| Cross-framework mapping | 「一項控制，多項框架」 | 單一政策可滿足多個框架的控制項 |

## Further Reading｜延伸閱讀

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/) — 參考合規檔案。
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act official text](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) — 一手資料來源。
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205) — 一手資料來源。
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) — AI 管理系統標準。
