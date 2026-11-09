# Capstone 16  GitHub Issue-to-PR Trưởng độc lập

> Đánh dấu một vấn đề, lấy PR  hình dạng sản phẩm 2026 cho các đại lý lập trình tự trị: chạy một đại lý trong một hộp cát đám mây, xác minh kiểm tra vượt qua, và đăng một PR sẵn sàng xem xét với lý luận. Các đại lý AWS Remote SWE, Cursor Background Agents, OpenAI Codex cloud, và Google Jules đều gửi nó. Các phần khó là tái tạo môi trường xây dựng repo tự động, ngăn chặn rò rỉ tín dụng, thực thi ngân sách mỗi repo, và đảm bảo rằng đại lý không thể ép buộc. Bạch đá này xây dựng phiên bản tự lưu trữ và so sánh nó về chi phí và tỷ lệ vượt qua với các lựa chọn thay thế được lưu trữ.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (GitHub App, agent scaffold), YAML (Actions)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## Vấn đề

Các đại lý mã hóa đám mây async là một loại sản phẩm riêng biệt từ các đại lý mã hóa tương tác (capstone 01). UX là một nhãn GitHub. Bạn dán nhãn một vấn đề `@agent fix this`Một công nhân quay lên trong một hộp cát đám mây, nhân bản repo, chạy các thử nghiệm, chỉnh sửa các tệp, xác minh và mở một PR với lý luận của đại lý trong cơ thể. Không vòng tương tác, không có thiết bị kết thúc.

Những thách thức kỹ thuật là cụ thể: tái tạo môi trường (nhà đại lý phải xây dựng repo từ đầu mà không cần một hình ảnh phát triển được lưu trữ trong cache), thử nghiệm vòm (cần phải chạy lại hoặc tách biệt), phạm vi tín dụng (một ứng dụng GitHub với các quyền tinh vi tối thiểu), thực thi ngân sách cho mỗi repo mỗi ngày và chính sách không đẩy mạnh.

## Khái niệm

Các nhà phát triển sẽ truy cập các dữ liệu của các công ty và các công ty khác. Các công ty sẽ truy cập các dữ liệu của các công ty và các công ty khác.

Việc xác minh là bước đóng cửa. CI đầy đủ phải đi qua trong hộp cát trước khi PR mở.`needs-review`- Đại lý đưa ra lý do lý luận như mô tả PR cộng với một`@agent`Thread người xem có thể ping cho các tiếp theo.

An toàn được định đo qua hai bề mặt khác nhau của GitHub: Ứng dụng cung cấp một token cài đặt ngắn hạn với `workflows: read`và nội dung repo hẹp / phạm vi PR; bảo vệ chi nhánh (không phải quyền ứng dụng) thực thi "không viết trực tiếp đến `main`" và "không ép lực"  ứng dụng không bao giờ được thêm vào danh sách bỏ qua.`.github/workflows`là một ứng dụng thực tế GitHub, vì vậy danh sách cho phép của đại lý về chỉnh sửa tệp phải thực thi điều đó tại người lao động.

## Kiến trúc

```
GitHub issue labeled `@agent fix` or PR comment
            |
            v
    GitHub App webhook -> AWS Lambda dispatcher
            |
            v
    ECS Fargate task (or GitHub Actions self-hosted runner)
       - pull repo
       - infer Dockerfile (language, package manager)
       - Daytona / E2B sandbox with target runtime
       - clone -> git worktree -> agent branch
            |
            v
    mini-swe-agent / SWE-agent v2 loop
       Claude Opus 4.7 or GPT-5.4-Codex
       tools: ripgrep, tree-sitter, read/edit, run_tests, git
            |
            v
    verify CI passes in-sandbox + coverage delta check
            |
            v (verified)
    git push + open PR via GitHub App
       PR body = rationale + diff summary + trace URL
       label: needs-review
            |
            v
    operator reviews; can @-mention agent for follow-ups
```

## Thống

- Trigger: ứng dụng GitHub với token hạt mỏng; máy nhận webhook thông qua Lambda hoặc Fly.io
- Người làm việc: ECS Fargate task (hoặc GitHub Actions self-hosted runner)
- Sandbox: Daytona devcontainer hoặc E2B sandbox cho mỗi nhiệm vụ
- Loop đại lý: mini-swe-agent cơ sở hoặc SWE-agent v2 trên Claude Opus 4.7 / GPT-5.4-Codex
- Khám truy cập: bản đồ repo-sitter cây + ripgrep
- Kiểm tra: CI đầy đủ trong hộp cát + cổng delta bảo hiểm
- Sự quan sát: Langfuse với hồ sơ dấu vết mỗi PR được liên kết từ cơ quan PR
- Ngân sách: hàng ngày hàng ngày hàng ngày hàng ngày hàng ngày hàng ngày hàng ngày hàng ngày hàng ngày hàng ngày

```figure
cf-issue-to-pr
```

## Hãy xây dựng nó

1. **GitHub App.**Các mã thông báo cài đặt tinh tế: vấn đề đọc + viết, pull_requests viết, nội dung đọc + viết, luồng công việc đọc.`main`" và "không ép buộc"; ứng dụng không nằm trong danh sách bỏ qua. Người lao động thực thi "không viết dưới `.github/workflows`" như một danh sách cho phép kiểm tra về sự khác biệt được đề xuất, vì quyền của GitHub App không được mở rộng theo đường.

