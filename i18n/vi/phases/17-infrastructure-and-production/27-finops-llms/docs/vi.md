# FinOps cho LLM  Kinh tế đơn vị và phân bổ nhiều người thuê

> FinOps truyền thống phá vỡ chi tiêu LLM. Chi phí là giao dịch mã thông báo, không phải thời gian sử dụng nguồn lực. Tags không lập bản đồ  một cuộc gọi API là một giao dịch, không phải là tài sản. Các quyết định kỹ thuật (phác thảo nhanh, cửa sổ ngữ cảnh, chiều dài đầu ra) là quyết định tài chính.`user_id`) cho giá ghế và mở rộng, mỗi nhiệm vụ (`task_id`+ `route`) cho chi phí bề mặt sản phẩm và ưu tiên, cho người thuê (`tenant_id`) về kinh tế đơn vị và tái tạo. Bốn lớp token  prompt, công cụ, bộ nhớ, phản ứng  một cái thùng ẩn chi tiêu. Đường thang thực thi cho các sản phẩm đa thuê nhân: giới hạn tỷ lệ cho mỗi thuê nhân (2-3x mức cao nhất dự kiến, vượt qua 429 + thử lại sau); giới hạn chi tiêu hàng ngày (1.5-3x mức trần hợp đồng; kích hoạt tăng tốc + cảnh báo); tắt các chuyển đổi khi chi tiêu điểm z > 4 (tự động tạm dừng + trang khi gọi). Các mô hình phân loại: Tag-and-aggregate, telemetry-joiner (trace-ID → thanh toán; độ chính xác cao nhất), lấy mẫu và kéo dài, phân bổ dựa trên mô hình, nguồn gốc sự kiện, phát trực tuyến thời gian thực. Đoạn số: chi phí cho mỗi truy vấn được giải quyết, chi phí cho mỗi vật tạo ra không phải mã thông báo $/M. Việc gắn thẻ ngược luôn bị bỏ qua; công cụ tạo theo yêu cầu.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cost-attribution simulator with kill switch)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 14 (Caching)
**Time:** ~60 minutes

## Mục tiêu học tập

- Giải thích lý do tại sao FinOps truyền thống (tags + tiers) phá vỡ chi tiêu LLM và nêu tên ba chiều kích thuộc về mới.
- Đặt ra danh sách bốn lớp token (quá trình, công cụ, bộ nhớ, phản ứng) và lý do tại sao việc thanh toán một thùng chứa chứa chi phí.
- Thiết kế một thang thực thi (số phí → giới hạn chi tiêu → chuyển đổi giết người) cho một sản phẩm đa thuê nhà.
- Chọn một số liệu đơn vị (chi phí cho mỗi truy vấn / đồ tạo được giải quyết) thay vì mã thông báo $ / M.

## Vấn đề

Tài khoản của anh viết 40.000 đô la.
- Người thuê nhà nào đã chi tiền đó.
- Tính năng sản phẩm nào đã thúc đẩy nó.
- Nếu một người dùng cá nhân đã lạm dụng.
- Dù là bùng phát nhanh, gọi công cụ, hay tăng cường bộ nhớ là thủ phạm.

Tag-and-aggregate trên bên nhà cung cấp hoạt động cho các nguồn tài nguyên đám mây (EC2, S3) nơi thẻ lan rộng đến các mục dòng. LLM API gọi không tự động thẻ  bạn phải dán dấu người dùng / nhiệm vụ / thuê nhà tại trang web cuộc gọi và thực hiện. Thanh niên ứng ngược luôn bỏ lỡ các trường hợp cạnh.

## Khái niệm

### Ba chiều kích thuộc tính

**Per-user**(`user_id`): ai đang chi phí gì.

**Per-task**(`task_id`+ `route`): bề mặt sản phẩm nào chi phí bao nhiêu.

**Per-tenant**(`tenant_id`): khách hàng nào là lợi nhuận.

Trình chơi cả ba ở vị trí gọi vào ngày đầu tiên.

### Bốn lớp biểu tượng

| Layer | Example | Typical % of total |
|-------|---------|---------------------|
| Prompt | system + user input | 40-60% |
| Tool | tool-call results fed back | 20-40% (agent workloads) |
| Memory | prior conversation / retrieved docs | 10-30% |
| Response | model output | 10-30% |

Việc kết hợp tất cả bốn thứ này làm cho tối ưu hóa bị mù.

### Đường thang thực thi

1. **Rate limit**mỗi người thuê nhà. 2-3 lần mức cao nhất dự kiến.`Retry-After`Người thuê nhà thấy sự chi phối, không có tiền bất ngờ.

2. **Daily spend cap**- Thích: giới hạn tốc độ củng cố + cảnh báo thành công của khách hàng.

3. **Kill switch**trên điểm chi tiêu z > 4 so với đường cơ sở của người thuê nhà. tự động tạm dừng người thuê nhà; trang trên cuộc gọi; leo thang đến các hoạt động + CS.

### Các mô hình phân bổ

