# Edge Inference  Apple Neural Engine, Qualcomm Hexagon, WebGPU/WebLLM, Jetson

> Hạn chế cạnh cốt lõi là băng thông bộ nhớ, không phải tính toán. Mobile DRAM ở mức 50-90 GB/s; trung tâm dữ liệu HBM3 xóa 2-3 TB/s  khoảng cách 30-50x. Việc giải mã được gắn với bộ nhớ nên khoảng cách là quyết định. Năm 2026, cảnh quan được chia thành bốn phần. Apple M4/A18 Neural Engine đạt 38 TOPS với bộ nhớ thống nhất (không có bản sao CPUNPU). Qualcomm Snapdragon X Elite / 8 Gen 4 Hexagon đạt 45 TOPS. WebGPU + WebLLM chạy Llama 3.1 8B (Q4) với ~ 41 tok / s trên M3 Max (khoảng 70-80% bản địa); 17,6k sao GitHub, API tương thích với OpenAI, ~ 70-75% bảo hiểm di động. NVIDIA Jetson Orin Nano Super (8GB) phù hợp với Llama 3.2 3B / Phi-3; AGX Orin chạy gpt-oss-20b thông qua vLLM với ~ 40 tok / s; Jetson T4000 (JetPack 7.1) là 2x AGX Orin. TensorRT Edge-LLM hỗ trợ EAGLE-3, NVFP4, prefill  được trình bày tại CES 2026 bởi Bosch, ThunderSoft, MediaTek.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy bandwidth-bound decode simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 09 (Production Quantization)
**Time:** ~60 minutes

## Mục tiêu học tập

- Giải thích tại sao suy luận LLM di động bị ràng buộc với bộ nhớ và tính toán là thứ hai.
- Đăng danh bốn mục tiêu cạnh (Apple ANE, Qualcomm Hexagon, WebGPU/WebLLM, NVIDIA Jetson) và phù hợp với từng trường hợp sử dụng.
- Hãy cho biết khoảng cách bảo hiểm WebGPU 2026 (Firefox Android bắt kịp) và Safari iOS 26 hạ cánh.
- Chọn định dạng định lượng cho mỗi mục tiêu (Core ML INT4 + FP16 cho ANE, QNN INT8/INT4 cho Hexagon, WebGPU Q4 cho trình duyệt, NVFP4 cho Jetson Thor).

## Vấn đề

Một khách hàng muốn một chatbot trên thiết bị: giọng nói đầu tiên, riêng tư theo mặc định, hoạt động ngoài khơi. Trên MacBook Pro M3 Max, Llama 3.1 8B Q4 chạy với ~ 55 tok / s  tốt. Trên iPhone 16 Pro, cùng một mô hình chạy với 3 tok / s  không tốt. Trên một Android tầm trung với Snapdragon 8 Gen 3, 7 tok / s. Trong trình duyệt thông qua WebGPU trên Chrome Android v121+, 4-8 tok / s tùy thuộc vào thiết bị.

Sự khác biệt thông qua không phải là vấn đề chuyển tải. Đó là khoảng cách băng thông gấp đôi định dạng định lượng gấp đôi liệu NPU có thể truy cập từ không gian người dùng hay không.

## Khái niệm

### Độ băng thông là trần nhà thực sự

Decode đọc toàn bộ bộ bộ trọng lượng cho mỗi token. Một mô hình 7B trong Q4 là 3.5 GB. Đọc 3.5 GB ở 50 GB / s mất 70 ms  một giới hạn lý thuyết của ~ 14 tok / s. Tại 90 GB / s (high-end mobile DRAM) giới hạn di chuyển đến ~ 25 tok / s. Không có số lượng tính toán giúp dưới số này.

Datacenter HBM3 với 3 TB/s làm sạch cùng một 3.5 GB trong 1.2 ms  trần là 830 tok/s. cùng một mô hình, cùng một trọng lượng.

### Apple Neural Engine (M4 / A18)

