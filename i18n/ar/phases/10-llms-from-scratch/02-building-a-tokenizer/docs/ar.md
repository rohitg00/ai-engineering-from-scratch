# بناء Tokenizer من الصفر

> الدروس رقم واحد أعطتك لعبة، هذه الدروس تعطيك سلاحاً

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lesson 01 (Tokenizers: BPE, WordPiece, SentencePiece)
**Time:** ~90 minutes

## أهداف التعلم

- قم ببناء رمز BPE من مستوى الإنتاج الذي يتعامل مع Unicode ، وتطبيع الفضاء الأبيض ، والرموز الخاصة
- تنفيذ التراجع على مستوى البايت حتى يتمكن الوهم من تشفير أي مدخل (بما في ذلك إيموجي ، CJK ، والرمز) دون رموز مجهولة
- إضافة أنماط regex قبل التوكينيزة التي تقسم النص في حدود الكلمات قبل تطبيق دمج BPE
- تدريب رمزية مخصصة على الجسم وتقييم نسبة ضغطها مقابل التكوكين على النص متعدد اللغات

## المشكلة

رمز البيانات البيانية من الدروس 01 يعمل على النص الإنجليزي الآن ارمي اليابانية عليه أو إيموجي أو رمز Python مع علامات التبويب المختلطة والمساحات

إنه يتحطم

ليس لأن BPE خاطئ، لأن التنفيذ غير كامل. إشارة الإنتاج تتعامل مع البايتات الخام في أي تشفير، وتقوم بتطبيع يونيكود قبل الانقسام، وتتعامل مع الرموز الخاصة التي لا يتم دمجها، وتقوم بتطبيق الرموز قبل الانقسام مع الكلمات الفرعية، وتقوم بكل هذا بسرعة كافية لتجنب تعقيد خط أنابيب تعليمي معالجة 15 تريليون رمزا.

توكيينزير جي بي تي-2 لديه 50257 توكيين إلاما 3 لديها 128,256. (جبت 4) لديها حوالي 100 ألف هذه ليست أرقام ألعاب تم تدريب الجداول المدمجة وراء هذه المفردات على مئات الجيغابايت من النص، والآلة المحيطة بها -- التطبيع، التوكنات المسبقة، حقن رمز خاص، تنسيق قوالب الدردشة -- هي ما يفصل بين رمزية تتعامل مع "هلا العالم"

ستقوم ببناء تلك الآلة

## المفهوم

### خط الأنابيب الكامل

إنّ رمز إنتاج ليس خوارزمية واحدة، بل خط أنابيب من خمس مراحل، تحلّ كلّ منها مشكلة مختلفة.

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

كل مرحلة لها وظيفة محددة:

| Stage | What It Does | Why It Matters |
|-------|-------------|----------------|
| Normalize | NFKC Unicode, lowercase optional, strip accents optional | "fi" ligature (U+FB01) becomes "fi" (two chars). Without this, same word gets different tokens. |
| Pre-Tokenize | Split text into chunks before BPE | Prevents BPE from merging across word boundaries. "the cat" should never produce a token "e c". |
| BPE Merge | Apply learned merge rules to byte sequences | The core compression. Turns raw bytes into subword tokens. |
| Special Tokens | Inject [BOS], [EOS], [PAD], chat template markers | These tokens have fixed IDs. They never participate in BPE merges. The model needs them for structure. |
| ID Mapping | Convert token strings to integer IDs | The model sees integers, not strings. |

### BPE مستوى البايت

كانت هذه الدعوة الصحيحة، لكننا نسرفنا شيئاً مهماً: ماذا يحدث عندما تكون تلك البايتات غير صالحة على UTF-8؟

يحل BPE على مستوى البايت هذا الأمر عن طريق التعامل مع كل قيمة البايت الممكنة (0-255) كرمز صالح. قاموسك الأساسي هو بالضبط 256 إدخال. أي ملف - نص، ثنائي، فاسد - يمكن أن يتم توكينه دون إنتاج رمز مجهول.

أضاف GPT-2 خدعة: خريطة كل بايت إلى حرف يونيكود قابل للطباعة حتى تظل المفردة قابلة للقراءة من قبل الإنسان. يصبح بايت 0x20 (المجال) حرف "G" في خريطهم. هذا تجميلي خالص. لا يهتم الخوارزمي.

