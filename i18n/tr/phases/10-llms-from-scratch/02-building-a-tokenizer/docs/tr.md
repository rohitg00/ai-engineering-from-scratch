# Bir Tokenizer'i Baştan Yapmak

> Ders 01 sana bir oyuncak verdi.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lesson 01 (Tokenizers: BPE, WordPiece, SentencePiece)
**Time:** ~90 minutes

## Öğrenme Hedefleri

- Unicode, beyaz alan normallaştırımı ve özel tokenleri işleyen bir üretim derecesi BPE tokenizeri oluşturun
- Bayt seviyesindeki geri dönüşü uygulayın, böylece tokenizer bilinmeyen tokenler olmadan herhangi bir giriş (emoji, CJK ve kod da dahil) kodlayabilir
- BPE birleşmelerini uygulamadan önce kelime sınırlarında metni bölünen pre-tokenization regex modellerini ekle
- Bir corpus üzerinde özel bir tokenizer eğitmek ve çok dilli metinde tiktoken ile sıkıştırma oranını değerlendirmek

## Sorun

Ders 01'den gelen BPE işaretleyiciniz İngilizce metinde çalışıyor. Şimdi Japonca atın. Ya da emoji. Ya da Python kodu karışık sekmeleri ve boşluklarla.

- Kırırıyor.

BPE'nin yanlış olduğu için değil, uygulamanın tamamlanmamış olması için. Bir üretim tokenizerinin herhangi bir kodlama içindeki çiğ baytları işlediği için değil, bölmeden önce Unicode'u normalleştirdiği için, asla birleşmeyen özel tokenleri yönettiği için değil, alt sözcük bölüşmesi ile zincir öncesi tokenize edilmesi için ve tüm bunları 15 trilyon token işleme eğitimi borusunu boğazlamayacak kadar hızlı bir şekilde yapması için.

GPT-2'nin tokenizerinde 50.257 token var. Llama 3'ün sayısı 128.256'dır. GPT-4'de yaklaşık 100.000 tane var. Bunlar oyuncak numaraları değil. Bu sözlüklerin arkasındaki birleşme tabloları yüzlerce gigabayt metinde eğitilmiştir ve çevredeki makine - normallaşma, pre-tokenizasyon, özel token enjeksiyonu, sohbet şablon biçimlendirme - "hello world" ile tüm internetle ilgilenen bir tokenizeri ayırır.

Bu makineyi sen yapacaksın.

## Anlaşım

### Tam Boru hattı

Bir üretim tokenizer bir algoritma değil, her biri farklı bir sorunu çözmek için beş aşamalı bir boru hattıdır.

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

Her aşamanın özel bir işi vardır:

| Stage | What It Does | Why It Matters |
|-------|-------------|----------------|
| Normalize | NFKC Unicode, lowercase optional, strip accents optional | "fi" ligature (U+FB01) becomes "fi" (two chars). Without this, same word gets different tokens. |
| Pre-Tokenize | Split text into chunks before BPE | Prevents BPE from merging across word boundaries. "the cat" should never produce a token "e c". |
| BPE Merge | Apply learned merge rules to byte sequences | The core compression. Turns raw bytes into subword tokens. |
| Special Tokens | Inject [BOS], [EOS], [PAD], chat template markers | These tokens have fixed IDs. They never participate in BPE merges. The model needs them for structure. |
| ID Mapping | Convert token strings to integer IDs | The model sees integers, not strings. |

### BPE byte seviyesinde

Ders 01'nin tokenizer'i UTF-8 baytlarında çalıştı. Doğru bir çağrıydı. Ama önemli bir şeyi atladık: bu baytlar geçerli olmayan UTF-8'de ne olur?

BPE byte seviyesinde, her mümkün byte değeri (0-255) geçerli bir token olarak ele alarak çözülür. Temel sözlükleriniz tam olarak 256 girişi. Her dosya - metin, ikili, bozuk - bilinmeyen bir token üretmeden tokenlendirilebilir.

GPT-2 bir numara ekledi: her baytı bir basınabilir Unicode karakterine harcama yapın, böylece kelime birikimi insan tarafından okunur. 0x20 bayt (uzay) harcamalarında "G" karakterine dönüşür. Bu tamamen kozmetik. Algoritm umurunda değil.

Gerçek güç: BPE'nin byte seviyesinde dünya üzerindeki her dili ele alır. Çinli karakterler her biri 3 UTF-8 bytes. Japonca 3-4 byte olabilir. Arapça, Devanagari, emoji - hepsi sadece byte dizisi. BPE algoritması bu byte dizisinde kalıpları İngilizce ASCII byte'lerde bulduğu gibi bulur.

### Tokenizasyon öncesi

BPE metnize dokunmadan önce, onu parçalara ayırmanız gerekir. Bu, birleşme algoritmasının kelimeler sınırlarını uzanan jetonlar oluşturmasını engeller.

