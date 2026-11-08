# 綜合專案 07 —— 端到端微調管線（資料到 SFT 到 DPO 到上線）

> 一個以你自己的資料訓練、用你自己的偏好做 DPO 對齊、量化過、配上推測解碼，並以可量測的「每百萬詞元多少錢」上線的 8B 級模型。2026 年的開源堆疊是 Axolotl v0.8、TRL 0.15、迭代用 Unsloth、量化用 GPTQ/AWQ/GGUF、上線用 vLLM 0.7 配 EAGLE-3。這個綜合專案就是要可重現地把整條管線跑完（輸入是 YAML，輸出是一個上線端點），並依 2026 年的模型開放性框架發表一份模型卡。

**類型：** 綜合專案
**程式語言：** Python (pipeline), YAML (configs), Bash (scripts)
**先修單元：** 階段 2（機器學習）、階段 3（深度學習）、階段 7（transformer）、階段 10（從零打造 LLM）、階段 11（LLM 工程）、階段 17（基礎設施）、階段 18（安全）
**演練到的階段：** P2 · P3 · P7 · P10 · P11 · P17 · P18
**時間：** 35 小時

## 問題

2026 年每一支認真的 AI 團隊，手邊都備著一條微調管線。不是因為他們要出貨前沿基礎模型，而是因為下游調適 —— 領域 SFT、對著已標註偏好做 DPO、替推測解碼蒸餾草稿模型、用 EAGLE-3 上線 —— 才是可量測的勝利所在。Axolotl v0.8 處理多 GPU 的 SFT 設定。TRL 0.15 處理 DPO 與 GRPO。Unsloth 讓你在單 GPU 上快速迭代。vLLM 0.7 配 EAGLE-3 把解碼吞吐量推高 2-3 倍而不損品質。工具是好用的；手藝在那些 YAML、資料衛生，以及評估紀律上。

你會拿一個 8B 到 14B 的基礎模型（Llama 3.1 8B、Qwen3 14B，或 Gemma 3 12B），在任務專屬資料上跑 SFT 再跑 DPO、為上線做量化，並對照 lm-evaluation-harness、RewardBench-2、MT-Bench-v2 與 MMLU-Pro 量測增益。你會依 2026 年的模型開放性框架產出一份模型卡。重點在可重現性：一行指令就把整條管線從頭到尾重跑一遍。

## 概念

這條管線有五個階段。**資料**：去重（MinHash / Datatrove）、品質過濾（Nemotron-CC 式分類器）、PII 清洗，以及對照公開基準做汙染檢查的切分衛生檢驗。**SFT**：Axolotl YAML、8 張 H100 上跑 ZeRO-3、餘弦排程、序列打包、2-3 個訓練週期。**DPO 或 GRPO**：TRL 設定、1 個週期、偏好配對由人工標註或模型評判、調 beta。**量化**：GPTQ + AWQ + GGUF，以取得部署彈性。**上線**：vLLM 0.7 配 EAGLE-3 推測頭（或 SGLang 配 SpecForge）、K8s 部署、以佇列等待時間做 HPA。

消融實驗才是交付物：在三個任務專屬基準上比較「只有 SFT」、「SFT+DPO」與「SFT+GRPO」。服務指標：批次 1 / 8 / 32 下的每秒詞元數、EAGLE-3 接受率、每百萬詞元多少錢。安全評估：Llama Guard 4 通過率。模型卡：偏差評估、可重現性種子、資料授權。

## 架構

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

- 資料：去重用 Datatrove、品質用 Nemotron-CC 分類器、PII 用 Presidio
- 基礎模型：Llama 3.1 8B、Qwen3 14B，或 Gemma 3 12B
- SFT：Axolotl v0.8，配 ZeRO-3、Flash Attention 3、序列打包
- 偏好調校：DPO 或 GRPO 用 TRL 0.15；單 GPU 迭代用 Unsloth
- 量化：GPTQ（Marlin）、AWQ、經由 llama.cpp 的 GGUF
- 上線：vLLM 0.7 配 EAGLE-3 推測解碼（或 SGLang 0.4 + SpecForge）
- 評估：lm-evaluation-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro
- 安全評估：Llama Guard 4、ShieldGemma-2
- 基礎設施：Kubernetes + NVIDIA device plugin，以佇列等待指標做 HPA
- 可觀測性：訓練用 W&B，推論用 Langfuse

```figure
ce-finetune-stages
```

## 動手建

1. **資料管線。** 對原始語料跑 Datatrove 去重。套用 Nemotron-CC 式的品質分類器。用 Presidio 清洗 PII。以明確的種子寫出訓練／驗證切分。

2. **汙染檢查。** 對每一份驗證切分，計算它與 MMLU-Pro、MT-Bench-v2、RewardBench-2 測試集之間的 MinHash。有任何重疊就拒絕。

