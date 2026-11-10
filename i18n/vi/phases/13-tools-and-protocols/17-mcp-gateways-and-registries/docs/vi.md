# Các cửa ngõ và đăng ký của MCP không quốc tịch

> Một cửa ngõ nên làm cho mọi tuyến đường rõ ràng. giao thức 2026-07-28 cho nó phương pháp, tên, phiên bản, khả năng, danh tính, kho lưu trữ và ranh giới theo dõi mà không cần một phiên giao thông.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 15 (security), Phase 13 · 16 (authorization)
**Time:** ~75 minutes

## Mục tiêu học tập

- Kết hợp một số máy chủ MCP sau một điểm cuối 2026-07-28 mà không có mối liên hệ phiên.
- Thiết lập metadata và tiêu đề định tuyến trước khi chính sách hoặc chuyển tiếp theo yêu cầu.
- Thủy hợp các công cụ với không gian tên ổn định, thứ tự xác định, pin mô tả, RBAC và lưu trữ trước tiên riêng.
- Hãy xem hồ sơ đăng ký là bằng chứng khám phá mà vẫn đòi hỏi chính sách nhập học.
- SSE theo yêu cầu đường, `subscriptions/listen`, MRTR thử lại, và nhiệm vụ mở rộng gọi đúng.
- Tránh tay cổ xưa và hỗ trợ phiên từ con đường hiện đại.

## Vấn đề

Kết nối một client trực tiếp với một máy chủ là đơn giản. Một triển khai lớn hơn cần một câu trả lời nhất quán cho các câu hỏi khó khăn hơn:

- Các máy chủ nào được phép?
- Giám đốc nào có thể nhìn thấy và gọi cho mỗi công cụ?
- Điều gì xảy ra khi hai người đứng sau cùng một tên?
- Những thay đổi mô tả được xem xét như thế nào?
- Các giới hạn lãi suất và các sự kiện kiểm toán được áp dụng ở đâu?
- Có trường hợp nào có thể xử lý yêu cầu tiếp theo không?

Một cửa ngõ nằm giữa các khách hàng và các máy chủ MCP hậu thuẫn. Nó trình bày một điểm cuối MCP, áp dụng chính sách xuyên ngành và chuyển các yêu cầu được phê duyệt.

Các thiết kế cổng thông tin cũ thường đa dạng một phiên khách hàng thành nhiều phiên cuối và viết lại `Mcp-Session-Id`Đó là một thiết kế tương thích cũ. lõi 2026-07-28 không có phiên giao thức.

## Khái niệm

### Đường lối vào hiện đại

Đối với mỗi yêu cầu:

1. Đăng bằng chính từ giấy phép vận chuyển.
2. Định hành`MCP-Protocol-Version`- `Mcp-Method`- `Mcp-Name`, và`params._meta`- Tôi không biết.
3. Quyền cho nguyên tắc, tài nguyên, phương pháp, công cụ và các lập luận.
4. Sử dụng mô tả, đăng ký, tỷ lệ và chính sách dữ liệu.
5. Tạo một yêu cầu tự do mới cho phần sau đã chọn.
6. Thiết lập kết quả hậu quả và trả lại kết quả gateway.
7. Lập lại một sự kiện kiểm toán mà không ghi lại bí mật.

Không có bước nào cần một phiên giao thức ẩn. trạng thái ứng dụng vẫn có thể tồn tại trong cơ sở dữ liệu, tay cụ thể, nhiệm vụ hoặc trạng thái MRTR được bảo vệ tính toàn vẹn.

### Chính sách thời gian chạy là quyết định đầu tiên của cửa ngõ

Đăng nhập quyết định phiên bản cuối cùng nào có thể nhập vào cổng thông tin. Nó không cho phép cuộc gọi trực tiếp. Đối với mỗi yêu cầu, cổng thông tin tính lại chính sách từ chính xác nhận, nhà phát hành và nguồn lực, thuê nhân, phương pháp và tên phù hợp, lập luận bình thường, pin mô tả được chấp nhận, sức khỏe cuối cùng hiện tại, giao diện khả năng, phân loại dữ liệu, trạng thái tỷ lệ và bất kỳ sự chấp thuận liên quan đến hành động nào.

