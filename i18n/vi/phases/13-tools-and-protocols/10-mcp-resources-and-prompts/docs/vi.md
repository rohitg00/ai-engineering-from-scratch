# Các nguồn lực và yêu cầu của MCP: ngữ cảnh có thể được địa chỉ cho các máy chủ không quốc tịch

> Các công cụ thực hiện các hoạt động. Các tài nguyên phơi bày nội dung có thể địa chỉ. Cảnh báo gói mẫu tin nhắn được người dùng chọn. Một máy chủ MCP tốt giữ các hợp đồng đó riêng biệt và dự đoán.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lesson 07 (Building an MCP Server), Phase 13, Lesson 09 (MCP Transports)
**Time:** ~60 minutes

## Mục tiêu học tập

- Chọn giữa các công cụ, tài nguyên và lời khuyên từ ý định của người tiêu dùng.
- Tiếp thị tài nguyên và nhanh chóng bề mặt thông qua bắt buộc `server/discover`- Tôi không biết.
- Xây dựng định nghĩa `resources/list`và `prompts/list`Kết quả.
- Đơn `ttlMs`và `cacheScope`Không rò rỉ dữ liệu cụ thể cho người dùng.
- Trả lỗi JSON-RPC `-32602`cho một URI tài nguyên không hợp lệ hoặc không được biết.
- Mở một `subscriptions/listen`POST- phản hồi dòng chảy và tương quan mỗi sự kiện bằng ID đăng ký.
- Chống lại nội dung tài nguyên và các mẫu yêu cầu như là đầu ra máy chủ không đáng tin cậy.

## Bắt đầu từ người tiêu dùng

Cách dễ nhất để lạm dụng MCP là bắt đầu với mã thực hiện. Một truy vấn cơ sở dữ liệu trở thành một công cụ vì các chức năng quen thuộc. Một dòng công việc có thể sử dụng lại trở thành một nguồn tài nguyên vì nó được lưu trữ trong một tệp. Một lời nhắc trở thành chính sách ẩn vì máy chủ có thể tiêm nó.

Bắt đầu với những người chọn và những gì họ mong đợi.

| Primitive | Primary intent | Selection owner | Typical result |
|---|---|---|---|
| Tool | Perform an operation | Model or application | Structured action result |
| Resource | Read content at a URI | Host, application, or user | Text or binary content |
| Prompt | Start a reusable message workflow | User through host UI | One or more prompt messages |

Một lời nhắn ở `notes://note-1`là một nguồn tài nguyên vì nó là nội dung có thể được địa chỉ. `delete_note`là một công cụ vì nó thay đổi trạng thái. `review_note`là một lời nhắc bởi vì người dùng chọn một dòng công việc đánh giá đã chuẩn bị.

Đừng cho thấy một hoạt động như cả ba chỉ để trông hoàn chỉnh.

## Báo thư không có quốc tịch năm 2026-07-28

Bài học này nhắm vào việc sửa đổi giao thức MCP `2026-07-28`Không có bắt tay bắt đầu hoặc phiên giao thức trong hồ sơ này. Mỗi yêu cầu mang phiên bản giao thức của nó và các khả năng của khách hàng trong lưu trữ `_meta`- Chìa khóa.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      },
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

Một máy chủ phải thực hiện `server/discover`Kết quả của nó quảng cáo được hỗ trợ
phiên bản, khả năng tài nguyên và nhanh chóng, danh tính thực hiện, và
một khách hàng có thể gọi một phương pháp khác trực tiếp, nhưng phát hiện cho nó
một ảnh chụp ổn định trước khi nó xây dựng một UI.

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "resources": {"listChanged": true, "subscribe": true},
    "prompts": {"listChanged": true}
  },
  "ttlMs": 3600000,
  "cacheScope": "public"
}
```

Kết quả bình thường được công bố.`"resultType": "complete"`. Phản ứng`_meta`xác định việc thực hiện dịch vụ với `io.modelcontextprotocol/serverInfo`Thông tin này hữu ích cho chẩn đoán. Nó không phải là một danh tính xác thực. Một yêu cầu mang một sửa đổi không hỗ trợ trả lại `-32022`với cả sửa đổi yêu cầu và các sửa đổi được hỗ trợ của máy chủ.

Hợp đồng không có quốc tịch thay đổi bản năng thiết kế của bạn. Một danh sách không thể phụ thuộc vào một cuộc gọi trước đó trên một kết nối. Quyền có thể thay đổi bộ hiển thị vì các thông tin tín dụng là yêu cầu nhập, nhưng lịch sử kết nối không được.

## Tài nguyên là hợp đồng URI ổn định

Một nguồn tài nguyên là nội dung được xác định bởi một URI. Thiết kế URI trước khi xử lý.

Các tính chất URI tốt:

- Đủ ổn định để đánh dấu sổ hoặc chuyển giữa các yêu cầu.
- Tên không gian đến miền của máy chủ.
- Không phụ thuộc vào ID hoặc kết nối quá trình.
- Được xác minh trước khi truy cập vào kho.
- Được phép đọc mọi bài.

`notes://note-1`là tốt hơn `note-1`vì không gian tên của nó là rõ ràng.`file://`URI, nhưng nó vẫn phải kiểm tra ranh giới thư mục được cấu hình sau khi giải quyết các liên kết đồng nghĩa và các phân đoạn tương đối.

