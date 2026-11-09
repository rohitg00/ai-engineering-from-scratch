# GloVe، FastText و زیرکلمه ها

> Word2Vec یک کاربری را در هر کلمه آموزش داد. GloVe ماتریس هم وقوع را فاکتور کرد. FastText قطعات را دربرگرفت. BPE به ترانسفورماتورها پرداخته شد.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec from Scratch)
**Time:** ~45 minutes

## مشکل

Word2Vec دو سوال باز گذاشت

اول، یک خط موازی از تحقیقات وجود داشت که به جای انجام بروزرسانی های آنلاین از طریق گراف عبور، ماتریس هم وقوع را مستقیماً (LSA، HAL) فاکتور می کرد. آیا رویکرد تکراری Word2Vec اساساً بهتر بود یا تفاوت یک آرتیفاکت از نحوه مدیریت دو روش حساب می شد؟**GloVe**پاسخ داده شد: فاکتور سازی ماتریک با یک ضرر با دقت انتخاب شده مطابقت دارد یا Word2Vec را می پیشه و هزینه کمتری برای آموزش دارد.

دوم، هیچ یک از روش ها داستان برای کلمات را نداشتند که هرگز ندیده بودند.`Zoomer-approved`،`dogecoin`، هر اسم مناسب که هفته گذشته اختراع شده ، هر شکل منحنی از یک ریشه نادر**FastText**این را با قرار دادن n-grams علامت درست کرد: یک کلمه مجموع قسمت های آن است، از جمله مورفیم ها، بنابراین حتی کلمات خارج از ذخایر لغات یک ویکتور منطقی را دریافت می کنند.

سوم، وقتی ترانسفارمر ها آمدند، سوال دوباره تغییر کرد. لغات های سطح کلمه حدود یک میلیون مطلب را پوشش می دهند؛ زبان واقعی باز تر از این است. **Byte-pair encoding (BPE)**و بستگانش با یادگیری یک لغت از واحد های فرکانس مکرر که همه چیز را پوشش می دهد این را حل کردند. هر توکنایزر مدرن برای هر LLM مدرن یک توکنایزر فرکانس است.

این درس سه تا را می گذرد و سپس توضیح می دهد که کدام یک را برای چه زمانی به دست آورید.

## مفهوم

**GloVe (Global Vectors).**ماتریس همدست شدن کلمه- کلمه را بسازید`X`کجا`X[i][j]`چقدر کلمه است`j`در متن کلمه ظاهر می شه`i`. متور های قطار مثل این`v_i · v_j + b_i + b_j ≈ log(X[i][j])`. وزن از دست دادن به طوری که جفت ها اغلب تسلط ندارند . تمام شد

**FastText.**یک کلمه مجموع n-گرام حرفش و خود کلمه است.`where`می شه`<wh, whe, her, ere, re>, <where>`. کلمه ویکتور مجموعه ی این ویکتورهای اجزای است.`whereupon`) از n-گرام شناخته شده تشکیل شده است.

**BPE (Byte-Pair Encoding).**با یک لغت باایت های فردی (یا شخصیت ها) شروع کنید. هر جفت در کنار هم را در کورپوس بشمارید. رایج ترین جفت را به یک رمز جدید ادغام کنید. برای تکرار `k`تکرار. نتیجه: یک لغت از نمادهای پایه پلاس `k`ادغام (`k + 256`توکن ها وقتی از بائیت شروع می کنید) جایی که دنباله های مکرر (`ing`،`tion`،`the`) نشان های تک و کلمات نادر به قطعات آشنا شکسته می شوند.

```figure
n5-subword-merge
```

## آن را بسازید

### گلوو: عامل سازی ماتریس هم وقوع

