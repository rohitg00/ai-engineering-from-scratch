# Load Testing LLM API  Tại sao k6 và chấy lừa dối

> Các máy kiểm tra tải trọng truyền thống không được thiết kế cho các phản ứng phát trực tuyến, độ dài đầu ra biến, số liệu cấp token hoặc độ bão hòa GPU. Hai cái bẫy đâm hầu hết đội. Trạm GIL: Đo lường cấp token của Locust chạy token hóa dưới Python GIL, cạnh tranh với việc tạo yêu cầu trong sự đồng thời nặng; backlog token hóa sau đó làm tăng độ trễ giữa các token được báo cáo. Trạm đồng nhất định nhanh: các lệnh đồng nhất trong vòng lặp kiểm tra một điểm trên phân phối token; lưu lượng thực có chiều dài thay đổi và sự phù hợp của tiền tố khác nhau. LLMPerf sửa chữa điều này với `--mean-input-tokens`+ `--stddev-input-tokens`. Định hướng công cụ vào năm 2026: chuyên ngành LLM (GenAI-Perf, LLMPerf, LLM-Locust, guidellm) cho độ chính xác ở mức token; **k6 v2026.1.0**+ **k6 Operator 1.0 GA (Sept 2025)** lưu trữ thông tin, Kubernetes bản địa phân phối thông qua các CRD TestRun / PrivateLoadZone, tốt nhất cho cổng CI / CD; Vegeta for Go saturation rate không đổi; Locust 2.43.3 chỉ với mở rộng LLM-Locust cho lưu trữ.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, toy realistic-prompt generator + latency collector)
**Prerequisites:** Phase 17 · 08 (Inference Metrics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~75 minutes

## Mục tiêu học tập

- Giải thích hai kiểu chống (trầm GIL, cái bẫy đồng nhất nhanh) khiến các nhà kiểm tra tải trọng chung nói dối cho API LLM.
- Chọn một công cụ cho một mục đích nhất định: LLMPerf (động cơ chuẩn), k6 + mở rộng phát trực tuyến (cổng CI), guidellm (sản phẩm tổng hợp quy mô lớn), GenAI-Perf (chỉ lục NVIDIA).
- Thiết kế bốn mô hình tải (năng thẳng, trượt, đập, ngâm) và đặt tên chế độ thất bại mỗi lần bắt.
- Xây dựng phân phối nhanh thực tế bằng cách sử dụng trung bình + stddev của các token đầu vào thay vì chiều dài cố định.

## Vấn đề

Bạn đã thử nghiệm điểm cuối của LLM của mình với 500 người dùng đồng thời. Nó đã được. Bạn đã vận chuyển. Trong sản xuất với 200 người dùng thực tế dịch vụ rơi trên P99 TTFT nổ, GPUs bị gắn.

Thứ nhất, k6 gửi 500 lời nhắc giống nhau  việc thu thập yêu cầu và lưu trữ trước tiên của bạn làm cho nó trông giống như bạn đang xử lý 500 mã giải mã đồng thời khi bạn thực sự xử lý một. Thứ hai, k6 không theo dõi độ trễ giữa các mã thông báo trên các phản ứng phát trực tuyến theo cách mà mắt trải nghiệm nó; nó thấy một kết nối HTTP, không phải 500 mã thông báo đến với khoảng thời gian khác nhau.

Kiểm tra tải trọng cho LLM là kỷ luật của riêng nó.

## Khái niệm

### Trầm gẫy GIL (Locust)

Locust sử dụng Python và chạy phần mềm token hóa bên khách hàng dưới GIL. Trong thời gian đồng thời cao, các hàng đầu token hóa đứng sau việc tạo ra yêu cầu.

Giải quyết: LLM-Locust mở rộng di chuyển token hóa thành các quy trình riêng biệt, hoặc sử dụng một vòng xoắn ngôn ngữ được biên soạn (k6, LLMPerf sử dụng tokeners.rs).

### Mẫy đồng nhất nhanh chóng

Tất cả các trình kiểm tra tải được biết đến cho phép bạn cấu hình một prompt. Trong một thử nghiệm vòng lặp 10.000 lần lặp lại cùng một prompt gửi mỗi lần. Server thấy cùng một dấu tiền mỗi khi  dấu tiền đề cache chạm gần 100%, thông suất trông tuyệt vời.

Phác định: mẫu từ phân phối nhanh.`--mean-input-tokens 500 --stddev-input-tokens 150` độ dài khác nhau, nội dung khác nhau.

### Bốn mô hình tải

1. **Steady-state** RPS liên tục trong 30-60 phút.
2. **Ramp** tăng RPS theo tuyến tính từ 0 đến mục tiêu trong 15 phút.
3. **Spike** đột ngột 3-10x RPS trong 2 phút sau đó quay lại.
4. **Soak** trạng thái ổn định trong 4-8 giờ.

### 2026 thiết bị lập bản đồ

**LLMPerf**(Anyscale)  Python nhưng hỗ trợ token hóa Rust. Mean / stddev yêu cầu.

**NVIDIA GenAI-Perf** NVIDIA tham chiếu. Sử dụng khách hàng Triton; bao gồm cả các metric. Lưu ý ITL của nó không bao gồm TTFT; LLMPerf của nó. Hai công cụ tạo ra TPOT khác nhau cho cùng một máy chủ.

**LLM-Locust**(TrueFoundry)  Lễ mở rộng chấy rắc câu bẫy GIL.

**guidellm** Phân tích phân tích tổng hợp quy mô lớn.

**k6 v2026.1.0**+ **k6 Operator 1.0 GA (Sept 2025)**- Có thể là:
- k6 chính nó (Go, biên soạn, không có GIL) thêm các métrics biết streaming.
- k6 Nhà điều hành sử dụng các CRD TestRun / PrivateLoadZone cho các thử nghiệm phân tán gốc Kubernetes.
- Tốt nhất cho các cổng CI / CD và kiểm tra SLA.

**Vegeta** Go, đơn giản hơn k6. Nồng độ HTTP liên tục. Không có ý thức LLM nhưng tốt cho các thử nghiệm gateway / giới hạn tốc độ.

**Locust 2.43.3 stock** có cái bẫy GIL cho LLM. Chỉ với LLM-Locust mở rộng.

### Cổng SLA trong CI

Đi k6 trên PR với:

- 30-50 lần lặp mỗi lần ở RPS cơ bản.
- Cổng: P50/P95 TTFT, 5xx < 5%, TPOT dưới ngưỡng.
- Đánh phá sự cố.

### Phân phối nhanh chóng thực tế

Xây dựng từ các mẫu lưu lượng thực (nếu bạn có chúng) hoặc từ các phân phối được xuất bản (ví dụ, ShareGPT yêu cầu cho trò chuyện, HumanEval cho mã). Đưa trung bình + stddev đến LLMPerf. Tránh vòng với một yêu cầu với mọi giá.

### Những con số mà bạn nên nhớ

- k6 Nhà điều hành 1.0 GA: Tháng 9 năm 2025.
- k6 v2026.1.0: Métric nhận thức về streaming.
- Tiêu chuẩn LLMPerf chạy: 100-1000 yêu cầu tại đồng thời X.
- Cổng CI điển hình: 30-50 lần lặp mỗi PR.
- Bốn mô hình: ổn định, trượt, đòn, ngâm.

```figure
load-pattern-waves
```

## Sử dụng nó

`code/main.py`mô phỏng một thử nghiệm tải với phân phối nhanh thực tế, đo TPOT hiệu quả và chứng minh cái bẫy nhanh đồng nhất.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-load-test-plan.md`Với khối lượng công việc và SLA, chọn công cụ và thiết kế bốn mô hình tải.

## Các bài tập

1. Đi chạy`code/main.py`So sánh phân bố đồng nhất với phân bố thực tế  khoảng cách ở đâu?
2. Viết kịch bản k6 cho cổng CI: TTFT P95 < 800 ms ở 100 đồng thời, thời gian chạy 5 phút.
3. Thử nghiệm ngâm của bạn cho thấy bộ nhớ tăng lên 50 MB/giờ. Hãy cho biết ba nguyên nhân và dụng cụ để chọn giữa chúng.
4. Kiểm tra Spike từ 10 RPS đến 100 RPS. Thời gian phục hồi dự kiến là bao nhiêu nếu các sản phẩm vLLM Karpenter + vLLM được triển khai (Phase 17 · 03 + 18)?
5. GenAI-Perf báo cáo TPOT=6ms; LLMPerf báo cáo TPOT=11ms trên cùng một máy chủ.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| LLMPerf | "the LLM harness" | Anyscale benchmark tool, streaming-aware |
| GenAI-Perf | "NVIDIA tool" | NVIDIA reference harness |
| LLM-Locust | "Locust for LLMs" | Locust extension fixing GIL trap |
| guidellm | "synthetic benchmark" | Large-scale synthetic tool |
| k6 Operator | "K8s k6" | CRD-based distributed k6 |
| GIL trap | "Python client overhead" | Tokenization backlog inflates reported latency |
| Prompt-uniformity trap | "single-prompt lie" | Loop with same prompt hits cache, inflates throughput |
| Steady-state | "constant load" | Flat RPS for N minutes |
| Ramp | "linear up" | 0 to target over duration |
| Spike | "burst test" | Sudden multiplier then revert |
| Soak | "long test" | Hours for leak detection |

## Đọc thêm

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
