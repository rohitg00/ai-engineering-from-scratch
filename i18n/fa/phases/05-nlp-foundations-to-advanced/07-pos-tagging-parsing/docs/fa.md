# برچسب گذاری POS و تجزیه و تحلیل سنتکتیک

> و بعد هر خط لوله ی LLM نیاز به اعتبار استخراج ساختاری داشت و دوباره به آن رسید.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## مشکل

درس اول قول داد که لمیتیزاسیون به یک قسمت از سخنرانی نیاز داره بدون اینکه بدونی`running`یک فعل است، یک lemmatizer نمی تواند آن را به `run`بدون اينکه بدونم`better`یک صفت است، نمیتونه به `good`. .

این وعده یک بخش زیر کامل را پنهان می کند. برچسب گذاری بخشی از سخنرانی دسته بندی های دستور زبان را اختصاص می دهد. تجزیه و تحلیل نحوی ساختار درخت جمله را بازمی گرداند: کدام کلمه کدام را تغییر می دهد، کدام فعل کدام استدلال را اداره می کند. NLP کلاسیک بیست سال را صرف اصلاح هر دو کرد. سپس یادگیری عمیق آنها را به یک وظیفه طبقه بندی نماد در بالای یک ترانسفورماتور پیش از آموزش کرد و جامعه تحقیقاتی حرکت کرد.

نه جامعه کاربردی. هر لوله استخراج ساختاری هنوز از درختان POS و وابستگی زیر کوپ استفاده می کند. JSON تولید شده توسط LLM با محدودیت های دستور زبان تأیید می شود. سیستم های پاسخ به سوالات با استفاده از تجزیه وابستگی سوالات را تجزیه می کنند. ارزیابی کنندگان کیفیت ترجمه ماشین موازی درختان تجزیه را بررسی می کنند.

ارزش دانستن این درس تاگ ها، خط های پایه و نقطه ای را معرفی می کند که شما از ابتدا اجرا کردن را متوقف می کنید و به اسپاسی می گویید.

## مفهوم

**POS tagging**هر نماد رو با يه دسته گرامريكي برچسب ميده**Penn Treebank (PTB)**Tagset به طور پیش فرض انگلیسی است. 36 تاگ با تفاوت خواننده تصادفی می یابد که پرخاش: `NN`اسم تک تک`NNS`اسم جمع، `NNP`اسم خاص تک تک`VBD`فعل گذشته زمان، `VBZ`فعل سوم فرد فرد واحد موجود و غیره.**Universal Dependencies (UD)**برچسبسایت (۱۷ تاگ) خشن تر و زبان ناپسند است؛ این برای کار بین زبانی پیش فرض شده است.

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**Syntactic parsing**دو سبک اصلی:

- **Constituency parsing.**عبارات اسم، عبارات فعل، عبارات پیش فرض در داخل یکدیگر سرپناه می کنند. محصول یک درخت از دسته های غیر انتهای (NP، VP، PP) با کلمات به عنوان برگ است.
- **Dependency parsing.**هر کلمه یک کلمه ی سر را دارد که به آن بستگی دارد و با یک رابطه ی گرامریداً برچسب گذاری شده است. محصول یک درخت است که هر لبه یک (سر، وابسته، رابطه) سه برابر است.

تجزیه و تحلیل وابستگی در دهه 2010 برنده شد زیرا به طور کلی در میان زبان ها، به ویژه در میان زبان های نظم کلمه آزاد، به طور کلی به طور کلی به طور کلی به اشتراک گذاشته می شود.

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

```figure
pos-tagger
```

```figure
dependency-arcs
```

## آن را بسازید

### مرحله 1: بیشترین میزان استفاده از برچسب

احمقانه ترين برچسب POS که کار ميکنه براي هر کلمه، تاگ رو پيش بيني که اغلب در آموزش داشت

```python
from collections import Counter, defaultdict


def train_mft(train_examples):
    word_tag_counts = defaultdict(Counter)
    all_tags = Counter()
    for tokens, tags in train_examples:
        for token, tag in zip(tokens, tags):
            word_tag_counts[token.lower()][tag] += 1
            all_tags[tag] += 1
    word_best = {w: c.most_common(1)[0][0] for w, c in word_tag_counts.items()}
    default_tag = all_tags.most_common(1)[0][0]
    return word_best, default_tag


def predict_mft(tokens, word_best, default_tag):
    return [word_best.get(t.lower(), default_tag) for t in tokens]
```

در "برون" این خط پایه به 85 درصد دقت رسیده، خوب نیست، اما طبقه ای که هیچ مدل جدی نباید زیرش سقوط کند.

### مرحله دوم: برچسب Bigram HMM

مدل احتمال مشترک دنباله:

```math
P(\text{tags}, \text{words}) = \prod_i P(\text{tag}_i \mid \text{tag}_{i-1}) \cdot P(\text{word}_i \mid \text{tag}_i)
```

دو جدول: احتمالات انتقال (تگ به عنوان تگ قبلی) ، احتمالات انتشار (تگ به عنوان کلمه داده شده) ، هر دو را از حساب با صاف کردن Laplace تخمین بزنید. با Viterbi (برنامه سازی پویا بر روی شبکه تگ) کدگذاری کنید.

