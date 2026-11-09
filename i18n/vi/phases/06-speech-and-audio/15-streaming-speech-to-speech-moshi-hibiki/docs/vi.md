# Streaming Speech-to-Speech  Moshi, Hibiki, và Full-Duplex Dialogue

> 2024-2026 định nghĩa lại AI giọng nói. Moshi đưa ra một mô hình duy nhất nghe và nói đồng thời với độ trễ 200 ms. Hibiki thực hiện dịch thuật từ nói đến nói từng phần. Cả hai đều từ bỏ đường ống ASR → LLM → TTS để tạo ra kiến trúc tổng hợp đầy đủ duplex trên mã codec Mimi. Đây là thiết kế tham chiếu mới.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 13 (Neural Audio Codecs), Phase 6 · 11 (Real-Time Audio), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## Vấn đề

Mỗi đại lý giọng nói được xây dựng từ Bài học 11 + 12 có một tầng độ trễ cơ bản khoảng 300-500 ms: VAD cháy, quy trình STT, LLM lý do, TTS tạo ra. Mỗi giai đoạn có độ trễ tối thiểu của riêng nó. Bạn có thể điều chỉnh và song song, nhưng hình dạng đường ống phủ bạn.

Moshi (Kyutai, 2024-2026) đặt ra một câu hỏi khác: nếu không có đường ống thì sao?

Câu trả lời là:**full-duplex speech-to-speech**. độ trễ lý thuyết 160 ms (80 ms Mimi khung hình + 80 ms chậm âm thanh). độ trễ thực tế 200 ms trên một GPU L4 duy nhất. Đó là một nửa những gì một đại lý tiếng nói ống dẫn tốt nhất trong lớp đạt được.

## Khái niệm

![Moshi architecture: two parallel Mimi streams + inner-monologue text](../assets/moshi-hibiki.svg)

### Kiến trúc Moshi

**Inputs.**Hai dòng codec Mimi, cả hai ở 12,5 Hz × 8 codebook:

- Stream 1: âm thanh người dùng (Mimi-encoded, liên tục đến)
- Stream 2: âm thanh của riêng Moshi (được tạo bởi Moshi)

**The transformer.**Một biến đổi thời gian tham số 7B xử lý cả dòng và dòng văn bản "monolog nội bộ".

1. Tiêu thụ các token Mimi mới nhất (8 codebook).
2. Tiêu thụ các mã thông báo Moshi Mimi mới nhất (8 codebook, như đã sản xuất).
3. Tạo ra mã thông báo văn bản Moshi tiếp theo (mônolog bên trong).
4. Tạo ra các mã thông báo Moshi Mimi tiếp theo (8 sổ mã thông qua một bộ biến đổi độ sâu nhỏ).

Cả ba dòng  âm thanh người dùng, âm thanh Moshi, văn bản Moshi  chạy song song. Moshi có thể nghe người dùng trong khi nói; có thể tự gián đoạn khi người dùng gián đoạn; có thể quay lại kênh ("mhm") mà không phá vỡ phát biểu chính của nó.

**The depth transformer.**Trong một khung, 8 codebook không được dự đoán song song  chúng có phụ thuộc giữa codebook. Một "hình biến chiều sâu" 2 lớp nhỏ dự đoán chúng theo trình tự trong vòng 80 ms. Đây là yếu tố tiêu chuẩn cho LMs codec AR (còn được sử dụng bởi VALL-E, VibeVoice).

### Tại sao văn bản trong một bài viết có ích

Nếu không có văn bản rõ ràng, mô hình phải mô hình hóa ngôn ngữ trong dòng âm thanh của nó. Nhìn của Moshi: buộc nó phát ra các mã thông báo văn bản cùng với âm thanh. dòng văn bản về cơ bản là bản sao chép của những gì Moshi nói. Điều này cải thiện sự liên tục ngữ nghĩa, giúp dễ dàng để thay đổi đầu mô hình ngôn ngữ, và cung cấp cho bạn bản sao miễn phí.

### Hibiki: dịch vụ phát trực tuyến từ từ từ

