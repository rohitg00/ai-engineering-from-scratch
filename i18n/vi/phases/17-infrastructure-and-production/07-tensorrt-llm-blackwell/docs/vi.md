# Bộ máy cứng chuyên ngành Inference Compilation  FP8 và NVFP4 trên Blackwell

> Bộ máy tính chuyên dụng thu thập kết luận giao dịch khả năng di động cho thông suất, và TensorRT-LLM  NVIDIA-chỉ, điều chỉnh cho Blackwell  là ví dụ rõ ràng nhất về việc giao dịch trả tiền.$0.012 per million tokens on a 120B model in Q1-Q2 2026, against $0.09/M trên H100 + vLLM  khoảng cách kinh tế 7 lần. Các tập hợp hai định dạng điểm nổi với hai kỹ thuật phục vụ: FP8 vẫn quan trọng cho kho lưu trữ KV và hạt nhân chú ý vì nó có phạm vi động năng cần thiết; NVFP4 (4 bit vi mô) xử lý trọng lượng và kích hoạt; dự đoán đa token (MTP) và phân chia prefill / decode thêm thêm 2-3x trên cùng. Day-0 hỗ trợ mô hình tải trọng FP4 trực tiếp mà không cần chuyển đổi sau đào tạo. Sự bắt giữ cho các nhóm kỹ thuật năm 2026: TRT-LLM là nguồn mở nhưng đặc biệt cho NVIDIA  CUDA- và Blackwell chuyên dụng  vì vậy việc áp dụng nó thương mại khả năng di động cho thông suất. Hãy thử toán toán cho các mô hình và phần cứng trước khi bắt đầu.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy FP8/NVFP4 memory and cost calculator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 13 (Quantization)
**Time:** ~75 minutes

## Mục tiêu học tập

- Giải thích tại sao FP8 vẫn quan trọng đối với cache và sự chú ý của KV ngay cả khi trọng lượng ở NVFP4.
- Xét dấu chân HBM của mô hình biên giới theo BF16, FP8 và NVFP4 và lý luận về nguồn gốc tiết kiệm.
- Tên các tính năng đặc biệt của Blackwell TRT-LLM khai thác (ngày-0 FP4, MTP, phân chia dịch vụ, tất cả các nguyên thủy).
- Hãy quyết định khi nào khóa NVIDIA của TRT-LLM sẽ đáng giá 7 lần chênh lệch giá so với vLLM trên Hopper.

## Vấn đề

Biên giới của kinh tế suy luận vào năm 2026 là "các mã thông báo mỗi đô la". Câu trả lời phụ thuộc vào bốn lựa chọn xếp chồng lên: thế hệ phần cứng (Hopper H100/H200 vs Blackwell B200/GB200), độ chính xác (BF16 → FP8 → NVFP4), động cơ phục vụ (vLLM vs SGLang vs TRT-LLM), và dàn xếp (sơn vs phân chia vs Dynamo).

Trên Hopper với vLLM, một MoE 120B chạy ở ~$0.09 per million tokens. On Blackwell with TRT-LLM + Dynamo, the same model runs at ~$0.012  7x rẻ hơn. Một số khoảng cách đó là phần cứng (Blackwell là 11-15x cho mỗi GPU LLM thông qua so với Hopper). Một số là hàng: trọng lượng FP4, bản thảo MTP, prefill / decode phân chia, và NVLink 5 toàn bộ cho giao tiếp chuyên gia MoE.

Bạn không thể sao chép điều này bên ngoài nồi NVIDIA. Đó là sự thỏa hiệp  khả năng di chuyển cho kinh tế học.

## Khái niệm

### Tại sao FP8 vẫn là sàn cho KV cache

Một sai lầm phổ biến vào năm 2026: giả định NVFP4 áp dụng ở mọi nơi. Nó không. KV cache cần FP8 (8 bit floating point) vì nó lưu trữ các khóa chú ý và giá trị trải dài một phạm vi động rộng. Quantizing KV đến FP4 gây ra mất độ chính xác thảm khốc.