3. **Axolotl SFT。** 用帶 ZeRO-3、FA3、序列打包的 YAML。在 8 張 H100 上跑 2-3 個週期。記錄到 W&B。

4. **TRL DPO / GRPO。** 拿那個 SFT 檢查點，在偏好配對上跑一個週期的 DPO（或在數學／程式上用可查證獎勵跑 GRPO）。掃描 beta。

5. **量化。** 產出三種量化版本：GPTQ-INT4-Marlin、AWQ-INT4，以及供 llama.cpp 用的 GGUF-Q4_K_M。記錄大小與名目吞吐量。

6. **配推測解碼上線。** vLLM 0.7 的設定，配上透過 Red Hat Speculators 訓練出來的 EAGLE-3 草稿頭。在批次 1 / 8 / 32 下量測接受率與尾端延遲。在同一份評估上，回報與 Anthropic / OpenAI 相比的每百萬詞元花費。

7. **評估矩陣。** 在基礎模型、只有 SFT、SFT+DPO、SFT+GRPO 上跑 lm-eval-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro。產出一張表。

8. **安全評估。** 在開發集上的 Llama Guard 4 通過率。ShieldGemma-2 的輸出過濾器。

9. **模型卡。** MOF 2026 樣板：資料、訓練、評估、安全、授權，以及帶 YAML 與提交 SHA 的可重現性章節。

## 動手用

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

## 產出交付

`outputs/skill-finetuning-pipeline.md` 描述那份交付物。單一一行指令把資料跑過 SFT、跑過 DPO、跑過量化、跑過上線、跑過評估，並產出一份模型卡加上那個已上線的端點。

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | 相對基礎模型的評估差值 | 在目標任務上量到的增益（MMLU-Pro、MT-Bench-v2、任務專屬） |
| 20 | 管線可重現性 | 一行指令以相同種子從頭到尾重跑 |
| 20 | 資料衛生 | 去重率、PII 清洗涵蓋率、汙染檢查全綠 |
| 20 | 服務效率 | bs=1/8/32 下的每秒詞元數、EAGLE-3 接受率、每百萬詞元花費 |
| 15 | 模型卡 + 安全評估 | 2026 MOF 的完整度 + Llama Guard 4 通過率 |
| **100** | | |

## 練習

1. 在同一份任務專屬基準上跑「只有 SFT」、「SFT+DPO」與「SFT+GRPO」。回報哪一種偏好方法勝出、勝多少。

2. 把 Llama 3.1 8B 換成 Qwen3 14B。在品質相當的前提下量測每百萬詞元花費。

3. 量測 EAGLE-3 在領域資料上與在通用 ShareGPT 上的接受率。回報差值，以及它對延遲預算意味著什麼。

4. 注入 1% 的汙染（把 MMLU-Pro 答案洩進訓練資料）再重跑評估。看著 MMLU-Pro 準確率不切實際地跳上去。建一道能抓到這件事的汙染檢查 CI 閘門。

5. 加上 LoRA SFT 作為完整微調的替代方案。在記憶體低 10 倍的情況下量測品質差距。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| Axolotl | 「SFT 訓練器」 | 以 YAML 驅動、統一處理 SFT、DPO 與蒸餾的訓練器 |
| TRL | 「偏好調校器」 | Hugging Face 供 LLM 做 DPO、GRPO、PPO 的函式庫 |
| GRPO | 「群體相對策略最佳化」 | DeepSeek R1 那套配可查證獎勵的 RL 配方 |
| EAGLE-3 | 「推測解碼草稿」 | 預測未來 N 個詞元的草稿頭；由 vLLM 用目標模型驗證 |
| MOF | 「模型開放性框架」 | 2026 年替模型發布在資料、程式碼、授權上評級的標準 |
| 汙染檢查 | 「切分衛生」 | 以 MinHash 為基礎，偵測測試集洩進訓練資料 |
| 接受率 | 「EAGLE / MTP 指標」 | 目標模型接受了多少比例的草稿詞元 |

## 延伸閱讀

- [Axolotl documentation](https://axolotl-ai-cloud.github.io/axolotl/) —— 參考用的 SFT / DPO 訓練器
- [TRL documentation](https://huggingface.co/docs/trl) —— DPO 與 GRPO 的參考實作
- [Unsloth](https://github.com/unslothai/unsloth) —— 單 GPU 迭代的參考
- [DeepSeek R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) —— GRPO 方法論
- [vLLM + EAGLE-3 documentation](https://docs.vllm.ai) —— 參考用的服務堆疊
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) —— 另一套推測解碼訓練器
- [Model Openness Framework (arXiv:2403.13784)](https://arxiv.org/abs/2403.13784)：開放發布的評級標準
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) —— 經典的評估執行器
