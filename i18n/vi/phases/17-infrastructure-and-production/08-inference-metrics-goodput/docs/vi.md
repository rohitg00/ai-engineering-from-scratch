# Các số liệu đầu tư  TTFT, TPOT, ITL, Goodput, P99

> Năm số liệu quyết định liệu việc triển khai suy luận có hiệu quả hay không. TTFT là prefill cộng với queue cộng với mạng. TPOT (thường được báo cáo là ITL, mặc dù các công cụ không đồng ý về việc ITL có tính toán token đầu tiên hay không) là chi phí giải mã gắn với bộ nhớ cho mỗi token. Thời gian trễ cuối đến cuối là TTFT cộng với TPOT lần chiều dài đầu ra. Tạo thông là các token mỗi giây được tổng hợp trên toàn bộ hạm đội. Nhưng điều quan trọng đối với sản phẩm là goodput  phần nhỏ của các yêu cầu đáp ứng tất cả SLO cùng một lúc. Tăng suất cao với goodput thấp có nghĩa là bạn đang xử lý token mà không bao giờ đạt đến người dùng đúng giờ. Số tham chiếu cho Llama-3.1-8B-Instruct trên TRT-LLM vào năm 2026: trung bình TTFT 162 ms, trung bình TPOT 7,33 ms, trung bình E2E 1,093 ms. Luôn báo cáo P50, P90, P99  không bao giờ chỉ là xấu. Và xem cái bẫy đo: GenAI-Perf loại trừ TTFT khỏi tính toán ITL, LLMPerf bao gồm nó; hai công cụ không đồng ý về TPOT cho cùng một chạy.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy percentile calculator and goodput reporter)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## Mục tiêu học tập

- Định nghĩa chính xác TTFT, TPOT, ITL, E2E, thông suất và goodput và đặt tên thành phần mỗi phép đo.
- Giải thích tại sao trung bình là số liệu thống kê sai lầm cho việc phục vụ LLM và cách đọc P50/P90/P99.
- Xây dựng một SLO đa hạn chế (ví dụ: TTFT <500 ms Và TPOT <15 ms Và E2E <2 s) và tính toán hiệu suất tốt với nó.
- Hãy nêu tên hai công cụ chuẩn mà không đồng ý về TPOT cho cùng một mục đích và giải thích lý do tại sao.

## Vấn đề

"Tổng thông qua của chúng tôi là 15.000 token mỗi giây". Vậy thì sao? Nếu 40% yêu cầu vượt quá 2 giây từ đầu đến cuối, người dùng đã bỏ cuộc. Chỉ riêng thông qua không cho bạn biết sản phẩm có hoạt động hay không.

Inference có nhiều trục độ trễ và mỗi trục thất bại khác nhau. Prefill là tính toán và cân bằng với độ dài nhanh chóng. Việc giải mã là kết nối với bộ nhớ và quy mô với kích thước lô. Lễ xếp hàng là một vấn đề hoạt động. Mạng lưới là vấn đề về khoảng cách vật lý. Bạn cần các số liệu riêng biệt cho mỗi người, và bạn cần percentiles, và bạn cần một đơn vị đơn hợp nhất nói "có người dùng nhận được những gì họ mong đợi" đó là tốt.

## Khái niệm

### TTFT  thời gian để token đầu tiên

`TTFT = queue_time + network_request + prefill_time`

Prefill chiếm ưu thế khi các yêu cầu dài. Trên Llama-3.3-70B FP8 trên H100, một yêu cầu 32k mất ~ 800 ms prefill tinh khiết. Thời gian xếp hàng là hành vi lập trình khi tải. yêu cầu mạng là thời gian dây bao gồm TLS. TTFT là thời gian trễ người dùng thấy trước khi bất cứ thứ gì phát lại.

### TPOT / ITL  độ trễ giữa các token

Nhiều tên cho một số lượng.`TPOT`(giờ mỗi token đầu ra), `ITL`(tạm thời giữa các mã thông báo),`decode latency per token` tất cả đều. Đó là thời gian giữa các token được phát liên tiếp sau đầu tiên.

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

Trên cùng một đống Llama-3.3-70B H100 với prefill chia nhỏ, TPOT trung bình là ~ 7 ms. Không prefill chia nhỏ, trong một prefill dài trên một chuỗi lân cận, TPOT có thể tăng lên 50 ms. Watch P99, không trung bình.

### E2E latency

`E2E = TTFT + TPOT * output_tokens + network_response`

Đối với các đầu ra dài (> 500 token), E2E là TPOT thống trị. Đối với các đầu ra ngắn với các lời nhắc dài, E2E là TTFT thống trị.

### Tải thông

`throughput = total_output_tokens / elapsed_time`

Chỉ số tổng hợp cho bạn hiệu quả của hạm đội, không cho bạn biết sức khỏe yêu cầu cá nhân.

### Goodput  số liệu bạn thực sự quan tâm đến

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

SLO là một hạn chế đa. Một yêu cầu chỉ "tốt" nếu mỗi hạn chế được giữ. Goodput là phần. Một số giấy tờ và bảng điều khiển báo cáo goodput như là tỷ lệ thay vì: yêu cầu mỗi giây đáp ứng mỗi SLO.

Năm 2026, goodput là số liệu được sử dụng trong các bài đăng MLPerf Inference v6.0 và theo dõi SLA nội bộ tại các nhà cung cấp nền tảng AI.

### Tại sao số liệu thống kê sai là xấu

