# POS Etiketleme ve Sintektiksel Parsing

> Bir süre için dilbilgi modası yoktu, sonra her LLM boru hattı yapılandırılmış çıkarımı doğrulamalıydı ve geri döndü.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## Sorun

Ders 01 lematizasyonun konuşma bir parçası olduğunu söyledi.`running`Bir lematizer onu kısaltamaz.`run`Bilmeden .`better`Adjektifdir, aşağıya düşemez.`good`- Evet .

Bu vaat tüm bir alt alanı sakladı. Konuşmanın bir parçası olarak etiketleme, dilbilimsel kategorileri tahsis eder. Sintiksel analiz cümlenin ağaç yapısını geri kazanır: hangi kelime hangisini değiştirir, hangi fiil hangisini yönetir argümanları. Klasik NLP ikisini de on yıl daha iyi hale getirerek geçti. Sonra derin öğrenme onları önceden eğitilmiş bir transformatörün üstüne bir token sınıflandırma görevine dönüştürdü ve araştırma topluluğu ilerledi.

Kullanılan topluluk değil. Her yapılandırılmış çıkarma boru hattı hala kapının altında POS ve bağımlılık ağaçlarını kullanır. LLM'de üretilen JSON dilbilgisi kısıtlamalarına karşı doğrulanır. Soru- yanıtlama sistemleri bağımlılık parseslerini kullanarak sorguları parçalayır. Makinesi çevirisi kalitesi değerlendicileri parse ağaçlarının hizalanmasını kontrol eder.

Bu ders, etiketleri, temel çizgileri ve sıfırdan uygulamayı bırakan noktayı tanıtır ve spaCy'yi çağırır.

## Anlaşım

**POS tagging**Her bir simgeyi bir dilbilimsel kategorisi ile etiketler.**Penn Treebank (PTB)**Tagset İngilizce'de varsayılan bir koddur. 36 etiket farklılıkları olan, sıradan okuyucu için zorlayıcı: `NN`tek isim, `NNS`çoğul isim, `NNP`özel isim tek kelime,`VBD`Geçmiş zamanlı fiil, `VBZ`3rd person singular present, ve benzeri.**Universal Dependencies (UD)**tagset daha kaba (17 etiket) ve dil-agnostiktir; diller arası çalışmalarda öntanımlı hale geldi.

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**Syntactic parsing**İki büyük stil:

- **Constituency parsing.**Adım cümleleri, fiil cümleleri, önbölüm cümleleri birbirlerinin içinde yuvalar.
- **Dependency parsing.**Her kelimenin, bir dilbilgi ile etiketlenmiş, bağımlı olduğu tek bir baş kelimesi vardır.

Bağımlılık analiz 2010'larda kazanıldı çünkü diller arasında, özellikle de serbest kelime sırası olanları temiz bir şekilde genelleştirir.

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

## Yapın

### Adım 1: En sık etiketlenen başlangıç çizgisi

Çalışan en aptal POS etiketçisi. Her kelime için, eğitimde en sık kullandığı etiketleri tahmin et.

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

Brown'un korpusunda, bu temel çizgi %85 doğruluğa ulaştı.

### Adım 2: Bigram HMM etiketlemeci

Düzeneğin ortak olasılığını modelleyin:

```math
P(\text{tags}, \text{words}) = \prod_i P(\text{tag}_i \mid \text{tag}_{i-1}) \cdot P(\text{word}_i \mid \text{tag}_i)
```

İki tablo: geçiş olasılığı (önceki etiket verilen etiket), emisyon olasılığı (söz verilen etiket).

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

Brown'daki Bigram HMM'nin %93 doğruluğu %85'ten %93'e kadar sıçrama olasılığı çoğunlukla geçiş olasılığıdır.`DET NOUN`- Bu çok yaygın ve`NOUN DET`Nadir bir durum.

### Adım 3: modern etiketçiler neden bunu yendi

Değişim + emisyon olasılığı yerel.`saw`"Bir testere aldım" isimli bir isim, "Filmi gördüm" fiili ise "Filmi gördüm" filidir. "Özenli özellikleri olan bir CRF (sufiks, kelime şekli, kelimeden önce ve sonra, kelime kendisi) ~ 97%'e ulaşır. BiLSTM-CRF veya transformatör ~98%+'e ulaşır.

Bu görev için tavan, yorumcu anlaşmazlığı ile belirlenir. İnsan yorumcuları Penn Treebank'ta yaklaşık %97'de aynı fikirde. %98'den önceki modeller muhtemelen test setine fazla uymaktadır.

