# 生產級量化 —— AWQ、GPTQ、GGUF K-quant、FP8、MXFP4/NVFP4

> 量化格式不是一個放諸四海的選擇 —— 它是硬體、服務引擎與工作負載的函數。GGUF 的 Q4_K_M 或 Q5_K_M 統治 CPU 與邊緣，透過 llama.cpp 與 Ollama 交付。當你需要在同一個基礎模型上做多 LoRA 時，GPTQ 在 vLLM 裡勝出。配上 Marlin-AWQ 核心的 AWQ，在 7B 等級模型上交出約 741 tok/s，且在 INT4 中 Pass@1 最好 —— 那是 2026 年資料中心生產的預設。FP8 在 Hopper、Ada 與 Blackwell 上仍是中間地帶 —— 幾乎無損且廣泛支援。NVFP4 與 MXFP4（Blackwell 的微縮放）很激進，需要逐區塊驗證。有兩個陷阱會咬到團隊：校準資料集必須與部署領域相符，以及 KV 快取與權重量化是分開的 —— 那句「我的模型現在只有 4 GB 了」的 AWQ 教訓，忘了生產批次大小下那 10-30 GB 的 KV 快取。

**類型：** 學習
**程式語言：** Python (stdlib, toy memory and throughput comparison across formats)
**先修單元：** 階段 10 · 13（量化基礎）、階段 17 · 04（服務引擎內部）
**時間：** 約 75 分鐘

## 學習目標

- 說出 2026 年那六種生產量化格式，以及各自的甜蜜點。
- 在給定硬體（CPU 對 GPU、Hopper 對 Blackwell）、引擎（vLLM、TRT-LLM、llama.cpp）與工作負載（日常聊天、推理、多 LoRA）之下挑出一種格式。
- 算出某種選定格式所省下的權重記憶體，以及那份沒被動到的 KV 快取。
- 說出那個會讓量化模型在領域流量上退化的校準資料集陷阱。

## 問題所在

量化降低記憶體與 HBM 頻寬，而那正是解碼需要的。一個 FP16 的 70B 模型是 140 GB 的權重。把權重量化到 INT4（AWQ 或 GPTQ），模型就變成 35 GB —— 裝得進一張 H100 而且還有空間放 KV 快取，這很要緊，因為在 128 個併發序列、2k 脈絡下，光是 KV 快取就要 20-30 GB。

但量化不是免費的。激進的量化會讓品質退化，尤其在推理吃重的任務上。不同格式搭配不同引擎。不同硬體原生支援不同精度。2026 年這座格式動物園是真的，而你沒辦法照抄別人的選擇 —— 你得依自己的堆疊來挑。

## 核心概念

### 那六種格式

| 格式 | 位元 | 甜蜜點 | 引擎 |
|--------|------|-----------|------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU、邊緣、筆電 | llama.cpp、Ollama |
| GPTQ | 4-8 | vLLM 上的多 LoRA | vLLM、TGI |
| AWQ | 4 | 資料中心 GPU 生產 | vLLM（Marlin-AWQ）、TGI |
| FP8 | 8 | Hopper/Ada/Blackwell 資料中心 | vLLM、TRT-LLM、SGLang |
| MXFP4 | 4 | Blackwell 多使用者 | TRT-LLM |
| NVFP4 | 4 | Blackwell 多使用者 | TRT-LLM |

### GGUF —— CPU／邊緣的預設

GGUF 本身是一種檔案格式，不完全算是一套量化方案 —— 它把各種 K-quant 變體（Q2_K、Q3_K_M、Q4_K_M、Q5_K_M、Q6_K、Q8_0）裝在同一個容器裡。Q4_K_M 與 Q5_K_M 是生產預設 —— 4-5 位元就有接近 BF16 的品質。對 CPU 或邊緣服務來說是最好的選擇，因為 llama.cpp 是目前最快的 CPU 推論引擎。

在 vLLM 中的吞吐量代價：7B 上約 93 tok/s —— 這個格式不是為 GPU 核心最佳化的。當部署目標是 CPU／邊緣時用 GGUF。其他時候不要。

### GPTQ —— vLLM 中的多 LoRA

GPTQ 是一套帶校準流程的訓練後量化演算法。Marlin 核心讓它在 GPU 上很快（相對非 Marlin 的 GPTQ 有 2.6 倍加速）。7B 上約 712 tok/s。

它獨有的斬獲是：GPTQ-Int4 在 vLLM 中支援 LoRA 轉接器。若你在服務一個基礎模型加 10-50 個微調變體（每個是一個 LoRA），GPTQ 就是你的路。截至 2026 年初，NVFP4 尚不支援 LoRA。

### AWQ —— 資料中心 GPU 的預設

Activation-aware Weight Quantization（活化值感知的權重量化）。在量化過程中保護那約 1% 最關鍵的權重。Marlin-AWQ 核心：相對天真實作有 10.9 倍加速。7B 上約 741 tok/s，是 INT4 格式中 Pass@1 最好的。

新的 GPU 服務就挑 AWQ，除非你需要多 LoRA（GPTQ）或激進的 Blackwell FP4（NVFP4）。

### FP8 —— 那個可靠的中間值

8 位元浮點。幾乎無損。廣泛支援。Hopper 的 Tensor Core 原生加速 FP8。Blackwell 繼承下來。當品質不容妥協時（推理、醫療、程式碼生成），FP8 是 2026 年安全的預設。記憶體節省是 INT4 的一半，但品質風險低得多。

### MXFP4／NVFP4 —— Blackwell 上的激進派

