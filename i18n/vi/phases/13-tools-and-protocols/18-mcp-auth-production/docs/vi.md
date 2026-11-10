# MCP Author in Production: Đăng ký và token liên kết với nhà phát hành

> Bài học 16 xây dựng máy trạng thái OAuth 2.1. Bài học này làm cứng ranh giới sản xuất của nó cho MCP 2026-07-28: Tài liệu Metadata ID Khách hàng trước, đăng ký động hóa lỗi thời chỉ cho sự tương thích, xác thực cấp phép-phản ứng của nhà phát hành, tín chỉ khách hàng có chìa khóa cấp phép, cập nhật JWKS và token được gắn vào khán giả trên mỗi yêu cầu không có trạng thái.
>
> **Spec note (2026-07-28):**Dynamic Client Registration bị lỗi thời để ủng hộ các tài liệu Metadata ID của khách hàng. DCR vẫn là một cơ chế tương thích. Khi được sử dụng, khách hàng tuyên bố đúng `application_type`. Khách hàng xác nhận RFC 9207 hiện tại `iss`giá trị và không bao giờ sử dụng lại các thông tin tín dụng trên các nhà phát hành máy chủ ủy quyền.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 16 (OAuth 2.1 state machine), Phase 13 · 17 (gateways)
**Time:** ~90 minutes

## Mục tiêu học tập

- Khám phá một máy chủ ủy quyền thông qua RFC 8414 siêu dữ liệu và xác minh hợp đồng.
- Đăng vào một Tài liệu Metadata ID Khách hàng và tách DCR lỗi thời như một sự trở lại.
- Thiết lập RFC 9207 `iss`, đăng ký chính bởi nhà phát hành máy chủ ủy quyền, và các mã thông báo chính bị ràng buộc tài nguyên bởi nhà phát hành cộng tài nguyên.
- Cache và làm mới các phím JWKS theo một lịch trình để xác minh chữ ký tồn tại khi phím được lật lại.
- Pin token vào một nguồn MCP duy nhất bằng cách sử dụng các chỉ số nguồn RFC 8707 và từ chối tái sử dụng hỗn loạn-đại diện.
- Chọn xác thực JWT hoặc kiểm tra nội bộ token, xác định tính tươi mới của việc hủy bỏ, và thất bại an toàn khi các phụ thuộc về danh tính không có sẵn.
- Chia tách máy chủ ủy quyền, máy chủ tài nguyên và khách hàng để mỗi người chỉ thực thi kiểm tra của riêng mình.
- Kiểm tra một máy chủ ủy quyền đối với danh sách kiểm tra triển khai và từ chối đăng ký không an toàn hoặc tái sử dụng token.

## Vấn đề

Máy mô phỏng Bài học 16 chạy OAuth 2.1 trong bộ nhớ.

Sự khác biệt đầu tiên là đăng ký và cách ly tín chỉ. Một tổ chức thực sự có thể chạy hàng trăm máy chủ MCP và hàng ngàn khách hàng MCP.**Client ID Metadata Document**: client sử dụng một URL HTTPS với một con đường mà nó kiểm soát như là nhận dạng của nó, và máy chủ ủy quyền kéo metadata. RFC 7591 đăng ký động chỉ còn lại như một con đường tương thích lỗi thời. Khi DCR là không thể tránh khỏi, yêu cầu tuyên bố chính xác `application_type`. Khách hàng lưu trữ các đăng ký dưới các nhà phát hành máy chủ cấp phép và các token truy cập dưới `(issuer, resource)`Một nhà phát hành thay đổi có nghĩa là một người đăng ký mới, và một nguồn khác có nghĩa là một token riêng biệt đối với khán giả.

Khoảng cách thứ hai là quay chìa khóa. Việc xác thực JWT phụ thuộc vào các khóa ký của máy chủ ủy quyền, được xuất bản dưới dạng một bộ khóa web JSON (JWKS). Các máy chủ ủy quyền xoay chúng theo một lịch trình (thường là hàng giờ, đôi khi nhanh hơn trong phản ứng sự cố). Một máy chủ MCP lấy JWKS một lần khởi động xác nhận tốt cho đến khi cửa sổ quay  sau đó mỗi yêu cầu thất bại cho đến khi khởi động lại. Các dây sản xuất JWKS như một giá trị được lưu trữ trong cache với một công việc làm mới làm việc ghi lại bộ nhớ cache trước khi các khóa trước hết hạn, cộng với một lần thu hồi về cache bị bỏ lỡ cho trường hợp một token được ký bởi một khóa mới hơn bộ nhớ cache đến.

Hỗng thứ ba là liên kết đối tượng. Bài học 16 đã giới thiệu các chỉ số nguồn lực RFC 8707. Trong sản xuất, chỉ số đó trở thành kiểm tra yêu cầu khó khăn trên mọi yêu cầu.`token.aud`chống lại URL nguồn riêng của nó và từ chối sự không phù hợp với HTTP 401. Đây là biện pháp phòng thủ duy nhất chống lại một máy chủ MCP trên dòng (hoặc một khách hàng độc hại nắm giữ một token được thiết kế cho một máy chủ) chơi lại token đó với một máy chủ khác trong cùng một lưới tin cậy.

Bài học này sẽ vẽ mỗi khoảng trống trên một mảnh bê tông của bề mặt. Tài liệu siêu dữ liệu là điểm cuối HTTP. JWKS cache refresh là một công việc được lên lịch cộng với một key-value cache. JWT xác thực là một thói quen các nguồn lực máy chủ chạy trước khi gửi bất kỳ công cụ. Giữ ba vai trò riêng biệt và mỗi người chỉ thực thi kiểm tra mà nó sở hữu: máy chủ ủy quyền phát hành và xoay các khóa, máy chủ tài nguyên lưu trữ và xác nhận, khách hàng phát hiện và đăng ký.

