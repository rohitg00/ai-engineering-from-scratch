# Kỹ thuật phù hợp MCP: phiên bản, bằng chứng và hoạt động

> Một máy chủ không phù hợp vì con đường hạnh phúc của nó hoạt động thông qua một SDK. Sự phù hợp sống tại dây, tại ranh giới phiên bản, thông qua các trung gian và trong thời gian quay trở lại.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 17 (gateways), Phase 13 · 30 (registry admission)
**Time:** ~100 minutes

## Mục tiêu học tập

- Chuyển đổi các quy tắc MCP quy định thành bản ghi âm bằng vàng và âm.
- Hãy giữ chặt .`2026-07-28`hành vi tách biệt với những hậu quả của sự cố.
- Để phân biệt các trường phụ chưa biết từ một trường không rõ không xác định `resultType`- Tôi không biết.
- So sánh bằng chứng JSON-RPC nguyên liệu với một dạng xem SDK bình thường.
- Bằng chứng về tính toàn vẹn của tiêu đề và cơ thể qua một ranh giới thực.
- Các bản phát hành Gate với bản sao đã được chỉnh sửa, sức khỏe và bằng chứng quay lại.

## Vấn đề

Khách hàng của anh gọi`tools/list`thông qua SDK và nhận được các công cụ.

Kết quả này để lại những câu hỏi quan trọng không có câu trả lời:

- Liệu yêu cầu có chứa các metadata giao thức hiện đại theo yêu cầu?
- Có `MCP-Protocol-Version`- `Mcp-Method`, và`Mcp-Name`phù hợp với cơ thể JSON-RPC?
- Câu trả lời có chứa một câu trả lời hợp lệ `resultType`trên dây, hay SDK đã tổng hợp một?
- Khách hàng có thể bảo tồn một lĩnh vực phụ gia trong tương lai không?
- Một sai lầm hiện đại được công nhận có vô tình gây ra một cú tay cổ tích?
- Một proxy đã bảo tồn trạng thái nguồn gốc và lỗi JSON-RPC?
- Máy thông báo seriesiezer đã phát ra một phản ứng cấm?
- Liệu các hoạt động có thể chứng minh tại sao một bản phát hành được thúc đẩy hoặc bị lật lại mà không lưu trữ bí mật?

Conformance là một tập hợp các biến động có thể quan sát được. Hãy xây dựng một dây đeo bắt được những biến động đó trước khi giao thông sản xuất phải phát hiện chúng.

```figure
mcp-conformance-operations
```

## Bắt đầu với phiên bản Eras

MCP `2026-07-28`sử dụng tự nhiên mỗi yêu cầu metadata.`params._meta.io.modelcontextprotocol/protocolVersion`và `params._meta.io.modelcontextprotocol/clientCapabilities`. Các khóa tên chính xác quan trọng;`protocolVersion`hoặc `clientCapabilities`khi các tiêu đề định tuyến được hiển thị ở biên giới HTTP, giá trị của chúng phải phù hợp với cơ thể JSON-RPC. Kết quả thành công hiện đại mang lại`resultType`- Tôi không biết.

Các phiên bản thông qua `2025-11-25`sử dụng thời kỳ khởi tạo sớm hơn.`resultType`được giải thích là hoàn chỉnh chỉ sau khi khách hàng đã chọn thời kỳ trước đó.

Đừng tạo ra một xác nhận cho phép chấp nhận cả hai hình dạng cùng một lúc. Sử dụng hai nhánh:

| Branch | Entry evidence | Missing `resultType` | Initialization |
|---|---|---|---|
| Modern | Successful `server/discover` or recognized modern response | Invalid | Not the default path |
| Legacy | Configured allowlist plus a valid legacy `initialize` result after an inconclusive modern probe | Interpreted as complete | Required by that era |

Sự tách biệt ngăn cản một người đồng nghiệp hiện đại bị hình dạng sai trái được khen thưởng bằng sự xác nhận yếu hơn.

