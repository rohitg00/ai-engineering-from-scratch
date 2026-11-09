# مدل های زبان صوتی  Qwen2.5-Omni, صوتی فلامینگو, GPT-4o صوتی

> مدل های 2026 زبان صوتی استدلال بر روی صحبت + صدا محیط زیست + موسیقی. Qwen2.5-Omni-7B با GPT-4o Audio در MMAU-Pro مطابقت دارد. آڈیو فلامینگو بعدی از Gemini 2.5 Pro در LongAudioBench غلبه می کند. شکاف بین باز و بسته اساسا بسته است  به جز در وظایف چند صوتی، جایی که همه تقریبا تصادفی هستند.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 12 · 03 (Vision-Language Models), Phase 7 · 10 (Audio Transformers)
**Time:** ~45 minutes

## مشکل

شما 5 ثانیه از صدا دارید: سگ گندید، کسی فریاد می زند "بگذار!"، سپس سکوت. سوالات مفید در چندین محور قرار دارند:

- **Transcription.**"چي گفته شد؟"  اراضي ASR
- **Semantic reasoning.**"آیا فرد در خطر است؟"  نیاز به درک مشترک از گریه + فریاد + سکوت دارد.
- **Music reasoning.**"چيه سازي ها آهنگ رو باز مي کنن؟"
- **Long-audio retrieval.**"در اين سخنرانی 90 دقيقه، آموزگار کجا به نزول گرادينت توضیح داد؟"

یک مدل که به همه این سوالات با یک پیام پاسخ می دهد یک **audio-language model**(LALM / ALM). از ASR خالص جدا: LALM ها پاسخ های آزاد زبان طبیعی را تولید می کنند، نه فقط نقل.

## مفهوم

![Audio-language model: audio encoder + projector + LLM decoder](../assets/alm-architecture.svg)

### قالب سه عنصر

هر سال 2026 LALM هم يه اسکلت داره

1. **Audio encoder.**کدگر Whisper · BEATs · CLAP · WavLM · یا کدگر سفارشی برای هر مدل.
2. **Projector.**ویژگی های کدرس صدا خطی یا MLP در فضای گنجانشی توکن LLM.
3. **LLM.**کدگر مبتنی بر Llama / Qwen / Gemma. متن متقابل + توکن های صوتی را می گیرد؛ متن تولید می کند.

آموزش:

- **Stage 1.**کدگر منجمد + LLM؛ پروژکتور قطار فقط بر اساس داده های ASR / عنوان.
- **Stage 2.**تنظیم دقیق کامل / LoRA در وظایف صوتی که از دستورالعمل پیروی می کنند (QA، استدلال، درک موسیقی).
- **Stage 3 (optional).**صدا در / صدا خارج اضافه می کند یک دیکوتر صحبت. Qwen2.5 Omni و AF3 چت انجام این کار را.

### نقشه مدل 2026

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

### بررسی واقعیت بنچ مارک (2026)

**MMAU-Pro.**1800 جفت QA پوشش دهنده صحبت / صدا / موسیقی / مخلوط. زیر مجموعه های چند آڈیو شامل شده است.

| Model | Overall | Speech | Sound | Music | Multi-audio |
|-------|---------|--------|-------|-------|-------------|
| Gemini 2.5 Pro | ~60% | 73.4% | 51.9% | 64.9% | ~22% |
| Gemini 2.5 Flash | ~57% | 73.4% | 50.5% | 64.9% | 21.2% |
| GPT-4o Audio | 52.5% | — | — | — | 26.5% |
| Qwen2.5-Omni-7B | 52.2% | 57.4% | 47.6% | 61.5% | ~20% |
| Audio Flamingo 3 | ~54% | — | — | — | — |
| Audio Flamingo Next | SOTA on LongAudioBench | — | — | — | — |

.**multi-audio column is damning for everyone.**شانس تصادفی در انتخاب چند گزینه 4 = 25٪؛ اکثر مدل ها در اطراف آن امتیاز می دهند. LALM ها هنوز برای مقایسه دو کلیپ تلاش می کنند.

### جایی که LALM ها در سال 2026 مفید هستند

- **Compliance audit of call-center recordings.**"آژانت از افشايش مورد نياز يادش مياد؟"
- **Accessibility.**رویدادهای صوتی را برای کاربران کران توصیف کنید (نه فقط نقل).
- **Content moderation.**زبان خشونت آمیز + صدا تهدید کننده + زمینه پس زمینه را تشخیص دهید.
- **Podcast / meeting chaptering.**خلاصه معنوی، نه فقط چرخش سخنران.
- **Music catalog analysis.**"همه آهنگ ها رو با تغيير کلید بخش ب پيدا کن"

### جایی که (اکنون) مفید نیستند

- تئوری موسیقی با غلات خوب (از سطح آکورد پایین)
- استدلال توسط سخنران در طول مکالمه طولانی (در طول 10 دقیقه)
- مقایسه با صداهای متعدد (22-26٪ به سختی بالاتر از تصادفی است).
- استدلال جریان در زمان واقعی (زیاترین آن ها نتیجه گیری دسته های آفلاین هستند).

