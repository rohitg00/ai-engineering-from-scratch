# 綜合專案 15 —— 憲法式安全框架 + 紅隊靶場

> Anthropic 的憲法式分類器、Meta 的 Llama Guard 4、Google 的 ShieldGemma-2、NVIDIA 的 Nemotron 3 Content Safety，以及提供多語涵蓋的 X-Guard，界定了 2026 年的安全分類器堆疊。garak、PyRIT、NVIDIA Aegis 與 promptfoo 成了標準的對抗式評估工具。NeMo Guardrails v0.12 把它們串進一條生產管線。這個綜合專案把這一切接起來：一套圍繞目標應用的分層安全框架、一個跑 6 種以上攻擊家族的自主紅隊代理，以及一次能產出可量測無害度差值的憲法式自我批判訓練。

**類型：** 總結專案
**程式語言：** Python (safety pipeline, red team), YAML (policy configs)
**先修單元：** 階段 10（從零打造 LLM）、階段 11（LLM 工程）、階段 13（工具）、階段 14（代理）、階段 18（倫理、安全、對齊）
**演練到的階段：** P10 · P11 · P13 · P14 · P18
**時間：** 25 小時

## 問題

2026 年 LLM 安全的前沿，不在於分類器管不管用（大致上管用），而在於怎麼把它們正確地組合在一個生產應用周圍，既不過度拒答、也不留下明顯破口。Llama Guard 4 處理英文的政策違規。X-Guard（132 種語言）處理多語越獄。ShieldGemma-2 抓以影像為載體的提示詞注入。NVIDIA Nemotron 3 Content Safety 涵蓋企業類別。Anthropic 的憲法式分類器則是另一種做法，用在訓練時而不是服務時。

攻擊的演化也很要緊。PAIR 與 TAP 把越獄的發現自動化。GCG 跑以梯度為基礎的後綴攻擊。多輪與語碼轉換攻擊利用代理的記憶。任何部署出去的 LLM 都需要一座紅隊靶場 —— garak 與 PyRIT 是經典的驅動器 —— 再加上有記載的緩解措施與經 CVSS 評分的發現。

你會把一個目標應用（8B 指令微調模型，或其他綜合專案裡的某個 RAG 聊天機器人）加固起來、對它跑 6 種以上的攻擊家族，並產出一份前後對照的無害度量測。

## 概念

安全管線有五層。**輸入清洗**：剝掉零寬字元、解碼 base64/rot13、正規化 Unicode。**政策層**：NeMo Guardrails v0.12 的軌道（離題、毒性、PII 抽取）。**分類器閘門**：輸入端用 Llama Guard 4、非英語用 X-Guard、影像輸入用 ShieldGemma-2。**模型**：那個目標 LLM。**輸出過濾**：輸出端用 Llama Guard 4、Presidio PII 清洗，以及適用時的引用強制。**人類介入層**：被標為高風險的輸出進到一個 Slack 佇列。

紅隊靶場跑在一個排程器上。PAIR 與 TAP 自主發現越獄。GCG 跑以梯度為基礎的後綴攻擊。ASCII / base64 / rot13 的編碼攻擊。多輪攻擊（角色扮演、記憶利用）。語碼轉換攻擊（把英文與斯瓦希里語或泰語混著用）。每一次執行都產出一份帶 CVSS 評分與揭露時程的結構化發現檔。

憲法式自我批判那一輪是一項訓練期的介入。拿 1000 則有害嘗試的提示詞，讓模型草擬回應、依一份成文憲法（不得傷害的規則）批判它，再用那條批判迴路重新訓練。在一份保留的評估上量測前後的無害度差值。

## 架構

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

- 安全分類器：Llama Guard 4、ShieldGemma-2、NVIDIA Nemotron 3 Content Safety、X-Guard
- 護欄框架：NeMo Guardrails v0.12 + OPA
- 紅隊驅動器：garak（NVIDIA）、PyRIT（Microsoft Azure）、NVIDIA Aegis、promptfoo
- 越獄代理：PAIR（Chao 等人，2023）、Tree-of-Attacks（TAP）、GCG 後綴
- 憲法式訓練：Anthropic 風格的自我批判迴路 + 在批判上做 SFT
- PII 清洗：Presidio
- 目標：一個 8B 指令微調模型，或其他綜合專案裡的某個 RAG 聊天機器人

```figure
cf-safety-stack
```

## 動手實作

1. **目標建置。** 在 vLLM 上架起一個 8B 指令微調模型（或重用另一個綜合專案的 RAG 聊天機器人）。這就是受測應用。

