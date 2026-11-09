# Các đại lý đa phương tiện và sử dụng máy tính (Capstone)

> Sản phẩm 2026 frontier là một đại lý đa phương thức đọc ảnh chụp màn hình, nhấp vào nút, điều hướng UI web, điền biểu mẫu và hoàn thành dòng công việc từ đầu đến cuối. SeeClick và CogAgent (2024) chứng minh nguyên thủy của GUI-grounding. Ferret-UI thêm điện thoại di động. ChartAgent đã giới thiệu công cụ sử dụng hình ảnh cho các biểu đồ. VisualWebArena và AgentVista (2026) là điểm chuẩn của các cuộc truy đuổi biên giới  và thậm chí Gemini 3 Pro và Claude Opus 4.7 điểm ~ 30% trên các nhiệm vụ khó khăn của AgentVista. Bạch đá này kéo tất cả các chuỗi của giai đoạn 12: nhận thức (VLM độ phân giải cao), lý luận (LLM với việc sử dụng công cụ), đặt đất (tạo ra phối hợp), bộ nhớ đường chân trời dài và đánh giá.

**Type:** Capstone
**Languages:** Python (stdlib, action schema + agent loop skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 09 (Qwen-VL JSON), Phase 14 (Agent Engineering)
**Time:** ~240 minutes

## Mục tiêu học tập

- Thiết kế một vòng tròn tác nhân đa phương thức: nhận thức → lý do → hành động → quan sát → lặp lại.
- Xây dựng một sơ đồ đầu ra đầu ra GUI (thấp xích, gõ văn bản, cuộn, kéo) VLM có thể phát ra như JSON.
- So sánh các đại lý chỉ chụp màn hình vs đại lý cây truy cập vs đại lý lai.
- Thiết lập đánh giá điểm chuẩn của đại lý đa phương thức trên một đoạn nhỏ của VisualWebArena.

## Vấn đề

Một quy trình làm việc tại chỗ đặt chỗ: "đặt cho tôi một chuyến bay đến Tokyo vào ngày 15 tháng 4, chỗ ngồi dưới 800 đô la, đặt nó".

Một đại lý đa phương tiện cần:

1. Hãy chụp ảnh màn hình của trình duyệt.
2. Phân tích ảnh chụp màn hình + URL + mục tiêu thành một kế hoạch.
3. Tạo một hành động có cấu trúc: nhấp vào (ở x,y), gõ "Tokyo" (ở phần tử E), cuộn xuống, chọn (phím radio).
4. Đưa hành động vào trình duyệt.
5. Xem trạng thái mới (bức ảnh màn hình tiếp theo).
6. Lặp lại cho đến khi hoàn thành nhiệm vụ.

Mỗi bước là một cuộc gọi VLM đa phương thức. Khả năng xuất VLM phải là JSON có thể phân tích. Các lỗi liên tục trong các bước, vì vậy phục hồi quan trọng.

## Khái niệm

### GUI đất  nguyên thủy

GUI đặt đất là: được chụp màn hình và hướng dẫn ngôn ngữ tự nhiên, xuất x, y phối hợp để nhấp vào (hoặc hành động khác).

SeeClick (arXiv:2401.10935) là kết quả mở đầu tiên ở quy mô: điều chỉnh tinh tế một VLM trên dữ liệu GUI tổng hợp + thực, phối hợp đầu ra như các token văn bản đơn giản.

CogAgent (arXiv:2312.08914) đã thêm mã hóa độ phân giải cao 1120x1120 cho các UI dày đặc. Điểm số: ~84% trên định hướng web.

Ferret-UI (arXiv:2404.05719) tập trung vào UI di động, tích hợp với dữ liệu truy cập iOS.

Phương thức đầu ra thường là JSON:

```json
{"action": "click", "x": 384, "y": 220, "element_desc": "Search button"}
```

- `element_desc`giúp phục hồi: nếu các phối hợp di chuyển giữa các ảnh chụp màn hình, gợi ý ngữ nghĩa cho phép hệ thống tái đặt đất.

### Các chương trình hành động

Một kế hoạch hành động điển hình có 6-10 loại hành động:

- `click`(x, y)
- `type`: (text, x?, y?)
- `scroll`: (nghĩa, số lượng)
- `drag`(x0, y0, x1, y1)
- `select`: (option_index)
- `hover`(x, y)
- `navigate`: (url)
- `wait`(ms)
- `done`: (sự thành công, giải thích)

Các đại lý phát ra một hành động mỗi bước. Bỏ trình duyệt thực hiện và trả lại trạng thái mới.

### Chỉ chụp màn hình đối với cây truy cập

Hai chế độ đầu vào:

- Chỉ chụp màn hình: hình ảnh đầy đủ, không có thông tin cấu trúc.
- Cây truy cập: thông tin truy cập DOM / iOS có cấu trúc. đáng tin cậy hơn nhiều cho việc hạ cánh; hoạt động khi cây có sẵn.
- Hybrid: cả hai, với cây như là một nền đáng tin cậy cho các hành động nguyên tử và ảnh chụp màn hình cho ngữ cảnh.

Các đại lý sản xuất sử dụng hybrid khi có thể. Tự động hóa trình duyệt (Selenium + khả năng truy cập) luôn có cây; các ứng dụng máy tính để bàn đôi khi làm.

### Tưởng thức chân trời dài

Một dòng công việc 20 bước tạo ra 20 ảnh chụp màn hình.

- Summary-chain: sau mỗi 5 bước, tóm tắt những gì đã xảy ra, thả các ảnh chụp màn hình cũ.
- Skip-frame: giữ lần đầu tiên, cuối cùng, và mỗi lần chụp màn hình thứ 3.
- Lập nhật ký ghi lại công cụ: thực hiện các hành động, giữ nhật ký văn bản về những gì đã được thực hiện; không nhìn lại ảnh chụp màn hình cũ.

API sử dụng máy tính của Claude sử dụng mô hình nhật ký đơn giản hơn, đáng tin cậy hơn.

### Sử dụng công cụ trực quan

ChartAgent (arXiv:2510.04514) giới thiệu việc sử dụng công cụ trực quan để hiểu biểu đồ: crop, zoom, OCR, gọi phát hiện bên ngoài.

Mô hình này tổng quát: set-of-mark prompting, vùng ghi chú, và công cụ phát hiện bên ngoài tất cả phù hợp với cùng một "output một tool call, nhận một phản ứng có cấu trúc" sơ đồ.

### Các chỉ số chuẩn năm 2026

- ScreenSpot Pro. GUI đặt đất trên ~ 1k ảnh màn hình web. mở SOTA Qwen2.5-VL-72B ~85%.
- VisualWebArena. Các công việc web kết thúc đến kết thúc (thửa hàng, diễn đàn, quảng cáo). SOTA mở ~ 20%. Gemini 3 Pro ~ 27%.
- AgentVista (arXiv:2602.23166). Định điểm chuẩn khó nhất năm 2026.
- WebArena / WebShop. Định nghĩa tiêu chuẩn cũ hơn; bão hòa bởi biên giới.

### Tại sao nó vẫn khó khăn

Khân khói hiệu suất của chất:

1. "Click the small X" thường thất bại khi phân giải di động.
2. Sau 10 hành động, nhân viên sẽ rời khỏi mục tiêu.
3. Khôi phục lỗi: Khi một nhấp chuột không thành công (phím sai), phát hiện + phục hồi hiếm khi là dữ liệu được đào tạo.
4. Mối quan điểm qua các trang. Nhảy giữa các tab hoặc các biểu mẫu dài mất trạng thái.

Các hướng nghiên cứu: kiến trúc bộ nhớ, lập kế hoạch lại rõ ràng, xác minh đa phương thức (chụp màn hình phù hợp với thành công hành động).

### Ngọc đá xây dựng nó

Nhiệm vụ cuối: xây dựng một đại lý sử dụng máy tính mà:

1. Đọc ảnh chụp màn hình HTML + của trang giả trang trang đặt chỗ.
2. Kế hoạch một chuỗi nhiều bước: tìm kiếm → chọn → điền biểu mẫu → gửi.
3. Phát hành các hành động JSON phù hợp với sơ đồ hành động.
4. Đánh giá trên một mảnh cố định 10 nhiệm vụ.

Bài học cung cấp mã treo mà dễ dàng mở rộng vào một trình duyệt thực sự.

```figure
mm-agent-loop
```

## Sử dụng nó

`code/main.py`là sàn đá cột:

- Action schema JSON definition (10 hành động: 9 hành động được liệt kê ở trên cộng với `screenshot_region`, một công cụ thu hoạch + phóng to).
- Tờ trạng thái trình duyệt giả như lệnh.
- Cơ thể vòng tròn của đại lý: nhận trạng thái, phát hành hành động, áp dụng, vòng tròn.
- 10 nhiệm vụ mini-benchmark (đảng tổng hợp) để đo lường tỷ lệ thành công từ đầu đến cuối.
- Cây cắm lỗi để khi hành động thất bại.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-multimodal-agent-designer.md`. Với một sản phẩm sử dụng máy tính (khu vực, bộ hành động, mục tiêu đánh giá), thiết kế vòng tròn đầy đủ của đại lý, chiến lược bộ nhớ, chế độ đặt đất và điểm chuẩn dự kiến.

## Các bài tập

1. Chế hoạch của mã thêm một `screenshot_region`công cụ (crop + zoom) cho chín hành động cốt lõi.

2. Đọc AgentVista (arXiv:2602.23166). Mô tả danh mục nhiệm vụ khó khăn nhất và lý do tại sao các mô hình biên giới vẫn thất bại.

3. Nhiệm độ nén chân trời dài: thiết kế chuỗi tổng kết với ≤4 ảnh chụp màn hình được giữ trực tiếp, bất kỳ số nào được ghi lại.

4. Xây dựng một cái nát lỗi-chăm phục hồi: khi hành động thất bại (phím không tìm thấy), đại lý làm gì tiếp theo?

5. So sánh chỉ chụp màn hình Claude 4.7 với chụp màn hình hybrid + cây truy cập Qwen2.5 - VL trên 10 nhiệm vụ web.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GUI grounding | "Click coordinates" | Model outputs (x,y) for the target of an instruction on a screenshot |
| Action schema | "Tool definitions" | JSON description of valid actions (click, type, scroll, drag) |
| Accessibility tree | "Structured DOM" | Machine-readable UI hierarchy from browser/iOS APIs |
| Hybrid agent | "Screenshot + tree" | Uses both image and structured info; more reliable than either alone |
| Visual tool use | "Zoom/crop/detect" | Agent calls external vision tools (OCR, detection) mid-plan |
| Summary-chain | "Memory compression" | Periodic text summaries replace long screenshot history |
| VisualWebArena | "E2E web bench" | 2024 benchmark for end-to-end web tasks |
| AgentVista | "2026 hard bench" | 12-domain realistic workflows; even Gemini 3 Pro scores ~30% |

## Đọc thêm

- [Cheng et al. — SeeClick (arXiv:2401.10935)](https://arxiv.org/abs/2401.10935)
- [Hong et al. — CogAgent (arXiv:2312.08914)](https://arxiv.org/abs/2312.08914)
- [You et al. — Ferret-UI (arXiv:2404.05719)](https://arxiv.org/abs/2404.05719)
- [ChartAgent (arXiv:2510.04514)](https://arxiv.org/abs/2510.04514)
- [Koh et al. — VisualWebArena (arXiv:2401.13649)](https://arxiv.org/abs/2401.13649)
- [AgentVista (arXiv:2602.23166)](https://arxiv.org/abs/2602.23166)
