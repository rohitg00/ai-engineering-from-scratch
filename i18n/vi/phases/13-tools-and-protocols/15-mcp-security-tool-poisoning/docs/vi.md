# MCP Security: Metadata độc hại, định tuyến và trạng thái MRTR

> Không quốc tịch không có nghĩa là không tin tưởng, nó có nghĩa là mỗi yêu cầu cho thấy bằng chứng mà một máy chủ và cửa khẩu cần để xác nhận cuộc gọi độc lập.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~60 minutes

## Mục tiêu học tập

- Chế độ mô tả công cụ, ghi chú, thông tin khách hàng và thông tin máy chủ như dữ liệu không đáng tin cậy.
- Khám phá nhiễm metadata, thay đổi mô tả và va chạm tên giữa máy chủ.
- Thiết lập metadata yêu cầu 2026-07-28 và tiêu đề định tuyến HTTP Streamable.
- Bảo vệ MRTR `requestState`chống lại sự thao túng và buộc xác nhận với các lập luận chính xác.
- Đưa ra giới hạn cấp phép và tỷ lệ cho một chủ nhân, chứ không phải một phiên giao thức bị xóa.

## Vấn đề

Một mô hình đọc mô tả công cụ để quyết định gọi gì. Một bộ định tuyến đọc tên công cụ để quyết định gửi yêu cầu. Người dùng đọc nhãn để quyết định phải chấp thuận gì. Một mô tả độc hại có thể nhắm mục tiêu cả ba.

Các hướng dẫn bảo mật chính thức của MCP là trực tiếp: mô tả và ghi chú nên được coi là không đáng tin cậy trừ khi chúng đến từ một máy chủ đáng tin cậy. Ngay cả khi đó, sự tin tưởng triển khai có thể thay đổi.

Các giao thức hiện tại cũng thay đổi ranh giới an ninh. Năm 2026-07-28 không có cú tay cốt lõi và không có phiên giao thông.`Mcp-Session-Id`không phải là một thiết kế hiện tại.

## Khái niệm

### 7 mặt tấn công đáng kiểm tra

Hãy sử dụng danh sách cụ thể thay vì chỉ dẫn mơ hồ để cẩn thận.

1. **Metadata poisoning.**Mô tả chứa các hướng dẫn không liên quan đến hành vi công cụ được tuyên bố.
2. **Descriptor rug pull.**Một tên, mô tả, sơ đồ hoặc ghi chú đã được chấp thuận trước đó thay đổi.
3. **Cross-server shadowing.**Hai nền cho thấy cùng một tên công cụ không đủ điều kiện và định tuyến chọn một trong những tên này.
4. **Header and body confusion.** `Mcp-Method`hoặc `Mcp-Name`không đồng ý với yêu cầu JSON-RPC.
5. **Capability escalation.**Một đồng nghiệp yêu cầu một tính năng mở rộng hoặc khách hàng và máy chủ sai đó tuyên bố cho phép.
6. **MRTR state tampering.**Một khách hàng thay đổi `requestState`, trả lời một câu hỏi khác, hoặc sử dụng lại xác nhận với các lập luận khác nhau.
7. **Supply-chain identity confusion.**Một tên hiển thị quen thuộc được coi là bằng chứng về danh tính nhà xuất bản hoặc máy chủ.

Các bề mặt này chồng chéo. Hash pining giúp thay đổi mô tả nhưng không chứng minh rằng mô tả đầu tiên là an toàn. Quét tĩnh bắt được các cụm từ rõ ràng nhưng không phải hướng dẫn tinh tế. Namespacing ngăn chặn một lớp va chạm nhưng không phải là một máy chủ có không gian tên độc hại.

### Báo cáo yêu cầu hiện tại là bằng chứng, không phải danh tính

