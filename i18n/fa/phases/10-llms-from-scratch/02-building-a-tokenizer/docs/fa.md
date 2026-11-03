# ساخت یک توکن از ابتدا

> درس اول بهت يه اسباب بازي داد اين درس بهت يه اسلحه داد

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lesson 01 (Tokenizers: BPE, WordPiece, SentencePiece)
**Time:** ~90 minutes

## اهداف یادگیری

- یک توکنیزر BPE درجه تولید ایجاد کنید که یونیکوید، نورمال سازی فضای سفید و توکن های ویژه را اداره کند
- پیاده سازی fallback باط سطح به طوری که توکنایزر می تواند هر ورودی (از جمله emoji، CJK، و کد) بدون توکن های ناشناخته کدگذاری شود
- اضافه کردن الگوهای regex قبل از توکن سازی که متن را در مرز کلمات تقسیم می کنند قبل از اعمال ادغام BPE
- یک توکنایزر سفارشی را در یک کورپوس آموزش دهید و نسبت فشرده سازی آن را در برابر تکتون در متن چند زبانی ارزیابی کنید

## مشکل

توکنيزر BPE از درس 01 با متن انگلیسی کار ميکنه حالا به زبان ژاپني بهش بزن يا ايموجی يا کد پايتون با تب و فضايلي مخلوط

شکسته

نه به این دلیل که BPE اشتباه است، زیرا پیاده سازی نامکمل است. یک توکنایزر تولید با بیت های خام در هر کد بندی، یونیکوڈ را قبل از تقسیم، عادی می کند، توکن های ویژه را که هرگز ترکیب نمی شوند، مدیریت می کند، زنجیره های پیش از توکن سازی با تقسیم زیرکلمه، و همه این کار را به اندازه کافی سریع انجام می دهد تا یک خط لوله آموزش پردازش 15 تریلیون توکن را خنثی نکند.

توکنيزر GPT-2 50257 توکن داره لامای 3 128256 عدد داره GPT-4 حدود 100 هزار تا داره اين شماره هاي بازي نيست جدول های ادغام پشت این لغات ها بر روی صدها گیگابایت متن آموزش دیده اند، و دستگاه های اطراف -- نرمال سازی، پیش از توکن سازی، تزریق توکن های ویژه، قالب شکل دادن چت -- چیزی است که یک توکنایزر را که "سلام دنیا" را اداره می کند از آن چیزی که کل اینترنت را اداره می کند، جدا می کند.

تو ميخواي اون ماشين رو بسازي

## مفهوم

### خط لوله کامل

یک توکن تولید یک الگوریتم نیست بلکه یک خط لوله از پنج مرحله است که هر کدام یک مشکل متفاوت را حل می کنند.

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

هر مرحله يه شغل خاص داره:

| Stage | What It Does | Why It Matters |
|-------|-------------|----------------|
| Normalize | NFKC Unicode, lowercase optional, strip accents optional | "fi" ligature (U+FB01) becomes "fi" (two chars). Without this, same word gets different tokens. |
| Pre-Tokenize | Split text into chunks before BPE | Prevents BPE from merging across word boundaries. "the cat" should never produce a token "e c". |
| BPE Merge | Apply learned merge rules to byte sequences | The core compression. Turns raw bytes into subword tokens. |
| Special Tokens | Inject [BOS], [EOS], [PAD], chat template markers | These tokens have fixed IDs. They never participate in BPE merges. The model needs them for structure. |
| ID Mapping | Convert token strings to integer IDs | The model sees integers, not strings. |

### BPE باطری

توکنيزر درسي 01 در بایت های UTF-8 کار مي کرد. اين تماس درست بود. اما ما چيزي مهم را رد کرديم: چه اتفاقی مي افتد وقتي اين بایت ها UTF-8 معتبر نباشند؟

BPE باط سطح باط با درمان هر باط ممکن است ارزش (0-255) به عنوان یک توکن معتبر. لغت پایه شما دقیقا 256 ورودی است. هر فایل - متن، دوگانه، فاسد - می تواند بدون تولید یک توکن ناشناخته توکن شده است.

GPT-2 یک ترفند اضافه کرد: هر بائیت را به یک کاراکتر یونیکود چاپی قرار دهید تا ذخایر لغات قابل خواندن باشد. بائیت 0x20 (فضا) در نقشه برداری آنها به کاراکتر "G" تبدیل می شود. این کاملاً زیبایی است. الگوریتم اهمیت نمی دهد.

