# MCP Transport: stdio và Stateless Streamable HTTP

> Transport mang thông điệp MCP. Nó không cung cấp trạng thái giao thức bị thiếu.`2026-07-28`, địa phương stdio và từ xa Streamable HTTP cả hai mang lại tự mô tả yêu cầu.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 07 and 08
**Time:** ~65 minutes

## Mục tiêu học tập

- Chọn stdio cho các quy trình trẻ em địa phương và Streamable HTTP cho các dịch vụ mạng.
- Thực hiện hợp đồng HTTP Streamable hiện đại chỉ có điểm cuối duy nhất, chỉ có POST.
- Nhìn và xác nhận phiên bản, phương pháp và tiêu đề tên MCP đối với cơ thể JSON-RPC.
- Chuyển giao SSE theo yêu cầu và lâu dài `subscriptions/listen`dòng chảy đúng cách.
- Chuyển các triển khai HTTP + SSE dựa trên phiên và di truyền mà không trình bày hành vi di truyền như hiện đại.

## Vấn đề

Các phiên bản HTTP Streamable trước đây kết hợp đàm phán giao thức với kết nối và hành vi phiên.`Mcp-Session-Id`, phơi bày một dòng GET độc lập, chấp nhận DELETE để chấm dứt phiên, và tiếp tục SSE với `Last-Event-ID`- Tôi không biết.

MCP `2026-07-28`Các tiêu đề HTTP phản chiếu các trường hợp được chọn để định tuyến và chính sách, nhưng máy chủ xác nhận các tiêu đề đó chống lại cơ thể trước khi thực hiện.

Kết quả dễ dàng hơn để mở rộng và dễ hơn để lý luận về. Nó cũng có nghĩa là một máy chủ dạy giao thông 2025 như hiện tại đang dạy sai lầm và mô hình bảo mật.

## Khái niệm

### studio

Việc liên kết stdio là cho một quá trình phụ được khởi động bởi khách hàng:

- Khách hàng viết một tin nhắn UTF-8 JSON-RPC cho mỗi dòng cho stdin.
- Server viết một tin nhắn UTF-8 JSON-RPC mỗi dòng cho stdout.
- Server viết chẩn đoán cho STDERR.
- Máy chủ sẽ nhanh chóng thoát khỏi Stdin EOF.
- Mỗi yêu cầu hiện đại đều có phiên bản và khả năng của khách hàng trong `params._meta`- Tôi không biết.

Quá trình này có thể hoạt động cho nhiều cuộc gọi, nhưng nó không phải là một phiên giao thức hiện đại. Nếu nó thoát khỏi bất ngờ, các yêu cầu trong chuyến bay sẽ bị mất. Bắt đầu lại quá trình, khám phá lại, tái đăng ký, mở lại đăng ký và thử lại các hoạt động an toàn với các ID yêu cầu mới.

### HTTP được phát trực tuyến vào năm 2026-07-28

Một máy chủ hiện đại cho thấy một điểm cuối MCP, chẳng hạn như `/mcp`, đó là chấp nhận POST.

Mỗi yêu cầu hoặc thông báo JSON-RPC là một POST HTTP mới. Cơ thể chứa một tin nhắn JSON-RPC. Khách hàng không gửi phản hồi JSON-RPC đến máy chủ.

Đối với yêu cầu, máy chủ trả lại:

- `Content-Type: application/json`với một phản ứng JSON-RPC; hoặc
- `Content-Type: text/event-stream`Thông báo liên quan đến yêu cầu đó, tiếp theo là phản hồi cuối cùng của JSON-RPC.

Đối với một thông báo được chấp nhận, máy chủ trả lại `202 Accepted`Không có xác.

Khách hàng quảng cáo cả hai loại phản ứng:

```http
Accept: application/json, text/event-stream
```

### Chỉ có POST nghĩa là chỉ có POST

HTTP Streamable hiện đại không có dòng GET độc lập và không có điểm cuối phiên DELETE.