Mỗi yêu cầu năm 2026-07-28 bao gồm:

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "elicitation": {"form": {}}
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "security-lab",
      "version": "1.0.0"
    }
  }
}
```

Thiết lập phiên bản và hình dạng khả năng trên mỗi yêu cầu. Sử dụng các khả năng để chọn một hình dạng phản ứng tương thích. Không sử dụng `clientInfo`là một người chủ sở hữu xác thực.

Tương tự như cảnh báo này cũng áp dụng cho `io.modelcontextprotocol/serverInfo`Nó hữu ích cho các nhật ký và debugging. Nó không phải là một chứng chỉ, chứng minh đăng ký, hoặc quyết định ủy quyền.

### Thiết lập đường dẫn trước chính sách

Vì `tools/call`, Streamable HTTP bao gồm:

```text
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.export
```

Phương pháp tiêu đề phải bằng phương pháp cơ thể.`params.name`Thử từ chối bất đồng với `-32020`trước khi chọn một backend, áp dụng RBAC hoặc tiêu thụ một token giới hạn lãi suất.

Sự sắp xếp này đóng lại một sự mơ hồ phổ biến: một thành phần cho phép cơ thể trong khi một thành phần khác đi theo tiêu đề.

Thiết lập bằng chứng bằng dây theo một chuỗi chính xác. Thiết lập các loại JSON-RPC và metadata, so sánh giá trị tiêu đề với cơ thể, sau đó kiểm tra xem phiên bản phù hợp có được hỗ trợ hay không. Một tiêu đề không phù hợp trả về HTTP 400 với `-32020`Nếu tiêu đề và cơ thể đồng ý về một phiên bản không được hỗ trợ, trả về HTTP 400 với `-32022`và `data`Đúng vậy.`{"supported":["2026-07-28"],"requested":"<actual>"}`. Một phương pháp không rõ trả về HTTP 404 với `-32601`- Tôi không biết.

Mỗi đối tượng lỗi bao gồm tùy chọn `data`khi hợp đồng cần thông tin thu hồi có cấu trúc.`id`, vì vậy nó không bao giờ nhận được một thành công JSON-RPC hoặc phản ứng lỗi. Một thông báo HTTP được chấp nhận trả lại 202 với một cơ thể trống.

### Đẹp toàn bộ mô tả

Một mô tả hash đơn độc bỏ lỡ các thay đổi sơ đồ và ghi chú. Canonicalize và hash các trường mô tả người dùng đã chấp thuận:

```python
normalized = json.dumps(tool, sort_keys=True, separators=(",", ":"))
digest = hashlib.sha256(normalized.encode()).hexdigest()
```

Cung cấp bản ghi dưới một khóa có trình độ như `notes.export`, cùng với bằng chứng của nhà xuất bản và thời gian phê duyệt bên ngoài ví dụ đồ chơi này.

Với mỗi lần làm mới:

- Chìa khóa không rõ: Quarantaine cho đến khi xem xét.
- Chìa khóa giống nhau, tiêu hóa khác nhau: Quarantaine như một kéo thảm cho đến khi được phê duyệt lại.
- Tên không đủ điều kiện trùng lặp: yêu cầu không gian tên xác định.
- Nhấn máy quét: chặn và xem xét mô tả đầy đủ.

Sự bình đẳng Hash chứng minh sự ổn định, không phải sự an toàn.

### Quét tĩnh là một dây tripwire

Các mẫu đơn giản có thể đánh dấu thẻ vai trò, lệnh vượt trội, ẩn, truy cập bí mật và các điểm đến mạng bị che giấu.

Chúng không phải là bằng chứng ngữ nghĩa. Một mô tả an toàn có thể chứa một cụm từ được đánh dấu trong một cảnh báo hợp pháp. Một mô tả độc hại có thể tránh mọi cụm từ.

### Không gian tên trước khi sáp nhập

Giả sử hai máy chủ đều lộ ra`search`Đừng bao giờ để lệnh khám phá quyết định ai thắng.

```text
notes.search
issues.search
```

Tên được xác nhận là tên cửa ngõ công cộng. ghi lại bản đồ hậu kết riêng biệt. Tên ổn định làm cho sự chấp thuận, kiểm toán, pin hash, và `Mcp-Name`định tuyến liên quan đến cùng một đối tượng.

### Khả năng là tuyên bố tương thích

Theo yêu cầu`clientCapabilities`cho biết máy chủ có các tính năng giao thức nào mà khách hàng có thể xử lý. Nó không cho phép khách hàng truy cập vào các công cụ, dữ liệu hoặc hành động.

Việc ủy quyền vẫn xuất phát từ chính sách chính sách và nguồn lực được xác thực.

1. Đăng bằng thông tin giao thông.
2. Thiết lập phiên bản, tiêu đề và hình dạng yêu cầu.
3. Kiểm tra khả năng tương thích.
4. Quyền chính, công cụ, tài nguyên và các lập luận.
5. Thực hiện hoặc yêu cầu nhập dữ liệu của người dùng.

### Bảo vệ xác nhận MRTR không có quốc tịch

Một công cụ có thể cần xác nhận người dùng. MCP hiện tại sử dụng nhiều yêu cầu đi vòng thay vì một cuộc gọi trở lại từ máy chủ đến khách hàng.

Câu trả lời đầu tiên:

```json
{
  "resultType": "input_required",
  "inputRequests": {
    "confirm": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Export notes to archive?",
        "requestedSchema": {
          "type": "object",
          "properties": {
            "confirm": {"type": "boolean"}
          },
          "required": ["confirm"]
        }
      }
    }
  },
  "requestState": "opaque-integrity-protected-value"
}
```

Khách hàng nhận được đầu vào và thử lại phương pháp ban đầu với một ID JSON-RPC mới:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "notes.export",
    "arguments": {"query": "private", "destination": "archive"},
    "requestState": "opaque-integrity-protected-value",
    "inputResponses": {
      "confirm": {
        "action": "accept",
        "content": {"confirm": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {"form": {}}
      }
    }
  }
}
```

