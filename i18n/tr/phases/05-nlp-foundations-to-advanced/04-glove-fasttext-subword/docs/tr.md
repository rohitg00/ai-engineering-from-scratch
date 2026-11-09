# GloVe, FastText ve Alt Sözcükler Ekleme

> Word2Vec, her kelime için bir yerleştirme eğitimi aldı. GloVe, eşleşme matrisini faktörleştirdi. FastText parçaları yerleştirdi. BPE transformatörlere köprü yaptı.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec from Scratch)
**Time:** ~45 minutes

## Sorun

Word2Vec iki açık soru bıraktı.

İlk olarak, online atlama grafikleri güncelleştirmek yerine, doğrudan (LSA, HAL) eşleşme matrisini faktörleştiren paralel bir araştırma hattı vardı. Word2Vec'in tekrarlayıcı yaklaşımı temelde daha iyi miydi, yoksa iki yöntemin nasıl işlediğinin farkı bir eser miydi?**GloVe**Bu nedenle, bu soruların cevapları: dikkatle seçilen bir kayıp ile matris faktörleşmesi Word2Vec'e eşleşir veya yenir ve eğitime daha az maliyet verir.

İkincisi, hiçbir yöntemin hiç görmediği kelimeler için bir hikayesi yoktu.`Zoomer-approved`- Evet .`dogecoin`, geçen hafta ortaya çıkan her isim, nadir bir kökenin her eğilen şekli.**FastText**Bu, karakter n-gramları yerleştirerek çözüldü: bir kelime, morfeme dahil olmak üzere parçalarının toplamıdır, bu yüzden kelime birikmesinden dışındaki kelimeler bile mantıklı bir vektör elde eder.

Üçüncü olarak, dönüştürücüler geldiğinde, soru tekrar değişti. Söz düzeyinde kelime havuzları yaklaşık bir milyon giriş kaplıyor; gerçek dil bundan daha açık. **Byte-pair encoding (BPE)**Bu, her modern LLM için bir modern tokenizerin bir alt sözcük tokenizer olduğunu gösteriyor.

Bu ders üçü de ele alır, sonra hangisine ne zaman ulaşmamız gerektiğini açıklar.

## Anlaşım

**GloVe (Global Vectors).**Söz-kelimenin eşleşme matrisi oluştur .`X`nerede`X[i][j]`Ne kadar sık sözcük`j`kelimenin bağlamında ortaya çıkar `i`- Tren vektörleri böyle`v_i · v_j + b_i + b_j ≈ log(X[i][j])`- Ağırlık kaybı, o kadar sık çiftler hakim değil.

**FastText.**Bir kelime, karakterinin n-gramlarının toplamı ve kelimenin kendisi.`where``<wh, whe, her, ere, re>, <where>`. Sözcük vektörü, bu bileşen vektörlerinin toplamıdır.`whereupon`) bilinen n-gramlardan oluşur.

**BPE (Byte-Pair Encoding).**Bireysel bayt (veya karakter) sözcükleri ile başlayın. Korpus'taki her yanlışı çift sayın. En sık gelen çiftleri yeni bir simgeye birleştirin.`k`Sonuç: temel sembollerin bir kelime birikimi artı `k`birleşmeler (`k + 256`(Baytlardan başlayan) frekanslı diziler (`ing`- Evet .`tion`- Evet .`the`) tek bir simge ve nadir kelimeler tanıdık parçalara ayrılır.

```figure
n5-subword-merge
```

## Yapın

### GloVe: eşleşme matrisini faktörleştir

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

İki hareketli parça isimlendirme değerinde.`f(x) = (x/x_max)^alpha`Çok sık çiftler (örneğin `(the, and)`) böylece kaybı etkilemez.`W`(merkezi) ve `W_tilde`(Kontext) tablolar. İkisini de toplamlamak, sadece bir tane kullanmakla daha iyi performans gösteren bir numara.