### Khóa chế nghiêm ngặt

Chế độ nghiêm ngặt đòi hỏi chứng minh hành vi hiện đại.`server/discover`chứng minh chi nhánh hiện đại. Một lỗi JSON-RPC hiện đại được công nhận cũng chứng minh điều đó. sửa lỗi yêu cầu hoặc dừng lại. Không bao giờ hạ cấp vì máy chủ đã quay lại`-32020`- `-32021`, hoặc`-32022`- Tôi không biết.

### Phương thức quay lại

Phương thức fallback thực hiện một thăm dò hiện đại có giới hạn. Một thời gian nghỉ, câu trả lời trống, kết nối đóng hoặc phản ứng không được nhận ra là không kết luận. Nó không chứng minh rằng đồng nghiệp là di sản. Chỉ một điểm cuối được cấu hình hoặc liệt kê rõ ràng cho sự tương thích sau đó có thể nhận được một thăm dò di sản có giới hạn, và khách hàng chỉ chọn nhánh di sản sau khi xác nhận các bản thăm dò đó.`initialize`kết quả và đàm phán sửa đổi kế thừa.

Fallback không là  cố gắng di sản sau bất kỳ lỗi nào. Một lỗi hiện đại được công nhận chứa thông tin sửa chữa hữu ích. Việc hạ cấp sau đó có thể che giấu sự không phù hợp của tiêu đề, tuyên bố khả năng bị thiếu hoặc phiên bản không được hỗ trợ.

Điều này ngăn chặn một kẻ tấn công, tắt điện hoặc lọc proxy buộc phải hạ cấp bằng cách loại bỏ phản ứng hiện đại.

Viết thời gian được chọn bên cạnh mỗi bản ghi.

## Xây dựng một bản sao

Một thiết bị ghi chép ghi lại những gì vượt qua ranh giới, không chỉ gọi SDK:

```json
{
  "name": "golden-modern-list",
  "era": "modern",
  "headers": {
    "MCP-Protocol-Version": "2026-07-28",
    "Mcp-Method": "tools/list"
  },
  "request": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {}
      }
    }
  },
  "responseStatus": 200,
  "responseBody": {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "resultType": "complete",
      "tools": []
    }
  }
}
```

Hãy giữ hai lớp đồ đạc.

### Các bản ghi vàng

Những bản ghi vàng chứng minh hành vi được chấp nhận:

- yêu cầu khám phá hoặc phương pháp hiện đại với metadata và tiêu đề phù hợp
- kết quả hoàn chỉnh với các trường yêu cầu
- `input_required`kết quả khi phương pháp có thể yêu cầu nhập nhiều hơn
- kết quả mở rộng chỉ sau khi khả năng tương ứng được quảng cáo
- kết quả thừa kế mà không có `resultType`, nhưng chỉ trong thời kỳ di sản được chọn
- xử lý thông báo mà không có phản hồi JSON-RPC

Một bản ghi vàng là chính xác, không lớn. Giữ ID biến động và thời gian ấn định hoặc bình thường hóa chúng trước khi so sánh.

### Các bản sao âm

Các bản ghi âm âm chứng minh hành vi từ chối:

- không phù hợp đầu và thân
- thiếu khả năng yêu cầu
- phiên bản giao thức không được hỗ trợ
- mất hiện đại `resultType`
- không được biết đến hoặc không được quảng cáo `resultType`
- phản ứng `jsonrpc`khác ngoài `2.0`hoặc ID khác nhau về giá trị hoặc loại JSON
- một phản ứng có cả hai `result`và `error`, hoặc cả hai
- một lỗi không có số nguyên`code`và dây `message`
- lỗi giao thức được biết đến được gán đến tình trạng HTTP sai
- phản ứng được phát hành để thông báo
- bọc JSON-RPC bị biến dạng sai
- sự sụp đổ của lỗi giao thức

