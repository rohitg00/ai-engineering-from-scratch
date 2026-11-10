# MCP Registry Supply Chain: Đăng nhập, Drift và Rollback

> Một mục đăng ký cho bạn biết một nhà xuất bản đã tuyên bố gì.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 17 (gateways and registries), Phase 13 · 18 (production authentication)
**Time:** ~90 minutes

## Mục tiêu học tập

- Việc xuất bản Registry riêng biệt, nguồn gốc gói, phát hiện thời gian chạy và phê duyệt địa phương.
- Kiểm tra không gian tên máy chủ MCP mà không tin vào tên trong hồ sơ của riêng nó.
- Pin ấn phẩm không thay đổi, nguồn thực hiện, nguồn gốc và bằng chứng mô tả trực tiếp.
- Khám phá thay đổi trạng thái đăng ký và biến động thời gian chạy sau khi nhập học.
- Chuyển lại định tuyến sang phiên bản đã được chấp nhận trước đây mà không viết lại lịch sử.
- Giữ một sổ tay tuyển dụng rõ ràng, giải thích mọi quyết định.

## Vấn đề

Anh tìm thấy`com.example/inventory`Nó có thể được mô tả đúng, gói của nó tồn tại, máy chủ trả lời.`server/discover`- Tôi không biết.

Đó không phải là một sự thật, mà là một chuỗi các sự kiện từ các cơ quan khác nhau:

1. Một nhà xuất bản xác thực cho một không gian tên đã gửi một bản ghi.
2. Một danh sách gói phục vụ một đồ tạo vật với một danh tính và tiêu hóa cụ thể.
3. Một điểm cuối đang chạy báo cáo phiên bản giao thức, khả năng, công cụ và thông tin máy chủ chẩn đoán.
4. Tổ chức của ông quyết định rằng sự kết hợp chính xác này được phép.

Việc sụp đổ những sự kiện đó thành it nằm trong registry, vì vậy hãy tin rằng nó tạo ra một điểm mù chuỗi cung ứng. Một ấn phẩm hợp lệ vẫn có thể bị lỗi thời. Một thẻ gói có thể chỉ ra một vật cổ vật bất ngờ nếu bạn không ghi dấu của nó. Một máy chủ có thể thêm một công cụ phá hủy sau khi xem xét. Một rollback có thể lặng lẽ chọn một phiên bản chưa bao giờ được chấp nhận.

Đơn vị là một người kiểm soát nhập cảnh với bằng chứng ở mọi biên giới.

## Đăng ký là chỉ số, không phải hệ thống chấp thuận của bạn

Các MCP Registry chính thức lưu trữ dữ liệu siêu dữ liệu máy chủ.`server.json`ghi tên phiên bản máy chủ và tuyên bố một hoặc nhiều gói hoặc điểm cuối từ xa. Các quy tắc xuất bản thêm xác thực không gian tên, kiểm tra quyền sở hữu gói, các quy tắc đăng ký hạn chế và vị trí siêu dữ liệu nhà xuất bản hẹp.

Các kiểm soát đó trả lời các câu hỏi về xuất bản. Chính sách sản xuất của bạn vẫn trả lời các câu hỏi về triển khai:

| Boundary | Question | Evidence owner |
|---|---|---|
| Namespace | Was the publisher allowed to use this name? | Registry authentication plus your verified namespace input |
| Record | What did the publisher declare for this version? | Immutable `server.json` digest |
| Execution source | Which package or remote endpoint will execute? | Declared source fields, verified ownership result, transport, and trusted digest |
| Runtime | What does the endpoint expose now? | `server/discover` and tool descriptors |
| Admission | Did your policy approve this exact set? | Local pin and ledger entry |
| Operations | Is it still safe, and what can replace it? | Drift checks, status sync, health, and rollback route |

Phiên bản schema Registry và phiên bản giao thức MCP là độc lập.`2025-12-11`schema server trong khi live server hỗ trợ MCP `2026-07-28`Đừng bao giờ suy luận về nhau.

```figure
mcp-registry-admission
```

## Bảy kiểm soát trong một quyết định nhập học

### 1. Truyển chứng không gian tên

Tên đăng ký chính thức sử dụng không gian tên xác thực. Một tên miền được xác minh có thể lập bản đồ đến một tiền tố tên miền đảo ngược. Ví dụ, kiểm soát của `example.com`có thể thiết lập`com.example/*`- Tôi không biết.

Không chấp nhận kiểm tra tiền tố chuỗi:

