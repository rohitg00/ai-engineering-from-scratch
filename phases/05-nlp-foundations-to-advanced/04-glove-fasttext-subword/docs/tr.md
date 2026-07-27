# GloVe, FastText ve Alt Kelime Embedding'ler

> Word2Vec kelime başına bir embedding eğitti. GloVe, birlikte meydana gelme matrisini çarpanlara ayırdı. FastText parçaları yerleştirdi. BPE, transformer'lara köprülendi.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 5 · 03 (Scratch'ten Word2Vec)
**Süre:** ~45 dakika

## Sorun

Word2Vec iki açık soru bıraktı.

İlk olarak, çevrimiçi atlama gramı güncellemeleri yapmak yerine, eş-oluşma matrisini doğrudan (LSA, HAL) çarpanlara ayıran paralel bir araştırma çizgisi vardı. Word2Vec'in yinelemeli yaklaşımı temelde daha mı iyiydi, yoksa iki yöntemin sayımları ele alma biçimi arasındaki artifact fark mıydı? **GloVe** şunu yanıtladı: özenle seçilmiş bir kayıpla matris çarpanlarına ayırma, Word2Vec'le eşleşir veya onu yener ve eğitim maliyeti daha azdır.

İkincisi, her iki yöntemin de daha önce hiç görmediği kelimelerle ilgili bir hikayesi yoktu. `Zoomer-approved`, `dogecoin`, geçen hafta türetilen herhangi bir özel isim, nadir bir kökün tüm çekimli biçimleri. **FastText** bunu embedding karakter n-gramıyla düzeltti: Bir kelime, morfemler de dahil olmak üzere parçalarının toplamıdır, dolayısıyla sözlükte yer almayan kelimeler bile anlamlı bir vektör alır.

Üçüncüsü, transformers geldiğinde soru yeniden değişti. Kelime düzeyindeki sözcük dağarcığı yaklaşık bir milyon girişi kapsıyor; gerçek dil bundan daha açıktır. **Bayt çifti kodlama (BPE)** ve akrabaları, her şeyi kapsayan, sık kullanılan alt kelime birimlerinden oluşan bir kelime dağarcığı öğrenerek bu sorunu çözdü. Her modern LLM için her modern tokenizer, bir tokenizer alt kelimesidir.

Bu derste üçü de anlatılıyor, ardından hangisine ne zaman ulaşılması gerektiği açıklanıyor.

## Konsept

**GloVe (Küresel Vektörler).** `X` kelime-kelime birlikte oluşum matrisini oluşturun; burada `X[i][j]`, `j` kelimesinin `i` kelimesi bağlamında ne sıklıkta göründüğünü gösterir. Vektörleri `v_i · v_j + b_i + b_j ≈ log(X[i][j])` sağlayacak şekilde eğitin. Ağırlık kaybı o kadar sık ​​görülür ki çiftler baskın olmaz. Tamamlamak.

**Hızlı Metin.** Bir kelime, karakter n gramı artı kelimenin kendisinin toplamıdır. `where`, `<wh, whe, her, ere, re>, <where>` olur. Vektör kelimesi bu bileşen vektörlerinin toplamıdır. Word2Vec olarak eğitin. Faydası: görünmeyen kelimeler (`whereupon`) bilinen n-gramlardan oluşur.

**BPE (Byte-Pair Encoding; bayt çifti kodlama).** Tek tek baytlardan (veya karakterlerden) oluşan bir vocabulary ile başlayın. Corpus'taki her bitişik çifti sayın. En sık çifti yeni bir token'da birleştirin. Bunu `k` yineleme boyunca tekrarlayın. Sonuçta `k + 256` token'lık bir vocabulary oluşur; `ing`, `tion` ve `the` gibi sık diziler tek token olurken nadir sözcükler tanıdık parçalara ayrılır. Böylece her cümle mutlaka token'lara dönüştürülebilir.

## İnşa Et

### GloVe: birlikte oluşum matrisini çarpanlara ayırın

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

Adlandırmaya değer iki hareketli parça. Ağırlıklandırma fonksiyonu `f(x) = (x/x_max)^alpha`, çok sık görülen çiftlerin (`(the, and)` gibi) ağırlığını azaltır, böylece kayıpta baskın olmazlar. Son embedding, `W` (orta) ve `W_tilde` (bağlam) tablolarının toplamıdır. Her ikisini de toplamak, yalnızca birini kullanarak daha iyi performans gösterme eğiliminde olan yayınlanmış bir hiledir.

### FastText: alt kelimeye duyarlı embedding'lar

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

Her sözcük kendi n-gram kümesiyle (genellikle 3 ila 6 karakter) temsil edilir. embedding kelimesi, n-gram embedding'lerinin toplamıdır. Gram atlama eğitimi için bunu Word2Vec'in tek bir vektör kullandığı yere takın.

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

Görünmeyen bir kelime için, bazı n-gramları bilindiği sürece yine de bir vektör elde edersiniz. `whereupon`, `<wh`, `her`, `ere` ve `<where`'yi `where` ile paylaşır, böylece ikisi birbirine yakınlaşır.