## Khối hạn: Thực thi sản xuất sau bài học 16

[Lesson 16: MCP Security with OAuth 2.1](../../16-mcp-security-oauth-2-1/docs/en.md)sở hữu máy trạng thái mã ủy quyền, PKCE, phát hiện tài nguyên được bảo vệ, chỉ số tài nguyên và quyết định phạm vi. Bài học này không xác định dòng chảy OAuth thứ hai. Nó bắt đầu sau khi các hợp đồng đó tồn tại và hỏi làm thế nào một máy chủ tài nguyên được triển khai tiếp tục thực thi chúng trong quá trình xoay khóa, xác thực mã thông báo không minh bạch, hủy bỏ, thất bại phụ thuộc, triển khai và phản ứng sự cố.

Biên giới sản xuất hẹp hơn và hoạt động tốt hơn:

- Một con đường JWT xác minh một nhà phát hành, thuật toán, khóa ký hiệu, khán giả, yêu cầu thời gian và phạm vi trên mỗi yêu cầu trong khi làm mới JWKS an toàn.
- Một đường đi mã thông báo không minh bạch gọi điểm cuối tự quan sát xác thực của nhà phát hành và xác nhận trạng thái hoạt động, khán giả hoặc nguồn lực, hết hạn, đối tượng và phạm vi được trả lại.
- Chính sách hủy bỏ xác định tốc độ một giấy chứng nhận phải ngừng hoạt động và cache nào có thể trì hoãn sự kiện đó.
- Chính sách thất bại quyết định những gì xảy ra khi phát hiện, JWKS, tự khám phá, hoặc thu hồi cơ sở hạ tầng không sẵn sàng.
- Các hồ sơ bằng chứng mà người phát hành siêu dữ liệu, bộ khóa hoặc phản ứng tự xem, yêu cầu token, phiên bản chính sách và lý do từ chối đã thúc đẩy kết quả mà không lưu trữ token.

Sự phân biệt này giữ cho các bài học được kết hợp. Bài học 16 chứng minh dòng chảy. Bài học 18 chứng minh rằng một token vẫn đáng tin cậy, hoặc bị từ chối, sau khi nó đạt đến một con đường yêu cầu MCP thực sự.

## Khái niệm

### RFC 8414  OAuth Authorization Server Metadata

Một tài liệu tại `/.well-known/oauth-authorization-server`mô tả mọi thứ mà khách hàng cần:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "client_id_metadata_document_supported": true,
  "registration_endpoint": "https://auth.example.com/register",
  "authorization_response_iss_parameter_supported": true,
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["mcp:tools.read", "mcp:tools.invoke"],
  "token_endpoint_auth_methods_supported": ["none", "private_key_jwt"]
}
```

Một client được trao một MCP nguồn URL chuỗi phát hiện: `oauth-protected-resource`từ RFC 9728 (tài liệu của máy chủ tài nguyên) đặt tên cho nhà phát hành, sau đó `oauth-authorization-server`(RFC này) đặt tên cho mỗi điểm cuối. Client không bao giờ mã hóa một URL ủy quyền.

Đối với một công cụ nhận dạng tài nguyên với một con đường, hãy chèn phần được biết đến trước con đường đó. Ví dụ: `https://mcp.example.com/team/server`giải quyết các metadata nguồn được bảo vệ tại `https://mcp.example.com/.well-known/oauth-protected-resource/team/server`- Thêm vào`/.well-known/...`sau khi con đường nguồn tài nguyên không chính xác.

Hợp đồng mà bạn xác minh trước khi tin tưởng một IDP cho MCP:

- `code_challenge_methods_supported`bao gồm `S256`(PKCE theo RFC 7636).**absent**, máy chủ ủy quyền không hỗ trợ PKCE và khách hàng **MUST**từ chối tiến hành.
- `grant_types_supported`bao gồm `authorization_code`và từ chối `password`và `implicit`- Tôi không biết.
- Ít nhất một con đường đăng ký có sẵn: `client_id_metadata_document_supported: true`(CIMD, ưu tiên), một khách hàng đã đăng ký trước, hoặc `registration_endpoint`(sự tương thích RFC 7591 bị giảm).
- Nếu`authorization_response_iss_parameter_supported`đúng, khách hàng yêu cầu trả lại RFC 9207 `iss`và so sánh nó chính xác với nhà phát hành đã ghi trước khi chuyển hướng.
- `response_types_supported`chính xác `["code"]`cho OAuth 2.1.

Nếu`S256`Nếu không có, máy chủ MCP từ chối triển khai chống lại IdP này không có chế độ xuống cấp cho PKCE. Nếu *không có * đường đăng ký được quảng cáo và bạn không có đăng ký trước `client_id`, bạn cũng không thể đăng ký; bản ghi việc triển khai là sai, không phải mã.

### RFC 9728 (sửa lại)  Phụ liệu siêu dữ liệu nguồn được bảo vệ

Bài học 16 bao gồm RFC 9728. Delta trong sản xuất: tài liệu này là nơi duy nhất mà khách hàng tìm kiếm để tìm các máy chủ ủy quyền được tin cậy bởi máy chủ MCP này. Một máy chủ MCP duy nhất có thể chấp nhận token từ nhiều IdP (một cho nhân viên, một cho đối tác). RFC 9728 tuyên bố bộ đó; RFC 8414 tài liệu những gì mỗi IdP hỗ trợ.

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### Tài liệu Metadata ID khách hàng (được khuyến cáo mặc định)