```python
import math


def train_hmm(train_examples, alpha=0.01):
    transitions = defaultdict(Counter)
    emissions = defaultdict(Counter)
    tags = set()
    vocab = set()

    for tokens, ts in train_examples:
        prev = "<BOS>"
        for token, tag in zip(tokens, ts):
            transitions[prev][tag] += 1
            emissions[tag][token.lower()] += 1
            tags.add(tag)
            vocab.add(token.lower())
            prev = tag
        transitions[prev]["<EOS>"] += 1

    return transitions, emissions, tags, vocab


def log_prob(table, given, key, smooth_denom, alpha):
    return math.log((table[given].get(key, 0) + alpha) / smooth_denom)


def viterbi(tokens, transitions, emissions, tags, vocab, alpha=0.01):
    tags_list = list(tags)
    n = len(tokens)
    V = [[0.0] * len(tags_list) for _ in range(n)]
    back = [[0] * len(tags_list) for _ in range(n)]

    for j, tag in enumerate(tags_list):
        em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
        tr_denom = sum(transitions["<BOS>"].values()) + alpha * (len(tags_list) + 1)
        tr = log_prob(transitions, "<BOS>", tag, tr_denom, alpha)
        em = log_prob(emissions, tag, tokens[0].lower(), em_denom, alpha)
        V[0][j] = tr + em
        back[0][j] = 0

    for i in range(1, n):
        for j, tag in enumerate(tags_list):
            em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
            em = log_prob(emissions, tag, tokens[i].lower(), em_denom, alpha)
            best_prev = 0
            best_score = -1e30
            for k, prev_tag in enumerate(tags_list):
                tr_denom = sum(transitions[prev_tag].values()) + alpha * (len(tags_list) + 1)
                tr = log_prob(transitions, prev_tag, tag, tr_denom, alpha)
                score = V[i - 1][k] + tr + em
                if score > best_score:
                    best_score = score
                    best_prev = k
            V[i][j] = best_score
            back[i][j] = best_prev

    last_best = max(range(len(tags_list)), key=lambda j: V[n - 1][j])
    path = [last_best]
    for i in range(n - 1, 0, -1):
        path.append(back[i][path[-1]])
    return [tags_list[j] for j in reversed(path)]
```

بیگرام HMM بر روی براون به دقت ~93٪ رسیده است. قفسه از 85٪ به 93٪ عمدتا احتمالات انتقال است  مدل یاد می گیرد `DET NOUN`معمولا و`NOUN DET`نادر است

### مرحله سوم: چرا تاجر های مدرن این را شکست می دهند

احتمال انتقال + انتشار محلی است.`saw`یک CRF با ویژگی های تعسفی (افاف، شکل کلمه، کلمه قبل و بعد، کلمه خود) ~97٪ را به دست می آورد. یک BiLSTM-CRF یا ترانسفورمتر ~98٪ + را به دست می آورد.

سقف این کار توسط اختلاف نظر مفسران تعیین شده است. مفسران انسانی در حدود 97٪ از زمان در Penn Treebank موافق هستند. مدل های گذشته 98٪ احتمالاً از مجموعه آزمایش بیش از حد مناسب هستند.

### مرحله 4: طرح تجزیه و تحلیل وابستگی

تجزیه و تحلیل کامل وابسته از ابتدا خارج از محدوده است؛ درمان کتاب های آموزشی کانونیکی در Jurafsky و Martin است. دو خانواده کلاسیک برای دانستن:

- **Transition-based**پارسر ها (قوس-سنگ، قوس-استاندارد) مانند یک پارسر کاهش تغییر عمل می کنند: آنها توکن ها را می خوانند، آنها را به یک استیک منتقل می کنند و اقدامات کاهش ایجاد قوس را اعمال می کنند. رمزگذاری طمع سریع است. پیاده سازی کلاسیک مالتپارسر است. نسخه عصب مدرن: پارسر مبتنی بر انتقال چن و منینگ.
- **Graph-based**پارسر ها (الگوریتم ایسنر، Dozat-Manning biaffine) هر کناری وابسته به سر را نمره می دهند و حداکثر درخت امتداد را انتخاب می کنند. آهسته تر اما دقیق تر.

برای بیشتر کارهای کاربردی، تماس بگیرید:

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running at 3pm.")
for token in doc:
    print(f"{token.text:10s} tag={token.tag_:5s} pos={token.pos_:6s} dep={token.dep_:10s} head={token.head.text}")
