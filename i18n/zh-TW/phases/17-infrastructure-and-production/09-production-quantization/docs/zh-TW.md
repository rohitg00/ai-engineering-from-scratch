# 正式環境量化技術——AWQ、GPTQ、GGUF K-quants、FP8、MXFP4/NVFP4（Production Quantization — AWQ, GPTQ, GGUF K-quants, FP8, MXFP4/NVFP4）

> 量化格式的選型絕非一體適用的通用公式——它是實體硬體、推論服務引擎與業務負載特徵的三維函數。GGUF 的 Q4_K_M 或 Q5_K_M 透過 llama.cpp 與 Ollama 統治了 CPU 與邊緣運算裝置。vLLM 中若需在同一 Base 模型上並行掛載多個 LoRA 變體，GPTQ 是合適選擇。搭載 Marlin-AWQ 高效能核心的 AWQ 在 7B 等級模型上能飆出約 741 tok/s 的吞吐量，並在 INT4 精度下斬獲最優 Pass@1 正確率——是 2026 年資料中心 GPU 正式環境的事實預設。FP8 則是 Hopper、Ada 與 Blackwell 架構上的穩健中庸防線——品質近乎無損，且支援度廣泛。NVFP4 與 MXFP4（Blackwell 微縮放技術）極其激進，必須嚴格經過逐區塊品質驗收。兩大經典陷阱常讓團隊慘遭滑鐵盧：校準資料集必須嚴格匹配業務垂直領域，以及 KV 快取量化與模型權重的量化彼此獨立——誤信「我的模型已經縮小到 4 GB」的初學者，往往會忽略正式環境高並行負載下 KV 快取額外需要的 10 至 30 GB 記憶體。

**Type:** Learn
**Languages:** Python (stdlib, toy memory and throughput comparison across formats)
**Prerequisites:** Phase 10 · 13 (Quantization foundations), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 列出六大正式環境主流模型量化格式，並指明各自在 2026 年的最佳甜蜜點（Sweet spot）。
- 根據具體硬體（CPU vs GPU、Hopper vs Blackwell）、推論引擎（vLLM、TRT-LLM、llama.cpp）與業務特徵（常規對話、深層推理、Multi-LoRA），精準完成選型。
- 精確計算給定量化格式可節省的模型權重記憶體用量，並清楚評估完全不受影響的獨立 KV 快取記憶體預算。
- 指出因校準資料集領域失配而導致量化模型在特定業務流量上精度雪崩的經典陷阱。

## The Problem｜問題

模型量化大幅壓縮了實體記憶體佔用與 HBM 頻寬開銷，而這恰恰是自回歸解碼階段最渴求的物理資源。一個原始 FP16 精度的 70B 模型擁有高達 140 GB 的龐大靜態權重。若將權重以 INT4 進行量化（採用 AWQ 或 GPTQ），模型體積為 35 GB，可放入一張 H100，並留有 KV 快取空間；這一點至關重要，因為在 128 個並行請求且上下文為 2k 的正式環境負載下，光是 KV 快取本身就需要吃掉 20 至 30 GB 的 GPU 記憶體。

然而天下沒有免費的午餐。過於激進的量化會顯著損害輸出品質，特別是在深度邏輯推理任務上。不同格式適配不同的推論引擎；不同硬體架構對精度的底層原生支援亦大相徑庭。2026 年的量化格式動物園極其龐雜，你絕不能盲目抄襲其他團隊的選型配置——你必須立足於自身的全套技術堆疊展開理性決策。

## The Concept｜核心概念

### 六大主流格式（The six formats）

| 格式 | 位元 | 最適用情境 | 推論引擎 |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU、邊緣裝置、筆電 | llama.cpp、Ollama |
| GPTQ | 4-8 | vLLM 上的 Multi-LoRA | vLLM、TGI |
| AWQ | 4 | 資料中心 GPU 正式環境 | vLLM (Marlin-AWQ)、TGI |
| FP8 | 8 | Hopper/Ada/Blackwell 資料中心 | vLLM、TRT-LLM、SGLang |
| MXFP4 | 4 | Blackwell 多使用者 | TRT-LLM |
| NVFP4 | 4 | Blackwell 多使用者 | TRT-LLM |

### GGUF——CPU 與邊緣端的事實標準（GGUF — the CPU/edge default）

GGUF 本質上是一種檔案格式，而非單一的量化演算法——它能將各類 K-quant 變體（Q2_K、Q3_K_M、Q4_K_M、Q5_K_M、Q6_K、Q8_0）統一封裝於單一二進位容器中。Q4_K_M 與 Q5_K_M 是正式環境的標準預設——在 4 至 5 位元的極致壓縮下維持近乎 BF16 原生品質。對於純 CPU 或邊緣端裝置而言，這是無可爭議的最佳選擇，因為 llama.cpp 是目前速度領先許多的純 CPU 推論引擎。

