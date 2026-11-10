# Kỹ năng đại lý: Hợp đồng di động và giới hạn thời gian chạy

> Một kỹ năng không phải là một lời nhắc dài với tên tệp tốt hơn. Nó là một gói hướng dẫn, tài nguyên và trợ lý thực thi được tìm thấy mà nhập vào bối cảnh của một đại lý thông qua một hợp đồng thời gian chạy.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 01 (The Tool Interface), Phase 13 · 05 (Tool Schema Design)
**Time:** ~90 minutes

## Mục tiêu học tập

- Định nghĩa kỹ năng đại lý mà không nhầm lẫn nó với một lệnh, hướng dẫn kho, công cụ, móc, subagent, hoặc plugin.
- Đọc trên điện thoại di động `SKILL.md`hợp đồng và tách nó khỏi các gia hạn cụ thể về thời gian chạy.
- Giải thích khám phá, lựa chọn, kích hoạt, tải tài nguyên, sử dụng công cụ và xác minh như các giai đoạn vòng đời riêng biệt.
- Thêm vào danh sách của một đại lý.
- Chọn giữa một kỹ năng, công cụ MCP, móc, subagent, hoặc mã thông thường cho một nhiệm vụ cụ thể.

## 10 phút thành công đầu tiên

Làm điều này trước khi giải thích dài. Bạn sẽ tạo ra một kỹ năng nhỏ, cài đặt
bộ phận kiểm tra viên hoàn chỉnh được kết hợp thành một máy chủ thực sự, gọi nó, xác minh
kết quả, và loại bỏ nó. Điều này chứng minh chu kỳ cuộc sống với một kết quả có thể quan sát được.

### Chuyến bay trước khi đến phòng thí nghiệm chủ nhà thực tế

Điểm kiểm soát host thực sự yêu cầu Node.js, `npx`, Python 3, một chọn
có khả năng quản lý, và viết quyền truy cập vào dự án hoặc phạm vi người dùng bạn chọn trong
Đầu tiên kiểm tra lệnh địa phương:

```bash
node --version
npx --version
python3 --version
```

Quyết định bạn sẽ sử dụng máy chủ và phạm vi nào trước khi cài đặt.
yêu cầu không có sẵn, đọc bài học này trên trang web hoặc tiếp tục với
tập tập gói thủ công dưới đây.
không chứng minh phát hiện host, gọi, thực hiện bản ghi âm gói, hoặc
Tháo bỏ hành vi cài đặt.

### 1. Bắt đầu trong thư mục làm việc trống

Thực hiện các lệnh này từ bất kỳ thư mục phụ huynh nào mà bạn tiếp tục học làm việc:

```bash
mkdir -p agent-skills-first-run
cd agent-skills-first-run
TARGET_ROOT="$(pwd -P)"
printf 'TARGET_ROOT=%s\n' "$TARGET_ROOT"
ls -A
```

Chỉ thị cuối cùng không nên in gì. Nếu nó in các tệp, hãy chọn một tệp khác
thư mục trống để đánh giá có một ranh giới rõ ràng.

Tạo thư mục cho kỹ năng đầu tiên của bạn:

```bash
mkdir -p my-first-skill
```

Tạo ra`my-first-skill/SKILL.md`với nội dung này:

```markdown
---
name: my-first-skill
description: Turn rough meeting notes into a compact decision record when the user asks to capture a technical decision.
---

# Decision record

Extract the decision, context, alternatives, owner, and next review date.
If the notes do not contain a decision, ask one clarifying question instead
of inventing one.
```

Kiểm tra rằng bạn đã tạo file trong thư mục dự định:

```bash
test -f my-first-skill/SKILL.md
```

Không có mã phát và thoát 0 có nghĩa là tập tin tồn tại.

### 2. Thiết lập gói kiểm tra viên đầy đủ

- Cứ ở lại.`agent-skills-first-run`và chạy:

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-contract-reviewer --full-depth
```

Chọn máy chủ đại lý và phạm vi bạn đang sử dụng.
`skill-contract-reviewer`Và điểm đến mà nó viết.`--full-depth`là
cần thiết bởi vì kỹ năng của bài học này là một gói tổ hợp với tham chiếu, một
kịch bản, và một tài sản.

Đặt `SKILL_ROOT`cho thư mục tuyệt đối được báo cáo bởi người cài đặt.
là thư mục chứa các cài đặt `SKILL.md`, không phải nguồn bài học
thư mục và không phải không gian làm việc hiện tại:

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-contract-reviewer" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\n' "$SKILL_ROOT"
```

