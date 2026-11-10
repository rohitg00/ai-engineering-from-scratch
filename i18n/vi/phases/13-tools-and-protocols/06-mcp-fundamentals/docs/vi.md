# Các cơ bản của MCP: Các yêu cầu không có quốc tịch và JSON-RPC

> MCP hiện đại không có cú tay và không có phiên giao thức. Mỗi yêu cầu phải chứa đủ siêu dữ liệu để được hiểu, ủy quyền, định tuyến và thử lại một mình.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 01 through 05
**Time:** ~55 minutes

## Mục tiêu học tập

- Sự khác biệt giữa các tính năng máy chủ của MCP và các tính năng bên khách hàng.
- Xây dựng các yêu cầu và phản hồi JSON-RPC 2.0 hợp lệ cho MCP `2026-07-28`- Tôi không biết.
- Thêm phiên bản giao thức, khả năng của khách hàng và danh tính khách hàng vào mỗi yêu cầu.
- Sử dụng `server/discover`và xử lý `UnsupportedProtocolVersionError`Không bắt tay.
- Theo dõi một yêu cầu độc lập từ xác nhận thông qua kết quả hoàn chỉnh.

## Vấn đề

Một máy chủ MCP có thể nhận được hai yêu cầu liên tiếp từ các khách hàng khác nhau, với khả năng khác nhau, trên cùng một quy trình hoặc nhân viên HTTP. Nếu máy chủ nhớ những gì yêu cầu trước đó đã tuyên bố, nó có thể áp dụng các quyền sai hoặc trả lại hình dạng dây sai.

MCP `2026-07-28`Các máy chủ phải quyết định cách xử lý yêu cầu hiện tại từ yêu cầu hiện tại, chứ không phải từ lịch sử kết nối.

Điều này thay đổi mô hình tâm lý. chuỗi cũ là kết nối đầu tiên, bắt tay thứ hai, hoạt động thứ ba.

1. Khách hàng gửi một yêu cầu tự mô tả.
2. Máy chủ xác nhận phiên bản và khả năng của yêu cầu đó.
3. Máy chủ xử lý phương pháp.
4. Các máy chủ trả lại một kết quả nhập hoặc lỗi JSON-RPC.

Việc yêu cầu tiếp theo lặp lại quá trình tương tự từ đầu.

## Khái niệm

### Server nguyên thủy

Các máy chủ MCP phơi bày ba nguyên thủy chính:

1. **Tools**là các hành động được kiểm soát theo mô hình, được phát hiện với `tools/list`và được gọi là `tools/call`- Tôi không biết.
2. **Resources**là dữ liệu được định hướng bằng URI, được phát hiện với `resources/list`và lấy lại với `resources/read`- Tôi không biết.
3. **Prompts**là các mẫu có thể sử dụng lại, được phát hiện với `prompts/list`và được dịch là `prompts/get`- Tôi không biết.

Sối rễ, lấy mẫu và khai thác gỗ vẫn còn trong `2026-07-28`các chương trình tương thích, nhưng chúng đã bị lỗi thời. Các triển khai mới nên sử dụng công cụ hoặc nguồn lực nhập rõ ràng cho gốc, API trực tiếp của nhà cung cấp mô hình để lấy mẫu, và stderr hoặc OpenTelemetry để ghi nhật ký. Việc tạo ra vẫn có sẵn thông qua các yêu cầu nhiều lần đi vòng, nơi máy chủ trả lại yêu cầu nhập và khách hàng thử lại hoạt động ban đầu. Một máy chủ hiện đại không bao giờ khởi động yêu cầu JSON-RPC độc lập.

### Các phong bì JSON-RPC

MCP sử dụng JSON-RPC 2.0:

- `{jsonrpc, id, method, params}`
- Phản ứng: `{jsonrpc, id, result}`hoặc `{jsonrpc, id, error}`
- Thông báo: `{jsonrpc, method, params}`Không có `id`

`id`liên quan đến một phản ứng. Nó không tạo ra một phiên giao thức.

### Mét-đồ sơ yêu cầu cần thiết