在 GPU 上的 vLLM 內部運作 GGUF 的吞吐量懲罰極其嚴重：在 7B 模型上僅能跑出約 93 tok/s——因為該格式未針對 GPU kernel 進行最佳化。唯有當部署目標是 CPU 或邊緣裝置時，才選用 GGUF；其餘 GPU 場景絕不應考慮。

### GPTQ——vLLM 中的 Multi-LoRA 首選（GPTQ — multi-LoRA in vLLM）

GPTQ 是一種包含校準步驟的後訓練量化（PTQ）演算法。Marlin 核心的引入使其在現代 GPU 上的執行效率獲得了質的飛躍（相比於傳統無 Marlin 的 GPTQ 取得 2.6 倍加速）。在 7B 模型上測得約 712 tok/s 的強勁表現。

其最獨特且不可替代的王牌優勢在於：vLLM 中的 GPTQ-Int4 支援 LoRA adapters。若你的業務架構需要維運單一基礎 Base 模型並在此之上同時並行服務 10 至 50 個 fine-tuning 變體（每個變體以極輕量的獨立 LoRA 掛載），GPTQ 是一條適用路徑。截至 2026 年初，NVFP4 等新興格式尚未支援 LoRA 動態掛載。

### AWQ——資料中心 GPU 正式環境預設（AWQ — the datacenter GPU default）

活化感知權重端量化（Activation-aware Weight Quantization, AWQ）。核心哲學在於量化過程中保護約 1% 最顯著的權重。Marlin-AWQ 融合核心：相較於未最佳化的實作，可達 10.9 倍加速。在 7B 模型上測得約 741 tok/s，並在所有 INT4 格式中展現出最頂尖的 Pass@1 正確率。

新的 GPU serving 預設選 AWQ，除非需要 multi-LoRA（GPTQ）或 Blackwell FP4（NVFP4）。

### FP8——穩健可靠的折衷防線（FP8 — the reliable middle）

8 位元浮點精度。品質近乎無損。支援度廣泛。Hopper 架構的 Tensor Core 可原生加速 FP8；Blackwell 也延續這項能力。在輸出品質絕對不容妥協的核心場景下（推理、醫療、程式碼生成），FP8 是 2026 年最穩妥的安全底線。雖然其 GPU 記憶體節省幅度僅有 INT4 的一半，但其品質風險遠低於 INT4。

### MXFP4 / NVFP4——Blackwell 激進新星（MXFP4 / NVFP4 — Blackwell aggressive）

微縮放 FP4。每一小塊權重區塊皆擁有獨立的硬體級縮放因子。雖然數學精度極其激進，但獲得了 Blackwell Tensor Core 的原生硬體指令級加速。相較於 FP8，每個 token 的位元組數減半——這是 Phase 17 · 07 的經濟優勢。

核心限制：
- 截至 2026 年初，尚未支援動態 LoRA 掛載。
- 在強推理型複雜負載上存在肉眼可見的精度劣化。
- 上線前必須在專屬驗證集上針對特定模型進行嚴密的品質驗收。

### 校準資料集陷阱（The calibration trap）

AWQ 與 GPTQ 皆要求使用校準資料集，常見選擇包括 C4 或 WikiText 等通用網頁文本。對於垂直領域專用模型（程式碼生成、醫療臨床、法律合約），使用通用文字進行校準會導致演算法嚴重誤判「究竟哪些權重才值得被全力保護」。其直接後果是模型在 HumanEval 程式碼評測上的 Pass@1 得分可能暴跌數個百分點。

標準修復手段：強制使用業務垂直領域內部的真實資料進行校準。通常僅需數百條高質量的領域樣本即可完成高水準校準。正式上線前必須在驗證集上全面驗收。

### KV 快取忽略陷阱（The KV cache trap）

AWQ 僅僅將靜態模型權重壓縮至 4 位元。KV 快取是獨立的一等公民資源，依然保持 FP16 或 FP8 精度。以經過 AWQ 壓縮的 70B 模型為例：

- 模型靜態權重：約 35 GB（從原始 140 GB 壓縮至 INT4）。
- 在 128 個並行請求、2k 上下文下的 KV 快取：約 20 GB。
- 暫態活化值開銷：約 5 GB。
- GPU 記憶體總用量：約 60 GB——可裝入單張 H100 的 80 GB GPU 記憶體中。

初學者天真地驚呼「我已經把 70B 模型壓縮到了 4 GB」，卻徹底遺忘了正式環境中額外高達 30 至 50 GB 的動態 GPU 記憶體需求。在做架構容量規劃時，必須全域統籌 GPU 記憶體預算。

此外，針對 KV 快取進行專屬量化（例如 FP8 KV 或 INT8 KV）是一項正交的獨立架構抉擇——它會直接干擾注意力機制的計算精度，絕非免費的午餐。

