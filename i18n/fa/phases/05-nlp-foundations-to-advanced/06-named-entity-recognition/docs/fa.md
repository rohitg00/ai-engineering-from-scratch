# شناسایی نهاد نامگذاری شده

> به نظر مياد تا وقتي با مرزها، موجودات گشته شده و جارگون دامنه ها برخورد کني

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word Embeddings)
**Time:** ~75 minutes

## مشکل

"آپل به خاطر قرارداد جستجوی آیفون خود در ایالات متحده گوگل را متقاضیه کرد". پنج نهاد: اپل (ORG) ، گوگل (ORG) ، آیفون (PRODUCT) ، معامله جستجو (شاید) ، ایالات متحده (GPE) . یک سیستم NER خوب همه آنها را با انواع صحیح استخراج می کند. یک سیستم بد از آیفون محروم می شود، میوه ایپل را با اپل شرکت اشتباه می گیرد و "آمریکا" را به عنوان یک فرد برچسب می زند.

NER، کار اصلی هر خط استخراج ساختاری است. تجزیه و تحلیل رزومه، اسکنینگ روزنامه های مطابق، ناشناس سازی سوابق پزشکی، درک سوالات جستجو، زمین گیری برای پاسخ های چتbot، استخراج قرارداد قانونی. شما هرگز کاملاً آن را نمی بینید؛ شما همیشه به آن وابسته هستید.

این درس مسیر کلاسیک (به اصول مبتنی، HMM، CRF) را به مسیر مدرن (BiLSTM-CRF، سپس ترانسفورماتورها) منتقل می کند. هر مرحله یک محدودیت خاص از آن که قبل از آن است را حل می کند. الگوی درس است.

## مفهوم

**BIO tagging**(یا BILOU) استخراج واحد را به یک مشکل برچسب گذاری ردیابی تبدیل می کند.`B-TYPE`(ابتدائی شرکت)`I-TYPE`(حسابگاه داخلی) یا`O`(به خارج از هر واحد)

```
Apple    B-ORG
sued     O
Google   B-ORG
over     O
its      O
iPhone   B-PRODUCT
search   O
deal     O
in       O
the      O
US       B-GPE
.        O
```

زنجیره ی ارگان های چند توکن: `New B-GPE`،`York I-GPE`،`City I-GPE`. مدلي که با بي او آشناست مي تونه اسپان هاي تعسفي رو استخراج کنه

پیشرفت معماری:

- **Rule-based.**بررسی های Regex + گجتیر دقت بالا در ارگان های شناخته شده، پوشش صفر در ارگان های جدید
- **HMM.**مدل مارکوف پنهان احتمال انتشار نشانه ای داده شده، احتمال انتقال برچسب به برچسب، رمزگذاری ویتربی، آموزش داده شده بر اساس داده های برچسب شده
- **CRF.**زمینه تصادفی مشروط. مانند HMM اما تبعیض آمیز، بنابراین شما می توانید ویژگی های تعسفی (شکل کلمه، سرمایه گذاری، کلمات همسایه) را مخلوط کنید. هنوز هم کارگاه تولید کلاسیک در سال 2026 برای انتشار منابع کم است.
- **BiLSTM-CRF.**ویژگی های عصبی به جای دستکاری. LSTM جمله را در هر دو جهت می خواند، لایه CRF در بالای تگ ها تسلسل های ثابت را اعمال می کند.
- **Transformer-based.**با سر طبقه بندی توکن، بهترین دقت، بهترین محاسبه

```figure
ner-bio-tagging
```

## آن را بسازید

### مرحله ی اول: کمک کننده های برچسب گذاری بیو

```python
def spans_to_bio(tokens, spans):
    labels = ["O"] * len(tokens)
    for start, end, label in spans:
        labels[start] = f"B-{label}"
        for i in range(start + 1, end):
            labels[i] = f"I-{label}"
    return labels


def bio_to_spans(tokens, labels):
    spans = []
    current = None
    for i, label in enumerate(labels):
        if label.startswith("B-"):
            if current:
                spans.append(current)
            current = (i, i + 1, label[2:])
        elif label.startswith("I-") and current and current[2] == label[2:]:
            current = (current[0], i + 1, current[2])
        else:
            if current:
                spans.append(current)
                current = None
    if current:
        spans.append(current)
    return spans
```