GPT-2 metni bölmek için regex örneğini kullanır:

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

Bu kalıp kısaltmalara ("don't" "don" + "'t" haline gelir), seçmeli ön alanlı, sayısal, noktalama ve beyaz alanlı kelimelere ayrılır. Ön alan sözcüğüne bağlanır - bu nedenle " kedi" [", " kedi" "), değil [", " ", " kedi" "].

Llama, regex'i tamamen atlayan SentencePiece'yi kullanır. Çiğ bayt akışını uzun bir dizi olarak ele alır ve BPE algoritmasının sınırları bulmasına izin verir. Bu daha basit ama BPE'ye çapraz sözcük jetonları oluşturmak için daha fazla özgürlük verir.

Seçim önemlidir. GPT-2'nin regex'i, tokenizer'in bir kelimenin sonunda "in" ve bir sonraki kelimenin başında "in" birleşmesi gerektiğini öğrenmesini engeller. SentencePiece buna izin verir, bu da bazen daha verimli sıkıştırma üretir ancak daha az yorumlanabilir tokens.

### Özel Tokenler

Her üretim tokenizer, yapısal işaretçiler için token kimliklerini saklar:

| Token | Purpose | Used By |
|-------|---------|---------|
| `[BOS]` / `<s>` | Beginning of sequence | Llama 3, GPT |
| `[EOS]` / `</s>` | End of sequence | All models |
| `[PAD]` | Padding for batch alignment | BERT, T5 |
| `[UNK]` | Unknown token (byte-level BPE eliminates this) | BERT, WordPiece |
| `<\|im_start\|>` | Chat message boundary start | ChatGPT, Qwen |
| `<\|im_end\|>` | Chat message boundary end | ChatGPT, Qwen |
| `<\|user\|>` | User turn marker | Llama 3 |
| `<\|assistant\|>` | Assistant turn marker | Llama 3 |

Özel tokenler hiçbir zaman BPE tarafından bölünmez. Birleştirme algoritması çalışmadan önce tam olarak eşlenir, sabit kimliği ile değiştirilir ve çevredeki metin normal olarak tokenized edilir.

### Çat Şablonları

Bu insanların çoğu karışıklık ve çoğu uygulamanın kırıldığı yer.

Bir sohbet modeline mesaj gönderdiğinizde, API bir mesaj listesini kabul eder:

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

Modeldeki JSON görünmüyor. Düz bir token dizini görüyor. Çat şablonu, mesajları özel tokenler kullanarak bu düz dizine dönüştürüyor. Her model bunu farklı yapar:

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

Şablonun yanlış yapılması ve modelin çöp üretmesi. Tam bir biçim üzerinde eğitildi. Her türlü sapma - kayıp bir yeni çizgi, değiştirilmiş bir token, ekstra bir alan - girişleri eğitim dağılımının dışında yerleştirir.

### Hızlılık

Python üretim tokenizasyonu için çok yavaş.

tiktoken (OpenAI) Python bağlamaları ile Rust'de yazılmıştır. HuggingFace tokenizeri de Rust. SentencePiece C++. Bunlar saf Python'a göre 10-100x hızlandırma sağlar.

Perspektif için: Llama 3 için 15 trilyon token'i 1 saniyelik 1 milyon token'a (hızlı Python) tokenize etmek 174 gün sürecek.

Algoritmi anlamak için Python'da inşa ediyorsunuz. Üretim sırasında, bir oluşturulmuş uygulamayı kullanır ve sadece Python kapakına dokunursunuz.

```figure
weight-tying
```

## Yapın

### Adım 1: Byte-Level Kodlama

Temel. Her bir ipçeyi bir bayt dizisine dönüştürün, her baytı görüntülemek için basılabilir bir karakterle haritasın ve süreci tersine çevirin.

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

Bayt sayısını görmek için çok dilli metinde test:

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

"hello" 5 byte. "你好" 6 byte (3 karakter başına). Ateş emoji 4 byte. Byte seviyesindeki tokenizer hangi dilden ibaret olduğu umurumda değil. Byte byte.

### Adım 2: Regex ile Pre- Tokenizer

GPT-2 regex modelini kullanarak metni parçalara ayırın.

```python
import re

try:
    import regex
    GPT2_PATTERN = regex.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""
    )
except ImportError:
    GPT2_PATTERN = re.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?[^\W\d_]+| ?\d+| ?(?:[^\s\w]|_)+|\s+(?!\S)|\s+"""
    )

def pre_tokenize(text):
    return [match.group() for match in GPT2_PATTERN.finditer(text)]
```

