# ترجمه ماشین

> ترجمه کاری است که برای تحقیقات NLP برای سی سال هزینه داشت و هنوز هم هزینه دارد.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 10 (Attention Mechanism), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## مشکل

یک مدل یک جمله را در یک زبان می خواند و یک جمله را در زبان دیگر تولید می کند. طول متفاوت است. ترتیب کلمات متفاوت است. برخی از کلمات منبع نقشه به چندین کلمه هدف و برعکس. زبان های زبان از نقشه برداری یک به یک رد می کنند. "من از شما دلم تنگ شده است" در فرانسه "tu me manques" است. به معنای واقعی کلمه "تو من از من محروم شده است". هیچ خط خط در سطح کلمه زنده نمی ماند.

ترجمه ماشین کاری کاری است که NLP را مجبور به اختراع کدرها و کدرها، توجه، ترانسفارمرها و در نهایت کل پارادایم LLM کرد. هر گام به جلو به دست آمد زیرا کیفیت ترجمه قابل اندازه گیری بود و شکاف بین انسان و ماشین سخت گیر بود.

این درس درس درس تاریخ را نادیده می گیرد و مسیر کار سال 2026 را یاد می دهد: کدگر چند زبانی پیش از آموزش (NLLB-200 یا mBART) ، نشانه گذاری زیرکلمه، جستجوی شعاع، ارزیابی BLEU و chrF و چند حالت شکست که هنوز به تولید فرستاده نشده است.

## مفهوم

![MT pipeline: tokenize → encode → decode with attention → detokenize](../assets/mt-pipeline.svg)

MT مدرن یک ترانسفورماتور کدگر-دکودر است که بر اساس متن موازی آموزش دیده است. کدگر منبع را در توکن زبان خود می خواند. کدگر هدف را، یک زیرکلمه در یک زمان، با استفاده از خروجی کدگر از طریق توجه متقابل (درسی 10) تولید می کند. کدگر از جستجوی شعاع استفاده می کند تا از دام کدگر حرص جلوگیری کند. خروجی از دست داده می شود، از دست داده می شود و در برابر مرجع امتیاز می گیرد.

سه گزینه عملیاتی کیفیت MT دنیای واقعی را تقویت می کند.

- **Tokenizer.**SentencePiece BPE بر اساس یک کورپوس زبان مخلوط آموزش دیده است. ذخایر مشترک در میان زبان ها چیزی است که باعث می شود جفت های صفر در NLLB باشد.
- **Model size.**NLLB-200 600M مستقیم در یک لپ تاپ مناسب است. NLLB-200 3.3B پیش فرض تولید منتشر شده است. 54.5B سقف تحقیقاتی است.
- **Decoding.**عرض شعاع 4-5 برای محتوای عمومی. مجازات طول برای جلوگیری از تولید خیلی کوتاه. رمزگذاری محدود زمانی که شما نیاز به مطابقت اصطلاحات.

```figure
seq2seq-alignment
```

## آن را بسازید

### مرحله اول: تماس MT پیش از آموزش

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

model_id = "facebook/nllb-200-distilled-600M"
tok = AutoTokenizer.from_pretrained(model_id, src_lang="eng_Latn")
model = AutoModelForSeq2SeqLM.from_pretrained(model_id)

src = "The cats are running."
inputs = tok(src, return_tensors="pt")

