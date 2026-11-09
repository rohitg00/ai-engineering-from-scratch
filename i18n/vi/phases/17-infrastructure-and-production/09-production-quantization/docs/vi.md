# Phân lượng sản xuất  AWQ, GPTQ, GGUF K-quant, FP8, MXFP4/NVFP4

> Phương thức định lượng không phải là một lựa chọn phổ quát  nó là một chức năng của phần cứng, máy phục vụ và tải trọng công việc. GGUF Q4_K_M hoặc Q5_K_M sở hữu CPU và cạnh, được cung cấp thông qua llama.cpp và Ollama. GPTQ thắng trong vLLM khi bạn cần nhiều LoRA trên cùng một cơ sở. AWQ với hạt nhân Marlin-AWQ cung cấp ~ 741 tok/s trên một mô hình lớp 7B với Pass@1 tốt nhất tại INT4  mặc định 2026 cho sản xuất trung tâm dữ liệu. FP8 vẫn là trung tâm trên Hopper, Ada và Blackwell  gần như không mất mát và được hỗ trợ rộng rãi. NVFP4 và MXFP4 (Blackwell microscaling) là tích cực và yêu cầu xác thực mỗi khối. Hai nhóm cắn bẫy: bộ dữ liệu hiệu chuẩn phải phù hợp với miền triển khai, và bộ nhớ cache KV tách biệt với định lượng trọng lượng  bài học AWQ "chương tự của tôi bây giờ là 4 GB" quên bộ nhớ cache KV 10-30 GB ở kích thước loạt sản xuất.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy memory and throughput comparison across formats)
**Prerequisites:** Phase 10 · 13 (Quantization foundations), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## Mục tiêu học tập

- Hãy nêu tên sáu định dạng định lượng sản xuất và điểm ngọt ngào của chúng vào năm 2026.
- Chọn định dạng phần cứng (CPU vs GPU, Hopper vs Blackwell), động cơ (vLLM, TRT-LLM, llama.cpp), và tải trọng công việc (tác thảo thường xuyên, lý luận, đa LoRA).
- Xét bộ nhớ trọng lượng được lưu và bộ nhớ cache KV được để lại không bị ảnh hưởng cho định dạng được chọn.
- Tên lỗi dữ liệu định đo làm suy giảm mô hình định lượng trên lưu lượng domain.

## Vấn đề

Quantization làm giảm bộ nhớ và băng thông HBM, đó chính xác là những gì cần để giải mã. Một mô hình FP16 70B là 140 GB trọng lượng. Quantize trọng lượng đến INT4 (AWQ hoặc GPTQ) và mô hình là 35 GB  phù hợp với một H100 với không gian cho bộ nhớ cache KV, điều này quan trọng bởi vì ở 128 chuỗi đồng thời với 2k bối cảnh, bộ nhớ cache KV một mình là 20-30 GB.

Nhưng định lượng không phải là miễn phí. định lượng tích cực làm suy giảm chất lượng, đặc biệt là trong các nhiệm vụ suy luận nặng. Các định dạng khác nhau hoạt động với các động cơ khác nhau. Phần cứng khác nhau hỗ trợ độ chính xác khác nhau bản địa. Sở thú định dạng 2026 là thực tế và bạn không thể sao chép sự lựa chọn của người khác.

## Khái niệm

### 6 hình thức

| Format | Bits | Sweet spot | Engines |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU, edge, laptops | llama.cpp, Ollama |
| GPTQ | 4-8 | Multi-LoRA on vLLM | vLLM, TGI |
| AWQ | 4 | Datacenter GPU production | vLLM (Marlin-AWQ), TGI |
| FP8 | 8 | Hopper/Ada/Blackwell datacenter | vLLM, TRT-LLM, SGLang |
| MXFP4 | 4 | Blackwell multi-user | TRT-LLM |
| NVFP4 | 4 | Blackwell multi-user | TRT-LLM |

### GGUF  CPU / Edge mặc định

