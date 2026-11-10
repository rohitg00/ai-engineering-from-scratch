# Hợp đồng và nội dung của công cụ MCP

> Một công cụ là an toàn để tự động hóa chỉ khi phát hiện, lập luận, kết quả, pagination, và vận chuyển metadata đồng ý trên một hợp đồng.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 07, 09, and 10
**Time:** ~120 minutes

## Mục tiêu học tập

- Định nghĩa đầu vào và đầu ra công cụ với JSON Schema 2020-12.
- Thiết lập kết quả được cấu trúc mà không giả định chúng là các đối tượng JSON.
- Chọn giữa văn bản, hình ảnh, âm thanh, liên kết tài nguyên và các tài nguyên nhúng.
- Tháo bỏ những thứ không an toàn`x-mcp-header`các định nghĩa trước khi một công cụ đạt đến mô hình.
- Mã hóa các giá trị tiêu đề tham số và xác minh sự tương đương chính xác tiêu đề với cơ thể.
- Trải qua trang trình chiếu mà không giải thích các giá trị trình chiếu.
- Bị ràng buộc và ủy quyền `completion/complete`những đề xuất.

## Vấn đề

Gọi một chức năng Python là dễ dàng. Gọi một khả năng từ xa thông qua máy chủ AI là một vấn đề hợp đồng.

Server xuất bản mô tả. Client biến mô tả đó thành mô hình ngữ cảnh và giao diện người dùng. mô hình tạo ra các lập luận. Một cửa cổng có thể định tuyến yêu cầu từ tiêu đề gương. Server thực thi công cụ. Client sau đó quyết định kết quả có đủ an toàn và hợp lệ để quay lại mô hình.

Một ranh giới yếu kém làm hỏng toàn bộ chuỗi.

Hãy xem xét năm sự thất bại:

- Mô tả nói kết quả là một đối tượng, nhưng máy chủ trả lại một mảng.
- Khách hàng ngừng trang khi `nextCursor`là một chuỗi trống.
- Một tham số token được phản chiếu vào tiêu đề HTTP và trở nên hiển thị cho người trung gian.
- Một giá trị định tuyến Unicode được gửi như một tiêu đề thô, sau đó cửa ngõ và nguồn gốc giải thích các byte khác nhau.
- Một điểm cuối hoàn thành gợi ý một môi trường sản xuất cho người gọi không thể truy cập nó.

Không có lỗi nào được khắc phục bằng cách yêu cầu tốt hơn.

## Hãng đường ống hợp đồng

Hãy coi mỗi cuộc gọi công cụ như 5 cổng:

1. **Discover.**Đọc một danh sách các công cụ xác định, trang.
2. **Admit.**Thiết lập từng mô tả và áp dụng chính sách an ninh địa phương.
3. **Invoke.**Thiết lập các lập luận và xây dựng metadata vận tải.
4. **Execute.**Đưa ra bộ xử lý và phân loại lỗi đúng cách.
5. **Consume.**Thiết lập các khối nội dung và đầu ra có cấu trúc trước khi sử dụng mô hình.

```figure
mcp-contract-pipeline
```

Nhà máy chủ sở hữu các cổng nhập và tiêu thụ. Một máy chủ không thể buộc khách hàng tin tưởng vào các chú thích, sơ đồ hoặc đầu ra của nó.

## JSON Schema là một rantime giới hạn

Trong MCP `2026-07-28`- `inputSchema`và `outputSchema`sử dụng JSON Schema.`$schema`không có, phương ngữ mặc định là 2020-12.

Các giao thức đầu vào phải là một đối tượng schema. Một công cụ không có lập luận vẫn nên nói chính xác những gì nó chấp nhận:

```json
{
  "type": "object",
  "additionalProperties": false
}
```

Đây là nghiêm khắc hơn `{ "type": "object" }`, chấp nhận các tính chất tùy tiện.

Một sơ đồ đầu ra là tùy chọn. Một khi một máy chủ xuất bản một, mỗi công cụ hoàn chỉnh
kết quả cam kết trả lại phù hợp `structuredContent`, bao gồm kết quả
với `isError: true`. Lập cờ lỗi phân loại kết quả thực hiện; nó không
từ bỏ hợp đồng sản xuất được công bố. Khách hàng nên xác nhận kết quả thay vào đó
của tin tưởng vào mô tả.

### Nội dung được cấu trúc là bất kỳ giá trị JSON nào

Đừng mã cứng `structuredContent`như một từ điển.