Điều này quan trọng. Một hồ sơ Registry có thể vẫn hoạt động trong khi vai trò của người dùng bị hủy bỏ. Một mô tả có thể vẫn được gắn trong khi một lập luận đích vượt qua ranh giới người thuê nhà. Một hậu kết có thể vẫn được chấp thuận trong khi chính sách kiểm dịch xảy ra. Chính sách thời gian chạy do đó là quyết định chính cho phép hoặc từ chối, với Registry và chứng cứ mô tả như là đầu vào.

Đừng lưu trữ quyết định cho phép dưới một kết nối hoặc xóa định danh phiên. Nếu chính sách không có sẵn, hãy theo chính sách thất bại được tuyên bố theo lớp hoạt động. Một mặc định an toàn là không đóng cửa cho các thay đổi trạng thái và đọc nhạy cảm, trong khi các con đường đọc công khai được phê duyệt rõ ràng chỉ có thể sử dụng chính sách được biết đến cuối cùng ngắn ngủi khi mô hình rủi ro của họ cho phép. Lưu ý phiên bản chính sách nào và đường lối thất bại đã đưa ra quyết định, sau đó xác nhận kết quả hậu quả trước khi trả lại nó.

### Một điểm cuối POST

HTTP Streamable hiện đại gửi mỗi tin nhắn JSON-RPC qua POST:

```text
POST /mcp
Authorization: Bearer <gateway-token>
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.search
Accept: application/json, text/event-stream
```

Gateway có thể trả về JSON hoặc yêu cầu-scoped SSE cho POST đó. GET và DELETE trả lại 405 cho yêu cầu hiện đại. `Mcp-Session-Id`và `Last-Event-ID`không tạo ra quyền lực, mối quan hệ, hoặc lặp lại hành vi.

Các giá trị tiêu đề và cơ thể phải đồng ý.`-32020`Điều này cho phép bộ cân bằng tải, cửa khẩu và giới hạn tốc độ đi đường mà không cần phân tích toàn bộ cơ thể trong khi vẫn giữ được tính toàn vẹn đầu đến cuối.

Thiết lập bằng một thứ tự chính xác: JSON-RPC và các loại metadata, tiêu đề và cơ thể, sau đó hỗ trợ cho phiên bản phù hợp.`-32020`Nếu tiêu đề và cơ thể đồng ý về một phiên bản không được hỗ trợ, trả về HTTP 400 với `-32022`và `data`Đúng vậy.`{"supported":["2026-07-28"],"requested":"<actual>"}`. Một phương pháp không rõ trả về HTTP 404 với `-32601`- Tôi không biết.

`ProtocolError`mang theo tùy chọn `data`, và cửa cổng sẽ liên tục nó vào đối tượng lỗi JSON-RPC.`id`, vì vậy nó không bao giờ nhận được thành công hoặc lỗi JSON-RPC. Một thông báo HTTP được chấp nhận trả lại 202 với một cơ thể trống.

### Thực hiện phát hiện ở mọi lớp

Các thiết bị Gateway `server/discover`Nó cũng phát hiện ra mỗi backend để nó biết các phiên bản giao thức, khả năng và mở rộng.