Đối với mỗi trường hợp tiêu cực, khẳng định giới hạn từ chối và mã lỗi ổn định. Câu lạc không thành công quá yếu.`-32020`cả hai có thể trông giống như thất bại trong khi kể cho các nhà điều hành những câu chuyện hoàn toàn khác nhau.

Thiết bị không phù hợp tiêu đề phải bao gồm phản ứng HTTP 400 JSON-RPC thực tế của máy chủ với ID yêu cầu phù hợp và mã lỗi `-32020`. Thực hiện điều đó tự động bất cứ khi nào người xác nhận địa phương quan sát `HeaderMismatch`; không làm cho xác minh phản ứng là cờ cố định tùy chọn. Một trường hợp với HTTP 500 và không có cơ thể thất bại ngay cả khi mã từ chối địa phương là đúng. Một vòng đeo dừng lại sau khi xác nhận yêu cầu của riêng nó ném đã kiểm tra chỉ bản thân, không phải hành vi dây của máy chủ.

Dự án phù hợp chính thức của MCP hữu ích như một bộ phận bên ngoài và tham chiếu phiên bản. Giữ bản sao chép địa phương của bạn cũng vậy. Chúng ghi lại proxy, SDK, xác thực, mở rộng và đường phát hành của bạn, mà một bộ phận chung không thể biết.

## Các giá trị tiêu đề phải phù hợp với cơ quan RPC

Trong HTTP Streamable hiện đại, người trung gian có thể định tuyến hoặc thực thi chính sách bằng cách sử dụng tiêu đề gương. Cơ thể JSON-RPC vẫn là nguồn nguyên tắc.

Được xác nhận theo thứ tự này:

1. Phân tích và xác nhận các loại bao bì và metadata JSON-RPC.
2. So sánh`MCP-Protocol-Version`với `params._meta.io.modelcontextprotocol/protocolVersion`- Tôi không biết.
3. So sánh`Mcp-Method`với `method`- Tôi không biết.
4. Khi phương pháp có tên định tuyến, so sánh `Mcp-Name`với giá trị cơ thể tương ứng.
5. Sau khi bình đẳng được thiết lập, quyết định liệu phiên bản và bộ khả năng phù hợp có được hỗ trợ hay không.

Trật tự này phân biệt sự không phù hợp.`-32020`từ phiên bản không hỗ trợ `-32022`Nó cũng ngăn chặn một cửa cổng từ ủy quyền tên tiêu đề trong khi nguồn thực hiện một tên cơ thể khác.

Tên trường HTTP không nhạy cảm với trường hợp, trong khi các giá trị của chúng vẫn nhạy cảm với trường hợp. Tiêu chuẩn hóa tên tiêu đề trước khi tìm kiếm và từ chối bản sao mâu thuẫn. Đối với không gian trắng không an toàn, không phải ASCII, hoặc dẫn hoặc theo dõi `Mcp-Name`, giải mã chính xác `=?base64?{Base64EncodedValue}?=`UTF-8 Sentinel trước khi so sánh nó với cơ thể. Tháo một Sentinel không đầy đủ, Base64, không hợp lệ UTF-8, hoặc giá trị không an toàn nguyên liệu với `-32020`. Không gian trắng bao quanh nguyên liệu là không hiệu lực ngay cả khi cơ thể chứa các ký tự tương tự vì giá trị đó yêu cầu mã hóa sentinel trước khi vận chuyển.

Một trung gian có thể từ chối HTTP bị trục trặc trước khi yêu cầu đạt đến máy chủ MCP, vì vậy thất bại của nó có thể là lỗi HTTP mà không có JSON-RPC.

## Các cánh đồng không biết là kết quả không biết

Sự tương thích tương thích đòi hỏi hai quy tắc khác nhau.

### Các trường không rõ

Các đối tượng kết quả và `_meta`bản đồ có thể có được các trường. Một người xác nhận nên bảo tồn hoặc bỏ qua một trường phụ gia theo vai trò của nó, trừ khi trường vi phạm một hợp đồng được đặt phòng.`futureHint`bên cạnh một kết quả được biết đến.