- một đối tượng;
- một mảng;
- một dây;
- một số;
- một boolean;
- `null`- Tôi không biết.

Công cụ này trả về một mảng:

```json
{
  "name": "tag_catalog",
  "inputSchema": {
    "type": "object",
    "additionalProperties": false
  },
  "outputSchema": {
    "type": "array",
    "items": {"type": "string"}
  }
}
```

Kết quả thành công của nó là hợp lệ:

```json
{
  "resultType": "complete",
  "content": [
    {
      "type": "text",
      "text": "[\"contracts\", \"mcp\", \"stateless\"]"
    }
  ],
  "structuredContent": ["contracts", "mcp", "stateless"],
  "isError": false
}
```

Để tương thích, kết quả có cấu trúc cũng nên bao gồm JSON được phân phối theo chuỗi trong khối văn bản.`structuredContent`- Phải.

### Một người xác nhận nhỏ vẫn dạy giới hạn

Bài học sử dụng một bộ phụ tập JSON Schema cố ý vì nó ở trong thư viện tiêu chuẩn Python. Nó kiểm tra các cơ chế được sử dụng bởi các công cụ mẫu:

- Các loại đối tượng, mảng, chuỗi, số nguyên, số, boolean và null;
- các tính chất cần thiết;
- `additionalProperties: false`-
- các mục array;
- giá trị enum;
- Độ dài dây tối thiểu.

Đây không phải là một thay thế cho một xác thực sản xuất hoàn chỉnh. Bài học tái sử dụng là nơi xác thực xảy ra: sau khi phát hiện cho mô tả, trước khi thực hiện cho các lập luận, và trước khi tiêu thụ cho kết quả cấu trúc.

## Các khối nội dung có chi phí khác nhau

- `content`array có thể kết hợp nhiều loại nội dung.

| Type | Use it for | Main boundary |
|------|------------|---------------|
| `text` | Human and model-readable summaries | Treat text as untrusted output |
| `image` | Visual evidence encoded as base64 | Validate media type and size |
| `audio` | Spoken or recorded output encoded as base64 | Validate media type and duration limits |
| `resource_link` | A URI the client may fetch later | Reauthorize the later resource read |
| `resource` | Data embedded directly in the result | Enforce payload and content limits now |

Một liên kết tài nguyên không phải là bằng chứng cho thấy tài nguyên xuất hiện trong `resources/list`. Nó là một tham chiếu được trả lại bởi tool call này. Khách hàng vẫn áp dụng chính sách tài nguyên của mình khi nó theo dõi URI.

Một tài nguyên nhúng tránh một chuyến đi quay lại khác nhưng làm tăng kích thước phản ứng hiện tại. Sử dụng liên kết cho các hiện vật lớn hoặc tự động thay đổi. Sử dụng tài nguyên nhúng cho các bằng chứng nhỏ phải đi theo nguyên tử với kết quả.

Bài học là `evidence_bundle`kết quả bao gồm cả năm loại. Khách hàng xác nhận từng khối trước khi chấp nhận kết quả.

## `x-mcp-header`Định hướng Metadata

Một tài sản bên trong`inputSchema`có thể tuyên bố `x-mcp-header`. Trên Streamable HTTP, client phản ánh lập luận đó vào `Mcp-Param-{name}`- Tôi không biết.

```json
{
  "region": {
    "type": "string",
    "x-mcp-header": "Region"
  }
}
```

Với `region: "eu-west"`, vận chuyển có thể phát ra:

```http
Mcp-Param-Region: eu-west
```

Các ghi chú tồn tại để một bộ cân bằng tải, cửa khẩu hoặc công cụ chính sách có thể định tuyến mà không phân tích cơ thể JSON.

Các giao thức hạn chế ghi chú:

- Tên tiêu đề không trống và tuân theo cấu trúc mã mã mã tên trường HTTP;
- Tên tiêu đề là duy nhất bất kể trường hợp;
- loại thuộc tính là chuỗi, số nguyên hoặc boolean;
- `number`không được phép;
- ghi chú chỉ xuất hiện trên một thành viên trực tiếp của `inputSchema.properties`-
- giá trị nguyên số ở trong `-9007199254740991`qua `9007199254740991`- Tôi không biết.

