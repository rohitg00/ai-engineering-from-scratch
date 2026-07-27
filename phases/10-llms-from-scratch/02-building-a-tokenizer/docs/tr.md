# Sıfırdan bir Tokenizer oluşturmak

> Ders 01 sana bir oyuncak verdi. Bu ders size bir silah veriyor.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 10, Ders 01 (Tokenizers: BPE, WordPiece, SentencePiece)
**Süre:** ~90 dakika

## Öğrenme Hedefleri

- Unicode, boşluk normalleştirmesi ve özel token'leri işleyen üretim düzeyinde bir BPE tokenizer oluşturun
- tokenizer'nin bilinmeyen token'ler olmadan herhangi bir girişi (emoji, CJK ve kod dahil) kodlayabilmesi için bayt düzeyinde geri dönüş uygulayın
- BPE birleştirmelerini uygulamadan önce metni sözcük sınırlarında bölen ön-tokenleştirme normal ifade kalıpları ekleyin
- Bir külliyat üzerinde özel bir tokenizer eğitin ve çok dilli metinde tiktoken'ye göre sıkıştırma oranını değerlendirin

## Sorun

Ders 01'deki BPE'niz tokenizer İngilizce metin üzerinde çalışır. Şimdi Japoncayı fırlatın. Veya emojiyi. Veya karışık sekme ve boşluklara sahip Python kodu.

Kırılıyor.

BPE'nin yanlış olması değil, uygulamanın eksik olması nedeniyle. Bir tokenizer üretimi, herhangi bir kodlamadaki ham baytları işler, bölünmeden önce Unicode'u normalleştirir, asla birleştirilmeyen özel token'leri yönetir, alt kelime bölmeyle ön-tokenzincirlemeyi zincirler ve tüm bunları, 15 trilyon token'yu işleyen bir eğitim hattında darboğaz oluşturmayacak kadar hızlı yapar.

GPT-2'nin tokenizer'si 50.257 token'ye sahiptir. Llama 3'te 128.256 var. GPT-4'ün yaklaşık 100.000'i var. Bunlar oyuncak numaraları değil. Bu sözcüklerin arkasındaki birleştirme tabloları yüzlerce gigabaytlık metin üzerinde eğitilmişti ve çevreleyen makineler (normalizasyon, öntokenizasyon, özel token enjeksiyonu, sohbet şablonu biçimlendirmesi) "merhaba dünya"yı işleyen bir tokenizer'yi tüm interneti yöneten birinden ayıran şeydir.

O makineyi sen yapacaksın.

## Konsept

### Tam Boru Hattı

Bir tokenizer üretimi tek bir algoritma değildir. Bu, her biri farklı bir sorunu çözen beş aşamadan oluşan bir boru hattıdır.

```mermaid
graph LR
    A[Raw Text] --> B[Normalize]
    B --> C[Pre-Tokenize]
    C --> D[BPE Merge]
    D --> E[Special Tokens]
    E --> F[Token IDs]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
```

Her aşamanın belirli bir görevi vardır:

| Sahne | Ne İşe Yarar | Neden Önemlidir |
|-------|-------------|----------------|
| Normalleştir | NFKC Unicode, küçük harf isteğe bağlı, şerit vurgulu isteğe bağlı | "fi" bitişik harfler (U+FB01), "fi" (iki karakter) haline gelir. Bu olmadan aynı kelime farklı token'lar alır. |
| Ön-TokenÖnceden Boyutlandır | BPE'den önce metni parçalara ayırın | BPE'nin sözcük sınırlarını aşarak birleşmesini engeller. "kedi" hiçbir zaman token "e c" üretmemelidir. |
| BPE Birleştirme | Öğrenilen birleştirme kurallarını bayt dizilerine uygulama | Çekirdek sıkıştırma. Ham baytları token alt kelimesine dönüştürür. |
| Özel Token'lar | [BOS], [EOS], [PAD], sohbet şablonu işaretçilerini enjekte edin | Bu token'ların sabit kimlikleri var. BPE birleşmelerine asla katılmazlar. Modelin yapı olarak bunlara ihtiyacı var. |
| Kimlik Eşleme | token dizesini tamsayı kimliklerine dönüştürün | Model dizeleri değil tam sayıları görür. |

### Bayt Düzeyinde BPE

Ders 01'in tokenizer'si UTF-8 bayt üzerinde çalıştırılır. Bu doğru çağrıydı. Ancak önemli bir şeyi atladık: Bu baytlar geçerli UTF-8 olmadığında ne olur?

