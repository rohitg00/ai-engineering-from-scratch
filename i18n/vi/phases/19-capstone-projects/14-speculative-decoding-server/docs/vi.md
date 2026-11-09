# Capstone 14  Speculative-Decoding Inference Server

> Việc giải mã giả định  một bản thảo rẻ tiền đề xuất mã thông báo, mô hình mục tiêu xác minh chúng trong một lần đi  bây giờ là một tối ưu hóa sẵn sàng để sản xuất, không phải là một thủ thuật nghiên cứu. Eagle-3 trong vLLM 0.7 tàu 2.5-3x thông qua trên lưu lượng thực. P-EAGLE (AWS 2026) đẩy đầu cơ song song đi xa hơn nữa. SpecForge của SGLang đã đào tạo các nhân viên tuyển dụng ở quy mô lớn. Trung tâm đầu cơ của Red Hat đã công bố các bản thảo phù hợp cho các mô hình mở chung. TensorRT-LLM đã làm cho việc giải mã đầu tiên trên NVIDIA. Bộ sản xuất phục vụ năm 2026 là vLLM hoặc SGLang với các bản thảo gia đình EAGLE, định lượng FP8 hoặc INT4, và HPA chờ đợi hàng. Bức đá cuối này sẽ phục vụ hai mô hình mở với thông qua đường cơ sở 2,5x + với báo cáo trễ đuôi đầy đủ.

**Type:** Capstone
**Languages:** Python (serving), TypeScript, C++ / CUDA (kernel inspection), YAML (configs)
**Prerequisites:** Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 17 (infrastructure)
**Phases exercised:**P3 · P7 · P10 · P17
**Time:** 30 hours

## Vấn đề

Việc giải mã giả định đã trở thành một hàng hóa vào năm 2026. EAGLE-3 đầu dự thảo đào tạo về các trạng thái ẩn của mô hình mục tiêu và dự đoán N token phía trước; mô hình mục tiêu xác minh trong một lần vượt qua. Tỷ lệ chấp nhận 60-80% chuyển sang 2-3x thông qua đầu đến cuối. vLLM 0.7 tích hợp điều này một cách tự nhiên. SGLang + SpecForge cung cấp cho bạn đường ống đào tạo. Red Hat's Speculators xuất bản các bản thảo phù hợp cho Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B.

Tàu đang trong hoạt động phục vụ, không phải là mô hình. Tỷ lệ chấp nhận biến động với phân phối lưu lượng truy cập (ShareGPT vs mã so với dữ liệu miền). Tiếng hễ đuôi dưới sự từ chối tồi tệ hơn so với không có suy đoán  bạn phải báo cáo p99 ở nhiều kích thước lô, không chỉ là token trạng thái ổn định / giây. Chi phí cho mỗi token 1M so với Anthropic / OpenAI API là đòn bẩy đáng tin cậy.

## Khái niệm

Việc giải mã giả định có hai lớp.**draft**mô hình (Eagle-3 đầu, ngram, hoặc mô hình nhỏ hơn đối với mục tiêu) đề xuất k ứng cử viên token mỗi bước.**target**mô hình xác minh tất cả k trong một lần đi; bất kỳ tiền tố nào được chấp nhận thay thế con đường tham lam. Tỷ lệ chấp nhận phụ thuộc vào sự sắp xếp dự thảo- mục tiêu và phân phối đầu vào.

Eagle-3 vượt qua ngram draft trên hầu hết lưu lượng truy cập. P-EAGLE chạy suy đoán song song song cho cây draft sâu hơn. trade-off: P99 độ trễ khi từ chối cao hơn vì quá trình xác minh lớn hơn. cấu hình phục vụ phải báo cáo độ trễ khối lượng lô để làm nổi bật điều này.

Việc triển khai là Kubernetes. vLLM 0.7 chạy một bản sao cho mỗi GPU hoặc phân mảnh song song tensor. HPA tự động đo trên xếp hàng chờ thay vì CPU. FP8 (Marlin) và INT4 (AWQ) quant giữ bộ nhớ GPU bên trong một phong bì H100 / H200. Báo cáo đầu đến cuối là thông qua, tỷ lệ chấp nhận, p50 / p99 tại lô 1/8/32, và mã thông báo $ / 1M.

## Kiến trúc

```
request ingress
    |
    v
vLLM server (0.7) or SGLang (0.4)
    |
    +-- draft: EAGLE-3 heads | P-EAGLE parallel | ngram fallback
    +-- target: Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     quantized FP8-Marlin or INT4-AWQ
    |
    v
verify pass: batch k draft tokens through target
    |
    v (accept prefix; resample for rejected suffix)
    v
token stream back to client
    |
    v
Prometheus metrics: throughput, acceptance rate, queue wait, latency p50/p99
    |
    v
HPA on queue-wait metric
```

## Thống

- Lưu trữ: vLLM 0,7 hoặc SGLang 0,4
- Các phương pháp đầu cơ: EAGLE-3 đầu dự thảo, P-EAGLE đầu cơ song song, ngram fallback
- Dự thảo đào tạo: SpecForge (SGLang) hoặc Red Hat Speculators
- Các mô hình mục tiêu: Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B
- Số lượng: FP8 (Marlin), INT4 AWQ
- Việc triển khai: Kubernetes + NVIDIA thiết bị plugin; HPA trên xếp hàng chờ métrics
- Eval: ShareGPT, MT-Bench-v2, GSM8K, HumanEval cho phép đo sự chấp nhận trên phạm vi
- Khán giả: TensorRT-LLM

