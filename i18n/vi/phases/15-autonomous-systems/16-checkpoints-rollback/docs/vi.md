# Các điểm kiểm soát và Rollback

> Mỗi chuyển đổi trạng thái biểu đồ vẫn tồn tại. Khi một công nhân bị tai nạn, hợp đồng thuê của nó hết hạn và một công nhân khác nhận lại tại điểm kiểm soát mới nhất. Cloudflare Durable Objects giữ trạng thái trong nhiều giờ hoặc tuần. Đề xuất sau đó cam kết (Lớp 15) xác định một kế hoạch quay lại mỗi hành động. Việc xác minh sau hành động sẽ đóng lại vòng lặp. Điều 14 của EU AI Act buộc phải giám sát con người hiệu quả cho các hệ thống có nguy cơ cao  trong thực tế điều này có nghĩa là các trạm kiểm soát phải được truy vấn, các lần quay lại phải được thử nghiệm, và các đường mòn kiểm toán phải tồn tại sau khi triển khai. Phương thức thất bại cấp tính: mà không có các khóa bất khả năng và kiểm tra điều kiện trước, một lần thử lại sau khi thất bại tạm thời có thể thực hiện hai lần hành động đã được phê duyệt. Việc xác minh sau hành động là điều bắt được nó.

**Type:** Learn
**Languages:** Python (stdlib, checkpoint and rollback state machine), TypeScript
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 15 (Propose-then-commit)
**Time:** ~60 minutes

## Vấn đề

Hoạt động lâu dài (Học 12) làm cho một nhân viên bị hỏng có thể được tái khởi động. đề xuất sau đó cam kết (Học 15) làm cho một hành động được phê duyệt có thể kiểm tra. Bài học này gia nhập chúng: điều gì xảy ra khi một hành động được phê duyệt được thực hiện một phần, bị hỏng và được tái khởi động? Khi nào sự quay lại chạy, và chống lại trạng thái nào?

Hệ thống thực tế đưa ra điều này theo cách khác:

- **LangGraph**Checkpoint mỗi chuyển đổi trạng thái đồ thị đến PostgreSQL. Khi nhân viên bị sụp đổ, hợp đồng thuê được phát hành và một nhân viên khác tiếp tục tại checkpoint mới nhất.`interrupt()`, mà chính nó vẫn tồn tại.
- **Cloudflare Durable Objects**giữ trạng thái mỗi khóa trong nhiều giờ hoặc vài tuần.
- **Microsoft Agent Framework**- Tự động`Checkpoint`Primitive trong API workflow; play cộng với idempotency bao gồm các thử nghiệm lại.

Trong mọi trường hợp, sự kết hợp thực sự hoạt động là: khóa idempotency (để ngăn chặn thực hiện hai lần) + kiểm tra điều kiện trước (thủ tục là điều mà chúng tôi phê duyệt) + xác minh sau hành động (sự tác dụng phụ thực sự xảy ra) + quay lại khi xác minh-không thành công.

## Khái niệm

### Mỗi chuyển đổi vẫn tồn tại

Một chuyển đổi trạng thái đồ thị là bất kỳ bước nào di chuyển dòng công việc từ một trạng thái có tên đến một trạng thái khác. Các thực hiện ngây thơ chỉ tồn tại tại tại các điểm tham gia cụ thể; thực hiện sản xuất tồn tại ở mọi chuyển đổi. Chi phí (một vài người viết thêm) là nhỏ so với lợi nhuận độ tin cậy (tái chơi đất ở bất cứ đâu, phục hồi thuê là chính xác).

### Thuộc thu nhập thuê

Khi một công nhân bị hỏng, dòng công việc không bị mất; hợp đồng thuê (một tuyên bố ngắn ngủi rằng công nhân này đang thực hiện cuộc chạy này) chỉ đơn giản là hết hạn. Một công nhân khác nhận điểm kiểm soát mới nhất và tiếp tục. Cơ chế thuê là điều cho phép hệ thống sản xuất tồn tại trong việc triển khai không mất công việc trong chuyến bay.

### Thức mạnh không thể làm được cộng với các điều kiện tiên quyết

Chỉ cần tính năng tự do không đủ.$100 from A to B when balance > $1000. " Phòng lưu lượng công việc được thực hiện, bị hỏng giữa thực hiện, và tiếp tục. Nếu chỉ cần kiểm tra khóa idempotency, và thực hiện tiếp tục, chuyển nhượng chạy một lần (có chính xác). Nhưng hãy xem xét rằng giữa hỏng và tiếp tục, cân bằng của A giảm xuống 500 đô la thông qua một workflow khác.

Mỗi hành động có hậu quả cần cả hai:

- **Idempotency key**: ngăn chặn việc thực hiện hai lần.
- **Precondition check**: xác nhận rằng nhà nước vẫn phù hợp với những gì đã được phê duyệt.

### Kiểm tra sau hành động

"Công cụ trả lại 200" không phải xác minh. xác minh thực sự đọc lại trạng thái mục tiêu và xác nhận tác dụng phụ thực sự xảy ra.

- Tái cập nhật cơ sở dữ liệu: `UPDATE ... RETURNING *`sau đó khẳng định trạng thái phù hợp hàng quay trở lại.
- Gửi email: kiểm tra thư mục gửi cho ID tin nhắn sau khi gửi.
- Tác tập tin: đọc lại tập tin và phân phối nó.
- Lệnh API: theo dõi `GET`về nguồn tài nguyên mục tiêu.

