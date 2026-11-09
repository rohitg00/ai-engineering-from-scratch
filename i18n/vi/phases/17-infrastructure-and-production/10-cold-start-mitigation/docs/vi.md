# Khử hiệu ứng bắt đầu lạnh cho LLM không có máy chủ

> Một mô hình lớn mất vài phút để đi từ lạnh đến phục vụ: một mô hình 70B trên một nút tươi cần khoảng 3-8 phút trước khi token đầu tiên. Trong một thế giới không có máy chủ thực sự, đó không phải là một sự nóng lên  đó là một sự gián đoạn. Các giảm hoạt động ở năm lớp: hình ảnh nút được gieo trước (Bottlerocket trên AWS, vòm hai khối), dòng dòng dòng (NVIDIA Run:ai Model Streamer, bản địa trong vLLM), chụp ảnh chụp trong bộ nhớ GPU (Mô-định kiểm tra, khởi động lại nhanh hơn 10 lần), hồ bơi ấm (`min_workers=1`), tải cấp (ServerlessLLM NVMe→DRAM→HBM đường ống dẫn, giảm độ trễ 10-200x), cộng với mô hình thứ sáu bổ sung, di chuyển trực tiếp di chuyển các token đầu vào (KB) thay vì bộ nhớ cache KV (GB). Modal xuất bản 2-4s bắt đầu lạnh như một tầng; Baseten 5-10s mặc định, dưới giây với trước khi nóng lên. Bài học này dạy bạn đo, ngân sách và xếp chồng năm tầng.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cold-start path simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~60 minutes

## Mục tiêu học tập

- Đặt ra danh sách năm lớp giảm thiểu khởi động lạnh và đặt tên một công cụ hoặc mô hình tại mỗi lớp.
- Xét tổng thời gian khởi động lạnh như là tổng của (định lượng nút) + (nặng tải xuống) + (nặng tải vào HBM) + (nặng khởi động động) cho mô hình 70B.
- Giải thích tại sao việc di chuyển trực tiếp chuyển giao token đầu vào (KB) chứ không phải bộ nhớ cache (GB) và hình phạt là gì (tái tính).
- Tên thương mại hồ ấm (trả tiền cho GPU không hoạt động hoặc chấp nhận đuôi khởi động lạnh) và ngưỡng SLA tại đó `min_workers > 0`trở nên bắt buộc.

## Vấn đề

Các điểm cuối của LLM không máy chủ của bạn tăng lên không qua đêm.

1. Karpenter cung cấp một nút GPU: 45-60s.
2. Container kéo một hình ảnh 30 GB với trọng lượng: 120-300s.
3. Động cơ tải trọng vào HBM: 45-120s tùy thuộc vào kích thước mô hình và tốc độ lưu trữ.
4. vLLM hoặc TRT-LLM khởi tạo biểu đồ CUDA, kho lưu trữ KV, tokeniser: 10-30s.