- Evet .`regex`modül Unicode özelliği kaçışlarını destekler (`\p{L}`Mektuplar için,`\p{N}`Standart kütüphanede.`re`modülde değil, bu yüzden fallback aynı sınıfları oluşturur `\w`- Evet .`[^\W\d_]`her türlü Unicode harfine eşleşir ve `\d`Herhangi bir Unicode rakamı. Üretim çok dilli işaretleyiciler için yükleyin `regex`- Evet .

Denemeyin.

```python
print(pre_tokenize("Hello, world! Don't stop."))
# ['Hello', ',', ' world', '!', ' Don', "'t", ' stop', '.']
```

Önceki boşluk, ardından gelen kelime ile bağlanır.`Hello`BPE bu sınırları asla birleştirmez.

### Adım 3: Byte Sequences'te BPE

01-ci dersden gelen temel algoritma, ama şimdi önceden tokenize edilmiş parçalarda bağımsız olarak çalışıyor.

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

### Dördüncü Adım: Özel İşaret İşlemi

Özel tokenler tam eşleşme ve sabit kimliklere ihtiyaç duyar.

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

Her şeyi bir araya getir: normalleştir, özel tokenlere böl, önceden tokenleştir, BPE birleşmesi, harita ile kimlikler.

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

### Adım 6: Çok Dilli Sınav

Gerçek test İngilizce, Çin, emoji ve kod at.

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

Çinli karakterler her biri 3 byte üretir. emoji 4 byte üretir. Bunların hiçbiri tokenizer'i çarpmaz. Hiçbiri bilinmeyen tokenler üretmez. Bu byte seviyesindeki BPE'nin gücü.

## Kullan

### Gerçek Tokenizers'i karşılaştırmak

Llama 3, GPT-4 ve Mistral'ın gerçek işaretleyicilerini yükle ve her birinin aynı çok dilli paragrafı nasıl ele aldığını gör.

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

Aynı metin için farklı token sayısını göreceksiniz. 128K sözlüklü Llama 3 ortak desenleri birleştirmede daha agresif. 100K ile GPT-4 ortada oturur. 32K ile Mistral daha fazla token üretir ancak daha küçük bir yerleştirme katmanı vardır.

Bu anlaşma her zaman aynıdır: Daha büyük kelime kümesi daha kısa sıralamalar ama daha fazla parametre anlamına gelir.

## Gönder

Bu ders, üretim tokenizörlerini oluşturmak ve düzeltmek için bir ipucu üretir.`outputs/prompt-tokenizer-builder.md`- Evet .

## Egzersizler

1. **Easy:**Bir ekle`get_token_bytes(id)`Bu yöntem, herhangi bir token kimliği için çiğ baytları gösterir. En yaygın birleşik tokenlarınızın aslında neyi temsil ettiğini incelemek için kullanın.
2. **Medium:**Beyaz alan ve rakamlara bölünen, ama önde gelen alanları koruyan Llama tarzı pre-tokenizer'i uygulayın.
3. **Hard:** Listesi alan bir sohbet şablonu yöntemi ekle`{"role": ..., "content": ...}`mesajlar ve Llama 3 sohbet biçimi için doğru belirti sırasını üretir.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Byte-level BPE | "Tokenizer that works on bytes" | BPE with a base vocabulary of 256 byte values -- handles any input without unknown tokens |
| Pre-tokenization | "Splitting before BPE" | Regex or rule-based splitting that prevents BPE from merging across word boundaries |
| NFKC normalization | "Unicode cleanup" | Canonical decomposition followed by compatibility composition -- "fi" ligature becomes "fi", fullwidth "A" becomes "A" |
| Chat template | "How messages become tokens" | The exact format for converting a list of role/content messages into a flat token sequence -- model-specific and must match training format |
| Special tokens | "Control tokens" | Reserved token IDs that bypass BPE -- [BOS], [EOS], [PAD], chat markers -- matched exactly before merge |
| Fertility | "Tokens per word" | Ratio of output tokens to input words -- 1.3 for English in GPT-4, 2-3 for Korean, higher means wasted context |
| tiktoken | "OpenAI tokenizer" | Rust BPE implementation with Python bindings -- 10-100x faster than pure Python |
| Merge table | "The vocabulary" | Ordered list of byte-pair merges learned during training -- this IS the tokenizer's learned knowledge |

## Daha Fazla Okumak

- [OpenAI tiktoken source](https://github.com/openai/tiktoken)-- GPT-3.5/4 tarafından kullanılan Rust BPE uygulaması
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers)-- Rust Tokenizer kütüphanesi BPE, WordPiece, Unigram'ı destekler
- [Llama 3 paper (Meta, 2024)](https://arxiv.org/abs/2407.21783)-- 128K kelime birikimi ve tokenizer eğitimi hakkında detaylar
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226)-- dil-agnostik simgelendirme
- [GPT-2 tokenizer source](https://github.com/openai/gpt-2/blob/master/src/encoder.py)-- orijinal bayt-Unicode haritası