NVFP4 (2025-2026) áp dụng cho trọng lượng và kích hoạt. Microscaling: mỗi khối trọng lượng có nhân thang riêng của nó để các khối nhỏ có thể trải dài các phạm vi động khác nhau mà không mất thang độ per-tensor. Đối với các kích hoạt, FP4 giữ lại vì các kích hoạt là phạm vi nhỏ trong một lớp.

Một kiểu hình ảnh của Blackwell:

- trọng lượng: NVFP4 (4 bit quy mô nhỏ).
- Tích hoạt: NVFP4.
- KV cache: FP8.
- Bộ tích lũy sự chú ý: FP32 (thường độ ổn định tối đa mềm).

### Các nguyên thủy đặc biệt của Blackwell TRT-LLM sử dụng

- **Day-0 FP4 weights**: các nhà cung cấp mô hình vận chuyển trọng lượng FP4 trực tiếp; tải TRT-LLM mà không cần chuyển đổi sau đào tạo. Không có bước AWQ / GPTQ cho FP4.
- **Multi-token prediction (MTP)**: cùng một ý tưởng như EAGLE (Phase 17 · 05) nhưng tích hợp vào TRT-LLM xây dựng.
- **Disaggregated serving**: prefill và decode trên các bộ nhớ GPU riêng biệt, cache KV được chuyển qua NVLink hoặc InfiniBand.
- **All-to-all communication primitives**NVLink 5 cắt giảm độ trễ giao tiếp chuyên gia MoE bằng 3x so với Hopper.
- **NVFP4 + MXFP8 microscaling**: xử lý các yếu tố quy mô nhanh chóng trên các lõi Tensor Blackwell.

### Những con số mà bạn nên ghi nhớ

- HGX B200 tại $ 0.02 / M token trên GPT-OSS-120B thông qua TRT-LLM.
- GB200 NVL72 tại $ 0,012/M token thông qua Dynamo (trong tổ chức TRT-LLM).
- H100 + vLLM ≈ $ 0.09 / M token trên khối lượng công việc tương đương.
- tăng thông qua 2,8 lần trong ba tháng cập nhật TRT-LLM (2026).
- 11-15 lần mỗi lần GPU LLM, Blackwell vs Hopper.
- MLPerf Inference v6.0 (ngày 4 tháng 4 năm 2026): Blackwell thống trị mọi nhiệm vụ được gửi.

### Giá trị thực tế của FP4 về chất lượng

NVFP4 là tích cực. Trên khối lượng công việc có tính toán nặng (thể sợi tư duy, toán học, mã gen với bối cảnh dài), trọng lượng FP4 giảm đi đáng kể. Độ chuẩn hóa mỗi khối giảm nhưng không loại bỏ. Các mô hình lý luận vận chuyển của nhóm thường sử dụng trọng lượng FP8 + kích hoạt FP4 như một thỏa hiệp, hoặc gắn bó với H200 với FP8 trong suốt.

Quy tắc: luôn xác nhận chất lượng nhiệm vụ trên bộ đánh giá của bạn trước khi cam kết với trọng lượng NVFP4.

### Tại sao đây là quyết định khóa NVIDIA

TRT-LLM là các lõi nguồn đóng C++ + CUDA +. Các mô hình cần được biên soạn cho một SKU GPU cụ thể. Không AMD, không Intel, không ARM. Nếu chiến lược hạ tầng của bạn là đa nhà cung cấp, TRT-LLM là một không khởi động cho cấp độ TRT-LLM phục vụ.

### 2026 công thức thực tế

Đối với hóa đơn suy luận hàng năm 100 triệu +, chạy trên Hopper + vLLM để lại 7-10x trên bảng. Chuyển tải công việc chi phí thống trị đến Blackwell + TRT-LLM + Dynamo. Giữ cấp thử nghiệm trên H100 + vLLM cho tốc độ lặp lại mô hình. Thiết lập chất lượng trên mỗi mô hình NVFP4 chuyển đổi trước khi sản xuất.

