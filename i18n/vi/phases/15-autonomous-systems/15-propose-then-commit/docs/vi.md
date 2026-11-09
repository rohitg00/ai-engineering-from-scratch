# Người trong vòng lặp: đề nghị và sau đó cam kết

> Sự đồng thuận năm 2026 về HITL là cụ thể. Nó không phải là "nhà đại lý hỏi, người dùng nhấp vào phê duyệt". Nó là đề xuất-sau đó cam kết: hành động được đề xuất được duy trì đến một cửa hàng bền vững với một khóa idempotency; xuất hiện trước một nhà phê duyệt với ý định, dòng dữ liệu, quyền được chạm vào, bán kính bùng nổ và kế hoạch quay lại; chỉ thực hiện sau sự xác nhận tích cực; xác minh sau khi thực hiện để xác nhận tác dụng phụ thực sự xảy ra. LangGraph's `interrupt()`cộng với PostgreSQL checkpointing, Microsoft Agent Framework của `RequestInfoEvent`, và Cloudflare `waitForApproval()`tất cả thực hiện cùng một hình dạng. chế độ thất bại theo quy luật là phê duyệt bằng dấu cao su: "T phê duyệt?" được nhấp mà không cần xem xét.

**Type:** Learn
**Languages:** Python (stdlib, propose-then-commit state machine with idempotency), TypeScript
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 14 (Tripwires)
**Time:** ~60 minutes

## Vấn đề

Một đại lý thực hiện một hành động. Người dùng phải quyết định: chấp thuận hay không. Nếu quyết định là ngay lập tức, nó có lẽ không phải là một đánh giá. Nếu quyết định được cấu trúc, nó chậm nhưng đáng tin cậy. Câu hỏi kỹ thuật là làm thế nào để làm cho một đánh giá được cấu trúc là con đường có kháng cự tối thiểu.

Mô hình HITL thời kỳ 2023 là một lời nhắc đồng bộ: "Đại lý muốn gửi email đến X với cơ thể Y  chấp thuận?" Người dùng nhấp vào chấp thuận. Mọi người cảm thấy hệ thống an toàn. Trong thực tế, bề mặt này bị dán gốm nặng: người dùng chấp thuận nhanh, chấp thuận dự đoán ít, và khi đại lý sai, đường kiểm toán cho thấy một lịch sử lâu dài của sự chấp thuận người dùng không thể nhớ lại.

Mô hình 2026  đề xuất sau đó cam kết  di chuyển HITL vào một nền bền vững, gắn metadata có cấu trúc và yêu cầu cam kết tích cực.`interrupt()`, Microsoft Agent Framework `RequestInfoEvent`, Cloudflare `waitForApproval()`Tên API khác nhau; hình dạng không.

## Khái niệm

### Máy cơ nhà nước đề xuất sau đó cam kết

