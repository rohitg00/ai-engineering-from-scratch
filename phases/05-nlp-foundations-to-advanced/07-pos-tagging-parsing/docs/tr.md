# POS Etiketleme ve Sözdizimsel Ayrıştırma

> Dilbilgisi bir süre modası geçmişti. Daha sonra her LLM işlem hattının yapılandırılmış çıkarımı doğrulaması gerekiyordu ve bu geri geldi.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 5 · 01 (Metin İşleme), Aşama 2 · 14 (Naive Bayes)
**Süre:** ~45 dakika

## Sorun

Ders 01, lemmatizasyonun konuşmanın bir parçası etiketine ihtiyaç duyduğunu vaat ediyordu. `running`'nin bir fiil olduğunu bilmeden, bir lemmatizer onu `run`'ye indirgeyemez. `better`'nin bir sıfat olduğunu bilmeden `good`'ye indirgenemez.

Bu söz bütün bir alt alanı gizledi. Konuşma bölümü etiketlemesi dil bilgisi kategorilerini atar. Sözdizimsel ayrıştırma, cümlenin ağaç yapısını kurtarır: hangi kelime hangisini değiştirir, hangi fiil hangi argümanları yönetir. Klasik NLP her ikisini de geliştirmek için yirmi yıl harcadı. Daha sonra deep learning, bunları önceden eğitilmiş bir transformer'nin üstüne bir token sınıflandırma görevine daralttı ve araştırma topluluğu yoluna devam etti.

Uygulanan topluluk değil. Her yapılandırılmış çıkarma hattı hala POS ve bağımlılık ağaçlarını kullanıyor. LLM tarafından oluşturulan JSON, gramer kısıtlamalarına göre doğrulanır. Soru yanıtlama sistemleri, bağımlılık ayrıştırmalarını kullanarak sorguları ayrıştırır. Makine çevirisi kalitesi değerlendiricileri ayrıştırma ağaçlarının hizalamasını kontrol eder.

Bilmeye değer. Bu derste etiket kümeleri, taban çizgileri ve sıfırdan uygulamayı bırakıp spaCy'yi çağırdığınız nokta tanıtılmaktadır.

## Konsept

**POS etiketleme** her token'yi bir gramer kategorisiyle etiketler. **Penn Treebank (PTB)** etiket seti İngilizce varsayılandır. Sıradan okuyucunun titiz bulduğu ayrımları içeren 36 etiket: `NN` tekil isim, `NNS` çoğul isim, `NNP` tekil özel isim, `VBD` fiil geçmiş zaman, `VBZ` fiil 3. tekil şimdiki zaman vb. **Evrensel Bağımlılıklar (UD)** etiket kümesi daha geneldir (17 etiket) ve dilden bağımsızdır; diller arası çalışmanın varsayılanı haline geldi.

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**Sözdizimsel ayrıştırma** bir ağaç oluşturur. İki ana stil:

- **Seçim bölgesi ayrıştırma.** İsim tamlamaları, fiil tamlamaları, edat tamlamaları birbirinin içinde yuvalanır. Çıktı, kelimelerin yaprak şeklinde olduğu, terminal olmayan kategorilerin (NP, VP, PP) bir ağacıdır.
- **Bağımlılık ayrıştırma.** Her kelimenin bağlı olduğu, dilbilgisel bir ilişkiyle etiketlenmiş tek bir baş kelimesi vardır. Çıktı, her kenarın bir (baş, bağımlı, ilişki) üçlüsü olduğu bir ağaçtır.

Bağımlılık ayrıştırma 2010'larda kazandı çünkü diller arasında, özellikle de serbest kelime düzenine sahip olanlar arasında net bir şekilde genelleme yapıyor.

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

## İnşa Et

### 1. Adım: en sık kullanılan etiket temel çizgisi

Çalışan en aptal POS etiketleyici. Her kelime için eğitimde en sık kullanılan etiketi tahmin edin.

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

Brown derleminde bu temel değer ~%85 doğruluğa ulaşıyor. İyi değil ama hiçbir ciddi modelin altına düşmemesi gereken zemin.

### Adım 2: bigram HMM etiketleyici

Dizinin ortak olasılığını modelleyin:

```
P(tags, words) = prod P(tag_i | tag_{i-1}) * P(word_i | tag_i)
```

İki tablo: geçiş olasılıkları (önceki etiket verilen etiket), emisyon olasılıkları (etiket verilen kelime). Her ikisini de Laplace yumuşatma ile sayımlardan tahmin edin. Viterbi ile kod çözme (etiket kafesi üzerinden dinamik programlama).

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

Brown'daki Bigram HMM ~%93 doğruluğa ulaşıyor. %85'ten %93'e sıçrama çoğunlukla geçiş olasılıklarından kaynaklanıyor; model, `DET NOUN`'nin yaygın, `NOUN DET`'nin ise nadir olduğunu öğreniyor.

### 3. Adım: Modern etiketleyiciler bunu neden yendi?

Geçiş + emisyon olasılıkları yereldir. `saw`'nin "testere satın aldım" cümlesindeki bir isim, "Filmi gördüm" cümlesindeki fiil olduğunu kavrayamıyorlar. Rastgele özelliklere sahip bir CRF (sonek, kelime şekli, kelimenin öncesi ve sonrası, kelimenin kendisi) ~%97'ye ulaşır. BiLSTM-CRF veya transformer ~%98+ değerine ulaşır.

Bu görevin tavanı, açıklama yapanların anlaşmazlığıyla belirlenir. İnsan yorumcular Penn Treebank hakkında %97 oranında hemfikir. %98'i aşan modeller muhtemelen test setine fazlasıyla uyuyor.

### Adım 4: bağımlılık ayrıştırma taslağı

