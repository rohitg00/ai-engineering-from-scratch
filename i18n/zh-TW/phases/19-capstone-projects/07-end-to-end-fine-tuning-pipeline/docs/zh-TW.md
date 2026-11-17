# 專案實戰 07——端到端 fine-tuning 管線（資料到 SFT 到 DPO 到服務部署）（Capstone 07 — End-to-End Fine-Tuning Pipeline (Data to SFT to DPO to Serve)）

> 在你專有的業務資料上訓練一個 8B 參數基礎模型、依據私有偏好標註實施 DPO 偏好對齊、完成量化壓縮、配置推測解碼（Speculative Decoding），並最終部署為可客觀度量每百萬 Token 成本（$/1M tokens）的高效能推論端點。2026 年的工業級開源技術堆疊由 Axolotl v0.8、TRL 0.15、用於快速迭代的 Unsloth、用於量化的 GPTQ/AWQ/GGUF，以及搭載 EAGLE-3 的 vLLM 0.7 所共同統治。本專案實戰要求你以具備極致可重現性的方式跑通整條管線——輸入一份 YAML 配置文件，自動產出可供線上服務的即時推論端點——並依照 2026 年《模型開放度框架（Model Openness Framework）》標準發布完整的模型卡。

**Type:** Capstone
**Languages:** Python (pipeline), YAML (configs), Bash (scripts)
**Prerequisites:** Phase 2 (ML), Phase 3 (DL), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P2 · P3 · P7 · P10 · P11 · P17 · P18
**Time:** 35 hours

## Problem｜問題

到了 2026 年，每一家嚴謹的 AI 技術團隊皆常態化維運著一套自動化 fine-tuning 管線。這不是為了推出前沿底座模型，而是因為絕大多數可量化的商業價值皆集中於下游適應層：垂直領域的 SFT fine-tuning、針對標註偏好的 DPO/GRPO 對齊、為推測解碼蒸餾專屬的小型草稿頭、以及結合 EAGLE-3 的推論加速。vLLM 0.7 搭配 EAGLE-3 可將解碼吞吐量提升 2–3 倍且不降低品質。各類開源工具鏈已日臻完善；真正的核心工程手藝全在於 YAML 設定的精細調整、資料清洗的衛生紀律，以及嚴苛客觀的評測標準。

你將選用一個 8B 規模的底座模型（Llama 3.3、Qwen3 或 Gemma 3），在特定任務資料集上依序實施 SFT 與 DPO，進行量化壓縮以適配正式環境部署，並在 lm-evaluation-harness、RewardBench-2、MT-Bench-v2 與 MMLU-Pro 等權威基準上嚴格測量效能增益。最後，你將依據 2026 年 MOF 標準產出一份規範的模型卡。本專案的核心靈魂在於極致的可重現性——僅憑單條命令即可將整套管線自頭至尾重新跑通。

## Concept｜核心概念

整套管線包含五大關鍵階段。**資料準備（Data）**：實施文字去重（MinHash / Datatrove）、品質過濾（Nemotron-CC 風格的分類器）、個人隱私資訊（PII）清除，以及嚴格針對公開基準測試集的資料污染排查。**SFT fine-tuning**：撰寫 Axolotl YAML 配置，在 8 卡 H100 叢集上啟用 ZeRO-3、餘弦退火學習率排程、樣本序列打包（Packed Sequences），持續訓練 2 至 3 個 Epoch。**DPO 或 GRPO 偏好對齊**：編寫 TRL 配置訓練 1 個 Epoch，偏好資料對可源自人工標註或大模型裁判打分，精細調整 beta 參數。**量化壓縮（Quantize）**：同步產出 GPTQ、AWQ 與 GGUF 格式，賦予部署極大彈性。**推論服務（Serve）**：採用 vLLM 0.7 搭配 EAGLE-3 推測解碼頭（或 SGLang 搭配 SpecForge），打包為 K8s Deployment，並基於佇列等待時長配置 HPA 自動擴縮容。

消融實驗（Ablations）是本專案的關鍵驗收項目：在三項具體任務基準上客觀對比「純 SFT」vs「SFT + DPO」vs「SFT + GRPO」的實測得分差異。推論服務度量指標：批次大小為 1 / 8 / 32 時的每秒 Token 吞吐量、EAGLE-3 草稿接受率、每百萬 Token 實際推論成本。安全評測：Llama Guard 4 基準通過率。模型卡內容：偏見評估資料、可重現性隨機種子以及原始訓練資料授權許可聲明。

## 系統架構

