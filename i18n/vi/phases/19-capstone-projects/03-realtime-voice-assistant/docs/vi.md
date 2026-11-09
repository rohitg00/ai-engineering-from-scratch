# Capstone 03  trợ lý giọng nói thời gian thực (ASR đến LLM đến TTS)

> Một đại lý giọng nói cảm thấy đúng có độ trễ cuối đến cuối dưới 800ms, biết khi nào bạn ngừng nói chuyện, xử lý việc cướp, và có thể gọi một công cụ mà không trì hoãn. Retell, Vapi, LiveKit Agents, và Pipecat đều đến quán bar này vào năm 2026. Chúng làm điều đó với cùng một hình dạng: một ASR phát sóng, một máy dò quay, một LLM phát sóng, và một TTS phát sóng, tất cả đều được cáp thông qua WebRTC với ngân sách độ trễ tích cực ở mỗi bước nhảy. Xây dựng một, đo WER và MOS và tỷ lệ cắt giảm sai, và chạy nó dưới mức mất gói.

**Type:** Capstone
**Languages:** Python (agent + pipeline), TypeScript (web client, scheduler scaffold)
**Prerequisites:** Phase 6 (speech and audio), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 17 (infrastructure)
**Phases exercised:**P6 · P7 · P11 · P13 · P14 · P17
**Time:** 30 hours

## Vấn đề

Voice là loại AI UX chuyển động nhanh nhất trong năm 2025-2026. Mức giới hạn kỹ thuật giảm mỗi quý. OpenAI Realtime API, Gemini 2.5 Live, Cartesia Sonic-2, ElevenLabs Flash v3, LiveKit Agents 1.0, và Pipecat 0.0.70 tất cả đều đưa âm thanh đầu tiên dưới 800ms ra trong tầm với. Chỗ thanh không phải là thời gian trễ một mình. Đó là cảm giác tương tác: không cắt người dùng, không bị cắt, phục hồi từ một sự gián đoạn giữa câu, gọi một công cụ giữa cuộc trò chuyện mà không làm trì hoãn âm thanh, sống sót mạng di động căng thẳng.

Bạn không thể đạt được điều đó bằng cách đan ba cuộc gọi REST. Kiến trúc là ống dẫn phát trực tuyến đầu đến cuối. Xây dựng nó và các chế độ thất bại trở nên hiển thị: một VAD được điều chỉnh để chụp âm thanh điện thoại trên TV nền, một máy dò lượt chờ đợi dấu chấm không bao giờ đến, một TTS mà bơm 400ms trước khi phát ra.

## Khái niệm

Đường ống có năm giai đoạn phát sóng: **audio in**(WebRTC từ trình duyệt hoặc PSTN), **ASR**(thử phát bản sao một phần từ Deepgram Nova-3 hoặc thì thầm nhanh hơn),**turn detection**(VAD cộng với mô hình máy dò quay nhỏ đọc bản ghi phân đoạn để tìm thấy dấu hiệu hoàn thành), **LLM**(thường trực tuyến token ngay khi lượt được đánh giá là hoàn thành), **TTS**(thường phát âm trong ~ 200ms của mã hiệu LLM đầu tiên).

Ba mối quan tâm liên quan.**Barge-in**: khi người dùng bắt đầu nói trong khi người đại lý đang nói, TTS hủy và ASR bắt đầu ngay lập tức. **Tool use**: cuộc gọi giữa các chức năng trò chuyện (giới hạn thời tiết, lịch) phải chạy trên một kênh bên mà không trì hoãn âm thanh; đại lý trước khi lấp đầy một token xác nhận ("một giây...") nếu độ trễ vượt quá 300ms. **Backpressure**: trong khi mất gói, các bản sao một phần được giữ, VAD tăng ngưỡng cửa nói chuyện, và đại lý tránh nói về một thông điệp không được công nhận.

Lượng đo là số lượng. WER dưới 8% trên Hamming VAD chuẩn ở 15 dB SNR. đầu tiên âm thanh ra p50 dưới 800ms trên 100 cuộc gọi đo lường. tỷ lệ cắt giảm sai dưới 3%. MOS trên 4,2 trên TTS. 50 cuộc gọi đồng thời trên một g5.xlarge. Những con số này là khả năng giao.

## Kiến trúc