Các phân phối độ trễ LLM là phải. Một loạt mã hóa với một hàng xóm dài có thể gửi 500 token với TPOT ~ 7 ms và 20 token với TPOT ~ 60 ms. TPOT trung bình là 9 ms. P99 TPOT là 65 ms. Người dùng thường xuyên nhấn P99 đó là lý do tại sao họ rời đi.

Luôn báo cáo ba (P50, P90, P99). Đối với trải nghiệm người dùng, P99 là một bạn tối ưu hóa.

### Số tham chiếu  Llama-3.1-8B-Instruct on TRT-LLM, 2026

- TTFT trung bình: 162 ms
- TPOT trung bình: 7,33 ms
- trung bình E2E: 1,093 ms
- P99 TPOT: dao động từ 10-25 ms tùy thuộc vào cấu hình mua phần.

Đây là các điểm tham chiếu NVIDIA được công bố. Chúng thay đổi theo kích thước mô hình (70B sẽ cho thấy 3-5x), phần cứng (H100 vs B200 ~ 3x), và tải.

### Trầm đo

Hai trong số các công cụ chuẩn 2026 được sử dụng nhiều nhất không đồng ý về TPOT cho cùng một chạy:

- **NVIDIA GenAI-Perf**: loại trừ TTFT từ tính toán ITL. ITL bắt đầu từ token 2.
- **LLMPerf**: bao gồm TTFT. ITL bắt đầu từ token 1.

Đối với yêu cầu với TTFT 500 ms và 100 mã thông báo đầu ra trong 700 ms mã hóa tổng thể, GenAI-Perf báo cáo `ITL = 700/99 = 7.07 ms`, LLMPerf báo cáo `ITL = 1200/100 = 12.00 ms`Sự lựa chọn công cụ thay đổi số.

Luôn cho biết công cụ nào. Luôn công bố định nghĩa.

### Xây dựng một SLO

Một SLO hợp lý đối với người tiêu dùng cho mô hình trò chuyện 70B vào năm 2026:

- TTFT P99 <= 800 ms.
- TPOT P99 <= 25 ms.
- E2E P99 <= 3 s cho <300 token output.
- Mục tiêu sản lượng tốt >= 99%.

Enterprise SLOs thắt chặt TTFT (200-400 ms) và thả E2E. Điểm là ghi lại chúng, đo cả ba và theo dõi hiệu suất tốt như một hợp chất duy nhất.

### Cách đo

- Tiếp tục giao thông thực tế hoặc thực tế tổng hợp (LLMPerf với `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`().
- Mục tiêu 2x đồng thời điểm cao nhất cho chạy benchmark.
- Lên 30-50 lần lặp lại, lấy phần trăm của mẫu kết hợp.
- Giới thiệu với tên công cụ, phiên bản công cụ, mô hình, phần cứng, đồng thời, phân phối nhanh chóng.

```figure
throughput-latency
```

## Sử dụng nó

`code/main.py`là một máy tính tính hiệu suất đồ chơi. tạo ra phân phối độ trễ tổng hợp, áp dụng SLO, và tính hiệu suất tốt.

- [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?users=1)máy cho thấy thời gian mỗi token đầu ra xuất phát từ đâu trên một NVIDIA L4. Một bước giải mã đọc 16,41 GB trọng lượng, mất ít nhất 54,7 ms ở 300 GB / s, và bước đo là 60,16 ms.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-slo-goodput-gate.md`Với khối lượng công việc và SLO, nó tạo ra một công thức chuẩn chuẩn CI/CD sẵn sàng mà các cổng triển khai trên goodput thay vì thông qua.

## Các bài tập

1. Đi chạy`code/main.py`Làm thế nào để goodput thay đổi khi bạn củng cố P99 TPOT từ 30 ms đến 15 ms?
2. Một nhà cung cấp trích dẫn "15,000 tok/s trên Llama 3.3 70B H100". Hãy nêu tên ba câu hỏi để hỏi trước khi tin tưởng nó.
3. Tại sao việc lấp trước bằng mảnh bảo vệ P99 TPOT nhưng không có nghĩa là TPOT?
4. Xây dựng một SLO tiêu dùng cho trợ lý giọng nói (tốc hiệu đầu tiên được nghe, không được đọc).
5. Đọc các tài liệu LLMPerf README và GenAI-Perf.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| TTFT | "time to first token" | Queue + network + prefill; dominated by prefill at long prompts |
| TPOT | "time per output token" | Memory-bound decode cost per token after first |
| ITL | "inter-token latency" | Same as TPOT in most tools (not all — see GenAI-Perf) |
| E2E | "end to end" | TTFT + TPOT * output_len; response-side network on top |
| Throughput | "tok/s" | Fleet efficiency; useless without latency percentiles |
| Goodput | "SLO-met rate" | Fraction of requests meeting every SLO constraint simultaneously |
| P99 | "tail" | 1-in-100 worst-case latency; the user experience metric |
| SLO multi-constraint | "the joint" | AND of all three latency bounds; a request fails if any one is violated |
| GenAI-Perf vs LLMPerf | "the tool trap" | Tools disagree on whether ITL includes TTFT |

## Đọc thêm

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) định nghĩa của TTFT, ITL, TPOT.
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) Các định nghĩa và công thức đo lường thay thế.
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) đo lường được áp dụng trên các triển khai thực tế.
- [LLMPerf](https://github.com/ray-project/llmperf) Định nghĩa chuẩn nguồn mở dựa trên Ray.
- [GenAI-Perf](https://github.com/triton-inference-server/perf_analyzer/blob/main/genai-perf/README.md) Công cụ chuẩn của NVIDIA.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) chỉ số chuẩn dựa trên giá trị tốt được công nghiệp chấp nhận.
