# Khả năng mở rộng và việc xin cấp quyền không có quốc tịch

> Roots đã bị lỗi thời trong MCP 2026-07-28 và không bao giờ là một hộp cát bảo mật. Đặt phạm vi trong các lập luận công cụ hoặc tài nguyên URIs hiển thị, ủy quyền nó trên máy chủ, và sử dụng MRTR khi một công cụ thực sự cần input người dùng. Người dùng nhìn thấy quyết định, mô hình nhìn thấy tay cầm, và bất kỳ phiên bản máy chủ nào có thể xử lý thử lại.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 11 (stateless MRTR)
**Time:** ~60 minutes

## Mục tiêu học tập

- Thay thế Roots lỗi thời bằng các tham số không gian làm việc rõ ràng, URI tài nguyên hoặc cấu hình máy chủ.
- Các gợi ý phạm vi riêng biệt từ ủy quyền, hạn chế đường dẫn và sandboxing hệ điều hành.
- Phương thức giao thức `elicitation/create`thông qua MRTR `input_required`kết quả.
- Tiến hành hỗ trợ kích hoạt trong các khả năng của khách hàng theo yêu cầu và từ chối các chế độ không được hỗ trợ.
- Định hành`accept`- `decline`, và`cancel`như những kết quả rõ ràng.
- Kết nối xác nhận phá hủy với một nguyên tắc xác thực, các lập luận ban đầu, bộ ứng cử viên và hết hạn.

## Hai vấn đề có vẻ giống nhau

Một công cụ ghi chú nhận được yêu cầu này: "Tài ra báo cáo TPS cũ".

Máy chủ phải trả lời hai câu hỏi khác nhau.

1. Quá trình này có thể chạm vào không gian làm việc nào?
2. Người dùng có ý gì trong ba ghi chú tương ứng?

Thứ nhất là phạm vi và ủy quyền. thứ hai là sự phân biệt rõ ràng tương tác. Trộn chúng dẫn đến các thiết kế nguy hiểm, chẳng hạn như xử lý một thư mục được cung cấp bởi khách hàng như bằng chứng rằng người gọi có thể xóa tất cả mọi thứ bên trong nó.

## Sễ của người di cư

Các sửa đổi trước đây của MCP cho phép khách hàng quảng cáo Roots và thông báo cho máy chủ khi danh sách thay đổi. Roots là hướng dẫn thông tin.

MCP 2026-07-28 bị hủy bỏ `roots/list`và `notifications/roots/list_changed`cho các thiết kế mới. Tôi thích một trong những thay thế rõ ràng sau đây:

- A `workspaceUri`hoặc `directory`Truyện công cụ khi phạm vi khác nhau cho mỗi cuộc gọi.
- Một URI tài nguyên khi hoạt động đã nhắm vào một tài nguyên.
- Cấu hình máy chủ khi một triển khai sở hữu một không gian làm việc cố định.
- Một hộp cát xử lý hoặc hệ thống tệp bị bỏ tù khi mã phải không thể thoát ra.

Nếu một sự tích hợp hiện có 2026-07-28 vẫn cần `roots/list`trong cửa sổ khấu trừ, máy chủ nhúng nó vào MRTR `inputRequests`Nó không được gửi một yêu cầu ngược trực tiếp. Đó là một bộ chuyển đổi chuyển đổi; người xử lý mới nên chấp nhận phạm vi rõ ràng thay vào đó.

Mô hình có thể nhìn thấy và lặp lại một tay cầm rõ ràng. phạm vi giao thông ẩn-giữ phiên khó kiểm tra, lặp lại, kiểm toán, và tuyến đường.

### Quy tắc ba tầng

Một URI rõ ràng vẫn không tự cho phép.

1. **Authorization:**Người quản lý có được chứng minh có được phép sử dụng không gian làm việc này không?
2. **Containment:**URI mục tiêu bình thường có ở bên trong ranh giới không gian làm việc được phép không?
3. **Sandbox:**Hệ điều hành có thể ngăn chặn một máy chủ bị xâm nhập thoát khỏi không?

Các máy chủ chạy giữ một danh sách các URL không gian làm việc được ủy quyền, bình thường hóa các con đường mã hóa phần trăm, kiểm tra ranh giới thực của thành phần đường, và kiểm tra lại việc chứa ngay trước khi xóa.

Các kiểm tra tiền tố chuỗi ngây thơ là sai:

```text
allowed:   file:///work/notes
attacker:  file:///work/notes-evil/secret.md
traversal: file:///work/notes/%2e%2e/private.md
```

Cả hai con đường thù địch bắt đầu với một chuỗi gây hiểu lầm. Trước tiên bình thường hóa, sau đó so sánh các thành phần con đường. Một máy chủ hệ thống tập tin sản xuất cũng phải bảo vệ chống lại các cuộc đua liên kết biểu tượng và ngữ nghĩa con đường cụ thể cho nền tảng.