Tổng cộng: 220-510s (khoảng 3-8 phút) trước khi một token trở lại. SLA của bạn là 2s. Bạn vận chuyển một hồ ấm (`min_workers=1`Nếu dịch vụ của bạn có 5 sản phẩm mỗi với một bản sao ấm áp, đó là 5 × 24 × 30 = 3.600 giờ GPU / tháng dù một người dùng gọi hay không.

Khử hiệu ứng khởi động lạnh là cách giữ cho nền kinh tế không máy chủ trong khi gần gũi với thời gian trễ của luôn bật.

## Khái niệm

### Lớp 1  hình ảnh nút được gieo trước (Bottlerocket)

Trên AWS, kiến trúc hai khối lượng của Bottlerocket tách hệ điều hành khỏi dữ liệu. chụp ảnh khối lượng dữ liệu với hình ảnh container của bạn được kéo trước; tham khảo ID chụp ảnh trong `EC2NodeClass`. Các nút mới khởi động với trọng lượng đã trên NVMe địa phương  bước 2 và một phần của 3 biến mất.

Tương đương trên GCP: hình ảnh VM tùy chỉnh với các lớp container được nướng trước. trên Azure: chụp ảnh nhanh được quản lý trên đĩa với cùng một mô hình.

### Lớp 2  dòng dòng dòng (Run:ai Model Streamer)

Thay vì tải toàn bộ tập tin trước khi trả lời yêu cầu đầu tiên, lưu lượng tải vào bộ nhớ GPU layer-by-layer và bắt đầu xử lý ngay khi khối biến thể đầu tiên là cư dân. NVIDIA Run:ai Model Streamer được chuyển giao bản địa vào vLLM 2026.

### Lớp 3  GPU memory snapshots (Modal)

Modal lấy một điểm kiểm tra của trạng thái GPU (năm trọng lượng, đồ thị CUDA, khu vực cache KV) sau khi tải đầu tiên. khởi động lại tiếp theo sẽ chuyển sang HBM 10x nhanh hơn so với khởi động lại. Đây là điều gần nhất để "bắt đầu một GPU ấm trong 2 giây".

### Lớp 4  hồ bơi ấm (min_workers=1)

Điều kiện đơn giản nhất: luôn luôn luôn chuẩn bị một bản sao. Chi phí là tốc độ giờ của một GPU 24x7.$0.85-$1.50/h để tránh bắt đầu lạnh 30s) và tử tế với những người lớn (trả tiền 4 $ / giờ để tránh bắt đầu lạnh 5 phút).

### Lớp 5  Lưu trữ cấp độ (ServerlessLLM)

ServerlessLLM xử lý lưu trữ như một hệ thống phân cấp: NVMe (nhanh nhưng lớn), DRAM (gần cấp nhưng trung bình), HBM (tín nhưng tức thời). trọng lượng được tải trước vào DRAM; tải theo yêu cầu vào HBM. Bảng báo cáo giảm độ trễ 10-200x trên tải lạnh so với đĩa ngây thơ-to-HBM. Việc áp dụng sản xuất là sớm nhưng tích hợp với vLLM tồn tại.

### Lớp 6  di chuyển trực tiếp (chương thức tiền thưởng)

Khi một nút không có sẵn (đánh trừ điểm, thoát node), mô hình truyền thống là khởi động lạnh một bản sao khác và thoát hàng yêu cầu. Di chuyển trực tiếp di chuyển các token đầu vào (kilobytes) đến một điểm đến mà có mô hình được tải và tính lại bộ nhớ cache KV trên điểm đến. Việc tính lại rẻ hơn so với việc chuyển GB bộ nhớ cache KV qua mạng.

### Các toán học hồ bơi ấm

Đối với một dịch vụ với P99 TTFT SLA của 2s, câu hỏi không phải là "hồ ấm có/không" mà là "các bản sao ấm, và những con đường nào có được chúng".

- Các đường tương tác có giá trị cao (chát trực tiếp, đại lý giọng nói): `min_workers=1-2`- Tôi không biết.
- Các đường đợt sau (tỷ lệ phân loại hàng đêm): quy mô đến không được chấp nhận, khởi động lạnh 5-10 phút được chấp nhận.
- Tầng cao cấp: `min_workers`cho mỗi người thuê nhà có khả năng chuyên dụng.

### Đánh giá trước khi tối ưu hóa

Phân tích khởi động lạnh cho mô hình 70B trên một nút tươi (được minh họa):

| Phase | Time | Mitigation |
|-------|------|-----------|
| Node provision | 50s | Bottlerocket + pre-seeded image, warm pool |
| Image pull | 180s | Pre-seeded data volume (eliminate) |
| Weights to HBM | 75s | Model streamer (halve); GPU snapshot (eliminate) |
| Engine init | 20s | Persistent CUDA graph cache |
| First forward | 3s | Min inherent latency |
| **Total cold** | **328s** | |
| **Total with mitigations** | **~15s** | 22x reduction |

