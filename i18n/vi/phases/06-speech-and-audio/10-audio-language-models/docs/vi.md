# Các mô hình tiếng  Qwen2.5-Omni, Audio Flamingo, GPT-4o Audio

> Các mô hình ngôn ngữ âm thanh 2026 suy luận về ngôn ngữ + âm thanh môi trường + âm nhạc. Qwen2.5-Omni-7B phù hợp với GPT-4o Audio trên MMAU-Pro. Audio Flamingo Next đánh bại Gemini 2.5 Pro trên LongAudioBench. Khoảng cách giữa mở và đóng về cơ bản là đóng  ngoại trừ các nhiệm vụ đa âm thanh, nơi mọi người gần như ngẫu nhiên.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 12 · 03 (Vision-Language Models), Phase 7 · 10 (Audio Transformers)
**Time:** ~45 minutes

## Vấn đề

Bạn có 5 giây âm thanh: chó quát, ai đó hét "hãy dừng!", sau đó im lặng.

- **Transcription.**"Cái gì đã được nói?"  Lãnh thổ ASR.
- **Semantic reasoning.**"Người đó có nguy hiểm không?"  đòi hỏi sự hiểu biết chung về tiếng la hét + hét lên + im lặng.
- **Music reasoning.**"Những nhạc cụ nào chơi giai điệu?"
- **Long-audio retrieval.**"Trong bài giảng 90 phút này, vị giảng viên giải thích sự giảm độ ở đâu?"

Một mô hình đơn lẻ trả lời tất cả những câu hỏi này với một lời nhắc nhở là một **audio-language model**(LALM / ALM). tách biệt với ASR tinh khiết: LALM tạo ra các câu trả lời tự do bằng ngôn ngữ tự nhiên, không chỉ là bản ghi.

## Khái niệm

![Audio-language model: audio encoder + projector + LLM decoder](../assets/alm-architecture.svg)

### Mô hình ba thành phần

Mỗi LALM năm 2026 đều có cùng một bộ xương:

1. **Audio encoder.**Whisper encoder · BEATs · CLAP · WavLM · hoặc một bộ encoder tùy chỉnh cho mỗi mô hình.
2. **Projector.**Các tính năng mã âm thanh nối tuyến tính hoặc MLP vào không gian nhúng token của LLM.
3. **LLM.**Llama / Qwen / Gemma dựa trên decoder. lấy văn bản liên kết + mã thông báo âm thanh; tạo văn bản.

Việc đào tạo:

- **Stage 1.**Freeze encoder + LLM; tàu chiếu chỉ trên dữ liệu ASR / captioning.
- **Stage 2.**Định nghĩa âm thanh đầy đủ / LoRA về các nhiệm vụ âm thanh theo hướng dẫn (QA, lý luận, hiểu âm nhạc).
- **Stage 3 (optional).**Voice-in / voice-out thêm một bộ giải mã giọng nói. Qwen2.5-Omni và AF3-Chat làm điều này.

### Bản đồ mô hình 2026

| Model | Backbone | Audio encoder | Output modality | Access |
|-------|----------|---------------|-----------------|--------|
| Qwen2.5-Omni-7B | Qwen2.5-7B | Custom + Whisper | text + speech | Apache-2.0 |
| Qwen3-Omni | Qwen3 | Custom | text + speech | Apache-2.0 |
| Audio Flamingo 3 | Qwen2 | AF-CLAP | text | NVIDIA non-commercial |
| Audio Flamingo Next | Qwen2 | AF-CLAP v2 | text | NVIDIA non-commercial |
| SALMONN | Vicuna | Whisper + BEATs | text | Apache-2.0 |
| LTU / LTU-AS | Llama | CAV-MAE | text | Apache-2.0 |
| GAMA | Llama | AST + Q-Former | text | Apache-2.0 |
| Gemini 2.5 Flash/Pro (closed) | Gemini | proprietary | text + speech | API |
| GPT-4o Audio (closed) | GPT-4o | proprietary | text + speech | API |

### Kiểm tra thực tế chuẩn (2026)

**MMAU-Pro.**1800 cặp QA bao gồm giọng nói / âm thanh / âm nhạc / hỗn hợp.

