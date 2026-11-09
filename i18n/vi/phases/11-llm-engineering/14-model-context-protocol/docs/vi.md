# Mô hình giao thức ngữ cảnh (MCP)

> MCP cung cấp cho một máy chủ AI một giao thức để phát hiện và gọi các công cụ, tài nguyên và lời nhắc. Bản sửa đổi 2026-07-28 làm cho giao thức đó không có quốc gia: khả năng và ngữ cảnh phiên bản đi cùng với mọi yêu cầu, không phải trong một cú tay liên kết.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 03 (Structured Outputs)
**Time:** ~75 minutes

## Mục tiêu học tập

- Sự khác biệt giữa máy chủ, khách hàng, máy chủ, vận tải và máy chủ nguyên thủy của MCP.
- Xây dựng yêu cầu JSON-RPC với các metadata được yêu cầu bởi MCP 2026-07-28.
- Sử dụng `server/discover`để kiểm tra phiên bản, danh tính và khả năng.
- Tới lại các kết quả được gõ và lưu trữ cache từ các công cụ, tài nguyên và lời nhắc.
- Giải thích cách MCP không nhà nước hiện đại tương tác với các máy chủ thời đại bắt tay.
- Chọn trạng thái an toàn, vận chuyển và giới hạn chấp thuận cho máy chủ.

## Vấn đề

Ứng dụng của bạn cần một truy vấn cơ sở dữ liệu, một hoạt động lịch và một trình đọc tập tin. Không có giao thức chia sẻ, mỗi máy chủ AI cần phát hiện tùy chỉnh, gọi, lỗi, vận chuyển và dán ủy quyền cho các khả năng tương tự.

MCP làm giảm khối tích hợp đó. Một máy chủ xuất bản một bề mặt JSON-RPC tiêu chuẩn. Một khách hàng tuân thủ có thể phát hiện bề mặt, trình bày nó cho một mô hình hoặc người dùng, gọi nó và giải thích kết quả mà không cần một bộ điều chỉnh cụ thể cho máy chủ.

MCP tiêu chuẩn hóa giao tiếp. Nó không quyết định công cụ nào mô hình nên gọi, làm cho nội dung không đáng tin cậy an toàn, hoặc biến yêu cầu không có quốc gia thành trạng thái ứng dụng bền vững.

## Khái niệm

![MCP host, stateless request, and server primitives](../assets/mcp-architecture.svg)

### Ba bộ máy chủ nguyên thủy

1. **Tools**Mỗi công cụ có tên, mô tả, đầu vào JSON Schema và trình xử lý.
2. **Resources**được đặt tên, nội dung được định hướng bằng URI mà khách hàng có thể đọc.
3. **Prompts**là các mẫu có thể sử dụng lại mà một máy chủ có thể phơi bày cho người dùng.

Host là ứng dụng AI. Một client MCP bên trong host đó nói chuyện với một máy chủ. Transport mang các tin nhắn JSON-RPC giữa chúng.

### Các yêu cầu không quốc tịch thay thế sự bắt tay

MCP 2026-07-28 được gỡ bỏ `initialize`và `notifications/initialized`Nó cũng loại bỏ các phiên cấp giao thức.`params._meta`- Có thể là:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

