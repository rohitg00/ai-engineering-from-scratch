# Dịch vụ LLM đa khu vực và KV Cache Locality

> Sự cân bằng tải trọng vòng tròn là tích cực gây hại cho suy luận LLM được lưu trữ trong cache. Một yêu cầu không đáp xuống nút giữ tiền đề của nó trả phí hoàn toàn prefill  khoảng 800 ms tại P50 trên một prompt dài so với ~ 80 ms với một cache hit. Năm 2026, mô hình sản xuất là một router có ý thức cache (vLLM Router in Rust, llm-d router) tiêu thụ các sự kiện cache KV và các tuyến đường trên prefix-hash match. Nghiên cứu gần đây (GORGO) làm cho độ trễ mạng xuyên khu vực là một thuật ngữ rõ ràng trong mục tiêu định tuyến. Các dịch vụ "chỉ số thu thập giá xuyên khu vực" thương mại (chỉ số thu thập giá xuyên khu vực Bedrock, cửa ngõ đa cụm GKE) xử lý suy luận như không minh bạch  họ xử lý tính sẵn có, không phải TTFT. JPMorgan và Mayo Clinic đã tiến hành vụ thất bại của chúng ta ở phía đông-1 vào tháng 11 năm 2024 với khoảng 22 phút. Thực tế DR: 32% thất bại LLM DR là vì các nhóm sao lưu trọng lượng nhưng quên các tệp token hoặc cấu hình định lượng.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy prefix-cache-aware router simulator)
**Prerequisites:** Phase 17 · 04 (vLLM Serving), Phase 17 · 06 (SGLang RadixAttention)
**Time:** ~60 minutes

## Mục tiêu học tập

- Giải thích tại sao việc cân bằng tải trọng vòng tròn phá vỡ suy luận và định lượng hình phạt TTFT.
- Chụp đồ họa một router có ý thức về cache: đầu vào (kết quả cache KV), thuật toán (đáp ứng với prefix-hash), tie-breaker (tận dụng GPU).
- Hãy nêu tên trình điều khiển thất bại DR 32% cho LLMs (tài liệu tokenizer / cấu hình định lượng bị thiếu) và nêu danh sách kiểm tra DR ba tệp.
- Sự khác biệt giữa các dịch vụ thương mại xuyên khu vực (Bedrock CRI, GKE Multi-Cluster Gateway) và định tuyến KV-aware.

## Vấn đề

Dịch vụ của bạn chạy ở US-East-1, US-West-2 và EU-West-1. Bạn đặt một ALB trước với round-robin. tỷ lệ hit cache tiền đề trong sản xuất giảm xuống còn 8%. TTFT P50 gấp ba lần. nhật ký vLLM của bạn cho thấy mỗi yêu cầu trả đầy phí tiền mua.

Round-robin là tối ưu cho các dịch vụ không có quốc tịch. LLM suy luận là trạng thái theo thiết kế  bộ nhớ cache KV mã hóa mọi thứ mô hình đã thấy.

Một cách riêng biệt, nhóm của bạn có một kế hoạch DR. Bạn sao lưu trọng lượng mô hình cho khu vực S3. Một sự cố khu vực xảy ra; bạn cố gắng không hoạt động; bản sao từ chối khởi động. Bạn quên tokenizer.json, cấu hình định lượng, và cấu hình quy mô RoPE ở trong một thùng riêng mà bạn không đồng bộ hóa.

Việc phục vụ LLM đa khu vực là một vấn đề cache, một vấn đề định tuyến, và một vấn đề vệ sinh DR không phải là vấn đề cân bằng tải trọng.

## Khái niệm

### Đường dẫn có tính cache

Các yêu cầu đến với một lời nhắc. Router hashes tiền đề (chẳng hạn, đầu tiên 512 token); nó hỏi mỗi bản sao "bạn có tiền đề này được lưu trữ trong cache không?". Các bản sao xuất bản các sự kiện lưu trữ KV trên một kênh pub / sub khi họ phân bổ và loại bỏ các khối. Router chọn bản sao với sự phù hợp, rơi qua vào tie-breaker dựa trên GPU-util nếu không ai làm.

**vLLM Router**(Rust, 2026 sản xuất-phân): đăng ký `kv.cache.block_added`events, duy trì một prefix-hash → replica index, đường với $O(1)$Nhìn xuống, đi qua độ sâu thấp nhất khi không có sự phù hợp.

**llm-d router**: cùng một mô hình, Kubernetes bản địa. xuất bản các sự kiện thông qua ControlPlane API.

**SGLang RadixAttention**(Phase 17 · 06) là tương đương trong bản sao.

### Số

TTFT P50 trên một lệnh 2K-token, Llama 3.3 70B FP8, H100:
- Cache hit (những bản sao tương tự, prefix resident): ~ 80 ms.
- Cache miss (cụ trước lạnh): ~ 800 ms.

10x khoảng cách. Nếu router của bạn đạt 60-80% cache tiền tố trên các bản sao, bạn ước tính hiệu suất bản sao đơn tại N-thực lượng bản sao. Nếu nó đạt 10%, bạn ước tính quy mô ngây thơ.

### Cross-region có một hạn chế mới  độ trễ mạng

RTT liên khu vực:
- US-East-1  US-West-2: ~65 ms.
- US-East-1  eu-west-1: ~ 75 ms.
- US-East-1  ap-southeast-1: ~ 220 ms.

