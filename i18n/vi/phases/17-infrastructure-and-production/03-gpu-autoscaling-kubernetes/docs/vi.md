# GPU Autoscaling trên Kubernetes  Karpenter, KAI Scheduler, Gang Scheduling

> Ba lớp, không phải một lớp. Các dự án Karpenter nối động (dưới một phút, 40% nhanh hơn Cluster Autoscaler). KAI Scheduler xử lý lập trình nhóm, nhận thức về topology và hàng ngũ bậc thang  nó ngăn chặn bẫy phân bổ phần 7 trong 8 nơi bảy nút chờ và đốt cháy trên một GPU bị mất. Các bộ tự động cấp ứng dụng (NVIDIA Dynamo Planner, llm-d Workload Variant Autoscaler) đo lường trên các tín hiệu cụ thể suy luận  độ sâu hàng, sử dụng bộ nhớ cache KV  không phải chu kỳ hoạt động của CPU / DCGM. Cái bẫy HPA cổ điển là`DCGM_FI_DEV_GPU_UTIL`là một phép đo chu kỳ nhiệm vụ: 100% có thể là 10 yêu cầu hoặc 100. vLLM phân bổ trước bộ nhớ cache KV, vì vậy bộ nhớ không bao giờ kích hoạt quy mô xuống. Bài học này dạy bạn cách soạn ba lớp và tránh mặc định Karpenter `WhenEmptyOrUnderutilized`Chính sách chấm dứt việc chạy các công việc GPU giữa thời gian.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy queue-depth autoscaler simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## Mục tiêu học tập

- Chụp đồ thị ba lớp tự động quy mô (định lượng nút, lập lịch nhóm, cấp độ ứng dụng) và đặt tên công cụ được sử dụng tại mỗi lớp.
- Hãy giải thích lý do tại sao `DCGM_FI_DEV_GPU_UTIL`là tín hiệu HPA sai cho vLLM và đặt tên cho hai thay thế (thâm sâu hàng rào, sử dụng cache KV).
- Mô tả lập trình nhóm và chế độ thất bại phân bổ một phần KAI Scheduler ngăn chặn (7 trong số 8 GPU không hoạt động).
- Tên chính sách hợp nhất của Karpenter (`WhenEmptyOrUnderutilized`) chấm dứt việc chạy các công việc GPU và nêu ra sự thay thế an toàn vào năm 2026.

## Vấn đề

Nhóm của anh đưa ra dịch vụ LLM trên Kubernetes.`DCGM_FI_DEV_GPU_UTIL`HPA không bao giờ tăng quy mô  nó đã nghĩ bạn đã đầy. bạn thêm một bản sao bằng tay; TTFT giảm. HPA vẫn không tăng quy mô. tín hiệu đang nói dối bạn.

Một lệnh mã thông báo 1M đến lúc 2 giờ sáng; cluster dành 3 phút để cung cấp một nút, và thời gian yêu cầu.

Một lần nữa, bạn triển khai một mô hình 70B đòi hỏi 8 GPU trên 2 nút. Cluster có 7 GPU miễn phí, lan rộng trên 3 nút, và cần thêm một. Cluster Autoscaler cung cấp một nút cho 1 GPU thiếu. 7 GPU được dự trữ ngồi yên trong 4 phút đốt tiền trong khi Kubernetes nhận GPU cuối cùng lên.

Ba lớp, ba chế độ thất bại khác nhau. Auto-scaling GPU nhận thức vào năm 2026 không phải là "tập vào HPA". Nó là tạo ra các nút cung cấp, lập lịch nhóm, và ứng dụng tín hiệu tự động.

## Khái niệm

### Lớp 1  Định lượng nút (Karpenter)

Karpenter xem các pods và các nút dự trữ đang chờ trong khoảng 45-60 giây (Cluster Autoscaler thường mất 90-120 giây cho các nút GPU).`NodePool`hạn chế  nếu pod của bạn cần 8 H100 và cluster không có nút phù hợp, Karpenter cung cấp một trực tiếp thay vì mở rộng quy mô một nhóm hiện có.

