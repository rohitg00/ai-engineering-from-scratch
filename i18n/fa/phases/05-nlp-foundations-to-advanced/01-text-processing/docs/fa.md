# پردازش متن  نشان دادن، انتخاب، لمیت سازی

> زبان ادامه دارد، مدل ها متمایز هستند، پردازش پیش از انجام، پل است.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## مشکل

يه مدل نميتونه " گربه ها دوچرخه رو مي خوانند "

هر سیستم NLP با سه سوال مشابه آغاز می شود. یک کلمه از کجا شروع می شود. ریشه کلمه چیست. چگونه با "جنگ"، "جنگ"، "جنگ" به عنوان یک چیز در صورتی که کمک می کند، و به عنوان چیزهای متفاوت در صورتی که کمک نمی کند، رفتار می کنیم؟

اگه توکنيزيشن اشتباه بشه مدل از زباله ياد ميگيرد`don't`به عنوان یک نشانه اما`do n't`دو تا، توزیع آموزش تقسیم می شود.`organization`و`organ`اگر لمیتیزر شما به یک بخش از زمینه گفتار نیاز دارد اما شما آن را به دست نمی آورید، فعل ها به عنوان اسم ها در نظر گرفته می شوند.

این درس سه مرحله پیش پردازش را از ابتدا می سازد، سپس نشان می دهد که چگونه NLTK و spaCy کار مشابهی را انجام می دهند تا بتوانید معامله را ببینید.

## مفهوم

سه عملیات هر کدام یک شغل و یک حالت شکست دارند

**Tokenization**"توکین" عمدا مبهم است زیرا غلظت درست بستگی به کار دارد. سطح کلمه برای NLP کلاسیک. زیر کلمه برای ترانسفورماتورها. شخصیت برای زبان های بدون فضای سفید.

**Stemming**.کارت ها با قوانين ها`running -> run`.`organization -> organ`. اون دومين حالت شکست

**Lemmatization**یک کلمه را به شکل لغت خود با استفاده از دانش گرامر کاهش می دهد. آهسته تر، دقیق تر، نیاز به یک جدول جستجو یا تحلیلگر مورفولوژیکی دارد. `ran -> run`(بايد بدونم "رن" زمان گذشته "رن"ه)`better -> good`(به نیاز به دانستن فرم های مقایسه ای)

قاعده انگشت. وقتی سرعت مهم است و می توانید شور را تحمل کنید (درخشش جستجو، طبقه بندی خشن). وقتی معنی مهم است (پاسخ دادن به سوال، جستجوی معنوی، هر چیزی که کاربر می خواند) ، لیماتیز کنید.

```figure
edit-distance
```

## آن را بسازید

### مرحله اول: یک رمزنگاری کننده کلمه regex

ساده ترین توکنيزر مفید به صورت حروف غیر الفانومری تقسیم می شود و در عین حال نقطه بندی را به عنوان توکن های خود حفظ می کند. کامل نیست، نه نهایی، اما در یک خط اجرا می شود.

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

سه الگوی در ترتیب اولویت.`don't`،`it's`) اعداد خالص. هر یک از غیر فضای سفید غیر الفانومریک به عنوان یک نماد مستقل (نقطه بندی).

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

حالت شکست برای تشخیص`3pm`به قسمت دوم تقسیم می شه`['3', 'pm']`چون ما بین خطوط و اعداد متناوب بودیم. برای اکثر کارها کافی است. URL ها، ایمیل ها، هشتگ ها همه شکسته می شوند. برای تولید، قبل از الگوهای عمومی، الگوهای اضافه شده را اضافه کنید.

### مرحله دوم: یک پورتر stemmer (تنها مرحله 1a)

الگوریتم پورتر کامل دارای پنج مرحله از قوانین است. مرحله 1a تنها شامل شایع ترین ضمیر های انگلیسی و الگوی را آموزش می دهد.

```python
def stem_step_1a(word):
    if word.endswith("sses"):
        return word[:-2]
    if word.endswith("ies"):
        return word[:-2]
    if word.endswith("ss"):
        return word
    if word.endswith("s") and len(word) > 1:
        return word[:-1]
    return word
```

```python
>>> [stem_step_1a(w) for w in ["caresses", "ponies", "caress", "cats"]]
['caress', 'poni', 'caress', 'cat']
```

