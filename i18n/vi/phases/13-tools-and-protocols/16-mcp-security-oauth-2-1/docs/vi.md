# Kiểm tra: CIMD, Cụm liên kết của nhà phát hành, PKCE và Step-Up

> Một yêu cầu từ xa của MCP là không có quốc gia, nhưng sự ủy quyền của nó không ẩn danh. Kết nối mọi giấy chứng nhận với nhà phát hành đã tạo nó và mỗi token với tài nguyên nhận nó.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 15 (security)
**Time:** ~90 minutes

## Mục tiêu học tập

- Khám phá các máy chủ ủy quyền thông qua metadata nguồn được bảo vệ.
- Tích thích Tài liệu Metadata ID khách hàng hơn là đăng ký khách hàng động lỗi thời.
- Hãy tuyên bố đúng `application_type`khi một con đường tương thích DCR là không thể tránh khỏi.
- Thiết lập câu trả lời cho phép `iss`và tách các thông tin tín dụng theo nhà phát hành.
- Sử dụng PKCE, chỉ số nguồn lực, xác thực khán giả và phạm vi tăng trưởng.
- Gửi yêu cầu được ủy quyền của MCP 2026-07-28 mà không cần các phiên giao thức.

## Vấn đề

Một máy chủ MCP từ xa có thể đọc hồ sơ riêng tư, viết hệ thống bên ngoài hoặc kích hoạt công việc tốn kém.

- Quản lý nào đã phát hành giấy chứng nhận?
- MCP là mã thông báo cho nguồn nào?
- Client nào và URI chuyển hướng đã hoàn thành dòng chảy?
- Người dùng đã chấp thuận các hoạt động nào?
- Liệu yêu cầu chính xác này vẫn phù hợp với sự chấp thuận đó?

Profil ủy quyền 2026-07-28 làm cứng đăng ký khách hàng và xử lý nhà phát hành. Nó thích Tài liệu Metadata ID khách hàng, làm trệ Dinamic Client Registration, yêu cầu quyền `application_type`trên DCR, xác nhận các phản hồi của nhà phát hành RFC 9207, và cấm tái sử dụng chứng chỉ giữa các nhà phát hành.

Những quy tắc này bổ sung vào lõi vô quốc tịch.`Mcp-Session-Id`- Tôi không biết.

## Khái niệm

### Biết ba vai trò

- **MCP client:**gửi yêu cầu thay mặt cho chủ sở hữu tài nguyên.
- **MCP resource server:**chấp nhận token truy cập và phục vụ điểm cuối MCP.
- **Authorization server:**xác thực chủ sở hữu tài nguyên, thu thập sự đồng ý và phát hành token.

Các máy chủ tài nguyên và máy chủ ủy quyền có thể được vận hành cùng nhau, nhưng giữ các nhận dạng và trách nhiệm xác thực của họ riêng biệt.

### Truyền phép áp dụng cho HTTP

Các quy định ủy quyền MCP áp dụng cho các giao thông dựa trên HTTP. Một máy chủ studio địa phương chạy dưới ranh giới tin cậy của quy trình và hệ điều hành. Đừng thêm một dòng OAuth trình duyệt giả vào studio chỉ vì sự đối xứng.

Đối với HTTP Streamable từ xa, gửi token người mang vào `Authorization`không bao giờ đặt nó trong URL.

### Bắt đầu với metadata nguồn được bảo vệ

Các nguồn máy chủ xuất bản RFC 9728 metadata:

```json
{
  "resource": "https://notes.example.com/mcp",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:delete", "notes:read", "notes:write"]
}
```

Khách hàng bắt đầu từ URL nguồn MCP, lấy tài liệu này, chọn máy chủ ủy quyền quảng cáo, và sau đó lấy OAuth hoặc OpenID Connect metadata của máy chủ đó.