2. **安全管線包裝。** 把那五層管線接在目標周圍。驗證每一層都個別可觀測（Langfuse 裡每層一個 span）。

3. **分類器涵蓋。** 載入 Llama Guard 4、X-Guard（多語）、ShieldGemma-2（影像）。在一小份已標註集上各跑一次以建立基線。

4. **紅隊排程器。** 排程 garak、PyRIT、一個 PAIR 代理、一個 TAP 代理、一個 GCG 執行器、一個多輪攻擊者，以及一個語碼轉換攻擊者。各自跑在獨立佇列上。

5. **攻擊套件。** 六個攻擊家族：(1) PAIR 自動化越獄、(2) TAP 攻擊樹、(3) GCG 梯度後綴、(4) ASCII / base64 / rot13 編碼、(5) 多輪角色扮演、(6) 多語語碼轉換。回報逐家族的成功率。

6. **憲法式自我批判。** 整理 1000 則有害嘗試的提示詞。對每一則，目標草擬一份回應。一個批評者 LLM 依一份成文憲法（「不得造成傷害」、「引用證據」、「拒絕非法請求」）評分。批評者有異議的提示詞就被改寫；目標再在「經批判改良過的配對」上微調。在一份保留的評估上量測前後的無害度。

7. **過度拒答的量測。** 在一份良性提示詞套件（例如 XSTest）上追蹤偽陽性率。目標在良性問題上必須維持有幫助。

8. **CVSS 評分。** 對每一次成功的越獄，依 CVSS 4.0 評分（攻擊向量、複雜度、影響）。產出一份揭露時程與緩解計畫。

9. **靶場自動化。** 上述一切都跑在 cron 上；發現寫進佇列；過度拒答的退化警報發到 Slack。

## 框架應用

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## 產出交付

`outputs/skill-safety-harness.md` 就是那份交付物。一套生產級的分層安全管線，加上一座帶前後無害度差值、可重現的紅隊靶場。

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | 攻擊面涵蓋率 | 演練 6 種以上攻擊家族、2 種以上語言 |
| 20 | 真陽性／偽陽性的取捨 | 攻擊攔截率 vs XSTest 良性通過率 |
| 20 | 自我批判的差值 | 保留評估上的前後無害度 |
| 20 | 文件與揭露 | 帶時程、經 CVSS 評分的發現 |
| 15 | 自動化與可重複性 | 一切都跑在 cron 上並帶警報 |
| **100** | | |

## 練習

1. 對一個 RAG 聊天機器人跑 garak 的提示詞注入外掛，並比較有無輸出過濾層時的攻擊成功率。

2. 加上第七個攻擊家族：透過檢索文件做的間接提示詞注入。量測額外需要的防禦。

3. 實作一種「拒絕但幫忙」模式：當護欄攔下時，目標改提供一個較安全的相關答案，而不是直接硬拒。量測 XSTest 的差值。

4. 多語涵蓋缺口：找出一種 X-Guard 表現較差的語言。針對它提出一份微調資料集。

5. 在一個 30B 模型上跑憲法式自我批判，並量測那個差值會不會隨規模擴縮。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| 分層安全 | 「縱深防禦」 | 在輸入、閘門、輸出、人類介入等多處設護欄 |
| Llama Guard 4 | 「Meta 的安全分類器」 | 2026 年參考用的輸入／輸出內容分類器 |
| PAIR | 「越獄代理」 | 關於「由 LLM 驅動之越獄發現」的論文（Chao 等人） |
| TAP | 「攻擊樹」 | PAIR 的樹狀搜尋變體 |
| GCG | 「貪婪座標梯度」 | 以梯度為基礎的對抗後綴攻擊 |
| 憲法式自我批判 | 「Anthropic 風格的訓練」 | 目標草擬 -> 批評者評分 -> 改寫 -> 重新訓練 |
| XSTest | 「良性探測集」 | 供過度拒答退化使用的基準 |
| CVSS 4.0 | 「嚴重度分數」 | 供安全發現使用的標準漏洞評分 |

## 延伸閱讀

- [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/constitutional-classifiers) —— 訓練期的參考
- [Meta Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) —— 2026 年的輸入／輸出分類器
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) —— 影像 + 多模態安全
- [NVIDIA Nemotron 3 Content Safety](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) —— 企業參考
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) —— 132 種語言的多語安全
- [garak](https://github.com/NVIDIA/garak) —— NVIDIA 的紅隊工具包
- [PyRIT](https://github.com/Azure/PyRIT) —— 微軟的紅隊框架
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) —— 軌道框架
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) —— 越獄代理的論文
