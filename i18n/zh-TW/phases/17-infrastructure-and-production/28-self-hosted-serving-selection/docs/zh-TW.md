# 自建模型服務選型——硬體與規模的終極適配（Self-Hosted Serving Selection — Matching Engine to Hardware and Scale）

> 推論引擎的選型是底層硬體、並行規模與軟體生態的三維函數——絕非單純閱讀效能排行榜所能決定。2026 年自建推論領域由四大主力引擎統治：llama.cpp、Ollama、vLLM 與 SGLang，而昔日明星 TGI 則落入維護模式。**llama.cpp** 在純 CPU 運算上速度最快——具備最廣泛的模型型錄支援，提供對量化精度與多執行緒的完全控制權。**Ollama** 是個人筆電上一鍵安裝的開發工具，但比原生 llama.cpp 慢約 15% 至 30%（源於 Go + CGo + HTTP 序列化開銷），在類正式環境的高並行負載下吞吐量存在高達 3 倍的鴻溝。**TGI 於 2025 年 12 月 11 日正式轉入維護模式**——未來僅提供錯誤修復，原始吞吐量比 vLLM 慢約 10%，但歷史上擁有頂級的可觀測性與 Hugging Face 原生生態整合。維護模式使其成為高風險的長遠賭注——新專案應轉向 vLLM 或 SGLang。**vLLM** 是通用正式環境的事實標準——v0.15.1（2026 年 2 月）新增 PyTorch 2.10、RTX Blackwell SM120 支援與 H200 最佳化。**SGLang** 則是多輪對話 Agent 與前綴密集型任務的專精引擎，已在正式環境中部署於超過 40 萬張 GPU（xAI、LinkedIn、Cursor、Oracle、GCP、Azure、AWS）。硬體硬約束：純 CPU 優先 → 首選 llama.cpp；AMD 異質運算 → vLLM 是獲得最強支援的坦途（TRT-LLM 深度綁定 NVIDIA）。2026 年標準管線模式：開發端 = Ollama，預發布環境 = llama.cpp，正式環境 = vLLM 或 SGLang。各引擎吃不同的權重格式——llama.cpp 家族吃 GGUF，GPU 引擎吃 Hugging Face safetensors——在各階段之間可能需要進行格式轉換。

**Type:** Learn
**Languages:** Python (stdlib, engine-decision tree walker)
**Prerequisites:** All Phase 17 lessons covering engines (04, 06, 07, 09, 18)
**Time:** ~45 minutes

## Learning Objectives｜學習目標

- 依據底層硬體（CPU / AMD / NVIDIA Hopper / Blackwell）、並行規模（單人 / 百人 / 萬人）與業務類型（常規聊天 / Agent 多輪 / 超長上下文），精準完成推論引擎選型。
- 深刻理解 TGI 於 2025 年 12 月 11 日進入維護模式的歷史分水嶺，並陳述為何新專案應當導向 vLLM 或 SGLang。
- 熟練描述標準的「開發 → 預發布 → 正式」分階管線架構，並說明 GGUF 轉 safetensors 格式轉換在各階段之間的實體位置。
- 深刻解釋為何「CPU 優先」直接指向 llama.cpp，以及為何「採用 AMD 硬體」會直接一票否決 TRT-LLM。

## The Problem｜問題

你的團隊即將啟動一項私有化自建 LLM 推論服務。一位工程師強推 Ollama，另一位工程師非 vLLM 不用，第三位工程師則好奇發問「Hugging Face 的 TGI 難道不能開箱即用嗎？」這三種主張放在特定的孤立語境下皆有其道理，但沒有任何一個引擎適用所有情境。

在 2026 年，選型決策樹擁有不可顛倒的優先順序：硬體維度第一、並行規模第二、業務特徵第三。此外，一項發生在 2025 年底的標誌性產業大事件——TGI 於 12 月 11 日正式轉入維護模式——徹底改寫了新專案的預設起點。

## The Concept｜核心概念

### 五大主流推論引擎（The five engines）

