# Ngân sách hành động, giới hạn lặp lại và quy định chi phí

> Chi phí LLM hàng tháng của một đại lý thương mại điện tử vừa lớn đã tăng từ $1,200 to $4.800 sau khi nhóm của mình kích hoạt kỹ năng "điểm theo dõi đơn đặt hàng". Đó không phải là lỗi giá cả. Đó là một đại lý đã tìm thấy một vòng lặp mới và giữ chi tiêu bên trong nó.`max_tokens`, mỗi công việc mã thông báo và ngân sách đô la, mỗi ngày / tháng giới hạn, giới hạn lặp lại, định tuyến mô hình cấp bậc, lưu trữ cache nhanh, cửa sổ bối cảnh, các điểm kiểm soát HITL cho các hành động đắt tiền, tắt các chuyển đổi khi vi phạm ngân sách. SDK Claude Code Agent của Anthropic gửi các nguyên thủy tương tự dưới các tên khác nhau. giới hạn tốc độ tài chính  ví dụ cắt truy cập lên > $ 50 trong 10 phút  bắt vòng lặp nhanh hơn các giới hạn hàng tháng.

**Type:** Learn
**Languages:** Python (stdlib, layered cost-governor simulator), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 12 (Durable execution)
**Time:** ~60 minutes

## Vấn đề

Các đại lý tự trị chi tiêu tiền thật sự ở mỗi lượt. Kết quả kém của chatbot là một câu trả lời xấu; vòng lặp xấu của một đại lý là một hóa đơn. Thuật ngữ được công nghiệp ghi nhận cho chế độ thất bại là "Tước từ ví"

Việc sửa chữa không phải là một số. Nó là một loạt các giới hạn ở các quy mô thời gian và độ phân mảnh khác nhau: theo yêu cầu, mỗi nhiệm vụ, mỗi giờ, mỗi ngày, mỗi tháng. Một loạt thiết kế tốt bắt được một vòng lặp chạy trong vòng vài phút, một rò rỉ chậm trong vòng vài giờ, và một giải phóng xấu trong vòng một ngày. cùng một loạt giữ một ngân sách ở tất cả khi đại lý là đường chân trời dài và tự trị.

Đây là một bài học kỹ thuật: toán học là tầm thường, kỷ luật là nơi mà các nhóm thất bại. Danh sách giới hạn dưới đây đều được đặt tên trong bộ công cụ quản lý đại lý Microsoft hoặc các tài liệu SDK của đại lý mã Anthropic Claude.

## Khái niệm

### Lưu trữ chi phí-chính quyền

1. **`max_tokens` per request.**Khả năng ngăn chặn bất kỳ cuộc gọi nào phát ra một kết thúc không giới hạn.
2. **Per-task token budget.**Trong suốt cuộc chạy, đừng vượt quá N token.
3. **Per-task dollar budget.**Tương tự như tiền mã hóa nhưng bằng tiền tệ.`max_budget_usd`trong Claude Code.
4. **Per-tool call cap.**Không quá N `WebFetch`gọi, N `shell_exec`gọi điện, vv
5. **Iteration cap (`max_turns`).**Tổng lặp vòng tròn đại lý; ngăn chặn vòng tròn lý luận vô hạn.
6. **Per-minute / per-hour / per-day / per-month cap.**Đường kính tròn, bắt được rò rỉ ở các quy mô thời gian khác nhau.
7. **Financial velocity limit.**Ví dụ, "nếu chi tiêu vượt quá 50 đô la trong 10 phút, cắt lối vào".
8. **Tiered model routing.**Theo mặc định cho một mô hình nhỏ hơn; leo thang lên một mô hình lớn hơn chỉ khi một nhà phân loại đánh giá nhiệm vụ cho phép nó.
9. **Prompt caching.**Hệ thống nhanh chóng và ổn định bối cảnh được lưu trữ trong bộ nhớ cache của nhà cung cấp; chi phí token của việc gửi lại gần bằng không.
10. **Context windowing.**Compaction / summation để giữ cho bối cảnh hoạt động dưới ngưỡng; giảm chi phí token trực tiếp.
11. **HITL checkpoints on expensive actions.**Trước khi một hành động được biết là đắt tiền (câu hỏi công cụ dài, tải xuống lớn, nâng cấp mô hình tốn kém), cần một chạm của con người.
12. **Kill switch on budget breach.**Trò chơi bị phá hủy khi bất kỳ ngọn lửa nào.

### Tại sao đống, không có một cái nón

Một mức giới hạn hàng tháng duy nhất chỉ bắt được một đại lý chạy trốn sau khi ví mất. Một mức giới hạn duy nhất mỗi yêu cầu không bắt được gì ở cấp độ phiên. Các chế độ thất bại khác nhau đòi hỏi các quy mô thời gian khác nhau:

- **Runaway loop**(truyền viên bị mắc kẹt trong một lần thử lại 5 giây): bị bắt bởi giới hạn tốc độ.
- **Slow leak**(trợ lý làm ~ 2 lần dự kiến công việc cho mỗi nhiệm vụ): bị bắt bởi giới hạn hàng ngày.
- **Bad release**(khả năng mới sử dụng token 5x): được bắt bởi giới hạn hàng tuần / hàng tháng.
- **Legitimate surge**(trực tế nhu cầu, không phải là lỗi): bị bắt bởi giới hạn giờ / ngày với hồ sơ rõ ràng.

