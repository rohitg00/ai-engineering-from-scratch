# Các ứng dụng MCP về Phòng thủ vô quốc tịch

> Kết quả tương tác vẫn là một công cụ MCP và trao đổi tài nguyên. lõi 2026-07-28 làm cho trao đổi đó tự chủ, trong khi phần mở rộng Apps thêm bề mặt trình duyệt sandboxed.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources)
**Time:** ~75 minutes

## Mục tiêu học tập

- Giao dịch các ứng dụng MCP thông qua `server/discover`và khả năng mở rộng theo yêu cầu.
- Thiết lập một `ui://`tài nguyên trên một công cụ trước khi công cụ được gọi.
- Trả lại kết quả công cụ và tài nguyên hoàn chỉnh trên dây vô quốc tịch 2026-07-28.
- Phân tách các ứng dụng `ui/initialize`thông điệp cầu từ cú tay của lõi MCP đã bị xóa.
- Sử dụng xác nhận nguồn gốc, sandboxing, CSP và quyền quyền ưu tiên tối thiểu.

## Vấn đề

Kết quả văn bản có thể mô tả một dòng thời gian. Nó không thể cung cấp cho người dùng một dòng thời gian mà họ có thể lọc, kiểm tra hoặc hành động theo.

MCP Apps giải quyết vấn đề trình bày bằng một phần mở rộng tùy chọn.`ui://`nguồn lực. Người chủ có thể lấy và xem xét nguồn tài nguyên đó trước khi công cụ chạy, render nó trong một iframe sandboxed, và trung gian tất cả các hành động ứng dụng thông qua một cây cầu JSON-RPC.

Các giao thức cốt lõi đã thay đổi vào năm 2026-07-28. Không bao bọc một ứng dụng trong vòng đời kết nối cũ:

- Không có lõi nào.`initialize`yêu cầu hoặc `notifications/initialized`thông báo.
- Không có `Mcp-Session-Id`đầu.
- Mỗi yêu cầu đều có phiên bản giao thức và khả năng của khách hàng trong `params._meta`- Tôi không biết.
- Một máy chủ thực hiện `server/discover`để khách hàng có thể kiểm tra phiên bản, khả năng cốt lõi và phần mở rộng.
- Mỗi kết quả thành công đều có một kết quả`resultType`phân biệt đối xử.
- Streamable HTTP sử dụng một POST mỗi yêu cầu. GET và DELETE hiện đại trả lại 405.

Cầu Apps vẫn có một phương pháp có tên `ui/initialize`Nó thuộc về phương ngữ iframe postMessage. Nó không tạo lại một phiên bản MCP cốt lõi.

## Khái niệm

### Hai giao thức, một tính năng

Giữ các lớp rõ ràng:

1. Các lõi MCP mang `server/discover`- `tools/list`- `tools/call`- `resources/list`, và`resources/read`- Tôi không biết.
2. MCP Apps mở rộng tuyên bố UI và xác định cầu iframe-to-host.
3. Các quy tắc hộp rác trình duyệt hạn chế những gì UI có thể đạt được.

Định dạng mở rộng là `io.modelcontextprotocol/ui`. Cả hai đồng nghiệp chọn tham gia. Một khách hàng gửi hỗ trợ mở rộng bên trong đối tượng khả năng với mỗi yêu cầu:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/ui": {}
        }
      },
      "io.modelcontextprotocol/clientInfo": {
        "name": "timeline-host",
        "version": "1.0.0"
      }
    }
  }
}
```

`clientInfo`được khuyến cáo để chẩn đoán. Đó là dữ liệu tự báo cáo, không phải là một danh tính ủy quyền.

### Khám phá trước khi chuyển đổi

Kết quả phát hiện của máy chủ quảng cáo mở rộng:

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {},
    "resources": {},
    "extensions": {
      "io.modelcontextprotocol/ui": {}
    }
  },
  "ttlMs": 300000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "timeline-app-server",
      "version": "2.0.0"
    }
  }
}
```

Các máy chủ phải hỗ trợ phát hiện. Một khách hàng không bị buộc phải gọi phát hiện trước mỗi hành động vì mỗi hành động mang lại khả năng riêng của nó.