GGUF là một định dạng tập tin, không phải là một kế hoạch định lượng riêng  nó kết hợp các biến thể K-quan (Q2_K, Q3_K_M, Q4_K_M, Q5_K_M, Q6_K, Q8_0) trong một thùng. Q4_K_M và Q5_K_M là các mặc định sản xuất  chất lượng gần BF16 ở 4-5 bit.

Hình thức không được tối ưu hóa cho các lõi GPU. Sử dụng GGUF khi mục tiêu triển khai là CPU / Edge. Không khác.

### GPTQ  Multi-LoRA trong vLLM

GPTQ là một thuật toán định lượng sau khi đào tạo với một hiệu suất hiệu chuẩn. lõi Marlin làm cho nó nhanh trên GPU (2.6x tốc độ so với không Marlin GPTQ). ~ 712 tok / s trên 7B.

Chiến thắng độc đáo: GPTQ-Int4 hỗ trợ bộ chuyển đổi LoRA trong vLLM. Nếu bạn đang phục vụ một mô hình cơ bản cộng với 10-50 biến thể được điều chỉnh tốt (mỗi một là một LoRA), GPTQ là con đường của bạn. NVFP4 vẫn không hỗ trợ LoRA từ đầu năm 2026.

### AWQ  GPU trung tâm dữ liệu mặc định

Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn kích hoạt: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn: Tiêu chuẩn Títítítítítítítítítít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít Tít

Chọn AWQ cho GPU mới giao dịch trừ khi bạn cần nhiều LoRA (GPTQ) hoặc Blackwell FP4 (NVFP4) hung hăng.

### FP8  trung tâm đáng tin cậy

Điểm nổi 8 bit. gần như không mất mát. Được hỗ trợ rộng rãi. Húpper Tensor Cores tăng tốc FP8 theo bản địa. Blackwell thừa kế. FP8 là mặc định an toàn 2026 khi chất lượng không thể thương lượng (thông luận, y tế, mã gen).

### MXFP4 / NVFP4  Blackwell hung hăng

Phân tích nhỏ FP4. Mỗi khối trọng lượng có yếu tố quy mô riêng. Khủng bố nhưng tăng tốc phần cứng trên các lõi Tensor Blackwell. Giảm một nửa các byte mỗi token so với FP8  chiến thắng kinh tế trong giai đoạn 17 · 07.

Các hang động:
- Không có hỗ trợ LoRA (trước 2026).
- Sự sụt giảm chất lượng có thể nhìn thấy trên các khối lượng công việc nặng nề.
- Thiết lập giá trị của bạn cho mỗi mô hình.

### Mẫy hiệu chuẩn

AWQ và GPTQ yêu cầu một bộ dữ liệu hiệu chuẩn  thường là C4 hoặc WikiText. Đối với các mô hình miền (định luật, y tế, pháp lý), hiệu chuẩn trên văn bản web chung cho phép thuật toán đưa ra quyết định sai về trọng lượng nào để bảo vệ. Pass@1 trên HumanEval có thể giảm một số điểm.

Phong cách: chuẩn hóa trên dữ liệu trong miền. Hàng trăm mẫu miền thường là đủ. kiểm tra trên bộ đánh giá trước khi vận chuyển.

### Trầm lẫy cache KV

AWQ giảm trọng lượng xuống còn 4 bit. KV cache là riêng biệt và ở mức FP16/FP8. Đối với mô hình 70B với AWQ:

- trọng lượng: ~ 35 GB (INT4 từ 140 GB).
- KV cache ở 128 đồng thời × 2k bối cảnh: ~ 20 GB.
- Tích hoạt: ~ 5 GB.
- Tổng: ~ 60 GB  phù hợp với H100 80 GB.

Thần truyền "Tôi đã định lượng mô hình của mình thành 4 GB" quên đi 30 - 50 GB khác.

Ngoài ra, định lượng cache KV (FP8 KV hoặc INT8 KV) là một lựa chọn khác với sự thỏa hiệp của riêng nó  nó ảnh hưởng trực tiếp đến độ chính xác sự chú ý và không phải là một chiến thắng miễn phí.

### AWQ INT4 là nguy hiểm cho lý luận

