# مدل های T5، BART  کد-دکودر

> کدرها درک می کنند. کدرها تولید می کنند. آنها را دوباره به هم می اندازیم و شما یک مدل برای وظایف ورودی → خروجی ساخته می شوید: ترجمه، خلاصه، نوشتن مجدد، نقل.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## مشکل

GPT فقط برای کپیکن و BERT فقط برای کپیکن هر یک از آنها برای یک هدف مختلف از معماری 2017 را پایین می آورند. اما بسیاری از وظایف به طور طبیعی ورودی و خروجی هستند:

- ترجمه: انگلیسی → فرانسه
- خلاصه: ۵۰۰۰ توکن مقاله → ۲۰۰ توکن خلاصه
- تشخیص گفتار: توکن های صوتی → توکن های متن.
- استخراج ساختار یافته: پروسه → JSON.

برای این موارد، کدگر-دکودر مناسب ترین را می سازد. کدگر یک نمایش کثیف از منبع تولید می کند. کدگر محصول تولید می کند، در هر مرحله به این نمایشگاه مراجعه می کند. آموزش یک به یک در سمت تولید است. همان از دست دادن GPT، فقط بر روی محصول کدگر مشروط است.

دو مقاله کتاب بازی مدرن را تعریف کردند:

1. **T5**(Raffel et al. 2019). "ترانسفارمر انتقال متن به متن". هر کار NLP به عنوان متن وارد، متن خارج. معماری واحد، لغت واحد، از دست دادن واحد. آموزش پیش بینی زمان ماسک (تراکم های فاسد در ورودی، آنها را در خروجی) است.
2. **BART**(لوئیس و همکاران 2019) "ترانسفارمر دو جهت و خودکار بازپسین". انکار خودکار: ورودی فاسد به روش های متعدد (مخلوط، ماسک، حذف، چرخش) ، از دیکودر بخواهید تا اصل را بازسازی کند.

در سال 2026، فرمت کد-دکودر در جایی که ساختار ورودی مهم است، زنده می ماند:

- همس (گفتار → متن)
- دسته ترجمه گوگل
- برخی از مدل های تکمیل / تعمیر کد که دارای ساختار های زمینه و ویرایش متفاوت هستند.
- Flan-T5 و انواع آن برای وظایف استدلال ساختاری

فقط کدگر در مورد توجه ها به دست آورد اما کدگر کدگر هرگز از بین نرفت

## مفهوم

![Encoder-decoder with cross-attention](../assets/encoder-decoder.svg)

### حلقه جلو

```
source tokens ─▶ encoder ─▶ (N_src, d_model)  ──┐
                                                 │
target tokens ─▶ decoder block                   │
                 ├─▶ masked self-attention       │
                 ├─▶ cross-attention ◀───────────┘
                 └─▶ FFN
                ↓
              next-token logits
```

مهم است که کدگر یک بار در هر ورودی اجرا می شود. کدگر به صورت خودکار اجرا می شود اما در هر مرحله به * همان * محصول کدگر در نظر می گیرد. ذخیره سازی محصول کدگر سرعت آزاد برای ورودی های طولانی است.

### T5 پیش از آموزش  فساد زمان

فاصله های تصادفی ورودی را انتخاب کنید (متوسط طول 3 توکن، 15٪ کل). هر فاصله را با یک سنتینل منحصر به فرد جایگزین کنید: `<extra_id_0>`،`<extra_id_1>`، و غیره . دیکوتر فقط دامنه های فاسد را با پیشگویی نگهبان خود خارج می کند:

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

سیگنال ارزان تر از پیش بینی کل دنباله. با MLM (BERT) و پیشگویی-LM (UniLM) در ablation کاغذ T5 رقابت می کند.

### پیش از آموزش BART  رد کردن صداهای متعدد

BART پنج عملکرد صداي را امتحان مي کنه:

1. ماسک زدن توکن
2. حذف رمز ها
3. پر کردن متن (ماسک یک فاصله، decoder طول صحیح را وارد می کند).
4. تغییر جمله
5. گردش اسناد

ترکیب پر کردن متن + تغییر جمله بهترین اعداد زیر جریان را تولید کرد. دیکودر همیشه اصلی را بازسازی می کند. تولید BART مجموعه کامل است، نه فقط طول های خراب شده  بنابراین محاسبه پیش از تمرین بالاتر از T5 است.

### تعبیر

همان نسل autoregressive مانند GPT. نمونه گیری طمع / شعاع / top-p اعمال می شود. جستجوی شعاع (بایت 45) استاندارد برای ترجمه و خلاصه سازی است زیرا توزیع خروجی تنگ تر از چت است.

### چه زمانی هر نوع را در سال 2026 انتخاب کنیم