```python
server_name.startswith("com.example")
```

Điều đó cũng chấp nhận `com.exampleevil/tool`. Chia tên ở `/`, yêu cầu một con sưu tập không trống, và so sánh phân đoạn namespace chính xác. Quan trọng hơn, chuyển namespace xác minh vào nhập từ kết quả xác thực. Đừng lấy niềm tin từ hồ sơ không tin cậy.

Các namespace được hỗ trợ bởi GitHub và namespace được hỗ trợ bởi domain sử dụng các con đường xác thực khác nhau.

### 2. Kết hợp nguồn gốc

Đối với một bản ghi gói, tuyên bố và vật thể được lấy phải kết hợp trên các trường rõ ràng:

- kiểu hồ sơ gói
- Định dạng gói
- phiên bản gói
- Kết quả sở hữu được xác minh
- Downloaded artefact digest

Ngoài ra, xác nhận vận chuyển gói được tuyên bố. Một hồ sơ chỉ có một điểm cuối từ xa là hợp lệ và không thể bị từ chối vì thiếu gói. Đối với một nguồn từ xa, kết nối URL và loại vận chuyển được tuyên bố với chủ sở hữu điểm cuối được xác minh độc lập và một bản ghi của kết nối đáng tin cậy hoặc bằng chứng triển khai.

Mã bài học hỗ trợ cả hai loại nguồn và hashes nguồn được chọn cùng với nguồn Registry, tên máy chủ, phiên bản Registry, ghi âm ghi âm và ghi âm chứng cứ.

Đừng bao giờ chấp nhận một bản thu được cung cấp chỉ bởi vật cổ mà bạn đang cố gắng xác minh.

### 3. Đặt quyết định, không chỉ phiên bản

Các phiên bản đăng ký là các công cụ xác định ấn phẩm độc đáo. Các metadata được xuất bản là không thể thay đổi. Một bản ghi thay đổi đòi hỏi một phiên bản mới. Việc phiên bản ngữ nghĩa được khuyến cáo, nhưng Registry không yêu cầu nó và không chấp nhận phạm vi phiên bản.

Điều này có nghĩa là`^1.4`không phải là pin nhập học. Không phải là lastest. Một pin hữu ích chứa:

```json
{
  "server": "com.example/inventory",
  "version": "1.0.0",
  "recordDigest": "...",
  "source": {"kind": "package", "registryType": "pypi"},
  "sourceDigest": "...",
  "toolsetDigest": "...",
  "provenanceDigest": "...",
  "registryStatus": "active"
}
```

Đặt nhiều lớp cho phép bạn xác định ranh giới thay đổi. Một thay đổi ghi nhớ trong cùng phiên bản Registry là một sự cố tính toàn vẹn Registry. Một thay đổi ghi nhớ nguồn dưới cùng một phối hợp gói hoặc triển khai từ xa là một sự cố tính toàn vẹn của nguồn thực thi.

### 4. Khám phá lở động

Đăng nhập nên quan sát máy chủ thực sự sẽ nhận lưu lượng truy cập.`server/discover`, liệt kê hoặc bằng cách khác nhận được các mô tả công cụ được phơi bày thông qua con đường đáng tin cậy của bạn, và xác minh:

- `2026-07-28`là trong `supportedVersions`
- tất cả các khả năng cần thiết tại địa phương đều có mặt
- Mỗi mô tả công cụ có bề mặt danh tính và sơ đồ cần thiết
- tiêu hóa mô tả bình thường phù hợp với pin được chấp nhận trong kiểm tra sau đó

Kết quả tùy chọn `_meta["io.modelcontextprotocol/serverInfo"]`giá trị là bản ghi tự báo cáo hiển thị, nhật ký và điều chỉnh kết cấu. ghi lại nó như bằng chứng chẩn đoán, nhưng không bao giờ sử dụng nó để thiết lập không gian tên, sở hữu gói, sở hữu điểm cuối, nhập, hoặc bất kỳ quyết định bảo mật nào khác.`serverInfo`- Tớ gọi là ngoài `_meta`không phải là lĩnh vực hợp đồng và không nên được quảng bá thành bằng chứng chẩn đoán.

Chỉ bình thường hóa các trường mà thứ tự không có ý nghĩa. Mô hình sắp xếp danh sách công cụ bằng tên ổn định trước khi hashing, vì vậy thay đổi thứ tự danh sách không gây ra trục xuất. Nó không loại bỏ các trường mô tả. Một công cụ mới, thay đổi sơ đồ, thay đổi mô tả hoặc ghi chú mới thay đổi pin.