قدرت واقعی: BPE سطح بائیت در هر زبان روی زمین کار می کند. حرف های چینی هر یک 3 بائیت UTF-8 هستند. ژاپنی می تواند 3-4 بائیت باشد. عربی، دیوانهگری، اموجی - همه فقط دنباله های بائیت. الگوریتم BPE الگوهای را دقیقاً به همان شیوه ای در این دنباله های بائیت پیدا می کند که الگوهای را در بائیت ASCII انگلیسی پیدا می کند.

### پیش از توکنیزاسیون

قبل از اینکه BPE به متن شما دست بزند، باید آن را به قطعات تقسیم کنید. این مانع از ایجاد توکن هایی از الگوریتم ادغام می شود که حدود کلمات را پوشش می دهد.

GPT-2 از الگوی regex برای تقسیم متن استفاده می کند:

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

این الگوی به انقباضات تقسیم می شود ("don't" به "don" + "'t") ، کلمات با فضاهای پیشرو، اعداد، امتیازات و فضای سفید. فضاهای پیشرو به کلمه متصل می شوند - بنابراین "قط" به ["the", "cat"] تبدیل می شود، نه ["the", " ", "cat"].

Llama از SentencePiece استفاده می کند که regex را به طور کامل رد می کند. این جریان بائته خام را به عنوان یک دنباله طولانی می کند و به الگوریتم BPE اجازه می دهد تا مرزها را مشخص کند. این ساده تر است اما به BPE آزادی بیشتری برای ایجاد توکن های کلمات عبور می دهد.

انتخاب مهم است. regex GPT-2 از یادگیری نشان دهنده جلوگیری می کند که "the" در پایان یک کلمه و "the" در آغاز کلمه بعدی باید ترکیب شوند. SentencePiece اجازه می دهد که گاهی اوقات فشرده سازی کارآمدتر اما نشان دهنده های کمتر تفسیر شده را تولید می کند.

### توکن های ویژه

هر توکن سازنده تولید برای نشانگرهای ساختاری توکن های شناسایی را ذخیره می کند:

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

توکن های ویژه هرگز توسط BPE تقسیم نمی شوند. آنها دقیقا قبل از اجرای الگوریتم ادغام مطابقت دارند، با شناسه ثابت آنها جایگزین می شوند و متن اطراف به طور معمول توکن می شود.

### قالب های چت

اینجا جایی است که اکثر مردم گیج و بیشتر پیاده سازی ها خراب می شوند.

وقتی پیام ها را به یک مدل چت ارسال می کنید، API یک لیست پیام ها را قبول می کند:

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

مدل JSON را نمی بیند. یک دنباله توکن مسطح را می بیند. قالب چت پیام ها را با استفاده از توکن های خاص به آن دنباله مسطح تبدیل می کند. هر مدل این کار را متفاوت انجام می دهد:

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

اگر قالب را اشتباه گرفتید، مدل زباله تولید می کند. این در یک فرمت دقیق آموزش داده شده است. هر انحراف - یک خط جدید گم شده، یک توکن جایگزین شده، یک فضای اضافی - ورودی را خارج از توزیع آموزش می کند.

### سرعت

پایتون برای توکن سازی تولید خیلی کند است.

tiktoken (OpenAI) با پیوند های پایتون به Rust نوشته شده است. توکن های HuggingFace نیز Rust هستند. SentencePiece C ++ است. این ها 10-100 برابر سرعت بیشتری نسبت به پایتون خالص را به دست می آورند.

برای چشم انداز: توکن سازی 15 تریلیون توکن برای Llama 3 در یک میلیون توکن در ثانیه (پایتون سریع) 174 روز طول می کشد. در 100 میلیون توکن در ثانیه (رسط) 1.7 روز طول می کشد.

شما در پیتون برای درک الگوریتم ساخت می کنید. در تولید، شما از یک پیاده سازی مرتب استفاده می کنید و فقط به بسته های پیتون لمس می کنید.

```figure
weight-tying
```

## آن را بسازید

### مرحله اول: کد بندی باط

پایه. هر رشته ای را به یک ردیف بائته تبدیل کنید، هر بائته را به یک کاراکتر چاپی برای نمایش تبدیل کنید و روند را معکوس کنید.

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

تست در متن چند زبانی برای دیدن تعداد بایت:

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

"سلام" 5 بایت است. "你好" 6 بایت است (3 در هر کاراکتر). اموجی آتش 4 بایت است. توکنزن سطح بایت مهم نیست که زبان چیست. بایت ها بایت هستند.