```

```
The        tag=DT    pos=DET    dep=det        head=cats
cats       tag=NNS   pos=NOUN   dep=nsubj      head=running
were       tag=VBD   pos=AUX    dep=aux        head=running
running    tag=VBG   pos=VERB   dep=ROOT       head=running
at         tag=IN    pos=ADP    dep=prep       head=running
3pm        tag=NN    pos=NOUN   dep=pobj       head=at
.          tag=.     pos=PUNCT  dep=punct      head=running
```

.`dep`ستون پایین تا بالا و ساختار گرامرایی جمله سقوط می کند.

## ازش استفاده کن

هر کتابخانه تولید NLP POS و dependence parsers را به عنوان بخشی از یک خط لوله استاندارد ارسال می کند.

- **spaCy**(`en_core_web_sm`-`md`-`lg`-`trf`) سریع، دقیق، با توکن سازی + NER + لمیتیزاسیون یکپارچه شده است. `token.tag_`(پین)`token.pos_`(د.و.د)`token.dep_`(روابط وابستگی)
- **Stanford NLP (stanza)**. جانشین استنفورد به CoreNLP . پیشرفته در بیش از 60 زبان
- **trankit**.تراسفورماتور با دقت خوب UD
- **NLTK**.`pos_tag`قابل استفاده، آهسته، پيرتر، براي آموزش خوبه

### در سال 2026 که هنوز هم اهمیت دارد

- **Lemmatization.**درس اول به POS نیاز داره تا به طور درست بهشون کمک کنه
- **Structured extraction from LLM outputs.**تایید کنید که جمله تولید شده به محدودیت های دستور زبان احترام می گذارد (به عنوان مثال توافق موضوع و فعل، اصلاحات مورد نیاز).
- **Aspect-based sentiment.**تجزیه و تحلیل وابسته به شما می گوید که کدام صفت تغییر می کند.
- **Query understanding.**"فيلم هاي رئيسي شده توسط ويس اندرسون با بيل موراي" از طریق پارس به محدودیت هاي ساختاره تشکيل مي شوند.
- **Cross-lingual transfer.**برچسب های UD و روابط وابستگی زبان شناختی هستند و تجزیه و تحلیل ساختاری صفر شوت زبان های جدید را امکان پذیر می کنند.
- **Low-compute pipelines.**اگر نمیتونی یک ترانسفورماتور بفرستی، POS + وابسته شدن به تجزیه و تحلیل + گجتیر به طرز شگفت انگیزی به تو کمک می کند.

## -باده

پس از`outputs/skill-grammar-pipeline.md`:

```markdown
---
name: grammar-pipeline
description: Design a classical POS + dependency pipeline for a downstream NLP task.
version: 1.0.0
phase: 5
lesson: 07
tags: [nlp, pos, parsing]
---

Given a downstream task (information extraction, rewrite validation, query decomposition, lemmatization), you output:

1. Tagset to use. Penn Treebank for English-only legacy pipelines, Universal Dependencies for multilingual or cross-lingual.
2. Library. spaCy for most production, stanza for academic-grade multilingual, trankit for highest UD accuracy. Name the specific model ID.
3. Integration pattern. Show the 3-5 lines that call the library and consume the needed attributes (`.pos_`, `.dep_`, `.head`).
4. Failure mode to test. Noun-verb ambiguity (`saw`, `book`, `can`) and PP-attachment ambiguity are the classical traps. Sample 20 outputs and eyeball.

Refuse to recommend rolling your own parser. Building parsers from scratch is a research project, not an application task. Flag any pipeline that consumes POS tags without handling lowercase/uppercase variants as fragile.
```

## تمرینات

1. **Easy.**با استفاده از بیشترین خط پایه برچسب در یک کورپوس کوچک برچسب گذاری شده (به عنوان مثال، زیر مجموعه براون NLTK) ، دقت در جمله های بازداشت شده را اندازه گیری کنید. نتیجه ~ 85٪ را بررسی کنید.
2. **Medium.**به این مدل HMM بالا آموزش بده و دقت/بازگیره هر تاگ را گزارش بده. کدام تاگ ها HMM بیشتر گیج می کند؟
3. **Hard.**با استفاده از تجزیه و تحلیل وابستگی spaCy برای استخراج سه برابر موضوع-فعل-آنچه از یک نمونه 1000 جمله استفاده کنید. بر اساس 50 سه برابر با برچسب دستی ارزیابی کنید. سندی که در آن استخراج شکست می خورد (معمولاً غیرفعال، هماهنگی و موضوعات حذف شده).

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| POS tag | Word's type | Grammatical category. PTB has 36; UD has 17. |
| Penn Treebank | Standard tagset | English-specific. Fine-grained verb tenses and noun number. |
| Universal Dependencies | Multilingual tagset | Coarser than PTB; language-neutral; defaults for cross-lingual work. |
| Dependency parse | Sentence tree | Each word has one head, each edge has a grammatical relation. |
| Viterbi | Dynamic programming | Finds the highest-probability tag sequence given emissions and transitions. |

## خواندن بیشتر

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) درمان کتاب های آموزشی کانونیک POS و تجزیه و تحلیل.
- [Universal Dependencies project](https://universaldependencies.org/) مجموعه برچسب های متعدد زبانی و مجموعه درخت که توسط هر تحلیلگر چند زبانی استفاده می شود.
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) مرجع عملی برای هر ویژگی که در این مقاله ارائه شده است`Token`. .
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf)روزنامه ای که پارسرهای عصبی را به جریان اصلی آورد.