```python
import numpy as np
from collections import Counter


def build_cooccurrence(docs, window=5):
    pair_counts = Counter()
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    for doc in docs:
        indexed = [vocab[t] for t in doc]
        for i, center in enumerate(indexed):
            for j in range(max(0, i - window), min(len(indexed), i + window + 1)):
                if i != j:
                    distance = abs(i - j)
                    pair_counts[(center, indexed[j])] += 1.0 / distance
    return vocab, pair_counts


def glove_train(vocab, pair_counts, dim=16, epochs=100, lr=0.05, x_max=100, alpha=0.75, seed=0):
    n = len(vocab)
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(n, dim))
    W_tilde = rng.normal(0, 0.1, size=(n, dim))
    b = np.zeros(n)
    b_tilde = np.zeros(n)

    for epoch in range(epochs):
        for (i, j), x_ij in pair_counts.items():
            weight = (x_ij / x_max) ** alpha if x_ij < x_max else 1.0
            diff = W[i] @ W_tilde[j] + b[i] + b_tilde[j] - np.log(x_ij)
            coef = weight * diff

            grad_W_i = coef * W_tilde[j]
            grad_W_tilde_j = coef * W[i]
            W[i] -= lr * grad_W_i
            W_tilde[j] -= lr * grad_W_tilde_j
            b[i] -= lr * coef
            b_tilde[j] -= lr * coef

    return W + W_tilde
```

دو قطعه متحرک که ارزش نام دادن رو دارند`f(x) = (x/x_max)^alpha`وزن پایین دو تا بسیار مکرر (مانند `(the, and)`) بنابراین آنها بر ضرر تسلط ندارند.`W`(در مرکز) و`W_tilde`(تحتجه) جدول ها. جمع کردن هر دو یک از ترفند های منتشر شده است که با استفاده از فقط یک ترفند بهتر است.

### FastText: گنجانده شدن زیرکلمه های آگاه

```python
def char_ngrams(word, n_min=3, n_max=6):
    wrapped = f"<{word}>"
    grams = {wrapped}
    for n in range(n_min, n_max + 1):
        for i in range(len(wrapped) - n + 1):
            grams.add(wrapped[i:i + n])
    return grams
```

```python
>>> char_ngrams("where")
{'<where>', '<wh', 'whe', 'her', 'ere', 're>', '<whe', 'wher', 'here', 'ere>', '<wher', 'where', 'here>'}
```

هر کلمه توسط مجموعه n-grams (معمولا 3 تا 6 حرف) اش نشان داده می شود. کلمه ی گنجانده شده مجموعه ی گنجانده های n-gram است. برای آموزش skip-gram، این را در جایی که Word2Vec از یک ویکتور استفاده می کند وصل کنید.

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

برای یک کلمه ناشناخته، تا زمانی که برخی از n-گرام های آن شناخته شده است، شما هنوز یک ویکتور دریافت می کنید.`whereupon`سهام`<wh`،`her`،`ere`و`<where`با`where`، پس دوتا زمین نزدیک هم هستند

### BPE: لغات زیرکلمه آموخته شده

```python
def learn_bpe(corpus, k_merges):
    vocab = Counter()
    for word, freq in corpus.items():
        tokens = tuple(word) + ("</w>",)
        vocab[tokens] = freq

    merges = []
    for _ in range(k_merges):
        pair_freq = Counter()
        for tokens, freq in vocab.items():
            for a, b in zip(tokens, tokens[1:]):
                pair_freq[(a, b)] += freq
        if not pair_freq:
            break
        best = pair_freq.most_common(1)[0][0]
        merges.append(best)

        new_vocab = Counter()
        for tokens, freq in vocab.items():
            new_tokens = []
            i = 0
            while i < len(tokens):
                if i + 1 < len(tokens) and (tokens[i], tokens[i + 1]) == best:
                    new_tokens.append(tokens[i] + tokens[i + 1])
                    i += 2
                else:
                    new_tokens.append(tokens[i])
                    i += 1
            new_vocab[tuple(new_tokens)] = freq
        vocab = new_vocab
    return merges


def apply_bpe(word, merges):
    tokens = list(word) + ["</w>"]
    for a, b in merges:
        new_tokens = []
        i = 0
        while i < len(tokens):
            if i + 1 < len(tokens) and tokens[i] == a and tokens[i + 1] == b:
                new_tokens.append(a + b)
                i += 2
            else:
                new_tokens.append(tokens[i])
                i += 1
        tokens = new_tokens
    return tokens
```

```python
>>> corpus = Counter({"low": 5, "lower": 2, "newest": 6, "widest": 3})
>>> merges = learn_bpe(corpus, k_merges=10)
>>> apply_bpe("lowest", merges)
['low', 'est</w>']
```

