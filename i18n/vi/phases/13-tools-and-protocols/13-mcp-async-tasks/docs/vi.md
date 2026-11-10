# MCP Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể Thể

> MCP không có quốc tịch không có nghĩa là mọi hoạt động phải hoàn thành trong một yêu cầu.`tools/call`, bất cứ trường hợp nào có thể trả lời.`tasks/get`, và thông tin của khách hàng đến qua `tasks/update`Không làm lại các phiên giao thức.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 11 (stateless MRTR), Phase 13 · 12 (elicitation)
**Time:** ~90 minutes

## Mục tiêu học tập

- Sự khác biệt giữa giao thông giao thức không có quốc gia và trạng thái nhiệm vụ ứng dụng bền.
- Thỏa thuận`io.modelcontextprotocol/tasks`mở rộng khả năng theo yêu cầu và`server/discover`- Tôi không biết.
- Trả lại một máy chủ hướng `CreateTaskResult`với `resultType: "task"`Chỉ sau khi tạo ra một sự tồn tại lâu dài.
- Cuộc thăm dò với `tasks/get`, hoàn thành các nhiệm vụ nhập với `tasks/update`, và yêu cầu hủy hợp tác với `tasks/cancel`- Tôi không biết.
- Tắt ra người lớn tuổi `tasks/status`- `tasks/result`, và`tasks/list`những giả định.
- Đăng ký thông báo nhiệm vụ tùy chọn qua `subscriptions/listen`trên một dòng SSE trả lời POST.
- Mô hình nhiệm vụ hết hạn, khởi động lại phục hồi, sao chép sao chép khóa đầu vào và lỗi thực hiện đúng.

## Tại sao nhiệm vụ là một phần mở rộng

Nhiệm vụ lần đầu tiên xuất hiện như một tính năng cốt lõi thử nghiệm trong năm 2025-11-25.`io.modelcontextprotocol/tasks`mở rộng để khách hàng và máy chủ có thể chọn vào vòng đời bổ sung mà không mở rộng giao thức cốt lõi cho tất cả mọi người.

Các đặc điểm mở rộng vẫn là một bề mặt sơ đồ mặc dù nó là nhà chính thức hiện tại cho các nhiệm vụ. Pin phiên bản mở rộng được hỗ trợ bởi SDK của bạn, chạy kịch bản phù hợp, và cô lập bộ chuyển đổi dây từ nhân viên và miền lưu trữ của bạn.

Sử dụng một nhiệm vụ khi hoạt động có một hoặc nhiều tính chất sau đây:

- Nó có thể tồn tại lâu hơn một thời gian yêu cầu bình thường.
- Một hàng lao động hoặc hệ thống việc làm bên ngoài đã sở hữu hành động.
- Khách hàng cần phải phục hồi sau khi khởi động lại.
- Hành động dừng lại cho người dùng hoặc mô hình nhập trong quá trình thực hiện.
- Việc hủy bỏ và thu hồi kết quả lâu dài là yêu cầu sản phẩm.

Đừng tạo ra một nhiệm vụ cho một tìm kiếm quyết định giá rẻ.

## Core không quốc tịch, ứng dụng quốc tịch

MCP 2026-07-28 được gỡ bỏ `initialize`- `notifications/initialized`, các phiên giao thức, và`Mcp-Session-Id`Điều đó không cấm các sản phẩm có nội dung.

Một task id là trạng thái ứng dụng rõ ràng:

- Máy chủ vẫn cố gắng để trả lại nó.
- Khách hàng có thể lưu trữ nó và thăm dò lại sau khi khởi động lại.
- Thẻ nhận dạng có thể chuyển đến bất kỳ bản sao nào được hỗ trợ bởi cùng một cửa hàng bền.
- Quyền được kiểm tra trên mỗi phương pháp nhiệm vụ.
- Thời hạn và xóa được xác định bởi các lĩnh vực nhiệm vụ, không phải là thời gian vận chuyển.

Điều này khác với trạng thái ẩn gắn với một kết nối.

Hãy giữ bốn đời riêng biệt:

| State | Lifetime | Where it belongs |
|---|---|---|
| Protocol metadata | One request | `params._meta`, validated again on every call |
| Transport work | One stdio request or HTTP response | In-flight coordinator with a bounded deadline |
| MRTR continuation | One retry sequence | Integrity-protected `requestState`, plus replay controls when needed |
| Durable task | Across requests, replicas, restarts, and reconnects | Shared application store keyed by an authorized `taskId` |

Di chuyển một hồ sơ nhiệm vụ vào bộ nhớ quá trình không làm cho MCP trạng thái. Nó làm cho ứng dụng không đáng tin cậy.`tasks/get`Đăng thẳng trước khi trả lại tay cầm, sau đó làm cho mỗi phương pháp nhiệm vụ giải quyết cùng một bản ghi chia sẻ dưới kiểm tra người thuê và chủ.

## Các thương lượng về khả năng

Khách hàng quảng cáo hỗ trợ cho mỗi yêu cầu đủ điều kiện:

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "extensions": {
        "io.modelcontextprotocol/tasks": {}
      }
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "lesson-client",
      "version": "1.0.0"
    }
  }
}
```

Server trả lại chính xác `supportedVersions`, khả năng,`ttlMs`, và`cacheScope`từ `server/discover`, với cùng một mở rộng trong khả năng.`tools/list`Kết quả đó trả lại một số lượng xác định`generate_report`mô tả, đối tượng hợp lệ `inputSchema`- `resultType: "complete"`, dữ liệu siêu dạng máy chủ, và gợi ý cache công cộng.

Một phương pháp nhiệm vụ từ một khách hàng không báo cáo các khoản mở rộng trả lại `-32021`, Không có khả năng khách hàng cần thiết, với `data.requiredCapabilities`được thiết lập`{"extensions":{"io.modelcontextprotocol/tasks":{}}}`. Một chuỗi giao thức không được hỗ trợ trả về`-32022`chính xác`supported`và `requested`dữ liệu; một phiên bản bị mất hoặc không có chuỗi trả lại `-32602`- Tôi không biết.

Một phong bì mà không có JSON-RPC `id`là một thông báo. Người nhận có thể xử lý nó, nhưng nó không phát ra kết quả hoặc lỗi JSON-RPC. Một bộ điều chỉnh HTTP Streamable trả về `202 Accepted`Không có cơ quan nào cho thông báo được chấp nhận.

Hiện tại, chỉ có`tools/call`hỗ trợ thực hiện tăng nhiệm vụ. Thiết kế trừu tượng nội bộ của bạn để các loại yêu cầu trong tương lai không yêu cầu viết lại lưu trữ.

## Tạo nhiệm vụ hướng dẫn máy chủ

Lập cờ của khách hàng cũ `params._meta.task.required`Client tuyên bố hỗ trợ mở rộng, sau đó máy chủ quyết định liệu một cụ thể `tools/call`trở thành một nhiệm vụ.

Yêu cầu:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "generate_report",
    "arguments": {"size": "large"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

Phản ứng:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "task",
    "taskId": "tsk_786512e29e0d",
    "status": "working",
    "statusMessage": "Preparing report outline.",
    "createdAt": "2026-08-21T10:30:00Z",
    "lastUpdatedAt": "2026-08-21T10:30:00Z",
    "ttlMs": 900000,
    "pollIntervalMs": 1000
  }
}
```

Các máy chủ không được trả lại tay cầm này cho đến khi một `tasks/get`trong một cửa hàng cuối cùng nhất quán, chờ cho khả năng hiển thị đọc trước khi trả lời. Nếu không, một khách hàng có thể nhận được một ID có vẻ hợp lệ và ngay lập tức nhận được "không được tìm thấy".

Một câu trả lời nhiệm vụ không được yêu cầu trong nghĩa là khách hàng không yêu cầu chế độ nhiệm vụ. Nó không phải là không đàm phán: yêu cầu hiện tại vẫn phải quảng cáo về mở rộng.

## Hình thức nhiệm vụ

Mỗi nhiệm vụ đều mang theo:

- `taskId`: định danh máy chủ được tạo ra ổn định;
- `status``working`- `input_required`- `completed`- `cancelled`, hoặc`failed`-
- `createdAt`và `lastUpdatedAt`: Tiêu chuẩn ISO 8601;
- `ttlMs`: thời gian hết hạn từ khi tạo ra, hoặc `null`Không giới hạn quảng cáo;
- tùy chọn `pollIntervalMs`: thời gian biểu thăm dò tối thiểu hiện tại của máy chủ;
- tùy chọn `statusMessage`: bối cảnh đối diện với người dùng hoặc đối diện với mô hình.

Các trường cụ thể về tình trạng chỉ xuất hiện khi có liên quan:

- `input_required`bao gồm `inputRequests`- Tôi không biết.
- `completed`bao gồm các yêu cầu ban đầu `result`hình dạng.
- `failed`bao gồm một JSON-RPC `error`đối tượng.

Khách hàng nên tôn trọng`pollIntervalMs`Một máy chủ có thể hạn chế tỷ lệ thăm dò dữ dội hơn và có thể thay đổi khoảng thời gian trong suốt thời gian nhiệm vụ.

## Cuộc thăm dò với `tasks/get`

Khách hàng yêu cầu một bức ảnh hiện tại:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/get
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tasks/get",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

`tasks/get`tự hoàn thành, do đó kết quả của nó luôn luôn có`resultType: "complete"`- Vấn đề đốn nhựa vẫn có thể xảy ra .`status: "working"`hoặc `status: "input_required"`- Tôi không biết.

Sự phân biệt này ngăn chặn lỗi phân tích phổ biến:

```text
result.resultType = complete    means the tasks/get RPC finished
result.status = working        means the represented job is still running
```

Không có `tasks/result`Khi nhiệm vụ hoàn thành, người tiếp theo sẽ`tasks/get`Câu trả lời trong bản gốc `CallToolResult`dưới `result`- Có thể là:

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "completed",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:34:12Z",
  "ttlMs": 900000,
  "result": {
    "resultType": "complete",
    "content": [
      {"type": "text", "text": "Generated large report with approved outline."}
    ],
    "structuredContent": {"size": "large", "approved": true},
    "isError": false,
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "tasks-demo",
        "version": "1.0.0"
      }
    }
  },
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "tasks-demo",
      "version": "1.0.0"
    }
  }
}
```

Bên ngoài `resultType`nói `tasks/get`RPC hoàn thành.`result.resultType`nói rằng cuộc gọi công cụ ban đầu đã hoàn thành.`CallToolResult`Nó cũng phải mang theo của riêng nó `io.modelcontextprotocol/serverInfo`; bài học này bao gồm nó thay vì lưu trữ một tải trọng hữu ích không được loại.

Không có `tasks/list`Các máy chủ không có phiên không thể suy luận an toàn các nhiệm vụ thuộc về danh sách kết nối. Các ứng dụng cần lịch sử nên phơi bày một công cụ miền được ủy quyền với các bộ lọc rõ ràng và các quy tắc sở hữu.

## Nhập trong khi thực hiện nhiệm vụ

Các đầu vào nhiệm vụ và MRTR cốt lõi trông giống nhau nhưng sử dụng các tiếp tục khác nhau.

### Đăng nhập cần thiết trước khi tạo nhiệm vụ

Lòng quay trở lại `resultType: "input_required"`từ bản gốc `tools/call`Khách hàng hoàn thành nó và thử lại cuộc gọi ban đầu. chỉ tạo nhiệm vụ sau khi các vòng MRTR đồng bộ kết thúc.

### Nhập cần thiết sau khi tạo nhiệm vụ

Đặt nhiệm vụ cho `input_required`- `tasks/get`cho thấy những gì nổi bật `inputRequests`, và khách hàng gửi câu trả lời qua `tasks/update`Khách hàng không thử lại bản gốc.`tools/call`- Tôi không biết.

Hình ảnh:

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "input_required",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:31:00Z",
  "ttlMs": 900000,
  "inputRequests": {
    "approve_outline": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Approve the generated report outline?",
        "requestedSchema": {
          "type": "object",
          "properties": {"approved": {"type": "boolean"}},
          "required": ["approved"]
        }
      }
    }
  }
}
```