| 推論引擎 | 核心甜蜜點 | 關鍵維運備註 |
|--------|----------|-------|
| **llama.cpp** | 純 CPU / 邊緣端 / 極簡依賴 / 最廣泛模型型錄 | 純 CPU 速度之王，提供量化與多執行緒的完整控制 |
| **Ollama** | 開發者本機筆電、單人測試、一鍵安裝 | 效能比 llama.cpp 慢 15-30%；正式環境並行吞吐落後 3 倍 |
| **TGI** | Hugging Face 生態深度綁定、強監管產業 | **已於 2025 年 12 月 11 日正式轉入維護模式** |
| **vLLM** | 通用企業級正式環境、100+ 並行使用者 | 業界通用預設標準；2026 年 2 月釋出 v0.15.1 |
| **SGLang** | 多步驟 Agent、前綴密集型 RAG 業務 | 超過 40 萬張 GPU 用於正式環境 |

### 第一維度：硬體決定起點（Hardware-first decision）

**純 CPU 優先** → 堅決選用 llama.cpp。Ollama 雖然也能跑但速度明顯滯後。其他推論引擎在純 CPU 環境下都缺乏競爭力。

**AMD GPU 叢集** → vLLM 是目前支援度最高的路徑（支援 AMD ROCm）。SGLang 亦支援 AMD。而 TRT-LLM 由於深度綁定 NVIDIA，在此被一票否決出局。

**NVIDIA Hopper 架構（H100 / H200）** → vLLM、SGLang 與 TRT-LLM 皆屬頂級梯隊。

**NVIDIA Blackwell 架構（B200 / GB200）** → TRT-LLM 在吞吐量上領先（第 17 課第 07 節）。vLLM 與 SGLang 緊隨其後。

**Apple Silicon（M 系列晶片）** → llama.cpp（Metal）。Ollama 本質上是對其進行了外層包裝。

### 第二維度：並行規模決定拓撲（Scale-second decision）

**單人 / 本機開發測試** → 果斷選用 Ollama。單行指令拉起，數秒內輸出第一個字。

**10 至 100 位並行使用者 / 小型團隊** → vLLM 單 GPU。

**100 至 10,000 位並行使用者 / 正式環境** → vLLM production-stack（第 17 課第 18 節）或 SGLang。

**10,000 以上超大規模並行 / 企業** → vLLM production-stack + Prefill/Decode 物理拆解（第 17 課第 17 節） + LMCache 叢集快取（第 17 課第 18 節）。

### 第三維度：業務負載決定專精（Workload-third decision）

**常規開放式對話 / 簡短問答** → vLLM 是穩妥的通用預設選擇。

**多輪對話 agent（工具呼叫、規劃、記憶）** → SGLang 的 RadixAttention 基數樹快取（第 17 課第 06 節）表現突出。

**前綴高度重複的巨型 RAG 檢索** → 推薦 SGLang。

**程式碼自動補全與生成** → vLLM 表現優秀；SGLang 在專屬快取加持下略勝一籌。

**超長上下文推論（128k+）** → vLLM 搭配分塊 Prefill；SGLang 搭配階梯式分層 KV 快取。

### TGI 維護模式陷阱（The TGI maintenance trap）

Hugging Face 官方於 2025 年 12 月 11 日正式宣告 TGI 轉入維護模式——未來僅提供錯誤修正，實質停止功能演進。在歷史上，TGI 曾擁有頂級的可觀測性指標與無可挑剔的 Hugging Face 生態深度咬合，原始吞吐量僅略微落後於 vLLM。

但在 2026 年啟動新專案時：不應預設採用 TGI。既有的 TGI 部署可以繼續使用，但最終應遷移。SGLang 與 vLLM 是較安全的預設選項。

### 漸進式管線模式（The pipeline pattern）