Bayt düzeyinde BPE, mümkün olan her bayt değerini (0-255) geçerli bir token olarak ele alarak bu sorunu çözer. Temel kelime dağarcığınız tam olarak 256 giriştir. Herhangi bir dosya (metin, ikili dosya, bozuk) bilinmeyen bir token üretilmeden tokenözelleştirilebilir.

GPT-2 bir numara ekledi: her baytı yazdırılabilir bir Unicode karakterle eşleyin, böylece sözcük dağarcığı insanlar tarafından okunabilir kalsın. Bayt 0x20 (boşluk), eşlemelerinde "G" karakteri haline gelir. Bu tamamen kozmetiktir. Algoritma umursamıyor.

Gerçek güç: bayt düzeyinde BPE dünyadaki her dili yönetir. Çince karakterlerin her biri 3 UTF-8 bayttır. Japonca 3-4 bayt olabilir. Arapça, Devanagari, emoji; hepsi sadece bayt dizileri. BPE algoritması, bu bayt dizilerindeki kalıpları, İngilizce ASCII baytlarındaki kalıplarla tamamen aynı şekilde bulur.

### ÖnTokenönleştirme

BPE metninize dokunmadan önce onu parçalara ayırmanız gerekir. Bu, birleştirme algoritmasının sözcük sınırlarını kapsayan token'ler oluşturmasını engeller.

GPT-2, metni bölmek için bir normal ifade modeli kullanır:

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

Bu model, kısaltmalara ("yapma", "yapma" + "'t'ye dönüşür"), isteğe bağlı baştaki boşluklara, sayılara, noktalama işaretlerine ve boşluklara sahip kelimelere bölünür. Baştaki boşluk kelimeye bağlı tutulur - böylece "kedi", ["the", " ", "cat"] değil, [" the", "cat"] olur.

Llama, regex'i tamamen atlayan SentencePiece'i kullanır. Ham bayt akışını uzun bir dizi olarak ele alır ve BPE algoritmasının sınırları belirlemesine olanak tanır. Bu daha basittir ancak BPE'ye çapraz kelime token'ler oluşturma konusunda daha fazla özgürlük verir.

Seçim önemlidir. GPT-2'nin regex'i, tokenizer'nin bir kelimenin sonundaki "the" ile bir sonraki kelimenin başındaki "the"nin birleşmesi gerektiğini öğrenmesini engeller. SentencePiece buna izin veriyor, bu da bazen daha verimli sıkıştırma ancak daha az yorumlanabilir token'ler üretiyor.

### Özel Token'lar

Her üretim tokenizer, yapısal işaretleyiciler için token kimliğini ayırır:

| Token | Amaç | Kullanan |
|-------|---------|---------|
| `[BOS]` / `<s>` | Sıranın başlangıcı | Llama 3, GPT |
| `[EOS]` / `</s>` | Sıranın sonu | Tüm modeller |
| `[PAD]` | Toplu hizalama için dolgu | BERT, T5 |
| `[UNK]` | Bilinmeyen token (bayt düzeyinde BPE bunu ortadan kaldırır) | BERT, WordPiece |
| `<\|im_start\|>` | Sohbet mesajı sınırı başlangıcı | ChatGPT, Qwen |
| `<\|im_end\|>` | Sohbet mesajı sınır sonu | ChatGPT, Qwen |
| `<\|user\|>` | Kullanıcı dönüş işaretçisi | Llama 3 |
| `<\|assistant\|>` | Asistan dönüş işaretçisi | Llama 3 |

Özel token'lar asla BPE'ye göre bölünmez. Bunlar, birleştirme algoritması çalıştırılmadan tam olarak önce eşleştirilir, sabit kimlikleriyle değiştirilir ve çevreleyen metin normal şekilde tokenözelleştirilir.

### Sohbet Şablonları

Çoğu insanın kafasının karıştığı ve çoğu uygulamanın bozulduğu nokta burasıdır.

Bir sohbet modeline mesaj gönderdiğinizde API bir mesaj listesini kabul eder:

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

Model JSON'u görmüyor. Düz bir token dizisi görüyor. Sohbet şablonu, özel token'leri kullanarak mesajları bu düz diziye dönüştürür. Her model bunu farklı şekilde yapar:

```
Llama 3:
<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are helpful.<|eot_id|><|start_header_id|>user<|end_header_id|>

Hello<|eot_id|><|start_header_id|>assistant<|end_header_id|>

Hi there!<|eot_id|>

ChatGPT:
<|im_start|>system
You are helpful.<|im_end|>
<|im_start|>user
Hello<|im_end|>
<|im_start|>assistant
Hi there!<|im_end|>
```

