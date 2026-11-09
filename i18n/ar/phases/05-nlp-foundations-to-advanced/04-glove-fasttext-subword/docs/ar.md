# غلوف، فاست تكست، و إدخال الكلمات الفرعية

> قام Word2Vec بتدريب إضافة واحدة لكل كلمة. قام GloVe بتحليل المصفوفة المشتركة. قام FastText بتدريب الأجزاء. وصل BPE إلى المحولات.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec from Scratch)
**Time:** ~45 minutes

## المشكلة

كلمة2فيك تركت سؤالين مفتوحين

أولاً ، كان هناك خط متوازي من البحوث الذي يعدل معامل التواصل المباشر (LSA ، HAL) بدلاً من إجراء تحديثات المخططات عبر الإنترنت. هل كان نهج Word2Vec المتكرر أفضل أساساً ، أم أن الفرق كان عبارة عن عبارة عن طريقة التعامل مع الطرقين تعتبر مهمة؟ **GloVe**أجاب: تعديل المصفوفات مع خسرة مختارة بعناية تطابق أو تفوق Word2Vec، وتكلفة أقل للتدريب.

ثانياً، لم يكن لدى أي منهج قصة لأقوال لم يسبق له رؤيتها.`Zoomer-approved`،`dogecoin`، أي اسم مناسب تم اختراع الأسبوع الماضي، كل شكل مُلتف من جذور نادرة**FastText**وصلح هذا من خلال إدراج حرف n-جرام: كلمة هو مجموع أجزائها، بما في ذلك المورفيمات، حتى الكلمات خارج المفردات الحصول على متجه معقول.

ثالثا، بمجرد وصول المحولين، تغيرت السؤال مرة أخرى. قاموس مستوى الكلمات يحتوي على حوالي مليون إدخال؛ اللغة الحقيقية أكثر انفتاحا من ذلك. **Byte-pair encoding (BPE)**و حل أقاربها هذا عن طريق تعلم المفردات من الوحدات الفرعية المتكررة التي تغطي كل شيء. كل رمز الحديث لكل ماجستير في العلوم الحديثة هو رمز الفرعية.

هذا الدروس يذهب على كل ثلاثة، ثم يشرح ما يجب الوصول إلى متى.

## المفهوم

**GloVe (Global Vectors).**بناء المصفوفة المشتركة الكلمة الكلمة`X`أين`X[i][j]`كم مرة كلمة `j`يظهر في سياق كلمة `i`. متجهات القطار مثل هذه`v_i · v_j + b_i + b_j ≈ log(X[i][j])`الوزن الخسارة كثيراً لا تهيمن على الأزواج

**FastText.**كلمة هي مجموع حرفها n-جرام زائد الكلمة نفسها. `where`يصبح`<wh, whe, her, ere, re>, <where>`. المتجه الكلام هو مجموع المتجهات المكونة. تدريب ك Word2Vec.`whereupon`) تتكون من ن-جرام معروفة.