Nếu bạn là một proxy minh bạch, bảo tồn một trường không rõ thường an toàn hơn là tước bỏ nó. Nếu bạn là một khách hàng ứng dụng, bỏ qua nó có thể là hợp lệ. Thử nghiệm khác biệt của bạn vẫn nên tiết lộ rằng SDK đã bỏ qua nó vì vậy hành vi là cố ý.

### Không biết`resultType`

`resultType`là một phân biệt đối xử.`complete`hoặc `input_required`. Một phần mở rộng chỉ có thể thêm một giá trị khác khi khả năng của nó được quảng cáo.`task`trong bối cảnh khả năng đàm phán đó.

Một người phân biệt đối xử không được biết hoặc không được quảng cáo không thể được coi là hoàn chỉnh. Khách hàng không biết chu kỳ cuộc sống mà nó sẽ loại bỏ.

Do đó, phản ứng nguyên chất tương tự có thể chứa một trường không rõ được chấp nhận và một loại kết quả không rõ được không chấp nhận.

Các phân biệt chỉ là lớp đầu tiên.`tools/list`kết quả cần một `tools`array có mô tả có tên không trống độc đáo, mô tả hữu ích và gốc đối tượng `inputSchema`giá trị.`task`kết quả chỉ có giá trị cho một người đủ điều kiện `tools/call`với khả năng và yêu cầu của nhiệm vụ`taskId`, tình trạng được biết đến, tạo ra và cập nhật các dấu thời gian, và `ttlMs`, cộng với một khoảng thời gian bỏ phiếu tùy chọn hợp lệ.`completion/complete`kết quả đòi hỏi một `completion`đối tượng không quá 100 giá trị chuỗi, một số nguyên không âm tùy chọn `total`không nhỏ hơn các giá trị trả lại, và một tùy chọn Boolean `hasMore`Một chữ viết thật rõ ràng.`resultType`không thể làm cho một tải trọng hữu ích bị biến dạng phù hợp.

## Các thông báo không thay đổi

Một thông báo JSON-RPC không có `id`. Người nhận không được gửi một phản ứng thành công hoặc lỗi JSON-RPC.

Đối với một hình thức thông báo HTTP được chấp nhận, dây đeo sẽ chờ đợi một HTTP `202`với một cơ thể trống rỗng.`2026-07-28`không xác định các thông báo trung tâm từ client đến server trên Streamable HTTP. mẫu sử dụng thông báo mở rộng khóa học không gian tên chỉ để kiểm tra không biến động serializer một chiều. Đừng trình bày nó như một phương pháp trung tâm mới.

Hãy thử máy truyền hình, không chỉ người xử lý.`None`trong khi middleware gói nó trong một đối tượng thành công JSON.

## Thêm một SDK khác biệt

SDK thường biến các đối tượng dây thành các loại ngôn ngữ thuận tiện. Điều đó hữu ích, nhưng một đối tượng bình thường không thể chứng minh được những gì đã nhận được.

Đối với mỗi thiết bị có nguy cơ cao, bắt:

1. Tình trạng nguyên liệu, tiêu đề và cơ quan phản ứng trước khi giải mã SDK.
2. Giá trị trở lại hoặc ngoại lệ được chuẩn hóa theo SDK.
3. Dự đoán ngữ nghĩa dự kiến cho thời đại được chọn.
4. Các trường được nâng lên, tổng hợp, loại bỏ hoặc thay đổi bởi SDK.

Mô hình cho phép loại bỏ các sổ kế toán điện tử được biết đến chỉ với SDK như `resultType`- `_meta`- `ttlMs`, và`cacheScope`khi so sánh tải trọng ứng dụng. Nó báo cáo một giảm `futureHint`bởi vì lĩnh vực ngữ nghĩa không rõ đó đã biến mất.

Đừng cho rằng mọi sự khác biệt là một lỗi SDK. Điểm là để làm cho sự chuyển đổi hiển thị. quyết định liệu thành phần của bạn là một điểm cuối ứng dụng, có thể bỏ qua một trường phụ gia, hoặc một trung gian minh bạch, nên bảo tồn nó.