Nếu định tuyến đưa một yêu cầu từ us-east-1 đến một tiền tố nóng ở ap-southeast-1, prefill lưu (800 → 80 ms, do đó 720 ms) sẽ giảm xuống khoảng 500 ms khi RTT ~220 ms được thanh toán, và biên biến mất nếu khu vực xa xôi xếp hàng yêu cầu hoặc đã loại bỏ tiền tố. GORGO (2026 nghiên cứu) làm cho điều này rõ ràng  giảm thiểu `prefill_time + network_latency`Thông thường câu trả lời là tiếp tục định tuyến khu vực ngoại trừ trên các tiền tố đa MB lớn nơi prefill thống trị.

### "Phân luận xuyên khu vực" thương mại không giúp ở đây

AWS Bedrock cross-region inference tự động chuyển các yêu cầu sang các khu vực khác trong khi áp lực công suất. Nó tối ưu hóa tính sẵn có, không phải TTFT, và xử lý inference như không minh bạch. GKE Multi-Cluster Gateway là cùng một  service level failover, không có nhận thức về cache KV.

Bạn vẫn cần một bộ định tuyến có tính cache trong lớp ứng dụng ngay cả khi sử dụng chúng. Chúng xử lý trường hợp "US-East-1 đang cháy".

### DR vệ sinh  32% vấn đề file bị mất

Số liệu được trích dẫn rộng rãi năm 2026: 32% thất bại LLM DR xảy ra bởi vì các nhóm đã sao lưu trọng lượng nhưng quên:

- `tokenizer.json`hoặc `tokenizer.model`
- Các cấu hình định lượng (`quantize_config.json`, AWQ scale, GPTQ điểm không)
- Các cấu hình cụ thể cho mô hình (RoPE quy mô, mặt nạ chú ý, mẫu trò chuyện)
- Thiết lập động cơ (`vllm_config.yaml`, các mẫu mặc định, biểu hiện bộ chuyển đổi LoRA)

Việc sửa là một văn bản DR tối thiểu ba tập tin:

1. Tất cả các tệp dưới dạng repo mô hình HF (nặng + cấu hình + tokeniser).
2. Định hướng dịch vụ cụ thể cho động cơ.
3. Bản biểu triển khai (K8s YAML, Dockerfile, khóa phụ thuộc).

Thêm vào đó, chạy một cuộc tập luyện DR hàng quý.

### Data Residency là orthogonal

PHI khách hàng EU không thể rời EU. Nếu router có ý thức về cache của bạn gửi yêu cầu gốc Paris đến us-east-1 cho một sự phù hợp tiền tố, bạn đã vi phạm GDPR bất kể lợi ích của TTFT. Chia các router theo ranh giới cư trú trước khi tối ưu hóa cho cache.

### Những con số mà bạn nên nhớ

- Hỗ trợ cache vs miss TTFT khoảng cách: ~ 10x (80 ms vs 800 ms trên 2K prompt).
- RTT liên khu vực Mỹ-EU: ~ 75 ms.
- DR thất bại: 32% bỏ qua các cấu hình tokenizer/quant.
- JPMorgan us-east-1 failover tháng 11 năm 2024: 22 phút (30 phút SLA).

```figure
cache-aware-router
```

## Sử dụng nó

`code/main.py`mô phỏng ba chiến lược định tuyến (round-robin, cache-aware khu vực, cache-aware toàn cầu) trên khối lượng công việc đa khu vực.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-multi-region-router.md`Với các khu vực, hạn chế cư trú và SLA, thiết kế kế kế hướng đi.

## Các bài tập

1. Đi chạy`code/main.py`- Dường độ nhanh nào của đường dẫn xuyên khu vực vượt qua đường dẫn chỉ ở địa phương, với 75 ms RTT?
2. Tỷ lệ truy cập cache của bạn giảm từ 70% xuống còn 12%. Chẩn đoán ba nguyên nhân có thể và các nguyên nhân quan sát có thể xác nhận mỗi nguyên nhân.
3. Thiết kế một biểu đồ DR cho mô hình 70B AWQ-quantized phục vụ trong vLLM với 5 bộ chuyển đổi LoRA.
4. Phù luận liệu suy luận qua khu vực Bedrock là "càng đủ" cho một fintech với các TTFT SLOs nghiêm ngặt.
5. Một yêu cầu có nguồn gốc từ Paris phù hợp với một dấu tiền ở phía đông Mỹ-1.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Cache-aware routing | "smart LB" | Route on prefix-hash match to KV-cache-holding replica |
| KV-cache events | "cache pub-sub" | Replicas publish block add/evict; router indexes |
| Prefix hash | "cache key" | Hash of first N tokens used as router lookup |
| GORGO | "cross-region routing research" | arXiv 2602.11688; network latency as explicit term |
| Cross-region inference | "Bedrock CRI" | AWS product; availability failover, not TTFT awareness |
| DR manifest | "the backup list" | Every file needed to restore — not just weights |
| Data residency | "GDPR boundary" | Legal constraint on which region sees user data |
| RTT | "round-trip time" | Network latency; 75 ms US-EU, 220 ms US-APAC |
| LLM-aware LB | "cache-hit LB" | Cache-aware router as a product category |

## Đọc thêm

- [BentoML — Multi-cloud and cross-region inference](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference)
- [arXiv — GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1) tái sử dụng cache KV xuyên khu vực với thời hạn trễ mạng.
- [TianPan — Multi-Region LLM Serving Cache Locality](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing)
- [AWS Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html) Tài liệu về sự sẵn có của sự cố chuyển.
- [vLLM Production Stack Router](https://github.com/vllm-project/production-stack) nguồn router có tính cache.
