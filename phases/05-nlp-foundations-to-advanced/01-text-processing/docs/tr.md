# Metin İşleme — Tokenleştirme, Köklendirme, Lemmatizasyon

> Dil süreklidir. Modeller ayrıktır. Ön işleme köprüdür.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 2 · 14 (Naive Bayes)
**Süre:** ~45 dakika

## Sorun

Bir model "Kediler koşuyordu" ifadesini okuyamaz. Tam sayıları okur.

Her NLP sistemi aynı üç soruyla açılır. Bir kelime nerede başlar? Kelimenin kökü nedir? "Koşmayı", "koşmayı", "koşmayı" işe yaradığı zaman aynı şeymiş gibi, işe yaramadığı zaman ise farklı şeyler olarak nasıl ele alırız?

tokenizasyonunu yanlış yaparsanız model çöpten öğrenir. tokenizer'niz `don't`'yi bir token olarak, ancak `do n't`'yi iki olarak ele alırsa, eğitim dağılımı bölünür. Kök ayırıcınız `organization` ve `organ`'yi aynı köke daraltırsa konu modelleme ölür. Lemmatizer'ınızın konuşmanın bir parçası bağlamına ihtiyacı varsa ancak bunu geçemezseniz, fiiller isim olarak kabul edilir.

Bu ders, üç ön işleme adımını sıfırdan oluşturur, ardından NLTK ve spaCy'nin aynı işi nasıl yaptığını gösterir, böylece dengeleri görebilirsiniz.

## Konsept

Üç operasyon. Her birinin bir işi ve bir başarısızlık modu vardır.

**Tokenization** bir dizeyi token'lere böler. "Token" kasıtlı olarak belirsizdir çünkü doğru ayrıntı düzeyi göreve bağlıdır. Klasik NLP için kelime düzeyinde. transformers için alt kelime. Boşluk içermeyen diller için karakter.

**Stemming** son ekleri kurallara göre keser. Hızlı, agresif, aptal. `running -> run`. `organization -> organ`. İkincisi başarısızlık modudur.

**Lemmatizasyon** dilbilgisi bilgisini kullanarak bir kelimeyi sözlük formuna indirger. Daha yavaştır, doğrudur, bir arama tablosuna veya morfolojik analizciye ihtiyaç duyar. `ran -> run` ("koşmak" kelimesinin "koşmak" fiilinin geçmiş zamanı olduğunu bilmesi gerekir). `better -> good` (karşılaştırmalı formları bilmesi gerekiyor).

Temel kural. Hız önemli olduğunda ve gürültüyü tolere edebildiğinizde (arama indeksleme, kaba sınıflandırma) ilerleyin. Anlam önemli olduğunda (soru yanıtlama, anlamsal arama, kullanıcının okuyacağı her şey) Lemmatize edin.

```figure
edit-distance
```

## İnşa Et

### Adım 1: normal ifade kelimesi tokenizer

En basit kullanışlı tokenizer, noktalama işaretini kendi token'leri olarak korurken alfanümerik olmayan karakterlere bölünür. Mükemmel değil, nihai değil ama tek satırda çalışıyor.

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

Öncelik sırasına göre üç model. İsteğe bağlı iç kesme işareti içeren kelimeler (`don't`, `it's`). Saf sayılar. Bağımsız bir token (noktalama işareti) olarak boşluk içermeyen, alfanümerik olmayan herhangi bir karakter.

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

Dikkat edilmesi gereken arıza modları. `3pm`, `['3', 'pm']`'ye bölünür çünkü harf dizileri ve rakam dizileri arasında geçiş yaptık. Çoğu görev için yeterince iyi. URL'ler, e-postalar, hashtag'lerin hepsi bozuluyor. Üretim için genel desenlerden önce desenler ekleyin.

### Adım 2: Porter kök sapı (yalnızca adım 1a)

Tam Porter algoritmasının beş aşamalı kuralları vardır. Adım 1a tek başına en sık kullanılan İngilizce ekleri kapsar ve modeli öğretir.

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

Kuralları yukarıdan aşağıya okuyun. `ies -> i` kuralının sonucu `ponies -> poni` olur; `pony` olmaz. Real Porter'ın bunu düzelten 1b adımı vardır. Kurallar birbiriyle yarışır ve önce gelen kural kazanır. Sıralama, tek bir kuraldan daha önemlidir.

### Adım 3: aramaya dayalı bir lemmatizer

Lemmatizasyonun uygun şekilde morfolojiye ihtiyacı vardır. Uyarlanabilir bir öğretim sürümü, küçük bir lemma tablosu ve bir geri dönüş kullanır.

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

Son vaka anahtar öğretme anıdır. `watched` tablomuzda değil ve geri dönüşümüz yalnızca `ing`'yi yönetiyor. Gerçek lemmatizasyon, `ed`, düzensiz fiilleri, karşılaştırmalı sıfatları, ses değişiklikleri olan çoğulları (`children -> child`) kapsar. Üretim sistemlerinin WordNet, spaCy'nin morfoloji oluşturucusu veya tam bir morfolojik analizör kullanmasının nedeni budur.

### Adım 4: bunları birleştirin

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

Eksik parça bir POS etiketleyicidir. Aşama 5 · 07 (POS Etiketleme) bir tane oluşturur. Şimdilik her şeyi varsayılan olarak `NOUN` olarak ayarlayın ve sınırlamayı kabul edin.

