# 專案實戰 15——憲法 AI 安全測試框架與紅隊靶場（Capstone 15 — Constitutional Safety Harness + Red-Team Range）

> Anthropic 的憲法分類器（Constitutional Classifiers）、Meta 的 Llama Guard 4、Google 的 ShieldGemma-2、NVIDIA 的 Nemotron 3 內容安全模型，以及提供 132 種語言跨語種防禦的 X-Guard，共同定義了 2026 年安全分類器（classifier）的標準技術堆疊。garak、PyRIT、NVIDIA Aegis 與 promptfoo 則成為事實上的對抗性紅隊評測標準工具。NVIDIA 的 NeMo Guardrails v0.12 將這些工具無縫串聯進正式環境管線。本專案實戰將上述技術整合起來：圍繞一個目標應用建置多層安全護欄、調度自主紅隊 agent 發起至少 6 種攻擊家族，並執行基於憲法原則的自我批判訓練，產出可客觀量化的無害性變化（delta）。

**Type:** Capstone
**Languages:** Python (safety pipeline, red team), YAML (policy configs)
**Prerequisites:** Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 18 (ethics, safety, alignment)
**Phases exercised:** P10 · P11 · P13 · P14 · P18
**Time:** 25 hours

## Problem｜問題

2026 年 LLM 安全領域的技術前沿，不在於分類器是否有效（它們大致上有效），而在於**如何在正式環境應用中正確組合這些分類器，避免過度拒絕（Over-Refusal）或留下明顯漏洞**。Llama Guard 4 專精於英文常規合規策略違規；支援 132 種語言的 X-Guard 專精於跨語種多語言越獄攻擊；ShieldGemma-2 專門防禦基於影像輸入的 Prompt 注入攻擊；NVIDIA Nemotron 3 Content Safety 則涵蓋企業類別；Anthropic 的憲法分類器則是在訓練階段而非服務階段使用的另一種方法。

與此同時，攻擊手段亦在經歷暴力進化。PAIR 與 TAP 能完全自主探索越獄路徑；GCG 會執行以梯度為基礎的後綴攻擊；多輪上下文催眠與跨語言混淆攻擊則專門利用 Agent 的記憶實施暗度陳倉。任何已部署的 LLM 都需要紅隊測試環境——以 garak 與 PyRIT 作為底層驅動引擎——出具標準化的緩解處方，並對所有被攻破的缺陷進行 CVSS 標準漏洞評級。

你將親手為一個目標 LLM 應用實施全方位的安全加固（可選用一個 8B instruction-tuned 模型或前面專案實戰中打造的 RAG 對話機器人），以至少 6 種攻擊家族對其進行自動化測試，並產出加固前後的客觀無害性度量對比報告。

## Concept｜核心概念

整套縱深防禦管線由五大防禦層級組成。**輸入端清洗消毒（Input sanitize）**：剝離零寬度隱形字符、解碼隱密的 base64/rot13 編碼、標準化 Unicode 字符集。**業務策略控制層（Policy layer）**：透過 NeMo Guardrails v0.12 載入領域規則（阻斷超綱業務提問、過濾極端毒性言論、阻斷 PII 隱私探針）。**安全分類器閘門（Classifier gate）**：在文字輸入端調用 Llama Guard 4，在非英語輸入端調用 X-Guard，在多模態圖片輸入端調用 ShieldGemma-2。**目標模型核心（Model）**：承擔業務任務的主力 LLM。**輸出端安全過濾（Output filter）**：在回答吐出前再次調用 Llama Guard 4 進行後置審查、使用 Presidio 脫敏敏感個資、適用時執行引用檢查。**人工在環審批層（HITL tier）**：任何被系統標註為高風險邊界的爭議回答，皆被攔截並轉發至 Slack 人工審核佇列。

自動化紅隊靶場由獨立排程器常態化調度運作。PAIR 與 TAP 自動探索全新的越獄prompt；GCG 發起基於梯度的對抗後綴暴力破解；ASCII 藝術字元／base64／rot13 編碼繞過攻擊；多輪對話角色扮演催眠攻擊；將英文與斯瓦希里語或泰語惡意交替混雜的「語碼轉換（Code-Switch）」攻擊。靶場的每一次掃描皆會自動產出結構化的缺陷檔案，附帶標準 CVSS 漏洞評分與漏洞披露修復時間表。

