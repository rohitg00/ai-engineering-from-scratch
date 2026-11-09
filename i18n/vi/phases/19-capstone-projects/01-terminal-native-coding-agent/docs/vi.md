# Capstone 01  Cơ quan mã hóa gốc của nhà ga

> Đến năm 2026, hình dạng của một đại lý mã hóa đã được giải quyết. Một vòng xoáy TUI, một kế hoạch đầy trạng thái, một bề mặt công cụ sandboxed, một vòng lặp mà kế hoạch, hành động, quan sát, phục hồi. Claude Code, Cursor 3, và OpenCode đều giống nhau từ 50 feet. Bạch đá cuối này yêu cầu bạn xây dựng một đầu để kết thúc CLI vào, kéo yêu cầu ra và đo nó so với mini-swe-agent và Live-SWE-agent trên SWE-bench Pro. Bạn sẽ học được tại sao phần khó khăn không phải là cuộc gọi mô hình mà là vòng lặp công cụ, hộp cát và mức giá trên một vòng 50 lượt.

**Type:** Capstone
**Languages:** TypeScript / Bun (harness, loop scaffold), Python (eval scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and protocols), Phase 14 (agents), Phase 15 (autonomous systems), Phase 17 (infrastructure)
**Phases exercised:**P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**Time:** 35 hours

## Vấn đề

Các đại lý mã hóa đã trở thành loại ứng dụng AI thống trị vào năm 2026. Claude Code (Anthropic), Cursor 3 với Composer 2 và Agent Tabs (Cursor), Amp (Sourcegraph), OpenCode (112k stars), Factory Droids và Google Jules tất cả các biến thể tàu cùng kiến trúc: một vòng xoáy cuối, một bề mặt công cụ được phép, một hộp cát và một vòng lặp theo dõi kế hoạch-giới thiệu được xây dựng xung quanh một mô hình biên giới. Biên giới hẹp  Live-SWE-agent đạt 79.2% trên SWE-bench Được xác minh với Opus 4.5  nhưng công nghệ craft rộng. Hầu hết các chế độ thất bại không phải là lỗi mô hình. Chúng là sự bất ổn vòng lặp công cụ, nhiễm độc ngữ cảnh, chi phí token chạy trốn và hoạt động hệ thống tập tin phá hủy.

Bạn không thể suy luận về các đại lý từ bên ngoài. bạn phải xây dựng một, xem vòng lặp rơi trên góc 47 khi ripgrep trả lại 8MB của các trận đấu, và xây dựng lại lớp cắt đứt. đó là điểm của đá cuối này.

## Khái niệm

Bộ đeo có bốn bề mặt.**Plan**duy trì một đối tượng trạng thái kiểu TodoWrite mà mô hình viết lại mỗi lượt. **Act**gửi các cuộc gọi công cụ (đọc, chỉnh sửa, chạy, tìm kiếm, git). **Observe**ghi lại mã stdout / stderr / exit, cắt ngắn, và cung cấp bản tóm tắt trở lại. **Recover**xử lý lỗi công cụ mà không làm nổ cửa sổ ngữ cảnh hoặc vòng lặp mãi mãi.**hooks**- `PreToolUse`- `PostToolUse`- `SessionStart`- `SessionEnd`- `UserPromptSubmit`- `Notification`- `Stop`, và`PreCompact` các điểm mở rộng có thể cấu hình được nơi người vận hành tiêm chính sách, đo lường từ xa và dây chèn bảo vệ.

Hộp cát là E2B hoặc Daytona. Mỗi nhiệm vụ chạy trong một container dev mới với một git worktree gắn đọc-tập. Bộ đeo không bao giờ chạm vào hệ thống tệp chủ. Cây làm việc bị xé xuống khi thành công hay thất bại. Kiểm soát chi phí được thực thi ở ba tầng: một mức giới hạn token mỗi lượt, một ngân sách đô la mỗi phiên, và một giới hạn lượt cứng (thường là 50). Lớp quan sát là OpenTelemetry trải dài với các quy ước ngữ nghĩa GenAI, được gửi đến một Langfuse tự lưu trữ.

## Kiến trúc