قوانین رو از بالا تا پایین بخونید`ies -> i`قانون اينه که چرا`ponies -> poni`نه`pony`.پورتر واقعي قدم اول ب رو داره که ميخواد درستش کنه قوانين رقابت ميکنه قوانين قبلی برنده ميشه

### مرحله سوم: یک لمیتیزر مبتنی بر جستجو

لمیتاسیون مناسب نیاز به مورفولوژی دارد. یک نسخه آموزشی قابل کنترل از یک جدول لمی کوچک و یک عقب نشینی استفاده می کند.

```python
LEMMA_TABLE = {
    ("running", "VERB"): "run",
    ("ran", "VERB"): "run",
    ("runs", "VERB"): "run",
    ("better", "ADJ"): "good",
    ("best", "ADJ"): "good",
    ("cats", "NOUN"): "cat",
    ("cat", "NOUN"): "cat",
    ("were", "VERB"): "be",
    ("was", "VERB"): "be",
    ("is", "VERB"): "be",
}

def lemmatize(word, pos):
    key = (word.lower(), pos)
    if key in LEMMA_TABLE:
        return LEMMA_TABLE[key]
    if pos == "VERB" and word.endswith("ing"):
        return word[:-3]
    if pos == "NOUN" and word.endswith("s"):
        return word[:-1]
    return word.lower()
```

```python
>>> lemmatize("running", "VERB")
'run'
>>> lemmatize("cats", "NOUN")
'cat'
>>> lemmatize("better", "ADJ")
'good'
>>> lemmatize("watched", "VERB")
'watched'
```

آخرین مورد، لحظه ی کلیدی آموزش است.`watched`اون توي ميزمون نيست و عقب نشيني ما فقط دستش رو ميگيره`ing`. لمیتیزاسیون واقعی پوشش میده`ed`، فعل های نامنظم، صفت های مقایسه ای، جمع بندی با تغییر صوتی (`children -> child`) به همین دلیل سیستم های تولید از WordNet، مورفولوژیک اسپاسی یا یک تحلیلگر مورفولوژیک کامل استفاده می کنند.

### مرحله 4: آنها را به هم ببندید

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

قطعه گمشده یک برچسب POS است. مرحله 5 · 07 (POS Tagging) یک را ایجاد می کند. برای حال، همه چیز به طور پیش فرض به `NOUN`و محدودیت ها رو بپذیری

## ازش استفاده کن

NLTK و spaCy نسخه های تولید رو میفرستن چند خط هر کدام

### NLTK

```python
import nltk
nltk.download("punkt_tab")
nltk.download("wordnet")
nltk.download("averaged_perceptron_tagger_eng")

from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer, WordNetLemmatizer
from nltk import pos_tag

text = "The cats were running."
tokens = word_tokenize(text)
stems = [PorterStemmer().stem(t) for t in tokens]
lemmatizer = WordNetLemmatizer()
tagged = pos_tag(tokens)


def nltk_pos_to_wordnet(tag):
    if tag.startswith("V"):
        return "v"
    if tag.startswith("J"):
        return "a"
    if tag.startswith("R"):
        return "r"
    return "n"


lemmas = [lemmatizer.lemmatize(t, nltk_pos_to_wordnet(tag)) for t, tag in tagged]
```

`word_tokenize`.معاملات انقباضات، یونیکود، موارد حاشيه که ريگکس شما از دست ميده`PorterStemmer`تمام پنج مرحله رو اجرا مي کنه`WordNetLemmatizer`نیاز به برچسب POS ترجمه از طرح Penn Treebank NLTK به مجموعه اختصار WordNet. سیم کشی ترجمه بالا کمی بیشتر آموزش ها از دست می دهد.

### اسپاسی

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running.")

for token in doc:
    print(token.text, token.lemma_, token.pos_)