憲法自我批判訓練（Constitutional self-critique）則是一項訓練階段的介入措施。收集 1000 條惡意誘導 Prompt，讓模型首先生成初稿，隨後調用批判模型依據明文憲法（如「不作惡原則」、「尊重事實引用」、「堅決拒絕違法犯罪指引」）對初稿展開審查與自我修改，最後以「批判修訂後的問答對」對目標模型執行監督式 fine-tuning（SFT）。在完全隔離的獨立測試集上度量該訓練手段帶來的無害性變化。

## 系統架構

```
request (text / image / multilingual)
      |
      v
input sanitize (strip zero-width, decode, normalize)
      |
      v
NeMo Guardrails v0.12 rails (off-domain, policy)
      |
      v
classifier gate:
  Llama Guard 4 (English)
  X-Guard (multilingual, 132 langs)
  ShieldGemma-2 (image prompts)
  Nemotron 3 Content Safety (enterprise)
      |
      v (allowed)
target LLM
      |
      v
output filter: Llama Guard 4 + Presidio PII + citation check
      |
      v
HITL tier for flagged outputs

parallel:
  red-team scheduler
    -> garak (classic attacks)
    -> PyRIT (orchestrated red team)
    -> autonomous jailbreak agent (PAIR + TAP)
    -> GCG suffix attacks
    -> multilingual / code-switch
    -> multi-turn persona adoption

output: CVSS-scored findings + disclosure timeline + before/after harmlessness delta
```

## 技術堆疊

- 內容安全分類器：Llama Guard 4、ShieldGemma-2、NVIDIA Nemotron 3 Content Safety、X-Guard
- 防護欄編排架構：NeMo Guardrails v0.12 搭配 OPA 開放策略代理
- 紅隊驅動工具鏈：garak（NVIDIA 出品）、PyRIT（微軟 Azure 出品）、NVIDIA Aegis、promptfoo
- 自主越獄攻擊 Agent：PAIR（Chao 等人，2023 年）、攻擊樹搜尋（TAP）、GCG 梯度對抗後綴
- 憲法自我批判對齊：Anthropic 風格的自我批判迴圈 + 基於批判結果的 SFT fine-tuning
- 個人敏感資訊脫敏：Presidio
- 受測目標對象：一個私有部署的 8B instruction-tuned 模型，或前述專案實戰中建置的 RAG 對話機器人

```figure
cf-safety-stack
```

## Build It｜動手實作

1. **受測目標環境就緒**。在 vLLM 上部署一個 8B instruction-tuned 模型（或直接複用前面專案實戰中打造的 RAG 對話機器人）。該實例將作為後續全套安全測試的唯一標靶。

2. **多層縱深防禦封裝**。圍繞目標應用完整建置五層安全管線。確保每一層防禦皆具備完全獨立的可觀測性（在 Langfuse 中為每一層記錄專屬的 Span 鏈路）。

3. **安全分類器全量載入**。配置並部署 Llama Guard 4、X-Guard（跨語種多語言）以及 ShieldGemma-2（圖片多模態）。在標定的小型基準測試集上執行冒煙測試，確立初始效能基準。

4. **自動化紅隊排程中心**。建立後台定時排程任務，分別將 garak、PyRIT、PAIR 越獄 Agent、TAP 攻擊樹 Agent、GCG 暴力破解器、多輪催眠攻擊器與語碼轉換攻擊器掛載至不同的獨立執行佇列。

5. **攻擊套件**。執行以下六種攻擊家族：(1) PAIR 自動化對話越獄、(2) TAP 攻擊樹探索、(3) GCG 梯度對抗後綴注入、(4) ASCII 藝術字元／base64／rot13 編碼繞過、(5) 多輪角色扮演對話催眠、(6) 跨語種語碼轉換混淆。精確度量每一類攻擊的攻破成功率。

6. **憲法自我批判 fine-tuning 實驗**。精心挑選 1000 條惡意提問。針對每條提問，讓目標模型生成原始回答。調用專屬的批判 LLM 對照已公佈的憲法規則（「不造成實質危害」、「引用真實出處」、「拒絕違法犯罪協助」）實施嚴格審查與重寫修改。將修訂後的優質問答對作為 fine-tuning 資料，對目標模型執行 SFT。在完全未見過的獨立測試集上度量 fine-tuning 前後的無害性變化。