### Thiết lập UI trên định nghĩa công cụ

Hợp đồng ứng dụng hiện đại liên kết UI với công cụ trong `tools/list`- Có thể là:

```json
{
  "name": "notes_timeline",
  "description": "Render a timeline of notes.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  },
  "_meta": {
    "ui": {
      "resourceUri": "ui://notes/timeline.html"
    }
  }
}
```

Đây là metadata trước cuộc gọi. Người chủ có thể tải trước, lưu trữ cache và xem xét bảo mật HTML trước khi kết quả yêu cầu hiển thị nó. Các phím metadata phẳng cũ có thể được chấp nhận bởi mã tương thích, nhưng các máy chủ mới nên phát ra các ổ `_meta.ui.resourceUri`hình thức.

`tools/list`là cacheable trong lõi hiện tại. Bao gồm định nghĩa sắp xếp,`ttlMs`, và`cacheScope`- Sử dụng`private`khi các công cụ có thể nhìn thấy khác nhau theo người dùng hoặc token.

### Trả lại dữ liệu, sau đó để máy chủ kết nối khung cảnh

Các công cụ gọi trả lại nội dung thông thường cộng với dữ liệu cấu trúc:

```json
{
  "resultType": "complete",
  "content": [
    {"type": "text", "text": "Timeline ready."}
  ],
  "structuredContent": {
    "notes": [
      {"id": "note-1", "title": "Discover", "created": "2026-07-28"}
    ]
  },
  "isError": false
}
```

Người chủ đã biết xem nào thuộc về công cụ. Tránh phát minh một khối nội dung mới chỉ để lặp lại URI.

### Sử dụng ứng dụng như một nguồn tài nguyên

Máy chủ quảng cáo `resources`trong khám phá, vì vậy nó cũng thực hiện các bắt buộc`resources/list`Các mục danh sách xác định của nó bao gồm URI, tên ổn định, mô tả và loại MIME. Kết quả danh sách bao gồm `resultType`, dữ liệu siêu dữ liệu danh tính máy chủ,`ttlMs`, và`cacheScope`, giống như danh sách các công cụ xác định.

Người chủ gửi `resources/read`. Trên Streamable HTTP, yêu cầu có:

```text
POST /mcp
MCP-Protocol-Version: 2026-07-28
Mcp-Method: resources/read
Mcp-Name: ui://notes/timeline.html
```

Các giá trị tiêu đề và cơ thể JSON-RPC phải phù hợp. Một sự không phù hợp là lỗi giao thức `-32020`- Tôi không biết.

Kết quả chứa tài nguyên HTML và gợi ý cache:

```json
{
  "resultType": "complete",
  "contents": [
    {
      "uri": "ui://notes/timeline.html",
      "mimeType": "text/html;profile=mcp-app",
      "text": "<!doctype html>...",
      "_meta": {
        "ui": {
          "csp": {
            "connectDomains": [],
            "resourceDomains": [],
            "frameDomains": [],
            "baseUriDomains": []
          },
          "permissions": {}
        }
      }
    }
  ],
  "ttlMs": 60000,
  "cacheScope": "public"
}
```

### Cache các tài nguyên UI như nội dung thực thi

Một tài nguyên ứng dụng không thể thay đổi với văn bản thông thường. mục kho lưu trữ của nó có thể thực hiện mã cầu, trình bày dữ liệu công cụ và yêu cầu các hành động trung gian của máy chủ.`ui://`URI, nhận dạng và phiên bản máy chủ, tiêu hóa nội dung tài nguyên và bối cảnh ủy quyền khi `cacheScope`Không bao giờ sử dụng lại tài nguyên ứng dụng riêng tư trên các nguyên tắc vì HTML hoặc metadata chính sách của nó có thể khác nhau ngay cả khi URI là giống nhau.