CIMD đảo ngược đăng ký từ *push* đến *pull*. Thay vì yêu cầu máy chủ ủy quyền để mint một `client_id`, khách hàng sử dụng một URL HTTPS nó kiểm soát **as**của nó`client_id`. URL được giải quyết thành một tài liệu siêu dữ liệu JSON; máy chủ ủy quyền lấy nó theo yêu cầu trong dòng OAuth.`app.example.com`, nó tin vào khách hàng được phục vụ từ`https://app.example.com/client.json`Không có đăng ký đi lại, không.`client_id`không gian tên để thải, không có trạng thái trên máy chủ để giữ đồng bộ.

Tài liệu siêu dữ liệu mà khách hàng lưu trữ:

```json
{
  "client_id": "https://app.example.com/oauth/client.json",
  "client_name": "Example MCP Client",
  "client_uri": "https://app.example.com",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:7333/callback", "http://localhost:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

- `client_id`giá trị trong tài liệu **MUST**bằng với URL mà nó được phục vụ (tạm dịch: server ủy quyền xác minh điều này; sự không phù hợp được từ chối).`client_id_metadata_document_supported: true`trong RFC 8414 metadata của nó.

Đối với hợp đồng hiện tại của CIMD, `client_id`- `client_name`, và không trống `redirect_uris`Các mục tiêu của các ứng dụng này là các mục tiêu của các ứng dụng khác nhau.`application_type`Có thể được bao gồm, nhưng nó không phải là một trường CIMD bắt buộc.`application_type`vào con đường CIMD được ưa thích.

Hai sự thật về an ninh mà thông số nói thẳng thắn:

- **SSRF.**Các máy chủ ủy quyền lấy một URL được cung cấp bởi kẻ tấn công. Nó phải bảo vệ chống lại giả mạo yêu cầu bên máy chủ (không lấy đến các điểm cuối nội bộ / admin).
- **localhost impersonation.**CIMD một mình không thể ngăn chặn một kẻ tấn công địa phương yêu cầu URL siêu dữ liệu của khách hàng hợp pháp và liên kết bất kỳ `localhost`chuyển hướng. máy chủ ủy quyền **MUST**hiển thị rõ ràng tên chủ URI chuyển hướng trong khi đồng ý và **SHOULD**cảnh báo về `localhost`- Chỉ chuyển hướng.

Vì CIMD không cần trạng thái bên máy chủ, không có nhà đăng ký để đứng lên theo cách DCR yêu cầu. Bên khách hàng chỉ đọc: phục vụ tài liệu siêu dữ liệu của bạn từ điểm cuối HTTPS tĩnh và để máy chủ ủy quyền kéo nó.

Nếu nhà khai thác máy chủ ủy quyền đã cung cấp một nhận dạng khách hàng, hãy sử dụng đăng ký có quy mô của nhà phát hành trước khi thử đăng ký tự động. Nếu không, hãy ưu tiên CIMD. Chỉ sử dụng DCR lỗi thời khi nhà phát hành không thể sử dụng cả đăng ký trước hoặc CIMD.

### RFC 7591: Việc ghi danh tính tương thích đã lỗi thời

DCR đã bị lỗi thời trong phiên bản sửa đổi 2026-07-28. Chỉ lưu trữ cho các máy chủ ủy quyền không thể tiêu thụ CIMD và khi đăng ký trước là không thực tế.

```json
POST /register
Content-Type: application/json

{
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "mcp:tools.invoke",
  "client_name": "Cursor",
  "software_id": "com.cursor.cursor",
  "software_version": "0.42.0"
}
```

Server trả lời với `client_id`và một `registration_access_token`cho các bản cập nhật sau:

```json
{
  "client_id": "c_3e7f1a",
  "client_id_issued_at": 1769472000,
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "registration_access_token": "regt_b2...",
  "registration_client_uri": "https://auth.example.com/register/c_3e7f1a"
}
```

`application_type`không phải là trang trí. Một máy tính để bàn lặp lại client tuyên bố `native`; một khách hàng được lưu trữ trên máy chủ tuyên bố `web`và sử dụng HTTPS chuyển hướng URI. `token_endpoint_auth_method: none`là mặc định đúng cho một khách hàng địa phương công cộng.`client_id`Chỉ có PKCE cung cấp bằng chứng sở hữu.

Ba cái bẫy sản xuất:

- Điểm cuối đăng ký phải được giới hạn theo IP nguồn. Nếu không có đó, một diễn viên thù địch sẽ viết hàng triệu đăng ký giả và làm hết các `client_id`Thực hiện kiểm tra giới hạn giá trước khi nhà đăng ký xử lý yêu cầu.
- `software_statement`(một chứng thực JWT được ký kết cho khách hàng) được yêu cầu bởi một số IDP doanh nghiệp. Phong cách của bài học bỏ qua nó; dây sản xuất một bước xác minh từ chối đăng ký chưa ký từ bất cứ thứ gì khác ngoài localhost chuyển hướng URI.
- - `registration_access_token`Việc đánh cắp token này có nghĩa là kẻ tấn công có thể viết lại các URL của khách hàng.

### RFC 8707 (sửa lại)  Chỉ số nguồn lực

Bài học 16 đã thiết lập hình dạng. quy tắc sản xuất: mỗi yêu cầu token bao gồm `resource=<canonical-mcp-url>`, và máy chủ MCP xác minh `token.aud`URI Canonical là chỉ số * cụ thể nhất * cho máy chủ: nó sử dụng các chương trình nhỏ chữ và chủ, không có mảnh, và thông thường không có slash sau.**not**được loại bỏ bởi quy tắc  thông số kỹ thuật giữ nó khi cần thiết để xác định một máy chủ MCP riêng lẻ. `https://mcp.example.com`- `https://mcp.example.com/mcp`- `https://mcp.example.com:8443`, và`https://mcp.example.com/server/mcp`là tất cả các URI hợp lệ. chọn một trên mỗi máy chủ và pin`aud`(Phần này sử dụng khán giả khán giả như `https://notes.example.com`cho ngắn gọn; một triển khai đồng chủ nhiều máy chủ MCP dưới một nguồn gốc phân biệt chúng theo đường đi.)

