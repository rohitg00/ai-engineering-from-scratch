# Kỹ thuật hỗn loạn cho sản xuất LLM

> Kỹ thuật hỗn loạn cho LLM là ngành riêng của nó vào năm 2026. Các điều kiện tiên quyết trước khi chạy các thí nghiệm trong sản xuất: SLI/SLO xác định, khả năng quan sát trace+metric+log, rollback tự động, runbook, on call. Kiến trúc có bốn tầng: điều khiển (chế hoạch hóa thí nghiệm), mục tiêu (công vụ, hạ tầng, kho dữ liệu), an toàn (các vệ sĩ + hủy bỏ + bộ lọc giao thông), khả năng quan sát (thường đo + dấu vết + nhật ký), phản hồi (trong các điều chỉnh SLO). Các đường dây bảo vệ là bắt buộc: báo cáo tỷ lệ đốt tạm dừng các thí nghiệm nếu dự kiến đốt cháy ngân sách lỗi hàng ngày > 2 lần; cửa sổ nén + mối tương quan theo dõi-ID giảm tiếng ồn báo động. Thời gian: đánh giá hàng tuần về loài cá thể nhỏ + SLO; ngày chơi hàng tháng + sau khi chết; kiểm tra khả năng phục hồi giữa các nhóm hàng quý + bản đồ phụ thuộc. Các thí nghiệm cụ thể của LLM: quá tải bộ nhớ, lỗi mạng, gián đoạn nhà cung cấp, các lời nhắc sai, bão sơ tán cache KV. Công cụ: Harness Chaos Engineering (sự khuyến nghị bắt nguồn từ LLM, giảm độ phóng xạ, tích hợp công cụ MCP); LitmusChaos (CNCF); Chaos Mesh (CNCF Kubernetes bản địa).

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy chaos experiment runner)
**Prerequisites:** Phase 17 · 23 (SRE for AI), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Mục tiêu học tập

- Hãy nêu tên năm yêu cầu kỹ thuật hỗn loạn (SLI/SLO, khả năng quan sát, quay lại, sổ chạy, khi gọi) và giải thích tại sao bỏ qua bất kỳ thực hành nào phá vỡ thực hành.
- Chụp đồ thị bốn tầng (chống chế, mục tiêu, an toàn, khả năng quan sát) và vòng phản hồi thành SLO.
- Quảng cáo năm thí nghiệm cụ thể của LLM (thực lượng ghi nhớ quá tải, thất bại mạng, dịch vụ bị gián đoạn, thông báo sai lệch, cơn bão sơ tán KV).
- Chọn một công cụ  Lợi dây, LitmusChaos, Chaos Mesh  được đưa ra hàng.

## Vấn đề

Các thử nghiệm hỗn loạn trong các đống truyền thống được thiết lập. Các đống LLM thêm các chế độ thất bại mới. Một lệnh mã thông báo 4K với ký tự độc ngăn chặn token trong 12 giây. Một nhà cung cấp cấp trên dòng chảy 429s; cửa cổng của bạn thử lại; OOM dịch vụ của bạn trên đồng thời tăng cường thử lại. Một cơn bão sơ tán cache KV dưới tải nổ gây ra các thác tái lấp đầy mà bão hòa tính toán.

Không có một trong những điều này xuất hiện trong các thử nghiệm đơn vị.

## Khái niệm

### Các điều kiện tiên quyết

Đừng gây hỗn loạn trong sản xuất mà không có:

1. **SLI/SLO** xác định các chỉ số và mục tiêu cấp độ dịch vụ.
2. **Observability** dấu vết, số liệu, nhật ký, được nối với bảng điều khiển.
3. **Automated rollback** Giai đoạn 17 · 20 Phục hồi cờ chính sách.
4. **Runbooks** cấu trúc, giai đoạn 17 · 23.
5. **On-call** ai đó để trả lời.

Không có bất kỳ phương tiện nào, hỗn loạn trở thành sự cố thực sự.

### Bốn máy bay + phản hồi

**Control plane** lập trình thí nghiệm (Litmus workflow, lịch trình Chaos Mesh, Harness UI).

**Target plane** dịch vụ, pods, nút, cân bằng tải, lưu trữ dữ liệu.

**Safety plane** chuyển đổi tắt, cửa sổ nén, giới hạn bán kính nổ, cửa sổ ngân sách lỗi.

**Observability plane** các số liệu bình thường + mối tương quan theo dõi ID để phân biệt sự hỗn loạn gây ra từ các thất bại tự nhiên.

**Feedback loop** các phát hiện được đưa vào điều chỉnh SLO, cập nhật sổ chạy, sửa mã.

### Các đường dây bảo vệ là bắt buộc

- **Burn-rate alert**: thử nghiệm tạm dừng nếu số lượng lỗi ngân sách hư hỏng hàng ngày vượt quá 2 lần dự kiến.
- **Suppression windows**: làm im lặng các cảnh báo không thử nghiệm trong bán kính nổ trong khi thử nghiệm.
- **Trace-ID correlation**: tất cả các lỗi do thí nghiệm gây ra đều có thẻ để người gọi có thể rút ra.

