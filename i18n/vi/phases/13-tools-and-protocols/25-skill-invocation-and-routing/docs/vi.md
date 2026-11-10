# Việc gọi kỹ năng và định tuyến

> Việc kêu gọi là một quyết định của cơ quan và sau đó là một quyết định liên quan.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 24 (Skill Discovery and Progressive Disclosure)
**Time:** ~105 minutes

## Mục tiêu học tập

- Sự khác biệt giữa việc gọi người dùng rõ ràng, việc gọi mô hình ngầm, việc gọi ứng dụng và việc gọi kỹ năng cho kỹ năng.
- Mô hình khả năng nhìn thấy con người và mô hình đủ điều kiện như các chiều kích chính sách độc lập.
- Viết mô tả định tuyến với các kích hoạt tích cực và biên giới gần bị bỏ lỡ.
- Sự đủ điều kiện, lựa chọn, kích hoạt, liên kết đối số và thực hiện trong các dấu vết và thử nghiệm.
- Chuyển đổi các trường gọi cụ thể thời gian chạy mà không trình bày chúng như là vật liệu mặt trước di động.

## Vấn đề

Bạn cài đặt một `database-migration`Skill. người dùng có thể chạy nó bằng tên, nhưng mô hình cũng thấy mô tả của nó và chọn nó khi ai đó hỏi một câu hỏi cơ sở dữ liệu chung.

Ông thêm vào`user-invocable: false`Trong một thời gian chạy khác, trường đó bị phớt lờ.`disable-model-invocation: true`Trong thời gian chạy mà người dùng hiểu nó, người dùng vẫn có thể gọi nó rõ ràng.

Không có gì sai với tên trường. Mô hình là sai. "Người dùng có thể thấy nó", " Mô hình có thể chọn nó, " " ứng dụng có thể tải trước nó, "và "các công cụ bên trong nó có thể thực hiện" là các thực tế riêng biệt.`invocable`không thể thể diễn tả được.

Routing có một chế độ thất bại thứ hai. Nếu mô tả mơ hồ, một số kỹ năng trở nên hợp lý. Nếu mô tả được lấp đầy với các từ khóa, các nhiệm vụ không liên quan sẽ kích hoạt chúng.

## Khái niệm

### Năm kênh có thể bắt đầu chu kỳ cuộc sống

| Actor | Invocation shape | Typical use | Main risk |
|---|---|---|---|
| Human user | Names a skill in the UI or prompt | Deliberate workflow selection | User expects availability or authority the host does not grant |
| Model or autonomous agent | Selects a catalog entry from task context | Automatic expert procedure | False-positive routing |
| Application | Activates or preloads a skill through runtime code | Fixed product workflow | Hidden coupling to one host |
| Another skill or subagent | Requests an exact skill as a workflow dependency | Composition | Cycles, missing dependency, or context bleed |
| Evaluation harness | Activates an exact skill under a fixed scenario | Repeatable measurement | Tests the skill while accidentally bypassing the production policy under study |

Các thông số kỹ năng đại lý di động xác định gói. Nó không tiêu chuẩn hóa một UI lệnh slash phổ quát, cờ định tuyến ngầm, API ứng dụng hoặc vòng đời subagent.

### 5 giai đoạn gọi

```figure
skill-invocation-stages
```

Sử dụng chính xác những từ này:

- **Eligible**nghĩa là chính sách cho phép diễn viên này yêu cầu kỹ năng.
- **Selected**nghĩa là người dùng đặt tên nó hoặc một bộ định tuyến đánh giá nó có liên quan.
- **Activated**nghĩa là các hướng dẫn của nó được đưa vào bối cảnh làm việc.
- **Executing**nghĩa là đại lý bắt đầu làm việc mô hình hoặc công cụ theo các hướng dẫn đó.
- **Completed**nghĩa là sản phẩm đã đáp ứng kiểm tra thành công độc lập.

