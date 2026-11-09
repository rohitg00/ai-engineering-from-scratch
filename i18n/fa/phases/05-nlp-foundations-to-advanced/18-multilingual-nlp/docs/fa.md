# NLP چند زبانی

> یک مدل، 100+ زبان، صفر داده های آموزشی برای اکثر آنها. انتقال بین زبانی معجزه عملی دهه 2020 است.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 04 (GloVe, FastText, Subword), Phase 5 · 11 (Machine Translation)
**Time:** ~45 minutes

## مشکل

انگلیسی دارای میلیاردها مثال برچسب شده است. اردو دارای هزاران مثال است. ماهیتلی تقریباً هیچ کدام ندارد. هر سیستم عملی NLP که به مخاطبان جهانی خدمت می کند باید بر روی دم طولانی زبان هایی کار کند که داده های آموزشی خاص وظیفه وجود ندارد.

مدل های چند زبانی با آموزش یک مدل در چندین زبان همزمان این مشکل را حل می کنند. نمایندگی مشترک اجازه می دهد که مهارت های آموخته شده در زبان های منابع بالا به زبان های منابع پایین منتقل شود. این مدل را با تجزیه و تحلیل احساسات انگلیسی تنظیم کنید و این پیش بینی های احساسی شگفت انگیز خوبی را در اردو از جعبه بیرون تولید می کند. این انتقال بین زبانی صفر است و این نحوه انتقال NLP را به جهان تغییر داده است.

این درس، تفاوت ها، مدل های قانونی و تصمیم گیری را که تیم های جدید را به کار چند زبانی می کشاند، نام می دهد: انتخاب یک زبان منبع برای انتقال.

## مفهوم

![Cross-lingual transfer via shared multilingual embedding space](../assets/multilingual.svg)

**Shared vocabulary.**مدل های چند زبانی از یک سیمنتی پیس یا توکنیسر WordPiece استفاده می کنند که بر متن از تمام زبان های هدف آموزش دیده است. ذخایر لغات به اشتراک گذاشته شده است: واحد زیرکلمه مشابه یک مورفیم در میان زبان های مرتبط است. `anti-`در زبان انگلیسی و ایتالیایی هم همین نماد می شود.

**Shared representation.**یک ترانسفورماتور که از قبل در مدل سازی زبان ماسک شده در بسیاری از زبان ها آموزش دیده است می آموزد که جمله های معنوی مشابه در زبان های مختلف حالت های پنهان مشابهی را تولید می کنند. mBERT، XLM-R و NLLB همه این را نشان می دهند. گنجانده شدن برای "قطه" در گروه انگلیسی نزدیک به "چات" در فرانسه و "گاتو" در اسپانیایی، و همچنین گنجانده شدن جمله کامل.

**Zero-shot transfer.**در یک زبان (معمولا انگلیسی) ، مدل را بر روی داده های برچسب شده تنظیم کنید. در نتیجه، آن را در هر زبان دیگری که مدل پشتیبانی می کند اجرا کنید. هیچ برچسب زبان هدف مورد نیاز نیست. نتایج برای زبان های مرتبط با نوع شناسی قوی و ضعیف تر برای زبان های دور است.

**Few-shot fine-tuning.**100-500 مثال برچسب شده را در زبان هدف اضافه کنید. دقت به 95-98% از خط پایه انگلیسی در وظایف طبقه بندی می رسد. این تنها لفت ارزان ترین در NLP چندزبانی است.

## مدل ها

| Model | Year | Coverage | Notes |
|-------|------|----------|-------|
| mBERT | 2018 | 104 languages | Trained on Wikipedia. First practical multilingual LM. Weak on low-resource. |
| XLM-R | 2019 | 100 languages | Trained on CommonCrawl (much larger than Wikipedia). Sets the cross-lingual baseline. Base 270M, Large 550M. |
| XLM-V | 2023 | 100 languages | XLM-R with 1M-token vocabulary (vs 250k). Better on low-resource. |
| mT5 | 2020 | 101 languages | T5 architecture for multilingual generation. |
| NLLB-200 | 2022 | 200 languages | Meta's translation model; includes 55 low-resource languages. |
| BLOOM | 2022 | 46 languages + 13 programming | Open 176B LLM trained multilingually. |
| Aya-23 | 2024 | 23 languages | Cohere's multilingual LLM. Strong on Arabic, Hindi, Swahili. |