```python
>>> tokens = ["Apple", "sued", "Google", "over", "iPhone", "sales", "."]
>>> labels = ["B-ORG", "O", "B-ORG", "O", "B-PRODUCT", "O", "O"]
>>> bio_to_spans(tokens, labels)
[(0, 1, 'ORG'), (2, 3, 'ORG'), (4, 5, 'PRODUCT')]
```

### مرحله دوم: ویژگی های دستکاری

برای NER کلاسیک (غیر عصبی) ، ویژگی ها بازی هستند. مفید:

```python
def token_features(token, prev_token, next_token):
    return {
        "lower": token.lower(),
        "is_upper": token.isupper(),
        "is_title": token.istitle(),
        "has_digit": any(c.isdigit() for c in token),
        "suffix_3": token[-3:].lower(),
        "shape": word_shape(token),
        "prev_lower": prev_token.lower() if prev_token else "<BOS>",
        "next_lower": next_token.lower() if next_token else "<EOS>",
    }


def word_shape(word):
    out = []
    for c in word:
        if c.isupper():
            out.append("X")
        elif c.islower():
            out.append("x")
        elif c.isdigit():
            out.append("d")
        else:
            out.append(c)
    return "".join(out)
```

`word_shape("iPhone")`بازپرداخت`xXxxxx`.`word_shape("USA-2024")`بازپرداخت`XXX-dddd`. الگوهای سرمایه گذاری برای اسم های مناسب سیگنال بالایی دارند

### مرحله 3: یک قانون ساده مبتنی بر + لغت پایه

```python
ORG_GAZETTEER = {"Apple", "Google", "Microsoft", "OpenAI", "Meta", "Amazon", "Netflix"}
GPE_GAZETTEER = {"US", "USA", "UK", "India", "Germany", "France"}
PRODUCT_GAZETTEER = {"iPhone", "Android", "Windows", "ChatGPT", "Claude"}


def rule_based_ner(tokens):
    labels = []
    for token in tokens:
        if token in ORG_GAZETTEER:
            labels.append("B-ORG")
        elif token in GPE_GAZETTEER:
            labels.append("B-GPE")
        elif token in PRODUCT_GAZETTEER:
            labels.append("B-PRODUCT")
        else:
            labels.append("O")
    return labels
```

روزنامه های تولید میلیون ها مطلب را از ویکیپدیا و DBpedia حذف کرده اند. پوشش خوب است.`Apple`این کار وحشتناک است. به همین دلیل مدل های آماری برنده شدند.

### مرحله 4: مرحله CRF (نمره، نه مکمل ایمپل)

CRF کامل از ابتدا در 50 خط بدون اساس نظریه احتمال روشن نمی شود.`sklearn-crfsuite`در عوض:

```python
import sklearn_crfsuite

def to_features(tokens):
    out = []
    for i, tok in enumerate(tokens):
        prev = tokens[i - 1] if i > 0 else ""
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        out.append({
            "word.lower()": tok.lower(),
            "word.isupper()": tok.isupper(),
            "word.istitle()": tok.istitle(),
            "word.isdigit()": tok.isdigit(),
            "word.suffix3": tok[-3:].lower(),
            "word.shape": word_shape(tok),
            "prev.word.lower()": prev.lower(),
            "next.word.lower()": nxt.lower(),
            "BOS": i == 0,
            "EOS": i == len(tokens) - 1,
        })
    return out


crf = sklearn_crfsuite.CRF(algorithm="lbfgs", c1=0.1, c2=0.1, max_iterations=100, all_possible_transitions=True)
X_train = [to_features(s) for s in sentences_tokenized]
crf.fit(X_train, bio_labels_train)
```

`c1`و`c2`L1 و L2 تنظیم شده اند. `all_possible_transitions=True`اجازه می دهد مدل دنباله های غیرقانونی را یاد بگیرد (به عنوان مثال ،`I-ORG`بعد از`O`) بعید است، که این گونه یک CRF بدون نوشتن محدودیت، مطابقت بایو را اعمال می کند.

### مرحله 5: آنچه یک BiLSTM-CRF اضافه می کند

