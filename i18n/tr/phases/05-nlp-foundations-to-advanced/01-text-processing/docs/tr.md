# Metin İşlemesi  Tokenizasyon, Stemming, Lemmatizasyon

> Dil sürekli, modeller ayrı, önceden işleme köprüdür.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## Sorun

Bir model "Kediler koşuyordu" diye okuyamıyor. Tam sayıları okuyor.

Her NLP sistemi aynı üç soruyla başlar. Bir kelime nereden başlar? kelimenin kökü nedir? "hareket", "hareket", "hareket" yardımcı olduğunda aynı şey olarak nasıl ele alıyoruz?

Tokenizasyon yanlış olursa model çöpten öğreniyor.`don't`Bir simge olarak ama`do n't`Eğer oylarınız çökerse eğitim dağıtıcılığı bölünür.`organization`ve `organ`Eğer lemmatizer'iniz konuşma bağlamının bir kısmına ihtiyaç duyarsa ama bunu geçmezseniz, fiiller isim olarak değerlendirilir.

Bu ders, üç önceden işleme adımını sıfırdan inşa eder, sonra NLTK ve spaCy'nin aynı işi nasıl yaptığını gösterir. Böylece, pazarlamaları görebilirsiniz.

## Anlaşım

Her birinin bir işi ve bir başarısızlık modudur.

**Tokenization**"Token" kasıtlı olarak belirsizdir çünkü doğru granularlık göreve bağlıdır. Klasik NLP için kelime seviyesini. Transformörler için alt kelime. Beyaz alan olmayan diller için karakter.

**Stemming**Kurallar ile birlikte, hızlı, saldırgan, aptal.`running -> run`- Evet .`organization -> organ`İkinci bir hata modudur.

**Lemmatization**Bu nedenle, bir kelimeyi dilbilim biçimine düşürmek için dilbilim bilgisini kullanır.`ran -> run`(Run'un "run"ın geçmiş zamanlı olduğunu bilmem gerekiyor).`better -> good`(sırlaştırma biçimlerini bilmesi gerekir).

Basmak kuralı. Hız önemli olduğunda ses çıkar ve gürültüye tolere edebilirsiniz (arşiv indeksleme, kaba sınıflandırma). Anlam önemli olduğunda (sorulara cevap vermek, semantik arama, kullanıcı okuyacak her şey) lematize edin.

```figure
edit-distance
```

## Yapın

### Adım 1: Regex kelime işaretleyicisi

En basit kullanışlı jeton, öz jetonları olarak noktalama tutarken alfa numerik olmayan karakterlere bölünür.

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

Üç örneği öncelik sırasıyla.`don't`- Evet .`it's`) Saf sayılar. Tek beyaz alan olmayan bir karakter olarak bağımsız bir simge (sıkıştırma).

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

Başarısızlık modları fark edilsin. `3pm`bölünür .`['3', 'pm']`Çünkü harf ve rakam süreleri arasında değişiklik yapıyoruz. Çoğu görev için yeterli. URL'ler, e-postalar, hashtaglar hepsi kırılıyor.

### Adım 2: Porter stemmer (sadece 1a adım)

Porter algoritmasının tamamında beş aşama kuralları vardır. Yalnızca 1a adım en sık İngilizce sufifileri kapsar ve örneği öğretir.

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

Kuralları yukarıdan aşağı oku.`ies -> i`Kural neden ?`ponies -> poni`- Hayır .`pony`Gerçek Porter'ın 1B adımını atarak bu durumu düzeltebiliriz. Kurallar rekabet eder. Önceki kurallar kazanır.

### Adım 3: Arama tabanlı lemmatizer

Lemmatizasyonun doğru bir morfoloji gerektiriyor.

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