開發環境（Ollama） → 預發布環境（llama.cpp） → 正式環境（vLLM）。不同引擎吃完全不同的二進位權重格式——llama.cpp 家族使用量化封裝後的 GGUF，而現代 GPU 推論引擎使用原生 Hugging Face safetensors 格式——因此跨階段時，工程管線中可能需要安排格式轉換。工程師在筆電上快速迭代；預發布環境對應正式環境的量化設定；正式環境供服務使用。

### Ollama 的邊界警示（Ollama caveat）

Ollama 很適合開發，但不太適合共用的正式環境：Go HTTP 序列化會增加負荷，並行管理比 vLLM 簡單，OpenTelemetry 支援也較落後。在它最擅長的情境中使用它——單一使用者、一個指令；共用情境則改用 vLLM。

### 自建 vs 託管是一項獨立決策（Self-hosted vs managed is a separate decision）

第 17 課第 01 節（超大規模雲端託管）與第 02 節（新興推論算力平台）已完整剖析了託管服務的經濟學。本課的所有決策建立在「團隊已出於商業或法規考量決定私有化自建」的基礎之上。推動自建的核心驅動力：嚴苛的境內資料落地隱私限制、極致客製化的私有 fine-tuning 模型、超大規模下的 TCO（總體擁有成本）考量，或是垂直領域專用模型在公共雲端市集中無法取得。

### 務必銘記的核心數字指標（Numbers you should remember）

- TGI 轉入維護模式官方時間：2025 年 12 月 11 日。
- vLLM v0.15.1 里程碑：2026 年 2 月釋出；新增 PyTorch 2.10，並支援 Blackwell SM120 架構。
- SGLang 正式環境部署規模：超過 40 萬張 GPU。
- Ollama 與原生 llama.cpp 效能差距：慢 15% 至 30%；在正式環境高壓下吞吐量存在高達 3 倍落差。

```figure
data-parallel
```

## Use It｜實際應用

`code/main.py` 實作一個決策樹：輸入硬體架構、目標並行規模與業務負載特徵，程式會選擇引擎並說明原因。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-engine-picker.md`。根據現有限制，該 Skill 選擇推論引擎並撰寫遷移計畫。

## Exercises｜練習

1. 執行 `code/main.py`。依據你所在團隊的真實硬體資產、並行規模與業務型態輸入參數。推導出的引擎選型是否與你的架構直覺完全吻合？
2. 你的基礎架構有 12 張 H100 和 8 張 AMD MI300X。應選哪個引擎？為什麼 TRT-LLM 不適用？
3. 團隊想在 2026 年使用 TGI，理由是「我們熟悉它」。請說明遷移的理由。
4. 梳理從「Ollama 開發環境」向「vLLM 正式環境」邁進時的全流程架構變更清單：涵蓋權重格式量化、引擎啟動配置以及分散式可觀測性埋點。
5. 針對 P99 輸入前綴達到 8k Token、且跨租戶之間存在高頻重複命中特徵的企業級 RAG 檢索產品，挑選推論引擎，並說明如何搭配第 17 課第 11 節與第 18 節的技術。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| llama.cpp | 「CPU 專用」 | 支援的模型最廣，在 CPU 上速度最快 |
| Ollama | 「筆電用」 | 一個指令即可安裝，吞吐量適合開發用途 |
| TGI | 「HF 的推論服務」 | 自 2025 年 12 月起進入維護模式 |
| vLLM | 「預設選項」 | 2026 年通用的正式環境基準方案 |
| SGLang | 「agent 專用」 | 適合前綴密集型工作負載，採用 RadixAttention |
| TRT-LLM | 「綁定 NVIDIA」 | Blackwell 吞吐量領先，僅支援 NVIDIA |
| GGUF | 「llama.cpp 格式」 | 封裝多種 K-quant 變體 |
| Production-stack | 「vLLM Kubernetes」 | 第 17 課第 18 節的參考部署 |
| Pipeline pattern | 「開發→預發布→正式」 | Ollama → llama.cpp → vLLM；各引擎使用不同權重格式 |

## Further Reading｜延伸閱讀

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference) — 版本資訊。
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