اولین تکرار مشترک ترین جفت همسایه را ترکیب می کند. پس از تکرار های کافی، زیر رشته های مکرر (`low`،`est`،`tion`) تبدیل به نماد های تک و کلمات نادر به طور تمیز شکسته می شوند.

توکن های واقعی GPT / BERT / T5 از 30k-100k ادغام یاد می گیرند. نتیجه: هر متن به یک ردیف با طول محدودی از شناسه های شناخته شده توکن می شود، هیچ OOV هرگز.

## ازش استفاده کن

در عمل، شما به ندرت هرکدوم از این ها را خودتان آموزش می دهید.

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

برای توکن سازی زیرکلمه های سبک BPE در عصر ترانسفورم:

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

.`Ġ`هر توکنایزر مدرن یک ویرانت BPE، WordPiece (BERT) یا SentencePiece (T5 ، LLaMA) است.

### چه وقت انتخاب کن

| Situation | Pick |
|-----------|------|
| Pretrained general-purpose word vectors, no OOV tolerance needed | GloVe 300d |
| Pretrained general-purpose word vectors, must handle misspellings / neologisms / morphologically rich languages | FastText |
| Anything going into a transformer (training or inference) | Whatever tokenizer the model shipped with. Never swap. |
| Training your own language model from scratch | Train a BPE or SentencePiece tokenizer on your corpus first |
| Production text classification with a linear model | Still TF-IDF. Lesson 02. |

## -باده

پس از`outputs/skill-embeddings-picker.md`:

```markdown
---
name: tokenizer-picker
description: Pick a tokenization approach for a new language model or text pipeline.
version: 1.0.0
phase: 5
lesson: 04
tags: [nlp, tokenization, embeddings]
---

Given a task and dataset description, you output:

1. Tokenization strategy (word-level, BPE, WordPiece, SentencePiece, byte-level). One-sentence reason.
2. Vocabulary size target (e.g., 32k for an English-only LM, 64k-100k for multilingual).
3. Library call with the exact training command. Name the library. Quote the arguments.
4. One reproducibility pitfall. Tokenizer-model mismatch is the single most common silent production bug; call out which pair must be used together.

Refuse to recommend training a custom tokenizer when the user is fine-tuning a pretrained LLM. Refuse to recommend word-level tokenization for any model targeting production inference. Flag non-English / multi-script corpora as needing SentencePiece with byte fallback.
```

## تمرینات

1. **Easy.**فرار کن`char_ngrams("playing")`و`char_ngrams("played")`. محاسبه جابجا شدن جکارد دو مجموعه n-گرام را محاسبه کنید. شما باید قطعات قابل توجهی مشترک را ببینید (`pla`،`lay`،`play`), که به همین دلیل است که FastText به خوبی در میان انواع مورفولوژیکی انتقال می دهد.
2. **Medium.**طولاني`learn_bpe`برای ردیابی رشد لغت. توکن ها را به عنوان یک تابع از تعداد ادغام ها نشان دهید. شما باید در ابتدا فشرده سازی سریع را ببینید، به طور ساده تقریباً 2-3 حرف در هر توکن.
3. **Hard.**یک BPE یک هزار متر را در اثر های کامل شکسپیر آموزش دهید. نشان دادن کلمات معمول با اسم های نادر را مقایسه کنید. نشان های متوسط هر کلمه را قبل و بعد از آن اندازه گیری کنید. آنچه را که شگفت زده شما کرده است بنویسید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Co-occurrence matrix | Word-word frequency table | `X[i][j]` = how often word `j` appears in a window around word `i`. |
| Subword | Piece of a word | A character n-gram (FastText) or learned token (BPE/WordPiece/SentencePiece). |
| BPE | Byte-pair encoding | Iterative merging of most-frequent adjacent pairs until vocabulary hits target size. |
| OOV | Out of vocabulary | Word the model has never seen. Word2Vec/GloVe fail. FastText and BPE handle it. |
| Byte-level BPE | BPE on raw bytes | GPT-2's scheme. Vocabulary starts with 256 bytes, so nothing is ever OOV. |

## خواندن بیشتر

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf) کاغذ گلوو، هفت صفحه، هنوز بهترین نتیجه ی از دست دادن است.
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) فاست تکست
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) مقاله ای که BPE را به NLP مدرن معرفی کرد.
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) چگونه BPE، WordPiece و SentencePiece در واقع در عمل متفاوت هستند.