## Kullan onu

NLTK ve spaCy üretim versiyonlarını gönderir. Her biri birkaç satır.

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

`word_tokenize` kasılmaları, Unicode'u ve regex'inizin gözden kaçırdığı uç durumları yönetir. `PorterStemmer` beş aşamanın tamamını çalıştırıyor. `WordNetLemmatizer`, POS etiketinin NLTK'nin Penn Treebank şemasından WordNet'in kısaltma grubuna çevrilmesine ihtiyaç duyuyor. Yukarıdaki çeviri kabloları çoğu öğreticinin atladığı kısımdır.

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

spaCy tüm hattı `nlp(text)`'nin arkasına gizler. Tokenleştirme, POS etiketleme ve lemmatizasyon işlemlerinin tümü çalıştırılır. Geniş ölçekte NLTK'den daha hızlı. Kutunun dışında daha doğru. Bunun dezavantajı, bireysel bileşenleri kolayca değiştirememenizdir.

### Hangisini ne zaman seçmeli

| Durum | Seç |
|-----------|------|
| Öğretme, araştırma, bileşenleri değiştirme | NLTK |
| Üretim, çoklu dil, hız önemlidir | spaCy |
| Transformer ardışık düzen (zaten modelin tokenizer'si ile tokenözelleştirme yapacaksınız) | `tokenizers` / `transformers` kullanın ve klasik ön işlemeyi atlayın |

### Kimsenin sizi uyarmadığı iki arıza modu

Çoğu öğretici algoritmaları öğretir ve durur. Gerçek bir ön işleme hattını iki şey rahatsız eder ve bunlar neredeyse hiçbir zaman ele alınmaz.

**Tekrarlanabilirlik sapması.** NLTK ve spaCy, sürümler arasında tokenleştirme ve lemmatizer davranışını değiştirir. spaCy 2.x'te `['do', "n't"]` üreten şey, 3.x'te `["don't"]` üretebilir. Modeliniz tek bir dağıtım üzerinde eğitildi. Inference artık farklı bir cihazda çalışıyor. Doğruluk sessizce azalır ve kimse bunun nedenini bilmez. Kitaplık sürümlerini `requirements.txt` içinde sabitleyin. 20 örnek cümlenin beklenen tokenizasyonunu donduran bir ön işleme regresyon testi yazın. Her yükseltmede çalıştırın.

**Eğitim / inference uyumsuzluğu.** Agresif ön işlemeyle eğitim verin (küçük harf, engellenecek sözcükleri kaldırma, kökten ayırma), ham kullanıcı girişine göre konuşlandırın, performans kraterini izleyin. Bu, en yaygın üretim NLP hatasıdır. Eğitim sırasında ön işleme yaparsanız, aynı işlevi inference sırasında da çalıştırmalısınız. Ön işlemeyi, hizmet veren ekibin yeniden yazdığı bir not defteri hücresi olarak değil, model paketinin içindeki bir işlev olarak gönderin.

## Gönderin

Mühendislerin üç ders kitabı okumadan bir ön işleme stratejisi seçmelerine yardımcı olan yeniden kullanılabilir bir prompt.

`outputs/prompt-preprocessing-advisor.md` olarak kaydet:

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

1. **Kolay.** URL'leri tek token'ler olarak tutmak için `tokenize`'yi genişletin. Test: `tokenize("Visit https://example.com today.")` bir URL token üretmelidir.
2. **Orta.** Porter adım 1b'yi uygulayın. Bir kelime sesli harf içeriyorsa ve `ed` veya `ing` ile bitiyorsa onu kaldırın. Çift ünsüz kuralını kullanın (`hopping -> hop`, `hopp` değil).
3. **Zor.** WordNet'i arama tablosu olarak kullanan ancak WordNet'te giriş olmadığında Porter köküne geri dönen bir lemmatizer oluşturun. Etiketli bir derlemedeki doğruluğu düz WordNet ve düz Porter'a göre ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Token | bir kelime | Modelin tükettiği birim ne olursa olsun. Kelime, alt kelime, karakter veya bayt olabilir. |
| Kök | Bir kelimenin kökü | Kural tabanlı sonek çıkarmanın sonucu. Her zaman gerçek bir kelime değil. |
| Lema | Sözlük formu | Bakacağınız form. Doğru hesaplama için gramer bağlamı gerekir. |
| POS etiketi | Konuşmanın bir kısmı | İSİM, FİL, SIFAT gibi kategori. Doğru bir şekilde lemmatize edilmesi gerekiyordu. |
| Morfoloji | Kelime şekli kuralları | Bir kelimenin zamana, sayıya, büyük/küçük harfe göre nasıl şekil değiştirdiği. Lemmatizasyon buna bağlıdır. |

## Daha Fazla Okuma

- [Porter, M. F. (1980). Son ekleri kaldırmaya yönelik bir algoritma](https://tartarus.org/martin/PorterStemmer/def.txt) — beş sayfalık özgün makale hâlâ en açık anlatımdır.
- [spaCy 101 — dilsel özellikler](https://spacy.io/usage/linguistic-features) — gerçek bir boru hattının nasıl kablolandığı.
- [NLTK kitabı, bölüm 3](https://www.nltk.org/book/ch03.html) — tokenhenüz düşünmediğiniz son durum örnekleri.