1. **Propose.**Agent tạo ra một hành động được đề xuất. tiếp tục đến một kho lưu trữ bền (PostgreSQL, Redis, Durable Object). Bao gồm:
   - ý định (tại sao đại lý làm điều này)
   - dòng dõi dữ liệu (nguồn dẫn đến đề xuất này)
   - quyền được chạm vào (những phạm vi / tập tin / điểm cuối)
   - Ánh sáng nổ (điều gì là trường hợp tồi tệ nhất)
   - kế hoạch quay trở lại (nếu đã thực hiện, chúng ta sẽ hủy bỏ nó như thế nào)
   - Key idempotency (một số đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn đơn
2. **Surface.**Người đánh giá thấy đề xuất với tất cả các siêu dữ liệu. Người đánh giá là một người (không phải là đại lý tự đánh giá).
3. **Commit.**Chứng nhận tích cực, hành động được thực hiện.
4. **Verify.**Sau khi thực hiện, tác dụng phụ được đọc lại và xác nhận. Nếu bước xác minh thất bại, hệ thống đang trong trạng thái xấu và báo động hoạt động.

### Chìa khóa tự do

Không có khóa idempotency, một lần thử lại sau khi thất bại tạm thời có thể thực hiện một hành động được chấp thuận hai lần. Ví dụ cụ thể: người dùng chấp thuận "việc chuyển $100 từ A sang B. " Các giao dịch mạng.

Đây là mô hình idempotency tương tự như Stripe và AWS API sử dụng. Việc sử dụng lại cho sự chấp thuận của đại lý được rõ ràng trong tài liệu Microsoft Agent Framework.

### Độ bền: tại sao các quy trình phê duyệt vượt quá thời gian

Phòng chờ phê duyệt là một phần của trạng thái mà đại lý không sở hữu.`interrupt()`với PostgreSQL kiểm tra điểm và không chỉ trong trạng thái trong bộ nhớ  một phê duyệt hai ngày sau vẫn tìm thấy dòng công việc nguyên vẹn.

### Việc phê duyệt dấu cao su và giảm thiểu thách thức và phản ứng

Các UI mặc định cho HITL ("Tính chấp" / "Từ chối" nút) tạo ra phê duyệt nhanh chóng mà không có đánh giá thực sự. Thuyên giảm tài liệu: một danh sách kiểm tra thách thức và phản ứng đòi hỏi câu trả lời tích cực cho các câu hỏi cụ thể trước khi nút phê duyệt được bật.

- "Bạn có hiểu nguồn tài nguyên nào mà điều này chạm vào không?"
- "Bạn đã xác minh được bán kính của vụ nổ là chấp nhận được không?"
- "Bạn có kế hoạch quay lại nếu điều này thất bại không?"

Không phải là một chế độ quan chức vì lợi ích của chính nó. Một chức năng buộc. Người xem không thể đánh dấu các hộp hoặc yêu cầu giải thích (sự leo thang) hoặc từ chối (sự mặc định an toàn). Nghiên cứu anthropic về an toàn đại lý rõ ràng trích dẫn HITL dựa trên danh sách kiểm tra như là một biện pháp giảm thiểu cho các mẫu phê duyệt bằng dấu cao su.

### Điều gì là quan trọng

Không phải mọi hành động đều cần đề xuất sau đó cam kết.

- **Consequential actions**(hằng ngày HITL): ghi chép không thể đảo ngược, giao dịch tài chính, giao tiếp ra ngoài, thay đổi cơ sở dữ liệu sản xuất, hoạt động hệ thống tập tin phá hủy.
- **Reversible actions**(đôi khi là HITL): chỉnh sửa các tệp địa phương, thay đổi trình độ, viết đảo ngược với sự quay lại rõ ràng.
- **Reads and inspections**(không bao giờ HITL): đọc một tập tin, liệt kê tài nguyên, gọi một API chỉ đọc.

### Kiểm tra sau hành động

"Commit run" không giống như "the side effect happened". Các điều kiện phân vùng mạng và chạy đua có thể tạo ra một workflow nghĩ rằng nó đã thành công trong khi backend không tồn tại. Bước xác minh đọc lại tài nguyên mục tiêu sau khi cam kết xác nhận. Đây là mô hình tương tự như các giao dịch cơ sở dữ liệu với `RETURNING`Điều khoản hoặc AWS `GetObject`sau đó`PutObject`- Tôi không biết.

### Đạo luật AI của EU Điều 14

Điều 14 yêu cầu giám sát nhân lực hiệu quả cho các hệ thống AI có nguy cơ cao trong EU. "Hiệu quả" không phải là trang trí. Ngôn ngữ quy định đặc biệt loại trừ các mô hình dấu cao su. đề xuất sau đó thực hiện với thách thức và phản ứng là hình dạng tồn tại trong kiểm tra Điều 14 trong tài liệu tuân thủ của Bộ Công cụ Quản trị Trưởng lý Microsoft.

```figure
mx-propose-then-commit
```

## Sử dụng nó

`code/main.py`Dryer thực hiện một máy tính propose-then-commit trong stdlib Python. Durable store là một tệp JSON. Idempotency key là một hash của (thread_id, action_signature). Driver mô phỏng ba trường hợp: một dòng phê duyệt sạch, một lần thử lại sau khi thất bại tạm thời (không được thực hiện hai lần), và một dấu cao su mặc định so với một dòng thách thức và phản ứng.

## Chuyển nó

`outputs/skill-hitl-design.md`xem xét một quy trình làm việc HITL được đề xuất cho hình dạng đề xuất sau đó cam kết và đánh dấu các lớp metadata, idempotency, xác minh hoặc thách thức và phản ứng thiếu.

## Các bài tập

1. Đi chạy`code/main.py`- xác nhận rằng một lần thử lại một đề xuất được phê duyệt sử dụng hồ sơ lâu dài và không thực hiện lại. Bây giờ thay đổi khóa idempotency để bao gồm một dấu thời gian và hiển thị các lần thử lại.

2. Cải dài hồ sơ đề xuất bằng một `rollback`Field. mô phỏng một hành động mà bước xác minh thất bại. hiển thị việc quay lại tự động.

3. Đọc Microsoft Agent Framework `RequestInfoEvent`Docs. xác định một trường siêu dữ liệu API bao gồm rằng động cơ đồ chơi bị thiếu.

4. Thiết kế danh sách kiểm tra thách thức và phản ứng cho một hành động cụ thể (ví dụ: "thông vào tài khoản Twitter công cộng").

5. Chọn một trường hợp mà một lời nhắc đồng thời "Thỏa thuận?" sẽ đủ (không cần phải lưu trữ lâu dài).

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| Propose-then-commit | "Two-phase approval" | Persisted proposal + positive commit + verify |
| Idempotency key | "Retry-safe token" | Unique per proposal; second execution no-ops |
| Data lineage | "Where it came from" | The specific source content that led to the proposal |
| Blast radius | "Worst case" | Scope of effect if the action goes wrong |
| Rubber-stamp | "Fast approval" | "Approve" clicked without genuine review |
| Challenge-and-response | "Forcing checklist" | Reviewer must positively acknowledge specific questions |
| RequestInfoEvent | "MS Agent Framework primitive" | Durable HITL request with structured metadata |
| `interrupt()` / `waitForApproval()` | "Framework primitives" | LangGraph / Cloudflare equivalents of the same shape |

## Đọc thêm

- [Microsoft Agent Framework — Human in the loop](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) `RequestInfoEvent`, chấp thuận lâu dài.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) `waitForApproval()`và các vật thể bền.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) HITL như một biện pháp giảm thiểu rủi ro về đường dài.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) Nguyên tắc cơ bản về các hệ thống có nguy cơ cao.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) quy định hiến pháp xung quanh giám sát.