- **Tag-and-aggregate**: tiêu đề metadata dấu; tổng hợp sau đó. đơn giản; thô.
- **Telemetry joiner**: kết nối dấu vết với thanh toán thông qua thẻ tín hiệu dấu vết độ chính xác cao nhất.
- **Sampling + extrapolation**: mẫu 5-10%, nhân. chi phí hiệu quả cho chi tiêu thô; bỏ qua đuôi.
- **Model-based allocation**: regression để suy luận driver chi phí. cho dữ liệu cũ mà không có thẻ.
- **Event-sourced**: chi phí như các sự kiện trong một dòng chảy (Kafka / Kinesis).
- **Real-time streaming**: bản cập nhật bảng điều khiển dưới giây.

### Chi phí cho mỗi X là đơn vị métric

$/M token là nhà cung cấp nói.

- Chi phí cho mỗi vé hỗ trợ được giải quyết.
- Chi phí cho mỗi sản phẩm được tạo ra.
- Chi phí cho mỗi nhiệm vụ của một đại lý thành công.
- Chi phí mỗi người dùng-phần-tháng phút.

Kết hợp chi phí với kết quả sản phẩm, nếu không tối ưu hóa không được hợp nhất.

### Hình dạng dấu vết của quy định chi phí

```
trace_id: abc123
  user_id: u_42
  tenant_id: t_7
  task_id: task_classify_doc
  route: model_haiku
  layers:
    prompt_tokens: 1800
    tool_tokens: 600
    memory_tokens: 400
    response_tokens: 150
  cost_usd: 0.0135
  cached_input: true
  batch: false
```

Tạo ra mỗi cuộc gọi. Cung cấp dữ liệu trong hồ dữ liệu. tổng hợp theo kích thước.

### Thống tiền tiết kiệm hợp chất

Stack: cache + batch + route + gateway.
- Cache L2 (Phase 17 · 14): ~ 10 lần đầu vào rẻ hơn.
- Nhóm (Phase 17 · 15): giảm 50%
- Đường đến mô hình rẻ (Phase 17 · 16): giảm chi phí 60%.
- Hiệu quả Gateway (Phase 17 · 19): redundancy + retries.

Các trường hợp tốt nhất được xếp chồng lên: ~ 5-10% so với đường cơ bản ngây thơ. Hầu hết các đội có 2-3 đòn bẩy tham gia; ít xếp chồng lên cả bốn.

### Những con số mà bạn nên nhớ

- Các kích thước phân bổ: cho mỗi người dùng, cho mỗi nhiệm vụ, cho mỗi người thuê nhà.
- Bốn lớp biểu tượng: prompt, tool, memory, response.
- Động cơ tắt: sử dụng điểm z > 4.
- Đơn vị đo: chi phí cho mỗi truy vấn được giải quyết, không phải mã thông báo $/M.
- Các tối ưu hóa xếp chồng lên: ~ 5-10% của đường cơ sở có thể.

```figure
i4-spend-ladder
```

## Sử dụng nó

`code/main.py`mô phỏng một dịch vụ LLM đa thuê nhân với thang thực thi ba cấp. Nhổ vào một thuê nhân lạm dụng và chứng minh việc bắn tắt chuyển đổi.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-finops-plan.md`Với sản phẩm và quy mô, thiết kế các quy trình quy định và thang thực thi.

## Các bài tập

1. Đi chạy`code/main.py`- Đường độ x của cái chuyển đổi bắn ở mức nào?
2. Thiết kế bảng điều khiển chi phí cho mỗi người thuê, mỗi nhiệm vụ.
3. Người thuê nhà lớn nhất của bạn là đơn vị kinh tế tiêu cực.
4. Xét chi phí cho mỗi vé được giải quyết cho một sản phẩm hỗ trợ: 3M token/ticket, ~ 800 vé/ngày, tất cả các đầu vào với tỷ lệ ghi nhớ GPT-5 là $0,125/M (giá danh sách khởi động; kiểm tra thẻ tỷ lệ sống).
5. Hãy tranh luận liệu việc gắn thẻ ngược lại có thể hoạt động được không.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Per-user attribution | "user-level cost" | `user_id` stamped on every call |
| Per-task attribution | "feature cost" | `task_id` + `route` identify product surface |
| Per-tenant attribution | "customer cost" | `tenant_id`; drives unit economics |
| Four token layers | "cost layers" | prompt + tool + memory + response |
| Rate limit | "429 guard" | Per-tenant ceiling enforced at gateway |
| Daily spend cap | "daily ceiling" | Tenant-scoped budget with alert |
| Kill switch | "auto-pause" | Spend z-score > 4 triggers auto-suspension |
| Cost per resolved | "product unit metric" | Cost tied to product outcome, not tokens |
| Telemetry joiner | "trace-to-billing" | Highest-accuracy attribution pattern |
| Stacked optimization | "cache+batch+route+gateway" | Compounding savings to ~5-10% baseline |

## Đọc thêm

- [FinOps Foundation — FinOps for AI Overview](https://www.finops.org/wg/finops-for-ai-overview/)
- [FinOps School — Cost per Unit 2026 Guide](https://finopsschool.com/blog/cost-per-unit/)
- [Digital Applied — LLM Agent Cost Attribution 2026](https://www.digitalapplied.com/blog/llm-agent-cost-attribution-guide-production-2026)
- [PointFive — Managed LLMs in Azure OpenAI](https://www.pointfive.co/blog/finops-for-ai-economics-of-managed-llms-in-azure-open-ai)