### FastText: Alt kelime bilgili yerleşimler

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

Her kelime n-gram kümesi (genellikle 3 ila 6 karakter) ile temsil edilir. Söz gömülmesi n-gram gömülmelerinin toplamıdır.

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

Görülmeyen bir kelime için, n-gramlarının belli olduğu sürece vektör elde edilir.`whereupon`paylar `<wh`- Evet .`her`- Evet .`ere`ve`<where`- Evet .`where`Bu yüzden ikisi birbirine yakın yere düştü.

### BPE: öğrenilen sözcük sözcükleri

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

İlk iterasyon en yaygın bitişik çiftleri birleştirir.`low`- Evet .`est`- Evet .`tion`) tek bir simge haline gelir ve nadir kelimeler temiz bir şekilde kırılır.

Gerçek GPT / BERT / T5 tokenizörleri 30k-100k birleşmeleri öğrenir. Sonuç: herhangi bir metin bilinen kimliklerin sınırlı uzunluklı bir dizisine tokenize edilir, hiçbir OOV yoktur.

## Kullan

Bu tür kontrol noktalarını çok nadiren kendiniz eğitirsiniz.

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

Transformer çağında BPE tarzı alt sözcük tokenizasyonu için:

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

- Evet .`Ġ`Önceden sözcük sınırları (GPT-2 bir konvansiyon) işaretler. Her modern tokenizer bir BPE varianti, WordPiece (BERT) veya SentencePiece (T5, LLaMA) dir.

### Hangisini seçmek için ne zaman

| Situation | Pick |
|-----------|------|
| Pretrained general-purpose word vectors, no OOV tolerance needed | GloVe 300d |
| Pretrained general-purpose word vectors, must handle misspellings / neologisms / morphologically rich languages | FastText |
| Anything going into a transformer (training or inference) | Whatever tokenizer the model shipped with. Never swap. |
| Training your own language model from scratch | Train a BPE or SentencePiece tokenizer on your corpus first |
| Production text classification with a linear model | Still TF-IDF. Lesson 02. |

## Gönder

- Kaydet .`outputs/skill-embeddings-picker.md`- ...

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

## Egzersizler

1. **Easy.**Çık .`char_ngrams("playing")`ve `char_ngrams("played")`İki n-gram kümesinin Jaccard örtüşmesini hesaplayın.`pla`- Evet .`lay`- Evet .`play`), bu nedenle FastText morfolojik variantlar arasında iyi bir şekilde aktarılır.
2. **Medium.**Uzaklaştırma`learn_bpe`Sözcük büyümesini izlemek için. Birleştirme sayısının fonksiyonu olarak her karakter başına simgeyi çiz. İlk başta hızlı bir sıkıştırma görmelisiniz, simptot olarak her simgeye yaklaşık 2-3 karakter.
3. **Hard.**Shakespeare'in bütün eserlerine 1k birleşim BPE eğit. Genel kelimelerin ortak isimlerle simgeleşmesini karşılaştır.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Co-occurrence matrix | Word-word frequency table | `X[i][j]` = how often word `j` appears in a window around word `i`. |
| Subword | Piece of a word | A character n-gram (FastText) or learned token (BPE/WordPiece/SentencePiece). |
| BPE | Byte-pair encoding | Iterative merging of most-frequent adjacent pairs until vocabulary hits target size. |
| OOV | Out of vocabulary | Word the model has never seen. Word2Vec/GloVe fail. FastText and BPE handle it. |
| Byte-level BPE | BPE on raw bytes | GPT-2's scheme. Vocabulary starts with 256 bytes, so nothing is ever OOV. |

## Daha Fazla Okumak

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf)- GloVe kağıdı, yedi sayfa, hala kaybın en iyi çıkışı.
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) FastText.
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) BPE'yi modern NLP'ye tanıtan makale.
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) BPE, WordPiece ve SentencePiece'nin pratikte nasıl farklı olduğunu.