| Model | Overall | Speech | Sound | Music | Multi-audio |
|-------|---------|--------|-------|-------|-------------|
| Gemini 2.5 Pro | ~60% | 73.4% | 51.9% | 64.9% | ~22% |
| Gemini 2.5 Flash | ~57% | 73.4% | 50.5% | 64.9% | 21.2% |
| GPT-4o Audio | 52.5% | — | — | — | 26.5% |
| Qwen2.5-Omni-7B | 52.2% | 57.4% | 47.6% | 61.5% | ~20% |
| Audio Flamingo 3 | ~54% | — | — | — | — |
| Audio Flamingo Next | SOTA on LongAudioBench | — | — | — | — |

- **multi-audio column is damning for everyone.**Cơ hội ngẫu nhiên trên 4 lựa chọn nhiều lựa chọn = 25%; hầu hết các mô hình ghi điểm xung quanh đó. LALM vẫn gặp khó khăn để so sánh hai clip.

### Lâu đài LALM có ích vào năm 2026

- **Compliance audit of call-center recordings.**"Đội ngũ đã đề cập đến việc tiết lộ yêu cầu không?"
- **Accessibility.**Mô tả các sự kiện âm thanh cho người dùng điếc (không chỉ là bản sao).
- **Content moderation.**Khám phá ngôn ngữ bạo lực + giọng nói đe dọa + bối cảnh nền.
- **Podcast / meeting chaptering.**Kết luận ngữ nghĩa, không chỉ là quay người nói.
- **Music catalog analysis.**"Xem tất cả các đường ray với một thay đổi khóa phần B".

### Khi chúng không (vẫn) hữu ích

- Lý thuyết âm nhạc tinh tế (dưới mức hợp âm).
- Lý luận do người nói về các cuộc trò chuyện dài (tăng độ qua 10 phút).
- So sánh đa âm thanh (22-26% chỉ là trên ngẫu nhiên).
- Nguyên lý phát trực tuyến thời gian thực (hầu hết là suy luận hàng loạt ngoại tuyến).

```figure
v4-alm-tokens
```

## Hãy xây dựng nó

### Bước 1: truy vấn Qwen2.5-Omni

```python
from transformers import AutoModelForCausalLM, AutoProcessor

processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-Omni-7B")
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-Omni-7B", torch_dtype="auto")

audio, sr = load_wav("clip.wav", sr=16000)
messages = [{
    "role": "user",
    "content": [
        {"type": "audio", "audio": audio},
        {"type": "text", "text": "What sounds do you hear, and what's happening?"},
    ],
}]
inputs = processor.apply_chat_template(messages, tokenize=True, return_tensors="pt")
output = model.generate(**inputs, max_new_tokens=200)
print(processor.decode(output[0], skip_special_tokens=True))
```

### Bước 2: mô hình máy chiếu

```python
import torch.nn as nn

class AudioProjector(nn.Module):
    def __init__(self, audio_dim=1280, llm_dim=4096):
        super().__init__()
        self.down = nn.Linear(audio_dim, llm_dim)
        self.act = nn.GELU()
        self.up = nn.Linear(llm_dim, llm_dim)

    def forward(self, audio_features):
        return self.up(self.act(self.down(audio_features)))
```

Đó là tất cả. máy chiếu thường là 1-3 lớp tuyến tính. đào tạo nó trên cặp ASR (audio → transcript) là nhiệm vụ tiền đề giai đoạn 1.

### Bước 3: đánh giá chuẩn MMAU / LongAudioBench

```python
from datasets import load_dataset
mmau = load_dataset("gamma-lab-umd/MMAU-Pro", split="test")
mcq = mmau.filter(lambda item: len(item["choices"] or []) > 1)

correct = 0
for item in mcq:
    answer = call_model(item["audio_path"], item["question"], item["choices"])
    if answer == item["answer"]:
        correct += 1
print(f"Accuracy: {correct / len(mcq):.3f}")
```