Ví dụ kết quả gateway:

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {"listChanged": true}
  },
  "ttlMs": 30000,
  "cacheScope": "private",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "enterprise-gateway",
      "version": "2.0.0"
    }
  }
}
```

Chỉ quảng cáo giao thông khả năng mà cửa khẩu có thể tôn trọng từ đầu đến cuối. Một tính năng hậu thuẫn không tự động được tiết lộ an toàn. Một tính năng cửa khẩu không có đường hậu thuẫn không hữu ích để quảng cáo.

`serverInfo`là dữ liệu hiển thị và chẩn đoán tự báo cáo. Đừng sử dụng nó như chứng minh đăng ký hoặc nhà xuất bản.

### Khả năng của khách hàng theo yêu cầu

Mỗi yêu cầu được chuyển tiếp cần một hiện tại `_meta`bao bì:

```json
{
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": {
    "name": "enterprise-gateway",
    "version": "1.0.0"
  }
}
```

Đừng mù quáng các khả năng của khách hàng bên ngoài vào backend. Gateway là khách hàng của backend. Chỉ quảng cáo các tính năng của gateway sẽ trung gian đúng.

### Định nghĩa namespacing

Thủy lại các công cụ hậu môn dưới tên công khai ổn định:

```text
notes.search
notes.create
issues.list
issues.open
```

Hãy giữ bản đồ từ tên công cộng đến tên công cụ gốc và cuối cùng. Đừng bao giờ chọn vụ va chạm đầu tiên hoặc cuối cùng. Một tên công cộng là một phần của hợp đồng phê duyệt và kiểm toán, vì vậy thay đổi nó là một di chuyển.

`tools/list`Khi khả năng nhìn thấy khác nhau bởi chính, trả lại `cacheScope: private`- Một giới hạn`ttlMs`Giảm tải phát hiện hậu kết mà không cho phép danh sách cụ thể cho người dùng rò rỉ qua các bối cảnh ủy quyền.

Mỗi mô tả công cụ được phơi bày bao gồm một tên ổn định, mô tả và gốc đối tượng `inputSchema`. Namespacing không thể loại bỏ các trường mô tả yêu cầu. Kết quả danh sách đầy đủ cũng bao gồm `resultType`, dữ liệu siêu dạng máy chủ, và gợi ý cache.

### Các mô tả được chấp thuận bằng pin

Vào thời điểm nhập học, hãy ghi danh mô tả đầy đủ và lưu trữ bản ghi của nó dưới tên công khai đủ điều kiện.

Nếu nó thay đổi:

- Tắt nó ra khỏi `tools/list`- Tôi không biết.
- Khước từ các cuộc gọi trực tiếp.
- Đưa ra một sự kiện kiểm toán.
- Cần chính sách hoặc phê duyệt lại của con người trước khi cập nhật pin.

Một cửa cổng là một điểm thực thi trung tâm hữu ích, nhưng nó không biến một mô tả lần đầu tiên thấy thành một mô tả an toàn.

### Các hồ sơ giúp khám phá, không quyết định

Một sổ đăng ký`server.json`cung cấp dữ liệu siêu dữ liệu xuất bản. Một hồ sơ được hỗ trợ gói có thể trông như sau:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "com.example/notes",
  "description": "Example notes MCP server.",
  "version": "1.0.0",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@example/notes-mcp",
      "version": "1.0.0",
      "transport": {"type": "stdio"}
    }
  ]
}
```

Các metadata xuất bản không mang lại quyết định bảo mật của cổng thông tin.

```json
{
  "registryName": "com.example/notes",
  "registryVersion": "1.0.0",
  "publisher": {"namespace": "com.example", "status": "verified"},
  "provenance": {
    "source": "registry.modelcontextprotocol.io",
    "recordId": "com.example/notes@1.0.0"
  },
  "admission": {"status": "approved", "reviewedBy": "gateway-policy"}
}
```

Cổng kiểm tra `server.json`Và các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên của các thành viên.

Đối với mỗi backend được chấp nhận, ghi lại:

- Đồ đăng ký chính xác và ghi nhận.
- Các nhà xuất bản đã xác minh không gian tên hoặc bằng chứng tên miền.
- Chuyển và điểm cuối được phép.
- Phiên bản đinh hoặc chính sách nâng cấp được phê duyệt.
- Thiết bị tạo ra hoặc tiêu hóa mô tả.
- Nhà phát hành và nguồn tài nguyên.
- Đánh giá, thời gian phê duyệt, và hết hạn.