| Task | Encoder-decoder? | Why |
|------|------------------|-----|
| Translation | Yes, usually | Clear source sequence; fixed output distribution; beam search works |
| Speech-to-text | Yes (Whisper) | Input modality differs from output; encoder shapes audio features |
| Chat / reasoning | No, decoder-only | No persistent "input" — the conversation is the sequence |
| Code completion | Usually no | Decoder-only with long context wins; code models like Qwen 2.5 Coder are decoder-only |
| Summarization | Either works | BART, PEGASUS beat earlier decoder-only baselines; modern decoder-only LLMs match them |
| Structured extraction | Either | T5 is clean because "text → text" absorbs any output format |

روند از سال ۲۰۲۲: تنها کدگر وظایف کدگر-دکدر را به عهده می گیرد زیرا (ا) LLM های فقط کدگر با تنظیم دستورالعمل به هر چیزی از طریق درخواست عمومی می شوند، (ب) یک مقیاس معماری آسان تر از دو است، (ج) RLHF یک کدگر را فرض می کند. کدگر-دکدر در جایی که روش ورودی متفاوت است (گفتار، تصاویر) یا در جایی که کیفیت جستجوی شعاع مهم است، برقرار می شود.

```figure
encoder-decoder
```

## آن را بسازید

ببین`code/main.py`ما در قالب T5 برای یک کلاه بازی فساد را اجرا می کنیم که مفید ترین بخش از این درس است زیرا در هر نسخه قبل از آموزش کد-دکودر ظاهر می شود.

### مرحله ی اول: فساد زمان

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

فرمت هدف کنوانسیون T5 است: `<sent0> span0 <sent1> span1 ...`. ورودی خراب شده توکن های بدون تغییر را با توکن های سنتینل در مکان های اسپان می گذارد.

### مرحله دوم: بررسی سفر برگشت

با توجه به ورودی و هدف فاسد، جمله اصلی را بازسازی کنید. اگر فساد شما برگشت پذیر باشد، عبور پیش رو به خوبی تعریف شده است. این یک بررسی عقل است. آموزش واقعی هرگز این کار را نمی کند، اما آزمون ارزان است و یک به یک اشکال در حسابداری زمان شما را می گیرد.

### مرحله سوم: صداهای BART

پنج وظيفه:`token_mask`،`token_delete`،`text_infill`،`sentence_permute`،`document_rotate`دو تا رو ترکیب کن و نتیجه رو نشون بده

## ازش استفاده کن

"چشمک"

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

ترفند T5: نام کار به متن ورودی می رود. همان مدل ده ها کار را انجام می دهد زیرا هر کار متن وارد و خارج است. در سال 2026 این الگوی توسط مدل های فقط کدگذاری با تنظیم دستورالعمل عمومی شده است، اما T5 آن را در ابتدا رمزگذاری کرد.

## -باده

ببین`outputs/skill-seq2seq-picker.md`مهارت انتخاب بین کدگر-دکودر و کدگر-دکودر فقط برای یک کار جدید به دلیل ساختار ورودی-خروجی، تاخیر و اهداف کیفیت.

## تمرینات

1. **Easy.**فرار کن`code/main.py`، فساد زمان را به جمله 30 توکن اعمال کنید، تایید کنید که ترکیب توکن های منبع غیر سنتینل با زمان هدف رمزگذاری شده، اصل را بازتولید می کند.
2. **Medium.**برنامه های BART را اجرا کنید `text_infill`صدا: زمان های تصادفی را با یک زمان جایگزین کنید `<mask>`توکن، و دیکودر باید طول زمان درست را به همراه محتوای آن نتیجه دهد.
3. **Hard.**- خوب -`flan-t5-small`بر روی یک انگلی کوچک → سور لاتین corpus (200 جفت) اندازه گیری BLEU بر روی یک مجموعه 50 جفت نگه داشته شده. مقایسه با تنظیم دقیق`Llama-3.2-1B`در مورد داده های مشابه با همان محاسبه.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder-decoder | "Seq2seq transformer" | Two stacks: bidirectional encoder for input, causal decoder with cross-attention for output. |
| Cross-attention | "Where source talks to target" | Decoder's Q × encoder's K/V. The only place encoder information enters the decoder. |
| Span corruption | "T5's pretraining trick" | Replace random spans with sentinel tokens; decoder outputs the spans. |
| Denoising objective | "BART's game" | Apply a noise function to the input, train the decoder to reconstruct the clean sequence. |
| Sentinel token | "The `<extra_id_N>` placeholder" | Special tokens that tag corrupted spans in the source and re-tag them in the target. |
| Flan | "Instruction-tuned T5" | T5 fine-tuned on >1,800 tasks; made encoder-decoder competitive at instruction-following. |
| Beam search | "Decoding strategy" | Keep top-k partial sequences at each step; standard for translation/summarization. |
| Teacher forcing | "Training-time input" | During training, feed the true previous output token to the decoder, not the sampled one. |

## خواندن بیشتر

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683) T5
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461) بارت
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) فلان-ت5
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) "سسپر"، کدگر-دکودر 2026
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) اجرای مرجع