`resources/list`trả về các tài nguyên hiện có thể nhìn thấy cho người gọi. sắp xếp theo một phím ổn định như URI. Định nghĩa ngăn chặn bị bỏ lỡ bộ nhớ cache ồn ào, thay đổi snapshot và host UI nhảy giữa các bản cập nhật.

```json
{
  "resultType": "complete",
  "resources": [
    {
      "uri": "notes://note-1",
      "name": "Architecture decision",
      "description": "Why the service uses a stateless boundary",
      "mimeType": "text/markdown"
    }
  ],
  "ttlMs": 300000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "notes-server",
      "version": "2.0.0"
    }
  }
}
```

`resources/read`trả lại một hoặc nhiều mục nội dung. Một URI không biết không là một đọc trống thành công. Khóa tài nguyên hiện tại gán không hợp lệ hoặc không biết nguồn tài nguyên URI cho các tham số không hợp lệ JSON-RPC, mã `-32602`- Tôi không biết.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32602,
    "message": "Unknown or invalid resource URI",
    "data": {
      "uri": "notes://missing"
    }
  }
}
```

Sự phân biệt này cho phép khách hàng tách sự vắng mặt từ một tài liệu trống hợp lệ. Nó cũng ngăn chặn sự rơi ngẫu nhiên vào một tìm kiếm rộng hơn.

### Các mẫu tài nguyên

Một mẫu tài nguyên mô tả một gia đình các URI được tham số. Sử dụng một khi liệt kê mọi mục cụ thể sẽ tốn kém hoặc không giới hạn. Ví dụ: `notes://projects/{project}/decisions/{decision}`cho khách hàng biết cách tạo ra một địa chỉ hợp lệ mà không trả lại mọi quyết định.

Một mẫu không làm suy yếu xác thực. Phân tích các biến, áp dụng quyền, thực thi giới hạn chiều dài và ký tự, và xây dựng các truy vấn lưu trữ với các tham số được gõ. Không bao giờ kết nối một đuôi URI tùy ý vào một con đường hệ thống tập tin hoặc tuyên bố cơ sở dữ liệu.

### Nội dung không phải là hướng dẫn đáng tin cậy

Các tài liệu có thể chứa các lệnh hư cấu, sai lệch hoặc đánh dấu sai. Người chủ nên bảo tồn nguồn gốc và coi nội dung tài nguyên như dữ liệu.

## Các lệnh là các mẫu được người dùng kiểm soát

Các lệnh MCP được thiết kế để lựa chọn rõ ràng của người dùng. Một máy chủ có thể render chúng như lệnh slash, mục menu hoặc nút workflow.

`prompts/list`mỗi prompt cần một tên ổn định, mô tả hữu ích và tuyên bố lập luận để cho phép chủ sở hữu thu thập đầu vào trước `prompts/get`- Tôi không biết.

```json
{
  "resultType": "complete",
  "prompts": [
    {
      "name": "review_note",
      "title": "Review a note",
      "description": "Review one note for a named concern",
      "arguments": [
        {
          "name": "uri",
          "description": "The note resource URI",
          "required": true
        }
      ]
    }
  ],
  "ttlMs": 600000,
  "cacheScope": "public"
}
```

`prompts/get`giải quyết các lập luận thành tin nhắn. Nó không thay thế các hướng dẫn hệ thống của máy chủ. máy chủ quyết định cách các tin nhắn trả lại vào bối cảnh mô hình và giữ chính sách tin cậy của riêng mình ở ưu tiên cao hơn.

Thiết lập các lập luận prompt tại biên giới máy chủ. URI prompt phải vượt qua kiểm tra ủy quyền tương tự như đọc tài nguyên trực tiếp. Đừng làm cho một prompt là kênh bên xung quanh truy cập tài nguyên.

## Các gợi ý lưu trữ là một phần của sự chính xác

`ttlMs`cho khách hàng biết kết quả có thể được sử dụng lại bao lâu. `cacheScope`mô tả những người có thể chia sẻ giá trị được lưu trữ.

