# Chọn dịch vụ tự chủ  Đáp ứng động cơ với phần cứng và quy mô

> Sự lựa chọn động cơ là một chức năng của phần cứng, quy mô và hệ sinh thái không phải là một bài đọc bảng xếp hạng. Bốn động cơ thống trị suy luận tự lưu trữ vào năm 2026: llama.cpp, Ollama, vLLM, SGLang, với TGI bị bỏ lại trong chế độ bảo trì.**llama.cpp**là nhanh nhất trên CPU  hỗ trợ mô hình rộng nhất, kiểm soát đầy đủ về định lượng và threading. **Ollama**là cài đặt một lệnh dev-laptop, ~ 15-30% chậm hơn llama.cpp (Go + CGo + HTTP serialization), khoảng cách thông qua 3x dưới tải giống như prod. **TGI entered maintenance mode December 11, 2025** chỉ sửa lỗi, ~ 10% thông qua nguyên liệu chậm hơn vLLM nhưng lịch sử có khả năng quan sát cao nhất và tích hợp hệ sinh thái HF. Tình trạng bảo trì đó làm cho nó trở thành một cược dài hạn có rủi ro  SGLang hoặc vLLM là các mặc định an toàn hơn cho các dự án mới. **vLLM**là mặc định sản xuất mục đích chung  v0.15.1 (tháng 2 năm 2026) thêm PyTorch 2.10, RTX Blackwell SM120, tối ưu hóa H200. **SGLang**là chuyên gia đa xoay / tiền tố nặng của các máy tính GPU (xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS) 400.000 + trong sản xuất. Khác suất phần cứng: CPU-first → llama.cpp. AMD / không phải NVIDIA → vLLM là con đường được hỗ trợ mạnh nhất (TRT-LLM bị khóa bởi NVIDIA). 2026 mô hình đường ống: dev = Ollama, giai đoạn = llama.cpp, prod = vLLM hoặc SGLang. Các động cơ có định dạng trọng lượng khác nhau  GGUF cho gia đình llama.cpp, HF safetensors cho động cơ GPU  do đó chuyển đổi định dạng có thể nằm giữa các giai đoạn.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, engine-decision tree walker)
**Prerequisites:** All Phase 17 lessons covering engines (04, 06, 07, 09, 18)
**Time:** ~45 minutes

## Mục tiêu học tập

- Chọn một công cụ phần cứng (CPU / AMD / NVIDIA Hopper / Blackwell), quy mô (1 người dùng / 100 / 10,000), và tải trọng công việc (chăm thoại chung / đại lý / ngữ cảnh dài).
- Hãy nêu tên tình trạng chế độ bảo trì TGI 2026 (11 tháng 12 năm 2025) và lý do tại sao nó hướng các dự án mới về vLLM hoặc SGLang.
- Mô tả đường ống phát triển/phân cảnh/phân cảnh, bao gồm cả nơi chuyển đổi định dạng GGUF sang máy cảm biến an toàn nằm giữa các giai đoạn.
- Giải thích tại sao "CPU-first" chỉ vào llama.cpp và "AMD" loại trừ TRT-LLM.

## Vấn đề

Nhóm của bạn bắt đầu một dự án LLM tự chủ mới. Một kỹ sư nói Ollama, một kỹ sư nói vLLM, một thứ ba nói "TGI không phải là làm việc ra khỏi hộp?" Cả ba đều phù hợp với các bối cảnh khác nhau. Không có một trong số đó là phù hợp với tất cả.

Năm 2026, cây lựa chọn quan trọng: phần cứng đầu tiên, quy mô thứ hai, tải trọng công việc thứ ba. Và một sự kiện cụ thể năm 2025  TGI bước vào chế độ bảo trì ngày 11 tháng 12  thay đổi mặc định cho các dự án mới.

## Khái niệm

### 5 động cơ

| Engine | Best for | Notes |
|--------|----------|-------|
| **llama.cpp** | CPU / edge / minimal deps / widest model support | Fastest on CPU, full control |
| **Ollama** | Dev laptops, single user, one-command install | 15-30% slower than llama.cpp; 3x prod throughput gap |
| **TGI** | HF ecosystem, regulated industries | **Maintenance mode Dec 11, 2025** |
| **vLLM** | General-purpose production, 100+ users | Broad production default; v0.15.1 Feb 2026 |
| **SGLang** | Agentic multi-turn, prefix-heavy workloads | 400,000+ GPUs in production |

### Quyết định đầu tiên về phần cứng

**CPU-first**Ollama cũng hoạt động nhưng chậm hơn. Không có động cơ nào khác cạnh tranh trên CPU.

**AMD GPU**→ vLLM là con đường được hỗ trợ mạnh nhất ( hỗ trợ ROCm của AMD). SGLang cũng hoạt động. TRT-LLM bị khóa bởi NVIDIA, vì vậy nó đã tắt.

**NVIDIA Hopper (H100 / H200)**→ vLLM hoặc SGLang hoặc TRT-LLM. Cả ba cấp cao nhất.