Một dấu vết chỉ ghi lại`skill_used=true`ẩn ranh giới nơi một thất bại xảy ra.

### Người và mô hình invocation hình thành một 2x2 matrix

| Human can invoke | Model can invoke | Mode | Suitable examples |
|:---:|:---:|---|---|
| Yes | Yes | Shared | Code explanation, test planning, documentation review |
| Yes | No | Human-only | Publish preparation, billing export, destructive cleanup plan |
| No | Yes | Model-only | Internal style guide, domain reference, automatic support procedure |
| No | No | Disabled or application-only | Staged rollout, deprecated package, programmatic preload |

Matrix là một mô hình chính sách, không phải YAML tiêu chuẩn.

Một máy chủ hiện tại sử dụng `disable-model-invocation: true`cho hàng chỉ dành cho con người và `user-invocable: false`cho dòng chỉ mô hình. mặc định là cả hai. Một máy chủ khác sử dụng `agents/openai.yaml`với `allow_implicit_invocation: false`để giữ cho cuộc gọi rõ ràng trong khi vô hiệu hóa lựa chọn ngầm. Đây là bộ điều chỉnh thời gian chạy.

Những chi tiết gây nhầm lẫn là quan trọng:`user-invocable: false`không có nghĩa là "chương trình không thể sử dụng điều này". Nó loại bỏ cuộc gọi trực tiếp của người dùng trong máy chủ xác định nó. `disable-model-invocation: true`không có nghĩa là "nghệ năng bị vô hiệu hóa". Nó loại bỏ sự lựa chọn bắt đầu theo mô hình trong khi vẫn giữ cho truy cập rõ ràng của người dùng.

### Sự kêu gọi rõ ràng là danh tính trước tiên

Một cuộc gọi rõ ràng cung cấp danh tính trực tiếp:

```text
/release-readiness v2.4.0
```

hoặc:

```text
release-readiness check v2.4.0 without publishing
```

Tài liệu giao diện Codex hiện tại `/skills`cho việc lựa chọn và tên kỹ năng đơn giản trong các yêu cầu yêu cầu khai báo rõ ràng.`/skill-name`và mở rộng lập luận cụ thể cho máy chủ. Hình pháp chính xác, khả năng hiển thị menu, quy tắc trích dẫn và mở rộng biến thuộc về máy chủ.

Một yêu cầu rõ ràng vẫn thông qua chính sách. Chọn tên một kỹ năng không nên bỏ qua các quyền bị thiếu, hạn chế không gian làm việc, cửa phê duyệt hoặc cách ly thời gian chạy.

### Việc gọi ngầm là mô tả đầu tiên

Đối với định tuyến ngầm, mô hình ban đầu nhìn thấy metadata danh mục thay vì toàn bộ cơ thể.

Thất yếu:

```yaml
description: Helps with releases.
```

Tự rộng quá:

```yaml
description: Use for release, version, package, build, deploy, publish, tag, changelog, GitHub, CI, or software tasks.
```

Giới hạn:

```yaml
description: Inspect an already prepared release candidate and produce a readiness report. Use when the user asks whether a version, tag, package, or image is ready to publish; do not use for ordinary build failures or feature development.
```

Phiên bản giới hạn có chứa:

1. **Capability:**kiểm tra một ứng cử viên đã chuẩn bị.
2. **Output:**báo cáo sẵn sàng.
3. **Positive boundary:**hỏi liệu một vật thể được phóng thích có sẵn không.
4. **Negative boundary:**Những công trình xây dựng và phát triển bình thường là không có tầm quan trọng.

Biên giới tiêu cực hữu ích khi hai kỹ năng gần nhau chia sẻ từ vựng.

### Routing là phân loại với tùy chọn không tham gia

Để có kỹ năng`s`và yêu cầu`x`, tưởng tượng điểm của router:

```text
score(s, x) = capability_match + trigger_match + context_match - exclusion_match - ambiguity_penalty
```

Điểm số chính xác có thể là một quyết định LLM thay vì toán học. Nguyên tắc kỹ thuật vẫn giữ nguyên: sự lựa chọn nên vượt qua ngưỡng và kỹ năng cạnh tranh. Khi bằng chứng yếu, hãy kiềm chế.

```figure
skill-routing-abstention
```

Đối với các kỹ năng có tác động cao, định tuyến ngầm có thể không phù hợp ngay cả khi có mô tả mạnh mẽ. Sử dụng chính sách chỉ dành cho con người khi chi phí của một dương tính giả vượt quá sự tiện lợi của việc lựa chọn tự động.

### Sự đủ điều kiện phải đi trước xếp hạng

Đừng ghi được từng kỹ năng được phát hiện, chọn được điểm mạnh nhất, và sau đó kiểm tra chính sách của một kỹ năng.

Sử dụng thứ tự này cho định tuyến ngầm:

1. Bộ lọc phát hiện ra kỹ năng của người yêu cầu và bộ chuyển đổi chủ động.
2. Chỉ ghi điểm cho các ứng viên đủ điều kiện.
3. Chọn trận đấu đủ điều kiện mạnh nhất nếu nó xóa ngưỡng và các quy tắc mơ hồ.
4. Tránh khi không có ứng cử viên nào đủ điều kiện hoặc không có điểm số đủ mạnh.

Giả sử`incident-triage`điểm số`0.80`nhưng phần mở rộng host của nó vô hiệu hóa việc gọi mô hình. `incident-review`điểm số`0.55`và cho phép gọi mô hình.`incident-review`là ứng cử viên tốt nhất đủ điều kiện.`incident-triage`, phủ nhận nó, và dừng lại.

Việc sắp xếp này cũng giữ cho các thay đổi chính sách không thay đổi ý nghĩa của điểm số liên quan.

### Các đánh giá định tuyến cần gần misses

Các trường hợp tích cực chứng minh sự hồi tưởng:

```json
{"prompt":"Is version 2.4.0 ready to publish?","expected":"release-readiness"}
```

Những âm tính rõ ràng chứng minh sự chính xác cơ bản:

```json
{"prompt":"Explain rotary position embeddings.","expected":null}
```

Những thất bại gần sẽ làm lộ chất lượng giới hạn:

```json
{"prompt":"Why did today's package build fail?","expected":"build-diagnostics"}
```

Những cổ phiếu gần như bị bỏ lỡ `package`và `build`Một bộ định tuyến chỉ có những điểm tích cực rõ ràng và những điểm tiêu cực không liên quan sẽ đánh giá cao chất lượng.

### Các lập luận có ba đại diện

Một lập luận triệu hồi vượt qua một số ranh giới:

```figure
skill-argument-boundaries
```

Ở mỗi ranh giới, giữ nguyên ý định mà không coi văn bản như mã.

- Các máy phân tích chủ quyết định tổng hợp lệnh và trích dẫn.
- Kỹ năng nhận được văn bản hoặc biến bị ràng buộc theo quy tắc chủ.
- Các hướng dẫn xác nhận các giá trị và mặc định yêu cầu.
- Một tool call chuyển đổi giá trị thành một schema được gõ và tái xác nhận chúng.

Đừng liên kết các lập luận nguyên liệu vào các lệnh shell. C prefer a script invoked with an argument vector or a typed MCP tool.

### Việc gọi ứng dụng là sự dàn xếp rõ ràng

Một sản phẩm có thể kích hoạt một kỹ năng bởi vì dòng công việc của nó đã biết loại nhiệm vụ. Ví dụ, một dịch vụ xem xét pull-request có thể tải trước `pull-request-risk-review`sau khi người dùng nhấn Review.

