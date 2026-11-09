# Phân tích Prefill/Decode  NVIDIA Dynamo và llm-d

> Prefill là tính toán; decode là bộ nhớ. Đi cả hai trên cùng một GPU lãng phí một nguồn lực. Việc phân chia phân chia chúng thành các nhóm riêng biệt và chuyển cache KV giữa chúng qua NIXL (RDMA/InfiniBand hoặc TCP fallback). NVIDIA Dynamo (GTC 2025 thông báo, 1.0 GA) nằm trên vLLM / SGLang / TRT-LLM  của nó Tự động trình độ dự định + SLA Planner tỷ lệ tự động-chấp đầy: tỷ lệ giải mã để đáp ứng SLO. NVIDIA công bố tăng trưởng thông qua trong sân chơi này  developer.nvidia.com (2025-06) cho thấy cải thiện ~ 6x cho DeepSeek-R1 MoE trên GB200 NVL72 + Dynamo trong chế độ chậm trung bình, và trang sản phẩm của Dynamo (developer.nvidia.com, chưa được xác định) quảng cáo lên đến 50x thông qua MoE trên GB300 NVL72 + Dynamo vs Hopper. Hình số "30x" là tổng cộng cộng cộng đồng trên các báo cáo đầy đủ của Blackwell + Dynamo + DeepSeek-R1; chúng tôi không tìm thấy một nguồn chính xác cho biết chính xác 30x, vì vậy hãy coi nó như một tuyên bố hướng. llm-d (Red Hat + AWS) là Kubernetes-native: prefill / decode / router như các dịch vụ độc lập với mỗi vai trò HPA. llm-d 0.5 thêm KV phân cấp, cache-thông thức LoRA định tuyến, UCCL mạng, quy mô-to-không. Kinh tế: việc mở rộng nội bộ của nhiều thông báo khách hàng cho thấy tiết kiệm 3040% trên $2M-class inference spend (i.e., $600-800K/năm) khi chuyển từ phân phối ở chỗ sang phân chia với Dynamo với SLA liên tục;$2M→$Hình số 600-800K là một hợp chất nội bộ, không có một nghiên cứu trường hợp được công bố  sử dụng nó như một neo thứ tự của quy mô, không phải là một trích dẫn tham chiếu.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy disaggregated-vs-colocated simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 08 (Inference Metrics)
**Time:** ~75 minutes

## Mục tiêu học tập

- Giải thích tại sao prefill và decode có phân bổ GPU tối ưu khác nhau và định lượng chất thải trong colocation.
- Chụp đồ họa kiến trúc phân chia: hồ bơi prefill, hồ bơi decode, chuyển KV qua NIXL, router.
- Hãy nêu tên tình trạng khi phân tích không mang lại kết quả (các lời nhắc ngắn, các kết quả ngắn).
- Hóa ra sự khác biệt giữa NVIDIA Dynamo (nhiệm trên) và llm-d (native Kubernetes) và phù hợp với từng ngữ cảnh hoạt động.

## Vấn đề

Bạn chạy Llama 3.3 70B trên 8 H100. Trong khi có tải công việc hỗn hợp (phản ứng dài + đầu ra ngắn), GPU không hoạt động trong quá trình giải mã vì phần lớn tính toán đã được chi tiêu cho việc prefill. Trong khi có tải công việc khác nhau (phản ứng ngắn + đầu ra dài), ngược lại xảy ra.

Ảnh hưởng ngân sách: 20-40% thời gian GPU bị lãng phí trên nguồn tài nguyên sai. Bạn đang mua máy tính H100 để chạy mã hóa liên kết bộ nhớ, hoặc mua băng thông H100 HBM để chạy prefill liên kết máy tính. Cả hai đều là lãng phí đắt tiền.

Việc phân chia phân chia prefill và decode thành các pool riêng biệt có kích thước cho nút chai của mỗi nhóm. KV cache chuyển từ prefill pool sang decode pool thông qua kết nối băng thông cao.

## Khái niệm

### Tại sao những rào cản khác nhau

**Prefill** chạy bộ biến đổi trên toàn bộ đầu vào prompt trong một tiến. Matrix nhân chiếm ưu thế; liên kết tính toán. H100 FP8 cung cấp ~ 2000 TFLOPS của thông qua hữu ích. hiệu quả hàng loạt là tốt  một tiến xử lý nhiều token.

**Decode** tạo ra một token một lần, đọc toàn bộ trọng lượng mỗi lần lặp lại. Khoảnh khắc-bandwidth-bound. HBM3 cung cấp ~ 3 TB / s. hiệu quả batch tốt chỉ ở đồng thời cao  trọng lượng đọc giảm trên toàn batch.