Động cơ khác biệt đối với mỗi SDK và phiên bản bạn gửi. Nếu hai SDK bình thường hóa bản sao tương tự khác nhau, chính sách phát hành nên nói hành vi nào là chấp nhận được thay vì chọn đầu ra thuận tiện nhất sau sự kiện.

## Chụp bằng chứng đại diện

Hầu hết các lỗi MCP sản xuất xảy ra trong nhiều quá trình hơn một.

| View | Minimum evidence |
|---|---|
| Ingress | request headers, JSON-RPC body, content type, authenticated route, receive time |
| Origin | forwarded headers and body digest, origin status, response headers and body |
| Egress | client-visible status, headers, body, and send time |

Mô hình phát hiện ra hai biến đổi phổ biến:

- lỗi HTTP 400 hoặc 404 JSON-RPC trở thành một proxy chung 500
- Cơ thể JSON-RPC xuất phát khác với cơ thể nguồn gốc

Thêm các tuyên bố cụ thể về triển khai cho loại nội dung, `Accept`, nén, yêu cầu-scaned SSE, cache tiêu đề, và liên quan theo dõi.

## Tải lại trước khi chứng cứ rời khỏi trí nhớ

Việc viết lại là một phần của các hoạt động tuân thủ, không phải là một công việc dọn dẹp sau đó.

Vỏ mẫu gấp các tên khóa và loại bỏ các bộ tách trước khi phù hợp, sau đó thay thế lại các giá trị dưới các khóa như `Authorization`- `Cookie`- `Set-Cookie`- `X-Api-Key`- `accessToken`- `clientSecret`- `registrationAccessToken`- `token`- `password`- `secret`, và`api_key`. Canonicalization và denylist phải sử dụng cùng một hình thức để camelCase, các biến thể có dấu chấm, nhấn mạnh và chấm không thể bỏ qua chính sách của nhau.`query`có thể vẫn chứa dữ liệu cá nhân hoặc được quy định.

Hài lưu các dữ liệu thu được trong một hệ thống lâu dài được phê duyệt chỉ khi một cuộc điều tra cụ thể yêu cầu chúng. Một bản ghi chứng minh các dữ liệu thu được đã thúc đẩy quyết định; nó không tiết lộ giá trị bị xóa.

## Làm cho sức khỏe và sự quay trở lại là một phần của cánh cổng

Sự tuân thủ giao thức là cần thiết nhưng không đủ để giải phóng. Một ứng cử viên phù hợp vẫn có thể thời gian ra, rò rỉ bộ nhớ hoặc quá tải một sự phụ thuộc.

Định nghĩa một cửa sổ sức khỏe trước khi triển khai:

- Số lượng mẫu tối thiểu
- Tỷ lệ lỗi tối đa
- Percentile độ trễ tối đa
- giới hạn bão hòa hoặc nguồn lực
- Thời gian quan sát
- so sánh với đường cơ sở được chấp nhận

Định nghĩa bằng chứng quay lại trước khi triển khai:

- phiên bản trước đó chính xác
- Đánh giá bằng chứng nhập học
- SHA-256 đồ tạo và pin mô tả
- trạng thái Registry hiện tại
- kết quả sức khỏe hiện tại
- Quy trình khôi phục tuyến đường
- chứng nhận về các trường chính xác đó từ một nhân danh kiểm soát viên giải phóng đáng tin cậy

yêu cầu mục tiêu quay trở lại đó được xác minh và khỏe mạnh trước khi thăng chức, không chỉ sau khi ứng viên thất bại.

Nếu một ứng cử viên thất bại và mục tiêu quay lại không có bằng chứng đó, giữ lưu lượng thay vì đoán.