| Scope | Meaning | Typical use |
|---|---|---|
| `public` | May be reused across users when authorization permits | Public prompt catalog |
| `private` | Bound to the requesting user or credential context | User-owned note content |

Chọn TTL từ tốc độ thay đổi dữ liệu và thiệt hại của sự trì hoãn. Năm phút có thể phù hợp với một danh mục thư viện công cộng.

MCP chỉ định nghĩa `public`và `private`như `cacheScope`Giá trị. Đối với một kết quả bí mật hoặc thay đổi nhanh chóng, trả lại `cacheScope: "private"`với `ttlMs: 0`, sau đó áp dụng bất kỳ quy tắc không lưu trữ nghiêm ngặt hơn trong chính sách cache chủ. `no-store`bản thân nó không phải là một MCP `cacheScope`giá trị.

Các gợi ý cache không bao giờ thay thế quyền phép. Một khóa cache phải bao gồm mọi chiều kích yêu cầu thay đổi khả năng hiển thị, bao gồm người thuê nhà, người dùng, phạm vi, địa điểm và trình chiếu trang. Nếu một bộ nhớ cache được chia sẻ không thể thể diễn tả các chiều kích đó một cách an toàn, hãy sử dụng `private`với một TTL không và một chính sách không cửa hàng ở cấp chủ.

## Các đăng ký sử dụng dòng phản hồi mở bởi khách hàng

Mô hình đăng ký hiện đại thay thế cho mô hình trước `resources/subscribe`RPC và điểm cuối của sự kiện HTTP GET cũ.

Khách hàng gửi `subscriptions/listen`Over Streamable HTTP đây là một POST mà phản ứng vẫn mở như một dòng SSE.`notifications`object là một permislist. Một máy chủ không được cung cấp các loại thông báo mà không được yêu cầu.

```json
{
  "jsonrpc": "2.0",
  "id": 17,
  "method": "subscriptions/listen",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      }
    },
    "notifications": {
      "resourcesListChanged": true,
      "promptsListChanged": true,
      "resourceSubscriptions": [
        "notes://note-1"
      ]
    }
  }
}
```

ID yêu cầu là ID đăng ký. Trước bất kỳ sự kiện yêu cầu nào, máy chủ gửi `notifications/subscriptions/acknowledged`Bộ lọc của nó chỉ chứa các bộ phận mà máy chủ chấp nhận.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/subscriptions/acknowledged",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": 17
    },
    "notifications": {
      "resourcesListChanged": true,
      "resourceSubscriptions": [
        "notes://note-1"
      ]
    }
  }
}
```

Mỗi sự kiện sau đó trên dòng đó đều mang cùng một metadata.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/updated",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": 17
    },
    "uri": "notes://note-1"
  }
}
```

Thông báo nói nguồn đã thay đổi. Khách hàng đọc lại thông qua `resources/read`, theo phép hiện tại. Nó không giả định sự kiện có chứa tài liệu mới.

Một số thuê bao có thể chia sẻ một kênh stdio. ID thuê bao cho phép khách hàng làm mất nhiều. Trên HTTP, đóng dòng phản hồi hủy đăng ký. Một máy chủ kết thúc dòng chảy trả lại một kết thúc `resultType: "complete"`phản ứng tương quan với yêu cầu ban đầu.

Không sử dụng dòng đăng ký như một phiên giao thức. Một đọc sau đó vẫn là một yêu cầu hoàn chỉnh có thể đạt đến bất kỳ phiên bản máy chủ lành mạnh nào.

```figure
t3-primitive-sort
```

## Phòng thí nghiệm tương tác

Sử dụng hình ảnh để phân loại năm khả năng từ trình theo dõi dự án: chi tiết vấn đề, tạo vấn đề, mẫu đánh giá sprint, chính sách dự án và vấn đề đóng. Sau đó quyết định danh sách nào có thể được lưu trữ trong cache công khai, những gì đọc phải giữ riêng tư, và các tài nguyên nào xứng đáng được cập nhật thông báo.

Đối với mỗi phân loại, hãy đặt tên cho người chọn. Nếu mô hình thực hiện một hành động, hãy sử dụng một công cụ. Nếu một máy chủ đọc nội dung được địa chỉ URI, hãy sử dụng một nguồn lực. Nếu người dùng bắt đầu một dòng công việc tin nhắn đã chuẩn bị, hãy sử dụng một lời nhắc.

## Phòng thí nghiệm thực hành

Tiến bộ mô phỏng từ gốc kho:

```bash
cd phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Kiểm tra bản sao theo thứ tự này:

1. Đảm bảo `server/discover`quảng cáo về việc sửa đổi hiện tại và cả hai khả năng.
2. Hãy xác nhận cả hai kết quả danh sách được sắp xếp và sử dụng `resultType: "complete"`- Tôi không biết.
3. Đảm nhận danh sách và đọc kết quả có ý định cache gợi ý.
4. Thay đổi URI đọc thành `notes://missing`và quan sát`-32602`- Tôi không biết.
5. Xác nhận đăng ký trước sự kiện tài nguyên.
6. Báo cáo xác nhận sự kiện và kết thúc lịch sự cả hai mang thẻ đăng ký `5`- Tôi không biết.

Mô hình Python không mở kết nối HTTP thực sự. Nó đại diện cho các thông điệp mà một SDK phải đặt trên dòng phản ứng có quy mô yêu cầu. Sử dụng một SDK chính thức để khung và vận chuyển trong sản xuất.

## Các đồ tạo tác được vận chuyển

`outputs/skill-primitive-splitter.md`là một bản xem xét thiết kế có thể sử dụng lại cho lựa chọn nguyên thủy MCP. Nó hiện đang kiểm tra khám phá xác định, phạm vi cache, hành vi URI không hợp lệ và bộ lọc đăng ký hiện đại.

Bài học cũng đi theo `assets/primitive-split.svg`, một phiên bản tĩnh của ranh giới nguyên thủy và đăng ký cho nghiên cứu ngoại tuyến.

## Hãy kiểm tra

```bash
cd phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Kết quả mong đợi: chương trình chính in một bản sao JSON và lệnh kiểm tra báo cáo ít nhất mười hai bài kiểm tra vượt qua.

## Kết nối Capstone

Sử dụng hợp đồng này khi máy chủ đầu đá của bạn cho thấy kiến thức có thể địa chỉ bên cạnh các hành động. Bao gồm một bản chụp ảnh danh mục xác định, một tài nguyên được phép đọc, một giải pháp nhanh chóng, một trường hợp URI không hợp lệ và một bản sao đăng ký.

Bằng chứng của bạn nên cho thấy rằng không có danh sách nào phụ thuộc vào lịch sử kết nối và rằng một sự kiện đăng ký không bao giờ cho phép truy cập vào tài nguyên cơ bản.

## Các bài tập

1. Thêm một `notes://projects/{project}/notes/{id}`mẫu tài nguyên và xác nhận cả hai biến.
2. Thêm trang vào `resources/list`trong khi vẫn giữ được trật tự quyết định.
3. Thay đổi một tài nguyên thành `cacheScope: "private"`với `ttlMs: 0`, thêm một chính sách không cửa hàng ở cấp chủ, và giải thích mối đe dọa biện minh cho cả hai kiểm soát.
4. Thêm đăng ký thay đổi danh sách nhắc và chứng minh không có sự kiện nào được gửi khi bộ lọc bỏ qua `promptsListChanged`- Tôi không biết.
5. Tạo hai đăng ký đồng thời và chứng minh mỗi sự kiện có ID yêu cầu chính xác.
6. Thêm một quyền đối tượng vào trình xử lý đọc và chứng minh một mục cache không thể vượt qua đối tượng.

## Các điều khoản chính

- **Resource:**Nội dung được định hướng URI được phát hiện bởi máy chủ MCP.
- **Prompt:**Một mẫu thông điệp được người dùng kiểm soát được một máy chủ MCP phát hiện.
- **Deterministic list:**Kết quả phát hiện với thành viên ổn định và đặt hàng cho các đầu vào yêu cầu tương tự.
- **`ttlMs`:**Cache thời gian tươi mới trong milliseconds.
- **`cacheScope`:**Biên giới chia sẻ cho một kết quả được lưu trữ trong cache.
- **`subscriptions/listen`:**Một yêu cầu lâu dài mà dòng phản hồi của nó cung cấp các thông báo được lọc rõ ràng.
- **Subscription ID:**ID yêu cầu nghe ban đầu, lặp lại trong các metadata thông báo.
- **Invalid parameters:**lỗi JSON-RPC `-32602`, được sử dụng cho một URI tài nguyên không hợp lệ hoặc không được biết đến.
- **Unsupported protocol version:**lỗi JSON-RPC `-32022`, bao gồm `supported`và `requested`Các sửa đổi.
- **`server/discover`:**Phương pháp máy chủ bắt buộc trả lại các sửa đổi, khả năng, danh tính và gợi ý cache tùy chọn được hỗ trợ.

## Đọc thêm

- [MCP 2026-07-28 Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
- [MCP 2026-07-28 Prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)
- [MCP 2026-07-28 Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [MCP 2026-07-28 Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)