### BPE: öğrenilmiş alt kelime sözlüğü

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

İlk yineleme en yaygın bitişik çifti birleştirir. Yeterli yinelemeden sonra sık görülen alt diziler (`low`, `est`, `tion`) tekli token'lere dönüşür ve nadir sözcükler temiz bir şekilde bölünür.

Gerçek GPT / BERT / T5 tokenizer'ler 30k-100k birleştirmeleri öğrenir. Sonuç: herhangi bir metin tokenbilinen kimliklerin sınırlı uzunluklu bir dizisine dönüşür, hiçbir zaman OOV olmaz.

## Kullan onu

Pratikte bunlardan herhangi birini nadiren kendiniz eğitirsiniz. Önceden eğitilmiş kontrol noktalarını yüklersiniz.

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

transformer döneminde BPE tarzı alt kelime tokenoluşturulması için:

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

`Ġ` öneki sözcük sınırlarını işaretler (bir GPT-2 kuralı). Her modern tokenizer bir BPE çeşididir, WordPiece (BERT) veya SentencePiece (T5, LLaMA).

### Hangisini ne zaman seçmeli

| Durum | Seç |
|-----------|------|
| Önceden eğitilmiş genel amaçlı kelime vektörleri, OOV toleransı gerekmez | Eldiven 300d |
| Önceden eğitilmiş genel amaçlı kelime vektörleri, yazım hatalarını / yeni sözcükleri / morfolojik açıdan zengin dilleri ele almalıdır | Hızlı Metin |
| transformer (eğitim veya inference) | Model neyle birlikte gönderilirse tokenizer ne olursa olsun. Asla takas yapmayın. |
| Kendi dil modelinizi sıfırdan eğitmek | Önce kendi külliyatınızda bir BPE veya SentencePiece tokenizer eğitin |
| Doğrusal modelle üretim metni sınıflandırması | Hala TF-IDF. Ders 02. |

## Gönderin

`outputs/skill-embeddings-picker.md` olarak kaydet:

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

1. **Kolay.** `char_ngrams("playing")` ve `char_ngrams("played")`'yi çalıştırın. İki n-gram kümesinin Jaccard örtüşmesini hesaplayın. Önemli miktarda paylaşılan parçalar görmelisiniz (`pla`, `lay`, `play`), bu nedenle FastText morfolojik değişkenler arasında iyi aktarım yapar.
2. **Orta.** Kelime dağarcığının gelişimini izlemek için `learn_bpe` öğesini genişletin. Birleştirme sayısının bir fonksiyonu olarak derlem başına karakter başına tokens grafiğini çizin. İlk başta hızlı sıkıştırmayı, token başına yaklaşık ~2-3 karakter asimptotu görmelisiniz.
3. **Zor.** Shakespeare'in tüm eserleri üzerinde 1k birleştirme BPE'si eğitin. Yaygın kelimelerin tokenoluşturulmasını nadir özel isimlerle karşılaştırın. Önceki ve sonraki kelime başına ortalama token sayısını ölçün. Sizi şaşırtan şeyleri yazın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Eş-oluşma matrisi | Kelime kelime sıklık tablosu | `X[i][j]` = `j` kelimesinin, `i` kelimesinin etrafındaki bir pencerede ne sıklıkta göründüğü. |
| Alt Kelime | Tek kelimeyle | Bir karakter n-gramı (FastText) veya öğrenilmiş token (BPE/WordPiece/SentencePiece). |
| BPE | Bayt çifti kodlama | Kelime dağarcığı hedef boyuta ulaşana kadar en sık kullanılan bitişik çiftlerin yinelemeli birleştirilmesi. |
| OOV | Kelime dağarcığı dışında | Modelin hiç görmediği kelime. Word2Vec/GloVe başarısız. FastText ve BPE bunu halleder. |
| Bayt düzeyinde BPE | Ham baytlarda BPE | GPT-2'nin şeması. Kelime dağarcığı 256 baytla başlar, dolayısıyla hiçbir şey asla OOV değildir. |

## Daha Fazla Okuma

- [Pennington, Socher, Manning (2014). GloVe: Kelime Temsili için Global Vektörler](https://nlp.stanford.edu/pubs/glove.pdf) — GloVe makalesi, yedi sayfa, hala kaybın en iyi türetimi.
- [Bojanowski ve ark. (2017). Kelime Vektörlerini Alt Kelime Bilgileriyle Zenginleştirme](https://arxiv.org/abs/1607.04606) — FastText.
- [Sennrich, Haddow, Birch (2016). Alt Kelime Birimleriyle Nadir Kelimelerin Nöral Makine Çevirisi](https://arxiv.org/abs/1508.07909) — BPE'yi modern NLP'ye tanıtan makale.
- [Sarılma Yüzü tokenizer özeti](https://huggingface.co/docs/transformers/tokenizer_summary) — BPE, WordPiece ve SentencePiece'in pratikte gerçekte ne kadar farklı olduğu.