**NVIDIA Blackwell (B200 / GB200)**→ TRT-LLM là nhà lãnh đạo thông qua (Phase 17 · 07). vLLM và SGLang theo dõi gần.

**Apple Silicon (M-series)**Ollama gói lại đây.

### Quyết định quy mô thứ hai

**1 user / local dev**→ Ollama. Một lệnh, đầu tiên được mã hóa trong vài giây.

**10-100 users / small team**→ VLLM single-GPU.

**100-10k users / production**→ vLLM sản xuất- hàng (Phase 17 · 18) hoặc SGLang.

**10k+ users / enterprise**→ vLLM sản xuất-phát + phân chia (Phase 17 · 17) + LMCache (Phase 17 · 18).

### Lượng công việc - quyết định thứ ba

**General chat / Q&A**→ vLLM thắng trên mặc định rộng.

**Agentic multi-turn (tools, planning, memory)**→ SGLang' s RadixAttention (Phase 17 · 06) chiếm ưu thế.

**RAG with heavy prefix reuse**→ SGLang.

**Code generation**→ vLLM tốt; SGLang tốt hơn một chút trên cache.

**Long context (128K+)**→ vLLM + prefill chia nhỏ; SGLang + KV cấp.

### Trầm giữ gìn TGI

Hugging Face TGI đã bước vào chế độ bảo trì ngày 11 tháng 12 năm 2025  chỉ sửa lỗi trong tương lai.

Đối với các dự án mới vào năm 2026: mặc định không còn TGI. Việc triển khai TGI hiện có có thể tiếp tục nhưng cuối cùng sẽ di chuyển. SGLang và vLLM là các mặc định an toàn hơn.

### Mô hình đường ống

Dev (Ollama) → staging (llama.cpp) → prod (vLLM). Các động cơ có định dạng trọng lượng khác nhau  GGUF cho gia đình llama.cpp, HF safetensors cho các động cơ GPU  vì vậy một chuyển đổi định dạng có thể nằm giữa các giai đoạn. Các kỹ sư lặp lại nhanh chóng trên máy tính xách tay; staging gương lượng hóa sản xuất; prod là mục tiêu phục vụ.

### Lưu ý Ollama

Ollama là tuyệt vời cho dev. Nó không tuyệt vời cho sản xuất chia sẻ: Go HTTP serialization thêm overhead, quản lý đồng thời đơn giản hơn vLLM, OpenTelemetry hỗ trợ lags. Sử dụng Ollama nơi nó tỏa sáng  một người dùng, một lệnh  và chuyển sang vLLM cho chia sẻ.

### Tự lưu trữ vs quản lý là một quyết định riêng biệt

Giai đoạn 17 · 01 (những siêu quy mô được quản lý), · 02 (các nền tảng suy luận) bao gồm được quản lý. Bài học này giả định bạn đã quyết định tự lưu trữ. Lý do tự lưu trữ: cư trú dữ liệu, chỉnh sửa tùy chỉnh, tổng chi phí sở hữu trên quy mô, mô hình miền không có sẵn trên hosted.

### Những con số mà bạn nên nhớ

- TGI: 11 tháng 12 năm 2025.
- vLLM v0.15.1: Tháng Hai 2026; PyTorch 2.10; Blackwell SM120 hỗ trợ.
- SGLang sản xuất dấu chân: 400.000+ GPU.
- Hỗn độ thông qua Ollama vs llama.cpp: 15-30% chậm hơn; 3x dưới tải trọng.

```figure
data-parallel
```

## Sử dụng nó

`code/main.py`là người đi bộ cây quyết định: với phần cứng + quy mô + tải trọng công việc, chọn một động cơ và giải thích lý do tại sao.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-engine-picker.md`Với những hạn chế, anh ta chọn một động cơ và viết kế hoạch di cư.

## Các bài tập

1. Đi chạy`code/main.py`với phần cứng / quy mô / tải công việc của bạn.
2. Bộ phận hạ tầng của anh là 12 H100 và 8 MI300X AMD.
3. Một nhóm muốn sử dụng TGI vào năm 2026 bởi vì "đó là những gì chúng ta biết".
4. Ollama dev to vLLM prod: những thay đổi nào trong định lượng, cấu hình và khả năng quan sát?
5. Sản phẩm RAG với chiều dài tiền đề P99 8K và sử dụng lại cao trên các nhà thuê.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| llama.cpp | "the CPU one" | Widest model support, fastest on CPU |
| Ollama | "the laptop one" | One-command install, dev-grade throughput |
| TGI | "HF's serving" | Maintenance mode since Dec 2025 |
| vLLM | "the default" | Broad production baseline 2026 |
| SGLang | "the agentic one" | Prefix-heavy, RadixAttention |
| TRT-LLM | "NVIDIA-locked" | Blackwell throughput leader, NVIDIA only |
| GGUF | "llama.cpp format" | Bundled K-quant variants |
| Production-stack | "vLLM K8s" | Phase 17 · 18 reference deployment |
| Pipeline pattern | "dev→stage→prod" | Ollama → llama.cpp → vLLM; weight formats differ per engine |

## Đọc thêm

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference) ghi chú phát hành.
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