```

```
The      the     DET
cats     cat     NOUN
were     be      AUX
running  run     VERB
.        .       PUNCT
```

اسپاساي کل خط لوله رو پشت سرش پنهان ميکنه`nlp(text)`. توکن سازی، برچسب گذاری POS و لمیتاسیون همه اجرا می شوند. سریعتر از NLTK در مقیاس. دقیق تر از جعبه. معامله این است که شما نمی توانید به راحتی متبادله قطعات فردی.

### چه وقت انتخاب کن

| Situation | Pick |
|-----------|------|
| Teaching, research, swapping components | NLTK |
| Production, multi-language, speed matters | spaCy |
| Transformer pipeline (you'll tokenize with the model's tokenizer anyway) | Use `tokenizers` / `transformers` and skip classical preprocessing |

### دو حالت شکست هیچ کس شما را در مورد هشدار نمی دهد

بیشتر آموزش ها الگوریتم ها را آموزش می دهند و متوقف می شوند. دو چیز یک خط لوله پیش پردازش واقعی را می خندندند و تقریبا هرگز پوشش داده نمی شوند.

**Reproducibility drift.**NLTK و spaCy تغییر نشان دادن و رفتار lemmatizer بین نسخه ها.`['do', "n't"]`در spaCy 2.x ممکن است تولید کند`["don't"]`در 3.x مدل شما در یک توزیع آموزش دیده است. الان تعبیر در یک توزیع دیگر اجرا می شود. دقت به آرامی کاهش می یابد و هیچ کس نمی داند چرا. نسخه های کتابخانه پین در`requirements.txt`. يه تست بازپسين پيش از پردازش بنويسيد که نشاني هاي انتظار شده 20 جمله نمونه اي را منجمد کنه

**Training / inference mismatch.**آموزش با پردازش پیشگیری (کتابی کوچک، حذف کلمات متوقف، استیمینگ) ، استفاده از ورودی خام کاربر، کرتر عملکرد ساعت. این تنها شکست NLP تولید رایج است. اگر شما در طول آموزش پیش پردازش، شما باید عملکرد مشابه را در طول نتیجه گیری اجرا کنید. پیش پردازش را به عنوان یک عملکرد در داخل بسته مدل ارسال کنید، نه به عنوان یک سلول نوت بوک که تیم خدمت کننده دوباره می نویسد.

## -باده

یک پیامک قابل استفاده مجدد که به مهندسان کمک می کند بدون خواندن سه کتاب درسی یک استراتژی پیش پردازش را انتخاب کنند.

پس از`outputs/prompt-preprocessing-advisor.md`:

```markdown
---
name: preprocessing-advisor
description: Recommends a tokenization, stemming, and lemmatization setup for an NLP task.
phase: 5
lesson: 01
---

You advise on classical NLP preprocessing. Given a task description, you output:

1. Tokenization choice (regex, NLTK word_tokenize, spaCy, or transformer tokenizer). Explain why.
2. Whether to stem, lemmatize, both, or neither. Explain why.
3. Specific library calls. Name the functions. Quote the POS-tag translation if NLTK is involved.
4. One failure mode the user should test for.

Refuse to recommend stemming for user-visible text. Refuse to recommend lemmatization without POS tags. Flag non-English input as needing a different pipeline.
```

## تمرینات

1. **Easy.**طولاني`tokenize`برای نگه داشتن URL ها به عنوان توکن های تک. آزمون: `tokenize("Visit https://example.com today.")`باید یک توکن URL تولید کند.
2. **Medium.**مرحله 1ب را اجرا کنید. اگر یک کلمه حاوی یک صوتی باشد و به `ed`یا`ing`، ازش کن.`hopping -> hop`نه`hopp`)
3. **Hard.**یک lemmatizer بسازید که از WordNet به عنوان یک جدول جستجو استفاده می کند اما وقتی WordNet هیچ ورودی ندارد به رای پورتر شما برمی گردد. دقت را در یک کورپوس برچسب شده با WordNet و Porter ساده اندازه گیری کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Token | A word | Whatever unit the model consumes. Can be word, subword, character, or byte. |
| Stem | Root of a word | Result of rule-based suffix stripping. Not always a real word. |
| Lemma | Dictionary form | The form you'd look up. Requires grammatical context to compute correctly. |
| POS tag | Part of speech | Category like NOUN, VERB, ADJ. Needed to lemmatize accurately. |
| Morphology | Word shape rules | How a word changes form based on tense, number, case. Lemmatization depends on it. |

## خواندن بیشتر

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt) مقاله اصلی، پنج صفحه، هنوز هم روشن ترین توضیح.
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) چگونه یک خط لوله واقعی به سیم متصل می شود.
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html) پرونده های کناره ی توکن سازی که هنوز به آن فکر نکرده ای