Quy tắc vị trí là tổng hợp và không bị đóng.
không chỉ các tính chất xác thực viên của bạn hiểu.
ghi chú dưới một đối tượng `properties`, một `oneOf`nhánh,`items`, một
định nghĩa đạt được bởi `$ref`, hoặc bất kỳ sơ đồ đầu ra nào.
không biến nút tham chiếu thành một thuộc tính cấp cao trực tiếp.

Bài học này thêm một chính sách triển khai: từ chối mô tả phản ánh tên như `password`- `secret`- `token`- `api_key`, hoặc`authorization`Các thông số chính thức khuyên các tác giả máy chủ không thể phản ánh các thông số nhạy cảm.

Kiểm tra tên tiêu đề, không phải giá trị của nó.`Mcp-Param-Region`trong khi giữ `eu-west`ra khỏi sự kiện kiểm toán.

### Giá trị mã hóa trước khi xây dựng tiêu đề HTTP

Một giá trị tham số chỉ có thể đi như văn bản đơn giản khi nó là một chuỗi không trống
của các ký tự ASCII có thể nhìn thấy từ `!`qua `~`và không giống như
Tất cả mọi thứ khác đều sử dụng hình thức này:

```text
=?base64?{Base64UTF8}?=
```

`Base64UTF8`là base64 tiêu chuẩn trên các byte UTF-8 chính xác. Đừng cắt,
làm bình thường, hoặc thay thế giá trị trước.
tab, ký tự điều khiển, CR hoặc LF, không gian trắng dẫn hoặc sau, và bất kỳ
giá trị bắt đầu với `=?base64?`. Mã hóa một giá trị trông như Sentinel một lần nữa là
điều gì cho phép người nhận lấy lại văn bản gốc theo nghĩa đen thay vì giải mã
nó như là tổng hợp vận tải.

Tóm lại là chữ nhỏ `true`hoặc `false`. Số nguyên được hiển thị trong cơ sở 10 và
phải ở trong phạm vi toàn số an toàn của JavaScript. Giá trị bên ngoài phạm vi đó
được từ chối thay vì được tròn bởi một người trung gian.

### Máy chủ kiểm tra bản sao được gương

Tạo tiêu đề chỉ là một nửa của client.
máy chủ phải:

1. tìm được công nhận `Mcp-Param-*`Tên không tính đến trường hợp tên tiêu đề;
2. mã hóa hình thức sentinel base64 chính xác khi có mặt;
3. so sánh văn bản được giải mã với lập luận cơ thể JSON tương ứng chính xác;
4. từ chối một vật bị mất tích, trùng lặp, không mong đợi, sai dạng hoặc không phù hợp
   đầu được nhận ra trước khi gửi.

Việc từ chối là HTTP `400`với mã lỗi JSON-RPC `-32020`- Không phải là
giá trị cơ thể cũng như hình thức tiêu đề được mã hóa của nó không thuộc về hồ sơ kiểm toán.
Chỉ có tên tiêu đề được công nhận và danh mục từ chối.

`code/main.py`mô hình ranh giới này trực tiếp. [Lesson 09](../../09-mcp-transports/)
bao gồm các lệnh xác thực HTTP Streamable rộng hơn, bao gồm phương pháp và
Phân điểm giao thức- phiên bản.

## Các bài nguyền trên trang web không rõ ràng

MCP sử dụng các hoạt động danh sách trang trang. máy chủ chọn kích thước trang và định dạng trình chiếu. Client nhận được một quyết định:

```python
if result.get("nextCursor") is None:
    break
cursor = result["nextCursor"]
```

Đừng viết như thế này:

```python
if not result.get("nextCursor"):
    break
```

Một chuỗi trống là một trình chỉ dẫn hợp lệ. Sự thật sẽ dừng lại quá sớm.

Khách hàng không được giải mã một trình chiếu, tăng nó, so sánh nó với một trình chiếu trước đó để đặt hàng, hoặc suy luận một số trang. Một máy chủ có thể ký một trình chiếu, gắn nó với một phiên bản danh mục, hoặc lập bản đồ cho trạng thái riêng tư. Đó là chi tiết thực hiện của máy chủ.

Máy chủ mẫu cố ý trả lại `""`Sau trang đầu tiên. khách hàng phải gửi giá trị chính xác trên yêu cầu thứ hai.

```text
<first request with no cursor>
<second request with cursor "">
```

Các trình chiếu không hợp lệ tạo ra các tham số không hợp lệ JSON-RPC, mã `-32602`- Tôi không biết.

## Việc hoàn thành là một bề mặt được ủy quyền