Nếu phiên đại lý đã mở, bắt đầu phiên mới hoặc sử dụng phiên chủ nhà đó
Đừng cho rằng mỗi máy chủ tải lại danh mục của nó.

### 3. Hãy gọi nó rõ ràng.

Trong đại lý được cài đặt, với `agent-skills-first-run`làm việc
thư mục, sử dụng cú pháp được hỗ trợ bởi máy chủ đó:

| Host | Explicit invocation |
|---|---|
| Codex | `skill-contract-reviewer`, or choose it from `/skills`, then provide the review request |
| Claude Code | `/skill-contract-reviewer` followed by the review request |
| Portable fallback | `Use skill-contract-reviewer to review the target package.` |

Sử dụng các giá trị tuyệt đối được in cho `SKILL_ROOT`và `TARGET_ROOT`trong
yêu cầu. yêu cầu chủ sở hữu để mở rộng chúng trước khi thực hiện và hiển thị chính xác
lệnh giải quyết, không phải lệnh phụ thuộc vào thư mục hoạt động của quy trình:

```text
Use skill-contract-reviewer to review <TARGET_ROOT>/my-first-skill. The installed bundle root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/check_skill.py <TARGET_ROOT>/my-first-skill. Before running it, show the fully resolved argv. Return the validation report, selected primitives, and one sentence for each selection. Include the resolved script path, resolved target path, cwd, argv, and exit code as execution evidence.
```

Chỉ thị được giải quyết nên có hình dạng này, không còn vị trí nào:

```bash
python3 "/absolute/install/path/skill-contract-reviewer/scripts/check_skill.py" \
  "/absolute/workspace/path/agent-skills-first-run/my-first-skill"
```

Kết quả thành công có cả ba tính chất:

1. Người chủ nhà tìm thấy `skill-contract-reviewer`bằng tên.
2. Người xem đọc hợp đồng gói và chạy bộ xác thực gói của nó.
3. Phản ứng chứa một báo cáo xác thực mà không có lỗi cấu trúc cho các
   mẫu, cộng với một lựa chọn nguyên thủy hợp lý.

Bằng chứng thực hiện cũng phải nêu tên đường kịch bản, đường mục tiêu, cwd, chính xác
Các đối tượng đối số và mã thoát.
chứng minh rằng văn bản bạn bè được cài đặt đã chạy.

Nếu máy chủ báo cáo rằng kỹ năng không có sẵn, kiểm tra cài đặt
mục đích, quét lại hoặc khởi động lại một lần, và thử lại yêu cầu rõ ràng.
viết lại mô tả kỹ năng để che giấu sự cố cài đặt.

### 4. Việc chọn lọc ngầm của các con thám

Bắt đầu một lượt đại lý mới và nhập vào cùng một nhiệm vụ mà không đặt tên kỹ năng:

```text
Review <TARGET_ROOT>/my-first-skill as a reusable agent package and tell me whether its package contract is valid.
```

Nếu chủ nhà cho thấy những kỹ năng đã chọn, ghi lại xem họ đã chọn hay không
`skill-contract-reviewer`Nếu chủ không tiết lộ đường dẫn, đánh dấu ngầm
Sự gọi rõ ràng là sự quay lại di động.

### 5. Làm sạch

Chỉ xóa gói kiểm tra được cài đặt:

```bash
npx skills remove skill-contract-reviewer
```

Chọn cùng một máy chủ và phạm vi sử dụng trong quá trình cài đặt. Sau khi quét lại hoặc mới
phiên, một yêu cầu rõ ràng cho `skill-contract-reviewer`nên báo cáo rằng
Không có sẵn.`my-first-skill`cho các bài học sau đó, hoặc loại bỏ
Đồ sơ của phòng thí nghiệm sau khi bạn hoàn thành đường đua.

## Vấn đề

Giả sử nhóm của bạn có một dòng công việc phát hành đáng tin cậy. Nó tìm thấy các thay đổi được sáp nhập, kiểm tra các ghi chú di chuyển, cập nhật nhật nhật ký thay đổi, chạy lệnh đóng gói và tạo danh sách kiểm tra xem xét.