Şablonu yanlış alırsanız model çöp üretir. Kesin bir formatta eğitildi. Herhangi bir sapma (eksik bir yeni satır, değiştirilmiş bir token, fazladan bir boşluk) girişi eğitim dağıtımının dışına koyar.

### Hız

Python üretim tokenoluşturulması için çok yavaş.

tiktoken (OpenAI), Rust'ta Python bağlamalarıyla yazılmıştır. HuggingFace tokenizers aynı zamanda Pas'tır. SentencePiece C++'dır. Bunlar, saf Python'a göre 10-100 kat hızlanma sağlar.

Perspektif açısından: Llama 3 için token15 trilyon tokens'nin saniyede 1 milyon tokens hızında ön eğitimi (hızlı Python) 174 gün sürecektir. Saniyede 100 milyon tokens (Pas) ile 1,7 gün sürer.

Algoritmayı anlamak için Python'da geliştiriyorsunuz. Üretimde derlenmiş bir uygulama kullanırsınız ve yalnızca Python sarmalayıcısına dokunursunuz.

```figure
weight-tying
```

## İnşa Et

### Adım 1: Bayt Düzeyinde Kodlama

Temel. Herhangi bir dizeyi bir bayt dizisine dönüştürün, her baytı görüntülemek için yazdırılabilir bir karakterle eşleştirin ve işlemi tersine çevirin.

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

Bayt sayılarını görmek için çok dilli metin üzerinde test yapın:

```python
texts = [
    ("English", "hello"),
    ("Chinese", "你好"),
    ("Emoji", "🔥"),
    ("Mixed", "hello你好🔥"),
]

for label, text in texts:
    b = bytes_to_tokens(text)
    print(f"{label}: {len(text)} chars -> {len(b)} bytes -> {b}")
```

"merhaba" 5 bayttır. "你好" 6 bayttır (karakter başına 3 bayt). Ateş emojisi 4 bayttır. Bayt düzeyindeki tokenizer hangi dil olduğunu umursamaz. Bayt bayttır.

### Adım 2: Regex ile Tokenizer öncesi

GPT-2 normal ifade modelini kullanarak metni parçalara ayırın. Her parça BPE tarafından bağımsız olarak tokensize alınır.

```python
import re

try:
    import regex
    GPT2_PATTERN = regex.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""
    )
except ImportError:
    GPT2_PATTERN = re.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?[a-zA-Z]+| ?[0-9]+| ?[^\s\w]+|\s+(?!\S)|\s+"""
    )

def pre_tokenize(text):
    return [match.group() for match in GPT2_PATTERN.finditer(text)]
```

`regex` modülü, Unicode özellik çıkışlarını destekler (harfler için `\p{L}`, sayılar için `\p{N}`). Standart kitaplık `re` modülü bunu yapmaz, bu nedenle ASCII karakter sınıflarına geri dönüyoruz. Çok dilli üretim tokenizer'ler için `regex`'yi yükleyin.

Deneyin:

```python
print(pre_tokenize("Hello, world! Don't stop."))
# [' Hello', ',', ' world', '!', " Don", "'t", ' stop', '.']
```

Baştaki boşluk kelimeye bağlı kalır. Kasılmalar kesme işaretinde bölünüyor. Noktalama işaretleri kendi parçası haline gelir. BPE, bu sınırların ötesindeki token'leri hiçbir zaman birleştirmeyecektir.

### Adım 3: Bayt Dizilerinde BPE

Ders 01'deki temel algoritma, ancak artık öncedentokenbireyselleştirilmiş parçalar üzerinde bağımsız olarak çalışıyor.

```python
from collections import Counter

def get_byte_pairs(chunks):
    pairs = Counter()
    for chunk in chunks:
        byte_seq = list(chunk.encode("utf-8"))
        for i in range(len(byte_seq) - 1):
            pairs[(byte_seq[i], byte_seq[i + 1])] += 1
    return pairs

def apply_merge(byte_seq, pair, new_id):
    merged = []
    i = 0
    while i < len(byte_seq):
        if i < len(byte_seq) - 1 and byte_seq[i] == pair[0] and byte_seq[i + 1] == pair[1]:
            merged.append(new_id)
            i += 2
        else:
            merged.append(byte_seq[i])
            i += 1
    return merged
```

### Adım 4: Özel Token İşleme

Özel token'lerin tam eşleşmeye ve sabit kimliklere ihtiyacı vardır. BPE'yi tamamen atlıyorlar.