out = model.generate(
    **inputs,
    forced_bos_token_id=tok.convert_tokens_to_ids("fra_Latn"),
    num_beams=5,
    length_penalty=1.0,
    max_new_tokens=64,
)
print(tok.batch_decode(out, skip_special_tokens=True)[0])
```

```text
Les chats courent.
```

سه تا چيز اينجا مهمه`src_lang`به توکنيزر ميگه چه اسکریپت و بخش بندی را اعمال کنه. `forced_bos_token_id`هر دو ترفند های خاص NLLB هستند؛ mBART و M2M-100 از کنوانسیون های خود استفاده می کنند و قابل تعویض نیستند.

### مرحله دوم: BLEU و chrF

BLEU اندازه گیری n-gram تعادل بین خروجی و مرجع. چهار اندازه n-gram مرجع (1-4) ، متوسط هندسی از دقت، مجازات کوتاه برای خروجی بیش از حد کوتاه است. نمره در [0, 100] است. به طور معمول استفاده می شود. برای تفسیر ناامید کننده: 30 BLEU "قابل استفاده" است؛ 40 "خوب" است؛ 50 "متفاوت" است؛ تفاوت های کمتر از 1 BLEU شور است.

chrF نمره F سطح حروف را اندازه گیری می کند. حساس تر به زبان های غنی از نظر مورفولوژیک است که تعداد کم BLEU مطابقت دارد. اغلب در کنار BLEU گزارش می شود.

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

هميشه استفاده کن`sacrebleu`این توکن ها را عادی می کند تا نمرات در هر مقاله قابل مقایسه باشند.

### سلسله مراتب ارزیابی سه سطح (2026)

ارزیابی مدرن MT از سه خانواده متریک مکمل استفاده می کند. کشتی با حداقل دو.

- **Heuristic**(BLEU, chrF) سریع، مبتنی بر مرجع، تفسیر پذیر، بی حس به پارافرز استفاده برای مقایسه و تشخیص بازپسین.
- **Learned**(COMET، BLEURT، BERTScore) مدل های عصبی که بر اساس قضاوت انسانی آموزش دیده اند؛ مقایسه شباهت معنوی ترجمه با منبع و مرجع. COMET از سال 2023 بیشترین ارتباط را با تحقیقات MT دارد و در سال 2026 معیاری تولید است که در مورد کیفیت اهمیت دارد.
- **LLM-as-judge**(بدون مرجع) یک مدل بزرگ برای امتیاز ترجمه ها در زمینه روانی، مناسب، صدا، مناسبیت فرهنگی را ارائه دهید. GPT-4 به عنوان قاضی با توافق انسان در حدود 80٪ زمان زمانی که Rubric به خوبی طراحی شده است مطابقت دارد. برای محتوای باز در جایی که هیچ مرجع وجود ندارد استفاده کنید.

عملاً 2026`sacrebleu`برای BLEU و chrF، `unbabel-comet`برای COMET، و LLM برای سیگنال نهایی انسان رو به رو است. هر متریک را با 50-100 مثال برچسب انسانی قبل از اعتماد به آن بر روی داده های تولید.

متریک های بدون مرجع (COMET-QE، BLEURT-QE، LLM-as-judge) به شما اجازه می دهد ترجمه ها را بدون مرجع ارزیابی کنید، که برای زوج های زبان های طولانی که ترجمه مرجع وجود ندارد، مهم است.

### مرحله سوم: شکاف در تولید

خط لوله کار بالا به طور روان 80٪ از زمان و خاموش شکست باقی مانده 20٪ ترجمه نامگذاری شده حالت شکست:

- **Hallucination.**مدل محتوایی را که در منبع وجود ندارد اختراع می کند. در لغات دامنه ناشناخته رایج است. علائم: خروجی روان است اما ادعا می کند که منبع حقایق را اعلام نکرده است. کاهش: رمزگذاری محدود بر روی شرایط دامنه، بررسی انسانی بر روی محتوای تنظیم شده، نظارت بر خروجی بسیار طولانی تر از ورودی است.
- **Off-target generation.**مدل به زبان اشتباه ترجمه می شود. NLLB به طور شگفت انگیزی در زوج های زبان نادر به این موضوع مستعد است. کاهش: تایید`forced_bos_token_id`و همیشه با یک مدل زبان ID کید کردن در خروجی.
- **Terminology drift.**"برنامه گیری" در سند 1 و "creer un compte" در سند 2 تبدیل می شود. برای متن UI و رشته های کاربر، مطابقت مهم تر از کیفیت خام است. کاهش: رمزگذاری محدود با لغت یا لغت پس از ویرایش.
- **Formality mismatch.**در مورد "توی" در فرانسه در مقابل "vous" در ژاپن، سطح ادب. مدل هر گونه شکل را انتخاب می کند که در آموزش رایج تر بود. برای محتوای مشتری این معمولا اشتباه است. کاهش: پیشگویی فوری با یک نماد رسمی اگر مدل آن را پشتیبانی می کند، یا تنظیم یک مدل کوچک در کارپوری های رسمی فقط.
- **Length explosion on short input.**جمله های بسیار کوتاه وارد اغلب ترجمه های طولانی را ایجاد می کنند زیرا مجازات طول از یک صخره زیر 5 توکن منبع سقوط می کند. کاهش: سخت حداکثر طول بسته متناسب با طول منبع.

### مرحله 4: تنظیم دقیق برای یک دامنه

مدل های پیش از آموزش عمومی هستند. ترجمه حقوقی، پزشکی یا گفتگوی بازی از تنظیم دقیق داده های موازی دامنه به طور قابل اندازه گیری بهره مند می شود. این دستور غیر عجیب نیست:

```python
from transformers import Trainer, TrainingArguments
from datasets import Dataset

pairs = [
    {"src": "The defendant pleaded guilty.", "tgt": "L'accusé a plaidé coupable."},
]