Thiết kế tương tự, được đào tạo trên các cặp dịch thuật. Source audio in, target language audio out, liên tục. Hibiki-Zero (Feb 2026) loại bỏ sự cần thiết cho dữ liệu đào tạo phù hợp ở mức từ ngữ  sử dụng dữ liệu ở mức câu + GRPO tăng cường học tập cho tối ưu hóa độ trễ.

Bốn cặp ngôn ngữ được hỗ trợ ban đầu; có thể được điều chỉnh cho một ngôn ngữ mới với ≈1000 giờ.

### Thống Kyutai rộng hơn (2026)

- **Moshi** Đối thoại đầy đủ (tiếng Pháp trước, tiếng Anh được hỗ trợ tốt)
- **Hibiki / Hibiki-Zero** dịch thuật ngôn ngữ đồng thời
- **Kyutai STT** streaming ASR (500 ms hoặc 2,5 s nhìn về phía trước)
- **Kyutai Pocket TTS** 100M-param TTS chạy trên CPU (Từ 2026)
- **Unmute** toàn bộ đường ống kết hợp các máy chủ công cộng

Tăng suất trên GPU L40S: 64 phiên đồng thời tại 3x thời gian thực.

### Sesame CSM  người anh em họ

Sesame CSM (2025) sử dụng một ý tưởng tương tự  một xương sống Llama-3 với đầu codec Mimi. Nhưng CSM là một hướng (giấy ngữ cảnh + văn bản, sản xuất giọng nói) thay vì đầy đủ.

### Số hiệu suất 2026

| Model | Latency | Use case | License |
|-------|---------|----------|---------|
| Moshi | 200 ms (L4) | full-duplex English / French dialogue | CC-BY 4.0 |
| Hibiki | 12.5 Hz framerate | French ↔ English streaming translation | CC-BY 4.0 |
| Hibiki-Zero | same | 5 language-pairs, no aligned data | CC-BY 4.0 |
| Sesame CSM-1B | 200 ms TTFA | context-conditioned TTS | Apache-2.0 |
| GPT-4o Realtime | ~300 ms | closed, OpenAI API | commercial |
| Gemini 2.5 Live | ~350 ms | closed, Google API | commercial |

```figure
sp-fullduplex
```

## Hãy xây dựng nó

### Bước 1: giao diện

Moshi đã phát hiện ra một máy chủ WebSocket lấy 80 ms âm thanh được mã hóa bởi Mimi và trả lại 80 ms âm thanh được mã hóa bởi Mimi.

```python
import asyncio
import websockets
from moshi.client_utils import encode_audio_mimi, decode_audio_mimi

async def moshi_chat():
    async with websockets.connect("ws://localhost:8998/api/chat") as ws:
        mic_task = asyncio.create_task(stream_mic_to(ws))
        spk_task = asyncio.create_task(stream_from_to_speaker(ws))
        await asyncio.gather(mic_task, spk_task)
```

### Bước 2: vòng lặp duplex đầy đủ

```python
async def stream_mic_to(ws):
    async for chunk_80ms in mic_stream_at_12_5_hz():
        mimi_tokens = encode_audio_mimi(chunk_80ms)
        await ws.send(serialize(mimi_tokens))

async def stream_from_to_speaker(ws):
    async for msg in ws:
        mimi_tokens, text_token = deserialize(msg)
        audio = decode_audio_mimi(mimi_tokens)
        await play(audio)
```

Cả hai hướng chạy cùng một lúc. Python asyncio hoặc Rust tương lai là phương tiện giao thông tiêu chuẩn.

### Bước 3: mục tiêu đào tạo (tầm nhìn)

Đối với mỗi khung 80 ms `t`- Có thể là:

- Nhập: `user_mimi[0..t]`- `moshi_mimi[0..t-1]`- `moshi_text[0..t-1]`
- Dự đoán: `moshi_text[t]`, sau đó `moshi_mimi[t, codebook_0..7]`

Văn bản được dự đoán trước âm thanh (mônolog bên trong); âm thanh được dự đoán theo trình tự trong bộ biến đổi độ sâu.