### RFC 7636 (sửa lại)  PKCE

PKCE là bắt buộc trong OAuth 2.1.`code_challenge`và `code_verifier`. Server từ chối bất kỳ yêu cầu token nào mà không có xác minh hoặc với xác minh không hash cho thách thức được lưu trữ.

### MCP 2026-07-28 hồ sơ cấp phép

Bản sửa đổi MCP hiện tại giữ ranh giới nguồn lực-thư chủ OAuth trong khi làm cho giao thông MCP không có trạng thái. Không có phiên giao thức để lưu trữ quyết định danh tính.

- Thực hiện RFC 9728 được bảo vệ nguồn metadata, và cung cấp vị trí của nó hoặc thông qua `WWW-Authenticate: Bearer resource_metadata="..."`tiêu đề trên 401 **or**URI nổi tiếng `/.well-known/oauth-protected-resource`(SEP-985 đã làm cho tiêu đề tùy chọn với một sự vứt bỏ nổi tiếng).`authorization_servers`trường **MUST**đặt tên ít nhất một máy chủ.
- Chỉ chấp nhận token qua `Authorization: Bearer ...`**every**yêu cầu  không bao giờ trong chuỗi truy vấn, không bao giờ được xác nhận chỉ khi bắt đầu phiên.
- Định hành`aud`- `iss`- `exp`, và phạm vi yêu cầu theo yêu cầu.**MUST**xác nhận rằng token đã được phát hành đặc biệt cho nó (khán giả); một dấu hiệu bị thiếu hoặc không phù hợp `aud`được từ chối, không bao giờ được coi là một thẻ hoang dã.
- Vào ngày 401/403, quay lại `WWW-Authenticate: Bearer`vận chuyển`error=...`, `resource_metadata="<PRM-URL>"`parameter (URL của tài liệu metadata, *không* nguồn khỏa thân), và `scope="..."``insufficient_scope`(403). Lưu ý: tham số là `resource_metadata`, một chỉ số phát hiện  không có `resource`tham số trong thử thách.
- Authorization-server discovery chấp nhận **either**RFC 8414 OAuth metadata **or**OpenID Connect Discovery 1.0; khách hàng phải thử cả hai hậu tố nổi tiếng theo thứ tự ưu tiên.
- Khách hàng (không phải máy chủ) bảo vệ chống lại **mix-up attacks**: ghi lại những gì mong đợi `issuer`trước khi chuyển hướng và xác nhận `iss`giá trị được trả lại trong phản hồi ủy quyền thực tế (RFC 9207) trước khi đổi mã. PKCE một mình không ngừng trộn lẫn, bởi vì khách hàng giao `code_verifier`đến bất cứ điểm nào mà nó được hướng tới.
- Một chứng chỉ của khách hàng thuộc về một nhà phát hành máy chủ ủy quyền. Nếu phát hiện được giải quyết cho một nhà phát hành khác, khách hàng đăng ký lại thay vì trình bày các thông tin cũ `client_id`, mã đăng ký, hoặc mã truy cập.
- CIMD là cơ chế đăng ký Ứng dụng DCR đã bị lỗi thời; yêu cầu DCR tương thích vẫn tuyên bố đúng `application_type`- Tôi không biết.

Dự thảo OAuth 2.1 là lớp phụ; RFC 8414/7591/8707/9728/9207 + RFC 7636 + CIMD là bề mặt; đặc điểm MCP là hồ sơ.

### Danh sách kiểm tra khả năng triển khai

Các bảng tính năng của nhà cung cấp trở nên lỗi thời nhanh chóng. Kiểm tra các metadata được trả lại bởi máy chủ ủy quyền mà bạn thực sự sẽ triển khai thay vào đó. Cổng là cơ học:

| Check | Required decision |
|---|---|
| Discovered issuer | Exact HTTPS issuer expected by policy |
| PKCE | `S256` advertised; otherwise stop |
| Enrollment | CIMD preferred, pre-registration accepted, DCR only as deprecated compatibility |
| Authorization response | Validate RFC 9207 `iss` when present or advertised |
| Resource binding | Token request carries `resource`; resource server requires the matching `aud` |
| Credential storage | Key client IDs and registration credentials by issuer; key access tokens by issuer plus resource |
| DCR compatibility | Declare `native` or `web`; reject redirect URIs that do not fit the declared application type |

Đừng suy luận hỗ trợ từ một tên sản phẩm hoặc cấp giá.

### Mô hình làm mới của JWKS (tiếng quay tại AS, làm mới tại máy chủ tài nguyên)

Hãy giữ hai động từ tách biệt, bởi vì kết hợp chúng là một lỗi sản xuất thực sự:

- **Rotate**là những gì * máy chủ ủy quyền* làm: đúc một khóa ký mới, xuất bản nó trong JWKS, rút ra cũ sau đó.
- **Refresh**là những gì * nguồn lực máy chủ * làm: re-`GET`Đó là hành động duy nhất của JWKS mà một máy chủ tài nguyên thực hiện.

Các chế độ thất bại sản xuất là một bộ nhớ cache cũ. Giải quyết nó bằng một công việc cập nhật theo lịch trình cộng với một key-value cache.`<issuer>/.well-known/jwks.json`và ghi lại`cache[issuer] = {keys, fetched_at}`- Bộ xác nhận đọc từ bộ nhớ cache đó.`kid`bị mất trong bộ kích hoạt cache **one**Tự cập nhật đồng bộ như một sự lùi, sau đó kiểm tra lại. Điều này xử lý hai trường hợp cùng một lúc: việc cập nhật theo lịch trình, và cửa sổ chồng chéo khóa khi một token được ký bởi một khóa mới hoàn toàn đến trước khi cập nhật theo lịch trình tiếp theo.

Sự trở lại**must be a re-fetch, never a rotate**Nếu bạn chuyển đường cache-miss sang một quay-và-măng, hai điều sẽ bị phá vỡ: (1) Măng một khóa mới tạo ra một `kid`rằng *still* không phù hợp với token, vì vậy tìm kiếm thất bại dù sao; và (2) một kẻ tấn công phun token với ngẫu nhiên `kid`giá trị buộc một loạt các sáng tạo quan trọng không giới hạn một DoS tự gây ra một lần nữa là vô hiệu, vì vậy một giả `kid`Giá tối đa là một việc làm lãng phí.

Hình dạng cache:

```json
{
  "https://auth.example.com": {
    "keys": [
      {"kid": "k_2026_03", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"},
      {"kid": "k_2026_04", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"}
    ],
    "fetched_at": 1772668800
  }
}
```

Hai phím cùng một lúc là trạng thái ổn định.`k_2026_04`) trước khi rút khỏi cuộc (`k_2026_03`), vì vậy các token được phát hành theo khóa cũ vẫn còn hợp lệ cho đến khi hết hạn.`kid`- Tôi không biết.

### Các quy trình xác thực

Máy chủ MCP chạy xác thực trước khi gửi bất kỳ công cụ nào.`code/main.py`sử dụng:

```python
result = server.validate(bearer_token, required_scope="mcp:tools.invoke")
if not result["valid"]:
    return {"status": result["status"], "WWW-Authenticate": result["www_authenticate"]}
```

`validate`giải mã JWT, giải quyết khóa ký từ bộ nhớ cache JWKS (phục hồi một lần khi bị bỏ qua), xác minh chữ ký, sau đó kiểm tra `iss`chống lại danh sách cho phép, `aud`chống lại nguồn tài nguyên của máy chủ này,`exp`, và phạm vi yêu cầu  trả lại một `WWW-Authenticate`thách thức khi thất bại đầu tiên. Giữ nó một thói quen duy nhất trên máy chủ tài nguyên có nghĩa là mọi điểm nhập cảnh (mỗi cuộc gọi công cụ, mỗi vận chuyển) đi qua các kiểm tra tương tự; không có con đường nào đến một công cụ mà không xác nhận trước.

### Các token không rõ ràng sử dụng sự nhìn vào bản thân, không phải đoán

Không phải tất cả các token truy cập đều là JWT. Nếu nhà phát hành ghi lại một token không minh bạch, máy chủ tài nguyên không thể giải mã nó thành các tuyên bố đáng tin cậy. Nó gửi token đến điểm cuối tự dò RFC 7662 của nhà phát hành qua một kênh ngược xác thực và yêu cầu`active: true`, bối cảnh nhà phát hành dự kiến, khán giả hoặc nguồn tài nguyên MCP chính xác, yêu cầu thời gian chưa hết hạn và phạm vi yêu cầu của công cụ cụ thể.

Cache introspection bởi nhà phát hành, một đường tiêu hóa token, và nguồn MCP. Đừng bao giờ sử dụng token rõ ràng như một thẻ ghi nhật ký hoặc cache. Kết nối một mục cache tích cực bằng thời gian hết hạn token sớm nhất, hướng dẫn cache của nhà phát hành và mục tiêu mới của việc khai thác. Giữ cache tiêu cực đủ ngắn để token mới được phát hành không bị vô hiệu hóa. Kết quả cho một nguồn tài nguyên không thể ủy quyền cho nguồn tài nguyên khác ngay cả khi chuỗi mã thông báo không rõ ràng là giống nhau.

Không chọn chế độ xác thực từ nội dung mã thông báo do kẻ tấn công kiểm soát. Pin JWT so với hành vi tự quan sát đến dữ liệu siêu dữ liệu của nhà phát hành được xác nhận và cấu hình triển khai. Trên con đường JWT, pin chấp nhận thuật toán và tin cậy `jwks_uri`; không bao giờ theo URL hoặc thuật toán chính chỉ được chọn bởi tiêu đề token.

### Tháo lại là một hợp đồng tươi mới

RFC 7009 cho phép khách hàng yêu cầu một máy chủ ủy quyền hủy bỏ một token. yêu cầu đó không xóa các bản sao đã được lưu trữ trong cache của mỗi máy chủ tài nguyên. Định nghĩa thời gian trễ hủy bỏ tối đa và làm cho mỗi bộ nhớ cache tôn trọng nó.