Nếu xác minh thất bại, dòng công việc sẽ ở trạng thái xấu.

### Kế hoạch quay trở lại

Mỗi hành động liên quan trong đề xuất sau đó cam kết (Dạy học 15) mang theo một kế hoạch quay trở lại.

- **In-band rollback**: làm đảo ngược tác dụng phụ trực tiếp (`DELETE`sau đó`INSERT`- `Send-correction-email`sau khi gửi).
- **Compensating transaction**: một hành động mới làm trung hòa nguyên bản (chương trình SAGA tiêu chuẩn).
- **Out-of-band rollback**: cảnh báo một con người, tạm dừng quá trình làm việc, để lại tình trạng xấu để điều tra.

Không có sự phục hồi (no-op rollback) ("chúng ta không thể đảo ngược điều này") phải được nêu trong đề xuất.

### Đạo luật AI của EU Điều 14 Đọc hành động

Điều 14 yêu cầu "sự giám sát nhân lực hiệu quả" cho các hệ thống có nguy cơ cao.

- Các điểm kiểm soát có thể được kiểm tra bởi một kiểm toán viên.
- Rollback được thử nghiệm (được thử nghiệm hết cuối đến cuối ít nhất một lần).
- Các đường mòn kiểm toán tồn tại sau khi triển khai (checkpoint backend không là tạm thời).
- Các xác minh thất bại được báo động, không được ghi âm.

Một dòng công việc bị hỏng giữa thời gian thực hiện, tiếp tục và hoàn thành tác dụng phụ mà không có đường kiểm tra + quay trở lại không tồn tại trong bài kiểm tra Điều 14.

### Phương thức thất bại mạnh: dual-execute

Vụ việc sản xuất phổ biến nhất trong không gian này:

1. Động thái được phê duyệt, khóa miễn trừ k.
2. Commit bắt đầu, thực hiện, trả lại 200.
3. Workflow bị hỏng trước khi duy trì trạng thái "được cam kết".
4. Workflow tiếp tục; thấy "được chấp thuận nhưng không được cam kết"; thực hiện lại.
5. Tác dụng phụ nổ hai lần.

Giảm thiểu: duy trì một ý định "trong chuyến bay" trước khi thực hiện, thực hiện với một khóa idempotency, sau đó đánh dấu "được thực hiện" chỉ sau khi xác minh sau hành động thành công. Nếu các hoạt động bắn và viết trạng thái thất bại, bạn biết để xác minh và (nếu cần thiết) tái bắn. Nếu viết trạng thái thành công và hành động thất bại, bạn xác minh và bắn chính xác một lần thông qua con đường phục hồi.

```figure
checkpoint-replay
```

## Sử dụng nó

`code/main.py`thực hiện một dòng công việc kiểm soát được đặt theo điểm với idempotency, điều kiện trước, xác minh và quay trở lại. Người lái xe mô phỏng bốn kịch bản: chạy sạch, thử lại sau khi bị tai nạn (đấu bắt idempotency), thất bại trong điều kiện trước (lái bỏ dòng công việc mà không bắn), xác minh thất bại (cửa lửa quay trở lại).

## Chuyển nó

`outputs/skill-rollback-rehearsal.md`thiết kế một thử nghiệm thử nghiệm quay trở lại cho một dòng công việc được đề xuất và kiểm toán hậu quả của điểm kiểm tra để xác định sự bền vững của đường audit.

## Các bài tập

1. Đi chạy`code/main.py`Để xác minh bốn kịch bản, trong trường hợp xảy ra tai nạn, xác nhận các vụ nổ chính xác là một lần trong các lần thử lại.

2. Thay đổi mô hình "đánh dấu như đã làm trước, sau đó làm nó" để trạng thái viết cháy sau khi hành động. Lặp lại kịch bản tai nạn. đo số lượng các hành động trùng lặp bắn.

3. Thiết kế kế kế hoạch quay lại cho một hành động sản xuất cụ thể (ví dụ: "đưa vào một kênh Slack").

4. Hãy lấy một dòng công việc bạn biết. xác định từng chuyển đổi trạng thái. Đánh dấu mỗi điều kiện với yêu cầu độ bền (đằng sau / không tồn tại). Đếm những điều mà bạn hiện không tồn tại.

5. Thử nghiệm quay trở lại lặp lại: thiết kế một thử nghiệm kết thúc đến kết thúc chạy một dòng công việc thực sự, làm sụp đổ nó, và xác nhận các vụ cháy đường quay trở lại.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| Checkpoint | "Save point" | Every graph-state transition persists to a durable store |
| Lease | "Worker claim" | Short-lived claim that a worker is executing a run; expires on crash |
| Precondition | "State gate" | Assertion that the state is still consistent with the approved action |
| Post-action verify | "Re-read check" | Confirm the side effect actually happened in the target system |
| In-band rollback | "Direct undo" | Reverse the side effect with the inverse operation |
| Compensating transaction | "SAGA undo" | A new action that neutralizes the original |
| Mark-as-done-first | "Status write order" | Persist the committed status before returning from commit |
| Article 14 | "EU AI Act human oversight" | Operational: queryable checkpoints, rehearsed rollbacks, auditable trail |

## Đọc thêm

- [Microsoft Agent Framework — Checkpointing and HITL](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) Đường kiểm soát nguyên thủy và thu hồi thuê.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) Các đối tượng bền như một nền trạng thái.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) cơ sở quy định.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) khung độ tin cậy cho các dòng công việc dài hạn.
- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) hình dạng luồng làm việc cho Claude Code Routines.
