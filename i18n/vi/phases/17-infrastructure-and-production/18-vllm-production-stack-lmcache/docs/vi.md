# Sản xuất phục vụ Stack  KV Offloading và Cache-Aware Routing

> Một sản xuất phục vụ bộ định tuyến, động cơ và khả năng quan sát trong một triển khai Kubernetes và xử lý bộ nhớ cache KV như một nguồn tài nguyên có thể rời khỏi GPU. KV khi tải xuống lấy bộ nhớ cache KV ra khỏi bộ nhớ GPU và sử dụng lại trên các truy vấn và động cơ (CPU DRAM, sau đó đĩa / Ceph). Vàn sản xuất vLLM là sự triển khai tham chiếu; LMCache là lớp thả. VLLM 0.11.0 KV Offloading Connector (từ tháng 1 năm 2026) làm cho nó không đồng bộ và có thể cắm thông qua Connector API (v0.9.0+). Đường tải xuống thường được ẩn khỏi đường yêu cầu, mặc dù cache bị bỏ lỡ và các khuyến mãi có thể thêm độ trễ cuối đến cuối. LMCache có giá trị ngay cả khi không có tiền đề được chia sẻ khi GPU hết các khe KV, các yêu cầu trước có thể được khôi phục từ CPU thay vì tính lại prefill. Các điểm chuẩn được công bố trên 16x H100 (80GB HBM) trên 4 a3-highgpu-4g: khi cache KV vượt quá HBM, cả CPU gốc và LMCache cải thiện đáng kể thông qua; ở dấu chân KV thấp, tất cả các cấu hình phù hợp với đường cơ sở với chi phí trên nhỏ.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy KV-spill simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 06 (SGLang/RadixAttention)
**Time:** ~60 minutes

## Mục tiêu học tập

- Hình đồ các lớp vLLM sản xuất: bộ định tuyến, động cơ, KV offload, khả năng quan sát.
- Giải thích API KV Offloading Connector (v0.9.0+) và cách đường đi không đồng bộ 0.11.0 che giấu độ trễ của việc tải xuống.
- Quantify khi LMCache CPU-DRAM giúp (KV > HBM) vs thêm overhead (KV đủ nhỏ để phù hợp với HBM).
- Chọn giữa vLLM CPU gốc và kết nối LMCache cho hạn chế triển khai.

## Vấn đề

Dịch vụ vLLM của bạn cho thấy GPU ở 100% HBM với các sự kiện ưu tiên bất cứ khi nào đồng thời tăng lên. Các yêu cầu được trục xuất, xếp hàng, và bạn tái dự kiến yêu cầu 2K-token cùng một lần bốn lần trong một phút. tính toán GPU được chi tiêu cho việc dự trữ dư thừa; Goodput thấp hơn rất nhiều so với thông qua nguyên liệu.

Thêm nhiều GPU chi phí theo đường thẳng. Thêm nhiều HBM không thể. Nhưng CPU DRAM rẻ  một ổ cắm có 512 GB + ở các thứ tự độ trễ của quy mô tồi tệ hơn HBM nhưng tốt cho bộ nhớ cache KV "nói tạm thời".

LMCache trích xuất bộ nhớ cache KV vào CPU DRAM để các yêu cầu được dự đoán phục hồi nhanh chóng, và các bộ nhớ trước lặp đi lặp lại trên các động cơ chia sẻ bộ nhớ cache mà không cần mỗi động cơ tái lấp đầy.

## Khái niệm

### Vòng sản xuất vLLM

`github.com/vllm-project/production-stack`là việc triển khai Kubernetes tham chiếu:

- **Router** cache-aware (Phase 17 · 11).
- **Engines** nhân viên vLLM. Một người cho mỗi GPU hoặc cho mỗi nhóm TP/PP.
- **KV cache offload** LMCache triển khai hoặc kết nối bản địa.
- **Observability** Prometheus scrape, bảng điều khiển Grafana, dấu vết OTel.
- **Control plane** phát hiện dịch vụ, cấu hình, cập nhật.

Được chuyển như là người vận hành Helm chart +.

### KV Kloading Connector API (v0.9.0+)

vLLM 0.9.0 đã giới thiệu một Connector API cho các backend cache KV có thể cắm. Máy động của bạn tháo các khối vào kết nối; kết nối lưu trữ chúng (RAM, đĩa, lưu trữ đối tượng, LMCache).

vLLM 0.11.0 (từ tháng 1 năm 2026) thêm một đường thoát không đồng bộ  thoát tải có thể xảy ra trong nền để động cơ không bị chặn trên nó trong trường hợp thông thường. Sự trễ và thông qua cuối đến cuối vẫn phụ thuộc vào hình dạng tải trọng công việc, tỷ lệ hit cache KV và áp lực hệ thống; ghi chú của vLLM cho biết rằng việc tải xuống lõi tùy chỉnh có thể làm giảm thông qua ở tỷ lệ hit thấp và lập trình đồng bộ đã biết các vấn đề tương tác với giải mã phỏng đoán.

### Native CPU offload vs LMCache

**Native vLLM CPU offload**: động cơ-địa phương. lưu trữ các khối KV trong RAM chủ. nhanh để thực hiện, không tăng mạng. Không vượt qua động cơ.