### مرحله 2: Pre- Tokenizer با Regex

متن را با استفاده از الگوی GPT-2 regex به قطعات تقسیم کنید. هر قطعه به طور مستقل توسط BPE نشان داده می شود.

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

.`regex`ماژول پشتیبانی از فرار از ویژگی های یونیکوید (`\p{L}`برای نامه ها`\p{N}`برای اعداد) کتابخانه استاندارد`re`ما به کلاس های کاراکتر ASCII برمی گردیم. برای تولید توکن های چند زبانی، نصب کنید `regex`. .

امتحان کن

```python
print(pre_tokenize("Hello, world! Don't stop."))
# ['Hello', ',', ' world', '!', ' Don', "'t", ' stop', '.']
```

فضای پیش رو به کلمه ای که بعد از آن است متصل می شود. کلمه اول هیچ فضای قبل از آن ندارد، بنابراین بخشش`Hello`. انقباضات در پستروف تقسیم می شوند . پونکتوشن به خودش تبدیل می شود . BPE هرگز توکن ها را در این مرزها ترکیب نمی کند

### مرحله 3: BPE در بایت های ترتیب

الگوریتم اصلی از درس 01, اما حالا روی قطعات قبل از توکن شدن مستقل کار می کنه.

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

### مرحله چهارم: استفاده از نشانه های ویژه

توکن های خاص نیاز به مطابقت دقیق و شناسایی ثابت دارند.

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

### مرحله 5: کلاس Tokenizer کامل

همه چیز را به هم متصل کنید: عادی سازی، تقسیم به توکن های خاص، پیش از توکن سازی، ادغام BPE، نقشه به شناسه ها.

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

### مرحله ۶: آزمون چند زبان

آزمون واقعی، انگليسي، چيني، ايموجي و کد رو به اون بذار

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

هر یک از شخصیت های چینی 3 بایت تولید می کند. ایموجی 4 بایت تولید می کند. هیچ یک از این ها توکنایزر را خراب نمی کند. هیچ یک از آنها توکن های ناشناخته را تولید نمی کند. این قدرت BPE سطح بایت است.

## ازش استفاده کن

### مقایسه توکن های واقعی

توکن های واقعی Llama 3، GPT-4 و Mistral را بارگذاری کنید. ببینید که هر کدام چگونه به همان پاراگراف چند زبانی دست می گیرند.

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

شما تعداد توکن های مختلف را برای همان متن خواهید دید. Llama 3 با 128K لغت در ادغام الگوهای مشترک تهاجمی تر است. GPT-4 با 100K در وسط قرار دارد. Mistral با 32K توکن های بیشتری تولید می کند اما یک لایه گنجانده کوچک تر دارد.

معامله همیشه یکسان است: لغت بزرگتر به معنای دنباله های کوتاه تر اما پارامتر های بیشتر است.

## -باده

این درس یک دستور برای ساخت و تنظیم خطا توکن های تولید را تولید می کند.`outputs/prompt-tokenizer-builder.md`. .

## تمرینات

1. **Easy:**اضافه کنید`get_token_bytes(id)`روش که باایت های خام برای هر توکن ID را نشان می دهد. از آن برای بررسی آنچه که رایج ترین توکن های ادغام شده شما در واقع نشان می دهد استفاده کنید.
2. **Medium:**استفاده از pre-tokenizer سبک Llama که در فضای سفید و ارقام تقسیم می شود اما فضای پیشرو را حفظ می کند. ذخایر لغات آن را با رویکرد GPT-2 regex در همان کورپوس مقایسه کنید.
3. **Hard:**یک روش قالب چت اضافه کنید که لیست  را در اختیار داشته باشد`{"role": ..., "content": ...}`پیام ها و تولید ترتیب صحیح توکن برای قالب چت Llama 3. آن را با اجرای HuggingFace تست کنید.

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [OpenAI tiktoken source](https://github.com/openai/tiktoken)-- پیاده سازی BPE زنگ استفاده شده توسط GPT-3.5/4
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers)-- کتابخانه توکن های زنگ با پشتیبانی از BPE، WordPiece، Unigram
- [Llama 3 paper (Meta, 2024)](https://arxiv.org/abs/2407.21783)-- جزئیات در مورد 128K لغت و آموزش توکنایزر
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226)-- نشان دادن زبان-آگست
- [GPT-2 tokenizer source](https://github.com/openai/gpt-2/blob/master/src/encoder.py)-- نقشه برداری بایت به یونیکودی اصلی