Điều này loại bỏ sự không chắc chắn định tuyến nhưng tạo ra sự phụ thuộc vào API thời gian chạy. Giữ bộ điều chỉnh đó bên ngoài cơ thể di động:

```figure
skill-host-adapter
```

Kỹ năng này nên vẫn dễ hiểu khi được mở bởi một khách hàng khác tuân thủ.

### Việc kêu gọi kỹ năng là một lợi thế giống như công cụ

Giả sử`release-readiness`yêu cầu `security-change-review`khi các tập tin phụ thuộc thay đổi.

Người gọi phải cung cấp:

- danh tính kỹ năng mục tiêu;
- một nhiệm vụ và các con đường tạo vật bị giới hạn;
- hợp đồng phản ứng dự kiến;
- Lý do của việc kêu gọi;
- một sự thất bại nếu không có;
- Quy tắc độ sâu tối đa hoặc chu kỳ.

```json
{
  "target_skill": "security-change-review",
  "task": "Review dependency changes in the candidate diff",
  "inputs": ["artifacts/release.diff"],
  "expected": "risk-report.json",
  "max_depth": 2
}
```

Kỹ năng thứ hai không được dán mù quáng vào kỹ năng đầu tiên. Người chủ quyết định làm thế nào để kích hoạt nó và liệu nó có chia sẻ ngữ cảnh, chạy trong một garpu, hoặc trả lại thông qua kết quả công cụ.

### Chuyện sống của ngữ cảnh là cụ thể cho chủ nhà

Sau khi kích hoạt, bộ phận kỹ năng có thể vẫn còn trong cuộc trò chuyện, được tóm tắt trong khi nén hoặc chạy trong một bối cảnh ủy quyền.

Đừng viết một kỹ năng phụ thuộc vào giả định không thể nhìn thấy được trong suốt đời. Đặt các sản phẩm bền vững trong các tệp hoặc trạng thái đánh dấu, làm cho việc tái nhập an toàn, và nói ra những gì phải được tải lại sau khi bị gián đoạn.

```markdown
On resume, read `artifacts/release-readiness.json` if it exists.
Revalidate the candidate commit before continuing.
Do not repeat an external write whose idempotency key is already recorded.
```

## Hãy xây dựng nó

`code/main.py`thực hiện chính sách và định tuyến như các bộ chuyển đổi riêng biệt.

Mô hình bao gồm:

- `Actor`cho người, mô hình, nhân viên tự trị, ứng dụng, kỹ năng và người gọi sử dụng;
- `SkillMetadata`cho danh tính định tuyến;
- `InvocationPolicy`Đối với các mô hình người/mẫu;
- `InvocationRequest`và `InvocationDecision`cho các đầu vào và kết quả có thể theo dõi;
- `CorePolicyAdapter`cho hành vi di động mà không có phần mở rộng host;
- `ExtensionPolicyAdapter`cho các trường runtime được công nhận;
- `build_invocation_matrix(policy)`cho khung cảnh 2x2;
- `route_request(skills, request, adapter)`cho việc lọc đủ điều kiện trước khi xếp hạng, lựa chọn và từ chối liên quan.

Đi đi.

```bash
cd phases/13-tools-and-protocols/25-skill-invocation-and-routing
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Demo in một matrix và quyết định cho mô hình con người rõ ràng, ngầm, đại lý tự trị, ứng dụng, kỹ năng-sự tạo thành, và kênh khai thác. Kết quả của nó cho thấy một kết hợp từ điển bị chặn trên được loại bỏ trước khi một lựa chọn thay thế đủ điều kiện được xếp hạng. Nó cũng bao gồm danh sách tên chính xác. Không cần thiết API mô hình. Các định tuyến xác định tồn tại để làm cho các ranh giới chính sách được kiểm tra, không phải để tuyên bố rằng sự phù hợp từ điển tái tạo định tuyến mô hình sản xuất.

### Tại sao bộ điều chỉnh lõi và mở rộng được tách biệt

Nếu một bộ phân tích gán ý nghĩa cho mỗi trường vật liệu trước được quan sát, nó lặng lẽ thúc đẩy các quy ước thời gian chạy thành một tiêu chuẩn giả.

- `CorePolicyAdapter`sử dụng chỉ chính sách được cung cấp theo ứng dụng.`ExtensionPolicyAdapter`nhận ra một tập hợp rõ ràng của các trường chủ và ghi chép mà trường đã thay đổi quyết định.

## Sử dụng nó

Viết một hợp đồng triệu tập trước khi xuất bản một kỹ năng:

```yaml
actors:
  human: allow
  model: deny
  application: allow
  skill: deny
