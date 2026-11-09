# Các phương thức thất bại: Tại sao các đại lý bị phá vỡ

> MASFT (Berkeley, 2025) liệt kê 14 chế độ thất bại đa đại lý trong 3 loại. Taxonomy của Microsoft ghi lại cách các lỗi AI hiện có tăng cường trong cài đặt đại lý. Dữ liệu lĩnh vực công nghiệp hội tụ về năm chế độ lặp lại: hành động ảo giác, trượt phạm vi, sai lầm hàng loạt, mất ngữ cảnh, lạm dụng công cụ.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 05 (Self-Refine and CRITIC), Phase 14 · 24 (Observability)
**Time:** ~60 minutes

## Mục tiêu học tập

- Đặt tên ba loại thất bại của MASFT và ít nhất bốn chế độ cụ thể trong mỗi.
- Giải thích tại sao sự thất bại của nhân viên làm tăng cường các chế độ thất bại AI hiện có (chính hướng, ảo giác).
- Mô tả năm chế độ lặp lại trong ngành và giảm thiểu chúng.
- Thực hiện một máy dò stdlib mà thẻ chất liệu theo dõi với các nhãn chế độ thất bại.

## Vấn đề

Các nhóm vận chuyển các đại lý làm việc trên 90% các dấu vết. 10% lỗi không phải là tiếng ồn ngẫu nhiên  chúng rơi vào một số nhỏ các loại lặp lại. Một khi bạn có thể đặt tên cho chúng, bạn có thể theo dõi chúng và sửa chữa chúng.

## Khái niệm

### MASFT (Berkeley, arXiv:2503.13657)

Các loại này có thể phân biệt đáng tin cậy.

Tầm quan trọng: các lỗi là những lỗi thiết kế cơ bản trong các hệ thống đa đại lý, chứ không phải là những hạn chế LLM để sửa chữa bằng các mô hình cơ bản tốt hơn.

### Microsoft Taxonomy của chế độ thất bại trong các hệ thống AI đại lý

- Những thất bại AI hiện có (chính hướng, ảo giác, rò rỉ dữ liệu) tăng cường trong các thiết lập cơ quan.
- Những thất bại mới xuất hiện từ tự trị: hành động không dự định trên quy mô, lạm dụng công cụ, trôi dạt nhiệm vụ.
- Báo trắng là sổ đăng ký rủi ro cho các sản phẩm đại lý.

### Characterizing Faults in Agentic AI (arXiv:2603.06847)

- Những thất bại phát sinh từ sự dàn xếp, sự tiến hóa của trạng thái nội bộ và sự tương tác của môi trường.
- Không chỉ là "định dạng xấu" hay "mô hình xấu xuất phát".

### LLM Agent Hallucinations Survey (arXiv:2509.18970)

Hai biểu hiện chính:

1. **Instruction-following Deviation** Đại lý không theo lệnh hệ thống.
2. **Long-range Contextual Misuse** đại lý quên hoặc áp dụng sai ngữ cảnh từ lượt trước.

Hầm lẫn dự định: Tránh (giải hành vi bị bỏ qua), Tháo phí (giải hành vi lặp lại), Tránh (giải hành hành vi không hợp lệ).

### Năm chế độ lặp lại trong ngành

Các phân tích trường Arize, Galileo, NimbleBrain 2024-2026 hội tụ về:

1. **Hallucinated actions.**Trưởng lý gọi một công cụ không tồn tại hoặc chế tạo ra những lập luận.
2. **Scope creep.**Trưởng lý mở rộng nhiệm vụ vượt ra ngoài yêu cầu của người dùng (tạo thêm PR, gửi thêm email).
3. **Cascading errors.**Một cuộc gọi sai tạo ra các hiệu ứng dòng chảy sau. Một ảo giác SKU ảo tạo ra bốn cuộc gọi API.
4. **Context loss.**Các nhiệm vụ dài hạn quên đi những hạn chế quay sớm.
5. **Tool misuse.**gọi công cụ đúng với các lập luận sai, hoặc công cụ sai hoàn toàn.

Các đại lý không thể phân biệt "Tôi thất bại" và "các nhiệm vụ là không thể" và thường ảo giác một thông điệp thành công trên 400 lỗi để đóng vòng lặp.