### Những con số mà bạn nên nhớ

- Biến lạnh mô-dal: 2-4s (với ảnh chụp GPU).
- Baseten khởi động lạnh mặc định: 5-10s; dưới giây với quá trình nóng trước.
- Bắt đầu lạnh 70B thô: 3-8 phút.
- Run:ai Model Streamer: ~ 2x trọng lượng tải tăng tốc.
- Lưu trữ cấp độ của ServerlessLLM: Giảm độ trễ 10-200x (năm giấy).

```figure
cold-start-pipeline
```

## Sử dụng nó

`code/main.py`mô hình một con đường khởi động lạnh với và không có mỗi giảm thiểu. báo cáo tổng thời gian khởi động lạnh, chi phí hồ bơi ấm và tỷ lệ yêu cầu chia cắt trên đó hồ bơi ấm tự trả cho mình.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-cold-start-planner.md`Với SLA, kích thước mô hình và hình dạng giao thông, chọn các giảm thiểu để xếp chồng lên.

## Các bài tập

1. Đi chạy`code/main.py`- Xét số lượng yêu cầu giảm cân trên đó một bản sao ấm rẻ hơn so với việc trả thuế khởi động lạnh thông qua giảm yêu cầu bổ sung tại SLO.
2. Bạn triển khai một mô hình 13B với P99 TTFT SLA của 3s. chọn ngăn xếp giảm thiểu (đất ít lớp) đạt được nó.
3. Bottlerocket pre-seeding loại bỏ thu hút hình ảnh nhưng trọng lượng vẫn tải từ snapshot đến HBM.
4. Nhà cung cấp không có máy chủ của bạn cung cấp ảnh chụp nhanh GPU (Modal) và nhóm của bạn từ chối vì "phác chụp nhanh rò rỉ PII. " Phàn nàn cả hai bên  rủi ro thực tế là gì, và giảm thiểu là gì (phác chụp nhanh tạm thời, mã hóa, cách ly không gian tên)?
5. Thiết kế một chính sách hồ bơi ấm cấp bậc: bao nhiêu bản sao ấm cho người dùng trả tiền, người dùng thử nghiệm và khối lượng công việc hàng loạt?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Cold start | "the big pause" | Time from request to first token on a fresh replica |
| Warm pool | "always-on minimum" | `min_workers >= 1` to keep at least one replica ready |
| Pre-seeded image | "baked AMI" | Node image with container weights pre-resident |
| Bottlerocket | "AWS node OS" | AWS container-optimized OS with dual-volume snapshot support |
| Model streamer | "streaming load" | Overlap weights I/O with compute setup |
| GPU snapshot | "checkpoint to HBM" | Serialize post-load GPU state; deserialize on restart |
| Tiered loading | "NVMe + DRAM + HBM" | Hierarchy of storage tiers; load on demand |
| Live migration | "move tokens" | Transfer input (KB), recompute KV on destination |
| `min_workers` | "warm replicas" | Serverless minimum keep-alive count |
| Scale-to-zero | "full serverless" | No cost when idle; accept full cold-start tax |

## Đọc thêm

- [Modal — Cold start performance](https://modal.com/docs/guide/cold-start) Các tiêu chuẩn và kiến trúc điểm kiểm soát được công bố của Modal.
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket) mô hình chụp ảnh nhanh về khối lượng dữ liệu được gieo trước.
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer) tải trọng chồng chéo với thiết lập tính toán.
- [Baseten — Cold starts](https://docs.baseten.co/deployment/autoscaling/cold-starts) Quyển sách trước khi nóng lên.
- [ServerlessLLM paper (USENIX OSDI'24)](https://www.usenix.org/conference/osdi24/presentation/fu) Thiết kế tải hàng cấp.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) di cư trực tiếp cho các triển khai phân chia.