### Năm thí nghiệm đặc biệt về LLM

1. **Memory overload** gây ra một cơn bão dự phòng KV bằng cách gửi yêu cầu trong bối cảnh dài với đồng thời cao.

2. **Network failure** cắt kết nối giữa cổng dẫn đầu và nhà cung cấp.

3. **Provider outage simulation** 100% 429 từ OpenAI. Quan sát: việc định tuyến không chuyển sang Anthropic? (Phase 17 · 16, 19)

4. **Malformed prompt** Inject token-stalling payload (ví dụ, Unicode sâu tổ, codepoint UTF-8 khổng lồ).

5. **KV eviction storm** buộc phải sơ tán bằng cách bão hòa ngân sách khối vLLM.

### Tỷ lệ

- **Weekly** thí nghiệm nhỏ của loài cá voi trong giai đoạn, có lẽ là 5%
- **Monthly** ngày chơi được lên kế hoạch trong một kịch bản cụ thể; sự tham dự của các đội; sau khi chết.
- **Quarterly** kiểm toán khả năng phục hồi giữa các nhóm; cập nhật bản đồ phụ thuộc.

### Thiết bị công cụ

- **Harness Chaos Engineering** thương mại; khuyến nghị thí nghiệm có nguồn gốc từ AI; giảm quy mô bán kính nổ; tích hợp công cụ MCP.
- **LitmusChaos** CNCF tốt nghiệp; Kubernetes dựa trên dòng công việc.
- **Chaos Mesh** hộp cát CNCF; phong cách CRD gốc Kubernetes.
- **Gremlin** thương mại; hỗ trợ rộng rãi.
- **AWS FIS**- **Azure Chaos Studio** cung cấp đám mây được quản lý.

### Bắt đầu nhỏ

thí nghiệm đầu tiên: giết một bản sao decode dưới lưu lượng truy cập ổn định. quan sát chuyển hướng và phục hồi. Nếu điều này hoạt động và trông an toàn, tốt nghiệp cho hỗn loạn mạng.

thí nghiệm đầu tiên của LLM: tiêm 429 cho một nhà cung cấp trong 5 phút. quan sát sự lùi. hầu hết các nhóm phát hiện ra sự lùi của họ không được kiểm tra đầy đủ.

### Những con số mà bạn nên nhớ

- Bốn máy bay: điều khiển, mục tiêu, an toàn, khả năng quan sát.
- Hỗng hỏng: 2 lần dự kiến ngân sách hỏng hàng ngày.
- Thời gian: hàng tuần canary, ngày chơi hàng tháng, kiểm toán hàng quý.
- Năm thí nghiệm LLM: bộ nhớ, mạng, nhà cung cấp, phản ứng sai, cơn bão KV.

```figure
i4-chaos-guard
```

## Sử dụng nó

`code/main.py`mô phỏng ba thí nghiệm hỗn loạn với cổng máy bay an toàn.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-chaos-plan.md`Với sự phát triển và sự trưởng thành, chọn ba thí nghiệm đầu tiên và công cụ.

## Các bài tập

1. Đi chạy`code/main.py`Thử nghiệm nào làm vỡ cửa đốt và tại sao?
2. Thiết kế năm thí nghiệm hỗn loạn đầu tiên cho một dịch vụ RAG dựa trên vLLM. Bao gồm các tiêu chí thành công.
3. Lần báo động của bạn đã dừng một thí nghiệm.
4. tranh luận liệu sự hỗn loạn có nên diễn ra trong sản xuất hay chỉ là sự dàn dựng. Khi nào sản xuất là câu trả lời đúng?
5. Hãy nêu tên ba chế độ thất bại cụ thể của LLM mà hỗn loạn mạng chung không thể tái tạo.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SLI / SLO | "service targets" | Indicator + objective; required prerequisite |
| Blast radius | "scope" | Set of services / users affected by experiment |
| Burn-rate alert | "budget gate" | Fires when error-budget burn rate > 2x expected |
| Game day | "monthly drill" | Scheduled cross-team chaos exercise |
| LitmusChaos | "CNCF workflow" | Graduated CNCF Kubernetes chaos tool |
| Chaos Mesh | "CNCF CRD" | CNCF sandbox Kubernetes-native chaos |
| Harness CE | "commercial AI-assisted" | Harness chaos with AI recommendations |
| Malformed prompt | "tokenizer bomb" | Input that stalls tokenization |
| KV eviction storm | "preemption cascade" | Mass eviction triggering re-prefills |

## Đọc thêm

- [DevSecOps School — Chaos Engineering 2026 Guide](https://devsecopsschool.com/blog/chaos-engineering/)
- [Ankush Sharma — Observability for Large Language Models (Apress, 2026)](https://link.springer.com/book/10.1007/979-8-8688-2827-0)
- [LitmusChaos (CNCF)](https://litmuschaos.io/)
- [Chaos Mesh (CNCF)](https://chaos-mesh.org/)
- [Harness Chaos Engineering](https://www.harness.io/products/chaos-engineering)
- [AWS FIS](https://aws.amazon.com/fis/)