```figure
cf-spec-decode
```

## Hãy xây dựng nó

1. **Target model prep.**Chọn Llama 3.3 70B. Quantize đến FP8 thông qua Marlin. triển khai dưới vLLM 0.7 trên 1xH100 (hoặc 2x tensor-phẳng song).

2. **Draft source.**Nhổ một đầu dự thảo EAGLE-3 được sắp xếp từ Red Hat Speculators (hoặc đào tạo một thông qua SpecForge).

3. **Baseline numbers.**Trước khi đầu cơ: token/s tại lô 1/8/32, độ trễ p50/p99, sử dụng GPU.

4. **Enable EAGLE-3.**Chuyển đổi cấu hình; chạy lại cùng một tiêu chuẩn báo cáo tăng tốc, tỷ lệ chấp nhận, p99 đuôi-trễ delta.

5. **P-EAGLE.**Khả năng suy đoán song song; đo cây dự thảo sâu hơn so với EAGLE-3 hàng loạt. Báo cáo sự xoay quanh nơi P-EAGLE giúp chống lại đau.

6. **Domain traffic.**Tiếp tục chạy ShareGPT vs HumanEval vs lưu lượng cụ thể miền thông qua cùng một máy chủ. đo tỷ lệ chấp nhận mỗi phân phối. Xác định khi bản thảo trôi dạt.

7. **Second target model.**Cứ chạy cùng một đường ống trên Qwen3-Coder-30B MoE. Dự thảo phức tạp hơn (MoE tiếng ồn định tuyến).

8. **K8s HPA.**Lập vào các K8 với HPA theo dõi `queue_wait_ms`- Cố gắng mở rộng khi tải tăng gấp ba lần.

9. **Cost comparison.**Lập toán $ 1M mã thông báo so với Claude Sonnet 4.7 và OpenAI GPT-5.4 trên cùng một đánh giá.

## Sử dụng nó

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## Chuyển nó

`outputs/skill-inference-server.md`mô tả sản phẩm được giao. Một hàng dùng được đo với việc giải mã phỏng đoán, một báo cáo chuẩn đầy đủ và một việc triển khai K8.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Measured speedup vs baseline | 2.5x+ throughput at matched quality on two models |
| 20 | Acceptance rate on realistic traffic | Per-distribution acceptance-rate report |
| 20 | P99 tail-latency discipline | p99 at batch 1/8/32 with and without speculation |
| 20 | Ops | K8s deploy, HPA on queue-wait, rollout smooth |
| 15 | Write-up and methodology | Clear explanation of what changed and why |
| **100** | | |

## Các bài tập

1. Đánh giá sự suy giảm tỷ lệ chấp nhận khi bản thảo là một phiên bản phía sau mục tiêu (ví dụ, Llama 3.3 -> 3.4 drift).

2. Thực hiện ngram-fallback: nếu chấp nhận EAGLE-3 giảm xuống dưới ngưỡng, chuyển sang ngram draft.

3. Thực hiện một thí nghiệm MoE được kiểm soát: cùng một Qwen3-Coder-30B với tiếng ồn đường dẫn tiêm vs. ngoài. đo độ nhạy cảm chấp nhận dự thảo.

4. Tăng lên H200 (141 GB). báo cáo về kích thước của mô hình trên mỗi bản sao được thu được và liệu bạn có thể phục vụ một Llama 3.3 70B không được định lượng.

5. Đánh giá TensorRT-LLM giải mã dự đoán trên cùng một phần cứng H100. báo cáo nơi nó thắng so với vLLM.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Draft model | "Speculator" | Small model that proposes N tokens for the target to verify |
| EAGLE-3 | "2026 draft architecture" | Draft head trained on target hidden states; ~75% acceptance |
| P-EAGLE | "Parallel speculation" | Tree of draft branches verified in one target pass |
| Acceptance rate | "Hit rate" | Fraction of drafted tokens accepted without resampling |
| Quantization | "FP8 / INT4" | Lower-precision weights to fit more model in GPU memory |
| Queue wait | "HPA metric" | Time a request waits in the pending queue before inference starts |
| Speculators hub | "Aligned drafts" | Red Hat Neural Magic hub of EAGLE drafts for common open models |

## Đọc thêm

- [vLLM EAGLE and P-EAGLE documentation](https://docs.vllm.ai) hàng phục vụ tham chiếu
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) giấy giải mã thoả thuận + tích hợp
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) Đường dẫn đào tạo đầu dự thảo
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) trung tâm dự thảo được sắp xếp
- [TensorRT-LLM speculative decoding](https://nvidia.github.io/TensorRT-LLM/) Nhà cung cấp thay thế
- [Fireworks.ai serving architecture](https://fireworks.ai/blog) Khán giả thương mại
- [EAGLE-3 paper (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) giấy phương pháp
- [vLLM repository](https://github.com/vllm-project/vllm) mã và chỉ số chuẩn
