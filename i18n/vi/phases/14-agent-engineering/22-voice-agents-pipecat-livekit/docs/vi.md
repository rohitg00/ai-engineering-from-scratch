# Các đại lý giọng nói: Pipecat và LiveKit

> Các đại lý thoại là một loại sản xuất hạng nhất vào năm 2026. Pipecat cung cấp cho bạn một đường ống dựa trên khung Python (VAD → STT → LLM → TTS → vận chuyển). LiveKit Agents nối các mô hình AI với người dùng qua WebRTC. Mục tiêu độ trễ sản xuất hạ cánh ở 450600ms từ đầu đến cuối cho các đống cao cấp.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~60 minutes

## Mục tiêu học tập

- Mô tả đường ống dựa trên khung của Pipecat: DOWNSTREAM (nguồn→sink) và UPSTREAM (các bộ điều khiển).
- Tên gọi các giai đoạn đường ống âm thanh truyền thống và vận chuyển hỗ trợ của Pipecat.
- Giải thích hai lớp đại lý giọng nói của LiveKit Agents (MultimodalAgent, VoicePipelineAgent) và khi nào mỗi lớp phù hợp.
- Tóm lại kỳ vọng độ trễ sản xuất năm 2026 và cách chúng thúc đẩy các lựa chọn kiến trúc.

## Vấn đề

Các đại lý thoại không phải là một vòng lặp văn bản với TTS được gắn. Ngân sách độ trễ là tàn bạo (~ 600ms), âm thanh một phần là mặc định, phát hiện lượt là một mô hình, và vận chuyển từ điện thoại SIP đến WebRTC.

## Khái niệm

### Chiếc pipecat (pipecat-ai/pipecat)

- Phụ trình đường ống dựa trên khung Python.
- `Frame`→ `FrameProcessor`- Sợi dây.
- Hai hướng chảy:
  - **DOWNSTREAM** nguồn → bồn rửa (audio in, TTS out).
  - **UPSTREAM** phản hồi và kiểm soát (bấm, số liệu, barge-in).
- `PipelineTask`quản lý chu kỳ đời sống với các sự kiện (`on_pipeline_started`- `on_pipeline_finished`- `on_idle_timeout`) và các nhà quan sát cho các métrics/tracing/RTVI.

Đường ống thông điển hình:

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

Giao thông: Daily, LiveKit, SmallWebRTCTransport, FastAPI WebSocket, WhatsApp.

Pipecat Flows thêm các cuộc trò chuyện có cấu trúc (cỗ máy trạng thái). Pipecat Cloud là thời gian chạy được quản lý.

### LiveKit Agents (livekit/agents)

- Đường nối các mô hình AI với người dùng qua WebRTC.
- Các khái niệm chính: `Agent`- `AgentSession`- `entrypoint`- `AgentServer`- Tôi không biết.
- Hai lớp học đại lý giọng nói:
  - **MultimodalAgent** âm thanh trực tiếp thông qua OpenAI Realtime hoặc tương đương.
  - **VoicePipelineAgent** STT → LLM → TTS; cung cấp kiểm soát ở cấp độ văn bản.
- Khám phá biến đổi ngữ nghĩa thông qua mô hình biến đổi.
- Sự tích hợp MCP bản địa.
- Điện thoại qua SIP.
- 50+ mô hình không có khóa API thông qua LiveKit Inference; 200+ hơn thông qua plugin.

### Các nền tảng thương mại

Vapi (~ 450600ms trên một gói Premium tối ưu hóa) và Retell (~ 600ms kết thúc đến kết thúc trên 180 cuộc gọi thử nghiệm) xây dựng trên đầu này. Chọn một nền tảng khi bạn muốn một gói giọng nói được quản lý mà không cần một nhóm WebRTC.

### Khi mô hình này đi sai