```
raw data (HF datasets + internal)
    |
    v
Datatrove dedup + Nemotron-CC quality filter + PII scrub
    |
    v
split hygiene (MMLU-Pro contamination check)
    |
    v
Axolotl SFT config (YAML)  ---> 8xH100, ZeRO-3
    |
    v
TRL DPO / GRPO config       ---> 4xH100, 1 epoch
    |
    v
GPTQ + AWQ + GGUF quantize
    |
    v
vLLM 0.7 + EAGLE-3 speculative decoding
    |
    v
K8s deployment, HPA on queue-wait
    |
    v
lm-eval-harness + RewardBench-2 + MT-Bench-v2 + MMLU-Pro
    |
    v
model card (2026 MOF) + safety eval (Llama Guard 4)
```

## 技術堆疊

- 資料工程：Datatrove 負責海量去重，Nemotron-CC 評分分類器負責品質過濾，Presidio 負責 PII 隱私脫敏
- 底座模型：Llama 3.3 8B、Qwen3 14B 或 Gemma 3 12B
- SFT 引擎：Axolotl v0.8，整合 ZeRO-3、Flash Attention 3 與序列打包（Sequence Packing）
- 偏好對齊：TRL 0.15 負責 DPO 或 GRPO；單卡除錯選用 Unsloth 追求極致迭代速度
- 模型量化：GPTQ（Marlin 核心）、AWQ，以及面向 llama.cpp 的 GGUF 格式
- 推論服務：vLLM 0.7 搭載 EAGLE-3 推測解碼（或 SGLang 0.4 搭配 SpecForge）
- 評測工具：lm-evaluation-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro
- 安全過濾：Llama Guard 4、ShieldGemma-2 內容防護欄
- 基礎設施：Kubernetes 叢集搭配 NVIDIA 裝置擴充功能，基於推論佇列等待時間觸發 HPA
- 可觀測性：W&B 負責記錄訓練損失函數曲線，Langfuse 負責記錄線上推論與評測軌跡

```figure
ce-finetune-stages
```

## Build It｜動手實作

1. **資料清洗管線**。在原始文字語料上執行 Datatrove MinHash 去重。調用 Nemotron-CC 風格的品質分類器剔除劣質文字。使用 Presidio 徹底擦除 PII 隱私資料。使用固定隨機種子嚴格劃分訓練集與驗證集。

2. **基準測試集污染排查**。針對每個驗證集切分，計算其與 MMLU-Pro、MT-Bench-v2、RewardBench-2 測試集之間的 MinHash 相似度。堅決剔除任何存在文字重疊的潛在污染樣本。

3. **Axolotl SFT fine-tuning**。編寫包含 ZeRO-3、FA3 與序列打包的標準 YAML 配置。在 8 卡 H100 叢集上全量訓練 2 至 3 個 Epoch。將所有損失函數曲線即時同步至 W&B。

4. **TRL 偏好對齊（DPO / GRPO）**。載入 SFT 產出的 model checkpoint，在成對偏好資料集上執行 1 個 Epoch 的 DPO 訓練（或在程式碼/數學等具備客觀可驗證獎勵的場景下執行 GRPO）。對 beta 參數實施網格搜尋。

5. **量化壓縮多格式打包**。產出三套主流格式量化模型：GPTQ-INT4-Marlin、AWQ-INT4 以及 GGUF-Q4_K_M。記錄各格式的磁碟佔用與標稱推論吞吐。

6. **推測解碼推論部署**。編寫 vLLM 0.7 配置檔案，載入透過 Red Hat Speculators 預先訓練的 EAGLE-3 草稿預測頭。在批次大小為 1 / 8 / 32 的情境下分別度量草稿接受率與尾部 p99 延遲。在相同評測集上對比自建端點與 Anthropic / OpenAI 商業 API 的每百萬 Token 成本。

7. **消融實驗矩陣產出**。在底座模型、純 SFT、SFT+DPO、SFT+GRPO 四種狀態下，全面運行 lm-eval-harness、RewardBench-2、MT-Bench-v2 與 MMLU-Pro。產出完整的對比資料表。

8. **線上安全評測**。在開發測試集上檢驗 Llama Guard 4 的安全通過率。掛載 ShieldGemma-2 作為後置輸出過濾器。

9. **標準模型卡發布**。遵循 2026 MOF 模板撰寫正式的 model-card.md：涵蓋訓練資料來源、fine-tuning 方法、評測指標、安全防護評估、開源許可證，以及包含所有 YAML 配置與 Git Commit SHA 的極致可重現性章節。

## Use It｜實際應用

