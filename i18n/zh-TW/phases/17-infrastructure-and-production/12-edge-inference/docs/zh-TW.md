# 邊緣端推論——Apple 神經網路引擎、Qualcomm Hexagon、WebGPU/WebLLM、Jetson（Edge Inference — Apple Neural Engine, Qualcomm Hexagon, WebGPU/WebLLM, Jetson）

> 邊緣端推論的核心物理約制是記憶體頻寬，絕非單純的算力（TOPS）。行動端 DRAM 頻寬通常僅有 50 至 90 GB/s；而資料中心的 HBM3 頻寬早已跨越 2 至 3 TB/s——足足存在 30 至 50 倍的巨大鴻溝。自回歸解碼是典型的記憶體頻寬受限操作，因此這項頻寬落差具有決定性影響。2026 年邊緣端技術版圖分成四個方向：Apple M4/A18 神經網路引擎（ANE）峰值達 38 TOPS，享有零拷貝的統一記憶體架構（無需在 CPU 與 NPU 之間搬移權重）。Qualcomm Snapdragon X Elite / 8 Gen 4 的 Hexagon NPU 達到 45 TOPS。WebGPU + WebLLM 在 M3 Max 上運作 Llama 3.1 8B（Q4）能達到約 41 tok/s（達到原生效能的 70% 至 80%），在 GitHub 上有 1.76 萬顆星、提供 OpenAI 相容 API 並覆蓋約 70% 至 75% 的行動瀏覽器。NVIDIA Jetson 家族中，Orin Nano Super（8GB）可運作 Llama 3.2 3B 與 Phi-3；AGX Orin 透過 vLLM 運作 gpt-oss-20b 達到約 40 tok/s；Jetson T4000（JetPack 7.1）效能更是 AGX Orin 的 2 倍。TensorRT Edge-LLM 全面支援 EAGLE-3、NVFP4 與分塊 Prefill——並於 CES 2026 上由 Bosch、ThunderSoft 與聯發科聯袂展出。