Phiên bản giao thức và khả năng của khách hàng là cần thiết.`_meta`, một trường yêu cầu bị thiếu, hoặc một trường yêu cầu với loại sai bị hình thành sai và trả về Params không hợp lệ (`-32602`). Một chuỗi phiên bản được hình thành tốt mà máy chủ không hỗ trợ trả về `UnsupportedProtocolVersionError`(`-32022`Một máy chủ có thể xử lý yêu cầu hợp lệ mà không cần thu hồi hồ sơ đàm phán trước đó.

Không có quốc tịch không có nghĩa là một ứng dụng không bao giờ có thể duy trì trạng thái.`Mcp-Session-Id`Nếu một dòng công việc cần sự liên tục, máy chủ tạo ra một tay cầm không minh bạch và khách hàng thông qua tay cầm đó như một lập luận công cụ thông thường trong các cuộc gọi sau đó.

### Phát hiện và lựa chọn phiên bản

Mỗi máy chủ hiện đại thực hiện `server/discover`Kết quả quảng cáo các phiên bản, khả năng và danh tính máy chủ được hỗ trợ:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "ttlMs": 3600000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "demo-server",
        "version": "1.0.0"
      }
    }
  }
}
```

Một client có thể gọi một phương pháp khác trực tiếp và xử lý lỗi phiên bản, nhưng phát hiện làm cho khả năng hiển thị và lựa chọn phiên bản rõ ràng. Một phiên bản không được hỗ trợ sẽ trả về `UnsupportedProtocolVersionError`với mã `-32022`. Dữ liệu của nó chứa`supported`, một loạt các phiên bản sửa đổi máy chủ, và `requested`, sửa đổi bị bác bỏ.

Trên đài phát thanh, một khách hàng hai thời đại thăm dò với `server/discover`Một kết quả phát hiện hoặc một lỗi hiện đại được công nhận như`UnsupportedProtocolVersionError`Bất kỳ lỗi hoặc thời gian không được công nhận là hiện đại cho phép quay lại vào năm 2025-11-25`initialize`Hành vi thừa kế là mã tương thích, không phải là mặc định hiện đại.

### Kết quả rõ ràng

Mỗi kết quả hạt nhân năm 2026-07-28 đều có`resultType`- Có thể là:

- `complete`nghĩa là hoạt động đã kết thúc.
- `input_required`nghĩa là máy chủ cần một chuyến đi trở lại khác thông qua các mẫu yêu cầu nhiều chuyến đi trở lại.`tools/call`- `resources/read`, hoặc`prompts/get`- Tôi không biết.

Khách hàng phải xử lý kết quả thừa kế mà bỏ qua `resultType`hoàn chỉnh.

Các máy chủ nên bao gồm `io.modelcontextprotocol/serverInfo`trong mọi kết quả `_meta`. danh tính này tự báo cáo và là cho hiển thị, ghi nhật ký và gỡ lỗi, không phải cho các quyết định an ninh.

Danh sách và kết quả đọc cũng mang theo `ttlMs`và `cacheScope`Một người xác định`tools/list`Order cộng với một gợi ý tươi mới cho phép khách hàng lưu trữ phát hiện an toàn và cải thiện sự ổn định của prompt-cache. `cacheScope: public`cho phép lưu trữ cache chung; `private`giới hạn việc tái sử dụng vào bối cảnh gọi.

### Phương thức dây và vận chuyển

MCP sử dụng JSON-RPC 2.0 qua stdio hoặc Streamable HTTP.

- Một yêu cầu đã`jsonrpc`- `id`- `method`, và`params`- Tôi không biết.
- Một câu trả lời có sự phù hợp `id`và cả hai `result`hoặc `error`- Tôi không biết.
- Thông báo không có `id`và không mong đợi phản hồi.

Modern Streamable HTTP cho thấy một điểm cuối chấp nhận POST. Mỗi tin nhắn JSON-RPC nhận được POST riêng của mình. Một POST yêu cầu nhận được một đối tượng JSON hoặc một dòng các sự kiện Server-Send được yêu cầu kết thúc với phản ứng cuối cùng. Một POST thông báo được chấp nhận nhận nhận HTTP 202 mà không có cơ thể phản ứng; sửa đổi cốt lõi này không xác định các thông báo client-to-server trên Streamable HTTP.

Không có MCP GET tự động, DELETE session endpoint, `Mcp-Session-Id`, hoặc`Last-Event-ID`Lần này sẽ được thực hiện vào ngày 27-028.`subscriptions/listen`POST mà phản ứng vẫn mở như một dòng SSE.

### Nhập khách hàng mà không có yêu cầu do máy chủ khởi động

Các phiên bản cũ cho phép máy chủ gửi yêu cầu như `sampling/createMessage`- `roots/list`, hoặc`elicitation/create`trên một dòng chảy. giao thức hiện tại sử dụng nhiều yêu cầu đi vòng thay thế. Một cuộc gọi công cụ đủ điều kiện, đọc tài nguyên, hoặc yêu cầu nhận trả lại `resultType: input_required`với ít nhất một trong `inputRequests`hoặc `requestState`. Khách hàng thu thập bất kỳ thông tin nhập được yêu cầu, thử lại phương pháp ban đầu với một ID JSON-RPC mới và tương ứng `inputResponses`, và phản ứng chính xác`requestState`Khi được cung cấp.`inputRequests`Nếu có mặt, thử lại sẽ bỏ qua.`inputResponses`- Tôi không biết.

Roots, Sampling và Logging vẫn hoạt động nhưng đã lỗi thời, vì vậy các thực hiện mới không nên áp dụng chúng.`inputRequests`, không bao giờ như yêu cầu JSON-RPC độc lập từ máy chủ đến khách hàng. Ưu tiên các tham số tệp hoặc thư mục rõ ràng, URI tài nguyên, cấu hình máy chủ và tích hợp trực tiếp với nhà cung cấp mô hình. Sử dụng stderr cho chẩn đoán studio và OpenTelemetry cho định đo điện thoại sản xuất.

```figure
mcp-nxm-collapse
```

## Hãy xây dựng nó

### Bước 1: đăng ký bề mặt máy chủ

Việc đăng ký vẫn đơn giản mặc dù hợp đồng yêu cầu đã thay đổi:

```python
server = MCPServer("demo-server")