**The consolidation trap**: Karpenter's default `consolidationPolicy: WhenEmptyOrUnderutilized`là nguy hiểm cho các GPU pool. Nó sẽ chấm dứt một nút GPU đang chạy để di chuyển pods sang một phiên bản kích thước phù hợp rẻ hơn. Đối với tải trọng công việc suy luận có nghĩa là loại bỏ các yêu cầu đang chạy và tải lại mô hình 70B trên nút mới.

Cài đặt an toàn cho các hồ GPU:

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

Cho phép Karpenter hợp nhất các nút thực sự trống rỗng sau một giờ nhưng không bao giờ đuổi việc đang chạy.

### Lớp 2  lập trình băng đảng (KAI Scheduler)

KAI Scheduler (phương án "Karp" sau đó được đổi tên) xử lý những gì kube-scheduler mặc định không làm:

**Gang scheduling** lập trình tất cả hoặc không có gì. một pods phân phối suy luận đòi hỏi 8 GPU hoặc tất cả 8 bắt đầu cùng nhau hoặc không làm. Nếu không có điều này, bạn có cái bẫy phân bổ một phần: 7 trong số 8 pods bắt đầu, chờ vô thời hạn, đốt tiền.

**Topology awareness** biết GPU nào chia sẻ NVLink, nằm trên cùng một ngăn xếp, có InfiniBand giữa họ. Đặt pods tương ứng.

**Hierarchical queues** nhiều đội cạnh tranh cho cùng một nhóm GPU với ưu tiên và hạn chế.

KAI được triển khai cùng với kube-scheduler như một scheduler thứ cấp; bạn ghi chú tải trọng công việc để sử dụng nó.

### Lớp 3  Các tín hiệu cấp ứng dụng

**The HPA trap**`DCGM_FI_DEV_GPU_UTIL`là một phép đo chu kỳ nhiệm vụ  nó đo liệu GPU có đang làm việc tại mỗi khoảng thời gian lấy mẫu. 100% sử dụng có thể có nghĩa là 10 yêu cầu đồng thời hoặc 100; GPU đã bận rộn theo cả hai cách. Scaling trên chu kỳ nhiệm vụ đang mở rộng mù quáng.

Tệ hơn, vLLM và các động cơ tương tự đã phân bổ bộ nhớ cache KV (từ `--gpu-memory-utilization`HPA dựa trên bộ nhớ không bao giờ giảm.

**2026 replacement signals**- Có thể là:

- Độ sâu hàng (nước yêu cầu chờ dự kiến).
- Sử dụng cache KV (nhiều phần nào các khối được phân bổ cho các chuỗi hoạt động).
- Per-replica P99 TTFT (sín hiệu SLA của bạn).
- Goodput (cần đáp ứng tất cả các SLO mỗi giây).

NVIDIA Dynamo Planner và llm-d Workload Variant Autoscaler tiêu thụ các tín hiệu và sao chép quy mô này.

### Khi nào sử dụng gì

| Scale decision | Tool |
|----------------|------|
| Add/remove nodes | Karpenter |
| Schedule multi-GPU jobs | KAI Scheduler |
| Add/remove replicas | Dynamo Planner / llm-d WVA (or custom HPA on queue depth) |
| Choose GPU type | Karpenter NodePool |
| Preempt low-priority | KAI Scheduler queues |

### Việc phân tích các mẫu prefill/decode làm phức tạp mọi thứ

Nếu bạn chạy prefill / decode phân chia (Phase 17 · 17), bạn có hai lớp pod với các kích hoạt quy mô khác nhau: prefill pods scale trên chiều sâu hàng, decode pods scale trên áp suất cache KV. llm-d phơi bày chúng như riêng biệt `Services`Không cố gắng đặt một HPA trước cả hai.

### Bắt đầu lạnh cũng quan trọng ở đây

Khử hiệu ứng khởi động lạnh (Phase 17 · 10) là khi thời gian cung cấp nút trở nên hiển thị cho người dùng.`min_workers=1`) cho các đường SLO-chẩn đoán, hoặc sử dụng Modal kiểu kiểm tra chỉ số tại lớp ứng dụng.