Các mẫu xử lý các mô tả sai dạng và bất kỳ thay đổi tiêu hóa mô tả nào như là trôi dạt, cách ly pin, loại bỏ tuyến đường hoạt động của nó và chặn phiên bản đó như mục tiêu quay trở lại.

### 5. Tình trạng đăng ký là trạng thái sống

Registry API gắn một mức độ phản ứng `_meta`đối tượng bên cạnh mỗi hồ sơ máy chủ. Các trường quản lý Registry sống dưới `_meta["io.modelcontextprotocol.registry/official"]`- Đưa câu trả lời đi.`_meta`phản đối việc nhận và đọc `_meta["io.modelcontextprotocol.registry/official"].status`- Một cái trực tiếp`_meta.status`giá trị không phải là hình dạng dây chính thức. Đừng nhầm lẫn dữ liệu siêu dữ liệu phản hồi với bản ghi bản bản `_meta`- Tình trạng có thể là:

- `active`: được trả theo mặc định và đủ điều kiện cho nhập học tại địa phương
- `deprecated`: vẫn có thể phát hiện với một cảnh báo, nhưng không còn một lựa chọn tự động an toàn
- `deleted`: ẩn theo mặc định trong khi hồ sơ lịch sử của nó vẫn có sẵn thông qua các lượt xem bị xóa hoặc tăng

Tích hợp trạng thái sau khi nhập. Nếu một phiên bản hoạt động trở nên lỗi thời hoặc bị xóa, hãy kiểm soát pin của nó và ngừng định tuyến công việc mới cho nó. Giữ bằng chứng. Việc xóa khỏi danh sách mặc định không phải là quyền xóa dấu vết kiểm toán của bạn.

Các metadata tùy chỉnh được cung cấp bởi nhà xuất bản chỉ thuộc về `_meta.io.modelcontextprotocol.registry/publisher-provided`trong một bản ghi xuất bản. Các metadata phản hồi được quản lý bởi Registry là riêng biệt. Đừng để cho một nhà xuất bản đặt vị trí chính thức của riêng mình.

### 6. Lái xe trở lại có nghĩa là khôi phục tuyến đường

Một ấn phẩm không thay đổi không được chỉnh sửa trong quá trình quay lại. Rollback chọn một pin được chấp nhận trước đây, hiện có đủ điều kiện và thay đổi tuyến đường hoạt động.

Một mục tiêu an toàn phải:

1. Có hồ sơ nhập học đầy đủ.
2. Còn có trạng thái đăng ký hoạt động theo chính sách của bạn.
3. Không được cách ly bởi thời gian chạy hoặc bằng chứng an ninh.
4. vẫn được giải quyết cho gói được gắn và thiết lập mô tả trực tiếp.
5. Tham khảo sức khỏe hiện tại.

Các mẫu tập trung vào ba điều kiện đầu tiên. Một người hòa giải thực sự nên lấy lại gói và kiểm tra lại điểm cuối trực tiếp trước khi kích hoạt.

### 7. Thêm sổ tay tuyển dụng

Một cơ sở dữ liệu nhập học cho biết hoạt động của người nào.

Mỗi mục nhập mẫu chứa một chuỗi, thời gian, sự kiện, máy chủ, phiên bản, kết quả, lý do, bằng chứng, hash mục nhập trước đó và hash của riêng nó.

Điều này là rõ ràng, không phải là phép thuật chống vi phạm. Các sổ cái định kỳ đầu vào một miền tin cậy riêng biệt, chẳng hạn như dữ liệu bán tựa được ký hoặc lưu trữ một lần viết. Giới hạn ai có thể thêm vào. Giữ mã thông tin ủy quyền, thông tin tin tin tin tin gói, các lập luận công cụ và dữ liệu điểm cuối riêng tư ra khỏi bằng chứng.

## Hãy xây dựng nó

Bộ điều khiển chạy được `code/main.py`Nó chỉ sử dụng thư viện tiêu chuẩn Python.