- Tối đa 38 TOPS. bộ nhớ thống nhất (CPU và ANE chia sẻ cùng một hồ bơi)  không có chi phí bản sao.
- Truy cập thông qua Core ML + `.mlmodel`Các mô hình được biên soạn, hoặc thông qua Metal Performance Shaders (MPS) thông qua PyTorch.
- Llama.cpp Metal backend sử dụng MPS, không phải ANE trực tiếp; ANE bản địa yêu cầu chuyển đổi Core ML.
- Cách thực tế tốt nhất cho các ứng dụng iOS vào năm 2026: Core ML với trọng lượng INT4 + kích hoạt FP16.

### Qualcomm Hexagon (Snapdragon X Elite / 8 Gen 4)

- Tối đa 45 TOPS, tích hợp với CPU và GPU trong SoC nhưng riêng biệt bộ nhớ miền.
- QNN (Qualcomm Neural Network) SDK và AI Hub cung cấp chuyển đổi từ PyTorch / ONNX.
- Các mẫu trò chuyện, Llama 3.2, Phi-3 đều được chuyển đến như những đồ tạo vật hạng nhất trên AI Hub.

### Intel / AMD NPU (Lunar Lake, Ryzen AI 300)

- 40-50 TOPS. Phần mềm tụt lại phía sau Apple/Qualcomm; OpenVINO đang cải thiện nhưng niche.
- Tốt nhất cho các ứng dụng đồng phi công Windows ARM; bản địa trên máy tính để bàn AMD / Intel cho địa phương đầu tiên.

### WebGPU + WebLLM

- Tiếp tục chạy mô hình trong trình duyệt thông qua máy tính tính WebGPU; không cài đặt.
- Llama 3.1 8B Q4 với ~ 41 tok/s trên M3 Max  khoảng 70-80% bản địa thông qua cùng một backend.
- 17.6k GitHub sao trên WebLLM; OpenAI tương thích JS API; Apache 2.0.
- 2026: Chrome Android v121+, Safari iOS 26 GA, Firefox Android vẫn tiếp tục. Tổng cộng ~ 70-75% bảo hiểm di động.

### Gia đình Jetson

- Orin Nano Super (8GB): phù hợp với Llama 3.2 3B, Phi-3 với tốc độ giao thông tốt.
- AGX Orin: chạy gpt-oss-20b qua vLLM với ~ 40 tok/s.
- Thor / T4000 (JetPack 7.1): hiệu suất 2x AGX Orin, EAGLE-3 và NVFP4 được hỗ trợ.
- TensorRT Edge-LLM (2026) hỗ trợ giải mã suy đoán EAGLE-3, trọng lượng NVFP4, prefill  các tối ưu hóa trung tâm dữ liệu được chuyển đến cạnh.

### Sự lựa chọn định lượng cho mỗi mục tiêu

| Target | Format | Notes |
|--------|--------|-------|
| Apple ANE | INT4 weights + FP16 activations | Core ML conversion path |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub converters |
| WebGPU / WebLLM | Q4 MLC (q4f16_1) | Use `mlc_llm convert_weight` + compiled `.wasm`; GGUF is not supported |
| Jetson Orin Nano | Q4 GGUF or TRT-LLM INT4 | Memory-bound |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM path |

### Mẫy trong bối cảnh dài đang ở cạnh

Llama 3.1 có khung cảnh 128K là tính năng trung tâm dữ liệu. Trên điện thoại có 8 GB RAM, mô hình 4 GB + 2 GB KV bộ nhớ cache cho các token 32K + OS overhead = OOM. Việc triển khai cạnh giữ ngữ cảnh ở 4K-8K trừ khi định lượng KV hung hăng (Q4 KV) được chấp nhận.

### Voice là ứng dụng giết người

Các đại lý giọng nói nhạy cảm với độ trễ (tốc hiệu đầu tiên < 500 ms). Kết luận địa phương loại bỏ độ trễ mạng hoàn toàn. Kết hợp với giọng nói đến văn bản (những biến thể Whisper Turbo chạy trên cạnh) và kết luận cạnh trở thành vòng lặp giọng nói chất lượng sản xuất.