### Những con số mà bạn nên nhớ

- Định lượng nút Karpenter: ~ 45-60s vs Cluster Autoscaler ~ 90-120s (gpuu node).
- KAI Scheduler ngăn chặn chất thải phân bổ một phần  7 trong 8 bẫy.
- `DCGM_FI_DEV_GPU_UTIL`như tín hiệu HPA: bị hỏng; sử dụng độ sâu hàng hoặc sử dụng KV.
- Thợ làm gỗ `WhenEmptyOrUnderutilized`: chấm dứt việc chạy GPU. Sử dụng `WhenEmpty + consolidateAfter: 1h`để suy luận.

```figure
autoscaling
```

## Sử dụng nó

`code/main.py`mô phỏng một bộ tự động quy mô ba lớp trên khối lượng làm việc của GPU nổ. So sánh HPA ngây thơ (thời gian nhiệm vụ), HPA chiều sâu hàng rào và quy mô theo lịch trình của KAI-gang. báo cáo yêu cầu không được đáp ứng, phút GPU vô hiệu và điểm số tổng hợp.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-gpu-autoscaler-plan.md`Với topology cluster, hình dạng tải trọng và SLO, nó thiết kế một kế hoạch tự động quy mô ba lớp.

## Các bài tập

1. Đi chạy`code/main.py`Trong một khối lượng công việc bùng nổ, bao nhiêu yêu cầu HPA trong chu kỳ nhiệm vụ ngây thơ bỏ ra những HPA sâu hàng rào bắt bắt?
2. Thiết kế một Karpenter NodePool cho một cluster phục vụ Llama 3.3 70B FP8 trên H100 SXM5.`capacity-type`- `disruption.consolidationPolicy`- `consolidateAfter`, và một vết bẩn giữ không GPU tải trọng làm việc khỏi các nút này.
3. Nhóm của bạn báo cáo rằng triển khai bị mắc kẹt trong chờ bởi vì "GPU có sẵn nhưng không có chương trình". Chẩn đoán  đây là Karpenter, kube-scheduler, hoặc KAI Scheduler?
4. Chọn một tín hiệu cho các pods sạc tự động và một tín hiệu khác cho các pods giải mã.
5. Xét chi phí của `WhenEmptyOrUnderutilized`Trầm kết hợp hợp nhất định trên một dịch vụ sản xuất 24x7 với trung bình 60 sự kiện giảm yêu cầu/ngày tại P99 TTFT > 10s.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Karpenter | "the node provisioner" | Kubernetes node autoscaler; sub-minute provisioning |
| Cluster Autoscaler | "the old scaler" | Kubernetes node autoscaler predecessor; slower, group-based |
| KAI Scheduler | "the GPU scheduler" | Secondary scheduler for gang + topology + queues |
| Gang scheduling | "all or nothing" | Schedule N pods atomically or defer all of them |
| Topology awareness | "rack-aware" | Place pods based on NVLink/IB/rack placement |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU utilization" | Duty-cycle metric; NOT a scaling signal for LLMs |
| Queue depth | "waiting requests" | Correct HPA signal for prefill-bound scaling |
| KV cache utilization | "memory pressure" | Correct HPA signal for decode-bound scaling |
| Consolidation | "Karpenter consolidation" | Node termination to cheaper instance type |
| `WhenEmpty + 1h` | "safe consolidation" | Policy that doesn't evict running GPU jobs |

## Đọc thêm

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) các tài liệu thiết kế và ví dụ cấu hình.
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/) ngữ nghĩa chính sách hợp nhất và các mặc định an toàn GPU.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) Dynamo Planner quy mô tín hiệu.
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) Mô hình tích hợp tia.
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) hướng dẫn cụ thể cho Kubernetes.
- [llm-d GitHub](https://github.com/llm-d/llm-d) Thiết kế Autoscaler Load Variant