- **No barge-in handling.**Người dùng ngắt lời; đại lý tiếp tục nói chuyện. yêu cầu UPSTREAM hủy khung hình trong Pipecat, tương đương trong LiveKit.
- **STT confidence ignored.**Các bản ghi tự tin thấp được đưa đến LLM như là tin mừng.
- **TTS mid-sentence cutoff.**Khi đường ống hủy bỏ giữa phát âm, TTS cần biết hoặc cắt âm thanh.
- **Latency budget ignored.**Mỗi thành phần thêm 50200ms. Tổng chuỗi của bạn trước khi vận chuyển.

### Típ trễ 2026

- VAD: 2060ms
- STT một phần: 100250ms
- LLM đầu tiên: 150400ms
- TTS âm thanh đầu tiên: 100200ms
- RTT vận chuyển: 3080ms

End-to-end 450600ms là cao cấp. 8001200ms là phổ biến. Bất cứ điều gì > 1500ms cảm thấy bị phá vỡ.

```figure
voice-pipeline
```

## Hãy xây dựng nó

`code/main.py`là một đường ống đồ chơi dựa trên khung với:

- `Frame`các loại (audio, bản sao, văn bản, tts_audio, điều khiển).
- `Processor`giao diện với `process(frame)`- Tôi không biết.
- Một đường ống năm giai đoạn (VAD → STT → LLM → TTS → vận chuyển) như bộ xử lý kịch bản.
- Một khung hủy UPSTREAM để chứng minh sự đột nhập.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Hình ảnh cho thấy dòng chảy bình thường và một sự hủy bỏ của tàu bay đã ngăn chặn TTS giữa phát âm.

## Sử dụng nó

- **Pipecat**cho sự kiểm soát đầy đủ  bộ xử lý tùy chỉnh, Python-first, các nhà cung cấp pluggable.
- **LiveKit Agents**cho việc triển khai WebRTC đầu tiên và điện thoại.
- **Vapi / Retell**cho các đại lý giọng nói không có đội WebRTC.
- **OpenAI Realtime / Gemini Live**cho âm thanh trực tiếp vào/ ra khỏi (MultimodalAgent).

## Chuyển nó

`outputs/skill-voice-pipeline.md`Đàn phẳng một đường ống giọng hình Pipecat với VAD + STT + LLM + TTS + vận chuyển cộng với xử lý tàu thuyền.

## Các bài tập

1. Thêm một người quan sát số liệu vào đường ống đồ chơi của bạn: đếm khung mỗi giai đoạn mỗi giây.
2. Thực hiện STT có cửa độ tin cậy: dưới ngưỡng, yêu cầu "bạn có thể lặp lại điều đó không?"
3. Thêm nhận lượt ngữ nghĩa: quy tắc đơn giản  nếu bản sao kết thúc bằng "?", cuối lượt.
4. Đọc các tài liệu vận chuyển của Pipecat. Thay đổi STDlib vận chuyển cho cấu hình SmallWebRTCTransport (stub).
5. Đo một chuỗi OpenAI thời gian thực so với STT + LLM + TTS trên cùng một truy vấn. Chi phí trễ nào được kiểm soát ở cấp độ văn bản mang lại?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Frame | "Event" | Typed unit of data in the pipeline (audio, transcript, text, control) |
| Processor | "Pipeline stage" | Handler with process(frame) |
| DOWNSTREAM | "Forward flow" | Source to sink: audio in, speech out |
| UPSTREAM | "Feedback flow" | Control: cancel, metrics, barge-in |
| VAD | "Voice activity detection" | Detects when user is speaking |
| Semantic turn detection | "Smart end-of-turn" | Model-based decision that the user is done |
| MultimodalAgent | "Direct audio agent" | Audio in, audio out; no text in the middle |
| VoicePipelineAgent | "Cascade agent" | STT + LLM + TTS; text-level control |

## Đọc thêm

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction) đường ống dựa trên khung, bộ xử lý, vận chuyển
- [LiveKit Agents docs](https://docs.livekit.io/agents/) WebRTC + âm thanh nguyên thủy
- [Vapi](https://vapi.ai/) nền tảng thoại được quản lý
- [Retell AI](https://www.retellai.com/) quản lý giọng nói, trễ-chỉ số