`audio_path`chỉ vào repo của bộ dữ liệu `data.zip`(khoảng 47 GB), nên tải xuống và mở zip trước khi ghi điểm. Loop phù hợp chính xác này là kiểm tra tinh thần, không phải là điểm điểm tham khảo, vì vậy số lượng của nó không thể so sánh với kết quả MMAU-Pro được công bố. Người đánh giá chính thức phù hợp với các câu trả lời nhiều lựa chọn bằng cách nhúng sự tương đồng (NV-Embed-v2), đánh giá các câu trả lời mở với một thẩm phán LLM, và kiểm tra các câu trả lời theo hướng dẫn với các quy tắc regex: viết dự đoán cho một `model_output`cột và chạy `evaluate_mmau_pro_comprehensive.py`từ [MMAU-Pro repo](https://github.com/sonalkum/MMAUPro)- Báo cáo mỗi người`category`(khót nói, âm thanh, âm nhạc, đa và những thứ khác) riêng biệt.

## Sử dụng nó

| Task | 2026 pick |
|------|-----------|
| Free-form audio QA (open) | Qwen2.5-Omni-7B |
| Best open on long audio | Audio Flamingo Next |
| Best closed | Gemini 2.5 Pro |
| Voice-in / voice-out agent | Qwen2.5-Omni or GPT-4o Audio |
| Music reasoning | Audio Flamingo 3 or 2 (music-specialized AF-CLAP) |
| Call-center audit | Gemini 2.5 Pro via API, with RAG over your policy docs |

## Những bẫy

- **Over-trust on multi-audio.**Nếu nhiệm vụ của bạn cần "clip nào có X", hiệu suất theo cấp tình cờ là thực.
- **Long-audio degradation.**10 phút sau, hầu hết các mô hình có thể không được phân tích.
- **Hallucinations on silence.**Vấn đề kiểu Whisper giống như LALM, sử dụng mã hóa Whisper.
- **Benchmark cherry-picking.**Các bài đăng trên blog của nhà cung cấp nhấn mạnh các loại trường hợp tốt nhất.

## Chuyển nó

Cứ như `outputs/skill-alm-picker.md`. Chọn LALM + phân nhóm tham chiếu + mô hình đầu ra (text vs speech) cho một nhiệm vụ hiểu âm thanh nhất định.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`để xem mô hình máy chiếu đồ chơi + đường dẫn LALM giả của (audio-embedding, text-tokens) → output tokens.
2. **Medium.**Đánh điểm Qwen2.5 Omni-7B trên 100 bài phát biểu MMAU-Pro. So sánh với số báo cáo của báo.
3. **Hard.**Xây dựng một dòng gốc ghi âm tối thiểu: BEATs encoder + máy chiếu 2 lớp + Llama-3.2-1B đóng băng. Chỉ chỉnh sửa kỹ các máy chiếu trên AudioCaps. So sánh với SALMONN trên Clotho-AQA.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LALM | Audio ChatGPT | Audio encoder + projector + LLM decoder. |
| Projector | Adapter | Small MLP mapping audio features into LLM embedding space. |
| MMAU | The benchmark | 10k audio-QA pairs across speech, sound, music. |
| MMAU-Pro | Harder MMAU | 1800 multi-audio / reasoning-heavy questions. |
| LongAudioBench | Long-form eval | Multi-minute clips with semantic queries. |
| Voice-in / voice-out | Speech-native | Model ingests speech and emits speech without text detour. |

## Đọc thêm

- [Chu et al. (2024). Qwen2-Audio](https://arxiv.org/abs/2407.10759) kiến trúc tham chiếu.
- [Alibaba (2025). Qwen2.5-Omni](https://huggingface.co/Qwen/Qwen2.5-Omni-7B) nói chuyện trong nói chuyện.
- [NVIDIA (2025). Audio Flamingo 3](https://arxiv.org/abs/2507.08128) người dẫn đầu âm thanh mở dài.
- [NVIDIA (2026). Audio Flamingo Next](https://arxiv.org/abs/2604.10905) LongAudioBench SOTA.
- [Tang et al. (2023). SALMONN](https://arxiv.org/abs/2310.13289) tiên phong trong việc mã hóa kép.
- [MMAU-Pro leaderboard](https://sonalkum.github.io/mmau-pro/) Live 2026 xếp hạng.