```
$ ./pipeline.sh config/llama3.3-8b-domainX.yaml
[data]    300k deduped, 12k filtered, 280k accepted (seed=7)
[SFT]     3 epochs, 8xH100, 6h12m, val loss 1.42 -> 1.03
[DPO]     1 epoch, beta=0.08, 4xH100, 1h40m
[quant]   GPTQ-INT4 4.6 GB, AWQ-INT4 4.8 GB, GGUF-Q4_K_M 5.1 GB
[serve]   vLLM 0.7, EAGLE-3 acceptance 0.74, p99 126ms @ bs=8
[eval]    MMLU-Pro +3.2, MT-Bench-v2 +0.41, RewardBench-2 +0.08
[card]    model-card.md generated under 2026 MOF
```

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-finetuning-pipeline.md`。透過單條命令即可自動串聯「資料清洗 -> SFT -> DPO -> 量化 -> 服務化部署 -> 全面評測」全流程，並最終自動產出權威模型卡與線上推論端點。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | 相較於底座模型的評測增益 | 測量目標任務基準（MMLU-Pro、MT-Bench-v2 及專屬任務）上的評測增益 |
| 20 | 管線極致可重現性 | 透過單一命令端到端重跑管線，並使用相同的隨機種子 |
| 20 | 資料清洗衛生紀律 | 展現精確的去重比例、PII 隱私脫敏覆蓋率，且污染排查全綠通過 |
| 20 | 推論服務部署效能 | 在批次 1/8/32 下的每秒 Token 吞吐、EAGLE-3 草稿接受率、每百萬 Token 實際推論成本 |
| 15 | 模型卡規範度與安全評測 | 2026 MOF 標準項完備性 + Llama Guard 4 安全通過率 |
| **100** | | |

## Exercises｜練習

1. 在同一個垂直任務基準測試集上，平行對比「純 SFT」vs「SFT + DPO」vs「SFT + GRPO」三種調整方案。深入分析哪種偏好最佳化演算法取得的淨收益最大、具體領先多少點？
2. 將底座模型從 Llama 3.3 8B 替換為 Qwen3 14B。在維持完全相同下游任務質量的基準線上，測量兩者在每百萬 Token 實際推論花費上的優劣。
3. 度量 EAGLE-3 草稿頭在垂直領域私有資料與通用 ShareGPT 資料上的接受率差異。報告該差異值，並闡述其對即時線上服務的延遲預算意味著什麼？
4. 人為向訓練集中故意注入 1% 的污染樣本（將 MMLU-Pro 測試集的題目與標準答案洩漏進 SFT 語料中），重新執行訓練與評測。觀察 MMLU-Pro 得分出現何種不合常理的虛高暴漲。建置一個能在 CI 門禁中主動攔截該洩漏的自動化防禦檢查器。
5. 引入 LoRA 輕量化 SFT 作為 Full Fine-Tuning 的對照組。量化分析以降低 10 倍顯示記憶體開銷為代價時，模型最終在核心任務上出現了多少點數的品質差距。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Axolotl |「SFT 訓練器」| 由 YAML 驅動的統一訓練器，支援 SFT、DPO 與蒸餾 |
| TRL |「偏好調整工具」| Hugging Face 函式庫，支援 LLM 的 DPO、GRPO 與 PPO |
| GRPO |「群組相對策略最佳化」| DeepSeek R1 使用的強化學習方法，採用可驗證的獎勵 |
| EAGLE-3 |「推測解碼草稿」| 能向前預測 N 個 Token 的草稿頭；由 vLLM 使用目標模型驗證 |
| MOF |「模型開放度框架」| 2026 年評估模型發布中資料、程式碼與授權的標準 |
| Contamination check |「資料切分衛生檢查」| 以 MinHash 偵測測試集洩漏至訓練資料中的情況 |
| Acceptance rate |「EAGLE／MTP 指標」| 目標模型接受的草稿 Token 比例 |

## Further Reading｜延伸閱讀

- [Axolotl documentation](https://axolotl-ai-cloud.github.io/axolotl/) — 業界標竿級 SFT / DPO 訓練框架技術手冊。
- [TRL documentation](https://huggingface.co/docs/trl) — Hugging Face 偏好對齊 DPO 與 GRPO 官方參考指南。
- [Unsloth](https://github.com/unslothai/unsloth) — 單卡極速迭代首選fine-tuning 加速函式庫。
- [DeepSeek R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — GRPO 強化學習對齊方法論奠基論文。
- [vLLM + EAGLE-3 documentation](https://docs.vllm.ai) — 工業級高吞吐推測解碼推論引擎技術文件。
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — 另一種優秀的推測解碼草稿頭訓練工具。
- [Model Openness Framework 2026](https://isocpp.org/) — 開放模型發布評級標準。
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) — 官方標準大模型基準評測執行器。
