# Thời gian sản xuất: Lịch trình, Sự kiện, Cron

> Các đại lý sản xuất chạy theo sáu hình dạng thời gian chạy: yêu cầu phản hồi, phát trực tuyến, thực hiện bền, nền dựa trên hàng, dựa trên sự kiện và lập lịch. Chọn hình dạng trước khi bạn chọn khung.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 22 (Voice)
**Time:** ~60 minutes

## Mục tiêu học tập

- Hãy nêu tên sáu hình dạng thời gian chạy sản xuất và phù hợp với mỗi hình thức khung / sản phẩm.
- Giải thích tại sao việc thực hiện lâu dài (LangGraph) quan trọng đối với các nhiệm vụ dài hạn.
- Mô tả thời gian chạy theo sự kiện và khi nào Claude quản lý đại lý phù hợp.
- Giải thích yêu cầu có thể quan sát được khi tải về các chất đa bước.

## Vấn đề

Các đại lý sản xuất thất bại theo cách mà một sổ ghi chép Jupyter không xuất hiện: thời gian mạng ở bước 37, người dùng treo cuộc gọi giữa giọng nói, công việc cron chết khi khởi động lại máy, nhân viên nền hết bộ nhớ.

## Khái niệm

### Đáp lại yêu cầu

- HTTP đồng bộ người dùng chờ kết thúc.
- Chỉ khả thi cho các nhiệm vụ ngắn (< 30s).
- Các đống: Agno (Python + FastAPI), Mastra (TypeScript + Express / Hono / Fastify / Koa).
- Tính năng quan sát: nhật ký truy cập HTTP tiêu chuẩn + phạm vi OTel.

### Chuyển phát

- SSE hoặc WebSocket cho phát triển tiến bộ.
- LiveKit mở rộng điều này cho WebRTC cho giọng nói / video (Dạy 22).
- Stacks: bất kỳ framework nào với hỗ trợ streaming + một frontend xử lý SSE/WS.
- Tính năng quan sát: thời gian mỗi phần, thời gian trễ đầu tiên, thời gian trễ đuôi.

### Thực hiện lâu dài

- Nhà nước kiểm soát sau mỗi bước; tự động tiếp tục khi thất bại.
- Mô hình diễn viên AutoGen v0.4 cô lập các thất bại với một đại lý (Dạy học 14).
- Các phân biệt nhân cốt lõi của LangGraph (Dạy học 13).
- Điều cần thiết khi số bước không được biết và chi phí phục hồi cao.

### Dựa trên hàng / nền

- Công việc vào hàng, nhân viên nhận, kết quả chảy về qua webhooks hoặc pub / sub.
- Khả năng thiết yếu cho các đại lý đường chân trời dài (chỉ hàng chục đến hàng trăm bước cho mỗi nhiệm vụ, cho mỗi thông báo sử dụng máy tính của Anthropic).
- Các đống: Celery (Python), BullMQ (Node), SQS + Lambda (AWS), tùy chỉnh.
- Sự quan sát: độ sâu hàng, phân phối độ trễ mỗi công việc, kích thước DLQ.

### Động cơ sự kiện

- Các đại lý đăng ký các kích hoạt: email mới, PR mở, cron fire.
- Claude quản lý đại lý bao gồm điều này ngoài hộp (Dạy học 17).
- CrewAI Flow (Dạy 15) cấu trúc các dòng công việc xác định dựa trên sự kiện.
- Hình ảnh: nguồn kích hoạt, thời gian trễ bắt đầu sự kiện, thời gian trễ của đại lý.

### Chương trình

- Các nhân viên hình Cron chạy thường xuyên.
- Kết hợp với việc thực hiện lâu dài để một cuộc chạy không thành công mỗi đêm tiếp tục lần tiếp theo.
- Stacks: Kubernetes CronJob + một framework bền; được lưu trữ (Render cron, Vercel cron).

### 2026 mô hình triển khai