## Việc xin phép vẫn còn, nhưng việc đưa ra đã thay đổi

Elicitation là tính năng client hiện tại để thu thập thông tin nhập của người dùng trong thời gian `tools/call`- `prompts/get`, hoặc`resources/read`Tên phương pháp vẫn còn`elicitation/create`Điều thay đổi là hướng chảy của dây.

Một máy chủ 2026-07-28 không gửi yêu cầu JSON-RPC ngược. Nó trả lại một `InputRequiredResult`- Có thể là:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "delete_choice": {
        "method": "elicitation/create",
        "params": {
          "mode": "form",
          "message": "Choose one matching note and confirm deletion.",
          "requestedSchema": {
            "type": "object",
            "properties": {
              "note_id": {
                "type": "string",
                "enum": ["note-3", "note-7", "note-14"]
              },
              "confirm": {"type": "boolean"}
            },
            "required": ["note_id", "confirm"]
          }
        }
      }
    },
    "requestState": "integrity-protected-delete-state"
  }
}
```

Người dùng có thể chấp nhận, từ chối hoặc từ chối nó.`tools/call`Với một thẻ ID mới:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "notes_delete",
    "arguments": {
      "workspaceUri": "file:///Users/alice/Documents/Notes",
      "title": "TPS report"
    },
    "inputResponses": {
      "delete_choice": {
        "action": "accept",
        "content": {"note_id": "note-14", "confirm": true}
      }
    },
    "requestState": "integrity-protected-delete-state",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {"form": {}}
      }
    }
  }
}
```

Không có phiên giao thức giữa hai cuộc gọi. máy chủ xác minh trạng thái hồi âm, xác nhận phản ứng so với sơ đồ mong đợi, kiểm tra rằng ghi chú được chọn nằm trong bộ ứng cử viên đã ký kết, ủy quyền lại không gian làm việc, kiểm tra lại chứa, và sau đó xóa.

## Các thương lượng khả năng là theo yêu cầu

Một khách hàng hỗ trợ kích hoạt chế độ biểu mẫu tuyên bố:

```json
{
  "io.modelcontextprotocol/clientCapabilities": {
    "elicitation": {"form": {}}
  }
}
```

Một khả năng kích hoạt trống rỗng,`"elicitation": {}`, vẫn tương đương với hỗ trợ tương thích chỉ bằng hình thức.`"elicitation": {"form": {}}`cũng hỗ trợ chế độ biểu mẫu. Một tuyên bố chỉ có URL, `"elicitation": {"url": {}}`, không. máy chủ không được nhúng một chế độ không có khả năng của yêu cầu hiện tại, ngay cả khi yêu cầu trước đó quảng cáo nó.

Mỗi yêu cầu cũng có chứa`io.modelcontextprotocol/protocolVersion`. Một phiên bản bị mất hoặc không có chuỗi trả lại `-32602`Một chuỗi không được hỗ trợ sẽ quay lại`-32022`chính xác`supported`và `requested`dữ liệu. Phản hồi hỗ trợ thu hồi bị thiếu hoặc chỉ có URL `-32021`với `data.requiredCapabilities`được thiết lập`{"elicitation":{"form":{}}}`- Tôi không biết.

Một phong bì mà không có JSON-RPC `id`là một thông báo. xử lý nó mà không phát ra một thành công JSON-RPC hoặc phản ứng lỗi. Trên Streamable HTTP, một thông báo được chấp nhận nhận nhận `202 Accepted`Không có xác.

`clientInfo`nên được bao gồm để chẩn đoán, nhưng nó tự báo cáo và không thể xác định người dùng để được ủy quyền.

Các máy chủ thực hiện `server/discover`và trả lại`supportedVersions`, khả năng,`ttlMs`, và`cacheScope`với `resultType: "complete"`Nó không quảng cáo Roots cho thiết kế hiện đại này. Bởi vì nó quảng cáo các công cụ, nó cũng thực hiện bắt buộc `tools/list`Kết quả đó trả lại số xác định`notes_delete`mô tả, một đối tượng hợp lệ `inputSchema`, dữ liệu siêu dạng máy chủ, và gợi ý cache công cộng.

## Phương thức biểu mẫu

Phương thức biểu mẫu sử dụng một sơ đồ JSON hạn chế được thiết kế cho các đối thoại có thể sử dụng. Root là một đối tượng và các thuộc tính của nó là các trường nguyên thủy bằng phẳng hoặc hỗ trợ các mảng enum. Các đối tượng sâu và các sơ đồ tài liệu mục đích chung không thuộc vào một đối thoại xác nhận.

Sử dụng chế độ biểu mẫu cho:

- chọn một trong nhiều ứng cử viên;
- xác nhận hoạt động phá hủy;
- thu thập các ưu tiên không nhạy cảm;
- thu thập một số lượng nhỏ các giá trị người dùng, chứ không phải là mô hình, phải quyết định.

Không sử dụng chế độ biểu mẫu cho mật khẩu, khóa API, mã thông báo truy cập hoặc thông tin tín dụng thanh toán.

Các máy chủ xác nhận nội dung được trả lại một lần nữa. xác nhận hình thức bên khách hàng cải thiện UX nhưng không tạo ra sự tin tưởng.

## Phương thức URL

Chế độ URL gửi một URL web an toàn cho một tương tác ngoài băng:

```json
{
  "method": "elicitation/create",
  "params": {
    "mode": "url",
    "message": "Connect the report service to continue.",
    "url": "https://mcp.example.com/connect/report-service"
  }
}
```

Sử dụng nó khi thông tin nhạy cảm phải đi trực tiếp đến một dòng web được kiểm soát bởi máy chủ, chẳng hạn như ủy quyền của bên thứ ba. Khách hàng hiển thị toàn bộ điểm đến và nhận sự đồng ý trước khi mở nó. Nó không được mua trước URL.

Một `accept`phản ứng có nghĩa là người dùng đồng ý mở URL. Nó không chứng minh dòng bên ngoài đã hoàn thành. Khi thử lại, máy chủ kiểm tra trạng thái của riêng nó và hoặc hoàn thành hoặc trả lại một `input_required`kết quả.

URL không thay thế cho quyền giữa khách hàng MCP và máy chủ MCP. Nó là cho một tương tác bên ngoài mà máy chủ MCP cần thực hiện thay mặt cho người dùng.

## Các chi nhánh đáp ứng

Chống hành động như quyết định sản phẩm, chứ không phải là biệt danh:

| Action | Meaning | Safe server behavior |
|--------|---------|----------------------|
| `accept` | User submitted the interaction | Validate content and continue |
| `decline` | User explicitly refused | Return a complete, non-error refusal outcome |
| `cancel` | User dismissed or could not finish | Stop safely and allow a later retry |

Đừng bao giờ giải thích nội dung thiếu như sự đồng ý. Đừng bao giờ chuyển đổi sự từ chối thành vòng lặp lặp lặp lại.

## Bảo vệ Nhà nước MRTR Hủy diệt

Danh sách ứng cử viên không thể chỉ tồn tại trong một giá trị Base64 được nhắc hoặc không ký. Một khách hàng kiểm soát mọi thứ nó gửi lại.

Bài học ký một tải trọng hữu ích của nhà nước chứa:

- chính xác nhận;
- phương pháp xuất xứ;
- tiêu hóa của `workspaceUri`và `title`-
- Các thẻ ghi nhận được cho phép được hiển thị trong biểu mẫu;
- giai đoạn vận hành;
- Thời hạn ngắn.

Trước khi đột biến, máy chủ cũng kiểm tra hồ sơ ghi chép trực tiếp. Điều này bắt được các cuộc đua xóa và một mục tiêu di chuyển ra khỏi không gian làm việc sau khi biểu mẫu được hiển thị.

Đối với một hành động tài chính hoặc không thể đảo ngược một lần, chỉ có HMAC không ngăn cản trạng thái hợp lệ được tái diễn trong thời hạn hết hạn của nó. Cung cấp và tiêu thụ nonce chính xác một lần trong một cửa hàng phát lại được chia sẻ bởi mỗi trình xử lý. Bài học tiêm một cửa hàng bị giới hạn, cắt TTL và giữ nguyên tử của nó khi thực hiện xóa trong bộ nhớ. Một cơ sở dữ liệu sản xuất nên kết hợp yêu cầu nonce và đột biến trong một giao dịch hoặc ranh giới viết điều kiện tương đương.

Thiết lập sự tương tác trước khi yêu cầu nonce.`cancel`không thực hiện đột biến và để lại trạng thái có thể tái tạo cho đến khi hết hạn.`decline`là cuối cùng, nên bài học tiêu thụ nonce mà không xóa bất cứ điều gì.

```figure
t3-roots-boundary
```

## Hãy xây dựng nó

`code/main.py`cho thấy một hiện đại `notes_delete`công cụ:

- `tools/list`trả lại mô tả xác định, có thể lưu trữ trong cache với không gian làm việc và sơ đồ tiêu đề cần thiết.
- Khu vực này là một sự rõ ràng `workspaceUri`tranh luận.
- Cấu hình máy chủ cho phép không gian làm việc cho chủ tịch bài học.
- URI bình thường hóa từ chối nhầm lẫn tiền tố và quá trình mã hóa.
- Mỗi loại bỏ tiêu diệt đòi hỏi tính năng tạo ra dạng.
- Sự kích thích đi vào bên trong.`resultType: "input_required"`- Tôi không biết.
- Đăng ký`requestState`kết hợp danh sách ứng cử viên chính xác và các lập luận ban đầu.
- Một cửa hàng sao chép được tiêm từ chối trạng thái chấp nhận hoặc từ chối tương tự trên các phiên bản máy chủ.
- Việc thử lại sử dụng một ID yêu cầu mới và trả lại `resultType: "complete"`- Tôi không biết.