ویژگی ها یاد می گیرند. ورودی: ورودی های رمزنگاری (GloVe یا fastText). LSTM از چپ به راست و راست به چپ می خواند. حالت های پنهان متصل از طریق یک لایه خروجی CRF عبور می کنند. CRF هنوز هم هماهنگی ردیف برچسب را اعمال می کند؛ LSTM ویژگی های دستکاری را با ویژگی های یاد گرفته جایگزین می کند.

```python
import torch
import torch.nn as nn


class BiLSTM_CRF_Head(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_labels):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(hidden_dim * 2, n_labels)

    def forward(self, token_ids):
        e = self.embed(token_ids)
        h, _ = self.lstm(e)
        emissions = self.fc(h)
        return emissions
```

برای لایه CRF استفاده کنید `torchcrf.CRF`(Pip نصب pytorch-crf) سود بر روی CRF دستکاری قابل اندازه گیری است اما کمتر از آنچه شما انتظار دارید مگر اینکه شما ده ها هزار جمله برچسب گذاری شده را داشته باشید.

## ازش استفاده کن

اسپاسای کشتی های NER درجه تولید را از جعبه خارج می کند.

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("Apple sued Google over its iPhone search deal in the US.")
for ent in doc.ents:
    print(f"{ent.text:20s} {ent.label_}")
```

```
Apple                ORG
Google               ORG
iPhone               ORG
US                   GPE
```

توجه کنید`iPhone`برچسب گذاری شده`ORG`به جای`PRODUCT` مدل کوچک اسپاسی دارای پوشش کمکی در مورد واحدهای محصول است.`en_core_web_lg`مدل ترانسفورماتور (`en_core_web_trf`) هنوز بهتره

صورت بوسیدن برای NER مبتنی بر BERT:

```python
from transformers import pipeline

ner = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
print(ner("Apple sued Google over its iPhone in the US."))
```

```
[{'entity_group': 'ORG', 'word': 'Apple', ...},
 {'entity_group': 'ORG', 'word': 'Google', ...},
 {'entity_group': 'MISC', 'word': 'iPhone', ...},
 {'entity_group': 'LOC', 'word': 'US', ...}]
```

`aggregation_strategy="simple"`توکن های B-X و I-X را به یک اسپان ادغام می کند. بدون آن، شما لیبل های سطح توکن را دریافت می کنید و باید خودتان را ادغام کنید.

### NER مبتنی بر LLM (مجموعه ۲۰۲۶)

LLM NER صفر شوت و چند شوت اکنون با مدل های خوب تنظیم شده در بسیاری از دامنه ها رقابتی است و زمانی که داده های برچسب گذاری شده کمی است، به طور چشمگیری بهتر است.

- **Zero-shot prompting.**به LLM یک لیست از انواع موجودی و یک طرح نمونه بدهید. از JSON برای تولید درخواست کنید. از جعبه خارج کار می کند؛ دقت در دامنه های جدید متوسط است.
- **ZeroTuneBio-style prompting.**یک کار را به استخراج کاندیدایی تجزیه کنید → معنی توضیح → قضاوت → دوباره بررسی کنید. یک پرامپت چند مرحله ای (نه یک شات) دقت را به طور قابل توجهی در NER بیومدیتیکی افزایش می دهد. این الگوی برای حوزه های حقوقی، مالی و علمی کار می کند.
- **Dynamic prompting with RAG.**نمونه های مشابه را از یک مجموعه دانه های کوچک با اشاره برای هر تماس نتیجه گیری بازپس بگیرید؛ پرامپتر چند شات را در پرواز بسازید. در مرجع های مرجع 2026، این GPT-4 بیومدیکل NER F1 را 11-12٪ نسبت به پرامپتر استاتیک افزایش می دهد.
- **Per-entity-type decomposition.**برای اسناد طولانی، یک تماس که تمام انواع ادغام را به یکباره استخراج می کند، به عنوان طول افزایش می یابد، یادآوری را از دست می دهد. یک پاس استخراج را برای هر نوع ادغام اجرا کنید. هزینه نتیجه گیری بالاتر، دقت قابل توجهی بیشتر. این الگوی استاندارد برای یادداشت های بالینی و قراردادهای حقوقی است.

توصیه تولید از سال 2026: قبل از جمع آوری اطلاعات آموزشی با یک خط اصلی صفر شات LLM شروع کنید. اغلب فورتوینر 1 به اندازه کافی خوب است که شما هرگز نیازی به تنظیم دقیق ندارید.

### جایی که NER کلاسیک هنوز برنده است

حتی با LLM ها که در دسترس هستند، NER کلاسیک برنده می شود وقتی:

- بودجه تاخير کمتر از 50ms است
- شما هزاران نمونه با برچسب دارید و به ۹۸ درصد F۱ نیاز دارید.
- دامنه دارای یک اونتولوژی پایدار است که یک CRF یا BiLSTM پیش از آموزش به خوبی انتقال می دهد.
- محدودیت های نظارتی نیازمند یک مدل غیر تولید کننده در محل است.

### جایی که از هم جدا می شود

- **Domain shift.**NER که در قانون قرارداد ها آموزش دیده از روزنامه نگار بدتر از شما عمل ميکنه
- **Nested entities.**"بانک آف امریکا تاور" همزمان یک ORG و یک FASILITY است. استاندارد بایو نمی تواند پوشش های متداول را نشان دهد. شما نیاز به NER (نمادها مبتنی بر چند گذر یا دوره) را به وجود می آورید.
- **Long entities.**"شركت فدرال بيمه سپردهاي آمريکا" مدل هاي سطح توکن گاهی اينو ميفرستند`aggregation_strategy`یا بعد از عمل.
- **Sparse types.**برچسب های پزشکی NER مانند DRUG_BRAND، ADVERSE_EVENT، DOSE. مدل های عمومی هیچ ایده ای ندارند. Scispacy و BioBERT نقطه شروع هستند.

## -باده

پس از`outputs/skill-ner-picker.md`:

```markdown
---
name: ner-picker
description: Pick the right NER approach for a given extraction task.
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

