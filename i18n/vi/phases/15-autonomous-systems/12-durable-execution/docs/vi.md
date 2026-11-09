# Các nhân viên lâu dài: Cử lý lâu dài

> Các tác nhân tầm xa sản xuất không chạy vào `while True`. Mỗi cuộc gọi LLM trở thành một hoạt động với điểm kiểm tra, thử lại và chơi lại. Tích hợp SDK OpenAI Agents của Temporal đã được GA tháng 3 năm 2026. Claude Code Routines (Anthropic) chạy các cuộc gọi Claude Code được lên lịch mà không cần một quy trình địa phương liên tục. Các phiên tạm dừng vào người, tồn tại triển khai và tiếp tục từ điểm kiểm tra mới nhất được khóa bởi`thread_id`. Đằng sau công nghệ mới nằm một mô hình cũ  dàn xếp dòng công việc  với một đầu vào mới: LLM gọi là các hoạt động không xác định mà phải được tái diễn xác định khi phục hồi.

**Type:** Learn
**Languages:** Python (stdlib, minimal durable-execution state machine), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~60 minutes

## Vấn đề

Hãy xem xét một đại lý chạy trong bốn giờ. nó gọi ba công cụ, nhắc người dùng hai lần, và thực hiện bốn mươi cuộc gọi LLM.

- Trong một sự ngây thơ `while True`vòng lặp: tất cả đều bị mất. Cuộc chạy bắt đầu lại từ đầu. Ba cuộc gọi công cụ (với tác dụng phụ thực sự) thực hiện lại. Người dùng được nhắc lại về những thứ họ đã phê duyệt.
- Với việc thực hiện lâu dài: chạy tiếp tục từ điểm kiểm soát gần đây nhất. Các hoạt động đã hoàn thành không được thực hiện lại; kết quả của chúng được phát lại từ nhật ký lâu dài. Người dùng không phê duyệt lại những thứ họ đã chấp thuận. Các cuộc gọi LLM đã thực hiện không được tính lại.

Đây là mô hình tương tự mà các công cụ lưu lượng công việc đã đưa ra trong một thập kỷ (Temporal, Cadence, Cherami của Uber). Điều mới là các cuộc gọi LLM bây giờ là một loại hoạt động không xác định, đắt tiền, với tác dụng phụ và chúng phù hợp với mô hình này một cách sạch sẽ.

Chủ đề của bài học: độ tin cậy về đường chân trời dài suy giảm (METR quan sát "sự suy giảm 35 phút"  tỷ lệ thành công giảm gần như bằng hình vuông với đường chân trời).

## Khái niệm

### Các hoạt động, quy trình làm việc và chơi lại

- **Workflow**: mã dàn xếp xác định. Định nghĩa chuỗi các hoạt động, các nhánh, chờ đợi. Phải xác định để nó có thể được chơi lại từ nhật ký sự kiện mà không có sự khác biệt đáng ngạc nhiên.
- **Activity**: một đơn vị công việc không xác định, có khả năng thất bại. LLM call, tool call, file write, HTTP request.
- **Event log**: cửa hàng hỗ trợ bền vững. Mỗi hoạt động bắt đầu, hoàn thành, thất bại, thử lại, và mỗi quyết định về dòng công việc được ghi lại.
- **Replay**: khi phục hồi, mã workflow chạy lại từ đầu; mỗi hoạt động đã hoàn thành trả lại kết quả ghi lại mà không cần thực hiện lại. Chỉ có các hoạt động chưa hoàn thành thực sự được chạy.

Đây là hình dạng tương tự như React tái tạo với một DOM ảo, hoặc Git xây dựng lại một cây làm việc từ commit.

### Tại sao các cuộc gọi LLM phù hợp với mô hình

Các cuộc gọi LLM là:
- Không xác định (nhiệt độ > 0; thậm chí nhiệt độ 0 biến động giữa các phiên bản mô hình).
- Giá cả đắt (tiền và thời gian trễ).
- Khả năng thất bại (giới hạn lãi suất, thời gian trễ).
- Tác dụng phụ (nếu họ gọi các công cụ).

Đó chính xác là hồ sơ hoạt động. Kết thúc mỗi cuộc gọi LLM như một hoạt động cho bạn thử lại với sao chép sao chép, kiểm tra qua khởi động lại, và một dấu vết có thể chơi lại để gỡ lỗi.

### Các điểm kiểm soát được khóa bởi `thread_id`

LangGraph, Microsoft Agent Framework, Cloudflare Durable Objects và Claude Code Routines đều hội tụ trên cùng một hình dạng API: a `thread_id`(hoặc tương đương) xác định phiên; mỗi chuyển đổi trạng thái vẫn tồn tại cho một backend (PostgreSQL mặc định, SQLite cho dev, Redis cho cache); tiếp tục đọc điểm kiểm tra mới nhất.

Sự lựa chọn của backend quan trọng:

- **PostgreSQL**: bền, truy vấn, tồn tại khi triển khai.
- **SQLite**: chỉ là local-dev; mất dữ liệu trên các máy chủ.
- **Redis**: nhanh nhưng ngắn ngủi trừ khi có cấu hình AOF/phình ảnh.
- **Cloudflare Durable Objects**: được phân phối minh bạch; được định đoan bởi một khóa độc đáo; tồn tại trong nhiều giờ đến vài tuần.

