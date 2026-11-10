# Xây dựng khách hàng MCP: Khám phá, định tuyến và sự trở lại hai kỷ nguyên

> Một khách hàng MCP hiện đại lặp lại hợp đồng của mình trên mọi yêu cầu. Quyết định tương thích khó khăn nhất của nó là biết khi nào máy chủ cũ thực sự cũ và khi nào máy chủ hiện đại đang báo cáo một lỗi có thể sửa chữa.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lesson 07
**Time:** ~85 minutes

## Mục tiêu học tập

- Xây dựng mọi MCP `2026-07-28`yêu cầu với các metadata hiện tại.
- Khám phá máy chủ stdio với `server/discover`và chọn một phiên bản hỗ trợ lẫn nhau.
- Cho phép một cuộc thăm dò di sản giới hạn chỉ cho các đồng nghiệp được liệt kê rõ ràng.
- Hãy chấp nhận một kỷ nguyên thừa kế chỉ sau khi xác nhận một điều tích cực `initialize`kết quả cho một sửa đổi được hỗ trợ.
- Thủy lại danh sách các công cụ xác định học mà không bị va chạm.
- Đường dẫn cuộc gọi đến người đồng nghiệp sở hữu mỗi công cụ mà không phát minh ra các phiên giao thức.

## Vấn đề

Một máy chủ đại lý thường nói chuyện với nhiều máy chủ MCP. Nó phải phát hiện từng máy chủ, hợp nhất các danh mục công cụ, giải quyết tên trùng lặp, đường dẫn gọi và phục hồi khỏi sự thất bại giao thông.

- `2026-07-28`sửa đổi làm cho trạng thái ổn định đơn giản hơn vì mỗi yêu cầu tự chủ. Sự tương thích làm cho khởi động tinh tế hơn.

- một máy chủ hiện đại hỗ trợ phiên bản được ưa thích;
- một máy chủ hiện đại trả lại một phiên bản hoặc lỗi tiêu đề được công nhận;
- một máy chủ cũ mà chưa bao giờ nghe nói về `server/discover`-
- một máy chủ cũ mà giữ im lặng cho đến khi nó nhận được `initialize`- Tôi không biết.

Việc xử lý mọi lỗi của con tàu như là lỗi thừa kế là nguy hiểm. Một yêu cầu hiện đại bị sai, một máy chủ quá tải, một quá trình chết và một máy chủ cũ đều có thể tạo ra cùng một thời gian hoặc kết nối kết thúc. Những tín hiệu đó là mơ hồ. Khách hàng phải kết hợp ý định rõ ràng của nhà điều hành với bằng chứng giao thức tích cực trước khi chọn thời kỳ thừa kế.

## Khái niệm

### Một người đồng nghiệp, không phải một phiên giao thức

Giữ một bản ghi tương tự vận chuyển cho mỗi quy trình hoặc điểm cuối của máy chủ:

- chức năng cầm hoặc gửi vận chuyển;
- Thời đại và phiên bản giao thức được chọn;
- khả năng máy chủ được phát hiện lần cuối;
- danh sách các công cụ xác định cuối cùng;
- Đơn vị nhận dạng yêu cầu tương quan đang chờ đợi;
- sức khỏe vận tải.

Đây là kế toán khách hàng. Nó không phải là trạng thái phiên giao thức. Trên MCP hiện đại, máy chủ vẫn nhận phiên bản và khả năng hiện tại trên mỗi yêu cầu.

### Xây dựng mọi yêu cầu hiện đại từ đầu

```python
def modern_request(request_id, method, params, version, capabilities):
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": method,
        "params": {
            **params,
            "_meta": {
                "io.modelcontextprotocol/protocolVersion": version,
                "io.modelcontextprotocol/clientCapabilities": capabilities,
                "io.modelcontextprotocol/clientInfo": CLIENT_INFO,
            },
        },
    }
```

Đừng gắn metadata một lần vào một đối tượng kết nối và giả định nó đã đạt đến dây.