@server.tool(
    "add",
    "Add two integers.",
    {
        "type": "object",
        "properties": {
            "a": {"type": "integer"},
            "b": {"type": "integer"}
        },
        "required": ["a", "b"]
    }
)
def add(a: int, b: int) -> dict:
    return {"sum": a + b}
```

Việc thực hiện được vận chuyển vào năm`code/main.py`Nó cố ý sử dụng thư viện tiêu chuẩn để bạn có thể xem mỗi phong bì thay vì ủy quyền giao thức cho một SDK.

### Bước 2: Lắp metadata vào mỗi yêu cầu

```python
def request(method, params=None):
    body_params = dict(params or {})
    body_params["_meta"] = {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {
            "name": "demo-client",
            "version": "1.0.0"
        }
    }
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": body_params
    }
```

Đừng lưu trữ siêu dữ liệu này chỉ trong một đối tượng kết nối.

### Bước 3: tùy chọn tìm thấy trước khi liệt kê

Gọi`server/discover`, chọn một phiên bản được hỗ trợ, sau đó gọi `tools/list`- Một cái trực tiếp`tools/list`cũng có giá trị nếu bạn đã biết phiên bản và có thể xử lý `-32022`- Tôi không biết.

Demos trả lại danh sách công cụ theo thứ tự tên và gắn `ttlMs`- `cacheScope`- `resultType`Một cuộc gọi công cụ trả về một kết quả hoàn chỉnh, không thể lưu trữ bởi vì đầu ra của nó có thể phụ thuộc vào trạng thái hiện tại.

### Bước 4: lập bản đồ yêu cầu tương tự cho HTTP

Một máy điều khiển từ xa`tools/call`POST bao gồm các tiêu đề phản ánh cơ thể JSON-RPC:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: add
```

- `MCP-Protocol-Version`tiêu đề phải phù hợp với phiên bản trong `_meta`- `Mcp-Method`được yêu cầu trong mỗi yêu cầu JSON-RPC và phải phù hợp `method`- `Mcp-Name`chỉ cần để `tools/call`- `resources/read`, và`prompts/get`, nơi nó phải phù hợp với tên công cụ, URI tài nguyên, hoặc tên prompt. Một tiêu đề yêu cầu bị thiếu hoặc không phù hợp trả về HTTP 400 với `HeaderMismatch`mã `-32020`- Tôi không biết.

### Bước 5: Thực hiện an toàn bên ngoài trạng thái giao thức

- Thiết lập quyền và khán giả trên mỗi yêu cầu HTTP.
- Kết nối các máy chủ địa phương với localhost và xác nhận `Origin`trên Streamable HTTP.
- Đánh dấu các công cụ đột biến với `destructiveHint: true`và yêu cầu sự chấp thuận của chủ nhà.
- Gửi thư mục và phạm vi tập tin một cách rõ ràng thay vì phụ thuộc vào Roots lỗi thời.
- Chống lại các nguồn lực và công cụ xuất phát như dữ liệu không đáng tin cậy.
- Giữ stdout dành riêng cho JSON-RPC dưới stdio; viết chẩn đoán cho stderr.

## Sử dụng nó

Lấy bài học từ thư mục của nó:

```bash
python3 code/main.py
npx tsx code/main.ts
cd code
python3 -m unittest discover tests -v
```