Mỗi yêu cầu hiện đại đều mang theo một`_meta`vật bên trong `params`- Có thể là:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/list",
  "params": {
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

Phiên bản giao thức và khả năng của khách hàng là cần thiết. danh tính khách hàng được khuyến cáo. Đó là hiển thị tự báo cáo và dữ liệu gỡ lỗi, không phải giấy chứng nhận bảo mật.

Các máy chủ không được suy luận bất kỳ giá trị nào từ yêu cầu trước đó, một quy trình stdio, kết nối HTTP hoặc chỉ một tiêu đề giao thông.

### Kết quả hoàn chỉnh và danh tính máy chủ

Mỗi kết quả hiện đại thành công bao gồm:`resultType`Kết quả cuối cùng bình thường sử dụng`"complete"`Các máy chủ cũng nên tự xác định mình trong các metadata kết quả:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "resultType": "complete",
    "tools": [],
    "ttlMs": 30000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "notes-server",
        "version": "1.0.0"
      }
    }
  }
}
```

`tools/list`- `resources/list`- `prompts/list`- `resources/templates/list`- `resources/read`, và`server/discover`là kết quả có thể được lưu trữ.`ttlMs`và `cacheScope`Một sự cố định an toàn là`ttlMs: 0`và `cacheScope: "private"`. Các mục danh sách nên có thứ tự xác định để các phản ứng tương đương tạo ra các khóa cache ổn định và bối cảnh mô hình ổn định.

### Khám phá mà không cần bắt tay

Mỗi máy chủ hiện đại phải triển khai`server/discover`Khách hàng có thể gọi nó trước một phương pháp khác để lấy:

- `supportedVersions`
- máy chủ `capabilities`
- sử dụng tùy chọn `instructions`
- kết quả là tính xác thực của máy chủ `_meta`
- gợi ý cache

Khám phá là hữu ích, nhưng nó không phải là cổng.`tools/list`Thứ nhất, vì yêu cầu đó đã mang phiên bản và khả năng giao thức của nó.

Nếu phiên bản yêu cầu không được hỗ trợ, máy chủ sẽ trả lại mã JSON-RPC `-32022`với:

```json
{
  "requested": "2027-01-01",
  "supported": ["2026-07-28"]
}
```

Khách hàng chọn một phiên bản hiện đại hỗ trợ lẫn nhau và thử lại với một ID yêu cầu JSON-RPC mới.

### Một vòng đời yêu cầu

Theo dõi một yêu cầu hiện đại theo thứ tự này:

1. Phân tích một phong bì JSON-RPC.
2. Đảm bảo `jsonrpc`là `"2.0"`, một `id`tồn tại,`method`là một dây, và `params`là một đối tượng.
3. yêu cầu các chuỗi phiên bản và khả năng đối tượng trong `params._meta`; các metadata bị biến dạng hoặc thiếu là `-32602`- Tôi không biết.
4. Tại một ranh giới HTTP, so sánh phiên bản, phương pháp và tiêu đề tên áp dụng với cơ thể.`-32020`ngay cả khi một trong hai giá trị phiên bản không được hỗ trợ.
5. Sau khi bình đẳng được thiết lập, từ chối một phiên bản phù hợp nhưng không được hỗ trợ với `-32022`- Tôi không biết.
6. Kiểm tra khả năng cần thiết, sau đó đi đường bằng `method`và xác nhận các lập luận cụ thể về phương pháp.
7. Truy hiệu và ủy quyền cho hoạt động bê tông trước khi người xử lý nó chạy.
8. Trả lại kết quả đầy đủ với danh tính máy chủ.
9. Quên metadata giao thức theo yêu cầu.

Chỉ định đó ngăn cản hai thành phần giải thích các cuộc gọi khác nhau.`Mcp-Name: notes.read`trong khi nguồn gốc thực hiện `params.name: notes.delete`Nó cũng giữ nhập dạng sai, nhầm lẫn tiêu đề, đàm phán phiên bản, thất bại khả năng, ủy quyền và thất bại xử lý như bằng chứng rõ ràng.

Đóng stdin hoặc phản ứng HTTP chấm dứt hoạt động vận chuyển. Nó không chấm dứt phiên giao thức vì MCP hiện đại không có phiên giao thức.

### Sự tương thích rõ ràng của sản phẩm

Các phiên bản thông qua `2025-11-25`sử dụng `initialize`- `notifications/initialized`, khả năng kết nối và, trên Streamable HTTP trước đó, các phiên giao thức tùy chọn. Hành vi đó vẫn có liên quan khi một khách hàng hai thời đại nói chuyện với một máy chủ cũ.

Giữ các thời kỳ riêng biệt. Một yêu cầu hiện đại được xác định bằng các metadata yêu cầu theo yêu cầu. Một kết nối cũ chỉ được chọn thông qua con đường quay lại tài liệu. Không gửi `initialize`như là mặc định cho một `2026-07-28`máy chủ.

Tất nước  do đó có một ý nghĩa cụ thể của thời đại.`2026-07-28`, nó là một giao thức không thay đổi: mỗi yêu cầu thường tự do có thể giải thích và không có phiên bản MCP tồn tại.`2025-11-25`, khởi tạo và khả năng đàm phán thuộc về kết nối, vì vậy một bộ điều chỉnh tương thích có thể giữ lại trạng thái kết nối cũ. Một thực hiện hai thời đại không phải là một máy trạng thái cho phép. Nó là một lõi hiện đại không có quốc gia bên cạnh một bộ điều chỉnh cũ bị cô lập, với một quyết định lựa chọn rõ ràng trước khi cả hai bộ phân tích chạy.

Không có nghĩa nào cấm trạng thái ứng dụng bền vững. Một dòng công việc, nhiệm vụ hoặc bản thảo có thể sống sau một tay cầm không minh bạch trong một cửa hàng chung. Khách hàng gửi tay cầm đó như là đầu vào thông thường, và mỗi bản sao xác thực và ủy quyền sử dụng nó.

```figure
mcp-tool-call
```

## Sử dụng nó

`code/main.py`xây dựng, xác nhận, theo dõi và gửi tin nhắn MCP hiện đại mà không có khung.

```bash
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