### AWQ INT4 對複雜推理的潛在危害（AWQ INT4 is hazardous for reasoning）

長上下文的 chain-of-thought、數學及程式碼生成——這些工作負載在激進量化下會明顯受損。實測顯示 AWQ INT4 會導致模型在 MATH 競賽評測上的得分直落約 3 至 5 個百分點。對於推理密集型業務，應當堅決採用 FP8 或原生 BF16，冷靜承擔對應的 GPU 記憶體成本。

### 2026 年快速選型決策指南（2026 picking guide）

- CPU 或邊緣端裝置推論：毫不猶豫選 GGUF Q4_K_M。
- GPU 資料中心推論、常規對話互動、無 LoRA 掛載需求：首選 AWQ。
- GPU 資料中心推論、需同時並行服務多個 LoRA 變體：首選搭配 Marlin 的 GPTQ。
- 深度邏輯推理、數學計算、高難度程式碼生成：嚴格鎖定 FP8。
- 部署在 Blackwell 資料中心、且模型品質已通過嚴密線下驗證：採用 NVFP4 權重搭配 FP8 KV 快取。
- 存在不確定性：在候選格式上分別抽取 1,000 筆樣本執行橫向對比評測。

```figure
gpu-memory-breakdown
```

## Use It｜實際應用

`code/main.py` 針對多組不同的模型參數規模，精確計算橫跨六大主流格式的完整 GPU 記憶體用量（靜態權重 + 動態 KV 快取 + 暫態活化值）與相對吞吐量倍率。執行該腳本，清晰洞悉 KV 快取在何時開始主導 GPU 記憶體消耗、權重壓縮在何時帶來最大回報，以及 FP8 何時能成為最穩妥的平衡解。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-quantization-picker.md`。輸入具體實體硬體型號、模型參數量級、業務任務特徵與精度容忍度，該 Skill 將自動為你推導出最佳量化格式，並附帶一套端到端的領域校準與品質驗收工程方案。

## Exercises｜練習

1. 執行 `code/main.py`。針對 70B 模型在 128 個並行請求、2k 上下文長度下，精確計算各量化格式所需的 HBM 總記憶體容量。哪幾種格式能允許你將其完整放入單張 80GB 的 H100 之中？
2. 你負責為一個 7B 參數的程式碼生成模型進行推論架構選型。挑選出最佳格式並給出充分論證。若對品質容忍度的判斷有誤，該如何復原？
3. 為一個醫療垂直領域大模型設計 AWQ 校準方案。精確估算所需校準資料集的合理樣本量。為何資料越多不一定越好？
4. 仔細研讀 Marlin-AWQ 的核心架構論文或官方技術發布紀錄。用三句話深刻闡述：為何 AWQ 在 7B 模型上能飆出 741 tok/s，而未經 Marlin 融合的傳統 GPTQ 僅能達到約 712 tok/s？
5. 在何種特定的硬體與架構情境下，將「AWQ 權重端的量化」與「FP8 KV 快取量化」雙重疊加是理性的？何時則應當堅決保持 KV 快取於 BF16 精度？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| GGUF | 「llama.cpp 格式」 | 封裝 K-quant 變體的檔案格式；CPU／邊緣裝置的預設選擇 |
| Q4_K_M | 「Q4 K M」 | 4 位元 K-quant 中等版本；正式環境的 GGUF 預設選擇 |
| GPTQ | 「字母 G、P、T、Q」 | 經校準的訓練後 INT4 量化；在 vLLM 中支援 LoRA |
| AWQ | 「A-W-Q」 | 活化感知 INT4；搭配 Marlin 核心；INT4 中 Pass@1 表現最佳 |
| Marlin kernels | 「快速 INT4 核心」 | Hopper 上用於 INT4 的自訂 CUDA 核心；速度提升 10 倍 |
| FP8 | 「8 位元浮點格式」 | Hopper／Ada／Blackwell 上的安全精度預設選擇 |
| MXFP4 / NVFP4 | 「微縮放 4 位元格式」 | Blackwell 的 4 位元浮點格式，採用逐區塊縮放因子 |
| Calibration dataset | 「校準資料」 | 用來選擇量化參數的輸入文字；應符合目標領域 |
| KV cache quantization | 「KV INT8」 | 與量化模型權重分開的選擇；會影響注意力精度 |

## Further Reading｜延伸閱讀

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) — 2026 年最新量化技術深度橫向評測。
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) — 跨格式的吞吐量基準實測數字。
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) — 格式逐一選型剖析指南。
- [vLLM docs — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html) — 官方支援的量化格式與命令列參數對照表。
- [AWQ paper (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) — AWQ 活化感知量化原創奠基論文。
- [GPTQ paper (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) — GPTQ 演算法原著。