**BPE (Byte-Pair Encoding).**ابدأ بمفردة من البايتات الفردية (أو الأحرف). احتسب كل زوج مجاور في الجسم. دمج الزوج الأكثر شيوعا في رمز جديد. كرر ل `k`التكرار. النتيجة: مجموعة من رموز الأساس بالإضافة `k`الاندماج (`k + 256`الوهم عندما تبدأ من البايت) حيث التسلسلات المتكررة (`ing`،`tion`،`the`(ج) هي رموز منفردة و الكلمات النادرة يتم تحديدها إلى قطع مألوفة. كل جملة تعتبر رموز إلى شيء ما.

```figure
n5-subword-merge
```

## بناءها

### GloVe: تصنيف ماتريكس المواجهة

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

اثنين من قطع التحرك التي تستحق الإسم`f(x) = (x/x_max)^alpha`الوزن المنخفضة أزواج متكررة جدا (مثل `(the, and)`) حتى لا يهيمنون على الخسارة.`W`(في المركز) و `W_tilde`الجداول. جمع كل منهما هو خدعة نشرت التي تميل إلى أن تتفوق باستخدام واحدة فقط.

### FastText: إضافة مدروسة للكلمات الفرعية

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

يتم تمثيل كل كلمة بمجموعة من n-جرام (عادة 3 إلى 6 أحرف). يتمثل كلمة تضمين في مجموع تضميناتها n-جرام. للتدريب على تخطي الجرام، قم بتضمين هذا حيث استخدم Word2Vec متجه واحد.

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

بالنسبة لكلمة غير مرئية، لا تزال تحصل على متجه طالما بعض من ن-جرامها معروفة. `whereupon`الأسهم`<wh`،`her`،`ere`و`<where`مع`where`، لذا فإنّهما يصلان بالقرب من بعضهما البعض

### BPE: تعلّم لغة الكلمات الفرعية

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

التكرار الأول يدمج الزوج المجاور الأكثر شيوعا. بعد التكرار الكافي،`low`،`est`،`tion`(ج) تصبح رموز واحدة والكلمات النادرة تتحطم بشكل واضح.

يتعلم مؤشر GPT / BERT / T5 الحقيقي 30k-100k الاندماج. النتيجة: يتم توكيين أي نص إلى تسلسل طويل محدود من الهويات المعروفة ، لا OOV أبدا.

## استخدمها

في الممارسة، نادراً ما تدرب أي من هذه بنفسك.

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

للتعلامات الفرعية على النمط BPE في عصر المحول:

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

- نعم`Ġ`يرمز المرفق إلى حدود الكلمات (اتفاقية GPT-2). كل رمز حديث هو متغير BPE ، WordPiece (BERT) ، أو SentencePiece (T5 ، LLaMA).

### متى لا تختار أي

| Situation | Pick |
|-----------|------|
| Pretrained general-purpose word vectors, no OOV tolerance needed | GloVe 300d |
| Pretrained general-purpose word vectors, must handle misspellings / neologisms / morphologically rich languages | FastText |
| Anything going into a transformer (training or inference) | Whatever tokenizer the model shipped with. Never swap. |
| Training your own language model from scratch | Train a BPE or SentencePiece tokenizer on your corpus first |
| Production text classification with a linear model | Still TF-IDF. Lesson 02. |

## أرسله

إبقوا`outputs/skill-embeddings-picker.md`:

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

## التمارين

1. **Easy.**أركض`char_ngrams("playing")`و`char_ngrams("played")`.حسب التداخل جاكارد من مجموعتين n-جرام. يجب أن ترى قطع مشتركة كبيرة (`pla`،`lay`،`play`() ، ولهذا السبب يتم نقل FastText بشكل جيد بين المتغيرات المورفولوجية.
2. **Medium.**التمديد`learn_bpe`لتتبع نمو المفردات. رسم الرموز لكل حرف كعمل من عدد الاندماج. يجب أن ترى ضغط سريع في البداية، كما يختص تقريبا 2-3 رموز لكل رموز.
3. **Hard.**قم بتدريب الـ 1K-BPE على أعمال شكسبير الكاملة، قارن رمزية الكلمات الشائعة مقابل الكلمات النادرة، قم بتقييم متوسط الـ Tokens لكل كلمة قبل وبعد ذلك، اكتب ما فاجأك.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Co-occurrence matrix | Word-word frequency table | `X[i][j]` = how often word `j` appears in a window around word `i`. |
| Subword | Piece of a word | A character n-gram (FastText) or learned token (BPE/WordPiece/SentencePiece). |
| BPE | Byte-pair encoding | Iterative merging of most-frequent adjacent pairs until vocabulary hits target size. |
| OOV | Out of vocabulary | Word the model has never seen. Word2Vec/GloVe fail. FastText and BPE handle it. |
| Byte-level BPE | BPE on raw bytes | GPT-2's scheme. Vocabulary starts with 256 bytes, so nothing is ever OOV. |

## المزيد من القراءة

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf)ورقة "جلوف" ، سبعة صفحات، لا تزال أفضل مشتق للخسارة.
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) FastText
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) الورقة التي أدّت إلى BPE إلى النشاط النووي الحديث.
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) كيف تختلف BPE و WordPiece و SentencePiece في الواقع في الممارسة العملية.