Dòng đầu tiên nên báo cáo về phát hiện của `demo-server`trong giao thức `2026-07-28`- Sau đó kiểm tra`MCPClient.request`: nó tái tạo `_meta`để mỗi cuộc gọi. xóa metadata từ một yêu cầu và quan sát máy chủ từ chối nó.

## Chuyển nó

`outputs/skill-mcp-server-designer.md`biến một miền thành một thiết kế MCP không có quốc gia. Cổng chấp nhận của nó đòi hỏi một kết quả phát hiện, chính sách metadata theo yêu cầu, danh sách xác định cache-thành, xử lý trạng thái rõ ràng, tiêu đề giao thông, ủy quyền và quy tắc chấp thuận.

## Cứ tiếp tục MCP Deep Dive

Bài học này cho bạn mô hình giao thức. giai đoạn 13 biến bốn ranh giới sản xuất thành các bài học xây dựng và xác minh riêng biệt:

1. [MCP Tool Contracts and Content](../../../13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md)bao gồm các kế hoạch nhập đóng, nội dung có cấu trúc, chuyển giao metadata, trang không minh bạch, ủy quyền hoàn thành và sự khác biệt giữa các lỗi giao thức và miền công cụ.
2. [MCP Reliability, Cancellation, and Flow Control](../../../13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md)bao gồm hủy yêu cầu, hủy nhiệm vụ lâu dài, thời hạn, không có khả năng, áp lực ngược, bộ đệm ủy quyền và hành vi kết nối lại.
3. [MCP Registry Supply Chain, Admission, Drift, and Rollback](../../../13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md)bao gồm chứng minh không gian tên, nguồn gốc của vật thể, pin không thay đổi, drift live, trạng thái Registry, bằng chứng nhập học và rollback.
4. [MCP Conformance Engineering](../../../13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md)bao gồm các bản sao điện thoại vàng và âm, thời kỳ phiên bản nghiêm ngặt, các phân biệt SDK, bằng chứng đại diện, biên dịch, cổng sức khỏe và phát hành trở lại.

Theo dõi chúng theo thứ tự khi máy chủ sẽ vượt qua ranh giới nhóm hoặc tin tưởng. Cùng nhau họ chuyển từ  phương pháp hoạt động đến  hợp đồng vẫn an toàn và có thể chẩn đoán thông qua triển khai.

## Các bài tập

1. Thêm một `subtract`công cụ và xác nhận `tools/list`vẫn được sắp xếp theo bảng chữ cái.
2. Tắt khóa phiên bản giao thức và xác minh Params không hợp lệ (`-32602`Sau đó gửi phiên bản được hình thành tốt nhưng không được hỗ trợ `2025-11-25`, xác minh`-32022`, xác nhận`requested`echo đó sửa đổi, và chọn từ `supported`- Tôi không biết.
3. Thêm một máy chủ-minted `draftId`để tạo một hoạt động, sau đó yêu cầu nó như một lập luận để cập nhật. giải thích tại sao đó là trạng thái ứng dụng thay vì một phiên giao thức.
4. Trở lại`input_required`từ một công cụ cần xác nhận người dùng.`inputResponses`nhập, và chính xác `requestState`thay vì phát minh ra một yêu cầu JSON-RPC từ máy chủ đến khách hàng.
5. Chụp một khách hàng studio hai thời đại. Chế độ kết quả hoặc lỗi hiện đại được công nhận là hiện đại, và cho phép sự trở lại của `initialize`Chỉ vì một lỗi không được nhận ra hoặc thời gian nghỉ.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MCP | "Tool protocol for LLMs" | JSON-RPC protocol for server discovery, tools, resources, prompts, and extensions |
| Host | "The AI app" | Owns the model and UI and mounts one or more MCP clients |
| Client | "The connector" | Speaks MCP to one server on behalf of a host |
| Stateless MCP | "No session" | Every request carries version and capabilities; no protocol state is keyed by a connection |
| `server/discover` | "Capability probe" | Required server method advertising versions, capabilities, and identity |
| `resultType` | "Result state" | Marks a result as `complete` or `input_required` |
| State handle | "Workflow id" | Server-minted application identifier passed as an ordinary argument |
| Streamable HTTP | "Remote transport" | One POST endpoint with JSON or request-scoped SSE responses |
| MRTR | "Ask and retry" | Input request embedded in a result, followed by a retry of the original operation |

## Đọc thêm

- [MCP 2026-07-28 key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
