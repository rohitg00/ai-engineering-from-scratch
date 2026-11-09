# Khung chuẩn bị OpenAI và Khung an toàn biên giới DeepMind

> OpenAI Preparedness Framework v2 (ngày 4 năm 2025) giới thiệu các danh mục nghiên cứu  Tự trị tầm xa, Sandbagging, Tái tạo tự trị và thích nghi, Giảm bảo  khác với các danh mục theo dõi. Các danh mục theo dõi kích hoạt các báo cáo về khả năng cộng với báo cáo bảo vệ được xem xét bởi Nhóm tư vấn an toàn. FSF v3 của DeepMind (Thiên tháng 9 năm 2025, với Cấp độ Khả năng theo dõi được thêm vào ngày 17 tháng 4 năm 2026) gấp tự trị thành lĩnh vực R&D và Cyber của ML (ML R&D tự trị cấp 1 = tự động hóa hoàn toàn đường ống R&D AI với chi phí cạnh tranh so với công cụ AI + con người). FSF v3 rõ ràng giải quyết sự sắp xếp sai lầm thông qua giám sát tự động cho việc sử dụng sai dụng lý luận bằng công cụ. Lưu ý trung thực: Các danh mục nghiên cứu trong PF v2 (bao gồm cả Tự trị tầm xa) không tự động kích hoạt giảm thiểu; ngôn ngữ chính sách là "có khả năng". Bản thân DeepMind nói rằng giám sát tự động "sẽ không đủ lâu dài" nếu suy luận công cụ được tăng cường.

**Type:** Learn
**Languages:** Python (stdlib, three-framework decision-table diff tool), TypeScript
**Prerequisites:** Phase 15 · 19 (Anthropic RSP)
**Time:** ~45 minutes

## Vấn đề

Bài học 19 đọc chính sách quy mô của Anthropic một cách gần gũi. Bài học này hoàn thành bức tranh bằng cách đọc OpenAI và DeepMind. Ba tài liệu là đồ tạo tác bằng người anh em cùng một câu hỏi  khi nào một phòng thí nghiệm biên giới nên tạm dừng hoặc cổng một mô hình  và chúng hội tụ trên một tập hợp nhỏ các loại và khác nhau ở những nơi cụ thể có ý nghĩa.

Sự hội tụ: cả ba nhãn tự trị tầm xa như một lớp khả năng đáng theo dõi. Cả ba đều thừa nhận hành vi lừa đảo (sử giả, vứt mẻ) là một loại rủi ro cụ thể. Cả ba đều có một cơ quan kiểm tra nội bộ. Sự khác biệt: OpenAI chia các loại thành "Điểm tra" (tạm dịch giảm thiểu bắt buộc) và "Khảo sát" (không có kích hoạt tự động). DeepMind gấp tự trị thành hai miền thay vì đặt tên riêng biệt. Các phòng thí nghiệm đặt tên là Tracked vs Research, hoặc Critical vs Moderate, hoặc Tier-1 vs Tier-2; hậu quả hoạt động của cái thùng mà một khả năng sống trong là khác nhau giữa các phòng thí nghiệm.

Đọc chúng cùng nhau là bài tập hữu ích. Khả năng tương tự có thể là "sự giảm thiểu bắt buộc" tại Anthropic, "đánh giá nhưng không kích hoạt" tại OpenAI, và "để theo dõi trong một lĩnh vực cụ thể" tại DeepMind.

## Khái niệm

### Khung chuẩn bị OpenAI v2 (ngày 4 tháng 4 năm 2025)

Cấu trúc:

- **Tracked Categories**: báo cáo khả năng (cái gì mô hình có thể làm) cộng với báo cáo bảo vệ (cái gì là giảm thiểu đang được thực hiện).
- **Research Categories**: các khả năng mô hình mà phòng thí nghiệm đang theo dõi nhưng chưa cam kết giảm thiểu cụ thể. Bao gồm tự trị tầm xa, Sandbagging, sao chép tự trị và thích nghi, Giảm bảo bảo vệ.

Các phân loại nghiên cứu không tự động kích hoạt giảm thiểu. Ngôn ngữ chính sách là giảm thiểu "có khả năng". Đây là delta cụ thể để xem: vị trí của một phân loại trong Tracked vs Research là vòng tròn giữa "cửa" và "được quan sát".

### DeepMind Frontier Safety Framework v3 (Tháng 9 năm 2025; Cấp năng lượng theo dõi được thêm vào ngày 17 tháng 4 năm 2026)

Cấu trúc:

- **Critical Capability Levels (CCLs)**: ngưỡng khả năng trong ba nhóm: lạm dụng (CBRN, Cyber, Manipulation Harmful), ML R&D, và một đường mòn không phù hợp khám phá.
- **Tracked Capability Levels**Ví dụ cụ thể: ML R&D tự trị cấp 1 = tự động hóa hoàn toàn đường ống dẫn R&D AI với chi phí cạnh tranh so với công cụ AI + con người.
- **Deceptive alignment monitoring**: cam kết rõ ràng về việc theo dõi tự động cho việc sử dụng sai dụng các phương tiện lý luận.

Các khung tự trị khác với OpenAI. DeepMind không giữ "Autonomy" như một tên miền cấp cao; nó được gấp vào các tên miền mà tự trị sẽ gây ra thiệt hại (ML R&D và Cyber).

### Những gì cả ba tụ tập

- Nhóm tư vấn an toàn nội bộ (nghĩa là Anthropic SAG, OpenAI SAG, DeepMind ủy ban nội bộ).
- Việc ghi rõ ràng về sự sắp xếp / sắp xếp giả mạo khiêu dâm như một lớp rủi ro.
- Các hiện vật cố định trên một thời gian được tuyên bố (Anthropic: Roadmap an toàn biên giới, Báo cáo rủi ro; OpenAI: Báo cáo về khả năng và bảo vệ; DeepMind: chu kỳ cập nhật FSF).
- Sự thừa nhận rằng các phòng thủ chỉ theo dõi có một giới hạn. DeepMind rõ ràng: "Việc giám sát tự động sẽ không đủ lâu dài".