### Phát hiện hiện đại

`server/discover`trả lại các phiên bản được hỗ trợ, khả năng máy chủ, hướng dẫn, gợi ý cache và danh tính máy chủ được khuyến cáo.

Discovery là tùy chọn cho một khách hàng hiện đại, nhưng nó được khuyến cáo trên stdio. Một số máy chủ cũ chấp nhận một hoạt động trước khi khởi động, vì vậy gửi `tools/list`đầu tiên có thể tạo ra một thành công không rõ ràng. `server/discover`tạo ra một ranh giới thời đại sạch sẽ.

### Chuẩn bị kết hợp với stdio

Một khách hàng studio hai thời đại gửi `server/discover`với các metadata hiện đại được ưa thích trước bất kỳ yêu cầu nào khác. Có ba lớp kết quả:

1. **DiscoverResult.**Các máy chủ là hiện đại. Chọn một phiên bản hỗ trợ lẫn nhau và tiếp tục với mỗi yêu cầu metadata.
2. **Recognized modern error.**Máy chủ là hiện đại.`-32022`, chọn từ `data.supported`và thử lại với một ID yêu cầu mới. Đối với các lỗi tiêu đề hoặc khả năng, sửa lỗi yêu cầu. Không gửi `initialize`- Tôi không biết.
3. **Ambiguous signal.**Một lỗi JSON-RPC không được nhận ra, thời gian hết, kết nối đóng hoặc phản ứng trống không xác định một thời đại.

Các lỗi giao thức hiện đại được nhận ra bao gồm:

- `-32020`HeaderThật không phù hợp
- `-32021`Thiếu yêu cầuCơ quan
- `-32022`Không hỗ trợProtocolVersion

Các lỗi hiện đại được nhận ra vẫn hiện đại ngay cả khi người đồng nghiệp đang trên danh sách quyền thừa kế. Một khi máy chủ chứng minh rằng nó hiểu từ vựng lỗi hiện đại, gửi `initialize`sẽ là một mức giảm.

Không điều trị`-32601`Điều này chỉ làm cho một đồng nghiệp được phép rõ ràng đủ điều kiện cho một cuộc thăm dò thừa kế.

### Việc cho phép là ý định của người vận hành, không phải bằng chứng

Sự tương thích của Legacy phải là một thuộc tính rõ ràng của một cấu hình đồng cấp gắn:

```python
client.add_server("archive", archive_transport, allow_legacy=True)
```

Kết nối lựa chọn đó với lệnh hoặc điểm cuối được cấu hình. Đừng sử dụng thẻ hoang dã cho phép một máy chủ tùy tiện tự chọn cho bản thân vào ngữ nghĩa yếu hơn.`allow_legacy=True`thất bại sau khi phát hiện kết quả không rõ ràng và không bao giờ nhận được`initialize`- Tôi không biết.

Người cho phép cho phép thăm dò, không chọn thời đại.`initialize`trong thời hạn bắt buộc khi vận chuyển, sau đó yêu cầu tất cả các điều sau đây:

- một JSON-RPC `2.0`trả lời bằng ID yêu cầu phù hợp;
- chính xác là một.`result`Và không`error`-
- a `protocolVersion`trong bộ sửa đổi cũ được cấu hình của khách hàng;
- một giá trị đối tượng `capabilities`trường;
- a `serverInfo`đối tượng với chuỗi không trống `name`và `version`các cánh đồng.

Một thời gian nghỉ, kết nối kết thúc, phản ứng lỗi, kết quả bị sai, id không phù hợp hoặc sửa đổi không được hỗ trợ không được đóng. Chỉ có kết quả tích cực có tính cấu trúc hợp lệ chọn thời kỳ di sản. Mã thông qua `legacy_probe_timeout_ms`cho bộ chuyển đổi chuyển tiếp; một bộ chuyển đổi thực tế hoặc bộ chuyển đổi HTTP phải thực thi thời hạn đó thay vì chỉ ghi lại nó.

