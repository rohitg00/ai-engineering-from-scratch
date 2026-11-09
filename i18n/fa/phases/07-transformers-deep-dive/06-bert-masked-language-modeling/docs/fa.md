# برت  مدل سازی زبان مخفي

> GPT کلمه بعدی را پیش بینی می کند. BERT یک کلمه گم شده را پیش بینی می کند. یک جمله تفاوت  و نیم دهه از همه چیز به شکل ادغام.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 5 · 02 (Text Representation)
**Time:** ~45 minutes

## مشکل

در سال 2018 هر کار NLP  احساس، NER، QA، شامل  مدل خود را از ابتدا بر روی داده های برچسب شده خود آموزش داد. هیچ نقطه بازرسی "تفاهم انگلیسی" پیش از آموزش وجود نداشت که می توانید آن را تنظیم کنید. ELMo (2018) نشان داد که می توانید گنجانده شدن های زمینه ای را با LSTM دو جهت پیش از آموزش دهید؛ این کمک کرد اما به طور کلی انجام نشد.

برت (دولین و همکاران 2018) پرسید: اگر ما یک کدگر ترانسفارمر را بگیریم، آن را در هر جمله در اینترنت آموزش دهیم و مجبور کنیم کلمات از هر دو طرف از زمینه گمشده را پیش بینی کند؟ پس شما یک سر را به کار بعدی خود تنظیم می کنید. بهره وری پارامتر یک آشکار بود.

نتیجه: در عرض 18 ماه BERT و انواع آن (RoBERTa، ALBERT، ELECTRA) بر هر لیست رتبه بندی NLP وجود داشت. تا سال 2020 هر موتور جستجو، لوله معتدل سازی محتوا و سیستم جستجو معنوی در زمین دارای BERT بود.

در سال 2026 مدل های تنها کدگذاری هنوز ابزار مناسب برای طبقه بندی، بازیافت و استخراج ساختاری هستند. آنها 510x سریعتر از رمزگذاری ها در هر توکن اجرا می شوند و گنجانده شدن آنها ستون فقرات هر استیک بازیافت مدرن است. مدرنBERT (دسامبر 2024) معماری را به 8K با فلاش توجه + RoPE + GeGLU فشار داد.

## مفهوم

![Masked language modeling: pick tokens, mask them, predict originals](../assets/bert-mlm.svg)

### سیگنال آموزش

يه جمله بگير:`the quick brown fox jumps over the lazy dog`. .

15 درصد از توکن ها رو به صورت تصادفي پوشيد:

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

مدل را آموزش دهید تا توکن های اصلی را در موقعیت های پنهان پیش بینی کند. چون کدگر دو جهت است، پیش بینی`[MASK]`در موقعیت 1 می تونم استفاده کنم`brown fox jumps`در موقعیت 2+ این چیزی است که GPT نمی تواند انجام دهد.

### قوانین ماسک BERT

از 15 درصد از توکن هایی که برای پیش بینی انتخاب شده اند:

- 80 درصد از آنها با `[MASK]`. .
- 10 درصد با یک توکن تصادفی جایگزین می شوند.
- 10 درصد بدون تغییر باقی مانده

چرا هميشه نمي شه`[MASK]`چون`[MASK]`هرگز در زمان نتیجه گیری ظاهر نمی شود.`[MASK]`در 100 درصد از موقعیت های پوشیده شده تغییر توزیع بین پیش تمرین و تنظیم دقیق ایجاد می کند. 10 درصد تصادفی + 10 درصد بدون تغییر مدل را صادق نگه می دارد.

### پیش بینی جمله بعدی (NSP)  و چرا آن را رها کرد

BERT اصلی همچنین در NSP آموزش دیده است: به دو جمله A و B داده شده است، پیش بینی کنید که اگر B به دنبال A باشد. RoBERTa (2019) آن را حذف کرده و نشان داد NSP آسیب می رساند، نه کمک می کند. کدرهای مدرن آن را رد می کنند.

### چه چیزی در سال 2026 تغییر کرد: ModernBERT

کاغذ جدیدبرت ۲۰۲۴ این بلوک را با ابتدایی های ۲۰۲۶ بازسازی کرد:

| Component | Original BERT (2018) | ModernBERT (2024) |
|-----------|----------------------|-------------------|
| Positional | Learned absolute | RoPE |
| Activation | GELU | GeGLU |
| Normalization | LayerNorm | Pre-norm RMSNorm |
| Attention | Full dense | Alternating local (128) + global |
| Context length | 512 | 8192 |
| Tokenizer | WordPiece | BPE |

و برخلاف استیک 2018، این فلاش-انتباه-منی است. انفرنس 23x سریعتر در طول دنباله 8K از DeBERTa-v3 با نمرات GLUE بهتر است.

### موارد استفاده ای که هنوز در سال 2026 کد را انتخاب می کنند

| Task | Why encoder beats decoder |
|------|---------------------------|
| Retrieval / semantic search embeddings | Bidirectional context = better embedding quality per token |
| Classification (sentiment, intent, toxicity) | One forward pass; no generation overhead |
| NER / token labeling | Per-position output, natively bidirectional |
| Zero-shot entailment (NLI) | Classifier head on top of encoder |
| Reranker for RAG | Cross-encoder scoring, 10x faster than LLM rerankers |

```figure
transformer-residual
```

## آن را بسازید