Hãy xem xét ba biến số trong đầu ra:

- Mỗi yêu cầu đều lặp lại.`_meta`các cánh đồng.
- Mỗi kết quả thành công đều là`resultType: "complete"`và bao gồm danh tính máy chủ.
- Kết quả danh sách được sắp xếp theo định nghĩa và có gợi ý cache rõ ràng.

## Chuyển nó

Bài học này sẽ đi theo `outputs/skill-mcp-handshake-tracer.md`Tên tập tin lịch sử vẫn ổn định, nhưng hiện tại, vật phẩm này là một bộ theo dõi yêu cầu không có quốc gia. Nó kiểm tra từng tin nhắn một cách độc lập và chỉ dán nhãn lưu lượng truy cập bắt tay cũ khi nó thực sự hiện diện.

## Các bài tập

1. Thay đổi phiên bản giao thức của một yêu cầu thành `2027-01-01`- Đảm bảo mã lỗi là `-32022`và dữ liệu quảng cáo phiên bản được hỗ trợ.
2. Tắt `io.modelcontextprotocol/clientCapabilities`xác nhận máy chủ không sử dụng lại các khả năng từ yêu cầu đầu tiên.
3. Trở lại sổ đăng ký công cụ trong bộ nhớ.`tools/list`vẫn trả lại cùng một thứ tự xác định.
4. Thay đổi`cacheScope`từ `public`đến`private`Giải thích các bối cảnh ủy quyền nào có thể tái sử dụng phản ứng trong từng trường hợp.
5. Thêm tùy chọn `clientInfo`Thử nghiệm bỏ qua: yêu cầu này vẫn có giá trị vì danh tính khách hàng được khuyến cáo, không cần thiết.

## Các điều khoản chính

| Term | Meaning |
|------|---------|
| Stateless protocol | Every request supplies the metadata needed to interpret it |
| Request metadata | Version, client capabilities, and recommended client identity in `params._meta` |
| `server/discover` | Mandatory server method for versions, capabilities, instructions, and identity |
| `resultType` | Discriminator on every successful modern result |
| Cacheable result | Result that includes required `ttlMs` and `cacheScope` hints |
| Protocol era | Modern per-request metadata or legacy connection-scoped initialization |
| Transport lifetime | Process, connection, or response-stream lifetime, not protocol session state |
| `-32022` | Unsupported protocol version error with requested and supported versions |

## Đọc thêm

- [MCP Architecture](https://modelcontextprotocol.io/specification/2026-07-28/architecture)
- [MCP Base Protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP 2026-07-28 Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