Tháo bỏ mục khi nó `ttlMs`hết hạn, công cụ của `_meta.ui.resourceUri`thay đổi liên kết, phiên bản máy chủ hoặc thay đổi pin mô tả được chấp nhận, hoặc một đăng ký thay đổi tài nguyên được xác nhận đặt tên URI. Phục hồi và áp dụng lại CSP và kiểm tra quyền phép trước khi cài đặt lại. Một iframe cũ không được giữ các quyền rộng hơn chỉ vì một phiên bản tài nguyên mới chưa tải.

### Tháo lại sự mơ hồ về dây trước chính sách tính năng

Thiết lập có một thứ tự cố ý. Trước tiên xác nhận hình dạng JSON-RPC và yêu cầu metadata giao thức chuỗi cộng với bản đồ khả năng khách hàng đối tượng. Sau đó so sánh tiêu đề định tuyến với cơ thể. Chỉ sau đó quyết định liệu phiên bản giao thức phù hợp có được hỗ trợ hay không.

| Condition | HTTP | JSON-RPC error |
|-----------|------|----------------|
| Header and body version, method, or name disagree | 400 | `-32020` |
| Header and body agree on an unsupported version | 400 | `-32022`, with `data` exactly `{"supported":["2026-07-28"],"requested":"<actual>"}` |
| `resources/read` lacks the Apps extension capability | 400 | `-32021`, with `data.requiredCapabilities.extensions.io.modelcontextprotocol/ui` |
| Method is unknown | 404 | `-32601` |

Một thông báo JSON-RPC không có `id`, vì vậy máy chủ không bao giờ phát ra phản ứng JSON-RPC cho nó. Một thông báo HTTP được chấp nhận trả lại 202 với một cơ thể trống. Một lỗi có thể thay đổi tình trạng HTTP, nhưng nó vẫn không thể tạo ra một cơ thể lỗi JSON-RPC cho một thông báo.

### Cái hộp cát là ranh giới, không phải phán quyết tin tưởng

Một máy chủ điều khiển iframe. Ứng dụng không thể trực tiếp đọc cookie chủ, lưu trữ địa phương hoặc trang DOM. Tất cả công việc đặc quyền phải vượt qua cầu.

Sử dụng các mặc định này:

- Để tất cả các danh sách tên miền CSP trống, sau đó chỉ thêm nguồn gốc mà ứng dụng cần. Sử dụng `connectDomains`cho lấy, XHR, và WebSocket; sử dụng `resourceDomains`cho các kịch bản, phong cách, hình ảnh và phông chữ.
- Kết hợp mã và dữ liệu khi có thể.
- Không yêu cầu phép chụp ảnh, nghe nhạc hoặc đặt chỗ trừ khi một tính năng có thể nhìn thấy cần nó.
- Pin `postMessage`đến nguồn gốc chính xác của các đồng nghiệp và từ chối các sự kiện từ mọi nguồn gốc khác.
- Chống đối số công cụ, kết quả công cụ, văn bản tài nguyên và các thông điệp cầu như là đầu vào không đáng tin cậy.
- Giữ sự đồng ý của người dùng trong máy chủ. iframe không thể chấp thuận hành động hậu quả của riêng nó.

Đừng sao chép một số cố định `sandbox`thuộc tính từ một hướng dẫn vào mỗi máy chủ. máy chủ phải chọn cờ dựa trên mô hình nguồn gốc của ứng dụng và thiết kế cách ly của riêng nó.

Một miền được phép vẫn là một con đường thoát. `connectDomains: ["https://api.example.com"]`nghĩa là bất kỳ kịch bản nào chạy bên trong ứng dụng có thể gửi dữ liệu được phép ở đó. Sự phù hợp chính xác nguồn gốc ngăn ngừa sự nhầm lẫn về điểm đến, nhưng nó không quyết định liệu tải trọng hữu ích có phù hợp hay không. Giữ truy cập kết nối trống mặc định, tránh đặt token người mang vào iframe, các hoạt động cúng qua máy chủ khi thực tế, giới hạn kích thước phản ứng và yêu cầu, và kiểm tra hành động của người dùng gây ra mỗi yêu cầu ra ngoài. Chữa bệnh`resourceDomains`tách biệt với `connectDomains`; quyền tải font hoặc script không nên cho phép tải dữ liệu tùy ý.

### Cầu Apps có chu kỳ đời riêng của nó

