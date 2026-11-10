# MCP Model Input: lấy mẫu di cư và MRTR vô quốc tịch

> MCP 2026-07-28 đã loại bỏ Sampling cho các thiết kế mới và loại bỏ kênh yêu cầu máy chủ sang khách hàng. Nếu một workflow hiện có vẫn cần mô hình của khách hàng, máy chủ sẽ trả lại một `input_required`kết quả và khách hàng thử lại yêu cầu ban đầu với đầu ra mô hình. vòng hợp lý trở nên rõ ràng, giới hạn và không có quốc gia ở lớp giao thức.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources and prompts)
**Time:** ~75 minutes

## Mục tiêu học tập

- Giải thích lý do tại sao Sampling bị lỗi thời trong MCP 2026-07-28 và chọn mặc định tích hợp mô hình trực tiếp cho các máy chủ mới.
- Thực hiện một dòng công việc tương thích mang theo `sampling/createMessage`thông qua Các yêu cầu nhiều chuyến đi vòng (MRTR).
- Đặt sửa đổi giao thức và khả năng của khách hàng trong mỗi yêu cầu `_meta`đối tượng.
- Trở lại`resultType: "input_required"`và thử lại phương pháp ban đầu với một ID JSON-RPC mới.
- Bảo vệ sự toàn vẹn `requestState`và buộc nó với nguyên tắc, phương pháp, lý luận và hết hạn.
- Các vòng được hỗ trợ bởi mô hình bị ràng buộc với kiểm tra khả năng, phê duyệt, xác nhận phản ứng và giới hạn tròn.

## Quyết định trước khi tiến hành

Một công cụ như `summarize_repo`cần hai loại công việc:

1. Công việc xác định: liệt kê các tập tin, đọc các tập tin được phép, xác nhận con đường và lắp ráp nội dung.
2. Công việc mô hình: chọn các tệp đại diện và tổng hợp bản tóm tắt.

Bây giờ bạn có hai kiến trúc hợp lệ.

### Server mới: tích hợp trực tiếp với nhà cung cấp mô hình

Đây là mặc định hiện tại. máy chủ sở hữu lựa chọn mô hình, tín chỉ, ngân sách, thử nghiệm lại, và khả năng quan sát. Nó trả lại một bình thường `tools/call`kết quả cho khách hàng MCP.

Chọn điều này khi máy chủ đã là một dịch vụ được lưu trữ hoặc khi hành vi mô hình dự đoán quan trọng hơn là sử dụng mô hình của máy chủ.

### Giai đoạn làm việc lấy mẫu hiện có: di chuyển nó sang MRTR

Các mẫu vẫn tồn tại trong cửa sổ khấu trừ của nó. Một máy chủ nhắm mục tiêu 2026-07-28 không thể gửi một trực tiếp `sampling/createMessage`yêu cầu trở lại với khách hàng. thay vào đó nó nhúng yêu cầu đó trong một`InputRequiredResult`- Tôi không biết.

Chọn con đường tương thích này chỉ khi sử dụng mô hình của khách hàng và thông tin tín dụng là yêu cầu sản phẩm thực sự.

## Hợp đồng không có quốc tịch

Nghị định thư tháng 7 năm 2026 không có`initialize`trao đổi, không `notifications/initialized`, và không `Mcp-Session-Id`Mỗi yêu cầu đều chứa thông tin từng được trao cho người:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

Các máy chủ xác nhận sửa đổi trên mỗi yêu cầu. Một phiên bản bị thiếu hoặc không có chuỗi là các param không hợp lệ, `-32602`Một chuỗi không được hỗ trợ sẽ quay lại`-32022`với dữ liệu chính xác `{"supported":["2026-07-28"],"requested":"<client version>"}`- Một khả năng lấy mẫu bị mất tích trở lại .`-32021`với `data.requiredCapabilities`được thiết lập`{"sampling":{}}`- Tôi không biết.

Một phong bì mà không có JSON-RPC `id`là một thông báo. Người nhận có thể xử lý nó, nhưng nó không phát ra phản ứng thành công hoặc phản ứng lỗi. Một bộ điều chỉnh HTTP Streamable trả về `202 Accepted`Không có cơ quan nào cho thông báo được chấp nhận.

Các máy chủ cũng thực hiện `server/discover`với chính xác `supportedVersions`- Chìa khóa, khả năng,`ttlMs`, và`cacheScope`để khách hàng có thể tìm hiểu và lưu trữ hợp đồng máy chủ trước khi gọi một công cụ. Bởi vì phát hiện quảng cáo`tools`, máy chủ cũng thực hiện bắt buộc `tools/list`- Định nghĩa của nó`summarize_repo`mô tả bao gồm một đối tượng hợp lệ `inputSchema`- `resultType: "complete"`, dữ liệu siêu dạng máy chủ, và gợi ý cache công cộng.

Mỗi kết quả hiện đại thành công đều có một điểm phân biệt:

- `resultType: "complete"`nghĩa là hoạt động đã kết thúc.
- `resultType: "input_required"`nghĩa là khách hàng phải đáp ứng yêu cầu nhúng và thử lại.
- Các mở rộng có thể xác định các loại kết quả bổ sung.`"task"`Trong Bài học 13.

## Một vòng MRTR

Các máy chủ không thể gọi cho khách hàng trong khi xử lý yêu cầu. Nó trả lại kết quả này thay vào đó:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "pick_files": {
        "method": "sampling/createMessage",
        "params": {
          "messages": [
            {
              "role": "user",
              "content": {
                "type": "text",
                "text": "Choose three representative files and return a JSON array."
              }
            }
          ],
          "systemPrompt": "Return only the requested value.",
          "modelPreferences": {
            "costPriority": 0.8,
            "intelligencePriority": 0.2
          },
          "maxTokens": 400
        }
      }
    },
    "requestState": "opaque-integrity-protected-value"
  }
}
```

Khách hàng xác minh rằng nó hỗ trợ Sampling, áp dụng chính sách chấp thuận và mô hình của mình, và nhận được phản hồi mô hình. Sau đó nó gửi yêu cầu mới với một ID JSON-RPC khác:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "inputResponses": {
      "pick_files": {
        "role": "assistant",
        "content": {
          "type": "text",
          "text": "[\"README.md\", \"server.py\", \"docs/intro.md\"]"
        },
        "model": "host-model",
        "stopReason": "endTurn"
      }
    },
    "requestState": "opaque-integrity-protected-value",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}}
    }
  }
}
```

Việc thử lại không phải là một sự tiếp tục của một phiên giao thức. Nó là một yêu cầu mới lặp lại phương pháp và lập luận ban đầu, chỉ thêm các vòng hiện tại `inputResponses`, và tiếng vang `requestState`Byte cho byte.

MRTR chỉ được phép vào `tools/call`- `prompts/get`, và`resources/read`Một máy chủ không được quay lại`input_required`từ các phương pháp không liên quan.

## Nhà nước đa vòng

Bài học này cần hai mẫu gọi:

1. `pick_files`trả lại một mảng JSON.
2. `summary`trả lại câu thơ cuối cùng.

Mỗi lần thử lại chỉ mang lại các câu trả lời cho vòng đó. do đó máy chủ đưa các dữ liệu giai đoạn và trung gian được xác nhận vào vòng tiếp theo `requestState`- Tôi không biết.

Hãy coi giá trị đó là bị kẻ tấn công kiểm soát.

- Chủ đầu tư xác thực, không được báo cáo tự `clientInfo`-
- phương pháp xuất xứ;
- Một bản ghi lại các luận điểm ban đầu;
- Thời hạn ngắn;
- giai đoạn hiện tại và các giá trị trung gian được xác nhận.

Sử dụng HMAC khi bảo mật không cần thiết. Sử dụng mã hóa xác thực khi khách hàng không được đọc trạng thái. Từ chối chữ ký không đúng, giá trị hết hạn, thay đổi nguyên tắc hoặc thay đổi các lập luận với `-32602`- Tôi không biết.

Khách hàng không được phân tích hoặc sửa đổi `requestState`Công việc duy nhất của nó là phản ứng đúng dòng khi thử lại.

## Các lựa chọn mô hình là gợi ý

`costPriority`- `speedPriority`, và`intelligencePriority`là những ưu tiên độc lập. Chúng không phải là phân phối xác suất và không cần phải cộng vào một. Khách hàng có thể bỏ qua chúng vì khách hàng sở hữu chính sách mô hình.

Cứ giữ lại`includeContext``"none"`nếu bạn duy trì một dòng chảy lấy mẫu cũ. Các chế độ ngữ cảnh khác làm tăng nguy cơ rò rỉ và tự nó bị lỗi thời. Đưa nội dung rõ ràng tối thiểu trong yêu cầu.

## Các chất bảo mật không thay đổi

Khách hàng là giới hạn tin cậy cho các yêu cầu lấy mẫu nhúng.

- Cho người dùng thấy máy chủ yêu cầu mô hình làm gì khi chính sách yêu cầu phê duyệt.
- Một máy chủ độc hại có thể tạo ra một vòng chi tiêu mô hình.
- Thiết lập từng phản ứng lấy mẫu trước khi sử dụng nó như tên tập tin, URL hoặc đầu vào công cụ.
- Giới hạn các byte và token mỗi vòng.
- Từ chối yêu cầu nhập mà không được tuyên bố trong khả năng của khách hàng hiện tại.
- Giữ sản xuất mô hình ra khỏi các quyết định ủy quyền.
- Lập nhật phương pháp xuất phát và khóa yêu cầu nhập mà không ghi nội dung yêu cầu nhạy cảm.

`clientInfo`và `serverInfo`là hiển thị và chẩn đoán metadata. Không bao giờ sử dụng cả hai như một danh tính xác thực.