انتخاب با استفاده از مورد. طبقه بندی به خوبی با XLM-R-base به عنوان پیش فرض عاقل کار می کند. وظایف نسل نیاز به mT5 یا NLLB بسته به ترجمه در مقابل نسل باز. LLM سبک کار زوج با Aya-23 یا کلاود با استفاده از صریح ترغیب چند زبانی.

## تصمیم در مورد زبان منبع (تحقیق ۲۰۲۶)

اکثر تیم ها به عنوان منبع تنظیم دقیق به زبان انگلیسی دستکاری می کنند. تحقیقات اخیر (2026) نشان می دهد که این اغلب اشتباه است.

شباهت زبان پیش بینی کیفیت انتقال بهتر از اندازه کورپوس خام است. برای اهداف سلواوی، آلمانی یا روسی اغلب بر زبان انگلیسی غلبه می کند. برای اهداف هندی، هندی اغلب بر زبان انگلیسی غلبه می کند.**qWALS**متریک شباهت (2026, بر اساس ویژگی های آتلس جهانی ساختار زبان) این را مقادیر می کند. **LANGRANK**(Lin et al., ACL 2019) یک روش جداگانه و قبلی است که زبان های منبع کاندید را از ترکیبی از شباهت زبانی، اندازه جسم و ارتباط ژنتیکی رتبه بندی می کند.

قانون عملی: اگر زبان هدف شما دارای یک رشتہ دار با منابع بالا است، ابتدا سعی کنید آن را خوب تنظیم کنید، سپس آن را با انگلیسی خوب تنظیم کنید.

```figure
n5-crosslingual-bridge
```

## آن را بسازید

### مرحله ی اول: طبقه بندی بین زبانی صفر

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

tok = AutoTokenizer.from_pretrained("joeddav/xlm-roberta-large-xnli")
model = AutoModelForSequenceClassification.from_pretrained("joeddav/xlm-roberta-large-xnli")


def classify(text, candidate_labels, hypothesis_template="This text is about {}."):
    scores = {}
    for label in candidate_labels:
        hypothesis = hypothesis_template.format(label)
        inputs = tok(text, hypothesis, return_tensors="pt", truncation=True)
        with torch.no_grad():
            logits = model(**inputs).logits[0]
        entail_score = torch.softmax(logits, dim=-1)[2].item()
        scores[label] = entail_score
    return dict(sorted(scores.items(), key=lambda x: -x[1]))


print(classify("I love this product!", ["positive", "negative", "neutral"]))
print(classify("मुझे यह उत्पाद पसंद है!", ["positive", "negative", "neutral"]))
print(classify("J'adore ce produit !", ["positive", "negative", "neutral"]))
```

یک مدل، سه زبان، همان API. XLM-R آموزش داده های NLI به خوبی به طبقه بندی از طریق ترفند انجام می دهد.

### مرحله دوم: فضای گنجانده ی چند زبانی

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

pairs = [
    ("The cat is sleeping.", "Le chat dort."),
    ("The cat is sleeping.", "El gato está durmiendo."),
    ("The cat is sleeping.", "Die Katze schläft."),
    ("The cat is sleeping.", "The dog is barking."),
]

for eng, other in pairs:
    emb_eng = model.encode([eng], normalize_embeddings=True)[0]
    emb_other = model.encode([other], normalize_embeddings=True)[0]
    sim = float(np.dot(emb_eng, emb_other))
    print(f"  {eng!r} <-> {other!r}: cos={sim:.3f}")
```

ترجمه ها در فضای گنجانده شدن نزدیک می شوند. جمله های انگلیسی متفاوت بیشتر می شوند. این چیزی است که باعث می شود بازخواهی بین زبانی، جمع بندی و شباهت کار کند.