### مرحله ی اول: منطق پنهان کردن

ببین`code/main.py`. عملکرد`create_mlm_batch`یک لیست از شناسه های رمزنگاری، اندازه لغت و احتمال ماسک را می گیرد. شناسه های ورودی (با ماسک اعمال شده) و برچسب ها (فقط در موقعیت های پوشیده، -100 در جای دیگر  کنوانسیون شاخص های نادیده گرفتن PyTorch) را باز می گرداند.

```python
def create_mlm_batch(tokens, vocab_size, mask_prob=0.15, rng=None):
    input_ids = list(tokens)
    labels = [-100] * len(tokens)
    for i, t in enumerate(tokens):
        if rng.random() < mask_prob:
            labels[i] = t
            r = rng.random()
            if r < 0.8:
                input_ids[i] = MASK_ID
            elif r < 0.9:
                input_ids[i] = rng.randrange(vocab_size)
            # else: keep original
    return input_ids, labels
```

### مرحله دوم: پیش بینی MLM را روی یک کورپوس کوچک اجرا کنید

آموزش یک کدگر دو لایه + MLM سر در یک لغت از 20 کلمه، 200 جمله. هیچ گرادینت  ما انجام می دهیم پیش از گذر از بررسی های عقل. آموزش کامل نیاز به PyTorch.

### مرحله سوم: مقایسه انواع ماسک

نشان بده که چگونه قانون سه طرفه باعث می شه بدون استفاده از مدل استفاده شود`[MASK]`. پیش بینی در یک جمله ناشناخته و در یک جمله ناشناخته هر دو باید توزیع رمزنگاری منطقی تولید کند زیرا مدل هر دو الگوی را در آموزش دیده است.

### مرحله 4: سر را خوب تنظیم کنید

سر MLM را با سر طبقه بندی در مجموعه داده های احساسات اسباب بازی جایگزین کنید. فقط سر را قطار می کند؛ کدگر منجمد شده است. این الگوی هر برنامه BERT است.

## ازش استفاده کن

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**Embedding models are fine-tuned BERT.** `sentence-transformers`مدل هایی مثل`all-MiniLM-L6-v2`برت ها با ضايع كننده آموزش داده شده اند. رمزگاري همان است. ضايع عوض شده است.

**Cross-encoder rerankers are also fine-tuned BERT.**طبقه بندی جفت در `[CLS] query [SEP] doc [SEP]`توجه دو جهت بین query و doc دقیقاً چیزی است که به کراس کوڈر ها برتری کیفیت نسبت به کراس کوڈر ها می دهد.

**When not to pick BERT in 2026.**هر چیزی که تولید کننده باشد. کدگر هیچ راهی منطقی برای تولید خودکشی نمایان ندارد. همچنین: هر چیزی که تحت پارام 1B باشد که یک کدگر کوچک بتواند با انعطاف پذیری بیشتری با کیفیت مطابقت داشته باشد (Phi-3-Mini, Qwen2-1.5B).

## -باده

ببین`outputs/skill-bert-finetuner.md`. مهارت ها یک تنظیم دقیق BERT (انتخاب ستون فقرات، مشخصات سر، داده ها، ارزیابی، توقف) را برای یک کار طبقه بندی یا استخراج جدید انجام می دهند.

## تمرینات

1. **Easy.**فرار کن`code/main.py`و توزیع ماسک را در سراسر 10،000 توکن چاپ کنید. تایید ~15٪ انتخاب می شوند و از آن ~80٪ تبدیل می شوند`[MASK]`. .
2. **Medium.**استفاده از ماسک کردن کل کلمه: اگر یک کلمه به زیرکلمه ها نشان داده شود، همه زیرکلمه ها را با هم یا هیچ یک از آنها را پنهان کنید. اندازه گیری کنید که آیا این باعث بهبود دقت MLM در یک کورپوس 500 جمله می شود.
3. **Hard.**آموزش یک BERT کوچک (2 لایه، d=64) بر اساس 10،000 جمله از یک مجموعه داده عمومی.`[CLS]`با يک خط پايين فقط در پارام هاي مشابه

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MLM | "Masked language modeling" | Training signal: randomly replace 15% of tokens with `[MASK]`, predict the originals. |
| Bidirectional | "Looks both ways" | Encoder attention has no causal mask — every position sees every other position. |
| `[CLS]` | "The pooler token" | A special token prepended to every sequence; its final embedding is used as the sentence-level representation. |
| `[SEP]` | "Segment separator" | Separates paired sequences (e.g. query/doc, sentence A/B). |
| NSP | "Next sentence prediction" | BERT's second pretraining task; shown to be useless in RoBERTa, dropped after 2019. |
| Fine-tuning | "Adapt to a task" | Keep the encoder mostly frozen; train a small head on top for the downstream task. |
| Cross-encoder | "A reranker" | A BERT that takes both query and doc as input, outputs a relevance score. |
| ModernBERT | "2024 refresh" | Encoder rebuilt with RoPE, RMSNorm, GeGLU, alternating local/global attention, 8K context. |

## خواندن بیشتر

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805)کاغذ اصلی
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692) چطور برت را درست آموزش دهیم؛ این NSP را می کشد.
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) تشخیص رمز جایگزین MLM در محاسبه مطابقت دارد.
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663) کاغذ مدرنBERT
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) مرجع کدگذاری کانونیک