Bắt đầu với sự chứng minh hữu hạn:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift
python3 code/main.py
npx tsx code/main.ts
```

Cuộc biểu tình thực hiện năm hoạt động:

1. Hãy thừa nhận`1.0.0`với không gian tên phù hợp, nguồn gốc gói, giao thức, khả năng và công cụ.
2. Hãy thừa nhận`1.1.0`và làm cho nó hoạt động.
3. Nhận thấy một công cụ xóa bất ngờ trong thời gian chạy.
4. Xem trạng thái Registry của `1.1.0`trở thành`deprecated`- Tôi không biết.
5. Khôi phục đường dẫn cho các vẫn được chấp nhận `1.0.0`Đèn.

Hình dạng dự kiến:

```json
{
  "admitted": [true, true],
  "driftAllowed": false,
  "rollbackAllowed": true,
  "activeVersion": "1.0.0",
  "ledgerValid": true
}
```

Đọc việc thực hiện theo thứ tự này:

1. `namespace_for_domain()`và `namespace_matches()`xác định chính xác quyền đặt tên.
2. `digest()`và `normalized_tools()`tạo ra bằng chứng xác định.
3. `RegistryAdmissionController.admit()`kết hợp với xuất bản, nguồn gốc, thời gian chạy và chính sách.
4. `check_live()`so sánh một quan sát mới với pin.
5. `observe_registry_status()`Các phiên bản cách ly có trạng thái đăng ký thay đổi.
6. `rollback()`chỉ kích hoạt một mục tiêu đủ điều kiện trước đây được chấp nhận.
7. `AdmissionLedger.verify()`phát hiện ra những thay đổi trong lịch sử ghi lại.

## Sử dụng nó

Đặt bộ điều khiển giữa phát hiện và định tuyến:

```text
Registry sync -> artifact verifier -> live discovery -> admission controller -> route table
                                               |                 |
                                               v                 v
                                          evidence store    admission ledger
```

Sử dụng danh tính riêng biệt cho các công việc này. Một nhân viên đồng bộ hóa Registry cần truy cập đọc đến metadata. Một xác minh artefact cần truy cập lấy gói. Một người đồng bộ đường cần quyền để kích hoạt một pin được phê duyệt. Không ai trong số họ cần tất cả các giấy chứng nhận.

Làm cho thông báo triển khai rõ ràng. Từ chối  nghĩa là chính sách bằng chứng đã được thông qua. Active  nghĩa là tuyến đường hiện chọn nó.  Quarantine  nghĩa là nó không thể nhận được công việc mới. Superseded  nghĩa là một phiên bản khác được chấp nhận đang hoạt động. Đừng mã hóa tất cả bốn ý nghĩa trong một tiếng Boolean.

Thử nhập trước khi phơi bày một máy chủ trong `tools/list`Nếu không, khách hàng có thể phát hiện ra một công cụ trong khoảng cách giữa việc xuất bản và đánh giá chính sách.

## Phòng thí nghiệm tương tác

Bạn sẽ xem một ranh giới thất bại một lúc.

### Phòng thí nghiệm A: Vụ trục trặc không gian tên

Mở một shell Python từ thư mục mã:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/code
python3 -q
```

Rồi chạy:

```python
from main import namespace_matches
namespace_matches("com.example/inventory", "com.example")
namespace_matches("com.exampleevil/inventory", "com.example")
```

Kết quả đầu tiên là`True`; thứ hai là `False`Thay thế so sánh chính xác bằng `startswith`và quan sát tại sao tên thứ hai vượt biên giới.

### Phòng thí nghiệm B: Drift mô tả

```python
from main import *
times = iter(f"2026-08-21T12:00:{n:02d}+00:00" for n in range(10))
c = RegistryAdmissionController(clock=lambda: next(times))
meta = {OFFICIAL_META_KEY: {"status": "active"}}
c.admit(sample_record("1.0.0"), meta, "com.example", evidence_for("1.0.0"), sample_live("1.0.0"))
c.check_live("com.example/inventory", "1.0.0", sample_live("1.0.0", True))
```

Kiểm tra lý do và trạng thái đường. Tài liệu gói và Registry không thay đổi. Bề mặt công cụ chạy đã thay đổi, vì vậy người điều khiển đã kiểm định và vô hiệu hóa pin.

### Phòng thí nghiệm C: tình trạng và sự quay lại

Hãy thừa nhận`1.1.0`, đánh dấu nó đã lỗi thời, và thử cả hai mục tiêu quay lại:

```python
c.admit(sample_record("1.1.0"), meta, "com.example", evidence_for("1.1.0"), sample_live("1.1.0"))
c.observe_registry_status("com.example/inventory", "1.1.0", "deprecated")
c.rollback("com.example/inventory", "1.1.0", "unsafe retry")
c.rollback("com.example/inventory", "1.0.0", "restore known release")
c.ledger.verify()
```