ds = Dataset.from_list(pairs)


def preprocess(ex):
    return tok(
        ex["src"],
        text_target=ex["tgt"],
        truncation=True,
        max_length=128,
        padding="max_length",
    )


ds = ds.map(preprocess, remove_columns=["src", "tgt"])

args = TrainingArguments(output_dir="out", per_device_train_batch_size=4, num_train_epochs=3, learning_rate=3e-5)
Trainer(model=model, args=args, train_dataset=ds).train()
```

چند هزار مثال موازی با کیفیت بالا چند صد هزار مثال سر و صدا در وب است. کیفیت داده های آموزش بزرگترین تک تک لیف تولید است.

## ازش استفاده کن

دسته تولید 2026 برای MT:

| Use case | Recommended starting point |
|---------|---------------------------|
| Any-to-any, 200 languages | `facebook/nllb-200-distilled-600M` (laptop) or `nllb-200-3.3B` (production) |
| English-centric, high quality, 50 languages | `facebook/mbart-large-50-many-to-many-mmt` |
| Short runs, cheap inference, English-French/German/Spanish | Helsinki-NLP / Marian models |
| Latency-critical browser-side | ONNX-quantized Marian (~50 MB) |
| Maximum quality, willing to pay | GPT-4 / Claude / Gemini with translation prompts |

LLM ها اکنون در سال 2026 از مدل های تخصصی MT در چندین جفت زبان برتر هستند، به ویژه در محتوای ادوماتیک و زمینه طولانی. معامله هزینه و تاخیر در هر توکن است. LLM را انتخاب کنید زمانی که طول زمینه، ثبات سبک یا تطبیق دامنه از طریق ایجاد مسائل بیشتر از تولید باشد.

## -باده

پس از`outputs/skill-mt-evaluator.md`:

```markdown
---
name: mt-evaluator
description: Evaluate a machine translation output for shipping.
version: 1.0.0
phase: 5
lesson: 11
tags: [nlp, translation, evaluation]
---

Given a source text and a candidate translation, output:

1. Automatic score estimate. BLEU and chrF ranges you would expect. State whether a reference is available.
2. Five-point human-verifiable check list: (a) content preservation (no hallucinations), (b) correct language, (c) register / formality match, (d) terminology consistency with glossary if provided, (e) no truncation or length explosion.
3. One domain-specific issue to probe. E.g., for legal: named entities and statute citations. For medical: drug names and dosages. For UI: placeholder variables `{name}`.
4. Confidence flag. "Ship" / "Ship with review" / "Do not ship". Tie to the severity of issues found in step 2.

Refuse to ship a translation without a language-ID check on output. Refuse to evaluate without a reference unless the user explicitly opts in to reference-free scoring (COMET-QE, BLEURT-QE). Flag any content over 1000 tokens as likely needing chunked translation.
```

## تمرینات

1. **Easy.**ترجمه یک پاراگراف پنج جمله انگلیسی به فرانسه و دوباره به انگلیسی با استفاده از `nllb-200-distilled-600M`اندازه گیری کنید که سفر برگشت و برگشت چقدر به اصل نزدیک است. شما باید حفظ معنوی را با حرکت انتخاب کلمه ببینید.
2. **Medium.**یک چک زبان شناسه در تولیدات ترجمه را با استفاده از `fasttext lid.176`یا`langdetect`. به تماس MT ادغام شود تا نسل های خارج از هدف قبل از بازگشت به زمین گیر شوند
3. **Hard.**- خوب -`nllb-200-distilled-600M`بر روی یک کورپوس دامنه 5000 جفت انتخاب خود. BLEU را قبل و بعد از تنظیم دقیق بر روی یک مجموعه طولانی اندازه کنید. گزارش دهید که کدام نوع جمله ها بهبود یافته و کدام ها عقب مانده اند.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BLEU | Translation score | N-gram precision with brevity penalty. [0, 100]. |
| chrF | Character F-score | Character-level F-score. More sensitive for morphologically rich languages. |
| NMT | Neural MT | Transformer encoder-decoder trained on parallel text. The 2017+ default. |
| NLLB | No Language Left Behind | Meta's 200-language MT model family. |
| Constrained decoding | Controlled output | Force specific tokens or n-grams to appear / not appear in the output. |
| Hallucination | Invented content | Model output that is not supported by the source. |

## خواندن بیشتر

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672) مقاله NLLB
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/) چرا `sacrebleu`تنها راه درست برای گزارش BLEU است.
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/) کاغذ chrF
- [Hugging Face MT guide](https://huggingface.co/docs/transformers/tasks/translation) تنظیم دقیق عملی در راه رفتن