Không giảm độ sẵn sàng để kiểm tra sự thật như phiên bản không trống, `healthy: "yes"`, hoặc một chuỗi bằng chứng tùy tiện. Mô hình đòi hỏi các loại chính xác, trạng thái hoạt động, ba bản ghi SHA-256, một người ký đáng tin cậy và chứng chỉ HMAC-SHA-256 hợp lệ trên toàn bộ tải trọng phục hồi. Chìa khóa demo xác định của nó là một vật cố định không bí mật. Nhúng một khóa bảo vệ, kết quả xác minh KMS hoặc xác minh chứng minh chứng minh khóa công khai tại giới hạn phát hành trong sản xuất.

Cổng phát hành cũng từ chối bản sao không có gì, SDK khác biệt hoặc bằng chứng đại diện. Mỗi nguồn phải mang theo các chứng cứ có giá trị. Một cửa sổ sức khỏe xanh không thể lấp đầy ranh giới chưa bao giờ được quan sát.

## Hãy xây dựng nó

Đưa dây thắt thư viện tiêu chuẩn:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations
python3 code/main.py
npx tsx code/main.ts
```

Demo chạy chính xác mười lăm bản sao vàng và âm tính, bao gồm kết quả hoàn thành hợp lệ và sai, so sánh kết quả thô với một dạng xem SDK, kiểm tra một proxy đã bị lỗi nguồn gốc sụp đổ, đánh giá sức khỏe, xác minh bằng chứng quay lại, và chọn mục tiêu đó.

Hình dạng dự kiến:

```json
{
  "transcriptsPassed": 15,
  "transcriptsTotal": 15,
  "sdkDroppedFields": ["futureHint"],
  "proxyIssues": [
    "proxy collapsed a protocol error into HTTP 500",
    "proxy changed the origin JSON-RPC body"
  ],
  "releaseAction": "rollback",
  "evidenceDigest": "..."
}
```

Đọc `code/main.py`theo thứ tự này:

1. `validate_request()`thực thi các quy tắc yêu cầu và tiêu đề cụ thể cho thời đại.
2. `validate_result()`phân biệt những người phân biệt đối xử thừa kế bị mất tích, giá trị hiện đại hợp lệ, mở rộng và giá trị không rõ.
3. `select_era()`thực hiện chính sách phản hồi nghiêm ngặt và hạn chế.
4. `run_transcript()`đánh giá các đèn vàng và âm.
5. `compare_sdk_view()`cho thấy sự khác biệt về bình thường hóa.
6. `inspect_proxy()`so sánh bằng chứng nhập cảnh, nguồn gốc và xuất cảnh.
7. `redact()`loại bỏ những bí mật rõ ràng trước khi làm việc với bằng chứng.
8. `rollback_evidence_ready()`xác nhận các trường pin chính xác và chứng nhận phát hành đáng tin cậy.
9. `ReleaseGate.evaluate()`kết hợp với chứng minh không rỗng, SDK, đại diện, sức khỏe và rolloback.

## Sử dụng nó

Đưa dây vào bốn điểm:

1. Trong mỗi thay đổi thực hiện với một bộ điều chỉnh thử nghiệm trong quá trình.
2. Đối với các máy chủ và khách hàng được xây dựng trên các giao thông thực.
3. Thông qua proxy hoặc gateway được triển khai trong môi trường sắp xếp.
4. Trong khi triển khai cá thể có sức khỏe sống và bằng chứng quay lại.

Giữ tên trường hợp ổn định trên các lớp. `negative-header-body-mismatch`nên có nghĩa là không thay đổi trong báo cáo đơn vị, kết thúc đến kết thúc, đại diện và canary.

Cung cấp các bản ghi trong hệ thống phát hành của bạn. Cung cấp các bản ghi nguyên liệu ngắn hạn chỉ trong các điều khiển truy cập sự cố.

## Phòng thí nghiệm tương tác

### Phòng thí nghiệm A: chứng minh ranh giới thời đại

Từ `code`thư mục, mở Python:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/code
python3 -q
```

Đi chạy:

```python
from main import *
validate_result({"tools": []}, "legacy")
validate_result({"tools": []}, "modern")
```