Kho lưu trữ dữ liệu là trong bộ nhớ vì vậy hành vi giao thức dễ dàng để kiểm tra. Các quy tắc bảo mật vẫn giống nhau với một cơ sở dữ liệu.

## Sử dụng nó

Từ nguồn kho:

```bash
cd phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Các điểm kiểm soát dự kiến:

- Discovery quảng cáo công cụ không có Roots.
- Trình phát hiện công cụ `notes_delete`với `resultType`, danh tính máy chủ, và gợi ý cache.
- Đơn xin ID `1`trả lại mẫu trong `inputRequests.delete_choice`- Tôi không biết.
- Đơn xin ID `2`lặp lại trạng thái đã ký và hoàn thành việc xóa.
- Một con đường tiền tố và một con đường đi qua được mã hóa đều không được kiểm soát.
- Một tiêu đề thay đổi không thể sử dụng lại trạng thái xác nhận ban đầu.
- Một sự sụt giảm sẽ không thay đổi nó.
- Hai đối tượng máy chủ chia sẻ lưu ý và trạng thái phát lại không thể cả hai thực hiện một xác nhận.
- Các tuyên bố biểu mẫu trống và rõ ràng hoạt động, trong khi hỗ trợ chỉ URL trả lại chính xác `-32021`yêu cầu về mẫu.
- Các lỗi phiên bản không được hỗ trợ sử dụng chính xác `-32022`hình dạng dữ liệu.
- Một thông báo không có id không tạo ra phản ứng JSON-RPC.

## Chuyển nó

`outputs/skill-elicitation-form-designer.md`thiết kế phạm vi rõ ràng, kiểm tra ủy quyền, biểu mẫu MRTR, chi nhánh phản ứng và liên kết trạng thái. Nó từ chối đối xử với Roots cũ như một hộp cát hoặc thu thập bí mật thông qua chế độ biểu thức.

## Các bài tập

1. Thay thế kho lưu trữ lặp lại trong bộ nhớ bằng SQLite. Sử dụng một giao dịch để yêu cầu nonce và xóa ghi chú, sau đó chứng minh hai quá trình không thể cả hai cam kết.
2. Thêm `url`đàm phán khả năng và một dòng thiết lập ngoài băng thông.`inputResponses`- Tôi không biết.
3. Thay thế bản đồ ghi chú trong bộ nhớ bằng cơ sở dữ liệu SQLite tạm thời. Kiểm tra lại quyền và chứa bên trong giao dịch đột biến.
4. Thêm một chính sách liên kết biểu tượng cho một hệ thống file thực tế thực hiện. Giải thích tại sao việc chứa từ điển URI một mình không thể ngăn chặn một sự thoát khỏi liên kết biểu tượng.
5. Thiết kế một bộ điều chỉnh 2025-11-25 để lập bản đồ đầu ra xử lý MRTR hiện đại cho việc khởi động của máy chủ cũ. Giữ nó cách ly khỏi xử lý hiện tại.

## Các điều khoản chính

| Term | Meaning in 2026-07-28 |
|------|------------------------|
| Roots | Deprecated informational workspace hints, not authorization or sandboxing |
| Explicit scope | Workspace, directory, or resource handle visible in request arguments |
| Containment | Normalized path-component check that keeps a target inside a boundary |
| Elicitation | Client feature for obtaining user input during an MCP operation |
| Form mode | In-band structured user input using a restricted flat schema |
| URL mode | Out-of-band interaction for sensitive or external workflows |
| MRTR | Stateless input-required result followed by a fresh retry |
| `requestState` | Opaque state echoed exactly and integrity-checked by the server |
| Decline | Explicit user refusal |
| Cancel | Dismissal or incomplete interaction without approval |

## Sự tương thích của Legacy

Đối với một người đồng nghiệp bị buộc phải đến năm 2025-11-25, `roots/list`- `notifications/roots/list_changed`, và được khởi động bởi máy chủ trực tiếp`elicitation/create`Đánh dấu di sản bộ chuyển đổi. Đừng cho phép danh sách gốc cũ bỏ qua quyền cho máy chủ, và không mang các giả định giao thức-phát họp vào trình xử lý hiện đại.

## Đọc thêm

- [MCP 2026-07-28 Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Roots deprecation](https://modelcontextprotocol.io/specification/2026-07-28/client/roots)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
