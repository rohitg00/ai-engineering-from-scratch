# Khám phá kỹ năng và tiết lộ dần dần

> Một kỹ năng trở nên hữu ích trước khi được tải lên cơ thể. Tên và mô tả của nó giành được một vị trí trong danh mục; các tập tin sâu hơn của nó chỉ có được ngữ cảnh khi công việc đạt đến chúng.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 22 (Agent Skills: Portable Contract and Runtime Boundary)
**Time:** ~105 minutes

## Mục tiêu học tập

- Xây dựng một hệ thống phát hiện hệ thống tập tin phân biệt phạm vi, xác thực, chính sách va chạm và xuất bản danh mục.
- Giải thích ba mức tiết lộ: danh mục metadata, hướng dẫn hoạt động và tài nguyên cụ thể cho nhiệm vụ.
- Các tham chiếu thiết kế để một đại lý có thể tiếp cận chi tiết cần thiết trực tiếp mà không cần tải toàn bộ gói.
- Không gian danh mục ngân sách độc lập với bối cảnh kỹ năng hoạt động.
- Tháo đường đi và thoát khỏi đường dây khi một kỹ năng đọc tài nguyên của riêng mình.

## Vấn đề

Trưởng của anh có 200 kỹ năng được cài đặt.`SKILL.md`, tệp tham khảo, kịch bản và mẫu khi bắt đầu phiên sẽ chôn vùi nhiệm vụ hiện tại trong thủ tục không liên quan. Không tải gì sẽ buộc người dùng nhớ chính xác các con đường hệ thống tệp.

Sự thỏa hiệp thông thường là một danh mục: cho mô hình một danh tính nhỏ gọn và mô tả định tuyến cho mỗi kỹ năng đủ điều kiện, sau đó tải toàn bộ cơ thể chỉ sau khi lựa chọn.

Đầu tiên, phát hiện không chỉ là tìm kiếm tệp khôi phục. Kỹ năng có thể tồn tại tại tại tại dự án, người dùng, quản trị viên, plugin hoặc phạm vi tích hợp. Hai gói có thể chia sẻ một tên. Một liên kết đồng nghĩa có thể chỉ ra bên ngoài gốc đáng tin cậy. Một gói bị hình thành sai có thể tiêu thụ không gian danh mục hoặc trở nên không thể được gọi.

Thứ hai, việc tiết lộ dần dần có thể trở thành sự nhầm lẫn dần dần.`SKILL.md`"đọc hướng dẫn liên quan" và gói chứa mười hai hướng dẫn, mô hình phải đoán. Nếu mỗi hướng dẫn chỉ ra ba tập tin khác, tải trở thành một bước đi biểu đồ không giới hạn.

Một thời gian chạy tốt làm cho khám phá xác định và tiết lộ có ý định.

## Khái niệm

### Discovery là một đường ống biên dịch

Hãy xem hệ thống tệp như là đầu vào nguồn. Đừng xuất bản các đường dẫn nguyên liệu trực tiếp vào mô hình.

```figure
skill-discovery-pipeline
```

Mỗi giai đoạn nên tạo ra dữ liệu có cấu trúc và lỗi có cấu trúc.

- Những gốc rễ nào đã được tìm kiếm?
- Những ứng cử viên nào được tìm thấy?
- Những ứng cử viên nào bị từ chối và tại sao?
- Bác nào thắng vụ va chạm?
- Những mục danh mục nào đã bị rút ngắn hoặc bỏ qua vì ngân sách?

Nếu không có bằng chứng đó, "mô hình không sử dụng kỹ năng của tôi" gần như không thể chẩn đoán.

### phạm vi là chính sách thời gian chạy

Các thông số kỹ thuật di động xác định một gói kỹ năng, không phải là một con đường cài đặt phổ biến hoặc thứ tự ưu tiên.

Một runtime chung có thể sử dụng các phạm vi này:

| Scope | Example root | Intended ownership |
|---|---|---|
| Workspace | `<repo>/.agents/skills/` | Project maintainers |
| User | `<user-data>/skills/` | One developer |
| Administrator | `<system>/skills/` | Machine or organization policy |
| Plugin | A signed plugin bundle | Plugin publisher and installer |
| Built-in | Runtime package | Runtime vendor |