Đặt dòng công việc đó vào một lệnh nhắc nhở làm cho nó dễ dàng dán và khó vận hành. Chỉ dẫn nhắc nhở không có danh tính ổn định, không có quy tắc phát hiện, không có giới hạn tài nguyên, không có hình dạng gói kiểm tra, và không có câu trả lời cho các câu hỏi cơ bản: Ai có thể gọi nó?

Sai lầm ngược lại là xem mọi hướng dẫn tái sử dụng như một kỹ năng.`SKILL.md`tạo ra một thư mục trông dễ di chuyển trong khi phụ thuộc vào hành vi không được ghi chép của một máy chủ.

Nhiệm vụ kỹ thuật đầu tiên là phân loại, quyết định đồ tạo vật là gì trước khi bạn quyết định cách đóng gói nó.

## Khái niệm

### Kỹ năng mã hóa kiến thức thủ tục

Một kỹ năng đại lý là một thư mục mà điểm nhập là`SKILL.md`.Tệp nhập chứa vật liệu trước của YAML theo sau là hướng dẫn Markdown. Thư mục cũng có thể chứa tham chiếu, kịch bản và tài sản.

```figure
skill-package-anatomy
```

Thư mục, không chỉ là tập tin Markdown, là đơn vị có thể triển khai.`SKILL.md`với các tham chiếu thiếu là một gói bị hỏng ngay cả khi vật liệu phía trước của nó phân tích.

### Các bản trừu tượng lân cận

| Artifact | Primary job | Loaded or run when | What it should not impersonate |
|---|---|---|---|
| Prompt | Shape one model interaction | Included by an application or user | A versioned package with resources |
| Repository instructions | Explain one codebase's standing rules | A coding runtime enters that scope | A reusable task workflow |
| Agent skill | Supply reusable procedural knowledge | Explicit or implicit activation | A hard authorization boundary |
| MCP tool | Expose a typed remote capability | The model or application calls it | A detailed operating procedure |
| Hook | Run deterministic logic on an event | The declared event occurs | Probabilistic model routing |
| Subagent | Delegate work with separate context and state | An orchestrator creates or calls it | A static instruction bundle |
| Plugin | Distribute a larger runtime extension | The host installs or enables it | The portable skill contract itself |
| Learned skill library | Store behavior discovered through experience | A policy retrieves a prior program or trajectory | A standards-based `SKILL.md` package |

Một kỹ năng phát hành có thể cho đại lý biết cách kiểm tra một bản phát hành. Một máy chủ MCP có thể phơi bày sổ đăng ký phát hành. Một cái móng có thể cấm đẩy trực tiếp. Một người phụ có thể kiểm tra độc lập ứng cử viên. Những mảnh này được tạo nên bởi vì chúng giữ trách nhiệm khác nhau.

### Từ "khả năng" đặt tên cho hai ý tưởng khác nhau

Các hệ thống nghiên cứu đôi khi gọi một chương trình học, quỹ đạo thành công hoặc phân đoạn chính sách cụ thể về môi trường là một kỹ năng. Một đại lý có thể tạo ra những hiện vật này trong quá trình khám phá, lấy lại chúng theo tương tự nhiệm vụ, thực hiện chúng và sửa đổi thư viện từ phản hồi.

Một kỹ năng đại lý trong mini-track này khác. Nó là một gói tác giả với một hợp đồng hệ thống tập tin được tuyên bố, siêu dữ liệu danh mục, tiết lộ tiến bộ, cuộc gọi trung gian thời gian chạy và các công cụ được kiểm soát bởi máy chủ. Nó có thể được tạo hoặc cải thiện bởi một đại lý, nhưng không cần học tập cho định dạng.

| Dimension | Agent Skill package | Learned skill library |
|---|---|---|
| Primary unit | `SKILL.md` directory | Program, policy, trajectory, or memory record |
| Creation | Authored, generated, or curated | Usually discovered from environment experience |
| Selection | Catalog description plus runtime policy | Retrieval or policy over task state |
| Execution | Model follows instructions and calls host tools | Environment runs a stored behavior or code artifact |
| Portability | Package contract can cross compatible hosts | Often tied to one environment and action space |
| Evaluation | Routing, artifact, safety, and host compatibility | Reward, success rate, transfer, and library growth |

Cả hai ý tưởng đều bao gồm năng lực tái sử dụng.

### Lái lõi di động