### مرحله سوم: استراتژی تنظیم دقیق چند شات

```python
from transformers import TrainingArguments, Trainer
from datasets import Dataset


def few_shot_finetune(base_model, base_tokenizer, examples):
    ds = Dataset.from_list(examples)

    def tokenize_fn(ex):
        out = base_tokenizer(ex["text"], truncation=True, max_length=128)
        out["labels"] = ex["label"]
        return out

    ds = ds.map(tokenize_fn)
    args = TrainingArguments(
        output_dir="out",
        per_device_train_batch_size=8,
        num_train_epochs=5,
        learning_rate=2e-5,
        save_strategy="no",
    )
    trainer = Trainer(model=base_model, args=args, train_dataset=ds)
    trainer.train()
    return base_model
```

برای 100 تا 500 مثال زبان هدف، `num_train_epochs=5`و`learning_rate=2e-5`نرخ های یادگیری بالاتر باعث می شود که تعادل چند زبانی سقوط کند و شما یک مدل تنها انگلیسی را دریافت کنید.

## ارزیابی که واقعاً کار می کند

- **Per-language accuracy on held-out sets.**جمع نشده جمع شده است. جمع شده دم بلند را پنهان می کند.
- **Benchmark against monolingual baseline.**برای زبان هایی که داده های کافی دارند، یک مدل یک زبانی که از ابتدا آموزش دیده است، گاهی اوقات از یک مدل چند زبانی بهتر است.
- **Entity-level tests.**نام نهاد ها در زبان هدف. مدل های چند زبانی اغلب نشانه های ضعیف برای اسکریپت های دور از لاتین دارند.
- **Cross-lingual consistency.**معنی مشابهی در دو زبان باید پیش بینی مشابهی را به وجود آورد.

## ازش استفاده کن

دسته 2026:

| Task | Recommended |
|-----|-------------|
| Classification, 100 languages | XLM-R-base (~270M) fine-tuned |
| Zero-shot text classification | `joeddav/xlm-roberta-large-xnli` |
| Multilingual sentence embeddings | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| Translation, 200 languages | `facebook/nllb-200-distilled-600M` (see lesson 11) |
| Generative multilingual | Claude, GPT-4, Aya-23, mT5-XXL |
| Low-resource language NLP | XLM-V or a domain-specific fine-tune on related high-resource language |

همیشه بودجه برای تنظیم دقیق در زبان هدف اگر عملکرد مهم است. صفر شوت نقطه شروع است، نه یک پاسخ نهایی.

### مالیات توکن سازی (چه چیزی برای زبان های کم منابع اشتباه می شود)

مدل های چند زبانی یک توکنایزر را در تمام زبان های خود به اشتراک می گذارند. این لغت بر روی یک کورپوس آموزش داده شده است که توسط انگلیسی، فرانسوی، اسپانیایی، چینی، آلمانی تسلط دارد. برای هر زبان خارج از مجموعه غالب، سه مالیات به صورت سکوت ترکیب می شوند:

- **Fertility tax.**متن زبان منابع کم به توکن های بسیار بیشتری در هر کلمه نسبت به انگلیسی تبدیل می شود. یک جمله هندی ممکن است 3-5 برابر توکن های یک جمله انگلیسی معادل نیاز داشته باشد. این 3-5 برابر پنجره زمینه، بهره وری آموزش و تاخیر شما را می خورد.
- **Variant recovery tax.**هر خط چاپ، ویرانت دیاکریتیک، عدم مطابقت استاندارد یونیکوڈ یا ویرایش صورت به یک ردیابی غیر مرتبط با شروع سرد در فضای گنجانده تبدیل می شود. مدل نمی تواند مطابقت های املاکی را که یک زبان مادری به نظر می رسد به طور واضح یاد بگیرد.
- **Capacity spillover tax.**مالیات 1 و 2 موقعیت های زمینه، عمق لایه و ابعاد گنجانده را مصرف می کنند. آنچه برای استدلال واقعی باقی مانده سیستماتیک کوچکتر از آنچه یک زبان منابع بالا از همان مدل دریافت می کند.