Mỗi người`inputRequests`value là một yêu cầu được nhúng hoàn chỉnh với `method`và `params`. Chìa khóa của nó phải phù hợp với mục tương ứng trong `inputResponses`. Một hình thức tạo ra sử dụng một object-root `requestedSchema`, và khách hàng phải đã tuyên bố khả năng kích hoạt biểu mẫu trước khi máy chủ yêu cầu nó.

Khả năng hiện tại có hai tuyên bố hình thức hợp lệ. `{"elicitation":{}}`hỗ trợ ngầm hình thức tạo ra, trong khi `{"elicitation":{"form":{}}}`Một tuyên bố chỉ có URL như `{"elicitation":{"url":{}}}`không hỗ trợ yêu cầu biểu mẫu. máy chủ trả về HTTP 400 với `-32021`và `data.requiredCapabilities`bằng với `{"elicitation":{"form":{}}}`- Tôi không biết.

Chữa bệnh`requestState`mã hóa nó, xác nhận nó và liên kết nó với phương pháp, công cụ, lập luận chính xác, mục đích, hết hạn, chính, và một lần không khi chơi lại các vấn đề. mã bài học sử dụng HMAC và lập luận chính xác phù hợp để làm cho ranh giới hiển thị.

Các sổ cái nonce không được sống bên trong một đối tượng cửa khẩu. mô hình chạy được tiêm một cửa hàng tái phát có giới hạn, cắt TTL có thể được chia sẻ bởi nhiều trường hợp cửa khẩu. tuyên bố nguyên tử của nó là ranh giới thực hiện: chỉ một chấp nhận được xác nhận hoặc giảm kết thúc rõ ràng tiêu thụ trạng thái.`cancel`Không thực hiện bất cứ điều gì và vẫn có thể được sử dụng lại cho đến khi hết hạn.

Không lưu trữ bối cảnh xác nhận ẩn trong phiên giao thức. Bất kỳ phiên bản máy chủ nào cũng nên có thể xác nhận lần thử lại.

### Quy tắc hai cho các cuộc gọi có rủi ro cao

Đánh phân một cuộc gọi dọc theo ba trục:

- Nó tiêu thụ đầu vào không tin cậy.
- Nó có thể truy cập dữ liệu nhạy cảm.
- Nó gây ra một hành động bên ngoài hậu quả.

Một bước tự động duy nhất không nên kết hợp cả ba. Chia nó, giảm quyền lợi hoặc yêu cầu nhập khẩu người dùng rõ ràng thông qua MRTR. Đây là một tính năng thiết kế, không phải là một tính năng giao thức.

### Giảm quyền lực trước khi hành quyết

Sự vô quốc tịch đơn độc không phải là an toàn. Nó xóa lịch sử giao thức ẩn, nhưng một yêu cầu tự nhiên vẫn có thể yêu cầu một người xử lý có quyền vượt quá để rò rỉ dữ liệu hoặc thực hiện một thay đổi không thể đảo ngược. An toàn đến từ việc giảm quyền lực ở mỗi ranh giới:

1. **Typed verb.**Khám phá một hoạt động giới hạn như `archive_note`, không phải là thuốc chung .`run`hoặc `request`công cụ có thể thể hiện các quyền lực không liên quan.
2. **Validated arguments.**Sử dụng một kế hoạch đóng cửa khi thực tế, từ chối các trường không rõ, bình thường hóa các nhận dạng một lần, kích thước giới hạn, và xác nhận đích, người thuê nhà và sở hữu tài nguyên trước khi đánh giá chính sách.
3. **Current authorization.**Kết nối nguyên tố xác thực với động từ chính xác, tài nguyên, môi trường và các lập luận bình thường.
4. **Action-bound approval.**Để gọi kết quả, liên kết sự chấp thuận với một bản ghi của động từ và các lập luận bình thường được gõ, cộng với chính sách chính, hết hạn và một lần. Bất kỳ trường nào thay đổi đều đòi hỏi phải có quyết định mới.
5. **First-class refusal.**Mô hình từ chối, hết hạn phê duyệt, người dùng từ chối và không an toàn đích như kết quả bình thường mà không thực hiện bất kỳ tác dụng phụ nào. Đừng chuyển từ thành một công cụ trở lại yếu hơn.
6. **Redacted audit evidence.**Lưu ý ai đã hỏi, mô tả và phiên bản chính sách nào đã được sử dụng, mục tiêu tiêu bình thường được phép, lý do tại sao quyết định cho phép hoặc từ chối, và liệu việc thực thi có bắt đầu hay không.

Mỗi bước thu hẹp những gì thành phần tiếp theo có thể làm. Người xử lý cuối cùng nên nhận lệnh miền đã được xác nhận, không phải văn bản mô hình nguyên liệu cộng với các chứng chỉ rộng.

### Các đường tương tác hiện tại và di sản

Root, Sampling và Logging đã bị lỗi thời cho các triển khai mới 2026-07-28. Một cửa cổng có thể giữ lại mã kênh yêu cầu cũ chỉ như một con đường tương thích được trang bị phiên bản.

Đừng xây dựng một hệ thống phòng thủ mới xung quanh giới hạn lấy mẫu mỗi phiên. Sử dụng hạn ngạch cho chính xác nhận, nhà phát hành, tài nguyên, công cụ và cửa sổ thời gian. Đối với công việc tương tác hiện tại, kiểm tra các yêu cầu nhập và phản hồi của MRTR.

### Kiểm tra vận chuyển vô quốc tịch

- Tận dụng các tin nhắn MCP hiện đại tại điểm cuối POST duy nhất.
- Trả lại 405 cho GET và DELETE hiện đại.
- Đừng đúc hoặc phụ thuộc vào `Mcp-Session-Id`- Tôi không biết.
- Phớt lờ phiên cũ và chơi lại tiêu đề như đầu vào quyền lực.
- Trả lại JSON hoặc yêu cầu-scoped SSE cho POST đó.
- Sử dụng `subscriptions/listen`Chỉ cho các thông báo thay đổi lâu dài được chọn.

```figure
tp-tool-poisoning
```