Việc triển khai mã thông báo không rõ ràng có thể đạt được sự hủy bỏ chặt chẽ hơn bằng cách theo dõi nội bộ vào mỗi cuộc gọi có rủi ro cao hoặc sử dụng cache tích cực ngắn. Việc triển khai JWT tự chủ thường kết hợp thời gian sống của mã thông báo truy cập ngắn với việc hủy bỏ mã thông báo cập nhật, rút tiền khóa cho các sự cố toàn bộ nhà phát hành và một chủ đề tùy chọn, phiên hoặc danh mục mã thông báo cho việc từ chối địa phương khẩn cấp. Một JWT được ký kết vẫn có hiệu lực mật mã cho đến khi hết hạn trừ khi máy chủ tài nguyên có bằng chứng khước từ bên ngoài hiện tại.

Logout, vô hiệu hóa tài khoản, rút tiền đồng ý và phản ứng xảy ra là các yếu tố kích hoạt khác nhau nhưng phải hội tụ trên một tuyên bố có thể đo lường: tối đa sau khi cửa sổ hủy bỏ được tuyên bố, mỗi bản sao từ chối giấy chứng nhận.

### Sự thất bại của sự phụ thuộc cần một quyết định được tuyên bố

Không bao giờ improvise chính sách sẵn có bên trong một người xử lý ngoại lệ.

| Failure | Safe production behavior |
|---|---|
| Scheduled JWKS refresh fails, known `kid` remains in a still-valid bounded cache | Continue only within the declared stale-on-error window and emit degraded health evidence |
| Token has an unknown `kid` and the one allowed refresh fails | Reject; never accept an unverifiable signature |
| Introspection is unavailable | Fail closed for protected calls; do not convert network failure into `active: true` |
| Protected-resource or issuer metadata changes unexpectedly | Stop new enrollment and token acquisition; keep only explicitly pinned, unexpired configuration under a bounded incident policy |
| Revocation endpoint is unavailable | Report logout or revocation as incomplete, retain the credential locally as unusable when possible, and do not claim global revocation succeeded |
| Clock source or claim type is invalid | Reject rather than widening skew until the token passes |

Đánh phân loại các lỗi riêng biệt với các thông tin tín dụng không hợp lệ. Một sự gián đoạn phụ thuộc là một lỗi hoạt động với chính sách sức khỏe và thử lại. Một chữ ký, nhà phát hành, khán giả, hết hạn hoặc phạm vi không hợp lệ là từ chối ủy quyền. Cả hai không tiếp cận người xử lý công cụ, và cả hai không nên rò rỉ nội dung token vào bằng chứng kiểm toán.

### Khán giả-playback walkthrough (các hạn chế quyền truy cập mã thông báo)