علائم عملی: مدل شما به طور معمول به هندی آموزش می دهد، منحنی زیان درست به نظر می رسد، تعصب ارزیابی منطقی به نظر می رسد و نتایج تولید به شدت اشتباه است. مورفولوژی در وسط جمله فرو می ریزد. منحنیات نادر غیر قابل بازیابی باقی می ماند. **You cannot data-scale your way out of a broken tokenizer.**

کاهش: یک توکنایزر را انتخاب کنید که پوشش خوبی برای زبان هدف شما داشته باشد (جهزیه 1M-token XLM-V یک راه حل مستقیم است) ؛ باروری توکنایزاسیون را در متن هدف گرفته شده قبل از آموزش بررسی کنید؛ از سطح بایت استفاده کنید (SentencePiece `byte_fallback=True`برای اسکریپت های واقعاً طولانی، هیچ چیز هرگز OOV نیست.

## -باده

پس از`outputs/skill-multilingual-picker.md`:

```markdown
---
name: multilingual-picker
description: Pick source language, target model, and evaluation plan for a multilingual NLP task.
version: 1.0.0
phase: 5
lesson: 18
tags: [nlp, multilingual, cross-lingual]
---

Given requirements (target languages, task type, available labeled data per language), output:

1. Source language for fine-tuning. Default English; check LANGRANK or qWALS if target language has a typologically close high-resource language.
2. Base model. XLM-R (classification), mT5 (generation), NLLB (translation), Aya-23 (generative LLM).
3. Few-shot budget. Start with 100-500 target-language examples if available. Zero-shot only if labeling is infeasible.
4. Evaluation plan. Per-language accuracy (not aggregate), cross-lingual consistency, entity-level F1 on non-Latin scripts.

Refuse to ship a multilingual model without per-language evaluation — aggregate metrics hide long-tail failures. Flag scripts with low tokenization coverage (Amharic, Tigrinya, many African languages) as needing a model with byte-fallback (SentencePiece with byte_fallback=True, or byte-level tokenizer like GPT-2).
```

## تمرینات

1. **Easy.**خط لوله طبقه بندی صفر شات را در هر زبان 10 جمله در زبان انگلیسی، فرانسوی، هندی و عربی اجرا کنید. دقت را در هر یک گزارش دهید. شما باید فرانسوی قوی، هندی مناسب، عربی متغیر را ببینید.
2. **Medium.**استفاده کنید`paraphrase-multilingual-MiniLM-L12-v2`برای ساخت یک بازیافتگر چند زبانی بر روی یک کورپوس کوچک از زبان های مخلوط. سوال در زبان انگلیسی، بازیافت اسناد در هر زبان. اندازه گیری یادآوری@5.
3. **Hard.**مقایسه با منبع انگلیسی و منبع هندی برای یک کار طبقه بندی هندی. برای تنظیم دقیق چند عکس در هر دو رژیم از 500 مثال زبان هدف استفاده کنید. گزارش کنید که کدام منبع دقیق تر هندی را تولید می کند و چقدر. این پایان نامه LANGRANK در کوچک است.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Multilingual model | One model, many languages | Shared vocabulary and parameters across languages. |
| Cross-lingual transfer | Train on one language, run on another | Fine-tune on source, evaluate on target without target-language labels. |
| Zero-shot | No target-language labels | Transfer without fine-tuning on the target language. |
| Few-shot | Small target labels | 100-500 target-language examples used for fine-tuning. |
| mBERT | First multilingual LM | 104-language BERT pretrained on Wikipedia. |
| XLM-R | Standard cross-lingual baseline | 100-language RoBERTa pretrained on CommonCrawl. |
| NLLB | Meta's 200-language MT | No Language Left Behind. Includes 55 low-resource languages. |

## خواندن بیشتر

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) کاغذ XLM-R
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502) مقاله تحلیلی که خط تحقیقاتی انتقال بین زبانه را آغاز کرد.
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) مقاله NLLB-200
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827)آيا، مدرک تحصيلي چند زبانه "کوهر"
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65) مقاله زبان منبع QWALS / LANGRANK