Mục tiêu bị cách ly bị từ chối, pin hoạt động trước được chấp nhận, sổ cái vẫn còn hợp lệ.

## Phòng thí nghiệm thực hành

Tăng bộ điều khiển với cổng chấp thuận hai người.

Yêu cầu:

- Cung cấp lưu trữ như tham chiếu bằng chứng đã ký kết, không phải tên thay đổi trong pin.
- Cần hai danh tính kiểm tra viên khác nhau cho một bộ công cụ chứa một công cụ với `destructiveHint: true`- Tôi không biết.
- Tránh nhận dạng người xem trùng lặp.
- Giữ nỗ lực nhập học ban đầu trong sổ cái khi phê duyệt chưa đầy đủ.
- Thêm các thử nghiệm cho 0, một, hai lần phê duyệt và hai lần phê duyệt khác nhau.
- Đừng ghi lại chữ ký, giấy chứng nhận, hoặc các đối số công cụ riêng tư đầy đủ.

Thành công có nghĩa là một công cụ phá hủy không thể hoạt động cho đến khi cả hai danh tính chấp thuận bản ghi chính xác, gói và bộ công cụ.

## Các đồ tạo tác được vận chuyển

Bài học này sẽ đi theo `outputs/skill-mcp-registry-admission.md`Sử dụng nó như một sổ chạy phẳng, có thể sử dụng lại khi xem xét phiên bản Registry mới hoặc điều tra trôi. Nó xác định các đầu vào, quy tắc từ chối, gói bằng chứng, kết hợp trạng thái và chứng minh quay lại mà không phụ thuộc vào tên lớp mẫu.

## Hãy kiểm tra

Tiến hành trình chứng minh và bộ xác định:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Việc kiểm tra phải chứng minh:

- ranh giới không gian tên chính xác từ chối các tiền tố giống nhau
- Chỉ có trạng thái Registry có tên chính thức mới có thể làm cho một phiên bản đủ điều kiện
- gói không được xác minh hoặc không phù hợp và bằng chứng từ xa bị từ chối
- Các metadata của nhà xuất bản không thể giả bộ như các metadata được quản lý bởi Registry
- sắp xếp công cụ được bình thường hóa mà không che giấu các thay đổi mô tả
- các cấu trúc gói và công cụ bị biến dạng bị từ chối an toàn
- `serverInfo`vẫn là chẩn đoán và không bao giờ cung cấp cho cơ quan nhận
- description drift quarantine, deactivates và blocks rollback to the pin
- Thay đổi trạng thái pin hoạt động kiểm dịch
- rollback không thể chọn phiên bản bị cách ly hoặc không biết
- bị thao túng sổ cái được phát hiện

## Các chế độ sản xuất thất bại

| Failure | Why it happens | Required response |
|---|---|---|
| Name looks valid but namespace was never authenticated | Policy trusted record text | Reject until a trusted namespace verifier supplies the exact prefix |
| Same package coordinate returns new bytes | Mutable upstream or compromised distribution | Stop activation, retain both digests, investigate the fetch boundary |
| “Latest” changes without review | Floating selection escaped the pin | Resolve only exact admitted versions and digests |
| New tool appears after approval | Runtime drift or a different deployment | Quarantine the route and capture a fresh descriptor observation |
| Deprecated version remains active | Status sync is missing or delayed | Reconcile status on a schedule and before activation |
| Deleted record disappears from default sync | Client requested only active records | Use incremental or deleted-aware reconciliation and preserve local history |
| Rollback target was never admitted | Route control and approval state are disconnected | Refuse rollback and run a new admission for the target |
| Ledger verifies locally after an attacker rewrites all entries | Hash chain has no external anchor | Publish signed ledger heads to a separate trust domain |
| Evidence contains bearer tokens or tool arguments | Logging copied whole requests | Redact at collection time and store only the minimum proof |

## Quy tắc hoạt động

Câu trả lời xuất bản có thể danh tính này xuất bản tên này? Câu trả lời nhận Chúng ta sẽ thực hiện hiện hiện vật chính xác này và phơi bày hành vi chính xác này? Giữ những quyết định đó tách biệt, gắn mỗi liên kết, và làm cho rollback chọn bằng chứng thay vì trí nhớ.

## Đọc thêm

- [Official Registry server.json requirements](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md)
- [Official Registry OpenAPI contract](https://registry.modelcontextprotocol.io/openapi.yaml)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