Đừng chấp nhận một máy chủ vì tên hiển thị của nó giống như một sản phẩm quen thuộc. Đừng coi sự hiện diện của registry như một đánh giá bảo mật hoạt động. Các máy chủ riêng có thể được nhập thông qua cùng một kế hoạch chứng minh ngay cả khi chúng không bao giờ xuất hiện trong một registry công cộng.

Bài học này thực hiện các cửa ngõ: kết hợp bằng chứng xuất bản với việc nhận địa phương trước khi một backend trở thành định tuyến. [Lesson 30: MCP Registry Supply Chain, Admission, Drift, and Rollback](../../30-mcp-registry-supply-chain-and-drift/docs/en.md)xây dựng toàn bộ máy điều khiển cho chứng minh không gian tên chính xác, nguồn gốc của vật thể, pin không thay đổi, dẫn dắt mô tả trực tiếp, hòa giải trạng thái Registry, sổ tay nhập cảnh rõ ràng và quay lại bằng chứng. Giữ trạng thái chuỗi cung ứng tách biệt với quyết định thời gian chạy theo yêu cầu ở trên.

### Trợ lý chứng nhận

Cổng thông tin xác thực người gọi và xác thực riêng cho backend.

Hãy giữ các ràng buộc này rõ ràng:

```text
outer principal -> gateway role and policy
backend issuer + resource -> backend registration and token
```

Không bao giờ chuyển token cổng bên ngoài cho một backend. Không bao giờ sử dụng lại token backend tại một nhà phát hành hoặc nguồn khác. Nếu một công cụ hoạt động thay mặt cho người dùng cuối, hãy bảo tồn ủy quyền đó bằng một mô hình trao đổi hoặc yêu cầu được thiết kế thay vì giả vờ người dùng với giấy chứng nhận dịch vụ chia sẻ.

### Các giới hạn tỷ lệ không có buổi

Các giới hạn chính theo chính xác nhận, nhà phát hành, tài nguyên, công cụ công cộng, lớp chi phí và cửa sổ thời gian.

Hãy kiểm tra giá rẻ trước khi tiêu thụ công việc đắt tiền.

### Kiểm tra chuỗi quyết định

Đăng đủ để tái tạo cuộc gọi:

- Đơn vị xác định yêu cầu và theo dõi.
- Chủ sở hữu và nhà phát hành xác thực
- Công cụ công cộng và đường dẫn hậu.
- Phiên bản pin mô tả.
- Quyết định chính sách và lý do.
- Lạt và lớp kết quả.
- MRTR vòng hoặc xác định nhiệm vụ khi có thể.

Các mã thông báo người mang thư, mã ủy quyền, mã thông báo mới, bí mật thô và các lập luận nhạy cảm không cần thiết.

### SSE theo yêu cầu

Một POST bình thường có thể trả lại SSE được yêu cầu khi workflows trong một yêu cầu đó.

Đừng tạo ra một dòng GET riêng biệt và không hứa hẹn lặp lại ID-Event cuối cùng.

### Thông báo thay đổi lâu dài

Đối với các thông báo thay đổi danh sách và tài nguyên, một khách hàng hiện tại gửi `subscriptions/listen`thông qua POST và nhận được một phản hồi của SSE.`toolsListChanged`- `promptsListChanged`- `resourcesListChanged`, và`resourceSubscriptions`- Có thể là:

```json
{
  "jsonrpc": "2.0",
  "id": "listen-tools",
  "method": "subscriptions/listen",
  "params": {
    "notifications": {
      "toolsListChanged": true
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

Sự kiện đầu tiên xác nhận bộ phụ được hỗ trợ. Biểu thức đăng ký của nó là ID JSON-RPC của yêu cầu mở dòng:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/subscriptions/acknowledged",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": "listen-tools"
    },
    "notifications": {
      "toolsListChanged": true
    }
  }
}
```