Cầu Apps là một phương ngữ JSON-RPC trên `postMessage`Nó có thể trao đổi`ui/initialize`và `ui/*`thông báo và có thể đại diện các phương pháp trông như`tools/call`- Tôi không biết.

View gửi `ui/initialize`với `appInfo`và một `appCapabilities`object. host trả về khả năng và bối cảnh host. Chỉ sau khi phản ứng đó View gửi `ui/notifications/initialized`. Người chủ phải chờ cho thông báo ứng dụng này trước khi gửi tin nhắn đến View.

Việc nắm tay địa phương tạo ra một cầu nối giữa một iframe và một host frame. Nó không đàm phán phiên bản giao thức MCP, tạo trạng thái máy chủ, hoặc tạo ra một phiên giao thông.`notifications/initialized`đã bị xóa, trong khi Apps `ui/notifications/initialized`Một yêu cầu cốt lõi được tạo ra bởi một cuộc gọi công cụ nối là một yêu cầu tự lập mới với một ID JSON-RPC mới và dữ liệu siêu dữ liệu yêu cầu đầy đủ.

### Khung ngữ cảnh, hành động và hủy bỏ chủ nhà

Người chủ tiếp tục là thẩm quyền sau khi khởi tạo cầu. Một View có thể yêu cầu hành động công cụ, điều hướng, sử dụng clipboard hoặc hiệu ứng đặc quyền khác chỉ thông qua một khả năng mà người chủ quảng cáo. Người chủ xác nhận yêu cầu được nhập, người dùng hiện tại, mục tiêu và lập luận, áp dụng chính sách chấp thuận, và có thể từ chối nó. Nhấp chuột nút và thông điệp cầu hợp lệ bày tỏ ý định; không một trong hai cấp thẩm quyền.

Chống đối xử với chủ đề, kích thước và khả năng truy cập như thay đổi bối cảnh máy chủ thay vì đầu vào render một lần:

- Sử dụng các mã màu và kiểu chữ được cung cấp bởi máy chủ, sau đó phản ứng khi chủ đề hoặc sự tương phản thay đổi.
- Để View báo cáo kích thước mong muốn, nhưng để host cap và áp dụng kích thước iframe để nội dung không thể thoát khỏi bố cục của nó hoặc tạo các lớp phủ lừa đảo.
- Giữ trật tự bàn phím, tập trung hiển thị, tên truy cập, trạng thái đọc màn hình, tương phản đầy đủ, phóng to và hành vi chuyển động giảm bên trong iframe.
- Kiểm tra lại chuyển đổi trọng tâm giữa các điều khiển chủ và View sau khi thay đổi kích thước và tái trình bày.

Các khả năng có thể bị thu hồi trong khi ứng dụng mở vì người dùng thay đổi tài khoản, thay đổi chính sách, máy chủ bị cách ly hoặc máy chủ hạn chế sự đồng ý.`ui/initialize`Khi hủy bỏ, từ chối các cuộc gọi đặc quyền đang chờ đợi, ngừng hoạt động mạng không còn phù hợp với chính sách, xóa trạng thái render nhạy cảm, và cài đặt lại hoặc quay lại văn bản khi tài nguyên UI không còn được phép.

### Lái lại là một phần của hợp đồng.

Một máy chủ có ý thức về Apps vẫn có thể phục vụ các máy chủ không quảng cáo phần mở rộng UI:

- Trả lại cùng một công cụ mà không cần `_meta.ui`trong `tools/list`- Tôi không biết.
- Giữ kết quả văn bản hữu ích cho `tools/call`- Tôi không biết.
- Không chấp nhận`resources/read`cho UI với lỗi khả năng thiếu.
- Không bao giờ giả định một iframe tồn tại khi quyết định liệu công cụ đã hoàn thành hay không.

```figure
t3-ui-sandbox
```

## Hãy xây dựng nó

`code/main.py`xây dựng một mô hình giao thức trong quá trình nhỏ mà không có SDK. Nó xác nhận gói yêu cầu hiện tại và giá trị định tuyến HTTP Streamable, quảng cáo Apps thông qua `server/discover`, liệt kê các công cụ và tài nguyên, thực hiện công cụ, và phục vụ một tài nguyên HTML tự do.

