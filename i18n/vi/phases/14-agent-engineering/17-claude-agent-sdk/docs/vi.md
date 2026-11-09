# The Harness như một thư viện  Subbagents và Sessions Store

> Một vòng xoáy bạn có thể nhập khẩu: công cụ tích hợp, các bộ phận phụ cho sự cô lập ngữ cảnh, móc, phổ biến dấu vết W3C, sự bền bỉ của phiên.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 10 (Skill Libraries)
**Time:** ~75 minutes

## Mục tiêu học tập

- Giải thích sự khác biệt giữa SDK Client Anthropic (raw API) và SDK Claude Agent (phụng cáp).
- Mô tả các yếu tố phụ  song song và cách ly ngữ cảnh  và khi nào để đạt được chúng.
- Tên miền của bộ SDK Python (`append`- `load`- `list_sessions`- `delete`- `list_subkeys`) và vai trò của `--session-mirror`- Tôi không biết.
- Thực hiện một vòng xoáy stdlib với các công cụ tích hợp, sinh con con con con với bối cảnh cô lập, nát vòng đời và một cửa hàng phiên.

## Vấn đề

Một API LLM thô cung cấp cho bạn một chuyến đi trở lại. Một đại lý sản xuất cần thực thi công cụ, máy chủ MCP, móng vòng đời, sinh sản phụ, sự kiên trì phiên, phổ biến dấu vết. Claude Agent SDK gửi hình dạng này như một thư viện  cùng một vòng xoáy Claude Code sử dụng, phơi bày cho các đại lý tùy chỉnh.

## Khái niệm

### SDK khách hàng vs SDK đại lý

- **Client SDK (`anthropic`).**API tin nhắn nguyên liệu, bạn sở hữu vòng lặp, công cụ, nhà nước.
- **Agent SDK (`claude-agent-sdk`).**Thiết lập trình thực hiện công cụ, kết nối MCP, cục, sản xuất con, cửa hàng phiên bản.

### Công cụ tích hợp

SDK đưa ra 10 công cụ hơn trong hộp: file read/write, shell, grep, glob, web fetch, nhiều hơn nữa.

### Các bộ phận phụ

Hai mục đích được ghi nhận bởi Anthropic:

1. **Parallelization.**Thực hiện công việc độc lập đồng thời. "Xem hồ sơ thử nghiệm cho mỗi 20 mô-đun này" là 20 nhiệm vụ phụ song song.
2. **Context isolation.**Các subagents sử dụng cửa sổ ngữ cảnh của riêng họ; chỉ có kết quả trở lại cho nhạc sĩ. Ngân sách của nhạc sĩ được bảo tồn.

Python SDK bổ sung gần đây: `list_subagents()`- `get_subagent_messages()`để đọc bản ghi của subagent.

### Tiệm bán phiên

Phân tích giao thức với TypeScript:

- `append(session_id, message)` thêm một vòng.
- `load(session_id)` khôi phục cuộc trò chuyện.
- `list_sessions()` đếm.
- `delete(session_id)` với các buổi tiếp theo.
- `list_subkeys(session_id)` liệt kê các chìa khóa phụ.

`--session-mirror`(CLI cờ) phản chiếu bản sao đến một tệp bên ngoài khi nó phát, để debugging.

### Chân

Các cái nát chu kỳ đời bạn có thể đăng ký:

- `PreToolUse`- `PostToolUse` gọi cổng hoặc công cụ kiểm toán.
- `SessionStart`- `SessionEnd` đặt và phá hủy.
- `UserPromptSubmit` hành động trên đầu vào của người dùng trước khi mô hình nhìn thấy nó.
- `PreCompact` chạy trước khi kết hợp ngữ cảnh.
- `Stop` làm sạch tại cửa ra của đại lý.
- `Notification` cảnh báo kênh bên.

Hooks là cách pro-workflow (phase 14 curriculum reference) và các hệ thống tương tự thêm hành vi cắt ngang.

### W3C bối cảnh theo dõi