Các thông báo trên dòng đó đều mang cùng một `io.modelcontextprotocol/subscriptionId`trong `params._meta`Không có bản phát lại tự động hoặc nghe lại tự động. Khi kết nối lại, khách hàng mở lại đăng ký và làm mới các danh sách mà nó dựa vào. Một kết thúc thanh lịch được khởi động bởi máy chủ trả lại kết quả hoàn chỉnh cuối cùng được gắn thẻ với cùng một ID đăng ký.

Con đường hiện đại thay thế `resources/subscribe`- `resources/unsubscribe`, và không được yêu cầu tự động GET phát sóng.

### MRTR qua một cổng

Khi một phần sau quay lại `resultType: input_required`, gateway chỉ có thể chuyển kết quả đó nếu khách hàng bên ngoài hỗ trợ yêu cầu nhập cần thiết.`requestState`Byte cho byte trừ khi cổng thông tin cố tình chấm dứt và phát hành lại tương tác.

Khách hàng thử lại công cụ công cộng gốc với một ID JSON-RPC mới và `inputResponses`- Gateway cho phép lại thử nghiệm, kiểm tra cùng một tuyến đường công cộng, sau đó chuyển một yêu cầu hậu thuẫn mới.

### Nhiệm vụ định tuyến mở rộng

Các nhiệm vụ là một phần mở rộng chính thức được xác định bởi `io.modelcontextprotocol/tasks`Chúng không phải là một phiên bản thay thế.

Khách hàng tuyên bố mở rộng bên trong khả năng của khách hàng theo yêu cầu, và cổng thông tin quảng cáo nó trong khám phá chỉ khi nó có thể bảo tồn vòng đời cuối đến cuối.`tools/call`, backend chỉ quyết định liệu phải trả lại kết quả bình thường hay không`resultType: task`. Kết quả nhiệm vụ mang theo `taskId`- `status`, dấu thời gian,`ttlMs`, và tùy chọn `pollIntervalMs`Việc này phải được đọc lâu dài trước khi kết quả đó được gửi.

Gateway ghi lại đường chính và đường hậu xác thực cho công cụ xác định nhiệm vụ không rõ ràng.`tasks/get`- `tasks/update`, và`tasks/cancel`sử dụng cuộc gọi `params.taskId`như `Mcp-Name`, cho các trung gian một khóa định tuyến. `tasks/get`trả lại `resultType: complete`với trạng thái nhiệm vụ hiện tại và ghi kết quả cuối cùng hoặc lỗi giao thức trong trạng thái cuối cùng. `tasks/update`gửi khóa `inputResponses`cho sao nhập nhiệm vụ xuất hiện và trả lại một xác nhận hoàn chỉnh trống. `tasks/cancel`là một ý định hợp tác với một sự thừa nhận hoàn toàn trống rỗng, không phải là một đảm bảo rằng công việc sẽ dừng lại.

Không thực hiện mới `tasks/list`hoặc `tasks/result`Các phương pháp này thuộc về mô hình thử nghiệm cũ hơn. Một nhiệm vụ cần input cho thấy các yêu cầu nhúng hoàn chỉnh thông qua `tasks/get`; khách hàng trả lời thông qua họ `tasks/update`, không bằng cách thử lại cuộc gọi công cụ ban đầu. Khách hàng vẫn bỏ phiếu tại khoảng thời gian đề xuất; việc tạo nhiệm vụ vẫn được hướng đến máy chủ.

Durable task route state là dữ liệu ứng dụng được khóa bởi task handle, không phải là một phiên giao thức.

### Biên giới tương thích

Nếu cửa cổng phải phục vụ khách hàng cũ hoặc backend:

- Khám phá thời đại rõ ràng.
- Giữ khởi tạo, các phiên vận chuyển, GET stream, đăng ký tài nguyên và từ vựng nhiệm vụ cũ trong một bộ điều chỉnh di sản.
- Đừng bao giờ rò rỉ một ID phiên cũ vào định tuyến hoặc ủy quyền hiện đại.
- Tích thích một cuộc thăm dò khám phá giới hạn và chính sách phản hồi rõ ràng hơn là giảm cấp âm thầm.