### Bước 4: nơi Moshi thắng và nơi không thắng

Moshi thắng:

- Sub-250 ms từ đầu đến cuối trên phần cứng rẻ tiền.
- Các kênh quay lại tự nhiên và sự gián đoạn.
- Không có mã dán ống dẫn.

Moshi không thắng:

- Công cụ gọi (không được đào tạo cho nó; bạn cần một con đường LLM riêng biệt).
- Lý luận dài (Moshi là mô hình đối thoại 8B, không phải Claude/GPT-4).
- Sự chính xác thực tế về các chủ đề niche.
- Hầu hết các trường hợp sử dụng của doanh nghiệp sản xuất (vẫn sử dụng đường ống vào năm 2026).

## Sử dụng nó

| Situation | Pick |
|-----------|------|
| Lowest-latency voice companion | Moshi |
| Live translation call | Hibiki |
| Voice demo / research | Moshi, CSM |
| Enterprise agent with tools | Pipeline (Lesson 12), not Moshi |
| Custom-voice TTS in context | Sesame CSM |
| Speech-to-speech, any languages | GPT-4o Realtime or Gemini 2.5 Live (commercial) |

## Những bẫy

- **Limited tool calling.**Moshi là một mô hình đối thoại, không phải là một cơ sở hợp tác.
- **Specific-voice conditioning.**Moshi sử dụng một cá nhân được đào tạo duy nhất; Khẩu nhân là một cuộc tập luyện riêng biệt.
- **Language coverage.**Tiếng Pháp + tiếng Anh là tuyệt vời; những người khác hạn chế. Hibiki-Zero giúp, nhưng bạn vẫn cần dữ liệu đào tạo.
- **Resource cost.**Một phiên Moshi đầy đủ chứa một khe GPU; không phải một mô hình triển khai thuê nhà chia sẻ rẻ tiền.

## Chuyển nó

Cứ như `outputs/skill-duplex-pipeline.md`Chọn đường ống so với kiến trúc duplex đầy đủ cho một khối lượng công việc đại lý giọng nói, hợp lý.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`Nó mô phỏng kiến trúc hai dòng + monologue bên trong một cách tượng trưng.
2. **Medium.**Nhổ Moshi từ HuggingFace, chạy máy chủ, thử một cuộc trò chuyện, đo độ trễ của đồng hồ tường từ cuối cuộc nói chuyện của người dùng đến bắt đầu phản ứng của Moshi.
3. **Hard.**Hãy lấy đại lý đường ống học 12 của bạn và so sánh độ trễ P50 vs Moshi trên 20 bài kiểm tra phù hợp.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Full-duplex | Hear-and-speak at once | Two audio streams active simultaneously on the same model. |
| Inner monologue | Model's text stream | Moshi emits text tokens alongside its audio output. |
| Depth transformer | Inter-codebook predictor | Small transformer that predicts 8 codebooks within one 80 ms frame. |
| Mimi | Kyutai's codec | 12.5 Hz × 8 codebooks; semantic+acoustic; powers Moshi. |
| Streaming S2S | Audio → audio live | Chunk-by-chunk translation/dialogue, no pipeline stages. |
| Back-channeling | "Mhm" reactions | Moshi can emit small acknowledgments without breaking its turn. |

## Đọc thêm

- [Défossez et al. (2024). Moshi — speech-text foundation model](https://arxiv.org/html/2410.00037v2)- Báo.
- [Kyutai Labs (2026). Hibiki-Zero](https://arxiv.org/abs/2602.12345) dịch vụ phát trực tuyến mà không có dữ liệu được sắp xếp.
- [Sesame (2025). Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) Định hướng CSM
- [Kyutai — Moshi repo](https://github.com/kyutai-labs/moshi) cài đặt + máy chủ.
- [OpenAI — Realtime API](https://platform.openai.com/docs/guides/realtime) đóng cửa thương mại đồng cấp.
- [Kyutai — Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling) khung STT/TTS dưới nắp.