- `GET /mcp`trả lại `405 Method Not Allowed`- Tôi không biết.
- `DELETE /mcp`trả lại `405 Method Not Allowed`- Tôi không biết.
- `Mcp-Session-Id`được bỏ qua và không bao giờ được ghi lại hoặc lặp lại.
- `Last-Event-ID`được bỏ qua bởi vì các dòng hiện đại không thể tiếp tục.

Nếu một dòng yêu cầu được mở rộng bị phá vỡ trước khi phản hồi cuối cùng của nó, khách hàng đã mất yêu cầu trong chuyến bay. Nó có thể phát hành một yêu cầu mới với một ID JSON-RPC mới khi thử lại an toàn. Nó không được cố gắng nối lại dòng.

### Kiểm tra nguồn gốc

Các máy chủ xác nhận`Origin`trên các kết nối tiếp vào để ngăn chặn kết nối lại DNS. Nếu tiêu đề có mặt và không được phép rõ ràng, trả lại `403 Forbidden`. Một khách hàng không phải trình duyệt có thể bỏ qua `Origin`, như quy định vận tải chính thức cho phép.

Các máy chủ địa phương nên liên kết với `127.0.0.1`Các dịch vụ mạng vẫn cần xác thực và ủy quyền trên mọi yêu cầu.

Sử dụng sự phù hợp chính xác nguồn gốc sau cấu hình theo quy định.`origin.startswith("https://trusted.example")`là không an toàn vì chúng có thể chấp nhận hậu tố được kiểm soát bởi kẻ tấn công.

### Các tiêu đề siêu dữ liệu HTTP cần thiết

Mỗi yêu cầu POST hiện đại bao gồm:

```http
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes_search
```

Quy tắc tiêu đề:

- `MCP-Protocol-Version`được yêu cầu và phải bằng `params._meta.io.modelcontextprotocol/protocolVersion`- Tôi không biết.
- `Mcp-Method`được yêu cầu và phải bằng với JSON-RPC `method`- Tôi không biết.
- `Mcp-Name`được yêu cầu cho `tools/call`- `resources/read`, và`prompts/get`- Tôi không biết.
- `Mcp-Name`=`params.name`, hoặc`params.uri`cho `resources/read`- Tôi không biết.
- Giá trị tiêu đề là nhạy cảm với trường hợp mặc dù tên tiêu đề là không nhạy cảm với trường hợp.

Không an toàn hoặc không phải ASCII `Mcp-Name`các giá trị sử dụng UTF-8 Base64 Sentinel chính xác:

```text
=?base64?{Base64EncodedValue}?=
```

Máy chủ giải mã giá trị đó trước khi so sánh nó với cơ thể.

Các tiêu đề gương bị mất tích, sai dạng hoặc không phù hợp trả về HTTP `400`với mã JSON-RPC `-32020`Nếu tiêu đề và cơ thể đồng ý về một phiên bản mà máy chủ không hỗ trợ, trả về HTTP `400`với `-32022`và dữ liệu lỗi chính xác như `{"supported":["2026-07-28"],"requested":"2027-01-01"}`- Tôi không biết.

Một phương pháp hiện đại không rõ ràng trả về HTTP `404`với JSON-RPC `-32601`Cơ thể JSON-RPC quan trọng vì một khách hàng hai thời đại sử dụng nó để phân biệt lỗi hiện đại từ lỗi điểm cuối cũ.

### SSE theo yêu cầu

Một máy chủ có thể chọn SSE cho một yêu cầu lâu dài:

```text
POST tools/call id=41
  <- notifications/progress related to id=41
  <- notifications/progress related to id=41
  <- JSON-RPC response id=41
stream closes
```

Các máy chủ không được gửi các yêu cầu JSON-RPC độc lập trên dòng này. Các tương tác lấy mẫu, kích hoạt và gốc sử dụng kết quả yêu cầu nhiều lần.