### Một bề mặt ngân sách của vòng xoáy

Các SDK Claude Code Agent tiết lộ (tác liệu công khai):

- `max_turns` nắp lặp.
- `max_budget_usd` mức giới hạn đô la; phá thai phiên khi vi phạm.
- `allowed_tools`- `disallowed_tools` công cụ allowlist và denylist.
- Điểm nếp trước khi sử dụng công cụ để tính toán chi phí tùy chỉnh.

Kết hợp với thang chế độ cho phép (Dạy 10.`autoMode`phiên mà không có `max_budget_usd`Anthropic rõ ràng định nghĩa chế độ tự động như yêu cầu kiểm soát ngân sách; phân loại là orthogonal với chi phí.

### Đạo luật AI của EU, Cơ quan OWASP Top 10

Công cụ quản lý đại lý của Microsoft bao gồm các yêu cầu của Top 10 đại lý OWASP và Điều 14 của Đạo luật AI của EU (chống chế con người).

### Những gì đã được quan sát$1,200 → $4.800 trường hợp

Trường hợp thực sự trong tài liệu Microsoft: một đại lý thương mại điện tử mà chi phí hàng tháng tăng gấp bốn lần sau khi thêm một công cụ mới. Công cụ cho phép đại lý thăm dò tình trạng đơn hàng trong mỗi phiên. Không phát hiện vòng lặp. Không có nắp cho mỗi công cụ. Không có cảnh báo về tăng trưởng tuần qua tuần. Việc sửa chữa là một mức độ cao cho mỗi công cụ cộng với một cảnh báo tăng trưởng hàng ngày. Đây là một mẫu: mỗi bề mặt công cụ mới là một vòng lặp tiềm năng mới; mỗi công cụ mới cần một nắp và cảnh báo riêng của nó.

```figure
cost-governor-stack
```

## Sử dụng nó

`code/main.py`mô phỏng một đại lý chạy với và không có một đống quản lý chi phí lớp. Đại lý mô phỏng di chuyển vào vòng thăm dò sau một số lượt; đống đống lớp bắt nó trong cửa sổ tốc độ trong khi một nắp hàng tháng duy nhất sẽ không nổ ra cho đến vài ngày sau đó.

## Chuyển nó

`outputs/skill-agent-budget-audit.md`kiểm toán các khoản chi phí của một đại lý được đề xuất triển khai và đánh dấu các lớp thiếu sót.

## Các bài tập

1. Đi chạy`code/main.py`. xác nhận giới hạn tốc độ phát ra trước khi giới hạn lặp lại trên một quỹ đạo vòng thăm dò. Bây giờ vô hiệu hóa giới hạn tốc độ và đo lường bao nhiêu đại lý "gài" trước khi giới hạn lặp lại bắt nó.

2. Thiết kế một bộ nắp mỗi công cụ cho một đại lý trình duyệt (Dạy 11) Công cụ nào cần nắp chặt nhất? Công cụ nào có thể chạy không giới hạn mà không có rủi ro?

3. Đọc các tài liệu của Microsoft Agent Governance Toolkit. Đăng danh sách từng loại nắp tên của bộ công cụ. Định dạng mỗi một trong các chế độ thất bại (số chạy, rò rỉ chậm, phát hành xấu, tăng).

4. Giá một lần chạy không giám sát qua đêm cho một nhiệm vụ thực tế (ví dụ: "triangle 50 issues in a repo").`max_budget_usd`2x ước tính điểm của bạn.

5. Claude Code `max_budget_usd`thiết kế một giới hạn tốc độ bổ sung bạn sẽ áp dụng bên ngoài.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| Denial of Wallet | "Runaway bill" | Agent loop generating spend with no cap to stop it |
| max_tokens | "Per-request cap" | Ceiling on a single completion's size |
| max_turns | "Iteration cap" | Ceiling on agent loop iterations in a session |
| max_budget_usd | "Dollar kill switch" | Session cost cap; aborts on breach |
| Velocity limit | "Rate cap" | Limit on spend per short window (e.g., $50 / 10 min) |
| Tiered routing | "Small model first" | Cheap model default; escalate only when classifier warrants |
| Prompt caching | "Cached system prompt" | Provider-side cache reduces re-send token cost to near zero |
| HITL checkpoint | "Human approval gate" | Human tap required before expensive action |

## Đọc thêm

- [Anthropic Claude Code Agent SDK — agent loop and budgets](https://code.claude.com/docs/en/agent-sdk/agent-loop) `max_turns`- `max_budget_usd`, các công cụ cho phép.
- [Microsoft Agent Framework — human-in-the-loop and governance](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) Các trạm kiểm soát chi phí của chính phủ.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) kiểm soát chi phí bên cung cấp.
- [Anthropic — Prompt caching (Claude API docs)](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) Cơ khí lưu trữ cache.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Mô hình chi phí cho các đại lý đường dài.