Tính đến tháng 8 năm 2026, Codex tài liệu dự án khám phá từ `$CWD/.agents/skills`thông qua thư mục tổ tiên đến gốc kho, cộng với người dùng, quản trị viên và các vị trí tích hợp. Nó hỗ trợ thư mục kỹ năng liên kết. Hai tên trùng lặp có thể xuất hiện thay vì được sáp nhập. Đó là hành vi Codex, không phải là yêu cầu của `SKILL.md`; kiểm tra dòng [Codex skill documentation](https://learn.chatgpt.com/docs/build-skills)khi viết một bộ điều chỉnh.

Không bao giờ phát minh ra ưu tiên từ tên thư mục. tuyên bố nó như chính sách và kiểm tra nó.`Scope`Vì vậy, cùng một bộ ứng cử viên luôn giải quyết theo cùng một cách.

### Các vụ va chạm cần sự xác định vượt ra ngoài `name`

Hai gói được đặt tên `release-readiness`Một trong số đó có thể là một không gian làm việc bị bỏ qua và một người dùng mặc định.

```json
{
  "name": "release-readiness",
  "description": "Inspect a release candidate for this repository.",
  "scope": "workspace",
  "source": "/repo/.agents/skills/release-readiness",
  "selected": true
}
```

Các chính sách va chạm chung bao gồm:

| Policy | Benefit | Risk |
|---|---|---|
| Keep every candidate | Nothing is hidden | The model sees ambiguous names |
| Highest-precedence scope wins | Simple invocation | A local package can shadow a trusted one |
| Reject duplicates | No silent shadowing | Legitimate overrides stop working |
| Qualify names by source | Explicit identity | User-facing names become longer |

Chọn một chính sách cho người chủ. Giữ các ứng cử viên bị từ chối hoặc bị ám ảnh trong chẩn đoán ngay cả khi họ không có trong danh mục mẫu.

### Ba mức tiết lộ

Các kỹ năng đặc biệt của Agent mô tả việc tải theo từng giai đoạn.

```figure
skill-disclosure-levels
```

#### Tiếp hạng 1: Metadata danh mục

Mô hình cần đủ thông tin để phân biệt kỹ năng từ hàng xóm. Khác định ước tính khoảng 100 token cho mỗi mục danh mục, nhưng chuỗi và token thực tế thuộc về chủ nhà.

Một mô tả hữu ích có hai câu:

```yaml
description: Validate a release candidate and produce a readiness report. Use when the user asks whether a version, tag, or package is ready to publish.
```

Điều thứ nhất nói về khả năng, điều thứ hai nói về giới hạn kích hoạt, và bài học 25 đánh giá giới hạn này bằng các lời nhắc tích cực và gần như bị bỏ lỡ.

#### Tiếp độ 2: hướng dẫn hoạt động

Sau khi kích hoạt, cơ thể nên hoạt động như một bản đồ và một thủ tục.`SKILL.md`dưới 500 dòng. Đó là tín hiệu thiết kế, không phải mục tiêu để lấp đầy.

Cơ thể nên chứa:

- giới hạn nhiệm vụ;
- dòng công việc mặc định;
- Điều kiện của ngành;
- tham chiếu trực tiếp đến các tệp sâu hơn;
- Hợp đồng công cụ và kịch bản;
- Hành vi thất bại và dừng lại;
- sản lượng dự kiến và xác minh.

Không di chuyển dòng công việc trung tâm vào một tham chiếu chỉ để làm cho tệp nhập ngắn.

#### Tiếp độ 3: nguồn lực hỗ trợ

Các tài sản được sao chép, điền vào hoặc biến thành các sản phẩm được giao ra thay vì được xem như hướng dẫn.

| Directory | Model reads it? | Model executes it? | Typical content |
|---|:---:|:---:|---|
| `references/` | Yes, when needed | No | schemas, policies, domain guides |
| `scripts/` | May inspect it | Through a permitted tool | validators, converters, collectors |
| `assets/` | Only if useful | No | templates, fixtures, images, starter files |

Những tên này là các quy ước, không phải khả năng ma thuật.

### Các tham chiếu cụ thể của ngành vượt qua các bài bỏ chủ đề

Viết file nhập như một bản đồ quyết định:

```markdown
## Choose the path

- For a Python package, read `references/python-release.md`.
- For a container image, read `references/container-release.md`.
- For a documentation-only release, read `references/docs-release.md`.
- If the release combines artifact types, read only the guides for those artifacts.
```

Điều này cho mỗi tham chiếu một điều kiện tải có thể quan sát được.`references/`"Đừng có gì hơn" không.

Giữ biểu đồ tham chiếu nông.`SKILL.md`Một cú nhảy làm cho khả năng tiếp cận được kiểm tra và làm giảm khả năng hạn chế cần thiết không bao giờ vào ngữ cảnh.

```figure
skill-reference-map
```

### Ngân sách danh mục và bối cảnh hoạt động là các ngân sách khác nhau

Để `c_i`là chi phí danh mục hàng loạt của kỹ năng `i`- `B_c`ngân sách danh mục, `b_j`chi phí cơ thể hoạt động, và `r_k`nguồn lực thực sự được tải.

```text
catalog_cost = sum(c_i for every published skill)
active_cost = sum(b_j for every activated skill) + sum(r_k for every disclosed resource)
```

Giảm một ngân sách không tự động giảm một ngân sách khác. Biểu đồ ngắn có thể tiết kiệm không gian danh mục trong khi một cơ thể 900 dòng hoạt động vẫn làm quá tải nhiệm vụ. Chia cơ thể thành tham chiếu chỉ có thể giảm chi phí hoạt động khi thời gian chạy và hướng dẫn thực sự tránh tải các chi nhánh không liên quan.

Codex hiện đang lập kế hoạch cho danh sách kỹ năng ban đầu ở mức 2% trong bối cảnh
cửa sổ khi kích thước cửa sổ ngữ cảnh được biết.
fallback chỉ khi kích thước đó không được biết; nó không phải là một nắp thứ hai kết hợp với
Quy tắc 2% Khi danh mục vượt quá ngân sách áp dụng,
Các mô tả có thể được rút ngắn hoặc bỏ qua.
Chính sách Codex, không phải thuộc về tiêu chuẩn kỹ năng đại lý.

### Các con đường tài nguyên là ranh giới tin tưởng

Một kỹ năng chỉ nên đọc các tệp bên trong gói của nó.

```text
references/../../../../.ssh/config
references/external-link -> /private/company-secrets
```

Giải quyết gốc gói và ứng cử viên bằng ngữ nghĩa hệ thống tập tin, từ chối đầu vào tuyệt đối và xác minh rằng ứng cử viên được giải quyết vẫn nằm dưới gốc được giải quyết.

```figure
skill-resource-containment
```

Việc giữ đường dẫn không thiết lập sự tin cậy nội dung. Một tham chiếu hợp lệ trong gói vẫn có thể chứa các hướng dẫn độc hại. Bài học 26 xử lý mối đe dọa đó.

### Lượng tải phải được quan sát

Lưu ý các sự kiện tiết lộ mà không ghi lại bí mật:

```json
{
  "event": "skill.resource.loaded",
  "skill": "release-readiness",
  "resource": "references/python-release.md",
  "reason": "candidate contains pyproject.toml",
  "bytes": 2840
}
```

Lý do biến một lựa chọn ngữ cảnh thành bằng chứng có thể xem xét. Nó cũng giúp xác định các hướng dẫn khiến cho đại lý tải mỗi tệp "chỉ vì trường hợp".

## Hãy xây dựng nó

`code/main.py`xây dựng một động cơ phát hiện và tiết lộ xác định.

Mối phát hiện bao gồm:

- `Scope`cho nguồn và các metadata ưu tiên;
- `SkillCandidate`đối với ứng viên hệ thống tệp không được xác nhận;
- `discover_scope(scope)`để liệt kê các thư mục kỹ năng ngay lập tức;
- `resolve_collisions(candidates, precedence)`áp dụng một chính sách được tuyên bố;
- `CatalogEntry`và `build_catalog(...)`để công bố các metadata giới hạn;
- `CatalogBudget`để giải thích các mục nhập theo chuỗi mà không giả vờ là các mã thông báo phổ quát.

Màn hình tiết lộ bao gồm:

- `load_skill_body(entry, ...)`cho kích hoạt cấp 2;
- `validate_reference(skill_dir, reference)`cho việc ngăn chặn đường đi;
- `load_reference(...)`cho các bài đọc cấp 3 bị giới hạn.

- Đi phòng thí nghiệm.

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Khóa này yêu cầu một bản sao lập bản địa và giải quyết nguồn kho từ bất kỳ
thư mục làm việc bên trong clone đó.

Demos tạo ra phạm vi dự án và người dùng tạm thời, chèn một vụ va chạm, xây dựng một danh mục theo ngân sách nhỏ cố ý, kích hoạt một kỹ năng, và cố gắng cả đọc tham chiếu hợp lệ và thoát khỏi. Không có tệp vĩnh viễn được cài đặt.

### Tại sao khám phá không sâu sắc

`discover_scope`kiểm tra thư mục trẻ em ngay lập tức cho `SKILL.md`Nó không chữa trị mỗi con lồng.`SKILL.md`Như vậy bảo vệ ranh giới gói và tránh xuất bản vô tình các ví dụ hoặc thiết bị trong một kỹ năng được cài đặt.

### Tại sao phòng thí nghiệm không phân tích YAML tùy ý

Phòng thí nghiệm hỗ trợ các mặt hàng scalar cần thiết cho danh mục của nó. Một thời gian chạy sản xuất nên sử dụng một trình phân tích YAML an toàn với một sơ đồ rõ ràng, giới hạn kích thước và vô hiệu hóa cấu trúc đối tượng tùy chỉnh. "Stdlib-only" là một hạn chế giảng dạy, không phải là quyền để phát minh ra một phương ngữ YAML một phần im lặng.

## Sử dụng nó

Sử dụng danh sách kiểm tra này cho bất kỳ bộ điều chỉnh phát hiện nào:

1. Đăng danh sách tất cả các nguồn được cấu hình và ai có thể viết cho nó.
2. Cần xác định liệu các gói liên kết có được phép hay không.
3. Thiết lập tên gói, tên thư mục, siêu dữ liệu cần thiết và kích thước của cơ thể nhập.
4. Bảo tồn nguồn gốc và phạm vi trong bản sắc bên trong.
5. Thiết lập và kiểm tra hành vi tên trùng lặp.
6. Đánh giá danh mục liên kết chính xác được gửi đến mô hình.
7. ghi lại lý do tại sao một cơ thể hoặc tài nguyên đã được tải.
8. Giữ nguồn đọc bên trong gốc gói được giải quyết.
9. Thiếu rõ ràng khi một tập tin tham chiếu bị thiếu.
10. Tạo lại danh mục khi cài đặt hoặc chính sách thay đổi.

## Chuyển nó

Bài học này tạo ra những`skill-catalog-builder`Nó quét các gốc được sắp xếp rõ ràng, từ chối các tệp nhập liên kết và sự không phù hợp của thư mục tên, giải quyết các vụ va chạm phạm vi, từ chối các bản sao có ưu tiên tương đương và kết hợp các siêu dữ liệu được chọn vào mục nhập, mô tả và ngân sách ký tự được trình tự.

Báo cáo JSON của nó chứa các mục đã chọn, ứng cử viên bị bóng tối, các mục bị bỏ qua, lỗi xác thực, ưu tiên và sử dụng ngân sách. Lập cơ thể và tham chiếu vẫn là các hoạt động chạy riêng biệt, vì vậy người tạo danh mục không thực hiện kịch bản hoặc đưa toàn bộ gói vào ngữ cảnh.

## Các bài tập

1. Thêm phạm vi plugin và đặt nó giữa người dùng và ưu tiên tích hợp.
2. Thay đổi chính sách va chạm từ ưu tiên cao nhất để có đủ điều kiện tên.
3. Thêm giới hạn kích thước byte vào `load_reference`Thử một tập tin ở mức giới hạn và một byte trên đó.
4. Tạo hai mô tả có âm thanh gần giống nhau và viết lại để ranh giới kích hoạt không chồng chéo.
5. Thêm một biểu đồ chứa hash cho mỗi tham chiếu và kịch bản. Khám phá một tài nguyên được sửa đổi trước khi tải nó.
6. Công cụ demo để báo cáo cấp 1, cấp 2, và cấp 3 đếm byte riêng biệt.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| Skill discovery | "Find every SKILL.md" | Search configured scopes, validate packages, attach provenance, and apply policy |
| Skill catalog | "The list of installed skills" | Compact model-visible routing metadata for eligible packages |
| Collision policy | "Which duplicate wins" | A declared rule for same-name candidates from different sources |
| Progressive disclosure | "Lazy loading" | Staged context admission from catalog to body to branch-specific resources |
| Reference graph | "Files linked by the skill" | The reachable resource structure and its load conditions |
| Path containment | "Stay in the folder" | Verify resolved resource targets remain inside the resolved package root |

## Đọc thêm

- [Agent Skills specification](https://agentskills.io/specification)cho hình dạng gói và mức độ tiết lộ tiến bộ.
- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)cho metadata định tuyến danh mục.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)cho các tham chiếu trực tiếp và kích thước tệp nhập.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)cho phạm vi khám phá Codex hiện tại và giới hạn danh mục.