```
browser / Twilio PSTN
        |
        v
   WebRTC / SIP edge
        |
        v
  LiveKit Agents 1.0  (or Pipecat 0.0.70)
        |
   +----+--------------+--------------+-----------------+
   |                   |              |                 |
   v                   v              v                 v
  ASR              VAD v5         turn-detector     side-channel
(Deepgram         (Silero)          (LiveKit)        tools
 Nova-3 /         speech-gate    completion score    (weather,
 Whisper-v3)      per 20ms        on partials        calendar)
   |                   |              |
   +--------+----------+--------------+
            v
        LLM (streaming)
     GPT-4o-realtime / Gemini 2.5 Flash /
     cascaded Claude Haiku 4.5
            |
            v
        TTS streaming
     Cartesia Sonic-2 / ElevenLabs Flash v3
            |
            v
     audio back to caller
            |
            v
   OpenTelemetry voice traces -> Langfuse
```

## Thống

- Giao thông: LiveKit Agents 1.0 (WebRTC) cộng với cổng thông tin PSTN Twilio; Pipecat 0.0.70 như là khung thay thế
- ASR: Deepgram Nova-3 (thường trực tuyến, sub-300ms lần đầu tiên một phần) hoặc nhanh hơn thì thầm Whisper-v3-turbo tự lưu trữ
- VAD: Silero VAD v5 cộng với máy phát hiện vòng LiveKit (hình biến nhỏ đọc bản sao một phần)
- LLM: OpenAI GPT-4o-time thực thời gian để tích hợp chặt chẽ, Gemini 2.5 Flash Live, hoặc Claude Haiku 4.5 (sự hoàn thành phát trực tuyến, đường âm thanh riêng biệt)
- TTS: Cartesia Sonic-2 (tối thiểu đầu tiên-byte), ElevenLabs Flash v3, hoặc nguồn mở Orpheus cho tự chủ
- Công cụ: FastMCP kênh bên cho thời tiết / lịch / đặt phòng; chất chứa trước khi phát hành nếu công cụ mất > 300ms
- Khả năng quan sát: OpenTelemetry voice spans, Langfuse voice traces với audio replay
- Việc triển khai: single g5.xlarge (24GB VRAM) cho Whisper + Orpheus tự lưu trữ; API lưu trữ cho độ trễ thấp nhất

```figure
ce-voice-latency
```

## Hãy xây dựng nó

1. **WebRTC session.**Đặt một phòng LiveKit và một máy khách web để phát âm từ micrô. Trên máy chủ, gắn một nhân viên đại lý tham gia phòng.

2. **ASR streaming.**Đưa các khung PCM 20ms vào Deepgram Nova-3 (hoặc thì thầm nhanh hơn trên GPU).

3. **VAD and turn detector.**chạy Silero VAD v5 trên dòng khung hình. Trong sự kiện kết thúc bài phát biểu, hãy kích hoạt máy dò quay LiveKit chống lại bản sao bán phần cuối cùng. Chỉ cam kết "làm hoàn thành" khi VAD nói im lặng trong 500ms và máy dò quay ghi điểm hoàn thành > 0,6.

4. **LLM stream.**Khi hoàn thành, bắt đầu cuộc gọi LLM với cuộc trò chuyện đang chạy cộng với bản ghi cuối cùng.

5. **TTS stream.**Cartesia Sonic-2 phát lại các đoạn âm thanh. Phần đầu tiên phải rời khỏi máy chủ trong vòng 200ms của mã hiệu LLM đầu tiên.

6. **Barge-in.**Khi VAD phát hiện giọng nói mới của người dùng trong khi TTS đang chơi, hủy dòng TTS ngay lập tức, thả các sản xuất LLM còn lại, và tái trang bị ASR.`tts_canceled`- Tăng.

7. **Tool side channel.**Đăng thời tiết và lịch làm công cụ gọi chức năng. Khi được gọi, hãy bật cuộc gọi đồng thời; nếu nó không giải quyết trong vòng 300ms, LLM phát "một giây, hãy để tôi kiểm tra" như một bộ sưu tập; tiếp tục khi công cụ trở lại.

8. **Eval harness.**Tải 100 cuộc gọi: tính WER (chống lại bản ghi chép bị trì hoãn), tỷ lệ cắt giảm sai (TTS bị hủy bỏ khi người dùng đang ở giữa câu), âm thanh đầu tiên ra p50, TTS MOS (mũndũ hoặc NISQA), và một bài kiểm tra mất jitter (giảm 3% gói).

9. **Load test.**Động cơ 50 cuộc gọi đồng thời trên một g5.xlarge với một người gọi tổng hợp.