Lệnh truyền thống kết thúc`complete`- Cuộc gọi hiện đại đang phát sinh.`ProtocolViolation`Giờ thử nghiệm trở lại:

```python
select_era({"kind": "timeout"}, "fallback")
select_era(
    {"kind": "timeout"},
    "fallback",
    legacy_allowed=True,
    legacy_evidence={"kind": "initialize_success", "protocolVersion": LEGACY_VERSION},
)
select_era({"kind": "jsonrpc_error", "code": -32021}, "fallback")
```

Thời gian tạm thời đầu tiên không được đóng bởi vì sự im lặng không phải là bằng chứng di sản. Cuộc gọi thứ hai chỉ chọn di sản vì cấu hình cho phép nó và kết quả khởi tạo di sản hợp lệ đã được quan sát. Hầm lỗi khả năng thiếu được công nhận chứng minh là chi nhánh hiện đại.

### Phòng thí nghiệm B: trường phụ so với phân biệt đối xử

```python
validate_result({"resultType": "complete", "tools": [], "futureHint": True}, "modern")
validate_result({"resultType": "future_mode", "tools": []}, "modern")
```

Kết quả đầu tiên là giữ gìn `futureHint`. thứ hai bị từ chối vì người phân biệt sinh học không biết.

### Phòng thí nghiệm C: kiểm tra chuyển đổi SDK

```python
compare_sdk_view(
    {"resultType": "complete", "tools": [], "futureHint": {"mode": "new"}},
    {"tools": []},
)
```

Quyết định liệu thành phần của bạn có thể bỏ qua hay không `futureHint`hoặc phải chuyển nó. ghi lựa chọn đó vào chính sách phát hành. Đừng im lặng xóa phân biệt.

### Phòng thí nghiệm D: sửa chữa đại diện

Thay đổi đổi đổi demo để thoát lưu giữ trạng thái nguồn gốc và thân xác.`python3 main.py`Các vấn đề đại diện nên biến mất, nhưng SDK khác biệt vẫn chặn quảng cáo.`futureHint`trong dạng xem SDK và quan sát sự thay đổi hành động đến `promote`Khi mọi nguồn bằng chứng đều qua.

## Phòng thí nghiệm thực hành

Thêm các bản sao SSE được yêu cầu vào vòng xoáy.

Yêu cầu:

- Tận thức trạng thái phản ứng, loại nội dung, các sự kiện SSE được sắp xếp và chấm dứt dòng.
- Hiển thị mỗi sự kiện JSON-RPC có kết quả hoặc lỗi cụ thể thời đại hợp lệ.
- Thêm trường hợp âm cho một proxy mà bơm toàn bộ dòng trước khi chuyển tiếp.
- Thêm trường hợp âm cho một sự kiện SSE có ID JSON-RPC khác với yêu cầu.
- Tạo lại dữ liệu sự kiện trước khi viết bằng chứng.
- Bao gồm thời gian lưu lượng, thời gian trễ của sự kiện đầu tiên và số sự kiện trong cửa sổ sức khỏe.
- Hãy để cửa thoát chọn chỉ một mục tiêu quay trở lại bằng chứng khi dòng chảy thất bại.

Thành công có nghĩa là cùng một trường hợp chạy trực tiếp và thông qua ủy quyền, với một báo cáo xác định ranh giới chính xác mà thay đổi hành vi.

## Các đồ tạo tác được vận chuyển

Bài học này sẽ đi theo `outputs/skill-mcp-conformance-release-gate.md`Sử dụng nó để biến đổi máy chủ, khách hàng, cổng thông tin hoặc SDK thành một matrix phù hợp phiên bản và quyết định phát hành.

## Hãy kiểm tra

Tiến hành bộ demo và xác định:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Việc kiểm tra phải chứng minh:

- Mỗi bản ghi âm vàng và âm được đưa vào đều đạt được kết quả mong đợi.
- Các yêu cầu hiện đại yêu cầu các khóa metadata chính xác với tên
- Tên tiêu đề HTTP được kết hợp không nhạy cảm và mã hóa `Mcp-Name`các giá trị được giải mã chính xác
- tiêu đề và cơ thể không phù hợp trả lại mã không phù hợp hiện đại
- phiên bản phản ứng, ID, kết quả hoặc lỗi độc quyền, hình dạng lỗi và bản đồ HTTP được xác nhận
- Các yêu cầu về danh sách công cụ, nhiệm vụ và tải trọng hữu ích hoàn thành cụ thể về phương pháp được thực thi
- mỗi lần quan sát`HeaderMismatch`yêu cầu một HTTP 400 JSON-RPC thực tế `-32020`phản ứng
- thô`Mcp-Name`không gian trắng bị từ chối trong khi thực tế được mã hóa bởi sentinel không gian trắng đi lại và đi lại
- một người mất tích`resultType`chỉ có hiệu lực trong thời kỳ thừa kế được chọn
- Các trường phụ gia tồn tại trong quá trình xác thực nguyên liệu trong khi các loại kết quả không rõ ràng thất bại
- Các loại kết quả mở rộng yêu cầu khả năng quảng cáo của chúng
- lỗi hiện đại được nhận ra không bao giờ gây ra sự thất bại của di sản
- Các thông báo không tạo ra phản ứng JSON-RPC
- Việc xóa sổ SDK và mất trường ngữ nghĩa được phân biệt
- lỗi proxy bị phát hiện và các thông tin tín dụng được chỉnh sửa trở lại trên camelCase và biến thể phân tách
- Việc quảng bá đòi hỏi không có bản sao trống, SDK, đại diện và bằng chứng hoạt động lành mạnh
- Tăng cường và quay trở lại đều yêu cầu một mục tiêu quay trở lại xác thực, gắn kết, hoạt động và lành mạnh

## Các chế độ sản xuất thất bại

| Failure | What the weak test reports | What the harness must prove |
|---|---|---|
| SDK synthesizes a missing discriminator | “tools/list passed” | Raw modern result lacked `resultType` and is invalid |
| Client downgrades after `-32021` | “legacy retry worked” | Recognized modern error forbids fallback |
| Unknown result type treated as complete | “response parsed” | Unadvertised lifecycle discriminator is rejected |
| Proxy authorizes one tool and origin executes another | “request reached server” | `Mcp-Name` equals the body routing name at every hop |
| Harness throws before reading the server response | “header mismatch test passed” | HTTP 400 and JSON-RPC `-32020` response are captured and validated |
| Proxy turns origin 400 into generic 500 | “upstream error” | Origin and egress statuses and JSON-RPC bodies are preserved |
| Notification middleware emits `{result: null}` | “handler returned none” | Final egress body is empty and no JSON-RPC response exists |
| SDK strips an additive field | “typed objects match” | Raw and normalized views show the exact dropped field |
| Failure artifact leaks a bearer token | “debug bundle uploaded” | Redaction occurred before hashing, logging, or upload |
| Credential key style bypasses redaction | “denylist contains api_key” | CamelCase and separator variants share one canonical denylist form |
| Canary has no samples but appears healthy | “zero errors” | Minimum sample count is enforced |
| Rollback selects an unknown build | “previous deployment restored” | Target version, admission digest, pins, status, and health are present |

## Quy tắc hoạt động

Kiểm tra các byte bạn gửi, các byte mỗi trung gian chuyển tiếp, ngữ nghĩa mỗi SDK phơi bày, và các hoạt động bằng chứng sẽ sử dụng dưới áp lực. Sự tương thích là một nhánh rõ ràng. Rollback là một hành động phát hành được hỗ trợ bằng chứng. Cả hai không nên là một tác dụng phụ ngẫu nhiên của một trình phân tích cho phép.

## Đọc thêm

- [MCP 2026-07-28 base protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP version negotiation](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Official MCP conformance project](https://github.com/modelcontextprotocol/conformance)