## Hãy xây dựng nó

`code/main.py`thực hiện một mô hình cổng thông tin bảo mật nhỏ trong quá trình. Nó canonicalize và pin đầy đủ mô tả công cụ, báo cáo nhiễm độc và bóng dữ liệu, xác nhận bao bì yêu cầu hiện đại và định tuyến giá trị, và thực hiện hai vòng xác nhận xuất với chữ ký `requestState`và một cửa hàng phát lại được tiêm.

Mô hình bắt đầu sau khi một bộ điều chỉnh HTTP đã phân tích cơ thể JSON và tiêu đề định tuyến. Nó không xác nhận `Content-Type`hoặc `Accept`Kết nối cùng một máy phát sóng với bộ chuyển đổi HTTP Streamable đầy đủ của bài học 09 , đòi hỏi `Content-Type: application/json`và một `Accept`giá trị chứa cả hai `application/json`và `text/event-stream`- Tôi không biết.

Đi đi.

```bash
cd phases/13-tools-and-protocols/15-mcp-security-tool-poisoning
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

Các mẫu cố tình biến đổi một mô tả.`input_required`phản ứng và thử lại không có quốc tịch.

## Sử dụng nó

Thay thế `SAFE_TOOLS`với một snapshot bình thường từ các máy chủ được phê duyệt của riêng bạn. giữ tín dụng và bí mật khỏi snapshot. Xem xét mọi mô tả mới hoặc thay đổi trước khi cập nhật tiêu hóa của nó.

Tại một cửa ngõ, chạy các kiểm tra tương tự trong quá trình phát hiện và một lần nữa trước khi gửi. Một bộ nhớ cache có thể làm giảm công việc phát hiện, nhưng sự chấp thuận được lưu trữ trong bộ nhớ cache phải hết hạn hoặc bị vô hiệu hóa khi mô tả thay đổi.

## Chuyển nó

Bài học này sẽ đi theo `outputs/skill-mcp-threat-model.md`Nó tạo ra mô hình đe dọa giao thức hiện tại trên các metadata, định tuyến, khả năng, ủy quyền, MRTR, lưu trữ trước, đăng ký và ranh giới tương thích.

## Các bài tập

1. Kết nối chính xác và quyết định cấp phép hiện tại với trạng thái MRTR được niêm phong, sau đó từ chối một lần thử lại theo một chính khác.
2. Thay thế kho lưu trữ lặp lại trong bộ nhớ bằng một phần nhập điều kiện bền vững và chứng minh hai quá trình không thể cả hai đều đòi hỏi một nonce.
3. Đưa ra một lỗi sau khi yêu cầu tái phát nhưng trước khi xuất khẩu mô phỏng.
4. Thay đổi công cụ `inputSchema`Không thay đổi mô tả của nó.
5. Thêm một chính sách từ chối lưu trữ trước khi `tools/list`khác nhau theo nguyên tắc.
6. Mô hình một máy chủ cũ phía sau cổng. Đặt tất cả sự bắt tay và hành vi phiên sau một rõ ràng`2025-11-25`Hành vi tương thích.

## Các điều khoản chính

| Term | Meaning |
|------|---------|
| Metadata poisoning | Instructions or deceptive claims embedded in a tool descriptor |
| Rug pull | Change to a previously approved descriptor |
| Tool shadowing | Ambiguous routing caused by duplicate unqualified names |
| Header mismatch | Routing header and JSON-RPC body disagreement, error `-32020` |
| Hash pin | Digest of the complete approved descriptor |
| MRTR | Stateless response and retry pattern for server-requested input |
| `requestState` | Opaque round-trip value that must be treated as untrusted input |
| Capability declaration | Statement of protocol compatibility, not authorization |
| Implicit form support | An empty `elicitation` capability object, equivalent to form support |
| Qualified tool name | Stable gateway name such as `notes.search` |

## Đọc thêm

- [MCP security and trust guidance](https://modelcontextprotocol.io/specification/2026-07-28#security-and-trust--safety)
- [Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