## Sử dụng nó

```
caller: "what is the weather in tokyo tomorrow"
[asr  ] partial @280ms: "what is the"
[asr  ] partial @540ms: "what is the weather"
[turn ] completion score 0.82 at @820ms; commit
[llm  ] tool call emitted @880ms
[tool ] weather.tokyo tomorrow -> 68/52 partly cloudy @940ms
[llm  ] first token @990ms
[tts  ] first audio-out @1040ms: "Tokyo tomorrow will be partly cloudy..."
turn latency: 1040ms user-stop -> audio-out
```

## Chuyển nó

`outputs/skill-voice-agent.md`là sản phẩm có thể được giao. Với một miền (hỗ trợ khách hàng, lập lịch hoặc kiosk), nó đứng lên một đại lý LiveKit với đường ống ASR / VAD / LLM / TTS được điều chỉnh với thanh đo.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | End-to-end latency | p50 first-audio-out under 800ms across 100 recorded calls |
| 20 | Turn-taking quality | False-cutoff rate under 3% on the Hamming VAD benchmark |
| 20 | Tool-use correctness | Mid-conversation tool calls that return the right data without stalling audio |
| 20 | Reliability under packet loss | WER and turn-taking stability with 3% packet drop injected |
| 15 | Eval harness completeness | Reproducible measurements with public config |
| **100** | | |

## Các bài tập

1. Thay đổi Deepgram Nova-3 để nhanh hơn thì thầm v3 turbo trên một g5.xlarge. đo độ trễ và WER khoảng cách. xác định nơi mà các quyết định CPU-vs GPU quan trọng.

2. Thêm một chính sách gián đoạn-bảo luận: đại lý làm gì khi người dùng đột nhập trong một cuộc gọi công cụ? So sánh ba chính sách (hoàn bỏ cứng, kết thúc công cụ-sau đó dừng, xếp hàng lượt tiếp theo).

3. Thực hiện thử nghiệm phát hiện biến động đối kháng: cho người dùng nghỉ ngơi lâu giữa câu. Định chỉnh ngưỡng im lặng VAD và ngưỡng điểm số phát hiện biến động để giảm thiểu sự cắt giảm sai mà không thổi vượt quá 900ms.

4. Đưa ra cùng một đại lý trên PSTN thông qua Twilio. So sánh PSTN đầu tiên âm thanh ra với WebRTC. Giải thích sự khác biệt giữa jitter-buffer và codec.

5. Thêm phát hiện hoạt động giọng nói cho các ngôn ngữ không phải tiếng Anh (tiếng Nhật, tiếng Tây Ban Nha). đo tỷ lệ kích hoạt sai Silero VAD v5 so với các âm thanh tinh tế cụ thể cho ngôn ngữ.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Turn detection | "End of utterance" | Classifier that, given VAD silence and a partial transcript, decides the user is done speaking |
| Barge-in | "Interruption handling" | Canceling TTS mid-playback when VAD detects new user speech |
| First-audio-out | "Latency" | Time from user stops speaking to the first audio packet leaving the server |
| VAD | "Speech gate" | Model classifying audio frames as speech vs silence; Silero VAD v5 is the 2026 default |
| Jitter buffer | "Audio smoothing" | Client-side buffer that holds packets briefly to absorb network variance |
| Filler | "Acknowledgment token" | Short phrase the agent emits to avoid silence when a tool is slow |
| MOS | "Mean opinion score" | Perceptual speech quality rating; NISQA is the automated proxy |

## Đọc thêm

- [LiveKit Agents 1.0](https://github.com/livekit/agents) Framework đại lý WebRTC tham chiếu
- [Pipecat](https://github.com/pipecat-ai/pipecat) thay thế Python- đầu tiên phát trực tuyến cơ quan khung
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) tham chiếu cho các mô hình ngôn ngữ tích hợp
- [Deepgram Nova-3 documentation](https://developers.deepgram.com/docs) streaming ASR tham chiếu
- [Silero VAD v5](https://github.com/snakers4/silero-vad) Mô hình tham chiếu VAD
- [Cartesia Sonic-2](https://docs.cartesia.ai) Khả năng tham chiếu TTS chậm
- [Retell AI architecture](https://docs.retellai.com) kiến trúc đại lý tiếng nói sản xuất
- [Vapi.ai production stack](https://docs.vapi.ai) Khả năng sản xuất thay thế