### Ở đâu chúng khác nhau

- **Anthropic**: cam kết tạm dừng được loại bỏ trong v3.0; AI R&D-4 ngưỡng là cửa tiếp theo được đặt tên.
- **OpenAI**: Tracked vs Research chia; Các danh mục nghiên cứu (bao gồm Autonomy tầm xa) không tự động mở cửa.
- **DeepMind**: tự trị được gấp vào các lĩnh vực khác; Các mức độ khả năng theo dõi thêm tính chi tiết vào tháng 4 năm 2026.

### Sandbagging: một khả năng cụ thể phức tạp cả ba

Sandbagging (một mô hình có hiệu quả kém về chiến lược trong các đánh giá) nằm trong các danh mục nghiên cứu của OpenAI. RSP v3.0 của Anthropic giải quyết nó thông qua khoảng cách đánh giá-mô tả (Dạy học 1). DeepMind giải quyết nó thông qua giám sát sắp xếp lừa đảo trong FSF v3.

Nếu một mô hình không thực hiện các đánh giá, ngưỡng khả năng của mỗi khung được đánh giá thấp.

### Kỹ năng đọc chính sách

- Tìm: mọi khả năng bạn quan tâm nên được tìm thấy trong chính sách. Nếu không có, chính sách không bao gồm nó.
- Định dạng: nó được theo dõi (đẩy ra giảm thiểu) hay nghiên cứu (đẩy ra nhưng không kích hoạt)? OpenAI đặt tên cho điều này; Anthropic và DeepMind có tương đương riêng của họ.
- Tỷ lệ: chính sách được cập nhật theo một lịch trình được tuyên bố, hoặc chỉ sau các sự kiện cụ thể?
- Sự độc lập: xem xét bên ngoài là bắt buộc hay tùy chọn? Đối tác nhân bản với Apollo và Viện An toàn AI của Mỹ; OpenAI với METR; DeepMind với SAG nội bộ chủ yếu.

```figure
a5-tracked-vs-research
```

## Sử dụng nó

`code/main.py`thực hiện một công cụ khác biệt bảng quyết định nhỏ. Với một khả năng (tự trị, sắp xếp lừa đảo, tự động hóa R&D, nâng cao mạng, vv), nó đưa ra cách mỗi ba chính sách phân loại khả năng, và điều gì kích hoạt giảm thiểu. Đó là một công cụ đọc, không phải là một công cụ chính sách.

## Chuyển nó

`outputs/skill-cross-policy-diff.md`tạo ra một so sánh giữa các chính sách cho một khả năng cụ thể, sử dụng ba khung làm tham chiếu.

## Các bài tập

1. Đi chạy`code/main.py`. Đảm bảo sản xuất của công cụ khác nhau phù hợp với các chính sách cho ít nhất hai khả năng bạn có thể xác minh với tài liệu nguồn.

2. Đọc OpenAI Preparedness Framework v2 đầy đủ. Định danh từng hạng mục nghiên cứu. Đối với mỗi hạng mục, hãy viết một câu về lý do tại sao nó nằm trong Research thay vì Tracked.

3. Đọc đầy đủ DeepMind FSF v3, cộng với cập nhật Capacity Levels Tracked tháng 4 năm 2026 xác định các tiêu chí đánh giá cụ thể của ML R&D tự trị cấp 1. Làm thế nào bạn sẽ đo nó bên ngoài?

4. Sandbagging nằm trong các danh mục nghiên cứu của OpenAI. Thiết kế một đánh giá mà sẽ buộc một mô hình sandbagging để tiết lộ khả năng thực tế của nó. tham khảo bài học 1 đánh giá-những trò chơi ngữ cảnh.

5. So sánh ba chính sách về một khả năng cụ thể (tự chọn của bạn).Chỉ ra phân loại chính sách nào bạn thấy nghiêm ngặt nhất và ít nhất.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| Preparedness Framework | "OpenAI's scaling policy" | PF v2 (April 2025); Tracked vs Research categories |
| Tracked Category | "Mandatory mitigation" | Triggers Capabilities + Safeguards Reports; SAG review |
| Research Category | "Monitored only" | Tracked but no automatic mitigation; includes Long-range Autonomy |
| Frontier Safety Framework | "DeepMind's scaling policy" | FSF v3 (Sept 2025) + Tracked Capability Levels (Apr 2026) |
| CCL | "Critical Capability Level" | DeepMind threshold per domain (CBRN, Cyber, Harmful Manipulation, ML R&D) |
| ML R&D autonomy level 1 | "R&D automation" | Fully automate AI R&D pipeline at competitive cost |
| Sandbagging | "Strategic underperformance" | Model underperforms on evals; in OpenAI Research Categories |
| Instrumental reasoning | "Means-ends reasoning" | Reasoning about how to achieve goals; target of DeepMind monitoring |

## Đọc thêm

- [OpenAI — Updating our Preparedness Framework](https://openai.com/index/updating-our-preparedness-framework/) V2 thông báo.
- [OpenAI — Preparedness Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf) Tài liệu đầy đủ.
- [DeepMind — Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) Thông báo FSF v3.
- [DeepMind — Updating the Frontier Safety Framework (April 2026)](https://deepmind.google/blog/updating-the-frontier-safety-framework/) Tăng thêm các mức độ khả năng theo dõi.
- [Gemini 3 Pro FSF Report](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf) ví dụ về báo cáo rủi ro theo định dạng FSF.