Đừng thêm ID sự kiện SSE để chơi lại. `Last-Event-ID`Việc tái lập không phải là một phần của phiên bản hiện đại.

### Những thay đổi lâu dài sử dụng đăng ký / nghe

Thông báo thay đổi sử dụng yêu cầu mở bởi khách hàng, không phải là GET độc lập:

```json
{
  "jsonrpc": "2.0",
  "id": "listen-1",
  "method": "subscriptions/listen",
  "params": {
    "notifications": {
      "toolsListChanged": true,
      "resourceSubscriptions": ["notes://note-1"]
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      }
    }
  }
}
```

Phản ứng POST là một dòng SSE lâu đời.`notifications/subscriptions/acknowledged`- Việc xác nhận, mọi thông báo thay đổi và kết quả cuối cùng mang theo`io.modelcontextprotocol/subscriptionId`trong `_meta`, bằng với ID yêu cầu nghe. Server có thể phát ra các bình luận SSE như là các lưu trữ. Khi dòng chảy giảm, client phát lại `subscriptions/listen`với một ID yêu cầu mới và sửa đổi dữ liệu bị ảnh hưởng.

`resources/subscribe`và `resources/unsubscribe`Không được sử dụng trong một kết nối hiện đại.

### Tình trạng ứng dụng rõ ràng

Xóa các phiên giao thức không cấm các dòng công việc với trạng thái. máy chủ có thể đúc một tay cầm trạng thái không minh bạch và trả lại nó như một kết quả công cụ bình thường.

Kết nối tay với nguyên tắc xác thực, làm cho chúng không thể kiểm tra được, hết hạn và cho phép mọi sử dụng. Điều này làm cho trạng thái hiển thị ở lớp ứng dụng thay vì giấu nó trong mối liên hệ vận tải.

Sự cố do trạng thái sao chép ẩn gây ra là cơ học:

1. Đơn xin A đạt đến bản sao 1 và tạo ra một bản thảo trong bộ nhớ của quá trình đó.
2. Câu trả lời không trả lại một bản thảo vì việc thực hiện cho rằng kết nối xác định bản thảo.
3. Yêu cầu B là một POST mới và đạt đến bản sao 2.
4. Replica 2 có metadata giao thức hợp lệ nhưng không có cách để đặt tên hoặc tải bản thảo, do đó workflow thất bại hoặc đọc sai đối tượng địa phương.
5. Đường dẫn dính dường như sửa chữa triệu chứng cho đến khi khởi động lại, triển khai, lên lịch lại hoặc không chạy đến yêu cầu tiếp theo.

Biên giới đúng có hai phần. Bối cảnh giao thức vẫn ở trong mỗi yêu cầu. Tình trạng ứng dụng bền vững sống trong một cửa hàng chung dưới một tay cầm được máy chủ ghi lại cho khách hàng. Cuộc gọi tiếp theo cung cấp các xử lý, bất kỳ bản sao nào tải cùng một bản ghi, và ủy quyền liên kết bản ghi với chủ sở hữu và người thuê nhà xác thực. Khoản nhớ sao chép có thể lưu trữ một bản ghi, nhưng nó không thể là bản sao duy nhất cần thiết để chính xác.

Chọn cơ chế trạng thái theo thời gian sống. Các biến yêu cầu địa phương có thể phục vụ một cuộc gọi. Một tiếp tục MRTR ngắn có thể sử dụng bảo vệ tính toàn vẹn `requestState`Một bản thảo hoặc nhiệm vụ lâu dài cần một xử lý rõ ràng cộng với sự kiên trì, hết hạn, kiểm soát đồng thời và tính không có khả năng.

### HTTP tương thích hai thời đại

Một client hỗ trợ các máy chủ hiện đại và cũ thử một POST hiện đại trước. Nếu nó nhận HTTP `400`- `404`, hoặc`405`, kiểm tra cơ thể:

- Một lỗi JSON-RPC hiện đại được công nhận chứng minh máy chủ là hiện đại.
- Một cơ thể trống hoặc một phản ứng không được nhận ra có thể chỉ ra một máy chủ HTTP + SSE cũ. Chỉ sau đó thử điểm cuối GET cũ và mong đợi sự thừa kế của nó `endpoint`sự kiện.

Một máy chủ có thể hỗ trợ cả hai thời đại trong quá trình di chuyển bằng cách định tuyến metadata hiện đại đến thực hiện POST hiện đại và giữ lại các điểm cuối di sản riêng biệt cho các khách hàng cũ.`2026-07-28`- Tôi không biết.

```figure
tp-transport-handshake
```

## Sử dụng nó

`code/main.py`thực hiện một máy chủ HTTP Streamable hiện đại và hữu hạn với thư viện tiêu chuẩn Python. Nó xác nhận nguồn gốc và tiêu đề gương, bỏ qua tiêu đề phiên họp bị xóa, trả về JSON cho các cuộc gọi bình thường, và chứng minh một tiêu đề hữu hạn `subscriptions/listen`SSE dòng chảy.

```bash
cd code
python3 main.py --probe
npx tsx main.ts --probe
python3 -m unittest discover tests -v
```

Chuyến thăm dò kiểm tra:

- Nguồn gốc không hợp lệ bị từ chối;
- phát hiện thành công mà không có ID phiên;
- `Mcp-Session-Id`và `Last-Event-ID`bị phớt lờ;
- Header không phù hợp trả lại `-32020`-
- trả lại phiên bản không hỗ trợ `-32022`chính xác`supported`và `requested`dữ liệu;
- một thông báo không có id được chấp nhận trả về HTTP `202`Không có cơ thể;
- GET và DELETE return `405`-
- `subscriptions/listen`là một dòng phản hồi POST mà xác nhận, thông báo và kết quả cuối cùng của nó mang theo ID đăng ký của nó.

## Chuyển nó

Bài học này sẽ đi theo `outputs/skill-mcp-transport-migrator.md`Nó loại bỏ các phiên giao thức hiện đại, thêm xác nhận header-body, thay thế GET độc lập với `subscriptions/listen`, và giữ bất kỳ cây cầu di sản rõ ràng tách biệt.

## Các bài tập

1. Tắt `Mcp-Method`từ một POST. xác nhận HTTP `400`và lỗi `-32020`- Tôi không biết.
2. Gửi phiên bản tiêu đề và thân xác phù hợp `2027-01-01`. Tiếp tục xác nhận HTTP `400`, lỗi `-32022`, và dữ liệu chính xác `{"supported":["2026-07-28"],"requested":"2027-01-01"}`- Tôi không biết.
3. Hãy gửi một lính canh Base64`Mcp-Name`cho một URI tài nguyên không phải ASCII. xác nhận giá trị được giải mã được so sánh với `params.uri`- Tôi không biết.
4. Phá vỡ dòng nghe hữu hạn trước khi phản ứng cuối cùng của nó, phát hành lại với một ID JSON-RPC mới và công cụ chỉnh sửa lại.
5. Thêm một tay cầm dòng công việc rõ ràng vào công cụ ping. Kết nối nó với một đối tượng ủy quyền mà không sử dụng liên kết.

## Các điều khoản chính

| Term | Meaning |
|------|---------|
| stdio | Newline-delimited JSON-RPC over a client-launched subprocess |
| Streamable HTTP | Single endpoint where each modern message is a new POST |
| Request-scoped SSE | POST response stream containing related notifications and final response |
| `subscriptions/listen` | Long-lived POST request for opted-in change notifications |
| Header mismatch | HTTP `400` and JSON-RPC `-32020` when mirrored headers disagree with body |
| Origin validation | DNS-rebinding defense for incoming connections, not authentication |
| Explicit state handle | Application token passed as an ordinary argument instead of hidden session state |
| Legacy bridge | Separate earlier-era behavior kept only for compatibility |

## Đọc thêm

- [MCP Transport Overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [MCP 2026-07-28 Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
