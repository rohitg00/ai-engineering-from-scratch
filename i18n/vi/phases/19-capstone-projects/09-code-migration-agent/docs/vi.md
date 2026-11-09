# Capstone 09  Code Migration Agent (Repo-Level Language / Runtime Upgrade)

> MigrationBench của Amazon (Java 8 đến 17) và bộ di chuyển Py2-to-Py3 của Google đặt bar 2026 . OpenRewrite của Moderne thực hiện các bản viết lại AST xác định ở quy mô. Grit nhắm đến cùng một vấn đề với kiểu codemod DSL. Mô hình sản xuất kết hợp cả hai: một nền xác định cho các bản viết lại an toàn cộng với một lớp chất đối tác cho các trường hợp mơ hồ, một hộp cát cho mỗi ngành xây dựng, và một vòng thử nghiệm biến màu xanh lá cây trước khi PR mở. Điểm cuối là di chuyển 50 repos thực và công bố tỷ lệ vượt qua với phân loại thất bại.

**Type:** Capstone
**Languages:** Python (agent), Java / Python (targets), TypeScript (dashboard, agent scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## Vấn đề

Di chuyển mã quy mô lớn là một trong những ứng dụng sản xuất sạch nhất của các chất mã hóa năm 2026. Sự thật trên mặt đất là rõ ràng (bộ thử nghiệm có vượt qua sau khi di cư không?), phần thưởng là thực (một di cư phi đội Java-8 là một dự án quy mô nhân viên), và các tiêu chuẩn là công khai (MigrationBench 50-repo phụ tập hợp). Moderne's OpenRewrite xử lý phía xác định. Lớp đại lý xử lý mọi thứ mà công thức OpenRewrite không thể: viết lại không rõ ràng, trôi dạt hệ thống xây dựng, cú pháp đuôi dài, phá vỡ phụ thuộc chuyển tiếp.

Bạn sẽ xây dựng một đại lý lấy một Java 8 repo (hoặc Python 2 repo) và tạo ra một chi nhánh di chuyển CI xanh. Bạn sẽ đo lường tỷ lệ vượt qua, bảo tồn bảo hiểm thử nghiệm, chi phí cho mỗi repo và xây dựng một phân loại thất bại.

## Khái niệm

Hãng đường ống có hai lớp.**deterministic substrate**(OpenRewrite cho Java, libcst cho Python) chạy phần lớn các bản viết lại cơ học một cách an toàn: nhập khẩu, chữ ký phương pháp, chỉnh sửa an toàn không, thử với các nguồn lực, thay thế API lỗi thời. Nó nhanh chóng và tạo ra sự khác biệt có thể kiểm toán.**agent layer**(OpenAI Agents SDK hoặc LangGraph trên Claude Opus 4.7 và GPT-5.4-Codex) xử lý các trường hợp các công thức không thể: nâng cấp tập tin xây dựng (Maven / Gradle / pyproject), xung đột phụ thuộc chuyển tiếp, vỏ thử nghiệm, ghi chú tùy chỉnh.

Mỗi repo nhận được một hộp cát Daytona với thời gian chạy mục tiêu được cài đặt trước. Đại lý lặp lại: chạy xây dựng, phân loại lỗi, áp dụng sửa chữa, chạy lại. Giới hạn cứng: 30 phút mỗi repo, 8 đô la mỗi repo, 20 lượt đại lý. Nếu tất cả các thử nghiệm vượt qua và bảo hiểm giảm không hơn 2 điểm phần trăm, chi nhánh mở PR. Nếu không, repo được nộp dưới lớp thất bại với bằng chứng.

Các phân loại thất bại là có thể cung cấp. Trong 50 repos, những gì đã bị hỏng? Transitive deps? thông chú tùy chỉnh? xây dựng phiên bản công cụ? thử các vỏ không liên quan đến di cư? Mỗi lớp nhận được một con số và một sự khác biệt ví dụ. Các tác giả công thức trong tương lai có thể nhắm mục tiêu vào ba người hàng đầu.

## Kiến trúc

```
target repo
      |
      v
OpenRewrite / libcst deterministic recipes
   (safe, fast, auditable, ~70-80% of fixes)
      |
      v
Daytona sandbox per branch
      |
      v
agent loop (Claude Opus 4.7 / GPT-5.4-Codex):
   - run build -> capture failures
   - classify failures (build, test, lint)
   - apply fix (patch or retry recipe)
   - rerun
   - budget: 30 min, $8, 20 turns
      |
      v
test + coverage delta gate
      |
      v (passed)
open PR
      |
      v (failed)
file under failure class + attach repro
```

## Thống

- Substrate định nghĩa: OpenRewrite (Java) hoặc libcst (Python)
- Trình tác: OpenAI Agents SDK hoặc LangGraph trên Claude Opus 4.7 + GPT-5.4-Codex
- Sandbox: Daytona devcontainers per branch, thời gian chạy mục tiêu được cài đặt trước (Java 17 / Python 3.12)
- Xây dựng hệ thống: Maven, Gradle, uv (Python)
- Các điểm chuẩn: Amazon MigrationBench 50-repo subset (Java 8 đến 17), Google App Engine Py2-to-Py3 repos
- Phân tích thử nghiệm: chạy ngang, bảo hiểm thông qua Jacoco (Java) hoặc coverage.py (Python)
- Khả năng quan sát: Langfuse + trace bundle per repo với mỗi phân biệt
- bảng điều khiển: bảng điều khiển phân loại lỗi với số lượng cho mỗi lớp và sự khác biệt ví dụ

```figure
ce-migration-funnel
```

## Hãy xây dựng nó

1. **Recipe pass.**Lên OpenRewrite (Java) hoặc libcst (Python) công thức đầu tiên. bắt được 70-80% của các di chuyển là cơ khí. cam kết như "phác thảo" cam kết.

2. **Build trial.**Daytona Sandbox: cài đặt thời gian chạy mục tiêu, chạy xây dựng nếu xanh, bỏ qua các thử nghiệm nếu đỏ, giao cho đại lý

3. **Agent loop.**LangGraph với công cụ: `run_build`- `read_file`- `edit_file`- `run_test`- `git_diff`- Trình tác phân loại lỗi (thực độ, tổng hợp, kiểm tra, công cụ xây dựng) và áp dụng một sửa chữa nhắm mục tiêu.

4. **Budget caps.**30 phút đồng hồ tường mỗi repo, chi phí 8 đô la, 20 lượt đại lý. bất kỳ sự phá vỡ nào dừng lại và các tập tin dưới "budget_exhausted" với sự khác biệt hiện tại.

5. **Test + coverage gate.**Sau khi xây dựng được làm xanh, chạy bộ thử nghiệm. So sánh bảo hiểm với repo cơ sở. Nếu bảo hiểm giảm hơn 2 điểm phần trăm, hãy tập tin dưới "cụ thể_đưa chuộng".

6. **PR open.**Khi thành công, đẩy chi nhánh, mở PR với sự khác biệt và một bản tóm tắt của các công thức được áp dụng và những gì cam kết của đại lý tác giả.

7. **Failure taxonomy.**Đối với mỗi repo thất bại, gắn thẻ với một lớp: `dep_upgrade_required`- `build_tool_drift`- `custom_annotation`- `test_flake`- `syntax_edge_case`- `budget_exhausted`- Hãy xây dựng bảng điều khiển.

8. **50-repo run.**Thực hiện trên bộ phận MigrationBench. báo cáo tỷ lệ vượt qua mỗi lớp, chi phí mỗi repo, bảo tồn bảo hiểm và chỉ so sánh với định nghĩa.

## Sử dụng nó

```
$ migrate legacy-java-service --target java17
[recipe]   27 rewrites applied (JUnit 4->5, HashMap initializer, try-with-resources)
[build]    FAIL: cannot find symbol sun.misc.BASE64Encoder
[agent]    turn 1 classify: removed_jdk_api
[agent]    turn 2 apply: sun.misc.BASE64Encoder -> java.util.Base64
[build]    OK
[tests]    412/412 passing; coverage 84.1% -> 84.3%
[pr]       opened #1841  cost=$3.20  turns=4
```

## Chuyển nó

`outputs/skill-migration-agent.md`được giao. Với repo, nó thực hiện các công thức xác định, sau đó một vòng tròn đại lý để tạo ra một nhánh di chuyển xanh, hoặc lưu trữ repo dưới một lớp phân loại.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | MigrationBench pass rate | 50-repo subset pass@1 |
| 20 | Test-coverage preservation | Mean coverage delta vs base |
| 20 | Cost per migrated repo | $/repo on passing runs |
| 20 | Agent / deterministic-tool integration | Fraction of fixes that OpenRewrite handled vs agent authored |
| 15 | Failure analysis write-up | Taxonomy completeness with exemplars |
| **100** | | |

## Các bài tập

1. Tiếp tục chạy đường ống di chuyển chỉ bằng OpenRewrite (không có đại lý). So sánh tỷ lệ vượt qua với toàn bộ đường ống. Xác định các trường hợp chỉ có đại lý là sự khác biệt.

2. Thực hiện kiểm tra "lint-clean": sau khi di chuyển, chạy một linter kiểu (không có điểm cho Java, ruff cho Python). Thiết lập PR nếu xuất hiện các lỗi lint mới. Đo tỷ lệ bảo mật được bảo tồn nhưng kiểu lại.

3. Thêm một tối ưu hóa "các khác biệt tối thiểu": sau khi chi nhánh của đại lý vượt qua các thử nghiệm, cắt bỏ những thay đổi không cần thiết bằng một lần vượt qua thứ hai.

4. Tăng đến một di chuyển thứ ba: Node 18 đến Node 22. Sử dụng lại gói hộp cát; thay đổi lớp công thức cho một codemod tùy chỉnh.

5. Đánh giá thời gian xây dựng xanh đầu tiên (TTFGB) như một métrics UX. Mục tiêu: p50 dưới 10 phút.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Deterministic substrate | "Recipe engine" | OpenRewrite / libcst: declarative AST rewrites with safety guarantees |
| Codemod | "Code-modifying program" | A rewrite rule that changes source code mechanically |
| Build drift | "Tool version skew" | Subtle Maven / Gradle / uv behavior changes between major versions |
| Failure class | "Taxonomy bucket" | A labeled reason a repo did not migrate: dep, syntax, test, build-tool, budget |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to migrated branch |
| Agent turn | "Tool-call round" | One plan -> act -> observe cycle in the agent loop |
| Budget exhaustion | "Hit the ceiling" | The repo consumed its 30-min / $8 / 20-turn limit without passing |

## Đọc thêm

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) chỉ số chuẩn của năm 2026
- [Moderne.io OpenRewrite platform](https://www.moderne.io) tham chiếu phụ thuộc xác định
- [OpenRewrite documentation](https://docs.openrewrite.org) tác giả công thức
- [Grit.io](https://www.grit.io) Mã thay thế DSL
- [OpenAI sandboxed migration cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) tài liệu tham chiếu của SDK của Agents
- [Google App Engine Py2 to Py3 migrator](https://cloud.google.com/appengine) Chỉ số chuẩn di cư thay thế
- [libcst](https://github.com/Instagram/LibCST) Python định nghĩa phụ tầng
- [Daytona sandboxes](https://daytona.io) Quả cát tham chiếu mỗi nhánh