Dòng tư tưởng, toán học, mã gen với bối cảnh dài  những người này bị ảnh hưởng rõ ràng bởi định lượng tích cực. AWQ INT4 mất ~ 3-5 điểm trên MATH. Đối với tải trọng công việc nặng lý luận, gửi FP8 hoặc BF16; chấp nhận chi phí bộ nhớ.

### 2026 hướng dẫn chọn

- CPU/ Edge serve: GGUF Q4_K_M. Được rồi.
- GPU phục vụ, trò chuyện thường xuyên, không có LoRA.
- GPU phục vụ, nhiều LoRA: GPTQ với Marlin.
- Lượng công việc lý luận: FP8.
- Trung tâm dữ liệu Blackwell, chất lượng được xác nhận: NVFP4 + FP8 KV.
- Không rõ ràng: chạy một đánh giá 1.000 mẫu trên mỗi định dạng ứng cử viên.

```figure
gpu-memory-breakdown
```

## Sử dụng nó

`code/main.py`tính toán dấu chân bộ nhớ (nâng trọng + KV + kích hoạt) và dung lượng tương đối trên sáu định dạng cho một loạt các kích thước mô hình.

- [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?dtype=fp8&users=64)Máy hiển thị FP8 trên một NVIDIA L4. trọng lượng giảm từ 15,28 GB xuống còn 8,81 GB, hồ chứa KV tăng từ 24,094 đến 142,369 token, và lượng sản xuất được đo ở 64 người dùng tăng từ 250,85 đến 735,91 token mỗi giây.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-quantization-picker.md`. Với phần cứng, kích thước mô hình, loại tải trọng công việc và dung nạp chất lượng, chọn định dạng và tạo ra kế hoạch hiệu chuẩn/bảo quy.

## Các bài tập

1. Đi chạy`code/main.py`Đối với mô hình 70B ở 128 đồng thời với 2k ngữ cảnh, tính toán tổng HBM cho mỗi định dạng.
2. Bạn có mô hình mã hóa 7B, chọn định dạng và biện minh. Nếu bạn sai về khả năng dung nạp chất lượng, con đường phục hồi là gì?
3. Xét kích thước bộ dữ liệu hiệu chuẩn cần thiết để hiệu chuẩn AWQ cho mô hình lĩnh vực y tế. Tại sao nhiều dữ liệu không phải lúc nào cũng tốt hơn?
4. Đọc giấy hạt nhân Marlin-AWQ hoặc ghi chú phát hành. Giải thích bằng ba câu tại sao AWQ đạt 741 tok/s trên 7B trong khi GPTQ thô đạt ~712.
5. Khi nào có ý nghĩa để kết hợp trọng lượng AWQ với FP8 KV cache vs giữ KV ở BF16?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GGUF | "llama.cpp format" | File format bundling K-quant variants; CPU/edge default |
| Q4_K_M | "Q4 K M" | 4-bit K-quant medium; the production GGUF default |
| GPTQ | "gee pee tee q" | Post-train INT4 with calibration; supports LoRA in vLLM |
| AWQ | "a w q" | Activation-aware INT4; Marlin kernels; best Pass@1 at INT4 |
| Marlin kernels | "fast INT4 kernels" | Custom CUDA kernels for INT4 on Hopper; 10x speedup |
| FP8 | "eight-bit float" | Safe precision default on Hopper/Ada/Blackwell |
| MXFP4 / NVFP4 | "microscaling four" | Blackwell 4-bit FP with per-block scale factors |
| Calibration dataset | "cal data" | Input text used to pick quantization parameters; must match domain |
| KV cache quantization | "KV INT8" | Separate choice from weights; affects attention accuracy |

## Đọc thêm

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) các chỉ số chuẩn so sánh.
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) Số lượng thông qua theo định dạng.
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) chọn định dạng theo định dạng.
- [vLLM docs — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html) các định dạng và cờ được hỗ trợ.
- [AWQ paper (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) Công thức AWQ ban đầu.
- [GPTQ paper (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) Công thức GPTQ ban đầu.