```python
class SpecialTokenHandler:
    def __init__(self):
        self.special_tokens = {}
        self.pattern = None

    def add_token(self, token_str, token_id):
        self.special_tokens[token_str] = token_id
        escaped = [re.escape(t) for t in sorted(self.special_tokens.keys(), key=len, reverse=True)]
        self.pattern = re.compile("|".join(escaped))

    def split_with_specials(self, text):
        if not self.pattern:
            return [(text, False)]
        parts = []
        last_end = 0
        for match in self.pattern.finditer(text):
            if match.start() > last_end:
                parts.append((text[last_end:match.start()], False))
            parts.append((match.group(), True))
            last_end = match.end()
        if last_end < len(text):
            parts.append((text[last_end:], False))
        return parts
```

### Adım 5: Tam Tokenizer Sınıfı

Her şeyi birbirine zincirleyin: normalleştirin, özel token'lere bölün, ön-tokenoluşturun, BPE birleştirme, kimliklerle eşleyin.

```python
import unicodedata

class ProductionTokenizer:
    def __init__(self):
        self.merges = {}
        self.vocab = {i: bytes([i]) for i in range(256)}
        self.special_handler = SpecialTokenHandler()
        self.next_id = 256

    def normalize(self, text):
        return unicodedata.normalize("NFKC", text)

    def train(self, text, num_merges):
        text = self.normalize(text)
        chunks = pre_tokenize(text)
        chunk_bytes = [list(chunk.encode("utf-8")) for chunk in chunks]

        for i in range(num_merges):
            pairs = Counter()
            for seq in chunk_bytes:
                for j in range(len(seq) - 1):
                    pairs[(seq[j], seq[j + 1])] += 1
            if not pairs:
                break
            best = max(pairs, key=pairs.get)
            new_id = self.next_id
            self.next_id += 1
            self.merges[best] = new_id
            self.vocab[new_id] = self.vocab[best[0]] + self.vocab[best[1]]
            chunk_bytes = [apply_merge(seq, best, new_id) for seq in chunk_bytes]

    def add_special_token(self, token_str):
        token_id = self.next_id
        self.next_id += 1
        self.special_handler.add_token(token_str, token_id)
        self.vocab[token_id] = token_str.encode("utf-8")
        return token_id

    def encode(self, text):
        text = self.normalize(text)
        parts = self.special_handler.split_with_specials(text)
        all_ids = []
        for part_text, is_special in parts:
            if is_special:
                all_ids.append(self.special_handler.special_tokens[part_text])
            else:
                for chunk in pre_tokenize(part_text):
                    byte_seq = list(chunk.encode("utf-8"))
                    for pair, new_id in self.merges.items():
                        byte_seq = apply_merge(byte_seq, pair, new_id)
                    all_ids.extend(byte_seq)
        return all_ids

    def decode(self, ids):
        byte_parts = []
        for token_id in ids:
            if token_id in self.vocab:
                byte_parts.append(self.vocab[token_id])
        return b"".join(byte_parts).decode("utf-8", errors="replace")

    def vocab_size(self):
        return len(self.vocab)
```

### Adım 6: Çok Dilli Test

Gerçek sınav. Üzerine İngilizce, Çince, emoji ve kod ekleyin.

```python
corpus = (
    "The quick brown fox jumps over the lazy dog. "
    "The quick brown fox runs through the forest. "
    "Machine learning models process natural language. "
    "Deep learning transforms how we build software. "
    "def train(model, data): return model.fit(data) "
    "def predict(model, x): return model(x) "
)

tok = ProductionTokenizer()
tok.train(corpus, num_merges=50)

bos = tok.add_special_token("<|begin|>")
eos = tok.add_special_token("<|end|>")

test_texts = [
    "The quick brown fox.",
    "你好世界",
    "Hello 🌍 World",
    "def foo(x): return x + 1",
    f"<|begin|>Hello<|end|>",
]

for text in test_texts:
    ids = tok.encode(text)
    decoded = tok.decode(ids)
    print(f"Input:   {text}")
    print(f"Tokens:  {len(ids)} ids")
    print(f"Decoded: {decoded}")
    print()
```

Çince karakterlerin her biri 3 bayt üretir. Emoji 4 bayt üretir. Bunların hiçbiri tokenizer'yi çökertmiyor. Hiçbiri bilinmeyen token'ler üretmez. Bayt düzeyinde BPE'nin gücü budur.

## Kullan onu

### Gerçek Tokenizer'leri Karşılaştırma

Llama 3, GPT-4 ve Mistral'den gerçek tokenizer'ları yükleyin. Her birinin aynı çok dilli paragrafı nasıl ele aldığını görün.