**LMCache connector**Các khối được truy cập bởi bất kỳ động cơ nào. 16x H100 tham chiếu được công bố.

Chọn bản địa khi một động cơ duy nhất có áp suất HBM. Chọn LMCache khi nhiều động cơ chia sẻ tiền đề (RAG với các yêu cầu hệ thống chung, multi-tenant với các mẫu được chia sẻ).

### Hành vi đánh giá

H100 16x (80 GB HBM) trải rộng trên 4 thử nghiệm a3-highgpu-4g:

- KV thấp (các lời nhắc ngắn, đồng thời thấp): tất cả các cấu hình phù hợp với đường cơ sở, LMCache thêm ~ 3-5% chi phí chung.
- Hình ảnh vừa phải: LMCache bắt đầu giúp việc tái sử dụng tiền tố trên các động cơ.
- KV vượt quá HBM: CPU gốc và LMCache đều cải thiện thông suất đáng kể; LMCache tăng trưởng lớn hơn do chia sẻ đa động cơ.

### Khi LMCache là quyết định

- Dịch vụ nhiều người thuê nơi các thông báo hệ thống được chia sẻ giữa người thuê.
- RAG nơi các đoạn tài liệu lặp lại qua các truy vấn.
- Các biến thể được điều chỉnh tốt (LoRA) trên cùng một cơ sở khi sử dụng lại KV mô hình cơ bản cắt giảm công việc dư thừa.
- Nhiệm lượng công việc nặng trước: khôi phục từ CPU rẻ hơn so với tái đổ.

### Khi NOT để kích hoạt

- Giảm áp suất HBM nhỏ  bạn trả phí không có lợi ích.
- Các bối cảnh ngắn (< 1K token)  thời gian chuyển giao > tái lấp đầy.
- Lượng công việc đơn thuần của người thuê nhà  không sử dụng lại để chụp.

### Kết hợp với dịch vụ phân chia

Giai đoạn 17 · 17 phân chia dịch vụ + hợp chất LMCache: KV chuyển từ hồ chứa trước để giải mã đất hồ chứa trong LMCache nếu không được sử dụng; các truy vấn sau đó rút khỏi LMCache. Giai đoạn 17 · 11 bộ định tuyến nhận thức cache có thể định tuyến đến động cơ có tương ứng cache chia sẻ LMCache địa phương hoặc LMCache.

### Những con số mà bạn nên nhớ

- vLLM 0.9.0: Connector API được vận chuyển.
- vLLM 0.11.0 (Từ tháng 1 năm 2026): đường tải không đồng bộ; tác động độ trễ đầu đến cuối phụ thuộc vào tải công việc, tốc độ KV và áp suất hệ thống (không phải là một đảm bảo tuyệt đối).
- Định hướng 16x H100: LMCache giúp khi dấu chân KV vượt quá HBM.
- Áp suất HBM nhỏ: 3-5% chi phí trên không có lợi ích.

```figure
zero-sharding
```

## Sử dụng nó

`code/main.py`mô phỏng tải trọng công việc nặng trước khi có và không có LMCache. báo cáo việc lấp đầy lại được tránh, tăng thông suất và việc sử dụng HBM bằng nhau.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-vllm-stack-decider.md`. Với hình dạng tải trọng công việc và triển khai vLLM, quyết định bản địa vs LMCache vs không.

## Các bài tập

1. Đi chạy`code/main.py`LMCache bắt đầu trả tiền khi sử dụng HBM nào?
2. Một người thuê nhà chia sẻ hệ thống mã thông báo 6K trên 200 truy vấn / giờ.
3. LMCache máy chủ là một điểm thất bại duy nhất. Thiết kế chiến lược HA (những bản sao, trở lại bản gốc).
4. LMCache lưu trữ cho Ceph trên đĩa quay. cho một KV 4K-token ở 70B FP8 (500 MB), thời gian đọc là bao nhiêu so với tái lấp đầy?
5. Thảo luận liệu con đường vLLM 0.11.0 không đồng bộ là "tự do"  nơi mà đầu hàng ẩn?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Production-stack | "the reference deployment" | vLLM's Kubernetes Helm chart + operator |
| Connector API | "KV backend interface" | vLLM 0.9.0+ pluggable KV store interface |
| Native CPU offload | "engine-local spill" | Store KV in host RAM of same engine |
| LMCache | "cluster KV cache" | Cross-engine KV cache server on CPU DRAM + disk |
| 0.11.0 async | "non-blocking offload" | Offload hidden behind engine stream |
| Preemption | "evict to make room" | KV cache shuffle when HBM full |
| Prefix reuse | "same system prompt" | Multiple queries share beginning; cache hit |
| Ceph tier | "disk tier" | Durable storage below DRAM in the cache hierarchy |

## Đọc thêm

- [vLLM Blog — KV Offloading Connector (Jan 2026)](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [vLLM Production Stack GitHub](https://github.com/vllm-project/production-stack) Hình ảnh Helm + người vận hành.
- [LMCache for Enterprise-Scale LLM Inference (arXiv:2510.09665)](https://arxiv.org/html/2510.09665v2)
- [LMCache GitHub](https://github.com/LMCache/LMCache) Thực hiện các kết nối.
- [vLLM 0.11.0 release notes](https://github.com/vllm-project/vllm/releases) chi tiết đường đi không đồng bộ.