`completion/complete`cung cấp các gợi ý cho các lập luận nhanh chóng và lập luận mẫu tài nguyên. Nó hữu ích cho các biểu mẫu tương tác, nhưng nó có thể rò rỉ tên mà các phương pháp danh sách thông thường bảo vệ.

Một yêu cầu hoàn thành nêu tên tham chiếu và lập luận được hoàn thành:

```json
{
  "method": "completion/complete",
  "params": {
    "ref": {
      "type": "ref/prompt",
      "name": "deployment_review"
    },
    "argument": {
      "name": "environment",
      "value": "st"
    }
  }
}
```

Kết quả trả lại tối đa 100 giá trị và có thể báo cáo `total`+`hasMore`- Tôi không biết.

Sử dụng cùng ranh giới ủy quyền được sử dụng bởi prompt hoặc nguồn tham khảo.`development`và `staging`Chỉ có một người vận hành mới có thể nhận được`production`- Tôi không biết.

Việc hoàn thành sản xuất cũng cần:

- xác thực đầu vào;
- lọc thông tin cho người gọi;
- yêu cầu khai báo cho khách hàng;
- giới hạn tốc độ trong máy chủ;
- số kết quả bị giới hạn;
- Các nhật ký không tiết lộ các giá trị gợi ý nhạy cảm.

Hoàn thành là hỗ trợ, không phải là khám phá.

## Hai lớp lỗi

Giữ lỗi giao thức tách biệt với lỗi thực hiện công cụ.

Sử dụng lỗi JSON-RPC khi yêu cầu MCP không thể được gửi đúng:

- Tên công cụ không rõ;
- hình dạng yêu cầu bị biến dạng;
- Mẫu dữ liệu yêu cầu bị thiếu;
- Cursor không hiệu quả.

Sử dụng kết quả công cụ đầy đủ với `isError: true`Khi cuộc gọi đến công cụ và công cụ báo cáo một lỗi có thể xử lý:

- nguồn báo cáo không có sẵn;
- một ngày nằm ngoài phạm vi hỗ trợ;
- một quy tắc kinh doanh từ chối hoạt động yêu cầu.

Các mô hình thường có thể sửa lỗi thực hiện công cụ. Họ không thể sửa chữa một máy chủ vi phạm sơ đồ đầu ra của riêng mình.

Nếu công cụ tuyên bố một sơ đồ đầu ra, mô hình một lỗi có thể thực hiện bên trong đó
Chế độ.`route_report`thất bại trả lại khu vực yêu cầu của nó với
`accepted: false`, bên cạnh văn bản lỗi có thể đọc được bởi con người và `isError: true`- Tôi không biết.

## Hãy xây dựng nó

`code/main.py`xây dựng cả hai bên của ranh giới với thư viện tiêu chuẩn Python.

Các máy chủ thực hiện:

- xác thực các siêu dữ liệu MCP theo yêu cầu;
- `server/discover`có khả năng hoàn thành và sử dụng các công cụ;
- xác định `tools/list`Paging;
- bốn mô tả công cụ, bao gồm một mô tả phải bị từ chối;
- đầu ra cấu trúc array;
- mỗi loại khối nội dung công cụ hiện tại;
- một cổng tương đương HTTP được phát trực tuyến giải mã các tiêu đề tham số được công nhận và
  trả lại HTTP `400`cộng với JSON-RPC `-32020`khi không phù hợp;
- hoàn thành được phép và giới hạn tốc độ.

Khách hàng thực hiện:

- Nhận phép sử dụng mô tả;
- cây đầy ắp`x-mcp-header`xác thực vị trí và chính sách lĩnh vực nhạy cảm;
- mã hóa giá trị UTF-8 chính xác-ASCII hoặc base64,
- một vòng trục trình chiếu không minh bạch theo một chuỗi trống;
- lập luận và xác nhận kết quả;
- xác thực khối nội dung;
- các sự kiện kiểm toán tiêu đề có tên nhưng không có giá trị.

Các mô tả vô tình không an toàn là dữ liệu giảng dạy. Nó chứng minh rằng một công cụ bị từ chối không ngăn chặn các công cụ hợp lệ tải.

## Sử dụng nó

Từ nguồn kho:

```bash
cd phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Các bản in demo công cụ được chấp nhận, mô tả bị từ chối, cả hai trang
yêu cầu, nội dung mảng cấu trúc, loại khối nội dung, tiêu đề gương
tên, cho dù giá trị được yêu cầu mã hóa, trạng thái độ tương đương HTTP, và
giá trị hoàn thành được lọc theo người gọi.

## Phòng thí nghiệm tương tác

Mở ra`code/main.py`và tìm vị trí `TOOLS`- Tôi không biết.

1. Thay đổi`tag_catalog.outputSchema.type`từ `array`đến`object`- Tôi không biết.
2. Chạy demo. Khách hàng nên từ chối array trả lại.
3. Khôi phục lại kế hoạch.
4. Hãy giữ trang đầu tiên `nextCursor`như `""`, sau đó làm cho trang cuối cùng trở lại
   `nextCursor: None`thay vì bỏ qua trường.
5. Thực hiện các xét nghiệm và so sánh dấu vết của trình chiếu.
6. Thêm `x-mcp-header: "Authorization"`đến một thuộc tính dây.
7. Đáp định mô tả xác nhận nhận từ chối nó trước khi gọi.
8. Hãy thử`region`các giá trị chứa Unicode, một dòng mới, không gian xung quanh, và
   văn bản theo nghĩa đen `=?base64?SGVsbG8=?=`. Khóa mã mỗi tiêu đề phát ra và chứng minh
   giá trị ban đầu tồn tại chính xác.
9. Di chuyển ghi chú dưới `oneOf`- `items`, hoặc một `$ref`Định nghĩa.
   mỗi mô tả bị từ chối ngay cả khi nhánh đó không bao giờ được sử dụng bởi demo.
10. Tắt tiêu đề được công nhận hoặc thay đổi giá trị giải mã của nó.
    Status return boundary `400`và mã JSON-RPC `-32020`- Tôi không biết.

Ý tưởng không phải là ghi nhớ hình dạng JSON mà là xem mỗi cổng thất bại ở biên giới mà nó sở hữu.

## Phòng thí nghiệm thực hành

Tăng cường phòng thí nghiệm hợp đồng với một `search_evidence`công cụ.

Yêu cầu:

1. Các quy trình đầu vào của nó chấp nhận `query`- `limit`, và một cái khoá`region`trường định tuyến.
2. Chế độ đầu ra của nó là một mảng các đối tượng với `uri`- `title`, và`score`- Tôi không biết.
3. Kết quả bao gồm văn bản tương thích và một liên kết tài nguyên cho mỗi mục.
4. Các lập luận bác bỏ các tính chất không rõ.
5. `limit`được giới hạn bởi sự xác thực ứng dụng.
6. Một người gọi không truy cập vào một URI không bao giờ thấy URI đó thông qua hoàn thành hoặc công cụ đầu ra.
7. Các bài kiểm tra bao gồm điểm không phù hợp, ghi chú tiêu đề không hợp lệ và danh sách hai trang.
8. Các bài kiểm tra giá trị tiêu đề bao gồm ASCII, Unicode, ký tự điều khiển hiển thị,
   không gian trắng, văn bản trông như sentinel, và cả hai là các giới hạn toàn số an toàn JavaScript.
9. Thiết bị HTTP chấp nhận tên tiêu đề không nhạy cảm với trường hợp nhưng từ chối mất
   hoặc không phù hợp với các giá trị được công nhận với trạng thái `400`và mã `-32020`- Tôi không biết.

## Các đồ tạo tác được vận chuyển

`outputs/skill-mcp-contract-reviewer.md`là một kỹ năng đánh giá bằng phẳng, có thể sử dụng lại. Cho nó một mô tả công cụ, kết quả mẫu, hành vi trang và chính sách hoàn thành. Nó trả lại một quyết định nhập học, kế hoạch xác thực kết quả, chính sách tiêu đề và các thử nghiệm thất bại cụ thể.

## Hãy kiểm tra

Bài học hoàn thành khi những câu nói sau đây là đúng:

- `tools/list`trả lại cùng một thứ tự logic cho các cuộc gọi lặp đi lặp lại.
- Khách hàng thực hiện yêu cầu thứ hai khi `nextCursor`là `""`- Tôi không biết.
- Các mô tả tiêu đề nhạy cảm không an toàn được loại trừ trong khi các công cụ khác vẫn có sẵn.
- Một mảng vượt qua sơ đồ đầu ra mảng của nó.
- Một đối tượng thất bại trong cùng một sơ đồ array.
- Kết quả lỗi không thể bỏ qua hoặc vi phạm một sơ đồ đầu ra được xuất bản.
- Văn bản, hình ảnh, âm thanh, liên kết tài nguyên và khối tài nguyên nhúng xác thực.
- Các sự kiện kiểm toán tiêu đề chứa tên và không có giá trị.
- ASCII hiển thị đơn giản vẫn đơn giản; Unicode, kiểm soát, đệm, trống, và
  giá trị trông như sentinel đi lại qua mã hóa chính xác base64 UTF-8.
- Các số nguyên được phản chiếu bên ngoài phạm vi an toàn JavaScript được từ chối.
- Các ghi chú dưới `oneOf`- `items`, vật thể đốn,`$ref`các định nghĩa, hoặc
  Các chương trình sản xuất được từ chối trong thời gian nhập học.
- Tên tiêu đề được công nhận không nhạy cảm với trường hợp chỉ được thông qua khi giá trị được giải mã
  chính xác phù hợp với cơ thể; các bản sao bị thiếu hoặc không phù hợp tạo ra HTTP `400`
  và JSON-RPC `-32020`- Tôi không biết.
- Việc phân tích hoàn thành không bao giờ trở lại `production`- Tôi không biết.
- Một lỗi công cụ sử dụng `isError: true`; một cuộc gọi giao thức bị hình thành sai sử dụng JSON-RPC `error`- Tôi không biết.

## Các chế độ sản xuất thất bại

| Failure | What the learner sees | Correct response |
|---------|-----------------------|------------------|
| Client assumes object output | Valid arrays fail or are silently wrapped | Validate against the published schema without object-only types |
| Empty cursor treated as false | Final pages disappear | Continue whenever `nextCursor` is present and non-null |
| Sensitive value mirrored | Secret appears in proxy, WAF, or trace data | Reject the descriptor and keep secrets in protected request data |
| Raw Unicode or whitespace mirrored | Gateway and origin disagree or the value is normalized | Use exact base64 UTF-8 sentinel encoding and compare after decoding |
| Annotation hidden in a schema branch | A client misses routing metadata during admission | Traverse the entire schema tree and allow only direct top-level properties |
| Large integer mirrored | JavaScript intermediary rounds the routing value | Reject values outside the JavaScript safe integer range |
| Header and body disagree | Gateway routes one target while the origin executes another | Reject before dispatch with HTTP `400` and JSON-RPC `-32020` |
| Output schema ignored | Downstream code consumes corrupt structure | Validate before model or application use |
| Resource link trusted automatically | Caller follows an unauthorized URI | Reauthorize every resource read |
| Completion shares global suggestions | Hidden tenant names leak | Filter by caller, reference, and authorization |
| Tool annotations treated as policy | Destructive operation bypasses confirmation | Enforce authorization and approval outside annotations |
| One malformed tool breaks discovery | Entire server becomes unavailable | Reject the bad descriptor and admit valid tools independently |

## Kết nối Capstone

Bạch đá cuối giai đoạn 13 cần một cổng thông tin có thể hợp nhất các công cụ từ nhiều máy chủ. Bài học này cung cấp lõi nhập học của nó.

Sử dụng hiện vật để phân loại bốn mảnh bằng chứng đáy đầu:

- phát hiện xác định và trang hoàn chỉnh;
- xác thực mô tả trước khi tiếp xúc với mô hình;
- Kết quả kết quả có cấu trúc được xác nhận cộng với các khối nội dung bị giới hạn;
- hoàn thành và định tuyến metadata giữ cho giới hạn ủy quyền.

Đừng tuyên bố tương thích của gateway từ một thành công `tools/call`Chỉ riêng. chụp mô tả, truy cập trang, bộ công cụ được chấp nhận, bộ công cụ bị từ chối, và một kết quả được xác nhận.

## Các điều khoản chính

| Term | Meaning |
|------|---------|
| `inputSchema` | JSON Schema object defining accepted tool arguments |
| `outputSchema` | Optional JSON Schema defining `structuredContent` |
| `structuredContent` | Any JSON value produced by a tool result |
| Content block | Typed text, image, audio, resource link, or embedded resource |
| `x-mcp-header` | Schema annotation that mirrors a primitive argument into Streamable HTTP metadata |
| Opaque cursor | Server-issued pagination token whose value the client does not interpret |
| Completion reference | Prompt name or resource URI/template whose argument is being completed |
| Admission | Client decision to expose or reject a discovered descriptor |

## Đọc thêm

- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP Completion](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/completion)
- [MCP Pagination](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination)
- [MCP Streamable HTTP Parameter Headers](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#custom-headers-from-tool-parameters)