### Giảm thiểu: cổng ở mỗi bước

Các cổng xác minh tự động tại mọi bước của chuỗi lý luận, kiểm tra cơ sở thực tế đối với tình trạng môi trường.

- Định dạng an toàn từng bước (Học 21).
- Truy hiệu hóa lập luận gọi công cụ (Dạy 06).
- Kiểm tra nội dung được lấy lại với các sự kiện được biết (Dạy học 05, CRITIC).
- Khám phá ảo giác thành công bằng cách kiểm tra lại trạng thái (tệp thực sự được tạo ra không?).

### Khi việc giám sát thất bại đi sai

- **Tagging only crashes.**Hầu hết các lỗi của đại lý đều tạo ra hiệu quả.
- **No baseline.**Việc phát hiện sự biến động cần một điều tốt nhất; nếu không có nó bạn không thể nói "điều này đang trở nên tồi tệ hơn".
- **Over-alerting.**Mỗi thất bại tạo ra một trang, nhóm và giới hạn tốc độ.

```figure
failure-cascade
```

## Hãy xây dựng nó

`code/main.py`thực hiện một stdlib mode failure tagger:

- Một bộ dữ liệu theo dõi tổng hợp bao gồm năm chế độ.
- Các chức năng phát hiện theo chế độ (chương thức ký hiệu trên các cuộc gọi công cụ, đầu ra, các hành động lặp lại).
- Một thẻ đánh dấu từng dấu vết và báo cáo phân phối chế độ.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả: nhãn theo dõi + phân phối tổng thể, tái tạo giá rẻ của những gì bề mặt tập hợp dấu vết của Phoenix.

## Sử dụng nó

- **Phoenix**cho việc phân nhóm sản xuất (Lớp 24).
- **Langfuse**cho việc chơi lại phiên + ghi chú.
- **Custom**cho các chữ ký cụ thể về miền mà nền tảng quan sát của bạn không thể phát hiện.

## Chuyển nó

`outputs/skill-failure-detector.md`tạo ra các máy dò chế độ thất bại phù hợp với miền của bạn, được kết nối với một cửa hàng theo dõi.

## Các bài tập

1. Thêm một bộ phát hiện cho "hạt giác thành công": đại lý trả lại thành công nhưng trạng thái mục tiêu không thay đổi.
2. Đánh dấu 100 dấu vết thực sự từ một sản phẩm mà bạn đã xây dựng.
3. Thực hiện một số liệu "đường kính thủy triều": do sự thất bại ở bước N, nó ảnh hưởng đến bao nhiêu bước hạ lưu?
4. Hãy đọc 14 chế độ thất bại của MASFT, chọn 3 chế độ áp dụng cho sản phẩm của bạn, viết các máy dò.
5. Đưa một bộ dò vào một công việc CI: thất bại khi xây dựng nếu >=5% các dấu vết gắn thẻ một chế độ.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MASFT | "Multi-agent failure taxonomy" | Berkeley 14-mode categorization |
| Cascading error | "Ripple failure" | One early mistake propagates through N steps |
| Context loss | "Forgot the constraint" | Long-horizon turn drops early-turn facts |
| Tool misuse | "Wrong tool / wrong args" | Valid call, wrong invocation |
| Success hallucination | "Faked completion" | Agent claims success on a 400; state unchanged |
| Scope creep | "Overreach" | Agent does more than asked |
| Instruction-following deviation | "Disobedience" | Ignores system prompt or user constraint |
| Sub-intention errors | "Plan bugs" | Omission, redundancy, disorder in plan execution |

## Đọc thêm

- [Cemri et al., MASFT (arXiv:2503.13657)](https://arxiv.org/abs/2503.13657) 14 chế độ thất bại, 3 loại
- [Microsoft, Taxonomy of Failure Mode in Agentic AI Systems](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Taxonomy-of-Failure-Mode-in-Agentic-AI-Systems-Whitepaper.pdf) Đăng ký rủi ro
- [Arize Phoenix](https://docs.arize.com/phoenix) Nhóm phân phối lở trong thực tế
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) khi các mô hình đơn giản hơn tránh các chế độ hoàn toàn