```figure
t3-gateway-funnel
```

## Hãy xây dựng nó

`code/main.py`thực hiện một cổng thông tin giao thức trong quá trình và hai máy chủ hậu thuẫn. Mỗi cổng hậu thuẫn nhận được yêu cầu giao thức hiện tại mới. Cổng thông tin cung cấp khám phá, người dùng lọc xác định`tools/list`, định tuyến tên không gian, Registry `server.json`cộng với tình trạng nhập học bên ngoài, pin mô tả, RBAC, giới hạn lãi suất chính, quyết định kiểm toán và mô hình `subscriptions/listen`SSE xác nhận.

Mô hình nhận được các cơ quan yêu cầu được phân tích, tiêu đề định tuyến và một danh tính người mang xác thực. Nó không phải là một bộ điều chỉnh HTTP hoàn chỉnh và không phân tích `Content-Type`hoặc đầy đủ `Accept`kết nối nó với bộ chuyển đổi HTTP Streamable của bài học 09, đòi hỏi `Content-Type: application/json`và một `Accept`giá trị chứa cả hai `application/json`và `text/event-stream`- Tôi không biết.

Đi đi.

```bash
cd phases/13-tools-and-protocols/17-mcp-gateways-and-registries
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

Demo in ID yêu cầu bên ngoài và ID yêu cầu hậu kết mới để hop vô quốc gia được nhìn thấy.

## Sử dụng nó

Thay thế các đối tượng hậu kết trong quá trình bằng các client giao thức hiện tại thực. Giữ các bộ phận giống nhau:

- Hồ sơ nhập học trước khi kết nối.
- Khám phá hậu cảnh trước khi tiếp xúc khả năng.
- Tên công khai đủ điều kiện trước khi được cấp phép.
- Pin mô tả trước khi danh sách hoặc gọi.
- Mét-đồ sơ mới theo yêu cầu trước khi chuyển tiếp.
- Kết quả xác nhận trước khi quay lại.

## Chuyển nó

Bài học này sẽ đi theo `outputs/skill-gateway-bootstrap.md`Nó tạo ra một thiết kế cổng thông tin hiện đại bao gồm nhập cảnh, khám phá, nhập cảnh, không gian tên, ủy quyền, lưu trữ trước, phát trực tuyến, đăng ký, MRTR, nhiệm vụ, khả năng quan sát và cách ly cũ.

## Các bài tập

1. Thêm bối cảnh theo dõi vào metadata yêu cầu bên ngoài và chuyển tiếp và ghi lại mối tương quan trong sự kiện kiểm toán.
2. Thêm một Backend và đường dẫn có khả năng nhiệm vụ `tasks/get`theo task id trong `Mcp-Name`- Tôi không biết.
3. Thay đổi một mô tả hậu kết và chứng minh cả phát hiện và cuộc gọi trực tiếp đều bị chặn.
4. Thêm một khả năng máy chủ cụ thể về nguyên tắc và giải thích tại sao phát hiện phải được lưu trữ trong bộ nhớ cache riêng tư.
5. Tạo một giao diện bộ chuyển đổi cũ mà không cần thêm bất kỳ trạng thái cũ nào vào hiện đại `Gateway`lớp học.

## Các điều khoản chính

| Term | Meaning |
|------|---------|
| MCP gateway | Policy and routing server between clients and backend MCP servers |
| Admission record | Evidence and policy decision allowing one backend into the gateway |
| Qualified tool name | Stable public route such as `notes.search` |
| Descriptor pin | Approved digest checked during discovery and dispatch |
| Private cache scope | Cached result restricted to one authorization context |
| Request-scoped SSE | Streaming response attached to one POST request |
| `subscriptions/listen` | Client-opened SSE stream for selected long-lived change notifications |
| Task route | Application mapping from an opaque task id to its backend |
| Legacy adapter | Explicit version-gated boundary for old handshake and session behavior |

## Đọc thêm

- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [Official Registry server.json requirements](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md)
- [MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