القوة الحقيقية: BPE على مستوى البايت يتعامل مع كل لغة على وجه الأرض. الحروف الصينية 3 UTF-8 بايت لكل. اليابانية يمكن أن تكون 3-4 بايت. العربية، ديواناجاري، إيموجي -- كل ذلك مجرد تسلسل البايت. خوارزمية BPE يجد أنماط في هذه تسلسلات البايت بالضبط بنفس الطريقة التي يجد فيها أنماط في البايتات ASCII الإنجليزية.

### التوكنيزية السابقة

قبل أن يلمس BPE نصك، تحتاج إلى تقسيمه إلى قطع. هذا يمنع خوارزمية الاندماج من إنشاء رموز تتجاوز حدود الكلمات.

يستخدم GPT-2 نمط regex لتمزيق النص:

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

ينفصل هذا النمط على الانقباضات ("لا" يصبح "don" + "'t") ، الكلمات التي لديها مساحات رئيسية اختيارية ، والأرقام ، والخطوط ، والمساحة البيضاء. يتم الحفاظ على المساحة الرئيسية متصلة بالكلمة - لذلك "الكاتس" تصبح ["ال" " القط" "] ، وليس ["ال" " " " " القط" ".

يستخدم Llama SentencePiece ، الذي يخطى regex بالكامل. يعامل تيار البايت الخام كسلسلة طويلة واحدة ويسمح خوارزمية BPE معرفة الحدود. هذا أبسط ولكن يمنح BPE المزيد من الحرية لإنشاء رموز كلمة متقاطعة.

الاختيار مهم. يمنع regex GPT-2 من تعلم "ال" في نهاية كلمة واحدة و "ال" في بداية الكلمة التالية يجب أن تتضامن. يسمح SentencePiece بذلك ، مما ينتج أحيانًا ضغطًا أكثر كفاءة ولكن رموزًا أقل تفسيرًا.

### رموز خاصة

كل رمز إنتاج يحتفظ بطلائل رمزية للمعلامات الهيكلية:

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

لا يتم تقسيم الرموز الخاصة من قبل BPE. يتم مطابقةها بالضبط قبل تشغيل خوارزمية الاندماج ، وتم استبدالها بطاقة الهوية الثابتة ، ويتم توكيين النص المحيط بشكل طبيعي.

### نماذج الدردشة

هذا هو المكان الذي يخلط فيه معظم الناس ويتحطم معظم التنفيذات.

عندما ترسل رسائل إلى نموذج الدردشة، فإن API تقبل قائمة رسائل:

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

النموذج لا يرى JSON. إنه يرى تسلسل رمز مسطح. قاعدة الدردشة تحويل الرسائل إلى هذا التسلسل المسطح باستخدام رموز خاصة. كل نموذج يفعل هذا بشكل مختلف:

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

إذا أخطأت في القالب، فإن النموذج ينتج القمامة. تم تدريبها على شكل واحد بالضبط. أي انحراف -- خط جديد مفقود، رمز مبدل، مساحة إضافية -- يضع المدخل خارج توزيع التدريب.

### السرعة

بايثون بطيئ جداً لتعريف الإنتاج

تكتوكين (OpenAI) مكتوب في Rust مع روابط Python. تكتيكات HuggingFace هي أيضا Rust. SentencePiece هي C ++. هذه تحقق 10-100x سرعة أكثر من Python النقي.

من وجهة نظر: إضافة 15 تريليون توكن إلى إضافة إضافات للاما 3 إلى 1 مليون توكن في الثانية (بايثون السريع) سيستغرق 174 يومًا. عند 100 مليون توكن في الثانية (رست) ، يستغرق 1.7 يومًا.

أنت تقوم ببناء في Python لفهم الخوارزمية في الإنتاج، كنت تستخدم تنفيذ مرتب وتلمس فقط غلاف Python.

```figure
weight-tying
```

## بناءها

### الخطوة الأولى: تشفير مستوى البايت

أساس. حول أي سلسلة إلى تسلسل من البايت، خريطة كل بايت إلى حرف قابل للطباعة للعرض، وعكس العملية.

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

اختبار على النص متعدد اللغات لمعرفة عدد البايت:

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

"مرحبا" 5 بايت. "你好" 6 بايت (3 لكل حرف). إموجي النار 4 بايت. الوهم على مستوى البايت لا يهم ما هي اللغة. البايت هي بايت.

### الخطوة الثانية: التوكنيزر المسبق مع Regex

تقسيم النص إلى قطع باستخدام نمط GPT-2 regex. يتم تعريف كل جزء بشكل مستقل من قبل BPE.

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

- نعم`regex`الدليل يدعم إفلات خاصية Unicode (`\p{L}`للكتب`\p{N}`المكتبة القياسية`re`لم يكن لدينا ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما يصل إلى ما.`regex`. . .

جربها

```python
print(pre_tokenize("Hello, world! Don't stop."))
# ['Hello', ',', ' world', '!', ' Don', "'t", ' stop', '.']
```

يظل الفضاء الرئيسي مرتبطاً بالكلمة التي تليها. الكلمة الأولى لا تملك أي مساحة قبلها، لذا فإن جزءها هو`Hello`التقلصات تقسم عند المشاركة، والنقطة تصبح جزءا من نفسه، و BPE لن يدمج الرموز عبر هذه الحدود.

### الخطوة 3: BPE على تسلسلات البايت

الخوارزمية الأساسية من الدروس 01, ولكن الآن تعمل على قطع قبل الـ Tokenized بشكل مستقل.

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

### الخطوة الرابعة: التعامل مع رموز خاصة

الوهم الخاص يحتاج إلى مطابقة دقيقة وتعرف ثابتة.

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

### الخطوة 5: فئة Tokenizer كاملة

قم بتجميع كل شيء: تعاديل، تقسيم على رموز خاصة، تحديد قبل، دمج BPE، خريطة إلى هويات.

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

### الخطوة 6: اختبار متعددة اللغات

الاختبار الحقيقي، ألق الإنجليزية والصينية والإيموجي و الرمز عليه

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

الكلمات الصينية تنتج 3 بايت لكل واحد. الايموجي ينتج 4 بايت. لا احد منهم يضرب الوهم. لا احد ينتج رموز مجهولة. هذا هو قوة BPE على مستوى البايت.

## استخدمها

### مقارنة المشاركات الحقيقية

قم بتحميل الرموز الفعلية من Llama 3، GPT-4، و Mistral. انظر كيفية كل منهما التعامل مع نفس الفقرة متعددة اللغات.

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

سترى حسابات رمزية مختلفة لنفس النص. Llama 3 مع ذخيرة 128K أكثر عدوانية في دمج الأنماط المشتركة. GPT-4 مع 100K يجلس في الوسط. Mistral مع 32K ينتج المزيد من الرموز ولكن لديها طبقة تضمين أصغر.

التنازل هو دائما نفس الشيء: المفردات الكبيرة تعني تسلسلات أقصر ولكن معايير أكثر.

## أرسله

هذه الدروس تنتج طلب لبناء وتحريف أجهزة إضفاء الضبط الإنتاجية. انظر `outputs/prompt-tokenizer-builder.md`. . .

## التمارين

1. **Easy:**إضافة`get_token_bytes(id)`طريقة تظهر البايتات الخام لأي رمز هويت. استخدمها للتحقق من ما تمثل أهم رموز دمجك في الواقع.
2. **Medium:**تنفيذ المُقبل للتوكينيزير على طراز Llama الذي ينقسم على الفضاء الأبيض والأرقام لكنه يحتفظ بالفراغات الرائدة. مقارنة ذخيره المفرد مع نهج GPT-2 regex على نفس الجسم.
3. **Hard:**إضافة طريقة نموذج دردشة تأخذ قائمة `{"role": ..., "content": ...}`رسائل وتنتج تسلسل رمزية صحيحة لنموذج دردشة Llama 3. اختبرها مع تنفيذ HuggingFace.

## الشروط الرئيسية

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

## المزيد من القراءة

- [OpenAI tiktoken source](https://github.com/openai/tiktoken)-- تنفيذ BPE الخرسانة المستخدمة من قبل GPT-3.5/4
- [HuggingFace tokenizers](https://github.com/huggingface/tokenizers)-- مكتبة الرست توكنيزر التي تدعم BPE، WordPiece، Unigram
- [Llama 3 paper (Meta, 2024)](https://arxiv.org/abs/2407.21783)-- تفاصيل حول 128K المفردات والتدريب على الوسائط
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226)-- التوضيح اللغوي
- [GPT-2 tokenizer source](https://github.com/openai/gpt-2/blob/master/src/encoder.py)-- الخرائط الأصلية من البايت إلى اليونيكود