### Sự nhập khẩu của con người như một quốc gia hạng nhất

Đề xuất sau đó cam kết (Dạy 15) đòi hỏi một trạng thái "ngợi đợi con người" lâu dài. Luôn lưu lượng công việc dừng lại, hàng đợi bên ngoài giữ yêu cầu đang chờ đợi, và sự chấp thuận bắt đầu lại từ điểm đó.

### Sự suy giảm trong 35 phút

METR quan sát thấy rằng mỗi lớp chất đo lường cho thấy sự suy giảm độ tin cậy vượt quá ~ 35 phút hoạt động liên tục. Lần làm việc gấp đôi khoảng thời gian làm việc gấp bốn lần tỷ lệ thất bại. Việc thực hiện bền không khắc phục điều này; nó cho phép bạn chạy lâu hơn hồ sơ độ tin cậy hỗ trợ. Mô hình an toàn là kết hợp độ bền với các trạm kiểm soát yêu cầu HITL tươi khi nhập lại, và với các chuyển đổi giết ngân sách (Dạy học 13) mà giới hạn tính toán tổng thể bất kể thời gian đồng hồ tường.

### Khi hành động lâu dài là câu trả lời sai

- Đi chạy ngắn hơn vài phút mà không có sự tham gia của con người.
- Khóa thông tin chỉ đọc.
- Các nhiệm vụ khi sự chính xác đòi hỏi kết thúc đến kết thúc trong một cửa sổ ngữ cảnh (một số nhiệm vụ lý luận; một số việc tạo ra một lần).

```figure
memory-consolidation
```

## Sử dụng nó

`code/main.py`thực hiện một công cụ thực hiện bền tối thiểu trong stdlib Python. Nó hỗ trợ:

- `@activity`Decorator ghi nhập và đầu ra vào nhật ký sự kiện JSON.
- Một chức năng lưu lượng công việc theo trình tự các hoạt động.
- A `run_or_replay(workflow, event_log)`chức năng tái phát các hoạt động đã hoàn thành mà không thực hiện lại chúng.

Người lái xe mô phỏng một dòng công việc ba hoạt động, bị đâm vào nửa đường, và cho thấy (a) một lần thử lại ngây thơ thực hiện lại mọi thứ so với (b) một lần lặp lại chỉ chạy hoạt động thiếu.

## Chuyển nó

`outputs/skill-durable-execution-review.md`xem xét việc triển khai đại lý lâu dài được đề xuất để xác định hình thức thực hiện lâu dài chính xác: hoạt động, quyết định, hậu quả kiểm soát, trạng thái nhập người và chính sách HITL-on-resume.

## Các bài tập

1. Đi chạy`code/main.py`- Quan sát sự khác biệt trong số lượng hoạt động-lực hiện giữa thử lại ngây thơ và tái diễn. Thay đổi điểm sụp đổ và hiển thị số lượng tái diễn thay đổi tương ứng.

2. Chuyển đổi động cơ đồ chơi để sử dụng `thread_id`Mô phỏng hai phiên đồng thời chia sẻ động cơ và xác nhận nhật ký sự kiện của họ không va chạm.

3. Hãy lấy một hoạt động trong động cơ đồ chơi. Đưa ra một sự không xác định (một dấu thời gian của đồng hồ tường bên trong quyết định luồng làm việc).`Workflow.now()`API).

4. Đọc bài đăng "Runtime Behind Production Deep Agents" của LangChain, liệt kê từng trạng thái mà runtime vẫn tồn tại và đặt tên chế độ thất bại nào được bao gồm.

5. Thiết kế một chính sách kiểm soát điểm cho một nhiệm vụ lập mã tự trị 6 giờ. Bạn kiểm soát điểm ở đâu?

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| Workflow | "Agent's script" | Deterministic orchestration code; replayable from event log |
| Activity | "A step" | Non-deterministic unit (LLM call, tool call); logged before and after |
| Event log | "The backing store" | Durable record of every state transition |
| Replay | "Resume" | Re-run workflow; completed activities return logged results without re-execution |
| Checkpoint | "Save point" | Persisted state keyed by thread_id; latest-wins on resume |
| thread_id | "Session key" | Identifier that scopes durable state |
| 35-minute degradation | "Reliability decay" | METR: success rate drops ~quadratically with horizon |
| Non-determinism | "Drift on replay" | Wall clock, random, LLM output; must be registered as side effect |

## Đọc thêm

- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) ngân sách, quay và tiếp tục ngữ nghĩa.
- [Microsoft — Agent Framework: human-in-the-loop and checkpointing](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) RequestInfoEvent hình dạng.
- [LangChain — The Runtime Behind Production Deep Agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) yêu cầu cụ thể về thời gian chạy.
- [OpenAI Agents SDK + Temporal integration (Trigger.dev announcement)](https://trigger.dev) hình thức hoạt động cho các cuộc gọi LLM.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) chỉ số phân rã 35 phút.