### Tặng thưởng phân tích

Các bộ phận phân chia của TRT-LLM (bể chứa và giải mã riêng biệt) được bao gồm sâu trong giai đoạn 17 · 20. Ở Blackwell, các bộ đống nhân: trọng lượng FP4 × tăng tốc MTP × vị trí phân chia × định tuyến lưu trữ. Số 7x giả định bộ đống đầy đủ này.

```figure
pipeline-parallel
```

## Sử dụng nó

`code/main.py`tính toán dấu chân HBM, giải mã thông qua (chế độ gắn nhớ) và mã thông báo $/M cho một mô hình trên ba ngăn xếp: H100 + BF16 + vLLM, H100 + FP8 + vLLM, B200 + NVFP4/FP8 + TRT-LLM.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-trtllm-blackwell-advisor.md`Với khối lượng công việc, kích thước mô hình và khối lượng mã thông báo hàng năm, nó quyết định liệu khối Blackwell + TRT-LLM có đáng giá với khóa NVIDIA hay không.

## Các bài tập

1. Đi chạy`code/main.py`. Trên một 120B MoE với các tham số hoạt động 30%, tính toán thông qua mã hóa có giới hạn băng thông bộ nhớ trên H100 BF16, H100 FP8, và B200 NVFP4/FP8.
2. Một khách hàng chi 2 triệu USD/năm cho H100 + vLLM. Số lượng GPU Blackwell cần mua để giảm giá chuyển sang TRT-LLM trong 12 tháng, với khoảng cách kinh tế 7x?
3. Bạn sẽ thấy độ chính xác giảm 3 điểm trên MATH sau khi chuyển đổi trọng lượng NVFP4. Hãy cho biết hai con đường phục hồi: một chất lượng trước (giữ trọng lượng FP8) và một chi phí trước (sự chuẩn hóa với dữ liệu trong lĩnh vực).
4. Đọc kết quả suy luận MLPerf v6.0. nhiệm vụ nào có khoảng cách nhỏ nhất về Blackwell-over-Hopper, và tại sao?
5. Xét HBM cần thiết cho mô hình 405B ở trọng lượng NVFP4 + FP8 KV cache ở ngữ cảnh 128k.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| FP8 | "eight-bit float" | 8-bit floating point; used for KV cache and attention due to dynamic range |
| NVFP4 | "four-bit micro" | NVIDIA's 4-bit microscaling FP format; weights and activations on Blackwell |
| MXFP8 | "MX eight" | Microscaling FP8 variant; hardware-accelerated on Blackwell Tensor Cores |
| Day-0 FP4 | "ship FP4 weights" | Model providers release weights already in FP4; no post-train conversion step |
| MTP | "multi-token prediction" | TRT-LLM's integrated speculative-decoding draft (Phase 17 · 05) |
| Disaggregated serving | "split prefill/decode" | Prefill and decode on separate GPU pools; KV transferred over NVLink/IB |
| All-to-all | "MoE expert comm" | Communication pattern routing tokens to expert GPUs; NVLink 5 cuts 3x |
| InferenceX | "SemiAnalysis inference bench" | The 2026 industry-accepted cost-per-token benchmark |

## Đọc thêm

- [NVIDIA — Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) Tháng 4 năm 2026 kết quả MLPerf.
- [NVIDIA — MoE Inference on Blackwell](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/) NVLink 5 tất cả mọi người và hạt nhân MoE.
- [TensorRT-LLM Overview](https://nvidia.github.io/TensorRT-LLM/overview.html) Tài liệu động cơ chính thức.
- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) dàn nhạc phân chia trên TRT-LLM.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) bộ điểm chuẩn xuất bản số Blackwell.