```
  user CLI  ->  harness (Bun + Ink TUI)
                  |
                  v
           plan / act / observe loop  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                          (via OpenRouter, model-agnostic)
                  v
           tool dispatcher (MCP StreamableHTTP client)
                  |
     +------------+------------+----------+
     v            v            v          v
  read/edit    ripgrep     tree-sitter   git/run
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           E2B / Daytona sandbox  (worktree isolated)
                  |
                  v
           hooks: Pre/Post, Session, Prompt, Compact
                  |
                  v
           OpenTelemetry -> Langfuse (spans, tokens, $)
                  |
                  v
           PR via GitHub app
```

## Thống

- Thời gian chạy của vòng xoáy: Bun 1.2 + Ink 5 (Tình phản ứng trong đầu cuối)
- Phiên bản truy cập: OpenRouter API thống nhất với Claude Sonnet 4.7, GPT-5.4-Codex, Gemini 3 Pro, Opus 4.5 (để các nhiệm vụ khó khăn nhất)
- Truyền công cụ: Mô hình giao thức ngữ cảnh StreamableHTTP (MCP 2026 sửa đổi)
- Sandbox: E2B sandbox (JS SDK) hoặc Daytona devcontainers
- Tìm kiếm mã: ripgrep subprocess, tree-sitter parsers cho 17 ngôn ngữ (đã được biên soạn)
- Tự ly: `git worktree add`cho mỗi nhiệm vụ, thanh toán về thành công / thất bại
- Eval harness: SWE-bench Pro (được xác minh) + Terminal-Bench 2.0 + 30 nhiệm vụ của riêng bạn
- Hình ảnh: OpenTelemetry SDK với `gen_ai.*`semconv → tự lưu trữ Langfuse
- Public relations posting: GitHub App với token hạt mỏng, phạm vi hạn chế cho repo mục tiêu

```figure
ce-agent-loop
```

## Hãy xây dựng nó

1. **TUI and command loop.**Đặt một dự án Bun với mực.`agent run <repo> "<task>"`. Bác bản một dạng xem chia: bảng kế hoạch (trên), dòng gọi công cụ (trên), ngân sách token (dưới). Thêm hủy trên Ctrl-C mà phát `SessionEnd`- Đánh đinh trước khi ra ngoài.

2. **Plan state.**Định nghĩa một mô hình TodoWrite được gõ (trung chờ / in_progress / các mục đã hoàn thành với ghi chú). Mô hình viết lại trạng thái đầy đủ mỗi lượt như một cuộc gọi công cụ  không để nó đột biến theo từng bước.`.agent/state.json`để các vụ tai nạn có thể tiếp tục.

3. **Tool surface.**Định nghĩa sáu công cụ: `read_file`- `edit_file`(với sự xem trước khác nhau),`ripgrep`- `tree_sitter_symbols`- `run_shell`(với thời gian nghỉ),`git`(status / diff / commit / push). Khơi bày trên MCP StreamableHTTP để các vòng xoáy là vận chuyển-agnostic. Mỗi công cụ trả lại kết quả cắt giảm (chạm hạn tại 4k token mỗi cuộc gọi).

4. **Sandbox wrapping.**Mỗi nhiệm vụ tạo ra một hộp cát E2B. `git worktree add -b agent/$TASK_ID`Tất cả các cuộc gọi công cụ được thực hiện bên trong hộp cát.

5. **Hooks.**Thực hiện tất cả tám loại móng năm 2026. Đưa ít nhất bốn móng được người dùng ủy quyền: (a) `PreToolUse`Đường bảo vệ chỉ huy phá hủy ngăn chặn`rm -rf`bên ngoài cây làm việc,`PostToolUse`kế toán biểu tượng, c) `SessionStart`khởi đầu ngân sách, d) `Stop`viết một dấu vết cuối cùng.

6. **Eval loop.**Phân phối một bộ phụ 30 số của SWE-bench Pro Python. Động kết của bạn đối với mỗi. So sánh với mini-swe-agent (số cơ bản tối thiểu) trên pass@1, quay-per-task, và $-per-task. Viết kết quả cho `eval/results.jsonl`- Tôi không biết.

7. **Cost control.**Khó hạn: 50 lượt, 200k ngữ cảnh, 5 đô la mỗi nhiệm vụ. `PreCompact`Hook tóm tắt những biến đổi cũ thành một khối trước trạng thái ở dấu 150k, tạo ra chỗ cho các quan sát mới mà không mất kế hoạch.

8. **PR posting.**Để thành công, bước cuối cùng là`git push`+ một cuộc gọi API GitHub mở một PR với kế hoạch và bản tóm tắt khác nhau trong cơ thể.