**Type:** Learn
**Languages:** Python (stdlib, toy bandwidth-bound decode simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 09 (Production Quantization)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 解釋為何行動端 LLM 推論受限於記憶體頻寬，以及為何運算能力在此居於次要地位。
- 梳理四大邊緣端目標平台（Apple ANE、Qualcomm Hexagon、WebGPU/WebLLM、NVIDIA Jetson），並將各自對應至使用情境。
- 指出 2026 年 WebGPU 在行動端的瀏覽器覆蓋邊界（Firefox Android 仍在追趕、Safari iOS 26 正式支援）。
- 為不同硬體平台精準匹配量化格式（ANE 採 Core ML INT4 + FP16、Hexagon 採 QNN INT8/INT4、瀏覽器採 WebGPU Q4、Jetson Thor 採 NVFP4）。

## The Problem｜問題

某客戶要求打造一款在裝置上運作的聊天機器人：語音優先、預設保護隱私、可離線使用。在配備 M3 Max 的 MacBook Pro 上，Llama 3.1 8B Q4 模型的 token 生成速度約為 55 tok/s——體驗極其流暢。然而在 iPhone 16 Pro 上，相同模型退化至 3 tok/s——表現不佳。在搭載 Snapdragon 8 Gen 3 的中階 Android 手機上，實測約 7 tok/s。而在 Chrome Android v121+ 的行動瀏覽器中透過 WebGPU 執行，速度落在 4 至 8 tok/s 之間。

如此劇烈的吞吐量差異絕非單純的軟體移植不良。它是物理記憶體頻寬差距 × 模型量化格式 × NPU 是否開放使用者空間直接存取的三重綜合體現。2026 年的邊緣端推論包含四種不同的問題，各自有不同的解決方案。

## The Concept｜核心概念

### 頻寬才是真正的物理天花板（Bandwidth is the real ceiling）

自回歸解碼每產出一個 Token，GPU/NPU 就必須將全量模型權重從記憶體完整讀取一遍。一個 7B 參數模型在 Q4 精度下體積約為 3.5 GB。在頻寬為 50 GB/s 的常規行動 DRAM 上，光是搬移這 3.5 GB 權重就必須耗費 70 ms——這意味著理論吞吐量天花板死死卡在約 14 tok/s。即便在頻寬高達 90 GB/s 的旗艦級行動 DRAM 上，物理天花板亦僅能挪至約 25 tok/s。在該物理上限面前，堆砌再多的 TOPS 算力皆無濟於事。

相比之下，資料中心的 HBM3 擁有高達 3 TB/s 的恐怖頻寬，僅需 1.2 ms 即可將完全相同的 3.5 GB 讀取完畢——理論解碼天花板高達 830 tok/s。完全相同的模型，完全相同的權重；截然不同的底層記憶體物理子系統。

### Apple 神經網路引擎（M4 / A18 ANE）

- 提供高達 38 TOPS 的算力。採用晶片級統一記憶體架構（CPU 與 ANE 共享同一個實體記憶體池）——徹底消除了昂貴的記憶體跨單元搬移開銷。
- 軟體存取途徑：透過 Core ML 使用編譯後的 `.mlmodel` 模型，或在 PyTorch 中透過 Metal Performance Shaders（MPS）使用。
- llama.cpp 的 Metal 後端使用 MPS，而非直接使用 ANE；若要原生使用 ANE，需轉換為 Core ML。
- 2026 年 iOS 應用的最佳實踐路徑：Core ML 搭配 INT4 權重 + FP16 活化值。

### Qualcomm Hexagon（Snapdragon X Elite / 8 Gen 4）

- 具備高達 45 TOPS 算力。雖然整合於同一個 SoC 中，但與 CPU/GPU 擁有獨立劃分的記憶體網域。
- 提供專屬的 QNN（Qualcomm Neural Network）SDK 與高通 AI Hub，支援將 PyTorch/ONNX 模型進行針對性轉換編譯。
- Chat templates、Llama 3.2、Phi-3 都以一級工件的形式在 AI Hub 上提供。

### Intel / AMD NPU（Lunar Lake、Ryzen AI 300）

- 算力落在 40 至 50 TOPS 區間。上層軟體堆疊成熟度略微落後於 Apple 與高通；Intel OpenVINO 持續改良但依然偏小眾。
- 最佳適配場景：Windows ARM 上的 Copilot 應用，以及在 AMD/Intel 桌機上原生執行、採用本機優先（local-first）設計的應用。

### WebGPU + WebLLM

- 透過瀏覽器的 WebGPU 運算著色器（Compute Shader）在使用者裝置上直接驅動本機硬體運算；完全免安裝。
- 在 M3 Max 晶片上透過 WebLLM 運作 Llama 3.1 8B Q4 能達到約 41 tok/s——約為同一後端原生執行效能的 70% 至 80%。
- WebLLM 在 GitHub 上有 1.76 萬顆星；提供完全相容 OpenAI 的 JavaScript 用戶端 API；採商業友善的 Apache 2.0 開源協議。
- 2026 年瀏覽器相容覆蓋率：Chrome Android v121+、Safari iOS 26 已正式推出（GA），Firefox Android 仍在全力追趕。行動端整體裝置覆蓋率約達 70% 至 75%。

### NVIDIA Jetson 家族（NVIDIA Jetson family）

- Orin Nano Super（8GB）：可容納 Llama 3.2 3B 與 Phi-3，並有不錯的 tok/s 表現。
- AGX Orin：透過 vLLM 運作 gpt-oss-20b，約 40 tok/s。
- Thor / T4000（搭載 JetPack 7.1）：效能達到 AGX Orin 的 2 倍，且支援 EAGLE-3 與 NVFP4。
- TensorRT Edge-LLM（2026 年發布）：將雲端資料中心的頂級特化技術（EAGLE-3 推測解碼、NVFP4 權重壓縮、分塊 Prefill）完整下沉移植至邊緣端內嵌式晶片。

### 各邊緣目標硬體的量化格式選型（Quantization choice per target）

| 目標平台 | 推薦量化格式 | 架構實務指南 |
|--------|--------|-------|
| Apple ANE | INT4 權重 + FP16 活化值 | 採用 Core ML 官方轉換管線 |
| Qualcomm Hexagon | QNN INT8 / INT4 | 優先使用高通 AI Hub 預轉換工件 |
| WebGPU / WebLLM | Q4 MLC (q4f16_1) | 使用 `mlc_llm convert_weight` 並產出編譯後 `.wasm`；不支援 GGUF |
| Jetson Orin Nano | Q4 GGUF 或 TRT-LLM INT4 | 受記憶體頻寬限制 |
| Jetson AGX / Thor | NVFP4 權重 + FP8 KV 快取 | 走專屬 Edge-LLM 編譯路徑 |

### 邊緣端的超長上下文陷阱（The long-context trap on edge）

Llama 3.1 宣稱的 128k 超長上下文是一項資料中心特性。在總記憶體僅有 8 GB 的手機上：4 GB 模型權重 + 32k 上下文所需的 2 GB KV 快取 + 作業系統開銷 = 瞬間觸發 OOM 崩潰閃退。邊緣端部署通常將上下文維持在 4K-8K，除非接受積極的 KV 量化（Q4 KV）。

### 語音是邊緣端最具爆發力的殺手級應用（Voice is the killer app）

語音 Agent 是典型的延遲極度敏感型業務（第一個 token < 500 ms）。邊緣端本機推論徹底消除了跨國跨網的實體網路傳輸延遲。結合語音轉文字（Whisper Turbo 變體可在邊緣端執行），邊緣推論便能形成正式環境品質的語音互動迴圈。

### 務必銘記的核心數字指標（Numbers you should remember）

- Apple M4 / A18 ANE 算力：38 TOPS。
- Qualcomm Hexagon（Snapdragon X Elite）：45 TOPS。
- WebLLM 在 M3 Max 上的實測效能：Llama 3.1 8B Q4 達到約 41 tok/s。
- Jetson AGX Orin 運作 gpt-oss-20b：約 40 tok/s。
- 資料中心與邊緣端實體記憶體頻寬落差：高達 30 至 50 倍。
- 行動端 WebGPU 覆蓋率：約 70% 至 75%（Firefox Android 仍在追趕）。

```figure
edge-bandwidth-pipe
```

## Use It｜實際應用

`code/main.py` 基於記憶體頻寬物理極限，計算跨各主流邊緣端硬體的理論解碼吞吐量上限。將理論計算值與真實跑分進行比對，清晰揭示在何種精度與晶片架構下，記憶體頻寬（而非運算力）將成為瓶頸。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-edge-target-picker.md`。輸入目標平台（iOS、Android、Web 瀏覽器、Jetson 機器人）、模型規格與嚴苛的記憶體／延遲預算，該 Skill 會挑選量化格式與模型轉換管線。

## Exercises｜練習

1. 執行 `code/main.py`。針對配備 Snapdragon 8 Gen 3（記憶體頻寬約 77 GB/s）的中階 Android 手機，計算其運作 7B Q4 模型的理論解碼極限吞吐量。將其與業界實測觀察到的 6 至 8 tok/s 進行對比——評估目前執行環境的底層硬體利用效率如何？
2. Android 上的 WebGPU 要求 Chrome v121+。為舊版瀏覽器設計備援方案，透過相同的 OpenAI 相容 API 在伺服器端處理。
3. 你的 iOS App 要求必須支援 4k 上下文的串流輸出。哪一種模型規格與量化格式的組合，能確保系統在 iPhone 16 上運作時活躍記憶體始終壓低在 4 GB 安全線以內？
4. Jetson AGX Orin 以 40 tok/s 執行 gpt-oss-20b；Jetson Nano 僅能容納 3B 模型。若你的產品同時支援這兩款裝置，你該如何在軟體層面統一維護推論服務技術堆疊？
5. 深入辯論「WebLLM 在 2026 年是否已可用於正式環境」，並引用瀏覽器支援範圍、效能與 Firefox Android 的缺口。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| ANE | 「Apple 神經網路引擎」 | M 系列與 A 系列裝置上的 NPU；採用統一記憶體 |
| Hexagon | 「Qualcomm NPU」 | Snapdragon NPU；透過 QNN SDK 存取 |
| WebGPU | 「瀏覽器 GPU」 | W3C 標準化的瀏覽器 GPU API；2026 年支援 Chrome／Safari |
| WebLLM | 「瀏覽器 LLM 執行環境」 | MLC-LLM 專案；Apache 2.0 授權；提供相容 OpenAI 的 JS API |
| Jetson | 「NVIDIA 邊緣平台」 | Orin Nano、AGX、Thor、T4000 系列 |
| TRT Edge-LLM | 「邊緣版 TensorRT」 | TensorRT-LLM 的 2026 年邊緣版本；支援 EAGLE-3 與 NVFP4 |
| Unified memory | 「共用記憶體」 | CPU 與 NPU 存取相同的 RAM；不需複製資料 |
| Bandwidth-bound | 「受記憶體限制」 | 解碼速度受每秒讀取權重的位元組數限制 |
| Core ML | 「Apple 轉換工具」 | Apple 用於 ANE 原生模型的框架 |
| QNN | 「Qualcomm 工具鏈」 | Qualcomm Neural Network SDK |

## Further Reading｜延伸閱讀

- [On-Device LLMs State of the Union 2026](https://v-chandra.github.io/on-device-llms/) — 邊緣端大模型技術現況與基準測試。
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) — Jetson 機器人與邊緣端推論指南。
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/) — 2026 年邊緣端特化推論引擎發布全貌。
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) — 瀏覽器端推論引擎架構設計與實測論文。
- [Apple Core ML](https://developer.apple.com/documentation/coreml) — ANE 原生模型轉換。
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) — 提供 Hexagon 可用的預先轉換模型。