```python
import tiktoken

gpt4_enc = tiktoken.get_encoding("cl100k_base")

test_paragraph = "Machine learning is powerful. 机器学习很强大。 L'apprentissage automatique est puissant. 🤖💪"

tokens = gpt4_enc.encode(test_paragraph)
pieces = [gpt4_enc.decode([t]) for t in tokens]
print(f"GPT-4 ({len(tokens)} tokens): {pieces}")
```

```python
from transformers import AutoTokenizer

llama_tok = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B")
mistral_tok = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-v0.1")

for name, tok in [("Llama 3", llama_tok), ("Mistral", mistral_tok)]:
    tokens = tok.encode(test_paragraph)
    pieces = tok.convert_ids_to_tokens(tokens)
    print(f"{name} ({len(tokens)} tokens): {pieces[:20]}...")
```

Aynı metin için farklı token sayıları göreceksiniz. 128K kelime dağarcığına sahip Llama 3, ortak kalıpları birleştirme konusunda daha agresiftir. 100K ile GPT-4 ortada oturuyor. 32K'lı Mistral daha fazla token üretir ancak daha küçük bir embedding katmanına sahiptir.

Takas her zaman aynıdır: Daha büyük kelime dağarcığı, daha kısa diziler ancak daha fazla parametre anlamına gelir.

## Gönderin

Bu ders, üretim tokenizer'leri oluşturmak ve hata ayıklamak için bir prompt üretir. Bkz. `outputs/prompt-tokenizer-builder.md`.

## Egzersizler

1. **Kolay:** Herhangi bir token kimliği için ham baytları gösteren bir `get_token_bytes(id)` yöntemi ekleyin. En yaygın birleştirilmiş token'lerinizin gerçekte neyi temsil ettiğini incelemek için bunu kullanın.
2. **Orta:** Boşluklara ve rakamlara bölünen ancak baştaki boşlukları koruyan Llama stili ön-tokenizer'yi uygulayın. Kelime dağarcığını aynı kaynaktaki GPT-2 normal ifade yaklaşımıyla karşılaştırın.
3. **Zor:** `{"role": ..., "content": ...}` mesajların listesini alan ve Llama 3 sohbet formatı için doğru token sırasını üreten bir sohbet şablonu yöntemi ekleyin. HuggingFace uygulamasına karşı test edin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|----------------------|
| Bayt düzeyinde BPE | "Baytlarla çalışanTokenizer" | 256 bayt değerinden oluşan temel kelime dağarcığına sahip BPE - bilinmeyen token'ler olmadan her türlü girişi yönetir |
| Öntokenönleştirme | "BPE'den önce bölme" | BPE'nin sözcük sınırlarını aşarak birleşmesini engelleyen normal ifade veya kural tabanlı bölme |
| NFKC normalizasyonu | "Unicode temizleme" | Kanonik ayrıştırma ve ardından uyumluluk kompozisyonu - "fi" bitişik harfler "fi" olur, tam genişlikte "A", "A" olur |
| Sohbet şablonu | "Mesajlar nasıl token'lara dönüşür?" | Rol/içerik mesajları listesini düz bir token dizisine dönüştürmek için tam format - modele özeldir ve eğitim formatıyla eşleşmelidir |
| Özel token'lar | "Kontrol token'ler" | BPE'yi atlayan ayrılmış token kimlikleri -- [BOS], [EOS], [PAD], sohbet işaretçileri -- birleştirmeden önce tam olarak eşleşti |
| Doğurganlık | "Tokens kelime başına" | Çıkış token'ların giriş kelimelerine oranı -- GPT-4'te İngilizce için 1,3, Korece için 2-3, daha yüksek olması bağlamın boşa harcandığı anlamına gelir |
| tiktoken | "OpenAI tokenizer" | Python bağlamalarıyla Rust BPE uygulaması - saf Python'dan 10-100 kat daha hızlı |
| Tabloyu birleştir | "Sözlük" | Eğitim sırasında öğrenilen bayt çifti birleştirmelerinin sıralı listesi - bu, tokenizer'nin öğrenilen bilgisidir |

## Daha Fazla Okuma

- [OpenAI tiktoken source](https://github.com/openai/tiktoken) -- GPT-3.5/4 tarafından kullanılan Rust BPE uygulaması
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers) -- BPE, WordPiece, Unigram'ı destekleyen Rust tokenizer kitaplığı
- [Llama 3 makalesi (Meta, 2024)](https://arxiv.org/abs/2407.21783) -- 128K kelime bilgisi ve tokenizer eğitimi hakkında ayrıntılar
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226) -- dilden bağımsız tokenizasyon
- [GPT-2 tokenizer kaynak](https://github.com/openai/gpt-2/blob/master/src/encoder.py) -- orijinal bayttan Unicode'a eşleme