Mô hình nhận được các cơ thể đã phân tích và tiêu đề định tuyến. Nó không phải là một bộ điều chỉnh HTTP hoàn chỉnh và không phân tích `Content-Type`hoặc `Accept`Sử dụng bài học 09 cho bộ điều chỉnh HTTP Streamable đầy đủ cần `Content-Type: application/json`và một `Accept`giá trị chứa cả hai `application/json`và `text/event-stream`- Tôi không biết.

Đi đi.

```bash
cd phases/13-tools-and-protocols/14-mcp-apps
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

Kiểm tra 5 điều trong đầu ra:

1. Mỗi cuộc gọi đều độc lập.
2. Mọi yêu cầu đều có`_meta`khả năng.
3. `resources/list`trả lại mô tả ổn định trước khi đọc tài nguyên nào.
4. Mọi kết quả đều có`resultType`và dữ liệu siêu dữ liệu danh tính máy chủ.
5. Không có nhân danh phiên bản cốt lõi xuất hiện.

## Sử dụng nó

Bắt đầu với `server/discover`- Đảm bảo`io.modelcontextprotocol/ui`xuất hiện trong bản đồ mở rộng máy chủ.`tools/list`hai lần, một lần với khả năng Apps và một lần mà không có nó. Câu trả lời đầu tiên tuyên bố tài nguyên. thứ hai vẫn là một công cụ chỉ có văn bản có thể sử dụng.

Đọc `ui://notes/timeline.html`Tìm kiếm HTML cho `hostOrigin`và `event.origin`hai đường đó là bằng chứng rõ ràng nhất cho thấy cầu không sử dụng mục tiêu.

## Chuyển nó

Bài học này sẽ đi theo `outputs/skill-mcp-apps-spec.md`Sử dụng nó để xem xét một hợp đồng ứng dụng trước khi viết mã khung. Nó buộc tác giả phải nêu bao bì cốt lõi hiện tại, đàm phán mở rộng, sự trở lại, tài nguyên UI, chính sách cache, CSP, quyền, phương pháp cầu và ranh giới đồng ý.

## Các bài tập

1. Thay đổi khả năng của khách hàng thành một bản đồ mở rộng trống.`tools/list`giữ công cụ nhưng loại bỏ kết nối UI.
2. Gửi đi`Mcp-Name: ui://notes/other.html`với một cơ thể đọc thời gian.`-32020`- Tôi không biết.
3. Thay đổi nguồn tài nguyên thành `cacheScope: private`Mô tả tình trạng cụ thể cho người dùng làm cho nó có lý do.
4. Dời kịch bản lên `https://static.example.com/app.js`Thêm nguồn gốc đó vào `resourceDomains`và giải thích rủi ro chuỗi cung ứng mới.
5. Thêm một `notes_open`công cụ và hướng nút nhấp qua máy chủ. Giữ sự chấp thuận của người dùng trong máy chủ.

## Các điều khoản chính

| Term | Meaning |
|------|---------|
| MCP Apps | Optional extension for interactive HTML rendered by an MCP host |
| `io.modelcontextprotocol/ui` | Extension identifier advertised by both peers |
| `ui://` | Resource scheme for an App's UI template |
| `text/html;profile=mcp-app` | MIME type for MCP App HTML |
| `server/discover` | Current RPC for protocol and capability discovery |
| `resources/list` | Mandatory resource listing method when the server advertises resources |
| `resultType` | Required discriminator for modern successful results |
| `ui/initialize` | First Apps bridge request, separate from removed core initialization |
| `ui/notifications/initialized` | Apps View readiness notification sent after the host responds |
| CSP | Browser policy that restricts scripts, styles, images, and network origins |
| Text fallback | Tool behavior retained for a host without Apps support |

## Đọc thêm

- [MCP 2026-07-28 base protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)
- [MCP Apps build guide](https://modelcontextprotocol.io/extensions/apps/build)
- [Official extension support matrix](https://modelcontextprotocol.io/extensions/client-matrix)