### Adım 4: bağımlılık analiz çizelgesi

Tam bir bağımlılık sıfırdan analiz etmek kapsamının dışındadır; kanonik derslik tedavisi Jurafsky ve Martin'de.

- **Transition-based**Parserler (arc-eager, arc-standard) bir shift-reduce parser gibi hareket eder: simgeler okuyor, onları bir yığın üzerine taşıyor ve ark oluşturan azaltma eylemlerini uyguluyor. Açgözlülük çözümü hızlıdır. Klasik uygulaması MaltParser. Modern sinirsel sürüm: Chen ve Manning'in geçiş tabanlı parser.
- **Graph-based**Parserler (Eisner'ın algoritması, Dozat-Manning biafin) baş bağımlısı olan her kenarı notlar ve maksimum uzanan ağaç seçer.

Uygulamalı çalışmaların çoğu için spaCy'yi arayın:

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

Oku `dep`sütun altından yukarıya ve cümlenin dilbilgisel yapısı düşüyor.

## Kullan

Her üretim NLP kütüphanesi standart bir boru hattının bir parçası olarak POS ve bağımlılık parserlerini gönderir.

- **spaCy**(`en_core_web_sm`- Ne ?`md`- Ne ?`lg`- Ne ?`trf`). Hızlı, doğru, tokenizasyon + NER + lemmatizasyon ile entegre. `token.tag_`- Evet .`token.pos_`(UD), `token.dep_`( bağımlılık ilişkisi).
- **Stanford NLP (stanza)**Stanford'un CoreNLP'nin ardıcısı 60'dan fazla dilde en son teknoloji.
- **trankit**Transformer tabanlı, iyi bir UD doğruluğu.
- **NLTK**- Evet .`pos_tag`Kullanılabilir, yavaş, yaşlı, öğretim için iyi.

### 2026'da bu hala önemli olan yerlerde

- **Lemmatization.**Ders 01'de POS'un doğru şekilde lematize olması gerekiyor.
- **Structured extraction from LLM outputs.**Yaratılan cümlenin dilbilgilerle ilgili kısıtlamalara (örneğin, konu-ketim anlaşması, gerekli değişiklikler) saygı göstermesini doğrulayın.
- **Aspect-based sentiment.**Bağımlılık analizleri hangi adetifin hangi isim değiştirdiğini söyler.
- **Query understanding.**"Bill Murray'nin başrolde olduğu Wes Anderson yönettiği filmler" analiz yoluyla yapılandırılmış kısıtlamalara ayrılır.
- **Cross-lingual transfer.**UD etiketleri ve bağımlılık ilişkileri dil-agnostiktir ve yeni dillerin sıfır çekim yapılmış analizini mümkün kılar.
- **Low-compute pipelines.**Eğer bir transformatör gönderemezsen, POS + bağımlılık analizi + gazetteer şaşırtıcı derecede uzaklara gider.

## Gönder

- Kaydet .`outputs/skill-grammar-pipeline.md`- ...

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

1. **Easy.**Küçük bir etiketleme korpusunda en sık etiketlenen temel çizgiyi kullanarak (örneğin NLTK'nin Brown alt kümesi), beklenen cümlelerde doğruluğu ölçün. ~ 85% sonucu doğrulayın.
2. **Medium.**Yukarıdaki büyük HMM'yi eğit ve her etiket için doğru bir raporu gönder.
3. **Hard.**spaCy'nin bağımlılık analizi kullanarak 1000 cümlelik bir örnekten konu-ketim-objek üçlüler çıkarın. 50 elle etiketlenen üçlü üzerinde değerlendirin. Çekim başarısız olduğu belge (sık sık pasifler, koordinatlar ve uzak konular).

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| POS tag | Word's type | Grammatical category. PTB has 36; UD has 17. |
| Penn Treebank | Standard tagset | English-specific. Fine-grained verb tenses and noun number. |
| Universal Dependencies | Multilingual tagset | Coarser than PTB; language-neutral; defaults for cross-lingual work. |
| Dependency parse | Sentence tree | Each word has one head, each edge has a grammatical relation. |
| Viterbi | Dynamic programming | Finds the highest-probability tag sequence given emissions and transitions. |

## Daha Fazla Okumak

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) POS ve analizleme konusunda kanonik derslik tedavisi.
- [Universal Dependencies project](https://universaldependencies.org/) her çok dilli analizci tarafından kullanılan diller arası etiket ve ağaç banka koleksiyonu.
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features)  `Token`- Evet .
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf) sinir parçalanmalarını ana akışa getiren kağıt.