Given a task description (domain, label set, language, latency, data volume), output:

1. Approach. Rule-based + gazetteer, CRF, BiLSTM-CRF, or transformer fine-tune.
2. Starting model. Name it (spaCy model ID, Hugging Face checkpoint ID, or "custom, trained from scratch").
3. Labeling strategy. BIO, BILOU, or span-based. Justify in one sentence.
4. Evaluation. Use `seqeval`. Always report entity-level F1 (not token-level).

Refuse to recommend fine-tuning a transformer for under 500 labeled examples unless the user already has a pretrained domain model. Flag nested entities as needing span-based or multi-pass models. Require a gazetteer audit if the user mentions "production scale" and labels are unchanged from CoNLL-2003.
```

## تمرینات

1. **Easy.**اجرا`bio_to_spans`(عكس از `spans_to_bio`) و بررسی یکپارچگی سفر و بازگشت در 10 جمله.
2. **Medium.**آموزش CRF sklearn-crfsuite بالا در مجموعه داده های NER انگلیسی CoNLL-2003 گزارش در هر واحد با استفاده از`seqeval`. نتیجه ی معمول: ~84 F1
3. **Hard.**- خوب -`distilbert-base-cased`در یک مجموعه داده های NER مخصوص دامنه (طبیعی، قانونی یا مالی) مقایسه کنید با مدل کوچک spaCy. بررسی های دزدیدن داده ها را مستند کنید و آنچه را که شگفت زده شما کرده است بنویسید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NER | Extract names | Label token spans with types (PERSON, ORG, GPE, DATE, ...). |
| BIO | Tagging scheme | `B-X` begins, `I-X` continues, `O` outside. |
| BILOU | Better BIO | Adds `L-X` (last), `U-X` (unit) for cleaner boundaries. |
| CRF | Structured classifier | Models transitions between labels, not just emissions. Enforces valid sequences. |
| Nested NER | Overlapping entities | One span is a different entity than a sub-span of it. BIO cannot express this. |
| Entity-level F1 | Proper NER metric | Predicted span must match true span exactly. Token-level F1 overstates accuracy. |

## خواندن بیشتر

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) کاغذ BiLSTM-CRF. کانونیک
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) الگوی طبقه بندی توکن را معرفی می کند که استاندارد شده است.
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities) مرجع عملی برای هر ویژگی در `Doc.ents`و`Span`. .
- [seqeval](https://github.com/chakki-works/seqeval) کتابخانه متریک درست. همیشه ازش استفاده کن.