explicit_name: release-readiness
arguments:
  candidate: required
  publish: fixed_false
ambiguity: ask_user
missing_dependency: stop
context:
  durable_state: artifacts/release-readiness.json
  max_composition_depth: 2
```

Hợp đồng này là tài liệu thiết kế cho các bộ điều chỉnh và thử nghiệm.`SKILL.md`Các vấn đề trước trừ khi một tiêu chuẩn đã rõ ràng chấp nhận nó.

## Chuyển nó

Bài học này tạo ra những`skill-invocation-router`Nó bao gồm một tham chiếu mô hình gọi, một chính sách chủ host ví dụ và một CLI không thực hiện đánh giá một con người, mô hình, đại lý tự trị, ứng dụng, thành phần kỹ năng hoặc yêu cầu khai thác và trả lại quyết định JSON với kênh, bộ điều chỉnh, điểm số và lý do.

CLI một yêu cầu là một cuộc thăm dò chính sách, không phải là đánh giá kích hoạt đầy đủ. Sử dụng thiết kế được dán nhãn tích cực và gần bị bỏ lỡ trong Bài học 27 để tính toán số lượng nhầm lẫn, độ chính xác, thu hồi và ổn định chạy lặp lại.

## Các bài tập

1. Tạo tất cả bốn hàng của bộ vi mô hình/mô hình và viết một trường hợp sử dụng hợp pháp cho mỗi hàng.
2. Thêm kích hoạt chỉ ứng dụng vào `CorePolicyAdapter`Bằng chứng rằng người và người gọi mẫu vẫn bị từ chối.
3. Viết mười điểm gần như bị bỏ lỡ cho một kỹ năng triển khai.
4. Thêm một khoảng cách mơ hồ giữa hai điểm dẫn đầu.`ask`khi biên giới quá nhỏ.
5. Thêm độ thành phần tối đa cho các yêu cầu kỹ năng cho kỹ năng và phát hiện một chu kỳ hai kỹ năng.
6. Đưa ra cùng một bộ nhãn thông qua bộ chuyển đổi lõi và mở rộng.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| Explicit invocation | "Slash command" | An actor supplies skill identity directly, subject to policy |
| Implicit invocation | "The model chooses" | A router selects from eligible catalog metadata based on task context |
| User-invocable | "Humans can use it" | A host-specific menu or direct-invocation property, not a core field |
| Model-invocable | "The agent can use it" | Eligibility for implicit model selection under host policy |
| Invocation adapter | "Frontmatter parser" | Code that maps a host's fields and APIs into a declared policy model |
| Near miss | "Hard negative" | A non-triggering request that resembles a skill's intended inputs |
| Abstention | "No skill selected" | A deliberate routing result when evidence is absent or ambiguous |

## Đọc thêm

- [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)cho các tác động tích cực, tính cụ thể và đánh giá.
- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)cho thiết kế đánh giá kích hoạt và đầu ra.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)cho các kiểm soát khai báo rõ ràng và ngầm của Codex hiện tại.
- [Claude Code skills](https://code.claude.com/docs/en/skills)cho một người chủ nhà `user-invocable`- `disable-model-invocation`, các lập luận và bối cảnh ủy quyền.