```figure
t3-sampling-flip
```

## Hãy xây dựng nó

`code/main.py`thực hiện toàn bộ dòng chảy hai vòng mà không có gói của bên thứ ba:

- `server/discover`trả lại `supportedVersions`, quảng cáo hỗ trợ công cụ, và trả về gợi ý cache.
- `tools/list`trả lại một định nghĩa, cacheable `summarize_repo`mô tả với một sơ đồ nhập đối tượng.
- `tools/call`xác nhận metadata theo yêu cầu.
- Kết quả đầu tiên là kết quả `sampling/createMessage`cho việc chọn tập tin.
- Lần thử lần đầu tiên xác nhận kết quả mô hình và nhúng một yêu cầu thứ hai.
- Được bảo vệ bởi HMAC `requestState`tiến hành giai đoạn giữa các yêu cầu độc lập.
- Kết quả cuối cùng sử dụng `resultType: "complete"`- Tôi không biết.

Mô hình máy chủ giả tạo ví dụ xác định.`fake_host_model`Máy trạng thái bên máy chủ nên vẫn xác định và kiểm tra được.

## Sử dụng nó

Từ nguồn kho:

```bash
cd phases/13-tools-and-protocols/11-mcp-sampling/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Các điểm kiểm soát dự kiến:

- Discovery trả lại kết quả hoàn chỉnh với `ttlMs`và `cacheScope`- Tôi không biết.
- Công cụ phát hiện trả lại mô tả được sắp xếp giống như `resultType`, danh tính máy chủ, và gợi ý cache.
- Các khả năng bị thiếu và các phiên bản không được hỗ trợ sử dụng chính xác `-32021`và `-32022`dữ liệu lỗi.
- Một thông báo không có id không tạo ra phản ứng JSON-RPC.
- Các thẻ nhận dạng yêu cầu là `[1, 2, 3]`, chứng minh mỗi vòng MRTR là độc lập.
- Hai kết quả đầu tiên là`input_required`- Tôi không biết.
- Kết quả cuối cùng là`complete`và chứa các tệp được chọn cộng với bản tóm tắt.
- Thay đổi các lập luận ban đầu trong một lần thử lại thất bại kiểm tra yêu cầu- trạng thái.

## Chuyển nó

`outputs/skill-sampling-loop-designer.md`Nếu tính tương thích được yêu cầu, nó sẽ tạo ra các vòng MRTR, liên kết trạng thái, cổng khả năng, ngân sách, xác thực và kế hoạch loại bỏ.

## Các bài tập

1. Thay đổi phản ứng chọn tệp thành JSON không hợp lệ. xác nhận máy chủ trả lại `-32602`thay vì tin vào sản lượng mô hình.
2. Thay đổi`audience`Giải thích tại sao trạng thái đóng kín ngăn chặn việc tái sử dụng yêu cầu chéo.
3. Thêm một vòng thứ ba yêu cầu chủ nhà phê bình bản tóm tắt. Mang bản tóm tắt trước đó vào trạng thái ký và hạn chế toàn bộ dòng chảy ở ba vòng.
4. Xóa Sampling bằng cách thay thế callback host giả bằng một bộ điều chỉnh mô hình thuộc sở hữu của máy chủ.
5. Thêm một bài kiểm tra hết hạn bằng giá trị trạng thái là một giây quá hạn của nó.

## Các điều khoản chính

| Term | Meaning in 2026-07-28 |
|------|------------------------|
| Sampling | Deprecated feature that asks the client's model for a completion |
| MRTR | Stateless retry pattern for client input required during a request |
| `InputRequiredResult` | Result with `resultType: "input_required"` |
| `inputRequests` | Server-assigned map of embedded elicitation, sampling, or roots requests |
| `inputResponses` | Current round's client results keyed like `inputRequests` |
| `requestState` | Opaque server state echoed exactly by the client and verified by the server |
| `resultType` | Required discriminator for modern MCP results |
| Direct model integration | Recommended replacement for new servers that need model inference |
| Capability gate | Rule that prevents sending an embedded request the client did not advertise |
| Loop budget | Maximum rounds, tokens, bytes, time, and spend allowed for the operation |

## Sự tương thích của Legacy

Một client được gắn vào 2025-11-25 vẫn có thể sử dụng máy chủ khởi động cũ hơn `sampling/createMessage`lưu thông qua kết nối trực tiếp. Giữ hành vi đó chỉ trong một bộ điều chỉnh cụ thể cho phiên bản. Đừng làm cho con đường sessionful kiến trúc cho một máy chủ 2026-07-28.

Các SDK chính thức có thể dịch hiện đại `input_required`Đó là một ranh giới tương thích, không phải là quyền để thêm logic phụ thuộc vào phiên mới.

## Đọc thêm

- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP Sampling deprecation](https://modelcontextprotocol.io/seps/2577-deprecate-roots-sampling-and-logging)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