### Những con số mà bạn nên nhớ

- Apple M4 / A18 ANE: 38 TOPS.
- Qualcomm Hexagon SD X Elite: 45 TOPS.
- WebLLM M3 Max: ~ 41 tok/s trên Llama 3.1 8B Q4.
- AGX Orin: ~ 40 tok/s trên gpt-oss-20b qua vLLM.
- Khoảng cách băng thông giữa trung tâm dữ liệu: 30-50x.
- Bảo hiểm di động WebGPU: ~ 70-75% (Firefox Android chậm).

```figure
edge-bandwidth-pipe
```

## Sử dụng nó

`code/main.py`tính toán các giới hạn hiệu suất giải mã lý thuyết từ toán học giới hạn băng thông qua các mục tiêu cạnh. So sánh với các điểm tham chiếu và điểm nhấn được quan sát nơi băng thông, chứ không phải tính toán, là nút thắt.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-edge-target-picker.md`. Với nền tảng (iOS/Android/browser/Jetson), mô hình và thời gian trễ/khu nhớ ngân sách, chọn định dạng định lượng và đường ống chuyển đổi.

## Các bài tập

1. Đi chạy`code/main.py`Đối với một mô hình 7B trong Q4 trên Snapdragon 8 Gen 3 (~ 77 GB / s băng thông), tính toán giới hạn giải mã. So sánh với 6-8 tok / s quan sát thấy  thời gian chạy hiệu quả?
2. WebGPU trên Android yêu cầu Chrome v121+. Thiết kế một fallback cho trình duyệt cũ hơn  phía máy chủ thông qua cùng một API tương thích OpenAI.
3. Ứng dụng iOS của bạn cần phát trực tuyến 4K. Phụ hợp mô hình/ định dạng nào cho phép bạn giữ dưới 4 GB bộ nhớ tích cực trên iPhone 16?
4. Jetson AGX Orin chạy gpt-oss-20b với 40 tok/s. Jetson Nano chỉ phù hợp với 3B. Nếu sản phẩm của bạn nhắm mục tiêu cả hai, làm thế nào để thống nhất các phát minh?
5. Thảo luận liệu "WebLLM có sẵn sàng sản xuất vào năm 2026 hay không". Hãy đề cập đến sự bao phủ, hiệu suất và khoảng cách của Firefox Android.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ANE | "Apple neural engine" | On-device NPU in M-series and A-series; unified memory |
| Hexagon | "Qualcomm NPU" | Snapdragon NPU; QNN SDK for access |
| WebGPU | "browser GPU" | W3C-standardized browser GPU API; Chrome/Safari 2026 |
| WebLLM | "browser LLM runtime" | MLC-LLM project; Apache 2.0; OpenAI-compatible JS |
| Jetson | "NVIDIA edge" | Orin Nano / AGX / Thor / T4000 family |
| TRT Edge-LLM | "edge TensorRT" | 2026 edge port of TensorRT-LLM; EAGLE-3 + NVFP4 |
| Unified memory | "shared pool" | CPU and NPU see same RAM; no copy overhead |
| Bandwidth-bound | "memory limited" | Decode gated by bytes/sec reading weights |
| Core ML | "Apple conversion" | Apple framework for ANE-native models |
| QNN | "Qualcomm stack" | Qualcomm Neural Network SDK |

## Đọc thêm

- [On-Device LLMs State of the Union 2026](https://v-chandra.github.io/on-device-llms/) cảnh quan và các tiêu chuẩn.
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) Orin / AGX / Thor.
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/) Thông báo cổng cạnh 2026
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) thiết kế và tiêu chuẩn.
- [Apple Core ML](https://developer.apple.com/documentation/coreml) Chuyển đổi người bản địa.
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) Các mô hình đã chuyển đổi trước cho Hexagon.