Cập nhật:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/update
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tasks/update",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "inputResponses": {
      "approve_outline": {
        "action": "accept",
        "content": {"approved": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

Câu trả lời thành công là một sự thừa nhận trống rỗng cộng với `resultType: "complete"`Sự thay đổi của nhà nước có thể cuối cùng là phù hợp, vì vậy khách hàng tiếp tục thăm dò hoặc lắng nghe.

Mỗi người`inputRequests`Key phải là độc đáo cho toàn bộ cuộc sống của nhiệm vụ.`tasks/get`các ảnh chụp nhanh có thể hiển thị cùng một khóa đang chờ; các client sao chép lại UI và các máy chủ bỏ qua các phản ứng cho các khóa không rõ, thay thế hoặc đã được thực hiện.`input_required`cho đến khi tất cả các khóa cần thiết được trả lời.

## Thủy bỏ là hợp tác

`tasks/cancel`Các công việc có thể kết thúc trước, bỏ qua hủy bỏ hoặc chuyển đổi sau đó.

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/cancel
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tasks/cancel",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

Đối với cả ba phương pháp nhiệm vụ,`Mcp-Name`gương`params.taskId`Nó không lặp lại tên phương pháp JSON-RPC. `code/main.py`tập trung quy tắc này trong `make_http_request`- Tôi không biết.

Người làm việc bài học tôn trọng hủy ngay lập tức, làm cho các cuộc gọi lặp đi lặp lại không có khả năng.

Không sử dụng `notifications/cancelled`để hủy bỏ một nhiệm vụ. Thông báo đó thuộc về yêu cầu hủy bỏ, không phải là nhiệm vụ lâu dài.

Sự khác biệt quan trọng ở biên giới định tuyến. Phục hồi yêu cầu nhắm vào một hoạt động JSON-RPC trong chuyến bay hoặc phản ứng HTTP theo yêu cầu của nó. Nếu `tools/call`đã trở về rồi `resultType: "task"`, yêu cầu đó hoàn thành và đóng cửa vận chuyển của nó không thể đặt tên hoặc dừng lại công việc lâu dài. `tasks/cancel`là một RPC mới được ủy quyền.`params.taskId`, gương danh tính đó trong `Mcp-Name`, giải quyết hậu thuẫn sở hữu nhiệm vụ, ghi lại ý định hủy hợp tác, và trả lại một xác nhận mà không tuyên bố người lao động đã dừng lại.

Do đó, một cửa khẩu phải giữ các bộ điều phối yêu cầu và các tuyến đường nhiệm vụ trong các bảng khác nhau. Bảng yêu cầu có thể biến mất khi kết thúc phản hồi. tuyến đường nhiệm vụ phải tồn tại cho đến khi trạng thái cuối cùng và lưu trữ hết hạn. [Lesson 29: MCP Reliability, Cancellation, and Flow Control](../../29-mcp-reliability-cancellation-and-flow-control/docs/en.md)xây dựng cuộc đua, thời gian nghỉ, bất lực, áp lực ngược lại, và thử lại các quy tắc cho cả hai con đường.

## Thông báo tùy chọn

Cuộc thăm dò là cơ sở. Một khách hàng muốn cập nhật đẩy gửi `subscriptions/listen`với ID nhiệm vụ. Đối với Streamable HTTP, đây là một POST mà phản ứng của nó là một dòng SSE có quy mô yêu cầu. Không có dòng GET tự động và không có phiên giao thức để giữ cho cuộc sống.

Server nhận dạng nhận dạng được chấp nhận với `notifications/subscriptions/acknowledged`và sau đó có thể gửi ảnh chụp đầy đủ qua `notifications/tasks`- Thông báo và thông báo về nhiệm vụ`io.modelcontextprotocol/subscriptionId`trong `_meta`, bằng với `subscriptions/listen`request id. Mỗi thông báo nhiệm vụ bằng cách khác bằng với `tasks/get`sẽ quay lại ngay lúc đó.

Khách hàng vẫn phải tuyên bố mở rộng nhiệm vụ. Họ nên kết nối lại và tiếp tục từ ID nhiệm vụ lâu dài thay vì phụ thuộc vào việc lặp lại sự kiện hoặc `Last-Event-ID`- Tôi không biết.

## Hình thức ngữ nghĩa thất bại

Sử dụng hai lớp lỗi đúng cách.

### Lỗi giao thức

Các tham số phương pháp không hợp lệ hoặc một ID nhiệm vụ không rõ sẽ trả về lỗi JSON-RPC, thường `-32602`. Phản hồi hỗ trợ gia hạn bị mất `-32021`với đối tượng khả năng cần thiết.

### Kết quả thực hiện nhiệm vụ

- Kết quả công cụ bình thường với `isError: true`vẫn là một `completed`nhiệm vụ vì cuộc gọi công cụ đã tạo ra kết quả xác định của nó.
- Một lỗi JSON-RPC trong quá trình thực hiện bị hoãn làm cho nhiệm vụ `failed`và lưu trữ lỗi JSON-RPC trong `error`- Tôi không biết.
- Việc người dùng từ chối có thể tạo ra `cancelled`, kết quả từ chối hoàn thành, hoặc kết quả an toàn cụ thể khác.

## Thường dài, hết hạn và sở hữu

Giữ ít nhất ID nhiệm vụ, trạng thái, dấu thời gian, ttl, khoảng thời gian thăm dò, sở hữu hoạt động ban đầu, kết quả hoặc lỗi, yêu cầu nhập đang chờ, và tất cả các khóa nhập được phát hành.

Chìa kho lưu trữ phải bao gồm hoặc giải quyết một người thuê nhà và chủ sở hữu có thẩm quyền.`tasks/get`- `tasks/update`- `tasks/cancel`, và đăng ký.

`ttlMs`được đo từ khi tạo và có thể thay đổi. Một khách hàng có thể coi nó như một backstop khi một nhiệm vụ đã ngừng sản xuất cập nhật có thể quan sát được. Một máy chủ có thể thất bại và sau đó xóa một nhiệm vụ hết hạn. Đừng mô tả nó như một lời hứa để giữ lại kết quả hoàn thành trong nhiều millisecond sau khi hoàn thành.

Sử dụng viết hoặc giao dịch nguyên tử. Bài học viết một tệp tạm thời và đổi tên nó bằng nguyên tử. Một dịch vụ đa bản sao nên sử dụng một cửa hàng bền chung và một hợp đồng thuê công nhân hoặc kiểm soát đồng thời tương đương.

```figure
tp-task-lifecycle
```

## Hãy xây dựng nó

`code/main.py`thực hiện một dịch vụ nhiệm vụ xác định:

- `server/discover`trả lại `supportedVersions`, cache gợi ý, và mở rộng nhiệm vụ.
- `tools/list`trả lại một định nghĩa, cacheable `generate_report`mô tả với một sơ đồ đầu vào hợp lệ.
- `tools/call`tạo ra và duy trì nhiệm vụ trước khi quay lại `resultType: "task"`- Tôi không biết.
- Một phiên bản dịch vụ mới tải lại cùng một nhiệm vụ, chứng minh khởi động lại phục hồi.
- `tasks/get`trả lại ảnh chụp hoàn chỉnh nhiệm vụ.
- Người lao động chuyển từ `working`đến`input_required`- Tôi không biết.
- `tasks/update`chấp nhận phản hồi trên mẫu và trả lại lời xác nhận hoàn toàn trống.
- Người lao động lưu trữ một con đẻ `CallToolResult`với chính nó `resultType`và server danh tính, sau đó chuyển sang `completed`- Tôi không biết.
- `tasks/cancel`là không có khả năng trong việc thực hiện này.
- Các bộ tạo HTTP `Mcp-Name`đến`params.taskId`cho `tasks/get`- `tasks/update`, và`tasks/cancel`- Tôi không biết.
- Các trợ lý thông báo sử dụng `notifications/subscriptions/acknowledged`và `notifications/tasks`, cả hai đều có thẻ với danh tính yêu cầu nghe.
- Các thông báo không có ID không tạo ra phản ứng JSON-RPC.

Người lao động tiến lên một cách rõ ràng thay vì ngủ trong một chuỗi nền. Điều đó làm cho mọi chuyển đổi trạng thái xác định và giữ cho ví dụ giao thức tách biệt với cơ học hàng.

## Sử dụng nó

Từ nguồn kho:

```bash
cd phases/13-tools-and-protocols/13-mcp-async-tasks/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Dòng kết quả dự kiến:

```text
id=0 resultType=complete status=ack
id=1 resultType=task status=working
id=2 resultType=complete status=working
id=3 resultType=complete status=input_required
id=4 resultType=complete status=ack
id=5 resultType=complete status=completed
```

Cũng xác minh rằng `tasks/status`- `tasks/result`, và`tasks/list`Phương pháp trả lại không được tìm thấy trong dịch vụ hiện đại.
Hãy kiểm tra điều đó.`tools/list`là xác định và mỗi phương pháp HTTP hiện tại phản ánh ID nhiệm vụ của nó thông qua `Mcp-Name`- Tôi không biết.

## Chuyển nó

`outputs/skill-task-store-designer.md`hiện đang sản xuất một thiết kế có ý thức về mở rộng: đàm phán khả năng, tạo ra lâu dài trước khi trở lại, phương pháp hiện tại, dòng cập nhật đầu vào, sở hữu, hết hạn, hủy bỏ, đăng ký và di chuyển từ các phương pháp thử nghiệm đã bị xóa.

## Các bài tập

1. Thêm một khóa nhập còn lại.`tasks/update`và chứng minh nhiệm vụ vẫn còn.`input_required`cho đến khi hai khóa được trả lời.
2. Thêm quyền sở hữu của người thuê nhà vào cửa hàng và từ chối một ID nhiệm vụ hợp lệ được trình bày bởi người chủ sở hữu xác thực sai.
3. Thêm một hợp đồng thuê nhân viên khi hết hạn.
4. Thực hiện một bộ điều chỉnh SSE phản ứng POST cho `subscriptions/listen`. Không thêm GET, `Last-Event-ID`, hoặc một tiêu đề phiên.
5. Thêm thời hạn dọn dẹp. Nhận phân biệt một nhiệm vụ đã hết hạn từ một ID nhiệm vụ bị hình thành sai mà không rò rỉ sự tồn tại của người thuê nhà.

## Các điều khoản chính

| Term | Meaning in the current extension |
|------|----------------------------------|
| Tasks extension | Optional `io.modelcontextprotocol/tasks` capability for durable async work |
| `CreateTaskResult` | Server-directed `resultType: "task"` response to an eligible request |
| `tasks/get` | Poll a full current task snapshot, including terminal result or pending input |
| `tasks/update` | Submit responses to a task's outstanding `inputRequests` |
| `tasks/cancel` | Acknowledge cooperative cancellation intent |
| `input_required` | Task status indicating client input is outstanding |
| `pollIntervalMs` | Server-suggested minimum delay before another poll |
| `ttlMs` | Expiry duration measured from task creation |
| Durable-before-return | Rule that the task id must resolve before its handle is sent |
| `notifications/tasks` | Optional full task snapshot delivered on a subscribed SSE response |

## Sự tương thích của Legacy

Vùng thử nghiệm 2025-11-25 sử dụng việc tăng nhiệm vụ yêu cầu của khách hàng,`tasks/status`- `tasks/result`, và tùy chọn `tasks/list`. giữ những tên chỉ trong một bộ chuyển đổi cũ gắn. một khách hàng hiện tại sử dụng khả năng mở rộng, chấp nhận máy chủ hướng dẫn tay cầm, thăm dò `tasks/get`, cung cấp đầu vào với `tasks/update`, và đọc kết quả cuối cùng từ ảnh chụp nhanh của nhiệm vụ.

## Đọc thêm

- [Official MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