7. **過度拒絕率嚴格監控**。在標準良性提問測試集（如 XSTest 基準）上持續度量系統的偽陽性誤傷率。確保系統在維持高防禦力的同時，在正常良性問題上依然保持高度有幫助性。

8. **CVSS 漏洞標準化評級**。針對所有成功攻破防線的越獄案例，依照國際權威 CVSS 4.0 標準（涵蓋攻擊向量、複雜度與影響程度）出具漏洞分值。產出對應的漏洞披露時間表與緩解計畫。

9. **全自動常態化靶場防禦**。將上述紅隊掃描邏輯封裝為自動化 Cron 定時任務；掃描產出的漏洞自動寫入工單佇列；一旦監控到過度拒絕率出現異常抬頭，即刻向企業 Slack 維運通道發出告警。

## Use It｜實際應用

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-safety-harness.md`。它代表一套工業級的多層縱深安全防禦管線，附帶一個完全可重現的自動化紅隊測試靶場，並產出清晰的加固前後無害性對比資料。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | 攻擊面覆蓋完備度 | 測試至少 6 種攻擊家族，跨越至少 2 種以上不同語言體系 |
| 20 | 防禦精準度與誤傷平衡 | 惡意攻擊的成功攔截率 vs XSTest 良性提問的正常通過率 |
| 20 | 憲法自我批判訓練增益 | 在隔離測試集上，實測 fine-tuning 前後無害性指標的變化 |
| 20 | 漏洞文件與標準披露規範 | 出具標準 CVSS 4.0 評分的缺陷審計清單與清晰的時間修復路線圖 |
| 15 | 自動化維運與可重現性 | 全套紅隊流程支援 Cron 排程自動運作，並具備即時告警通知能力 |
| **100** | | |

## Exercises｜練習

1. 使用 garak 的 Prompt 注入擴充功能針對一個 RAG 對話機器人發起滲透測試，精確對比「開啟輸出端過濾層」與「完全裸奔無輸出過濾」時攻擊成功率的劇烈變化。
2. 為靶場擴充第七大攻擊矩陣：透過被檢索召回的惡意文件發起的「間接 Prompt 注入攻擊（Indirect Prompt Injection）」。衡量防禦這類攻擊所需的額外防護。
3. 實作「拒絕時提供建設性引導（Refuse-with-help）」模式：當防護欄攔截違規請求時，模型不再硬性吐出冷冰冰的拒絕語句，而是主動提供一條安全的替代探索路徑。測量 XSTest delta。
4. 探索跨語種防禦的盲區：找出一種 X-Guard 表現不佳的語言。為該特定語種量身設計一套 fine-tuning 對齊資料集的採集方案。
5. 將憲法自我批判 fine-tuning 演算法遷移至規模更大的 30B 參數模型上執行。測量無害性變化是否會隨模型規模同步擴展。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Layered safety |「深度防禦」| 在輸入、閘門、輸出與人工介入環節設置多層護欄 |
| Llama Guard 4 |「Meta 的安全分類器」| 2026 年用於輸入與輸出內容的參考分類器 |
| PAIR |「越獄 agent」| 探索由 LLM 驅動越獄方法的論文（Chao 等人） |
| TAP |「攻擊樹」| PAIR 的一種樹狀搜尋變體 |
| GCG |「貪婪座標梯度」| 以梯度為基礎的對抗式後綴攻擊 |
| Constitutional self-critique |「Anthropic 式訓練」| 目標模型起草回應 → 批判模型評分 → 改寫 → 重新訓練 |
| XSTest |「良性探測集」| 用來測量過度拒絕退化的基準測試 |
| CVSS 4.0 |「嚴重程度分數」| 安全性發現項目的標準弱點評分方式 |

## Further Reading｜延伸閱讀

- [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/constitutional-classifiers) — 訓練時憲法對齊技術文獻。
- [Meta Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) — 2026 年最新一代輸入／輸出安全分類模型。
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) — 專攻圖片與多模態場景的安全護欄模型。
- [NVIDIA Nemotron 3 Content Safety](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) — 企業級內容審核標竿。
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) — 支援 132 種語言的跨語種安全防護模型。
- [garak](https://github.com/NVIDIA/garak) — NVIDIA 開源的 LLM 專用紅隊測試工具箱。
- [PyRIT](https://github.com/Azure/PyRIT) — 微軟 Azure 團隊打造的自動化紅隊編排架構。
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — 工業級安全防護欄可程式化引擎。
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — 自動化越獄 Agent 的奠基論文。