Đặt chúng: bạn mua GPU tối ưu hóa cho cả hai. H100 tốt cho cả hai nhưng giá cả tương tự trong cả hai trường hợp. Ở quy mô, bạn muốn bể chứa tiền trên H100 / tính toán nặng; bể giải mã trên H200 / bộ nhớ nặng, hoặc với định lượng tích cực.

### Kiến trúc

```
            ┌──────────────┐
  Request → │    Router    │ ───────────────────────┐
            └──────┬───────┘                        │
                   │                                │
                   ▼ (prompt only)                  │
            ┌──────────────┐    KV cache    ┌───────▼──────┐
            │ Prefill pool │ ─── NIXL ────► │ Decode pool  │
            │  (compute)   │                │  (memory)    │
            └──────────────┘                └──────┬───────┘
                                                   │ tokens
                                                   ▼
                                                 Client
```

NIXL là giao thông giữa các nút của NVIDIA. Sử dụng RDMA / InfiniBand khi có sẵn, TCP fallback nếu không. Trễ chuyển là thực  thường là 20-80 ms cho bộ nhớ cache KV của một lệnh báo 4K-token trên 70B FP8.

### Dynamo vs llm-d

**NVIDIA Dynamo**(GTC 2025 thông báo, 1.0 GA):
- Nằm trên vLLM, SGLang, TRT-LLM như một nhạc sĩ.
- Planner Profiler đo tải trọng công việc, SLA Planner tự động cấu hình prefill:decode ratios.
- Core dung nhựa, Python có thể mở rộng.
- Tăng suất: NVIDIA báo cáo 6x cho DeepSeek-R1 MoE trên GB200 NVL72 + Dynamo trong chế độ chậm trung bình (developer.nvidia.com, 2025-06); báo cáo cộng đồng "hơn 30x" trên toàn bộ Blackwell + Dynamo + DeepSeek-R1 stacks thiếu một nguồn chính duy nhất và nên được coi là hướng dẫn.
- GB300 NVL72 + Dynamo: đến 50 lần thông qua MoE so với Hopper cho mỗi trang sản phẩm của Dynamo (developer.nvidia.com, chưa được xác định).

**llm-d**(Red Hat + AWS, Kubernetes bản địa):
- Prefill / decode / router như dịch vụ Kubernetes độc lập.
- HPA cho mỗi vai trò với tín hiệu độ sâu hàng (prefill) / KV sử dụng (decode).
- `topologyConstraint packDomain: rack`gói prefill+decode click trên cùng một rack cho việc chuyển tải KV băng thông cao.
- llm-d 0.5 (2026): KV phân cấp, định tuyến LoRA có ý thức về cache, mạng UCCL, quy mô đến không.

Sử dụng Dynamo nếu bạn muốn một trình diễn viên được quản lý trên đống, sử dụng llm-d nếu bạn muốn những người nguyên thủy gốc Kubernetes và cam kết với hệ sinh thái CNCF.

### Kinh tế

Sơ cấu nội bộ (không có một nghiên cứu trường hợp được công bố  neo thứ tự của quy mô):

- 2 triệu đô la/năm chi tiêu suy luận cho việc phục vụ.
- Chuyển sang phân chia với Dynamo.
- Tương tự khối lượng yêu cầu, tương tự P99 độ trễ SLA.
- Tiền tiết kiệm được báo cáo: $600K–$800K/năm (3040% giảm).
- Không có phần cứng mới.

Chúng tôi tổng hợp con số này từ nhiều thông báo của khách hàng thay vì một nghiên cứu trường hợp có thể trích dẫn duy nhất; điểm dữ liệu được công bố gần nhất là TTFT nhanh hơn 2 lần của Baseten / 61% cao hơn thông qua với định tuyến Dynamo KV (baseten.co, 2025-10), và dự báo của VAST + CoreWeave là 60130% thêm token / $ với tỷ lệ hit KV 4060% (vastdata.com, 2025-12). Tiết kiệm đến từ kích thước phù hợp của mỗi hồ bơi; tải trọng công việc nặng trước khi lấp (RAG với tiền đề 8K +) có lợi hơn so với những người cân bằng.

### Khi không phân chia