2. **Webhook receiver.**Phương thức Lambda chấp nhận nhãn vấn đề / bình luận PR webhooks.`@agent fix this`- Đặt hàng cho SQS.

3. **Dispatcher.**Tạo các nhiệm vụ từ SQS. Thực hiện mỗi repo mỗi ngày ngân sách. Chuyển lên một nhiệm vụ ECS Fargate với URL repo, cơ thể phát hành, và một hộp cát Daytona tươi.

4. **Environment inference.**Khám phá ngôn ngữ (Python, Node, Go, Rust) và quản lý gói (uv, pnpm, go mod, cargo).

5. **Agent loop.**Mini-swe-agent hoặc SWE-agent v2 với Claude Opus 4.7. Công cụ: ripgrep, tree-sitter repo-map, read_file, edit_file, run_tests, git.

6. **Verification.**Sau khi vòng lặp kết thúc, chạy toàn bộ bộ bộ thử nghiệm trong hộp cát. Xét chi tiết về chi tiết qua jacoco / coverage.py. Nếu CI đỏ: dừng, không mở PR. Nếu chi tiết giảm hơn 2%: mở PR với `needs-review`nhãn.

7. **PR posting.**Nhấn chi nhánh đại lý. mở PR thông qua GitHub API với: tiêu đề, lý luận, kết luận khác nhau, truy cập URL, chi phí, lượt.

8. **Credential hygiene.**Worker chạy với một token cài đặt ứng dụng GitHub ngắn hạn.

9. **Eval.**30 vấn đề nội bộ có độ khó khác nhau. đo lường tỷ lệ vượt qua, chất lượng PR (kích thước khác nhau, phong cách, bảo hiểm), chi phí, thời gian trễ. So sánh với Cursor Background Agents và AWS Remote SWE Agents về các vấn đề tương tự.

## Sử dụng nó

```
# on github.com
  - user labels issue #842 with `@agent fix this`
  - PR #1903 appears 14 minutes later
  - body:
    > Fixed NPE in widget.dedupe() caused by null comparator entry.
    > Added regression test widget_test.go::TestDedupeNullComparator.
    > Coverage delta: +0.12%
    > Turns: 7  Cost: $1.80  Trace: langfuse:...
    > Label: needs-review
```

## Chuyển nó

`outputs/skill-issue-to-pr.md`Một công nhân đám mây GitHub App + async biến các vấn đề được dán nhãn thành PR sẵn sàng xem xét với chi phí hạn chế và xác thực phạm vi.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Pass rate on 30 issues | End-to-end success (CI green + coverage OK) |
| 20 | PR quality | Diff size, coverage delta, style conformance |
| 20 | Cost and latency per resolved issue | $ and wall-clock per PR |
| 20 | Safety | Scoped token, per-repo budget, no force-push, credential hygiene |
| 15 | Operator UX | Rationale comments, retry affordance, @-mention follow-up |
| **100** | | |

## Các bài tập

1. Thêm chế độ "đánh giá vỏ cố định": nhãn `@agent stabilize-flake TestX`chạy thử nghiệm 50 lần trong hộp cát và đề xuất một thay đổi tối thiểu để ổn định nó.

2. So sánh chi phí so với các đại lý nền tảng cursor trên ba vấn đề chung.

3. Thực hiện bảng điều khiển ngân sách: chi phí mỗi lần, chi phí mỗi người dùng.

4. Xây dựng chế độ "thay khô" mở một bản dự thảo PR mà không chạy CI, để các nhà phê bình có thể kiểm tra kế hoạch rẻ.

5. Thêm chính sách giữ lại: Các chi nhánh PR lớn hơn 7 ngày mà không hợp nhất sẽ bị xóa tự động.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GitHub App | "Scoped bot identity" | App with fine-grained permissions + short-lived installation token |
| Async cloud agent | "Background agent" | Non-interactive worker that runs in a cloud sandbox, not a terminal |
| Environment inference | "Dockerfile synthesis" | Detect language + package manager, generate a Dockerfile if absent |
| Verification | "CI-in-sandbox" | Run the full test suite inside the worker before opening a PR |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to agent branch |
| Per-repo budget | "Daily ceiling" | Dollar and PR-count cap enforced at the dispatcher |
| Rationale | "PR body explanation" | Agent's summary of what changed and why; required in the PR body |

## Đọc thêm

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) tài liệu tham chiếu của đại lý đám mây async
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) Khán giả CLI
- [Cursor Background Agents](https://docs.cursor.com/background-agent) thay thế thương mại
- [OpenAI Codex (cloud)](https://openai.com/codex) đối thủ cạnh tranh được tổ chức
- [Google Jules](https://jules.google) Phiên bản được lưu trữ của Google
- [Factory Droids](https://www.factory.ai) Khả năng tham chiếu thương mại thay thế
- [GitHub App documentation](https://docs.github.com/en/apps) danh tính bot có phạm vi
- [Daytona cloud sandboxes](https://daytona.io) hộp cát tham chiếu