Sıfırdan tam bağımlılık ayrıştırma kapsam dışındadır; kanonik ders kitabı muamelesi Jurafsky ve Martin'dedir. Bilinmesi gereken iki klasik aile:

- **Geçiş tabanlı** ayrıştırıcılar (yay istekli, yay standardı) kaydırma-azaltma ayrıştırıcısı gibi davranır: token'leri okur, bunları bir yığına kaydırır ve yaylar oluşturan azaltma eylemlerini uygular. Açgözlü kod çözme hızlıdır. Klasik uygulama MaltParser'dır. Modern sinirsel versiyon: Chen ve Manning'in geçiş tabanlı ayrıştırıcısı.
- **Grafik tabanlı** ayrıştırıcılar (Eisner algoritması, Dozat-Manning biaffine) mümkün olan her başa bağımlı kenarı puanlar ve maksimum yayılan ağacı seçer. Daha yavaş ama daha doğru.

Uygulamalı işlerin çoğu için spaCy'yi arayın:

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

`dep` sütununu aşağıdan yukarıya doğru okuduğunuzda cümlenin gramer yapısı ortaya çıkar.

## Kullan onu

Her üretim NLP kütüphanesi, standart bir işlem hattının parçası olarak POS ve bağımlılık ayrıştırıcılarını gönderir.

- **spaCy** (`en_core_web_sm` / `md` / `lg` / `trf`). Hızlı, doğru, tokenizasyon + NER + lemmatizasyon ile entegre. `token.tag_` (Penn), `token.pos_` (UD), `token.dep_` (bağımlılık ilişkisi).
- **Stanford NLP (dörtlük)**. Stanford'un CoreNLP'nin halefi. 60'tan fazla dilde son teknoloji.
- **trank**. Transformer tabanlı, iyi UD doğruluğu.
- **NLTK**. `pos_tag`. Kullanılabilir, yavaş, eski. Öğretmenlik için iyi.

### 2026'da bunun hala önemli olduğu yer

- **Lemmatizasyon.** Ders 01'in doğru şekilde lemmatize edilmesi için POS'a ihtiyaç vardır. Her zaman.
- **LLM çıktılarından yapılandırılmış çıkarma.** Oluşturulan bir cümlenin gramer kısıtlamalarına (e.g., özne-fiil uyumu, gerekli değiştiriciler) uygun olduğunu doğrulayın.
- **Görünüşe dayalı duyarlılık.** Bağımlılık ayrıştırmaları size hangi sıfatın hangi ismi değiştirdiğini söyler.
- **Sorgu anlayışı.** "Bill Murray'in başrol oynadığı Wes Anderson tarafından yönetilen filmler" ayrıştırma yoluyla yapılandırılmış kısıtlamalara ayrıştırılır.
- **Diller arası aktarım.** UD etiketleri ve bağımlılık ilişkileri dilden bağımsızdır ve yeni dillerin sıfır atışlı yapısal analizine olanak tanır.
- **Düşük işlem hatları.** Bir transformer gönderemezseniz, POS + bağımlılık ayrıştırma + gazeteci sizi şaşırtıcı derecede ileri götürür.

## Gönderin

`outputs/skill-grammar-pipeline.md` olarak kaydet:

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

## Egzersizler

1. **Kolay.** Küçük etiketli bir derlemede (e.g., NLTK'nin Brown alt kümesi) en sık kullanılan etiket temel çizgisini kullanarak, uzatılan cümlelerin doğruluğunu ölçün. ~%85 sonucunu doğrulayın.
2. **Orta.** Yukarıdaki bigram HMM'yi eğitin ve etiket başına hassasiyeti/geri çağırmayı raporlayın. HMM en çok hangi etiketleri karıştırır?
3. **Zor.** 1000 cümlelik bir örnekten özne-fiil-nesne üçlülerini çıkarmak için spaCy'nin bağımlılık ayrıştırmasını kullanın. Manuel olarak etiketlenmiş 50 üçlüyü değerlendirin. Çıkartmanın başarısız olduğu yerleri belgeleyin (çoğunlukla pasifler, koordinasyonlar ve atlanan konular).

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| POS etiketi | Word'ün türü | Dilbilgisi kategorisi. PTB'nin 36'sı var; UD'de 17 var. |
| Penn Ağaç Bankası | Standart etiket seti | İngilizceye özgü. İnce taneli fiil zamanları ve isim numarası. |
| Evrensel Bağımlılıklar | Çok dilli etiket seti | PTB'den daha kaba; dil açısından tarafsız; diller arası çalışma için varsayılanlar. |
| Bağımlılık ayrıştırması | Cümle ağacı | Her kelimenin bir başı vardır, her kenarın dilbilgisel bir ilişkisi vardır. |
| Viterbi | Dinamik programlama | Emisyonlar ve geçişler göz önüne alındığında en yüksek olasılıklı etiket dizisini bulur. |

## Daha Fazla Okuma

- [Jurafsky ve Martin — Konuşma ve Dil İşleme, bölümler 8 ve 18](https://web.stanford.edu/~jurafsky/slp3/) — POS ve ayrıştırmanın standart ders kitabı uygulaması.
- [Evrensel Bağımlılıklar projesi](https://universaldependencies.org/) — her çok dilli ayrıştırıcı tarafından kullanılan diller arası etiket kümesi ve ağaç bankası koleksiyonu.
- [spaCy dilsel özellikler kılavuzu](https://spacy.io/usage/linguistic-features) — `Token`'de sunulan her özellik için pratik referans.
- [Chen ve Manning (2014). Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf) kullanan Hızlı ve Doğru Bir Bağımlılık Ayrıştırıcısı — sinir ayrıştırıcılarını ana akım haline getiren makale.