- **CrewAI Flows**cho sản xuất dựa trên sự kiện.
- **Agno**FastAPI không có quốc gia cho các dịch vụ vi mô Python.
- **Mastra**Các bộ chuyển đổi máy chủ (Express, Hono, Fastify, Koa) để nhúng.
- **Pipecat Cloud / LiveKit Cloud**cho giọng nói được quản lý (Học 22).
- **Claude Managed Agents**cho sự đồng bộ hóa lâu dài được lưu trữ.

### Sự quan sát là chịu tải

Không có OpenTelemetry GenAI (Dạy 23) cộng với một Langfuse / Phoenix / Opik backend (Dạy 24) bạn không thể gỡ lỗi một đại lý đa bước đã thất bại ở bước 40.

### Khi thời gian chạy sản xuất không thành công

- **Wrong shape choice.**Chọn yêu cầu-phản ứng cho một nhiệm vụ 5 phút người dùng ngắt điện thoại, nhân viên tập hợp, thử lại hợp chất.
- **No DLQ.**Người lao động xếp hàng không có chữ cái chết.
- **Opaque background work.**Trình tác giả nền chạy mà không có dấu vết xuất khẩu.
- **Skipping durable state.**Bất kỳ chạy > 30 giây mà bạn không thể đủ khả năng khởi động lại cần thực hiện lâu dài.

```figure
wb-runtime-shapes
```

## Hãy xây dựng nó

`code/main.py`là một stdlib nhiều hình dạng demo:

- Endpoint request-response (tức là hàm đơn giản).
- Bộ xử lý dòng chảy (generator).
- Một công nhân xếp hàng với DLQ.
- Đăng ký kích hoạt sự kiện.
- - Một trình lập lịch hình Cron.

Đi đi.

```bash
python3 code/main.py
npx tsx code/main.ts
```

Kết quả: năm dấu vết cho thấy hành vi của mỗi hình dạng trên cùng một nhiệm vụ. logic đại lý tương tự, các lớp vỏ bên ngoài khác nhau.

## Sử dụng nó

- **Request-response**cho UX kiểu trò chuyện.
- **Streaming**cho các phản ứng tiến bộ.
- **Durable**cho các nhiệm vụ dài hạn.
- **Queue**cho lô / async / dài hạn.
- **Event**cho phản ứng của đại lý.
- **Cron**cho việc quản lý nhà (tăng cường bộ nhớ, đánh giá, báo cáo chi phí).

## Chuyển nó

`outputs/skill-runtime-shape.md`chọn hình dạng runtime cho một nhiệm vụ và dây các yêu cầu khả năng quan sát.

## Các bài tập

1. Chuyển tập 01 của bạn ReAct vòng lặp đến tất cả sáu hình dạng trong hàng của bạn. hình dạng nào phù hợp với bề mặt sản phẩm nào?
2. Thêm một DLQ vào trình diễn dựa trên hàng. mô phỏng thất bại 10% công việc; bề mặt DLQ kích thước.
3. Viết một đại lý đánh giá được kích hoạt cron chạy mỗi đêm với 20 dấu vết hàng đầu của ngày.
4. Thực hiện streaming với áp lực ngược: nếu khách hàng chậm, tạm dừng đại lý.
5. Khi nào bạn sẽ chuyển một nhân viên tự chủ đến quản lý?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Request-response | "Synchronous" | User waits; short tasks only |
| Streaming | "SSE / WS" | Progressive output; better UX; latency observable per chunk |
| Durable execution | "Resume from failure" | Checkpointed state; restart at last step |
| Queue-based | "Background jobs" | Producer / worker pool / DLQ |
| Event-driven | "Trigger-based" | Agent reacts to external events |
| DLQ | "Dead-letter queue" | Parking lot for failed jobs |
| Claude Managed Agents | "Hosted harness" | Anthropic-hosted long-running async with caching + compaction |

## Đọc thêm

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) chi tiết thực hiện lâu dài
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) máy tính không đồng bộ chạy lâu
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) "chỉ hàng chục đến hàng trăm bước cho mỗi nhiệm vụ"
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) Tự tách lỗi mô hình diễn viên