OTel hoạt động trên người gọi lan truyền vào các quá trình phụ CLI thông qua tiêu đề ngữ cảnh theo dõi W3C. Toàn bộ các quá trình theo dõi xuất hiện như một dấu vết trong phần sau của bạn.

### Claude quản lý các nhân viên

Các lựa chọn khác được lưu trữ (beta header `managed-agents-2026-04-01`). Công việc đồng bộ lâu dài, lưu trữ nhanh tích hợp, nén tích hợp.

### Khi mô hình này đi sai

- **Subagent over-spawn.**Cung cấp 100 bộ phận phụ cho 100 nhiệm vụ nhỏ, Overhead thống trị.
- **Hook creep.**Mỗi đội đều thêm các cái nát, các quả bóng thời gian khởi động, xem lại các cái nát hàng quý.
- **Session bloat.**Các buổi tập tích lũy; kích thước tăng lên. Sử dụng `list_sessions`+ Chính sách hết hạn.

```figure
ae-subagent-isolation
```

## Hãy xây dựng nó

`code/main.py`thực hiện hình dạng SDK trong stdlib:

- `Tool`- `ToolRegistry`với tích hợp `read_file`- `write_file`- `list_dir`- Tôi không biết.
- `Subagent` bối cảnh riêng tư, chạy riêng biệt, kết quả trả lại.
- `SessionStore` thêm vào, tải, liệt kê, xóa, list_subkey.
- `Hooks` `pre_tool_use`- `post_tool_use`- `session_start`- `session_end`- Tôi không biết.
- Một demo: đại lý chính sinh ra 3 bộ phụ song song (mỗi một cách riêng biệt), tổng kết quả, tiếp tục phiên.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Hướng dẫn cho thấy sự cô lập ngữ cảnh phụ (kích thước ngữ cảnh của nhạc sĩ vẫn bị giới hạn), thực thi nồi và sự bền bỉ của phiên.

## Sử dụng nó

- **Claude Agent SDK**cho các sản phẩm Claude-first muốn hình dạng vòng tay Claude Code.
- **Claude Managed Agents**cho công việc đồng bộ hoạt động lâu dài được lưu trữ.
- **OpenAI Agents SDK**(Dân học 16) đối với đối tác đầu tiên của OpenAI.
- **LangGraph + custom tools**Nếu bạn muốn máy trạng thái hình đồ thị thay vào đó.

## Chuyển nó

`outputs/skill-claude-agent-scaffold.md`Thiết lập một ứng dụng Claude Agent SDK với các bộ phận phụ, nát, cửa hàng phiên, kết nối máy chủ MCP và phát triển dấu vết W3C.

## Các bài tập

1. Thêm một bộ đẻ con phụ thuộc cho 20 nhiệm vụ thành các nhóm 5 bộ phụ song song. đo kích thước bối cảnh của dàn nhạc so sánh với một trong mỗi nhiệm vụ.
2. Thực hiện một`PreToolUse`Hook đó giới hạn lãi suất `write_file`gọi (5 phút mỗi phiên).
3. Sợi dây`list_subkeys`Làm thế nào để tạo ra một cây dưới lớp.
4. Đưa đồ chơi vào thực tế `claude-agent-sdk`Phạm vi Python. Những thay đổi gì về đăng ký công cụ?
5. Hãy đọc các tài liệu của Claude Managed Agents.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent SDK | "Claude Code as a library" | Harness shape: tools, MCP, hooks, subagents, session store |
| Subagent | "Child agent" | Separate context, own budget; results bubble up |
| Session store | "Conversation DB" | Persist, load, list, delete turns with subagent cascade |
| Hook | "Lifecycle callback" | Pre/post tool, session, prompt submit, compact, stop |
| W3C trace context | "Cross-process trace" | Parent span propagates into CLI subprocess |
| Managed Agents | "Hosted harness" | Anthropic-hosted long-running async work |
| `--session-mirror` | "Transcript mirror" | Writes session turns to an external file as they stream |
| MCP server | "Tool surface" | External tool/resource source attached to the agent |

## Đọc thêm

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) hình thức thư viện của Claude Code
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) Các mô hình sản xuất
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) thay thế được lưu trữ
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) đối tác