Cache thời gian được chọn cho người giao thông. Đừng tìm kiếm lại trước mỗi cuộc gọi.

### Legacy là một nhánh tương thích

Khi thăm dò giới hạn trả lại bằng chứng thừa kế tích cực hợp lệ, khách hàng sử dụng phiên bản thừa kế được chọn chính xác như được định nghĩa bởi sửa đổi đó:

1. Kiểm tra bao bì phản ứng và ID tương quan.
2. Kiểm tra xem phiên bản sửa đổi được đàm phán là trong bộ nhượng bộ được cấu hình.
3. Lập lại khả năng được xác nhận và danh tính máy chủ.
4. Gửi đi`notifications/initialized`Chỉ sau khi tất cả các kiểm tra qua.
5. Sử dụng các hình thức yêu cầu cũ cho thời gian vận chuyển đó.

Chi nhánh này tồn tại để tương tác với các đồng nghiệp được biết đến. Nó không phải là thiết kế mặc định cho các máy chủ mới hoặc yêu cầu mới. Nếu chuyển tiếp khởi động lại hoặc điểm cuối của nó thay đổi, hãy loại bỏ bộ nhớ cache thời đại đồng nghiệp và đàm phán lại.

### Công cụ phát hiện và lưu trữ cache

Đối với mỗi đồng nghiệp hoạt động, gọi `tools/list`Kết quả hiện đại bao gồm:`resultType`- `ttlMs`, và`cacheScope`. tôn trọng gợi ý tươi mới trong bối cảnh chính xác của phép.

Khách hàng phải chăm sóc một người mất tích.`resultType`từ một máy chủ cũ như `"complete"`Không yêu cầu các trường cache hiện đại trên một phản ứng từ một thời đại đàm phán trước đó.

Các máy chủ phải trả lại định nghĩa đặt hàng. Khách hàng cũng nên sắp xếp trước khi sáp nhập để đặt hàng đăng ký địa phương không phụ thuộc vào thời gian khởi động quy trình.

### Thủy kết không gian tên an toàn đối với va chạm

Hai máy chủ có thể cho thấy cả hai .`search`Chọn chính sách được tuyên bố:

1. **Prefix on collision.**Giữ tên gọi chính thức đầu tiên và tiết lộ các vụ va chạm sau đó như `<server>/<tool>`- Tôi không biết.
2. **Reject on collision.**Đừng tải bản sao và làm cho lỗi cấu hình rõ ràng xuất hiện.
3. **Silent overwrite.**Không bao giờ sử dụng nó. Nó ẩn máy chủ nào nhận được một hành động được chọn bởi mô hình.

lưu trữ cả hai tên theo quy luật và địa phương. mô hình thấy tên theo quy luật.`tools/call`sử dụng tên địa phương mà máy chủ chủ đã tuyên bố.

### Đường dẫn cuộc gọi

Đường dẫn là một tìm kiếm thuần túy:

```text
canonical tool name
  -> peer name + local tool name
  -> new JSON-RPC request id
  -> modern request metadata or explicit legacy shape
  -> matching response id
```

Không gửi một cuộc gọi khi vận chuyển của chủ sở hữu không có sẵn.`tools/list`Các yêu cầu trong chuyến bay hiện đại bị mất trong một chuyến vận chuyển bị hỏng có thể được thử lại với một ID JSON-RPC mới khi chính sách an toàn của hoạt động cho phép.

### Thông báo và đăng ký

Các thay đổi danh sách và tài nguyên hiện đại chỉ xuất hiện khi khách hàng mở `subscriptions/listen`Khách hàng gửi bộ lọc thông báo, chờ đợi`notifications/subscriptions/acknowledged`, và tương quan các sự kiện với ID yêu cầu nghe trong các metadata thông báo.

Khi kết nối, mở một yêu cầu nghe mới và chỉnh sửa danh sách hoặc tài nguyên liên quan.`Last-Event-ID`- Tôi không biết.

### Không có yêu cầu được khởi động bởi máy chủ