Server A (`notes.example.com`) và Server B (`tasks.example.com`(b) cả hai đăng ký với cùng một máy chủ ủy quyền. Server A bị xâm phạm. kẻ tấn công lấy token ghi chú của người dùng và đánh lại nó với Server B.

Tác giả của máy chủ B:

1. Khóa mã JWT, lấy JWKS qua `kid`, xác minh chữ ký.
2. Chuyện này`iss`chống lại các metadata của nó được bảo vệ trong tài nguyên `authorization_servers`(Tạo qua cùng IDP.)
3. Chuyện này`aud == "https://tasks.example.com"`(Thất bại  token `aud`là `https://notes.example.com`.)
4. Trả lại 401 với `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch", resource_metadata="https://tasks.example.com/.well-known/oauth-protected-resource"`- Tôi không biết.

Tầm nhìn của khán giả là biện pháp phòng thủ duy nhất chống lại cuộc tấn công này ở lớp giao thức. Trượt nó để hiệu suất là sai lầm sản xuất phổ biến nhất; trình xác thực phải chạy trên mọi yêu cầu, không chỉ tại buổi bắt đầu.**access-token privilege restriction**: một máy chủ MCP `MUST`từ chối bất kỳ biểu tượng nào không nêu tên nó trong khán giả.

> **Naming note.**Các thông số đặc trưng dành cho thuật ngữ * confused deputy* cho một vấn đề liên quan nhưng rõ ràng: một máy chủ MCP hoạt động như một OAuth **proxy**cho một API bên thứ ba, sử dụng ID khách hàng tĩnh, chuyển giao token mà không cần nhận sự đồng ý của người dùng mỗi khách hàng. Audience binding sửa chữa việc lặp lại ở trên; sự cố nhầm lẫn-đại diện là sự đồng ý của mỗi khách hàng **plus**không bao giờ chuyển token nhập qua các API trên dòng (mạng máy chủ MCP `MUST`có được token riêng của mình trên dòng chảy).

### Các cuộc tấn công hỗn hợp (một phòng thủ bên khách hàng mà máy chủ không thể cung cấp)

Một client nói chuyện với nhiều máy chủ ủy quyền trong suốt cuộc đời của nó. Một AS độc hại có thể cố gắng để làm cho khách hàng đổi mã ủy quyền của AS trung thực tại điểm cuối token của kẻ tấn công. Kết nối khán giả không giúp ở đây  cuộc tấn công xảy ra trước khi bất kỳ token nào tồn tại.

1. Trước khi chuyển hướng, khách hàng ghi lại dự kiến `issuer`từ các metadata AS được xác nhận.
2. Trên câu trả lời ủy quyền, khách hàng so sánh các trả lại `iss`tham số đối với nhà phát hành đã ghi (sự so sánh chuỗi đơn giản, không có bình thường hóa) trước khi gửi mã bất cứ nơi nào.
3. Không phù hợp (hoặc `iss`Không có khi AS quảng cáo `authorization_response_iss_parameter_supported`) → từ chối, và thậm chí không hiển thị `error`các cánh đồng.

PKCE một mình không ngừng nhầm lẫn, bởi vì khách hàng giao cho mình `code_verifier`cho bất kỳ điểm cuối token nào mà nó được hướng đến.`state`- Tôi không biết.

### Các chế độ thất bại

- **Stale JWKS.**Các xác thực viên từ chối mã thông báo hợp lệ sau khi AS quay một khóa. sửa chữa là cron-refresh + cache-miss-refetch pattern trên. Không bao giờ cache JWKS mà không có một công việc refresh.
- **Rotate-as-fall-back.**Cáp đường cache-miss đến một quay-và-mint thay vì một lại-phát là một lỗi thực sự: nó không bao giờ tạo ra các mất `kid`, và nó trở thành bị kẻ tấn công kiểm soát .`kid`giá trị vào một DoS tạo khóa.`refresh-jwks`- Tôi không biết.
- **Missing `aud` claim.**Một số IDP mặc định để bỏ qua `aud`trừ khi`resource`được có trong yêu cầu token. Người xác nhận phải từ chối token với thiếu `aud`, không coi sự vắng mặt như một món đồ hoang dã.
- **Mix-up via missing `iss` check.**Một khách hàng không xác nhận RFC 9207 `iss`tham số ủy quyền-đáp ứng đối với nhà phát hành nó đã ghi lại trước khi chuyển hướng có thể được hướng đến trả lại mã AS trung thực tại điểm cuối token của kẻ tấn công. Đây là một lỗi phía khách hàng; máy chủ tài nguyên không thể bù đắp cho nó.
- **Scope upgrade race.**Hai dòng tăng tốc đồng thời cho cùng một người dùng có thể cả hai thành công và tạo ra hai token truy cập với phạm vi khác nhau. Người xác thực phải sử dụng token được trình bày trên yêu cầu, chứ không phải tìm kiếm " phạm vi hiện tại của người dùng"  tạo ra cửa sổ TOCTOU.
- **Registration token theft.**Một vụ rò rỉ`registration_access_token`cho phép kẻ tấn công viết lại chuyển hướng URI. Hash chúng trong yên tĩnh; yêu cầu khách hàng trình bày văn bản rõ ràng trong mỗi cập nhật; quay trên nghi ngờ.
- **`iss` not pinned.**Một người xác nhận chấp nhận bất kỳ`iss`cho phép một kẻ tấn công lập máy chủ ủy quyền riêng của họ, đăng ký một khách hàng cho đối tượng mục tiêu, và phát hành token.`authorization_servers`danh sách là danh sách cho phép; thực thi nó.
- **Credential or token cache collision.**Một khách hàng chỉ khóa đăng ký bằng tài nguyên có thể trình bày danh tính của một máy chủ ủy quyền cho một máy chủ khác. Một khách hàng chỉ khóa truy cập token bởi nhà phát hành có thể chơi lại một token với khán giả sai.`(issuer, resource)`, và đăng ký lại bất cứ khi nào nhà phát hành thay đổi.

```figure
t3-jwks-rotate
```

## Sử dụng nó

`code/main.py`đi bộ dòng sản xuất đầy đủ với stdlib Python và ba vai trò: `AuthorizationServer`- `ResourceServer`, và`Client`- Dòng chảy:

Từ nguồn kho, chạy:

```bash
cd phases/13-tools-and-protocols/18-mcp-auth-production
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Chỉ thị đầu tiên in đăng ký và xác thực token liên quan đến nhà phát hành
lệnh thứ hai báo cáo mười tám kiểm tra vượt qua.
người nghe mạng hoặc viết thông tin tín dụng.

1. Server ủy quyền xuất bản RFC 8414 metadata tại `/.well-known/oauth-authorization-server`- Tôi không biết.
2. Khách hàng MCP gọi đến điểm kết metadata và kiểm tra các tùy chọn đăng ký của nó (`client_id_metadata_document_supported`cho CIMD, `registration_endpoint`cho DCR) và `S256`Hỗ trợ PKCE.
3. Khách hàng kiểm tra cho một đăng ký trước được cấp phép của nhà phát hành, nếu không đăng ký với HTTPS ID Client Metadata Document của mình. DCR bị suy giảm vẫn là một phương pháp tương thích có thể kiểm tra riêng.
4. Khách hàng ghi lại nhà phát hành được xác nhận, tạo ra một thách thức S256, nhận được mã ủy quyền một lần cộng với `iss`, xác nhận nhà phát hành trả lại, và đổi mã bằng chứng thực gốc và RFC 8707 `resource`chỉ số.
5. MCP client gọi một công cụ trên máy chủ MCP với `Authorization: Bearer ...`- Tôi không biết.
6. MCP máy chủ chạy `validate`, giải quyết khóa ký từ bộ nhớ cache JWKS.
7. IdP xoay một phím; việc làm mới được lên kế hoạch kéo lại JWKS vào bộ nhớ cache.
8. Cuộc gọi tiếp theo xác nhận với các phím được cập nhật mà không khởi động lại, và token trước đó vẫn xác nhận trong cửa sổ chồng chéo.
9. Một nỗ lực tái diễn đối với một nguồn tài nguyên khác của MCP sẽ có 401 với`audience mismatch`và một `resource_metadata`- Điểm chỉ.

JWT ở đây sử dụng HS256 với một bí mật được chia sẻ (vì vậy bài học chỉ chạy trên stdlib). sản xuất sử dụng RS256 hoặc EdDSA với mô hình JWKS ở trên; logic xác thực là giống nhau. Bởi vì IdP và máy chủ tài nguyên sống trong một quá trình,`refresh_jwks`đọc danh sách khóa của máy chủ ủy quyền trực tiếp; qua dây là một HTTP `GET`đến`jwks_uri`- Tôi không biết.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-mcp-auth.md`. Với cấu hình máy chủ MCP và một bộ khả năng IdP, kỹ năng phát ra bề mặt auth để đứng lên  các metadata nguồn được bảo vệ, con đường đăng ký để sử dụng (CIMD, đăng ký trước hoặc DCR fallback), lịch trình làm mới JWKS, bản đồ phạm vi và các quy tắc từ chối áp dụng khi IdP không hỗ trợ toàn bộ hồ sơ RFC.

## Các bài tập

1. Đi chạy`code/main.py`. Theo dõi dòng chảy. Lưu ý cách IdP xoay một phím trong bước 6 của đầu ra kịch bản (phases 7 of the flow above), các lịch trình `refresh_jwks`kéo lại bộ đã xuất bản, và cả token cũ (trung cửa sổ chồng chéo) và token mới được xác nhận mà không cần khởi động lại.

2. Thêm một IDP mới vào metadata nguồn được bảo vệ `authorization_servers`list. phát hành một token được ký bởi IDP mới và xác nhận người xác nhận chấp nhận nó. phát hành một token được ký bởi một IDP không được liệt kê và xác nhận người xác nhận từ chối với `WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"`- Tôi không biết.

3. Thêm kiểm tra giới hạn lãi suất vào `register_client`sử dụng một token-bucket cho mỗi nguồn IP được giữ trong một dict nhỏ được khóa bằng IP.

4. Đọc RFC 7591 và xác định hai lĩnh vực bài học `/register`người xử lý không xác nhận. Thêm xác nhận. (Nhận thức: `software_statement`và `redirect_uris`Chương trình URI.)

5. Thêm một máy chủ ủy quyền thứ hai. xác nhận khách hàng lưu trữ một đăng ký riêng biệt với khóa phát hành và từ chối sử dụng lại token của nhà phát hành đầu tiên hoặc `client_id`- Tôi không biết.

6. Cố gắng xác minh DoS, gửi cho người xác nhận một token với một số ngẫu nhiên`kid`và xác nhận`refresh_jwks`chạy tối đa một lần và số lượng khóa của máy chủ ủy quyền không tăng lên. Sau đó cố ý quay lại quay trở lại và xem số lượng khóa leo lên mỗi token giả  khôi phục lại sau đó.

7. Thực hành DCR bị lỗi thời với cả hai `native`và `web`Client. xác nhận một client web với một HTTP chuyển hướng URI và một client bản địa mà không có một chuyển hướng loopback chính xác được từ chối.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ASM | "OAuth metadata document" | RFC 8414 `/.well-known/oauth-authorization-server` JSON |
| CIMD | "Client metadata URL" | Client ID Metadata Document: an HTTPS URL used as the `client_id`; the AS pulls the JSON. Preferred enrollment in MCP 2026-07-28 |
| DCR | "Self-service client registration" | RFC 7591 `POST /register`; deprecated for current MCP and retained only for compatibility |
| JWKS | "Public keys for JWT validation" | JSON Web Key Set, fetched from `jwks_uri`, indexed by `kid` |
| Rotate vs refresh | "Updating the keys" | *Rotate* = AS mints/retires signing keys; *refresh* = resource server re-fetches the published set. Resource servers only ever refresh |
| Resource indicator | "Audience parameter" | RFC 8707 `resource` parameter pinning the token to one server |
| `aud` claim | "Audience" | JWT claim the validator compares against the canonical resource URL |
| Audience replay | "Token replay" | Token issued for Server A presented to Server B; defended by audience validation (spec: access-token privilege restriction) |
| Confused deputy | "Proxy token misuse" | An MCP proxy with a static client ID forwarding a token without per-client consent; distinct from audience replay |
| Mix-up attack | "Wrong token endpoint" | Client steered to redeem an honest AS's code at an attacker's endpoint; defended client-side via RFC 9207 `iss` |
| `iss` allow-list | "Trusted authorization servers" | The set named in protected-resource metadata's `authorization_servers` |
| `resource_metadata` | "Where to find the PRM doc" | `WWW-Authenticate` parameter naming the RFC 9728 metadata URL on a 401/403 |
| Public client | "Native or browser client" | OAuth client with no `client_secret`; PKCE compensates |
| `WWW-Authenticate` | "401/403 response header" | Carries `Bearer error=...` directives that drive client recovery |

## Đọc thêm

- [MCP authorization specification (2026-07-28)](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)- hồ sơ cấp phép MCP hiện tại
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)- CIMD, xác thực nhà phát hành, khấu trừ DCR và thay đổi tín dụng của nhà phát hành
- [OAuth Client ID Metadata Document (draft-ietf-oauth-client-id-metadata-document-00)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00) CIMD
- [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414) Hợp đồng phát hiện
- [RFC 7591 — OAuth 2.0 Dynamic Client Registration Protocol](https://datatracker.ietf.org/doc/html/rfc7591) DCR (cách quay trở lại)
- [RFC 7636 — Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) chứng minh sở hữu của khách hàng công cộng
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) Khán giả đính kèm
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728) phát hiện máy chủ tài nguyên
- [RFC 9207 — OAuth 2.0 Authorization Server Issuer Identification](https://datatracker.ietf.org/doc/html/rfc9207) `iss`tham số bảo vệ chống lại các cuộc tấn công hỗn hợp
- [RFC 7662: OAuth 2.0 Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662)
- [RFC 7009: OAuth 2.0 Token Revocation](https://datatracker.ietf.org/doc/html/rfc7009)