```figure
v4-alm-tokens
```

## آن را بسازید

### مرحله اول: سوال Qwen2.5-Omni

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

### مرحله دوم: الگوی پروژکتور

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

این است. پروژکتور معمولاً 1-3 لایه خطی است. آموزش آن در زوج های ASR (آدیو → ترانسکریپ) وظیفه بهانه مرحله 1 است.

### مرحله سوم: مقایسه MMAU / LongAudioBench

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

`audio_path`اشاره به repo های مجموعه داده ها`data.zip`(حدود 47 گيبايت) ، پس قبل از اينکه نمره بزني، دانلود و بازش کن این حلقه مطابقت دقیق یک بررسی عقل است، نه امتیاز دهنده معیار، بنابراین تعداد آن قابل مقایسه با نتایج منتشر شده MMAU-Pro نیست. ارزیابی کننده رسمی پاسخ های چند گزینه را با استفاده از شباهت (NV-Embed-v2) مطابقت می دهد، پاسخ های باز را با یک قاضی LLM ارزیابی می کند و پاسخ های بعد از دستورالعمل را با قوانین regex بررسی می کند: پیش بینی ها را به یک`model_output`ستون و اجرا`evaluate_mmau_pro_comprehensive.py`از[MMAU-Pro repo](https://github.com/sonalkum/MMAUPro). هرکدومشون گزارش بده`category`(خطاب، صدا، موسیقی، چند و بقیه) به طور جداگانه. اعداد جمع شده جایی که مدل شکست می خورد پنهان می شوند.

## ازش استفاده کن

| Task | 2026 pick |
|------|-----------|
| Free-form audio QA (open) | Qwen2.5-Omni-7B |
| Best open on long audio | Audio Flamingo Next |
| Best closed | Gemini 2.5 Pro |
| Voice-in / voice-out agent | Qwen2.5-Omni or GPT-4o Audio |
| Music reasoning | Audio Flamingo 3 or 2 (music-specialized AF-CLAP) |
| Call-center audit | Gemini 2.5 Pro via API, with RAG over your policy docs |

## دام ها

- **Over-trust on multi-audio.**اگر وظیفه شما نیاز به "که کلیپ X دارد" دارد، عملکرد تصادفی در سطح شانس واقعی است.
- **Long-audio degradation.**بعد از 10 دقیقه، اکثر مدل ها نسبت به سخنرانان را از بین می برند. اول (درس 6) ، سپس خلاصه کنید.
- **Hallucinations on silence.**همون مشکل سبک "ویسپر" که توسط لالم ها که از کدگر "ویسپر" استفاده می کنند به ارث برده شده
- **Benchmark cherry-picking.**پست های وبلاگ فروشنده به عنوان بهترین موارد دسته بندی شده است. MMAU-Pro زیر مجموعه های چند صدا را خودتان اجرا کنید.

## -باده

پس از`outputs/skill-alm-picker.md`. برای یک کار درک صوتی مشخص، LALM + زیر مجموعه مرجع + حالت خروجی (متن در مقابل صحبت) را انتخاب کنید.

## تمرینات

1. **Easy.**فرار کن`code/main.py`برای دیدن یک الگوی پروژکتور اسباب بازی + مسیر LALM جعلی از (آدیو-درست، توکن های متن) → توکن های خروجی.
2. **Medium.**در 100 مورد حرف MMAU-Pro، Qwen2.5 Omni-7B را بررسي کن، با تعداد گزارش شده در روزنامه مقایسه کن.
3. **Hard.**یک خط پایه آڈیو کیپشن سازی کمترین را بسازید: کدگر BEATs + پروژکتور دو لایه + Llama-3.2-1B منجمد. فقط پروژکتور را در AudioCaps تنظیم کنید. با SALMONN در Clotho-AQA مقایسه کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LALM | Audio ChatGPT | Audio encoder + projector + LLM decoder. |
| Projector | Adapter | Small MLP mapping audio features into LLM embedding space. |
| MMAU | The benchmark | 10k audio-QA pairs across speech, sound, music. |
| MMAU-Pro | Harder MMAU | 1800 multi-audio / reasoning-heavy questions. |
| LongAudioBench | Long-form eval | Multi-minute clips with semantic queries. |
| Voice-in / voice-out | Speech-native | Model ingests speech and emits speech without text detour. |

## خواندن بیشتر

- [Chu et al. (2024). Qwen2-Audio](https://arxiv.org/abs/2407.10759) معماری مرجع
- [Alibaba (2025). Qwen2.5-Omni](https://huggingface.co/Qwen/Qwen2.5-Omni-7B) گفتار در گفتار خارج
- [NVIDIA (2025). Audio Flamingo 3](https://arxiv.org/abs/2507.08128) رهبر بلند صدا باز
- [NVIDIA (2026). Audio Flamingo Next](https://arxiv.org/abs/2604.10905) LongAudioBench SOTA
- [Tang et al. (2023). SALMONN](https://arxiv.org/abs/2310.13289) پیشگام دو کدگذاری
- [MMAU-Pro leaderboard](https://sonalkum.github.io/mmau-pro/) رتبه بندی زنده 2026