- Các khoản đầu tư < 512 token và các khoản đầu tư < 200 token: thuế chuyển nhượng chiếm ưu thế lợi nhuận.
- Cluster nhỏ (< 4 GPU): không đủ đa dạng hồ bơi.
- Nhóm không thể vận hành hai bộ xử lý GPU với quy mô mỗi vai trò: Dynamo giúp nhưng không tầm thường.
- Không có mô hình RDMA: Thuế chuyển giao TCP nặng hơn.

### Router tích hợp với giai đoạn 17 · 11

Các router phân chia là KV-cache-aware (Phase 17 · 11). Một yêu cầu hạ cánh trên hồ sơ giải mã giữ tiền đề của nó  nếu không phù hợp, nó chảy prefill → decode.

### MoE trên Blackwell là nơi mà các con số thực là

GB300 NVL72 + Dynamo cho thấy thông suất MoE 50x trên đường cơ sở Hopper. Đường bộ chuyên gia MoE nặng tính toán khi sấp đầy trước nhưng bộ nhớ nặng khi giải mã (bảo lưu chuyên gia), vì vậy phân chia là một chiến thắng gấp đôi. Mô hình biên giới 2026 phục vụ là MoE thống trị (DeepSeek-V3, biến thể GPT-5 tương lai).

### Những con số mà bạn nên nhớ

Số điểm chuẩn bị  NVIDIA và các kết luận xếp hàng đăng cập nhật kết quả mỗi quý. Kiểm tra lại trước khi trích dẫn.

- DeepSeek-R1 trên GB200 NVL72 + Dynamo: ~ 6x thông qua so với đường cơ sở trong chế độ chậm trung bình (developer.nvidia.com, 2025-06); các yêu cầu cộng đồng "chừng 30x" trên các đống Blackwell + Dynamo đầy đủ là tổng hợp hướng mà không có một nguồn chính duy nhất.
- GB300 NVL72 + Dynamo: đến 50x dung lượng MoE so với Hopper (developer.nvidia.com, chưa được xác định).
- Cây cốt tiết kiệm (nhóm tổng hợp nội bộ, không phải là một nghiên cứu trường hợp duy nhất): $600-800K/year off a $2M chi tiêu hàng năm với SLA liên tục.
- Khoảng mục: yêu cầu > 512 token + đầu ra > 200 token.
- Chuyển KV qua NIXL: 20-80 ms cho KV 4K-quang trên 70B FP8.

```figure
prefill-decode-split
```

## Sử dụng nó

`code/main.py`mô phỏng dịch vụ được đặt tại chỗ so với phân chia. báo cáo thông qua, chi phí theo yêu cầu và giao thông qua chiều dài nhanh.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-disaggregation-decider.md`Với khối lượng công việc và nhóm, quyết định liệu có phân chia.

## Các bài tập

1. Đi chạy`code/main.py`- Dòng phân tích nhanh như thế nào vượt qua colocation?
2. Thiết kế hồ bơi prefill và giải mã hồ bơi cho một dịch vụ RAG với chiều dài tiền đề P99 8K, đầu ra 300.
3. Dynamo vs llm-d: chọn một cửa hàng Kubernetes tinh khiết mà không có thời gian chạy Python.
4. Lưu ý chi phí chuyển đổi KV: 4K prefill trên 70B FP8 = ~500 MB KV. Ở RDMA 100 GB / s, chuyển đổi = 5 ms. Ở TCP 10 GB / s = 50 ms. Điều gì quan trọng cho SLA của bạn?
5. Các chuyên gia định tuyến của MoE thay đổi các mô hình truy cập KV. Làm thế nào phân chia hành vi với MoE kích hoạt các chuyên gia khác nhau cho mỗi token?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Disaggregated serving | "split prefill/decode" | Separate GPU pools for each phase |
| NIXL | "NVIDIA transport" | Dynamo's inter-node KV transfer (RDMA/TCP) |
| NVIDIA Dynamo | "the orchestrator" | Stack-above coordinator for vLLM/SGLang/TRT-LLM |
| llm-d | "Kubernetes native" | Red Hat + AWS K8s disaggregated stack |
| Planner Profiler | "Dynamo auto-config" | Measures workload, configures pool ratios |
| SLA Planner | "Dynamo policy" | Auto-rate-matches prefill:decode to meet SLOs |
| `packDomain: rack` | "llm-d topology" | Pack prefill+decode on same rack for fast KV |
| UCCL | "unified collective" | llm-d 0.5 networking layer for scale-to-zero |
| MoE expert routing | "expert per token" | DeepSeek-V3 pattern; disaggregation helps |

## Đọc thêm

- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [TensorRT-LLM Disaggregated Serving blog](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [llm-d 0.5 release notes](https://github.com/llm-d/llm-d/releases)