## Sử dụng nó

```
$ agent run ./my-repo "Fix the race condition in worker.rs"
[plan]  1 locate worker.rs and enumerate mutex uses
        2 identify shared state under contention
        3 propose fix, verify tests
[tool]  ripgrep mutex.*lock -t rust           (44 matches, truncated)
[tool]  read_file src/worker.rs 120..180
[tool]  edit_file src/worker.rs (+8 -3)
[tool]  run_shell cargo test worker::          (passed)
[plan]  1 done · 2 done · 3 done
[done]  PR opened: #482   turns=9   tokens=38k   cost=$0.41
```

## Chuyển nó

Kỹ năng được giao là sống trong`outputs/skill-terminal-coding-agent.md`. Với một con đường repo và mô tả nhiệm vụ, nó chạy vòng lặp toàn bộ kế hoạch-sự hành động-xem xét trong một hộp cát và trả về một URL PR cộng với một gói dấu vết. Rubric cho đá cuối này:

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 vs baseline | Your harness vs mini-swe-agent on 30 matched Python tasks |
| 20 | Architecture clarity | Plan/act/observe separation, hook surface, tool schema — reviewed against Live-SWE-agent layout |
| 20 | Safety | Sandbox escape tests, permission prompts, destructive-command guard passes red-team |
| 20 | Observability | Trace completeness (100% of tool calls spanned), token accounting per turn |
| 15 | Developer UX | Cold-start < 2s, crash recovery resumes plan, Ctrl-C cancels mid-tool cleanly |
| **100** | | |

## Các bài tập

1. Thay đổi mô hình hỗ trợ từ Claude Sonnet 4.7 thành Qwen3-Coder-30B được phục vụ trên vLLM. So sánh pass@1 và $-per-task. Báo cáo khi mô hình mở hoạt động kém.

2. Thêm một `reviewer`Sub-agent đọc sự khác biệt trước khi đăng PR và có thể yêu cầu vòng sửa đổi. đo lường xem xem xét tích cực sai có giảm tỷ lệ vượt qua của SWE-bench dưới đường cơ sở của một đại lý (khách: thường có).

3. Stress test sandbox: viết một nhiệm vụ cố gắng để `curl`một URL bên ngoài và một nhiệm vụ viết bên ngoài cây làm việc. xác nhận cả hai đều bị chặn bởi nút PreToolUse. ghi lại các nỗ lực.

4. Thực hiện`PreCompact`Kết luận với mô hình nhỏ hơn (Haiku 4.5). đo lường mức độ trung thực kế hoạch bị mất khi nén 3x.

5. Thay đổi chuyển tiếp MCP StreamableHTTP cho studio, đánh giá thời gian khởi động lạnh và thời gian trễ mỗi cuộc gọi, chọn người chiến thắng chỉ dùng địa phương.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Harness | "The agent loop" | The code surrounding the model that dispatches tools, maintains plan state, and enforces budgets |
| Hook | "Agent event listener" | A user-authored script run on one of eight lifecycle events by the harness |
| Worktree | "Git sandbox" | A linked git checkout at a separate path; disposable without touching the main clone |
| TodoWrite | "Plan state" | A typed list of pending/in-progress/done items the model rewrites each turn |
| StreamableHTTP | "MCP transport" | 2026 MCP revision: long-lived HTTP connection with bidirectional streaming; replaces SSE |
| Token ceiling | "Context budget" | Per-turn or per-session cap on input+output tokens; triggers compaction or termination |
| pass@1 | "Single-attempt pass rate" | Fraction of SWE-bench tasks solved on the first run without retry or test-set peeking |

## Đọc thêm

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) Vỏ tham chiếu từ Anthropic
- [Cursor 3 changelog](https://cursor.com/changelog) Thuốc Tabs và Composer 2 ghi chú sản phẩm
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) Tỷ lệ cơ sở tối thiểu cho so sánh sợi dây ghế SWE
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) 79,2% SWE-bench Được xác minh với Opus 4.5
- [OpenCode](https://opencode.ai) Vỏ mở, 112k ngôi sao
- [SWE-bench Pro leaderboard](https://www.swebench.com) các mục tiêu đánh giá của đáy cuối này
- [Model Context Protocol 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) StreamableHTTP, siêu dữ liệu khả năng
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) quy trình dài hạn cho các cuộc gọi công cụ và sử dụng token