Các kỹ năng đặc biệt của Agent Skills yêu cầu hai trường chủ yếu:

```yaml
---
name: release-readiness
description: Inspect a release candidate when the user asks whether a version is ready to publish.
---
```

`name`là định danh ổn định. Nó phải đáp ứng các quy tắc đặt tên của đặc điểm và phù hợp với thư mục gốc. `description`là cả tài liệu và định tuyến metadata. Nó nên nói những gì kỹ năng làm và khi nào nó áp dụng.

Các trường tùy chọn di động là:

| Field | Purpose | Portability note |
|---|---|---|
| `license` | State the terms for the package | Core specification |
| `compatibility` | State environmental requirements | Core specification |
| `metadata` | Carry string-valued extension data | Core specification |
| `allowed-tools` | Suggest pre-approved tools | Experimental; host support varies |

Cơ quan Markdown nắm giữ các hướng dẫn hoạt động. Nó nên xác định dòng công việc, các điểm quyết định, hành vi thất bại và các con đường trực tiếp đến các nguồn hỗ trợ.

```markdown
# Release readiness

Use this workflow for a release candidate, not for ordinary development builds.

1. Read `references/release-policy.md`.
2. Run `python3 scripts/inspect_release.py --format json`.
3. Stop if the report contains a blocking failure.
4. Produce the checklist from `assets/release-checklist.md`.
5. Ask for approval before any publish or tag action.
```

### Các phần mở rộng thời gian chạy là một lớp thứ hai

Một số máy chủ chấp nhận cấu hình frontmatter hoặc đồng hành bổ sung. Những trường đó có thể hữu ích, nhưng chúng không tự động di động.

| Behavior | Example host extension | Portable core? |
|---|---|:---:|
| Hide a skill from model routing while keeping direct user invocation | `disable-model-invocation` | No |
| Hide a skill from the user's command menu while allowing model routing | `user-invocable` | No |
| Show argument help in a command menu | `argument-hint` | No |
| Run the skill in delegated context | `context`, `agent` | No |
| Pin model or reasoning settings | `model`, `effort` | No |
| Register lifecycle automation | `hooks` | No |
| Disable implicit invocation in Codex | `agents/openai.yaml` policy | No |

Hãy coi mỗi phần mở rộng như một bộ điều chỉnh. Giữ dòng công việc cốt lõi hợp lệ mà không cần nó, ghi lại sự vấp phải và kiểm tra máy chủ chủ tiêu thụ nó. Một thời gian chạy có thể bỏ qua một trường không rõ, từ chối nó hoặc bảo tồn nó mà không thực hiện hành vi.

### Frontmatter là metadata có thể thực hiện

Metadata thay đổi hành vi của hệ thống trước khi cơ thể kỹ năng được đọc.

- Một người bị hư hỏng`name`có thể khiến khám phá thất bại.
- Một sự mơ hồ`description`có thể định tuyến các yêu cầu sai.
- Một lá cờ chỉ dành cho con người có thể loại bỏ kỹ năng từ danh mục của mô hình.
- Một khoản trợ cấp công cụ có thể thay đổi liệu chủ nhà có yêu cầu cho phép hay không.
- Một cài đặt ngữ cảnh có thể di chuyển thực thi vào một phiên đặc vụ riêng biệt.

Xem xét mặt vật chất như mã cấu hình, xác nhận nó, phiên bản nó, và bao gồm hành vi của nó trong các đánh giá.

### Chuyển vòng đời kỹ năng

```figure
skill-runtime-lifecycle
```

Mỗi mũi tên là một ranh giới với chế độ thất bại riêng của nó.

1. **Discovery**tìm thấy các gói có thể ở các vị trí được cấu hình.
2. **Validation**từ chối các gói bị biến dạng hoặc không an toàn trước khi xuất bản danh mục.
3. **Cataloging**phơi bày một hợp lý `name`và `description`, không phải toàn bộ gói.
4. **Selection**quyết định liệu kỹ năng có liên quan hay không.
5. **Activation**tải cơ thể vào bối cảnh hình ảnh hình ảnh.
6. **Disclosure**đọc tài sản hoặc tài sản chỉ khi một chi nhánh yêu cầu chúng.
7. **Execution**sử dụng các công cụ chủ dưới sự cho phép và quy tắc cô lập của chủ.
8. **Verification**kiểm tra các tác phẩm tạo ra độc lập với yêu cầu của mô hình.