Bảo tồn con đường tài nguyên khi xây dựng URL nổi tiếng của RFC 9728.`https://notes.example.com/mcp`, bài học này sử dụng`https://notes.example.com/.well-known/oauth-protected-resource/mcp`- Thả ra `/mcp`Suffix có thể chọn metadata cho một nguồn bảo vệ khác nhau trên cùng nguồn gốc.

Đừng đoán máy chủ ủy quyền từ tên chủ. Đừng theo dõi nhà phát hành được phát hiện từ một cơ quan lỗi không xác nhận. Hãy giữ một chính sách mà nhà phát hành khách hàng sẵn sàng tin tưởng.

### Kiểm tra dữ liệu siêu dữ liệu máy chủ ủy quyền

Các siêu dữ liệu nên phơi bày các điểm cuối và các điều khiển được hỗ trợ:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "code_challenge_methods_supported": ["S256"],
  "authorization_response_iss_parameter_supported": true,
  "client_id_metadata_document_supported": true
}
```

yêu cầu S256 cho PKCE. ghi lại chuỗi phát hành chính xác. giá trị chính xác đó trở thành chìa khóa cho đăng ký và lưu trữ token.

### Theo ưu tiên đăng ký

Sử dụng thông tin khách hàng đã đăng ký trước khi khách hàng đã có mối quan hệ rõ ràng với nhà phát hành đã chọn. Nếu không, hãy ưu tiên Tài liệu Metadata ID khách hàng khi máy chủ ủy quyền quảng cáo hỗ trợ. Chỉ sử dụng DCR như là sự phục hồi tương thích lỗi thời, sau đó yêu cầu thông tin khách hàng nếu không có một trong những cơ chế đó có sẵn.

### Ưu tiên ID Client Metadata Documents

Tài liệu Metadata ID Client cung cấp cho máy chủ ủy quyền một URL HTTPS là cả nhận dạng khách hàng và vị trí của metadata của nó:

```json
{
  "client_id": "https://client.example.com/oauth/metadata.json",
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

Các máy chủ ủy quyền lấy và xác nhận tài liệu.`client_id`phải là một URL HTTPS với một con đường, và giá trị bên trong tài liệu phải bằng với URL đó chính xác. Các trường tài liệu cần thiết là `client_id`- `client_name`, và`redirect_uris`- `application_type`xuất hiện trong ví dụ này nhưng không phải là yêu cầu CIMD. Việc sử dụng bắt buộc mới của nó cụ thể là con đường DCR.

Chế độ lấy tài liệu như một hoạt động nhạy cảm với SSRF. Giải quyết và xác nhận đích, từ chối các địa chỉ loopback, riêng tư, liên kết địa phương và không được phép, kiểm tra lại sau khi chuyển hướng và thay đổi DNS, giới hạn chuyển hướng, byte và thời gian, yêu cầu JSON, và chỉ theo các kiểm soát cache HTTP được xác nhận.`client_name`và các trường hiển thị khác như văn bản không đáng tin cậy.

CIMD loại bỏ sự cần thiết phải đúc một nhận dạng động mới cho mỗi lần tiếp xúc đầu tiên. Nó không loại bỏ xác thực URI chuyển hướng, chính sách phát hành hoặc sự đồng ý của người dùng.

### DCR là một con đường tương thích

Dynamic Client Registration vẫn có sẵn cho các máy chủ ủy quyền cũ hơn, nhưng nó đã bị lỗi thời cho các triển khai MCP mới.

Khi sử dụng DCR, báo cáo `application_type`- Có thể là:

```json
{
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

- Các máy tính để bàn, di động, dòng lệnh và các khách hàng loopback sử dụng `native`- Tôi không biết.
- Sử dụng các ứng dụng trình duyệt được lưu trữ từ xa `web`và chuyển hướng HTTPS từ xa.

Việc bỏ trường có thể mặc định là `web`trong một thực hiện đăng ký OpenID Connect và làm cho một chuyển hướng vòng lặp hợp pháp thất bại.

Giữ mã DCR đằng sau một quyết định phản hồi rõ ràng. Đừng im lặng quay lại sau khi thất bại xác thực CIMD tùy ý. Điều đó có thể biến một lỗi bảo mật thành một con đường đăng ký yếu hơn.

### Các thông tin tín dụng liên kết với nhà phát hành

Cung cấp tài liệu đăng ký được phát hành bởi nhà phát hành dưới tên chính xác của nhà phát hành:

```text
issuer_credentials[issuer] = pre_registered_or_dcr_client
tokens[(issuer, resource)] = access_token
```

Nếu phát hiện tài nguyên được bảo vệ thay đổi từ `https://auth-one.example`đến`https://auth-two.example`, đánh giá lại niềm tin. Không bao giờ gửi bí mật khách hàng của nhà phát hành đầu tiên, ID khách hàng DCR, mã đăng ký truy cập, mã thông báo cập nhật hoặc mã thông báo truy cập cho nhà phát hành thứ hai. Khách hàng đã đăng ký trước và DCR phải sử dụng các thông tin tín dụng được phát hành cho nhà phát hành mới.

Một ID khách hàng CIMD khác vì nó là một URL HTTPS được lưu trữ tự, chứ không phải một tín hiệu được tạo ra bởi một máy chủ ủy quyền.

### Mã ủy quyền với PKCE

Phòng chảy tương tác là:

1. Tạo ra một lượng entropy cao `code_verifier`- Tôi không biết.
2. Tạo ra S256 `code_challenge`- Tôi không biết.
3. Gửi yêu cầu cấp phép với chính xác `client_id`- `redirect_uri`- `scope`- `code_challenge`, và`resource`- Tôi không biết.
4. Nhận được một câu trả lời về quyền phép có chứa `code`và, khi được cung cấp, `iss`- Tôi không biết.
5. Định hành`iss`đối với nhà phát hành ghi nhận chính xác trước khi sử dụng bất kỳ trường phản hồi nào.
6. Thay đổi mã với `code_verifier`, cùng một URI chuyển hướng, và cùng một `resource`- Tôi không biết.
7. Đặt token kết quả dưới `(issuer, resource)`- Tôi không biết.

- `resource`tham số từ RFC 8707 xuất hiện trong cả yêu cầu ủy quyền và token. Nó xác định URI máy chủ MCP.

### Định hành`iss`chính xác

RFC 9207 ngăn chặn phản ứng ủy quyền từ một nhà phát hành bị nhầm lẫn với phản ứng từ một nhà phát hành khác.

Khi nào `iss`Nếu có sự không phù hợp, đừng hành động trên mã hoặc thậm chí hiển thị chi tiết lỗi được kiểm soát bởi kẻ tấn công từ phản ứng đó.

Một máy chủ ủy quyền bao gồm `iss`quảng cáo `authorization_response_iss_parameter_supported: true`Khách hàng hiện tại vẫn xác nhận một món quà`iss`ngay cả khi quảng cáo đó bị mất.

### Truy cập khán giả tại máy chủ MCP

Các máy chủ tài nguyên chỉ chấp nhận các token được phát hành cho mình:

```text
token.issuer == configured_authorization_server
token.audience == canonical_mcp_resource
```

Các token không hợp lệ, hết hạn, phát hành sai hoặc đối tượng sai nhận 401. Máy chủ MCP không được chấp nhận hoặc chuyển giao một token được dự định cho một dịch vụ khác.

### yêu cầu phạm vi hiện tại nhỏ nhất

Bắt đầu với phạm vi cần thiết ngay bây giờ. Nếu một công cụ sau này yêu cầu nhiều hơn, máy chủ trả lại 403 với thách thức phạm vi có thẩm quyền:

```text
WWW-Authenticate: Bearer error="insufficient_scope",
  scope="notes:delete",
  resource_metadata="https://notes.example.com/.well-known/oauth-protected-resource/mcp"
```

Khách hàng giải thích cho phép mới, nhận được sự đồng ý, thực hiện dòng phép mới với tập hợp phạm vi kết hợp, và thử lại yêu cầu MCP với một ID JSON-RPC mới.

Đừng cho rằng phạm vi thách thức là một bộ phận của `scopes_supported`Thách thức này là có thẩm quyền cho hoạt động hiện tại.

### Giấy phép và dây MCP không có quốc tịch

Một cuộc gọi công cụ được ủy quyền vẫn mang gói yêu cầu hiện tại đầy đủ:

```text
POST /mcp
Authorization: Bearer <access-token>
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.delete
```

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "tools/call",
  "params": {
    "name": "notes.delete",
    "arguments": {"id": "note-7"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "oauth-lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

token cho phép người chủ, request metadata đàm phán hành vi giao thức, không thay thế cho người khác.

Thiết lập dây theo thứ tự cố định: JSON-RPC và các loại metadata, tiêu đề và cơ thể bình đẳng, sau đó hỗ trợ giao thức.`-32020`Nếu tiêu đề và cơ thể đồng ý về một phiên bản không được hỗ trợ, trả về HTTP 400 với `-32022`và `data`Đúng vậy.`{"supported":["2026-07-28"],"requested":"<actual>"}`. Một phương pháp không rõ trả về HTTP 404 với `-32601`- Tôi không biết.

Mỗi lỗi yêu cầu, bao gồm 401 token không hợp lệ và 403 không đủ phạm vi, là một gói lỗi JSON-RPC với yêu cầu ban đầu `id`. Thông tin phục hồi cấu trúc thuộc về lỗi tùy chọn `data``WWW-Authenticate`vẫn là tiêu đề phản hồi HTTP.`id`, vì vậy nó không nhận được cơ thể JSON-RPC. Một thông báo HTTP được chấp nhận trả lại 202 với một cơ thể trống.

Các máy chủ thực hiện `server/discover`và quảng cáo các công cụ, vì vậy nó cũng thực hiện các yêu cầu bắt buộc `tools/list`Các mô tả công cụ của nó có tên, mô tả và gốc đối tượng ổn định.`inputSchema`Các giá trị. Danh sách là xác định và trả lại `resultType`, dữ liệu siêu dữ liệu danh tính máy chủ, một giới hạn `ttlMs`, và`cacheScope`- Khám phá và một danh sách công cụ độc lập với người dùng có thể có sẵn trước khi ủy quyền.

### Không có thẻ thông qua

Một máy chủ MCP không được chuyển giao mã thông tin truy cập MCP của khách hàng sang một API dòng chảy. Nhận một mã thông báo dòng chảy riêng với khán giả phù hợp hoặc sử dụng thiết kế trao đổi mã thông báo rõ ràng. Việc xác thực khán giả chỉ hoạt động khi các dịch vụ từ chối mã thông báo được đúc cho người khác.

### Tấm mã refresh

Các mã thông báo mới là tùy chọn. Khi được phát hành, lưu trữ chúng bí mật và khóa chúng theo nhà phát hành và nguồn lực. Đừng giả định chúng tồn tại. Chuyển chúng khi máy chủ ủy quyền hỗ trợ quay và phát hiện sử dụng lại các giá trị bị vô hiệu hóa.

```figure
t3-scope-stepup
```

## Hãy xây dựng nó

`code/main.py`là một mô phỏng giao thức và ủy quyền trong quá trình. Nó thực hiện phát hiện tài nguyên được bảo vệ, dữ liệu siêu dữ liệu máy chủ ủy quyền, đăng ký CIMD, phiên bản được kiểm tra DCR, kiểm tra loại ứng dụng, PKCE, xác thực nhà phát hành, token bị ràng buộc tài nguyên, tăng phạm vi,`server/discover`- `tools/list`, và yêu cầu công cụ vô quốc tịch.

Mô hình nhận được các cơ quan yêu cầu phân tích và tiêu đề định tuyến. Nó không phải là một bộ điều chỉnh HTTP hoàn chỉnh và không phân tích `Content-Type`hoặc `Accept`Kết nối nó với bộ chuyển đổi HTTP Streamable của bài học 09 , đòi hỏi `Content-Type: application/json`và một `Accept`giá trị chứa cả hai `application/json`và `text/event-stream`- Tôi không biết.

Đi đi.

```bash
cd phases/13-tools-and-protocols/16-mcp-security-oauth-2-1
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

Kết quả xuất hiện cho thấy phát hiện đầu tiên, đăng ký CIMD, đọc thông thường, hai bước tăng phạm vi riêng biệt và lưu trữ tín dụng theo khóa phát hành.

## Sử dụng nó

Bản đồ các đối tượng mô phỏng cho các thành phần sản xuất:

- `ResourceServer.protected_resource_metadata`trở thành điểm cuối RFC 9728.
- `AuthorizationServer.metadata`trở thành phát hiện RFC 8414 hoặc OpenID Connect.
- `Client.enroll`trở thành độ phân giải CIMD cộng với một nhánh tương thích DCR rõ ràng.
- Thông tin tín dụng của khách hàng được phát hành và `tokens_by_issuer_resource`Một URL CIMD có thể vẫn được di động trong khi kết quả ủy quyền của nó vẫn bị ràng buộc bởi nhà phát hành.
- `ResourceServer.handle`trở thành middleware xác nhận tiêu đề MCP hiện tại, token và phạm vi công cụ trước khi gửi trong khi giữ mọi lỗi yêu cầu trong một gói JSON-RPC phù hợp.

## Chuyển nó

Bài học này sẽ đi theo `outputs/skill-oauth-scope-planner.md`Nó hiện thiết kế ưu tiên đăng ký, lưu trữ chứng chỉ liên quan đến nhà phát hành, loại ứng dụng, PKCE, chỉ số nguồn lực, thách thức phạm vi và ranh giới yêu cầu vô quốc tịch hiện tại.

## Các bài tập

1. Thêm vòng quay mã thông báo refresh và từ chối tái sử dụng mã thông báo refresh trước đó.
2. Thêm danh sách quyền phát hành. Khi đổi phát hành, chỉ sử dụng lại một URL CIMD di động; từ chối tất cả các thông tin tín dụng và mã thông báo được phát hành trước đó.
3. Thêm hết hạn vào mã ủy quyền và xác nhận việc trao đổi muộn thất bại.
4. Xây dựng một phiên bản client web với một chuyển hướng HTTPS từ xa và so sánh các metadata DCR của nó với client gốc.
5. Thêm một nguồn tài nguyên thứ hai dưới cùng một nhà phát hành. xác nhận mã truy cập của nó không thể được sử dụng tại nguồn tài nguyên đầu tiên.

## Các điều khoản chính

| Term | Meaning |
|------|---------|
| Protected-resource metadata | RFC 9728 document that identifies the resource and authorization servers |
| CIMD | HTTPS metadata document whose URL is the OAuth client identifier |
| DCR | Deprecated dynamic client enrollment retained for compatibility |
| `application_type` | `native` or `web`, used to validate redirect URI rules |
| PKCE | Verifier and S256 challenge that protect an intercepted authorization code |
| `iss` | RFC 9207 authorization response issuer identifier |
| Resource indicator | RFC 8707 parameter that binds a token request to an MCP resource |
| Audience | Resource for which a token is valid |
| Step-up | New consent and token issuance for an additional current-operation scope |
| Issuer-bound credentials | Registration and token records isolated by exact authorization server issuer |

## Đọc thêm

- [MCP 2026-07-28 authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728)
- [RFC 8707: Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707)
- [RFC 9207: OAuth 2.0 Authorization Server Issuer Identification](https://www.rfc-editor.org/rfc/rfc9207)
- [OAuth Client ID Metadata Document draft](https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/)