Son durum, öğretim anının anahtarıdır.`watched`Masamızda değil ve düşüşümüz sadece ele geçiriyor .`ing`Gerçek lemmatizasyon kapsamını .`ed`, düzensiz fiiller, karşılaştırıcı özelliği, ses değişikliği olan çoğullar (`children -> child`Bu nedenle üretim sistemleri WordNet, spaCy'nin morfologizerini veya tam bir morfolojik analizörü kullanır.

### Dördüncü adım: Onları birleştir .

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

Kayıp parça bir POS etiketlemesidir. 5 · 07 aşaması (POS Etiketleme) bir tane oluşturur.`NOUN`Ve sınırlarını kabul et.

## Kullan

NLTK ve spaCy üretim sürümlerini gönderiyor.

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

`word_tokenize`- Sıkıntıları, Unicode'u, Regex'in kaçırdığı uç durumları.`PorterStemmer`Beş aşamada devam ediyor.`WordNetLemmatizer`NLTK'nin Penn Treebank skemasından WordNet'in kısaltma setiye çevrilen POS etiketine ihtiyaç duyar.

### spaCy

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

spaCy tüm boru hattını arkasına saklıyor .`nlp(text)`Tokenizasyon, POS etiketleme ve lemmatizasyon hepsi çalışıyor. NLTK'den daha hızlı ölçekte. Kutu dışındaki daha doğru.

### Hangisini seçmek için ne zaman

| Situation | Pick |
|-----------|------|
| Teaching, research, swapping components | NLTK |
| Production, multi-language, speed matters | spaCy |
| Transformer pipeline (you'll tokenize with the model's tokenizer anyway) | Use `tokenizers` / `transformers` and skip classical preprocessing |

### İki başarısızlık modunu kimse sizi uyarmaz

Çoğu ders algoritmaları öğretir ve durur. İki şey gerçek bir önceden işleme borusunu ısırır ve neredeyse asla kapsamalanmaz.

**Reproducibility drift.**NLTK ve spaCy, versiyonlar arasında simgelendirme ve lemmatizer davranışını değiştirir.`['do', "n't"]`spaCy 2.x' de `["don't"]`3.x'te modeliniz bir dağıtım üzerinde eğitildi. İferense şimdi başka bir dağıtım üzerinde çalışır.`requirements.txt`20 örnek cümle beklenen işaretlemeyi dondurarak bir gerileme testi yazın.

**Training / inference mismatch.**Bu, en yaygın üretim NLP başarısızlığıdır. Eğitim sırasında önceden işleme yaparsanız, sonuç çıkarma sırasında aynı işlevi çalıştırmalısınız.

## Gönder

Tekrar kullanılabilir bir ipucu, mühendislerin üç ders kitabı okumadan önce işleme stratejisini seçmelerine yardımcı olur.

- Kaydet .`outputs/prompt-preprocessing-advisor.md`- ...

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

## Egzersizler

1. **Easy.**Uzaklaştırma`tokenize`URL'leri tek bir simge olarak tutmak için. Test: `tokenize("Visit https://example.com today.")`Bir URL simgesi üretmeli.
2. **Medium.**Porter Adım 1b uygulamak . Eğer bir kelime vokal içerirse ve sonunda `ed`veya `ing`İkili konsonan kuralını kullan (`hopping -> hop`- Hayır .`hopp`)
3. **Hard.**WordNet'i arama tablosu olarak kullanan, ancak WordNet'in giriş olmadığı zaman Porter voter'e geri dönen bir lemmatizer oluşturun.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Token | A word | Whatever unit the model consumes. Can be word, subword, character, or byte. |
| Stem | Root of a word | Result of rule-based suffix stripping. Not always a real word. |
| Lemma | Dictionary form | The form you'd look up. Requires grammatical context to compute correctly. |
| POS tag | Part of speech | Category like NOUN, VERB, ADJ. Needed to lemmatize accurately. |
| Morphology | Word shape rules | How a word changes form based on tense, number, case. Lemmatization depends on it. |

## Daha Fazla Okumak

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt)- Asıl makale, beş sayfa, hala en açık açık açıklama.
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) Gerçek bir boru hattının nasıl kablolu olduğu.
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html)Henüz düşünmediğin tokenizasyon kenarlık vakaları.