Các máy chủ hiện đại không gọi khách hàng với các yêu cầu JSON-RPC độc lập để lấy mẫu, tạo ra hoặc gốc.`input_required`, và khách hàng thử lại yêu cầu ban đầu sau khi đáp ứng các yêu cầu nhập được nhúng.

Đừng chặn trình đọc phản ứng của đồng nghiệp trong khi thực hiện đầu vào. Giữ mối tương quan và tạo một ID JSON-RPC mới cho thử lại.

```figure
tp-client-merge
```

## Sử dụng nó

`code/main.py`sử dụng các chức năng tương tác trong quá trình để các quyết định giao thức vẫn hiển thị. Nó kết nối với hai tương tác hiện đại và một tương tác di sản được phép cố ý, sau đó sáp nhập và định tuyến các công cụ của họ.

```bash
cd code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Các thử nghiệm chứng minh ranh giới mà các bản demo bình thường bỏ qua:

- Các yêu cầu hiện đại lặp lại metadata;
- `-32022`thử lại khám phá hiện đại mà không cần khởi tạo;
- lỗi hiện đại được công nhận không bao giờ giảm cấp, ngay cả đối với một đồng nghiệp được phép;
- thời gian ra ngoài, kết nối đóng cửa, trả lời trống và lỗi không được nhận ra không kích hoạt `initialize`Không có một người được phép;
- một đồng nghiệp được liệt kê trở thành di sản chỉ sau khi có một hợp lệ, được hỗ trợ `initialize`kết quả;
- kết quả thừa kế bị biến dạng và không được hỗ trợ khiến người đồng nghiệp không có sẵn;
- một thời gian được chọn thành công được lưu trữ trong thời gian vận chuyển.

## Chuyển nó

Bài học này sẽ đi theo `outputs/skill-mcp-client-harness.md`Nó cung cấp các thiết kế đặt dấu yêu cầu hiện đại, đàm phán thời đại studio, kết hợp không gian tên xác định, định tuyến và một nhánh tương thích di sản bị đóng cửa.

## Các bài tập

1. Làm một máy chủ giả trở lại `-32022`Không có phiên bản hỗ trợ lẫn nhau. xác nhận khách hàng thất bại thay vì gửi `initialize`- Tôi không biết.
2. Cho phép một máy chủ cũ giả, làm cho nó bị giới hạn `initialize`- Đánh giá thời gian và chứng minh các đồng nghiệp vẫn ở lại.`unknown`và không có sẵn.
3. Thêm `cacheScope: "private"`danh sách công cụ cho hai ngữ cảnh ủy quyền. xác nhận khách hàng không bao giờ chia sẻ kết quả được lưu trữ trong cache của một ngữ cảnh với một ngữ cảnh khác.
4. Thay đổi chính sách va chạm thành từ chối và làm cho khởi động thất bại với cả hai tên đồng nghiệp trong lỗi.
5. Thêm một số hữu hạn `subscriptions/listen`Khi mất dòng, nghe lại với một ID yêu cầu mới và các công cụ chỉnh sửa.

## Các điều khoản chính

| Term | Meaning |
|------|---------|
| Peer | Client-side record for one server transport and its discovered data |
| Protocol era | Modern per-request metadata or legacy initialization semantics |
| Discovery probe | Initial `server/discover` used to identify the stdio era |
| Recognized modern error | Error that proves modern behavior and forbids legacy fallback |
| Legacy allowlist | Operator configuration permitting one bounded compatibility probe for a pinned peer |
| Positive legacy evidence | Valid, correlated `initialize` result for an explicitly supported legacy revision |
| Merged namespace | Canonical tool names across all active peers |
| Collision policy | Prefix or reject rule for duplicate tool names |
| Era cache | Selected modern or legacy behavior stored for one transport peer |
| Transport recovery | Restart or reconnect, rediscover, relist, and retry safely with a new id |

## Đọc thêm

- [MCP Specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/)
- [MCP Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [MCP Versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