Sự sụp đổ của các giai đoạn này gây ra mô hình tâm lý xấu. Một kỹ năng được phát hiện không hoạt động. Một kỹ năng hoạt động không được phép làm tất cả những gì nó mô tả.

### Kỹ năng và công cụ là orthogonal

MCP trả lời, "Các khả năng nào mà ứng dụng này có thể yêu cầu, và những kế hoạch của họ là gì?" Một kỹ năng trả lời, "Làm thế nào một đại lý nên tiếp cận lớp này của nhiệm vụ?"

```figure
skill-tool-orthogonality
```

Kỹ năng có thể đặt tên cho một công cụ, nhưng chủ sở hữu danh sách khả năng thực tế. Nếu công cụ không có, kỹ năng nên báo cáo một sự thất bại hoặc thất bại rõ ràng.

### Kỹ năng và hướng dẫn lưu trữ là phạm vi khác nhau

Các hướng dẫn kho chứa mô tả môi trường bạn đã ở: lệnh, quy ước, các tệp được tạo và ranh giới. Một kỹ năng cung cấp quy trình có thể được sử dụng nhiều lần cho một nhiệm vụ có thể xảy ra trên nhiều kho chứa.

Khi cả hai áp dụng, yêu cầu người dùng hoạt động và các quy tắc kho hạn chế kỹ năng. Một kỹ năng tái tạo chung không được bỏ qua một quy tắc kho cấm chỉnh sửa các tệp được tạo.

### Kỹ năng không nhập khẩu lẫn nhau

Một kỹ năng có thể hướng dẫn người đại lý gọi một kỹ năng khác, nhưng đây không phải là nhập khẩu ở cấp độ ngôn ngữ. kỹ năng thứ hai vẫn đi qua phát hiện thời gian chạy, đủ điều kiện, kích hoạt, quyền và xử lý ngữ cảnh.

Viết các phụ thuộc qua kỹ năng như các cạnh luồng công việc có thể quan sát được:

```markdown
After producing the candidate changelog, invoke the `release-risk-review` skill.
Pass the candidate path and require a blocking or non-blocking verdict.
If that skill is unavailable, stop and report the missing dependency.
```

Điều này làm cho sự phụ thuộc có thể kiểm tra và cho phép chủ nhà thực thi chính sách.

## Hãy xây dựng nó

`code/main.py`thực hiện một xác thực viên định hướng tiêu chuẩn nhỏ và một người chọn đồ tạo vật. Nó chỉ còn stdlib để mọi quy tắc được nhìn thấy.

Người xác nhận cho thấy:

- `parse_frontmatter(text)`để tách metadata khỏi cơ thể.
- `validate_skill_text(text, directory_name, allowed_runtime_extensions=())`để kiểm tra các trường yêu cầu, đặt tên, mở rộng không rõ, sự hiện diện của cơ thể và giới hạn di động.
- `ValidationIssue`và `SkillReport`để trả lại bằng chứng cấu trúc thay vì một boolean không rõ ràng.
- `FrontmatterSyntaxError`cho các thông tin nhập mà không thể giải thích an toàn.

Người chọn sẽ cho thấy`TaskShape`và `select_primitives(task)`Nó lập bản đồ nhu cầu của một nhiệm vụ với mã thông thường, hướng dẫn kho, kỹ năng, một cái móc, một subagent, hoặc một công cụ MCP.

- Đi phòng thí nghiệm.

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/22-skills-and-agent-sdks
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Blok lệnh này cần một bản sao địa phương và phải bắt đầu từ bất cứ nơi nào bên trong
Cái người sao đó`git rev-parse --show-toplevel`có thể giải quyết nguồn kho.

Các bản demo in JSON cho một kỹ năng di động hợp lệ, một kỹ năng mở rộng máy chủ, một gói không hợp lệ và một số quyết định hình thức nhiệm vụ.

### Các vấn đề về lệnh xác nhận

Thiết lập các dữ liệu cấu trúc giá rẻ trước khi có quy tắc nội dung sâu hơn:

```figure
skill-validation-order
```

Trật tự này ngăn chặn các lỗi thứ cấp không che giấu bất biến bị hỏng đầu tiên.

## Sử dụng nó

Trước khi viết một kỹ năng, hãy điền vào thẻ quyết định này:

| Question | If yes | Likely primitive |
|---|---|---|
| Does this need reusable model judgment across several steps? | The procedure is stable but decisions vary | Skill |
| Must this happen every time an event fires? | Missing one execution is unacceptable | Hook or application code |
| Does the model need an external capability with typed inputs? | The operation lives outside model context | Tool or MCP server |
| Does the work need isolated context, state, or ownership? | A separate worker returns a bounded result | Subagent |
| Is this guidance specific to one repository? | It describes local commands and constraints | Repository instructions |
| Is one interaction enough? | No package lifecycle is needed | Prompt |

Nhiều dòng công việc sản xuất sử dụng nhiều hơn một hàng.

## Chuyển nó

Bài học này tạo ra những`skill-contract-reviewer`gói dưới `outputs/`Nó chứa:

- một thiết bị di động`SKILL.md`xem xét gói kỹ năng được đề xuất;
- danh sách kiểm tra tham chiếu cho hợp đồng di động và lựa chọn nguyên thủy;
- một kịch bản xác thực xác định;
- Các thiết bị hình dạng nhiệm vụ bao gồm các lời nhắc, kỹ năng, công cụ, móng, mã thông thường và các bộ phận phụ.

Lắp đặt toàn bộ gói, không chỉ file nhập của nó:

```bash
cd "$(git rev-parse --show-toplevel)"
python3 scripts/install_skills.py /tmp/aiefs-skills --phase 13 --type skill
```

Người cài đặt khóa học báo cáo mỗi kỹ năng phiên bản giai đoạn 13 và viết
`/tmp/aiefs-skills/manifest.json`. Điểm đến sạch này kiểm tra hình dạng gói;
vòng lặp thành công đầu tiên trên kiểm tra phát hiện và triệu hồi trong một máy chủ thực tế.

Các bài học sau đây làm sâu sắc hơn từng giai đoạn chu kỳ cuộc sống. Bài học 24 xây dựng khám phá và tiết lộ tiến bộ. Bài học 25 xây dựng chính sách triệu tập và định tuyến. Bài học 26 tách quyền ra khỏi sandboxing. Bài học 27 biến toàn bộ gói thành một đồ tạo được đánh giá.

## Các bài tập

1. Lập 5 dòng công việc từ nhóm của bạn bằng cách sử dụng `TaskShape`Hãy bảo vệ mọi trường hợp mà bạn chọn nhiều hơn một nguyên thủy.
2. Thêm các thử nghiệm giới hạn chứng minh rằng một 500 ký tự `compatibility`giá trị vượt qua và giá trị 501 ký tự thất bại như một lỗi quy định.
3. Thêm một phần mở rộng thời gian chạy vào danh sách cho phép. Viết một bài kiểm tra chứng minh cùng một tệp vẫn có thể phân biệt với một kỹ năng chỉ di động.
4. Chia một lời nhắc 400 dòng thành `SKILL.md`, một tham chiếu, một hợp đồng kịch bản, và một mẫu đầu ra.
5. Thiết kế phản ứng thất bại cho một kỹ năng tham chiếu một công cụ MCP không sẵn có. Đừng lặng lẽ thay thế một công cụ với các quyền rộng hơn.
6. Xem lại một kỹ năng hiện có và dán nhãn mỗi câu như là định tuyến, quy trình, chính sách, chỉ dẫn tham chiếu hoặc hợp đồng xuất phát.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| Agent skill | "A saved prompt" | A discoverable directory of procedural instructions and optional resources |
| Portable core | "Fields every runtime shares" | The contract defined by the Agent Skills specification |
| Runtime extension | "Extra frontmatter" | Host-specific configuration whose behavior requires a compatible adapter |
| Activation | "The skill ran" | The skill body entered model-visible context; execution may come later |
| Skill dependency | "Import another skill" | A runtime-mediated invocation edge with availability and policy checks |
| Tool contract | "A function schema" | Inputs, outputs, permissions, side effects, errors, and evidence for a capability |

## Đọc thêm

- [Agent Skills specification](https://agentskills.io/specification)Đối với danh mục di động và hợp đồng mặt hàng.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)cho phạm vi, hướng dẫn và tổ chức nguồn lực.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)cho hành vi khám phá và kêu gọi Codex hiện tại.
- [Claude Code skills](https://code.claude.com/docs/en/skills)cho một runtime của cuộc gọi, lập luận, công cụ và các phần mở rộng nội dung ủy quyền.