微縮放 FP4。每一小塊權重有自己的縮放因子。激進，但在 Blackwell 的 Tensor Core 上有硬體加速。相對 FP8 把每詞元的位元組數再砍一半 —— 那就是階段 17 · 07 中那筆經濟斬獲。

但書：
- 目前尚不支援 LoRA（2026 年初）。
- 在推理吃重的工作負載上品質下降是看得見的。
- 每個模型都要在你自己的評測集上驗證。

### 那個校準陷阱

AWQ 與 GPTQ 需要一份校準資料集 —— 通常是 C4 或 WikiText。對領域模型（程式碼、醫療、法律）而言，拿一般網路文字做校準，會讓演算法對「該保護哪些權重」做出錯誤決策。HumanEval 上的 Pass@1 可能掉好幾分。

修法：用領域內資料做校準。幾百筆領域樣本通常就夠。出貨前在評測集上測。

### 那個 KV 快取陷阱

AWQ 把權重縮到 4 位元。KV 快取是分開的，仍維持在 FP16/FP8。對一個用 AWQ 的 70B 模型：

- 權重：約 35 GB（從 140 GB 變 INT4）。
- 128 併發 × 2k 脈絡的 KV 快取：約 20 GB。
- 活化值：約 5 GB。
- 總計：約 60 GB —— 裝得進 H100 80GB。

天真地說「我把模型量化到 4 GB 了」，就忘了另外那 30-50 GB。要整體地編列 HBM 預算。

另外，KV 快取量化（FP8 KV 或 INT8 KV）是另一項選擇、有它自己的取捨 —— 它直接影響注意力的準確度，不是免費的斬獲。

### AWQ INT4 對推理有危險

思維鏈、數學、長脈絡的程式碼生成 —— 這些在激進量化下受害得很明顯。AWQ INT4 在 MATH 上會掉約 3-5 分。對推理吃重的工作負載，出貨 FP8 或 BF16；接受那筆記憶體成本。

### 2026 年的挑選指南

- CPU／邊緣服務：GGUF Q4_K_M。就這樣。
- GPU 服務、日常聊天、不用 LoRA：AWQ。
- GPU 服務、多 LoRA：GPTQ 配 Marlin。
- 推理型工作負載：FP8。
- Blackwell 資料中心、品質已驗證：NVFP4 + FP8 KV。
- 難以判斷：對每個候選格式跑一份 1,000 樣本的評測。

```figure
gpu-memory-breakdown
```

## 框架應用

`code/main.py` 針對一系列模型大小，算出六種格式各自的記憶體佔用（權重 + KV + 活化值）與相對吞吐量。它會顯示 KV 快取在哪裡主導、權重壓縮在哪裡划算，以及 FP8 在哪裡是安全的選擇。

[Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?dtype=fp8&users=64) 這台機器展示了 NVIDIA L4 上的 FP8。權重從 15.28 GB 降到 8.81 GB，KV 池從 24,094 個詞元擴大到 142,369 個詞元，而 64 位使用者時實測的輸出從每秒 250.85 個詞元提升到 735.91 個詞元。

## 產出交付

這一課產出 `outputs/skill-quantization-picker.md`。給定硬體、模型大小、工作負載型別與品質容忍度，挑出一種格式並產出一份校準／驗證計畫。

## 練習

1. 跑 `code/main.py`。對一個 70B 模型、128 併發、2k 脈絡，算出每種格式的總 HBM。哪一種格式能讓你裝進一張 H100 80GB？
2. 你有一個 7B 的寫程式模型。挑一種格式並論證。若你對品質容忍度判斷錯了，救援路徑是什麼？
3. 算出替一個醫療領域模型校準 AWQ 所需的校準資料集大小。為什麼資料愈多不一定愈好？
4. 讀 Marlin-AWQ 的核心論文或發行說明。用三句話解釋為何 AWQ 在 7B 上打到 741 tok/s，而純 GPTQ 只有約 712。
5. 什麼時候「AWQ 權重配 FP8 KV 快取」比「KV 維持在 BF16」更說得通？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| GGUF | 「llama.cpp 的格式」 | 把各種 K-quant 變體裝在一起的檔案格式；CPU／邊緣的預設 |
| Q4_K_M | 「Q4 K M」 | 4 位元 K-quant 中等版；生產上的 GGUF 預設 |
| GPTQ | 「G P T Q」 | 帶校準的訓練後 INT4；在 vLLM 中支援 LoRA |
| AWQ | 「A W Q」 | 活化值感知的 INT4；Marlin 核心；INT4 中 Pass@1 最好 |
| Marlin 核心 | 「快速的 INT4 核心」 | Hopper 上供 INT4 使用的自訂 CUDA 核心；10 倍加速 |
| FP8 | 「八位元浮點」 | Hopper/Ada/Blackwell 上安全的精度預設 |
| MXFP4／NVFP4 | 「微縮放四位元」 | Blackwell 的 4 位元浮點，帶逐區塊縮放因子 |
| 校準資料集 | 「校準資料」 | 用來挑選量化參數的輸入文字；必須與領域相符 |
| KV 快取量化 | 「KV INT8」 | 與權重分開的另一項選擇；影響注意力的準確度 |

## 延伸閱讀

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) —— 比較性的基準。
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) —— 逐格式的吞吐量數字。
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) —— 逐格式的挑選建議。
- [vLLM docs — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html) —— 支援的格式與旗標。
- [AWQ paper (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) —— 最初的 AWQ 表述。
- [GPTQ paper (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) —— 最初的 GPTQ 表述。
